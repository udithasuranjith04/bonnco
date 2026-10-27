import { Box, Stack, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";
import CandlestickDiagram from "./CandlestickDiagram";
import type { IllustrativeCandle } from "./CandlestickDiagram";

// Calm: small, similar-sized bodies, short wicks, gentle drift. Dangerous: wide, inconsistent
// bodies, long wicks in both directions, and rapid color flips, real, exaggerated-for-clarity
// shapes, not a specific coin's real candle history.
const CALM: IllustrativeCandle[] = [
  { open: 52, high: 49, low: 55, close: 50 },
  { open: 50, high: 47, low: 52, close: 48 },
  { open: 48, high: 46, low: 51, close: 49 },
  { open: 49, high: 45, low: 51, close: 46 },
  { open: 46, high: 44, low: 49, close: 47 },
  { open: 47, high: 43, low: 49, close: 44 },
  { open: 44, high: 42, low: 47, close: 45 },
  { open: 45, high: 41, low: 47, close: 42 },
];

const DANGEROUS: IllustrativeCandle[] = [
  { open: 55, high: 20, low: 60, close: 30 },
  { open: 30, high: 25, low: 70, close: 65 },
  { open: 65, high: 15, low: 68, close: 22 },
  { open: 22, high: 18, low: 78, close: 72 },
  { open: 72, high: 10, low: 75, close: 18 },
  { open: 18, high: 12, low: 60, close: 55 },
  { open: 55, high: 8, low: 58, close: 14 },
  { open: 14, high: 5, low: 50, close: 45 },
];

export default function VolatilityCompareDiagram() {
  return (
    <Box sx={{ width: "100%", borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 1.5 }}>
      <Stack direction="row" sx={{ gap: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <CandlestickDiagram candles={CALM} height={130} />
          <Typography
            variant="caption"
            sx={{ fontFamily: monoStack, letterSpacing: "0.04em", color: bonncoColors.bullish, fontWeight: 700, display: "block", textAlign: "center", mt: 0.6 }}
          >
            CALM
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <CandlestickDiagram candles={DANGEROUS} height={130} />
          <Typography
            variant="caption"
            sx={{ fontFamily: monoStack, letterSpacing: "0.04em", color: bonncoColors.bearish, fontWeight: 700, display: "block", textAlign: "center", mt: 0.6 }}
          >
            VOLATILE / DANGEROUS
          </Typography>
        </Box>
      </Stack>
      <Typography variant="caption" sx={{ color: bonncoColors.textSecondary, display: "block", mt: 1, lineHeight: 1.4 }}>
        Calm: small, similar-sized bodies, short wicks, gentle drift. Volatile: wide, inconsistent bodies, long wicks
        both directions, and color flipping candle to candle, wider stops and smaller size are usually warranted here.
      </Typography>
    </Box>
  );
}
