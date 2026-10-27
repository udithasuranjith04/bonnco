import { Box, Stack, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

interface Region {
  label: string;
  detail: string;
}

function RegionBox({ label, detail, sx }: Region & { sx?: object }) {
  return (
    <Box
      sx={{
        border: `1px dashed ${bonncoColors.border}`,
        borderRadius: 1,
        p: 1.25,
        display: "flex",
        flexDirection: "column",
        gap: 0.4,
        ...sx,
      }}
    >
      <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.04em", fontWeight: 700, color: bonncoColors.accent }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: bonncoColors.textSecondary, lineHeight: 1.4 }}>
        {detail}
      </Typography>
    </Box>
  );
}

// A schematic, non-branded wireframe of a typical exchange trading screen's regions, not a
// pixel copy of any specific exchange's real interface, exact positions vary by platform and by
// desktop/mobile, this illustrates roughly where each tool tends to live and what it does.
export default function PlatformLayoutDiagram({ futures = false }: { futures?: boolean }) {
  return (
    <Box sx={{ width: "100%", borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 1.5 }}>
      <Stack sx={{ gap: 1 }}>
        <RegionBox label="Pair / price header" detail="Symbol search, current price, 24h change and volume." />

        <Stack direction="row" sx={{ gap: 1, alignItems: "stretch" }}>
          <RegionBox
            label="Chart area"
            detail="Chart-type switcher (candlestick/line/bar), timeframe selector, an 'Indicators' button to add MA/BOLL/MACD/RSI, and drawing tools (trend lines, Fibonacci, horizontal levels)."
            sx={{ flex: 2.2 }}
          />
          <Stack sx={{ flex: 1, gap: 1 }}>
            <RegionBox label="Order book" detail="Live bids (buy orders) and asks (sell orders), stacked by price." />
            <RegionBox label="Recent trades" detail="A running feed of the most recent executed trades." />
          </Stack>
        </Stack>

        <RegionBox
          label={futures ? "Order form (futures)" : "Order form"}
          detail={
            futures
              ? "Order type tabs (Market/Limit/Stop), Buy/Long and Sell/Short buttons, plus leverage slider and cross/isolated margin toggle."
              : "Order type tabs (Market/Limit/Stop-Limit), amount field, and Buy/Sell buttons."
          }
        />
      </Stack>
    </Box>
  );
}
