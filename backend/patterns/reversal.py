import pandas as pd

from patterns.format import fmt_price as _fmt
from patterns.models import DetectedPattern
from patterns.swings import SwingPoint

# Shoulders / tops / bottoms are considered "matching" within this % of each other.
LEVEL_TOLERANCE = 0.04
# The head (or middle trough, for a triple) must clear the shoulders by at least this much.
HEAD_MARGIN = 0.015
# A pullback between two peaks/troughs must retrace at least this much to count as a genuine
# swing rather than noise — otherwise almost any two nearby closes would qualify as a "double top".
MIN_PULLBACK = 0.02


def _hs_generic(
    swings: list[SwingPoint],
    opposite_swings: list[SwingPoint],
    symbol: str,
    market_type: str,
    timeframe: str,
    df: pd.DataFrame,
    bullish: bool,
) -> DetectedPattern | None:
    """Shared logic for Head & Shoulders (bullish=False, built from swing highs) and Inverse Head
    & Shoulders (bullish=True, built from swing lows). The extreme in the middle (head) must be
    more extreme than both flanking shoulders, which must be roughly level with each other.
    """
    if len(swings) < 3:
        return None
    left, head, right = swings[-3], swings[-2], swings[-1]

    if bullish:
        head_clears = head.price < left.price * (1 - HEAD_MARGIN) and head.price < right.price * (1 - HEAD_MARGIN)
    else:
        head_clears = head.price > left.price * (1 + HEAD_MARGIN) and head.price > right.price * (1 + HEAD_MARGIN)
    if not head_clears:
        return None

    shoulder_avg = (left.price + right.price) / 2
    if abs(left.price - right.price) / shoulder_avg > LEVEL_TOLERANCE:
        return None

    neck1_candidates = [s for s in opposite_swings if left.index < s.index < head.index]
    neck2_candidates = [s for s in opposite_swings if head.index < s.index < right.index]
    if not neck1_candidates or not neck2_candidates:
        return None

    if bullish:
        neck1 = max(neck1_candidates, key=lambda s: s.price)
        neck2 = max(neck2_candidates, key=lambda s: s.price)
    else:
        neck1 = min(neck1_candidates, key=lambda s: s.price)
        neck2 = min(neck2_candidates, key=lambda s: s.price)

    neckline = (neck1.price + neck2.price) / 2
    last_close = float(df["close"].iloc[-1])
    confirmed = last_close > neckline if bullish else last_close < neckline
    completeness = 1.0 if confirmed else 0.8

    direction = "above" if bullish else "below"
    shape = "troughs" if bullish else "peaks"
    pattern_name = "inverse_head_and_shoulders" if bullish else "head_and_shoulders"

    interpretation = (
        f"Three {'troughs' if bullish else 'peaks'} formed on {symbol} ({timeframe}): a left shoulder near "
        f"{_fmt(left.price)}, a {'deeper' if bullish else 'higher'} head near {_fmt(head.price)}, and a right "
        f"shoulder near {_fmt(right.price)} that failed to {'undercut' if bullish else 'exceed'} the head. "
        f"The neckline sits around {_fmt(neckline)}. "
        + (
            f"Price has closed {direction} the neckline, confirming the breakout."
            if confirmed
            else f"Price has not yet closed {direction} the neckline, so the pattern isn't confirmed."
        )
        + f" {'Inverse head and shoulders' if bullish else 'Head and shoulders'} patterns are a well-established "
        + f"{'bullish' if bullish else 'bearish'} reversal signal, though not a guaranteed outcome."
    )

    return DetectedPattern(
        pattern=pattern_name,
        category="reversal",
        bias="bullish" if bullish else "bearish",
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        completeness=completeness,
        confirmed=confirmed,
        price_low=min(head.price, neckline) if bullish else neckline,
        price_high=neckline if bullish else max(head.price, neckline),
        range_start=left.open_time,
        range_end=df["open_time"].iloc[-1],
        key_points=[
            {"open_time": left.open_time.isoformat(), "price": left.price, "label": "left_shoulder"},
            {"open_time": neck1.open_time.isoformat(), "price": neck1.price, "label": "neckline_1"},
            {"open_time": head.open_time.isoformat(), "price": head.price, "label": "head"},
            {"open_time": neck2.open_time.isoformat(), "price": neck2.price, "label": "neckline_2"},
            {"open_time": right.open_time.isoformat(), "price": right.price, "label": "right_shoulder"},
        ],
        interpretation=interpretation,
    )


def detect_head_and_shoulders(
    df: pd.DataFrame, swing_highs: list[SwingPoint], swing_lows: list[SwingPoint], symbol: str, market_type: str, timeframe: str
) -> DetectedPattern | None:
    return _hs_generic(swing_highs, swing_lows, symbol, market_type, timeframe, df, bullish=False)


def detect_inverse_head_and_shoulders(
    df: pd.DataFrame, swing_highs: list[SwingPoint], swing_lows: list[SwingPoint], symbol: str, market_type: str, timeframe: str
) -> DetectedPattern | None:
    return _hs_generic(swing_lows, swing_highs, symbol, market_type, timeframe, df, bullish=True)


def _multi_top_bottom_generic(
    swings: list[SwingPoint],
    count: int,
    symbol: str,
    market_type: str,
    timeframe: str,
    df: pd.DataFrame,
    bullish: bool,
) -> DetectedPattern | None:
    """Shared logic for double/triple top (bullish=False) and double/triple bottom (bullish=True):
    `count` swing extremes within LEVEL_TOLERANCE of each other, with a genuine pullback between
    each consecutive pair, confirmed by a close beyond the shallowest of the pullbacks.
    """
    if len(swings) < count:
        return None
    points = swings[-count:]
    avg = sum(p.price for p in points) / count
    if any(abs(p.price - avg) / avg > LEVEL_TOLERANCE for p in points):
        return None

    # Between each consecutive pair of tops, the relevant pullback is how far price bounced (its
    # high); between each pair of bottoms, it's how far price dipped (its low).
    segments = [df.iloc[a.index : b.index + 1] for a, b in zip(points, points[1:])]
    if bullish:
        pullback_prices = [float(seg["high"].max()) for seg in segments]
        gaps = [(pb - avg) / avg for pb in pullback_prices]
    else:
        pullback_prices = [float(seg["low"].min()) for seg in segments]
        gaps = [(avg - pb) / avg for pb in pullback_prices]

    if any(gap < MIN_PULLBACK for gap in gaps):
        return None

    trigger_level = min(pullback_prices) if bullish else max(pullback_prices)
    last_close = float(df["close"].iloc[-1])
    confirmed = last_close > trigger_level if bullish else last_close < trigger_level
    completeness = 1.0 if confirmed else 0.8

    word = "bottom" if bullish else "top"
    name_prefix = {2: "double", 3: "triple"}[count]
    level_desc = ", ".join(_fmt(p.price) for p in points)

    interpretation = (
        f"{name_prefix.capitalize()} {word} on {symbol} ({timeframe}): {count} {'troughs' if bullish else 'peaks'} "
        f"near {level_desc}, each within {int(LEVEL_TOLERANCE * 100)}% of the others. "
        + (
            f"Price has closed {'above' if bullish else 'below'} {_fmt(trigger_level)}, confirming the breakout."
            if confirmed
            else f"Price hasn't yet closed {'above' if bullish else 'below'} {_fmt(trigger_level)}, so it isn't confirmed."
        )
        + f" A {name_prefix} {word} is a well-established {'bullish' if bullish else 'bearish'} reversal signal, "
        + "though not a guaranteed outcome, and a tested level held multiple times carries more weight than a single failed attempt."
    )

    return DetectedPattern(
        pattern=f"{name_prefix}_{word}",
        category="reversal",
        bias="bullish" if bullish else "bearish",
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        completeness=completeness,
        confirmed=confirmed,
        price_low=trigger_level if bullish else min(p.price for p in points),
        price_high=max(p.price for p in points) if bullish else trigger_level,
        range_start=points[0].open_time,
        range_end=df["open_time"].iloc[-1],
        key_points=[{"open_time": p.open_time.isoformat(), "price": p.price, "label": f"{word}_{i + 1}"} for i, p in enumerate(points)],
        interpretation=interpretation,
    )


def detect_double_top(df: pd.DataFrame, swing_highs: list[SwingPoint], symbol: str, market_type: str, timeframe: str) -> DetectedPattern | None:
    return _multi_top_bottom_generic(swing_highs, 2, symbol, market_type, timeframe, df, bullish=False)


def detect_double_bottom(df: pd.DataFrame, swing_lows: list[SwingPoint], symbol: str, market_type: str, timeframe: str) -> DetectedPattern | None:
    return _multi_top_bottom_generic(swing_lows, 2, symbol, market_type, timeframe, df, bullish=True)


def detect_triple_top(df: pd.DataFrame, swing_highs: list[SwingPoint], symbol: str, market_type: str, timeframe: str) -> DetectedPattern | None:
    return _multi_top_bottom_generic(swing_highs, 3, symbol, market_type, timeframe, df, bullish=False)


def detect_triple_bottom(df: pd.DataFrame, swing_lows: list[SwingPoint], symbol: str, market_type: str, timeframe: str) -> DetectedPattern | None:
    return _multi_top_bottom_generic(swing_lows, 3, symbol, market_type, timeframe, df, bullish=True)
