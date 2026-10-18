"""Unit tests for SnowflakeService without requiring real Snowflake credentials.

Uses isolated mocks to verify connection lifecycle, error mapping, schema discovery
formatting, and JSON serialization of Snowflake datatypes.
"""

from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import UUID
import pytest

from app.config import Settings
from app.snowflake_service import (
    ColumnMetadata,
    DiscoveredSchema,
    QueryResult,
    SnowflakeAuthError,
    SnowflakePermissionError,
    SnowflakeQueryError,
    SnowflakeService,
    SnowflakeServiceError,
    SnowflakeTimeoutError,
    SnowflakeWarehouseError,
    TableSchema,
    normalize_snowflake_value,
)


# ---------------------------------------------------------------------------
# Data Normalization Tests
# ---------------------------------------------------------------------------

def test_normalize_snowflake_value_none():
    assert normalize_snowflake_value(None) is None


def test_normalize_snowflake_value_decimal_integer():
    val = Decimal("150000")
    res = normalize_snowflake_value(val)
    assert res == 150000
    assert isinstance(res, int)


def test_normalize_snowflake_value_decimal_float():
    val = Decimal("123.45")
    res = normalize_snowflake_value(val)
    assert res == 123.45
    assert isinstance(res, float)


def test_normalize_snowflake_value_datetime():
    dt = datetime(2026, 10, 18, 12, 30, 0)
    assert normalize_snowflake_value(dt) == "2026-10-18T12:30:00"


def test_normalize_snowflake_value_date():
    d = date(2026, 10, 18)
    assert normalize_snowflake_value(d) == "2026-10-18"


def test_normalize_snowflake_value_bytes():
    b = b"hello"
    assert normalize_snowflake_value(b) == "68656c6c6f"


def test_normalize_snowflake_value_uuid():
    u = UUID("12345678-1234-5678-1234-567812345678")
    assert normalize_snowflake_value(u) == "12345678-1234-5678-1234-567812345678"


def test_normalize_snowflake_value_primitives():
    assert normalize_snowflake_value("sample") == "sample"
    assert normalize_snowflake_value(42) == 42
    assert normalize_snowflake_value(True) is True


# ---------------------------------------------------------------------------
# Credentials Validation & Configuration Tests
# ---------------------------------------------------------------------------

def test_missing_credentials_raises_auth_error():
    """Service without account, user, or password raises SnowflakeAuthError."""
    settings = Settings(
        snowflake_account="",
        snowflake_user="",
        snowflake_password="",
    )
    service = SnowflakeService(settings)
    with pytest.raises(SnowflakeAuthError, match="Missing required Snowflake configuration"):
        with service.get_connection():
            pass


# ---------------------------------------------------------------------------
# Schema Model & Prompt Formatting Tests
# ---------------------------------------------------------------------------

def test_table_schema_column_names():
    schema = TableSchema(
        table_name="CUSTOMER",
        columns=[
            ColumnMetadata(name="C_CUSTKEY", data_type="NUMBER"),
            ColumnMetadata(name="C_NAME", data_type="VARCHAR"),
        ],
    )
    assert schema.column_names == ["C_CUSTKEY", "C_NAME"]


def test_discovered_schema_to_prompt_context():
    discovered = DiscoveredSchema(
        database="SNOWFLAKE_SAMPLE_DATA",
        schema_name="TPCH_SF1",
        tables={
            "CUSTOMER": TableSchema(
                table_name="CUSTOMER",
                columns=[
                    ColumnMetadata(name="C_CUSTKEY", data_type="NUMBER"),
                    ColumnMetadata(name="C_NAME", data_type="VARCHAR"),
                ],
            )
        },
    )
    ctx = discovered.to_prompt_context()
    assert "TABLE SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.CUSTOMER" in ctx
    assert "C_CUSTKEY NUMBER" in ctx
    assert "C_NAME VARCHAR" in ctx


# ---------------------------------------------------------------------------
# Connection & Execution Unit Tests (Mocked)
# ---------------------------------------------------------------------------

@pytest.fixture
def configured_service():
    settings = Settings(
        snowflake_account="test-account",
        snowflake_user="test-user",
        snowflake_password="test-password",
        snowflake_warehouse="COMPUTE_WH",
        snowflake_database="SNOWFLAKE_SAMPLE_DATA",
        snowflake_schema="TPCH_SF1",
    )
    return SnowflakeService(settings)


@patch("snowflake.connector.connect")
def test_test_connection_success(mock_connect, configured_service):
    """test_connection returns expected metadata from diagnostic query."""
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_cur.fetchone.return_value = ("TEST_USER", "SYSADMIN", "SNOWFLAKE_SAMPLE_DATA", "TPCH_SF1", "COMPUTE_WH", "8.0.0")
    mock_cur.sfqid = "sfqid-diag-1234"
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_conn.is_closed.return_value = False
    mock_connect.return_value = mock_conn

    diag = configured_service.test_connection()
    assert diag["status"] == "connected"
    assert diag["user"] == "TEST_USER"
    assert diag["database"] == "SNOWFLAKE_SAMPLE_DATA"
    assert diag["query_id"] == "sfqid-diag-1234"
    assert diag["elapsed_ms"] >= 0


@patch("snowflake.connector.connect")
def test_discover_schema_success(mock_connect, configured_service):
    """discover_schema populates tables and column metadata properly."""
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_cur.fetchall.return_value = [
        ("CUSTOMER", "C_CUSTKEY", "NUMBER", "NO"),
        ("CUSTOMER", "C_NAME", "VARCHAR", "YES"),
        ("ORDERS", "O_ORDERKEY", "NUMBER", "NO"),
    ]
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_conn.is_closed.return_value = False
    mock_connect.return_value = mock_conn

    discovered = configured_service.discover_schema(["CUSTOMER", "ORDERS"])
    assert "CUSTOMER" in discovered.tables
    assert "ORDERS" in discovered.tables
    assert len(discovered.tables["CUSTOMER"].columns) == 2
    assert discovered.tables["CUSTOMER"].columns[0].name == "C_CUSTKEY"
    assert discovered.tables["CUSTOMER"].columns[0].is_nullable is False


@patch("snowflake.connector.connect")
def test_execute_query_success(mock_connect, configured_service):
    """execute_query executes query, normalizes decimal types, and returns QueryResult."""
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_cur.description = [("TOTAL_ORDERS", 0), ("AVG_PRICE", 0)]
    mock_cur.fetchmany.return_value = [
        (Decimal("1500"), Decimal("123.45")),
    ]
    mock_cur.sfqid = "query-abc-567"
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_conn.is_closed.return_value = False
    mock_connect.return_value = mock_conn

    res = configured_service.execute_query("SELECT COUNT(*), AVG(TOTALPRICE) FROM ORDERS", max_rows=10)
    assert isinstance(res, QueryResult)
    assert res.columns == ["TOTAL_ORDERS", "AVG_PRICE"]
    assert res.rows == [[1500, 123.45]]
    assert res.row_count == 1
    assert res.query_id == "query-abc-567"
