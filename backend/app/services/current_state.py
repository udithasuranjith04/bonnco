"""The canonical "what does Bonnco actually know right now" aggregator — the single place that
combines the signal engine, portfolio sync, goal tracking, and funding data into one object, with
explicit freshness/connection-state on every source. This is a pure aggregation layer: every field
here is computed by calling the exact same functions the rest of the app already calls
(generate_signal, get_portfolio_summary, get_goal_progress, find_similar_period, get_futures_info)
— nothing here recomputes indicators, re-derives portfolio value, or re-implements the signal
engine. The point is one shared source of truth other consumers (checkin.py, chat_context.py) route
through, not a second parallel computation.
"""

import logging
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candle import Candle
from app.schemas.current_state import (
    CurrentStateOut,
    DataFreshness,
    FundingOut,
    GoalState,
    HistoricalSimilarityOut,
    PortfolioState,
    SymbolState,
)
from app.services import binance_credentials, binance_positions, goal_progress
from app.services.binance_portfolio_summary import get_portfolio_summary
from app.services.exchange.base import TIMEFRAMES
from app.services.exchange.factory import get_exchange_adapter
from app.services.historical_similarity import find_similar_period, trend_from_price_emas
from app.services.indicators import InsufficientDataError
from app.services.signal_engine import generate_signal

logger = logging.getLogger("bonnco.current_state")

# How long a candle can sit un-refreshed before the state layer calls it stale, expressed as a
# multiple of the timeframe's own duration — the scheduler refreshes every 60s, so even the 5m
# timeframe should never realistically fall behind by 2x its own bar length in normal operation.
_TIMEFRAME_SECONDS = {"5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400}
CANDLE_STALE_MULTIPLIER = 2

# Funding rate changes on Binance's own ~8h schedule — polling the real endpoint every single state
# build would be pure waste. Cached per-symbol with the real fetch timestamp preserved, so
# `age_seconds` always reflects how old the value actually is, never a synthetic "just now".
FUNDING_CACHE_SECONDS = 300
_funding_cache: dict[str, tuple[FundingOut, datetime]] = {}
_funding_cache_lock = threading.Lock()


@dataclass
class _RawFunding:
    data: FundingOut | None
    fetched_at: datetime | None
    from_cache: bool
    error: str | None


def _get_funding(symbol: str) -> _RawFunding:
    """The exact same call already used by GET /api/market/futures-info/{symbol} — see
    exchange/binance.py's get_futures_info, which hits Binance's real /fapi/v1/premiumIndex
    endpoint. This wraps it with a cache (see FUNDING_CACHE_SECONDS) so building state repeatedly
    for the same symbol doesn't refetch it unnecessarily, and preserves the real fetch timestamp
    rather than stamping "now" on a cached value.
    """
    now = datetime.utcnow()
    with _funding_cache_lock:
        cached = _funding_cache.get(symbol)
        if cached is not None:
            data, fetched_at = cached
            if (now - fetched_at).total_seconds() < FUNDING_CACHE_SECONDS:
                return _RawFunding(data=data, fetched_at=fetched_at, from_cache=True, error=None)

    try:
        adapter = get_exchange_adapter()
        info = adapter.get_futures_info(symbol)
    except Exception as exc:
        logger.warning("Funding fetch failed for %s: %s", symbol, exc)
        return _RawFunding(data=None, fetched_at=None, from_cache=False, error=str(exc))

    data = FundingOut(
        mark_price=info.mark_price,
        index_price=info.index_price,
        last_funding_rate=info.last_funding_rate,
        next_funding_time=info.next_funding_time,
    )
    with _funding_cache_lock:
        _funding_cache[symbol] = (data, now)
    return _RawFunding(data=data, fetched_at=now, from_cache=False, error=None)


def get_funding_snapshot(symbol: str) -> tuple[FundingOut | None, DataFreshness]:
    """Public entry point to the same cached funding fetch build_symbol_state uses internally —
    for callers (e.g. chat_context.py) that want funding data without paying for the rest of a
    full symbol state build (candle freshness, historical similarity) on every call."""
    raw = _get_funding(symbol)
    freshness = DataFreshness(
        provider="binance_rest",
        fetched_at=raw.fetched_at,
        age_seconds=round((datetime.utcnow() - raw.fetched_at).total_seconds(), 1) if raw.fetched_at else None,
        connection_state="connected" if raw.data else "unavailable",
        stale=False,
        fallback_used=False,
        note=raw.error if raw.error else (f"Served from {FUNDING_CACHE_SECONDS}s cache." if raw.from_cache else None),
    )
    return raw.data, freshness


def _candle_freshness(db: Session, symbol: str, market_type: str, timeframe: str) -> DataFreshness:
    latest = db.scalars(
        select(Candle)
        .where(Candle.symbol == symbol, Candle.market_type == market_type, Candle.timeframe == timeframe)
        .order_by(Candle.close_time.desc())
        .limit(1)
    ).first()

    if latest is None:
        return DataFreshness(
            provider="binance_rest",
            fetched_at=None,
            age_seconds=None,
            connection_state="unavailable",
            stale=True,
            fallback_used=False,
            note="No candle data ingested yet for this symbol/timeframe.",
        )

    # Use open_time, not close_time, as the freshness reference: close_time is the bar's scheduled
    # end (the top of the next hour for a 1h candle), which is still in the future for whatever bar
    # is currently forming — comparing against it would make a perfectly fresh, actively-updating
    # candle look like it has negative age. open_time is always <= now, so "how long has the
    # current bar been open" is the real, sane proxy for "is the ingester still keeping this fresh".
    age = (datetime.utcnow() - latest.open_time).total_seconds()
    bar_seconds = _TIMEFRAME_SECONDS.get(timeframe, 3600)
    stale = age > bar_seconds * CANDLE_STALE_MULTIPLIER
    return DataFreshness(
        provider="binance_rest",
        fetched_at=latest.open_time,
        age_seconds=round(age, 1),
        connection_state="degraded" if stale else "connected",
        stale=stale,
        fallback_used=False,
        note=f"Latest known candle opened {round(age)}s ago (expected a fresher one within ~{bar_seconds * CANDLE_STALE_MULTIPLIER}s for {timeframe})." if stale else None,
    )


def build_symbol_state(db: Session, symbol: str, market_type: str, timeframe: str) -> SymbolState:
    symbol = symbol.upper()
    if timeframe not in TIMEFRAMES:
        raise ValueError(f"timeframe must be one of {TIMEFRAMES}")

    candle_freshness = _candle_freshness(db, symbol, market_type, timeframe)

    try:
        sig = generate_signal(db, symbol, market_type, timeframe)
        signal_freshness = DataFreshness(
            provider="bonnco_signal_engine",
            fetched_at=sig.created_at,
            age_seconds=round((datetime.utcnow() - sig.created_at).total_seconds(), 1),
            connection_state="connected",
            stale=False,
            fallback_used=False,
        )
    except InsufficientDataError as exc:
        return SymbolState(
            symbol=symbol,
            market_type=market_type,
            timeframe=timeframe,
            signal=None,
            confidence=None,
            entry_price=None,
            stop_loss=None,
            suggested_leverage_min=None,
            suggested_leverage_max=None,
            liquidation_estimate=None,
            indicator_snapshot=None,
            pattern_summary=None,
            pattern_bias=None,
            pattern_confirmed=None,
            sentiment_snapshot=None,
            order_flow=None,
            historical_similarity=None,
            funding=None,
            signal_freshness=DataFreshness(
                provider="bonnco_signal_engine",
                fetched_at=None,
                age_seconds=None,
                connection_state="unavailable",
                stale=True,
                fallback_used=False,
                note=str(exc),
            ),
            candle_freshness=candle_freshness,
            funding_freshness=None,
        )

    snapshot = sig.indicator_snapshot or {}
    order_flow = snapshot.get("delta")  # only present once trade_delta has tracked this symbol a while

    historical: HistoricalSimilarityOut | None = None
    try:
        ema = snapshot.get("ema", {}).get("value", {})
        rsi_val = snapshot.get("rsi", {}).get("value")
        bb_val = snapshot.get("bollinger", {}).get("value", {}).get("percent_b")
        vol_ratio = snapshot.get("volume", {}).get("value", {}).get("ratio")
        if ema and rsi_val is not None and bb_val is not None and vol_ratio is not None:
            trend = trend_from_price_emas(sig.entry_price, ema.get("ema50"), ema.get("ema200"))
            match = find_similar_period(db, symbol, market_type, timeframe, rsi_val, trend, vol_ratio, bb_val)
            if match:
                historical = HistoricalSimilarityOut(
                    open_time=match.open_time,
                    close_price=match.close_price,
                    rsi=match.rsi,
                    trend=match.trend,
                    volume_ratio=match.volume_ratio,
                    forward_return_pct=match.forward_return_pct,
                    forward_horizon_days=match.forward_horizon_days,
                    distance=match.distance,
                )
    except Exception:
        logger.exception("Historical similarity lookup failed while building state for %s %s %s", symbol, market_type, timeframe)

    funding: FundingOut | None = None
    funding_freshness: DataFreshness | None = None
    if market_type == "futures":
        funding, funding_freshness = get_funding_snapshot(symbol)

    return SymbolState(
        symbol=symbol,
        market_type=market_type,
        timeframe=timeframe,
        signal=sig.signal,
        confidence=sig.confidence,
        entry_price=sig.entry_price,
        stop_loss=sig.stop_loss,
        suggested_leverage_min=sig.suggested_leverage_min,
        suggested_leverage_max=sig.suggested_leverage_max,
        liquidation_estimate=sig.liquidation_estimate,
        indicator_snapshot=snapshot,
        pattern_summary=sig.pattern_summary,
        pattern_bias=sig.pattern_bias,
        pattern_confirmed=sig.pattern_confirmed,
        sentiment_snapshot=sig.sentiment_snapshot,
        order_flow=order_flow,
        historical_similarity=historical,
        funding=funding,
        signal_freshness=signal_freshness,
        candle_freshness=candle_freshness,
        funding_freshness=funding_freshness,
    )


def build_portfolio_state(db: Session) -> PortfolioState:
    resolved = binance_credentials.resolve_active_credentials(db)
    if resolved is None:
        return PortfolioState(
            connected=False,
            total_value_usd=None,
            spot_value_usd=None,
            earn_value_usd=None,
            futures_margin_usd=None,
            today_pnl_usd=None,
            today_pnl_pct=None,
            open_positions=[],
            freshness=DataFreshness(
                provider="binance_rest",
                fetched_at=None,
                age_seconds=None,
                connection_state="unavailable",
                stale=True,
                fallback_used=False,
                note="No Binance credentials configured.",
            ),
        )

    now = datetime.utcnow()
    summary = get_portfolio_summary(db)
    positions = binance_positions.get_open_futures_positions(db)

    degraded = summary.get("total_value_usd") is None
    return PortfolioState(
        connected=summary.get("connected", False),
        total_value_usd=summary.get("total_value_usd"),
        spot_value_usd=summary.get("spot_value_usd"),
        earn_value_usd=summary.get("earn_value_usd"),
        futures_margin_usd=summary.get("futures_margin_usd"),
        today_pnl_usd=summary.get("today_pnl_usd"),
        today_pnl_pct=summary.get("today_pnl_pct"),
        open_positions=positions,
        freshness=DataFreshness(
            provider="binance_rest",
            fetched_at=now,
            age_seconds=0.0,
            connection_state="degraded" if degraded else "connected",
            stale=degraded,
            fallback_used=False,
            note="Binance credentials are configured but the account call failed (see /api/binance/status)." if degraded else None,
        ),
    )


def build_goal_state(db: Session) -> GoalState:
    now = datetime.utcnow()
    goal = goal_progress.get_goal_progress(db)
    degraded = goal.get("current_value_usd") is None
    return GoalState(
        current_value_usd=goal.get("current_value_usd"),
        highest_milestone_reached_usd=goal.get("highest_milestone_reached_usd", 0.0),
        next_milestone_usd=goal.get("next_milestone_usd"),
        milestones=goal.get("milestones", []),
        newly_reached_milestone_usd=goal.get("newly_reached_milestone_usd"),
        progress_to_next_pct=goal.get("progress_to_next_pct"),
        daily_pace_usd=goal.get("daily_pace_usd"),
        freshness=DataFreshness(
            provider="bonnco_goal_progress",
            fetched_at=now,
            age_seconds=0.0,
            connection_state="degraded" if degraded else "connected",
            stale=degraded,
            fallback_used=False,
            note="Real balance unavailable right now, so goal progress can't be computed against it." if degraded else None,
        ),
    )


def build_current_state(
    db: Session, symbol: str | None = None, market_type: str = "spot", timeframe: str = "1h"
) -> CurrentStateOut:
    """The single entry point everything else should route through — Dashboard/checkin, Ask
    Bonnco's context builder, Coin Detail, and Position Coach all want some slice of this same
    underlying data; this is where it's assembled exactly once per call, from the exact same
    functions those callers used to call independently.
    """
    symbol_state = build_symbol_state(db, symbol, market_type, timeframe) if symbol else None
    return CurrentStateOut(
        generated_at=datetime.utcnow(),
        symbol=symbol_state,
        portfolio=build_portfolio_state(db),
        goal=build_goal_state(db),
    )
