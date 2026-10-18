# DataMind — Backend Service

FastAPI backend service integrating hosted Google Gemma models with Snowflake sample data.

## Environment Variables

Configure your local `backend/.env` file from `backend/.env.example`:

| Variable | Description | Default / Example |
|---|---|---|
| `GEMMA_API_KEY` | Google API key with access to hosted Gemma models | *(Secret)* |
| `GEMMA_MODEL` | Verified hosted Gemma model identifier | `gemma-4-26b-a4b-it` |
| `SNOWFLAKE_ACCOUNT` | Snowflake account identifier | *(e.g., xy12345.us-east-1)* |
| `SNOWFLAKE_USER` | Snowflake username | *(e.g., DATAMIND_USER)* |
| `SNOWFLAKE_PASSWORD` | Snowflake password | *(Secret)* |
| `SNOWFLAKE_WAREHOUSE` | Snowflake warehouse name | `COMPUTE_WH` |
| `SNOWFLAKE_DATABASE` | Snowflake database | `SNOWFLAKE_SAMPLE_DATA` |
| `SNOWFLAKE_SCHEMA` | Snowflake schema | `TPCH_SF1` |
| `FRONTEND_ORIGIN` | Allowed CORS origin(s) | `http://localhost:5173` |
| `QUERY_TIMEOUT_SECONDS`| SQL execution timeout | `30` |
| `MAX_RESULT_ROWS` | Maximum result rows returned | `100` |

## Setup & Running

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Running the Gemma Smoke Test
To verify live hosted Gemma access safely without exposing credentials:
```powershell
python scripts/smoke_test_gemma.py
```

### Running Unit Tests
```powershell
pytest -v
```

### Starting the Backend Development Server
```powershell
python -m uvicorn app.main:app --reload --port 8000
```
