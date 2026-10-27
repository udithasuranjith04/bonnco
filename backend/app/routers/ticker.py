from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.exchange.base import MARKET_TYPES
from app.services.ticker_stream import ticker_hub

router = APIRouter(tags=["ticker"])


@router.websocket("/ws/ticker")
async def ws_ticker(websocket: WebSocket, symbol: str, market_type: str = "spot"):
    if market_type not in MARKET_TYPES:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    await ticker_hub.subscribe(websocket, symbol, market_type)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await ticker_hub.unsubscribe(websocket, symbol, market_type)
