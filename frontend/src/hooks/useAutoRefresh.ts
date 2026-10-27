import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoRefresh(callback: () => void | Promise<void>, intervalMs: number) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const run = useCallback(async () => {
    await callbackRef.current();
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    run();
    const interval = setInterval(run, intervalMs);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { lastUpdated, refreshNow: run };
}
