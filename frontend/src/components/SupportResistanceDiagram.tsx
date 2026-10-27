import { Box, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

// A price path that touches the same support level twice and the same resistance level twice,
// bouncing each time, illustrating why traders mark and watch these levels. y inverted (0 = top).
const SUPPORT_Y = 78;
const RESISTANCE_Y = 22;

const PRICE_PATH: [number, number][] = [
  [2, 50],
  [12, 78],
  [22, 55],
  [32, 22],
  [42, 45],
  [52, 78],
  [62, 50],
  [72, 22],
  [82, 40],
  [92, 60],
  [98, 78],
];

function toPath(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

export default function SupportResistanceDiagram({ height = 190 }: { height?: number }) {
  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 1.5 }}>
      <svg width="100%" height="calc(100% - 20px)" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x={0} y={RESISTANCE_Y - 4} width={100} height={8} fill={`${bonncoColors.bearish}18`} />
        <line x1={0} y1={RESISTANCE_Y} x2={100} y2={RESISTANCE_Y} stroke={bonncoColors.bearish} strokeWidth={1} strokeDasharray="4,2" />
        <text x={2} y={RESISTANCE_Y - 6} fontSize={5} fill={bonncoColors.bearish} fontFamily="monospace">
          RESISTANCE
        </text>

        <rect x={0} y={SUPPORT_Y - 4} width={100} height={8} fill={`${bonncoColors.bullish}18`} />
        <line x1={0} y1={SUPPORT_Y} x2={100} y2={SUPPORT_Y} stroke={bonncoColors.bullish} strokeWidth={1} strokeDasharray="4,2" />
        <text x={2} y={SUPPORT_Y + 9} fontSize={5} fill={bonncoColors.bullish} fontFamily="monospace">
          SUPPORT
        </text>

        <polyline points={toPath(PRICE_PATH)} fill="none" stroke={bonncoColors.accent} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        {PRICE_PATH.filter(([, y]) => y === SUPPORT_Y || y === RESISTANCE_Y).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} fill={bonncoColors.textPrimary} />
        ))}
      </svg>
      <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary, display: "block", textAlign: "center", mt: 0.5 }}>
        Price bounces off the same support and resistance levels repeatedly, other traders are watching the same levels too.
      </Typography>
    </Box>
  );
}
