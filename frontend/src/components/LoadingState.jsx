import React, { useState, useEffect } from 'react'
import { Sparkles, ShieldCheck, Database, FileText, CheckCircle2 } from 'lucide-react'

const PIPELINE_STEPS = [
  {
    title: 'Interpreting question with Google Gemma',
    detail: 'Translating natural language into SQL using verified schema context',
    icon: Sparkles,
    color: 'text-purple-400',
    bgColor: 'bg-purple-950/40',
    borderColor: 'border-purple-800/40'
  },
  {
    title: 'Validating AST & Permissions',
    detail: 'Enforcing single read-only SELECT, table allowlists, row limits & timeouts',
    icon: ShieldCheck,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/40',
    borderColor: 'border-emerald-800/40'
  },
  {
    title: 'Executing in Snowflake Warehouse',
    detail: 'Executing query on SNOWFLAKE_SAMPLE_DATA.TPCH_SF1 and fetching bounded rows',
    icon: Database,
    color: 'text-sky-400',
    bgColor: 'bg-sky-950/40',
    borderColor: 'border-sky-800/40'
  },
  {
    title: 'Grounding Explanation & Provenance',
    detail: 'Synthesizing plain-language summary strictly from returned result rows',
    icon: FileText,
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/40',
    borderColor: 'border-blue-800/40'
  }
]

export default function LoadingState({ question }) {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev < PIPELINE_STEPS.length - 1 ? prev + 1 : prev))
    }, 1200)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="space-y-6">
      {/* Pipeline Status Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
            <h3 className="text-sm font-semibold text-slate-200">
              Processing Analytical Pipeline
            </h3>
            {question && (
              <span className="text-xs text-slate-400 font-normal italic truncate max-w-xs hidden md:inline">
                "{question}"
              </span>
            )}
          </div>
          <span className="text-xs font-mono text-slate-400">
            Step {activeStep + 1} of {PIPELINE_STEPS.length}
          </span>
        </div>

        {/* Steps Visualizer */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {PIPELINE_STEPS.map((step, idx) => {
            const Icon = step.icon
            const isDone = idx < activeStep
            const isCurrent = idx === activeStep
            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? `${step.bgColor} ${step.borderColor} ring-1 ring-blue-500/30`
                    : isDone
                    ? 'bg-slate-900/50 border-slate-800 text-slate-400'
                    : 'bg-slate-950/40 border-slate-800/40 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? step.color : 'text-slate-500'}`} />
                  )}
                  <span className={`text-xs font-medium truncate ${isCurrent ? 'text-slate-100' : ''}`}>
                    {step.title}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  {step.detail}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Results Skeleton Placeholder */}
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse space-y-4">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
        <div className="h-3 bg-slate-800/60 rounded w-2/3" />
        <div className="h-3 bg-slate-800/40 rounded w-1/2" />
        
        <div className="pt-4 border-t border-slate-800/60 space-y-2">
          <div className="h-8 bg-slate-800/70 rounded w-full" />
          <div className="h-8 bg-slate-800/40 rounded w-full" />
          <div className="h-8 bg-slate-800/30 rounded w-full" />
          <div className="h-8 bg-slate-800/20 rounded w-full" />
        </div>
      </div>
    </div>
  )
}
