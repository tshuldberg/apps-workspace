# Feature Spec: Multi-Pet Dashboard

## Metadata
- **Module:** pets
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** 3
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Pet profile CRUD (V1), Feeding schedule + logs (V3), Exercise log (V2), Vaccination records (V1), Medication tracking (V1)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The existing `getPetDashboard` function in `crud.ts` returns per-pet stats (due vaccinations, due medications, next feeding, total expenses, last vet visit, latest weight, last exercise, next grooming, photo count). Multi-pet households need a single screen that aggregates all pets' urgent items, today's feeding status, and upcoming tasks without tapping into each pet individually. This is the module-level landing page that transforms MyPets from a pet profile viewer into a daily care management tool. 11pets and PetDesk both offer multi-pet daily views, so this is expected functionality for users switching from those apps.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | Yes | Premium ($20/yr) | Multi-pet overview with health alerts, upcoming events, daily task checklist |
| PetDesk | Yes | Free | Multi-pet dashboard tied to vet practice, appointment reminders, vaccination status |
| Pawp | Partial | Yes ($24/mo) | Single-pet focus with vet telehealth, no multi-pet daily view |
| FitBark | No | N/A | Single-pet activity monitor, no multi-pet aggregation |
| Dogo | No | N/A | Single-dog training focus, no multi-pet dashboard |
| Pupford | No | N/A | Content-first, no pet management dashboard |

### Target User
Multi-pet household managers (2-5 pets, mix of dogs/cats) who need a morning glance at what every pet needs today: who has been fed, which medications are due, what vaccinations are overdue, and what grooming tasks are coming up. Currently these users open each pet profile individually to check status, which is tedious with 3+ pets.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/engine/dashboard.ts           -- Pure functions: multi-pet aggregation, today's overview
modules/pets/src/db/crud.ts                    -- New queries: listAllUpcomingReminders, getAllPetsFeedingStatus
modules/pets/src/types.ts                      -- New types: MultiPetDashboard, UpcomingTask, PetFeedingSummary
modules/pets/src/index.ts                      -- Re-export new public API
modules/pets/src/__tests__/dashboard.test.ts   -- Engine + CRUD tests
apps/mobile/app/(pets)/index.tsx               -- Module-level dashboard screen
apps/web/app/pets/page.tsx                     -- Web dashboard page
```

### Wireframe Position

```
Hub Dashboard
  +-- MyPets card (tap to enter module)
       +-- Multi-Pet Dashboard  <-- YOU ARE HERE
       |    +-- Pet avatar row (horizontal scroll)
       |    +-- Urgent alerts section
       |    +-- Today's feeding grid
       |    +-- Upcoming tasks list
       |    +-- Monthly spend summary
       +-- Pet Detail (tap a pet)
       +-- Settings
```

### Data Model

No new tables. This feature reads existing data from:

```sql
-- Reads from existing tables (no schema changes):
-- pt_pets             -- pet profiles (name, species, breed, image_uri, is_archived)
-- pt_vaccinations     -- next_due_date for overdue/due_soon detection
-- pt_medications      -- next_due_at, is_active for due medication detection
-- pt_feeding_schedules -- feed_at times per pet
-- pt_feeding_logs     -- daily completion status per schedule
-- pt_grooming_records -- next_due_date for upcoming grooming
-- pt_expenses         -- amount_cents for monthly spend aggregation
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** None. All data is local SQLite reads.
- **Cross-Module:** None for MVP. Future: dashboard cards could deep-link to budget module for pet expense trends.

## Functional Requirements

### User Stories
1. As a multi-pet owner, I want to see all my pets on one screen with their most urgent needs so that I can plan my morning care routine in seconds.
2. As a pet owner, I want to see which pets have been fed today and which still need meals so that I do not accidentally skip or double-feed.
3. As a pet owner, I want to see overdue vaccinations and due medications across all pets in one urgent alerts section so that nothing falls through the cracks.
4. As a pet owner, I want to see upcoming tasks (grooming due, medications due, vaccinations due) in a combined timeline so that I can plan the week ahead.
5. As a single-pet owner, I want the dashboard to simplify into a single-pet view that still shows the same information without redundant pet selection UI.

### Behavior Specification

**Loading the dashboard:**
1. User navigates to MyPets module from hub dashboard
2. System queries all non-archived pets
3. System aggregates urgent alerts, feeding status, upcoming tasks, and monthly spend
4. Dashboard renders with 5 sections: pet avatar row, urgent alerts, today's feeding grid, upcoming tasks, monthly spend

**Pet avatar row:**
1. Horizontal scrollable row showing each pet's photo/avatar, name, and species emoji
2. Tapping a pet navigates to that pet's detail screen
3. Active pets only (archived pets excluded)
4. Sort order: alphabetical by name

**Urgent alerts section:**
1. Shows overdue vaccinations (nextDueDate < today)
2. Shows due medications (nextDueAt <= today, is_active = true)
3. Shows missed meals (feeding schedule time passed, no log for today)
4. Each alert shows pet name, alert type icon, and description
5. Tapping an alert navigates to the relevant pet detail section
6. If no urgent items, section is hidden (not shown as empty)

**Today's feeding grid:**
1. Shows each pet as a row
2. Each row shows the pet's scheduled meals with fed/unfed/pending status
3. Fed meals show green checkmark, unfed past meals show red indicator, future meals show gray circle
4. If a pet has no feeding schedule, show "No schedule" label
5. Overall completion bar at top: "3 of 8 meals complete"

**Upcoming tasks list:**
1. Combined list of upcoming (not yet overdue) items across all pets
2. Types: vaccinations due within 30 days, medications due within 7 days, grooming due within 14 days
3. Sorted by due date ascending
4. Each item shows: pet name, task type icon, description, days until due
5. Maximum 10 items shown, with "View all" link if more exist

**Monthly spend summary:**
1. Total expenses across all pets for current month
2. Per-pet breakdown bar chart (simple horizontal bars)
3. Tapping navigates to expenses detail (future feature, for now just display)

### Edge Cases

- **No pets:** Show "Add your first pet" CTA with paw illustration. All sections hidden.
- **Single pet:** Show all sections but remove the pet avatar row (unnecessary with one pet). Pet name appears in the header instead.
- **Archived pets:** Completely excluded from dashboard. No alerts, no feeding, no tasks.
- **10+ pets:** Avatar row scrolls horizontally. Feeding grid scrolls vertically. Performance: queries should complete in <100ms for 15 pets with full data.
- **No urgent alerts:** Urgent section is hidden entirely (not shown as "No alerts").
- **No feeding schedules for any pet:** Feeding grid section shows "No feeding schedules set up" with link to add one.
- **All meals complete:** Feeding grid shows green completion bar at 100% with celebratory label.
- **Pet with no data at all (just created):** Shows in avatar row but contributes nothing to alerts/tasks/spending.
- **Module just enabled (fresh database):** Same as "no pets" state.
- **Medication with null nextDueAt:** Excluded from alerts (as-needed medications have no due date).
- **Vaccination with null nextDueDate:** Excluded from alerts.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Dashboard shows a horizontal scrollable row of pet avatars (photo or species emoji fallback) with pet names
- [ ] **AC-2:** Urgent alerts section lists overdue vaccinations, due medications, and missed meals across all pets
- [ ] **AC-3:** Today's feeding grid shows each pet's meal completion status with fed/unfed/pending indicators
- [ ] **AC-4:** Overall feeding completion bar shows "X of Y meals complete" at the top of the feeding section
- [ ] **AC-5:** Upcoming tasks list shows vaccinations, medications, and grooming due within their respective windows
- [ ] **AC-6:** Monthly spend summary shows total and per-pet expense breakdown
- [ ] **AC-7:** Tapping a pet avatar navigates to that pet's detail screen
- [ ] **AC-8:** Tapping an urgent alert navigates to the relevant section for that pet
- [ ] **AC-9:** "Add your first pet" CTA appears when no pets exist
- [ ] **AC-10:** Single-pet mode simplifies the layout (no avatar row, pet name in header)
- [ ] **AC-11:** Archived pets are excluded from all dashboard sections

### Technical Criteria
- [ ] **TC-1:** `getMultiPetDashboard()` returns aggregated data for all non-archived pets in a single call
- [ ] **TC-2:** `getTodaysFeedingOverview()` returns per-pet feeding status using existing `getDailyFeedingStatus` from `engine/feeding.ts`
- [ ] **TC-3:** `getUpcomingTasks()` returns combined sorted list from vaccinations, medications, and grooming with configurable lookahead windows
- [ ] **TC-4:** `listAllUpcomingReminders()` CRUD function queries across all pets with a single query per table (not N+1)
- [ ] **TC-5:** `getAllPetsFeedingStatus()` CRUD function retrieves all schedules and today's logs in 2 queries total (not per-pet)
- [ ] **TC-6:** Dashboard queries complete in <100ms for 15 pets with full data
- [ ] **TC-7:** No new database tables or migrations required

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Dashboard must NOT include archived pets in any section
- [ ] **NC-2:** Dashboard must NOT make N+1 queries (one per pet) for feeding status or reminders
- [ ] **NC-3:** Must NOT create new database tables or migrations
- [ ] **NC-4:** Must NOT modify existing `getPetDashboard()` function (it remains per-pet)
- [ ] **NC-5:** Must NOT show empty sections (hide sections with no data instead)
- [ ] **NC-6:** Dashboard data must NOT require network requests (offline-first, local-only)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Pet avatar row:** Horizontal FlatList, 56px circular images with `rgba(255,255,255,0.10)` border, 2px border on selected/tapped, pet name below in `rgba(240,240,245,0.65)` 12px text
- **Urgent alerts cards:** `rgba(255,69,58,0.08)` background with `#FF453A` left border accent (4px), icon + pet name + description. Module accent `#F59E0B` for the section header icon.
- **Feeding grid:** `rgba(255,255,255,0.04)` (glass token) rows with `rgba(255,255,255,0.10)` border, 12px border radius. Fed indicator: `#30D158` filled circle. Missed: `#FF453A` filled circle. Pending: `rgba(255,255,255,0.10)` empty circle. Completion bar: `#F59E0B` fill on `rgba(255,255,255,0.06)` track.
- **Upcoming tasks cards:** `rgba(255,255,255,0.04)` glass cards with task type icon in `#F59E0B`, pet name in `#F0F0F5`, due date in `rgba(240,240,245,0.65)`.
- **Monthly spend:** `rgba(255,255,255,0.04)` card, per-pet horizontal bars using pet-specific hue variants of `#F59E0B`, total in large `#F0F0F5` text.
- **Empty state:** Paw print illustration centered, "Add your first pet" button with `#F59E0B` background.
- **Layout:** ScrollView wrapping all sections. Section headers in `#F0F0F5` 16px semibold with `#F59E0B` icon.

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Dashboard at `/pets` route (module landing page)
- Sidebar navigation: "Dashboard" is the first item under MyPets
- Pet avatar row uses CSS `overflow-x: auto` with `scroll-snap-type: x mandatory`
- Glass cards use CSS `backdrop-filter: blur(12px)` for glass effect
- Feeding grid uses CSS Grid for meal status alignment
- Responsive: 2-column layout at 1024px+ (alerts + feeding left, tasks + spend right), single column below

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | 4 skeleton sections with pulsing animation | Initial data fetch |
| Empty (no pets) | Paw illustration, "Add your first pet" CTA | No pets in database |
| Single pet | Simplified header with pet name, all sections minus avatar row | Exactly 1 non-archived pet |
| Multi pet | Full dashboard with avatar row + all sections | 2+ non-archived pets |
| All clear | Feeding grid at 100%, no urgent alerts section, tasks section may show upcoming | No overdue items, all meals fed |
| Urgent items | Red-tinted alert cards at top | Overdue vaccinations, due meds, or missed meals |
| Error | Toast: "Could not load dashboard." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/dashboard.ts)
- [ ] `getMultiPetDashboard`: returns empty result when no pets
- [ ] `getMultiPetDashboard`: excludes archived pets
- [ ] `getMultiPetDashboard`: aggregates urgent alerts across 3 pets (overdue vaccinations, due medications, missed meals)
- [ ] `getMultiPetDashboard`: returns singlePetMode=true when exactly 1 pet
- [ ] `getTodaysFeedingOverview`: returns per-pet feeding status with correct fed/unfed/pending counts
- [ ] `getTodaysFeedingOverview`: returns "No schedule" for pets without feeding schedules
- [ ] `getTodaysFeedingOverview`: overall completion counts across all pets
- [ ] `getUpcomingTasks`: combines vaccinations (30d), medications (7d), grooming (14d) sorted by due date
- [ ] `getUpcomingTasks`: caps at maxItems (default 10) with hasMore flag
- [ ] `getUpcomingTasks`: excludes overdue items (those go in urgent alerts)
- [ ] `getUpcomingTasks`: excludes archived pets' tasks
- [ ] `getUpcomingTasks`: returns empty when no upcoming tasks

### Integration Tests (CRUD)
- [ ] `listAllUpcomingReminders` returns correct reminders across 3 pets in 2 queries
- [ ] `getAllPetsFeedingStatus` returns all schedules and today's logs without N+1 queries
- [ ] Dashboard data for 10 pets returns in <100ms (performance check)
- [ ] Archived pet data excluded from all aggregate queries
- [ ] Newly created pet with no data appears in pet list but contributes zero to aggregates

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. **Verify empty state:** See paw illustration and "Add your first pet" button -- AC-9
4. Create pet "Luna" (dog, golden retriever) with 2 feeding schedules (07:30, 17:30)
5. **Verify single-pet mode:** No avatar row, "Luna" in header, feeding grid shows 2 meals -- AC-10
6. Create pet "Max" (cat, siamese) with 1 feeding schedule (08:00)
7. **Verify multi-pet mode:** Avatar row with Luna + Max, feeding grid shows 3 total meals -- AC-1, AC-3
8. Add a vaccination for Luna with nextDueDate = yesterday
9. **Verify urgent alert:** Red card showing "Luna - Overdue: [vaccine name]" -- AC-2
10. Tap the alert
11. **Verify navigation:** Opens Luna's detail at vaccinations section -- AC-8
12. Navigate back to dashboard
13. Mark Luna's breakfast as "Fed" in the feeding screen
14. Navigate back to dashboard
15. **Verify feeding grid:** Luna's breakfast shows green check, dinner shows gray pending -- AC-3
16. **Verify completion bar:** "1 of 3 meals complete" -- AC-4
17. Add grooming record for Max with nextDueDate = 7 days from now
18. **Verify upcoming tasks:** Shows Max's grooming task with "7 days" label -- AC-5
19. Add an expense for Luna ($50 vet) and Max ($30 food) this month
20. **Verify monthly spend:** Shows $80 total with per-pet bars -- AC-6
21. Tap Luna's avatar
22. **Verify navigation:** Opens Luna's detail screen -- AC-7
23. Archive Max from his detail screen
24. Navigate back to dashboard
25. **Verify:** Max is removed from avatar row, feeding grid, alerts, tasks, and spend -- AC-11
26. **Verify:** Dashboard reverts to single-pet mode for Luna only -- AC-10

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/pets` on web, verify all 5 states (loading, empty, single pet, multi pet, error)
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for dashboard aggregation engine (feeding overview, urgent alerts, upcoming tasks)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `getPetDashboard()` in `crud.ts` returns per-pet stats (single pet at a time)
- `getDailyFeedingStatus()` in `engine/feeding.ts` computes per-pet daily feeding status
- `collectVaccinationReminders()` and `collectMedicationReminders()` in `engine/reminders.ts` collect reminders from arrays
- No module-level dashboard aggregating across all pets
- No mobile or web UI for multi-pet overview
- Each pet must be opened individually to check status

### After This Work
- New `engine/dashboard.ts` with pure functions: `getMultiPetDashboard`, `getTodaysFeedingOverview`, `getUpcomingTasks`
- New CRUD queries: `listAllUpcomingReminders`, `getAllPetsFeedingStatus` (batch queries, not N+1)
- New types: `MultiPetDashboard`, `UpcomingTask`, `PetFeedingSummary`
- Mobile screen at `apps/mobile/app/(pets)/index.tsx` with full multi-pet dashboard
- Web page at `apps/web/app/pets/page.tsx` with responsive dashboard layout
- 12+ new tests covering engine logic and CRUD operations

### Files Changed

- `modules/pets/src/engine/dashboard.ts` -- New: multi-pet aggregation pure functions
- `modules/pets/src/types.ts` -- New types: MultiPetDashboard, UpcomingTask, PetFeedingSummary, UpcomingTaskType enum
- `modules/pets/src/db/crud.ts` -- New queries: listAllUpcomingReminders, getAllPetsFeedingStatus
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/dashboard.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/index.tsx` -- Module-level dashboard screen
- `apps/web/app/pets/page.tsx` -- Web dashboard page

### Known Limitations
- Monthly spend chart is display-only (no drill-down to expense detail in this feature).
- Upcoming tasks list caps at 10 items. Full task list requires navigating to individual pets.
- No push notification integration for dashboard alerts (alerts are visual only when the screen is open).
- No widget or lock-screen summary (future feature).
- Performance target is <100ms for 15 pets. Behavior with 50+ pets is untested.

### Context for Next Agent
- The existing `getPetDashboard()` function in `crud.ts` (line 1316) queries per-pet. The new `getMultiPetDashboard` engine function should call new batch CRUD queries that fetch data across all pets at once, then aggregate in memory. Do NOT call `getPetDashboard()` in a loop.
- `getDailyFeedingStatus()` in `engine/feeding.ts` is a pure function that takes arrays of schedules and logs. The new `getTodaysFeedingOverview` function should fetch all schedules + all today's logs in 2 queries, then group by pet and call `getDailyFeedingStatus()` per pet.
- Reminder collection functions (`collectVaccinationReminders`, `collectMedicationReminders`) in `engine/reminders.ts` already accept arrays. Fetch all vaccinations and all medications in batch, then pass to these existing functions.
- The `is_archived` column on `pt_pets` is an INTEGER (0/1). Filter with `WHERE is_archived = 0` in all dashboard queries.
- For the feeding grid, the `feed_at` column stores "HH:MM" format. Compare against current local time to determine pending/missed/fed status using the existing `getDailyFeedingStatus` function.
