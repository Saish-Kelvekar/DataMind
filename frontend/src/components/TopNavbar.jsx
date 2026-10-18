import React from 'react'
import {
  Menu,
  ChevronRight,
  Eye,
  Rocket,
  Activity
} from 'lucide-react'

export default function TopNavbar({
  backendStatus = { online: false },
  onRetryHealth,
  onOpenMobileMenu,
  onTogglePreview
}) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-500">
          <span className="hover:text-slate-800 cursor-pointer hidden sm:inline">Workspace</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
          <span className="hover:text-slate-800 cursor-pointer hidden sm:inline">DataMind</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
          <span className="text-slate-900 font-semibold flex items-center gap-1.5">
            <span>Analytics Agent</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded-md bg-blue-50 text-blue-600 border border-blue-200/60 hidden lg:inline">
              Snowflake + Gemma
            </span>
          </span>
        </div>
      </div>

      {/* Right: Agent Status, Preview & Deployment Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Agent Status Pill */}
        <button
          type="button"
          onClick={onRetryHealth}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
            backendStatus.online
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/70'
              : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/70'
          }`}
          title="Click to check backend status (GET /health)"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendStatus.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="hidden sm:inline">
            {backendStatus.online ? 'Agent Active' : 'Backend Offline'}
          </span>
          <Activity className="w-3 h-3 opacity-60 ml-0.5" />
        </button>

        {/* Preview Action Button */}
        <button
          type="button"
          onClick={onTogglePreview}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Live Preview</span>
        </button>

        {/* Deployment / Integration Action Button */}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shadow-sm transition-all cursor-pointer active:scale-98"
        >
          <Rocket className="w-3.5 h-3.5 text-blue-400" />
          <span>Deploy Agent</span>
        </button>
      </div>
    </header>
  )
}
