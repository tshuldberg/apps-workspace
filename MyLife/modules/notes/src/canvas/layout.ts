/**
 * Canvas layout utilities - grid snap, alignment, and positioning helpers.
 */

/**
 * Snap a coordinate to the nearest grid point.
 */
export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a position (x, y) to the grid.
 */
export function snapPositionToGrid(
  x: number,
  y: number,
  gridSize: number,
): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize),
  };
}

/**
 * Clamp a zoom level to allowed range.
 */
export function clampZoom(zoom: number, min = 0.1, max = 5): number {
  return Math.min(Math.max(zoom, min), max);
}

/**
 * Convert screen coordinates to canvas coordinates given a viewport.
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  viewportX: number,
  viewportY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: viewportX + screenX / zoom,
    y: viewportY + screenY / zoom,
  };
}

/**
 * Convert canvas coordinates to screen coordinates.
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  viewportX: number,
  viewportY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (canvasX - viewportX) * zoom,
    y: (canvasY - viewportY) * zoom,
  };
}

/**
 * Calculate the center of the current viewport in canvas coordinates.
 */
export function viewportCenter(
  viewportX: number,
  viewportY: number,
  containerWidth: number,
  containerHeight: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: viewportX + containerWidth / (2 * zoom),
    y: viewportY + containerHeight / (2 * zoom),
  };
}

/**
 * Grid size options.
 */
export const GRID_SIZES = [10, 20, 40] as const;
export type GridSize = typeof GRID_SIZES[number];

/**
 * Background pattern types.
 */
export const BACKGROUND_PATTERNS = ['dots', 'lines', 'none'] as const;
export type BackgroundPattern = typeof BACKGROUND_PATTERNS[number];
