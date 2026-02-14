import type { ISeriesApi, SeriesType, Time, UTCTimestamp } from 'lightweight-charts'
import type { ProcessedBarMessage } from '@marlin/data/workers/data-processor'

interface ActiveBar {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
}

/** Connects a lightweight-charts series to a real-time data stream.
 *  Updates the active (in-progress) candle on each tick, and appends
 *  completed bars when a new time boundary arrives. */
export class RealTimeController {
  private activeBar: ActiveBar | null = null
  private volumeSeries: ISeriesApi<SeriesType, Time> | null = null

  constructor(private readonly series: ISeriesApi<SeriesType, Time>) {}

  /** Optionally attach a volume series for real-time volume updates */
  setVolumeSeries(vol: ISeriesApi<SeriesType, Time>): void {
    this.volumeSeries = vol
  }

  /** Process a bar update from the data worker */
  update(msg: ProcessedBarMessage): void {
    const barTime = msg.bar.time as UTCTimestamp

    if (this.activeBar && this.activeBar.time < barTime) {
      // The previous bar is now complete — it's already been rendered via
      // the last update() call, so we just start tracking the new bar
      this.activeBar = null
    }

    if (!this.activeBar || this.activeBar.time !== barTime) {
      // New bar period
      this.activeBar = {
        time: barTime,
        open: msg.bar.open,
        high: msg.bar.high,
        low: msg.bar.low,
        close: msg.bar.close,
      }
    } else {
      // Update existing bar
      this.activeBar.high = Math.max(this.activeBar.high, msg.bar.high)
      this.activeBar.low = Math.min(this.activeBar.low, msg.bar.low)
      this.activeBar.close = msg.bar.close
    }

    // Update the chart
    this.series.update({
      time: this.activeBar.time,
      open: this.activeBar.open,
      high: this.activeBar.high,
      low: this.activeBar.low,
      close: this.activeBar.close,
    } as Parameters<typeof this.series.update>[0])

    // Update volume if attached
    if (this.volumeSeries) {
      this.volumeSeries.update({
        time: barTime,
        value: msg.volume.value,
        color: msg.volume.color,
      } as Parameters<typeof this.volumeSeries.update>[0])
    }
  }

  /** Reset state (e.g., when switching symbols) */
  reset(): void {
    this.activeBar = null
  }
}
