# Feature Spec: Trail Database Integration

## Metadata
- **Module:** trails
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [4] x3 + Complexity [0] x2 + CrossModule [1] x1 + PaidUser [3] x1
- **Sprint:** 7
- **Estimated CC Time:** 4-5 hours (Complexity Inverse = 0, "Massive")
- **Depends On:** Offline map downloads (V2, for displaying trail routes on map)
- **Blocks:** none

## Business Context

### Why This Feature Exists
AllTrails' biggest competitive moat is their database of 400,000+ trails with user-submitted GPS tracks, photos, reviews, and difficulty ratings. When a new user opens AllTrails, they immediately see popular trails near them with ratings, photos, and distance info. Without a trail database, MyTrails requires users to create every trail from scratch or import GPX files, which is a massive cold-start problem. By integrating with an open-source trail database (OpenStreetMap trail data via Overpass API), MyTrails can offer pre-populated trail listings for any region, giving users immediate value before they record their first hike. This is the single biggest feature gap between MyTrails and AllTrails for new users.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AllTrails | Yes | Partial | 400K+ trails with user-submitted data, ratings, photos. Free to browse; offline maps/filters are premium. This IS AllTrails' core product. |
| Komoot | Yes | Free | Trail/route suggestions based on sport type and fitness level. Uses OSM data + user contributions. 35M+ users. |
| Gaia GPS | Partial | Yes ($39.99/yr) | Overlays public trail data from USFS, BLM, NPS on the map. No trail detail pages or community data. |
| Strava | Partial | Free | "Routes" feature suggests routes from aggregate user data. Not a trail database per se, more route recommendation. |

### Target User
New MyTrails users who need immediate value without recording their own trails first. Hikers exploring a new area (vacation, road trip) who want to see what trails exist nearby. Users comparing MyTrails to AllTrails during the trial period; if they can't find trails near them, they leave. Day hikers (25-55) who rely on curated trail listings to decide where to hike this weekend.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New TrailDatabaseEntry, TrailSearchResult schemas
  db/schema.ts                  -- New tr_trail_database table (migration V8)
  db/crud.ts                    -- CRUD for trail database entries
  database/                     -- NEW directory
    osm-client.ts               -- Overpass API client for fetching trail data from OpenStreetMap
    trail-importer.ts           -- Parse OSM trail data into tr_trail_database entries
    trail-search.ts             -- FTS5 search over local trail database
  definition.ts                 -- Add V8 migration, bump schemaVersion
  index.ts                      -- Export new database functions and types

apps/mobile/app/(trails)/
  discover.tsx                  -- NEW: nearby trail discovery screen
  map.tsx                       -- Updated: show database trails on the map as markers

apps/web/app/trails/
  page.tsx                      -- Updated: trail discovery section with search
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Trails tab
            └── Discover section ← nearby trails from database
                 └── Trail Database Entry Detail ← save to "My Trails"
       └── Map tab
            └── Database trail markers ← tap to see trail info
```

### Data Model

```sql
-- Migration V8: Trail database (imported from OpenStreetMap)
CREATE TABLE IF NOT EXISTS tr_trail_database (
  id TEXT PRIMARY KEY NOT NULL,
  osm_id TEXT UNIQUE,                     -- OpenStreetMap relation/way ID
  name TEXT NOT NULL,
  description TEXT,
  difficulty TEXT CHECK(difficulty IN ('easy', 'moderate', 'hard', 'expert')),
  distance_meters REAL,
  elevation_gain_meters REAL,
  lat REAL NOT NULL,                      -- trailhead latitude
  lng REAL NOT NULL,                      -- trailhead longitude
  region TEXT,
  trail_type TEXT DEFAULT 'hiking' CHECK(trail_type IN ('hiking', 'cycling', 'running', 'multi_use')),
  surface TEXT,                           -- "paved", "gravel", "dirt", "rock"
  route_geometry TEXT,                    -- GeoJSON LineString for route display
  source TEXT NOT NULL DEFAULT 'osm',     -- data source: 'osm', 'usfs', 'nps'
  fetched_at TEXT NOT NULL,               -- when this data was last synced
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS tr_trail_database_fts USING fts5(
  name, description, region,
  content='tr_trail_database',
  content_rowid='rowid'
);

CREATE INDEX IF NOT EXISTS idx_tr_trail_database_location ON tr_trail_database(lat, lng);
CREATE INDEX IF NOT EXISTS idx_tr_trail_database_region ON tr_trail_database(region);
CREATE INDEX IF NOT EXISTS idx_tr_trail_database_difficulty ON tr_trail_database(difficulty);
CREATE INDEX IF NOT EXISTS idx_tr_trail_database_osm ON tr_trail_database(osm_id);
```

### Dependencies
- **Internal:** `@mylife/trails` (trails for "save to my trails" flow), `@mylife/db` (DatabaseAdapter, FTS5)
- **External:**
  - Overpass API (free, no API key, rate-limited): queries OpenStreetMap for trail relations tagged as `route=hiking`, `route=mtb`, `route=running`
  - No paid APIs. OSM data is CC-BY-SA licensed (attribution required).
- **Cross-Module:** None (score: 1).

## Functional Requirements

### User Stories
1. As a new user, I want to see trails near my location without recording anything first so that I get immediate value from the app.
2. As a user exploring a new area, I want to search for trails by name or region so that I can find specific trails for my trip.
3. As a user browsing the database, I want to filter trails by difficulty, distance, and type so that I can find trails matching my fitness and preferences.
4. As a user who found a trail in the database, I want to save it to "My Trails" so that I can plan, navigate, and record it.
5. As a privacy-conscious user, I want to control when trail data is fetched (not automatic background sync) so that my location queries are intentional.

### Behavior Specification

**Discovering nearby trails:**
1. User navigates to Trails tab > Discover section
2. System prompts for location permission if not already granted
3. System queries the local trail database for trails within a 50km radius of the user's location
4. If no local data: offer to "Download trails for this area" which fetches from Overpass API
5. Results shown as a scrollable list of trail cards sorted by distance

**Searching trails:**
1. User taps the search bar on the Discover screen
2. User types a trail name or region (e.g., "Yosemite Falls" or "Marin County")
3. System searches the local FTS5 index for matches
4. Results shown instantly from local database
5. If no results: offer to "Search online" which queries Overpass for the region

**Fetching trail data:**
1. User taps "Download trails for [region]"
2. System sends an Overpass API query for hiking/running/cycling routes within the bounding box
3. Overpass returns OSM relations with name, geometry, tags
4. System parses results into `tr_trail_database` entries with difficulty inferred from tags and elevation
5. Progress indicator shows during download
6. Results cached locally; subsequent visits use the local database

**Saving a database trail to "My Trails":**
1. User opens a trail database entry detail screen
2. User taps "Save to My Trails"
3. System creates a `tr_trails` entry from the database entry (copies name, difficulty, distance, lat/lng, region)
4. If the database entry has route geometry, it's stored as waypoints in a synthetic recording
5. The trail now appears in the user's personal trail list and can be navigated, recorded, etc.

**Filtering:**
1. Difficulty filter: Easy / Moderate / Hard / Expert (multi-select)
2. Distance filter: <5km / 5-10km / 10-20km / >20km
3. Type filter: Hiking / Cycling / Running / Multi-use
4. Filters apply to both the list view and the map markers

### Edge Cases

- **No location permission:** Discover screen shows "Enable location to find nearby trails" with a button to open settings. Search still works without location.
- **No internet for initial fetch:** "Download trails" requires network. Show "Connect to the internet to download trail data for this area."
- **Overpass rate limiting:** Overpass API can be slow or rate-limited during peak hours. Timeout after 30 seconds, show "Trail servers are busy. Try again later."
- **Duplicate trails:** OSM may have duplicate entries for the same physical trail (different relations). Deduplicate by osm_id. If same name + similar lat/lng but different osm_id, keep both (they may be different routes on the same trail).
- **Stale data:** OSM data changes (trail reroutes, new trails). Add a "Refresh" button that re-fetches for the current region. Compare `fetched_at` and show "Last updated X days ago."
- **Very dense area (urban trails):** A query for downtown San Francisco might return 500+ results. Paginate results (50 per page) and limit map markers to the closest 100.
- **No trails in area:** Rural areas may have few or no OSM-tagged trails. Show "No trails found in this area. You can record your own!"
- **Module disabled:** Trail database data persists. Re-enabling restores the full database.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can view nearby trails from the database without recording any trails first
- [ ] **AC-2:** User can search trails by name or region with instant results from local database
- [ ] **AC-3:** User can filter trails by difficulty, distance range, and trail type
- [ ] **AC-4:** User can download trail data for a region from OpenStreetMap
- [ ] **AC-5:** Download progress indicator shown during data fetch
- [ ] **AC-6:** User can save a database trail to "My Trails" for navigation and recording
- [ ] **AC-7:** Map tab shows database trail markers that can be tapped for details
- [ ] **AC-8:** User can refresh trail data for a region to get updated OSM data
- [ ] **AC-9:** Trail count for current view shown (e.g., "142 trails nearby")

### Technical Criteria
- [ ] **TC-1:** `tr_trail_database` and FTS5 table are created by migration V8
- [ ] **TC-2:** Overpass API query returns valid trail data for California test region
- [ ] **TC-3:** FTS5 search returns results in <50ms for a database of 10,000 trails
- [ ] **TC-4:** Trail importer correctly parses OSM tags into difficulty, distance, and trail type
- [ ] **TC-5:** Duplicate OSM entries (same `osm_id`) are upserted, not duplicated
- [ ] **TC-6:** Route geometry stored as valid GeoJSON LineString

### Negative Criteria
- [ ] **NC-1:** Trail database fetch must NOT happen automatically in the background (user-initiated only)
- [ ] **NC-2:** User's location query to Overpass must NOT include any identifying information beyond the bounding box
- [ ] **NC-3:** Trail database must NOT be required for core functionality (recording, navigation work without it)
- [ ] **NC-4:** Overpass API failures must NOT crash the app or prevent using other features

## UI Specification

### Mobile (Expo)

**Discover Screen:**
- Background: `#0A0A0F`
- Search bar at top
- Filter chips below search: difficulty, distance, type
- Trail count: "142 trails nearby" in `caption` text
- Scrollable list of trail cards (glass background):
  - Trail name, difficulty badge, distance, elevation
  - Region/area name
  - "Save" bookmark icon button
- "Download trails for this area" banner if no local data

**Trail Database Entry Detail:**
- Similar to trail detail but with "Save to My Trails" primary CTA
- Route geometry displayed on a mini-map
- Source attribution: "Data from OpenStreetMap" in footer
- OSM tags shown: surface type, trail type

**Map Trail Markers:**
- Small lime dots on the map for database trails
- Tap to show callout card with trail name and "Details" button
- Cluster markers when zoomed out (shows count)

### Web (Next.js)

- Discover section in trails page with search, filters, and sortable table
- Map panel showing trail markers
- Trail detail in side panel with "Save to My Trails" button

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Data | "Download trails for this area" banner | No local trail data for region |
| Loading | Skeleton cards + progress indicator | Trail data being fetched from Overpass |
| Empty Results | "No trails found" + record-your-own CTA | Search/filter returns no matches |
| Success | Trail list with cards and map markers | Local database has results |
| Error | "Trail servers busy. Try again later." | Overpass API timeout or error |
| Searching | Instant results as user types | User typing in search bar |

## Test Requirements

### Unit Tests
- [ ] `parseOsmTrail(osmRelation)`: extracts name, geometry, tags correctly
- [ ] `parseOsmTrail`: infers difficulty from `sac_scale` tag
- [ ] `parseOsmTrail`: handles missing optional fields gracefully
- [ ] `calculateDistanceFromGeometry(geojson)`: computes route length from LineString
- [ ] `buildOverpassQuery(bbox)`: returns valid Overpass QL query string
- [ ] `searchTrails(query)`: returns FTS5 matches ranked by relevance
- [ ] `searchTrails`: handles special characters in query
- [ ] `filterTrails(options)`: filters by difficulty correctly
- [ ] `filterTrails(options)`: filters by distance range correctly
- [ ] `saveToMyTrails(databaseEntry)`: creates tr_trails entry with correct fields
- [ ] `upsertDatabaseEntry(entry)`: updates existing entry with same osm_id
- [ ] `upsertDatabaseEntry(entry)`: inserts new entry when osm_id not found

### Integration Tests
- [ ] Full flow: fetch from Overpass -> parse -> store -> search -> find result
- [ ] Save flow: browse database -> save to My Trails -> verify trail appears in personal list
- [ ] Filter flow: download region -> filter by difficulty -> verify correct subset
- [ ] Dedup flow: import same region twice -> verify no duplicate entries

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Trails > Discover
3. If no data: tap "Download trails for this area" (requires network)
4. Verify: progress indicator shown during download -- corresponds to AC-5
5. After download, verify: trail list shows results with names and distances -- corresponds to AC-1
6. Verify: trail count shown at top -- corresponds to AC-9
7. Type a trail name in the search bar
8. Verify: results appear instantly -- corresponds to AC-2
9. Apply difficulty filter (select "Moderate" only)
10. Verify: only moderate trails shown -- corresponds to AC-3
11. Tap a trail to open its detail
12. Tap "Save to My Trails"
13. Navigate to the Trails tab (personal trails)
14. Verify: the saved trail appears in the list -- corresponds to AC-6
15. Open the Map tab
16. Verify: database trail markers shown on the map -- corresponds to AC-7
17. Tap a marker
18. Verify: callout shows trail info
19. Go back to Discover, tap "Refresh"
20. Verify: data refreshes from Overpass -- corresponds to AC-4, AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to discover screen, verify all states

### Required: Complexity <= 2 (this feature is Complexity 0 = Massive):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Validate Overpass query strategy and data volume.

### Required: Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate OSM data licensing, API strategy, and FTS5 approach

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Trails module requires users to manually create or record trails
- No trail discovery or database browsing
- Cold-start problem: new users see an empty trail list

### After This Work
- New V8 migration adds `tr_trail_database` table with FTS5
- New `database/` directory with OSM client, importer, and search
- Discover screen shows nearby trails from OpenStreetMap data
- Users can search, filter, and save database trails
- Map shows database trail markers
- Cold-start problem solved: new users immediately see trails near them

### Files Changed
- `modules/trails/src/types.ts` -- New `TrailDatabaseEntry`, `TrailSearchResult` schemas
- `modules/trails/src/db/schema.ts` -- V8 migration SQL with FTS5
- `modules/trails/src/db/crud.ts` -- CRUD for database entries, FTS5 search
- `modules/trails/src/database/osm-client.ts` -- Overpass API client
- `modules/trails/src/database/trail-importer.ts` -- OSM to local database parser
- `modules/trails/src/database/trail-search.ts` -- FTS5 search wrapper
- `modules/trails/src/definition.ts` -- Add V8 migration
- `modules/trails/src/index.ts` -- Export database functions
- `apps/mobile/app/(trails)/discover.tsx` -- Trail discovery screen
- `apps/mobile/app/(trails)/map.tsx` -- Database trail markers
- `apps/web/app/trails/page.tsx` -- Discovery section

### Known Limitations
- **OSM data quality varies:** Some trails have minimal tags (no difficulty, no surface type). The importer does its best to infer difficulty from available data but may be inaccurate.
- **No user-contributed data:** Unlike AllTrails, MyTrails has no community layer for trail database. V1 is OSM data only.
- **No photos in database:** OSM trail data includes routes and metadata but not photos. Photos come from user recordings.
- **Overpass API is public infrastructure:** It's free but sometimes slow or unavailable. The local cache mitigates this, but initial fetches depend on Overpass availability.
- **CC-BY-SA attribution required:** OSM data requires attribution. Show "Data from OpenStreetMap contributors" in the footer of any screen displaying database trails.

### Context for Next Agent
- Overpass API endpoint: `https://overpass-api.de/api/interpreter`. Send POST requests with Overpass QL queries. Example query for hiking routes in a bbox: `[out:json][timeout:30]; relation["route"="hiking"](bbox); out geom;`.
- `sac_scale` is the primary OSM tag for hiking difficulty: T1 (easy), T2 (moderate), T3 (hard), T4-T6 (expert). Map these to the existing `easy/moderate/hard/expert` values.
- FTS5 requires a trigger or manual sync to keep the FTS table in sync with the content table. Use `INSERT INTO tr_trail_database_fts(tr_trail_database_fts) VALUES('rebuild')` after bulk imports.
- Route geometry from Overpass is returned as a series of coordinates in the relation's members. Convert to GeoJSON LineString for storage and map rendering.
- Consider chunking Overpass queries by smaller bboxes (0.5 degree squares) for large regions to avoid timeout.
