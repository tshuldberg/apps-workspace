'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { cn } from '../lib/utils.js'

export interface HeatmapStock {
  symbol: string
  name: string
  sector: string
  marketCap: number
  price: number
  change: number
  changePercent: number
  volume: number
  peRatio: number | null
  rsi: number | null
  ivRank: number | null
}

export interface SectorGroup {
  sector: string
  totalMarketCap: number
  avgChangePercent: number
  stocks: HeatmapStock[]
}

export interface HeatmapData {
  sectors: SectorGroup[]
  updatedAt: string
}

export type TimePeriod = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y'
export type ColorMetric = 'performance' | 'peRatio' | 'rsi' | 'ivRank' | 'volume'
export type SizeMetric = 'marketCap' | 'volume' | 'equal'

export interface HeatMapProps {
  data: HeatmapData | null
  timePeriod?: TimePeriod
  colorMetric?: ColorMetric
  sizeMetric?: SizeMetric
  sectorFilter?: string[]
  onStockClick?: (symbol: string) => void
  onSectorClick?: (sector: string) => void
  className?: string
}

interface TreemapRect {
  x: number
  y: number
  width: number
  height: number
  stock: HeatmapStock
  sector: string
}

interface SectorRect {
  x: number
  y: number
  width: number
  height: number
  sector: string
  children: TreemapRect[]
}

interface TooltipState {
  stock: HeatmapStock
  x: number
  y: number
}

function getColorForValue(value: number, metric: ColorMetric): string {
  if (metric === 'performance') {
    // Red for negative, green for positive, with intensity
    const clamped = Math.max(-5, Math.min(5, value))
    const intensity = Math.abs(clamped) / 5

    if (value >= 0) {
      const r = Math.round(10 + (34 - 10) * (1 - intensity))
      const g = Math.round(60 + (197 - 60) * intensity)
      const b = Math.round(15 + (94 - 15) * (1 - intensity * 0.5))
      return `rgb(${r}, ${g}, ${b})`
    } else {
      const r = Math.round(60 + (239 - 60) * intensity)
      const g = Math.round(30 + (68 - 30) * (1 - intensity))
      const b = Math.round(30 + (68 - 30) * (1 - intensity))
      return `rgb(${r}, ${g}, ${b})`
    }
  }

  if (metric === 'rsi') {
    // Blue(oversold) -> neutral -> Red(overbought)
    const clamped = Math.max(0, Math.min(100, value))
    if (clamped < 30) return '#3b82f6'
    if (clamped < 50) return '#64748b'
    if (clamped < 70) return '#f59e0b'
    return '#ef4444'
  }

  if (metric === 'peRatio') {
    if (value === 0) return '#1a1a2e'
    if (value < 15) return '#22c55e'
    if (value < 25) return '#3b82f6'
    if (value < 40) return '#f59e0b'
    return '#ef4444'
  }

  if (metric === 'ivRank') {
    const clamped = Math.max(0, Math.min(100, value))
    if (clamped < 25) return '#22c55e'
    if (clamped < 50) return '#3b82f6'
    if (clamped < 75) return '#f59e0b'
    return '#ef4444'
  }

  // Volume — grayscale intensity
  return '#3b82f6'
}

function getMetricValue(stock: HeatmapStock, metric: ColorMetric): number {
  switch (metric) {
    case 'performance': return stock.changePercent
    case 'peRatio': return stock.peRatio ?? 0
    case 'rsi': return stock.rsi ?? 50
    case 'ivRank': return stock.ivRank ?? 50
    case 'volume': return stock.volume
  }
}

function getSizeValue(stock: HeatmapStock, metric: SizeMetric): number {
  switch (metric) {
    case 'marketCap': return stock.marketCap
    case 'volume': return stock.volume
    case 'equal': return 1
  }
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(0)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`
  return `$${cap}`
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`
  return vol.toString()
}

// Squarified treemap layout algorithm
function squarify(
  items: { value: number; data: HeatmapStock }[],
  x: number,
  y: number,
  width: number,
  height: number,
): TreemapRect[] {
  if (items.length === 0 || width <= 0 || height <= 0) return []

  const totalValue = items.reduce((sum, it) => sum + it.value, 0)
  if (totalValue === 0) return []

  const rects: TreemapRect[] = []
  let remaining = [...items]
  let cx = x
  let cy = y
  let cw = width
  let ch = height

  while (remaining.length > 0) {
    const isWide = cw >= ch
    const side = isWide ? ch : cw
    const totalRemaining = remaining.reduce((s, it) => s + it.value, 0)

    // Find the best row
    let row: typeof remaining = []
    let bestAspect = Infinity

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining.slice(0, i + 1)
      const rowSum = candidate.reduce((s, it) => s + it.value, 0)
      const rowWidth = (rowSum / totalRemaining) * (isWide ? cw : ch)

      let worstAspect = 0
      for (const item of candidate) {
        const itemHeight = (item.value / rowSum) * side
        const aspect = Math.max(rowWidth / itemHeight, itemHeight / rowWidth)
        worstAspect = Math.max(worstAspect, aspect)
      }

      if (worstAspect <= bestAspect) {
        bestAspect = worstAspect
        row = candidate
      } else {
        break
      }
    }

    if (row.length === 0) break

    const rowSum = row.reduce((s, it) => s + it.value, 0)
    const rowWidth = (rowSum / totalRemaining) * (isWide ? cw : ch)

    let offset = 0
    for (const item of row) {
      const itemHeight = (item.value / rowSum) * side

      if (isWide) {
        rects.push({
          x: cx,
          y: cy + offset,
          width: rowWidth,
          height: itemHeight,
          stock: item.data,
          sector: item.data.sector,
        })
      } else {
        rects.push({
          x: cx + offset,
          y: cy,
          width: itemHeight,
          height: rowWidth,
          stock: item.data,
          sector: item.data.sector,
        })
      }
      offset += itemHeight
    }

    remaining = remaining.slice(row.length)

    if (isWide) {
      cx += rowWidth
      cw -= rowWidth
    } else {
      cy += rowWidth
      ch -= rowWidth
    }
  }

  return rects
}

export function HeatMap({
  data,
  colorMetric = 'performance',
  sizeMetric = 'marketCap',
  sectorFilter,
  onStockClick,
  onSectorClick,
  className,
}: HeatMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [hoveredStock, setHoveredStock] = useState<string | null>(null)

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

  const sectorRects = useMemo(() => {
    if (!data) return []

    const filteredSectors = sectorFilter && sectorFilter.length > 0
      ? data.sectors.filter((s) => sectorFilter.includes(s.sector))
      : data.sectors

    const { width, height } = dimensions
    const padding = 2

    // First level: sector treemap
    const sectorItems = filteredSectors.map((s) => ({
      value: s.stocks.reduce((sum, st) => sum + getSizeValue(st, sizeMetric), 0),
      data: s,
    }))

    const totalValue = sectorItems.reduce((sum, it) => sum + it.value, 0)
    if (totalValue === 0) return []

    const result: SectorRect[] = []

    // Use squarify for sector-level layout
    const sectorLayout = squarify(
      sectorItems.map((s) => ({
        value: s.value,
        data: { symbol: s.data.sector, name: s.data.sector, sector: s.data.sector } as HeatmapStock,
      })),
      0, 0, width, height,
    )

    for (let i = 0; i < sectorLayout.length; i++) {
      const sl = sectorLayout[i]
      const sector = filteredSectors[i]
      if (!sector) continue

      const innerX = sl.x + padding
      const innerY = sl.y + padding + 16 // 16px for sector label
      const innerW = sl.width - padding * 2
      const innerH = sl.height - padding * 2 - 16

      const stockItems = sector.stocks.map((st) => ({
        value: getSizeValue(st, sizeMetric),
        data: st,
      }))

      const children = squarify(stockItems, innerX, innerY, Math.max(0, innerW), Math.max(0, innerH))

      result.push({
        x: sl.x,
        y: sl.y,
        width: sl.width,
        height: sl.height,
        sector: sector.sector,
        children,
      })
    }

    return result
  }, [data, dimensions, sizeMetric, sectorFilter])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      for (const sr of sectorRects) {
        for (const child of sr.children) {
          if (
            mx >= child.x &&
            mx <= child.x + child.width &&
            my >= child.y &&
            my <= child.y + child.height
          ) {
            setTooltip({ stock: child.stock, x: e.clientX - rect.left, y: e.clientY - rect.top })
            setHoveredStock(child.stock.symbol)
            return
          }
        }
      }
      setTooltip(null)
      setHoveredStock(null)
    },
    [sectorRects],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      for (const sr of sectorRects) {
        for (const child of sr.children) {
          if (
            mx >= child.x &&
            mx <= child.x + child.width &&
            my >= child.y &&
            my <= child.y + child.height
          ) {
            onStockClick?.(child.stock.symbol)
            return
          }
        }
        // Check sector label area
        if (mx >= sr.x && mx <= sr.x + sr.width && my >= sr.y && my <= sr.y + 16) {
          onSectorClick?.(sr.sector)
          return
        }
      }
    },
    [sectorRects, onStockClick, onSectorClick],
  )

  if (!data) {
    return (
      <div className={cn('flex items-center justify-center bg-navy-dark text-text-muted', className)}>
        Loading heat map data...
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden bg-navy-black', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setTooltip(null); setHoveredStock(null) }}
      onClick={handleClick}
    >
      {/* SVG Treemap */}
      <svg width={dimensions.width} height={dimensions.height} className="block">
        {sectorRects.map((sr) => (
          <g key={sr.sector}>
            {/* Sector boundary */}
            <rect
              x={sr.x}
              y={sr.y}
              width={sr.width}
              height={sr.height}
              fill="none"
              stroke="#1e293b"
              strokeWidth={2}
            />
            {/* Sector label */}
            <text
              x={sr.x + 4}
              y={sr.y + 12}
              fill="#64748b"
              fontSize={10}
              fontFamily="monospace"
              className="pointer-events-none select-none"
            >
              {sr.sector}
            </text>

            {/* Stock rectangles */}
            {sr.children.map((child) => {
              const metricVal = getMetricValue(child.stock, colorMetric)
              const bgColor = getColorForValue(metricVal, colorMetric)
              const isHovered = hoveredStock === child.stock.symbol
              const showLabel = child.width > 40 && child.height > 24

              return (
                <g key={child.stock.symbol} className="cursor-pointer">
                  <rect
                    x={child.x + 1}
                    y={child.y + 1}
                    width={Math.max(0, child.width - 2)}
                    height={Math.max(0, child.height - 2)}
                    fill={bgColor}
                    opacity={isHovered ? 1 : 0.85}
                    stroke={isHovered ? '#f8fafc' : '#0a0a0f'}
                    strokeWidth={isHovered ? 2 : 1}
                    rx={2}
                  />
                  {showLabel && (
                    <>
                      <text
                        x={child.x + child.width / 2}
                        y={child.y + child.height / 2 - (child.height > 40 ? 4 : 0)}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#f8fafc"
                        fontSize={child.width > 80 ? 12 : 10}
                        fontWeight="bold"
                        fontFamily="monospace"
                        className="pointer-events-none select-none"
                      >
                        {child.stock.symbol}
                      </text>
                      {child.height > 40 && child.width > 50 && (
                        <text
                          x={child.x + child.width / 2}
                          y={child.y + child.height / 2 + 12}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#f8fafc"
                          fontSize={9}
                          fontFamily="monospace"
                          opacity={0.8}
                          className="pointer-events-none select-none"
                        >
                          {child.stock.changePercent >= 0 ? '+' : ''}
                          {child.stock.changePercent.toFixed(2)}%
                        </text>
                      )}
                    </>
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-border bg-navy-dark px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(tooltip.x + 12, dimensions.width - 200),
            top: Math.min(tooltip.y + 12, dimensions.height - 120),
          }}
        >
          <div className="mb-1 font-bold text-text-primary">
            {tooltip.stock.symbol} <span className="font-normal text-text-muted">{tooltip.stock.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-text-secondary">
            <span>Price:</span>
            <span className="text-right">${tooltip.stock.price.toFixed(2)}</span>
            <span>Change:</span>
            <span className={cn('text-right font-mono', tooltip.stock.changePercent >= 0 ? 'text-trading-green' : 'text-trading-red')}>
              {tooltip.stock.changePercent >= 0 ? '+' : ''}{tooltip.stock.changePercent.toFixed(2)}%
            </span>
            <span>Mkt Cap:</span>
            <span className="text-right">{formatMarketCap(tooltip.stock.marketCap)}</span>
            <span>Volume:</span>
            <span className="text-right">{formatVolume(tooltip.stock.volume)}</span>
            {tooltip.stock.peRatio && (
              <>
                <span>P/E:</span>
                <span className="text-right">{tooltip.stock.peRatio.toFixed(1)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
