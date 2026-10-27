from datetime import datetime

from sqlalchemy import DateTime, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Candle(Base):
    __tablename__ = "candles"
    __table_args__ = (
        Index(
            "ix_candles_symbol_market_tf_time",
            "symbol",
            "market_type",
            "timeframe",
            "open_time",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    market_type: Mapped[str] = mapped_column(String(10), default="spot")
    timeframe: Mapped[str] = mapped_column(String(5), index=True)  # 5m, 15m, 1h, 4h, 1d
    open_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    close_time: Mapped[datetime] = mapped_column(DateTime)
    open: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    low: Mapped[float] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    volume: Mapped[float] = mapped_column(Float)

    # Buy/sell-initiated volume (quote asset) and their difference, computed in real time from the
    # raw spot trade stream (aggTrade's isBuyerMaker flag) — never backfilled, so these are only
    # populated for candles formed after the trade-delta listener started tracking that symbol.
    buy_volume: Mapped[float | None] = mapped_column(Float, nullable=True)
    sell_volume: Mapped[float | None] = mapped_column(Float, nullable=True)
    delta: Mapped[float | None] = mapped_column(Float, nullable=True)
