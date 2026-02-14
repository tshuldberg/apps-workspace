'use client'

import { useEffect, useRef, useMemo } from 'react'
import { cn } from '../lib/utils.js'

export interface EquityDrawdownPoint {
  date: string
  cumulativePnl: number
  drawdown: number
}

export interface EquityDrawdownChartProps {
  data: EquityDrawdownPoint[]
  height?: number
  className?: string
}

/**
 * Two-panel chart: top shows equity curve, bottom shows drawdown percentage.
 * This is the performance dashboard variant of the simpler EquityCurve component.
 */
export function EquityDrawdownChart({ data, height = 280, className }: EquityDrawdownChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.date.localeCompare(b.date))
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
    const gapH = 8

    // Split: 65% equity curve, 35% drawdown
    const equityH = (h - padding.top - padding.bottom - gapH) * 0.65
    const ddH = (h - padding.top - padding.bottom - gapH) * 0.35
    const ddTop = padding.top + equityH + gapH

    // Clear
    ctx.clearRect(0, 0, w, h)

    const plotW = w - padding.left - padding.right
    const n = sortedData.length

    // ─── Equity Curve ──────────────────────────────────────────
    const pnls = sortedData.map((d) => d.cumulativePnl)
    const eMin = Math.min(0, ...pnls)
    const eMax = Math.max(0, ...pnls)
    const eRange = eMax - eMin || 1

    const ePoints = sortedData.map((d, i) => ({
      x: padding.left + (i / (n - 1)) * plotW,
      y: padding.top + equityH - ((d.cumulativePnl - eMin) / eRange) * equityH,
    }))

    // Equity zero line
    const eZeroY = padding.top + equityH - ((0 - eMin) / eRange) * equityH
    ctx.beginPath()
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.moveTo(padding.left, eZeroY)
    ctx.lineTo(w - padding.right, eZeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // Equity fill
    const finalPnl = sortedData[n - 1].cumulativePnl
    const lineColor = finalPnl >= 0 ? '#22c55e' : '#ef4444'
    const fillColor = finalPnl >= 0 ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)'

    ctx.beginPath()
    ctx.moveTo(ePoints[0].x, eZeroY)
    for (const p of ePoints) ctx.lineTo(p.x, p.y)
    ctx.lineTo(ePoints[n - 1].x, eZeroY)
    ctx.closePath()
    ctx.fillStyle = fillColor
    ctx.fill()

    // Equity line
    ctx.beginPath()
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(ePoints[i].x, ePoints[i].y)
      else ctx.lineTo(ePoints[i].x, ePoints[i].y)
    }
    ctx.stroke()

    // ─── Drawdown Chart ────────────────────────────────────────
    const dds = sortedData.map((d) => d.drawdown)
    const ddMax = Math.max(...dds, 1)

    const ddPoints = sortedData.map((d, i) => ({
      x: padding.left + (i / (n - 1)) * plotW,
      y: ddTop + (d.drawdown / ddMax) * ddH,
    }))

    // Drawdown fill
    ctx.beginPath()
    ctx.moveTo(ddPoints[0].x, ddTop)
    for (const p of ddPoints) ctx.lineTo(p.x, p.y)
    ctx.lineTo(ddPoints[n - 1].x, ddTop)
    ctx.closePath()
    ctx.fillStyle = 'rgba(239, 68, 68, 0.12)'
    ctx.fill()

    // Drawdown line
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'
    ctx.lineWidth = 1.5
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(ddPoints[i].x, ddPoints[i].y)
      else ctx.lineTo(ddPoints[i].x, ddPoints[i].y)
    }
    ctx.stroke()

    // Drawdown zero line
    ctx.beginPath()
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.moveTo(padding.left, ddTop)
    ctx.lineTo(w - padding.right, ddTop)
    ctx.stroke()

    // ─── Labels ────────────────────────────────────────────────
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    const formatVal = (v: number) => {
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
      return `$${v.toFixed(0)}`
    }

    // Equity Y-axis
    ctx.fillStyle = '#64748b'
    ctx.fillText(formatVal(eMax), padding.left - 4, padding.top + 4)
    ctx.fillText(formatVal(eMin), padding.left - 4, padding.top + equityH - 4)
    if (eMin < 0 && eMax > 0) {
      ctx.fillText('$0', padding.left - 4, eZeroY)
    }

    // Drawdown Y-axis
    ctx.fillStyle = '#64748b'
    ctx.fillText('0%', padding.left - 4, ddTop)
    ctx.fillText(`-${ddMax.toFixed(0)}%`, padding.left - 4, ddTop + ddH)

    // Section labels
    ctx.fillStyle = '#475569'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Equity', padding.left + 4, padding.top + 10)
    ctx.fillText('Drawdown', padding.left + 4, ddTop + 10)

    // Equity final value
    const lastEP = ePoints[n - 1]
    ctx.fillStyle = lineColor
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(formatVal(finalPnl), lastEP.x + 4, lastEP.y)

    // X-axis date labels
    ctx.fillStyle = '#475569'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const dateY = ddTop + ddH + 6
    const step = Math.max(1, Math.floor(n / 5))
    for (let i = 0; i < n; i += step) {
      const x = padding.left + (i / (n - 1)) * plotW
      const d = sortedData[i].date
      const label = d.slice(5) // MM-DD
      ctx.fillText(label, x, dateY)
    }
    // Always show last date
    if (n - 1 > 0) {
      const x = padding.left + plotW
      ctx.fillText(sortedData[n - 1].date.slice(5), x, dateY)
    }
  }, [sortedData, height])

  if (sortedData.length < 2) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-border bg-navy-dark',
          className,
        )}
        style={{ height }}
      >
        <span className="text-xs text-text-muted">Not enough data for equity + drawdown chart</span>
      </div>
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-navy-dark', className)}>
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height }}
      />
    </div>
  )
}
