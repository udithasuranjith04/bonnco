import type { ReactNode } from "react";
import { Stack, Typography } from "@mui/material";
import { bonncoColors } from "../theme/theme";

export default function DashboardEmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <Stack sx={{ alignItems: "center", justifyContent: "center", gap: 1, py: 4, px: 2.5 }}>
      <Stack
        sx={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bonncoColors.bgElevated,
          color: bonncoColors.textSecondary,
        }}
      >
        {icon}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        {text}
      </Typography>
    </Stack>
  );
}
