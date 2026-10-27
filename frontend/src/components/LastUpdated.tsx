import { useEffect, useState } from "react";
import { Stack, Typography } from "@mui/material";
import CircleIcon from "@mui/icons-material/Circle";
import { bonncoColors } from "../theme/theme";

function formatAgo(seconds: number): string {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export default function LastUpdated({ timestamp }: { timestamp: Date | null }) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!timestamp) return null;

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 1000));
  const isFresh = seconds < 5;

  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
      <CircleIcon
        sx={{
          fontSize: "8px !important",
          color: isFresh ? bonncoColors.bullish : bonncoColors.textSecondary,
          transition: "color 400ms ease",
        }}
      />
      <Typography variant="caption" color="text.secondary">
        Updated {formatAgo(seconds)}
      </Typography>
    </Stack>
  );
}
