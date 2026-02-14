'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { StrategyBuilder } from '@marlin/ui/trading/strategy-builder'
import { PnLDiagram } from '@marlin/ui/trading/pnl-diagram'
import { StrategyLegEditor } from '@marlin/ui/trading/strategy-leg-editor'
import type { Strategy, OptionsChainData, Expiration } from '@marlin/shared'

export default function OptionsStrategyPage() {
  // ── State ────────────────────────────────────────────────────────────────

  const [symbol, setSymbol] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [chainData, setChainData] = useState<OptionsChainData | null>(null)
  const [expirations, setExpirations] = useState<Expiration[]>([])
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiagram, setShowDiagram] = useState(true)

  const [strategy, setStrategy] = useState<Strategy>({
    name: '',
    legs: [],
    underlyingPrice: 0,
  })

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  // ── Derived ──────────────────────────────────────────────────────────────

  const expirationDates = useMemo(
    () => expirations.map((e) => e.date),
    [expirations],
  )

  const availableStrikes = useMemo(() => {
    if (!chainData) return []
    return chainData.strikes.map((s) => s.price).sort((a, b) => a - b)
  }, [chainData])

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchExpirations = useCallback(
    async (sym: string) => {
      try {
        const input = { '0': { json: { symbol: sym } } }
        const res = await fetch(
          `${apiUrl}/trpc/options.getExpirations?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const json = await res.json()
        const data: Expiration[] = json[0]?.result?.data?.json ?? []
        setExpirations(data)
        if (data.length > 0) {
          setSelectedExpiration(data[0]!.date)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [apiUrl],
  )

  const fetchChain = useCallback(
    async (sym: string, expiration: string) => {
      setLoading(true)
      setError(null)
      try {
        const input = {
          '0': { json: { symbol: sym, expiration } },
        }
        const res = await fetch(
          `${apiUrl}/trpc/options.getChain?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const json = await res.json()
        const data: OptionsChainData | null = json[0]?.result?.data?.json ?? null
        setChainData(data)
        if (data) {
          setStrategy((prev) => ({
            ...prev,
            underlyingPrice: data.underlyingPrice,
          }))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    },
    [apiUrl],
  )

  // Fetch chain when expiration changes
  useEffect(() => {
    if (symbol && selectedExpiration) {
      fetchChain(symbol, selectedExpiration)
    }
  }, [symbol, selectedExpiration, fetchChain])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSymbolSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const sym = searchInput.trim().toUpperCase()
      if (!sym) return
      setSymbol(sym)
      setChainData(null)
      setStrategy({ name: '', legs: [], underlyingPrice: 0 })
      fetchExpirations(sym)
    },
    [searchInput, fetchExpirations],
  )

  const handleStrategyChange = useCallback(
    (newStrategy: Strategy) => {
      setStrategy({
        ...newStrategy,
        underlyingPrice: chainData?.underlyingPrice ?? newStrategy.underlyingPrice,
      })
    },
    [chainData],
  )

  const handleAnalyze = useCallback(() => {
    setShowDiagram(true)
  }, [])

  const handlePaperTrade = useCallback(() => {
    // Paper trade integration placeholder
    // In a real implementation, this would call the tRPC endpoint
    // to submit a paper order with the strategy legs
    alert(
      `Paper Order Submitted:\n${strategy.name}\n${strategy.legs.length} leg(s)\nUnderlying: ${symbol} @ $${strategy.underlyingPrice.toFixed(2)}`,
    )
  }, [strategy, symbol])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Top Bar */}
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
            Load Chain
          </button>
        </form>

        {/* Symbol display */}
        {symbol && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-text-primary">{symbol}</span>
            {chainData && (
              <span className="font-mono text-sm text-text-secondary">
                ${chainData.underlyingPrice.toFixed(2)}
              </span>
            )}
          </div>
        )}

        {/* Expiration selector */}
        {expirations.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Expiration
            </span>
            <select
              value={selectedExpiration ?? ''}
              onChange={(e) => setSelectedExpiration(e.target.value)}
              className="rounded border border-border bg-navy-mid px-2 py-1 font-mono text-xs text-text-primary outline-none focus:border-accent"
            >
              {expirations.map((exp) => (
                <option key={exp.date} value={exp.date}>
                  {exp.date} ({exp.dte}d)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Loading / Error */}
      {loading && !chainData && (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-text-muted">Loading options chain for {symbol}...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center gap-2 py-4">
          <span className="text-sm text-trading-red">{error}</span>
        </div>
      )}

      {/* Main Content — Two Panel Layout */}
      {!symbol && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-text-primary">Options Strategy Builder</p>
            <p className="mt-1 text-sm text-text-muted">
              Enter a symbol above to load the options chain and build a strategy
            </p>
          </div>
        </div>
      )}

      {symbol && chainData && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel — Strategy Builder */}
          <div className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-r border-border">
            <StrategyBuilder
              chainData={chainData}
              expirations={expirationDates}
              strategy={strategy}
              onStrategyChange={handleStrategyChange}
              onAnalyze={handleAnalyze}
            />

            {/* Paper Trade Button */}
            {strategy.legs.length > 0 && (
              <div className="border-t border-border p-4">
                <button
                  type="button"
                  onClick={handlePaperTrade}
                  className="w-full rounded bg-trading-green/20 px-4 py-2 text-sm font-semibold text-trading-green transition-colors hover:bg-trading-green/30"
                >
                  Submit Paper Order
                </button>
              </div>
            )}
          </div>

          {/* Right Panel — P&L Diagram + Leg Editor */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* P&L Diagram */}
            {showDiagram && (
              <div className="flex-1">
                <PnLDiagram
                  strategy={strategy}
                  className="h-full"
                />
              </div>
            )}

            {/* Leg Editor (bottom of right panel) */}
            {strategy.legs.length > 0 && (
              <div className="shrink-0 border-t border-border">
                <div className="flex items-center justify-between border-b border-border bg-navy-dark px-4 py-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Leg Editor
                  </span>
                  <span className="font-mono text-[10px] text-text-muted">
                    {strategy.legs.length} leg{strategy.legs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <StrategyLegEditor
                  strategy={strategy}
                  availableStrikes={availableStrikes}
                  onStrategyChange={handleStrategyChange}
                  className="border-0"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
