"""Test fixtures. These tests run against the real dev database (no separate test DB is set up
yet — see the audit's Phase 1 note on this), calling service functions directly rather than
spinning up the full app/scheduler/WebSocket lifecycle for every test run. Tests that need real
candle history use symbols already backfilled in the dev environment (BTCUSDT, ETHUSDT, SOLUSDT)
so they exercise the real signal engine rather than synthetic fixtures.
"""

import pytest

from app.db import SessionLocal


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
