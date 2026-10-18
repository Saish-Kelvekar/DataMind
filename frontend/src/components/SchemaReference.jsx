import React, { useState } from 'react'
import { Database, ChevronDown, ChevronUp, Table } from 'lucide-react'

const TABLES = [
  {
    name: 'CUSTOMER',
    fullName: 'SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.CUSTOMER',
    description: 'Customer profiles, account balances, nation references, and market segments.',
    sampleColumns: ['C_CUSTKEY', 'C_NAME', 'C_ADDRESS', 'C_NATIONKEY', 'C_PHONE', 'C_ACCTBAL', 'C_MKTSEGMENT']
  },
  {
    name: 'ORDERS',
    fullName: 'SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS',
    description: 'Order headers, total price, status (F, O, P), date range (1992–1998), and customer references.',
    sampleColumns: ['O_ORDERKEY', 'O_CUSTKEY', 'O_ORDERSTATUS', 'O_TOTALPRICE', 'O_ORDERDATE', 'O_ORDERPRIORITY']
  },
  {
    name: 'LINEITEM',
    fullName: 'SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.LINEITEM',
    description: 'Line item details, quantities, extended prices, discounts, tax, and ship dates.',
    sampleColumns: ['L_ORDERKEY', 'L_PARTKEY', 'L_SUPPKEY', 'L_LINENUMBER', 'L_QUANTITY', 'L_EXTENDEDPRICE', 'L_DISCOUNT']
  }
]

export default function SchemaReference() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-2xl bg-white border border-slate-200/90 text-xs overflow-hidden shadow-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left text-slate-700 hover:text-slate-900 transition-colors cursor-pointer bg-white"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-slate-800">Available Dataset Schema Reference</span>
          <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">(SNOWFLAKE_SAMPLE_DATA.TPCH_SF1)</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
          <span>{isOpen ? 'Collapse' : 'Inspect 3 Tables'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 grid grid-cols-1 md:grid-cols-3 gap-3">
          {TABLES.map((t, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <Table className="w-3.5 h-3.5 text-blue-600" />
                <span>{t.name}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                {t.description}
              </p>
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-semibold block mb-1">Key Columns:</span>
                <div className="flex flex-wrap gap-1">
                  {t.sampleColumns.map((col, cIdx) => (
                    <span
                      key={cIdx}
                      className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] border border-slate-200/60"
                    >
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
