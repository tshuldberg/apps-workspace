import { AreaSeries, type IChartApi, type DeepPartial, type AreaStyleOptions } from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'

export const AREA_OPTIONS: DeepPartial<AreaStyleOptions> = {
  topColor: 'rgba(59, 130, 246, 0.4)',
  bottomColor: 'rgba(59, 130, 246, 0.05)',
  lineColor: '#3b82f6',
  lineWidth: 2,
  crosshairMarkerVisible: true,
  crosshairMarkerRadius: 4,
  crosshairMarkerBackgroundColor: '#3b82f6',
}

export function addAreaSeries(chart: IChartApi) {
  return chart.addSeries(AreaSeries, AREA_OPTIONS)
}

export function toAreaData(bars: OHLCV[]) {
  return bars.map((bar) => ({
    time: (bar.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
    value: bar.close,
  }))
}
