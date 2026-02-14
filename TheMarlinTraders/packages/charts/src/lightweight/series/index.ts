import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import { addCandlestickSeries, toCandlestickData } from './candlestick.js'
import { addBarSeries, toBarData } from './ohlc-bar.js'
import { addLineSeries, toLineData } from './line.js'
import { addAreaSeries, toAreaData } from './area.js'
import { addBaselineSeries, toBaselineData } from './baseline.js'
import { addHeikinAshiSeries, toHeikinAshiData } from './heikin-ashi.js'
import type { OHLCV } from '@marlin/shared'

export type ChartType = 'candlestick' | 'ohlc' | 'line' | 'area' | 'baseline' | 'heikin-ashi'

export function createSeries(
  type: ChartType,
  chart: IChartApi,
  baseValue?: number,
): ISeriesApi<SeriesType, Time> {
  switch (type) {
    case 'candlestick':
      return addCandlestickSeries(chart)
    case 'ohlc':
      return addBarSeries(chart)
    case 'line':
      return addLineSeries(chart)
    case 'area':
      return addAreaSeries(chart)
    case 'baseline':
      return addBaselineSeries(chart, baseValue)
    case 'heikin-ashi':
      return addHeikinAshiSeries(chart)
  }
}

export function toSeriesData(type: ChartType, bars: OHLCV[]) {
  switch (type) {
    case 'candlestick':
      return toCandlestickData(bars)
    case 'ohlc':
      return toBarData(bars)
    case 'line':
      return toLineData(bars)
    case 'area':
      return toAreaData(bars)
    case 'baseline':
      return toBaselineData(bars)
    case 'heikin-ashi':
      return toHeikinAshiData(bars)
  }
}

export { CANDLESTICK_OPTIONS } from './candlestick.js'
export { BAR_OPTIONS } from './ohlc-bar.js'
export { LINE_OPTIONS } from './line.js'
export { AREA_OPTIONS } from './area.js'
export { BASELINE_OPTIONS } from './baseline.js'
export { HEIKIN_ASHI_OPTIONS, computeHeikinAshi } from './heikin-ashi.js'
