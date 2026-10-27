from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.checkin import CheckinOut
from app.services.checkin import get_checkin

router = APIRouter(prefix="/api/checkin", tags=["checkin"])


@router.get("", response_model=CheckinOut)
def get_session_checkin(db: Session = Depends(get_db)):
    return get_checkin(db)
