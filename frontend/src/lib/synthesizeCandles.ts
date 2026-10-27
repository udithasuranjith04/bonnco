import type { Point } from "../components/PatternDiagram";
import type { IllustrativeCandle } from "../components/CandlestickDiagram";

// Deterministic (no Math.random, so a pattern renders identically every time) conversion from a
// hand-designed "skeleton" of key pivot points into a synthetic OHLC candle sequence tracing the
// same shape — turns the validated line-pattern geometry into a realistic-looking candlestick
// chart instead of a bare line, without hand-authoring dozens of candles per pattern.
export function synthesizeCandles(skeleton: Point[], perSegment = 3): IllustrativeCandle[] {
  const candles: IllustrativeCandle[] = [];
  let idx = 0;

  for (let i = 0; i < skeleton.length - 1; i++) {
    const [, y0] = skeleton[i];
    const [, y1] = skeleton[i + 1];

    for (let j = 0; j < perSegment; j++) {
      const t0 = j / perSegment;
      const t1 = (j + 1) / perSegment;
      const open = y0 + (y1 - y0) * t0;
      const close = y0 + (y1 - y0) * t1;
      const wiggle = 1.5 + Math.abs(Math.sin(idx * 2.35)) * 3;
      const bodyTop = Math.min(open, close);
      const bodyBottom = Math.max(open, close);

      candles.push({
        open,
        close,
        high: Math.max(0, bodyTop - wiggle),
        low: Math.min(100, bodyBottom + wiggle),
      });
      idx++;
    }
  }

  return candles;
}
