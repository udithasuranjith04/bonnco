import { Box } from "@mui/material";
import { primaryIconUrl, secondaryIconUrl, genericCoinIconUrl } from "../lib/coinIcon";

export default function CoinIcon({ symbol, size = 20 }: { symbol: string; size?: number }) {
  return (
    <Box
      component="img"
      src={primaryIconUrl(symbol)}
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        const stage = img.dataset.fallbackStage;
        if (!stage) {
          img.dataset.fallbackStage = "secondary";
          img.src = secondaryIconUrl(symbol);
        } else if (stage === "secondary") {
          img.dataset.fallbackStage = "generic";
          img.src = genericCoinIconUrl;
        }
        // stage === "generic": no further fallback, let it render as a broken image if even this fails
      }}
      alt=""
      sx={{ width: size, height: size, borderRadius: "50%", flexShrink: 0 }}
    />
  );
}
