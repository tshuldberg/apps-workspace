# MySurf Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. MySurf uses a **Supabase backend** (not local SQLite) and its hub module lives at `modules/surf/`.

**MySurf** is a full-stack surf forecasting app competing with Surfline. The standalone source of truth lives at `/Users/trey/Desktop/Apps/MyLife/MySurf/`, a mature Turborepo monorepo with approximately 160 source files. It has: `apps/mobile/` (Expo with 5-tab nav), `apps/web/` (Next.js 15), `apps/data-pipeline/` (NOAA/NDBC ingestion, AI narrative generation via Claude API), `packages/shared/` (Zod types, spot rating algorithm, geo utils), `packages/api/` (Supabase client, typed queries), `packages/ui/` (dark theme tokens), `packages/maps/` (Mapbox config, CA buoy/tide stations). Backend: Supabase with PostgreSQL + PostGIS, 9 database tables, RLS, Edge Functions. Currently tracks approximately 200 curated California surf spots.

**What already exists:** Home feed with AI-generated surf narratives (Claude API), interactive swell map (MapLibre on web, Mapbox on mobile), spot detail pages with forecast and live data tabs, session logging, favorites, user auth (Supabase Auth), data pipeline (NDBC buoys, WaveWatch III model, NOAA tide data, Claude narrative generation), spot rating engine, premium content gate, caching layer.

**Consolidation context:** MySurf absorbs **MyTrails** (a planned hiking/trails app that does not yet have runtime code). The combined app becomes an "Outdoor" hub for surf and trail activities, sharing the same map infrastructure. Trail data introduces offline maps, GPS recording, and elevation profiles alongside the existing surf features.

**What needs to be built (2 feature sets):**

### Feature Set 1: Surf Power Features

Features that close the gap with Surfline Premium and add capabilities Surfline lacks.

**Features:**
- Surf alerts / condition notifications: user-defined rules per spot (e.g., "notify me when swell > 4ft and wind < 10mph at Ocean Beach") evaluated against incoming forecast data
- GPS session tracking with wave detection: record a surf session via phone GPS, detect wave rides based on speed/direction changes, log wave count and ride duration
- Spot reviews and community photos: user-submitted ratings, written reviews, and geo-tagged photos per spot
- Offline map caching: download map tiles and forecast data for a region for use without connectivity
- Detailed spot guide / local knowledge: curated content per spot (best tide, best swell direction, hazards, parking, crowd level)
- Multiple weather model support: compare GFS vs. ECMWF forecasts side-by-side on the spot detail page

### Feature Set 2: Trail Integration (MyTrails Consolidation)

MyTrails features add hiking and trail capabilities to the outdoor hub, sharing map infrastructure with surf.

**Features:**
- Offline OpenStreetMap tiles with GPS trail recording (start/stop/pause, breadcrumb track on map)
- Elevation profiles: show elevation gain/loss along a recorded or browsed trail
- Trail search and discovery: browse trails by region, difficulty, length, elevation gain
- GPX import/export: import trails from other apps, export recorded sessions
- Trail reviews and photos: user-submitted ratings, written reviews, and photos per trail
- Pre-downloaded map regions: select a geographic area and download all map tiles for offline use

---

## Acceptance Criteria

### Feature Set 1: Surf Power Features

1. User opens a spot detail page and taps "Set Alert" -> defines a rule ("swell height > 4ft AND wind speed < 10mph") -> saves it; when the next forecast update matches the rule, user receives a push notification with the spot name and current conditions
2. User taps "Start Session" at the beach -> GPS begins recording; after a 1-hour surf, user taps "Stop" -> sees a session summary: wave count (detected from GPS speed spikes), total time in water, longest ride duration, session path on the map
3. User scrolls down on a spot detail page -> sees a "Community" section with user-submitted reviews (star rating + text), photos in a grid, and an "Add Review" button; user taps it -> submits a review with 4 stars, text, and 2 photos -> the review appears in the feed
4. User taps "Download Region" on the map -> selects a coastal area -> map tiles and 48-hour forecast data download; user enables airplane mode -> map and cached forecasts still display correctly
5. User opens spot detail and taps "Compare Models" -> sees GFS and ECMWF swell height forecasts side-by-side in a dual-line chart for the next 7 days

### Feature Set 2: Trail Integration

6. User navigates to the Trails tab and taps "Explore" -> sees a list of nearby trails with name, distance, difficulty, and elevation gain; taps a trail -> sees a detail page with the trail plotted on the map, an elevation profile chart, and user reviews
7. User taps "Record Hike" -> GPS begins tracking; the trail draws in real time on the map; after completing the hike, user taps "Stop" -> sees a summary with distance, duration, elevation gain/loss, pace, and a map of the recorded route
8. User exports a recorded hike as GPX -> the file opens correctly in another GPS app (e.g., AllTrails, Strava)

---

## Constraint Architecture

**Musts:**
- Surf data uses Supabase backend (PostgreSQL + PostGIS); do not move to local SQLite
- Trail recording data stored locally in SQLite for offline reliability, synced to Supabase when online
- New Supabase tables for surf features: `spot_alerts`, `alert_rules`, `surf_sessions`, `session_waves`, `spot_reviews`, `spot_photos`
- New SQLite tables for trail features with `tr_` prefix: `tr_trails`, `tr_trail_points`, `tr_recorded_hikes`, `tr_hike_points`, `tr_trail_reviews`, `tr_trail_photos`, `tr_offline_regions`
- GPS session tracking must handle background location (Expo Location with background permissions)
- Wave detection algorithm must work offline (no server-side processing during a session)
- Offline map tiles use vector tiles (MapLibre format) stored in device storage

**Must-nots:**
- Do not modify the existing data pipeline in `MySurf/apps/data-pipeline/`
- Do not change the existing spot rating algorithm in `packages/shared/`
- Do not require authentication for browsing trails or viewing spot reviews (auth required only for posting)
- Do not store raw GPS traces on the server (only derived session summaries)
- Do not modify `packages/module-registry/` or other modules

**Preferences:**
- Reuse the existing map infrastructure (MapLibre on web, Mapbox on mobile) for trail rendering
- Use the existing Supabase Auth for review/photo submissions
- Wave detection via speed threshold + direction change heuristic (speed > 5 knots for > 3 seconds = wave ride)
- Trail discovery data can be sourced from OpenStreetMap (overpass API) or bundled for California
- Elevation data from USGS SRTM tiles or similar open dataset

**Escalation triggers:**
- If background GPS tracking drains battery faster than 10% per hour in testing, flag for optimization (reduce sampling rate)
- If offline map tile storage exceeds 500MB for a single coastal region, investigate tile compression or zoom-level limits
- If the ECMWF data source requires a paid API subscription, defer multi-model comparison and document the requirement

---

## Subtask Decomposition

**Subtask 1: Surf Alert System (90 min)**
Add `spot_alerts` and `alert_rules` Supabase tables with RLS. Build rule definition UI (condition builder: parameter, operator, value). Implement server-side rule evaluation via Supabase Edge Function triggered by forecast data updates. Fire push notifications for matched rules.

**Subtask 2: GPS Session Tracking and Wave Detection (90 min)**
Build the session recording UI (start/stop/pause). Implement background GPS tracking with Expo Location. Build wave detection algorithm (speed threshold + directional change). Generate session summary with wave count, ride durations, and map path.

**Subtask 3: Spot Reviews and Community Photos (60 min)**
Add `spot_reviews` and `spot_photos` Supabase tables with RLS. Build review submission and display UI on spot detail page. Handle photo upload to Supabase Storage. Display aggregated community rating.

**Subtask 4: Offline Map Caching (90 min)**
Build a region selector UI for downloading map tiles. Implement tile download and local storage. Cache 48-hour forecast data alongside tiles. Detect offline state and serve from cache.

**Subtask 5: Trail Schema and Discovery (90 min)**
Add trail SQLite tables with `tr_` prefix. Build trail discovery screen with search/filter (distance, difficulty, elevation). Source initial California trail data from OpenStreetMap. Display trail detail with map and elevation profile.

**Subtask 6: Trail Recording and GPX (60 min)**
Build GPS hike recording with real-time map breadcrumb. Calculate distance, elevation gain/loss, and pace. Implement GPX import/export for recorded hikes.

---

## Evaluation Design

1. **Alert evaluation:** Create an alert rule "swell > 4ft" for Ocean Beach -> insert a forecast row with swell_height = 5.0 -> verify the Edge Function fires and a notification record is created
2. **Wave detection:** Feed the algorithm a GPS trace with 3 speed bursts above 5 knots lasting > 3 seconds each -> `detectWaves(trace)` returns 3 wave objects with start/end times and durations
3. **Offline caching:** Download a region's tiles, enable airplane mode, navigate the map -> tiles render from cache; view a cached spot forecast -> data displays without network
4. **GPX round-trip:** Record a hike, export as GPX, import the same GPX file -> the imported trail matches the original within 1 meter per point
5. **Type safety:** `pnpm typecheck` exits 0; `pnpm check:parity` exits 0
