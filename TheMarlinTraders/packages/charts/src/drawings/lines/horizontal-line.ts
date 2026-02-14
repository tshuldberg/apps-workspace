import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 1) return
  const p = pointToPixel(drawing.points[0], mapper)

  ctx.save()
  applyLineStyle(ctx, drawing.style)
  ctx.beginPath()
  ctx.moveTo(0, p.y)
  ctx.lineTo(ctx.canvas.width, p.y)
  ctx.stroke()

  // Price label
  ctx.fillStyle = drawing.style.color
  ctx.font = '11px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(drawing.points[0].price.toFixed(2), ctx.canvas.width - 4, p.y - 4)

  ctx.restore()
}

function hitTest(drawing: Drawing, _px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 1) return false
  const p = pointToPixel(drawing.points[0], mapper)
  return Math.abs(py - p.y) <= HIT_TOLERANCE
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  if (drawing.points.length < 1) return []
  const p = pointToPixel(drawing.points[0], mapper)
  return [
    { x: 40, y: p.y },
    { x: mapper.timeToX(drawing.points[0].time), y: p.y },
  ]
}

registerDrawingTool({
  type: 'horizontal-line',
  label: 'Horizontal Line',
  minPoints: 1,
  maxPoints: 1,
  render,
  hitTest,
  getHandles,
})
