from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.watchlist import WatchlistItem
from app.schemas.watchlist import WatchlistItemCreate, WatchlistItemOut, WatchlistItemUpdate

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("", response_model=list[WatchlistItemOut])
def list_watchlist(db: Session = Depends(get_db)):
    return db.scalars(select(WatchlistItem).order_by(WatchlistItem.symbol)).all()


@router.post("", response_model=WatchlistItemOut, status_code=201)
def add_watchlist_item(payload: WatchlistItemCreate, db: Session = Depends(get_db)):
    symbol = payload.symbol.upper()
    existing = db.scalar(
        select(WatchlistItem).where(
            WatchlistItem.symbol == symbol,
            WatchlistItem.market_type == payload.market_type,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="Symbol already in watchlist for this market type")

    item = WatchlistItem(symbol=symbol, market_type=payload.market_type)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=WatchlistItemOut)
def update_watchlist_item(item_id: int, payload: WatchlistItemUpdate, db: Session = Depends(get_db)):
    item = db.get(WatchlistItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    if payload.market_type != item.market_type:
        conflict = db.scalar(
            select(WatchlistItem).where(
                WatchlistItem.symbol == item.symbol,
                WatchlistItem.market_type == payload.market_type,
            )
        )
        if conflict:
            raise HTTPException(
                status_code=409, detail=f"{item.symbol} is already tracked as {payload.market_type}"
            )
        item.market_type = payload.market_type
        db.commit()
        db.refresh(item)

    return item


@router.delete("/{item_id}", status_code=204)
def remove_watchlist_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(WatchlistItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
