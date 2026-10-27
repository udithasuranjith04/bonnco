from typing import Literal

from pydantic import BaseModel

RiskProfile = Literal["conservative", "moderate", "aggressive"]


class SettingsOut(BaseModel):
    risk_profile: RiskProfile
    dashboard_timeframe: str
    account_size_usd: float
    default_risk_pct: float
    notifications_enabled: bool
    entry_alert_confidence_threshold: float
    position_alerts_enabled: bool
    sound_enabled: bool


class SettingsUpdate(BaseModel):
    risk_profile: RiskProfile | None = None
    dashboard_timeframe: str | None = None
    account_size_usd: float | None = None
    default_risk_pct: float | None = None
    notifications_enabled: bool | None = None
    entry_alert_confidence_threshold: float | None = None
    position_alerts_enabled: bool | None = None
    sound_enabled: bool | None = None
