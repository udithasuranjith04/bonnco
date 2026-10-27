"""Tests for the Phase 3 decision-semantics layer. Two styles, deliberately mixed:

- Direct unit tests against the pure derivation functions (_derive_state, _trade_quality,
  _risk_quality, _portfolio_compatibility) with deliberately constructed inputs — this is the only
  practical way to exercise every branch (extended entry, poor reward/risk, overexposure, timeframe
  conflict) without waiting for real market conditions to naturally match each one.
- Integration tests against build_decision() with real, live data for the cases that don't need a
  specific contrived scenario (determinism, goal context, open-position lifecycle).
"""

from datetime import datetime

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.models.trade_journal import TradeJournalEntry
from app.schemas.current_state import DataFreshness, HistoricalSimilarityOut, SymbolState
from app.schemas.decision import DataQualitySummary, TimeframeAlignmentOut
from app.services import decision_engine as de
from app.services.chat_context import build_page_context, build_user_context
from app.services.decision_engine import build_decision

REAL_SYMBOL = "BTCUSDT"


def _fresh() -> DataFreshness:
    return DataFreshness(provider="test", fetched_at=datetime.utcnow(), age_seconds=0.0, connection_state="connected", stale=False, fallback_used=False)


def _symbol_state(**overrides) -> SymbolState:
    base = dict(
        symbol=REAL_SYMBOL, market_type="futures", timeframe="1h",
        signal="BUY", confidence=70.0, entry_price=100.0, stop_loss=97.0,
        suggested_leverage_min=2.0, suggested_leverage_max=4.0, liquidation_estimate=75.0,
        indicator_snapshot={
            "macd": {"interpretation": "bullish momentum"},
            "ema": {"interpretation": "established uptrend"},
            "support_resistance": {"value": {"nearest_resistance": 106.0, "nearest_support": 95.0}},
            "bollinger": {"value": {"percent_b": 0.6}},
        },
        pattern_summary=None, pattern_bias=None, pattern_confirmed=None,
        sentiment_snapshot={"headline_count": 0, "avg_score": 0.0},
        order_flow=None, historical_similarity=None, funding=None,
        signal_freshness=_fresh(), candle_freshness=_fresh(), funding_freshness=None,
    )
    base.update(overrides)
    return SymbolState(**base)


DQ_HEALTHY = DataQualitySummary(overall="healthy", stale_sources=[], missing_sources=[], degraded_mode=False)
TF_ALIGNED = TimeframeAlignmentOut(requested_timeframe="1h", requested_bias="bullish", higher_timeframe="4h", higher_bias="bullish", lower_timeframe="15m", lower_bias="bullish", alignment="aligned")
TF_CONFLICTING = TimeframeAlignmentOut(requested_timeframe="1h", requested_bias="bullish", higher_timeframe="4h", higher_bias="bearish", lower_timeframe="15m", lower_bias="bearish", alignment="conflicting")


# ---------------------------------------------------------------------------
# 1. No position + bullish direction -> NO_TRADE unless real entry conditions are met
# ---------------------------------------------------------------------------
def test_1_bullish_direction_without_good_entry_is_no_trade():
    state, codes, _ = de._derive_state(
        bias="bullish", signal_strength="moderate", trade_quality="poor", risk_quality="acceptable",
        portfolio_compat="compatible", tf_alignment=TF_ALIGNED, data_quality=DQ_HEALTHY,
        has_open_position=False, position_side=None, tq_reasons=["POOR_REWARD_RISK"], rq_reasons=[],
    )
    assert state == "NO_TRADE"
    assert "POOR_REWARD_RISK" in codes


def test_1_bullish_direction_with_good_entry_and_high_strength_is_armed():
    state, codes, _ = de._derive_state(
        bias="bullish", signal_strength="high", trade_quality="good", risk_quality="acceptable",
        portfolio_compat="compatible", tf_alignment=TF_ALIGNED, data_quality=DQ_HEALTHY,
        has_open_position=False, position_side=None, tq_reasons=[], rq_reasons=[],
    )
    assert state == "ARMED"
    assert "TREND_ALIGNED" in codes


# ---------------------------------------------------------------------------
# 2 & 3. Open long/short + valid thesis -> HOLD_POSITION
# ---------------------------------------------------------------------------
def test_2_open_long_with_intact_thesis_holds():
    state, codes, text = de._derive_state(
        bias="bullish", signal_strength="moderate", trade_quality="not_applicable", risk_quality="acceptable",
        portfolio_compat="not_applicable", tf_alignment=TF_ALIGNED, data_quality=DQ_HEALTHY,
        has_open_position=True, position_side="long", tq_reasons=[], rq_reasons=[],
    )
    assert state == "HOLD_POSITION"
    assert "invalid" not in text.lower()


def test_3_open_short_with_intact_thesis_holds():
    state, codes, _ = de._derive_state(
        bias="bearish", signal_strength="moderate", trade_quality="not_applicable", risk_quality="acceptable",
        portfolio_compat="not_applicable", tf_alignment=TF_ALIGNED, data_quality=DQ_HEALTHY,
        has_open_position=True, position_side="short", tq_reasons=[], rq_reasons=[],
    )
    assert state == "HOLD_POSITION"


def test_open_long_with_flipped_bias_exits():
    """Thesis invalidation: an open long where the evidence has flipped bearish must EXIT, not
    HOLD_POSITION — this is the exact "thesis no longer holds" case from the spec."""
    state, codes, _ = de._derive_state(
        bias="bearish", signal_strength="moderate", trade_quality="not_applicable", risk_quality="acceptable",
        portfolio_compat="not_applicable", tf_alignment=TF_ALIGNED, data_quality=DQ_HEALTHY,
        has_open_position=True, position_side="long", tq_reasons=[], rq_reasons=[],
    )
    assert state == "EXIT"
    assert "THESIS_INVALIDATED" in codes


# ---------------------------------------------------------------------------
# 4. Entry extended -> NO_TRADE / WAIT
# ---------------------------------------------------------------------------
def test_4_extended_entry_is_poor_trade_quality():
    state = _symbol_state(signal="BUY", entry_price=100.0, stop_loss=97.0, indicator_snapshot={
        "macd": {"interpretation": "bullish momentum"}, "ema": {"interpretation": "established uptrend"},
        "support_resistance": {"value": {"nearest_resistance": 106.0, "nearest_support": 95.0}},
        "bollinger": {"value": {"percent_b": 0.98}},  # extended
    })
    quality, reasons = de._trade_quality(state, "bullish")
    assert quality == "poor"
    assert "ENTRY_EXTENDED" in reasons


# ---------------------------------------------------------------------------
# 5. Strong direction but poor reward/risk -> NO_TRADE
# ---------------------------------------------------------------------------
def test_5_poor_reward_risk_overrides_strong_signal():
    """The mandatory example from the spec: bullish + high strength + high confidence, but the
    reward to the nearest resistance is smaller than the risk to the stop -> still NO_TRADE."""
    state = _symbol_state(signal="STRONG_BUY", confidence=88.0, entry_price=100.0, stop_loss=95.0, indicator_snapshot={
        "macd": {"interpretation": "bullish momentum"}, "ema": {"interpretation": "established uptrend"},
        "support_resistance": {"value": {"nearest_resistance": 102.0, "nearest_support": 90.0}},  # reward 2, risk 5
        "bollinger": {"value": {"percent_b": 0.6}},
    })
    trade_quality, tq_reasons = de._trade_quality(state, "bullish")
    assert trade_quality == "poor"
    assert "POOR_REWARD_RISK" in tq_reasons

    decision_state, codes, _ = de._derive_state(
        bias="bullish", signal_strength="high", trade_quality=trade_quality, risk_quality="acceptable",
        portfolio_compat="compatible", tf_alignment=TF_ALIGNED, data_quality=DQ_HEALTHY,
        has_open_position=False, position_side=None, tq_reasons=tq_reasons, rq_reasons=[],
    )
    assert decision_state == "NO_TRADE"


# ---------------------------------------------------------------------------
# 6. Portfolio overexposure -> NO_TRADE
# ---------------------------------------------------------------------------
def test_6_portfolio_overexposure_forces_no_trade(db):
    """Real DB check: two other open long positions -> a new bullish setup is incompatible."""
    setup_db = SessionLocal()
    try:
        setup_db.add(TradeJournalEntry(symbol="TESTCOINAUSDT", market_type="futures", side="long", entry_price=1.0, source="manual"))
        setup_db.add(TradeJournalEntry(symbol="TESTCOINBUSDT", market_type="futures", side="long", entry_price=1.0, source="manual"))
        setup_db.commit()
    finally:
        setup_db.close()

    try:
        compat, reasons = de._portfolio_compatibility(db, "TESTCOINCUSDT", "bullish")
        assert compat == "incompatible"
        assert "PORTFOLIO_OVEREXPOSED" in reasons

        state, codes, _ = de._derive_state(
            bias="bullish", signal_strength="high", trade_quality="good", risk_quality="acceptable",
            portfolio_compat=compat, tf_alignment=TF_ALIGNED, data_quality=DQ_HEALTHY,
            has_open_position=False, position_side=None, tq_reasons=[], rq_reasons=reasons,
        )
        assert state == "NO_TRADE"
        assert "PORTFOLIO_OVEREXPOSED" in codes
    finally:
        cleanup_db = SessionLocal()
        cleanup_db.execute(delete(TradeJournalEntry).where(TradeJournalEntry.symbol.in_(["TESTCOINAUSDT", "TESTCOINBUSDT"])))
        cleanup_db.commit()
        cleanup_db.close()


# ---------------------------------------------------------------------------
# 7. Data stale -> degraded/blocked decision
# ---------------------------------------------------------------------------
def test_7_stale_data_blocks_new_trade_decision():
    dq = DataQualitySummary(overall="critical", stale_sources=["candles"], missing_sources=[], degraded_mode=True)
    state, codes, text = de._derive_state(
        bias="bullish", signal_strength="high", trade_quality="good", risk_quality="acceptable",
        portfolio_compat="compatible", tf_alignment=TF_ALIGNED, data_quality=dq,
        has_open_position=False, position_side=None, tq_reasons=[], rq_reasons=[],
    )
    assert state == "NO_TRADE"
    assert "DATA_STALE" in codes


def test_7_stale_data_with_open_position_holds_rather_than_acts():
    dq = DataQualitySummary(overall="critical", stale_sources=["candles"], missing_sources=[], degraded_mode=True)
    state, codes, _ = de._derive_state(
        bias="bearish", signal_strength="low", trade_quality="not_applicable", risk_quality="not_applicable",
        portfolio_compat="not_applicable", tf_alignment=TF_ALIGNED, data_quality=dq,
        has_open_position=True, position_side="long", tq_reasons=[], rq_reasons=[],
    )
    assert state == "HOLD_POSITION"
    assert "DATA_STALE" in codes


# ---------------------------------------------------------------------------
# 8. Missing order-flow data -> unavailable, never bearish/neutral-as-fact
# ---------------------------------------------------------------------------
def test_8_missing_order_flow_is_unavailable_not_a_fabricated_reading():
    component = de._order_flow_confirmation(None, "bullish")
    assert component.status == "unavailable"
    assert component.rating is None


# ---------------------------------------------------------------------------
# 9. Timeframe conflict -> correct conflict state
# ---------------------------------------------------------------------------
def test_9_timeframe_conflict_produces_watch_not_a_forced_direction():
    state, codes, _ = de._derive_state(
        bias="bullish", signal_strength="moderate", trade_quality="good", risk_quality="acceptable",
        portfolio_compat="compatible", tf_alignment=TF_CONFLICTING, data_quality=DQ_HEALTHY,
        has_open_position=False, position_side=None, tq_reasons=[], rq_reasons=[],
    )
    assert state == "WATCH"
    assert "TIMEFRAME_CONFLICT" in codes


# ---------------------------------------------------------------------------
# 10 & 11. Hysteresis: meaningful change moves state immediately, noise does not
# ---------------------------------------------------------------------------
def test_10_a_real_bucket_change_moves_state_immediately():
    args = dict(bias="bullish", signal_strength="high", portfolio_compat="compatible", tf_alignment=TF_ALIGNED, data_quality=DQ_HEALTHY, has_open_position=False, position_side=None, tq_reasons=[], rq_reasons=[])
    before, _, _ = de._derive_state(trade_quality="good", risk_quality="acceptable", **args)
    after, codes, _ = de._derive_state(trade_quality="poor", risk_quality="acceptable", **{**args, "tq_reasons": ["POOR_REWARD_RISK"]})
    assert before == "ARMED"
    assert after == "NO_TRADE"
    assert before != after


def test_11_identical_categorical_inputs_never_flip_state():
    args = dict(bias="bullish", signal_strength="moderate", trade_quality="moderate", risk_quality="acceptable", portfolio_compat="compatible", tf_alignment=TF_ALIGNED, data_quality=DQ_HEALTHY, has_open_position=False, position_side=None, tq_reasons=[], rq_reasons=[])
    results = [de._derive_state(**args)[0] for _ in range(5)]
    assert len(set(results)) == 1


# ---------------------------------------------------------------------------
# 12 & 13. Determinism against real, live data
# ---------------------------------------------------------------------------
def test_12_13_repeated_real_decision_calls_are_deterministic(db):
    first = build_decision(db, REAL_SYMBOL, "futures", "1h")
    second = build_decision(db, REAL_SYMBOL, "futures", "1h")
    assert first.state == second.state
    assert first.reason_codes == second.reason_codes
    assert first.directional_bias == second.directional_bias
    assert second.state_changed is False


# ---------------------------------------------------------------------------
# 14. Position appears/disappears -> decision semantics update correctly
# ---------------------------------------------------------------------------
def test_14_decision_updates_when_a_position_appears_and_disappears(db):
    no_position = build_decision(db, REAL_SYMBOL, "futures", "1h")
    assert no_position.has_open_position is False
    assert no_position.state not in ("HOLD_POSITION", "REDUCE_POSITION", "EXIT")

    setup_db = SessionLocal()
    try:
        setup_db.add(TradeJournalEntry(symbol=REAL_SYMBOL, market_type="futures", side="long", entry_price=1.0, source="manual"))
        setup_db.commit()
    finally:
        setup_db.close()

    # MySQL's default REPEATABLE READ isolation means the `db` fixture's session, once it's opened
    # a transaction (which the first build_decision call above did), won't see a commit made by a
    # different session (setup_db) until its own transaction ends — db.commit() here isn't
    # persisting new writes, it's closing out that stale read snapshot so the next query opens a
    # fresh one that can see the insert above. A real thing to know about this test setup, not
    # papered over.
    db.commit()

    try:
        with_position = build_decision(db, REAL_SYMBOL, "futures", "1h")
        assert with_position.has_open_position is True
        assert with_position.position_side == "long"
        assert with_position.state in ("HOLD_POSITION", "REDUCE_POSITION", "EXIT")
    finally:
        cleanup_db = SessionLocal()
        cleanup_db.execute(delete(TradeJournalEntry).where(TradeJournalEntry.symbol == REAL_SYMBOL, TradeJournalEntry.entry_price == 1.0))
        cleanup_db.commit()
        cleanup_db.close()

    db.commit()  # same reason as above — see the fresh deletion, not a stale snapshot
    without_position_again = build_decision(db, REAL_SYMBOL, "futures", "1h")
    assert without_position_again.has_open_position is False


# ---------------------------------------------------------------------------
# 15 & 16. Chat must use the structured decision, not invent a contradictory one
# ---------------------------------------------------------------------------
def test_15_chat_context_leads_with_the_real_decision_state(db):
    decision = build_decision(db, REAL_SYMBOL, "futures", "1h")
    context = build_user_context(db)  # sanity: doesn't error with decision engine wired in
    assert context is not None
    from app.services.chat_context import build_chat_context
    text = build_chat_context(db, REAL_SYMBOL, "futures", "1h")
    assert f"Current Bonnco decision for {REAL_SYMBOL}" in text
    assert decision.state in text


def test_16_chat_context_references_real_open_position_when_one_exists(db):
    setup_db = SessionLocal()
    try:
        setup_db.add(TradeJournalEntry(symbol=REAL_SYMBOL, market_type="futures", side="long", entry_price=1.0, source="manual"))
        setup_db.commit()
    finally:
        setup_db.close()

    try:
        from app.services.chat_context import build_chat_context
        text = build_chat_context(db, REAL_SYMBOL, "futures", "1h")
        assert "has an open long position" in text
    finally:
        cleanup_db = SessionLocal()
        cleanup_db.execute(delete(TradeJournalEntry).where(TradeJournalEntry.symbol == REAL_SYMBOL, TradeJournalEntry.entry_price == 1.0))
        cleanup_db.commit()
        cleanup_db.close()


# ---------------------------------------------------------------------------
# 17. Goal context still resolves correctly (Phase 2 regression, re-checked here)
# ---------------------------------------------------------------------------
def test_17_goal_context_still_resolves(db):
    context = build_page_context(db, "dashboard")
    assert context is not None
    assert "Goal/milestone tracker" in context
