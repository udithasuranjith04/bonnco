import { Box, Typography } from "@mui/material";
import { bonncoColors, monoStack } from "../theme/theme";

export interface ScaleZone {
  label: string;
  from: number;
  to: number;
  color: string;
}

export default function ScaleDiagram({
  zones,
  min,
  max,
  marker,
  markerLabel,
  height = 120,
}: {
  zones: ScaleZone[];
  min: number;
  max: number;
  marker?: number;
  markerLabel?: string;
  height?: number;
}) {
  const range = max - min;

  return (
    <Box sx={{ width: "100%", height, borderRadius: 1, backgroundColor: bonncoColors.bgElevated, p: 2, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Box sx={{ position: "relative", pt: marker !== undefined ? 2 : 0 }}>
        {marker !== undefined && (
          <Box
            sx={{
              position: "absolute",
              left: `${((marker - min) / range) * 100}%`,
              top: 0,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {markerLabel && (
              <Typography variant="caption" sx={{ fontFamily: monoStack, fontWeight: 700, whiteSpace: "nowrap", mb: 0.25 }}>
                {markerLabel}
              </Typography>
            )}
            <Box sx={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `7px solid ${bonncoColors.textPrimary}` }} />
          </Box>
        )}

        <Box sx={{ display: "flex", height: 26, borderRadius: 0.75, overflow: "hidden" }}>
          {zones.map((z, i) => (
            <Box
              key={i}
              sx={{
                flex: z.to - z.from,
                backgroundColor: `${z.color}30`,
                borderRight: i < zones.length - 1 ? `1px solid ${bonncoColors.bgDefault}` : "none",
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: "flex", mt: 0.75 }}>
          {zones.map((z, i) => (
            <Box key={i} sx={{ flex: z.to - z.from, textAlign: "center", px: 0.25 }}>
              <Typography variant="caption" sx={{ color: z.color, fontWeight: 700, fontSize: 10.5, lineHeight: 1.3, display: "block" }}>
                {z.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
