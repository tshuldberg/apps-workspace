import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, distanceToLine, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const FAN_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const FAN_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const extend = Math.max(ctx.canvas.width, ctx.canvas.height) * 2

  ctx.save()

  for (let i = 0; i < FAN_LEVELS.length; i++) {
    const level = FAN_LEVELS[i]
    // Fan line goes from p1 through a point at (p2.x, p1.y + dy * level)
    const targetY = p1.y + dy * level
    const fanDx = dx
    const fanDy = targetY - p1.y

    const len = Math.hypot(fanDx, fanDy)
    if (len === 0) continue

    const endX = p1.x + (fanDx / len) * extend
    const endY = p1.y + (fanDy / len) * extend

    ctx.strokeStyle = FAN_COLORS[i]
    ctx.lineWidth = level === 0.5 ? 1.5 : 1
    ctx.setLineDash(level === 0 || level === 1 ? [] : [4, 3])

    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // Label
    const labelX = p1.x + fanDx * 0.6
    const labelY = p1.y + fanDy * 0.6
    ctx.fillStyle = FAN_COLORS[i]
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`${(level * 100).toFixed(1)}%`, labelX + 4, labelY - 4)
  }

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const extend = 2000

  for (const level of FAN_LEVELS) {
    const targetY = p1.y + dy * level
    const fanDx = dx
    const fanDy = targetY - p1.y
    const len = Math.hypot(fanDx, fanDy)
    if (len === 0) continue

    const endX = p1.x + (fanDx / len) * extend
    const endY = p1.y + (fanDy / len) * extend

    if (distanceToLine(px, py, p1.x, p1.y, endX, endY) <= HIT_TOLERANCE) return true
  }
  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'fib-fan',
  label: 'Fibonacci Fan',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
