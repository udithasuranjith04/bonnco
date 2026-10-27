from datetime import datetime

from sqlalchemy import Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class MarketFingerprint(Base):
    """One row per historical candle, recording the technical 'shape' of the market at that moment
    (RSI, trend, volume ratio, Bollinger position) plus what price actually did over the following
    `forward_horizon_days` — computed once from real backfilled candle history, never estimated.
    This is what historical-similarity search compares the live market against; `forward_return_pct`
    stays null for the most recent candles where the forward window hasn't happened yet.
    """

    __tablename__ = "market_fingerprints"
    __table_args__ = (
        Index(
            "ix_market_fingerprint_identity",
            "symbol",
            "market_type",
            "timeframe",
            "open_time",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    market_type: Mapped[str] = mapped_column(String(10))
    timeframe: Mapped[str] = mapped_column(String(5), index=True)
    open_time: Mapped[datetime] = mapped_column(index=True)

    close_price: Mapped[float] = mapped_column(Float)
    rsi: Mapped[float] = mapped_column(Float)
    trend: Mapped[str] = mapped_column(String(20))  # "uptrend" | "downtrend" | "mixed"
    volume_ratio: Mapped[float] = mapped_column(Float)
    bb_percent_b: Mapped[float] = mapped_column(Float)

    forward_horizon_days: Mapped[int] = mapped_column()
    forward_return_pct: Mapped[float | None] = mapped_column(Float, nullable=True)

    computed_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
