import { Box } from "@mui/material";
import { bonncoColors } from "../theme/theme";

// Same 0-100 y convention as PatternDiagram: y=0 is the top of the chart (higher price).
export interface IllustrativeCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function CandlestickDiagram({
  candles,
  referenceLines = [],
  height = 120,
}: {
  candles: IllustrativeCandle[];
  referenceLines?: { y: number }[];
  height?: number;
}) {
  const slotWidth = 100 / candles.length;
  const bodyWidth = slotWidth * 0.42;

  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, backgroundColor: bonncoColors.bgElevated, overflow: "hidden" }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {referenceLines.map((ref, i) => (
          <line key={i} x1={0} y1={ref.y} x2={100} y2={ref.y} stroke={bonncoColors.textSecondary} strokeWidth={0.8} strokeDasharray="3,2" />
        ))}

        {candles.map((c, i) => {
          const cx = slotWidth * (i + 0.5);
          const isBullish = c.close < c.open; // smaller y = higher price
          const color = isBullish ? bonncoColors.bullish : bonncoColors.bearish;
          const bodyTop = Math.min(c.open, c.close);
          const bodyBottom = Math.max(c.open, c.close);
          const bodyHeight = Math.max(bodyBottom - bodyTop, 1.5);

          return (
            <g key={i}>
              <line x1={cx} y1={c.high} x2={cx} y2={c.low} stroke={color} strokeWidth={1.2} />
              <rect
                x={cx - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                fill={color}
                stroke={color}
                rx={0.6}
              />
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
