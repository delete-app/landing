from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "Delete API"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://delete:delete@localhost:5432/delete"

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:5174"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7


settings = Settings()
