import React, { useState, useMemo } from 'react'
import {
  Table,
  Check,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  FileCode,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export default function ResultsTable({ columns = [], rows = [], rowCount }) {
  const [copiedType, setCopiedType] = useState(null)
  const [sortConfig, setSortConfig] = useState({ columnIdx: null, direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const totalRows = rowCount ?? rows.length

  // Unconditionally compute sorted rows (React hook rules)
  const sortedRows = useMemo(() => {
    if (!rows.length || sortConfig.columnIdx === null) return rows

    return [...rows].sort((a, b) => {
      const valA = a[sortConfig.columnIdx]
      const valB = b[sortConfig.columnIdx]

      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()
      return sortConfig.direction === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
    })
  }, [rows, sortConfig])

  // Unconditionally compute paginated rows (React hook rules)
  const paginatedRows = useMemo(() => {
    if (!sortedRows.length) return []
    const startIndex = (currentPage - 1) * pageSize
    return sortedRows.slice(startIndex, startIndex + pageSize)
  }, [sortedRows, currentPage, pageSize])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))

  // Case 1: Valid query executed but returned zero rows (Requirement 7)
  if (columns.length > 0 && rows.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
        <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-500">
          <AlertCircle className="w-6 h-6 text-slate-500" />
        </div>
        <h4 className="text-base font-semibold text-slate-900">Valid Query Executed — Zero Rows Returned</h4>
        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
          The query ran cleanly against Snowflake, but no records in the table matched your specific filter conditions. This is a valid database result, not an application error.
        </p>
        <div className="pt-2 flex flex-wrap justify-center gap-1.5 text-xs text-slate-400 font-mono">
          <span className="font-semibold text-slate-500 uppercase text-[11px] mr-1">Expected Columns:</span>
          {columns.map((c, idx) => (
            <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
              {c}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Case 2: Neither columns nor rows available
  if (!columns.length || !rows.length) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
        <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-400">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-slate-800">No Data Available</h4>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Execute an analytical query above to view the returned Snowflake data records.
        </p>
      </div>
    )
  }

  const handleHeaderSort = (idx) => {
    setSortConfig((prev) => {
      if (prev.columnIdx === idx) {
        if (prev.direction === 'asc') return { columnIdx: idx, direction: 'desc' }
        return { columnIdx: null, direction: 'asc' }
      }
      return { columnIdx: idx, direction: 'asc' }
    })
  }

  // Format cell value depending on column type and value
  const formatCellValue = (value, colName) => {
    if (value === null || value === undefined) {
      return (
        <span className="text-slate-400 italic font-mono text-xs" title="Raw Value: NULL">
          NULL
        </span>
      )
    }

    const rawString = String(value)
    const upperCol = String(colName).toUpperCase()

    // Numeric formatting
    if (typeof value === 'number') {
      const isMonetary = upperCol.includes('PRICE') || upperCol.includes('SALES') || upperCol.includes('BALANCE') || upperCol.includes('COST')
      if (isMonetary) {
        return (
          <span
            className="font-mono text-emerald-600 font-semibold cursor-help"
            title={`Raw Snowflake Value: ${rawString}`}
          >
            ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      }
      return (
        <span
          className="font-mono text-slate-800 font-medium cursor-help"
          title={`Raw Snowflake Value: ${rawString}`}
        >
          {value.toLocaleString()}
        </span>
      )
    }

    // Date formatting if ISO string
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return (
        <span
          className="font-mono text-blue-600 font-medium cursor-help"
          title={`Raw Snowflake Value: ${rawString}`}
        >
          {value}
        </span>
      )
    }

    return (
      <span
        className="text-slate-700 truncate max-w-xs block cursor-help"
        title={`Raw Snowflake Value: ${rawString}`}
      >
        {rawString}
      </span>
    )
  }

  // Export as CSV
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
      setCopiedType('csv')
      setTimeout(() => setCopiedType(null), 2000)
    } catch (err) {
      console.error('Failed to copy table to clipboard', err)
    }
  }

  // Export as JSON
  const handleCopyJSON = () => {
    try {
      const jsonObjects = rows.map((row) => {
        const obj = {}
        columns.forEach((col, idx) => {
          obj[col] = row[idx]
        })
        return obj
      })
      navigator.clipboard.writeText(JSON.stringify(jsonObjects, null, 2))
      setCopiedType('json')
      setTimeout(() => setCopiedType(null), 2000)
    } catch (err) {
      console.error('Failed to copy JSON to clipboard', err)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Header Controls */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">Snowflake Result Records</h3>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-mono font-medium">
            {totalRows} {totalRows === 1 ? 'row' : 'rows'}
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Click headers to sort
          </span>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-xs"
            title="Export full result set as CSV format"
          >
            {copiedType === 'csv' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Copied CSV</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy CSV</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyJSON}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 transition-all cursor-pointer shadow-xs"
            title="Export full result set as JSON array"
          >
            {copiedType === 'json' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Copied JSON</span>
              </>
            ) : (
              <>
                <FileCode className="w-3.5 h-3.5 text-slate-500" />
                <span>JSON</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Responsive Table Scroll Area */}
      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4 font-mono text-[11px] text-slate-400 uppercase tracking-wider w-12 text-center border-r border-slate-200/60 font-semibold">
                #
              </th>
              {columns.map((col, idx) => {
                const isSorted = sortConfig.columnIdx === idx
                return (
                  <th
                    key={idx}
                    onClick={() => handleHeaderSort(idx)}
                    className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100/80 transition-colors select-none"
                    title="Click to sort by this column"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col}</span>
                      {isSorted ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.map((row, rowIdx) => {
              const globalIndex = (currentPage - 1) * pageSize + rowIdx + 1
              return (
                <tr
                  key={rowIdx}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-400 text-center border-r border-slate-200/60 group-hover:text-slate-600">
                    {globalIndex}
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
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {sortedRows.length > 10 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="p-1 rounded border border-slate-200 bg-white font-medium text-slate-700 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-400 ml-2">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous page"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="font-mono text-xs px-2 font-medium text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next page"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
