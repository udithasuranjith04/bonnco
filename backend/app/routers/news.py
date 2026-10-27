from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.news_sentiment import NewsSentiment
from app.schemas.news import NewsSentimentOut
from app.services.news_ingest import run_news_ingest_cycle

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("", response_model=list[NewsSentimentOut])
def list_news(
    symbol: str | None = None,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(NewsSentiment).order_by(NewsSentiment.created_at.desc()).limit(limit)
    if symbol:
        stmt = stmt.where(NewsSentiment.related_symbol.contains(symbol.upper()))
    return db.scalars(stmt).all()


@router.post("/refresh")
def refresh_news(db: Session = Depends(get_db)):
    stored = run_news_ingest_cycle(db)
    return {"stored": stored}
