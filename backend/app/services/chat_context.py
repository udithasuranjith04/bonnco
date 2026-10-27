from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting
from app.models.signal import Signal
from app.models.trade_journal import TradeJournalEntry
from app.models.watchlist import WatchlistItem
from app.services.checkin import get_checkin
from app.services.current_state import get_funding_snapshot
from app.services.decision_engine import build_decision
from app.services.indicators import InsufficientDataError
from app.services.pattern_history import pattern_success_rate
from app.services.position_coach import build_position_guidance
from app.services.signal_engine import generate_signal, get_risk_profile
from app.services.symbols import base_asset as _base_asset

RECENT_TRADE_JOURNAL_LIMIT = 5
DEFAULT_TIMEFRAME = "1h"


def _dashboard_timeframe(db: Session) -> str:
    row = db.get(AppSetting, "dashboard_timeframe")
    return row.value if row else DEFAULT_TIMEFRAME


def _short_signal_digest(signal_row: Signal) -> str:
    """A compact, structured summary of an already-computed signal, for comparing several coins at
    once — built from the same indicator_snapshot/sentiment_snapshot JSON already stored on the
    row (not by truncating the full reasoning text, which risks cutting mid-sentence or mid-number)."""
    snapshot = signal_row.indicator_snapshot or {}
    bits = [snapshot[key]["label"] for key in ("rsi", "macd", "ema") if snapshot.get(key, {}).get("label")]
    sentiment = signal_row.sentiment_snapshot or {}
    if sentiment.get("headline_count", 0) > 0:
        lean = "bullish" if sentiment["avg_score"] > 0.15 else "bearish" if sentiment["avg_score"] < -0.15 else "mixed"
        bits.append(f"news sentiment {lean}")
    if signal_row.pattern_summary:
        bits.append(signal_row.pattern_summary)
    return "; ".join(bits) if bits else "no strong technical read either way"


def build_chat_context(db: Session, symbol: str, market_type: str, timeframe: str) -> str:
    """Grounds the chat in real, current data by reusing the signal engine directly — the same
    engine that drives the dashboard — rather than re-deriving a parallel view of the market.
    """
    try:
        signal_row = generate_signal(db, symbol.upper(), market_type, timeframe)
    except InsufficientDataError as exc:
        return f"No historical data available yet for {symbol.upper()} on the {timeframe} timeframe ({exc})."

    snapshot = signal_row.indicator_snapshot
    sentiment = signal_row.sentiment_snapshot
    base_symbol = _base_asset(symbol.upper())

    # The structured decision (Phase 3) leads the context — the chat should explain THIS decision,
    # not independently re-derive its own read from the raw indicators below. reused, not a fresh
    # computation: build_decision calls generate_signal internally too, which is cache-hit here.
    decision = build_decision(db, symbol.upper(), market_type, timeframe)
    lines = [
        f"Current Bonnco decision for {symbol.upper()} ({market_type}, {timeframe} timeframe): {decision.state} "
        f"({'has an open ' + decision.position_side + ' position' if decision.has_open_position else 'no open position'}).",
        f"Directional bias: {decision.directional_bias}. Signal strength: {decision.signal_strength}. "
        f"Trade quality: {decision.trade_quality}. Risk quality: {decision.risk_quality}. "
        f"Portfolio compatibility: {decision.portfolio_compatibility}.",
        f"Reason: {decision.reason_text} (codes: {', '.join(decision.reason_codes)})",
        f"Timeframe alignment: {decision.timeframe_alignment.alignment} "
        f"({decision.timeframe_alignment.lower_timeframe or '?'}={decision.timeframe_alignment.lower_bias or 'n/a'}, "
        f"{decision.timeframe_alignment.requested_timeframe}={decision.timeframe_alignment.requested_bias}, "
        f"{decision.timeframe_alignment.higher_timeframe or '?'}={decision.timeframe_alignment.higher_bias or 'n/a'}).",
        f"Data quality: {decision.data_quality.overall}"
        + (f" (stale: {', '.join(decision.data_quality.stale_sources)})" if decision.data_quality.stale_sources else "")
        + (f" (missing: {', '.join(decision.data_quality.missing_sources)})" if decision.data_quality.missing_sources else "") + ".",
        "",
        f"Current Bonnco signal for {symbol.upper()} ({market_type}, {timeframe} timeframe): "
        f"{signal_row.signal} at {signal_row.confidence}% confidence.",
        f"Current price / entry reference: ${signal_row.entry_price}",
    ]
    if signal_row.stop_loss:
        lines.append(f"Reference stop-loss: ${signal_row.stop_loss}")
    if market_type == "futures" and signal_row.suggested_leverage_max:
        lines.append(
            f"Suggested leverage range: {signal_row.suggested_leverage_min}x-{signal_row.suggested_leverage_max}x, "
            f"estimated liquidation price: ${signal_row.liquidation_estimate} (estimate only)"
        )
    if market_type == "futures":
        # Real funding rate, reused from the same cached fetch the unified state layer uses (see
        # current_state.py) — never fetched twice for the same symbol within the cache window.
        funding, funding_freshness = get_funding_snapshot(symbol.upper())
        if funding is not None:
            pct = funding.last_funding_rate * 100
            lines.append(
                f"Current funding rate: {pct:+.4f}% (next funding at {funding.next_funding_time.isoformat()}Z, "
                f"mark price ${funding.mark_price}). "
                f"{'Positive funding means longs pay shorts — a persistently high positive rate can mean crowded long positioning.' if pct > 0 else 'Negative funding means shorts pay longs — a persistently negative rate can mean crowded short positioning.' if pct < 0 else ''}"
            )
        elif funding_freshness.connection_state == "unavailable":
            lines.append("Funding rate: currently unavailable (exchange call failed) — do not assume a value.")
    lines.append(f"Full signal reasoning: {signal_row.reasoning}")
    # The signal's own reasoning text above already includes the historical-parallel sentence
    # (when a genuine one was found) via signal_engine's own similarity lookup, so it doesn't need
    # a second, separate lookup here — this keeps the chat's framing identical to the signal card's.

    for key in ("rsi", "macd", "ema", "bollinger", "volume", "support_resistance"):
        lines.append(f"{key.upper()}: {snapshot[key]['label']}")

    lines.append(
        f"News sentiment (last {sentiment['lookback_hours']}h): average score {sentiment['avg_score']} "
        f"(-1 bearish to +1 bullish), based on {sentiment['headline_count']} {base_symbol}-specific headline(s)."
    )
    for h in sentiment.get("recent_headlines", [])[:3]:
        lines.append(f'  - [{h["sentiment"]}, confidence {h["confidence"]}] "{h["headline"]}" ({h["source"]})')

    # Grounds questions like "what's SOL's flag pattern success rate historically?" in this coin's
    # own tracked outcomes, not generic textbook theory — the current signal reasoning above only
    # covers whatever pattern is forming right now, not how past ones for this symbol played out.
    history_stats = pattern_success_rate(db, symbol.upper())
    if history_stats:
        lines.append(f"Pattern history tracked for {base_symbol} over time (across all timeframes Bonnco has scanned):")
        for stat in history_stats[:8]:
            resolved = stat["hits"] + stat["misses"]
            rate = f"{round(stat['hits'] / resolved * 100)}% of resolved occurrences" if resolved else "no resolved occurrences yet"
            name = stat["pattern"].replace("_", " ")
            lines.append(
                f"  - {name} on {stat['timeframe']}: {stat['hits']} hit(s), {stat['misses']} miss(es), "
                f"{stat['pending']} still pending, {rate} moved the textbook direction"
            )

    return "\n".join(lines)


def build_page_context(db: Session, page: str) -> str | None:
    """Real data currently visible on whatever page the message was actually sent from — without
    this, a reference like "the target" on the Dashboard (the goal/milestone tracker sitting right
    there) has nothing to resolve against except a coin price target, since the chat otherwise only
    knows about the coin/timeframe explicitly passed in, never what's on screen. Reuses the exact
    same data each page already displays (get_checkin, build_position_guidance) rather than
    re-deriving a parallel view of it.
    """
    if page == "dashboard":
        data = get_checkin(db)
        goal = data["goal"]
        lines = ["The user is currently on the Dashboard page. Real data visible to them right now:"]
        lines.append(
            f"Real portfolio value: ${data['total_value_usd']:,.2f}"
            if data["total_value_usd"] is not None
            else "Real portfolio value: currently unavailable (Binance connection issue)"
        )
        if goal["next_milestone_usd"] is not None:
            progress = f", {goal['progress_to_next_pct']}% of the way there" if goal["progress_to_next_pct"] is not None else ""
            lines.append(
                "Goal/milestone tracker shown on this page (the user's own real balance growth target, "
                f"auto-generated in steps — NOT a coin price target): next milestone "
                f"${goal['next_milestone_usd']:,.2f}{progress}."
            )
            if goal["daily_pace_usd"]:
                lines.append(
                    f"Pace reference also shown: about ${goal['daily_pace_usd']:,.2f}/day to reach that "
                    "milestone — an informal reference, not a requirement or a guarantee."
                )
        else:
            lines.append("No goal/milestone data available right now.")
        if data["today_pnl_usd"] is not None:
            lines.append(f"Today's real P&L shown: {'+' if data['today_pnl_usd'] >= 0 else ''}${data['today_pnl_usd']:,.2f}")
        if data["best_watchlist_signal"]:
            b = data["best_watchlist_signal"]
            lines.append(f"Top watchlist signal shown on this page: {b['symbol']} {b['signal']} at {b['confidence']}% confidence.")
        return "\n".join(lines)

    if page == "journal":
        trades = db.scalars(
            select(TradeJournalEntry).where(TradeJournalEntry.exit_price.is_(None)).order_by(TradeJournalEntry.opened_at.desc())
        ).all()
        if not trades:
            return "The user is currently on the Trade Journal page. They have no open positions right now."
        lines = ["The user is currently on the Trade Journal page. Their real open positions shown there:"]
        for t in trades:
            guidance = build_position_guidance(db, t)
            lines.append(
                f"  - {t.symbol} ({t.market_type}, {t.side}, {t.leverage}x): entry ${t.entry_price}, "
                f"current ${guidance['current_price']}, P&L {guidance['pnl_pct']:+.2f}%"
            )
        return "\n".join(lines)

    return None


def build_user_context(db: Session) -> str:
    """Account-level context Bonnco should already be aware of on every message, not just when a
    specific coin is being discussed, so it can proactively connect an answer to the user's actual
    watchlist, risk profile, or recent trades instead of only answering the literal question asked.
    """
    lines = [f"User's current risk profile setting: {get_risk_profile(db)}."]

    watchlist_items = db.scalars(select(WatchlistItem).where(WatchlistItem.enabled.is_(True))).all()
    if watchlist_items:
        symbols = ", ".join(f"{w.symbol} ({w.market_type})" for w in watchlist_items)
        lines.append(f"User's current watchlist: {symbols}.")

        # Real, current signal for every watchlist coin — always included, not only when a specific
        # coin is named — so a comparison/recommendation question ("which coin is best right now",
        # "find a coin for X") can be answered by actually comparing real computed data across the
        # whole watchlist instead of falling back to generic textbook theory. Reuses the exact same
        # signal engine (and its ~30s cache) already used everywhere else in the app; no new
        # computation and no extra AI cost, since scoring is deterministic, not an LLM call.
        timeframe = _dashboard_timeframe(db)
        lines.append(f"Current real signal for every watchlist coin ({timeframe} timeframe):")
        for w in watchlist_items:
            try:
                sig = generate_signal(db, w.symbol, w.market_type, timeframe)
            except InsufficientDataError:
                lines.append(f"  - {w.symbol} ({w.market_type}): no signal data available yet.")
                continue
            except Exception:
                continue
            lines.append(f"  - {w.symbol} ({w.market_type}): {sig.signal} at {sig.confidence}% confidence — {_short_signal_digest(sig)}.")
    else:
        lines.append("User's watchlist is currently empty.")

    recent_trades = db.scalars(
        select(TradeJournalEntry).order_by(TradeJournalEntry.created_at.desc()).limit(RECENT_TRADE_JOURNAL_LIMIT)
    ).all()
    if recent_trades:
        lines.append(f"User's {len(recent_trades)} most recent trade journal entries (most recent first):")
        for t in recent_trades:
            status = "closed" if t.closed_at else "still open"
            pnl = f", P&L {t.result_pnl:+.2f}" if t.result_pnl is not None else ""
            lines.append(f"  - {t.symbol} ({t.market_type}, {t.side}, {t.leverage}x), entry ${t.entry_price}, {status}{pnl}")

    return "\n".join(lines)
