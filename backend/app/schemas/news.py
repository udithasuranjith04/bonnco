from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NewsSentimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    headline: str
    source: str
    url: str
    related_symbol: str | None
    published_at: datetime | None
    sentiment: str
    confidence: float
    reason: str
    ai_provider: str
    created_at: datetime
