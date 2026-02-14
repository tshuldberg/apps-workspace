import {
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type LineSeriesOptions,
  type DeepPartial,
  LineStyle,
} from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'
import {
  computeIndicator,
  getIndicatorMeta,
  type IndicatorResult,
} from '@marlin/shared'

const OVERLAY_PALETTE = [
  '#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#a855f7',
  '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#8b5cf6',
]

export interface OverlayInstance {
  id: string
  name: string
  params: Record<string, unknown>
  series: ISeriesApi<SeriesType, Time>[]
  colors: string[]
}

let overlayCounter = 0

function toLineData(values: number[], data: OHLCV[]) {
  const result: { time: Time; value: number }[] = []
  for (let i = 0; i < values.length; i++) {
    if (!isNaN(values[i])) {
      result.push({
        time: (data[i].timestamp / 1000) as Time,
        value: values[i],
      })
    }
  }
  return result
}

function getLineOptions(color: string, width: number = 2): DeepPartial<LineSeriesOptions> {
  return {
    color,
    lineWidth: width,
    crosshairMarkerVisible: false,
    priceLineVisible: false,
    lastValueVisible: false,
  }
}

export function addOverlayIndicator(
  chart: IChartApi,
  data: OHLCV[],
  name: string,
  params: Record<string, unknown> = {},
  colors?: string[],
): OverlayInstance {
  const meta = getIndicatorMeta(name)
  const result = computeIndicator(name, data, params)
  const id = `overlay-${name}-${++overlayCounter}`
  const seriesList: ISeriesApi<SeriesType, Time>[] = []
  const usedColors = colors ?? meta.defaultColors

  if (Array.isArray(result)) {
    // Single-output overlay (SMA, EMA, etc.)
    const color = usedColors[0] ?? OVERLAY_PALETTE[overlayCounter % OVERLAY_PALETTE.length]
    const series = chart.addLineSeries(getLineOptions(color))
    series.setData(toLineData(result, data))
    seriesList.push(series)
  } else {
    // Multi-output overlay (Bollinger, Keltner, Ichimoku, etc.)
    const outputs = meta.outputs
    outputs.forEach((key, idx) => {
      const values = (result as Record<string, number[]>)[key]
      if (!values) return
      const color = usedColors[idx] ?? OVERLAY_PALETTE[(overlayCounter + idx) % OVERLAY_PALETTE.length]
      const lineWidth = key === 'middle' ? 1 : 2
      const series = chart.addLineSeries({
        ...getLineOptions(color, lineWidth),
        lineStyle: key === 'chikou' ? LineStyle.Dotted : LineStyle.Solid,
      })
      series.setData(toLineData(values, data))
      seriesList.push(series)
    })
  }

  return { id, name, params, series: seriesList, colors: usedColors }
}

export function removeOverlayIndicator(chart: IChartApi, overlay: OverlayInstance): void {
  for (const series of overlay.series) {
    chart.removeSeries(series)
  }
}

export function updateOverlayData(
  overlay: OverlayInstance,
  data: OHLCV[],
): void {
  const meta = getIndicatorMeta(overlay.name)
  const result = computeIndicator(overlay.name, data, overlay.params)

  if (Array.isArray(result)) {
    if (overlay.series[0]) {
      overlay.series[0].setData(toLineData(result, data))
    }
  } else {
    meta.outputs.forEach((key, idx) => {
      const values = (result as Record<string, number[]>)[key]
      if (values && overlay.series[idx]) {
        overlay.series[idx].setData(toLineData(values, data))
      }
    })
  }
}
