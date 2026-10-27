"""Connects/reads/disconnects the user's stored (or .env-provided) Binance read-only credentials.
Every permission check here is a live call to Binance's own apiRestrictions endpoint — never
trusted from a stale cache — so a key whose permissions changed on Binance's side after connecting
(e.g. the user later enables trading on it) is caught the next time status is checked, not silently
carried forward as still-safe.
"""

import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.binance_credentials import BinanceCredentials
from app.services import binance_account, credentials_crypto

logger = logging.getLogger("bonnco.binance_credentials")


def _get_row(db: Session) -> BinanceCredentials | None:
    return db.scalars(select(BinanceCredentials)).first()


def resolve_active_credentials(db: Session) -> tuple[str, str, str] | None:
    """(api_key, api_secret, source) where source is 'env' or 'database', or None if not
    connected. .env takes precedence, matching this project's existing config precedence.
    """
    settings = get_settings()
    if settings.binance_api_key and settings.binance_api_secret:
        return settings.binance_api_key, settings.binance_api_secret, "env"

    row = _get_row(db)
    if row is None:
        return None
    try:
        api_key = credentials_crypto.decrypt(row.encrypted_api_key)
        api_secret = credentials_crypto.decrypt(row.encrypted_api_secret)
    except credentials_crypto.EncryptionNotConfigured:
        return None
    return api_key, api_secret, "database"


def connect(db: Session, api_key: str, api_secret: str) -> BinanceCredentials:
    """Validates the key against Binance's live permission-check endpoint BEFORE persisting
    anything, so an invalid or mistyped key never gets saved as if it were connected.
    """
    perms = binance_account.check_key_permissions(api_key, api_secret)
    safe, _ = binance_account.evaluate_key_safety(perms)

    existing = _get_row(db)
    if existing:
        db.delete(existing)
        db.flush()

    row = BinanceCredentials(
        encrypted_api_key=credentials_crypto.encrypt(api_key),
        encrypted_api_secret=credentials_crypto.encrypt(api_secret),
        masked_key=credentials_crypto.mask_key(api_key),
        connected_at=datetime.utcnow(),
        last_checked_at=datetime.utcnow(),
        permissions_json=perms.raw,
        permissions_safe=safe,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def disconnect(db: Session) -> bool:
    row = _get_row(db)
    if row is None:
        return False
    db.delete(row)
    db.commit()
    return True


def current_status(db: Session) -> dict:
    """Always does a live permission re-check when a key is connected (never trusts a stale
    'safe' flag), so this is the single source of truth every account-data endpoint should defer
    to before doing anything with the connection.
    """
    resolved = resolve_active_credentials(db)
    if resolved is None:
        return {"connected": False, "source": None, "masked_key": None, "safe": False, "warnings": [], "permissions": None}

    api_key, api_secret, source = resolved
    try:
        perms = binance_account.check_key_permissions(api_key, api_secret)
    except binance_account.BinanceAuthError:
        return {
            "connected": False,
            "source": source,
            "masked_key": credentials_crypto.mask_key(api_key),
            "safe": False,
            "warnings": ["Binance rejected this key — it may have been deleted or regenerated. Reconnect with a current key."],
            "permissions": None,
        }
    except Exception:
        logger.exception("Binance permission check failed")
        return {
            "connected": True,
            "source": source,
            "masked_key": credentials_crypto.mask_key(api_key),
            "safe": False,
            "warnings": ["Couldn't reach Binance to verify this key's permissions right now — try again shortly."],
            "permissions": None,
        }

    safe, warnings = binance_account.evaluate_key_safety(perms)

    if source == "database":
        row = _get_row(db)
        if row is not None:
            row.permissions_json = perms.raw
            row.permissions_safe = safe
            row.last_checked_at = datetime.utcnow()
            db.commit()

    return {
        "connected": True,
        "source": source,
        "masked_key": credentials_crypto.mask_key(api_key),
        "safe": safe,
        "warnings": warnings,
        "permissions": perms.raw,
    }
