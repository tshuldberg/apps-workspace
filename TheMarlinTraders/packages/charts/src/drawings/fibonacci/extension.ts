import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const EXT_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2, 2.618]
const EXT_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6']

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 3) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p3 = pointToPixel(drawing.points[2], mapper)

  const priceRange = drawing.points[1].price - drawing.points[0].price
  const left = Math.min(p1.x, p3.x)
  const right = Math.max(p1.x, p3.x, ctx.canvas.width)

  ctx.save()

  for (let i = 0; i < EXT_LEVELS.length; i++) {
    const level = EXT_LEVELS[i]
    const price = drawing.points[2].price + priceRange * level
    const y = mapper.priceToY(price)

    ctx.strokeStyle = EXT_COLORS[i]
    ctx.lineWidth = 1
    ctx.setLineDash(level > 1 ? [6, 3] : [])

    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()

    ctx.fillStyle = EXT_COLORS[i]
    ctx.font = '11px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`${(level * 100).toFixed(1)}% (${price.toFixed(2)})`, left + 4, y - 4)
  }

  // Draw connecting lines between the 3 anchor points
  ctx.strokeStyle = drawing.style.color
  ctx.lineWidth = 1
  ctx.setLineDash([2, 2])
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  const p2 = pointToPixel(drawing.points[1], mapper)
  ctx.lineTo(p2.x, p2.y)
  ctx.lineTo(p3.x, p3.y)
  ctx.stroke()

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 3) return false
  const priceRange = drawing.points[1].price - drawing.points[0].price

  for (const level of EXT_LEVELS) {
    const price = drawing.points[2].price + priceRange * level
    const y = mapper.priceToY(price)
    if (Math.abs(py - y) <= HIT_TOLERANCE) return true
  }
  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'fib-extension',
  label: 'Fibonacci Extension',
  minPoints: 3,
  maxPoints: 3,
  render,
  hitTest,
  getHandles,
})
