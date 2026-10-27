from dataclasses import dataclass, field

import pandas as pd
import pandas_ta as ta
from sqlalchemy.orm import Session

from app.services.candle_data import InsufficientDataError, load_candle_df

EMA_PERIODS = (9, 21, 50, 200)
RSI_PERIOD = 14
BBANDS_PERIOD = 20
VOLUME_LOOKBACK = 20
VOLUME_SPIKE_RATIO = 2.0
SWING_WINDOW = 2  # candles on each side to confirm a fractal swing high/low
MIN_CANDLES = 210  # need enough history for EMA200 + lookback


@dataclass
class IndicatorReading:
    value: float | dict
    label: str
    # A short tag (e.g. "overbought", "bullish momentum") for compact UI displays — kept as its
    # own field rather than parsed out of `label` at display time, so the label text is free to
    # read as a plain sentence.
    interpretation: str


@dataclass
class IndicatorSnapshot:
    symbol: str
    market_type: str
    timeframe: str
    as_of: str
    price: float
    rsi: IndicatorReading
    macd: IndicatorReading
    ema: IndicatorReading
    bollinger: IndicatorReading
    volume: IndicatorReading
    support_resistance: IndicatorReading
    summary_labels: list[str] = field(default_factory=list)
    # Only present once the real-time trade-delta listener has actually tracked this symbol for a
    # while — never backfilled or estimated, so this stays None rather than fabricate a reading.
    delta: IndicatorReading | None = None


def _load_candle_df(db: Session, symbol: str, market_type: str, timeframe: str, limit: int = 500) -> pd.DataFrame:
    return load_candle_df(db, symbol, market_type, timeframe, limit=limit, min_candles=MIN_CANDLES)


def _rsi_reading(close: pd.Series) -> IndicatorReading:
    rsi = ta.rsi(close, length=RSI_PERIOD)
    value = round(float(rsi.iloc[-1]), 1)
    if value >= 70:
        interpretation = "overbought"
    elif value <= 30:
        interpretation = "oversold"
    else:
        interpretation = "neutral"
    label = f"RSI {value} is {interpretation}"
    return IndicatorReading(value=value, label=label, interpretation=interpretation)


def _macd_reading(close: pd.Series) -> IndicatorReading:
    macd_df = ta.macd(close)
    macd_line = macd_df.iloc[:, 0]
    signal_line = macd_df.iloc[:, 2]
    hist = macd_df.iloc[:, 1]

    curr_macd, prev_macd = macd_line.iloc[-1], macd_line.iloc[-2]
    curr_sig, prev_sig = signal_line.iloc[-1], signal_line.iloc[-2]

    crossed_bullish = prev_macd <= prev_sig and curr_macd > curr_sig
    crossed_bearish = prev_macd >= prev_sig and curr_macd < curr_sig

    if crossed_bullish:
        interpretation = "bullish crossover"
        label = "MACD just crossed bullish, momentum turning up"
    elif crossed_bearish:
        interpretation = "bearish crossover"
        label = "MACD just crossed bearish, momentum turning down"
    elif curr_macd > curr_sig:
        interpretation = "bullish momentum"
        label = "MACD is above its signal line, bullish momentum"
    else:
        interpretation = "bearish momentum"
        label = "MACD is below its signal line, bearish momentum"

    return IndicatorReading(
        value={
            "macd": round(float(curr_macd), 4),
            "signal": round(float(curr_sig), 4),
            "histogram": round(float(hist.iloc[-1]), 4),
        },
        label=label,
        interpretation=interpretation,
    )


def _ema_reading(close: pd.Series) -> IndicatorReading:
    emas = {p: ta.ema(close, length=p) for p in EMA_PERIODS}
    values = {p: round(float(emas[p].iloc[-1]), 2) for p in EMA_PERIODS}
    price = float(close.iloc[-1])

    e9, e21, e50, e200 = values[9], values[21], values[50], values[200]

    prev_e9, prev_e21 = emas[9].iloc[-2], emas[21].iloc[-2]
    short_cross_bullish = prev_e9 <= prev_e21 and e9 > e21
    short_cross_bearish = prev_e9 >= prev_e21 and e9 < e21

    if short_cross_bullish:
        interpretation = "bullish crossover"
        label = "EMA9 just crossed above EMA21, a short-term bullish crossover"
    elif short_cross_bearish:
        interpretation = "bearish crossover"
        label = "EMA9 just crossed below EMA21, a short-term bearish crossover"
    elif price > e50 > e200:
        interpretation = "established uptrend"
        label = "Price is above EMA50 and EMA200, an established uptrend"
    elif price < e50 < e200:
        interpretation = "established downtrend"
        label = "Price is below EMA50 and EMA200, an established downtrend"
    elif price > e200:
        interpretation = "long-term uptrend"
        label = "Price is above EMA200, a long-term uptrend, though short-term is mixed"
    else:
        interpretation = "long-term downtrend"
        label = "Price is below EMA200, a long-term downtrend, though short-term is mixed"

    return IndicatorReading(
        value={"ema9": e9, "ema21": e21, "ema50": e50, "ema200": e200}, label=label, interpretation=interpretation
    )


def _bollinger_reading(close: pd.Series) -> IndicatorReading:
    bb = ta.bbands(close, length=BBANDS_PERIOD, std=2)
    lower, mid, upper = bb.iloc[-1, 0], bb.iloc[-1, 1], bb.iloc[-1, 2]
    price = float(close.iloc[-1])
    percent_b = (price - lower) / (upper - lower) if upper != lower else 0.5

    if percent_b > 1:
        interpretation = "extended above band"
        label = "Price is above the upper Bollinger Band, extended and due for a possible pullback"
    elif percent_b < 0:
        interpretation = "extended below band"
        label = "Price is below the lower Bollinger Band, extended to the downside"
    elif percent_b > 0.8:
        interpretation = "near upper band"
        label = "Price is near the upper Bollinger Band, approaching overbought territory"
    elif percent_b < 0.2:
        interpretation = "near lower band"
        label = "Price is near the lower Bollinger Band, approaching oversold territory"
    else:
        interpretation = "mid-range"
        label = "Price is within the middle of the Bollinger Bands, no extreme"

    return IndicatorReading(
        value={
            "lower": round(float(lower), 2),
            "middle": round(float(mid), 2),
            "upper": round(float(upper), 2),
            "percent_b": round(float(percent_b), 2),
        },
        label=label,
        interpretation=interpretation,
    )


def _volume_reading(volume: pd.Series) -> IndicatorReading:
    rolling_avg = volume.rolling(VOLUME_LOOKBACK).mean().iloc[-1]
    current = float(volume.iloc[-1])
    ratio = current / rolling_avg if rolling_avg else 0.0

    if ratio >= VOLUME_SPIKE_RATIO:
        interpretation = "spike"
        label = f"Volume is {round(ratio, 1)}x the {VOLUME_LOOKBACK}-candle average, a spike with real participation"
    elif ratio < 0.5:
        interpretation = "quiet"
        label = f"Volume is {round(ratio, 1)}x the {VOLUME_LOOKBACK}-candle average, quiet with low interest"
    else:
        interpretation = "normal"
        label = f"Volume is {round(ratio, 1)}x the {VOLUME_LOOKBACK}-candle average, which is normal"

    return IndicatorReading(
        value={"current": round(current, 4), "average": round(float(rolling_avg), 4), "ratio": round(ratio, 2)},
        label=label,
        interpretation=interpretation,
    )


def _find_swing_levels(high: pd.Series, low: pd.Series, window: int = SWING_WINDOW) -> tuple[list[float], list[float]]:
    swing_highs, swing_lows = [], []
    for i in range(window, len(high) - window):
        window_high = high.iloc[i - window : i + window + 1]
        window_low = low.iloc[i - window : i + window + 1]
        if high.iloc[i] == window_high.max():
            swing_highs.append(float(high.iloc[i]))
        if low.iloc[i] == window_low.min():
            swing_lows.append(float(low.iloc[i]))
    return swing_highs, swing_lows


def _support_resistance_reading(high: pd.Series, low: pd.Series, price: float) -> IndicatorReading:
    swing_highs, swing_lows = _find_swing_levels(high, low)

    resistances = sorted({round(h, 2) for h in swing_highs if h > price})
    supports = sorted({round(l, 2) for l in swing_lows if l < price}, reverse=True)

    nearest_resistance = resistances[0] if resistances else None
    nearest_support = supports[0] if supports else None

    parts = []
    if nearest_support is not None:
        pct = round((price - nearest_support) / price * 100, 2)
        parts.append(f"support at {nearest_support} ({pct}% below)")
    if nearest_resistance is not None:
        pct = round((nearest_resistance - price) / price * 100, 2)
        parts.append(f"resistance at {nearest_resistance} ({pct}% above)")

    if parts:
        label = "Nearest " + " and ".join(parts)
        interpretation = "near support" if nearest_support is not None else "near resistance"
    else:
        label = "No clear nearby support or resistance levels found"
        interpretation = "no nearby levels"

    return IndicatorReading(
        value={
            "nearest_support": nearest_support,
            "nearest_resistance": nearest_resistance,
            "supports": supports[:5],
            "resistances": resistances[:5],
        },
        label=label,
        interpretation=interpretation,
    )


DELTA_LOOKBACK_CANDLES = 10
DELTA_BALANCED_RATIO = 0.1  # |delta| / total volume below this counts as roughly balanced


def _delta_reading(df: pd.DataFrame) -> IndicatorReading | None:
    """Real buy/sell-initiated volume from the live trade stream, not derived from OHLCV. Only
    returns a reading once at least one recent candle actually has delta data tracked (never
    backfilled), so a symbol the trade-delta listener hasn't reached yet correctly reports nothing
    rather than a fabricated neutral reading.
    """
    recent = df.tail(DELTA_LOOKBACK_CANDLES)
    valid = recent.dropna(subset=["delta", "buy_volume", "sell_volume"])
    if valid.empty:
        return None

    total_delta = float(valid["delta"].sum())
    total_volume = float(valid["buy_volume"].sum() + valid["sell_volume"].sum())
    if total_volume <= 0:
        return None

    ratio = total_delta / total_volume
    candles_tracked = len(valid)

    if ratio > DELTA_BALANCED_RATIO:
        interpretation = "net buying pressure"
        label = (
            f"Live trade flow over the last {candles_tracked} tracked candle(s) shows net buying pressure "
            f"(delta {total_delta:+,.0f}), aggressive buyers stepping in beyond what the candle close alone shows"
        )
    elif ratio < -DELTA_BALANCED_RATIO:
        interpretation = "net selling pressure"
        label = (
            f"Live trade flow over the last {candles_tracked} tracked candle(s) shows net selling pressure "
            f"(delta {total_delta:+,.0f}), aggressive sellers stepping in beyond what the candle close alone shows"
        )
    else:
        interpretation = "balanced"
        label = (
            f"Live trade flow over the last {candles_tracked} tracked candle(s) is roughly balanced "
            f"between buyers and sellers (delta {total_delta:+,.0f})"
        )

    return IndicatorReading(
        value={"total_delta": round(total_delta, 2), "candles_tracked": candles_tracked},
        label=label,
        interpretation=interpretation,
    )


def compute_indicators(db: Session, symbol: str, market_type: str, timeframe: str) -> IndicatorSnapshot:
    df = _load_candle_df(db, symbol, market_type, timeframe)

    close, high, low, volume = df["close"], df["high"], df["low"], df["volume"]
    price = float(close.iloc[-1])

    rsi = _rsi_reading(close)
    macd = _macd_reading(close)
    ema = _ema_reading(close)
    bollinger = _bollinger_reading(close)
    vol = _volume_reading(volume)
    sr = _support_resistance_reading(high, low, price)
    delta = _delta_reading(df)

    summary_labels = [rsi.label, macd.label, ema.label, bollinger.label, vol.label, sr.label]
    if delta is not None:
        summary_labels.append(delta.label)

    return IndicatorSnapshot(
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        as_of=df["open_time"].iloc[-1].isoformat(),
        price=price,
        rsi=rsi,
        macd=macd,
        ema=ema,
        bollinger=bollinger,
        volume=vol,
        support_resistance=sr,
        summary_labels=summary_labels,
        delta=delta,
    )
