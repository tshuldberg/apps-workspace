import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const BAR_COLOR = '#3b82f6'
const LABEL_BG = '#0f0f1a'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return

  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const time1 = drawing.points[0].time
  const time2 = drawing.points[1].time
  const timeDiff = time2 - time1
  const barCount = Math.abs(Math.round(timeDiff / 60000)) // Assume 1-minute bars as base unit

  ctx.save()

  // Vertical lines at each point
  ctx.strokeStyle = BAR_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])

  ctx.beginPath()
  ctx.moveTo(p1.x, 0)
  ctx.lineTo(p1.x, ctx.canvas.height)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(p2.x, 0)
  ctx.lineTo(p2.x, ctx.canvas.height)
  ctx.stroke()

  // Horizontal connector
  const midY = (p1.y + p2.y) / 2
  ctx.setLineDash([])
  ctx.lineWidth = 1.5
  ctx.strokeStyle = BAR_COLOR

  ctx.beginPath()
  ctx.moveTo(p1.x, midY)
  ctx.lineTo(p2.x, midY)
  ctx.stroke()

  // Arrowheads
  const arrowSize = 5
  // Left arrow
  ctx.fillStyle = BAR_COLOR
  ctx.beginPath()
  ctx.moveTo(p1.x, midY)
  ctx.lineTo(p1.x + arrowSize * 1.5, midY - arrowSize)
  ctx.lineTo(p1.x + arrowSize * 1.5, midY + arrowSize)
  ctx.closePath()
  ctx.fill()

  // Right arrow
  ctx.beginPath()
  ctx.moveTo(p2.x, midY)
  ctx.lineTo(p2.x - arrowSize * 1.5, midY - arrowSize)
  ctx.lineTo(p2.x - arrowSize * 1.5, midY + arrowSize)
  ctx.closePath()
  ctx.fill()

  // Shaded region
  ctx.fillStyle = BAR_COLOR
  ctx.globalAlpha = 0.04
  ctx.fillRect(
    Math.min(p1.x, p2.x),
    0,
    Math.abs(p2.x - p1.x),
    ctx.canvas.height,
  )
  ctx.globalAlpha = 1

  // Label
  const labelX = (p1.x + p2.x) / 2
  const labelY = midY - 16

  const durationMs = Math.abs(timeDiff)
  const hours = Math.floor(durationMs / 3600000)
  const minutes = Math.floor((durationMs % 3600000) / 60000)
  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  const labelText = `${barCount} bars (${timeStr})`

  ctx.font = '12px monospace'
  const tw = ctx.measureText(labelText).width

  ctx.fillStyle = LABEL_BG
  ctx.fillRect(labelX - tw / 2 - 6, labelY - 10, tw + 12, 22)
  ctx.strokeStyle = BAR_COLOR
  ctx.lineWidth = 1
  ctx.strokeRect(labelX - tw / 2 - 6, labelY - 10, tw + 12, 22)

  ctx.fillStyle = BAR_COLOR
  ctx.textAlign = 'center'
  ctx.fillText(labelText, labelX, labelY + 5)

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  // Near vertical lines
  if (Math.abs(px - p1.x) <= HIT_TOLERANCE) return true
  if (Math.abs(px - p2.x) <= HIT_TOLERANCE) return true

  // Near horizontal connector
  const midY = (p1.y + p2.y) / 2
  const left = Math.min(p1.x, p2.x)
  const right = Math.max(p1.x, p2.x)
  if (Math.abs(py - midY) <= HIT_TOLERANCE && px >= left && px <= right) return true

  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'bar-count',
  label: 'Bar Count',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
