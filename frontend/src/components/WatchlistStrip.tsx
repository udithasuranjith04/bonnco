import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";
import { fetchWatchlist, fetchLatestSignal, fetchSettings } from "../api/client";
import type { WatchlistItem, SignalOut } from "../api/client";
import { useLiveTicker } from "../hooks/useLiveTicker";
import CoinIcon from "./CoinIcon";
import SignalBadge from "./SignalBadge";
import { bonncoColors, monoStack } from "../theme/theme";

// The signal badge isn't second-by-second data (it's the last signal Bonnco generated, refreshed
// here at a sane interval) — but price/24h% below come from useLiveTicker's own WebSocket
// connection, the same real-time stream Coin Detail uses, not a REST poll on a timer.
const SIGNAL_REFRESH_MS = 30_000;

function WatchlistStripEntry({
  item,
  signal,
  onNavigate,
}: {
  item: WatchlistItem;
  signal: SignalOut | null;
  onNavigate: () => void;
}) {
  const { ticker } = useLiveTicker(item.symbol, item.market_type);
  const price = ticker?.price ?? null;
  const changePct = ticker?.price_change_percent ?? null;
  const up = (changePct ?? 0) >= 0;

  return (
    <Stack
      direction="row"
      onClick={onNavigate}
      sx={{
        alignItems: "center",
        gap: 0.75,
        px: 1.25,
        py: 0.6,
        borderRadius: 1.5,
        border: `1px solid ${bonncoColors.border}`,
        backgroundColor: bonncoColors.bgElevated,
        cursor: "pointer",
        flexShrink: 0,
        transition: "border-color 120ms ease",
        "&:hover": { borderColor: bonncoColors.accent },
      }}
    >
      <CoinIcon symbol={item.symbol} size={18} />
      <Typography variant="caption" fontWeight={700} sx={{ minWidth: 44 }}>
        {item.symbol.replace(/USDT$/, "")}
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary, minWidth: 62 }}>
        {price !== null ? `$${price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 4 : 2 })}` : "—"}
      </Typography>
      <Typography
        variant="caption"
        sx={{ fontFamily: monoStack, minWidth: 48, color: up ? bonncoColors.bullish : bonncoColors.bearish, fontWeight: 600 }}
      >
        {changePct !== null ? `${up ? "+" : ""}${changePct.toFixed(2)}%` : "—"}
      </Typography>
      {signal && <SignalBadge signal={signal.signal} size="small" />}
    </Stack>
  );
}

export default function WatchlistStrip() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WatchlistItem[] | null>(null);
  const [signals, setSignals] = useState<Record<string, SignalOut | null>>({});

  const load = useCallback(async () => {
    const [list, settings] = await Promise.all([fetchWatchlist(), fetchSettings()]);
    setItems(list);
    const timeframe = settings.dashboard_timeframe;
    const entries = await Promise.all(
      list.map(async (item) => {
        const signal = await fetchLatestSignal(item.symbol, item.market_type, timeframe).catch(() => null);
        return [`${item.symbol}:${item.market_type}`, signal] as const;
      }),
    );
    setSignals(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, SIGNAL_REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (!items || items.length === 0) return null;

  return (
    <Box
      sx={{
        borderBottom: `1px solid ${bonncoColors.border}`,
        backgroundColor: bonncoColors.bgPaper,
        px: 1.5,
      }}
    >
      <Stack
        direction="row"
        sx={{
          gap: 0.75,
          py: 1,
          overflowX: "auto",
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: bonncoColors.border, borderRadius: 2 },
        }}
      >
        {items.map((item) => (
          <WatchlistStripEntry
            key={item.id}
            item={item}
            signal={signals[`${item.symbol}:${item.market_type}`] ?? null}
            onNavigate={() => navigate(`/coin/${item.symbol}?market_type=${item.market_type}`)}
          />
        ))}
      </Stack>
    </Box>
  );
}
