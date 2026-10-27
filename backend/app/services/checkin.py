"""Session check-in: one real-data snapshot of "where things actually stand" — real balance vs.
your real goal, today's real P&L, real open positions, and the single highest-confidence signal
currently stored for a coin on your watchlist. Reads the *latest already-generated* signal per
watchlist coin rather than triggering fresh AI generation on every check-in — the same discipline
used by the watchlist strip, so opening the app doesn't fire off a burst of GPT calls.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting
from app.models.signal import Signal
from app.models.watchlist import WatchlistItem
from app.services import current_state as _current_state

DEFAULT_TIMEFRAME = "1h"


def _dashboard_timeframe(db: Session) -> str:
    row = db.get(AppSetting, "dashboard_timeframe")
    return row.value if row else DEFAULT_TIMEFRAME


def _best_watchlist_signal(db: Session) -> Signal | None:
    timeframe = _dashboard_timeframe(db)
    items = db.scalars(select(WatchlistItem).where(WatchlistItem.enabled.is_(True))).all()

    best: Signal | None = None
    for item in items:
        row = db.scalars(
            select(Signal)
            .where(Signal.symbol == item.symbol, Signal.market_type == item.market_type, Signal.timeframe == timeframe)
            .order_by(Signal.created_at.desc())
            .limit(1)
        ).first()
        if row and row.signal != "HOLD" and (best is None or row.confidence > best.confidence):
            best = row
    return best


def get_checkin(db: Session) -> dict:
    # Routes through the same unified aggregator Ask Bonnco's context builder uses (see
    # app/services/current_state.py) — goal and portfolio numbers are computed exactly once, in
    # one place, not re-derived independently here.
    goal_state = _current_state.build_goal_state(db)
    portfolio_state = _current_state.build_portfolio_state(db)
    best_signal = _best_watchlist_signal(db)

    return {
        "goal": goal_state.model_dump(exclude={"freshness"}),
        "total_value_usd": portfolio_state.total_value_usd,
        "today_pnl_usd": portfolio_state.today_pnl_usd,
        "today_pnl_pct": portfolio_state.today_pnl_pct,
        "open_positions": portfolio_state.open_positions,
        "best_watchlist_signal": (
            {
                "symbol": best_signal.symbol,
                "market_type": best_signal.market_type,
                "timeframe": best_signal.timeframe,
                "signal": best_signal.signal,
                "confidence": best_signal.confidence,
                "reasoning": best_signal.reasoning,
                "created_at": best_signal.created_at,
            }
            if best_signal
            else None
        ),
    }
