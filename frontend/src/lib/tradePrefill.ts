import type { MarketType, SignalOut, SignalValue, TradeSide } from "../api/client";

// Passed via react-router navigation state (`navigate("/journal", { state: { prefill } })`) from
// wherever a signal alert or signal card originates a "log this trade" action, and consumed once
// by TradeJournalPage to prefill the log-a-trade form. The user still reviews every field and
// clicks Add themselves — this only removes the manual copying between pages.
export interface TradePrefill {
  symbol: string;
  marketType: MarketType;
  side: TradeSide;
  entryPrice: number;
  stopLoss: number | null;
  leverageMin: number | null;
  leverageMax: number | null;
  reasoning: string | null;
}

const LONG_SIGNALS: SignalValue[] = ["BUY", "STRONG_BUY"];
export const DIRECTIONAL_SIGNALS: SignalValue[] = ["BUY", "STRONG_BUY", "SELL", "STRONG_SELL"];

export function buildTradePrefillFromSignal(symbol: string, marketType: MarketType, signal: SignalOut): TradePrefill {
  return {
    symbol,
    marketType,
    side: LONG_SIGNALS.includes(signal.signal) ? "long" : "short",
    entryPrice: signal.entry_price,
    stopLoss: signal.stop_loss,
    leverageMin: signal.suggested_leverage_min,
    leverageMax: signal.suggested_leverage_max,
    reasoning: signal.reasoning,
  };
}
