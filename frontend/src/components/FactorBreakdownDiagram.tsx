import { Box, Stack, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

export interface FactorBar {
  label: string;
  value: number;
}

export default function FactorBreakdownDiagram({ factors, height = 150 }: { factors: FactorBar[]; height?: number }) {
  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.value)), 1);

  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 2, display: "flex", flexDirection: "column", justifyContent: "center", gap: 0.85 }}>
      {factors.map((f) => {
        const pct = (Math.abs(f.value) / maxAbs) * 50;
        const color = f.value > 0 ? bonncoColors.bullish : f.value < 0 ? bonncoColors.bearish : bonncoColors.textSecondary;
        return (
          <Stack key={f.label} direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Typography variant="caption" sx={{ width: 58, flexShrink: 0, color: bonncoColors.textSecondary }}>
              {f.label}
            </Typography>
            <Box sx={{ flex: 1, position: "relative", height: 10 }}>
              <Box sx={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", backgroundColor: bonncoColors.border }} />
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  height: "100%",
                  left: f.value >= 0 ? "50%" : `${50 - pct}%`,
                  width: `${pct}%`,
                  backgroundColor: color,
                  borderRadius: 0.5,
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ fontFamily: monoStack, width: 32, textAlign: "right", color }}>
              {f.value > 0 ? "+" : ""}
              {f.value}
            </Typography>
          </Stack>
        );
      })}
    </Box>
  );
}
