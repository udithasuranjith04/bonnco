from datetime import datetime

from sqlalchemy import DateTime, Float, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class WhaleActivity(Base):
    """A real, on-chain large-transfer event — sampled from Solana's public RPC, fetched from
    Etherscan's free API, or scanned from mempool.space's free Bitcoin API. `tx_hash` is nullable
    because Solana's parsed transaction data doesn't always surface a top-level signature cleanly
    for every instruction path; when present it's a real, independently-verifiable transaction hash
    on the relevant chain's explorer.
    """

    __tablename__ = "whale_activity"
    __table_args__ = (Index("ix_whale_activity_chain_time", "chain", "event_time"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chain: Mapped[str] = mapped_column(String(20), index=True)  # "ethereum" | "solana" | "bitcoin"
    asset: Mapped[str] = mapped_column(String(20))
    from_address: Mapped[str] = mapped_column(String(64))
    to_address: Mapped[str] = mapped_column(String(64))
    amount: Mapped[float] = mapped_column(Float)
    amount_usd: Mapped[float] = mapped_column(Float)
    tx_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)
    event_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
