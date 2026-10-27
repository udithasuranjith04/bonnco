// Plain-language trading fundamentals and step-by-step guides for the Study page. This is
// educational reference content, not financial advice, and never promises a profit outcome.
// The Binance navigation steps below were checked against Binance's own support and academy
// articles (Trade > Spot / Trade > Futures, order book left, order form below chart, Futures
// account activation quiz, USDⓈ-M wallet transfer) rather than written from memory alone.

import { bonncoColors } from "../theme/theme";
import { synthesizeCandles } from "./synthesizeCandles";
import type { IllustrativeCandle } from "../components/CandlestickDiagram";

const bullishRef = bonncoColors.bullish;
const bearishRef = bonncoColors.bearish;
const neutralRef = bonncoColors.neutral;

export type FundamentalId =
  | "what-is-crypto-trading"
  | "spot-trading"
  | "futures-trading"
  | "spot-vs-futures"
  | "long-vs-short"
  | "leverage-margin"
  | "liquidation"
  | "order-types"
  | "profit-loss"
  | "fees"
  | "risk-management"
  | "chart-types-overview"
  | "reading-a-candlestick"
  | "binance-vs-bybit-view"
  | "indicator-name-glossary"
  | "binance-trading-tools"
  | "candlestick-combinations"
  | "trend-structure"
  | "support-resistance-visual"
  | "chart-drawing-tools"
  | "reading-a-live-chart"
  | "further-learning-resources"
  | "course-readiness"
  | "course-analysis-checklist"
  | "course-position-sizing"
  | "course-entry-timing"
  | "course-holding-periods"
  | "course-volatility"
  | "course-when-not-to-trade"
  | "course-buy-sell-practice"
  | "course-portfolio-approach";

export interface ContentSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export type FundamentalVisual =
  | "long-short"
  | "leverage"
  | "spot-vs-futures-table"
  | "order-types-table"
  | "liquidation-scale"
  | "chart-gallery"
  | "candle-anatomy"
  | "indicator-glossary-table"
  | "platform-layout"
  | "platform-layout-futures"
  | "trend-line"
  | "fibonacci"
  | "trend-structure"
  | "support-resistance"
  | "position-calculator"
  | "volatility-compare";

export interface CompareTableData {
  columns: string[];
  rows: { label: string; values: string[] }[];
}

export interface ScaleData {
  zones: { label: string; from: number; to: number; color: string }[];
  min: number;
  max: number;
  marker?: number;
  markerLabel?: string;
}

export interface ResourceLink {
  name: string;
  description: string;
  url: string;
}

export interface FundamentalTopic {
  id: FundamentalId;
  title: string;
  tagline: string;
  visual?: FundamentalVisual;
  visual2?: FundamentalVisual;
  compareTable?: CompareTableData;
  scale?: ScaleData;
  candles?: IllustrativeCandle[];
  links?: ResourceLink[];
  sections: ContentSection[];
  keyTakeaways: string[];
  worked?: { title: string; lines: string[] };
}

export const FUNDAMENTAL_TOPICS: FundamentalTopic[] = [
  {
    id: "what-is-crypto-trading",
    title: "What Is Crypto Trading?",
    tagline: "In simple words: trying to buy something for less than you sell it for.",
    scale: {
      zones: [
        { label: "MORE SELLERS: price falls", from: 0, to: 40, color: bearishRef },
        { label: "BALANCED: price flat", from: 40, to: 60, color: neutralRef },
        { label: "MORE BUYERS: price rises", from: 60, to: 100, color: bullishRef },
      ],
      min: 0,
      max: 100,
      marker: 72,
      markerLabel: "Right now",
    },
    sections: [
      {
        heading: "The basic idea",
        paragraphs: [
          "Crypto trading means buying a coin (like Bitcoin) and selling it later, hoping the price moved in your favor in between. If you buy at $60,000 and sell at $65,000, you made $5,000 per coin. If the price goes the other way, you lose money instead.",
          "Nobody knows the future price for certain. Traders use tools like charts, indicators, news, and patterns to make an educated guess about which way the price is more likely to move next, and they manage the risk in case they're wrong. That is the entire job: make a reasoned decision, size it sensibly, and protect yourself if it doesn't work out.",
        ],
      },
      {
        heading: "Why prices move at all",
        paragraphs: [
          "Prices move because of buying and selling pressure. When more people want to buy a coin right now than sell it, the price rises. When more people want to sell than buy, the price falls. News, big trades, whale activity, overall market mood, and technical levels traders watch (like support and resistance) all shift that balance.",
        ],
      },
      {
        heading: "Where Bonnco fits in",
        paragraphs: [
          "Bonnco is a decision-support tool, not an auto-trading bot. It reads live prices, indicators, patterns, sentiment, and on-chain data, and turns that into a signal (BUY / SELL / HOLD) with reasoning you can read. You are always the one who decides whether to actually place a trade, and you place it yourself on the exchange.",
        ],
      },
    ],
    keyTakeaways: [
      "Trading = buying low and selling high (or the reverse order for short trades), never a certainty.",
      "Price moves because of the real-time balance between buyers and sellers.",
      "Bonnco gives you information and reasoning to help you decide; it does not place trades for you.",
    ],
  },
  {
    id: "spot-trading",
    title: "What Is Spot Trading?",
    tagline: "You buy the real coin, own it outright, and it sits in your wallet until you sell it.",
    sections: [
      {
        heading: "In simple words",
        paragraphs: [
          "Spot trading is the simplest form of crypto trading: you pay full price to actually own the coin right now, at today's (\"on the spot\") price. If you spend 1,000 USDT to buy BTC, that BTC is genuinely yours. It sits in your spot wallet, and you can hold it for a day, a year, or transfer it out to your own wallet.",
        ],
      },
      {
        heading: "How you make or lose money",
        paragraphs: [
          "Your profit or loss is simply the difference between your buy price and your sell price, multiplied by how much you bought. There's no borrowing involved, so you can never lose more than the money you put in. If the coin goes to zero, you lose your investment, but never more than that.",
        ],
      },
      {
        heading: "What spot trading is good for",
        paragraphs: [
          "Spot trading is generally considered the safer, more beginner-friendly way to start, because the risk is capped at what you paid, there's no forced liquidation, and you can hold through a dip without being kicked out of your position. It's the natural choice if you believe in a coin's longer-term value and don't want the extra complexity of leverage.",
        ],
      },
    ],
    keyTakeaways: [
      "Spot = you own the real coin outright, no borrowing involved.",
      "Maximum possible loss is capped at the money you put in.",
      "No liquidation risk, no leverage, no funding fees.",
    ],
    worked: {
      title: "Worked example: buying BTC/USDT on spot",
      lines: [
        "You spend 1,000 USDT to buy BTC when it's priced at $50,000. You now own 0.02 BTC.",
        "Price rises to $55,000. Your 0.02 BTC is now worth 1,100 USDT. You sell and keep the 100 USDT profit (10% gain, before fees).",
        "If instead price fell to $45,000 and you sold, your 0.02 BTC would be worth 900 USDT: a 100 USDT loss (10%, before fees). You never owe more than what you put in.",
      ],
    },
  },
  {
    id: "futures-trading",
    title: "What Is Futures Trading?",
    tagline: "You trade a contract based on the price, with borrowed size (leverage), and you can bet on price going down too.",
    visual: "leverage",
    sections: [
      {
        heading: "In simple words",
        paragraphs: [
          "Futures trading means you're not buying the actual coin. You're opening a contract that tracks the coin's price, and you put down a smaller amount of money (called margin) to control a much larger position size (using leverage). This lets you make a much bigger profit from a small price move, but it also means a much bigger loss from a small move against you.",
          "Futures also let you bet that a price will fall, not just rise. This is called going short (covered in its own topic below).",
        ],
      },
      {
        heading: "Why leverage changes everything",
        paragraphs: [
          "If you use 10x leverage, a 1% move in your favor becomes roughly a 10% gain on your margin. But a 1% move against you becomes roughly a 10% loss on your margin. Go far enough against you, and the exchange automatically closes your position to stop you from losing more than you put in. This is called liquidation, and it's the single biggest risk in futures trading. See the Leverage & Margin and Liquidation topics for the full picture.",
        ],
      },
      {
        heading: "Perpetual futures (what most people mean by \"futures\")",
        paragraphs: [
          "The BTC/USDT and ETH/USDT futures markets on Binance are perpetual contracts, meaning they never expire (unlike traditional futures with a fixed settlement date). To keep the contract price closely tracking the real spot price, exchanges use a small periodic payment called the funding rate, exchanged directly between long and short traders every few hours. It's usually small, but it can add up if you hold a leveraged position for a long time.",
        ],
      },
    ],
    keyTakeaways: [
      "Futures = trading a contract on price, with borrowed size (leverage), not the coin itself.",
      "You can profit from price falling (short) as well as rising (long).",
      "Leverage magnifies both gains and losses, and can lead to liquidation, a real risk, not a technicality.",
    ],
  },
  {
    id: "spot-vs-futures",
    title: "Spot vs Futures: Side by Side",
    tagline: "Same coin, very different risk. Pick based on what you actually understand and can stomach.",
    visual: "spot-vs-futures-table",
    compareTable: {
      columns: ["Spot", "Futures"],
      rows: [
        { label: "What you own", values: ["The real coin", "A leveraged contract on price"] },
        { label: "Direction", values: ["Long only (buy)", "Long or short"] },
        { label: "Leverage", values: ["None", "Up to very high, chosen by you"] },
        { label: "Max possible loss", values: ["What you paid", "Your margin (can be liquidated)"] },
        { label: "Liquidation risk", values: ["None", "Yes, if price moves against you enough"] },
        { label: "Expiry", values: ["Never", "Perpetual (no fixed expiry, but funding fees)"] },
        { label: "Best for", values: ["Beginners, longer-term holding", "Experienced traders comfortable with risk"] },
      ],
    },
    sections: [
      {
        heading: "The core difference",
        paragraphs: [
          "Spot: you own the coin, pay full price, and your risk is capped at what you spent. Futures: you trade a leveraged contract, you can go long or short, and you can lose your entire margin fast if the price moves against you by more than your leverage allows for.",
        ],
      },
      {
        heading: "Which one should a beginner start with?",
        paragraphs: [
          "Most experienced traders recommend starting on spot until you're fully comfortable reading charts, understanding risk, and controlling your emotions during a losing trade. Futures adds leverage, funding fees, and liquidation risk on top of everything spot trading already involves. It rewards discipline and punishes impatience much faster.",
        ],
      },
    ],
    keyTakeaways: [
      "Spot: own the coin, capped risk, no expiry, no liquidation.",
      "Futures: leveraged contract, can go long or short, real liquidation risk, funding fees.",
      "Start on spot to build the underlying skills before adding leverage.",
    ],
  },
  {
    id: "long-vs-short",
    title: "Going Long vs Going Short",
    tagline: "Long = you profit if price goes up. Short = you profit if price goes down.",
    visual: "long-short",
    sections: [
      {
        heading: "Going long (the familiar direction)",
        paragraphs: [
          "Going long simply means buying, expecting the price to rise. This is the only direction available on spot trading, and it's also available on futures. You open a long, price rises, you close it for a profit. Price falls instead, you close it (or get liquidated on futures) at a loss.",
        ],
      },
      {
        heading: "Going short (only on futures)",
        paragraphs: [
          "Going short means opening a position that profits when the price falls. You're not physically selling a coin you own. On futures, you're opening a contract that pays you the difference if price drops, and costs you the difference if price rises instead. This lets traders make money in a falling ('bear') market, not just a rising one.",
          "Shorting is not available on spot trading, because spot only lets you sell something you already own. You can't sell a coin you don't have. Futures is what makes 'betting on a price drop' possible.",
        ],
      },
      {
        heading: "How to read Bonnco's BUY / SELL signals",
        paragraphs: [
          "On Bonnco, a BUY signal generally lines up with going long (buy now, expecting a rise). A SELL signal on futures can be read as a short opportunity (expecting a fall); on spot, a SELL signal simply means it may not be a good time to buy, or a good time to exit if you're already holding.",
        ],
      },
    ],
    keyTakeaways: [
      "Long = profit if price rises. Available on both spot and futures.",
      "Short = profit if price falls. Only available on futures.",
      "Shorting lets you try to make money even when the whole market is dropping.",
    ],
    worked: {
      title: "Worked example: shorting ETH/USDT on futures",
      lines: [
        "ETH is at $3,000 and you believe it will fall. You open a short with 500 USDT margin at 5x leverage (2,500 USDT position size).",
        "ETH falls to $2,850 (a 5% drop). Your position gains roughly 5% × 5x = 25% on your margin, about 125 USDT profit (before fees).",
        "If instead ETH had risen 5% to $3,150, you would have lost roughly the same 125 USDT, since a short loses money when price goes up.",
      ],
    },
  },
  {
    id: "leverage-margin",
    title: "Leverage & Margin, Explained Simply",
    tagline: "Leverage lets you control a bigger position with less of your own money. Margin is the money you actually put down.",
    visual: "leverage",
    sections: [
      {
        heading: "What margin is",
        paragraphs: [
          "Margin is the amount of your own money you commit to a futures position. If you put down 100 USDT as margin, that's the maximum the exchange will let the position lose before it steps in (see Liquidation), regardless of leverage.",
        ],
      },
      {
        heading: "What leverage does",
        paragraphs: [
          "Leverage multiplies your position size relative to your margin. 10x leverage on 100 USDT margin opens a 1,000 USDT position. This means every price move is felt 10 times harder on your margin than it would be on spot. A move that would be a small, forgettable dip on spot can wipe out a highly leveraged futures position.",
          "Higher leverage is not 'more advanced' or 'more skilled'. It's more fragile. Many experienced traders deliberately use low leverage (2x-5x) specifically because it gives price more room to breathe before threatening liquidation.",
        ],
      },
      {
        heading: "Cross margin vs isolated margin",
        paragraphs: [
          "Isolated margin limits your risk to only the margin you assigned to that specific position: if it gets liquidated, you only lose that amount. Cross margin shares your entire futures wallet balance as backup margin for every open position, which can help avoid liquidation on a temporary wick, but it also means a single bad position can draw down your whole account. Beginners are generally steered toward isolated margin so the risk on each trade stays contained and visible.",
        ],
      },
    ],
    keyTakeaways: [
      "Margin = the money you put down. Leverage = the multiplier on top of it.",
      "Higher leverage means smaller price moves can hurt (or help) you a lot more.",
      "Isolated margin caps your loss per position; cross margin shares risk across your whole account.",
    ],
  },
  {
    id: "liquidation",
    title: "What Is Liquidation, and How Do You Avoid It?",
    tagline: "Liquidation is the exchange forcibly closing your leveraged position because your losses reached your margin.",
    visual: "liquidation-scale",
    scale: {
      zones: [
        { label: "LIQUIDATION ZONE", from: 0, to: 30, color: bearishRef },
        { label: "STOP-LOSS BUFFER", from: 30, to: 48, color: neutralRef },
        { label: "SAFE ZONE", from: 48, to: 100, color: bullishRef },
      ],
      min: 0,
      max: 100,
      marker: 72,
      markerLabel: "Entry price",
    },
    sections: [
      {
        heading: "What actually happens",
        paragraphs: [
          "When you open a leveraged futures position, the exchange calculates a liquidation price: the price at which your losses would use up all of your margin. If the market reaches that price, the exchange automatically closes your position to prevent your loss from going any further (and to protect the exchange's lending pool). You lose the margin you put into that position.",
          "The higher your leverage, the closer your liquidation price sits to your entry price, meaning even a small, completely normal price wick can trigger it.",
        ],
      },
      {
        heading: "How to reduce liquidation risk",
        bullets: [
          "Use lower leverage: it pushes your liquidation price further away from the current price.",
          "Don't put your entire account balance into one leveraged position.",
          "Use isolated margin so a liquidation only costs you what you assigned to that trade.",
          "Set a stop-loss well before your liquidation price, so you exit on your own terms with a smaller, controlled loss instead of a forced one.",
          "Avoid opening new leveraged positions right before major news events, when volatility (and wick risk) is highest.",
        ],
      },
    ],
    keyTakeaways: [
      "Liquidation = forced close when your loss reaches your margin.",
      "Higher leverage means your liquidation price is closer to where you entered.",
      "A stop-loss set before your liquidation price puts you back in control of the exit.",
    ],
  },
  {
    id: "order-types",
    title: "Order Types: Market, Limit, and Stop Orders",
    tagline: "How you tell the exchange exactly what price you're willing to trade at.",
    visual: "order-types-table",
    compareTable: {
      columns: ["Fills", "Price control", "Common use"],
      rows: [
        { label: "Market", values: ["Immediately", "None (best available price)", "Enter or exit right now"] },
        { label: "Limit", values: ["Only at your price or better", "Full", "Buying/selling at a planned level"] },
        { label: "Stop-Market", values: ["Immediately, once triggered", "None once triggered", "Stop-loss where exit matters more than price"] },
        { label: "Stop-Limit", values: ["Only at your price, once triggered", "Full, once triggered", "Stop-loss where price matters more than certainty"] },
      ],
    },
    sections: [
      {
        heading: "Market order",
        paragraphs: [
          "Fills immediately at the best available current price. Simple and fast, but on a fast-moving or thin market you might get a slightly worse price than you expected (called slippage).",
        ],
      },
      {
        heading: "Limit order",
        paragraphs: [
          "You set the exact price you're willing to buy or sell at. The order only fills if the market reaches that price (or better). You get price control, but no guarantee it fills at all if the market never reaches your price.",
        ],
      },
      {
        heading: "Stop-limit and stop-market orders",
        paragraphs: [
          "These sit inactive until price reaches a trigger ('stop') price you set, and then they fire off either a limit order (stop-limit) or a market order (stop-market). They're most commonly used to set a stop-loss: 'if price falls to X, get me out.' Stop-market guarantees an exit but not the exact price; stop-limit guarantees the price but not that it fills.",
        ],
      },
      {
        heading: "Take-profit orders",
        paragraphs: [
          "The mirror image of a stop-loss: an order that automatically closes your position once it reaches a profit target you set in advance, so you don't have to watch the chart to lock in gains.",
        ],
      },
    ],
    keyTakeaways: [
      "Market = fill now at current price. Limit = fill only at your price or better.",
      "Stop orders wait for a trigger price, then act. Most often used for stop-loss and take-profit.",
      "Setting stop-loss and take-profit in advance removes the need to watch the market constantly.",
    ],
  },
  {
    id: "profit-loss",
    title: "How Profit and Loss Actually Work",
    tagline: "The real math behind every green or red number on your position.",
    sections: [
      {
        heading: "Spot P&L",
        paragraphs: [
          "Profit or loss = (sell price − buy price) × amount of coin, minus trading fees. Straightforward, and it only realizes (becomes real money) once you actually sell.",
        ],
      },
      {
        heading: "Futures P&L",
        paragraphs: [
          "Same basic idea, but scaled by your position size (margin × leverage), and it applies to both directions: a long profits when price rises, a short profits when price falls. Futures also shows 'unrealized P&L' constantly updating while your position is open, and 'realized P&L' once you close it.",
        ],
      },
      {
        heading: "Percentage gain vs dollar gain",
        paragraphs: [
          "A common beginner trap is only looking at the dollar amount and not the percentage of your capital at risk. Losing 5% of your account on one trade is very different from losing 50%, even if the dollar figures look similar depending on position size. Thinking in percentages of your total capital keeps risk in perspective.",
        ],
      },
    ],
    worked: {
      title: "Worked example: same dollar loss, very different risk",
      lines: [
        "Account A: 1,000 USDT total balance, loses 50 USDT on a trade. That's 5% of the account: painful, but recoverable.",
        "Account B: 100 USDT total balance, loses 50 USDT on a trade. Same 50 USDT, but that's 50% of the account: a very different risk profile.",
        "The dollar amount was identical. The real risk taken was not.",
      ],
    },
    keyTakeaways: [
      "P&L = (exit price − entry price) × size, adjusted for direction (long/short) and fees.",
      "Unrealized P&L can change every second while a position is open; realized P&L is locked in once you close it.",
      "Always think in percentage of your account, not just the dollar number.",
    ],
  },
  {
    id: "fees",
    title: "Trading Fees You Should Know About",
    tagline: "Small percentages that quietly add up, especially if you trade often or hold leveraged positions.",
    compareTable: {
      columns: ["Maker", "Taker"],
      rows: [
        { label: "What triggers it", values: ["An order that waits on the book (e.g. a limit order)", "An order that fills immediately against the book (e.g. most market orders)"] },
        { label: "Typical fee", values: ["Lower", "Slightly higher"] },
        { label: "Why", values: ["Adds liquidity, so the exchange rewards it", "Removes liquidity, so it costs a bit more"] },
      ],
    },
    sections: [
      {
        heading: "Maker vs taker fees",
        paragraphs: [
          "A 'maker' order adds liquidity to the order book (like a limit order that sits and waits to be filled), and usually pays a lower fee. A 'taker' order removes liquidity by filling immediately against an existing order (like most market orders), and usually pays a slightly higher fee. Frequent traders can save meaningfully over time by favoring limit orders where practical.",
        ],
      },
      {
        heading: "Funding rate (futures only)",
        paragraphs: [
          "Perpetual futures periodically exchange a small funding payment directly between long and short traders (not paid to the exchange) to keep the contract price anchored to the real spot price. If more traders are long than short, longs typically pay shorts, and vice versa. It's usually a small amount, but holding a leveraged position for many days can make it add up.",
        ],
      },
    ],
    keyTakeaways: [
      "Maker fees (limit orders that wait to fill) are usually cheaper than taker fees (orders that fill immediately).",
      "Funding rate is a recurring cost (or income) unique to holding perpetual futures positions.",
      "Fees are small per trade but compound with frequency. Factor them into your actual expected profit.",
    ],
  },
  {
    id: "risk-management",
    title: "Risk Management: The Part Beginners Skip",
    tagline: "The single biggest difference between traders who last years and those who blow up their account in weeks.",
    scale: {
      zones: [
        { label: "SAFE: 1-2% per trade", from: 0, to: 25, color: bullishRef },
        { label: "AGGRESSIVE: 3-5%", from: 25, to: 55, color: neutralRef },
        { label: "DANGEROUS: 10%+", from: 55, to: 100, color: bearishRef },
      ],
      min: 0,
      max: 100,
      marker: 15,
      markerLabel: "Common guideline",
    },
    sections: [
      {
        heading: "Position sizing",
        paragraphs: [
          "Never put your entire balance into one trade. A common guideline is to risk only a small slice of your total account (often cited as 1-2%) on any single trade, so that a string of losses doesn't wipe you out. This matters even more on leveraged futures, where losses move faster.",
        ],
      },
      {
        heading: "Always know your exit before you enter",
        paragraphs: [
          "Decide your stop-loss and, ideally, your take-profit level before you open a position, not after. Deciding in the middle of a losing trade is exactly when emotions (hope, fear, 'it'll come back') make the worst decisions most likely.",
        ],
      },
      {
        heading: "Don't fight the trend on hope alone",
        paragraphs: [
          "If a trade is going against you and your original reasoning (the setup, the level, the signal) is no longer valid, that's information, not a reason to double down. 'Averaging down' into a losing position without a clear plan is one of the most common ways accounts get destroyed.",
        ],
      },
      {
        heading: "Only risk money you can afford to lose",
        paragraphs: [
          "Crypto markets are volatile even on spot, and dramatically more so with leverage. Never trade with rent money, emergency savings, or borrowed funds. This isn't a formality: it's what keeps a losing trade from becoming a life problem instead of just a bad week.",
        ],
      },
    ],
    keyTakeaways: [
      "Risk a small, consistent slice of your account per trade, not an amount that would hurt if it's wrong.",
      "Decide your stop-loss and target before entering, not while emotions are already involved.",
      "Only ever trade with money you can genuinely afford to lose.",
    ],
  },
];

export const FUNDAMENTAL_GROUP_LABEL = "Fundamentals";
export const FUNDAMENTAL_GROUP_BLURB =
  "The core concepts behind spot and futures trading, in plain words, from your first trade to the risk mechanics experienced traders live by.";

// ---------------------------------------------------------------------------------------------
// Charts & Platforms: chart types, how to read a candle, and how Binance/Bybit's own on-screen
// abbreviations map to the same indicators Bonnco already shows you, so nothing on a real exchange
// screen looks unfamiliar. Chart type names and indicator abbreviations below were checked against
// Binance's and Bybit's own trading-view documentation and TradingView's chart-type reference
// (which both exchanges' charts are built on) rather than written from memory alone.
// ---------------------------------------------------------------------------------------------

const CHART_GALLERY_SAMPLE: IllustrativeCandle[] = synthesizeCandles(
  [[0, 62], [15, 48], [30, 55], [45, 30], [60, 38], [75, 20], [90, 28], [100, 15]],
  2,
);

// y is inverted (0 = top = higher price), so close < open means price rose (bullish, green) and
// close > open means price fell (bearish, red) — deliberately one of each, with wicks on both
// sides of both candles, so the anatomy explanation below has a real example of everything it describes.
const CANDLE_ANATOMY_SAMPLE: IllustrativeCandle[] = [
  { open: 60, high: 28, low: 70, close: 35 },
  { open: 35, high: 25, low: 68, close: 58 },
];

export const CHART_TOPICS: FundamentalTopic[] = [
  {
    id: "chart-types-overview",
    title: "Chart Types: Line, Area, Candlestick, Bar",
    tagline: "Four pictures of the exact same price data. Each one just decides what to show you and what to hide.",
    visual: "chart-gallery",
    candles: CHART_GALLERY_SAMPLE,
    sections: [
      {
        heading: "Line chart",
        paragraphs: [
          "The simplest view: one continuous line connecting the closing price of each candle. It hides everything that happened during each candle (how high or low price wandered), showing only where it ended up. Good for a quick read of overall trend direction, too simple for timing an actual entry.",
        ],
      },
      {
        heading: "Area chart",
        paragraphs: [
          "The same line as above, with the space underneath filled in a color. Purely visual: it reads exactly the same as a line chart, it's just easier to scan at a glance, which is why many exchanges use it for small preview charts (like a coin's row on a watchlist) rather than the main trading view.",
        ],
      },
      {
        heading: "Candlestick chart",
        paragraphs: [
          "The standard for actual trading. Each candle shows four prices at once: open, high, low, and close, colored by whether price went up or down over that period. This is what nearly every serious trader actually trades off, and what Bonnco's own charts use. See 'How to Read a Candlestick' for the full breakdown of what each part means.",
        ],
      },
      {
        heading: "Bar chart (OHLC)",
        paragraphs: [
          "Shows the exact same four prices as a candlestick (open, high, low, close), just drawn differently: a vertical line for the high-low range, a small tick on the left for the open, a small tick on the right for the close, with no filled body. Some traders find this less visually busy across many bars at once; it carries identical information to a candlestick, just presented as ticks instead of a filled box.",
        ],
      },
      {
        heading: "Heikin-Ashi (a smoothed variant)",
        paragraphs: [
          "Looks like a candlestick chart, but each candle is calculated as an average of itself and the previous candle, rather than the raw open/high/low/close. This smooths out noise and makes trends look cleaner, at the cost of the candles no longer showing the exact real traded prices. Useful for spotting a trend's overall shape; not something to read exact entry prices off of.",
        ],
      },
      {
        heading: "Less common types you may see on Binance or Bybit's chart-type menu",
        paragraphs: [
          "Renko and Point & Figure charts ignore time entirely and only redraw when price moves by a fixed amount, producing a very different-looking, noise-filtered view. They're a genuinely advanced, less commonly used style; you don't need them as a beginner, and most traders never switch to them at all.",
        ],
      },
    ],
    keyTakeaways: [
      "Line and area charts show only the closing price; candlestick and bar charts show open, high, low, and close.",
      "Candlestick is the standard for actually trading; line/area are better for a quick glance.",
      "Heikin-Ashi smooths trend shape but hides the real traded prices; use it for context, not exact entries.",
    ],
  },
  {
    id: "reading-a-candlestick",
    title: "How to Read a Candlestick",
    tagline: "One candle, four prices: open, high, low, and close, and what its shape is actually telling you.",
    visual: "candle-anatomy",
    candles: CANDLE_ANATOMY_SAMPLE,
    sections: [
      {
        heading: "The body",
        paragraphs: [
          "The thick rectangle is the body: it spans from the open price to the close price for that candle's time period. A green (or sometimes white/hollow) body means price closed higher than it opened. A red (or black/filled) body means it closed lower than it opened. Exact colors vary by platform and by your own settings, but 'up color' vs 'down color' is universal.",
        ],
      },
      {
        heading: "The wicks (or shadows)",
        paragraphs: [
          "The thin lines above and below the body are wicks, showing the highest and lowest price actually reached during that period, even if price didn't close there. A long upper wick means buyers pushed price up but sellers pushed it back down before the close. A long lower wick means the reverse: sellers pushed it down, buyers pushed it back up.",
        ],
      },
      {
        heading: "What the shape is telling you",
        bullets: [
          "A long body with tiny wicks: strong, decisive movement in one direction for that whole period.",
          "A small body with long wicks on both sides: indecision, price tested both directions and ended up near where it started.",
          "A long lower wick with a small body near the top (a hammer shape): sellers tried to push price down and failed, often read as a bullish signal near support.",
          "A long upper wick with a small body near the bottom (a shooting star shape): buyers tried to push price up and failed, often read as a bearish signal near resistance.",
        ],
      },
      {
        heading: "One candle is one opinion, not the whole story",
        paragraphs: [
          "A single candle's shape is a genuine clue, but Bonnco (and most experienced traders) never act on one candle alone. See the Candlestick Patterns section for how specific multi-candle shapes are actually scored, and How Bonnco Combines Multiple Factors for why no single reading, candle or indicator, decides a call by itself.",
        ],
      },
    ],
    keyTakeaways: [
      "Body = open to close. Wick = the full high/low range reached, even if price didn't stay there.",
      "Color tells you direction (up vs down); body length tells you how decisive the move was.",
      "Long wicks show rejection: price tried a direction and got pushed back before the candle closed.",
    ],
  },
  {
    id: "binance-vs-bybit-view",
    title: "Binance vs Bybit: Reading a Different Platform's Chart View",
    tagline: "Different exchange, same underlying language. Once you can read a chart, you can read it anywhere.",
    compareTable: {
      columns: ["Varies by platform", "Stays the same everywhere"],
      rows: [
        { label: "Layout", values: ["Where the order book and depth chart sit on screen", "The chart itself reads the same way"] },
        { label: "Indicator label", values: ["MA, BOLL, MACD abbreviations shown in the panel", "The underlying calculation and meaning"] },
        { label: "Order form", values: ["Where leverage and margin controls are placed", "What leverage and margin actually do"] },
        { label: "Menu location", values: ["Where chart-type and indicator menus live", "What a candlestick or RSI reading means"] },
      ],
    },
    sections: [
      {
        heading: "The shared foundation",
        paragraphs: [
          "Binance and Bybit (and most major exchanges) build their trading charts on the same charting conventions popularized by TradingView, which is why a candlestick, a moving average, or an RSI reading looks and behaves almost identically once you're actually looking at the chart, regardless of which exchange you're on. The core skill of reading a chart transfers completely between platforms.",
        ],
      },
      {
        heading: "What tends to differ between platforms",
        bullets: [
          "Layout: where the order book, depth chart, and trade history panels sit relative to the main chart.",
          "The exact menu location for switching chart type (candlestick/line/bar) and adding indicators, usually a toolbar icon above or beside the chart on both platforms.",
          "Default indicator abbreviations shown in the panel below the price chart (see the Indicator Name Glossary below for exactly how these map to what Bonnco already shows you).",
          "Order form layout: where leverage, margin mode, and order type controls sit for futures trading.",
        ],
      },
      {
        heading: "What never changes, no matter the platform",
        paragraphs: [
          "A candlestick means the same thing everywhere. An RSI reading of 70+ means the same thing everywhere. A support level, a resistance level, a bullish MACD crossover: all of it reads identically once you know what to look for, because the underlying math behind every indicator is standardized, not platform-specific. Exchange interfaces change their layout over time, so treat this as a general orientation rather than a pixel-exact guide, and use the platform's own current interface as the source of truth.",
        ],
      },
    ],
    keyTakeaways: [
      "Chart reading skill is universal; only the surrounding page layout differs between exchanges.",
      "Indicator math is standardized across platforms; only the abbreviation shown on-screen can differ.",
      "Exchange UIs change over time, so treat specific menu locations as approximate, not fixed.",
    ],
  },
  {
    id: "indicator-name-glossary",
    title: "Indicator Name Glossary: What Binance/Bybit Show vs What Bonnco Calls It",
    tagline: "Same indicators, different labels on the screen. Here's the direct translation.",
    visual: "indicator-glossary-table",
    compareTable: {
      columns: ["Full name", "Bonnco calls it"],
      rows: [
        { label: "MA", values: ["Moving Average", "EMA (Bonnco uses the exponential variant, EMA9/21/50/200)"] },
        { label: "BOLL", values: ["Bollinger Bands", "Bollinger Bands (same name)"] },
        { label: "MACD", values: ["Moving Average Convergence Divergence", "MACD (same name)"] },
        { label: "RSI", values: ["Relative Strength Index", "RSI (same name)"] },
        { label: "KDJ", values: ["Stochastic Oscillator (a 3-line variant)", "Not currently scored by Bonnco's engine"] },
        { label: "MFI", values: ["Money Flow Index (volume-weighted RSI)", "Closest equivalent: Bonnco's Volume and Volume Delta factors"] },
        { label: "VOL", values: ["Trading Volume", "Volume (same concept, shown as buy/sell delta bars)"] },
      ],
    },
    sections: [
      {
        heading: "Why the abbreviations exist",
        paragraphs: [
          "Exchange charting panels default to short abbreviations to save space, mostly carried over from long-standing technical analysis convention rather than being exchange-specific inventions. MA, BOLL, MACD, RSI, KDJ, and MFI are the standard set you'll see pre-loaded on Binance's and Bybit's own charts.",
        ],
      },
      {
        heading: "Using this table",
        paragraphs: [
          "If you open BTC/USDT directly on Binance or Bybit and see these abbreviations in the panel under the price chart, this table tells you exactly what you're looking at and where the same concept shows up (if it does) in Bonnco's own signal reasoning.",
        ],
      },
    ],
    keyTakeaways: [
      "MA, BOLL, MACD, RSI, KDJ, and MFI are the standard indicator abbreviations shown on both Binance and Bybit.",
      "Most map directly to something Bonnco already scores; KDJ currently doesn't have a direct Bonnco equivalent.",
      "The underlying calculation is standardized technical analysis, not something either exchange invented.",
    ],
  },
  {
    id: "binance-trading-tools",
    title: "Binance Trading Tools: A Guided Tour of the Screen",
    tagline: "Every button and panel on the trading screen, what it's for, and where fees actually come from.",
    visual: "platform-layout",
    compareTable: {
      columns: ["Maker", "Taker"],
      rows: [
        { label: "Where it shows up here", values: ["A limit order sitting in the order book, waiting to fill", "A market order, or any order that fills immediately against the book"] },
        { label: "Typical fee", values: ["Lower", "Slightly higher"] },
      ],
    },
    sections: [
      {
        heading: "The chart area",
        paragraphs: [
          "This is the main panel: the price chart itself. Above or beside it you'll find a chart-type switcher (candlestick, line, bar, and more, see Chart Types), a timeframe selector (5m, 15m, 1h, 4h, 1D, and so on), an 'Indicators' button that opens a menu to add MA, BOLL, MACD, RSI, and others onto the chart (see the Indicator Name Glossary for what each abbreviation means), and a set of drawing tools for trend lines, Fibonacci retracements, and horizontal lines you can drag onto support or resistance levels yourself.",
        ],
      },
      {
        heading: "The order book and recent trades",
        paragraphs: [
          "The order book shows every currently open buy order (bid) and sell order (ask), stacked by price, usually with bids in green below the current price and asks in red above it. Recent trades, often a separate small panel, shows a live feed of trades that have actually executed, not just orders sitting open. Together they show you real, current supply and demand at each price level, distinct from the chart, which shows history.",
        ],
      },
      {
        heading: "The order form",
        paragraphs: [
          "This is where you actually place a trade: tabs for order type (Market, Limit, and on futures, Stop-Market and Stop-Limit too, see Order Types), a field for how much you want to buy or sell, and Buy/Sell (or Long/Short on futures) buttons to submit. On futures specifically, this panel also has a leverage slider and a cross/isolated margin toggle (see Leverage & Margin), which don't exist on the spot order form at all since spot never uses leverage.",
        ],
      },
      {
        heading: "Where fees actually show up",
        paragraphs: [
          "Every fill on the order form is either a maker fill (your order sat in the book and someone else's order matched into it, usually true for limit orders) or a taker fill (your order matched immediately against something already in the book, usually true for market orders). The platform doesn't show you a 'fee calculator', the type of order you choose is what decides which fee tier applies. See Trading Fees You Should Know About for the full breakdown, including funding rate on futures.",
        ],
      },
    ],
    keyTakeaways: [
      "The chart area, order book, and order form are the three panels you'll use on every single trade.",
      "Drawing tools and the indicators menu live in or above the chart area, not in the order form.",
      "Which order type you pick on the order form (limit vs market) is what actually decides maker vs taker fees, there's no separate fee setting.",
    ],
  },
  {
    id: "candlestick-combinations",
    title: "Reading Candlestick Combinations",
    tagline: "One candle is a clue. Two or three candles together start telling an actual story.",
    visual: "candle-anatomy",
    candles: [
      { open: 70, high: 32, low: 72, close: 35 },
      { open: 38, high: 30, low: 48, close: 44 },
      { open: 42, high: 15, low: 44, close: 40 },
      { open: 40, high: 42, low: 65, close: 62 },
    ],
    sections: [
      {
        heading: "Candles 1-2: strong momentum, then a pause",
        paragraphs: [
          "The first candle is a long, decisive bullish candle, real conviction, buyers in full control for that period. The second candle is small-bodied and sits near the top of the first candle's range: buyers and sellers are now roughly balanced right after a strong push. On its own, candle 2 doesn't say which way it breaks next, it says momentum has paused, which is exactly why the very next candle after a pause like this gets watched closely.",
        ],
      },
      {
        heading: "Candles 3-4: a rejection, then confirmation",
        paragraphs: [
          "Candle 3 pushes to a new high but closes well off that high, a long upper wick, the classic shape of buyers getting pushed back. On its own, one wick isn't proof of anything, wicks happen constantly in normal trading. Candle 4 is what turns it into a real signal: it closes below candle 3's open, meaning the selling actually followed through instead of fading. That combination, rejection wick plus a confirming follow-through candle, is a far more reliable read than either candle alone.",
        ],
      },
      {
        heading: "The general skill, not just these two examples",
        paragraphs: [
          "Reading combinations always comes down to the same question: did the next candle confirm what the previous one suggested, or did it fade it? A long bullish candle followed by an equally strong bearish candle (an engulfing shape) is a stronger reversal signal than a long bullish candle followed by a tiny, indecisive one. See Candlestick Patterns for the full named-pattern reference (engulfing, morning/evening star, three white soldiers, harami, and more), each of those named patterns is really this same 'does the next candle confirm or fade it' logic, formalized into a recognizable shape.",
        ],
      },
    ],
    keyTakeaways: [
      "A single candle is a clue about that period only; reading 2-3 together shows whether momentum is continuing, pausing, or reversing.",
      "A wick alone is not confirmation, the next candle either follows through on it or fades it.",
      "Every named multi-candle pattern in the Candlestick Patterns library is a formalized version of this same confirm-or-fade logic.",
    ],
  },
  {
    id: "trend-structure",
    title: "Reading Trend Structure",
    tagline: "The shape of swing highs and swing lows tells you the trend before a single indicator does.",
    visual: "trend-structure",
    sections: [
      {
        heading: "Uptrend: higher highs, higher lows",
        paragraphs: [
          "Each swing high reaches above the previous swing high, and each swing low holds above the previous swing low. As long as that pattern keeps repeating, the trend is considered intact, even through normal pullbacks along the way. The first real warning sign isn't a single red candle, it's a swing low that fails to hold above the prior swing low.",
        ],
      },
      {
        heading: "Downtrend: lower highs, lower lows",
        paragraphs: [
          "The mirror image: each swing high fails to reach the previous swing high, and each swing low breaks below the previous swing low. The first sign a downtrend may be losing steam is a swing high that finally breaks above the prior swing high.",
        ],
      },
      {
        heading: "Sideways / range: no clear direction",
        paragraphs: [
          "Swing highs and swing lows stay roughly within the same band, neither expanding upward nor downward in any consistent way. Ranges are common, and many indicators (RSI in particular) give noisier, less reliable readings inside one, since there's no dominant direction for momentum to actually confirm.",
        ],
      },
      {
        heading: "Why this comes before indicators, not after",
        paragraphs: [
          "RSI, MACD, and every other indicator are calculated from price, they describe momentum within whatever structure already exists, they don't establish the structure itself. Reading trend structure by eye first is what lets you judge whether an indicator reading actually fits the bigger picture or is a shorter-term wobble inside it.",
        ],
      },
    ],
    keyTakeaways: [
      "Uptrend = higher highs and higher lows. Downtrend = lower highs and lower lows. Range = neither, boundaries hold.",
      "The first warning a trend may be turning is a swing point failing to extend in the trend's direction, not a single candle color.",
      "Read trend structure before indicators, indicators describe momentum inside a structure, they don't define it.",
    ],
  },
  {
    id: "support-resistance-visual",
    title: "Support and Resistance, Visually",
    tagline: "Why price keeps reacting at the exact same levels, and how to actually see it on a chart.",
    visual: "support-resistance",
    sections: [
      {
        heading: "What you're actually looking at",
        paragraphs: [
          "Support is a price level where buying pressure has stepped in more than once, stopping a decline. Resistance is the mirror image, a level where selling pressure has stepped in more than once, stopping an advance. In the diagram above, price touches the same support level twice and the same resistance level twice, bouncing each time, that repetition is what makes a level worth marking, not any single touch.",
        ],
      },
      {
        heading: "Why these specific levels, and not just any price",
        paragraphs: [
          "A level becomes meaningful because enough other traders are watching the same one, often because it's where a previous strong reversal happened, a round psychological number, or a level where large resting orders visibly sit in the order book. It's genuinely a bit self-fulfilling: the level matters partly because enough people believe it matters and act accordingly.",
        ],
      },
      {
        heading: "What happens when a level actually breaks",
        paragraphs: [
          "When price finally closes clearly through a well-tested level instead of bouncing again, that's usually read as more significant than the same move through a level nobody was watching, and old resistance frequently becomes new support once broken (and vice versa in reverse). This is exactly what Bonnco's own support/resistance factor scores automatically: proximity to a real, previously-tested swing high or low, found in the actual candle history, not an arbitrary round number.",
        ],
      },
    ],
    keyTakeaways: [
      "A level counts as real support or resistance once price has reacted there more than once, not on a single touch.",
      "Levels matter partly because many traders are watching the same ones, which reinforces the reaction.",
      "A confirmed break through a well-tested level, especially with volume, tends to matter more than a break through an untested one.",
    ],
  },
  {
    id: "chart-drawing-tools",
    title: "Chart Drawing Tools: Trend Lines, Fibonacci, and Horizontal Levels",
    tagline: "The toolbar next to the chart, what each drawing tool actually does, and how to use it yourself.",
    visual: "trend-line",
    visual2: "fibonacci",
    sections: [
      {
        heading: "The trend line tool",
        paragraphs: [
          "A trend line connects two or more swing points (swing lows in an uptrend, swing highs in a downtrend) and extends outward, projecting where price might react next. To draw one: click the toolbar's trend line icon, click your first swing point, then click and drag to your second swing point. The line locks in and extends automatically.",
          "An uptrend line drawn under rising swing lows acts like a moving support level: price touching it again is often watched for a bounce. A downtrend line drawn over falling swing highs acts the same way in reverse, as a moving resistance level. A trend line breaking is one of the more commonly watched signs that a trend may be ending, though like any single tool, it's stronger combined with other confirmation, not read alone.",
        ],
      },
      {
        heading: "The horizontal line tool",
        paragraphs: [
          "The simplest tool on the bar: click it, then click once on the chart at a price level you want to mark, typically a level price has bounced off or been rejected from more than once. This is how you manually mark support and resistance yourself, the same concept Bonnco's own support/resistance factor finds automatically from swing highs and lows, just drawn by hand instead of calculated. See Support and Resistance, Visually for a worked diagram of exactly what you're marking and why those levels tend to hold.",
        ],
      },
      {
        heading: "The Fibonacci retracement tool",
        paragraphs: [
          "Based on the Fibonacci sequence from mathematics, this tool marks specific percentage levels (commonly 23.6%, 38.2%, 50%, 61.8%, and 78.6%) between a swing low and swing high, on the idea that pullbacks often pause or reverse near one of these levels before the original trend continues.",
          "To draw one: click the Fibonacci tool, click the start of a clear price swing (a swing low for an uptrend), then drag to the end of that swing (the swing high) and release. The tool automatically draws the percentage levels in between.",
          "61.8% (sometimes called the 'golden ratio') and 50% are the two levels traders watch most closely as common bounce zones. Like every tool here, this reflects trader psychology and widespread convention, not a guaranteed law of price, and works best combined with an actual support/resistance level or indicator reading at the same spot, not used alone.",
        ],
      },
      {
        heading: "Everyone draws these slightly differently, and that's normal",
        paragraphs: [
          "Two traders looking at the same chart will often draw a trend line or pick swing points a little differently. This isn't a sign you're doing it wrong, these tools are aids for visualizing a read you already have from price action and indicators, not a precise, single-answer calculation the way RSI or MACD are.",
        ],
      },
    ],
    keyTakeaways: [
      "Trend lines connect swing points and act as a moving support or resistance level as they extend.",
      "Horizontal lines mark a fixed support/resistance price by hand, the same idea Bonnco calculates automatically.",
      "Fibonacci retracement levels (especially 50% and 61.8%) mark common pullback zones on a price swing, strongest when they line up with another signal.",
    ],
  },
  {
    id: "reading-a-live-chart",
    title: "How to Read a Live Chart, Step by Step",
    tagline: "Everything from the other topics, applied together to one real chart, the way you'd actually do it.",
    visual: "candle-anatomy",
    candles: CHART_GALLERY_SAMPLE,
    sections: [
      {
        heading: "Step 1: Read the trend before anything else",
        paragraphs: [
          "Look at the overall shape first, ignore individual candles. Are recent swing highs and swing lows each higher than the last (uptrend), each lower than the last (downtrend), or roughly flat (range)? This single read shapes how you interpret everything that follows. In the diagram above, each swing high and swing low sits higher than the one before it, an uptrend, and that's the trend read, before a single indicator is checked.",
        ],
      },
      {
        heading: "Step 2: Mark the levels that actually matter",
        paragraphs: [
          "Find the most recent, clearest swing high and swing low, real ones price has touched and reacted from, not arbitrary round numbers. These become your working resistance and support for this read. If you have the drawing tools available, this is also where a trend line along the recent swing points earns its place.",
        ],
      },
      {
        heading: "Step 3: Check momentum against that trend",
        paragraphs: [
          "Pull up RSI and MACD. Do they agree with the trend you read in step 1, or are they starting to diverge from it (price making a new low while RSI doesn't, for example)? Agreement reinforces the read; disagreement is a reason to slow down, not necessarily a reason to flip your view outright.",
        ],
      },
      {
        heading: "Step 4: Check where price sits relative to the EMAs",
        paragraphs: [
          "Is price above or below EMA50 and EMA200 (the longer-term picture), and has EMA9 crossed EMA21 recently (a shorter-term shift)? This is the fastest way to sanity-check whether your step 1 read still holds up structurally, not just visually.",
        ],
      },
      {
        heading: "Step 5: Check volume at the moment that matters",
        paragraphs: [
          "Volume (or buy/sell delta, where available) should be doing real work right at your key levels from step 2. A breakout on genuinely low volume is a weaker signal than the identical-looking breakout on a clear volume spike, even though the candles alone might look the same.",
        ],
      },
      {
        heading: "Step 6: Look for a named pattern, but only after the above",
        paragraphs: [
          "Only now check whether something like a head and shoulders, double top, flag, or a specific candlestick shape is actually present. Patterns read far more reliably once you already know the trend, the levels, and whether momentum agrees, spotting a pattern first and working backward is how patterns get over-read into charts that don't actually support them.",
        ],
      },
      {
        heading: "Putting it together",
        paragraphs: [
          "A genuinely strong read is one where most of these six steps point the same direction. One or two disagreeing is normal and worth noting in your reasoning, not ignoring. This is exactly the walkthrough Bonnco's own signal reasoning gives you automatically for any coin and timeframe, reading it yourself here is what lets you sanity-check that reasoning instead of taking it on faith.",
        ],
      },
    ],
    keyTakeaways: [
      "Read the trend and mark real levels before opening a single indicator, they frame everything that follows.",
      "Momentum, EMA structure, and volume should each get checked against the trend you already read, not in isolation.",
      "Chart patterns are most reliable read last, after trend and levels already point somewhere, not first.",
    ],
  },
  {
    id: "further-learning-resources",
    title: "Further Learning Resources",
    tagline: "Where to go deeper, beyond what's covered here.",
    links: [
      {
        name: "Binance Academy",
        description: "Binance's own free education hub: beginner-to-advanced articles on trading, technical analysis, and blockchain fundamentals.",
        url: "https://academy.binance.com/en",
      },
      {
        name: "Bybit Learn",
        description: "Bybit's free education hub, including a dedicated technical indicators section covering the same MA/BOLL/MACD/RSI/KDJ/MFI set referenced above.",
        url: "https://learn.bybit.com/en",
      },
      {
        name: "TradingView Help Center: Chart Types",
        description: "The reference documentation for every chart type (candlestick, line, bar, Heikin-Ashi, Renko, and more), maintained by the platform most exchange charts are built on.",
        url: "https://www.tradingview.com/support/folders/43000547460-learn-more-about-chart-types/",
      },
      {
        name: "Investopedia: Technical Analysis",
        description: "A long-standing, independent (not exchange-run) reference for technical analysis concepts and indicator definitions, useful for a second explanation in different words.",
        url: "https://www.investopedia.com/terms/t/technicalanalysis.asp",
      },
    ],
    sections: [
      {
        heading: "On YouTube and independent educators",
        paragraphs: [
          "There are genuinely knowledgeable independent crypto educators on YouTube and elsewhere, but the space also has a real problem with channels that promote paid signal groups, guarantee returns, or push specific coins they're quietly being paid to promote. Rather than naming individual creators, whose reliability and activity can change, it's safer to evaluate any channel yourself using a few consistent checks before trusting it.",
        ],
      },
      {
        heading: "Red flags worth checking for",
        bullets: [
          "Guaranteed profits, guaranteed win rates, or 'get rich' framing: no legitimate trader can honestly promise this.",
          "Pushing a paid signal group, paid course, or paid Discord as the real value, with free content mainly existing to funnel you there.",
          "Constant hype around specific low-liquidity coins, especially ones they claim to be personally holding.",
          "No visible track record, or a track record that only ever shows wins.",
        ],
      },
      {
        heading: "What actually holds up",
        paragraphs: [
          "The exchange-run academies and TradingView/Investopedia's own documentation above are stable, free, and don't have an incentive to sell you a signal group, which is why they're the starting point here. Once the fundamentals from this page feel solid, applying them by watching real, live charts (on Bonnco, Binance, or Bybit) teaches faster than any amount of additional reading.",
        ],
      },
    ],
    keyTakeaways: [
      "Exchange-run academies (Binance Academy, Bybit Learn) and TradingView/Investopedia are stable, free, and don't sell signal groups.",
      "Evaluate any individual educator against the same checklist: no guarantees, no pressure toward paid signals, a visible real track record.",
      "The fastest way to build real skill from here is watching live charts, not consuming more reading alone.",
    ],
  },
];

export const CHART_GROUP_LABEL = "Charts & Platforms";
export const CHART_GROUP_BLURB =
  "How to read any chart type, on any exchange: chart types, candle anatomy, how Binance and Bybit's own screens differ from Bonnco's, and where to keep learning.";

// ---------------------------------------------------------------------------------------------
// Step-by-step guides
// ---------------------------------------------------------------------------------------------

export type GuideId = "analysis-guide" | "spot-guide" | "futures-guide" | "profit-guide" | "losing-position-guide";

export interface GuideStep {
  step: number;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  tip?: string;
  warning?: string;
}

export interface Guide {
  id: GuideId;
  title: string;
  tagline: string;
  audience: string;
  steps: GuideStep[];
}

export const GUIDES: Guide[] = [
  {
    id: "analysis-guide",
    title: "How to Analyze the Market Before You Trade",
    tagline: "The reading you do before you ever touch the order form, spot or futures.",
    audience: "Best for: anyone about to open a position, before following the spot or futures buying guides below.",
    steps: [
      {
        step: 1,
        title: "Pick a timeframe that matches your plan",
        paragraphs: [
          "Decide how long you actually intend to hold before you look at a single indicator. A scalp you'll close in minutes calls for the 5m or 15m chart; a swing trade you might hold for days calls for the 4h or 1D chart. Reading the wrong timeframe for your plan is one of the most common beginner mistakes, since a 5m chart is naturally choppier and will talk you out of a perfectly good multi-day trade.",
        ],
      },
      {
        step: 2,
        title: "Check the higher timeframe trend first",
        paragraphs: [
          "Before reading your chosen timeframe in detail, glance at a longer one (if you're trading the 15m, check the 4h or 1D). Trading with the higher timeframe trend, not against it, meaningfully improves the odds of any individual indicator reading actually playing out.",
        ],
      },
      {
        step: 3,
        title: "Read momentum: RSI and MACD",
        paragraphs: [
          "Check whether RSI is overbought (70+), oversold (30-), or neutral, and whether MACD is above or below its signal line, and whether that crossover is fresh or stale. Neither one alone should decide anything, see How Bonnco's Indicators Read for exactly how much weight each carries in Bonnco's own scoring.",
        ],
      },
      {
        step: 4,
        title: "Check the trend structure: EMA9/21/50/200",
        paragraphs: [
          "Is price above or below its EMA50 and EMA200 (the longer-term trend), and has EMA9 crossed EMA21 recently (the shorter-term momentum shift)? This tells you whether momentum and trend currently agree or are fighting each other.",
        ],
      },
      {
        step: 5,
        title: "Check Bollinger Bands for volatility context",
        paragraphs: [
          "Is price riding the upper or lower band, and are the bands wide (high volatility) or tightly squeezed (low volatility, often right before a big move)? Riding a band isn't automatically bullish or bearish on its own, context from RSI and trend decides which it is.",
        ],
      },
      {
        step: 6,
        title: "Check volume and buy/sell delta",
        paragraphs: [
          "Is volume actually confirming the move, or is price drifting on quiet, low-interest volume? Where available, check the buy/sell delta (net aggressive buying vs selling) rather than raw volume alone, since delta shows you which side is actually being aggressive.",
        ],
      },
      {
        step: 7,
        title: "Look for a chart pattern",
        paragraphs: [
          "Check whether a recognizable pattern, reversal, continuation, or candlestick, is actually forming, and how complete or confirmed it is. A pattern still forming is a different situation than one that's already confirmed with a real breakout.",
        ],
      },
      {
        step: 8,
        title: "Check news sentiment",
        paragraphs: [
          "A strong technical setup fighting strongly negative coin-specific news is a genuinely different situation than one with neutral or supportive news. Check the recent sentiment score and headline count for the coin before finalizing a read.",
        ],
      },
      {
        step: 9,
        title: "Check support and resistance",
        paragraphs: [
          "Find the nearest real, previously-tested support and resistance levels and how close price currently sits to each. A textbook-perfect setup sitting right under strong resistance is riskier than the identical setup with clear room to run.",
        ],
      },
      {
        step: 10,
        title: "Put it together: does the evidence actually agree?",
        paragraphs: [
          "This is the step that matters most. Several factors pointing the same direction (confluence) is a meaningfully stronger case than one strong-looking factor fighting against several disagreeing ones. This is exactly why Bonnco combines six technical factors plus sentiment into one score instead of trading off any single reading, see Why Bonnco Combines Multiple Factors for the full mechanics.",
        ],
        tip: "Reading Bonnco's own signal and full reasoning for the coin and timeframe you're about to trade does this exact synthesis for you, and it's worth comparing your own read against it before entering.",
      },
      {
        step: 11,
        title: "Only now: decide spot or futures, and size the position",
        paragraphs: [
          "Direction and conviction come from everything above, not from which market you trade. Once you have a real read, then decide whether spot (simpler, capped risk) or futures (leverage, can go short) fits the setup and your risk tolerance, and size the position using the same discipline covered in Risk Management. Follow the Spot Trading or Futures Trading guide below for the actual order-placing steps.",
        ],
      },
    ],
  },
  {
    id: "spot-guide",
    title: "How to Spot Trade BTC/USDT on Binance",
    tagline: "A complete first-trade walkthrough, one step at a time.",
    audience: "Best for: complete beginners placing their first spot trade.",
    steps: [
      {
        step: 1,
        title: "Create and verify your Binance account",
        paragraphs: [
          "Go to Binance and register with your email or phone number, choose your country, and set a strong password. You will need to complete identity verification (KYC) before you can deposit and trade, which usually means submitting a government ID and a quick photo check.",
        ],
        tip: "Use a password you don't use anywhere else, and turn on two-factor authentication (2FA) as soon as your account is created.",
      },
      {
        step: 2,
        title: "Fund your Spot Wallet",
        paragraphs: [
          "You need USDT (or another stablecoin) in your Spot Wallet before you can buy BTC. Deposit crypto directly from another wallet or exchange, or buy USDT with a card/bank transfer if Binance offers that in your region.",
        ],
        warning: "Double-check the deposit network (e.g. TRC20 vs ERC20 vs BEP20) matches on both sides. Sending on the wrong network can permanently lose funds.",
      },
      {
        step: 3,
        title: "Open the Spot trading page",
        paragraphs: [
          "From the top menu, go to Trade → Spot. This opens the trading interface: a price chart in the middle, the order book (live buy/sell orders) usually on the side, and the order form below or beside the chart.",
        ],
      },
      {
        step: 4,
        title: "Search for the BTC/USDT pair",
        paragraphs: [
          "Use the pair search box (usually near the top of the trading interface) and type BTC to find BTC/USDT. Selecting it loads BTC's live price chart and order book.",
        ],
      },
      {
        step: 5,
        title: "Choose your order type",
        paragraphs: [
          "In the order form, pick Market if you want to buy immediately at the current price, or Limit if you want to set your own price and wait for the market to reach it. Beginners often start with Market orders for simplicity, then move to Limit orders as they get more comfortable with price control.",
        ],
        tip: "This choice also decides your fee: a Limit order that sits and waits pays the lower maker fee, a Market order pays the slightly higher taker fee. See Trading Fees You Should Know About for the exact difference.",
      },
      {
        step: 6,
        title: "Enter the amount and review",
        paragraphs: [
          "Enter either how much USDT you want to spend or how much BTC you want to buy. The form calculates the other side automatically. Review the total, including the estimated fee, before confirming.",
        ],
      },
      {
        step: 7,
        title: "Place the buy order",
        paragraphs: [
          "Click Buy BTC to submit the order. A market order fills almost instantly; a limit order will sit and wait until the market reaches your price (visible under Open Orders until then).",
        ],
      },
      {
        step: 8,
        title: "Track your position and decide when to sell",
        paragraphs: [
          "Your BTC now sits in your Spot Wallet. There's no time limit and no liquidation risk. You decide when (or if) to sell. Many traders set a target price in mind, or a mental (or actual limit-order) stop-loss level, before they even buy.",
        ],
      },
      {
        step: 9,
        title: "Sell to close the trade",
        paragraphs: [
          "When you're ready, go back to the BTC/USDT trading page, switch to the Sell side of the order form, choose Market or Limit the same way as buying, and submit. Your USDT balance updates immediately, and that's your trade complete.",
        ],
        tip: "Check Bonnco's signal and reasoning for BTC/USDT before deciding your entry and exit, but the final call, and the order itself, is always yours.",
      },
    ],
  },
  {
    id: "futures-guide",
    title: "How to Futures Trade BTC/USDT on Binance",
    tagline: "Leverage, long/short, and risk controls, walked through step by step.",
    audience: "Best for: traders who already understand spot trading and want to add leverage carefully.",
    steps: [
      {
        step: 1,
        title: "Activate your Futures account",
        paragraphs: [
          "From the Derivatives menu, choose USDⓈ-M Futures and click to open a Futures account. Binance requires you to pass a short quiz first, covering the basics of leverage and liquidation risk. This is a real safeguard, not a formality, so take it seriously.",
        ],
      },
      {
        step: 2,
        title: "Transfer funds into your Futures Wallet",
        paragraphs: [
          "Your Spot Wallet and Futures Wallet are separate. Use the Transfer function to move USDT from Spot into your USDⓈ-M Futures Wallet. This becomes the margin you'll trade with.",
        ],
      },
      {
        step: 3,
        title: "Open the Futures trading page and select BTC/USDT",
        paragraphs: [
          "Go to the Futures trading interface and search for the BTC/USDT perpetual pair. The layout looks similar to spot, with a chart, order book, and order form, plus new leverage and margin-mode controls.",
        ],
      },
      {
        step: 4,
        title: "Choose your margin mode: isolated or cross",
        paragraphs: [
          "Isolated margin limits risk to only the margin you assign to this specific position. Cross margin shares your whole Futures Wallet balance as backup for every open position. Beginners are generally better off with isolated, so each trade's risk stays contained and clearly visible.",
        ],
      },
      {
        step: 5,
        title: "Set your leverage",
        paragraphs: [
          "Use the leverage slider to pick your multiplier. Lower leverage (2x-5x) gives price much more room to move before you're at risk of liquidation. Higher leverage (20x+) is significantly riskier and can liquidate on completely normal market noise, not just a real trend reversal.",
        ],
        warning: "High leverage is not a shortcut to bigger profits without bigger risk. It's a direct trade of safety margin for position size. Start low.",
      },
      {
        step: 6,
        title: "Decide: Long or Short",
        paragraphs: [
          "If you expect BTC's price to rise, you open a Long. If you expect it to fall, you open a Short. This decision should be based on your own analysis, or Bonnco's signal and reasoning for BTC/USDT on the timeframe you're trading.",
        ],
      },
      {
        step: 7,
        title: "Choose order type and position size",
        paragraphs: [
          "Pick Market or Limit the same way as spot, then enter your position size (often shown in USDT value or in BTC contracts). The form will show your estimated liquidation price before you confirm. Always check it.",
        ],
        tip: "Same maker/taker split as spot (Limit = lower fee, Market = higher fee), plus futures adds a recurring funding rate while the position stays open. See Trading Fees You Should Know About.",
      },
      {
        step: 8,
        title: "Set Take-Profit and Stop-Loss",
        paragraphs: [
          "Before or immediately after opening the position, set a Take-Profit (where you'll automatically lock in gains) and a Stop-Loss (where you'll automatically exit a losing trade). Set your stop-loss well before your liquidation price so you're the one deciding the exit, not the exchange.",
        ],
      },
      {
        step: 9,
        title: "Click Buy/Long or Sell/Short to open the position",
        paragraphs: [
          "Confirm the order. Your position now appears under Positions, showing live unrealized P&L, your entry price, and your liquidation price, updating in real time as the market moves.",
        ],
      },
      {
        step: 10,
        title: "Monitor and close the position",
        paragraphs: [
          "Watch your position's unrealized P&L and the distance to your liquidation price. Close it manually at any time, or let your take-profit/stop-loss close it automatically once price reaches one of those levels.",
        ],
        tip: "Closing a losing trade at your planned stop-loss is a disciplined decision, not a failure. It's what keeps one bad trade from becoming a disaster.",
      },
    ],
  },
  {
    id: "profit-guide",
    title: "How to Approach Trading for Profit (BTC/USDT and Altcoins)",
    tagline: "No guide can guarantee profit. This is the process disciplined traders actually follow.",
    audience: "Best for: anyone who has grasped the fundamentals above and wants a repeatable process.",
    steps: [
      {
        step: 1,
        title: "Accept that no signal is ever certain",
        paragraphs: [
          "Every tool, including Bonnco, gives you probabilities and reasoning, never a guarantee. Trading for profit is a game of stacking the odds in your favor over many trades, managing losses well, not being right every single time.",
        ],
      },
      {
        step: 2,
        title: "Start with BTC/USDT and ETH/USDT before altcoins",
        paragraphs: [
          "BTC and ETH are the most liquid, most-covered, and generally least volatile of the crypto majors relative to smaller altcoins. They're the standard place to build your skills, since price action tends to be comparatively cleaner and less prone to sudden, thin-liquidity wicks.",
        ],
      },
      {
        step: 3,
        title: "Combine multiple confirmations, not one signal alone",
        paragraphs: [
          "Bonnco deliberately scores multiple factors together (RSI, MACD, EMA trend, Bollinger Bands, support/resistance, volume delta, chart patterns) rather than trading off any single indicator, because any one indicator alone gives false signals fairly often. Look for agreement across factors, and read the full reasoning, not just the headline BUY/SELL/HOLD.",
        ],
      },
      {
        step: 4,
        title: "Check the timeframe matches your plan",
        paragraphs: [
          "A BUY on the 5-minute chart and a SELL on the 1-day chart for the same coin are not a contradiction. They're describing different trading horizons. Pick a timeframe that matches how long you actually intend to hold the trade, and read Bonnco's signal for that timeframe specifically.",
        ],
      },
      {
        step: 5,
        title: "Size the position before you decide direction",
        paragraphs: [
          "Decide how much of your capital this trade deserves before you get emotionally attached to being long or short. A good setup with a badly oversized position is still a bad trade. See Risk Management above for sizing guidelines.",
        ],
      },
      {
        step: 6,
        title: "Set your stop-loss and take-profit as part of entering, not after",
        paragraphs: [
          "Decide, in advance, the price where you're proven wrong (stop-loss) and the price where you'll take your win (take-profit). Writing these down before entering removes emotion from the moment you'll need discipline the most.",
        ],
      },
      {
        step: 7,
        title: "Altcoins: same process, bigger swings, thinner liquidity",
        paragraphs: [
          "Smaller altcoins can move much faster in both directions, and their order books are thinner, meaning your own order can move the price more, and slippage is more likely. The same analysis process applies, but position sizes should generally be smaller and stop-losses given a bit more room for the coin's normal volatility, not tighter.",
        ],
        warning: "Low-liquidity altcoins are also more exposed to sudden whale sell-offs and thin order books. Check the Whale Activity page for large recent transfers before sizing an altcoin trade.",
      },
      {
        step: 8,
        title: "Review your trades honestly",
        paragraphs: [
          "Keep a record of what you traded, why, and the outcome (Bonnco's Trade Journal is built for exactly this). Over enough trades, this is how you find out whether your process is actually working, rather than relying on memory, which tends to remember the wins and forget the losses.",
        ],
      },
      {
        step: 9,
        title: "Expect losing trades: plan for them, don't fear them",
        paragraphs: [
          "Even a genuinely good process loses a meaningful share of the time. The goal isn't a perfect record, it's making sure your average win, combined with strict risk management, outweighs your average loss over time. That's what separates trading as a skill from trading as gambling.",
        ],
      },
    ],
  },
  {
    id: "losing-position-guide",
    title: "What to Do When You're in a Losing Position",
    tagline: "A simple framework for the moment that actually tests you: watching a real position move against you.",
    audience: "Best for: anyone holding an open position right now, especially a red one. Pairs directly with the Active Positions panel on your Trade Journal.",
    steps: [
      {
        step: 1,
        title: "Two different situations get confused as one",
        paragraphs: [
          "\"I'm down money\" always feels the same, but it usually means one of two very different things: either normal volatility within a thesis that's still intact, or a setup that has genuinely weakened and no longer supports the trade you opened. Reacting to the first as if it were the second gets you shaken out of good trades; reacting to the second as if it were the first turns a small, planned loss into a large, unplanned one.",
        ],
      },
      {
        step: 2,
        title: "How to actually tell them apart",
        paragraphs: [
          "Don't guess from the price move alone, check whether the reason you entered is still true. Bonnco's Active Position Coach does this comparison for you automatically every time you check an open trade: it re-reads the coin's current signal and indicators and compares them to what they looked like the moment you opened the position.",
        ],
        bullets: [
          "\"The original thesis is still intact, no clear exit signal yet\" — this is normal volatility. The price moved, but the reason you're in the trade hasn't changed. No action needed beyond what your plan already says.",
          "\"The original setup has weakened\" or \"Bonnco's current read has flipped\" — this is a genuine change. The conditions that justified the trade are no longer there, even if your stop-loss hasn't been hit yet.",
          "\"Bonnco's current read has cooled to HOLD\" — a middle case. Not a reversal, but conviction has softened. Worth paying closer attention, not necessarily worth exiting immediately.",
        ],
      },
      {
        step: 3,
        title: "A stop-loss only protects you if you set it before the fear starts",
        paragraphs: [
          "The entire point of deciding a stop-loss when you open a trade, with a clear head and no money currently on the line emotionally, is that it removes the decision from the moment you're least equipped to make it well. Fear and hope are both persuasive in the moment: fear says get out now even when the thesis is fine, hope says give it more room even when the thesis has clearly broken.",
          "If you logged a stop-loss when you opened the trade, the Active Position Coach shows you that exact number on every visit, and warns you plainly when price is approaching it. That's not a suggestion made up after the fact, it's the decision you already made before emotion was involved. Letting a live, in-the-moment feeling override a pre-committed plan is usually the more expensive mistake, in either direction.",
        ],
        warning: "If you don't have a stop-loss logged for a trade, it's worth deciding one now, even mid-trade, rather than continuing to hold with no predefined exit at all.",
      },
      {
        step: 4,
        title: "Closing a small loss on a weakened setup is the plan working, not failing",
        paragraphs: [
          "It's easy to experience a closed loss as \"I lost.\" Reframe it: the plan said if the setup weakens, get out, and you did exactly that. A small, planned loss on a setup that stopped making sense is a normal, healthy, recurring part of a working process, not a mistake to feel bad about.",
          "The trades that actually damage an account long-term are usually the opposite: refusing to exit a weakened setup, moving a stop-loss further away mid-trade to avoid \"admitting\" a loss, or adding to a losing position without a new, genuine reason. A string of small, disciplined losses is healthy. A single large, undisciplined one is what actually hurts.",
        ],
      },
      {
        step: 5,
        title: "Put it together with the Active Position Coach",
        paragraphs: [
          "Each time you check an open position, read the guidance the same way every time: has the reason you entered changed, or hasn't it? If it hasn't, normal volatility, stick to the plan you already made. If it has, that's real information, weigh it honestly against your logged stop-loss rather than hoping it turns around. Either way, the decision is always yours, this is decision support, not an instruction.",
        ],
      },
    ],
  },
];

export const GUIDE_GROUP_LABEL = "Step-by-Step Guides";
export const GUIDE_GROUP_BLURB =
  "Complete, ordered walkthroughs for placing your first spot trade, your first futures trade, and building a repeatable process for aiming at profit.";
