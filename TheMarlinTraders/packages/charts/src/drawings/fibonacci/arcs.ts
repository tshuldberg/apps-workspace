import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const ARC_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786]
const ARC_COLORS = ['#f59e0b', '#22c55e', '#3b82f6', '#22c55e', '#f59e0b']

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)

  ctx.save()

  // Draw the base line (dashed)
  ctx.strokeStyle = drawing.style.color
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()

  // Draw arcs at each Fibonacci level
  for (let i = 0; i < ARC_LEVELS.length; i++) {
    const level = ARC_LEVELS[i]
    const radius = dist * level

    ctx.strokeStyle = ARC_COLORS[i]
    ctx.lineWidth = 1
    ctx.setLineDash([])

    ctx.beginPath()
    ctx.arc(p2.x, p2.y, radius, 0, Math.PI * 2)
    ctx.stroke()

    // Label at the top of each arc
    ctx.fillStyle = ARC_COLORS[i]
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${(level * 100).toFixed(1)}%`, p2.x, p2.y - radius - 4)
  }

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  const mouseDist = Math.hypot(px - p2.x, py - p2.y)

  for (const level of ARC_LEVELS) {
    const radius = dist * level
    if (Math.abs(mouseDist - radius) <= HIT_TOLERANCE) return true
  }
  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'fib-arcs',
  label: 'Fibonacci Arcs',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
