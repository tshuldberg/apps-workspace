import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { applyLineStyle, pointToPixel, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

// Gann box divisions: 0, 0.25, 0.333, 0.5, 0.667, 0.75, 1
const DIVISIONS = [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1]
const DIV_LABELS = ['0', '1/4', '1/3', '1/2', '2/3', '3/4', '1']
const GRID_COLOR = '#3b82f6'
const DIAGONAL_COLOR = '#f59e0b'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 2) return
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const left = Math.min(p1.x, p2.x)
  const right = Math.max(p1.x, p2.x)
  const top = Math.min(p1.y, p2.y)
  const bottom = Math.max(p1.y, p2.y)
  const width = right - left
  const height = bottom - top

  ctx.save()

  // Outer box
  applyLineStyle(ctx, drawing.style)
  ctx.strokeRect(left, top, width, height)

  // Horizontal grid lines (price divisions)
  for (let i = 1; i < DIVISIONS.length - 1; i++) {
    const y = top + height * DIVISIONS[i]
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    ctx.globalAlpha = 0.5

    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(right, y)
    ctx.stroke()

    // Label on left
    ctx.globalAlpha = 1
    ctx.fillStyle = GRID_COLOR
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(DIV_LABELS[i], left - 4, y + 3)
  }

  // Vertical grid lines (time divisions)
  for (let i = 1; i < DIVISIONS.length - 1; i++) {
    const x = left + width * DIVISIONS[i]
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    ctx.globalAlpha = 0.5

    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.stroke()

    // Label on top
    ctx.globalAlpha = 1
    ctx.fillStyle = GRID_COLOR
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(DIV_LABELS[i], x, top - 4)
  }

  // Diagonal lines (corner to corner)
  ctx.strokeStyle = DIAGONAL_COLOR
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.globalAlpha = 0.7

  // Main diagonal
  ctx.beginPath()
  ctx.moveTo(left, top)
  ctx.lineTo(right, bottom)
  ctx.stroke()

  // Anti-diagonal
  ctx.beginPath()
  ctx.moveTo(right, top)
  ctx.lineTo(left, bottom)
  ctx.stroke()

  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 2) return false
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)

  const left = Math.min(p1.x, p2.x)
  const right = Math.max(p1.x, p2.x)
  const top = Math.min(p1.y, p2.y)
  const bottom = Math.max(p1.y, p2.y)

  // Check edges
  const nearLeft = Math.abs(px - left) <= HIT_TOLERANCE && py >= top - HIT_TOLERANCE && py <= bottom + HIT_TOLERANCE
  const nearRight = Math.abs(px - right) <= HIT_TOLERANCE && py >= top - HIT_TOLERANCE && py <= bottom + HIT_TOLERANCE
  const nearTop = Math.abs(py - top) <= HIT_TOLERANCE && px >= left - HIT_TOLERANCE && px <= right + HIT_TOLERANCE
  const nearBottom = Math.abs(py - bottom) <= HIT_TOLERANCE && px >= left - HIT_TOLERANCE && px <= right + HIT_TOLERANCE

  // Check grid lines
  const width = right - left
  const height = bottom - top
  for (const div of DIVISIONS) {
    if (Math.abs(py - (top + height * div)) <= HIT_TOLERANCE && px >= left && px <= right) return true
    if (Math.abs(px - (left + width * div)) <= HIT_TOLERANCE && py >= top && py <= bottom) return true
  }

  return nearLeft || nearRight || nearTop || nearBottom
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  if (drawing.points.length < 2) return []
  const p1 = pointToPixel(drawing.points[0], mapper)
  const p2 = pointToPixel(drawing.points[1], mapper)
  return [
    p1,
    { x: p2.x, y: p1.y },
    p2,
    { x: p1.x, y: p2.y },
  ]
}

registerDrawingTool({
  type: 'gann-box',
  label: 'Gann Box',
  minPoints: 2,
  maxPoints: 2,
  render,
  hitTest,
  getHandles,
})
