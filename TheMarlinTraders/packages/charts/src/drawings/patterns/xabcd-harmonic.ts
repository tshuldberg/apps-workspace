import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, distanceToLine, distanceToPoint, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

const POINT_LABELS = ['X', 'A', 'B', 'C', 'D']
const LINE_COLOR = '#a855f7'
const LABEL_BG = '#0f0f1a'
const FILL_COLOR = '#a855f7'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return

  const pixels = drawing.points.map((p) => pointToPixel(p, mapper))
  const color = drawing.style.color || LINE_COLOR

  ctx.save()

  // Fill the XABCD shape if we have all 5 points
  if (pixels.length >= 5) {
    ctx.fillStyle = FILL_COLOR
    ctx.globalAlpha = 0.05
    ctx.beginPath()
    ctx.moveTo(pixels[0].x, pixels[0].y)
    for (let i = 1; i < 5; i++) {
      ctx.lineTo(pixels[i].x, pixels[i].y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }

  // Draw connecting lines: X-A, A-B, B-C, C-D
  applyLineStyle(ctx, { ...drawing.style, color })
  ctx.beginPath()
  ctx.moveTo(pixels[0].x, pixels[0].y)
  for (let i = 1; i < pixels.length; i++) {
    ctx.lineTo(pixels[i].x, pixels[i].y)
  }
  ctx.stroke()

  // Draw X-B and A-C connector lines (dashed)
  if (pixels.length >= 3) {
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.globalAlpha = 0.4

    // X-B
    ctx.beginPath()
    ctx.moveTo(pixels[0].x, pixels[0].y)
    ctx.lineTo(pixels[2].x, pixels[2].y)
    ctx.stroke()

    // A-C (if available)
    if (pixels.length >= 4) {
      ctx.beginPath()
      ctx.moveTo(pixels[1].x, pixels[1].y)
      ctx.lineTo(pixels[3].x, pixels[3].y)
      ctx.stroke()
    }

    // X-D (if available)
    if (pixels.length >= 5) {
      ctx.beginPath()
      ctx.moveTo(pixels[0].x, pixels[0].y)
      ctx.lineTo(pixels[4].x, pixels[4].y)
      ctx.stroke()
    }

    ctx.globalAlpha = 1
  }

  // Draw Fibonacci ratio labels between legs
  if (pixels.length >= 3) {
    const xaRange = drawing.points[1].price - drawing.points[0].price
    if (xaRange !== 0) {
      const abRatio = (drawing.points[2].price - drawing.points[1].price) / xaRange
      drawRatioLabel(ctx, pixels[1], pixels[2], `${Math.abs(abRatio).toFixed(3)}`, color)
    }
  }

  if (pixels.length >= 4) {
    const abRange = drawing.points[2].price - drawing.points[1].price
    if (abRange !== 0) {
      const bcRatio = (drawing.points[3].price - drawing.points[2].price) / abRange
      drawRatioLabel(ctx, pixels[2], pixels[3], `${Math.abs(bcRatio).toFixed(3)}`, color)
    }
  }

  if (pixels.length >= 5) {
    const xaRange = drawing.points[1].price - drawing.points[0].price
    if (xaRange !== 0) {
      const xdRatio = (drawing.points[4].price - drawing.points[0].price) / xaRange
      drawRatioLabel(ctx, pixels[0], pixels[4], `${Math.abs(xdRatio).toFixed(3)}`, color)
    }
  }

  // Draw point labels
  ctx.font = 'bold 12px monospace'
  ctx.textAlign = 'center'

  for (let i = 0; i < pixels.length && i < POINT_LABELS.length; i++) {
    const px = pixels[i]
    const label = POINT_LABELS[i]
    const isUp = i === 0 || pixels[i].y < pixels[i - 1].y
    const offsetY = isUp ? -16 : 18

    const textWidth = ctx.measureText(label).width
    ctx.fillStyle = LABEL_BG
    ctx.fillRect(px.x - textWidth / 2 - 3, px.y + offsetY - 10, textWidth + 6, 14)

    ctx.fillStyle = color
    ctx.fillText(label, px.x, px.y + offsetY)
  }

  ctx.restore()
}

function drawRatioLabel(
  ctx: CanvasRenderingContext2D,
  from: PixelPoint,
  to: PixelPoint,
  text: string,
  color: string,
): void {
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2

  ctx.font = '10px monospace'
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(text, midX + 12, midY)
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const pixels = drawing.points.map((p) => pointToPixel(p, mapper))

  for (let i = 0; i < pixels.length - 1; i++) {
    if (distanceToLine(px, py, pixels[i].x, pixels[i].y, pixels[i + 1].x, pixels[i + 1].y) <= HIT_TOLERANCE) {
      return true
    }
  }

  for (const p of pixels) {
    if (distanceToPoint(px, py, p.x, p.y) <= HIT_TOLERANCE + 4) return true
  }

  return false
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'xabcd-harmonic',
  label: 'XABCD Harmonic',
  minPoints: 5,
  maxPoints: 5,
  render,
  hitTest,
  getHandles,
})
