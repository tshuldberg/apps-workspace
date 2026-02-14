'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { IVDashboard } from '@marlin/ui/trading/iv-dashboard'
import { ExpectedMoveCard } from '@marlin/ui/trading/expected-move-overlay'
import type {
  IVAnalytics,
  IVSurface,
  SkewData,
  TermStructure,
  VolatilityCone,
  ExpectedMove,
} from '@marlin/shared'

interface IVAnalyticsPageProps {
  params: Promise<{ symbol: string }>
}

export default function IVAnalyticsPage({ params }: IVAnalyticsPageProps) {
  const { symbol } = use(params)
  const displaySymbol = symbol.toUpperCase()

  const [searchInput, setSearchInput] = useState(displaySymbol)
  const [activeSymbol, setActiveSymbol] = useState(displaySymbol)

  const [ivData, setIVData] = useState<IVAnalytics | null>(null)
  const [ivSurface, setIVSurface] = useState<IVSurface | null>(null)
  const [skewData, setSkewData] = useState<SkewData | null>(null)
  const [termStructure, setTermStructure] = useState<TermStructure | null>(null)
  const [volatilityCone, setVolatilityCone] = useState<VolatilityCone[] | null>(null)
  const [expectedMove1, setExpectedMove1] = useState<ExpectedMove | null>(null)
  const [expectedMove2, setExpectedMove2] = useState<ExpectedMove | null>(null)
  const [hvHistory, setHvHistory] = useState<{ date: string; hv20: number; hv50: number; iv: number }[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  // Generic tRPC fetch helper
  const fetchTrpc = useCallback(
    async <T,>(procedure: string, input: Record<string, unknown>): Promise<T | null> => {
      try {
        const batchInput = { '0': { json: input } }
        const res = await fetch(
          `${apiUrl}/trpc/${procedure}?batch=1&input=${encodeURIComponent(JSON.stringify(batchInput))}`,
        )
        if (!res.ok) return null
        const json = await res.json()
        return json[0]?.result?.data?.json ?? null
      } catch {
        return null
      }
    },
    [apiUrl],
  )

  // Fetch all IV data for a symbol
  const fetchAllData = useCallback(
    async (sym: string) => {
      setLoading(true)
      setError(null)

      try {
        const results = await Promise.allSettled([
          fetchTrpc<IVAnalytics>('optionsFlow.getIVData', { symbol: sym }),
          fetchTrpc<IVSurface>('optionsFlow.getIVSurface', { symbol: sym }),
          fetchTrpc<SkewData>('optionsFlow.getSkew', { symbol: sym }),
          fetchTrpc<TermStructure>('optionsFlow.getTermStructure', { symbol: sym }),
          fetchTrpc<VolatilityCone[]>('optionsFlow.getVolatilityCone', { symbol: sym }),
          fetchTrpc<ExpectedMove>('optionsFlow.getExpectedMove', { symbol: sym, stdDev: '1' }),
          fetchTrpc<ExpectedMove>('optionsFlow.getExpectedMove', { symbol: sym, stdDev: '2' }),
        ])

        const getValue = <T,>(result: PromiseSettledResult<T | null>): T | null =>
          result.status === 'fulfilled' ? result.value : null

        setIVData(getValue(results[0]))
        setIVSurface(getValue(results[1]))
        setSkewData(getValue(results[2]))
        setTermStructure(getValue(results[3]))
        setVolatilityCone(getValue(results[4]))
        setExpectedMove1(getValue(results[5]))
        setExpectedMove2(getValue(results[6]))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [fetchTrpc],
  )

  useEffect(() => {
    fetchAllData(activeSymbol)
  }, [activeSymbol, fetchAllData])

  const handleSymbolSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const sym = searchInput.trim().toUpperCase()
      if (!sym) return
      setActiveSymbol(sym)
      // Update URL without full reload
      window.history.replaceState(null, '', `/options/iv/${sym.toLowerCase()}`)
    },
    [searchInput],
  )

  const currentPrice =
    expectedMove1 ? (expectedMove1.upperBound + expectedMove1.lowerBound) / 2 : 0

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-border bg-navy-dark px-4 py-2">
        {/* Symbol search */}
        <form onSubmit={handleSymbolSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter symbol..."
            className="w-32 rounded border border-border bg-navy-mid px-3 py-1.5 font-mono text-sm uppercase text-text-primary outline-none transition-colors placeholder:normal-case placeholder:text-text-muted focus:border-accent"
          />
          <button
            type="submit"
            className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-accent/80"
          >
            Analyze
          </button>
        </form>

        {/* Active symbol display */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-text-primary">{activeSymbol}</span>
          <span className="text-xs text-text-muted">Implied Volatility Analytics</span>
        </div>

        {/* IV Rank quick badge */}
        {ivData && (
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase text-text-muted">IV Rank</span>
              <span
                className={cn(
                  'font-mono text-xs font-bold tabular-nums',
                  ivData.ivRank < 30
                    ? 'text-trading-green'
                    : ivData.ivRank > 70
                      ? 'text-trading-red'
                      : 'text-accent',
                )}
              >
                {ivData.ivRank.toFixed(0)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase text-text-muted">IV</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                {(ivData.currentIV * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && !ivData && (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-sm text-text-muted">Loading IV analytics for {activeSymbol}...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-center gap-2 border-b border-border bg-trading-red/5 px-4 py-2">
          <span className="text-xs text-trading-red">{error}</span>
          <button
            type="button"
            onClick={() => { setError(null); fetchAllData(activeSymbol) }}
            className="rounded bg-accent px-2 py-0.5 text-[10px] text-text-primary hover:bg-accent/80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main content */}
      {!loading || ivData ? (
        <div className="flex-1 overflow-y-auto">
          <IVDashboard
            ivData={ivData}
            ivSurface={ivSurface}
            skewData={skewData}
            termStructure={termStructure}
            volatilityCone={volatilityCone}
            expectedMove={expectedMove1}
            hvHistory={hvHistory}
            className="min-h-full"
          />

          {/* Expected move card as additional standalone section */}
          {expectedMove1 && currentPrice > 0 && (
            <div className="p-3">
              <ExpectedMoveCard
                currentPrice={currentPrice}
                expectedMove1={expectedMove1}
                expectedMove2={expectedMove2}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

// cn utility inline for this page (avoids extra import complexity)
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}
