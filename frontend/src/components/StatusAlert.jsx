import React from 'react'
import { HelpCircle, XCircle, RefreshCw, FileQuestion } from 'lucide-react'

export default function StatusAlert({ status, message, onRetry }) {
  if (!status || status === 'success') return null

  if (status === 'clarification_required') {
    return (
      <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-indigo-900">
              Clarification Needed
            </h4>
            <p className="text-sm text-indigo-700 leading-relaxed">
              {message || 'The question is ambiguous and requires additional context to construct an exact SQL query.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'unsupported') {
    return (
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <FileQuestion className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-900">
              Question Out of Dataset Scope
            </h4>
            <p className="text-sm text-amber-800 leading-relaxed">
              {message || 'DataMind is currently scoped exclusively to the Snowflake TPC-H SF1 benchmark dataset (CUSTOMER, ORDERS, and LINEITEM tables). This question cannot be answered from the available schema.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <h4 className="text-sm font-semibold text-rose-900">
              Execution Error
            </h4>
            <p className="text-sm text-rose-700 leading-relaxed">
              {message || 'An error occurred while processing your request. Please verify the query and try again.'}
            </p>

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-medium text-white transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Question</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
