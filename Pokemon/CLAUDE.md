# Pokemon Red Recreation

## Overview
Complete browser-based recreation of Pokemon Red using TypeScript and HTML5 Canvas. All 151 Pokemon, full Kanto region, Gen 1 battle mechanics, programmatic pixel art sprites.

## Stack
TypeScript 5.x, Bun (bundler + runtime), HTML5 Canvas 2D, Web Audio API, Vitest

## Key Commands
```bash
bun run build     # Bundle src/main.ts → dist/main.js
bun run dev       # Watch mode build
bun test          # Run all tests (vitest)
bun test:watch    # Watch mode tests
open index.html   # Play the game in browser
```

## Architecture

### Directory Structure
```
src/
├── main.ts              # Bootstrap, game loop
├── constants.ts         # Screen size, palette, timing, stat tables
├── input.ts             # Keyboard input manager
├── audio.ts             # Web Audio chiptune engine
├── save.ts              # LocalStorage save/load
├── scenes/              # Scene stack (title, overworld, battle, menu, etc.)
│   └── scene.ts         # Scene interface + SceneManager
├── battle/              # Battle engine, damage calc, AI, move effects
├── overworld/           # Map engine, player, NPCs, events, encounters
├── data/                # Static game data
│   ├── types.ts         # 15 Gen 1 types + effectiveness chart
│   ├── game-types.ts    # All shared TypeScript interfaces
│   ├── pokemon.ts       # 151 Pokemon species definitions
│   ├── moves.ts         # 165 move definitions
│   ├── items.ts         # All items
│   ├── trainers.ts      # All trainer rosters
│   ├── maps/            # Map data files (one per location)
│   └── text/            # Dialogue and story text
├── rendering/           # Sprite gen, tile atlas, text, menu UI
└── utils/               # Random, math helpers
tests/                   # Vitest test files
```

### Key Design Decisions
- **Native resolution:** 160×144 canvas scaled 4× to 640×576 for pixel-perfect Game Boy rendering
- **Scene stack:** Scenes push/pop for overlays (menu on overworld, battle on overworld)
- **All data is code:** Pokemon, moves, maps — all TypeScript constants. No JSON, no fetch, no async loading.
- **Gen 1 mechanics only:** No Gen 2+ features. Physical/special split by type. DV system (0-15). Stat experience.
- **Programmatic sprites:** All art generated via Canvas fillRect calls. No external image assets.

### Input
Arrow keys = D-pad, Z = A button, X = B button, Enter = Start, Backspace = Select

## Git Workflow
Branch: `main`. Conventional Commits. `feat(pokemon):`, `fix(pokemon):`, `test(pokemon):`.

## Important Notes
- Gen 1 type chart quirk: Ghost has NO EFFECT on Psychic (this was a bug in the original)
- Physical/special is determined by TYPE not by move: Fire/Water/Electric/Grass/Ice/Psychic/Dragon = Special
- Critical hits use base speed: `floor(BaseSpeed / 2) / 256` chance, or `floor(BaseSpeed * 4) / 256` for high-crit moves
- DV system: Attack, Defense, Speed, Special each 0-15. HP DV = `(AtkDV%2)*8 + (DefDV%2)*4 + (SpdDV%2)*2 + (SpcDV%2)`

## Context7 — Live Documentation

When writing or modifying code that uses external libraries, automatically use Context7 MCP tools (`resolve-library-id` → `query-docs`) to fetch current documentation instead of relying on training data.

**Pre-resolved library IDs for this project:**
- Vitest: `/vitest-dev/vitest`

Use when: configuring Vitest, upgrading test framework, debugging test runner behavior.
Skip when: game logic, rendering code, data definitions, Canvas API usage (no npm library involved).

## Parallel Agent Work

This project participates in the workspace plan queue system. See `/Users/trey/Desktop/Apps/CLAUDE.md` for the full Plan Queue Protocol.

### Worktree Setup
- Bootstrap: `.cmux/setup` handles env symlinks and dependency installation
- Branch naming: `plan/[plan-name]` for plan-driven work, `feature/[name]` for ad-hoc

### File Ownership Boundaries
When multiple agents work on this project simultaneously, use these boundaries to avoid conflicts:

| Agent Role | Owned Paths |
|------------|-------------|
| Battle | `src/battle/` (battle engine, damage calc, AI, move effects) |
| Overworld | `src/overworld/` (map engine, player movement, NPCs, events, encounters) |
| Data | `src/data/` (Pokemon species, moves, items, trainers, maps, dialogue text) |
| Rendering | `src/rendering/` (sprite generation, tile atlas, text rendering, menu UI) |
| Scenes | `src/scenes/` (scene stack -- title, overworld, battle, menu) |
| Core | `src/main.ts`, `src/constants.ts`, `src/input.ts`, `src/audio.ts`, `src/save.ts`, `src/utils/` |
| Tests | `tests/` (all Vitest test files) |
| Docs | `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/` |

**Rules:**
- Each file belongs to exactly one zone
- Never have two agents editing the same file simultaneously

### Conflict Prevention
- Check which files other active plans target before starting (read `docs/plans/active/*.md`)
- If your scope overlaps with an active plan, coordinate or wait
- After completing work, run `bun test` before marking the plan done

### Agent Teams Strategy
When `/dispatch` detects 2+ plans targeting this project with overlapping scope, it creates an Agent Team instead of parallel subagents. Custom agent definitions from `/Users/trey/Desktop/Apps/.claude/agents/` are available:
- `plan-executor` — Execute plan phases with testing and verification
- `test-writer` — Write tests without modifying source code
- `docs-agent` — Update documentation (CLAUDE.md, timeline, diagrams)
- `reviewer` — Read-only code review and quality gates (uses Sonnet)


## Writing Style
- Do not use em dashes in documents or writing.


### Code Intelligence

Prefer LSP over Grep/Read for code navigation - it's faster, precise, and avoids reading entire files:
- `workspaceSymbol` to find where something is defined
- `findReferences` to see all usages across the codebase
- `goToDefinition` / `goToImplementation` to jump to source
- `hover` for type info without reading the file

Use Grep only when LSP isn't available or for text/pattern searches (comments, strings, config).

After writing or editing code, check LSP diagnostics and fix errors before proceeding.