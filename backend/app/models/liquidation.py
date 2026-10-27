from datetime import datetime

from sqlalchemy import DateTime, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Liquidation(Base):
    """One row per real liquidation event from Binance's exchange-wide forced-order stream
    (`!forceOrder@arr`) — genuine liquidation data, the same underlying feed paid heatmap tools
    are built on, just not pre-visualized. `side` is the side of the forced order Binance places
    to close the position: SELL means a long got liquidated, BUY means a short got liquidated.
    """

    __tablename__ = "liquidations"
    __table_args__ = (Index("ix_liquidations_symbol_time", "symbol", "event_time"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    side: Mapped[str] = mapped_column(String(4))  # "BUY" | "SELL" — side of the forced order itself
    price: Mapped[float] = mapped_column(Float)
    quantity: Mapped[float] = mapped_column(Float)
    quote_quantity: Mapped[float] = mapped_column(Float)  # price * quantity, the USD-ish value liquidated
    event_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
