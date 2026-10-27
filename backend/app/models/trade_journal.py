from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TradeJournalEntry(Base):
    __tablename__ = "trade_journal"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    market_type: Mapped[str] = mapped_column(Enum("spot", "futures", name="journal_market_type_enum"))
    side: Mapped[str] = mapped_column(Enum("long", "short", name="journal_side_enum"), default="long")

    entry_price: Mapped[float] = mapped_column(Float)
    exit_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    leverage: Mapped[float] = mapped_column(Float, default=1.0)
    result_pnl: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Committed at entry time, with a clear head — the Active Position Coach reminds the user of
    # this exact value later rather than letting in-the-moment fear renegotiate it. Independent of
    # any signal's own (possibly since-regenerated) stop-loss.
    stop_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Capital actually committed to this trade, so live P&L can be shown in $ as well as %.
    position_size_usd: Mapped[float | None] = mapped_column(Float, nullable=True)

    signal_id: Mapped[int | None] = mapped_column(nullable=True)  # optional link to signals.id
    notes: Mapped[str] = mapped_column(Text, default="")

    # "manual" (logged by hand) | "binance_import" (one-click imported from a real open position)
    # | "binance_trade_sync" (backfilled/synced from real Binance trade history) — always shown
    # in the UI so imported/synced entries are never presented as if hand-logged.
    source: Mapped[str] = mapped_column(String(20), default="manual")
    # Binance's own execution/order id for the trade this entry was imported or synced from, used
    # to avoid importing or syncing the exact same real trade twice. Null for manual entries.
    binance_trade_id: Mapped[str | None] = mapped_column(String(40), nullable=True)

    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    @property
    def status(self) -> str:
        """First-class open/closed state, derived from exit_price so there's a single source of
        truth rather than a second column that could drift out of sync with it."""
        return "closed" if self.exit_price is not None else "open"
