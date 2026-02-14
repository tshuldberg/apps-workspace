import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const FIB_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const priceRange = drawing.points[0].price - drawing.points[1].price
  const left = Math.min(p1.x, p2.x)
  const right = Math.max(p1.x, p2.x, ctx.canvas.width)

  ctx.save()

  for (let i = 0; i < FIB_LEVELS.length; i++) {
    const level = FIB_LEVELS[i]
    const price = drawing.points[1].price + priceRange * level
    const y = mapper.priceToY(price)

    ctx.strokeStyle = FIB_COLORS[i]
    ctx.lineWidth = level === 0 || level === 1 ? 1.5 : 1
    ctx.setLineDash(level === 0.5 ? [4, 4] : [])

    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()

    // Level label
    ctx.fillStyle = FIB_COLORS[i]
    ctx.font = '11px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`${(level * 100).toFixed(1)}% (${price.toFixed(2)})`, left + 4, y - 4)
  }

  // Fill between 0.382 and 0.618
  const y382 = mapper.priceToY(drawing.points[1].price + priceRange * 0.382)
  const y618 = mapper.priceToY(drawing.points[1].price + priceRange * 0.618)
  ctx.fillStyle = drawing.style.fillColor ?? '#3b82f6'
  ctx.globalAlpha = drawing.style.fillOpacity ?? 0.05
  ctx.fillRect(left, Math.min(y382, y618), right - left, Math.abs(y618 - y382))

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const priceRange = drawing.points[0].price - drawing.points[1].price

  for (const level of FIB_LEVELS) {
    const price = drawing.points[1].price + priceRange * level
    const y = mapper.priceToY(price)
    if (Math.abs(py - y) <= HIT_TOLERANCE) return true
  }
  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'fib-retracement',
  label: 'Fibonacci Retracement',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
