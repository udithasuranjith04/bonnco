from pydantic import BaseModel


class LiquidationCluster(BaseModel):
    price_low: float
    price_high: float
    total_usd: float
    count: int
    dominant_side: str


class LiquidationClustersOut(BaseModel):
    symbol: str
    hours: int
    total_usd: float
    event_count: int
    clusters: list[LiquidationCluster]
    summary: str
