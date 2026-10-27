"""Active Position Coach: for every OPEN Trade Journal entry, computes live P&L and a fresh
hold/exit guidance sentence grounded in the coin's real current signal/indicator state compared to
the conditions that justified the original entry. This is decision support, not an instruction —
every guidance string ends by saying so. Never auto-closes or modifies a position; only reports on it.
"""

import logging

from sqlalchemy.orm import Session

from app.models.signal import Signal
from app.models.trade_journal import TradeJournalEntry
from app.services.exchange.factory import get_exchange_adapter
from app.services.indicators import InsufficientDataError
from app.services.signal_engine import generate_signal

logger = logging.getLogger("bonnco.position_coach")

DEFAULT_TIMEFRAME = "4h"
LONG_AGREE_SIGNALS = ("BUY", "STRONG_BUY")
SHORT_AGREE_SIGNALS = ("SELL", "STRONG_SELL")

# Within this % of the logged stop-loss, show the proximity warning.
STOP_PROXIMITY_PCT = 1.5

NOTABLE_INDICATORS = ("rsi", "macd", "ema", "bollinger")
INDICATOR_LABELS = {"rsi": "RSI", "macd": "MACD", "ema": "the EMA trend", "bollinger": "the Bollinger position"}

DECISION_SUPPORT_FOOTER = "This is decision support — the choice is yours."


def _interpretation(snapshot: dict | None, key: str) -> str | None:
    return (snapshot or {}).get(key, {}).get("interpretation")


def _find_change(original_snapshot: dict | None, current_snapshot: dict | None) -> tuple[str, str, str] | None:
    """First indicator whose interpretation genuinely differs between entry and now, or None."""
    for key in NOTABLE_INDICATORS:
        orig = _interpretation(original_snapshot, key)
        curr = _interpretation(current_snapshot, key)
        if orig and curr and orig != curr:
            return key, orig, curr
    return None


def _compose_guidance(
    trade: TradeJournalEntry, move_pct: float, original_signal: Signal | None, current_signal: Signal | None
) -> str:
    move_word = "up" if move_pct >= 0 else "down"
    move_line = f"You're {move_word} {abs(move_pct):.1f}% since entry."

    if current_signal is None:
        return (
            f"{move_line} Not enough live data right now to re-check the technical picture for "
            f"{trade.symbol} — check back shortly. {DECISION_SUPPORT_FOOTER}"
        )

    is_long = trade.side == "long"
    agrees = current_signal.signal in (LONG_AGREE_SIGNALS if is_long else SHORT_AGREE_SIGNALS)
    opposes = current_signal.signal in (SHORT_AGREE_SIGNALS if is_long else LONG_AGREE_SIGNALS)

    change = _find_change(
        original_signal.indicator_snapshot if original_signal else None, current_signal.indicator_snapshot
    )
    change_note = ""
    if change:
        key, orig, curr = change
        change_note = f" {INDICATOR_LABELS[key]} has moved from {orig} to {curr} since your entry."

    if opposes:
        body = (
            f"{move_line} Bonnco's current read on {trade.symbol} has flipped to "
            f"{current_signal.signal.replace('_', ' ')}, opposite your {trade.side} position.{change_note} "
            f"The original setup has weakened. Consider whether your stop-loss still makes sense here."
        )
    elif agrees:
        thesis_note = ""
        if original_signal and original_signal.pattern_summary:
            thesis_note = f" (original setup: {original_signal.pattern_summary.rstrip('.')})"
        body = (
            f"{move_line} The original {trade.side} thesis{thesis_note} is still intact — Bonnco's current "
            f"read on {trade.symbol} is still {current_signal.signal.replace('_', ' ')}, no clear exit signal yet."
        )
    elif original_signal is not None and original_signal.signal == "HOLD":
        body = (
            f"{move_line} Bonnco's current read on {trade.symbol} is HOLD, same as it was at entry — there was "
            f"never a strong directional signal backing this {trade.side} either way.{change_note} Not a "
            f"reversal, and not a fresh confirmation — this one was more discretionary from the start."
        )
    else:
        body = (
            f"{move_line} Bonnco's current read on {trade.symbol} has cooled to HOLD.{change_note} Not a clear "
            f"reversal, but the original conviction has softened — worth watching closely."
        )

    return f"{body} {DECISION_SUPPORT_FOOTER}"


def _stop_warning(trade: TradeJournalEntry, current_price: float) -> str | None:
    if trade.stop_loss is None or current_price <= 0:
        return None
    is_long = trade.side == "long"
    distance_pct = (
        (current_price - trade.stop_loss) / current_price * 100
        if is_long
        else (trade.stop_loss - current_price) / current_price * 100
    )
    if 0 <= distance_pct <= STOP_PROXIMITY_PCT:
        return f"Price is approaching your stop-loss at ${trade.stop_loss:,.2f}."
    return None


def build_position_guidance(db: Session, trade: TradeJournalEntry) -> dict:
    adapter = get_exchange_adapter()
    current_price = adapter.get_current_price(trade.symbol, trade.market_type)

    direction = 1 if trade.side == "long" else -1
    raw_return = (current_price - trade.entry_price) / trade.entry_price * direction
    pnl_pct = round(raw_return * trade.leverage * 100, 3)
    pnl_usd = round(trade.position_size_usd * (pnl_pct / 100), 2) if trade.position_size_usd else None

    original_signal = db.get(Signal, trade.signal_id) if trade.signal_id else None
    timeframe = original_signal.timeframe if original_signal else DEFAULT_TIMEFRAME

    current_signal = None
    try:
        current_signal = generate_signal(db, trade.symbol, trade.market_type, timeframe)
    except InsufficientDataError:
        pass
    except Exception:
        logger.exception("Failed to generate current signal for position coach (%s %s)", trade.symbol, trade.market_type)

    guidance = _compose_guidance(trade, pnl_pct, original_signal, current_signal)
    stop_warning = _stop_warning(trade, current_price)

    return {
        "trade": trade,
        "current_price": current_price,
        "pnl_pct": pnl_pct,
        "pnl_usd": pnl_usd,
        "current_signal": current_signal.signal if current_signal else None,
        "guidance": guidance,
        "stop_warning": stop_warning,
    }
