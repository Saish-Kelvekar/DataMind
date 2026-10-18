"""Tests for request and response validation on /api/ask."""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.main import app
from app.schemas import AskRequest, AskResponse

client = TestClient(app)


def test_ask_request_valid():
    """Valid question is accepted and whitespace is stripped."""
    req = AskRequest(question="  What are the top 5 customers?  ")
    assert req.question == "What are the top 5 customers?"


def test_ask_request_empty_string():
    """Empty question string raises ValidationError."""
    with pytest.raises(ValidationError):
        AskRequest(question="")


def test_ask_request_whitespace_only():
    """Pure whitespace question raises ValidationError."""
    with pytest.raises(ValidationError):
        AskRequest(question="   \t \n  ")


def test_ask_request_too_long():
    """Question exceeding 500 characters raises ValidationError."""
    with pytest.raises(ValidationError):
        AskRequest(question="A" * 501)


from unittest.mock import patch


@patch("app.main.answer_service.answer_question")
def test_ask_endpoint_valid_request(mock_answer):
    """Valid question sent to /api/ask returns 200 with AskResponse schema."""
    mock_answer.return_value = AskResponse(
        status="success",
        question="What are the five most expensive orders?",
        sql="SELECT O_ORDERKEY, O_TOTALPRICE FROM ORDERS ORDER BY O_TOTALPRICE DESC LIMIT 5",
        columns=["O_ORDERKEY", "O_TOTALPRICE"],
        rows=[[101, 5000.0]],
        explanation="Finds the top 5 orders by price.",
        assumptions=[],
        row_count=1,
        elapsed_ms=100,
        query_id="sfqid-1234",
    )
    response = client.post("/api/ask", json={"question": "What are the five most expensive orders?"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["question"] == "What are the five most expensive orders?"
    assert "columns" in data
    assert "rows" in data
    assert "assumptions" in data


def test_ask_endpoint_empty_question():
    """Empty question returns 422 Unprocessable Entity."""
    response = client.post("/api/ask", json={"question": ""})
    assert response.status_code == 422


def test_ask_endpoint_missing_question_field():
    """Missing question payload returns 422 Unprocessable Entity."""
    response = client.post("/api/ask", json={})
    assert response.status_code == 422


def test_ask_endpoint_too_long_question():
    """Question over 500 chars returns 422 Unprocessable Entity."""
    response = client.post("/api/ask", json={"question": "x" * 501})
    assert response.status_code == 422


def test_ask_response_schema_success():
    """Verify AskResponse matches expected contract for success case."""
    resp = AskResponse(
        status="success",
        question="Count customers",
        sql="SELECT COUNT(*) FROM CUSTOMER",
        columns=["COUNT(*)"],
        rows=[[150000]],
        explanation="Counts total customer rows.",
        assumptions=[],
        row_count=1,
        elapsed_ms=120,
        query_id="query-12345",
    )
    assert resp.status == "success"
    assert resp.row_count == 1
    assert resp.rows == [[150000]]
