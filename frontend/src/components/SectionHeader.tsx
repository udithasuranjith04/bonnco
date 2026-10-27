import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

export default function SectionHeader({ icon, label, trailing }: { icon: ReactNode; label: string; trailing?: ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 2.5, pt: 2, pb: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <Box sx={{ color: bonncoColors.accent, display: "flex" }}>{icon}</Box>
        <Typography
          variant="caption"
          sx={{ fontFamily: monoStack, letterSpacing: "0.08em", fontWeight: 700, color: bonncoColors.textSecondary }}
        >
          {label}
        </Typography>
      </Stack>
      {trailing}
    </Stack>
  );
}
