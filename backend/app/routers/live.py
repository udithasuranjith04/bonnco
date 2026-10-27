from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.exchange.base import MARKET_TYPES, TIMEFRAMES
from app.services.live_stream import live_stream_hub

router = APIRouter(tags=["live"])


@router.websocket("/ws/candles")
async def ws_candles(websocket: WebSocket, symbol: str, market_type: str = "spot", timeframe: str = "1h"):
    if market_type not in MARKET_TYPES or timeframe not in TIMEFRAMES:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    await live_stream_hub.subscribe(websocket, symbol, market_type, timeframe)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await live_stream_hub.unsubscribe(websocket, symbol, market_type, timeframe)
