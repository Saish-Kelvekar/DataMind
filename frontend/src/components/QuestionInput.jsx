import React, { useRef, useEffect } from 'react'
import { Search, Loader2, ArrowRight, CornerDownLeft, X } from 'lucide-react'

export default function QuestionInput({
  question,
  setQuestion,
  onSubmit,
  isLoading,
  disabled
}) {
  const textareaRef = useRef(null)

  // Auto-resize textarea to fit text naturally up to max height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [question])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (question.trim() && !isLoading && !disabled) {
        onSubmit(question)
      }
    } else if (e.key === 'Escape') {
      if (question) {
        e.preventDefault()
        setQuestion('')
      }
    }
  }

  const handleClear = () => {
    setQuestion('')
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  return (
    <div className="relative rounded-2xl bg-white border border-slate-200 shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <label htmlFor="datamind-question-input" className="mt-1 text-slate-400 cursor-pointer">
            <Search className="w-5 h-5 text-slate-400" aria-hidden="true" />
          </label>

          <div className="flex-1 relative">
            <textarea
              id="datamind-question-input"
              name="datamind-question"
              ref={textareaRef}
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading || disabled}
              aria-label="Ask an analytical question about TPC-H"
              placeholder="Ask an analytical question about TPC-H orders, customers, or line items... (e.g. 'What are the five most expensive orders?')"
              className="w-full bg-transparent text-slate-900 placeholder-slate-400 text-base sm:text-lg resize-none outline-none focus:outline-none font-normal leading-relaxed tracking-tight"
            />
          </div>

          {/* Clear button if text exists */}
          {question && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Input Footer: Keyboard hint & Action Button */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-mono">
              Enter <CornerDownLeft className="w-2.5 h-2.5 inline" />
            </span>
            <span>to ask</span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-mono">
              Shift + Enter
            </span>
            <span>for new line</span>
          </div>

          <button
            type="button"
            disabled={!question.trim() || isLoading || disabled}
            onClick={() => onSubmit(question)}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer shadow-xs ${
              !question.trim() || isLoading || disabled
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-98'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Querying DataMind...</span>
              </>
            ) : (
              <>
                <span>Ask DataMind</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
