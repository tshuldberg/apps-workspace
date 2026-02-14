'use client'

import { useEffect, useRef, useMemo } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────

export interface WalkForwardWindowData {
  windowIndex: number
  inSampleStart: number
  inSampleEnd: number
  outOfSampleStart: number
  outOfSampleEnd: number
  inSampleSharpe: number
  outOfSampleSharpe: number
  degradation: number
  params: Record<string, number>
}

export interface WalkForwardResultsProps {
  windows: WalkForwardWindowData[]
  overfittingScore: number
  oosEquityCurve: { timestamp: number; equity: number }[]
  height?: number
  className?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatParams(params: Record<string, number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
}

type DegradationLevel = 'green' | 'yellow' | 'red'

function degradationColor(degradation: number): DegradationLevel {
  const pct = degradation * 100
  if (pct < 20) return 'green'
  if (pct < 40) return 'yellow'
  return 'red'
}

const levelStyles: Record<DegradationLevel, string> = {
  green: 'text-trading-green',
  yellow: 'text-yellow-400',
  red: 'text-trading-red',
}

const levelBgStyles: Record<DegradationLevel, string> = {
  green: 'bg-trading-green/20 border-trading-green/30 text-trading-green',
  yellow: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
  red: 'bg-trading-red/20 border-trading-red/30 text-trading-red',
}

// ── Timeline Chart ───────────────────────────────────────────────────────

function WindowTimeline({
  windows,
  height = 120,
}: {
  windows: WalkForwardWindowData[]
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || windows.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = { top: 16, right: 12, bottom: 24, left: 12 }
    const plotW = w - padding.left - padding.right
    const plotH = h - padding.top - padding.bottom

    ctx.clearRect(0, 0, w, h)

    // Find global time range
    const minTs = Math.min(...windows.map((w) => w.inSampleStart))
    const maxTs = Math.max(...windows.map((w) => w.outOfSampleEnd))
    const tsRange = maxTs - minTs || 1

    const barHeight = Math.min(
      Math.floor(plotH / windows.length) - 2,
      20,
    )
    const totalBarsHeight = windows.length * (barHeight + 2)
    const yOffset = padding.top + (plotH - totalBarsHeight) / 2

    for (let i = 0; i < windows.length; i++) {
      const win = windows[i]!
      const y = yOffset + i * (barHeight + 2)

      // In-sample bar (blue)
      const isX = padding.left + ((win.inSampleStart - minTs) / tsRange) * plotW
      const isW = ((win.inSampleEnd - win.inSampleStart) / tsRange) * plotW
      ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'
      ctx.fillRect(isX, y, isW, barHeight)

      // Out-of-sample bar (colored by degradation)
      const oosX = padding.left + ((win.outOfSampleStart - minTs) / tsRange) * plotW
      const oosW = ((win.outOfSampleEnd - win.outOfSampleStart) / tsRange) * plotW
      const level = degradationColor(Math.abs(win.degradation))
      ctx.fillStyle =
        level === 'green'
          ? 'rgba(34, 197, 94, 0.5)'
          : level === 'yellow'
            ? 'rgba(234, 179, 8, 0.5)'
            : 'rgba(239, 68, 68, 0.5)'
      ctx.fillRect(oosX, y, oosW, barHeight)

      // Window label
      ctx.fillStyle = '#94a3b8'
      ctx.font = '9px monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(`W${i + 1}`, isX - 4, y + barHeight / 2)
    }

    // Legend
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    const legendY = h - 16

    ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'
    ctx.fillRect(padding.left, legendY, 12, 10)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('In-Sample', padding.left + 16, legendY)

    ctx.fillStyle = 'rgba(34, 197, 94, 0.5)'
    ctx.fillRect(padding.left + 90, legendY, 12, 10)
    ctx.fillStyle = '#94a3b8'
    ctx.fillText('Out-of-Sample', padding.left + 106, legendY)
  }, [windows, height])

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height }}
    />
  )
}

// ── OOS Equity Curve ─────────────────────────────────────────────────────

function OosEquityCurve({
  data,
  height = 160,
}: {
  data: { timestamp: number; equity: number }[]
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.timestamp - b.timestamp)
  }, [data])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || sortedData.length < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = { top: 12, right: 12, bottom: 20, left: 56 }
    const plotW = w - padding.left - padding.right
    const plotH = h - padding.top - padding.bottom

    ctx.clearRect(0, 0, w, h)

    const values = sortedData.map((d) => d.equity)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const range = maxVal - minVal || 1
    const n = sortedData.length

    const points = sortedData.map((d, i) => ({
      x: padding.left + (i / (n - 1)) * plotW,
      y: padding.top + plotH - ((d.equity - minVal) / range) * plotH,
    }))

    // Fill
    const finalEquity = sortedData[n - 1]!.equity
    const firstEquity = sortedData[0]!.equity
    const isPositive = finalEquity >= firstEquity
    const lineColor = isPositive ? '#22c55e' : '#ef4444'
    const fillColor = isPositive ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)'

    const baseY = padding.top + plotH
    ctx.beginPath()
    ctx.moveTo(points[0]!.x, baseY)
    for (const p of points) ctx.lineTo(p.x, p.y)
    ctx.lineTo(points[n - 1]!.x, baseY)
    ctx.closePath()
    ctx.fillStyle = fillColor
    ctx.fill()

    // Line
    ctx.beginPath()
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(points[i]!.x, points[i]!.y)
      else ctx.lineTo(points[i]!.x, points[i]!.y)
    }
    ctx.stroke()

    // Y-axis labels
    ctx.fillStyle = '#64748b'
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    const formatVal = (v: number) => {
      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
      return `$${v.toFixed(0)}`
    }

    ctx.fillText(formatVal(maxVal), padding.left - 4, padding.top)
    ctx.fillText(formatVal(minVal), padding.left - 4, padding.top + plotH)

    // Final value label
    const lastPt = points[n - 1]!
    ctx.fillStyle = lineColor
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(formatVal(finalEquity), lastPt.x + 4, lastPt.y)

    // Section label
    ctx.fillStyle = '#475569'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Aggregate OOS Equity', padding.left + 4, padding.top + 10)
  }, [sortedData, height])

  if (sortedData.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-navy-dark"
        style={{ height }}
      >
        <span className="text-xs text-text-muted">Not enough data for OOS equity curve</span>
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

// ── Main Component ───────────────────────────────────────────────────────

export function WalkForwardResults({
  windows,
  overfittingScore,
  oosEquityCurve,
  height,
  className,
}: WalkForwardResultsProps) {
  const scoreLevel = degradationColor(Math.abs(overfittingScore))
  const scorePct = (overfittingScore * 100).toFixed(1)

  if (windows.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-border bg-navy-dark p-8',
          className,
        )}
      >
        <span className="text-sm text-text-muted">
          No walk-forward windows generated. Provide more data or adjust configuration.
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Overfitting Score Header */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-navy-dark px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Overfitting Score
          </span>
          <span className="text-xs text-text-muted">
            Avg IS-to-OOS Sharpe degradation ({windows.length} window{windows.length !== 1 ? 's' : ''})
          </span>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded border px-3 py-1 font-mono text-lg font-bold tabular-nums',
            levelBgStyles[scoreLevel],
          )}
        >
          {scorePct}%
        </span>
      </div>

      {/* Window Timeline Chart */}
      <div className="overflow-hidden rounded-lg border border-border bg-navy-dark">
        <WindowTimeline windows={windows} height={height ?? 120} />
      </div>

      {/* Per-Window Metrics Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-navy-dark">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">IS Period</th>
              <th className="px-3 py-2 font-medium">OOS Period</th>
              <th className="px-3 py-2 font-medium text-right">IS Sharpe</th>
              <th className="px-3 py-2 font-medium text-right">OOS Sharpe</th>
              <th className="px-3 py-2 font-medium text-right">Degradation</th>
              <th className="px-3 py-2 font-medium">Parameters</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((win) => {
              const degLevel = degradationColor(Math.abs(win.degradation))
              return (
                <tr
                  key={win.windowIndex}
                  className="border-b border-border/50 hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2 font-mono text-text-muted">
                    {win.windowIndex + 1}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-muted">
                    {formatDate(win.inSampleStart)} - {formatDate(win.inSampleEnd)}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-muted">
                    {formatDate(win.outOfSampleStart)} - {formatDate(win.outOfSampleEnd)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-text-primary">
                    {win.inSampleSharpe.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-text-primary">
                    {win.outOfSampleSharpe.toFixed(2)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-mono tabular-nums',
                      levelStyles[degLevel],
                    )}
                  >
                    {(win.degradation * 100).toFixed(1)}%
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-[10px] text-text-muted">
                    {formatParams(win.params)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Aggregate OOS Equity Curve */}
      <div className="overflow-hidden rounded-lg border border-border bg-navy-dark">
        <OosEquityCurve data={oosEquityCurve} height={160} />
      </div>
    </div>
  )
}
