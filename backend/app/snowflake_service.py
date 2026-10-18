"""Snowflake database connectivity, schema discovery, and query execution service.

Uses the official snowflake-connector-python with strict read-only context,
bounded fetching, explicit timeouts, and JSON serialization of Snowflake datatypes.
"""

from contextlib import contextmanager
from datetime import date, datetime, time
from decimal import Decimal
import logging
import time as time_module
from typing import Any, Dict, Generator, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field
import snowflake.connector
from snowflake.connector.errors import (
    DatabaseError,
    InterfaceError,
    OperationalError,
    ProgrammingError,
)

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom Exceptions
# ---------------------------------------------------------------------------

class SnowflakeServiceError(Exception):
    """Base exception for Snowflake service errors."""


class SnowflakeAuthError(SnowflakeServiceError):
    """Raised when authentication credentials fail."""


class SnowflakeWarehouseError(SnowflakeServiceError):
    """Raised when the specified warehouse is unavailable or not running."""


class SnowflakePermissionError(SnowflakeServiceError):
    """Raised when privileges are insufficient for the target database/schema/table."""


class SnowflakeTimeoutError(SnowflakeServiceError):
    """Raised when query execution exceeds the configured timeout."""


class SnowflakeQueryError(SnowflakeServiceError):
    """Raised when SQL execution fails in Snowflake."""


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class ColumnMetadata(BaseModel):
    """Metadata for a verified Snowflake table column."""

    name: str
    data_type: str
    is_nullable: bool = True


class TableSchema(BaseModel):
    """Verified schema information for a single table."""

    table_name: str
    columns: List[ColumnMetadata] = Field(default_factory=list)

    @property
    def column_names(self) -> List[str]:
        return [col.name.upper() for col in self.columns]


class DiscoveredSchema(BaseModel):
    """Complete verified schema discovery result for approved tables."""

    database: str
    schema_name: str
    tables: Dict[str, TableSchema] = Field(default_factory=dict)

    def to_prompt_context(self) -> str:
        """Format the discovered schema into concise context for Gemma prompting."""
        lines = []
        for table_name, schema in sorted(self.tables.items()):
            col_defs = [f"{c.name} {c.data_type}" for c in schema.columns]
            lines.append(f"TABLE {self.database}.{self.schema_name}.{table_name} (\n  " + ",\n  ".join(col_defs) + "\n)")
        return "\n\n".join(lines)


class QueryResult(BaseModel):
    """Normalized query execution result matching the shared DataMind contract."""

    columns: List[str]
    rows: List[List[Any]]
    row_count: int
    elapsed_ms: int
    query_id: Optional[str] = None


# ---------------------------------------------------------------------------
# JSON Serialization Helper
# ---------------------------------------------------------------------------

def normalize_snowflake_value(val: Any) -> Any:
    """Convert Snowflake connector types (Decimal, dates, bytes) into JSON-safe primitives."""
    if val is None:
        return None
    if isinstance(val, Decimal):
        # Convert to int if integer value, otherwise float
        return int(val) if val % 1 == 0 else float(val)
    if isinstance(val, (datetime, date, time)):
        return val.isoformat()
    if isinstance(val, (bytes, bytearray)):
        return val.hex()
    if isinstance(val, UUID):
        return str(val)
    return val


# ---------------------------------------------------------------------------
# Snowflake Service Implementation
# ---------------------------------------------------------------------------

class SnowflakeService:
    """Manages secure connectivity, schema discovery, and query execution for Snowflake."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()

    def _ensure_credentials(self) -> None:
        """Validate required Snowflake configuration before attempting connection."""
        missing = []
        if not self.settings.snowflake_account:
            missing.append("SNOWFLAKE_ACCOUNT")
        if not self.settings.snowflake_user:
            missing.append("SNOWFLAKE_USER")
        if not self.settings.snowflake_password:
            missing.append("SNOWFLAKE_PASSWORD")
        if missing:
            raise SnowflakeAuthError(
                f"Missing required Snowflake configuration: {', '.join(missing)}. "
                "Please configure backend/.env."
            )

    @contextmanager
    def get_connection(self) -> Generator[snowflake.connector.SnowflakeConnection, None, None]:
        """Create and yield a Snowflake connection, ensuring reliable cleanup."""
        self._ensure_credentials()

        conn_params = {
            "account": self.settings.snowflake_account,
            "user": self.settings.snowflake_user,
            "password": self.settings.snowflake_password,
            "warehouse": self.settings.snowflake_warehouse,
            "database": self.settings.snowflake_database,
            "schema": self.settings.snowflake_schema,
            "login_timeout": 15,
            "network_timeout": self.settings.query_timeout_seconds,
            "client_session_keep_alive": False,
            "server_session_keep_alive": False,
            "enable_server_session_keep_alive_auto_detection": False,
            "autocommit": True,
        }

        conn = None
        try:
            conn = snowflake.connector.connect(**conn_params)
            yield conn
        except (ProgrammingError, OperationalError, DatabaseError, InterfaceError) as exc:
            msg = str(exc)
            # Categorize common Snowflake error messages safely without logging credentials
            if "Incorrect username or password" in msg or "Authentication failed" in msg or "250001" in msg:
                raise SnowflakeAuthError("Snowflake authentication failed: Invalid username, password, or account.") from exc
            if "Warehouse" in msg and ("does not exist" in msg or "suspended" in msg or "not found" in msg):
                raise SnowflakeWarehouseError(f"Snowflake warehouse error: {msg}") from exc
            if "not authorized" in msg or "insufficient privileges" in msg or "Access denied" in msg:
                raise SnowflakePermissionError(f"Snowflake permission denied: {msg}") from exc
            if "timeout" in msg.lower():
                raise SnowflakeTimeoutError(f"Snowflake connection timed out: {msg}") from exc
            raise SnowflakeServiceError(f"Snowflake connection error: {msg}") from exc
        finally:
            if conn is not None and not conn.is_closed():
                try:
                    conn.close()
                except Exception:
                    pass

    def test_connection(self) -> Dict[str, Any]:
        """Execute a minimal connection diagnostic query and return non-sensitive metadata."""
        start = time_module.perf_counter()
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_DATABASE(), "
                    "CURRENT_SCHEMA(), CURRENT_WAREHOUSE(), CURRENT_VERSION()"
                )
                row = cur.fetchone()
                query_id = cur.sfqid
                elapsed_ms = int((time_module.perf_counter() - start) * 1000)

                if not row:
                    raise SnowflakeServiceError("Diagnostic query returned no result row.")

                return {
                    "status": "connected",
                    "user": row[0],
                    "role": row[1],
                    "database": row[2],
                    "schema": row[3],
                    "warehouse": row[4],
                    "version": row[5],
                    "query_id": query_id,
                    "elapsed_ms": elapsed_ms,
                }

    def discover_schema(self, target_tables: Optional[List[str]] = None) -> DiscoveredSchema:
        """Inspect and return verified column metadata for approved tables only."""
        tables_to_check = [
            t.upper() for t in (target_tables or self.settings.allowed_tables)
        ]

        database = self.settings.snowflake_database.upper()
        schema_name = self.settings.snowflake_schema.upper()

        discovered = DiscoveredSchema(database=database, schema_name=schema_name)

        with self.get_connection() as conn:
            with conn.cursor() as cur:
                # Query INFORMATION_SCHEMA.COLUMNS with exact schema parameterization
                query = (
                    "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE "
                    f"FROM {database}.INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_SCHEMA = %s AND TABLE_NAME IN (%s) "
                    "ORDER BY TABLE_NAME, ORDINAL_POSITION"
                )
                # Build format string for IN clause
                placeholders = ", ".join(["%s"] * len(tables_to_check))
                formatted_query = (
                    f"SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE "
                    f"FROM {database}.INFORMATION_SCHEMA.COLUMNS "
                    f"WHERE TABLE_SCHEMA = %s AND TABLE_NAME IN ({placeholders}) "
                    f"ORDER BY TABLE_NAME, ORDINAL_POSITION"
                )

                params = [schema_name] + tables_to_check

                try:
                    cur.execute(formatted_query, params)
                    rows = cur.fetchall()
                except Exception:
                    # Fallback to DESCRIBE TABLE if INFORMATION_SCHEMA access is restricted
                    rows = []
                    for tbl in tables_to_check:
                        try:
                            cur.execute(f"DESCRIBE TABLE {database}.{schema_name}.{tbl}")
                            for desc_row in cur.fetchall():
                                # DESCRIBE columns: name, type, kind, null?, default, ...
                                rows.append((tbl, desc_row[0], desc_row[1], desc_row[3]))
                        except Exception as desc_exc:
                            logger.warning("Could not describe table %s: %s", tbl, desc_exc)

                for row in rows:
                    tbl_name = str(row[0]).upper()
                    col_name = str(row[1]).upper()
                    data_type = str(row[2]).upper()
                    is_nullable = str(row[3]).upper() == "YES"

                    if tbl_name not in discovered.tables:
                        discovered.tables[tbl_name] = TableSchema(table_name=tbl_name)

                    discovered.tables[tbl_name].columns.append(
                        ColumnMetadata(
                            name=col_name,
                            data_type=data_type,
                            is_nullable=is_nullable,
                        )
                    )

        return discovered

    def execute_query(
        self,
        sql: str,
        max_rows: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
    ) -> QueryResult:
        """Execute a validated query with explicit timeout and bounded result fetch."""
        limit = max_rows or self.settings.max_result_rows
        timeout = timeout_seconds or self.settings.query_timeout_seconds

        start = time_module.perf_counter()

        with self.get_connection() as conn:
            with conn.cursor() as cur:
                # Set per-statement timeout
                try:
                    cur.execute(f"ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = {timeout}")
                except Exception:
                    pass

                try:
                    cur.execute(sql)
                except Exception as exc:
                    msg = str(exc)
                    if "Statement reached its statement execution timeout" in msg or "timeout" in msg.lower():
                        raise SnowflakeTimeoutError(f"Query execution timed out after {timeout} seconds.") from exc
                    raise SnowflakeQueryError(f"Snowflake SQL error: {msg}") from exc

                query_id = cur.sfqid
                raw_columns = [col[0] for col in (cur.description or [])]

                # Bounded fetch: retrieve at most limit rows
                raw_rows = cur.fetchmany(limit)

                # Normalize each value to JSON-serializable types
                normalized_rows = [
                    [normalize_snowflake_value(cell) for cell in row]
                    for row in raw_rows
                ]

                elapsed_ms = int((time_module.perf_counter() - start) * 1000)

                return QueryResult(
                    columns=raw_columns,
                    rows=normalized_rows,
                    row_count=len(normalized_rows),
                    elapsed_ms=elapsed_ms,
                    query_id=query_id,
                )
