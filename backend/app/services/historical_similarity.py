"""Compares the live technical setup against real backfilled historical fingerprints (see
`historical_backfill.py`) to surface genuinely similar past periods and what price actually did
afterward. Every number here traces back to real stored candle history — never invented — and a
match is only ever returned when it's actually close by the distance threshold below; otherwise
this returns None so callers can honestly say no strong historical parallel was found rather than
forcing a comparison.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market_fingerprint import MarketFingerprint

# Don't match against fingerprints from very recently — that would just be "a few candles ago",
# not a genuinely separate historical period worth surfacing as a parallel.
MIN_AGE_HORIZON_MULTIPLIER = 3

# Tuned so a match requires the trend to match exactly (hard filter, see below) plus RSI within
# roughly 15 points, Bollinger %B within roughly 0.25, and volume ratio within roughly 0.6 of each
# other, or a tighter match on some dimensions offsetting a bit of slack on others.
RSI_SCALE = 25.0
BB_SCALE = 0.5
VOLUME_SCALE = 1.2
DISTANCE_THRESHOLD = 0.3


@dataclass
class SimilarityMatch:
    open_time: datetime
    close_price: float
    rsi: float
    trend: str
    volume_ratio: float
    forward_return_pct: float
    forward_horizon_days: int
    distance: float


def trend_from_price_emas(price: float, ema50: float, ema200: float) -> str:
    """Same trend classification used when building the historical fingerprints (see
    `historical_backfill._trend_label`), so a live reading and a stored fingerprint are always
    compared on identical terms.
    """
    if price > ema50 > ema200:
        return "uptrend"
    if price < ema50 < ema200:
        return "downtrend"
    return "mixed"


def find_similar_period(
    db: Session,
    symbol: str,
    market_type: str,
    timeframe: str,
    rsi: float,
    trend: str,
    volume_ratio: float,
    bb_percent_b: float,
) -> SimilarityMatch | None:
    """Real similarity search over this exact symbol/market_type/timeframe's stored fingerprint
    history. Returns the closest genuine match, or None when nothing stored is actually close.
    """
    current_rsi = float(rsi)
    current_bb = float(bb_percent_b)
    current_vol = float(volume_ratio)

    min_age_cutoff = datetime.utcnow() - timedelta(days=7 * MIN_AGE_HORIZON_MULTIPLIER)

    candidates = db.scalars(
        select(MarketFingerprint).where(
            MarketFingerprint.symbol == symbol,
            MarketFingerprint.market_type == market_type,
            MarketFingerprint.timeframe == timeframe,
            MarketFingerprint.trend == trend,
            MarketFingerprint.forward_return_pct.is_not(None),
            MarketFingerprint.open_time <= min_age_cutoff,
        )
    ).all()

    best: SimilarityMatch | None = None
    for row in candidates:
        rsi_diff = min(abs(current_rsi - row.rsi) / RSI_SCALE, 1.0)
        bb_diff = min(abs(current_bb - row.bb_percent_b) / BB_SCALE, 1.0)
        vol_diff = min(abs(current_vol - row.volume_ratio) / VOLUME_SCALE, 1.0)
        distance = 0.5 * rsi_diff + 0.3 * bb_diff + 0.2 * vol_diff

        if best is None or distance < best.distance:
            best = SimilarityMatch(
                open_time=row.open_time,
                close_price=row.close_price,
                rsi=row.rsi,
                trend=row.trend,
                volume_ratio=row.volume_ratio,
                forward_return_pct=row.forward_return_pct,
                forward_horizon_days=row.forward_horizon_days,
                distance=distance,
            )

    if best is None or best.distance > DISTANCE_THRESHOLD:
        return None
    return best


def describe_similarity_match(symbol: str, match: SimilarityMatch) -> str:
    """Human-readable framing that always presents this as what happened last time, never as a
    prediction of what will happen now — matching the honesty framing used elsewhere in the app.
    """
    when = match.open_time.strftime("%B %Y")
    direction = "gain" if match.forward_return_pct >= 0 else "decline"
    return (
        f"Historical parallel: {symbol}'s current setup (RSI {round(match.rsi)}, {match.trend}) resembles "
        f"conditions from {when}, which preceded a {abs(match.forward_return_pct):.1f}% {direction} over the "
        f"following {match.forward_horizon_days} days. This is what happened last time something like this "
        f"occurred, not a prediction of what will happen now, and it's a single historical instance, not a "
        f"repeated pattern."
    )
