import type { OHLCV, FeatureSet, NormalizationMethod } from '@marlin/shared'

// ---------------------------------------------------------------------------
// Feature Matrix types
// ---------------------------------------------------------------------------

export interface FeatureMatrix {
  /** column names in order */
  names: string[]
  /** rows × columns matrix of feature values */
  data: number[][]
}

export interface TrainTestSplit {
  train: { features: number[][]; targets: number[] }
  test: { features: number[][]; targets: number[] }
}

// ---------------------------------------------------------------------------
// Numeric helpers — guard against NaN / Infinity / division by zero
// ---------------------------------------------------------------------------

function safe(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0 || !Number.isFinite(denominator)) return 0
  return safe(numerator / denominator)
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (let i = 0; i < values.length; i++) sum += values[i]!
  return safe(sum / values.length)
}

function stdDev(values: number[], mu?: number): number {
  if (values.length < 2) return 0
  const m = mu ?? mean(values)
  let sumSq = 0
  for (let i = 0; i < values.length; i++) sumSq += (values[i]! - m) ** 2
  return safe(Math.sqrt(sumSq / (values.length - 1)))
}

// ---------------------------------------------------------------------------
// Built-in feature extractors
// ---------------------------------------------------------------------------

/**
 * SMA ratio: close / SMA(period). Values above 1 mean price is above the average.
 */
export function smaRatio(bars: OHLCV[], period: number): number[] {
  if (bars.length < period) return new Array(bars.length).fill(0)
  const result: number[] = new Array(bars.length).fill(0)

  let sum = 0
  for (let i = 0; i < period; i++) sum += bars[i]!.close

  for (let i = period - 1; i < bars.length; i++) {
    if (i > period - 1) {
      sum += bars[i]!.close - bars[i - period]!.close
    }
    const sma = sum / period
    result[i] = safe(safeDivide(bars[i]!.close, sma))
  }
  return result
}

/**
 * EMA slope: normalized slope of EMA over the last N bars.
 * Returns the percentage change in EMA over the window (per bar).
 */
export function emaSlope(bars: OHLCV[], period: number): number[] {
  if (bars.length < period + 1) return new Array(bars.length).fill(0)
  const result: number[] = new Array(bars.length).fill(0)

  // Compute EMA
  const multiplier = 2 / (period + 1)
  const emaValues: number[] = new Array(bars.length).fill(0)

  // Seed with SMA
  let sum = 0
  for (let i = 0; i < period; i++) sum += bars[i]!.close
  emaValues[period - 1] = sum / period

  for (let i = period; i < bars.length; i++) {
    emaValues[i] = (bars[i]!.close - emaValues[i - 1]!) * multiplier + emaValues[i - 1]!
  }

  // Slope: normalized rate of change of EMA over a lookback window
  const slopeWindow = Math.min(5, period)
  for (let i = period - 1 + slopeWindow; i < bars.length; i++) {
    const prev = emaValues[i - slopeWindow]!
    const curr = emaValues[i]!
    result[i] = safe(safeDivide(curr - prev, prev) / slopeWindow)
  }

  return result
}

/**
 * RSI value: raw RSI 0-100.
 */
export function rsiValue(bars: OHLCV[], period: number): number[] {
  if (bars.length < period + 1) return new Array(bars.length).fill(50)
  const result: number[] = new Array(bars.length).fill(50)

  // Compute initial average gain/loss
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = bars[i]!.close - bars[i - 1]!.close
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  if (avgLoss === 0) {
    result[period] = 100
  } else {
    const rs = safeDivide(avgGain, avgLoss)
    result[period] = safe(100 - 100 / (1 + rs))
  }

  // Smoothed RSI for remaining bars
  for (let i = period + 1; i < bars.length; i++) {
    const change = bars[i]!.close - bars[i - 1]!.close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    if (avgLoss === 0) {
      result[i] = 100
    } else {
      const rs = safeDivide(avgGain, avgLoss)
      result[i] = safe(100 - 100 / (1 + rs))
    }
  }

  return result
}

/**
 * MACD histogram: MACD line minus signal line.
 * Uses standard 12/26/9 parameters.
 */
export function macdHistogram(bars: OHLCV[]): number[] {
  const fastPeriod = 12
  const slowPeriod = 26
  const signalPeriod = 9

  if (bars.length < slowPeriod + signalPeriod) return new Array(bars.length).fill(0)
  const result: number[] = new Array(bars.length).fill(0)

  // Compute fast EMA
  const fastMult = 2 / (fastPeriod + 1)
  const fastEma: number[] = new Array(bars.length).fill(0)
  let fastSum = 0
  for (let i = 0; i < fastPeriod; i++) fastSum += bars[i]!.close
  fastEma[fastPeriod - 1] = fastSum / fastPeriod
  for (let i = fastPeriod; i < bars.length; i++) {
    fastEma[i] = (bars[i]!.close - fastEma[i - 1]!) * fastMult + fastEma[i - 1]!
  }

  // Compute slow EMA
  const slowMult = 2 / (slowPeriod + 1)
  const slowEma: number[] = new Array(bars.length).fill(0)
  let slowSum = 0
  for (let i = 0; i < slowPeriod; i++) slowSum += bars[i]!.close
  slowEma[slowPeriod - 1] = slowSum / slowPeriod
  for (let i = slowPeriod; i < bars.length; i++) {
    slowEma[i] = (bars[i]!.close - slowEma[i - 1]!) * slowMult + slowEma[i - 1]!
  }

  // MACD line
  const macdLine: number[] = new Array(bars.length).fill(0)
  for (let i = slowPeriod - 1; i < bars.length; i++) {
    macdLine[i] = fastEma[i]! - slowEma[i]!
  }

  // Signal line (EMA of MACD)
  const sigMult = 2 / (signalPeriod + 1)
  const signalStart = slowPeriod - 1 + signalPeriod - 1
  let sigSum = 0
  for (let i = slowPeriod - 1; i < slowPeriod - 1 + signalPeriod; i++) {
    sigSum += macdLine[i]!
  }
  let signalVal = sigSum / signalPeriod

  result[signalStart] = safe(macdLine[signalStart]! - signalVal)

  for (let i = signalStart + 1; i < bars.length; i++) {
    signalVal = (macdLine[i]! - signalVal) * sigMult + signalVal
    result[i] = safe(macdLine[i]! - signalVal)
  }

  return result
}

/**
 * ATR ratio: ATR(period) / close. Normalized volatility measure.
 */
export function atrRatio(bars: OHLCV[], period: number): number[] {
  if (bars.length < period + 1) return new Array(bars.length).fill(0)
  const result: number[] = new Array(bars.length).fill(0)

  // True range
  const trValues: number[] = [0]
  for (let i = 1; i < bars.length; i++) {
    const highLow = bars[i]!.high - bars[i]!.low
    const highPrevClose = Math.abs(bars[i]!.high - bars[i - 1]!.close)
    const lowPrevClose = Math.abs(bars[i]!.low - bars[i - 1]!.close)
    trValues.push(Math.max(highLow, highPrevClose, lowPrevClose))
  }

  // Initial ATR as SMA of TR
  let atr = 0
  for (let i = 1; i <= period; i++) atr += trValues[i]!
  atr /= period
  result[period] = safe(safeDivide(atr, bars[period]!.close))

  // Smoothed ATR
  for (let i = period + 1; i < bars.length; i++) {
    atr = (atr * (period - 1) + trValues[i]!) / period
    result[i] = safe(safeDivide(atr, bars[i]!.close))
  }

  return result
}

/**
 * Bollinger Band width: (upper - lower) / middle.
 * Higher values indicate higher volatility.
 */
export function bbWidth(bars: OHLCV[], period: number): number[] {
  if (bars.length < period) return new Array(bars.length).fill(0)
  const result: number[] = new Array(bars.length).fill(0)
  const stddevMultiplier = 2

  for (let i = period - 1; i < bars.length; i++) {
    const window: number[] = []
    for (let j = i - period + 1; j <= i; j++) window.push(bars[j]!.close)
    const m = mean(window)
    const sd = stdDev(window, m)
    const upper = m + stddevMultiplier * sd
    const lower = m - stddevMultiplier * sd
    result[i] = safe(safeDivide(upper - lower, m))
  }

  return result
}

/**
 * Relative volume: current bar volume / average volume over period.
 * Values above 1 indicate above-average activity.
 */
export function rvolValue(bars: OHLCV[], period: number): number[] {
  if (bars.length < period) return new Array(bars.length).fill(1)
  const result: number[] = new Array(bars.length).fill(1)

  let volSum = 0
  for (let i = 0; i < period; i++) volSum += bars[i]!.volume

  for (let i = period - 1; i < bars.length; i++) {
    if (i > period - 1) {
      volSum += bars[i]!.volume - bars[i - period]!.volume
    }
    const avgVol = volSum / period
    result[i] = safe(safeDivide(bars[i]!.volume, avgVol))
  }

  return result
}

/**
 * OBV slope: direction of On-Balance Volume trend over period.
 * Positive = accumulation, negative = distribution.
 */
export function obvSlope(bars: OHLCV[], period: number): number[] {
  if (bars.length < 2) return new Array(bars.length).fill(0)
  const result: number[] = new Array(bars.length).fill(0)

  // Compute OBV series
  const obv: number[] = [0]
  for (let i = 1; i < bars.length; i++) {
    if (bars[i]!.close > bars[i - 1]!.close) {
      obv.push(obv[i - 1]! + bars[i]!.volume)
    } else if (bars[i]!.close < bars[i - 1]!.close) {
      obv.push(obv[i - 1]! - bars[i]!.volume)
    } else {
      obv.push(obv[i - 1]!)
    }
  }

  // OBV slope = linear regression slope over period, normalized by volume scale
  for (let i = period; i < bars.length; i++) {
    const startObv = obv[i - period]!
    const endObv = obv[i]!
    const avgVol = mean(bars.slice(i - period, i).map((b) => b.volume))
    result[i] = safe(safeDivide(endObv - startObv, avgVol * period))
  }

  return result
}

/**
 * N-bar return: (close[i] - close[i-n]) / close[i-n].
 * Used as a regression target.
 */
export function returnNBars(bars: OHLCV[], n: number): number[] {
  const result: number[] = new Array(bars.length).fill(0)
  for (let i = n; i < bars.length; i++) {
    result[i] = safe(safeDivide(bars[i]!.close - bars[i - n]!.close, bars[i - n]!.close))
  }
  return result
}

/**
 * Binary direction: 1 if price is higher N bars from now, 0 if lower.
 * Used as a classification target. For the last N bars, uses 0 as default.
 */
export function binaryDirection(bars: OHLCV[], n: number): number[] {
  const result: number[] = new Array(bars.length).fill(0)
  for (let i = 0; i < bars.length - n; i++) {
    result[i] = bars[i + n]!.close > bars[i]!.close ? 1 : 0
  }
  return result
}

// ---------------------------------------------------------------------------
// Feature extractor registry
// ---------------------------------------------------------------------------

type ExtractorFn = (bars: OHLCV[], ...params: number[]) => number[]

const EXTRACTORS: Record<string, ExtractorFn> = {
  smaRatio: (bars, period = 20) => smaRatio(bars, period),
  emaSlope: (bars, period = 12) => emaSlope(bars, period),
  rsi: (bars, period = 14) => rsiValue(bars, period),
  macdHistogram: (bars) => macdHistogram(bars),
  atrRatio: (bars, period = 14) => atrRatio(bars, period),
  bbWidth: (bars, period = 20) => bbWidth(bars, period),
  rvol: (bars, period = 20) => rvolValue(bars, period),
  obvSlope: (bars, period = 14) => obvSlope(bars, period),
  returnNBars: (bars, n = 5) => returnNBars(bars, n),
  binaryDirection: (bars, n = 5) => binaryDirection(bars, n),
}

function resolveExtractor(featureName: string): { fn: ExtractorFn; defaultParam: number } {
  // Parse feature name like "smaRatio_20" -> extractor=smaRatio, param=20
  const parts = featureName.split('_')
  const baseName = parts[0]!
  const paramVal = parts.length > 1 ? parseInt(parts[1]!, 10) : NaN

  // Try exact match first
  if (EXTRACTORS[featureName]) {
    return { fn: EXTRACTORS[featureName]!, defaultParam: 0 }
  }

  // Try base name
  if (EXTRACTORS[baseName]) {
    return { fn: EXTRACTORS[baseName]!, defaultParam: Number.isFinite(paramVal) ? paramVal : 0 }
  }

  throw new Error(`Unknown feature extractor: "${featureName}"`)
}

// ---------------------------------------------------------------------------
// FeatureEngineer class
// ---------------------------------------------------------------------------

export class FeatureEngineer {
  /**
   * Extract a feature matrix from OHLCV bars given a feature set definition.
   * Only returns rows where all features have valid (non-warmup) values.
   */
  extractFeatures(bars: OHLCV[], featureSet: FeatureSet): FeatureMatrix {
    if (bars.length === 0) {
      return { names: featureSet.features.map((f) => f.name), data: [] }
    }

    const columns: number[][] = []
    const names: string[] = []

    for (const feature of featureSet.features) {
      const { fn, defaultParam } = resolveExtractor(feature.name)
      const period = (feature.params.period as number) ?? defaultParam
      const values = period > 0 ? fn(bars, period) : fn(bars)
      columns.push(values)
      names.push(feature.name)
    }

    // Find the first index where all columns have non-zero values
    // (warmup period is over for all features)
    const numRows = bars.length
    const numCols = columns.length
    const data: number[][] = []

    for (let i = 0; i < numRows; i++) {
      const row: number[] = []
      for (let j = 0; j < numCols; j++) {
        row.push(columns[j]![i]!)
      }
      data.push(row)
    }

    return { names, data }
  }

  /**
   * Normalize a feature matrix using z-score or min-max normalization.
   * Normalizes column-wise (each feature independently).
   */
  normalizeFeatures(
    matrix: FeatureMatrix,
    method: NormalizationMethod,
  ): FeatureMatrix {
    if (method === 'none' || matrix.data.length === 0) {
      return matrix
    }

    const numCols = matrix.names.length
    const numRows = matrix.data.length
    const normalized: number[][] = matrix.data.map((row) => [...row])

    for (let col = 0; col < numCols; col++) {
      const colValues = matrix.data.map((row) => row[col]!)

      if (method === 'zscore') {
        const m = mean(colValues)
        const sd = stdDev(colValues, m)
        if (sd === 0) {
          // All values identical — set to 0
          for (let row = 0; row < numRows; row++) normalized[row]![col] = 0
        } else {
          for (let row = 0; row < numRows; row++) {
            normalized[row]![col] = safe((colValues[row]! - m) / sd)
          }
        }
      } else if (method === 'minmax') {
        const min = Math.min(...colValues)
        const max = Math.max(...colValues)
        const range = max - min
        if (range === 0) {
          for (let row = 0; row < numRows; row++) normalized[row]![col] = 0
        } else {
          for (let row = 0; row < numRows; row++) {
            normalized[row]![col] = safe((colValues[row]! - min) / range)
          }
        }
      }
    }

    return { names: matrix.names, data: normalized }
  }

  /**
   * Split features and targets into train/test sets with deterministic shuffle.
   * Uses a seeded Fisher-Yates shuffle for reproducibility.
   */
  splitTrainTest(
    features: number[][],
    targets: number[],
    ratio: number = 0.8,
  ): TrainTestSplit {
    if (features.length === 0 || features.length !== targets.length) {
      return {
        train: { features: [], targets: [] },
        test: { features: [], targets: [] },
      }
    }

    // Create index array and shuffle (deterministic with simple seed)
    const indices = Array.from({ length: features.length }, (_, i) => i)

    // Fisher-Yates shuffle with deterministic seed
    let seed = 42
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }

    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      const temp = indices[i]!
      indices[i] = indices[j]!
      indices[j] = temp
    }

    const splitIdx = Math.floor(features.length * ratio)

    const trainIndices = indices.slice(0, splitIdx)
    const testIndices = indices.slice(splitIdx)

    return {
      train: {
        features: trainIndices.map((i) => features[i]!),
        targets: trainIndices.map((i) => targets[i]!),
      },
      test: {
        features: testIndices.map((i) => features[i]!),
        targets: testIndices.map((i) => targets[i]!),
      },
    }
  }
}
