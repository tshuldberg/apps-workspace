'use client'

import { useEffect, useRef, useMemo } from 'react'
import { cn } from '../lib/utils.js'

export interface HourlyData {
  hour: number
  winRate: number
  avgPnl: number
  count: number
  totalPnl: number
}

export interface TimeOfDayChartProps {
  data: HourlyData[]
  height?: number
  className?: string
}

// Market hours: pre-market 4-9:30, regular 9:30-16, after-hours 16-20
const MARKET_OPEN = 9
const MARKET_CLOSE = 16

/**
 * Bar chart showing average P&L by hour of the day.
 * Green bars for profitable hours, red for losing hours.
 * Market hours (9AM-4PM) are highlighted with a subtle background.
 */
export function TimeOfDayChart({ data, height = 200, className }: TimeOfDayChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const filteredData = useMemo(() => {
    // Show hours 4AM through 8PM (typical trading window)
    return data.filter((d) => d.hour >= 4 && d.hour <= 20)
  }, [data])

  const hasData = useMemo(() => filteredData.some((d) => d.count > 0), [filteredData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasData) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const padding = { top: 16, right: 16, bottom: 28, left: 56 }
    const plotW = w - padding.left - padding.right
    const plotH = h - padding.top - padding.bottom

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Calculate bounds
    const values = filteredData.map((d) => d.avgPnl)
    const maxVal = Math.max(0, ...values)
    const minVal = Math.min(0, ...values)
    const range = maxVal - minVal || 1

    const barCount = filteredData.length
    const barGap = 2
    const barWidth = Math.max(4, (plotW - barGap * (barCount - 1)) / barCount)

    // Zero line Y
    const zeroY = padding.top + plotH - ((0 - minVal) / range) * plotH

    // Market hours background highlight
    const marketStartIdx = filteredData.findIndex((d) => d.hour >= MARKET_OPEN)
    const marketEndIdx = filteredData.findIndex((d) => d.hour > MARKET_CLOSE) - 1
    if (marketStartIdx >= 0 && marketEndIdx >= 0) {
      const x1 = padding.left + marketStartIdx * (barWidth + barGap) - barGap / 2
      const x2 = padding.left + (marketEndIdx + 1) * (barWidth + barGap) - barGap / 2
      ctx.fillStyle = 'rgba(59, 130, 246, 0.04)'
      ctx.fillRect(x1, padding.top, x2 - x1, plotH)
    }

    // Draw zero line
    ctx.beginPath()
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.moveTo(padding.left, zeroY)
    ctx.lineTo(w - padding.right, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw bars
    for (let i = 0; i < barCount; i++) {
      const d = filteredData[i]
      if (d.count === 0) continue

      const x = padding.left + i * (barWidth + barGap)
      const barH = (Math.abs(d.avgPnl) / range) * plotH
      const y = d.avgPnl >= 0 ? zeroY - barH : zeroY

      const isPositive = d.avgPnl >= 0
      ctx.fillStyle = isPositive ? '#22c55e' : '#ef4444'
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      // Rounded top corners
      const r = Math.min(3, barWidth / 3, barH / 2)
      if (isPositive) {
        ctx.moveTo(x, y + r)
        ctx.arcTo(x, y, x + barWidth, y, r)
        ctx.arcTo(x + barWidth, y, x + barWidth, y + barH, r)
        ctx.lineTo(x + barWidth, y + barH)
        ctx.lineTo(x, y + barH)
      } else {
        ctx.moveTo(x, y)
        ctx.lineTo(x + barWidth, y)
        ctx.lineTo(x + barWidth, y + barH - r)
        ctx.arcTo(x + barWidth, y + barH, x, y + barH, r)
        ctx.arcTo(x, y + barH, x, y, r)
      }
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // X-axis labels
    ctx.fillStyle = '#64748b'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    for (let i = 0; i < barCount; i++) {
      const d = filteredData[i]
      // Show every other label to prevent crowding
      if (i % 2 !== 0 && barCount > 12) continue
      const x = padding.left + i * (barWidth + barGap) + barWidth / 2
      const label = d.hour === 0 ? '12a' : d.hour < 12 ? `${d.hour}a` : d.hour === 12 ? '12p' : `${d.hour - 12}p`
      const isMarketHour = d.hour >= MARKET_OPEN && d.hour <= MARKET_CLOSE
      ctx.fillStyle = isMarketHour ? '#94a3b8' : '#475569'
      ctx.fillText(label, x, h - padding.bottom + 8)
    }

    // Y-axis labels
    ctx.fillStyle = '#64748b'
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    const formatVal = (v: number) => {
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
      return `$${v.toFixed(0)}`
    }

    if (maxVal > 0) ctx.fillText(formatVal(maxVal), padding.left - 4, padding.top)
    if (minVal < 0) ctx.fillText(formatVal(minVal), padding.left - 4, padding.top + plotH)
    ctx.fillText('$0', padding.left - 4, zeroY)
  }, [filteredData, hasData, height])

  if (!hasData) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-border bg-navy-dark',
          className,
        )}
        style={{ height }}
      >
        <span className="text-xs text-text-muted">No time-of-day data available</span>
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
