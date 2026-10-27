import { Box, Stack, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

// A palette distinct from the semantic bullish/bearish/neutral/accent colors reserved elsewhere,
// cycled deterministically by index so the same coin keeps the same color across refreshes.
const SEGMENT_COLORS = ["#3b82f6", "#a855f7", "#14b8a6", "#f97316", "#ec4899", "#84cc16", "#06b6d4", "#f59e0b"];

// Visual gap between segments (in degrees of the circle) so each slice reads as a distinct,
// rounded piece rather than one continuous ring — the polish that makes a donut look designed
// rather than default.
const GAP_DEGREES = 4;

interface Slice {
  coin: string;
  usd_value: number;
  pct_of_portfolio: number;
}

// Real dust (a coin worth a fraction of a cent) rounds to "0.0%" at one decimal place, which reads
// as broken/zeroed-out rather than "real, just tiny" — floor it to a legible "<0.1%" instead of
// fabricating extra decimal precision nobody can act on.
function fmtPct(pct: number): string {
  if (pct > 0 && pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

export default function ConcentrationDonut({
  slices,
  totalUsd,
  size = 168,
  compact = false,
}: {
  slices: Slice[];
  totalUsd: number;
  size?: number;
  compact?: boolean;
}) {
  const strokeWidth = compact ? size * 0.16 : size * 0.13;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gapLen = slices.length > 1 ? (GAP_DEGREES / 360) * circumference : 0;

  let cumulativePct = 0;

  return (
    <Stack direction={compact ? "column" : "row"} sx={{ alignItems: "center", gap: compact ? 1.5 : 3, flexWrap: "wrap" }}>
      <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.35))" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={bonncoColors.bgElevated} strokeWidth={strokeWidth} />
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            {slices.map((s, i) => {
              const fullDash = (s.pct_of_portfolio / 100) * circumference;
              const dash = Math.max(fullDash - gapLen, 0);
              const offset = -((cumulativePct / 100) * circumference) - gapLen / 2;
              cumulativePct += s.pct_of_portfolio;
              return (
                <circle
                  key={s.coin}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 300ms ease" }}
                />
              );
            })}
          </g>
        </svg>
        <Stack sx={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          {!compact && (
            <Typography variant="caption" color="text.secondary">
              Total
            </Typography>
          )}
          <Typography sx={{ fontFamily: monoStack, fontWeight: 700, fontSize: compact ? 15 : 15, lineHeight: 1.2 }}>
            ${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Typography>
        </Stack>
      </Box>

      <Stack sx={{ gap: compact ? 0.6 : 0.85, minWidth: compact ? 0 : 200, flex: compact ? undefined : 1, width: compact ? "100%" : undefined }}>
        {slices.map((s, i) => (
          <Stack key={s.coin} direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: compact ? 7 : 10,
                height: compact ? 7 : 10,
                borderRadius: "50%",
                backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                flexShrink: 0,
              }}
            />
            <Typography
              variant={compact ? "caption" : "body2"}
              fontWeight={600}
              sx={{ minWidth: compact ? 56 : 60, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            >
              {s.coin}
            </Typography>
            <Typography
              variant={compact ? "caption" : "body2"}
              color="text.secondary"
              sx={{ flexGrow: 1, fontFamily: monoStack, textAlign: "right" }}
            >
              {fmtPct(s.pct_of_portfolio)}
            </Typography>
            {!compact && (
              <Typography variant="body2" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary, minWidth: 64, textAlign: "right" }}>
                ${s.usd_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Typography>
            )}
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
