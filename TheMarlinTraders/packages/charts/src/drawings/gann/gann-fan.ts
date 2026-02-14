import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { pointToPixel, distanceToLine, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

// Gann fan angles: ratio of price units to time units
const GANN_ANGLES = [
  { ratio: 8, label: '8x1', color: '#ef4444' },
  { ratio: 4, label: '4x1', color: '#f59e0b' },
  { ratio: 3, label: '3x1', color: '#eab308' },
  { ratio: 2, label: '2x1', color: '#22c55e' },
  { ratio: 1, label: '1x1', color: '#3b82f6' },   // 45-degree line
  { ratio: 0.5, label: '1x2', color: '#22c55e' },
  { ratio: 1 / 3, label: '1x3', color: '#eab308' },
  { ratio: 0.25, label: '1x4', color: '#f59e0b' },
  { ratio: 0.125, label: '1x8', color: '#ef4444' },
]

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const baseAngle = Math.atan2(dy, dx)

  ctx.save()

  for (const angle of GANN_ANGLES) {
    // Scale the y-component by the ratio relative to the 1x1 line
    const scaledDy = dy * angle.ratio
    const len = Math.hypot(dx, scaledDy)
    if (len === 0) continue

    const extend = Math.max(ctx.canvas.width, ctx.canvas.height) * 2
    const endX = p1.x + (dx / len) * extend
    const endY = p1.y + (scaledDy / len) * extend

    ctx.strokeStyle = angle.color
    ctx.lineWidth = angle.ratio === 1 ? 2 : 1
    ctx.setLineDash(angle.ratio === 1 ? [] : [4, 3])

    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // Label
    const labelDist = 120
    const labelX = p1.x + (dx / len) * labelDist
    const labelY = p1.y + (scaledDy / len) * labelDist
    ctx.fillStyle = angle.color
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(angle.label, labelX + 4, labelY - 4)
  }

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const extend = 2000

  for (const angle of GANN_ANGLES) {
    const scaledDy = dy * angle.ratio
    const len = Math.hypot(dx, scaledDy)
    if (len === 0) continue

    const endX = p1.x + (dx / len) * extend
    const endY = p1.y + (scaledDy / len) * extend

    if (distanceToLine(px, py, p1.x, p1.y, endX, endY) <= HIT_TOLERANCE) return true
  }
  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'gann-fan',
  label: 'Gann Fan',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
