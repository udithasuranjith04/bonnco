from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class PatternHistoryEntry(Base):
    """One row per distinct pattern occurrence (identified by symbol/market_type/timeframe/pattern/
    range_start) — repeated detections of the same still-forming pattern update the existing row
    rather than inserting duplicates, so this table stays a genuine occurrence log, not a per-poll
    dump. `outcome` is filled in later by a background job once enough time has passed to judge
    whether price actually moved the textbook direction after confirmation.
    """

    __tablename__ = "pattern_history"
    __table_args__ = (
        Index(
            "ix_pattern_history_identity",
            "symbol",
            "market_type",
            "timeframe",
            "pattern",
            "range_start",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    market_type: Mapped[str] = mapped_column(String(10))
    timeframe: Mapped[str] = mapped_column(String(5), index=True)
    pattern: Mapped[str] = mapped_column(String(40), index=True)
    category: Mapped[str] = mapped_column(String(20))
    bias: Mapped[str] = mapped_column(String(10))

    completeness: Mapped[float] = mapped_column(Float)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)

    price_low: Mapped[float] = mapped_column(Float)
    price_high: Mapped[float] = mapped_column(Float)
    range_start: Mapped[datetime] = mapped_column(DateTime, index=True)
    range_end: Mapped[datetime] = mapped_column(DateTime)

    # The price when this occurrence was first logged — the reference point outcome evaluation
    # measures movement from.
    price_at_detection: Mapped[float] = mapped_column(Float)

    first_detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    outcome: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "hit" | "miss" | None (pending)
    outcome_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    outcome_price: Mapped[float | None] = mapped_column(Float, nullable=True)
