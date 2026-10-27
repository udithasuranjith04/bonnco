"""The decision-semantics layer: turns a SymbolState (Phase 2's real, already-computed signal +
indicators + patterns + sentiment + funding + freshness) into a structured, auditable decision —
directional bias, signal strength, confidence decomposition, trade quality, risk quality,
portfolio compatibility, and a decision-lifecycle state with an explicit, reasoned transition.

Nothing here fetches new data. Every field is either read directly from the already-computed
SymbolState, or is a genuine interpretation of it (e.g. "does MACD agree with EMA structure",
"is the reward/risk to the nearest resistance acceptable given the stop"). Where the evidence to
judge something doesn't exist yet (order flow on futures, market regime), that's marked
"unavailable", never guessed at or defaulted to neutral.
"""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.decision_state import DecisionStateRecord
from app.models.trade_journal import TradeJournalEntry
from app.schemas.current_state import HistoricalSimilarityOut, SymbolState
from app.schemas.decision import (
    ConfidenceBreakdown,
    ConfidenceComponent,
    DataQualitySummary,
    DecisionOut,
    TimeframeAlignmentOut,
)
from app.services import current_state
from app.services.exchange.base import TIMEFRAMES
from app.services.indicators import InsufficientDataError
from app.services.signal_engine import STOP_LOSS_PCT, generate_signal, get_risk_profile

# Full reason-code taxonomy. Only a subset is actually emitted today (see the derivation functions
# below) — the rest are reserved for later phases (market regime, OI, multi-timeframe hierarchy,
# volatility/liquidity classification) once the real evidence to justify them exists. Defining them
# here now, unused, would mean fabricating codes with no backing data — the opposite of the point.
REASON_CODES_ACTIVE = frozenset({
    "TREND_ALIGNED", "TREND_CONFLICT",
    "MOMENTUM_CONFIRMATION", "MOMENTUM_WEAKENING",
    "ORDER_FLOW_CONFIRMED", "ORDER_FLOW_CONFLICT",
    "NEWS_SUPPORTIVE", "NEWS_CONFLICT",
    "POOR_REWARD_RISK", "ENTRY_EXTENDED",
    "PORTFOLIO_OVEREXPOSED",
    "DATA_STALE", "DATA_MISSING",
    "TIMEFRAME_CONFLICT",
    "HISTORICAL_SUPPORT", "HISTORICAL_CONTRADICTION",
    "THESIS_INVALIDATED",
    "LIQUIDATION_TOO_CLOSE",  # not in the original suggested list — added, same naming pattern
    "HIGH_VOLATILITY",
})
REASON_CODES_RESERVED = frozenset({
    "BREAKOUT_CONFIRMED", "BREAKOUT_FAILED", "SUPPORT_HOLDING", "SUPPORT_LOST",
    "FUNDING_SUPPORTIVE", "FUNDING_RISK", "OI_SUPPORTIVE", "OI_RISK", "LOW_LIQUIDITY",
})


def _bias_from_signal(signal_value: str) -> str:
    if signal_value in ("BUY", "STRONG_BUY"):
        return "bullish"
    if signal_value in ("SELL", "STRONG_SELL"):
        return "bearish"
    return "neutral"


def _signal_strength(signal_value: str) -> str:
    if signal_value in ("STRONG_BUY", "STRONG_SELL"):
        return "high"
    if signal_value in ("BUY", "SELL"):
        return "moderate"
    return "low"


def _technical_alignment(snapshot: dict | None, bias: str) -> ConfidenceComponent:
    """Trend (EMA) and momentum (MACD) agreement — deliberately excludes RSI from the directional
    vote. RSI overbought/oversold is about extension, not direction (RSI 65 in a real uptrend isn't
    automatically bearish) — folding it in here would reproduce exactly the false-equivalence this
    project has already been warned against."""
    if not snapshot:
        return ConfidenceComponent(status="unavailable", rating=None, detail="No indicator snapshot available.")
    if bias == "neutral":
        return ConfidenceComponent(status="available", rating="moderate", detail="No directional bias to check alignment against.")

    macd_interp = snapshot.get("macd", {}).get("interpretation", "") or ""
    ema_interp = snapshot.get("ema", {}).get("interpretation", "") or ""
    votes_for = votes_against = 0
    if "bullish" in macd_interp:
        votes_for += bias == "bullish"
        votes_against += bias == "bearish"
    if "bearish" in macd_interp:
        votes_for += bias == "bearish"
        votes_against += bias == "bullish"
    if "uptrend" in ema_interp:
        votes_for += bias == "bullish"
        votes_against += bias == "bearish"
    if "downtrend" in ema_interp:
        votes_for += bias == "bearish"
        votes_against += bias == "bullish"

    if votes_for and votes_against:
        rating = "conflicting"
    elif votes_for >= 2:
        rating = "strong"
    elif votes_for == 1:
        rating = "moderate"
    else:
        rating = "weak"
    return ConfidenceComponent(status="available", rating=rating, detail=f"MACD: {macd_interp or 'n/a'}; EMA structure: {ema_interp or 'n/a'}.")


def _order_flow_confirmation(order_flow: dict | None, bias: str) -> ConfidenceComponent:
    if order_flow is None:
        return ConfidenceComponent(
            status="unavailable", rating=None,
            detail="No real-time trade-flow data tracked for this symbol yet (spot-only; requires the delta listener to have run for a while).",
        )
    interp = order_flow.get("interpretation")
    label = order_flow.get("label", interp or "n/a")
    if bias == "neutral" or interp == "balanced" or interp is None:
        return ConfidenceComponent(status="available", rating="moderate", detail=label)
    agrees = (bias == "bullish" and interp == "net buying pressure") or (bias == "bearish" and interp == "net selling pressure")
    return ConfidenceComponent(status="available", rating="strong" if agrees else "conflicting", detail=label)


def _news_alignment(sentiment: dict | None, bias: str) -> ConfidenceComponent:
    if not sentiment or sentiment.get("headline_count", 0) == 0:
        return ConfidenceComponent(status="unavailable", rating=None, detail="No recent coin-specific news headlines available.")
    avg = sentiment.get("avg_score", 0.0)
    count = sentiment.get("headline_count", 0)
    if bias == "neutral":
        return ConfidenceComponent(status="available", rating="moderate", detail=f"News sentiment average score {avg} across {count} headline(s).")
    agrees = (bias == "bullish" and avg > 0.15) or (bias == "bearish" and avg < -0.15)
    conflicts = (bias == "bullish" and avg < -0.15) or (bias == "bearish" and avg > 0.15)
    rating = "strong" if agrees else "conflicting" if conflicts else "weak"
    return ConfidenceComponent(status="available", rating=rating, detail=f"News sentiment average score {avg} across {count} headline(s).")


def _historical_support(historical: HistoricalSimilarityOut | None, bias: str) -> ConfidenceComponent:
    if historical is None:
        return ConfidenceComponent(status="unavailable", rating=None, detail="No sufficiently close historical parallel found for the current setup.")
    if bias == "neutral":
        return ConfidenceComponent(status="available", rating="moderate", detail="No directional bias to compare the historical parallel against.")
    agrees = (bias == "bullish" and historical.forward_return_pct > 0) or (bias == "bearish" and historical.forward_return_pct < 0)
    return ConfidenceComponent(
        status="available",
        rating="strong" if agrees else "conflicting",
        detail=f"Closest historical parallel moved {historical.forward_return_pct:+.1f}% over the following {historical.forward_horizon_days} day(s).",
    )


def _data_quality_component(symbol_state: SymbolState) -> ConfidenceComponent:
    issues = []
    if symbol_state.candle_freshness.stale:
        issues.append("candle data stale")
    if symbol_state.signal_freshness.connection_state == "unavailable":
        issues.append("signal unavailable")
    if symbol_state.funding_freshness and symbol_state.funding_freshness.connection_state == "unavailable":
        issues.append("funding unavailable")
    if issues:
        return ConfidenceComponent(status="available", rating="weak", detail="; ".join(issues))
    return ConfidenceComponent(status="available", rating="strong", detail="All underlying data sources fresh and connected.")


def _data_quality_summary(symbol_state: SymbolState) -> DataQualitySummary:
    stale, missing = [], []
    sources = [("signal", symbol_state.signal_freshness), ("candles", symbol_state.candle_freshness), ("funding", symbol_state.funding_freshness)]
    for name, freshness in sources:
        if freshness is None:
            continue
        if freshness.connection_state == "unavailable":
            missing.append(name)
        elif freshness.stale or freshness.connection_state == "degraded":
            stale.append(name)
    if "signal" in missing or "candles" in missing:
        overall = "critical"
    elif missing or stale:
        overall = "degraded"
    else:
        overall = "healthy"
    return DataQualitySummary(overall=overall, stale_sources=stale, missing_sources=missing, degraded_mode=overall != "healthy")


def _timeframe_alignment(db: Session, symbol: str, market_type: str, timeframe: str, requested_bias: str) -> TimeframeAlignmentOut:
    """Checks the immediate neighboring timeframes only (not the full ladder) — real data, reusing
    generate_signal's own cache, deliberately scoped short of the full multi-timeframe hierarchy
    engine (roles, trigger/invalidation timeframe) that's planned for a later phase."""
    idx = TIMEFRAMES.index(timeframe)
    lower_tf = TIMEFRAMES[idx - 1] if idx > 0 else None
    higher_tf = TIMEFRAMES[idx + 1] if idx < len(TIMEFRAMES) - 1 else None

    def _bias_for(tf: str | None) -> str | None:
        if tf is None:
            return None
        try:
            return _bias_from_signal(generate_signal(db, symbol, market_type, tf).signal)
        except InsufficientDataError:
            return None

    lower_bias = _bias_for(lower_tf)
    higher_bias = _bias_for(higher_tf)

    present = [b for b in (lower_bias, requested_bias, higher_bias) if b is not None]
    non_neutral = [b for b in present if b != "neutral"]
    distinct = set(non_neutral)

    if len(distinct) >= 2:
        alignment = "conflicting"
    elif len(present) < 2:
        alignment = "not_applicable"
    elif len(non_neutral) == len(present) and len(distinct) == 1:
        alignment = "aligned"
    else:
        alignment = "partial"

    return TimeframeAlignmentOut(
        requested_timeframe=timeframe, requested_bias=requested_bias,
        higher_timeframe=higher_tf, higher_bias=higher_bias,
        lower_timeframe=lower_tf, lower_bias=lower_bias,
        alignment=alignment,
    )


def _trade_quality(symbol_state: SymbolState, bias: str) -> tuple[str, list[str]]:
    """Is this actually a good entry right now — not "is the direction right", but "is the price
    already extended and is the reward-to-risk to the nearest real level acceptable"."""
    if bias == "neutral" or symbol_state.entry_price is None or symbol_state.stop_loss is None:
        return "not_applicable", []

    snapshot = symbol_state.indicator_snapshot or {}
    sr = snapshot.get("support_resistance", {}).get("value", {})
    bb = snapshot.get("bollinger", {}).get("value", {})
    percent_b = bb.get("percent_b")
    entry = symbol_state.entry_price
    risk = abs(entry - symbol_state.stop_loss)

    target = sr.get("nearest_resistance") if bias == "bullish" else sr.get("nearest_support")
    extended = (percent_b is not None) and ((bias == "bullish" and percent_b > 0.95) or (bias == "bearish" and percent_b < 0.05))

    reasons = []
    if extended:
        reasons.append("ENTRY_EXTENDED")

    if target is None or risk <= 0:
        # Can't compute a real reward/risk figure — don't overclaim either "good" or "poor".
        return ("poor" if extended else "moderate"), reasons

    reward = abs(target - entry)
    rr = reward / risk
    if rr < 1.0:
        reasons.append("POOR_REWARD_RISK")

    if extended or rr < 1.0:
        return "poor", reasons
    if rr < 1.5:
        return "moderate", reasons
    return "good", reasons


def _risk_quality(symbol_state: SymbolState, risk_profile: str, bias: str) -> tuple[str, list[str]]:
    if bias == "neutral" or symbol_state.entry_price is None or symbol_state.stop_loss is None:
        return "not_applicable", []

    entry = symbol_state.entry_price
    stop_pct = abs(entry - symbol_state.stop_loss) / entry * 100
    expected_pct = STOP_LOSS_PCT[risk_profile] * 100

    if symbol_state.market_type == "futures" and symbol_state.liquidation_estimate:
        liq_pct = abs(entry - symbol_state.liquidation_estimate) / entry * 100
        if liq_pct <= stop_pct * 1.5:
            return "unacceptable", ["LIQUIDATION_TOO_CLOSE"]

    if stop_pct > expected_pct * 2.5:
        return "marginal", ["HIGH_VOLATILITY"]
    return "acceptable", []


def _open_position_for(db: Session, symbol: str, market_type: str) -> TradeJournalEntry | None:
    return db.scalars(
        select(TradeJournalEntry)
        .where(TradeJournalEntry.symbol == symbol, TradeJournalEntry.market_type == market_type, TradeJournalEntry.exit_price.is_(None))
        .order_by(TradeJournalEntry.opened_at.desc())
        .limit(1)
    ).first()


def _portfolio_compatibility(db: Session, symbol: str, bias: str) -> tuple[str, list[str]]:
    if bias == "neutral":
        return "not_applicable", []
    open_trades = db.scalars(select(TradeJournalEntry).where(TradeJournalEntry.exit_price.is_(None))).all()
    others = [t for t in open_trades if t.symbol != symbol]
    wanted_side = "long" if bias == "bullish" else "short"
    same_direction = [t for t in others if t.side == wanted_side]
    if len(same_direction) >= 2:
        return "incompatible", ["PORTFOLIO_OVEREXPOSED"]
    if len(same_direction) == 1:
        return "marginal", []
    return "compatible", []


def _derive_state(
    bias: str, signal_strength: str, trade_quality: str, risk_quality: str, portfolio_compat: str,
    tf_alignment: TimeframeAlignmentOut, data_quality: DataQualitySummary,
    has_open_position: bool, position_side: str | None,
    tq_reasons: list[str], rq_reasons: list[str],
) -> tuple[str, list[str], str]:
    # Data-quality gate comes first, regardless of everything else — a decision built on missing
    # or stale data must say so, not quietly proceed as if the inputs were healthy.
    if data_quality.overall == "critical":
        reasons = ["DATA_MISSING"] if data_quality.missing_sources else ["DATA_STALE"]
        if has_open_position:
            return "HOLD_POSITION", reasons, "Data quality issue detected — holding the existing position without a fresh directional read until data recovers, rather than acting on stale/missing information."
        return "NO_TRADE", reasons, "Underlying market data is missing or stale, so no new decision can be made with confidence."

    if has_open_position:
        thesis_intact = (position_side == "long" and bias in ("bullish", "neutral")) or (position_side == "short" and bias in ("bearish", "neutral"))
        if bias == "conflicting":
            reasons = ["TIMEFRAME_CONFLICT"] if tf_alignment.alignment == "conflicting" else ["TREND_CONFLICT"]
            if not thesis_intact:
                reasons.append("THESIS_INVALIDATED")
                return "EXIT", reasons, "The evidence has turned genuinely mixed/conflicting against the position's original direction — the thesis no longer holds cleanly."
            return "HOLD_POSITION", reasons, "Evidence is mixed, but not yet clearly against the position's direction — holding while it resolves."
        if not thesis_intact:
            return "EXIT", ["THESIS_INVALIDATED"], "The directional evidence has flipped against this position's original thesis."
        if risk_quality == "unacceptable":
            return "REDUCE_POSITION", rq_reasons, "The directional thesis is still intact, but risk geometry (stop/liquidation distance) has deteriorated — reduce exposure rather than exit outright."
        return "HOLD_POSITION", (["TREND_ALIGNED"] if bias != "neutral" else ["MOMENTUM_WEAKENING"]), "The original thesis remains valid based on current evidence — no action needed."

    # No open position.
    if bias == "neutral":
        return "NO_TRADE", ["TREND_CONFLICT"], "No clear directional edge right now — technical and momentum evidence don't favor either side."

    if bias == "conflicting":
        reasons = ["TIMEFRAME_CONFLICT"] if tf_alignment.alignment == "conflicting" else ["MOMENTUM_WEAKENING"]
        return "WATCH", reasons, "The underlying evidence is genuinely mixed on this timeframe — worth watching, not yet a basis for a trade either way."

    if tf_alignment.alignment == "conflicting":
        return "WATCH", ["TIMEFRAME_CONFLICT"], f"{bias.capitalize()} bias on {tf_alignment.requested_timeframe}, but neighboring timeframes disagree — waiting for alignment before treating this as actionable."

    if trade_quality == "poor":
        return "NO_TRADE", tq_reasons or ["POOR_REWARD_RISK"], "Directional bias is real, but the entry itself is poor right now (extended price and/or weak reward-to-risk) — not worth taking as-is."

    if portfolio_compat == "incompatible":
        return "NO_TRADE", ["PORTFOLIO_OVEREXPOSED"], "The setup looks attractive on its own, but existing portfolio exposure in the same direction makes an additional position unwise right now."

    if risk_quality == "unacceptable":
        return "NO_TRADE", rq_reasons, "The stop/liquidation geometry for this setup doesn't leave acceptable room — the risk isn't survivable as currently sized."

    if signal_strength == "high" and trade_quality == "good" and risk_quality == "acceptable":
        reasons = ["TREND_ALIGNED"]
        if portfolio_compat == "marginal":
            reasons.append("PORTFOLIO_OVEREXPOSED")
        return "ARMED", reasons, "Directional bias, entry quality, and risk geometry are all aligned — this is close to actionable, watch for final confirmation."

    return "WATCH", ["MOMENTUM_CONFIRMATION"], "A developing setup with real directional evidence, but not yet strong enough across quality and risk checks to act on."


def build_decision(db: Session, symbol: str, market_type: str, timeframe: str) -> DecisionOut:
    symbol = symbol.upper()
    symbol_state = current_state.build_symbol_state(db, symbol, market_type, timeframe)
    risk_profile = get_risk_profile(db)

    open_trade = _open_position_for(db, symbol, market_type)
    has_open_position = open_trade is not None
    position_side = open_trade.side if open_trade else None

    if symbol_state.signal is None:
        # Insufficient candle history — degrade transparently, never fabricate a decision.
        data_quality = DataQualitySummary(overall="critical", stale_sources=[], missing_sources=["signal", "candles"], degraded_mode=True)
        confidence = ConfidenceBreakdown(
            overall=0.0,
            technical_alignment=ConfidenceComponent(status="unavailable", rating=None, detail="No signal computed — insufficient candle history."),
            timeframe_alignment=ConfidenceComponent(status="unavailable", rating=None, detail="No signal computed."),
            order_flow_confirmation=ConfidenceComponent(status="unavailable", rating=None, detail="No signal computed."),
            news_alignment=ConfidenceComponent(status="unavailable", rating=None, detail="No signal computed."),
            historical_support=ConfidenceComponent(status="unavailable", rating=None, detail="No signal computed."),
            data_quality=ConfidenceComponent(status="available", rating="weak", detail="Insufficient candle history for this symbol/timeframe."),
            market_regime=ConfidenceComponent(status="unavailable", rating=None, detail="Market regime classification is planned for Phase 4; not yet built."),
        )
        tf_alignment = TimeframeAlignmentOut(
            requested_timeframe=timeframe, requested_bias="neutral",
            higher_timeframe=None, higher_bias=None, lower_timeframe=None, lower_bias=None, alignment="not_applicable",
        )
        state = "HOLD_POSITION" if has_open_position else "NO_TRADE"
        return DecisionOut(
            symbol=symbol, market_type=market_type, timeframe=timeframe, generated_at=datetime.utcnow(),
            directional_bias="neutral", signal_strength="not_applicable", confidence=confidence,
            trade_quality="not_applicable", risk_quality="not_applicable", portfolio_compatibility="not_applicable",
            state=state, previous_state=None, state_changed=False,
            has_open_position=has_open_position, position_side=position_side,
            reason_codes=["DATA_MISSING"], reason_text=str(symbol_state.signal_freshness.note or "No signal data available."),
            market_regime="UNKNOWN", timeframe_alignment=tf_alignment, data_quality=data_quality,
            decision_snapshot_id=None,
        )

    raw_bias = _bias_from_signal(symbol_state.signal)
    tech_component = _technical_alignment(symbol_state.indicator_snapshot, raw_bias)
    bias = "conflicting" if tech_component.rating == "conflicting" else raw_bias

    tf_alignment = _timeframe_alignment(db, symbol, market_type, timeframe, bias)
    of_component = _order_flow_confirmation(symbol_state.order_flow, bias)
    news_component = _news_alignment(symbol_state.sentiment_snapshot, bias)
    hist_component = _historical_support(symbol_state.historical_similarity, bias)
    dq_component = _data_quality_component(symbol_state)

    tf_rating_map = {"aligned": "strong", "partial": "moderate", "conflicting": "conflicting", "not_applicable": "moderate"}
    confidence = ConfidenceBreakdown(
        overall=symbol_state.confidence,
        technical_alignment=tech_component,
        timeframe_alignment=ConfidenceComponent(
            status="available", rating=tf_rating_map[tf_alignment.alignment],
            detail=f"{tf_alignment.alignment} — {tf_alignment.lower_timeframe or '?'}: {tf_alignment.lower_bias or 'n/a'}, "
                   f"{tf_alignment.requested_timeframe}: {tf_alignment.requested_bias}, {tf_alignment.higher_timeframe or '?'}: {tf_alignment.higher_bias or 'n/a'}.",
        ),
        order_flow_confirmation=of_component,
        news_alignment=news_component,
        historical_support=hist_component,
        data_quality=dq_component,
        market_regime=ConfidenceComponent(status="unavailable", rating=None, detail="Market regime classification is planned for Phase 4; not yet built."),
    )

    signal_strength = _signal_strength(symbol_state.signal)
    trade_quality, tq_reasons = _trade_quality(symbol_state, bias)
    risk_quality, rq_reasons = _risk_quality(symbol_state, risk_profile, bias)
    portfolio_compat, pc_reasons = ("not_applicable", []) if has_open_position else _portfolio_compatibility(db, symbol, bias)
    data_quality = _data_quality_summary(symbol_state)

    state, reason_codes, reason_text = _derive_state(
        bias, signal_strength, trade_quality, risk_quality, portfolio_compat,
        tf_alignment, data_quality, has_open_position, position_side, tq_reasons, rq_reasons,
    )

    previous = db.scalars(
        select(DecisionStateRecord)
        .where(DecisionStateRecord.symbol == symbol, DecisionStateRecord.market_type == market_type, DecisionStateRecord.timeframe == timeframe)
        .order_by(DecisionStateRecord.created_at.desc())
        .limit(1)
    ).first()
    previous_state = previous.state if previous else None
    state_changed = previous_state != state

    # Only a genuine transition (or the very first computation) is persisted as history — this is
    # the hysteresis mechanism: state is derived from bucketed categorical evidence (bias/quality
    # ratings), not a raw wobbling float, so a small confidence tick doesn't cross a bucket boundary
    # and therefore doesn't produce a new logged transition. A real structural change (a reason-code
    # set that's actually different) does cross a boundary and is logged immediately.
    if state_changed or previous is None:
        record = DecisionStateRecord(
            symbol=symbol, market_type=market_type, timeframe=timeframe,
            state=state, previous_state=previous_state,
            directional_bias=bias, signal_strength=signal_strength, overall_confidence=symbol_state.confidence,
            trade_quality=trade_quality, risk_quality=risk_quality, portfolio_compatibility=portfolio_compat,
            reason_codes=reason_codes, reason_text=reason_text,
            decision_snapshot=confidence.model_dump(mode="json"),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        snapshot_id = record.id
    else:
        snapshot_id = previous.id

    return DecisionOut(
        symbol=symbol, market_type=market_type, timeframe=timeframe, generated_at=datetime.utcnow(),
        directional_bias=bias, signal_strength=signal_strength, confidence=confidence,
        trade_quality=trade_quality, risk_quality=risk_quality, portfolio_compatibility=portfolio_compat,
        state=state, previous_state=previous_state, state_changed=state_changed,
        has_open_position=has_open_position, position_side=position_side,
        reason_codes=reason_codes, reason_text=reason_text,
        market_regime="UNKNOWN", timeframe_alignment=tf_alignment, data_quality=data_quality,
        decision_snapshot_id=snapshot_id,
    )
