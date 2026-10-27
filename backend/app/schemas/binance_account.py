from pydantic import BaseModel


class BinanceConnectRequest(BaseModel):
    api_key: str
    api_secret: str


class BinanceStatusOut(BaseModel):
    connected: bool
    source: str | None  # "env" | "database" | None
    masked_key: str | None
    safe: bool
    warnings: list[str]
    permissions: dict | None


class BinanceBalanceOut(BaseModel):
    connected: bool
    spot_usd: float | None
    futures_usd: float | None
    total_usd: float | None
    unpriced_assets: list[str]


class AssetHoldingOut(BaseModel):
    asset: str
    amount: float
    spot_amount: float
    earn_amount: float
    futures_amount: float
    usd_value: float | None


class BinancePositionOut(BaseModel):
    symbol: str
    side: str
    position_amt: float
    entry_price: float
    mark_price: float
    leverage: float
    unrealized_pnl: float
    notional_usd: float
    liquidation_price: float | None
    liquidation_distance_pct: float | None
    margin_warning: str | None


class BinanceOpenOrderOut(BaseModel):
    symbol: str
    side: str
    type: str
    price: float
    orig_qty: float
    status: str | None


class BinanceOpenOrdersOut(BaseModel):
    spot: list[BinanceOpenOrderOut]
    futures: list[BinanceOpenOrderOut]


class ReconcileMatchOut(BaseModel):
    binance_position: BinancePositionOut
    journal_entry_id: int


class ReconcileOut(BaseModel):
    matched: list[ReconcileMatchOut]
    unmatched_binance_positions: list[BinancePositionOut]
    unmatched_journal_entry_ids: list[int]


class ImportPositionRequest(BaseModel):
    symbol: str


class ConcentrationOut(BaseModel):
    coin: str
    usd_value: float
    pct_of_portfolio: float


class CorrelationWarningOut(BaseModel):
    coins: list[str]
    correlation: float
    combined_pct_of_portfolio: float
    message: str


class FeeTierOut(BaseModel):
    maker_pct: float
    taker_pct: float
    tier_label: str
    volume_note: str


class SimpleEarnHoldingOut(BaseModel):
    asset: str
    amount: float
    product: str
    apy_pct: float
    maturity_date: str | None


class PortfolioOverviewOut(BaseModel):
    connected: bool
    total_exposure_usd: float | None
    concentration: list[ConcentrationOut]
    correlation_warnings: list[CorrelationWarningOut]
    fee_tier: FeeTierOut | None
    simple_earn: list[SimpleEarnHoldingOut]
    total_unrealized_pnl_usd: float | None


class PortfolioSummaryOut(BaseModel):
    connected: bool
    total_value_usd: float | None
    spot_value_usd: float | None
    earn_value_usd: float | None
    futures_margin_usd: float | None
    today_pnl_usd: float | None
    today_pnl_pct: float | None
    unpriced_assets: list[str]


class ExposureHistoryPointOut(BaseModel):
    time: str
    exposure_usd: float


class TradeHistorySyncOut(BaseModel):
    imported_by_symbol: dict[str, int]
    total_imported: int
