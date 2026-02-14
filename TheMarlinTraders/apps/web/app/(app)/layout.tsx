'use client'

import { ResponsiveWorkspace } from '../../components/responsive-workspace.js'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-navy-black">
      {/* Sidebar */}
      <aside className="hidden w-sidebar-w border-r border-border bg-navy-dark md:block">
        <div className="flex h-header-h items-center border-b border-border px-4">
          <span className="font-mono text-sm font-semibold text-text-primary">MARLIN</span>
        </div>
        {/* Sidebar content rendered from children if needed */}
      </aside>

      {/* Main content — Dockview workspace */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <ResponsiveWorkspace />
        {/* Preserve children rendering for nested routes */}
        <div className="hidden">{children}</div>
      </main>
    </div>
  )
}
