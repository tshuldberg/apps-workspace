export interface VolumeConditionInput {
  currentVolume: number
  threshold: number
}

export interface RvolConditionInput {
  currentVolume: number
  averageVolume: number
  threshold: number
}

/** Volume exceeds a fixed threshold */
export function volumeAbove({ currentVolume, threshold }: VolumeConditionInput): boolean {
  return currentVolume >= threshold
}

/** Relative volume (current / average) exceeds threshold multiplier */
export function rvolAbove({ currentVolume, averageVolume, threshold }: RvolConditionInput): boolean {
  if (averageVolume <= 0) return false
  const rvol = currentVolume / averageVolume
  return rvol >= threshold
}
