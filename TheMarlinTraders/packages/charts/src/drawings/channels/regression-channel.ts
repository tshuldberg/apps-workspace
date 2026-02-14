import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, distanceToLine, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  // Linear regression line = center of channel
  // Width derived from the price difference as channel width
  const width = drawing.metadata?.channelWidth as number ?? 30

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return

  const nx = -dy / len
  const ny = dx / len

  ctx.save()
  applyLineStyle(ctx, drawing.style)

  // Center line
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()

  // Upper line
  ctx.beginPath()
  ctx.moveTo(p1.x + nx * width, p1.y + ny * width)
  ctx.lineTo(p2.x + nx * width, p2.y + ny * width)
  ctx.stroke()

  // Lower line
  ctx.beginPath()
  ctx.moveTo(p1.x - nx * width, p1.y - ny * width)
  ctx.lineTo(p2.x - nx * width, p2.y - ny * width)
  ctx.stroke()

  // Fill
  if (drawing.style.fillColor) {
    ctx.fillStyle = drawing.style.fillColor
    ctx.globalAlpha = drawing.style.fillOpacity ?? 0.08
    ctx.beginPath()
    ctx.moveTo(p1.x + nx * width, p1.y + ny * width)
    ctx.lineTo(p2.x + nx * width, p2.y + ny * width)
    ctx.lineTo(p2.x - nx * width, p2.y - ny * width)
    ctx.lineTo(p1.x - nx * width, p1.y - ny * width)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)
  const width = drawing.metadata?.channelWidth as number ?? 30

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return false

  const nx = -dy / len
  const ny = dx / len

  return (
    distanceToLine(px, py, p1.x, p1.y, p2.x, p2.y) <= HIT_TOLERANCE ||
    distanceToLine(px, py, p1.x + nx * width, p1.y + ny * width, p2.x + nx * width, p2.y + ny * width) <= HIT_TOLERANCE ||
    distanceToLine(px, py, p1.x - nx * width, p1.y - ny * width, p2.x - nx * width, p2.y - ny * width) <= HIT_TOLERANCE
  )
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'regression-channel',
  label: 'Regression Channel',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
