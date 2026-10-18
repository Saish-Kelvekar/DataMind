import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import QuestionInput from './components/QuestionInput'
import ExampleChips from './components/ExampleChips'
import LoadingState from './components/LoadingState'
import ExplanationCard from './components/ExplanationCard'
import ResultsTable from './components/ResultsTable'
import SqlViewer from './components/SqlViewer'
import QueryMetadata from './components/QueryMetadata'
import StatusAlert from './components/StatusAlert'
import SchemaReference from './components/SchemaReference'
import { askDataMind, checkBackendHealth, ENABLE_DEV_FIXTURES } from './services/api'
import { Sparkles, Database, ShieldCheck, History } from 'lucide-react'

export default function App() {
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [backendStatus, setBackendStatus] = useState({ online: false, checking: true, data: null })
  const [isFixtureMode, setIsFixtureMode] = useState(false)

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navigation & App Header */}
      <Header
        backendStatus={backendStatus}
        onRetryHealth={handleRetryHealth}
        isFixtureMode={isFixtureMode}
        onToggleFixtureMode={() => setIsFixtureMode(!isFixtureMode)}
        canToggleFixture={ENABLE_DEV_FIXTURES}
      />

      {/* Main Analytical Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
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
          <section className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 font-medium text-slate-500">
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
                className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors truncate max-w-xs cursor-pointer"
                title={hist}
              >
                {hist}
              </button>
            ))}
          </section>
        )}

        {/* Dynamic Display Area: Loading -> Result -> Empty Workspace */}
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
            /* Welcome / Empty Workspace State */
            <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/50 border border-slate-800/80 text-center space-y-6 max-w-3xl mx-auto shadow-2xl">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-purple-600/20 border border-blue-500/20 text-blue-400">
                <Database className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Analytical Database Workspace
                </h2>
                <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                  Ask analytical questions in natural language. DataMind translates your question using hosted Google Gemma, validates SQL with sqlglot, and executes real queries against Snowflake TPC-H sample data.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                    <Sparkles className="w-4 h-4" />
                    <span>1. AI Translation</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">
                    Hosted Google Gemma interprets your question with inspected TPC-H schema context.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>2. AST Validation</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">
                    sqlglot strictly validates one read-only SELECT against allowed tables & columns.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                    <Database className="w-4 h-4" />
                    <span>3. Snowflake Execution</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">
                    Queries execute on live Snowflake data, returning actual rows, timing, and query ID.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="font-semibold text-slate-400">DataMind</span> — ZeroDay OSS Hacktoberfest 2026 · IIIT Dharwad · Problem Statement 1
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Hosted Google Gemma</span>
            <span>•</span>
            <span>Snowflake TPCH_SF1</span>
            <span>•</span>
            <span>sqlglot Guardrails</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
