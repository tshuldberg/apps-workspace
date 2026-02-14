'use client'

import { useRef, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'
import type { Expiration } from '@marlin/shared'

export interface ExpirationTabsProps {
  expirations: Expiration[]
  selected: string | null
  onSelect: (date: string) => void
  className?: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ExpirationTabs({ expirations, selected, onSelect, className }: ExpirationTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { weeklies, monthlies } = useMemo(() => {
    const weeklies: Expiration[] = []
    const monthlies: Expiration[] = []
    for (const exp of expirations) {
      if (exp.isMonthly) {
        monthlies.push(exp)
      } else {
        weeklies.push(exp)
      }
    }
    return { weeklies, monthlies }
  }, [expirations])

  const handleScroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = 200
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }, [])

  // Merge into one sorted list with group labels
  const allSorted = useMemo(
    () => [...expirations].sort((a, b) => a.date.localeCompare(b.date)),
    [expirations],
  )

  return (
    <div className={cn('flex items-center gap-1 border-b border-border bg-navy-dark px-2 py-1', className)}>
      {/* Scroll left */}
      <button
        type="button"
        onClick={() => handleScroll('left')}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-navy-light hover:text-text-secondary"
        aria-label="Scroll left"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {/* Scrollable tabs */}
      <div
        ref={scrollRef}
        className="flex flex-1 gap-1 overflow-x-auto scrollbar-hide"
      >
        {allSorted.map((exp) => {
          const isActive = selected === exp.date
          return (
            <button
              key={exp.date}
              type="button"
              onClick={() => onSelect(exp.date)}
              className={cn(
                'flex shrink-0 flex-col items-center rounded px-3 py-1 transition-colors',
                isActive
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
                exp.isMonthly && !isActive && 'text-text-secondary',
              )}
            >
              <span className="text-[11px] font-medium leading-tight">
                {formatDate(exp.date)}
              </span>
              <span className={cn(
                'text-[9px] leading-tight',
                isActive ? 'text-text-primary/70' : 'text-text-muted',
              )}>
                {exp.dte}d
                {exp.isMonthly && ' M'}
              </span>
            </button>
          )
        })}

        {expirations.length === 0 && (
          <span className="py-1 text-xs text-text-muted">No expirations available</span>
        )}
      </div>

      {/* Scroll right */}
      <button
        type="button"
        onClick={() => handleScroll('right')}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-navy-light hover:text-text-secondary"
        aria-label="Scroll right"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  )
}
