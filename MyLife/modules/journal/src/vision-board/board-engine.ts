import type { BoardOrientation } from './types';
import { MAX_BOARDS, MAX_ITEMS_PER_BOARD } from './types';

export interface CanvasDimensions {
  width: number;
  height: number;
}

/**
 * Get the export pixel dimensions for a given orientation.
 */
export function getExportDimensions(orientation: BoardOrientation): CanvasDimensions {
  return orientation === 'portrait'
    ? { width: 1200, height: 1600 }
    : { width: 1600, height: 1200 };
}

/**
 * Convert normalized coordinates to pixel coordinates.
 */
export function normalizedToPixels(
  normalizedX: number,
  normalizedY: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: Math.round(normalizedX * canvasWidth),
    y: Math.round(normalizedY * canvasHeight),
  };
}

/**
 * Validate that the item size meets minimum requirements.
 */
export function validateItemSize(width: number, height: number): string | null {
  if (width < 0.05) return 'Item width must be at least 5% of canvas';
  if (height < 0.05) return 'Item height must be at least 5% of canvas';
  if (width > 1) return 'Item width cannot exceed canvas width';
  if (height > 1) return 'Item height cannot exceed canvas height';
  return null;
}

/**
 * Clamp a rotation value to the valid range.
 */
export function clampRotation(deg: number): number {
  if (deg > 180) return 180;
  if (deg < -180) return -180;
  return deg;
}

/**
 * Check whether the board limit has been reached.
 */
export function isBoardLimitReached(currentCount: number): boolean {
  return currentCount >= MAX_BOARDS;
}

/**
 * Check whether the item limit for a board has been reached.
 */
export function isItemLimitReached(currentCount: number): boolean {
  return currentCount >= MAX_ITEMS_PER_BOARD;
}
