from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# How long after a signal was generated to check whether price actually moved the predicted
# direction — short, medium, and long horizons so a signal that looks right in 4h but wrong in 7d
# (or vice versa) is genuinely visible rather than averaged away.
HORIZON_HOURS = (4, 24, 168)

OUTCOME_STATUSES = ("unresolved", "correct", "wrong", "not_applicable")


class SignalOutcome(Base):
    """One row per (signal, horizon) checkpoint. Tracks how Bonnco's own BUY/SELL/HOLD call would
    have performed if followed exactly — separate from the user's real Trade Journal, which tracks
    what the user actually did. 'not_applicable' covers HOLD signals, which aren't a directional
    prediction and are never forced into a correct/wrong framing.
    """

    __tablename__ = "signal_outcomes"
    __table_args__ = (
        Index("ix_signal_outcome_identity", "signal_id", "horizon_hours", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id"), index=True)

    # Denormalized from the parent Signal at seed time so evaluation and dashboard aggregation
    # never need a join, and stay stable even if the signal engine's own schema evolves later.
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    market_type: Mapped[str] = mapped_column(String(10))
    timeframe: Mapped[str] = mapped_column(String(5), index=True)
    signal_type: Mapped[str] = mapped_column(String(12), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    entry_price: Mapped[float] = mapped_column(Float)
    stop_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    signal_created_at: Mapped[datetime] = mapped_column(DateTime, index=True)

    horizon_hours: Mapped[int] = mapped_column(Integer)
    checkpoint_at: Mapped[datetime] = mapped_column(DateTime, index=True)

    status: Mapped[str] = mapped_column(String(20), default="unresolved", index=True)
    hit_stop_loss: Mapped[bool] = mapped_column(Boolean, default=False)
    price_move_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_price: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
