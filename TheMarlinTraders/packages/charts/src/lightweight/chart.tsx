'use client'

import { useRef, useEffect, useCallback } from 'react'
import { createChart, type IChartApi, type ISeriesApi, type SeriesType, type Time } from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'
import { DEFAULT_CHART_OPTIONS } from './config.js'
import { createSeries, toSeriesData, type ChartType } from './series/index.js'
import { addVolumeSeries, configureVolumeScale, toVolumeData } from './volume.js'
import { createTooltipElement, subscribeCrosshair } from './crosshair.js'
import { setupInteractions } from './interactions.js'
import { getPriceScaleOptions, type PriceScaleMode } from './price-scale.js'

export interface MarlinChartProps {
  data: OHLCV[]
  chartType?: ChartType
  priceScaleMode?: PriceScaleMode
  showVolume?: boolean
  autosize?: boolean
  className?: string
}

export function MarlinChart({
  data,
  chartType = 'candlestick',
  priceScaleMode = 'normal',
  showVolume = true,
  autosize = true,
  className,
}: MarlinChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<SeriesType, Time> | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Build chart on mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      ...DEFAULT_CHART_OPTIONS,
      width: container.clientWidth,
      height: container.clientHeight,
      rightPriceScale: getPriceScaleOptions(priceScaleMode),
    })
    chartRef.current = chart

    // Tooltip
    const tooltip = createTooltipElement()
    container.appendChild(tooltip)
    tooltipRef.current = tooltip

    // Interactions (double-click reset)
    const cleanupInteractions = setupInteractions(chart, container)

    // ResizeObserver for responsive sizing
    let resizeObserver: ResizeObserver | undefined
    if (autosize) {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) {
          const { width, height } = entry.contentRect
          chart.applyOptions({ width, height })
        }
      })
      resizeObserver.observe(container)
    }

    cleanupRef.current = () => {
      cleanupInteractions()
      resizeObserver?.disconnect()
      if (tooltipRef.current && container.contains(tooltipRef.current)) {
        container.removeChild(tooltipRef.current)
      }
      chart.remove()
    }

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      tooltipRef.current = null
    }
  }, []) // Mount once

  // Update series when chartType or priceScaleMode changes
  const rebuildSeries = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return

    // Remove existing series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current)
      seriesRef.current = null
    }
    if (volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current)
      volumeSeriesRef.current = null
    }

    // Price scale mode
    chart.applyOptions({
      rightPriceScale: getPriceScaleOptions(priceScaleMode),
    })

    // Create main series
    const baseValue = data.length > 0 ? data[0]!.close : undefined
    const series = createSeries(chartType, chart, baseValue)
    seriesRef.current = series

    // Volume
    let volumeSeries: ISeriesApi<SeriesType, Time> | undefined
    if (showVolume) {
      volumeSeries = addVolumeSeries(chart)
      configureVolumeScale(chart)
      volumeSeriesRef.current = volumeSeries
    }

    // Crosshair tooltip subscription
    const tooltip = tooltipRef.current
    if (tooltip) {
      subscribeCrosshair(chart, series, tooltip, volumeSeries)
    }
  }, [chartType, priceScaleMode, showVolume, data])

  // Rebuild series on type/mode change
  useEffect(() => {
    rebuildSeries()
  }, [rebuildSeries])

  // Set data when data or series changes
  useEffect(() => {
    const series = seriesRef.current
    const chart = chartRef.current
    if (!series || !chart || data.length === 0) return

    const seriesData = toSeriesData(chartType, data)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    series.setData(seriesData as any)

    if (showVolume && volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(toVolumeData(data))
    }

    chart.timeScale().fitContent()
  }, [data, chartType, showVolume])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    />
  )
}
