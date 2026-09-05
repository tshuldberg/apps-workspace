# MyGarden UIUX Phase 1 — Core Tab Screens

**Date:** 2026-04-07
**Scope:** P1-A through P1-E (5 parallel tasks)
**Strategy:** Agent team — 5x `module-dev` in parallel, one file per agent, lead (this session) as coordinator
**Plan:** docs/plans/mygarden-uiux-mission-control.html
**Theme:** Obsidian Noir + MyGarden lime (#84CC16)

## Phase Summary

All 5 core tab screens for the MyGarden mobile app were redesigned in parallel, each agent owning one file to prevent edit conflicts. Phase 0 deliverables (UI components in `modules/garden/src/ui/`, tab registration in `_layout.tsx`) were already in place.

## Files Touched

| Task | File | Agent Result |
|------|------|--------------|
| P1-A | `apps/mobile/app/(garden)/index.tsx` | Home tab (full rewrite) |
| P1-B | `apps/mobile/app/(garden)/plants.tsx` | Plants grid (full rewrite from stub) |
| P1-C | `apps/mobile/app/(garden)/watering.tsx` | Watering schedule (full rewrite from stub) |
| P1-D | `apps/mobile/app/(garden)/tasks.tsx` | Tasks view (full redesign) |
| P1-E | `apps/mobile/app/(garden)/settings.tsx` | Settings (full redesign) |

## Per-Task Details

### P1-A — Home Tab
- Header (leaf + title + search/bell icons, bell red when overdue)
- "Today" greeting with uppercase day label
- Conditional overdue alert banner (red glass, thirsty plant names, Water Now CTA)
- Live Overview: 4 StatCards (Active Plants / Overdue / Harvest Ready / Total Harvests)
- Quick Actions row: Add Plant / Log Water / Add Task / Log Harvest (QuickActionButton)
- Garden Biography GlassCard with oldest plant hero + diversity/age stats
- Recent Activity timeline (last 5 entries via `getEntriesByDate`)
- Data: existing hooks + `getEntriesByDate` and `getHarvests` for new stats

### P1-B — Plants Tab
- Header with "My Plants" displayLg title + lime "N SPECIMENS" count pill
- Pill search bar with leading Search icon, auto-shown when 8+ plants
- Filter chips: All, Needs Attention, Healthy, By Zone (ZoneChip with active state)
- 2-column grid of PlantCards with HealthDot and next-water badge
- Empty state (Sprout icon, "Your garden awaits", gradient Add Plant CTA)
- No-results state when filter yields nothing
- Lime gradient FAB at bottom-right (safe-area aware)
- Health legend strip below grid

### P1-C — Watering Tab
- Header with "Watering" title + last-watered subtitle
- Conditional overdue banner with per-plant rows + "Water All" GradientButton
- Due Today list with progress bars under each row
- Upcoming Schedule grouped by day (next 7 days)
- Hydration Patterns 2-col grid (avg interval / last watered / lifetime waterings)
- Recent Waterings timeline (last 10 from `schedule.lastWatered` fallback)
- Settings row with Reminder Notifications + Skip Rain Days toggles
- Engine: `getWateringSchedule`, `getPlants`, `waterPlant` (no new engine methods)

### P1-D — Tasks Tab
- Header with "Tasks" displayLg title + uppercase stats subtitle
- Filter chips: All / Overdue / Today / Upcoming / Completed (ZoneChip)
- Conditional Overdue Hero with top 4 overdue rows + "SEE ALL" action
- Today section with priority left-accent cards (lime/gold/red), plant + zone chips, checkbox
- Upcoming grouped by Tomorrow / weekday / Next Week / Later
- Completed collapsible (placeholder since no completed-tasks query exists)
- Lime gradient FAB (opens add-plant as placeholder)
- Bridges two data sources: `getWateringSchedule` + `getPendingSeasonalTasks`

### P1-E — Settings Tab
- Header with "MYGARDEN" label + displayLg "Settings"
- Profile hero GlassCard (avatar, display name, location + zone, plant/bed counts, pencil edit)
- Preferences GlassCard: Imperial/Metric + °F/°C segments, Frost Zone chevron, Watering Reminders toggle, Skip Rain Days toggle, Notification Schedule chevron
- Garden Tools GlassCard: 13 linked-tool rows routing to existing stack screens
- Data GlassCard: Export Data, Backup to iCloud toggle, destructive Delete All (Alert.alert confirm)
- About GlassCard: Version, Privacy Policy, Terms (Linking.openURL)
- Persistence via `setSetting` / `getSetting` from `@mylife/garden`

## Shared Components Used

From `modules/garden/src/ui/` (all exported via `@mylife/garden`):
- `GlassCard`, `SectionHeader`, `StatCard`, `GradientButton`, `QuickActionButton`
- `PlantCard`, `ZoneChip`, `HealthDot`, `GardenTimelineEntry`
- Tokens: `GARDEN_ACCENT`, `GARDEN_ACCENT_LIGHT`, `GARDEN_ACCENT_DIM`, `GARDEN_DANGER`, `GARDEN_GOLD`, `GARDEN_TERTIARY`, `GARDEN_SURFACES`, `GARDEN_TYPOGRAPHY`, `GARDEN_CTA_GRADIENT`

## Deviations (Documented)

- **StatCard limitation:** P1-C used a custom inline 3-stat card for Hydration Patterns since StatCard is single-stat.
- **Lifetime waterings estimate:** Derived from acquiredDate + frequencyDays rather than N+1 history queries.
- **P1-D task sources:** Unified `WateringScheduleItem` + `SeasonalTask` into a local `TaskItem` type since `getTasks`/`toggleTask` are not exported from `@mylife/garden`.
- **Completed tasks placeholder:** No completed-tasks query exists, so P1-D shows a graceful empty state.
- **FAB placeholders:** Task composer and export flows show "Coming Soon" alerts where no existing route covers them.
- **Settings route gaps:** Photos Gallery → identify, Garden Weather → frost, Planting+Seasonal Calendar → seasonal (single screen covers both).
- **Icons:** Material symbols mapped to lucide-react-native equivalents throughout.

## Verification

- `pnpm typecheck` — 85/85 tasks successful (mobile + web + all modules clean)
- `pnpm check:parity --quiet` — all gates pass (registry, module, passthrough, workouts, route parity)
- Post-fix: removed 7 unused lucide imports from index.tsx caught by LSP diagnostics

## Coordination Notes

- All 5 agents ran in a single parallel batch with strict file-ownership scoping in each prompt
- Each agent was instructed not to modify `_layout.tsx` or any other Phase 1 file
- Each agent ran scoped typecheck before returning; lead did final workspace verify
- LSP diagnostics surfaced mid-flight were stale; confirmed by clean tsc run after final edits

## Remaining

Phase 2 (Detail & Input Screens) — can run in parallel with Phase 1 per the mission control, but Phase 1 is the prerequisite for review:
- P2-A Plant Detail, P2-B Add Plant, P2-C Diagnose, P2-D Harvests, P2-E Journal
