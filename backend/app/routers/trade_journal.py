from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.trade_journal import TradeJournalEntry
from app.schemas.trade_journal import (
    ActivePositionOut,
    JournalStatsOut,
    TradeJournalCreate,
    TradeJournalOut,
    TradeJournalUpdate,
)
from app.services.journal_stats import compute_journal_stats, find_nearest_signal
from app.services.position_coach import build_position_guidance

router = APIRouter(prefix="/api/journal", tags=["journal"])


def _compute_pnl_pct(entry_price: float, exit_price: float, side: str, leverage: float) -> float:
    direction = 1 if side == "long" else -1
    raw_return = (exit_price - entry_price) / entry_price * direction
    return round(raw_return * leverage * 100, 4)


@router.post("", response_model=TradeJournalOut, status_code=201)
def create_trade(payload: TradeJournalCreate, db: Session = Depends(get_db)):
    opened_at = payload.opened_at or datetime.utcnow()
    symbol = payload.symbol.upper()

    result_pnl = None
    if payload.exit_price is not None:
        result_pnl = _compute_pnl_pct(payload.entry_price, payload.exit_price, payload.side, payload.leverage)

    nearest_signal = find_nearest_signal(db, symbol, payload.market_type, opened_at)

    row = TradeJournalEntry(
        symbol=symbol,
        market_type=payload.market_type,
        side=payload.side,
        entry_price=payload.entry_price,
        exit_price=payload.exit_price,
        leverage=payload.leverage,
        stop_loss=payload.stop_loss,
        position_size_usd=payload.position_size_usd,
        result_pnl=result_pnl,
        signal_id=nearest_signal.id if nearest_signal else None,
        notes=payload.notes,
        opened_at=opened_at,
        closed_at=payload.closed_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("", response_model=list[TradeJournalOut])
def list_trades(symbol: str | None = None, db: Session = Depends(get_db)):
    stmt = select(TradeJournalEntry).order_by(TradeJournalEntry.opened_at.desc())
    if symbol:
        stmt = stmt.where(TradeJournalEntry.symbol == symbol.upper())
    return db.scalars(stmt).all()


@router.patch("/{trade_id}", response_model=TradeJournalOut)
def update_trade(trade_id: int, payload: TradeJournalUpdate, db: Session = Depends(get_db)):
    row = db.get(TradeJournalEntry, trade_id)
    if not row:
        raise HTTPException(status_code=404, detail="Trade not found")

    if payload.exit_price is not None:
        row.exit_price = payload.exit_price
        row.result_pnl = _compute_pnl_pct(row.entry_price, payload.exit_price, row.side, row.leverage)
        row.closed_at = payload.closed_at or datetime.utcnow()
    if payload.stop_loss is not None:
        row.stop_loss = payload.stop_loss
    if payload.position_size_usd is not None:
        row.position_size_usd = payload.position_size_usd
    if payload.notes is not None:
        row.notes = payload.notes

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{trade_id}", status_code=204)
def delete_trade(trade_id: int, db: Session = Depends(get_db)):
    row = db.get(TradeJournalEntry, trade_id)
    if not row:
        raise HTTPException(status_code=404, detail="Trade not found")
    db.delete(row)
    db.commit()


@router.get("/stats", response_model=JournalStatsOut)
def get_stats(db: Session = Depends(get_db)):
    return compute_journal_stats(db)


@router.get("/active", response_model=list[ActivePositionOut])
def list_active_positions(db: Session = Depends(get_db)):
    """Live hold/exit guidance for every open (no exit_price) journal entry, computed fresh on
    every call from the coin's real current price and signal state — the Active Position Coach.
    """
    trades = db.scalars(
        select(TradeJournalEntry).where(TradeJournalEntry.exit_price.is_(None)).order_by(TradeJournalEntry.opened_at.desc())
    ).all()
    return [build_position_guidance(db, t) for t in trades]
