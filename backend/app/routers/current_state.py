from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.current_state import CurrentStateOut
from app.services.current_state import build_current_state

router = APIRouter(prefix="/api/state", tags=["state"])


@router.get("", response_model=CurrentStateOut)
def get_current_state(
    symbol: str | None = None,
    market_type: Literal["spot", "futures"] = "spot",
    timeframe: str = "1h",
    db: Session = Depends(get_db),
):
    """The unified current-state view — diagnostic endpoint for now (not yet surfaced in the UI),
    and the same aggregator Dashboard/checkin and Ask Bonnco's context builder route through
    internally. Lets the real freshness/connection-state of every underlying source be inspected
    directly, live.
    """
    try:
        return build_current_state(db, symbol, market_type, timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
