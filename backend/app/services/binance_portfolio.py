"""Derived, computed views of the real connected Binance account — balance in USD, built on top of
the raw signed calls in binance_account.py. Every number here traces back to a real Binance
response; an asset Bonnco can't independently price (no direct USDT pair, e.g. Earn/staking wrapper
tokens) is excluded from the total rather than guessed, and reported separately so nothing silently
vanishes from view.
"""

import logging

from sqlalchemy.orm import Session

from app.services import binance_account, binance_credentials
from app.services.exchange.factory import get_exchange_adapter

logger = logging.getLogger("bonnco.binance_portfolio")

STABLE_VALUE_ASSETS = {"USDT", "USDC", "FDUSD", "TUSD", "BUSD", "DAI", "USDP"}


def _asset_usd_value(asset: str, amount: float, adapter) -> float | None:
    if amount <= 0:
        return 0.0
    if asset in STABLE_VALUE_ASSETS:
        return amount
    try:
        price = adapter.get_current_price(f"{asset}USDT", "spot")
        return amount * price
    except Exception:
        return None  # no direct USDT spot pair — excluded from the total, not guessed


def get_account_balance(db: Session) -> dict:
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return {"connected": False, "spot_usd": None, "futures_usd": None, "total_usd": None, "unpriced_assets": []}

    api_key, api_secret, _source = resolved
    adapter = get_exchange_adapter()

    spot_usd: float | None = 0.0
    unpriced: list[str] = []
    try:
        account = binance_account.get_spot_account(api_key, api_secret)
        for b in account.get("balances", []):
            amount = float(b["free"]) + float(b["locked"])
            if amount <= 0:
                continue
            value = _asset_usd_value(b["asset"], amount, adapter)
            if value is None:
                unpriced.append(b["asset"])
            else:
                spot_usd += value
    except Exception:
        logger.exception("Failed to fetch spot balance")
        spot_usd = None

    futures_usd: float | None
    try:
        futures_account = binance_account.get_futures_account(api_key, api_secret)
        futures_usd = float(futures_account.get("totalMarginBalance", 0))
    except Exception:
        # Common and expected when the key doesn't have "Enable Futures" checked, or the account
        # has never opened a futures wallet — not logged as an error, just unavailable.
        futures_usd = None

    total = (spot_usd or 0) + (futures_usd or 0)
    return {
        "connected": True,
        "spot_usd": round(spot_usd, 2) if spot_usd is not None else None,
        "futures_usd": round(futures_usd, 2) if futures_usd is not None else None,
        "total_usd": round(total, 2),
        "unpriced_assets": unpriced,
    }


def get_all_asset_holdings(db: Session) -> list[dict]:
    """Every real coin you hold across the account, combined — spot wallet, Simple Earn positions,
    and futures wallet balance (the same underlying coin, just allocated to a different product or
    sitting as margin), the way Binance's own "Assets" overview shows one number per coin
    regardless of which product it's parked in — this is why a futures account funded with USDT
    shows up as a USDT row there, not just as an aggregate "margin balance" figure. Reported
    separately from the Simple Earn Holdings section, which exists to show the lock/APY/maturity
    *detail* Binance's own Earn tab shows — this one just answers "what coins do I have and how
    much are they worth." USD value is None (shown as unpriced) rather than guessed when Bonnco has
    no direct USDT pair for the asset.
    """
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return []
    api_key, api_secret, _source = resolved
    adapter = get_exchange_adapter()

    # Deferred import: binance_portfolio_risk imports STABLE_VALUE_ASSETS/_asset_usd_value from
    # this module, so importing it back at module load time would be circular.
    from app.services import binance_portfolio_risk

    spot_amounts: dict[str, float] = {}
    try:
        account = binance_account.get_spot_account(api_key, api_secret)
        for b in account.get("balances", []):
            asset = b["asset"]
            # Binance represents Simple Earn Flexible positions as an "LD"-prefixed wrapper token
            # sitting in the spot wallet (e.g. LDESP for an ESP Earn position) — the real Earn
            # amount is added in separately below, so this avoids double-counting that coin.
            if asset.startswith("LD"):
                continue
            amount = float(b["free"]) + float(b["locked"])
            if amount > 0:
                spot_amounts[asset] = spot_amounts.get(asset, 0.0) + amount
    except Exception:
        logger.exception("Failed to fetch spot balances for asset holdings")

    earn_amounts: dict[str, float] = {}
    for h in binance_portfolio_risk.get_simple_earn_holdings(db):
        earn_amounts[h["asset"]] = earn_amounts.get(h["asset"], 0.0) + h["amount"]

    futures_amounts: dict[str, float] = {}
    try:
        futures_account = binance_account.get_futures_account(api_key, api_secret)
        for a in futures_account.get("assets", []):
            amount = float(a["walletBalance"])
            if amount > 0:
                futures_amounts[a["asset"]] = futures_amounts.get(a["asset"], 0.0) + amount
    except Exception:
        # Common and expected when the key doesn't have futures enabled or the futures wallet has
        # never been funded — not logged as an error, just unavailable.
        pass

    holdings: list[dict] = []
    for asset in set(spot_amounts) | set(earn_amounts) | set(futures_amounts):
        spot_amount = spot_amounts.get(asset, 0.0)
        earn_amount = earn_amounts.get(asset, 0.0)
        futures_amount = futures_amounts.get(asset, 0.0)
        total_amount = spot_amount + earn_amount + futures_amount
        value = _asset_usd_value(asset, total_amount, adapter)
        holdings.append(
            {
                "asset": asset,
                "amount": total_amount,
                "spot_amount": round(spot_amount, 8),
                "earn_amount": round(earn_amount, 8),
                "futures_amount": round(futures_amount, 8),
                # Higher precision than the 2dp shown in the table — a coin worth $0.0013 still
                # needs to carry a real, non-zero value so donut-chart aggregation ("Other") and
                # percentage math downstream aren't built on a premature $0.00.
                "usd_value": round(value, 6) if value is not None else None,
            }
        )

    holdings.sort(key=lambda h: h["usd_value"] if h["usd_value"] is not None else -1, reverse=True)
    return holdings
