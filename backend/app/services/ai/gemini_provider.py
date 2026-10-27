import json

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.services.ai.base import SentimentProvider, SentimentResult
from app.services.ai.prompts import build_sentiment_prompt

settings = get_settings()


class GeminiProvider(SentimentProvider):
    def __init__(self) -> None:
        self._client = genai.Client(api_key=settings.google_api_key)

    def score_headline(self, title: str, summary: str) -> SentimentResult:
        resp = self._client.models.generate_content(
            model=settings.gemini_model,
            contents=build_sentiment_prompt(title, summary),
            config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2),
        )
        data = json.loads(resp.text)
        return SentimentResult(
            sentiment=data["sentiment"],
            confidence=float(data["confidence"]),
            related_symbols=[s.upper() for s in data.get("related_symbols", [])],
            reason=data["reason"],
            provider="gemini",
        )
