from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.goal import GoalOut
from app.services import goal_progress

router = APIRouter(prefix="/api/goal", tags=["goal"])


@router.get("", response_model=GoalOut)
def get_goal(db: Session = Depends(get_db)):
    return goal_progress.get_goal_progress(db)


@router.post("/acknowledge-milestone", response_model=GoalOut)
def acknowledge_milestone(milestone_usd: float, db: Session = Depends(get_db)):
    goal_progress.acknowledge_milestone(db, milestone_usd)
    return goal_progress.get_goal_progress(db)
