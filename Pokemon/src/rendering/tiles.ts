// === Tile Atlas — Procedural 16x16 pixel tiles ===

const tileCanvases: Map<number, OffscreenCanvas> = new Map();

/** Pre-render all tiles to offscreen canvases */
export function initTiles(): void {
  tileCanvases.clear();
  for (let id = 0; id <= 28; id++) {
    const c = new OffscreenCanvas(16, 16);
    const ctx = c.getContext('2d')!;
    drawTileData(ctx, id);
    tileCanvases.set(id, c);
  }
}

/** Get a pre-rendered tile canvas */
export function getTile(id: number): OffscreenCanvas {
  let c = tileCanvases.get(id);
  if (!c) {
    c = new OffscreenCanvas(16, 16);
    const ctx = c.getContext('2d')!;
    drawTileData(ctx, id);
    tileCanvases.set(id, c);
  }
  return c;
}

function fill(ctx: OffscreenCanvasRenderingContext2D, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 16, 16);
}

function px(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawTileData(ctx: OffscreenCanvasRenderingContext2D, id: number): void {
  switch (id) {
    case 0: // Grass — light green with subtle dots
      fill(ctx, '#88C070');
      ctx.fillStyle = '#78B060';
      for (let i = 0; i < 6; i++) {
        const gx = ((i * 7 + 3) % 14) + 1;
        const gy = ((i * 5 + 2) % 14) + 1;
        ctx.fillRect(gx, gy, 1, 1);
      }
      break;

    case 1: // Tall grass — visible blade shapes
      fill(ctx, '#68A050');
      ctx.fillStyle = '#507838';
      for (let bx = 1; bx < 16; bx += 4) {
        ctx.fillRect(bx, 2, 1, 6);
        ctx.fillRect(bx + 1, 0, 1, 8);
        ctx.fillRect(bx + 2, 3, 1, 5);
      }
      ctx.fillStyle = '#88C070';
      for (let bx = 2; bx < 16; bx += 5) {
        ctx.fillRect(bx, 8, 1, 8);
        ctx.fillRect(bx + 1, 10, 1, 6);
      }
      break;

    case 2: // Water — blue with wave lines
      fill(ctx, '#3890F8');
      ctx.fillStyle = '#2070D0';
      for (let wy = 3; wy < 16; wy += 6) {
        for (let wx = 0; wx < 16; wx += 4) {
          ctx.fillRect(wx, wy, 2, 1);
          ctx.fillRect(wx + 2, wy + 1, 2, 1);
        }
      }
      break;

    case 3: // Tree canopy — dark green round
      fill(ctx, '#88C070');
      ctx.fillStyle = '#306030';
      // Round canopy
      px(ctx, 3, 0, 10, 2, '#306030');
      px(ctx, 1, 2, 14, 10, '#306030');
      px(ctx, 3, 12, 10, 2, '#306030');
      // Highlight
      px(ctx, 4, 2, 4, 3, '#408040');
      // Dark detail
      px(ctx, 8, 6, 3, 3, '#205020');
      break;

    case 4: // Tree trunk
      fill(ctx, '#88C070');
      ctx.fillStyle = '#806030';
      px(ctx, 5, 0, 6, 16, '#806030');
      px(ctx, 6, 0, 4, 16, '#907040');
      // Bark lines
      px(ctx, 7, 3, 1, 2, '#705020');
      px(ctx, 7, 8, 1, 2, '#705020');
      px(ctx, 7, 13, 1, 1, '#705020');
      break;

    case 5: // Path — sandy beige with stone pattern
      fill(ctx, '#D8C078');
      ctx.fillStyle = '#C8B068';
      px(ctx, 2, 2, 3, 2, '#C8B068');
      px(ctx, 10, 6, 4, 2, '#C8B068');
      px(ctx, 4, 11, 3, 2, '#C8B068');
      px(ctx, 12, 13, 2, 2, '#C8B068');
      break;

    case 6: // Sand — light yellow
      fill(ctx, '#E8D898');
      ctx.fillStyle = '#D8C888';
      px(ctx, 3, 4, 2, 1, '#D8C888');
      px(ctx, 9, 8, 2, 1, '#D8C888');
      px(ctx, 1, 12, 2, 1, '#D8C888');
      break;

    case 7: // Building wall — gray brick pattern
      fill(ctx, '#A8A8A8');
      // Brick lines
      ctx.fillStyle = '#888888';
      for (let by = 0; by < 16; by += 4) {
        ctx.fillRect(0, by + 3, 16, 1);
      }
      for (let bx = 0; bx < 16; bx += 8) {
        ctx.fillRect(bx + 3, 0, 1, 4);
        ctx.fillRect(bx + 7, 4, 1, 4);
        ctx.fillRect(bx + 3, 8, 1, 4);
        ctx.fillRect(bx + 7, 12, 1, 4);
      }
      break;

    case 8: // Red roof
      fill(ctx, '#D03030');
      ctx.fillStyle = '#B02020';
      for (let ry = 0; ry < 16; ry += 4) {
        ctx.fillRect(0, ry, 16, 1);
      }
      ctx.fillStyle = '#E04040';
      px(ctx, 2, 1, 4, 2, '#E04040');
      px(ctx, 10, 5, 4, 2, '#E04040');
      px(ctx, 4, 9, 4, 2, '#E04040');
      break;

    case 9: // Blue roof
      fill(ctx, '#3060C0');
      ctx.fillStyle = '#204080';
      for (let ry = 0; ry < 16; ry += 4) {
        ctx.fillRect(0, ry, 16, 1);
      }
      ctx.fillStyle = '#4080E0';
      px(ctx, 2, 1, 4, 2, '#4080E0');
      px(ctx, 10, 5, 4, 2, '#4080E0');
      break;

    case 10: // Green roof
      fill(ctx, '#30A030');
      ctx.fillStyle = '#208020';
      for (let ry = 0; ry < 16; ry += 4) {
        ctx.fillRect(0, ry, 16, 1);
      }
      ctx.fillStyle = '#40C040';
      px(ctx, 2, 1, 4, 2, '#40C040');
      px(ctx, 10, 5, 4, 2, '#40C040');
      break;

    case 11: // Door — brown with darker frame
      fill(ctx, '#A8A8A8');
      px(ctx, 3, 2, 10, 14, '#504030');
      px(ctx, 4, 3, 8, 12, '#806040');
      // Door handle
      px(ctx, 10, 9, 1, 2, '#FFD700');
      // Frame
      px(ctx, 3, 2, 1, 14, '#403020');
      px(ctx, 12, 2, 1, 14, '#403020');
      px(ctx, 3, 2, 10, 1, '#403020');
      break;

    case 12: // Floor — light wood
      fill(ctx, '#D8B888');
      ctx.fillStyle = '#C8A878';
      for (let fy = 0; fy < 16; fy += 8) {
        ctx.fillRect(0, fy + 7, 16, 1);
      }
      px(ctx, 7, 0, 1, 8, '#C8A878');
      px(ctx, 3, 8, 1, 8, '#C8A878');
      px(ctx, 11, 8, 1, 8, '#C8A878');
      break;

    case 13: // Carpet — red indoor
      fill(ctx, '#C03030');
      ctx.fillStyle = '#A02020';
      px(ctx, 0, 0, 16, 1, '#A02020');
      px(ctx, 0, 15, 16, 1, '#A02020');
      px(ctx, 0, 0, 1, 16, '#A02020');
      px(ctx, 15, 0, 1, 16, '#A02020');
      // Pattern dots
      ctx.fillStyle = '#D04040';
      px(ctx, 4, 4, 2, 2, '#D04040');
      px(ctx, 10, 10, 2, 2, '#D04040');
      break;

    case 14: // Counter — dark wood surface
      fill(ctx, '#605040');
      px(ctx, 0, 0, 16, 2, '#504030');
      px(ctx, 0, 14, 16, 2, '#706050');
      // Wood grain
      ctx.fillStyle = '#706050';
      px(ctx, 2, 5, 8, 1, '#706050');
      px(ctx, 4, 9, 6, 1, '#706050');
      break;

    case 15: // Shelf — bookshelf with colored spines
      fill(ctx, '#806040');
      // Shelf lines
      px(ctx, 0, 7, 16, 1, '#604020');
      px(ctx, 0, 15, 16, 1, '#604020');
      // Book spines
      const bookColors = ['#C03030', '#3060C0', '#30A030', '#C0A030', '#8030A0'];
      for (let bi = 0; bi < 5; bi++) {
        px(ctx, 1 + bi * 3, 0, 2, 7, bookColors[bi]!);
        px(ctx, 1 + bi * 3, 8, 2, 7, bookColors[(bi + 2) % 5]!);
      }
      break;

    case 16: // PC terminal
      fill(ctx, '#A8A8A8');
      // Monitor body
      px(ctx, 3, 1, 10, 10, '#505050');
      // Screen
      px(ctx, 4, 2, 8, 7, '#40A0F0');
      // Screen highlight
      px(ctx, 5, 3, 3, 2, '#80D0FF');
      // Base
      px(ctx, 5, 11, 6, 2, '#505050');
      px(ctx, 4, 13, 8, 2, '#606060');
      break;

    case 17: // Cave wall — dark gray rocky
      fill(ctx, '#404040');
      ctx.fillStyle = '#505050';
      px(ctx, 1, 1, 5, 4, '#505050');
      px(ctx, 9, 3, 4, 5, '#505050');
      px(ctx, 3, 9, 6, 4, '#505050');
      ctx.fillStyle = '#303030';
      px(ctx, 7, 0, 2, 3, '#303030');
      px(ctx, 0, 7, 3, 2, '#303030');
      px(ctx, 12, 10, 3, 3, '#303030');
      break;

    case 18: // Cave floor — medium gray
      fill(ctx, '#606060');
      ctx.fillStyle = '#505050';
      px(ctx, 3, 2, 2, 1, '#505050');
      px(ctx, 10, 7, 2, 1, '#505050');
      px(ctx, 5, 12, 2, 1, '#505050');
      ctx.fillStyle = '#707070';
      px(ctx, 8, 4, 2, 1, '#707070');
      px(ctx, 1, 9, 2, 1, '#707070');
      break;

    case 19: // Ledge — grass with dark edge on south
      fill(ctx, '#88C070');
      // Grass dots
      ctx.fillStyle = '#78B060';
      px(ctx, 3, 2, 1, 1, '#78B060');
      px(ctx, 10, 5, 1, 1, '#78B060');
      // South cliff edge
      px(ctx, 0, 13, 16, 1, '#506840');
      px(ctx, 0, 14, 16, 2, '#405030');
      break;

    case 20: // Fence — brown horizontal bars
      fill(ctx, '#88C070');
      ctx.fillStyle = '#806030';
      // Posts
      px(ctx, 1, 2, 2, 12, '#806030');
      px(ctx, 13, 2, 2, 12, '#806030');
      // Rails
      px(ctx, 0, 4, 16, 2, '#907040');
      px(ctx, 0, 10, 16, 2, '#907040');
      break;

    case 21: // Flowers — colorful on green
      fill(ctx, '#88C070');
      // Red flower
      px(ctx, 2, 3, 2, 2, '#E03030');
      px(ctx, 3, 2, 1, 1, '#E03030');
      px(ctx, 1, 3, 1, 1, '#E03030');
      // Yellow flower
      px(ctx, 8, 7, 2, 2, '#F0D000');
      px(ctx, 9, 6, 1, 1, '#F0D000');
      // White flower
      px(ctx, 4, 11, 2, 2, '#F0F0F0');
      px(ctx, 5, 10, 1, 1, '#F0F0F0');
      // Blue flower
      px(ctx, 11, 12, 2, 2, '#5050F0');
      // Stems
      ctx.fillStyle = '#508040';
      px(ctx, 3, 5, 1, 3, '#508040');
      px(ctx, 9, 9, 1, 2, '#508040');
      px(ctx, 5, 13, 1, 2, '#508040');
      break;

    case 22: // Sign — brown post on path
      fill(ctx, '#D8C078');
      // Post
      px(ctx, 6, 8, 4, 8, '#806030');
      // Sign board
      px(ctx, 2, 2, 12, 7, '#907040');
      px(ctx, 3, 3, 10, 5, '#A08050');
      // Text lines on sign
      px(ctx, 4, 4, 8, 1, '#605030');
      px(ctx, 4, 6, 6, 1, '#605030');
      break;

    case 23: // Stairs up
      fill(ctx, '#D8B888');
      for (let sy = 0; sy < 4; sy++) {
        const shade = 168 + sy * 20;
        ctx.fillStyle = `rgb(${shade},${shade - 30},${shade - 60})`;
        ctx.fillRect(0, sy * 4, 16 - sy * 3, 4);
      }
      // Edge
      ctx.fillStyle = '#A08060';
      for (let sy = 0; sy < 4; sy++) {
        ctx.fillRect(0, sy * 4, 16 - sy * 3, 1);
      }
      break;

    case 24: // Stairs down
      fill(ctx, '#D8B888');
      for (let sy = 0; sy < 4; sy++) {
        const shade = 168 + (3 - sy) * 20;
        ctx.fillStyle = `rgb(${shade},${shade - 30},${shade - 60})`;
        ctx.fillRect(sy * 3, sy * 4, 16 - sy * 3, 4);
      }
      ctx.fillStyle = '#A08060';
      for (let sy = 0; sy < 4; sy++) {
        ctx.fillRect(sy * 3, sy * 4, 16 - sy * 3, 1);
      }
      break;

    case 25: // Water edge — transition land/water
      fill(ctx, '#3890F8');
      // Top half is grass transitioning to water
      px(ctx, 0, 0, 16, 6, '#88C070');
      px(ctx, 0, 6, 16, 2, '#68A870');
      // Wave pattern in water
      ctx.fillStyle = '#2070D0';
      px(ctx, 2, 10, 3, 1, '#2070D0');
      px(ctx, 8, 12, 3, 1, '#2070D0');
      break;

    case 26: // Boulder — gray round rock
      fill(ctx, '#88C070');
      // Rock body
      px(ctx, 3, 3, 10, 10, '#808080');
      px(ctx, 4, 2, 8, 12, '#808080');
      px(ctx, 2, 5, 12, 6, '#808080');
      // Highlight
      px(ctx, 5, 4, 3, 2, '#A0A0A0');
      // Shadow
      px(ctx, 8, 10, 3, 2, '#606060');
      break;

    case 27: // Cut tree — small cuttable tree
      fill(ctx, '#88C070');
      // Small tree
      px(ctx, 4, 2, 8, 8, '#50A050');
      px(ctx, 3, 4, 10, 4, '#50A050');
      // Highlight
      px(ctx, 5, 3, 3, 2, '#60B060');
      // Trunk
      px(ctx, 6, 10, 4, 6, '#806030');
      break;

    case 28: // Gym statue — decorative
      fill(ctx, '#D8C078');
      // Base
      px(ctx, 3, 10, 10, 6, '#808080');
      px(ctx, 4, 9, 8, 1, '#909090');
      // Statue body
      px(ctx, 5, 2, 6, 8, '#A0A0A0');
      px(ctx, 6, 1, 4, 1, '#A0A0A0');
      // Pokeball symbol
      px(ctx, 6, 4, 4, 4, '#C03030');
      px(ctx, 6, 6, 4, 2, '#F0F0F0');
      px(ctx, 7, 5, 2, 2, '#303030');
      break;

    default:
      // Unknown tile — magenta checkerboard for debugging
      fill(ctx, '#FF00FF');
      ctx.fillStyle = '#FF80FF';
      for (let ty = 0; ty < 16; ty += 4) {
        for (let tx = 0; tx < 16; tx += 4) {
          if ((tx + ty) % 8 === 0) {
            ctx.fillRect(tx, ty, 4, 4);
          }
        }
      }
      break;
  }
}
