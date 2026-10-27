"""Total real portfolio value — spot wallet + Simple Earn + futures margin balance, combined —
plus a real, price-driven "today's PnL" for currently-held coins. This is a different number from
`total_exposure_usd` in binance_portfolio_risk.py, which deliberately measures market-risk notional
(spot free balance + futures position size) for concentration/correlation warnings. This one
answers "what is everything actually worth right now", the way Binance's own portfolio overview
does — so Simple Earn balances (real coins, just earning yield) count here even though they carry
no trading risk.

Today's PnL is anchored to the UTC calendar-day open (the current day's still-forming 1d kline),
matching what Binance's own portfolio page means by "today" — NOT the ticker's rolling 24hr change,
which covers a different window and can disagree sharply from the calendar-day figure whenever a
coin's move happened mostly before today's UTC midnight. Verified against a real account: the
rolling-24h figure showed +11.7% while Binance's own app showed +0.04% for the same moment, and the
UTC-day-open calculation below reproduced Binance's number almost exactly (+0.0579 vs their +0.06).
"""

import logging

from sqlalchemy.orm import Session

from app.services import binance_account, binance_credentials, binance_portfolio_risk
from app.services.binance_portfolio import STABLE_VALUE_ASSETS
from app.services.exchange.factory import get_exchange_adapter

logger = logging.getLogger("bonnco.binance_portfolio_summary")

_DISCONNECTED: dict = {
    "connected": False,
    "total_value_usd": None,
    "spot_value_usd": None,
    "earn_value_usd": None,
    "futures_margin_usd": None,
    "today_pnl_usd": None,
    "today_pnl_pct": None,
    "unpriced_assets": [],
}


def _spot_quantities(api_key: str, api_secret: str) -> tuple[dict[str, float], bool]:
    """Returns (quantities, ok). `ok=False` means the call itself failed (bad key, IP
    restriction, Binance outage, etc.) — the caller must not treat that the same as a
    verified real balance of zero."""
    quantities: dict[str, float] = {}
    try:
        account = binance_account.get_spot_account(api_key, api_secret)
        for b in account.get("balances", []):
            asset = b["asset"]
            # LD-prefixed wrapper tokens are the Simple Earn Flexible position itself, already
            # counted via get_simple_earn_holdings below — counting both would double the balance.
            if asset.startswith("LD"):
                continue
            amount = float(b["free"]) + float(b["locked"])
            if amount > 0:
                quantities[asset] = quantities.get(asset, 0.0) + amount
    except Exception:
        logger.exception("Failed to fetch spot balances for portfolio summary")
        return quantities, False
    return quantities, True


def get_portfolio_summary(db: Session) -> dict:
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return dict(_DISCONNECTED)

    api_key, api_secret, _source = resolved
    adapter = get_exchange_adapter()

    spot_quantities, spot_ok = _spot_quantities(api_key, api_secret)
    if not spot_ok:
        # Spot holds the bulk of a typical balance — if we couldn't even read it (bad key,
        # IP-whitelist mismatch, Binance outage), the real total is unknown, not zero. Reporting
        # 0.0 here would look like a verified empty balance instead of a failed connection, which
        # is exactly the kind of false certainty this app is built to avoid.
        return {
            "connected": True,
            "total_value_usd": None,
            "spot_value_usd": None,
            "earn_value_usd": None,
            "futures_margin_usd": None,
            "today_pnl_usd": None,
            "today_pnl_pct": None,
            "unpriced_assets": [],
        }

    earn_quantities: dict[str, float] = {}
    for h in binance_portfolio_risk.get_simple_earn_holdings(db):
        earn_quantities[h["asset"]] = earn_quantities.get(h["asset"], 0.0) + h["amount"]

    all_assets = set(spot_quantities) | set(earn_quantities)

    spot_value = 0.0
    earn_value = 0.0
    value_now_total = 0.0
    value_day_open_total = 0.0
    unpriced: list[str] = []

    for asset in all_assets:
        spot_qty = spot_quantities.get(asset, 0.0)
        earn_qty = earn_quantities.get(asset, 0.0)
        total_qty = spot_qty + earn_qty

        if asset in STABLE_VALUE_ASSETS:
            spot_value += spot_qty
            earn_value += earn_qty
            value_now_total += total_qty
            value_day_open_total += total_qty
            continue

        try:
            snapshot = adapter.get_ticker_snapshot(f"{asset}USDT", "spot")
        except Exception:
            unpriced.append(asset)
            continue

        price = snapshot.price
        spot_value += spot_qty * price
        earn_value += earn_qty * price
        value_now_total += total_qty * price

        # Today's UTC-day open, from the current (still-forming) daily candle. Falls back to
        # today's own price (zero day-over-day contribution) if the daily kline isn't available —
        # e.g. a very newly-listed pair — rather than mixing in a differently-windowed figure.
        try:
            day_kline = adapter.get_klines(f"{asset}USDT", "1d", "spot", limit=1)[-1]
            day_open_price = day_kline.open
        except Exception:
            day_open_price = price
        value_day_open_total += total_qty * day_open_price

    futures_margin_usd: float | None
    try:
        futures_account = binance_account.get_futures_account(api_key, api_secret)
        futures_margin_usd = float(futures_account.get("totalMarginBalance", 0))
    except Exception:
        futures_margin_usd = None

    total_value = spot_value + earn_value + (futures_margin_usd or 0)
    # Futures margin balance has no historical snapshot to anchor against — treated as flat for
    # today's PnL (its own live change is already shown separately as "Unrealized P&L (futures)"),
    # so it appears in both today's and day-open's total, canceling out rather than contributing.
    total_value_day_open = value_day_open_total + (futures_margin_usd or 0)
    today_pnl_usd = total_value - total_value_day_open
    today_pnl_pct = (today_pnl_usd / total_value_day_open * 100) if total_value_day_open > 0 else None

    return {
        "connected": True,
        "total_value_usd": round(total_value, 2),
        "spot_value_usd": round(spot_value, 2),
        "earn_value_usd": round(earn_value, 2),
        "futures_margin_usd": round(futures_margin_usd, 2) if futures_margin_usd is not None else None,
        "today_pnl_usd": round(today_pnl_usd, 2),
        "today_pnl_pct": round(today_pnl_pct, 2) if today_pnl_pct is not None else None,
        "unpriced_assets": sorted(unpriced),
    }
