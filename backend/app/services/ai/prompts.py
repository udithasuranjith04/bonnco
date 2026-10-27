def build_sentiment_prompt(title: str, summary: str) -> str:
    return f"""You are an experienced crypto markets news analyst. Analyze this headline for its likely
short-term impact on crypto markets and respond with a JSON object.

Headline: {title}
Summary: {summary or "(no summary available)"}

Respond ONLY with a JSON object with exactly these keys:
- "sentiment": one of "bullish", "bearish", "neutral"
- "confidence": a number from 0 to 1 representing how confident you are in this call
- "related_symbols": array of uppercase base ticker symbols this headline is specifically about
  (e.g. ["BTC", "ETH"]), or an empty array if it's general market news not tied to a specific coin
- "reason": one concise sentence explaining the sentiment call

JSON:"""
