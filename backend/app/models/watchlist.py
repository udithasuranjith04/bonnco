from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class WatchlistItem(Base):
    __tablename__ = "watchlist"
    __table_args__ = (UniqueConstraint("symbol", "market_type", name="uq_watchlist_symbol_market"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    market_type: Mapped[str] = mapped_column(Enum("spot", "futures", name="market_type_enum"), default="spot")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
