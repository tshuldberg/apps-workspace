import type { OHLCV } from '../types/market-data.js'
import type { IndicatorFn, IndicatorMeta, IndicatorResult } from './types.js'

// Trend
import { sma, smaMeta } from './trend/sma.js'
import { ema, emaMeta } from './trend/ema.js'
import { wma, wmaMeta } from './trend/wma.js'
import { dema, demaMeta } from './trend/dema.js'
import { tema, temaMeta } from './trend/tema.js'
import { vwma, vwmaMeta } from './trend/vwma.js'
import { hullMa, hullMaMeta } from './trend/hull-ma.js'
import { macd, macdMeta } from './trend/macd.js'
import { sar, sarMeta } from './trend/sar.js'
import { supertrend, supertrendMeta } from './trend/supertrend.js'

// Momentum
import { rsi, rsiMeta } from './momentum/rsi.js'
import { stochastic, stochasticMeta } from './momentum/stochastic.js'
import { cci, cciMeta } from './momentum/cci.js'
import { williamsR, williamsRMeta } from './momentum/williams-r.js'
import { mfi, mfiMeta } from './momentum/mfi.js'

// Volume
import { obv, obvMeta } from './volume/obv.js'
import { vwap, vwapMeta } from './volume/vwap.js'
import { adLine, adLineMeta } from './volume/ad-line.js'

// Volatility
import { bollinger, bollingerMeta } from './volatility/bollinger.js'
import { atr, atrMeta } from './volatility/atr.js'
import { keltner, keltnerMeta } from './volatility/keltner.js'
import { donchian, donchianMeta } from './volatility/donchian.js'

// Complex
import { ichimoku, ichimokuMeta } from './complex/ichimoku.js'
import { adx, adxMeta } from './complex/adx.js'
import { aroon, aroonMeta } from './complex/aroon.js'

// Additional
import { roc, rocMeta } from './additional/roc.js'
import { ultimateOscillator, ultimateOscillatorMeta } from './additional/ultimate-oscillator.js'
import { awesomeOscillator, awesomeOscillatorMeta } from './additional/awesome-oscillator.js'
import { trix, trixMeta } from './additional/trix.js'
import { cmf, cmfMeta } from './additional/cmf.js'
import { klinger, klingerMeta } from './additional/klinger.js'
import { choppiness, choppinessMeta } from './additional/choppiness.js'
import { stddev, stddevMeta } from './additional/stddev.js'
import { hv, hvMeta } from './additional/hv.js'
import { volumeProfile, volumeProfileMeta } from './additional/volume-profile.js'

// Extended
import { aroonOscillator, aroonOscillatorMeta } from './extended/aroon-oscillator.js'
import { bop, bopMeta } from './extended/bop.js'
import { dpo, dpoMeta } from './extended/dpo.js'
import { eom, eomMeta } from './extended/eom.js'
import { elderRay, elderRayMeta } from './extended/elder-ray.js'
import { forceIndex, forceIndexMeta } from './extended/force-index.js'
import { kst, kstMeta } from './extended/kst.js'
import { massIndex, massIndexMeta } from './extended/mass-index.js'
import { ppo, ppoMeta } from './extended/ppo.js'
import { rvol, rvolMeta } from './extended/rvol.js'
import { tsi, tsiMeta } from './extended/tsi.js'
import { wad, wadMeta } from './extended/wad.js'
import { zigzag, zigzagMeta } from './extended/zigzag.js'
import { vwapBands, vwapBandsMeta } from './extended/vwap-bands.js'
import { percentB, percentBMeta } from './extended/percent-b.js'

interface IndicatorEntry {
  fn: IndicatorFn
  meta: IndicatorMeta
}

const registry = new Map<string, IndicatorEntry>([
  // Trend
  ['sma', { fn: sma, meta: smaMeta }],
  ['ema', { fn: ema, meta: emaMeta }],
  ['wma', { fn: wma, meta: wmaMeta }],
  ['dema', { fn: dema, meta: demaMeta }],
  ['tema', { fn: tema, meta: temaMeta }],
  ['vwma', { fn: vwma, meta: vwmaMeta }],
  ['hull-ma', { fn: hullMa, meta: hullMaMeta }],
  ['macd', { fn: macd as IndicatorFn, meta: macdMeta }],
  ['sar', { fn: sar, meta: sarMeta }],
  ['supertrend', { fn: supertrend as IndicatorFn, meta: supertrendMeta }],

  // Momentum
  ['rsi', { fn: rsi, meta: rsiMeta }],
  ['stochastic', { fn: stochastic as IndicatorFn, meta: stochasticMeta }],
  ['cci', { fn: cci, meta: cciMeta }],
  ['williams-r', { fn: williamsR, meta: williamsRMeta }],
  ['mfi', { fn: mfi, meta: mfiMeta }],

  // Volume
  ['obv', { fn: obv, meta: obvMeta }],
  ['vwap', { fn: vwap, meta: vwapMeta }],
  ['ad-line', { fn: adLine, meta: adLineMeta }],

  // Volatility
  ['bollinger', { fn: bollinger as IndicatorFn, meta: bollingerMeta }],
  ['atr', { fn: atr, meta: atrMeta }],
  ['keltner', { fn: keltner as IndicatorFn, meta: keltnerMeta }],
  ['donchian', { fn: donchian as IndicatorFn, meta: donchianMeta }],

  // Complex
  ['ichimoku', { fn: ichimoku as IndicatorFn, meta: ichimokuMeta }],
  ['adx', { fn: adx as IndicatorFn, meta: adxMeta }],
  ['aroon', { fn: aroon as IndicatorFn, meta: aroonMeta }],

  // Additional
  ['roc', { fn: roc, meta: rocMeta }],
  ['ultimate-oscillator', { fn: ultimateOscillator, meta: ultimateOscillatorMeta }],
  ['awesome-oscillator', { fn: awesomeOscillator, meta: awesomeOscillatorMeta }],
  ['trix', { fn: trix, meta: trixMeta }],
  ['cmf', { fn: cmf, meta: cmfMeta }],
  ['klinger', { fn: klinger as IndicatorFn, meta: klingerMeta }],
  ['choppiness', { fn: choppiness, meta: choppinessMeta }],
  ['stddev', { fn: stddev, meta: stddevMeta }],
  ['hv', { fn: hv, meta: hvMeta }],
  ['volume-profile', { fn: volumeProfile as IndicatorFn, meta: volumeProfileMeta }],

  // Extended
  ['aroon-oscillator', { fn: aroonOscillator, meta: aroonOscillatorMeta }],
  ['bop', { fn: bop, meta: bopMeta }],
  ['dpo', { fn: dpo, meta: dpoMeta }],
  ['eom', { fn: eom, meta: eomMeta }],
  ['elder-ray', { fn: elderRay as IndicatorFn, meta: elderRayMeta }],
  ['force-index', { fn: forceIndex, meta: forceIndexMeta }],
  ['kst', { fn: kst as IndicatorFn, meta: kstMeta }],
  ['mass-index', { fn: massIndex, meta: massIndexMeta }],
  ['ppo', { fn: ppo as IndicatorFn, meta: ppoMeta }],
  ['rvol', { fn: rvol, meta: rvolMeta }],
  ['tsi', { fn: tsi as IndicatorFn, meta: tsiMeta }],
  ['wad', { fn: wad, meta: wadMeta }],
  ['zigzag', { fn: zigzag, meta: zigzagMeta }],
  ['vwap-bands', { fn: vwapBands as IndicatorFn, meta: vwapBandsMeta }],
  ['percent-b', { fn: percentB, meta: percentBMeta }],
])

export function computeIndicator(
  name: string,
  data: OHLCV[],
  params: Record<string, unknown> = {},
): IndicatorResult {
  const entry = registry.get(name)
  if (!entry) throw new Error(`Unknown indicator: ${name}`)
  return entry.fn(data, params)
}

export function getIndicatorMeta(name: string): IndicatorMeta {
  const entry = registry.get(name)
  if (!entry) throw new Error(`Unknown indicator: ${name}`)
  return entry.meta
}

export function getIndicatorNames(): string[] {
  return Array.from(registry.keys())
}

export function getIndicatorsByCategory(category: string): IndicatorMeta[] {
  return Array.from(registry.values())
    .filter((entry) => entry.meta.category === category)
    .map((entry) => entry.meta)
}

export function getAllIndicatorMetas(): IndicatorMeta[] {
  return Array.from(registry.values()).map((entry) => entry.meta)
}
