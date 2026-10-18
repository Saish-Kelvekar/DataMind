"""Diagnostic and verification script for Snowflake connectivity and schema discovery.

Runs a harmless connection diagnostic, verifies sample data access, and prints
discovered schema metadata. NEVER logs or displays credentials or passwords.
"""

from pathlib import Path
import sys
from dotenv import load_dotenv

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Load local backend/.env
load_dotenv(backend_dir / ".env")

from app.config import get_settings
from app.snowflake_service import (
    SnowflakeAuthError,
    SnowflakePermissionError,
    SnowflakeService,
    SnowflakeServiceError,
    SnowflakeTimeoutError,
    SnowflakeWarehouseError,
)


def run_diagnostics() -> bool:
    settings = get_settings()

    print("=" * 65)
    print("DATAMIND — SNOWFLAKE CONNECTION & SCHEMA DIAGNOSTIC")
    print("=" * 65)
    print(f"Account:    {settings.snowflake_account or '[NOT CONFIGURED]'}")
    print(f"User:       {settings.snowflake_user or '[NOT CONFIGURED]'}")
    print(f"Password:   {'[CONFIGURED - HIDDEN]' if settings.snowflake_password else '[NOT CONFIGURED]'}")
    print(f"Warehouse:  {settings.snowflake_warehouse}")
    print(f"Database:   {settings.snowflake_database}")
    print(f"Schema:     {settings.snowflake_schema}")
    print("-" * 65)

    if not (settings.snowflake_account and settings.snowflake_user and settings.snowflake_password):
        print("ERROR: Incomplete Snowflake credentials in backend/.env.")
        print("Please configure SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, and SNOWFLAKE_PASSWORD.")
        return False

    service = SnowflakeService(settings)

    # Step 1: Harmless Connection Test
    print("Step 1: Testing live connection with diagnostic query...")
    try:
        diag = service.test_connection()
        print(" -> SUCCESS: Connected to Snowflake!")
        print(f"    Current User:      {diag['user']}")
        print(f"    Current Role:      {diag['role']}")
        print(f"    Current Database:  {diag['database']}")
        print(f"    Current Schema:    {diag['schema']}")
        print(f"    Current Warehouse: {diag['warehouse']}")
        print(f"    Snowflake Version: {diag['version']}")
        print(f"    Diagnostic QueryID:{diag['query_id']}")
        print(f"    Latency:           {diag['elapsed_ms']} ms")
    except SnowflakeAuthError as exc:
        print(f" -> AUTHENTICATION ERROR: {exc}")
        return False
    except SnowflakeWarehouseError as exc:
        print(f" -> WAREHOUSE ERROR: {exc}")
        return False
    except SnowflakePermissionError as exc:
        print(f" -> PERMISSION ERROR: {exc}")
        return False
    except SnowflakeTimeoutError as exc:
        print(f" -> TIMEOUT ERROR: {exc}")
        return False
    except SnowflakeServiceError as exc:
        print(f" -> CONNECTION FAILED: {exc}")
        return False
    except Exception as exc:
        print(f" -> UNEXPECTED ERROR: {type(exc).__name__}: {exc}")
        return False

    print("-" * 65)

    # Step 2: Schema Discovery for Approved Tables
    print("Step 2: Discovering schema for approved tables (CUSTOMER, ORDERS, LINEITEM)...")
    try:
        discovered = service.discover_schema()
        found_tables = list(discovered.tables.keys())
        print(f" -> Discovered {len(found_tables)} approved table(s): {', '.join(found_tables)}")

        for table_name, schema in discovered.tables.items():
            col_list = [f"{c.name} ({c.data_type})" for c in schema.columns]
            print(f"    Table {table_name}: {len(schema.columns)} columns")
            print(f"      Sample columns: {', '.join(col_list[:6])}...")

        if not found_tables:
            print(" -> WARNING: No tables found in target schema. Check permissions on SNOWFLAKE_SAMPLE_DATA.")
            return False
    except Exception as exc:
        print(f" -> SCHEMA DISCOVERY FAILED: {exc}")
        return False

    print("-" * 65)

    # Step 3: Harmless Real Read-Only Count Query
    print("Step 3: Running bounded count query on verified CUSTOMER table...")
    try:
        count_sql = f"SELECT COUNT(*) AS TOTAL_CUSTOMERS FROM {settings.snowflake_database}.{settings.snowflake_schema}.CUSTOMER"
        res = service.execute_query(count_sql)
        print(" -> SUCCESS: Query executed successfully!")
        print(f"    Columns:    {res.columns}")
        print(f"    Rows:       {res.rows}")
        print(f"    Query ID:   {res.query_id}")
        print(f"    Elapsed:    {res.elapsed_ms} ms")
    except Exception as exc:
        print(f" -> QUERY EXECUTION FAILED: {exc}")
        return False

    print("=" * 65)
    print("Snowflake connectivity, schema discovery, and query execution fully verified!")
    return True


if __name__ == "__main__":
    success = run_diagnostics()
    sys.exit(0 if success else 1)
