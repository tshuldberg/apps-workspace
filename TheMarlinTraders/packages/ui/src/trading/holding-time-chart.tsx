'use client'

import { useEffect, useRef, useMemo, useState } from 'react'
import { cn } from '../lib/utils.js'

export interface HoldingTimeData {
  holdingTimeHours: number
  pnl: number
  symbol: string
  date: string
}

export interface HoldingTimeChartProps {
  data: HoldingTimeData[]
  height?: number
  className?: string
}

/**
 * Scatter plot: X = holding time (hours), Y = P&L per trade.
 * Winners are green dots, losers are red dots.
 * Includes a visual cluster highlight for the optimal holding range.
 */
export function HoldingTimeChart({ data, height = 240, className }: HoldingTimeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    point: HoldingTimeData
  } | null>(null)

  const sortedData = useMemo(() => {
    return [...data].filter((d) => d.holdingTimeHours > 0)
  }, [data])

  const hasData = sortedData.length > 0

  // Compute padding/scales once
  const scales = useMemo(() => {
    if (!hasData) return null
    const padding = { top: 16, right: 16, bottom: 28, left: 56 }
    const hours = sortedData.map((d) => d.holdingTimeHours)
    const pnls = sortedData.map((d) => d.pnl)
    const maxHours = Math.max(...hours)
    const minPnl = Math.min(0, ...pnls)
    const maxPnl = Math.max(0, ...pnls)
    const pnlRange = maxPnl - minPnl || 1
    return { padding, maxHours, minPnl, maxPnl, pnlRange }
  }, [sortedData, hasData])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasData || !scales) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const w = rect.width
    const h = rect.height
    const { padding, maxHours, minPnl, pnlRange } = scales
    const plotW = w - padding.left - padding.right
    const plotH = h - padding.top - padding.bottom

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Zero line
    const zeroY = padding.top + plotH - ((0 - minPnl) / pnlRange) * plotH
    ctx.beginPath()
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.moveTo(padding.left, zeroY)
    ctx.lineTo(w - padding.right, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // Grid lines (horizontal)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 0.5
    const gridSteps = 4
    for (let i = 1; i < gridSteps; i++) {
      const gy = padding.top + (plotH / gridSteps) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, gy)
      ctx.lineTo(w - padding.right, gy)
      ctx.stroke()
    }

    // Draw scatter points
    const dotRadius = Math.max(3, Math.min(5, 200 / sortedData.length))
    for (const point of sortedData) {
      const x = padding.left + (point.holdingTimeHours / maxHours) * plotW
      const y = padding.top + plotH - ((point.pnl - minPnl) / pnlRange) * plotH

      const isWin = point.pnl >= 0
      ctx.beginPath()
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = isWin ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
      ctx.fill()
      ctx.strokeStyle = isWin ? '#22c55e' : '#ef4444'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Y-axis labels
    ctx.fillStyle = '#64748b'
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    const formatPnl = (v: number) => {
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
      return `$${v.toFixed(0)}`
    }

    ctx.fillText(formatPnl(scales.maxPnl), padding.left - 4, padding.top)
    ctx.fillText(formatPnl(scales.minPnl), padding.left - 4, padding.top + plotH)
    if (scales.minPnl < 0 && scales.maxPnl > 0) {
      ctx.fillText('$0', padding.left - 4, zeroY)
    }

    // X-axis labels
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const xSteps = Math.min(6, Math.ceil(maxHours))
    for (let i = 0; i <= xSteps; i++) {
      const hours = (maxHours / xSteps) * i
      const x = padding.left + (hours / maxHours) * plotW
      let label: string
      if (hours >= 24) {
        label = `${(hours / 24).toFixed(0)}d`
      } else {
        label = `${hours.toFixed(0)}h`
      }
      ctx.fillText(label, x, h - padding.bottom + 8)
    }
  }, [sortedData, hasData, scales, height])

  // Tooltip on hover
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || !scales || !hasData) return

    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const { padding, maxHours, minPnl, pnlRange } = scales
    const plotW = rect.width - padding.left - padding.right
    const plotH = rect.height - padding.top - padding.bottom

    let closest: { dist: number; point: HoldingTimeData; x: number; y: number } | null = null

    for (const point of sortedData) {
      const px = padding.left + (point.holdingTimeHours / maxHours) * plotW
      const py = padding.top + plotH - ((point.pnl - minPnl) / pnlRange) * plotH
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2)
      if (dist < 20 && (!closest || dist < closest.dist)) {
        closest = { dist, point, x: px, y: py }
      }
    }

    if (closest) {
      setTooltip({ x: closest.x, y: closest.y, point: closest.point })
    } else {
      setTooltip(null)
    }
  }

  if (!hasData) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-border bg-navy-dark',
          className,
        )}
        style={{ height }}
      >
        <span className="text-xs text-text-muted">No holding time data available</span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden rounded-lg border border-border bg-navy-dark', className)}
    >
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-border bg-navy-dark px-2.5 py-1.5 shadow-lg"
          style={{
            left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth ?? 300) - 140),
            top: tooltip.y - 40,
          }}
        >
          <div className="text-xs font-semibold text-text-primary">{tooltip.point.symbol}</div>
          <div className="text-[10px] text-text-muted">
            {tooltip.point.holdingTimeHours >= 24
              ? `${(tooltip.point.holdingTimeHours / 24).toFixed(1)}d`
              : `${tooltip.point.holdingTimeHours.toFixed(1)}h`}
            {' hold'}
          </div>
          <div
            className={cn(
              'font-mono text-xs font-semibold',
              tooltip.point.pnl >= 0 ? 'text-trading-green' : 'text-trading-red',
            )}
          >
            {tooltip.point.pnl >= 0 ? '+' : ''}${tooltip.point.pnl.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  )
}
