import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, distanceToLine, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 3) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)
  const p3 = pointToPixel(drawing.points[2], mapper)

  // Channel: line p1-p2 + parallel line through p3
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const offsetX = p3.x - p1.x
  const offsetY = p3.y - p1.y

  // Project p3 onto normal of p1-p2
  const len = Math.hypot(dx, dy)
  if (len === 0) return
  const nx = -dy / len
  const ny = dx / len
  const dist = offsetX * nx + offsetY * ny

  const p3a = { x: p1.x + nx * dist, y: p1.y + ny * dist }
  const p4a = { x: p2.x + nx * dist, y: p2.y + ny * dist }

  ctx.save()
  applyLineStyle(ctx, drawing.style)

  // Top line
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()

  // Bottom line (parallel)
  ctx.beginPath()
  ctx.moveTo(p3a.x, p3a.y)
  ctx.lineTo(p4a.x, p4a.y)
  ctx.stroke()

  // Fill
  if (drawing.style.fillColor) {
    ctx.fillStyle = drawing.style.fillColor
    ctx.globalAlpha = drawing.style.fillOpacity ?? 0.1
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.lineTo(p4a.x, p4a.y)
    ctx.lineTo(p3a.x, p3a.y)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 3) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)
  const p3 = pointToPixel(drawing.points[2], mapper)

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return false

  const nx = -dy / len
  const ny = dx / len
  const dist = (p3.x - p1.x) * nx + (p3.y - p1.y) * ny
  const p3a = { x: p1.x + nx * dist, y: p1.y + ny * dist }
  const p4a = { x: p2.x + nx * dist, y: p2.y + ny * dist }

  return (
    distanceToLine(px, py, p1.x, p1.y, p2.x, p2.y) <= HIT_TOLERANCE ||
    distanceToLine(px, py, p3a.x, p3a.y, p4a.x, p4a.y) <= HIT_TOLERANCE
  )
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'parallel-channel',
  label: 'Parallel Channel',
  minPoints: 3,
  maxPoints: 3,
  render,
  hitTest,
  getHandles,
})
