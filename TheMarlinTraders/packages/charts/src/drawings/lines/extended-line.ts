import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const scale = Math.max(ctx.canvas.width, ctx.canvas.height) * 2

  if (dx === 0 && dy === 0) return

  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len

  const extStart = { x: p1.x - ux * scale, y: p1.y - uy * scale }
  const extEnd = { x: p1.x + ux * scale, y: p1.y + uy * scale }

  ctx.save()
  applyLineStyle(ctx, drawing.style)
  ctx.beginPath()
  ctx.moveTo(extStart.x, extStart.y)
  ctx.lineTo(extEnd.x, extEnd.y)
  ctx.stroke()
  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return false

  // Distance from point to infinite line
  const dist = Math.abs(dy * px - dx * py + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(lenSq)
  return dist <= HIT_TOLERANCE
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'extended-line',
  label: 'Extended Line',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
