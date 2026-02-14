import { LineSeries, type IChartApi, type DeepPartial, type LineStyleOptions } from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'

export const LINE_OPTIONS: DeepPartial<LineStyleOptions> = {
  color: '#3b82f6',
  lineWidth: 2,
  crosshairMarkerVisible: true,
  crosshairMarkerRadius: 4,
  crosshairMarkerBackgroundColor: '#3b82f6',
}

export function addLineSeries(chart: IChartApi) {
  return chart.addSeries(LineSeries, LINE_OPTIONS)
}

export function toLineData(bars: OHLCV[]) {
  return bars.map((bar) => ({
    time: (bar.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
    value: bar.close,
  }))
}
