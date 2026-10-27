"""Aggregates real, resolved `signal_outcomes` rows into win-rate breakdowns — the measured track
record of Bonnco's own BUY/SELL/HOLD calls, not an estimate. 'unresolved' (not enough time or
candle data yet) and 'not_applicable' (HOLD, not a directional prediction) are excluded from every
win-rate calculation so a bucket's win_rate always means "correct / (correct + wrong)".
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.signal_outcome import SignalOutcome
from app.services.symbols import base_asset as _base_asset

LONG_SIGNALS = ("BUY", "STRONG_BUY")
SHORT_SIGNALS = ("SELL", "STRONG_SELL")

CONFIDENCE_BANDS = [
    (0, 50, "<50%"),
    (50, 60, "50-60%"),
    (60, 70, "60-70%"),
    (70, 80, "70-80%"),
    (80, 101, "80%+"),
]

# Below this many resolved checkpoints, a win rate is too noisy to be meaningful — the UI and any
# chat/reasoning callout should say so honestly rather than presenting a thin sample as settled fact.
RELIABLE_SAMPLE_SIZE = 20

# Thresholds for calling a bucket's track record "genuinely poor" enough to surface as a caution in
# chat/reasoning text (never used to auto-adjust the signal engine itself).
POOR_TRACK_RECORD_MIN_SAMPLE = 50
POOR_TRACK_RECORD_WIN_RATE_THRESHOLD = 45.0


def _bucket(rows: list[SignalOutcome]) -> dict:
    resolved = [r for r in rows if r.status in ("correct", "wrong")]
    correct = sum(1 for r in resolved if r.status == "correct")
    total = len(resolved)
    # A "wrong" outcome from hitting the stop-loss (position closed early, before this checkpoint's
    # own horizon) is a different thing from the price genuinely having moved the wrong direction by
    # the checkpoint time — reported separately so a horizon dominated by early stop-outs doesn't
    # read as "the multi-day call was wrong" when really "most of these got stopped out first".
    stopped_out = sum(1 for r in resolved if r.status == "wrong" and r.hit_stop_loss)
    return {
        "resolved": total,
        "correct": correct,
        "win_rate": round(correct / total * 100, 1) if total else None,
        "stopped_out": stopped_out,
    }


def _confidence_band(confidence: float) -> str:
    for low, high, label in CONFIDENCE_BANDS:
        if low <= confidence < high:
            return label
    return CONFIDENCE_BANDS[-1][2]


def _signal_family(signal_type: str) -> str | None:
    if signal_type in LONG_SIGNALS:
        return "BUY"
    if signal_type in SHORT_SIGNALS:
        return "SELL"
    return None  # HOLD isn't a directional prediction, excluded from every breakdown below


def compute_signal_outcome_stats(db: Session, symbol: str | None = None, timeframe: str | None = None) -> dict:
    query = select(SignalOutcome)
    if symbol:
        query = query.where(SignalOutcome.symbol == symbol.upper())
    if timeframe:
        query = query.where(SignalOutcome.timeframe == timeframe)
    rows = db.scalars(query).all()

    directional_rows = [r for r in rows if _signal_family(r.signal_type) is not None]

    by_confidence: dict[str, list[SignalOutcome]] = {}
    by_signal_type: dict[str, list[SignalOutcome]] = {}
    by_coin: dict[str, list[SignalOutcome]] = {}
    by_timeframe: dict[str, list[SignalOutcome]] = {}
    by_horizon: dict[int, list[SignalOutcome]] = {}

    for r in directional_rows:
        by_confidence.setdefault(_confidence_band(r.confidence), []).append(r)
        by_signal_type.setdefault(_signal_family(r.signal_type), []).append(r)
        by_coin.setdefault(_base_asset(r.symbol), []).append(r)
        by_timeframe.setdefault(r.timeframe, []).append(r)
        by_horizon.setdefault(r.horizon_hours, []).append(r)

    band_order = [label for _, _, label in CONFIDENCE_BANDS]

    return {
        "overall": _bucket(directional_rows),
        "reliable_sample_size": RELIABLE_SAMPLE_SIZE,
        "unresolved_count": sum(1 for r in rows if r.status == "unresolved"),
        "hold_count": sum(1 for r in rows if r.status == "not_applicable"),
        "by_confidence_band": [
            {"band": label, **_bucket(by_confidence[label])} for label in band_order if label in by_confidence
        ],
        "by_signal_type": [{"signal_type": key, **_bucket(vals)} for key, vals in sorted(by_signal_type.items())],
        "by_coin": sorted(
            [{"coin": key, **_bucket(vals)} for key, vals in by_coin.items()],
            key=lambda x: x["resolved"],
            reverse=True,
        ),
        "by_timeframe": [{"timeframe": key, **_bucket(vals)} for key, vals in sorted(by_timeframe.items())],
        "by_horizon_hours": [{"horizon_hours": key, **_bucket(vals)} for key, vals in sorted(by_horizon.items())],
    }


def track_record_caveat(db: Session, symbol: str, confidence: float) -> str | None:
    """Honest self-critique for one specific signal: if its confidence band and/or coin has a large
    enough resolved sample (>= POOR_TRACK_RECORD_MIN_SAMPLE) with a genuinely poor win rate
    (< POOR_TRACK_RECORD_WIN_RATE_THRESHOLD), say so plainly. Returns None when there isn't enough
    data yet or the track record isn't actually poor — never manufactures a caveat, and never
    adjusts the signal itself, only reports on it.
    """
    stats = compute_signal_outcome_stats(db)
    band = _confidence_band(confidence)
    coin = _base_asset(symbol)

    band_bucket = next((b for b in stats["by_confidence_band"] if b["band"] == band), None)
    coin_bucket = next((b for b in stats["by_coin"] if b["coin"] == coin), None)

    parts = []
    if band_bucket and band_bucket["resolved"] >= POOR_TRACK_RECORD_MIN_SAMPLE and (band_bucket["win_rate"] or 100) < POOR_TRACK_RECORD_WIN_RATE_THRESHOLD:
        parts.append(
            f"signals in the {band} confidence range have had only a {band_bucket['win_rate']}% success rate "
            f"across {band_bucket['resolved']} resolved calls to date"
        )
    if coin_bucket and coin_bucket["resolved"] >= POOR_TRACK_RECORD_MIN_SAMPLE and (coin_bucket["win_rate"] or 100) < POOR_TRACK_RECORD_WIN_RATE_THRESHOLD:
        parts.append(
            f"{coin} signals specifically have had only a {coin_bucket['win_rate']}% success rate across "
            f"{coin_bucket['resolved']} resolved calls to date"
        )

    if not parts:
        return None
    return "Honesty check on Bonnco's own track record: " + "; ".join(parts) + ". Weigh that against this specific call."
