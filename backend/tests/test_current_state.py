"""Regression tests for the unified state layer's degradation behavior — the whole point of
DataFreshness is that a consumer can tell "this is live" apart from "this is stale/missing and
here's why", so these specifically assert that stale/missing data is marked as such rather than
silently treated as a normal, fresh, neutral value.
"""

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.db import SessionLocal
from app.models.candle import Candle
from app.services import current_state

TEST_SYMBOL = "BONNCOTESTUSDT"


@pytest.fixture
def stale_candle_row():
    """A synthetic candle deliberately opened well outside the freshness window for its timeframe
    — the only synthetic fixture in this suite, since genuinely stale candle data can't be produced
    on demand against a live, actively-refreshed dev database."""
    db = SessionLocal()
    old_open = datetime.utcnow() - timedelta(hours=6)
    row = Candle(
        symbol=TEST_SYMBOL,
        market_type="spot",
        timeframe="1h",
        open_time=old_open,
        close_time=old_open + timedelta(hours=1),
        open=1.0, high=1.0, low=1.0, close=1.0, volume=1.0,
    )
    db.add(row)
    db.commit()
    yield row
    db.execute(Candle.__table__.delete().where(Candle.symbol == TEST_SYMBOL))
    db.commit()
    db.close()


def test_e_stale_candle_data_is_marked_degraded_not_live(db, stale_candle_row):
    freshness = current_state._candle_freshness(db, TEST_SYMBOL, "spot", "1h")
    assert freshness.stale is True
    assert freshness.connection_state == "degraded"
    assert freshness.note is not None
    assert freshness.age_seconds > 3600 * current_state.CANDLE_STALE_MULTIPLIER


def test_e_missing_candle_data_is_marked_unavailable(db):
    """A symbol/timeframe with no candle rows at all — must be reported unavailable, not silently
    treated as "fresh with zero age"."""
    freshness = current_state._candle_freshness(db, "NOSUCHSYMBOLUSDT", "spot", "1h")
    assert freshness.connection_state == "unavailable"
    assert freshness.stale is True
    assert freshness.fetched_at is None


def test_f_missing_funding_provider_data_is_marked_unavailable_not_neutral():
    """If the exchange call for funding fails, the result must be None + connection_state
    "unavailable" with a note explaining why — never a fabricated 0.0 or "normal" value standing
    in for real data that was never actually retrieved.
    """
    with patch("app.services.current_state.get_exchange_adapter") as mock_factory:
        mock_factory.return_value.get_futures_info.side_effect = RuntimeError("simulated provider outage")
        # Bypass the cache so the simulated failure is actually exercised.
        current_state._funding_cache.pop("BONNCOTESTFUNDINGUSDT", None)
        funding, freshness = current_state.get_funding_snapshot("BONNCOTESTFUNDINGUSDT")

    assert funding is None
    assert freshness.connection_state == "unavailable"
    assert freshness.note is not None and "simulated provider outage" in freshness.note
