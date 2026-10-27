import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Box, Card, Chip, CircularProgress, Divider, IconButton, Popover, Stack, TextField, Tooltip, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import AddCircleOutlineOutlinedIcon from "@mui/icons-material/AddCircleOutlineOutlined";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { fetchCandles, fetchChatHistory, generateSignal, sendChatMessage } from "../api/client";
import type { ChatMessageOut, MarketType, SignalOut } from "../api/client";
import { bonncoColors } from "../theme/theme";
import CoinIcon from "../components/CoinIcon";
import SignalBadge, { getSignalColor } from "../components/SignalBadge";
import ConfidenceBar from "../components/ConfidenceBar";
import Sparkline from "../components/Sparkline";
import SymbolPicker from "../components/SymbolPicker";
import TimeframeHint from "../components/TimeframeHint";
import { summarizeSignal } from "../lib/signalSummary";
import { useLiveTicker } from "../hooks/useLiveTicker";
import { getOrCreateSessionId, newSessionId } from "../lib/chatSession";

const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];
const COLUMN_WIDTH = 720;

const STARTER_QUESTIONS = [
  "What's driving the price right now?",
  "Explain the current signal in plain English",
  "What would change your mind on this call?",
  "What's the risk if I enter here?",
];

interface LocalMessage extends Omit<ChatMessageOut, "id"> {
  id: number | string;
  provider?: string;
}

interface LocationState {
  prefillQuestion?: string;
  symbol?: string;
  marketType?: MarketType;
  timeframe?: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function AssistantAvatar() {
  return (
    <Box
      sx={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${bonncoColors.accent}, #8b5cf6)`,
      }}
    >
      <AutoAwesomeIcon sx={{ fontSize: 14, color: "#fff" }} />
    </Box>
  );
}

function TypingDots() {
  return (
    <Stack direction="row" sx={{ gap: 0.5, alignItems: "center", height: 20, px: 0.5 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          className="bonnco-typing-dot"
          sx={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            backgroundColor: bonncoColors.textSecondary,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </Stack>
  );
}

// Rich context editor that opens right above the composer — the same place ChatGPT/Claude let you
// attach files or pick tools, not a permanent side rail. Picking a coin here is what grounds the
// next reply in that coin's real live price, signal, and indicators.
function ContextEditor({
  symbol,
  onSymbolChange,
  marketType,
  onMarketTypeChange,
  timeframe,
  onTimeframeChange,
}: {
  symbol: string | null;
  onSymbolChange: (s: string | null) => void;
  marketType: MarketType;
  onMarketTypeChange: (m: MarketType) => void;
  timeframe: string;
  onTimeframeChange: (t: string) => void;
}) {
  const { ticker } = useLiveTicker(symbol ?? "", marketType);
  const [signal, setSignal] = useState<SignalOut | null>(null);
  const [candles, setCandles] = useState<number[]>([]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setSignal(null);
    setCandles([]);
    generateSignal(symbol, marketType, timeframe)
      .then((s) => {
        if (!cancelled) setSignal(s);
      })
      .catch(() => {});
    fetchCandles(symbol, marketType, timeframe, 30)
      .then((rows) => {
        if (!cancelled) setCandles(rows.map((r) => r.close));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol, marketType, timeframe]);

  const isUp = ticker ? ticker.price_change_percent >= 0 : true;
  const signalColor = signal ? getSignalColor(signal.signal) : bonncoColors.border;

  return (
    <Box sx={{ p: 2, width: 360, maxWidth: "90vw" }}>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
        COIN CONTEXT
      </Typography>

      <Stack sx={{ gap: 1, alignItems: "stretch" }}>
        <SymbolPicker value={symbol} onChange={onSymbolChange} marketType={marketType} placeholder="Search a coin…" />
        {symbol && (
          <Stack direction="row" sx={{ gap: 0.5 }}>
            {(["spot", "futures"] as MarketType[]).map((mt) => (
              <Chip
                key={mt}
                label={mt === "spot" ? "Spot" : "Futures"}
                size="small"
                onClick={() => onMarketTypeChange(mt)}
                sx={{
                  cursor: "pointer",
                  backgroundColor: marketType === mt ? bonncoColors.accent : bonncoColors.bgElevated,
                  color: marketType === mt ? "#fff" : bonncoColors.textSecondary,
                  fontWeight: 600,
                }}
              />
            ))}
          </Stack>
        )}
        {symbol && (
          <Stack direction="row" sx={{ gap: 0.5, alignItems: "center" }}>
            {TIMEFRAMES.map((tf) => (
              <Chip
                key={tf}
                label={tf}
                size="small"
                onClick={() => onTimeframeChange(tf)}
                sx={{
                  cursor: "pointer",
                  backgroundColor: tf === timeframe ? bonncoColors.accent : bonncoColors.bgElevated,
                  color: tf === timeframe ? "#fff" : bonncoColors.textSecondary,
                  fontWeight: 600,
                }}
              />
            ))}
            <TimeframeHint />
          </Stack>
        )}
      </Stack>

      {symbol && (
        <Stack direction="row" sx={{ alignItems: "center", gap: 2, mt: 1.5, pt: 1.5, borderTop: `1px solid ${bonncoColors.border}` }}>
          {ticker ? (
            <Stack direction="row" sx={{ alignItems: "baseline", gap: 0.75 }}>
              <Typography fontWeight={700}>${ticker.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</Typography>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ color: isUp ? bonncoColors.bullish : bonncoColors.bearish }}
              >
                {isUp ? "+" : ""}
                {ticker.price_change_percent.toFixed(2)}%
              </Typography>
            </Stack>
          ) : (
            <CircularProgress size={14} />
          )}

          {signal && (
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
              <SignalBadge signal={signal.signal} size="small" />
              <Box sx={{ width: 60 }}>
                <ConfidenceBar confidence={signal.confidence} color={signalColor} />
              </Box>
            </Stack>
          )}

          {candles.length > 1 && (
            <Box sx={{ ml: "auto" }}>
              <Sparkline data={candles} width={100} height={30} />
            </Box>
          )}
        </Stack>
      )}

      {symbol && signal && (
        <Stack direction="row" sx={{ gap: 1.5, mt: 1, flexWrap: "wrap" }}>
          {summarizeSignal(signal.indicator_snapshot as any).map((row) => (
            <Typography key={row.label} variant="caption" color="text.secondary">
              <Box component="span" sx={{ fontWeight: 600 }}>
                {row.label}
              </Box>{" "}
              {row.value}
            </Typography>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default function ChatPage() {
  const location = useLocation();
  const navState = (location.state as LocationState) ?? {};

  const [symbol, setSymbol] = useState<string | null>(navState.symbol ?? null);
  const [sessionId, setSessionId] = useState(() => getOrCreateSessionId());
  const [marketType, setMarketType] = useState<MarketType>(navState.marketType ?? "spot");
  const [timeframe, setTimeframe] = useState(navState.timeframe ?? "1h");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState(navState.prefillQuestion ?? "");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [contextAnchor, setContextAnchor] = useState<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingHistory(true);
    fetchChatHistory(sessionId)
      .then(setMessages)
      .finally(() => setLoadingHistory(false));
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const hasHistory = useMemo(() => messages.length > 0, [messages]);

  function handleNewChat() {
    setSessionId(newSessionId());
    setMessages([]);
    setInput("");
  }

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text, symbol, created_at: new Date().toISOString() },
    ]);

    try {
      const { reply, provider } = await sendChatMessage(sessionId, text, symbol, marketType, timeframe);
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-r`,
          role: "assistant",
          content: reply,
          symbol,
          created_at: new Date().toISOString(),
          provider,
        },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-e`,
          role: "assistant",
          content: e?.response?.data?.detail ?? "Something went wrong reaching the AI provider. Try again.",
          symbol,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", mb: 2, gap: 1, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
            Ask Bonnco
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Grounded in Bonnco's live signals, indicators, and news sentiment. Decision support only, not financial
            advice.
          </Typography>
        </Box>
        <Tooltip title="Clear the conversation and start fresh">
          <Chip
            icon={<AddCommentOutlinedIcon sx={{ fontSize: 16, color: "inherit !important" }} />}
            label="New chat"
            onClick={handleNewChat}
            sx={{
              cursor: "pointer",
              backgroundColor: bonncoColors.bgElevated,
              color: bonncoColors.textPrimary,
              fontWeight: 600,
              "&:hover": { backgroundColor: `${bonncoColors.accent}22` },
            }}
          />
        </Tooltip>
      </Stack>

      <Card sx={{ flexGrow: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", p: 0 }}>
        <Box ref={scrollRef} sx={{ flexGrow: 1, overflowY: "auto", p: 3 }}>
          <Box sx={{ maxWidth: COLUMN_WIDTH, mx: "auto", display: "flex", flexDirection: "column", gap: 2.5 }}>
            {loadingHistory && (
              <Stack sx={{ alignItems: "center", py: 4 }}>
                <CircularProgress size={20} />
              </Stack>
            )}

            {!loadingHistory && !hasHistory && (
              <Stack sx={{ alignItems: "center", justifyContent: "center", gap: 2, py: 6 }}>
                <AutoAwesomeIcon sx={{ color: bonncoColors.accent, fontSize: 28 }} />
                <Typography color="text.secondary" sx={{ textAlign: "center", maxWidth: 380 }}>
                  {symbol
                    ? `Ask about ${symbol}'s current signal, why it moved, or what to watch next.`
                    : "Attach a coin below for grounded answers, or ask a general question."}
                </Typography>
                {symbol && (
                  <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                    {STARTER_QUESTIONS.map((q) => (
                      <Chip
                        key={q}
                        label={q}
                        onClick={() => handleSend(q)}
                        sx={{
                          cursor: "pointer",
                          backgroundColor: bonncoColors.bgElevated,
                          color: bonncoColors.textPrimary,
                          "&:hover": { backgroundColor: `${bonncoColors.accent}22` },
                        }}
                      />
                    ))}
                  </Stack>
                )}
              </Stack>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <Stack key={m.id} className="bonnco-msg-in" sx={{ alignSelf: "flex-end", alignItems: "flex-end", maxWidth: "80%", gap: 0.4 }}>
                  <Box
                    sx={{
                      backgroundColor: bonncoColors.accent,
                      color: "#fff",
                      borderRadius: "16px 16px 4px 16px",
                      px: 2,
                      py: 1.1,
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {m.content}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
                    {formatTime(m.created_at)}
                  </Typography>
                </Stack>
              ) : (
                <Stack key={m.id} direction="row" className="bonnco-msg-in" sx={{ gap: 1.5, alignItems: "flex-start", maxWidth: "92%" }}>
                  <AssistantAvatar />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                      {m.content}
                    </Typography>
                    <Stack direction="row" sx={{ gap: 0.75, alignItems: "center", mt: 0.6 }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(m.created_at)}
                      </Typography>
                      {m.provider && m.provider !== "openai" && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                          via Gemini fallback
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              ),
            )}

            {sending && (
              <Stack direction="row" className="bonnco-msg-in" sx={{ gap: 1.5, alignItems: "center" }}>
                <AssistantAvatar />
                <TypingDots />
              </Stack>
            )}
          </Box>
        </Box>

        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${bonncoColors.border}` }}>
          <Box sx={{ maxWidth: COLUMN_WIDTH, mx: "auto" }}>
            <Stack
              direction="row"
              sx={{
                alignItems: "flex-end",
                border: `1px solid ${bonncoColors.border}`,
                borderRadius: 3,
                backgroundColor: bonncoColors.bgElevated,
                pl: 0.5,
                pr: 0.75,
                py: 0.5,
                gap: 0.5,
              }}
            >
              <Stack
                direction="row"
                onClick={(e) => setContextAnchor(e.currentTarget)}
                sx={{
                  alignItems: "center",
                  gap: 0.4,
                  flexShrink: 0,
                  alignSelf: "center",
                  cursor: "pointer",
                  borderRadius: 2,
                  pl: 1,
                  pr: 0.5,
                  py: 0.9,
                  color: symbol ? bonncoColors.textPrimary : bonncoColors.textSecondary,
                  "&:hover": { backgroundColor: `${bonncoColors.accent}18` },
                }}
              >
                {symbol ? <CoinIcon symbol={symbol} size={18} /> : <AddCircleOutlineOutlinedIcon sx={{ fontSize: 17 }} />}
                <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 90 }}>
                  {symbol ?? "Coin"}
                </Typography>
                <ArrowDropDownIcon sx={{ fontSize: 20, ml: -0.5 }} />
              </Stack>

              <Divider orientation="vertical" flexItem sx={{ my: 0.75 }} />

              <TextField
                fullWidth
                variant="standard"
                placeholder={symbol ? `Ask about ${symbol}…` : "Ask Bonnco anything…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                multiline
                maxRows={4}
                slotProps={{ input: { disableUnderline: true } }}
                sx={{ px: 1, py: 0.9 }}
              />

              <IconButton
                onClick={() => handleSend()}
                disabled={sending || !input.trim()}
                sx={{
                  flexShrink: 0,
                  backgroundColor: bonncoColors.accent,
                  color: "#fff",
                  "&:hover": { backgroundColor: bonncoColors.accent },
                  "&.Mui-disabled": { backgroundColor: bonncoColors.border, color: bonncoColors.textSecondary },
                }}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </Stack>

            {symbol && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75, ml: 1 }}>
                Replying with {symbol} context.{" "}
                <Box
                  component="span"
                  onClick={() => setSymbol(null)}
                  sx={{ cursor: "pointer", textDecoration: "underline", "&:hover": { color: bonncoColors.accent } }}
                >
                  Remove
                </Box>
              </Typography>
            )}

            <Popover
              open={Boolean(contextAnchor)}
              anchorEl={contextAnchor}
              onClose={() => setContextAnchor(null)}
              anchorOrigin={{ vertical: "top", horizontal: "left" }}
              transformOrigin={{ vertical: "bottom", horizontal: "left" }}
              slotProps={{ paper: { sx: { border: `1px solid ${bonncoColors.border}` } } }}
            >
              <ContextEditor
                symbol={symbol}
                onSymbolChange={(s) => {
                  setSymbol(s);
                  if (s) setContextAnchor(null);
                }}
                marketType={marketType}
                onMarketTypeChange={setMarketType}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
              />
            </Popover>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
