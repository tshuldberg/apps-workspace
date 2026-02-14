'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@marlin/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@marlin/ui/primitives/card'
import { cn } from '@marlin/ui/lib/utils'
import {
  type PatternDetection,
  type ChartPattern,
  CHART_PATTERNS,
  PATTERN_LABELS,
  PATTERN_DIRECTIONS,
} from '@marlin/shared'

// ── Types ──────────────────────────────────────────────────────────────────

interface PatternScanResult extends PatternDetection {
  symbol: string
}

type DirectionFilter = 'all' | 'bullish' | 'bearish'

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_SCAN_RESULTS: PatternScanResult[] = [
  {
    symbol: 'NVDA',
    pattern: 'cup_and_handle',
    confidence: 0.85,
    startBar: 40,
    endBar: 95,
    keyPoints: [
      { time: Date.now() - 86400000 * 45, price: 880.0 },
      { time: Date.now() - 86400000 * 25, price: 810.0 },
      { time: Date.now() - 86400000 * 8, price: 878.0 },
      { time: Date.now() - 86400000 * 3, price: 865.0 },
    ],
    priceTarget: 950.0,
    stopLoss: 860.0,
    direction: 'bullish',
  },
  {
    symbol: 'AAPL',
    pattern: 'bull_flag',
    confidence: 0.78,
    startBar: 80,
    endBar: 98,
    keyPoints: [
      { time: Date.now() - 86400000 * 15, price: 172.0 },
      { time: Date.now() - 86400000 * 10, price: 185.0 },
      { time: Date.now() - 86400000 * 3, price: 182.5 },
    ],
    priceTarget: 198.0,
    stopLoss: 180.0,
    direction: 'bullish',
  },
  {
    symbol: 'TSLA',
    pattern: 'head_and_shoulders',
    confidence: 0.71,
    startBar: 55,
    endBar: 92,
    keyPoints: [
      { time: Date.now() - 86400000 * 30, price: 240.0 },
      { time: Date.now() - 86400000 * 25, price: 230.0 },
      { time: Date.now() - 86400000 * 18, price: 255.0 },
      { time: Date.now() - 86400000 * 12, price: 228.0 },
      { time: Date.now() - 86400000 * 5, price: 242.0 },
    ],
    priceTarget: 215.0,
    stopLoss: 258.0,
    direction: 'bearish',
  },
  {
    symbol: 'META',
    pattern: 'ascending_triangle',
    confidence: 0.69,
    startBar: 50,
    endBar: 90,
    keyPoints: [
      { time: Date.now() - 86400000 * 35, price: 490.0 },
      { time: Date.now() - 86400000 * 28, price: 520.0 },
      { time: Date.now() - 86400000 * 20, price: 498.0 },
      { time: Date.now() - 86400000 * 12, price: 520.5 },
      { time: Date.now() - 86400000 * 5, price: 505.0 },
    ],
    priceTarget: 550.0,
    stopLoss: 488.0,
    direction: 'bullish',
  },
  {
    symbol: 'AMZN',
    pattern: 'double_bottom',
    confidence: 0.64,
    startBar: 60,
    endBar: 88,
    keyPoints: [
      { time: Date.now() - 86400000 * 25, price: 175.5 },
      { time: Date.now() - 86400000 * 15, price: 185.0 },
      { time: Date.now() - 86400000 * 5, price: 176.2 },
    ],
    priceTarget: 195.0,
    stopLoss: 173.0,
    direction: 'bullish',
  },
  {
    symbol: 'MSFT',
    pattern: 'rising_wedge',
    confidence: 0.58,
    startBar: 65,
    endBar: 95,
    keyPoints: [
      { time: Date.now() - 86400000 * 30, price: 400.0 },
      { time: Date.now() - 86400000 * 22, price: 418.0 },
      { time: Date.now() - 86400000 * 14, price: 410.0 },
      { time: Date.now() - 86400000 * 6, price: 422.0 },
    ],
    priceTarget: 390.0,
    stopLoss: 425.0,
    direction: 'bearish',
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-trading-green'
  if (confidence >= 0.5) return 'text-yellow-400'
  return 'text-trading-red'
}

function confidenceBg(confidence: number): string {
  if (confidence >= 0.8) return 'bg-trading-green/10 border-trading-green/20'
  if (confidence >= 0.5) return 'bg-yellow-400/10 border-yellow-400/20'
  return 'bg-trading-red/10 border-trading-red/20'
}

function formatPrice(price: number): string {
  return price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const REFRESH_INTERVALS = [
  { value: 0, label: 'Off' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
]

// ── Page Component ─────────────────────────────────────────────────────────

export default function PatternScanPage() {
  const router = useRouter()

  // Filter state
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [minConfidence, setMinConfidence] = useState(0.5)
  const [enabledPatterns, setEnabledPatterns] = useState<Set<ChartPattern>>(new Set(CHART_PATTERNS))
  const [refreshInterval, setRefreshInterval] = useState(0)

  // Data state (will be replaced with tRPC queries)
  const [results, setResults] = useState<PatternScanResult[]>(MOCK_SCAN_RESULTS)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval === 0) return
    const interval = setInterval(() => {
      // In production, refetch data here
      setLastUpdated(new Date())
    }, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [refreshInterval])

  // Filtered results
  const filteredResults = useMemo(() => {
    return results
      .filter((r) => {
        if (directionFilter !== 'all' && r.direction !== directionFilter) return false
        if (r.confidence < minConfidence) return false
        if (!enabledPatterns.has(r.pattern)) return false
        return true
      })
      .sort((a, b) => b.confidence - a.confidence)
  }, [results, directionFilter, minConfidence, enabledPatterns])

  const togglePattern = useCallback((pattern: ChartPattern) => {
    setEnabledPatterns((prev) => {
      const next = new Set(prev)
      if (next.has(pattern)) {
        next.delete(pattern)
      } else {
        next.add(pattern)
      }
      return next
    })
  }, [])

  const handleCardClick = useCallback(
    (result: PatternScanResult) => {
      router.push(`/chart?symbol=${result.symbol}&pattern=${result.pattern}`)
    },
    [router],
  )

  // Stats
  const stats = useMemo(() => {
    const bullish = filteredResults.filter((r) => r.direction === 'bullish').length
    const bearish = filteredResults.filter((r) => r.direction === 'bearish').length
    const avgConfidence = filteredResults.length > 0
      ? filteredResults.reduce((sum, r) => sum + r.confidence, 0) / filteredResults.length
      : 0
    return { bullish, bearish, avgConfidence, total: filteredResults.length }
  }, [filteredResults])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-text-primary">Pattern Scanner</h1>
            <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
              Beta
            </span>
          </div>
          <p className="text-xs text-text-muted">
            {stats.total} patterns found | {stats.bullish} bullish | {stats.bearish} bearish |
            Avg confidence {(stats.avgConfidence * 100).toFixed(0)}%
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh selector */}
          <div className="flex items-center gap-1 rounded-md border border-border">
            <span className="pl-2 text-[10px] text-text-muted">Refresh:</span>
            {REFRESH_INTERVALS.map((ri) => (
              <button
                key={ri.value}
                className={cn(
                  'px-2 py-1 text-[10px] font-medium transition-colors',
                  refreshInterval === ri.value
                    ? 'bg-accent text-text-primary'
                    : 'text-text-muted hover:text-text-primary',
                )}
                onClick={() => setRefreshInterval(ri.value)}
              >
                {ri.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-text-muted">
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-navy-dark/50 px-6 py-3">
        {/* Direction filter */}
        <div className="flex rounded-md border border-border">
          {(['all', 'bullish', 'bearish'] as DirectionFilter[]).map((dir) => (
            <button
              key={dir}
              className={cn(
                'px-3 py-1 text-xs font-medium capitalize transition-colors',
                directionFilter === dir
                  ? dir === 'bullish'
                    ? 'bg-trading-green/20 text-trading-green'
                    : dir === 'bearish'
                      ? 'bg-trading-red/20 text-trading-red'
                      : 'bg-accent text-text-primary'
                  : 'text-text-muted hover:text-text-primary',
              )}
              onClick={() => setDirectionFilter(dir)}
            >
              {dir}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Confidence threshold */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">Min confidence:</span>
          {[0.4, 0.5, 0.6, 0.7, 0.8].map((val) => (
            <button
              key={val}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                minConfidence === val
                  ? 'bg-accent text-text-primary'
                  : 'bg-navy-mid text-text-muted hover:text-text-primary',
              )}
              onClick={() => setMinConfidence(val)}
            >
              {(val * 100).toFixed(0)}%
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Pattern type toggles */}
        <div className="flex flex-wrap gap-1">
          {CHART_PATTERNS.map((pattern) => (
            <button
              key={pattern}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] transition-colors',
                enabledPatterns.has(pattern)
                  ? 'bg-navy-mid text-text-secondary hover:text-text-primary'
                  : 'bg-navy-mid/30 text-text-muted/40 line-through',
              )}
              onClick={() => togglePattern(pattern)}
            >
              {PATTERN_LABELS[pattern]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredResults.length > 0 ? (
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredResults.map((result, idx) => (
              <button
                key={`${result.symbol}-${result.pattern}-${idx}`}
                type="button"
                onClick={() => handleCardClick(result)}
                className={cn(
                  'flex flex-col rounded-lg border p-4 text-left transition-all hover:brightness-110',
                  confidenceBg(result.confidence),
                )}
              >
                {/* Symbol & direction */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-text-primary">{result.symbol}</span>
                    <span
                      className={cn(
                        'text-xs',
                        result.direction === 'bullish' ? 'text-trading-green' : 'text-trading-red',
                      )}
                    >
                      {result.direction === 'bullish' ? '\u25B2' : '\u25BC'}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-sm font-semibold tabular-nums',
                      confidenceColor(result.confidence),
                    )}
                  >
                    {(result.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Pattern name */}
                <span className="mt-1 text-xs text-text-secondary">
                  {PATTERN_LABELS[result.pattern]}
                </span>

                {/* Price targets */}
                <div className="mt-3 flex gap-4 text-[11px]">
                  {result.priceTarget && (
                    <div>
                      <span className="text-text-muted">Target </span>
                      <span className="font-mono tabular-nums text-trading-green">
                        ${formatPrice(result.priceTarget)}
                      </span>
                    </div>
                  )}
                  {result.stopLoss && (
                    <div>
                      <span className="text-text-muted">Stop </span>
                      <span className="font-mono tabular-nums text-trading-red">
                        ${formatPrice(result.stopLoss)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Key points count */}
                <div className="mt-2 text-[10px] text-text-muted">
                  {result.keyPoints.length} key points | Bars {result.startBar}–{result.endBar}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3 text-text-muted opacity-30">
              <path d="M3 3v18h18" />
              <path d="m19 9-5 5-4-4-3 3" />
            </svg>
            <p className="text-sm text-text-muted">No patterns match your filters</p>
            <p className="mt-1 text-xs text-text-muted/60">
              Try lowering the confidence threshold or enabling more pattern types
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
