'use client'

import { useState, useMemo, useCallback } from 'react'
import { cn } from '../lib/utils.js'
import { HeatMap } from './heat-map.js'
import type { HeatmapData, HeatmapStock, SectorGroup, TimePeriod, ColorMetric, SizeMetric } from './heat-map.js'

export interface SectorDrillDownProps {
  data: HeatmapData | null
  timePeriod?: TimePeriod
  colorMetric?: ColorMetric
  sizeMetric?: SizeMetric
  sectorFilter?: string[]
  onStockClick?: (symbol: string) => void
  className?: string
}

type ViewLevel = 'market' | 'sector' | 'industry'

export function SectorDrillDown({
  data,
  timePeriod,
  colorMetric = 'performance',
  sizeMetric = 'marketCap',
  sectorFilter,
  onStockClick,
  className,
}: SectorDrillDownProps) {
  const [viewLevel, setViewLevel] = useState<ViewLevel>('market')
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null)

  const handleSectorClick = useCallback((sector: string) => {
    setSelectedSector(sector)
    setSelectedIndustry(null)
    setViewLevel('sector')
  }, [])

  const handleBackToMarket = useCallback(() => {
    setViewLevel('market')
    setSelectedSector(null)
    setSelectedIndustry(null)
  }, [])

  const handleBackToSector = useCallback(() => {
    setViewLevel('sector')
    setSelectedIndustry(null)
  }, [])

  // When viewing a sector, clicking a stock could drill into its industry
  const handleStockClickInSector = useCallback(
    (symbol: string) => {
      if (!data || !selectedSector) return

      // Find the stock and its industry
      const sector = data.sectors.find((s) => s.sector === selectedSector)
      if (!sector) return

      const stock = sector.stocks.find((s) => s.symbol === symbol) as HeatmapStock & { industry?: string } | undefined
      if (!stock) return

      // If stock has an industry field, drill into industry view
      const industry = (stock as Record<string, unknown>).industry as string | undefined
      if (industry) {
        setSelectedIndustry(industry)
        setViewLevel('industry')
      } else {
        // Otherwise, pass through to the parent click handler
        onStockClick?.(symbol)
      }
    },
    [data, selectedSector, onStockClick],
  )

  // Build sector-only data when drilled into a sector
  const sectorData: HeatmapData | null = useMemo(() => {
    if (!data || !selectedSector) return null
    const sector = data.sectors.find((s) => s.sector === selectedSector)
    if (!sector) return null
    return {
      sectors: [sector],
      updatedAt: data.updatedAt,
    }
  }, [data, selectedSector])

  // Build industry-filtered data when drilled into an industry
  const industryData: HeatmapData | null = useMemo(() => {
    if (!data || !selectedSector || !selectedIndustry) return null
    const sector = data.sectors.find((s) => s.sector === selectedSector)
    if (!sector) return null

    // Filter stocks to only those in the selected industry
    const industryStocks = sector.stocks.filter(
      (s) => (s as Record<string, unknown>).industry === selectedIndustry,
    )

    if (industryStocks.length === 0) return null

    const filteredSector: SectorGroup = {
      sector: selectedIndustry,
      totalMarketCap: industryStocks.reduce((sum, s) => sum + s.marketCap, 0),
      avgChangePercent:
        industryStocks.reduce((sum, s) => sum + s.changePercent, 0) / industryStocks.length,
      stocks: industryStocks,
    }

    return {
      sectors: [filteredSector],
      updatedAt: data.updatedAt,
    }
  }, [data, selectedSector, selectedIndustry])

  // Extract unique industries for the current sector
  const industries = useMemo(() => {
    if (!data || !selectedSector) return []
    const sector = data.sectors.find((s) => s.sector === selectedSector)
    if (!sector) return []

    const industrySet = new Set<string>()
    for (const stock of sector.stocks) {
      const industry = (stock as Record<string, unknown>).industry as string | undefined
      if (industry) industrySet.add(industry)
    }
    return Array.from(industrySet).sort()
  }, [data, selectedSector])

  return (
    <div className={cn('flex flex-col bg-navy-black', className)}>
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1.5 border-b border-border bg-navy-dark px-3 py-1.5 text-xs">
        <button
          type="button"
          onClick={handleBackToMarket}
          className={cn(
            'transition-colors hover:text-text-primary',
            viewLevel === 'market'
              ? 'font-semibold text-text-primary'
              : 'text-accent hover:text-accent/80',
          )}
        >
          Market
        </button>

        {(viewLevel === 'sector' || viewLevel === 'industry') && selectedSector && (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
              <path d="M9 18l6-6-6-6" />
            </svg>
            <button
              type="button"
              onClick={handleBackToSector}
              className={cn(
                'transition-colors hover:text-text-primary',
                viewLevel === 'sector'
                  ? 'font-semibold text-text-primary'
                  : 'text-accent hover:text-accent/80',
              )}
            >
              {selectedSector}
            </button>
          </>
        )}

        {viewLevel === 'industry' && selectedIndustry && (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="font-semibold text-text-primary">
              {selectedIndustry}
            </span>
          </>
        )}

        {/* Back button */}
        {viewLevel !== 'market' && (
          <button
            type="button"
            onClick={viewLevel === 'industry' ? handleBackToSector : handleBackToMarket}
            className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-navy-light hover:text-text-primary"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
      </div>

      {/* Industry sub-navigation (when in sector view) */}
      {viewLevel === 'sector' && industries.length > 1 && (
        <div className="flex items-center gap-1 border-b border-border/50 bg-navy-dark/50 px-3 py-1">
          <span className="mr-1 text-[9px] font-semibold uppercase tracking-wider text-text-muted">Industries</span>
          {industries.map((industry) => (
            <button
              key={industry}
              type="button"
              onClick={() => {
                setSelectedIndustry(industry)
                setViewLevel('industry')
              }}
              className="rounded px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-navy-light hover:text-text-secondary"
            >
              {industry}
            </button>
          ))}
        </div>
      )}

      {/* Heat map view */}
      <div className="flex-1">
        {viewLevel === 'market' && (
          <HeatMap
            data={data}
            timePeriod={timePeriod}
            colorMetric={colorMetric}
            sizeMetric={sizeMetric}
            sectorFilter={sectorFilter}
            onStockClick={onStockClick}
            onSectorClick={handleSectorClick}
            className="h-full w-full"
          />
        )}

        {viewLevel === 'sector' && (
          <HeatMap
            data={sectorData}
            timePeriod={timePeriod}
            colorMetric={colorMetric}
            sizeMetric={sizeMetric}
            onStockClick={handleStockClickInSector}
            className="h-full w-full"
          />
        )}

        {viewLevel === 'industry' && (
          <HeatMap
            data={industryData}
            timePeriod={timePeriod}
            colorMetric={colorMetric}
            sizeMetric={sizeMetric}
            onStockClick={onStockClick}
            className="h-full w-full"
          />
        )}
      </div>
    </div>
  )
}
