'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { OptionsHeader } from '@marlin/ui/trading/options-header'
import { ExpirationTabs } from '@marlin/ui/trading/expiration-tabs'
import { OptionsChain } from '@marlin/ui/trading/options-chain'
import type { OptionsChainData, Expiration, IVData } from '@marlin/shared'

type StrikeFilter = 'all' | 'near' | 'itm' | 'otm'

interface OptionsPageProps {
  params: Promise<{ symbol: string }>
}

export default function OptionsPage({ params }: OptionsPageProps) {
  const { symbol } = use(params)
  const displaySymbol = symbol.toUpperCase()

  const [chainData, setChainData] = useState<OptionsChainData | null>(null)
  const [expirations, setExpirations] = useState<Expiration[]>([])
  const [ivData, setIVData] = useState<IVData | null>(null)
  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null)
  const [strikeFilter, setStrikeFilter] = useState<StrikeFilter>('near')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  // Fetch expirations on mount
  useEffect(() => {
    async function fetchExpirations() {
      try {
        const input = { '0': { json: { symbol: displaySymbol } } }
        const res = await fetch(
          `${apiUrl}/trpc/options.getExpirations?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const json = await res.json()
        const data: Expiration[] = json[0]?.result?.data?.json ?? []
        setExpirations(data)
        if (data.length > 0 && !selectedExpiration) {
          setSelectedExpiration(data[0]!.date)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
    fetchExpirations()
  }, [displaySymbol, apiUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch IV data on mount
  useEffect(() => {
    async function fetchIV() {
      try {
        const input = { '0': { json: { symbol: displaySymbol } } }
        const res = await fetch(
          `${apiUrl}/trpc/options.getIVData?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) return
        const json = await res.json()
        setIVData(json[0]?.result?.data?.json ?? null)
      } catch {
        // IV data is supplementary; don't block on failure
      }
    }
    fetchIV()
  }, [displaySymbol, apiUrl])

  // Fetch chain when expiration changes
  const fetchChain = useCallback(async () => {
    if (!selectedExpiration) return
    setLoading(true)
    setError(null)
    try {
      const input = {
        '0': { json: { symbol: displaySymbol, expiration: selectedExpiration } },
      }
      const res = await fetch(
        `${apiUrl}/trpc/options.getChain?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
      )
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()
      setChainData(json[0]?.result?.data?.json ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [displaySymbol, selectedExpiration, apiUrl])

  useEffect(() => {
    fetchChain()
  }, [fetchChain])

  // Filter strikes based on selected filter
  const filteredStrikes = chainData?.strikes.filter((strike) => {
    if (strikeFilter === 'all') return true
    if (!chainData) return true

    const price = chainData.underlyingPrice
    const range = price * 0.1 // 10% range for "near the money"

    switch (strikeFilter) {
      case 'near':
        return strike.price >= price - range && strike.price <= price + range
      case 'itm':
        // ITM calls: strike < price, ITM puts: strike > price
        // Show strikes that are ITM for either side
        return strike.price < price || strike.price > price
      case 'otm':
        return true // Same as all for now; individual ITM highlighting handles visual
      default:
        return true
    }
  }) ?? []

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Header */}
      <OptionsHeader
        symbol={displaySymbol}
        price={chainData?.underlyingPrice ?? 0}
        ivData={ivData}
      />

      {/* Expiration tabs */}
      <ExpirationTabs
        expirations={expirations}
        selected={selectedExpiration}
        onSelect={setSelectedExpiration}
      />

      {/* Strike filter controls */}
      <div className="flex items-center gap-2 border-b border-border bg-navy-dark px-4 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
          Strikes:
        </span>
        {(['near', 'all', 'itm', 'otm'] as StrikeFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStrikeFilter(filter)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              strikeFilter === filter
                ? 'bg-accent text-text-primary'
                : 'text-text-muted hover:bg-navy-light hover:text-text-secondary'
            }`}
          >
            {filter === 'near' ? 'Near Money' : filter.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Chain content */}
      <div className="flex-1 overflow-hidden">
        {loading && !chainData && (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-text-muted">Loading options chain...</div>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="text-sm text-trading-red">{error}</div>
            <button
              type="button"
              onClick={fetchChain}
              className="rounded bg-accent px-3 py-1 text-xs text-text-primary transition-colors hover:bg-accent/80"
            >
              Retry
            </button>
          </div>
        )}

        {chainData && !error && (
          <OptionsChain
            strikes={filteredStrikes}
            underlyingPrice={chainData.underlyingPrice}
            className="h-full"
          />
        )}
      </div>
    </div>
  )
}
