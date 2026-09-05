# MyGarden UIUX Mission Control

**Date:** 2026-04-06
**Scope:** Plan authoring (no code changes to app/module source)

## What

Built `docs/plans/mygarden-uiux-mission-control.html` modeled on the MyHealth and MyRecipes mission control pattern. 27 copy-ready prompts covering all 37 design screens in `/Users/trey/Downloads/GardenUIUX/` across 6 phases.

## Why

User provided a new set of Obsidian Noir garden screens in `~/Downloads/GardenUIUX` and asked for a high-detail mission control HTML to drive the reconciliation effort (matching the style of the existing MyHealth / MyRecipes plans).

## Phase Breakdown

| Phase | Prompts | Content | Execution |
|-------|---------|---------|-----------|
| P0 Foundation | 3 | Tokens+typography, tab restructure, 14 shared UI components | Sequential |
| P1 Core Tabs | 5 | Home, Plants, Watering, Tasks, Settings | Parallel |
| P2 Detail/Input | 5 | Plant detail, add plant, diagnosis, harvest log, journal | Parallel |
| P3 Garden Tools | 5 | Companions, layout planner, zones, seeds+propagation, wishlist | Parallel |
| P4 Data/Insights | 5 | Calendars, frost+weather, light levels, photos gallery, export | Parallel |
| P5 Web Parity | 4 | Shell+dashboard, inventory+detail, planner+matrix, journal+photos | Parallel |

## Key Gap Analysis Findings

1. **Accent color drift:** Design spec = `#84CC16` (lime). Current code = `#22C55E`. P0-A updates both `modules/garden/src/definition.ts` and `packages/ui/src/tokens/colors.ts`. Confirmed by `mygarden_home/code.html` explicit override: `"primary": "#84CC16" // Lime Green Accent as requested`.
2. **Tab structure drift:** Design = Home / Plants / Watering / Tasks / Settings (5 tabs). Code = Home / Tasks / Journal / More (4 tabs). P0-B introduces new `plants.tsx`, `watering.tsx`, `settings.tsx` and demotes `journal.tsx` to a hidden stack screen reachable from the Plants header or Settings menu.
3. **Typography:** Design uses Plus Jakarta Sans (weights 400/500/600/700/800). Code uses Inter. Module-scoped font load to avoid breaking other modules.
4. **No-line rule violations:** Current tab bar uses `borderTopWidth: 1` and `borderTopColor`. P0-B replaces with glass-morphism backdrop blur and rounded top corners (28px).
5. **Emoji icons:** Code uses emoji tab icons (🌱✅📖⚙️). Design uses Material Symbols (`home`, `potted_plant`, `water_drop`, `checklist`, `settings`) with filled variants for active state.
6. **Missing screens entirely:** Garden Photos gallery, Export screen, Light Levels, Seed Library and Propagation Tracker are either partial or missing in the current route tree.

## Shared UI Components Built in P0-C (14 total)

SectionHeader, GlassCard, PlantCard, StatCard, WateringTimer, ZoneChip, CompanionMatrixCell, BlueprintCanvas, GardenTimelineEntry, FrostTimelineTrack, MasonryGallery, GradientButton, QuickActionButton, HealthDot.

The BlueprintCanvas + CompanionMatrixCell + FrostTimelineTrack trio are garden-specific (not reused in Books/Mood/Health/Recipes) and will need react-native-gesture-handler for pan/pinch.

## Files Changed

- `docs/plans/mygarden-uiux-mission-control.html` (2934 lines, NEW)
- `memory.md` (session row added)
- `docs/sessions/2026-04-06-mygarden-uiux-mission-control.md` (NEW, this log)

## Verification

- Prompt card count verified: 27 cards across IDs P0-A, P0-B, P0-C, P1-A through P1-E, P2-A through P2-E, P3-A through P3-E, P4-A through P4-E, P5-A through P5-D.
- All design references point to existing files in `/Users/trey/Downloads/GardenUIUX/` (37 folders + obsidian_noir/DESIGN.md).
- localStorage persistence key: `mygarden-mission-control` (separate namespace from health/recipes plans).

## Open Questions / Decisions Deferred to Execution

1. **Journal demotion:** Confirmed Journal moves from tab to stack screen — user may reconsider if daily usage warrants keeping it as a top-level tab.
2. **Settings vs More:** P1-E replaces the existing `more.tsx` pattern with a dedicated `settings.tsx` — existing more.tsx content (Garden Tools list) gets inlined into Settings under a "GARDEN TOOLS" section.
3. **Photos tab vs stack:** Garden Photos lives as a stack screen (P4-D) reachable from Settings, not a tab. User may promote it later if photo-logging becomes central.
4. **Companions detail screen:** P3-A updates `companions.tsx` + `companion-check.tsx`. The web variant (`companion_planting_2`) is covered in P5-C as the matrix+stats desktop layout.

## Remaining Work

None for this plan. Execution of P0 through P5 is the next concrete step — P0 must run first (sequential), then P1-P4 can run in parallel agent teams (up to 20 prompts concurrent), then P5 web parity last.

## Next Actions

- Open `docs/plans/mygarden-uiux-mission-control.html` in a browser.
- Start with P0-A → P0-B → P0-C sequentially.
- Dispatch P1 through P4 as parallel agent teams once foundation lands.
