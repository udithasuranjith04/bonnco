from pydantic import BaseModel


class GoalOut(BaseModel):
    current_value_usd: float | None
    highest_milestone_reached_usd: float
    next_milestone_usd: float | None
    milestones: list[float]
    newly_reached_milestone_usd: float | None
    progress_to_next_pct: float | None
    daily_pace_usd: float | None
