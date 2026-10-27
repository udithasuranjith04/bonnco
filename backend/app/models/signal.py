from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Float, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

SIGNAL_VALUES = ("STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL")


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    timeframe: Mapped[str] = mapped_column(String(5))
    market_type: Mapped[str] = mapped_column(Enum("spot", "futures", name="signal_market_type_enum"))
    signal: Mapped[str] = mapped_column(Enum(*SIGNAL_VALUES, name="signal_value_enum"))
    confidence: Mapped[float] = mapped_column(Float)
    reasoning: Mapped[str] = mapped_column(Text)

    entry_price: Mapped[float] = mapped_column(Float)
    stop_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    suggested_leverage_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    suggested_leverage_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    liquidation_estimate: Mapped[float | None] = mapped_column(Float, nullable=True)

    indicator_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    sentiment_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)

    # Short, card-friendly pattern mention — kept deliberately terse (no price levels, no
    # confirmation math) since that detail already lives in `reasoning`. Nullable because most
    # signals won't have a headline pattern at generation time.
    pattern_summary: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pattern_bias: Mapped[str | None] = mapped_column(String(10), nullable=True)
    pattern_confirmed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
