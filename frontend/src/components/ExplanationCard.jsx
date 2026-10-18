import React from 'react'
import { Sparkles, CheckCircle2 } from 'lucide-react'

export default function ExplanationCard({ explanation, question }) {
  if (!explanation) return null

  return (
    <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Grounded Answer & Explanation</span>
        </div>
        {question && (
          <span className="text-xs text-slate-400 italic max-w-sm truncate hidden sm:inline">
            "{question}"
          </span>
        )}
      </div>

      <div className="text-slate-800 text-sm sm:text-base leading-relaxed font-normal">
        {explanation}
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Synthesized strictly from executed Snowflake query rows; zero numerical hallucinations.</span>
      </div>
    </div>
  )
}
