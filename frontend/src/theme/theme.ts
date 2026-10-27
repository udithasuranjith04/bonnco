import { createTheme } from "@mui/material/styles";
import type { RiskProfile } from "../api/client";

// Bonnco brand palette: dark navy/charcoal base, green = bullish, red = bearish.
export const bonncoColors = {
  bullish: "#22c55e",
  bearish: "#ef4444",
  neutral: "#eab308",
  bgDefault: "#0b0f17",
  bgPaper: "#121826",
  bgElevated: "#1a2233",
  border: "#232c3f",
  textPrimary: "#e6e9f0",
  textSecondary: "#8b93a7",
  accent: "#3b82f6",
};

const sansStack = ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"].join(",");
export const serifStack = ["\"Source Serif 4\"", "Georgia", "serif"].join(",");
// Reserved for terminal-style data: prices, percentages, counts, timestamps — anywhere alignment
// and at-a-glance scanning matter more than the brand voice carried by the sans/serif pairing.
export const monoStack = ["\"IBM Plex Mono\"", "\"SF Mono\"", "Menlo", "monospace"].join(",");

// Shared across the ambient risk border (AppLayout) and the risk profile table (Settings) so the
// two stay visually identical — conservative reads calm, moderate cautious, aggressive a warning.
export const riskProfileColor: Record<RiskProfile, string> = {
  conservative: bonncoColors.bullish,
  moderate: bonncoColors.neutral,
  aggressive: bonncoColors.bearish,
};

export const bonncoTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: bonncoColors.bgDefault,
      paper: bonncoColors.bgPaper,
    },
    primary: { main: bonncoColors.accent },
    success: { main: bonncoColors.bullish },
    error: { main: bonncoColors.bearish },
    warning: { main: bonncoColors.neutral },
    text: {
      primary: bonncoColors.textPrimary,
      secondary: bonncoColors.textSecondary,
    },
    divider: bonncoColors.border,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: sansStack,
    h5: {
      fontFamily: serifStack,
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    subtitle1: {
      fontFamily: serifStack,
      fontWeight: 700,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${bonncoColors.border}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: bonncoColors.bgPaper,
          border: `1px solid ${bonncoColors.border}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          transition: "transform 120ms ease, box-shadow 120ms ease",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 10, fontWeight: 600 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: bonncoColors.bgPaper,
          borderBottom: `1px solid ${bonncoColors.border}`,
        },
      },
    },
  },
});
