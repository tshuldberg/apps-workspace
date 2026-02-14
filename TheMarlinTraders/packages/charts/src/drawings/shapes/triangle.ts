import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, distanceToLine, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 3) return
  const pts = drawing.points.map((p) => pointToPixel(p, mapper))

  ctx.save()
  applyLineStyle(ctx, drawing.style)

  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  ctx.lineTo(pts[1].x, pts[1].y)
  ctx.lineTo(pts[2].x, pts[2].y)
  ctx.closePath()

  if (drawing.style.fillColor) {
    ctx.fillStyle = drawing.style.fillColor
    ctx.globalAlpha = drawing.style.fillOpacity ?? 0.15
    ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.stroke()
  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 3) return false
  const pts = drawing.points.map((p) => pointToPixel(p, mapper))

  // Check edges
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3
    if (distanceToLine(px, py, pts[i].x, pts[i].y, pts[j].x, pts[j].y) <= HIT_TOLERANCE) {
      return true
    }
  }

  // Check if inside (barycentric coordinates)
  if (drawing.style.fillColor) {
    const [a, b, c] = pts
    const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
    if (denominator === 0) return false
    const alpha = ((b.y - c.y) * (px - c.x) + (c.x - b.x) * (py - c.y)) / denominator
    const beta = ((c.y - a.y) * (px - c.x) + (a.x - c.x) * (py - c.y)) / denominator
    const gamma = 1 - alpha - beta
    if (alpha >= 0 && beta >= 0 && gamma >= 0) return true
  }

  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'triangle',
  label: 'Triangle',
  minPoints: 3,
  maxPoints: 3,
  render,
  hitTest,
  getHandles,
})
