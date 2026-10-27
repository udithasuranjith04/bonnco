import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Card, Chip, CircularProgress, Link as MuiLink, Stack, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import { fetchNews, fetchWatchlist, refreshNews } from "../api/client";
import type { NewsSentimentOut, Sentiment } from "../api/client";
import LastUpdated from "../components/LastUpdated";
import CoinIcon from "../components/CoinIcon";
import ConfidenceBar from "../components/ConfidenceBar";
import { baseAsset } from "../lib/symbol";
import { bonncoColors, monoStack } from "../theme/theme";

const REFRESH_INTERVAL_MS = 60_000;
const SIDEBAR_WIDTH = 248;
const ROW_GRID = "26px 92px minmax(0, 1fr) 132px";

const SENTIMENT_STYLES: Record<Sentiment, { fg: string; label: string; icon: typeof TrendingUpIcon }> = {
  bullish: { fg: bonncoColors.bullish, label: "Bullish", icon: TrendingUpIcon },
  bearish: { fg: bonncoColors.bearish, label: "Bearish", icon: TrendingDownIcon },
  neutral: { fg: bonncoColors.neutral, label: "Neutral", icon: TrendingFlatIcon },
};

const SENTIMENT_FILTERS: (Sentiment | "all")[] = ["all", "bullish", "neutral", "bearish"];

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ fontFamily: monoStack, letterSpacing: "0.08em", color: bonncoColors.textSecondary, display: "block", mb: 1 }}
    >
      {children}
    </Typography>
  );
}

function MoodPulse({ news }: { news: NewsSentimentOut[] }) {
  const counts = useMemo(() => {
    const c = { bullish: 0, neutral: 0, bearish: 0 };
    for (const n of news) c[n.sentiment]++;
    return c;
  }, [news]);
  const total = counts.bullish + counts.neutral + counts.bearish;

  return (
    <Card sx={{ p: 1.75, borderRadius: 1.5 }}>
      <SectionLabel>MARKET MOOD</SectionLabel>

      {total === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No scored headlines yet.
        </Typography>
      ) : (
        <>
          <Box sx={{ display: "flex", width: "100%", height: 5, borderRadius: 999, overflow: "hidden", mb: 1.5, backgroundColor: bonncoColors.bgElevated }}>
            {(["bullish", "neutral", "bearish"] as Sentiment[]).map((s) =>
              counts[s] > 0 ? (
                <Box key={s} sx={{ width: `${(counts[s] / total) * 100}%`, backgroundColor: SENTIMENT_STYLES[s].fg }} />
              ) : null,
            )}
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto auto", rowGap: 0.6, columnGap: 1.5 }}>
            {(["bullish", "neutral", "bearish"] as Sentiment[]).map((s) => {
              const style = SENTIMENT_STYLES[s];
              return (
                <Box key={s} sx={{ display: "contents" }}>
                  <Typography variant="body2" sx={{ color: style.fg, fontWeight: 600 }}>
                    {style.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: monoStack, fontWeight: 600, textAlign: "right" }}>
                    {counts[s]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: monoStack, textAlign: "right", minWidth: 34 }}>
                    {Math.round((counts[s] / total) * 100)}%
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Card>
  );
}

export default function NewsFeedPage() {
  const [news, setNews] = useState<NewsSentimentOut[]>([]);
  const [coinFilter, setCoinFilter] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment | "all">("all");
  const [coinOptions, setCoinOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchWatchlist().then((items) => {
      setCoinOptions([...new Set(items.map((w) => baseAsset(w.symbol)))]);
    });
  }, []);

  const load = useCallback(async () => {
    const data = await fetchNews(coinFilter || undefined, 50);
    setNews(data);
    setLoading(false);
    setLastUpdated(new Date());
  }, [coinFilter]);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      await refreshNews();
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const displayedNews = useMemo(
    () => (sentimentFilter === "all" ? news : news.filter((n) => n.sentiment === sentimentFilter)),
    [news, sentimentFilter],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 112px)" }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>
          News Feed
        </Typography>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <Box
            className="bonnco-live-dot"
            sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: bonncoColors.bullish, color: bonncoColors.bullish }}
          />
          <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.08em", color: bonncoColors.textSecondary }}>
            LIVE
          </Typography>
          <LastUpdated timestamp={lastUpdated} />
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Recent crypto headlines scored by GPT-4o-mini for sentiment. Checked every few minutes automatically.
      </Typography>

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, flexGrow: 1, minHeight: 0 }}>
        <Stack sx={{ width: { xs: "100%", md: SIDEBAR_WIDTH }, flexShrink: 0, gap: 1.5, overflowY: "auto" }}>
          <MoodPulse news={news} />

          <Card sx={{ p: 1.75, borderRadius: 1.5 }}>
            <SectionLabel>SENTIMENT</SectionLabel>
            <Stack direction="row" sx={{ borderBottom: `1px solid ${bonncoColors.border}` }}>
              {SENTIMENT_FILTERS.map((s) => {
                const active = sentimentFilter === s;
                const color = s === "all" ? bonncoColors.accent : SENTIMENT_STYLES[s].fg;
                const label = s === "all" ? "All" : SENTIMENT_STYLES[s].label;
                return (
                  <Box
                    key={s}
                    onClick={() => setSentimentFilter(s)}
                    sx={{
                      cursor: "pointer",
                      px: 1,
                      pb: 0.85,
                      fontSize: 13,
                      fontWeight: 600,
                      color: active ? color : bonncoColors.textSecondary,
                      borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
                      transition: "color 150ms ease, border-color 150ms ease",
                    }}
                  >
                    {label}
                  </Box>
                );
              })}
            </Stack>
          </Card>

          <Card sx={{ p: 1.75, borderRadius: 1.5 }}>
            <SectionLabel>COIN</SectionLabel>
            <Stack direction="row" sx={{ gap: 0.6, flexWrap: "wrap" }}>
              <Chip
                label="All"
                size="small"
                variant={coinFilter === "" ? "filled" : "outlined"}
                onClick={() => setCoinFilter("")}
                sx={{
                  cursor: "pointer",
                  borderRadius: 1,
                  backgroundColor: coinFilter === "" ? bonncoColors.bgElevated : "transparent",
                  borderColor: coinFilter === "" ? bonncoColors.accent : bonncoColors.border,
                  color: coinFilter === "" ? bonncoColors.textPrimary : bonncoColors.textSecondary,
                  fontWeight: 600,
                }}
              />
              {coinOptions.map((c) => {
                const active = coinFilter === c;
                return (
                  <Chip
                    key={c}
                    icon={<CoinIcon symbol={c} size={13} />}
                    label={c}
                    size="small"
                    variant={active ? "filled" : "outlined"}
                    onClick={() => setCoinFilter(c)}
                    sx={{
                      cursor: "pointer",
                      borderRadius: 1,
                      backgroundColor: active ? bonncoColors.bgElevated : "transparent",
                      borderColor: active ? bonncoColors.accent : bonncoColors.border,
                      color: active ? bonncoColors.textPrimary : bonncoColors.textSecondary,
                      fontWeight: 600,
                      "& .MuiChip-icon": { ml: "6px" },
                    }}
                  />
                );
              })}
            </Stack>
          </Card>

          <Stack
            direction="row"
            onClick={refreshing ? undefined : handleManualRefresh}
            sx={{
              alignItems: "center",
              gap: 0.85,
              cursor: refreshing ? "default" : "pointer",
              color: refreshing ? bonncoColors.textSecondary : bonncoColors.accent,
              px: 0.5,
              "&:hover": refreshing ? undefined : { opacity: 0.8 },
            }}
          >
            <RefreshIcon className={refreshing ? "bonnco-spin" : undefined} sx={{ fontSize: 16 }} />
            <Typography variant="body2" fontWeight={600}>
              {refreshing ? "Checking feeds…" : "Check for new headlines"}
            </Typography>
          </Stack>
        </Stack>

        <Card sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", p: 0, borderRadius: 1.5 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: ROW_GRID,
              gap: 2,
              px: 2.5,
              py: 1,
              borderBottom: `1px solid ${bonncoColors.border}`,
              backgroundColor: bonncoColors.bgElevated,
            }}
          >
            <Box />
            <SectionLabel>COIN</SectionLabel>
            <SectionLabel>HEADLINE</SectionLabel>
            <SectionLabel>CONFIDENCE</SectionLabel>
          </Box>

          <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
            {loading && (
              <Stack sx={{ alignItems: "center", py: 6 }}>
                <CircularProgress size={22} />
              </Stack>
            )}

            {!loading && displayedNews.length === 0 && (
              <Stack sx={{ alignItems: "center", py: 6 }}>
                <Typography color="text.secondary">
                  No scored headlines match these filters yet. Try "Check for new headlines".
                </Typography>
              </Stack>
            )}

            {displayedNews.map((n) => {
              const style = SENTIMENT_STYLES[n.sentiment] ?? SENTIMENT_STYLES.neutral;
              const SentimentIcon = style.icon;
              const relatedCoins = n.related_symbol ? n.related_symbol.split(",").filter(Boolean) : [];

              return (
                <Box
                  key={n.id}
                  className="bonnco-msg-in"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: ROW_GRID,
                    gap: 2,
                    alignItems: "start",
                    px: 2.5,
                    py: 1.5,
                    borderBottom: `1px solid ${bonncoColors.border}`,
                    "&:hover": { backgroundColor: bonncoColors.bgElevated },
                  }}
                >
                  <SentimentIcon sx={{ fontSize: 17, color: style.fg, mt: 0.3 }} />

                  <Stack sx={{ gap: 0.5 }}>
                    {relatedCoins.length > 0 ? (
                      relatedCoins.map((s) => (
                        <Stack key={s} direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
                          <CoinIcon symbol={s} size={13} />
                          <Typography variant="caption" sx={{ fontFamily: monoStack, fontWeight: 600 }}>
                            {s}
                          </Typography>
                        </Stack>
                      ))
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        General
                      </Typography>
                    )}
                  </Stack>

                  <Box sx={{ minWidth: 0 }}>
                    <MuiLink
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="hover"
                      sx={{ color: bonncoColors.textPrimary, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 0.5 }}
                    >
                      {n.headline}
                      <OpenInNewIcon sx={{ fontSize: 13, flexShrink: 0 }} />
                    </MuiLink>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, lineHeight: 1.5 }}>
                      {n.reason}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontFamily: monoStack, display: "block", mt: 0.5 }}
                    >
                      {n.source} · {n.published_at ? timeAgo(n.published_at) : timeAgo(n.created_at)}
                      {n.ai_provider && n.ai_provider !== "openai" ? ` · via ${n.ai_provider}` : ""}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: monoStack, fontWeight: 600, textAlign: "right", mb: 0.5 }}
                    >
                      {Math.round(n.confidence * 100)}%
                    </Typography>
                    <ConfidenceBar confidence={n.confidence * 100} color={style.fg} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Card>
      </Box>
    </Box>
  );
}
