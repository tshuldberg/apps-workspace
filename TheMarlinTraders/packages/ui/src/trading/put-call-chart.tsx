'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'

export interface PutCallDataPoint {
  date: string // YYYY-MM-DD
  ratio: number
}

export type PutCallMode = 'equity' | 'index'

export interface PutCallChartProps {
  equityData: PutCallDataPoint[]
  indexData?: PutCallDataPoint[]
  mode?: PutCallMode
  onModeChange?: (mode: PutCallMode) => void
  currentRatio?: number
  className?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTREME_BULLISH = 0.7
const EXTREME_BEARISH = 1.3
const GREEN = '#22c55e'
const RED = '#ef4444'
const ACCENT = '#3b82f6'
const GRID_COLOR = '#1e293b'
const LABEL_COLOR = '#64748b'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PutCallChart({
  equityData,
  indexData = [],
  mode = 'equity',
  onModeChange,
  currentRatio,
  className,
}: PutCallChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const [dimensions, setDimensions] = useState({ width: 400, height: 200 })

  const data = mode === 'equity' ? equityData : indexData
  const displayRatio = currentRatio ?? (data.length > 0 ? data[data.length - 1]!.ratio : 0)

  const ratioColor = displayRatio <= EXTREME_BULLISH
    ? GREEN
    : displayRatio >= EXTREME_BEARISH
      ? RED
      : ACCENT

  // Observe container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const padding = { top: 16, right: 48, bottom: 28, left: 48 }

  const draw = useCallback(
    (hoverX: number | null) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const { width: w, height: h } = dimensions
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      ctx.clearRect(0, 0, w, h)

      if (data.length === 0) {
        ctx.fillStyle = LABEL_COLOR
        ctx.font = '12px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('No P/C ratio data available', w / 2, h / 2)
        return
      }

      const plotW = w - padding.left - padding.right
      const plotH = h - padding.top - padding.bottom

      // Y range
      const ratios = data.map((d) => d.ratio)
      const yMin = Math.min(0.4, ...ratios) - 0.05
      const yMax = Math.max(1.6, ...ratios) + 0.05
      const ySpan = yMax - yMin

      const xToPixel = (i: number) => padding.left + (i / (data.length - 1)) * plotW
      const yToPixel = (r: number) => padding.top + plotH - ((r - yMin) / ySpan) * plotH

      // Grid
      ctx.strokeStyle = GRID_COLOR
      ctx.lineWidth = 1
      const ySteps = [0.5, 0.7, 1.0, 1.3, 1.5]
      for (const yVal of ySteps) {
        if (yVal < yMin || yVal > yMax) continue
        const y = yToPixel(yVal)
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(w - padding.right, y)
        ctx.stroke()

        ctx.fillStyle = LABEL_COLOR
        ctx.font = '9px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(yVal.toFixed(1), padding.left - 6, y + 3)
      }

      // Reference lines
      // Extreme bullish (0.7)
      const bullishY = yToPixel(EXTREME_BULLISH)
      ctx.beginPath()
      ctx.strokeStyle = GREEN
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.moveTo(padding.left, bullishY)
      ctx.lineTo(w - padding.right, bullishY)
      ctx.stroke()

      ctx.fillStyle = GREEN
      ctx.font = '8px monospace'
      ctx.textAlign = 'left'
      ctx.fillText('Bullish 0.7', w - padding.right + 4, bullishY + 3)

      // Extreme bearish (1.3)
      const bearishY = yToPixel(EXTREME_BEARISH)
      ctx.beginPath()
      ctx.strokeStyle = RED
      ctx.moveTo(padding.left, bearishY)
      ctx.lineTo(w - padding.right, bearishY)
      ctx.stroke()
      ctx.setLineDash([])

      ctx.fillStyle = RED
      ctx.fillText('Bearish 1.3', w - padding.right + 4, bearishY + 3)

      // Data line
      ctx.beginPath()
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 2
      ctx.setLineDash([])
      for (let i = 0; i < data.length; i++) {
        const x = xToPixel(i)
        const y = yToPixel(data[i]!.ratio)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Fill below line
      ctx.beginPath()
      for (let i = 0; i < data.length; i++) {
        const x = xToPixel(i)
        const y = yToPixel(data[i]!.ratio)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineTo(xToPixel(data.length - 1), yToPixel(yMin))
      ctx.lineTo(xToPixel(0), yToPixel(yMin))
      ctx.closePath()
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
      ctx.fill()

      // X-axis labels (sample 5 dates)
      const labelCount = Math.min(5, data.length)
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      for (let i = 0; i < labelCount; i++) {
        const idx = Math.floor((i / (labelCount - 1)) * (data.length - 1))
        const x = xToPixel(idx)
        const dateStr = data[idx]!.date.slice(5) // MM-DD
        ctx.fillText(dateStr, x, h - padding.bottom + 14)
      }

      // Hover crosshair
      if (hoverX !== null && hoverX >= padding.left && hoverX <= w - padding.right) {
        const dataIdx = Math.round(((hoverX - padding.left) / plotW) * (data.length - 1))
        const clamped = Math.max(0, Math.min(data.length - 1, dataIdx))
        const point = data[clamped]!
        const px = xToPixel(clamped)
        const py = yToPixel(point.ratio)

        // Vertical line
        ctx.beginPath()
        ctx.strokeStyle = '#475569'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.moveTo(px, padding.top)
        ctx.lineTo(px, h - padding.bottom)
        ctx.stroke()
        ctx.setLineDash([])

        // Dot
        ctx.beginPath()
        ctx.fillStyle = ACCENT
        ctx.arc(px, py, 4, 0, Math.PI * 2)
        ctx.fill()

        // Tooltip
        const tooltipX = px + 10
        const tooltipY = Math.max(padding.top, py - 30)
        ctx.fillStyle = 'rgba(10, 10, 15, 0.92)'
        ctx.strokeStyle = '#334155'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(tooltipX, tooltipY, 100, 32, 4)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#e2e8f0'
        ctx.font = '10px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(point.date, tooltipX + 6, tooltipY + 12)
        ctx.fillStyle = point.ratio <= EXTREME_BULLISH ? GREEN : point.ratio >= EXTREME_BEARISH ? RED : ACCENT
        ctx.fillText(`P/C: ${point.ratio.toFixed(3)}`, tooltipX + 6, tooltipY + 24)
      }
    },
    [data, dimensions, padding],
  )

  useEffect(() => {
    draw(mousePos?.x ?? null)
  }, [draw, mousePos])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  return (
    <div className={cn('flex flex-col bg-navy-dark', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Put/Call Ratio
          </span>
          {onModeChange && (
            <div className="flex gap-1">
              {(['equity', 'index'] as PutCallMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModeChange(m)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[10px] transition-colors',
                    mode === m
                      ? 'bg-accent text-text-primary'
                      : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
                  )}
                >
                  {m === 'equity' ? 'Equity' : 'Index'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current ratio display */}
        <div className="flex items-center gap-1">
          <span className={cn('font-mono text-sm font-bold tabular-nums')} style={{ color: ratioColor }}>
            {displayRatio.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative flex-1">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setMousePos(null)}
        />
      </div>
    </div>
  )
}
