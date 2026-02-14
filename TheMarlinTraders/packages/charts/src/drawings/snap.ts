import type { Point, CoordinateMapper } from './framework.js'

export interface SnapTarget {
  time: number
  open: number
  high: number
  low: number
  close: number
}

const SNAP_THRESHOLD_PX = 12

export function snapToOHLC(
  point: Point,
  mapper: CoordinateMapper,
  targets: SnapTarget[],
): Point {
  if (targets.length === 0) return point

  const px = mapper.timeToX(point.time)
  const py = mapper.priceToY(point.price)

  let bestDist = SNAP_THRESHOLD_PX
  let snappedPoint = point

  for (const target of targets) {
    const tx = mapper.timeToX(target.time)
    const xDist = Math.abs(px - tx)
    if (xDist > SNAP_THRESHOLD_PX * 2) continue

    const prices = [target.open, target.high, target.low, target.close]
    for (const price of prices) {
      const ty = mapper.priceToY(price)
      const dist = Math.hypot(px - tx, py - ty)
      if (dist < bestDist) {
        bestDist = dist
        snappedPoint = { time: target.time, price }
      }
    }
  }

  return snappedPoint
}

export function getVisibleSnapTargets(
  targets: SnapTarget[],
  mapper: CoordinateMapper,
  canvasWidth: number,
): SnapTarget[] {
  return targets.filter((t) => {
    const x = mapper.timeToX(t.time)
    return x >= -50 && x <= canvasWidth + 50
  })
}
