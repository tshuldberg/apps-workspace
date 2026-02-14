import { ColorType, CrosshairMode, LineStyle, type DeepPartial, type ChartOptions } from 'lightweight-charts'

export const DEFAULT_CHART_OPTIONS: DeepPartial<ChartOptions> = {
  layout: {
    background: { type: ColorType.Solid, color: '#0a0a0f' },
    textColor: '#94a3b8',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: '#1a1a2e' },
    horzLines: { color: '#1a1a2e' },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      color: '#3b82f6',
      width: 1,
      style: LineStyle.Dashed,
      labelBackgroundColor: '#3b82f6',
    },
    horzLine: {
      color: '#3b82f6',
      width: 1,
      style: LineStyle.Dashed,
      labelBackgroundColor: '#3b82f6',
    },
  },
  rightPriceScale: {
    borderColor: '#1e293b',
    autoScale: true,
  },
  timeScale: {
    borderColor: '#1e293b',
    timeVisible: true,
    secondsVisible: false,
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: true,
  },
  handleScale: {
    axisPressedMouseMove: true,
    mouseWheel: true,
    pinch: true,
  },
}
