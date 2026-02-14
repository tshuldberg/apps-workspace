import type { Drawing, Point } from './framework.js'

export interface UndoAction {
  type: 'add' | 'delete' | 'modify'
  drawing: Drawing
  previousPoints?: Point[]
}

export class UndoRedoStack {
  private undoStack: UndoAction[] = []
  private redoStack: UndoAction[] = []
  private maxSize: number

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  push(action: UndoAction): void {
    this.undoStack.push(action)
    this.redoStack = []

    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift()
    }
  }

  undo(): UndoAction | null {
    const action = this.undoStack.pop()
    if (!action) return null
    this.redoStack.push(action)
    return action
  }

  redo(): UndoAction | null {
    const action = this.redoStack.pop()
    if (!action) return null
    this.undoStack.push(action)
    return action
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
