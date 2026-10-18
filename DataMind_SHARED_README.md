# DataMind --- Talk to Your Data

**ZeroDay OSS Hacktoberfest 2026 · IIIT Dharwad · PS1**\
**Project type:** 12-hour hackathon MVP\
**Team:** 2 members\
**Status:** Implementation baseline

> **Purpose of this file:** This README is the shared implementation
> contract for both teammates and both Antigravity workspaces. Keep it
> in the root of the Git repository. Both agents must read it before
> making changes. The PRD contains the full product requirements; this
> README contains the practical build contract, API contract, shared
> decisions, and run instructions.

## 1. Product summary

DataMind lets users ask analytical questions in everyday language and
get answers computed from real data in Snowflake. A hosted **Google
Gemma** model performs a meaningful AI task such as proposing SQL from
the question and verified schema. The backend validates the proposed
SQL, executes only permitted read-only queries in Snowflake, and returns
actual result rows plus the exact SQL and a grounded explanation.

DataMind is **not** a general chatbot. Never invent numbers, use
hardcoded final answers, or substitute mock results for Snowflake
results.

## 2. Mandatory hackathon constraints

1.  **Snowflake must be meaningfully used.** Queries must execute
    against Snowflake at question time. A connection that is never
    queried does not satisfy the intended requirement.
2.  **Google Gemma must be meaningfully used.** Do not silently replace
    Gemma with Gemini and claim compliance. Confirm the exact hosted
    Gemma model identifier and API route are available before relying on
    them.
3.  The repository must be open source, reproducible, and documented.
4.  Never commit API keys, passwords, tokens, `.env` files, private
    data, or generated credentials.
5.  Every successful answer must expose the exact SQL that actually ran
    and results returned by Snowflake.
6.  Unsafe, malformed, ambiguous, unsupported, and empty-result cases
    must be handled honestly.

## 3. Shared technology decisions

-   **IDE:** Google Antigravity
-   **OS:** Windows
-   **Backend:** Python + FastAPI
-   **Frontend:** React + Vite
-   **Styling:** Tailwind CSS
-   **AI:** Hosted Google Gemma API; no Ollama/local model download
    planned
-   **Database:** Snowflake sample database `SNOWFLAKE_SAMPLE_DATA`,
    initially schema `TPCH_SF1`
-   **SQL parsing/validation:** `sqlglot` plus explicit table/column
    allowlists and read-only restrictions
-   **Charts:** Recharts, only after core requirements work
-   **Version control:** Git + GitHub
-   **Local frontend URL:** `http://localhost:5173`
-   **Local backend URL:** `http://localhost:8000`
-   **Health endpoint:** `GET http://localhost:8000/health`
-   **Main endpoint:** `POST http://localhost:8000/api/ask`

### Dataset scope for the first version

Start with only these verified Snowflake TPC-H tables:

-   `SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.CUSTOMER`
-   `SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS`
-   `SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.LINEITEM`

**Important:** These names are the planned initial scope. The backend
developer must verify that the tables and columns are accessible in the
team's Snowflake account. Use actual discovered schema when prompting
Gemma; never assume a column exists without checking.

## 4. Repository structure

Use this layout unless both teammates agree to a change and update this
README first.

``` text
DataMind/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── schemas.py
│   │   ├── gemma_service.py
│   │   ├── schema_service.py
│   │   ├── sql_validator.py
│   │   ├── snowflake_service.py
│   │   └── answer_service.py
│   ├── tests/
│   │   ├── test_health.py
│   │   └── test_sql_validator.py
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── .env.example
├── docs/
│   ├── ARCHITECTURE.md
│   └── TEST_CASES.md
├── .gitignore
├── LICENSE
└── README.md
```

The structure can be adapted if Antigravity has already created a
sensible equivalent. Do not duplicate modules or rename files casually.
If a path changes, update imports, tests, and this README in the same
change.

## 5. Team ownership

### Member A --- Backend, AI and data

Owns: - Snowflake account/warehouse setup and access verification -
Python virtual environment and backend dependencies - Hosted Gemma
access smoke test - Schema discovery for allowed tables - SQL generation
prompt and structured parsing - SQL validator and safety tests -
Snowflake execution service - `POST /api/ask` orchestration and API
contract - Query IDs, elapsed time, error handling and backend
documentation

### Member B --- Frontend, UX and testing coordination

Owns: - React/Vite setup - Dashboard layout and accessible components -
Question input and example questions - Loading, success, empty and error
states - Results table and exact SQL/evidence panel - API client calling
the backend only - Optional chart after core integration - End-to-end
question suite, demo flow, screenshots/recording and README polish

### Shared ownership

Both members own: - Reviewing this README and the PRD - Integrating
early and testing against real Snowflake results - Checking that no
credentials are committed - Verifying unseen questions and failure
cases - Preparing the demo and being able to explain the architecture

## 6. Integration contract --- do not change casually

The frontend and backend must agree on this contract before parallel
implementation.

### Request

`POST /api/ask`

``` json
{
  "question": "What are the five most expensive orders?"
}
```

### Successful response

``` json
{
  "status": "success",
  "question": "What are the five most expensive orders?",
  "sql": "SELECT ...",
  "columns": ["ORDERKEY", "TOTALPRICE"],
  "rows": [[1001, 123.45]],
  "explanation": "The query sorts orders by total price and returns the five highest-priced rows.",
  "assumptions": [],
  "row_count": 1,
  "elapsed_ms": 1234,
  "query_id": "actual Snowflake query ID when available"
}
```

The values above are illustrative placeholders only. The application
must never hardcode this response as final data.

### Non-success response

``` json
{
  "status": "unsupported",
  "message": "This dataset does not contain the information needed to answer that question.",
  "sql": null,
  "columns": [],
  "rows": [],
  "assumptions": []
}
```

Use appropriate HTTP status codes where useful, but keep the response
shape predictable. The frontend must handle at least `success`,
`clarification_required`, `unsupported`, and `error`.

### API rules

-   The frontend calls only FastAPI. It must never call Gemma or
    Snowflake directly.
-   API keys and Snowflake credentials stay on the backend.
-   `sql` must be the exact validated SQL executed---not a cleaned-up or
    regenerated approximation.
-   `rows`, `columns`, `row_count`, `elapsed_ms`, and `query_id` must be
    based on actual execution metadata.
-   Never return a successful response if SQL execution failed.
-   Do not include passwords, API keys, raw stack traces, or secrets in
    error messages.

## 7. Environment configuration

Create local `.env` files from the example templates. Never put real
values in the templates or commit real `.env` files.

### Backend `backend/.env.example`

``` dotenv
GEMMA_API_KEY=
GEMMA_MODEL=
SNOWFLAKE_ACCOUNT=
SNOWFLAKE_USER=
SNOWFLAKE_PASSWORD=
SNOWFLAKE_WAREHOUSE=
SNOWFLAKE_DATABASE=SNOWFLAKE_SAMPLE_DATA
SNOWFLAKE_SCHEMA=TPCH_SF1
FRONTEND_ORIGIN=http://localhost:5173
QUERY_TIMEOUT_SECONDS=30
MAX_RESULT_ROWS=100
```

The code and documentation must use the same variable names. Confirm the
chosen Gemma SDK's expected configuration and supported model ID before
implementing the provider call. Never guess that every Gemma model is
available through every API.

### Frontend `frontend/.env.example`

``` dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Only public, non-secret frontend configuration belongs in a `VITE_`
variable. Never put provider or Snowflake credentials in frontend
variables.

## 8. AI-to-SQL execution flow

1.  Validate the incoming question (not empty; enforce a reasonable
    length limit).
2.  Retrieve verified schema context for the allowed tables.
3.  Ask hosted Gemma to propose one SQL query and return structured
    output containing SQL, rationale and assumptions/clarification
    status.
4.  Parse the model output. Reject malformed output.
5.  Validate with `sqlglot` and additional explicit policy checks:
    -   Exactly one statement
    -   Read-only `SELECT` only
    -   No DDL/DML, stored procedures, or multi-statement execution
    -   Only allowlisted tables and columns
    -   Enforce result-row cap and execution timeout
    -   Use a least-privilege/read-only Snowflake role where possible
6.  Execute the validated SQL in Snowflake.
7.  Collect actual columns, bounded rows, elapsed time and query ID when
    available.
8.  Create a concise explanation based on the executed SQL and returned
    evidence.
9.  Return structured JSON to the frontend.
10. Display the answer, result table, exact SQL, assumptions and
    execution metadata.

A SQL parser is not a complete security boundary by itself. Do not rely
only on checking whether a query begins with `SELECT`.

## 9. Frontend requirements

The MVP should have one primary dashboard screen containing: - DataMind
title and short product explanation - Natural-language question input
and Ask button - Example questions - Loading indicator and disabled
submit button while waiting - Plain-language explanation/status -
Results table with actual returned columns and rows - Expandable or
clearly visible exact executed SQL panel - Query ID and elapsed time
when available - Clear unsupported, clarification, empty-result and
error states - Optional chart only when the returned data is suitable

Keep the interface clean and readable. Do not build authentication, file
uploads, a marketing landing page, complex animations, or unrelated
features during the core sprint.

## 10. Testing requirements

At minimum, test these types: 1. Count records 2. Sort and limit 3.
Filter by date or numeric value 4. Grouped aggregate 5. Join CUSTOMER
and ORDERS 6. Join ORDERS and LINEITEM 7. Top customers by aggregated
order value 8. Ambiguous question 9. Empty result 10. Unsupported
question such as weather 11. Invalid/malformed Gemma response 12.
`DROP`, `DELETE`, `UPDATE`, multiple statements and disallowed table
attempts 13. Provider quota/authentication failure 14. Snowflake timeout
or unavailable warehouse

For each meaningful data question, compare results with independently
run SQL or another trusted calculation. Never mark a test as passed
unless it was actually run.

## 11. Windows setup and run commands

### Backend setup

Run from the project root:

``` powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If Python 3.13 compatibility problems occur with a required dependency,
try Python 3.12 or 3.11 side-by-side. Do not uninstall Python 3.13
without a reason.

### Run backend

Run from `backend/` after configuration is complete:

``` powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --port 8000
```

If the final implementation uses `backend/main.py` rather than
`backend/app/main.py`, adjust the command and this README together.

Test health in a browser or terminal:

``` text
http://localhost:8000/health
```

### Frontend setup

Open a second terminal:

``` powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

Keep the frontend and backend running in separate terminals.

## 12. Antigravity workflow

Both teammates should: 1. Open the same Git repository or their own
clone of it. 2. Read this README and the full PRD before editing. 3.
Give Antigravity one phase prompt at a time. 4. Ask it to inspect
existing files before editing. 5. Run the suggested commands and tests
before moving to the next phase. 6. Review the diff and ensure the agent
did not create duplicate files, mock final results, or expose secrets.
7. Commit small working changes and push to the shared GitHub
repository. 8. Pull/rebase changes before beginning work that depends on
the other member's files.

**Recommended branch split:** - Member A:
`feature/backend-ai-snowflake` - Member B:
`feature/frontend-dashboard` - Integrate through pull requests or
deliberate commits to a shared integration branch.

Do not have both agents edit the same files concurrently. Agree on API
contract changes first and update this README if the contract changes.

### Prompt to give either Antigravity agent first

``` text
Read the root README.md and the DataMind PRD completely before editing any files.
Treat them as the source of truth for requirements, architecture, folder structure,
environment variable names, API contract, and scope.

First inspect the existing repository and report:
1. Current folder structure and changed files
2. Which requirements are already implemented
3. Which phase should be done next
4. Any conflict between existing code and the README/PRD

Do not overwrite working code, create duplicate modules, invent API keys,
hardcode final answers, use mocked final results, or silently substitute Gemini
for the required hosted Gemma model. Make only the changes for the approved
phase, run the relevant tests, and report the exact commands and results.
```

## 13. 12-hour priorities

  -----------------------------------------------------------------------
  Time                                Target
  ----------------------------------- -----------------------------------
  0--1 hour                           Environment, repository, Gemma
                                      access smoke test, Snowflake
                                      account and direct SQL

  1--3 hours                          Backend schema context, SQL
                                      generation, validation and
                                      Snowflake execution

  3--5 hours                          First complete question-to-result
                                      flow; frontend calls real API

  5--7 hours                          Verify joins/aggregates and ground
                                      explanations in real results

  7--9 hours                          Test safety, ambiguity, empty
                                      results, errors and unseen
                                      questions

  9--10.5 hours                       README, architecture, attribution,
                                      dependency pins and clean setup

  10.5--12 hours                      Demo, evidence, critical bug fixes
                                      and final submission
  -----------------------------------------------------------------------

If behind schedule, remove charts and optional features first. Do not
remove meaningful Gemma use, real Snowflake querying, validation,
visible SQL evidence, or submission documentation.

## 14. Definition of done

-   [ ] Hosted Gemma is genuinely used for a central task and its exact
    model is documented.
-   [ ] Snowflake is queried at question time.
-   [ ] The UI shows actual results and the exact SQL that ran.
-   [ ] Unsafe SQL is rejected before execution.
-   [ ] At least 10 questions have been tested, including joins and
    aggregations.
-   [ ] Ambiguous, unsupported, empty and error cases are handled
    honestly.
-   [ ] Repository has an open-source licence, README, dependency
    details and dataset attribution.
-   [ ] No credentials or secrets are committed.
-   [ ] A clean-start demo and backup recording are ready.
-   [ ] Both teammates can explain the architecture and the roles of
    Gemma and Snowflake.

------------------------------------------------------------------------

**Final rule:** Correctness and proof before polish. If the code,
README, and PRD disagree, pause and resolve the discrepancy with both
teammates before continuing.
