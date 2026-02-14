import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const BOX_PADDING = 8
const BOX_RADIUS = 4

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const anchor = pointToPixel(drawing.points[0], mapper)
  const boxPos = pointToPixel(drawing.points[1], mapper)
  const text = drawing.text ?? 'Callout'
  const fontSize = drawing.style.fontSize ?? 12

  ctx.save()
  ctx.font = `${fontSize}px sans-serif`

  const lines = text.split('\n')
  const lineHeight = fontSize * 1.4
  let maxWidth = 0
  for (const line of lines) {
    const w = ctx.measureText(line).width
    if (w > maxWidth) maxWidth = w
  }

  const boxWidth = maxWidth + BOX_PADDING * 2
  const boxHeight = lines.length * lineHeight + BOX_PADDING * 2

  // Leader line from anchor to box
  applyLineStyle(ctx, drawing.style)
  ctx.beginPath()
  ctx.moveTo(anchor.x, anchor.y)
  ctx.lineTo(boxPos.x, boxPos.y)
  ctx.stroke()

  // Anchor dot
  ctx.fillStyle = drawing.style.color
  ctx.beginPath()
  ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2)
  ctx.fill()

  // Box background
  const bx = boxPos.x
  const by = boxPos.y - boxHeight

  ctx.fillStyle = drawing.style.fillColor ?? '#1e293b'
  ctx.globalAlpha = 0.95
  ctx.beginPath()
  ctx.moveTo(bx + BOX_RADIUS, by)
  ctx.lineTo(bx + boxWidth - BOX_RADIUS, by)
  ctx.arcTo(bx + boxWidth, by, bx + boxWidth, by + BOX_RADIUS, BOX_RADIUS)
  ctx.lineTo(bx + boxWidth, by + boxHeight - BOX_RADIUS)
  ctx.arcTo(bx + boxWidth, by + boxHeight, bx + boxWidth - BOX_RADIUS, by + boxHeight, BOX_RADIUS)
  ctx.lineTo(bx + BOX_RADIUS, by + boxHeight)
  ctx.arcTo(bx, by + boxHeight, bx, by + boxHeight - BOX_RADIUS, BOX_RADIUS)
  ctx.lineTo(bx, by + BOX_RADIUS)
  ctx.arcTo(bx, by, bx + BOX_RADIUS, by, BOX_RADIUS)
  ctx.fill()
  ctx.globalAlpha = 1

  // Box border
  ctx.strokeStyle = drawing.style.color
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.stroke()

  // Text
  ctx.fillStyle = drawing.style.textColor ?? '#e2e8f0'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bx + BOX_PADDING, by + BOX_PADDING + i * lineHeight)
  }

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const anchor = pointToPixel(drawing.points[0], mapper)
  const boxPos = pointToPixel(drawing.points[1], mapper)

  // Anchor point
  if (Math.hypot(px - anchor.x, py - anchor.y) <= HIT_TOLERANCE + 4) return true

  // Box area
  const text = drawing.text ?? 'Callout'
  const fontSize = drawing.style.fontSize ?? 12
  const lines = text.split('\n')
  const lineHeight = fontSize * 1.4
  const boxHeight = lines.length * lineHeight + BOX_PADDING * 2
  const boxWidth = text.length * fontSize * 0.6 + BOX_PADDING * 2

  const bx = boxPos.x
  const by = boxPos.y - boxHeight
  return px >= bx - 4 && px <= bx + boxWidth + 4 && py >= by - 4 && py <= boxPos.y + 4
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'callout',
  label: 'Callout',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
