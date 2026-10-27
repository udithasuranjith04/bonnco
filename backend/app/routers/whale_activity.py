from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.whale_activity import WhaleActivityOut
from app.services.whale_activity import recent_whale_activity

router = APIRouter(prefix="/api/whale-activity", tags=["whale-activity"])


@router.get("", response_model=list[WhaleActivityOut])
def get_whale_activity(
    chain: Literal["ethereum", "solana", "bitcoin"] | None = None,
    hours: int = Query(default=24, ge=1, le=168),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    return recent_whale_activity(db, chain=chain, hours=hours, limit=limit)
