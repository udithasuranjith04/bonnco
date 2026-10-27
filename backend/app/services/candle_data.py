import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candle import Candle


class InsufficientDataError(Exception):
    pass


def load_candle_df(
    db: Session,
    symbol: str,
    market_type: str,
    timeframe: str,
    limit: int = 500,
    min_candles: int = 210,
) -> pd.DataFrame:
    """Shared candle loader used by both the indicator engine and the pattern detector, so they
    always read the exact same underlying data rather than two slightly different queries drifting
    apart over time.
    """
    rows = db.scalars(
        select(Candle)
        .where(Candle.symbol == symbol, Candle.market_type == market_type, Candle.timeframe == timeframe)
        .order_by(Candle.open_time.desc())
        .limit(limit)
    ).all()
    rows = list(reversed(rows))
    if len(rows) < min_candles:
        raise InsufficientDataError(
            f"Only {len(rows)} candles stored for {symbol} {market_type} {timeframe}, need at least {min_candles}"
        )
    return pd.DataFrame(
        {
            "open_time": [r.open_time for r in rows],
            "open": [r.open for r in rows],
            "high": [r.high for r in rows],
            "low": [r.low for r in rows],
            "close": [r.close for r in rows],
            "volume": [r.volume for r in rows],
            "buy_volume": [r.buy_volume for r in rows],
            "sell_volume": [r.sell_volume for r in rows],
            "delta": [r.delta for r in rows],
        }
    )
