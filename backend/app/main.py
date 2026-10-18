"""DataMind FastAPI Application Entry Point."""

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.schemas import AskRequest, AskResponse, HealthResponse

settings = get_settings()

app = FastAPI(
    title="DataMind API",
    description="Talk to Your Data — Natural Language to Snowflake SQL via Google Gemma",
    version="0.1.0",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    """Return health status of the backend service."""
    return HealthResponse(
        status="ok",
        service="datamind-backend",
        version="0.1.0",
    )


@app.post(
    "/api/ask",
    response_model=AskResponse,
    status_code=status.HTTP_200_OK,
    tags=["Query"],
)
async def ask_question(request: AskRequest) -> AskResponse:
    """Accept natural language question, validate input, and return response schema.

    In Phase A1, input validation and schemas are enforced. Real Gemma SQL generation
    and Snowflake execution are wired in Phase A2 through A5.
    """
    return AskResponse(
        status="error",
        question=request.question,
        message="Backend foundation active. Gemma and Snowflake integrations are scheduled for Phase A2-A5.",
        sql=None,
        columns=[],
        rows=[],
        assumptions=[],
    )
