import React, { useState } from 'react'
import { Terminal, Copy, Check, ChevronDown, ChevronUp, ShieldCheck, Info, WrapText } from 'lucide-react'

export default function SqlViewer({ sql, assumptions = [] }) {
  const [isOpen, setIsOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [wrapLines, setWrapLines] = useState(true)

  if (!sql) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Split SQL into lines for numbered display
  const sqlLines = sql.trim().split('\n')

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 text-left text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
        >
          <Terminal className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-semibold">Exact Executed SQL Evidence</h3>
          <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
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
          {/* Toggle Wrap */}
          <button
            type="button"
            onClick={() => setWrapLines(!wrapLines)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
              wrapLines
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="Toggle line wrapping for long queries"
          >
            <WrapText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{wrapLines ? 'Wrapped' : 'No Wrap'}</span>
          </button>

          {/* Copy SQL Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-xs"
            title="Copy exact SQL to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Copied SQL</span>
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
          <div className="relative rounded-xl bg-slate-900 border border-slate-800 p-4 shadow-inner overflow-hidden">
            <div className={`overflow-x-auto ${wrapLines ? '' : 'whitespace-pre'}`}>
              <table className="font-mono text-xs sm:text-sm text-slate-100 leading-relaxed w-full border-collapse">
                <tbody>
                  {sqlLines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="pr-4 text-right text-slate-600 select-none w-8 text-xs font-mono align-top">
                        {idx + 1}
                      </td>
                      <td className={`text-slate-100 ${wrapLines ? 'break-words' : 'whitespace-pre'}`}>
                        <code>{line}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>{sqlLines.length} lines • {sql.length} characters</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                sqlglot AST policy: 1 read-only statement
              </span>
            </div>
          </div>

          {/* Assumptions or Rationale Notes */}
          {assumptions && assumptions.length > 0 && (
            <div className="rounded-xl bg-blue-50 border border-blue-200/80 p-3.5 text-xs text-blue-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Gemma Model Assumptions & Query Interpretation:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-slate-700 text-[12px] leading-relaxed">
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
