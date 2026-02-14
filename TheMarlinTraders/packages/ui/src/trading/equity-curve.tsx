'use client'

import { useEffect, useRef, useMemo } from 'react'
import { cn } from '../lib/utils.js'

export interface EquityCurvePoint {
  date: string
  cumulativePnl: number
}

export interface EquityCurveProps {
  data: EquityCurvePoint[]
  height?: number
  className?: string
}

/**
 * Mini equity curve rendered on a canvas element.
 * Shows cumulative P&L over time as a filled line chart.
 * Green when above zero, red when below.
 */
export function EquityCurve({ data, height = 120, className }: EquityCurveProps) {
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
    const padding = { top: 10, right: 10, bottom: 20, left: 50 }
    const plotW = w - padding.left - padding.right
    const plotH = h - padding.top - padding.bottom

    // Clear
    ctx.clearRect(0, 0, w, h)

    // Calculate bounds
    const values = sortedData.map((d) => d.cumulativePnl)
    const minVal = Math.min(0, ...values)
    const maxVal = Math.max(0, ...values)
    const range = maxVal - minVal || 1

    // Map data to pixel coordinates
    const points = sortedData.map((d, i) => ({
      x: padding.left + (i / (sortedData.length - 1)) * plotW,
      y: padding.top + plotH - ((d.cumulativePnl - minVal) / range) * plotH,
    }))

    // Zero line Y
    const zeroY = padding.top + plotH - ((0 - minVal) / range) * plotH

    // Draw zero line
    ctx.beginPath()
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.moveTo(padding.left, zeroY)
    ctx.lineTo(w - padding.right, zeroY)
    ctx.stroke()
    ctx.setLineDash([])

    // Determine final color
    const finalPnl = sortedData[sortedData.length - 1].cumulativePnl
    const lineColor = finalPnl >= 0 ? '#22c55e' : '#ef4444'
    const fillColor = finalPnl >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'

    // Draw filled area from line to zero
    ctx.beginPath()
    ctx.moveTo(points[0].x, zeroY)
    for (const p of points) {
      ctx.lineTo(p.x, p.y)
    }
    ctx.lineTo(points[points.length - 1].x, zeroY)
    ctx.closePath()
    ctx.fillStyle = fillColor
    ctx.fill()

    // Draw line
    ctx.beginPath()
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (let i = 0; i < points.length; i++) {
      if (i === 0) ctx.moveTo(points[i].x, points[i].y)
      else ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.stroke()

    // Y-axis labels
    ctx.fillStyle = '#64748b'
    ctx.font = '10px monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'

    const formatVal = (v: number) => {
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`
      return `$${v.toFixed(0)}`
    }

    ctx.fillText(formatVal(maxVal), padding.left - 4, padding.top)
    ctx.fillText(formatVal(minVal), padding.left - 4, padding.top + plotH)
    if (minVal < 0 && maxVal > 0) {
      ctx.fillText('$0', padding.left - 4, zeroY)
    }

    // Final value label
    const lastPoint = points[points.length - 1]
    ctx.fillStyle = lineColor
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(formatVal(finalPnl), lastPoint.x + 4, lastPoint.y)
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
        <span className="text-xs text-text-muted">Not enough data for equity curve</span>
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
