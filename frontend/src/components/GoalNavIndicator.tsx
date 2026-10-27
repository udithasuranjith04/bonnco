import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Stack, Tooltip, Typography } from "@mui/material";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import { fetchGoal } from "../api/client";
import type { GoalOut } from "../api/client";
import { bonncoColors, monoStack } from "../theme/theme";

// Real balance vs. goal, always visible in the nav bar so it doesn't require a page visit to
// check — refreshed on the same cadence as other passive summary panels in the app (e.g. Active
// Positions), not a new WebSocket channel, since the underlying number is a backend aggregate
// across spot + Simple Earn + futures margin, not a single live ticker price.
const REFRESH_MS = 30_000;

function fmtUsd(v: number): string {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: v < 10 ? 2 : 0 })}`;
}

export default function GoalNavIndicator() {
  const [goal, setGoal] = useState<GoalOut | null>(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    fetchGoal()
      .then(setGoal)
      .catch(() => {
        // Silent — this is a passive nav-bar summary, not critical path.
      });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (!goal) return null;

  const { current_value_usd, next_milestone_usd, progress_to_next_pct } = goal;

  return (
    <Tooltip
      title={
        next_milestone_usd !== null && progress_to_next_pct !== null
          ? `${progress_to_next_pct}% of the way to your next milestone, ${fmtUsd(next_milestone_usd)}`
          : "Live balance unavailable right now"
      }
    >
      <Stack
        direction="row"
        onClick={() => navigate("/")}
        sx={{
          alignItems: "center",
          gap: 0.75,
          px: 1.1,
          py: 0.6,
          borderRadius: 1.5,
          backgroundColor: bonncoColors.bgElevated,
          flexShrink: 0,
          cursor: "pointer",
          "&:hover": { backgroundColor: `color-mix(in srgb, ${bonncoColors.accent} 10%, ${bonncoColors.bgElevated})` },
        }}
      >
        <FlagOutlinedIcon sx={{ fontSize: 14, color: bonncoColors.accent }} />
        <Typography
          variant="caption"
          sx={{ fontFamily: monoStack, fontSize: 11.5, fontWeight: 700, color: bonncoColors.textPrimary }}
        >
          {current_value_usd !== null ? fmtUsd(current_value_usd) : "—"}
        </Typography>
        {progress_to_next_pct !== null && (
          <Box sx={{ width: 40, height: 4, borderRadius: 2, backgroundColor: bonncoColors.border, overflow: "hidden" }}>
            <Box
              sx={{
                width: `${Math.min(progress_to_next_pct, 100)}%`,
                height: "100%",
                backgroundColor: bonncoColors.accent,
              }}
            />
          </Box>
        )}
      </Stack>
    </Tooltip>
  );
}
