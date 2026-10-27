import json

from openai import OpenAI

from app.core.config import get_settings
from app.services.ai.base import SentimentProvider, SentimentResult
from app.services.ai.prompts import build_sentiment_prompt

settings = get_settings()


class OpenAIProvider(SentimentProvider):
    def __init__(self) -> None:
        self._client = OpenAI(api_key=settings.openai_api_key)

    def score_headline(self, title: str, summary: str) -> SentimentResult:
        resp = self._client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": build_sentiment_prompt(title, summary)}],
            temperature=0.2,
        )
        data = json.loads(resp.choices[0].message.content)
        return SentimentResult(
            sentiment=data["sentiment"],
            confidence=float(data["confidence"]),
            related_symbols=[s.upper() for s in data.get("related_symbols", [])],
            reason=data["reason"],
            provider="openai",
        )
