import { Box, Button, Card, CardActionArea, CardContent, Chip, Collapse, CircularProgress, IconButton, Stack, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { useNavigate } from "react-router-dom";
import type { Candle, MarketType, SignalOut } from "../api/client";
import SignalBadge, { getSignalColor } from "./SignalBadge";
import Sparkline from "./Sparkline";
import ConfidenceBar from "./ConfidenceBar";
import LivePriceInline from "./LivePriceInline";
import CoinIcon from "./CoinIcon";
import { summarizeSignal } from "../lib/signalSummary";
import { buildTradePrefillFromSignal, DIRECTIONAL_SIGNALS } from "../lib/tradePrefill";
import { bonncoColors } from "../theme/theme";

export interface CoinCardData {
  signal?: SignalOut;
  candles?: Candle[];
  error?: string;
}

// A fixed footprint for every card, loaded or not, so the grid never reflows as signals stream
// in on page load or refresh — that reflow was the "vibrating" effect. Sized to comfortably fit
// a futures card's leverage row; spot cards just carry a little unused space at the bottom.
const CARD_MIN_HEIGHT = 372;

const PATTERN_BIAS_COLOR: Record<"bullish" | "bearish" | "neutral", string> = {
  bullish: bonncoColors.bullish,
  bearish: bonncoColors.bearish,
  neutral: bonncoColors.accent,
};

export default function CoinSignalCard({
  symbol,
  marketType,
  card,
  expanded,
  onToggleExpand,
  onNavigate,
  onRemove,
  onModeChange,
}: {
  symbol: string;
  marketType: MarketType;
  card?: CoinCardData;
  expanded: boolean;
  onToggleExpand: () => void;
  onNavigate: () => void;
  // Only passed for cards representing the user's own watchlist — lets this same card double as
  // the watchlist management surface rather than needing a separate, simpler card style just for
  // remove/mode-toggle. Absent (undefined) for read-only market-browsing cards.
  onRemove?: () => void;
  onModeChange?: (marketType: MarketType) => void;
}) {
  const navigate = useNavigate();
  const signalColor = card?.signal ? getSignalColor(card.signal.signal) : bonncoColors.border;
  const isDirectional = card?.signal ? DIRECTIONAL_SIGNALS.includes(card.signal.signal) : false;

  const hasManageControls = Boolean(onRemove || onModeChange);

  return (
    <Card
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minHeight: CARD_MIN_HEIGHT,
        border: `1px solid ${signalColor}40`,
        backgroundColor: `color-mix(in srgb, ${signalColor} 4%, ${bonncoColors.bgPaper})`,
        boxShadow: `0 4px 20px ${signalColor}14`,
        transition: "box-shadow 200ms ease, border-color 200ms ease",
      }}
    >
      {/* Sibling to CardActionArea, not a descendant — CardActionArea renders a <button>, and
          IconButton/clickable Chip below also render interactive elements, which HTML forbids
          nesting inside another button. Positioned to visually sit in the card's top-right. */}
      {hasManageControls && (
        <Stack
          direction="row"
          sx={{ position: "absolute", top: 14, right: 14, zIndex: 1, alignItems: "center", gap: 0.5 }}
        >
          {onModeChange && (
            <Chip
              label={marketType}
              size="small"
              variant="outlined"
              onClick={() => onModeChange(marketType === "spot" ? "futures" : "spot")}
              sx={{ cursor: "pointer", backgroundColor: bonncoColors.bgPaper }}
            />
          )}
          {onRemove && (
            <IconButton size="small" onClick={onRemove} sx={{ color: bonncoColors.textSecondary, p: 0.4, backgroundColor: bonncoColors.bgPaper }}>
              <DeleteOutlineIcon fontSize="inherit" sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Stack>
      )}

      <CardActionArea
        onClick={onNavigate}
        sx={{ p: 2, pb: card?.signal ? 1 : 2, display: "flex", flexDirection: "column", alignItems: "stretch" }}
      >
        <CardContent sx={{ p: 0, width: "100%", flexGrow: card ? 0 : 1, display: "flex", flexDirection: "column" }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
              <CoinIcon symbol={symbol} size={22} />
              <Typography fontWeight={700}>{symbol}</Typography>
            </Stack>
            {!hasManageControls && <Chip label={marketType} size="small" variant="outlined" />}
          </Stack>
          <Box sx={{ mb: 1 }}>
            <LivePriceInline symbol={symbol} marketType={marketType} />
          </Box>

          {!card && (
            <Stack sx={{ alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
              <CircularProgress size={20} />
            </Stack>
          )}

          {card?.error && (
            <Typography variant="body2" color="text.secondary">
              {card.error}
            </Typography>
          )}

          {card?.signal && (
            <>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                <SignalBadge signal={card.signal.signal} size="small" />
                <Typography variant="body2" fontWeight={700}>
                  {card.signal.confidence}%
                </Typography>
              </Stack>

              <Box sx={{ mb: 1.5 }}>
                <ConfidenceBar confidence={card.signal.confidence} color={signalColor} />
              </Box>

              {card.candles && card.candles.length > 1 && (
                <Box sx={{ mb: 1.5 }}>
                  <Sparkline data={card.candles.map((c) => c.close)} width={220} height={40} />
                </Box>
              )}

              {marketType === "futures" && card.signal.suggested_leverage_max && (
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: "space-between",
                    backgroundColor: "rgba(255,255,255,0.03)",
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                    mb: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Leverage {card.signal.suggested_leverage_min}x–{card.signal.suggested_leverage_max}x
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Liq ${card.signal.liquidation_estimate?.toLocaleString()}
                  </Typography>
                </Stack>
              )}
            </>
          )}
        </CardContent>
      </CardActionArea>

      {card?.signal && (
        <Box sx={{ px: 2, pb: 2, mt: "auto" }}>
          <Stack sx={{ gap: 0.4, mb: 0.75 }}>
            {summarizeSignal(card.signal.indicator_snapshot as any).map((row) => (
              <Stack key={row.label} direction="row" sx={{ gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 66, fontWeight: 600 }}>
                  {row.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  {row.value}
                </Typography>
              </Stack>
            ))}
          </Stack>

          {card.signal.pattern_summary && (
            <Stack direction="row" sx={{ alignItems: "center", gap: 0.6, mb: 0.75 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  flexShrink: 0,
                  backgroundColor: PATTERN_BIAS_COLOR[card.signal.pattern_bias ?? "neutral"],
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                {card.signal.pattern_summary}
              </Typography>
            </Stack>
          )}

          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Typography
              variant="caption"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              sx={{ color: bonncoColors.accent, fontWeight: 600, cursor: "pointer" }}
            >
              {expanded ? "Hide full reasoning" : "Show full reasoning"}
            </Typography>

            {isDirectional && (
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => {
                  e.stopPropagation();
                  const prefill = buildTradePrefillFromSignal(symbol, marketType, card!.signal!);
                  navigate("/journal", { state: { prefill } });
                }}
              >
                Log this trade
              </Button>
            )}
          </Stack>

          <Collapse in={expanded}>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.5 }}>
              {card.signal.reasoning}
            </Typography>
          </Collapse>
        </Box>
      )}
    </Card>
  );
}
