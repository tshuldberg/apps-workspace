import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const x = Math.min(p1.x, p2.x)
  const y = Math.min(p1.y, p2.y)
  const w = Math.abs(p2.x - p1.x)
  const h = Math.abs(p2.y - p1.y)

  ctx.save()
  applyLineStyle(ctx, drawing.style)

  if (drawing.style.fillColor) {
    ctx.fillStyle = drawing.style.fillColor
    ctx.globalAlpha = drawing.style.fillOpacity ?? 0.15
    ctx.fillRect(x, y, w, h)
    ctx.globalAlpha = 1
  }

  ctx.strokeRect(x, y, w, h)
  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const left = Math.min(p1.x, p2.x)
  const right = Math.max(p1.x, p2.x)
  const top = Math.min(p1.y, p2.y)
  const bottom = Math.max(p1.y, p2.y)

  // Check if near any edge
  const nearLeft = Math.abs(px - left) <= HIT_TOLERANCE && py >= top - HIT_TOLERANCE && py <= bottom + HIT_TOLERANCE
  const nearRight = Math.abs(px - right) <= HIT_TOLERANCE && py >= top - HIT_TOLERANCE && py <= bottom + HIT_TOLERANCE
  const nearTop = Math.abs(py - top) <= HIT_TOLERANCE && px >= left - HIT_TOLERANCE && px <= right + HIT_TOLERANCE
  const nearBottom = Math.abs(py - bottom) <= HIT_TOLERANCE && px >= left - HIT_TOLERANCE && px <= right + HIT_TOLERANCE

  // Or if inside filled rectangle
  const inside = drawing.style.fillColor && px >= left && px <= right && py >= top && py <= bottom

  return nearLeft || nearRight || nearTop || nearBottom || !!inside
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  if (drawing.points.length < 2) return []
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)
  return [
    p1,
    { x: p2.x, y: p1.y },
    p2,
    { x: p1.x, y: p2.y },
  ]
}

registerDrawingTool({
  type: 'rectangle',
  label: 'Rectangle',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
