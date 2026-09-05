export type { BoardOrientation, VisionBoardItemType, VisionBoard, VisionBoardItem } from './types';
export {
  BoardOrientationSchema,
  VisionBoardItemTypeSchema,
  VisionBoardSchema,
  VisionBoardItemSchema,
  MAX_BOARDS,
  MAX_ITEMS_PER_BOARD,
} from './types';
export {
  getExportDimensions,
  normalizedToPixels,
  validateItemSize,
  clampRotation,
  isBoardLimitReached,
  isItemLimitReached,
} from './board-engine';
export type { CanvasDimensions } from './board-engine';
