import { Box, Card, Collapse, FormControlLabel, Switch, Typography } from "@mui/material";
import { useState } from "react";
import { bonncoColors } from "../theme/theme";

interface IndicatorReading {
  label: string;
  value: unknown;
}

interface IndicatorSnapshot {
  rsi: IndicatorReading;
  macd: IndicatorReading;
  ema: IndicatorReading;
  bollinger: IndicatorReading;
  volume: IndicatorReading;
  support_resistance: IndicatorReading;
}

const EDUCATION: Record<keyof IndicatorSnapshot, { title: string; blurb: string }> = {
  rsi: {
    title: "RSI (Relative Strength Index)",
    blurb:
      "Measures how fast and how far price has moved recently, on a 0-100 scale. Above 70 usually means the coin has moved up quickly and could be due for a pause or pullback (overbought). Below 30 means it's dropped quickly and could be due for a bounce (oversold). In between is considered neutral.",
  },
  macd: {
    title: "MACD (Moving Average Convergence Divergence)",
    blurb:
      "Compares a fast and slow moving average to spot momentum shifts. When the MACD line crosses above its signal line, that's read as a bullish (upward) momentum shift. When it crosses below, that's a bearish shift.",
  },
  ema: {
    title: "EMA (Exponential Moving Average)",
    blurb:
      "Smooths out price to show the underlying trend, reacting faster to recent price than a simple average. Price above its longer-term EMAs (50, 200) is typically read as an uptrend. A faster EMA (9) crossing above a slower one (21) is often an early signal of a new short-term trend starting.",
  },
  bollinger: {
    title: "Bollinger Bands",
    blurb:
      "A volatility envelope around price. The bands widen when price is moving a lot and narrow when it's quiet. Price pushing against the upper band can mean strong upward momentum OR an overextended move, depending on other signals like RSI and the overall trend.",
  },
  volume: {
    title: "Volume",
    blurb:
      "How much of the coin actually traded. A price move on unusually high volume (a 'spike') is considered more reliable than the same move on low volume, which can be a weak or false move.",
  },
  support_resistance: {
    title: "Support & Resistance",
    blurb:
      "Support is a price level where buying pressure has historically stepped in and stopped a decline. Resistance is a level where selling pressure has historically capped a rally. Price often reacts to these levels, at least temporarily.",
  },
};

function formatValue(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${typeof v === "number" ? v.toLocaleString() : v}`)
      .join(" · ");
  }
  return String(value);
}

export default function BeginnerExplainer({ snapshot }: { snapshot: IndicatorSnapshot }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card sx={{ p: 2.5 }}>
      <FormControlLabel
        control={<Switch checked={expanded} onChange={(e) => setExpanded(e.target.checked)} />}
        label={
          <Typography fontWeight={600}>
            Explain like I'm new to trading
          </Typography>
        }
      />
      <Collapse in={expanded}>
        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          {(Object.keys(EDUCATION) as (keyof IndicatorSnapshot)[]).map((key) => {
            const edu = EDUCATION[key];
            const reading = snapshot[key];
            return (
              <Box key={key} sx={{ borderLeft: `3px solid ${bonncoColors.accent}`, pl: 1.5 }}>
                <Typography fontWeight={700} variant="body2">
                  {edu.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {edu.blurb}
                </Typography>
                <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                  Right now: {reading.label} ({formatValue(reading.value)})
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Card>
  );
}
