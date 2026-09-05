# Feature Spec: Route Planning/Builder

## Metadata
- **Module:** trails
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [1] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 7
- **Estimated CC Time:** 3-4 hours (Complexity Inverse = 1, "Complex")
- **Depends On:** Offline map downloads (V2, for map display), trail database integration (V8, for snapping to known trails)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Komoot's route planner is their flagship feature: users tap waypoints on a map and the system generates a routable path along trails, roads, and paths. Gaia GPS lets users draw routes on topo maps for backcountry navigation. Currently MyTrails only supports recording routes (walking them with GPS) or importing GPX files. There's no way to plan a route before leaving home. Route planning lets users design custom routes by placing waypoints on the map and connecting them along known trails, then navigate those planned routes in the field. This is the feature that turns MyTrails from a "recorder" into a "planner," competing directly with Komoot's core value proposition.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Komoot | Yes | Partial ($29.99 one-time for offline) | Tap-to-route planner that snaps to trails/roads. Sport-specific routing (hiking avoids roads, cycling avoids stairs). Elevation profile preview. 35M+ users. The core product. |
| Gaia GPS | Yes | Yes ($39.99/yr) | Draw-on-map route builder. No trail snapping (freeform lines on topo). Backcountry focus. Export to GPX. |
| AllTrails | Partial | Yes ($26.99-53.99/yr) | "Create a Map" feature lets users draw routes on their trail database. Limited to known trails. |
| Strava | Yes | Yes ($79.99/yr) | Route builder with popularity heatmap overlay. Optimized for road cycling. Trail support is limited. |

### Target User
Trip planners (25-50) who design routes at home before driving to the trailhead. Backpackers planning multi-day routes through wilderness areas. Komoot free-tier users ($30 one-time for offline, recurring for extended features) who want route planning without the cost. Cyclists and trail runners who want to design loop routes of a specific distance. Users who import GPX from external route planners and want to do it all in one app.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New PlannedRoute, RouteWaypoint, RouteSummary schemas
  db/schema.ts                  -- New tr_planned_routes, tr_route_waypoints tables (migration V9)
  db/crud.ts                    -- CRUD for planned routes and waypoints
  engine/
    route-builder.ts            -- NEW: connect waypoints into routable paths
    elevation-profiler.ts       -- NEW: generate elevation profile from route geometry
  definition.ts                 -- Add V9 migration, bump schemaVersion
  index.ts                      -- Export new route planning functions and types

apps/mobile/app/(trails)/
  route-builder.tsx             -- NEW: interactive map-based route builder
  route-preview.tsx             -- NEW: route summary with elevation profile

apps/web/app/trails/
  page.tsx                      -- Updated: route builder section
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Map tab
            └── "Plan Route" button ← enters route builder mode
                 └── Route Builder ← tap waypoints on map, see connected route
                      └── Route Preview ← summary, elevation profile, save/navigate
```

### Data Model

```sql
-- Migration V9: Route planning
CREATE TABLE IF NOT EXISTS tr_planned_routes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  distance_meters REAL NOT NULL DEFAULT 0,
  elevation_gain_meters REAL NOT NULL DEFAULT 0,
  estimated_minutes INTEGER,
  is_loop INTEGER NOT NULL DEFAULT 0,     -- 1 if route ends near start
  route_geometry TEXT,                    -- GeoJSON LineString of the full route
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tr_route_waypoints (
  id TEXT PRIMARY KEY NOT NULL,
  route_id TEXT NOT NULL REFERENCES tr_planned_routes(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  label TEXT,                             -- optional waypoint label ("Lunch spot")
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_route_waypoints_route ON tr_route_waypoints(route_id);
```

### Dependencies
- **Internal:** `@mylife/trails` (geo engine, offline map tiles for display, trail database for snapping), `@mylife/db` (DatabaseAdapter)
- **External:**
  - OSRM (Open Source Routing Machine) or Valhalla API for path routing between waypoints. Both are free and self-hostable. For V1, use the public OSRM demo server (`router.project-osrm.org`) with a fallback to straight-line connections when offline.
  - Offline: straight-line connections between waypoints (no trail snapping). Full offline routing requires a local routing engine (future enhancement).
- **Cross-Module:** Workouts module's route recording shares concepts with route planning. Future: use planned routes as workout targets. Score: 2 (mild).

## Functional Requirements

### User Stories
1. As a trip planner, I want to place waypoints on the map and see a route connecting them along trails so that I can design my hike before leaving home.
2. As a hiker designing a loop, I want the route builder to show total distance and elevation so that I can size the route to my fitness level.
3. As a backpacker, I want to save my planned route and navigate it in the field so that I follow my exact plan.
4. As a user planning offline, I want to place waypoints and see straight-line connections even without network, then refine the route when back online.
5. As a runner, I want to create a route of a specific target distance so that I can plan my training run.

### Behavior Specification

**Building a route:**
1. User taps "Plan Route" on the Map tab
2. Map enters route builder mode: crosshair cursor, tap-to-place waypoints
3. User taps locations on the map to place waypoints (numbered markers)
4. Between each pair of consecutive waypoints, the system draws a path:
   - **Online:** Route via OSRM (follows trails/paths), displayed as a colored polyline
   - **Offline:** Straight line between waypoints (can be refined later)
5. Route summary updates in real-time: total distance, estimated elevation gain, estimated time
6. User can drag existing waypoints to reposition, or long-press to delete

**Route preview:**
1. After placing waypoints, user taps "Preview Route"
2. Full-screen route view with:
   - Route drawn on map
   - Elevation profile graph below map
   - Summary: distance, elevation gain/loss, estimated time, loop detection
3. User can name the route and tap "Save"

**Using a planned route:**
1. Saved routes appear in the Trails tab alongside recorded trails
2. User can tap "Navigate" on a planned route to start a guided recording (uses turn-by-turn if available, or wrong-turn alerts at minimum)
3. After completing the route, the recording is linked to the planned route for comparison

**Editing a saved route:**
1. User opens a saved route and taps "Edit"
2. Route builder mode with existing waypoints loaded
3. Add, remove, or move waypoints
4. Save updates the route

### Edge Cases

- **Single waypoint:** Not a valid route. Show "Add at least 2 waypoints to create a route."
- **Very long route (>100km):** Allow it but show a warning about estimated time and difficulty.
- **OSRM server unavailable:** Fall back to straight-line connections with a note "Route follows straight lines. Connect to the internet for trail-following routes."
- **OSRM returns no path:** Some waypoint pairs may not have a routable trail between them (e.g., separated by a canyon). Show the straight-line fallback for that segment with a warning "No trail found between these points."
- **Loop detection:** If the last waypoint is within 500m of the first, offer to "Close the loop" (snap the end to the start).
- **Offline editing:** Waypoints can be placed offline. Route geometry shows straight lines. When the user regains connectivity, offer "Refine route" to re-route via OSRM.
- **Route with no elevation data:** If the routing engine doesn't return elevation, estimate from the map tile data or show "Elevation unknown."
- **Deleting a planned route that has linked recordings:** Route is deleted, recordings are preserved but lose the route link (`route_id` set to NULL).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can place numbered waypoints on the map by tapping
- [ ] **AC-2:** Paths are drawn between consecutive waypoints following trails (when online)
- [ ] **AC-3:** Route summary shows total distance, elevation gain, and estimated time in real-time
- [ ] **AC-4:** User can drag waypoints to reposition them
- [ ] **AC-5:** User can delete a waypoint by long-pressing
- [ ] **AC-6:** Route preview shows elevation profile graph
- [ ] **AC-7:** User can save a named route and find it in the Trails tab
- [ ] **AC-8:** User can navigate a planned route (guided recording)
- [ ] **AC-9:** Loop detection offers to close the route when end is near start
- [ ] **AC-10:** Offline mode shows straight-line connections with a refinement prompt

### Technical Criteria
- [ ] **TC-1:** `tr_planned_routes` and `tr_route_waypoints` tables are created by migration V9
- [ ] **TC-2:** OSRM routing returns a valid GeoJSON LineString between waypoint pairs
- [ ] **TC-3:** Route distance calculation is accurate to within 5% of OSRM-routed distance
- [ ] **TC-4:** Elevation profile correctly extracted from route geometry
- [ ] **TC-5:** Waypoint reordering updates sort_order and recalculates route

### Negative Criteria
- [ ] **NC-1:** Route planning must NOT upload waypoint data to any server beyond the OSRM routing query
- [ ] **NC-2:** OSRM routing failures must NOT prevent saving the route (save with straight-line geometry)
- [ ] **NC-3:** Route builder must NOT block the UI during OSRM requests (async with loading indicator)
- [ ] **NC-4:** Deleting a route must NOT affect linked recordings

## UI Specification

### Mobile (Expo)

**Route Builder Mode:**
- Map fills the screen with a "Done" button in the nav bar
- Tap-to-place waypoints as numbered lime `#65A30D` circles
- Route drawn as a lime polyline (3px, 80% opacity)
- Route summary card at bottom: distance + elevation + time (glass background)
- Waypoint context menu on long-press: "Delete" option
- Draggable waypoints with haptic feedback

**Route Preview:**
- Route on map (full view)
- Elevation profile: glass card with an area chart showing elevation along the route
- Summary: distance, elevation gain/loss, estimated time, "Loop" badge if applicable
- "Save" button: lime accent, "Navigate" button: secondary

**Saved Routes in Trails tab:**
- Mixed with recorded trails, marked with a "Planned" badge
- Route cards show: name, distance, elevation, waypoint count, "Planned" indicator

### Web (Next.js)

- Route builder as a full-width map with a waypoint panel on the side
- Elevation profile below the map
- Waypoint list with drag-and-drop reordering in the side panel

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty | Map with "Tap to place waypoints" instruction | Route builder just opened |
| Building | Numbered waypoints with route lines, live summary | User placing waypoints |
| Routing | Brief loading spinner on route line | OSRM routing in progress |
| Offline | Straight-line connections + "Refine when online" note | No network |
| Preview | Full route with elevation profile and summary | User tapped "Preview" |
| Saved | Route in trails list with "Planned" badge | Route saved |

## Test Requirements

### Unit Tests
- [ ] `buildRouteFromWaypoints(waypoints)`: returns correct GeoJSON for 3+ waypoints
- [ ] `calculateRouteDistance(geometry)`: sums segment distances correctly
- [ ] `calculateRouteElevation(geometry)`: computes gain and loss
- [ ] `isLoop(firstWaypoint, lastWaypoint, threshold)`: detects loops within 500m
- [ ] `estimateRouteTime(distance, elevation)`: returns reasonable estimate
- [ ] `straightLineRoute(waypoints)`: generates correct geometry without routing
- [ ] `reorderWaypoints(waypoints, fromIndex, toIndex)`: updates sort_order correctly
- [ ] `generateElevationProfile(geometry)`: returns array of distance/elevation pairs
- [ ] `createPlannedRoute`: persists route with waypoints and geometry
- [ ] `getPlannedRoute`: returns route with all waypoints
- [ ] `updatePlannedRoute`: updates geometry and stats after waypoint changes
- [ ] `deletePlannedRoute`: removes route and cascades to waypoints

### Integration Tests
- [ ] Full flow: place 3 waypoints -> route generated -> preview -> save -> find in trails list
- [ ] Navigate flow: save route -> start navigation -> verify guided recording uses route
- [ ] Offline flow: place waypoints offline -> straight lines shown -> go online -> refine route
- [ ] Edit flow: open saved route -> move waypoint -> verify route recalculated and saved

### QA Verification Script
1. Open the app on iOS simulator (with network)
2. Navigate to Map tab, tap "Plan Route"
3. Tap 3 locations on the map
4. Verify: numbered waypoints appear with route lines between them -- corresponds to AC-1, AC-2
5. Check the summary card at bottom
6. Verify: distance, elevation, and time update in real-time -- corresponds to AC-3
7. Drag a waypoint to a new position
8. Verify: route updates -- corresponds to AC-4
9. Long-press a waypoint, tap "Delete"
10. Verify: waypoint removed, route recalculated -- corresponds to AC-5
11. Tap "Preview Route"
12. Verify: elevation profile graph shown -- corresponds to AC-6
13. Name the route "Test Loop," save it
14. Navigate to the Trails tab
15. Verify: "Test Loop" appears with "Planned" badge -- corresponds to AC-7
16. Open the route, tap "Navigate"
17. Verify: guided recording starts with the planned route as reference -- corresponds to AC-8
18. Create a new route where the last waypoint is within 500m of the first
19. Verify: "Close the loop?" prompt appears -- corresponds to AC-9
20. Enable airplane mode, create a new route
21. Verify: straight-line connections shown with refinement prompt -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to route builder, verify all states

### Required: Complexity <= 2 (this feature is Complexity 1 = Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Validate OSRM integration and offline fallback strategy.

### Required: Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate routing engine choice, offline strategy, and elevation data source

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for route-builder and elevation-profiler

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Users can only record routes (GPS) or import GPX
- No way to plan a route on-map before hiking
- Offline maps exist but only for viewing, not route creation

### After This Work
- New V9 migration adds `tr_planned_routes` and `tr_route_waypoints` tables
- Interactive route builder with tap-to-place waypoints
- OSRM routing for trail-following paths (online)
- Straight-line fallback for offline planning
- Elevation profile preview
- Saved routes navigable with guided recording

### Files Changed
- `modules/trails/src/types.ts` -- New `PlannedRoute`, `RouteWaypoint`, `RouteSummary` schemas
- `modules/trails/src/db/schema.ts` -- V9 migration SQL
- `modules/trails/src/db/crud.ts` -- CRUD for planned routes and waypoints
- `modules/trails/src/engine/route-builder.ts` -- Waypoint connection, geometry building
- `modules/trails/src/engine/elevation-profiler.ts` -- Elevation profile from geometry
- `modules/trails/src/definition.ts` -- Add V9 migration
- `modules/trails/src/index.ts` -- Export route planning functions
- `apps/mobile/app/(trails)/route-builder.tsx` -- Interactive map builder
- `apps/mobile/app/(trails)/route-preview.tsx` -- Route summary + elevation profile
- `apps/web/app/trails/page.tsx` -- Route builder section

### Known Limitations
- **OSRM demo server for V1:** The public OSRM demo server is suitable for development and light personal use but not production scale. Self-hosting OSRM with regional OSM extracts is the production path.
- **No trail-specific routing:** OSRM routes along any routable path (including roads). Trail-specific routing that avoids roads requires custom OSRM profiles or a dedicated trail routing engine.
- **Offline routing is straight-line only:** True offline routing requires a local OSRM instance with pre-downloaded graph data. This is architecturally complex and deferred.
- **No real-time route alternatives:** V1 generates one route per waypoint pair. Showing alternative routes is a future enhancement.

### Context for Next Agent
- OSRM HTTP API: `GET http://router.project-osrm.org/route/v1/foot/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson`. Returns a GeoJSON LineString. Use `foot` profile for hiking, `bicycle` for cycling.
- The elevation profile can be derived from the route geometry if elevation data is available (OSRM v5.27+ includes elevation with `--generate-elevation` flag). For the public demo server, elevation is not included; fall back to querying Open-Meteo's elevation API or omitting elevation.
- Route geometry is stored as a GeoJSON LineString string. This allows direct rendering on the map without parsing. When used for navigation, convert to the same waypoint format used by the deviation detector.
- The route builder should feel responsive: route each segment as soon as the user places the next waypoint (don't wait for all waypoints). Use AbortController to cancel pending OSRM requests when waypoints change.
