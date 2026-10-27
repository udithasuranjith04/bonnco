import { useCallback, useEffect, useState } from "react";
import { Box, Button, Card, Chip, Stack, Typography } from "@mui/material";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import { fetchBinanceReconcile, fetchBinanceStatus, importBinancePosition } from "../api/client";
import type { BinancePosition, ReconcileOut } from "../api/client";
import CoinIcon from "./CoinIcon";
import { bonncoColors } from "../theme/theme";

const POLL_MS = 45_000;

// Real open Binance futures positions with no matching Trade Journal entry — offered for
// one-click import (symbol, entry price, size, leverage all pulled directly from the exchange).
// Only renders when Binance is actually connected and read-only-safe; silently absent otherwise.
export default function BinanceReconciliationPanel({ onImported }: { onImported: () => void }) {
  const [connected, setConnected] = useState(false);
  const [reconcile, setReconcile] = useState<ReconcileOut | null>(null);
  const [importingSymbol, setImportingSymbol] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const status = await fetchBinanceStatus();
      setConnected(status.connected && status.safe);
      if (status.connected && status.safe) {
        setReconcile(await fetchBinanceReconcile());
      }
    } catch {
      // Silent — this is a best-effort enrichment panel, not core journal functionality.
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function handleImport(position: BinancePosition) {
    setImportingSymbol(position.symbol);
    try {
      await importBinancePosition(position.symbol);
      await load();
      onImported();
    } finally {
      setImportingSymbol(null);
    }
  }

  if (!connected || !reconcile || reconcile.unmatched_binance_positions.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography fontWeight={700} sx={{ mb: 1.5 }}>
        Real Binance Positions Not Yet Logged
      </Typography>
      <Stack sx={{ gap: 1.5 }}>
        {reconcile.unmatched_binance_positions.map((position) => (
          <Card key={position.symbol} sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <CoinIcon symbol={position.symbol} size={22} />
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                <Typography fontWeight={700}>{position.symbol}</Typography>
                <Chip
                  label={position.side}
                  size="small"
                  sx={{
                    backgroundColor: position.side === "long" ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
                    color: position.side === "long" ? bonncoColors.bullish : bonncoColors.bearish,
                  }}
                />
                <Chip label={`${position.leverage}x`} size="small" variant="outlined" />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Real entry ${position.entry_price.toLocaleString()} · ${position.notional_usd.toFixed(2)} notional · found on
                your connected Binance account, not in your journal
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CloudDownloadOutlinedIcon fontSize="small" />}
              onClick={() => handleImport(position)}
              disabled={importingSymbol === position.symbol}
            >
              {importingSymbol === position.symbol ? "Importing…" : "Import"}
            </Button>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
