from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DetectedPatternOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    pattern: str
    category: str
    bias: str
    symbol: str
    market_type: str
    timeframe: str
    completeness: float
    confirmed: bool
    price_low: float
    price_high: float
    range_start: datetime
    range_end: datetime
    interpretation: str
    key_points: list[dict]


class PatternScanOut(BaseModel):
    headline: DetectedPatternOut | None
    secondary: DetectedPatternOut | None
