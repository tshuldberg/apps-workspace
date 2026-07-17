import { TILE_SIZE, NATIVE_WIDTH, NATIVE_HEIGHT } from '../constants.ts';
import type { GameMap, Warp, MapConnection } from '../data/game-types.ts';

// Tile color map for placeholder rendering
const TILE_COLORS: Record<number, string> = {
  0: '#88C070',   // grass
  1: '#78A858',   // tall-grass
  2: '#3890F8',   // water
  3: '#306030',   // tree
  4: '#805020',   // tree-trunk
  5: '#D8B870',   // path
  6: '#E8D880',   // sand
  7: '#C0C0C0',   // building-wall
  8: '#D04040',   // red roof
  9: '#4040D0',   // blue roof
  10: '#40D040',  // green roof
  11: '#804020',  // door
  12: '#E8D8C0',  // floor
  13: '#C06060',  // carpet
  14: '#A08860',  // counter
  15: '#907050',  // shelf
  16: '#60A0C0',  // pc-terminal
  17: '#404040',  // cave-wall
  18: '#808080',  // cave-floor
  19: '#78A858',  // ledge (render with dark bottom edge)
  20: '#B0A080',  // fence
  21: '#E06080',  // flowers
  22: '#A08050',  // sign
  23: '#A09080',  // stairs-up
  24: '#908070',  // stairs-down
  25: '#70B0E0',  // water-edge
  26: '#909090',  // boulder
  27: '#508838',  // cut-tree
  28: '#808080',  // gym-statue
};

const DEFAULT_TILE_COLOR = '#E0F8D0';

// Collision types (must match C constants in map-helpers.ts)
export const COLLISION = {
  WALKABLE: 0,
  SOLID: 1,
  WATER: 2,
  LEDGE: 3,
  TALL_GRASS: 4,
  WARP: 5,
  BOULDER: 6,
  CUT_TREE: 7,
} as const;

export class MapEngine {
  private currentMap: GameMap | null = null;
  private cameraX = 0;
  private cameraY = 0;
  private dynamicCollisions: Map<string, number> = new Map();

  get map(): GameMap | null {
    return this.currentMap;
  }

  get camX(): number {
    return this.cameraX;
  }

  get camY(): number {
    return this.cameraY;
  }

  loadMap(mapId: string, maps: Record<string, GameMap>): void {
    const map = maps[mapId];
    if (!map) return;
    this.currentMap = map;
    this.dynamicCollisions.clear();
  }

  setMap(map: GameMap): void {
    this.currentMap = map;
    this.dynamicCollisions.clear();
  }

  update(playerX: number, playerY: number): void {
    if (!this.currentMap) return;

    // Center camera on player
    const playerPixelX = playerX * TILE_SIZE;
    const playerPixelY = playerY * TILE_SIZE;

    this.cameraX = playerPixelX - Math.floor(NATIVE_WIDTH / 2) + Math.floor(TILE_SIZE / 2);
    this.cameraY = playerPixelY - Math.floor(NATIVE_HEIGHT / 2) + Math.floor(TILE_SIZE / 2);

    // Clamp to map edges
    const mapPixelW = this.currentMap.width * TILE_SIZE;
    const mapPixelH = this.currentMap.height * TILE_SIZE;

    this.cameraX = Math.max(0, Math.min(this.cameraX, mapPixelW - NATIVE_WIDTH));
    this.cameraY = Math.max(0, Math.min(this.cameraY, mapPixelH - NATIVE_HEIGHT));
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.currentMap) return;

    const map = this.currentMap;
    // Calculate visible tile range
    const startTileX = Math.floor(this.cameraX / TILE_SIZE);
    const startTileY = Math.floor(this.cameraY / TILE_SIZE);
    const endTileX = Math.min(startTileX + Math.ceil(NATIVE_WIDTH / TILE_SIZE) + 1, map.width);
    const endTileY = Math.min(startTileY + Math.ceil(NATIVE_HEIGHT / TILE_SIZE) + 1, map.height);

    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tileId = this.getTile(x, y);
        const screenX = x * TILE_SIZE - this.cameraX;
        const screenY = y * TILE_SIZE - this.cameraY;

        ctx.fillStyle = TILE_COLORS[tileId] ?? DEFAULT_TILE_COLOR;
        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

        // Ledge: draw dark bottom edge
        if (tileId === 19) {
          ctx.fillStyle = '#507040';
          ctx.fillRect(screenX, screenY + TILE_SIZE - 3, TILE_SIZE, 3);
        }

        // Tall grass: draw darker stripes
        if (tileId === 1) {
          ctx.fillStyle = '#68984A';
          for (let sx = 2; sx < TILE_SIZE; sx += 4) {
            ctx.fillRect(screenX + sx, screenY + 4, 1, TILE_SIZE - 6);
          }
        }

        // Door: draw darker frame
        if (tileId === 11) {
          ctx.fillStyle = '#603010';
          ctx.fillRect(screenX, screenY, TILE_SIZE, 1);
          ctx.fillRect(screenX, screenY, 1, TILE_SIZE);
          ctx.fillRect(screenX + TILE_SIZE - 1, screenY, 1, TILE_SIZE);
        }
      }
    }
  }

  getTile(x: number, y: number): number {
    if (!this.currentMap) return 0;
    const row = this.currentMap.tiles[y];
    if (!row) return 0;
    return row[x] ?? 0;
  }

  getCollision(x: number, y: number): number {
    if (!this.currentMap) return COLLISION.SOLID;

    // Check dynamic collision overrides (cut trees, pushed boulders)
    const key = `${x},${y}`;
    const dynamic = this.dynamicCollisions.get(key);
    if (dynamic !== undefined) return dynamic;

    // Check map bounds
    if (x < 0 || y < 0 || x >= this.currentMap.width || y >= this.currentMap.height) {
      return COLLISION.SOLID;
    }

    const row = this.currentMap.collisions[y];
    if (!row) return COLLISION.SOLID;
    return row[x] ?? COLLISION.SOLID;
  }

  isWalkable(x: number, y: number, isSurfing: boolean): boolean {
    const collision = this.getCollision(x, y);
    switch (collision) {
      case COLLISION.WALKABLE:
      case COLLISION.TALL_GRASS:
        return !isSurfing;
      case COLLISION.WATER:
        return isSurfing;
      case COLLISION.LEDGE:
      case COLLISION.WARP:
        return true; // Warp tiles (doors) are walkable — transition handled by checkPostStepEvents
      case COLLISION.SOLID:
      case COLLISION.BOULDER:
      case COLLISION.CUT_TREE:
        return false;
      default:
        return false;
    }
  }

  getWarp(x: number, y: number): Warp | null {
    if (!this.currentMap) return null;
    return this.currentMap.warps.find(w => w.x === x && w.y === y) ?? null;
  }

  getConnection(x: number, y: number): MapConnection | null {
    if (!this.currentMap) return null;
    const map = this.currentMap;

    // Map data uses both 'north'/'south' and 'up'/'down' conventions — accept both
    if (y < 0) return map.connections.find(c => c.direction === 'up' || (c.direction as string) === 'north') ?? null;
    if (y >= map.height) return map.connections.find(c => c.direction === 'down' || (c.direction as string) === 'south') ?? null;
    if (x < 0) return map.connections.find(c => c.direction === 'left' || (c.direction as string) === 'west') ?? null;
    if (x >= map.width) return map.connections.find(c => c.direction === 'right' || (c.direction as string) === 'east') ?? null;

    return null;
  }

  /** Remove a cut tree at the given position */
  removeCutTree(x: number, y: number): void {
    this.dynamicCollisions.set(`${x},${y}`, COLLISION.WALKABLE);
  }

  /** Set a dynamic collision at a position (for pushed boulders etc.) */
  setDynamicCollision(x: number, y: number, collision: number): void {
    this.dynamicCollisions.set(`${x},${y}`, collision);
  }
}
