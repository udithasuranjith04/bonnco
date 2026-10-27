"""Regression tests for the two real bugs found and fixed this session:
- cross-timeframe contamination (a "latest signal" read silently mixing different timeframes)
- a check-then-act race letting concurrent requests both compute and insert independently

These call generate_signal directly against real, already-backfilled watchlist symbols rather than
mocking the signal engine, so a regression in the actual cache/lock logic would be caught here, not
just in a mocked approximation of it.
"""

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.models.signal import Signal
from app.models.signal_outcome import SignalOutcome
from app.services.signal_engine import generate_signal

SYMBOL = "BTCUSDT"


def test_a_same_key_stays_stable_within_cache_window(db):
    """Same symbol + same timeframe + same market, called twice in immediate succession: the
    second call must return the exact same row (id), not a freshly recomputed one — this is what
    "decision remains stable" means at the code level.
    """
    first = generate_signal(db, SYMBOL, "spot", "1h")
    second = generate_signal(db, SYMBOL, "spot", "1h")
    assert first.id == second.id
    assert first.signal == second.signal
    assert first.confidence == second.confidence


def test_b_different_timeframes_are_isolated(db):
    """Same symbol, two different timeframes: each must resolve to its own row when read back with
    an explicit timeframe filter — this is the exact backend contract the frontend's
    fetchLatestSignal fix depends on. A regression here (e.g. a filter silently dropped) would
    reintroduce the flicker bug even if the frontend code stayed correct.
    """
    sig_1h = generate_signal(db, SYMBOL, "spot", "1h")
    sig_5m = generate_signal(db, SYMBOL, "spot", "5m")

    read_1h = db.scalars(
        select(Signal)
        .where(Signal.symbol == SYMBOL, Signal.market_type == "spot", Signal.timeframe == "1h")
        .order_by(Signal.created_at.desc())
        .limit(1)
    ).first()
    read_5m = db.scalars(
        select(Signal)
        .where(Signal.symbol == SYMBOL, Signal.market_type == "spot", Signal.timeframe == "5m")
        .order_by(Signal.created_at.desc())
        .limit(1)
    ).first()

    assert read_1h.id == sig_1h.id
    assert read_5m.id == sig_5m.id
    assert read_1h.timeframe == "1h"
    assert read_5m.timeframe == "5m"
    # The two reads must never accidentally return the same row — that's exactly what the missing
    # timeframe filter allowed to happen before the fix.
    assert read_1h.id != read_5m.id


def test_c_spot_and_futures_are_isolated(db):
    """Same symbol, same timeframe, different market type: must be two fully independent signals
    (different entry prices, since spot and futures prices genuinely differ), never conflated.
    """
    sig_spot = generate_signal(db, SYMBOL, "spot", "1h")
    sig_futures = generate_signal(db, SYMBOL, "futures", "1h")

    assert sig_spot.id != sig_futures.id
    assert sig_spot.market_type == "spot"
    assert sig_futures.market_type == "futures"


def test_d_eight_concurrent_requests_produce_exactly_one_row():
    """Fires 8 truly simultaneous requests for a symbol/timeframe/market combo with no recent
    signal (forced cold by deleting anything from the last 30s first), and asserts they all
    resolve to the SAME single generated row rather than racing into duplicate independent
    computations — this is the exact race condition found live earlier this session (confirmed via
    duplicate rows with identical timestamps) and fixed with a per-key lock.
    """
    symbol, market_type, timeframe = "ETHUSDT", "spot", "4h"

    setup_db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(seconds=35)
        stale_ids = setup_db.scalars(
            select(Signal.id).where(
                Signal.symbol == symbol,
                Signal.market_type == market_type,
                Signal.timeframe == timeframe,
                Signal.created_at >= cutoff,
            )
        ).all()
        if stale_ids:
            # generate_signal seeds signal_outcomes rows for every signal it creates (real
            # production behavior, not test-specific) — those child rows have to go first or the
            # foreign key on signal_outcomes.signal_id blocks deleting the parent signal.
            setup_db.execute(delete(SignalOutcome).where(SignalOutcome.signal_id.in_(stale_ids)))
            setup_db.execute(delete(Signal).where(Signal.id.in_(stale_ids)))
        setup_db.commit()
    finally:
        setup_db.close()

    results: list[int] = []

    def _call():
        thread_db = SessionLocal()
        try:
            sig = generate_signal(thread_db, symbol, market_type, timeframe)
            return sig.id
        finally:
            thread_db.close()

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(_call) for _ in range(8)]
        results = [f.result() for f in futures]

    assert len(results) == 8
    assert len(set(results)) == 1, f"Expected all 8 concurrent calls to resolve to one row, got ids: {results}"

    verify_db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(seconds=10)
        rows = verify_db.scalars(
            select(Signal).where(
                Signal.symbol == symbol,
                Signal.market_type == market_type,
                Signal.timeframe == timeframe,
                Signal.created_at >= cutoff,
            )
        ).all()
        assert len(rows) == 1, f"Expected exactly 1 row inserted by the concurrent burst, found {len(rows)}"
    finally:
        verify_db.close()
