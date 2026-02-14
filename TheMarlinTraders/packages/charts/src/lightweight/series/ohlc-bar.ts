import { BarSeries, type IChartApi } from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'

export const BAR_OPTIONS = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  thinBars: false,
}

export function addBarSeries(chart: IChartApi) {
  return chart.addSeries(BarSeries, BAR_OPTIONS)
}

export function toBarData(bars: OHLCV[]) {
  return bars.map((bar) => ({
    time: (bar.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }))
}
