"""Tests for configuration settings and validation."""

import pytest
from pydantic import ValidationError
from app.config import Settings


def test_default_settings():
    """Verify default configuration values."""
    settings = Settings()
    assert settings.gemma_model == "gemma-2-9b-it"
    assert settings.snowflake_database == "SNOWFLAKE_SAMPLE_DATA"
    assert settings.snowflake_schema == "TPCH_SF1"
    assert settings.frontend_origin == "http://localhost:5173"
    assert settings.query_timeout_seconds == 30
    assert settings.max_result_rows == 100
    assert "CUSTOMER" in settings.allowed_tables
    assert "ORDERS" in settings.allowed_tables
    assert "LINEITEM" in settings.allowed_tables


def test_cors_origins_single():
    """Single origin string maps to list of one."""
    settings = Settings(frontend_origin="http://localhost:5173")
    assert settings.cors_origins == ["http://localhost:5173"]


def test_cors_origins_multiple():
    """Comma-separated origins parse into trimmed list."""
    settings = Settings(frontend_origin="http://localhost:5173, http://127.0.0.1:5173")
    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_timeout_bounds_validation():
    """Query timeout below 1 or above 120 raises ValidationError."""
    with pytest.raises(ValidationError):
        Settings(query_timeout_seconds=0)

    with pytest.raises(ValidationError):
        Settings(query_timeout_seconds=121)

    valid = Settings(query_timeout_seconds=60)
    assert valid.query_timeout_seconds == 60


def test_max_rows_bounds_validation():
    """Max result rows below 1 or above 1000 raises ValidationError."""
    with pytest.raises(ValidationError):
        Settings(max_result_rows=0)

    with pytest.raises(ValidationError):
        Settings(max_result_rows=1001)

    valid = Settings(max_result_rows=500)
    assert valid.max_result_rows == 500
