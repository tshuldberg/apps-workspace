'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'
import type {
  IVAnalytics,
  IVSurface,
  SkewData,
  TermStructure,
  VolatilityCone,
  ExpectedMove,
} from '@marlin/shared'

export interface IVDashboardProps {
  ivData: IVAnalytics | null
  ivSurface?: IVSurface | null
  skewData?: SkewData | null
  termStructure?: TermStructure | null
  volatilityCone?: VolatilityCone[] | null
  expectedMove?: ExpectedMove | null
  hvHistory?: { date: string; hv20: number; hv50: number; iv: number }[]
  className?: string
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const GREEN = '#22c55e'
const RED = '#ef4444'
const ACCENT = '#3b82f6'
const AMBER = '#f59e0b'
const GRID_COLOR = '#1e293b'
const LABEL_COLOR = '#64748b'
const TEXT_PRIMARY = '#f1f5f9'

function ivToColor(ivValue: number, minIV: number, maxIV: number): string {
  if (maxIV <= minIV) return ACCENT
  const t = (ivValue - minIV) / (maxIV - minIV)
  // Low IV = blue, mid = amber, high = red
  if (t < 0.33) {
    const r = Math.round(59 + (245 - 59) * (t / 0.33))
    const g = Math.round(130 + (158 - 130) * (t / 0.33))
    const b = Math.round(246 + (11 - 246) * (t / 0.33))
    return `rgb(${r}, ${g}, ${b})`
  }
  if (t < 0.66) {
    const localT = (t - 0.33) / 0.33
    const r = Math.round(245 + (239 - 245) * localT)
    const g = Math.round(158 + (68 - 158) * localT)
    const b = Math.round(11 + (68 - 11) * localT)
    return `rgb(${r}, ${g}, ${b})`
  }
  return RED
}

function gaugeColor(value: number): string {
  if (value < 25) return GREEN
  if (value < 50) return ACCENT
  if (value < 75) return AMBER
  return RED
}

// ---------------------------------------------------------------------------
// 1. IV Rank/Percentile Gauge
// ---------------------------------------------------------------------------

function IVGauge({ label, value }: { label: string; value: number }) {
  const color = gaugeColor(value)
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (value / 100) * circumference * 0.75 // 270-degree arc

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="80" viewBox="0 0 100 80" className="overflow-visible">
        {/* Background arc */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={GRID_COLOR}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          transform="rotate(135 50 50)"
        />
        {/* Value arc */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circumference * 0.75} ${circumference}`}
          transform="rotate(135 50 50)"
          className="transition-all duration-500"
        />
        {/* Value text */}
        <text x="50" y="48" textAnchor="middle" fill={color} fontSize="18" fontWeight="bold" fontFamily="monospace">
          {value.toFixed(0)}
        </text>
        <text x="50" y="62" textAnchor="middle" fill={LABEL_COLOR} fontSize="9" fontFamily="system-ui">
          {label}
        </text>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. HV vs IV Chart
// ---------------------------------------------------------------------------

function HVvsIVChart({
  data,
}: {
  data: { date: string; hv20: number; hv50: number; iv: number }[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 300, height: 160 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setDims({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.width * dpr
    canvas.height = dims.height * dpr
    ctx.scale(dpr, dpr)

    const { width: w, height: h } = dims
    const pad = { top: 8, right: 40, bottom: 20, left: 40 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)

    const allVals = data.flatMap((d) => [d.hv20, d.hv50, d.iv].filter((v) => v > 0))
    if (allVals.length === 0) return
    const yMin = Math.max(0, Math.min(...allVals) - 0.02)
    const yMax = Math.max(...allVals) + 0.02
    const ySpan = yMax - yMin || 1

    const xToPixel = (i: number) => pad.left + (i / (data.length - 1)) * plotW
    const yToPixel = (v: number) => pad.top + plotH - ((v - yMin) / ySpan) * plotH

    // Grid
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (i / 3) * plotH
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()

      const val = yMax - (i / 3) * ySpan
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '8px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${(val * 100).toFixed(0)}%`, pad.left - 4, y + 3)
    }

    // Lines
    const drawLine = (key: 'hv20' | 'hv50' | 'iv', color: string, dash: number[]) => {
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.setLineDash(dash)
      let started = false
      for (let i = 0; i < data.length; i++) {
        const val = data[i]![key]
        if (val <= 0) continue
        const x = xToPixel(i)
        const y = yToPixel(val)
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    drawLine('iv', ACCENT, [])
    drawLine('hv20', GREEN, [4, 2])
    drawLine('hv50', AMBER, [6, 3])

    // Legend
    const legendX = pad.left + 4
    const legendY = pad.top + 8
    const items = [
      { label: 'IV', color: ACCENT, dash: [] },
      { label: 'HV20', color: GREEN, dash: [4, 2] },
      { label: 'HV50', color: AMBER, dash: [6, 3] },
    ]
    items.forEach((item, i) => {
      const x = legendX + i * 50
      ctx.beginPath()
      ctx.strokeStyle = item.color
      ctx.lineWidth = 1.5
      ctx.setLineDash(item.dash)
      ctx.moveTo(x, legendY)
      ctx.lineTo(x + 14, legendY)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = TEXT_PRIMARY
      ctx.font = '8px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText(item.label, x + 17, legendY + 3)
    })
  }, [data, dims])

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No historical data available
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. IV Surface Heatmap
// ---------------------------------------------------------------------------

function IVSurfaceChart({ surface }: { surface: IVSurface }) {
  const allIVs = surface.ivMatrix.flat().filter((v) => v > 0)
  const minIV = allIVs.length > 0 ? Math.min(...allIVs) : 0
  const maxIV = allIVs.length > 0 ? Math.max(...allIVs) : 1

  if (surface.expirations.length === 0 || surface.strikes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No surface data available
      </div>
    )
  }

  // Show max 12 strikes and all expirations
  const stepSize = Math.max(1, Math.floor(surface.strikes.length / 12))
  const displayStrikes = surface.strikes.filter((_, i) => i % stepSize === 0)
  const displayIndices = surface.strikes.map((_, i) => i).filter((i) => i % stepSize === 0)

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-navy-dark px-1 py-0.5 text-left text-text-muted">Exp\Strike</th>
            {displayStrikes.map((s) => (
              <th key={s} className="px-1 py-0.5 text-center font-mono text-text-muted tabular-nums">
                {s.toFixed(0)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {surface.expirations.map((exp, expIdx) => (
            <tr key={exp}>
              <td className="sticky left-0 bg-navy-dark px-1 py-0.5 font-mono text-text-muted">
                {exp.slice(5)}
              </td>
              {displayIndices.map((strikeIdx) => {
                const iv = surface.ivMatrix[expIdx]?.[strikeIdx] ?? 0
                const bgColor = iv > 0 ? ivToColor(iv, minIV, maxIV) : 'transparent'
                return (
                  <td
                    key={strikeIdx}
                    className="px-1 py-0.5 text-center font-mono tabular-nums"
                    style={{ backgroundColor: iv > 0 ? bgColor + '30' : undefined, color: iv > 0 ? bgColor : LABEL_COLOR }}
                    title={`IV: ${(iv * 100).toFixed(1)}%`}
                  >
                    {iv > 0 ? (iv * 100).toFixed(0) : '-'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Skew Chart
// ---------------------------------------------------------------------------

function SkewChart({ skew }: { skew: SkewData }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 300, height: 160 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setDims({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || skew.strikes.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.width * dpr
    canvas.height = dims.height * dpr
    ctx.scale(dpr, dpr)

    const { width: w, height: h } = dims
    const pad = { top: 12, right: 40, bottom: 24, left: 44 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)

    const allIVs = [...skew.callIVs, ...skew.putIVs].filter((v) => v > 0)
    if (allIVs.length === 0) return

    const yMin = Math.max(0, Math.min(...allIVs) - 0.02)
    const yMax = Math.max(...allIVs) + 0.02
    const ySpan = yMax - yMin || 1
    const xMin = skew.strikes[0]!
    const xMax = skew.strikes[skew.strikes.length - 1]!
    const xSpan = xMax - xMin || 1

    const xToPixel = (s: number) => pad.left + ((s - xMin) / xSpan) * plotW
    const yToPixel = (iv: number) => pad.top + plotH - ((iv - yMin) / ySpan) * plotH

    // Grid
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (i / 3) * plotH
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
      const val = yMax - (i / 3) * ySpan
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '8px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${(val * 100).toFixed(0)}%`, pad.left - 4, y + 3)
    }

    // Call IV line
    ctx.beginPath()
    ctx.strokeStyle = GREEN
    ctx.lineWidth = 1.5
    for (let i = 0; i < skew.strikes.length; i++) {
      if (skew.callIVs[i]! <= 0) continue
      const x = xToPixel(skew.strikes[i]!)
      const y = yToPixel(skew.callIVs[i]!)
      if (i === 0 || skew.callIVs[i - 1]! <= 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Put IV line
    ctx.beginPath()
    ctx.strokeStyle = RED
    ctx.lineWidth = 1.5
    for (let i = 0; i < skew.strikes.length; i++) {
      if (skew.putIVs[i]! <= 0) continue
      const x = xToPixel(skew.strikes[i]!)
      const y = yToPixel(skew.putIVs[i]!)
      if (i === 0 || skew.putIVs[i - 1]! <= 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // X-axis labels
    const labelCount = Math.min(6, skew.strikes.length)
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((i / (labelCount - 1)) * (skew.strikes.length - 1))
      const x = xToPixel(skew.strikes[idx]!)
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`$${skew.strikes[idx]!.toFixed(0)}`, x, h - pad.bottom + 12)
    }

    // Legend
    ctx.fillStyle = GREEN
    ctx.font = '8px system-ui'
    ctx.textAlign = 'left'
    ctx.fillText('Call IV', pad.left + 4, pad.top + 10)
    ctx.fillStyle = RED
    ctx.fillText('Put IV', pad.left + 50, pad.top + 10)
  }, [skew, dims])

  if (skew.strikes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No skew data
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. Term Structure Chart
// ---------------------------------------------------------------------------

function TermStructureChart({ data }: { data: TermStructure }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 300, height: 160 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setDims({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.expirations.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.width * dpr
    canvas.height = dims.height * dpr
    ctx.scale(dpr, dpr)

    const { width: w, height: h } = dims
    const pad = { top: 12, right: 40, bottom: 24, left: 44 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)

    const ivs = data.atm_ivs.filter((v) => v > 0)
    if (ivs.length === 0) return

    const yMin = Math.max(0, Math.min(...ivs) - 0.02)
    const yMax = Math.max(...ivs) + 0.02
    const ySpan = yMax - yMin || 1

    const xToPixel = (i: number) => pad.left + (i / (data.expirations.length - 1 || 1)) * plotW
    const yToPixel = (iv: number) => pad.top + plotH - ((iv - yMin) / ySpan) * plotH

    // Grid
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (i / 3) * plotH
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
      const val = yMax - (i / 3) * ySpan
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '8px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${(val * 100).toFixed(0)}%`, pad.left - 4, y + 3)
    }

    // Line + dots
    ctx.beginPath()
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 2
    for (let i = 0; i < data.expirations.length; i++) {
      if (data.atm_ivs[i]! <= 0) continue
      const x = xToPixel(i)
      const y = yToPixel(data.atm_ivs[i]!)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Dots
    for (let i = 0; i < data.expirations.length; i++) {
      if (data.atm_ivs[i]! <= 0) continue
      const x = xToPixel(i)
      const y = yToPixel(data.atm_ivs[i]!)
      ctx.beginPath()
      ctx.fillStyle = ACCENT
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // X labels
    const labelCount = Math.min(5, data.expirations.length)
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((i / (labelCount - 1 || 1)) * (data.expirations.length - 1))
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(data.expirations[idx]!.slice(5), xToPixel(idx), h - pad.bottom + 12)
    }
  }, [data, dims])

  if (data.expirations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No term structure data
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 6. Volatility Cone
// ---------------------------------------------------------------------------

function VolatilityConeChart({ cones }: { cones: VolatilityCone[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 300, height: 160 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setDims({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || cones.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.width * dpr
    canvas.height = dims.height * dpr
    ctx.scale(dpr, dpr)

    const { width: w, height: h } = dims
    const pad = { top: 12, right: 40, bottom: 24, left: 44 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)

    const allVals = cones.flatMap((c) => [c.percentile5, c.percentile95, c.current]).filter((v) => v > 0)
    if (allVals.length === 0) return

    const yMin = Math.max(0, Math.min(...allVals) - 0.02)
    const yMax = Math.max(...allVals) + 0.02
    const ySpan = yMax - yMin || 1

    const xToPixel = (i: number) => pad.left + (i / (cones.length - 1 || 1)) * plotW
    const yToPixel = (v: number) => pad.top + plotH - ((v - yMin) / ySpan) * plotH

    // 5-95 percentile band
    ctx.beginPath()
    for (let i = 0; i < cones.length; i++) ctx.lineTo(xToPixel(i), yToPixel(cones[i]!.percentile95))
    for (let i = cones.length - 1; i >= 0; i--) ctx.lineTo(xToPixel(i), yToPixel(cones[i]!.percentile5))
    ctx.closePath()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
    ctx.fill()

    // 25-75 percentile band
    ctx.beginPath()
    for (let i = 0; i < cones.length; i++) ctx.lineTo(xToPixel(i), yToPixel(cones[i]!.percentile75))
    for (let i = cones.length - 1; i >= 0; i--) ctx.lineTo(xToPixel(i), yToPixel(cones[i]!.percentile25))
    ctx.closePath()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
    ctx.fill()

    // Median line
    ctx.beginPath()
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    for (let i = 0; i < cones.length; i++) {
      const x = xToPixel(i)
      const y = yToPixel(cones[i]!.median)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Current HV dots
    for (let i = 0; i < cones.length; i++) {
      if (cones[i]!.current <= 0) continue
      const x = xToPixel(i)
      const y = yToPixel(cones[i]!.current)
      ctx.beginPath()
      ctx.fillStyle = AMBER
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.fillStyle = '#0a0a0f'
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // X-axis labels
    for (let i = 0; i < cones.length; i++) {
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${cones[i]!.period}d`, xToPixel(i), h - pad.bottom + 12)
    }

    // Y-axis labels
    for (let i = 0; i <= 3; i++) {
      const val = yMax - (i / 3) * ySpan
      const y = pad.top + (i / 3) * plotH
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '8px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${(val * 100).toFixed(0)}%`, pad.left - 4, y + 3)
    }
  }, [cones, dims])

  if (cones.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No volatility cone data
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 7. Expected Move Bars
// ---------------------------------------------------------------------------

function ExpectedMoveBars({ move, currentPrice }: { move: ExpectedMove; currentPrice: number }) {
  const upMove = move.upperBound - currentPrice
  const downMove = currentPrice - move.lowerBound
  const maxMove = Math.max(upMove, downMove)
  const upPct = maxMove > 0 ? (upMove / maxMove) * 100 : 50
  const downPct = maxMove > 0 ? (downMove / maxMove) * 100 : 50

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="w-12 text-right font-mono tabular-nums text-trading-green">
          +${upMove.toFixed(2)}
        </span>
        <div className="flex-1 rounded-full bg-navy-mid">
          <div
            className="h-2 rounded-full bg-trading-green/60 transition-all"
            style={{ width: `${upPct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] tabular-nums text-text-secondary">
          ${move.upperBound.toFixed(2)}
        </span>
      </div>

      <div className="px-14 text-center">
        <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
          ${currentPrice.toFixed(2)}
        </span>
        <span className="ml-2 text-[10px] text-text-muted">
          {(move.probability * 100).toFixed(0)}% probability
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="w-12 text-right font-mono tabular-nums text-trading-red">
          -${downMove.toFixed(2)}
        </span>
        <div className="flex-1 rounded-full bg-navy-mid">
          <div
            className="h-2 rounded-full bg-trading-red/60 transition-all"
            style={{ width: `${downPct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] tabular-nums text-text-secondary">
          ${move.lowerBound.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-lg border border-border bg-navy-dark', className)}>
      <div className="border-b border-border bg-navy-mid/50 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{title}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function IVDashboard({
  ivData,
  ivSurface,
  skewData,
  termStructure,
  volatilityCone,
  expectedMove,
  hvHistory = [],
  className,
}: IVDashboardProps) {
  if (!ivData) {
    return (
      <div className={cn('flex items-center justify-center bg-navy-black text-sm text-text-muted', className)}>
        Loading IV analytics...
      </div>
    )
  }

  const currentPrice = expectedMove
    ? (expectedMove.upperBound + expectedMove.lowerBound) / 2
    : 0

  return (
    <div className={cn('grid gap-3 bg-navy-black p-3', className)} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
      {/* IV Rank / Percentile gauges */}
      <Section title="IV Rank & Percentile">
        <div className="flex items-center justify-around py-2">
          <IVGauge label="IV Rank" value={ivData.ivRank} />
          <IVGauge label="IV Percentile" value={ivData.ivPercentile} />
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-border px-3 py-2 text-center">
          <div>
            <div className="text-[9px] uppercase text-text-muted">Current IV</div>
            <div className="font-mono text-xs font-semibold tabular-nums text-accent">
              {(ivData.currentIV * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-text-muted">HV(20)</div>
            <div className="font-mono text-xs font-semibold tabular-nums text-trading-green">
              {(ivData.hv20 * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase text-text-muted">HV(50)</div>
            <div className="font-mono text-xs font-semibold tabular-nums text-amber-400">
              {(ivData.hv50 * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </Section>

      {/* HV vs IV chart */}
      <Section title="HV vs IV" className="min-h-[200px]">
        <HVvsIVChart data={hvHistory} />
      </Section>

      {/* IV Surface */}
      {ivSurface && (
        <Section title="IV Surface (Heatmap)" className="col-span-full min-h-[200px]">
          <IVSurfaceChart surface={ivSurface} />
        </Section>
      )}

      {/* Skew */}
      {skewData && (
        <Section title={`IV Skew — ${skewData.expiration}`} className="min-h-[200px]">
          <SkewChart skew={skewData} />
        </Section>
      )}

      {/* Term Structure */}
      {termStructure && (
        <Section title="IV Term Structure" className="min-h-[200px]">
          <TermStructureChart data={termStructure} />
        </Section>
      )}

      {/* Volatility Cone */}
      {volatilityCone && volatilityCone.length > 0 && (
        <Section title="Volatility Cone" className="min-h-[200px]">
          <VolatilityConeChart cones={volatilityCone} />
        </Section>
      )}

      {/* Expected Move */}
      {expectedMove && (
        <Section title={`Expected Move — ${expectedMove.expiration}`}>
          <ExpectedMoveBars move={expectedMove} currentPrice={currentPrice} />
        </Section>
      )}
    </div>
  )
}
