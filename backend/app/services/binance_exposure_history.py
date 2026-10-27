"""Real historical portfolio exposure for the Dashboard hero sparkline: current real holding
quantities (spot balances + open futures position size, both straight from the account) weighted
against real stored candle closes over the recent window. This assumes holding sizes stayed
constant across the window — a reasonable read of "what has my current position been worth
recently", not a claim about historical position sizing — and any coin with no stored candle
history is skipped entirely rather than estimated.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candle import Candle
from app.services import binance_account, binance_credentials, binance_positions
from app.services.binance_portfolio import STABLE_VALUE_ASSETS
from app.services.symbols import base_asset

logger = logging.getLogger("bonnco.binance_exposure_history")

EXPOSURE_HISTORY_HOURS = 24
EXPOSURE_HISTORY_TIMEFRAME = "1h"


def _current_coin_quantities(db: Session, api_key: str, api_secret: str) -> dict[str, float]:
    quantities: dict[str, float] = {}
    try:
        account = binance_account.get_spot_account(api_key, api_secret)
        for b in account.get("balances", []):
            amount = float(b["free"]) + float(b["locked"])
            if amount > 0:
                quantities[b["asset"]] = quantities.get(b["asset"], 0.0) + amount
    except Exception:
        logger.exception("Failed to fetch spot balances for exposure history")

    for p in binance_positions.get_open_futures_positions(db):
        coin = base_asset(p["symbol"])
        quantities[coin] = quantities.get(coin, 0.0) + p["position_amt"]

    return quantities


def get_exposure_history(db: Session, hours: int = EXPOSURE_HISTORY_HOURS) -> list[dict]:
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return []
    api_key, api_secret, _source = resolved

    quantities = _current_coin_quantities(db, api_key, api_secret)
    if not quantities:
        return []

    stable_total = sum(qty for coin, qty in quantities.items() if coin in STABLE_VALUE_ASSETS)

    totals: dict[str, float] = {}
    priced_any = False
    for coin, qty in quantities.items():
        if coin in STABLE_VALUE_ASSETS:
            continue
        rows = db.scalars(
            select(Candle)
            .where(
                Candle.symbol == f"{coin}USDT",
                Candle.market_type == "spot",
                Candle.timeframe == EXPOSURE_HISTORY_TIMEFRAME,
            )
            .order_by(Candle.open_time.desc())
            .limit(hours)
        ).all()
        if not rows:
            continue
        priced_any = True
        for r in rows:
            key = r.open_time.isoformat()
            totals[key] = totals.get(key, 0.0) + qty * r.close

    if not priced_any:
        return []

    for key in totals:
        totals[key] += stable_total

    return [{"time": k, "exposure_usd": round(v, 2)} for k, v in sorted(totals.items())]
