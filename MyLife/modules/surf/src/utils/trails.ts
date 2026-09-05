import type { TrailTrackPoint, TrailSummary } from '../types'
import { haversineDistance } from './geo'

export function computeTrackDistanceMeters(points: TrailTrackPoint[]): number {
  if (points.length < 2) return 0

  let distanceMeters = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const curr = points[i]!
    distanceMeters += haversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude,
    ) * 1000
  }

  return distanceMeters
}

export function computeElevationGainLoss(points: TrailTrackPoint[]): {
  gainMeters: number
  lossMeters: number
} {
  let gainMeters = 0
  let lossMeters = 0

  for (let i = 1; i < points.length; i++) {
    const prevElevation = points[i - 1]!.elevationMeters
    const currElevation = points[i]!.elevationMeters
    if (prevElevation == null || currElevation == null) continue

    const delta = currElevation - prevElevation
    if (delta > 0) gainMeters += delta
    if (delta < 0) lossMeters += Math.abs(delta)
  }

  return { gainMeters, lossMeters }
}

export function computeDurationSeconds(points: TrailTrackPoint[]): number {
  if (points.length < 2) return 0
  const start = new Date(points[0]!.timestamp).getTime()
  const end = new Date(points[points.length - 1]!.timestamp).getTime()
  return Math.max(0, (end - start) / 1000)
}

export function computePaceMinutesPerKm(
  distanceMeters: number,
  durationSeconds: number,
): number {
  if (distanceMeters <= 0 || durationSeconds <= 0) return 0
  const distanceKm = distanceMeters / 1000
  return (durationSeconds / 60) / distanceKm
}

export function summarizeTrail(points: TrailTrackPoint[]): TrailSummary {
  const distanceMeters = computeTrackDistanceMeters(points)
  const durationSeconds = computeDurationSeconds(points)
  const { gainMeters, lossMeters } = computeElevationGainLoss(points)

  return {
    distanceMeters: Math.round(distanceMeters * 10) / 10,
    durationSeconds: Math.round(durationSeconds),
    elevationGainMeters: Math.round(gainMeters * 10) / 10,
    elevationLossMeters: Math.round(lossMeters * 10) / 10,
    paceMinutesPerKm: Math.round(computePaceMinutesPerKm(distanceMeters, durationSeconds) * 100) / 100,
  }
}
