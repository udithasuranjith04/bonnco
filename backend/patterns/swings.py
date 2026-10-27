from dataclasses import dataclass

import pandas as pd


@dataclass
class SwingPoint:
    index: int  # positional index into the candle DataFrame
    open_time: pd.Timestamp
    price: float
    kind: str  # "high" or "low"


def find_swings(df: pd.DataFrame, window: int = 3) -> tuple[list[SwingPoint], list[SwingPoint]]:
    """Fractal swing highs/lows: a candle is a swing high if its high is strictly the max within
    `window` candles on each side (and swing low the strict min). A wider window than the one used
    for support/resistance (2, in indicators.py) since chart patterns need fewer, more significant
    pivots rather than every minor wiggle.
    """
    highs: list[SwingPoint] = []
    lows: list[SwingPoint] = []
    high, low, open_time = df["high"], df["low"], df["open_time"]
    n = len(df)

    for i in range(window, n - window):
        window_high = high.iloc[i - window : i + window + 1]
        window_low = low.iloc[i - window : i + window + 1]

        if high.iloc[i] == window_high.max() and (window_high == high.iloc[i]).sum() == 1:
            highs.append(SwingPoint(index=i, open_time=open_time.iloc[i], price=float(high.iloc[i]), kind="high"))
        if low.iloc[i] == window_low.min() and (window_low == low.iloc[i]).sum() == 1:
            lows.append(SwingPoint(index=i, open_time=open_time.iloc[i], price=float(low.iloc[i]), kind="low"))

    return highs, lows
