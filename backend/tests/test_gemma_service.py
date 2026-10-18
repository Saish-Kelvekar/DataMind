"""Unit tests for GemmaService response parsing and error handling.

These tests use isolated test doubles (mocks) to ensure fast, deterministic,
and reproducible testing without consuming live API quota.
Real hosted Gemma model access is tested via scripts/smoke_test_gemma.py.
"""

from unittest.mock import MagicMock, patch
import httpx
import pytest

from app.gemma_service import (
    GemmaAuthError,
    GemmaError,
    GemmaMalformedResponseError,
    GemmaModelNotFoundError,
    GemmaRateLimitError,
    GemmaService,
    GemmaTimeoutError,
)


@pytest.fixture
def mock_service():
    """GemmaService instance initialized with dummy credentials for unit testing."""
    return GemmaService(
        api_key="mock-api-key",
        model="gemma-4-26b-a4b-it",
        timeout_seconds=5.0,
    )


# ---------------------------------------------------------------------------
# Authentication & Credentials Validation Tests
# ---------------------------------------------------------------------------

def test_missing_api_key_raises_auth_error():
    """Service without an API key raises GemmaAuthError before sending request."""
    service = GemmaService(api_key="", model="gemma-4-26b-a4b-it")
    with pytest.raises(GemmaAuthError, match="Gemma API key is not configured"):
        service.generate_raw("Test prompt")


# ---------------------------------------------------------------------------
# Response Extraction & Thought-Filtering Tests
# ---------------------------------------------------------------------------

def test_extract_text_filters_thought_parts(mock_service):
    """Reasoning/thought parts from Gemma 4 are filtered out; only final answer is returned."""
    mock_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"thought": True, "text": "Reasoning step 1: analyze question"},
                        {"thought": True, "text": "Reasoning step 2: determine answer"},
                        {"text": "The answer is 42."},
                    ]
                }
            }
        ]
    }
    extracted = mock_service._extract_text_from_response(mock_response)
    assert extracted == "The answer is 42."
    assert "Reasoning step" not in extracted


def test_extract_text_fallback_when_only_thought_parts(mock_service):
    """If candidate only has thought parts, service falls back safely to text."""
    mock_response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"thought": True, "text": "All thought text"},
                    ]
                }
            }
        ]
    }
    extracted = mock_service._extract_text_from_response(mock_response)
    assert extracted == "All thought text"


def test_extract_text_missing_candidates(mock_service):
    """Empty candidates array raises GemmaMalformedResponseError."""
    with pytest.raises(GemmaMalformedResponseError, match="No candidates"):
        mock_service._extract_text_from_response({"candidates": []})


def test_extract_text_missing_parts(mock_service):
    """Candidate with empty parts raises GemmaMalformedResponseError."""
    with pytest.raises(GemmaMalformedResponseError, match="No content parts"):
        mock_service._extract_text_from_response({"candidates": [{"content": {"parts": []}}]})


# ---------------------------------------------------------------------------
# Markdown Fence Stripping & Proposal Parsing Tests
# ---------------------------------------------------------------------------

def test_clean_json_markdown(mock_service):
    """Markdown fences with json tag or backticks are cleaned properly."""
    fenced = "```json\n{\"status\": \"sql_proposed\", \"sql\": \"SELECT 1\"}\n```"
    cleaned = mock_service._clean_json_markdown(fenced)
    assert cleaned == '{"status": "sql_proposed", "sql": "SELECT 1"}'


def test_propose_sql_success(mock_service):
    """Valid JSON from Gemma is parsed into a GemmaSQLProposal."""
    mock_raw_output = """```json
    {
        "status": "sql_proposed",
        "sql": "SELECT C_NAME, C_ACCTBAL FROM CUSTOMER ORDER BY C_ACCTBAL DESC LIMIT 5",
        "explanation": "Selects top 5 customers by account balance.",
        "assumptions": ["Sorted in descending order"]
    }
    ```"""
    with patch.object(mock_service, "generate_raw", return_value=mock_raw_output):
        proposal = mock_service.propose_sql("Who has the highest balance?", "CUSTOMER(C_NAME, C_ACCTBAL)")
        assert proposal.status == "sql_proposed"
        assert "SELECT C_NAME" in proposal.sql
        assert proposal.explanation == "Selects top 5 customers by account balance."
        assert proposal.assumptions == ["Sorted in descending order"]


def test_propose_sql_unsupported(mock_service):
    """Unsupported question correctly parsed with null SQL."""
    mock_raw_output = '{"status": "unsupported", "sql": null, "explanation": "Not in dataset", "assumptions": []}'
    with patch.object(mock_service, "generate_raw", return_value=mock_raw_output):
        proposal = mock_service.propose_sql("What is the weather?", "CUSTOMER(...)")
        assert proposal.status == "unsupported"
        assert proposal.sql is None


def test_propose_sql_malformed_json_raises_error(mock_service):
    """Non-JSON text returned by model raises GemmaMalformedResponseError."""
    with patch.object(mock_service, "generate_raw", return_value="Here is your query: SELECT 1"):
        with pytest.raises(GemmaMalformedResponseError):
            mock_service.propose_sql("Count orders", "ORDERS(...)")


# ---------------------------------------------------------------------------
# HTTP Status Code & Network Error Mapping Tests
# ---------------------------------------------------------------------------

@patch("httpx.Client.post")
def test_http_auth_error_401(mock_post, mock_service):
    """HTTP 401 raises GemmaAuthError."""
    mock_post.return_value = MagicMock(status_code=401, text="Unauthorized")
    with pytest.raises(GemmaAuthError, match="authentication failed"):
        mock_service.generate_raw("Test")


@patch("httpx.Client.post")
def test_http_model_not_found_404(mock_post, mock_service):
    """HTTP 404 raises GemmaModelNotFoundError."""
    mock_post.return_value = MagicMock(status_code=404, text="Model not found")
    with pytest.raises(GemmaModelNotFoundError, match="not found"):
        mock_service.generate_raw("Test")


@patch("app.gemma_service.time_module.sleep")
@patch("httpx.Client.post")
def test_http_rate_limit_429(mock_post, mock_sleep, mock_service):
    """HTTP 429 raises GemmaRateLimitError after retries."""
    mock_post.return_value = MagicMock(status_code=429, text="Rate limit exceeded")
    with pytest.raises(GemmaRateLimitError, match="rate limit"):
        mock_service.generate_raw("Test")


@patch("httpx.Client.post")
def test_http_timeout(mock_post, mock_service):
    """httpx.TimeoutException maps to GemmaTimeoutError."""
    mock_post.side_effect = httpx.ReadTimeout("Read timed out")
    with pytest.raises(GemmaTimeoutError, match="timed out"):
        mock_service.generate_raw("Test")


@patch("app.gemma_service.time_module.sleep")
@patch("httpx.Client.post")
def test_http_generic_500(mock_post, mock_sleep, mock_service):
    """HTTP 500 raises general GemmaError after retries."""
    mock_post.return_value = MagicMock(status_code=500, text="Internal Server Error")
    with pytest.raises(GemmaError, match="provider error"):
        mock_service.generate_raw("Test")


@patch("app.gemma_service.time_module.sleep")
@patch("httpx.Client.post")
def test_http_retry_succeeds_after_transient_error(mock_post, mock_sleep, mock_service):
    """Transient HTTP 503 error succeeds on subsequent retry."""
    err_resp = MagicMock(status_code=503, text="Service Unavailable")
    ok_resp = MagicMock(
        status_code=200,
        json=lambda: {
            "candidates": [{"content": {"parts": [{"text": "Recovered response"}]}}]
        },
    )
    mock_post.side_effect = [err_resp, ok_resp]
    result = mock_service.generate_raw("Test prompt")
    assert result == "Recovered response"
    assert mock_post.call_count == 2
    mock_sleep.assert_called_once()


# ---------------------------------------------------------------------------
# Phase 2: Intent Classification & Analytical Reasoning Tests
# ---------------------------------------------------------------------------

def test_propose_sql_answerable_normalizes_to_sql_proposed(mock_service):
    """Model returning status 'answerable' is defensively normalized to 'sql_proposed'."""
    raw = """{
        "status": "answerable",
        "sql": "SELECT COUNT(*) FROM ORDERS WHERE O_ORDERSTATUS = 'F'",
        "explanation": "Calculates total fulfilled orders.",
        "assumptions": ["Order status 'F' corresponds to fulfilled"]
    }"""
    with patch.object(mock_service, "generate_raw", return_value=raw):
        proposal = mock_service.propose_sql("How many fulfilled orders are there?")
        assert proposal.status == "sql_proposed"
        assert "O_ORDERSTATUS = 'F'" in proposal.sql
        assert proposal.explanation == "Calculates total fulfilled orders."
        assert proposal.assumptions == ["Order status 'F' corresponds to fulfilled"]


def test_propose_sql_clarification_required(mock_service):
    """Ambiguous questions requiring essential clarification return clarification_required with null SQL."""
    raw = """{
        "status": "clarification_required",
        "sql": null,
        "explanation": "Please specify the customer identifier or time period to analyze.",
        "assumptions": []
    }"""
    with patch.object(mock_service, "generate_raw", return_value=raw):
        proposal = mock_service.propose_sql("Show me that customer's recent activity")
        assert proposal.status == "clarification_required"
        assert proposal.sql is None
        assert "customer identifier" in proposal.explanation


def test_propose_sql_unsupported_out_of_domain(mock_service):
    """Questions outside approved TPC-H schema return unsupported with honest explanation."""
    raw = """{
        "status": "unsupported",
        "sql": null,
        "explanation": "The dataset contains customer, order, and lineitem records, but does not contain employee salary or HR information.",
        "assumptions": []
    }"""
    with patch.object(mock_service, "generate_raw", return_value=raw):
        proposal = mock_service.propose_sql("What is the average employee salary?")
        assert proposal.status == "unsupported"
        assert proposal.sql is None
        assert "employee salary" in proposal.explanation


def test_propose_sql_complex_analytical_query(mock_service):
    """Complex analytical question with multi-hop join, date range, grouping, and metrics."""
    raw = """```json
    {
        "status": "sql_proposed",
        "sql": "SELECT c.C_CUSTKEY, c.C_NAME, SUM(l.L_EXTENDEDPRICE * (1 - l.L_DISCOUNT)) AS TOTAL_SPENT, AVG(l.L_DISCOUNT) AS AVG_DISCOUNT FROM CUSTOMER c JOIN ORDERS o ON c.C_CUSTKEY = o.O_CUSTKEY JOIN LINEITEM l ON o.O_ORDERKEY = l.L_ORDERKEY WHERE c.C_MKTSEGMENT = 'BUILDING' AND o.O_ORDERDATE >= '1995-01-01' AND o.O_ORDERDATE <= '1995-12-31' GROUP BY c.C_CUSTKEY, c.C_NAME ORDER BY TOTAL_SPENT DESC LIMIT 5",
        "explanation": "Identifies top 5 spending customers in the BUILDING market segment in 1995 using item-level discounted prices.",
        "assumptions": [
            "Revenue calculated from line items using L_EXTENDEDPRICE * (1 - L_DISCOUNT) to prevent order-level fan-out",
            "Filtered to year 1995 based on O_ORDERDATE"
        ]
    }
    ```"""
    with patch.object(mock_service, "generate_raw", return_value=raw):
        proposal = mock_service.propose_sql(
            "Who are the top 5 customers in the BUILDING segment by total spending in 1995?"
        )
        assert proposal.status == "sql_proposed"
        assert "CUSTOMER c JOIN ORDERS o" in proposal.sql
        assert "JOIN LINEITEM l" in proposal.sql
        assert "GROUP BY c.C_CUSTKEY, c.C_NAME" in proposal.sql
        assert len(proposal.assumptions) == 2
        assert "fan-out" in proposal.assumptions[0]


def test_propose_sql_heuristic_json_recovery_from_conversational_text(mock_service):
    """Model output wrapped in conversational pleasantries is safely extracted via regex heuristic."""
    raw = """Certainly! Here is your SQL query proposal:
    {
        "status": "sql_proposed",
        "sql": "SELECT COUNT(*) FROM ORDERS WHERE O_ORDERSTATUS = 'O'",
        "explanation": "Counts all open orders.",
        "assumptions": ["Order status 'O' indicates open orders"]
    }
    I hope this helps!"""
    with patch.object(mock_service, "generate_raw", return_value=raw):
        proposal = mock_service.propose_sql("How many open orders are there?")
        assert proposal.status == "sql_proposed"
        assert "SELECT COUNT(*)" in proposal.sql


def test_propose_sql_trailing_comma_cleaning(mock_service):
    """Trailing commas in model JSON are cleaned before parsing."""
    raw = """{
        "status": "sql_proposed",
        "sql": "SELECT C_NAME, C_ACCTBAL FROM CUSTOMER LIMIT 10",
        "explanation": "Returns 10 customers and their account balance.",
        "assumptions": [
            "Default limit of 10 applied",
        ],
    }"""
    with patch.object(mock_service, "generate_raw", return_value=raw):
        proposal = mock_service.propose_sql("Show me 10 customers and their balances")
        assert proposal.status == "sql_proposed"
        assert proposal.assumptions == ["Default limit of 10 applied"]


def test_propose_sql_invalid_status_raises_error(mock_service):
    """Model returning unrecognized status value raises GemmaMalformedResponseError."""
    raw = """{"status": "maybe_answerable", "sql": "SELECT 1"}"""
    with patch.object(mock_service, "generate_raw", return_value=raw):
        with pytest.raises(GemmaMalformedResponseError, match="Invalid proposal status 'maybe_answerable'"):
            mock_service.propose_sql("What is 1?")


def test_propose_sql_assumptions_normalization(mock_service):
    """Non-list assumptions (e.g. single string or null) are normalized to list of strings."""
    raw_str_assumption = """{
        "status": "sql_proposed",
        "sql": "SELECT 1",
        "explanation": "test",
        "assumptions": "Single assumption string"
    }"""
    with patch.object(mock_service, "generate_raw", return_value=raw_str_assumption):
        proposal = mock_service.propose_sql("test")
        assert proposal.assumptions == ["Single assumption string"]

    raw_null_assumption = """{
        "status": "sql_proposed",
        "sql": "SELECT 1",
        "explanation": "test",
        "assumptions": null
    }"""
    with patch.object(mock_service, "generate_raw", return_value=raw_null_assumption):
        proposal = mock_service.propose_sql("test")
        assert proposal.assumptions == []
