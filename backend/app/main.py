"""DataMind FastAPI Application Entry Point."""

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.answer_service import answer_service
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
    """Accept natural language question, process via Gemma and Snowflake, and return response."""
    return answer_service.answer_question(request.question)
