import React, { useState } from 'react'
import { Table, Copy, Check, AlertCircle } from 'lucide-react'

export default function ResultsTable({ columns = [], rows = [], rowCount }) {
  const [copied, setCopied] = useState(false)
  const totalRows = rowCount ?? rows.length

  if (!columns.length || !rows.length) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
        <div className="inline-flex p-3 rounded-full bg-slate-800 text-slate-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-slate-200">No Result Rows Returned</h4>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          The executed query returned zero records from Snowflake. Check the query logic and filter parameters in the SQL evidence panel below.
        </p>
      </div>
    )
  }

  // Format cell value depending on column type and value
  const formatCellValue = (value, colName) => {
    if (value === null || value === undefined) {
      return <span className="text-slate-600 italic font-mono text-xs">NULL</span>
    }

    const upperCol = String(colName).toUpperCase()

    // Numeric formatting
    if (typeof value === 'number') {
      const isMonetary = upperCol.includes('PRICE') || upperCol.includes('SALES') || upperCol.includes('BALANCE') || upperCol.includes('COST')
      if (isMonetary) {
        return (
          <span className="font-mono text-emerald-400 font-medium">
            ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      }
      return (
        <span className="font-mono text-slate-200">
          {value.toLocaleString()}
        </span>
      )
    }

    // Date formatting if ISO string
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return <span className="font-mono text-cyan-300">{value}</span>
    }

    return <span className="text-slate-200">{String(value)}</span>
  }

  // Copy results as CSV
  const handleCopyCSV = () => {
    try {
      const headerLine = columns.join(',')
      const rowLines = rows.map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return ''
            const str = String(cell)
            if (str.includes(',') || str.includes('"')) {
              return `"${str.replace(/"/g, '""')}"`
            }
            return str
          })
          .join(',')
      )
      const csv = [headerLine, ...rowLines].join('\n')
      navigator.clipboard.writeText(csv)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy table to clipboard', err)
    }
  }

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
      {/* Table Header Controls */}
      <div className="px-5 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/90">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Snowflake Result Set</h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
            {totalRows} {totalRows === 1 ? 'row' : 'rows'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Copy as CSV format"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-medium">Copied CSV</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Responsive Table Scroll Area */}
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-4 font-mono text-[11px] text-slate-500 uppercase tracking-wider w-12 text-center border-r border-slate-800/60">
                #
              </th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="hover:bg-slate-800/40 transition-colors group"
              >
                <td className="py-2.5 px-4 font-mono text-xs text-slate-500 text-center border-r border-slate-800/60 group-hover:text-slate-400">
                  {rowIdx + 1}
                </td>
                {row.map((cell, colIdx) => (
                  <td
                    key={colIdx}
                    className="py-2.5 px-4 whitespace-nowrap"
                  >
                    {formatCellValue(cell, columns[colIdx])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
