"""Live end-to-end integration test runner for DataMind.

Submits real analytical questions through the full pipeline:
1. Question validation.
2. Verified schema retrieval.
3. Live hosted Google Gemma SQL proposal.
4. Live sqlglot security and allowlist validation.
5. Live Snowflake execution.
6. Grounded answer and metadata display.
"""

from pathlib import Path
import sys
from dotenv import load_dotenv

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Load backend/.env
load_dotenv(backend_dir / ".env")

from app.answer_service import answer_service


def test_question(question: str) -> None:
    print("\n" + "=" * 70)
    print(f"QUESTION: \"{question}\"")
    print("=" * 70)

    resp = answer_service.answer_question(question)

    print(f"STATUS:       {resp.status.upper()}")
    if resp.message:
        print(f"MESSAGE:      {resp.message}")
    if resp.sql:
        print(f"EXECUTED SQL: {resp.sql}")
    if resp.explanation:
        print(f"EXPLANATION:  {resp.explanation}")
    if resp.assumptions:
        print(f"ASSUMPTIONS:  {resp.assumptions}")
    if resp.columns:
        print(f"COLUMNS ({len(resp.columns)}): {resp.columns}")
    if resp.rows is not None and resp.status == "success":
        print(f"ROWS RETURNED ({resp.row_count}):")
        for i, row in enumerate(resp.rows[:5]):
            print(f"  Row {i+1}: {row}")
        if len(resp.rows) > 5:
            print(f"  ... and {len(resp.rows) - 5} more rows")
    if resp.query_id:
        print(f"QUERY ID:     {resp.query_id}")
    if resp.elapsed_ms:
        print(f"ELAPSED TIME: {resp.elapsed_ms} ms")


def main() -> None:
    print("======================================================================")
    print("DATAMIND — LIVE END-TO-END PIPELINE INTEGRATION TEST")
    print("Hosted Gemma (gemma-4-26b-a4b-it) + Real Snowflake (TPCH_SF1)")
    print("======================================================================")

    # Test 1: Canonical question
    test_question("What are the five most expensive orders?")

    # Test 2: Aggregated / sorted question
    test_question("Who are the top 3 customers by account balance?")

    # Test 3: Unsupported domain question
    test_question("What is the current temperature and weather in London?")


if __name__ == "__main__":
    main()
