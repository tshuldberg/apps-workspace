'use client'

import { useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ─────────────────────────────────────────────────────────────────

export interface BacktestEquityPoint {
  timestamp: number
  equity: number
}

export interface BacktestTrade {
  entryTime: number
  exitTime: number
  symbol: string
  side: 'long' | 'short'
  quantity: number
  entryPrice: number
  exitPrice: number
  pnl: number
  commission: number
}

export interface BacktestMetricsData {
  totalReturnPct: number
  totalReturnDollar: number
  annualizedReturnPct: number
  sharpeRatio: number
  sortinoRatio: number
  calmarRatio: number
  recoveryFactor: number
  maxDrawdownPct: number
  maxDrawdownDollar: number
  totalTrades: number
  winRate: number
  profitFactor: number
  expectancy: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  maxConsecutiveWins: number
  maxConsecutiveLosses: number
  totalCommissions: number
}

export interface BacktestResultData {
  strategyName: string
  symbol: string
  equity: BacktestEquityPoint[]
  trades: BacktestTrade[]
  metrics: BacktestMetricsData
}

// ── Props ─────────────────────────────────────────────────────────────────

export interface BacktestResultsProps {
  data: BacktestResultData
  className?: string
}

export interface BacktestCompareProps {
  results: BacktestResultData[]
  className?: string
}

// ── Formatters ────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(2)}`
}

function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatRatio(value: number): string {
  if (!isFinite(value)) return '---'
  return value.toFixed(2)
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function formatDuration(entryMs: number, exitMs: number): string {
  const diffMs = exitMs - entryMs
  const hours = diffMs / (1000 * 60 * 60)
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

// ── Summary Stats Bar ─────────────────────────────────────────────────────

function SummaryBar({ metrics }: { metrics: BacktestMetricsData }) {
  const items = [
    {
      label: 'Total Return',
      value: formatPct(metrics.totalReturnPct),
      positive: metrics.totalReturnPct >= 0,
    },
    {
      label: 'Trades',
      value: String(metrics.totalTrades),
      positive: null as boolean | null,
    },
    {
      label: 'Win Rate',
      value: `${metrics.winRate.toFixed(1)}%`,
      positive: metrics.winRate >= 50,
    },
    {
      label: 'Sharpe',
      value: formatRatio(metrics.sharpeRatio),
      positive: metrics.sharpeRatio > 0,
    },
  ]

  return (
    <div className="flex items-center gap-6 rounded-lg border border-border bg-navy-darker px-5 py-3">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          {i > 0 && <div className="h-8 w-px bg-border" />}
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              {item.label}
            </span>
            <span
              className={cn(
                'font-mono text-sm font-semibold tabular-nums',
                item.positive === null
                  ? 'text-text-primary'
                  : item.positive
                    ? 'text-trading-green'
                    : 'text-trading-red',
              )}
            >
              {item.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Equity Curve (SVG) ────────────────────────────────────────────────────

function EquityCurveChart({
  equity,
  initialCapital,
  height = 200,
}: {
  equity: BacktestEquityPoint[]
  initialCapital: number
  height?: number
}) {
  const { path, fillPath, zeroY, viewBox, isPositive } = useMemo(() => {
    if (equity.length < 2) return { path: '', fillPath: '', zeroY: 0, viewBox: '0 0 100 100', isPositive: true }

    const w = 1000
    const h = 400
    const pad = { top: 20, right: 20, bottom: 20, left: 20 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    const values = equity.map((p) => p.equity)
    const minVal = Math.min(initialCapital, ...values)
    const maxVal = Math.max(initialCapital, ...values)
    const range = maxVal - minVal || 1

    const points = equity.map((p, i) => ({
      x: pad.left + (i / (equity.length - 1)) * plotW,
      y: pad.top + plotH - ((p.equity - minVal) / range) * plotH,
    }))

    const zeroLineY = pad.top + plotH - ((initialCapital - minVal) / range) * plotH

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    const fill =
      `M ${points[0]!.x} ${zeroLineY} ` +
      points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${points[points.length - 1]!.x} ${zeroLineY} Z`

    const finalEquity = equity[equity.length - 1]!.equity

    return {
      path: linePath,
      fillPath: fill,
      zeroY: zeroLineY,
      viewBox: `0 0 ${w} ${h}`,
      isPositive: finalEquity >= initialCapital,
    }
  }, [equity, initialCapital])

  if (equity.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-navy-dark"
        style={{ height }}
      >
        <span className="text-xs text-text-muted">Not enough data</span>
      </div>
    )
  }

  const lineColor = isPositive ? '#22c55e' : '#ef4444'
  const fillColor = isPositive ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)'

  return (
    <div className="rounded-lg border border-border bg-navy-dark p-2">
      <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
        Equity Curve
      </div>
      <svg viewBox={viewBox} preserveAspectRatio="none" style={{ height, width: '100%' }}>
        {/* Zero/initial capital line */}
        <line
          x1="20"
          y1={zeroY}
          x2="980"
          y2={zeroY}
          stroke="#1e293b"
          strokeWidth="1"
          strokeDasharray="6 4"
        />
        {/* Fill */}
        <path d={fillPath} fill={fillColor} />
        {/* Line */}
        <path d={path} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ── Drawdown Chart (SVG) ──────────────────────────────────────────────────

function DrawdownChart({
  equity,
  height = 100,
}: {
  equity: BacktestEquityPoint[]
  height?: number
}) {
  const { fillPath, viewBox, maxDd } = useMemo(() => {
    if (equity.length < 2) return { fillPath: '', viewBox: '0 0 100 100', maxDd: 0 }

    const w = 1000
    const h = 200
    const pad = { top: 10, right: 20, bottom: 10, left: 20 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    // Calculate drawdown series
    let peak = equity[0]!.equity
    const drawdowns = equity.map((p) => {
      if (p.equity > peak) peak = p.equity
      return peak > 0 ? ((peak - p.equity) / peak) * 100 : 0
    })

    const maxDrawdown = Math.max(...drawdowns, 0.01) // Prevent zero range

    const points = drawdowns.map((dd, i) => ({
      x: pad.left + (i / (drawdowns.length - 1)) * plotW,
      y: pad.top + (dd / maxDrawdown) * plotH,
    }))

    const fill =
      `M ${points[0]!.x} ${pad.top} ` +
      points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${points[points.length - 1]!.x} ${pad.top} Z`

    return { fillPath: fill, viewBox: `0 0 ${w} ${h}`, maxDd: maxDrawdown }
  }, [equity])

  if (equity.length < 2) return null

  return (
    <div className="rounded-lg border border-border bg-navy-dark p-2">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Drawdown
        </span>
        <span className="font-mono text-[10px] text-trading-red">
          Max: -{maxDd.toFixed(2)}%
        </span>
      </div>
      <svg viewBox={viewBox} preserveAspectRatio="none" style={{ height, width: '100%' }}>
        <path d={fillPath} fill="rgba(239, 68, 68, 0.3)" />
      </svg>
    </div>
  )
}

// ── Metrics Grid ──────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string
  value: string
  positive?: boolean | null
}

function MetricCard({ label, value, positive }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-navy-dark px-3 py-2.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-base font-semibold tabular-nums',
          positive === null || positive === undefined
            ? 'text-text-primary'
            : positive
              ? 'text-trading-green'
              : 'text-trading-red',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function MetricsGrid({ metrics }: { metrics: BacktestMetricsData }) {
  const cards: MetricCardProps[] = [
    {
      label: 'Total Return',
      value: formatPct(metrics.totalReturnPct),
      positive: metrics.totalReturnPct >= 0,
    },
    {
      label: 'Sharpe Ratio',
      value: formatRatio(metrics.sharpeRatio),
      positive: metrics.sharpeRatio > 0 ? true : metrics.sharpeRatio < 0 ? false : null,
    },
    {
      label: 'Sortino Ratio',
      value: formatRatio(metrics.sortinoRatio),
      positive: metrics.sortinoRatio > 0 ? true : metrics.sortinoRatio < 0 ? false : null,
    },
    {
      label: 'Max Drawdown',
      value: `-${metrics.maxDrawdownPct.toFixed(2)}%`,
      positive: metrics.maxDrawdownPct === 0 ? null : false,
    },
    {
      label: 'Win Rate',
      value: `${metrics.winRate.toFixed(1)}%`,
      positive: metrics.winRate >= 50,
    },
    {
      label: 'Profit Factor',
      value: formatRatio(metrics.profitFactor),
      positive: metrics.profitFactor > 1 ? true : metrics.profitFactor > 0 ? false : null,
    },
    {
      label: 'Expectancy',
      value: formatCurrency(metrics.expectancy),
      positive: metrics.expectancy > 0 ? true : metrics.expectancy < 0 ? false : null,
    },
    {
      label: 'Total Trades',
      value: String(metrics.totalTrades),
      positive: null,
    },
    {
      label: 'Avg Win',
      value: formatCurrency(metrics.avgWin),
      positive: metrics.avgWin > 0 ? true : null,
    },
    {
      label: 'Avg Loss',
      value: formatCurrency(metrics.avgLoss),
      positive: metrics.avgLoss < 0 ? false : null,
    },
    {
      label: 'Best Trade',
      value: formatCurrency(metrics.largestWin),
      positive: true,
    },
    {
      label: 'Worst Trade',
      value: formatCurrency(metrics.largestLoss),
      positive: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </div>
  )
}

// ── Trade Log Table ───────────────────────────────────────────────────────

function TradeLogTable({ trades }: { trades: BacktestTrade[] }) {
  if (trades.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-navy-dark">
        <span className="text-xs text-text-muted">No trades</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-navy-dark">
      <div className="px-4 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Trade Log ({trades.length} trades)
        </span>
      </div>
      <div className="max-h-[400px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 border-b border-border bg-navy-darker">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Date</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Symbol</th>
              <th className="px-3 py-2 text-left font-medium text-text-muted">Side</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Entry</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Exit</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">P&L</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">P&L %</th>
              <th className="px-3 py-2 text-right font-medium text-text-muted">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {trades.map((trade, i) => {
              const pnlPct =
                trade.entryPrice !== 0
                  ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) *
                    100 *
                    (trade.side === 'short' ? -1 : 1)
                  : 0
              const isWin = trade.pnl > 0

              return (
                <tr key={i} className="hover:bg-navy-darker/50">
                  <td className="px-3 py-1.5 font-mono tabular-nums text-text-secondary">
                    {formatDate(trade.entryTime)}
                  </td>
                  <td className="px-3 py-1.5 font-medium text-text-primary">{trade.symbol}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={cn(
                        'inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                        trade.side === 'long'
                          ? 'bg-trading-green/10 text-trading-green'
                          : 'bg-trading-red/10 text-trading-red',
                      )}
                    >
                      {trade.side}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-text-secondary">
                    ${trade.entryPrice.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-text-secondary">
                    ${trade.exitPrice.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-1.5 text-right font-mono tabular-nums',
                      isWin ? 'text-trading-green' : 'text-trading-red',
                    )}
                  >
                    {formatCurrency(trade.pnl)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-1.5 text-right font-mono tabular-nums',
                      isWin ? 'text-trading-green' : 'text-trading-red',
                    )}
                  >
                    {formatPct(pnlPct)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-text-muted">
                    {formatDuration(trade.entryTime, trade.exitTime)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Trade Markers ─────────────────────────────────────────────────────────

export interface TradeMarkersProps {
  trades: BacktestTrade[]
  /** Total time range start (ms) — used to position markers on x-axis */
  timeStart: number
  /** Total time range end (ms) */
  timeEnd: number
  height?: number
  className?: string
}

/**
 * Standalone trade marker overlay component.
 * Renders buy/sell points as triangles on a timeline. Can be overlaid on a chart.
 */
export function TradeMarkers({
  trades,
  timeStart,
  timeEnd,
  height = 40,
  className,
}: TradeMarkersProps) {
  const timeRange = timeEnd - timeStart
  if (timeRange <= 0 || trades.length === 0) return null

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <svg viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" className="h-full w-full">
        {trades.map((trade, i) => {
          const entryX = ((trade.entryTime - timeStart) / timeRange) * 1000
          const exitX = ((trade.exitTime - timeStart) / timeRange) * 1000
          const isLong = trade.side === 'long'
          const midY = height / 2

          return (
            <g key={i}>
              {/* Entry marker — up triangle for long, down for short */}
              <polygon
                points={
                  isLong
                    ? `${entryX - 4},${midY + 6} ${entryX + 4},${midY + 6} ${entryX},${midY - 6}`
                    : `${entryX - 4},${midY - 6} ${entryX + 4},${midY - 6} ${entryX},${midY + 6}`
                }
                fill={isLong ? '#22c55e' : '#ef4444'}
              />
              {/* Exit marker — opposite direction */}
              <polygon
                points={
                  isLong
                    ? `${exitX - 4},${midY - 6} ${exitX + 4},${midY - 6} ${exitX},${midY + 6}`
                    : `${exitX - 4},${midY + 6} ${exitX + 4},${midY + 6} ${exitX},${midY - 6}`
                }
                fill={isLong ? '#ef4444' : '#22c55e'}
                opacity={0.7}
              />
              {/* Connecting line */}
              <line
                x1={entryX}
                y1={midY}
                x2={exitX}
                y2={midY}
                stroke={trade.pnl >= 0 ? '#22c55e' : '#ef4444'}
                strokeWidth="1"
                strokeDasharray="3 2"
                opacity={0.3}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Compare Mode ──────────────────────────────────────────────────────────

export function BacktestCompare({ results, className }: BacktestCompareProps) {
  if (results.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-navy-dark">
        <span className="text-xs text-text-muted">Select at least 2 backtests to compare</span>
      </div>
    )
  }

  const metricKeys: Array<{ key: keyof BacktestMetricsData; label: string; format: (v: number) => string; higherIsBetter: boolean }> = [
    { key: 'totalReturnPct', label: 'Total Return', format: formatPct, higherIsBetter: true },
    { key: 'annualizedReturnPct', label: 'Ann. Return', format: formatPct, higherIsBetter: true },
    { key: 'sharpeRatio', label: 'Sharpe', format: formatRatio, higherIsBetter: true },
    { key: 'sortinoRatio', label: 'Sortino', format: formatRatio, higherIsBetter: true },
    { key: 'maxDrawdownPct', label: 'Max Drawdown', format: (v) => `-${v.toFixed(2)}%`, higherIsBetter: false },
    { key: 'winRate', label: 'Win Rate', format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
    { key: 'profitFactor', label: 'Profit Factor', format: formatRatio, higherIsBetter: true },
    { key: 'expectancy', label: 'Expectancy', format: formatCurrency, higherIsBetter: true },
    { key: 'totalTrades', label: 'Total Trades', format: (v) => String(v), higherIsBetter: true },
    { key: 'calmarRatio', label: 'Calmar', format: formatRatio, higherIsBetter: true },
    { key: 'recoveryFactor', label: 'Recovery Factor', format: formatRatio, higherIsBetter: true },
    { key: 'totalCommissions', label: 'Commissions', format: formatCurrency, higherIsBetter: false },
  ]

  return (
    <div className={cn('rounded-lg border border-border bg-navy-dark', className)}>
      <div className="px-4 py-3">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Comparison
        </span>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-navy-darker">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-text-muted">Metric</th>
              {results.map((r, i) => (
                <th key={i} className="px-4 py-2 text-right font-medium text-text-primary">
                  {r.strategyName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {metricKeys.map((metric) => {
              const values = results.map((r) => r.metrics[metric.key] as number)
              const bestIdx = metric.higherIsBetter
                ? values.indexOf(Math.max(...values))
                : values.indexOf(Math.min(...values))

              return (
                <tr key={metric.key} className="hover:bg-navy-darker/50">
                  <td className="px-4 py-1.5 font-medium text-text-muted">{metric.label}</td>
                  {values.map((val, i) => (
                    <td
                      key={i}
                      className={cn(
                        'px-4 py-1.5 text-right font-mono tabular-nums',
                        i === bestIdx ? 'font-semibold text-trading-green' : 'text-text-secondary',
                      )}
                    >
                      {metric.format(val)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export function BacktestResults({ data, className }: BacktestResultsProps) {
  const initialCapital = data.equity.length > 0 ? data.equity[0]!.equity : 0

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Strategy header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{data.strategyName}</h3>
          <span className="text-xs text-text-muted">{data.symbol}</span>
        </div>
      </div>

      {/* Summary stats bar */}
      <SummaryBar metrics={data.metrics} />

      {/* Equity curve */}
      <EquityCurveChart equity={data.equity} initialCapital={initialCapital} />

      {/* Drawdown chart */}
      <DrawdownChart equity={data.equity} />

      {/* Trade markers */}
      {data.equity.length >= 2 && data.trades.length > 0 && (
        <TradeMarkers
          trades={data.trades}
          timeStart={data.equity[0]!.timestamp}
          timeEnd={data.equity[data.equity.length - 1]!.timestamp}
        />
      )}

      {/* Metrics grid */}
      <MetricsGrid metrics={data.metrics} />

      {/* Trade log */}
      <TradeLogTable trades={data.trades} />
    </div>
  )
}
