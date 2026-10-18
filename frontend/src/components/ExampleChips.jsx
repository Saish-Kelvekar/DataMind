import React from 'react'
import { Sparkles, BarChart3, Database, HelpCircle, Layers, ArrowUpRight } from 'lucide-react'

const EXAMPLES = [
  {
    category: 'Sort & Limit',
    icon: BarChart3,
    text: 'What are the five most expensive orders?'
  },
  {
    category: 'Record Count',
    icon: Database,
    text: 'How many customers are in the dataset?'
  },
  {
    category: 'Grouped Aggregate',
    icon: Layers,
    text: 'What is the total order value grouped by order status?'
  },
  {
    category: 'Join Tables',
    icon: Sparkles,
    text: 'Find the top five customers by total order value'
  },
  {
    category: 'Customer Balance',
    icon: BarChart3,
    text: 'Which customers have the highest account balances?'
  },
  {
    category: 'Empty Result Test',
    icon: HelpCircle,
    text: 'Show orders with a total price exceeding $10,000,000.'
  },
  {
    category: 'Out of Scope Test',
    icon: HelpCircle,
    text: 'What is the weather in Dharwad tomorrow?'
  }
]

export default function ExampleChips({ onSelectExample, disabled }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-500">
          Example Analytical Questions
        </span>
        <span className="text-slate-400 text-[11px]">Click any chip to populate query</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={index}
              type="button"
              disabled={disabled}
              onClick={() => onSelectExample(item.text)}
              className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 text-xs font-medium text-slate-600 hover:text-blue-600 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>{item.text}</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-blue-500 opacity-60 group-hover:opacity-100 transition-opacity" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
