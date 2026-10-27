import { useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, DialogContent, Divider, Stack, Typography } from "@mui/material";
import CircleIcon from "@mui/icons-material/Circle";
import { fetchCheckin } from "../api/client";
import type { CheckinOut } from "../api/client";
import CoinIcon from "./CoinIcon";
import SignalBadge from "./SignalBadge";
import { bonncoColors, monoStack } from "../theme/theme";

const SESSION_FLAG_KEY = "bonnco_checkin_shown";

function fmtUsd(v: number): string {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 0 })}`;
}

export default function SessionCheckinModal() {
  const [checkin, setCheckin] = useState<CheckinOut | null>(null);
  const [open, setOpen] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    if (sessionStorage.getItem(SESSION_FLAG_KEY)) return;
    fetchCheckin()
      .then((data) => {
        setCheckin(data);
        setOpen(true);
        sessionStorage.setItem(SESSION_FLAG_KEY, "1");
      })
      .catch(() => {
        // Silent — this is a convenience summary, not critical path. If it fails, the user still
        // has every page it summarizes available individually.
      });
  }, []);

  if (!checkin) return null;

  const { goal, total_value_usd, today_pnl_usd, today_pnl_pct, open_positions, best_watchlist_signal } = checkin;
  const pnlColor = today_pnl_usd === null ? bonncoColors.textSecondary : today_pnl_usd >= 0 ? bonncoColors.bullish : bonncoColors.bearish;

  return (
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
      <DialogContent sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.25 }}>
          Where things stand
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          A quick real-data snapshot for this session — not a forecast, just what's actually true right now.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            mb: 2.5,
          }}
        >
          <Box>
            <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary }}>
              BALANCE
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ fontFamily: monoStack }}>
              {total_value_usd !== null ? fmtUsd(total_value_usd) : "—"}
            </Typography>
            {goal.next_milestone_usd !== null && (
              <Typography variant="caption" color="text.secondary">
                {goal.progress_to_next_pct !== null
                  ? `${goal.progress_to_next_pct}% to next milestone, ${fmtUsd(goal.next_milestone_usd)}`
                  : `Next milestone: ${fmtUsd(goal.next_milestone_usd)}`}
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary }}>
              TODAY'S P&amp;L
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ fontFamily: monoStack, color: pnlColor }}>
              {today_pnl_usd !== null ? `${today_pnl_usd >= 0 ? "+" : ""}${fmtUsd(today_pnl_usd)}` : "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {today_pnl_pct !== null ? `${today_pnl_usd! >= 0 ? "+" : ""}${today_pnl_pct}% today` : "Unavailable right now"}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary, display: "block", mb: 1 }}>
          OPEN POSITIONS
        </Typography>
        {open_positions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            None right now.
          </Typography>
        ) : (
          <Stack sx={{ gap: 1, mb: 2 }}>
            {open_positions.map((p) => (
              <Stack key={p.symbol} direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <CoinIcon symbol={p.symbol} size={18} />
                  <Typography variant="body2" fontWeight={600}>
                    {p.symbol}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.side} · {p.leverage}x
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ fontFamily: monoStack, color: p.unrealized_pnl >= 0 ? bonncoColors.bullish : bonncoColors.bearish }}
                >
                  {p.unrealized_pnl >= 0 ? "+" : ""}
                  {fmtUsd(p.unrealized_pnl)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}

        <Divider sx={{ mb: 2 }} />

        <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary, display: "block", mb: 1 }}>
          HIGHEST-CONFIDENCE WATCHLIST SIGNAL
        </Typography>
        {best_watchlist_signal ? (
          <Box>
            <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.5 }}>
              <CoinIcon symbol={best_watchlist_signal.symbol} size={18} />
              <Typography variant="body2" fontWeight={700}>
                {best_watchlist_signal.symbol}
              </Typography>
              <SignalBadge signal={best_watchlist_signal.signal} size="small" />
              <Stack direction="row" sx={{ alignItems: "center", gap: 0.4 }}>
                <CircleIcon sx={{ fontSize: "5px !important", color: bonncoColors.textSecondary }} />
                <Typography variant="caption" color="text.secondary">
                  {best_watchlist_signal.confidence}% confidence
                </Typography>
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              {best_watchlist_signal.reasoning}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No directional signal on your watchlist right now.
          </Typography>
        )}

        <Stack direction="row" sx={{ justifyContent: "flex-end", mt: 3 }}>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
