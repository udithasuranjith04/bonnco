import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Badge, Box, Fab, Fade, Paper, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { fetchCheckin } from "../api/client";
import type { CheckinOut } from "../api/client";
import { useAlerts } from "../contexts/AlertsContext";
import { onOpenAssistantRequested, requestOpenAssistant } from "../lib/assistantBridge";
import CockpitChatWidget from "./CockpitChatWidget";
import { bonncoColors } from "../theme/theme";

// Same passive-refresh cadence as the other always-on panels in the app (Active Positions, the
// nav goal indicator) — a REST poll, not a new WebSocket channel, since this aggregates several
// backend sources (goal, portfolio summary, positions, latest stored signal) rather than tracking
// one live price. Keeps polling even while the panel is closed so the notification badge (a fresh
// milestone) stays accurate without the user having to open it first.
const REFRESH_MS = 30_000;
const PANEL_WIDTH = 360;

// "Daily" here means once per calendar UTC date — stored in localStorage (not sessionStorage) so
// it survives across tabs/reloads and genuinely fires once a day, not once per browser session.
// This is deliberately separate from — and doesn't replace — the once-per-session check-in modal;
// this is a lighter, non-interruptive badge nudge, not another popup.
const DAILY_CHECKIN_ALERT_DATE_KEY = "bonnco_daily_checkin_alert_date";

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtUsd(v: number): string {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 0 })}`;
}

// Maps the current route to a page identifier the backend knows how to build real screen context
// for (see chat_context.py's build_page_context) — e.g. so "the target" on the Dashboard resolves
// to the goal/milestone tracker actually shown there instead of only ever assuming a coin.
function pageContextKey(pathname: string): string | null {
  if (pathname === "/") return "dashboard";
  if (pathname === "/journal") return "journal";
  return null;
}

export default function CockpitWidget() {
  const [open, setOpen] = useState(false);
  const [checkin, setCheckin] = useState<CheckinOut | null>(null);
  const { alerts, unreadCount, pushAlert, markAllRead } = useAlerts();
  const location = useLocation();
  const page = pageContextKey(location.pathname);
  // Tracks the highest milestone we've already pushed a badge alert for, so the still-unacknowledged
  // milestone (its `newly_reached_milestone_usd` stays non-null until the user explicitly
  // acknowledges it in the panel below) doesn't get re-pushed as a "new" unread alert on every
  // 30s poll — it should notify exactly once per real milestone crossed, not repeatedly.
  const lastAlertedMilestoneRef = useRef<number | null>(null);

  const load = useCallback(() => {
    fetchCheckin()
      .then((data) => {
        setCheckin(data);
        const best = data.best_watchlist_signal;

        const milestone = data.goal.newly_reached_milestone_usd;
        if (milestone !== null && milestone !== lastAlertedMilestoneRef.current) {
          lastAlertedMilestoneRef.current = milestone;
          pushAlert({
            kind: "goal",
            symbol: "GOAL",
            severity: "positive",
            dedupeKey: `goal:milestone:${milestone}`,
            title: `Milestone reached — ${fmtUsd(milestone)}`,
            message: "Your real balance passed this milestone. Open the assistant to see it and your next one.",
            actionLabel: "Open assistant",
            onAction: requestOpenAssistant,
          });
        }

        // Once per calendar day: a single bundled "here's what's happening" summary, reusing the
        // exact same check-in data already computed above — not a new analysis, just surfaced
        // proactively instead of only when the user happens to open the widget themselves.
        const today = todayUtcDateString();
        if (localStorage.getItem(DAILY_CHECKIN_ALERT_DATE_KEY) !== today) {
          localStorage.setItem(DAILY_CHECKIN_ALERT_DATE_KEY, today);
          const balance = data.total_value_usd !== null ? fmtUsd(data.total_value_usd) : "unavailable";
          const pnl = data.today_pnl_usd !== null ? `${data.today_pnl_usd >= 0 ? "+" : ""}${fmtUsd(data.today_pnl_usd)}` : "unavailable";
          const positionsPart = `${data.open_positions.length} open position${data.open_positions.length === 1 ? "" : "s"}`;
          const nextMilestonePart = data.goal.next_milestone_usd !== null ? `next milestone ${fmtUsd(data.goal.next_milestone_usd)}` : "no milestone set yet";
          const signalPart = best ? `Top watchlist signal: ${best.symbol} ${best.signal} at ${best.confidence}% confidence.` : "No directional signal on your watchlist right now.";
          pushAlert({
            kind: "checkin",
            symbol: "CHECKIN",
            severity: "info",
            dedupeKey: "checkin:daily",
            title: "Daily check-in",
            message: `Balance ${balance} (${nextMilestonePart}). Today's P&L: ${pnl}. ${positionsPart}. ${signalPart}`,
            actionLabel: "Open assistant",
            onAction: requestOpenAssistant,
          });
        }
      })
      .catch(() => {
        // Silent — passive widget, other pages still work if this fails.
      });
  }, [pushAlert]);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => onOpenAssistantRequested(() => setOpen(true)), []);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) markAllRead();
      return next;
    });
  }

  return (
    <>
      <Fade in={open}>
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            bottom: 96,
            right: 24,
            width: PANEL_WIDTH,
            maxHeight: "75vh",
            display: "flex",
            flexDirection: "column",
            borderRadius: 2,
            overflow: "hidden",
            zIndex: 1301,
            backgroundColor: bonncoColors.bgPaper,
          }}
        >
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderBottom: `1px solid ${bonncoColors.border}` }}
          >
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
              <AutoAwesomeIcon sx={{ fontSize: 16, color: bonncoColors.accent }} />
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: 15 }}>
                Bonnco
              </Typography>
            </Stack>
          </Stack>

          <Box sx={{ px: 2, pt: 1.5, pb: 2, overflowY: "auto", flexGrow: 1, display: "flex", flexDirection: "column" }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              Real data, refreshed automatically. Guidance, not a guarantee — every trade is still yours to decide.
            </Typography>

            <CockpitChatWidget
              symbol={checkin?.best_watchlist_signal?.symbol ?? null}
              marketType={checkin?.best_watchlist_signal?.market_type ?? "spot"}
              timeframe={checkin?.best_watchlist_signal?.timeframe ?? "1h"}
              page={page}
              proactiveNotes={alerts
                // Deliberately not filtered on `!a.read` — opening the panel marks alerts read
                // immediately (clearing the badge, as specified), but the note itself must stay
                // visible for this session rather than disappearing the instant it's opened, or
                // the user would never actually see what the badge was for.
                .filter((a) => a.kind === "goal" || a.kind === "checkin")
                .map((a) => ({ id: a.id, title: a.title, content: a.message }))}
            />
          </Box>
        </Paper>
      </Fade>

      <Badge
        badgeContent={unreadCount}
        max={9}
        invisible={unreadCount === 0 || open}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1302,
          "& .MuiBadge-badge": { backgroundColor: bonncoColors.bearish, color: "#fff", fontWeight: 700 },
        }}
      >
        <Fab
          onClick={toggleOpen}
          sx={{
            backgroundColor: bonncoColors.accent,
            color: "#fff",
            "&:hover": { backgroundColor: bonncoColors.accent, opacity: 0.9 },
          }}
        >
          {open ? <CloseIcon /> : <AutoAwesomeIcon />}
        </Fab>
      </Badge>
    </>
  );
}
