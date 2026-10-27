import logging

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.news_sentiment import NewsSentiment
from app.services.ai.factory import score_headline_with_fallback
from news.rss_fetcher import fetch_all_feeds, filter_recent, filter_unseen

logger = logging.getLogger("bonnco.news_ingest")
settings = get_settings()


def run_news_ingest_cycle(db: Session) -> int:
    """Fetch RSS feeds, drop stale/already-scored headlines, score the rest, store results.

    Returns the number of new headlines scored and stored.
    """
    headlines = fetch_all_feeds()
    headlines = filter_recent(headlines, hours=settings.news_lookback_hours)
    headlines = filter_unseen(db, headlines)
    headlines = headlines[: settings.news_max_per_cycle]

    stored = 0
    for h in headlines:
        try:
            result = score_headline_with_fallback(h.title, h.summary)
        except Exception:
            logger.exception("Sentiment scoring failed for headline: %s", h.title)
            continue

        row = NewsSentiment(
            headline=h.title,
            source=h.source,
            url=h.link,
            related_symbol=",".join(result.related_symbols) or None,
            published_at=h.published_at,
            sentiment=result.sentiment,
            confidence=result.confidence,
            reason=result.reason,
            ai_provider=result.provider,
        )
        db.add(row)
        try:
            db.commit()
            stored += 1
        except IntegrityError:
            db.rollback()  # another cycle scored this same URL first; skip

    return stored
