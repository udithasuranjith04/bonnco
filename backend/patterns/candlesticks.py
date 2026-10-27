import pandas as pd

from patterns.format import fmt_price as _fmt
from patterns.models import DetectedPattern
from patterns.swings import SwingPoint

DOJI_BODY_RATIO = 0.1  # body must be under 10% of the candle's high-low range
HAMMER_WICK_RATIO = 2.0  # the long wick must be at least 2x the body
# Matches the exact "near support/resistance" threshold signal_engine.py already scores on
# (_score_support_resistance), so a candlestick-at-a-level reading uses the same definition of "near".
NEAR_LEVEL_PCT = 0.01


def detect_engulfing(df: pd.DataFrame, symbol: str, market_type: str, timeframe: str) -> DetectedPattern | None:
    if len(df) < 2:
        return None
    prev, cur = df.iloc[-2], df.iloc[-1]
    prev_bullish = prev["close"] > prev["open"]
    cur_bullish = cur["close"] > cur["open"]
    if prev_bullish == cur_bullish:
        return None

    engulfs = (
        cur["open"] <= prev["close"] and cur["close"] >= prev["open"]
        if cur_bullish
        else cur["open"] >= prev["close"] and cur["close"] <= prev["open"]
    )
    if not engulfs:
        return None

    bias = "bullish" if cur_bullish else "bearish"
    interpretation = (
        f"{symbol} ({timeframe}) just printed a {bias} engulfing candle: the current candle's body fully swallows "
        f"the prior candle's body, closing at {_fmt(float(cur['close']))} after opening at {_fmt(float(cur['open']))}. "
        f"This is a well-established short-term {bias} reversal signal, since it shows the {'buyers' if cur_bullish else 'sellers'} "
        f"reversing the entire prior candle's move within a single session, though it's a probabilistic tendency, not a guaranteed outcome."
    )

    return DetectedPattern(
        pattern=f"{bias}_engulfing",
        category="candlestick",
        bias=bias,
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        completeness=1.0,
        confirmed=True,
        price_low=float(min(prev["low"], cur["low"])),
        price_high=float(max(prev["high"], cur["high"])),
        range_start=df["open_time"].iloc[-2],
        range_end=df["open_time"].iloc[-1],
        key_points=[
            {"open_time": df["open_time"].iloc[-2].isoformat(), "price": float(prev["open"]), "label": "prior_open"},
            {"open_time": df["open_time"].iloc[-2].isoformat(), "price": float(prev["close"]), "label": "prior_close"},
            {"open_time": df["open_time"].iloc[-1].isoformat(), "price": float(cur["open"]), "label": "current_open"},
            {"open_time": df["open_time"].iloc[-1].isoformat(), "price": float(cur["close"]), "label": "current_close"},
        ],
        interpretation=interpretation,
    )


def detect_doji(df: pd.DataFrame, symbol: str, market_type: str, timeframe: str) -> DetectedPattern | None:
    cur = df.iloc[-1]
    rng = float(cur["high"] - cur["low"])
    if rng <= 0:
        return None
    body = abs(float(cur["close"] - cur["open"]))
    if body / rng > DOJI_BODY_RATIO:
        return None

    interpretation = (
        f"{symbol} ({timeframe}) just printed a doji: the open and close landed almost at the same price "
        f"(around {_fmt(float(cur['close']))}), a razor-thin body with wicks on either side. On its own this is "
        f"indecision, not a directional signal, but it's worth noting after an extended trend, where it can flag hesitation."
    )

    return DetectedPattern(
        pattern="doji",
        category="candlestick",
        bias="neutral",
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        completeness=1.0,
        confirmed=True,
        price_low=float(cur["low"]),
        price_high=float(cur["high"]),
        range_start=df["open_time"].iloc[-1],
        range_end=df["open_time"].iloc[-1],
        key_points=[{"open_time": df["open_time"].iloc[-1].isoformat(), "price": float(cur["close"]), "label": "doji"}],
        interpretation=interpretation,
    )


def _nearest_level(swings: list[SwingPoint], price: float, side: str) -> float | None:
    if side == "support":
        below = [s.price for s in swings if s.price < price]
        return max(below) if below else None
    above = [s.price for s in swings if s.price > price]
    return min(above) if above else None


def detect_hammer_at_support(df: pd.DataFrame, swing_lows: list[SwingPoint], symbol: str, market_type: str, timeframe: str) -> DetectedPattern | None:
    cur = df.iloc[-1]
    body_top = float(max(cur["open"], cur["close"]))
    body_bottom = float(min(cur["open"], cur["close"]))
    body = body_top - body_bottom
    lower_wick = body_bottom - float(cur["low"])
    upper_wick = float(cur["high"]) - body_top
    if body <= 0 or lower_wick < body * HAMMER_WICK_RATIO or upper_wick > body:
        return None

    price = float(cur["close"])
    support = _nearest_level([s for s in swing_lows if s.index < len(df) - 1], price, "support")
    if support is None or (price - support) / price > NEAR_LEVEL_PCT:
        return None

    interpretation = (
        f"{symbol} ({timeframe}) just printed a hammer right near a support level around {_fmt(support)}: a small "
        f"body near the top of the candle's range with a long lower wick, showing sellers pushed price down hard "
        f"before buyers dragged it back up. Occurring at a real, previously-tested support level adds weight to it, "
        f"though many traders wait for the next candle to confirm before treating the reversal as real."
    )

    return DetectedPattern(
        pattern="hammer_at_support",
        category="candlestick",
        bias="bullish",
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        completeness=1.0,
        confirmed=True,
        price_low=float(cur["low"]),
        price_high=float(cur["high"]),
        range_start=df["open_time"].iloc[-1],
        range_end=df["open_time"].iloc[-1],
        key_points=[
            {"open_time": df["open_time"].iloc[-1].isoformat(), "price": price, "label": "hammer"},
            {"open_time": df["open_time"].iloc[-1].isoformat(), "price": support, "label": "support_level"},
        ],
        interpretation=interpretation,
    )


def detect_shooting_star_at_resistance(
    df: pd.DataFrame, swing_highs: list[SwingPoint], symbol: str, market_type: str, timeframe: str
) -> DetectedPattern | None:
    cur = df.iloc[-1]
    body_top = float(max(cur["open"], cur["close"]))
    body_bottom = float(min(cur["open"], cur["close"]))
    body = body_top - body_bottom
    upper_wick = float(cur["high"]) - body_top
    lower_wick = body_bottom - float(cur["low"])
    if body <= 0 or upper_wick < body * HAMMER_WICK_RATIO or lower_wick > body:
        return None

    price = float(cur["close"])
    resistance = _nearest_level([s for s in swing_highs if s.index < len(df) - 1], price, "resistance")
    if resistance is None or (resistance - price) / price > NEAR_LEVEL_PCT:
        return None

    interpretation = (
        f"{symbol} ({timeframe}) just printed a shooting star right near a resistance level around {_fmt(resistance)}: "
        f"a small body near the bottom of the candle's range with a long upper wick, showing buyers pushed price up "
        f"hard before sellers dragged it back down. Occurring at a real, previously-tested resistance level adds "
        f"weight to it, though many traders wait for the next candle to confirm before treating the reversal as real."
    )

    return DetectedPattern(
        pattern="shooting_star_at_resistance",
        category="candlestick",
        bias="bearish",
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        completeness=1.0,
        confirmed=True,
        price_low=float(cur["low"]),
        price_high=float(cur["high"]),
        range_start=df["open_time"].iloc[-1],
        range_end=df["open_time"].iloc[-1],
        key_points=[
            {"open_time": df["open_time"].iloc[-1].isoformat(), "price": price, "label": "shooting_star"},
            {"open_time": df["open_time"].iloc[-1].isoformat(), "price": resistance, "label": "resistance_level"},
        ],
        interpretation=interpretation,
    )
