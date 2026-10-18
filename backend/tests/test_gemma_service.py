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


@patch("httpx.Client.post")
def test_http_rate_limit_429(mock_post, mock_service):
    """HTTP 429 raises GemmaRateLimitError."""
    mock_post.return_value = MagicMock(status_code=429, text="Rate limit exceeded")
    with pytest.raises(GemmaRateLimitError, match="rate limit"):
        mock_service.generate_raw("Test")


@patch("httpx.Client.post")
def test_http_timeout(mock_post, mock_service):
    """httpx.TimeoutException maps to GemmaTimeoutError."""
    mock_post.side_effect = httpx.ReadTimeout("Read timed out")
    with pytest.raises(GemmaTimeoutError, match="timed out"):
        mock_service.generate_raw("Test")


@patch("httpx.Client.post")
def test_http_generic_500(mock_post, mock_service):
    """HTTP 500 raises general GemmaError."""
    mock_post.return_value = MagicMock(status_code=500, text="Internal Server Error")
    with pytest.raises(GemmaError, match="provider error"):
        mock_service.generate_raw("Test")
