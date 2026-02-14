'use client'

import { useState, useCallback, useMemo } from 'react'
import { cn } from '@marlin/ui/lib/utils'
import { StrategyIDE } from '@marlin/ui/trading/strategy-ide'
import type { StrategyTab } from '@marlin/ui/trading/strategy-ide'
import type {
  StrategyTemplate,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
} from '@marlin/shared'
import {
  STRATEGY_TEMPLATES,
} from '@marlin/shared'

// ── Mock Data ──────────────────────────────────────────────────────────────
// TODO: Replace with tRPC queries
// trpc.strategy.list.useQuery()
// trpc.strategy.getTemplates.useQuery()
// trpc.strategy.create.useMutation()
// trpc.strategy.update.useMutation()
// trpc.strategy.validate.useMutation()

interface StrategySidebarItem {
  id: string
  name: string
  language: 'typescript' | 'python' | 'pine'
  updatedAt: string
}

const MOCK_STRATEGIES: StrategySidebarItem[] = [
  { id: 's1', name: 'My MA Strategy', language: 'typescript', updatedAt: '2026-02-14T10:00:00Z' },
  { id: 's2', name: 'RSI Reversal v2', language: 'typescript', updatedAt: '2026-02-13T15:30:00Z' },
  { id: 's3', name: 'Breakout Scalper', language: 'typescript', updatedAt: '2026-02-12T09:00:00Z' },
]

// Generate realistic mock backtest data
function generateMockBacktestResult(): BacktestResult {
  const initialCapital = 100_000
  const startDate = new Date('2025-06-01')
  const trades: BacktestTrade[] = []
  const equity: EquityPoint[] = []

  let currentEquity = initialCapital
  let tradeId = 1

  // Simulate ~60 trades over 6 months
  for (let week = 0; week < 35; week++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + week * 5)

    // 1-2 trades per week on average
    const tradeCount = Math.random() > 0.4 ? 2 : 1
    for (let t = 0; t < tradeCount && tradeId <= 62; t++) {
      const entryDate = new Date(date)
      entryDate.setDate(entryDate.getDate() + Math.floor(Math.random() * 3))
      const holdDays = 1 + Math.floor(Math.random() * 8)
      const exitDate = new Date(entryDate)
      exitDate.setDate(exitDate.getDate() + holdDays)

      const side = Math.random() > 0.35 ? 'long' : 'short' as const
      const entryPrice = 180 + Math.random() * 40
      const winLoss = Math.random()
      const isWin = winLoss > 0.42 // ~58% win rate
      const movePercent = isWin
        ? 0.005 + Math.random() * 0.035
        : -(0.003 + Math.random() * 0.025)

      const exitPrice = side === 'long'
        ? entryPrice * (1 + movePercent)
        : entryPrice * (1 - movePercent)

      const quantity = Math.floor(50 + Math.random() * 150)
      const pnl = side === 'long'
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity
      const commission = quantity * 0.005 + 1.0
      const netPnl = pnl - commission

      trades.push({
        id: `t-${tradeId}`,
        entryDate: entryDate.toISOString(),
        exitDate: exitDate.toISOString(),
        side,
        entryPrice: Math.round(entryPrice * 100) / 100,
        exitPrice: Math.round(exitPrice * 100) / 100,
        quantity,
        pnl: Math.round(netPnl * 100) / 100,
        pnlPercent: Math.round((netPnl / currentEquity) * 10000) / 100,
        commission: Math.round(commission * 100) / 100,
        holdingPeriodBars: holdDays,
        reason: isWin ? 'Target reached' : 'Stop hit',
      })

      currentEquity += netPnl
      tradeId++
    }

    // Record equity point at end of each week
    const drawdown = currentEquity < initialCapital
      ? ((initialCapital - currentEquity) / initialCapital) * 100
      : 0

    equity.push({
      date: date.toISOString().slice(0, 10),
      equity: Math.round(currentEquity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    })
  }

  // Calculate metrics from trades
  const winners = trades.filter((t) => t.pnl > 0)
  const losers = trades.filter((t) => t.pnl < 0)
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0)
  const totalReturn = (totalPnl / initialCapital) * 100
  const winRate = trades.length > 0 ? winners.length / trades.length : 0
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + t.pnl, 0) / winners.length : 0
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + t.pnl, 0) / losers.length : 0
  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0
  const expectancy = trades.length > 0 ? totalPnl / trades.length : 0

  // Simplified Sharpe (annualized weekly returns)
  const weeklyReturns: number[] = []
  for (let i = 1; i < equity.length; i++) {
    const ret = (equity[i]!.equity - equity[i - 1]!.equity) / equity[i - 1]!.equity
    weeklyReturns.push(ret)
  }
  const meanReturn = weeklyReturns.reduce((s, r) => s + r, 0) / (weeklyReturns.length || 1)
  const variance = weeklyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (weeklyReturns.length || 1)
  const stdDev = Math.sqrt(variance)
  const sharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(52) : 0

  // Simplified Sortino (downside deviation only)
  const downsideReturns = weeklyReturns.filter((r) => r < 0)
  const downsideVariance = downsideReturns.reduce((s, r) => s + r ** 2, 0) / (downsideReturns.length || 1)
  const downsideStdDev = Math.sqrt(downsideVariance)
  const sortino = downsideStdDev > 0 ? (meanReturn / downsideStdDev) * Math.sqrt(52) : 0

  const maxDrawdown = Math.max(...equity.map((e) => e.drawdown), 0)

  return {
    trades,
    equity,
    metrics: {
      totalReturn: Math.round(totalReturn * 100) / 100,
      sharpe: Math.round(sharpe * 100) / 100,
      sortino: Math.round(sortino * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      winRate: Math.round(winRate * 1000) / 1000,
      profitFactor: Math.round(profitFactor * 100) / 100,
      totalTrades: trades.length,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
    },
  }
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function StrategyPage() {
  const [tabs, setTabs] = useState<StrategyTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{ line: number; message: string }[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Stable mock result — only generate when running
  const mockResult = useMemo(() => generateMockBacktestResult(), [])

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTabId(tabId)
    setBacktestResult(null)
    setValidationErrors([])
  }, [])

  const handleTabClose = useCallback((tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId)
      if (tabId === activeTabId && next.length > 0) {
        setActiveTabId(next[next.length - 1]!.id)
      } else if (next.length === 0) {
        setActiveTabId(null)
      }
      return next
    })
    setBacktestResult(null)
    setValidationErrors([])
  }, [activeTabId])

  const handleCodeChange = useCallback((tabId: string, code: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, code, isDirty: true } : t)),
    )
    setValidationErrors([])
  }, [])

  const handleParameterChange = useCallback(
    (tabId: string, paramName: string, value: number | string | boolean) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                isDirty: true,
                parameters: t.parameters.map((p) =>
                  p.name === paramName ? { ...p, default: value } : p,
                ),
              }
            : t,
        ),
      )
    },
    [],
  )

  const handleRunBacktest = useCallback(() => {
    setIsRunning(true)
    setValidationErrors([])
    // Simulate backtest execution
    setTimeout(() => {
      setBacktestResult(generateMockBacktestResult())
      setIsRunning(false)
    }, 1500)
  }, [])

  const handleSave = useCallback(() => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: false } : t)),
    )
    // TODO: trpc.strategy.update.mutate() or trpc.strategy.create.mutate()
  }, [activeTabId])

  const handleLoadTemplate = useCallback((template: StrategyTemplate) => {
    const newTab: StrategyTab = {
      id: `tab-${Date.now()}`,
      name: template.name,
      language: template.language,
      code: template.code,
      parameters: template.parameters,
      isDirty: true,
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setBacktestResult(null)
    setValidationErrors([])
  }, [])

  const handleOpenExisting = useCallback((item: StrategySidebarItem) => {
    // Check if already open
    const existing = tabs.find((t) => t.id === item.id)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }

    // Open new tab with mock code
    const template = STRATEGY_TEMPLATES[0]!
    const newTab: StrategyTab = {
      id: item.id,
      name: item.name,
      language: item.language,
      code: template.code,
      parameters: template.parameters,
      isDirty: false,
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setBacktestResult(null)
    setValidationErrors([])
  }, [tabs])

  return (
    <div className="flex h-full overflow-hidden bg-navy-black">
      {/* Sidebar — Strategy file list */}
      <div
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-navy-dark md:flex',
          sidebarCollapsed ? 'w-10' : 'w-56',
        )}
      >
        <div className="flex h-12 items-center justify-between border-b border-border px-3">
          {!sidebarCollapsed && (
            <span className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Strategies
            </span>
          )}
          <button
            className="rounded p-1 text-text-muted hover:bg-navy-mid hover:text-text-primary"
            onClick={() => setSidebarCollapsed((v) => !v)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              {sidebarCollapsed ? (
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-0.5">
              {MOCK_STRATEGIES.map((strat) => (
                <button
                  key={strat.id}
                  className={cn(
                    'w-full rounded px-3 py-2 text-left transition-colors',
                    activeTabId === strat.id
                      ? 'bg-navy-light text-text-primary'
                      : 'text-text-secondary hover:bg-navy-mid hover:text-text-primary',
                  )}
                  onClick={() => handleOpenExisting(strat)}
                >
                  <div className="truncate text-xs font-medium">{strat.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
                    <span className="font-mono">{strat.language}</span>
                    <span>{new Date(strat.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <button
                className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-border py-2 text-xs text-text-muted transition-colors hover:border-accent/50 hover:text-accent"
                onClick={() => {
                  const newTab: StrategyTab = {
                    id: `tab-${Date.now()}`,
                    name: 'Untitled Strategy',
                    language: 'typescript',
                    code: '',
                    parameters: [],
                    isDirty: true,
                  }
                  setTabs((prev) => [...prev, newTab])
                  setActiveTabId(newTab.id)
                  setBacktestResult(null)
                  setValidationErrors([])
                }}
              >
                + New Strategy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main IDE area */}
      <div className="flex-1 overflow-hidden">
        <StrategyIDE
          tabs={tabs}
          activeTabId={activeTabId}
          backtestResult={backtestResult}
          isRunning={isRunning}
          templates={STRATEGY_TEMPLATES}
          onTabChange={handleTabChange}
          onTabClose={handleTabClose}
          onCodeChange={handleCodeChange}
          onParameterChange={handleParameterChange}
          onRunBacktest={handleRunBacktest}
          onSave={handleSave}
          onLoadTemplate={handleLoadTemplate}
          validationErrors={validationErrors}
        />
      </div>
    </div>
  )
}
