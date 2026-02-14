'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { HeatMapControls, type MarketCapFilter } from '@marlin/ui/trading/heat-map-controls'
import { SectorDrillDown } from '@marlin/ui/trading/sector-drill-down'
import type { HeatmapData, TimePeriod, ColorMetric, SizeMetric } from '@marlin/ui/trading/heat-map'

export default function HeatmapPage() {
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

  // Apply client-side filters: market cap and search
  const filteredData: HeatmapData | null = useMemo(() => {
    if (!data) return null

    let sectors = data.sectors

    // Market cap filter
    if (marketCapFilter !== 'all') {
      sectors = sectors.map((sector) => {
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
      }).filter(Boolean) as typeof sectors
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toUpperCase()
      sectors = sectors.map((sector) => {
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
      }).filter(Boolean) as typeof sectors
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

  return (
    <div className="flex h-full flex-col bg-navy-black">
      {/* Page header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Market Heat Map</h1>
          <p className="text-xs text-text-muted">
            S&P 500 treemap by market cap
            {filteredData && (
              <>
                {' '}&mdash; {filteredData.sectors.reduce((sum, s) => sum + s.stocks.length, 0)} stocks
                {' '}across {filteredData.sectors.length} sectors
              </>
            )}
          </p>
        </div>
        {data?.updatedAt && (
          <span className="text-[10px] text-text-muted">
            Updated {new Date(data.updatedAt).toLocaleTimeString()}
          </span>
        )}
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

      {/* Main heat map with sector drill-down */}
      <div className="flex-1 overflow-hidden">
        {loading && !data && (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-text-muted">Loading heat map data...</div>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="text-sm text-trading-red">{error}</div>
            <button
              type="button"
              onClick={() => setTimePeriod(timePeriod)}
              className="rounded bg-accent px-3 py-1 text-xs text-text-primary transition-colors hover:bg-accent/80"
            >
              Retry
            </button>
          </div>
        )}

        {filteredData && !error && (
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

        {filteredData && filteredData.sectors.length === 0 && !loading && (
          <div className="flex h-full items-center justify-center">
            <div className="text-sm text-text-muted">
              No stocks match the current filters.
              <button
                type="button"
                onClick={() => {
                  setMarketCapFilter('all')
                  setSearchQuery('')
                  setSectorFilter([])
                }}
                className="ml-2 text-accent hover:underline"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
