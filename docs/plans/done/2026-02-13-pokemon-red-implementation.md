# Pokemon Red Recreation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete, playable Pokemon Red recreation as a browser game with programmatic pixel art, all 151 Pokemon, full Kanto region, and Gen 1 battle mechanics.

**Architecture:** TypeScript + HTML5 Canvas, scene-stack game loop at 160×144 native resolution scaled 4× to 640×576. All game data compiled as static TypeScript constants. Zero runtime dependencies. Bun for bundling, Vitest for testing.

**Tech Stack:** TypeScript 5.x, Bun, HTML5 Canvas 2D, Web Audio API, Vitest

---

## Phase 1: Project Scaffold & Core Infrastructure

### Task 1: Project Setup

**Files:**
- Create: `Pokemon/package.json`
- Create: `Pokemon/tsconfig.json`
- Create: `Pokemon/index.html`
- Create: `Pokemon/CLAUDE.md`
- Create: `Pokemon/timeline.md`
- Create: `Pokemon/vitest.config.ts`
- Create: `Pokemon/src/main.ts`
- Create: `Pokemon/src/constants.ts`

**Step 1: Initialize project**

```bash
cd /Users/trey/Desktop/Apps/Pokemon
bun init -y
bun add -d typescript vitest @types/web
```

**Step 2: Create package.json with scripts**

```json
{
  "name": "pokemon-red",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "bun build src/main.ts --outdir dist --minify",
    "dev": "bun build src/main.ts --outdir dist --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

**Step 4: Create index.html**

Single HTML file with a `<canvas>` element, loads `dist/main.js`. Canvas sized 640×576. Black background. Keyboard event listeners.

**Step 5: Create constants.ts**

```typescript
// Display
export const NATIVE_WIDTH = 160;
export const NATIVE_HEIGHT = 144;
export const SCALE = 4;
export const SCREEN_WIDTH = NATIVE_WIDTH * SCALE;
export const SCREEN_HEIGHT = NATIVE_HEIGHT * SCALE;
export const TILE_SIZE = 16;
export const FPS = 60;
export const FRAME_TIME = 1000 / FPS;

// Game Boy palette
export const PALETTE = {
  WHITE: '#E0F8D0',
  LIGHT: '#88C070',
  DARK: '#346856',
  BLACK: '#081820',
} as const;

// Input mapping
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
```

**Step 6: Create main.ts game loop**

```typescript
import { NATIVE_WIDTH, NATIVE_HEIGHT, SCALE, FRAME_TIME } from './constants';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

// Offscreen canvas at native resolution
const buffer = new OffscreenCanvas(NATIVE_WIDTH, NATIVE_HEIGHT);
const bufCtx = buffer.getContext('2d')!;

let lastTime = 0;
let accumulator = 0;

function gameLoop(timestamp: number) {
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  accumulator += delta;

  while (accumulator >= FRAME_TIME) {
    update();
    accumulator -= FRAME_TIME;
  }

  render();
  requestAnimationFrame(gameLoop);
}

function update() {
  // Scene stack update
}

function render() {
  // Clear buffer, render scene, scale to display
  bufCtx.fillStyle = '#081820';
  bufCtx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

  // Scale buffer to display canvas
  ctx.drawImage(buffer, 0, 0, NATIVE_WIDTH, NATIVE_HEIGHT,
    0, 0, NATIVE_WIDTH * SCALE, NATIVE_HEIGHT * SCALE);
}

requestAnimationFrame(gameLoop);
```

**Step 7: Build and verify**

```bash
bun run build
open index.html  # Should show black screen
```

**Step 8: Commit**

```bash
git add Pokemon/
git commit -m "feat(pokemon): project scaffold with game loop, canvas, and build system"
```

---

### Task 2: Input Manager

**Files:**
- Create: `Pokemon/src/input.ts`
- Test: `Pokemon/tests/input.test.ts`

Implement keyboard input manager that tracks pressed/just-pressed/just-released states for all 8 buttons (Up, Down, Left, Right, A, B, Start, Select). Must support both `isDown(key)` for held keys and `isPressed(key)` for single-frame presses. Call `update()` each frame to cycle just-pressed states.

---

### Task 3: Scene Manager

**Files:**
- Create: `Pokemon/src/scenes/scene.ts` — Scene interface with `enter()`, `exit()`, `update()`, `render(ctx)` methods
- Create: `Pokemon/src/scenes/manager.ts` — Scene stack: `push(scene)`, `pop()`, `replace(scene)`. Top scene gets `update/render` calls. Supports overlays.

---

### Task 4: Text Renderer

**Files:**
- Create: `Pokemon/src/rendering/text.ts`
- Test: `Pokemon/tests/text.test.ts`

Pixel font renderer using an 8×8 character grid. Supports uppercase A-Z, 0-9, and common punctuation. Characters defined as 8×8 bit arrays drawn with `fillRect`. Must support:
- `drawText(ctx, text, x, y, palette?)` — render string at position
- `drawTextBox(ctx, text, x, y, width, height)` — bordered text window with word wrap
- Typewriter effect (one character at a time, configurable speed)
- Text scroll when box is full

---

### Task 5: Menu UI System

**Files:**
- Create: `Pokemon/src/rendering/menu-ui.ts`

Render Game Boy-style menu windows with:
- Bordered windows (double-line border using tile patterns)
- Scrollable option lists with cursor arrow
- Selection handling (move cursor, confirm with A, cancel with B)
- HP bars (green > yellow > red based on %)
- EXP bars

---

## Phase 2: Complete Data Layer

### Task 6: Type System & Chart

**Files:**
- Create: `Pokemon/src/data/types.ts`
- Test: `Pokemon/tests/type-chart.test.ts`

All 15 Gen 1 types: Normal, Fire, Water, Electric, Grass, Ice, Fighting, Poison, Ground, Flying, Psychic, Bug, Rock, Ghost, Dragon.

Type effectiveness as a 15×15 lookup table returning multipliers: 0 (immune), 0.5 (not very effective), 1 (normal), 2 (super effective).

Gen 1 specific quirks:
- Ghost has NO EFFECT on Psychic (this was a bug in Gen 1)
- Bug is super effective on Poison
- Poison is super effective on Bug

Test every known super-effective, not-very-effective, and immune matchup.

---

### Task 7: Pokemon Database (All 151)

**Files:**
- Create: `Pokemon/src/data/pokemon.ts`
- Test: `Pokemon/tests/pokemon.test.ts`

Each Pokemon entry:
```typescript
interface PokemonSpecies {
  id: number;            // 1-151
  name: string;
  types: [Type] | [Type, Type];
  baseStats: { hp: number; attack: number; defense: number; special: number; speed: number };
  catchRate: number;     // 0-255
  baseExp: number;       // Base experience yield
  growthRate: GrowthRate;
  learnset: { level: number; moveId: number }[];
  tmCompatibility: number[];  // TM numbers this Pokemon can learn
  hmCompatibility: number[];  // HM numbers
  evolution: EvolutionData | null;
  frontSprite: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  backSprite: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
  miniSprite: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
}
```

All 151 Pokemon with accurate base stats, types, catch rates, growth rates, and learnsets. Data sourced from public Pokemon databases.

Tests: Verify count is 151, all have valid types, all stats are positive, Bulbasaur has correct stats, Mewtwo has correct stats, etc.

---

### Task 8: Move Database (All 165)

**Files:**
- Create: `Pokemon/src/data/moves.ts`
- Test: `Pokemon/tests/moves.test.ts`

Each move entry:
```typescript
interface MoveData {
  id: number;
  name: string;
  type: Type;
  category: 'physical' | 'special' | 'status';
  power: number | null;    // null for status moves
  accuracy: number | null; // null for always-hit moves
  pp: number;
  effect: MoveEffect;      // enum: none, burn, freeze, paralyze, poison, sleep, confusion,
                           // flinch, stat_up, stat_down, recoil, drain, multi_hit,
                           // charge, recharge, ohko, fixed_damage, etc.
  effectChance: number;    // 0-100, chance of secondary effect
  priority: number;        // 0 normal, 1 for Quick Attack
}
```

All 165 Gen 1 moves with accurate power, accuracy, PP, type, and effects.

Gen 1 physical/special split: determined by TYPE, not move. Fire/Water/Electric/Grass/Ice/Psychic/Dragon = Special. Normal/Fighting/Poison/Ground/Flying/Bug/Rock/Ghost = Physical.

---

### Task 9: Item Database

**Files:**
- Create: `Pokemon/src/data/items.ts`

All Gen 1 items organized by category:
- **Pokeballs:** Poke Ball, Great Ball, Ultra Ball, Master Ball, Safari Ball
- **Medicine:** Potion, Super Potion, Hyper Potion, Max Potion, Full Restore, Revive, Max Revive, Antidote, Burn Heal, Ice Heal, Awakening, Parlyz Heal, Full Heal
- **Battle items:** X Attack, X Defend, X Speed, X Special, Guard Spec, Dire Hit
- **Evolution stones:** Fire Stone, Water Stone, Thunder Stone, Leaf Stone, Moon Stone
- **Key items:** Bicycle, Old Rod, Good Rod, Super Rod, Town Map, Poke Flute, Silph Scope, Lift Key, Card Key, S.S. Ticket, Gold Teeth, Secret Key, etc.
- **TMs (1-50) and HMs (1-5):** Map TM number to move ID
- **Held/misc:** Rare Candy, PP Up, Calcium, Iron, Protein, Carbos, HP Up, Nugget, Escape Rope, Repel, Super Repel, Max Repel

---

### Task 10: Trainer Database

**Files:**
- Create: `Pokemon/src/data/trainers.ts`

All trainers organized by class:
- **Gym Leaders:** Brock (Rock), Misty (Water), Lt. Surge (Electric), Erika (Grass), Koga (Poison), Sabrina (Psychic), Blaine (Fire), Giovanni (Ground) — each with full team, levels, and movesets
- **Elite Four:** Lorelei (Ice), Bruno (Fighting), Agatha (Ghost), Lance (Dragon) — full teams
- **Champion:** Blue/Rival — 3 possible teams based on starter choice
- **Regular trainer classes:** Bug Catcher, Youngster, Lass, Hiker, Biker, etc. — each trainer with Pokemon team for their route location
- **Rival encounters:** 7 total through the game with progressive teams

---

## Phase 3: Battle Engine

### Task 11: Stat Calculation

**Files:**
- Create: `Pokemon/src/battle/stats.ts`
- Test: `Pokemon/tests/stats.test.ts`

Gen 1 stat formulas:

**HP:** `floor(((Base + IV) * 2 + floor(ceil(sqrt(StatExp)) / 4)) * Level / 100) + Level + 10`

**Other stats:** `floor(((Base + IV) * 2 + floor(ceil(sqrt(StatExp)) / 4)) * Level / 100) + 5`

**IV/DV system:**
- Attack, Defense, Speed, Special each get a DV from 0-15
- HP DV is derived: `(AttackDV % 2) * 8 + (DefenseDV % 2) * 4 + (SpeedDV % 2) * 2 + (SpecialDV % 2)`

**Stat experience:**
- Gained equal to defeated Pokemon's base stat values
- Accumulated per stat, max 65535
- Applied via `floor(ceil(sqrt(StatExp)) / 4)` in stat calc

Tests: Verify specific known stat calculations (Level 5 Charmander, Level 100 Mewtwo with max DVs/stat exp).

---

### Task 12: Damage Calculation

**Files:**
- Create: `Pokemon/src/battle/damage.ts`
- Test: `Pokemon/tests/damage.test.ts`

Gen 1 damage formula:
```
1. If critical hit, use attacker's unmodified Attack and defender's unmodified Defense
   Otherwise, use modified stats (including stage multipliers, Reflect/Light Screen)
2. For special moves, use Special stat for both attack and defense
3. If A or D >= 256: A = floor(A/4) % 256; D = floor(D/4) % 256; if A==0 then A=1
4. damage = floor(floor(floor(2 * Level * Critical / 5 + 2) * Power * A / D) / 50) + 2
5. If STAB: damage = floor(damage * 3 / 2)
6. Apply type effectiveness: damage = floor(damage * effectiveness)
   (For dual types: multiply both, so can be 4× or 0.25×)
7. If damage > 0: damage = max(1, floor(damage * random(217..255) / 255))
```

**Critical hit rate:** `floor(BaseSpeed / 2)` out of 256. For high-crit moves (Slash, Razor Leaf, etc.): `floor(BaseSpeed * 4)` out of 256, capped at 255.

**Stat stage multipliers (Gen 1):**
| Stage | Multiplier |
|-------|-----------|
| -6    | 25/100    |
| -5    | 28/100    |
| -4    | 33/100    |
| -3    | 40/100    |
| -2    | 50/100    |
| -1    | 66/100    |
| 0     | 1/1       |
| +1    | 150/100   |
| +2    | 2/1       |
| +3    | 250/100   |
| +4    | 3/1       |
| +5    | 350/100   |
| +6    | 4/1       |

Tests: Verify specific damage ranges, STAB multiplier, type effectiveness stacking, critical hit bypass of stat stages.

---

### Task 13: Battle Engine Core

**Files:**
- Create: `Pokemon/src/battle/engine.ts`
- Create: `Pokemon/src/battle/types.ts`
- Test: `Pokemon/tests/battle.test.ts`

Turn resolution:
1. Both sides select action (Fight/Item/Switch/Run)
2. Priority check: switching always goes first, items go first, then moves by speed (Quick Attack priority +1)
3. Execute attacker's move: accuracy check → damage calc → apply damage → check fainting → secondary effects
4. Execute defender's move (if still alive)
5. End-of-turn effects: poison/burn damage, Leech Seed, binding moves tick
6. Check for battle end conditions

Battle state:
```typescript
interface BattleState {
  playerPokemon: ActivePokemon;
  enemyPokemon: ActivePokemon;
  playerParty: Pokemon[];
  enemyParty: Pokemon[];  // For trainer battles
  isWild: boolean;
  isTrainer: boolean;
  weather: null;  // No weather in Gen 1
  turnCount: number;
  canRun: boolean;
}

interface ActivePokemon {
  pokemon: Pokemon;
  statStages: { attack: number; defense: number; speed: number; special: number; accuracy: number; evasion: number };
  volatileStatus: Set<VolatileStatus>;  // confusion, flinch, bound, seeded, etc.
  substitute: number;  // substitute HP remaining
  isRecharging: boolean;
  isCharging: boolean;
  disabledMove: number | null;
  disabledTurns: number;
}
```

---

### Task 14: Move Effect System

**Files:**
- Create: `Pokemon/src/battle/move-effects.ts`
- Test: `Pokemon/tests/move-effects.test.ts`

Implement all unique move effects in Gen 1:
- **Damage only:** Tackle, Pound, etc.
- **Status infliction:** Thunder Wave (paralyze), Hypnosis (sleep), Toxic (badly poison), Will-O-Wisp, etc.
- **Stat modification:** Growl (-1 Attack), Swords Dance (+2 Attack), Agility (+2 Speed), etc.
- **Multi-hit:** Double Kick (2 hits), Fury Attack (2-5 hits), Pin Missile, etc.
- **Recoil:** Take Down (25% recoil), Double-Edge (25% recoil), Submission, etc.
- **Drain:** Absorb, Mega Drain, Leech Life (heal 50% of damage dealt)
- **OHKO:** Horn Drill, Fissure, Guillotine (KO if hits, fail if target faster)
- **Fixed damage:** Dragon Rage (40), SonicBoom (20), Seismic Toss (=level), Night Shade (=level), Psywave (random 1 to 1.5×level)
- **Charge moves:** Solar Beam, Fly, Dig, Skull Bash, Sky Attack, Razor Wind
- **Recharge moves:** Hyper Beam
- **Binding:** Wrap, Bind, Fire Spin, Clamp (2-5 turns, prevent action in Gen 1)
- **Self-destruct:** Explosion, Self-Destruct (halve target's defense for calc)
- **Recovery:** Recover, Softboiled, Rest (full heal + 2 turn sleep)
- **Transform, Mimic, Metronome, Mirror Move, Disable, Substitute, Bide, Counter**
- **Conversion, Haze, Mist, Focus Energy, Reflect, Light Screen**

---

### Task 15: Catch Mechanics

**Files:**
- Create: `Pokemon/src/battle/catch.ts`
- Test: `Pokemon/tests/catch.test.ts`

Gen 1 catch algorithm:
```
1. If Master Ball: catch succeeds
2. Generate random number R1 (0-255)
3. statusThreshold = 0 if no status, 12 if sleep/freeze, 25 if other status
4. If R1 < statusThreshold: catch succeeds (ball doesn't shake)
5. Else:
   a. ballFactor = 255 for Poke Ball, 200 for Great Ball, 150 for Ultra Ball
   b. If R1 - statusThreshold >= catchRate of species: catch fails
   c. hpFactor = floor(pokemon.maxHP * 255 / ballDivisor) where ballDivisor = 8 for Great Ball, 12 for others
   d. hpFactor = max(1, floor(hpFactor / max(1, floor(pokemon.currentHP / 4))))
   e. Generate random number R2 (0-255)
   f. If R2 <= hpFactor: catch succeeds
   g. Else: catch fails
6. Wobble calculation (0-3 shakes before breaking out)
```

Tests: Master Ball always catches, full HP vs 1 HP catch rates, status bonus, different ball types.

---

### Task 16: Trainer AI

**Files:**
- Create: `Pokemon/src/battle/ai.ts`
- Test: `Pokemon/tests/ai.test.ts`

Gen 1 trainer AI:
- Calculate estimated damage for each available move against player's active Pokemon
- Weight by type effectiveness (prefer super-effective)
- Never switch Pokemon (Gen 1 trainers don't switch except in specific scripted cases)
- Gym Leaders and Elite Four use items (Full Restore) when HP is low
- Random selection among top-weighted moves with some variance
- Never use status moves if target already has that status

---

### Task 17: Experience & Leveling

**Files:**
- Create: `Pokemon/src/battle/experience.ts`
- Test: `Pokemon/tests/experience.test.ts`

**Experience gain formula:**
`EXP = floor(a * b * L / (7 * s))`
- `a` = 1.5 if trainer battle, 1 if wild
- `b` = base experience yield of defeated Pokemon
- `L` = level of defeated Pokemon
- `s` = number of Pokemon that participated (EXP share not in Gen 1 Red battle)

**Growth rate formulas (EXP required for level n):**
- Fast: `floor(4 * n^3 / 5)`
- Medium Fast: `n^3`
- Medium Slow: `floor(6/5 * n^3 - 15 * n^2 + 100 * n - 140)`
- Slow: `floor(5 * n^3 / 4)`

**Level up:**
- Check if current EXP >= threshold for next level
- Recalculate stats with new level
- Check for new moves to learn (prompt player if more than 4)
- Check for evolution conditions

---

## Phase 4: Overworld Engine

### Task 18: Map Data Format & Tile System

**Files:**
- Create: `Pokemon/src/data/maps/map-types.ts`
- Create: `Pokemon/src/rendering/tiles.ts`

Map data format:
```typescript
interface GameMap {
  id: string;
  name: string;
  width: number;       // tiles
  height: number;      // tiles
  tiles: number[][];   // 2D array of tile IDs
  collisions: number[][]; // 0=walkable, 1=solid, 2=water, 3=ledge-south, etc.
  warps: Warp[];       // doors, cave entrances, map edges
  npcs: NpcPlacement[];
  wildEncounters: { pokemon: number; levelMin: number; levelMax: number; rate: number }[];
  trainerPlacements: TrainerPlacement[];
  itemBalls: { x: number; y: number; itemId: number; flag: string }[];
  signs: { x: number; y: number; text: string }[];
  connections: { direction: 'north'|'south'|'east'|'west'; mapId: string; offset: number }[];
  music: string;
}
```

Tile rendering system: generate ~40 unique tile types procedurally (grass, tall grass, water, tree, building wall, roof, floor, path, sand, cave wall, cave floor, etc.) as 16×16 pixel patterns using the Game Boy palette.

---

### Task 19: Map Engine & Camera

**Files:**
- Create: `Pokemon/src/overworld/map-engine.ts`

- Load and render current map tiles
- Camera follows player, centered on screen
- Map scrolling with edge clamping
- Seamless map connections (walk off east edge → enter west edge of next map)
- Warp transitions (fade out → load map → fade in)
- Render NPCs on top of base tiles
- Render player on top of everything
- Layer system: ground → tall grass overlay → NPCs/player → above-player (tree canopy, bridge rails)

---

### Task 20: Player Movement

**Files:**
- Create: `Pokemon/src/overworld/player.ts`

- Grid-based movement: player occupies one tile, moves one tile at a time
- Movement animation: smooth 16-pixel interpolation over ~4 frames
- 4-directional facing (up/down/left/right)
- Walking sprites: 2-frame animation per direction
- Collision checking before movement
- Ledge jumping: can jump south over ledge tiles, 2-tile hop animation
- Surfing state: different sprite, can move on water tiles
- Cycling state: double movement speed, different sprite
- Running shoes: not in Gen 1, but B button could optionally speed up (or keep faithful)

---

### Task 21: NPC System

**Files:**
- Create: `Pokemon/src/overworld/npc.ts`

- NPCs placed on tiles, face a direction
- Movement patterns: stationary, random wander (chance each ~60 frames to step in random direction), patrol (walk a fixed path)
- Interaction: face NPC + press A → trigger dialogue
- Trainer NPCs: line-of-sight detection (scan tiles in facing direction, 1-5 tiles range). When player enters line of sight → exclamation mark → walk to player → initiate battle
- Defeated trainers: set flag, no longer trigger battles, may have different dialogue

---

### Task 22: Event & Interaction System

**Files:**
- Create: `Pokemon/src/overworld/events.ts`

- Event flags: persistent boolean flags tracking game progression (hundreds of flags)
- Flag checks: NPCs, warps, items can be gated by flags
- Item pickups: walk to item ball + press A → receive item, set flag
- Sign reading: face sign + press A → show text
- Healing: walk to Pokemon Center desk + talk to nurse → heal animation → restore party
- Shopping: talk to mart clerk → open buy/sell menu with location-specific inventory
- PC access: interact with PC → Bill's PC (manage boxes), Player's PC (item storage)
- Story triggers: scripted sequences (Oak intro, rival encounters, Team Rocket events)
- Strength boulders: push in facing direction if Strength active
- Cut trees: remove tree tile if Cut available + badge
- Surf: step onto water if Surf available + badge

---

### Task 23: Wild Encounter System

**Files:**
- Create: `Pokemon/src/overworld/encounters.ts`
- Test: `Pokemon/tests/encounters.test.ts`

- Each step in tall grass: ~8.5% chance (21.67/256) of encounter
- Each step in cave: ~8.5% chance
- Surfing: ~8.5% chance per step on water
- Fishing: guaranteed encounter if bite
- Repel: no encounters if lead Pokemon level > wild level
- Encounter table: each map zone has a table of ~10 Pokemon with level ranges and relative rates
- Pokemon is randomly selected from table based on weights

---

## Phase 5: Map Content

### Task 24-73: All Map Data (50 Maps)

Each map file in `Pokemon/src/data/maps/` defines the tile layout, collisions, NPCs, warps, encounters, trainers, items, and signs for one location. Maps are created programmatically as 2D tile arrays.

**Towns & Cities (11 maps):**
- Pallet Town (10×9) — Player's house, Rival's house, Oak's Lab
- Viridian City (20×18) — Gym (locked until 7 badges), Mart, Pokemon Center, old man tutorial
- Pewter City (20×18) — Gym (Brock), Museum, Pokemon Center, Mart
- Cerulean City (20×18) — Gym (Misty), Bike Shop, robbed house, Pokemon Center, Mart
- Vermilion City (20×18) — Gym (Lt. Surge), SS Anne dock, Pokemon Fan Club, Diglett's Cave entrance
- Lavender Town (10×9) — Pokemon Tower, Name Rater, Mr. Fuji's house
- Celadon City (25×18) — Gym (Erika), Department Store, Game Corner, Team Rocket hideout, Mansion (Eevee), Pokemon Center
- Fuchsia City (20×18) — Gym (Koga), Safari Zone gate, Warden's house, Pokemon Center, Mart
- Saffron City (20×18) — Gym (Sabrina), Fighting Dojo, Silph Co., Pokemon Center, Mart (gate guards)
- Cinnabar Island (20×18) — Gym (Blaine), Pokemon Lab, Pokemon Mansion entrance
- Indigo Plateau (10×9) — Pokemon Center, Elite Four entrance

**Routes (25 maps):**
- Routes 1-25: varying sizes (~20-40 tiles wide, ~20-60 tiles tall), connecting towns with tall grass, trainers, items, ledges. Each route has specific wild encounter tables.

**Dungeons & Special (14+ maps):**
- Mt. Moon (3 floors)
- Rock Tunnel (2 floors)
- Pokemon Tower (7 floors)
- Team Rocket Hideout (4 floors underground)
- Silph Co. (11 floors)
- Seafoam Islands (5 floors)
- Pokemon Mansion (4 floors)
- Victory Road (3 floors)
- Cerulean Cave (3 floors)
- Diglett's Cave
- Safari Zone (4 areas)
- Power Plant
- SS Anne (multiple rooms)
- Viridian Forest

**Buildings (per town):**
- Pokemon Centers, Marts, Gyms, houses — each a small interior map (4×4 to 10×8)

**TOTAL: ~150+ individual map files** (interior buildings count as separate maps)

For implementation: maps should be defined as simple 2D number arrays. A map editor helper function can generate common patterns (house interiors, Pokemon Centers are all identical).

---

## Phase 6: Rendering & Sprites

### Task 74: Sprite Generation System

**Files:**
- Create: `Pokemon/src/rendering/sprites.ts`

Core sprite generation framework:
- Each sprite is a function that draws to a canvas context using `fillRect` calls
- Sprites are pre-rendered to offscreen canvases on game boot for performance
- Player sprites: 4 directions × 2 walk frames × 3 states (walk, surf, cycle) = 24 frames
- NPC sprites: ~20 unique NPC types × 4 directions × 2 walk frames
- Tile sprites: ~40 unique tiles
- Pokemon front sprites: 151 × 56×56 pixels
- Pokemon back sprites: 151 × 48×48 pixels
- Pokemon mini sprites: 151 × 16×16 (for menus)

Each Pokemon sprite function creates a recognizable pixelated representation using the Game Boy palette. These are original pixel art interpretations, not copies.

---

### Task 75: Battle Scene Renderer

**Files:**
- Create: `Pokemon/src/scenes/battle.ts`

Battle screen layout (matching Game Boy Red):
- Top: enemy Pokemon sprite (right side), enemy HP bar (left side)
- Bottom: player Pokemon sprite (left side, back view), player info bar
- Text box at very bottom (3 lines)
- Battle menu: FIGHT / PKMN / ITEM / RUN (2×2 grid)
- Move selection: 4 moves in list with PP display
- Slide-in animations for Pokemon entering battle
- HP bar drain animation
- Faint animation (slide down)
- Experience bar fill animation
- Wild encounter intro (screen flash, slide-in)
- Trainer encounter intro (trainer slides in, throws pokeball)

---

### Task 76: Overworld Scene Renderer

**Files:**
- Create: `Pokemon/src/scenes/overworld.ts`

- Render tile map with camera offset
- Render NPCs with walk animations
- Render player with walk animation
- Tall grass overlay (render on top of player's lower half)
- Map transition animations (fade, walk through door)
- Day cycle: not in Gen 1, keep static
- Coordinate with dialogue boxes overlaid

---

### Task 77: Title Screen

**Files:**
- Create: `Pokemon/src/scenes/title.ts`

- Title screen with "POKEMON RED" text
- Scrolling Nidorino/Gengar battle animation (simplified)
- "Press Start" blinking text
- New Game / Continue menu
- Professor Oak intro sequence (name entry)
- Starter selection scene in Oak's Lab

---

### Task 78: Menu Screens

**Files:**
- Create: `Pokemon/src/scenes/menu.ts`
- Create: `Pokemon/src/scenes/pokemon-summary.ts`
- Create: `Pokemon/src/scenes/bag.ts`
- Create: `Pokemon/src/scenes/pokedex.ts`

Start Menu (press Start):
- POKEDEX → Seen/Caught list for all 151
- POKEMON → Party view with HP, switch order, check summary, use HM
- ITEM/BAG → Categorized item list, use items on Pokemon
- [Player Name] → Trainer card (badges, play time, Pokedex count)
- SAVE → Save game to LocalStorage
- OPTION → Text speed, battle animation, battle style

---

## Phase 7: Audio

### Task 79: Audio Engine

**Files:**
- Create: `Pokemon/src/audio.ts`

Web Audio API chiptune synthesis:
- 3 square wave channels + 1 noise channel (mimicking Game Boy hardware)
- Music defined as sequences of notes with timing
- Sound effects: menu select, text advance, damage hit, super effective, not very effective, Pokemon cry (each Pokemon gets a unique procedural cry using frequency modulation), level up, evolution, healing, capture success/fail, door open, ledge jump
- Music tracks: title theme, battle (wild), battle (trainer), battle (gym leader), battle (champion), victory fanfare, each town/route theme, Pokemon Center, evolution, ending

Music is simplified chiptune approximations of the melodic structure, not note-for-note copies. Each town gets a distinctive melody and tempo.

---

## Phase 8: Game Flow & Story

### Task 80: Save System

**Files:**
- Create: `Pokemon/src/save.ts`
- Test: `Pokemon/tests/save.test.ts`

Serialize to LocalStorage:
```typescript
interface SaveData {
  playerName: string;
  rivalName: string;
  party: SavedPokemon[];
  pc: SavedPokemon[][];  // 12 boxes
  bag: { itemId: number; quantity: number }[];
  money: number;
  badges: boolean[];  // 8 badges
  eventFlags: Record<string, boolean>;
  currentMap: string;
  playerX: number;
  playerY: number;
  playerDirection: Direction;
  playTime: number;  // seconds
  pokedex: { seen: Set<number>; caught: Set<number> };
}
```

Auto-save warning. Compress with JSON.stringify. Max ~1MB in LocalStorage.

---

### Task 81: Game Progression / Story Events

**Files:**
- Create: `Pokemon/src/data/text/story.ts`
- Create: `Pokemon/src/overworld/story-events.ts`

Key story beats (event flag driven):
1. Wake up in Pallet Town → walk to tall grass → Oak stops you → go to Lab
2. Choose starter (Bulbasaur/Charmander/Squirtle) → Rival picks counter
3. Rival battle 1 in Oak's Lab
4. Deliver Oak's Parcel from Viridian Mart → get Pokedex
5. Route 2 → Viridian Forest → Pewter City → Brock Gym
6. Route 3 → Mt. Moon → Cerulean City → Rival battle → Misty Gym
7. Route 5-6 → Vermilion City → SS Anne (get Cut) → Lt. Surge Gym
8. Route 9-10 → Rock Tunnel → Lavender Town (Pokemon Tower blocked by ghost)
9. Route 8 → Celadon City → Game Corner → Team Rocket Hideout → Silph Scope
10. Back to Lavender → Pokemon Tower → rescue Mr. Fuji → Poke Flute
11. Saffron City (guard needs drink from Celadon) → Silph Co. → defeat Giovanni
12. Sabrina Gym (Saffron) + Erika Gym (Celadon)
13. Cycling Road → Fuchsia City → Safari Zone (get Surf, Gold Teeth) → Koga Gym
14. Surf to Cinnabar → Pokemon Mansion (Secret Key) → Blaine Gym
15. Back to Viridian → Giovanni Gym (8th badge)
16. Route 22 → Rival battle → Victory Road → Indigo Plateau
17. Elite Four gauntlet → Champion (Rival) → Hall of Fame → Credits
18. Post-game: Cerulean Cave (Mewtwo)

---

### Task 82: Evolution System

**Files:**
- Create: `Pokemon/src/battle/evolution.ts`
- Create: `Pokemon/src/scenes/evolution.ts`

Evolution triggers:
- **Level-up:** Check after gaining experience. e.g., Charmander → Charmeleon at level 16
- **Stone:** Use evolution stone from bag on compatible Pokemon
- **Trade:** Trigger on trade simulation (since no real multiplayer, provide a "trade with NPC" option for trade evolutions like Machoke → Machamp)

Evolution animation:
- Screen darkens
- Pokemon sprite flashes/morphs between forms
- "What? [Pokemon] is evolving!" text
- Can press B to cancel
- "[Pokemon] evolved into [NewPokemon]!" text

---

### Task 83: Pokedex

**Files:**
- Create: `Pokemon/src/scenes/pokedex.ts`

- Scrollable list of all 151 Pokemon
- Seen: silhouette + number + name
- Caught: full sprite + details
- Detail view: species, height, weight, type, short description
- Area display: which routes to find this Pokemon
- Cry playback

---

## Phase 9: Integration & Polish

### Task 84: PC Box System

**Files:**
- Create: `Pokemon/src/scenes/pc.ts`

Bill's PC:
- 12 boxes, 20 Pokemon each (240 total storage)
- Deposit/Withdraw from party
- Release Pokemon
- Change box (must save when switching)
- Box naming

---

### Task 85: Mart & Shopping

**Files:**
- Create: `Pokemon/src/scenes/shop.ts`

- Buy menu: location-specific inventory with prices
- Sell menu: sell any non-key item for half purchase price
- Money display, "you can't afford that" check
- Quantity selection (hold arrow to increment fast)

---

### Task 86: HM Field Moves

**Files:**
- Modify: `Pokemon/src/overworld/events.ts`

- Cut: remove cuttable tree tiles (reset on map reload), requires Cascade Badge
- Fly: open town selection menu → fly to any visited Pokemon Center, requires Thunder Badge
- Surf: enter water tiles with surfing sprite, requires Soul Badge
- Strength: push boulders one tile in facing direction (stays until map reload), requires Rainbow Badge
- Flash: light up dark caves (Rock Tunnel), requires Boulder Badge

---

### Task 87: Safari Zone

**Files:**
- Create: `Pokemon/src/data/maps/safari-zone-*.ts` (4 area maps)

- 500 step limit, 30 Safari Balls
- Special battle mode: throw Safari Ball / throw Bait / throw Rock / Run
- Bait: makes Pokemon harder to catch but less likely to flee
- Rock: makes Pokemon easier to catch but more likely to flee
- Unique Pokemon encounters (Chansey, Kangaskhan, Tauros, Scyther, Pinsir, etc.)
- Surf and Strength puzzles for Gold Teeth + HM03 Surf
- Warden's Gold Teeth → get HM04 Strength

---

### Task 88: Game Corner

**Files:**
- Create: `Pokemon/src/scenes/slots.ts`

- Slot machine minigame (simplified)
- Buy coins (1000¥ = 50 coins)
- Prize exchange: Pokemon (Abra, Clefairy, Dratini, Scyther/Pinsir, Porygon) and TMs
- Team Rocket poster → secret staircase to Rocket Hideout

---

### Task 89: Full Playthrough Testing

End-to-end testing plan:
1. New game → starter selection works
2. Walk through Pallet Town, interact with NPCs
3. Wild encounters on Route 1 function
4. Catch a Pokemon
5. Visit Viridian City Pokemon Center and Mart
6. Complete Viridian Forest
7. Beat Brock, verify badge
8. Continue through each gym progressively
9. Verify all 8 badges obtainable
10. Verify Elite Four beatable
11. Verify save/load preserves all state
12. Verify evolution works
13. Verify all HM field moves work
14. Verify PC box system
15. Verify Pokedex tracking
16. Verify all item usage
17. Performance: stable 60fps throughout

---

## Agent Team Assignment

For parallel execution, split work across 5 agents:

### Agent 1: "data-architect"
Tasks: 6, 7, 8, 9, 10 (Type chart, all 151 Pokemon, all 165 moves, items, trainers)

### Agent 2: "battle-engineer"
Tasks: 11, 12, 13, 14, 15, 16, 17, 82 (Stats, damage, battle engine, move effects, catch, AI, experience, evolution)

### Agent 3: "overworld-builder"
Tasks: 18, 19, 20, 21, 22, 23, 86 (Map format, map engine, player, NPCs, events, encounters, HMs)

### Agent 4: "renderer"
Tasks: 4, 5, 74, 75, 76, 77, 78, 79, 83, 84, 85, 88 (Text, menus, sprites, scenes, audio, UI screens)

### Agent 5: "map-creator"
Tasks: 24-73, 80, 81, 87 (All 150+ map data files, save system, story events, Safari Zone)

**Dependency order:**
1. Task 1 (scaffold) must complete first — done by lead
2. Phase 2 (data) + Task 4-5 (text/menu rendering) can start immediately after
3. Phase 3 (battle) depends on data types being defined (Task 6, 7, 8)
4. Phase 4 (overworld) depends on map types (Task 18) and tiles (Task 74)
5. Phase 5 (maps) depends on map format (Task 18)
6. Phase 6 (sprites) can start anytime
7. Phase 7-9 depend on engines being functional

Agents 1 and 4 can start immediately. Agent 2 starts after type/Pokemon/move interfaces are defined. Agents 3 and 5 start after map format is defined.
