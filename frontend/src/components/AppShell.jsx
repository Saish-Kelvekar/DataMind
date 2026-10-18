import React, { useState } from 'react'
import Sidebar from './Sidebar'
import TopNavbar from './TopNavbar'

export default function AppShell({
  children,
  backendStatus,
  onRetryHealth,
  activeNav,
  setActiveNav
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans antialiased text-slate-900 overflow-hidden">
      {/* Fixed Left Sidebar */}
      <Sidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        backendOnline={backendStatus?.online}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Execution Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Sticky Top Header */}
        <TopNavbar
          backendStatus={backendStatus}
          onRetryHealth={onRetryHealth}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {/* Scrollable Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
