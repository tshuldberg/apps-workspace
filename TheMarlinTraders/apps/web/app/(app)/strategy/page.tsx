'use client'

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@marlin/ui/lib/utils'
import { StrategyIDE } from '@marlin/ui/trading/strategy-ide'
import type { StrategyTab } from '@marlin/ui/trading/strategy-ide'
import type {
  AlgoStrategyTemplate,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
} from '@marlin/shared'
import {
  ALGO_STRATEGY_TEMPLATES,
} from '@marlin/shared'
import { TrpcClientError, trpcMutation, trpcQuery } from '../../../lib/trpc-fetch.js'

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
  code?: string
  parameters?: AlgoStrategyTemplate['parameters']
}

const MOCK_STRATEGIES: StrategySidebarItem[] = [
  { id: 's1', name: 'My MA Strategy', language: 'typescript', updatedAt: '2026-02-14T10:00:00Z' },
  { id: 's2', name: 'RSI Reversal v2', language: 'typescript', updatedAt: '2026-02-13T15:30:00Z' },
  { id: 's3', name: 'Breakout Scalper', language: 'typescript', updatedAt: '2026-02-12T09:00:00Z' },
]

interface ApiStrategyFile {
  id: string
  name: string
  language: 'typescript' | 'python' | 'pine'
  code: string
  parameters: AlgoStrategyTemplate['parameters']
  updatedAt: string
}

interface ApiValidationResult {
  valid: boolean
  errors: { line: number; message: string }[]
}

interface ApiBacktestRunResult {
  result: {
    trades: {
      entryTime: number
      exitTime: number
      side: 'long' | 'short'
      entryPrice: number
      exitPrice: number
      quantity: number
      pnl: number
      commission: number
    }[]
    equity: {
      timestamp: number
      equity: number
    }[]
    metrics: {
      totalReturnPct: number
      sharpeRatio: number
      sortinoRatio: number
      maxDrawdownPct: number
      winRate: number
      profitFactor: number
      totalTrades: number
      avgWin: number
      avgLoss: number
      expectancy: number
    }
  }
}

function inferBacktestStrategy(tab: StrategyTab) {
  const names = tab.parameters.reduce<Record<string, number>>((acc, param) => {
    if (param.type !== 'number') return acc
    const value = typeof param.default === 'number' ? param.default : Number(param.default)
    if (!Number.isFinite(value)) return acc
    acc[param.name.toLowerCase()] = value
    return acc
  }, {})

  const tabName = tab.name.toLowerCase()

  if (tabName.includes('rsi') || 'oversold' in names || 'overbought' in names) {
    return {
      type: 'rsi_mean_reversion' as const,
      params: {
        period: names.period ?? 14,
        oversold: names.oversold ?? 30,
        overbought: names.overbought ?? 70,
      },
    }
  }

  if (tabName.includes('ma') || tabName.includes('moving') || 'fastperiod' in names || 'slowperiod' in names) {
    return {
      type: 'ma_crossover' as const,
      params: {
        fastPeriod: names.fastperiod ?? names.fast ?? 10,
        slowPeriod: names.slowperiod ?? names.slow ?? 30,
      },
    }
  }

  return {
    type: 'buy_and_hold' as const,
    params: {},
  }
}

function mapBacktestResultToUi(backtest: ApiBacktestRunResult['result']): BacktestResult {
  let runningPeak = Number.NEGATIVE_INFINITY

  const equity: EquityPoint[] = backtest.equity.map((point) => {
    if (point.equity > runningPeak) runningPeak = point.equity
    const drawdown = runningPeak > 0 ? ((runningPeak - point.equity) / runningPeak) * 100 : 0
    return {
      date: new Date(point.timestamp).toISOString().slice(0, 10),
      equity: Number(point.equity.toFixed(2)),
      drawdown: Number(drawdown.toFixed(2)),
    }
  })

  const trades: BacktestTrade[] = backtest.trades.map((trade, index) => {
    const basis = Math.max(1, trade.entryPrice * trade.quantity)
    return {
      id: `bt-${index + 1}`,
      entryDate: new Date(trade.entryTime).toISOString(),
      exitDate: new Date(trade.exitTime).toISOString(),
      side: trade.side,
      entryPrice: Number(trade.entryPrice.toFixed(2)),
      exitPrice: Number(trade.exitPrice.toFixed(2)),
      quantity: trade.quantity,
      pnl: Number(trade.pnl.toFixed(2)),
      pnlPercent: Number(((trade.pnl / basis) * 100).toFixed(2)),
      commission: Number(trade.commission.toFixed(2)),
      holdingPeriodBars: Math.max(
        1,
        Math.round((trade.exitTime - trade.entryTime) / (24 * 60 * 60 * 1000)),
      ),
      reason: trade.pnl >= 0 ? 'Exit with profit' : 'Exit with loss',
    }
  })

  return {
    trades,
    equity,
    metrics: {
      totalReturn: Number(backtest.metrics.totalReturnPct.toFixed(2)),
      sharpe: Number(backtest.metrics.sharpeRatio.toFixed(2)),
      sortino: Number(backtest.metrics.sortinoRatio.toFixed(2)),
      maxDrawdown: Number(backtest.metrics.maxDrawdownPct.toFixed(2)),
      winRate: Number((backtest.metrics.winRate / 100).toFixed(4)),
      profitFactor: Number(backtest.metrics.profitFactor.toFixed(2)),
      totalTrades: backtest.metrics.totalTrades,
      avgWin: Number(backtest.metrics.avgWin.toFixed(2)),
      avgLoss: Number(backtest.metrics.avgLoss.toFixed(2)),
      expectancy: Number(backtest.metrics.expectancy.toFixed(2)),
    },
  }
}

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
  const [sidebarStrategies, setSidebarStrategies] = useState<StrategySidebarItem[]>(MOCK_STRATEGIES)
  const [templates, setTemplates] = useState<AlgoStrategyTemplate[]>(ALGO_STRATEGY_TEMPLATES)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function hydrateStrategyData() {
      try {
        const templateData = await trpcQuery<AlgoStrategyTemplate[]>('strategy.getTemplates')
        if (!cancelled && templateData.length > 0) {
          setTemplates(templateData)
        }
      } catch {
        // Keep local fallback templates.
      }

      try {
        const strategyFiles = await trpcQuery<ApiStrategyFile[]>('strategy.list', { limit: 100, offset: 0 })
        if (cancelled) return

        const mapped = strategyFiles.map((item) => ({
          id: item.id,
          name: item.name,
          language: item.language,
          updatedAt: item.updatedAt,
          code: item.code,
          parameters: item.parameters,
        }))
        if (mapped.length > 0) {
          setSidebarStrategies(mapped)
        } else {
          setSidebarStrategies([])
        }
      } catch (error) {
        if (cancelled) return
        const trpcError = error instanceof TrpcClientError ? error : null
        if (trpcError?.code === 'UNAUTHORIZED') {
          setStatusMessage('Sign in to load saved strategies. Templates are still available.')
          setSidebarStrategies([])
          return
        }
        setSidebarStrategies(MOCK_STRATEGIES)
      }
    }

    hydrateStrategyData()
    return () => {
      cancelled = true
    }
  }, [])

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

  const handleRunBacktest = useCallback(async () => {
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab) return

    setIsRunning(true)
    setValidationErrors([])
    setStatusError(null)
    setStatusMessage(null)

    try {
      const validation = await trpcMutation<ApiValidationResult>('strategy.validate', {
        code: activeTab.code,
        language: activeTab.language,
      })

      if (!validation.valid) {
        setValidationErrors(validation.errors)
        setStatusError('Strategy validation failed.')
        return
      }

      const inferred = inferBacktestStrategy(activeTab)
      const endDate = new Date()
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - 6)

      const run = await trpcMutation<ApiBacktestRunResult>('backtest.run', {
        strategy: inferred,
        config: {
          symbol: 'AAPL',
          timeframe: '1D',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          initialCapital: 100000,
          positionSize: 100,
          slippageBps: 1,
        },
      })

      setBacktestResult(mapBacktestResultToUi(run.result))
      setStatusMessage('Backtest completed.')
    } catch (error) {
      const trpcError = error instanceof TrpcClientError ? error : null
      if (trpcError?.code === 'UNAUTHORIZED') {
        setStatusMessage('Sign in required for server backtests. Showing local simulation result.')
      } else {
        setStatusError(
          trpcError?.message ?? (error instanceof Error ? error.message : 'Backtest failed'),
        )
      }
      setBacktestResult(generateMockBacktestResult())
    } finally {
      setIsRunning(false)
    }
  }, [tabs, activeTabId])

  const handleSave = useCallback(async () => {
    const activeTab = tabs.find((t) => t.id === activeTabId)
    if (!activeTab) return

    setStatusError(null)
    setStatusMessage(null)

    const payload = {
      name: activeTab.name,
      language: activeTab.language,
      code: activeTab.code,
      parameters: activeTab.parameters,
      isPublic: false,
    }

    try {
      if (activeTab.id.startsWith('tab-')) {
        const created = await trpcMutation<ApiStrategyFile>('strategy.create', payload)
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, id: created.id, isDirty: false } : t)),
        )
        setActiveTabId(created.id)
        setSidebarStrategies((prev) => [
          {
            id: created.id,
            name: created.name,
            language: created.language,
            updatedAt: created.updatedAt,
            code: created.code,
            parameters: created.parameters,
          },
          ...prev.filter((s) => s.id !== created.id),
        ])
        setStatusMessage('Strategy saved.')
      } else {
        await trpcMutation('strategy.update', { id: activeTab.id, ...payload })
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t)),
        )
        setSidebarStrategies((prev) =>
          prev.map((item) =>
            item.id === activeTab.id
              ? {
                  ...item,
                  name: activeTab.name,
                  language: activeTab.language,
                  updatedAt: new Date().toISOString(),
                  code: activeTab.code,
                  parameters: activeTab.parameters,
                }
              : item,
          ),
        )
        setStatusMessage('Strategy updated.')
      }
    } catch (error) {
      const trpcError = error instanceof TrpcClientError ? error : null
      if (trpcError?.code === 'UNAUTHORIZED') {
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? { ...t, isDirty: false } : t)),
        )
        setStatusMessage('Saved locally only. Sign in to persist strategies.')
      } else {
        setStatusError(trpcError?.message ?? (error instanceof Error ? error.message : 'Save failed'))
      }
    }
  }, [activeTabId, tabs])

  const handleLoadTemplate = useCallback((template: AlgoStrategyTemplate) => {
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

    const fallbackTemplate = templates[0] ?? ALGO_STRATEGY_TEMPLATES[0]
    const newTab: StrategyTab = {
      id: item.id,
      name: item.name,
      language: item.language,
      code: item.code ?? fallbackTemplate?.code ?? '',
      parameters: item.parameters ?? fallbackTemplate?.parameters ?? [],
      isDirty: false,
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setBacktestResult(null)
    setValidationErrors([])
  }, [tabs, templates])

  return (
    <div className="flex h-full overflow-hidden bg-navy-black">
      {(statusError || statusMessage) && (
        <div className="absolute left-12 right-4 top-3 z-[70] flex items-center justify-between gap-2 rounded border border-border bg-navy-dark/95 px-3 py-2">
          {statusError ? (
            <span className="text-xs text-trading-red">{statusError}</span>
          ) : (
            <span className="text-xs text-text-secondary">{statusMessage}</span>
          )}
          <button
            type="button"
            onClick={() => {
              setStatusError(null)
              setStatusMessage(null)
            }}
            className="rounded px-2 py-1 text-[10px] text-text-muted transition-colors hover:bg-navy-mid hover:text-text-primary"
          >
            Dismiss
          </button>
        </div>
      )}

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
              {sidebarStrategies.map((strat) => (
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
              {sidebarStrategies.length === 0 && (
                <div className="px-3 py-4 text-xs text-text-muted">No saved strategies yet.</div>
              )}
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
          templates={templates}
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
