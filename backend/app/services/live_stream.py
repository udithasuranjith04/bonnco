import asyncio
import json
import logging
from datetime import datetime, timezone

import websockets
from fastapi import WebSocket
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.db import SessionLocal
from app.models.candle import Candle

logger = logging.getLogger("bonnco.live_stream")

BINANCE_SPOT_WS_BASE = "wss://stream.binance.com:9443/ws"
BINANCE_FUTURES_WS_BASE = "wss://fstream.binance.com/ws"

# Only persist the still-forming candle to MySQL at most this often — every tick would be
# far more writes than the data is worth; the closed candle is always persisted immediately.
DB_WRITE_THROTTLE_SECONDS = 2.0

StreamKey = tuple[str, str, str]  # (symbol, market_type, timeframe)


def _to_naive_utc(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None)


class LiveStreamHub:
    """Pools one upstream Binance kline WebSocket per (symbol, market_type, timeframe), shared
    across however many of our own frontend clients are watching that same chart, and tears the
    upstream connection down once the last subscriber disconnects.
    """

    def __init__(self) -> None:
        self._subscribers: dict[StreamKey, set[WebSocket]] = {}
        self._tasks: dict[StreamKey, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, ws: WebSocket, symbol: str, market_type: str, timeframe: str) -> None:
        key: StreamKey = (symbol.upper(), market_type, timeframe)
        async with self._lock:
            self._subscribers.setdefault(key, set()).add(ws)
            if key not in self._tasks or self._tasks[key].done():
                self._tasks[key] = asyncio.create_task(self._run_upstream(key))
                logger.info("Started upstream Binance stream for %s", key)

    async def unsubscribe(self, ws: WebSocket, symbol: str, market_type: str, timeframe: str) -> None:
        key: StreamKey = (symbol.upper(), market_type, timeframe)
        async with self._lock:
            subs = self._subscribers.get(key)
            if subs:
                subs.discard(ws)
            if subs is not None and not subs:
                self._subscribers.pop(key, None)
                task = self._tasks.pop(key, None)
                if task:
                    task.cancel()
                    logger.info("Stopped upstream Binance stream for %s (no subscribers left)", key)

    async def _run_upstream(self, key: StreamKey) -> None:
        symbol, market_type, timeframe = key
        base = BINANCE_FUTURES_WS_BASE if market_type == "futures" else BINANCE_SPOT_WS_BASE
        url = f"{base}/{symbol.lower()}@kline_{timeframe}"
        last_db_write = 0.0

        while True:
            try:
                async with websockets.connect(url, ping_interval=20) as upstream:
                    async for raw in upstream:
                        message = json.loads(raw)
                        k = message.get("k")
                        if not k:
                            continue

                        payload = {
                            "symbol": symbol,
                            "market_type": market_type,
                            "timeframe": timeframe,
                            "open_time": k["t"],
                            "close_time": k["T"],
                            "open": float(k["o"]),
                            "high": float(k["h"]),
                            "low": float(k["l"]),
                            "close": float(k["c"]),
                            "volume": float(k["v"]),
                            "is_closed": k["x"],
                        }

                        await self._broadcast(key, payload)

                        now = asyncio.get_event_loop().time()
                        if payload["is_closed"] or now - last_db_write >= DB_WRITE_THROTTLE_SECONDS:
                            await asyncio.get_event_loop().run_in_executor(None, self._persist, payload)
                            last_db_write = now
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Upstream Binance stream error for %s, reconnecting in 3s", key)
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

    def _persist(self, payload: dict) -> None:
        db = SessionLocal()
        try:
            row = {
                "symbol": payload["symbol"],
                "market_type": payload["market_type"],
                "timeframe": payload["timeframe"],
                "open_time": _to_naive_utc(payload["open_time"]),
                "close_time": _to_naive_utc(payload["close_time"]),
                "open": payload["open"],
                "high": payload["high"],
                "low": payload["low"],
                "close": payload["close"],
                "volume": payload["volume"],
            }
            stmt = mysql_insert(Candle).values([row])
            stmt = stmt.on_duplicate_key_update(
                close_time=stmt.inserted.close_time,
                open=stmt.inserted.open,
                high=stmt.inserted.high,
                low=stmt.inserted.low,
                close=stmt.inserted.close,
                volume=stmt.inserted.volume,
            )
            db.execute(stmt)
            db.commit()
        except Exception:
            logger.exception("Failed to persist live candle tick for %s", payload.get("symbol"))
        finally:
            db.close()


live_stream_hub = LiveStreamHub()
