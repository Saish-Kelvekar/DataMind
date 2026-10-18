"""Complete natural language question-to-answer orchestration service for DataMind.

Coordinates:
1. Question and schema context preparation.
2. Hosted Google Gemma structured SQL proposal.
3. Strict sqlglot read-only and allowlist validation.
4. Real Snowflake execution with bounded result fetching.
5. Grounded explanation composition and query metadata reporting.
"""

import logging
import time as time_module
from typing import Optional

from app.gemma_service import (
    GemmaAuthError,
    GemmaError,
    GemmaMalformedResponseError,
    GemmaRateLimitError,
    GemmaService,
    GemmaTimeoutError,
)
from app.schemas import AskResponse
from app.schema_service import SchemaService, schema_service
from app.snowflake_service import (
    SnowflakeAuthError,
    SnowflakePermissionError,
    SnowflakeQueryError,
    SnowflakeService,
    SnowflakeServiceError,
    SnowflakeTimeoutError,
    SnowflakeWarehouseError,
)
from app.sql_validator import SQLValidationError, SQLValidator, sql_validator

logger = logging.getLogger(__name__)


class AnswerService:
    """Orchestrates end-to-end question answering pipeline."""

    def __init__(
        self,
        gemma_svc: Optional[GemmaService] = None,
        snowflake_svc: Optional[SnowflakeService] = None,
        validator: Optional[SQLValidator] = None,
        schema_svc: Optional[SchemaService] = None,
    ) -> None:
        self.gemma_service = gemma_svc or GemmaService()
        self.snowflake_service = snowflake_svc or SnowflakeService()
        self.validator = validator or sql_validator
        self.schema_service = schema_svc or schema_service

    def answer_question(self, question: str) -> AskResponse:
        """Process a natural language question through Gemma, validation, and Snowflake."""
        start_time = time_module.perf_counter()
        cleaned_question = question.strip()

        # Step 1: Retrieve verified schema context
        schema_context = self.schema_service.get_prompt_schema_context()

        # Step 2: Request structured SQL proposal from hosted Google Gemma
        try:
            proposal = self.gemma_service.propose_sql(
                cleaned_question, schema_context=schema_context
            )
        except GemmaAuthError as exc:
            logger.error("Gemma authentication error: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message="AI model authentication failed. Please verify GEMMA_API_KEY.",
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except GemmaRateLimitError as exc:
            logger.warning("Gemma rate limit: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message="AI provider rate limit reached. Please retry in a few moments.",
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except GemmaTimeoutError as exc:
            logger.warning("Gemma timeout: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message="AI model request timed out. Please retry.",
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except (GemmaMalformedResponseError, GemmaError) as exc:
            logger.error("Gemma provider error: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message=f"Failed to generate structured query proposal: {exc}",
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except Exception as exc:
            logger.exception("Unexpected error in Gemma proposal: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message="An unexpected error occurred during AI query generation.",
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )

        # Step 3: Handle unsupported or clarification_required responses honestly
        if proposal.status == "unsupported":
            return AskResponse(
                status="unsupported",
                question=cleaned_question,
                message=proposal.explanation or "This dataset does not contain the information needed to answer that question.",
                sql=None,
                columns=[],
                rows=[],
                assumptions=proposal.assumptions,
                row_count=0,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )

        if proposal.status == "clarification_required":
            return AskResponse(
                status="clarification_required",
                question=cleaned_question,
                message=proposal.explanation or "The question is ambiguous. Please provide more specific criteria.",
                sql=None,
                columns=[],
                rows=[],
                assumptions=proposal.assumptions,
                row_count=0,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )

        # Step 4: Validate proposed SQL before ANY execution
        if not proposal.sql or not proposal.sql.strip():
            return AskResponse(
                status="error",
                question=cleaned_question,
                message="Model proposed a query status but returned an empty SQL string.",
                sql=None,
                assumptions=proposal.assumptions,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )

        try:
            validated = self.validator.validate(proposal.sql)
        except SQLValidationError as exc:
            logger.warning("Proposed SQL failed validation: %s | Query: %s", exc, proposal.sql)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message=f"Proposed SQL rejected by security policy: {exc}",
                sql=None,
                assumptions=proposal.assumptions,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except Exception as exc:
            logger.exception("Unexpected error during SQL validation: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message="Unexpected error during query security validation.",
                sql=None,
                assumptions=proposal.assumptions,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )

        # Step 5: Execute validated SQL in Snowflake
        try:
            query_result = self.snowflake_service.execute_query(validated.sanitized_sql)
        except SnowflakeAuthError as exc:
            logger.error("Snowflake auth failure: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message="Snowflake database authentication failed. Please check credentials.",
                sql=validated.sanitized_sql,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except SnowflakeWarehouseError as exc:
            logger.error("Snowflake warehouse error: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message=f"Snowflake warehouse is unavailable: {exc}",
                sql=validated.sanitized_sql,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except SnowflakePermissionError as exc:
            logger.error("Snowflake permission denied: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message=f"Database permission denied: {exc}",
                sql=validated.sanitized_sql,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except SnowflakeTimeoutError as exc:
            logger.warning("Snowflake query timeout: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message="Snowflake query execution timed out.",
                sql=validated.sanitized_sql,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except (SnowflakeQueryError, SnowflakeServiceError) as exc:
            logger.error("Snowflake execution failure: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message=f"Snowflake query execution failed: {exc}",
                sql=validated.sanitized_sql,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )
        except Exception as exc:
            logger.exception("Unexpected error during Snowflake execution: %s", exc)
            return AskResponse(
                status="error",
                question=cleaned_question,
                message="An unexpected error occurred while executing the query in Snowflake.",
                sql=validated.sanitized_sql,
                elapsed_ms=int((time_module.perf_counter() - start_time) * 1000),
            )

        # Step 6: Ground explanation in real results
        if query_result.row_count == 0:
            explanation = (
                f"{proposal.explanation or 'The query executed successfully.'} "
                "No rows were returned matching the requested criteria."
            ).strip()
        else:
            explanation = (
                proposal.explanation
                or f"Successfully computed results from Snowflake ({query_result.row_count} rows returned)."
            )

        total_elapsed_ms = int((time_module.perf_counter() - start_time) * 1000)

        return AskResponse(
            status="success",
            question=cleaned_question,
            sql=validated.sanitized_sql,
            columns=query_result.columns,
            rows=query_result.rows,
            explanation=explanation,
            assumptions=proposal.assumptions,
            row_count=query_result.row_count,
            elapsed_ms=query_result.elapsed_ms or total_elapsed_ms,
            query_id=query_result.query_id,
        )


# Singleton instance
answer_service = AnswerService()
