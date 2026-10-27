import { baseAsset } from "./symbol";

// Binance's own icon CDN (bin.bnbstatic.com) blocks any request whose Referer isn't binance.com —
// confirmed via direct testing (200 with no/binance.com referer, 403 with any other origin). That
// makes it unusable for hotlinking from our own app, despite otherwise having great coverage.
//
// CoinCap's public icon CDN doesn't block by referer and covers the major/mid-cap coins we show.
// It's chained with the older spothq set as a second attempt, then a generic icon as the final
// fallback for symbols neither has (mostly very new/thin small-cap listings).
const COINCAP_BASE = "https://assets.coincap.io/assets/icons";
const SPOTHQ_BASE = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color";

export function primaryIconUrl(symbol: string): string {
  return `${COINCAP_BASE}/${baseAsset(symbol).toLowerCase()}@2x.png`;
}

export function secondaryIconUrl(symbol: string): string {
  return `${SPOTHQ_BASE}/${baseAsset(symbol).toLowerCase()}.svg`;
}

export const genericCoinIconUrl = `${SPOTHQ_BASE}/generic.svg`;
