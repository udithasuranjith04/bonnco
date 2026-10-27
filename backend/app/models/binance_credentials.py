from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class BinanceCredentials(Base):
    """Singleton table (one row) holding the user's encrypted Binance read-only API credentials,
    when saved via the Settings UI rather than .env. The raw key/secret are only ever encrypted at
    rest here and decrypted in-memory server-side for a signed request — never sent to the frontend.
    `permissions_json` mirrors Binance's own apiRestrictions response (booleans only, no secrets),
    kept so the UI can show real permission state without a live re-check on every page load.
    """

    __tablename__ = "binance_credentials"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    encrypted_api_key: Mapped[str] = mapped_column(Text)
    encrypted_api_secret: Mapped[str] = mapped_column(Text)
    # Safe to display as-is, e.g. "AbCd••••••••WxYz" — never the real key.
    masked_key: Mapped[str] = mapped_column(String(40))

    connected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    permissions_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    permissions_safe: Mapped[bool] = mapped_column(Boolean, default=False)
