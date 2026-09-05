// Types and schemas
export type {
  Canvas,
  CanvasNode,
  CanvasEdge,
  CanvasNodeType,
  CanvasShape,
  CanvasEdgeStyle,
  CanvasViewport,
  CanvasJson,
  CanvasNodeJson,
  CanvasEdgeJson,
  CanvasGroupJson,
  CreateCanvasInput,
  UpdateCanvasInput,
  AddNodeInput,
  AddEdgeInput,
  CanvasFilter,
  Rect,
} from './types';

export {
  CanvasSchema,
  CanvasNodeSchema,
  CanvasEdgeSchema,
  CanvasNodeTypeEnum,
  CanvasShapeEnum,
  CanvasEdgeStyleEnum,
  CanvasViewportSchema,
  CanvasJsonSchema,
  CanvasNodeJsonSchema,
  CanvasEdgeJsonSchema,
  CanvasGroupJsonSchema,
  CreateCanvasInputSchema,
  UpdateCanvasInputSchema,
  AddNodeInputSchema,
  AddEdgeInputSchema,
  CanvasFilterSchema,
} from './types';

// Engine
export {
  viewportCull,
  zoomToFit,
  getMaxZIndex,
  hitTestNode,
  selectNodesInRect,
  computeBoundingBox,
  getGroupChildren,
  computeGroupMove,
} from './engine';

// Layout
export {
  snapToGrid,
  snapPositionToGrid,
  clampZoom,
  screenToCanvas,
  canvasToScreen,
  viewportCenter,
  GRID_SIZES,
  BACKGROUND_PATTERNS,
} from './layout';
export type { GridSize, BackgroundPattern } from './layout';

// Serializer
export {
  parseCanvasJson,
  stringifyCanvasJson,
  serializeCanvas,
  extractViewport,
} from './serializer';
