import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Card,
  Chip,
  Divider,
  Link,
  LinearProgress,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  fetchBinancePortfolio,
  fetchBinancePositions,
  fetchBinanceOpenOrders,
  fetchBinanceStatus,
  fetchExposureHistory,
  fetchBinanceWallet,
  fetchPortfolioSummary,
} from "../api/client";
import type {
  PortfolioOverviewOut,
  BinancePosition,
  BinanceOpenOrdersOut,
  BinanceStatusOut,
  ExposureHistoryPoint,
  AssetHolding,
  PortfolioSummaryOut,
} from "../api/client";
import CoinIcon from "../components/CoinIcon";
import Sparkline from "../components/Sparkline";
import ConcentrationDonut from "../components/ConcentrationDonut";
import DashboardEmptyState from "../components/DashboardEmptyState";
import SectionHeader from "../components/SectionHeader";
import StatCell from "../components/StatCell";
import GoalProgressCard from "../components/GoalProgressCard";
import { useLiveTicker } from "../hooks/useLiveTicker";
import { bonncoColors, monoStack } from "../theme/theme";

const REFRESH_MS = 60_000;
const KEY_AGE_CAUTION_DAYS = 60;
const SIMPLE_EARN_COLLAPSED_GROUPS = 4;

// Same set binance_portfolio.py treats as always-$1 — a stablecoin's "price" isn't a real ticker
// pair, so it's held flat rather than opening a WebSocket that will never send anything.
const STABLE_ASSETS = new Set(["USDT", "USDC", "FDUSD", "TUSD", "BUSD", "DAI", "USDP"]);

function fmtUsd(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysSince(ms: number): number {
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

// The held *amount* only changes when a real trade/transfer happens — Binance has no WebSocket
// feed for personal account balances, so that number is honestly only as fresh as the last REST
// poll (~60s). But the USD *value* of that amount is amount × price, and price is live — so this
// recomputes value client-side from a real WebSocket tick every time one arrives, the same fix
// already applied to the Active Position Coach's PnL. Reports the live value back up to the parent
// so the table's totals/percentages stay consistent with what each row is actually showing.
function HoldingRow({
  holding,
  pct,
  onLiveValue,
}: {
  holding: AssetHolding;
  pct: number;
  onLiveValue: (asset: string, value: number | null) => void;
}) {
  const isStable = STABLE_ASSETS.has(holding.asset);
  const { ticker } = useLiveTicker(isStable ? "" : `${holding.asset}USDT`, "spot");
  const liveValue = isStable ? holding.amount : ticker ? holding.amount * ticker.price : holding.usd_value;

  useEffect(() => {
    onLiveValue(holding.asset, liveValue);
  }, [holding.asset, liveValue, onLiveValue]);

  const sources = [holding.spot_amount > 0 && "Spot", holding.earn_amount > 0 && "Earn", holding.futures_amount > 0 && "Futures"].filter(
    Boolean,
  ) as string[];

  return (
    <TableRow hover>
      <TableCell sx={{ borderColor: bonncoColors.border }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <CoinIcon symbol={`${holding.asset}USDT`} size={22} />
          <Box>
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
              <Typography fontWeight={700} sx={{ lineHeight: 1.2 }}>
                {holding.asset}
              </Typography>
              {ticker && (
                <Box
                  sx={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: bonncoColors.bullish, flexShrink: 0 }}
                  title="Live price"
                />
              )}
            </Stack>
            {sources.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                {sources.join(" + ")}
              </Typography>
            )}
          </Box>
        </Stack>
      </TableCell>
      <TableCell align="right" sx={{ borderColor: bonncoColors.border, fontFamily: monoStack, color: bonncoColors.textSecondary }}>
        {holding.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
      </TableCell>
      <TableCell sx={{ borderColor: bonncoColors.border }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
          <Box sx={{ flexGrow: 1, minWidth: 40 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(pct, 100)}
              sx={{
                height: 5,
                borderRadius: 3,
                backgroundColor: "rgba(139,147,167,0.15)",
                "& .MuiLinearProgress-bar": { backgroundColor: bonncoColors.accent, transition: "transform 300ms ease" },
              }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoStack, minWidth: 32, textAlign: "right" }}>
            {pct.toFixed(1)}%
          </Typography>
        </Stack>
      </TableCell>
      <TableCell align="right" sx={{ borderColor: bonncoColors.border, fontFamily: monoStack, fontWeight: 700 }}>
        {liveValue !== null ? (
          fmtUsd(liveValue)
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
            Unpriced
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function DashboardPage() {
  const [portfolio, setPortfolio] = useState<PortfolioOverviewOut | null>(null);
  const [positions, setPositions] = useState<BinancePosition[] | null>(null);
  const [openOrders, setOpenOrders] = useState<BinanceOpenOrdersOut | null>(null);
  const [status, setStatus] = useState<BinanceStatusOut | null>(null);
  const [exposureHistory, setExposureHistory] = useState<ExposureHistoryPoint[]>([]);
  const [wallet, setWallet] = useState<AssetHolding[] | null>(null);
  const [summary, setSummary] = useState<PortfolioSummaryOut | null>(null);
  const [earnExpanded, setEarnExpanded] = useState(false);
  const [hideDust, setHideDust] = useState(true);
  const [liveValues, setLiveValues] = useState<Record<string, number | null>>({});

  const handleLiveValue = useCallback((asset: string, value: number | null) => {
    setLiveValues((prev) => (prev[asset] === value ? prev : { ...prev, [asset]: value }));
  }, []);

  const load = useCallback(() => {
    fetchBinancePortfolio().then(setPortfolio);
    fetchBinancePositions().then(setPositions);
    fetchBinanceOpenOrders().then(setOpenOrders);
    fetchBinanceStatus().then(setStatus);
    fetchExposureHistory(24).then(setExposureHistory);
    fetchBinanceWallet().then(setWallet);
    fetchPortfolioSummary().then(setSummary);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const earnGroups = useMemo(() => {
    if (!portfolio) return [];
    const byAsset = new Map<string, typeof portfolio.simple_earn>();
    for (const h of portfolio.simple_earn) {
      const list = byAsset.get(h.asset) ?? [];
      list.push(h);
      byAsset.set(h.asset, list);
    }
    return Array.from(byAsset.entries()).map(([asset, holdings]) => ({ asset, holdings }));
  }, [portfolio]);

  // What the donut actually visualizes: real total-value composition across every coin you hold
  // (spot + Earn + futures margin, same source as "My Holdings" below) — not market-risk notional,
  // which stays $0 for an account like this one (money sitting in Earn/futures cash, not open
  // positions) and would leave the chart permanently empty. Long tail of sub-1% coins is grouped
  // into a real "Other" slice (their actual summed value) rather than cluttering the chart.
  const allocationSlices = useMemo(() => {
    if (!wallet || wallet.length === 0) return { slices: [], total: 0 };
    const valueFor = (h: AssetHolding) => (h.asset in liveValues ? liveValues[h.asset] : h.usd_value);
    const priced = wallet.filter((h) => (valueFor(h) ?? 0) > 0);
    const total = priced.reduce((sum, h) => sum + (valueFor(h) ?? 0), 0);
    if (total <= 0) return { slices: [], total: 0 };

    const sorted = [...priced].sort((a, b) => (valueFor(b) ?? 0) - (valueFor(a) ?? 0));
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4);
    const restValue = rest.reduce((sum, h) => sum + (valueFor(h) ?? 0), 0);

    const slices = top.map((h) => ({
      coin: h.asset,
      usd_value: valueFor(h) ?? 0,
      pct_of_portfolio: ((valueFor(h) ?? 0) / total) * 100,
    }));
    if (restValue > 0) {
      slices.push({ coin: `Other (${rest.length})`, usd_value: restValue, pct_of_portfolio: (restValue / total) * 100 });
    }
    return { slices, total };
  }, [wallet, liveValues]);

  if (!portfolio) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  if (!portfolio.connected) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          How your real account is doing, at a glance.
        </Typography>
        <Card sx={{ p: 3 }}>
          <Typography color="text.secondary">
            Connect a read-only Binance account in{" "}
            <Link component={RouterLink} to="/settings">
              Settings
            </Link>{" "}
            to see your real exposure, concentration, and risk here. Looking to browse and analyze coins instead? Head to{" "}
            <Link component={RouterLink} to="/watchlist">
              Watchlist
            </Link>
            .
          </Typography>
        </Card>
      </Box>
    );
  }

  const pnl = portfolio.total_unrealized_pnl_usd;
  const pnlUp = (pnl ?? 0) >= 0;
  const openOrderCount = (openOrders?.spot.length ?? 0) + (openOrders?.futures.length ?? 0);
  const visibleEarnGroups = earnExpanded ? earnGroups : earnGroups.slice(0, SIMPLE_EARN_COLLAPSED_GROUPS);

  const permissions = status?.permissions;
  const createTimeMs = permissions?.createTime;
  const ipRestricted = permissions?.ipRestrict ?? false;
  const keyAgeDays = createTimeMs ? daysSince(createTimeMs) : null;
  const keyAgeCaution = !ipRestricted && keyAgeDays !== null && keyAgeDays >= KEY_AGE_CAUTION_DAYS;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        Your real Binance account, at a glance — total value, today's P&amp;L, holdings, and risk, combined.
        Refreshes automatically.
      </Typography>

      {status && !status.safe && (
        <Card sx={{ p: 2, mb: 3, display: "flex", gap: 1.5, alignItems: "flex-start", border: `1px solid ${bonncoColors.bearish}55` }}>
          <WarningAmberOutlinedIcon sx={{ color: bonncoColors.bearish }} />
          <Box>
            <Typography fontWeight={700} sx={{ color: bonncoColors.bearish }}>
              This key isn't read-only
            </Typography>
            {status.warnings.map((w) => (
              <Typography key={w} variant="body2" color="text.secondary">
                {w}
              </Typography>
            ))}
          </Box>
        </Card>
      )}

      {keyAgeCaution && (
        <Card sx={{ p: 2, mb: 3, display: "flex", gap: 1.5, alignItems: "flex-start", border: `1px solid ${bonncoColors.neutral}55` }}>
          <WarningAmberOutlinedIcon sx={{ color: bonncoColors.neutral }} />
          <Box>
            <Typography fontWeight={700}>API key isn't IP-restricted and is {keyAgeDays} days old</Typography>
            <Typography variant="body2" color="text.secondary">
              Binance can require unrestricted keys to be re-verified periodically. We can't confirm an exact expiration
              date from the API, so if this connection suddenly stops working, that's the first thing to check —
              reconnect in Settings, or add an IP restriction on the key so it never expires.
            </Typography>
          </Box>
        </Card>
      )}

      {/* Hero: total portfolio value — spot + Simple Earn + futures margin balance, combined — is
          the number a trader checks first ("what is everything actually worth right now"), so it
          leads at full visual weight with today's real price-driven PnL right beside it. */}
      <Card
        sx={{
          p: { xs: 2.5, sm: 3.5 },
          mb: 3,
          background: `linear-gradient(135deg, color-mix(in srgb, ${bonncoColors.accent} 6%, ${bonncoColors.bgPaper}) 0%, ${bonncoColors.bgPaper} 60%)`,
        }}
      >
      <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: { xs: 3, md: 4 } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" sx={{ alignItems: "baseline", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoStack, letterSpacing: "0.06em" }}>
              TOTAL PORTFOLIO VALUE
            </Typography>
            <Typography sx={{ fontSize: { xs: 42, sm: 56 }, fontWeight: 700, lineHeight: 1.1, mt: 0.5 }}>
              {summary?.total_value_usd !== null && summary?.total_value_usd !== undefined ? fmtUsd(summary.total_value_usd) : "—"}
            </Typography>
          </Box>
          {summary?.today_pnl_usd !== null && summary?.today_pnl_usd !== undefined && (
            <Chip
              label={`${summary.today_pnl_usd >= 0 ? "+" : ""}${fmtUsd(summary.today_pnl_usd)} (${summary.today_pnl_pct !== null ? `${summary.today_pnl_usd >= 0 ? "+" : ""}${summary.today_pnl_pct}%` : "—"}) today`}
              sx={{
                fontWeight: 700,
                fontFamily: monoStack,
                backgroundColor: summary.today_pnl_usd >= 0 ? `${bonncoColors.bullish}22` : `${bonncoColors.bearish}22`,
                color: summary.today_pnl_usd >= 0 ? bonncoColors.bullish : bonncoColors.bearish,
              }}
            />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Spot wallet + Simple Earn + futures margin balance, combined
        </Typography>

        <Divider sx={{ my: 2.5 }} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(6, 1fr)" },
            gap: 2.5,
          }}
        >
          <StatCell label="SPOT" value={summary?.spot_value_usd !== null && summary?.spot_value_usd !== undefined ? fmtUsd(summary.spot_value_usd) : "—"} />
          <StatCell label="SIMPLE EARN" value={summary?.earn_value_usd !== null && summary?.earn_value_usd !== undefined ? fmtUsd(summary.earn_value_usd) : "—"} />
          <StatCell
            label="FUTURES MARGIN"
            value={summary?.futures_margin_usd !== null && summary?.futures_margin_usd !== undefined ? fmtUsd(summary.futures_margin_usd) : "—"}
          />
          <StatCell
            label="OPEN NOTIONAL"
            value={portfolio.total_exposure_usd !== null ? fmtUsd(portfolio.total_exposure_usd) : "—"}
            sub="Market-risk exposure"
          />
          <StatCell
            label="FUTURES P&L"
            value={
              <Box component="span" sx={{ color: pnl === null ? "inherit" : pnlUp ? bonncoColors.bullish : bonncoColors.bearish }}>
                {pnl !== null ? `${pnlUp ? "+" : ""}${fmtUsd(pnl)}` : "—"}
              </Box>
            }
          />
          {portfolio.fee_tier && (
            <StatCell label="FEE TIER" value={`${portfolio.fee_tier.maker_pct}% / ${portfolio.fee_tier.taker_pct}%`} sub="Maker / taker" />
          )}
        </Box>

        {summary && summary.unpriced_assets.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            {summary.unpriced_assets.join(", ")} {summary.unpriced_assets.length === 1 ? "has" : "have"} no direct USDT pair on Binance, so{" "}
            {summary.unpriced_assets.length === 1 ? "it's" : "they're"} excluded from the total above rather than estimated.
          </Typography>
        )}

        <Box sx={{ mt: 2 }}>
          {exposureHistory.length >= 2 ? (
            <Sparkline data={exposureHistory.map((p) => p.exposure_usd)} width={260} height={40} />
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
              Exposure trend will appear once your priced holdings have enough history.
            </Typography>
          )}
        </Box>
      </Box>

      {allocationSlices.slices.length > 0 && (
        <>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
          <Box sx={{ flexShrink: 0, width: { xs: "100%", md: 200 }, pt: { xs: 1, md: 0 } }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontFamily: monoStack, letterSpacing: "0.06em", display: "block", mb: 1.5 }}
            >
              ASSET ALLOCATION
            </Typography>
            <ConcentrationDonut slices={allocationSlices.slices} totalUsd={allocationSlices.total} size={112} compact />
          </Box>
        </>
      )}
      </Stack>
      </Card>

      <GoalProgressCard />

      {portfolio.correlation_warnings.length > 0 && (
        <Stack sx={{ gap: 1.5, mb: 3 }}>
          {portfolio.correlation_warnings.map((w) => (
            <Card
              key={w.coins.join("-")}
              sx={{ p: 2, display: "flex", gap: 1.5, alignItems: "flex-start", border: `1px solid ${bonncoColors.neutral}55` }}
            >
              <WarningAmberOutlinedIcon sx={{ color: bonncoColors.neutral }} />
              <Typography variant="body2">{w.message}</Typography>
            </Card>
          ))}
        </Stack>
      )}

      {positions !== null && positions.length > 0 && (
        <Card sx={{ p: 0, overflow: "hidden", mb: 3 }}>
          <SectionHeader icon={<ShieldOutlinedIcon fontSize="small" />} label="OPEN FUTURES POSITIONS & MARGIN HEALTH" />
          <Stack sx={{ pb: 1 }}>
            {positions.map((p) => (
              <Stack key={p.symbol} sx={{ px: 2.5, py: 1.25, gap: 0.5, borderTop: `1px solid ${bonncoColors.border}` }}>
                <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                  <CoinIcon symbol={p.symbol} size={20} />
                  <Typography fontWeight={600} sx={{ minWidth: 90 }}>
                    {p.symbol}
                  </Typography>
                  <Chip
                    label={`${p.side} ${p.leverage}x`}
                    size="small"
                    sx={{
                      color: p.side === "long" ? bonncoColors.bullish : bonncoColors.bearish,
                      borderColor: p.side === "long" ? bonncoColors.bullish : bonncoColors.bearish,
                    }}
                    variant="outlined"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1, fontFamily: monoStack }}>
                    Entry {p.entry_price} · Mark {p.mark_price}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ fontFamily: monoStack, color: p.unrealized_pnl >= 0 ? bonncoColors.bullish : bonncoColors.bearish }}
                  >
                    {p.unrealized_pnl >= 0 ? "+" : ""}
                    {fmtUsd(p.unrealized_pnl)}
                  </Typography>
                </Stack>
                {p.liquidation_distance_pct !== null && (
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                    <ShieldOutlinedIcon
                      sx={{ fontSize: 16, color: p.margin_warning ? bonncoColors.bearish : bonncoColors.textSecondary }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: p.margin_warning ? bonncoColors.bearish : "text.secondary", fontWeight: p.margin_warning ? 700 : 400 }}
                    >
                      {p.margin_warning ?? `${p.liquidation_distance_pct}% from liquidation ($${p.liquidation_price?.toLocaleString()})`}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

        <Card sx={{ p: 0, overflow: "hidden", mb: 3 }}>
          <SectionHeader
            icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
            label="MY HOLDINGS"
            trailing={
              <Stack direction="row" sx={{ alignItems: "center", gap: 1.25 }}>
                <Stack
                  direction="row"
                  onClick={() => setHideDust((v) => !v)}
                  sx={{ alignItems: "center", gap: 0.4, cursor: "pointer" }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Hide &lt;$1
                  </Typography>
                  <Switch size="small" checked={hideDust} onChange={(e) => setHideDust(e.target.checked)} />
                </Stack>
                <Chip
                  label="Read-only"
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: 10, height: 20, color: bonncoColors.textSecondary, borderColor: bonncoColors.border }}
                />
              </Stack>
            }
          />
          {wallet === null || wallet.length === 0 ? (
            <DashboardEmptyState
              icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
              text="No coins on this account right now."
            />
          ) : (
            (() => {
              // Live value = real held amount × the latest WebSocket price tick, falling back to
              // the last REST snapshot until that coin's first tick arrives (or forever, for a
              // stable asset or a coin with no direct USDT pair — see HoldingRow).
              const liveValueFor = (h: AssetHolding) => (h.asset in liveValues ? liveValues[h.asset] : h.usd_value);
              const walletTotal = wallet.reduce((sum, h) => sum + (liveValueFor(h) ?? 0), 0);
              const visible = hideDust ? wallet.filter((h) => (liveValueFor(h) ?? 0) >= 1) : wallet;
              const hiddenCount = wallet.length - visible.length;
              return (
                <>
                  <Box
                    sx={{
                      maxHeight: 420,
                      overflowY: "auto",
                      "&::-webkit-scrollbar": { width: 8 },
                      "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
                      "&::-webkit-scrollbar-thumb": {
                        backgroundColor: bonncoColors.bgElevated,
                        borderRadius: 4,
                        border: `2px solid ${bonncoColors.bgPaper}`,
                      },
                      "&::-webkit-scrollbar-thumb:hover": { backgroundColor: bonncoColors.border },
                      scrollbarWidth: "thin",
                      scrollbarColor: `${bonncoColors.bgElevated} transparent`,
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ backgroundColor: bonncoColors.bgPaper, fontFamily: monoStack, fontSize: 11, color: bonncoColors.textSecondary }}>
                            ASSET
                          </TableCell>
                          <TableCell align="right" sx={{ backgroundColor: bonncoColors.bgPaper, fontFamily: monoStack, fontSize: 11, color: bonncoColors.textSecondary }}>
                            AMOUNT
                          </TableCell>
                          <TableCell sx={{ backgroundColor: bonncoColors.bgPaper, fontFamily: monoStack, fontSize: 11, color: bonncoColors.textSecondary, width: 110 }}>
                            % OF TOTAL
                          </TableCell>
                          <TableCell align="right" sx={{ backgroundColor: bonncoColors.bgPaper, fontFamily: monoStack, fontSize: 11, color: bonncoColors.textSecondary }}>
                            VALUE
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visible.map((h) => {
                          const v = liveValueFor(h);
                          const pct = walletTotal > 0 && v !== null ? (v / walletTotal) * 100 : 0;
                          return <HoldingRow key={h.asset} holding={h} pct={pct} onLiveValue={handleLiveValue} />;
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.25, borderTop: `1px solid ${bonncoColors.border}` }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {hiddenCount > 0 ? `${hiddenCount} coin${hiddenCount === 1 ? "" : "s"} under $1 hidden` : `${visible.length} coins`}
                    </Typography>
                    <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: bonncoColors.bullish }} />
                      <Typography variant="caption" fontWeight={700} sx={{ fontFamily: monoStack }}>
                        Total {fmtUsd(walletTotal)}
                      </Typography>
                    </Stack>
                  </Stack>
                </>
              );
            })()
          )}
        </Card>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3, mb: 3, alignItems: "start" }}>
        <Card sx={{ p: 0, overflow: "hidden" }}>
          <SectionHeader
            icon={<ListAltOutlinedIcon fontSize="small" />}
            label="OPEN ORDERS"
            trailing={
              openOrderCount > 0 ? (
                <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
                  {openOrderCount}
                </Typography>
              ) : undefined
            }
          />
          {openOrderCount === 0 ? (
            <DashboardEmptyState icon={<InboxOutlinedIcon fontSize="small" />} text="No pending limit orders on the account right now." />
          ) : (
            <Stack sx={{ pb: 1 }}>
              {[...(openOrders?.spot ?? []), ...(openOrders?.futures ?? [])].map((o, i) => (
                <Stack
                  key={`${o.symbol}-${i}`}
                  direction="row"
                  sx={{ alignItems: "center", gap: 1.5, px: 2.5, py: 1.25, borderTop: `1px solid ${bonncoColors.border}` }}
                >
                  <CoinIcon symbol={o.symbol} size={20} />
                  <Typography sx={{ minWidth: 90 }} fontWeight={600}>
                    {o.symbol}
                  </Typography>
                  <Chip
                    label={o.side}
                    size="small"
                    variant="outlined"
                    sx={{
                      color: o.side === "long" ? bonncoColors.bullish : bonncoColors.bearish,
                      borderColor: o.side === "long" ? bonncoColors.bullish : bonncoColors.bearish,
                    }}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                    {o.type} · qty {o.orig_qty}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ fontFamily: monoStack }}>
                    @ {o.price}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>

        <Card sx={{ p: 0, overflow: "hidden" }}>
          <SectionHeader
            icon={<SavingsOutlinedIcon fontSize="small" />}
            label="SIMPLE EARN HOLDINGS"
            trailing={
              portfolio.simple_earn.length > 0 ? (
                <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
                  {earnGroups.length} asset{earnGroups.length === 1 ? "" : "s"}
                </Typography>
              ) : undefined
            }
          />
          {portfolio.simple_earn.length === 0 ? (
            <DashboardEmptyState icon={<SavingsOutlinedIcon fontSize="small" />} text="No Simple Earn holdings on this account right now." />
          ) : (
            <>
              <Stack sx={{ pb: 1 }}>
                {visibleEarnGroups.map((group) => (
                  <Stack
                    key={group.asset}
                    sx={{ gap: 0.6, px: 2.5, py: 1.25, borderTop: `1px solid ${bonncoColors.border}` }}
                  >
                    <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                      <CoinIcon symbol={`${group.asset}USDT`} size={20} />
                      <Typography fontWeight={600} sx={{ flexGrow: 1 }}>
                        {group.asset}
                      </Typography>
                      {group.holdings.some((h) => h.maturity_date) && (
                        <Typography variant="caption" color="text.secondary">
                          Matures {group.holdings.find((h) => h.maturity_date)?.maturity_date?.slice(0, 10)}
                        </Typography>
                      )}
                    </Stack>
                    <Stack direction="row" sx={{ gap: 0.75, flexWrap: "wrap", pl: 3.5 }}>
                      {group.holdings.map((h, i) => {
                        const locked = h.product.startsWith("Locked");
                        return (
                          <Chip
                            key={i}
                            size="small"
                            icon={locked ? <LockOutlinedIcon sx={{ fontSize: 13 }} /> : <WaterDropOutlinedIcon sx={{ fontSize: 13 }} />}
                            label={`${h.product} · ${h.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} · ${h.apy_pct}% APY`}
                            variant="outlined"
                            sx={{
                              fontFamily: monoStack,
                              fontSize: 11,
                              color: locked ? bonncoColors.accent : bonncoColors.textSecondary,
                              borderColor: locked ? `${bonncoColors.accent}55` : bonncoColors.border,
                            }}
                          />
                        );
                      })}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
              {earnGroups.length > SIMPLE_EARN_COLLAPSED_GROUPS && (
                <Stack
                  direction="row"
                  onClick={() => setEarnExpanded((v) => !v)}
                  sx={{
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    py: 1.25,
                    borderTop: `1px solid ${bonncoColors.border}`,
                    cursor: "pointer",
                    color: bonncoColors.accent,
                    "&:hover": { backgroundColor: bonncoColors.bgElevated },
                  }}
                >
                  <Typography variant="caption" fontWeight={700}>
                    {earnExpanded ? "Show less" : `Show ${earnGroups.length - SIMPLE_EARN_COLLAPSED_GROUPS} more`}
                  </Typography>
                  <ExpandMoreIcon sx={{ fontSize: 16, transform: earnExpanded ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
                </Stack>
              )}
            </>
          )}
        </Card>
      </Box>
    </Box>
  );
}
