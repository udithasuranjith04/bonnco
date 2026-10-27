import { useId } from "react";
import { Box, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";
import type { IllustrativeCandle } from "./CandlestickDiagram";

// Renders the exact same underlying price data as four different chart types side by side, so the
// point lands visually: these are different ways of drawing the same data, not different data.

function toPath(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ borderRadius: 1, backgroundColor: bonncoColors.bgElevated, overflow: "hidden" }}>
      <Box sx={{ height: 90 }}>{children}</Box>
      <Typography
        variant="caption"
        sx={{ display: "block", textAlign: "center", py: 0.6, fontFamily: monoStack, letterSpacing: "0.05em", color: bonncoColors.textSecondary }}
      >
        {label.toUpperCase()}
      </Typography>
    </Box>
  );
}

function LinePanel({ candles }: { candles: IllustrativeCandle[] }) {
  const points: [number, number][] = candles.map((c, i) => [(100 / candles.length) * (i + 0.5), c.close]);
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={toPath(points)} fill="none" stroke={bonncoColors.accent} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function AreaPanel({ candles }: { candles: IllustrativeCandle[] }) {
  const gradientId = useId();
  const points: [number, number][] = candles.map((c, i) => [(100 / candles.length) * (i + 0.5), c.close]);
  const fillPath = `M0,100 L${toPath(points)} L100,100 Z`;
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bonncoColors.accent} stopOpacity={0.4} />
          <stop offset="100%" stopColor={bonncoColors.accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} stroke="none" />
      <polyline points={toPath(points)} fill="none" stroke={bonncoColors.accent} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function CandlestickPanel({ candles }: { candles: IllustrativeCandle[] }) {
  const slotWidth = 100 / candles.length;
  const bodyWidth = slotWidth * 0.42;
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      {candles.map((c, i) => {
        const cx = slotWidth * (i + 0.5);
        const isBullish = c.close < c.open;
        const color = isBullish ? bonncoColors.bullish : bonncoColors.bearish;
        const bodyTop = Math.min(c.open, c.close);
        const bodyHeight = Math.max(Math.abs(c.close - c.open), 1.5);
        return (
          <g key={i}>
            <line x1={cx} y1={c.high} x2={cx} y2={c.low} stroke={color} strokeWidth={1.2} />
            <rect x={cx - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} rx={0.6} />
          </g>
        );
      })}
    </svg>
  );
}

function BarPanel({ candles }: { candles: IllustrativeCandle[] }) {
  const slotWidth = 100 / candles.length;
  const tickWidth = slotWidth * 0.28;
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      {candles.map((c, i) => {
        const cx = slotWidth * (i + 0.5);
        const isBullish = c.close < c.open;
        const color = isBullish ? bonncoColors.bullish : bonncoColors.bearish;
        return (
          <g key={i} stroke={color} strokeWidth={1.2}>
            <line x1={cx} y1={c.high} x2={cx} y2={c.low} />
            <line x1={cx - tickWidth} y1={c.open} x2={cx} y2={c.open} />
            <line x1={cx} y1={c.close} x2={cx + tickWidth} y2={c.close} />
          </g>
        );
      })}
    </svg>
  );
}

export default function ChartTypeGallery({ candles }: { candles: IllustrativeCandle[] }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1 }}>
      <Panel label="Line">
        <LinePanel candles={candles} />
      </Panel>
      <Panel label="Area">
        <AreaPanel candles={candles} />
      </Panel>
      <Panel label="Candlestick">
        <CandlestickPanel candles={candles} />
      </Panel>
      <Panel label="Bar (OHLC)">
        <BarPanel candles={candles} />
      </Panel>
    </Box>
  );
}
