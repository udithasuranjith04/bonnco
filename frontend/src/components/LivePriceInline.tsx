import { Typography } from "@mui/material";
import { useLiveTicker } from "../hooks/useLiveTicker";
import type { MarketType } from "../api/client";
import { bonncoColors } from "../theme/theme";

export default function LivePriceInline({ symbol, marketType }: { symbol: string; marketType: MarketType }) {
  const { ticker } = useLiveTicker(symbol, marketType);

  if (!ticker) return null;

  const isUp = ticker.price_change_percent >= 0;
  const color = isUp ? bonncoColors.bullish : bonncoColors.bearish;

  return (
    <Typography variant="caption" sx={{ color, fontWeight: 700 }}>
      ${ticker.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
    </Typography>
  );
}
