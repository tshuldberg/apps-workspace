import type { DeepPartial, PriceScaleOptions } from 'lightweight-charts'

export type PriceScaleMode = 'normal' | 'log' | 'percentage'

export function getPriceScaleOptions(mode: PriceScaleMode): DeepPartial<PriceScaleOptions> {
  return {
    autoScale: true,
    borderColor: '#1e293b',
    mode: mode === 'log' ? 1 : mode === 'percentage' ? 2 : 0,
  }
}
