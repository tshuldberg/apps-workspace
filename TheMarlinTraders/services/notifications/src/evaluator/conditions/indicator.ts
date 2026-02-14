import type { OHLCV } from '@marlin/shared'
import { computeIndicator } from '@marlin/shared'

export interface IndicatorConditionInput {
  data: OHLCV[]
}

/** RSI is above the threshold (overbought) */
export function rsiAbove(input: IndicatorConditionInput, threshold: number): boolean {
  const result = computeIndicator('rsi', input.data) as number[]
  const lastValid = getLastValid(result)
  return lastValid !== null && lastValid >= threshold
}

/** RSI is below the threshold (oversold) */
export function rsiBelow(input: IndicatorConditionInput, threshold: number): boolean {
  const result = computeIndicator('rsi', input.data) as number[]
  const lastValid = getLastValid(result)
  return lastValid !== null && lastValid <= threshold
}

/** MACD line crosses above signal line */
export function macdCrossover(input: IndicatorConditionInput): boolean {
  const result = computeIndicator('macd', input.data) as {
    macd: number[]
    signal: number[]
    histogram: number[]
  }
  const len = result.macd.length
  if (len < 2) return false

  const prevMacd = result.macd[len - 2]
  const prevSignal = result.signal[len - 2]
  const currMacd = result.macd[len - 1]
  const currSignal = result.signal[len - 1]

  if (isNaN(prevMacd) || isNaN(prevSignal) || isNaN(currMacd) || isNaN(currSignal)) {
    return false
  }

  // Crossover: MACD was below signal, now above
  return prevMacd <= prevSignal && currMacd > currSignal
}

/** Moving average crossover: short MA crosses above long MA */
export function maCrossover(input: IndicatorConditionInput, shortPeriod = 9, longPeriod = 21): boolean {
  const shortMa = computeIndicator('ema', input.data, { period: shortPeriod }) as number[]
  const longMa = computeIndicator('ema', input.data, { period: longPeriod }) as number[]
  const len = shortMa.length
  if (len < 2) return false

  const prevShort = shortMa[len - 2]
  const prevLong = longMa[len - 2]
  const currShort = shortMa[len - 1]
  const currLong = longMa[len - 1]

  if (isNaN(prevShort) || isNaN(prevLong) || isNaN(currShort) || isNaN(currLong)) {
    return false
  }

  return prevShort <= prevLong && currShort > currLong
}

function getLastValid(values: number[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (!isNaN(values[i])) return values[i]
  }
  return null
}
