/**
 * Wind classification and scoring for surf conditions.
 *
 * Wind angle is measured as the difference between wind direction
 * and the spot's beach orientation:
 *   - 150-180 deg: offshore (wind from land toward sea)
 *   - 120-149 deg: cross-offshore
 *   - 80-119 deg:  cross-shore (perpendicular)
 *   - 45-79 deg:   cross-onshore
 *   - 0-44 deg:    onshore (wind from sea toward land)
 *
 * Light wind (< 5 kts) always classified as 'light' regardless of direction.
 */

import type { WindLabel } from '../types'
import { angleDifference } from '../utils/directions'

/**
 * Classify wind relative to beach orientation.
 */
export function classifyWind(
  windDirDeg: number,
  spotOrientationDeg: number,
  windSpeedKts: number,
): WindLabel {
  if (windSpeedKts < 5) return 'light'

  const windAngle = angleDifference(windDirDeg, spotOrientationDeg)

  if (windAngle >= 150) return 'offshore'
  if (windAngle >= 120) return 'cross-offshore'
  if (windAngle >= 80) return 'cross-shore'
  if (windAngle >= 45) return 'cross-onshore'
  return 'onshore'
}

/**
 * Score wind quality for surfing (0-1).
 *
 * Factors:
 *   - Direction relative to beach orientation
 *   - Wind speed (strong onshore worse, very strong offshore slightly penalized)
 */
export function windScore(
  windSpeedKts: number,
  windDirDeg: number,
  spotOrientationDeg: number,
): number {
  const windAngle = angleDifference(windDirDeg, spotOrientationDeg)

  // Calm conditions
  if (windSpeedKts < 3) return 1.0
  if (windSpeedKts < 5) return 0.95

  // Base score by direction category
  let baseScore: number
  if (windAngle >= 150) {
    baseScore = 1.0  // offshore
  } else if (windAngle >= 120) {
    baseScore = 0.85 // cross-offshore
  } else if (windAngle >= 80) {
    baseScore = 0.55 // cross-shore
  } else if (windAngle >= 45) {
    baseScore = 0.3  // cross-onshore
  } else {
    baseScore = 0.1  // direct onshore
  }

  // Speed modifier
  if (windAngle >= 120) {
    // Offshore: light is best, strong is still okay but can make takeoffs tricky
    if (windSpeedKts > 20) baseScore *= 0.8
    else if (windSpeedKts > 15) baseScore *= 0.9
  } else {
    // Onshore/cross: stronger = worse
    if (windSpeedKts > 20) baseScore *= 0.5
    else if (windSpeedKts > 15) baseScore *= 0.7
    else if (windSpeedKts > 10) baseScore *= 0.85
  }

  return baseScore
}
