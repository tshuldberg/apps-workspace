import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, distanceToLine, distanceToPoint, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

// Labels for impulse wave (5 points) and corrective (3 points)
const IMPULSE_LABELS = ['1', '2', '3', '4', '5']
const CORRECTIVE_LABELS = ['A', 'B', 'C']

const WAVE_COLOR = '#3b82f6'
const LABEL_BG = '#0f0f1a'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return

  const pixels = drawing.points.map((p) => pointToPixel(p, mapper))
  const isImpulse = drawing.points.length >= 5
  const labels = isImpulse ? IMPULSE_LABELS : CORRECTIVE_LABELS

  ctx.save()

  // Draw connecting lines
  applyLineStyle(ctx, { ...drawing.style, color: drawing.style.color || WAVE_COLOR })
  ctx.beginPath()
  ctx.moveTo(pixels[0].x, pixels[0].y)
  for (let i = 1; i < pixels.length; i++) {
    ctx.lineTo(pixels[i].x, pixels[i].y)
  }
  ctx.stroke()

  // Draw labels at each point
  ctx.font = 'bold 12px monospace'
  ctx.textAlign = 'center'

  for (let i = 0; i < pixels.length && i < labels.length; i++) {
    const px = pixels[i]
    const label = labels[i]
    // Place label above peaks, below troughs (alternate)
    const isUp = i === 0 || pixels[i].y < pixels[i - 1].y
    const offsetY = isUp ? -16 : 18

    // Background
    const textWidth = ctx.measureText(label).width
    ctx.fillStyle = LABEL_BG
    ctx.fillRect(px.x - textWidth / 2 - 3, px.y + offsetY - 10, textWidth + 6, 14)

    // Text
    ctx.fillStyle = drawing.style.color || WAVE_COLOR
    ctx.fillText(label, px.x, px.y + offsetY)
  }

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const pixels = drawing.points.map((p) => pointToPixel(p, mapper))

  // Check proximity to any line segment
  for (let i = 0; i < pixels.length - 1; i++) {
    if (distanceToLine(px, py, pixels[i].x, pixels[i].y, pixels[i + 1].x, pixels[i + 1].y) <= HIT_TOLERANCE) {
      return true
    }
  }

  // Check proximity to any point
  for (const p of pixels) {
    if (distanceToPoint(px, py, p.x, p.y) <= HIT_TOLERANCE + 4) return true
  }

  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'elliott-wave',
  label: 'Elliott Wave',
  minPoints: 3,
  maxPoints: 8,
  render,
  hitTest,
  getHandles,
})
