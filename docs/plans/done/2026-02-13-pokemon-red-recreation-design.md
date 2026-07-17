# Pokemon Red Recreation — Design Document

**Date:** 2026-02-13
**Status:** Approved
**Location:** `/Users/trey/Desktop/Apps/Pokemon/`

## Overview

Full recreation of Pokemon Red as a browser-based game using TypeScript + HTML5 Canvas. All 151 Pokemon, all routes/cities/dungeons, 8 gyms + Elite Four, complete battle engine with Gen 1 mechanics, programmatic pixel art sprites (no external assets), chiptune audio via Web Audio API.

## Tech Stack

- **Language:** TypeScript 5.x
- **Runtime:** Bun (build + test)
- **Rendering:** HTML5 Canvas 2D (160×144 native, scaled 4× to 640×576)
- **Audio:** Web Audio API (chiptune synthesis)
- **Testing:** Vitest
- **Dependencies:** Zero runtime dependencies. Bun + TypeScript + Vitest dev-only.

## Architecture

### Game Loop
Fixed 60fps loop: `requestAnimationFrame` → fixed timestep update (16.67ms) → render. All game logic runs at the fixed rate regardless of frame timing.

### Scene Stack
Scenes push/pop onto a stack. Each scene implements `update(dt)` and `render(ctx)`. Stack allows overlays (menu on top of overworld, battle on top of overworld).

Scenes: Title, Overworld, Battle, Menu, Dialogue, Evolution, Trading, Credits.

### Data Layer
All game data is static TypeScript constants compiled into the bundle:
- 151 Pokemon with base stats, types, learnsets, evolution data
- 165 moves with power, accuracy, PP, type, effects
- Complete type effectiveness chart (15 types)
- All items (Potions, Pokeballs, TMs/HMs, Key Items, etc.)
- All trainer rosters (Gym Leaders, Elite Four, regular trainers)
- All map data (tiles, warps, NPCs, events, wild encounter tables)
- All dialogue text

### Rendering System
- **Sprites:** Programmatic pixel art using Canvas drawing. Each Pokemon has a unique `draw()` function using fillRect primitives. Pre-rendered to offscreen canvases on boot.
- **Tiles:** Procedurally generated tile atlas (grass, water, trees, buildings, paths, walls, etc.)
- **Text:** Custom pixel font renderer (Game Boy style 8×8 characters)
- **UI:** Window/menu system matching Game Boy aesthetic (bordered text boxes, scrolling menus)
- **Palette:** 4-shade Game Boy palettes per sprite. Different Pokemon get different color palettes.

### Battle Engine
- Turn-based with speed priority
- Gen 1 damage formula: `((2*Level/5+2) * Power * A/D) / 50 + 2) * STAB * TypeEffectiveness * Random(217-255)/255`
- All 165 moves with full effect implementations (status, stat changes, multi-hit, recoil, drain, OHKO, etc.)
- Gen 1 catch rate formula
- Trainer AI: weighted move selection based on type effectiveness + damage potential
- Badge stat boosts

### Overworld Engine
- 16×16 pixel tile grid
- Collision via tile properties (walkable, warp, ledge, water, cut-tree, strength-boulder)
- NPC movement patterns (stationary, random wander, fixed patrol)
- Trainer line-of-sight triggering
- Map connections (seamless route transitions)
- HM field effects: Cut, Surf, Fly, Strength, Flash

### Pokemon System
- IVs (0-15 per stat, Gen 1 DV system)
- Stat Experience (Gen 1 EV equivalent)
- Experience groups (Fast, Medium Fast, Medium Slow, Slow)
- Evolution: level-up, evolution stones, trade
- PC Box storage (Bill's PC, 12 boxes × 20 slots)

### Progression
- 8 Gym badges gating HM usage
- Event flags for story progression
- Key items gating area access
- Elite Four + Champion as endgame

### Save System
LocalStorage JSON serialization: player position, party, PC boxes, inventory, event flags, badges, play time.

### Input
Keyboard mapping: Arrow keys = D-pad, Z = A button, X = B button, Enter = Start, Backspace = Select.

### Audio
Web Audio API oscillators synthesizing chiptune-style music and sound effects. Each route/city/battle gets a unique procedural music track approximating the original's melody structure.

## File Structure

```
Pokemon/
├── index.html
├── package.json
├── tsconfig.json
├── CLAUDE.md
├── timeline.md
├── src/
│   ├── main.ts
│   ├── constants.ts
│   ├── input.ts
│   ├── audio.ts
│   ├── save.ts
│   ├── scenes/          (8 scene files)
│   ├── battle/          (5 engine files)
│   ├── overworld/       (5 engine files)
│   ├── data/            (Pokemon, moves, items, types, trainers, maps/, text/)
│   ├── rendering/       (6 renderer files)
│   └── utils/           (3 utility files)
└── tests/               (7+ test files)
```

## Build & Test

```bash
bun install              # Install dev dependencies
bun run build            # Bundle to dist/game.js
bun run dev              # Watch mode
bun test                 # Run Vitest suite
open index.html          # Play the game
```

## Agent Team Strategy

Parallel workstreams:
1. **Data Agent** — Pokemon DB, move DB, item DB, type chart, trainer rosters
2. **Battle Agent** — Battle engine, damage calc, move effects, AI, catch mechanics
3. **Overworld Agent** — Map engine, player movement, NPCs, events, encounters
4. **Rendering Agent** — Sprite generator, tile atlas, text renderer, UI system
5. **Map Agent** — All map data files (50+ locations with tiles, warps, NPCs, events)

Integration points are minimal: battle engine reads from data layer, overworld triggers battles, rendering is called by scenes.
