"""Goal progress: always-on, zero-config milestone tracking against your real, live-synced
Binance balance — never a projection or a promise. There is no manually-set target or deadline;
instead the next few "nice number" rungs (1-2-5 per decade, e.g. $100 -> $200 -> $500 -> $1,000 ->
$2,000...) are generated automatically above the highest one you've already reached, and the
ladder just keeps extending upward forever as your real balance grows. Nothing here predicts or
guarantees that any milestone will be reached, or how fast — it only measures real balance against
an auto-generated series of small, achievable next steps.
"""

from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting
from app.services.binance_portfolio_summary import get_portfolio_summary

_LADDER_MAGNITUDES = (1, 2, 5)
MILESTONES_AHEAD = 6

# An informal planning horizon for the "daily pace" reference shown alongside the next milestone —
# NOT a deadline or a requirement. It exists to give a sense of scale ("roughly $X/day would get
# you there in a couple of weeks"), not to imply any day's result is guaranteed or owed.
PACE_WINDOW_DAYS = 14


def _next_milestones(anchor: float, count: int = MILESTONES_AHEAD) -> list[float]:
    """The next `count` 1-2-5 'nice number' rungs strictly above `anchor`. Anchored to the highest
    already-acknowledged milestone, not to the live current balance — if it were anchored to the
    live balance, a rung the balance had already passed (but not yet been shown/acknowledged for)
    would vanish from the list before the user ever saw it, making sequential one-by-one milestone
    detection impossible (see get_goal_progress's crossed-rung check, which only looks at rungs
    still present here)."""
    if anchor < 0:
        anchor = 0.0
    rungs: list[float] = []
    magnitude = 0
    while len(rungs) < count and magnitude < 20:  # safety bound, never realistically reached
        for m in _LADDER_MAGNITUDES:
            val = float(m * (10**magnitude))
            if val > anchor:
                rungs.append(val)
        magnitude += 1
    rungs.sort()
    return rungs[:count]


def _largest_rung_at_or_below(value: float) -> float:
    """The highest 1-2-5 rung at or below `value` — used only to silently seed the acknowledged
    high-water mark the very first time tracking ever runs for this account, so someone who starts
    using this at, say, $138 doesn't get bombarded with retroactive celebrations for $1, $2, $5 ...
    $100 the first time the app loads."""
    if value < 1:
        return 0.0
    best = 0.0
    magnitude = 0
    while True:
        found_any = False
        for m in _LADDER_MAGNITUDES:
            val = float(m * (10**magnitude))
            if val <= value:
                best = val
                found_any = True
        magnitude += 1
        if not found_any and magnitude > 1:
            break
        if magnitude > 20:
            break
    return best


def _get_setting(db: Session, key: str) -> str | None:
    row = db.get(AppSetting, key)
    return row.value if row else None


def _set_setting(db: Session, key: str, value: str | None) -> None:
    row = db.get(AppSetting, key)
    if value is None:
        if row:
            db.delete(row)
        return
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


def acknowledge_milestone(db: Session, milestone_usd: float) -> None:
    current_highest = float(_get_setting(db, "goal_highest_milestone_usd") or 0)
    if milestone_usd > current_highest:
        _set_setting(db, "goal_highest_milestone_usd", str(milestone_usd))
        db.commit()


def get_goal_progress(db: Session) -> dict:
    summary = get_portfolio_summary(db)
    current_value = summary.get("total_value_usd")

    highest_reached_raw = _get_setting(db, "goal_highest_milestone_usd")
    if highest_reached_raw is None:
        # First time this always-on tracker has ever run for this account — seed the high-water
        # mark to whatever's already been passed instead of celebrating pre-existing balance.
        seed = _largest_rung_at_or_below(current_value) if current_value is not None else 0.0
        _set_setting(db, "goal_highest_milestone_usd", str(seed))
        db.commit()
        highest_reached = seed
    else:
        highest_reached = float(highest_reached_raw)

    milestones = _next_milestones(highest_reached)
    next_milestone = milestones[0] if milestones else None

    # A milestone is "newly reached" only if the real current balance has crossed a rung beyond
    # the highest one already acknowledged — never re-fired for one already shown. When the real
    # balance jumps past several rungs between checks (e.g. the app wasn't opened for a few days),
    # surface the LOWEST not-yet-acknowledged one, not the highest — each rung gets shown and
    # acknowledged in sequence, one at a time, so a fast climb never silently skips a milestone the
    # user would otherwise never see.
    newly_reached = None
    if current_value is not None:
        crossed = [m for m in milestones if m <= current_value and m > highest_reached]
        if crossed:
            newly_reached = min(crossed)

    progress_to_next_pct = None
    daily_pace = None
    if current_value is not None and next_milestone is not None:
        span = next_milestone - highest_reached
        if span > 0:
            progress_to_next_pct = round(max(0.0, min((current_value - highest_reached) / span * 100, 100)), 2)
        gap = next_milestone - current_value
        daily_pace = round(gap / PACE_WINDOW_DAYS, 2) if gap > 0 else 0.0

    return {
        "current_value_usd": current_value,
        "highest_milestone_reached_usd": highest_reached,
        "next_milestone_usd": next_milestone,
        "milestones": milestones,
        "newly_reached_milestone_usd": newly_reached,
        "progress_to_next_pct": progress_to_next_pct,
        "daily_pace_usd": daily_pace,
    }
