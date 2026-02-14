import {
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type CreatePriceLineOptions,
  type IPriceLine,
  LineStyle,
} from 'lightweight-charts'

export interface AlertLineOptions {
  price: number
  alertId: string
  conditionType: string
  color?: string
  lineWidth?: number
  lineStyle?: LineStyle
  title?: string
}

export interface AlertLineInstance {
  alertId: string
  priceLine: IPriceLine
  price: number
}

const ALERT_LINE_COLOR = '#f59e0b'

/**
 * Adds a horizontal alert line at the specified price level on the given series.
 * Uses the Lightweight Charts PriceLine API for efficient rendering.
 */
export function addAlertLine(
  series: ISeriesApi<SeriesType, Time>,
  options: AlertLineOptions,
): AlertLineInstance {
  const label = options.title ?? formatConditionLabel(options.conditionType, options.price)

  const priceLineOptions: CreatePriceLineOptions = {
    price: options.price,
    color: options.color ?? ALERT_LINE_COLOR,
    lineWidth: (options.lineWidth ?? 1) as CreatePriceLineOptions['lineWidth'],
    lineStyle: options.lineStyle ?? LineStyle.Dashed,
    axisLabelVisible: true,
    title: label,
    lineVisible: true,
    axisLabelColor: options.color ?? ALERT_LINE_COLOR,
    axisLabelTextColor: '#0f172a',
  }

  const priceLine = series.createPriceLine(priceLineOptions)

  return {
    alertId: options.alertId,
    priceLine,
    price: options.price,
  }
}

/**
 * Removes an alert line from the chart series.
 */
export function removeAlertLine(
  series: ISeriesApi<SeriesType, Time>,
  instance: AlertLineInstance,
): void {
  series.removePriceLine(instance.priceLine)
}

/**
 * Updates the price level of an existing alert line by removing and re-adding it.
 */
export function updateAlertLine(
  series: ISeriesApi<SeriesType, Time>,
  instance: AlertLineInstance,
  newOptions: Partial<AlertLineOptions>,
): AlertLineInstance {
  series.removePriceLine(instance.priceLine)
  return addAlertLine(series, {
    price: newOptions.price ?? instance.price,
    alertId: instance.alertId,
    conditionType: newOptions.conditionType ?? 'price_above',
    color: newOptions.color,
    lineWidth: newOptions.lineWidth,
    lineStyle: newOptions.lineStyle,
    title: newOptions.title,
  })
}

/**
 * Manages multiple alert lines on a single chart series.
 */
export class AlertLineManager {
  private lines = new Map<string, AlertLineInstance>()

  constructor(private series: ISeriesApi<SeriesType, Time>) {}

  add(options: AlertLineOptions): AlertLineInstance {
    // Remove existing line for same alert
    this.remove(options.alertId)

    const instance = addAlertLine(this.series, options)
    this.lines.set(options.alertId, instance)
    return instance
  }

  remove(alertId: string): void {
    const instance = this.lines.get(alertId)
    if (instance) {
      removeAlertLine(this.series, instance)
      this.lines.delete(alertId)
    }
  }

  update(alertId: string, newOptions: Partial<AlertLineOptions>): AlertLineInstance | null {
    const instance = this.lines.get(alertId)
    if (!instance) return null

    const updated = updateAlertLine(this.series, instance, newOptions)
    this.lines.set(alertId, updated)
    return updated
  }

  clear(): void {
    for (const [alertId] of this.lines) {
      this.remove(alertId)
    }
  }

  getAll(): AlertLineInstance[] {
    return Array.from(this.lines.values())
  }

  get size(): number {
    return this.lines.size
  }
}

function formatConditionLabel(conditionType: string, price: number): string {
  const prefix = conditionType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return `${prefix} @ ${price}`
}
