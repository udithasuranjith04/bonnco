import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

// Maps directly to color + urgency in the notification panel and to which chime plays:
// critical = real risk (stop-loss proximity), warning = meaningful change (thesis flip),
// positive = good news needing a decision (take-profit-worthy), info = a new opportunity (entry signal).
export type AlertSeverity = "critical" | "warning" | "positive" | "info";

export interface AppAlert {
  id: string;
  kind: "signal" | "position" | "goal" | "checkin";
  symbol: string;
  severity: AlertSeverity;
  // Distinguishes independent alert types for the same coin (e.g. a stop-loss warning vs. a
  // thesis flip on the same open position) so pushing one never silently replaces the other.
  // Defaults to `${kind}:${symbol}` when omitted, matching callers that only ever have one live
  // alert per coin.
  dedupeKey?: string;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  actionLabel: string;
  onAction: () => void;
}

// Retention cap for the notification panel's history — it scrolls, so this is just a sane bound
// against unbounded growth over a long-running session, not a "visible at once" limit.
const MAX_ALERTS = 30;

interface AlertsContextValue {
  alerts: AppAlert[];
  unreadCount: number;
  hasUnreadCritical: boolean;
  pushAlert: (alert: Omit<AppAlert, "id" | "createdAt" | "read">) => void;
  dismissAlert: (id: string) => void;
  markAllRead: () => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);

  const pushAlert = useCallback((alert: Omit<AppAlert, "id" | "createdAt" | "read">) => {
    setAlerts((prev) => {
      const dedupeKey = alert.dedupeKey ?? `${alert.kind}:${alert.symbol}`;
      // One live alert per dedupeKey at a time — a fresh alert of the same type for the same
      // coin replaces its stale predecessor, but distinct alert types for the same coin (e.g. a
      // stop-loss warning and a thesis flip on the same position) coexist rather than clobbering.
      const withoutStale = prev.filter((a) => (a.dedupeKey ?? `${a.kind}:${a.symbol}`) !== dedupeKey);
      const next: AppAlert = { ...alert, dedupeKey, id: `${dedupeKey}:${Date.now()}`, createdAt: Date.now(), read: false };
      return [next, ...withoutStale].slice(0, MAX_ALERTS);
    });
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const markAllRead = useCallback(() => {
    setAlerts((prev) => prev.map((a) => (a.read ? a : { ...a, read: true })));
  }, []);

  const unreadCount = alerts.filter((a) => !a.read).length;
  const hasUnreadCritical = alerts.some((a) => !a.read && a.severity === "critical");

  const value = useMemo(
    () => ({ alerts, unreadCount, hasUnreadCritical, pushAlert, dismissAlert, markAllRead }),
    [alerts, unreadCount, hasUnreadCritical, pushAlert, dismissAlert, markAllRead],
  );

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertsProvider");
  return ctx;
}
