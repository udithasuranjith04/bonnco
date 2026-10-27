import asyncio
import json
import logging
from datetime import datetime, timezone

import websockets

from app.db import SessionLocal
from app.models.liquidation import Liquidation

logger = logging.getLogger("bonnco.liquidation_stream")

# Binance's exchange-wide forced-order stream — every liquidation across all futures symbols,
# not per-symbol like the candle/ticker relays, so this runs as one persistent listener for the
# whole process lifetime rather than being subscriber-driven.
LIQUIDATION_STREAM_URL = "wss://fstream.binance.com/ws/!forceOrder@arr"

_listener_task: asyncio.Task | None = None


def _to_dt(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None)


def _parse_event(raw: dict) -> Liquidation | None:
    """Defensive on purpose: this parses a stream shape confirmed against Binance's own docs, but
    if Binance ever changes the payload, this should log the raw event and skip it rather than
    crash the whole listener loop over one malformed message.
    """
    try:
        order = raw["o"]
        price = float(order["p"])
        quantity = float(order["q"])
        return Liquidation(
            symbol=order["s"],
            side=order["S"],
            price=price,
            quantity=quantity,
            quote_quantity=price * quantity,
            event_time=_to_dt(int(order["T"])),
        )
    except (KeyError, ValueError, TypeError):
        logger.exception("Failed to parse liquidation event, raw payload: %s", raw)
        return None


async def _run_listener() -> None:
    while True:
        try:
            async with websockets.connect(LIQUIDATION_STREAM_URL, ping_interval=20) as upstream:
                logger.info("Liquidation stream connected")
                async for raw in upstream:
                    try:
                        data = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    entry = _parse_event(data)
                    if entry is None:
                        continue
                    db = SessionLocal()
                    try:
                        db.add(entry)
                        db.commit()
                    except Exception:
                        logger.exception("Failed to store liquidation event for %s", entry.symbol)
                        db.rollback()
                    finally:
                        db.close()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Liquidation stream error, reconnecting in 5s")
            await asyncio.sleep(5)


def start_liquidation_listener() -> None:
    global _listener_task
    if _listener_task is not None and not _listener_task.done():
        return
    _listener_task = asyncio.create_task(_run_listener())


def stop_liquidation_listener() -> None:
    global _listener_task
    if _listener_task is not None:
        _listener_task.cancel()
        _listener_task = None
