/**
 * Pattern Detection Engine
 * Sprints 31-32: AI Chart Analysis
 *
 * Detects chart patterns (H&S, double top/bottom, triangles, flags,
 * cup & handle, wedges, channels) from OHLCV bar data and returns
 * PatternDetection results sorted by confidence.
 */

import type { OHLCV } from '@marlin/shared'
import type {
  PatternDetection,
  PatternConfig,
  ChartPattern,
  PivotPoint,
} from '@marlin/shared'
import { DEFAULT_PATTERN_CONFIG, PATTERN_DIRECTIONS } from '@marlin/shared'
import {
  findPivotHighs,
  findPivotLows,
  fitTrendline,
  buildTrendline,
  isBrokenOut,
  hasVolumeConfirmation,
  avgVolume,
} from './pivots.js'

/**
 * Main entry point — run pattern detection on a bar series.
 */
export function detectPatterns(
  bars: OHLCV[],
  config?: PatternConfig,
): PatternDetection[] {
  const cfg: Required<PatternConfig> = { ...DEFAULT_PATTERN_CONFIG, ...config }

  if (bars.length < cfg.lookbackPeriod) {
    return []
  }

  const pivotHighs = findPivotHighs(bars, cfg.pivotPeriod)
  const pivotLows = findPivotLows(bars, cfg.pivotPeriod)

  const detections: PatternDetection[] = []

  for (const pattern of cfg.enabledPatterns) {
    const results = detectSinglePattern(bars, pattern, pivotHighs, pivotLows, cfg)
    detections.push(...results)
  }

  // Filter by minimum confidence and sort descending
  return detections
    .filter((d) => d.confidence >= cfg.minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
}

// ── Individual Pattern Detectors ───────────────────────────────────────────

function detectSinglePattern(
  bars: OHLCV[],
  pattern: ChartPattern,
  pivotHighs: PivotPoint[],
  pivotLows: PivotPoint[],
  cfg: Required<PatternConfig>,
): PatternDetection[] {
  switch (pattern) {
    case 'head_and_shoulders':
      return detectHeadAndShoulders(bars, pivotHighs, pivotLows, cfg, false)
    case 'inv_head_and_shoulders':
      return detectHeadAndShoulders(bars, pivotHighs, pivotLows, cfg, true)
    case 'double_top':
      return detectDoubleTopBottom(bars, pivotHighs, cfg, 'double_top')
    case 'double_bottom':
      return detectDoubleTopBottom(bars, pivotLows, cfg, 'double_bottom')
    case 'ascending_triangle':
      return detectTriangle(bars, pivotHighs, pivotLows, cfg, 'ascending_triangle')
    case 'descending_triangle':
      return detectTriangle(bars, pivotHighs, pivotLows, cfg, 'descending_triangle')
    case 'symmetrical_triangle':
      return detectTriangle(bars, pivotHighs, pivotLows, cfg, 'symmetrical_triangle')
    case 'bull_flag':
      return detectFlag(bars, pivotHighs, pivotLows, cfg, 'bull_flag')
    case 'bear_flag':
      return detectFlag(bars, pivotHighs, pivotLows, cfg, 'bear_flag')
    case 'cup_and_handle':
      return detectCupAndHandle(bars, pivotHighs, pivotLows, cfg)
    case 'rising_wedge':
      return detectWedge(bars, pivotHighs, pivotLows, cfg, 'rising_wedge')
    case 'falling_wedge':
      return detectWedge(bars, pivotHighs, pivotLows, cfg, 'falling_wedge')
    case 'channel_up':
      return detectChannel(bars, pivotHighs, pivotLows, cfg, 'channel_up')
    case 'channel_down':
      return detectChannel(bars, pivotHighs, pivotLows, cfg, 'channel_down')
  }
}

// ── Head & Shoulders ───────────────────────────────────────────────────────

function detectHeadAndShoulders(
  bars: OHLCV[],
  pivotHighs: PivotPoint[],
  pivotLows: PivotPoint[],
  cfg: Required<PatternConfig>,
  inverse: boolean,
): PatternDetection[] {
  const results: PatternDetection[] = []
  // For inverse H&S: use pivot lows as peaks (inverted), pivot highs for neckline
  const peaks = inverse ? pivotLows : pivotHighs
  const troughs = inverse ? pivotHighs : pivotLows

  if (peaks.length < 3 || troughs.length < 2) return results

  // Scan for 3 consecutive peaks where middle is the highest (or lowest for inverse)
  for (let i = 0; i <= peaks.length - 3; i++) {
    const leftShoulder = peaks[i]!
    const head = peaks[i + 1]!
    const rightShoulder = peaks[i + 2]!

    const isHead = inverse
      ? head.price < leftShoulder.price && head.price < rightShoulder.price
      : head.price > leftShoulder.price && head.price > rightShoulder.price

    if (!isHead) continue

    // Shoulders should be at roughly the same level
    const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price)
    const avgShoulder = (leftShoulder.price + rightShoulder.price) / 2
    if (avgShoulder === 0) continue
    const shoulderSymmetry = 1 - shoulderDiff / avgShoulder

    if (shoulderSymmetry < 1 - cfg.priceTolerance * 3) continue

    // Find neckline troughs between the peaks
    const necklineTroughs = troughs.filter(
      (t) => t.index > leftShoulder.index && t.index < rightShoulder.index,
    )
    if (necklineTroughs.length < 1) continue

    const necklinePrice = inverse
      ? Math.max(...necklineTroughs.map((t) => t.price))
      : Math.min(...necklineTroughs.map((t) => t.price))

    // Calculate confidence
    const headProminence = inverse
      ? (avgShoulder - head.price) / avgShoulder
      : (head.price - avgShoulder) / avgShoulder

    let confidence = 0.3
    confidence += Math.min(shoulderSymmetry * 0.3, 0.3)
    confidence += Math.min(headProminence * 2, 0.2)

    // Volume confirmation on right shoulder
    if (hasVolumeConfirmation(bars, rightShoulder.index, 20, 1.2)) {
      confidence += 0.1
    }

    // Breakout confirmation
    const patternHeight = inverse
      ? necklinePrice - head.price
      : head.price - necklinePrice

    const lastBar = bars[bars.length - 1]!
    const brokeNeckline = inverse
      ? lastBar.close > necklinePrice
      : lastBar.close < necklinePrice

    if (brokeNeckline) {
      confidence += 0.1
    }

    confidence = Math.min(confidence, 1)

    const priceTarget = inverse
      ? necklinePrice + patternHeight
      : necklinePrice - patternHeight

    const stopLoss = inverse
      ? head.price - patternHeight * 0.2
      : head.price + patternHeight * 0.2

    const keyPoints = [
      { time: leftShoulder.timestamp, price: leftShoulder.price },
      ...necklineTroughs.slice(0, 1).map((t) => ({ time: t.timestamp, price: t.price })),
      { time: head.timestamp, price: head.price },
      ...necklineTroughs.slice(-1).map((t) => ({ time: t.timestamp, price: t.price })),
      { time: rightShoulder.timestamp, price: rightShoulder.price },
    ]

    results.push({
      pattern: inverse ? 'inv_head_and_shoulders' : 'head_and_shoulders',
      confidence,
      startBar: leftShoulder.index,
      endBar: rightShoulder.index,
      keyPoints,
      priceTarget,
      stopLoss,
      direction: inverse ? 'bullish' : 'bearish',
    })
  }

  return results
}

// ── Double Top / Bottom ────────────────────────────────────────────────────

function detectDoubleTopBottom(
  bars: OHLCV[],
  pivots: PivotPoint[],
  cfg: Required<PatternConfig>,
  pattern: 'double_top' | 'double_bottom',
): PatternDetection[] {
  const results: PatternDetection[] = []
  const isTop = pattern === 'double_top'

  if (pivots.length < 2) return results

  for (let i = 0; i < pivots.length - 1; i++) {
    const first = pivots[i]!
    const second = pivots[i + 1]!

    // Two peaks/troughs must be at similar price levels
    const priceDiff = Math.abs(first.price - second.price)
    const avgPrice = (first.price + second.price) / 2
    if (avgPrice === 0) continue

    const similarity = 1 - priceDiff / avgPrice
    if (similarity < 1 - cfg.priceTolerance) continue

    // Must have a meaningful valley/peak between them
    const betweenBars = bars.slice(first.index, second.index + 1)
    if (betweenBars.length < 3) continue

    const midExtreme = isTop
      ? Math.min(...betweenBars.map((b) => b.low))
      : Math.max(...betweenBars.map((b) => b.high))

    const depth = isTop
      ? (avgPrice - midExtreme) / avgPrice
      : (midExtreme - avgPrice) / avgPrice

    if (depth < 0.01) continue // At least 1% depth

    // Confidence scoring
    let confidence = 0.35
    confidence += Math.min(similarity * 0.25, 0.25)
    confidence += Math.min(depth * 3, 0.2)

    // Volume on second peak should be lower (for double top) or higher (for double bottom)
    const vol1 = bars[first.index]?.volume ?? 0
    const vol2 = bars[second.index]?.volume ?? 0
    if (isTop && vol2 < vol1) {
      confidence += 0.1
    } else if (!isTop && vol2 > vol1) {
      confidence += 0.1
    }

    // Breakout check
    const lastBar = bars[bars.length - 1]!
    if (isTop && lastBar.close < midExtreme) {
      confidence += 0.1
    } else if (!isTop && lastBar.close > midExtreme) {
      confidence += 0.1
    }

    confidence = Math.min(confidence, 1)

    const patternHeight = Math.abs(avgPrice - midExtreme)
    const priceTarget = isTop
      ? midExtreme - patternHeight
      : midExtreme + patternHeight

    const stopLoss = isTop
      ? avgPrice + patternHeight * 0.2
      : avgPrice - patternHeight * 0.2

    results.push({
      pattern,
      confidence,
      startBar: first.index,
      endBar: second.index,
      keyPoints: [
        { time: first.timestamp, price: first.price },
        {
          time: bars[Math.floor((first.index + second.index) / 2)]!.timestamp,
          price: midExtreme,
        },
        { time: second.timestamp, price: second.price },
      ],
      priceTarget,
      stopLoss,
      direction: PATTERN_DIRECTIONS[pattern],
    })
  }

  return results
}

// ── Triangle Patterns ──────────────────────────────────────────────────────

function detectTriangle(
  bars: OHLCV[],
  pivotHighs: PivotPoint[],
  pivotLows: PivotPoint[],
  cfg: Required<PatternConfig>,
  pattern: 'ascending_triangle' | 'descending_triangle' | 'symmetrical_triangle',
): PatternDetection[] {
  const results: PatternDetection[] = []

  if (pivotHighs.length < 2 || pivotLows.length < 2) return results

  // Fit trendlines to highs and lows
  const highTrendline = buildTrendline(pivotHighs.slice(-4))
  const lowTrendline = buildTrendline(pivotLows.slice(-4))

  if (!highTrendline || !lowTrendline) return results

  const highSlope = highTrendline.slope
  const lowSlope = lowTrendline.slope

  let isMatch = false

  switch (pattern) {
    case 'ascending_triangle':
      // Flat top (near-zero high slope), rising lows
      isMatch = Math.abs(highSlope) < 0.1 && lowSlope > 0.05
      break
    case 'descending_triangle':
      // Flat bottom, descending highs
      isMatch = Math.abs(lowSlope) < 0.1 && highSlope < -0.05
      break
    case 'symmetrical_triangle':
      // Converging: highs descending, lows ascending
      isMatch = highSlope < -0.02 && lowSlope > 0.02
      break
  }

  if (!isMatch) return results

  // Check convergence — trendlines should meet at a point ahead
  const startIdx = Math.min(highTrendline.startIndex, lowTrendline.startIndex)
  const endIdx = Math.max(highTrendline.endIndex, lowTrendline.endIndex)

  // Confidence based on trendline fit quality
  let confidence = 0.3
  confidence += Math.min(highTrendline.r2 * 0.2, 0.2)
  confidence += Math.min(lowTrendline.r2 * 0.2, 0.2)

  // Check for breakout
  if (isBrokenOut(bars, highTrendline, 'up')) {
    confidence += 0.15
  } else if (isBrokenOut(bars, lowTrendline, 'down')) {
    confidence += 0.15
  }

  // Volume should decrease during consolidation
  const earlyAvgVol = avgVolume(bars, startIdx, Math.floor((startIdx + endIdx) / 2))
  const lateAvgVol = avgVolume(bars, Math.floor((startIdx + endIdx) / 2), endIdx)
  if (earlyAvgVol > 0 && lateAvgVol < earlyAvgVol) {
    confidence += 0.1
  }

  confidence = Math.min(confidence, 1)

  // Pattern height for price target
  const heightAtStart =
    (highTrendline.slope * startIdx + highTrendline.intercept) -
    (lowTrendline.slope * startIdx + lowTrendline.intercept)

  const lastBar = bars[bars.length - 1]!
  const direction = PATTERN_DIRECTIONS[pattern]
  const priceTarget = direction === 'bullish'
    ? lastBar.close + Math.abs(heightAtStart)
    : lastBar.close - Math.abs(heightAtStart)

  const stopLoss = direction === 'bullish'
    ? lowTrendline.slope * bars.length + lowTrendline.intercept
    : highTrendline.slope * bars.length + highTrendline.intercept

  // Build key points from the pivots used
  const allPivots = [...pivotHighs.slice(-3), ...pivotLows.slice(-3)]
    .filter((p) => p.index >= startIdx && p.index <= endIdx)
    .sort((a, b) => a.index - b.index)

  results.push({
    pattern,
    confidence,
    startBar: startIdx,
    endBar: endIdx,
    keyPoints: allPivots.map((p) => ({ time: p.timestamp, price: p.price })),
    priceTarget,
    stopLoss,
    direction,
  })

  return results
}

// ── Flag Patterns ──────────────────────────────────────────────────────────

function detectFlag(
  bars: OHLCV[],
  pivotHighs: PivotPoint[],
  pivotLows: PivotPoint[],
  cfg: Required<PatternConfig>,
  pattern: 'bull_flag' | 'bear_flag',
): PatternDetection[] {
  const results: PatternDetection[] = []
  const isBull = pattern === 'bull_flag'

  if (bars.length < cfg.lookbackPeriod) return results

  // Look for a sharp move (the pole) followed by a consolidation channel
  // Scan the last portion of bars
  const scanStart = Math.max(0, bars.length - cfg.lookbackPeriod * 2)

  for (let poleEnd = scanStart + 5; poleEnd < bars.length - 5; poleEnd++) {
    // Measure the pole: a strong move over 5-10 bars
    const poleStart = Math.max(scanStart, poleEnd - 10)
    const poleStartBar = bars[poleStart]!
    const poleEndBar = bars[poleEnd]!

    const poleMove = isBull
      ? (poleEndBar.close - poleStartBar.close) / poleStartBar.close
      : (poleStartBar.close - poleEndBar.close) / poleStartBar.close

    // Pole must be at least 3% move
    if (poleMove < 0.03) continue

    // Flag: consolidation channel after the pole
    const flagBars = bars.slice(poleEnd, Math.min(bars.length, poleEnd + 15))
    if (flagBars.length < 4) continue

    // The flag should slope against the pole direction
    const flagPoints = flagBars.map((b, idx) => ({ x: idx, y: (b.high + b.low) / 2 }))
    const { slope: flagSlope, r2: flagR2 } = fitTrendline(flagPoints)

    const slopeCorrect = isBull ? flagSlope < 0 : flagSlope > 0

    if (!slopeCorrect && Math.abs(flagSlope) > 0.1) continue

    // Flag channel should be tight (range < 50% of pole)
    const flagHigh = Math.max(...flagBars.map((b) => b.high))
    const flagLow = Math.min(...flagBars.map((b) => b.low))
    const flagRange = flagHigh - flagLow
    const poleHeight = Math.abs(poleEndBar.close - poleStartBar.close)

    if (flagRange > poleHeight * 0.5) continue

    let confidence = 0.35
    confidence += Math.min(poleMove * 3, 0.2) // Stronger pole = higher confidence
    confidence += Math.min(flagR2 * 0.15, 0.15)
    confidence += (1 - flagRange / poleHeight) * 0.15

    // Volume decreasing during flag
    const poleAvgVol = avgVolume(bars, poleStart, poleEnd)
    const flagAvgVol = avgVolume(bars, poleEnd, Math.min(bars.length - 1, poleEnd + flagBars.length - 1))
    if (poleAvgVol > 0 && flagAvgVol < poleAvgVol) {
      confidence += 0.1
    }

    confidence = Math.min(confidence, 1)

    const priceTarget = isBull
      ? flagHigh + poleHeight
      : flagLow - poleHeight

    const stopLoss = isBull ? flagLow : flagHigh

    results.push({
      pattern,
      confidence,
      startBar: poleStart,
      endBar: Math.min(bars.length - 1, poleEnd + flagBars.length - 1),
      keyPoints: [
        { time: poleStartBar.timestamp, price: isBull ? poleStartBar.low : poleStartBar.high },
        { time: poleEndBar.timestamp, price: isBull ? poleEndBar.high : poleEndBar.low },
        { time: flagBars[flagBars.length - 1]!.timestamp, price: isBull ? flagLow : flagHigh },
      ],
      priceTarget,
      stopLoss,
      direction: isBull ? 'bullish' : 'bearish',
    })

    // Only detect one flag per scan
    break
  }

  return results
}

// ── Cup & Handle ───────────────────────────────────────────────────────────

function detectCupAndHandle(
  bars: OHLCV[],
  pivotHighs: PivotPoint[],
  pivotLows: PivotPoint[],
  cfg: Required<PatternConfig>,
): PatternDetection[] {
  const results: PatternDetection[] = []

  if (pivotHighs.length < 2 || pivotLows.length < 1) return results

  // Look for two highs at similar levels (cup rim) with a low between them
  for (let i = 0; i < pivotHighs.length - 1; i++) {
    const leftRim = pivotHighs[i]!
    const rightRim = pivotHighs[i + 1]!

    // Rims should be at similar price levels
    const rimDiff = Math.abs(leftRim.price - rightRim.price)
    const avgRim = (leftRim.price + rightRim.price) / 2
    if (avgRim === 0) continue

    const rimSimilarity = 1 - rimDiff / avgRim
    if (rimSimilarity < 1 - cfg.priceTolerance * 2) continue

    // Find the deepest low between the rims (cup bottom)
    const cupLows = pivotLows.filter(
      (l) => l.index > leftRim.index && l.index < rightRim.index,
    )
    if (cupLows.length === 0) continue

    const cupBottom = cupLows.reduce((deepest, l) =>
      l.price < deepest.price ? l : deepest,
    )

    // Cup depth: should be 12-35% of price
    const cupDepth = (avgRim - cupBottom.price) / avgRim
    if (cupDepth < 0.05 || cupDepth > 0.5) continue

    // U-shape check: bottom should be roughly in the middle
    const cupWidth = rightRim.index - leftRim.index
    const bottomPosition = (cupBottom.index - leftRim.index) / cupWidth
    const isUShape = bottomPosition > 0.3 && bottomPosition < 0.7

    // Handle: small pullback after right rim (optional)
    const handleBars = bars.slice(rightRim.index, Math.min(bars.length, rightRim.index + Math.ceil(cupWidth * 0.3)))
    const handleLow = handleBars.length > 0 ? Math.min(...handleBars.map((b) => b.low)) : rightRim.price
    const handleDepth = (avgRim - handleLow) / avgRim
    const hasHandle = handleDepth > 0.01 && handleDepth < cupDepth * 0.5

    let confidence = 0.3
    confidence += isUShape ? 0.15 : 0
    confidence += Math.min(rimSimilarity * 0.2, 0.2)
    confidence += hasHandle ? 0.15 : 0
    confidence += Math.min(cupDepth * 1.5, 0.15)

    // Volume should dry up at the bottom and increase at breakout
    if (hasVolumeConfirmation(bars, rightRim.index, 20, 1.3)) {
      confidence += 0.05
    }

    confidence = Math.min(confidence, 1)

    const patternHeight = avgRim - cupBottom.price
    const priceTarget = avgRim + patternHeight
    const stopLoss = hasHandle ? handleLow : cupBottom.price

    const keyPoints = [
      { time: leftRim.timestamp, price: leftRim.price },
      { time: cupBottom.timestamp, price: cupBottom.price },
      { time: rightRim.timestamp, price: rightRim.price },
    ]

    if (hasHandle && handleBars.length > 0) {
      const handleBar = handleBars.find((b) => b.low === handleLow)
      if (handleBar) {
        keyPoints.push({ time: handleBar.timestamp, price: handleLow })
      }
    }

    results.push({
      pattern: 'cup_and_handle',
      confidence,
      startBar: leftRim.index,
      endBar: Math.min(bars.length - 1, rightRim.index + handleBars.length),
      keyPoints,
      priceTarget,
      stopLoss,
      direction: 'bullish',
    })
  }

  return results
}

// ── Wedge Patterns ─────────────────────────────────────────────────────────

function detectWedge(
  bars: OHLCV[],
  pivotHighs: PivotPoint[],
  pivotLows: PivotPoint[],
  cfg: Required<PatternConfig>,
  pattern: 'rising_wedge' | 'falling_wedge',
): PatternDetection[] {
  const results: PatternDetection[] = []
  const isRising = pattern === 'rising_wedge'

  if (pivotHighs.length < 2 || pivotLows.length < 2) return results

  const highTrendline = buildTrendline(pivotHighs.slice(-4))
  const lowTrendline = buildTrendline(pivotLows.slice(-4))

  if (!highTrendline || !lowTrendline) return results

  // Wedge: both trendlines slope in the same direction but converge
  const bothRising = highTrendline.slope > 0 && lowTrendline.slope > 0
  const bothFalling = highTrendline.slope < 0 && lowTrendline.slope < 0

  if (isRising && !bothRising) return results
  if (!isRising && !bothFalling) return results

  // The trendlines must converge (low slope steeper than high slope for rising,
  // high slope steeper than low slope for falling)
  const converging = isRising
    ? lowTrendline.slope > highTrendline.slope
    : highTrendline.slope > lowTrendline.slope

  if (!converging) return results

  const startIdx = Math.min(highTrendline.startIndex, lowTrendline.startIndex)
  const endIdx = Math.max(highTrendline.endIndex, lowTrendline.endIndex)

  let confidence = 0.3
  confidence += Math.min(highTrendline.r2 * 0.15, 0.15)
  confidence += Math.min(lowTrendline.r2 * 0.15, 0.15)

  // Breakout confirmation
  if (isRising && isBrokenOut(bars, lowTrendline, 'down')) {
    confidence += 0.2
  } else if (!isRising && isBrokenOut(bars, highTrendline, 'up')) {
    confidence += 0.2
  }

  // Volume declining
  const earlyVol = avgVolume(bars, startIdx, Math.floor((startIdx + endIdx) / 2))
  const lateVol = avgVolume(bars, Math.floor((startIdx + endIdx) / 2), endIdx)
  if (earlyVol > 0 && lateVol < earlyVol * 0.8) {
    confidence += 0.1
  }

  confidence = Math.min(confidence, 1)

  const heightAtStart = Math.abs(
    (highTrendline.slope * startIdx + highTrendline.intercept) -
    (lowTrendline.slope * startIdx + lowTrendline.intercept),
  )

  const lastBar = bars[bars.length - 1]!
  const direction = PATTERN_DIRECTIONS[pattern]
  const priceTarget = direction === 'bullish'
    ? lastBar.close + heightAtStart
    : lastBar.close - heightAtStart

  const allPivots = [...pivotHighs.slice(-3), ...pivotLows.slice(-3)]
    .filter((p) => p.index >= startIdx && p.index <= endIdx)
    .sort((a, b) => a.index - b.index)

  results.push({
    pattern,
    confidence,
    startBar: startIdx,
    endBar: endIdx,
    keyPoints: allPivots.map((p) => ({ time: p.timestamp, price: p.price })),
    priceTarget,
    stopLoss: isRising
      ? lowTrendline.slope * endIdx + lowTrendline.intercept
      : highTrendline.slope * endIdx + highTrendline.intercept,
    direction,
  })

  return results
}

// ── Channel Patterns ───────────────────────────────────────────────────────

function detectChannel(
  bars: OHLCV[],
  pivotHighs: PivotPoint[],
  pivotLows: PivotPoint[],
  cfg: Required<PatternConfig>,
  pattern: 'channel_up' | 'channel_down',
): PatternDetection[] {
  const results: PatternDetection[] = []
  const isUp = pattern === 'channel_up'

  if (pivotHighs.length < 2 || pivotLows.length < 2) return results

  const highTrendline = buildTrendline(pivotHighs.slice(-4))
  const lowTrendline = buildTrendline(pivotLows.slice(-4))

  if (!highTrendline || !lowTrendline) return results

  // Channel: both trendlines slope in the same direction, roughly parallel
  const bothDirection = isUp
    ? highTrendline.slope > 0.01 && lowTrendline.slope > 0.01
    : highTrendline.slope < -0.01 && lowTrendline.slope < -0.01

  if (!bothDirection) return results

  // Check parallelism: slope difference should be small relative to average slope
  const avgSlope = (Math.abs(highTrendline.slope) + Math.abs(lowTrendline.slope)) / 2
  if (avgSlope === 0) return results

  const slopeDiff = Math.abs(highTrendline.slope - lowTrendline.slope)
  const parallelism = 1 - slopeDiff / avgSlope

  if (parallelism < 0.5) return results

  const startIdx = Math.min(highTrendline.startIndex, lowTrendline.startIndex)
  const endIdx = Math.max(highTrendline.endIndex, lowTrendline.endIndex)

  let confidence = 0.3
  confidence += Math.min(parallelism * 0.2, 0.2)
  confidence += Math.min(highTrendline.r2 * 0.15, 0.15)
  confidence += Math.min(lowTrendline.r2 * 0.15, 0.15)

  // Channel must span at least some bars
  if (endIdx - startIdx > cfg.lookbackPeriod * 0.5) {
    confidence += 0.1
  }

  confidence = Math.min(confidence, 1)

  const channelHeight = Math.abs(
    (highTrendline.slope * endIdx + highTrendline.intercept) -
    (lowTrendline.slope * endIdx + lowTrendline.intercept),
  )

  const lastBar = bars[bars.length - 1]!
  const direction = PATTERN_DIRECTIONS[pattern]
  const priceTarget = direction === 'bullish'
    ? lastBar.close + channelHeight
    : lastBar.close - channelHeight

  const allPivots = [...pivotHighs.slice(-3), ...pivotLows.slice(-3)]
    .filter((p) => p.index >= startIdx && p.index <= endIdx)
    .sort((a, b) => a.index - b.index)

  results.push({
    pattern,
    confidence,
    startBar: startIdx,
    endBar: endIdx,
    keyPoints: allPivots.map((p) => ({ time: p.timestamp, price: p.price })),
    priceTarget,
    stopLoss: isUp
      ? lowTrendline.slope * endIdx + lowTrendline.intercept
      : highTrendline.slope * endIdx + highTrendline.intercept,
    direction,
  })

  return results
}
