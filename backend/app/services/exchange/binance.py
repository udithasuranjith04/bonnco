import time
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.services.exchange.base import CandleData, ExchangeAdapter, FuturesInfo, TickerData, TickerSnapshot

settings = get_settings()

TICKER_CACHE_TTL_SECONDS = 5
STABLECOIN_BASES = {"USDC", "USD1", "RLUSD", "FDUSD", "TUSD", "BUSD", "DAI", "EUR", "GBP", "USDP"}


def _to_dt(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None)


class BinanceAdapter(ExchangeAdapter):
    def __init__(self) -> None:
        self._spot = httpx.Client(base_url=settings.binance_spot_base_url, timeout=10)
        self._futures = httpx.Client(base_url=settings.binance_futures_base_url, timeout=10)
        self._ticker_cache: dict[str, tuple[float, list[dict]]] = {}

    def _client(self, market_type: str) -> httpx.Client:
        return self._futures if market_type == "futures" else self._spot

    def _all_tickers(self, market_type: str) -> list[dict]:
        """The full 24hr ticker snapshot (thousands of rows) is shared by top-symbols and search —
        cache it briefly so rapid typeahead keystrokes don't each trigger a fresh upstream call."""
        cached = self._ticker_cache.get(market_type)
        now = time.monotonic()
        if cached and now - cached[0] < TICKER_CACHE_TTL_SECONDS:
            return cached[1]

        path = "/fapi/v1/ticker/24hr" if market_type == "futures" else "/api/v3/ticker/24hr"
        resp = self._client(market_type).get(path)
        resp.raise_for_status()
        rows = resp.json()
        self._ticker_cache[market_type] = (now, rows)
        return rows

    def get_klines(
        self, symbol: str, timeframe: str, market_type: str, limit: int = 500, end_time: datetime | None = None
    ) -> list[CandleData]:
        path = "/fapi/v1/klines" if market_type == "futures" else "/api/v3/klines"
        params = {"symbol": symbol, "interval": timeframe, "limit": limit}
        if end_time is not None:
            params["endTime"] = int(end_time.timestamp() * 1000)
        resp = self._client(market_type).get(path, params=params)
        resp.raise_for_status()
        rows = resp.json()
        return [
            CandleData(
                open_time=_to_dt(row[0]),
                close_time=_to_dt(row[6]),
                open=float(row[1]),
                high=float(row[2]),
                low=float(row[3]),
                close=float(row[4]),
                volume=float(row[5]),
            )
            for row in rows
        ]

    def get_current_price(self, symbol: str, market_type: str) -> float:
        path = "/fapi/v1/ticker/price" if market_type == "futures" else "/api/v3/ticker/price"
        resp = self._client(market_type).get(path, params={"symbol": symbol})
        resp.raise_for_status()
        return float(resp.json()["price"])

    def get_futures_info(self, symbol: str) -> FuturesInfo:
        resp = self._futures.get("/fapi/v1/premiumIndex", params={"symbol": symbol})
        resp.raise_for_status()
        data = resp.json()
        return FuturesInfo(
            mark_price=float(data["markPrice"]),
            index_price=float(data["indexPrice"]),
            last_funding_rate=float(data["lastFundingRate"]),
            next_funding_time=_to_dt(int(data["nextFundingTime"])),
        )

    def get_top_symbols_by_volume(
        self, market_type: str, quote_asset: str = "USDT", limit: int = 15
    ) -> list[TickerData]:
        rows = self._all_tickers(market_type)

        # A "top movers" overview isn't useful cluttered with stablecoin-vs-stablecoin pairs.
        candidates = [
            row
            for row in rows
            if row["symbol"].endswith(quote_asset) and row["symbol"][: -len(quote_asset)] not in STABLECOIN_BASES
        ]
        candidates.sort(key=lambda row: float(row["quoteVolume"]), reverse=True)

        return [
            TickerData(
                symbol=row["symbol"],
                price=float(row["lastPrice"]),
                price_change_percent=float(row["priceChangePercent"]),
                volume_24h=float(row["quoteVolume"]),
            )
            for row in candidates[:limit]
        ]

    def get_ticker_snapshot(self, symbol: str, market_type: str) -> TickerSnapshot:
        # REST fallback for the live-price display: the WS ticker relay (LiveStreamHub/TickerHub)
        # is preferred for sub-second updates, but some networks silently drop long-lived streams
        # to Binance's futures WS host without erroring, leaving the UI blank. This REST snapshot
        # (same cached 24hr-ticker call used by top-symbols/search) is the reliable fallback.
        rows = self._all_tickers(market_type)
        symbol = symbol.upper()
        row = next((r for r in rows if r["symbol"] == symbol), None)
        if row is None:
            raise ValueError(f"No ticker data found for {symbol} ({market_type})")

        return TickerSnapshot(
            symbol=symbol,
            price=float(row["lastPrice"]),
            price_change_percent=float(row["priceChangePercent"]),
            high_24h=float(row["highPrice"]),
            low_24h=float(row["lowPrice"]),
            volume_24h=float(row["quoteVolume"]),
        )

    def search_symbols(
        self, market_type: str, query: str, quote_asset: str = "USDT", limit: int = 10
    ) -> list[TickerData]:
        rows = self._all_tickers(market_type)
        q = query.upper().strip()
        if not q:
            return []

        candidates = [row for row in rows if row["symbol"].endswith(quote_asset) and q in row["symbol"]]
        # Prefix matches first (typing "SOL" should surface SOLUSDT before e.g. ASOLUSDT), then by volume.
        candidates.sort(key=lambda row: (not row["symbol"].startswith(q), -float(row["quoteVolume"])))

        return [
            TickerData(
                symbol=row["symbol"],
                price=float(row["lastPrice"]),
                price_change_percent=float(row["priceChangePercent"]),
                volume_24h=float(row["quoteVolume"]),
            )
            for row in candidates[:limit]
        ]
