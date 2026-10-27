import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, fetchTicker } from "../api/client";
import type { MarketType } from "../api/client";

export interface LiveTickerData {
  symbol: string;
  market_type: MarketType;
  price: number;
  price_change_percent: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
}

const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
// Some networks silently drop long-lived WS connections to Binance's futures stream host without
// ever erroring (the handshake succeeds, no data ever follows). Rather than leave the price blank
// in that case, poll the REST snapshot whenever the WS has gone quiet longer than this.
const REST_FALLBACK_INTERVAL_MS = 8000;

export function useLiveTicker(symbol: string, marketType: MarketType) {
  const [ticker, setTicker] = useState<LiveTickerData | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const lastMessageAtRef = useRef(0);

  useEffect(() => {
    if (!symbol) return;

    setTicker(null);
    lastMessageAtRef.current = 0;
    let cancelled = false;

    fetchTicker(symbol, marketType)
      .then((snap) => {
        if (!cancelled) setTicker(snap);
      })
      .catch(() => {
        // WS may still succeed even if this initial snapshot fails; polling below will keep retrying.
      });

    const url = `${WS_BASE_URL}/ws/ticker?symbol=${symbol}&market_type=${marketType}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        setTicker(JSON.parse(event.data));
        lastMessageAtRef.current = Date.now();
      } catch {
        // ignore malformed frames
      }
    };

    const pollId = window.setInterval(() => {
      if (Date.now() - lastMessageAtRef.current < REST_FALLBACK_INTERVAL_MS) return;
      fetchTicker(symbol, marketType)
        .then((snap) => {
          if (!cancelled) setTicker(snap);
        })
        .catch(() => {
          // transient REST error, next poll tick will retry
        });
    }, REST_FALLBACK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      ws.close();
      wsRef.current = null;
    };
  }, [symbol, marketType]);

  return { ticker, connected };
}
