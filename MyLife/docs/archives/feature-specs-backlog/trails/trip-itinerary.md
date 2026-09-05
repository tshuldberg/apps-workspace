# Feature Spec: Trip Itinerary

## Metadata
- **Module:** trails
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [2] x3 + Complexity [3] x2 + CrossModule [2] x1 + PaidUser [2] x1
- **Sprint:** 7
- **Estimated CC Time:** 2-3 hours (Complexity Inverse = 3, "Medium")
- **Depends On:** Packing templates (V6, for attaching packing lists to trips)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Multi-day outdoor trips require planning beyond a single trail: which trails on which days, driving/logistics between trailheads, campsite reservations, and overall scheduling. AllTrails has a basic trip planning feature. Wanderlog ($80/yr) is a dedicated travel planning app with itineraries, collaborative editing, and bookings integration. By adding trip itinerary planning to MyTrails, the module transforms from a "single trail recorder" to a "trip companion" that users interact with days or weeks before their trip, during the trip, and after for review. This increases engagement frequency and makes the module stickier.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AllTrails | Partial | Yes ($26.99-53.99/yr) | "Collections" can group trails for a trip, but no day-by-day itinerary or logistics. Basic. |
| Wanderlog | Yes | Yes ($79.99/yr) | Full itinerary builder with day-by-day planning, collaborative editing, hotel/campsite bookings, driving directions. 5M+ users. |
| Komoot | Partial | Free | "Collections" and "Tours" can be grouped but no multi-day itinerary structure. |
| Gaia GPS | No | N/A | No trip planning. Users export waypoints to paper or external apps. |

### Target User
Weekend backpackers (28-45) planning 2-5 day trips who currently use Google Docs or spreadsheets to organize their itinerary. National park visitors planning a week-long trip with multiple day hikes. Families organizing outdoor vacations who need a central place for trail plans, campsite info, and daily schedules. Users who want their trip plan and trail recordings in the same app.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New Trip, TripDay, TripActivity schemas
  db/schema.ts                  -- New tr_trips, tr_trip_days, tr_trip_activities tables (migration V7)
  db/crud.ts                    -- CRUD for trips, days, and activities
  definition.ts                 -- Add V7 migration, bump schemaVersion
  index.ts                      -- Export new trip functions and types

apps/mobile/app/(trails)/
  trips.tsx                     -- NEW: trip list and creation
  trip-detail.tsx               -- NEW: day-by-day itinerary view
  trip-day.tsx                  -- NEW: activities for a single day

apps/web/app/trails/
  page.tsx                      -- Updated: trips section with itinerary builder
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Trails tab (existing)
       └── Recordings tab (existing)
       └── Trips tab ← NEW: trip list and planner
            └── Trip Detail
                 └── Day 1 ← activities for this day
                      └── Activity: "Hike Yosemite Falls" (linked to saved trail)
                      └── Activity: "Drive to campsite" (free text)
                 └── Day 2
                      └── Activity: "Half Dome hike"
```

Note: Adding a 5th tab exceeds the 4-tab mobile limit from the module definition. Instead, Trips will be accessible from the Trails tab as a section, and as a screen in the navigation stack. The tab bar remains unchanged.

### Data Model

```sql
-- Migration V7: Trip itinerary
CREATE TABLE IF NOT EXISTS tr_trips (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT,                        -- ISO date, null if unscheduled
  end_date TEXT,
  notes TEXT,
  packing_template_id TEXT REFERENCES tr_packing_templates(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tr_trip_days (
  id TEXT PRIMARY KEY NOT NULL,
  trip_id TEXT NOT NULL REFERENCES tr_trips(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,            -- 1-indexed day within the trip
  date TEXT,                              -- ISO date, derived from trip start_date + day_number
  title TEXT,                             -- optional day title ("Summit Day")
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tr_trip_activities (
  id TEXT PRIMARY KEY NOT NULL,
  day_id TEXT NOT NULL REFERENCES tr_trip_days(id) ON DELETE CASCADE,
  trail_id TEXT REFERENCES tr_trails(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'hike' CHECK(type IN ('hike', 'drive', 'camp', 'rest', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_trips_dates ON tr_trips(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tr_trip_days_trip ON tr_trip_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_tr_trip_activities_day ON tr_trip_activities(day_id);
CREATE INDEX IF NOT EXISTS idx_tr_trip_activities_trail ON tr_trip_activities(trail_id);
```

### Dependencies
- **Internal:** `@mylife/trails` (trails for linking, packing templates for trip packing lists), `@mylife/db` (DatabaseAdapter)
- **External:** None. All data is local.
- **Cross-Module:** RSVP module has event/calendar concepts. A future cross-module integration could sync trip dates to the device calendar. Score: 2 (mild future benefit).

## Functional Requirements

### User Stories
1. As a backpacker, I want to create a multi-day trip itinerary so that I can plan which trails to hike on which days.
2. As a trip planner, I want to link saved trails to specific days so that I can see the full route plan.
3. As a user preparing for a trip, I want to attach a packing list to my trip so that all planning is in one place.
4. As a user reviewing a completed trip, I want to see my actual recordings alongside the planned itinerary so that I can compare plans vs reality.
5. As a user with a simple weekend trip, I want to quickly create a 2-day itinerary without a complex workflow.

### Behavior Specification

**Creating a trip:**
1. User navigates to Trails tab > Trips section (or "Plan a Trip" from trail detail)
2. User taps "New Trip"
3. User enters: trip name, start date (optional), number of days
4. System creates the trip with empty day slots
5. User can add a packing list (select from existing templates or create new)

**Planning a day:**
1. User opens a trip and selects a day
2. User adds activities: "Add Hike" (links to a saved trail), "Add Drive," "Add Camp," "Add Rest," or "Add Note"
3. Activities are reorderable via drag-and-drop
4. "Add Hike" shows a picker of saved trails with name, difficulty, distance
5. Each activity can have optional notes (e.g., "Leave by 7am to beat crowds")

**Trip overview:**
1. Trip detail shows all days in a vertical timeline
2. Each day card shows: date (if scheduled), title, activity summary (number and types)
3. Total trip stats: total hiking distance, total elevation, total days
4. Packing list link (if attached)

**Linking to recordings:**
1. After completing a recording on a trail that's part of a trip, the recording is associated with the trip activity
2. Trip day view shows "Planned: 8km, Actual: 8.3km" comparison for linked trails
3. This linking is automatic when the recording's `trail_id` matches a trip activity's `trail_id`

### Edge Cases

- **Trip with no dates:** Allow undated trips for brainstorming. Days are numbered (Day 1, Day 2) instead of dated.
- **Single-day trip:** Valid. A "trip" with 1 day is just a planned day hike.
- **Adding days to an existing trip:** User can add or remove days. Adding a day appends to the end. Removing a day cascades to delete its activities.
- **Reordering days:** Not supported in V1 (days are numbered sequentially). Future enhancement.
- **Linked trail deleted:** If a saved trail linked to an activity is deleted, the activity remains with `trail_id = NULL` and the name still shows (from the activity's `name` field).
- **Large trip (30+ days):** No practical limit, but performance should be tested. Thru-hikers plan 30+ day trips on the Pacific Crest Trail.
- **Multiple trips active simultaneously:** Supported. No limit on concurrent trips.
- **Module disabled mid-trip:** Trip data persists in SQLite. Re-enabling restores all trip data.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can create a named trip with a specified number of days
- [ ] **AC-2:** User can set optional start and end dates for a trip
- [ ] **AC-3:** Each day shows a list of activities that can be added, removed, and reordered
- [ ] **AC-4:** User can link a saved trail to a day's activity via picker
- [ ] **AC-5:** Trip overview shows total distance, elevation, and day count
- [ ] **AC-6:** User can attach a packing list to a trip
- [ ] **AC-7:** Activities support multiple types: hike, drive, camp, rest, other
- [ ] **AC-8:** After recording a trail that's part of a trip, planned vs actual comparison is shown
- [ ] **AC-9:** User can add notes to both trips and individual activities

### Technical Criteria
- [ ] **TC-1:** `tr_trips`, `tr_trip_days`, and `tr_trip_activities` tables are created by migration V7
- [ ] **TC-2:** Cascade delete: deleting a trip removes all days and activities
- [ ] **TC-3:** Linked trail deletion sets `trail_id` to NULL but preserves the activity
- [ ] **TC-4:** Trip stats (total distance, elevation) computed correctly from linked trails

### Negative Criteria
- [ ] **NC-1:** Trip planning must NOT require network access
- [ ] **NC-2:** Deleting a trip must NOT affect saved trails, recordings, or packing templates
- [ ] **NC-3:** Trip data must NOT be synced or uploaded to any server

## UI Specification

### Mobile (Expo)

**Trip List:**
- Background: `#0A0A0F`
- Glass cards for each trip: name, dates (or "Unscheduled"), day count, total distance summary
- "New Trip" button: lime `#65A30D` accent

**Trip Detail:**
- Vertical timeline layout
- Each day is a glass card with: day number/date, title, activity list
- Activity types indicated by icons: boot (hike), car (drive), tent (camp), bed (rest), note (other)
- Linked trails show distance and difficulty badges
- Packing list link at the bottom
- "Add Day" button at the end of the timeline

**Trip Day:**
- Activity list with drag handles for reordering
- "Add Activity" floating action button
- Activity type picker: segmented control with icons
- Trail picker: searchable list of saved trails

### Web (Next.js)

- Trips section in trails page
- Itinerary as a column layout with drag-and-drop
- Activity details in a side panel

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty | "Plan your next adventure" + "New Trip" CTA | No trips exist |
| Loading | Skeleton trip cards | Initial trip fetch |
| Planning | Trip timeline with day cards and activities | Trip opened |
| Active | Trip with today's day highlighted | Trip dates include today |
| Complete | Trip with actual vs planned comparisons | Trip end date has passed |

## Test Requirements

### Unit Tests
- [ ] `createTrip`: creates trip with days
- [ ] `getTrip`: returns trip with days and activities
- [ ] `addTripDay`: adds a new day with correct day_number
- [ ] `removeTripDay`: removes day and cascades to activities
- [ ] `addActivity`: creates activity with correct type and sort order
- [ ] `linkTrailToActivity`: sets trail_id on activity
- [ ] `getTripStats`: calculates total distance and elevation from linked trails
- [ ] `reorderActivities`: updates sort_order correctly
- [ ] Trip with no dates: day dates are null
- [ ] Trip with start_date: day dates are calculated correctly

### Integration Tests
- [ ] Full flow: create trip -> add days -> add activities -> link trails -> verify stats
- [ ] Delete flow: delete trip -> verify all days and activities removed
- [ ] Recording link: record trail linked to trip -> verify planned vs actual shown
- [ ] Packing link: attach packing list -> verify accessible from trip detail

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Trails > Trips section
3. Tap "New Trip"
4. Enter name "Yosemite Weekend," set start date, 3 days
5. Verify: trip created with 3 empty day slots -- corresponds to AC-1, AC-2
6. Open Day 1, tap "Add Activity," select "Hike"
7. Pick "Yosemite Falls Trail" from saved trails
8. Verify: activity appears with trail name, distance, difficulty -- corresponds to AC-3, AC-4
9. Add a "Drive" activity and a "Camp" activity
10. Verify: all types shown with correct icons -- corresponds to AC-7
11. Add notes to the trip and to an activity
12. Verify: notes saved and visible -- corresponds to AC-9
13. Go back to trip overview
14. Verify: total distance and elevation shown -- corresponds to AC-5
15. Attach a packing list
16. Verify: packing list link visible on trip detail -- corresponds to AC-6
17. Record the linked trail
18. Open the trip day
19. Verify: planned vs actual distance comparison shown -- corresponds to AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to trip list, trip detail, trip day, verify all states

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Trails module has individual trail recording, offline maps, navigation
- Packing templates exist (V6) but are standalone, not attached to trips
- No multi-day trip planning

### After This Work
- New V7 migration adds `tr_trips`, `tr_trip_days`, and `tr_trip_activities` tables
- Trip list and detail screens on mobile
- Day-by-day itinerary with linked trails and activity types
- Packing list attachment to trips
- Planned vs actual comparison after completing recordings

### Files Changed
- `modules/trails/src/types.ts` -- New `Trip`, `TripDay`, `TripActivity` schemas
- `modules/trails/src/db/schema.ts` -- V7 migration SQL
- `modules/trails/src/db/crud.ts` -- CRUD for trips, days, activities
- `modules/trails/src/definition.ts` -- Add V7 migration
- `modules/trails/src/index.ts` -- Export trip functions
- `apps/mobile/app/(trails)/trips.tsx` -- Trip list
- `apps/mobile/app/(trails)/trip-detail.tsx` -- Day-by-day itinerary
- `apps/mobile/app/(trails)/trip-day.tsx` -- Activity management
- `apps/web/app/trails/page.tsx` -- Trips section

### Known Limitations
- **No collaborative editing:** V1 trips are single-user. Sharing a trip plan with hiking partners is a future enhancement.
- **No booking integration:** Wanderlog integrates campsite/hotel bookings. V1 has free-text notes for logistics instead.
- **No calendar sync:** Trip dates are not synced to device calendar. Future cross-module integration with RSVP could add this.
- **No map view of full trip:** Individual trails show on the map, but no consolidated multi-trail map view for the full trip.

### Context for Next Agent
- The trip structure is hierarchical: Trip -> Days -> Activities. Use cascade deletes throughout.
- Day numbering is 1-indexed and sequential. If `start_date` is set, `date` for each day is calculated as `start_date + (day_number - 1)`.
- The "planned vs actual" comparison is simple: find recordings where `trail_id` matches an activity's `trail_id` and `started_at` falls within the trip date range. Compare `distance_meters` and `duration_seconds`.
- Activities use `sort_order` for drag-and-drop reordering. When reordering, update sort_order values for all activities in the affected day.
