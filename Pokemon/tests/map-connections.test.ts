import { describe, expect, test } from 'vitest';
import type { GameMap, MapConnection } from '../src/data/game-types.ts';
import { MAP_REGISTRY } from '../src/data/maps/index.ts';
import { resolveConnectionLanding } from '../src/overworld/connections.ts';

const PASSABLE_COLLISIONS = new Set([0, 2, 3, 4, 5]);

function normalizeDirection(direction: string): 'up' | 'down' | 'left' | 'right' | null {
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

function getBoundaryExitTiles(map: GameMap, connection: MapConnection): Array<{ x: number; y: number; exitX: number; exitY: number }> {
  const direction = normalizeDirection(connection.direction as string);
  if (!direction) return [];

  const tiles: Array<{ x: number; y: number; exitX: number; exitY: number }> = [];
  if (direction === 'up') {
    for (let x = 0; x < map.width; x++) {
      const y = 0;
      if (!PASSABLE_COLLISIONS.has(map.collisions[y]?.[x] ?? 1)) continue;
      tiles.push({ x, y, exitX: x, exitY: -1 });
    }
  } else if (direction === 'down') {
    for (let x = 0; x < map.width; x++) {
      const y = map.height - 1;
      if (!PASSABLE_COLLISIONS.has(map.collisions[y]?.[x] ?? 1)) continue;
      tiles.push({ x, y, exitX: x, exitY: map.height });
    }
  } else if (direction === 'left') {
    for (let y = 0; y < map.height; y++) {
      const x = 0;
      if (!PASSABLE_COLLISIONS.has(map.collisions[y]?.[x] ?? 1)) continue;
      tiles.push({ x, y, exitX: -1, exitY: y });
    }
  } else {
    for (let y = 0; y < map.height; y++) {
      const x = map.width - 1;
      if (!PASSABLE_COLLISIONS.has(map.collisions[y]?.[x] ?? 1)) continue;
      tiles.push({ x, y, exitX: map.width, exitY: y });
    }
  }

  return tiles;
}

describe('Map connections', () => {
  test('every connection points to an existing target map', () => {
    for (const map of Object.values(MAP_REGISTRY)) {
      for (const connection of map.connections) {
        expect(MAP_REGISTRY[connection.mapId], `${map.id} -> ${connection.mapId}`).toBeDefined();
      }
    }
  });

  test('all boundary exits resolve to valid, passable landing tiles', () => {
    for (const map of Object.values(MAP_REGISTRY)) {
      for (const connection of map.connections) {
        const targetMap = MAP_REGISTRY[connection.mapId];
        expect(targetMap, `${map.id} missing target ${connection.mapId}`).toBeDefined();
        if (!targetMap) continue;

        const exitTiles = getBoundaryExitTiles(map, connection);
        expect(exitTiles.length, `${map.id} ${connection.direction} has no passable edge tiles`).toBeGreaterThan(0);

        for (const tile of exitTiles) {
          const landing = resolveConnectionLanding(connection, tile.exitX, tile.exitY, targetMap);
          expect(landing, `${map.id} ${connection.direction} from (${tile.x},${tile.y})`).not.toBeNull();
          if (!landing) continue;

          expect(landing.x, `${map.id} -> ${connection.mapId} x`).toBeGreaterThanOrEqual(0);
          expect(landing.y, `${map.id} -> ${connection.mapId} y`).toBeGreaterThanOrEqual(0);
          expect(landing.x, `${map.id} -> ${connection.mapId} x`).toBeLessThan(targetMap.width);
          expect(landing.y, `${map.id} -> ${connection.mapId} y`).toBeLessThan(targetMap.height);

          const landingCollision = targetMap.collisions[landing.y]?.[landing.x] ?? 1;
          expect(
            PASSABLE_COLLISIONS.has(landingCollision),
            `${map.id} ${connection.direction} from (${tile.x},${tile.y}) lands on blocked tile ${landingCollision} at (${landing.x},${landing.y}) in ${targetMap.id}`,
          ).toBe(true);
        }
      }
    }
  });
});
