import { test, describe, after } from 'node:test'
import assert from 'node:assert/strict'

// Mock environment variables for testing
process.env.VITE_API_BASE_URL = 'http://localhost:8000'
process.env.VITE_ENABLE_DEV_FIXTURES = 'false'

describe('DataMind Frontend API Client (Phase B2 Contract Compliance)', () => {
  const originalFetch = globalThis.fetch

  after(() => {
    globalThis.fetch = originalFetch
  })

  test('Rejects empty or whitespace-only questions without network call', async () => {
    // Dynamic import to pick up mocked env
    const { askDataMind } = await import('../src/services/api.js')

    const emptyRes = await askDataMind('')
    assert.equal(emptyRes.status, 'error')
    assert.match(emptyRes.message, /cannot be empty/i)

    const whitespaceRes = await askDataMind('   \n  ')
    assert.equal(whitespaceRes.status, 'error')
    assert.match(whitespaceRes.message, /cannot be empty/i)
  })

  test('Successfully parses full 200 OK response from POST /api/ask', async () => {
    const mockSuccessResponse = {
      status: 'success',
      question: 'What are the five most expensive orders?',
      sql: 'SELECT O_ORDERKEY, O_TOTALPRICE FROM SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS ORDER BY O_TOTALPRICE DESC LIMIT 5;',
      columns: ['O_ORDERKEY', 'O_TOTALPRICE'],
      rows: [
        [3400051, 555285.16],
        [4752544, 548048.80],
        [1635392, 546879.01],
        [4267715, 544089.40],
        [3588965, 540847.60]
      ],
      explanation: 'The query sorts orders by total price and returns five rows.',
      assumptions: ['Price in USD'],
      row_count: 5,
      elapsed_ms: 684,
      query_id: '01b7a20c-0001-c89b-0000-0001d8e2786a'
    }

    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'http://localhost:8000/api/ask')
      assert.equal(options.method, 'POST')
      const body = JSON.parse(options.body)
      assert.equal(body.question, 'What are the five most expensive orders?')

      return {
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse
      }
    }

    const { askDataMind } = await import('../src/services/api.js')
    const res = await askDataMind('What are the five most expensive orders?')

    assert.equal(res.status, 'success')
    assert.equal(res.row_count, 5)
    assert.equal(res.columns.length, 2)
    assert.equal(res.rows.length, 5)
    assert.equal(res.sql, mockSuccessResponse.sql)
    assert.equal(res.query_id, mockSuccessResponse.query_id)
    assert.equal(res.is_fixture, false)
  })

  test('Handles non-success structured states (unsupported, clarification_required, error)', async () => {
    // 1. Unsupported question
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        status: 'unsupported',
        message: 'Weather data is out of scope for TPC-H SF1.',
        sql: null,
        columns: [],
        rows: []
      })
    })

    const { askDataMind } = await import('../src/services/api.js')
    const unsupportedRes = await askDataMind('What is the weather tomorrow?')
    assert.equal(unsupportedRes.status, 'unsupported')
    assert.match(unsupportedRes.message, /out of scope/i)
    assert.equal(unsupportedRes.sql, null)

    // 2. Clarification required
    globalThis.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        status: 'clarification_required',
        message: 'The metric for best customers is ambiguous.',
        sql: null,
        columns: [],
        rows: []
      })
    })

    const clarRes = await askDataMind('Show best customers')
    assert.equal(clarRes.status, 'clarification_required')
    assert.match(clarRes.message, /ambiguous/i)
  })

  test('Handles FastAPI validation errors ({ detail: [...] }) gracefully', async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [
          { loc: ['body', 'question'], msg: 'Field required', type: 'value_error.missing' }
        ]
      })
    })

    const { askDataMind } = await import('../src/services/api.js')
    const errRes = await askDataMind('test')
    assert.equal(errRes.status, 'error')
    assert.match(errRes.message, /Field required/i)
  })

  test('Handles backend network offline / connection refusal gracefully', async () => {
    globalThis.fetch = async () => {
      const err = new TypeError('fetch failed')
      err.cause = { code: 'ECONNREFUSED' }
      throw err
    }

    const { askDataMind } = await import('../src/services/api.js')
    const offlineRes = await askDataMind('What are the top orders?')
    assert.equal(offlineRes.status, 'error')
    assert.match(offlineRes.message, /Failed to connect to DataMind backend at http:\/\/localhost:8000/i)
    assert.equal(offlineRes.is_fixture, false)
  })

  test('checkBackendHealth returns online: false when connection fails', async () => {
    globalThis.fetch = async () => {
      throw new Error('Connection refused')
    }

    const { checkBackendHealth } = await import('../src/services/api.js')
    const health = await checkBackendHealth()
    assert.equal(health.online, false)
    assert.equal(health.error, 'Offline')
  })

  test('checkBackendHealth returns online: true when GET /health responds 200', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(url, 'http://localhost:8000/health')
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy', gemma: 'connected', snowflake: 'connected' })
      }
    }

    const { checkBackendHealth } = await import('../src/services/api.js')
    const health = await checkBackendHealth()
    assert.equal(health.online, true)
    assert.equal(health.data.status, 'healthy')
  })
})
