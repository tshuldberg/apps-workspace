import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 1) return
  const p = pointToPixel(drawing.points[0], mapper)

  ctx.save()
  applyLineStyle(ctx, drawing.style)
  ctx.beginPath()
  ctx.moveTo(p.x, 0)
  ctx.lineTo(p.x, ctx.canvas.height)
  ctx.stroke()
  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, _py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 1) return false
  const p = pointToPixel(drawing.points[0], mapper)
  return Math.abs(px - p.x) <= HIT_TOLERANCE
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  if (drawing.points.length < 1) return []
  const p = pointToPixel(drawing.points[0], mapper)
  return [
    { x: p.x, y: 40 },
    { x: p.x, y: mapper.priceToY(drawing.points[0].price) },
  ]
}

registerDrawingTool({
  type: 'vertical-line',
  label: 'Vertical Line',
  minPoints: 1,
  maxPoints: 1,
  render,
  hitTest,
  getHandles,
})
