import { Box, Stack, Typography } from "@mui/material";
import PatternDiagram from "./PatternDiagram";
import type { Point } from "./PatternDiagram";
import { bonncoColors, monoStack } from "../theme/theme";

export default function TimeframeCompareDiagram({
  top,
  bottom,
}: {
  top: { label: string; points: Point[] };
  bottom: { label: string; points: Point[] };
}) {
  return (
    <Stack sx={{ gap: 1 }}>
      <Box>
        <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary, display: "block", mb: 0.4 }}>
          {top.label}
        </Typography>
        <PatternDiagram points={top.points} bias="neutral" height={54} />
      </Box>
      <Box>
        <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary, display: "block", mb: 0.4 }}>
          {bottom.label}
        </Typography>
        <PatternDiagram points={bottom.points} bias="neutral" height={54} />
      </Box>
    </Stack>
  );
}
