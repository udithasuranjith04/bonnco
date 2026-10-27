import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.pattern_history import PatternHistoryEntry
from patterns.models import DetectedPattern

logger = logging.getLogger("bonnco.pattern_history")

# How long after confirmation to wait before judging whether a pattern's textbook direction played
# out, scaled to each timeframe so a 5m pattern isn't judged on the same wall-clock delay as a 1d
# one. Expressed as "N candles worth of time".
TIMEFRAME_MINUTES = {"5m": 5, "15m": 15, "1h": 60, "4h": 240, "1d": 1440}
OUTCOME_EVAL_CANDLES = 10
# Minimum price move (in the pattern's bias direction) to count as a genuine "hit" rather than
# noise around the detection price.
OUTCOME_HIT_THRESHOLD = 0.01


def record_pattern_occurrence(db: Session, pattern: DetectedPattern, current_price: float) -> None:
    """Inserts a new pattern_history row the first time this exact occurrence is seen, or updates
    the existing row's completeness/confirmed/last_seen_at if it's the same ongoing occurrence —
    repeated signal-generation calls while a pattern is still forming should never create duplicate
    rows for what is, in reality, one pattern slowly completing.
    """
    existing = db.scalars(
        select(PatternHistoryEntry).where(
            PatternHistoryEntry.symbol == pattern.symbol,
            PatternHistoryEntry.market_type == pattern.market_type,
            PatternHistoryEntry.timeframe == pattern.timeframe,
            PatternHistoryEntry.pattern == pattern.pattern,
            PatternHistoryEntry.range_start == pattern.range_start,
        )
    ).first()

    now = datetime.utcnow()
    if existing is not None:
        existing.completeness = pattern.completeness
        existing.range_end = pattern.range_end
        existing.last_seen_at = now
        if pattern.confirmed and existing.confirmed_at is None:
            existing.confirmed_at = now
        existing.confirmed = pattern.confirmed
        return

    db.add(
        PatternHistoryEntry(
            symbol=pattern.symbol,
            market_type=pattern.market_type,
            timeframe=pattern.timeframe,
            pattern=pattern.pattern,
            category=pattern.category,
            bias=pattern.bias,
            completeness=pattern.completeness,
            confirmed=pattern.confirmed,
            price_low=pattern.price_low,
            price_high=pattern.price_high,
            range_start=pattern.range_start,
            range_end=pattern.range_end,
            price_at_detection=current_price,
            first_detected_at=now,
            last_seen_at=now,
            confirmed_at=now if pattern.confirmed else None,
        )
    )


def evaluate_pending_outcomes(db: Session, get_current_price) -> int:
    """Scans confirmed patterns with no outcome yet, and for any that confirmed long enough ago
    (timeframe-scaled), checks whether price actually moved the pattern's textbook direction by
    at least OUTCOME_HIT_THRESHOLD. `get_current_price(symbol, market_type) -> float` is injected
    so this stays testable without a network dependency. Returns how many rows were evaluated.
    """
    pending = db.scalars(
        select(PatternHistoryEntry).where(
            PatternHistoryEntry.confirmed.is_(True),
            PatternHistoryEntry.outcome.is_(None),
            PatternHistoryEntry.confirmed_at.is_not(None),
        )
    ).all()

    evaluated = 0
    now = datetime.utcnow()
    for row in pending:
        minutes = TIMEFRAME_MINUTES.get(row.timeframe)
        if minutes is None or row.bias not in ("bullish", "bearish"):
            continue
        ready_at = row.confirmed_at + timedelta(minutes=minutes * OUTCOME_EVAL_CANDLES)
        if now < ready_at:
            continue

        try:
            current_price = get_current_price(row.symbol, row.market_type)
        except Exception:
            logger.exception("Failed to fetch price while evaluating pattern outcome for %s %s", row.symbol, row.pattern)
            continue

        move_pct = (current_price - row.price_at_detection) / row.price_at_detection
        hit = move_pct >= OUTCOME_HIT_THRESHOLD if row.bias == "bullish" else -move_pct >= OUTCOME_HIT_THRESHOLD

        row.outcome = "hit" if hit else "miss"
        row.outcome_checked_at = now
        row.outcome_price = current_price
        evaluated += 1

    return evaluated


def pattern_success_rate(db: Session, symbol: str, pattern: str | None = None, timeframe: str | None = None) -> list[dict]:
    """Per-pattern-type hit/miss/pending counts for a symbol, used to ground chat answers like
    'what's SOL's flag pattern success rate historically?' in this coin's own tracked outcomes
    rather than generic textbook theory.
    """
    query = select(PatternHistoryEntry).where(PatternHistoryEntry.symbol == symbol)
    if pattern is not None:
        query = query.where(PatternHistoryEntry.pattern == pattern)
    if timeframe is not None:
        query = query.where(PatternHistoryEntry.timeframe == timeframe)
    rows = db.scalars(query).all()

    by_pattern: dict[tuple[str, str], dict] = {}
    for row in rows:
        key = (row.pattern, row.timeframe)
        stats = by_pattern.setdefault(key, {"pattern": row.pattern, "timeframe": row.timeframe, "hits": 0, "misses": 0, "pending": 0})
        if row.outcome == "hit":
            stats["hits"] += 1
        elif row.outcome == "miss":
            stats["misses"] += 1
        else:
            stats["pending"] += 1

    return sorted(by_pattern.values(), key=lambda s: s["hits"] + s["misses"] + s["pending"], reverse=True)
