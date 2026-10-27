import { Box } from "@mui/material";

export default function ConfidenceBar({ confidence, color }: { confidence: number; color: string }) {
  return (
    <Box sx={{ width: "100%", height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <Box
        sx={{
          width: `${Math.min(100, Math.max(0, confidence))}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: 999,
          transition: "width 400ms ease",
        }}
      />
    </Box>
  );
}
