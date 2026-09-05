/**
 * Canvas engine - pure functions for canvas operations.
 * Viewport culling, z-index management, and node spatial queries.
 */

import type { CanvasNode, Rect, CanvasViewport } from './types';

/**
 * Filter nodes to only those within the viewport bounds plus a buffer zone.
 */
export function viewportCull(
  nodes: CanvasNode[],
  viewport: Rect,
  buffer = 200,
): CanvasNode[] {
  const vx = viewport.x - buffer;
  const vy = viewport.y - buffer;
  const vw = viewport.w + buffer * 2;
  const vh = viewport.h + buffer * 2;

  return nodes.filter((n) =>
    n.x + n.w >= vx &&
    n.x <= vx + vw &&
    n.y + n.h >= vy &&
    n.y <= vy + vh,
  );
}

/**
 * Compute a viewport that fits all nodes with padding.
 * Returns null for empty node arrays.
 */
export function zoomToFit(
  nodes: CanvasNode[],
  containerWidth: number,
  containerHeight: number,
  padding = 50,
): CanvasViewport | null {
  if (nodes.length === 0) return null;

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));

  const contentW = maxX - minX + padding * 2;
  const contentH = maxY - minY + padding * 2;

  const zoomX = containerWidth / contentW;
  const zoomY = containerHeight / contentH;
  const zoom = Math.min(Math.max(zoomX, zoomY, 0.1), 5);

  // Center the content in the viewport
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: centerX - (containerWidth / zoom) / 2,
    y: centerY - (containerHeight / zoom) / 2,
    zoom,
  };
}

/**
 * Find the maximum z_index among nodes.
 */
export function getMaxZIndex(nodes: CanvasNode[]): number {
  if (nodes.length === 0) return 0;
  return Math.max(...nodes.map((n) => n.zIndex));
}

/**
 * Hit test: find the topmost node at a given point.
 * Checks in reverse z_index order (highest first).
 */
export function hitTestNode(
  nodes: CanvasNode[],
  px: number,
  py: number,
): CanvasNode | null {
  const sorted = [...nodes].sort((a, b) => b.zIndex - a.zIndex);
  return sorted.find((n) =>
    px >= n.x && px <= n.x + n.w &&
    py >= n.y && py <= n.y + n.h,
  ) ?? null;
}

/**
 * Find all nodes within a selection rectangle.
 */
export function selectNodesInRect(
  nodes: CanvasNode[],
  rect: Rect,
): CanvasNode[] {
  return nodes.filter((n) =>
    n.x >= rect.x &&
    n.y >= rect.y &&
    n.x + n.w <= rect.x + rect.w &&
    n.y + n.h <= rect.y + rect.h,
  );
}

/**
 * Compute the bounding box of a set of nodes.
 * Returns null for empty arrays.
 */
export function computeBoundingBox(nodes: CanvasNode[]): Rect | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Get all children of a group node.
 */
export function getGroupChildren(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  return nodes.filter((n) => n.groupId === groupId);
}

/**
 * Compute delta offsets for moving a group and all its children.
 */
export function computeGroupMove(
  nodes: CanvasNode[],
  groupId: string,
  dx: number,
  dy: number,
): Array<{ id: string; x: number; y: number }> {
  const children = getGroupChildren(nodes, groupId);
  const group = nodes.find((n) => n.id === groupId);
  const updates: Array<{ id: string; x: number; y: number }> = [];

  if (group) {
    updates.push({ id: group.id, x: group.x + dx, y: group.y + dy });
  }

  for (const child of children) {
    updates.push({ id: child.id, x: child.x + dx, y: child.y + dy });
  }

  return updates;
}
