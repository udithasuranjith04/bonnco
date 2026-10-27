import { Box, Stack, Typography } from "@mui/material";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CircleIcon from "@mui/icons-material/Circle";
import { useLiveTicker } from "../hooks/useLiveTicker";
import type { MarketType } from "../api/client";
import { bonncoColors } from "../theme/theme";

export default function LiveTickerBanner({
  symbol,
  marketType,
  fallbackPrice,
}: {
  symbol: string;
  marketType: MarketType;
  fallbackPrice: number;
}) {
  const { ticker, connected } = useLiveTicker(symbol, marketType);

  const price = ticker?.price ?? fallbackPrice;
  const changePercent = ticker?.price_change_percent;
  const isUp = (changePercent ?? 0) >= 0;
  const changeColor = changePercent === undefined ? bonncoColors.textSecondary : isUp ? bonncoColors.bullish : bonncoColors.bearish;

  return (
    <Stack direction="row" sx={{ alignItems: "baseline", gap: 2, flexWrap: "wrap", mb: 2 }}>
      <Typography sx={{ fontSize: { xs: 34, sm: 44 }, fontWeight: 700, lineHeight: 1 }}>
        ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
      </Typography>

      {changePercent !== undefined && (
        <Stack direction="row" sx={{ alignItems: "center", color: changeColor }}>
          {isUp ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
          <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
            {isUp ? "+" : ""}
            {changePercent.toFixed(2)}%
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
            24h
          </Typography>
        </Stack>
      )}

      {ticker && (
        <Stack direction="row" sx={{ gap: 2, ml: "auto" }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              24h High
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              ${ticker.high_24h.toLocaleString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              24h Low
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              ${ticker.low_24h.toLocaleString()}
            </Typography>
          </Box>
        </Stack>
      )}

      <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
        <CircleIcon sx={{ fontSize: "8px !important", color: connected ? bonncoColors.bullish : bonncoColors.textSecondary }} />
        <Typography variant="caption" color="text.secondary">
          {connected ? "Live" : "Connecting…"}
        </Typography>
      </Stack>
    </Stack>
  );
}
