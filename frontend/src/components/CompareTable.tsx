import { Box, Stack, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

export interface CompareRow {
  label: string;
  values: string[];
}

export default function CompareTable({ columns, rows }: { columns: string[]; rows: CompareRow[] }) {
  return (
    <Box sx={{ width: "100%", borderRadius: 1, backgroundColor: bonncoColors.bgElevated, overflow: "hidden" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `1fr repeat(${columns.length}, 1fr)`,
          borderBottom: `1px solid ${bonncoColors.border}`,
          px: 1.5,
          py: 1,
        }}
      >
        <Typography variant="caption" sx={{ fontFamily: monoStack, color: bonncoColors.textSecondary }} />
        {columns.map((c) => (
          <Typography key={c} variant="caption" sx={{ fontFamily: monoStack, letterSpacing: "0.06em", color: bonncoColors.textSecondary, fontWeight: 700 }}>
            {c.toUpperCase()}
          </Typography>
        ))}
      </Box>

      <Stack>
        {rows.map((row, i) => (
          <Box
            key={row.label}
            sx={{
              display: "grid",
              gridTemplateColumns: `1fr repeat(${columns.length}, 1fr)`,
              px: 1.5,
              py: 1,
              borderBottom: i < rows.length - 1 ? `1px solid ${bonncoColors.border}` : "none",
              gap: 1,
            }}
          >
            <Typography variant="body2" fontWeight={600}>
              {row.label}
            </Typography>
            {row.values.map((v, j) => (
              <Typography key={j} variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                {v}
              </Typography>
            ))}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
