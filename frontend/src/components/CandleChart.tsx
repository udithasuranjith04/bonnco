import { useEffect, useRef } from "react";
import { CandlestickSeries, createChart, HistogramSeries, LineSeries } from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { Candle, DetectedPattern } from "../api/client";
import type { LiveCandleTick } from "../hooks/useLiveCandle";
import { bonncoColors } from "../theme/theme";
import { computeBollinger, computeEMA } from "../lib/clientIndicators";

const EMA_CONFIGS = [
  { period: 9, color: "#38bdf8" },
  { period: 21, color: "#a78bfa" },
  { period: 50, color: "#f59e0b" },
  { period: 200, color: "#94a3b8" },
];

const TRIANGLE_OR_WEDGE = new Set([
  "ascending_triangle",
  "descending_triangle",
  "symmetrical_triangle",
  "rising_wedge",
  "falling_wedge",
]);

function toUnixSeconds(isoNoTz: string): UTCTimestamp {
  return Math.floor(new Date(isoNoTz + "Z").getTime() / 1000) as UTCTimestamp;
}

// lightweight-charts requires strictly increasing, unique time values — a couple of detectors
// (e.g. a flag's high/low reference points) share the same candle's timestamp for two different
// prices, which would otherwise throw. Sorting and keeping only the first point per timestamp
// keeps every pattern type safe to render without needing a bespoke renderer for each one.
function sortedUniqueByTime(points: { open_time: string; price: number }[]) {
  const sorted = [...points].sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());
  const seen = new Set<number>();
  const result: { time: UTCTimestamp; value: number }[] = [];
  for (const p of sorted) {
    const time = toUnixSeconds(p.open_time);
    if (seen.has(time)) continue;
    seen.add(time);
    result.push({ time, value: p.price });
  }
  return result;
}

export default function CandleChart({
  candles,
  liveTick,
  height = 420,
  pattern,
}: {
  candles: Candle[];
  liveTick?: LiveCandleTick | null;
  height?: number;
  pattern?: DetectedPattern | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: bonncoColors.textSecondary,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: bonncoColors.border },
        horzLines: { color: bonncoColors.border },
      },
      height,
      width: containerRef.current.clientWidth,
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: bonncoColors.border },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: bonncoColors.bullish,
      downColor: bonncoColors.bearish,
      borderVisible: false,
      wickUpColor: bonncoColors.bullish,
      wickDownColor: bonncoColors.bearish,
    });
    candleSeriesRef.current = candleSeries;

    const times = candles.map((c) => toUnixSeconds(c.open_time));
    const closes = candles.map((c) => c.close);

    candleSeries.setData(
      candles.map((c, i) => ({ time: times[i], open: c.open, high: c.high, low: c.low, close: c.close })),
    );

    // Real buy/sell-initiated volume from the live trade stream, not derived from OHLCV — only
    // populated for candles the trade-delta tracker has actually seen, so older/untracked candles
    // are simply omitted from this series rather than shown as a fabricated zero bar.
    const deltaPoints = candles
      .map((c, i) => (c.delta === null ? null : { time: times[i], value: c.delta, color: c.delta >= 0 ? bonncoColors.bullish : bonncoColors.bearish }))
      .filter((d): d is { time: UTCTimestamp; value: number; color: string } => d !== null);

    if (deltaPoints.length > 0) {
      const deltaSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "delta",
        priceLineVisible: false,
        lastValueVisible: false,
        title: "delta",
      });
      chart.priceScale("delta").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      deltaSeries.setData(deltaPoints);
    }

    EMA_CONFIGS.forEach(({ period, color }) => {
      const values = computeEMA(closes, period);
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: `EMA ${period}`,
      });
      series.setData(
        times
          .map((t, i) => (values[i] === null ? null : { time: t, value: values[i] as number }))
          .filter((d): d is { time: UTCTimestamp; value: number } => d !== null),
      );
    });

    const bb = computeBollinger(closes, 20, 2);
    ([
      ["upper", bb.upper],
      ["lower", bb.lower],
    ] as const).forEach(([, values]) => {
      const series = chart.addSeries(LineSeries, {
        color: bonncoColors.textSecondary,
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData(
        times
          .map((t, i) => (values[i] === null ? null : { time: t, value: values[i] as number }))
          .filter((d): d is { time: UTCTimestamp; value: number } => d !== null),
      );
    });

    if (pattern && pattern.key_points.length >= 2) {
      const color =
        pattern.bias === "bullish" ? bonncoColors.bullish : pattern.bias === "bearish" ? bonncoColors.bearish : bonncoColors.accent;
      const overlayStyle = {
        color,
        lineWidth: 2 as const,
        lineStyle: pattern.confirmed ? 0 : 2, // solid once confirmed, dashed while still forming
        priceLineVisible: false,
        lastValueVisible: false,
      };

      if (TRIANGLE_OR_WEDGE.has(pattern.pattern)) {
        // Triangles/wedges are two converging trendlines, not one connected zigzag — drawing them
        // as a single line would visually mash the resistance and support lines together.
        const upperPoints = sortedUniqueByTime(pattern.key_points.filter((p) => p.label === "high"));
        const lowerPoints = sortedUniqueByTime(pattern.key_points.filter((p) => p.label === "low"));
        if (upperPoints.length >= 2) chart.addSeries(LineSeries, { ...overlayStyle, title: "resistance" }).setData(upperPoints);
        if (lowerPoints.length >= 2) chart.addSeries(LineSeries, { ...overlayStyle, title: "support" }).setData(lowerPoints);
      } else {
        const points = sortedUniqueByTime(pattern.key_points);
        if (points.length >= 2) {
          chart.addSeries(LineSeries, { ...overlayStyle, title: pattern.pattern.replace(/_/g, " ") }).setData(points);
        }
      }
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [candles, height, pattern]);

  // Live WebSocket ticks update just the last bar in place (no full re-render, no lost zoom/pan) —
  // this is what makes the currently-forming candle visibly tick rather than only jumping on close.
  useEffect(() => {
    if (!liveTick || !candleSeriesRef.current) return;
    candleSeriesRef.current.update({
      time: Math.floor(liveTick.open_time / 1000) as UTCTimestamp,
      open: liveTick.open,
      high: liveTick.high,
      low: liveTick.low,
      close: liveTick.close,
    });
  }, [liveTick]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
