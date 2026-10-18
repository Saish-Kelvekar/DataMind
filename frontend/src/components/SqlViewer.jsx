import React, { useState } from 'react'
import { Terminal, Copy, Check, ChevronDown, ChevronUp, ShieldCheck, Info } from 'lucide-react'

export default function SqlViewer({ sql, assumptions = [] }) {
  const [isOpen, setIsOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  if (!sql) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 text-left text-slate-200 hover:text-white transition-colors cursor-pointer"
        >
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">Exact Executed SQL Evidence</h3>
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
            <ShieldCheck className="w-3 h-3" />
            Verified SELECT
          </span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Copy SQL query"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy SQL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expandable SQL Code Body */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="relative rounded-xl bg-slate-950 border border-slate-800/90 p-4 overflow-x-auto">
            <pre className="font-mono text-xs sm:text-sm text-slate-200 leading-relaxed selection:bg-emerald-800 selection:text-white">
              <code>{sql}</code>
            </pre>
          </div>

          {/* Assumptions or Rationale Notes */}
          {assumptions && assumptions.length > 0 && (
            <div className="rounded-xl bg-blue-950/30 border border-blue-900/40 p-3.5 text-xs text-blue-300 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-blue-200">
                <Info className="w-3.5 h-3.5" />
                <span>Gemma Model Assumptions & Constraints:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-slate-300 text-[12px]">
                {assumptions.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
