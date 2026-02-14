import { CandlestickSeries, type IChartApi, type DeepPartial, type CandlestickStyleOptions } from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'

export const HEIKIN_ASHI_OPTIONS: DeepPartial<CandlestickStyleOptions> = {
  upColor: '#22c55e',
  downColor: '#ef4444',
  borderUpColor: '#22c55e',
  borderDownColor: '#ef4444',
  wickUpColor: '#22c55e',
  wickDownColor: '#ef4444',
}

export function computeHeikinAshi(bars: OHLCV[]): OHLCV[] {
  if (bars.length === 0) return []

  const result: OHLCV[] = []
  let prevHA: OHLCV | undefined

  for (const bar of bars) {
    const haClose = (bar.open + bar.high + bar.low + bar.close) / 4
    const haOpen = prevHA ? (prevHA.open + prevHA.close) / 2 : (bar.open + bar.close) / 2
    const haHigh = Math.max(bar.high, haOpen, haClose)
    const haLow = Math.min(bar.low, haOpen, haClose)

    const ha: OHLCV = {
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: bar.volume,
      timestamp: bar.timestamp,
    }

    result.push(ha)
    prevHA = ha
  }

  return result
}

export function addHeikinAshiSeries(chart: IChartApi) {
  return chart.addSeries(CandlestickSeries, HEIKIN_ASHI_OPTIONS)
}

export function toHeikinAshiData(bars: OHLCV[]) {
  const haBars = computeHeikinAshi(bars)
  return haBars.map((bar) => ({
    time: (bar.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }))
}
