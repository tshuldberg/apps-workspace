# MyGarden Phase 2 — Detail + Input Screens

**Date:** 2026-04-07
**Plan:** docs/plans/mygarden-uiux-mission-control.html (Phase 2)
**Strategy:** 5-agent parallel team `mygarden-phase2` (one module-dev per task)

## What

Rebuilt 5 mobile detail and input screens to the GardenUIUX spec (Obsidian Noir + lime #84CC16 accent), reusing shared components from `modules/garden/src/ui/`.

## Tasks completed

| Task | File(s) | Owner |
|------|---------|-------|
| P2-A Plant Detail | `apps/mobile/app/(garden)/plant/[id].tsx` | p2a-plant-detail |
| P2-B Add Plant Form | `apps/mobile/app/(garden)/add-plant.tsx` | p2b-add-plant |
| P2-C Plant Diagnosis | `apps/mobile/app/(garden)/diagnose.tsx` | p2c-diagnose |
| P2-D Harvest Log | `apps/mobile/app/(garden)/harvests.tsx` + `harvest/add.tsx` | p2d-harvests |
| P2-E Garden Journal | `apps/mobile/app/(garden)/journal.tsx` | p2e-journal |

## Sections delivered

**P2-A Plant Detail** — 4:5 hero photo with gradient + back/share/edit chrome, health chip, plant name + italic species + zone chip; Health Score ring + WateringTimer side-by-side; 4-card care bento (Sunlight / Watering / Soil / Feed); BOTANICAL ARCHIVE 7-row metadata card; CHRONICLE journal with All/Watering/Harvests/Notes/Photos filter chips + GardenTimelineEntry rows; COMPANIONS horizontal scroll with antagonist warning card; GROWTH ARCHIVE photo strip with "+" tile; DANGER ZONE archive + delete actions.

**P2-B Add Plant Form** — Photo hero with dashed surface + camera icon; species search pill with 12-plant dropdown; variety pill input; planting date with -/+ steppers; ZoneChip horizontal scroll from `getZones(db)` with "+ New Zone"; soil expandable picker (6 types); sun segmented (Full/Partial/Shade); spacing number input + in/cm toggle; watering interval -/+ adjuster; full-width gradient save via GradientButton.

**P2-C Plant Diagnosis** — Plant selector pill picker + capture symptom button; 12-symptom toggleable chip grid; environment toggles (watering change / sun / repotting / indoor-outdoor segmented); gradient analyze button with sparkles icon; result card with condition name in gold + SVG confidence ring + severity badge; numbered treatment plan with lime-bordered step badges; 4 prevention tip cards with shield icon; related issues horizontal scroll; gradient Log to Journal save.

**P2-D Harvest Log** — `harvests.tsx`: displayLg header + DASHBOARD kicker, 4-card stats grid (week / month / season / lifetime), 12-week View-based bar chart with weight/count toggle, top crops horizontal scroll grouped by plant, recent harvests timeline (20 most recent via GardenTimelineEntry), gradient FAB to add. `harvest/add.tsx`: plant pill picker, amount display-lg input + unit pill selector (g/kg/oz/lb/count), date input, dashed photo placeholder, notes textarea, gradient save button.

**P2-E Garden Journal** — Header with "+ New Entry" gradient pill, filter bar (search / plant / weather / months toggle), gradient vertical timeline rail with colored dots, GlassCard entries with date column + weather chip + tag chips + body + photo grid, monthly grouped view, full-screen pageSheet detail modal (hero + curator's notes italic + photo gallery + plant profile sheet + edit/export/delete actions), composer modal (title / body textarea / category pill grid / plant pill grid / photo placeholder / Archive Entry gradient button) wired to `createEntry`.

## Components reused

From `modules/garden/src/ui/`:
- GlassCard, HealthDot, WateringTimer, SectionHeader, GardenTimelineEntry, PlantCard, ZoneChip, GradientButton, StatCard
- Tokens: GARDEN_ACCENT, GARDEN_ACCENT_LIGHT, GARDEN_ACCENT_DIM, GARDEN_DANGER, GARDEN_GOLD, GARDEN_TERTIARY, GARDEN_SURFACES, GARDEN_TYPOGRAPHY, GARDEN_CTA_GRADIENT, GARDEN_HEALTH_COLORS, JAKARTA_FONTS

## Engine functions consumed

`getPlantById`, `getPlants`, `getEntriesForPlant`, `getEntriesByDate`, `getCompanions`, `getAntagonists`, `createPlant`, `createEntry`, `getZones`, `matchSymptoms`, `createDiagnosis`, `getHarvests`, `createHarvest`, `waterPlant`, `deletePlant`, `calculateNextWaterDate`, `isDaysOverdue`, `adjustFrequencyForSeason`, `getSeason`.

## Side fixes

- p2a removed a duplicate `Text` import in `plants.tsx` that was blocking baseline mobile typecheck.
- Lead cleanup pass after teammates returned: removed unused `LinearGradient` import from `diagnose.tsx`, removed unused `stats` useMemo + `getHarvestStats`/`HarvestStats` imports from `harvests.tsx`, prefixed unused `uri` map params with `_uri` in `journal.tsx`.

## Verification

- `pnpm --filter mobile typecheck` — PASS (clean)
- `pnpm check:parity` — PASS (workouts + module-parity + passthrough-parity all green)

## Not committed

All Phase 2 edits remain uncommitted alongside earlier Phase 1 work and prior recipes/health changes. Branch: `main`.

## Decisions

- Treated the 5 P2 tasks as a parallel team because no two routes share files. Each teammate was given an explicit "ONLY edit this file" guardrail.
- Used inline fallbacks (e.g., locally derived health score on Plant Detail, View-based bar chart on Harvest Log) instead of editing shared engine code or installing new deps. Per guardrail, no `modules/garden/src/ui/` shared components were modified.
- Photo upload kept as placeholder Alerts across all 5 screens — no `expo-image-picker` wiring this phase.

## Next

Phase 3 (Garden Tools): Companions, Layouts, Zones, Seeds + Propagation, Wishlist. Same parallel team pattern recommended.
