'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { MarlinChart, ChartSkeleton, ChartError, type ChartType } from '@marlin/charts'
import type { OHLCV, Timeframe } from '@marlin/shared'
import type { PriceScaleMode } from '@marlin/charts'

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M']

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'candlestick', label: 'Candlestick' },
  { value: 'ohlc', label: 'OHLC Bar' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'baseline', label: 'Baseline' },
  { value: 'heikin-ashi', label: 'Heikin-Ashi' },
]

interface ChartPageProps {
  params: Promise<{ symbol: string }>
}

export default function ChartPage({ params }: ChartPageProps) {
  const { symbol } = use(params)
  const displaySymbol = symbol.toUpperCase()

  const [timeframe, setTimeframe] = useState<Timeframe>('1D')
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [priceScaleMode, setPriceScaleMode] = useState<PriceScaleMode>('normal')
  const [data, setData] = useState<OHLCV[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const from = new Date()
      from.setMonth(from.getMonth() - 3)
      // tRPC batch call format
      const input = {
        '0': {
          json: {
            symbol: displaySymbol,
            timeframe,
            from: from.toISOString().slice(0, 10),
            to: new Date().toISOString().slice(0, 10),
          },
        },
      }
      const res = await fetch(
        `${apiUrl}/trpc/market.getBars?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
      )
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const json = await res.json()
      const bars: OHLCV[] = json[0]?.result?.data?.json ?? []
      setData(bars)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [displaySymbol, timeframe])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="flex h-full flex-col">
      {/* Header toolbar */}
      <div className="flex h-toolbar-h items-center gap-4 border-b border-border bg-navy-dark px-4">
        {/* Symbol */}
        <span className="font-mono text-price font-semibold text-text-primary">
          {displaySymbol}
        </span>

        {/* Timeframe tabs */}
        <div className="flex gap-0.5 rounded bg-navy-mid p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded px-2 py-0.5 font-mono text-xs transition-colors ${
                timeframe === tf
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart type selector */}
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as ChartType)}
          className="rounded border border-border bg-navy-mid px-2 py-1 font-mono text-xs text-text-secondary outline-none focus:border-accent"
        >
          {CHART_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>
              {ct.label}
            </option>
          ))}
        </select>

        {/* Price scale mode */}
        <select
          value={priceScaleMode}
          onChange={(e) => setPriceScaleMode(e.target.value as PriceScaleMode)}
          className="rounded border border-border bg-navy-mid px-2 py-1 font-mono text-xs text-text-secondary outline-none focus:border-accent"
        >
          <option value="normal">Auto</option>
          <option value="log">Log</option>
          <option value="percentage">%</option>
        </select>
      </div>

      {/* Chart area */}
      <div className="flex-1">
        {loading && !data && <ChartSkeleton />}
        {error && <ChartError error={error} onRetry={fetchData} />}
        {data && !error && (
          <MarlinChart
            data={data}
            chartType={chartType}
            priceScaleMode={priceScaleMode}
            showVolume
          />
        )}
      </div>
    </div>
  )
}
