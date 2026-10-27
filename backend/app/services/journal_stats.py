from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.signal import Signal
from app.models.trade_journal import TradeJournalEntry

LONG_SIGNALS = ("BUY", "STRONG_BUY")
SHORT_SIGNALS = ("SELL", "STRONG_SELL")


def find_nearest_signal(db: Session, symbol: str, market_type: str, at_time) -> Signal | None:
    """The single most-recently-generated signal at or before a point in time.

    This is a point-in-time lookup (ORDER BY ... DESC LIMIT 1), not a count — so it's naturally
    immune to the dashboard's periodic refresh logging many duplicate rows for an unchanged signal.
    We only ever care about "what was the signal state right then," never "how many rows exist."
    """
    return db.scalars(
        select(Signal)
        .where(Signal.symbol == symbol, Signal.market_type == market_type, Signal.created_at <= at_time)
        .order_by(Signal.created_at.desc())
        .limit(1)
    ).first()


def _signal_direction(signal_value: str) -> str:
    if signal_value in LONG_SIGNALS:
        return "long"
    if signal_value in SHORT_SIGNALS:
        return "short"
    return "hold"


def _bucket_stats(trades: list[TradeJournalEntry]) -> dict:
    wins = sum(1 for t in trades if (t.result_pnl or 0) > 0)
    total = len(trades)
    return {
        "trades": total,
        "wins": wins,
        "win_rate": round(wins / total * 100, 1) if total else None,
    }


def compute_journal_stats(db: Session) -> dict:
    closed_trades = db.scalars(
        select(TradeJournalEntry)
        .where(TradeJournalEntry.exit_price.is_not(None))
        .order_by(TradeJournalEntry.opened_at)
    ).all()

    signal_aligned: list[TradeJournalEntry] = []
    signal_not_aligned: list[TradeJournalEntry] = []
    no_signal_data: list[TradeJournalEntry] = []

    for trade in closed_trades:
        nearest = find_nearest_signal(db, trade.symbol, trade.market_type, trade.opened_at)
        if nearest is None:
            no_signal_data.append(trade)
            continue

        if _signal_direction(nearest.signal) == trade.side:
            signal_aligned.append(trade)
        else:
            signal_not_aligned.append(trade)

    return {
        "overall": _bucket_stats(closed_trades),
        "signal_aligned": _bucket_stats(signal_aligned),
        "signal_not_aligned": _bucket_stats(signal_not_aligned),
        "no_signal_data": _bucket_stats(no_signal_data),
        "open_trades": db.scalar(
            select(func.count()).select_from(TradeJournalEntry).where(TradeJournalEntry.exit_price.is_(None))
        ),
    }
