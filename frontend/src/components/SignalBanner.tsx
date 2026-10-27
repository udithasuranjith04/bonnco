import { Box, Button, Card, Divider, Grid, Stack, Typography } from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import type { SignalOut } from "../api/client";
import SignalBadge from "./SignalBadge";
import { bonncoColors } from "../theme/theme";

function extractWhyNow(reasoning: string): string | null {
  const marker = "Why now: ";
  const idx = reasoning.indexOf(marker);
  if (idx === -1) return null;
  return reasoning.slice(idx + marker.length).replace(/\.$/, "");
}

function ReferenceStat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography fontWeight={700}>{value}</Typography>
    </Box>
  );
}

export default function SignalBanner({
  signal,
  onAskBonnco,
}: {
  signal: SignalOut;
  onAskBonnco: () => void;
}) {
  const whyNow = extractWhyNow(signal.reasoning);

  return (
    <Card sx={{ p: 3, mb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, gap: 2, mb: 2 }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
          <SignalBadge signal={signal.signal} />
          <Typography variant="h6" fontWeight={700}>
            {signal.confidence}% confidence
          </Typography>
        </Stack>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ChatBubbleOutlineIcon />}
          onClick={onAskBonnco}
          sx={{ borderColor: bonncoColors.border }}
        >
          Ask Bonnco about this coin
        </Button>
      </Stack>

      <Typography color="text.secondary" sx={{ lineHeight: 1.6, mb: whyNow ? 1.5 : 0 }}>
        {signal.reasoning.split("Why now:")[0].trim()}
      </Typography>

      {whyNow && (
        <Box
          sx={{
            backgroundColor: bonncoColors.bgElevated,
            border: `1px solid ${bonncoColors.border}`,
            borderRadius: 2,
            p: 1.5,
            mb: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            WHY NOW
          </Typography>
          <Typography variant="body2">{whyNow}</Typography>
        </Box>
      )}

      <Divider sx={{ my: 2, borderColor: bonncoColors.border }} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <ReferenceStat label="Entry (reference)" value={`$${signal.entry_price.toLocaleString()}`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <ReferenceStat label="Stop-loss" value={signal.stop_loss ? `$${signal.stop_loss.toLocaleString()}` : "—"} />
        </Grid>
        {signal.market_type === "futures" && (
          <>
            <Grid size={{ xs: 6, sm: 3 }}>
              <ReferenceStat
                label="Suggested leverage"
                value={
                  signal.suggested_leverage_min && signal.suggested_leverage_max
                    ? `${signal.suggested_leverage_min}x – ${signal.suggested_leverage_max}x`
                    : "—"
                }
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <ReferenceStat
                label="Liquidation (est.)"
                value={signal.liquidation_estimate ? `$${signal.liquidation_estimate.toLocaleString()}` : "—"}
              />
            </Grid>
          </>
        )}
      </Grid>

      {signal.liquidation_disclaimer && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          {signal.liquidation_disclaimer}
        </Typography>
      )}
    </Card>
  );
}
