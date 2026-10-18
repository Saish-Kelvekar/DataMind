/**
 * DEVELOPMENT FIXTURES ONLY
 * 
 * IMPORTANT: These fixtures are provided solely for UI layout verification during 
 * Phase B1 development when the FastAPI backend is running offline or before end-to-end integration.
 * 
 * In accordance with Hackathon constraints:
 * - Real demo execution MUST query Snowflake and hosted Google Gemma through POST /api/ask.
 * - These fixtures are NEVER presented as live execution data.
 * - The UI explicitly flags when DEV FIXTURE mode is active.
 */

export const DEV_FIXTURES = {
  expensive_orders: {
    status: 'success',
    question: 'What are the five most expensive orders?',
    sql: 'SELECT O_ORDERKEY, O_CUSTKEY, O_ORDERDATE, O_TOTALPRICE\nFROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS\nORDER BY O_TOTALPRICE DESC\nLIMIT 5;',
    columns: ['O_ORDERKEY', 'O_CUSTKEY', 'O_ORDERDATE', 'O_TOTALPRICE'],
    rows: [
      [3400051, 73735, '1995-10-11', 555285.16],
      [4752544, 111104, '1995-07-26', 548048.80],
      [1635392, 102004, '1995-12-19', 546879.01],
      [4267715, 137456, '1995-02-14', 544089.40],
      [3588965, 87405, '1995-05-18', 540847.60]
    ],
    explanation: 'The query retrieves the 5 highest-value orders from the ORDERS table, sorted in descending order of total price.',
    assumptions: ['Assuming O_TOTALPRICE reflects net order amount in USD.'],
    row_count: 5,
    elapsed_ms: 684,
    query_id: '01b7a20c-0001-c89b-0000-0001d8e2786a',
    is_fixture: true
  },

  customer_count: {
    status: 'success',
    question: 'How many customers are in the dataset?',
    sql: 'SELECT COUNT(*) AS TOTAL_CUSTOMERS\nFROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.CUSTOMER;',
    columns: ['TOTAL_CUSTOMERS'],
    rows: [[150000]],
    explanation: 'The query computes a full record count on the CUSTOMER table in the TPC-H SF1 sample dataset.',
    assumptions: [],
    row_count: 1,
    elapsed_ms: 342,
    query_id: '01b7a20e-0001-c89b-0000-0001d8e2794e',
    is_fixture: true
  },

  order_status_agg: {
    status: 'success',
    question: 'What is the total order value grouped by order status?',
    sql: 'SELECT O_ORDERSTATUS, COUNT(*) AS ORDER_COUNT, SUM(O_TOTALPRICE) AS TOTAL_SALES\nFROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS\nGROUP BY O_ORDERSTATUS\nORDER BY TOTAL_SALES DESC;',
    columns: ['O_ORDERSTATUS', 'ORDER_COUNT', 'TOTAL_SALES'],
    rows: [
      ['F', 729413, 1108234856.42],
      ['O', 731078, 1110543209.18],
      ['P', 39509, 59981294.10]
    ],
    explanation: 'Orders are aggregated by status code (F: Fulfilled, O: Open, P: Pending), calculating total order volume and cumulative monetary value.',
    assumptions: ['Status codes follow TPC-H standard: F (Fulfilled), O (Open), P (Pending).'],
    row_count: 3,
    elapsed_ms: 812,
    query_id: '01b7a210-0001-c89b-0000-0001d8e27a12',
    is_fixture: true
  },

  empty_results: {
    status: 'success',
    question: 'Show orders with a total price exceeding $10,000,000.',
    sql: 'SELECT O_ORDERKEY, O_TOTALPRICE\nFROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS\nWHERE O_TOTALPRICE > 10000000\nLIMIT 100;',
    columns: ['O_ORDERKEY', 'O_TOTALPRICE'],
    rows: [],
    explanation: 'No orders met the condition of exceeding $10,000,000 in total price. The maximum single order price in TPC-H SF1 is approximately $555,285.',
    assumptions: [],
    row_count: 0,
    elapsed_ms: 290,
    query_id: '01b7a212-0001-c89b-0000-0001d8e27ab8',
    is_fixture: true
  },

  unsupported_weather: {
    status: 'unsupported',
    message: 'The requested question asks for weather data. DataMind is scoped strictly to the Snowflake TPC-H SF1 benchmark dataset containing CUSTOMER, ORDERS, and LINEITEM tables.',
    sql: null,
    columns: [],
    rows: [],
    assumptions: ['Dataset scope is restricted to TPCH_SF1 business data.'],
    is_fixture: true
  },

  clarification_needed: {
    status: 'clarification_required',
    message: 'The term "best items" is ambiguous. Please specify whether you want items ranked by total quantity sold, highest extended price, or lowest applied discount.',
    sql: null,
    columns: [],
    rows: [],
    assumptions: ['Requires metric specification (quantity vs. revenue vs. frequency).'],
    is_fixture: true
  },

  error_case: {
    status: 'error',
    message: 'Snowflake query execution timed out after 30 seconds. Warehouse WH_DEMO was busy or suspended.',
    sql: 'SELECT * FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.LINEITEM LIMIT 5000000;',
    columns: [],
    rows: [],
    elapsed_ms: 30004,
    query_id: '01b7a215-0001-c89b-0000-0001d8e27c00',
    is_fixture: true
  }
};
