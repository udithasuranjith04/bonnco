from datetime import datetime

from pydantic import BaseModel

from app.schemas.binance_account import BinancePositionOut
from app.schemas.goal import GoalOut


class BestSignalOut(BaseModel):
    symbol: str
    market_type: str
    timeframe: str
    signal: str
    confidence: float
    reasoning: str
    created_at: datetime


class CheckinOut(BaseModel):
    goal: GoalOut
    total_value_usd: float | None
    today_pnl_usd: float | None
    today_pnl_pct: float | None
    open_positions: list[BinancePositionOut]
    best_watchlist_signal: BestSignalOut | None
