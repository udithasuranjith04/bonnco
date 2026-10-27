"""Reconstructs real closed round-trip trades from Binance's raw fill history, for import into the
Trade Journal. Every number traces back to real Binance fills — nothing here is estimated.

Spot: Binance's trade history is a stream of individual fills (a single order can fill in several
pieces), not "trades" in the journal sense of one entry + one exit. Reconstruction uses standard
FIFO lot matching: fills are grouped by orderId (one order's fills always execute at the same
moment), processed oldest-first, and a SELL order's fills are matched against the oldest still-open
BUY lots. A SELL order that fully or partially closes existing lots becomes one closed journal
entry, with entry_price as the size-weighted average of whichever lots it actually consumed and
exit_price as the size-weighted average of its own fill prices. Leftover, still-open BUY lots are
never imported as closed trades — they're open positions, not history, and Binance's read-only
balance/position endpoints already cover those.

Futures: not handled by this module (see get_futures_trade_history below for raw fills only) —
correctly reconstructing leveraged round-trips would additionally need historical leverage, which
Binance's trade history does not include (leverage is a live position setting, not part of a fill
record), so this deliberately stays spot-only rather than guessing a leverage value.
"""

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade_journal import TradeJournalEntry
from app.models.watchlist import WatchlistItem
from app.services import binance_account, binance_credentials

logger = logging.getLogger("bonnco.binance_trade_history")


@dataclass
class ClosedTrade:
    symbol: str
    entry_price: float
    exit_price: float
    qty: float
    opened_at_ms: int
    closed_at_ms: int
    closing_order_id: int


def get_spot_trade_history(db: Session, symbol: str, limit: int = 1000) -> list[dict]:
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return []
    api_key, api_secret, _source = resolved
    try:
        return binance_account.get_spot_trades(symbol, api_key, api_secret, limit=limit)
    except Exception:
        logger.exception("Failed to fetch spot trade history for %s", symbol)
        return []


def reconstruct_closed_trades(symbol: str, fills: list[dict]) -> list[ClosedTrade]:
    """`fills` is Binance's raw /api/v3/myTrades response for one symbol, any order. Returns one
    ClosedTrade per SELL order that actually closed some quantity of a prior FIFO lot.
    """
    fills_sorted = sorted(fills, key=lambda f: (f["time"], f["orderId"]))

    orders: dict[int, list[dict]] = {}
    order_sequence: list[int] = []
    for f in fills_sorted:
        oid = f["orderId"]
        if oid not in orders:
            orders[oid] = []
            order_sequence.append(oid)
        orders[oid].append(f)

    # FIFO queue of open (still-unsold) buy lots: [qty, price, time]
    open_lots: list[list[float]] = []
    closed_trades: list[ClosedTrade] = []

    for oid in order_sequence:
        order_fills = orders[oid]
        is_buy = order_fills[0]["isBuyer"]
        order_time = order_fills[0]["time"]

        if is_buy:
            for f in order_fills:
                open_lots.append([float(f["qty"]), float(f["price"]), order_time])
            continue

        # SELL order: consume oldest open lots FIFO until this order's total quantity is matched
        sell_qty_total = sum(float(f["qty"]) for f in order_fills)
        exit_notional = sum(float(f["qty"]) * float(f["price"]) for f in order_fills)
        remaining_to_match = sell_qty_total
        matched_notional = 0.0
        matched_qty = 0.0
        earliest_lot_time = order_time

        while remaining_to_match > 1e-12 and open_lots:
            lot = open_lots[0]
            lot_qty, lot_price, lot_time = lot
            take = min(lot_qty, remaining_to_match)
            matched_notional += take * lot_price
            matched_qty += take
            earliest_lot_time = min(earliest_lot_time, lot_time)
            lot[0] -= take
            remaining_to_match -= take
            if lot[0] <= 1e-12:
                open_lots.pop(0)

        if matched_qty <= 1e-12:
            continue  # a sell with nothing open to match against (shouldn't happen on a real account)

        closed_trades.append(
            ClosedTrade(
                symbol=symbol,
                entry_price=round(matched_notional / matched_qty, 8),
                exit_price=round(exit_notional / sell_qty_total, 8),
                qty=round(matched_qty, 8),
                opened_at_ms=earliest_lot_time,
                closed_at_ms=order_time,
                closing_order_id=oid,
            )
        )

    return closed_trades


def _compute_pnl_pct(entry_price: float, exit_price: float) -> float:
    return round((exit_price - entry_price) / entry_price * 100, 4)


def import_closed_spot_trades(db: Session, symbol: str) -> int:
    """Imports every real closed spot round-trip for `symbol` not already imported (deduped by
    Binance's own orderId, stored as binance_trade_id), so this is safe to call repeatedly as a
    periodic sync rather than just a one-time backfill.
    """
    fills = get_spot_trade_history(db, symbol)
    if not fills:
        return 0

    closed = reconstruct_closed_trades(symbol, fills)
    if not closed:
        return 0

    already_imported = {
        row.binance_trade_id
        for row in db.scalars(
            select(TradeJournalEntry).where(TradeJournalEntry.symbol == symbol, TradeJournalEntry.binance_trade_id.is_not(None))
        ).all()
    }

    imported = 0
    for trade in closed:
        trade_id = str(trade.closing_order_id)
        if trade_id in already_imported:
            continue

        from datetime import datetime

        row = TradeJournalEntry(
            symbol=trade.symbol,
            market_type="spot",
            side="long",
            entry_price=trade.entry_price,
            exit_price=trade.exit_price,
            leverage=1.0,
            result_pnl=_compute_pnl_pct(trade.entry_price, trade.exit_price),
            position_size_usd=round(trade.qty * trade.entry_price, 2),
            source="binance_trade_sync",
            binance_trade_id=trade_id,
            notes="Synced from real Binance trade history. Add your own notes about why you took this trade.",
            opened_at=datetime.utcfromtimestamp(trade.opened_at_ms / 1000),
            closed_at=datetime.utcfromtimestamp(trade.closed_at_ms / 1000),
        )
        db.add(row)
        imported += 1

    if imported:
        db.commit()
    return imported


def _candidate_spot_symbols(db: Session) -> list[str]:
    """Symbols worth checking for real trade history: the watchlist plus anything already in the
    journal — a real, bounded set rather than guessing at every symbol Binance lists.
    """
    watchlist_symbols = {row.symbol for row in db.scalars(select(WatchlistItem)).all()}
    journal_symbols = set(db.scalars(select(TradeJournalEntry.symbol).distinct()).all())
    return sorted(watchlist_symbols | journal_symbols)


def sync_all_spot_trade_history(db: Session) -> dict[str, int]:
    """One call covers both the one-time backfill and ongoing sync use cases — every closed trade
    already imported (by binance_trade_id) is skipped, so calling this repeatedly (e.g. from a
    scheduled job) only ever imports genuinely new closed trades.
    """
    results: dict[str, int] = {}
    for symbol in _candidate_spot_symbols(db):
        try:
            count = import_closed_spot_trades(db, symbol)
        except Exception:
            logger.exception("Trade history sync failed for %s", symbol)
            continue
        if count:
            results[symbol] = count
    return results
