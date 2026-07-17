'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PatternScannerDashboard } from '@marlin/ui/trading/pattern-scanner-dashboard'
import type { DetectedPattern, ScanResult } from '@marlin/shared'
import { TrpcClientError, trpcMutation, trpcQuery } from '../../../lib/trpc-fetch.js'

interface PatternAccuracyStats {
  totalTracked: number
  hitTarget: number
  hitStop: number
  expired: number
  hitRate: number
  avgConfidence: number
}

interface PatternScanConfig {
  scanIntervalMinutes: number
}

interface GetActivePatternsResponse {
  patterns: DetectedPattern[]
  accuracy: PatternAccuracyStats
  config: PatternScanConfig
}

export default function ScannerPage() {
  const router = useRouter()
  const [patterns, setPatterns] = useState<DetectedPattern[]>([])
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [accuracyStats, setAccuracyStats] = useState<PatternAccuracyStats>({
    totalTracked: 0,
    hitTarget: 0,
    hitStop: 0,
    expired: 0,
    hitRate: 0,
    avgConfidence: 0,
  })
  const [scanIntervalMinutes, setScanIntervalMinutes] = useState(15)
  const [isScanning, setIsScanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastScanTime, setLastScanTime] = useState<string>(new Date().toISOString())

  const loadActivePatterns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await trpcQuery<GetActivePatternsResponse>('futures.getActivePatterns')
      setPatterns(data.patterns ?? [])
      setAccuracyStats(data.accuracy)
      setScanIntervalMinutes(data.config.scanIntervalMinutes)
      setScanResult((prev) => {
        if (prev) {
          return { ...prev, detectedPatterns: data.patterns ?? [], patternsFound: data.patterns?.length ?? 0 }
        }
        return null
      })
      setLastScanTime(new Date().toISOString())
    } catch (err) {
      const message =
        err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
      setError(message)
      setPatterns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadActivePatterns()
  }, [loadActivePatterns])

  const handlePatternClick = useCallback(
    (pattern: DetectedPattern) => {
      router.push(`/chart/${pattern.symbol}`)
    },
    [router],
  )

  const handleRefresh = useCallback(async () => {
    setIsScanning(true)
    setError(null)

    try {
      const result = await trpcMutation<ScanResult>('futures.triggerScan')
      setScanResult(result)
      setPatterns(result.detectedPatterns ?? [])
      setLastScanTime(new Date().toISOString())
      await loadActivePatterns()
    } catch (err) {
      const code = err instanceof TrpcClientError ? err.code : undefined
      if (code === 'UNAUTHORIZED') {
        await loadActivePatterns()
      } else {
        const message =
          err instanceof TrpcClientError ? err.message : err instanceof Error ? err.message : String(err)
        setError(message)
      }
    } finally {
      setIsScanning(false)
    }
  }, [loadActivePatterns])

  const stats = useMemo(() => {
    const derivedScanResult =
      scanResult ??
      ({
        scannedSymbols: 0,
        patternsFound: patterns.length,
        avgConfidence: patterns.length
          ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
          : 0,
        scanDurationMs: 0,
        detectedPatterns: patterns,
      } satisfies ScanResult)

    return {
      scanResult: derivedScanResult,
      bullishCount: patterns.filter((p) => p.direction === 'bullish').length,
      bearishCount: patterns.filter((p) => p.direction === 'bearish').length,
    }
  }, [patterns, scanResult])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Pattern Scanner</h1>
        <p className="text-xs text-text-muted">
          Automated chart pattern detection across your watchlist and market universe
        </p>
      </div>

      {error && (
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-trading-red/5 px-6 py-2">
          <span className="text-xs text-trading-red">{error}</span>
          <button
            type="button"
            onClick={loadActivePatterns}
            className="rounded bg-accent px-2 py-1 text-[10px] text-text-primary transition-colors hover:bg-accent/80"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <PatternScannerDashboard
            patterns={patterns}
            scanResult={stats.scanResult}
            isScanning={isScanning || loading}
            scanIntervalMinutes={scanIntervalMinutes}
            lastScanTime={lastScanTime}
            onPatternClick={handlePatternClick}
            onRefresh={handleRefresh}
          />
        </div>

        <div className="hidden w-64 shrink-0 border-l border-border bg-navy-dark p-4 lg:block">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-primary">Scanner Stats</h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total Scanned</span>
                <span className="font-mono tabular-nums text-text-primary">{stats.scanResult.scannedSymbols}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Patterns Found</span>
                <span className="font-mono tabular-nums text-text-primary">{stats.scanResult.patternsFound}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Avg Confidence</span>
                <span className="font-mono tabular-nums text-text-primary">
                  {(stats.scanResult.avgConfidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="border-t border-border" />

            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Historical Accuracy</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total Tracked</span>
                <span className="font-mono tabular-nums text-text-primary">{accuracyStats.totalTracked}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Hit Target</span>
                <span className="font-mono tabular-nums text-trading-green">{accuracyStats.hitTarget}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Hit Stop</span>
                <span className="font-mono tabular-nums text-trading-red">{accuracyStats.hitStop}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Expired</span>
                <span className="font-mono tabular-nums text-text-secondary">{accuracyStats.expired}</span>
              </div>
            </div>

            <div className="border-t border-border" />

            <div className="rounded-lg bg-navy-mid p-3">
              <div className="mb-1 text-[10px] text-text-muted">Hit Rate</div>
              <div className="flex items-end gap-2">
                <span className="font-mono text-2xl font-bold tabular-nums text-trading-green">
                  {(accuracyStats.hitRate * 100).toFixed(0)}%
                </span>
                <span className="mb-0.5 text-[10px] text-text-muted">of tracked patterns</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-dark">
                <div
                  className="h-full rounded-full bg-trading-green"
                  style={{ width: `${Math.max(0, Math.min(100, accuracyStats.hitRate * 100))}%` }}
                />
              </div>
            </div>

            <div className="border-t border-border" />

            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Current Patterns</h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-trading-green" />
                  <span className="text-text-muted">Bullish</span>
                </div>
                <span className="font-mono tabular-nums text-text-primary">{stats.bullishCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-trading-red" />
                  <span className="text-text-muted">Bearish</span>
                </div>
                <span className="font-mono tabular-nums text-text-primary">{stats.bearishCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
