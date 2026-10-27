"""Authenticated (signed) Binance account access — strictly read-only.

Every function in this module calls a Binance endpoint documented as security type USER_DATA
(private account information: balances, positions, orders, trade history), confirmed directly
against Binance's own official API client source (github.com/binance/binance-connector-python,
generated from their OpenAPI spec) before writing this file. Endpoints documented as security type
TRADE (place/cancel/modify an order) or requiring withdrawal permission are never called anywhere
in this codebase — `_ALLOWED_PATHS` below is a hard allowlist enforced at the request layer, so a
future code change can't accidentally start hitting a trade endpoint through this helper even by
mistake: any path not in the allowlist raises before a request is ever sent.

Nothing here places, modifies, or cancels an order, or moves funds. This module only ever issues
GET requests.
"""

import hashlib
import hmac
import logging
import time
import urllib.parse
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

logger = logging.getLogger("bonnco.binance_account")
settings = get_settings()

# USER_DATA (read-only) endpoints only — confirmed against Binance's official API client source.
# TRADE-type endpoints (new order, cancel order, etc.) are deliberately never listed here.
_ALLOWED_PATHS = {
    ("spot", "/sapi/v1/account/apiRestrictions"),
    ("spot", "/api/v3/account"),
    ("spot", "/api/v3/openOrders"),
    ("spot", "/api/v3/myTrades"),
    ("futures", "/fapi/v2/account"),
    ("futures", "/fapi/v2/positionRisk"),
    ("futures", "/fapi/v1/openOrders"),
    ("futures", "/fapi/v1/userTrades"),
    ("spot", "/sapi/v1/simple-earn/flexible/position"),
    ("spot", "/sapi/v1/simple-earn/locked/position"),
}

_PUBLIC_TIME_PATH = {"spot": "/api/v3/time", "futures": "/fapi/v1/time"}

_time_offset_ms: dict[str, float] = {}

# Binance's published per-IP weight budgets (requests/minute, rolling). Proactively backing off
# before actually hitting these avoids ever triggering a 429/418 in normal use — this app polls
# periodically, not continuously, so there's no legitimate reason to get close to the ceiling.
#
# SAPI endpoints (Simple Earn, apiRestrictions, etc.) report usage via a DIFFERENT response header
# (X-SAPI-USED-IP-WEIGHT-1M) than /api/v3 and /fapi endpoints (X-MBX-USED-WEIGHT-1M) — confirmed by
# inspecting a real response, not assumed — and draw from a separate IP-weight bucket, so this is
# tracked as its own "sapi" pool rather than folded into "spot". 12000 is Binance's documented
# general SAPI IP-weight ceiling; kept as a conservative reference point for backing off early.
_WEIGHT_LIMITS = {"spot": 6000, "futures": 2400, "sapi": 12000}
_WEIGHT_BACKOFF_THRESHOLD = 0.8  # back off once used weight crosses this fraction of the limit
_WEIGHT_WINDOW_SECONDS = 65  # Binance's window is 60s; a little slack for clock drift

# (bucket) -> {"used": int, "checked_at": float} — bucket is "spot", "futures", or "sapi"
_weight_state: dict[str, dict] = {}


def _weight_bucket(market_type: str, path: str) -> str:
    return "sapi" if path.startswith("/sapi/") else market_type

# Short-TTL response cache so multiple near-simultaneous callers (e.g. several Dashboard widgets
# refreshing at once) share one real Binance call instead of each spending their own weight.
_RESPONSE_CACHE_TTL_SECONDS = 20
_response_cache: dict[tuple, tuple[float, object]] = {}


class BinanceAuthError(Exception):
    """The key/secret were rejected, expired, or otherwise failed authentication."""


class DisallowedEndpoint(Exception):
    """A caller tried to reach a path outside the read-only allowlist — refused before sending."""


class BinanceRateLimited(Exception):
    """Either we proactively backed off from a high used-weight, or Binance itself returned 429
    (rate limited) or 418 (IP auto-banned for continuing past a 429). Callers should treat this as
    "try again shortly", never retry in a tight loop.
    """


@dataclass
class KeyPermissions:
    ip_restrict: bool
    enable_reading: bool
    enable_withdrawals: bool
    enable_internal_transfer: bool
    enable_margin: bool
    enable_futures: bool
    enable_spot_and_margin_trading: bool
    enable_portfolio_margin_trading: bool
    raw: dict


def _base_url(market_type: str) -> str:
    return settings.binance_futures_base_url if market_type == "futures" else settings.binance_spot_base_url


def _server_time_offset_ms(market_type: str) -> float:
    """Binance rejects signed requests whose timestamp drifts too far from its own clock. Fetched
    once and cached rather than re-fetched per call — this is a public (unauthenticated) endpoint.
    """
    if market_type in _time_offset_ms:
        return _time_offset_ms[market_type]
    try:
        resp = httpx.get(f"{_base_url(market_type)}{_PUBLIC_TIME_PATH[market_type]}", timeout=10)
        resp.raise_for_status()
        server_time = resp.json()["serverTime"]
        offset = server_time - int(time.time() * 1000)
    except Exception:
        logger.exception("Failed to fetch Binance server time for %s, assuming zero offset", market_type)
        offset = 0
    _time_offset_ms[market_type] = offset
    return offset


def _check_weight_headroom(bucket: str) -> None:
    state = _weight_state.get(bucket)
    if not state:
        return
    age = time.time() - state["checked_at"]
    if age > _WEIGHT_WINDOW_SECONDS:
        return  # stale — Binance's own 1-minute window has almost certainly rolled over by now
    limit = _WEIGHT_LIMITS[bucket]
    if state["used"] / limit >= _WEIGHT_BACKOFF_THRESHOLD:
        raise BinanceRateLimited(
            f"Binance {bucket} API weight usage is high ({state['used']}/{limit}) — backing off for a moment"
        )


def _record_weight(bucket: str, resp: httpx.Response) -> None:
    used = resp.headers.get("X-MBX-USED-WEIGHT-1M") or resp.headers.get("X-SAPI-USED-IP-WEIGHT-1M") or resp.headers.get("X-MBX-USED-WEIGHT")
    if used:
        try:
            _weight_state[bucket] = {"used": int(used), "checked_at": time.time()}
        except ValueError:
            pass


def _signed_get(market_type: str, path: str, api_key: str, api_secret: str, params: dict | None = None) -> dict | list:
    if (market_type, path) not in _ALLOWED_PATHS:
        raise DisallowedEndpoint(f"{path} is not on the read-only allowlist — refusing to call it")

    params = dict(params or {})
    bucket = _weight_bucket(market_type, path)

    cache_key = (market_type, path, api_key, tuple(sorted(params.items())))
    cached = _response_cache.get(cache_key)
    if cached and time.time() - cached[0] < _RESPONSE_CACHE_TTL_SECONDS:
        return cached[1]

    _check_weight_headroom(bucket)

    params["timestamp"] = int(time.time() * 1000 + _server_time_offset_ms(market_type))
    params["recvWindow"] = 10_000

    query = urllib.parse.urlencode(params)
    signature = hmac.new(api_secret.encode(), query.encode(), hashlib.sha256).hexdigest()
    query = f"{query}&signature={signature}"

    resp = httpx.get(
        f"{_base_url(market_type)}{path}?{query}",
        headers={"X-MBX-APIKEY": api_key},
        timeout=15,
    )
    _record_weight(bucket, resp)

    if resp.status_code in (401, 403):
        raise BinanceAuthError(f"Binance rejected the API key (HTTP {resp.status_code}): {resp.text}")
    if resp.status_code == 429:
        retry_after = resp.headers.get("Retry-After", "a few")
        raise BinanceRateLimited(f"Binance rate-limited this request (429) — retry after {retry_after}s")
    if resp.status_code == 418:
        retry_after = resp.headers.get("Retry-After", "a while")
        raise BinanceRateLimited(f"Binance has temporarily banned this IP for excessive requests (418) — retry after {retry_after}s")
    resp.raise_for_status()

    data = resp.json()
    _response_cache[cache_key] = (time.time(), data)
    return data


def check_key_permissions(api_key: str, api_secret: str) -> KeyPermissions:
    data = _signed_get("spot", "/sapi/v1/account/apiRestrictions", api_key, api_secret)
    return KeyPermissions(
        ip_restrict=bool(data.get("ipRestrict")),
        enable_reading=bool(data.get("enableReading")),
        enable_withdrawals=bool(data.get("enableWithdrawals")),
        enable_internal_transfer=bool(data.get("enableInternalTransfer")),
        enable_margin=bool(data.get("enableMargin")),
        enable_futures=bool(data.get("enableFutures")),
        enable_spot_and_margin_trading=bool(data.get("enableSpotAndMarginTrading")),
        enable_portfolio_margin_trading=bool(data.get("enablePortfolioMarginTrading")),
        raw=data,
    )


# Flags that mean the key is NOT the narrow read-only grant the user was asked to create — any of
# these being true is a hard stop, not a soft note.
#
# `enable_futures` was initially assumed to be required for futures visibility (Binance's UI
# groups it under "Enable Futures", which reads as an all-or-nothing futures switch). Verified
# live against a real key with enable_futures=False: /fapi/v2/account, /fapi/v2/positionRisk, and
# /fapi/v1/openOrders all succeeded anyway. So `enable_futures` only gates futures TRADE-type
# endpoints (placing/canceling orders) — enable_reading alone is sufficient for full spot AND
# futures read access. That means a truly read-only key never needs enable_futures on, so it
# belongs in this blocking list too, not as a special case.
_BLOCKING_FLAGS = {
    "enable_withdrawals": "Withdrawals",
    "enable_spot_and_margin_trading": "Spot & Margin Trading",
    "enable_margin": "Margin",
    "enable_futures": "Futures",
    "enable_portfolio_margin_trading": "Portfolio Margin Trading",
    "enable_internal_transfer": "Internal Transfer",
}


def evaluate_key_safety(perms: KeyPermissions) -> tuple[bool, list[str]]:
    """Whether this key is safe to use, plus human-readable warnings for anything that isn't.
    `enable_reading` alone is sufficient for every account-data feature this app offers, spot and
    futures — so a genuinely read-only key has every flag below off except enable_reading.
    """
    warnings: list[str] = []
    if not perms.enable_reading:
        warnings.append("This key does not have \"Enable Reading\" checked, so Bonnco can't fetch any account data with it.")

    for field, label in _BLOCKING_FLAGS.items():
        if getattr(perms, field):
            warnings.append(f"This key has \"{label}\" enabled. Regenerate it with everything unchecked except \"Enable Reading\".")

    safe = perms.enable_reading and not any(getattr(perms, field) for field in _BLOCKING_FLAGS)
    return safe, warnings


def get_spot_account(api_key: str, api_secret: str) -> dict:
    return _signed_get("spot", "/api/v3/account", api_key, api_secret)


def get_futures_account(api_key: str, api_secret: str) -> dict:
    return _signed_get("futures", "/fapi/v2/account", api_key, api_secret)


def get_futures_position_risk(api_key: str, api_secret: str) -> list[dict]:
    return _signed_get("futures", "/fapi/v2/positionRisk", api_key, api_secret)


def get_spot_open_orders(api_key: str, api_secret: str) -> list[dict]:
    return _signed_get("spot", "/api/v3/openOrders", api_key, api_secret)


def get_futures_open_orders(api_key: str, api_secret: str) -> list[dict]:
    return _signed_get("futures", "/fapi/v1/openOrders", api_key, api_secret)


def get_spot_trades(symbol: str, api_key: str, api_secret: str, limit: int = 500) -> list[dict]:
    return _signed_get("spot", "/api/v3/myTrades", api_key, api_secret, {"symbol": symbol, "limit": limit})


def get_futures_trades(symbol: str, api_key: str, api_secret: str, limit: int = 500) -> list[dict]:
    return _signed_get("futures", "/fapi/v1/userTrades", api_key, api_secret, {"symbol": symbol, "limit": limit})


def get_simple_earn_flexible_positions(api_key: str, api_secret: str) -> list[dict]:
    data = _signed_get("spot", "/sapi/v1/simple-earn/flexible/position", api_key, api_secret)
    return data.get("rows", []) if isinstance(data, dict) else []


def get_simple_earn_locked_positions(api_key: str, api_secret: str) -> list[dict]:
    data = _signed_get("spot", "/sapi/v1/simple-earn/locked/position", api_key, api_secret)
    return data.get("rows", []) if isinstance(data, dict) else []
