import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const center = pointToPixel(drawing.points[0], mapper)
  const edge = pointToPixel(drawing.points[1], mapper)
  const radius = Math.hypot(edge.x - center.x, edge.y - center.y)

  ctx.save()
  applyLineStyle(ctx, drawing.style)

  if (drawing.style.fillColor) {
    ctx.fillStyle = drawing.style.fillColor
    ctx.globalAlpha = drawing.style.fillOpacity ?? 0.15
    ctx.beginPath()
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  ctx.beginPath()
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const center = pointToPixel(drawing.points[0], mapper)
  const edge = pointToPixel(drawing.points[1], mapper)
  const radius = Math.hypot(edge.x - center.x, edge.y - center.y)
  const dist = Math.hypot(px - center.x, py - center.y)

  if (drawing.style.fillColor) {
    return dist <= radius + HIT_TOLERANCE
  }
  return Math.abs(dist - radius) <= HIT_TOLERANCE
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  if (drawing.points.length < 2) return []
  const center = pointToPixel(drawing.points[0], mapper)
  const edge = pointToPixel(drawing.points[1], mapper)
  const radius = Math.hypot(edge.x - center.x, edge.y - center.y)
  return [
    center,
    { x: center.x + radius, y: center.y },
    { x: center.x, y: center.y - radius },
    { x: center.x - radius, y: center.y },
    { x: center.x, y: center.y + radius },
  ]
}

registerDrawingTool({
  type: 'circle',
  label: 'Circle',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
