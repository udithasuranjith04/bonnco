import logging

from sqlalchemy.orm import Session

from app.services.candle_data import load_candle_df
from patterns.candlesticks import detect_doji, detect_engulfing, detect_hammer_at_support, detect_shooting_star_at_resistance
from patterns.continuation import detect_flag, detect_triangle_or_wedge
from patterns.models import DetectedPattern
from patterns.reversal import (
    detect_double_bottom,
    detect_double_top,
    detect_head_and_shoulders,
    detect_inverse_head_and_shoulders,
    detect_triple_bottom,
    detect_triple_top,
)
from patterns.swings import find_swings

logger = logging.getLogger("bonnco.patterns")

# Patterns need meaningfully fewer candles than the indicator engine (no EMA200 requirement), but
# still enough history for a handful of significant swing points to have formed.
PATTERN_MIN_CANDLES = 60
PATTERN_LOOKBACK_CANDLES = 300
SWING_WINDOW = 3

# If the runner-up pattern's completeness is within this of the headline's, it's genuinely close
# enough to be worth a minor mention rather than silently dropped.
SECONDARY_COMPLETENESS_GAP = 0.15


def detect_patterns(db: Session, symbol: str, market_type: str, timeframe: str) -> list[DetectedPattern]:
    """Scans stored candle data (the same source the indicator engine reads from) for every
    supported chart and candlestick pattern. Each detector is independent and failure-isolated —
    one buggy detector can't take down the rest of the scan.
    """
    df = load_candle_df(db, symbol, market_type, timeframe, limit=PATTERN_LOOKBACK_CANDLES, min_candles=PATTERN_MIN_CANDLES)
    swing_highs, swing_lows = find_swings(df, window=SWING_WINDOW)

    detectors = [
        lambda: detect_head_and_shoulders(df, swing_highs, swing_lows, symbol, market_type, timeframe),
        lambda: detect_inverse_head_and_shoulders(df, swing_highs, swing_lows, symbol, market_type, timeframe),
        lambda: detect_double_top(df, swing_highs, symbol, market_type, timeframe),
        lambda: detect_double_bottom(df, swing_lows, symbol, market_type, timeframe),
        lambda: detect_triple_top(df, swing_highs, symbol, market_type, timeframe),
        lambda: detect_triple_bottom(df, swing_lows, symbol, market_type, timeframe),
        lambda: detect_triangle_or_wedge(df, swing_highs, swing_lows, symbol, market_type, timeframe),
        lambda: detect_flag(df, symbol, market_type, timeframe),
        lambda: detect_engulfing(df, symbol, market_type, timeframe),
        lambda: detect_doji(df, symbol, market_type, timeframe),
        lambda: detect_hammer_at_support(df, swing_lows, symbol, market_type, timeframe),
        lambda: detect_shooting_star_at_resistance(df, swing_highs, symbol, market_type, timeframe),
    ]

    results: list[DetectedPattern] = []
    for detector in detectors:
        try:
            found = detector()
        except Exception:
            logger.exception("Pattern detector failed for %s %s %s", symbol, market_type, timeframe)
            continue
        if found is not None:
            results.append(found)

    return results


def select_headline_pattern(patterns: list[DetectedPattern]) -> tuple[DetectedPattern | None, DetectedPattern | None]:
    """It's common for several patterns to match at once (e.g. a double-top cluster and a
    double-bottom cluster can both legitimately exist in the same swing history). Surfacing all of
    them reads as clutter, not a signal — so this ranks by completeness (confirmed patterns first,
    since a completed breakout is a more decisive read than a still-forming shape) and returns one
    clear headline, plus a secondary only when it's genuinely close enough in completeness to be
    worth a minor mention rather than noise.
    """
    if not patterns:
        return None, None

    ranked = sorted(patterns, key=lambda p: (p.confirmed, p.completeness), reverse=True)
    headline = ranked[0]
    secondary = None
    if len(ranked) > 1 and headline.completeness - ranked[1].completeness <= SECONDARY_COMPLETENESS_GAP:
        secondary = ranked[1]

    return headline, secondary
