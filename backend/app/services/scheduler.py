import logging

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.core.config import get_settings
from app.db import SessionLocal
from app.models.watchlist import WatchlistItem
from app.services.bitcoin_whales import POLL_INTERVAL_SECONDS as BTC_WHALE_POLL_SECONDS
from app.services.bitcoin_whales import scan_latest_block as scan_bitcoin_whales
from app.services.candle_ingest import ingest_candles
from app.services.exchange.base import TIMEFRAMES
from app.services.exchange.factory import get_exchange_adapter
from app.services.ethereum_whales import POLL_INTERVAL_SECONDS as ETH_WHALE_POLL_SECONDS
from app.services.ethereum_whales import is_configured as ethereum_whales_configured
from app.services.ethereum_whales import scan_latest_block as scan_ethereum_whales
from app.services.news_ingest import run_news_ingest_cycle
from app.services.pattern_history import evaluate_pending_outcomes
from app.services.signal_outcomes import evaluate_pending_signal_outcomes
from app.services import binance_credentials, binance_positions
from app.services.binance_trade_history import sync_all_spot_trade_history
from app.services.solana_whales import POLL_INTERVAL_SECONDS as SOLANA_WHALE_POLL_SECONDS
from app.services.solana_whales import scan_latest_block as scan_solana_whales

logger = logging.getLogger("bonnco.scheduler")
settings = get_settings()

_scheduler = BackgroundScheduler()

# Dashboard shows this many top-volume coins beyond the user's own watchlist — their candle data
# needs to stay fresh too, the same way watchlist coins do, so their signal cards are genuinely live.
MARKET_OVERVIEW_LIMIT = 15


def _tracked_symbols(db) -> list[tuple[str, str]]:
    """Watchlist symbols (any market type) plus the top-volume market symbols (spot), deduplicated.
    This is the full set of (symbol, market_type) pairs the scheduler keeps candle data fresh for.
    """
    watchlist_items = db.scalars(select(WatchlistItem).where(WatchlistItem.enabled.is_(True))).all()
    pairs = {(item.symbol, item.market_type) for item in watchlist_items}

    try:
        adapter = get_exchange_adapter()
        top = adapter.get_top_symbols_by_volume("spot", limit=MARKET_OVERVIEW_LIMIT)
        pairs.update((t.symbol, "spot") for t in top)
    except Exception:
        logger.exception("Failed to fetch top market symbols for scheduler tracking")

    return list(pairs)


def refresh_watchlist_candles(limit: int = 2) -> None:
    """Pull the most recent candle(s) for every tracked symbol/timeframe. Cheap, runs every minute."""
    db = SessionLocal()
    adapter = get_exchange_adapter()
    try:
        for symbol, market_type in _tracked_symbols(db):
            for timeframe in TIMEFRAMES:
                try:
                    ingest_candles(db, adapter, symbol, market_type, timeframe, limit=limit)
                except Exception:
                    logger.exception("Candle refresh failed for %s %s %s", symbol, market_type, timeframe)
    finally:
        db.close()


def backfill_all_watchlist(limit: int = 500) -> None:
    """One-time historical seed so indicators/backtests have enough candles to work with."""
    db = SessionLocal()
    adapter = get_exchange_adapter()
    try:
        for symbol, market_type in _tracked_symbols(db):
            for timeframe in TIMEFRAMES:
                try:
                    ingest_candles(db, adapter, symbol, market_type, timeframe, limit=limit)
                except Exception:
                    logger.exception("Backfill failed for %s %s %s", symbol, market_type, timeframe)
    finally:
        db.close()


def refresh_news() -> None:
    """Fetch RSS feeds, score new headlines with the AI provider, store results. Runs every few minutes."""
    db = SessionLocal()
    try:
        stored = run_news_ingest_cycle(db)
        if stored:
            logger.info("News cycle stored %d newly scored headline(s)", stored)
    except Exception:
        logger.exception("News ingest cycle failed")
    finally:
        db.close()


def evaluate_pattern_outcomes() -> None:
    """Checks confirmed patterns old enough to judge (timeframe-scaled) and records whether price
    actually moved the textbook direction after confirmation. Runs far less often than candle/news
    refresh, since outcomes only become ready hours-to-days after confirmation, not every minute.
    """
    db = SessionLocal()
    adapter = get_exchange_adapter()
    try:
        evaluated = evaluate_pending_outcomes(db, adapter.get_current_price)
        db.commit()
        if evaluated:
            logger.info("Evaluated %d pending pattern outcome(s)", evaluated)
    except Exception:
        logger.exception("Pattern outcome evaluation failed")
    finally:
        db.close()


def evaluate_signal_outcomes() -> None:
    """Resolves signal-outcome checkpoints (4h/24h/7d) whose time has arrived, or whose reference
    stop-loss was already touched, against real stored candle data. The shortest tracked horizon is
    4h, so there's no need to run this as often as candle/news refresh.
    """
    db = SessionLocal()
    try:
        resolved = evaluate_pending_signal_outcomes(db)
        if resolved:
            logger.info("Resolved %d pending signal outcome checkpoint(s)", resolved)
    except Exception:
        logger.exception("Signal outcome evaluation failed")
    finally:
        db.close()


def sync_binance_trade_history() -> None:
    """Ongoing half of the trade-history sync: picks up newly closed real trades automatically so
    the user doesn't have to manually log every exit. No-ops (silently, not an error) when Binance
    isn't connected — this only ever runs against a real connected account.
    """
    db = SessionLocal()
    try:
        if binance_credentials.resolve_active_credentials(db) is None:
            return
        results = sync_all_spot_trade_history(db)
        total = sum(results.values())
        if total:
            logger.info("Synced %d newly closed real trade(s) from Binance: %s", total, results)
    except Exception:
        logger.exception("Binance trade history sync failed")
    finally:
        db.close()


def auto_import_open_positions() -> None:
    """Fast-path detection of newly opened real Binance futures positions — separate from the
    30-minute closed-trade history sync below, because Active Position Coach guidance is only
    useful if the journal entry exists close to the moment the position was actually opened, not
    up to 30 minutes later. Reuses the exact same reconcile/import logic the Trade Journal's
    manual "one-click import" button already calls; this just runs it automatically and often.
    Cheap: /fapi/v2/positionRisk is a light call, and the existing 20s response cache in
    binance_account._signed_get means importing N new positions in one run still only hits
    Binance once, not N+1 times. No-ops silently when Binance isn't connected.
    """
    db = SessionLocal()
    try:
        if binance_credentials.resolve_active_credentials(db) is None:
            return
        result = binance_positions.reconcile_positions(db)
        imported = 0
        for pos in result["unmatched_binance_positions"]:
            if binance_positions.import_position(db, pos["symbol"]) is not None:
                imported += 1
        if imported:
            logger.info("Auto-imported %d newly opened real Binance position(s) into the journal", imported)
    except Exception:
        logger.exception("Auto-import of open Binance positions failed")
    finally:
        db.close()


def track_solana_whales() -> None:
    """Samples the current Solana block for whale-sized SOL transfers. Sampled, not exhaustive —
    see the POLL_INTERVAL_SECONDS comment in solana_whales.py for why continuous full coverage
    isn't viable on the free public RPC.
    """
    adapter = get_exchange_adapter()
    try:
        sol_price = adapter.get_current_price("SOLUSDT", "spot")
        found = scan_solana_whales(sol_price)
        if found:
            logger.info("Found %d Solana whale transfer(s) in latest sampled block", found)
    except Exception:
        logger.exception("Solana whale scan failed")


def track_ethereum_whales() -> None:
    """Scans the latest Ethereum block for whale-sized native ETH transfers via Etherscan's free
    API. No-ops (and logs once) when ETHERSCAN_API_KEY isn't configured, rather than showing fake
    data or repeatedly erroring against an unauthenticated request.
    """
    if not ethereum_whales_configured():
        return
    adapter = get_exchange_adapter()
    try:
        eth_price = adapter.get_current_price("ETHUSDT", "spot")
        found = scan_ethereum_whales(eth_price)
        if found:
            logger.info("Found %d Ethereum whale transfer(s) in latest block", found)
    except Exception:
        logger.exception("Ethereum whale scan failed")


def track_bitcoin_whales() -> None:
    """Checks for a new Bitcoin block and, when one has landed, pages through its full transaction
    list for whale-sized outputs via mempool.space's free public API. No API key involved, and
    unlike Solana this scans every transaction in the block rather than sampling, since BTC's much
    slower ~10 minute block cadence leaves enough time to do it exhaustively.
    """
    adapter = get_exchange_adapter()
    try:
        btc_price = adapter.get_current_price("BTCUSDT", "spot")
        found = scan_bitcoin_whales(btc_price)
        if found:
            logger.info("Found %d Bitcoin whale transfer(s) in latest block", found)
    except Exception:
        logger.exception("Bitcoin whale scan failed")


def start_scheduler() -> None:
    if _scheduler.running:
        return
    backfill_all_watchlist()
    _scheduler.add_job(refresh_watchlist_candles, "interval", seconds=60, id="refresh_candles")
    _scheduler.add_job(refresh_news, "interval", seconds=settings.news_poll_seconds, id="refresh_news")
    _scheduler.add_job(evaluate_pattern_outcomes, "interval", seconds=1800, id="evaluate_pattern_outcomes")
    _scheduler.add_job(evaluate_signal_outcomes, "interval", seconds=900, id="evaluate_signal_outcomes")
    _scheduler.add_job(sync_binance_trade_history, "interval", seconds=1800, id="sync_binance_trade_history")
    _scheduler.add_job(auto_import_open_positions, "interval", seconds=90, id="auto_import_open_positions")
    _scheduler.add_job(track_solana_whales, "interval", seconds=SOLANA_WHALE_POLL_SECONDS, id="track_solana_whales")
    _scheduler.add_job(track_bitcoin_whales, "interval", seconds=BTC_WHALE_POLL_SECONDS, id="track_bitcoin_whales")
    if ethereum_whales_configured():
        _scheduler.add_job(track_ethereum_whales, "interval", seconds=ETH_WHALE_POLL_SECONDS, id="track_ethereum_whales")
    else:
        logger.warning("ETHERSCAN_API_KEY not set: Ethereum whale tracking disabled until configured")
    _scheduler.start()


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
