import { Box, Stack, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

const MOVE_PCT = 5;
const LEVERAGE_TIERS = [1, 5, 10, 25];

export default function LeverageDiagram() {
  const maxPct = Math.max(...LEVERAGE_TIERS) * MOVE_PCT;

  return (
    <Box sx={{ width: "100%", borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 2 }}>
      <Typography variant="caption" sx={{ display: "block", mb: 1.25, color: bonncoColors.textSecondary }}>
        Same {MOVE_PCT}% price move, different leverage: effect on your margin
      </Typography>

      <Stack sx={{ gap: 1 }}>
        {LEVERAGE_TIERS.map((lev) => {
          const pct = lev * MOVE_PCT;
          const barPct = (pct / maxPct) * 48;
          return (
            <Stack key={lev} direction="row" sx={{ alignItems: "center", gap: 1 }}>
              <Typography variant="caption" sx={{ fontFamily: monoStack, width: 30, flexShrink: 0, fontWeight: 700 }}>
                {lev}x
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: monoStack, width: 44, textAlign: "right", color: bonncoColors.bearish }}>
                -{pct}%
              </Typography>
              <Box sx={{ flex: 1, position: "relative", height: 12 }}>
                <Box sx={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", backgroundColor: bonncoColors.border }} />
                <Box sx={{ position: "absolute", top: 0, height: "100%", right: "50%", width: `${barPct}%`, backgroundColor: bonncoColors.bearish, borderRadius: "3px 0 0 3px" }} />
                <Box sx={{ position: "absolute", top: 0, height: "100%", left: "50%", width: `${barPct}%`, backgroundColor: bonncoColors.bullish, borderRadius: "0 3px 3px 0" }} />
              </Box>
              <Typography variant="caption" sx={{ fontFamily: monoStack, width: 44, color: bonncoColors.bullish }}>
                +{pct}%
              </Typography>
            </Stack>
          );
        })}
      </Stack>

      <Typography variant="caption" sx={{ display: "block", mt: 1.25, color: bonncoColors.textSecondary, lineHeight: 1.5 }}>
        At 25x leverage, a {MOVE_PCT}% move against you wipes out your entire margin (a 125% loss is not possible, so
        that position would be liquidated before reaching it).
      </Typography>
    </Box>
  );
}
