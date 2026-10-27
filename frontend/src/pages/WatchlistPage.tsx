import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Card, Chip, Grid, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
  addWatchlistItem,
  backfillCandles,
  fetchCandles,
  fetchSettings,
  fetchTopSymbols,
  fetchWatchlist,
  generateSignal,
  removeWatchlistItem,
  updateSettings,
  updateWatchlistItemMode,
} from "../api/client";
import type { Candle, MarketType, SignalOut, WatchlistItem } from "../api/client";
import CoinSignalCard from "../components/CoinSignalCard";
import SignalBadge from "../components/SignalBadge";
import LastUpdated from "../components/LastUpdated";
import CoinIcon from "../components/CoinIcon";
import SymbolPicker from "../components/SymbolPicker";
import TimeframeHint from "../components/TimeframeHint";
import { bonncoColors } from "../theme/theme";

const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];
const REFRESH_INTERVAL_MS = 45_000;
const MARKET_LIMIT = 15;

interface TrackedCoin {
  symbol: string;
  marketType: MarketType;
}

interface CardEntry extends TrackedCoin {
  signal?: SignalOut;
  candles?: Candle[];
  error?: string;
}

function cardKey(c: TrackedCoin): string {
  return `${c.symbol}:${c.marketType}`;
}

function MarketTypeToggle({
  value,
  onChange,
  size = "small",
}: {
  value: MarketType;
  onChange: (mt: MarketType) => void;
  size?: "small" | "medium";
}) {
  return (
    <Stack direction="row" sx={{ gap: 0.5 }}>
      {(["spot", "futures"] as MarketType[]).map((mt) => (
        <Chip
          key={mt}
          label={mt === "spot" ? "Spot" : "Futures"}
          size={size}
          onClick={() => onChange(mt)}
          sx={{
            cursor: "pointer",
            backgroundColor: value === mt ? bonncoColors.accent : bonncoColors.bgElevated,
            color: value === mt ? "#fff" : bonncoColors.textSecondary,
            fontWeight: 600,
          }}
        />
      ))}
    </Stack>
  );
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [marketCoins, setMarketCoins] = useState<TrackedCoin[]>([]);
  const [cards, setCards] = useState<Record<string, CardEntry>>({});
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("1h");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [newSymbol, setNewSymbol] = useState<string | null>(null);
  const [newMarketType, setNewMarketType] = useState<MarketType>("spot");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const navigate = useNavigate();

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    fetchSettings().then((s) => setTimeframe(s.dashboard_timeframe));
  }, []);

  async function handleTimeframeChange(tf: string) {
    setTimeframe(tf);
    updateSettings({ dashboard_timeframe: tf });
  }

  const loadCard = useCallback(
    async (coin: TrackedCoin) => {
      const key = cardKey(coin);
      try {
        let signal: SignalOut;
        let candles: Candle[];
        try {
          [signal, candles] = await Promise.all([
            generateSignal(coin.symbol, coin.marketType, timeframe),
            fetchCandles(coin.symbol, coin.marketType, timeframe, 30),
          ]);
        } catch (e: any) {
          // Market-tier coins are usually already backfilled by the scheduler, but the top-volume
          // list can rotate — this is the safety net for a symbol that just entered it.
          if (e?.response?.status === 409) {
            await backfillCandles(coin.symbol, coin.marketType, timeframe, 250);
            [signal, candles] = await Promise.all([
              generateSignal(coin.symbol, coin.marketType, timeframe),
              fetchCandles(coin.symbol, coin.marketType, timeframe, 30),
            ]);
          } else {
            throw e;
          }
        }
        setCards((prev) => ({ ...prev, [key]: { ...coin, signal, candles } }));
      } catch (e: any) {
        setCards((prev) => ({
          ...prev,
          [key]: { ...coin, error: e?.response?.data?.detail ?? "Failed to load signal" },
        }));
      }
    },
    [timeframe],
  );

  const loadAll = useCallback(async () => {
    const [watchlistItems, topSymbols] = await Promise.all([fetchWatchlist(), fetchTopSymbols("spot", MARKET_LIMIT)]);
    setWatchlist(watchlistItems);

    const watchlistSymbols = new Set(watchlistItems.map((w) => w.symbol));
    const market = topSymbols
      .filter((t) => !watchlistSymbols.has(t.symbol))
      .map((t) => ({ symbol: t.symbol, marketType: "spot" as MarketType }));
    setMarketCoins(market);

    setLoading(false);

    const watchlistCoins: TrackedCoin[] = watchlistItems.map((w) => ({ symbol: w.symbol, marketType: w.market_type }));
    await Promise.all([...watchlistCoins, ...market].map(loadCard));
    setLastUpdated(new Date());
  }, [loadCard]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadAll]);

  async function handleAdd() {
    if (!newSymbol || adding) return;
    setAddError("");
    setAdding(true);
    try {
      await addWatchlistItem(newSymbol, newMarketType);
      setNewSymbol(null);
      await loadAll();
    } catch (e: any) {
      setAddError(e?.response?.data?.detail ?? "Failed to add symbol");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: number) {
    await removeWatchlistItem(id);
    await loadAll();
  }

  async function handleModeChange(id: number, mt: MarketType) {
    await updateWatchlistItemMode(id, mt);
    await loadAll();
  }

  const allCards = Object.values(cards);
  const topSignals = allCards
    .filter((c): c is CardEntry & { signal: SignalOut } => !!c.signal && c.signal.signal !== "HOLD")
    .sort((a, b) => b.signal.confidence - a.signal.confidence)
    .slice(0, 5);

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5, flexWrap: "wrap", gap: 1 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <Typography variant="h5" fontWeight={700}>
            Watchlist
          </Typography>
          {!loading && (
            <Chip
              label={watchlist.length}
              size="small"
              sx={{ backgroundColor: bonncoColors.bgElevated, color: bonncoColors.textSecondary, fontWeight: 700 }}
            />
          )}
        </Stack>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
          <LastUpdated timestamp={lastUpdated} />
          <Stack direction="row" sx={{ gap: 0.5 }}>
            {TIMEFRAMES.map((tf) => (
              <Chip
                key={tf}
                label={tf}
                size="small"
                onClick={() => handleTimeframeChange(tf)}
                sx={{
                  cursor: "pointer",
                  backgroundColor: tf === timeframe ? bonncoColors.accent : bonncoColors.bgElevated,
                  color: tf === timeframe ? "#fff" : bonncoColors.textSecondary,
                  fontWeight: 600,
                }}
              />
            ))}
          </Stack>
          <TimeframeHint />
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Browse and analyze coins — your tracked watchlist plus the broader market ({timeframe}). Decision support
        only, not financial advice.
      </Typography>

      <Card sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" sx={{ gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
          <Box sx={{ minWidth: 240, flexGrow: 1 }}>
            <SymbolPicker value={newSymbol} onChange={setNewSymbol} marketType={newMarketType} />
          </Box>
          <MarketTypeToggle value={newMarketType} onChange={setNewMarketType} size="medium" />
          <Chip
            icon={<AddIcon sx={{ fontSize: 18, color: "inherit !important" }} />}
            label="Add to watchlist"
            onClick={handleAdd}
            disabled={!newSymbol || adding}
            sx={{
              cursor: "pointer",
              backgroundColor: bonncoColors.accent,
              color: "#fff",
              fontWeight: 700,
              px: 1,
              "&.Mui-disabled": { opacity: 0.4, color: "#fff" },
            }}
          />
        </Stack>
        {addError && (
          <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
            {addError}
          </Typography>
        )}
      </Card>

      {!loading && (
        <Card sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Top signals right now
          </Typography>
          {topSignals.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Nothing strong right now. Everything's in HOLD at this timeframe.
            </Typography>
          )}
          {topSignals.length > 0 && (
            <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
              {topSignals.map((c) => (
                <Stack
                  key={cardKey(c)}
                  direction="row"
                  onClick={() => navigate(`/coin/${c.symbol}`)}
                  sx={{
                    alignItems: "center",
                    gap: 1,
                    cursor: "pointer",
                    border: `1px solid ${bonncoColors.border}`,
                    borderRadius: 2,
                    px: 1.5,
                    py: 0.75,
                  }}
                >
                  <CoinIcon symbol={c.symbol} size={18} />
                  <Typography fontWeight={700} variant="body2">
                    {c.symbol}
                  </Typography>
                  <SignalBadge signal={c.signal.signal} size="small" />
                  <Typography variant="body2" color="text.secondary">
                    {c.signal.confidence}%
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      )}

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        My Watchlist
      </Typography>

      {!loading && watchlist.length === 0 && (
        <Card sx={{ p: 3, mb: 3 }}>
          <Typography color="text.secondary">No coins in your watchlist yet. Search for one above to start tracking it.</Typography>
        </Card>
      )}

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {watchlist.map((item) => {
          const coin: TrackedCoin = { symbol: item.symbol, marketType: item.market_type };
          const key = cardKey(coin);
          return (
            <Grid key={key} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <CoinSignalCard
                symbol={coin.symbol}
                marketType={coin.marketType}
                card={cards[key]}
                expanded={expandedKeys.has(key)}
                onToggleExpand={() => toggleExpanded(key)}
                onNavigate={() => navigate(`/coin/${coin.symbol}`)}
                onRemove={() => handleRemove(item.id)}
                onModeChange={(mt) => handleModeChange(item.id, mt)}
              />
            </Grid>
          );
        })}
      </Grid>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Market
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Top {MARKET_LIMIT} coins by volume on Binance. Browse freely, add any to your watchlist above.
      </Typography>

      <Grid container spacing={2}>
        {marketCoins.map((coin) => {
          const key = cardKey(coin);
          return (
            <Grid key={key} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <CoinSignalCard
                symbol={coin.symbol}
                marketType={coin.marketType}
                card={cards[key]}
                expanded={expandedKeys.has(key)}
                onToggleExpand={() => toggleExpanded(key)}
                onNavigate={() => navigate(`/coin/${coin.symbol}`)}
              />
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
