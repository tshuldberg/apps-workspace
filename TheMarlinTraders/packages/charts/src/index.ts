export { MarlinChart, type MarlinChartProps } from './lightweight/chart.js'
export { DEFAULT_CHART_OPTIONS } from './lightweight/config.js'
export {
  createSeries,
  toSeriesData,
  type ChartType,
  CANDLESTICK_OPTIONS,
  BAR_OPTIONS,
  LINE_OPTIONS,
  AREA_OPTIONS,
  BASELINE_OPTIONS,
  HEIKIN_ASHI_OPTIONS,
  computeHeikinAshi,
} from './lightweight/series/index.js'
export { addVolumeSeries, configureVolumeScale, toVolumeData } from './lightweight/volume.js'
export {
  extractCrosshairData,
  subscribeCrosshair,
  createTooltipElement,
  updateTooltipContent,
  type CrosshairTooltipData,
} from './lightweight/crosshair.js'
export { setupInteractions } from './lightweight/interactions.js'
export { getPriceScaleOptions, type PriceScaleMode } from './lightweight/price-scale.js'
export { ChartSkeleton } from './components/chart-skeleton.js'
export { ChartError, type ChartErrorProps } from './components/chart-error.js'
export {
  addOverlayIndicator,
  removeOverlayIndicator,
  updateOverlayData,
  type OverlayInstance,
} from './lightweight/indicator-overlay.js'
export {
  addSubchartIndicator,
  removeSubchartIndicator,
  updateSubchartData,
  syncSubchartTimeScale,
  type SubchartInstance,
} from './lightweight/indicator-subchart.js'
export * from './drawings/index.js'
