"""Real open futures positions and open orders from the connected Binance account, plus
reconciliation against manually-logged Trade Journal entries. View-only, same as everything else
in this integration — nothing here can create, modify, or cancel a real order.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade_journal import TradeJournalEntry
from app.services import binance_account, binance_credentials
from app.services.position_coach import STOP_PROXIMITY_PCT

logger = logging.getLogger("bonnco.binance_positions")


def _position_side(position_amt: float) -> str:
    return "long" if position_amt > 0 else "short"


def get_open_futures_positions(db: Session) -> list[dict]:
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return []
    api_key, api_secret, _source = resolved

    try:
        raw = binance_account.get_futures_position_risk(api_key, api_secret)
    except Exception:
        logger.exception("Failed to fetch futures positions")
        return []

    positions = []
    for p in raw:
        amt = float(p.get("positionAmt", 0))
        if amt == 0:
            continue
        mark_price = float(p.get("markPrice", 0))
        liquidation_price = float(p.get("liquidationPrice", 0))

        # Same distance-to-danger framing as the Active Position Coach's stop-loss proximity
        # warning (STOP_PROXIMITY_PCT) — margin health and stop-loss risk should read as one
        # consistent risk language, not two disconnected numbers.
        liquidation_distance_pct = None
        margin_warning = None
        if liquidation_price > 0 and mark_price > 0:
            liquidation_distance_pct = round(abs(mark_price - liquidation_price) / mark_price * 100, 2)
            if liquidation_distance_pct <= STOP_PROXIMITY_PCT:
                margin_warning = f"Price is within {liquidation_distance_pct}% of liquidation (${liquidation_price:,.2f})."

        positions.append(
            {
                "symbol": p["symbol"],
                "side": _position_side(amt),
                "position_amt": abs(amt),
                "entry_price": float(p.get("entryPrice", 0)),
                "mark_price": mark_price,
                "leverage": float(p.get("leverage", 1)),
                "unrealized_pnl": float(p.get("unRealizedProfit", 0)),
                "notional_usd": abs(float(p.get("notional", amt * mark_price))),
                "liquidation_price": liquidation_price if liquidation_price > 0 else None,
                "liquidation_distance_pct": liquidation_distance_pct,
                "margin_warning": margin_warning,
            }
        )
    return positions


def get_open_orders(db: Session) -> dict:
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return {"spot": [], "futures": []}
    api_key, api_secret, _source = resolved

    def _map(rows: list[dict]) -> list[dict]:
        return [
            {
                "symbol": r["symbol"],
                "side": r["side"],
                "type": r["type"],
                "price": float(r.get("price", 0)),
                "orig_qty": float(r.get("origQty", 0)),
                "status": r.get("status"),
            }
            for r in rows
        ]

    spot: list[dict] = []
    futures: list[dict] = []
    try:
        spot = _map(binance_account.get_spot_open_orders(api_key, api_secret))
    except Exception:
        logger.exception("Failed to fetch spot open orders")
    try:
        futures = _map(binance_account.get_futures_open_orders(api_key, api_secret))
    except Exception:
        logger.exception("Failed to fetch futures open orders")

    return {"spot": spot, "futures": futures}


def reconcile_positions(db: Session) -> dict:
    """Matches real open Binance futures positions against open (status='open') journal entries
    on the same symbol + side. A position with no matching entry is a real trade the user hasn't
    logged yet — offered for one-click import. A journal entry with no matching real position is
    either a spot trade (Binance's futures-position endpoint doesn't cover those) or one the user
    already closed on the exchange without updating the journal.
    """
    positions = get_open_futures_positions(db)

    open_futures_entries = db.scalars(
        select(TradeJournalEntry).where(TradeJournalEntry.market_type == "futures", TradeJournalEntry.exit_price.is_(None))
    ).all()

    matched = []
    unmatched_binance = []
    claimed_entry_ids: set[int] = set()

    for pos in positions:
        entry = next(
            (
                e
                for e in open_futures_entries
                if e.id not in claimed_entry_ids and e.symbol == pos["symbol"] and e.side == pos["side"]
            ),
            None,
        )
        if entry:
            claimed_entry_ids.add(entry.id)
            matched.append({"binance_position": pos, "journal_entry_id": entry.id})
        else:
            unmatched_binance.append(pos)

    unmatched_journal = [e.id for e in open_futures_entries if e.id not in claimed_entry_ids]

    return {"matched": matched, "unmatched_binance_positions": unmatched_binance, "unmatched_journal_entry_ids": unmatched_journal}


def import_position(db: Session, symbol: str) -> TradeJournalEntry | None:
    """Creates a Trade Journal entry from a real open Binance futures position — symbol, entry
    price, size, and leverage all pulled directly from the exchange, never guessed. Notes are left
    for the user to fill in themselves, since Binance has no record of WHY the trade was taken.
    """
    positions = get_open_futures_positions(db)
    pos = next((p for p in positions if p["symbol"] == symbol), None)
    if pos is None:
        return None

    row = TradeJournalEntry(
        symbol=pos["symbol"],
        market_type="futures",
        side=pos["side"],
        entry_price=pos["entry_price"],
        leverage=pos["leverage"],
        position_size_usd=round(pos["notional_usd"] / pos["leverage"], 2) if pos["leverage"] else None,
        source="binance_import",
        notes="Imported from Binance. Add your own notes about why you took this trade.",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
