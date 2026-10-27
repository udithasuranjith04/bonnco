from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.decision_state import DECISION_STATES

DecisionState = Literal[
    "NO_TRADE", "WATCH", "ARMED", "ENTER_NOW", "ENTER_ON_CONFIRMATION",
    "LONG_ACTIVE", "SHORT_ACTIVE", "HOLD_POSITION", "REDUCE_POSITION",
    "TAKE_PARTIAL_PROFIT", "EXIT", "INVALIDATED", "EMERGENCY_EXIT",
]
assert set(DecisionState.__args__) == set(DECISION_STATES)  # schema and model enum must never drift apart

DirectionalBias = Literal["bullish", "bearish", "neutral", "conflicting"]
SignalStrength = Literal["high", "moderate", "low", "not_applicable"]
QualityRating = Literal["good", "moderate", "poor", "not_applicable"]
RiskRating = Literal["acceptable", "marginal", "unacceptable", "not_applicable"]
CompatibilityRating = Literal["compatible", "marginal", "incompatible", "not_applicable"]
ComponentRating = Literal["strong", "moderate", "weak", "conflicting"]
AlignmentRating = Literal["aligned", "partial", "conflicting", "not_applicable"]


class ConfidenceComponent(BaseModel):
    """One contributing factor to overall confidence. `rating` is None whenever `status` is
    "unavailable" — never a fabricated neutral value standing in for data that was never actually
    retrieved (see Phase 2's DataFreshness for the same principle applied to raw data sources)."""

    status: Literal["available", "unavailable"]
    rating: ComponentRating | None
    detail: str


class ConfidenceBreakdown(BaseModel):
    # The real number the signal engine already computes (50 + |combined_score| * 45, capped at
    # 95) — reused as-is, never recomputed. The components below are a genuine, real-data-driven
    # explanation of the qualitative factors behind it, not a claimed exact arithmetic derivation
    # of that number — being honest about that distinction matters more than fake precision.
    overall: float
    technical_alignment: ConfidenceComponent
    timeframe_alignment: ConfidenceComponent
    order_flow_confirmation: ConfidenceComponent
    news_alignment: ConfidenceComponent
    historical_support: ConfidenceComponent
    data_quality: ConfidenceComponent
    market_regime: ConfidenceComponent  # always "unavailable" in Phase 3 — the real classifier is Phase 4


class TimeframeAlignmentOut(BaseModel):
    requested_timeframe: str
    requested_bias: DirectionalBias
    higher_timeframe: str | None
    higher_bias: DirectionalBias | None
    lower_timeframe: str | None
    lower_bias: DirectionalBias | None
    alignment: AlignmentRating


class DataQualitySummary(BaseModel):
    overall: Literal["healthy", "degraded", "critical"]
    stale_sources: list[str]
    missing_sources: list[str]
    degraded_mode: bool


class DecisionOut(BaseModel):
    symbol: str
    market_type: str
    timeframe: str
    generated_at: datetime

    directional_bias: DirectionalBias
    signal_strength: SignalStrength
    confidence: ConfidenceBreakdown
    trade_quality: QualityRating
    risk_quality: RiskRating
    portfolio_compatibility: CompatibilityRating

    state: DecisionState
    previous_state: DecisionState | None
    state_changed: bool

    has_open_position: bool
    position_side: Literal["long", "short"] | None

    reason_codes: list[str]
    reason_text: str

    market_regime: Literal["UNKNOWN"]
    timeframe_alignment: TimeframeAlignmentOut
    data_quality: DataQualitySummary

    decision_snapshot_id: int | None
