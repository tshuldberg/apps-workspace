import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  generateId,
  distanceToLine,
  distanceToPoint,
  applyLineStyle,
  pointToPixel,
  pixelToPoint,
  DEFAULT_STYLE,
  type CoordinateMapper,
  type DrawingStyle,
} from '../../src/drawings/framework.js'
import { ToolManager } from '../../src/drawings/tool-manager.js'
import { UndoRedoStack } from '../../src/drawings/undo-redo.js'
import { snapToOHLC, type SnapTarget } from '../../src/drawings/snap.js'

const mockMapper: CoordinateMapper = {
  timeToX: (t) => t / 1000,
  priceToY: (p) => 600 - p * 3,
  xToTime: (x) => x * 1000,
  yToPrice: (y) => (600 - y) / 3,
}

describe('Framework utilities', () => {
  it('createInitialState returns default state', () => {
    const state = createInitialState()
    expect(state.drawings).toHaveLength(0)
    expect(state.selectedId).toBeNull()
    expect(state.activeToolType).toBeNull()
    expect(state.interactionMode).toBe('select')
  })

  it('generateId returns unique ids', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) ids.add(generateId())
    expect(ids.size).toBe(100)
  })

  it('distanceToLine calculates correctly', () => {
    // Point at (5, 5), line from (0, 0) to (10, 0)
    expect(distanceToLine(5, 5, 0, 0, 10, 0)).toBeCloseTo(5, 5)
    // Point on the line
    expect(distanceToLine(5, 0, 0, 0, 10, 0)).toBeCloseTo(0, 5)
  })

  it('distanceToPoint calculates correctly', () => {
    expect(distanceToPoint(3, 4, 0, 0)).toBeCloseTo(5, 5)
  })

  it('pointToPixel and pixelToPoint are inverses', () => {
    const point = { time: 5000, price: 100 }
    const pixel = pointToPixel(point, mockMapper)
    const back = pixelToPoint(pixel, mockMapper)
    expect(back.time).toBeCloseTo(point.time, 1)
    expect(back.price).toBeCloseTo(point.price, 1)
  })
})

describe('ToolManager', () => {
  it('creates with empty state', () => {
    const tm = new ToolManager()
    expect(tm.getState().drawings).toHaveLength(0)
  })

  it('setActiveTool changes mode to draw', () => {
    const tm = new ToolManager()
    tm.setActiveTool('trendline')
    expect(tm.getState().activeToolType).toBe('trendline')
    expect(tm.getState().interactionMode).toBe('draw')
  })

  it('setActiveTool(null) changes mode to select', () => {
    const tm = new ToolManager()
    tm.setActiveTool('trendline')
    tm.setActiveTool(null)
    expect(tm.getState().activeToolType).toBeNull()
    expect(tm.getState().interactionMode).toBe('select')
  })

  it('addDrawing / deleteDrawing', () => {
    const tm = new ToolManager()
    const drawing = tm.createDrawing('trendline')
    drawing.points = [
      { time: 1000, price: 100 },
      { time: 2000, price: 110 },
    ]
    tm.addDrawing(drawing)
    expect(tm.getState().drawings).toHaveLength(1)
    expect(tm.getState().selectedId).toBe(drawing.id)

    const removed = tm.deleteDrawing(drawing.id)
    expect(removed).not.toBeNull()
    expect(tm.getState().drawings).toHaveLength(0)
    expect(tm.getState().selectedId).toBeNull()
  })

  it('updateDrawing modifies points', () => {
    const tm = new ToolManager()
    const drawing = tm.createDrawing('horizontal-line')
    drawing.points = [{ time: 1000, price: 100 }]
    tm.addDrawing(drawing)

    tm.updateDrawing(drawing.id, { points: [{ time: 1000, price: 120 }] })
    expect(tm.getState().drawings[0].points[0].price).toBe(120)
  })

  it('selectDrawing / getSelectedDrawing', () => {
    const tm = new ToolManager()
    const drawing = tm.createDrawing('rectangle')
    drawing.points = [
      { time: 1000, price: 100 },
      { time: 2000, price: 110 },
    ]
    tm.addDrawing(drawing)

    tm.selectDrawing(drawing.id)
    expect(tm.getSelectedDrawing()?.id).toBe(drawing.id)

    tm.selectDrawing(null)
    expect(tm.getSelectedDrawing()).toBeNull()
  })

  it('clearAll removes everything', () => {
    const tm = new ToolManager()
    for (let i = 0; i < 5; i++) {
      const d = tm.createDrawing('trendline')
      d.points = [
        { time: i * 1000, price: 100 },
        { time: (i + 1) * 1000, price: 110 },
      ]
      tm.addDrawing(d)
    }
    expect(tm.getState().drawings).toHaveLength(5)
    tm.clearAll()
    expect(tm.getState().drawings).toHaveLength(0)
  })

  it('loadDrawings replaces state', () => {
    const tm = new ToolManager()
    const d = tm.createDrawing('circle')
    d.points = [
      { time: 1000, price: 100 },
      { time: 2000, price: 110 },
    ]
    tm.loadDrawings([d])
    expect(tm.getState().drawings).toHaveLength(1)
  })

  it('setStyle updates currentStyle', () => {
    const tm = new ToolManager()
    tm.setStyle({ color: '#ff0000', lineWidth: 5 })
    expect(tm.getState().currentStyle.color).toBe('#ff0000')
    expect(tm.getState().currentStyle.lineWidth).toBe(5)
  })
})

describe('UndoRedoStack', () => {
  it('push and undo', () => {
    const stack = new UndoRedoStack()
    const drawing = {
      id: 'test-1',
      type: 'trendline' as const,
      points: [{ time: 1000, price: 100 }],
      style: { ...DEFAULT_STYLE },
      locked: false,
      visible: true,
    }
    stack.push({ type: 'add', drawing })
    expect(stack.canUndo()).toBe(true)
    expect(stack.canRedo()).toBe(false)

    const action = stack.undo()
    expect(action?.type).toBe('add')
    expect(stack.canUndo()).toBe(false)
    expect(stack.canRedo()).toBe(true)
  })

  it('redo after undo', () => {
    const stack = new UndoRedoStack()
    const drawing = {
      id: 'test-1',
      type: 'trendline' as const,
      points: [{ time: 1000, price: 100 }],
      style: { ...DEFAULT_STYLE },
      locked: false,
      visible: true,
    }
    stack.push({ type: 'add', drawing })
    stack.undo()
    const action = stack.redo()
    expect(action?.type).toBe('add')
  })

  it('push clears redo stack', () => {
    const stack = new UndoRedoStack()
    const drawing = {
      id: 'test-1',
      type: 'trendline' as const,
      points: [{ time: 1000, price: 100 }],
      style: { ...DEFAULT_STYLE },
      locked: false,
      visible: true,
    }
    stack.push({ type: 'add', drawing })
    stack.undo()
    expect(stack.canRedo()).toBe(true)

    stack.push({ type: 'delete', drawing })
    expect(stack.canRedo()).toBe(false)
  })

  it('respects max size', () => {
    const stack = new UndoRedoStack(3)
    for (let i = 0; i < 5; i++) {
      stack.push({
        type: 'add',
        drawing: {
          id: `d-${i}`,
          type: 'trendline',
          points: [],
          style: { ...DEFAULT_STYLE },
          locked: false,
          visible: true,
        },
      })
    }
    // Should only be able to undo 3 times
    expect(stack.undo()).not.toBeNull()
    expect(stack.undo()).not.toBeNull()
    expect(stack.undo()).not.toBeNull()
    expect(stack.undo()).toBeNull()
  })

  it('clear empties both stacks', () => {
    const stack = new UndoRedoStack()
    stack.push({
      type: 'add',
      drawing: {
        id: 'test-1',
        type: 'trendline',
        points: [],
        style: { ...DEFAULT_STYLE },
        locked: false,
        visible: true,
      },
    })
    stack.clear()
    expect(stack.canUndo()).toBe(false)
    expect(stack.canRedo()).toBe(false)
  })
})

describe('Snap', () => {
  const targets: SnapTarget[] = [
    { time: 1000, open: 100, high: 105, low: 95, close: 102 },
    { time: 2000, open: 103, high: 108, low: 98, close: 106 },
  ]

  it('snaps to nearby OHLC value', () => {
    // Point near the high of first target
    const point = { time: 1000, price: 104.5 }
    const snapped = snapToOHLC(point, mockMapper, targets)
    // Should snap to 105 (high)
    expect(snapped.price).toBe(105)
  })

  it('returns original point when no targets nearby', () => {
    const point = { time: 50000, price: 500 }
    const snapped = snapToOHLC(point, mockMapper, targets)
    expect(snapped).toBe(point)
  })

  it('handles empty targets', () => {
    const point = { time: 1000, price: 100 }
    const snapped = snapToOHLC(point, mockMapper, [])
    expect(snapped).toBe(point)
  })
})
