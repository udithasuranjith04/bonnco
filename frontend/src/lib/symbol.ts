export const QUOTE_SUFFIXES = ["USDT", "FDUSD", "USDC", "BUSD", "TUSD", "USD"];
const DEFAULT_QUOTE = "USDT";

export function baseAsset(symbol: string): string {
  for (const suffix of QUOTE_SUFFIXES) {
    if (symbol.endsWith(suffix) && symbol.length > suffix.length) {
      return symbol.slice(0, -suffix.length);
    }
  }
  return symbol;
}

/**
 * Turns whatever a user typed into a valid Binance trading-pair symbol. Binance's API only
 * accepts full pairs like "SOLUSDT" — a bare base asset like "SOL" is rejected outright (400).
 * If the input doesn't already end in a recognized quote asset, USDT is appended, since that's
 * the pair convention used everywhere else in this app.
 */
export function normalizeSymbolInput(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return cleaned;

  const alreadyHasQuote = QUOTE_SUFFIXES.some(
    (suffix) => cleaned.endsWith(suffix) && cleaned.length > suffix.length,
  );
  return alreadyHasQuote ? cleaned : `${cleaned}${DEFAULT_QUOTE}`;
}
