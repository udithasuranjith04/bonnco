import asyncio
import json
import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

import websockets

from app.db import SessionLocal
from app.models.candle import Candle
from app.services.exchange.base import TIMEFRAMES

logger = logging.getLogger("bonnco.trade_delta")

# Only the spot trade stream — the futures equivalent lives on fstream.binance.com, the same host
# confirmed (elsewhere in this codebase) to silently drop all WebSocket data on this network. No
# honest REST fallback exists for trade-level buy/sell data, so futures symbols simply don't get
# delta tracked here rather than pretending to.
BINANCE_SPOT_WS_BASE = "wss://stream.binance.com:9443/ws"

TIMEFRAME_SECONDS = {"5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400}
FLUSH_INTERVAL_SECONDS = 5.0  # how often the still-forming candle's running delta gets persisted


def _bucket_open_time(period_seconds: int, trade_epoch: float) -> float:
    return (int(trade_epoch) // period_seconds) * period_seconds


class SymbolDeltaTracker:
    """Aggregates one symbol's raw trade stream into buy/sell-initiated volume per timeframe candle
    in real time, and periodically persists the still-forming candle's running totals onto the
    matching Candle row. Never invents OHLC data — only enriches Candle rows the REST-based candle
    ingester already created; if that row doesn't exist yet, the trade data for that period is
    simply dropped rather than used to fabricate a candle.
    """

    def __init__(self, symbol: str, market_type: str = "spot") -> None:
        self.symbol = symbol
        self.market_type = market_type
        self.buckets: dict[str, dict] = {
            tf: {"open_time": None, "buy": 0.0, "sell": 0.0, "last_flush": 0.0} for tf in TIMEFRAMES
        }
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())

    def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            self._task = None

    def _handle_trade(self, price: float, qty: float, is_buy: bool, trade_epoch: float) -> None:
        notional = price * qty
        for timeframe, period in TIMEFRAME_SECONDS.items():
            bucket = self.buckets[timeframe]
            open_time = _bucket_open_time(period, trade_epoch)

            if bucket["open_time"] is None:
                bucket["open_time"] = open_time
            elif open_time != bucket["open_time"]:
                self._flush(timeframe)
                bucket["open_time"] = open_time
                bucket["buy"] = 0.0
                bucket["sell"] = 0.0

            if is_buy:
                bucket["buy"] += notional
            else:
                bucket["sell"] += notional

            now = time.monotonic()
            if now - bucket["last_flush"] >= FLUSH_INTERVAL_SECONDS:
                self._flush(timeframe)

    def _flush(self, timeframe: str) -> None:
        bucket = self.buckets[timeframe]
        if bucket["open_time"] is None:
            return
        bucket["last_flush"] = time.monotonic()

        open_dt = datetime.fromtimestamp(bucket["open_time"], tz=timezone.utc).replace(tzinfo=None)
        db: Session = SessionLocal()
        try:
            row = db.scalars(
                select(Candle).where(
                    Candle.symbol == self.symbol,
                    Candle.market_type == self.market_type,
                    Candle.timeframe == timeframe,
                    Candle.open_time == open_dt,
                )
            ).first()
            if row is None:
                return
            row.buy_volume = round(bucket["buy"], 4)
            row.sell_volume = round(bucket["sell"], 4)
            row.delta = round(bucket["buy"] - bucket["sell"], 4)
            db.commit()
        except Exception:
            logger.exception("Failed to flush trade delta for %s %s", self.symbol, timeframe)
            db.rollback()
        finally:
            db.close()

    async def _run(self) -> None:
        url = f"{BINANCE_SPOT_WS_BASE}/{self.symbol.lower()}@aggTrade"
        while True:
            try:
                async with websockets.connect(url, ping_interval=20) as upstream:
                    logger.info("Trade delta stream connected for %s", self.symbol)
                    async for raw in upstream:
                        try:
                            data = json.loads(raw)
                            price = float(data["p"])
                            qty = float(data["q"])
                            is_buyer_maker = bool(data["m"])
                            trade_epoch = float(data["T"]) / 1000
                        except (KeyError, ValueError, TypeError):
                            continue
                        # isBuyerMaker=True means the seller was the aggressor (sell-initiated);
                        # False means the buyer was the aggressor (buy-initiated).
                        self._handle_trade(price, qty, is_buy=not is_buyer_maker, trade_epoch=trade_epoch)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Trade delta stream error for %s, reconnecting in 5s", self.symbol)
                await asyncio.sleep(5)


class DeltaManager:
    """Keeps one SymbolDeltaTracker running per actively-tracked spot symbol, starting/stopping
    trackers as the tracked-symbol set changes (mirrors the same watchlist-plus-top-volume set the
    candle scheduler already tracks).
    """

    def __init__(self) -> None:
        self._trackers: dict[str, SymbolDeltaTracker] = {}

    def sync_tracked_symbols(self, spot_symbols: set[str]) -> None:
        for symbol in list(self._trackers):
            if symbol not in spot_symbols:
                self._trackers.pop(symbol).stop()
        for symbol in spot_symbols:
            if symbol not in self._trackers:
                tracker = SymbolDeltaTracker(symbol)
                tracker.start()
                self._trackers[symbol] = tracker

    def stop_all(self) -> None:
        for tracker in self._trackers.values():
            tracker.stop()
        self._trackers.clear()


delta_manager = DeltaManager()

# The sync loop runs as its own asyncio task (not an APScheduler job) because APScheduler's
# BackgroundScheduler executes jobs on a separate worker thread, and asyncio.create_task requires
# a running event loop on the calling thread — bridging that would need run_coroutine_threadsafe
# for no real benefit, since this can just live directly on the same event loop as the trackers
# it's starting.
SYNC_INTERVAL_SECONDS = 60
_sync_task: asyncio.Task | None = None


def _fetch_tracked_spot_symbols() -> set[str]:
    from app.services.scheduler import _tracked_symbols

    db = SessionLocal()
    try:
        return {symbol for symbol, market_type in _tracked_symbols(db) if market_type == "spot"}
    finally:
        db.close()


async def _periodic_sync() -> None:
    while True:
        try:
            symbols = _fetch_tracked_spot_symbols()
            delta_manager.sync_tracked_symbols(symbols)
        except Exception:
            logger.exception("Delta tracker sync failed")
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)


def start_delta_tracking() -> None:
    global _sync_task
    if _sync_task is None or _sync_task.done():
        _sync_task = asyncio.create_task(_periodic_sync())


def stop_delta_tracking() -> None:
    global _sync_task
    if _sync_task is not None:
        _sync_task.cancel()
        _sync_task = None
    delta_manager.stop_all()
