# Feature Spec: MyTrails Full Mobile UI

## Metadata
- **Module:** trails
- **Task:** M11-1
- **Sprint:** Module UI Build-Out
- **Estimated CC Time:** 6-8 hours
- **Depends On:** All 11 existing trails feature specs (offline maps, wrong-turn alerts, weather, difficulty, segments, navigation, packing, trips, trail database, route planning, reviews) provide the engine and CRUD layer. This spec designs the screens that surface them.
- **Blocks:** Trails web UI, QA pass, design review

## Business Context

### Why This Feature Exists
MyTrails has the deepest engine layer of any MyLife module: 17 SQLite tables across 10 schema versions, 8 computation engines (geo, deviation detection, route geofence, difficulty scoring, turn-by-turn navigation, weather formatting, segment matching, tile management), and 100+ exported functions. But it has exactly 1 mobile screen: a placeholder dashboard with 4 stat cards and a "No trail recordings yet" empty state. Zero users can actually use any of this functionality until a real UI exists.

AllTrails (20M+ users, $27-54/yr) and Komoot (35M+ users, $29.99) prove the market for trail apps. MyTrails differentiates on privacy (all data local, no location uploads) and integration (trip planning links to packing lists, recordings link to segments and reviews, offline maps cover the full experience).

### Target User
Day hikers and weekend backpackers who currently use AllTrails or Komoot but are uncomfortable with location data being uploaded to servers. Privacy-conscious outdoor enthusiasts who want a fully offline trail companion that also integrates with their broader personal data (budget for gear, books for trail guides, meds for altitude medication).

## Navigation Architecture

### Tab Bar (4 tabs + gear icon)

Four tabs for the core user tasks. Settings moves to a gear icon in the Explore tab header, pushing to individual screens for offline maps, alert config, and unit preferences.

```
Tab Bar
 ├── 🗺️ Explore     (search-first + map + trail database)
 ├── ⏺️ Record      (GPS recording + active navigation)
 ├── 🥾 My Trails   (saved trails, recordings, segments)
 └── 📋 Plan        (trips, packing, route builder)

Gear icon (⚙️) in Explore header:
 ├── Offline Maps → offline-regions.tsx
 ├── Alert Settings → alert-settings.tsx
 ├── Units (km/mi, m/ft)
 ├── Map Style
 ├── GPX Import/Export
 └── Clear Weather Cache
```

### Implementation Phases

**Phase 1 (no map dependency):** 12 screens that work without expo-location or map libraries.
**Phase 2 (after map infra):** 5 map-dependent screens added after expo-location + Mapbox/MapLibre installation.

### Full Screen Inventory

```
(trails)/
├── _layout.tsx              # Tabs layout with 4 tabs + TrailRecordingContext
├── index.tsx                # Explore tab (Phase 1: placeholder, Phase 2: search-first + map)
├── record.tsx               # Record tab (Phase 1: placeholder, Phase 2: GPS recorder)
├── my-trails.tsx            # My Trails tab (list rows, not cards)
├── plan.tsx                 # Plan tab (trip timeline)
├── trail/[id].tsx           # Trail detail (collapsible accordion sections)
├── recording/[id].tsx       # Recording detail (push screen)
├── segment/[id].tsx         # Segment leaderboard (push screen)
├── trip/[id].tsx            # Trip detail (push screen)
├── trip/new.tsx             # Create/edit trip (push screen)
├── packing/[id].tsx         # Packing checklist (push screen)
├── route-builder.tsx        # Route builder (Phase 2: map interaction)
├── write-review.tsx         # Write review (push screen)
├── offline-regions.tsx      # Offline region manager (push screen, from gear menu)
├── alert-settings.tsx       # Wrong-turn alert config (push screen, from gear menu)
└── discover.tsx             # Trail database search (push screen)
```

**Total: 4 tab screens + 12 push screens = 16 screens**

## Screen-by-Screen Specification

---

### Screen 1: Explore Tab (`index.tsx`)

**Purpose:** Primary entry point. Full-screen map with trail pins and a pull-up search drawer.

**Layout:**
```
┌─────────────────────────────────┐
│         [Map View]              │
│    (full screen, topographic)   │
│                                 │
│      📍  📍     📍              │
│          📍        📍           │
│    📍         📍                │
│              📍                 │
│                                 │
│  ┌───────────────────────────┐  │
│  │  🔍 Search trails...      │  │
│  │  [Activity Filter Pills]  │  │
│  │  [Difficulty Filter Pills]│  │
│  └───────────────────────────┘  │
│                                 │
│  ┌ Pull-Up Drawer ────────────┐ │
│  │ Nearby Trails              │ │
│  │ ┌─────────────────────────┐│ │
│  │ │ Trail Name    ★ 4.2     ││ │
│  │ │ 3.2 km  |  245m  | Mod ││ │
│  │ └─────────────────────────┘│ │
│  │ ┌─────────────────────────┐│ │
│  │ │ Trail Name    ★ 4.8     ││ │
│  │ │ 8.1 km  |  612m  | Hard││ │
│  │ └─────────────────────────┘│ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

**Data Flow:**
- `getTrails(db)` filtered by `isSaved: true` populates pins on map
- `searchDatabaseTrails(db, query)` for search bar results
- `getDatabaseEntries(db)` for "nearby trails" based on current map viewport
- `getCachedWeather(db, lat, lng)` for weather badge overlay on map

**Components:**
- `TrailMap`: Mapbox/MapLibre full-screen view. Displays saved trail pins (green `#65A30D` accent) and database trail pins (dimmed). Tap a pin to open trail detail.
- `SearchDrawer`: Bottom sheet with search input, activity filter pills (`hike | run | bike | walk`), difficulty filter pills (`easy | moderate | hard | expert`). Results update as user types (300ms debounce).
- `TrailListCard`: Compact card showing trail name, star rating (from reviews), distance, elevation gain, difficulty badge. Tap navigates to `trail/[id]`.
- `WeatherBadge`: Small overlay top-right showing current temp and weather icon from cached weather data. Tap opens weather detail bottom sheet.

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Map skeleton with shimmer overlay |
| Empty | Map centered on user location, "No saved trails yet. Search or record your first trail." prompt |
| Success | Map with trail pins, nearby trails in drawer |
| Error | Map loads but "Could not load trail data" toast |
| No Location | Map centered on California default, "Enable location for nearby trails" banner |

**Cool Obsidian Notes:**
- Map uses dark style tiles (Mapbox dark-v11 or equivalent)
- Search drawer: `backgroundColor: colors.surface`, `glassBorder` on top edge
- Filter pills: `backgroundColor: colors.glass`, selected state uses `#65A30D` background with white text
- Difficulty badges: color-coded via `difficultyColor()` engine (green/yellow/orange/red)

---

### Screen 2: Record Tab (`record.tsx`)

**Purpose:** GPS activity recorder. Start/stop/pause recording with live stats.

**Layout:**
```
┌─────────────────────────────────┐
│         [Live Map]              │
│    (shows GPS track in real     │
│     time as user moves)         │
│                                 │
│     ~~~~ route line ~~~~        │
│            📍 current pos       │
│                                 │
│  ┌── Live Stats Bar ──────────┐ │
│  │  2.4 km  │  156m  │ 8:32  │ │
│  │ distance  │ elev   │ pace  │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Activity Selector ───────┐ │
│  │ 🥾 Hike │ 🏃 Run │ 🚲 Bike│ │
│  └────────────────────────────┘ │
│                                 │
│       ┌──────────────┐          │
│       │  ● RECORD    │          │
│       │  (big button) │          │
│       └──────────────┘          │
│                                 │
│  [📸 Photo]  [📍 Waypoint]     │
│  [⚠️ Nav]    [⏸ Pause]         │
└─────────────────────────────────┘
```

**Data Flow:**
- `expo-location` watchPositionAsync for live GPS tracking
- `createWaypoint()` stores each GPS fix
- `haversineDistance()` + `calculateElevationGain()` for live stats
- `calculatePace()` for pace display
- `DeviationStateMachine` for wrong-turn detection during recording
- `matchSegmentEntry()` / `matchSegmentExit()` for auto-detecting segment efforts

**Recording States:**
| State | What User Sees |
|-------|---------------|
| Idle | Activity selector visible, large "Record" button (green circle with filled center) |
| Recording | Map shows live track, stats update in real time, button changes to "Pause" (two vertical bars) |
| Paused | Stats frozen, "Resume" (green) and "Stop" (red) buttons appear |
| Saving | Loading spinner, "Saving recording..." |
| Deviated | Red deviation banner: "Off trail! 45m from route" with haptic vibration |

**Actions:**
- **Record** button: Creates a new recording via `createRecording()`, starts `watchPositionAsync`
- **Pause** button: Stops location tracking, freezes stats
- **Stop** button: Confirms via modal ("Save recording?"), calls `createRecording()` with final stats
- **Photo** button: Opens camera, saves via device photo library, records location as photo waypoint
- **Waypoint** button: Drops a named pin at current location via `createWaypoint()`
- **Nav** button: Starts turn-by-turn navigation using `generateInstructions()` from a selected trail or route

**Cool Obsidian Notes:**
- Live track line: `#65A30D` (accent) with 3px width, slight glow effect
- Record button: 64px circle, `#65A30D` fill in idle, `#FF453A` fill when recording (danger = active)
- Deviation banner: `backgroundColor: 'rgba(255, 69, 58, 0.15)'`, border `rgba(255, 69, 58, 0.3)`
- Stats bar: `backgroundColor: colors.surfaceElevated`, glass morphism blur

---

### Screen 3: My Trails Tab (`my-trails.tsx`)

**Purpose:** Saved trail library with recordings history.

**Layout:**
```
┌─────────────────────────────────┐
│  My Trails                      │
│  [List │ Map] toggle            │
│                                 │
│  ┌── Stats Summary ───────────┐ │
│  │ 23 trails │ 47 recordings  │ │
│  │ 182 km    │ 12,450m elev   │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Sort/Filter ─────────────┐ │
│  │ Sort: [Recent ▼]           │ │
│  │ Filter: [All ▼] [All ▼]   │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Trail Card ──────────────┐ │
│  │ 🟢 Morning Hike at Muir    │ │
│  │ Moderate | 5.2 km | 320m   │ │
│  │ 3 recordings | ★ 4.5       │ │
│  │ Last: 2 days ago           │ │
│  └────────────────────────────┘ │
│  ┌── Trail Card ──────────────┐ │
│  │ 🟡 Panoramic Trail          │ │
│  │ Hard | 12.8 km | 890m      │ │
│  │ 1 recording | ★ 5.0        │ │
│  │ Last: 1 week ago           │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Recent Recordings ───────┐ │
│  │ 📝 Feb 15 - Muir Woods     │ │
│  │    Hike | 5.2km | 1h 42m   │ │
│  │ 📝 Feb 8 - Panoramic Trail │ │
│  │    Run | 12.8km | 1h 12m   │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

**Data Flow:**
- `getTrails(db)` with filters for saved trails
- `getTrailStats(db)` for aggregate summary
- `getRecordings(db)` for recent recordings section
- `getAverageRating(db, trailId)` for star ratings
- `getRecordingsByTrail(db, trailId)` for per-trail recording counts

**Filters:**
- Sort: Recent (default), Name A-Z, Distance, Elevation, Rating
- Difficulty: All, Easy, Moderate, Hard, Expert
- Activity: All, Hike, Run, Bike, Walk

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton cards with shimmer |
| Empty | Illustration + "No saved trails yet. Explore the map or record a hike to get started." with CTA buttons |
| Success | Stats summary + trail list + recent recordings |
| Filtered Empty | "No trails match your filters" with clear filters button |

---

### Screen 4: Plan Tab (`plan.tsx`)

**Purpose:** Trip planner hub with trips, packing lists, and route builder access.

**Layout:**
```
┌─────────────────────────────────┐
│  Plan                           │
│                                 │
│  ┌── Active Trip ─────────────┐ │
│  │ 🏕️ Yosemite Weekend        │ │
│  │ Mar 15-17 | 3 days          │ │
│  │ 4 activities | 2 hikes      │ │
│  │ Packing: 14/22 items ✓      │ │
│  │ [View Trip →]               │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Quick Actions ──            │
│  [+ New Trip] [+ Packing List]  │
│  [Route Builder]                │
│                                 │
│  ── Upcoming Trips ──           │
│  ┌────────────────────────────┐ │
│  │ 🌲 Big Sur Backpacking     │ │
│  │ Apr 5-8 | 4 days            │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Packing Lists ──            │
│  ┌────────────────────────────┐ │
│  │ 🎒 Day Hike         12 items│ │
│  │ 🏕️ Overnight        22 items│ │
│  │ 🧳 Backpacking      28 items│ │
│  │ ❄️ Winter Hike      21 items│ │
│  │ 🏃 Trail Run        14 items│ │
│  │ [+ Custom List]             │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Planned Routes ──           │
│  ┌────────────────────────────┐ │
│  │ 📍 Half Dome Loop          │ │
│  │ 20.4 km | 1,524m | Loop    │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

**Data Flow:**
- `getTrips(db)` for trips list, sorted by `startDate` (upcoming first)
- `getTripDays(db, tripId)` + `getTripActivities(db, dayId)` for activity counts
- `getPackingTemplates(db)` for packing list section
- `getPackingProgress(db, templateId)` for checked/total counts
- `getPlannedRoutes(db)` for planned routes section

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton sections |
| Empty | "Plan your next adventure" hero with illustration. Three CTA cards: "Create a Trip", "Build a Packing List", "Design a Route" |
| Success | Active/upcoming trips, packing lists, planned routes |

---

### ~~Screen 5: Settings Tab~~ (REMOVED -- settings moved to gear icon in Explore header)

Settings functionality is now accessed via the gear icon (⚙️) in the Explore tab header. Individual settings push to: `offline-regions.tsx` (Screen 13), `alert-settings.tsx` (Screen 14), or inline pickers for units/map style/data export.

---

### Screen 5: Trail Detail (`trail/[id].tsx`)

**Purpose:** Complete view of a single trail with all associated data.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Trail Name                   │
│                                 │
│  ┌── Hero Map ────────────────┐ │
│  │ (trail route on map)       │ │
│  │  with elevation profile    │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Quick Stats ─────────────┐ │
│  │ 🟡 Moderate                │ │
│  │ 8.2 km | 456m elev | ~2h  │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Weather ─────────────────┐ │
│  │ ☀️ 72F | Wind 8 mph NW     │ │
│  │ [H] 68 72 75 73 70 66     │ │
│  │     6a 9a 12p 3p 6p 9p    │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Reviews ─────────────────┐ │
│  │ ★ 4.3 (12 reviews)        │ │
│  │ Recent: "Great views..."   │ │
│  │ Conditions: 🟢 Clear       │ │
│  │ [Write Review] [See All →] │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Segments ────────────────┐ │
│  │ Summit Push    PB: 14:32   │ │
│  │ Ridge Line     PB: 8:15    │ │
│  │ [View All →]               │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Recordings ──────────────┐ │
│  │ Feb 15 - 1h 42m - Hike    │ │
│  │ Jan 28 - 1h 38m - Run     │ │
│  │ [View All →]               │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Photos ──────────────────┐ │
│  │ [photo] [photo] [photo]    │ │
│  │ (horizontal scroll)        │ │
│  └────────────────────────────┘ │
│                                 │
│  [🎯 Navigate] [📝 Record]     │
│  [✏️ Edit] [🗑️ Delete]          │
└─────────────────────────────────┘
```

**Data Flow:**
- `getTrail(db, id)` for trail metadata
- `getCachedWeather(db, trail.lat, trail.lng)` for weather section
- `getAverageRating(db, id)` + `getReviewsByTrail(db, id)` + `getRecentConditions(db, id)` for reviews
- `getSegmentsByTrail(db, id)` + `getPersonalBest(db, segmentId)` for segments
- `getRecordingsByTrail(db, id)` for recordings
- `calculateDifficulty()` for difficulty badge coloring
- `weatherIcon()` + `formatTemperature()` + `formatWindSpeed()` for weather display

---

### Screen 7: Recording Detail (`recording/[id].tsx`)

**Purpose:** View a completed recording with map trace, elevation profile, and stats.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Recording Name               │
│                                 │
│  ┌── Route Map ───────────────┐ │
│  │ (recorded GPS trace on map)│ │
│  │ start 🟢 ~~~~~~~ 🔴 end   │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Stats Grid ──────────────┐ │
│  │ Distance │ Elevation │ Time │ │
│  │ 5.2 km   │ 320m     │1:42  │ │
│  │ Pace     │ Calories  │ Type │ │
│  │ 9:15/km  │ 412 cal   │ Hike │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Elevation Profile ───────┐ │
│  │ ┌──╲    ╱──╲              │ │
│  │ │   ╲  ╱    ╲──╱──       │ │
│  │ └─────────────────────    │ │
│  │ 0km        2.6km   5.2km │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Segment Efforts ─────────┐ │
│  │ Summit Push: 14:32 (PB!)  │ │
│  │ Ridge Line: 9:05           │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Waypoints ───────────────┐ │
│  │ 📍 Trailhead    0.0 km    │ │
│  │ 📍 Viewpoint    1.8 km    │ │
│  │ 📍 Summit       3.4 km    │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Deviation Events ────────┐ │
│  │ ⚠️ 2:14 PM - 45m off trail│ │
│  │    (acknowledged)          │ │
│  └────────────────────────────┘ │
│                                 │
│  [📝 Write Review] [📤 Export] │
└─────────────────────────────────┘
```

**Data Flow:**
- `getRecording(db, id)` for recording metadata
- `getWaypointsByRecording(db, id)` for GPS trace + waypoint list
- `calculateElevationGain()` + `calculatePace()` + `estimateCalories()` for computed stats
- `getEffortsBySegment(db, segmentId)` for segment efforts linked to this recording
- `getDeviationsByRecording(db, id)` for deviation events

---

### Screen 8: Segment Leaderboard (`segment/[id].tsx`)

**Purpose:** View all efforts for a trail segment with personal best tracking.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Segment Name                 │
│                                 │
│  ┌── Segment Info ────────────┐ │
│  │ [mini map: start → end]    │ │
│  │ 1.2 km | 180m elev gain    │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Personal Best ───────────┐ │
│  │ 🏆 14:32                    │ │
│  │ Feb 15, 2026 | 11:47/km    │ │
│  └────────────────────────────┘ │
│                                 │
│  ── All Efforts ──              │
│  ┌────────────────────────────┐ │
│  │ #1 🏆 14:32  Feb 15  PB   │ │
│  │ #2    15:01  Jan 28        │ │
│  │ #3    16:45  Jan 12        │ │
│  │ #4    17:20  Dec 30        │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Progress Chart ──────────┐ │
│  │  17:20                     │ │
│  │  ●                         │ │
│  │  16:45  ●                  │ │
│  │  15:01      ●              │ │
│  │  14:32          ●          │ │
│  │  Dec   Jan    Feb          │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

**Data Flow:**
- `getSegmentsByTrail(db, trailId)` to get segment metadata
- `getEffortsBySegment(db, segmentId)` for all efforts sorted by duration
- `getPersonalBest(db, segmentId)` for PB display
- `calculatePace()` for pace on each effort

---

### Screen 9: Trip Detail (`trip/[id].tsx`)

**Purpose:** Day-by-day trip itinerary with linked trails and packing list.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Trip Name                    │
│  Mar 15-17, 2026                │
│                                 │
│  ┌── Packing Status ──────────┐ │
│  │ 🎒 Overnight: 18/22 ✓     │ │
│  │ [View Checklist →]         │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Day 1: Arrival ──           │
│  ┌────────────────────────────┐ │
│  │ 🚗 Drive to Yosemite  3h  │ │
│  │ 🥾 Valley Floor Loop       │ │
│  │    Easy | 3.2km | 45m elev │ │
│  │ 🏕️ Camp setup at site #42  │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Day 2: Summit Day ──        │
│  ┌────────────────────────────┐ │
│  │ 🥾 Half Dome via JMT       │ │
│  │    Expert | 20.4km | 1524m │ │
│  │ 😴 Rest and recover        │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Day 3: Departure ──         │
│  ┌────────────────────────────┐ │
│  │ 🥾 Mirror Lake Loop        │ │
│  │    Easy | 4.8km | 60m elev │ │
│  │ 🚗 Drive home              │ │
│  └────────────────────────────┘ │
│                                 │
│  [Edit Trip] [+ Add Day]       │
└─────────────────────────────────┘
```

**Data Flow:**
- `getTrip(db, id)` for trip metadata
- `getTripDays(db, tripId)` for day breakdown
- `getTripActivities(db, dayId)` for activities per day
- `getTrail(db, activity.trailId)` for linked trail details
- `getPackingProgress(db, trip.packingTemplateId)` for packing status

---

### Screen 10: Packing Checklist (`packing/[id].tsx`)

**Purpose:** Interactive checklist for a packing template with progress tracking.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Day Hike Checklist           │
│  12/17 packed                   │
│  ┌── Progress Bar ────────────┐ │
│  │ ████████████░░░░░ 71%      │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Essentials ──               │
│  ☑ Backpack                     │
│  ☑ Phone (charged)              │
│  ☐ ID / park pass               │
│  ☑ Sunscreen                    │
│  ☑ Sunglasses                   │
│                                 │
│  ── Clothing ──                 │
│  ☑ Hiking boots                 │
│  ☑ Moisture-wicking shirt       │
│  ☐ Light jacket                 │
│  ☑ Hat                          │
│                                 │
│  ── Food & Water ──             │
│  ☑ Water (2L)                   │
│  ☐ Snacks / trail mix           │
│  ☐ Lunch                        │
│                                 │
│  ── Navigation ──               │
│  ☑ Trail map                    │
│  ☐ Compass                      │
│                                 │
│  ── Safety ──                   │
│  ☑ First aid kit                │
│  ☑ Whistle                      │
│  ☑ Headlamp                     │
│                                 │
│  [+ Add Item] [Reset All]       │
└─────────────────────────────────┘
```

**Data Flow:**
- `getPackingTemplate(db, id)` for template name and type
- `getPackingItems(db, id)` for items grouped by category
- `checkItem(db, itemId)` / `uncheckItem(db, itemId)` on tap
- `uncheckAll(db, templateId)` for reset
- `createPackingItem(db, input)` for adding custom items
- `getPackingProgress(db, templateId)` for progress bar

**Interactions:**
- Tap item to toggle check/uncheck with haptic feedback
- Swipe left on item to reveal delete button
- Long-press to reorder within category
- "+ Add Item" opens inline input row at bottom of current section

---

### Screen 11: Route Builder (`route-builder.tsx`)

**Purpose:** Draw a route on the map by dropping waypoints, with distance/elevation calculation.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Route Builder                │
│                                 │
│  ┌── Map ─────────────────────┐ │
│  │                            │ │
│  │  📍───📍───📍───📍         │ │
│  │     (tap to add waypoints) │ │
│  │                            │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌── Route Stats ─────────────┐ │
│  │ 8.4 km | 320m elev | ~2h  │ │
│  │ [Loop] [Out & Back]       │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Waypoints ──                │
│  ┌────────────────────────────┐ │
│  │ 1. Start Point             │ │
│  │ 2. Ridge Junction     ✏️   │ │
│  │ 3. Summit             ✏️   │ │
│  │ 4. Return via Creek   ✏️   │ │
│  └────────────────────────────┘ │
│                                 │
│  [Save Route] [Clear]          │
└─────────────────────────────────┘
```

**Data Flow:**
- `createPlannedRoute(db, input)` on save
- `createRouteWaypoint(db, input)` for each waypoint
- `haversineDistance()` for cumulative distance between waypoints
- Route geometry stored as GeoJSON string in `routeGeometry`
- `estimateRegionSizeBytes()` for offline map estimate if saving

---

### Screen 12: Write Review (`write-review.tsx`)

**Purpose:** Submit a review for a trail after recording or from trail detail.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Write Review                 │
│                                 │
│  Trail: Panoramic Trail         │
│                                 │
│  ── Rating ──                   │
│  ☆ ☆ ☆ ☆ ☆  (tap to rate)      │
│                                 │
│  ── Title (optional) ──         │
│  ┌────────────────────────────┐ │
│  │ Great summit views!         │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Review ──                   │
│  ┌────────────────────────────┐ │
│  │ The trail was in excellent  │ │
│  │ condition. Clear paths,     │ │
│  │ well-marked turns...        │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Trail Conditions ──         │
│  [Clear] [Well Maintained]      │
│  [Muddy] [Snowy] [Icy]         │
│  [Buggy] [Crowded] [Overgrown] │
│                                 │
│  ── Visit Date ──               │
│  [Feb 15, 2026]                 │
│                                 │
│  [Submit Review]                │
└─────────────────────────────────┘
```

**Data Flow:**
- `createReview(db, input)` on submit
- Condition pills map to `TrailCondition` enum values
- `visitedAt` pre-populated from recording date if linked to a recording
- `recordingId` auto-linked if navigated from recording detail

---

### Screen 13: Offline Region Manager (`offline-regions.tsx`)

**Purpose:** Download and manage offline map regions from the California catalog.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Offline Maps                 │
│                                 │
│  ┌── Storage ─────────────────┐ │
│  │ 485 MB / device storage    │ │
│  │ 3 regions downloaded       │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Downloaded ──               │
│  ┌────────────────────────────┐ │
│  │ ✅ Muir Woods & Mt Tam     │ │
│  │    45 MB | Ready            │ │
│  │ ✅ Yosemite National Park  │ │
│  │    210 MB | Ready           │ │
│  │ ⚠️ Point Reyes             │ │
│  │    75 MB | Stale (30d old) │ │
│  └────────────────────────────┘ │
│                                 │
│  ── National Parks ──           │
│  ┌────────────────────────────┐ │
│  │ Joshua Tree NP    ~190 MB  │ │
│  │ [Download]                  │ │
│  │ Death Valley NP   ~240 MB  │ │
│  │ [Download]                  │ │
│  │ Sequoia & Kings   ~175 MB  │ │
│  │ [Download]                  │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Coastal ──                  │
│  ── Bay Area ──                 │
│  ── Sierra Nevada ──            │
│                                 │
│  (catalog entries grouped by    │
│   area from REGION_CATALOG)     │
└─────────────────────────────────┘
```

**Data Flow:**
- `getOfflineRegions(db)` for downloaded regions and their status
- `getReadyRegions(db)` / `getStaleRegions(db)` for status filtering
- `getCatalogByArea()` for available regions grouped by geographic area
- `estimateRegionTileCount()` + `estimateRegionSizeBytes()` + `formatBytes()` for size estimates
- `createOfflineRegion(db, input)` to start download
- `updateRegionProgress(db, id, progress)` during download
- `markRegionReady(db, id)` on completion
- `deleteOfflineRegion(db, id)` to remove
- `totalStorageBytes()` + `isLowStorage()` for storage warnings

---

### Screen 14: Alert Settings (`alert-settings.tsx`)

**Purpose:** Configure wrong-turn deviation alerts.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Alert Settings               │
│                                 │
│  ── Deviation Threshold ──      │
│  [15m] [30m] [50m] [100m]      │
│  "Alert when you're 30m         │
│   off the trail route"          │
│                                 │
│  ── Cooldown ──                 │
│  [30s] [60s] [120s] [300s]     │
│  "Minimum time between alerts"  │
│                                 │
│  ── Alerts ──                   │
│  Vibration              [ON]    │
│  Sound                  [OFF]   │
│  Auto-pause on deviation [OFF]  │
│                                 │
│  [Save Settings]                │
└─────────────────────────────────┘
```

**Data Flow:**
- `getAlertSettings(db)` to load current settings
- `updateAlertSettings(db, input)` on save

---

### Screen 15: Discover Trails (`discover.tsx`)

**Purpose:** Search the trail database for trails to save to My Trails.

**Layout:**
```
┌─────────────────────────────────┐
│  ← Discover Trails              │
│                                 │
│  ┌── Search ──────────────────┐ │
│  │ 🔍 Search by name, region..│ │
│  └────────────────────────────┘ │
│                                 │
│  [Hiking] [Cycling] [Running]   │
│  [Multi-use]                    │
│                                 │
│  ── Results ──                  │
│  ┌────────────────────────────┐ │
│  │ Dipsea Trail               │ │
│  │ Hiking | 11.3km | Marin    │ │
│  │ Moderate                    │ │
│  │ Source: OSM                 │ │
│  │ [Save to My Trails]        │ │
│  └────────────────────────────┘ │
│  ┌────────────────────────────┐ │
│  │ Tennessee Valley Trail     │ │
│  │ Multi-use | 5.4km | Marin  │ │
│  │ Easy                        │ │
│  │ Source: OSM                 │ │
│  │ [Save to My Trails]        │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

**Data Flow:**
- `searchDatabaseTrails(db, query)` for text search
- `getDatabaseEntries(db)` filtered by `trailType`
- `saveDatabaseTrailToMyTrails(db, entryId)` to copy a database trail into the user's saved trails
- `calculateDifficulty()` for difficulty badge on entries that have distance/elevation data

---

### Screen 16: Trip Create/Edit (`trip/new.tsx`)

**Purpose:** Create or edit a trip with days and activities.

**Layout:**
```
┌─────────────────────────────────┐
│  ← New Trip                     │
│                                 │
│  ── Trip Name ──                │
│  ┌────────────────────────────┐ │
│  │ Yosemite Weekend            │ │
│  └────────────────────────────┘ │
│                                 │
│  ── Dates ──                    │
│  Start: [Mar 15, 2026]         │
│  End:   [Mar 17, 2026]         │
│                                 │
│  ── Packing List ──             │
│  [None] [Day Hike] [Overnight]  │
│  [Backpacking] [Winter] [Run]   │
│                                 │
│  ── Notes ──                    │
│  ┌────────────────────────────┐ │
│  │ Permits reserved at...      │ │
│  └────────────────────────────┘ │
│                                 │
│  [Create Trip]                  │
└─────────────────────────────────┘
```

**Data Flow:**
- `createTrip(db, input)` on submit
- `createTripDay(db, input)` auto-generates days based on date range
- Trip links to a packing template via `packingTemplateId`

---

## Cross-Module Integration Points

| Integration | From | To | Mechanism |
|------------|------|-----|-----------|
| Gear budget | Trail packing lists | Budget module | Cross-module search: "hiking boots" in budget transactions |
| Trail guides | Trail detail | Books module | Cross-module search: book recommendations by trail region |
| Altitude meds | Trip planner | Meds module | Cross-module search: medication schedule for high-altitude trips |
| Activity stats | Recording completion | Health module | Health dashboard can show trail activity alongside steps/HR |
| Weather | Trail detail | (external API) | Weather cache populated via Open-Meteo API, displayed on trail detail |

## Shared Component Library

These components are reused across multiple screens:

| Component | Used By | Description |
|-----------|---------|-------------|
| `TrailMap` | Explore, Trail Detail, Recording Detail, Route Builder, Segment | Mapbox/MapLibre map with dark tiles, pin rendering, route traces |
| `TrailListCard` | Explore, My Trails, Discover | Compact card: name, difficulty badge, distance/elev, rating |
| `DifficultyBadge` | Everywhere trails are listed | Color-coded pill using `difficultyColor()` engine |
| `ElevationProfile` | Trail Detail, Recording Detail | SVG line chart of elevation vs distance |
| `WeatherCard` | Trail Detail, Explore | Current conditions + hourly forecast strip |
| `StatGrid` | My Trails, Recording Detail, Trail Detail | 2x2 or 3x2 grid of metric cards |
| `PackingProgressBar` | Plan tab, Trip Detail, Packing Checklist | Horizontal bar with checked/total count |
| `SegmentEffortRow` | Segment Leaderboard, Recording Detail | Single effort row with rank, time, date, PB badge |

## Cool Obsidian Styling Guide

### Map Theming
- Dark map tiles (Mapbox dark-v11 or MapLibre dark basemap)
- Trail route lines: `#65A30D` (module accent) with 3px stroke
- GPS trace playback: gradient from green (start) to red (end)
- Saved trail pins: `#65A30D` filled circle with white border
- Database trail pins: `rgba(101, 163, 13, 0.4)` (dimmed accent)

### Cards and Surfaces
- All cards: `backgroundColor: colors.surface` (`#12121A`), `borderColor: colors.glassBorder`
- Elevated cards (stats summary): `backgroundColor: colors.surfaceElevated` (`#1A1A24`)
- Glass morphism on overlays: `expo-blur` BlurView with `intensity={40}` on iOS

### Difficulty Color System
- Easy: `#30D158` (iOS green)
- Moderate: `#FFD60A` (iOS yellow)
- Hard: `#FF9F0A` (iOS orange)
- Expert: `#FF453A` (iOS red)

### Interactive Elements
- Primary buttons: `backgroundColor: '#65A30D'`, `borderRadius: 12`
- Ghost buttons: `backgroundColor: colors.glass`, `borderColor: colors.glassBorder`
- Toggle switches: green accent when on, `colors.border` when off
- Filter pills: `borderRadius: 999`, glass background, accent fill when selected

### Typography
- Screen titles: Inter 600 (via header config)
- Section headers: `variant="subheading"` from `@mylife/ui`
- Metric values: `fontSize: 22-48`, `fontWeight: 700-800`, accent color
- Body text: `variant="body"`, `colors.text`
- Secondary text: `variant="caption"`, `colors.textSecondary`

## Implementation Order

The screens should be built in this order based on dependency chains:

1. **_layout.tsx** - Tab bar with 4 tabs + gear icon (unblocks all tab screens)
2. **my-trails.tsx** - Trail list rows (simplest data screen, validates CRUD)
3. **trail/[id].tsx** - Trail detail with collapsible sections (validates all trail queries)
4. **record.tsx** - GPS recorder with 9 states (core value prop, most complex)
5. **recording/[id].tsx** - Recording detail (validates recording data)
6. **index.tsx** - Explore: search-first + map (requires map integration)
7. **offline-regions.tsx** - Offline map manager (push from gear menu)
8. **plan.tsx** - Plan tab with trip timeline (depends on trips/packing)
9. **trip/new.tsx** + **trip/[id].tsx** - Trip CRUD
10. **packing/[id].tsx** - Packing checklist
11. **segment/[id].tsx** - Segment leaderboard
12. **route-builder.tsx** - Route builder (complex map interaction)
13. **write-review.tsx** - Review form
14. **discover.tsx** - Trail database search
15. **alert-settings.tsx** - Alert configuration (push from gear menu)

## Acceptance Criteria

- [ ] **AC-1:** Tab bar renders 4 tabs (Explore, Record, My Trails, Plan) with correct icons and gear icon in Explore header
- [ ] **AC-2:** All 16 screens render without crashes and display their states per the interaction state coverage table
- [ ] **AC-3:** Explore tab shows search-first layout (sticky search + filters at top, nearby trails carousel, map below) with "Offline Ready" brand chip
- [ ] **AC-4:** Record tab starts/pauses/stops GPS recording and creates waypoints, recording, and stats in SQLite
- [ ] **AC-5:** My Trails tab lists saved trails with filtering by difficulty and activity type
- [ ] **AC-6:** Trail detail shows weather, reviews, segments, recordings, and photos for a trail
- [ ] **AC-7:** Recording detail shows GPS trace on map, elevation profile, stats grid, and waypoints
- [ ] **AC-8:** Segment leaderboard shows all efforts for a segment sorted by duration, with PB highlighted
- [ ] **AC-9:** Plan tab shows trips, packing lists, and planned routes with progress indicators
- [ ] **AC-10:** Packing checklist supports check/uncheck, add item, reset all, with progress bar
- [ ] **AC-11:** Route builder lets user tap map to add waypoints, shows cumulative distance/elevation
- [ ] **AC-12:** Write review supports 1-5 star rating, title, body, trail conditions, and visit date
- [ ] **AC-13:** Offline region manager shows downloaded regions, available catalog grouped by area, and storage usage
- [ ] **AC-14:** All screens use Cool Obsidian design tokens (dark backgrounds, glass morphism, accent colors)
- [ ] **AC-15:** Navigation works: tab switches, push screens via `router.push()`, back navigation via header

## Test Requirements

### Unit Tests per Screen
- Explore: map renders, search filters trails, search debounce (300ms)
- Record: GPS state machine (idle/recording/paused/saving), stats computation, waypoint creation
- My Trails: trail list filtering, sort ordering, stats aggregation
- Trail Detail: data loading, difficulty color mapping, weather display
- Recording Detail: stats grid computation, elevation profile data points
- Segment Leaderboard: effort sorting, PB detection
- Plan: trip list ordering, packing progress calculation
- Trip Detail: day/activity rendering, linked trail display
- Packing Checklist: check/uncheck toggle, progress calculation, add/delete items
- Route Builder: waypoint distance calculation, save/clear
- Write Review: validation (rating required), condition toggle, submit
- Offline Regions: storage calculation, download state transitions, catalog grouping
- Alert Settings: form validation, save persistence
- Discover: search, trail type filtering, save-to-my-trails

### Integration Tests
- Full flow: Explore map > tap trail pin > trail detail > record > recording detail > write review
- Planning flow: Plan tab > new trip > add days > link trails > attach packing list > checklist
- Offline flow: Settings > offline maps > download region > explore map works offline

## gstack Quality Gates

Based on this feature's complexity (0 - Massive), these gstack skills are REQUIRED:

### Before building:
- [ ] `/plan-eng-review` on this spec

### Required for ALL features:
- [ ] `/function-gate-runner` after each screen implementation
- [ ] `/review` on the diff before merge

### Required for UI:
- [ ] `/browse` on each screen after implementation (all 5 states)
- [ ] `/qa` after the full 16-screen build

### Post-merge:
- [ ] `/design-review` for visual consistency audit
- [ ] `/parity-check` (trails has no standalone counterpart, so passthrough only)

## Handoff State

### Before This Work
MyTrails has 1 mobile screen (placeholder dashboard), a Stack layout (not Tabs), and no navigation beyond the single index page. All 17 tables, 8 engines, and 100+ CRUD functions exist but have zero user-facing UI.

### After This Work
MyTrails has 16 mobile screens across 4 tabs + gear menu, surfacing every feature in the module: search-first trail exploration with map, GPS recording with 9 states and live stats, trail library with list rows and filtering, trip planning with day-by-day timelines, packing checklists, segment leaderboards, route building, reviews, offline map management, and wrong-turn alert configuration. The UI connects all 17 tables and all 8 engines to user-facing interactions. Privacy/offline brand signals are visible throughout (Offline Ready chip, Recording Locally chip, saved vs database pin distinction).

### Known Limitations
- V1 does not include Apple Watch companion for recording (future)
- Map requires Mapbox/MapLibre integration (separate infrastructure task)
- Offline tile downloading requires background fetch implementation (covered in offline-map-downloads spec)
- Weather data requires Open-Meteo API integration (covered in weather-overlay spec)
- No social/sharing features in V1 (reviews are local-only)
- Photo capture requires expo-camera and expo-image-picker integration

### Context for Next Agent
- The existing `_layout.tsx` uses a `Stack` navigator. It needs to be converted to `Tabs` with the 4-tab structure defined above (Explore, Record, My Trails, Plan). Settings becomes a gear icon in Explore header.
- The existing `index.tsx` (dashboard) content should be redistributed: stats go to My Trails tab, the empty state becomes the Explore tab's empty state.
- All push screens should be registered in the `_layout.tsx` with `href: null` to hide them from the tab bar (same pattern as Books module).
- The `definition.ts` navigation config should be updated to match the 4-tab structure.
- Follow the Surf and Books modules' patterns for tab bar styling (emoji icons, BackToHubButton, ModuleErrorBoundary).
- Trail Detail uses collapsible accordion sections, NOT stacked cards. Sticky CTA bar with [Navigate] and [Record] always visible.
- My Trails uses list rows (Apple Contacts style), NOT bordered card grid.
- Plan tab centers on active trip timeline. Packing and routes are compact row lists below, not equal-weight summary cards.
- Record tab has 9 states total (5 original + No GPS, Low Accuracy, Background, Battery Low).
- Explore tab is search-first (sticky search + filters at top), map fills lower viewport with "Expand" gesture.
- "Offline Ready" brand chip on Explore tab. "Recording locally" chip on Record tab during active recording.
- When user taps "Record" from Trail Detail, auto-link trail context: trail.id as activeTrailId, route geometry loaded for deviation detection, trail name in stats bar.

## Design Review Addendum (gstack /plan-design-review, 2026-03-23)

This spec was reviewed by `/plan-design-review` with Codex (GPT-5.4) and Claude subagent as outside voices. Initial rating: 6/10. Post-review: 9/10.

### Key Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Tab count | 4 tabs + gear icon (Settings removed as tab) |
| 2 | Explore hierarchy | Search-first, map below |
| 3 | Layout architecture | Purpose-built layouts (collapsible sections, list rows, timelines) instead of stacked cards |
| 4 | Record states | 9 states total (added No GPS, Low Accuracy, Background, Battery Low) |
| 5 | Brand signals | "Offline Ready" chip, "Recording locally" chip, saved vs database pin distinction |
| 6 | Trail context flow | Auto-link trail to Record tab (deviation detection, trail name in stats bar) |

### Interaction State Coverage

```
FEATURE              | LOADING          | EMPTY                                    | ERROR              | SUCCESS     | PARTIAL
---------------------|------------------|------------------------------------------|--------------------|-------------|--------
Explore search       | Shimmer rows     | "Search for trails by name"              | "Search failed"    | Result list | Filter chips active
Explore map          | Gray map tile    | Centered on user location                | "Map unavailable"  | Pins loaded | Some pins loading
Record GPS           | GPS acquiring    | Activity selector + idle                 | "GPS unavailable"  | Live track  | Low accuracy warning
My Trails list       | Skeleton rows    | "Your trail collection awaits"           | "Could not load"   | Trail rows  | Filtered empty
Trail Detail         | Skeleton sections| (never empty -- came from list)          | "Trail not found"  | Full detail | Some sections loading
Plan timeline        | Skeleton blocks  | "Plan your next adventure"               | "Could not load"   | Timeline    | Trip with no days
Offline regions      | Skeleton list    | "Download maps for offline use"          | "Storage error"    | Region list | Download in progress
Packing checklist    | Skeleton items   | "Add items to your list"                 | "Could not load"   | Checklist   | Partially checked
```

### Motion Specification

| Transition | Duration | Easing | Description |
|-----------|----------|--------|-------------|
| Tab switch | 0ms | instant | iOS native tab switch |
| Push screen | 300ms | ease-out | iOS native push/pop |
| Map expand | 250ms | ease-out | Map grows from partial to full-screen |
| Collapsible section | 200ms | ease-out | Accordion open/close with content height |
| Record button morph | 200ms | ease-out | Circle fills red (idle to recording) |
| Deviation banner | 150ms | ease-in | Slides down from stats bar |
| Skeleton pulse | 1200ms | ease-in-out | Opacity 0.3 to 0.6, stagger 50ms |
| Waypoint drop | 200ms | spring(0.8) | Pin drops with slight bounce |
| Trail card appear | 200ms | ease-out | Stagger by 50ms for cascade |

Reduce Motion: all animations replaced with instant state changes when `prefers-reduced-motion` is active.

### Accessibility Specification

| Element | a11y Spec |
|---------|-----------|
| Map pins | `accessibilityLabel="Trail: {name}, {difficulty}, {distance}"` + `accessibilityRole="button"` |
| Record button | `accessibilityLabel` changes per state: "Start recording" / "Pause" / "Stop" |
| Deviation banner | `accessibilityLiveRegion="assertive"` (immediate VoiceOver announcement) |
| GPS status | `accessibilityLiveRegion="polite"` (announced on change) |
| Difficulty badge | `accessibilityLabel="{difficulty} difficulty"` (not color-only) |
| Filter pills | `accessibilityRole="togglebutton"` + `accessibilityState={{ selected }}` |
| Packing checkboxes | `accessibilityRole="checkbox"` + `accessibilityState={{ checked }}` |
| Stats bar values | Full text labels: "Distance: 2.4 kilometers. Elevation: 156 meters." |
| All interactive | Minimum 44x44pt touch targets (per DESIGN.md) |

### User Journeys

**Journey 1: Find and hike a trail today**
```
Explore tab -> search "muir" -> tap Muir Loop card -> Trail Detail ->
  see weather (good!) -> tap [Record] -> Record tab loads with Muir Loop
  as reference route -> tap Record button -> hike with live stats +
  deviation detection -> finish -> stop recording -> Recording Detail ->
  tap [Write Review] -> review form with photos pre-loaded -> submit
```

**Journey 2: Plan a weekend trip**
```
Plan tab -> [+ New Trip] -> name "Yosemite Weekend", dates Mar 15-17 ->
  select "Overnight" packing template -> save trip -> Trip Detail ->
  add Day 1 activities -> search trails -> add "Valley Floor Loop" ->
  add Day 2 activities -> add "Half Dome" -> go to packing checklist ->
  check items as you pack -> trip ready
```

**Journey 3: Download offline maps before a trip**
```
Explore tab -> gear icon -> Offline Maps -> browse National Parks catalog ->
  tap "Download" on Yosemite -> progress bar shows 67% -> complete ->
  return to Explore tab -> "Offline Ready | 1 region" chip visible ->
  map shows Yosemite area with full tile coverage
```

### Design System Alignment

| Component | Specification |
|-----------|--------------|
| Difficulty badge | Pill (borderRadius: 999), 4px 8px padding, Inter 600 12px, white text. Colors: Easy=#30D158, Moderate=#FFD60A, Hard=#FF9F0A, Expert=#FF453A |
| Elevation profile | 50m bins, auto-scaled Y-axis, #65A30D 2px smooth line, gradient fill 20% opacity, tap shows tooltip |
| Skeleton loading | Glass card shapes, opacity pulse 0.3 to 0.6 over 1.2s ease-in-out, 50ms stagger cascade |
| Map line styles | Saved route: solid #65A30D 3px round join. Recorded trace: gradient green to red 4px. Deviation: #FF453A 50% opacity 5px |
| Empty states | Module icon (hiking boot) + warm headline + 1-line supporting text + primary CTA in #65A30D |

### Record Tab Additional States

| State | Visual | Behavior |
|-------|--------|----------|
| No GPS | Yellow banner: "Waiting for GPS signal. Move to an open area." | Record button disabled, pulsing GPS icon |
| Low Accuracy | Yellow dot: "GPS ~200m accuracy. Recording may be inaccurate." | Record button enabled, user decides |
| Background | On return: green banner "Recording continued. 12 min elapsed." | Stats update, track drawn |
| Battery Low | At 20%: "Battery low. Pause recording to save power?" | Dismissible banner |

### Brand Signals

| Location | Signal | Implementation |
|----------|--------|---------------|
| Explore tab header | "Offline Ready | N regions" chip | `backgroundColor: rgba(101,163,13,0.15)`, lock icon, shows when regions > 0 |
| Record tab (active) | "Recording locally" chip | Small chip with lock icon below stats bar, visible during recording |
| Explore map pins | Saved vs database distinction | Saved = green glow (#65A30D), Database = dimmed (0.4 opacity) |
| Explore map regions | Offline region boundaries | Subtle dashed border showing downloaded areas |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | -- | -- |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | -- | -- |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | -- | -- |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | 9/10 (FULL) | score: 6/10 to 9/10, 6 decisions, 4 Codex hard rejections resolved |

**VERDICT:** DESIGN CLEARED (9/10). Run `/plan-eng-review` before implementation.
