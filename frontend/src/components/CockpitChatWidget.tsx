import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, CircularProgress, IconButton, Link, Stack, TextField, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { fetchChatHistory, sendChatMessage } from "../api/client";
import type { ChatMessageOut, MarketType } from "../api/client";
import { getOrCreateSessionId } from "../lib/chatSession";
import { bonncoColors, monoStack } from "../theme/theme";

interface LocalMessage extends Omit<ChatMessageOut, "id"> {
  id: number | string;
}

export interface ProactiveNote {
  id: string;
  title: string;
  content: string;
}

// Same session as the full Ask Bonnco page (see lib/chatSession) — a question asked here and a
// question asked from the full chat page are one continuous conversation, not two separate ones.
const VISIBLE_MESSAGES = 6;

interface Props {
  symbol: string | null;
  marketType: MarketType;
  timeframe: string;
  // Which page the widget is currently floating over (e.g. "dashboard", "journal") — passed to the
  // backend so a reply can resolve a reference like "the target" against what's actually shown on
  // that page (the goal/milestone tracker, open positions) instead of only ever assuming a coin.
  page: string | null;
  // Daily check-in / milestone content the widget's badge already flagged as unread — shown here
  // as real message bubbles (not just a cleared badge count) so opening the assistant visibly
  // surfaces what triggered the notification, the same way a chat app shows the unread message
  // itself rather than just a number. Not persisted to server chat history — this is proactive,
  // template-built content, not part of the actual GPT conversation thread.
  proactiveNotes?: ProactiveNote[];
}

export default function CockpitChatWidget({ symbol, marketType, timeframe, page, proactiveNotes = [] }: Props) {
  const [sessionId] = useState(() => getOrCreateSessionId());
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChatHistory(sessionId).then(setMessages);
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content: text, symbol, created_at: new Date().toISOString() }]);

    try {
      const { reply } = await sendChatMessage(sessionId, text, symbol, marketType, timeframe, page);
      setMessages((prev) => [...prev, { id: `local-${Date.now()}-r`, role: "assistant", content: reply, symbol, created_at: new Date().toISOString() }]);
    } catch (e: any) {
      const detail = e?.response?.status === 429
        ? "Too many questions in a short window — give it a moment and try again."
        : e?.response?.data?.detail ?? "Something went wrong reaching the AI provider. Try again.";
      setMessages((prev) => [...prev, { id: `local-${Date.now()}-e`, role: "assistant", content: detail, symbol, created_at: new Date().toISOString() }]);
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

  const visible = messages.slice(-VISIBLE_MESSAGES);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0 }}>
      <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 0.75, flexShrink: 0 }}>
        <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary }}>
          ASK BONNCO
        </Typography>
        <Link component="button" variant="caption" onClick={() => navigate("/chat")} sx={{ color: bonncoColors.textSecondary }}>
          Full chat →
        </Link>
      </Stack>

      {(proactiveNotes.length > 0 || visible.length > 0) && (
        <Box ref={scrollRef} sx={{ flexGrow: 1, minHeight: 120, overflowY: "auto", mb: 1, pr: 0.5 }}>
          <Stack sx={{ gap: 1 }}>
            {proactiveNotes.map((note) => (
              <Box
                key={note.id}
                sx={{
                  alignSelf: "flex-start",
                  maxWidth: "94%",
                  backgroundColor: "rgba(59,130,246,0.1)",
                  border: `1px solid ${bonncoColors.accent}44`,
                  borderRadius: 1.5,
                  px: 1.25,
                  py: 0.85,
                }}
              >
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.5, mb: 0.35 }}>
                  <AutoAwesomeIcon sx={{ fontSize: 12, color: bonncoColors.accent }} />
                  <Typography variant="caption" sx={{ fontFamily: monoStack, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: bonncoColors.accent }}>
                    {note.title.toUpperCase()}
                  </Typography>
                </Stack>
                <Typography variant="caption" sx={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {note.content}
                </Typography>
              </Box>
            ))}
            {visible.map((m) => (
              <Box
                key={m.id}
                sx={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "92%",
                  backgroundColor: m.role === "user" ? "rgba(59,130,246,0.14)" : bonncoColors.bgElevated,
                  borderRadius: 1.5,
                  px: 1.25,
                  py: 0.75,
                }}
              >
                <Typography variant="caption" sx={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {m.content}
                </Typography>
              </Box>
            ))}
            {sending && (
              <Box sx={{ alignSelf: "flex-start", px: 1.25, py: 0.75 }}>
                <CircularProgress size={12} />
              </Box>
            )}
          </Stack>
        </Box>
      )}

      <Stack direction="row" sx={{ gap: 0.5, alignItems: "center", flexShrink: 0 }}>
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={3}
          placeholder={symbol ? `Ask about ${symbol}…` : "Ask Bonnco anything…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ "& .MuiInputBase-root": { fontSize: 13 } }}
        />
        <IconButton size="small" onClick={() => handleSend()} disabled={sending || !input.trim()} sx={{ color: bonncoColors.accent }}>
          <SendIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}
