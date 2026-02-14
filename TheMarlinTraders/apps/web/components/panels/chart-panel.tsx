'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import type { IDockviewPanelProps } from 'dockview-react'
import { ChartSkeleton, ChartError, type ChartType } from '@marlin/charts'
import type { OHLCV, Timeframe } from '@marlin/shared'
import type { PriceScaleMode } from '@marlin/charts'
import { useLinkingStore, type LinkColor, LINK_COLORS } from '@marlin/data/stores/linking-store'
import { LazyMarlinChart } from '../../lib/lazy-charts.js'

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M']

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'candlestick', label: 'Candle' },
  { value: 'ohlc', label: 'OHLC' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'baseline', label: 'Base' },
  { value: 'heikin-ashi', label: 'HA' },
]

const LINK_COLOR_OPTIONS: (LinkColor | null)[] = [null, 'red', 'green', 'blue', 'yellow']

export function ChartPanel({ api, params }: IDockviewPanelProps<{ symbol?: string }>) {
  const panelId = api.id
  const initialSymbol = (params.symbol as string) ?? 'AAPL'

  const [localSymbol, setLocalSymbol] = useState(initialSymbol)
  const [timeframe, setTimeframe] = useState<Timeframe>('1D')
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [priceScaleMode, setPriceScaleMode] = useState<PriceScaleMode>('normal')
  const [data, setData] = useState<OHLCV[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const linkedSymbol = useLinkingStore((s) => s.getLinkedSymbol(panelId))
  const linkPanel = useLinkingStore((s) => s.linkPanel)
  const panelLinks = useLinkingStore((s) => s.panelLinks)
  const currentLinkColor = panelLinks[panelId] ?? null

  const displaySymbol = linkedSymbol ?? localSymbol

  // Update panel title when symbol changes
  useEffect(() => {
    api.setTitle(displaySymbol)
  }, [api, displaySymbol])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const from = new Date()
      from.setMonth(from.getMonth() - 3)
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
    <div className="flex h-full flex-col bg-navy-black">
      {/* Toolbar */}
      <div className="flex h-toolbar-h items-center gap-2 border-b border-border bg-navy-dark px-2">
        {/* Symbol */}
        <span className="font-mono text-xs font-semibold text-text-primary">{displaySymbol}</span>

        {/* Timeframe tabs */}
        <div className="flex gap-0.5 rounded bg-navy-mid p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded px-1.5 py-0.5 font-mono text-xs transition-colors ${
                timeframe === tf
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Chart type */}
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as ChartType)}
          className="rounded border border-border bg-navy-mid px-1.5 py-0.5 font-mono text-xs text-text-secondary outline-none focus:border-accent"
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
          className="rounded border border-border bg-navy-mid px-1.5 py-0.5 font-mono text-xs text-text-secondary outline-none focus:border-accent"
        >
          <option value="normal">Auto</option>
          <option value="log">Log</option>
          <option value="percentage">%</option>
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Link group selector */}
        <div className="flex items-center gap-1">
          {LINK_COLOR_OPTIONS.map((color) => (
            <button
              key={color ?? 'none'}
              onClick={() => linkPanel(panelId, color)}
              title={color ? `Link to ${color} group` : 'Unlink'}
              className={`h-4 w-4 rounded-full border transition-all ${
                currentLinkColor === color
                  ? 'scale-110 border-text-primary'
                  : 'border-border hover:border-text-muted'
              }`}
              style={{
                backgroundColor: color ? LINK_COLORS[color] : '#1a1a2e',
              }}
            />
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1">
        {loading && !data && <ChartSkeleton />}
        {error && <ChartError error={error} onRetry={fetchData} />}
        {data && !error && (
          <Suspense fallback={<ChartSkeleton />}>
            <LazyMarlinChart data={data} chartType={chartType} priceScaleMode={priceScaleMode} showVolume />
          </Suspense>
        )}
      </div>
    </div>
  )
}
