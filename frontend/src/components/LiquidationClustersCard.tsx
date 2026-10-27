import { Box, Card, Stack, Typography } from "@mui/material";
import type { LiquidationClustersOut } from "../api/client";
import { bonncoColors, monoStack } from "../theme/theme";

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtPrice(value: number): string {
  return value >= 1 ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value.toString();
}

export default function LiquidationClustersCard({ data }: { data: LiquidationClustersOut }) {
  const maxUsd = Math.max(...data.clusters.map((c) => c.total_usd), 1);

  return (
    <Card sx={{ p: 2 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography
          variant="caption"
          sx={{ fontFamily: monoStack, letterSpacing: "0.08em", color: bonncoColors.textSecondary }}
        >
          LIQUIDATIONS ({data.hours}H)
        </Typography>
        {data.event_count > 0 && (
          <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
            {data.event_count} event{data.event_count === 1 ? "" : "s"}
          </Typography>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: data.clusters.length > 0 ? 1.5 : 0, lineHeight: 1.5 }}>
        {data.summary}
      </Typography>

      {data.clusters.length > 0 && (
        <Stack sx={{ gap: 0.85 }}>
          {data.clusters.map((c, i) => {
            const color = c.dominant_side === "BUY" ? bonncoColors.bullish : bonncoColors.bearish;
            const widthPct = (c.total_usd / maxUsd) * 100;
            return (
              <Stack key={i} direction="row" sx={{ alignItems: "center", gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ fontFamily: monoStack, width: 92, flexShrink: 0, color: bonncoColors.textSecondary }}
                >
                  ${fmtPrice(c.price_low)}-{fmtPrice(c.price_high)}
                </Typography>
                <Box sx={{ flex: 1, height: 10, backgroundColor: bonncoColors.bgElevated, borderRadius: 0.5, overflow: "hidden" }}>
                  <Box sx={{ width: `${widthPct}%`, height: "100%", backgroundColor: color, borderRadius: 0.5 }} />
                </Box>
                <Typography variant="caption" sx={{ fontFamily: monoStack, width: 56, textAlign: "right", color }}>
                  {fmtUsd(c.total_usd)}
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
