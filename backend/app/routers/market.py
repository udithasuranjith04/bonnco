from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.candle import Candle
from app.schemas.market import BackfillRequest, CandleOut, FuturesInfoOut, PriceOut, TickerSnapshotOut, TopSymbolOut
from app.services.candle_ingest import ingest_candles
from app.services.exchange.base import TIMEFRAMES
from app.services.exchange.factory import get_exchange_adapter

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/timeframes")
def list_timeframes():
    return TIMEFRAMES


@router.post("/backfill")
def backfill(payload: BackfillRequest, db: Session = Depends(get_db)):
    if payload.timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"timeframe must be one of {TIMEFRAMES}")

    adapter = get_exchange_adapter()
    symbol = payload.symbol.upper()
    try:
        count = ingest_candles(db, adapter, symbol, payload.market_type, payload.timeframe, payload.limit)
    except Exception as exc:  # noqa: BLE001 upstream exchange/network errors surfaced as 502
        raise HTTPException(status_code=502, detail=f"Failed to fetch from exchange: {exc}") from exc

    return {"symbol": symbol, "market_type": payload.market_type, "timeframe": payload.timeframe, "stored": count}


@router.get("/candles", response_model=list[CandleOut])
def get_candles(
    symbol: str,
    market_type: Literal["spot", "futures"] = "spot",
    timeframe: str = "1h",
    limit: int = Query(default=200, le=1000),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(Candle)
        .where(
            Candle.symbol == symbol.upper(),
            Candle.market_type == market_type,
            Candle.timeframe == timeframe,
        )
        .order_by(Candle.open_time.desc())
        .limit(limit)
    ).all()
    return list(reversed(rows))


@router.get("/price/{symbol}", response_model=PriceOut)
def get_price(symbol: str, market_type: Literal["spot", "futures"] = "spot"):
    adapter = get_exchange_adapter()
    try:
        price = adapter.get_current_price(symbol.upper(), market_type)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to fetch price: {exc}") from exc
    return PriceOut(symbol=symbol.upper(), market_type=market_type, price=price)


@router.get("/ticker/{symbol}", response_model=TickerSnapshotOut)
def get_ticker(symbol: str, market_type: Literal["spot", "futures"] = "spot"):
    adapter = get_exchange_adapter()
    try:
        snap = adapter.get_ticker_snapshot(symbol.upper(), market_type)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to fetch ticker: {exc}") from exc
    return TickerSnapshotOut(
        symbol=snap.symbol,
        market_type=market_type,
        price=snap.price,
        price_change_percent=snap.price_change_percent,
        high_24h=snap.high_24h,
        low_24h=snap.low_24h,
        volume_24h=snap.volume_24h,
    )


@router.get("/futures-info/{symbol}", response_model=FuturesInfoOut)
def get_futures_info(symbol: str):
    adapter = get_exchange_adapter()
    try:
        info = adapter.get_futures_info(symbol.upper())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to fetch futures info: {exc}") from exc
    return FuturesInfoOut(
        symbol=symbol.upper(),
        mark_price=info.mark_price,
        index_price=info.index_price,
        last_funding_rate=info.last_funding_rate,
        next_funding_time=info.next_funding_time,
    )


@router.get("/top-symbols", response_model=list[TopSymbolOut])
def get_top_symbols(market_type: Literal["spot", "futures"] = "spot", limit: int = Query(default=15, le=50)):
    adapter = get_exchange_adapter()
    try:
        tickers = adapter.get_top_symbols_by_volume(market_type, limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to fetch top symbols: {exc}") from exc

    return [
        TopSymbolOut(symbol=t.symbol, price=t.price, price_change_percent=t.price_change_percent, volume_24h=t.volume_24h)
        for t in tickers
    ]


@router.get("/search-symbols", response_model=list[TopSymbolOut])
def search_symbols(
    q: str,
    market_type: Literal["spot", "futures"] = "spot",
    limit: int = Query(default=10, le=25),
):
    if not q.strip():
        return []

    adapter = get_exchange_adapter()
    try:
        tickers = adapter.search_symbols(market_type, q, limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Failed to search symbols: {exc}") from exc

    return [
        TopSymbolOut(symbol=t.symbol, price=t.price, price_change_percent=t.price_change_percent, volume_24h=t.volume_24h)
        for t in tickers
    ]
