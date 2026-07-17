# MyTrails — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyTrails** — AllTrails without the tracking. One-time purchase, offline forever.

A privacy-first hiking and trail guide app for iOS, Android, Mac, and web. Offline OpenStreetMap maps, GPS trail recording with elevation profiles, trail search and discovery, and full GPX export. No accounts required, no location tracking outside of active recordings, no telemetry. One-time purchase: $4.99.

### Core Differentiators

1. **Offline-first architecture** — Download entire map regions for offline use. Trail data, topo maps, and elevation data all cached locally. Perfect for backcountry with no cell signal.
2. **Privacy by design** — GPS is ONLY active during trail recording. No background location tracking, no breadcrumb trails, no location history. Your hiking data stays on your device.
3. **One-time purchase** — $4.99 forever. AllTrails charges $36-80/yr. Gaia GPS charges $40/yr. We charge once.
4. **Source-available** — FSL license. Audit the code yourself. Verify there's no hidden tracking.
5. **OpenStreetMap-powered** — No proprietary map data. Community-maintained trail database that improves over time without vendor lock-in.

---

## Problem Statement

AllTrails dominates the hiking app market with 80M+ users, but its business model creates conflicts with user interests. It aggressively tracks user location in the background, pushes annual subscriptions ($36-80/yr) for basic features like offline maps, and displays ads to free users on the trail. Gaia GPS ($40/yr) and Komoot ($30/yr) follow similar subscription models.

Hikers who just want a reliable offline map with GPS recording face a recurring annual charge for what is fundamentally a local utility. The trail data comes from public sources (USGS, OpenStreetMap). The maps are rendered from open data. The GPS is a hardware sensor on their phone. The only thing these apps actually provide is a polished UI wrapper around freely available data — and they charge annually for it.

MyTrails provides that polished wrapper for a one-time fee, without the surveillance.

---

## Target User Persona

### Primary: "Weekend Warrior"
- **Age:** 28-45
- **Behavior:** Hikes 2-4 times per month, mostly day hikes on established trails. Checks conditions and downloads maps before heading out.
- **Pain point:** Pays $36-80/yr for AllTrails just to get offline maps. Feels nickel-and-dimed. Frustrated that basic features require a subscription.
- **Willingness to pay:** High — already paying for AllTrails, would happily switch to a one-time purchase.
- **Tech savvy:** Moderate — comfortable with phone GPS, downloads maps before trips when reminded.
- **Trigger:** AllTrails renewal notification arrives and they think "I'm paying HOW MUCH for a map app?"

### Secondary: "Privacy Hiker"
- **Age:** 30-55
- **Behavior:** Regular hiker who is privacy-conscious. Noticed AllTrails tracking their location in the background.
- **Pain point:** Doesn't want a hiking app that builds a location profile of everywhere they've been.
- **Willingness to pay:** High — privacy is worth more than $4.99.
- **Trigger:** Saw the AllTrails background location warning on their phone, or read about hiking app data collection.

### Tertiary: "Backcountry Explorer"
- **Age:** 25-40
- **Behavior:** Multi-day backpacking trips, off-grid for days. Needs maps that work with zero connectivity.
- **Pain point:** AllTrails' offline maps are unreliable and require premium. Needs rock-solid offline performance.
- **Willingness to pay:** Very high — reliable offline maps are a safety feature.
- **Trigger:** Lost cell signal on a trail and AllTrails failed them.

---

## Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|-------------|
| **AllTrails** | $36-80/yr | 80M+ | ~$300M ARR | Background location tracking, data shared with partners, location history stored on servers | Subscription fatigue, aggressive upsells, privacy concerns, free tier is ad-supported and limited |
| **Gaia GPS** | $40/yr | 2M+ | ~$30M ARR | Cloud-synced tracks, location data stored server-side | Expensive, complex UI for casual hikers, overkill for day hikes |
| **Komoot** | $30 one-time (region) or $60 (world) | 35M+ | ~$100M ARR | Cloud-synced, social features, location tracking | Per-region pricing is confusing, social features are unwanted by privacy users |
| **Avenza Maps** | Free + paid maps ($1-30 each) | 5M+ | ~$20M ARR | PDF maps, local storage | Map-by-map purchasing model, no trail database, dated UX |
| **OsmAnd** | Free / $10 (pro) | 10M+ | ~$5M ARR | Local-first, open-source | Ugly UI, steep learning curve, not hiking-focused |
| **Apple Maps** | Free | Bundled | $0 | On-device | No trail data, no recording, no elevation profiles, no offline regions |
| **MyTrails** | **$4.99 one-time** | 0 (launch) | TBD | **Local-only, GPS only during recording, source-available** | New entrant, smaller trail database (initially), no social/community features |

### Market Opportunity

The outdoor recreation app market is valued at ~$2.5B. AllTrails' 80M user count proves massive demand, but its NPS is declining as subscription prices rise and privacy concerns grow. The "AllTrails price refugee" is a real and growing segment — people searching "AllTrails alternative" or "AllTrails too expensive" on Reddit. MyTrails targets this exact segment with a clear value proposition: same core features, one-time price, no tracking.

---

## Key Features (MVP)

### Maps & Navigation
1. **Offline trail maps** — OpenStreetMap tiles rendered with outdoor/topo styling. Download rectangular regions for offline use. Tiles stored in local SQLite cache.
2. **Trail search & browse** — Search trails by name, location, difficulty, distance, elevation gain. Filter by dog-friendly, kid-friendly, wheelchair-accessible.
3. **Trail detail view** — Elevation profile, distance, estimated time, difficulty rating, trailhead directions, photos (user-submitted, stored locally).
4. **Map layers** — Toggle between topo, satellite (offline-capable), and standard views. Contour lines overlay.

### GPS Recording
5. **Trail recording** — Start/stop GPS recording. Real-time position on map, distance counter, elapsed time, current elevation, pace.
6. **Elevation profile** — Live elevation profile built during recording. Shows gain/loss, current elevation, min/max.
7. **Recording stats** — Distance, elevation gain, elapsed time, moving time, average pace, max speed.
8. **GPX export** — Export any recorded trail as a GPX file. Compatible with every mapping tool.

### Trail Management
9. **Save favorite trails** — Bookmark trails for quick access. Organize into custom lists (e.g., "Weekend day hikes", "Dog-friendly", "Bucket list").
10. **Recording history** — Browse past recordings with stats. View on map. Compare stats over time.
11. **Trail notes** — Add personal notes to any trail or recording. "Parking was full by 9am", "Muddy after mile 3".

### Offline & Privacy
12. **Region downloads** — Download rectangular map regions. Shows estimated storage size before download. Manage downloaded regions (view on map, delete).
13. **GPS privacy** — GPS is ONLY activated when user taps "Start Recording". No background location access requested. Clear indicator when GPS is active.
14. **Zero telemetry** — No analytics, no crash reporting, no usage tracking. The app never phones home.

---

## Technical Architecture

### Stack

- **Frontend (Mobile):** Expo (React Native) — iOS + Android from single codebase
- **Frontend (Web):** Next.js 15
- **Maps (Mobile):** `react-native-mapbox-gl` or `react-native-maps` with custom tile source
- **Maps (Web):** MapLibre GL JS with PMTiles
- **Tile Server:** Self-hosted or Protomaps (PMTiles) for offline-capable vector tiles
- **Trail Data:** OpenStreetMap Overpass API (seeded) + local SQLite database
- **Elevation Data:** SRTM (Shuttle Radar Topography Mission) — free, 30m resolution
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web)
- **GPS:** `expo-location` (mobile), Geolocation API (web)
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **License:** FSL-1.1-Apache-2.0

### Monorepo Structure

```
MyTrails/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx          # Explore / map home
│   │   │   │   ├── search.tsx         # Trail search
│   │   │   │   ├── record.tsx         # Active recording
│   │   │   │   ├── saved.tsx          # Saved trails & recordings
│   │   │   │   └── settings.tsx       # Settings
│   │   │   ├── trail/
│   │   │   │   └── [id].tsx           # Trail detail
│   │   │   ├── recording/
│   │   │   │   └── [id].tsx           # Recording detail/review
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── map/           # Map view, markers, overlays
│   │   │   ├── recording/     # GPS recording UI, stats overlay
│   │   │   ├── elevation/     # Elevation profile chart
│   │   │   └── trail/         # Trail cards, trail list
│   │   └── assets/
│   └── web/                   # Next.js 15 — Web
│       ├── app/
│       │   ├── page.tsx               # Map explore
│       │   ├── search/page.tsx        # Trail search
│       │   ├── trail/[id]/page.tsx    # Trail detail
│       │   └── settings/page.tsx      # Settings
│       ├── components/
│       └── public/
├── packages/
│   ├── shared/                # Types, utils, business logic
│   │   ├── src/
│   │   │   ├── types/         # Trail, Recording, Region, Waypoint types
│   │   │   ├── db/            # SQLite schema, migrations, queries
│   │   │   ├── geo/           # Haversine distance, elevation calc, bounding box
│   │   │   ├── gpx/           # GPX parser and generator
│   │   │   ├── stats/         # Recording stats computation
│   │   │   ├── search/        # FTS5 trail search
│   │   │   └── tiles/         # Tile URL generation, cache management
│   │   └── package.json
│   ├── ui/                    # Shared component library
│   │   ├── src/
│   │   │   ├── map/           # Map wrapper, controls, layers
│   │   │   ├── elevation/     # Elevation profile chart component
│   │   │   ├── stats/         # Stat cards, stat rows
│   │   │   ├── trail/         # Trail card, trail list item
│   │   │   └── theme/         # Design tokens
│   │   └── package.json
│   └── data/                  # Trail data seeding & management
│       ├── src/
│       │   ├── seed/          # OSM Overpass queries, trail import scripts
│       │   ├── elevation/     # SRTM data processor
│       │   └── regions/       # Predefined download regions
│       └── package.json
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── CLAUDE.md
├── README.md
└── timeline.md
```

### Data Model (SQLite Schema)

```sql
-- Trail database (seeded from OpenStreetMap + USGS)
CREATE TABLE trails (
    id TEXT PRIMARY KEY,                          -- UUID v4
    osm_id TEXT,                                   -- OpenStreetMap relation/way ID (nullable for user-created)
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    difficulty TEXT NOT NULL DEFAULT 'moderate',    -- 'easy', 'moderate', 'hard', 'expert'
    distance_meters REAL NOT NULL,
    elevation_gain_meters REAL NOT NULL,
    elevation_loss_meters REAL NOT NULL,
    elevation_max_meters REAL,
    elevation_min_meters REAL,
    estimated_time_minutes INTEGER,                -- Based on Naismith's rule
    route_type TEXT NOT NULL DEFAULT 'out_and_back', -- 'loop', 'out_and_back', 'point_to_point'
    surface_type TEXT DEFAULT 'dirt',               -- 'paved', 'dirt', 'gravel', 'rock', 'mixed'
    is_dog_friendly INTEGER NOT NULL DEFAULT 0,
    is_kid_friendly INTEGER NOT NULL DEFAULT 0,
    is_wheelchair_accessible INTEGER NOT NULL DEFAULT 0,
    trailhead_lat REAL NOT NULL,
    trailhead_lng REAL NOT NULL,
    trailhead_elevation_meters REAL,
    bounding_box_min_lat REAL NOT NULL,
    bounding_box_min_lng REAL NOT NULL,
    bounding_box_max_lat REAL NOT NULL,
    bounding_box_max_lng REAL NOT NULL,
    region TEXT NOT NULL,                           -- e.g., 'yosemite', 'big_sur', 'tahoe'
    state TEXT NOT NULL DEFAULT 'CA',
    country TEXT NOT NULL DEFAULT 'US',
    source TEXT NOT NULL DEFAULT 'osm',             -- 'osm', 'usfs', 'nps', 'user'
    popularity_score INTEGER NOT NULL DEFAULT 0,    -- Derived from OSM usage data
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX trails_location_idx ON trails(trailhead_lat, trailhead_lng);
CREATE INDEX trails_region_idx ON trails(region);
CREATE INDEX trails_difficulty_idx ON trails(difficulty);
CREATE INDEX trails_distance_idx ON trails(distance_meters);
CREATE INDEX trails_elevation_idx ON trails(elevation_gain_meters);

-- Full-text search for trails
CREATE VIRTUAL TABLE trails_fts USING fts5(
    name,
    description,
    region,
    content='trails',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- FTS sync triggers
CREATE TRIGGER trails_ai AFTER INSERT ON trails BEGIN
    INSERT INTO trails_fts(rowid, name, description, region)
    VALUES (new.rowid, new.name, new.description, new.region);
END;

CREATE TRIGGER trails_ad AFTER DELETE ON trails BEGIN
    INSERT INTO trails_fts(trails_fts, rowid, name, description, region)
    VALUES ('delete', old.rowid, old.name, old.description, old.region);
END;

CREATE TRIGGER trails_au AFTER UPDATE ON trails BEGIN
    INSERT INTO trails_fts(trails_fts, rowid, name, description, region)
    VALUES ('delete', old.rowid, old.name, old.description, old.region);
    INSERT INTO trails_fts(rowid, name, description, region)
    VALUES (new.rowid, new.name, new.description, new.region);
END;

-- Trail geometry (polyline coordinates)
CREATE TABLE trail_geometries (
    trail_id TEXT PRIMARY KEY REFERENCES trails(id) ON DELETE CASCADE,
    coordinates TEXT NOT NULL,                      -- JSON array of [lat, lng, elevation] tuples
    simplified_coordinates TEXT NOT NULL            -- Simplified for map rendering (Douglas-Peucker)
);

-- Elevation profile points (pre-computed from geometry)
CREATE TABLE elevation_profiles (
    trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    distance_meters REAL NOT NULL,                 -- Distance from trailhead
    elevation_meters REAL NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    PRIMARY KEY (trail_id, distance_meters)
);

-- GPS recordings (user's hikes)
CREATE TABLE recordings (
    id TEXT PRIMARY KEY,                          -- UUID v4
    trail_id TEXT REFERENCES trails(id),           -- Nullable: could be off-trail
    name TEXT NOT NULL,                             -- Auto-generated or user-set
    started_at TEXT NOT NULL,
    ended_at TEXT,
    distance_meters REAL NOT NULL DEFAULT 0,
    elevation_gain_meters REAL NOT NULL DEFAULT 0,
    elevation_loss_meters REAL NOT NULL DEFAULT 0,
    moving_time_seconds INTEGER NOT NULL DEFAULT 0,
    elapsed_time_seconds INTEGER NOT NULL DEFAULT 0,
    avg_pace_min_per_km REAL,
    max_speed_kmh REAL,
    calories_estimate INTEGER,
    notes TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,       -- Boolean: recording finished cleanly
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX recordings_date_idx ON recordings(started_at);
CREATE INDEX recordings_trail_idx ON recordings(trail_id);

-- GPS trackpoints (raw recorded positions)
CREATE TABLE trackpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    elevation_meters REAL,
    accuracy_meters REAL,
    speed_mps REAL,
    timestamp TEXT NOT NULL,
    heart_rate INTEGER                             -- Future: Bluetooth HR monitor
);

CREATE INDEX trackpoints_recording_idx ON trackpoints(recording_id);
CREATE INDEX trackpoints_timestamp_idx ON trackpoints(timestamp);

-- Saved/favorite trails
CREATE TABLE favorites (
    trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    list_name TEXT NOT NULL DEFAULT 'Favorites',   -- Custom list name
    position INTEGER NOT NULL DEFAULT 0,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (trail_id, list_name)
);

CREATE INDEX favorites_list_idx ON favorites(list_name);

-- Trail notes (personal annotations)
CREATE TABLE trail_notes (
    id TEXT PRIMARY KEY,
    trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX trail_notes_trail_idx ON trail_notes(trail_id);

-- Downloaded map regions
CREATE TABLE downloaded_regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                             -- User-facing name: "Yosemite Valley"
    min_lat REAL NOT NULL,
    min_lng REAL NOT NULL,
    max_lat REAL NOT NULL,
    max_lng REAL NOT NULL,
    min_zoom INTEGER NOT NULL DEFAULT 8,
    max_zoom INTEGER NOT NULL DEFAULT 16,
    tile_count INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    downloaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_updated TEXT
);

-- Cached map tiles (offline storage)
CREATE TABLE tile_cache (
    z INTEGER NOT NULL,                            -- Zoom level
    x INTEGER NOT NULL,                            -- Tile X
    y INTEGER NOT NULL,                            -- Tile Y
    layer TEXT NOT NULL DEFAULT 'outdoor',          -- 'outdoor', 'satellite', 'topo'
    data BLOB NOT NULL,                            -- PNG/PBF tile data
    size_bytes INTEGER NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now')),
    region_id TEXT REFERENCES downloaded_regions(id) ON DELETE CASCADE,
    PRIMARY KEY (z, x, y, layer)
);

-- App settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Schema versioning
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Privacy Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      MyTrails App                         │
│                                                           │
│  ┌────────────────────┐  ┌────────────────────────────┐  │
│  │   Map Renderer      │  │   GPS Recording Engine     │  │
│  │   (MapLibre /       │  │   (expo-location)          │  │
│  │    react-native-    │  │                            │  │
│  │    maps)            │  │  ⚡ ONLY active when user  │  │
│  │                     │  │     taps "Start Recording" │  │
│  │  Reads from local   │  │  ⚡ NO background location │  │
│  │  tile cache only    │  │  ⚡ Clear GPS indicator     │  │
│  └──────────┬──────────┘  └────────────┬──────────────┘  │
│             │                          │                  │
│  ┌──────────▼──────────────────────────▼──────────────┐  │
│  │              Business Logic Layer                   │  │
│  │  (packages/shared)                                 │  │
│  │  - Trail CRUD & search (FTS5)                      │  │
│  │  - Recording management                            │  │
│  │  - Stats computation (Haversine, Naismith)         │  │
│  │  - GPX import/export                               │  │
│  │  - Tile cache management                           │  │
│  │  - Elevation profile computation                   │  │
│  └──────────────────────┬─────────────────────────────┘  │
│                         │                                 │
│  ┌──────────────────────▼─────────────────────────────┐  │
│  │               Local SQLite Database                 │  │
│  │  - Trail data (seeded from OSM)                    │  │
│  │  - GPS recordings & trackpoints                    │  │
│  │  - Tile cache (offline map tiles)                  │  │
│  │  - Favorites & notes                               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Network access (ONLY for these purposes, clearly shown): │
│  ✅ Download map tiles for offline regions (user-initiated)│
│  ✅ Initial trail database seed (first launch)            │
│  ❌ No background data transfer                          │
│  ❌ No analytics or telemetry                            │
│  ❌ No location data sent to any server                  │
│  ❌ No crash reporting                                   │
└──────────────────────────────────────────────────────────┘
```

**Key privacy decisions:**
- The app requests `foreground` location permission ONLY. Never `always` (background). iOS/Android will show a blue/green GPS indicator bar when recording is active.
- Map tiles are downloaded to local SQLite as blobs. Once downloaded, the map works without any network access.
- Trail data is seeded from OpenStreetMap during first launch and can be updated manually (never automatically).
- GPS trackpoints are stored locally. They are never uploaded, synced, or transmitted.
- The user's hiking history exists only on their device. Deleting the app deletes all data permanently.
- GPX export gives users full control: they choose when and where to share their track data.

### Offline Map Strategy

```
Download Flow:
1. User selects a rectangular region on the map
2. App calculates tile count for zoom levels 8-16
3. Shows estimated size: "Yosemite Valley: 2,847 tiles (~180MB)"
4. User confirms → tiles downloaded to SQLite tile_cache table
5. Trail data for the bounding box also cached locally

Tile Sources (configurable):
- OpenStreetMap standard (free)
- OpenTopoMap (free, topo contours)
- Thunderforest Outdoors (free tier: 150K tiles/month)
- ESRI World Imagery (satellite, free for non-commercial)

Storage Estimates:
- City park area (5km²): ~50MB
- National Park (500km²): ~200MB
- Entire state (CA): ~2GB
- Recommended: download specific regions, not entire states
```

---

## UI/UX Direction

### Design Philosophy
- **Outdoorsy and functional** — The app should feel like a well-designed trail map, not a social media feed. Earthy tones, clean typography, high-contrast for outdoor readability.
- **High-contrast for sunlight** — Outdoor use means screen visibility matters. Strong contrast ratios, large touch targets, high-visibility GPS indicator.
- **Offline indicators** — Always clear about what's available offline. Downloaded regions shown on the map. Offline badge on cached trails.
- **Minimal navigation** — The map is the app. Everything else is accessible from the map context.

### Design Tokens (Dark Theme)

```typescript
const theme = {
  colors: {
    background: '#0A0F0D',          // Deep forest black
    surface: '#141A17',             // Dark forest surface
    surfaceElevated: '#1E2723',     // Elevated card
    text: '#F0F5F2',               // Cool white
    textSecondary: '#8FA898',      // Sage grey
    textTertiary: '#5A7264',       // Dim forest grey
    accent: '#2ECC71',             // Trail green — primary action
    accentLight: '#6EE7A0',        // Light green for highlights
    accentDim: '#1A7A43',          // Dimmed green for subtle accents
    teal: '#14B8A6',               // Teal for GPS/recording
    coral: '#E8725C',              // Warm coral for warnings/distance
    amber: '#D4915E',              // Amber for elevation
    trailEasy: '#2ECC71',          // Green
    trailModerate: '#EAB308',      // Yellow
    trailHard: '#F97316',          // Orange
    trailExpert: '#EF4444',        // Red
    mapOverlay: 'rgba(10, 15, 13, 0.85)',  // Semi-transparent dark for map overlays
    border: '#1E2E25',             // Subtle forest border
    danger: '#EF4444',             // Delete actions
    gpsActive: '#2ECC71',          // GPS recording indicator
    gpsInactive: '#5A7264',        // GPS off
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 8, md: 12, lg: 16, xl: 24 },
  typography: {
    heading: { fontFamily: 'Inter', fontSize: 24, fontWeight: '700' },
    subheading: { fontFamily: 'Inter', fontSize: 18, fontWeight: '600' },
    body: { fontFamily: 'Inter', fontSize: 16, fontWeight: '400', lineHeight: 24 },
    stat: { fontFamily: 'Inter', fontSize: 36, fontWeight: '700' },
    statUnit: { fontFamily: 'Inter', fontSize: 14, fontWeight: '500' },
    caption: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500' },
    label: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
    mapLabel: { fontFamily: 'Inter', fontSize: 11, fontWeight: '600' },
    distance: { fontFamily: 'Inter', fontSize: 48, fontWeight: '700' },  // Big distance during recording
  }
};
```

### Navigation (Bottom Tabs)

| Tab | Icon | Screen |
|-----|------|--------|
| Explore | Map pin | Map explore with trail markers |
| Search | Magnifying glass | Trail search with filters |
| Record | Circle (pulsing when active) | GPS recording screen |
| Saved | Bookmark | Favorites, lists, past recordings |
| Settings | Gear | Preferences, downloads, about |

### Screen Flows

#### 1. First Launch / Onboarding
1. Welcome screen: "Explore trails. No tracking." App name, mountain illustration.
2. Trail data: "Downloading trail database for your area. This is the only large download MyTrails needs." Progress bar showing region + size.
3. Location permission: "MyTrails uses GPS ONLY when you're recording a hike. We never track your location in the background." Request foreground-only permission.
4. Done: "Start exploring." Arrow to map.

#### 2. Explore Screen (Map Home)
- **Full-screen map** with trail markers (colored dots by difficulty: green/yellow/orange/red)
- **Search bar** at top (floating over map): "Search trails..."
- **Layer toggle** (top-right): Outdoor / Topo / Satellite
- **Current location button** (bottom-right): Center on user location (one-time, no tracking)
- **Record button** (bottom-center, large): "Start Recording" — prominent but not intrusive
- **Downloaded region indicators**: Dashed border overlay showing cached areas
- **Tap a trail marker** → bottom sheet with trail preview (name, distance, elevation gain, difficulty badge, "View Trail" button)

#### 3. Trail Detail Screen
- **Header:** Back arrow, trail name, favorite (bookmark) button, share (GPX export)
- **Hero section:** Elevation profile chart (interactive — scrub to see position on map)
- **Stats row:** Distance | Elevation Gain | Est. Time | Difficulty badge
- **Map preview:** Small map showing trail route with start/end markers. Tap to expand full-screen.
- **Description:** Trail description text from OSM/user notes
- **Details grid:**
  - Route type: Loop / Out & Back / Point to Point
  - Surface: Dirt / Gravel / Paved / Rock
  - Dog-friendly: Yes / No / Leash required
  - Kid-friendly: Yes / No
- **Your notes:** Personal notes section (editable). "Parking tip: arrive before 8am on weekends."
- **Recordings:** List of your past recordings on this trail (date, time, distance, pace)
- **Action buttons:** "Navigate to Trailhead" (opens Apple/Google Maps) | "Start Recording on This Trail"

#### 4. Recording Screen (Active Hike)
- **Full-screen map** with live GPS track drawn in teal
- **Floating stats panel** (bottom, collapsible):
  - **Distance:** Large number (e.g., "4.7 mi")
  - **Elapsed Time:** "1:23:45"
  - **Elevation Gain:** "+1,240 ft"
  - **Current Elevation:** "3,450 ft"
  - **Pace:** "22:15 min/mi"
- **GPS accuracy indicator** (top bar): Green dot + "GPS: 3m accuracy"
- **Pause/Resume button** (large, center-bottom)
- **Stop button** (smaller, to the side): Long-press to stop (prevents accidental taps)
- **Live elevation profile** building in real-time at the bottom of the screen
- **Battery-saver mode:** Reduce GPS polling from 1s to 5s intervals. Toggle in recording settings.

#### 5. Recording Complete Screen
- **Summary card:**
  - Trail name (auto-detected or "Free Hike")
  - Date
  - Distance, elevation gain/loss, elapsed time, moving time
  - Average pace, max speed
  - Map thumbnail with track
- **Elevation profile:** Full chart with gain/loss annotated
- **Name field:** Editable recording name (default: trail name + date)
- **Notes field:** Add personal notes about the hike
- **Actions:** Save | Export GPX | Delete

#### 6. Search Screen
- **Search input:** With autocomplete from local trail database
- **Filter chips:** Difficulty (Easy/Moderate/Hard/Expert), Distance range, Elevation range, Dog-friendly, Kid-friendly, Route type
- **Sort options:** Distance from me | Popularity | Alphabetical | Elevation gain
- **Results list:** Trail cards showing name, distance, elevation gain, difficulty badge, location, offline badge (if cached)

#### 7. Saved Screen
- **Tabs:** Favorites | Recordings | Lists
- **Favorites tab:** List of bookmarked trails with stats
- **Recordings tab:** Chronological list of past recordings with stats and map thumbnail
- **Lists tab:** User-created lists ("Bucket List", "Dog-Friendly Weekend Hikes"). Tap to view trails in list.

#### 8. Settings Screen
- **Units:** Imperial (mi, ft) / Metric (km, m)
- **Map layer default:** Outdoor / Topo / Satellite
- **GPS settings:** Polling interval (1s / 3s / 5s), auto-pause when stationary
- **Downloads:** List of downloaded regions with size. "Download new region" button. "Delete" per region.
- **Storage:** Total storage used (tiles + trail data + recordings). Per-category breakdown.
- **Trail database:** "Check for updates" button. Shows last update date.
- **About:** Version, license (FSL), source code link, privacy statement
- **Data:** "Export all recordings" (GPX zip), "Erase all data" (danger zone)

---

## Monetization

### Pricing Model
- **$4.99 one-time purchase** — Full app, all features, forever
- No free tier, no trial, no subscriptions, no ads
- Same price point as other My* apps, keeping the family consistent

### Revenue Projections (Conservative)

| Metric | Month 1 | Month 6 | Year 1 | Year 2 |
|--------|---------|---------|--------|--------|
| Downloads | 3,000 | 8,000/mo | 60,000 | 180,000 |
| Revenue (gross) | $14,970 | $39,920/mo | $299,400 | $898,200 |
| Apple/Google cut (30%→15%) | $4,491 | $11,976/mo | $74,850 | $134,730 |
| Net revenue | $10,479 | $27,944/mo | $224,550 | $763,470 |

### Why $4.99 Works
- AllTrails users already pay $36-80/yr. MyTrails pays for itself in the first month vs AllTrails.
- The "AllTrails too expensive" search trend provides a built-in audience primed to buy.
- One-time pricing generates powerful word-of-mouth in hiking communities: "I replaced my $80/yr AllTrails with a $5 app."
- Map tile hosting has minimal ongoing cost when tiles are cached locally (users download once).
- Trail data from OpenStreetMap is free. Elevation data from SRTM is free. The only cost is tile rendering and CDN for initial downloads.

### Cost Structure
- **Tile CDN:** ~$0.10-0.50 per user for initial region downloads (Cloudflare R2 egress)
- **Trail data processing:** One-time compute cost, amortized across all users
- **App Store fees:** 30% (year 1), 15% (year 2+, Small Business Program)
- **No ongoing per-user costs** after initial download

---

## Marketing Angle

### Tagline
**"Hike without being tracked."**

### Positioning Statement
MyTrails is for hikers who want a reliable trail guide and GPS recorder without paying an annual subscription or giving away their location data. One-time purchase. Offline maps. No tracking.

### Launch Channels

| Channel | Approach | Expected Impact |
|---------|----------|----------------|
| **r/hiking** (5M+) | "I built an AllTrails alternative for $4.99 with no tracking" — founder story | Very high — AllTrails frustration is a recurring theme |
| **r/CampingandHiking** (3.5M+) | "Offline trail maps that actually work offline" — demo video of backcountry use | High — reliability resonates with backpackers |
| **r/ultralight** (400K+) | Technical deep-dive on GPS accuracy, battery optimization | Medium — niche but passionate and vocal |
| **r/privacy** (1.8M) | "AllTrails tracks you even when you're not hiking. MyTrails doesn't." | High — AllTrails privacy concerns are well-documented |
| **AllTrails 1-star reviews** | Target users who left negative reviews about pricing/privacy — app store ASO | Medium — capture switching intent |
| **Product Hunt** | "AllTrails costs $80/yr. MyTrails costs $4.99 once." | High — price comparison is PH gold |
| **Hacker News** | "Show HN: Offline hiking maps built on OpenStreetMap with zero tracking" | High — open data + privacy angle |
| **Hiking YouTube/TikTok** | Partner with outdoor content creators for trail recording demos | High — visual medium, perfect for map/GPS demos |
| **Local hiking groups** | Facebook groups, Meetup groups for local hiking communities | Medium — grassroots, high-trust recommendations |

### Content Marketing
- Blog post: "Why AllTrails tracks you in the background (and how to stop it)"
- Blog post: "How MyTrails works offline: a technical deep-dive"
- Blog post: "AllTrails vs MyTrails: an honest comparison"
- Blog post: "The best free trail data sources for hikers (and how we use them)"
- Comparison page: AllTrails vs Gaia GPS vs Komoot vs MyTrails (feature matrix + pricing)

---

## MVP Timeline (Week-by-Week)

### Week 1: Foundation
- [ ] Initialize Turborepo monorepo with pnpm
- [ ] Set up Expo app with file-based routing
- [ ] Set up Next.js 15 web app
- [ ] Configure shared TypeScript config, ESLint, Prettier
- [ ] Implement SQLite schema with trail and recording tables
- [ ] Write migration system
- [ ] Set up MapLibre GL (web) and react-native-maps (mobile) with basic tile rendering

### Week 2: Trail Data & Maps
- [ ] Build OpenStreetMap Overpass API trail importer
- [ ] Seed California trail database (~5,000 trails)
- [ ] Compute elevation profiles from SRTM data
- [ ] Implement tile caching system (download to SQLite blobs)
- [ ] Build region download UI (select area, show size estimate, download progress)
- [ ] Implement FTS5 trail search
- [ ] Display trail markers on map (difficulty-colored dots)

### Week 3: Trail Discovery
- [ ] Build Explore screen with full-screen map and trail markers
- [ ] Build trail detail bottom sheet (tap marker → preview)
- [ ] Build Trail Detail screen with elevation profile, stats, description
- [ ] Build Search screen with filters (difficulty, distance, elevation, features)
- [ ] Implement favorites system with custom lists
- [ ] Build Saved screen (favorites, lists)

### Week 4: GPS Recording
- [ ] Implement GPS recording engine (foreground-only, configurable polling interval)
- [ ] Build Recording screen with live map track and stats overlay
- [ ] Implement real-time elevation profile during recording
- [ ] Build pause/resume/stop controls
- [ ] Compute post-recording stats (distance, gain, moving time, pace)
- [ ] Build Recording Complete screen with summary and save flow

### Week 5: Export & Polish
- [ ] Implement GPX export (single recording, batch export)
- [ ] Build recording history view (list with map thumbnails)
- [ ] Implement trail notes (personal annotations)
- [ ] Build Settings screen (units, GPS config, storage management)
- [ ] Add trailhead navigation (deep link to Apple/Google Maps)
- [ ] Offline indicator badges on cached trails and regions

### Week 6: Polish & Launch
- [ ] Dark theme refinement (forest tones, high-contrast for outdoor use)
- [ ] Onboarding flow (trail download, location permission, walkthrough)
- [ ] App icon and splash screen design
- [ ] App Store screenshots and description (include offline maps, GPS recording, privacy)
- [ ] Battery optimization testing (GPS recording for 4+ hours)
- [ ] Privacy policy page ("We collect no location data. Your hikes stay on your device.")
- [ ] Beta testing (TestFlight + internal testing on real trails)
- [ ] Submit to App Store and Google Play
- [ ] Prepare Product Hunt and Reddit launch posts

---

## Acceptance Criteria

### Must pass before launch:
1. **Offline maps work:** Download a region, enable airplane mode, verify map renders with full zoom and pan.
2. **GPS recording accuracy:** Record a known trail (measured distance). MyTrails distance within 5% of actual.
3. **Battery life:** GPS recording for 4 hours consumes less than 25% battery on iPhone 14+.
4. **Trail search:** FTS5 search returns relevant results for trail names, regions, and partial matches.
5. **GPX export:** Exported GPX files are valid and load correctly in Google Earth, Gaia GPS, and Strava.
6. **Elevation profile accuracy:** Elevation profiles match SRTM data within 10m for well-known trails.
7. **Privacy verification:** Confirmed no background location requests in iOS Settings. No network traffic when airplane mode is off and the user isn't downloading.
8. **Trail database completeness:** At least 3,000 California trails seeded with valid geometry and elevation data.
9. **Performance:** Map renders at 60fps with 500+ visible trail markers. Trail list scrolls smoothly with 5,000+ entries.
10. **Storage management:** Users can view storage usage by category and delete individual downloaded regions.

### Quality gates:
- Zero crashes during 6-hour recording test
- GPS track renders correctly after app restart mid-recording (resume after kill)
- Accessibility: VoiceOver/TalkBack can navigate all screens and announce stats during recording
- High-contrast mode: all text readable in direct sunlight
- Supports iOS 16+, Android 10+, Chrome/Safari/Firefox (latest 2 versions)
