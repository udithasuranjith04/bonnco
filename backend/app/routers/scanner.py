from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.market_brain import ScanResultOut
from app.services.opportunity_scanner import DEFAULT_UNIVERSE_LIMIT, run_scan

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


@router.get("", response_model=ScanResultOut)
def get_scan(
    market_type: Literal["spot", "futures"] = "futures",
    timeframe: str = "1h",
    universe_limit: int = DEFAULT_UNIVERSE_LIMIT,
    db: Session = Depends(get_db),
):
    """Market-wide opportunity scan — discovers a real tradable universe, evaluates LONG and SHORT
    independently per symbol via Phase 3's decision semantics, ranks by an auditable opportunity
    score, and returns the best current candidates (or none, honestly, if nothing qualifies).
    """
    return run_scan(db, market_type=market_type, timeframe=timeframe, universe_limit=universe_limit)
