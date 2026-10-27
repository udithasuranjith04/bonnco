import { Chip, Tooltip } from "@mui/material";
import type { SignalValue } from "../api/client";
import { bonncoColors } from "../theme/theme";

const SIGNAL_STYLES: Record<SignalValue, { bg: string; fg: string; label: string }> = {
  STRONG_BUY: { bg: "rgba(34,197,94,0.22)", fg: bonncoColors.bullish, label: "STRONG BUY" },
  BUY: { bg: "rgba(34,197,94,0.14)", fg: bonncoColors.bullish, label: "BUY" },
  HOLD: { bg: "rgba(234,179,8,0.16)", fg: bonncoColors.neutral, label: "HOLD" },
  SELL: { bg: "rgba(239,68,68,0.14)", fg: bonncoColors.bearish, label: "SELL" },
  STRONG_SELL: { bg: "rgba(239,68,68,0.22)", fg: bonncoColors.bearish, label: "STRONG SELL" },
};

// Same real meaning taught on the Study page ("Understanding STRONG_BUY/.../STRONG_SELL" and "How
// to read Bonnco's BUY/SELL signals") — repeated here so it's available right where the badge
// appears, not just for someone who happens to navigate to Study separately.
const SIGNAL_EXPLANATIONS: Record<SignalValue, string> = {
  STRONG_BUY: "Strong bullish signal. High-confidence case for going long, or buying on spot.",
  BUY: "Bullish signal. A case for going long, or buying on spot.",
  HOLD: "No clear edge either way right now. Not a trade signal. The evidence doesn't clear the bar for taking a side.",
  SELL: "Bearish signal. On futures, a case for going short. On spot, a sign it may not be a good time to buy, or a good time to exit if you're already holding.",
  STRONG_SELL: "Strong bearish signal. High-confidence case for going short on futures, or exiting a spot position.",
};

export function getSignalColor(signal: SignalValue): string {
  return SIGNAL_STYLES[signal].fg;
}

export default function SignalBadge({ signal, size = "medium" }: { signal: SignalValue; size?: "small" | "medium" }) {
  const style = SIGNAL_STYLES[signal];
  return (
    <Tooltip title={SIGNAL_EXPLANATIONS[signal]} arrow placement="top" enterDelay={300}>
      <Chip
        label={style.label}
        size={size}
        sx={{
          backgroundColor: style.bg,
          color: style.fg,
          fontWeight: 700,
          letterSpacing: 0.3,
          border: `1px solid ${style.fg}33`,
          cursor: "help",
        }}
      />
    </Tooltip>
  );
}
