'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@marlin/ui/primitives/card'
import { cn } from '@marlin/ui/lib/utils'
import {
  PerformanceMetrics,
  type PerformanceMetricsData,
} from '@marlin/ui/trading/performance-metrics'
import {
  EquityDrawdownChart,
  type EquityDrawdownPoint,
} from '@marlin/ui/trading/equity-drawdown-chart'
import { TimeOfDayChart, type HourlyData } from '@marlin/ui/trading/time-of-day-chart'
import {
  SetupBreakdown,
  type SetupBreakdownData,
} from '@marlin/ui/trading/setup-breakdown'
import {
  HoldingTimeChart,
  type HoldingTimeData,
} from '@marlin/ui/trading/holding-time-chart'
import { ExportButton, type ExportableData } from '@marlin/ui/trading/export-button'

// ─── Date Range ────────────────────────────────────────────────

type DateRangeKey = '1W' | '1M' | '3M' | '6M' | '1Y' | 'All'

const DATE_RANGES: { value: DateRangeKey; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'All', label: 'All' },
]

function getDateRangeISO(range: DateRangeKey): { startDate?: string; endDate?: string } {
  if (range === 'All') return {}
  const now = new Date()
  const start = new Date(now)
  switch (range) {
    case '1W':
      start.setDate(start.getDate() - 7)
      break
    case '1M':
      start.setMonth(start.getMonth() - 1)
      break
    case '3M':
      start.setMonth(start.getMonth() - 3)
      break
    case '6M':
      start.setMonth(start.getMonth() - 6)
      break
    case '1Y':
      start.setFullYear(start.getFullYear() - 1)
      break
  }
  return {
    startDate: start.toISOString(),
    endDate: now.toISOString(),
  }
}

// ─── Placeholder Data ──────────────────────────────────────────
// Will be replaced with tRPC queries:
//   trpc.performance.getOverview.useQuery(dateRange)
//   trpc.performance.getEquityCurve.useQuery(dateRange)
//   trpc.performance.getTimeOfDay.useQuery(dateRange)
//   trpc.performance.getSetupBreakdown.useQuery(dateRange)
//   trpc.performance.getHoldingTime.useQuery(dateRange)

const MOCK_METRICS: PerformanceMetricsData = {
  winRate: 58.3,
  profitFactor: 1.87,
  expectancy: 142.5,
  sharpeRatio: 1.42,
  sortinoRatio: 2.15,
  maxDrawdown: 1250.0,
  maxDrawdownDuration: 12,
  totalPnl: 8540.0,
  totalTrades: 48,
  avgWin: 385.2,
  avgLoss: -206.0,
  avgHoldingTime: 4.5,
}

function generateMockEquityCurve(): EquityDrawdownPoint[] {
  const points: EquityDrawdownPoint[] = []
  let cumPnl = 0
  let peak = 0
  const baseDate = new Date()
  baseDate.setMonth(baseDate.getMonth() - 3)

  for (let i = 0; i < 48; i++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + i * 2)
    const pnl = (Math.random() - 0.4) * 500
    cumPnl += pnl
    if (cumPnl > peak) peak = cumPnl
    const drawdown = peak > 0 ? ((peak - cumPnl) / peak) * 100 : 0

    points.push({
      date: date.toISOString().slice(0, 10),
      cumulativePnl: Math.round(cumPnl * 100) / 100,
      drawdown: Math.round(Math.max(0, drawdown) * 100) / 100,
    })
  }
  return points
}

function generateMockTimeOfDay(): HourlyData[] {
  const hours: HourlyData[] = []
  for (let h = 0; h < 24; h++) {
    const isMarketHour = h >= 9 && h <= 16
    const count = isMarketHour ? Math.floor(Math.random() * 12) + 3 : Math.floor(Math.random() * 2)
    const avgPnl = count > 0 ? (Math.random() - 0.45) * 400 : 0
    const winRate = count > 0 ? Math.random() * 40 + 35 : 0
    hours.push({
      hour: h,
      avgPnl: Math.round(avgPnl * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      count,
      totalPnl: Math.round(avgPnl * count * 100) / 100,
    })
  }
  return hours
}

const MOCK_SETUP_BREAKDOWN: SetupBreakdownData[] = [
  { setupType: 'breakout', winRate: 65.0, avgPnl: 280.5, count: 14, totalPnl: 3927.0 },
  { setupType: 'pullback', winRate: 52.0, avgPnl: 120.3, count: 12, totalPnl: 1443.6 },
  { setupType: 'reversal', winRate: 45.0, avgPnl: -85.2, count: 8, totalPnl: -681.6 },
  { setupType: 'momentum', winRate: 72.0, avgPnl: 350.0, count: 7, totalPnl: 2450.0 },
  { setupType: 'range', winRate: 40.0, avgPnl: -120.0, count: 5, totalPnl: -600.0 },
  { setupType: 'other', winRate: 50.0, avgPnl: 0.5, count: 2, totalPnl: 1.0 },
]

function generateMockHoldingTime(): HoldingTimeData[] {
  const symbols = ['AAPL', 'TSLA', 'NVDA', 'META', 'SPY', 'AMZN', 'MSFT', 'GOOGL']
  return Array.from({ length: 48 }, (_, i) => {
    const hours = Math.random() * 48 + 0.5
    return {
      holdingTimeHours: Math.round(hours * 100) / 100,
      pnl: Math.round(((Math.random() - 0.4) * 800) * 100) / 100,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      date: new Date(Date.now() - i * 2 * 86400000).toISOString().slice(0, 10),
    }
  })
}

// ─── Page Component ────────────────────────────────────────────

export default function PerformancePage() {
  const [dateRange, setDateRange] = useState<DateRangeKey>('3M')

  // In production, these would be tRPC queries using the date range:
  // const _range = getDateRangeISO(dateRange)
  const metrics = MOCK_METRICS
  const equityCurve = useMemo(generateMockEquityCurve, [])
  const timeOfDay = useMemo(generateMockTimeOfDay, [])
  const setupBreakdown = MOCK_SETUP_BREAKDOWN
  const holdingTime = useMemo(generateMockHoldingTime, [])

  // Build export payload
  const exportData: ExportableData = useMemo(
    () => ({
      metrics: {
        'Win Rate': `${metrics.winRate}%`,
        'Total P&L': `$${metrics.totalPnl}`,
        'Profit Factor': metrics.profitFactor,
        Expectancy: `$${metrics.expectancy}`,
        'Sharpe Ratio': metrics.sharpeRatio,
        'Sortino Ratio': metrics.sortinoRatio,
        'Max Drawdown': `$${metrics.maxDrawdown}`,
        'Max DD Duration': `${metrics.maxDrawdownDuration} days`,
        'Total Trades': metrics.totalTrades,
        'Avg Win': `$${metrics.avgWin}`,
        'Avg Loss': `$${metrics.avgLoss}`,
        'Avg Holding Time': `${metrics.avgHoldingTime}h`,
      },
      equityCurve,
      timeOfDay,
      setupBreakdown,
      holdingTime,
    }),
    [metrics, equityCurve, timeOfDay, setupBreakdown, holdingTime],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black print:bg-white print:text-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-4 print:border-gray-200 print:bg-white">
        <div>
          <h1 className="text-lg font-semibold text-text-primary print:text-black">
            Performance Dashboard
          </h1>
          <p className="text-xs text-text-muted print:text-gray-500">
            Analyze your trading performance across all dimensions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <div className="flex rounded-md border border-border print:hidden">
            {DATE_RANGES.map((r) => (
              <button
                key={r.value}
                className={cn(
                  'px-3 py-1 text-xs font-medium transition-colors',
                  dateRange === r.value
                    ? 'bg-accent text-text-primary'
                    : 'text-text-muted hover:text-text-primary',
                )}
                onClick={() => setDateRange(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <ExportButton data={exportData} filename="marlin-performance" className="print:hidden" />
        </div>
      </div>

      {/* Dashboard content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Metric Cards */}
          <PerformanceMetrics data={metrics} />

          {/* Equity Curve + Drawdown */}
          <Card className="print:border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Equity Curve & Drawdown</CardTitle>
            </CardHeader>
            <CardContent>
              <EquityDrawdownChart data={equityCurve} height={280} />
            </CardContent>
          </Card>

          {/* Two-column: Time of Day + Setup Breakdown */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="print:border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Time of Day Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <TimeOfDayChart data={timeOfDay} height={200} />
              </CardContent>
            </Card>

            <Card className="print:border-gray-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Setup Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <SetupBreakdown data={setupBreakdown} />
              </CardContent>
            </Card>
          </div>

          {/* Holding Time Scatter */}
          <Card className="print:border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Holding Time vs. P&L</CardTitle>
            </CardHeader>
            <CardContent>
              <HoldingTimeChart data={holdingTime} height={240} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
