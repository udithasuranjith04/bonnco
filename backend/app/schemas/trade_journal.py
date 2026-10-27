from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class TradeJournalCreate(BaseModel):
    symbol: str
    market_type: Literal["spot", "futures"] = "spot"
    side: Literal["long", "short"] = "long"
    entry_price: float
    exit_price: float | None = None
    leverage: float = 1.0
    stop_loss: float | None = None
    position_size_usd: float | None = None
    notes: str = ""
    opened_at: datetime | None = None
    closed_at: datetime | None = None


class TradeJournalUpdate(BaseModel):
    exit_price: float | None = None
    closed_at: datetime | None = None
    stop_loss: float | None = None
    position_size_usd: float | None = None
    notes: str | None = None


class TradeJournalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    market_type: str
    side: str
    entry_price: float
    exit_price: float | None
    leverage: float
    result_pnl: float | None
    stop_loss: float | None
    position_size_usd: float | None
    status: Literal["open", "closed"]
    source: Literal["manual", "binance_import", "binance_trade_sync"]
    signal_id: int | None
    notes: str
    opened_at: datetime
    closed_at: datetime | None
    created_at: datetime


class BucketStatsOut(BaseModel):
    trades: int
    wins: int
    win_rate: float | None


class JournalStatsOut(BaseModel):
    overall: BucketStatsOut
    signal_aligned: BucketStatsOut
    signal_not_aligned: BucketStatsOut
    no_signal_data: BucketStatsOut
    open_trades: int


class ActivePositionOut(BaseModel):
    trade: TradeJournalOut
    current_price: float
    pnl_pct: float
    pnl_usd: float | None
    current_signal: str | None
    guidance: str
    stop_warning: str | None
