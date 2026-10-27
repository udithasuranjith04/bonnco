import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Box, Button, Card, Chip, CircularProgress, Stack, Tabs, Tab, Typography } from "@mui/material";
import CircleIcon from "@mui/icons-material/Circle";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import {
  addWatchlistItem,
  backfillCandles,
  fetchCandles,
  fetchLiquidationClusters,
  fetchPatterns,
  fetchWatchlist,
  generateSignal,
} from "../api/client";
import type { Candle, DetectedPattern, LiquidationClustersOut, MarketType, SignalOut, WatchlistItem } from "../api/client";
import CandleChart from "../components/CandleChart";
import SignalBanner from "../components/SignalBanner";
import BeginnerExplainer from "../components/BeginnerExplainer";
import LastUpdated from "../components/LastUpdated";
import LiveTickerBanner from "../components/LiveTickerBanner";
import CoinIcon from "../components/CoinIcon";
import TimeframeHint from "../components/TimeframeHint";
import LiquidationClustersCard from "../components/LiquidationClustersCard";
import { useLiveCandle } from "../hooks/useLiveCandle";
import { bonncoColors } from "../theme/theme";

const PATTERN_BIAS_COLOR: Record<"bullish" | "bearish" | "neutral", string> = {
  bullish: bonncoColors.bullish,
  bearish: bonncoColors.bearish,
  neutral: bonncoColors.accent,
};

const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];
const REFRESH_INTERVAL_MS = 45_000;

export default function CoinDetailPage() {
  const { symbol = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [marketType, setMarketType] = useState<MarketType>(
    () => (searchParams.get("market_type") as MarketType) || "spot",
  );
  const [timeframe, setTimeframe] = useState("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [signal, setSignal] = useState<SignalOut | null>(null);
  const [pattern, setPattern] = useState<DetectedPattern | null>(null);
  const [liquidations, setLiquidations] = useState<LiquidationClustersOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);

  const loadWatchlist = useCallback(() => fetchWatchlist().then(setWatchlist), []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  const availableMarketTypes = useMemo(
    () => watchlist.filter((w) => w.symbol === symbol.toUpperCase()).map((w) => w.market_type),
    [watchlist, symbol],
  );

  useEffect(() => {
    if (availableMarketTypes.length > 0 && !availableMarketTypes.includes(marketType)) {
      setMarketType(availableMarketTypes[0]);
    }
  }, [availableMarketTypes, marketType]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        let candleData: Candle[];
        let signalData: SignalOut;
        try {
          [candleData, signalData] = await Promise.all([
            fetchCandles(symbol.toUpperCase(), marketType, timeframe, 200),
            generateSignal(symbol.toUpperCase(), marketType, timeframe),
          ]);
        } catch (e: any) {
          // Coin has no candle history yet (any symbol not already backfilled) — seed it once
          // from Binance REST, then retry. This is what lets Coin Detail open ANY symbol, not
          // just ones already in the watchlist.
          if (e?.response?.status === 409) {
            await backfillCandles(symbol.toUpperCase(), marketType, timeframe, 250);
            [candleData, signalData] = await Promise.all([
              fetchCandles(symbol.toUpperCase(), marketType, timeframe, 200),
              generateSignal(symbol.toUpperCase(), marketType, timeframe),
            ]);
          } else {
            throw e;
          }
        }
        setCandles(candleData);
        setSignal(signalData);
        setError(null);
        setLastUpdated(new Date());

        // Best-effort enrichment. A pattern-scan or liquidation-fetch failure should never block
        // the rest of the page, it just means no overlay/callout shows this refresh.
        fetchPatterns(symbol.toUpperCase(), marketType, timeframe)
          .then((scan) => setPattern(scan.headline))
          .catch(() => setPattern(null));

        if (marketType === "futures") {
          fetchLiquidationClusters(symbol.toUpperCase(), 4)
            .then(setLiquidations)
            .catch(() => setLiquidations(null));
        } else {
          setLiquidations(null);
        }
      } catch (e: any) {
        if (!opts?.silent) {
          setError(e?.response?.data?.detail ?? "Failed to load this coin's data.");
          setSignal(null);
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [symbol, marketType, timeframe],
  );

  async function handleAddToWatchlist() {
    setAddingToWatchlist(true);
    try {
      await addWatchlistItem(symbol.toUpperCase(), marketType);
      await loadWatchlist();
    } finally {
      setAddingToWatchlist(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load({ silent: true }), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const { tick: liveTick, connected: liveConnected } = useLiveCandle(symbol.toUpperCase(), marketType, timeframe);

  // When the live-streamed candle closes, refresh history/indicators/signal from MySQL right away
  // rather than waiting for the next 45s poll — this is the moment the overlays actually need updating.
  const lastClosedOpenTimeRef = useRef<number | null>(null);
  useEffect(() => {
    if (liveTick?.is_closed && liveTick.open_time !== lastClosedOpenTimeRef.current) {
      lastClosedOpenTimeRef.current = liveTick.open_time;
      load({ silent: true });
    }
  }, [liveTick, load]);

  function handleAskBonnco() {
    navigate("/chat", {
      state: {
        prefillQuestion: `Explain the current ${symbol.toUpperCase()} signal on the ${timeframe} chart.`,
        symbol: symbol.toUpperCase(),
        marketType,
        timeframe,
      },
    });
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
          <CoinIcon symbol={symbol.toUpperCase()} size={30} />
          <Typography variant="h5" fontWeight={700}>
            {symbol.toUpperCase()}
          </Typography>
          {availableMarketTypes.length > 1 && (
            <Tabs
              value={marketType}
              onChange={(_, v) => setMarketType(v)}
              sx={{ minHeight: 0, "& .MuiTab-root": { minHeight: 0, py: 0.5 } }}
            >
              <Tab value="spot" label="Spot" />
              <Tab value="futures" label="Futures" />
            </Tabs>
          )}
          {availableMarketTypes.length <= 1 && (
            <Chip label={marketType} size="small" variant="outlined" sx={{ borderColor: bonncoColors.border }} />
          )}
          {!availableMarketTypes.includes(marketType) && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleAddToWatchlist}
              disabled={addingToWatchlist}
              sx={{ borderColor: bonncoColors.border }}
            >
              {addingToWatchlist ? "Adding…" : "Add to Watchlist"}
            </Button>
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
                onClick={() => setTimeframe(tf)}
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

      {!loading && !error && signal && (
        <LiveTickerBanner symbol={symbol.toUpperCase()} marketType={marketType} fallbackPrice={signal.entry_price} />
      )}

      {loading && (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress size={28} />
        </Stack>
      )}

      {!loading && error && (
        <Card sx={{ p: 3 }}>
          <Typography color="text.secondary">{error}</Typography>
        </Card>
      )}

      {!loading && !error && signal && (
        <>
          <SignalBanner signal={signal} onAskBonnco={handleAskBonnco} />

          <Card sx={{ p: 2, mb: 3 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75, mb: 1 }}>
              <CircleIcon
                sx={{
                  fontSize: "8px !important",
                  color: liveConnected ? bonncoColors.bullish : bonncoColors.textSecondary,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {liveConnected ? "Live" : "Connecting…"}
              </Typography>
            </Stack>
            <CandleChart candles={candles} liveTick={liveTick} pattern={pattern} />

            {pattern && (
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${bonncoColors.border}` }}>
                <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
                  <Box
                    sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: PATTERN_BIAS_COLOR[pattern.bias] }}
                  />
                  <Typography fontWeight={700} sx={{ textTransform: "capitalize" }}>
                    {pattern.pattern.replace(/_/g, " ")}
                  </Typography>
                  <Chip
                    label={pattern.confirmed ? "Confirmed" : `${Math.round(pattern.completeness * 100)}% formed`}
                    size="small"
                    sx={{
                      backgroundColor: `${PATTERN_BIAS_COLOR[pattern.bias]}22`,
                      color: PATTERN_BIAS_COLOR[pattern.bias],
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                  {pattern.interpretation}
                </Typography>
              </Box>
            )}
          </Card>

          {marketType === "futures" && liquidations && (
            <Box sx={{ mb: 3 }}>
              <LiquidationClustersCard data={liquidations} />
            </Box>
          )}

          <BeginnerExplainer snapshot={signal.indicator_snapshot as any} />
        </>
      )}
    </Box>
  );
}
