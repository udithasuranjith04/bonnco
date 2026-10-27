from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.orm import Session

from app.models.candle import Candle
from app.services.exchange.base import CandleData, ExchangeAdapter


def upsert_candles(db: Session, symbol: str, market_type: str, timeframe: str, candles: list[CandleData]) -> int:
    """Shared upsert used by both live ingestion and historical backfill, safe to call repeatedly
    on overlapping ranges since it keys on the (symbol, market_type, timeframe, open_time) unique
    index rather than assuming the caller de-duplicated first.
    """
    if not candles:
        return 0

    rows = [
        {
            "symbol": symbol,
            "market_type": market_type,
            "timeframe": timeframe,
            "open_time": c.open_time,
            "close_time": c.close_time,
            "open": c.open,
            "high": c.high,
            "low": c.low,
            "close": c.close,
            "volume": c.volume,
        }
        for c in candles
    ]

    stmt = mysql_insert(Candle).values(rows)
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
    return len(rows)


def ingest_candles(
    db: Session,
    adapter: ExchangeAdapter,
    symbol: str,
    market_type: str,
    timeframe: str,
    limit: int = 500,
) -> int:
    candles = adapter.get_klines(symbol, timeframe, market_type, limit=limit)
    return upsert_candles(db, symbol, market_type, timeframe, candles)
