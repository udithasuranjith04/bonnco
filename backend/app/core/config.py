from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://bonnco:bonnco_pw@localhost:3306/bonnco"

    binance_spot_base_url: str = "https://api.binance.com"
    binance_futures_base_url: str = "https://fapi.binance.com"
    exchange_provider: str = "binance"

    # Optional power-user path: set these directly in .env instead of pasting into Settings.
    # Never sent to or readable from the frontend either way — every authenticated Binance call
    # happens server-side. Read-only key only (see app/services/binance_account.py guardrail).
    binance_api_key: str = ""
    binance_api_secret: str = ""
    # Encrypts the api key/secret at rest when saved via the Settings UI instead of .env. Generate
    # with: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # Binance features stay unavailable (not a crash) if this is unset and no .env credentials exist.
    credentials_encryption_key: str = ""

    # Free tier, get one at https://etherscan.io/apis — whale tracking for Ethereum stays inactive
    # (scheduler job simply skips itself) until this is set, rather than faking data without it.
    etherscan_api_key: str = ""

    ai_provider: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    google_api_key: str = ""
    gemini_model: str = "gemini-flash-latest"

    news_poll_seconds: int = 300
    news_lookback_hours: int = 6
    news_max_per_cycle: int = 20

    app_env: str = "development"
    risk_profile: str = "moderate"

    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
