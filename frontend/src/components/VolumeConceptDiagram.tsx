import { useId } from "react";
import { Box } from "@mui/material";
import { bonncoColors } from "../theme/theme";
import type { Point } from "./PatternDiagram";

export interface VolumeBar {
  volume: number; // 0-100, taller = more volume
  tone: "confirm" | "warn" | "neutral";
}

const TONE_COLOR: Record<VolumeBar["tone"], string> = {
  confirm: bonncoColors.bullish,
  warn: bonncoColors.bearish,
  neutral: bonncoColors.textSecondary,
};

export default function VolumeConceptDiagram({
  pricePoints,
  bars,
  height = 130,
}: {
  pricePoints: Point[];
  bars: VolumeBar[];
  height?: number;
}) {
  const gradientId = useId();
  const priceAreaHeight = 62;
  const volumeAreaTop = 68;
  const volumeAreaHeight = 32;

  const scaledPrice = pricePoints.map(([x, y]) => [x, (y / 100) * priceAreaHeight] as Point);
  const linePath = scaledPrice.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fillPath = `M0,${priceAreaHeight} L${linePath} L100,${priceAreaHeight} Z`;

  const slotWidth = 100 / bars.length;
  const barWidth = slotWidth * 0.55;

  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, backgroundColor: bonncoColors.bgElevated, overflow: "hidden" }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={bonncoColors.accent} stopOpacity={0.3} />
            <stop offset="100%" stopColor={bonncoColors.accent} stopOpacity={0} />
          </linearGradient>
        </defs>

        <path d={fillPath} fill={`url(#${gradientId})`} stroke="none" />
        <polyline points={linePath} fill="none" stroke={bonncoColors.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <line x1={0} y1={volumeAreaTop - 4} x2={100} y2={volumeAreaTop - 4} stroke={bonncoColors.border} strokeWidth={0.6} />

        {bars.map((bar, i) => {
          const cx = slotWidth * (i + 0.5);
          const barHeight = (bar.volume / 100) * volumeAreaHeight;
          return (
            <rect
              key={i}
              x={cx - barWidth / 2}
              y={volumeAreaTop + volumeAreaHeight - barHeight}
              width={barWidth}
              height={barHeight}
              fill={TONE_COLOR[bar.tone]}
              opacity={bar.tone === "neutral" ? 0.4 : 0.85}
              rx={0.5}
            />
          );
        })}
      </svg>
    </Box>
  );
}
