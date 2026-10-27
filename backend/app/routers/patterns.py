from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.patterns import PatternScanOut
from app.services.candle_data import InsufficientDataError
from app.services.exchange.base import TIMEFRAMES
from patterns.pattern_detector import detect_patterns, select_headline_pattern

router = APIRouter(prefix="/api/patterns", tags=["patterns"])


@router.get("", response_model=PatternScanOut)
def get_patterns(
    symbol: str,
    market_type: Literal["spot", "futures"] = "spot",
    timeframe: str = "1h",
    db: Session = Depends(get_db),
):
    """Live pattern scan — always computed fresh (patterns aren't cached the way signals are),
    used for chart overlays where the exact key_points geometry matters and staleness would be
    visually obvious as a mismatched shape drawn over current candles.
    """
    if timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"timeframe must be one of {TIMEFRAMES}")

    try:
        detected = detect_patterns(db, symbol.upper(), market_type, timeframe)
    except InsufficientDataError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    headline, secondary = select_headline_pattern(detected)
    return {"headline": headline, "secondary": secondary}
