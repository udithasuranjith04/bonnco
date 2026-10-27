import asyncio
import json
import logging

import websockets
from fastapi import WebSocket

logger = logging.getLogger("bonnco.ticker_stream")

BINANCE_SPOT_WS_BASE = "wss://stream.binance.com:9443/ws"
BINANCE_FUTURES_WS_BASE = "wss://fstream.binance.com/ws"

StreamKey = tuple[str, str]  # (symbol, market_type)


class TickerHub:
    """Relays Binance's dedicated 24hr rolling ticker stream (price + % change, pushed roughly
    once a second) — the same stream real exchanges use for their big ticker display. Separate
    from LiveStreamHub (which relays kline/candle data) since it's a different upstream stream
    type with no timeframe dimension.
    """

    def __init__(self) -> None:
        self._subscribers: dict[StreamKey, set[WebSocket]] = {}
        self._tasks: dict[StreamKey, asyncio.Task] = {}
        self._latest: dict[StreamKey, dict] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, ws: WebSocket, symbol: str, market_type: str) -> None:
        key: StreamKey = (symbol.upper(), market_type)
        async with self._lock:
            self._subscribers.setdefault(key, set()).add(ws)
            if key not in self._tasks or self._tasks[key].done():
                self._tasks[key] = asyncio.create_task(self._run_upstream(key))
        cached = self._latest.get(key)
        if cached:
            try:
                await ws.send_json(cached)
            except Exception:
                pass

    async def unsubscribe(self, ws: WebSocket, symbol: str, market_type: str) -> None:
        key: StreamKey = (symbol.upper(), market_type)
        async with self._lock:
            subs = self._subscribers.get(key)
            if subs:
                subs.discard(ws)
            if subs is not None and not subs:
                self._subscribers.pop(key, None)
                task = self._tasks.pop(key, None)
                if task:
                    task.cancel()

    async def _run_upstream(self, key: StreamKey) -> None:
        symbol, market_type = key
        base = BINANCE_FUTURES_WS_BASE if market_type == "futures" else BINANCE_SPOT_WS_BASE
        url = f"{base}/{symbol.lower()}@ticker"

        while True:
            try:
                async with websockets.connect(url, ping_interval=20) as upstream:
                    async for raw in upstream:
                        data = json.loads(raw)
                        payload = {
                            "symbol": symbol,
                            "market_type": market_type,
                            "price": float(data["c"]),
                            "price_change_percent": float(data["P"]),
                            "high_24h": float(data["h"]),
                            "low_24h": float(data["l"]),
                            "volume_24h": float(data["v"]),
                        }
                        self._latest[key] = payload
                        await self._broadcast(key, payload)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Upstream ticker stream error for %s, reconnecting in 3s", key)
                await asyncio.sleep(3)

    async def _broadcast(self, key: StreamKey, payload: dict) -> None:
        subs = list(self._subscribers.get(key, ()))
        dead: list[WebSocket] = []
        for client in subs:
            try:
                await client.send_json(payload)
            except Exception:
                dead.append(client)
        if dead:
            async with self._lock:
                for d in dead:
                    self._subscribers.get(key, set()).discard(d)


ticker_hub = TickerHub()
