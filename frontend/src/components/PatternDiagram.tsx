import { useId } from "react";
import { Box } from "@mui/material";
import { bonncoColors } from "../theme/theme";

export type Point = [number, number];

// All coordinates are in a fixed 0-100 (x) by 0-100 (y) space, y=0 at the top (higher price),
// y=100 at the bottom (lower price) — the same convention as Sparkline, so a diagram's shape
// reads the same way a real price chart does. Stroke widths are tuned in viewBox units (not
// non-scaling) so they stay proportional as the card resizes rather than becoming hairline-thin.
export interface PatternDiagramProps {
  points: Point[];
  bias: "bullish" | "bearish" | "neutral";
  referenceLines?: { y: number }[];
  secondaryPoints?: Point[];
  band?: { upper: Point[]; lower: Point[] };
  height?: number;
}

const BIAS_COLOR: Record<PatternDiagramProps["bias"], string> = {
  bullish: bonncoColors.bullish,
  bearish: bonncoColors.bearish,
  neutral: bonncoColors.accent,
};

function toPath(points: Point[]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

export default function PatternDiagram({ points, bias, referenceLines = [], secondaryPoints, band, height = 120 }: PatternDiagramProps) {
  const gradientId = useId();
  const color = BIAS_COLOR[bias];
  const linePath = toPath(points);
  const fillPath = `M0,100 L${linePath} L100,100 Z`;
  const bandFillPath = band ? `M${toPath(band.upper)} L${toPath([...band.lower].reverse())} Z` : null;

  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, backgroundColor: bonncoColors.bgElevated, overflow: "hidden" }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {bandFillPath && <path d={bandFillPath} fill={`${bonncoColors.accent}14`} stroke="none" />}
        {band && (
          <>
            <polyline points={toPath(band.upper)} fill="none" stroke={bonncoColors.textSecondary} strokeWidth={0.8} strokeDasharray="2,1.6" />
            <polyline points={toPath(band.lower)} fill="none" stroke={bonncoColors.textSecondary} strokeWidth={0.8} strokeDasharray="2,1.6" />
          </>
        )}

        {referenceLines.map((ref, i) => (
          <line key={i} x1={0} y1={ref.y} x2={100} y2={ref.y} stroke={bonncoColors.textSecondary} strokeWidth={0.8} strokeDasharray="3,2" />
        ))}

        <path d={fillPath} fill={`url(#${gradientId})`} stroke="none" />

        {secondaryPoints && (
          <polyline points={toPath(secondaryPoints)} fill="none" stroke={bonncoColors.textSecondary} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        )}

        <polyline points={linePath} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </Box>
  );
}
