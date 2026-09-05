# Feature Spec: Trails Offline Maps

## Metadata
- **Module:** trails
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 5 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 5 x1
- **Sprint:** 1
- **Estimated CC Time:** 3-4 hours (Complexity Inverse = 1, "Complex")
- **Depends On:** none (foundational infrastructure for all Trails features)
- **Blocks:** weather overlay, wrong-turn alerts, turn-by-turn navigation, route planning, trail database integration

## Business Context

### Why This Feature Exists
Hikers lose cell signal on every trail. Offline maps are the #1 reason users pay for AllTrails ($27-54/yr) and Gaia GPS ($40/yr). Without offline maps, the Trails module is unusable in its core use case. This is the foundational infrastructure that every other Trails feature depends on -- wrong-turn alerts, route planning, and navigation all need a map that works without network.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AllTrails | Yes | Yes ($26.99-53.99/yr) | Download region/trail-specific map packs. 20M+ users. Offline maps are the #1 premium upgrade driver. |
| Gaia GPS | Yes | Yes ($39.99/yr) | Download entire topo/satellite layers by drawn bounding box. Backcountry focus. Multiple map source options. |
| Komoot | Yes | Yes ($29.99 one-time per region) | Download by named region. Includes turn-by-turn voice nav offline. 35M+ users. |
| Strava | Partial | Yes ($79.99/yr) | Offline route sync but limited map tile caching. Focused on segments, not navigation. |

### Target User
AllTrails free-tier users (20M+) who hit the "download map" paywall every time they hike. Day hikers and weekend backpackers who need reliable maps in areas with no cell coverage: national parks (Yosemite, Zion), state forests, coastal trails. Users currently paying $27-54/yr to AllTrails primarily for this one feature.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New OfflineRegion, DownloadProgress schemas
  db/schema.ts                  -- New tr_offline_regions table (migration V2)
  db/crud.ts                    -- CRUD for offline regions
  offline/                      -- NEW directory
    tile-manager.ts             -- Tile download/cache/eviction engine
    region-catalog.ts           -- Predefined downloadable regions (CA national parks, etc.)
    storage.ts                  -- Disk usage calculation, cleanup

apps/mobile/app/(trails)/
  map.tsx                       -- Updated: render from cache when offline
  offline-regions.tsx           -- NEW: region browser + download manager

apps/web/app/trails/
  page.tsx                      -- Updated: offline region management UI (download prep before hike)

packages/db/
  (no changes -- uses existing file system for tile cache)
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Map tab (primary map view, uses offline tiles when no network)
       └── Settings tab
            └── Offline Maps ← download manager, region browser, storage usage
```

Mobile: "Offline Maps" accessible from Settings tab AND as a banner prompt on the Map tab when no downloaded regions exist.
Web: "Offline Maps" section within the Trails page for pre-downloading before a trip.

### Data Model

```sql
-- Migration V2: Offline map regions
CREATE TABLE IF NOT EXISTS tr_offline_regions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,                    -- "Yosemite National Park"
  region_key TEXT NOT NULL UNIQUE,       -- "yosemite-np" (catalog key)
  min_lat REAL NOT NULL,
  max_lat REAL NOT NULL,
  min_lng REAL NOT NULL,
  max_lng REAL NOT NULL,
  min_zoom INTEGER NOT NULL DEFAULT 1,
  max_zoom INTEGER NOT NULL DEFAULT 15,
  tile_count INTEGER NOT NULL DEFAULT 0, -- total tiles in this region
  size_bytes INTEGER NOT NULL DEFAULT 0, -- total disk usage
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','downloading','ready','error','stale')),
  progress REAL NOT NULL DEFAULT 0.0,    -- 0.0 to 1.0
  downloaded_at TEXT,                    -- ISO timestamp of last successful download
  expires_at TEXT,                       -- tiles considered stale after this
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_offline_regions_status ON tr_offline_regions(status);
CREATE INDEX IF NOT EXISTS idx_tr_offline_regions_bbox ON tr_offline_regions(min_lat, max_lat, min_lng, max_lng);
```

Tile storage: tiles cached as files in `<app-data>/tiles/{region_key}/{z}/{x}/{y}.pbf` (vector tiles) or `.png` (raster). Not in SQLite -- file-system storage is faster for random tile access and avoids bloating the database.

### Dependencies
- **Internal:** `@mylife/trails` (module definition, types, CRUD), `@mylife/db` (DatabaseAdapter, migration orchestration)
- **External:**
  - Mobile: `@rnmapbox/maps` (already a dependency in MySurf standalone) with `OfflineManager` API for tile pack downloads
  - Web: `maplibre-gl` for map rendering with custom tile source that falls back to IndexedDB cache
  - Tile source: OpenMapTiles / Protomaps free vector tiles (no API key, self-hostable, .pmtiles format)
- **Cross-Module:** Surf module's map package (`packages/maps/`) contains Mapbox/MapLibre config -- can share tile sources and base map style. Score: 2 (mild cross-module benefit).

## Functional Requirements

### User Stories
1. As a hiker preparing for a weekend trip, I want to download the map for Yosemite before I leave home so that I have full map coverage with no cell signal on the trail.
2. As a day hiker at a trailhead with weak signal, I want the map to seamlessly use cached tiles so that I don't notice the transition from online to offline.
3. As a runner recording a trail in a canyon with no signal, I want GPS tracking to continue recording my position on the offline map so that I get a complete route when I finish.
4. As a user with limited phone storage, I want to see how much space each region uses and delete regions I no longer need so that offline maps don't fill up my device.
5. As a hiker planning multiple trips, I want to download several regions (Yosemite, Big Sur, Joshua Tree) and manage them from one screen so that I'm always prepared.

### Behavior Specification

**Download flow:**
1. User navigates to Settings > Offline Maps (or taps "Download Map" banner on Map tab)
2. User sees a list of predefined regions (California national/state parks, popular trail areas) grouped by area
3. Each region card shows: name, bounding box on mini-map, estimated download size, tile count
4. User taps "Download" on a region
5. System starts downloading tiles: vector tiles at zoom levels 1-15 for the bounding box
6. Progress bar shows download progress (0-100%) with tile count and bytes downloaded
7. User can cancel mid-download (partial tiles are cleaned up)
8. On completion, region status changes to "ready" with downloaded_at timestamp
9. Region appears in "Downloaded" section at top of the list

**Offline rendering:**
1. Map component checks for network connectivity on render
2. If offline, tile source switches to local file cache
3. Tiles found in cache render normally; missing tiles show as grey placeholder
4. User's GPS position (blue dot) continues updating via device GPS (no network needed)
5. All map interactions (pan, zoom, tap trail) work identically offline

**GPS tracking while offline:**
1. User starts a recording from the Map tab
2. GPS waypoints are captured via device location services (no network required)
3. Waypoints are written to `tr_waypoints` in local SQLite
4. Track is drawn on the offline map in real-time as waypoints accumulate
5. When user ends recording, full track is available with distance/elevation/duration
6. If user regains connectivity later, no sync needed -- all data is already local

**Storage management:**
1. Settings > Offline Maps shows total offline storage usage at top ("142 MB used")
2. Each downloaded region shows its size
3. User can tap "Delete" on a region to remove its tiles and free space
4. "Update" button re-downloads a region if tiles are older than 30 days (stale)
5. If device storage drops below 500MB free, show a warning banner suggesting cleanup

### Edge Cases

- **Mid-download app kill:** On next launch, detect regions with status='downloading' and resume from last tile offset (or reset to 'pending' and restart)
- **Storage full during download:** Catch write errors, mark region as 'error' with message "Not enough storage space", clean up partial tiles
- **Very large region:** Cap maximum bounding box to prevent downloading all of California. Enforce max ~50,000 tiles per region (~500MB). Show size estimate before download and warn if >200MB.
- **Multiple regions with overlapping tiles:** Tiles are stored by z/x/y path so identical tiles are naturally deduplicated. Region size_bytes tracks per-region usage for display but actual disk use may be lower due to overlap.
- **Switching from online to offline mid-session:** Map renderer continues with cached tiles. New areas panned to that aren't cached show grey. GPS tracking is unaffected.
- **Module disabled while download in progress:** Cancel active downloads on module disable. Tiles remain on disk (data preserved per MyLife module lifecycle contract).
- **Tile expiration:** After 30 days, region status changes to 'stale'. Map still uses stale tiles but shows subtle "Update available" badge. User can re-download at will.
- **No GPS permission:** GPS tracking requires location permission. If denied, show inline error "Location access required for trail recording" with a button to open device settings. Map still renders offline tiles without GPS.
- **Airplane mode with GPS:** GPS works on airplane mode (it's receive-only). Offline maps + GPS tracking should work perfectly in airplane mode.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can browse a catalog of 10+ predefined California regions with estimated download sizes
- [ ] **AC-2:** User can tap "Download" and see a progress bar with percentage, tile count, and bytes downloaded
- [ ] **AC-3:** After download completes, region shows "Ready" status with download date
- [ ] **AC-4:** With airplane mode on, map renders downloaded region tiles at all zoom levels 1-15
- [ ] **AC-5:** With airplane mode on, GPS blue dot updates position on the offline map
- [ ] **AC-6:** With airplane mode on, user can start a recording and see the track drawn on the offline map
- [ ] **AC-7:** Completed offline recording shows correct distance, elevation gain, and duration
- [ ] **AC-8:** User can delete a downloaded region and storage space is reclaimed
- [ ] **AC-9:** Total offline storage usage displayed is accurate to within 1MB
- [ ] **AC-10:** User can cancel a download in progress and partial tiles are cleaned up
- [ ] **AC-11:** Panning to an area outside downloaded regions shows grey placeholder tiles (not a crash)

### Technical Criteria
- [ ] **TC-1:** `tr_offline_regions` table is created by migration V2 with all columns and indexes
- [ ] **TC-2:** Tile files are stored at `<app-data>/tiles/{region_key}/{z}/{x}/{y}.pbf` with correct content
- [ ] **TC-3:** Download resumes or restarts cleanly after app kill during download
- [ ] **TC-4:** Region with status='error' can be retried (tap "Download" resets status to 'pending')
- [ ] **TC-5:** GPS waypoints continue to be written to SQLite at 1Hz during offline recording
- [ ] **TC-6:** Map tile source dynamically switches between network and local cache based on connectivity
- [ ] **TC-7:** Regions with status='stale' (>30 days old) still render but show "Update available"

### Negative Criteria
- [ ] **NC-1:** Offline maps must NOT upload GPS data, tile requests, or location data to any server
- [ ] **NC-2:** Deleting a region must NOT affect any trail recordings, waypoints, or saved trails
- [ ] **NC-3:** Offline map download must NOT block the UI thread (all downloads are background tasks)
- [ ] **NC-4:** Tile cache must NOT be stored in SQLite database (use file system to avoid DB bloat)

## UI Specification

### Mobile (Expo)

**Map Tab (updated):**
- If no regions downloaded: glass card banner at top with "Download offline maps for your next hike" + lime accent CTA button
- Map renders via `@rnmapbox/maps` with offline tile pack when no network
- Blue GPS dot renders from device location services regardless of network
- Active recording track drawn as lime (#65A30D) polyline

**Offline Maps Screen (new):**
- Background: `#0A0A0F`
- Header: "Offline Maps" with total storage badge ("142 MB")
- Section 1: "Downloaded" -- glass cards for each ready region showing name, size, downloaded date, "Delete" ghost button, "Update" ghost button if stale
- Section 2: "Available" -- catalog regions grouped by area (National Parks, Coastal, Bay Area, etc.)
- Each catalog card: name, estimated size ("~45 MB"), mini bounding box indicator
- Download button: lime accent `#65A30D` pill button
- Active download: progress bar with percentage, cancel button
- Module accent: `#65A30D` (lime)

### Web (Next.js)

- Offline region management section within trails page
- Region catalog as a grid of cards with "Download" buttons (for pre-trip planning)
- Download progress shown inline
- "Downloaded Regions" section at top showing ready regions with delete/update controls
- Note: web offline maps require Service Worker + IndexedDB tile cache (stretch goal -- mobile is primary)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards in region list | Initial catalog fetch |
| Empty | "Download maps for offline hiking" + CTA | No regions downloaded yet |
| Error | "Download failed" + retry button on the region card | Network error during download, storage full |
| Success | Region cards with "Ready" badge, map renders offline | Region fully downloaded |
| Partial | Download progress bar (45% - 2,340 of 5,200 tiles) | Download in progress |
| Stale | Region card with "Update available" badge, still renders | Downloaded >30 days ago |

## Test Requirements

### Unit Tests
- [ ] `createOfflineRegion`: creates region record with status='pending'
- [ ] `updateRegionProgress`: updates progress and tile_count
- [ ] `markRegionReady`: sets status='ready', downloaded_at, size_bytes
- [ ] `markRegionError`: sets status='error' with error_message
- [ ] `deleteOfflineRegion`: removes record and returns region_key for file cleanup
- [ ] `getReadyRegions`: returns only status='ready' regions
- [ ] `getStaleRegions`: returns regions where downloaded_at > 30 days
- [ ] `tilePathForCoordinate`: given z/x/y, returns correct file path
- [ ] `estimateRegionTileCount`: given bbox and zoom range, returns accurate tile count
- [ ] `estimateRegionSizeBytes`: given tile count, returns reasonable size estimate
- [ ] `regionCatalog`: returns 10+ predefined California regions with valid bboxes

### Integration Tests
- [ ] Full download flow: create region -> simulate tile writes -> mark ready -> verify tile files exist
- [ ] Delete flow: download region -> delete -> verify files removed and DB record gone
- [ ] Stale detection: create region with old downloaded_at -> verify getStaleRegions returns it
- [ ] Resume flow: create region with status='downloading' and partial progress -> verify restart behavior

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Trails > Settings > Offline Maps
3. Verify: region catalog shows 10+ regions with sizes -- corresponds to AC-1
4. Tap "Download" on "Yosemite National Park"
5. Verify: progress bar appears showing percentage and tile count -- corresponds to AC-2
6. Wait for download to complete
7. Verify: region shows "Ready" with download date -- corresponds to AC-3
8. Enable airplane mode on the device
9. Navigate to Map tab
10. Verify: Yosemite area renders with map tiles, no grey gaps -- corresponds to AC-4
11. Verify: blue GPS dot shows current position -- corresponds to AC-5
12. Tap "Start Recording"
13. Walk/simulate movement for 30 seconds
14. Tap "Stop Recording"
15. Verify: recording shows track on map with distance and duration -- corresponds to AC-6, AC-7
16. Disable airplane mode
17. Navigate back to Offline Maps
18. Tap "Delete" on Yosemite
19. Verify: region removed from list, storage total decreased -- corresponds to AC-8, AC-9

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the offline maps screen, verify all states render

### Required: Complexity <= 2 (this feature is Complexity 1 = Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required: Complexity <= 1 (Complex):
- [ ] `/office-hours` (builder mode) -- validate tile storage approach and platform API choices

### Post-merge:
- [ ] `/parity-check` -- trails has a standalone counterpart (MySurf trails utilities)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Trails module has GPS recording, distance/elevation analytics, waypoints, and photos
- No map rendering at all -- no tiles, no MapLibre/Mapbox, no offline support
- Module definition has `requiresNetwork: false` which is aspirational (no maps = no map rendering)
- 4 tables in V1 migration (trails, recordings, waypoints, photos)

### After This Work
- New V2 migration adds `tr_offline_regions` table
- New `offline/` directory with tile manager, region catalog, and storage utilities
- Mobile map tab renders tiles from local cache when offline
- Region download manager screen for browsing, downloading, and managing offline map packs
- GPS tracking continues to work as before but now visualized on an offline-capable map
- Web page has region management for pre-trip download planning

### Files Changed
- `modules/trails/src/types.ts` -- New `OfflineRegionSchema`, `DownloadProgressSchema`, `RegionCatalogEntry` types
- `modules/trails/src/db/schema.ts` -- V2 migration with `tr_offline_regions` table
- `modules/trails/src/db/crud.ts` -- CRUD for offline regions (create, update progress, mark ready/error, delete, list)
- `modules/trails/src/definition.ts` -- Add TRAILS_MIGRATION_V2, bump schemaVersion to 2
- `modules/trails/src/offline/tile-manager.ts` -- Tile download queue, progress tracking, cancellation
- `modules/trails/src/offline/region-catalog.ts` -- 10+ predefined California regions with bounding boxes
- `modules/trails/src/offline/storage.ts` -- Disk usage calculation, tile file cleanup, free space check
- `modules/trails/src/index.ts` -- Export new offline functions
- `apps/mobile/app/(trails)/map.tsx` -- Offline tile source integration
- `apps/mobile/app/(trails)/offline-regions.tsx` -- New download manager screen
- `apps/web/app/trails/page.tsx` -- Region management section

### Known Limitations
- **California only for V1:** Region catalog covers CA national parks, state parks, and popular trail areas. Other states come later via catalog expansion (no code changes needed).
- **Vector tiles only:** V1 uses vector tiles (.pbf). Satellite imagery is much larger and deferred to a future enhancement.
- **No automatic tile updates:** Users must manually tap "Update" for stale regions. Background refresh could be added later.
- **Web offline is a stretch goal:** IndexedDB tile caching with Service Worker is architecturally different from mobile's file-system approach. Mobile is the primary target. Web shows download management but may not render offline maps in V1.
- **No tile server self-hosting in V1:** We use Protomaps/OpenMapTiles CDN. Self-hosting for cost control is a future optimization.

### Context for Next Agent
- The `@rnmapbox/maps` `OfflineManager` API handles tile pack downloads natively on iOS/Android. Start with the Mapbox offline pack approach rather than building a custom tile downloader.
- Tile counts grow quadratically with zoom level. Z15 for a national park can be 50K+ tiles. Always show estimated size before download and enforce the 50K tile / 500MB cap.
- The surf module already has map infrastructure in `packages/maps/` -- check if shared map styles and tile sources can be reused rather than duplicated.
- GPS tracking via `expo-location` works fully offline (GPS is receive-only, no network needed). The existing waypoint CRUD in `tr_waypoints` is already offline-first.
- Be careful with the file system tile path: iOS sandboxes change on app updates. Use `expo-file-system` `documentDirectory` (persists across updates) not `cacheDirectory` (may be purged).
