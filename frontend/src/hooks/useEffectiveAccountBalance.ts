import { useEffect, useState } from "react";
import { fetchBinanceBalance, fetchSettings } from "../api/client";

const REFRESH_MS = 60_000;

export interface EffectiveBalance {
  amount: number;
  riskPct: number;
  source: "binance" | "manual";
  loading: boolean;
}

// The single source of truth every position-sizing calculator defers to: a real, connected
// Binance balance when available, falling back to the manually-entered Settings value otherwise.
// Refreshes periodically so a live balance stays current without the user reopening the page.
export default function useEffectiveAccountBalance(): EffectiveBalance {
  const [amount, setAmount] = useState(0);
  const [riskPct, setRiskPct] = useState(1);
  const [source, setSource] = useState<"binance" | "manual">("manual");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [settings, balance] = await Promise.all([fetchSettings(), fetchBinanceBalance()]);
        if (cancelled) return;
        setRiskPct(settings.default_risk_pct);
        if (balance.connected && balance.total_usd !== null && balance.total_usd > 0) {
          setAmount(balance.total_usd);
          setSource("binance");
        } else {
          setAmount(settings.account_size_usd);
          setSource("manual");
        }
      } catch {
        // Leave whatever was last successfully loaded in place — a transient failure here
        // shouldn't blank out a position-size suggestion that was working a moment ago.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { amount, riskPct, source, loading };
}
