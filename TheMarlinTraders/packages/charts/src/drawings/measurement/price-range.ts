import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const RANGE_COLOR = '#3b82f6'
const POSITIVE_COLOR = '#22c55e'
const NEGATIVE_COLOR = '#ef4444'
const LABEL_BG = '#0f0f1a'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return

  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const price1 = drawing.points[0].price
  const price2 = drawing.points[1].price
  const diff = price2 - price1
  const pctChange = price1 !== 0 ? (diff / price1) * 100 : 0
  const isPositive = diff >= 0
  const color = isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR

  ctx.save()

  // Horizontal lines at each price
  ctx.strokeStyle = RANGE_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])

  const left = Math.min(p1.x, p2.x) - 10
  const right = Math.max(p1.x, p2.x) + 10

  ctx.beginPath()
  ctx.moveTo(left, p1.y)
  ctx.lineTo(right, p1.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(left, p2.y)
  ctx.lineTo(right, p2.y)
  ctx.stroke()

  // Vertical connecting line
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.setLineDash([])

  const midX = (p1.x + p2.x) / 2
  ctx.beginPath()
  ctx.moveTo(midX, p1.y)
  ctx.lineTo(midX, p2.y)
  ctx.stroke()

  // Arrowhead
  const arrowSize = 6
  const arrowY = p2.y
  const arrowDir = p2.y < p1.y ? -1 : 1
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(midX, arrowY)
  ctx.lineTo(midX - arrowSize, arrowY - arrowDir * arrowSize * 1.5)
  ctx.lineTo(midX + arrowSize, arrowY - arrowDir * arrowSize * 1.5)
  ctx.closePath()
  ctx.fill()

  // Fill area
  ctx.fillStyle = color
  ctx.globalAlpha = 0.05
  ctx.fillRect(left, Math.min(p1.y, p2.y), right - left, Math.abs(p2.y - p1.y))
  ctx.globalAlpha = 1

  // Label box
  const labelX = midX + 16
  const labelY = (p1.y + p2.y) / 2

  const sign = isPositive ? '+' : ''
  const priceText = `${sign}$${diff.toFixed(2)}`
  const pctText = `${sign}${pctChange.toFixed(2)}%`
  const fullText = `${priceText}  (${pctText})`

  ctx.font = '12px monospace'
  const tw = ctx.measureText(fullText).width

  ctx.fillStyle = LABEL_BG
  ctx.fillRect(labelX - 4, labelY - 10, tw + 8, 22)
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.strokeRect(labelX - 4, labelY - 10, tw + 8, 22)

  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.fillText(fullText, labelX, labelY + 5)

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  // Near horizontal lines
  if (Math.abs(py - p1.y) <= HIT_TOLERANCE) return true
  if (Math.abs(py - p2.y) <= HIT_TOLERANCE) return true

  // Near vertical connector
  const midX = (p1.x + p2.x) / 2
  const top = Math.min(p1.y, p2.y)
  const bottom = Math.max(p1.y, p2.y)
  if (Math.abs(px - midX) <= HIT_TOLERANCE && py >= top && py <= bottom) return true

  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'price-range',
  label: 'Price Range',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
