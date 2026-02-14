'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '../lib/utils.js'
import type { TimePeriod, ColorMetric, SizeMetric } from './heat-map.js'

export type MarketCapFilter = 'all' | 'mega' | 'large' | 'mid' | 'small'

const GICS_SECTORS = [
  'Information Technology',
  'Health Care',
  'Financials',
  'Consumer Discretionary',
  'Communication Services',
  'Industrials',
  'Consumer Staples',
  'Energy',
  'Utilities',
  'Real Estate',
  'Materials',
]

const EXTENDED_TIME_PERIODS: { value: string; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
]

const COLOR_METRICS: { value: ColorMetric; label: string }[] = [
  { value: 'performance', label: '% Change' },
  { value: 'peRatio', label: 'P/E Ratio' },
  { value: 'rsi', label: 'RSI' },
  { value: 'ivRank', label: 'IV Rank' },
  { value: 'volume', label: 'Volume' },
]

const SIZE_METRICS: { value: SizeMetric; label: string }[] = [
  { value: 'marketCap', label: 'Market Cap' },
  { value: 'volume', label: 'Volume' },
  { value: 'equal', label: 'Equal Weight' },
]

const MARKET_CAP_FILTERS: { value: MarketCapFilter; label: string; description: string }[] = [
  { value: 'all', label: 'All', description: 'All market caps' },
  { value: 'mega', label: 'Mega', description: '>$200B' },
  { value: 'large', label: 'Large', description: '$10-200B' },
  { value: 'mid', label: 'Mid', description: '$2-10B' },
  { value: 'small', label: 'Small', description: '<$2B' },
]

// Color scale legend colors
function getColorScaleLegend(metric: ColorMetric): { label: string; color: string }[] {
  switch (metric) {
    case 'performance':
      return [
        { label: '-5%', color: 'rgb(239, 68, 68)' },
        { label: '-2%', color: 'rgb(180, 60, 60)' },
        { label: '0%', color: 'rgb(60, 60, 60)' },
        { label: '+2%', color: 'rgb(60, 160, 60)' },
        { label: '+5%', color: 'rgb(34, 197, 94)' },
      ]
    case 'peRatio':
      return [
        { label: '<15', color: '#22c55e' },
        { label: '<25', color: '#3b82f6' },
        { label: '<40', color: '#f59e0b' },
        { label: '40+', color: '#ef4444' },
      ]
    case 'rsi':
      return [
        { label: '<30', color: '#3b82f6' },
        { label: '30-50', color: '#64748b' },
        { label: '50-70', color: '#f59e0b' },
        { label: '70+', color: '#ef4444' },
      ]
    case 'ivRank':
      return [
        { label: '<25', color: '#22c55e' },
        { label: '25-50', color: '#3b82f6' },
        { label: '50-75', color: '#f59e0b' },
        { label: '75+', color: '#ef4444' },
      ]
    case 'volume':
      return [
        { label: 'Low', color: '#1e293b' },
        { label: 'Med', color: '#3b82f6' },
        { label: 'High', color: '#60a5fa' },
      ]
  }
}

export interface HeatMapControlsProps {
  timePeriod: TimePeriod
  colorMetric: ColorMetric
  sizeMetric: SizeMetric
  sectorFilter: string[]
  marketCapFilter?: MarketCapFilter
  searchQuery?: string
  onTimePeriodChange: (period: TimePeriod) => void
  onColorMetricChange: (metric: ColorMetric) => void
  onSizeMetricChange: (metric: SizeMetric) => void
  onSectorFilterChange: (sectors: string[]) => void
  onMarketCapFilterChange?: (filter: MarketCapFilter) => void
  onSearchChange?: (query: string) => void
  className?: string
}

export function HeatMapControls({
  timePeriod,
  colorMetric,
  sizeMetric,
  sectorFilter,
  marketCapFilter = 'all',
  searchQuery = '',
  onTimePeriodChange,
  onColorMetricChange,
  onSizeMetricChange,
  onSectorFilterChange,
  onMarketCapFilterChange,
  onSearchChange,
  className,
}: HeatMapControlsProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleToggleSector = useCallback(
    (sector: string) => {
      if (sectorFilter.includes(sector)) {
        onSectorFilterChange(sectorFilter.filter((s) => s !== sector))
      } else {
        onSectorFilterChange([...sectorFilter, sector])
      }
    },
    [sectorFilter, onSectorFilterChange],
  )

  const handleSelectAll = useCallback(() => {
    onSectorFilterChange([])
  }, [onSectorFilterChange])

  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalSearch(value)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchTimerRef.current = setTimeout(() => {
        onSearchChange?.(value)
      }, 200)
    },
    [onSearchChange],
  )

  // Sync external searchQuery prop
  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])

  const legend = getColorScaleLegend(colorMetric)

  return (
    <div className={cn('flex flex-col gap-2 border-b border-border bg-navy-dark px-4 py-2', className)}>
      {/* Top row: time period, color/size metric, market cap, search */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Time period */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Period</span>
          {EXTENDED_TIME_PERIODS.map((tp) => (
            <button
              key={tp.value}
              type="button"
              onClick={() => onTimePeriodChange(tp.value as TimePeriod)}
              className={cn(
                'rounded px-2 py-0.5 text-xs transition-colors',
                timePeriod === tp.value
                  ? 'bg-accent text-text-primary'
                  : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
              )}
            >
              {tp.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border" />

        {/* Color metric */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Color</span>
          <select
            value={colorMetric}
            onChange={(e) => onColorMetricChange(e.target.value as ColorMetric)}
            className="rounded border border-border bg-navy-mid px-2 py-0.5 text-xs text-text-primary outline-none focus:border-accent"
          >
            {COLOR_METRICS.map((cm) => (
              <option key={cm.value} value={cm.value}>{cm.label}</option>
            ))}
          </select>
        </div>

        {/* Size metric */}
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Size</span>
          <select
            value={sizeMetric}
            onChange={(e) => onSizeMetricChange(e.target.value as SizeMetric)}
            className="rounded border border-border bg-navy-mid px-2 py-0.5 text-xs text-text-primary outline-none focus:border-accent"
          >
            {SIZE_METRICS.map((sm) => (
              <option key={sm.value} value={sm.value}>{sm.label}</option>
            ))}
          </select>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border" />

        {/* Market cap filter */}
        {onMarketCapFilterChange && (
          <div className="flex items-center gap-1">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Cap</span>
            {MARKET_CAP_FILTERS.map((mcf) => (
              <button
                key={mcf.value}
                type="button"
                title={mcf.description}
                onClick={() => onMarketCapFilterChange(mcf.value)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] transition-colors',
                  marketCapFilter === mcf.value
                    ? 'bg-accent text-text-primary'
                    : 'text-text-muted hover:bg-navy-light hover:text-text-secondary',
                )}
              >
                {mcf.label}
              </button>
            ))}
          </div>
        )}

        {/* Separator */}
        {onSearchChange && <div className="h-5 w-px bg-border" />}

        {/* Search */}
        {onSearchChange && (
          <div className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={localSearch}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search symbol..."
              className="w-28 rounded border border-border bg-navy-mid px-2 py-0.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
            />
          </div>
        )}

        {/* Color scale legend */}
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Scale</span>
          <div className="flex items-center gap-0.5">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center gap-0.5">
                <div
                  className="h-3 w-3 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[9px] text-text-muted">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: sector filter chips */}
      <div className="flex items-center gap-1">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Sectors</span>
        <button
          type="button"
          onClick={handleSelectAll}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] transition-colors',
            sectorFilter.length === 0
              ? 'bg-accent text-text-primary'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          All
        </button>
        {GICS_SECTORS.map((sector) => {
          const shortName = sector.length > 12 ? sector.slice(0, 10) + '..' : sector
          const isActive = sectorFilter.length === 0 || sectorFilter.includes(sector)
          return (
            <button
              key={sector}
              type="button"
              title={sector}
              onClick={() => handleToggleSector(sector)}
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] transition-colors',
                isActive
                  ? 'bg-navy-mid text-text-secondary'
                  : 'text-text-muted/50 line-through',
              )}
            >
              {shortName}
            </button>
          )
        })}
      </div>
    </div>
  )
}
