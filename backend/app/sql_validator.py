"""Strict SQL parser and security validator using sqlglot for DataMind.

Enforces:
1. Exactly one single statement.
2. Read-only SELECT operations only (strictly rejecting DDL/DML, multi-statement, INTO, etc.).
3. Strict table allowlist (CUSTOMER, ORDERS, LINEITEM only).
4. Strict column allowlist based on verified Snowflake TPC-H schema.
5. Row limit bounds (injects or clamps LIMIT to MAX_RESULT_ROWS).
"""

from typing import List, Optional, Set
from pydantic import BaseModel
import sqlglot
from sqlglot import exp
from sqlglot.errors import ParseError

from app.config import get_settings
from app.schema_service import SchemaService, schema_service


# ---------------------------------------------------------------------------
# Exceptions & Models
# ---------------------------------------------------------------------------

class SQLValidationError(Exception):
    """Raised when SQL fails security, syntax, or schema validation."""


class ValidatedSQL(BaseModel):
    """Represents a successfully validated and sanitized SQL query."""

    original_sql: str
    sanitized_sql: str
    tables_referenced: List[str]
    columns_referenced: List[str]
    has_limit: bool
    limit_value: Optional[int] = None


# ---------------------------------------------------------------------------
# SQL Validator Implementation
# ---------------------------------------------------------------------------

class SQLValidator:
    """Validates and enforces read-only query safety policies for Snowflake."""

    FORBIDDEN_AST_TYPES = (
        exp.Insert,
        exp.Update,
        exp.Delete,
        exp.Drop,
        exp.Create,
        exp.Alter,
        exp.Command,
        exp.Merge,
        exp.TruncateTable,
        exp.Into,
    )

    FORBIDDEN_KEYWORDS = {
        "DROP",
        "DELETE",
        "UPDATE",
        "INSERT",
        "ALTER",
        "CREATE",
        "TRUNCATE",
        "MERGE",
        "GRANT",
        "REVOKE",
        "CALL",
        "EXECUTE",
        "SYSTEM$",
    }

    def __init__(
        self,
        schema_svc: Optional[SchemaService] = None,
        max_result_rows: Optional[int] = None,
    ) -> None:
        self.settings = get_settings()
        self.schema_service = schema_svc or schema_service
        self.max_result_rows = max_result_rows or self.settings.max_result_rows
        self.expected_database = self.settings.snowflake_database.upper()
        self.expected_schema = self.settings.snowflake_schema.upper()

    def validate(self, sql: str) -> ValidatedSQL:
        """Parse and validate SQL, returning the exact sanitized query string."""
        if not sql or not sql.strip():
            raise SQLValidationError("SQL statement is empty.")

        cleaned_sql = sql.strip().rstrip(";")

        # Quick pre-check for dangerous raw multi-statement tokens or comments hiding injections
        raw_tokens = [tok.upper() for tok in cleaned_sql.split()]
        if any(kw in raw_tokens for kw in ["DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "MERGE", "ALTER"]):
            # Confirm with AST, but reject immediately if command begins with write keyword
            first_kw = raw_tokens[0] if raw_tokens else ""
            if first_kw in self.FORBIDDEN_KEYWORDS:
                raise SQLValidationError(
                    f"Disallowed operation: '{first_kw}'. Only read-only SELECT queries are permitted."
                )

        # Step 1: Parse using sqlglot with Snowflake dialect
        try:
            parsed_statements = sqlglot.parse(cleaned_sql, read="snowflake")
        except ParseError as exc:
            raise SQLValidationError(f"SQL syntax error: {exc}") from exc

        # Step 2: Exactly one statement allowed
        if not parsed_statements:
            raise SQLValidationError("No valid SQL statement found.")
        if len(parsed_statements) > 1:
            raise SQLValidationError(
                f"Multiple SQL statements detected ({len(parsed_statements)}). "
                "Only exactly one query statement is permitted."
            )

        stmt = parsed_statements[0]

        # Step 3: Statement type must be SELECT (or Union of Selects)
        if not isinstance(stmt, (exp.Select, exp.Union)):
            raise SQLValidationError(
                f"Disallowed statement type: '{type(stmt).__name__}'. "
                "Only read-only SELECT queries are permitted."
            )

        # Step 4: Check for any forbidden DDL/DML/Into nodes inside the AST
        for forbidden_type in self.FORBIDDEN_AST_TYPES:
            found = stmt.find(forbidden_type)
            if found:
                raise SQLValidationError(
                    f"Disallowed construct detected in query AST: {forbidden_type.__name__}"
                )

        # Check for system function calls or administrative calls
        for func in stmt.find_all(exp.Anonymous):
            func_name = func.name.upper()
            if func_name.startswith("SYSTEM$") or func_name in ("CALL", "EXECUTE"):
                raise SQLValidationError(
                    f"Disallowed function call detected: {func_name}"
                )

        # Step 5: Table allowlist verification
        allowed_tables = self.schema_service.get_allowed_tables()
        cte_aliases: Set[str] = {
            cte.alias_or_name.upper() for cte in stmt.find_all(exp.CTE)
        }

        referenced_tables: List[str] = []
        for tbl in stmt.find_all(exp.Table):
            table_name = tbl.name.upper()

            # Ignore CTE aliases (temporary query-scoped names)
            if table_name in cte_aliases:
                continue

            # Verify table name is in approved allowlist
            if table_name not in allowed_tables:
                raise SQLValidationError(
                    f"Unauthorized table '{table_name}'. "
                    f"Only the following tables are permitted: {', '.join(sorted(allowed_tables))}."
                )

            # Verify database & schema qualification if present
            if tbl.db and tbl.db.upper() != self.expected_schema:
                raise SQLValidationError(
                    f"Unauthorized schema '{tbl.db}'. Only '{self.expected_schema}' is permitted."
                )
            if tbl.catalog and tbl.catalog.upper() != self.expected_database:
                raise SQLValidationError(
                    f"Unauthorized database '{tbl.catalog}'. Only '{self.expected_database}' is permitted."
                )

            if table_name not in referenced_tables:
                referenced_tables.append(table_name)

        if not referenced_tables and not cte_aliases:
            # e.g., SELECT 1; - permit harmless constant selection or require table
            pass

        # Step 6: Column allowlist verification
        query_defined_aliases: Set[str] = {
            a.alias_or_name.upper() for a in stmt.find_all(exp.Alias)
        }

        referenced_columns: List[str] = []
        for col in stmt.find_all(exp.Column):
            col_name = col.name.upper()

            # Wildcard * is allowed
            if col_name == "*":
                continue

            # Output alias referenced in ORDER BY or GROUP BY
            if col_name in query_defined_aliases:
                continue

            # Check if column belongs to allowed schema
            if not self.schema_service.is_column_allowed(col_name):
                raise SQLValidationError(
                    f"Unauthorized column '{col_name}'. "
                    "Only verified columns from approved tables are permitted."
                )

            if col_name not in referenced_columns:
                referenced_columns.append(col_name)

        # Step 7: Bounded result size (inject or clamp LIMIT)
        has_limit = False
        limit_val: Optional[int] = None

        limit_node = stmt.find(exp.Limit)
        if limit_node:
            has_limit = True
            try:
                # If limit expression is a number literal
                if isinstance(limit_node.expression, exp.Literal):
                    limit_val = int(limit_node.expression.this)
                elif hasattr(limit_node.expression, "name") and limit_node.expression.name.isdigit():
                    limit_val = int(limit_node.expression.name)
            except Exception:
                limit_val = None

            if limit_val is not None and limit_val > self.max_result_rows:
                # Clamp existing limit to max_result_rows
                limit_node.set("expression", exp.Literal.number(self.max_result_rows))
                limit_val = self.max_result_rows
        else:
            # Query has no limit; append bounded limit
            if isinstance(stmt, exp.Select):
                stmt = stmt.limit(self.max_result_rows)
                has_limit = True
                limit_val = self.max_result_rows

        sanitized_sql = stmt.sql(dialect="snowflake")

        return ValidatedSQL(
            original_sql=sql,
            sanitized_sql=sanitized_sql,
            tables_referenced=referenced_tables,
            columns_referenced=referenced_columns,
            has_limit=has_limit,
            limit_value=limit_val,
        )


# Singleton instance
sql_validator = SQLValidator()
