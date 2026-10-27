from functools import lru_cache

from app.core.config import get_settings
from app.services.exchange.base import ExchangeAdapter
from app.services.exchange.binance import BinanceAdapter

settings = get_settings()


@lru_cache
def get_exchange_adapter() -> ExchangeAdapter:
    if settings.exchange_provider == "binance":
        return BinanceAdapter()
    raise ValueError(f"Unsupported exchange provider: {settings.exchange_provider}")
