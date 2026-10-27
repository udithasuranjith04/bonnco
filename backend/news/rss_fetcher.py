import logging
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import feedparser
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.news_sentiment import NewsSentiment

logger = logging.getLogger("bonnco.rss_fetcher")

RSS_FEEDS = {
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "CoinTelegraph": "https://cointelegraph.com/rss",
    "Decrypt": "https://decrypt.co/feed",
    "Bitcoin Magazine": "https://bitcoinmagazine.com/feed",
}

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HEADERS = {"User-Agent": "Mozilla/5.0 Bonnco/1.0"}


@dataclass
class Headline:
    title: str
    summary: str
    link: str
    published_at: datetime | None
    source: str


def _strip_html(raw: str) -> str:
    return _HTML_TAG_RE.sub("", raw or "").strip()


def _struct_time_to_dt(struct_time) -> datetime | None:
    if not struct_time:
        return None
    return datetime(*struct_time[:6], tzinfo=timezone.utc).replace(tzinfo=None)


def fetch_feed(source: str, url: str) -> list[Headline]:
    try:
        resp = httpx.get(url, timeout=10, follow_redirects=True, headers=_HEADERS)
        resp.raise_for_status()
    except Exception:
        logger.exception("Failed to fetch RSS feed %s (%s)", source, url)
        return []

    parsed = feedparser.parse(resp.content)
    headlines = []
    for entry in parsed.entries:
        published = _struct_time_to_dt(entry.get("published_parsed") or entry.get("updated_parsed"))
        headlines.append(
            Headline(
                title=_strip_html(entry.get("title", "")),
                summary=_strip_html(entry.get("summary", ""))[:500],
                link=entry.get("link", ""),
                published_at=published,
                source=source,
            )
        )
    return headlines


def fetch_all_feeds() -> list[Headline]:
    all_headlines: list[Headline] = []
    for source, url in RSS_FEEDS.items():
        all_headlines.extend(fetch_feed(source, url))
    return all_headlines


def filter_recent(headlines: list[Headline], hours: int = 6) -> list[Headline]:
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    return [h for h in headlines if h.published_at is not None and h.published_at >= cutoff]


def filter_unseen(db: Session, headlines: list[Headline]) -> list[Headline]:
    """Drop headlines whose link is already stored in news_sentiment (already scored)."""
    if not headlines:
        return []
    links = [h.link for h in headlines if h.link]
    existing = set(db.scalars(select(NewsSentiment.url).where(NewsSentiment.url.in_(links))).all())
    return [h for h in headlines if h.link and h.link not in existing]
