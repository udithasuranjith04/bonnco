"""Tracks how Bonnco's own BUY/SELL/HOLD signals would have performed if followed exactly —
separate from the user's Trade Journal, which tracks what the user actually did. Every checkpoint
is resolved from real stored candle data, never estimated; a checkpoint with no candle coverage
yet, or not enough time passed, honestly stays 'unresolved' rather than being forced to a result.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candle import Candle
from app.models.signal import Signal
from app.models.signal_outcome import HORIZON_HOURS, SignalOutcome

logger = logging.getLogger("bonnco.signal_outcomes")

LONG_SIGNALS = ("BUY", "STRONG_BUY")
SHORT_SIGNALS = ("SELL", "STRONG_SELL")


def seed_signal_outcomes(db: Session, signal: Signal) -> None:
    """Creates one pending outcome row per tracked horizon for a freshly-created signal. Only call
    this right after a genuinely new Signal row is inserted (not on a cache-hit return), since
    signal.id is assumed fresh and no existence check is done before inserting.
    """
    for hours in HORIZON_HOURS:
        db.add(
            SignalOutcome(
                signal_id=signal.id,
                symbol=signal.symbol,
                market_type=signal.market_type,
                timeframe=signal.timeframe,
                signal_type=signal.signal,
                confidence=signal.confidence,
                entry_price=signal.entry_price,
                stop_loss=signal.stop_loss,
                signal_created_at=signal.created_at,
                horizon_hours=hours,
                checkpoint_at=signal.created_at + timedelta(hours=hours),
            )
        )
    db.commit()


def _load_candles(db: Session, symbol: str, market_type: str, timeframe: str, start: datetime, end: datetime) -> list[Candle]:
    return db.scalars(
        select(Candle)
        .where(
            Candle.symbol == symbol,
            Candle.market_type == market_type,
            Candle.timeframe == timeframe,
            Candle.open_time >= start,
            Candle.open_time <= end,
        )
        .order_by(Candle.open_time.asc())
    ).all()


def _closest_at_or_before(candles: list[Candle], target: datetime) -> Candle | None:
    candidates = [c for c in candles if c.open_time <= target]
    return candidates[-1] if candidates else None


def evaluate_pending_signal_outcomes(db: Session, now: datetime | None = None) -> int:
    """Resolves every pending outcome checkpoint whose time has arrived, or whose reference
    stop-loss was already touched (which ends the hypothetical position early, resolving every
    still-pending horizon for that signal as 'wrong' immediately rather than waiting). Returns how
    many rows were resolved.
    """
    now = now or datetime.utcnow()
    pending = db.scalars(select(SignalOutcome).where(SignalOutcome.status == "unresolved")).all()

    by_signal: dict[int, list[SignalOutcome]] = {}
    for row in pending:
        by_signal.setdefault(row.signal_id, []).append(row)

    resolved_count = 0
    for outcomes in by_signal.values():
        rep = outcomes[0]
        is_long = rep.signal_type in LONG_SIGNALS
        is_short = rep.signal_type in SHORT_SIGNALS
        directional = is_long or is_short

        try:
            candles = _load_candles(db, rep.symbol, rep.market_type, rep.timeframe, rep.signal_created_at, now)
        except Exception:
            logger.exception("Failed to load candles for signal outcome eval (signal_id=%s)", rep.signal_id)
            continue

        stop_hit_candle = None
        if directional and rep.stop_loss is not None:
            for c in candles:
                if (is_long and c.low <= rep.stop_loss) or (is_short and c.high >= rep.stop_loss):
                    stop_hit_candle = c
                    break

        for outcome in outcomes:
            if directional and stop_hit_candle is not None:
                outcome.status = "wrong"
                outcome.hit_stop_loss = True
                outcome.price_move_pct = round((rep.stop_loss - rep.entry_price) / rep.entry_price * 100, 3)
                outcome.resolved_at = stop_hit_candle.open_time
                outcome.resolved_price = rep.stop_loss
                resolved_count += 1
                continue

            if now < outcome.checkpoint_at:
                continue  # not enough time has passed yet, stays unresolved

            candle = _closest_at_or_before(candles, outcome.checkpoint_at)
            if candle is None:
                continue  # no candle data reaches this far yet, stays honestly unresolved

            move_pct = (candle.close - rep.entry_price) / rep.entry_price * 100
            if not directional:
                outcome.status = "not_applicable"
            elif is_long:
                outcome.status = "correct" if move_pct > 0 else "wrong"
            else:
                outcome.status = "correct" if move_pct < 0 else "wrong"
            outcome.price_move_pct = round(move_pct, 3)
            outcome.resolved_at = candle.open_time
            outcome.resolved_price = candle.close
            resolved_count += 1

    db.commit()
    return resolved_count
