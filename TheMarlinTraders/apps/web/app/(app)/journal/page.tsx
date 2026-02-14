'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@marlin/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@marlin/ui/primitives/card'
import { cn } from '@marlin/ui/lib/utils'
import { CalendarHeatmap, type DayPnL } from '@marlin/ui/trading/calendar-heatmap'
import { EquityCurve, type EquityCurvePoint } from '@marlin/ui/trading/equity-curve'
import { JournalEntryCard, type JournalEntryData } from '@marlin/ui/trading/journal-entry-card'

type SetupType = 'breakout' | 'pullback' | 'reversal' | 'range' | 'momentum' | 'other'
type TradeGrade = 'A' | 'B' | 'C' | 'D' | 'F'

interface FilterState {
  setupType: SetupType | null
  grade: TradeGrade | null
  tag: string | null
  dateRange: 'week' | 'month' | '3months' | 'year' | 'all'
}

const SETUP_TYPES: SetupType[] = ['breakout', 'pullback', 'reversal', 'range', 'momentum', 'other']
const GRADES: TradeGrade[] = ['A', 'B', 'C', 'D', 'F']
const DATE_RANGES = [
  { value: 'week' as const, label: '1W' },
  { value: 'month' as const, label: '1M' },
  { value: '3months' as const, label: '3M' },
  { value: 'year' as const, label: '1Y' },
  { value: 'all' as const, label: 'All' },
]

function formatSetupType(setup: string): string {
  return setup
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function getDateRangeStart(range: FilterState['dateRange']): Date | null {
  const now = new Date()
  switch (range) {
    case 'week':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    case 'month':
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    case '3months':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    case 'year':
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    case 'all':
      return null
  }
}

// Placeholder data — will be replaced with tRPC queries
const MOCK_ENTRIES: JournalEntryData[] = [
  {
    id: '1',
    symbol: 'AAPL',
    side: 'buy',
    entryPrice: '178.50',
    exitPrice: '185.20',
    quantity: '100',
    pnl: '670.00',
    rMultiple: '2.15',
    setupType: 'breakout',
    grade: 'A',
    tags: ['earnings', 'momentum'],
    entryDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    exitDate: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '2',
    symbol: 'TSLA',
    side: 'sell',
    entryPrice: '245.00',
    exitPrice: '238.30',
    quantity: '50',
    pnl: '335.00',
    rMultiple: '1.50',
    setupType: 'reversal',
    grade: 'B',
    tags: ['gap-fill'],
    entryDate: new Date(Date.now() - 86400000 * 3).toISOString(),
    exitDate: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: '3',
    symbol: 'NVDA',
    side: 'buy',
    entryPrice: '880.00',
    exitPrice: '872.50',
    quantity: '20',
    pnl: '-150.00',
    rMultiple: '-0.75',
    setupType: 'pullback',
    grade: 'D',
    tags: ['ai', 'tech'],
    entryDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    exitDate: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: '4',
    symbol: 'META',
    side: 'buy',
    entryPrice: '505.00',
    exitPrice: '515.80',
    quantity: '30',
    pnl: '324.00',
    rMultiple: '1.80',
    setupType: 'momentum',
    grade: 'A',
    tags: ['social', 'momentum'],
    entryDate: new Date(Date.now() - 86400000 * 7).toISOString(),
    exitDate: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: '5',
    symbol: 'SPY',
    side: 'sell',
    entryPrice: '520.00',
    exitPrice: '522.50',
    quantity: '100',
    pnl: '-250.00',
    rMultiple: '-1.00',
    setupType: 'range',
    grade: 'F',
    tags: ['index'],
    entryDate: new Date(Date.now() - 86400000 * 10).toISOString(),
    exitDate: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
]

export default function JournalPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<FilterState>({
    setupType: null,
    grade: null,
    tag: null,
    dateRange: 'all',
  })

  // Filter entries
  const filteredEntries = useMemo(() => {
    let entries = MOCK_ENTRIES
    const rangeStart = getDateRangeStart(filters.dateRange)

    if (rangeStart) {
      entries = entries.filter((e) => new Date(e.entryDate) >= rangeStart)
    }
    if (filters.setupType) {
      entries = entries.filter((e) => e.setupType === filters.setupType)
    }
    if (filters.grade) {
      entries = entries.filter((e) => e.grade === filters.grade)
    }
    if (filters.tag) {
      entries = entries.filter((e) => e.tags.includes(filters.tag!))
    }
    return entries
  }, [filters])

  // Build heatmap data
  const heatmapData: DayPnL[] = useMemo(() => {
    const dayMap = new Map<string, DayPnL>()
    for (const entry of MOCK_ENTRIES) {
      const date = new Date(entry.entryDate).toISOString().slice(0, 10)
      const existing = dayMap.get(date)
      const pnl = entry.pnl ? parseFloat(entry.pnl) : 0
      if (existing) {
        existing.pnl += pnl
        existing.tradeCount += 1
      } else {
        dayMap.set(date, { date, pnl, tradeCount: 1 })
      }
    }
    return Array.from(dayMap.values())
  }, [])

  // Build equity curve data
  const equityCurveData: EquityCurvePoint[] = useMemo(() => {
    const sorted = [...MOCK_ENTRIES]
      .filter((e) => e.pnl !== null)
      .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())

    let cumulative = 0
    return sorted.map((e) => {
      cumulative += parseFloat(e.pnl!)
      return {
        date: new Date(e.entryDate).toISOString().slice(0, 10),
        cumulativePnl: cumulative,
      }
    })
  }, [])

  // Aggregate stats
  const stats = useMemo(() => {
    const withPnl = filteredEntries.filter((e) => e.pnl !== null)
    const totalPnl = withPnl.reduce((sum, e) => sum + parseFloat(e.pnl!), 0)
    const winners = withPnl.filter((e) => parseFloat(e.pnl!) > 0)
    const winRate = withPnl.length > 0 ? (winners.length / withPnl.length) * 100 : 0
    return { totalPnl, winRate, totalTrades: filteredEntries.length }
  }, [filteredEntries])

  // All unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const e of MOCK_ENTRIES) {
      for (const t of e.tags) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Trade Journal</h1>
          <p className="text-xs text-text-muted">
            {stats.totalTrades} trades | Win rate {stats.winRate.toFixed(1)}% |{' '}
            <span className={stats.totalPnl >= 0 ? 'text-trading-green' : 'text-trading-red'}>
              {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
            </span>
          </p>
        </div>
        <Button size="sm" onClick={() => router.push('/journal/new')}>
          + New Entry
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Heatmap + Equity Curve */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Daily P&L</CardTitle>
              </CardHeader>
              <CardContent>
                <CalendarHeatmap
                  data={heatmapData}
                  weeks={20}
                  onDayClick={(date) => {
                    setFilters((f) => ({ ...f, dateRange: 'all' }))
                  }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Equity Curve</CardTitle>
              </CardHeader>
              <CardContent>
                <EquityCurve data={equityCurveData} height={140} />
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date range */}
            <div className="flex rounded-md border border-border">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  className={cn(
                    'px-3 py-1 text-xs font-medium transition-colors',
                    filters.dateRange === r.value
                      ? 'bg-accent text-text-primary'
                      : 'text-text-muted hover:text-text-primary',
                  )}
                  onClick={() => setFilters((f) => ({ ...f, dateRange: r.value }))}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Setup type chips */}
            {SETUP_TYPES.map((setup) => (
              <button
                key={setup}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs transition-colors',
                  filters.setupType === setup
                    ? 'bg-accent text-text-primary'
                    : 'bg-navy-mid text-text-muted hover:text-text-primary',
                )}
                onClick={() =>
                  setFilters((f) => ({ ...f, setupType: f.setupType === setup ? null : setup }))
                }
              >
                {formatSetupType(setup)}
              </button>
            ))}

            <div className="h-4 w-px bg-border" />

            {/* Grade chips */}
            {GRADES.map((grade) => (
              <button
                key={grade}
                className={cn(
                  'h-6 w-6 rounded text-xs font-bold transition-colors',
                  filters.grade === grade
                    ? 'bg-accent text-text-primary'
                    : 'bg-navy-mid text-text-muted hover:text-text-primary',
                )}
                onClick={() =>
                  setFilters((f) => ({ ...f, grade: f.grade === grade ? null : grade }))
                }
              >
                {grade}
              </button>
            ))}

            <div className="h-4 w-px bg-border" />

            {/* Tag chips */}
            {allTags.map((tag) => (
              <button
                key={tag}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs transition-colors',
                  filters.tag === tag
                    ? 'bg-accent/20 text-accent'
                    : 'bg-navy-mid text-text-muted hover:text-text-primary',
                )}
                onClick={() =>
                  setFilters((f) => ({ ...f, tag: f.tag === tag ? null : tag }))
                }
              >
                #{tag}
              </button>
            ))}

            {/* Clear filters */}
            {(filters.setupType || filters.grade || filters.tag || filters.dateRange !== 'all') && (
              <button
                className="text-xs text-text-muted underline hover:text-text-primary"
                onClick={() => setFilters({ setupType: null, grade: null, tag: null, dateRange: 'all' })}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Entry list header */}
          <div className="flex items-center gap-4 px-4 text-[10px] font-medium uppercase tracking-wider text-text-muted">
            <div className="w-20">Date</div>
            <div className="w-24">Symbol</div>
            <div className="w-24 text-right">P&L</div>
            <div className="w-16 text-right">R</div>
            <div className="hidden w-24 sm:block">Setup</div>
            <div className="w-8">Grade</div>
            <div className="hidden flex-1 lg:block">Tags</div>
          </div>

          {/* Entry list */}
          <div className="space-y-1">
            {filteredEntries.length > 0 ? (
              filteredEntries.map((entry) => (
                <JournalEntryCard
                  key={entry.id}
                  entry={entry}
                  onClick={(id) => router.push(`/journal/${id}`)}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <span className="text-sm text-text-muted">No journal entries found</span>
                <Button variant="outline" size="sm" onClick={() => router.push('/journal/new')}>
                  Log your first trade
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
