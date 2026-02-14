import { CandlestickSeries, type IChartApi, type DeepPartial, type CandlestickStyleOptions } from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'

export const CANDLESTICK_OPTIONS: DeepPartial<CandlestickStyleOptions> = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  borderUpColor: '#22c55e',
  borderDownColor: '#ef4444',
  wickUpColor: '#22c55e',
  wickDownColor: '#ef4444',
}

export function addCandlestickSeries(chart: IChartApi) {
  return chart.addSeries(CandlestickSeries, CANDLESTICK_OPTIONS)
}

export function toCandlestickData(bars: OHLCV[]) {
  return bars.map((bar) => ({
    time: (bar.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }))
}
