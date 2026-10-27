import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { monoStack } from "../theme/theme";

export default function StatCell({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: monoStack, letterSpacing: "0.05em" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, mt: 0.25 }}>{value}</Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Box>
  );
}
