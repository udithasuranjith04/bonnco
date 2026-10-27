import { Tooltip } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { bonncoColors } from "../theme/theme";

const HINT_TEXT =
  "Signals can differ by timeframe. That's expected, not a bug. Each timeframe is computed from a " +
  "different window of price history, so a coin can be in a long-term downtrend on the 1d chart while " +
  "bouncing short-term on 1h or 5m (or vice versa). Checking multiple timeframes on purpose is normal " +
  "trading practice; the disagreement itself is informative.";

export default function TimeframeHint() {
  return (
    <Tooltip title={HINT_TEXT} arrow placement="bottom" enterTouchDelay={0}>
      <InfoOutlinedIcon
        sx={{ fontSize: 16, color: bonncoColors.textSecondary, cursor: "help", verticalAlign: "middle" }}
      />
    </Tooltip>
  );
}
