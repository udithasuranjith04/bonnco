from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.decision import DecisionOut
from app.services.decision_engine import build_decision

router = APIRouter(prefix="/api/decision", tags=["decision"])


@router.get("", response_model=DecisionOut)
def get_decision(
    symbol: str,
    market_type: Literal["spot", "futures"] = "spot",
    timeframe: str = "1h",
    db: Session = Depends(get_db),
):
    """The structured decision-semantics layer built on top of the unified state (Phase 2) — the
    same object Ask Bonnco's chat context now reads from, so the assistant explains this decision
    instead of independently reinterpreting raw indicators.
    """
    try:
        return build_decision(db, symbol, market_type, timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
