import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

// Fibonacci sequence for time zone intervals
const FIB_SEQUENCE = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
const ZONE_COLOR = '#3b82f6'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const unitWidth = p2.x - p1.x
  if (unitWidth === 0) return

  const top = 0
  const bottom = ctx.canvas.height

  ctx.save()

  // Draw the anchor line
  ctx.strokeStyle = ZONE_COLOR
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(p1.x, top)
  ctx.lineTo(p1.x, bottom)
  ctx.stroke()

  // Draw Fibonacci time zone lines
  let cumulative = 0
  for (let i = 0; i < FIB_SEQUENCE.length; i++) {
    cumulative += FIB_SEQUENCE[i]
    const x = p1.x + unitWidth * cumulative

    if (x > ctx.canvas.width + 100) break

    ctx.strokeStyle = ZONE_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.globalAlpha = 0.6

    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.stroke()

    // Label at top
    ctx.globalAlpha = 1
    ctx.fillStyle = ZONE_COLOR
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${cumulative}`, x, 14)
  }

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, _py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const unitWidth = p2.x - p1.x
  if (unitWidth === 0) return false

  // Check anchor line
  if (Math.abs(px - p1.x) <= HIT_TOLERANCE) return true

  // Check each Fibonacci time zone line
  let cumulative = 0
  for (const fib of FIB_SEQUENCE) {
    cumulative += fib
    const x = p1.x + unitWidth * cumulative
    if (Math.abs(px - x) <= HIT_TOLERANCE) return true
  }
  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'fib-time-zones',
  label: 'Fibonacci Time Zones',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
