/**
 * Wave energy computation from swell components.
 *
 * Formula: E = rho * g * H^2 * T / 16
 * where rho = 1025 kg/m^3, g = 9.81 m/s^2, H in meters, T in seconds
 * Result in kJ (joules / 1000).
 *
 * Height input is in feet; converted internally to meters (* 0.3048).
 */

import type { SwellInput } from '../types'

const RHO = 1025  // seawater density (kg/m^3)
const G = 9.81    // gravitational acceleration (m/s^2)
const FT_TO_M = 0.3048

/**
 * Compute total wave energy from one or more swell components.
 * Returns energy in kilojoules (kJ).
 */
export function computeEnergy(swells: SwellInput[]): number {
  if (swells.length === 0) return 0

  let totalEnergy = 0

  for (const swell of swells) {
    if (swell.heightFt <= 0) continue

    const heightM = swell.heightFt * FT_TO_M
    const energy = (RHO * G * heightM * heightM * swell.periodSeconds) / 16
    totalEnergy += energy
  }

  // Convert joules to kilojoules, round to 1 decimal
  return Math.round((totalEnergy / 1000) * 10) / 10
}
