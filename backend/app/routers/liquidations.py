from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.liquidations import LiquidationClustersOut
from app.services.liquidations import liquidation_clusters

router = APIRouter(prefix="/api/liquidations", tags=["liquidations"])


@router.get("", response_model=LiquidationClustersOut)
def get_liquidation_clusters(
    symbol: str,
    hours: int = Query(default=4, ge=1, le=168),
    db: Session = Depends(get_db),
):
    return liquidation_clusters(db, symbol.upper(), hours=hours)
