import { Box, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

// Illustrates a Fibonacci retracement drawn on an up-swing: the tool is dragged from the swing
// low (0%) to the swing high (100%), and the levels in between are where a pullback commonly
// finds support. y is inverted (0 = top = higher price), matching every other diagram in this file.
const SWING_LOW_Y = 88;
const SWING_HIGH_Y = 12;
const LEVELS = [0, 23.6, 38.2, 50, 61.8, 78.6, 100];

function levelY(pct: number): number {
  // 0% sits at the swing low, 100% at the swing high.
  return SWING_LOW_Y - (pct / 100) * (SWING_LOW_Y - SWING_HIGH_Y);
}

export default function FibonacciDiagram({ height = 180 }: { height?: number }) {
  const priceUp = "6,88 20,74 34,56 48,30 60,12";
  const pricePullback = "60,12 70,32 80,46 90,40 100,44";

  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 1.5 }}>
      <svg width="100%" height="calc(100% - 8px)" viewBox="0 0 132 100" preserveAspectRatio="none">
        {LEVELS.map((pct) => (
          <g key={pct}>
            <line
              x1={0}
              y1={levelY(pct)}
              x2={100}
              y2={levelY(pct)}
              stroke={pct === 0 || pct === 100 ? bonncoColors.textSecondary : bonncoColors.accent}
              strokeWidth={pct === 0 || pct === 100 ? 0.6 : 0.8}
              strokeDasharray={pct === 0 || pct === 100 ? "0" : "2,1.5"}
              opacity={pct === 0 || pct === 100 ? 0.5 : 0.8}
            />
            <text x={102} y={levelY(pct) + 2.2} fontSize={5.2} fill={bonncoColors.textSecondary} fontFamily="monospace">
              {pct}%
            </text>
          </g>
        ))}
        <polyline points={priceUp} fill="none" stroke={bonncoColors.bullish} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={pricePullback} fill="none" stroke={bonncoColors.bearish} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="0" />
      </svg>
      <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary, display: "block", textAlign: "center" }}>
        Green = the swing you measure. Red = the pullback testing the fib levels.
      </Typography>
    </Box>
  );
}
