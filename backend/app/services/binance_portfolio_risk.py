"""Portfolio-level risk view: total real exposure across spot + futures, per-coin concentration,
and a correlation-weighted concentration warning built from real stored candle history (Pearson
correlation of daily returns) — no fabricated or estimated correlation figures. Every number here
comes from a real Binance account response or real stored price history.
"""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candle import Candle
from app.services import binance_account, binance_credentials, binance_positions
from app.services.binance_portfolio import STABLE_VALUE_ASSETS, _asset_usd_value
from app.services.exchange.factory import get_exchange_adapter
from app.services.symbols import base_asset

logger = logging.getLogger("bonnco.binance_portfolio_risk")

CORRELATION_LOOKBACK_DAYS = 30
CORRELATION_WARN_THRESHOLD = 0.7
MIN_COIN_CONCENTRATION_PCT = 5.0
COMBINED_CONCENTRATION_WARN_PCT = 40.0

# Below this real USD value, a holding is dust that would otherwise show a confusing "X% of
# portfolio, $0.00" line (technically correct when the whole portfolio is also tiny, but
# misleading to read) — excluded from the concentration *display* only; total_exposure_usd still
# includes every real cent.
DUST_DISPLAY_THRESHOLD_USD = 0.01

# Binance's published base (VIP 0 / Regular User) spot rate — confirmed via binance.com/en/fee/trading.
BASE_MAKER_PCT = 0.1
BASE_TAKER_PCT = 0.1


def _daily_returns(db: Session, symbol: str) -> list[float] | None:
    rows = db.scalars(
        select(Candle)
        .where(Candle.symbol == symbol, Candle.market_type == "spot", Candle.timeframe == "1d")
        .order_by(Candle.open_time.desc())
        .limit(CORRELATION_LOOKBACK_DAYS + 1)
    ).all()
    if len(rows) < 10:
        return None
    closes = [r.close for r in reversed(rows)]
    return [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes))]


def _pearson(a: list[float], b: list[float]) -> float | None:
    n = min(len(a), len(b))
    if n < 5:
        return None
    a, b = a[-n:], b[-n:]
    mean_a, mean_b = sum(a) / n, sum(b) / n
    cov = sum((a[i] - mean_a) * (b[i] - mean_b) for i in range(n))
    std_a = sum((x - mean_a) ** 2 for x in a) ** 0.5
    std_b = sum((x - mean_b) ** 2 for x in b) ** 0.5
    if std_a == 0 or std_b == 0:
        return None
    return cov / (std_a * std_b)


def _compute_correlation_warnings(db: Session, concentration: list[dict]) -> list[dict]:
    significant = [c for c in concentration if c["pct_of_portfolio"] >= MIN_COIN_CONCENTRATION_PCT and c["coin"] not in STABLE_VALUE_ASSETS]
    warnings = []
    returns_cache: dict[str, list[float] | None] = {}

    for i in range(len(significant)):
        for j in range(i + 1, len(significant)):
            coin_a, coin_b = significant[i], significant[j]
            for coin in (coin_a["coin"], coin_b["coin"]):
                if coin not in returns_cache:
                    returns_cache[coin] = _daily_returns(db, f"{coin}USDT")

            ra, rb = returns_cache[coin_a["coin"]], returns_cache[coin_b["coin"]]
            if ra is None or rb is None:
                continue
            corr = _pearson(ra, rb)
            if corr is None:
                continue

            combined_pct = coin_a["pct_of_portfolio"] + coin_b["pct_of_portfolio"]
            if corr >= CORRELATION_WARN_THRESHOLD and combined_pct >= COMBINED_CONCENTRATION_WARN_PCT:
                warnings.append(
                    {
                        "coins": [coin_a["coin"], coin_b["coin"]],
                        "correlation": round(corr, 2),
                        "combined_pct_of_portfolio": round(combined_pct, 1),
                        "message": (
                            f"{coin_a['coin']} and {coin_b['coin']} together make up "
                            f"{combined_pct:.0f}% of your portfolio and have moved together "
                            f"(correlation {corr:.2f}) over the last {CORRELATION_LOOKBACK_DAYS} days — "
                            f"a drop in one has usually come with a drop in the other, not real diversification."
                        ),
                    }
                )
    return warnings


def _fee_tier_info(spot_account: dict) -> dict:
    """Real maker/taker rate straight from the account response. Binance's read-only API has no
    endpoint for a user's own 30-day trading volume, so "distance to the next tier" genuinely can't
    be computed from real data here — stated plainly rather than estimated from partial trade
    history Bonnco happens to have (which would undercount real volume on symbols it doesn't track).
    """
    rates = spot_account.get("commissionRates", {})
    maker_pct = round(float(rates.get("maker", 0)) * 100, 4)
    taker_pct = round(float(rates.get("taker", 0)) * 100, 4)
    is_base_tier = abs(maker_pct - BASE_MAKER_PCT) < 1e-9 and abs(taker_pct - BASE_TAKER_PCT) < 1e-9
    return {
        "maker_pct": maker_pct,
        "taker_pct": taker_pct,
        "tier_label": "VIP 0 — Regular User (Binance's base rate)" if is_base_tier else "Discounted tier (below Binance's 0.1%/0.1% base rate)",
        "volume_note": "Binance's read-only API doesn't expose your 30-day trading volume, so distance to the next tier can't be shown here — check binance.com/en/fee/trading directly.",
    }


def get_simple_earn_holdings(db: Session) -> list[dict]:
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return []
    api_key, api_secret, _source = resolved

    holdings: list[dict] = []
    try:
        for p in binance_account.get_simple_earn_flexible_positions(api_key, api_secret):
            amount = float(p.get("totalAmount", 0))
            if amount <= 0:
                continue
            holdings.append(
                {
                    "asset": p.get("asset", "?"),
                    "amount": amount,
                    "product": "Flexible",
                    "apy_pct": round(float(p.get("latestAnnualPercentageRate", 0)) * 100, 2),
                    "maturity_date": None,
                }
            )
    except Exception:
        logger.exception("Failed to fetch Simple Earn flexible positions")

    try:
        for p in binance_account.get_simple_earn_locked_positions(api_key, api_secret):
            amount = float(p.get("amount", 0))
            if amount <= 0:
                continue
            deliver_date_ms = p.get("deliverDate")
            holdings.append(
                {
                    "asset": p.get("asset", "?"),
                    "amount": amount,
                    "product": f"Locked {p.get('duration', '?')}d",
                    "apy_pct": round(float(p.get("apy", 0)) * 100, 2),
                    "maturity_date": datetime.utcfromtimestamp(deliver_date_ms / 1000).isoformat() if deliver_date_ms else None,
                }
            )
    except Exception:
        logger.exception("Failed to fetch Simple Earn locked positions")

    return sorted(holdings, key=lambda h: h["amount"], reverse=True)


def get_portfolio_overview(db: Session) -> dict:
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return {
            "connected": False,
            "total_exposure_usd": None,
            "concentration": [],
            "correlation_warnings": [],
            "fee_tier": None,
            "simple_earn": [],
            "total_unrealized_pnl_usd": None,
        }

    api_key, api_secret, _source = resolved
    adapter = get_exchange_adapter()

    exposure_by_coin: dict[str, float] = {}
    fee_tier: dict | None = None

    try:
        account = binance_account.get_spot_account(api_key, api_secret)
        fee_tier = _fee_tier_info(account)
        for b in account.get("balances", []):
            amount = float(b["free"]) + float(b["locked"])
            if amount <= 0:
                continue
            value = _asset_usd_value(b["asset"], amount, adapter)
            if value:
                exposure_by_coin[b["asset"]] = exposure_by_coin.get(b["asset"], 0.0) + value
    except Exception:
        logger.exception("Failed to fetch spot balances for portfolio overview")

    futures_positions = binance_positions.get_open_futures_positions(db)
    for p in futures_positions:
        coin = base_asset(p["symbol"])
        exposure_by_coin[coin] = exposure_by_coin.get(coin, 0.0) + p["notional_usd"]

    total_exposure = sum(exposure_by_coin.values())
    concentration = sorted(
        (
            {
                "coin": coin,
                "usd_value": round(value, 2),
                "pct_of_portfolio": round(value / total_exposure * 100, 1) if total_exposure else 0.0,
            }
            for coin, value in exposure_by_coin.items()
        ),
        key=lambda c: c["usd_value"],
        reverse=True,
    )

    correlation_warnings = _compute_correlation_warnings(db, concentration)

    # Dust filtered from the *display* list only — total_exposure_usd above already includes it.
    concentration = [c for c in concentration if c["usd_value"] >= DUST_DISPLAY_THRESHOLD_USD]

    simple_earn = get_simple_earn_holdings(db)

    total_unrealized_pnl: float | None
    try:
        futures_account = binance_account.get_futures_account(api_key, api_secret)
        total_unrealized_pnl = float(futures_account.get("totalUnrealizedProfit", 0))
    except Exception:
        total_unrealized_pnl = None

    return {
        "connected": True,
        "total_exposure_usd": round(total_exposure, 2),
        "concentration": concentration,
        "correlation_warnings": correlation_warnings,
        "fee_tier": fee_tier,
        "simple_earn": simple_earn,
        "total_unrealized_pnl_usd": round(total_unrealized_pnl, 2) if total_unrealized_pnl is not None else None,
    }
