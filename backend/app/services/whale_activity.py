from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.whale_activity import WhaleActivity


def recent_whale_activity(db: Session, chain: str | None = None, hours: int = 24, limit: int = 50) -> list[WhaleActivity]:
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    query = select(WhaleActivity).where(WhaleActivity.event_time >= cutoff)
    if chain is not None:
        query = query.where(WhaleActivity.chain == chain)
    query = query.order_by(WhaleActivity.event_time.desc()).limit(limit)
    return list(db.scalars(query).all())
