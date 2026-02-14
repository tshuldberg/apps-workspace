'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@marlin/ui/lib/utils'
import { PatternScannerDashboard } from '@marlin/ui/trading/pattern-scanner-dashboard'
import type { DetectedPattern, ScanResult } from '@marlin/shared'

// ── Mock Data ───────────────────────────────────────────────────────────────
// TODO: Replace with tRPC queries
// trpc.futures.getActivePatterns.useQuery()
// trpc.futures.triggerScan.useMutation()

const now = new Date()

function minutesAgo(mins: number): string {
  return new Date(now.getTime() - mins * 60_000).toISOString()
}

const MOCK_PATTERNS: DetectedPattern[] = [
  {
    id: 'pat-1',
    symbol: 'AAPL',
    pattern: 'Bull Flag',
    confidence: 0.87,
    direction: 'bullish',
    detectedAt: minutesAgo(12),
    priceAtDetection: 198.45,
    priceTarget: 210.00,
    stopLoss: 194.00,
    outcome: 'pending',
    assetClass: 'tech',
  },
  {
    id: 'pat-2',
    symbol: 'NVDA',
    pattern: 'Ascending Triangle',
    confidence: 0.82,
    direction: 'bullish',
    detectedAt: minutesAgo(25),
    priceAtDetection: 875.30,
    priceTarget: 920.00,
    stopLoss: 855.00,
    outcome: 'pending',
    assetClass: 'tech',
  },
  {
    id: 'pat-3',
    symbol: 'TSLA',
    pattern: 'Head & Shoulders',
    confidence: 0.74,
    direction: 'bearish',
    detectedAt: minutesAgo(45),
    priceAtDetection: 245.80,
    priceTarget: 220.00,
    stopLoss: 258.00,
    outcome: 'pending',
    assetClass: 'ev',
  },
  {
    id: 'pat-4',
    symbol: 'ES',
    pattern: 'Double Bottom',
    confidence: 0.91,
    direction: 'bullish',
    detectedAt: minutesAgo(8),
    priceAtDetection: 5892.75,
    priceTarget: 5950.00,
    stopLoss: 5865.00,
    outcome: 'pending',
    assetClass: 'indices',
  },
  {
    id: 'pat-5',
    symbol: 'GC',
    pattern: 'Cup & Handle',
    confidence: 0.79,
    direction: 'bullish',
    detectedAt: minutesAgo(60),
    priceAtDetection: 2945.60,
    priceTarget: 3000.00,
    stopLoss: 2920.00,
    outcome: 'pending',
    assetClass: 'commodities',
  },
  {
    id: 'pat-6',
    symbol: 'META',
    pattern: 'Rising Wedge',
    confidence: 0.68,
    direction: 'bearish',
    detectedAt: minutesAgo(90),
    priceAtDetection: 512.30,
    priceTarget: 485.00,
    stopLoss: 525.00,
    outcome: 'pending',
    assetClass: 'tech',
  },
  {
    id: 'pat-7',
    symbol: 'JPM',
    pattern: 'Channel Up',
    confidence: 0.73,
    direction: 'bullish',
    detectedAt: minutesAgo(120),
    priceAtDetection: 198.50,
    priceTarget: 210.00,
    stopLoss: 192.00,
    outcome: 'pending',
    assetClass: 'finance',
  },
  {
    id: 'pat-8',
    symbol: 'CL',
    pattern: 'Falling Wedge',
    confidence: 0.76,
    direction: 'bullish',
    detectedAt: minutesAgo(35),
    priceAtDetection: 78.42,
    priceTarget: 82.00,
    stopLoss: 76.50,
    outcome: 'pending',
    assetClass: 'commodities',
  },
  {
    id: 'pat-9',
    symbol: 'GOOGL',
    pattern: 'Symmetrical Triangle',
    confidence: 0.65,
    direction: 'bullish',
    detectedAt: minutesAgo(150),
    priceAtDetection: 175.20,
    priceTarget: 185.00,
    stopLoss: 170.00,
    outcome: 'pending',
    assetClass: 'tech',
  },
  {
    id: 'pat-10',
    symbol: 'AMD',
    pattern: 'Descending Triangle',
    confidence: 0.71,
    direction: 'bearish',
    detectedAt: minutesAgo(75),
    priceAtDetection: 165.45,
    priceTarget: 150.00,
    stopLoss: 172.00,
    outcome: 'pending',
    assetClass: 'tech',
  },
  {
    id: 'pat-11',
    symbol: 'SPY',
    pattern: 'Bull Flag',
    confidence: 0.84,
    direction: 'bullish',
    detectedAt: minutesAgo(18),
    priceAtDetection: 589.30,
    priceTarget: 600.00,
    stopLoss: 584.00,
    outcome: 'pending',
    assetClass: 'etf',
  },
  {
    id: 'pat-12',
    symbol: 'NQ',
    pattern: 'Inverse Head & Shoulders',
    confidence: 0.88,
    direction: 'bullish',
    detectedAt: minutesAgo(5),
    priceAtDetection: 21245.50,
    priceTarget: 21500.00,
    stopLoss: 21100.00,
    outcome: 'pending',
    assetClass: 'indices',
  },
]

const MOCK_SCAN_RESULT: ScanResult = {
  scannedSymbols: 36,
  patternsFound: 12,
  avgConfidence: 0.78,
  scanDurationMs: 2340,
  detectedPatterns: MOCK_PATTERNS,
}

// ── Page Component ──────────────────────────────────────────────────────────

export default function ScannerPage() {
  const router = useRouter()
  const [isScanning, setIsScanning] = useState(false)
  const [lastScanTime, setLastScanTime] = useState<string>(new Date().toISOString())

  const handlePatternClick = useCallback(
    (pattern: DetectedPattern) => {
      // Navigate to chart with the symbol
      router.push(`/chart/${pattern.symbol}`)
    },
    [router],
  )

  const handleRefresh = useCallback(() => {
    setIsScanning(true)
    // Simulate scan
    setTimeout(() => {
      setIsScanning(false)
      setLastScanTime(new Date().toISOString())
    }, 2000)
  }, [])

  // Accuracy stats for sidebar
  const accuracyStats = useMemo(() => ({
    totalTracked: 156,
    hitTarget: 89,
    hitStop: 42,
    expired: 25,
    hitRate: 0.57,
    avgConfidence: 0.74,
  }), [])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-navy-dark px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary">Pattern Scanner</h1>
        <p className="text-xs text-text-muted">
          Automated chart pattern detection across your watchlist and market universe
        </p>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          <PatternScannerDashboard
            patterns={MOCK_PATTERNS}
            scanResult={MOCK_SCAN_RESULT}
            isScanning={isScanning}
            scanIntervalMinutes={15}
            lastScanTime={lastScanTime}
            onPatternClick={handlePatternClick}
            onRefresh={handleRefresh}
          />
        </div>

        {/* Sidebar — scanning stats */}
        <div className="hidden w-64 shrink-0 border-l border-border bg-navy-dark p-4 lg:block">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-primary">
            Scanner Stats
          </h3>

          <div className="space-y-4">
            {/* Scan summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total Scanned</span>
                <span className="font-mono tabular-nums text-text-primary">
                  {MOCK_SCAN_RESULT.scannedSymbols}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Patterns Found</span>
                <span className="font-mono tabular-nums text-text-primary">
                  {MOCK_SCAN_RESULT.patternsFound}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Avg Confidence</span>
                <span className="font-mono tabular-nums text-text-primary">
                  {(MOCK_SCAN_RESULT.avgConfidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Accuracy tracking */}
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Historical Accuracy
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Total Tracked</span>
                <span className="font-mono tabular-nums text-text-primary">
                  {accuracyStats.totalTracked}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Hit Target</span>
                <span className="font-mono tabular-nums text-trading-green">
                  {accuracyStats.hitTarget}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Hit Stop</span>
                <span className="font-mono tabular-nums text-trading-red">
                  {accuracyStats.hitStop}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Expired</span>
                <span className="font-mono tabular-nums text-text-secondary">
                  {accuracyStats.expired}
                </span>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Hit rate */}
            <div className="rounded-lg bg-navy-mid p-3">
              <div className="mb-1 text-[10px] text-text-muted">Hit Rate</div>
              <div className="flex items-end gap-2">
                <span className="font-mono text-2xl font-bold tabular-nums text-trading-green">
                  {(accuracyStats.hitRate * 100).toFixed(0)}%
                </span>
                <span className="mb-0.5 text-[10px] text-text-muted">
                  of tracked patterns
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-dark">
                <div
                  className="h-full rounded-full bg-trading-green"
                  style={{ width: `${accuracyStats.hitRate * 100}%` }}
                />
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Direction breakdown */}
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Current Patterns
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-trading-green" />
                  <span className="text-text-muted">Bullish</span>
                </div>
                <span className="font-mono tabular-nums text-text-primary">
                  {MOCK_PATTERNS.filter((p) => p.direction === 'bullish').length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-trading-red" />
                  <span className="text-text-muted">Bearish</span>
                </div>
                <span className="font-mono tabular-nums text-text-primary">
                  {MOCK_PATTERNS.filter((p) => p.direction === 'bearish').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
