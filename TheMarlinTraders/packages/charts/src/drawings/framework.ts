export type DrawingToolType =
  | 'trendline'
  | 'ray'
  | 'extended-line'
  | 'horizontal-line'
  | 'vertical-line'
  | 'parallel-channel'
  | 'regression-channel'
  | 'fib-retracement'
  | 'fib-extension'
  | 'fib-fan'
  | 'fib-arcs'
  | 'fib-time-zones'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'text-label'
  | 'price-label'
  | 'callout'
  | 'gann-fan'
  | 'gann-box'
  | 'elliott-wave'
  | 'xabcd-harmonic'
  | 'risk-reward'
  | 'price-range'
  | 'bar-count'

export type InteractionMode = 'draw' | 'select' | 'edit'

export type LineStyle = 'solid' | 'dashed' | 'dotted'

export interface Point {
  time: number
  price: number
}

export interface PixelPoint {
  x: number
  y: number
}

export interface DrawingStyle {
  color: string
  lineWidth: number
  lineStyle: LineStyle
  fillColor?: string
  fillOpacity?: number
  fontSize?: number
  fontFamily?: string
  textColor?: string
}

export const DEFAULT_STYLE: DrawingStyle = {
  color: '#3b82f6',
  lineWidth: 2,
  lineStyle: 'solid',
}

export interface Drawing {
  id: string
  type: DrawingToolType
  points: Point[]
  style: DrawingStyle
  text?: string
  locked: boolean
  visible: boolean
  metadata?: Record<string, unknown>
}

export interface DrawingState {
  drawings: Drawing[]
  selectedId: string | null
  activeToolType: DrawingToolType | null
  interactionMode: InteractionMode
  currentStyle: DrawingStyle
  drawingInProgress: Drawing | null
}

export function createInitialState(): DrawingState {
  return {
    drawings: [],
    selectedId: null,
    activeToolType: null,
    interactionMode: 'select',
    currentStyle: { ...DEFAULT_STYLE },
    drawingInProgress: null,
  }
}

export function generateId(): string {
  return `d_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export interface CoordinateMapper {
  timeToX(time: number): number
  priceToY(price: number): number
  xToTime(x: number): number
  yToPrice(y: number): number
}

export function applyLineStyle(ctx: CanvasRenderingContext2D, style: DrawingStyle): void {
  ctx.strokeStyle = style.color
  ctx.lineWidth = style.lineWidth

  switch (style.lineStyle) {
    case 'dashed':
      ctx.setLineDash([8, 4])
      break
    case 'dotted':
      ctx.setLineDash([2, 4])
      break
    default:
      ctx.setLineDash([])
  }
}

export function pointToPixel(point: Point, mapper: CoordinateMapper): PixelPoint {
  return {
    x: mapper.timeToX(point.time),
    y: mapper.priceToY(point.price),
  }
}

export function pixelToPoint(pixel: PixelPoint, mapper: CoordinateMapper): Point {
  return {
    time: mapper.xToTime(pixel.x),
    price: mapper.yToPrice(pixel.y),
  }
}

export function distanceToLine(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))

  const projX = x1 + t * dx
  const projY = y1 + t * dy

  return Math.hypot(px - projX, py - projY)
}

export function distanceToPoint(px: number, py: number, x: number, y: number): number {
  return Math.hypot(px - x, py - y)
}

export const HIT_TOLERANCE = 8
export const HANDLE_RADIUS = 5
