# Trails Web UI Spec

**Module:** `@mylife/trails` (MyTrails)
**Task:** W14-8
**Date:** 2026-03-23
**Status:** Spec complete, ready for implementation
**Accent:** `#65A30D` (lime green)
**Reference implementation:** `apps/web/app/books/`

---

## Phase 1: Office Hours (Builder Mode)

### The Product Question

What makes a trails web app worth opening on desktop instead of mobile?

Mobile trails apps (AllTrails, Komoot, Gaia GPS) dominate because GPS recording is phone-native. But three activities happen *before and after* the hike where desktop is strictly better:

1. **Trip Planning** -- Multi-day itineraries with drag-and-drop day scheduling, side-by-side map + timeline, and bulk activity management. On a phone, this is tap-tap-tap through nested screens. On desktop, it's one glanceable workspace.
2. **Data Review** -- Sortable, filterable tables of recordings with multi-column views (date, distance, elevation, pace, duration). Comparing segment efforts across recordings. Exporting GPX files.
3. **Packing Lists** -- Checkable tables with category grouping, printable format, and keyboard-driven entry. The kind of task you do at your desk the night before a trip.

### Narrowest Wedge

**Trip Planner.** A user who has 3+ trips planned will open MyTrails on desktop to organize itineraries, assign trails to days, attach packing lists, and review the full plan. This is the "I need this on desktop" screen.

### Web-Specific Affordances

| Affordance | Where Used |
|-----------|------------|
| Multi-panel layouts | Trip planner (timeline + map), trail detail (info + reviews + segments) |
| Sortable data tables | Recordings list, trail list, segment efforts, packing items |
| Keyboard shortcuts | `/` focus search, `n` new trail/trip, `Esc` close detail panels |
| Drag-and-drop | Reorder trip activities within a day, reorder packing items |
| Bulk actions | Select multiple recordings for GPX export, bulk-delete trails |
| Print view | Packing checklists formatted for printer |
| Dense information display | Stats dashboard with 8+ metric cards, recording comparison tables |
| Inline editing | Trip notes, activity descriptions, packing item names |

### Scope Decision

Build all 7 feature domains present in mobile:
1. Dashboard (stats + recent activity)
2. Trail list (search, filter, CRUD)
3. Recordings (history, detail with elevation profile)
4. Trip planner (multi-day itineraries)
5. Packing lists (templates + checklists)
6. Discover (trail database search + save)
7. Reviews (per-trail community reviews)

**Excluded from V1 (mobile-only):**
- GPS recording (requires device sensors)
- Offline map downloads (browser storage constraints)
- Wrong-turn alerts / deviation detection (real-time GPS)
- Route builder with live waypoint placement (complex map interaction, defer to V2)
- Segment tracking with live PB detection

**Web-enhanced features (better than mobile):**
- Trip planner with multi-panel layout
- Recording detail with large elevation profile charts
- Packing lists with keyboard-driven editing
- Discover with larger search results grid
- Stats dashboard with richer data visualization

---

## Phase 2: Engineering Review

### Module Inventory

**Schema:** 10 migrations, 13 tables (`tr_` prefix), SQLite

| Table | Purpose | Web Relevant? |
|-------|---------|---------------|
| `tr_trails` | Trail definitions (name, difficulty, distance, elevation, lat/lng, region) | Yes |
| `tr_recordings` | GPS recording history (trail FK, activity type, duration, distance, GPX) | Yes (read-only) |
| `tr_waypoints` | GPS waypoints per recording (lat/lng/elevation/timestamp) | Yes (read-only) |
| `tr_photos` | Geotagged photos | Yes (display only) |
| `tr_offline_regions` | Offline map tile management | No (mobile-only) |
| `tr_alert_settings` | Wrong-turn alert config | No (mobile-only) |
| `tr_deviation_events` | Off-trail deviation logs | No (mobile-only) |
| `tr_weather_cache` | Weather forecast cache | Deferred |
| `tr_segments` | Named trail segments for PB tracking | Yes (read-only) |
| `tr_segment_efforts` | Timed efforts on segments | Yes (read-only) |
| `tr_packing_templates` | Packing list templates | Yes |
| `tr_packing_items` | Individual packing items with check state | Yes |
| `tr_trips` | Trip itinerary headers | Yes |
| `tr_trip_days` | Days within a trip | Yes |
| `tr_trip_activities` | Activities within a day | Yes |
| `tr_trail_database` | External trail catalog (OSM) | Yes |
| `tr_planned_routes` | User-created route plans | Deferred |
| `tr_route_waypoints` | Waypoints for planned routes | Deferred |
| `tr_reviews` | Community trail reviews | Yes |

### CRUD Functions Required by Web

**Trail CRUD (5):** `createTrail`, `getTrail`, `getTrails`, `updateTrail`, `deleteTrail`
**Recording read (4):** `getRecording`, `getRecordings`, `getRecordingsByTrail`, `deleteRecording`
**Waypoints read (1):** `getWaypointsByRecording`
**Stats (1):** `getTrailStats`
**Packing full CRUD (10):** `createPackingTemplate`, `getPackingTemplates`, `getPackingTemplate`, `createPackingItem`, `getPackingItems`, `checkItem`, `uncheckItem`, `uncheckAll`, `deletePackingTemplate`, `deletePackingItem`, `getPackingProgress`
**Trip full CRUD (10):** `createTrip`, `getTrip`, `getTrips`, `deleteTrip`, `createTripDay`, `getTripDays`, `deleteTripDay`, `createTripActivity`, `getTripActivities`, `deleteTripActivity`, `reorderActivities`
**Discover (3):** `getDatabaseEntries`, `searchDatabaseTrails`, `saveDatabaseTrailToMyTrails`
**Reviews (8):** `createReview`, `getReviewsByTrail`, `updateReview`, `deleteReview`, `getAverageRating`, `getReviewCount`, `getRecentConditions`, `getRatingDistribution`
**Segments read (3):** `getSegmentsByTrail`, `getEffortsBySegment`, `getPersonalBest`
**Engines (5):** `formatDuration`, `haversineDistance`, `calculateElevationGain`, `calculatePace`, `estimateCalories`, `difficultyColor`, `calculateDifficulty`

**Total: 50 functions** needed from `@mylife/trails` for the web UI.

### Missing CRUD Operations (Gaps)

| Missing Function | Impact | Workaround |
|-----------------|--------|------------|
| `updateRecording` | Cannot edit recording name/metadata on web | Low priority -- recordings are GPS artifacts, rarely edited |
| `updateTrip` | Cannot edit trip name/dates/notes after creation | **Must add** -- trip editing is core to the planner |
| `updateTripDay` | Cannot edit day title/notes/date | **Must add** -- day editing needed for planner |
| `updateTripActivity` | Cannot edit activity name/description/type | **Must add** -- activity editing needed for planner |
| `updatePlannedRoute` | Route editing | Deferred (routes deferred from V1) |

**Pre-implementation requirement:** Add `updateTrip`, `updateTripDay`, `updateTripActivity` to `modules/trails/src/db/crud.ts` before building the trip planner web pages.

### Route Structure (Next.js App Router)

```
apps/web/app/trails/
  layout.tsx              # Module layout with nav header
  page.tsx                # Dashboard: stats + recent activity + quick actions
  actions.ts              # Server actions wrapping @mylife/trails CRUD
  ui.ts                   # Shared UI utilities (formatters, helpers)
  list/
    page.tsx              # All trails with search, difficulty filter, grid/list toggle
  [id]/
    page.tsx              # Trail detail: info, recordings, segments, reviews
  recordings/
    page.tsx              # All recordings with activity filter, sortable table
    [id]/
      page.tsx            # Recording detail: stats, waypoints, elevation profile
  trips/
    page.tsx              # Trip list: upcoming/past, create new
    [id]/
      page.tsx            # Trip detail: day-by-day itinerary, packing link, notes
  packing/
    page.tsx              # Packing templates list, create new
    [id]/
      page.tsx            # Packing checklist: categorized items, progress bar
  discover/
    page.tsx              # Trail database search, save to collection
  __tests__/
    dashboard-page.test.tsx
    trail-list-page.test.tsx
    trail-detail-page.test.tsx
    recordings-page.test.tsx
    recording-detail-page.test.tsx
    trips-page.test.tsx
    trip-detail-page.test.tsx
    packing-page.test.tsx
    packing-checklist-page.test.tsx
    discover-page.test.tsx
```

**Total: 10 routes, 1 layout, 1 actions file, 1 ui file, 10 test files**

### Data Flow

```
User interaction
    |
    v
Client component (useState, useEffect)
    |
    v
Server action (actions.ts)
    |
    v
ensureModuleMigrations('trails') + getAdapter()
    |
    v
@mylife/trails CRUD function (modules/trails/src/db/crud.ts)
    |
    v
SQLite via @mylife/db DatabaseAdapter
    |
    v
Response -> setState -> re-render
```

Pattern matches `apps/web/app/books/actions.ts` exactly:
- Each server action calls `db()` helper (adapter + migration check)
- Wraps a single CRUD function
- Returns plain data (no class instances)

### State Management

No external state library. Each page uses `useState` + `useEffect` calling server actions, same pattern as Books.

- Dashboard: `fetchStats()`, `fetchRecordings({ limit: 5 })`, `fetchTrails({ savedOnly: true, limit: 5 })`
- Lists: fetch on mount + refresh after mutations, with local search/filter state
- Detail pages: fetch by ID on mount, refresh after edits
- Trip planner: fetch trip + days + activities, local reorder state with optimistic UI

---

## Phase 3: Design Review

### Design Dimension Ratings

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Cool Obsidian compliance | 10/10 | All tokens from DESIGN.md. Accent #65A30D. Glass cards. Dark only. |
| Desktop optimization | 9/10 | Multi-panel trip planner, data tables, dense stats. -1 for no map view in V1. |
| Typography hierarchy | 10/10 | Inter throughout. heroTitle for dashboard greeting, stat for big numbers, heading for sections, body/caption for content. |
| Information density | 9/10 | Outdoor data is number-heavy. Stat pills, metric grids, sortable columns. Dense without clutter. |
| Glass morphism | 10/10 | `backdrop-filter: blur(40px) saturate(180%)` on cards. `glass.dock` on nav header. |
| Empty states | 10/10 | Every page has warm CTA: "Your trail collection is waiting", "Plan your first adventure". Module-specific icons, not generic. |
| Error states | 10/10 | Glass card with error message + retry. "Something went wrong" not stack traces. try/catch/finally pattern (books feedback rule). |
| Loading states | 10/10 | Skeleton screens matching card shapes. Pulsing at 60% opacity. No spinners. |
| Keyboard navigation | 9/10 | Tab order, focus indicators (2px lime outline), `/` for search. -1 for no Cmd+K integration yet. |
| Motion | 10/10 | 200ms ease-out micro-interactions. Stagger card appearance by 50ms. Respect prefers-reduced-motion. |

### Five States Per Page

| Page | Loading | Empty | Error | Success | Partial |
|------|---------|-------|-------|---------|---------|
| Dashboard | 4 skeleton metric cards + 3 skeleton list items | "Your trail collection is waiting" + Discover CTA | "Failed to load stats" + retry button | Full metrics + recent lists | Metrics loaded, recordings still loading |
| Trail list | 8 skeleton trail cards | "No trails saved" + Discover CTA | "Failed to load trails" + retry | Filtered grid/list | Search active with 0 results: "No matches" |
| Trail detail | Skeleton header + 3 section skeletons | N/A (404 if no trail) | "Trail not found" + back link | Full info + reviews + segments | Info loaded, reviews still loading |
| Recordings | 6 skeleton table rows | "No recordings yet" + mobile CTA | "Failed to load recordings" + retry | Sortable table | Filter active with 0 results |
| Recording detail | Skeleton stats + elevation chart skeleton | N/A (404) | "Recording not found" + back link | Full stats + elevation + waypoints | Stats loaded, waypoints still loading |
| Trips | 4 skeleton trip cards | "No trips planned" + Create CTA | "Failed to load trips" + retry | Upcoming/past sections | Create form open + list below |
| Trip detail | Skeleton timeline + 3 day skeletons | "Add your first day" + Add Day CTA | "Trip not found" + back link | Day-by-day itinerary | Days loaded, activities loading |
| Packing | 4 skeleton template cards | "No packing lists" + Create CTA | "Failed to load lists" + retry | Template grid | Template being created (inline form) |
| Packing checklist | Category section skeletons | "Empty list" + Add Item CTA | "Checklist not found" + back link | Categorized items + progress | Items loaded, progress calculating |
| Discover | 6 skeleton entry cards | "Trail database empty" (no search) | "Search failed" + retry | Search results grid | Saving trail (optimistic save button) |

---

## Phase 4: Design Consultation

### Module Design Identity

**Accent:** `#65A30D` (lime green) -- earthy, alive, outdoor
**Accent dim:** `rgba(101,163,13,0.15)`
**Accent border:** `rgba(101,163,13,0.25)`
**Icon vocabulary:** 🥾 (hiking/default), 🏃 (running), 🚴 (cycling), 🚶 (walking), 🏕️ (trips), 🎒 (packing), 🗺️ (map/dashboard), 🔍 (discover/search), 📍 (trail marker), 🏔️ (mountain/empty state), ⏱️ (recordings), ⚙️ (settings)

### Component Inventory

**Shared from `@mylife/ui` (reuse, do not rebuild):**
- Glass card (`glass.card` / `glass.strong` tokens via CSS)
- Color tokens (`colors.background`, `colors.surface`, etc.)
- Typography variants (via CSS classes matching token table)

**Module-specific components (build in `apps/web/app/trails/`):**

| Component | Used In | Description |
|-----------|---------|-------------|
| `DifficultyBadge` | Trail list, trail detail, discover | Pill badge colored by difficulty (easy=green, moderate=yellow, hard=orange, expert=red) |
| `MetricCard` | Dashboard, recording detail | Glass card with label + large accent-colored value |
| `StatPill` | Trail cards, recording cards | Compact stat chip (label above, value below) |
| `ActivityIcon` | Recording lists, trip activities | Maps activity type to emoji icon |
| `TrailCard` | Trail list, dashboard saved trails | Glass card with name, region, difficulty badge, stat pills |
| `RecordingRow` | Recordings table, dashboard recent | Table row / list item with activity icon, name, stats, date |
| `TripCard` | Trip list | Glass card with name, dates, day count, notes preview |
| `PackingProgress` | Packing checklist, packing list | Progress bar with checked/total count |
| `SectionHeader` | Multiple pages | Uppercase label-style section divider |
| `FilterChipBar` | Trail list, recordings | Horizontal row of filter pills (difficulty, activity type) |
| `EmptyState` | All pages | Icon + heading + description + CTA pattern |
| `SkeletonCard` | All pages | Pulsing glass card placeholder |
| `ElevationChart` | Recording detail | SVG elevation profile (waypoint data) |

### Layout Pattern

**Module layout** (`layout.tsx`):
```
+--------------------------------------------------+
| [logo] MyTrails   [Dashboard] [Trails] [Record-  |
|                    ings] [Trips] [Packing]        |
|                    [Discover]                     |
+--------------------------------------------------+
|                                                   |
|              {children} max-width: 1120px         |
|                                                   |
+--------------------------------------------------+
```

Glass header with `backdrop-filter: blur(14px)`, accent-colored module name, navigation links in `textSecondary`. Matches Books layout exactly.

### Page Wireframes

**1. Dashboard (`page.tsx`)**
```
+--------------------------------------------------+
| [Hero section - accent dim bg]                    |
|   MyTrails Dashboard                              |
|   "Your outdoor activity at a glance"             |
+--------------------------------------------------+
| [Metric grid - 4 cards]                           |
| Recordings | Distance | Elevation | Avg Pace     |
|     12     | 87.3 km  |  4,210 m  | 8.2 min/km  |
+--------------------------------------------------+
| [Quick actions row]                               |
| [Discover] [Plan Trip] [Packing Lists]            |
+--------------------------------------------------+
| RECENT RECORDINGS              SAVED TRAILS       |
| [RecordingRow]                 [TrailCard]         |
| [RecordingRow]                 [TrailCard]         |
| [RecordingRow]                 [TrailCard]         |
| View all >                     View all >          |
+--------------------------------------------------+
```
Desktop: 2-column layout for recent recordings + saved trails side by side.

**2. Trail List (`list/page.tsx`)**
```
+--------------------------------------------------+
| [Search input - glass border]                     |
| [Difficulty filter chips: All | Easy | Moderate   |
|  | Hard | Expert]                                 |
| 24 trails                    [Grid] [List] toggle |
+--------------------------------------------------+
| [TrailCard] [TrailCard] [TrailCard]               |
| [TrailCard] [TrailCard] [TrailCard]               |
| [TrailCard] [TrailCard] [TrailCard]               |
+--------------------------------------------------+
```
Grid view: `repeat(auto-fit, minmax(300px, 1fr))`. List view: single column full-width cards.

**3. Trail Detail (`[id]/page.tsx`)**
```
+--------------------------------------------------+
| [Back link]                                       |
| [Trail name - heading]         [DifficultyBadge]  |
| [Region - textSecondary]       [Save/Unsave btn]  |
+--------------------------------------------------+
| [Stat row: Distance | Elevation | Est. Time]      |
+--------------------------------------------------+
| DESCRIPTION                                       |
| [trail.description text]                          |
+--------------------------------------------------+
| RECORDINGS (3)                                    |
| [RecordingRow] [RecordingRow] [RecordingRow]      |
+--------------------------------------------------+
| SEGMENTS (2)                                      |
| [Segment card with PB badge]                      |
| [Segment card with PB badge]                      |
+--------------------------------------------------+
| REVIEWS (avg 4.2 / 5, 8 reviews)                 |
| [Rating distribution bar chart]                   |
| [Review card] [Review card]                       |
| [Write Review button]                             |
+--------------------------------------------------+
```

**4. Recordings (`recordings/page.tsx`)**
```
+--------------------------------------------------+
| Recordings                                        |
| [Activity filter: All | Hike | Run | Bike | Walk] |
+--------------------------------------------------+
| [Table header: Name | Activity | Distance |       |
|  Elevation | Duration | Pace | Date]              |
| [Row] Morning Ridge Run  🏃  8.2km  320m  42:10  |
| [Row] Sunset Trail Hike  🥾  5.1km  180m  1:23   |
| [Row] Valley Loop Bike   🚴  22.4km  90m  55:30  |
+--------------------------------------------------+
```
Sortable columns. Click row to navigate to detail.

**5. Recording Detail (`recordings/[id]/page.tsx`)**
```
+--------------------------------------------------+
| [Back link]                                       |
| [Recording name - heading]    [ActivityIcon]      |
| [Date - textSecondary]                            |
+--------------------------------------------------+
| [Metric grid: Distance | Elevation | Duration |   |
|  Pace | Calories]                                 |
+--------------------------------------------------+
| ELEVATION PROFILE                                 |
| [SVG chart - waypoint elevation over distance]    |
+--------------------------------------------------+
| WAYPOINTS (142 points)                            |
| [Compact table: # | Lat | Lng | Elev | Time]     |
+--------------------------------------------------+
```

**6. Trips (`trips/page.tsx`)**
```
+--------------------------------------------------+
| Trip Planner                    [+ New Trip]      |
+--------------------------------------------------+
| UPCOMING (2)                                      |
| [TripCard: Big Sur Weekend, Jun 14-16, 3 days]   |
| [TripCard: Yosemite Week, Jul 1-7, 7 days]       |
+--------------------------------------------------+
| PAST (4)                                          |
| [TripCard] [TripCard] [TripCard] [TripCard]      |
+--------------------------------------------------+
```

**7. Trip Detail (`trips/[id]/page.tsx`)**
```
+--------------------------------------------------+
| [Back link]                                       |
| [Trip name - heading, inline editable]            |
| [Date range - textSecondary]   [Packing list link]|
| [Notes - editable textarea]                       |
+--------------------------------------------------+
| DAY 1 - Jun 14                    [+ Add Activity]|
| [Activity: 🥾 Morning Ridge Hike - 8km, 3hr]     |
| [Activity: 🏕️ Camp Setup at Site 4]              |
+--------------------------------------------------+
| DAY 2 - Jun 15                    [+ Add Activity]|
| [Activity: 🥾 Valley Loop - 12km, 5hr]           |
| [Activity: 🍽️ Rest - Lunch at ranger station]    |
+--------------------------------------------------+
| [+ Add Day]                                       |
+--------------------------------------------------+
```
Activities are reorderable. Each activity links to a trail if assigned.

**8. Packing Lists (`packing/page.tsx`)**
```
+--------------------------------------------------+
| Packing Lists                   [+ New List]      |
+--------------------------------------------------+
| [Template card: Day Hike - 12 items, 8 checked]  |
| [Template card: Overnight - 24 items, 0 checked] |
| [Template card: Custom Trip - 6 items, 6 checked]|
+--------------------------------------------------+
```

**9. Packing Checklist (`packing/[id]/page.tsx`)**
```
+--------------------------------------------------+
| [Back link]                                       |
| [Template name - heading]      [Progress: 8/12]   |
| [PackingProgress bar - 67% green]                 |
+--------------------------------------------------+
| ESSENTIALS                                        |
| [x] Water bottles        [ ] First aid kit        |
| [x] Trail map            [x] Headlamp             |
+--------------------------------------------------+
| CLOTHING                                          |
| [x] Hiking boots         [ ] Rain jacket          |
| [x] Wool socks           [x] Sun hat              |
+--------------------------------------------------+
| [+ Add Item]              [Uncheck All] [Print]   |
+--------------------------------------------------+
```
Keyboard: Enter to add item, Space to toggle check, Tab between items.

**10. Discover (`discover/page.tsx`)**
```
+--------------------------------------------------+
| Discover Trails                                    |
| [Search input: "Search by name or region..."]     |
| 156 trails found                                   |
+--------------------------------------------------+
| [Entry card: Ridge Trail - 🥾 Hiking, 8.2km,     |
|  320m gain, Moderate, "Scenic ridge..." [+ Save]] |
| [Entry card: Valley Loop - 🚴 Cycling, 22km,     |
|  90m gain, Easy, "Flat valley..." [+ Save]]       |
| [Entry card] [Entry card] [Entry card]            |
+--------------------------------------------------+
```
Grid layout: `repeat(auto-fit, minmax(340px, 1fr))`.

### Write Review Modal (inline on trail detail)

```
+--------------------------------------------------+
| Write a Review                                     |
| [Star rating: 1-5 clickable stars]                |
| [Title input]                                      |
| [Body textarea]                                    |
| [Conditions dropdown: excellent/good/fair/poor]   |
| [Date visited picker]                              |
| [Cancel] [Submit Review - accent button]          |
+--------------------------------------------------+
```

---

## Implementation Blueprint

### File Creation Order

**Phase A: Foundation (3 files)**
1. `apps/web/app/trails/actions.ts` -- Server actions (50 functions)
2. `apps/web/app/trails/ui.ts` -- Shared formatters + helpers
3. `apps/web/app/trails/layout.tsx` -- Module layout with nav

**Phase B: Dashboard + Lists (3 files)**
4. `apps/web/app/trails/page.tsx` -- Dashboard with stats + recent activity
5. `apps/web/app/trails/list/page.tsx` -- Trail list with search/filter
6. `apps/web/app/trails/recordings/page.tsx` -- Recordings table

**Phase C: Detail Pages (3 files)**
7. `apps/web/app/trails/[id]/page.tsx` -- Trail detail
8. `apps/web/app/trails/recordings/[id]/page.tsx` -- Recording detail + elevation chart
9. `apps/web/app/trails/discover/page.tsx` -- Trail database search

**Phase D: Trip Planner (2 files, requires CRUD additions first)**
10. `apps/web/app/trails/trips/page.tsx` -- Trip list
11. `apps/web/app/trails/trips/[id]/page.tsx` -- Trip detail planner

**Phase E: Packing (2 files)**
12. `apps/web/app/trails/packing/page.tsx` -- Packing template list
13. `apps/web/app/trails/packing/[id]/page.tsx` -- Packing checklist

### Pre-Implementation CRUD Additions

Add to `modules/trails/src/db/crud.ts`:

```typescript
// Required before Phase D
export function updateTrip(db, id, input: { name?: string; startDate?: string | null; endDate?: string | null; notes?: string | null; packingTemplateId?: string | null }): Trip | null
export function updateTripDay(db, id, input: { dayNumber?: number; date?: string | null; title?: string | null; notes?: string | null }): TripDay | null
export function updateTripActivity(db, id, input: { name?: string; description?: string | null; type?: string; trailId?: string | null; sortOrder?: number }): TripActivity | null
```

### actions.ts Function Map

```typescript
// Trail CRUD
fetchTrails(filters?) -> getTrails(db(), filters)
fetchTrail(id) -> getTrail(db(), id)
addTrail(input) -> createTrail(db(), uuid(), input)
editTrail(id, input) -> updateTrail(db(), id, input)
removeTrail(id) -> deleteTrail(db(), id)

// Recordings (read-only on web)
fetchRecordings(options?) -> getRecordings(db(), options)
fetchRecording(id) -> getRecording(db(), id)
fetchRecordingsByTrail(trailId) -> getRecordingsByTrail(db(), trailId)
fetchWaypoints(recordingId) -> getWaypointsByRecording(db(), recordingId)
removeRecording(id) -> deleteRecording(db(), id)

// Stats
fetchStats() -> getTrailStats(db())

// Packing
fetchPackingTemplates() -> getPackingTemplates(db())
fetchPackingTemplate(id) -> getPackingTemplate(db(), id)
addPackingTemplate(input) -> createPackingTemplate(db(), uuid(), input)
removePackingTemplate(id) -> deletePackingTemplate(db(), id)
fetchPackingItems(templateId) -> getPackingItems(db(), templateId)
addPackingItem(input) -> createPackingItem(db(), uuid(), input)
togglePackingItem(id, checked) -> checkItem/uncheckItem(db(), id)
uncheckAllItems(templateId) -> uncheckAll(db(), templateId)
removePackingItem(id) -> deletePackingItem(db(), id)
fetchPackingProgress(templateId) -> getPackingProgress(db(), templateId)

// Trips
fetchTrips() -> getTrips(db())
fetchTrip(id) -> getTrip(db(), id)
addTrip(input) -> createTrip(db(), uuid(), input)
editTrip(id, input) -> updateTrip(db(), id, input)
removeTrip(id) -> deleteTrip(db(), id)
fetchTripDays(tripId) -> getTripDays(db(), tripId)
addTripDay(input) -> createTripDay(db(), uuid(), input)
removeTripDay(id) -> deleteTripDay(db(), id)
editTripDay(id, input) -> updateTripDay(db(), id, input)
fetchTripActivities(dayId) -> getTripActivities(db(), dayId)
addTripActivity(input) -> createTripActivity(db(), uuid(), input)
removeTripActivity(id) -> deleteTripActivity(db(), id)
editTripActivity(id, input) -> updateTripActivity(db(), id, input)
reorderTripActivities(dayId, orderedIds) -> reorderActivities(db(), dayId, orderedIds)

// Discover
fetchDatabaseEntries() -> getDatabaseEntries(db())
searchTrailDatabase(query) -> searchDatabaseTrails(db(), query)
saveDiscoveredTrail(entry) -> saveDatabaseTrailToMyTrails(db(), entry, uuid())

// Reviews
fetchReviewsByTrail(trailId) -> getReviewsByTrail(db(), trailId)
addReview(input) -> createReview(db(), uuid(), input)
editReview(id, input) -> updateReview(db(), id, input)
removeReview(id) -> deleteReview(db(), id)
fetchAverageRating(trailId) -> getAverageRating(db(), trailId)
fetchReviewCount(trailId) -> getReviewCount(db(), trailId)
fetchRecentConditions(trailId) -> getRecentConditions(db(), trailId)
fetchRatingDistribution(trailId) -> getRatingDistribution(db(), trailId)

// Segments (read-only)
fetchSegmentsByTrail(trailId) -> getSegmentsByTrail(db(), trailId)
fetchEffortsBySegment(segmentId) -> getEffortsBySegment(db(), segmentId)
fetchPersonalBest(segmentId) -> getPersonalBest(db(), segmentId)
```

**Total: 48 server action functions.**

### Error Handling Pattern

Every page wraps server action calls in try/catch/finally (per feedback rule from `feedback_web_error_handling.md`):

```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setError(null);
  fetchTrails()
    .then((result) => { if (!cancelled) setTrails(result); })
    .catch(() => { if (!cancelled) setError('Failed to load trails'); })
    .finally(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
}, []);
```

---

## Test Plan

### Unit Tests (10 files, ~80 test cases)

**`dashboard-page.test.tsx`** (8 tests)
- Renders 4 metric cards with stats data
- Shows recent recordings section when data exists
- Shows saved trails section when data exists
- Shows empty state when no recordings or trails
- Quick action buttons link to correct routes
- Loading state shows skeleton cards
- Error state shows retry button
- Partial state: metrics loaded, lists loading

**`trail-list-page.test.tsx`** (10 tests)
- Renders trail cards in grid layout
- Search filters trails by name and region
- Difficulty filter chips work (all, easy, moderate, hard, expert)
- Grid/list view toggle works
- Shows trail count
- Empty state when no trails
- Empty state when search has no matches (different message)
- Trail cards link to detail page
- Trail cards show difficulty badge, distance, elevation
- Loading state shows skeleton cards

**`trail-detail-page.test.tsx`** (10 tests)
- Renders trail info (name, region, description, stats)
- Shows difficulty badge with correct color
- Lists recordings for this trail
- Shows segments with personal best badges
- Shows reviews with rating distribution
- Shows average rating and review count
- Write review form appears on button click
- Save/unsave toggle works
- 404 state for invalid trail ID
- Loading state shows section skeletons

**`recordings-page.test.tsx`** (8 tests)
- Renders recordings in table format
- Activity type filter works (all, hike, run, bike, walk)
- Table columns: name, activity, distance, elevation, duration, pace, date
- Clicking row navigates to detail
- Shows activity icon per type
- Empty state when no recordings
- Empty state with filter active
- Loading state shows skeleton rows

**`recording-detail-page.test.tsx`** (8 tests)
- Renders recording stats (distance, elevation, duration, pace, calories)
- Shows elevation profile chart from waypoint data
- Shows waypoint count
- Formats duration correctly
- Calculates pace correctly
- Shows linked trail name if trail_id exists
- 404 state for invalid recording ID
- Loading state shows metric skeletons + chart skeleton

**`trips-page.test.tsx`** (8 tests)
- Renders trips split into upcoming and past sections
- Create trip form: name input, create button
- New trip navigates to detail page
- Shows day count per trip
- Shows date range when set
- Delete trip with confirmation
- Empty state with create CTA
- Loading state shows skeleton trip cards

**`trip-detail-page.test.tsx`** (10 tests)
- Renders days with activities
- Add day button creates new day
- Add activity button creates new activity
- Activity shows type icon and trail link
- Delete activity removes it
- Delete day removes day and its activities
- Trip name is editable inline
- Trip notes are editable
- Link to packing list when template attached
- 404 state for invalid trip ID

**`packing-page.test.tsx`** (6 tests)
- Renders packing template cards
- Create template form
- Shows progress (checked/total)
- Delete template with confirmation
- Template cards link to checklist
- Empty state with create CTA

**`packing-checklist-page.test.tsx`** (8 tests)
- Renders items grouped by category
- Checkbox toggles item state
- Progress bar updates on check/uncheck
- Add item form with name + category
- Delete item removes it
- Uncheck all button resets all items
- Shows total progress fraction
- Empty list with add CTA

**`discover-page.test.tsx`** (6 tests)
- Renders trail database entries
- Search input with debounce filters results
- Save button adds trail to collection
- Shows trail type icon, difficulty, stats
- Empty state when database empty
- Empty state when search has no results

### Integration Test Approach

Server actions are tested through page-level tests that mock the `@mylife/trails` module. Each test:
1. Mocks the module CRUD functions
2. Renders the page component
3. Verifies correct functions are called with correct arguments
4. Verifies UI reflects the returned data

---

## QA Checklist

### Pre-QA Gate
- [ ] All 10 routes render without errors
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (all 80+ test cases)
- [ ] `pnpm gate:function:changed` passes

### Per-Page QA (via /browse)

**Dashboard**
- [ ] 4 metric cards show correct data
- [ ] Recent recordings list shows latest 5
- [ ] Saved trails list shows saved-only trails
- [ ] Quick action buttons navigate correctly
- [ ] Empty state renders when no data
- [ ] Skeleton loading state visible on slow load

**Trail List**
- [ ] Search filters by name and region
- [ ] Difficulty chips filter correctly
- [ ] Grid/list toggle works
- [ ] Trail count updates with filters
- [ ] Trail cards link to detail
- [ ] Empty states for no trails / no matches

**Trail Detail**
- [ ] Info section: name, region, description, stats
- [ ] Difficulty badge correct color
- [ ] Save/unsave toggle persists
- [ ] Recordings section lists trail-specific recordings
- [ ] Segments section shows PB badges
- [ ] Reviews section: rating distribution, individual reviews
- [ ] Write review form submits correctly
- [ ] 404 for invalid ID

**Recordings**
- [ ] Table renders with all columns
- [ ] Activity filter works
- [ ] Rows clickable to detail
- [ ] Activity icons correct per type
- [ ] Empty state for no recordings

**Recording Detail**
- [ ] Stats: distance, elevation, duration, pace, calories
- [ ] Elevation chart renders from waypoint data
- [ ] Linked trail name shown if exists
- [ ] 404 for invalid ID

**Trips**
- [ ] Upcoming/past sections render
- [ ] Create trip form: name input, creates and navigates
- [ ] Day count shown per trip
- [ ] Delete trip works
- [ ] Empty state with CTA

**Trip Detail**
- [ ] Days render with activities
- [ ] Add day creates new day
- [ ] Add activity creates within day
- [ ] Inline edit: trip name, notes
- [ ] Delete day/activity works
- [ ] Packing list link when template attached

**Packing**
- [ ] Template cards render with progress
- [ ] Create template form works
- [ ] Delete template with confirmation
- [ ] Cards link to checklist
- [ ] Empty state with CTA

**Packing Checklist**
- [ ] Items grouped by category
- [ ] Checkbox toggles work
- [ ] Progress bar updates live
- [ ] Add item form with name + category
- [ ] Delete item works
- [ ] Uncheck All resets all items

**Discover**
- [ ] Search with debounce filters database
- [ ] Save button adds to collection
- [ ] Trail type icon correct
- [ ] Difficulty badge correct
- [ ] Empty states for no DB / no results

### Cross-Cutting QA
- [ ] All pages use Cool Obsidian tokens (no light theme cards)
- [ ] Glass morphism: backdrop-filter on all glass elements
- [ ] Typography: Inter font, correct variant sizes
- [ ] Nav header links highlight active route
- [ ] No developer-facing text visible to users
- [ ] No placeholder buttons that do nothing
- [ ] Error states use try/catch/finally pattern (no stuck loading)
- [ ] All interactive elements have 44px+ touch/click targets
- [ ] Tab order matches visual order on all pages
- [ ] Focus indicators: 2px lime outline
- [ ] Responsive: single column below 768px, 2-column 768-1024, 3-column above 1024
- [ ] prefers-reduced-motion respected (instant state changes)

---

## Complexity Assessment

**Complexity: 2 (Large)**

Pipeline: `/plan-eng-review` -> BUILD (phased A-E) -> `/function-gate-runner` -> `/review` -> `/qa` -> merge

**Estimated file count:** 13 source files + 10 test files = 23 new files
**Module CRUD additions:** 3 new functions in `crud.ts`
**Server actions:** 48 functions in `actions.ts`
