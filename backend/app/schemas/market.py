from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class CandleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    open_time: datetime
    close_time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    buy_volume: float | None = None
    sell_volume: float | None = None
    delta: float | None = None


class BackfillRequest(BaseModel):
    symbol: str
    market_type: Literal["spot", "futures"] = "spot"
    timeframe: str = "1h"
    limit: int = 500


class PriceOut(BaseModel):
    symbol: str
    market_type: str
    price: float


class FuturesInfoOut(BaseModel):
    symbol: str
    mark_price: float
    index_price: float
    last_funding_rate: float
    next_funding_time: datetime


class TopSymbolOut(BaseModel):
    symbol: str
    price: float
    price_change_percent: float
    volume_24h: float


class TickerSnapshotOut(BaseModel):
    symbol: str
    market_type: str
    price: float
    price_change_percent: float
    high_24h: float
    low_24h: float
    volume_24h: float
