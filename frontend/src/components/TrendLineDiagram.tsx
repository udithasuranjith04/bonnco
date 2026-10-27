import { Box, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

// Illustrates drawing a trend line: click the first swing point, drag to the second, the line
// extends outward from there. An uptrend line connects rising swing lows (drawn underneath
// price); a downtrend line connects falling swing highs (drawn above price).
export default function TrendLineDiagram({ height = 160 }: { height?: number }) {
  const price = "4,78 16,62 24,68 36,50 44,58 56,40 66,46 78,28 88,34 98,18";
  // Two swing lows the trend line connects, then extended to the right edge.
  const swing1 = { x: 16, y: 62 };
  const swing2 = { x: 56, y: 40 };
  const slope = (swing2.y - swing1.y) / (swing2.x - swing1.x);
  const extendedX = 98;
  const extendedY = swing2.y + slope * (extendedX - swing2.x);

  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 1.5 }}>
      <svg width="100%" height="calc(100% - 16px)" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={price} fill="none" stroke={bonncoColors.bullish} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        <line
          x1={swing1.x}
          y1={swing1.y}
          x2={extendedX}
          y2={extendedY}
          stroke={bonncoColors.accent}
          strokeWidth={1.4}
          strokeDasharray="4,2.5"
        />
        <circle cx={swing1.x} cy={swing1.y} r={2.2} fill={bonncoColors.accent} />
        <circle cx={swing2.x} cy={swing2.y} r={2.2} fill={bonncoColors.accent} />
      </svg>
      <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary, display: "block", textAlign: "center" }}>
        Click swing low 1, drag to swing low 2, the line extends to show where the next bounce might be.
      </Typography>
    </Box>
  );
}
