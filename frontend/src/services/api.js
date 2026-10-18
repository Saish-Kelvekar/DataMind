/**
 * DataMind API Client
 * 
 * Interacts solely with the local FastAPI backend.
 * Never connects directly to Google Gemma or Snowflake credentials.
 */

import { DEV_FIXTURES } from './fixtures.js'

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) || 'http://localhost:8000'
const ENABLE_DEV_FIXTURES = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_DEV_FIXTURES) || (typeof process !== 'undefined' && process.env?.VITE_ENABLE_DEV_FIXTURES)) === 'true'

/**
 * Check backend service health (GET /health)
 */
export async function checkBackendHealth() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json().catch(() => ({}))
      return { online: true, data }
    }
    return { online: false, error: `HTTP ${response.status}` }
  } catch (err) {
    return { online: false, error: err.name === 'AbortError' ? 'Timeout' : 'Offline' }
  }
}

/**
 * Submit natural-language question to POST /api/ask
 * 
 * @param {string} question - Analytical question
 * @param {Object} options - Optional configuration { forceFixture: boolean, allowFallbackToFixture: boolean }
 * @returns {Promise<Object>} Standard response shape
 */
export async function askDataMind(question, options = {}) {
  const trimmed = question?.trim()
  if (!trimmed) {
    return {
      status: 'error',
      message: 'Question cannot be empty.',
      sql: null,
      columns: [],
      rows: []
    }
  }

  // Development fixture mode (strictly disabled in production/demo)
  if (ENABLE_DEV_FIXTURES && options.forceFixture) {
    return simulateFixtureResponse(trimmed)
  }

  let timeoutId = null
  try {
    const controller = new AbortController()
    // 35 second timeout to accommodate LLM reasoning + Snowflake execution
    timeoutId = setTimeout(() => controller.abort(), 35000)

    const response = await fetch(`${API_BASE_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ question: trimmed }),
      signal: controller.signal
    })

    const data = await response.json().catch(() => null)

    // Successful HTTP response with parsed JSON
    if (response.ok && data) {
      return {
        status: data.status || 'success',
        question: data.question || trimmed,
        sql: data.sql || null,
        columns: Array.isArray(data.columns) ? data.columns : [],
        rows: Array.isArray(data.rows) ? data.rows : [],
        explanation: data.explanation || '',
        assumptions: Array.isArray(data.assumptions) ? data.assumptions : [],
        row_count: typeof data.row_count === 'number' 
          ? data.row_count 
          : (Array.isArray(data.rows) ? data.rows.length : 0),
        elapsed_ms: data.elapsed_ms,
        query_id: data.query_id,
        is_fixture: false
      }
    }

    // Backend returned 200 OK but body could not be parsed as JSON
    if (response.ok && !data) {
      return {
        status: 'error',
        message: 'Backend returned an empty or invalid JSON response payload.',
        sql: null,
        columns: [],
        rows: [],
        assumptions: [],
        is_fixture: false
      }
    }

    // Backend returned structured error or FastAPI validation error
    if (data) {
      let message = data.message
      if (!message && data.detail) {
        message = typeof data.detail === 'string'
          ? data.detail
          : Array.isArray(data.detail)
          ? data.detail.map((d) => d.msg || d.message).join('; ')
          : JSON.stringify(data.detail)
      }

      return {
        status: data.status || 'error',
        message: message || `Server returned error (HTTP ${response.status})`,
        sql: data.sql || null,
        columns: Array.isArray(data.columns) ? data.columns : [],
        rows: Array.isArray(data.rows) ? data.rows : [],
        assumptions: Array.isArray(data.assumptions) ? data.assumptions : [],
        elapsed_ms: data.elapsed_ms,
        query_id: data.query_id,
        is_fixture: false
      }
    }

    return {
      status: 'error',
      message: `Backend returned error (HTTP ${response.status}) without response payload.`,
      sql: null,
      columns: [],
      rows: [],
      assumptions: [],
      is_fixture: false
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return {
        status: 'error',
        message: 'Request timed out after 35 seconds. The Snowflake warehouse may be suspended or Google Gemma service is taking longer than expected.',
        sql: null,
        columns: [],
        rows: [],
        is_fixture: false
      }
    }

    // If backend is offline and dev fixtures are explicitly permitted in environment
    if (ENABLE_DEV_FIXTURES && options.allowFallbackToFixture) {
      console.warn('[DataMind Dev] Backend offline; falling back to development fixture.')
      return simulateFixtureResponse(trimmed)
    }

    return {
      status: 'error',
      message: `Failed to connect to DataMind backend at ${API_BASE_URL}. Ensure the FastAPI server is running with 'python -m uvicorn app.main:app --reload'.`,
      sql: null,
      columns: [],
      rows: [],
      assumptions: [],
      is_fixture: false
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * Match question to a development fixture for UI development
 */
function simulateFixtureResponse(question) {
  const lower = question.toLowerCase()
  let fixture = DEV_FIXTURES.expensive_orders

  if (lower.includes('how many customer') || lower.includes('customer count')) {
    fixture = DEV_FIXTURES.customer_count
  } else if (lower.includes('status') || lower.includes('group by order status')) {
    fixture = DEV_FIXTURES.order_status_agg
  } else if (lower.includes('weather') || lower.includes('temperature') || lower.includes('dharwad')) {
    fixture = DEV_FIXTURES.unsupported_weather
  } else if (lower.includes('best') || lower.includes('nice') || lower.includes('cool')) {
    fixture = DEV_FIXTURES.clarification_needed
  } else if (lower.includes('10,000,000') || lower.includes('exceeding') || lower.includes('empty')) {
    fixture = DEV_FIXTURES.empty_results
  } else if (lower.includes('timeout') || lower.includes('error')) {
    fixture = DEV_FIXTURES.error_case
  }

  return {
    ...fixture,
    question: question,
    is_fixture: true
  }
}

export { API_BASE_URL, ENABLE_DEV_FIXTURES }
