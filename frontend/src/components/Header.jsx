import React from 'react'
import { Database, Sparkles, ShieldCheck, Activity, AlertTriangle } from 'lucide-react'

export default function Header({ backendStatus, onRetryHealth, isFixtureMode, onToggleFixtureMode, canToggleFixture }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
      {/* Top Banner if Fixture Mode is active */}
      {isFixtureMode && (
        <div className="bg-amber-950/80 border-b border-amber-800/60 px-4 py-1.5 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>DEVELOPMENT FIXTURE MODE ACTIVE:</strong> Serving local synthetic test cases for UI layout validation. In production/demo, live queries are sent to Snowflake and hosted Gemma.
            </span>
            {canToggleFixture && (
              <button
                onClick={onToggleFixtureMode}
                className="ml-auto underline hover:text-amber-100 font-medium cursor-pointer text-xs"
              >
                Switch to Live API
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Product Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>DataMind</span>
                  <span className="text-slate-400 text-sm font-normal hidden sm:inline">—</span>
                  <span className="text-slate-300 text-sm font-medium hidden sm:inline">Talk to Your Data</span>
                </h1>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-400 border border-blue-800/60">
                  Hacktoberfest 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Natural-language SQL agent executing real analytical queries on Snowflake TPC-H SF1 data
              </p>
            </div>
          </div>

          {/* Technology Badges & Live Status */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Gemma Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-800/50 text-purple-300" title="Hosted Google Gemma translates natural language into structured SQL">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-medium">Hosted Gemma</span>
            </div>

            {/* Snowflake Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-950/60 border border-sky-800/50 text-sky-300" title="Connected to live Snowflake SNOWFLAKE_SAMPLE_DATA.TPCH_SF1">
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-medium">Snowflake TPCH_SF1</span>
            </div>

            {/* Guardrail Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/50 text-emerald-300" title="Strict sqlglot AST verification with read-only SELECT and table allowlists">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium">AST Guardrail</span>
            </div>

            {/* Backend Connection Health */}
            <button
              onClick={onRetryHealth}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                backendStatus.online
                  ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-rose-950/40 border-rose-800/40 text-rose-300 hover:bg-rose-900/40'
              }`}
              title="Click to refresh backend connection status"
            >
              <span className={`w-2 h-2 rounded-full ${backendStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span className="font-medium">{backendStatus.online ? 'Backend Online' : 'Backend Offline'}</span>
              <Activity className="w-3 h-3 ml-0.5 opacity-60" />
            </button>
          </div>

        </div>
      </div>
    </header>
  )
}
