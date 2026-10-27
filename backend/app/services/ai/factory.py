import logging
from functools import lru_cache

from app.core.config import get_settings
from app.services.ai.base import SentimentProvider, SentimentResult

logger = logging.getLogger("bonnco.ai")
settings = get_settings()


@lru_cache
def _openai_provider() -> SentimentProvider | None:
    if not settings.openai_api_key:
        return None
    from app.services.ai.openai_provider import OpenAIProvider

    return OpenAIProvider()


@lru_cache
def _gemini_provider() -> SentimentProvider | None:
    if not settings.google_api_key:
        return None
    from app.services.ai.gemini_provider import GeminiProvider

    return GeminiProvider()


def _provider_by_name(name: str) -> SentimentProvider | None:
    if name == "openai":
        return _openai_provider()
    if name == "gemini":
        return _gemini_provider()
    return None


def score_headline_with_fallback(title: str, summary: str) -> SentimentResult:
    """Try the configured AI_PROVIDER first; fall back to the other one on failure (e.g. quota exhausted)."""
    primary_name = settings.ai_provider
    fallback_name = "gemini" if primary_name == "openai" else "openai"

    primary = _provider_by_name(primary_name)
    if primary is not None:
        try:
            return primary.score_headline(title, summary)
        except Exception:
            logger.exception("Primary AI provider (%s) failed for sentiment scoring", primary_name)
    else:
        logger.warning(
            "AI FALLBACK: primary provider '%s' has no API key configured — sentiment scoring will use '%s' instead",
            primary_name,
            fallback_name,
        )

    fallback = _provider_by_name(fallback_name)
    if fallback is not None:
        logger.warning(
            "AI FALLBACK: sentiment scoring used '%s' instead of configured primary '%s' for headline: %s",
            fallback_name,
            primary_name,
            title[:80],
        )
        return fallback.score_headline(title, summary)

    raise RuntimeError("No AI provider available: configure OPENAI_API_KEY and/or GOOGLE_API_KEY")
