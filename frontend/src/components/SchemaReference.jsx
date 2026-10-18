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
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left text-slate-400 hover:text-slate-200 transition-colors cursor-pointer bg-slate-900/80"
      >
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-medium text-slate-300">Available Dataset Schema Reference</span>
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">(SNOWFLAKE_SAMPLE_DATA.TPCH_SF1)</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <span>{isOpen ? 'Collapse' : 'Inspect 3 Tables'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 grid grid-cols-1 md:grid-cols-3 gap-3">
          {TABLES.map((t, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Table className="w-3.5 h-3.5 text-blue-400" />
                <span>{t.name}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                {t.description}
              </p>
              <div className="pt-1.5 border-t border-slate-800/80">
                <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Key Columns:</span>
                <div className="flex flex-wrap gap-1">
                  {t.sampleColumns.map((col, cIdx) => (
                    <span
                      key={cIdx}
                      className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]"
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
