# DataMind Frontend — Talk to Your Data

A modern SaaS analytical client for **DataMind**, built with **React 19**, **Vite 8**, and **Tailwind CSS v4**.

DataMind enables business and operations users to query Snowflake analytical data (`SNOWFLAKE_SAMPLE_DATA.TPCH_SF1`) in natural language, inspect verifiable SQL evidence validated by `sqlglot`, and explore actual returned rows with audit metadata.

---

## 1. Quick Start & Setup

### Prerequisites
- **Node.js**: v20+ recommended
- **npm**: v10+

### Installation
From the repository root or `frontend/` directory:
```bash
cd frontend
npm install
```

### Environment Configuration
The frontend configuration is managed via `.env` (or `.env.local`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the local DataMind FastAPI backend. |
| `VITE_ENABLE_DEV_FIXTURES` | `false` | When `false` (default for demo/production), the UI strictly queries the real backend. Set to `true` only for offline UI mockup development. |

Example `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ENABLE_DEV_FIXTURES=false
```

---

## 2. Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts local Vite development server with HMR on `http://localhost:5173`. |
| `npm test` | Runs the automated test suites using the native Node.js test runner (`node --test tests/*.test.js`). |
| `npm run lint` | Runs `oxlint` static code analysis across all source files. |
| `npm run build` | Compiles an optimized production bundle to `dist/`. |
| `npm run preview` | Locally serves the production build. |

---

## 3. Architecture & Evidence Traceability

```
frontend/
├── src/
│   ├── components/
│   │   ├── AppShell.jsx         # SaaS layout shell: sidebar, top navbar, responsive mobile drawer
│   │   ├── Sidebar.jsx          # 256px fixed sidebar, workspace switcher, multi-tab routing, user profile
│   │   ├── TopNavbar.jsx        # Breadcrumbs, live agent health pill, preview & deploy actions
│   │   ├── QuestionInput.jsx    # Accessible natural language textarea, keyboard shortcuts (Enter/Shift+Enter/Esc)
│   │   ├── ExampleChips.jsx     # One-click verified analytical query prompts
│   │   ├── ExplanationCard.jsx  # Grounded plain-language summary of returned results
│   │   ├── ResultsTable.jsx     # Dynamic table with column headers from API, sorting, pagination, and raw-value tooltips
│   │   ├── SqlViewer.jsx        # Numbered SQL viewer, wrap/unwrap toggle, copy button, AST policy badge, assumptions
│   │   ├── QueryMetadata.jsx    # Snowflake Query ID, execution duration (ms), row count, warehouse indicator
│   │   ├── DataVisualizer.jsx   # Dynamic responsive SVG bar chart for multi-row numeric result sets
│   │   ├── StatusAlert.jsx      # Specialized alerts for clarification_required, unsupported, and retryable errors
│   │   ├── SchemaReference.jsx  # TPC-H SF1 tables (CUSTOMER, ORDERS, LINEITEM) schema cheat-sheet
│   │   └── LoadingState.jsx     # Animated skeleton with elapsed time counter
│   ├── services/
│   │   ├── api.js               # Contract client (POST /api/ask, GET /health) with 35s timeout abort signal
│   │   └── fixtures.js          # Mock data strictly guarded by VITE_ENABLE_DEV_FIXTURES
│   ├── App.jsx                  # Main application controller and tab router
│   ├── index.css                # Tailwind CSS v4 design tokens and utilities
│   └── main.jsx                 # Application entrypoint
└── tests/
    ├── api.test.js              # Phase B2 API contract compliance tests
    └── quality_checks.test.js   # Phase B4 edge-case scenario tests
```

---

## 4. Phase B4 Quality Checks & Test Matrix

All 18 automated tests across 2 test suites run via `npm test` (`node --test tests/*.test.js`):

| # | Test Scenario | Verified Behavior | Status |
| :-: | :--- | :--- | :-: |
| 1 | **Normal multi-row answer** | Correctly parses columns, rows, explanations, elapsed time, and query ID. | PASS |
| 2 | **Successful zero-row answer** | Distinguishes valid empty result from error; shows executed SQL and query ID without error styling. | PASS |
| 3 | **Clarification required** | Renders amber guidance prompt asking user to clarify ambiguity (e.g. metric for 'best'). | PASS |
| 4 | **Unsupported question** | Surfaces clear boundary notice explaining schema scope without hallucinating. | PASS |
| 5 | **Structured backend error** | Surfaces backend execution errors (e.g., Snowflake warehouse timeout) with query ID. | PASS |
| 6 | **Backend offline / drop** | Displays clear offline notification with backend startup command (`uvicorn app.main:app`). | PASS |
| 7 | **Malformed response** | Defensively handles missing columns, missing rows, and non-JSON payloads without UI crashes. | PASS |
| 8 | **Slow request & timeout** | Client enforces 35s timeout abort signal and clears timers in `finally` block. | PASS |
| 9 | **Rapid duplicate clicks** | Prevents concurrent duplicate submissions while request is in-flight. | PASS |
| 10 | **Long SQL & wide tables** | Horizontal overflow protection (`overflow-x-auto`) and text truncation with tooltips prevent layout breakage. | PASS |
| 11 | **Real API enforcement** | Confirms `VITE_ENABLE_DEV_FIXTURES` is `false`, ensuring real backend calls. | PASS |

---

## 5. Live Demo Flow

To demonstrate DataMind to stakeholders or evaluators:

1. **Verify Backend Health:**
   - Look at the top-right header pill:
     - **Green ("Agent Ready")**: Backend `/health` reports healthy connection.
     - **Amber ("Agent Offline")**: Backend not detected; click "Retry" or start backend.
2. **Step 1: Ask a Standard Analytical Question**
   - Click the chip: *"What are the five most expensive orders?"*
   - Click **Ask DataMind** (or press `Enter`).
   - Observe the loading skeleton with elapsed execution timer.
   - Inspect the **Executive Summary**, the **Results Table** (try sorting columns, hovering over numbers to view raw values, and paginating), and the **Dynamic SVG Chart**.
   - Inspect the **Exact Executed SQL** in the evidence panel, toggle text wrapping, and click **Copy SQL**.
3. **Step 2: Demonstrate Zero-Row Distinction**
   - Submit: *"Find orders with total price exceeding 10,000,000 USD"*
   - Observe the distinct **Zero Rows Found** state showing query success, elapsed execution time, query ID, and the exact executed `WHERE O_TOTALPRICE > 10000000` SQL without error styling.
4. **Step 3: Demonstrate Clarification-Required Guardrail**
   - Submit: *"Show best customers"*
   - Observe the amber clarification banner explaining that the metric is ambiguous (e.g., account balance vs. total orders).
5. **Step 4: Demonstrate Out-of-Domain / Unsupported Query**
   - Submit: *"What is the weather forecast for tomorrow?"*
   - Observe the polite rejection explaining that weather data is outside the TPC-H SF1 analytical domain.
6. **Step 5: Audit History & Multi-Tab Views**
   - Click **Audit History** in the sidebar to review all executed queries in the session.
   - Click **Data Sources** or **Guardrails** in the sidebar to view active schema definitions and security policies.

---

## 6. Security & Credential Hygiene

- **Zero Credentials in Bundles:** Snowflake credentials, Google Cloud API keys, and database passwords reside strictly in the backend `.env` and are never imported, referenced, or bundled into Vite/React client assets.
- **AST Verification:** Every query executed is validated by `sqlglot` on the backend to be a single read-only `SELECT` statement against approved tables before reaching Snowflake.
- **Git Hygiene:** Local `.env` and `.env.*` files are ignored in `.gitignore`.

---

## 7. Known Limitations

1. **Snowflake Warehouse Cold Start:** If the Snowflake virtual warehouse is suspended, the first query may take 4–8 seconds while compute resources spin up.
2. **Schema Scope:** The current release PS1 targets `SNOWFLAKE_SAMPLE_DATA.TPCH_SF1` tables (`CUSTOMER`, `ORDERS`, `LINEITEM`). Other tables or cross-database joins are rejected by the backend guardrails.
3. **Playwright Automation in Headless Sandbox:** Automated browser testing requiring Playwright driver downloads may be blocked by offline sandbox network policies; verified via native Node.js contract & integration suites.
