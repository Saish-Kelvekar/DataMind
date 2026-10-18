"""Application configuration and environment settings for DataMind backend."""

import os
from functools import lru_cache
from typing import List
from pathlib import Path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Configuration loaded from environment variables with safe defaults."""

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_DIR / ".env"), str(ROOT_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Hosted Google Gemma Configuration
    gemma_api_key: str = ""
    gemma_model: str = "gemma-4-26b-a4b-it"

    # Snowflake Credentials & Context
    snowflake_account: str = ""
    snowflake_user: str = ""
    snowflake_password: str = ""
    snowflake_warehouse: str = "COMPUTE_WH"
    snowflake_database: str = "SNOWFLAKE_SAMPLE_DATA"
    snowflake_schema: str = "TPCH_SF1"

    # App & Security Settings
    frontend_origin: str = "http://localhost:5173"
    query_timeout_seconds: int = Field(default=30, ge=1, le=120)
    max_result_rows: int = Field(default=100, ge=1, le=1000)

    # Allowed Snowflake tables scope (strictly restricted to approved TPC-H tables)
    allowed_tables: List[str] = [
        "CUSTOMER",
        "ORDERS",
        "LINEITEM",
    ]

    @property
    def effective_gemma_api_key(self) -> str:
        """Return GEMMA_API_KEY if provided, falling back to GOOGLE_API_KEY if present."""
        if self.gemma_api_key:
            return self.gemma_api_key
        return os.getenv("GOOGLE_API_KEY", "")

    @property
    def cors_origins(self) -> List[str]:
        """Parse comma-separated origins if provided, or return single origin."""
        if not self.frontend_origin:
            return ["http://localhost:5173"]
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]

    @field_validator("query_timeout_seconds")
    @classmethod
    def validate_timeout(cls, v: int) -> int:
        if v < 1 or v > 120:
            raise ValueError("QUERY_TIMEOUT_SECONDS must be between 1 and 120 seconds")
        return v

    @field_validator("max_result_rows")
    @classmethod
    def validate_max_rows(cls, v: int) -> int:
        if v < 1 or v > 1000:
            raise ValueError("MAX_RESULT_ROWS must be between 1 and 1000")
        return v


@lru_cache()
def get_settings() -> Settings:
    """Return cached instance of application settings."""
    return Settings()
