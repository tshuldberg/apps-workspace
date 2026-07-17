import type { GameMap, MapConnection } from '../data/game-types.ts';

type CanonicalDirection = 'up' | 'down' | 'left' | 'right';
type Edge = 'top' | 'bottom' | 'left' | 'right';

function normalizeDirection(direction: string): CanonicalDirection | null {
  switch (direction) {
    case 'up':
    case 'north':
      return 'up';
    case 'down':
    case 'south':
      return 'down';
    case 'left':
    case 'west':
      return 'left';
    case 'right':
    case 'east':
      return 'right';
    default:
      return null;
  }
}

function isLandingPassable(collision: number): boolean {
  // Allow all tiles a player can reasonably stand on after a map transition.
  return collision === 0 || collision === 2 || collision === 3 || collision === 4 || collision === 5;
}

function toClampedIndex(value: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, value));
}

function orderedIndices(length: number, preferred: number): number[] {
  if (length <= 0) return [];

  const center = toClampedIndex(preferred, length);
  const indices: number[] = [center];

  for (let distance = 1; distance < length; distance++) {
    const left = center - distance;
    const right = center + distance;
    if (left >= 0) indices.push(left);
    if (right < length) indices.push(right);
    if (indices.length >= length) break;
  }

  return indices;
}

function findBestEdgeLanding(
  targetMap: GameMap,
  edge: Edge,
  preferredX: number,
  preferredY: number,
): { x: number; y: number } | null {
  if (targetMap.width <= 0 || targetMap.height <= 0) return null;

  if (edge === 'top' || edge === 'bottom') {
    const y = edge === 'top' ? 0 : targetMap.height - 1;
    for (const x of orderedIndices(targetMap.width, preferredX)) {
      const collision = targetMap.collisions[y]?.[x] ?? 1;
      if (isLandingPassable(collision)) {
        return { x, y };
      }
    }
    return null;
  }

  const x = edge === 'left' ? 0 : targetMap.width - 1;
  for (const y of orderedIndices(targetMap.height, preferredY)) {
    const collision = targetMap.collisions[y]?.[x] ?? 1;
    if (isLandingPassable(collision)) {
      return { x, y };
    }
  }
  return null;
}

export function resolveConnectionLanding(
  connection: MapConnection,
  sourceX: number,
  sourceY: number,
  targetMap: GameMap,
): { x: number; y: number } | null {
  const direction = normalizeDirection(connection.direction as string);
  if (!direction) return null;

  switch (direction) {
    case 'up':
      return findBestEdgeLanding(targetMap, 'bottom', sourceX + connection.offset, targetMap.height - 1);
    case 'down':
      return findBestEdgeLanding(targetMap, 'top', sourceX + connection.offset, 0);
    case 'left':
      return findBestEdgeLanding(targetMap, 'right', targetMap.width - 1, sourceY + connection.offset);
    case 'right':
      return findBestEdgeLanding(targetMap, 'left', 0, sourceY + connection.offset);
    default:
      return null;
  }
}
