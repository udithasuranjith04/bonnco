from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Regime = Literal[
    "STRONG_UPTREND", "WEAK_UPTREND", "STRONG_DOWNTREND", "WEAK_DOWNTREND",
    "RANGE", "BREAKOUT", "BREAKDOWN", "TRANSITION", "HIGH_VOLATILITY",
    "LOW_VOLATILITY", "EVENT_DRIVEN", "CONFLICTED", "UNKNOWN",
]


class RegimeOut(BaseModel):
    symbol: str
    market_type: str
    timeframe: str
    regime: Regime
    confidence: float
    evidence: list[str]
    reason_codes: list[str]
    timestamp: datetime
    data_quality: Literal["healthy", "degraded", "critical"]


class TimeframeHierarchyOut(BaseModel):
    symbol: str
    market_type: str
    macro_timeframe: str | None
    macro_bias: str | None
    structure_timeframe: str | None
    structure_bias: str | None
    regime_timeframe: str | None
    regime_bias: str | None
    setup_timeframe: str | None
    setup_bias: str | None
    execution_timeframe: str | None
    execution_bias: str | None
    alignment: Literal["aligned", "partial", "conflicting", "not_applicable"]
    trigger_timeframe: str | None
    invalidation_timeframe: str | None


class ScoreComponent(BaseModel):
    status: Literal["available", "unavailable"]
    rating: Literal["strong", "moderate", "weak", "conflicting"] | None
    weight: int
    detail: str


class OpportunityScoreOut(BaseModel):
    overall: float
    directional_quality: ScoreComponent
    trade_quality: ScoreComponent
    risk_quality: ScoreComponent
    timeframe_alignment: ScoreComponent
    regime_fit: ScoreComponent
    portfolio_compatibility: ScoreComponent
    data_quality: ScoreComponent


class DirectionCandidate(BaseModel):
    direction: Literal["long", "short"]
    decision_state: str
    directional_bias: str
    signal_strength: str
    trade_quality: str
    risk_quality: str
    portfolio_compatibility: str
    reason_codes: list[str]
    reason_text: str
    score: OpportunityScoreOut


CandidateClassification = Literal[
    "BEST_LONG", "LONG_CANDIDATE", "WATCH", "NO_TRADE", "SHORT_CANDIDATE", "BEST_SHORT", "EXCLUDED",
]


class ScannerCandidateOut(BaseModel):
    symbol: str
    market_type: str
    timeframe: str
    exchange: str
    classification: CandidateClassification
    regime: RegimeOut | None
    timeframe_hierarchy: TimeframeHierarchyOut | None
    long: DirectionCandidate | None
    short: DirectionCandidate | None
    historical_match_available: bool
    historical_note: str
    excluded_reason: str | None


class ScanResultOut(BaseModel):
    generated_at: datetime
    exchange: str
    market_type: str
    timeframe: str
    symbols_discovered: int
    symbols_eligible: int
    symbols_excluded: int
    candidates: list[ScannerCandidateOut]
    best_long: ScannerCandidateOut | None
    best_short: ScannerCandidateOut | None
    market_regime_btc: Regime | None
    execution_time_ms: float
