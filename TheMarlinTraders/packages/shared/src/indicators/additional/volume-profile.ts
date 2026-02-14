import { z } from 'zod'
import type { OHLCV } from '../../types/market-data.js'
import type { IndicatorMeta } from '../types.js'

export const VolumeProfileParamsSchema = z.object({
  bins: z.number().int().min(1).default(24),
})

export interface VolumeProfileBin {
  priceHigh: number
  priceLow: number
  volume: number
}

export function volumeProfile(
  data: OHLCV[],
  params: Record<string, unknown>,
): { bins: VolumeProfileBin[]; poc: number } {
  const { bins: binCount } = VolumeProfileParamsSchema.parse(params)
  const len = data.length

  if (len === 0) return { bins: [], poc: NaN }

  let overallHigh = -Infinity
  let overallLow = Infinity

  for (let i = 0; i < len; i++) {
    if (data[i].high > overallHigh) overallHigh = data[i].high
    if (data[i].low < overallLow) overallLow = data[i].low
  }

  const range = overallHigh - overallLow
  if (range === 0) {
    return {
      bins: [{ priceHigh: overallHigh, priceLow: overallLow, volume: data.reduce((s, b) => s + b.volume, 0) }],
      poc: overallHigh,
    }
  }

  const binSize = range / binCount
  const binVolumes = new Array<number>(binCount).fill(0)
  const result: VolumeProfileBin[] = []

  for (let i = 0; i < len; i++) {
    // Distribute volume across bins the bar spans
    const tp = (data[i].high + data[i].low + data[i].close) / 3
    const binIdx = Math.min(Math.floor((tp - overallLow) / binSize), binCount - 1)
    binVolumes[binIdx] += data[i].volume
  }

  let maxVol = 0
  let pocIdx = 0

  for (let b = 0; b < binCount; b++) {
    const priceLow = overallLow + b * binSize
    const priceHigh = priceLow + binSize
    result.push({ priceHigh, priceLow, volume: binVolumes[b] })
    if (binVolumes[b] > maxVol) {
      maxVol = binVolumes[b]
      pocIdx = b
    }
  }

  const poc = overallLow + (pocIdx + 0.5) * binSize

  return { bins: result, poc }
}

export const volumeProfileMeta: IndicatorMeta = {
  name: 'volume-profile',
  label: 'Volume Profile',
  category: 'volume',
  display: 'overlay',
  defaultParams: { bins: 24 },
  paramSchema: VolumeProfileParamsSchema,
  outputs: ['bins', 'poc'],
  defaultColors: ['#3b82f6', '#ef4444'],
}
