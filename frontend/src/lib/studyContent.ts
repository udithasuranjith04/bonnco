import type { Point } from "../components/PatternDiagram";
import type { IllustrativeCandle } from "../components/CandlestickDiagram";
import type { VolumeBar } from "../components/VolumeConceptDiagram";
import type { ScaleZone } from "../components/ScaleDiagram";
import type { FactorBar } from "../components/FactorBreakdownDiagram";
import { synthesizeCandles } from "./synthesizeCandles";

export type StudyCategory = "reversal" | "continuation" | "candlestick" | "volume" | "signals" | "indicator";
export type Bias = "bullish" | "bearish" | "neutral";

interface BaseEntry {
  id: string;
  name: string;
  category: StudyCategory;
  bias: Bias;
  summary: string;
  howToSpot: string[];
  meaning: string;
  whatToDo: string;
}

export interface LineEntry extends BaseEntry {
  kind: "line";
  points: Point[];
  referenceLines?: { y: number }[];
  secondaryPoints?: Point[];
  band?: { upper: Point[]; lower: Point[] };
}

export interface CandleEntry extends BaseEntry {
  kind: "candles";
  candles: IllustrativeCandle[];
  referenceLines?: { y: number }[];
}

export interface VolumeEntry extends BaseEntry {
  kind: "volume";
  pricePoints: Point[];
  bars: VolumeBar[];
}

export interface ScaleEntry extends BaseEntry {
  kind: "scale";
  zones: ScaleZone[];
  scaleMin: number;
  scaleMax: number;
  marker?: number;
  markerLabel?: string;
}

export interface CompareEntry extends BaseEntry {
  kind: "compare";
  top: { label: string; points: Point[] };
  bottom: { label: string; points: Point[] };
}

export interface FactorsEntry extends BaseEntry {
  kind: "factors";
  factors: FactorBar[];
}

export type StudyEntry = LineEntry | CandleEntry | VolumeEntry | ScaleEntry | CompareEntry | FactorsEntry;

export const CATEGORY_LABEL: Record<StudyCategory, string> = {
  reversal: "Reversal Patterns",
  continuation: "Continuation Patterns",
  candlestick: "Candlestick Patterns",
  volume: "Volume Reading",
  signals: "Signals, Timeframes & Why We Analyze",
  indicator: "How Bonnco's Indicators Read",
};

export const CATEGORY_BLURB: Record<StudyCategory, string> = {
  reversal: "Shapes that tend to show up at the end of a trend, warning the move is running out of road.",
  continuation: "Pauses inside an existing trend that usually resolve by continuing the same direction.",
  candlestick: "Single or multi-candle shapes traders read for shifts in short-term momentum.",
  volume: "Volume confirms or contradicts what price is doing; it's the conviction behind the move.",
  signals: "What BUY, SELL, and HOLD actually mean, why the same coin can disagree across timeframes, and why Bonnco never trades off a single indicator.",
  indicator: "Exactly how Bonnco's own signal engine scores RSI, MACD, EMA, Bollinger Bands, and support/resistance.",
};

// Reversal/continuation skeletons: the same hand-designed pivot-point shapes as before, now traced
// out as a candle sequence instead of a bare line, per request. perSegment controls candle density.
function candlePattern(skeleton: Point[], perSegment = 3): IllustrativeCandle[] {
  return synthesizeCandles(skeleton, perSegment);
}

const STUDY_ENTRIES: StudyEntry[] = [
  // ---------- REVERSAL ----------
  {
    id: "head-shoulders",
    kind: "candles",
    name: "Head and Shoulders",
    category: "reversal",
    bias: "bearish",
    summary: "Three peaks: a higher middle peak flanked by two lower, roughly equal shoulders, that breaks down through the neckline.",
    howToSpot: [
      "Left shoulder: a peak after an uptrend, followed by a pullback",
      "Head: a higher peak, followed by a deeper pullback to roughly the same level as the first",
      "Right shoulder: a third peak that fails to reach the head's height",
      "Confirmation: price breaks below the neckline (the line connecting the two pullback lows)",
    ],
    meaning: "Buyers tried twice more to push higher after the head and failed both times. That fading momentum is what the pattern is actually measuring, not the shape itself.",
    whatToDo: "Many traders wait for a confirmed close below the neckline before acting, since the pattern can fail if price reclaims it. A stop above the right shoulder and a target roughly the head-to-neckline distance projected downward are common reference points.",
    candles: candlePattern([[0, 60], [15, 25], [28, 55], [45, 8], [62, 55], [75, 25], [88, 65], [100, 88]]),
    referenceLines: [{ y: 55 }],
  },
  {
    id: "inverse-head-shoulders",
    kind: "candles",
    name: "Inverse Head and Shoulders",
    category: "reversal",
    bias: "bullish",
    summary: "The mirror image of Head and Shoulders: three troughs, the middle one deepest, breaking up through the neckline.",
    howToSpot: [
      "Left shoulder: a low after a downtrend, followed by a bounce",
      "Head: a lower low, followed by a bounce back to roughly the same level as the first",
      "Right shoulder: a third low that fails to reach the head's depth",
      "Confirmation: price breaks above the neckline connecting the two bounce highs",
    ],
    meaning: "Sellers pushed price to a new low but couldn't hold it, and the next attempt to sell off failed even sooner. Selling pressure is exhausting itself.",
    whatToDo: "Confirmation typically means a close above the neckline, often alongside rising volume. A stop below the right shoulder low and a target roughly the head-to-neckline distance projected upward are common reference points.",
    candles: candlePattern([[0, 40], [15, 75], [28, 45], [45, 92], [62, 45], [75, 75], [88, 35], [100, 12]]),
    referenceLines: [{ y: 45 }],
  },
  {
    id: "double-top",
    kind: "candles",
    name: "Double Top",
    category: "reversal",
    bias: "bearish",
    summary: "Two peaks at roughly the same level with a moderate pullback between them, then a break below that pullback low.",
    howToSpot: [
      "First peak forms after an uptrend and pulls back",
      "Price rallies again to roughly the same high, and gets rejected a second time",
      "Confirmation: price breaks below the trough between the two peaks",
    ],
    meaning: "The level held twice, and that's real, tested resistance, not a coincidence. A second failed attempt tends to trigger the buyers who bought the first top into exiting.",
    whatToDo: "Traders often wait for a close below the trough between the two peaks before treating it as confirmed, since a single peak can just be normal pullback noise. A stop above the second peak is a typical risk marker.",
    candles: candlePattern([[0, 70], [20, 20], [38, 55], [58, 20], [78, 70], [100, 92]]),
    referenceLines: [{ y: 20 }],
  },
  {
    id: "double-bottom",
    kind: "candles",
    name: "Double Bottom",
    category: "reversal",
    bias: "bullish",
    summary: "Two troughs at roughly the same level with a moderate bounce between them, then a break above that bounce high.",
    howToSpot: [
      "First low forms after a downtrend and bounces",
      "Price sells off again to roughly the same low, and finds buyers a second time",
      "Confirmation: price breaks above the high between the two troughs",
    ],
    meaning: "The level held as support twice. Sellers had two chances to break it and couldn't, which is usually enough for short-covering and fresh buying to take over.",
    whatToDo: "Confirmation usually means a close above the high between the two troughs. A stop below the second trough is a common risk marker.",
    candles: candlePattern([[0, 30], [20, 80], [38, 45], [58, 80], [78, 30], [100, 8]]),
    referenceLines: [{ y: 80 }],
  },
  {
    id: "triple-top",
    kind: "candles",
    name: "Triple Top",
    category: "reversal",
    bias: "bearish",
    summary: "Three peaks at roughly the same level with two pullbacks between them, then a break below the pullback lows.",
    howToSpot: [
      "Three separate rallies to almost the same resistance level, each getting rejected",
      "Two moderate pullbacks between the peaks, at similar depths",
      "Confirmation: price breaks below the lowest of the two pullback lows",
    ],
    meaning: "A level defended three times is a stronger statement than twice; more traders have now watched it hold and are positioned around it.",
    whatToDo: "The third failed attempt at the same resistance is usually treated as stronger confirmation than a double top. A close below the pattern's pullback lows is the typical trigger, with a stop above the highest peak.",
    candles: candlePattern([[0, 70], [15, 20], [30, 50], [45, 20], [60, 50], [75, 20], [88, 70], [100, 92]]),
    referenceLines: [{ y: 20 }],
  },
  {
    id: "triple-bottom",
    kind: "candles",
    name: "Triple Bottom",
    category: "reversal",
    bias: "bullish",
    summary: "Three troughs at roughly the same level with two bounces between them, then a break above the bounce highs.",
    howToSpot: [
      "Three separate sell-offs to almost the same support level, each finding buyers",
      "Two moderate bounces between the troughs, at similar heights",
      "Confirmation: price breaks above the highest of the two bounce highs",
    ],
    meaning: "A level defended three times by buyers is a stronger statement than twice; sellers have had three real chances to break it and failed each time.",
    whatToDo: "The third successful defense of support is usually read as stronger confirmation than a double bottom. A close above the pattern's bounce highs is the typical trigger, with a stop below the lowest trough.",
    candles: candlePattern([[0, 30], [15, 80], [30, 50], [45, 80], [60, 50], [75, 80], [88, 30], [100, 8]]),
    referenceLines: [{ y: 80 }],
  },
  {
    id: "rounding-bottom",
    kind: "candles",
    name: "Rounding Bottom (Saucer)",
    category: "reversal",
    bias: "bullish",
    summary: "A slow, smooth U-shaped decline and recovery, without the sharp V-shape of a typical sell-off and bounce.",
    howToSpot: [
      "A gradual decline that slows down rather than dropping sharply",
      "A rounded, unhurried recovery back toward the starting level",
      "No single dramatic reversal candle; the shape develops over many candles",
    ],
    meaning: "The gradual curve reflects selling pressure fading out slowly rather than snapping. It usually shows up on longer timeframes and reflects a genuine, unhurried shift in sentiment rather than a panic-driven bounce.",
    whatToDo: "Because it forms gradually, traders often wait for a decisive breakout above the pattern's starting level, ideally with rising volume, rather than trying to call the exact bottom of the curve.",
    candles: candlePattern([[0, 25], [15, 45], [30, 65], [45, 80], [55, 82], [65, 80], [80, 60], [90, 35], [100, 12]]),
  },
  {
    id: "rising-wedge",
    kind: "candles",
    name: "Rising Wedge",
    category: "reversal",
    bias: "bearish",
    summary: "Both highs and lows rise, but the lows rise faster, converging into a narrowing upward channel that usually breaks down.",
    howToSpot: [
      "A series of higher highs and higher lows",
      "The distance between the upper and lower trendline visibly narrows",
      "Confirmation: price breaks below the rising lower trendline",
    ],
    meaning: "Even though price keeps making new highs, each new high is weaker and the range is compressing; that's often a sign the buying is running out of strength even as price technically still climbs.",
    whatToDo: "A common approach waits for a close below the lower trendline, since price can grind higher inside the wedge for a while before it actually breaks. A stop above the most recent swing high is typical.",
    candles: candlePattern([[0, 75], [14, 50], [28, 60], [42, 35], [55, 45], [68, 25], [80, 34], [100, 88]]),
  },
  {
    id: "falling-wedge",
    kind: "candles",
    name: "Falling Wedge",
    category: "reversal",
    bias: "bullish",
    summary: "Both highs and lows fall, but the highs fall faster, converging into a narrowing downward channel that usually breaks up.",
    howToSpot: [
      "A series of lower highs and lower lows",
      "The distance between the upper and lower trendline visibly narrows",
      "Confirmation: price breaks above the falling upper trendline",
    ],
    meaning: "Even though price keeps making new lows, each new low is shallower and the range is compressing; that's often a sign selling pressure is running out even as price technically still falls.",
    whatToDo: "A common approach waits for a close above the upper trendline before treating the reversal as confirmed. A stop below the most recent swing low is typical.",
    candles: candlePattern([[0, 25], [14, 50], [28, 40], [42, 65], [55, 55], [68, 75], [80, 66], [100, 12]]),
  },

  // ---------- CONTINUATION ----------
  {
    id: "ascending-triangle",
    kind: "candles",
    name: "Ascending Triangle",
    category: "continuation",
    bias: "bullish",
    summary: "A flat resistance ceiling with rising higher lows underneath it, usually breaking up through the ceiling.",
    howToSpot: [
      "Price repeatedly tests the same horizontal resistance level",
      "Each pullback bottoms out higher than the last, meaning buyers are getting more eager, not less",
      "Confirmation: a breakout candle clears the flat resistance, often on rising volume",
    ],
    meaning: "Sellers are defending one exact price, but buyers keep showing up sooner each time. That's a shrinking supply of sellers meeting a steady stream of buyers.",
    whatToDo: "A break above the flat resistance, ideally with rising volume, is the typical trigger. A stop below the most recent rising low is a common risk marker.",
    candles: candlePattern([[0, 72], [14, 30], [28, 58], [42, 30], [56, 44], [70, 30], [84, 18], [100, 4]]),
    referenceLines: [{ y: 30 }],
  },
  {
    id: "descending-triangle",
    kind: "candles",
    name: "Descending Triangle",
    category: "continuation",
    bias: "bearish",
    summary: "A flat support floor with falling lower highs above it, usually breaking down through the floor.",
    howToSpot: [
      "Price repeatedly tests the same horizontal support level",
      "Each bounce tops out lower than the last, meaning sellers are getting more aggressive, not less",
      "Confirmation: a breakdown candle clears the flat support, often on rising volume",
    ],
    meaning: "Buyers are defending one exact price, but sellers keep showing up sooner each time. Eventually the floor gives way.",
    whatToDo: "A break below the flat support, ideally with rising volume, is the typical trigger. A stop above the most recent falling high is a common risk marker.",
    candles: candlePattern([[0, 28], [14, 70], [28, 42], [42, 70], [56, 56], [70, 70], [84, 82], [100, 96]]),
    referenceLines: [{ y: 70 }],
  },
  {
    id: "symmetrical-triangle",
    kind: "candles",
    name: "Symmetrical Triangle",
    category: "continuation",
    bias: "neutral",
    summary: "Converging highs and lows squeezing into a tighter and tighter range before a decisive breakout, either direction.",
    howToSpot: [
      "Each swing high is lower than the last, and each swing low is higher than the last",
      "The range visibly narrows as the pattern develops",
      "Confirmation: a strong breakout candle out of the narrowing range, in either direction",
    ],
    meaning: "Neither side has an edge yet; the market is compressing. Don't guess the direction, the breakout candle tells you, not the triangle itself.",
    whatToDo: "Since the breakout direction isn't known in advance, many traders wait for the actual breakout candle rather than guessing, with a stop just inside the triangle on the opposite side of the breakout.",
    candles: candlePattern([[0, 10], [15, 85], [30, 22], [45, 70], [58, 35], [70, 58], [80, 44], [100, 8]]),
  },
  {
    id: "bull-flag",
    kind: "candles",
    name: "Bull Flag",
    category: "continuation",
    bias: "bullish",
    summary: "A sharp rally (the flagpole) followed by a tight, mild pullback drifting sideways-to-down (the flag), then continuation.",
    howToSpot: [
      "A strong, fast move up: the flagpole",
      "A calm, shallow pullback in a narrow channel: the flag",
      "Confirmation: price breaks out of the flag's upper edge, resuming the original direction",
    ],
    meaning: "The pullback is profit-taking, not a change of mind: it's orderly and shallow rather than panicked. That's the market catching its breath before continuing.",
    whatToDo: "A break above the flag's upper trendline, often with a pickup in volume, is the typical continuation trigger. A stop below the flag's low is common.",
    candles: candlePattern([[0, 90], [25, 15], [38, 26], [50, 20], [62, 30], [74, 25], [85, 12], [100, 2]]),
  },
  {
    id: "bear-flag",
    kind: "candles",
    name: "Bear Flag",
    category: "continuation",
    bias: "bearish",
    summary: "A sharp drop (the flagpole) followed by a tight, mild bounce drifting sideways-to-up (the flag), then continuation lower.",
    howToSpot: [
      "A strong, fast move down: the flagpole",
      "A calm, shallow bounce in a narrow channel: the flag",
      "Confirmation: price breaks out of the flag's lower edge, resuming the original direction",
    ],
    meaning: "The bounce is short-covering, not fresh buying conviction: orderly and shallow rather than a real reversal attempt.",
    whatToDo: "A break below the flag's lower trendline, often with a pickup in volume, is the typical continuation trigger. A stop above the flag's high is common.",
    candles: candlePattern([[0, 10], [25, 85], [38, 74], [50, 80], [62, 70], [74, 75], [85, 88], [100, 98]]),
  },
  {
    id: "cup-and-handle",
    kind: "candles",
    name: "Cup and Handle",
    category: "continuation",
    bias: "bullish",
    summary: "A smooth, rounded U-shaped pullback and recovery (the cup), followed by a small dip near the old high (the handle), then breakout.",
    howToSpot: [
      "A gradual, rounded decline and recovery back to near the starting level, not a sharp V",
      "A brief, shallow pullback right near the old high: the handle",
      "Confirmation: a breakout above the old high / handle resistance",
    ],
    meaning: "The rounded shape shows selling pressure gradually fading rather than snapping. The handle is the last bit of hesitation before buyers commit.",
    whatToDo: "Confirmation typically comes on a breakout above the handle's resistance. A stop below the handle's low is a common risk marker.",
    candles: candlePattern([[0, 30], [15, 55], [30, 75], [45, 85], [60, 75], [75, 55], [85, 32], [92, 45], [97, 38], [100, 8]]),
  },
  {
    id: "rectangle",
    kind: "candles",
    name: "Rectangle (Trading Range)",
    category: "continuation",
    bias: "neutral",
    summary: "Price oscillates between a flat support floor and a flat resistance ceiling for an extended stretch, then breaks out.",
    howToSpot: [
      "At least two touches each of a well-defined horizontal support and resistance level",
      "Price bounces between the two levels without a clear trend inside the range",
      "Confirmation: a decisive close outside either boundary",
    ],
    meaning: "Neither buyers nor sellers control the range yet; it's a standoff. The eventual breakout direction tends to carry real weight since it resolves a range everyone has been watching.",
    whatToDo: "Traders often treat the range boundaries as tradeable in both directions until a genuine breakout occurs, ideally on a volume increase, with a stop just inside the range on the breakout side.",
    candles: candlePattern([[0, 70], [15, 30], [30, 68], [45, 32], [60, 68], [75, 30], [88, 15], [100, 5]]),
    referenceLines: [{ y: 30 }, { y: 68 }],
  },
  {
    id: "pennant",
    kind: "candles",
    name: "Pennant",
    category: "continuation",
    bias: "bullish",
    summary: "A sharp move (the flagpole) followed by a small, tightly converging triangular consolidation (the pennant), then continuation.",
    howToSpot: [
      "A strong, fast directional move: the flagpole",
      "A small symmetrical-triangle-like consolidation right after it, converging quickly",
      "Confirmation: a breakout in the direction of the original flagpole move",
    ],
    meaning: "Similar to a flag, but the pause converges to a point rather than drifting in a channel; either way it's a brief pause, not a reversal, inside a strong move.",
    whatToDo: "Similar to a flag: a breakout from the small converging pennant in the direction of the flagpole is the typical trigger, with a stop on the opposite side of the pennant.",
    candles: candlePattern([[0, 90], [22, 15], [35, 30], [48, 20], [58, 28], [66, 22], [80, 10], [100, 2]]),
  },

  // ---------- CANDLESTICK ----------
  {
    id: "doji",
    kind: "candles",
    name: "Doji",
    category: "candlestick",
    bias: "neutral",
    summary: "Open and close land almost at the same price, leaving a tiny body with wicks on one or both sides.",
    howToSpot: ["Body is razor-thin: the market opened and closed at nearly the same price", "Wicks can be long or short on either side"],
    meaning: "Neither buyers nor sellers won the candle: a tug-of-war that ended in a draw. On its own it's indecision; it matters most after a strong trend, where it can flag hesitation.",
    whatToDo: "On its own it's not a signal to act on; most traders wait to see what the next candle does before treating it as meaningful, especially after an extended trend.",
    candles: [{ open: 48, high: 20, low: 78, close: 50 }],
  },
  {
    id: "hammer",
    kind: "candles",
    name: "Hammer",
    category: "candlestick",
    bias: "bullish",
    summary: "A small body near the top of the range with a long lower wick: sellers pushed price down hard, but buyers dragged it back up.",
    howToSpot: ["Appears after a downtrend", "Small body near the top of the candle's range", "Lower wick at least twice the length of the body", "Little to no upper wick"],
    meaning: "Price was sold off sharply within the candle, but buyers stepped in and clawed almost all of it back before the close, a real shift in who's in control.",
    whatToDo: "Many traders wait for the next candle to confirm (a close above the hammer's body) before treating the reversal as real, since a hammer alone can still be followed by more downside.",
    candles: [{ open: 42, high: 28, low: 92, close: 32 }],
  },
  {
    id: "shooting-star",
    kind: "candles",
    name: "Shooting Star",
    category: "candlestick",
    bias: "bearish",
    summary: "A small body near the bottom of the range with a long upper wick: buyers pushed price up hard, but sellers dragged it back down.",
    howToSpot: ["Appears after an uptrend", "Small body near the bottom of the candle's range", "Upper wick at least twice the length of the body", "Little to no lower wick"],
    meaning: "Price rallied sharply within the candle, but sellers took it almost all back before the close. Buyers lost control right at the top.",
    whatToDo: "Similar to a hammer, many traders wait for the next candle to confirm (a close below the shooting star's body) before treating the reversal as real.",
    candles: [{ open: 68, high: 15, low: 72, close: 70 }],
  },
  {
    id: "bullish-engulfing",
    kind: "candles",
    name: "Bullish Engulfing",
    category: "candlestick",
    bias: "bullish",
    summary: "A small red candle followed by a larger green candle whose body fully swallows the prior candle's body.",
    howToSpot: ["First candle: small body, closes lower (red)", "Second candle: opens below the first's close, closes above the first's open, a bigger green body that engulfs it"],
    meaning: "Buyers didn't just stop the decline. They reversed the entire prior candle's move and then some, in a single session. That's a decisive shift in momentum.",
    whatToDo: "Often treated as a stronger, faster-acting signal than a hammer since the reversal is confirmed within the same session. A stop below the pattern's low is a common risk marker.",
    candles: [{ open: 40, high: 32, low: 58, close: 52 }, { open: 58, high: 22, low: 62, close: 26 }],
  },
  {
    id: "bearish-engulfing",
    kind: "candles",
    name: "Bearish Engulfing",
    category: "candlestick",
    bias: "bearish",
    summary: "A small green candle followed by a larger red candle whose body fully swallows the prior candle's body.",
    howToSpot: ["First candle: small body, closes higher (green)", "Second candle: opens above the first's close, closes below the first's open, a bigger red body that engulfs it"],
    meaning: "Sellers erased the entire prior candle's gain and then some, in a single session. Buyers who chased the first candle are now underwater immediately.",
    whatToDo: "Often treated as a stronger, faster-acting signal than a shooting star since the reversal is confirmed within the same session. A stop above the pattern's high is a common risk marker.",
    candles: [{ open: 60, high: 44, low: 68, close: 48 }, { open: 46, high: 42, low: 82, close: 78 }],
  },
  {
    id: "piercing-line",
    kind: "candles",
    name: "Piercing Line",
    category: "candlestick",
    bias: "bullish",
    summary: "A red candle followed by a green candle that opens lower but closes back above the midpoint of the red candle's body.",
    howToSpot: ["First candle: a solid red body continuing a downtrend", "Second candle: opens at or below the first's low, then rallies to close above the midpoint of the first's body"],
    meaning: "The second candle recovers more than half of the prior decline within a single session, without fully engulfing it. A real, if slightly less forceful, shift in control.",
    whatToDo: "A useful early bullish signal, generally considered a bit less decisive than a bullish engulfing since it doesn't fully close above the prior candle's open.",
    candles: [{ open: 40, high: 35, low: 70, close: 65 }, { open: 70, high: 42, low: 72, close: 46 }],
  },
  {
    id: "dark-cloud-cover",
    kind: "candles",
    name: "Dark Cloud Cover",
    category: "candlestick",
    bias: "bearish",
    summary: "A green candle followed by a red candle that opens higher but closes back below the midpoint of the green candle's body.",
    howToSpot: ["First candle: a solid green body continuing an uptrend", "Second candle: opens at or above the first's high, then sells off to close below the midpoint of the first's body"],
    meaning: "The second candle erases more than half of the prior rally within a single session, without fully engulfing it. A real, if slightly less forceful, shift in control.",
    whatToDo: "A useful early bearish signal, generally considered a bit less decisive than a bearish engulfing since it doesn't fully close below the prior candle's open.",
    candles: [{ open: 65, high: 33, low: 70, close: 38 }, { open: 28, high: 24, low: 62, close: 58 }],
  },
  {
    id: "morning-star",
    kind: "candles",
    name: "Morning Star",
    category: "candlestick",
    bias: "bullish",
    summary: "A large red candle, a small indecisive candle that gaps lower, then a large green candle that closes back into the first candle's body.",
    howToSpot: [
      "Candle 1: a strong red candle continuing a downtrend",
      "Candle 2: a small body (often a doji-like candle), gapping down from candle 1",
      "Candle 3: a strong green candle closing well into candle 1's body",
    ],
    meaning: "The selling pressure that drove candle 1 stalls out completely on candle 2, then buyers take firm control on candle 3: a three-session story of a trend losing steam, then reversing.",
    whatToDo: "The third candle is what confirms the pattern; many traders wait for it to close before acting, rather than assuming the reversal from the first two candles alone.",
    candles: [{ open: 22, high: 18, low: 80, close: 78 }, { open: 84, high: 80, low: 90, close: 86 }, { open: 88, high: 30, low: 90, close: 35 }],
  },
  {
    id: "evening-star",
    kind: "candles",
    name: "Evening Star",
    category: "candlestick",
    bias: "bearish",
    summary: "A large green candle, a small indecisive candle that gaps higher, then a large red candle that closes back into the first candle's body.",
    howToSpot: [
      "Candle 1: a strong green candle continuing an uptrend",
      "Candle 2: a small body (often a doji-like candle), gapping up from candle 1",
      "Candle 3: a strong red candle closing well into candle 1's body",
    ],
    meaning: "The buying pressure that drove candle 1 stalls out completely on candle 2, then sellers take firm control on candle 3: a three-session story of a trend losing steam, then reversing.",
    whatToDo: "The third candle is what confirms the pattern; many traders wait for it to close before acting, rather than assuming the reversal from the first two candles alone.",
    candles: [{ open: 78, high: 18, low: 82, close: 22 }, { open: 16, high: 10, low: 20, close: 14 }, { open: 18, high: 14, low: 70, close: 65 }],
  },
  {
    id: "three-white-soldiers",
    kind: "candles",
    name: "Three White Soldiers",
    category: "candlestick",
    bias: "bullish",
    summary: "Three consecutive strong green candles, each opening within the prior body and closing at a fresh, higher high.",
    howToSpot: ["Three green candles in a row", "Each opens within (or very near) the previous candle's body", "Each closes higher than the last, with fairly small wicks"],
    meaning: "Three straight sessions of sustained buying with little hesitation between them is read as a fairly firm statement that buyers are in control.",
    whatToDo: "A fairly firm bullish signal, though traders often watch for shrinking bodies or long upper wicks on the third candle as an early warning the run is getting overextended.",
    candles: [{ open: 82, high: 68, low: 85, close: 72 }, { open: 75, high: 50, low: 78, close: 55 }, { open: 58, high: 30, low: 61, close: 35 }],
  },
  {
    id: "three-black-crows",
    kind: "candles",
    name: "Three Black Crows",
    category: "candlestick",
    bias: "bearish",
    summary: "Three consecutive strong red candles, each opening within the prior body and closing at a fresh, lower low.",
    howToSpot: ["Three red candles in a row", "Each opens within (or very near) the previous candle's body", "Each closes lower than the last, with fairly small wicks"],
    meaning: "Three straight sessions of sustained selling with little hesitation between them is read as a fairly firm statement that sellers are in control.",
    whatToDo: "A fairly firm bearish signal, though traders often watch for shrinking bodies or long lower wicks on the third candle as an early warning the decline is getting overextended.",
    candles: [{ open: 25, high: 20, low: 48, close: 45 }, { open: 42, high: 38, low: 65, close: 62 }, { open: 59, high: 55, low: 83, close: 80 }],
  },
  {
    id: "bullish-harami",
    kind: "candles",
    name: "Bullish Harami",
    category: "candlestick",
    bias: "bullish",
    summary: "A large red candle followed by a small green candle whose entire body sits inside the prior candle's body.",
    howToSpot: ["First candle: a large red body continuing a downtrend", "Second candle: a small green body, fully contained within the first candle's range"],
    meaning: "The sudden shrink in range shows the selling pressure has abruptly stalled, even if buyers haven't taken control yet. A pause worth watching, not yet a full reversal.",
    whatToDo: "A milder signal than an engulfing pattern; often treated as an early hint of slowing downside momentum rather than a firm reversal on its own.",
    candles: [{ open: 30, high: 25, low: 80, close: 75 }, { open: 60, high: 45, low: 63, close: 48 }],
  },
  {
    id: "bearish-harami",
    kind: "candles",
    name: "Bearish Harami",
    category: "candlestick",
    bias: "bearish",
    summary: "A large green candle followed by a small red candle whose entire body sits inside the prior candle's body.",
    howToSpot: ["First candle: a large green body continuing an uptrend", "Second candle: a small red body, fully contained within the first candle's range"],
    meaning: "The sudden shrink in range shows the buying pressure has abruptly stalled, even if sellers haven't taken control yet. A pause worth watching, not yet a full reversal.",
    whatToDo: "A milder signal than an engulfing pattern; often treated as an early hint of slowing upside momentum rather than a firm reversal on its own.",
    candles: [{ open: 75, high: 25, low: 80, close: 30 }, { open: 48, high: 45, low: 63, close: 60 }],
  },
  {
    id: "tweezer-top",
    kind: "candles",
    name: "Tweezer Top",
    category: "candlestick",
    bias: "bearish",
    summary: "Two candles with nearly matching highs, back to back, at the top of a rally.",
    howToSpot: ["A green (or any) candle with a clear high", "Followed by a red candle whose high matches the first almost exactly"],
    meaning: "The exact same price got rejected on two separate attempts right next to each other; that's a sharply defined resistance point, not a vague zone.",
    whatToDo: "The matching highs are read as a rejection of that exact price level; often given more weight when it lines up with a known resistance zone from prior price history.",
    candles: [{ open: 55, high: 26, low: 60, close: 30 }, { open: 32, high: 27, low: 63, close: 58 }],
  },
  {
    id: "tweezer-bottom",
    kind: "candles",
    name: "Tweezer Bottom",
    category: "candlestick",
    bias: "bullish",
    summary: "Two candles with nearly matching lows, back to back, at the bottom of a decline.",
    howToSpot: ["A red (or any) candle with a clear low", "Followed by a green candle whose low matches the first almost exactly"],
    meaning: "The exact same price found buyers on two separate attempts right next to each other; that's a sharply defined support point, not a vague zone.",
    whatToDo: "The matching lows are read as a defense of that exact price level; often given more weight when it lines up with a known support zone from prior price history.",
    candles: [{ open: 30, high: 26, low: 60, close: 55 }, { open: 58, high: 28, low: 59, close: 32 }],
  },
  {
    id: "marubozu",
    kind: "candles",
    name: "Marubozu",
    category: "candlestick",
    bias: "bullish",
    summary: "A single, strong candle with a full body and little to no wick on either end.",
    howToSpot: ["The open and high are the same (bullish) or the open and low are the same (bearish)", "The close and low are the same (bullish) or the close and high are the same (bearish)", "No meaningful wicks at all"],
    meaning: "The candle traded in one direction essentially the entire session, opening at (or near) one extreme and closing at (or near) the other. No hesitation, no pullback within the candle.",
    whatToDo: "A strong, one-sided candle like this is usually read as a clear statement of control by one side; several in a row in the same direction is often taken as a sign of a firmly trending market.",
    candles: [{ open: 75, high: 22, low: 75, close: 22 }],
  },
  {
    id: "spinning-top",
    kind: "candles",
    name: "Spinning Top",
    category: "candlestick",
    bias: "neutral",
    summary: "A small body with roughly equal-length wicks on both sides, showing a real (if small) net move but a lot of back-and-forth within the candle.",
    howToSpot: ["Small body, similar to a doji but not quite as thin", "Upper and lower wicks are roughly the same length"],
    meaning: "Both buyers and sellers pushed price around during the session, but neither could hold their ground; the net result was a small, indecisive move.",
    whatToDo: "Similar to a doji, the small body with wicks on both sides usually just signals hesitation, worth noting but not usually acted on by itself.",
    candles: [{ open: 48, high: 30, low: 72, close: 54 }],
  },

  // ---------- VOLUME ----------
  {
    id: "volume-confirms-trend",
    kind: "volume",
    name: "Volume Confirms the Trend",
    category: "volume",
    bias: "bullish",
    summary: "Price rising alongside rising volume: participation is growing with the move, not shrinking.",
    howToSpot: ["Each new high is accompanied by volume equal to or greater than the prior push", "No visible fading of participation as price extends"],
    meaning: "This is the healthy version of a trend: more traders are actually involved as price goes higher, which is exactly what Bonnco's volume score treats as confirming a move rather than warning on it.",
    whatToDo: "Rising volume alongside a trend is generally read as supportive of staying with the move, rather than fading it.",
    pricePoints: [[0, 70], [25, 55], [50, 42], [75, 28], [100, 15]],
    bars: [{ volume: 30, tone: "neutral" }, { volume: 40, tone: "confirm" }, { volume: 55, tone: "confirm" }, { volume: 70, tone: "confirm" }, { volume: 85, tone: "confirm" }],
  },
  {
    id: "volume-divergence",
    kind: "volume",
    name: "Volume Divergence",
    category: "volume",
    bias: "bearish",
    summary: "Price still making new highs, but volume on each push is getting smaller. Fewer people are actually buying the move.",
    howToSpot: ["Price trend continues upward", "Volume trend is flat or declining across the same stretch", "Often shows up in the final leg of an extended move"],
    meaning: "The move is running on fewer and fewer real buyers. It can keep going for a while on thin participation, but it's the kind of setup that reverses hard once it runs out of willing buyers.",
    whatToDo: "Fading volume during a continuing trend is often treated as an early warning sign, worth tightening risk management on even before price itself shows any weakness.",
    pricePoints: [[0, 70], [25, 55], [50, 42], [75, 30], [100, 20]],
    bars: [{ volume: 80, tone: "neutral" }, { volume: 65, tone: "warn" }, { volume: 50, tone: "warn" }, { volume: 35, tone: "warn" }, { volume: 20, tone: "warn" }],
  },
  {
    id: "breakout-volume-spike",
    kind: "volume",
    name: "Breakout Volume Spike",
    category: "volume",
    bias: "bullish",
    summary: "Price finally clears a range, and the breakout candle arrives with a sudden, outsized volume spike.",
    howToSpot: ["Price has been range-bound for several candles with unremarkable volume", "The breakout candle's volume is visibly, sharply larger than the recent average"],
    meaning: "This is the same 2x-the-20-candle-average spike Bonnco's own volume score looks for: real participation showed up right when it mattered, which is what separates a breakout that holds from one that immediately fails.",
    whatToDo: "A genuine volume spike on the breakout candle is generally treated as adding credibility to the breakout, versus a breakout on unremarkable volume, which is more prone to failing and reversing.",
    pricePoints: [[0, 55], [25, 58], [50, 52], [75, 56], [100, 15]],
    bars: [{ volume: 25, tone: "neutral" }, { volume: 28, tone: "neutral" }, { volume: 22, tone: "neutral" }, { volume: 26, tone: "neutral" }, { volume: 92, tone: "confirm" }],
  },
  {
    id: "climax-volume",
    kind: "volume",
    name: "Climax Volume (Exhaustion)",
    category: "volume",
    bias: "bearish",
    summary: "An extended, mature move suddenly gets a massive volume spike, often the last gasp of buying, not the start of something new.",
    howToSpot: ["Price has already run a long way in one direction", "A single candle shows dramatically higher volume than anything before it in the move", "Often paired with a long wick as the move reverses intra-candle"],
    meaning: "Late in a move, a huge volume spike usually means the last wave of buyers (often the ones who were waiting on the sidelines) just piled in all at once, which tends to mean there's no one left to buy the next leg.",
    whatToDo: "An unusually large volume spike late in an extended move is often treated as a caution flag worth watching for follow-through weakness, rather than a reason to chase the move further.",
    pricePoints: [[0, 80], [25, 60], [50, 42], [75, 25], [100, 10]],
    bars: [{ volume: 30, tone: "neutral" }, { volume: 35, tone: "neutral" }, { volume: 40, tone: "neutral" }, { volume: 45, tone: "neutral" }, { volume: 95, tone: "warn" }],
  },
  {
    id: "volume-dry-up",
    kind: "volume",
    name: "Volume Dry-Up Before Breakout",
    category: "volume",
    bias: "neutral",
    summary: "Volume shrinks to unusually low levels during a tight consolidation, right before price eventually breaks out.",
    howToSpot: ["Price trades in an increasingly narrow range", "Volume steadily declines across the consolidation, well below the recent average"],
    meaning: "Fewer and fewer traders are actively involved while the range tightens; the market is quietly building potential energy rather than losing interest entirely.",
    whatToDo: "A period of unusually low volume right before a potential breakout is sometimes read as coiled energy: fewer active participants, which can set up a sharper move once one side finally commits.",
    pricePoints: [[0, 50], [25, 48], [50, 52], [75, 49], [100, 51]],
    bars: [{ volume: 55, tone: "neutral" }, { volume: 40, tone: "neutral" }, { volume: 28, tone: "warn" }, { volume: 18, tone: "warn" }, { volume: 12, tone: "warn" }],
  },

  // ---------- SIGNALS, TIMEFRAMES & CONFLUENCE ----------
  {
    id: "signal-states",
    kind: "scale",
    name: "Understanding STRONG_BUY / BUY / HOLD / SELL / STRONG_SELL",
    category: "signals",
    bias: "neutral",
    summary: "Bonnco's combined score runs from -1 (max bearish) to +1 (max bullish). Where it lands relative to your risk profile's thresholds decides which of the five calls you see.",
    howToSpot: [
      "The combined score blends the six technical factors and 24-hour news sentiment",
      "The width of the HOLD zone is set by your risk profile in Settings",
      "STRONG_ only triggers past the strong threshold, which is also set by risk profile",
    ],
    meaning: "A HOLD isn't a failure to produce an answer. It's the engine saying the evidence doesn't clear the bar you've set for taking a side. A conservative profile sets a wide bar; an aggressive profile sets a narrow one.",
    whatToDo: "Switching risk profile in Settings moves these zone boundaries, not the underlying combined score itself, which is why the same market conditions can show HOLD under conservative and BUY under moderate.",
    zones: [
      { label: "STRONG SELL", from: -1, to: -0.6, color: "#ef4444" },
      { label: "SELL", from: -0.6, to: -0.2, color: "#ef4444" },
      { label: "HOLD", from: -0.2, to: 0.2, color: "#eab308" },
      { label: "BUY", from: 0.2, to: 0.6, color: "#22c55e" },
      { label: "STRONG BUY", from: 0.6, to: 1, color: "#22c55e" },
    ],
    scaleMin: -1,
    scaleMax: 1,
    marker: 0.35,
    markerLabel: "Example: +0.35",
  },
  {
    id: "timeframe-changes-signal",
    kind: "compare",
    name: "Why the Same Coin Shows Different Signals by Timeframe",
    category: "signals",
    bias: "neutral",
    summary: "The same stretch of trading can look like directionless noise on a 5-minute chart and a clean trend on a 1-day chart, because each timeframe is measuring a different question.",
    howToSpot: [
      "Short timeframes (5m, 15m) react to every small swing; useful for entry timing, prone to false signals",
      "Long timeframes (4h, 1D) smooth out the noise and reveal the dominant trend, but react slowly",
    ],
    meaning: "Neither view is wrong; they're answering different questions: what's happening right now, versus where this is actually headed. A coin can legitimately be BUY on the 1h chart and HOLD on the 5m chart at the same moment.",
    whatToDo: "Many traders check a longer timeframe first to confirm the overall trend direction, then use a shorter timeframe on the same coin to time entries within that trend, rather than picking one timeframe and ignoring the rest.",
    top: { label: "5-minute view (choppy)", points: [[0, 50], [8, 35], [16, 60], [24, 40], [32, 65], [40, 45], [48, 55], [56, 38], [64, 58], [72, 42], [80, 52], [88, 60], [100, 48]] },
    bottom: { label: "1-day view, same period (clear trend)", points: [[0, 80], [25, 62], [50, 48], [75, 30], [100, 15]] },
  },
  {
    id: "choosing-a-timeframe",
    kind: "scale",
    name: "Choosing a Timeframe for Your Trading Style",
    category: "signals",
    bias: "neutral",
    summary: "Shorter timeframes suit faster, more active trading; longer timeframes suit patience-based trading with fewer, higher-conviction decisions.",
    howToSpot: [
      "Scalping (5m-15m): many trades per day, small moves, needs constant attention",
      "Day trading (1h): a handful of trades per day, holds for hours",
      "Swing trading (4h-1D): a few trades per week, holds for days to weeks",
    ],
    meaning: "There's no single correct timeframe. It depends on how much time you can actively watch the market and how much noise versus signal you're willing to tolerate.",
    whatToDo: "Bonnco's dashboard timeframe selector lets you match the signal to your own trading style rather than defaulting to whichever timeframe happens to be selected.",
    zones: [
      { label: "SCALPING 5m-15m", from: 0, to: 33, color: "#3b82f6" },
      { label: "DAY TRADING 1h", from: 33, to: 66, color: "#3b82f6" },
      { label: "SWING TRADING 4h-1D", from: 66, to: 100, color: "#3b82f6" },
    ],
    scaleMin: 0,
    scaleMax: 100,
  },
  {
    id: "why-confluence",
    kind: "factors",
    name: "Why Bonnco Combines Multiple Factors (Confluence)",
    category: "signals",
    bias: "neutral",
    summary: "Bonnco never trades off one indicator. It sums six independent technical factors, plus news sentiment, into a single combined score, so no single reading can dictate the whole call.",
    howToSpot: [
      "Each factor contributes its own small, capped score, positive or negative",
      "A fresh EMA or MACD crossover carries more weight than a static reading",
      "The technical total is blended 70/30 with 24-hour news sentiment",
    ],
    meaning: "One overbought RSI reading, on its own, moves the total by at most 1 point out of a possible 7. Real confluence, several factors agreeing, is what actually drives a strong call.",
    whatToDo: "When the full signal reasoning shows multiple bullish (or bearish) factors agreeing, that's read as more reliable than any single strong-looking factor fighting against several disagreeing ones.",
    factors: [
      { label: "RSI", value: 0 },
      { label: "MACD", value: 2 },
      { label: "EMA", value: 1 },
      { label: "Bollinger", value: -0.3 },
      { label: "Volume", value: 0.5 },
      { label: "S/R", value: 0 },
    ],
  },
  {
    id: "reading-confidence",
    kind: "scale",
    name: "Reading the Confidence Percentage",
    category: "signals",
    bias: "neutral",
    summary: "Confidence is derived directly from how far the combined score sits from zero, capped at 95%, and reduced by 5 points when there's no coin-specific news to corroborate it.",
    howToSpot: [
      "A stronger combined score (further from zero) produces a higher confidence percentage",
      "Confidence never exceeds 95%, since Bonnco never claims certainty",
      "Missing news sentiment for a coin shaves 5 points off, reflecting the extra uncertainty",
    ],
    meaning: "Confidence isn't a probability of being right. It's a measure of how much the underlying evidence agrees, both direction and strength, across all six technical factors plus sentiment.",
    whatToDo: "A HOLD at 49% confidence and a BUY at 61% confidence reflect a real difference in how much the evidence agreed, not two arbitrary numbers.",
    zones: [
      { label: "LOW 30-55%", from: 30, to: 55, color: "#3b82f6" },
      { label: "MODERATE 55-75%", from: 55, to: 75, color: "#3b82f6" },
      { label: "HIGH 75-95%", from: 75, to: 95, color: "#3b82f6" },
    ],
    scaleMin: 30,
    scaleMax: 95,
    marker: 61,
    markerLabel: "Example: 61%",
  },

  // ---------- INDICATOR (mirrors signal_engine.py exactly) ----------
  {
    id: "rsi-zones",
    kind: "line",
    name: "RSI: Overbought / Oversold",
    category: "indicator",
    bias: "neutral",
    summary: "RSI oscillates 0-100. Bonnco calls anything at or above 70 overbought and at or below 30 oversold; everything between is neutral.",
    howToSpot: ["RSI pushing into the top zone (70+) after a strong rally", "RSI pushing into the bottom zone (30-) after a strong decline"],
    meaning: "Overbought/oversold isn't an automatic reversal signal. It means the recent move has been unusually fast relative to the last 14 candles. Bonnco's engine scores 70+ as a bearish RSI factor (-1.0) and 30- as bullish (+1.0), feeding into the combined call alongside every other indicator, never on its own.",
    whatToDo: "Bonnco never acts on RSI alone; it's one of six factors combined into the overall call, which is why an overbought reading during a strong uptrend doesn't automatically flip the signal to SELL.",
    points: [[0, 55], [15, 22], [30, 50], [45, 35], [58, 65], [72, 85], [86, 60], [100, 45]],
    referenceLines: [{ y: 30 }, { y: 70 }],
  },
  {
    id: "macd-crossover",
    kind: "line",
    name: "MACD Crossover",
    category: "indicator",
    bias: "bullish",
    summary: "Two lines: the MACD line and its signal line. When MACD crosses above the signal, that's a bullish crossover; below is bearish.",
    howToSpot: ["The faster MACD line (colored) crossing above or below the slower signal line (grey)", "A fresh crossover carries more weight than a line that's already been above/below for a while"],
    meaning: "This is scored directly: a fresh bullish crossover is worth +2.0 in Bonnco's technical score, versus +1.0 for just already being above signal, because a crossover that just happened is genuinely new information, not stale momentum.",
    whatToDo: "A fresh crossover is weighted more heavily than a stale one that's been sitting above or below the signal line for a while, since new crossovers carry more information about a genuine momentum shift.",
    points: [[0, 65], [20, 58], [40, 68], [55, 50], [70, 42], [85, 55], [100, 38]],
    secondaryPoints: [[0, 58], [20, 60], [40, 58], [55, 56], [70, 54], [85, 50], [100, 48]],
  },
  {
    id: "ema-crossover",
    kind: "line",
    name: "EMA Crossover (9 / 21)",
    category: "indicator",
    bias: "bullish",
    summary: "The fast EMA9 (colored) crossing above the slower EMA21 (grey) signals short-term momentum turning up; crossing below signals it turning down.",
    howToSpot: ["EMA9 crossing through EMA21", "Where price sits relative to EMA50 and EMA200 for the longer-term trend context"],
    meaning: "A fresh EMA9/21 crossover is Bonnco's single highest-weighted technical factor at plus or minus 2.0, since short-term trend shifts tend to lead price, which is why it's weighted above RSI or Bollinger Band positioning.",
    whatToDo: "This being Bonnco's highest-weighted technical factor means a fresh EMA9/21 crossover can move the combined score meaningfully on its own, though it's still balanced against the other five factors before a call is made.",
    points: [[0, 70], [25, 55], [50, 35], [75, 20], [100, 10]],
    secondaryPoints: [[0, 60], [25, 58], [50, 50], [75, 40], [100, 30]],
  },
  {
    id: "bollinger-bands",
    kind: "line",
    name: "Bollinger Bands",
    category: "indicator",
    bias: "neutral",
    summary: "A price envelope built from volatility. Riding the upper band can mean strength or exhaustion; context decides which.",
    howToSpot: ["Price hugging or poking above the upper band", "Price hugging or poking below the lower band", "How wide the bands are: narrow bands mean low volatility, often before a big move"],
    meaning: "Bonnco doesn't treat riding the upper band as automatically bearish. It only penalizes it when RSI is also overbought or price has spiked hard away from its EMA9. A steady uptrend quietly walking the upper band with normal RSI actually scores as mild strength, not exhaustion.",
    whatToDo: "Bonnco specifically avoids penalizing a steady uptrend riding the upper band when RSI isn't also overbought, treating context (not just band position) as what actually matters.",
    points: [[0, 40], [25, 35], [50, 30], [75, 15], [100, 7]],
    band: { upper: [[0, 20], [25, 15], [50, 18], [75, 10], [100, 8]], lower: [[0, 60], [25, 58], [50, 55], [75, 50], [100, 48]] },
  },
  {
    id: "support-resistance",
    kind: "line",
    name: "Support & Resistance",
    category: "indicator",
    bias: "neutral",
    summary: "Price levels where it has previously reversed: support below current price, resistance above it.",
    howToSpot: ["A level price has bounced off more than once (support)", "A level price has been rejected from more than once (resistance)", "How close current price is to the nearest of either"],
    meaning: "Bonnco finds these levels from actual swing highs/lows in the candle history, then scores a small bullish factor (+0.5) when price is within 1% of support, and a small bearish factor (-0.5) within 1% of resistance. Proximity to a real, tested level matters, not just any round number.",
    whatToDo: "Bonnco only scores proximity to real, previously-tested swing highs and lows found in the candle history, not arbitrary round numbers, which is why this factor can sit at zero for long stretches when price isn't near either.",
    points: [[0, 50], [15, 75], [30, 50], [45, 75], [60, 45], [75, 25], [90, 45], [100, 60]],
    referenceLines: [{ y: 75 }, { y: 25 }],
  },
];

export function allStudyEntries(): StudyEntry[] {
  return STUDY_ENTRIES;
}
