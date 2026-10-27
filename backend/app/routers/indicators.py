from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.indicators import IndicatorSnapshotOut
from app.services.exchange.base import TIMEFRAMES
from app.services.indicators import InsufficientDataError, compute_indicators

router = APIRouter(prefix="/api/indicators", tags=["indicators"])


@router.get("", response_model=IndicatorSnapshotOut)
def get_indicators(
    symbol: str,
    market_type: Literal["spot", "futures"] = "spot",
    timeframe: str = "1h",
    db: Session = Depends(get_db),
):
    if timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"timeframe must be one of {TIMEFRAMES}")

    try:
        snapshot = compute_indicators(db, symbol.upper(), market_type, timeframe)
    except InsufficientDataError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return snapshot
