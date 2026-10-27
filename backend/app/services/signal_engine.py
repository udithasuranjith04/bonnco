import logging
import threading
from dataclasses import asdict
from datetime import datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.app_setting import AppSetting
from app.models.news_sentiment import NewsSentiment
from app.models.signal import Signal
from app.services.historical_similarity import (
    describe_similarity_match,
    find_similar_period,
    trend_from_price_emas,
)
from app.services.indicators import IndicatorSnapshot, compute_indicators
from app.services.pattern_history import record_pattern_occurrence
from app.services.signal_outcome_stats import track_record_caveat
from app.services.signal_outcomes import seed_signal_outcomes
from app.services.symbols import base_asset as _base_asset
from patterns.models import DetectedPattern
from patterns.pattern_detector import detect_patterns, select_headline_pattern

logger = logging.getLogger("bonnco.signal_engine")

settings = get_settings()

RISK_PROFILES = ("conservative", "moderate", "aggressive")

# How wide the "no clear edge" HOLD band is, and how strong a combined score needs to be
# to earn a STRONG_ prefix. Conservative traders need more conviction before we call a trade.
HOLD_BAND = {"conservative": 0.35, "moderate": 0.20, "aggressive": 0.10}
STRONG_THRESHOLD = {"conservative": 0.70, "moderate": 0.60, "aggressive": 0.50}

LEVERAGE_RANGES = {"conservative": (1.0, 3.0), "moderate": (2.0, 5.0), "aggressive": (3.0, 10.0)}
STOP_LOSS_PCT = {"conservative": 0.015, "moderate": 0.025, "aggressive": 0.04}

# A detected chart pattern nudges confidence, not the BUY/SELL/HOLD call itself — the call stays
# purely a function of the technical + sentiment combined score. Max points added/removed when the
# pattern's bias agrees/conflicts with the call direction, scaled by completeness and confirmation.
PATTERN_CONFIDENCE_NUDGE_MAX = 8

SENTIMENT_LOOKBACK_HOURS = 24

# Candles only meaningfully change on the scheduler's ~60s refresh cadence (or a live WS candle
# close). Recomputing on every request when several cards/pollers ask for the same symbol within
# a short window just burns CPU and bloats the signals table with near-duplicate rows — so a
# recent-enough signal is served straight from MySQL instead of recomputed from scratch.
SIGNAL_CACHE_SECONDS = 30

# The signal cache key (symbol/market_type/timeframe) doesn't include risk profile, since it isn't
# per-request state — it's a single global app setting. Without this, switching risk profile and
# immediately re-checking a coin within the cache window would silently return a signal computed
# under the old profile. Tracked in-process since this app runs as a single uvicorn worker.
_risk_profile_changed_at: datetime | None = None

# FastAPI runs sync route handlers in a threadpool, so two near-simultaneous requests for the same
# (symbol, market_type, timeframe) — e.g. the background watcher's 60s poll landing right as the
# user opens Coin Detail — can both pass the "no recent signal" cache check before either one has
# committed its INSERT, then both compute and write independently. Observed live: duplicate rows
# with identical created_at timestamps for the same symbol/timeframe. A lock per (symbol,
# market_type, timeframe) key serializes generation for that one coin+timeframe so the second
# caller blocks briefly and then hits the now-fresh cache instead of racing a duplicate compute.
_generation_locks: dict[tuple[str, str, str], threading.Lock] = {}
_generation_locks_guard = threading.Lock()


def _lock_for(symbol: str, market_type: str, timeframe: str) -> threading.Lock:
    key = (symbol, market_type, timeframe)
    with _generation_locks_guard:
        lock = _generation_locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _generation_locks[key] = lock
        return lock


def notify_risk_profile_changed() -> None:
    global _risk_profile_changed_at
    _risk_profile_changed_at = datetime.utcnow()

TECH_WEIGHT = 0.7
SENTIMENT_WEIGHT = 0.3
# Sum of the max magnitude each indicator below can contribute: RSI 1.0, MACD 2.0, EMA 2.0,
# Bollinger 1.0, volume 0.5, support/resistance 0.5, trade delta 0.5 (when real delta data exists).
MAX_TECH_SCORE = 7.5




def get_risk_profile(db: Session) -> str:
    row = db.get(AppSetting, "risk_profile")
    if row and row.value in RISK_PROFILES:
        return row.value
    return settings.risk_profile if settings.risk_profile in RISK_PROFILES else "moderate"


def _score_rsi(rsi_value: float) -> tuple[float, str]:
    if rsi_value >= 70:
        return -1.0, f"RSI {rsi_value} is overbought"
    if rsi_value <= 30:
        return 1.0, f"RSI {rsi_value} is oversold (potential bounce)"
    return 0.0, f"RSI {rsi_value} is neutral"


def _score_macd(label: str) -> tuple[float, bool, str]:
    lower = label.lower()
    fresh = "just crossed" in lower
    if "bullish" in lower:
        return (2.0 if fresh else 1.0), fresh, label
    if "bearish" in lower:
        return (-2.0 if fresh else -1.0), fresh, label
    return 0.0, False, label


def _score_ema(label: str) -> tuple[float, bool, str]:
    lower = label.lower()
    if "crossed above" in lower:
        return 2.0, True, label
    if "crossed below" in lower:
        return -2.0, True, label
    if "established uptrend" in lower:
        return 1.0, False, label
    if "established downtrend" in lower:
        return -1.0, False, label
    if "long-term uptrend" in lower:
        return 0.5, False, label
    if "long-term downtrend" in lower:
        return -0.5, False, label
    return 0.0, False, label


def _score_bollinger(percent_b: float, label: str, rsi_value: float, price_vs_ema9_pct: float) -> tuple[float, str]:
    # Riding the upper band is only a mean-reversion warning when it's paired with an overbought
    # RSI or a sharp 1-2 candle spike (price running far ahead of its own EMA9). A steady, non-overbought
    # uptrend walking the upper band is usually strength continuing, not exhaustion, so don't penalize that.
    is_overbought_rsi = rsi_value >= 70
    is_spiking = price_vs_ema9_pct >= 0.015

    if percent_b > 1:
        if is_overbought_rsi or is_spiking:
            return -1.0, label
        return -0.3, label + " (steady trend, RSI not overbought, treated as reduced-severity caution, not exhaustion)"
    if percent_b < 0:
        return 1.0, label
    if percent_b > 0.8:
        if is_overbought_rsi or is_spiking:
            return -0.5, label
        return 0.15, label + " (steady uptrend with RSI not overbought, read as mild strength, not reversion risk)"
    if percent_b < 0.2:
        return 0.5, label
    return 0.0, label


def _score_volume(ratio: float, ema9: float, ema21: float, label: str) -> tuple[float, str]:
    if ratio < 2.0:
        return 0.0, label
    direction = 1.0 if ema9 >= ema21 else -1.0
    return 0.5 * direction, label + ", confirming the current short-term trend direction"


def _score_support_resistance(value: dict, price: float, label: str) -> tuple[float, str]:
    support = value.get("nearest_support")
    resistance = value.get("nearest_resistance")
    if support is not None and (price - support) / price <= 0.01:
        return 0.5, label
    if resistance is not None and (resistance - price) / price <= 0.01:
        return -0.5, label
    return 0.0, label


def _score_delta(interpretation: str, label: str) -> tuple[float, str]:
    if interpretation == "net buying pressure":
        return 0.5, label
    if interpretation == "net selling pressure":
        return -0.5, label
    return 0.0, label


def _technical_score(snapshot: IndicatorSnapshot) -> tuple[float, list[str], list[str]]:
    """Returns (score, all contributing factor descriptions, fresh 'why now' events)."""
    factors: list[str] = []
    why_now: list[str] = []
    score = 0.0

    rsi_pts, rsi_desc = _score_rsi(snapshot.rsi.value)
    score += rsi_pts
    factors.append(rsi_desc)

    macd_pts, macd_fresh, macd_desc = _score_macd(snapshot.macd.label)
    score += macd_pts
    factors.append(macd_desc)
    if macd_fresh:
        why_now.append(macd_desc)

    ema_pts, ema_fresh, ema_desc = _score_ema(snapshot.ema.label)
    score += ema_pts
    factors.append(ema_desc)
    if ema_fresh:
        why_now.append(ema_desc)

    price_vs_ema9_pct = abs(snapshot.price - snapshot.ema.value["ema9"]) / snapshot.ema.value["ema9"]
    bb_pts, bb_desc = _score_bollinger(
        snapshot.bollinger.value["percent_b"], snapshot.bollinger.label, snapshot.rsi.value, price_vs_ema9_pct
    )
    score += bb_pts
    factors.append(bb_desc)

    vol_pts, vol_desc = _score_volume(
        snapshot.volume.value["ratio"], snapshot.ema.value["ema9"], snapshot.ema.value["ema21"], snapshot.volume.label
    )
    score += vol_pts
    factors.append(vol_desc)
    if vol_pts != 0:
        why_now.append(vol_desc)

    sr_pts, sr_desc = _score_support_resistance(snapshot.support_resistance.value, snapshot.price, snapshot.support_resistance.label)
    score += sr_pts
    factors.append(sr_desc)

    # Only scored when real trade-delta data has actually been tracked for this symbol — omitted
    # entirely rather than added as a fake "neutral" factor when there's simply no data yet.
    if snapshot.delta is not None:
        delta_pts, delta_desc = _score_delta(snapshot.delta.interpretation, snapshot.delta.label)
        score += delta_pts
        factors.append(delta_desc)

    return score, factors, why_now


def _sentiment_score(db: Session, base_symbol: str, hours: int = SENTIMENT_LOOKBACK_HOURS) -> dict:
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    rows = db.scalars(
        select(NewsSentiment)
        .where(
            NewsSentiment.created_at >= cutoff,
            or_(
                NewsSentiment.related_symbol.contains(base_symbol),
                NewsSentiment.related_symbol.is_(None),
            ),
        )
        .order_by(NewsSentiment.created_at.desc())
    ).all()

    value_map = {"bullish": 1.0, "bearish": -1.0, "neutral": 0.0}
    weighted_sum, weight_total = 0.0, 0.0
    coin_specific_count = 0

    for row in rows:
        is_coin_specific = row.related_symbol is not None and base_symbol in row.related_symbol
        weight = 1.0 if is_coin_specific else 0.5
        weighted_sum += value_map[row.sentiment] * row.confidence * weight
        weight_total += weight
        if is_coin_specific:
            coin_specific_count += 1

    avg_score = weighted_sum / weight_total if weight_total else 0.0
    avg_confidence = sum(r.confidence for r in rows) / len(rows) if rows else 0.0

    top_headlines = [
        {
            "headline": r.headline,
            "sentiment": r.sentiment,
            "confidence": r.confidence,
            "source": r.source,
            "url": r.url,
        }
        for r in rows[:3]
    ]

    return {
        "avg_score": round(avg_score, 3),
        "avg_confidence": round(avg_confidence, 3),
        "headline_count": coin_specific_count,
        "lookback_hours": hours,
        "recent_headlines": top_headlines,
    }


def _calculate_stop_loss(snapshot: IndicatorSnapshot, entry_price: float, risk_profile: str, direction: str) -> float:
    """Always returns a real reference stop-loss level — for HOLD calls too, not just BUY/SELL.

    Blends three inputs: a flat risk-profile percentage, current volatility (Bollinger band half-width,
    used as an ATR-style proxy since we don't compute true ATR), and the nearest support/resistance level
    with a small buffer. Takes the widest (most breathing room) of the three, but bounded to at most 2.5x
    the flat-percentage distance so a stray/no-data structure or a spike in volatility can't blow the stop
    out to something impractical.
    """
    pct = STOP_LOSS_PCT[risk_profile]
    max_distance = entry_price * pct * 2.5

    pct_based = entry_price * (1 - pct) if direction == "long" else entry_price * (1 + pct)

    band_half_width = (snapshot.bollinger.value["upper"] - snapshot.bollinger.value["lower"]) / 2
    vol_based = entry_price - band_half_width if direction == "long" else entry_price + band_half_width

    sr = snapshot.support_resistance.value
    structure_level = sr.get("nearest_support") if direction == "long" else sr.get("nearest_resistance")
    candidates = [pct_based, vol_based]
    if structure_level is not None:
        buffer = entry_price * 0.003
        structure_based = structure_level - buffer if direction == "long" else structure_level + buffer
        candidates.append(structure_based)

    if direction == "long":
        floor = entry_price - max_distance
        stop = max(min(candidates), floor)
    else:
        ceiling = entry_price + max_distance
        stop = min(max(candidates), ceiling)

    return round(stop, 4)


def _article(word: str) -> str:
    return "an" if word[:1].lower() in "aeiou" else "a"


def _call_bias(call: str) -> str | None:
    if call in ("BUY", "STRONG_BUY"):
        return "bullish"
    if call in ("SELL", "STRONG_SELL"):
        return "bearish"
    return None  # HOLD has no direction for a pattern to agree or conflict with


def _pattern_confidence_adjustment(headline: DetectedPattern | None, call: str) -> int:
    if headline is None or headline.bias == "neutral":
        return 0
    call_bias = _call_bias(call)
    if call_bias is None:
        return 0

    weight = headline.completeness * (1.25 if headline.confirmed else 1.0)
    magnitude = round(min(PATTERN_CONFIDENCE_NUDGE_MAX, weight * PATTERN_CONFIDENCE_NUDGE_MAX))
    return magnitude if headline.bias == call_bias else -magnitude


def _pattern_reasoning_note(
    base_symbol: str, headline: DetectedPattern | None, secondary: DetectedPattern | None, call: str
) -> str | None:
    if headline is None:
        return None

    name = headline.pattern.replace("_", " ")
    state = "confirmed" if headline.confirmed else f"{round(headline.completeness * 100)}% formed, not yet confirmed"
    note = f"{base_symbol} is also showing {_article(name)} {name} on the {headline.timeframe} ({state}). {headline.interpretation}"

    call_bias = _call_bias(call)
    if call_bias is not None and headline.bias in ("bullish", "bearish"):
        note += (
            " This lines up with the current technical read."
            if headline.bias == call_bias
            else " This runs counter to the current technical read, adding some uncertainty."
        )

    if secondary is not None:
        secondary_name = secondary.pattern.replace("_", " ")
        note += f" {base_symbol} is also showing early signs of {_article(secondary_name)} {secondary_name}."

    return note


def _pattern_short_summary(headline: DetectedPattern | None) -> str | None:
    """One short sentence for the default card view — no price levels, no confirmation math,
    that detail lives in the full reasoning text instead so the card doesn't get denser as more
    patterns stack up over time.
    """
    if headline is None:
        return None
    name = headline.pattern.replace("_", " ")
    if headline.confirmed:
        return f"Confirmed {name} on the {headline.timeframe}."
    return f"Also forming {_article(name)} {name} on the {headline.timeframe}, not yet confirmed."


def _build_reasoning(
    base_symbol: str,
    timeframe: str,
    signal: str,
    confidence: int,
    factors: list[str],
    sentiment: dict,
    why_now: list[str],
    pattern_note: str | None,
    historical_note: str | None,
    track_record_note: str | None,
) -> str:
    parts = [
        f"{base_symbol} is showing a {signal.replace('_', ' ')} signal on the {timeframe} timeframe "
        f"with {confidence}% confidence."
    ]
    parts.append("Technical picture: " + "; ".join(factors) + ".")

    if sentiment["headline_count"] > 0:
        lean = (
            "bullish" if sentiment["avg_score"] > 0.15 else "bearish" if sentiment["avg_score"] < -0.15 else "mixed"
        )
        parts.append(
            f"News sentiment over the last {sentiment['lookback_hours']}h is net {lean} "
            f"across {sentiment['headline_count']} {base_symbol}-specific headline(s)."
        )
    else:
        parts.append("No recent coin-specific news sentiment was available for this call.")

    if why_now:
        parts.append("Why now: " + "; ".join(why_now) + ".")

    if pattern_note:
        parts.append(pattern_note)

    if historical_note:
        parts.append(historical_note)

    if track_record_note:
        parts.append(track_record_note)

    return " ".join(parts)


def generate_signal(db: Session, symbol: str, market_type: str, timeframe: str) -> Signal:
    """Compute a fresh BUY/SELL/HOLD call and persist it to the signals table — or return the
    cached one from within SIGNAL_CACHE_SECONDS. Serialized per (symbol, market_type, timeframe)
    so two near-simultaneous callers (e.g. the background watcher and a page open at the same
    moment) can't both slip past the cache check and both compute+insert independently — see
    _lock_for's comment above for why this matters."""
    with _lock_for(symbol, market_type, timeframe):
        return _generate_signal_locked(db, symbol, market_type, timeframe)


def _generate_signal_locked(db: Session, symbol: str, market_type: str, timeframe: str) -> Signal:
    """Every call to this function logs a row — the signal is never returned without
    being written to MySQL first, since that history is what lets us later compare
    signal vs. actual outcome. Exception: if a signal for this exact symbol/market/timeframe
    was already generated within SIGNAL_CACHE_SECONDS, that one is returned as-is rather than
    recomputed — see SIGNAL_CACHE_SECONDS above for why.
    """
    cache_cutoff = datetime.utcnow() - timedelta(seconds=SIGNAL_CACHE_SECONDS)
    recent = db.scalars(
        select(Signal)
        .where(
            Signal.symbol == symbol,
            Signal.market_type == market_type,
            Signal.timeframe == timeframe,
            Signal.created_at >= cache_cutoff,
        )
        .order_by(Signal.created_at.desc())
        .limit(1)
    ).first()
    if recent is not None and (_risk_profile_changed_at is None or recent.created_at >= _risk_profile_changed_at):
        return recent

    snapshot = compute_indicators(db, symbol, market_type, timeframe)
    risk_profile = get_risk_profile(db)
    base_symbol = _base_asset(symbol)

    tech_score, factors, why_now = _technical_score(snapshot)
    normalized_tech = max(-1.0, min(1.0, tech_score / MAX_TECH_SCORE))

    sentiment = _sentiment_score(db, base_symbol)
    normalized_sentiment = max(-1.0, min(1.0, sentiment["avg_score"]))

    combined = TECH_WEIGHT * normalized_tech + SENTIMENT_WEIGHT * normalized_sentiment

    hold_band = HOLD_BAND[risk_profile]
    strong_threshold = STRONG_THRESHOLD[risk_profile]

    if combined >= strong_threshold:
        call = "STRONG_BUY"
    elif combined >= hold_band:
        call = "BUY"
    elif combined <= -strong_threshold:
        call = "STRONG_SELL"
    elif combined <= -hold_band:
        call = "SELL"
    else:
        call = "HOLD"

    confidence = round(min(95.0, 50.0 + abs(combined) * 45.0))
    if sentiment["headline_count"] == 0:
        confidence = max(30, confidence - 5)

    try:
        detected_patterns = detect_patterns(db, symbol, market_type, timeframe)
    except Exception:
        # Pattern detection is a best-effort enrichment, not a dependency — a failure here should
        # never block signal generation, the core of what this function exists to do.
        logger.exception("Pattern detection failed for %s %s %s", symbol, market_type, timeframe)
        detected_patterns = []
    headline_pattern, secondary_pattern = select_headline_pattern(detected_patterns)

    # Logged for every pattern actually detected, not just the one surfaced as headline — the
    # historical success-rate stats this builds toward would be biased if less-dominant pattern
    # types were never recorded just because something else won the headline slot that day.
    for detected in detected_patterns:
        try:
            record_pattern_occurrence(db, detected, snapshot.price)
        except Exception:
            logger.exception("Failed to record pattern history for %s %s %s", symbol, market_type, timeframe)

    confidence += _pattern_confidence_adjustment(headline_pattern, call)
    confidence = max(30, min(95, confidence))

    entry_price = snapshot.price
    long_bias = call in ("BUY", "STRONG_BUY")
    short_bias = call in ("SELL", "STRONG_SELL")

    if long_bias:
        stop_direction = "long"
    elif short_bias:
        stop_direction = "short"
    else:
        # HOLD still gets a reference stop — lean the same way the (weak) combined score leans,
        # so it's a meaningful "level to watch," not an arbitrary default.
        stop_direction = "long" if combined >= 0 else "short"

    stop_loss = _calculate_stop_loss(snapshot, entry_price, risk_profile, stop_direction)

    leverage_min = leverage_max = liquidation_estimate = None
    if market_type == "futures" and (long_bias or short_bias):
        base_min, base_max = LEVERAGE_RANGES[risk_profile]
        leverage_min = base_min
        leverage_max = round(base_min + (base_max - base_min) * (confidence / 95.0), 1)
        leverage_max = max(leverage_max, base_min)

        if long_bias:
            liquidation_estimate = round(entry_price * (1 - 1 / leverage_max), 4)
        else:
            liquidation_estimate = round(entry_price * (1 + 1 / leverage_max), 4)

    pattern_note = _pattern_reasoning_note(base_symbol, headline_pattern, secondary_pattern, call)

    # Best-effort enrichment, same as pattern detection above — a lookup failure should never
    # block signal generation, and an honest "nothing found" (None) is a valid, expected outcome.
    historical_note = None
    try:
        hist_trend = trend_from_price_emas(snapshot.price, snapshot.ema.value["ema50"], snapshot.ema.value["ema200"])
        similarity_match = find_similar_period(
            db, symbol, market_type, timeframe,
            snapshot.rsi.value, hist_trend, snapshot.volume.value["ratio"], snapshot.bollinger.value["percent_b"],
        )
        if similarity_match:
            historical_note = describe_similarity_match(base_symbol, similarity_match)
    except Exception:
        logger.exception("Historical similarity lookup failed for %s %s %s", symbol, market_type, timeframe)

    # Only meaningful for directional calls — HOLD isn't a win/loss prediction, so it has no
    # confidence-band/coin track record to honestly caveat against.
    track_record_note = None
    if call in ("BUY", "STRONG_BUY", "SELL", "STRONG_SELL"):
        try:
            track_record_note = track_record_caveat(db, symbol, confidence)
        except Exception:
            logger.exception("Track record caveat lookup failed for %s %s %s", symbol, market_type, timeframe)

    reasoning = _build_reasoning(
        base_symbol, timeframe, call, confidence, factors, sentiment, why_now, pattern_note, historical_note,
        track_record_note,
    )
    pattern_summary = _pattern_short_summary(headline_pattern)

    row = Signal(
        symbol=symbol,
        timeframe=timeframe,
        market_type=market_type,
        signal=call,
        confidence=confidence,
        reasoning=reasoning,
        entry_price=entry_price,
        stop_loss=stop_loss,
        suggested_leverage_min=leverage_min,
        suggested_leverage_max=leverage_max,
        liquidation_estimate=liquidation_estimate,
        indicator_snapshot=asdict(snapshot),
        sentiment_snapshot=sentiment,
        pattern_summary=pattern_summary,
        pattern_bias=headline_pattern.bias if headline_pattern else None,
        pattern_confirmed=headline_pattern.confirmed if headline_pattern else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    try:
        seed_signal_outcomes(db, row)
    except Exception:
        # Outcome tracking is a measurement layer on top of signal generation, not a dependency —
        # a failure here should never block returning the signal itself.
        logger.exception("Failed to seed signal outcomes for signal_id=%s", row.id)

    return row
