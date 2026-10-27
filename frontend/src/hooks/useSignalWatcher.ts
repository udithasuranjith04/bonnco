import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWatchlist, fetchSettings, generateSignal } from "../api/client";
import type { SignalOut, SignalValue } from "../api/client";
import { useAlerts } from "../contexts/AlertsContext";
import { showBrowserNotification } from "../lib/browserNotifications";
import { playNotificationSound } from "../lib/notificationSound";
import { buildTradePrefillFromSignal, DIRECTIONAL_SIGNALS } from "../lib/tradePrefill";

const POLL_INTERVAL_MS = 60_000;

function lastSeenKey(symbol: string, marketType: string, timeframe: string): string {
  return `bonnco_last_signal:${symbol}:${marketType}:${timeframe}`;
}

function formatSignalLabel(signal: SignalValue): string {
  return signal.replace("_", " ");
}

// A watchlist coin genuinely crossing into a new strong directional call, above the user's
// configured confidence threshold — never fires on a repeated poll of the same call, and never
// fires on the very first observation of a coin (that would just be reporting its existing state
// as if it were breaking news).
export default function useSignalWatcher() {
  const { pushAlert } = useAlerts();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const [settings, watchlist] = await Promise.all([fetchSettings(), fetchWatchlist()]);
        if (cancelled) return;

        const enabled = watchlist.filter((w) => w.enabled);
        for (const item of enabled) {
          if (cancelled) return;
          const timeframe = settings.dashboard_timeframe;
          let signal: SignalOut;
          try {
            signal = await generateSignal(item.symbol, item.market_type, timeframe);
          } catch {
            continue; // insufficient data or a transient failure for this coin — skip, try again next cycle
          }

          const key = lastSeenKey(item.symbol, item.market_type, timeframe);
          const lastSeen = localStorage.getItem(key);
          localStorage.setItem(key, signal.signal);

          const isDirectional = DIRECTIONAL_SIGNALS.includes(signal.signal);
          const meetsThreshold = signal.confidence >= settings.entry_alert_confidence_threshold;
          const changed = lastSeen !== null && lastSeen !== signal.signal;

          if (!isDirectional || !meetsThreshold || !changed) continue;

          const title = `${item.symbol} just triggered a ${formatSignalLabel(signal.signal)} signal`;
          const message = `${signal.confidence}% confidence, ${timeframe} timeframe. Was ${lastSeen ? formatSignalLabel(lastSeen as SignalValue) : "no prior signal"} before this.`;

          const prefill = buildTradePrefillFromSignal(item.symbol, item.market_type, signal);
          const goToTradeForm = () => navigate("/journal", { state: { prefill } });

          pushAlert({
            kind: "signal",
            symbol: item.symbol,
            severity: "info",
            title,
            message,
            actionLabel: "Log this trade",
            onAction: goToTradeForm,
          });
          if (settings.sound_enabled) playNotificationSound("info");
          if (settings.notifications_enabled) showBrowserNotification(title, message, goToTradeForm);
        }
      } catch {
        // Settings/watchlist fetch failed for this cycle — try again on the next poll rather
        // than surfacing a disruptive error for a background check.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pushAlert, navigate]);
}
