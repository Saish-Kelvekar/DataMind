import React, { useState, useMemo } from 'react'
import { BarChart3, Info } from 'lucide-react'

export default function DataVisualizer({ columns = [], rows = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  // Analyze columns to find suitable category (X-axis) and numeric (Y-axis) fields
  const chartConfig = useMemo(() => {
    if (!columns.length || rows.length < 2 || rows.length > 50) {
      return null
    }

    // Find first numeric column
    let metricIndex = -1
    for (let c = 0; c < columns.length; c++) {
      const isNumeric = rows.some((r) => typeof r[c] === 'number')
      if (isNumeric) {
        metricIndex = c
        break
      }
    }

    if (metricIndex === -1) return null

    // Find first non-numeric or label column
    let labelIndex = 0
    for (let c = 0; c < columns.length; c++) {
      if (c !== metricIndex) {
        labelIndex = c
        break
      }
    }

    const metricName = columns[metricIndex]
    const labelName = columns[labelIndex]

    // Extract items
    const items = rows
      .map((row) => ({
        label: String(row[labelIndex] ?? 'N/A'),
        value: typeof row[metricIndex] === 'number' ? row[metricIndex] : parseFloat(row[metricIndex]) || 0,
        rawValue: row[metricIndex]
      }))
      .filter((item) => !isNaN(item.value))

    if (items.length < 2) return null

    const maxValue = Math.max(...items.map((i) => i.value), 1)
    const totalValue = items.reduce((acc, curr) => acc + curr.value, 0)
    const avgValue = totalValue / items.length

    return {
      metricName,
      labelName,
      items,
      maxValue,
      totalValue,
      avgValue
    }
  }, [columns, rows])

  if (!chartConfig) {
    return null
  }

  const { metricName, labelName, items, maxValue, avgValue } = chartConfig
  const isMonetary = metricName.toUpperCase().includes('PRICE') || metricName.toUpperCase().includes('SALES') || metricName.toUpperCase().includes('BALANCE')

  const formatVal = (v) => {
    if (isMonetary) {
      return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return v.toLocaleString()
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              Visual Distribution: <span className="text-blue-600">{metricName}</span> by {labelName}
            </h4>
            <p className="text-[11px] text-slate-400">
              Computed directly from {items.length} returned Snowflake rows
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-400">Max: </span>
            <span className="font-semibold text-slate-800">{formatVal(maxValue)}</span>
          </div>
          <div className="hidden sm:inline">
            <span className="text-slate-400">Avg: </span>
            <span className="font-semibold text-slate-800">{formatVal(avgValue)}</span>
          </div>
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="pt-2">
        <div className="space-y-2.5">
          {items.map((item, idx) => {
            const percentage = Math.max((item.value / maxValue) * 100, 2)
            const isHovered = hoveredIndex === idx

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  isHovered ? 'bg-slate-50 ring-1 ring-blue-500/20' : ''
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 truncate max-w-[200px] sm:max-w-xs">
                    {item.label}
                  </span>
                  <span className="font-mono font-semibold text-slate-900 ml-2">
                    {formatVal(item.value)}
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative">
                  <div
                    style={{ width: `${percentage}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      isHovered
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                        : 'bg-gradient-to-r from-blue-500 to-sky-500'
                    }`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Chart renders dynamically only for multi-row datasets with verifiable numeric metrics. Full row records remain below.</span>
      </div>
    </div>
  )
}
