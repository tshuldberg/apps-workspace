/**
 * Tide scoring for surf conditions.
 *
 * Spot type sensitivity:
 *   - reef: very tide-critical (wrong tide = dangerous or unsurfable)
 *   - point: moderate (tide affects shape but rarely kills it)
 *   - beach: most tolerant (always something to ride)
 *
 * Score decays based on distance outside ideal range multiplied by sensitivity.
 * Minimum score is 0.2 (even extreme tides don't fully zero out).
 */

import type { SurfBreakType } from '../types'

/**
 * Score tide quality for a given spot (0.2-1.0).
 *
 * @param currentTideFt - Current tide height in feet (MLLW datum)
 * @param idealLow - Spot's ideal low tide boundary
 * @param idealHigh - Spot's ideal high tide boundary
 * @param spotType - Spot type determines tide sensitivity
 */
export function scoreTide(
  currentTideFt: number,
  idealLow: number,
  idealHigh: number,
  spotType: SurfBreakType,
): number {
  // In ideal range
  if (currentTideFt >= idealLow && currentTideFt <= idealHigh) return 1.0

  // How far outside the ideal range
  const distOutside = currentTideFt < idealLow
    ? idealLow - currentTideFt
    : currentTideFt - idealHigh

  // Spot type sensitivity multiplier
  const sensitivity = spotType === 'reef' ? 2.0
    : spotType === 'point' ? 1.0
    : 0.5 // beach (and other types)

  // Score decays: 1ft outside = penalty of 0.15 * sensitivity
  const penalty = Math.min(0.6, distOutside * 0.15 * sensitivity)
  return Math.max(0.2, 1.0 - penalty)
}
