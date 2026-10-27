from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, Float, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

DECISION_STATES = (
    "NO_TRADE",
    "WATCH",
    "ARMED",
    "ENTER_NOW",
    "ENTER_ON_CONFIRMATION",
    "LONG_ACTIVE",
    "SHORT_ACTIVE",
    "HOLD_POSITION",
    "REDUCE_POSITION",
    "TAKE_PARTIAL_PROFIT",
    "EXIT",
    "INVALIDATED",
    "EMERGENCY_EXIT",
)


class DecisionStateRecord(Base):
    """Append-only history of computed decision states — same pattern as the Signal table (every
    computation logs a row, nothing is overwritten) so a transition always has a real prior row to
    compare against and explain, and so "why did the decision change" is always answerable later.
    """

    __tablename__ = "decision_states"
    __table_args__ = (
        Index("ix_decision_states_lookup", "symbol", "market_type", "timeframe", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    market_type: Mapped[str] = mapped_column(String(10))
    timeframe: Mapped[str] = mapped_column(String(5))

    state: Mapped[str] = mapped_column(Enum(*DECISION_STATES, name="decision_state_enum"))
    previous_state: Mapped[str | None] = mapped_column(String(30), nullable=True)

    directional_bias: Mapped[str] = mapped_column(String(15))
    signal_strength: Mapped[str] = mapped_column(String(10))
    overall_confidence: Mapped[float] = mapped_column(Float)
    trade_quality: Mapped[str] = mapped_column(String(20))
    risk_quality: Mapped[str] = mapped_column(String(20))
    portfolio_compatibility: Mapped[str] = mapped_column(String(20))

    reason_codes: Mapped[list] = mapped_column(JSON, default=list)
    reason_text: Mapped[str] = mapped_column(Text)

    # Full structured decomposition at the moment of this decision — the audit trail: "why was
    # confidence 68 instead of 82" is answerable by reading this back, not just the summary fields.
    decision_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
