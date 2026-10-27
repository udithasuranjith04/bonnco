from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ChatRequest(BaseModel):
    session_id: str
    message: str
    symbol: str | None = None
    market_type: Literal["spot", "futures"] = "spot"
    timeframe: str = "1h"
    # Which page the message was sent from (e.g. "dashboard", "journal") — lets the reply resolve
    # an ambiguous term like "the target" against whatever's actually visible on that screen
    # (the goal/milestone tracker, open positions) instead of only ever assuming it means a coin.
    page: str | None = None


class ChatReplyOut(BaseModel):
    reply: str
    provider: str


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    symbol: str | None
    created_at: datetime
