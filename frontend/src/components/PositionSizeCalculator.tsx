import { useEffect, useMemo, useState } from "react";
import { Box, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";
import { computePositionSize } from "../lib/positionSizing";
import { fetchBinanceBalance } from "../api/client";

function parseNum(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0.00";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// A real, live-computed position sizing calculator, not just an explanation. The math: decide how
// much you're willing to lose in dollars first (account x risk%), then work backward to the
// position size that makes your stop-loss distance equal exactly that dollar amount, never the
// other way around (picking a position size first and hoping the loss is survivable).
export default function PositionSizeCalculator() {
  const [account, setAccount] = useState("1000");
  const [riskPct, setRiskPct] = useState("1");
  const [entry, setEntry] = useState("65000");
  const [stopLoss, setStopLoss] = useState("63700");
  const [liveBalance, setLiveBalance] = useState(false);

  // Starts from your real connected balance if Binance is connected, so the example isn't a
  // made-up number — but only pre-fills once on load, since this is also meant for freely
  // exploring hypothetical numbers, not locked to staying in sync with the live balance.
  useEffect(() => {
    fetchBinanceBalance()
      .then((balance) => {
        if (balance.connected && balance.total_usd !== null && balance.total_usd > 0) {
          setAccount(String(balance.total_usd));
          setLiveBalance(true);
        }
      })
      .catch(() => {});
  }, []);

  const result = useMemo(
    () => computePositionSize(parseNum(account), parseNum(riskPct), parseNum(entry), parseNum(stopLoss)),
    [account, riskPct, entry, stopLoss],
  );

  return (
    <Box sx={{ width: "100%", borderRadius: 1.5, backgroundColor: bonncoColors.bgElevated, p: 2 }}>
      <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.08em", color: bonncoColors.accent, display: "block", mb: 1.5 }}>
        POSITION SIZE CALCULATOR
      </Typography>

      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5, mb: 2 }}>
        <TextField
          label="Account size"
          value={account}
          onChange={(e) => {
            setAccount(e.target.value);
            setLiveBalance(false);
          }}
          size="small"
          fullWidth
          type="number"
          helperText={liveBalance ? "Pre-filled from your connected Binance balance" : undefined}
          slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
        />
        <TextField
          label="Risk per trade"
          value={riskPct}
          onChange={(e) => setRiskPct(e.target.value)}
          size="small"
          fullWidth
          type="number"
          slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
        />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1.5, mb: 2.5 }}>
        <TextField
          label="Entry price"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          size="small"
          fullWidth
          type="number"
          slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
        />
        <TextField
          label="Stop-loss price"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
          size="small"
          fullWidth
          type="number"
          slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
        />
      </Stack>

      <Stack sx={{ gap: 1, borderTop: `1px solid ${bonncoColors.border}`, pt: 1.5 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">
            Stop-loss distance
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: monoStack, fontWeight: 700 }}>
            {(result.stopDistancePct * 100).toFixed(2)}%
          </Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">
            You're risking (dollars)
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: monoStack, fontWeight: 700 }}>
            {fmtUsd(result.riskAmount)}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          sx={{ justifyContent: "space-between", mt: 0.5, pt: 1, borderTop: `1px solid ${bonncoColors.border}` }}
        >
          <Typography variant="body2" fontWeight={700}>
            Position size
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: monoStack, fontWeight: 700, color: bonncoColors.accent }}>
            {fmtUsd(result.positionSizeUsd)}
          </Typography>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.secondary">
            (roughly {result.positionSizeCoin > 0 ? result.positionSizeCoin.toFixed(6) : "0"} units at this entry price)
          </Typography>
          {result.leverageNeeded > 1.01 && (
            <Typography variant="caption" color="text.secondary">
              needs ~{result.leverageNeeded.toFixed(1)}x leverage to open on futures
            </Typography>
          )}
        </Stack>
      </Stack>

      <Typography variant="caption" sx={{ display: "block", mt: 2, color: bonncoColors.textSecondary, lineHeight: 1.5 }}>
        This computes a position size where hitting your stop-loss costs exactly your chosen risk amount, no more. It
        doesn't account for fees or slippage, and isn't a recommendation on what your stop-loss or risk % should be,
        those are your own calls, see Risk Management.
      </Typography>
    </Box>
  );
}
