'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { cn } from '../lib/utils.js'
import type { DetectedPattern, ScanResult } from '@marlin/shared'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PatternScannerDashboardProps {
  patterns: DetectedPattern[]
  scanResult?: ScanResult | null
  isScanning?: boolean
  scanIntervalMinutes?: number
  lastScanTime?: string | null
  onPatternClick?: (pattern: DetectedPattern) => void
  onRefresh?: () => void
  className?: string
}

type SortKey = 'confidence' | 'recency' | 'symbol'
type SortDir = 'asc' | 'desc'
type DirectionFilter = 'all' | 'bullish' | 'bearish'

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHr = Math.floor(diffMin / 60)

  if (diffHr > 24) return `${Math.floor(diffHr / 24)}d ago`
  if (diffHr > 0) return `${diffHr}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'just now'
}

function formatPrice(price: number): string {
  return price.toFixed(2)
}

// ── Confidence Bar ──────────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color =
    pct >= 80 ? 'bg-trading-green' : pct >= 60 ? 'bg-yellow-500' : 'bg-orange-500'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-navy-mid">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-text-muted">{pct}%</span>
    </div>
  )
}

// ── Direction Arrow ─────────────────────────────────────────────────────────

function DirectionArrow({ direction }: { direction: 'bullish' | 'bearish' }) {
  const isBullish = direction === 'bullish'
  return (
    <div
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded',
        isBullish ? 'bg-trading-green/10' : 'bg-trading-red/10',
      )}
    >
      <svg
        className={cn('h-3 w-3', isBullish ? 'text-trading-green' : 'text-trading-red')}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {isBullish ? (
          <>
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </>
        ) : (
          <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </>
        )}
      </svg>
    </div>
  )
}

// ── Pattern Card ────────────────────────────────────────────────────────────

function PatternCard({
  pattern,
  onClick,
}: {
  pattern: DetectedPattern
  onClick?: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick?.()
      }}
      className="group cursor-pointer rounded-lg border border-border bg-navy-dark p-4 transition-colors hover:border-accent/40 hover:bg-navy-mid"
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-accent">{pattern.symbol}</span>
          <DirectionArrow direction={pattern.direction} />
        </div>
        <span className="text-[10px] text-text-muted">{timeAgo(pattern.detectedAt)}</span>
      </div>

      {/* Pattern name */}
      <div className="mb-2">
        <span className="text-xs font-medium text-text-primary">{pattern.pattern}</span>
      </div>

      {/* Confidence */}
      <div className="mb-3">
        <ConfidenceBar confidence={pattern.confidence} />
      </div>

      {/* Details */}
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between">
          <span className="text-text-muted">Price at Detection:</span>
          <span className="font-mono tabular-nums text-text-secondary">
            {formatPrice(pattern.priceAtDetection)}
          </span>
        </div>
        {pattern.priceTarget && (
          <div className="flex justify-between">
            <span className="text-text-muted">Target:</span>
            <span className="font-mono tabular-nums text-trading-green">
              {formatPrice(pattern.priceTarget)}
            </span>
          </div>
        )}
        {pattern.stopLoss && (
          <div className="flex justify-between">
            <span className="text-text-muted">Stop:</span>
            <span className="font-mono tabular-nums text-trading-red">
              {formatPrice(pattern.stopLoss)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Auto-Refresh Indicator ──────────────────────────────────────────────────

function RefreshIndicator({
  lastScanTime,
  scanIntervalMinutes,
  isScanning,
  onRefresh,
}: {
  lastScanTime: string | null
  scanIntervalMinutes: number
  isScanning: boolean
  onRefresh?: () => void
}) {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    if (!lastScanTime || isScanning) {
      setCountdown('')
      return
    }

    const interval = setInterval(() => {
      const lastScan = new Date(lastScanTime).getTime()
      const nextScan = lastScan + scanIntervalMinutes * 60_000
      const remaining = nextScan - Date.now()

      if (remaining <= 0) {
        setCountdown('Scanning...')
      } else {
        const mins = Math.floor(remaining / 60_000)
        const secs = Math.floor((remaining % 60_000) / 1000)
        setCountdown(`${mins}:${String(secs).padStart(2, '0')}`)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lastScanTime, scanIntervalMinutes, isScanning])

  return (
    <div className="flex items-center gap-2 text-[10px]">
      {isScanning ? (
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="text-accent">Scanning...</span>
        </div>
      ) : (
        <>
          {countdown && (
            <span className="font-mono tabular-nums text-text-muted">
              Next scan: {countdown}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="rounded px-1.5 py-0.5 text-text-muted transition-colors hover:bg-navy-light hover:text-text-secondary"
          >
            Refresh
          </button>
        </>
      )}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function PatternScannerDashboard({
  patterns,
  scanResult,
  isScanning = false,
  scanIntervalMinutes = 15,
  lastScanTime = null,
  onPatternClick,
  onRefresh,
  className,
}: PatternScannerDashboardProps) {
  const [sortBy, setSortBy] = useState<SortKey>('confidence')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [confidenceThreshold, setConfidenceThreshold] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  // Get unique pattern types for filter
  const patternTypes = useMemo(() => {
    const types = new Set(patterns.map((p) => p.pattern))
    return Array.from(types).sort()
  }, [patterns])

  const [selectedPatternType, setSelectedPatternType] = useState<string>('all')

  // Filter and sort patterns
  const filteredPatterns = useMemo(() => {
    let result = [...patterns]

    // Direction filter
    if (directionFilter !== 'all') {
      result = result.filter((p) => p.direction === directionFilter)
    }

    // Confidence threshold
    if (confidenceThreshold > 0) {
      result = result.filter((p) => p.confidence >= confidenceThreshold / 100)
    }

    // Pattern type filter
    if (selectedPatternType !== 'all') {
      result = result.filter((p) => p.pattern === selectedPatternType)
    }

    // Search query
    if (searchQuery) {
      const q = searchQuery.toUpperCase()
      result = result.filter(
        (p) => p.symbol.includes(q) || p.pattern.toUpperCase().includes(q),
      )
    }

    // Sort
    const mult = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return (a.confidence - b.confidence) * mult
        case 'recency':
          return (new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()) * mult
        case 'symbol':
          return a.symbol.localeCompare(b.symbol) * mult
        default:
          return 0
      }
    })

    return result
  }, [patterns, directionFilter, confidenceThreshold, selectedPatternType, searchQuery, sortBy, sortDir])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-navy-dark p-3">
        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search symbols..."
          className="h-7 w-36 rounded border border-border bg-navy-mid px-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />

        {/* Direction filter */}
        <div className="flex items-center gap-1">
          {(['all', 'bullish', 'bearish'] as DirectionFilter[]).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => setDirectionFilter(dir)}
              className={cn(
                'rounded px-2 py-1 text-[10px] font-medium transition-colors',
                directionFilter === dir
                  ? dir === 'bullish'
                    ? 'bg-trading-green/20 text-trading-green'
                    : dir === 'bearish'
                      ? 'bg-trading-red/20 text-trading-red'
                      : 'bg-accent text-text-primary'
                  : 'text-text-muted hover:bg-navy-light',
              )}
            >
              {dir === 'all' ? 'All' : dir.charAt(0).toUpperCase() + dir.slice(1)}
            </button>
          ))}
        </div>

        {/* Pattern type */}
        <select
          value={selectedPatternType}
          onChange={(e) => setSelectedPatternType(e.target.value)}
          className="h-7 rounded border border-border bg-navy-mid px-2 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="all">All Patterns</option>
          {patternTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* Confidence threshold */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">Min:</span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
            className="h-1 w-20 accent-accent"
          />
          <span className="font-mono text-[10px] tabular-nums text-text-muted">
            {confidenceThreshold}%
          </span>
        </div>

        {/* Sort */}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-text-muted">Sort:</span>
          {(['confidence', 'recency', 'symbol'] as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (sortBy === key) {
                  setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
                } else {
                  setSortBy(key)
                  setSortDir('desc')
                }
              }}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] transition-colors',
                sortBy === key
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-muted hover:bg-navy-light',
              )}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
              {sortBy === key && (sortDir === 'desc' ? ' \u2193' : ' \u2191')}
            </button>
          ))}
        </div>

        {/* Refresh indicator */}
        <RefreshIndicator
          lastScanTime={lastScanTime}
          scanIntervalMinutes={scanIntervalMinutes}
          isScanning={isScanning}
          onRefresh={onRefresh}
        />
      </div>

      {/* Stats bar */}
      {scanResult && (
        <div className="flex items-center gap-6 text-[10px]">
          <div>
            <span className="text-text-muted">Scanned: </span>
            <span className="font-mono tabular-nums text-text-secondary">
              {scanResult.scannedSymbols}
            </span>
          </div>
          <div>
            <span className="text-text-muted">Found: </span>
            <span className="font-mono tabular-nums text-text-secondary">
              {scanResult.patternsFound}
            </span>
          </div>
          <div>
            <span className="text-text-muted">Avg Confidence: </span>
            <span className="font-mono tabular-nums text-text-secondary">
              {(scanResult.avgConfidence * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-text-muted">Scan Time: </span>
            <span className="font-mono tabular-nums text-text-secondary">
              {scanResult.scanDurationMs}ms
            </span>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-text-muted">
        Showing {filteredPatterns.length} of {patterns.length} patterns
      </div>

      {/* Pattern grid */}
      {filteredPatterns.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPatterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              onClick={() => onPatternClick?.(pattern)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <span className="text-sm text-text-muted">
            {isScanning ? 'Scanning for patterns...' : 'No patterns match current filters'}
          </span>
          {!isScanning && patterns.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setDirectionFilter('all')
                setConfidenceThreshold(0)
                setSelectedPatternType('all')
                setSearchQuery('')
              }}
              className="text-xs text-accent underline hover:text-accent/80"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
