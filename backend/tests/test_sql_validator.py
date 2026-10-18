"""Unit tests for SQLValidator enforcing read-only SELECT security policies.

Verifies:
1. Valid SELECT queries, aggregations, permitted joins, and CTEs pass.
2. DDL/DML operations (DROP, DELETE, UPDATE, INSERT) are strictly rejected.
3. Multiple statements and injection attempts are rejected.
4. Unauthorized tables, unauthorized schemas/databases, and unauthorized columns are rejected.
5. Dangerous constructs (SELECT INTO, system function calls) are rejected.
6. Row limits are safely bounded (injected or clamped to MAX_RESULT_ROWS).
"""

import pytest
from app.sql_validator import SQLValidationError, SQLValidator


@pytest.fixture
def validator():
    """SQLValidator instance configured with max_result_rows=100."""
    return SQLValidator(max_result_rows=100)


# ---------------------------------------------------------------------------
# Permitted Query Tests
# ---------------------------------------------------------------------------

def test_valid_simple_select(validator):
    """Simple SELECT on allowed table passes validation."""
    sql = "SELECT C_NAME, C_ACCTBAL FROM CUSTOMER LIMIT 10"
    validated = validator.validate(sql)
    assert "CUSTOMER" in validated.tables_referenced
    assert "C_NAME" in validated.columns_referenced
    assert "C_ACCTBAL" in validated.columns_referenced
    assert validated.has_limit is True
    assert validated.limit_value == 10
    assert "SELECT" in validated.sanitized_sql


def test_valid_aggregation_query(validator):
    """Aggregations with aliases and GROUP BY pass validation and inject limit."""
    sql = """
    SELECT C_MKTSEGMENT, COUNT(*) AS TOTAL_CUSTOMERS, AVG(C_ACCTBAL) AS AVG_BALANCE
    FROM CUSTOMER
    GROUP BY C_MKTSEGMENT
    """
    validated = validator.validate(sql)
    assert "CUSTOMER" in validated.tables_referenced
    assert "C_MKTSEGMENT" in validated.columns_referenced
    assert "C_ACCTBAL" in validated.columns_referenced
    # Default limit injected
    assert validated.has_limit is True
    assert validated.limit_value == 100
    assert "LIMIT 100" in validated.sanitized_sql.upper()


def test_valid_two_table_join(validator):
    """Join between CUSTOMER and ORDERS on primary/foreign key passes."""
    sql = """
    SELECT c.C_NAME, o.O_ORDERKEY, o.O_TOTALPRICE
    FROM CUSTOMER c
    JOIN ORDERS o ON c.C_CUSTKEY = o.O_CUSTKEY
    WHERE o.O_TOTALPRICE > 1000
    ORDER BY o.O_TOTALPRICE DESC
    LIMIT 20
    """
    validated = validator.validate(sql)
    assert set(validated.tables_referenced) == {"CUSTOMER", "ORDERS"}
    assert validated.limit_value == 20


def test_valid_three_table_join(validator):
    """Join across CUSTOMER, ORDERS, and LINEITEM passes validation."""
    sql = """
    SELECT c.C_NAME, o.O_ORDERKEY, l.L_QUANTITY, l.L_EXTENDEDPRICE
    FROM CUSTOMER c
    JOIN ORDERS o ON c.C_CUSTKEY = o.O_CUSTKEY
    JOIN LINEITEM l ON o.O_ORDERKEY = l.L_ORDERKEY
    WHERE l.L_RETURNFLAG = 'R'
    LIMIT 50
    """
    validated = validator.validate(sql)
    assert set(validated.tables_referenced) == {"CUSTOMER", "ORDERS", "LINEITEM"}
    assert validated.limit_value == 50


def test_valid_cte_query(validator):
    """Common Table Expression (WITH clause) referencing allowed tables passes."""
    sql = """
    WITH HighValueOrders AS (
        SELECT O_ORDERKEY, O_TOTALPRICE
        FROM ORDERS
        WHERE O_TOTALPRICE > 50000
    )
    SELECT O_ORDERKEY, O_TOTALPRICE FROM HighValueOrders LIMIT 10
    """
    validated = validator.validate(sql)
    assert "ORDERS" in validated.tables_referenced
    assert validated.limit_value == 10


def test_valid_qualified_table_name(validator):
    """Fully qualified table name with approved database and schema passes."""
    sql = "SELECT C_NAME FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.CUSTOMER LIMIT 5"
    validated = validator.validate(sql)
    assert "CUSTOMER" in validated.tables_referenced


# ---------------------------------------------------------------------------
# Limit Bounding & Clamping Tests
# ---------------------------------------------------------------------------

def test_limit_clamped_when_exceeds_max(validator):
    """A LIMIT greater than max_result_rows (100) is clamped down to 100."""
    sql = "SELECT C_NAME FROM CUSTOMER LIMIT 5000"
    validated = validator.validate(sql)
    assert validated.limit_value == 100
    assert "LIMIT 100" in validated.sanitized_sql.upper()


def test_limit_preserved_when_under_max(validator):
    """A small LIMIT (e.g. 5) is preserved."""
    sql = "SELECT C_NAME FROM CUSTOMER LIMIT 5"
    validated = validator.validate(sql)
    assert validated.limit_value == 5
    assert "LIMIT 5" in validated.sanitized_sql.upper()


# ---------------------------------------------------------------------------
# Security & Rejection Tests: Disallowed Operations
# ---------------------------------------------------------------------------

def test_reject_drop_statement(validator):
    """DROP TABLE statements are strictly rejected."""
    with pytest.raises(SQLValidationError, match="Disallowed"):
        validator.validate("DROP TABLE CUSTOMER")


def test_reject_delete_statement(validator):
    """DELETE statements are strictly rejected."""
    with pytest.raises(SQLValidationError, match="Disallowed"):
        validator.validate("DELETE FROM ORDERS WHERE O_ORDERKEY = 100")


def test_reject_update_statement(validator):
    """UPDATE statements are strictly rejected."""
    with pytest.raises(SQLValidationError, match="Disallowed"):
        validator.validate("UPDATE CUSTOMER SET C_NAME = 'Malicious'")


def test_reject_insert_statement(validator):
    """INSERT statements are strictly rejected."""
    with pytest.raises(SQLValidationError, match="Disallowed"):
        validator.validate("INSERT INTO CUSTOMER (C_CUSTKEY) VALUES (999999)")


def test_reject_truncate_statement(validator):
    """TRUNCATE statements are strictly rejected."""
    with pytest.raises(SQLValidationError, match="Disallowed"):
        validator.validate("TRUNCATE TABLE ORDERS")


def test_reject_alter_statement(validator):
    """ALTER statements are strictly rejected."""
    with pytest.raises(SQLValidationError, match="Disallowed"):
        validator.validate("ALTER TABLE CUSTOMER DROP COLUMN C_NAME")


def test_reject_multiple_statements(validator):
    """Multiple statements delimited by semicolons are strictly rejected."""
    with pytest.raises(SQLValidationError, match="Multiple SQL statements"):
        validator.validate("SELECT * FROM CUSTOMER; DROP TABLE ORDERS;")


def test_reject_select_into(validator):
    """SELECT ... INTO (writing data) is strictly rejected."""
    with pytest.raises(SQLValidationError, match="Disallowed construct"):
        validator.validate("SELECT * INTO EXPORT_TABLE FROM CUSTOMER")


def test_reject_system_function(validator):
    """Snowflake administrative SYSTEM$ function calls are rejected."""
    with pytest.raises(SQLValidationError, match="Disallowed function call"):
        validator.validate("SELECT SYSTEM$ABORT_SESSION(12345)")


# ---------------------------------------------------------------------------
# Schema Allowlist Rejection Tests
# ---------------------------------------------------------------------------

def test_reject_unauthorized_table(validator):
    """Queries referencing unapproved tables (e.g. USERS, REGION, NATION) are rejected."""
    with pytest.raises(SQLValidationError, match="Unauthorized table 'USERS'"):
        validator.validate("SELECT * FROM USERS")


def test_reject_unauthorized_database(validator):
    """Queries referencing unauthorized database are rejected."""
    with pytest.raises(SQLValidationError, match="Unauthorized database 'PRODUCTION_DB'"):
        validator.validate("SELECT * FROM PRODUCTION_DB.TPCH_SF1.CUSTOMER")


def test_reject_unauthorized_schema(validator):
    """Queries referencing unauthorized schema are rejected."""
    with pytest.raises(SQLValidationError, match="Unauthorized schema 'PUBLIC'"):
        validator.validate("SELECT * FROM SNOWFLAKE_SAMPLE_DATA.PUBLIC.CUSTOMER")


def test_reject_unauthorized_column(validator):
    """Queries referencing columns not in approved schema are rejected."""
    with pytest.raises(SQLValidationError, match="Unauthorized column 'PASSWORD'"):
        validator.validate("SELECT C_NAME, PASSWORD FROM CUSTOMER")


def test_reject_empty_query(validator):
    """Empty or whitespace-only SQL strings are rejected."""
    with pytest.raises(SQLValidationError, match="SQL statement is empty"):
        validator.validate("   ")


# ---------------------------------------------------------------------------
# Gemma Proposal Pipeline Integration Tests (with Test Doubles)
# ---------------------------------------------------------------------------

def test_validate_gemma_proposal_success(validator):
    """A valid proposal from Gemma passes schema and security validation."""
    from app.gemma_service import GemmaSQLProposal

    proposal = GemmaSQLProposal(
        status="sql_proposed",
        sql="SELECT C_NAME, C_ACCTBAL FROM CUSTOMER ORDER BY C_ACCTBAL DESC LIMIT 5",
        explanation="Finds the top 5 customers by account balance.",
        assumptions=["Sorted descending"],
    )

    validated = validator.validate(proposal.sql)
    assert validated.has_limit is True
    assert validated.limit_value == 5
    assert "CUSTOMER" in validated.tables_referenced


def test_reject_gemma_proposal_with_unauthorized_column(validator):
    """Gemma proposal attempting to query an unauthorized column is rejected."""
    from app.gemma_service import GemmaSQLProposal

    proposal = GemmaSQLProposal(
        status="sql_proposed",
        sql="SELECT C_NAME, C_CREDIT_CARD_NUMBER FROM CUSTOMER",
        explanation="Unauthorized field access attempt",
        assumptions=[],
    )

    with pytest.raises(SQLValidationError, match="Unauthorized column 'C_CREDIT_CARD_NUMBER'"):
        validator.validate(proposal.sql)


def test_reject_gemma_proposal_with_dml(validator):
    """Gemma proposal containing DML/write operations is rejected."""
    from app.gemma_service import GemmaSQLProposal

    proposal = GemmaSQLProposal(
        status="sql_proposed",
        sql="DELETE FROM ORDERS WHERE O_ORDERKEY = 100",
        explanation="Malicious or corrupted proposal",
        assumptions=[],
    )

    with pytest.raises(SQLValidationError, match="Disallowed"):
        validator.validate(proposal.sql)

