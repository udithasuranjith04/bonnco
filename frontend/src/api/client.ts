import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export type MarketType = "spot" | "futures";
export type SignalValue = "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
export type RiskProfile = "conservative" | "moderate" | "aggressive";

export interface WatchlistItem {
  id: number;
  symbol: string;
  market_type: MarketType;
  enabled: boolean;
  created_at: string;
}

export interface SignalOut {
  id: number;
  symbol: string;
  timeframe: string;
  market_type: MarketType;
  signal: SignalValue;
  confidence: number;
  reasoning: string;
  entry_price: number;
  stop_loss: number | null;
  suggested_leverage_min: number | null;
  suggested_leverage_max: number | null;
  liquidation_estimate: number | null;
  liquidation_disclaimer: string | null;
  indicator_snapshot: unknown;
  sentiment_snapshot: unknown;
  pattern_summary: string | null;
  pattern_bias: "bullish" | "bearish" | "neutral" | null;
  pattern_confirmed: boolean | null;
  created_at: string;
}

export interface Candle {
  open_time: string;
  close_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buy_volume: number | null;
  sell_volume: number | null;
  delta: number | null;
}

export async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const { data } = await apiClient.get<WatchlistItem[]>("/api/watchlist");
  return data;
}

export async function updateWatchlistItemMode(id: number, marketType: MarketType): Promise<WatchlistItem> {
  const { data } = await apiClient.patch<WatchlistItem>(`/api/watchlist/${id}`, { market_type: marketType });
  return data;
}

export async function removeWatchlistItem(id: number): Promise<void> {
  await apiClient.delete(`/api/watchlist/${id}`);
}

export async function addWatchlistItem(symbol: string, marketType: MarketType): Promise<WatchlistItem> {
  const { data } = await apiClient.post<WatchlistItem>("/api/watchlist", { symbol, market_type: marketType });
  return data;
}

export async function backfillCandles(
  symbol: string,
  marketType: MarketType,
  timeframe: string,
  limit = 250,
): Promise<{ stored: number }> {
  const { data } = await apiClient.post<{ stored: number }>("/api/market/backfill", {
    symbol,
    market_type: marketType,
    timeframe,
    limit,
  });
  return data;
}

export interface TopSymbolOut {
  symbol: string;
  price: number;
  price_change_percent: number;
  volume_24h: number;
}

export async function fetchTopSymbols(marketType: MarketType = "spot", limit = 15): Promise<TopSymbolOut[]> {
  const { data } = await apiClient.get<TopSymbolOut[]>("/api/market/top-symbols", {
    params: { market_type: marketType, limit },
  });
  return data;
}

export interface TickerSnapshotOut {
  symbol: string;
  market_type: MarketType;
  price: number;
  price_change_percent: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
}

export async function fetchTicker(symbol: string, marketType: MarketType = "spot"): Promise<TickerSnapshotOut> {
  const { data } = await apiClient.get<TickerSnapshotOut>(`/api/market/ticker/${symbol}`, {
    params: { market_type: marketType },
  });
  return data;
}

export async function searchSymbols(
  query: string,
  marketType: MarketType = "spot",
  limit = 10,
): Promise<TopSymbolOut[]> {
  const { data } = await apiClient.get<TopSymbolOut[]>("/api/market/search-symbols", {
    params: { q: query, market_type: marketType, limit },
  });
  return data;
}

export async function generateSignal(
  symbol: string,
  marketType: MarketType,
  timeframe = "1h",
): Promise<SignalOut> {
  const { data } = await apiClient.post<SignalOut>("/api/signals/generate", {
    symbol,
    market_type: marketType,
    timeframe,
  });
  return data;
}

export async function fetchCandles(
  symbol: string,
  marketType: MarketType,
  timeframe = "1h",
  limit = 30,
): Promise<Candle[]> {
  const { data } = await apiClient.get<Candle[]>("/api/market/candles", {
    params: { symbol, market_type: marketType, timeframe, limit },
  });
  return data;
}

export interface PatternKeyPoint {
  open_time: string;
  price: number;
  label: string;
}

export interface DetectedPattern {
  pattern: string;
  category: "reversal" | "continuation" | "candlestick";
  bias: "bullish" | "bearish" | "neutral";
  symbol: string;
  market_type: MarketType;
  timeframe: string;
  completeness: number;
  confirmed: boolean;
  price_low: number;
  price_high: number;
  range_start: string;
  range_end: string;
  interpretation: string;
  key_points: PatternKeyPoint[];
}

export interface PatternScan {
  headline: DetectedPattern | null;
  secondary: DetectedPattern | null;
}

export async function fetchPatterns(symbol: string, marketType: MarketType, timeframe = "1h"): Promise<PatternScan> {
  const { data } = await apiClient.get<PatternScan>("/api/patterns", {
    params: { symbol, market_type: marketType, timeframe },
  });
  return data;
}

export interface LiquidationCluster {
  price_low: number;
  price_high: number;
  total_usd: number;
  count: number;
  dominant_side: "BUY" | "SELL";
}

export interface LiquidationClustersOut {
  symbol: string;
  hours: number;
  total_usd: number;
  event_count: number;
  clusters: LiquidationCluster[];
  summary: string;
}

export async function fetchLiquidationClusters(symbol: string, hours = 4): Promise<LiquidationClustersOut> {
  const { data } = await apiClient.get<LiquidationClustersOut>("/api/liquidations", {
    params: { symbol, hours },
  });
  return data;
}

export interface WhaleActivityOut {
  id: number;
  chain: "ethereum" | "solana";
  asset: string;
  from_address: string;
  to_address: string;
  amount: number;
  amount_usd: number;
  tx_hash: string | null;
  event_time: string;
}

export async function fetchWhaleActivity(
  chain?: "ethereum" | "solana" | "bitcoin",
  hours = 24,
  limit = 50,
): Promise<WhaleActivityOut[]> {
  const { data } = await apiClient.get<WhaleActivityOut[]>("/api/whale-activity", {
    params: { chain, hours, limit },
  });
  return data;
}

export interface AppSettings {
  risk_profile: RiskProfile;
  dashboard_timeframe: string;
  account_size_usd: number;
  default_risk_pct: number;
  notifications_enabled: boolean;
  entry_alert_confidence_threshold: number;
  position_alerts_enabled: boolean;
  sound_enabled: boolean;
}

export async function fetchSettings(): Promise<AppSettings> {
  const { data } = await apiClient.get<AppSettings>("/api/settings");
  return data;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const { data } = await apiClient.put<AppSettings>("/api/settings", patch);
  return data;
}

export type Sentiment = "bullish" | "bearish" | "neutral";

export interface NewsSentimentOut {
  id: number;
  headline: string;
  source: string;
  url: string;
  related_symbol: string | null;
  published_at: string | null;
  sentiment: Sentiment;
  confidence: number;
  reason: string;
  ai_provider: string;
  created_at: string;
}

export async function fetchNews(symbol?: string, limit = 50): Promise<NewsSentimentOut[]> {
  const { data } = await apiClient.get<NewsSentimentOut[]>("/api/news", {
    params: { symbol: symbol || undefined, limit },
  });
  return data;
}

export async function refreshNews(): Promise<{ stored: number }> {
  const { data } = await apiClient.post<{ stored: number }>("/api/news/refresh");
  return data;
}

export interface ChatMessageOut {
  id: number;
  role: "user" | "assistant";
  content: string;
  symbol: string | null;
  created_at: string;
}

export async function fetchChatHistory(sessionId: string): Promise<ChatMessageOut[]> {
  const { data } = await apiClient.get<ChatMessageOut[]>("/api/chat/history", {
    params: { session_id: sessionId },
  });
  return data;
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  symbol: string | null,
  marketType: MarketType,
  timeframe: string,
  page: string | null = null,
): Promise<{ reply: string; provider: string }> {
  const { data } = await apiClient.post<{ reply: string; provider: string }>("/api/chat", {
    session_id: sessionId,
    message,
    symbol,
    market_type: marketType,
    timeframe,
    page,
  });
  return data;
}

export type TradeSide = "long" | "short";

export interface TradeJournalEntryOut {
  id: number;
  symbol: string;
  market_type: MarketType;
  side: TradeSide;
  entry_price: number;
  exit_price: number | null;
  leverage: number;
  result_pnl: number | null;
  stop_loss: number | null;
  position_size_usd: number | null;
  status: "open" | "closed";
  source: "manual" | "binance_import" | "binance_trade_sync";
  signal_id: number | null;
  notes: string;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
}

export interface ActivePositionOut {
  trade: TradeJournalEntryOut;
  current_price: number;
  pnl_pct: number;
  pnl_usd: number | null;
  current_signal: SignalValue | null;
  guidance: string;
  stop_warning: string | null;
}

export async function fetchActivePositions(): Promise<ActivePositionOut[]> {
  const { data } = await apiClient.get<ActivePositionOut[]>("/api/journal/active");
  return data;
}

export interface BucketStats {
  trades: number;
  wins: number;
  win_rate: number | null;
}

export interface JournalStatsOut {
  overall: BucketStats;
  signal_aligned: BucketStats;
  signal_not_aligned: BucketStats;
  no_signal_data: BucketStats;
  open_trades: number;
}

export interface TradeJournalCreateInput {
  symbol: string;
  market_type: MarketType;
  side: TradeSide;
  entry_price: number;
  exit_price?: number;
  leverage: number;
  stop_loss?: number;
  position_size_usd?: number;
  notes?: string;
}

export async function fetchJournalTrades(): Promise<TradeJournalEntryOut[]> {
  const { data } = await apiClient.get<TradeJournalEntryOut[]>("/api/journal");
  return data;
}

export async function fetchJournalStats(): Promise<JournalStatsOut> {
  const { data } = await apiClient.get<JournalStatsOut>("/api/journal/stats");
  return data;
}

export async function createJournalTrade(input: TradeJournalCreateInput): Promise<TradeJournalEntryOut> {
  const { data } = await apiClient.post<TradeJournalEntryOut>("/api/journal", input);
  return data;
}

export async function closeJournalTrade(id: number, exitPrice: number): Promise<TradeJournalEntryOut> {
  const { data } = await apiClient.patch<TradeJournalEntryOut>(`/api/journal/${id}`, { exit_price: exitPrice });
  return data;
}

// The entry itself (price/size/leverage) is real and locked once synced from Binance — this only
// ever patches `notes`, the one field that's always yours to add regardless of how the trade
// entry got created.
export async function updateJournalTradeNotes(id: number, notes: string): Promise<TradeJournalEntryOut> {
  const { data } = await apiClient.patch<TradeJournalEntryOut>(`/api/journal/${id}`, { notes });
  return data;
}

export async function deleteJournalTrade(id: number): Promise<void> {
  await apiClient.delete(`/api/journal/${id}`);
}

export interface OutcomeBucket {
  resolved: number;
  correct: number;
  win_rate: number | null;
  stopped_out: number;
}

export interface ConfidenceBandBucket extends OutcomeBucket {
  band: string;
}

export interface SignalTypeBucket extends OutcomeBucket {
  signal_type: string;
}

export interface CoinBucket extends OutcomeBucket {
  coin: string;
}

export interface TimeframeBucket extends OutcomeBucket {
  timeframe: string;
}

export interface HorizonBucket extends OutcomeBucket {
  horizon_hours: number;
}

export interface SignalOutcomeStatsOut {
  overall: OutcomeBucket;
  reliable_sample_size: number;
  unresolved_count: number;
  hold_count: number;
  by_confidence_band: ConfidenceBandBucket[];
  by_signal_type: SignalTypeBucket[];
  by_coin: CoinBucket[];
  by_timeframe: TimeframeBucket[];
  by_horizon_hours: HorizonBucket[];
}

export async function fetchSignalOutcomeStats(params?: {
  symbol?: string;
  timeframe?: string;
}): Promise<SignalOutcomeStatsOut> {
  const { data } = await apiClient.get<SignalOutcomeStatsOut>("/api/signals/outcomes/stats", { params });
  return data;
}

export interface BinancePermissions {
  ipRestrict?: boolean;
  createTime?: number;
  enableReading?: boolean;
  enableWithdrawals?: boolean;
  enableInternalTransfer?: boolean;
  enableMargin?: boolean;
  enableFutures?: boolean;
  enableSpotAndMarginTrading?: boolean;
  enablePortfolioMarginTrading?: boolean;
}

export interface BinanceStatusOut {
  connected: boolean;
  source: "env" | "database" | null;
  masked_key: string | null;
  safe: boolean;
  warnings: string[];
  permissions: BinancePermissions | null;
}

export async function fetchBinanceStatus(): Promise<BinanceStatusOut> {
  const { data } = await apiClient.get<BinanceStatusOut>("/api/binance/status");
  return data;
}

export async function connectBinance(apiKey: string, apiSecret: string): Promise<BinanceStatusOut> {
  const { data } = await apiClient.post<BinanceStatusOut>("/api/binance/connect", { api_key: apiKey, api_secret: apiSecret });
  return data;
}

export async function disconnectBinance(): Promise<void> {
  await apiClient.delete("/api/binance/disconnect");
}

export interface BinanceBalanceOut {
  connected: boolean;
  spot_usd: number | null;
  futures_usd: number | null;
  total_usd: number | null;
  unpriced_assets: string[];
}

export async function fetchBinanceBalance(): Promise<BinanceBalanceOut> {
  const { data } = await apiClient.get<BinanceBalanceOut>("/api/binance/balance");
  return data;
}

export interface AssetHolding {
  asset: string;
  amount: number;
  spot_amount: number;
  earn_amount: number;
  futures_amount: number;
  usd_value: number | null;
}

export async function fetchBinanceWallet(): Promise<AssetHolding[]> {
  const { data } = await apiClient.get<AssetHolding[]>("/api/binance/wallet");
  return data;
}

export interface BinancePosition {
  symbol: string;
  side: TradeSide;
  position_amt: number;
  entry_price: number;
  mark_price: number;
  leverage: number;
  unrealized_pnl: number;
  notional_usd: number;
  liquidation_price: number | null;
  liquidation_distance_pct: number | null;
  margin_warning: string | null;
}

export async function fetchBinancePositions(): Promise<BinancePosition[]> {
  const { data } = await apiClient.get<BinancePosition[]>("/api/binance/positions");
  return data;
}

export interface BinanceOpenOrder {
  symbol: string;
  side: TradeSide;
  type: string;
  price: number;
  orig_qty: number;
  status: string | null;
}

export interface BinanceOpenOrdersOut {
  spot: BinanceOpenOrder[];
  futures: BinanceOpenOrder[];
}

export async function fetchBinanceOpenOrders(): Promise<BinanceOpenOrdersOut> {
  const { data } = await apiClient.get<BinanceOpenOrdersOut>("/api/binance/open-orders");
  return data;
}

export interface ReconcileMatch {
  binance_position: BinancePosition;
  journal_entry_id: number;
}

export interface ReconcileOut {
  matched: ReconcileMatch[];
  unmatched_binance_positions: BinancePosition[];
  unmatched_journal_entry_ids: number[];
}

export async function fetchBinanceReconcile(): Promise<ReconcileOut> {
  const { data } = await apiClient.get<ReconcileOut>("/api/binance/reconcile");
  return data;
}

export async function importBinancePosition(symbol: string): Promise<TradeJournalEntryOut> {
  const { data } = await apiClient.post<TradeJournalEntryOut>("/api/binance/import-position", { symbol });
  return data;
}

export interface ConcentrationEntry {
  coin: string;
  usd_value: number;
  pct_of_portfolio: number;
}

export interface CorrelationWarning {
  coins: string[];
  correlation: number;
  combined_pct_of_portfolio: number;
  message: string;
}

export interface PortfolioSummaryOut {
  connected: boolean;
  total_value_usd: number | null;
  spot_value_usd: number | null;
  earn_value_usd: number | null;
  futures_margin_usd: number | null;
  today_pnl_usd: number | null;
  today_pnl_pct: number | null;
  unpriced_assets: string[];
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummaryOut> {
  const { data } = await apiClient.get<PortfolioSummaryOut>("/api/binance/portfolio/summary");
  return data;
}

export interface FeeTier {
  maker_pct: number;
  taker_pct: number;
  tier_label: string;
  volume_note: string;
}

export interface SimpleEarnHolding {
  asset: string;
  amount: number;
  product: string;
  apy_pct: number;
  maturity_date: string | null;
}

export interface PortfolioOverviewOut {
  connected: boolean;
  total_exposure_usd: number | null;
  concentration: ConcentrationEntry[];
  correlation_warnings: CorrelationWarning[];
  fee_tier: FeeTier | null;
  simple_earn: SimpleEarnHolding[];
  total_unrealized_pnl_usd: number | null;
}

export async function fetchBinancePortfolio(): Promise<PortfolioOverviewOut> {
  const { data } = await apiClient.get<PortfolioOverviewOut>("/api/binance/portfolio");
  return data;
}

export interface TradeHistorySyncOut {
  imported_by_symbol: Record<string, number>;
  total_imported: number;
}

export async function syncBinanceTradeHistory(): Promise<TradeHistorySyncOut> {
  const { data } = await apiClient.post<TradeHistorySyncOut>("/api/binance/trade-history/sync");
  return data;
}

export interface ExposureHistoryPoint {
  time: string;
  exposure_usd: number;
}

export async function fetchExposureHistory(hours = 24): Promise<ExposureHistoryPoint[]> {
  const { data } = await apiClient.get<ExposureHistoryPoint[]>("/api/binance/portfolio/exposure-history", {
    params: { hours },
  });
  return data;
}

// Reads the most recently generated signal for a symbol without triggering a new GPT-4o-mini call —
// used anywhere a signal needs to render passively across many symbols/pages (e.g. a persistent
// watchlist strip), where re-generating on every render would be wasteful and noisy.
// `timeframe` is required, not optional — without it this silently returns whichever timeframe
// was generated most recently for the symbol (5m, 1h, 1d...), which can differ from request to
// request depending on what else was open elsewhere in the app, making the same coin's badge
// appear to "flip" even though nothing about the market actually changed.
export async function fetchLatestSignal(symbol: string, marketType: MarketType, timeframe: string): Promise<SignalOut | null> {
  const { data } = await apiClient.get<SignalOut[]>("/api/signals", {
    params: { symbol, market_type: marketType, timeframe, limit: 1 },
  });
  return data[0] ?? null;
}

export interface GoalOut {
  current_value_usd: number | null;
  highest_milestone_reached_usd: number;
  next_milestone_usd: number | null;
  milestones: number[];
  newly_reached_milestone_usd: number | null;
  progress_to_next_pct: number | null;
  daily_pace_usd: number | null;
}

export async function fetchGoal(): Promise<GoalOut> {
  const { data } = await apiClient.get<GoalOut>("/api/goal");
  return data;
}

export async function acknowledgeMilestone(milestoneUsd: number): Promise<void> {
  await apiClient.post("/api/goal/acknowledge-milestone", null, { params: { milestone_usd: milestoneUsd } });
}

export interface BestSignalOut {
  symbol: string;
  market_type: MarketType;
  timeframe: string;
  signal: SignalValue;
  confidence: number;
  reasoning: string;
  created_at: string;
}

export interface CheckinOut {
  goal: GoalOut;
  total_value_usd: number | null;
  today_pnl_usd: number | null;
  today_pnl_pct: number | null;
  open_positions: BinancePosition[];
  best_watchlist_signal: BestSignalOut | null;
}

export async function fetchCheckin(): Promise<CheckinOut> {
  const { data } = await apiClient.get<CheckinOut>("/api/checkin");
  return data;
}
