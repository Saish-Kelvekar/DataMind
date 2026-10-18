"""Pydantic request and response schemas for the DataMind backend API."""

from typing import Any, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: Literal["ok", "degraded", "error"] = "ok"
    service: str = "datamind-backend"
    version: str = "0.1.0"


class AskRequest(BaseModel):
    """Natural-language question request schema."""

    question: str = Field(
        ...,
        description="Natural language question to ask the dataset",
        min_length=1,
        max_length=500,
        examples=["What are the five most expensive orders?"],
    )

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Question cannot be empty or purely whitespace")
        if len(stripped) > 500:
            raise ValueError("Question cannot exceed 500 characters")
        return stripped


class AskResponse(BaseModel):
    """Unified API response schema matching DataMind shared contract."""

    status: Literal["success", "clarification_required", "unsupported", "error"]
    question: Optional[str] = None
    sql: Optional[str] = None
    columns: List[str] = Field(default_factory=list)
    rows: List[List[Any]] = Field(default_factory=list)
    explanation: Optional[str] = None
    message: Optional[str] = None
    assumptions: List[str] = Field(default_factory=list)
    row_count: Optional[int] = None
    elapsed_ms: Optional[int] = None
    query_id: Optional[str] = None
