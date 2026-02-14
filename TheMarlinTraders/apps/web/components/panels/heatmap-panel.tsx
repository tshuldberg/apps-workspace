'use client'

import { useState, useEffect, useCallback } from 'react'
import { HeatMap } from '@marlin/ui/trading/heat-map'
import { HeatMapControls } from '@marlin/ui/trading/heat-map-controls'
import { SectorDrillDown } from '@marlin/ui/trading/sector-drill-down'
import type { HeatmapData, TimePeriod, ColorMetric, SizeMetric } from '@marlin/ui/trading/heat-map'

export interface HeatmapPanelProps {
  onNavigateToChart?: (symbol: string) => void
}

export function HeatmapPanel({ onNavigateToChart }: HeatmapPanelProps) {
  const [data, setData] = useState<HeatmapData | null>(null)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('1D')
  const [colorMetric, setColorMetric] = useState<ColorMetric>('performance')
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>('marketCap')
  const [sectorFilter, setSectorFilter] = useState<string[]>([])

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/trpc/heatmap.getMarketHeatmap')
        if (res.ok) {
          const json = await res.json()
          setData(json.result?.data ?? null)
        }
      } catch {
        // Component handles null data gracefully
      }
    }
    fetchData()
  }, [timePeriod])

  const handleStockClick = useCallback(
    (symbol: string) => {
      onNavigateToChart?.(symbol)
    },
    [onNavigateToChart],
  )

  return (
    <div className="flex h-full flex-col bg-navy-black">
      <HeatMapControls
        timePeriod={timePeriod}
        colorMetric={colorMetric}
        sizeMetric={sizeMetric}
        sectorFilter={sectorFilter}
        onTimePeriodChange={setTimePeriod}
        onColorMetricChange={setColorMetric}
        onSizeMetricChange={setSizeMetric}
        onSectorFilterChange={setSectorFilter}
      />
      <div className="flex-1 overflow-hidden">
        <SectorDrillDown
          data={data}
          timePeriod={timePeriod}
          colorMetric={colorMetric}
          sizeMetric={sizeMetric}
          sectorFilter={sectorFilter}
          onStockClick={handleStockClick}
          className="h-full"
        />
      </div>
    </div>
  )
}
