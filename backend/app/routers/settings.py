from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.app_setting import AppSetting
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services.exchange.base import TIMEFRAMES
from app.services.signal_engine import get_risk_profile, notify_risk_profile_changed

router = APIRouter(prefix="/api/settings", tags=["settings"])

DEFAULT_DASHBOARD_TIMEFRAME = "1h"
DEFAULT_ACCOUNT_SIZE_USD = 1000.0
DEFAULT_RISK_PCT = 1.0
DEFAULT_NOTIFICATIONS_ENABLED = True
DEFAULT_ENTRY_ALERT_CONFIDENCE_THRESHOLD = 60.0
DEFAULT_POSITION_ALERTS_ENABLED = True
DEFAULT_SOUND_ENABLED = True


def _get_dashboard_timeframe(db: Session) -> str:
    row = db.get(AppSetting, "dashboard_timeframe")
    if row and row.value in TIMEFRAMES:
        return row.value
    return DEFAULT_DASHBOARD_TIMEFRAME


def _get_float_setting(db: Session, key: str, default: float) -> float:
    row = db.get(AppSetting, key)
    if row is None:
        return default
    try:
        return float(row.value)
    except ValueError:
        return default


def _get_bool_setting(db: Session, key: str, default: bool) -> bool:
    row = db.get(AppSetting, key)
    if row is None:
        return default
    return row.value == "true"


def _set_app_setting(db: Session, key: str, value: str) -> None:
    row = db.get(AppSetting, key)
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


def _current_settings(db: Session) -> SettingsOut:
    return SettingsOut(
        risk_profile=get_risk_profile(db),
        dashboard_timeframe=_get_dashboard_timeframe(db),
        account_size_usd=_get_float_setting(db, "account_size_usd", DEFAULT_ACCOUNT_SIZE_USD),
        default_risk_pct=_get_float_setting(db, "default_risk_pct", DEFAULT_RISK_PCT),
        notifications_enabled=_get_bool_setting(db, "notifications_enabled", DEFAULT_NOTIFICATIONS_ENABLED),
        entry_alert_confidence_threshold=_get_float_setting(
            db, "entry_alert_confidence_threshold", DEFAULT_ENTRY_ALERT_CONFIDENCE_THRESHOLD
        ),
        position_alerts_enabled=_get_bool_setting(db, "position_alerts_enabled", DEFAULT_POSITION_ALERTS_ENABLED),
        sound_enabled=_get_bool_setting(db, "sound_enabled", DEFAULT_SOUND_ENABLED),
    )


@router.get("", response_model=SettingsOut)
def get_settings_values(db: Session = Depends(get_db)):
    return _current_settings(db)


@router.put("", response_model=SettingsOut)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    if payload.risk_profile is not None:
        if payload.risk_profile != get_risk_profile(db):
            notify_risk_profile_changed()
        _set_app_setting(db, "risk_profile", payload.risk_profile)
    if payload.dashboard_timeframe is not None:
        if payload.dashboard_timeframe not in TIMEFRAMES:
            raise HTTPException(status_code=400, detail=f"dashboard_timeframe must be one of {TIMEFRAMES}")
        _set_app_setting(db, "dashboard_timeframe", payload.dashboard_timeframe)
    if payload.account_size_usd is not None:
        if payload.account_size_usd <= 0:
            raise HTTPException(status_code=400, detail="account_size_usd must be positive")
        _set_app_setting(db, "account_size_usd", str(payload.account_size_usd))
    if payload.default_risk_pct is not None:
        if not (0 < payload.default_risk_pct <= 100):
            raise HTTPException(status_code=400, detail="default_risk_pct must be between 0 and 100")
        _set_app_setting(db, "default_risk_pct", str(payload.default_risk_pct))
    if payload.notifications_enabled is not None:
        _set_app_setting(db, "notifications_enabled", "true" if payload.notifications_enabled else "false")
    if payload.entry_alert_confidence_threshold is not None:
        if not (0 < payload.entry_alert_confidence_threshold <= 100):
            raise HTTPException(status_code=400, detail="entry_alert_confidence_threshold must be between 0 and 100")
        _set_app_setting(db, "entry_alert_confidence_threshold", str(payload.entry_alert_confidence_threshold))
    if payload.position_alerts_enabled is not None:
        _set_app_setting(db, "position_alerts_enabled", "true" if payload.position_alerts_enabled else "false")
    if payload.sound_enabled is not None:
        _set_app_setting(db, "sound_enabled", "true" if payload.sound_enabled else "false")

    db.commit()
    return _current_settings(db)
