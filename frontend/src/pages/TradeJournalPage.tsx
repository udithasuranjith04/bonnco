import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Link,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CircleIcon from "@mui/icons-material/Circle";
import {
  closeJournalTrade,
  createJournalTrade,
  deleteJournalTrade,
  fetchActivePositions,
  fetchJournalStats,
  fetchJournalTrades,
  fetchSettings,
  updateJournalTradeNotes,
} from "../api/client";
import type {
  ActivePositionOut,
  AppSettings,
  BucketStats,
  JournalStatsOut,
  MarketType,
  TradeJournalEntryOut,
  TradeSide,
} from "../api/client";
import CoinIcon from "../components/CoinIcon";
import BinanceReconciliationPanel from "../components/BinanceReconciliationPanel";
import SignalBadge from "../components/SignalBadge";
import SymbolPicker from "../components/SymbolPicker";
import SectionHeader from "../components/SectionHeader";
import StatCell from "../components/StatCell";
import DashboardEmptyState from "../components/DashboardEmptyState";
import PreTradeChecklistModal from "../components/PreTradeChecklistModal";
import type { PreTradeChecklistResult } from "../components/PreTradeChecklistModal";
import { computePositionSize } from "../lib/positionSizing";
import type { TradePrefill } from "../lib/tradePrefill";
import useEffectiveAccountBalance from "../hooks/useEffectiveAccountBalance";
import { useLiveTicker } from "../hooks/useLiveTicker";
import { bonncoColors, monoStack } from "../theme/theme";

const ACTIVE_POSITIONS_REFRESH_MS = 45_000;

function winRateColor(winRate: number | null): string {
  if (winRate === null) return bonncoColors.textPrimary;
  return winRate >= 50 ? bonncoColors.bullish : bonncoColors.bearish;
}

function PerformanceStatCell({ title, stats, hint }: { title: string; stats: BucketStats; hint: string }) {
  return (
    <StatCell
      label={title.toUpperCase()}
      value={<Box component="span" sx={{ color: winRateColor(stats.win_rate) }}>{stats.win_rate === null ? "—" : `${stats.win_rate}%`}</Box>}
      sub={`${stats.wins}/${stats.trades} wins · ${hint}`}
    />
  );
}

function ActivePositionCard({
  position,
  closing,
  closePrice,
  onStartClose,
  onClosePriceChange,
  onConfirmClose,
}: {
  position: ActivePositionOut;
  closing: boolean;
  closePrice: string;
  onStartClose: () => void;
  onClosePriceChange: (v: string) => void;
  onConfirmClose: () => void;
}) {
  const { trade, current_signal, guidance, stop_warning } = position;

  // current_price/pnl come from a REST snapshot refreshed every 45s (position.current_price) —
  // the same lag the Watchlist strip had. guidance/stop_warning are natural-language text Bonnco
  // computed server-side against that snapshot, so they stay tied to it; but the price and PnL
  // numbers are simple enough to recompute from a live WebSocket tick using the exact same formula
  // the backend uses (see position_coach.py), so this card doesn't sit on stale numbers for up to
  // 45 seconds.
  const { ticker } = useLiveTicker(trade.symbol, trade.market_type);
  const current_price = ticker?.price ?? position.current_price;
  const direction = trade.side === "long" ? 1 : -1;
  const raw_return = ((current_price - trade.entry_price) / trade.entry_price) * direction;
  const pnl_pct = raw_return * trade.leverage * 100;
  const pnl_usd = trade.position_size_usd !== null ? trade.position_size_usd * (pnl_pct / 100) : null;
  const pnlColor = pnl_pct >= 0 ? bonncoColors.bullish : bonncoColors.bearish;

  return (
    <Card sx={{ p: 2.5, flex: 1, minWidth: 340, border: `1px solid ${pnlColor}33` }}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <CoinIcon symbol={trade.symbol} size={24} />
          <Box>
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.6 }}>
              <Typography fontWeight={700}>{trade.symbol}</Typography>
              <CircleIcon sx={{ fontSize: "6px !important", color: ticker ? bonncoColors.bullish : bonncoColors.textSecondary }} />
              <Typography variant="caption" color="text.secondary">
                {ticker ? "Live" : "Connecting…"}
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ gap: 0.5, mt: 0.25, alignItems: "center" }}>
              <Chip
                label={trade.side}
                size="small"
                sx={{
                  backgroundColor: trade.side === "long" ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
                  color: trade.side === "long" ? bonncoColors.bullish : bonncoColors.bearish,
                }}
              />
              <Chip label={`${trade.leverage}x`} size="small" variant="outlined" />
              {current_signal && <SignalBadge signal={current_signal} size="small" />}
            </Stack>
          </Box>
        </Stack>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="h6" fontWeight={700} sx={{ fontFamily: monoStack, color: pnlColor, lineHeight: 1.2 }}>
            {pnl_pct >= 0 ? "+" : ""}
            {pnl_pct.toFixed(2)}%
          </Typography>
          {pnl_usd !== null && (
            <Typography variant="caption" sx={{ fontFamily: monoStack, color: pnlColor }}>
              {pnl_usd >= 0 ? "+" : ""}${pnl_usd.toFixed(2)}
            </Typography>
          )}
        </Box>
      </Stack>

      <Stack direction="row" sx={{ gap: 3, mb: 1.5, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Entry
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ fontFamily: monoStack }}>
            ${trade.entry_price.toLocaleString()}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Current
          </Typography>
          <Typography variant="body2" fontWeight={600} sx={{ fontFamily: monoStack }}>
            ${current_price.toLocaleString()}
          </Typography>
        </Box>
        {trade.stop_loss !== null && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Your stop-loss
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ fontFamily: monoStack }}>
              ${trade.stop_loss.toLocaleString()}
            </Typography>
          </Box>
        )}
      </Stack>

      {stop_warning && (
        <Stack
          direction="row"
          sx={{
            gap: 0.75,
            alignItems: "center",
            backgroundColor: "rgba(234,179,8,0.12)",
            border: `1px solid ${bonncoColors.neutral}55`,
            borderRadius: 1,
            px: 1.25,
            py: 0.75,
            mb: 1.5,
          }}
        >
          <WarningAmberOutlinedIcon fontSize="small" sx={{ color: bonncoColors.neutral }} />
          <Typography variant="body2" sx={{ color: bonncoColors.neutral }}>
            {stop_warning}
          </Typography>
        </Stack>
      )}

      <Typography variant="body2" sx={{ mb: 1.5, lineHeight: 1.6 }}>
        {guidance}
      </Typography>

      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        <Link component={RouterLink} to="/study?guide=losing-position-guide" variant="body2">
          What to do in a losing position →
        </Link>
        {closing ? (
          <Stack direction="row" sx={{ gap: 0.5, alignItems: "center" }}>
            <TextField
              size="small"
              type="number"
              placeholder="Exit price"
              value={closePrice}
              onChange={(e) => onClosePriceChange(e.target.value)}
              sx={{ width: 120 }}
            />
            <IconButton size="small" onClick={onConfirmClose} sx={{ color: bonncoColors.bullish }}>
              <CheckCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : (
          <Button size="small" onClick={onStartClose}>
            Close position
          </Button>
        )}
      </Stack>
    </Card>
  );
}

const emptyForm = {
  market_type: "spot" as MarketType,
  side: "long" as TradeSide,
  entry_price: "",
  exit_price: "",
  leverage: "1",
  stop_loss: "",
  position_size_usd: "",
  notes: "",
};

export default function TradeJournalPage() {
  const [trades, setTrades] = useState<TradeJournalEntryOut[]>([]);
  const [activePositions, setActivePositions] = useState<ActivePositionOut[]>([]);
  const [stats, setStats] = useState<JournalStatsOut | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [closingId, setClosingId] = useState<number | null>(null);
  const [closePrice, setClosePrice] = useState("");
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState(false);
  const [manualFormExpanded, setManualFormExpanded] = useState(false);
  const [prefillReasoning, setPrefillReasoning] = useState<string | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const appliedPrefillRef = useRef(false);
  const effectiveBalance = useEffectiveAccountBalance();

  const load = useCallback(async () => {
    const [tradesData, statsData, settingsData] = await Promise.all([
      fetchJournalTrades(),
      fetchJournalStats(),
      fetchSettings(),
    ]);
    setTrades(tradesData);
    setStats(statsData);
    setSettings(settingsData);
  }, []);

  const loadActivePositions = useCallback(async () => {
    try {
      const data = await fetchActivePositions();
      setActivePositions(data);
    } catch {
      // Silent — the historical table below still loads independently, and this panel just
      // retries on the next poll rather than surfacing a disruptive error for a background refresh.
    }
  }, []);

  useEffect(() => {
    load();
    loadActivePositions();
    const interval = setInterval(loadActivePositions, ACTIVE_POSITIONS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load, loadActivePositions]);

  // One-click "Log this trade" from a signal alert or the signal card: applies once settings has
  // loaded (needed to compute the suggested position size), then clears the router state so a
  // page refresh or back-navigation doesn't reapply the same prefill.
  useEffect(() => {
    const prefill = (location.state as { prefill?: TradePrefill } | null)?.prefill;
    if (!prefill || appliedPrefillRef.current || !settings) return;
    appliedPrefillRef.current = true;

    let positionSizeStr = "";
    if (prefill.stopLoss !== null) {
      const size = computePositionSize(effectiveBalance.amount, effectiveBalance.riskPct, prefill.entryPrice, prefill.stopLoss);
      if (size.positionSizeUsd > 0) positionSizeStr = size.positionSizeUsd.toFixed(2);
    }

    setSymbol(prefill.symbol);
    setForm({
      market_type: prefill.marketType,
      side: prefill.side,
      entry_price: String(prefill.entryPrice),
      exit_price: "",
      leverage: String(prefill.leverageMin ?? 1),
      stop_loss: prefill.stopLoss !== null ? String(prefill.stopLoss) : "",
      position_size_usd: positionSizeStr,
      notes: "",
    });
    setPrefillNotice(true);
    setManualFormExpanded(true);
    setPrefillReasoning(prefill.reasoning);

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, settings, navigate, effectiveBalance]);

  const suggestedSize =
    form.entry_price && form.stop_loss
      ? computePositionSize(
          effectiveBalance.amount,
          effectiveBalance.riskPct,
          parseFloat(form.entry_price) || 0,
          parseFloat(form.stop_loss) || 0,
        )
      : null;

  // "Log this trade" always routes through the pre-trade checklist first — whether the form was
  // reached from a signal card, an alert's "Log this trade" action, or typed in manually. This is
  // the single choke point all three flows funnel through, so the checklist can't be silently
  // skipped in an emotional moment.
  function openChecklist() {
    setError("");
    if (!symbol || !form.entry_price) {
      setError("Symbol and entry price are required");
      return;
    }
    setChecklistOpen(true);
  }

  async function submitTrade(result: PreTradeChecklistResult) {
    setSubmitting(true);
    try {
      await createJournalTrade({
        symbol: symbol!,
        market_type: form.market_type,
        side: form.side,
        entry_price: parseFloat(form.entry_price),
        exit_price: form.exit_price ? parseFloat(form.exit_price) : undefined,
        leverage: result.leverage,
        stop_loss: result.stopLoss,
        position_size_usd: result.positionSizeUsd,
        notes: form.notes,
      });
      setChecklistOpen(false);
      setSymbol(null);
      setForm(emptyForm);
      setPrefillNotice(false);
      setPrefillReasoning(null);
      // Awaited so a refresh failure surfaces as a visible error instead of silently
      // leaving the table showing stale data with no indication anything went wrong.
      await load();
      await loadActivePositions();
    } catch (e: any) {
      setChecklistOpen(false);
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to log trade");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose(id: number) {
    if (!closePrice) return;
    try {
      await closeJournalTrade(id, parseFloat(closePrice));
      setClosingId(null);
      setClosePrice("");
      await load();
      await loadActivePositions();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to close trade");
    }
  }

  async function handleSaveNotes(id: number) {
    try {
      await updateJournalTradeNotes(id, notesDraft);
      setEditingNotesId(null);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to save notes");
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteJournalTrade(id);
      await load();
      await loadActivePositions();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed to delete trade");
    }
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Trade Journal
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Log the trades you actually placed. Bonnco compares your outcomes against what its own signal was
        calling at the time. This is the feedback loop that shows whether following the signal correlates
        with better results for you specifically.
      </Typography>

      <BinanceReconciliationPanel onImported={() => { load(); loadActivePositions(); }} />

      {activePositions.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5 }}>
            <Box sx={{ color: bonncoColors.accent, display: "flex" }}>
              <MonitorHeartOutlinedIcon fontSize="small" />
            </Box>
            <Typography
              variant="caption"
              sx={{ fontFamily: monoStack, letterSpacing: "0.08em", fontWeight: 700, color: bonncoColors.textSecondary }}
            >
              ACTIVE POSITIONS
            </Typography>
          </Stack>
          <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap" }}>
            {activePositions.map((p) => (
              <ActivePositionCard
                key={p.trade.id}
                position={p}
                closing={closingId === p.trade.id}
                closePrice={closePrice}
                onStartClose={() => {
                  setClosingId(p.trade.id);
                  setClosePrice("");
                }}
                onClosePriceChange={setClosePrice}
                onConfirmClose={() => handleClose(p.trade.id)}
              />
            ))}
          </Stack>
        </Box>
      )}

      {stats && (
        <Card sx={{ p: 0, overflow: "hidden", mb: 3 }}>
          <SectionHeader icon={<EmojiEventsOutlinedIcon fontSize="small" />} label="PERFORMANCE" />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: 2.5,
              px: 2.5,
              pb: 2.5,
            }}
          >
            <PerformanceStatCell title="Overall win rate" stats={stats.overall} hint="all closed trades" />
            <PerformanceStatCell
              title="When aligned with Bonnco"
              stats={stats.signal_aligned}
              hint="matched signal at entry"
            />
            <PerformanceStatCell
              title="When against Bonnco"
              stats={stats.signal_not_aligned}
              hint="against signal, or in a HOLD"
            />
          </Box>
        </Card>
      )}

      {!manualFormExpanded ? (
        <Stack
          direction="row"
          onClick={() => setManualFormExpanded(true)}
          sx={{
            alignItems: "center",
            gap: 0.75,
            mb: 3,
            cursor: "pointer",
            color: bonncoColors.textSecondary,
            width: "fit-content",
            "&:hover": { color: bonncoColors.accent },
          }}
        >
          <EditNoteOutlinedIcon fontSize="small" />
          <Typography variant="body2" fontWeight={600}>
            + Log a trade manually
          </Typography>
          <Typography variant="caption" color="text.secondary">
            (other exchanges, or planning a trade before you place it)
          </Typography>
        </Stack>
      ) : (
      <Card sx={{ p: 0, overflow: "hidden", mb: 3 }}>
        <SectionHeader
          icon={<EditNoteOutlinedIcon fontSize="small" />}
          label="LOG A TRADE MANUALLY"
          trailing={
            <Typography
              variant="caption"
              onClick={() => setManualFormExpanded(false)}
              sx={{ cursor: "pointer", color: bonncoColors.textSecondary, "&:hover": { color: bonncoColors.accent } }}
            >
              Collapse
            </Typography>
          }
        />
        <Box sx={{ px: 2.5, pb: 2.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Your real Binance trades sync automatically now — new positions appear within ~90 seconds, closed trades
          within 30 minutes. Use this for anything Bonnco can't see: a trade on another exchange, or planning one out
          before you place it. To add context to a synced trade, click its Notes cell in the table below.
        </Typography>
        {prefillNotice && (
          <Typography
            variant="body2"
            sx={{ mb: 1.5, color: bonncoColors.accent, backgroundColor: "rgba(59,130,246,0.1)", borderRadius: 1, px: 1.5, py: 1 }}
          >
            Pre-filled from a Bonnco signal — review the numbers below, adjust anything you want, then click Add.
          </Typography>
        )}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" },
            gap: 1.5,
            mb: 1.5,
          }}
        >
          <SymbolPicker value={symbol} onChange={setSymbol} marketType={form.market_type} placeholder="Symbol" />
          <Select
            size="small"
            value={form.market_type}
            onChange={(e) => setForm({ ...form, market_type: e.target.value as MarketType })}
          >
            <MenuItem value="spot">Spot</MenuItem>
            <MenuItem value="futures">Futures</MenuItem>
          </Select>
          <Select size="small" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value as TradeSide })}>
            <MenuItem value="long">Long</MenuItem>
            <MenuItem value="short">Short</MenuItem>
          </Select>
          <TextField
            size="small"
            label="Leverage"
            type="number"
            value={form.leverage}
            onChange={(e) => setForm({ ...form, leverage: e.target.value })}
          />
          <TextField
            size="small"
            label="Entry price"
            type="number"
            value={form.entry_price}
            onChange={(e) => setForm({ ...form, entry_price: e.target.value })}
          />
          <TextField
            size="small"
            label="Stop-loss"
            type="number"
            value={form.stop_loss}
            onChange={(e) => setForm({ ...form, stop_loss: e.target.value })}
          />
          <TextField
            size="small"
            label="Position size ($)"
            type="number"
            value={form.position_size_usd}
            onChange={(e) => setForm({ ...form, position_size_usd: e.target.value })}
          />
          <TextField
            size="small"
            label="Exit price (optional)"
            type="number"
            value={form.exit_price}
            onChange={(e) => setForm({ ...form, exit_price: e.target.value })}
          />
        </Box>
        <Stack direction="row" sx={{ gap: 1.5, alignItems: "center" }}>
          <TextField
            size="small"
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            sx={{ flexGrow: 1 }}
          />
          <Button variant="contained" onClick={openChecklist} disabled={submitting || !symbol}>
            {submitting ? "Adding…" : "Add"}
          </Button>
        </Stack>

        {suggestedSize && suggestedSize.positionSizeUsd > 0 && (
          <Stack
            direction="row"
            sx={{ mt: 1.5, gap: 1, alignItems: "center", flexWrap: "wrap" }}
          >
            <Typography variant="caption" color="text.secondary">
              Based on {effectiveBalance.source === "binance" ? "your live Binance balance" : "your Settings"} ($
              {effectiveBalance.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} account,{" "}
              {effectiveBalance.riskPct}% risk) and this stop-loss distance ({(suggestedSize.stopDistancePct * 100).toFixed(2)}
              %), a consistent position size here would be{" "}
              <Typography component="span" variant="caption" fontWeight={700} sx={{ color: bonncoColors.accent }}>
                ${suggestedSize.positionSizeUsd.toFixed(2)}
              </Typography>
              .
            </Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setForm((f) => ({ ...f, position_size_usd: suggestedSize.positionSizeUsd.toFixed(2) }))}
            >
              Use suggested size
            </Button>
          </Stack>
        )}

        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
        </Box>
      </Card>
      )}

      <Card sx={{ p: 0, overflow: "hidden" }}>
        <SectionHeader
          icon={<ReceiptLongOutlinedIcon fontSize="small" />}
          label="TRADE HISTORY"
          trailing={
            trades.length > 0 ? (
              <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
                {trades.length}
              </Typography>
            ) : undefined
          }
        />
        {trades.length === 0 ? (
          <DashboardEmptyState icon={<ReceiptLongOutlinedIcon fontSize="small" />} text="No trades logged yet." />
        ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Symbol", "Source", "Side", "Entry", "Exit", "Leverage", "PnL", "Opened", "Notes"].map((h) => (
                <TableCell key={h} sx={{ fontFamily: monoStack, fontSize: 11, color: bonncoColors.textSecondary }}>
                  {h.toUpperCase()}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontFamily: monoStack, fontSize: 11, color: bonncoColors.textSecondary }}>
                ACTIONS
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trades.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                    <CoinIcon symbol={t.symbol} size={18} />
                    {t.symbol}
                    <Chip label={t.market_type} size="small" variant="outlined" sx={{ ml: 0.5 }} />
                  </Stack>
                </TableCell>
                <TableCell>
                  {t.source === "manual" ? (
                    <Chip label="Manual" size="small" variant="outlined" sx={{ color: bonncoColors.textSecondary }} />
                  ) : (
                    <Chip
                      label={t.source === "binance_import" ? "Synced (open)" : "Synced (closed)"}
                      size="small"
                      sx={{ backgroundColor: "rgba(59,130,246,0.14)", color: bonncoColors.accent }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={t.side}
                    size="small"
                    sx={{
                      backgroundColor: t.side === "long" ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
                      color: t.side === "long" ? bonncoColors.bullish : bonncoColors.bearish,
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontFamily: monoStack }}>${t.entry_price.toLocaleString()}</TableCell>
                <TableCell sx={{ fontFamily: monoStack }}>{t.exit_price ? `$${t.exit_price.toLocaleString()}` : "—"}</TableCell>
                <TableCell sx={{ fontFamily: monoStack }}>{t.leverage}x</TableCell>
                <TableCell sx={{ fontFamily: monoStack }}>
                  {t.result_pnl === null ? (
                    "—"
                  ) : (
                    <Typography
                      component="span"
                      fontWeight={700}
                      sx={{ fontFamily: monoStack, color: t.result_pnl >= 0 ? bonncoColors.bullish : bonncoColors.bearish }}
                    >
                      {t.result_pnl >= 0 ? "+" : ""}
                      {t.result_pnl}%
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{new Date(t.opened_at).toLocaleDateString()}</TableCell>
                <TableCell sx={{ maxWidth: 220 }}>
                  {editingNotesId === t.id ? (
                    <Stack direction="row" sx={{ gap: 0.5, alignItems: "center" }}>
                      <TextField
                        size="small"
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Why did you take this trade?"
                        autoFocus
                        sx={{ minWidth: 180 }}
                      />
                      <IconButton size="small" onClick={() => handleSaveNotes(t.id)} sx={{ color: bonncoColors.bullish }}>
                        <SaveOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ) : (
                    <Stack
                      direction="row"
                      onClick={() => {
                        setEditingNotesId(t.id);
                        setNotesDraft(t.notes);
                      }}
                      sx={{ alignItems: "center", gap: 0.5, cursor: "pointer", "&:hover .edit-notes-icon": { opacity: 1 } }}
                    >
                      <Typography
                        variant="body2"
                        color={t.notes ? "text.primary" : "text.secondary"}
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 180,
                          fontStyle: t.notes ? "normal" : "italic",
                        }}
                      >
                        {t.notes || "Add notes…"}
                      </Typography>
                      <EditOutlinedIcon
                        className="edit-notes-icon"
                        sx={{ fontSize: 14, color: bonncoColors.textSecondary, opacity: 0, transition: "opacity 120ms ease", flexShrink: 0 }}
                      />
                    </Stack>
                  )}
                </TableCell>
                <TableCell align="right">
                  {t.exit_price === null &&
                    (closingId === t.id ? (
                      <Stack direction="row" sx={{ gap: 0.5, alignItems: "center", justifyContent: "flex-end" }}>
                        <TextField
                          size="small"
                          type="number"
                          placeholder="Exit price"
                          value={closePrice}
                          onChange={(e) => setClosePrice(e.target.value)}
                          sx={{ width: 110 }}
                        />
                        <IconButton size="small" onClick={() => handleClose(t.id)} sx={{ color: bonncoColors.bullish }}>
                          <CheckCircleOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ) : (
                      <Button size="small" onClick={() => setClosingId(t.id)}>
                        Close
                      </Button>
                    ))}
                  <IconButton size="small" onClick={() => handleDelete(t.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </Card>

      <PreTradeChecklistModal
        open={checklistOpen}
        symbol={symbol ?? ""}
        side={form.side}
        marketType={form.market_type}
        entryPrice={parseFloat(form.entry_price) || 0}
        initialPositionSizeUsd={
          form.position_size_usd ? parseFloat(form.position_size_usd) || 0 : suggestedSize?.positionSizeUsd ?? 0
        }
        initialStopLoss={form.stop_loss ? parseFloat(form.stop_loss) : null}
        initialLeverage={parseFloat(form.leverage) || 1}
        riskProfile={settings?.risk_profile ?? "moderate"}
        reasoning={prefillReasoning}
        submitting={submitting}
        onCancel={() => setChecklistOpen(false)}
        onConfirm={submitTrade}
      />
    </Box>
  );
}
