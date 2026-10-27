import { useCallback, useEffect, useState } from "react";
import { Box, Button, Card, Chip, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { acknowledgeMilestone, fetchGoal } from "../api/client";
import type { GoalOut } from "../api/client";
import { bonncoColors, monoStack } from "../theme/theme";

function fmtUsd(v: number): string {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 2 : 0 })}`;
}

export default function GoalProgressCard() {
  const [goal, setGoal] = useState<GoalOut | null>(null);
  const [celebrating, setCelebrating] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchGoal().then((g) => {
      setGoal(g);
      // A milestone that's newly reached but not yet acknowledged is held in `celebrating` until
      // the user actually sees the banner and dismisses it — acknowledging on fetch instead would
      // risk marking it "seen" for a milestone that was never actually shown to the user.
      if (g.newly_reached_milestone_usd !== null) {
        setCelebrating(g.newly_reached_milestone_usd);
      }
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function dismissCelebration() {
    if (celebrating === null) return;
    await acknowledgeMilestone(celebrating);
    setCelebrating(null);
    load();
  }

  if (!goal) return null;

  const current = goal.current_value_usd;

  return (
    <Card sx={{ p: { xs: 2.5, sm: 3 }, mb: 3 }}>
      {celebrating !== null && (
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            mb: 2.5,
            backgroundColor: "rgba(34,197,94,0.1)",
            border: `1px solid ${bonncoColors.bullish}55`,
            borderRadius: 1,
            px: 1.75,
            py: 1.25,
            flexWrap: "wrap",
          }}
        >
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <CheckCircleIcon sx={{ color: bonncoColors.bullish }} fontSize="small" />
            <Typography variant="body2" fontWeight={600} sx={{ color: bonncoColors.bullish }}>
              Milestone reached — your real balance passed {fmtUsd(celebrating)}.
            </Typography>
          </Stack>
          <Button size="small" onClick={dismissCelebration} sx={{ color: bonncoColors.bullish }}>
            Nice — show next milestone
          </Button>
        </Stack>
      )}

      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", mb: 1, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary }}>
          NEXT MILESTONE
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }}>
          {current !== null ? fmtUsd(current) : "—"}
          {goal.next_milestone_usd !== null ? ` of ${fmtUsd(goal.next_milestone_usd)}` : ""}
          {goal.progress_to_next_pct !== null ? ` · ${goal.progress_to_next_pct}%` : ""}
        </Typography>
      </Stack>

      <LinearProgress
        variant={goal.progress_to_next_pct !== null ? "determinate" : "indeterminate"}
        value={goal.progress_to_next_pct ?? undefined}
        sx={{
          height: 8,
          borderRadius: 4,
          mb: 1,
          backgroundColor: bonncoColors.bgElevated,
          "& .MuiLinearProgress-bar": { backgroundColor: bonncoColors.accent },
        }}
      />

      {current === null ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          Live balance is unavailable right now — check your Binance connection in Settings.
        </Typography>
      ) : (
        goal.daily_pace_usd !== null && (
          <Tooltip title="An informal pace reference over the next ~2 weeks — not a daily requirement or a prediction. Some days will be flat or down, and that's normal.">
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
              Pace reference: roughly {fmtUsd(goal.daily_pace_usd)}/day would get you there in about two weeks.
            </Typography>
          </Tooltip>
        )
      )}

      {goal.milestones.length > 0 && (
        <Box sx={{ overflowX: "auto" }}>
          <Stack direction="row" sx={{ gap: 1, pb: 0.5, width: "max-content" }}>
            {goal.milestones.map((m, i) => {
              const isNext = i === 0;
              return (
                <Chip
                  key={m}
                  size="small"
                  label={fmtUsd(m)}
                  sx={{
                    fontFamily: monoStack,
                    fontWeight: isNext ? 700 : 500,
                    backgroundColor: isNext ? "rgba(59,130,246,0.14)" : "transparent",
                    color: isNext ? bonncoColors.accent : bonncoColors.textSecondary,
                    border: `1px solid ${isNext ? bonncoColors.accent : bonncoColors.border}`,
                  }}
                />
              );
            })}
          </Stack>
        </Box>
      )}
    </Card>
  );
}
