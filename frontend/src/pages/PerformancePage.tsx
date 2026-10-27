import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Card, Divider, LinearProgress, Stack, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { fetchSignalOutcomeStats } from "../api/client";
import type { OutcomeBucket, SignalOutcomeStatsOut } from "../api/client";
import CoinIcon from "../components/CoinIcon";
import StatCell from "../components/StatCell";
import DashboardEmptyState from "../components/DashboardEmptyState";
import { bonncoColors, monoStack } from "../theme/theme";

const GRID_PCTS = [0, 25, 50, 75, 100];
const LABEL_COL_WIDTH = 128;
const VALUE_COL_WIDTH = 66;
const SAMPLE_COL_WIDTH = 84;

function winRateColor(winRate: number | null): string {
  if (winRate === null) return bonncoColors.textSecondary;
  if (winRate >= 55) return bonncoColors.bullish;
  if (winRate <= 45) return bonncoColors.bearish;
  return bonncoColors.textPrimary;
}

function SampleSizeNote({ resolved, reliableSampleSize }: { resolved: number; reliableSampleSize: number }) {
  if (resolved === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No resolved signals yet.
      </Typography>
    );
  }
  if (resolved < reliableSampleSize) {
    return (
      <Typography variant="caption" sx={{ color: bonncoColors.neutral }}>
        Based on {resolved} resolved signal{resolved === 1 ? "" : "s"}. Accuracy stats become more reliable with
        more data.
      </Typography>
    );
  }
  return (
    <Typography variant="caption" color="text.secondary">
      Based on {resolved.toLocaleString()} resolved signals.
    </Typography>
  );
}

interface Row extends OutcomeBucket {
  label: string;
  coinIcon?: boolean;
}

// A real chart, not a table: every bar shares the same 0-100% axis (drawn once, at the top) so
// comparing rows is a glance, not a read. The stop-loss caveat, which used to repeat as a full
// sentence under nearly every row, is now a single legend line plus a small icon+tooltip per
// affected row — the information survives, the repetition doesn't.
function WinRateChart({ rows, reliableSampleSize }: { rows: Row[]; reliableSampleSize: number }) {
  const anyStoppedOut = rows.some((r) => r.stopped_out > 0);

  if (rows.length === 0) {
    return <DashboardEmptyState icon={<WarningAmberOutlinedIcon fontSize="small" />} text="No resolved signals yet." />;
  }

  return (
    <Box sx={{ px: 2.5, pb: 2 }}>
      {anyStoppedOut && (
        <Stack direction="row" sx={{ alignItems: "center", gap: 0.6, mb: 1.5, color: bonncoColors.neutral }}>
          <WarningAmberOutlinedIcon sx={{ fontSize: 15 }} />
          <Typography variant="caption">
            Rows marked <Box component="span" sx={{ fontWeight: 700 }}>⚠</Box> include signals stopped out before this
            checkpoint. Counted as wrong here, not a re-check of the price direction call itself.
          </Typography>
        </Stack>
      )}

      {/* Shared axis, drawn once */}
      <Stack direction="row" sx={{ pl: `${LABEL_COL_WIDTH}px`, pr: `${VALUE_COL_WIDTH + SAMPLE_COL_WIDTH}px`, mb: 0.5 }}>
        <Box sx={{ flex: 1, position: "relative", height: 14 }}>
          {GRID_PCTS.map((g) => (
            <Typography
              key={g}
              variant="caption"
              sx={{
                position: "absolute",
                left: `${g}%`,
                transform: g === 100 ? "translateX(-100%)" : g === 0 ? "none" : "translateX(-50%)",
                fontFamily: monoStack,
                fontSize: 10,
                color: bonncoColors.textSecondary,
              }}
            >
              {g}
            </Typography>
          ))}
        </Box>
      </Stack>

      <Box
        sx={{
          maxHeight: 400,
          overflowY: "auto",
          "&::-webkit-scrollbar": { width: 8 },
          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: bonncoColors.bgElevated,
            borderRadius: 4,
            border: `2px solid ${bonncoColors.bgPaper}`,
          },
          scrollbarWidth: "thin",
          scrollbarColor: `${bonncoColors.bgElevated} transparent`,
        }}
      >
        {rows.map((r) => (
          <Stack
            key={r.label}
            direction="row"
            sx={{ alignItems: "center", gap: 1, py: 0.85, borderTop: `1px solid ${bonncoColors.border}` }}
          >
            <Stack direction="row" sx={{ width: LABEL_COL_WIDTH, flexShrink: 0, alignItems: "center", gap: 0.6, minWidth: 0 }}>
              {r.coinIcon && <CoinIcon symbol={`${r.label}USDT`} size={16} />}
              <Typography fontWeight={600} fontSize={13} noWrap title={r.label}>
                {r.label}
              </Typography>
            </Stack>

            <Box sx={{ flex: 1, position: "relative", height: 20 }}>
              {GRID_PCTS.map((g) => (
                <Box
                  key={g}
                  sx={{ position: "absolute", left: `${g}%`, top: 2, bottom: 2, width: "1px", backgroundColor: "rgba(139,147,167,0.12)" }}
                />
              ))}
              <Box sx={{ position: "absolute", left: 0, right: 0, top: 6, bottom: 6, backgroundColor: "rgba(139,147,167,0.1)", borderRadius: 0.5 }} />
              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  top: 6,
                  bottom: 6,
                  width: `${r.win_rate ?? 0}%`,
                  backgroundColor: winRateColor(r.win_rate),
                  borderRadius: 0.5,
                  transition: "width 300ms ease",
                }}
              />
            </Box>

            <Stack direction="row" sx={{ width: VALUE_COL_WIDTH, flexShrink: 0, justifyContent: "flex-end", alignItems: "center", gap: 0.4 }}>
              <Typography sx={{ fontFamily: monoStack, fontWeight: 800, fontSize: 14, color: winRateColor(r.win_rate) }}>
                {r.win_rate === null ? "—" : `${r.win_rate}%`}
              </Typography>
              {r.stopped_out > 0 && (
                <Tooltip
                  title={`${r.stopped_out.toLocaleString()} of ${r.resolved.toLocaleString()} were closed early by hitting the stop-loss before this checkpoint.`}
                  arrow
                >
                  <WarningAmberOutlinedIcon sx={{ fontSize: 13, color: bonncoColors.neutral, cursor: "help" }} />
                </Tooltip>
              )}
            </Stack>

            <Stack sx={{ width: SAMPLE_COL_WIDTH, flexShrink: 0, alignItems: "flex-end" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoStack }}>
                {r.correct.toLocaleString()}/{r.resolved.toLocaleString()}
              </Typography>
              {r.resolved > 0 && r.resolved < reliableSampleSize && (
                <Typography variant="caption" sx={{ color: bonncoColors.neutral, fontSize: 10 }}>
                  small sample
                </Typography>
              )}
            </Stack>
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

const HORIZON_LABELS: Record<number, string> = { 4: "4 hours later", 24: "24 hours later", 168: "7 days later" };

interface TabDef {
  key: string;
  label: string;
  purpose: string;
  rows: Row[];
}

export default function PerformancePage() {
  const [stats, setStats] = useState<SignalOutcomeStatsOut | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await fetchSignalOutcomeStats();
      setStats(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to load performance stats");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: TabDef[] = useMemo(() => {
    if (!stats) return [];
    return [
      {
        key: "confidence",
        label: "Confidence band",
        purpose:
          "Is Bonnco's own confidence score trustworthy? If 60-70% confidence calls actually win more than 50-60% ones, you can lean on that number when deciding how much to risk.",
        rows: stats.by_confidence_band.map((b) => ({ label: b.band, ...b })),
      },
      {
        key: "signal_type",
        label: "Signal type",
        purpose: "Are BUY calls more reliable than SELL calls, or the other way around? Tells you whether to weight one direction more than the other.",
        rows: stats.by_signal_type.map((b) => ({ label: b.signal_type, ...b })),
      },
      {
        key: "coin",
        label: "Coin",
        purpose:
          "Some coins are genuinely easier to call than others. Shows which of your tracked coins Bonnco reads well, and which ones are closer to a coin flip.",
        rows: stats.by_coin.map((b) => ({ label: b.coin, coinIcon: true, ...b })),
      },
      {
        key: "timeframe",
        label: "Timeframe",
        purpose:
          "Shorter charts (5m, 15m) are noisier than longer ones (1h, 1d). Shows whether Bonnco's accuracy actually holds up on the fast timeframes or only on the slow ones.",
        rows: stats.by_timeframe.map((b) => ({ label: b.timeframe, ...b })),
      },
      {
        key: "horizon",
        label: "Checkpoint horizon",
        purpose:
          "The same signals get re-checked at 4 hours, 24 hours, and 7 days out. A checkpoint dominated by early stop-outs mostly measures how often the stop got hit before then, not whether the multi-day direction call was right.",
        rows: stats.by_horizon_hours.map((b) => ({ label: HORIZON_LABELS[b.horizon_hours] ?? `${b.horizon_hours}h`, ...b })),
      },
    ];
  }, [stats]);

  if (error) {
    return (
      <Typography color="error" sx={{ p: 3 }}>
        {error}
      </Typography>
    );
  }
  if (!stats) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  const { overall } = stats;
  const activeTab = tabs[tab] ?? tabs[0];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Performance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        The measured track record of Bonnco's own BUY/SELL signals, checked automatically 4 hours, 24 hours, and 7
        days after each call, against real price history, as if the signal had been followed exactly. This is
        separate from your Trade Journal, which tracks what you actually did. HOLD signals aren't a directional
        prediction and are excluded from win-rate math.
      </Typography>

      {/* Hero: overall win rate is the headline number, same visual weight as Total Portfolio Value
          on the Dashboard — everything else on this page is a breakdown of this one figure. */}
      <Card
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          mb: 3,
          background: `linear-gradient(135deg, color-mix(in srgb, ${bonncoColors.accent} 6%, ${bonncoColors.bgPaper}) 0%, ${bonncoColors.bgPaper} 60%)`,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoStack, letterSpacing: "0.06em" }}>
          OVERALL WIN RATE
        </Typography>
        <Typography sx={{ fontSize: { xs: 42, sm: 56 }, fontWeight: 700, lineHeight: 1.1, mt: 0.5, color: winRateColor(overall.win_rate) }}>
          {overall.win_rate === null ? "—" : `${overall.win_rate}%`}
        </Typography>
        <Box sx={{ mb: 1 }}>
          <SampleSizeNote resolved={overall.resolved} reliableSampleSize={stats.reliable_sample_size} />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)" }, gap: 2.5 }}>
          <StatCell label="CALLS CORRECT" value={`${overall.correct.toLocaleString()} / ${overall.resolved.toLocaleString()}`} />
          <StatCell
            label="STILL PENDING"
            value={stats.unresolved_count.toLocaleString()}
            sub="Awaiting horizon or fresh candles"
          />
          <StatCell
            label="HOLD CALLS TRACKED"
            value={stats.hold_count.toLocaleString()}
            sub="Reference only, not scored"
          />
        </Box>
      </Card>

      {/* One card, tabbed — five separate report views instead of five stacked cards competing for
          the same page at once. */}
      <Card sx={{ p: 0, overflow: "hidden" }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: `1px solid ${bonncoColors.border}`,
            minHeight: 42,
            "& .MuiTab-root": { minHeight: 42, textTransform: "none", fontWeight: 600, fontSize: 13.5 },
          }}
        >
          {tabs.map((t) => (
            <Tab key={t.key} label={t.label} />
          ))}
        </Tabs>
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pt: 2, pb: 1.5, lineHeight: 1.5 }}>
          {activeTab.purpose}
        </Typography>
        <WinRateChart rows={activeTab.rows} reliableSampleSize={stats.reliable_sample_size} />
      </Card>
    </Box>
  );
}
