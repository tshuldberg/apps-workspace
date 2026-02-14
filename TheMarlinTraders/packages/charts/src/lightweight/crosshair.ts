import type { IChartApi, ISeriesApi, SeriesType, Time, MouseEventParams } from 'lightweight-charts'
import { formatPrice, formatVolume, formatPercent } from '@marlin/shared'

export interface CrosshairTooltipData {
  open: number
  high: number
  low: number
  close: number
  volume: number
  change: number
  changePercent: number
  isUp: boolean
}

export function extractCrosshairData(
  params: MouseEventParams<Time>,
  series: ISeriesApi<SeriesType, Time>,
): CrosshairTooltipData | null {
  if (!params.time || !params.seriesData) return null

  const data = params.seriesData.get(series)
  if (!data) return null

  // Handle candlestick/bar data (has open, high, low, close)
  if ('open' in data && 'close' in data) {
    const ohlc = data as { open: number; high: number; low: number; close: number }
    const change = ohlc.close - ohlc.open
    const changePercent = (change / ohlc.open) * 100
    return {
      open: ohlc.open,
      high: ohlc.high,
      low: ohlc.low,
      close: ohlc.close,
      volume: 0,
      change,
      changePercent,
      isUp: ohlc.close >= ohlc.open,
    }
  }

  // Handle line/area data (has value only)
  if ('value' in data) {
    const val = (data as { value: number }).value
    return {
      open: val,
      high: val,
      low: val,
      close: val,
      volume: 0,
      change: 0,
      changePercent: 0,
      isUp: true,
    }
  }

  return null
}

export function createTooltipElement(): HTMLDivElement {
  const tooltip = document.createElement('div')
  tooltip.style.cssText = `
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
    pointer-events: none;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
    line-height: 1.5;
    padding: 6px 10px;
    background: rgba(15, 15, 26, 0.9);
    border: 1px solid #1e293b;
    border-radius: 4px;
    color: #94a3b8;
    display: none;
  `
  return tooltip
}

export function updateTooltipContent(
  tooltip: HTMLDivElement,
  data: CrosshairTooltipData,
  volumeValue?: number,
): void {
  const color = data.isUp ? '#22c55e' : '#ef4444'
  const vol = volumeValue ?? data.volume
  tooltip.style.display = 'block'
  tooltip.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <span>O <span style="color:${color}">${formatPrice(data.open)}</span></span>
      <span>H <span style="color:${color}">${formatPrice(data.high)}</span></span>
      <span>L <span style="color:${color}">${formatPrice(data.low)}</span></span>
      <span>C <span style="color:${color}">${formatPrice(data.close)}</span></span>
      <span>Vol <span style="color:#94a3b8">${formatVolume(vol)}</span></span>
      <span style="color:${color}">${formatPercent(data.changePercent)}</span>
    </div>
  `
}

export function subscribeCrosshair(
  chart: IChartApi,
  series: ISeriesApi<SeriesType, Time>,
  tooltip: HTMLDivElement,
  volumeSeries?: ISeriesApi<SeriesType, Time>,
): () => void {
  const handler = (params: MouseEventParams<Time>) => {
    if (!params.time || !params.seriesData) {
      tooltip.style.display = 'none'
      return
    }

    const data = extractCrosshairData(params, series)
    if (!data) {
      tooltip.style.display = 'none'
      return
    }

    let vol = 0
    if (volumeSeries && params.seriesData) {
      const volData = params.seriesData.get(volumeSeries)
      if (volData && 'value' in volData) {
        vol = (volData as { value: number }).value
      }
    }

    updateTooltipContent(tooltip, data, vol)
  }

  chart.subscribeCrosshairMove(handler)
  return () => chart.unsubscribeCrosshairMove(handler)
}
