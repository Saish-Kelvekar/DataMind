"""Application configuration and environment settings for DataMind backend."""

from functools import lru_cache
from typing import List
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration loaded from environment variables with safe defaults."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # Hosted Google Gemma Configuration
    gemma_api_key: str = Field(default="", alias="GEMMA_API_KEY")
    gemma_model: str = Field(default="gemma-2-9b-it", alias="GEMMA_MODEL")

    # Snowflake Credentials & Context
    snowflake_account: str = Field(default="", alias="SNOWFLAKE_ACCOUNT")
    snowflake_user: str = Field(default="", alias="SNOWFLAKE_USER")
    snowflake_password: str = Field(default="", alias="SNOWFLAKE_PASSWORD")
    snowflake_warehouse: str = Field(default="", alias="SNOWFLAKE_WAREHOUSE")
    snowflake_database: str = Field(default="SNOWFLAKE_SAMPLE_DATA", alias="SNOWFLAKE_DATABASE")
    snowflake_schema: str = Field(default="TPCH_SF1", alias="SNOWFLAKE_SCHEMA")

    # App & Security Settings
    frontend_origin: str = Field(default="http://localhost:5173", alias="FRONTEND_ORIGIN")
    query_timeout_seconds: int = Field(default=30, alias="QUERY_TIMEOUT_SECONDS", ge=1, le=120)
    max_result_rows: int = Field(default=100, alias="MAX_RESULT_ROWS", ge=1, le=1000)

    # Allowed Snowflake tables scope (strictly restricted to approved TPC-H tables)
    allowed_tables: List[str] = [
        "CUSTOMER",
        "ORDERS",
        "LINEITEM",
    ]

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
