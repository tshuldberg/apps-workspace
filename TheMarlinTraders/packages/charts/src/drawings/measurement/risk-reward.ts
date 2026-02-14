import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const ENTRY_COLOR = '#3b82f6'
const STOP_COLOR = '#ef4444'
const TARGET_COLOR = '#22c55e'
const LABEL_BG = '#0f0f1a'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  // 3 points: entry, stop-loss, take-profit
  if (drawing.points.length < 3) {
    // Draw partial (entry + stop only)
    if (drawing.points.length >= 2) {
      renderPartial(ctx, drawing, mapper)
    }
    return
  }

  const entry = pointToPixel(drawing.points[0], mapper)
  const stop = pointToPixel(drawing.points[1], mapper)
  const target = pointToPixel(drawing.points[2], mapper)

  const entryPrice = drawing.points[0].price
  const stopPrice = drawing.points[1].price
  const targetPrice = drawing.points[2].price

  const risk = Math.abs(entryPrice - stopPrice)
  const reward = Math.abs(targetPrice - entryPrice)
  const ratio = risk > 0 ? (reward / risk).toFixed(2) : '0.00'

  const left = Math.min(entry.x, stop.x, target.x) - 20
  const right = Math.max(entry.x, stop.x, target.x, ctx.canvas.width * 0.6)

  ctx.save()

  // Entry line
  ctx.strokeStyle = ENTRY_COLOR
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(left, entry.y)
  ctx.lineTo(right, entry.y)
  ctx.stroke()

  // Stop-loss zone
  ctx.fillStyle = STOP_COLOR
  ctx.globalAlpha = 0.08
  ctx.fillRect(left, Math.min(entry.y, stop.y), right - left, Math.abs(stop.y - entry.y))
  ctx.globalAlpha = 1

  ctx.strokeStyle = STOP_COLOR
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(left, stop.y)
  ctx.lineTo(right, stop.y)
  ctx.stroke()

  // Take-profit zone
  ctx.fillStyle = TARGET_COLOR
  ctx.globalAlpha = 0.08
  ctx.fillRect(left, Math.min(entry.y, target.y), right - left, Math.abs(target.y - entry.y))
  ctx.globalAlpha = 1

  ctx.strokeStyle = TARGET_COLOR
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(left, target.y)
  ctx.lineTo(right, target.y)
  ctx.stroke()

  // Labels
  ctx.font = '11px monospace'
  ctx.textAlign = 'left'
  ctx.setLineDash([])

  drawLabel(ctx, right + 8, entry.y, `Entry: ${entryPrice.toFixed(2)}`, ENTRY_COLOR)
  drawLabel(ctx, right + 8, stop.y, `Stop: ${stopPrice.toFixed(2)} (-${risk.toFixed(2)})`, STOP_COLOR)
  drawLabel(ctx, right + 8, target.y, `Target: ${targetPrice.toFixed(2)} (+${reward.toFixed(2)})`, TARGET_COLOR)

  // R:R ratio in the center
  const centerY = (entry.y + target.y) / 2
  ctx.font = 'bold 14px monospace'
  ctx.fillStyle = LABEL_BG
  const ratioText = `R:R ${ratio}`
  const tw = ctx.measureText(ratioText).width
  ctx.fillRect((left + right) / 2 - tw / 2 - 6, centerY - 10, tw + 12, 22)
  ctx.fillStyle = TARGET_COLOR
  ctx.textAlign = 'center'
  ctx.fillText(ratioText, (left + right) / 2, centerY + 5)

  ctx.restore()
}

function renderPartial(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  const entry = pointToPixel(drawing.points[0], mapper)
  const stop = pointToPixel(drawing.points[1], mapper)
  const left = Math.min(entry.x, stop.x) - 20
  const right = Math.max(entry.x, stop.x, ctx.canvas.width * 0.6)

  ctx.save()

  ctx.strokeStyle = ENTRY_COLOR
  ctx.lineWidth = 1.5
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(left, entry.y)
  ctx.lineTo(right, entry.y)
  ctx.stroke()

  ctx.fillStyle = STOP_COLOR
  ctx.globalAlpha = 0.08
  ctx.fillRect(left, Math.min(entry.y, stop.y), right - left, Math.abs(stop.y - entry.y))
  ctx.globalAlpha = 1

  ctx.strokeStyle = STOP_COLOR
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(left, stop.y)
  ctx.lineTo(right, stop.y)
  ctx.stroke()

  ctx.restore()
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string): void {
  const tw = ctx.measureText(text).width
  ctx.fillStyle = LABEL_BG
  ctx.fillRect(x - 2, y - 8, tw + 4, 14)
  ctx.fillStyle = color
  ctx.fillText(text, x, y + 4)
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  for (const point of drawing.points) {
    const p = pointToPixel(point, mapper)
    if (Math.abs(py - p.y) <= HIT_TOLERANCE) return true
  }
  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'risk-reward',
  label: 'Risk/Reward',
  minPoints: 3,
  maxPoints: 3,
  render,
  hitTest,
  getHandles,
})
