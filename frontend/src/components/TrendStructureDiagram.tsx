import { Box, Stack, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

// Three side-by-side panels teaching the three trend structures by the shape of swing points
// alone, y is inverted (0 = top = higher price) matching every other diagram in this file.
type Point = [number, number];

interface Panel {
  label: string;
  color: string;
  path: Point[];
}

const PANELS: Panel[] = [
  {
    label: "Uptrend",
    color: bonncoColors.bullish,
    path: [
      [4, 80],
      [22, 55],
      [38, 65],
      [56, 35],
      [72, 48],
      [90, 15],
    ],
  },
  {
    label: "Downtrend",
    color: bonncoColors.bearish,
    path: [
      [4, 15],
      [22, 40],
      [38, 30],
      [56, 60],
      [72, 48],
      [90, 82],
    ],
  },
  {
    label: "Sideways / range",
    color: bonncoColors.accent,
    path: [
      [4, 55],
      [22, 30],
      [38, 62],
      [56, 32],
      [72, 60],
      [90, 34],
    ],
  },
];

function toPath(points: Point[]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function PanelSvg({ panel }: { panel: Panel }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Box sx={{ height: 110, borderRadius: 1, backgroundColor: bonncoColors.bgDefault }}>
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={toPath(panel.path)}
            fill="none"
            stroke={panel.color}
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {panel.path.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.8} fill={panel.color} />
          ))}
        </svg>
      </Box>
      <Typography
        variant="caption"
        sx={{ fontFamily: monoStack, letterSpacing: "0.04em", color: panel.color, fontWeight: 700, display: "block", textAlign: "center", mt: 0.6 }}
      >
        {panel.label.toUpperCase()}
      </Typography>
    </Box>
  );
}

export default function TrendStructureDiagram() {
  return (
    <Box sx={{ width: "100%", borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 1.5 }}>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        {PANELS.map((panel) => (
          <PanelSvg key={panel.label} panel={panel} />
        ))}
      </Stack>
      <Typography variant="caption" sx={{ color: bonncoColors.textSecondary, display: "block", mt: 1, lineHeight: 1.4 }}>
        Uptrend: each swing high and swing low lands higher than the last. Downtrend: each lands lower. Range: swings
        stay roughly between the same two levels, no clear direction.
      </Typography>
    </Box>
  );
}
