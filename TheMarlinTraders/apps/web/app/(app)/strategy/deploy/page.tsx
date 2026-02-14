'use client'

import { useState, useCallback, useMemo } from 'react'
import { DeploymentDashboard } from '@marlin/ui/trading/deployment-dashboard'
import type { DeploymentEntry, DeploymentMode } from '@marlin/ui/trading/deployment-dashboard'

// ── Mock Data ────────────────────────────────────────────────────────────────
// TODO: Replace with tRPC queries
// trpc.strategyDeploy.getAll.useQuery()
// trpc.strategyDeploy.getDeploymentStatus.useQuery({ deploymentId })
// trpc.strategyDeploy.stop.useMutation()
// trpc.strategyDeploy.stopAll.useMutation()
// trpc.strategyDeploy.deploy.useMutation()

const now = Date.now()

function hoursAgo(hours: number): number {
  return now - hours * 3_600_000
}

const MOCK_DEPLOYMENTS: DeploymentEntry[] = [
  {
    id: 'deploy-1',
    strategyId: 'strat-001',
    strategyName: 'Golden Cross Momentum',
    symbol: 'AAPL',
    mode: 'live',
    status: 'running',
    startedAt: hoursAgo(18),
    signalCount: 47,
    pnlToday: 1_245.80,
    totalPnl: 3_892.50,
    currentEquity: 103_892.50,
    uptimeMs: 18 * 3_600_000,
    peakEquity: 105_100.00,
    drawdownPercent: 1.15,
    dailyPnLPercent: 1.25,
    killSwitchActive: false,
    lastSignalAt: now - 12 * 60_000,
    riskConfig: {
      maxPositionSizePercent: 10,
      maxTotalExposurePercent: 100,
      maxDailyLossPercent: 3,
      maxDrawdownPercent: 10,
    },
    signals: [
      { bar: 340, timestamp: now - 12 * 60_000, side: 'buy', symbol: 'AAPL', quantity: 15, price: 198.45, reason: 'SMA 20 crossed above SMA 50' },
      { bar: 335, timestamp: now - 45 * 60_000, side: 'sell', symbol: 'AAPL', quantity: 10, price: 197.80, reason: 'RSI overbought exit' },
      { bar: 328, timestamp: now - 2 * 3_600_000, side: 'buy', symbol: 'AAPL', quantity: 10, price: 196.50, reason: 'SMA 20 crossed above SMA 50' },
      { bar: 310, timestamp: now - 5 * 3_600_000, side: 'sell', symbol: 'AAPL', quantity: 25, price: 195.20, reason: 'Trailing stop hit' },
      { bar: 290, timestamp: now - 8 * 3_600_000, side: 'buy', symbol: 'AAPL', quantity: 25, price: 193.80, reason: 'MACD bullish crossover' },
    ],
    recentOrders: [
      { id: 'ord-101', timestamp: now - 12 * 60_000, side: 'buy', symbol: 'AAPL', quantity: 15, price: 198.45, status: 'filled', reason: 'SMA crossover' },
      { id: 'ord-100', timestamp: now - 45 * 60_000, side: 'sell', symbol: 'AAPL', quantity: 10, price: 197.80, status: 'filled', reason: 'RSI exit' },
      { id: 'ord-99', timestamp: now - 2 * 3_600_000, side: 'buy', symbol: 'AAPL', quantity: 10, price: 196.50, status: 'filled' },
      { id: 'ord-98', timestamp: now - 3 * 3_600_000, side: 'buy', symbol: 'AAPL', quantity: 5, price: 197.10, status: 'rejected', riskBlocked: true, riskReason: 'Position size would exceed 10% of equity' },
      { id: 'ord-97', timestamp: now - 5 * 3_600_000, side: 'sell', symbol: 'AAPL', quantity: 25, price: 195.20, status: 'filled', reason: 'Trailing stop' },
    ],
  },
  {
    id: 'deploy-2',
    strategyId: 'strat-002',
    strategyName: 'Mean Reversion RSI',
    symbol: 'SPY',
    mode: 'paper',
    status: 'running',
    startedAt: hoursAgo(72),
    signalCount: 134,
    pnlToday: -412.30,
    totalPnl: 2_145.60,
    currentEquity: 52_145.60,
    uptimeMs: 72 * 3_600_000,
    peakEquity: 53_200.00,
    drawdownPercent: 1.98,
    dailyPnLPercent: -0.82,
    killSwitchActive: false,
    lastSignalAt: now - 5 * 60_000,
    riskConfig: {
      maxPositionSizePercent: 15,
      maxTotalExposurePercent: 100,
      maxDailyLossPercent: 2,
      maxDrawdownPercent: 8,
    },
    signals: [
      { bar: 890, timestamp: now - 5 * 60_000, side: 'sell', symbol: 'SPY', quantity: 20, price: 589.30, reason: 'RSI > 70 mean revert' },
      { bar: 882, timestamp: now - 30 * 60_000, side: 'buy', symbol: 'SPY', quantity: 20, price: 588.10, reason: 'RSI < 30 oversold' },
      { bar: 870, timestamp: now - 90 * 60_000, side: 'sell', symbol: 'SPY', quantity: 15, price: 590.50, reason: 'RSI > 70 mean revert' },
    ],
    recentOrders: [
      { id: 'ord-201', timestamp: now - 5 * 60_000, side: 'sell', symbol: 'SPY', quantity: 20, price: 589.30, status: 'filled' },
      { id: 'ord-200', timestamp: now - 30 * 60_000, side: 'buy', symbol: 'SPY', quantity: 20, price: 588.10, status: 'filled' },
      { id: 'ord-199', timestamp: now - 90 * 60_000, side: 'sell', symbol: 'SPY', quantity: 15, price: 590.50, status: 'filled' },
    ],
  },
  {
    id: 'deploy-3',
    strategyId: 'strat-003',
    strategyName: 'Bollinger Breakout',
    symbol: 'NVDA',
    mode: 'paper',
    status: 'running',
    startedAt: hoursAgo(6),
    signalCount: 12,
    pnlToday: 890.20,
    totalPnl: 890.20,
    currentEquity: 25_890.20,
    uptimeMs: 6 * 3_600_000,
    peakEquity: 26_100.00,
    drawdownPercent: 0.80,
    dailyPnLPercent: 3.56,
    killSwitchActive: false,
    lastSignalAt: now - 25 * 60_000,
    riskConfig: {
      maxPositionSizePercent: 20,
      maxTotalExposurePercent: 100,
      maxDailyLossPercent: 5,
      maxDrawdownPercent: 15,
    },
    signals: [
      { bar: 70, timestamp: now - 25 * 60_000, side: 'buy', symbol: 'NVDA', quantity: 5, price: 875.30, reason: 'Price broke above upper BB' },
      { bar: 55, timestamp: now - 2 * 3_600_000, side: 'sell', symbol: 'NVDA', quantity: 3, price: 870.10, reason: 'Return to middle BB' },
      { bar: 42, timestamp: now - 3 * 3_600_000, side: 'buy', symbol: 'NVDA', quantity: 3, price: 862.50, reason: 'Price touched lower BB' },
    ],
    recentOrders: [
      { id: 'ord-301', timestamp: now - 25 * 60_000, side: 'buy', symbol: 'NVDA', quantity: 5, price: 875.30, status: 'filled' },
      { id: 'ord-300', timestamp: now - 2 * 3_600_000, side: 'sell', symbol: 'NVDA', quantity: 3, price: 870.10, status: 'filled' },
      { id: 'ord-299', timestamp: now - 3 * 3_600_000, side: 'buy', symbol: 'NVDA', quantity: 3, price: 862.50, status: 'filled' },
    ],
  },
]

// ── Page Component ───────────────────────────────────────────────────────────

export default function StrategyDeployPage() {
  const [deployments, setDeployments] = useState<DeploymentEntry[]>(MOCK_DEPLOYMENTS)
  const [selectedId, setSelectedId] = useState<string | null>('deploy-1')

  const handleStop = useCallback((id: string) => {
    setDeployments((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: 'stopped' as const, stoppedAt: Date.now() }
          : d,
      ),
    )
  }, [])

  const handleStopAll = useCallback(() => {
    setDeployments((prev) =>
      prev.map((d) =>
        d.status === 'running'
          ? { ...d, status: 'stopped' as const, stoppedAt: Date.now() }
          : d,
      ),
    )
  }, [])

  const handleDeploy = useCallback((mode: DeploymentMode) => {
    // TODO: Open deploy dialog with strategy selector and risk config form
    // For now, this is a placeholder
    console.log('Deploy requested:', mode)
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Strategy Deployment</h1>
        <p className="text-xs text-text-muted">
          Deploy, monitor, and manage automated trading strategies in paper or live mode
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <DeploymentDashboard
          deployments={deployments}
          selectedDeploymentId={selectedId}
          onSelect={setSelectedId}
          onStop={handleStop}
          onStopAll={handleStopAll}
          onDeploy={handleDeploy}
        />
      </div>
    </div>
  )
}
