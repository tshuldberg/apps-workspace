'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'
import type { Strategy, PnLPoint } from '@marlin/shared'
import {
  calculatePnLAtExpiry,
  calculatePnLAtDate,
  calculateMaxProfit,
  calculateMaxLoss,
  calculateBreakevens,
  calculateProbOfProfit,
  getDefaultPriceRange,
} from '@marlin/shared'

export interface PnLDiagramProps {
  strategy: Strategy
  volatility?: number
  riskFreeRate?: number
  className?: string
}

const STEPS = 500
const GREEN = '#22c55e'
const RED = '#ef4444'
const GREEN_FILL = 'rgba(34, 197, 94, 0.12)'
const RED_FILL = 'rgba(239, 68, 68, 0.12)'
const GRID_COLOR = '#1e293b'
const LABEL_COLOR = '#64748b'
const ACCENT_COLOR = '#3b82f6'
const DASHED_COLOR = '#94a3b8'
const BREAKEVEN_COLOR = '#fbbf24'

/**
 * Format a dollar value for display, handling large numbers.
 */
function formatDollar(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

/**
 * Calculate the number of days between two dates.
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime()
  const b = new Date(dateB).getTime()
  return Math.max(0, Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24)))
}

/**
 * Get today's date as YYYY-MM-DD.
 */
function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Add days to a date string.
 */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function PnLDiagram({
  strategy,
  volatility = 0.3,
  riskFreeRate = 0.05,
  className,
}: PnLDiagramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [dateSlider, setDateSlider] = useState(0) // 0 = today, 100 = expiry

  const hasLegs = strategy.legs.length > 0

  // ── Derived data ─────────────────────────────────────────────────────────

  const priceRange = useMemo<[number, number]>(() => {
    if (!hasLegs) return [0, 200]
    return getDefaultPriceRange(strategy)
  }, [strategy, hasLegs])

  const expiryPoints = useMemo<PnLPoint[]>(() => {
    if (!hasLegs) return []
    return calculatePnLAtExpiry(strategy, priceRange, STEPS)
  }, [strategy, priceRange, hasLegs])

  // Earliest expiration date across all legs
  const earliestExpiry = useMemo(() => {
    if (!hasLegs) return todayString()
    const dates = strategy.legs.map((l) => l.expiration)
    dates.sort()
    return dates[0]!
  }, [strategy, hasLegs])

  const totalDays = useMemo(() => daysBetween(todayString(), earliestExpiry), [earliestExpiry])

  const sliderDate = useMemo(() => {
    const daysFromNow = Math.round((dateSlider / 100) * totalDays)
    return addDays(todayString(), daysFromNow)
  }, [dateSlider, totalDays])

  const currentDatePoints = useMemo<PnLPoint[]>(() => {
    if (!hasLegs) return []
    return calculatePnLAtDate(strategy, priceRange, STEPS, sliderDate, volatility, riskFreeRate)
  }, [strategy, priceRange, sliderDate, volatility, riskFreeRate, hasLegs])

  const maxProfit = useMemo(() => (hasLegs ? calculateMaxProfit(strategy) : 0), [strategy, hasLegs])
  const maxLoss = useMemo(() => (hasLegs ? calculateMaxLoss(strategy) : 0), [strategy, hasLegs])
  const breakevens = useMemo(() => (hasLegs ? calculateBreakevens(strategy) : []), [strategy, hasLegs])
  const probProfit = useMemo(
    () => (hasLegs ? calculateProbOfProfit(strategy, volatility) : 0),
    [strategy, volatility, hasLegs],
  )

  // ── Canvas Drawing ───────────────────────────────────────────────────────

  const padding = { top: 24, right: 60, bottom: 40, left: 70 }

  const draw = useCallback(
    (hoverX: number | null) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)

      const w = rect.width
      const h = rect.height
      const plotW = w - padding.left - padding.right
      const plotH = h - padding.top - padding.bottom

      // Clear
      ctx.clearRect(0, 0, w, h)

      if (!hasLegs || expiryPoints.length === 0) {
        ctx.fillStyle = LABEL_COLOR
        ctx.font = '13px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('Add legs to see P&L diagram', w / 2, h / 2)
        return
      }

      // Calculate Y bounds from both datasets
      const allPnls = [...expiryPoints.map((p) => p.pnl), ...currentDatePoints.map((p) => p.pnl)]
      const dataMin = Math.min(0, ...allPnls)
      const dataMax = Math.max(0, ...allPnls)
      const yRange = dataMax - dataMin || 1
      const yPad = yRange * 0.1
      const yMin = dataMin - yPad
      const yMax = dataMax + yPad
      const ySpan = yMax - yMin

      // Map functions
      const xToPixel = (price: number) =>
        padding.left + ((price - priceRange[0]) / (priceRange[1] - priceRange[0])) * plotW
      const yToPixel = (pnl: number) =>
        padding.top + plotH - ((pnl - yMin) / ySpan) * plotH
      const pixelToPrice = (px: number) =>
        priceRange[0] + ((px - padding.left) / plotW) * (priceRange[1] - priceRange[0])

      // ── Grid lines ──────────────────────────────────────────────────────

      ctx.strokeStyle = GRID_COLOR
      ctx.lineWidth = 1

      // Horizontal grid (5 lines)
      const ySteps = 5
      for (let i = 0; i <= ySteps; i++) {
        const yVal = yMin + (i / ySteps) * ySpan
        const y = yToPixel(yVal)
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(w - padding.right, y)
        ctx.stroke()

        // Y-axis labels
        ctx.fillStyle = LABEL_COLOR
        ctx.font = '10px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(formatDollar(yVal), padding.left - 8, y + 3)
      }

      // Vertical grid (price labels)
      const xSteps = 6
      for (let i = 0; i <= xSteps; i++) {
        const priceVal = priceRange[0] + (i / xSteps) * (priceRange[1] - priceRange[0])
        const x = xToPixel(priceVal)
        ctx.beginPath()
        ctx.moveTo(x, padding.top)
        ctx.lineTo(x, h - padding.bottom)
        ctx.stroke()

        ctx.fillStyle = LABEL_COLOR
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`$${priceVal.toFixed(0)}`, x, h - padding.bottom + 14)
      }

      // ── Zero line ────────────────────────────────────────────────────────

      const zeroY = yToPixel(0)
      ctx.beginPath()
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 1
      ctx.setLineDash([])
      ctx.moveTo(padding.left, zeroY)
      ctx.lineTo(w - padding.right, zeroY)
      ctx.stroke()

      // ── Fill areas (green above zero, red below zero) ────────────────────

      // At-expiry fill
      for (let i = 1; i < expiryPoints.length; i++) {
        const prev = expiryPoints[i - 1]!
        const curr = expiryPoints[i]!
        const x0 = xToPixel(prev.price)
        const x1 = xToPixel(curr.price)
        const y0 = yToPixel(prev.pnl)
        const y1 = yToPixel(curr.pnl)

        // Determine fill color based on whether segment is above or below zero
        const avgPnl = (prev.pnl + curr.pnl) / 2
        ctx.beginPath()
        ctx.moveTo(x0, zeroY)
        ctx.lineTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.lineTo(x1, zeroY)
        ctx.closePath()
        ctx.fillStyle = avgPnl >= 0 ? GREEN_FILL : RED_FILL
        ctx.fill()
      }

      // ── Current-date P&L line (dashed) ────────────────────────────────────

      if (currentDatePoints.length > 0) {
        ctx.beginPath()
        ctx.strokeStyle = DASHED_COLOR
        ctx.lineWidth = 1.5
        ctx.setLineDash([6, 4])
        for (let i = 0; i < currentDatePoints.length; i++) {
          const p = currentDatePoints[i]!
          const x = xToPixel(p.price)
          const y = yToPixel(p.pnl)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      // ── At-expiry P&L line (bold) ─────────────────────────────────────────

      ctx.beginPath()
      ctx.lineWidth = 2.5
      for (let i = 0; i < expiryPoints.length; i++) {
        const p = expiryPoints[i]!
        const x = xToPixel(p.price)
        const y = yToPixel(p.pnl)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      // Use gradient along the line
      ctx.strokeStyle = GREEN
      ctx.stroke()

      // Re-draw segments that are below zero in red
      ctx.beginPath()
      ctx.strokeStyle = RED
      ctx.lineWidth = 2.5
      let inRed = false
      for (let i = 0; i < expiryPoints.length; i++) {
        const p = expiryPoints[i]!
        const x = xToPixel(p.price)
        const y = yToPixel(p.pnl)
        if (p.pnl < 0) {
          if (!inRed) {
            ctx.moveTo(x, y)
            inRed = true
          } else {
            ctx.lineTo(x, y)
          }
        } else {
          if (inRed) {
            ctx.lineTo(x, y)
            ctx.stroke()
            ctx.beginPath()
            inRed = false
          }
        }
      }
      if (inRed) ctx.stroke()

      // ── Breakeven lines ──────────────────────────────────────────────────

      ctx.setLineDash([4, 4])
      ctx.strokeStyle = BREAKEVEN_COLOR
      ctx.lineWidth = 1
      for (const be of breakevens) {
        const x = xToPixel(be)
        if (x >= padding.left && x <= w - padding.right) {
          ctx.beginPath()
          ctx.moveTo(x, padding.top)
          ctx.lineTo(x, h - padding.bottom)
          ctx.stroke()

          // Label
          ctx.fillStyle = BREAKEVEN_COLOR
          ctx.font = '9px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`BE $${be.toFixed(2)}`, x, padding.top - 6)
        }
      }
      ctx.setLineDash([])

      // ── Current price line ────────────────────────────────────────────────

      const currentX = xToPixel(strategy.underlyingPrice)
      if (currentX >= padding.left && currentX <= w - padding.right) {
        ctx.beginPath()
        ctx.strokeStyle = ACCENT_COLOR
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.moveTo(currentX, padding.top)
        ctx.lineTo(currentX, h - padding.bottom)
        ctx.stroke()
        ctx.setLineDash([])

        ctx.fillStyle = ACCENT_COLOR
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(`$${strategy.underlyingPrice.toFixed(2)}`, currentX, h - padding.bottom + 26)
      }

      // ── Hover crosshair ──────────────────────────────────────────────────

      if (hoverX !== null && hoverX >= padding.left && hoverX <= w - padding.right) {
        const hoverPrice = pixelToPrice(hoverX)

        // Find closest expiry point
        let closestIdx = 0
        let minDist = Infinity
        for (let i = 0; i < expiryPoints.length; i++) {
          const dist = Math.abs(expiryPoints[i]!.price - hoverPrice)
          if (dist < minDist) {
            minDist = dist
            closestIdx = i
          }
        }
        const expiryPnl = expiryPoints[closestIdx]!.pnl

        // Find closest current-date point
        let currentPnl = 0
        if (currentDatePoints.length > 0) {
          let cIdx = 0
          let cDist = Infinity
          for (let i = 0; i < currentDatePoints.length; i++) {
            const dist = Math.abs(currentDatePoints[i]!.price - hoverPrice)
            if (dist < cDist) {
              cDist = dist
              cIdx = i
            }
          }
          currentPnl = currentDatePoints[cIdx]!.pnl
        }

        // Vertical crosshair
        ctx.beginPath()
        ctx.strokeStyle = '#475569'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.moveTo(hoverX, padding.top)
        ctx.lineTo(hoverX, h - padding.bottom)
        ctx.stroke()
        ctx.setLineDash([])

        // Horizontal crosshair at expiry pnl
        const expiryY = yToPixel(expiryPnl)
        ctx.beginPath()
        ctx.strokeStyle = '#475569'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.moveTo(padding.left, expiryY)
        ctx.lineTo(w - padding.right, expiryY)
        ctx.stroke()
        ctx.setLineDash([])

        // Dot on expiry line
        ctx.beginPath()
        ctx.fillStyle = expiryPnl >= 0 ? GREEN : RED
        ctx.arc(hoverX, expiryY, 4, 0, Math.PI * 2)
        ctx.fill()

        // Tooltip background
        const tooltipX = hoverX + 12
        const tooltipY = Math.max(padding.top + 10, expiryY - 40)
        const tooltipW = 140
        const tooltipH = 50

        ctx.fillStyle = 'rgba(10, 10, 15, 0.92)'
        ctx.strokeStyle = '#334155'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(tooltipX, tooltipY, tooltipW, tooltipH, 4)
        ctx.fill()
        ctx.stroke()

        // Tooltip text
        ctx.fillStyle = '#e2e8f0'
        ctx.font = '11px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`Price: $${hoverPrice.toFixed(2)}`, tooltipX + 8, tooltipY + 16)

        ctx.fillStyle = expiryPnl >= 0 ? GREEN : RED
        ctx.fillText(`Expiry: ${formatDollar(expiryPnl)}`, tooltipX + 8, tooltipY + 30)

        if (currentDatePoints.length > 0) {
          ctx.fillStyle = DASHED_COLOR
          ctx.fillText(`Today: ${formatDollar(currentPnl)}`, tooltipX + 8, tooltipY + 44)
        }
      }

      // ── Legend ────────────────────────────────────────────────────────────

      const legendX = padding.left + 8
      const legendY = padding.top + 14

      // At-expiry legend
      ctx.beginPath()
      ctx.strokeStyle = GREEN
      ctx.lineWidth = 2.5
      ctx.moveTo(legendX, legendY)
      ctx.lineTo(legendX + 20, legendY)
      ctx.stroke()
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '10px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText('At Expiry', legendX + 26, legendY + 3)

      // Current-date legend
      ctx.beginPath()
      ctx.strokeStyle = DASHED_COLOR
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.moveTo(legendX, legendY + 16)
      ctx.lineTo(legendX + 20, legendY + 16)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#e2e8f0'
      ctx.fillText(sliderDate === todayString() ? 'Today' : sliderDate, legendX + 26, legendY + 19)
    },
    [
      expiryPoints,
      currentDatePoints,
      priceRange,
      breakevens,
      strategy.underlyingPrice,
      hasLegs,
      sliderDate,
      padding,
    ],
  )

  // ── Mouse handlers ───────────────────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      setMousePos({ x, y: e.clientY - rect.top })
    },
    [],
  )

  const handleMouseLeave = useCallback(() => {
    setMousePos(null)
  }, [])

  // ── Redraw on data or hover change ───────────────────────────────────────

  useEffect(() => {
    draw(mousePos?.x ?? null)
  }, [draw, mousePos])

  // Redraw on resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      draw(mousePos?.x ?? null)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw, mousePos])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn('flex flex-col bg-navy-dark', className)} ref={containerRef}>
      {/* Stats bar */}
      {hasLegs && (
        <div className="flex items-center gap-4 border-b border-border px-4 py-2">
          <StatBadge
            label="Max Profit"
            value={maxProfit === 'unlimited' ? 'Unlimited' : formatDollar(maxProfit as number)}
            color="text-trading-green"
          />
          <StatBadge
            label="Max Loss"
            value={maxLoss === 'unlimited' ? 'Unlimited' : formatDollar(maxLoss as number)}
            color="text-trading-red"
          />
          {breakevens.length > 0 && (
            <StatBadge
              label={breakevens.length === 1 ? 'Breakeven' : 'Breakevens'}
              value={breakevens.map((b) => `$${b.toFixed(2)}`).join(', ')}
              color="text-yellow-400"
            />
          )}
          <StatBadge
            label="P(Profit)"
            value={`${probProfit.toFixed(1)}%`}
            color={probProfit >= 50 ? 'text-trading-green' : 'text-trading-red'}
          />
        </div>
      )}

      {/* Canvas */}
      <div className="relative flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Date slider */}
      {hasLegs && totalDays > 0 && (
        <div className="flex items-center gap-3 border-t border-border px-4 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Date
          </span>
          <span className="w-20 font-mono text-xs text-text-secondary">{sliderDate}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={dateSlider}
            onChange={(e) => setDateSlider(parseInt(e.target.value, 10))}
            className="flex-1 accent-accent"
          />
          <span className="w-20 text-right font-mono text-xs text-text-muted">
            {totalDays - Math.round((dateSlider / 100) * totalDays)} DTE
          </span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatBadge({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className={cn('font-mono text-xs font-semibold tabular-nums', color)}>{value}</span>
    </div>
  )
}
