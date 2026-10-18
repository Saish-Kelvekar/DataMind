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

### Running Diagnostic Scripts
- **Gemma Model Access Smoke Test:**
  ```powershell
  python scripts/smoke_test_gemma.py
  ```
- **Snowflake Connectivity & Schema Diagnostic:**
  ```powershell
  python scripts/test_snowflake_connection.py
  ```
- **Live End-to-End Pipeline Test:**
  ```powershell
  python scripts/demo_ask.py
  ```

### Running Automated Tests
```powershell
pytest -v
```

### Starting the Backend Development Server
```powershell
python -m uvicorn app.main:app --reload --port 8000
```

## API Specification

### 1. `GET /health`
Returns system health status:
```json
{
  "status": "ok",
  "service": "datamind-backend",
  "version": "0.1.0"
}
```

### 2. `POST /api/ask`
Submits natural language questions to the pipeline.

**Request:**
```json
{
  "question": "What are the five most expensive orders?"
}
```

**Success Response (HTTP 200):**
```json
{
  "status": "success",
  "question": "What are the five most expensive orders?",
  "sql": "SELECT O_ORDERKEY, O_TOTALPRICE FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS ORDER BY O_TOTALPRICE DESC LIMIT 5",
  "columns": ["O_ORDERKEY", "O_TOTALPRICE"],
  "rows": [
    [1750466, 555285.16],
    [4722021, 544089.09],
    [3043270, 530604.44],
    [4576548, 525590.57],
    [2232932, 522720.61]
  ],
  "explanation": "This query retrieves the order identifier and total price for the five orders with the highest total price, sorted in descending order.",
  "assumptions": ["Orders sorted descending by total price"],
  "row_count": 5,
  "elapsed_ms": 2854,
  "query_id": "01c7cf01-3203-a355-0018-9c96000181fe"
}
```

**Non-Success Response (Unsupported Domain / Clarification / Error):**
```json
{
  "status": "unsupported",
  "question": "What is the weather in London?",
  "message": "The provided schema contains information regarding customers, orders, and line items, but does not contain any weather data.",
  "sql": null,
  "columns": [],
  "rows": [],
  "assumptions": [],
  "row_count": 0,
  "elapsed_ms": 1200
}
```
