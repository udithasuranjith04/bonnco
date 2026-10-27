from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class WatchlistItemCreate(BaseModel):
    symbol: str
    market_type: Literal["spot", "futures"] = "spot"


class WatchlistItemUpdate(BaseModel):
    market_type: Literal["spot", "futures"]


class WatchlistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    market_type: str
    enabled: bool
    created_at: datetime
