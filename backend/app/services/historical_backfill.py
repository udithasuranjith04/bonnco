"""One-time bulk historical pull (not a live stream): backfills years of real Binance kline history
into the existing `candles` table, then derives per-candle 'market fingerprints' (RSI/trend/volume/
Bollinger + real realized forward return) from that same stored history for later similarity search.
Every value here comes from candles actually pulled and stored — nothing is estimated or invented.

Run directly: `python -m app.services.historical_backfill`
"""

import logging
from datetime import datetime, timedelta

import pandas as pd
import pandas_ta as ta
from sqlalchemy import select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models.candle import Candle
from app.models.market_fingerprint import MarketFingerprint
from app.models.watchlist import WatchlistItem
from app.services.candle_ingest import upsert_candles
from app.services.exchange.base import ExchangeAdapter
from app.services.exchange.factory import get_exchange_adapter
from app.services.indicators import MIN_CANDLES

logger = logging.getLogger("bonnco.historical_backfill")

CORE_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
BACKFILL_TIMEFRAMES = ["4h", "1d"]
BACKFILL_YEARS = 3
FORWARD_HORIZON_DAYS = 7

# Bars per day, used to convert the forward horizon into a candle-count shift per timeframe.
_BARS_PER_DAY = {"4h": 6, "1d": 1}


def _backfill_targets(db: Session) -> list[tuple[str, str]]:
    """Core majors on spot (so there's always a baseline even before the user has a watchlist) plus
    every real enabled watchlist (symbol, market_type) pair, so fingerprints exist for exactly the
    market_type each coin is actually tracked/traded on.
    """
    watchlist_items = db.scalars(select(WatchlistItem).where(WatchlistItem.enabled.is_(True))).all()
    pairs = {(item.symbol, item.market_type) for item in watchlist_items}
    pairs.update((symbol, "spot") for symbol in CORE_SYMBOLS)
    return sorted(pairs)


def backfill_candle_history(
    db: Session, adapter: ExchangeAdapter, symbol: str, market_type: str, timeframe: str, years: int = BACKFILL_YEARS
) -> int:
    """Paginates backward from now using Binance's endTime param (1000 candles per request, the
    exchange's cap) until reaching the target lookback window or Binance has no older data left.
    """
    cutoff = datetime.utcnow() - timedelta(days=365 * years)
    end_time: datetime | None = None
    total = 0
    earliest_seen: datetime | None = None

    while True:
        candles = adapter.get_klines(symbol, timeframe, market_type, limit=1000, end_time=end_time)
        if not candles:
            break

        total += upsert_candles(db, symbol, market_type, timeframe, candles)
        batch_earliest = min(c.open_time for c in candles)

        if earliest_seen is not None and batch_earliest >= earliest_seen:
            break  # Binance returned no older data than the previous page, stop rather than loop forever
        earliest_seen = batch_earliest

        if batch_earliest <= cutoff:
            break
        end_time = batch_earliest - timedelta(seconds=1)

    logger.info(
        "Backfilled %d candles for %s %s %s, earliest reached: %s", total, symbol, market_type, timeframe, earliest_seen
    )
    return total


def _trend_label(price: float, ema50: float, ema200: float) -> str:
    if price > ema50 > ema200:
        return "uptrend"
    if price < ema50 < ema200:
        return "downtrend"
    return "mixed"


def compute_fingerprints(
    db: Session, symbol: str, market_type: str, timeframe: str, horizon_days: int = FORWARD_HORIZON_DAYS
) -> int:
    """Computes one fingerprint row per historical candle directly from the real candle history
    already stored in MySQL for this symbol/market_type/timeframe. `forward_return_pct` is the real
    realized price change over the following `horizon_days`, left null for candles too recent for
    that window to have actually happened yet.
    """
    rows = db.scalars(
        select(Candle)
        .where(Candle.symbol == symbol, Candle.market_type == market_type, Candle.timeframe == timeframe)
        .order_by(Candle.open_time.asc())
    ).all()
    if len(rows) < MIN_CANDLES:
        logger.warning(
            "Not enough candles to fingerprint %s %s %s (%d rows, need %d)",
            symbol, market_type, timeframe, len(rows), MIN_CANDLES,
        )
        return 0

    bars_per_day = _BARS_PER_DAY.get(timeframe)
    if bars_per_day is None:
        raise ValueError(f"No forward-return bar mapping configured for timeframe {timeframe!r}")
    horizon_bars = horizon_days * bars_per_day

    df = pd.DataFrame(
        {
            "open_time": [r.open_time for r in rows],
            "close": [r.close for r in rows],
            "volume": [r.volume for r in rows],
        }
    )

    rsi = ta.rsi(df["close"], length=14)
    ema50 = ta.ema(df["close"], length=50)
    ema200 = ta.ema(df["close"], length=200)
    bb = ta.bbands(df["close"], length=20, std=2)
    bb_lower, bb_upper = bb.iloc[:, 0], bb.iloc[:, 2]
    percent_b = (df["close"] - bb_lower) / (bb_upper - bb_lower)
    volume_ratio = df["volume"] / df["volume"].rolling(20).mean()
    forward_return_pct = (df["close"].shift(-horizon_bars) - df["close"]) / df["close"] * 100

    fingerprint_rows = []
    for i in range(len(df)):
        if pd.isna(rsi.iloc[i]) or pd.isna(ema200.iloc[i]) or pd.isna(percent_b.iloc[i]) or pd.isna(volume_ratio.iloc[i]):
            continue  # indicator warm-up period, not enough history yet for a real reading

        fwd = forward_return_pct.iloc[i]
        fingerprint_rows.append(
            {
                "symbol": symbol,
                "market_type": market_type,
                "timeframe": timeframe,
                "open_time": df["open_time"].iloc[i],
                "close_price": float(df["close"].iloc[i]),
                "rsi": round(float(rsi.iloc[i]), 2),
                "trend": _trend_label(float(df["close"].iloc[i]), float(ema50.iloc[i]), float(ema200.iloc[i])),
                "volume_ratio": round(float(volume_ratio.iloc[i]), 3),
                "bb_percent_b": round(float(percent_b.iloc[i]), 3),
                "forward_horizon_days": horizon_days,
                "forward_return_pct": None if pd.isna(fwd) else round(float(fwd), 3),
            }
        )

    if not fingerprint_rows:
        return 0

    stmt = mysql_insert(MarketFingerprint).values(fingerprint_rows)
    stmt = stmt.on_duplicate_key_update(
        close_price=stmt.inserted.close_price,
        rsi=stmt.inserted.rsi,
        trend=stmt.inserted.trend,
        volume_ratio=stmt.inserted.volume_ratio,
        bb_percent_b=stmt.inserted.bb_percent_b,
        forward_horizon_days=stmt.inserted.forward_horizon_days,
        forward_return_pct=stmt.inserted.forward_return_pct,
    )
    db.execute(stmt)
    db.commit()
    return len(fingerprint_rows)


def run_full_backfill(years: int = BACKFILL_YEARS, horizon_days: int = FORWARD_HORIZON_DAYS) -> dict[str, dict[str, int]]:
    """Candles first, then fingerprints computed from what was just stored. Both steps upsert
    idempotently, so this is safe to re-run later to extend coverage or add newly-watchlisted coins.
    """
    db = SessionLocal()
    adapter = get_exchange_adapter()
    summary: dict[str, dict[str, int]] = {}
    try:
        targets = _backfill_targets(db)
        logger.info("Starting historical backfill for %d symbol/market pairs across %s", len(targets), BACKFILL_TIMEFRAMES)
        for symbol, market_type in targets:
            for timeframe in BACKFILL_TIMEFRAMES:
                try:
                    candle_count = backfill_candle_history(db, adapter, symbol, market_type, timeframe, years=years)
                    fingerprint_count = compute_fingerprints(db, symbol, market_type, timeframe, horizon_days=horizon_days)
                    summary[f"{symbol}:{market_type}:{timeframe}"] = {
                        "candles": candle_count,
                        "fingerprints": fingerprint_count,
                    }
                except Exception:
                    logger.exception("Backfill failed for %s %s %s", symbol, market_type, timeframe)
    finally:
        db.close()
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = run_full_backfill()
    for key, counts in result.items():
        print(f"{key}: {counts}")
