import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../api/client";
import type { MarketType } from "../api/client";

export interface LiveCandleTick {
  symbol: string;
  market_type: MarketType;
  timeframe: string;
  open_time: number;
  close_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_closed: boolean;
}

const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export function useLiveCandle(symbol: string, marketType: MarketType, timeframe: string) {
  const [tick, setTick] = useState<LiveCandleTick | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!symbol) return;

    setTick(null);
    const url = `${WS_BASE_URL}/ws/candles?symbol=${symbol}&market_type=${marketType}&timeframe=${timeframe}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        setTick(JSON.parse(event.data));
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [symbol, marketType, timeframe]);

  return { tick, connected };
}
