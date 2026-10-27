from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.signal import Signal
from app.schemas.signal_outcomes import SignalOutcomeStatsOut
from app.schemas.signals import GenerateSignalRequest, SignalOut
from app.services.exchange.base import TIMEFRAMES
from app.services.indicators import InsufficientDataError
from app.services.signal_engine import generate_signal
from app.services.signal_outcome_stats import compute_signal_outcome_stats

router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.post("/generate", response_model=SignalOut)
def generate(payload: GenerateSignalRequest, db: Session = Depends(get_db)):
    if payload.timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"timeframe must be one of {TIMEFRAMES}")

    try:
        row = generate_signal(db, payload.symbol.upper(), payload.market_type, payload.timeframe)
    except InsufficientDataError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return SignalOut.from_orm_with_disclaimer(row)


@router.get("", response_model=list[SignalOut])
def list_signals(
    symbol: str | None = None,
    market_type: Literal["spot", "futures"] | None = None,
    timeframe: str | None = None,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(Signal).order_by(Signal.created_at.desc()).limit(limit)
    if symbol:
        stmt = stmt.where(Signal.symbol == symbol.upper())
    if market_type:
        stmt = stmt.where(Signal.market_type == market_type)
    if timeframe:
        stmt = stmt.where(Signal.timeframe == timeframe)

    rows = db.scalars(stmt).all()
    return [SignalOut.from_orm_with_disclaimer(r) for r in rows]


@router.get("/outcomes/stats", response_model=SignalOutcomeStatsOut)
def get_signal_outcome_stats(
    symbol: str | None = None,
    timeframe: str | None = None,
    db: Session = Depends(get_db),
):
    """Real, measured track record of Bonnco's own BUY/SELL/HOLD calls — separate from the user's
    Trade Journal — broken down by confidence band, signal type, coin, timeframe, and horizon.
    """
    return compute_signal_outcome_stats(db, symbol=symbol, timeframe=timeframe)
