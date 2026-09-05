/**
 * Direction and angle utility functions for surf forecast calculations.
 * All angles use meteorological convention (degrees from true north, clockwise).
 */

const COMPASS_LABELS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const

/**
 * Compute the shortest angular difference between two bearings.
 * Always returns a value between 0 and 180 degrees.
 */
export function angleDifference(a: number, b: number): number {
  const diff = Math.abs(((a % 360) + 360) % 360 - ((b % 360) + 360) % 360) % 360
  return diff > 180 ? 360 - diff : diff
}

/**
 * Convert a bearing in degrees to a 16-point compass label.
 * e.g. 290 -> 'WNW', 0 -> 'N', 180 -> 'S'
 */
export function degreesToCompass(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360
  const index = Math.round(normalized / 22.5) % 16
  return COMPASS_LABELS[index] ?? 'N'
}

/**
 * Compute how well an incoming swell direction fits a spot's ideal swell window.
 * Returns a score from 0 (no energy reaching spot) to 1 (perfect alignment).
 *
 * Handles wrap-around ideal windows (e.g., min=330, max=30).
 */
export function computeDirectionFit(
  swellDirDeg: number,
  idealMin: number,
  idealMax: number,
  _orientationDeg: number,
): number {
  const swellDir = ((swellDirDeg % 360) + 360) % 360

  // Check if swell direction is within ideal window (handles wrap-around)
  let inWindow: boolean
  if (idealMin <= idealMax) {
    inWindow = swellDir >= idealMin && swellDir <= idealMax
  } else {
    inWindow = swellDir >= idealMin || swellDir <= idealMax
  }

  if (inWindow) return 1.0

  // Compute distance from nearest edge of ideal window
  const distToMin = angleDifference(swellDir, idealMin)
  const distToMax = angleDifference(swellDir, idealMax)
  const distFromWindow = Math.min(distToMin, distToMax)

  // Gradual falloff outside the ideal window
  if (distFromWindow <= 15) return 0.85
  if (distFromWindow <= 30) return 0.6
  if (distFromWindow <= 60) return 0.3
  return 0.05
}
