import { BaselineSeries, type IChartApi, type DeepPartial, type BaselineStyleOptions } from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'

export const BASELINE_OPTIONS: DeepPartial<BaselineStyleOptions> = {
  topLineColor: '#22c55e',
  topFillColor1: 'rgba(34, 197, 94, 0.3)',
  topFillColor2: 'rgba(34, 197, 94, 0.05)',
  bottomLineColor: '#ef4444',
  bottomFillColor1: 'rgba(239, 68, 68, 0.05)',
  bottomFillColor2: 'rgba(239, 68, 68, 0.3)',
  lineWidth: 2,
}

export function addBaselineSeries(chart: IChartApi, baseValue?: number) {
  return chart.addSeries(BaselineSeries, {
    ...BASELINE_OPTIONS,
    baseValue: baseValue != null ? { type: 'price' as const, price: baseValue } : undefined,
  })
}

export function toBaselineData(bars: OHLCV[]) {
  return bars.map((bar) => ({
    time: (bar.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
    value: bar.close,
  }))
}
