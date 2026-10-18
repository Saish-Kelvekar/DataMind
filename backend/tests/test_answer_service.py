"""Unit tests for AnswerService orchestration.

Uses isolated mocks to verify end-to-end handling of:
1. Successful question answering flow.
2. Empty result sets (handled honestly without fabricating data).
3. Unsupported questions (e.g., weather or non-existent domains).
4. Ambiguous questions requiring clarification.
5. Malicious or invalid model SQL rejected by validator before execution.
6. AI provider failures (auth, timeout, rate limit).
7. Database failures (Snowflake auth, warehouse, query syntax error).
"""

from unittest.mock import MagicMock
import pytest

from app.answer_service import AnswerService
from app.gemma_service import (
    GemmaAuthError,
    GemmaRateLimitError,
    GemmaSQLProposal,
    GemmaTimeoutError,
)
from app.snowflake_service import (
    QueryResult,
    SnowflakeAuthError,
    SnowflakeQueryError,
    SnowflakeTimeoutError,
)
from app.sql_validator import SQLValidationError


@pytest.fixture
def mock_dependencies():
    """Mocked dependencies for AnswerService testing."""
    mock_gemma = MagicMock()
    mock_snowflake = MagicMock()
    mock_validator = MagicMock()
    mock_schema = MagicMock()
    mock_schema.get_prompt_schema_context.return_value = "SCHEMA CONTEXT"

    service = AnswerService(
        gemma_svc=mock_gemma,
        snowflake_svc=mock_snowflake,
        validator=mock_validator,
        schema_svc=mock_schema,
    )
    return service, mock_gemma, mock_snowflake, mock_validator


# ---------------------------------------------------------------------------
# Success & Grounded Explanation Tests
# ---------------------------------------------------------------------------

def test_answer_success_flow(mock_dependencies):
    """Successful question answering pipeline returns complete response contract."""
    service, mock_gemma, mock_snowflake, mock_validator = mock_dependencies

    # 1. Gemma proposes valid SQL
    mock_gemma.propose_sql.return_value = GemmaSQLProposal(
        status="sql_proposed",
        sql="SELECT O_ORDERKEY, O_TOTALPRICE FROM ORDERS ORDER BY O_TOTALPRICE DESC LIMIT 5",
        explanation="Sorts orders by total price and returns top 5.",
        assumptions=["Orders sorted descending"],
    )

    # 2. Validator approves SQL
    mock_validated = MagicMock()
    mock_validated.sanitized_sql = "SELECT O_ORDERKEY, O_TOTALPRICE FROM ORDERS ORDER BY O_TOTALPRICE DESC LIMIT 5"
    mock_validator.validate.return_value = mock_validated

    # 3. Snowflake returns real result rows
    mock_snowflake.execute_query.return_value = QueryResult(
        columns=["O_ORDERKEY", "O_TOTALPRICE"],
        rows=[[101, 450000.0], [102, 420000.0]],
        row_count=2,
        elapsed_ms=125,
        query_id="sfqid-success-1234",
    )

    resp = service.answer_question("What are the five most expensive orders?")

    assert resp.status == "success"
    assert resp.question == "What are the five most expensive orders?"
    assert resp.sql == mock_validated.sanitized_sql
    assert resp.columns == ["O_ORDERKEY", "O_TOTALPRICE"]
    assert len(resp.rows) == 2
    assert resp.row_count == 2
    assert resp.query_id == "sfqid-success-1234"
    assert "top 5" in resp.explanation.lower()
    assert resp.assumptions == ["Orders sorted descending"]


def test_answer_empty_results_flow(mock_dependencies):
    """When query returns 0 rows, explanation reflects empty results without fabricating data."""
    service, mock_gemma, mock_snowflake, mock_validator = mock_dependencies

    mock_gemma.propose_sql.return_value = GemmaSQLProposal(
        status="sql_proposed",
        sql="SELECT C_NAME FROM CUSTOMER WHERE C_ACCTBAL > 1000000000",
        explanation="Finds customers with billionaire account balances.",
        assumptions=[],
    )

    mock_validated = MagicMock()
    mock_validated.sanitized_sql = "SELECT C_NAME FROM CUSTOMER WHERE C_ACCTBAL > 1000000000 LIMIT 100"
    mock_validator.validate.return_value = mock_validated

    mock_snowflake.execute_query.return_value = QueryResult(
        columns=["C_NAME"],
        rows=[],
        row_count=0,
        elapsed_ms=45,
        query_id="sfqid-empty-1234",
    )

    resp = service.answer_question("Find customers with over 1 billion in balance")

    assert resp.status == "success"
    assert resp.row_count == 0
    assert resp.rows == []
    assert "No rows were returned" in resp.explanation


# ---------------------------------------------------------------------------
# Unsupported & Clarification Status Tests
# ---------------------------------------------------------------------------

def test_answer_unsupported_question(mock_dependencies):
    """Questions outside dataset scope return unsupported status without running SQL."""
    service, mock_gemma, mock_snowflake, mock_validator = mock_dependencies

    mock_gemma.propose_sql.return_value = GemmaSQLProposal(
        status="unsupported",
        sql=None,
        explanation="This dataset contains customer, order, and lineitem records and does not contain weather data.",
        assumptions=[],
    )

    resp = service.answer_question("What is the current weather in Tokyo?")

    assert resp.status == "unsupported"
    assert resp.sql is None
    assert resp.rows == []
    assert "does not contain weather data" in resp.message
    # Verify Snowflake was NEVER called
    mock_snowflake.execute_query.assert_not_called()


def test_answer_clarification_required(mock_dependencies):
    """Ambiguous questions return clarification_required status without running SQL."""
    service, mock_gemma, mock_snowflake, mock_validator = mock_dependencies

    mock_gemma.propose_sql.return_value = GemmaSQLProposal(
        status="clarification_required",
        sql=None,
        explanation="Please specify whether you want the highest count of orders or highest total revenue.",
        assumptions=[],
    )

    resp = service.answer_question("Who is the best customer?")

    assert resp.status == "clarification_required"
    assert resp.sql is None
    assert resp.rows == []
    assert "Please specify" in resp.message
    mock_snowflake.execute_query.assert_not_called()


# ---------------------------------------------------------------------------
# Security & Malicious Proposal Rejection Tests
# ---------------------------------------------------------------------------

def test_answer_rejects_disallowed_sql_before_execution(mock_dependencies):
    """If model proposes a DDL/write statement, validator rejects it and Snowflake is never executed."""
    service, mock_gemma, mock_snowflake, mock_validator = mock_dependencies

    mock_gemma.propose_sql.return_value = GemmaSQLProposal(
        status="sql_proposed",
        sql="DROP TABLE CUSTOMER",
        explanation="Malicious proposal",
        assumptions=[],
    )

    mock_validator.validate.side_effect = SQLValidationError("Disallowed operation: DROP")

    resp = service.answer_question("Delete all customer data")

    assert resp.status == "error"
    assert "rejected by security policy" in resp.message
    assert resp.sql is None
    mock_snowflake.execute_query.assert_not_called()


# ---------------------------------------------------------------------------
# Provider & Database Failure Tests
# ---------------------------------------------------------------------------

def test_answer_gemma_auth_failure(mock_dependencies):
    """AI provider auth errors return predictable structured error."""
    service, mock_gemma, mock_snowflake, _ = mock_dependencies
    mock_gemma.propose_sql.side_effect = GemmaAuthError("Invalid API Key")

    resp = service.answer_question("Count orders")
    assert resp.status == "error"
    assert "AI model authentication failed" in resp.message
    mock_snowflake.execute_query.assert_not_called()


def test_answer_gemma_rate_limit(mock_dependencies):
    """AI provider rate limits return predictable structured error."""
    service, mock_gemma, mock_snowflake, _ = mock_dependencies
    mock_gemma.propose_sql.side_effect = GemmaRateLimitError("Quota exceeded")

    resp = service.answer_question("Count orders")
    assert resp.status == "error"
    assert "rate limit reached" in resp.message


def test_answer_gemma_timeout(mock_dependencies):
    """AI provider timeouts return predictable structured error."""
    service, mock_gemma, mock_snowflake, _ = mock_dependencies
    mock_gemma.propose_sql.side_effect = GemmaTimeoutError("Request timed out")

    resp = service.answer_question("Count orders")
    assert resp.status == "error"
    assert "timed out" in resp.message


def test_answer_snowflake_auth_failure(mock_dependencies):
    """Database authentication failure returns predictable structured error."""
    service, mock_gemma, mock_snowflake, mock_validator = mock_dependencies

    mock_gemma.propose_sql.return_value = GemmaSQLProposal(
        status="sql_proposed",
        sql="SELECT COUNT(*) FROM ORDERS",
        explanation="Counts orders",
        assumptions=[],
    )
    mock_validated = MagicMock()
    mock_validated.sanitized_sql = "SELECT COUNT(*) FROM ORDERS LIMIT 100"
    mock_validator.validate.return_value = mock_validated

    mock_snowflake.execute_query.side_effect = SnowflakeAuthError("Auth failed")

    resp = service.answer_question("How many orders exist?")
    assert resp.status == "error"
    assert "Snowflake database authentication failed" in resp.message


def test_answer_snowflake_query_timeout(mock_dependencies):
    """Database query timeout returns predictable structured error."""
    service, mock_gemma, mock_snowflake, mock_validator = mock_dependencies

    mock_gemma.propose_sql.return_value = GemmaSQLProposal(
        status="sql_proposed",
        sql="SELECT * FROM LINEITEM",
        explanation="Selects lineitems",
        assumptions=[],
    )
    mock_validated = MagicMock()
    mock_validated.sanitized_sql = "SELECT * FROM LINEITEM LIMIT 100"
    mock_validator.validate.return_value = mock_validated

    mock_snowflake.execute_query.side_effect = SnowflakeTimeoutError("Query timed out")

    resp = service.answer_question("Show all lineitems")
    assert resp.status == "error"
    assert "timed out" in resp.message


def test_answer_preserves_complex_analytical_assumptions(mock_dependencies):
    """Assumptions from model proposal are preserved in the final AskResponse contract."""
    service, mock_gemma, mock_snowflake, mock_validator = mock_dependencies

    mock_gemma.propose_sql.return_value = GemmaSQLProposal(
        status="sql_proposed",
        sql="SELECT c.C_NAME, SUM(l.L_EXTENDEDPRICE * (1 - l.L_DISCOUNT)) AS REVENUE FROM CUSTOMER c JOIN ORDERS o ON c.C_CUSTKEY = o.O_CUSTKEY JOIN LINEITEM l ON o.O_ORDERKEY = l.L_ORDERKEY WHERE o.O_ORDERSTATUS = 'F' GROUP BY c.C_NAME ORDER BY REVENUE DESC LIMIT 10",
        explanation="Calculates top 10 customers by fulfilled lineitem revenue.",
        assumptions=[
            "Revenue calculated from lineitems to prevent order total fan-out",
            "Order status 'F' filters for fulfilled orders",
        ],
    )
    mock_validated = MagicMock()
    mock_validated.sanitized_sql = "SELECT c.C_NAME, SUM(l.L_EXTENDEDPRICE * (1 - l.L_DISCOUNT)) AS REVENUE FROM CUSTOMER c JOIN ORDERS o ON c.C_CUSTKEY = o.O_CUSTKEY JOIN LINEITEM l ON o.O_ORDERKEY = l.L_ORDERKEY WHERE o.O_ORDERSTATUS = 'F' GROUP BY c.C_NAME ORDER BY REVENUE DESC LIMIT 10"
    mock_validator.validate.return_value = mock_validated

    mock_snowflake.execute_query.return_value = QueryResult(
        columns=["C_NAME", "REVENUE"],
        rows=[["Customer#000000001", 1234567.89]],
        row_count=1,
        elapsed_ms=88,
        query_id="sfqid-complex-1234",
    )

    resp = service.answer_question("Top 10 customers by revenue on completed orders")
    assert resp.status == "success"
    assert len(resp.assumptions) == 2
    assert "fan-out" in resp.assumptions[0]
    assert resp.query_id == "sfqid-complex-1234"


def test_answer_gemma_malformed_response_handled_gracefully(mock_dependencies):
    """Malformed model JSON returns safe structured error response instead of crashing."""
    from app.gemma_service import GemmaMalformedResponseError

    service, mock_gemma, mock_snowflake, _ = mock_dependencies
    mock_gemma.propose_sql.side_effect = GemmaMalformedResponseError("Invalid JSON structure")

    resp = service.answer_question("Give me sales data")
    assert resp.status == "error"
    assert "Failed to generate structured query proposal" in resp.message
    mock_snowflake.execute_query.assert_not_called()
