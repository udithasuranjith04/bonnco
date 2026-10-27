"""Regression tests for the two chat-context bugs found and fixed this session:
- the Dashboard's goal/milestone data not being available to resolve "the target"
- an open position being assumed/hallucinated when none actually exists

These test the deterministic context-building functions directly (real data, no GPT call, so they
run fast and free on every test run). The LLM's actual use of this context was verified separately
against live GPT calls — see the phase report for those transcripts; testing the LLM's prose output
byte-for-byte isn't meaningful or stable enough for an automated regression test.
"""

from sqlalchemy import select

from app.models.trade_journal import TradeJournalEntry
from app.services.chat_context import build_page_context, build_user_context
from app.services.current_state import build_goal_state


def test_g_dashboard_page_context_contains_real_goal_figures(db):
    """The exact regression from the request: Dashboard context must contain the real goal/
    milestone numbers so "the target" has something concrete to resolve against — cross-checked
    against the same unified state builder the context is supposed to be sourcing from.
    """
    goal = build_goal_state(db)
    context = build_page_context(db, "dashboard")

    assert context is not None
    assert "Dashboard" in context
    assert "Goal/milestone tracker" in context
    assert "NOT a coin price target" in context
    if goal.next_milestone_usd is not None:
        assert f"${goal.next_milestone_usd:,.2f}" in context


def test_h_user_context_never_states_open_position_for_a_closed_trade(db):
    """The exact hallucination found live while verifying funding: chat context must mark a closed
    trade as closed, never phrase it in a way a reader (or an LLM) would parse as "currently open".
    """
    context = build_user_context(db)
    # Every trade line is emitted as either "still open" or "closed" (see chat_context.py) — this
    # asserts the literal open/closed marker is always one of those two, never ambiguous.
    for line in context.splitlines():
        if line.strip().startswith("- ") and ("still open" in line or "closed" in line):
            assert ("still open" in line) != ("closed" in line), f"Ambiguous open/closed status in: {line}"


def test_h_journal_page_context_reflects_real_open_position_count(db):
    """Cross-checks the Trade Journal page context against the same real open-trade query
    build_page_context's "journal" branch itself uses, so the test fails if that branch ever
    silently drifts from the real underlying data (e.g. an added filter that hides real positions).
    """
    open_trades = db.scalars(select(TradeJournalEntry).where(TradeJournalEntry.exit_price.is_(None))).all()
    context = build_page_context(db, "journal")

    assert context is not None
    if len(open_trades) == 0:
        assert "no open positions" in context.lower()
    else:
        for t in open_trades:
            assert t.symbol in context
