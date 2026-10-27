import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchActivePositions, fetchSettings } from "../api/client";
import type { ActivePositionOut, SignalValue } from "../api/client";
import { useAlerts } from "../contexts/AlertsContext";
import { showBrowserNotification } from "../lib/browserNotifications";
import { playNotificationSound } from "../lib/notificationSound";

const POLL_INTERVAL_MS = 45_000;

// A pnl_pct this large, combined with the original thesis no longer agreeing, is treated as
// "worth considering locking in some profit" — a suggestion, never an instruction.
const LARGE_FAVORABLE_MOVE_PCT = 8;

const LONG_AGREE_SIGNALS: SignalValue[] = ["BUY", "STRONG_BUY"];
const SHORT_AGREE_SIGNALS: SignalValue[] = ["SELL", "STRONG_SELL"];

interface PositionAlertState {
  stopWarning: boolean;
  opposes: boolean;
  takeProfitFired: boolean;
}

const DEFAULT_STATE: PositionAlertState = { stopWarning: false, opposes: false, takeProfitFired: false };

function stateKey(tradeId: number): string {
  return `bonnco_position_alert_state:${tradeId}`;
}

function loadState(tradeId: number): PositionAlertState {
  const raw = localStorage.getItem(stateKey(tradeId));
  if (!raw) return { ...DEFAULT_STATE };
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(tradeId: number, state: PositionAlertState): void {
  localStorage.setItem(stateKey(tradeId), JSON.stringify(state));
}

// For an OPEN position, current risk state (near stop, thesis flipped) is always actionable —
// unlike entry alerts, this deliberately DOES fire on the very first check of a position if the
// condition is already true then, since hiding real risk just because it's the first look would
// defeat the point. Each condition still only re-fires on a genuine transition, not every poll.
export default function usePositionWatcher() {
  const { pushAlert } = useAlerts();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const settings = await fetchSettings();
        if (cancelled || !settings.position_alerts_enabled) return;

        let positions: ActivePositionOut[];
        try {
          positions = await fetchActivePositions();
        } catch {
          return;
        }
        if (cancelled) return;

        for (const position of positions) {
          const { trade, current_signal, pnl_pct, guidance, stop_warning } = position;
          const prev = loadState(trade.id);

          const isLong = trade.side === "long";
          const agrees = current_signal ? (isLong ? LONG_AGREE_SIGNALS : SHORT_AGREE_SIGNALS).includes(current_signal) : false;
          const opposes = current_signal ? (isLong ? SHORT_AGREE_SIGNALS : LONG_AGREE_SIGNALS).includes(current_signal) : false;
          const hasStopWarning = stop_warning !== null;
          const takeProfitCandidate = pnl_pct >= LARGE_FAVORABLE_MOVE_PCT && !agrees;

          const goToPosition = () => navigate("/journal");

          if (hasStopWarning && !prev.stopWarning) {
            const title = `${trade.symbol}: approaching your stop-loss`;
            pushAlert({
              kind: "position",
              symbol: trade.symbol,
              severity: "critical",
              dedupeKey: `position:${trade.id}:stop`,
              title,
              message: stop_warning!,
              actionLabel: "View position",
              onAction: goToPosition,
            });
            if (settings.sound_enabled) playNotificationSound("critical");
            if (settings.notifications_enabled) showBrowserNotification(title, stop_warning!, goToPosition);
          }

          if (opposes && !prev.opposes) {
            const title = `${trade.symbol}: original thesis has flipped`;
            pushAlert({
              kind: "position",
              symbol: trade.symbol,
              severity: "warning",
              dedupeKey: `position:${trade.id}:thesis`,
              title,
              message: guidance,
              actionLabel: "View position",
              onAction: goToPosition,
            });
            if (settings.sound_enabled) playNotificationSound("warning");
            if (settings.notifications_enabled) showBrowserNotification(title, guidance, goToPosition);
          }

          if (takeProfitCandidate && !prev.takeProfitFired) {
            const title = `${trade.symbol}: up ${pnl_pct.toFixed(1)}%, momentum weakening`;
            const message = `A large favorable move with the original signal no longer confirming — might be worth considering locking in some profit. Your call either way.`;
            pushAlert({
              kind: "position",
              symbol: trade.symbol,
              severity: "positive",
              dedupeKey: `position:${trade.id}:take-profit`,
              title,
              message,
              actionLabel: "View position",
              onAction: goToPosition,
            });
            if (settings.sound_enabled) playNotificationSound("positive");
            if (settings.notifications_enabled) showBrowserNotification(title, message, goToPosition);
          }

          saveState(trade.id, { stopWarning: hasStopWarning, opposes, takeProfitFired: takeProfitCandidate });
        }
      } catch {
        // Settings fetch failed for this cycle — try again on the next poll.
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
