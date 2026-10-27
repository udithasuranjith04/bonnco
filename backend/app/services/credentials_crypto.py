"""Encrypts secrets (currently: Binance API key/secret) at rest in MySQL when saved via a Settings
UI form, using a symmetric key that itself lives only in .env, never in the database. Decrypted
values only ever exist in-memory, server-side, for the duration of a signed outbound request.
"""

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


class EncryptionNotConfigured(Exception):
    pass


def _fernet() -> Fernet:
    settings = get_settings()
    if not settings.credentials_encryption_key:
        raise EncryptionNotConfigured(
            "CREDENTIALS_ENCRYPTION_KEY is not set in .env — generate one with "
            "`python3 -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"`"
        )
    return Fernet(settings.credentials_encryption_key.encode())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise EncryptionNotConfigured("Stored credential can't be decrypted with the current encryption key") from exc


def mask_key(key: str) -> str:
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:4]}{'•' * 8}{key[-4:]}"
