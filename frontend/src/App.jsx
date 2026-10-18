import React, { useState, useEffect, useCallback } from 'react'
import AppShell from './components/AppShell'
import QuestionInput from './components/QuestionInput'
import ExampleChips from './components/ExampleChips'
import LoadingState from './components/LoadingState'
import ExplanationCard from './components/ExplanationCard'
import ResultsTable from './components/ResultsTable'
import SqlViewer from './components/SqlViewer'
import QueryMetadata from './components/QueryMetadata'
import StatusAlert from './components/StatusAlert'
import SchemaReference from './components/SchemaReference'
import DataVisualizer from './components/DataVisualizer'
import { askDataMind, checkBackendHealth, ENABLE_DEV_FIXTURES } from './services/api'
import { Sparkles, Database, ShieldCheck, History, AlertTriangle } from 'lucide-react'

export default function App() {
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [backendStatus, setBackendStatus] = useState({ online: false, checking: true, data: null })
  const [isFixtureMode, setIsFixtureMode] = useState(false)
  const [activeNav, setActiveNav] = useState('playground')

  // Verify backend health on startup
  useEffect(() => {
    let ignore = false

    async function initHealth() {
      const health = await checkBackendHealth()
      if (!ignore) {
        setBackendStatus({ online: health.online, checking: false, data: health.data })
        if (!health.online && ENABLE_DEV_FIXTURES) {
          setIsFixtureMode(true)
        }
      }
    }

    initHealth()

    return () => {
      ignore = true
    }
  }, [])

  // Manual retry handler
  const handleRetryHealth = useCallback(async () => {
    setBackendStatus((prev) => ({ ...prev, checking: true }))
    const health = await checkBackendHealth()
    setBackendStatus({ online: health.online, checking: false, data: health.data })
  }, [])

  // Handle question submission
  const handleAsk = async (queryText) => {
    const q = (queryText || question).trim()
    if (!q || isLoading) return

    setQuestion(q)
    setIsLoading(true)
    setResult(null)

    try {
      const response = await askDataMind(q, {
        forceFixture: isFixtureMode,
        allowFallbackToFixture: isFixtureMode
      })

      setResult(response)

      // Add to query history (deduplicated)
      setHistory((prev) => {
        const filtered = prev.filter((item) => item !== q)
        return [q, ...filtered].slice(0, 5)
      })
    } catch (err) {
      setResult({
        status: 'error',
        message: err.message || 'An unexpected error occurred while executing the query.',
        sql: null,
        columns: [],
        rows: []
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AppShell
      backendStatus={backendStatus}
      onRetryHealth={handleRetryHealth}
      activeNav={activeNav}
      setActiveNav={setActiveNav}
    >
      {/* Dev Fixture Notice Banner if enabled */}
      {isFixtureMode && (
        <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>DEVELOPMENT FIXTURE MODE ACTIVE:</strong> Serving synthetic fixtures for UI verification while backend is initializing.
            </span>
          </div>
          {ENABLE_DEV_FIXTURES && (
            <button
              onClick={() => setIsFixtureMode(!isFixtureMode)}
              className="text-xs font-semibold text-amber-900 underline hover:text-amber-700 cursor-pointer"
            >
              Toggle Live API
            </button>
          )}
        </div>
      )}

      {/* Main Analytical Playground View */}
      {activeNav === 'playground' && (
        <div className="space-y-6">
          {/* Schema and Capabilities Reference Banner */}
          <SchemaReference />

          {/* Question Formulation Card */}
          <section className="space-y-4" aria-label="Query Formulation">
            <QuestionInput
              question={question}
              setQuestion={setQuestion}
              onSubmit={handleAsk}
              isLoading={isLoading}
              disabled={isLoading}
            />

            <ExampleChips
              onSelectExample={(selected) => {
                setQuestion(selected)
                handleAsk(selected)
              }}
              disabled={isLoading}
            />
          </section>

          {/* Recent Queries History Chips */}
          {history.length > 0 && (
            <section className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium text-slate-400">
                <History className="w-3.5 h-3.5" />
                <span>Recent:</span>
              </span>
              {history.map((hist, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuestion(hist)
                    handleAsk(hist)
                  }}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 transition-colors truncate max-w-xs cursor-pointer shadow-xs"
                  title={hist}
                >
                  {hist}
                </button>
              ))}
            </section>
          )}

          {/* Dynamic Display Area: Loading -> Result -> Welcome Workspace */}
          <section aria-live="polite" className="space-y-6">
            {isLoading && <LoadingState question={question} />}

            {!isLoading && result && (
              <div className="space-y-6">
                {/* Dedicated Non-Success Statuses */}
                <StatusAlert
                  status={result.status}
                  message={result.message}
                  onRetry={() => handleAsk(question)}
                />

                {/* Plain-Language Explanation */}
                {result.explanation && (
                  <ExplanationCard
                    explanation={result.explanation}
                    question={result.question || question}
                  />
                )}

                {/* Execution Metadata Bar */}
                {(result.elapsed_ms !== undefined || result.query_id) && (
                  <QueryMetadata
                    elapsedMs={result.elapsed_ms}
                    queryId={result.query_id}
                    rowCount={result.row_count ?? result.rows?.length ?? 0}
                    isFixture={result.is_fixture}
                  />
                )}

                {/* Dynamic Visualization (Bar Chart) for compatible multi-row datasets */}
                {result.status === 'success' && (
                  <DataVisualizer
                    columns={result.columns || []}
                    rows={result.rows || []}
                  />
                )}

                {/* Results Table */}
                {result.status === 'success' && (
                  <ResultsTable
                    columns={result.columns || []}
                    rows={result.rows || []}
                    rowCount={result.row_count ?? result.rows?.length ?? 0}
                  />
                )}

                {/* Exact Executed SQL & Evidence Panel */}
                {result.sql && (
                  <SqlViewer
                    sql={result.sql}
                    assumptions={result.assumptions || []}
                  />
                )}
              </div>
            )}

            {!isLoading && !result && (
              /* Welcome / Analytics Workspace Empty State */
              <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200/80 text-center space-y-6 max-w-3xl mx-auto shadow-sm">
                <div className="inline-flex p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600">
                  <Database className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    DataMind Analytics Agent
                  </h2>
                  <p className="text-slate-500 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                    Ask analytical questions in natural language. Powered by hosted Google Gemma for SQL interpretation, sqlglot for query verification, and Snowflake for real database execution.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-600">
                      <Sparkles className="w-4 h-4" />
                      <span>1. Hosted Gemma</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-snug">
                      Translates natural language to SQL using verified TPC-H schema context.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <ShieldCheck className="w-4 h-4" />
                      <span>2. AST Guardrail</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-snug">
                      sqlglot validates a single read-only SELECT against approved tables.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600">
                      <Database className="w-4 h-4" />
                      <span>3. Snowflake Execution</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-snug">
                      Executes live queries on Snowflake, returning exact rows and query IDs.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Data Sources View */}
      {activeNav === 'datasources' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Configured Data Sources</h2>
            <p className="text-xs text-slate-500 mb-6">
              Verified Snowflake TPC-H SF1 sample tables approved for queries.
            </p>
            <SchemaReference />
          </div>
        </div>
      )}

      {/* Models View */}
      {activeNav === 'models' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Configured AI Model</h2>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-lg space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-sm text-slate-900">Hosted Google Gemma</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Model: <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800">gemma-2-9b-it / gemma-4-26b-a4b-it</code>
            </p>
            <p className="text-xs text-slate-600 leading-relaxed pt-1">
              Provides structured SQL proposals from natural language analytical prompts. Strictly instructed not to hallucinate numerical results.
            </p>
          </div>
        </div>
      )}

      {/* Guardrails View */}
      {activeNav === 'guardrails' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Security & Guardrail Policies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Single Statement Enforcement</span>
              </div>
              <p className="text-xs text-slate-500">
                sqlglot AST inspection blocks multi-statement queries, scripts, and semicolon injection.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-xs text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Read-Only SELECT Enforcement</span>
              </div>
              <p className="text-xs text-slate-500">
                Blocks DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, or CREATE statements before execution.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* History View */}
      {activeNav === 'history' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Query Audit History</h2>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">No query history recorded in this session yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((q, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{q}</span>
                  <button
                    onClick={() => {
                      setActiveNav('playground')
                      setQuestion(q)
                      handleAsk(q)
                    }}
                    className="text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    Rerun Query
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* API View */}
      {activeNav === 'api' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900">API Contract Reference</h2>
          <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto">
            <p className="text-slate-400 mb-2"># Main Query Endpoint</p>
            <p className="text-emerald-400 font-semibold">POST http://localhost:8000/api/ask</p>
            <p className="text-slate-400 mt-3 mb-1"># Payload</p>
            <pre className="text-slate-300">{JSON.stringify({ question: 'What are the five most expensive orders?' }, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Settings View */}
      {activeNav === 'settings' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Workspace Settings</h2>
          <div className="space-y-3 text-xs text-slate-600 max-w-md">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Backend Base URL</label>
              <input
                disabled
                value={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
                className="w-full p-2.5 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs text-slate-600"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Snowflake Schema Target</label>
              <input
                disabled
                value="SNOWFLAKE_SAMPLE_DATA.TPCH_SF1"
                className="w-full p-2.5 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs text-slate-600"
              />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
