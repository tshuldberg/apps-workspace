import type { Drawing, CoordinateMapper, PixelPoint } from '../framework.js'
import { pointToPixel, distanceToPoint, HIT_TOLERANCE } from '../framework.js'
import { registerDrawingTool } from '../tool-manager.js'

function render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void {
  if (drawing.points.length < 1) return
  const p = pointToPixel(drawing.points[0], mapper)
  const text = drawing.text ?? 'Text'
  const fontSize = drawing.style.fontSize ?? 14
  const fontFamily = drawing.style.fontFamily ?? 'sans-serif'

  ctx.save()
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.fillStyle = drawing.style.textColor ?? drawing.style.color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'bottom'
  ctx.fillText(text, p.x, p.y)
  ctx.restore()
}

function hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean {
  if (drawing.points.length < 1) return false
  const p = pointToPixel(drawing.points[0], mapper)
  const text = drawing.text ?? 'Text'
  const fontSize = drawing.style.fontSize ?? 14

  // Approximate text bounds
  const width = text.length * fontSize * 0.6
  const height = fontSize * 1.2

  return (
    px >= p.x - 4 &&
    px <= p.x + width + 4 &&
    py >= p.y - height - 4 &&
    py <= p.y + 4
  )
}

function getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[] {
  return drawing.points.map((p) => pointToPixel(p, mapper))
}

registerDrawingTool({
  type: 'text-label',
  label: 'Text',
  minPoints: 1,
  maxPoints: 1,
  render,
  hitTest,
  getHandles,
})
