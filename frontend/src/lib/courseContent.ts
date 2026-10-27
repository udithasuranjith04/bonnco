// The full beginner-to-profitable course: a numbered path through readiness, analysis, risk,
// timing, holding periods, volatility, discipline, decision-making, and portfolio thinking. Each
// article reuses the exact same FundamentalTopic shape and FundamentalView renderer as every other
// Study page article, this is a distinct curriculum, not a distinct content system.
import type { FundamentalTopic } from "./tradingBasicsContent";

export const COURSE_GROUP_LABEL = "Full Course";
export const COURSE_GROUP_BLURB =
  "A numbered path from complete beginner to a repeatable process, start at step 1 and work through in order, or jump to whatever you need.";

export const COURSE_TOPICS: FundamentalTopic[] = [
  {
    id: "course-readiness",
    title: "1. Before You Trade At All",
    tagline: "The readiness check that happens before you open a chart, not after.",
    sections: [
      {
        heading: "Are you actually financially ready?",
        paragraphs: [
          "Only ever trade with money you could genuinely afford to lose completely without it affecting your life. Not money set aside for rent, not an emergency fund, not borrowed money. This isn't a formality, crypto is volatile even on spot and dramatically more so with leverage, and trading with money you can't afford to lose is what turns a bad week into a real problem. See Risk Management for the full picture.",
        ],
      },
      {
        heading: "Set up a demo or paper trading habit first",
        paragraphs: [
          "Before risking real money, practice the actual mechanics: placing an order, setting a stop-loss, watching a position move, closing it, on Binance's own testnet, a demo account, or simply by tracking hypothetical trades on paper using Bonnco's real signals without actually executing them. The goal isn't to prove you'll be profitable, paper trading removes real risk and real emotion, so it can't fully prepare you for either, it's to make the mechanical part (which button does what) boring and automatic before real money is involved.",
        ],
      },
      {
        heading: "Readiness isn't a one-time checkbox",
        paragraphs: [
          "Being ready to trade today doesn't mean you're ready every day. A stressful week, a string of recent losses, or being genuinely unfamiliar with a coin you're considering are all reasons to sit out a specific trade even if you've traded plenty before. See When Not to Trade later in this course for the specific situations worth recognizing.",
        ],
      },
    ],
    keyTakeaways: [
      "Only ever trade money you could fully afford to lose, no exceptions.",
      "Practice the mechanics (orders, stop-losses, closing positions) before real money is involved.",
      "Readiness is a per-trade question, not something you prove once and never revisit.",
    ],
  },
  {
    id: "course-analysis-checklist",
    title: "2. How to Analyze a Coin Before Entering",
    tagline: "The exact checklist Bonnco's own signal engine runs, and where to find each answer in the app.",
    sections: [
      {
        heading: "This mirrors Bonnco's own signal engine on purpose",
        paragraphs: [
          "Bonnco's combined score is built from six technical factors (RSI, MACD, EMA structure, Bollinger Bands, volume, support/resistance) blended 70/30 with news sentiment, see How Bonnco's Indicators Read for the exact weighting of each. This article is the same checklist, done by hand, so you can sanity-check the app's own reasoning instead of taking it on faith. For the full step-by-step version of this process, see How to Analyze the Market Before You Trade in the Step-by-Step Guides section, this article focuses specifically on where in Bonnco each answer actually lives.",
        ],
      },
      {
        heading: "Where to check each factor in the app",
        bullets: [
          "Trend and indicator readings: open a coin's Coin Detail page, the chart and the RSI/MACD/EMA/Bollinger readings are all there together.",
          "The combined read and confidence: the signal card on Dashboard or Coin Detail shows the actual BUY/SELL/HOLD call and confidence percentage.",
          "Full reasoning in plain English: click 'Show full reasoning' on any signal card, it names which specific factors are driving the call.",
          "News sentiment: shown as part of the signal reasoning, and in full on the News Feed page.",
          "Chart patterns: shown on Coin Detail below the chart when one is currently detected.",
          "Historical pattern outcomes for that coin: ask Bonnco directly in the chat.",
        ],
      },
      {
        heading: "Then decide, don't just read",
        paragraphs: [
          "Checking every factor and still not forming a view is itself useful information, it usually means the evidence genuinely disagrees, which is exactly when Bonnco tends to show HOLD. The checklist isn't complete until you've actually decided: enter, wait, or skip this one.",
        ],
      },
    ],
    keyTakeaways: [
      "This checklist is intentionally the same one Bonnco's signal engine runs, so you can verify its reasoning, not just trust it.",
      "Every factor in the checklist has a specific, findable place in the app, this isn't abstract.",
      "The checklist isn't done until you've reached an actual decision, not just a pile of readings.",
    ],
  },
  {
    id: "course-position-sizing",
    title: "3. Position Sizing and Risk Per Trade",
    tagline: "The math that decides how much to buy, worked out for you, not just explained.",
    visual: "position-calculator",
    sections: [
      {
        heading: "Decide the dollar loss first, work backward from there",
        paragraphs: [
          "The common mistake is picking a position size first (often 'as much as feels comfortable') and only then discovering what a stop-loss actually costs. The more reliable order of operations: decide what dollar amount you're willing to lose on this trade (a common guideline is 1-2% of your total account), then size the position so that your stop-loss, if hit, costs exactly that amount, no more.",
        ],
      },
      {
        heading: "The formula behind the calculator above",
        paragraphs: [
          "Risk amount = account size x risk %. Stop-loss distance = how far your stop is from your entry, as a percentage. Position size = risk amount / stop-loss distance %. A tighter stop-loss allows a larger position for the same dollar risk; a wider stop-loss requires a smaller one, the dollar amount at risk is what stays constant, not the position size.",
        ],
      },
      {
        heading: "This is exactly why volatility matters here too",
        paragraphs: [
          "A coin with wider, more volatile candles usually needs a wider stop-loss just to avoid being stopped out by normal noise (see Reading Volatility later in this course), which this formula automatically turns into a smaller position size for the same dollar risk, sizing and volatility are directly connected, not separate decisions.",
        ],
      },
    ],
    keyTakeaways: [
      "Decide the dollar amount you're willing to lose first, then size the position around your stop-loss distance, not the other way around.",
      "Position size = risk amount / stop-loss distance %, a tighter stop allows a larger size for the same dollar risk.",
      "A more volatile coin needing a wider stop will naturally call for a smaller position size at the same risk %.",
    ],
  },
  {
    id: "course-entry-timing",
    title: "4. Entry Timing: When You Enter Matters",
    tagline: "The same setup can be a very different trade depending on what's happening around it.",
    scale: {
      zones: [
        { label: "RISKY: around major news/data releases", from: 0, to: 30, color: "#ef4444" },
        { label: "CAUTIOUS: thin, low-liquidity hours", from: 30, to: 55, color: "#eab308" },
        { label: "TYPICALLY CALMER: normal active hours", from: 55, to: 100, color: "#22c55e" },
      ],
      min: 0,
      max: 100,
      marker: 78,
      markerLabel: "Most trading happens here",
    },
    sections: [
      {
        heading: "Around major news and scheduled data releases",
        paragraphs: [
          "Scheduled events (major economic data, large exchange or protocol announcements) can cause a sudden burst of volatility in both directions within seconds, spreads widen, slippage increases, and stop-losses can fill at a noticeably worse price than expected. Many experienced traders deliberately avoid opening new positions in the minutes immediately around events like this, not because the move is unpredictable, but because the execution quality genuinely gets worse.",
        ],
      },
      {
        heading: "Low-liquidity hours",
        paragraphs: [
          "Crypto trades 24/7, but real trading activity still has quieter stretches (commonly late at night across the major trading regions). Thinner order books mean a given order size moves price more than it would during active hours, and wicks can be sharper and less meaningful. It's not that trading during these hours is wrong, it's that the same size position carries a bit more execution risk than it would during busier hours.",
        ],
      },
      {
        heading: "Normal active hours",
        paragraphs: [
          "Most trading volume happens when multiple major regions are active simultaneously, deeper liquidity generally means tighter spreads and price that moves more in response to real supply and demand than to a single large order. This is where most entries and exits tend to execute closest to the price you actually intended.",
        ],
      },
    ],
    keyTakeaways: [
      "The minutes around major scheduled news or data releases are when execution quality (slippage, spreads) tends to be worst.",
      "Low-liquidity hours (often late night) mean the same order size moves price more than usual.",
      "Timing doesn't change whether your analysis was right, it changes how well your entry and exit actually execute.",
    ],
  },
  {
    id: "course-holding-periods",
    title: "5. How Long to Hold a Position",
    tagline: "Scalping, day trading, and swing trading are really just different answers to 'how long', matched to a timeframe.",
    compareTable: {
      columns: ["Scalping", "Day trading", "Swing trading"],
      rows: [
        { label: "Typical hold time", values: ["Seconds to minutes", "Minutes to hours, closed same day", "Days to weeks"] },
        { label: "Timeframe to watch", values: ["1m-5m", "5m-1h", "4h-1D"] },
        { label: "Trades per week (roughly)", values: ["Many per day", "Several per week", "A handful per month"] },
        { label: "Attention required", values: ["Constant, active screen time", "Active during trading hours", "Periodic check-ins"] },
      ],
    },
    sections: [
      {
        heading: "Pick the style that matches your actual life, not your ambition",
        paragraphs: [
          "Scalping and day trading demand real, sustained attention, they're not compatible with a full-time job running in the background. Swing trading demands patience and comfort holding through normal multi-day fluctuations without checking every five minutes. Picking a style that doesn't fit how much attention you can genuinely give it is a common way discipline breaks down, not because the analysis was wrong, but because the style itself wasn't sustainable.",
        ],
      },
      {
        heading: "The timeframe you watch should match the style, not the other way around",
        paragraphs: [
          "A swing trader reading the 5m chart will see noise that looks like a reason to exit every few minutes, noise that's completely irrelevant to a multi-day plan. Match your Bonnco timeframe selector to your actual intended hold time (see Choosing a Timeframe for Your Trading Style in the Chart Patterns & Indicators section), and mostly ignore the shorter timeframes once you're in a swing position, they weren't the timeframe the trade was planned on.",
        ],
      },
    ],
    keyTakeaways: [
      "Scalping and day trading require real active attention; swing trading requires patience through normal noise instead.",
      "Match the timeframe you're watching to your intended hold time, not the other way around.",
      "The best style is the one that fits how much attention you can realistically sustain, not the one that sounds most exciting.",
    ],
  },
  {
    id: "course-volatility",
    title: "6. Reading Volatility",
    tagline: "What a genuinely dangerous market actually looks like on a chart, side by side with a calm one.",
    visual: "volatility-compare",
    sections: [
      {
        heading: "What calm looks like",
        paragraphs: [
          "Candle bodies stay a fairly consistent, moderate size. Wicks are short. Price drifts rather than lurches. This doesn't mean nothing is happening, it means moves are proportionate and easier to plan a stop-loss and position size around.",
        ],
      },
      {
        heading: "What genuinely dangerous looks like",
        paragraphs: [
          "Candle bodies swing wildly in size, sometimes tiny, sometimes enormous, with long wicks reaching both directions. Consecutive candles flip between strong green and strong red rather than drifting. This is when normal-sized stop-losses get hit by noise rather than a real reversal, and when slippage on both entries and exits tends to be worst.",
        ],
      },
      {
        heading: "What to actually do differently in each",
        bullets: [
          "In a calm market: normal position sizing and stop-loss distances (see Position Sizing) tend to hold up as planned.",
          "In a volatile market: widen your stop-loss distance to avoid being stopped out by noise, which the position sizing formula will automatically turn into a smaller position for the same dollar risk.",
          "In a volatile market: consider whether this is also a time from When Not to Trade, sometimes the better move is smaller size or no trade at all, not just a wider stop.",
        ],
      },
    ],
    keyTakeaways: [
      "Calm markets show consistent candle sizes and short wicks; dangerous markets show wild, inconsistent sizing with long wicks both ways.",
      "Volatility should change your stop-loss distance and position size, not just how nervous you feel.",
      "Sometimes the right response to real volatility is smaller size or sitting out entirely, not just adjusting the numbers.",
    ],
  },
  {
    id: "course-when-not-to-trade",
    title: "7. When NOT to Trade",
    tagline: "Recognizing a bad setup is a skill. Recognizing a bad moment to trade at all is a separate, equally important one.",
    sections: [
      {
        heading: "Choppy, directionless markets",
        paragraphs: [
          "When price is stuck in a tight range with no clear trend (see Reading Trend Structure), indicators tend to give noisier, less reliable, more frequently-reversing readings. It's not that a range can't be traded at all, it's that the confluence Bonnco and this whole checklist depend on is genuinely harder to find here, and forcing a trade anyway is a common source of avoidable losses.",
        ],
      },
      {
        heading: "Right around major news events",
        paragraphs: [
          "Covered in Entry Timing: wider spreads and worse slippage right around scheduled events make even a correct read execute worse than it would in calmer conditions.",
        ],
      },
      {
        heading: "When your own emotions are compromised",
        paragraphs: [
          "Revenge trading, taking a larger, less-planned position specifically to 'win back' a recent loss, is one of the most consistent ways a single bad trade turns into a genuinely bad week. So is trading out of boredom or FOMO on a coin you hadn't actually analyzed. If you notice you're about to size a trade differently than you normally would because of how the last one felt, that's usually the clearest sign to step away rather than trade.",
        ],
      },
      {
        heading: "This connects directly to risk management",
        paragraphs: [
          "Every situation above is really the same underlying risk management principle from earlier in this app, applied to timing instead of position size: protect yourself from the moments, not just the setups, that put your capital at unnecessary risk. See Risk Management for the fuller picture.",
        ],
      },
    ],
    keyTakeaways: [
      "Choppy, range-bound markets tend to produce noisier, less reliable signals, forcing a trade here is a common avoidable mistake.",
      "Wider spreads and slippage around major news events can turn even a correct read into a worse trade.",
      "Trading to 'win back' a loss, or out of boredom rather than analysis, is one of the clearest signs to step away instead.",
    ],
  },
  {
    id: "course-buy-sell-practice",
    title: "8. Buy vs Sell Decision-Making in Practice",
    tagline: "A full worked example, start to finish, of what a real signal actually means and what a trader would do with it.",
    worked: {
      title: "Illustrative example: BTC/USDT, 1h timeframe, BUY at 65% confidence",
      lines: [
        "Signal: BUY, 65% confidence.",
        "Reasoning: price above EMA50/EMA200 (established uptrend); MACD above signal line (bullish momentum);",
        "RSI at 58 (neutral, room to run before overbought); nearest resistance 1.8% above current price;",
        "volume steady at 1.1x the 20-candle average; news sentiment mildly positive over the last 24h.",
      ],
    },
    sections: [
      {
        heading: "How a trader would actually read this",
        paragraphs: [
          "65% sits in Bonnco's 'moderate' confidence band, not the 'low' band, but not 'high' either, several factors agree (trend, momentum, sentiment), while RSI and resistance proximity are more neutral than strongly supportive. This is a genuinely reasonable case for a long, not an overwhelming one. A trader reading this checks the same things this whole course has covered: does the trend structure agree, is a support/resistance level nearby that changes the picture, and what does the higher timeframe show.",
        ],
      },
      {
        heading: "What actually happens next, mechanically",
        paragraphs: [
          "If the read holds up, the trader moves to Position Sizing (decide risk %, find a stop-loss level, let the calculator size the position), not straight to placing an order. The stop-loss itself usually sits just beyond a real support level or recent swing low, not an arbitrary percentage, see Support and Resistance, Visually.",
        ],
      },
      {
        heading: "What a SELL or HOLD would change",
        paragraphs: [
          "A SELL signal on futures reads the same way in reverse (a short candidate); on spot, where shorting isn't available, it more often means 'not an attractive entry right now' or 'consider exiting if already holding', see Going Long vs Going Short. A HOLD means the evidence didn't clear the bar either direction, the correct action is often no action, not forcing a read that isn't really there.",
        ],
      },
      {
        heading: "See this with real, live numbers",
        paragraphs: [
          "This example is illustrative, deliberately fixed so it can be explained step by step. To see this exact reasoning generated live for a real coin right now, open any coin's Coin Detail page or the Dashboard, every signal card there is built the same way, with real current numbers instead of the example above.",
        ],
      },
    ],
    keyTakeaways: [
      "A moderate confidence score means several factors agree while others are closer to neutral, not an overwhelming case either way.",
      "A signal is the start of the decision, not the end, sizing and stop-loss placement still come after.",
      "This exact walkthrough is available live for real coins on the Dashboard and Coin Detail pages, this article explains the reasoning behind what you'd see there.",
    ],
  },
  {
    id: "course-portfolio-approach",
    title: "9. Building an Actual Portfolio Approach",
    tagline: "Thinking beyond a single trade: what you hold, why, and how to know if the whole approach is actually working.",
    compareTable: {
      columns: ["Core position", "Satellite position"],
      rows: [
        { label: "Typical example", values: ["BTC, sometimes ETH", "Higher-beta alts, e.g. SOL-type assets"] },
        { label: "Role", values: ["Relatively more stable base holding", "Faster-moving, higher risk and reward"] },
        { label: "Typical volatility", values: ["Lower, relative to altcoins", "Higher, larger swings both ways"] },
        { label: "Sizing implication", values: ["Can reasonably carry more weight", "Usually sized smaller per position"] },
      ],
    },
    sections: [
      {
        heading: "Not putting everything into one coin",
        paragraphs: [
          "Concentrating entirely in a single coin means a single coin-specific event (an exploit, a regulatory headline, a project-specific failure) can affect your entire position, a risk spread across several positions doesn't fully avoid, but does reduce. This isn't about how many coins to hold for its own sake, it's about not letting one coin-specific event decide your whole outcome.",
        ],
      },
      {
        heading: "Core vs satellite thinking",
        paragraphs: [
          "A common structure: treat BTC (and sometimes ETH) as a relatively more stable core holding, with smaller, more selectively-timed positions in higher-beta assets like SOL-type coins, which move faster and harder in both directions (see Per-Asset Structural Differences, referenced throughout Ask Bonnco). This isn't a guarantee BTC moves less on any given day, it's a general tendency worth building position sizing around, not a rule.",
        ],
      },
      {
        heading: "Review your actual results, don't rely on memory",
        paragraphs: [
          "Memory tends to remember wins and undersell losses. Log every trade, win or lose, in the Trade Journal, and periodically review your real win rate, average win size versus average loss size, and whether your process (this entire course) is actually being followed or quietly skipped under pressure. A process that looks good in theory but isn't followed in practice isn't actually your process.",
        ],
      },
    ],
    keyTakeaways: [
      "Spreading risk across more than one coin reduces how much a single coin-specific event can affect your whole position.",
      "Core (BTC/ETH) vs satellite (higher-beta alts) is a common structure, a general tendency to size around, not a guarantee.",
      "Use the Trade Journal to review real results periodically, memory alone tends to remember wins and undersell losses.",
    ],
  },
];
