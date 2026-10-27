import logging

from google import genai
from google.genai import types
from openai import OpenAI

from app.core.config import get_settings

logger = logging.getLogger("bonnco.ai.chat")
settings = get_settings()

# A mentor-style answer that explains reasoning and anticipates follow-ups genuinely needs more
# room than a one-line reply; set explicitly rather than relying on each provider's own default.
CHAT_MAX_TOKENS = 1000


def _openai_chat_reply(messages: list[dict]) -> str:
    client = OpenAI(api_key=settings.openai_api_key)
    resp = client.chat.completions.create(
        model=settings.openai_model, messages=messages, temperature=0.4, max_tokens=CHAT_MAX_TOKENS
    )
    return resp.choices[0].message.content


def _gemini_chat_reply(messages: list[dict]) -> str:
    client = genai.Client(api_key=settings.google_api_key)
    system_text = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    contents = [
        {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
        for m in messages
        if m["role"] != "system"
    ]
    resp = client.models.generate_content(
        model=settings.gemini_model,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=system_text, temperature=0.4, max_output_tokens=CHAT_MAX_TOKENS),
    )
    return resp.text


def generate_chat_reply_with_fallback(messages: list[dict]) -> tuple[str, str]:
    """Try the configured AI_PROVIDER first, fall back to the other one on failure. Returns (reply, provider)."""
    primary_name = settings.ai_provider
    fallback_name = "gemini" if primary_name == "openai" else "openai"

    for name in (primary_name, fallback_name):
        if name == "openai" and not settings.openai_api_key:
            continue
        if name == "gemini" and not settings.google_api_key:
            continue
        try:
            reply = _openai_chat_reply(messages) if name == "openai" else _gemini_chat_reply(messages)
            if name != primary_name:
                logger.warning(
                    "AI FALLBACK: chat reply used '%s' instead of configured primary '%s'", name, primary_name
                )
            return reply, name
        except Exception:
            logger.exception("Chat provider %s failed", name)
            if name == primary_name:
                logger.warning("AI FALLBACK: chat will retry with '%s' after primary '%s' failed", fallback_name, name)

    raise RuntimeError("No AI provider available: configure OPENAI_API_KEY and/or GOOGLE_API_KEY")
