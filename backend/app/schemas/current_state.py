from datetime import datetime
from typing import Literal

from pydantic import BaseModel

ConnectionState = Literal["connected", "degraded", "unavailable"]


class DataFreshness(BaseModel):
    """Every data source feeding the unified state carries one of these, so a consumer can tell
    "this number is live" apart from "this number is what we last had, and here's why" — the
    distinction the whole point of this model is to make impossible to silently lose.
    """

    provider: str
    fetched_at: datetime | None
    age_seconds: float | None
    connection_state: ConnectionState
    stale: bool
    fallback_used: bool
    note: str | None = None


class HistoricalSimilarityOut(BaseModel):
    open_time: datetime
    close_price: float
    rsi: float
    trend: str
    volume_ratio: float
    forward_return_pct: float
    forward_horizon_days: int
    distance: float


class FundingOut(BaseModel):
    mark_price: float
    index_price: float
    last_funding_rate: float
    next_funding_time: datetime


class SymbolState(BaseModel):
    symbol: str
    market_type: str
    timeframe: str

    signal: str | None
    confidence: float | None
    entry_price: float | None
    stop_loss: float | None
    suggested_leverage_min: float | None
    suggested_leverage_max: float | None
    liquidation_estimate: float | None

    indicator_snapshot: dict | None
    pattern_summary: str | None
    pattern_bias: str | None
    pattern_confirmed: bool | None
    sentiment_snapshot: dict | None
    order_flow: dict | None
    historical_similarity: HistoricalSimilarityOut | None
    funding: FundingOut | None

    signal_freshness: DataFreshness
    candle_freshness: DataFreshness
    funding_freshness: DataFreshness | None


class PortfolioState(BaseModel):
    connected: bool
    total_value_usd: float | None
    spot_value_usd: float | None
    earn_value_usd: float | None
    futures_margin_usd: float | None
    today_pnl_usd: float | None
    today_pnl_pct: float | None
    open_positions: list[dict]
    freshness: DataFreshness


class GoalState(BaseModel):
    current_value_usd: float | None
    highest_milestone_reached_usd: float
    next_milestone_usd: float | None
    milestones: list[float]
    newly_reached_milestone_usd: float | None
    progress_to_next_pct: float | None
    daily_pace_usd: float | None
    freshness: DataFreshness


class CurrentStateOut(BaseModel):
    generated_at: datetime
    symbol: SymbolState | None
    portfolio: PortfolioState
    goal: GoalState
