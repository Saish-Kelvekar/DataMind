"""Hosted Google Gemma model integration service for DataMind.

Connects directly to official Google AI endpoints hosting Google Gemma models
(e.g., gemma-4-26b-a4b-it), validating authentication, enforcing timeouts, and
parsing structured SQL proposals.
"""

import json
import logging
import re
import time as time_module
from typing import Any, Dict, List, Literal, Optional
import httpx
from pydantic import BaseModel, Field

from app.config import get_settings
from app.schema_service import schema_service

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom Exceptions
# ---------------------------------------------------------------------------

class GemmaError(Exception):
    """Base exception for Gemma service failures."""


class GemmaAuthError(GemmaError):
    """Raised when API credentials are missing, invalid, or unauthorized."""


class GemmaModelNotFoundError(GemmaError):
    """Raised when the specified Gemma model is not found or unsupported."""


class GemmaRateLimitError(GemmaError):
    """Raised when provider rate limits or quotas are exceeded."""


class GemmaTimeoutError(GemmaError):
    """Raised when model request exceeds the allowed timeout."""


class GemmaMalformedResponseError(GemmaError):
    """Raised when the model response cannot be parsed into valid structure."""


# ---------------------------------------------------------------------------
# Data Models
# ---------------------------------------------------------------------------

class GemmaSQLProposal(BaseModel):
    """Structured SQL proposal returned by the Gemma model."""

    status: Literal["sql_proposed", "clarification_required", "unsupported"]
    sql: Optional[str] = None
    explanation: Optional[str] = None
    assumptions: List[str] = Field(default_factory=list)
    raw_response: Optional[str] = None


# ---------------------------------------------------------------------------
# Service Implementation
# ---------------------------------------------------------------------------

class GemmaService:
    """Client for querying hosted Google Gemma models via REST API."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout_seconds: float = 30.0,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.effective_gemma_api_key
        self.model = model or settings.gemma_model
        # Strip optional "models/" prefix if passed
        if self.model.startswith("models/"):
            self.model = self.model[len("models/"):]
        self.timeout_seconds = timeout_seconds

    def _ensure_authenticated(self) -> None:
        """Verify that an API key is configured."""
        if not self.api_key or not self.api_key.strip():
            raise GemmaAuthError(
                "Gemma API key is not configured. Set GEMMA_API_KEY in backend/.env"
            )

    def _extract_text_from_response(self, response_data: Dict[str, Any]) -> str:
        """Extract the model response text, filtering out reasoning/thought parts."""
        candidates = response_data.get("candidates", [])
        if not candidates:
            raise GemmaMalformedResponseError("No candidates returned in Gemma response")

        candidate = candidates[0]
        content = candidate.get("content", {})
        parts = content.get("parts", [])

        if not parts:
            raise GemmaMalformedResponseError("No content parts found in Gemma candidate")

        # Gemma 4 includes reasoning parts with 'thought: True'.
        # We extract non-thought text parts representing the final answer.
        non_thought_parts = [
            p.get("text", "") for p in parts if not p.get("thought", False) and "text" in p
        ]

        if non_thought_parts:
            return "".join(non_thought_parts).strip()

        # Fallback: if only thought parts exist, use all text parts
        all_parts = [p.get("text", "") for p in parts if "text" in p]
        if all_parts:
            return "".join(all_parts).strip()

        raise GemmaMalformedResponseError("Empty text parts in Gemma response candidate")

    def _clean_json_markdown(self, raw_text: str) -> str:
        """Strip markdown code fence blocks if wrapped in ```json ... ``` and clean trailing commas."""
        text = raw_text.strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if match:
            text = match.group(1).strip()
        # Clean trailing commas in objects or arrays: e.g. {"a": 1,} -> {"a": 1}
        text = re.sub(r",\s*([\]}])", r"\1", text)
        return text

    def generate_raw(self, prompt: str, timeout: Optional[float] = None) -> str:
        """Send a prompt synchronously to hosted Gemma and return text."""
        self._ensure_authenticated()
        endpoint = f"{self.BASE_URL}/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1024,
            },
        }

        call_timeout = timeout or self.timeout_seconds
        max_retries = 2

        for attempt in range(max_retries + 1):
            try:
                with httpx.Client(timeout=call_timeout) as client:
                    response = client.post(endpoint, json=payload)
            except httpx.TimeoutException as exc:
                if attempt < max_retries:
                    time_module.sleep(1.0)
                    continue
                raise GemmaTimeoutError(
                    f"Gemma request timed out after {call_timeout}s"
                ) from exc
            except httpx.RequestError as exc:
                if attempt < max_retries:
                    time_module.sleep(1.0)
                    continue
                raise GemmaError(f"Network error connecting to Gemma provider: {exc}") from exc

            if response.status_code == 200:
                return self._extract_text_from_response(response.json())

            # Retry transient server errors or rate spikes
            if response.status_code in (500, 503, 429) and attempt < max_retries:
                time_module.sleep(1.5 * (attempt + 1))
                continue

            if response.status_code in (401, 403):
                raise GemmaAuthError(
                    f"Gemma authentication failed (HTTP {response.status_code}): Invalid or unauthorized API key"
                )
            if response.status_code == 404:
                raise GemmaModelNotFoundError(
                    f"Hosted Gemma model '{self.model}' not found or unsupported by provider"
                )
            if response.status_code == 429:
                raise GemmaRateLimitError(
                    "Gemma API rate limit or quota exceeded. Please retry in a few moments."
                )

            raise GemmaError(
                f"Gemma provider error (HTTP {response.status_code}): {response.text[:200]}"
            )

    def propose_sql(
        self, question: str, schema_context: Optional[str] = None
    ) -> GemmaSQLProposal:
        """Prompt Gemma with verified schema context to propose a structured SQL query."""
        context = schema_context or schema_service.get_prompt_schema_context()
        prompt = f"""You are DataMind, an expert analytics AI engineer and data architect.
Your task is to analyze an analytical question and produce a safe, accurate Snowflake SQL query based ONLY on the verified schema below.

VERIFIED SCHEMA & METRICS:
{context}

REASONING & CLASSIFICATION INSTRUCTIONS:
Carefully analyze the user's analytical intent across three distinct outcomes:

1. "sql_proposed" (Answerable):
   - The question can be answered using the available tables, columns, or computable metrics.
   - Do NOT mark a question as unsupported merely because the wording is unfamiliar, conversational, or involves multi-table joins or calculations.
   - Interpret common business synonyms using the Business Glossary:
     * "revenue", "sales", "spending" -> O_TOTALPRICE or L_EXTENDEDPRICE * (1 - L_DISCOUNT)
     * "items", "volume" -> L_QUANTITY
     * "delayed", "late shipment" -> L_SHIPDATE > L_COMMITDATE
     * "balance", "funds" -> C_ACCTBAL
     * "open orders", "fulfilled orders" -> O_ORDERSTATUS ('O' or 'F')
     * "urgent orders" -> O_ORDERPRIORITY = '1-URGENT'
   - If an analytical convention can resolve a slight ambiguity (e.g. "top customers" = highest total spend), proceed with the standard interpretation and state the assumption explicitly in the "assumptions" array.

2. "clarification_required":
   - Use ONLY when an essential ambiguity exists that would materially alter the answer and no reasonable default interpretation is possible (e.g. "show that customer" without any identifier or filter).
   - In "explanation", clearly describe what specific detail is required. Set "sql" to null.

3. "unsupported":
   - Use ONLY when the question asks for information genuinely absent from the dataset (e.g., weather, employee salaries, stock tickers, product categories outside TPC-H).
   - In "explanation", honestly explain that the requested data is not present in the customer/order/lineitem dataset. Set "sql" to null.

SQL CODING RULES (When status is "sql_proposed"):
1. Propose ONLY a single read-only SELECT query.
2. Use ONLY verified tables (CUSTOMER, ORDERS, LINEITEM) and their approved columns.
3. Use standard uppercase unquoted Snowflake identifiers (e.g. CUSTOMER, O_TOTALPRICE).
4. When aggregating with dimensions, ALWAYS include all non-aggregated select expressions in the GROUP BY clause.
5. Use NULLIF(denom, 0) to avoid division by zero.
6. Return your response in STRICT JSON format with no additional conversation outside the JSON block.

JSON OUTPUT SCHEMA:
{{
  "status": "sql_proposed" | "clarification_required" | "unsupported",
  "sql": "SELECT ...",
  "explanation": "Clear plain-language explanation of what the query computes.",
  "assumptions": ["Explicit list of assumptions made, if any"]
}}

QUESTION:
{question}
"""
        raw_text = self.generate_raw(prompt)
        cleaned_json = self._clean_json_markdown(raw_text)

        try:
            parsed = json.loads(cleaned_json)
        except json.JSONDecodeError as exc:
            # If model returned text that couldn't be parsed directly, attempt heuristic extraction
            json_match = re.search(r"\{[\s\S]*\}", cleaned_json)
            if json_match:
                try:
                    parsed = json.loads(json_match.group(0))
                except json.JSONDecodeError:
                    raise GemmaMalformedResponseError(
                        f"Failed to decode Gemma JSON response: {cleaned_json[:200]}"
                    ) from exc
            else:
                raise GemmaMalformedResponseError(
                    f"Gemma did not return a valid JSON object: {cleaned_json[:200]}"
                ) from exc

        raw_status = str(parsed.get("status", "")).strip().lower()
        if raw_status in ("answerable", "sql_proposed"):
            status = "sql_proposed"
        elif raw_status == "clarification_required":
            status = "clarification_required"
        elif raw_status == "unsupported":
            status = "unsupported"
        else:
            raise GemmaMalformedResponseError(
                f"Invalid proposal status '{raw_status}' returned by Gemma. Expected 'sql_proposed', 'clarification_required', or 'unsupported'."
            )

        # Defensive normalization of fields
        sql_val = parsed.get("sql")
        if sql_val is not None and not isinstance(sql_val, str):
            sql_val = str(sql_val)

        explanation_val = parsed.get("explanation")
        if explanation_val is not None and not isinstance(explanation_val, str):
            explanation_val = str(explanation_val)

        assumptions_raw = parsed.get("assumptions", [])
        if isinstance(assumptions_raw, list):
            assumptions_val = [str(a) for a in assumptions_raw if a is not None]
        elif isinstance(assumptions_raw, str):
            assumptions_val = [assumptions_raw]
        else:
            assumptions_val = []

        return GemmaSQLProposal(
            status=status,
            sql=sql_val,
            explanation=explanation_val,
            assumptions=assumptions_val,
            raw_response=raw_text,
        )
