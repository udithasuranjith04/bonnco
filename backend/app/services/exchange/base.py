from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"]
MARKET_TYPES = ("spot", "futures")


@dataclass
class CandleData:
    open_time: datetime
    close_time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class FuturesInfo:
    mark_price: float
    index_price: float
    last_funding_rate: float
    next_funding_time: datetime


@dataclass
class TickerData:
    symbol: str
    price: float
    price_change_percent: float
    volume_24h: float


@dataclass
class TickerSnapshot:
    symbol: str
    price: float
    price_change_percent: float
    high_24h: float
    low_24h: float
    volume_24h: float


class ExchangeAdapter(ABC):
    """Common interface so a second venue (e.g. Bybit) can be added without touching callers."""

    @abstractmethod
    def get_klines(
        self, symbol: str, timeframe: str, market_type: str, limit: int = 500, end_time: datetime | None = None
    ) -> list[CandleData]:
        ...

    @abstractmethod
    def get_current_price(self, symbol: str, market_type: str) -> float:
        ...

    @abstractmethod
    def get_futures_info(self, symbol: str) -> FuturesInfo:
        ...

    @abstractmethod
    def get_top_symbols_by_volume(
        self, market_type: str, quote_asset: str = "USDT", limit: int = 15
    ) -> list[TickerData]:
        ...

    @abstractmethod
    def search_symbols(
        self, market_type: str, query: str, quote_asset: str = "USDT", limit: int = 10
    ) -> list[TickerData]:
        ...

    @abstractmethod
    def get_ticker_snapshot(self, symbol: str, market_type: str) -> TickerSnapshot:
        ...
