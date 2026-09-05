import type { GpsTrackPoint, DetectedWave, WaveDetectionOptions } from '../types'
import { angleDifference } from './directions'
import { haversineDistance } from './geo'

const METERS_PER_SECOND_TO_KNOTS = 1.94384449

function speedMpsToKts(speedMps: number): number {
  return speedMps * METERS_PER_SECOND_TO_KNOTS
}

function segmentDurationSeconds(start: string, end: string): number {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 1000)
}

function computeBearingDegrees(from: GpsTrackPoint, to: GpsTrackPoint): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const toDegrees = (radians: number) => (radians * 180) / Math.PI

  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(to.latitude)
  const dLng = toRadians(to.longitude - from.longitude)

  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)

  const bearing = toDegrees(Math.atan2(y, x))
  return (bearing + 360) % 360
}

function pointSpeedKts(
  points: GpsTrackPoint[],
  index: number,
): number {
  const point = points[index]
  if (!point) return 0
  if (point.speedMps != null && point.speedMps >= 0) {
    return speedMpsToKts(point.speedMps)
  }

  const previous = points[index - 1]
  if (!previous) return 0

  const dtSeconds = segmentDurationSeconds(previous.timestamp, point.timestamp)
  if (dtSeconds <= 0) return 0

  const distanceKm = haversineDistance(
    previous.latitude,
    previous.longitude,
    point.latitude,
    point.longitude,
  )
  const distanceMeters = distanceKm * 1000
  return speedMpsToKts(distanceMeters / dtSeconds)
}

function segmentDistanceMeters(points: GpsTrackPoint[]): number {
  let totalMeters = 0
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const curr = points[i]!
    totalMeters += haversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude,
    ) * 1000
  }
  return totalMeters
}

function headingAt(points: GpsTrackPoint[], index: number): number | null {
  const point = points[index]
  if (!point) return null
  if (point.headingDegrees != null) return point.headingDegrees

  const next = points[index + 1]
  if (!next) return null
  return computeBearingDegrees(point, next)
}

export function detectWaves(
  inputPoints: GpsTrackPoint[],
  options: WaveDetectionOptions = {},
): DetectedWave[] {
  if (inputPoints.length < 2) return []

  const points = [...inputPoints].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const minSpeedKts = options.minSpeedKts ?? 5
  const minDurationSeconds = options.minDurationSeconds ?? 3
  const minDirectionChangeDegrees = options.minDirectionChangeDegrees ?? 12

  const waves: DetectedWave[] = []
  let segmentStart = -1

  for (let i = 0; i < points.length; i++) {
    const speedKts = pointSpeedKts(points, i)
    const aboveThreshold = speedKts >= minSpeedKts

    if (aboveThreshold && segmentStart < 0) {
      segmentStart = i
      continue
    }

    const segmentEnded = !aboveThreshold && segmentStart >= 0
    const isLastPointInSegment = segmentStart >= 0 && i === points.length - 1 && aboveThreshold

    if (!segmentEnded && !isLastPointInSegment) {
      continue
    }

    const segmentEnd = segmentEnded ? i - 1 : i
    const segmentPoints = points.slice(segmentStart, segmentEnd + 1)

    if (segmentPoints.length >= 2) {
      const startTime = segmentPoints[0]!.timestamp
      const endTime = segmentPoints[segmentPoints.length - 1]!.timestamp
      const durationSeconds = segmentDurationSeconds(startTime, endTime)
      const maxSpeedKts = segmentPoints.reduce((max, _point, idx) => {
        const pointIndex = segmentStart + idx
        return Math.max(max, pointSpeedKts(points, pointIndex))
      }, 0)
      const distanceMeters = segmentDistanceMeters(segmentPoints)
      const startHeading = headingAt(points, segmentStart)
      const endHeading = headingAt(points, Math.max(segmentEnd - 1, segmentStart))
      const directionChange =
        startHeading == null || endHeading == null
          ? minDirectionChangeDegrees
          : angleDifference(startHeading, endHeading)

      if (
        durationSeconds >= minDurationSeconds &&
        directionChange >= minDirectionChangeDegrees
      ) {
        waves.push({
          startTime,
          endTime,
          durationSeconds,
          maxSpeedKts: Math.round(maxSpeedKts * 10) / 10,
          distanceMeters: Math.round(distanceMeters * 10) / 10,
          startIndex: segmentStart,
          endIndex: segmentEnd,
        })
      }
    }

    segmentStart = -1
  }

  return waves
}
