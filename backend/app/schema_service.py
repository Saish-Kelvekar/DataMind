"""Schema management and context provider for DataMind.

Maintains verified metadata, relationships, and column allowlists for approved
Snowflake TPC-H sample tables: CUSTOMER, ORDERS, and LINEITEM.
"""

from typing import Dict, List, Optional, Set
from pydantic import BaseModel, Field

from app.config import get_settings


class ColumnDef(BaseModel):
    name: str
    data_type: str
    description: str = ""


class TableDef(BaseModel):
    name: str
    description: str
    columns: List[ColumnDef]
    primary_key: str
    foreign_keys: Dict[str, str] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Verified TPC-H Schema Baseline
# ---------------------------------------------------------------------------

TPCH_VERIFIED_TABLES: Dict[str, TableDef] = {
    "CUSTOMER": TableDef(
        name="CUSTOMER",
        description="Customer demographics and account balance records",
        primary_key="C_CUSTKEY",
        columns=[
            ColumnDef(name="C_CUSTKEY", data_type="NUMBER", description="Unique customer identifier"),
            ColumnDef(name="C_NAME", data_type="TEXT", description="Customer full name"),
            ColumnDef(name="C_ADDRESS", data_type="TEXT", description="Customer street address"),
            ColumnDef(name="C_NATIONKEY", data_type="NUMBER", description="Foreign key to nation"),
            ColumnDef(name="C_PHONE", data_type="TEXT", description="Customer phone number"),
            ColumnDef(name="C_ACCTBAL", data_type="NUMBER", description="Current account balance"),
            ColumnDef(name="C_MKTSEGMENT", data_type="TEXT", description="Market segment (e.g. BUILDING, AUTOMOBILE, MACHINERY, HOUSEHOLD, FURNITURE)"),
            ColumnDef(name="C_COMMENT", data_type="TEXT", description="General comments"),
        ],
    ),
    "ORDERS": TableDef(
        name="ORDERS",
        description="Orders placed by customers",
        primary_key="O_ORDERKEY",
        foreign_keys={"O_CUSTKEY": "CUSTOMER.C_CUSTKEY"},
        columns=[
            ColumnDef(name="O_ORDERKEY", data_type="NUMBER", description="Unique order identifier"),
            ColumnDef(name="O_CUSTKEY", data_type="NUMBER", description="Customer key who placed the order"),
            ColumnDef(name="O_ORDERSTATUS", data_type="TEXT", description="Order status: 'O' (open), 'F' (fulfilled), 'P' (pending)"),
            ColumnDef(name="O_TOTALPRICE", data_type="NUMBER", description="Total order amount"),
            ColumnDef(name="O_ORDERDATE", data_type="DATE", description="Date order was placed (1992 to 1998)"),
            ColumnDef(name="O_ORDERPRIORITY", data_type="TEXT", description="Order priority level (e.g. 1-URGENT, 2-HIGH, 3-MEDIUM, 4-NOT SPECIFIED, 5-LOW)"),
            ColumnDef(name="O_CLERK", data_type="TEXT", description="Clerk identifier"),
            ColumnDef(name="O_SHIPPRIORITY", data_type="NUMBER", description="Shipping priority (0)"),
            ColumnDef(name="O_COMMENT", data_type="TEXT", description="Order comments"),
        ],
    ),
    "LINEITEM": TableDef(
        name="LINEITEM",
        description="Line items and product details for each order",
        primary_key="L_ORDERKEY, L_LINENUMBER",
        foreign_keys={"L_ORDERKEY": "ORDERS.O_ORDERKEY"},
        columns=[
            ColumnDef(name="L_ORDERKEY", data_type="NUMBER", description="Order key referencing ORDERS"),
            ColumnDef(name="L_PARTKEY", data_type="NUMBER", description="Part identifier"),
            ColumnDef(name="L_SUPPKEY", data_type="NUMBER", description="Supplier identifier"),
            ColumnDef(name="L_LINENUMBER", data_type="NUMBER", description="Line number within order"),
            ColumnDef(name="L_QUANTITY", data_type="NUMBER", description="Item quantity ordered"),
            ColumnDef(name="L_EXTENDEDPRICE", data_type="NUMBER", description="Extended price (quantity * price)"),
            ColumnDef(name="L_DISCOUNT", data_type="NUMBER", description="Discount rate (e.g. 0.05 for 5%)"),
            ColumnDef(name="L_TAX", data_type="NUMBER", description="Tax rate"),
            ColumnDef(name="L_RETURNFLAG", data_type="TEXT", description="Return flag: 'R' (returned), 'A' (accepted), 'N' (not returned)"),
            ColumnDef(name="L_LINESTATUS", data_type="TEXT", description="Line status: 'O' (open), 'F' (fulfilled)"),
            ColumnDef(name="L_SHIPDATE", data_type="DATE", description="Shipment date"),
            ColumnDef(name="L_COMMITDATE", data_type="DATE", description="Committed delivery date"),
            ColumnDef(name="L_RECEIPTDATE", data_type="DATE", description="Customer receipt date"),
            ColumnDef(name="L_SHIPINSTRUCT", data_type="TEXT", description="Shipping instructions"),
            ColumnDef(name="L_SHIPMODE", data_type="TEXT", description="Shipping mode (e.g. AIR, SHIP, TRUCK, MAIL, REG AIR, FOB, RAIL)"),
            ColumnDef(name="L_COMMENT", data_type="TEXT", description="Lineitem comment"),
        ],
    ),
}


class SchemaService:
    """Provides verified schema context, table allowlists, and column validations."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.tables = TPCH_VERIFIED_TABLES

    def get_allowed_tables(self) -> Set[str]:
        """Return set of uppercase approved table names."""
        return set(self.tables.keys())

    def get_allowed_columns_for_table(self, table_name: str) -> Set[str]:
        """Return set of uppercase column names for a specific table."""
        tbl = self.tables.get(table_name.upper())
        if not tbl:
            return set()
        return {c.name.upper() for c in tbl.columns}

    def get_all_allowed_columns(self) -> Set[str]:
        """Return union of all approved column names across all approved tables."""
        all_cols: Set[str] = set()
        for tbl in self.tables.values():
            all_cols.update(c.name.upper() for c in tbl.columns)
        return all_cols

    def is_table_allowed(self, table_name: str) -> bool:
        """Check if table name is in approved allowlist."""
        return table_name.upper() in self.get_allowed_tables()

    def is_column_allowed(self, column_name: str, table_name: Optional[str] = None) -> bool:
        """Check if column name is allowed, optionally checking against specific table."""
        col = column_name.upper()
        if table_name:
            return col in self.get_allowed_columns_for_table(table_name)
        return col in self.get_all_allowed_columns()

    def get_prompt_schema_context(self) -> str:
        """Format the verified schema and relationships for Google Gemma model prompt."""
        db = self.settings.snowflake_database.upper()
        schema = self.settings.snowflake_schema.upper()

        lines = [
            f"Database Context: {db}.{schema}",
            "APPROVED TABLES AND COLUMNS:\n",
        ]

        for tbl_name, tbl in sorted(self.tables.items()):
            col_strs = [f"  {c.name} {c.data_type} -- {c.description}" for c in tbl.columns]
            lines.append(f"Table: {db}.{schema}.{tbl_name} (Primary Key: {tbl.primary_key})")
            lines.append("Columns:\n" + "\n".join(col_strs))
            if tbl.foreign_keys:
                fk_strs = [f"  {col} -> {ref}" for col, ref in tbl.foreign_keys.items()]
                lines.append("Relationships:\n" + "\n".join(fk_strs))
            lines.append("")

        lines.append("JOIN RULES:")
        lines.append("- To join CUSTOMER and ORDERS: CUSTOMER.C_CUSTKEY = ORDERS.O_CUSTKEY")
        lines.append("- To join ORDERS and LINEITEM: ORDERS.O_ORDERKEY = LINEITEM.L_ORDERKEY")
        lines.append("- Do not invent non-existent relationships, tables, or columns.")

        return "\n".join(lines)


# Singleton instance
schema_service = SchemaService()
