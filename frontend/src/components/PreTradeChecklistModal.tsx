import { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogContent, LinearProgress, Stack, TextField, Typography } from "@mui/material";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import FormatQuoteOutlinedIcon from "@mui/icons-material/FormatQuoteOutlined";
import type { MarketType, RiskProfile, TradeSide } from "../api/client";
import { bonncoColors, monoStack } from "../theme/theme";

// Mirrors LEVERAGE_RANGES in backend/app/services/signal_engine.py (kept in sync by hand — no
// shared endpoint exposes it). Used only to warn here, never to block: the point of this checklist
// is to surface the plan you already set with a clear head, not to override your own decision.
const LEVERAGE_RANGES: Record<RiskProfile, [number, number]> = {
  conservative: [1, 3],
  moderate: [2, 5],
  aggressive: [3, 10],
};

export interface PreTradeChecklistResult {
  positionSizeUsd: number;
  stopLoss: number;
  leverage: number;
}

interface Props {
  open: boolean;
  symbol: string;
  side: TradeSide;
  marketType: MarketType;
  entryPrice: number;
  initialPositionSizeUsd: number;
  initialStopLoss: number | null;
  initialLeverage: number;
  riskProfile: RiskProfile;
  reasoning: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (result: PreTradeChecklistResult) => void;
}

const STEPS = ["Position size", "Stop-loss", "Leverage", "Why this trade"] as const;

export default function PreTradeChecklistModal({
  open,
  symbol,
  side,
  marketType,
  entryPrice,
  initialPositionSizeUsd,
  initialStopLoss,
  initialLeverage,
  riskProfile,
  reasoning,
  submitting,
  onCancel,
  onConfirm,
}: Props) {
  const [step, setStep] = useState(0);
  const [sizeStr, setSizeStr] = useState("");
  const [stopStr, setStopStr] = useState("");
  const [leverageStr, setLeverageStr] = useState("");

  // Reset to a fresh run through the checklist every time the modal is opened for a new trade —
  // this is a per-trade discipline check, not a form that should remember a stale prior state.
  useEffect(() => {
    if (open) {
      setStep(0);
      setSizeStr(initialPositionSizeUsd > 0 ? initialPositionSizeUsd.toFixed(2) : "");
      setStopStr(initialStopLoss !== null ? String(initialStopLoss) : "");
      setLeverageStr(String(initialLeverage || 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const size = parseFloat(sizeStr) || 0;
  const stop = parseFloat(stopStr) || 0;
  const leverage = parseFloat(leverageStr) || 0;
  const [, leverageCeiling] = LEVERAGE_RANGES[riskProfile];
  const overCeiling = leverage > leverageCeiling;

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleFinalConfirm() {
    onConfirm({ positionSizeUsd: size, stopLoss: stop, leverage });
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogContent sx={{ p: 3 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary, letterSpacing: "0.06em" }}>
            PRE-TRADE CHECK · STEP {step + 1} OF {STEPS.length}
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
            {symbol} · {side.toUpperCase()} · {marketType}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={((step + 1) / STEPS.length) * 100}
          sx={{ mb: 2.5, height: 4, borderRadius: 2 }}
        />

        {step === 0 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
              Position size
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Auto-calculated from your real balance and risk % in Settings, at entry ${entryPrice.toLocaleString()}. Confirm
              it or adjust before you proceed.
            </Typography>
            <TextField
              label="Position size ($)"
              type="number"
              size="small"
              fullWidth
              autoFocus
              value={sizeStr}
              onChange={(e) => setSizeStr(e.target.value)}
            />
          </Box>
        )}

        {step === 1 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
              Stop-loss
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              The price where you're getting out if this goes against you. This is your own exit plan, not a guarantee it
              won't be needed — you can't proceed without one set.
            </Typography>
            <TextField
              label="Stop-loss price"
              type="number"
              size="small"
              fullWidth
              autoFocus
              value={stopStr}
              onChange={(e) => setStopStr(e.target.value)}
              error={stop <= 0}
              helperText={stop <= 0 ? "Required — set a stop-loss to continue." : " "}
            />
          </Box>
        )}

        {step === 2 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
              Leverage
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Your {riskProfile} risk profile suggests staying at or under {leverageCeiling}x for a trade like this.
            </Typography>
            <TextField
              label="Leverage (x)"
              type="number"
              size="small"
              fullWidth
              autoFocus
              value={leverageStr}
              onChange={(e) => setLeverageStr(e.target.value)}
            />
            {overCeiling && (
              <Stack
                direction="row"
                sx={{
                  gap: 0.75,
                  alignItems: "flex-start",
                  mt: 1.5,
                  backgroundColor: "rgba(234,179,8,0.12)",
                  border: `1px solid ${bonncoColors.neutral}55`,
                  borderRadius: 1,
                  px: 1.25,
                  py: 1,
                }}
              >
                <WarningAmberOutlinedIcon fontSize="small" sx={{ color: bonncoColors.neutral, mt: "1px" }} />
                <Typography variant="body2" sx={{ color: bonncoColors.neutral }}>
                  {leverage}x is above the {leverageCeiling}x your {riskProfile} profile suggests. Higher leverage means a
                  smaller adverse move wipes out more of your position. You can still proceed — this is a reminder, not a
                  block.
                </Typography>
              </Stack>
            )}
          </Box>
        )}

        {step === 3 && (
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
              Why this trade
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              One last look before you log it — this doesn't predict the outcome, it's just the reasoning you're acting on.
            </Typography>
            {reasoning ? (
              <Stack
                direction="row"
                sx={{ gap: 0.75, alignItems: "flex-start", backgroundColor: "rgba(59,130,246,0.08)", borderRadius: 1, px: 1.5, py: 1.25 }}
              >
                <FormatQuoteOutlinedIcon fontSize="small" sx={{ color: bonncoColors.accent, mt: "1px" }} />
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  {reasoning}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ fontStyle: "italic", color: bonncoColors.textSecondary }}>
                No signal reasoning attached — this is a manual entry. Take a moment to be sure you can state why you're
                taking it before confirming.
              </Typography>
            )}
          </Box>
        )}

        <Stack direction="row" sx={{ justifyContent: "space-between", mt: 3 }}>
          <Button size="small" onClick={onCancel} disabled={submitting} sx={{ color: bonncoColors.textSecondary }}>
            Cancel
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              size="small"
              variant="contained"
              onClick={next}
              disabled={(step === 0 && size <= 0) || (step === 1 && stop <= 0)}
            >
              Confirm & continue
            </Button>
          ) : (
            <Button size="small" variant="contained" onClick={handleFinalConfirm} disabled={submitting}>
              {submitting ? "Logging…" : "Confirm & log trade"}
            </Button>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
