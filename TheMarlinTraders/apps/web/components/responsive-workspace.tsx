'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SerializedDockview } from 'dockview-react'
import { Workspace } from './workspace.js'

const TABLET_BREAKPOINT = 768

type MobileTab = 'chart' | 'watchlist' | 'order' | 'news'

const MOBILE_TABS: { id: MobileTab; label: string }[] = [
  { id: 'chart', label: 'Chart' },
  { id: 'watchlist', label: 'Watch' },
  { id: 'order', label: 'Order' },
  { id: 'news', label: 'News' },
]

interface ResponsiveWorkspaceProps {
  savedLayout?: SerializedDockview | null
  onLayoutChange?: (layout: SerializedDockview) => void
}

export function ResponsiveWorkspace({ savedLayout, onLayoutChange }: ResponsiveWorkspaceProps) {
  const [isDesktop, setIsDesktop] = useState(true)
  const [activeTab, setActiveTab] = useState<MobileTab>('chart')

  useEffect(() => {
    function checkViewport() {
      setIsDesktop(window.innerWidth >= TABLET_BREAKPOINT)
    }
    checkViewport()
    window.addEventListener('resize', checkViewport)
    return () => window.removeEventListener('resize', checkViewport)
  }, [])

  const handleTabChange = useCallback((tab: MobileTab) => {
    setActiveTab(tab)
  }, [])

  // Desktop: full Dockview layout
  if (isDesktop) {
    return <Workspace savedLayout={savedLayout} onLayoutChange={onLayoutChange} />
  }

  // Mobile/Tablet: tab-based navigation
  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chart' && (
          <div className="flex h-full items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-lg font-semibold text-text-primary">Chart</div>
              <div className="mt-1 text-xs">Mobile chart view — uses native chart component</div>
            </div>
          </div>
        )}
        {activeTab === 'watchlist' && (
          <div className="flex h-full items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-lg font-semibold text-text-primary">Watchlist</div>
              <div className="mt-1 text-xs">Mobile watchlist view</div>
            </div>
          </div>
        )}
        {activeTab === 'order' && (
          <div className="flex h-full items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-lg font-semibold text-text-primary">Order Entry</div>
              <div className="mt-1 text-xs">Mobile order entry view</div>
            </div>
          </div>
        )}
        {activeTab === 'news' && (
          <div className="flex h-full items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-lg font-semibold text-text-primary">News</div>
              <div className="mt-1 text-xs">Mobile news feed</div>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-t border-border bg-navy-dark">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-navy-mid text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
