import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const LABEL_HEIGHT = 22
const LABEL_PADDING = 8

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 1) return
  const p = pointToPixel(drawing.points[0], mapper)
  const price = drawing.points[0].price.toFixed(2)
  const fontSize = drawing.style.fontSize ?? 12

  ctx.save()
  ctx.font = `${fontSize}px monospace`

  const textWidth = ctx.measureText(price).width
  const bgWidth = textWidth + LABEL_PADDING * 2

  // Background pill
  ctx.fillStyle = drawing.style.color
  ctx.beginPath()
  const radius = LABEL_HEIGHT / 2
  const x = p.x
  const y = p.y - LABEL_HEIGHT / 2
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + bgWidth - radius, y)
  ctx.arcTo(x + bgWidth, y, x + bgWidth, y + radius, radius)
  ctx.arcTo(x + bgWidth, y + LABEL_HEIGHT, x + bgWidth - radius, y + LABEL_HEIGHT, radius)
  ctx.lineTo(x + radius, y + LABEL_HEIGHT)
  ctx.arcTo(x, y + LABEL_HEIGHT, x, y + LABEL_HEIGHT - radius, radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.fill()

  // Price text
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(price, x + LABEL_PADDING, p.y)

  // Horizontal line
  ctx.strokeStyle = drawing.style.color
  ctx.lineWidth = 1
  ctx.setLineDash([4, 2])
  ctx.beginPath()
  ctx.moveTo(0, p.y)
  ctx.lineTo(x, p.y)
  ctx.stroke()

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 1) return false
  const p = pointToPixel(drawing.points[0], mapper)

  // Check the label area
  return (
    px >= p.x - 4 && px <= p.x + 100 &&
    Math.abs(py - p.y) <= LABEL_HEIGHT / 2 + HIT_TOLERANCE
  )
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'price-label',
  label: 'Price Label',
  minPoints: 1,
  maxPoints: 1,
  render,
  hitTest,
  getHandles,
})
