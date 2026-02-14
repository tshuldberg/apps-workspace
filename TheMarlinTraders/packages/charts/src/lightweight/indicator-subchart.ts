import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type DeepPartial,
  type ChartOptions,
  LineStyle,
  ColorType,
} from 'lightweight-charts'
import type { OHLCV } from '@marlin/shared'
import {
  computeIndicator,
  getIndicatorMeta,
  type IndicatorResult,
} from '@marlin/shared'

const SUBCHART_HEIGHT = 150

const SUBCHART_OPTIONS: DeepPartial<ChartOptions> = {
  layout: {
    background: { type: ColorType.Solid, color: '#0a0a0f' },
    textColor: '#94a3b8',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 10,
  },
  grid: {
    vertLines: { color: '#1a1a2e' },
    horzLines: { color: '#1a1a2e' },
  },
  rightPriceScale: {
    borderColor: '#1e293b',
    autoScale: true,
    scaleMargins: { top: 0.1, bottom: 0.1 },
  },
  timeScale: {
    borderColor: '#1e293b',
    timeVisible: true,
    secondsVisible: false,
    visible: false,
  },
  handleScroll: { mouseWheel: true, pressedMouseMove: true },
  handleScale: { mouseWheel: true, pinch: true },
  crosshair: {
    vertLine: { color: '#3b82f6', width: 1, style: LineStyle.Dashed, labelVisible: false },
    horzLine: { color: '#3b82f6', width: 1, style: LineStyle.Dashed },
  },
}

export interface SubchartInstance {
  id: string
  name: string
  params: Record<string, unknown>
  chart: IChartApi
  container: HTMLDivElement
  series: ISeriesApi<SeriesType, Time>[]
  colors: string[]
}

let subchartCounter = 0

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

function toHistogramData(values: number[], data: OHLCV[]) {
  const result: { time: Time; value: number; color: string }[] = []
  for (let i = 0; i < values.length; i++) {
    if (!isNaN(values[i])) {
      result.push({
        time: (data[i].timestamp / 1000) as Time,
        value: values[i],
        color: values[i] >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)',
      })
    }
  }
  return result
}

export function addSubchartIndicator(
  parentContainer: HTMLElement,
  data: OHLCV[],
  name: string,
  params: Record<string, unknown> = {},
  colors?: string[],
): SubchartInstance {
  const meta = getIndicatorMeta(name)
  const result = computeIndicator(name, data, params)
  const id = `subchart-${name}-${++subchartCounter}`
  const usedColors = colors ?? meta.defaultColors

  // Create subchart container
  const container = document.createElement('div')
  container.style.width = '100%'
  container.style.height = `${SUBCHART_HEIGHT}px`
  container.style.borderTop = '1px solid #1e293b'
  container.style.position = 'relative'
  parentContainer.appendChild(container)

  // Label
  const label = document.createElement('div')
  label.textContent = `${meta.label} (${Object.entries(params).map(([, v]) => v).join(', ') || 'default'})`
  label.style.cssText = 'position:absolute;top:4px;left:8px;z-index:10;font-size:10px;color:#64748b;font-family:monospace;'
  container.appendChild(label)

  const chart = createChart(container, {
    ...SUBCHART_OPTIONS,
    width: container.clientWidth,
    height: SUBCHART_HEIGHT,
  })

  const seriesList: ISeriesApi<SeriesType, Time>[] = []

  // Add reference lines
  if (meta.referenceLines) {
    for (const ref of meta.referenceLines) {
      const refSeries = chart.addLineSeries({
        color: ref.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      // Create constant reference line across all data points
      const refData = data
        .filter((_, i) => i === 0 || i === data.length - 1)
        .map((bar) => ({
          time: (bar.timestamp / 1000) as Time,
          value: ref.value,
        }))
      if (refData.length > 0) {
        refSeries.setData(refData)
      }
    }
  }

  if (Array.isArray(result)) {
    // Single line subchart (RSI, CCI, ATR, etc.)
    const color = usedColors[0] ?? '#a855f7'
    const series = chart.addLineSeries({
      color,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    series.setData(toLineData(result, data))
    seriesList.push(series)
  } else {
    // Multi-output subchart (MACD, Stochastic, ADX, Aroon)
    const outputs = meta.outputs
    outputs.forEach((key, idx) => {
      const values = (result as Record<string, number[]>)[key]
      if (!values) return
      const color = usedColors[idx] ?? '#94a3b8'

      if (key === 'histogram') {
        const series = chart.addHistogramSeries({
          priceLineVisible: false,
          lastValueVisible: false,
        })
        series.setData(toHistogramData(values, data))
        seriesList.push(series)
      } else {
        const series = chart.addLineSeries({
          color,
          lineWidth: 2,
          crosshairMarkerVisible: true,
          priceLineVisible: false,
          lastValueVisible: key === outputs[0],
        })
        series.setData(toLineData(values, data))
        seriesList.push(series)
      }
    })
  }

  chart.timeScale().fitContent()

  // ResizeObserver
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) {
      chart.applyOptions({ width: entry.contentRect.width })
    }
  })
  resizeObserver.observe(container)

  return { id, name, params, chart, container, series: seriesList, colors: usedColors }
}

export function removeSubchartIndicator(subchart: SubchartInstance): void {
  subchart.chart.remove()
  subchart.container.remove()
}

export function updateSubchartData(
  subchart: SubchartInstance,
  data: OHLCV[],
): void {
  const meta = getIndicatorMeta(subchart.name)
  const result = computeIndicator(subchart.name, data, subchart.params)

  if (Array.isArray(result)) {
    if (subchart.series[0]) {
      subchart.series[0].setData(toLineData(result, data))
    }
  } else {
    const outputs = meta.outputs
    outputs.forEach((key, idx) => {
      const values = (result as Record<string, number[]>)[key]
      if (values && subchart.series[idx]) {
        if (key === 'histogram') {
          subchart.series[idx].setData(toHistogramData(values, data) as never)
        } else {
          subchart.series[idx].setData(toLineData(values, data))
        }
      }
    })
  }

  subchart.chart.timeScale().fitContent()
}

export function syncSubchartTimeScale(
  mainChart: IChartApi,
  subcharts: SubchartInstance[],
): () => void {
  const handler = mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (!range) return
    for (const sub of subcharts) {
      sub.chart.timeScale().setVisibleLogicalRange(range)
    }
  })
  return () => handler()
}
