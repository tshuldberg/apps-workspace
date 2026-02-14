import type { CoordinateMapper, Drawing, Point, PixelPoint } from './framework.js'
import { pixelToPoint, pointToPixel } from './framework.js'
import { ToolManager, getDrawingTool } from './tool-manager.js'
import type { UndoRedoStack } from './undo-redo.js'
import { snapToOHLC, type SnapTarget } from './snap.js'

export interface InteractionCallbacks {
  onDrawingAdded?: (drawing: Drawing) => void
  onDrawingUpdated?: (drawing: Drawing) => void
  onDrawingDeleted?: (drawing: Drawing) => void
  onSelectionChanged?: (drawing: Drawing | null) => void
  requestRedraw?: () => void
}

interface DragState {
  type: 'move' | 'resize'
  drawing: Drawing
  handleIndex: number
  startPixel: PixelPoint
  originalPoints: Point[]
}

export function setupDrawingInteractions(
  container: HTMLElement,
  manager: ToolManager,
  mapper: CoordinateMapper,
  undoRedo: UndoRedoStack,
  callbacks: InteractionCallbacks,
  snapTargets?: SnapTarget[],
): () => void {
  let dragState: DragState | null = null
  let pointsCollected = 0

  function getCanvasPosition(e: MouseEvent): PixelPoint {
    const rect = container.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return
    const pos = getCanvasPosition(e)
    const state = manager.getState()

    if (state.interactionMode === 'draw' && state.activeToolType) {
      const tool = getDrawingTool(state.activeToolType)
      if (!tool) return

      let drawPoint = pixelToPoint(pos, mapper)
      if (snapTargets) {
        drawPoint = snapToOHLC(drawPoint, mapper, snapTargets)
      }

      if (!state.drawingInProgress) {
        const drawing = manager.createDrawing(state.activeToolType)
        drawing.points.push(drawPoint)
        manager.setDrawingInProgress(drawing)
        pointsCollected = 1
      } else {
        state.drawingInProgress.points.push(drawPoint)
        pointsCollected++
      }

      if (state.drawingInProgress && pointsCollected >= tool.maxPoints) {
        const drawing = state.drawingInProgress
        manager.addDrawing(drawing)
        undoRedo.push({ type: 'add', drawing: { ...drawing, points: [...drawing.points] } })
        callbacks.onDrawingAdded?.(drawing)
        pointsCollected = 0
      }

      callbacks.requestRedraw?.()
      return
    }

    // Check for handle hit first
    const handleHit = manager.hitTestHandle(pos.x, pos.y, mapper)
    if (handleHit) {
      dragState = {
        type: 'resize',
        drawing: handleHit.drawing,
        handleIndex: handleHit.handleIndex,
        startPixel: pos,
        originalPoints: handleHit.drawing.points.map((p) => ({ ...p })),
      }
      return
    }

    // Check for drawing hit
    const hit = manager.hitTest(pos.x, pos.y, mapper)
    if (hit && !hit.locked) {
      manager.selectDrawing(hit.id)
      callbacks.onSelectionChanged?.(hit)
      dragState = {
        type: 'move',
        drawing: hit,
        handleIndex: -1,
        startPixel: pos,
        originalPoints: hit.points.map((p) => ({ ...p })),
      }
      callbacks.requestRedraw?.()
    } else {
      manager.selectDrawing(null)
      callbacks.onSelectionChanged?.(null)
      callbacks.requestRedraw?.()
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    const pos = getCanvasPosition(e)
    const state = manager.getState()

    // Drawing in progress - update preview for the next point
    if (state.drawingInProgress && state.drawingInProgress.points.length > 0) {
      let drawPoint = pixelToPoint(pos, mapper)
      if (snapTargets) {
        drawPoint = snapToOHLC(drawPoint, mapper, snapTargets)
      }
      // Update the last point for preview
      if (state.drawingInProgress.points.length > pointsCollected - 1) {
        state.drawingInProgress.points[pointsCollected] = drawPoint
      } else {
        state.drawingInProgress.points.push(drawPoint)
      }
      callbacks.requestRedraw?.()
      return
    }

    if (!dragState) {
      // Cursor changes
      const handleHit = manager.hitTestHandle(pos.x, pos.y, mapper)
      if (handleHit) {
        container.style.cursor = 'grab'
      } else {
        const hit = manager.hitTest(pos.x, pos.y, mapper)
        container.style.cursor = hit ? 'move' : state.activeToolType ? 'crosshair' : 'default'
      }
      return
    }

    const dx = pos.x - dragState.startPixel.x
    const dy = pos.y - dragState.startPixel.y

    if (dragState.type === 'move') {
      const newPoints = dragState.originalPoints.map((op) => {
        const origPixel = pointToPixel(op, mapper)
        return pixelToPoint({ x: origPixel.x + dx, y: origPixel.y + dy }, mapper)
      })
      manager.updateDrawing(dragState.drawing.id, { points: newPoints })
    } else if (dragState.type === 'resize') {
      const origPixel = pointToPixel(dragState.originalPoints[dragState.handleIndex], mapper)
      let newPoint = pixelToPoint({ x: origPixel.x + dx, y: origPixel.y + dy }, mapper)
      if (snapTargets) {
        newPoint = snapToOHLC(newPoint, mapper, snapTargets)
      }
      const newPoints = [...dragState.originalPoints.map((p) => ({ ...p }))]
      newPoints[dragState.handleIndex] = newPoint
      manager.updateDrawing(dragState.drawing.id, { points: newPoints })
    }

    callbacks.requestRedraw?.()
  }

  function handleMouseUp(): void {
    if (dragState) {
      const drawing = manager.getState().drawings.find((d) => d.id === dragState!.drawing.id)
      if (drawing) {
        undoRedo.push({
          type: 'modify',
          drawing: { ...drawing, points: [...drawing.points] },
          previousPoints: dragState.originalPoints,
        })
        callbacks.onDrawingUpdated?.(drawing)
      }
      dragState = null
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const selected = manager.getSelectedDrawing()
      if (selected && !selected.locked) {
        manager.deleteDrawing(selected.id)
        undoRedo.push({ type: 'delete', drawing: { ...selected, points: [...selected.points] } })
        callbacks.onDrawingDeleted?.(selected)
        callbacks.requestRedraw?.()
      }
    }

    if (e.key === 'Escape') {
      if (manager.getState().drawingInProgress) {
        manager.setDrawingInProgress(null)
        manager.setActiveTool(null)
        pointsCollected = 0
        callbacks.requestRedraw?.()
      } else {
        manager.selectDrawing(null)
        callbacks.onSelectionChanged?.(null)
        callbacks.requestRedraw?.()
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      if (e.shiftKey) {
        const action = undoRedo.redo()
        if (action) applyAction(action, false)
      } else {
        const action = undoRedo.undo()
        if (action) applyAction(action, true)
      }
    }
  }

  function applyAction(action: import('./undo-redo.js').UndoAction, isUndo: boolean): void {
    if (action.type === 'add') {
      if (isUndo) {
        manager.deleteDrawing(action.drawing.id)
      } else {
        manager.addDrawing(action.drawing)
      }
    } else if (action.type === 'delete') {
      if (isUndo) {
        manager.addDrawing(action.drawing)
      } else {
        manager.deleteDrawing(action.drawing.id)
      }
    } else if (action.type === 'modify') {
      if (isUndo && action.previousPoints) {
        manager.updateDrawing(action.drawing.id, { points: action.previousPoints })
      } else {
        manager.updateDrawing(action.drawing.id, { points: action.drawing.points })
      }
    }
    callbacks.requestRedraw?.()
  }

  container.addEventListener('mousedown', handleMouseDown)
  container.addEventListener('mousemove', handleMouseMove)
  container.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('keydown', handleKeyDown)

  return () => {
    container.removeEventListener('mousedown', handleMouseDown)
    container.removeEventListener('mousemove', handleMouseMove)
    container.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('keydown', handleKeyDown)
  }
}
