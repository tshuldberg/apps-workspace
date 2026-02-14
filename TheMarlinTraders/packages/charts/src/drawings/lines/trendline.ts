import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, distanceToLine, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  ctx.save()
  applyLineStyle(ctx, drawing.style)
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()
  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)
  return distanceToLine(px, py, p1.x, p1.y, p2.x, p2.y) <= HIT_TOLERANCE
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'trendline',
  label: 'Trend Line',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
