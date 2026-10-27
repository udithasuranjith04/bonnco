from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DetectedPattern:
    pattern: str  # e.g. "head_and_shoulders", "bull_flag", "bullish_engulfing"
    category: str  # "reversal" | "continuation" | "candlestick"
    bias: str  # "bullish" | "bearish" | "neutral"
    symbol: str
    market_type: str
    timeframe: str
    completeness: float  # 0-1: how much of the pattern's shape has formed
    confirmed: bool  # has the breakout/confirmation condition actually triggered
    price_low: float
    price_high: float
    range_start: datetime
    range_end: datetime
    interpretation: str
    key_points: list[dict] = field(default_factory=list)
