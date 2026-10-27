import { useCallback, useEffect, useState } from "react";
import { Box, Button, Chip, IconButton, Link, Stack, TextField, Typography } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { connectBinance, disconnectBinance, fetchBinanceStatus, syncBinanceTradeHistory } from "../api/client";
import type { BinanceStatusOut } from "../api/client";
import { bonncoColors, monoStack } from "../theme/theme";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{ fontFamily: monoStack, letterSpacing: "0.08em", color: bonncoColors.textSecondary, display: "block", mb: 1.25 }}
    >
      {children}
    </Typography>
  );
}

// enableReading is the only flag that should be on. Verified live: enableFutures=false still
// allows fetching futures account/positions/orders — it only gates futures trading, not viewing —
// so a genuinely read-only key never needs it checked either.
const PERMISSION_LABELS: Record<string, string> = {
  enableReading: "Reading",
  enableFutures: "Futures trading",
  enableSpotAndMarginTrading: "Spot & Margin Trading",
  enableMargin: "Margin",
  enablePortfolioMarginTrading: "Portfolio Margin Trading",
  enableWithdrawals: "Withdrawals",
  enableInternalTransfer: "Internal Transfer",
};
const EXPECTED_ON_FLAGS = new Set(["enableReading"]);

export default function BinanceConnectionCard() {
  const [status, setStatus] = useState<BinanceStatusOut | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchBinanceStatus().then(setStatus);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConnect() {
    setError("");
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError("Both the API key and secret are required");
      return;
    }
    setConnecting(true);
    try {
      const result = await connectBinance(apiKey.trim(), apiSecret.trim());
      setStatus(result);
      setApiKey("");
      setApiSecret("");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await disconnectBinance();
    setApiKey("");
    setApiSecret("");
    load();
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncBinanceTradeHistory();
      setSyncResult(
        result.total_imported > 0
          ? `Imported ${result.total_imported} real closed trade${result.total_imported === 1 ? "" : "s"} from your Binance history.`
          : "No new closed trades found — your journal is already in sync.",
      );
    } catch (e: any) {
      setSyncResult(e?.response?.data?.detail ?? "Sync failed — try again shortly.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Box>
      <SectionLabel>BINANCE ACCOUNT (READ-ONLY)</SectionLabel>

      {status?.connected ? (
        <>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
            {status.safe ? (
              <Chip
                icon={<CheckCircleOutlineIcon />}
                label="Connected — read-only"
                size="small"
                sx={{ backgroundColor: "rgba(34,197,94,0.14)", color: bonncoColors.bullish }}
              />
            ) : (
              <Chip
                icon={<WarningAmberOutlinedIcon />}
                label="Connected — permissions need attention"
                size="small"
                sx={{ backgroundColor: "rgba(239,68,68,0.14)", color: bonncoColors.bearish }}
              />
            )}
            <Typography variant="body2" sx={{ fontFamily: monoStack }}>
              {status.masked_key}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {status.source === "env" ? "set via .env" : "saved in Bonnco"}
            </Typography>
          </Stack>

          {status.warnings.length > 0 && (
            <Box sx={{ backgroundColor: "rgba(239,68,68,0.08)", border: `1px solid ${bonncoColors.bearish}55`, borderRadius: 1, p: 1.5, mb: 1.5 }}>
              {status.warnings.map((w) => (
                <Typography key={w} variant="body2" sx={{ color: bonncoColors.bearish }}>
                  {w}
                </Typography>
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Bonnco itself will never place a trade or move funds regardless — but a key this broadly permissioned is a
                real risk if it ever leaked, so it's worth fixing at the source.
              </Typography>
            </Box>
          )}

          {status.permissions && (
            <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", mb: 2 }}>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                const on = Boolean((status.permissions as Record<string, boolean> | null)?.[key]);
                const expected = EXPECTED_ON_FLAGS.has(key);
                const color = on === expected ? bonncoColors.bullish : bonncoColors.bearish;
                return (
                  <Chip
                    key={key}
                    label={`${label}: ${on ? "on" : "off"}`}
                    size="small"
                    variant="outlined"
                    sx={{ color: on ? color : bonncoColors.textSecondary, borderColor: on ? color : bonncoColors.border }}
                  />
                );
              })}
            </Stack>
          )}

          {status.safe && (
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                <Button size="small" variant="outlined" onClick={handleSync} disabled={syncing}>
                  {syncing ? "Syncing…" : "Sync trade history"}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Pulls real closed spot trades from Binance into your journal (labeled "imported"), skipping any
                  already synced. Safe to run anytime.
                </Typography>
              </Stack>
              {syncResult && (
                <Typography variant="body2" sx={{ mt: 0.75, color: bonncoColors.accent }}>
                  {syncResult}
                </Typography>
              )}
            </Box>
          )}

          {status.source === "database" ? (
            <Button size="small" color="error" onClick={handleDisconnect}>
              Disconnect
            </Button>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Set via backend/.env — remove BINANCE_API_KEY and BINANCE_API_SECRET there and restart the backend to
              disconnect.
            </Typography>
          )}
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Connect a read-only Binance API key to pull your real balance, positions, and trade history into Bonnco —
            position sizing, the Active Position Coach, and Performance stats all get more accurate with it connected.
            Nothing is ever traded or withdrawn through this connection.
          </Typography>

          <Box sx={{ backgroundColor: bonncoColors.bgElevated, borderRadius: 1, p: 2, mb: 2 }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
              How to create a read-only key
            </Typography>
            <Stack component="ol" sx={{ pl: 2.5, m: 0, gap: 0.5 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                Go to Binance → Profile → API Management (
                <Link href="https://www.binance.com/en/my/settings/api-management" target="_blank" rel="noreferrer">
                  binance.com/my/settings/api-management
                </Link>
                ) and create a new key.
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Check <b>only</b> "Enable Reading." Leave everything else unchecked — including "Enable Futures": that
                checkbox only grants futures trading, not futures viewing, so it isn't needed even though Bonnco reads
                your futures positions too. "Enable Reading" alone covers both spot and futures data.
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                If you have a static IP, restrict the key to it for extra safety (optional).
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Copy the API key and secret and paste them below. Bonnco checks the key's actual permissions with
                Binance before saving it, and warns you if anything beyond reading is enabled.
              </Typography>
            </Stack>
          </Box>

          <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
            <TextField
              size="small"
              label="API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              sx={{ minWidth: 260, flexGrow: 1 }}
            />
            <TextField
              size="small"
              label="API secret"
              type={showSecret ? "text" : "password"}
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              sx={{ minWidth: 260, flexGrow: 1 }}
              slotProps={{
                input: {
                  endAdornment: (
                    <IconButton size="small" onClick={() => setShowSecret((s) => !s)}>
                      {showSecret ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                    </IconButton>
                  ),
                },
              }}
            />
            <Button variant="contained" onClick={handleConnect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect"}
            </Button>
          </Stack>
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
