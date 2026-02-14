import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, distanceToLine, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  // Extend p2 to the edge of canvas
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const canvasWidth = ctx.canvas.width
  const canvasHeight = ctx.canvas.height

  let extX = p2.x
  let extY = p2.y

  if (dx !== 0 || dy !== 0) {
    const scale = Math.max(canvasWidth, canvasHeight) * 2
    const len = Math.hypot(dx, dy)
    extX = p1.x + (dx / len) * scale
    extY = p1.y + (dy / len) * scale
  }

  ctx.save()
  applyLineStyle(ctx, drawing.style)
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(extX, extY)
  ctx.stroke()
  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  // Check if point is on the ray side (not behind p1)
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const t = dx !== 0 || dy !== 0
    ? ((px - p1.x) * dx + (py - p1.y) * dy) / (dx * dx + dy * dy)
    : 0

  if (t < 0) return false

  const projX = p1.x + t * dx
  const projY = p1.y + t * dy
  return Math.hypot(px - projX, py - projY) <= HIT_TOLERANCE
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'ray',
  label: 'Ray',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
