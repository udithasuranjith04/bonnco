// Lightweight client-side re-implementations of standard indicator formulas, used only to draw
// chart overlays. The signal engine's server-computed values (via pandas-ta) remain the source of
// truth for actual BUY/SELL/HOLD decisions — these are for visualization only.

export function computeEMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;

  const k = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = seed;
  let prev = seed;

  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result[i] = prev;
  }
  return result;
}

export function computeBollinger(
  values: number[],
  period = 20,
  stdDevMultiplier = 2,
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const middle: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    middle[i] = mean;
    upper[i] = mean + stdDevMultiplier * sd;
    lower[i] = mean - stdDevMultiplier * sd;
  }
  return { upper, middle, lower };
}
