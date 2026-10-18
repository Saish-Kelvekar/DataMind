import React, { useState } from 'react'
import { Clock, Hash, CheckCircle, Copy, Check, Server, AlertTriangle } from 'lucide-react'

export default function QueryMetadata({ elapsedMs, queryId, rowCount, isFixture }) {
  const [copiedId, setCopiedId] = useState(false)

  const handleCopyQueryId = () => {
    if (!queryId) return
    navigator.clipboard.writeText(queryId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const formatElapsed = (ms) => {
    if (ms === null || ms === undefined) return 'N/A'
    if (ms < 1000) return `${ms} ms`
    return `${(ms / 1000).toFixed(2)} s`
  }

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-300">
      <div className="flex flex-wrap items-center gap-4">
        {/* Elapsed Time */}
        <div className="flex items-center gap-1.5" title="Execution duration from question to Snowflake results">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">Duration:</span>
          <span className="font-mono font-medium text-slate-200">{formatElapsed(elapsedMs)}</span>
        </div>

        {/* Row Count */}
        <div className="flex items-center gap-1.5" title="Number of rows returned">
          <Hash className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-slate-400">Rows:</span>
          <span className="font-mono font-medium text-slate-200">{rowCount ?? 0}</span>
        </div>

        {/* Guardrail Status */}
        <div className="flex items-center gap-1.5" title="AST validation enforced by sqlglot">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">Policy:</span>
          <span className="font-medium text-emerald-300">Read-Only Enforced</span>
        </div>

        {/* Fixture Mode Tag if synthetic */}
        {isFixture && (
          <div className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300" title="Synthetic development fixture">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Dev Fixture</span>
          </div>
        )}
      </div>

      {/* Snowflake Query ID */}
      {queryId && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-400">Query ID:</span>
            <span className="font-mono text-[11px] text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50">
              {queryId}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyQueryId}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 cursor-pointer"
            title="Copy Snowflake Query ID"
          >
            {copiedId ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
