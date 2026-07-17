// === Display ===
export const NATIVE_WIDTH = 160;
export const NATIVE_HEIGHT = 144;
export const SCALE = 4;
export const SCREEN_WIDTH = NATIVE_WIDTH * SCALE;
export const SCREEN_HEIGHT = NATIVE_HEIGHT * SCALE;
export const TILE_SIZE = 16;
export const TILES_X = NATIVE_WIDTH / TILE_SIZE;   // 10 tiles across
export const TILES_Y = NATIVE_HEIGHT / TILE_SIZE;   // 9 tiles down
export const FPS = 60;
export const FRAME_TIME = 1000 / FPS;

// === Game Boy Palette ===
export const PALETTE = {
  WHITE: '#E0F8D0',
  LIGHT: '#88C070',
  DARK: '#346856',
  BLACK: '#081820',
} as const;

// === Input Keys ===
export const KEYS = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  A: 'z',
  B: 'x',
  START: 'Enter',
  SELECT: 'Backspace',
} as const;

// === Movement ===
export const WALK_SPEED = 4;          // pixels per frame during movement
export const WALK_FRAMES = TILE_SIZE / WALK_SPEED;  // 4 frames to cross a tile
export const ENCOUNTER_RATE = 21.67;  // out of 256, ~8.5%

// === Battle ===
export const MAX_PARTY_SIZE = 6;
export const MAX_MOVES = 4;
export const MAX_LEVEL = 100;
export const MAX_STAT_EXP = 65535;
export const MAX_DV = 15;
export const PC_BOX_COUNT = 12;
export const PC_BOX_SIZE = 20;

// === Stat Stage Multipliers (Gen 1) ===
// Index 0 = stage -6, index 6 = stage 0 (1.0), index 12 = stage +6
export const STAT_STAGE_MULTIPLIERS: readonly [number, number][] = [
  [25, 100],   // -6
  [28, 100],   // -5
  [33, 100],   // -4
  [40, 100],   // -3
  [50, 100],   // -2
  [66, 100],   // -1
  [1, 1],      //  0
  [15, 10],    // +1
  [2, 1],      // +2
  [25, 10],    // +3
  [3, 1],      // +4
  [35, 10],    // +5
  [4, 1],      // +6
];

export const ACCURACY_STAGE_MULTIPLIERS: readonly [number, number][] = [
  [33, 100],   // -6
  [36, 100],   // -5
  [43, 100],   // -4
  [50, 100],   // -3
  [60, 100],   // -2
  [75, 100],   // -1
  [1, 1],      //  0
  [133, 100],  // +1
  [166, 100],  // +2
  [2, 1],      // +3
  [233, 100],  // +4
  [266, 100],  // +5
  [3, 1],      // +6
];
