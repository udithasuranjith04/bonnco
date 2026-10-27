"""A real, role-based multi-timeframe hierarchy — an additive capability the scanner (Phase 4)
consumes. Deliberately separate from Phase 3's `_timeframe_alignment` (which only checks the two
immediate neighbors of whatever single timeframe a decision was requested for) — this checks the
full real timeframe ladder with assigned roles, which the scanner needs to compare candidates
market-wide, but a single on-demand /api/decision call doesn't. Phase 3's own function and the
/api/decision endpoint are untouched.

Only the 5 timeframes this app actually has data for (TIMEFRAMES) are used — 1m/3m/30m were not
invented, since the candle pipeline and exchange adapter don't support them.
"""

from sqlalchemy.orm import Session

from app.schemas.market_brain import TimeframeHierarchyOut
from app.services.decision_engine import _bias_from_signal
from app.services.indicators import InsufficientDataError
from app.services.signal_engine import generate_signal

# Role assignment across the real 5 supported timeframes, matching the example roles in the Phase
# 4 request as closely as the available timeframes allow (no 1m/3m/30m exist in this system).
ROLES = {
    "1d": "macro",
    "4h": "structure",
    "1h": "regime",
    "15m": "setup",
    "5m": "execution",
}


def build_hierarchy(db: Session, symbol: str, market_type: str) -> TimeframeHierarchyOut:
    symbol = symbol.upper()
    biases: dict[str, str | None] = {}
    for tf in ROLES:
        try:
            biases[tf] = _bias_from_signal(generate_signal(db, symbol, market_type, tf).signal)
        except InsufficientDataError:
            biases[tf] = None

    present = [b for b in biases.values() if b is not None]
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

    # Trigger timeframe: the lowest-role (fastest) timeframe with real data — where a real
    # confirmation would actually be watched for. Invalidation timeframe: the highest-role
    # (slowest) timeframe with real data — where a genuine structural break would matter most.
    ordered_by_role = ["execution", "setup", "regime", "structure", "macro"]
    tf_by_role = {role: tf for tf, role in ROLES.items()}
    trigger_tf = next((tf_by_role[r] for r in ordered_by_role if biases.get(tf_by_role[r]) is not None), None)
    invalidation_tf = next((tf_by_role[r] for r in reversed(ordered_by_role) if biases.get(tf_by_role[r]) is not None), None)

    return TimeframeHierarchyOut(
        symbol=symbol, market_type=market_type,
        macro_timeframe="1d", macro_bias=biases.get("1d"),
        structure_timeframe="4h", structure_bias=biases.get("4h"),
        regime_timeframe="1h", regime_bias=biases.get("1h"),
        setup_timeframe="15m", setup_bias=biases.get("15m"),
        execution_timeframe="5m", execution_bias=biases.get("5m"),
        alignment=alignment, trigger_timeframe=trigger_tf, invalidation_timeframe=invalidation_tf,
    )
