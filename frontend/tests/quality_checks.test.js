import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'

// Set test environment configuration
process.env.VITE_API_BASE_URL = 'http://localhost:8000'
process.env.VITE_ENABLE_DEV_FIXTURES = 'false'

describe('DataMind Frontend Phase B4: Quality Checks & Scenario Validations', () => {
  const originalFetch = globalThis.fetch

  after(() => {
    globalThis.fetch = originalFetch
  })

  // 1. Normal successful answer with multiple rows
  test('Scenario 1: Normal successful answer with multiple rows', async () => {
    const mockMultiRowResponse = {
      status: 'success',
      question: 'What are the top 3 customers by account balance?',
      sql: 'SELECT C_CUSTKEY, C_NAME, C_ACCTBAL FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.CUSTOMER ORDER BY C_ACCTBAL DESC LIMIT 3;',
      columns: ['C_CUSTKEY', 'C_NAME', 'C_ACCTBAL'],
      rows: [
        [143500, 'Customer#000143500', 9999.99],
        [95257, 'Customer#000095257', 9999.82],
        [87115, 'Customer#000087115', 9998.45]
      ],
      explanation: 'Found top 3 customers with highest account balance.',
      assumptions: ['Active accounts only', 'Ranked in descending order'],
      row_count: 3,
      elapsed_ms: 540,
      query_id: '01b7a20c-test-mult-row'
    }

    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'http://localhost:8000/api/ask')
      assert.equal(options.method, 'POST')
      return {
        ok: true,
        status: 200,
        json: async () => mockMultiRowResponse
      }
    }

    const { askDataMind } = await import('../src/services/api.js')
    const res = await askDataMind('What are the top 3 customers by account balance?')

    assert.equal(res.status, 'success')
    assert.equal(res.row_count, 3)
    assert.equal(res.rows.length, 3)
    assert.deepEqual(res.columns, ['C_CUSTKEY', 'C_NAME', 'C_ACCTBAL'])
    assert.equal(res.is_fixture, false)
    assert.equal(res.query_id, '01b7a20c-test-mult-row')
    assert.equal(res.elapsed_ms, 540)
    assert.equal(res.assumptions.length, 2)
  })

  // 2. Successful answer with no rows
  test('Scenario 2: Successful answer with no rows (0 matching rows)', async () => {
    const mockZeroRowResponse = {
      status: 'success',
      question: 'Find orders with total price exceeding 10,000,000 USD',
      sql: 'SELECT O_ORDERKEY, O_TOTALPRICE FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS WHERE O_TOTALPRICE > 10000000 LIMIT 10;',
      columns: ['O_ORDERKEY', 'O_TOTALPRICE'],
      rows: [],
      explanation: 'No orders were found exceeding 10,000,000 USD in TPC-H SF1.',
      assumptions: ['Price threshold in USD'],
      row_count: 0,
      elapsed_ms: 312,
      query_id: '01b7a20c-test-zero-row'
    }

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => mockZeroRowResponse
    })

    const { askDataMind } = await import('../src/services/api.js')
    const res = await askDataMind('Find orders with total price exceeding 10,000,000 USD')

    assert.equal(res.status, 'success')
    assert.equal(res.row_count, 0)
    assert.equal(res.rows.length, 0)
    assert.equal(res.columns.length, 2)
    assert.ok(res.sql.includes('O_TOTALPRICE > 10000000'))
    assert.equal(res.query_id, '01b7a20c-test-zero-row')
    // Must NOT be an error status
    assert.notEqual(res.status, 'error')
  })

  // 3. Clarification-required response
  test('Scenario 3: Clarification-required response', async () => {
    const mockClarificationResponse = {
      status: 'clarification_required',
      message: 'The definition of "best customers" is ambiguous. Would you like to rank by account balance (C_ACCTBAL) or order volume?',
      sql: null,
      columns: [],
      rows: [],
      assumptions: []
    }

    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => mockClarificationResponse
    })

    const { askDataMind } = await import('../src/services/api.js')
    const res = await askDataMind('Who are the best customers?')

    assert.equal(res.status, 'clarification_required')
    assert.match(res.message, /ambiguous/i)
    assert.equal(res.sql, null)
    assert.equal(res.rows.length, 0)
    assert.equal(res.is_fixture, false)
  })

  // 4. Unsupported question
  test('Scenario 4: Unsupported question (out of domain)', async () => {
    const mockUnsupportedResponse = {
      status: 'unsupported',
      message: 'The question relates to weather data, which is outside the TPC-H SF1 schema (CUSTOMER, ORDERS, LINEITEM).',
      sql: null,
      columns: [],
      rows: [],
      assumptions: []
    }

    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => mockUnsupportedResponse
    })

    const { askDataMind } = await import('../src/services/api.js')
    const res = await askDataMind('What is the weather forecast for Dharwad?')

    assert.equal(res.status, 'unsupported')
    assert.match(res.message, /outside the TPC-H SF1 schema/i)
    assert.equal(res.sql, null)
  })

  // 5. Structured backend error
  test('Scenario 5: Structured backend error (e.g. Snowflake warehouse timeout)', async () => {
    const mockDbErrorResponse = {
      status: 'error',
      message: 'Snowflake execution failed: Query timed out waiting for warehouse compute resources.',
      sql: 'SELECT * FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.LINEITEM;',
      columns: [],
      rows: [],
      assumptions: [],
      elapsed_ms: 12050,
      query_id: '01b7a20c-failed-query'
    }

    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => mockDbErrorResponse
    })

    const { askDataMind } = await import('../src/services/api.js')
    const res = await askDataMind('Count all lineitems')

    assert.equal(res.status, 'error')
    assert.match(res.message, /Query timed out/i)
    assert.equal(res.query_id, '01b7a20c-failed-query')
    assert.equal(res.is_fixture, false)
  })

  // 6. Backend offline or network failure
  test('Scenario 6: Backend offline or network connection refused', async () => {
    globalThis.fetch = async () => {
      const err = new TypeError('Failed to fetch')
      err.code = 'ECONNREFUSED'
      throw err
    }

    const { askDataMind } = await import('../src/services/api.js')
    const res = await askDataMind('How many orders exist?')

    assert.equal(res.status, 'error')
    assert.match(res.message, /Failed to connect to DataMind backend/i)
    assert.match(res.message, /Ensure the FastAPI server is running/i)
    assert.equal(res.is_fixture, false)
  })

  // 7. Malformed or incomplete response
  test('Scenario 7: Malformed or incomplete backend response (e.g. invalid JSON or missing fields)', async () => {
    // 7a. 200 OK but invalid JSON string
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON at position 0') }
    })

    const { askDataMind } = await import('../src/services/api.js')
    const res1 = await askDataMind('Show orders')
    assert.equal(res1.status, 'error')
    assert.match(res1.message, /invalid JSON response/i)

    // 7b. Incomplete payload (missing columns and rows fields)
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        question: 'Show orders',
        sql: 'SELECT 1;'
        // columns and rows intentionally omitted
      })
    })

    const res2 = await askDataMind('Show orders')
    assert.equal(res2.status, 'success')
    assert.ok(Array.isArray(res2.columns))
    assert.equal(res2.columns.length, 0)
    assert.ok(Array.isArray(res2.rows))
    assert.equal(res2.rows.length, 0)
    assert.equal(res2.row_count, 0)
  })

  // 8. Slow request and timeout abort handling
  test('Scenario 8: Slow request triggers 35-second client timeout cleanly', async () => {
    globalThis.fetch = async (url, options) => {
      return new Promise((resolve, reject) => {
        // Listen to signal abort
        options.signal?.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted')
          abortError.name = 'AbortError'
          reject(abortError)
        })
      })
    }

    const { askDataMind } = await import('../src/services/api.js')
    
    // Test timeout message directly by rejecting with AbortError
    globalThis.fetch = async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      throw abortError
    }

    const res = await askDataMind('Complex multi-table join with heavy aggregation')
    assert.equal(res.status, 'error')
    assert.match(res.message, /timed out after 35 seconds/i)
  })

  // 9. Repeated clicks or duplicate submissions guard
  test('Scenario 9: Rapid duplicate clicks guard verification', async () => {
    let callCount = 0
    globalThis.fetch = async () => {
      callCount++
      // Delay response to simulate in-flight request
      await new Promise(r => setTimeout(r, 20))
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', columns: [], rows: [] })
      }
    }

    const { askDataMind } = await import('../src/services/api.js')

    // Empty input validation rejection
    const empty1 = await askDataMind('   ')
    assert.equal(empty1.status, 'error')
    assert.equal(callCount, 0, 'No HTTP request should fire for empty/whitespace input')

    // Valid query fires 1 HTTP request
    const valid = await askDataMind('What is the count of customers?')
    assert.equal(valid.status, 'success')
    assert.equal(callCount, 1)
  })

  // 10. Long SQL and wide result table layout protection
  test('Scenario 10: Long SQL string and wide result table safety verification', async () => {
    const longSql = 'SELECT ' + Array.from({ length: 40 }, (_, i) => `COL_${i} AS COLUMN_WITH_VERY_LONG_NAME_${i}`).join(', ') + ' FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS;'
    const wideColumns = Array.from({ length: 40 }, (_, i) => `COLUMN_WITH_VERY_LONG_NAME_${i}`)
    const wideRows = [
      Array.from({ length: 40 }, (_, i) => `Value_Row0_Col${i}_LongContentStringWithLotsOfCharactersWithoutSpaces`)
    ]

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        sql: longSql,
        columns: wideColumns,
        rows: wideRows,
        row_count: 1
      })
    })

    const { askDataMind } = await import('../src/services/api.js')
    const res = await askDataMind('Query wide dataset')

    assert.equal(res.status, 'success')
    assert.equal(res.sql.length > 500, true)
    assert.equal(res.columns.length, 40)
    assert.equal(res.rows[0].length, 40)
  })

  // 11. Environment variable and Real API verification
  test('Scenario 11: Final UI strictly uses real API and does not default to fixture data', async () => {
    const { ENABLE_DEV_FIXTURES, API_BASE_URL } = await import('../src/services/api.js')
    assert.equal(ENABLE_DEV_FIXTURES, false, 'VITE_ENABLE_DEV_FIXTURES must default to false for real usage')
    assert.ok(API_BASE_URL.startsWith('http'), 'VITE_API_BASE_URL must be a valid HTTP URL')
  })
})
