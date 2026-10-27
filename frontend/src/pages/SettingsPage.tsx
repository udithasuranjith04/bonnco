import { useCallback, useEffect, useState } from "react";
import { Box, Button, Card, IconButton, InputAdornment, MenuItem, Select, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { apiClient, fetchSettings, fetchWatchlist, removeWatchlistItem, updateSettings, updateWatchlistItemMode } from "../api/client";
import type { AppSettings, MarketType, RiskProfile, WatchlistItem } from "../api/client";
import BinanceConnectionCard from "../components/BinanceConnectionCard";
import CoinIcon from "../components/CoinIcon";
import SymbolPicker from "../components/SymbolPicker";
import { bonncoColors, monoStack, riskProfileColor } from "../theme/theme";
import { useRiskProfile } from "../contexts/RiskProfileContext";
import { notificationPermission, requestNotificationPermission } from "../lib/browserNotifications";

const RISK_GRID = "20px 116px 100px 100px 100px 96px";

// Mirrors the exact constants signal_engine.py scores against (HOLD_BAND, STRONG_THRESHOLD,
// LEVERAGE_RANGES, STOP_LOSS_PCT) — shown as real numbers rather than prose so the settings page
// is a transparent readout of what the engine actually does, not marketing copy.
const RISK_PROFILES: {
  value: RiskProfile;
  label: string;
  holdBand: number;
  strongAt: number;
  leverage: string;
  stopLoss: number;
  description: string;
}[] = [
  {
    value: "conservative",
    label: "Conservative",
    holdBand: 0.35,
    strongAt: 0.7,
    leverage: "1x–3x",
    stopLoss: 0.015,
    description: "Needs strong agreement across indicators and sentiment before calling a BUY or SELL.",
  },
  {
    value: "moderate",
    label: "Moderate",
    holdBand: 0.2,
    strongAt: 0.6,
    leverage: "2x–5x",
    stopLoss: 0.025,
    description: "Balanced default: calls a direction on moderate conviction, standard stop-loss distance.",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    holdBand: 0.1,
    strongAt: 0.5,
    leverage: "3x–10x",
    stopLoss: 0.04,
    description: "Calls a BUY or SELL on weaker signals, with wider leverage and stop-loss room.",
  },
];

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

export default function SettingsPage() {
  const { riskProfile, setRiskProfile } = useRiskProfile();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState<string | null>(null);
  const [newMarketType, setNewMarketType] = useState<MarketType>("spot");
  const [error, setError] = useState("");

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [accountSizeInput, setAccountSizeInput] = useState("");
  const [riskPctInput, setRiskPctInput] = useState("");
  const [sizingSaved, setSizingSaved] = useState(false);
  const [sizingError, setSizingError] = useState("");

  const [browserPermission, setBrowserPermission] = useState(notificationPermission());
  const [thresholdInput, setThresholdInput] = useState("");
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifError, setNotifError] = useState("");

  const load = useCallback(() => {
    fetchWatchlist().then(setWatchlist);
    fetchSettings().then((s) => {
      setSettings(s);
      setAccountSizeInput(String(s.account_size_usd));
      setRiskPctInput(String(s.default_risk_pct));
      setThresholdInput(String(s.entry_alert_confidence_threshold));
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveSizing() {
    setSizingError("");
    setSizingSaved(false);
    const accountSizeUsd = parseFloat(accountSizeInput);
    const defaultRiskPct = parseFloat(riskPctInput);
    if (!Number.isFinite(accountSizeUsd) || accountSizeUsd <= 0) {
      setSizingError("Account size must be a positive number");
      return;
    }
    if (!Number.isFinite(defaultRiskPct) || defaultRiskPct <= 0 || defaultRiskPct > 100) {
      setSizingError("Risk % must be between 0 and 100");
      return;
    }
    try {
      const updated = await updateSettings({ account_size_usd: accountSizeUsd, default_risk_pct: defaultRiskPct });
      setSettings(updated);
      setSizingSaved(true);
    } catch (e: any) {
      setSizingError(e?.response?.data?.detail ?? "Failed to save");
    }
  }

  async function handleToggleBrowserNotifications(checked: boolean) {
    setNotifError("");
    setNotifSaved(false);
    if (checked) {
      // Must be requested from this user gesture — browsers largely ignore/auto-deny requests
      // fired without one, so this can't happen proactively on page load.
      const result = await requestNotificationPermission();
      setBrowserPermission(result);
      if (result !== "granted") {
        setNotifError(
          result === "unsupported"
            ? "Your browser doesn't support notifications."
            : "Browser notification permission was denied — check your browser's site settings to allow it.",
        );
        return;
      }
    }
    try {
      const updated = await updateSettings({ notifications_enabled: checked });
      setSettings(updated);
      setNotifSaved(true);
    } catch (e: any) {
      setNotifError(e?.response?.data?.detail ?? "Failed to save");
    }
  }

  async function handleTogglePositionAlerts(checked: boolean) {
    setNotifError("");
    setNotifSaved(false);
    try {
      const updated = await updateSettings({ position_alerts_enabled: checked });
      setSettings(updated);
      setNotifSaved(true);
    } catch (e: any) {
      setNotifError(e?.response?.data?.detail ?? "Failed to save");
    }
  }

  async function handleToggleSound(checked: boolean) {
    setNotifError("");
    setNotifSaved(false);
    try {
      const updated = await updateSettings({ sound_enabled: checked });
      setSettings(updated);
      setNotifSaved(true);
    } catch (e: any) {
      setNotifError(e?.response?.data?.detail ?? "Failed to save");
    }
  }

  async function handleSaveThreshold() {
    setNotifError("");
    setNotifSaved(false);
    const threshold = parseFloat(thresholdInput);
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
      setNotifError("Confidence threshold must be between 0 and 100");
      return;
    }
    try {
      const updated = await updateSettings({ entry_alert_confidence_threshold: threshold });
      setSettings(updated);
      setNotifSaved(true);
    } catch (e: any) {
      setNotifError(e?.response?.data?.detail ?? "Failed to save");
    }
  }

  async function handleModeToggle(item: WatchlistItem, mode: MarketType | null) {
    if (!mode || mode === item.market_type) return;
    try {
      await updateWatchlistItemMode(item.id, mode);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to change mode");
    }
  }

  async function handleRemove(id: number) {
    await removeWatchlistItem(id);
    load();
  }

  async function handleAdd() {
    if (!newSymbol) return;
    setError("");
    try {
      await apiClient.post("/api/watchlist", { symbol: newSymbol, market_type: newMarketType });
      setNewSymbol(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to add symbol");
    }
  }

  const active = RISK_PROFILES.find((p) => p.value === riskProfile) ?? RISK_PROFILES[1];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Risk preference and per-coin watchlist configuration.
      </Typography>

      <Card sx={{ p: 0, mb: 3, overflow: "hidden", borderRadius: 1.5 }}>
        <Box sx={{ p: 2.5, pb: 1.5 }}>
          <SectionLabel>RISK PROFILE</SectionLabel>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: RISK_GRID,
            gap: 1.5,
            px: 2.5,
            py: 0.85,
            borderTop: `1px solid ${bonncoColors.border}`,
            borderBottom: `1px solid ${bonncoColors.border}`,
            backgroundColor: bonncoColors.bgElevated,
          }}
        >
          <Box />
          <SectionLabel>PROFILE</SectionLabel>
          <SectionLabel>HOLD BAND</SectionLabel>
          <SectionLabel>STRONG AT</SectionLabel>
          <SectionLabel>LEVERAGE</SectionLabel>
          <SectionLabel>STOP-LOSS</SectionLabel>
        </Box>

        {RISK_PROFILES.map((p) => {
          const isActive = p.value === riskProfile;
          const color = riskProfileColor[p.value];
          return (
            <Box
              key={p.value}
              onClick={() => setRiskProfile(p.value)}
              sx={{
                display: "grid",
                gridTemplateColumns: RISK_GRID,
                gap: 1.5,
                alignItems: "center",
                px: 2.5,
                py: 1.5,
                cursor: "pointer",
                borderBottom: `1px solid ${bonncoColors.border}`,
                backgroundColor: isActive ? `color-mix(in srgb, ${color} 6%, transparent)` : "transparent",
                "&:hover": { backgroundColor: isActive ? `color-mix(in srgb, ${color} 6%, transparent)` : bonncoColors.bgElevated },
                "&:last-of-type": { borderBottom: "none" },
              }}
            >
              <Box
                sx={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  backgroundColor: isActive ? color : "transparent",
                  border: `1.5px solid ${isActive ? color : bonncoColors.border}`,
                }}
              />
              <Typography fontWeight={700} sx={{ color: isActive ? color : bonncoColors.textPrimary }}>
                {p.label}
              </Typography>
              <Typography sx={{ fontFamily: monoStack, fontSize: 13 }}>{"±"}{Math.round(p.holdBand * 100)}%</Typography>
              <Typography sx={{ fontFamily: monoStack, fontSize: 13 }}>{Math.round(p.strongAt * 100)}%</Typography>
              <Typography sx={{ fontFamily: monoStack, fontSize: 13 }}>{p.leverage}</Typography>
              <Typography sx={{ fontFamily: monoStack, fontSize: 13 }}>{(p.stopLoss * 100).toFixed(1)}%</Typography>
            </Box>
          );
        })}

        <Box sx={{ px: 2.5, py: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            {active.description}
          </Typography>
        </Box>
      </Card>

      <Card sx={{ p: 2.5, mb: 3, borderRadius: 1.5 }}>
        <BinanceConnectionCard />
      </Card>

      <Card sx={{ p: 2.5, mb: 3, borderRadius: 1.5 }}>
        <SectionLabel>POSITION SIZING</SectionLabel>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Your account size and default risk per trade — used to auto-suggest a consistent position size on the
          Trade Journal's "Log a trade" form, based on each trade's entry and stop-loss distance.
        </Typography>
        <Stack direction="row" sx={{ gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
          <TextField
            size="small"
            label="Account size"
            type="number"
            value={accountSizeInput}
            onChange={(e) => {
              setAccountSizeInput(e.target.value);
              setSizingSaved(false);
            }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
            sx={{ width: 160 }}
          />
          <TextField
            size="small"
            label="Risk per trade"
            type="number"
            value={riskPctInput}
            onChange={(e) => {
              setRiskPctInput(e.target.value);
              setSizingSaved(false);
            }}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
            sx={{ width: 150 }}
          />
          <Button variant="contained" onClick={handleSaveSizing}>
            Save
          </Button>
          {sizingSaved && (
            <Typography variant="body2" sx={{ color: bonncoColors.bullish, alignSelf: "center" }}>
              Saved
            </Typography>
          )}
        </Stack>
        {sizingError && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {sizingError}
          </Typography>
        )}
        {settings && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            Currently: ${settings.account_size_usd.toLocaleString()} account, {settings.default_risk_pct}% risk per
            trade — risking ${((settings.account_size_usd * settings.default_risk_pct) / 100).toFixed(2)} per trade
            at that setting.
          </Typography>
        )}
      </Card>

      <Card sx={{ p: 2.5, mb: 3, borderRadius: 1.5 }}>
        <SectionLabel>GOAL</SectionLabel>
        <Typography variant="body2" color="text.secondary">
          Fully automatic — nothing to set here. Bonnco tracks your real, synced balance and generates the next
          few milestones above it on its own ($200, then $500, then $1,000...), extending upward indefinitely as
          your balance grows. See live progress and your next milestone in the nav bar and the sidebar on every
          page, or the full view on the Dashboard.
        </Typography>
      </Card>

      <Card sx={{ p: 2.5, mb: 3, borderRadius: 1.5 }}>
        <SectionLabel>NOTIFICATIONS</SectionLabel>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bonnco can alert you when a watchlist coin crosses into a strong signal, and when an open
          position needs attention (approaching your stop-loss, the original thesis flipping, or a
          large favorable move worth considering). It only ever suggests — you decide, and nothing
          is ever placed automatically.
        </Typography>

        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", py: 1 }}>
          <Box>
            <Typography fontWeight={600}>Browser notifications</Typography>
            <Typography variant="caption" color="text.secondary">
              {browserPermission === "granted" && "Enabled — you'll see notifications even when this tab isn't focused."}
              {browserPermission === "denied" && "Blocked by your browser — allow notifications for this site to use it."}
              {browserPermission === "default" && "Not yet granted — turning this on will ask your browser for permission."}
              {browserPermission === "unsupported" && "Not supported in this browser."}
            </Typography>
          </Box>
          <Switch
            checked={Boolean(settings?.notifications_enabled) && browserPermission === "granted"}
            disabled={browserPermission === "unsupported"}
            onChange={(e) => handleToggleBrowserNotifications(e.target.checked)}
          />
        </Stack>

        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", py: 1, borderTop: `1px solid ${bonncoColors.border}` }}>
          <Box>
            <Typography fontWeight={600}>Hold/close position alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              Notify when an open position's stop-loss, thesis, or momentum meaningfully changes.
            </Typography>
          </Box>
          <Switch checked={Boolean(settings?.position_alerts_enabled)} onChange={(e) => handleTogglePositionAlerts(e.target.checked)} />
        </Stack>

        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", py: 1, borderTop: `1px solid ${bonncoColors.border}` }}>
          <Box>
            <Typography fontWeight={600}>Sound alerts</Typography>
            <Typography variant="caption" color="text.secondary">
              Play a short chime when a notification arrives — pitch and pattern vary by urgency.
            </Typography>
          </Box>
          <Switch checked={Boolean(settings?.sound_enabled)} onChange={(e) => handleToggleSound(e.target.checked)} />
        </Stack>

        <Stack
          direction="row"
          sx={{ alignItems: "center", gap: 1.5, py: 1.5, borderTop: `1px solid ${bonncoColors.border}`, flexWrap: "wrap" }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 220 }}>
            <Typography fontWeight={600}>Entry alert confidence threshold</Typography>
            <Typography variant="caption" color="text.secondary">
              Only alert on a new BUY/SELL signal at or above this confidence.
            </Typography>
          </Box>
          <TextField
            size="small"
            type="number"
            value={thresholdInput}
            onChange={(e) => {
              setThresholdInput(e.target.value);
              setNotifSaved(false);
            }}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
            sx={{ width: 110 }}
          />
          <Button variant="contained" onClick={handleSaveThreshold}>
            Save
          </Button>
        </Stack>

        {notifSaved && (
          <Typography variant="body2" sx={{ color: bonncoColors.bullish }}>
            Saved
          </Typography>
        )}
        {notifError && (
          <Typography color="error" variant="body2">
            {notifError}
          </Typography>
        )}
      </Card>

      <Card sx={{ p: 0, overflow: "hidden", borderRadius: 1.5 }}>
        <Box sx={{ p: 2.5, pb: 1.5 }}>
          <SectionLabel>WATCHLIST</SectionLabel>
          <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Box sx={{ minWidth: 220 }}>
              <SymbolPicker value={newSymbol} onChange={setNewSymbol} marketType={newMarketType} />
            </Box>
            <Select size="small" value={newMarketType} onChange={(e) => setNewMarketType(e.target.value as MarketType)}>
              <MenuItem value="spot">Spot</MenuItem>
              <MenuItem value="futures">Futures</MenuItem>
            </Select>
            <Button variant="contained" onClick={handleAdd} disabled={!newSymbol}>
              Add
            </Button>
          </Stack>
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {error}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 176px 44px",
            gap: 1.5,
            px: 2.5,
            py: 0.85,
            borderTop: `1px solid ${bonncoColors.border}`,
            borderBottom: `1px solid ${bonncoColors.border}`,
            backgroundColor: bonncoColors.bgElevated,
          }}
        >
          <SectionLabel>COIN</SectionLabel>
          <SectionLabel>MODE</SectionLabel>
          <Box />
        </Box>

        {watchlist.map((item) => (
          <Box
            key={item.id}
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 176px 44px",
              gap: 1.5,
              alignItems: "center",
              px: 2.5,
              py: 1.25,
              borderBottom: `1px solid ${bonncoColors.border}`,
              "&:hover": { backgroundColor: bonncoColors.bgElevated },
              "&:last-of-type": { borderBottom: "none" },
            }}
          >
            <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
              <CoinIcon symbol={item.symbol} size={20} />
              <Typography fontWeight={700}>{item.symbol}</Typography>
            </Stack>

            <ToggleButtonGroup size="small" exclusive value={item.market_type} onChange={(_, mode) => handleModeToggle(item, mode)}>
              <ToggleButton value="spot" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>
                Spot
              </ToggleButton>
              <ToggleButton value="futures" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>
                Futures
              </ToggleButton>
            </ToggleButtonGroup>

            <IconButton size="small" onClick={() => handleRemove(item.id)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}

        {watchlist.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
            No coins in your watchlist yet.
          </Typography>
        )}
      </Card>
    </Box>
  );
}
