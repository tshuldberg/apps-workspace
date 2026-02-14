'use client'

import { useEffect, useRef, useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────

export interface PercentileData {
  p5: number
  p25: number
  p50: number
  p75: number
  p95: number
}

export interface MonteCarloResultsProps {
  /** Sample equity paths (max ~100 for performance) */
  samplePaths: number[][]
  /** Percentile distribution for final equity */
  finalEquity: PercentileData
  /** Percentile distribution for max drawdown */
  maxDrawdown: PercentileData
  /** Percentile distribution for Sharpe ratio */
  sharpeRatio: PercentileData
  /** Probability of ruin (0-1) */
  ruinProbability: number
  /** Initial capital for reference */
  initialCapital: number
  /** Total number of simulations */
  numSimulations: number
  className?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}k`
  return `$${value.toFixed(0)}`
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

type RiskLevel = 'green' | 'yellow' | 'red'

function ruinLevel(probability: number): RiskLevel {
  if (probability < 0.05) return 'green'
  if (probability < 0.15) return 'yellow'
  return 'red'
}

const riskStyles: Record<RiskLevel, string> = {
  green: 'bg-trading-green/20 border-trading-green/30 text-trading-green',
  yellow: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
  red: 'bg-trading-red/20 border-trading-red/30 text-trading-red',
}

// ── Fan Chart (Equity Paths Visualization) ───────────────────────────────

function FanChart({
  paths,
  initialCapital,
  height = 240,
}: {
  paths: number[][]
  initialCapital: number
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || paths.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = { top: 16, right: 12, bottom: 24, left: 56 }
    const plotW = w - padding.left - padding.right
    const plotH = h - padding.top - padding.bottom

    ctx.clearRect(0, 0, w, h)

    // Find global min/max across all paths
    let globalMin = Infinity
    let globalMax = -Infinity
    let maxLen = 0

    for (const path of paths) {
      if (path.length > maxLen) maxLen = path.length
      for (const val of path) {
        if (val < globalMin) globalMin = val
        if (val > globalMax) globalMax = val
      }
    }

    const range = globalMax - globalMin || 1

    // Compute percentile bands at each time step
    const p5: number[] = []
    const p25: number[] = []
    const p50: number[] = []
    const p75: number[] = []
    const p95: number[] = []

    for (let t = 0; t < maxLen; t++) {
      const values: number[] = []
      for (const path of paths) {
        if (t < path.length) values.push(path[t]!)
      }
      values.sort((a, b) => a - b)

      const pctile = (p: number) => {
        const idx = Math.floor(p * (values.length - 1))
        return values[idx] ?? initialCapital
      }

      p5.push(pctile(0.05))
      p25.push(pctile(0.25))
      p50.push(pctile(0.50))
      p75.push(pctile(0.75))
      p95.push(pctile(0.95))
    }

    const toX = (t: number) => padding.left + (t / (maxLen - 1)) * plotW
    const toY = (v: number) => padding.top + plotH - ((v - globalMin) / range) * plotH

    // Draw P5-P95 band
    ctx.beginPath()
    for (let t = 0; t < maxLen; t++) ctx.lineTo(toX(t), toY(p95[t]!))
    for (let t = maxLen - 1; t >= 0; t--) ctx.lineTo(toX(t), toY(p5[t]!))
    ctx.closePath()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.06)'
    ctx.fill()

    // Draw P25-P75 band
    ctx.beginPath()
    for (let t = 0; t < maxLen; t++) ctx.lineTo(toX(t), toY(p75[t]!))
    for (let t = maxLen - 1; t >= 0; t--) ctx.lineTo(toX(t), toY(p25[t]!))
    ctx.closePath()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)'
    ctx.fill()

    // Draw individual paths (very faint)
    const maxPathsToDraw = Math.min(paths.length, 100)
    for (let i = 0; i < maxPathsToDraw; i++) {
      const path = paths[i]!
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)'
      ctx.lineWidth = 0.5
      for (let t = 0; t < path.length; t++) {
        if (t === 0) ctx.moveTo(toX(t), toY(path[t]!))
        else ctx.lineTo(toX(t), toY(path[t]!))
      }
      ctx.stroke()
    }

    // Draw median line
    ctx.beginPath()
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    for (let t = 0; t < maxLen; t++) {
      if (t === 0) ctx.moveTo(toX(t), toY(p50[t]!))
      else ctx.lineTo(toX(t), toY(p50[t]!))
    }
    ctx.stroke()

    // Draw P5 and P95 outlines
    for (const [line, color] of [[p5, 'rgba(59, 130, 246, 0.3)'], [p95, 'rgba(59, 130, 246, 0.3)']] as const) {
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      for (let t = 0; t < maxLen; t++) {
        if (t === 0) ctx.moveTo(toX(t), toY(line[t]!))
        else ctx.lineTo(toX(t), toY(line[t]!))
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Initial capital reference line
    ctx.beginPath()
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.setLineDash([6, 4])
    const icY = toY(initialCapital)
    ctx.moveTo(padding.left, icY)
    ctx.lineTo(w - padding.right, icY)
    ctx.stroke()
    ctx.setLineDash([])

    // Y-axis labels
    ctx.fillStyle = '#64748b'
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatCurrency(globalMax), padding.left - 4, padding.top + 4)
    ctx.fillText(formatCurrency(globalMin), padding.left - 4, padding.top + plotH - 4)

    // Labels
    ctx.fillStyle = '#475569'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Monte Carlo Fan Chart', padding.left + 4, padding.top + 10)

    // Legend
    ctx.font = '10px sans-serif'
    ctx.textBaseline = 'top'
    const legendY = h - 16
    ctx.fillStyle = '#3b82f6'
    ctx.fillRect(padding.left, legendY, 12, 2)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('Median', padding.left + 16, legendY - 4)

    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'
    ctx.fillRect(padding.left + 70, legendY, 12, 8)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('P5-P95', padding.left + 86, legendY - 4)

    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)'
    ctx.fillRect(padding.left + 140, legendY, 12, 8)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('P25-P75', padding.left + 156, legendY - 4)
  }, [paths, initialCapital, height])

  if (paths.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-navy-dark"
        style={{ height }}
      >
        <span className="text-xs text-text-muted">No simulation paths to display</span>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height }}
    />
  )
}

// ── Distribution Histogram ───────────────────────────────────────────────

function DistributionHistogram({
  paths,
  initialCapital,
  height = 120,
}: {
  paths: number[][]
  initialCapital: number
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const finalEquities = useMemo(() => {
    return paths.map((p) => p[p.length - 1] ?? initialCapital)
  }, [paths, initialCapital])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || finalEquities.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = { top: 16, right: 12, bottom: 24, left: 56 }
    const plotW = w - padding.left - padding.right
    const plotH = h - padding.top - padding.bottom

    ctx.clearRect(0, 0, w, h)

    const minVal = Math.min(...finalEquities)
    const maxVal = Math.max(...finalEquities)
    const range = maxVal - minVal || 1

    // Create bins
    const numBins = Math.min(40, Math.max(10, Math.floor(Math.sqrt(finalEquities.length))))
    const binWidth = range / numBins
    const bins = new Array(numBins).fill(0) as number[]

    for (const eq of finalEquities) {
      const bin = Math.min(Math.floor((eq - minVal) / binWidth), numBins - 1)
      bins[bin]!++
    }

    const maxBin = Math.max(...bins, 1)
    const barW = plotW / numBins

    for (let i = 0; i < numBins; i++) {
      const barH = (bins[i]! / maxBin) * plotH
      const x = padding.left + i * barW
      const y = padding.top + plotH - barH

      const binMidValue = minVal + (i + 0.5) * binWidth
      const isAboveInitial = binMidValue >= initialCapital
      ctx.fillStyle = isAboveInitial
        ? 'rgba(34, 197, 94, 0.4)'
        : 'rgba(239, 68, 68, 0.4)'
      ctx.fillRect(x + 1, y, barW - 2, barH)
    }

    // Initial capital reference line
    const icBin = (initialCapital - minVal) / range
    const icX = padding.left + icBin * plotW
    ctx.beginPath()
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.moveTo(icX, padding.top)
    ctx.lineTo(icX, padding.top + plotH)
    ctx.stroke()
    ctx.setLineDash([])

    // Labels
    ctx.fillStyle = '#64748b'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(formatCurrency(minVal), padding.left, padding.top + plotH + 4)
    ctx.fillText(formatCurrency(maxVal), padding.left + plotW, padding.top + plotH + 4)

    ctx.fillStyle = '#f59e0b'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Initial', icX, padding.top + 2)

    // Section label
    ctx.fillStyle = '#475569'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('Final Equity Distribution', padding.left + 4, padding.top + plotH + 12)
  }, [finalEquities, initialCapital, height])

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height }}
    />
  )
}

// ── Percentile Table ─────────────────────────────────────────────────────

function PercentileTable({
  finalEquity,
  maxDrawdown,
  sharpeRatio,
}: {
  finalEquity: PercentileData
  maxDrawdown: PercentileData
  sharpeRatio: PercentileData
}) {
  const rows = [
    {
      metric: 'Final Equity',
      p5: formatCurrency(finalEquity.p5),
      p25: formatCurrency(finalEquity.p25),
      p50: formatCurrency(finalEquity.p50),
      p75: formatCurrency(finalEquity.p75),
      p95: formatCurrency(finalEquity.p95),
    },
    {
      metric: 'Max Drawdown',
      p5: formatPct(maxDrawdown.p5),
      p25: formatPct(maxDrawdown.p25),
      p50: formatPct(maxDrawdown.p50),
      p75: formatPct(maxDrawdown.p75),
      p95: formatPct(maxDrawdown.p95),
    },
    {
      metric: 'Sharpe Ratio',
      p5: sharpeRatio.p5.toFixed(2),
      p25: sharpeRatio.p25.toFixed(2),
      p50: sharpeRatio.p50.toFixed(2),
      p75: sharpeRatio.p75.toFixed(2),
      p95: sharpeRatio.p95.toFixed(2),
    },
  ]

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-navy-dark">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            <th className="px-3 py-2 font-medium">Metric</th>
            <th className="px-3 py-2 text-right font-medium">P5</th>
            <th className="px-3 py-2 text-right font-medium">P25</th>
            <th className="px-3 py-2 text-right font-medium text-blue-400">P50</th>
            <th className="px-3 py-2 text-right font-medium">P75</th>
            <th className="px-3 py-2 text-right font-medium">P95</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.metric}
              className="border-b border-border/50 hover:bg-white/[0.02]"
            >
              <td className="px-3 py-2 font-medium text-text-primary">{row.metric}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-text-muted">
                {row.p5}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-text-muted">
                {row.p25}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-blue-400">
                {row.p50}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-text-muted">
                {row.p75}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-text-muted">
                {row.p95}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

export function MonteCarloResults({
  samplePaths,
  finalEquity,
  maxDrawdown,
  sharpeRatio,
  ruinProbability,
  initialCapital,
  numSimulations,
  className,
}: MonteCarloResultsProps) {
  const level = ruinLevel(ruinProbability)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Header: Ruin Probability + Simulation Count */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-navy-dark px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Risk of Ruin
          </span>
          <span className="text-xs text-text-muted">
            {numSimulations.toLocaleString()} Monte Carlo simulations
          </span>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded border px-3 py-1 font-mono text-lg font-bold tabular-nums',
            riskStyles[level],
          )}
        >
          {(ruinProbability * 100).toFixed(1)}%
        </span>
      </div>

      {/* Fan Chart */}
      <div className="overflow-hidden rounded-lg border border-border bg-navy-dark">
        <FanChart
          paths={samplePaths}
          initialCapital={initialCapital}
          height={240}
        />
      </div>

      {/* Percentile Table */}
      <PercentileTable
        finalEquity={finalEquity}
        maxDrawdown={maxDrawdown}
        sharpeRatio={sharpeRatio}
      />

      {/* Distribution Histogram */}
      <div className="overflow-hidden rounded-lg border border-border bg-navy-dark">
        <DistributionHistogram
          paths={samplePaths}
          initialCapital={initialCapital}
          height={120}
        />
      </div>
    </div>
  )
}
