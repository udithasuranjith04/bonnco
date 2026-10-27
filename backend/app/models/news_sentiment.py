from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class NewsSentiment(Base):
    __tablename__ = "news_sentiment"
    __table_args__ = (Index("ix_news_url_unique", "url", unique=True, mysql_length=255),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    headline: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(100), default="")
    url: Mapped[str] = mapped_column(String(1000), default="")
    related_symbol: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    sentiment: Mapped[str] = mapped_column(Enum("bullish", "bearish", "neutral", name="sentiment_enum"))
    confidence: Mapped[float] = mapped_column(Float)
    reason: Mapped[str] = mapped_column(Text)
    ai_provider: Mapped[str] = mapped_column(String(20), default="openai")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
