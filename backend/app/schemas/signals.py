from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class GenerateSignalRequest(BaseModel):
    symbol: str
    market_type: Literal["spot", "futures"] = "spot"
    timeframe: str = "1h"


class SignalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    timeframe: str
    market_type: str
    signal: str
    confidence: float
    reasoning: str
    entry_price: float
    stop_loss: float | None
    suggested_leverage_min: float | None
    suggested_leverage_max: float | None
    liquidation_estimate: float | None
    liquidation_disclaimer: str | None = None
    indicator_snapshot: Any
    sentiment_snapshot: Any
    pattern_summary: str | None = None
    pattern_bias: str | None = None
    pattern_confirmed: bool | None = None
    created_at: datetime

    @staticmethod
    def from_orm_with_disclaimer(row) -> "SignalOut":
        out = SignalOut.model_validate(row)
        if out.liquidation_estimate is not None:
            out.liquidation_disclaimer = "Estimate only. Confirm the exact liquidation price on your exchange."
        return out
