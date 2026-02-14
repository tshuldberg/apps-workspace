import type {
  Drawing,
  DrawingState,
  DrawingToolType,
  DrawingStyle,
  CoordinateMapper,
  PixelPoint,
} from './framework.js'
import {
  createInitialState,
  generateId,
  HIT_TOLERANCE,
  HANDLE_RADIUS,
  pointToPixel,
  distanceToPoint,
} from './framework.js'

export interface DrawingToolDefinition {
  type: DrawingToolType
  label: string
  minPoints: number
  maxPoints: number
  render(ctx: CanvasRenderingContext2D, drawing: Drawing, mapper: CoordinateMapper): void
  hitTest(drawing: Drawing, px: number, py: number, mapper: CoordinateMapper): boolean
  getHandles(drawing: Drawing, mapper: CoordinateMapper): PixelPoint[]
}

const toolRegistry = new Map<DrawingToolType, DrawingToolDefinition>()

export function registerDrawingTool(tool: DrawingToolDefinition): void {
  toolRegistry.set(tool.type, tool)
}

export function getDrawingTool(type: DrawingToolType): DrawingToolDefinition | undefined {
  return toolRegistry.get(type)
}

export function getAllDrawingTools(): DrawingToolDefinition[] {
  return Array.from(toolRegistry.values())
}

export class ToolManager {
  private state: DrawingState

  constructor() {
    this.state = createInitialState()
  }

  getState(): DrawingState {
    return this.state
  }

  setActiveTool(type: DrawingToolType | null): void {
    this.state.activeToolType = type
    this.state.interactionMode = type ? 'draw' : 'select'
    this.state.drawingInProgress = null
    this.state.selectedId = null
  }

  setStyle(style: Partial<DrawingStyle>): void {
    this.state.currentStyle = { ...this.state.currentStyle, ...style }
  }

  addDrawing(drawing: Drawing): void {
    this.state.drawings.push(drawing)
    this.state.drawingInProgress = null
    this.state.interactionMode = 'select'
    this.state.activeToolType = null
    this.state.selectedId = drawing.id
  }

  updateDrawing(id: string, updates: Partial<Drawing>): void {
    const idx = this.state.drawings.findIndex((d) => d.id === id)
    if (idx !== -1) {
      this.state.drawings[idx] = { ...this.state.drawings[idx], ...updates }
    }
  }

  deleteDrawing(id: string): Drawing | null {
    const idx = this.state.drawings.findIndex((d) => d.id === id)
    if (idx === -1) return null
    const [removed] = this.state.drawings.splice(idx, 1)
    if (this.state.selectedId === id) {
      this.state.selectedId = null
    }
    return removed
  }

  selectDrawing(id: string | null): void {
    this.state.selectedId = id
    this.state.interactionMode = id ? 'edit' : 'select'
  }

  getSelectedDrawing(): Drawing | null {
    if (!this.state.selectedId) return null
    return this.state.drawings.find((d) => d.id === this.state.selectedId) ?? null
  }

  hitTest(px: number, py: number, mapper: CoordinateMapper): Drawing | null {
    // Test in reverse order (top-most first)
    for (let i = this.state.drawings.length - 1; i >= 0; i--) {
      const drawing = this.state.drawings[i]
      if (!drawing.visible) continue
      const tool = toolRegistry.get(drawing.type)
      if (tool?.hitTest(drawing, px, py, mapper)) {
        return drawing
      }
    }
    return null
  }

  hitTestHandle(px: number, py: number, mapper: CoordinateMapper): { drawing: Drawing; handleIndex: number } | null {
    const selected = this.getSelectedDrawing()
    if (!selected) return null
    const tool = toolRegistry.get(selected.type)
    if (!tool) return null

    const handles = tool.getHandles(selected, mapper)
    for (let i = 0; i < handles.length; i++) {
      if (distanceToPoint(px, py, handles[i].x, handles[i].y) <= HANDLE_RADIUS + 2) {
        return { drawing: selected, handleIndex: i }
      }
    }
    return null
  }

  createDrawing(type: DrawingToolType, style?: Partial<DrawingStyle>): Drawing {
    return {
      id: generateId(),
      type,
      points: [],
      style: { ...this.state.currentStyle, ...style },
      locked: false,
      visible: true,
    }
  }

  setDrawingInProgress(drawing: Drawing | null): void {
    this.state.drawingInProgress = drawing
  }

  loadDrawings(drawings: Drawing[]): void {
    this.state.drawings = drawings
  }

  clearAll(): void {
    this.state.drawings = []
    this.state.selectedId = null
    this.state.drawingInProgress = null
  }

  render(ctx: CanvasRenderingContext2D, mapper: CoordinateMapper): void {
    for (const drawing of this.state.drawings) {
      if (!drawing.visible) continue
      const tool = toolRegistry.get(drawing.type)
      if (!tool) continue

      tool.render(ctx, drawing, mapper)

      // Draw handles for selected drawing
      if (drawing.id === this.state.selectedId) {
        const handles = tool.getHandles(drawing, mapper)
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.setLineDash([])

        for (const handle of handles) {
          ctx.beginPath()
          ctx.arc(handle.x, handle.y, HANDLE_RADIUS, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    // Render drawing in progress
    if (this.state.drawingInProgress) {
      const drawing = this.state.drawingInProgress
      const tool = toolRegistry.get(drawing.type)
      if (tool && drawing.points.length > 0) {
        tool.render(ctx, drawing, mapper)
      }
    }
  }
}
