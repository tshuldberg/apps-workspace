// Framework
export {
  type DrawingToolType,
  type InteractionMode,
  type LineStyle,
  type Point,
  type PixelPoint,
  type DrawingStyle,
  type Drawing,
  type DrawingState,
  type CoordinateMapper,
  DEFAULT_STYLE,
  createInitialState,
  generateId,
  applyLineStyle,
  pointToPixel,
  pixelToPoint,
  distanceToLine,
  distanceToPoint,
  HIT_TOLERANCE,
  HANDLE_RADIUS,
} from './framework.js'

// Tool Manager
export {
  type DrawingToolDefinition,
  registerDrawingTool,
  getDrawingTool,
  getAllDrawingTools,
  ToolManager,
} from './tool-manager.js'

// Register all drawing tools (side-effect imports)
import './lines/index.js'
import './channels/index.js'
import './fibonacci/index.js'
import './shapes/index.js'
import './annotations/index.js'
import './gann/index.js'
import './patterns/index.js'
import './measurement/index.js'

// Interactions
export {
  type InteractionCallbacks,
  setupDrawingInteractions,
} from './interactions.js'

// Undo/Redo
export { type UndoAction, UndoRedoStack } from './undo-redo.js'

// Snap
export { type SnapTarget, snapToOHLC, getVisibleSnapTargets } from './snap.js'
