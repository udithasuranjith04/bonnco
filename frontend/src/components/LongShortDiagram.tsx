import { Box, Stack, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { bonncoColors, monoStack } from "../theme/theme";

interface Side {
  label: string;
  color: string;
  icon: React.ReactNode;
  steps: number[];
  from: string;
  to: string;
  formula: string;
}

function StepBars({ steps, color }: { steps: number[]; color: string }) {
  const max = Math.max(...steps);
  return (
    <Stack direction="row" sx={{ alignItems: "flex-end", gap: 0.6, height: 56 }}>
      {steps.map((v, i) => (
        <Box
          key={i}
          sx={{
            width: 14,
            height: `${(v / max) * 100}%`,
            borderRadius: 0.5,
            backgroundColor: `${color}${i === steps.length - 1 ? "" : "80"}`,
          }}
        />
      ))}
    </Stack>
  );
}

function SidePanel({ side }: { side: Side }) {
  return (
    <Box sx={{ flex: 1, borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 2 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 1.25 }}>
        <Box sx={{ color: side.color, display: "flex" }}>{side.icon}</Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: side.color }}>
          {side.label}
        </Typography>
      </Stack>

      <StepBars steps={side.steps} color={side.color} />

      <Stack direction="row" sx={{ justifyContent: "space-between", mt: 1 }}>
        <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
          {side.from}
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
          {side.to}
        </Typography>
      </Stack>

      <Typography variant="caption" sx={{ display: "block", mt: 1.25, color: bonncoColors.textSecondary, lineHeight: 1.5 }}>
        {side.formula}
      </Typography>
    </Box>
  );
}

export default function LongShortDiagram() {
  const long: Side = {
    label: "LONG",
    color: bonncoColors.bullish,
    icon: <TrendingUpIcon fontSize="small" />,
    steps: [20, 32, 44, 56],
    from: "Buy low",
    to: "Sell high",
    formula: "Profit = Sell price − Buy price",
  };
  const short: Side = {
    label: "SHORT",
    color: bonncoColors.bearish,
    icon: <TrendingDownIcon fontSize="small" />,
    steps: [56, 44, 32, 20],
    from: "Sell high",
    to: "Buy back low",
    formula: "Profit = Sell price − Buy-back price",
  };

  return (
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5, width: "100%" }}>
      <SidePanel side={long} />
      <SidePanel side={short} />
    </Stack>
  );
}
