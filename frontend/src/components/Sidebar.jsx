import React from 'react'
import {
  Database,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  History,
  Code2,
  Settings,
  ChevronDown,
  ChevronsUpDown,
  X
} from 'lucide-react'

export default function Sidebar({
  activeNav = 'playground',
  setActiveNav,
  backendOnline = false,
  isOpen = false,
  onClose
}) {
  const navItems = [
    { id: 'playground', label: 'Query Playground', icon: MessageSquare, badge: 'Live' },
    { id: 'datasources', label: 'Data Sources', icon: Database, badge: '3 Tables' },
    { id: 'models', label: 'Model & Prompts', icon: Sparkles, badge: 'Gemma' },
    { id: 'guardrails', label: 'AST Guardrails', icon: ShieldCheck, badge: 'sqlglot' },
    { id: 'history', label: 'Query History', icon: History },
    { id: 'api', label: 'API & Webhooks', icon: Code2 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top: Branding & Workspace Selector */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-slate-900 block leading-tight">
                  DataMind
                </span>
                <span className="text-[11px] font-medium text-slate-400 block">
                  Talk to Your Data
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Workspace Switcher Card */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/70 transition-colors cursor-pointer group">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  TPC-H SF1 Workspace
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  Snowflake Sample Data
                </p>
              </div>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
          </div>
        </div>

        {/* Middle: Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Analytics Workspace
            </p>
            <nav className="space-y-1">
              {navItems.slice(0, 4).map((item) => {
                const Icon = item.icon
                const isActive = activeNav === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (setActiveNav) setActiveNav(item.id)
                      if (onClose) onClose()
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${
                          isActive
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Configuration
            </p>
            <nav className="space-y-1">
              {navItems.slice(4).map((item) => {
                const Icon = item.icon
                const isActive = activeNav === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (setActiveNav) setActiveNav(item.id)
                      if (onClose) onClose()
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
                      />
                      <span>{item.label}</span>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Bottom: User Profile Section */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100/80 transition-colors cursor-pointer group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-800 to-slate-700 text-white flex items-center justify-center font-semibold text-xs shrink-0 shadow-xs">
                SK
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  Saish Kelvekar
                </p>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      backendOnline ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <p className="text-[10px] text-slate-400 truncate">
                    Hackathon · Team Pro
                  </p>
                </div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
          </div>
        </div>
      </aside>
    </>
  )
}
