# Pairadox — DataMind: Talk to Your Data

**ZeroDay OSS Hacktoberfest 2026 · IIIT Dharwad · PS1**

DataMind lets users ask analytical questions in natural language and receive answers computed from real Snowflake data (`SNOWFLAKE_SAMPLE_DATA.TPCH_SF1`). A hosted Google Gemma model translates questions into schema-aware SQL, `sqlglot` validates strict read-only SELECT permissions, and results are presented in a transparent analytical workspace with full query provenance and execution evidence.

## Architecture

- **Frontend:** React + Vite + Tailwind CSS (Port 5173)
- **Backend:** Python + FastAPI + Uvicorn (Port 8000)
- **AI Model:** Hosted Google Gemma
- **Database:** Snowflake (`TPCH_SF1.CUSTOMER`, `ORDERS`, `LINEITEM`)
- **SQL Guardrail:** `sqlglot` AST validation + table allowlist
