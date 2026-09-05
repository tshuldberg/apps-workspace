# Feature Spec: Seasonal Care

## Metadata
- **Module:** garden
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (watering engine with getSeason and adjustFrequencyForSeason already exists)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Plants have fundamentally different care needs across seasons. Most houseplants need less water in winter, more in summer. Fertilizing stops entirely in dormancy. Pruning timing varies by species. The garden module already has a `getSeason()` function and `adjustFrequencyForSeason()` multiplier (summer 0.67x, winter 2.0x), but there is no user-facing seasonal care calendar, no per-plant seasonal task reminders, and no way to see upcoming seasonal transitions. Planter and Seed to Spoon both offer seasonal calendars as premium features. This feature surfaces the existing engine logic to users and adds a seasonal task system.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Planter | Yes | Premium ($49.99 lifetime) | Monthly care calendar, seasonal task suggestions per plant type |
| Seed to Spoon | Yes | Premium ($46.99/yr) | Growing guides by season, planting calendar by zone |
| PlantIn | Partial | Pro | Adjusts watering reminders by season, but no explicit seasonal calendar |
| Planta | Yes | Pro ($36/yr) | Seasonal care tips, adjusted watering intervals |

### Target User
Plant parents who lose plants in seasonal transitions (overwatering in winter, forgetting to fertilize in spring). Also vegetable gardeners who need to know when to start seeds indoors, transplant, and harvest based on season. Users paying for Planter's seasonal calendar ($49.99) would get equivalent value in MyLife.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/engine/seasonal-care.ts      -- Seasonal care schedule engine
modules/garden/src/engine/seasonal-data.ts       -- Bundled seasonal care knowledge base
modules/garden/src/types.ts                      -- SeasonalTask, SeasonalCareSchedule types
modules/garden/src/db/crud.ts                    -- Seasonal task completion tracking
modules/garden/src/db/schema.ts                  -- gd_seasonal_tasks table (V2 migration)
modules/garden/src/definition.ts                 -- V2 migration
apps/mobile/app/(garden)/seasonal.tsx            -- Seasonal care calendar screen
apps/mobile/app/(garden)/components/SeasonalTaskCard.tsx  -- Task card component
apps/web/app/garden/seasonal/page.tsx            -- Web seasonal calendar
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Tasks tab
            └── [Seasonal Care section]
                 └── Season-specific task list ← YOU ARE HERE
```

Also accessible as a dedicated screen from the Garden tab's top action bar.

### Data Model

```sql
-- V2 migration: seasonal task tracking
CREATE TABLE IF NOT EXISTS gd_seasonal_tasks (
  id TEXT PRIMARY KEY,
  plant_id TEXT REFERENCES gd_plants(id) ON DELETE CASCADE,
  season TEXT NOT NULL,
  task_type TEXT NOT NULL,
  description TEXT,
  due_month INTEGER,
  completed_at TEXT,
  snoozed_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS gd_seasonal_tasks_plant_idx ON gd_seasonal_tasks(plant_id);
CREATE INDEX IF NOT EXISTS gd_seasonal_tasks_season_idx ON gd_seasonal_tasks(season);
CREATE INDEX IF NOT EXISTS gd_seasonal_tasks_completed_idx ON gd_seasonal_tasks(completed_at);
```

**Column notes:**
- `season`: 'spring' | 'summer' | 'fall' | 'winter'
- `task_type`: 'increase_watering' | 'decrease_watering' | 'start_fertilizing' | 'stop_fertilizing' | 'prune' | 'repot' | 'move_indoors' | 'move_outdoors' | 'check_pests' | 'mulch' | 'divide' | 'custom'
- `due_month`: 0-11 (month index for when the task should be done)
- `completed_at`: NULL if pending, ISO timestamp when marked done
- `snoozed_until`: NULL if active, ISO date to suppress until

### Dependencies
- **Internal:** `@mylife/garden` (engine/watering.ts for getSeason, adjustFrequencyForSeason), `@mylife/ui`
- **External:** None
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a plant parent, I want to see what seasonal care tasks are coming up so that I can prepare for spring repotting, winter dormancy adjustments, etc.
2. As a plant parent, I want automatic suggestions for seasonal tasks based on my plant types so that I don't have to research each plant's seasonal needs individually.
3. As a plant parent, I want to see how my watering schedule changes with the season so that I understand why frequencies adjust.
4. As a plant parent, I want to mark seasonal tasks as complete or snooze them so that I can track my progress through seasonal care checklists.
5. As a plant parent, I want a seasonal calendar view showing upcoming tasks by month so that I can plan ahead.

### Behavior Specification

**Seasonal care dashboard:**
1. User navigates to Garden > Tasks tab (or taps "Seasonal Care" from Garden tab action bar)
2. Screen header shows current season with icon and date range (e.g., "Spring: Mar 1 - May 31")
3. "This Season" section: list of pending seasonal tasks for the current season, grouped by urgency (overdue first, then due this month, then upcoming)
4. Each task card shows: plant name + photo thumbnail, task type icon + label, description, due month, "Done" checkbox, "Snooze" button
5. "Watering Adjustments" section: shows current season multiplier (e.g., "Summer: watering intervals reduced to 67%") with a list of affected plants and their adjusted frequencies
6. "Next Season Preview" section: collapsed by default, expandable to show upcoming tasks for the following season
7. Bottom: "View Full Calendar" link to month-by-month view

**Seasonal task generation:**
1. When a plant is created or the season changes, the engine auto-generates seasonal tasks based on plant type/species
2. Tasks come from a bundled knowledge base (seasonal-data.ts) that maps plant categories to seasonal care actions
3. Categories: tropical houseplant, succulent/cactus, herb, vegetable, flower, tree/shrub
4. If species is unknown, tasks default to "tropical houseplant" (the most common category for indoor plants)
5. Generated tasks are persisted to gd_seasonal_tasks so the user can complete/snooze them

**Calendar view:**
1. 12-month horizontal scroll, current month highlighted
2. Each month shows a count badge of tasks due that month
3. Tapping a month shows task list for that month
4. Tasks from all seasons visible in their respective months

### Edge Cases

- **Season transitions:** When the season changes (e.g., Feb 28 -> Mar 1), auto-generate tasks for the new season if they don't already exist for this year
- **No plants:** Show empty state: "Add plants to get seasonal care suggestions"
- **All tasks completed:** Show congratulations message: "All seasonal care done! Your plants are thriving."
- **Custom tasks:** User can add manual seasonal tasks not from the knowledge base
- **Dead/dormant plants:** Skip task generation for dead plants. Dormant plants still get winter care tasks.
- **Mid-season module enable:** If user enables garden module mid-summer, generate current season tasks immediately
- **Plant deleted:** CASCADE delete removes associated seasonal tasks
- **Snooze past season end:** Snoozed tasks auto-expire at season end (don't carry over unless task_type is season-independent)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Seasonal care screen shows current season with correct date range
- [ ] **AC-2:** Pending seasonal tasks listed grouped by urgency (overdue, this month, upcoming)
- [ ] **AC-3:** Each task card shows plant info, task type, description, and due month
- [ ] **AC-4:** Marking a task "Done" moves it to completed section with timestamp
- [ ] **AC-5:** Snoozing a task hides it until the specified date
- [ ] **AC-6:** Watering adjustments section shows current multiplier and per-plant adjusted frequencies
- [ ] **AC-7:** Next season preview expandable to show upcoming tasks
- [ ] **AC-8:** Calendar view shows 12 months with task count badges
- [ ] **AC-9:** Auto-generated tasks appear when plants are created (based on plant category)
- [ ] **AC-10:** User can add custom seasonal tasks

### Technical Criteria
- [ ] **TC-1:** Seasonal tasks persisted to gd_seasonal_tasks with all fields
- [ ] **TC-2:** Task generation uses bundled knowledge base, not network calls
- [ ] **TC-3:** getSeason() correctly maps months to seasons (Northern Hemisphere default)
- [ ] **TC-4:** adjustFrequencyForSeason() multipliers applied correctly (summer 0.67x, winter 2.0x, spring 0.85x, fall 1.0x)
- [ ] **TC-5:** CASCADE delete on plant_id removes orphaned seasonal tasks
- [ ] **TC-6:** Task generation is idempotent: re-running for the same plant+season doesn't create duplicates
- [ ] **TC-7:** Completed tasks are excluded from pending count

### Negative Criteria
- [ ] **NC-1:** Seasonal care must NOT require network connectivity
- [ ] **NC-2:** Must NOT generate tasks for dead plants
- [ ] **NC-3:** Completing seasonal tasks must NOT affect watering schedule or plant status
- [ ] **NC-4:** Seasonal multiplier adjustments must NOT overwrite user-set custom water frequencies

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E`
- Season header: full-width banner with season icon (🌸 spring, ☀️ summer, 🍂 fall, ❄️ winter), season name, date range, and a soft gradient in accent color
- Task cards: glass morphism, plant photo thumbnail (40x40 circle), task type icon, description text, "Done" circle checkbox (accent when checked), overflow menu with "Snooze" option
- Watering adjustments: info card with water droplet icon, multiplier text in accent color, collapsible plant list below
- Calendar: horizontal scroll of month pills, current month has accent border, tapping opens month task list as a bottom sheet

### Web (Next.js)

- Same tokens via CSS variables
- Sidebar shows "Seasonal Care" under Garden navigation
- 2-panel layout: calendar left (vertical month list), task list right
- Route: `/garden/seasonal`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton task cards | Initial data fetch |
| Empty | "Add plants to get seasonal care suggestions" + Add Plant CTA | No plants exist |
| Error | "Could not load seasonal tasks. Pull to retry." | DB query fails |
| Success | Season header + task list + watering adjustments | Tasks generated for current season |
| All Done | "All seasonal care done!" celebration message | All tasks completed |

## Test Requirements

### Unit Tests
- [ ] `generateSeasonalTasks()`: creates correct tasks for tropical houseplant in spring
- [ ] `generateSeasonalTasks()`: creates correct tasks for succulent in winter
- [ ] `generateSeasonalTasks()`: idempotent -- no duplicates on re-run
- [ ] `generateSeasonalTasks()`: skips dead plants
- [ ] `completeSeasonalTask()`: sets completed_at timestamp
- [ ] `snoozeSeasonalTask()`: sets snoozed_until date
- [ ] `getPendingTasks()`: excludes completed and snoozed tasks
- [ ] `getPendingTasks()`: orders by urgency (overdue > this month > upcoming)
- [ ] `getSeasonalCalendar()`: returns task counts by month for 12 months
- [ ] Existing: `getSeason()` and `adjustFrequencyForSeason()` remain correct

### Integration Tests
- [ ] Full flow: create plant -> verify seasonal tasks generated -> complete task -> verify in DB
- [ ] Season transition: simulate month change -> verify new season tasks generated
- [ ] Delete plant: verify CASCADE removes seasonal tasks

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden module
3. Add a plant with species set to a tropical houseplant
4. Navigate to Tasks tab or Seasonal Care screen
5. Verify: season header shows current season with correct date range -- AC-1
6. Verify: auto-generated tasks appear for the plant -- AC-9
7. Verify: tasks grouped by urgency (overdue/this month/upcoming) -- AC-2
8. Verify: each task shows plant info, type icon, description -- AC-3
9. Tap "Done" on a task
10. Verify: task moves to completed with timestamp -- AC-4
11. Tap "Snooze" on a task, set date 7 days out
12. Verify: task disappears from pending list -- AC-5
13. Scroll to "Watering Adjustments" section
14. Verify: current season multiplier shown with per-plant adjusted frequencies -- AC-6
15. Expand "Next Season Preview"
16. Verify: upcoming season tasks shown -- AC-7
17. Tap "View Full Calendar"
18. Verify: 12 months shown with task count badges -- AC-8
19. Add a custom seasonal task
20. Verify: custom task appears in list -- AC-10
21. Delete the plant
22. Verify: all associated seasonal tasks are removed
23. On web: navigate to /garden/seasonal
24. Verify: 2-panel layout with calendar and task list

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for seasonal task generation engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Watering engine has getSeason() and adjustFrequencyForSeason() but no user-facing seasonal care system. No seasonal tasks, no calendar view, no task completion tracking.

### After This Work
- New gd_seasonal_tasks table
- Seasonal care engine with auto-generated tasks from bundled knowledge base
- Task completion and snooze tracking
- Seasonal care calendar screen on mobile and web
- Watering adjustment visibility (shows users how frequencies change by season)

### Files Changed
- `modules/garden/src/engine/seasonal-care.ts` -- Task generation, completion, snooze logic
- `modules/garden/src/engine/seasonal-data.ts` -- Bundled plant category to seasonal task mapping
- `modules/garden/src/types.ts` -- SeasonalTask, SeasonalTaskType, SeasonalCareSchedule types
- `modules/garden/src/db/crud.ts` -- Seasonal task CRUD
- `modules/garden/src/db/schema.ts` -- gd_seasonal_tasks CREATE TABLE
- `modules/garden/src/definition.ts` -- V2 migration
- `apps/mobile/app/(garden)/seasonal.tsx` -- Seasonal care screen
- `apps/mobile/app/(garden)/components/SeasonalTaskCard.tsx` -- Task card
- `apps/web/app/garden/seasonal/page.tsx` -- Web seasonal calendar

### Known Limitations
- V1 assumes Northern Hemisphere seasons. Southern Hemisphere support (invert months) is a future enhancement.
- Bundled knowledge base covers ~20 common plant categories. Species-specific care data requires the plant care database (GD-018 from spec).
- No push notifications for seasonal transitions in V1. User must open the app.

### Context for Next Agent
- The existing `getSeason()` and `adjustFrequencyForSeason()` functions in engine/watering.ts should be reused, not duplicated.
- The seasonal-data.ts knowledge base should be a pure TypeScript data structure (not a DB table) for simplicity and offline access.
- Task generation must be idempotent: check if tasks already exist for this plant+season+year before creating new ones.
