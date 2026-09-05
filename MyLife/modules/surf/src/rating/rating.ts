/**
 * Spot rating algorithm.
 *
 * Computes a 1-5 star rating for surf conditions at a specific spot.
 *
 * Weight distribution:
 *   swellScore * 0.45 + windScore * 0.30 + tideScore * 0.15 + consistencyScore * 0.10
 *
 * Star mapping: raw 0-1 score scaled to 1-5, then clamped.
 * Color mapping: 1=red, 2=orange, 3=yellow, 4=green, 5=teal
 */

import type { SpotProfile, SwellInput, ForecastInput, RatingResult, ConditionColor } from '../types'
import { angleDifference, computeDirectionFit } from '../utils/directions'
import { windScore as computeWindScore } from './wind'
import { scoreTide } from './tide'

// ── Swell sub-scoring ────────────────────────────────────────────

function sizeScore(heightFt: number): number {
  if (heightFt < 0.5) return 0
  if (heightFt < 1.0) return 0.2
  if (heightFt < 2.0) return 0.4 + (heightFt - 1.0) * 0.2
  if (heightFt < 3.0) return 0.8
  if (heightFt <= 6.0) return 1.0
  if (heightFt <= 10.0) return 0.9
  return 0.7
}

function periodQuality(periodSeconds: number): number {
  if (periodSeconds >= 16) return 1.0
  if (periodSeconds >= 12) return 0.85
  if (periodSeconds >= 8) return 0.6
  return 0.35
}

function computeSwellScore(swells: SwellInput[], spot: SpotProfile): number {
  if (swells.length === 0) return 0

  // Sort by energy (height^2 * period), descending
  const sorted = swells
    .map(s => ({
      ...s,
      energy: s.heightFt ** 2 * s.periodSeconds,
    }))
    .sort((a, b) => b.energy - a.energy)

  // Weighted multi-component scoring
  const weights = [0.65, 0.25, 0.10]

  let totalScore = 0
  const capped = sorted.slice(0, 3)

  for (let i = 0; i < capped.length; i++) {
    const swell = capped[i]!
    const weight = weights[i] ?? 0

    const dirFit = computeDirectionFit(
      swell.directionDegrees,
      spot.idealSwellDirMin,
      spot.idealSwellDirMax,
      spot.orientationDegrees,
    )

    const pq = periodQuality(swell.periodSeconds)
    const sz = sizeScore(swell.heightFt)

    // Spot type refraction modifier
    const refractionMod = spot.spotType === 'point' ? 1.15
      : spot.spotType === 'reef' ? 1.0
      : 0.9 // beach (and other types)

    const componentScore = dirFit * pq * sz * refractionMod
    totalScore += componentScore * weight
  }

  // Cross-swell interference penalty
  if (capped.length >= 2) {
    const dirDiff = angleDifference(
      capped[0]!.directionDegrees,
      capped[1]!.directionDegrees,
    )
    const secondaryRatio = capped[1]!.energy / capped[0]!.energy
    if (dirDiff > 60 && secondaryRatio > 0.3) {
      const penalty = 0.1 * (dirDiff / 180) * secondaryRatio
      totalScore *= (1 - penalty)
    }
  }

  return Math.min(1.0, totalScore)
}

// ── Main rating function ─────────────────────────────────────────

export function computeSpotRating(spot: SpotProfile, forecast: ForecastInput): RatingResult {
  const swellScore = computeSwellScore(forecast.swellComponents, spot)

  const wind = computeWindScore(
    forecast.windSpeedKts,
    forecast.windDirectionDegrees,
    spot.orientationDegrees,
  )

  const tide = scoreTide(
    forecast.tideHeightFt,
    spot.idealTideLow,
    spot.idealTideHigh,
    spot.spotType,
  )

  const consistency = Math.min(1.0, Math.max(0, forecast.consistency))

  // Flat override: no swell = 1 star regardless of other factors
  if (forecast.swellComponents.length === 0) {
    return {
      stars: 1,
      color: starsToColor(1),
      swellScore: 0,
      windScore: wind,
      tideScore: tide,
      consistencyScore: consistency,
    }
  }

  // Weighted combination
  const rawScore = swellScore * 0.45 + wind * 0.30 + tide * 0.15 + consistency * 0.10

  // Wind quality gate: strong onshore caps maximum rating
  // Even great swell can't overcome truly blown-out conditions
  const windCap = wind < 0.15 ? 2 : wind < 0.30 ? 3 : 5

  // Map raw score to stars using thresholds tuned to CA conditions:
  //   < 0.30 -> 1 star (flat/terrible)
  //   < 0.50 -> 2 stars (poor)
  //   < 0.75 -> 3 stars (fair)
  //   < 0.83 -> 4 stars (good: clean swell + offshore)
  //   >= 0.83 -> 5 stars (epic: large swell + long period + glassy + ideal tide)
  let rawStars: number
  if (rawScore < 0.30) rawStars = 1
  else if (rawScore < 0.50) rawStars = 2
  else if (rawScore < 0.75) rawStars = 3
  else if (rawScore < 0.83) rawStars = 4
  else rawStars = 5

  const stars = Math.max(1, Math.min(5, Math.min(rawStars, windCap)))

  return {
    stars,
    color: starsToColor(stars),
    swellScore,
    windScore: wind,
    tideScore: tide,
    consistencyScore: consistency,
  }
}

// ── Color mapping ────────────────────────────────────────────────

const COLOR_MAP: Record<number, ConditionColor> = {
  1: 'red',
  2: 'orange',
  3: 'yellow',
  4: 'green',
  5: 'teal',
}

export function starsToColor(stars: number): ConditionColor {
  const clamped = Math.max(1, Math.min(5, stars))
  return COLOR_MAP[clamped] ?? 'red'
}
