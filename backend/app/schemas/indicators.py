from typing import Any

from pydantic import BaseModel, ConfigDict


class IndicatorReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    value: Any
    label: str
    interpretation: str


class IndicatorSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    symbol: str
    market_type: str
    timeframe: str
    as_of: str
    price: float
    rsi: IndicatorReadingOut
    macd: IndicatorReadingOut
    ema: IndicatorReadingOut
    bollinger: IndicatorReadingOut
    volume: IndicatorReadingOut
    support_resistance: IndicatorReadingOut
    summary_labels: list[str]
    delta: IndicatorReadingOut | None = None
