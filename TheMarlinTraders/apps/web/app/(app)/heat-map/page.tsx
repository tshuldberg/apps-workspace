'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { HeatMapControls, type MarketCapFilter } from '@marlin/ui/trading/heat-map-controls'
import { SectorDrillDown } from '@marlin/ui/trading/sector-drill-down'
import type { HeatmapData, TimePeriod, ColorMetric, SizeMetric } from '@marlin/ui/trading/heat-map'

export default function HeatMapPage() {
  const router = useRouter()
  const [data, setData] = useState<HeatmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1D')
  const [colorMetric, setColorMetric] = useState<ColorMetric>('performance')
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>('marketCap')
  const [sectorFilter, setSectorFilter] = useState<string[]>([])
  const [marketCapFilter, setMarketCapFilter] = useState<MarketCapFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  // Fetch heatmap data from the tRPC endpoint when timeframe changes
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const input = { '0': { json: { timeframe: timePeriod } } }
        const res = await fetch(
          `${apiUrl}/trpc/heatmap.getSectors?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const json = await res.json()
        setData(json[0]?.result?.data?.json ?? null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [timePeriod, apiUrl])

  // Apply client-side filters: market cap and search query
  const filteredData: HeatmapData | null = useMemo(() => {
    if (!data) return null

    let sectors = data.sectors

    // Market cap filter: Mega >200B, Large 10-200B, Mid 2-10B, Small <2B
    if (marketCapFilter !== 'all') {
      sectors = sectors
        .map((sector) => {
          const filtered = sector.stocks.filter((stock) => {
            switch (marketCapFilter) {
              case 'mega':
                return stock.marketCap >= 200e9
              case 'large':
                return stock.marketCap >= 10e9 && stock.marketCap < 200e9
              case 'mid':
                return stock.marketCap >= 2e9 && stock.marketCap < 10e9
              case 'small':
                return stock.marketCap < 2e9
              default:
                return true
            }
          })

          if (filtered.length === 0) return null

          return {
            ...sector,
            stocks: filtered,
            totalMarketCap: filtered.reduce((sum, s) => sum + s.marketCap, 0),
            avgChangePercent:
              filtered.reduce((sum, s) => sum + s.changePercent, 0) / filtered.length,
          }
        })
        .filter(Boolean) as typeof sectors
    }

    // Search filter: match symbol or company name
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toUpperCase()
      sectors = sectors
        .map((sector) => {
          const filtered = sector.stocks.filter(
            (stock) =>
              stock.symbol.toUpperCase().includes(query) ||
              stock.name.toUpperCase().includes(query),
          )

          if (filtered.length === 0) return null

          return {
            ...sector,
            stocks: filtered,
            totalMarketCap: filtered.reduce((sum, s) => sum + s.marketCap, 0),
            avgChangePercent:
              filtered.reduce((sum, s) => sum + s.changePercent, 0) / filtered.length,
          }
        })
        .filter(Boolean) as typeof sectors
    }

    return {
      sectors,
      updatedAt: data.updatedAt,
    }
  }, [data, marketCapFilter, searchQuery])

  const handleStockClick = useCallback(
    (symbol: string) => {
      router.push(`/chart/${symbol}`)
    },
    [router],
  )

  const handleRetry = useCallback(() => {
    // Force re-fetch by toggling a non-state dependency
    setData(null)
    setLoading(true)
    const fetchAgain = async () => {
      try {
        const input = { '0': { json: { timeframe: timePeriod } } }
        const res = await fetch(
          `${apiUrl}/trpc/heatmap.getSectors?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
        )
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        const json = await res.json()
        setData(json[0]?.result?.data?.json ?? null)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    fetchAgain()
  }, [timePeriod, apiUrl])

  const handleClearFilters = useCallback(() => {
    setMarketCapFilter('all')
    setSearchQuery('')
    setSectorFilter([])
  }, [])

  const totalStocks = filteredData?.sectors.reduce((sum, s) => sum + s.stocks.length, 0) ?? 0
  const totalSectors = filteredData?.sectors.length ?? 0

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Market Heat Map</h1>
          <p className="text-xs text-text-muted">
            S&P 500 treemap sized by market cap, colored by {colorMetric === 'performance' ? 'performance' : colorMetric}
            {filteredData && (
              <>
                {' '}&mdash; {totalStocks} stock{totalStocks !== 1 ? 's' : ''}
                {' '}across {totalSectors} sector{totalSectors !== 1 ? 's' : ''}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {loading && data && (
            <span className="text-[10px] text-accent">Refreshing...</span>
          )}
          {data?.updatedAt && (
            <span className="text-[10px] text-text-muted">
              Updated {new Date(data.updatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Controls bar */}
      <HeatMapControls
        timePeriod={timePeriod}
        colorMetric={colorMetric}
        sizeMetric={sizeMetric}
        sectorFilter={sectorFilter}
        marketCapFilter={marketCapFilter}
        searchQuery={searchQuery}
        onTimePeriodChange={setTimePeriod}
        onColorMetricChange={setColorMetric}
        onSizeMetricChange={setSizeMetric}
        onSectorFilterChange={setSectorFilter}
        onMarketCapFilterChange={setMarketCapFilter}
        onSearchChange={setSearchQuery}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {/* Loading state (initial) */}
        {loading && !data && (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm text-text-muted">Loading heat map data...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="text-sm text-trading-red">{error}</div>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-accent/80"
            >
              Retry
            </button>
          </div>
        )}

        {/* Heat map with drill-down */}
        {filteredData && !error && totalStocks > 0 && (
          <SectorDrillDown
            data={filteredData}
            timePeriod={timePeriod}
            colorMetric={colorMetric}
            sizeMetric={sizeMetric}
            sectorFilter={sectorFilter}
            onStockClick={handleStockClick}
            className="h-full"
          />
        )}

        {/* Empty state after filtering */}
        {filteredData && totalStocks === 0 && !loading && !error && (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-sm text-text-muted">
                No stocks match the current filters.
              </span>
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-accent hover:underline"
              >
                Clear all filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
