import { HistogramSeries, type IChartApi } from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'

export function addVolumeSeries(chart: IChartApi) {
  return chart.addSeries(HistogramSeries, {
    color: '#22c55e',
    priceFormat: {
      type: 'volume' as const,
    },
    priceScaleId: 'volume',
  })
}

export function configureVolumeScale(chart: IChartApi): void {
  chart.priceScale('volume').applyOptions({
    scaleMargins: {
      top: 0.8,
      bottom: 0,
    },
  })
}

export function toVolumeData(bars: OHLCV[]) {
  return bars.map((bar) => ({
    time: (bar.timestamp / 1000) as import('lightweight-charts').UTCTimestamp,
    value: bar.volume,
    color: bar.close >= bar.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
  }))
}
