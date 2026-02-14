'use client'

import { useRef, useEffect, useState } from 'react'
import { cn } from '../lib/utils.js'

// ── Types ────────────────────────────────────────────────────────────────────

export type EmbedTheme = 'dark' | 'light'
export type EmbedTimeframe = '1m' | '5m' | '15m' | '1H' | '4H' | '1D' | '1W' | '1M'

export interface ChartEmbedProps {
  /** Ticker symbol to display. */
  symbol: string
  /** Chart timeframe. */
  timeframe?: EmbedTimeframe
  /** Comma-separated indicator keys (e.g. "sma20,ema50,rsi"). */
  indicators?: string[]
  /** Color theme. */
  theme?: EmbedTheme
  /** Whether to show the "Powered by MarlinTraders" watermark. */
  showWatermark?: boolean
  /** Additional CSS class for the outer container. */
  className?: string
}

// ── Theme config ─────────────────────────────────────────────────────────────

const THEME_CONFIG: Record<EmbedTheme, { bg: string; text: string; border: string; grid: string; watermarkBg: string; watermarkText: string }> = {
  dark: {
    bg: '#0a0a0f',
    text: '#f8fafc',
    border: '#1e293b',
    grid: '#1a1a2e',
    watermarkBg: 'bg-navy-dark/80',
    watermarkText: 'text-text-muted',
  },
  light: {
    bg: '#ffffff',
    text: '#0f172a',
    border: '#e2e8f0',
    grid: '#f1f5f9',
    watermarkBg: 'bg-white/80',
    watermarkText: 'text-slate-400',
  },
}

// ── Mock chart renderer ──────────────────────────────────────────────────────
// In production, this integrates with the MarlinChart component from @marlin/charts.
// For the embeddable widget, we render a self-contained canvas chart with mock data.

function drawMockChart(
  canvas: HTMLCanvasElement,
  symbol: string,
  theme: EmbedTheme,
  indicators: string[],
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const config = THEME_CONFIG[theme]
  const w = canvas.width
  const h = canvas.height

  // Background
  ctx.fillStyle = config.bg
  ctx.fillRect(0, 0, w, h)

  // Grid lines
  ctx.strokeStyle = config.grid
  ctx.lineWidth = 1
  for (let y = 0; y < h; y += h / 6) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  for (let x = 0; x < w; x += w / 8) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }

  // Generate mock candlestick data
  const barCount = 60
  const barWidth = (w - 80) / barCount
  const priceMin = 150
  const priceRange = 50
  let price = priceMin + priceRange * 0.5

  const candles: { o: number; h: number; l: number; c: number }[] = []
  for (let i = 0; i < barCount; i++) {
    const change = (Math.random() - 0.48) * 4
    const open = price
    price += change
    const close = price
    const high = Math.max(open, close) + Math.random() * 2
    const low = Math.min(open, close) - Math.random() * 2
    candles.push({ o: open, h: high, l: low, c: close })
  }

  // Find price bounds
  const allPrices = candles.flatMap((c) => [c.h, c.l])
  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  const pRange = maxPrice - minPrice || 1

  const chartLeft = 10
  const chartRight = w - 60
  const chartTop = 30
  const chartBottom = h - 30

  const toY = (p: number) => chartBottom - ((p - minPrice) / pRange) * (chartBottom - chartTop)
  const toX = (i: number) => chartLeft + i * barWidth + barWidth / 2

  // Draw candlesticks
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!
    const x = toX(i)
    const bullish = c.c >= c.o

    // Wick
    ctx.strokeStyle = bullish ? '#22c55e' : '#ef4444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, toY(c.h))
    ctx.lineTo(x, toY(c.l))
    ctx.stroke()

    // Body
    ctx.fillStyle = bullish ? '#22c55e' : '#ef4444'
    const bodyTop = toY(Math.max(c.o, c.c))
    const bodyBot = toY(Math.min(c.o, c.c))
    const bodyHeight = Math.max(bodyBot - bodyTop, 1)
    ctx.fillRect(x - barWidth * 0.35, bodyTop, barWidth * 0.7, bodyHeight)
  }

  // Draw indicators if requested
  if (indicators.length > 0) {
    const indicatorColors = ['#3b82f6', '#f59e0b', '#a855f7', '#06b6d4']

    indicators.forEach((indicator, idx) => {
      const color = indicatorColors[idx % indicatorColors.length]!
      const match = indicator.match(/(\d+)/)
      const period = match ? parseInt(match[1]!, 10) : 20

      // Calculate simple moving average of close prices
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let started = false

      for (let i = period - 1; i < candles.length; i++) {
        let sum = 0
        for (let j = i - period + 1; j <= i; j++) {
          sum += candles[j]!.c
        }
        const avg = sum / period
        const x = toX(i)
        const y = toY(avg)

        if (!started) {
          ctx.moveTo(x, y)
          started = true
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    })
  }

  // Symbol label
  ctx.fillStyle = config.text
  ctx.font = 'bold 14px Inter, system-ui, sans-serif'
  ctx.fillText(symbol.toUpperCase(), chartLeft + 4, chartTop - 10)

  // Price labels on right axis
  ctx.fillStyle = theme === 'dark' ? '#64748b' : '#94a3b8'
  ctx.font = '10px Inter, system-ui, sans-serif'
  ctx.textAlign = 'right'
  const labelCount = 5
  for (let i = 0; i <= labelCount; i++) {
    const p = minPrice + (pRange * i) / labelCount
    const y = toY(p)
    ctx.fillText(p.toFixed(2), w - 8, y + 3)
  }
  ctx.textAlign = 'left'
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChartEmbed({
  symbol,
  timeframe = '1D',
  indicators = [],
  theme = 'dark',
  showWatermark = true,
  className,
}: ChartEmbedProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Track container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        setDimensions({ width: Math.floor(width), height: Math.floor(height) })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Draw chart when dimensions or props change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    canvas.style.width = `${dimensions.width}px`
    canvas.style.height = `${dimensions.height}px`

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
    }

    drawMockChart(canvas, symbol, theme, indicators)
  }, [dimensions, symbol, theme, indicators])

  const themeConfig = THEME_CONFIG[theme]

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden', className)}
      style={{ backgroundColor: themeConfig.bg }}
    >
      {/* Timeframe badge */}
      <div
        className="absolute left-3 top-3 z-10 rounded px-2 py-0.5 text-[10px] font-medium"
        style={{
          backgroundColor: theme === 'dark' ? '#1a1a2e' : '#f1f5f9',
          color: theme === 'dark' ? '#94a3b8' : '#64748b',
        }}
      >
        {timeframe}
      </div>

      {/* Indicator labels */}
      {indicators.length > 0 && (
        <div className="absolute right-16 top-3 z-10 flex gap-1.5">
          {indicators.map((ind, i) => {
            const colors = ['#3b82f6', '#f59e0b', '#a855f7', '#06b6d4']
            return (
              <span
                key={ind}
                className="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase"
                style={{
                  backgroundColor: `${colors[i % colors.length]}20`,
                  color: colors[i % colors.length],
                }}
              >
                {ind}
              </span>
            )
          })}
        </div>
      )}

      {/* Canvas chart */}
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
      />

      {/* Watermark */}
      {showWatermark && (
        <a
          href="https://marlintraders.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium no-underline backdrop-blur-sm transition-opacity hover:opacity-100',
            themeConfig.watermarkBg,
            themeConfig.watermarkText,
            'opacity-70',
          )}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          Powered by MarlinTraders
        </a>
      )}
    </div>
  )
}
