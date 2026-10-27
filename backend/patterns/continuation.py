import numpy as np
import pandas as pd

from patterns.format import fmt_price as _fmt
from patterns.models import DetectedPattern
from patterns.swings import SwingPoint

# Per-candle slope, normalized by average price, below which a trendline is considered "flat"
# for classifying triangle type.
FLAT_SLOPE = 0.0015
# How far back (in candles) to look for triangle/wedge trendlines.
TRIANGLE_LOOKBACK = 60

FLAGPOLE_MIN_MOVE = 0.06  # a flagpole needs at least a 6% move to count as "sharp"
FLAGPOLE_MAX_CANDLES = 8
FLAG_MAX_CANDLES = 14
FLAG_MAX_RANGE_RATIO = 0.4  # the flag's consolidation range must be tighter than 40% of the pole's move


def _fit_line(points: list[SwingPoint]) -> tuple[float, float]:
    xs = np.array([p.index for p in points], dtype=float)
    ys = np.array([p.price for p in points], dtype=float)
    slope, intercept = np.polyfit(xs, ys, 1)
    return float(slope), float(intercept)


def detect_triangle_or_wedge(
    df: pd.DataFrame, swing_highs: list[SwingPoint], swing_lows: list[SwingPoint], symbol: str, market_type: str, timeframe: str
) -> DetectedPattern | None:
    cutoff = len(df) - TRIANGLE_LOOKBACK
    recent_highs = [s for s in swing_highs if s.index >= cutoff]
    recent_lows = [s for s in swing_lows if s.index >= cutoff]
    if len(recent_highs) < 2 or len(recent_lows) < 2:
        return None

    slope_high, intercept_high = _fit_line(recent_highs)
    slope_low, intercept_low = _fit_line(recent_lows)
    avg_price = float(df["close"].iloc[-TRIANGLE_LOOKBACK:].mean())
    norm_high = slope_high / avg_price
    norm_low = slope_low / avg_price

    pattern: str | None = None
    bias = "neutral"

    if abs(norm_high) < FLAT_SLOPE and norm_low > FLAT_SLOPE:
        pattern, bias = "ascending_triangle", "bullish"
    elif abs(norm_low) < FLAT_SLOPE and norm_high < -FLAT_SLOPE:
        pattern, bias = "descending_triangle", "bearish"
    elif norm_high < -FLAT_SLOPE and norm_low > FLAT_SLOPE:
        pattern, bias = "symmetrical_triangle", "neutral"
    elif norm_high > FLAT_SLOPE and norm_low > FLAT_SLOPE and norm_high < norm_low:
        pattern, bias = "rising_wedge", "bearish"
    elif norm_high < -FLAT_SLOPE and norm_low < -FLAT_SLOPE and norm_high < norm_low:
        pattern, bias = "falling_wedge", "bullish"

    if pattern is None:
        return None

    last_idx = len(df) - 1
    upper_now = slope_high * last_idx + intercept_high
    lower_now = slope_low * last_idx + intercept_low
    last_close = float(df["close"].iloc[-1])

    if pattern == "symmetrical_triangle":
        confirmed = last_close > upper_now or last_close < lower_now
        if confirmed:
            bias = "bullish" if last_close > upper_now else "bearish"
    elif bias == "bullish":
        confirmed = last_close > upper_now
    else:
        confirmed = last_close < lower_now

    first_idx = min(recent_highs[0].index, recent_lows[0].index)
    initial_width = abs((slope_high * first_idx + intercept_high) - (slope_low * first_idx + intercept_low))
    current_width = abs(upper_now - lower_now)
    convergence = 1 - min(1.0, current_width / initial_width) if initial_width > 0 else 0.0
    completeness = 1.0 if confirmed else round(min(0.9, 0.4 + convergence * 0.5), 2)

    label = pattern.replace("_", " ")
    shape_desc = {
        "ascending_triangle": "a flat resistance ceiling with rising higher lows underneath it",
        "descending_triangle": "a flat support floor with falling lower highs above it",
        "symmetrical_triangle": "converging highs and lows squeezing into a narrower range",
        "rising_wedge": "both highs and lows rising, but the lows rising faster and narrowing the range",
        "falling_wedge": "both highs and lows falling, but the highs falling faster and narrowing the range",
    }[pattern]

    interpretation = (
        f"{symbol} ({timeframe}) is showing {shape_desc}, consistent with a {label}. "
        + (
            f"Price has broken out {'above' if bias == 'bullish' else 'below'} the trendline, confirming the move."
            if confirmed
            else f"The trendlines haven't been broken yet, so the breakout direction isn't confirmed."
        )
        + f" This is typically read as a {bias if bias != 'neutral' else 'direction-agnostic'} "
        + ("continuation" if pattern not in ("rising_wedge", "falling_wedge") else "reversal")
        + " setup, though the breakout can fail, so it isn't a guaranteed outcome."
    )

    return DetectedPattern(
        pattern=pattern,
        category="continuation" if pattern not in ("rising_wedge", "falling_wedge") else "reversal",
        bias=bias,
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        completeness=completeness,
        confirmed=confirmed,
        price_low=min(lower_now, upper_now),
        price_high=max(lower_now, upper_now),
        range_start=df["open_time"].iloc[first_idx],
        range_end=df["open_time"].iloc[-1],
        key_points=[{"open_time": s.open_time.isoformat(), "price": s.price, "label": s.kind} for s in (recent_highs + recent_lows)],
        interpretation=interpretation,
    )


def detect_flag(df: pd.DataFrame, symbol: str, market_type: str, timeframe: str) -> DetectedPattern | None:
    """Scans recent candles for a sharp directional "flagpole" move followed by a tight, mild
    consolidation "flag". Brute-force over a small, bounded window (pole length x recency) since
    the candle count involved is tiny — not a performance concern.
    """
    close = df["close"]
    n = len(close)
    search_start = max(0, n - (FLAGPOLE_MAX_CANDLES + FLAG_MAX_CANDLES + 5))

    best: tuple[float, int, int, str] | None = None  # (completeness, pole_start_idx, pole_end_idx, direction)

    for pole_len in range(3, FLAGPOLE_MAX_CANDLES + 1):
        for pole_end in range(search_start + pole_len, n - 2):
            pole_start_price = float(close.iloc[pole_end - pole_len])
            pole_end_price = float(close.iloc[pole_end])
            if pole_start_price <= 0:
                continue
            move = (pole_end_price - pole_start_price) / pole_start_price
            if abs(move) < FLAGPOLE_MIN_MOVE:
                continue
            direction = "bullish" if move > 0 else "bearish"

            flag_closes = close.iloc[pole_end:n]
            if len(flag_closes) < 3:
                continue
            flag_range = float(flag_closes.max() - flag_closes.min())
            pole_range = abs(pole_end_price - pole_start_price)
            if pole_range <= 0 or flag_range > pole_range * FLAG_MAX_RANGE_RATIO:
                continue

            xs = np.arange(len(flag_closes))
            slope, _ = np.polyfit(xs, flag_closes.values, 1)
            # A genuine flag drifts flat-to-mildly-against the pole; a flag sloping WITH the pole at
            # meaningful length is really just continued momentum, not a pause.
            if len(flag_closes) > 4 and ((direction == "bullish" and slope > 0) or (direction == "bearish" and slope < 0)):
                continue

            candidate_completeness = min(0.85, 0.5 + (len(flag_closes) / FLAG_MAX_CANDLES) * 0.35)
            if best is None or candidate_completeness > best[0]:
                best = (candidate_completeness, pole_end - pole_len, pole_end, direction)

    if best is None:
        return None

    completeness, pole_start_idx, pole_end_idx, direction = best
    bullish = direction == "bullish"
    flag_high = float(df["high"].iloc[pole_end_idx:].max())
    flag_low = float(df["low"].iloc[pole_end_idx:].min())
    last_close = float(close.iloc[-1])
    confirmed = last_close > flag_high if bullish else last_close < flag_low
    completeness = 1.0 if confirmed else completeness

    pattern_name = "bull_flag" if bullish else "bear_flag"
    pole_start_price = float(close.iloc[pole_start_idx])
    pole_end_price = float(close.iloc[pole_end_idx])

    confirmation_text = (
        f" Price has broken {'above' if bullish else 'below'} the flag, confirming continuation."
        if confirmed
        else " The flag hasn't broken out yet, so continuation isn't confirmed."
    )
    tendency_text = (
        " Bull flags typically resolve upward on continuation, particularly with volume confirmation on breakout"
        if bullish
        else " Bear flags typically resolve downward on continuation, particularly with volume confirmation on breakdown"
    )
    interpretation = (
        f"{symbol} ({timeframe}) made a sharp {'rally' if bullish else 'drop'} from {_fmt(pole_start_price)} to "
        f"{_fmt(pole_end_price)}, then entered a tight, {'mild pullback' if bullish else 'mild bounce'} "
        f"consolidation (the flag)."
        + confirmation_text
        + tendency_text
        + ", though this is a probabilistic tendency, not a guaranteed outcome."
    )

    return DetectedPattern(
        pattern=pattern_name,
        category="continuation",
        bias=direction,
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        completeness=completeness,
        confirmed=confirmed,
        price_low=min(pole_start_price, pole_end_price, flag_low),
        price_high=max(pole_start_price, pole_end_price, flag_high),
        range_start=df["open_time"].iloc[pole_start_idx],
        range_end=df["open_time"].iloc[-1],
        key_points=[
            {"open_time": df["open_time"].iloc[pole_start_idx].isoformat(), "price": pole_start_price, "label": "pole_start"},
            {"open_time": df["open_time"].iloc[pole_end_idx].isoformat(), "price": pole_end_price, "label": "pole_end"},
            {"open_time": df["open_time"].iloc[-1].isoformat(), "price": flag_high, "label": "flag_high"},
            {"open_time": df["open_time"].iloc[-1].isoformat(), "price": flag_low, "label": "flag_low"},
        ],
        interpretation=interpretation,
    )
