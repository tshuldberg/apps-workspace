'use client'

import { useState, useMemo } from 'react'
import { cn } from '../lib/utils.js'
import { Button } from '../primitives/button.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../primitives/dialog.js'

// ── Types ──────────────────────────────────────────────────

export type DeploymentMode = 'paper' | 'live'
export type DeploymentStatusType = 'running' | 'stopped' | 'error'

export interface DeploymentEntry {
  id: string
  strategyId: string
  strategyName: string
  symbol: string
  mode: DeploymentMode
  status: DeploymentStatusType
  startedAt: number
  stoppedAt?: number
  lastSignalAt?: number
  lastError?: string
  signalCount: number
  pnlToday: number
  totalPnl: number
  currentEquity: number
  uptimeMs: number
  peakEquity: number
  drawdownPercent: number
  dailyPnLPercent: number
  killSwitchActive: boolean
  killSwitchReason?: string
  signals: SignalEntry[]
  recentOrders: OrderEntry[]
  riskConfig: RiskConfigData
}

export interface SignalEntry {
  bar: number
  timestamp: number
  side: 'buy' | 'sell'
  symbol: string
  quantity: number
  price: number
  reason?: string
}

export interface OrderEntry {
  id: string
  timestamp: number
  side: 'buy' | 'sell'
  symbol: string
  quantity: number
  price: number
  status: 'submitted' | 'filled' | 'rejected' | 'cancelled'
  reason?: string
  riskBlocked?: boolean
  riskReason?: string
}

export interface RiskConfigData {
  maxPositionSizePercent: number
  maxTotalExposurePercent: number
  maxDailyLossPercent: number
  maxDrawdownPercent: number
}

export interface DeploymentDashboardProps {
  deployments: DeploymentEntry[]
  selectedDeploymentId?: string | null
  onSelect?: (id: string) => void
  onStop?: (id: string) => void
  onStopAll?: () => void
  onDeploy?: (mode: DeploymentMode) => void
  className?: string
}

// ── Helpers ────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) return `${hours}h ${remainingMinutes}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ── Status badge ───────────────────────────────────────────

function StatusBadge({ status }: { status: DeploymentStatusType }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
        status === 'running' && 'bg-trading-green/20 text-trading-green',
        status === 'stopped' && 'bg-text-muted/20 text-text-muted',
        status === 'error' && 'bg-trading-red/20 text-trading-red',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'running' && 'animate-pulse bg-trading-green',
          status === 'stopped' && 'bg-text-muted',
          status === 'error' && 'bg-trading-red',
        )}
      />
      {status}
    </span>
  )
}

function ModeBadge({ mode }: { mode: DeploymentMode }) {
  return (
    <span
      className={cn(
        'rounded px-1 py-px text-[9px] font-bold uppercase',
        mode === 'live' ? 'bg-trading-red/20 text-trading-red' : 'bg-warning/20 text-warning',
      )}
    >
      {mode}
    </span>
  )
}

// ── Component ──────────────────────────────────────────────

export function DeploymentDashboard({
  deployments,
  selectedDeploymentId,
  onSelect,
  onStop,
  onStopAll,
  onDeploy,
  className,
}: DeploymentDashboardProps) {
  const [killAllConfirm, setKillAllConfirm] = useState(false)
  const [stopConfirm, setStopConfirm] = useState<string | null>(null)

  const selected = useMemo(
    () => deployments.find((d) => d.id === selectedDeploymentId) ?? null,
    [deployments, selectedDeploymentId],
  )

  const runningCount = useMemo(
    () => deployments.filter((d) => d.status === 'running').length,
    [deployments],
  )

  const liveCount = useMemo(
    () => deployments.filter((d) => d.mode === 'live' && d.status === 'running').length,
    [deployments],
  )

  const totalPnlToday = useMemo(
    () => deployments.reduce((sum, d) => sum + d.pnlToday, 0),
    [deployments],
  )

  const handleStopClick = (id: string, mode: DeploymentMode) => {
    if (mode === 'live') {
      setStopConfirm(id)
    } else {
      onStop?.(id)
    }
  }

  const handleConfirmStop = () => {
    if (stopConfirm) {
      onStop?.(stopConfirm)
      setStopConfirm(null)
    }
  }

  const handleKillAll = () => {
    onStopAll?.()
    setKillAllConfirm(false)
  }

  return (
    <>
      <div className={cn('flex flex-col gap-4', className)}>
        {/* ── Header bar ─────────────────────────────── */}
        <div className="flex items-center justify-between rounded-panel border border-border bg-navy-dark px-4 py-3">
          <div className="flex items-center gap-6">
            <h2 className="text-sm font-semibold text-text-primary">Strategy Deployments</h2>
            <div className="flex items-center gap-4 text-xs text-text-muted">
              <span>
                <span className="font-mono tabular-nums text-text-primary">{runningCount}</span> running
              </span>
              {liveCount > 0 && (
                <span>
                  <span className="font-mono tabular-nums text-trading-red">{liveCount}</span> live
                </span>
              )}
              <span className="flex items-center gap-1">
                Today:
                <span
                  className={cn(
                    'font-mono tabular-nums font-semibold',
                    totalPnlToday >= 0 ? 'text-trading-green' : 'text-trading-red',
                  )}
                >
                  {formatCurrency(totalPnlToday)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onDeploy && (
              <div className="flex rounded border border-border">
                <button
                  className="px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning/10 transition-colors"
                  onClick={() => onDeploy('paper')}
                >
                  Deploy Paper
                </button>
                <button
                  className="border-l border-border px-3 py-1.5 text-xs font-medium text-trading-red hover:bg-trading-red/10 transition-colors"
                  onClick={() => onDeploy('live')}
                >
                  Deploy Live
                </button>
              </div>
            )}
            {runningCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setKillAllConfirm(true)}
              >
                Kill All
              </Button>
            )}
          </div>
        </div>

        {/* ── Two-column layout ──────────────────────── */}
        <div className="flex gap-4">
          {/* ── Left: Deployment list ─────────────────── */}
          <div className="flex w-full flex-col gap-2 lg:w-1/2">
            {deployments.length === 0 ? (
              <div className="rounded-panel border border-border bg-navy-dark p-8 text-center text-sm text-text-muted">
                No active deployments. Deploy a strategy to get started.
              </div>
            ) : (
              deployments.map((dep) => (
                <button
                  key={dep.id}
                  className={cn(
                    'flex flex-col gap-2 rounded-panel border bg-navy-dark p-3 text-left transition-colors hover:border-accent/50',
                    selectedDeploymentId === dep.id
                      ? 'border-accent'
                      : 'border-border',
                  )}
                  onClick={() => onSelect?.(dep.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {dep.strategyName}
                      </span>
                      <ModeBadge mode={dep.mode} />
                      <StatusBadge status={dep.status} />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-text-muted">
                      {dep.symbol}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>Uptime: {formatUptime(dep.uptimeMs)}</span>
                    <span>{dep.signalCount} signals</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-text-muted">Today:</span>
                      <span
                        className={cn(
                          'font-mono tabular-nums font-semibold',
                          dep.pnlToday >= 0 ? 'text-trading-green' : 'text-trading-red',
                        )}
                      >
                        {formatCurrency(dep.pnlToday)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-text-muted">Total:</span>
                      <span
                        className={cn(
                          'font-mono tabular-nums font-semibold',
                          dep.totalPnl >= 0 ? 'text-trading-green' : 'text-trading-red',
                        )}
                      >
                        {formatCurrency(dep.totalPnl)}
                      </span>
                    </div>
                    {dep.status === 'running' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStopClick(dep.id, dep.mode)
                        }}
                      >
                        Stop
                      </Button>
                    )}
                  </div>

                  {dep.killSwitchActive && (
                    <div className="rounded bg-trading-red/10 px-2 py-1 text-[10px] text-trading-red">
                      Kill switch: {dep.killSwitchReason}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* ── Right: Detail panel ──────────────────── */}
          <div className="hidden flex-col gap-4 lg:flex lg:w-1/2">
            {selected ? (
              <>
                {/* Risk status */}
                <div className="rounded-panel border border-border bg-navy-dark p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Risk Status
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Daily P&L gauge */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-text-muted">Daily P&L</div>
                      <div
                        className={cn(
                          'font-mono text-lg font-bold tabular-nums',
                          selected.dailyPnLPercent >= 0 ? 'text-trading-green' : 'text-trading-red',
                        )}
                      >
                        {formatPercent(selected.dailyPnLPercent)}
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-mid">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            selected.dailyPnLPercent >= 0 ? 'bg-trading-green' : 'bg-trading-red',
                          )}
                          style={{
                            width: `${Math.min(100, (Math.abs(selected.dailyPnLPercent) / selected.riskConfig.maxDailyLossPercent) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="text-[9px] text-text-muted">
                        Limit: -{selected.riskConfig.maxDailyLossPercent}%
                      </div>
                    </div>

                    {/* Drawdown gauge */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-text-muted">Max Drawdown</div>
                      <div
                        className={cn(
                          'font-mono text-lg font-bold tabular-nums',
                          selected.drawdownPercent > selected.riskConfig.maxDrawdownPercent * 0.7
                            ? 'text-trading-red'
                            : 'text-text-primary',
                        )}
                      >
                        {selected.drawdownPercent.toFixed(2)}%
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-mid">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            selected.drawdownPercent > selected.riskConfig.maxDrawdownPercent * 0.7
                              ? 'bg-trading-red'
                              : 'bg-accent',
                          )}
                          style={{
                            width: `${Math.min(100, (selected.drawdownPercent / selected.riskConfig.maxDrawdownPercent) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="text-[9px] text-text-muted">
                        Limit: {selected.riskConfig.maxDrawdownPercent}%
                      </div>
                    </div>

                    {/* Equity */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-text-muted">Current Equity</div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                        {formatCurrency(selected.currentEquity)}
                      </div>
                    </div>

                    {/* Peak equity */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-text-muted">Peak Equity</div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                        {formatCurrency(selected.peakEquity)}
                      </div>
                    </div>
                  </div>

                  {/* Position heat map */}
                  <div className="mt-4">
                    <div className="mb-2 text-[10px] text-text-muted">Risk Limits</div>
                    <div className="flex gap-2 text-[10px]">
                      <div className="rounded bg-navy-mid px-2 py-1 text-text-secondary">
                        Max Pos: {selected.riskConfig.maxPositionSizePercent}%
                      </div>
                      <div className="rounded bg-navy-mid px-2 py-1 text-text-secondary">
                        Max Exp: {selected.riskConfig.maxTotalExposurePercent}%
                      </div>
                      <div className="rounded bg-navy-mid px-2 py-1 text-text-secondary">
                        Max DD: {selected.riskConfig.maxDrawdownPercent}%
                      </div>
                      <div className="rounded bg-navy-mid px-2 py-1 text-text-secondary">
                        Max Loss: {selected.riskConfig.maxDailyLossPercent}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent orders */}
                <div className="rounded-panel border border-border bg-navy-dark p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Recent Orders
                  </h3>
                  {selected.recentOrders.length === 0 ? (
                    <div className="text-center text-xs text-text-muted">No orders yet</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-border text-[10px] text-text-muted">
                            <th className="pb-1 font-medium">Time</th>
                            <th className="pb-1 font-medium">Side</th>
                            <th className="pb-1 font-medium text-right">Qty</th>
                            <th className="pb-1 font-medium text-right">Price</th>
                            <th className="pb-1 font-medium text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.recentOrders.slice(-20).reverse().map((order) => (
                            <tr key={order.id} className="border-b border-border/30">
                              <td className="py-1 font-mono tabular-nums text-text-muted">
                                {formatTime(order.timestamp)}
                              </td>
                              <td
                                className={cn(
                                  'py-1 font-semibold uppercase',
                                  order.side === 'buy' ? 'text-trading-green' : 'text-trading-red',
                                )}
                              >
                                {order.side}
                              </td>
                              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                                {order.quantity}
                              </td>
                              <td className="py-1 text-right font-mono tabular-nums text-text-primary">
                                {formatCurrency(order.price)}
                              </td>
                              <td className="py-1 text-right">
                                <span
                                  className={cn(
                                    'rounded px-1 py-px text-[9px] font-bold uppercase',
                                    order.status === 'filled' && 'bg-trading-green/20 text-trading-green',
                                    order.status === 'submitted' && 'bg-accent/20 text-accent',
                                    order.status === 'rejected' && 'bg-trading-red/20 text-trading-red',
                                    order.status === 'cancelled' && 'bg-text-muted/20 text-text-muted',
                                  )}
                                >
                                  {order.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Signals log */}
                <div className="rounded-panel border border-border bg-navy-dark p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Signals Log
                  </h3>
                  {selected.signals.length === 0 ? (
                    <div className="text-center text-xs text-text-muted">No signals generated</div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto font-mono text-[10px] text-text-secondary">
                      {selected.signals.slice(-20).reverse().map((sig, i) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                          <span className="text-text-muted">
                            {formatTime(sig.timestamp)}
                          </span>
                          <span
                            className={cn(
                              'font-bold uppercase',
                              sig.side === 'buy' ? 'text-trading-green' : 'text-trading-red',
                            )}
                          >
                            {sig.side}
                          </span>
                          <span className="tabular-nums">{sig.quantity}</span>
                          <span className="text-text-muted">@</span>
                          <span className="tabular-nums">{formatCurrency(sig.price)}</span>
                          {sig.reason && (
                            <span className="text-text-muted">({sig.reason})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-panel border border-border bg-navy-dark p-8">
                <span className="text-sm text-text-muted">
                  Select a deployment to view details
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Connection status ───────────────────────── */}
        <div className="flex items-center gap-4 rounded-panel border border-border bg-navy-dark px-4 py-2 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-trading-green" />
            <span>Market Data</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', liveCount > 0 ? 'bg-trading-green' : 'bg-text-muted')} />
            <span>Broker</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-trading-green" />
            <span>WebSocket</span>
          </div>
        </div>
      </div>

      {/* ── Kill All confirmation dialog ─────────────── */}
      <Dialog open={killAllConfirm} onOpenChange={(open) => !open && setKillAllConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop ALL Live Strategies?</DialogTitle>
            <DialogDescription>
              This will immediately halt all running strategy deployments, including{' '}
              <span className="font-mono font-semibold text-trading-red">{liveCount}</span>{' '}
              live deployment{liveCount !== 1 ? 's' : ''}. Open positions will NOT be
              automatically closed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKillAllConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleKillAll}>
              Stop ALL Strategies
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stop single live deployment confirmation ── */}
      <Dialog open={stopConfirm !== null} onOpenChange={(open) => !open && setStopConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop Live Strategy?</DialogTitle>
            <DialogDescription>
              This will halt the live strategy deployment. Open positions will NOT be
              automatically closed. You will need to manage remaining positions manually.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStopConfirm(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmStop}>
              Stop Strategy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
