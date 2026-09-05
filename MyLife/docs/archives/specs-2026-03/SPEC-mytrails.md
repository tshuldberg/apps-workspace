# MyTrails - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Team Lead

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyTrails
- **Tagline:** "Record, relive, and plan your outdoor adventures"
- **Module ID:** `trails`
- **Feature ID Prefix:** TR
- **Table Prefix:** `tr_`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Day Hiker (Riley) | 25-45, hikes 2-4x/month on local trails, values simplicity and offline reliability | Record hikes with GPS, review distance and elevation stats, take geotagged photos along the route |
| Backpacker (Dana) | 28-40, multi-day backpacking trips 3-6x/year, needs offline maps in remote areas | Download map tiles before trips, plan multi-day routes with waypoints, track cumulative trip stats |
| Trail Runner (Kai) | 22-38, runs trails 3-5x/week, cares about pace and split tracking | Record runs with pace/speed data, compare personal bests, track elevation gain per run |
| Weekend Explorer (Pat) | 30-55, casual walker/cyclist who explores parks and greenways with family | Simple one-tap recording, photo geotagging for memories, export GPX to share with friends |
| Trip Planner (Morgan) | 25-50, plans outdoor vacations and weekend getaways in advance | Build multi-day trip itineraries, attach planned routes to trip days, view weather forecasts for trail locations |

### 1.3 Core Value Proposition

MyTrails is a privacy-first outdoor activity tracker that replaces AllTrails and Komoot without uploading your GPS history to the cloud. It records hiking, running, and cycling routes with GPS, displays elevation profiles with gain/loss calculations, supports offline map tiles for remote areas, and lets you plan future trips with multi-day itineraries. Unlike AllTrails (which shares location data for advertising) and Strava (which exposed military bases through public heatmaps), MyTrails stores all GPS data locally on the device. Live location sharing is explicit, temporary, and peer-to-peer with a chosen contact. Users get the core outdoor tracking experience without sacrificing personal security.

### 1.4 Competitive Landscape

| Competitor | Price | Strengths | Weaknesses | Our Differentiator |
|-----------|-------|-----------|------------|-------------------|
| AllTrails | $36-80/yr | 400K+ trail database, large community, offline maps | Shares GPS data for ads, social pressure to post, $80/yr for full features | Zero data sharing, GPS never leaves device, included in MyLife suite |
| Komoot | $60/yr | Sport-specific routing, turn-by-turn nav, excellent European coverage | Shares data with analytics providers, expensive per-region map purchases | All map regions free (OpenStreetMap), no third-party analytics |
| Strava | $80/yr | Massive community, segments, social feed | Exposed military bases via heatmap (2018, 2025), no offline maps, fitness tracking is secondary to social | No heatmaps, no social feed, privacy zones on all GPS data |
| Wanderlog | $80/yr | Trip planning with itineraries, collaborative travel | Cloud-only itineraries, no GPS recording, no offline | Local-first trip planning, integrated GPS recording, fully offline capable |
| Gaia GPS | $40/yr | Advanced topo maps, backcountry navigation | Complex UI, steep learning curve, no trip planning | Simple UX, integrated trip planner, beginner-friendly |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All GPS tracks, routes, and trail data are stored locally on the device
- Zero analytics, zero telemetry, zero location tracking
- No account required for core functionality
- GPS data never leaves the device unless the user explicitly initiates an export or live location share
- Live location sharing is temporary, direct to a chosen contact, and not stored on any server
- Offline map tiles are downloaded from public tile servers (OpenStreetMap) and cached locally
- No heatmaps, no social feeds, no activity aggregation across users
- Users own their data with full export (GPX, CSV, JSON) and complete delete capabilities

Product-specific privacy notes: GPS location data is among the most sensitive personal data categories. A user's trail history reveals home address (common start/end points), daily routines, fitness patterns, and travel destinations. MyTrails treats all location data as high-sensitivity by default and provides configurable privacy zones to exclude home/work areas from any exported data.

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| TR-001 | GPS Trail Recording | P0 | Core | None | Not Started |
| TR-002 | Trail History Log | P0 | Core | TR-001 | Not Started |
| TR-003 | Route Display on Map | P0 | Core | TR-001 | Not Started |
| TR-004 | Elevation Profile | P0 | Core | TR-001 | Not Started |
| TR-005 | Trail Statistics Dashboard | P0 | Analytics | TR-001, TR-002 | Not Started |
| TR-006 | Offline Map Tiles | P0 | Core | None | Not Started |
| TR-007 | GPX Import/Export | P1 | Import/Export | TR-001 | Not Started |
| TR-008 | Photo Geotagging | P1 | Core | TR-001 | Not Started |
| TR-009 | Trip Planning | P1 | Core | TR-006 | Not Started |
| TR-010 | Trail Difficulty Rating | P1 | Data Management | TR-001, TR-002 | Not Started |
| TR-011 | Live Location Sharing | P1 | Core | TR-001 | Not Started |
| TR-012 | Achievement Badges | P2 | Analytics | TR-002, TR-005 | Not Started |
| TR-013 | Weather Overlay | P2 | Core | TR-006 | Not Started |
| TR-014 | Wrong-Turn Alerts | P2 | Core | TR-001, TR-009 | Not Started |
| TR-015 | Waypoint Management | P1 | Data Management | TR-001, TR-006 | Not Started |
| TR-016 | Activity Type Support | P0 | Core | TR-001 | Not Started |
| TR-017 | Privacy Zones | P1 | Settings | None | Not Started |
| TR-018 | Packing List Generator | P2 | Core | TR-009 | Not Started |
| TR-019 | Segment Tracking | P2 | Analytics | TR-001, TR-002 | Not Started |
| TR-020 | Trail Search and Filtering | P0 | Data Management | TR-002 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

**Category Legend:**
- **Core** - Fundamental product functionality
- **Data Management** - CRUD operations, organization, search
- **Analytics** - Stats, reports, insights, visualizations
- **Import/Export** - Data portability (import from competitors, export user data)
- **Social** - Sharing, community, collaborative features
- **Settings** - User preferences, configuration, customization

---

## 3. Feature Specifications

### TR-001: GPS Trail Recording

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-001 |
| **Feature Name** | GPS Trail Recording |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a day hiker, I want to record my hike using GPS so that I can see the exact route I took, how far I went, and how much elevation I gained.

**Secondary:**
> As a trail runner, I want GPS recording to continue in the background when I lock my phone or switch to another app so that I do not lose tracking data mid-run.

**Tertiary:**
> As a weekend explorer, I want to start recording with a single tap so that I do not fumble with settings while standing at the trailhead.

#### 3.3 Detailed Description

GPS Trail Recording is the foundational feature of MyTrails. It captures the user's position at regular intervals during an outdoor activity and assembles those positions into a continuous track. The recorded data includes latitude, longitude, elevation (altitude), and timestamp for each sample point. From this raw data, the system derives distance traveled, elevation gain/loss, elapsed time, pace, and speed in real time.

Recording operates in two modes: foreground (map visible, stats updating live) and background (phone locked or another app is active). In both modes, GPS sampling continues uninterrupted. The system uses adaptive sampling rates between 1 and 5 seconds based on movement speed: faster movement triggers more frequent sampling (1-second intervals above 8 km/h), while stationary or slow movement reduces sampling to 5-second intervals to conserve battery.

During recording, the user sees a live map with their route drawn as a colored polyline, along with a real-time stats panel displaying elapsed time, distance, elevation gain, and current pace. The user can pause recording (which stops GPS sampling and freezes the timer) and resume later, creating a multi-segment track. When the user finishes, they tap a stop button, confirm the action, and the track is saved with a summary of all statistics.

All GPS data is stored locally on the device. No position data is transmitted to any server at any time during or after recording. This directly addresses the privacy failures of competitors like AllTrails (location data shared for advertising) and Strava (heatmap exposure of military installations).

The system handles GPS signal loss gracefully. If the GPS fix is lost for more than 10 seconds, the UI displays a "Weak Signal" indicator. Points recorded during signal loss (with horizontal accuracy worse than 30 meters) are flagged as low-confidence and excluded from distance calculations until accuracy recovers.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- GPS/GNSS hardware on the device
- Location permission granted by the user (foreground and background)
- Sufficient device storage for track data (approximately 1 KB per minute of recording)
- Battery level above 5% to start a new recording (warning shown between 5-15%)

**Assumed Capabilities:**
- The app can request and receive location updates from the operating system
- The app can run in the background with location services active
- The app can write to persistent local storage during recording

#### 3.5 User Interface Requirements

##### Screen: Recording Screen (Active Recording)

**Layout:**
- The screen is dominated by a full-screen interactive map showing the user's current position centered with a directional marker
- The recorded route is drawn as a colored polyline (3px width) on the map in the module's accent color
- A translucent stats panel is anchored to the bottom of the screen, overlaying the map, and displays four metrics in a 2x2 grid: elapsed time (top-left), distance (top-right), elevation gain (bottom-left), and current pace (bottom-right)
- Below the stats panel is a control bar with three buttons: a pause/resume toggle (center, large), a camera button (left, for geotagged photos), and a waypoint button (right, to drop a pin)
- A small GPS signal strength indicator appears in the top-right corner of the map (green = strong, yellow = moderate, red = weak/lost)
- The map supports pinch-to-zoom, pan, and rotation gestures during recording

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Pre-Recording | User has opened the recording screen but not started | Map centered on current location with a "Start" button prominently displayed. Stats panel shows all zeros. A dropdown or segmented control for activity type appears above the start button. |
| Recording Active | GPS is sampling and track is being drawn | Live map with route polyline growing, stats updating every second, pause button visible. Control bar shows pause/camera/waypoint buttons. |
| Recording Paused | User has paused recording | Map still visible but route polyline stops growing. Stats panel shows frozen values with a "Paused" label overlaid. Timer displays in a paused state (blinking or dimmed). Resume button replaces pause button. A stop button appears alongside resume. |
| Weak Signal | GPS accuracy worse than 30 meters for more than 10 seconds | A yellow banner appears below the top bar: "Weak GPS Signal - accuracy reduced." The route polyline changes to a dashed style for the low-confidence segment. Stats continue updating but distance values are marked as approximate. |
| Signal Lost | No GPS fix for more than 60 seconds | A red banner appears: "GPS Signal Lost." The route polyline shows a gap. Timer continues but distance and pace freeze at last known values. |
| Low Battery | Battery level drops below 15% during recording | A non-blocking notification appears: "Battery low (X%). Consider finishing your activity soon." Recording continues normally. |
| Saving | User has tapped stop and confirmed | A brief progress indicator appears while the track is saved to local storage. Stats panel shows final values. |

**Interactions:**
- Tap "Start": Begins GPS recording, starts timer, begins drawing route polyline
- Tap "Pause": Pauses GPS sampling and timer. Route polyline stops extending. Button changes to "Resume"
- Tap "Resume": Resumes GPS sampling and timer from where they paused
- Tap "Stop" (visible only when paused): Presents a confirmation dialog ("End this activity?") with Cancel and Save options
- Tap camera button: Opens the device camera for a geotagged photo (see TR-008)
- Tap waypoint button: Drops a labeled pin at the current GPS position (see TR-015)
- Pinch/zoom on map: Adjusts map zoom level without affecting recording
- Pan on map: Moves map view; a "Re-center" button appears to return to current location

**Transitions/Animations:**
- Route polyline extends smoothly with each new GPS point, using linear interpolation between points
- Stats panel values animate when updating (counter-style number transitions, 150ms duration)
- Pause/Resume button transitions with a scale animation (100ms)
- GPS signal indicator pulses gently when actively acquiring signal

##### Dialog: End Activity Confirmation

**Layout:**
- A centered modal dialog with the title "End Activity?"
- Body text: "Your [activity type] will be saved with the following stats:"
- A mini stats summary showing distance, time, and elevation gain
- Two buttons: "Cancel" (secondary, left) and "Save" (primary, right)

**Interactions:**
- Tap "Cancel": Dismisses the dialog, returns to paused recording state
- Tap "Save": Saves the track, navigates to the Trail Detail screen for the just-completed activity

#### 3.6 Data Requirements

##### Entity: Track

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the track |
| name | string | Optional, max 200 chars | Auto-generated from date and activity type (e.g., "Morning Hike - Mar 6") | User-editable name for the activity |
| activity_type | enum | One of: hike, run, bike, walk, other | hike | Type of outdoor activity recorded |
| started_at | datetime | Required, ISO 8601 | Set on recording start | Timestamp when recording began |
| finished_at | datetime | Required, ISO 8601 | Set on recording end | Timestamp when recording ended |
| elapsed_time_ms | integer | Min: 0 | 0 | Total elapsed time in milliseconds excluding paused segments |
| distance_m | float | Min: 0.0 | 0.0 | Total distance traveled in meters, calculated from GPS points via Haversine formula |
| elevation_gain_m | float | Min: 0.0 | 0.0 | Cumulative elevation gained in meters (uphill only, with 3m noise filter) |
| elevation_loss_m | float | Min: 0.0 | 0.0 | Cumulative elevation lost in meters (downhill only, with 3m noise filter) |
| max_elevation_m | float | Nullable | null | Highest elevation reached during the activity in meters |
| min_elevation_m | float | Nullable | null | Lowest elevation reached during the activity in meters |
| avg_pace_s_per_km | float | Nullable, Min: 0.0 | null | Average pace in seconds per kilometer (time / distance) |
| max_speed_m_per_s | float | Nullable, Min: 0.0 | null | Maximum instantaneous speed recorded in meters per second |
| avg_speed_m_per_s | float | Nullable, Min: 0.0 | null | Average speed in meters per second |
| bounding_box_ne_lat | float | -90.0 to 90.0 | null | Northeast corner latitude of the track bounding box |
| bounding_box_ne_lon | float | -180.0 to 180.0 | null | Northeast corner longitude of the track bounding box |
| bounding_box_sw_lat | float | -90.0 to 90.0 | null | Southwest corner latitude of the track bounding box |
| bounding_box_sw_lon | float | -180.0 to 180.0 | null | Southwest corner longitude of the track bounding box |
| notes | string | Optional, max 5000 chars | null | User notes about the activity |
| difficulty_rating | enum | One of: easy, moderate, hard, expert, null | null | User-assigned difficulty after completion |
| is_favorite | boolean | - | false | Whether the user has favorited this track |
| privacy_zone_applied | boolean | - | false | Whether privacy zone trimming was applied on export |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: TrackPoint

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the point |
| track_id | string | Foreign key to Track.id, required | None | The track this point belongs to |
| latitude | float | -90.0 to 90.0, required | None | WGS84 latitude in decimal degrees |
| longitude | float | -180.0 to 180.0, required | None | WGS84 longitude in decimal degrees |
| elevation_m | float | Nullable | null | Altitude above sea level in meters (from GPS or barometer) |
| timestamp | datetime | Required, ISO 8601 | None | Exact time this point was recorded |
| accuracy_m | float | Min: 0.0, nullable | null | Horizontal accuracy radius in meters as reported by the device |
| speed_m_per_s | float | Min: 0.0, nullable | null | Instantaneous speed at this point in meters per second |
| bearing_deg | float | 0.0 to 360.0, nullable | null | Direction of travel in degrees from true north |
| segment_index | integer | Min: 0 | 0 | Segment number (increments when recording is paused and resumed) |
| is_low_confidence | boolean | - | false | True if accuracy_m exceeds the 30m threshold |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- Track has many TrackPoints (one-to-many via track_id)
- TrackPoints are ordered by timestamp within a Track

**Indexes:**
- TrackPoint(track_id, timestamp) - composite index for ordered retrieval of points within a track
- TrackPoint(track_id, segment_index) - composite index for segment-based queries
- Track(started_at) - sort tracks by date
- Track(activity_type) - filter tracks by activity type

**Validation Rules:**
- track_id on TrackPoint must reference an existing Track
- latitude must be between -90.0 and 90.0 inclusive
- longitude must be between -180.0 and 180.0 inclusive
- started_at must be before finished_at on a completed Track
- elapsed_time_ms must not exceed the wall-clock difference between started_at and finished_at
- A Track must have at least 2 TrackPoints to be considered valid (otherwise it is discarded on save)

**Example Data:**

```
Track:
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Morning Hike - Muir Woods",
  "activity_type": "hike",
  "started_at": "2026-03-06T08:15:00Z",
  "finished_at": "2026-03-06T11:42:00Z",
  "elapsed_time_ms": 11820000,
  "distance_m": 9654.3,
  "elevation_gain_m": 487.2,
  "elevation_loss_m": 491.8,
  "max_elevation_m": 382.1,
  "min_elevation_m": 12.4,
  "avg_pace_s_per_km": 1224.0,
  "max_speed_m_per_s": 2.8,
  "avg_speed_m_per_s": 0.817,
  "notes": "Beautiful morning, saw two deer near the creek crossing.",
  "difficulty_rating": "moderate",
  "is_favorite": true,
  "created_at": "2026-03-06T11:42:30Z",
  "updated_at": "2026-03-06T11:45:00Z"
}

TrackPoint:
{
  "id": "a1b2c3d4-1111-2222-3333-444455556666",
  "track_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "latitude": 37.8912,
  "longitude": -122.5714,
  "elevation_m": 45.2,
  "timestamp": "2026-03-06T08:15:03Z",
  "accuracy_m": 4.2,
  "speed_m_per_s": 1.1,
  "bearing_deg": 315.0,
  "segment_index": 0,
  "is_low_confidence": false,
  "created_at": "2026-03-06T08:15:03Z"
}
```

#### 3.7 Business Logic Rules

##### Haversine Distance Calculation

**Purpose:** Calculate the great-circle distance between two GPS coordinate points on the Earth's surface, accounting for the planet's curvature.

**Inputs:**
- lat1: float - Latitude of point 1 in decimal degrees
- lon1: float - Longitude of point 1 in decimal degrees
- lat2: float - Latitude of point 2 in decimal degrees
- lon2: float - Longitude of point 2 in decimal degrees

**Logic:**

```
1. Convert all degree values to radians:
   lat1_rad = lat1 * pi / 180
   lon1_rad = lon1 * pi / 180
   lat2_rad = lat2 * pi / 180
   lon2_rad = lon2 * pi / 180
2. Compute deltas:
   dlat = lat2_rad - lat1_rad
   dlon = lon2_rad - lon1_rad
3. Apply Haversine formula:
   a = sin(dlat/2)^2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon/2)^2
   c = 2 * arcsin(sqrt(a))
4. R = 6371000 (Earth's mean radius in meters)
5. distance = R * c
6. RETURN distance in meters
```

**Formulas:**
- d = 2R * arcsin(sqrt(sin^2((lat2-lat1)/2) + cos(lat1) * cos(lat2) * sin^2((lon2-lon1)/2)))
- Where R = 6,371,000 meters (Earth's mean radius)

**Edge Cases:**
- Same point (lat1=lat2, lon1=lon2): Returns 0.0 meters
- Antipodal points: Returns pi * R (approximately 20,015 km)
- Points near the international date line (lon crossing +/-180): Handled correctly by the trigonometric functions
- Points near the poles: Formula remains accurate; no special handling needed

##### Total Distance Accumulation

**Purpose:** Calculate the total distance of a track by summing Haversine distances between consecutive high-confidence GPS points.

**Inputs:**
- points: array of TrackPoint - Ordered by timestamp

**Logic:**

```
1. total_distance = 0.0
2. prev_point = null
3. FOR each point in points (ordered by timestamp):
   a. IF point.is_low_confidence is true, SKIP this point
   b. IF prev_point is null:
        prev_point = point
        CONTINUE
   c. segment_distance = haversine(prev_point.lat, prev_point.lon, point.lat, point.lon)
   d. IF segment_distance > 500 meters AND time gap < 10 seconds:
        SKIP this point (GPS teleportation artifact)
   e. total_distance = total_distance + segment_distance
   f. prev_point = point
4. RETURN total_distance in meters
```

**Edge Cases:**
- Fewer than 2 high-confidence points: Returns 0.0 meters
- GPS teleportation (jump >500m in <10s): Point is skipped to avoid inflated distance
- All points are low-confidence: Returns 0.0 meters

##### Elevation Gain/Loss Calculation

**Purpose:** Calculate cumulative elevation gained (uphill) and lost (downhill) with a noise filter to suppress GPS altitude jitter.

**Inputs:**
- points: array of TrackPoint - Ordered by timestamp, with elevation_m values

**Logic:**

```
1. total_gain = 0.0
2. total_loss = 0.0
3. reference_elevation = null
4. NOISE_THRESHOLD = 3.0 meters
5. FOR each point in points (ordered by timestamp):
   a. IF point.elevation_m is null, SKIP
   b. IF point.is_low_confidence is true, SKIP
   c. IF reference_elevation is null:
        reference_elevation = point.elevation_m
        CONTINUE
   d. delta = point.elevation_m - reference_elevation
   e. IF abs(delta) >= NOISE_THRESHOLD:
        IF delta > 0:
          total_gain = total_gain + delta
        ELSE:
          total_loss = total_loss + abs(delta)
        reference_elevation = point.elevation_m
6. RETURN { gain: total_gain, loss: total_loss }
```

**Formulas:**
- Elevation gain = sum of all positive elevation deltas >= 3m threshold
- Elevation loss = sum of all absolute negative elevation deltas >= 3m threshold
- Noise filter: Changes smaller than 3 meters are ignored (suppresses GPS altitude jitter)

**Edge Cases:**
- No elevation data available (all points have null elevation_m): Returns { gain: 0.0, loss: 0.0 }
- Only 1 point with elevation data: Returns { gain: 0.0, loss: 0.0 }
- Flat terrain with micro-oscillations under 3m: Returns { gain: 0.0, loss: 0.0 } (noise filter suppresses)

##### Adaptive GPS Sampling Rate

**Purpose:** Adjust the GPS sampling interval based on movement speed to balance accuracy and battery consumption.

**Inputs:**
- current_speed_m_per_s: float - Current speed in meters per second

**Logic:**

```
1. IF current_speed_m_per_s > 2.22 (approximately 8 km/h):
     sampling_interval = 1 second (fast movement: running, cycling)
2. ELSE IF current_speed_m_per_s > 0.83 (approximately 3 km/h):
     sampling_interval = 2 seconds (normal walking/hiking pace)
3. ELSE IF current_speed_m_per_s > 0.14 (approximately 0.5 km/h):
     sampling_interval = 3 seconds (slow movement)
4. ELSE:
     sampling_interval = 5 seconds (stationary or near-stationary)
5. RETURN sampling_interval
```

**Edge Cases:**
- Speed is 0 (stationary): Returns 5 seconds
- Speed is negative (should not occur): Treat as 0, return 5 seconds
- Speed exceeds 50 m/s (180 km/h, likely in a vehicle): Still returns 1 second

##### Pace Calculation

**Purpose:** Compute pace as time per unit distance, the standard metric for hiking and running.

**Inputs:**
- elapsed_time_ms: integer - Total elapsed time in milliseconds
- distance_m: float - Total distance in meters

**Logic:**

```
1. IF distance_m <= 0 OR elapsed_time_ms <= 0:
     RETURN null (pace is undefined)
2. pace_s_per_km = (elapsed_time_ms / 1000) / (distance_m / 1000)
3. RETURN pace_s_per_km
```

**Formulas:**
- pace = time / distance
- pace_s_per_km = elapsed_seconds / distance_km
- Display format: MM:SS per km (or per mile, based on user preference)

**Edge Cases:**
- Zero distance: Returns null (display as "N/A")
- Zero time: Returns null (display as "N/A")
- Very short distance (<10m): Returns null to avoid meaningless pace values

##### State Machine: Recording State

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| Idle | User taps "Start" | Recording | Set started_at to now. Begin GPS sampling. Start elapsed timer. Create new Track record. Set segment_index to 0. |
| Recording | User taps "Pause" | Paused | Stop GPS sampling. Freeze elapsed timer. Record cumulative elapsed_time_ms. |
| Recording | GPS signal lost >60s | Recording (degraded) | Show "GPS Signal Lost" banner. Freeze distance/pace calculations. Continue timer. |
| Recording | Battery drops below 5% | Paused (auto) | Auto-pause recording. Show notification: "Recording paused - battery critically low." |
| Paused | User taps "Resume" | Recording | Resume GPS sampling. Resume elapsed timer. Increment segment_index by 1. |
| Paused | User taps "Stop" | Saving | Show confirmation dialog. On confirm: set finished_at, calculate final stats, save Track and all TrackPoints to storage. |
| Saving | Save completes | Idle | Navigate to Trail Detail screen for the saved track. |
| Saving | Save fails | Paused | Show error: "Could not save activity. Please try again." Return to Paused state with data intact in memory. |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Location permission denied | Modal dialog: "MyTrails needs location access to record your activity. Please enable Location in Settings." with a button to open device Settings. | User grants permission in device Settings and returns to the app. |
| Background location permission denied | Banner on recording screen: "Background location is off. Recording will stop if you switch apps." | User can continue with foreground-only recording or tap the banner to open device Settings. |
| GPS signal lost during recording | Yellow banner (>10s): "Weak GPS Signal." Red banner (>60s): "GPS Signal Lost." Route polyline shows dashed segments for low-confidence portions. | Recording continues. Distance calculation resumes automatically when GPS signal recovers. No user action required. |
| Storage full during recording | Alert dialog: "Storage full. Your current activity has been saved with data up to this point." Recording is auto-stopped and saved. | User frees device storage. Partial track data is preserved. |
| App crash during recording | On next app launch, the system detects an unsaved recording in progress and offers to recover it: "It looks like your last recording was interrupted. Recover it?" | User taps "Recover" to save the partial track, or "Discard" to delete the incomplete data. |
| Battery dies during recording | Same crash recovery flow on next launch. TrackPoints are written to storage incrementally (every 30 seconds), so at most 30 seconds of data is lost. | Recovered track may be missing the final 30 seconds of GPS points. |
| Altitude data unavailable (no barometer, GPS altitude unreliable) | Elevation stats show "N/A" on the stats panel. Track is still recorded with lat/lon data. | No action needed. User can view distance and time stats. Elevation is supplementary. |

**Validation Timing:**
- Activity type selection is validated before recording starts (must select one)
- GPS availability is checked on recording screen entry and continuously during recording
- Track validity (minimum 2 points) is checked on save attempt

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the recording screen and has granted location permissions,
   **When** they select "Hike" as the activity type and tap "Start",
   **Then** the map centers on their current position, a blue dot marks their location, the timer starts counting up, and GPS sampling begins at the adaptive rate.

2. **Given** a recording is in progress and the user has walked 500 meters,
   **When** they look at the stats panel,
   **Then** the distance shows approximately 500m (within 5% accuracy), elapsed time is incrementing, elevation gain reflects any uphill walked, and the route polyline traces their path on the map.

3. **Given** a recording is in progress,
   **When** the user taps "Pause" and then "Resume" after a 5-minute break,
   **Then** the elapsed time does not include the 5-minute pause, the route shows a gap or segment break at the pause point, and the segment_index increments by 1.

4. **Given** a recording is paused,
   **When** the user taps "Stop" and confirms by tapping "Save",
   **Then** the track is saved to local storage with all TrackPoints, the user is navigated to the Trail Detail screen showing final stats, and the Track appears in the Trail History Log.

**Edge Cases:**

5. **Given** GPS accuracy degrades to worse than 30 meters for 15 seconds,
   **When** the system detects low-confidence points,
   **Then** a "Weak GPS Signal" banner is displayed, those points are flagged as is_low_confidence=true, and they are excluded from distance calculations.

6. **Given** the user is recording and switches to another app,
   **When** they return to MyTrails 20 minutes later,
   **Then** the recording has continued in the background, all GPS points during the 20 minutes are captured, and the route/stats reflect the full activity.

7. **Given** the user starts recording but stands still at the trailhead for 3 minutes,
   **When** the system detects near-zero speed,
   **Then** the sampling rate adjusts to 5-second intervals, battery consumption is reduced, and no spurious distance is accumulated from GPS drift.

**Negative Tests:**

8. **Given** location permission has not been granted,
   **When** the user taps "Start",
   **Then** a permission request dialog is shown. If denied, a modal explains that recording requires location access and offers a button to open device Settings.
   **And** no recording begins, no Track is created.

9. **Given** a recording has only 1 TrackPoint (user started and immediately stopped),
   **When** the user taps "Stop" and "Save",
   **Then** the system shows a message: "Activity too short to save (less than 2 GPS points recorded)."
   **And** no Track is saved to storage.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| haversine returns 0 for identical points | lat1=37.7749, lon1=-122.4194, lat2=37.7749, lon2=-122.4194 | 0.0 meters |
| haversine calculates SF to LA correctly | lat1=37.7749, lon1=-122.4194, lat2=34.0522, lon2=-118.2437 | approximately 559,120 meters (within 0.5%) |
| haversine handles antipodal points | lat1=0, lon1=0, lat2=0, lon2=180 | approximately 20,015,087 meters |
| haversine handles crossing 180th meridian | lat1=50, lon1=179, lat2=50, lon2=-179 | approximately 143,239 meters |
| elevation gain ignores changes below 3m threshold | elevations: [100, 101, 102, 100, 99, 98] | gain: 0.0, loss: 0.0 |
| elevation gain accumulates above threshold | elevations: [100, 105, 110, 105, 100] | gain: 10.0, loss: 10.0 |
| elevation gain handles null values | elevations: [100, null, 110, null, 120] | gain: 20.0, loss: 0.0 |
| adaptive sampling returns 1s for fast speed | speed: 3.0 m/s | interval: 1 second |
| adaptive sampling returns 5s for stationary | speed: 0.0 m/s | interval: 5 seconds |
| pace returns null for zero distance | elapsed_time_ms: 60000, distance_m: 0.0 | null |
| pace calculates correctly | elapsed_time_ms: 3600000 (1 hour), distance_m: 5000 (5 km) | 720 s/km (12:00 min/km) |
| distance accumulation skips low-confidence points | points with is_low_confidence=true interspersed | Distance only includes high-confidence segments |
| distance accumulation skips GPS teleportation | Two consecutive points 1000m apart, 2s gap | Second point skipped, distance = 0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete recording lifecycle | 1. Open recording screen, 2. Select "Hike", 3. Start recording, 4. Simulate 50 GPS points over 10 minutes, 5. Pause, 6. Resume, 7. Simulate 30 more points, 8. Stop and save | Track is saved with 80 points, 2 segments, correct distance/elevation/time calculations |
| Recording survives app backgrounding | 1. Start recording, 2. Switch to another app for 5 minutes, 3. Return to MyTrails | Recording state is preserved, no data loss, continuous track points captured |
| Recording recovery after crash | 1. Start recording, 2. Simulate 100 GPS points, 3. Kill the app process, 4. Relaunch | Recovery dialog appears offering to restore the partial track with up to the last checkpoint of points |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| First hike recording | 1. Launch app, 2. Navigate to recording screen, 3. Grant location permission, 4. Select "Hike", 5. Tap Start, 6. Walk a route for 30 minutes, 7. Pause, 8. Take a photo, 9. Resume, 10. Walk 15 more minutes, 11. Stop and Save | Trail History shows 1 activity. Trail Detail shows route on map, elevation profile, stats (distance, time, gain, pace). 1 geotagged photo is attached. 2 segments visible on route. |

---

### TR-002: Trail History Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-002 |
| **Feature Name** | Trail History Log |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a day hiker, I want to see a chronological list of all my past hikes so that I can review what I have done and revisit favorite routes.

**Secondary:**
> As a trail runner, I want to quickly scan my recent runs with distance and time so that I can compare my performance over time without opening each individual track.

#### 3.3 Detailed Description

The Trail History Log is the primary landing screen for the activity tab. It presents a reverse-chronological list of all recorded tracks, each displayed as a compact card showing key information at a glance: activity name, date, activity type icon, distance, elapsed time, elevation gain, and a miniature route preview (a small static map thumbnail showing the route polyline).

The list supports infinite scrolling for users with large activity histories (hundreds or thousands of recordings). Items load in pages of 20, with additional pages fetched as the user scrolls near the bottom.

Users can sort the list by date (newest/oldest first), distance (longest/shortest), elevation gain (most/least), or duration (longest/shortest). They can filter by activity type (hike, run, bike, walk, other), by date range (custom picker or presets like "This month", "Last 30 days", "This year"), and by favorites only.

Each list item is tappable, navigating to the full Trail Detail screen for that activity. Users can swipe left on an item to reveal a delete action, which requires confirmation. Long-pressing an item opens a context menu with options: Rename, Share (export as GPX), Favorite/Unfavorite, and Delete.

The list also provides summary statistics at the top: total activities count, total distance, and total elevation gain across all visible (filtered) activities. This gives users a quick sense of their overall accomplishment.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - The history log displays tracks created by the recording feature

**External Dependencies:**
- Local storage containing saved Track records
- Map tile access for generating route preview thumbnails (can use cached tiles)

**Assumed Capabilities:**
- The app can query and sort Track records from local storage efficiently
- The app can render small static map images for route preview thumbnails

#### 3.5 User Interface Requirements

##### Screen: Trail History

**Layout:**
- A top navigation bar with the title "Trails" on the left and a sort/filter button on the right (funnel icon)
- Below the navigation bar is a summary stats bar displaying three metrics inline: total activities count, total distance (in km or mi based on user preference), and total elevation gain (in m or ft). These stats reflect the current filter state.
- Below the summary bar is a horizontally scrollable row of filter chips for activity type: "All", "Hike", "Run", "Bike", "Walk", "Other". The active chip is highlighted.
- The main content area is a vertically scrollable list of track cards
- Each track card displays: a small route preview map thumbnail (64x64 px, left side), activity name (bold, primary text), date and time (secondary text below name), and a row of three stats: distance, elapsed time, elevation gain (with small icons). An activity type icon appears near the top-right of the card. A small heart icon appears if the track is favorited.
- The list paginates with 20 items per page, loading more as the user scrolls near the bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No tracks have been recorded | Centered illustration of a trail/mountain, text: "No activities yet", subtext: "Start your first adventure by tapping the record button below", a prominent "Record" call-to-action button |
| Loading | Initial data fetch or pagination load | Skeleton placeholder cards (3 cards with pulsing gray shapes matching the card layout) |
| Populated | One or more tracks exist | Scrollable list of track cards with summary stats bar at top |
| Filtered - No Results | Tracks exist but none match the active filters | Text: "No matching activities", subtext: "Try adjusting your filters", a "Clear Filters" button |
| Error | Database query failed | Text: "Could not load your activities", a "Try Again" button |

**Interactions:**
- Tap a track card: Navigate to Trail Detail screen for that track
- Swipe left on a track card: Reveals a red "Delete" action button
- Tap "Delete" (after swipe): Confirmation dialog: "Delete [track name]? This cannot be undone." with Cancel and Delete buttons
- Long-press a track card: Opens context menu with Rename, Export GPX, Favorite/Unfavorite, Delete
- Tap a filter chip: Filters the list to that activity type. "All" clears the activity type filter. Multiple chips cannot be selected simultaneously.
- Tap sort/filter button: Opens a bottom sheet with sort options (Date newest, Date oldest, Distance longest, Distance shortest, Elevation gain most, Elevation gain least, Duration longest, Duration shortest) and date range filter (presets + custom date picker)
- Pull-to-refresh: Refreshes the list (relevant if data was modified externally, e.g., GPX import)

**Transitions/Animations:**
- Track cards animate in on initial load with a staggered fade-in (50ms delay between cards)
- Deleted items animate out with a slide-left + fade, 250ms duration
- Filter chip selection animates the highlight with a 150ms transition

##### Bottom Sheet: Sort and Filter

**Layout:**
- A bottom sheet sliding up from the bottom of the screen
- Section 1: "Sort By" with a list of radio-button options (Date, Distance, Elevation Gain, Duration) each with an ascending/descending toggle
- Section 2: "Date Range" with preset buttons (This Week, This Month, Last 30 Days, This Year, All Time) and a "Custom Range" option that expands to show two date pickers (start/end)
- Section 3: "Show Only" with a toggle for "Favorites Only"
- An "Apply" button at the bottom and a "Reset" text button at the top-right

#### 3.6 Data Requirements

This feature uses the Track entity defined in TR-001. No new entities are introduced.

**Derived Data:**
- Route preview thumbnails: Generated from TrackPoint data, rendered as a static map image (64x64px) with the route polyline drawn on a map tile background. Thumbnails are cached after first generation.
- Summary stats: Computed by aggregating across the filtered Track result set.

**Queries:**
- List tracks with pagination: SELECT from Track ORDER BY [sort_field] [direction] LIMIT 20 OFFSET [page * 20]
- Filter by activity_type: WHERE activity_type = [selected_type]
- Filter by date range: WHERE started_at >= [start] AND started_at <= [end]
- Filter by favorites: WHERE is_favorite = true
- Summary aggregation: SELECT COUNT(*), SUM(distance_m), SUM(elevation_gain_m) FROM Track WHERE [filters]

#### 3.7 Business Logic Rules

##### Track Card Summary Generation

**Purpose:** Generate the display text for a track card in the history list.

**Inputs:**
- track: Track record

**Logic:**

```
1. name = track.name OR auto-generated name from date + activity_type
2. date_display = format track.started_at as "Mon DD, YYYY" (e.g., "Mar 6, 2026")
3. time_display = format track.started_at as "h:mm a" (e.g., "8:15 AM")
4. distance_display = format distance_m with user's preferred unit:
   a. IF user prefers metric: format as km with 1 decimal (e.g., "9.7 km")
   b. IF user prefers imperial: convert to miles and format with 1 decimal (e.g., "6.0 mi")
5. time_stat = format elapsed_time_ms as "Xh Ym" for durations >= 1 hour, "Xm Ys" for shorter
6. elevation_display = format elevation_gain_m with user's preferred unit:
   a. IF metric: meters with 0 decimals (e.g., "487 m")
   b. IF imperial: convert to feet with 0 decimals (e.g., "1,598 ft")
7. RETURN formatted card data
```

**Edge Cases:**
- Track with zero distance: Display "0.0 km" (not blank or "N/A")
- Track with null elevation_gain_m: Display "-- m" for elevation stat
- Track with very long name (>40 chars): Truncate with ellipsis in the card, full name visible on detail screen

##### Sort and Filter Logic

**Purpose:** Apply user-selected sort and filter criteria to the track list query.

**Inputs:**
- sort_field: enum (date, distance, elevation_gain, duration)
- sort_direction: enum (asc, desc)
- activity_type_filter: enum or null
- date_range_start: datetime or null
- date_range_end: datetime or null
- favorites_only: boolean

**Logic:**

```
1. Start with base query: all Track records
2. IF activity_type_filter is not null:
     Filter WHERE activity_type = activity_type_filter
3. IF date_range_start is not null:
     Filter WHERE started_at >= date_range_start
4. IF date_range_end is not null:
     Filter WHERE started_at <= date_range_end (set to end of day 23:59:59)
5. IF favorites_only is true:
     Filter WHERE is_favorite = true
6. Apply sort:
   a. date -> ORDER BY started_at [direction]
   b. distance -> ORDER BY distance_m [direction], started_at DESC (tiebreaker)
   c. elevation_gain -> ORDER BY elevation_gain_m [direction], started_at DESC
   d. duration -> ORDER BY elapsed_time_ms [direction], started_at DESC
7. Apply pagination: LIMIT 20 OFFSET page * 20
8. RETURN results
```

**Default sort:** Date newest first (started_at DESC)

**Edge Cases:**
- All filters active and no results match: Display "No matching activities" empty state
- Switching filters while scrolled deep in the list: Reset to page 0 and scroll to top

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database query fails | Error state: "Could not load your activities" with a "Try Again" button | User taps "Try Again" to retry the query |
| Track deletion fails | Toast notification: "Could not delete activity. Please try again." | User retries the delete action via swipe or context menu |
| Route preview thumbnail fails to render | A solid-color placeholder (module accent color with a trail icon) is shown instead of the map thumbnail | No action needed. The thumbnail regenerates next time the list is loaded |
| Pagination fails (next page load error) | A "Load More" retry button appears at the bottom of the list instead of the loading spinner | User taps "Load More" to retry |

**Validation Timing:**
- No user input validation required (this is a read-only list with filter controls)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has recorded 5 hikes over the past month,
   **When** they navigate to the Trail History screen,
   **Then** all 5 hikes appear in reverse chronological order, each showing name, date, distance, time, elevation gain, activity type icon, and a route preview thumbnail.

2. **Given** the history contains hikes, runs, and bike rides,
   **When** the user taps the "Run" filter chip,
   **Then** only runs are displayed, the summary stats update to reflect runs only, and the "Run" chip is highlighted.

3. **Given** the history is sorted by date (default),
   **When** the user opens the sort sheet and selects "Distance - Longest First",
   **Then** the list reorders with the longest track at the top and the summary stats remain unchanged (they reflect filters, not sort order).

**Edge Cases:**

4. **Given** no tracks have been recorded,
   **When** the user navigates to the Trail History screen,
   **Then** the empty state is displayed with an illustration, "No activities yet" message, and a "Record" button that navigates to the Recording Screen.

5. **Given** the user has 200 recorded tracks,
   **When** they scroll through the list,
   **Then** the first 20 load immediately, and additional pages of 20 load seamlessly as the user scrolls near the bottom, with no perceptible lag or duplicate entries.

**Negative Tests:**

6. **Given** the user swipes left on a track and taps "Delete",
   **When** the confirmation dialog appears and the user taps "Cancel",
   **Then** the track is not deleted and remains in the list at its original position.
   **And** no data is modified.

7. **Given** filters are applied and zero tracks match,
   **When** the user views the filtered list,
   **Then** the "No matching activities" state is shown with a "Clear Filters" button.
   **And** tapping "Clear Filters" resets all filters and shows the full unfiltered list.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| formats distance in km for metric preference | distance_m: 9654.3, unit: metric | "9.7 km" |
| formats distance in miles for imperial preference | distance_m: 9654.3, unit: imperial | "6.0 mi" |
| formats duration as hours and minutes | elapsed_time_ms: 11820000 | "3h 17m" |
| formats duration as minutes and seconds for short activities | elapsed_time_ms: 185000 | "3m 5s" |
| formats elevation gain in meters | elevation_gain_m: 487.2, unit: metric | "487 m" |
| formats elevation gain in feet | elevation_gain_m: 487.2, unit: imperial | "1,598 ft" |
| truncates long track name at 40 chars | name: "A really long trail name that exceeds the maximum character limit for cards" | "A really long trail name that exceeds t..." |
| summary stats aggregate correctly across filtered set | 3 tracks: 5km, 10km, 8km | total distance: 23 km, count: 3 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Filter and sort combination | 1. Record 3 hikes and 2 runs, 2. Filter to hikes only, 3. Sort by distance longest first | Only 3 hikes shown, ordered by distance descending |
| Delete track updates list and stats | 1. View history with 5 tracks, 2. Delete 1 track, 3. Check list and stats | 4 tracks remain, summary stats recalculated without the deleted track |
| Pagination across filter change | 1. Load 30 tracks (page 1 + page 2 loaded), 2. Apply activity type filter, 3. Verify list | List resets to page 1, shows first 20 matching results |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Browse and review past activities | 1. Record 3 activities over 3 days, 2. Open Trail History, 3. Verify all 3 appear, 4. Tap the first one, 5. View Trail Detail, 6. Go back, 7. Filter to runs only | Trail History shows correct count and stats. Detail screen shows full route and stats. Filter correctly narrows the list. |

---

### TR-003: Route Display on Map

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-003 |
| **Feature Name** | Route Display on Map |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a day hiker, I want to see my completed hike drawn on an interactive map so that I can see exactly where I went and explore the surrounding area.

**Secondary:**
> As a backpacker, I want to see a planned route overlaid on the map so that I can study the trail before heading out and identify landmarks and decision points.

#### 3.3 Detailed Description

Route Display on Map renders GPS tracks as colored polylines on an interactive map. This is used in two primary contexts: viewing a completed activity (Trail Detail screen) and live recording (Recording Screen, covered in TR-001). This feature specification covers the post-activity route display.

The map displays the full route polyline fitted to the screen bounds with appropriate padding. The polyline is colored using the module's accent color by default, but can be configured to use a gradient based on elevation, speed, or pace (each point colored on a spectrum from green to red based on the metric value). Start and end points are marked with distinct icons (green flag for start, red flag for finish).

The map supports standard gestures: pinch-to-zoom, pan, and rotation. Users can tap on any point along the route to see a tooltip with the metrics at that location: timestamp, elevation, speed, distance from start, and elapsed time from start. This "scrubbing" interaction lets users understand exactly what happened at each point of the route.

The map uses OpenStreetMap tile data by default, with support for topographic overlay (showing contour lines) and satellite imagery. Map style is selectable from a map layer control in the top-right corner of the map view.

Waypoints (see TR-015) and geotagged photos (see TR-008) placed during the activity appear as interactive markers on the route. Tapping a photo marker shows the photo in a popup; tapping a waypoint marker shows the waypoint name and notes.

The map renders using the slippy map tile convention, where tile coordinates are calculated from geographic coordinates and zoom level. This allows the same rendering logic to work with any tile server that follows the z/x/y URL pattern.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Provides the TrackPoint data used to draw the route polyline

**External Dependencies:**
- Map tile data (either downloaded offline tiles or network access to fetch tiles from OpenStreetMap)
- Device GPU for map rendering performance

**Assumed Capabilities:**
- The app can render an interactive map component with polyline overlay
- The app can calculate tile coordinates from geographic coordinates

#### 3.5 User Interface Requirements

##### Screen: Route Map View (within Trail Detail)

**Layout:**
- The map occupies the top portion of the Trail Detail screen (approximately 60% of screen height) or can be expanded to full-screen by tapping an expand button
- The route polyline is drawn with 3px width in the module accent color (or gradient if a color mode is selected)
- A green flag marker at the first TrackPoint and a red flag marker at the last TrackPoint
- Waypoint markers appear as pin icons at their GPS positions along the route
- Photo markers appear as small circular photo thumbnails at their GPS positions
- A map layer control button in the top-right corner (stacked layers icon) opens a selector for: Standard (OpenStreetMap), Topographic (contour lines overlay), and Satellite
- A "Fit Route" button in the bottom-right corner re-centers and zooms the map to fit the entire route with padding
- When the user taps on the route polyline, a tooltip card appears at that point showing: time (e.g., "8:32 AM"), elevation (e.g., "245 m"), speed (e.g., "4.2 km/h"), distance from start (e.g., "3.2 km"), and elapsed time (e.g., "42 min")

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loading | Map tiles are being fetched or route is being rendered | Map area shows a loading spinner over a placeholder background |
| Rendered | Route and tiles are loaded | Full interactive map with route polyline, start/end markers, waypoint markers, photo markers |
| No Tiles Available | Offline and no cached tiles for this area | Route polyline is drawn on a blank/gray background with a message: "Map tiles not available offline. Download this region for offline viewing." |
| Full-Screen | User expanded the map | Map fills the entire screen. A close/collapse button appears in the top-left. Stats panel and other Trail Detail elements are hidden. |
| Tooltip Active | User tapped on the route polyline | A tooltip card is displayed at the tapped location with point-level metrics. Tapping elsewhere on the map dismisses the tooltip. |

**Interactions:**
- Pinch-to-zoom: Adjusts map zoom level. Loads new tile detail levels as needed.
- Pan/drag: Moves the map viewport. The "Fit Route" button appears if the route is no longer fully visible.
- Tap on route polyline: Displays tooltip with metrics at the nearest TrackPoint to the tap location.
- Tap on photo marker: Opens a photo preview popup showing the geotagged image.
- Tap on waypoint marker: Opens a small card with the waypoint name and notes.
- Tap "Fit Route" button: Animates the map back to fit the entire route with padding.
- Tap map layer button: Opens a popover with three map style options (Standard, Topographic, Satellite).
- Tap expand button: Transitions the map to full-screen mode.
- Double-tap: Zooms in one level centered on the tap location.

**Transitions/Animations:**
- Map zoom transitions smoothly with eased animation (300ms)
- "Fit Route" re-centering uses a fly-to animation (500ms, ease-in-out)
- Tooltip appears with a fade-in + scale-up animation (150ms)
- Route polyline draws in with a progressive animation on initial load (the line extends from start to finish over 1 second)

#### 3.6 Data Requirements

This feature uses TrackPoint data from TR-001 and Waypoint/Photo entities from TR-015 and TR-008. No new entities are introduced.

**Derived Data:**

##### Computed: Slippy Map Tile Coordinates

| Field | Type | Description |
|-------|------|-------------|
| tile_x | integer | Horizontal tile number at the given zoom level |
| tile_y | integer | Vertical tile number at the given zoom level |
| zoom | integer | Map zoom level (0-19) |

**Tile URL Pattern:** `https://tile.openstreetmap.org/{zoom}/{tile_x}/{tile_y}.png`

##### Computed: Route Bounding Box

| Field | Type | Description |
|-------|------|-------------|
| ne_lat | float | Northeast corner latitude (maximum latitude) |
| ne_lon | float | Northeast corner longitude (maximum longitude) |
| sw_lat | float | Southwest corner latitude (minimum latitude) |
| sw_lon | float | Southwest corner longitude (minimum longitude) |

#### 3.7 Business Logic Rules

##### Slippy Map Tile Coordinate Calculation

**Purpose:** Convert a geographic coordinate (latitude, longitude) and zoom level into tile x,y coordinates for fetching the correct map tile image.

**Inputs:**
- lat: float - Latitude in decimal degrees
- lon: float - Longitude in decimal degrees
- zoom: integer - Map zoom level (0 to 19)

**Logic:**

```
1. n = 2^zoom
2. tile_x = floor((lon + 180) / 360 * n)
3. lat_rad = lat * pi / 180
4. tile_y = floor((1 - log(tan(lat_rad) + 1/cos(lat_rad)) / pi) / 2 * n)
5. Clamp tile_x to range [0, n-1]
6. Clamp tile_y to range [0, n-1]
7. RETURN { tile_x, tile_y, zoom }
```

**Formulas:**
- x = floor((lon + 180) / 360 * 2^zoom)
- y = floor((1 - log(tan(lat * pi/180) + 1/cos(lat * pi/180)) / pi) / 2 * 2^zoom)

**Edge Cases:**
- Longitude exactly at -180 or 180: Clamp tile_x to valid range [0, 2^zoom - 1]
- Latitude near the poles (above 85.0511 or below -85.0511): The Mercator projection is undefined; clamp to the valid range
- Zoom level 0: Returns tile (0,0) which covers the entire world
- Zoom level 19: Maximum detail, tiles cover approximately 30m x 30m at the equator

##### Route Bounding Box Calculation

**Purpose:** Determine the geographic bounds of a route to fit the map view.

**Inputs:**
- points: array of TrackPoint

**Logic:**

```
1. IF points is empty, RETURN null
2. ne_lat = max(point.latitude for all points)
3. ne_lon = max(point.longitude for all points)
4. sw_lat = min(point.latitude for all points)
5. sw_lon = min(point.longitude for all points)
6. Add padding: expand each boundary by 10% of the range
   lat_padding = (ne_lat - sw_lat) * 0.10
   lon_padding = (ne_lon - sw_lon) * 0.10
   ne_lat = ne_lat + lat_padding
   ne_lon = ne_lon + lon_padding
   sw_lat = sw_lat - lat_padding
   sw_lon = sw_lon - lon_padding
7. Clamp to valid coordinate ranges:
   ne_lat = min(ne_lat, 90.0)
   sw_lat = max(sw_lat, -90.0)
   ne_lon = min(ne_lon, 180.0)
   sw_lon = max(sw_lon, -180.0)
8. RETURN { ne_lat, ne_lon, sw_lat, sw_lon }
```

**Edge Cases:**
- Single point: Bounding box is a small area around that point (padding applied to a zero-range box results in a small square)
- Route crossing the 180th meridian: sw_lon may be greater than ne_lon; map renderers handle this with wrapped coordinates
- Route near the poles: Padding clamped to valid lat range

##### Route Polyline Color Gradient

**Purpose:** When gradient color mode is active, assign a color to each route segment based on a selected metric (elevation, speed, or pace).

**Inputs:**
- points: array of TrackPoint with the metric values
- metric: enum (elevation, speed, pace)
- color_range: pair of colors (start_color, end_color), default green to red

**Logic:**

```
1. Extract metric values from all points:
   a. elevation: point.elevation_m
   b. speed: point.speed_m_per_s
   c. pace: inverse of speed (seconds per meter)
2. Find min_value and max_value across all non-null metric values
3. IF min_value equals max_value (all same):
     Use a single color (midpoint of gradient) for all segments
     RETURN
4. FOR each consecutive pair of points (p1, p2):
   a. metric_value = average of p1 and p2 metric values
   b. normalized = (metric_value - min_value) / (max_value - min_value)
   c. segment_color = interpolate(start_color, end_color, normalized)
5. RETURN array of segment colors
```

**Edge Cases:**
- Points with null metric values: Use the nearest non-null value, or default to midpoint color
- Only 1 point: No segments to color
- All metric values identical: Use uniform midpoint color

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Map tiles fail to load (network error) | Map background shows gray/blank tiles with a subtle "Tiles unavailable" label. Route polyline still renders on the blank background. | User can still view the route shape. A "Retry" button appears on the map. |
| TrackPoint data is corrupted or missing | Map shows start/end markers but no polyline. Message: "Route data could not be loaded." | User can still see stats on the Trail Detail screen. Route display is a visual enhancement. |
| Too many TrackPoints to render smoothly (>10,000) | The system applies Douglas-Peucker line simplification to reduce point count to under 5,000 for display while preserving the route shape. No user-facing indicator. | Automatic, no user action needed. Full data is preserved in storage; only the display is simplified. |
| Tap on route misses the polyline (tap too far from the nearest point) | No tooltip appears. No error shown. | User taps closer to the route line. Hit detection uses a 20px tolerance around the polyline. |

**Validation Timing:**
- Route data validity is checked on screen load
- Tile availability is checked per-tile as the map viewport changes

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a completed track with 500 TrackPoints,
   **When** the user opens the Trail Detail screen,
   **Then** the map displays the full route as a colored polyline with green start marker and red finish marker, fitted to the screen with padding.

2. **Given** the route map is displayed,
   **When** the user taps on a point along the route polyline,
   **Then** a tooltip appears showing the timestamp, elevation, speed, distance from start, and elapsed time at that point.

3. **Given** the map is showing the standard OpenStreetMap style,
   **When** the user taps the layer control and selects "Topographic",
   **Then** the map tiles transition to show contour lines overlaid on the base map, and the route polyline remains visible.

**Edge Cases:**

4. **Given** the device is offline and map tiles for the route area are not cached,
   **When** the user opens the Trail Detail screen,
   **Then** the route polyline is drawn on a gray/blank background with a message "Map tiles not available offline" and the route shape is still clearly visible.

5. **Given** a track with 15,000 TrackPoints,
   **When** the map renders the route,
   **Then** the polyline is displayed smoothly using line simplification (no visible jitter or lag), and the user can zoom in to see full-resolution detail in the visible area.

**Negative Tests:**

6. **Given** a track where all TrackPoints have corrupted coordinate data (latitude/longitude of 0,0),
   **When** the user opens the Trail Detail screen,
   **Then** the map shows an error message "Route data could not be loaded" rather than drawing a line to the Gulf of Guinea.
   **And** the stats and other Trail Detail information are still displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| tile coordinates at zoom 0 for (0,0) | lat=0, lon=0, zoom=0 | tile_x=0, tile_y=0 |
| tile coordinates for San Francisco at zoom 10 | lat=37.7749, lon=-122.4194, zoom=10 | tile_x=163, tile_y=395 |
| tile coordinates at max zoom 19 | lat=37.7749, lon=-122.4194, zoom=19 | tile_x=83886, tile_y=202519 |
| tile coordinates clamp at 180 longitude | lat=0, lon=180, zoom=5 | tile_x=31 (clamped to 2^5 - 1) |
| bounding box for single point | one point at (37.7, -122.4) | ne and sw are slightly padded around that point |
| bounding box for two points | (37.7, -122.4) and (37.8, -122.3) | ne=(37.81, -122.29), sw=(37.69, -122.41) with 10% padding |
| bounding box clamps to valid ranges | points near (89.9, 179.9) | ne_lat clamped to 90.0, ne_lon clamped to 180.0 |
| gradient color for uniform metric | all elevations = 100m | all segments use midpoint color |
| gradient color for varied metric | elevations: [100, 200, 300] | 3-color gradient from start_color to end_color |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Route renders on map with markers | 1. Save a track with 100 points, 2 waypoints, 1 photo, 2. Open Trail Detail | Map shows polyline, start/end markers, 2 waypoint pins, 1 photo marker |
| Map style switching | 1. View route on Standard map, 2. Switch to Topographic, 3. Switch to Satellite | Each style renders correctly with the route polyline visible on all three |
| Tooltip interaction | 1. View route on map, 2. Tap on the route polyline at different points | Tooltip appears with correct per-point metrics, dismissed when tapping elsewhere |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Review a completed hike route | 1. Record a hike, 2. Save it, 3. Open Trail Detail, 4. Pan and zoom the map, 5. Tap on route for tooltip, 6. Switch to topographic view, 7. Tap "Fit Route" to re-center | Map shows the full route with correct markers. Tooltip shows accurate per-point data. Map style changes persist. Fit Route re-centers the view. |

---

### TR-004: Elevation Profile

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-004 |
| **Feature Name** | Elevation Profile |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a day hiker, I want to see an elevation profile chart for my completed hike so that I can understand where the steep climbs and descents were along the route.

**Secondary:**
> As a backpacker, I want to view the elevation profile of a planned route before starting so that I can assess the difficulty and plan rest stops at appropriate locations.

**Tertiary:**
> As a trail runner, I want to see my elevation profile annotated with pace data so that I can understand how terrain affects my running speed.

#### 3.3 Detailed Description

The Elevation Profile is a 2D chart that plots elevation (vertical axis) against distance traveled (horizontal axis) for a recorded or planned route. This chart is one of the most important analytical tools for outdoor activities because it reveals the cumulative climbing effort, steepness of individual segments, and overall terrain character of a route that a flat map cannot convey.

The chart is displayed below the route map on the Trail Detail screen. It shows a filled area chart with the elevation line on top and a subtle gradient fill extending down to the x-axis. The y-axis is labeled in meters or feet (based on user preference), and the x-axis is labeled in kilometers or miles.

Users can interact with the chart by dragging a finger along the elevation line to "scrub" through the route. As the user scrubs, a vertical crosshair line follows their finger position, and a tooltip at the top of the chart shows the exact elevation, distance from start, and gradient (slope percentage) at that point. Simultaneously, the corresponding point on the route map above highlights with a marker that moves along the polyline, creating a linked map-chart interaction.

The chart also marks notable points: the highest point (marked with a mountain peak icon and elevation label), the lowest point (marked with a valley icon and elevation label), and any waypoints placed along the route. If the route has multiple segments (from pause/resume), segment boundaries are shown as subtle vertical dashed lines.

The elevation data may come from GPS altitude readings (which can be noisy) or from a device barometer (more accurate for relative changes). The 3-meter noise filter described in TR-001 applies to the source data before gain/loss calculations, but the chart displays the full elevation profile (including sub-3m variations) for visual completeness. A smoothing option is available to reduce visual noise.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Provides TrackPoint data with elevation values

**External Dependencies:**
- None (all data is computed from stored TrackPoints)

**Assumed Capabilities:**
- The app can render a 2D area chart with interactive scrubbing
- The app can synchronize interactions between the chart and the route map

#### 3.5 User Interface Requirements

##### Component: Elevation Profile Chart (within Trail Detail)

**Layout:**
- The chart occupies the full width of the screen and approximately 200px in height, positioned below the route map on the Trail Detail screen
- The y-axis (left side) shows elevation values in the user's preferred unit (meters or feet) with 4-6 evenly spaced horizontal gridlines
- The x-axis (bottom) shows distance values in the user's preferred unit (km or mi) with labels at regular intervals
- The elevation line is drawn as a smooth curve (using cardinal spline interpolation with tension 0.5) in the module accent color
- Below the line, a gradient fill extends from the line to the x-axis (accent color at 30% opacity fading to transparent)
- The highest point is marked with a small upward-pointing triangle icon and an elevation label above the curve
- The lowest point is marked with a small downward-pointing triangle icon and an elevation label below the curve (or at the curve if at the bottom)
- Segment boundaries (from pauses) are shown as vertical dashed lines in a subtle gray
- Above the chart, a row of summary stats is displayed: Total Gain, Total Loss, Max Elevation, Min Elevation

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Elevation Data | All TrackPoints have null elevation_m | Chart area shows message: "Elevation data not available for this activity" |
| Partial Elevation Data | Some points have elevation, some do not | Chart draws the available segments with gaps where elevation is null. A note: "Partial elevation data" appears below the chart. |
| Normal | Full elevation data available | Complete elevation profile chart with all markers and interactive scrubbing |
| Scrubbing Active | User is dragging along the chart | Vertical crosshair line follows the finger. Tooltip shows elevation, distance, and gradient at the scrubbed point. Map marker moves to the corresponding GPS position. |
| Smoothed | User has toggled the smoothing option | Chart applies a moving average smoothing (window size 5 points) to reduce visual noise while preserving the general elevation shape |

**Interactions:**
- Drag finger horizontally across the chart: Moves a vertical crosshair to the finger position. A tooltip appears showing elevation, distance from start, and gradient percentage. The route map simultaneously highlights the corresponding point with a moving marker.
- Tap the chart (without dragging): Shows the crosshair at the tap point, then dismisses after 3 seconds of inactivity
- Tap "Smoothing" toggle (if visible): Toggles between raw and smoothed elevation display
- Pinch horizontally on the chart: Zooms in on a section of the elevation profile (reveals more detail for a shorter distance range). A "Reset Zoom" button appears when zoomed in.

**Transitions/Animations:**
- Chart draws in from left to right on initial load (progressive reveal animation, 800ms)
- Crosshair follows finger with zero-lag real-time tracking
- Map marker movement syncs with chart scrubbing at 60fps

#### 3.6 Data Requirements

This feature uses TrackPoint data from TR-001 (specifically elevation_m and the computed cumulative distance at each point). No new entities are introduced.

**Derived Data:**

##### Computed: ElevationProfilePoint (in-memory only, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| distance_from_start_m | float | Cumulative Haversine distance from the first point to this point |
| elevation_m | float | Elevation at this point (from TrackPoint.elevation_m) |
| gradient_pct | float | Slope percentage between this point and the previous point |
| latitude | float | For linking to the map position |
| longitude | float | For linking to the map position |

#### 3.7 Business Logic Rules

##### Gradient (Slope) Calculation

**Purpose:** Calculate the slope percentage between two consecutive points to display gradient information during chart scrubbing.

**Inputs:**
- elevation_1: float - Elevation at the first point in meters
- elevation_2: float - Elevation at the second point in meters
- horizontal_distance_m: float - Haversine distance between the two points in meters

**Logic:**

```
1. IF horizontal_distance_m <= 0:
     RETURN 0.0 (no slope if no horizontal movement)
2. elevation_change = elevation_2 - elevation_1
3. gradient_pct = (elevation_change / horizontal_distance_m) * 100
4. Clamp gradient_pct to range [-100, 100] (vertical cliffs)
5. RETURN gradient_pct
```

**Formulas:**
- gradient_pct = (elevation_change / horizontal_distance) * 100
- Positive values indicate uphill, negative values indicate downhill

**Edge Cases:**
- Zero horizontal distance (same GPS point): Return 0.0%
- Vertical cliff (horizontal distance near zero but elevation change significant): Clamp to +/-100%
- Both points have null elevation: Return null (display "N/A")

##### Elevation Profile Data Preparation

**Purpose:** Transform raw TrackPoint data into a series of chart-ready data points with cumulative distance and computed gradient.

**Inputs:**
- points: array of TrackPoint - Ordered by timestamp

**Logic:**

```
1. profile_points = []
2. cumulative_distance = 0.0
3. prev_point = null
4. FOR each point in points (ordered by timestamp):
   a. IF point.elevation_m is null, SKIP
   b. IF point.is_low_confidence is true, SKIP
   c. IF prev_point is not null:
        segment_dist = haversine(prev_point.lat, prev_point.lon, point.lat, point.lon)
        cumulative_distance = cumulative_distance + segment_dist
        gradient = ((point.elevation_m - prev_point.elevation_m) / segment_dist) * 100
        IF segment_dist <= 0: gradient = 0.0
   d. ELSE:
        gradient = 0.0
   e. profile_points.append({
        distance_from_start_m: cumulative_distance,
        elevation_m: point.elevation_m,
        gradient_pct: clamp(gradient, -100, 100),
        latitude: point.latitude,
        longitude: point.longitude
      })
   f. prev_point = point
5. RETURN profile_points
```

**Edge Cases:**
- All elevation data is null: Return empty array (triggers "No Elevation Data" state)
- Only 1 valid elevation point: Return array with 1 point (chart shows a single dot, gradient = 0)
- GPS points are very close together (sub-meter): Gradient may be extreme; clamping prevents visual artifacts

##### Moving Average Smoothing

**Purpose:** Apply a simple moving average to the elevation profile to reduce GPS altitude noise for visual display.

**Inputs:**
- profile_points: array of ElevationProfilePoint
- window_size: integer - Number of points to average (default: 5)

**Logic:**

```
1. IF profile_points.length <= window_size:
     RETURN profile_points unchanged (too few points to smooth)
2. smoothed = []
3. half_window = floor(window_size / 2)
4. FOR i = 0 to profile_points.length - 1:
   a. start = max(0, i - half_window)
   b. end = min(profile_points.length - 1, i + half_window)
   c. avg_elevation = average(profile_points[start..end].elevation_m)
   d. smoothed.append(profile_point with elevation_m = avg_elevation, all other fields unchanged)
5. RETURN smoothed
```

**Edge Cases:**
- Window size larger than data: Return original data unmodified
- Single point: Return as-is
- Window at edges of data: Use a smaller window (asymmetric averaging at boundaries)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No elevation data in TrackPoints | Chart area shows: "Elevation data not available for this activity" | No action needed. Elevation is supplementary data. |
| Partial elevation data (gaps) | Chart draws available segments with visible gaps. A note appears: "Partial elevation data" | No action needed. |
| Extremely noisy elevation data (oscillations >50m within seconds) | Smoothing toggle is shown prominently, defaulted to ON. Raw data is still available by toggling off. | User can toggle smoothing on/off. |
| Chart rendering fails (memory or computation) | Chart area shows: "Could not render elevation profile" | User can try scrolling away and back, which triggers a re-render. |

**Validation Timing:**
- Elevation data availability is checked when the Trail Detail screen loads
- Chart data is computed once and cached for the lifetime of the screen

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a completed hike with 500 TrackPoints all having elevation data,
   **When** the user opens the Trail Detail screen and scrolls to the elevation profile,
   **Then** a smooth elevation chart is displayed with labeled axes, total gain/loss stats above, and the highest and lowest points marked.

2. **Given** the elevation profile chart is visible,
   **When** the user drags their finger horizontally across the chart,
   **Then** a crosshair follows the finger showing exact elevation, distance from start, and gradient percentage in a tooltip, and the route map above moves a marker to the corresponding GPS position.

3. **Given** a route with 300m elevation gain over 10 km,
   **When** the chart is displayed,
   **Then** the y-axis spans from slightly below the minimum elevation to slightly above the maximum elevation, the x-axis shows 0 to 10 km, and the filled area visually conveys the terrain profile.

**Edge Cases:**

4. **Given** a track with no elevation data (all TrackPoints have null elevation_m),
   **When** the user opens the Trail Detail screen,
   **Then** the elevation profile area shows "Elevation data not available for this activity" instead of an empty chart.

5. **Given** a track with very noisy GPS altitude data (oscillations of 20-50m over flat terrain),
   **When** the user toggles the "Smoothing" option to ON,
   **Then** the chart displays a smoothed version that removes high-frequency noise while preserving genuine elevation changes.

**Negative Tests:**

6. **Given** a track with exactly 1 TrackPoint that has elevation data,
   **When** the chart attempts to render,
   **Then** the chart shows a single elevation dot and displays the elevation value, with gradient showing 0%.
   **And** no crash or error occurs.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| gradient for flat terrain | elev1=100, elev2=100, dist=100 | 0.0% |
| gradient for 10% uphill slope | elev1=100, elev2=110, dist=100 | 10.0% |
| gradient for steep downhill | elev1=200, elev2=100, dist=50 | -200.0% clamped to -100.0% |
| gradient for zero horizontal distance | elev1=100, elev2=200, dist=0 | 0.0% |
| profile preparation with valid data | 5 points with elevations [100, 110, 105, 120, 115] | 5 profile points with correct cumulative distances and gradients |
| profile preparation skips null elevations | 5 points, 2 with null elevation_m | 3 profile points |
| profile preparation skips low-confidence points | 5 points, 1 with is_low_confidence=true | 4 profile points |
| moving average smoothing with window 3 | elevations: [100, 200, 100, 200, 100] | smoothed values centered around 133-167 range |
| moving average with window > data length | 3 points, window=5 | original data returned unchanged |
| cumulative distance correct across profile | 4 points with known lat/lon | cumulative distances match sum of Haversine segments |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Chart-map linked scrubbing | 1. Open Trail Detail for a recorded track, 2. Drag finger across elevation chart | Map marker moves along the route in sync with the chart crosshair position |
| Segment boundaries on chart | 1. Record a track with 1 pause/resume (2 segments), 2. Open elevation profile | A vertical dashed line appears at the distance where the pause occurred |
| Smoothing toggle | 1. View elevation profile (noisy data), 2. Toggle smoothing ON, 3. Toggle smoothing OFF | Chart transitions between smoothed and raw views, preserving the crosshair position |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Analyze a mountain hike elevation | 1. Record a hike with 800m elevation gain, 2. Open Trail Detail, 3. Scroll to elevation profile, 4. Scrub to the highest point, 5. Note the peak elevation from tooltip | Chart shows the full climb and descent. Peak marker matches the tooltip value. Total gain stat above chart shows approximately 800m. Map marker is at the summit position. |

---

### TR-005: Trail Statistics Dashboard

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-005 |
| **Feature Name** | Trail Statistics Dashboard |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a day hiker, I want to see a dashboard of my overall hiking statistics so that I can track my progress and feel motivated by my cumulative accomplishments.

**Secondary:**
> As a trail runner, I want to compare my weekly and monthly running stats so that I can identify training trends and ensure I am meeting my distance goals.

**Tertiary:**
> As a weekend explorer, I want to see my year-in-review stats so that I can share my annual outdoor accomplishments with friends and family.

#### 3.3 Detailed Description

The Trail Statistics Dashboard aggregates data from all recorded tracks to present a comprehensive view of the user's outdoor activity history. It serves both as a motivational tool (showing cumulative accomplishments) and an analytical tool (revealing trends and patterns over time).

The dashboard is organized into three sections. The first section displays all-time summary stats: total number of activities, total distance, total elevation gain, total elapsed time, and the longest single activity. These are displayed as large, prominent numbers in a card layout.

The second section presents time-based analytics. Users can select a time period (This Week, This Month, This Year, All Time, or a custom date range) to view stats for that window. Within the selected period, the dashboard shows: total activities, total distance, total time, total elevation gain, average distance per activity, average pace, and a bar chart or line chart showing activity frequency (activities per day/week/month depending on the selected range).

The third section highlights personal records: longest distance, most elevation gain, fastest pace (per activity type), longest duration, and highest elevation reached. Each record shows the track name and date.

The dashboard also provides a breakdown by activity type. If the user has recorded hikes, runs, and bike rides, each type gets its own mini-stats section with type-specific totals.

All statistics are computed from locally stored Track data. No network requests are involved. Statistics update in real time when a new activity is saved or an existing one is deleted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Provides the Track data to aggregate
- TR-002: Trail History Log - Users navigate from the history to the dashboard

**External Dependencies:**
- None (all computation is local)

**Assumed Capabilities:**
- The app can perform aggregate queries on the Track table efficiently
- The app can render bar/line charts for activity frequency visualization

#### 3.5 User Interface Requirements

##### Screen: Stats Dashboard

**Layout:**
- A top navigation bar with the title "Stats"
- Below is a time period selector: a segmented control with options "Week", "Month", "Year", "All Time". A calendar icon to the right opens a custom date range picker.
- **Section 1 - Overview Cards:** A horizontally scrollable row of stat cards (each approximately 120px wide). Each card shows a large number (primary stat), a label below (e.g., "Total Distance"), and a small icon above. Cards include: Total Activities, Total Distance, Total Elevation Gain, Total Time, Average Distance.
- **Section 2 - Activity Frequency Chart:** A bar chart showing the number of activities per unit time. For "Week" view: 7 bars (Mon-Sun). For "Month" view: up to 31 bars (day 1-31). For "Year" view: 12 bars (Jan-Dec). For "All Time": bars grouped by month. Each bar is colored by activity type if mixed.
- **Section 3 - Personal Records:** A vertical list of record cards, each showing: record type label (e.g., "Longest Hike"), value (e.g., "24.3 km"), track name (e.g., "Half Dome Day Hike"), and date (e.g., "Jun 14, 2026"). A small trophy icon appears next to each record.
- **Section 4 - Activity Type Breakdown:** If the user has tracked multiple activity types, each type is shown as a collapsible section with its own totals (count, distance, time, elevation gain, average pace). Each section has the activity type icon and name as its header.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No tracks recorded | Illustration with text: "No stats yet. Record your first activity to see your statistics here." with a "Record" button |
| Loading | Stats are being computed from the database | Skeleton placeholders for the stat cards and chart area |
| Populated | At least 1 track exists | Full dashboard with all sections visible and populated |
| Time Period - No Data | The selected time period has no activities | Overview cards show zeros. Chart shows empty bars. Text: "No activities in this period." Personal records still show all-time records. |

**Interactions:**
- Tap a time period segment: Switches all time-dependent stats and the frequency chart to the selected period
- Tap a personal record card: Navigates to the Trail Detail screen for the record-holding track
- Tap on a bar in the frequency chart: Shows a tooltip with the exact count and date/period
- Tap activity type section header: Expands or collapses that type's stats section
- Pull-to-refresh: Recalculates all statistics from the database

**Transitions/Animations:**
- Stat card values animate with a counting-up effect when the time period changes (300ms)
- Bar chart bars animate in with a grow-from-bottom effect (staggered, 50ms per bar)
- Section expand/collapse animates with a smooth height transition (200ms)

#### 3.6 Data Requirements

This feature reads from the Track entity defined in TR-001. No new persistent entities are introduced.

**Derived Data (computed in-memory):**

##### Computed: PeriodStats

| Field | Type | Description |
|-------|------|-------------|
| total_activities | integer | Count of tracks in the selected period |
| total_distance_m | float | Sum of distance_m for all tracks |
| total_elevation_gain_m | float | Sum of elevation_gain_m for all tracks |
| total_time_ms | integer | Sum of elapsed_time_ms for all tracks |
| avg_distance_m | float | total_distance_m / total_activities |
| avg_pace_s_per_km | float | total_time_ms / total_distance_m * 1000 |
| activity_frequency | array | Count of activities grouped by time unit (day/week/month) |

##### Computed: PersonalRecord

| Field | Type | Description |
|-------|------|-------------|
| record_type | enum | longest_distance, most_elevation, fastest_pace, longest_duration, highest_elevation |
| value | float | The record value |
| track_id | string | The Track that holds this record |
| track_name | string | Name of the record-holding track |
| achieved_date | datetime | Date the record was set |
| activity_type | enum | Activity type of the record-holding track |

#### 3.7 Business Logic Rules

##### Period Stats Calculation

**Purpose:** Aggregate track statistics for a given time period.

**Inputs:**
- tracks: array of Track - All tracks falling within the selected time period
- period_type: enum (week, month, year, all_time, custom)
- period_start: datetime
- period_end: datetime

**Logic:**

```
1. Filter tracks where started_at >= period_start AND started_at <= period_end
2. total_activities = count of filtered tracks
3. IF total_activities = 0:
     RETURN all stats as 0 or null
4. total_distance_m = sum of distance_m across filtered tracks
5. total_elevation_gain_m = sum of elevation_gain_m across filtered tracks
6. total_time_ms = sum of elapsed_time_ms across filtered tracks
7. avg_distance_m = total_distance_m / total_activities
8. IF total_distance_m > 0:
     avg_pace_s_per_km = (total_time_ms / 1000) / (total_distance_m / 1000)
   ELSE:
     avg_pace_s_per_km = null
9. Compute activity_frequency:
   a. For "week": group tracks by day-of-week (Mon-Sun), count per day
   b. For "month": group tracks by day-of-month (1-31), count per day
   c. For "year": group tracks by month (Jan-Dec), count per month
   d. For "all_time": group tracks by month-year, count per month
10. RETURN PeriodStats
```

**Edge Cases:**
- No activities in the selected period: All values return 0 or null
- Single activity in the period: Averages equal the single activity values
- Activities spanning midnight: Grouped by started_at date

##### Personal Records Calculation

**Purpose:** Identify the user's best performances across all recorded activities.

**Inputs:**
- all_tracks: array of Track - All recorded tracks, unfiltered

**Logic:**

```
1. FOR each activity_type in [hike, run, bike, walk, other]:
   a. type_tracks = filter all_tracks by activity_type
   b. IF type_tracks is empty, SKIP
   c. longest_distance = track with max distance_m in type_tracks
   d. most_elevation = track with max elevation_gain_m in type_tracks
   e. fastest_pace = track with min avg_pace_s_per_km in type_tracks
      (only tracks with avg_pace_s_per_km not null and distance_m >= 1000m)
   f. longest_duration = track with max elapsed_time_ms in type_tracks
   g. highest_elevation = track with max max_elevation_m in type_tracks
2. ALSO compute overall records (across all activity types):
   a. Same calculations as above but across all tracks regardless of type
3. RETURN array of PersonalRecord entries
```

**Edge Cases:**
- Only 1 activity recorded: That activity holds all records by default
- Multiple activities tied for a record: Use the most recent one (by started_at)
- Activities with null pace (zero distance): Excluded from fastest_pace calculation
- Activities with null elevation: Excluded from elevation records

**Sort/Filter/Ranking Logic:**
- **Default view:** "This Month" period selected
- **Available periods:** Week, Month, Year, All Time, Custom date range
- Personal records are always all-time (not filtered by the selected period)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Stats computation fails | Error state: "Could not calculate statistics" with a "Try Again" button | User taps "Try Again" to re-run the calculation |
| Extremely large dataset (>10,000 tracks) causes slow computation | Show a loading indicator while computing. Computation runs asynchronously. | Results appear when computation finishes. Consider caching aggregated results for frequently-used periods. |
| Data inconsistency (negative distance or time values) | Inconsistent records are excluded from aggregation. A small note: "Some activities have incomplete data and are excluded from totals." | No user action needed. |
| Custom date range with start after end | Inline validation: "Start date must be before end date" | User corrects the date range |

**Validation Timing:**
- Stats are computed on screen load and cached for the session
- Stats refresh when a new activity is saved or an existing one is deleted
- Custom date range validation runs when the user taps "Apply"

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has recorded 20 hikes over the past 3 months totaling 150 km and 8,000 m elevation gain,
   **When** they navigate to the Stats Dashboard,
   **Then** the overview cards show "20 Activities", "150 km", "8,000 m", and the correct total time and average distance.

2. **Given** the user is viewing "This Month" stats and has 5 activities this month,
   **When** they switch to "This Year" using the time period selector,
   **Then** all stat values update to reflect the year's totals, and the frequency chart changes from day-based bars to month-based bars.

3. **Given** the user has recorded activities of different types (hikes, runs, bikes),
   **When** they scroll to the Activity Type Breakdown section,
   **Then** each type is shown with its own totals and averages, and the counts across types sum to the overall total.

**Edge Cases:**

4. **Given** no activities have been recorded,
   **When** the user navigates to the Stats Dashboard,
   **Then** the empty state is displayed with an illustration, "No stats yet" message, and a "Record" button.

5. **Given** the user selects a custom date range that contains no activities,
   **When** the stats are displayed,
   **Then** all overview cards show zero, the frequency chart shows empty bars, and a note says "No activities in this period." Personal records still display all-time values.

**Negative Tests:**

6. **Given** the user enters a custom date range where the start date is after the end date,
   **When** they attempt to apply the range,
   **Then** an inline validation message shows "Start date must be before end date."
   **And** the stats remain at the previously selected period.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| period stats with 3 tracks | distances: [5000, 10000, 8000], times: [3600000, 7200000, 5400000] | total_distance: 23000m, avg_distance: 7666.7m, total_time: 16200000ms |
| period stats with zero tracks | empty array | all values 0 or null |
| average pace calculation | total_time_ms: 7200000, total_distance_m: 10000 | avg_pace: 720 s/km |
| average pace with zero distance | total_time_ms: 3600000, total_distance_m: 0 | avg_pace: null |
| personal record - longest distance | 5 tracks with distances [5k, 8k, 12k, 3k, 9k] | record track is the 12k one |
| personal record - fastest pace excludes short tracks | tracks: [1km @ 300s/km, 500m @ 250s/km, 5km @ 350s/km] | fastest pace is 300s/km (500m track excluded, below 1km threshold) |
| activity frequency - week view | 3 tracks on Mon, 1 on Wed, 2 on Fri | frequency: [3, 0, 1, 0, 2, 0, 0] |
| type breakdown aggregation | 3 hikes, 2 runs | hike totals sum correctly, run totals sum correctly |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Stats update after new recording | 1. Note current stats, 2. Record a new activity, 3. Return to stats | All relevant stats increment by the new activity's values |
| Stats update after deletion | 1. Note current stats, 2. Delete a track from history, 3. Return to stats | Stats decrease by the deleted track's values, records may change |
| Period switching updates chart | 1. View stats in "Month" view, 2. Switch to "Year" view | Chart transitions from daily bars to monthly bars with correct counts |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Review annual outdoor stats | 1. Record 10 activities across 3 months, 2. Open Stats, 3. Select "This Year", 4. Review personal records, 5. Tap a record to see the track detail | Year stats show all 10 activities aggregated correctly. Personal records show the best performances. Tapping a record navigates to the correct Trail Detail screen. |

---

### TR-006: Offline Map Tiles

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-006 |
| **Feature Name** | Offline Map Tiles |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a backpacker, I want to download map tiles for a remote area before my trip so that I can view the map and record my route even without cell service.

**Secondary:**
> As a day hiker, I want map tiles for my local trails to load instantly from cache so that I do not wait for slow network requests when I open the map at the trailhead.

**Tertiary:**
> As a trip planner, I want to see how much storage space my downloaded map regions use so that I can manage my device storage.

#### 3.3 Detailed Description

Offline Map Tiles enables users to download map tile data for specific geographic regions and store it locally on the device for use without network connectivity. This is a critical feature for outdoor activities because many hiking, backpacking, and trail running destinations have limited or no cellular coverage.

The system uses the OpenStreetMap (OSM) slippy map tile convention, downloading raster PNG tile images at multiple zoom levels for a user-defined region. Users select a region by panning and zooming the map to frame the area they want, then tapping a "Download Region" button. The system calculates the number of tiles required based on the visible bounds and the selected zoom level range, estimates the storage size, and shows a confirmation dialog before downloading.

Downloaded tiles are stored in a local tile cache. When the map renderer needs a tile, it first checks the local cache. If the tile is cached (either from a deliberate download or from previous online viewing), it is loaded from the cache. If not cached and the device is online, the tile is fetched from the OSM tile server and cached for future use. If not cached and the device is offline, a blank/gray tile placeholder is shown.

Users manage their downloaded regions through a "Downloaded Maps" settings screen. This screen lists all explicitly downloaded regions with their name, area description, zoom level range, tile count, and storage size. Users can rename regions, delete them to free storage, or update them (re-download to get newer tile data).

The system enforces a configurable maximum cache size (default: 2 GB) to prevent unbounded storage growth. The cache uses a Least Recently Used (LRU) eviction policy for incidentally cached tiles (from online browsing), but explicitly downloaded region tiles are never evicted unless the user manually deletes the region.

Tile download operations respect the OpenStreetMap tile usage policy: requests include a proper User-Agent header, requests are rate-limited to a maximum of 2 concurrent tile downloads, and bulk downloads use a configurable delay between requests (default: 100ms between tiles).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is an independent infrastructure feature)

**External Dependencies:**
- Network access for initial tile download from OpenStreetMap tile servers
- Device storage for caching tile images (approximately 15-30 KB per tile)
- OpenStreetMap tile server availability during download

**Assumed Capabilities:**
- The app can make HTTP requests to fetch tile images
- The app can store binary image data in local storage (file system or database)
- The app can serve locally cached tiles to the map rendering component

#### 3.5 User Interface Requirements

##### Screen: Download Region

**Layout:**
- A full-screen interactive map where the user can pan and zoom to frame the area they want to download
- A translucent overlay border (dashed rectangle) shows the exact area that will be downloaded, matching the current map viewport
- Below the map, a panel shows: estimated tile count, estimated storage size (in MB), and a zoom level range selector (slider or stepper, e.g., "Zoom 10-16")
- A "Download" button at the bottom of the panel
- A text field at the top for naming the region (pre-populated with a reverse-geocoded place name if available, e.g., "Yosemite Valley")

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Selecting | User is panning/zooming to select a region | Map with dashed border overlay, tile count and size estimates updating as viewport changes |
| Estimating | Large region selected, tile count being calculated | Spinner next to the tile count/size values while calculation runs |
| Confirm | User has tapped "Download" | Confirmation dialog: "Download [region name]? [tile count] tiles, approximately [size] MB. This may take [estimated time]." with Cancel and Download buttons |
| Downloading | Tiles are being fetched and stored | Progress bar showing percentage complete, tile count downloaded/total, download speed, and a "Cancel" button |
| Complete | Download finished | Success message: "[region name] downloaded. [tile count] tiles, [size] MB." with a "Done" button |
| Error | Download failed partially or completely | Error message: "Download interrupted. [X of Y] tiles saved. Retry?" with Retry and Cancel buttons. Partially downloaded tiles are preserved. |
| Storage Warning | Estimated download would exceed storage limit | Warning: "This download requires [X] MB but only [Y] MB of cache space remains. Free space by deleting existing regions, or increase the cache limit in Settings." |

**Interactions:**
- Pan/zoom the map: Updates the download region boundary and recalculates tile estimates in real time
- Adjust zoom level range: Changes the min/max zoom levels to download. Lower max zoom = fewer tiles but less detail. Higher max zoom = more tiles, more detail, more storage.
- Tap "Download": Shows confirmation dialog with final tile count and estimated size
- Tap "Cancel" during download: Stops the download. All tiles downloaded so far are preserved in the cache.

##### Screen: Downloaded Maps (Settings)

**Layout:**
- A list of downloaded map regions, each showing: region name, a small map thumbnail of the region bounds, tile count, storage size (in MB), zoom level range, and download date
- A total storage usage indicator at the top (e.g., "Using 450 MB of 2 GB cache")
- Each item has a swipe-left action to delete
- A "Download New Region" button at the bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No regions downloaded | Text: "No offline maps downloaded yet. Download a region to use maps without internet." with a "Download Region" button |
| Populated | One or more regions downloaded | List of regions with storage stats |

**Interactions:**
- Tap a region: Shows the region bounds on a map (view-only)
- Swipe left on a region: Reveals "Delete" action
- Tap "Delete": Confirmation: "Delete [region name]? This will free [X] MB of storage. Your recorded tracks are not affected." with Cancel and Delete buttons
- Tap "Download New Region": Navigates to the Download Region screen

#### 3.6 Data Requirements

##### Entity: MapRegion

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the downloaded region |
| name | string | Required, max 100 chars | Reverse-geocoded or "Region [number]" | User-editable name for the region |
| ne_lat | float | -90.0 to 90.0 | None | Northeast corner latitude |
| ne_lon | float | -180.0 to 180.0 | None | Northeast corner longitude |
| sw_lat | float | -90.0 to 90.0 | None | Southwest corner latitude |
| sw_lon | float | -180.0 to 180.0 | None | Southwest corner longitude |
| min_zoom | integer | 0 to 19 | 10 | Minimum zoom level downloaded |
| max_zoom | integer | 0 to 19 | 16 | Maximum zoom level downloaded |
| tile_count | integer | Min: 0 | 0 | Number of tiles in this region |
| size_bytes | integer | Min: 0 | 0 | Total storage used in bytes |
| downloaded_at | datetime | ISO 8601 | Current timestamp | When the download completed |
| is_complete | boolean | - | false | Whether all tiles were successfully downloaded |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: CachedTile

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, composite of zoom_x_y | Auto | Unique tile identifier |
| zoom | integer | 0 to 19, required | None | Tile zoom level |
| tile_x | integer | Min: 0, required | None | Tile x coordinate |
| tile_y | integer | Min: 0, required | None | Tile y coordinate |
| region_id | string | Foreign key to MapRegion.id, nullable | null | The downloaded region this tile belongs to (null for incidentally cached tiles) |
| tile_data | blob | Required | None | The PNG image data for this tile |
| size_bytes | integer | Min: 0 | 0 | Size of the tile data in bytes |
| last_accessed_at | datetime | ISO 8601 | Current timestamp | Last time this tile was read from cache (for LRU eviction) |
| created_at | datetime | Auto-set on creation | Current timestamp | When the tile was cached |

**Relationships:**
- MapRegion has many CachedTiles (one-to-many via region_id)
- CachedTiles with null region_id are incidentally cached (from online browsing)

**Indexes:**
- CachedTile(zoom, tile_x, tile_y) - unique composite index for fast tile lookup
- CachedTile(region_id) - index for deleting all tiles in a region
- CachedTile(last_accessed_at) - index for LRU eviction ordering
- MapRegion(name) - index for sorting regions by name

**Validation Rules:**
- min_zoom must be less than or equal to max_zoom
- ne_lat must be greater than sw_lat
- ne_lon must be greater than sw_lon (except for regions crossing the 180th meridian)
- max_zoom must not exceed 16 for bulk downloads (to prevent excessive tile counts)

**Example Data:**

```
MapRegion:
{
  "id": "region-001",
  "name": "Yosemite Valley",
  "ne_lat": 37.7600,
  "ne_lon": -119.5200,
  "sw_lat": 37.7100,
  "sw_lon": -119.6400,
  "min_zoom": 10,
  "max_zoom": 16,
  "tile_count": 1247,
  "size_bytes": 31175000,
  "downloaded_at": "2026-03-06T14:30:00Z",
  "is_complete": true
}

CachedTile:
{
  "id": "14_2741_6389",
  "zoom": 14,
  "tile_x": 2741,
  "tile_y": 6389,
  "region_id": "region-001",
  "tile_data": "<binary PNG data>",
  "size_bytes": 24576,
  "last_accessed_at": "2026-03-06T15:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Tile Count Estimation

**Purpose:** Calculate the total number of tiles that need to be downloaded for a given geographic region and zoom level range.

**Inputs:**
- ne_lat, ne_lon, sw_lat, sw_lon: float - Bounding box of the region
- min_zoom: integer - Minimum zoom level to download
- max_zoom: integer - Maximum zoom level to download

**Logic:**

```
1. total_tiles = 0
2. FOR zoom = min_zoom TO max_zoom:
   a. n = 2^zoom
   b. x_min = floor((sw_lon + 180) / 360 * n)
   c. x_max = floor((ne_lon + 180) / 360 * n)
   d. sw_lat_rad = sw_lat * pi / 180
   e. ne_lat_rad = ne_lat * pi / 180
   f. y_min = floor((1 - log(tan(ne_lat_rad) + 1/cos(ne_lat_rad)) / pi) / 2 * n)
   g. y_max = floor((1 - log(tan(sw_lat_rad) + 1/cos(sw_lat_rad)) / pi) / 2 * n)
   h. tiles_at_zoom = (x_max - x_min + 1) * (y_max - y_min + 1)
   i. total_tiles = total_tiles + tiles_at_zoom
3. RETURN total_tiles
```

**Formulas:**
- Tiles per zoom level = (x_range + 1) * (y_range + 1)
- Total tiles = sum across all zoom levels from min_zoom to max_zoom

**Edge Cases:**
- Region crossing the 180th meridian: x_min may be greater than x_max; handle wrapping
- Very large region at high zoom: Can result in millions of tiles; enforce a maximum of 50,000 tiles per download. If exceeded, show a warning and suggest reducing the zoom range or region size.
- Single tile region at low zoom: Returns 1

##### Storage Size Estimation

**Purpose:** Estimate the storage required for a tile download before the user confirms.

**Inputs:**
- tile_count: integer - Total number of tiles to download

**Logic:**

```
1. AVG_TILE_SIZE_BYTES = 25000 (25 KB average per tile)
2. estimated_size_bytes = tile_count * AVG_TILE_SIZE_BYTES
3. RETURN estimated_size_bytes
```

**Edge Cases:**
- Actual size may vary significantly (ocean tiles are small ~5KB, urban areas are larger ~40KB). The estimate is a rough guide.
- Show a disclaimer: "Actual size may vary"

##### LRU Cache Eviction

**Purpose:** Evict least-recently-used incidentally cached tiles when the cache exceeds the maximum size.

**Inputs:**
- max_cache_size_bytes: integer - Maximum cache size (default: 2,147,483,648 = 2 GB)

**Logic:**

```
1. current_cache_size = sum of size_bytes for all CachedTile records
2. IF current_cache_size <= max_cache_size_bytes:
     RETURN (no eviction needed)
3. target_free_bytes = current_cache_size - max_cache_size_bytes + (max_cache_size_bytes * 0.10)
   (Free an extra 10% to avoid repeated eviction cycles)
4. eviction_candidates = SELECT CachedTile WHERE region_id IS NULL
   ORDER BY last_accessed_at ASC
   (Only evict incidentally cached tiles, never explicitly downloaded region tiles)
5. freed_bytes = 0
6. FOR each tile in eviction_candidates:
   a. IF freed_bytes >= target_free_bytes: BREAK
   b. DELETE tile
   c. freed_bytes = freed_bytes + tile.size_bytes
7. RETURN
```

**Edge Cases:**
- All tiles belong to downloaded regions (no eviction candidates): Cache stays over limit. User must manually delete a region.
- Cache is mostly incidentally cached tiles: Eviction proceeds normally

##### Tile Fetch with Cache-First Strategy

**Purpose:** Retrieve a map tile, preferring the local cache over network requests.

**Inputs:**
- zoom: integer - Tile zoom level
- tile_x: integer - Tile x coordinate
- tile_y: integer - Tile y coordinate

**Logic:**

```
1. cache_key = "{zoom}_{tile_x}_{tile_y}"
2. cached_tile = LOOKUP CachedTile WHERE id = cache_key
3. IF cached_tile exists:
     a. UPDATE cached_tile.last_accessed_at = now
     b. RETURN cached_tile.tile_data
4. IF device is online:
     a. url = "https://tile.openstreetmap.org/{zoom}/{tile_x}/{tile_y}.png"
     b. FETCH tile_data from url with:
        - User-Agent: "MyTrails/1.0 (contact@mylife-app.com)"
        - Timeout: 10 seconds
     c. IF fetch succeeds:
        - STORE new CachedTile with region_id = null (incidental cache)
        - Run LRU eviction check
        - RETURN tile_data
     d. IF fetch fails:
        - RETURN placeholder (gray tile)
5. IF device is offline:
     RETURN placeholder (gray tile)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Network lost during region download | Progress pauses. Banner: "Download paused - no internet connection. Will resume when connected." | Download resumes automatically when connectivity returns. Already-downloaded tiles are preserved. |
| Individual tile download fails (404, timeout) | Failed tiles are skipped and logged. At the end of the download, a summary shows: "[X] of [Y] tiles downloaded. [Z] tiles failed." | User can tap "Retry Failed" to re-attempt only the failed tiles. |
| Storage full during download | Download stops. Alert: "Device storage full. [X] of [Y] tiles saved. Free storage and tap Retry." | User frees device storage, then taps Retry. |
| OSM tile server rate-limits the download (HTTP 429) | Download slows down automatically (doubles the delay between requests). Progress bar continues but with a "Throttled" label. | Automatic, no user action needed. |
| Region exceeds 50,000 tile limit | Before download starts: "This region requires [X] tiles, which exceeds the 50,000 tile limit. Reduce the area or zoom range." Download button is disabled. | User zooms in to a smaller area or reduces the max zoom level. |

**Validation Timing:**
- Tile count validation runs in real time as the user adjusts the viewport and zoom range
- Storage space check runs before download confirmation
- Individual tile validation (valid PNG) runs on download

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has navigated the map to frame Yosemite Valley and selected zoom levels 10-16,
   **When** they tap "Download" and confirm,
   **Then** a progress bar shows the download advancing, and upon completion, the system reports the total tile count and storage size.

2. **Given** the user has downloaded a region and goes to a location within that region with no cell service,
   **When** they view the map,
   **Then** all tiles within the downloaded zoom range load from the local cache and the map displays normally.

3. **Given** the user navigates to the Downloaded Maps screen,
   **When** they view the list,
   **Then** all downloaded regions are listed with name, tile count, storage size, and download date, and a total storage usage indicator is shown at the top.

**Edge Cases:**

4. **Given** the user selects a very large region that would require 60,000 tiles,
   **When** the tile count estimate updates,
   **Then** a warning appears: "This region requires 60,000 tiles, which exceeds the 50,000 tile limit" and the Download button is disabled.

5. **Given** network connectivity is lost during a download at 60% completion,
   **When** connectivity is restored 5 minutes later,
   **Then** the download resumes from where it left off (tiles already downloaded are not re-fetched) and completes normally.

**Negative Tests:**

6. **Given** the user has 1.9 GB of cache used out of a 2 GB limit and tries to download a 200 MB region,
   **When** the storage estimate is shown,
   **Then** a warning indicates insufficient cache space and suggests deleting existing regions or increasing the cache limit.
   **And** the download does not start until sufficient space is available.

7. **Given** the user deletes a downloaded region,
   **When** they confirm the deletion,
   **Then** all tiles belonging to that region are removed from the cache, the storage usage decreases by the region's size, and the region no longer appears in the Downloaded Maps list.
   **And** no Track data or other user data is affected.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| tile count for small region at zoom 14 | ne=(37.76, -119.52), sw=(37.71, -119.64), zoom 14 only | approximately 12-20 tiles |
| tile count for multi-zoom download | same region, zoom 10-14 | sum of tiles across 5 zoom levels |
| tile count for zoom 0 | any bounds, zoom 0 | 1 tile |
| storage estimation for 1000 tiles | tile_count=1000 | 25,000,000 bytes (25 MB) |
| LRU eviction frees target space | cache at 2.1 GB, max 2.0 GB | evicts until cache is at approximately 1.8 GB (10% buffer) |
| LRU eviction skips region tiles | cache at 2.1 GB, all tiles have region_id | no tiles evicted, cache stays at 2.1 GB |
| tile fetch returns cached tile | tile exists in cache | returns cached data, updates last_accessed_at |
| tile fetch downloads on cache miss | tile not in cache, online | fetches from OSM, stores in cache, returns data |
| tile fetch returns placeholder when offline | tile not in cache, offline | returns gray placeholder |
| tile count exceeds limit warning | region requiring 60,000 tiles | warning flag set to true |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Download and verify offline map | 1. Download a small region (zoom 14-15), 2. Enable airplane mode, 3. View the map in the downloaded region | All tiles load from cache, map renders normally |
| Cache eviction on space pressure | 1. Fill cache to near limit with incidental tiles, 2. Download a new region | Incidental tiles are evicted to make room, region tiles are preserved |
| Delete region frees space | 1. Download a region (note size), 2. Check total cache usage, 3. Delete the region | Cache usage decreases by approximately the region's size |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Prepare for a backcountry trip | 1. Open the map, navigate to a remote mountain area, 2. Set zoom range 10-16, 3. Download the region, 4. Enable airplane mode, 5. Navigate the map in the downloaded area, 6. Start a recording | Map tiles load offline. Recording works normally. The route is drawn on the offline map tiles. |

---

### TR-007: GPX Import/Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-007 |
| **Feature Name** | GPX Import/Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a weekend explorer, I want to export my recorded hike as a GPX file so that I can share it with friends who use other trail apps.

**Secondary:**
> As a backpacker, I want to import a GPX route file so that I can use a community-shared route for my trip without manually recreating it.

**Tertiary:**
> As a user migrating from AllTrails, I want to import my AllTrails GPX exports so that I do not lose my hiking history when switching to MyTrails.

#### 3.3 Detailed Description

GPX (GPS Exchange Format) is the universal standard for sharing GPS data between outdoor applications. MyTrails supports both importing GPX files to create new tracks or planned routes, and exporting recorded tracks as GPX files for sharing or backup.

Export generates a standards-compliant GPX 1.1 XML file containing all track points with latitude, longitude, elevation, and timestamps. The exported file includes metadata (track name, activity type, description), track segments that preserve pause/resume boundaries, and waypoints if any were placed during the activity. Privacy zones (see TR-017) are applied before export: any track points within a user-defined privacy zone are trimmed from the exported file.

Import reads GPX 1.1 files and creates a new Track record with all the associated TrackPoints. The importer handles both `<trk>` elements (recorded tracks) and `<rte>` elements (planned routes). For tracks, the importer extracts all `<trkpt>` elements with their coordinates, elevation, and timestamps. For routes, the importer extracts `<rtept>` elements and creates a planned route (see TR-009). The importer validates the GPX XML structure, reports any parsing errors, and provides a preview of the route on a map before the user confirms the import.

The system supports batch import: users can select multiple GPX files at once, and each file creates a separate Track. A summary screen shows the results of the batch import with success/failure counts and details for any files that could not be parsed.

Export supports three output options: share via the device's share sheet (email, messaging, AirDrop), save to the device's file system, and copy to clipboard (for the GPX XML text).

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Provides the Track and TrackPoint data to export, and the entity structure for imported data

**External Dependencies:**
- File system access for reading imported GPX files and saving exported files
- Share sheet integration for distributing exported files

**Assumed Capabilities:**
- The app can read and parse XML documents
- The app can access the device file picker for selecting files to import
- The app can generate XML documents and write them to files
- The app can invoke the device share sheet with a file attachment

#### 3.5 User Interface Requirements

##### Screen: Export Trail

**Layout:**
- Accessed from the Trail Detail screen via a "Share/Export" button in the navigation bar
- A bottom sheet appears with three options:
  1. "Share GPX" - Opens the device share sheet with the GPX file as an attachment
  2. "Save to Files" - Saves the GPX file to the device file system (user picks location)
  3. "Copy GPX Text" - Copies the raw GPX XML to the clipboard
- Below the options, a "Privacy" section with a toggle: "Apply Privacy Zones" (default: ON if privacy zones are configured). When enabled, a note: "Track points within your privacy zones will be removed from the export."
- A preview section shows: file name (e.g., "Morning-Hike-Muir-Woods.gpx"), estimated file size, number of track points, and number of segments

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Export options are displayed | Bottom sheet with three export options, privacy toggle, and file preview |
| Generating | GPX file is being generated | Brief spinner: "Preparing GPX file..." (typically under 1 second) |
| Sharing | Device share sheet is active | OS share sheet with the GPX file attached |
| Saved | File saved to device file system | Toast: "GPX file saved to [location]" |
| Copied | XML copied to clipboard | Toast: "GPX text copied to clipboard" |
| Error | File generation failed | Alert: "Could not generate GPX file. Please try again." |

**Interactions:**
- Tap "Share GPX": Generates the file, opens the share sheet
- Tap "Save to Files": Generates the file, opens the file save dialog
- Tap "Copy GPX Text": Generates the XML string, copies to clipboard
- Toggle "Apply Privacy Zones": Enables or disables privacy zone trimming for this export

##### Screen: Import GPX

**Layout:**
- Accessed from Settings or from the Trail History screen via an "Import" button
- A file picker is presented, allowing the user to select one or more .gpx files
- After file selection, an import preview screen shows:
  - A list of files to import, each with: file name, detected type (track or route), point count, and a small route preview map
  - Any files with parsing errors are marked with a warning icon and error description
  - A "Import All" button at the bottom and individual "Import" / "Skip" toggles per file

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| File Selection | User is selecting files | File picker showing .gpx files |
| Preview | Files are loaded and parsed | List of importable tracks/routes with previews |
| Importing | Import is in progress | Progress indicator showing "[X] of [Y] imported" |
| Complete | All imports finished | Summary: "[X] tracks imported successfully. [Y] failed." with a "Done" button |
| Error - Invalid File | Selected file is not valid GPX | Warning next to the file: "Invalid GPX format: [specific error]" with the file toggled to "Skip" |
| Error - No Files | User selected no files or all files are invalid | Message: "No valid GPX files found. Please select files with the .gpx extension containing valid GPS data." |

**Interactions:**
- Select files: Opens device file picker filtered to .gpx files
- Toggle individual file import: User can skip specific files from a batch
- Tap "Import All": Begins importing all toggled-on files
- Tap "Done" (after complete): Navigates to Trail History, which now includes the imported tracks

##### Modal: Import Preview (per file)

**Layout:**
- Tapping a file in the preview list expands to show: a map with the route drawn, track name (from GPX metadata or file name), point count, total distance (calculated from points), elevation range, and time range (if timestamps are present)
- "Import" and "Skip" buttons at the bottom

#### 3.6 Data Requirements

This feature reads from and writes to the Track and TrackPoint entities defined in TR-001. No new persistent entities are required.

**GPX XML Schema:**

The system reads and writes GPX 1.1 compliant XML with this structure:

```
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
     creator="MyTrails"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1
       http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Track Name</name>
    <desc>Track description/notes</desc>
    <time>2026-03-06T08:15:00Z</time>
  </metadata>
  <trk>
    <name>Track Name</name>
    <type>Hiking</type>
    <trkseg>
      <trkpt lat="37.8912" lon="-122.5714">
        <ele>45.2</ele>
        <time>2026-03-06T08:15:03Z</time>
      </trkpt>
      <!-- more trkpt elements -->
    </trkseg>
    <!-- additional trkseg for each segment (from pause/resume) -->
  </trk>
  <wpt lat="37.8950" lon="-122.5680">
    <name>Waterfall Viewpoint</name>
    <desc>Beautiful waterfall, great photo spot</desc>
    <ele>120.5</ele>
    <time>2026-03-06T09:30:00Z</time>
  </wpt>
</gpx>
```

#### 3.7 Business Logic Rules

##### GPX Export Generation

**Purpose:** Generate a GPX 1.1 XML document from a Track and its TrackPoints.

**Inputs:**
- track: Track record
- points: array of TrackPoint ordered by timestamp
- waypoints: array of Waypoint (from TR-015)
- apply_privacy_zones: boolean
- privacy_zones: array of PrivacyZone (from TR-017)

**Logic:**

```
1. IF apply_privacy_zones is true:
     filtered_points = remove all points within any privacy zone
     (See TR-017 for privacy zone point-in-circle calculation)
   ELSE:
     filtered_points = points
2. Group filtered_points by segment_index into segments
3. Build XML document:
   a. Add XML declaration and GPX root element with namespaces
   b. Add <metadata> with track.name, track.notes, track.started_at
   c. Add <trk> element:
      - <name> = track.name
      - <type> = map activity_type to GPX type string
        (hike -> "Hiking", run -> "Running", bike -> "Cycling",
         walk -> "Walking", other -> "Other")
      - FOR each segment:
        - Add <trkseg>
        - FOR each point in segment:
          - Add <trkpt lat="..." lon="...">
            - <ele> if elevation_m is not null
            - <time> as ISO 8601
          - Close </trkpt>
        - Close </trkseg>
   d. FOR each waypoint:
      - IF apply_privacy_zones AND waypoint is within a privacy zone, SKIP
      - Add <wpt lat="..." lon="...">
        - <name>, <desc>, <ele>, <time> if available
      - Close </wpt>
   e. Close </gpx>
4. RETURN XML string
```

**Edge Cases:**
- Track with no waypoints: Omit the `<wpt>` elements entirely
- Points with null elevation: Omit the `<ele>` element for those points
- Privacy zones remove all points in a segment: Omit that `<trkseg>` entirely
- Privacy zones remove all points: Show warning before export: "All track points are within privacy zones. The exported file will be empty."
- File naming: Use track name with spaces replaced by hyphens, sanitized of special characters, with .gpx extension

##### GPX Import Parsing

**Purpose:** Parse a GPX 1.1 XML file and create Track and TrackPoint records.

**Inputs:**
- gpx_xml: string - Raw GPX XML content
- file_name: string - Original file name (used as fallback track name)

**Logic:**

```
1. Parse XML string into a DOM tree
2. IF parsing fails (malformed XML):
     RETURN error: "Invalid XML format"
3. Validate GPX namespace and version attribute
4. IF not GPX 1.1:
     Attempt to parse anyway (many GPX 1.0 files are compatible)
     Log a warning: "GPX version {version} detected, expected 1.1"
5. Extract metadata:
   a. name = <metadata><name> OR <trk><name> OR file_name (without extension)
   b. description = <metadata><desc> OR <trk><desc> OR null
   c. type = map <trk><type> to activity_type enum:
      ("Hiking"/"hiking" -> hike, "Running"/"running" -> run,
       "Cycling"/"cycling"/"Biking" -> bike,
       "Walking"/"walking" -> walk, all others -> other)
6. Extract track points:
   a. FOR each <trk>:
      - FOR each <trkseg> (segment_index increments per trkseg):
        - FOR each <trkpt>:
          - latitude = @lat attribute (required, must be valid float)
          - longitude = @lon attribute (required, must be valid float)
          - elevation_m = <ele> text content (optional, float)
          - timestamp = <time> text content (optional, ISO 8601)
        - IF no valid trkpt elements in segment, skip segment
   b. IF no <trk> elements, check for <rte> elements:
      - FOR each <rtept>: extract same fields as trkpt
      - Treat as a single-segment track
7. Validate extracted data:
   a. Must have at least 2 valid track points
   b. Latitude must be -90 to 90, longitude must be -180 to 180
   c. Invalid points are logged and skipped
8. Create Track record:
   a. name = extracted name
   b. activity_type = extracted type or "hike" (default)
   c. started_at = timestamp of first point (or current time if no timestamps)
   d. finished_at = timestamp of last point (or current time)
   e. Calculate distance_m, elevation_gain_m, elevation_loss_m, etc. from points
9. Create TrackPoint records for all valid points
10. RETURN { track, points, warnings }
```

**Edge Cases:**
- GPX file with no timestamps: Import succeeds, but pace/speed stats are unavailable. started_at and finished_at are set to the import time.
- GPX file with `<rte>` but no `<trk>`: Import as a planned route
- GPX file with both `<trk>` and `<rte>`: Import the `<trk>` as a track and the `<rte>` as a separate planned route
- GPX file with 0 or 1 valid points: Reject with error "File contains fewer than 2 valid GPS points"
- GPX file with extensions (e.g., Garmin extensions): Ignore unrecognized elements, parse standard elements only
- Extremely large GPX file (>100,000 points): Process in streaming fashion rather than loading entire DOM into memory. Show progress indicator.
- Duplicate import (same file imported twice): Allow it (creates a second track). User can delete duplicates manually.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Selected file is not valid XML | File listed with error icon: "Invalid file format. This file is not valid XML." | User skips this file or selects a different file |
| File is XML but not GPX (no GPX namespace or elements) | File listed with error icon: "Not a GPX file. No GPS data found." | User skips this file |
| GPX file has valid structure but no track points | File listed with warning: "GPX file contains no track points." | User skips this file |
| GPX file has some invalid coordinates | File imports successfully with valid points. Warning: "[X] points had invalid coordinates and were skipped." | No action needed. Partial import preserves valid data. |
| File too large (>50 MB) | Warning before import: "This file is very large ([X] MB). Import may take several minutes." | User can proceed or cancel |
| Export fails (storage/permission error) | Alert: "Could not save GPX file. Check available storage and permissions." | User frees storage or grants file access permission |
| Privacy zones remove all points on export | Warning: "All track points are within your privacy zones. The exported GPX file would contain no data." Export is blocked. | User can disable "Apply Privacy Zones" for this export, or adjust their privacy zones in Settings |

**Validation Timing:**
- File format validation runs immediately on file selection
- GPX structure validation runs during the preview phase
- Coordinate validation runs per-point during import
- Export file generation is validated before invoking the share sheet or save dialog

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a completed track with 500 points, 2 segments, and 3 waypoints,
   **When** the user taps "Share GPX" on the Trail Detail screen,
   **Then** a GPX 1.1 XML file is generated with the correct track name, all track points in 2 `<trkseg>` elements, all 3 `<wpt>` elements, and the device share sheet opens with the file attached.

2. **Given** a valid GPX file exported from AllTrails,
   **When** the user imports it via the Import GPX screen,
   **Then** a preview shows the route on a map, the point count, and estimated distance. After confirming import, the track appears in the Trail History with correct distance, elevation, and time stats.

3. **Given** the user selects 5 GPX files for batch import,
   **When** 4 are valid and 1 has parsing errors,
   **Then** the preview screen shows 4 files ready to import and 1 marked with an error. After importing, the summary shows "4 tracks imported, 1 failed" with the error details.

**Edge Cases:**

4. **Given** a GPX file with no timestamp data on any track point,
   **When** the user imports it,
   **Then** the track is imported with started_at and finished_at set to the import time, distance and elevation stats are calculated correctly, and pace/speed stats show "N/A".

5. **Given** a track with privacy zones configured and "Apply Privacy Zones" enabled,
   **When** the user exports the track,
   **Then** all track points within privacy zones are removed from the GPX file, and the exported route has visible gaps where privacy zones were applied.

**Negative Tests:**

6. **Given** a file with the .gpx extension but containing plain text (not XML),
   **When** the user selects it for import,
   **Then** the preview shows an error: "Invalid file format. This file is not valid XML."
   **And** the import button is disabled for this file.

7. **Given** a valid GPX file with only 1 track point,
   **When** the user attempts to import it,
   **Then** the system rejects the import with: "File contains fewer than 2 valid GPS points."
   **And** no Track is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| export generates valid GPX 1.1 XML | Track with 10 points, 1 segment | XML string with correct namespace, version, metadata, trk, trkseg, trkpt elements |
| export includes elevation when present | Point with elevation_m=100.5 | `<ele>100.5</ele>` in the trkpt element |
| export omits elevation when null | Point with elevation_m=null | No `<ele>` element in the trkpt |
| export creates multiple trkseg for multi-segment track | Track with 3 segments | 3 `<trkseg>` elements within the `<trk>` |
| export includes waypoints | Track with 2 waypoints | 2 `<wpt>` elements after the `<trk>` |
| export applies privacy zone trimming | Track with 10 points, 3 within a privacy zone | GPX contains 7 trkpt elements |
| import parses valid GPX track | Valid GPX with 50 trkpt elements | Track with 50 TrackPoints, correct stats |
| import parses GPX route | GPX with `<rte>` and `<rtept>` elements | Track with points from the route |
| import handles missing timestamps | GPX without `<time>` elements in trkpt | Track created with import time as started_at/finished_at |
| import maps activity types | `<type>Hiking</type>` in GPX | activity_type = "hike" |
| import rejects file with 0 points | GPX with empty trkseg | Error: "contains fewer than 2 valid GPS points" |
| import rejects malformed XML | "this is not xml" | Error: "Invalid XML format" |
| import handles invalid coordinates | GPX with lat=999, lon=999 | Those points skipped, warning logged |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Round-trip export and import | 1. Record a track, 2. Export as GPX, 3. Import the exported GPX | Imported track has identical coordinates, elevation, and timestamps as the original |
| Batch import with mixed validity | 1. Select 3 valid and 2 invalid GPX files, 2. Import all valid | 3 tracks created, 2 errors reported |
| Privacy zone applied on export | 1. Set a privacy zone, 2. Record a track passing through the zone, 3. Export with privacy zones enabled | Exported GPX has gaps where the privacy zone was |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Migrate from AllTrails | 1. Export 3 tracks from AllTrails as GPX, 2. Open MyTrails Import screen, 3. Select all 3 files, 4. Preview and confirm, 5. View Trail History | All 3 tracks appear in Trail History with routes on map, elevation profiles, and stats calculated from the imported GPS data |

---

### TR-008: Photo Geotagging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-008 |
| **Feature Name** | Photo Geotagging |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a day hiker, I want to take photos during my hike that are automatically pinned to my route on the map so that I can relive my adventure with visual memories tied to specific locations.

**Secondary:**
> As a weekend explorer, I want to scroll through my geotagged photos in the order I took them along the trail so that I can narrate my trip to friends and family with a visual timeline.

**Tertiary:**
> As a backpacker, I want to attach a caption and note to each geotagged photo so that I can remember why I stopped at each spot and what I saw.

#### 3.3 Detailed Description

Photo Geotagging allows users to capture photos during an active recording that are automatically tagged with the GPS coordinates of the capture location and linked to the track. Photos appear as interactive markers on the route map, creating a visual story of the outdoor experience.

During an active recording, the camera button on the control bar opens the device camera. When the user takes a photo, the system captures the current GPS position and timestamp, stores the photo locally, and creates a GeoPhoto record linking the image to the track and its position on the route. The photo marker appears immediately on the live recording map.

After the activity, geotagged photos appear on the Trail Detail screen both as markers on the route map and in a horizontal scrollable gallery below the elevation profile. Tapping a photo marker on the map shows a popup preview of the image. Tapping a photo in the gallery opens a full-screen viewer with the photo, its location on the map, the timestamp, and any caption the user added.

Users can also attach photos from their device's photo library to a completed track. When attaching an existing photo, the system reads the EXIF GPS data from the photo if available. If no EXIF GPS data exists, the user manually places the photo on the route by tapping a location on the map.

Each track supports up to 200 geotagged photos. Photos are stored as compressed JPEG images at a maximum resolution of 2048x2048 pixels, with thumbnails generated at 256x256 pixels for gallery and map marker display. All photos are stored locally on the device and are never uploaded to any server.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Provides the active recording context and GPS position for geotagging

**External Dependencies:**
- Device camera for capturing photos during recording
- Photo library access for attaching existing photos
- Device storage for photo files (approximately 500 KB - 2 MB per photo)

**Assumed Capabilities:**
- The app can access the device camera and capture images
- The app can read EXIF metadata from photo files
- The app can resize and compress images
- The app can store binary image data in local storage

#### 3.5 User Interface Requirements

##### Interaction: Camera Capture (during active recording)

**Layout:**
- The camera button on the recording screen control bar opens the device's native camera interface
- After capturing a photo, a brief preview overlay appears (2 seconds) showing the photo with a small map inset indicating the GPS pin location
- An optional caption text field appears below the preview (max 200 characters)
- Two buttons: "Save" (primary) and "Retake" (secondary)
- After saving, the photo marker appears on the recording map as a small circular thumbnail at the GPS position

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Camera Active | Device camera is open | Native camera interface. Recording continues in the background. |
| Preview | Photo captured, awaiting save | Photo preview with GPS pin inset, optional caption field, Save and Retake buttons |
| Saving | Photo is being processed and stored | Brief spinner overlay (under 500ms for compression and storage) |
| Saved | Photo stored and marker placed | Photo marker appears on the map. Toast: "Photo added to your route" |
| Error | Camera unavailable or storage full | Alert with specific error message |

**Interactions:**
- Tap camera button (on recording screen): Opens the device camera. GPS recording continues in background.
- Capture photo: Shows preview with GPS location and caption field
- Tap "Save": Compresses photo, stores locally, creates GeoPhoto record, places marker on map, returns to recording screen
- Tap "Retake": Discards captured image, returns to camera
- Enter caption: Optional text, max 200 characters, saved with the photo

**Transitions/Animations:**
- Camera opens with the standard platform camera transition
- Photo marker appears on the map with a pop-in scale animation (200ms)
- Preview overlay slides up from the bottom (150ms)

##### Component: Photo Gallery (within Trail Detail)

**Layout:**
- A horizontal scrollable strip of photo thumbnails (80x80 px each) positioned below the elevation profile on the Trail Detail screen
- Each thumbnail shows the photo with a small timestamp label at the bottom
- The gallery header shows "Photos ([count])" at the left
- If more than 6 photos exist, the strip is scrollable with a subtle right-arrow indicator

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Photos | Track has no geotagged photos | Gallery section is hidden entirely |
| Photos Present | Track has 1 or more photos | Horizontal scrollable thumbnail strip with photo count header |

**Interactions:**
- Tap a thumbnail: Opens the full-screen photo viewer
- Long-press a thumbnail: Opens context menu with options: View, Edit Caption, Delete, Set as Track Cover
- Scroll horizontally: Browse through all geotagged photos in chronological order

##### Screen: Full-Screen Photo Viewer

**Layout:**
- Full-screen photo display with a dark background
- Photo is centered and zoomable (pinch-to-zoom, double-tap to zoom)
- A translucent overlay at the bottom shows: caption text (if any), timestamp (e.g., "9:32 AM"), location coordinates (e.g., "37.895, -122.571"), and the distance along the route where the photo was taken (e.g., "3.2 km from start")
- Navigation arrows (left/right) or swipe gestures to move between photos chronologically
- A small map inset in the top-right corner (100x100 px) showing the photo location on the route
- Close button (X) in the top-left corner

**Interactions:**
- Swipe left/right: Navigate to previous/next photo
- Pinch-to-zoom: Zoom into the photo
- Tap the map inset: Expands to show a larger map view centered on the photo location
- Tap close button: Returns to the Trail Detail screen

#### 3.6 Data Requirements

##### Entity: GeoPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the photo |
| track_id | string | Foreign key to Track.id, required | None | The track this photo belongs to |
| latitude | float | -90.0 to 90.0, required | None | WGS84 latitude where the photo was taken |
| longitude | float | -180.0 to 180.0, required | None | WGS84 longitude where the photo was taken |
| elevation_m | float | Nullable | null | Elevation at the photo location |
| captured_at | datetime | Required, ISO 8601 | None | When the photo was captured |
| caption | string | Optional, max 200 chars | null | User-entered caption for the photo |
| file_path | string | Required | None | Relative path to the full-resolution photo file on device |
| thumbnail_path | string | Required | None | Relative path to the 256x256 thumbnail file |
| file_size_bytes | integer | Min: 0 | 0 | Size of the full-resolution photo in bytes |
| width_px | integer | Min: 1 | None | Photo width in pixels (after compression) |
| height_px | integer | Min: 1 | None | Photo height in pixels (after compression) |
| distance_from_start_m | float | Min: 0.0, nullable | null | Distance along the route where the photo was taken |
| source | enum | One of: camera, library | camera | Whether the photo was taken in-app or imported from device library |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- Track has many GeoPhotos (one-to-many via track_id)
- GeoPhotos are ordered by captured_at within a Track

**Indexes:**
- GeoPhoto(track_id, captured_at) - composite index for ordered retrieval within a track
- GeoPhoto(track_id) - index for counting and listing photos per track

**Validation Rules:**
- track_id must reference an existing Track
- latitude must be between -90.0 and 90.0 inclusive
- longitude must be between -180.0 and 180.0 inclusive
- file_path must reference an existing file on the device
- A Track may have a maximum of 200 GeoPhotos

**Example Data:**

```
GeoPhoto:
{
  "id": "photo-001",
  "track_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "latitude": 37.8950,
  "longitude": -122.5680,
  "elevation_m": 120.5,
  "captured_at": "2026-03-06T09:32:00Z",
  "caption": "Waterfall visible through the redwoods",
  "file_path": "photos/f47ac10b/photo-001.jpg",
  "thumbnail_path": "photos/f47ac10b/photo-001-thumb.jpg",
  "file_size_bytes": 1048576,
  "width_px": 2048,
  "height_px": 1536,
  "distance_from_start_m": 3200.5,
  "source": "camera",
  "created_at": "2026-03-06T09:32:01Z",
  "updated_at": "2026-03-06T09:32:01Z"
}
```

#### 3.7 Business Logic Rules

##### Photo Compression and Thumbnail Generation

**Purpose:** Compress captured photos to a consistent size and generate thumbnails for display in galleries and map markers.

**Inputs:**
- raw_image: binary image data from the camera or photo library
- max_dimension: integer - Maximum width or height in pixels (default: 2048)
- thumbnail_size: integer - Thumbnail dimension in pixels (default: 256)
- jpeg_quality: float - Compression quality 0.0 to 1.0 (default: 0.8)

**Logic:**

```
1. Read raw image dimensions (original_width, original_height)
2. IF original_width > max_dimension OR original_height > max_dimension:
     scale_factor = max_dimension / max(original_width, original_height)
     new_width = round(original_width * scale_factor)
     new_height = round(original_height * scale_factor)
     Resize image to new_width x new_height
   ELSE:
     Keep original dimensions
3. Compress image as JPEG at jpeg_quality
4. Save compressed image to file_path
5. Generate thumbnail:
   a. thumb_scale = thumbnail_size / max(new_width, new_height)
   b. Resize image to thumbnail dimensions (maintaining aspect ratio)
   c. Crop to center square (thumbnail_size x thumbnail_size)
   d. Save thumbnail to thumbnail_path
6. RETURN { file_path, thumbnail_path, file_size_bytes, width_px, height_px }
```

**Edge Cases:**
- Image smaller than thumbnail_size: Use original size for thumbnail (no upscaling)
- Camera returns HEIF format (iOS): Convert to JPEG before compression
- Photo library image has no EXIF data: Use current GPS position (if recording) or prompt user to place on map
- Storage full: Alert user, do not partially save

##### Distance Along Route Calculation

**Purpose:** Determine how far along the recorded route a photo was taken, for positioning in the gallery and on the elevation profile.

**Inputs:**
- photo_lat: float - Photo latitude
- photo_lon: float - Photo longitude
- track_points: array of TrackPoint ordered by timestamp

**Logic:**

```
1. min_distance = infinity
2. closest_point_index = -1
3. cumulative_distance = 0.0
4. distances = [0.0]  (cumulative distance at each point)
5. FOR i = 1 to track_points.length - 1:
     segment = haversine(track_points[i-1], track_points[i])
     cumulative_distance = cumulative_distance + segment
     distances.append(cumulative_distance)
6. FOR i = 0 to track_points.length - 1:
     d = haversine(photo_lat, photo_lon, track_points[i].latitude, track_points[i].longitude)
     IF d < min_distance:
       min_distance = d
       closest_point_index = i
7. distance_from_start_m = distances[closest_point_index]
8. RETURN distance_from_start_m
```

**Edge Cases:**
- Photo taken far from the route (>100m from nearest point): Still assign to nearest point, but flag as "off-route"
- Empty track points: Return 0.0
- Photo taken at exact start point: Return 0.0

##### EXIF GPS Data Extraction

**Purpose:** Read GPS coordinates from a photo's EXIF metadata when attaching existing photos from the device library.

**Inputs:**
- image_file: binary image file with EXIF metadata

**Logic:**

```
1. Read EXIF metadata from image_file
2. IF EXIF contains GPSLatitude AND GPSLongitude:
     a. latitude = convert GPS DMS (degrees, minutes, seconds) to decimal degrees
        latitude = degrees + minutes/60 + seconds/3600
        IF GPSLatitudeRef = "S": latitude = -latitude
     b. longitude = convert GPS DMS to decimal degrees
        longitude = degrees + minutes/60 + seconds/3600
        IF GPSLongitudeRef = "W": longitude = -longitude
     c. elevation = GPSAltitude if present (float, meters above sea level)
        IF GPSAltitudeRef = 1: elevation = -elevation (below sea level)
     d. RETURN { latitude, longitude, elevation, has_gps: true }
3. ELSE:
     RETURN { has_gps: false }
```

**Edge Cases:**
- No EXIF data at all: Return has_gps = false
- EXIF GPS data with 0,0 coordinates (common default): Treat as no GPS data (has_gps = false)
- EXIF timestamp available: Use as captured_at if present
- Corrupted EXIF data: Return has_gps = false, log warning

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | Alert: "MyTrails needs camera access to take geotagged photos. Enable Camera in Settings." with a button to open device Settings. | User grants permission and returns to the app |
| Camera unavailable (hardware error) | Alert: "Camera is not available. You can add photos from your photo library instead." | User taps "Choose from Library" or dismisses |
| Photo library permission denied | Alert: "MyTrails needs photo library access to attach existing photos. Enable Photos in Settings." | User grants permission in Settings |
| Storage full when saving photo | Alert: "Not enough storage to save this photo. Free up space and try again." Photo data is discarded, recording continues. | User frees device storage |
| Maximum 200 photos per track reached | Alert: "Maximum of 200 photos per activity. Delete existing photos to add more." Camera button becomes disabled. | User deletes older photos or finishes the activity |
| Photo file corrupted on read | Thumbnail shows a broken-image placeholder icon. Full-screen viewer shows: "Photo could not be loaded." | No recovery possible for corrupted files. User can delete the broken photo entry. |

**Validation Timing:**
- Camera permission is checked when the camera button is tapped
- Photo library permission is checked when the "Choose from Library" option is selected
- Storage availability is checked before saving the compressed photo
- Photo count limit is checked before opening the camera

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a recording is in progress,
   **When** the user taps the camera button, takes a photo, enters a caption, and taps "Save",
   **Then** a photo marker appears on the recording map at the current GPS position, and the photo is stored locally with the correct coordinates, caption, and timestamp.

2. **Given** a completed track has 5 geotagged photos,
   **When** the user opens the Trail Detail screen,
   **Then** all 5 photos appear as circular thumbnail markers on the route map at their correct positions, and a photo gallery strip shows all 5 thumbnails in chronological order below the elevation profile.

3. **Given** the user taps a photo marker on the route map,
   **When** the popup preview appears,
   **Then** the preview shows the photo thumbnail, caption, and timestamp. Tapping the preview opens the full-screen viewer with the complete photo and metadata.

**Edge Cases:**

4. **Given** the user attaches a photo from their library that has EXIF GPS data,
   **When** the photo is attached to a completed track,
   **Then** the system reads the GPS coordinates from the EXIF data and places the photo marker at that location on the route.

5. **Given** the user attaches a photo from their library that has no EXIF GPS data,
   **When** they are prompted to place the photo on the route,
   **Then** a map view appears where the user taps a location on the route to pin the photo, and the photo marker is placed at the tapped position.

**Negative Tests:**

6. **Given** camera permission has not been granted,
   **When** the user taps the camera button during recording,
   **Then** a permission request dialog is shown. If denied, an alert explains the requirement with a link to Settings.
   **And** no photo is captured, recording continues uninterrupted.

7. **Given** a track already has 200 geotagged photos,
   **When** the user attempts to take another photo,
   **Then** an alert shows "Maximum of 200 photos per activity."
   **And** the camera does not open.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| compresses photo to max 2048px dimension | 4000x3000 image | 2048x1536 image |
| preserves aspect ratio during compression | 3000x4000 (portrait) image | 1536x2048 image |
| does not upscale small images | 800x600 image | 800x600 image (unchanged dimensions) |
| generates 256x256 thumbnail | 2048x1536 image | 256x256 center-cropped thumbnail |
| extracts EXIF GPS coordinates | Photo with GPS DMS (37 53 28.2 N, 122 34 17.2 W) | latitude: 37.8912, longitude: -122.5714 |
| handles missing EXIF GPS data | Photo with no GPS EXIF tags | has_gps: false |
| rejects EXIF GPS at (0,0) | Photo with GPS at exactly 0,0 | has_gps: false |
| calculates distance along route | Photo at position nearest to 3rd point of 10-point route | distance_from_start_m equals cumulative distance to 3rd point |
| handles empty track points | Photo location, empty points array | distance_from_start_m: 0.0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Capture photo during recording | 1. Start recording, 2. Walk 500m, 3. Tap camera, 4. Take photo with caption, 5. Save | Photo marker appears on map at current position. GeoPhoto record created with correct coordinates and caption. |
| Attach library photo with EXIF GPS | 1. Complete a track, 2. Open Trail Detail, 3. Tap "Add Photo from Library", 4. Select a photo with GPS EXIF | Photo marker placed at EXIF coordinates on the route map |
| Photo gallery chronological order | 1. Record track with 5 photos taken at different locations, 2. Open Trail Detail | Gallery shows 5 thumbnails in the order they were captured along the route |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Document a scenic hike | 1. Start recording a hike, 2. Take 3 photos at scenic points with captions, 3. Finish recording, 4. Open Trail Detail, 5. Browse photos in gallery, 6. Tap photo markers on map | Trail Detail shows route with 3 photo markers at correct positions. Gallery shows 3 thumbnails. Full-screen viewer shows each photo with caption, timestamp, and map location. |

---

### TR-009: Trip Planning

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-009 |
| **Feature Name** | Trip Planning |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a trip planner, I want to create multi-day trip itineraries with planned routes for each day so that I can prepare for upcoming outdoor vacations and share the plan with companions.

**Secondary:**
> As a backpacker, I want to plan my route before heading out by drawing waypoints on the map so that I can estimate distance, elevation gain, and time for the planned hike.

**Tertiary:**
> As a weekend explorer, I want to browse my upcoming and past trips in one view so that I can quickly find and revisit trip plans.

#### 3.3 Detailed Description

Trip Planning lets users create structured itineraries for upcoming outdoor adventures. A trip is a container that groups one or more planned days, each with optional planned routes, notes, and attached information. This feature transforms MyTrails from a recording-only tool into a complete trip management system.

A trip has a name, date range, destination description, and one or more day entries. Each day can have a planned route (a sequence of waypoints drawn on the map that generates an estimated distance and elevation profile), free-form notes, and links to recorded tracks (after the trip, users can associate their actual recordings with the planned days).

Users create planned routes by tapping waypoints on the map. The system draws straight-line segments between consecutive waypoints and calculates the total distance using the Haversine formula. An estimated elevation profile is generated from the waypoint elevations (if available from offline map data or manually entered). The system estimates hiking time using Naismith's Rule: 5 km/h on flat terrain plus 1 hour per 600 meters of ascent.

Trip plans are stored locally and can be exported as a structured JSON file or as individual GPX route files per day. Users can share trip plans with companions via the device share sheet.

The Trip List screen shows upcoming trips sorted by start date, past trips sorted by most recent, and a "Create Trip" button. Each trip card shows the trip name, date range, destination, day count, and a small map showing all planned route waypoints.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-006: Offline Map Tiles - Trip planning requires map display for route drawing

**External Dependencies:**
- Map tile data for the destination area (online or pre-downloaded)
- Device storage for trip plan data

**Assumed Capabilities:**
- The app can render an interactive map with tappable waypoint placement
- The app can calculate distances between map-tapped coordinates
- The app can store structured multi-level data (trip > days > routes > waypoints)

#### 3.5 User Interface Requirements

##### Screen: Trip List

**Layout:**
- A top navigation bar with the title "Trips" and a "+" (create) button on the right
- Two sections: "Upcoming" (trips with end_date >= today, sorted by start_date ascending) and "Past" (trips with end_date < today, sorted by start_date descending)
- Each trip card shows: trip name (bold), date range (e.g., "Mar 15-18, 2026"), destination, day count (e.g., "4 days"), and a small map thumbnail showing all planned waypoints
- If no trips exist, an empty state illustration with text: "No trips planned yet" and a "Plan a Trip" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No trips exist | Illustration with "No trips planned yet" message and "Plan a Trip" button |
| Populated | One or more trips exist | Sectioned list with Upcoming and Past trips |
| Upcoming Only | All trips are in the future | "Upcoming" section populated, "Past" section shows "No past trips" |
| Past Only | All trips are in the past | "Past" section populated, "Upcoming" section shows "No upcoming trips" |

**Interactions:**
- Tap "+" button: Navigates to the Create Trip screen
- Tap a trip card: Navigates to the Trip Detail screen
- Swipe left on a trip card: Reveals "Delete" action with confirmation
- Long-press a trip card: Context menu with Edit, Duplicate, Export, Delete

##### Screen: Trip Detail

**Layout:**
- A scrollable screen showing the complete trip itinerary
- Header section: trip name, date range, destination, total planned distance across all days, total estimated hiking time
- Below the header: a list of day cards, one per day of the trip
- Each day card shows: day label (e.g., "Day 1 - Sat, Mar 15"), planned route name (if any), planned distance (e.g., "14.2 km"), estimated elevation gain, estimated time, and a small route map preview
- If a recorded track has been linked to a day, a "Recorded" badge appears with actual vs. planned comparison stats
- An "Add Day" button at the bottom of the day list
- A map view toggle that shows all days' planned routes overlaid on a single map with different colors per day

**Interactions:**
- Tap a day card: Navigates to the Day Detail screen for route planning
- Tap "Add Day": Adds a new blank day entry at the end
- Tap map toggle: Switches between day list view and full map view showing all routes
- Tap "Edit" (nav bar): Enables editing mode for trip name, dates, destination
- Tap "Export": Exports the trip as JSON or individual GPX route files

##### Screen: Route Planner (Day Detail)

**Layout:**
- Full-screen map occupying the top 65% of the screen
- Planned waypoints are shown as numbered markers on the map (1, 2, 3...)
- Straight-line segments connect consecutive waypoints with a dashed polyline
- A control bar below the map with three buttons: "Add Waypoint" (active by default), "Move Waypoint" (drag mode), and "Delete Waypoint" (tap to remove)
- Below the control bar, a stats panel shows: total planned distance, estimated elevation gain, estimated hiking time, and waypoint count
- A notes text area at the bottom for free-form day notes (max 2000 characters)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Route | No waypoints placed | Map centered on trip destination. Instruction text: "Tap the map to add waypoints for your planned route" |
| Route In Progress | 1 or more waypoints placed | Numbered waypoint markers with connecting dashed lines. Stats update as waypoints are added. |
| Drag Mode | "Move Waypoint" is active | Waypoint markers become draggable. Moving a waypoint updates the connecting lines and stats in real time. |
| Delete Mode | "Delete Waypoint" is active | Tapping a waypoint removes it. Connecting lines recompute. |

**Interactions:**
- Tap on map (in Add mode): Places a new numbered waypoint at the tapped location. Dashed line extends from previous waypoint to new one. Stats update.
- Drag a waypoint (in Move mode): Repositions the waypoint. Lines and stats recompute in real time.
- Tap a waypoint (in Delete mode): Removes the waypoint after confirmation. Remaining waypoints renumber.
- Tap "Undo": Reverts the last waypoint action (add, move, or delete). Up to 20 undo steps.
- Tap "Clear All": Confirmation dialog, then removes all waypoints.

**Transitions/Animations:**
- New waypoint markers appear with a drop-in animation (200ms)
- Connecting dashed lines extend smoothly to new waypoints (150ms)
- Stats counter values animate on update (150ms)

#### 3.6 Data Requirements

##### Entity: Trip

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the trip |
| name | string | Required, max 200 chars | None | Trip name (e.g., "Yosemite Backpacking") |
| destination | string | Optional, max 200 chars | null | Destination description (e.g., "Yosemite National Park, CA") |
| start_date | date | Required, YYYY-MM-DD | None | First day of the trip |
| end_date | date | Required, YYYY-MM-DD | None | Last day of the trip |
| notes | string | Optional, max 5000 chars | null | General trip notes |
| total_planned_distance_m | float | Min: 0.0 | 0.0 | Sum of all day planned distances in meters |
| total_estimated_time_ms | integer | Min: 0 | 0 | Sum of all day estimated hiking times in milliseconds |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: TripDay

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the trip day |
| trip_id | string | Foreign key to Trip.id, required | None | The trip this day belongs to |
| day_number | integer | Min: 1, required | Auto-incremented | Day number within the trip (1, 2, 3...) |
| date | date | Required, YYYY-MM-DD | None | Calendar date for this day |
| route_name | string | Optional, max 200 chars | null | Name for the planned route (e.g., "Valley Floor Loop") |
| planned_distance_m | float | Min: 0.0 | 0.0 | Total planned distance for this day in meters |
| planned_elevation_gain_m | float | Min: 0.0 | 0.0 | Estimated elevation gain for this day in meters |
| estimated_time_ms | integer | Min: 0 | 0 | Estimated hiking time for this day in milliseconds |
| notes | string | Optional, max 2000 chars | null | Day-specific notes |
| linked_track_id | string | Foreign key to Track.id, nullable | null | The actual recorded track linked to this day |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: PlannedWaypoint

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the waypoint |
| trip_day_id | string | Foreign key to TripDay.id, required | None | The trip day this waypoint belongs to |
| sequence_number | integer | Min: 1, required | Auto-incremented | Order of the waypoint in the route (1, 2, 3...) |
| latitude | float | -90.0 to 90.0, required | None | WGS84 latitude |
| longitude | float | -180.0 to 180.0, required | None | WGS84 longitude |
| elevation_m | float | Nullable | null | Elevation at this waypoint (if known) |
| name | string | Optional, max 100 chars | null | Waypoint label (e.g., "Trailhead", "Camp 1") |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- Trip has many TripDays (one-to-many via trip_id)
- TripDay has many PlannedWaypoints (one-to-many via trip_day_id)
- TripDay optionally links to one Track (many-to-one via linked_track_id)

**Indexes:**
- Trip(start_date) - sort trips by date
- TripDay(trip_id, day_number) - ordered days within a trip
- PlannedWaypoint(trip_day_id, sequence_number) - ordered waypoints within a day

**Validation Rules:**
- start_date must be on or before end_date
- day_number must be unique within a trip
- date must fall within the trip's start_date to end_date range
- sequence_number must be unique within a trip day
- A trip may have a maximum of 30 days
- A trip day may have a maximum of 100 planned waypoints

**Example Data:**

```
Trip:
{
  "id": "trip-001",
  "name": "Yosemite Backpacking",
  "destination": "Yosemite National Park, CA",
  "start_date": "2026-06-15",
  "end_date": "2026-06-18",
  "notes": "Wilderness permit required. Bear canister mandatory.",
  "total_planned_distance_m": 48200.0,
  "total_estimated_time_ms": 57600000,
  "created_at": "2026-03-06T20:00:00Z"
}

TripDay:
{
  "id": "day-001",
  "trip_id": "trip-001",
  "day_number": 1,
  "date": "2026-06-15",
  "route_name": "Happy Isles to Little Yosemite Valley",
  "planned_distance_m": 11500.0,
  "planned_elevation_gain_m": 610.0,
  "estimated_time_ms": 16200000,
  "notes": "Start early (6 AM). Water fill at Vernal Falls bridge.",
  "linked_track_id": null
}
```

#### 3.7 Business Logic Rules

##### Naismith's Rule - Hiking Time Estimation

**Purpose:** Estimate the time required to complete a planned route based on distance and elevation gain.

**Inputs:**
- distance_m: float - Total planned distance in meters
- elevation_gain_m: float - Total estimated elevation gain in meters

**Logic:**

```
1. BASE_SPEED_M_PER_S = 1.389 (5 km/h on flat terrain)
2. CLIMB_PENALTY_S_PER_M = 6.0 (1 hour per 600 meters of ascent = 3600/600)
3. flat_time_s = distance_m / BASE_SPEED_M_PER_S
4. climb_time_s = elevation_gain_m * CLIMB_PENALTY_S_PER_M
5. total_time_s = flat_time_s + climb_time_s
6. total_time_ms = round(total_time_s * 1000)
7. RETURN total_time_ms
```

**Formulas:**
- Flat time = distance / 5 km/h
- Climb penalty = 1 hour per 600m of ascent
- Total time = flat time + climb penalty
- Naismith's Rule: T = D/5 + H/600 (hours), where D = distance in km, H = elevation gain in meters

**Edge Cases:**
- Zero distance: Return 0
- Zero elevation gain: Return flat time only
- Very steep route (elevation gain exceeds horizontal distance): Formula still applies; result will be dominated by climb penalty
- Negative elevation gain (net descent): Treat as 0 for climb penalty (descent is not penalized in the basic formula)

##### Planned Route Distance Calculation

**Purpose:** Calculate the total distance of a planned route by summing straight-line (Haversine) distances between consecutive waypoints.

**Inputs:**
- waypoints: array of PlannedWaypoint ordered by sequence_number

**Logic:**

```
1. IF waypoints.length < 2:
     RETURN 0.0
2. total_distance = 0.0
3. FOR i = 1 to waypoints.length - 1:
     segment = haversine(waypoints[i-1].lat, waypoints[i-1].lon,
                          waypoints[i].lat, waypoints[i].lon)
     total_distance = total_distance + segment
4. RETURN total_distance
```

**Edge Cases:**
- Single waypoint: Return 0.0
- Two identical waypoints: Return 0.0
- Waypoints very far apart (>100 km per segment): Formula works correctly; no special handling

##### Trip Aggregate Stats Calculation

**Purpose:** Compute total planned distance and estimated time across all days of a trip.

**Inputs:**
- trip_days: array of TripDay

**Logic:**

```
1. total_distance = sum of planned_distance_m across all trip_days
2. total_elevation = sum of planned_elevation_gain_m across all trip_days
3. total_time = sum of estimated_time_ms across all trip_days
4. UPDATE Trip with total_planned_distance_m = total_distance
5. UPDATE Trip with total_estimated_time_ms = total_time
6. RETURN { total_distance, total_elevation, total_time }
```

**Edge Cases:**
- Trip with no days: All totals are 0
- Days with no planned routes: Their contribution is 0

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Trip save fails (database error) | Alert: "Could not save trip. Please try again." | User taps "Retry" to attempt save again |
| Start date is after end date | Inline validation: "Start date must be on or before end date" | User corrects the date range |
| Maximum 30 days exceeded | When trying to add a day beyond 30: "Maximum of 30 days per trip." | User deletes existing days or creates a separate trip |
| Maximum 100 waypoints per day exceeded | "Maximum of 100 waypoints per day route." Add Waypoint button becomes disabled. | User removes unnecessary waypoints |
| Map tiles unavailable for destination | Route planner shows waypoints and lines on a gray background. Stats still calculate correctly. | User downloads offline map tiles for the destination area |
| Linked track does not exist (deleted after linking) | Day card shows "Linked track was deleted" in place of the comparison stats | User can re-link a different track or clear the link |

**Validation Timing:**
- Date range validation runs when the user changes start or end date
- Waypoint limit validation runs before each waypoint add action
- Day limit validation runs before each day add action
- Trip save validation runs on explicit save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "+" on the Trip List screen,
   **When** they enter a trip name "Weekend in Big Sur", set dates Mar 15-16, and save,
   **Then** a new trip appears in the "Upcoming" section of the Trip List with the correct name and date range.

2. **Given** the user opens a trip with 2 days and navigates to Day 1's route planner,
   **When** they tap 5 waypoints on the map,
   **Then** numbered markers (1-5) appear at the tapped locations, dashed lines connect them in order, and the stats panel shows the total distance, estimated elevation gain, and estimated hiking time.

3. **Given** a trip has 3 days with planned routes,
   **When** the user taps the map toggle on the Trip Detail screen,
   **Then** a map displays all 3 days' routes overlaid with different colors, and the trip header shows the combined total distance and estimated time.

**Edge Cases:**

4. **Given** a trip's end date has passed and the user recorded tracks during the trip,
   **When** they link recorded tracks to the trip days,
   **Then** each day card shows a comparison between planned and actual distance, elevation, and time.

5. **Given** the user is in Move Waypoint mode and drags waypoint 3 to a new position,
   **When** they release the waypoint,
   **Then** the connecting lines from waypoint 2 to 3 and from 3 to 4 update, and the total distance and estimated time recalculate.

**Negative Tests:**

6. **Given** the user sets a start date of Mar 20 and an end date of Mar 15,
   **When** they attempt to save the trip,
   **Then** an inline validation message shows "Start date must be on or before end date."
   **And** the trip is not saved.

7. **Given** a trip day already has 100 waypoints,
   **When** the user taps the map to add another waypoint,
   **Then** an alert shows "Maximum of 100 waypoints per day route" and no waypoint is added.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Naismith's Rule for flat 10km hike | distance: 10000m, gain: 0m | 7200000ms (2 hours) |
| Naismith's Rule for 5km with 600m gain | distance: 5000m, gain: 600m | 3600000 + 3600000 = 7200000ms (2 hours) |
| Naismith's Rule for zero distance | distance: 0m, gain: 0m | 0ms |
| Naismith's Rule for steep climb | distance: 2000m, gain: 1200m | 1440000 + 7200000 = 8640000ms (2h 24m) |
| planned route distance with 3 waypoints | 3 waypoints forming known triangle | correct Haversine total |
| planned route distance with 1 waypoint | single waypoint | 0.0 meters |
| trip aggregate with 3 days | day distances: [10000, 15000, 8000] | total: 33000m |
| trip aggregate with no days | empty days array | total: 0.0m, time: 0ms |
| date validation rejects end before start | start: 2026-03-20, end: 2026-03-15 | validation error |
| day limit validation at 30 days | trip with 30 days, attempt to add 31st | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create trip with planned route | 1. Create trip, 2. Open Day 1, 3. Place 5 waypoints, 4. Verify stats | Trip day shows correct distance and estimated time |
| Link recorded track to trip day | 1. Create trip, 2. Record a hike, 3. Open trip day, 4. Link the recorded track | Day shows planned vs. actual comparison |
| Undo waypoint placement | 1. Place 5 waypoints, 2. Tap Undo 3 times | 2 waypoints remain, stats reflect 2 waypoints |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Plan a weekend backpacking trip | 1. Create trip "Yosemite Weekend" (Jun 15-17), 2. Plan Day 1 route (5 waypoints), 3. Plan Day 2 route (8 waypoints), 4. Add notes to each day, 5. View map overlay of both days, 6. Export trip | Trip List shows upcoming trip. Trip Detail shows 2 planned days with distances and times. Map overlay shows both routes. Export generates valid files. |

---

### TR-010: Trail Difficulty Rating

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-010 |
| **Feature Name** | Trail Difficulty Rating |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a day hiker, I want to rate the difficulty of my completed hike so that I can remember how challenging it was and plan future hikes of appropriate difficulty.

**Secondary:**
> As a trip planner, I want the system to auto-suggest a difficulty rating based on the trail's distance and elevation gain so that I have an objective baseline before applying my personal assessment.

**Tertiary:**
> As a trail runner, I want to filter my trail history by difficulty so that I can quickly find easy recovery runs or hard training routes.

#### 3.3 Detailed Description

Trail Difficulty Rating allows users to assign a difficulty level to completed tracks and also provides an automatic difficulty suggestion based on objective trail metrics. The system uses a four-tier difficulty scale: Easy, Moderate, Hard, and Expert.

When a user finishes recording an activity and views the Trail Detail screen, the difficulty field appears with an auto-suggested value based on the track's distance and elevation gain. The user can accept the suggestion or override it with their own assessment. The difficulty rating is saved with the track and displayed on trail history cards and the detail screen.

The auto-suggestion algorithm uses a combination of distance and elevation gain thresholds. These thresholds are calibrated to standard hiking difficulty guidelines:

- Easy: Less than 8 km distance and less than 300 m elevation gain
- Moderate: 8-16 km distance or 300-600 m elevation gain (whichever is higher)
- Hard: 16-25 km distance or 600-1200 m elevation gain (whichever is higher)
- Expert: More than 25 km distance or more than 1200 m elevation gain

The difficulty rating also factors in steepness: if the average gradient of the steepest 10% of the route exceeds 25%, the difficulty is increased by one level (e.g., Moderate becomes Hard). This accounts for routes that are short but extremely steep.

Users can filter the Trail History Log (TR-002) by difficulty rating and see difficulty distribution in the Stats Dashboard (TR-005).

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Provides the distance and elevation data used for difficulty calculation
- TR-002: Trail History Log - Difficulty rating appears on history cards and is available as a filter

**External Dependencies:**
- None (all computation is local)

**Assumed Capabilities:**
- The app can compute gradient from TrackPoint elevation data

#### 3.5 User Interface Requirements

##### Component: Difficulty Rating Selector (within Trail Detail)

**Layout:**
- A horizontal row of four selectable buttons, one per difficulty level: Easy (green), Moderate (yellow/amber), Hard (orange), and Expert (red)
- Each button shows the difficulty label and a small icon (Easy: gentle slope, Moderate: hill, Hard: mountain, Expert: jagged peaks)
- The auto-suggested difficulty is pre-selected with a subtle "Suggested" label below it
- Positioned below the track name and activity type on the Trail Detail screen
- A small info icon next to the section header "Difficulty" that shows a tooltip explaining the difficulty criteria

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Auto-Suggested | Track is new, no user override | Suggested difficulty is highlighted with a "Suggested" badge. Other options are selectable but dimmed. |
| User-Selected | User has tapped a difficulty level | Selected level is highlighted. "Suggested" badge is removed. |
| No Suggestion | Track has insufficient data (e.g., no elevation data, distance < 100m) | All four options are equally styled (no pre-selection). A note: "Auto-suggestion unavailable for this activity." |

**Interactions:**
- Tap a difficulty button: Selects that difficulty level, saves to the Track record
- Tap the info icon: Shows a popup with the difficulty criteria thresholds
- Tap the already-selected button: Deselects, setting difficulty to null (removes rating)

**Transitions/Animations:**
- Selection highlight transitions with a 150ms color animation
- "Suggested" badge fades out when the user overrides the suggestion (200ms)

##### Component: Difficulty Badge (on Trail History cards)

**Layout:**
- A small colored badge on each trail history card showing the difficulty level
- Badge color matches the difficulty level: Easy (green), Moderate (amber), Hard (orange), Expert (red)
- Badge shows abbreviated text: "E", "M", "H", "X"
- Positioned in the top-right corner of the trail card

#### 3.6 Data Requirements

This feature uses the `difficulty_rating` field already defined on the Track entity in TR-001 (enum: easy, moderate, hard, expert, null).

No new entities are introduced.

**New Field on Track:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| auto_difficulty | enum | One of: easy, moderate, hard, expert, null | null | System-calculated difficulty suggestion (not user-editable) |

#### 3.7 Business Logic Rules

##### Auto-Difficulty Suggestion Algorithm

**Purpose:** Calculate a suggested difficulty rating for a track based on distance, elevation gain, and steepness.

**Inputs:**
- distance_m: float - Total track distance in meters
- elevation_gain_m: float - Total elevation gain in meters
- track_points: array of TrackPoint - For steepness calculation

**Logic:**

```
1. IF distance_m < 100 OR elevation_gain_m is null:
     RETURN null (insufficient data for suggestion)
2. Determine base difficulty from distance and elevation thresholds:
   a. distance_km = distance_m / 1000
   b. gain_m = elevation_gain_m
   c. distance_level:
      - IF distance_km < 8: "easy"
      - ELSE IF distance_km < 16: "moderate"
      - ELSE IF distance_km < 25: "hard"
      - ELSE: "expert"
   d. elevation_level:
      - IF gain_m < 300: "easy"
      - ELSE IF gain_m < 600: "moderate"
      - ELSE IF gain_m < 1200: "hard"
      - ELSE: "expert"
   e. base_difficulty = max(distance_level, elevation_level)
      using ordering: easy < moderate < hard < expert
3. Calculate steepness factor:
   a. Compute gradient for each pair of consecutive points (see TR-004 gradient calculation)
   b. Sort absolute gradient values descending
   c. Take the top 10% of gradient values
   d. avg_steep_gradient = average of the top 10% gradients
4. IF avg_steep_gradient > 25.0:
     Increase base_difficulty by one level (cap at "expert")
5. RETURN suggested_difficulty
```

**Formulas:**
- Distance thresholds: easy (<8 km), moderate (8-16 km), hard (16-25 km), expert (>25 km)
- Elevation gain thresholds: easy (<300 m), moderate (300-600 m), hard (600-1200 m), expert (>1200 m)
- Steepness bonus: If top 10% average gradient > 25%, increase one level
- Final difficulty = max(distance_level, elevation_level) + steepness_bonus

**Edge Cases:**
- No elevation data: Base difficulty from distance only, skip steepness calculation
- Very short track (<100m): Return null
- Flat terrain (all gradients near 0): No steepness bonus applied
- All gradients are steep (entire route is steep): Steepness bonus still only increases by one level
- Route is already "expert" from distance/elevation: Steepness bonus does not push beyond "expert"

##### Difficulty Level Ordering

**Purpose:** Define the ordering of difficulty levels for comparison operations (max, min, sorting).

**Logic:**

```
DIFFICULTY_ORDER = {
  "easy": 1,
  "moderate": 2,
  "hard": 3,
  "expert": 4
}

max(level_a, level_b) = level with higher DIFFICULTY_ORDER value
increase_one_level(level) = next level in order, capped at "expert"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Auto-suggestion computation fails | "Suggested" badge is not shown. All four difficulty options are equally styled. User can manually select. | No action needed. Manual selection always works. |
| Track has no elevation data | Auto-suggestion is based on distance only. A note appears: "Suggestion based on distance only (no elevation data)." | No action needed. |
| Track has fewer than 10 points (too few for gradient calculation) | Steepness factor is skipped. Auto-suggestion uses distance and elevation thresholds only. | No action needed. |
| Difficulty save fails | Toast: "Could not save difficulty rating. Please try again." | User taps the difficulty button again to retry |

**Validation Timing:**
- Auto-suggestion is computed when the Trail Detail screen loads for a track that has difficulty_rating = null
- User selection saves immediately on tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a completed hike with 12 km distance and 450 m elevation gain,
   **When** the user opens the Trail Detail screen,
   **Then** the difficulty selector shows "Moderate" pre-selected with a "Suggested" badge, because distance (12 km) falls in the moderate range and elevation (450 m) also falls in the moderate range.

2. **Given** the auto-suggestion shows "Moderate" but the user felt the trail was harder,
   **When** they tap "Hard",
   **Then** the selection changes to "Hard", the "Suggested" badge disappears, the difficulty_rating is saved as "hard", and the trail card in the history list shows an orange "H" badge.

3. **Given** the user is viewing the Trail History Log,
   **When** they open the sort/filter bottom sheet and select "Hard" as a difficulty filter,
   **Then** only tracks rated "Hard" appear in the list.

**Edge Cases:**

4. **Given** a track with 6 km distance, 200 m elevation gain, but extremely steep sections (top 10% gradient averaging 30%),
   **When** the auto-suggestion is computed,
   **Then** the base difficulty is "Easy" (both distance and elevation are below thresholds), but the steepness bonus increases it to "Moderate".

5. **Given** a track with no elevation data (all TrackPoints have null elevation_m),
   **When** the auto-suggestion is computed,
   **Then** the suggestion is based on distance only, and a note appears: "Suggestion based on distance only (no elevation data)."

**Negative Tests:**

6. **Given** a track with only 50 meters of recorded distance,
   **When** the auto-suggestion is attempted,
   **Then** no suggestion is provided (auto_difficulty = null), and a note shows "Auto-suggestion unavailable for this activity."
   **And** the user can still manually select a difficulty.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| easy hike suggestion | distance: 5km, gain: 150m | "easy" |
| moderate hike by distance | distance: 12km, gain: 100m | "moderate" (distance dominates) |
| moderate hike by elevation | distance: 5km, gain: 450m | "moderate" (elevation dominates) |
| hard hike suggestion | distance: 20km, gain: 800m | "hard" (both in hard range) |
| expert hike by distance | distance: 30km, gain: 300m | "expert" (distance dominates) |
| expert hike by elevation | distance: 5km, gain: 1500m | "expert" (elevation dominates) |
| steepness bonus upgrades easy to moderate | distance: 5km, gain: 100m, top 10% gradient avg: 30% | "moderate" |
| steepness bonus does not exceed expert | distance: 30km, gain: 1500m, top 10% gradient avg: 40% | "expert" (capped) |
| null suggestion for short track | distance: 50m, gain: 5m | null |
| null suggestion for missing elevation | distance: 10km, gain: null | "moderate" (distance only, note shown) |
| difficulty ordering max | max("easy", "hard") | "hard" |
| difficulty ordering increase | increase_one_level("moderate") | "hard" |
| difficulty ordering increase at cap | increase_one_level("expert") | "expert" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Auto-suggestion on trail completion | 1. Record a 15km hike with 500m gain, 2. Save, 3. Open Trail Detail | Difficulty selector shows "Moderate" suggested (distance moderate, elevation moderate) |
| Override suggestion and filter | 1. Set difficulty to "Hard" on a track, 2. Go to Trail History, 3. Filter by "Hard" | Track appears in filtered results |
| Difficulty badge on history card | 1. Rate a track as "Easy", 2. View Trail History | Track card shows green "E" badge |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Rate and filter by difficulty | 1. Record 3 hikes of varying difficulty, 2. Rate each (easy, moderate, hard), 3. Filter history by "Hard" only, 4. Verify only hard-rated track appears | Trail History filtered to show 1 track. Difficulty badge colors match ratings. Stats dashboard shows difficulty distribution. |

---

### TR-011: Live Location Sharing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-011 |
| **Feature Name** | Live Location Sharing |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a day hiker, I want to share my live location with a trusted contact during my hike so that someone knows where I am in case of an emergency.

**Secondary:**
> As a trip planner, I want to set an expected return time so that my emergency contact is automatically notified if I have not ended my activity by that time.

**Tertiary:**
> As a backpacker going on a multi-day trip, I want my live location sharing to work for extended periods so that my family can check my position throughout the trip.

#### 3.3 Detailed Description

Live Location Sharing is a safety feature that allows users to broadcast their GPS position to a chosen contact during an active recording. Unlike social fitness apps that store and share location data on company servers, MyTrails implements direct, temporary, peer-to-peer location sharing. The location data is transmitted via a lightweight relay server (or optionally via SMS/iMessage for maximum privacy), and is never persisted on any server beyond the active sharing session.

Before starting a recording, the user can enable live sharing by selecting a contact from their phone contacts and optionally setting an expected return time. When sharing is active, the contact receives a link (via SMS or the user's chosen messaging app) that opens a web page showing the user's current position on a map, updated every 60 seconds by default (configurable: 30s, 60s, 120s, 300s). The web page does not require any app installation or account creation by the recipient.

The sharing session automatically ends when the user stops recording. If an expected return time was set and the user has not ended their activity by that time, the system sends an automated alert message to the emergency contact: "[User Name] has not ended their [activity type] by the expected return time of [time]. Their last known position was [coordinates/link]."

Location updates are transmitted with minimal data: latitude, longitude, elevation, timestamp, and battery percentage. No historical track data is shared - only the current position. The recipient sees only the latest position and a timestamp showing when it was last updated.

All sharing is explicit, temporary, and user-initiated. There is no always-on tracking, no background sharing between sessions, and no persistent sharing links. Each sharing session generates a unique, time-limited URL that expires when the session ends or after 24 hours (whichever comes first).

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Live sharing requires an active recording session

**External Dependencies:**
- Network connectivity (cellular or Wi-Fi) for transmitting location updates
- Relay server for hosting the shared location web page (or SMS fallback)
- Contacts access for selecting the emergency contact
- SMS/messaging capability for sending the sharing link

**Assumed Capabilities:**
- The app can make periodic HTTP requests during background recording
- The app can access device contacts
- The app can send SMS or invoke messaging apps
- A lightweight relay server can receive, store (in-memory only), and serve the latest position

#### 3.5 User Interface Requirements

##### Component: Live Sharing Setup (pre-recording or during recording)

**Layout:**
- A "Share Location" toggle on the pre-recording screen (below the activity type selector)
- When toggled ON, expands to show:
  - Contact picker: "Share with" field showing the selected contact name and phone number. Tap to open the device contacts picker.
  - Update frequency selector: "Update every" with options 30s, 60s (default), 2 min, 5 min
  - Expected return time picker: "Expected return" with a time picker (optional). Default: 3 hours from now.
  - A "Start Sharing" note: "Your contact will receive a link to view your live position on a map."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Disabled | Live sharing toggle is OFF | Compact toggle with label "Share Live Location" |
| Setup | Toggle ON, contact not yet selected | Expanded form with empty contact picker, update frequency selector, return time picker |
| Ready | Contact selected, sharing configured | Expanded form showing selected contact, frequency, return time. Ready to start recording. |
| Active | Recording is in progress with sharing enabled | Recording screen shows a green "Sharing" indicator badge with the contact name. A small broadcast icon pulses near the GPS indicator. |
| Paused - No Signal | Sharing active but no network connectivity | "Sharing" badge changes to yellow with text "Sharing paused - no signal." Updates resume when connectivity returns. |
| Overdue | Expected return time has passed | Alert sent to emergency contact. Recording screen shows an orange "Overdue" badge. The user sees a notification: "You are past your expected return time." |

**Interactions:**
- Toggle "Share Live Location" ON: Expands the sharing configuration form
- Tap contact picker: Opens device contacts list filtered to contacts with phone numbers
- Select update frequency: Tap one of the frequency options (30s, 60s, 2m, 5m)
- Set expected return time: Opens a time picker; user selects a time or taps "No limit"
- During recording, tap "Sharing" badge: Shows a popup with sharing status, contact name, last update time, and a "Stop Sharing" button
- Tap "Stop Sharing": Ends the sharing session immediately. Recording continues. Contact sees "Location sharing has ended."

**Transitions/Animations:**
- Sharing configuration form expands/collapses with a smooth height animation (200ms)
- "Sharing" badge pulses gently every 5 seconds to indicate active sharing
- Broadcast icon animates with a ring-expand effect on each location update sent

##### Screen: Shared Location View (recipient web page)

**Layout:**
- A full-screen web page (no app required for the recipient)
- A map centered on the sharer's last known position with a marker
- Below the map: sharer's name, activity type, last updated timestamp (e.g., "Updated 30 seconds ago"), and battery percentage
- A footer note: "This location is shared temporarily and will stop when the activity ends."
- If the sharer is overdue: a red banner at the top: "[Name] has not ended their [activity] by the expected return time of [time]."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active | Sharer is actively sharing | Map with moving marker, live updates, green "Active" badge |
| Stale | No update received for more than 5 minutes | Map with last known position, yellow "Last updated X minutes ago" warning |
| Ended | Sharing session has ended | Map with last known position, gray "Sharing ended at [time]" badge. No further updates. |
| Expired | Link has expired (>24 hours) | Message: "This sharing link has expired." No map shown. |

#### 3.6 Data Requirements

##### Entity: SharingSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique session identifier |
| track_id | string | Foreign key to Track.id, required | None | The recording this session is linked to |
| contact_name | string | Required, max 100 chars | None | Name of the person receiving the location |
| contact_phone | string | Required | None | Phone number of the contact (for sending the link) |
| share_url | string | Required, unique | Auto-generated | The unique URL for this sharing session |
| update_interval_s | integer | One of: 30, 60, 120, 300 | 60 | How often location updates are sent |
| expected_return_at | datetime | Nullable, ISO 8601 | null | When the user expects to finish |
| overdue_alert_sent | boolean | - | false | Whether the overdue alert has been sent |
| started_at | datetime | Required, ISO 8601 | Current timestamp | When sharing began |
| ended_at | datetime | Nullable, ISO 8601 | null | When sharing ended |
| last_update_at | datetime | Nullable, ISO 8601 | null | Timestamp of the most recent location update sent |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- Track has zero or one active SharingSession
- SharingSession belongs to Track (via track_id)

**Indexes:**
- SharingSession(track_id) - lookup by track
- SharingSession(share_url) - lookup by URL for the recipient web page

**Validation Rules:**
- contact_phone must be a non-empty string
- update_interval_s must be one of the supported values: 30, 60, 120, 300
- expected_return_at must be in the future when set
- Only one active (ended_at = null) SharingSession per Track

**Example Data:**

```
SharingSession:
{
  "id": "share-001",
  "track_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "contact_name": "Jordan Smith",
  "contact_phone": "+14155551234",
  "share_url": "https://share.mytrails.app/s/a1b2c3d4e5f6",
  "update_interval_s": 60,
  "expected_return_at": "2026-03-06T14:00:00Z",
  "overdue_alert_sent": false,
  "started_at": "2026-03-06T08:15:00Z",
  "ended_at": null,
  "last_update_at": "2026-03-06T10:30:00Z",
  "created_at": "2026-03-06T08:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Location Update Transmission

**Purpose:** Periodically send the user's current GPS position to the relay server during an active sharing session.

**Inputs:**
- session: SharingSession record
- current_position: { latitude, longitude, elevation_m, timestamp }
- battery_pct: integer - Current device battery percentage

**Logic:**

```
1. IF session.ended_at is not null:
     RETURN (sharing has ended, do not send)
2. IF last_update_at is not null AND
   (now - last_update_at) < session.update_interval_s:
     RETURN (too soon since last update)
3. Prepare update payload:
   {
     "session_id": session.id,
     "lat": current_position.latitude,
     "lon": current_position.longitude,
     "ele": current_position.elevation_m,
     "ts": current_position.timestamp,
     "bat": battery_pct
   }
4. Send HTTP POST to relay server:
   URL: https://share.mytrails.app/api/update
   Body: update payload
   Timeout: 5 seconds
5. IF request succeeds:
     UPDATE session.last_update_at = now
6. IF request fails (network error, timeout):
     Log the failure. Do not retry immediately.
     Next update will be attempted at the next interval.
7. RETURN
```

**Edge Cases:**
- No network connectivity: Updates are silently skipped. Sharing resumes when connectivity returns.
- Relay server unreachable: Same as no network. No error shown to user during recording.
- Battery critically low (<5%): Include battery warning flag in the update payload

##### Overdue Alert Logic

**Purpose:** Send an automated alert to the emergency contact if the user has not ended their activity by the expected return time.

**Inputs:**
- session: SharingSession record with expected_return_at set

**Logic:**

```
1. IF session.expected_return_at is null:
     RETURN (no return time set, skip overdue check)
2. IF session.ended_at is not null:
     RETURN (session already ended)
3. IF session.overdue_alert_sent is true:
     RETURN (alert already sent, do not repeat)
4. IF now > session.expected_return_at:
     a. Compose alert message:
        "[User Name] has not ended their [activity_type] by the expected
        return time of [formatted expected_return_at]. Their last known
        position was: [share_url]"
     b. Send SMS to session.contact_phone with alert message
     c. IF SMS send succeeds OR is queued:
          UPDATE session.overdue_alert_sent = true
     d. Show local notification to user:
        "You are past your expected return time of [time].
        An alert has been sent to [contact_name]."
5. RETURN
```

**Edge Cases:**
- No network when overdue check fires: Retry on next location update cycle
- User extends their activity (adjusts return time): Reset overdue_alert_sent to false, update expected_return_at
- User ends recording before expected return time: No alert sent (sharing ends cleanly)
- SMS sending fails: Retry up to 3 times with 30-second intervals. If all fail, show notification to user: "Could not send overdue alert to [contact]. Please contact them directly."

##### Sharing Session Lifecycle

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| Not Started | User toggles sharing ON and starts recording | Active | Generate unique share_url. Send link to contact via SMS/messaging. Begin periodic location updates. |
| Active | Location update interval elapses | Active | Send current position to relay server. |
| Active | Network lost | Active (Degraded) | Skip updates. Show yellow "paused" indicator. |
| Active (Degraded) | Network restored | Active | Resume sending updates. Indicator returns to green. |
| Active | Expected return time passes | Active (Overdue) | Send overdue alert SMS to contact. Show orange "overdue" badge. |
| Active | User taps "Stop Sharing" | Ended | Set ended_at. Send "sharing ended" status to relay. Relay shows "ended" to recipient. |
| Active | User stops recording | Ended | Same as "Stop Sharing" side effects. |
| Ended | 24 hours elapse | Expired | Relay server deletes session data. Share URL returns "expired" message. |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Contacts permission denied | Alert: "MyTrails needs contacts access to select a sharing contact. Enable Contacts in Settings." | User grants permission in Settings |
| SMS sending fails (share link) | Alert: "Could not send sharing link to [contact]. You can copy the link and send it manually." with a "Copy Link" button. | User copies the link and sends via their preferred messaging app |
| Relay server unreachable during setup | Alert: "Could not start live sharing. Check your internet connection and try again." | User retries after ensuring network connectivity |
| Location updates failing silently | Yellow "Sharing paused" indicator on the recording screen. No disruptive alerts during recording. | Updates resume automatically when connectivity returns |
| Overdue SMS fails to send | Local notification: "Could not send overdue alert to [contact]. Please contact them directly." | User manually contacts their emergency contact |
| Battery dies during sharing | Relay server shows "Last updated X minutes ago" to recipient. No further updates possible. | Recipient sees stale data. Nothing the user can do (device is off). |

**Validation Timing:**
- Contacts permission checked when the contact picker is opened
- Network availability checked when starting a sharing session
- Expected return time validated to be in the future when set
- Overdue check runs on every location update cycle

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enables live sharing, selects a contact, and starts recording,
   **When** the recording begins,
   **Then** the contact receives an SMS with a unique sharing link, the recording screen shows a green "Sharing" badge, and opening the link shows the user's current position on a map.

2. **Given** live sharing is active with 60-second updates,
   **When** 60 seconds elapse and the user has moved,
   **Then** the relay server receives an updated position, and the recipient's web page updates to show the new position with an "Updated X seconds ago" timestamp.

3. **Given** the user set an expected return time of 2:00 PM and it is now 2:01 PM,
   **When** the overdue check fires,
   **Then** the contact receives an SMS: "[Name] has not ended their hike by the expected return time of 2:00 PM. Their last known position was: [link]." The user sees an "Overdue" badge and a notification.

**Edge Cases:**

4. **Given** the user loses cell service during a hike with active sharing,
   **When** service is lost for 20 minutes,
   **Then** the sharing badge turns yellow with "paused" indicator, the recipient's page shows "Last updated 20 minutes ago", and when service returns, updates resume automatically.

5. **Given** the user stops recording (ending the activity),
   **When** the sharing session ends,
   **Then** the relay server is notified, the recipient's page shows "Sharing ended at [time]", the share URL expires after 24 hours, and no further location data is transmitted.

**Negative Tests:**

6. **Given** the relay server is unreachable when the user tries to start sharing,
   **When** the setup request fails,
   **Then** an alert shows "Could not start live sharing" and the recording can still start without sharing.
   **And** no location data is transmitted.

7. **Given** the sharing link has expired (>24 hours after session ended),
   **When** someone opens the link,
   **Then** the page shows "This sharing link has expired" with no map and no location data.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| location update skipped when interval not elapsed | last_update: 30s ago, interval: 60s | no update sent |
| location update sent when interval elapsed | last_update: 61s ago, interval: 60s | update payload sent |
| overdue alert triggered after return time | expected_return: 2:00 PM, now: 2:01 PM, alert not sent yet | alert message composed and sent |
| overdue alert not repeated | overdue_alert_sent: true, now: past return time | no alert sent |
| overdue check skipped when no return time | expected_return_at: null | no check performed |
| sharing session ends on stop recording | session active, user stops | ended_at set, relay notified |
| update payload includes battery | battery: 42% | payload contains bat: 42 |
| share URL generation is unique | generate 100 URLs | all 100 are unique strings |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete sharing lifecycle | 1. Enable sharing, select contact, 2. Start recording, 3. Walk for 5 minutes, 4. Stop recording | SMS sent with link. Location updates transmitted every interval. Sharing ends when recording stops. |
| Overdue alert flow | 1. Enable sharing with return time 5 minutes from now, 2. Start recording, 3. Wait 6 minutes without stopping | Overdue alert sent to contact after the return time passes |
| Network loss and recovery | 1. Start sharing, 2. Simulate network loss, 3. Verify badge turns yellow, 4. Restore network | Updates pause during loss, badge turns yellow, updates resume on recovery |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Safety sharing on a solo hike | 1. Enable live sharing with spouse as contact, 2. Set return time to 3 hours, 3. Start recording, 4. Hike for 2 hours, 5. Stop recording | Spouse received sharing link at start. Map showed live position throughout. Sharing ended cleanly when recording stopped. No overdue alert sent (finished before return time). |

---

### TR-012: Achievement Badges

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-012 |
| **Feature Name** | Achievement Badges |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a day hiker, I want to earn achievement badges for reaching outdoor milestones so that I feel motivated to keep hiking and exploring new trails.

**Secondary:**
> As a trail runner, I want to see my progress toward upcoming badges so that I have tangible goals to work toward in my training.

**Tertiary:**
> As a weekend explorer, I want to collect badges for variety (different activity types, different regions) so that I am encouraged to try new things beyond my usual routes.

#### 3.3 Detailed Description

Achievement Badges is a gamification system that awards virtual badges when users reach predefined milestones in their outdoor activity history. Badges provide positive reinforcement and goal-setting without any social comparison or public leaderboard. All badge progress is local to the user.

The badge system defines 30 badges across 5 categories: Distance (cumulative distance milestones), Elevation (cumulative climbing milestones), Frequency (activity count milestones), Variety (activity type diversity), and Personal Bests (setting records). Each badge has a name, icon, description, requirement, and three tiers: Bronze, Silver, and Gold, with progressively harder thresholds.

After each completed activity, the system evaluates all badges and awards any newly earned ones. A celebratory notification appears when a badge is earned, showing the badge icon, name, and tier. The notification is non-blocking and auto-dismisses after 4 seconds.

Users view their earned badges and progress in a Badges screen accessible from the Stats Dashboard. The Badges screen shows all 30 badges organized by category, with earned badges shown in full color and unearned badges shown in a locked/grayed-out state. Tapping a badge shows its description, requirement, current progress, and the activity that earned it (if earned). A progress bar on unearned badges shows how close the user is to earning them.

Badge data is computed from Track records at evaluation time and cached. Badge evaluations are deterministic: given the same Track data, the same badges are always earned.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-002: Trail History Log - Badge evaluation requires access to all Track records
- TR-005: Trail Statistics Dashboard - Badges are accessed from the Stats screen

**External Dependencies:**
- None (all computation is local)

**Assumed Capabilities:**
- The app can query aggregate statistics from all Track records
- The app can display celebration notifications with custom graphics

#### 3.5 User Interface Requirements

##### Screen: Badges

**Layout:**
- A top navigation bar with the title "Badges" and a count indicator (e.g., "12 / 90" showing earned vs. total possible including all tiers)
- Below the header: an earned badge count per category displayed as a horizontal stat bar
- The main content is organized into 5 collapsible sections, one per badge category: Distance, Elevation, Frequency, Variety, Personal Bests
- Each section contains a grid of badge icons (3 columns), each badge showing: the badge icon (full color if earned, grayscale if locked), badge name below, and a tier indicator (bronze/silver/gold ring around the icon for earned tier)
- A progress bar appears below locked badges showing percentage toward the next tier

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No tracks recorded, no badges earned | All badges shown in locked/grayscale state. A motivational message: "Start your first adventure to begin earning badges!" |
| Partially Earned | Some badges earned | Mix of full-color earned badges and grayscale locked badges. Progress bars on locked badges. |
| All Earned | All 90 badge tiers earned | Full-color grid. A special "Completionist" banner at the top. |

**Interactions:**
- Tap a badge (earned): Shows badge detail popup with name, description, tier, date earned, and the track that triggered it
- Tap a badge (locked): Shows badge detail popup with name, description, requirement, current progress, and progress bar
- Tap a category header: Expands or collapses that category section
- Scroll: Vertically scroll through categories and badges

**Transitions/Animations:**
- Badge detail popup slides up from the bottom (200ms)
- Progress bars animate to their current value on screen load (400ms, left to right)

##### Component: Badge Earned Notification

**Layout:**
- A floating notification card that appears at the top of the screen
- Shows: badge icon (full color, 48x48 px), badge name, tier label (e.g., "Silver"), and a brief congratulatory message (e.g., "You hiked 100 km!")
- Auto-dismisses after 4 seconds. User can swipe up to dismiss early.
- Tapping the notification navigates to the Badges screen.

#### 3.6 Data Requirements

##### Entity: Badge

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Predefined | Unique badge identifier (e.g., "distance_total_bronze") |
| category | enum | One of: distance, elevation, frequency, variety, personal_best | None | Badge category |
| name | string | Required | None | Display name (e.g., "Century Hiker") |
| description | string | Required | None | What the badge represents |
| tier | enum | One of: bronze, silver, gold | None | Badge tier |
| requirement_type | enum | One of: cumulative_distance, cumulative_elevation, activity_count, activity_types, single_distance, single_elevation, streak_days | None | Type of requirement to evaluate |
| requirement_value | float | Min: 0.0 | None | Threshold value for earning this badge |
| icon_name | string | Required | None | Reference to the badge icon asset |

##### Entity: EarnedBadge

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique earned badge record |
| badge_id | string | Foreign key to Badge.id, required | None | The badge that was earned |
| earned_at | datetime | Required, ISO 8601 | Current timestamp | When the badge was earned |
| trigger_track_id | string | Foreign key to Track.id, nullable | null | The track that triggered earning this badge |
| progress_value | float | Min: 0.0 | None | The actual value at the time of earning (e.g., total distance = 101.2 km) |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- Badge is a static reference table (predefined, 90 records)
- EarnedBadge links a Badge to the moment it was earned
- EarnedBadge optionally references the Track that triggered it

**Indexes:**
- EarnedBadge(badge_id) - unique per badge (each badge can only be earned once)
- EarnedBadge(earned_at) - sort by most recently earned

**Validation Rules:**
- A badge_id can appear at most once in EarnedBadge (no duplicate awards)
- trigger_track_id must reference a valid Track if set

**Predefined Badge Catalog (30 badges x 3 tiers = 90 total):**

| Badge Name | Category | Bronze Threshold | Silver Threshold | Gold Threshold |
|-----------|----------|-----------------|-----------------|----------------|
| Distance Wanderer | distance | 50 km total | 250 km total | 1,000 km total |
| Century Hiker | distance | 100 km total | 500 km total | 2,000 km total |
| Marathon Walker | distance | 42.2 km single | 84.4 km single | 168.8 km single |
| Long Hauler | distance | 20 km single | 40 km single | 80 km single |
| Daily Miler | distance | 1.6 km in a day x10 | x50 | x200 |
| Hill Climber | elevation | 1,000 m total | 5,000 m total | 20,000 m total |
| Peak Bagger | elevation | 500 m single | 1,000 m single | 2,000 m single |
| Everest Challenger | elevation | 8,849 m total | 17,698 m total | 44,245 m total |
| Summit Seeker | elevation | Reach 1,000 m elev | 2,000 m elev | 3,000 m elev |
| Vertical Mile | elevation | 1,609 m single | 3,218 m single | 4,827 m single |
| Trailblazer | frequency | 10 activities | 50 activities | 200 activities |
| Weekend Warrior | frequency | 4 weekends active | 20 weekends | 52 weekends |
| Streak Runner | frequency | 3-day streak | 7-day streak | 30-day streak |
| Early Bird | frequency | 10 activities started before 7 AM | 50 | 200 |
| Night Owl | frequency | 5 activities ended after 8 PM | 20 | 50 |
| All-Rounder | variety | 2 activity types | 3 activity types | 5 activity types |
| Explorer | variety | 5 unique start locations (>5 km apart) | 15 | 50 |
| Season Hiker | variety | Activities in 2 seasons | 3 seasons | All 4 seasons |
| Month Tracker | variety | Activities in 6 months of a year | 9 months | All 12 months |
| Altitude Ranger | variety | Tracks from 0-500m, 500-1500m, 1500m+ | all ranges in 1 month | all ranges in 1 week |
| Speed Demon | personal_best | Avg speed > 6 km/h on any track | > 10 km/h | > 15 km/h |
| Endurance King | personal_best | 4+ hour single activity | 8+ hours | 12+ hours |
| Iron Legs | personal_best | 5+ km with 500+ m gain single | 10+ km, 1000+ m gain | 20+ km, 1500+ m gain |
| Consistency | personal_best | Track in 4 consecutive weeks | 8 weeks | 16 weeks |
| Photo Journalist | personal_best | 10 geotagged photos total | 50 | 200 |
| Wayfinder | personal_best | 5 trips planned | 15 trips | 30 trips |
| Cartographer | personal_best | 3 offline map regions downloaded | 10 | 25 |
| Data Master | personal_best | 10 GPX files imported or exported | 50 | 100 |
| Completionist | personal_best | 30 badges earned (any tier) | 60 badges | All 90 badges |
| Privacy Champion | personal_best | Set up 1 privacy zone | 3 zones | Export with zones applied 10 times |

#### 3.7 Business Logic Rules

##### Badge Evaluation Engine

**Purpose:** After each completed activity, evaluate all badge requirements and award any newly earned badges.

**Inputs:**
- all_tracks: array of Track - Complete track history
- earned_badges: array of EarnedBadge - Already earned badges
- trigger_track: Track - The track that just completed (for trigger_track_id)

**Logic:**

```
1. newly_earned = []
2. Compute aggregate stats from all_tracks:
   a. total_distance_m = sum of distance_m across all tracks
   b. total_elevation_gain_m = sum of elevation_gain_m
   c. total_activities = count of all tracks
   d. activity_types_used = distinct set of activity_type values
   e. unique_start_locations = distinct start locations (>5 km apart)
   f. consecutive_weeks = longest streak of weeks with at least 1 activity
   g. (other aggregate metrics as needed by badge requirements)
3. FOR each Badge in the predefined catalog:
   a. IF badge.id is already in earned_badges, SKIP
   b. Evaluate badge requirement:
      SWITCH badge.requirement_type:
        case "cumulative_distance":
          current_value = total_distance_m / 1000 (convert to km)
          met = current_value >= badge.requirement_value
        case "cumulative_elevation":
          current_value = total_elevation_gain_m
          met = current_value >= badge.requirement_value
        case "activity_count":
          current_value = total_activities
          met = current_value >= badge.requirement_value
        case "activity_types":
          current_value = count of activity_types_used
          met = current_value >= badge.requirement_value
        case "single_distance":
          current_value = max distance_m of any single track / 1000
          met = current_value >= badge.requirement_value
        case "single_elevation":
          current_value = max elevation_gain_m of any single track
          met = current_value >= badge.requirement_value
        case "streak_days":
          current_value = longest consecutive day streak
          met = current_value >= badge.requirement_value
   c. IF met:
        Create EarnedBadge record:
          badge_id = badge.id
          earned_at = now
          trigger_track_id = trigger_track.id
          progress_value = current_value
        newly_earned.append(badge)
4. RETURN newly_earned
```

**Edge Cases:**
- No tracks exist yet: No badges can be earned (all cumulative values are 0)
- Deleting a track may revoke badge eligibility, but earned badges are never revoked (honor system)
- Multiple badges earned from one track: All are awarded. Notifications stack (shown sequentially with 1-second delay between each).
- Badge requires data from other features (e.g., photos, trips): If those features are not yet used, progress is 0

##### Badge Progress Calculation

**Purpose:** Calculate the user's current progress toward each unearned badge for display on the Badges screen.

**Inputs:**
- badge: Badge record
- aggregate_stats: computed stats from all tracks

**Logic:**

```
1. current_value = evaluate badge requirement against aggregate_stats
   (same logic as badge evaluation, but return current_value instead of boolean)
2. progress_pct = min(100, (current_value / badge.requirement_value) * 100)
3. RETURN { current_value, requirement_value, progress_pct }
```

**Edge Cases:**
- Requirement value is 0: Progress is 100% (should not occur with well-defined badges)
- Current value exceeds requirement: Cap at 100%

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Badge evaluation fails after recording | No badge notification shown. Badges are re-evaluated next time the Badges screen is opened. | Automatic retry on next screen load |
| Badge data is corrupted | Badges screen shows "Could not load badge data" with a "Refresh" button | User taps "Refresh" to re-evaluate all badges from Track data |
| Badge icon asset not found | Placeholder icon shown (generic star) | No action needed |
| Aggregate computation slow (>10,000 tracks) | Badge evaluation runs asynchronously. A loading spinner shows on the Badges screen for 1-2 seconds. | Automatic. Results are cached after computation. |

**Validation Timing:**
- Badge evaluation runs after each track is saved (or deleted)
- Badge progress is computed on demand when the Badges screen is opened
- Cached badge data is invalidated when a track is added, modified, or deleted

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a user has hiked a cumulative 50 km across multiple activities,
   **When** they complete a new hike that pushes total distance past 50 km,
   **Then** a notification appears: "Badge Earned! Distance Wanderer (Bronze) - You hiked 50 km!" and the badge appears in full color on the Badges screen.

2. **Given** the user opens the Badges screen with 5 earned badges and 85 locked badges,
   **When** they browse the badge grid,
   **Then** earned badges are shown in full color with their tier ring (bronze/silver/gold), locked badges are grayscale with progress bars, and the header shows "5 / 90".

3. **Given** a locked badge "Trailblazer (Silver)" requires 50 activities and the user has 35,
   **When** they tap the locked badge,
   **Then** the detail popup shows: requirement "50 activities", current progress "35 / 50", progress bar at 70%, and no earned date.

**Edge Cases:**

4. **Given** a single recording earns 3 badges simultaneously (e.g., distance, elevation, and frequency milestones),
   **When** the recording is saved,
   **Then** all 3 badge notifications appear sequentially with 1-second delays, and all 3 badges are marked as earned on the Badges screen.

5. **Given** the user deletes a track that contributed to a cumulative badge,
   **When** they view the Badges screen,
   **Then** the previously earned badge remains earned (badges are never revoked), but progress toward higher tiers recalculates based on current data.

**Negative Tests:**

6. **Given** no activities have been recorded,
   **When** the user opens the Badges screen,
   **Then** all 90 badges are shown in locked/grayscale state with progress at 0%.
   **And** a motivational message appears: "Start your first adventure to begin earning badges!"

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| evaluates cumulative distance badge - met | total_distance: 51 km, threshold: 50 km | badge earned |
| evaluates cumulative distance badge - not met | total_distance: 49 km, threshold: 50 km | badge not earned |
| evaluates single distance badge | max single track: 25 km, threshold: 20 km | badge earned |
| evaluates activity count badge | total_activities: 10, threshold: 10 | badge earned |
| evaluates variety badge | activity_types: [hike, run], threshold: 2 | badge earned |
| evaluates streak badge - met | consecutive days: 7, threshold: 7 | badge earned |
| evaluates streak badge - not met | consecutive days: 5, threshold: 7 | badge not earned |
| skips already-earned badge | badge already in earned_badges | badge skipped, not re-evaluated |
| progress calculation at 70% | current: 35, requirement: 50 | progress_pct: 70.0 |
| progress caps at 100% | current: 60, requirement: 50 | progress_pct: 100.0 |
| multiple badges from one track | track pushes distance, elevation, and count over thresholds | 3 badges in newly_earned list |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Badge earned on activity completion | 1. Record activities totaling 49 km, 2. Record a 2 km activity | "Distance Wanderer (Bronze)" badge notification appears |
| Badge screen shows correct progress | 1. Record 5 activities, 2. Open Badges screen | "Trailblazer (Bronze)" shows 5/10 (50%) progress |
| Badge survives track deletion | 1. Earn a badge, 2. Delete the trigger track | Badge remains earned on the Badges screen |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Earn first badges as a new user | 1. Record first hike (5 km, 200m gain), 2. See badge notification, 3. Open Badges screen, 4. Browse categories | At least 1 badge earned. Badges screen shows earned badge in color. Progress bars show advancement toward next milestones. |

---

### TR-013: Weather Overlay

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-013 |
| **Feature Name** | Weather Overlay |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a trip planner, I want to see the weather forecast for a trail location and planned date so that I can decide whether to go and what to pack.

**Secondary:**
> As a day hiker, I want to see current weather conditions on the map during my recording so that I can make informed decisions about continuing or turning back.

**Tertiary:**
> As a backpacker, I want to see a multi-day weather forecast for my trip's destination so that I can plan my multi-day itinerary around expected conditions.

#### 3.3 Detailed Description

Weather Overlay adds weather information to the map and trip planning features. The system fetches weather data from a free public weather API (Open-Meteo, which requires no API key and has no usage restrictions for personal use) and displays it as an informational overlay on the map and within trip planning views.

Weather data is displayed in three contexts:

1. **Current conditions on the map:** When the user is viewing the map (during recording or browsing), a small weather widget in the top-left corner shows current temperature, condition icon (sun, clouds, rain, snow, etc.), wind speed, and humidity for the map's center coordinates. The widget updates when the map center changes by more than 10 km.

2. **Trip planning forecast:** When planning a trip (TR-009), each trip day shows a weather forecast for the planned destination. The forecast includes high/low temperature, precipitation probability, condition description, wind speed, and UV index. Multi-day forecasts are fetched for the trip date range (limited to 16 days in the future per Open-Meteo's forecast API).

3. **Trail detail historical weather:** For completed tracks, the system can retrospectively fetch weather data for the track's date and location. This is informational only and is displayed in the Trail Detail screen alongside the track stats.

Weather data is cached locally for 30 minutes (current conditions) or 6 hours (forecasts). No user location data is sent to the weather API beyond the coordinates being queried (latitude, longitude), which are the map center or trail location, not the user's home address. The weather API does not require authentication, so no user account is needed.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-006: Offline Map Tiles - Weather overlay appears on the map view

**External Dependencies:**
- Network connectivity for fetching weather data from Open-Meteo API
- Open-Meteo API availability (https://api.open-meteo.com/v1/forecast)

**Assumed Capabilities:**
- The app can make HTTP GET requests to the Open-Meteo API
- The app can parse JSON weather data responses
- The app can cache weather data locally

#### 3.5 User Interface Requirements

##### Component: Weather Widget (on map view)

**Layout:**
- A semi-transparent card (120px wide, 80px tall) positioned in the top-left corner of the map, below the navigation bar
- Shows: weather condition icon (24x24 px), current temperature (large text, e.g., "18 C"), condition text (small text, e.g., "Partly Cloudy"), wind speed (e.g., "12 km/h"), and humidity (e.g., "65%")
- Tap to expand into a larger card showing a 24-hour mini forecast
- The widget fades to 50% opacity when the user is interacting with the map (panning/zooming) to avoid obstructing the view

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loading | Weather data is being fetched | Widget shows a small spinner and "Loading..." |
| Loaded | Weather data available | Temperature, icon, condition, wind, humidity |
| Offline | No network and no cached data | Widget shows "Weather unavailable - offline" in subdued text |
| Cached | Using cached data (>30 min old) | Normal display with a small "cached" indicator dot |
| Expanded | User tapped the widget | Larger card showing 24-hour hourly forecast with temp and condition icons |

**Interactions:**
- Tap the widget: Expands to show the 24-hour hourly forecast
- Tap outside the expanded widget: Collapses back to the compact view
- Pan the map: Widget fades to 50% opacity during interaction, returns to full opacity after 1 second of inactivity

##### Component: Trip Day Weather Card (in Trip Detail)

**Layout:**
- A weather summary card within each trip day entry on the Trip Detail screen
- Shows: date, condition icon, high/low temperature, precipitation probability, wind speed, UV index
- If the trip date is more than 16 days in the future: "Forecast not yet available (available within 16 days)"
- If the trip date is in the past: shows historical weather data (if cached) or "Historical weather unavailable"

**Interactions:**
- Tap the weather card: Expands to show an hourly breakdown for that day (6 AM - 9 PM, every 3 hours)

#### 3.6 Data Requirements

##### Entity: WeatherCache

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Composite of lat_lon_date | Unique cache entry identifier |
| latitude | float | -90.0 to 90.0 | None | Query latitude (rounded to 2 decimal places) |
| longitude | float | -180.0 to 180.0 | None | Query longitude (rounded to 2 decimal places) |
| date | date | YYYY-MM-DD | None | Date of the forecast (null for current conditions) |
| data_json | string | JSON string, max 10000 chars | None | Raw weather API response data |
| cache_type | enum | One of: current, forecast, historical | None | Type of cached weather data |
| fetched_at | datetime | ISO 8601 | Current timestamp | When the data was fetched |
| expires_at | datetime | ISO 8601 | None | When this cache entry expires |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Indexes:**
- WeatherCache(latitude, longitude, date, cache_type) - lookup for specific location and date
- WeatherCache(expires_at) - cleanup expired entries

**Validation Rules:**
- latitude and longitude are rounded to 2 decimal places before caching (to improve cache hit rate)
- Cache TTL: 30 minutes for current conditions, 6 hours for forecasts, 30 days for historical
- Maximum cache size: 500 entries. LRU eviction when exceeded.

#### 3.7 Business Logic Rules

##### Weather Data Fetching

**Purpose:** Fetch current conditions or forecast data from the Open-Meteo API with caching.

**Inputs:**
- latitude: float - Query latitude
- longitude: float - Query longitude
- query_type: enum - "current", "forecast_daily", "forecast_hourly"
- date: date (optional) - Specific date for forecast queries

**Logic:**

```
1. Round latitude and longitude to 2 decimal places
2. Construct cache key from lat, lon, date, query_type
3. Check WeatherCache for a valid (non-expired) entry:
   a. IF valid cache entry exists:
        RETURN cached data
4. IF device is offline:
     a. Check for expired cache entry:
        IF expired entry exists: RETURN it with a "cached" flag
        ELSE: RETURN null (no data available)
5. Construct API URL:
   a. Base: "https://api.open-meteo.com/v1/forecast"
   b. Parameters:
      - latitude={lat}&longitude={lon}
      - current: current_weather=true&current=temperature_2m,
        relative_humidity_2m,wind_speed_10m,weather_code
      - forecast_daily: daily=temperature_2m_max,temperature_2m_min,
        precipitation_probability_max,weather_code,wind_speed_10m_max,
        uv_index_max&forecast_days=16
      - forecast_hourly: hourly=temperature_2m,weather_code,
        precipitation_probability,wind_speed_10m
      - timezone=auto
6. Send HTTP GET request with timeout of 5 seconds
7. IF request succeeds:
     a. Parse JSON response
     b. Store in WeatherCache with appropriate TTL
     c. RETURN parsed weather data
8. IF request fails:
     a. Check for expired cache entry as fallback
     b. RETURN expired data with "cached" flag, or null if no fallback
```

**Edge Cases:**
- API returns invalid JSON: Log error, return null, do not cache
- API returns error status (4xx, 5xx): Log error, use expired cache if available
- Coordinates in ocean or unpopulated area: API still returns data (nearest grid point)
- Date more than 16 days in the future: Return "forecast not available" message

##### Weather Code to Condition Mapping

**Purpose:** Map Open-Meteo WMO weather codes to human-readable conditions and icons.

**Logic:**

```
WEATHER_CODES = {
  0: { condition: "Clear sky", icon: "sun" },
  1: { condition: "Mainly clear", icon: "sun-cloud" },
  2: { condition: "Partly cloudy", icon: "cloud-sun" },
  3: { condition: "Overcast", icon: "cloud" },
  45: { condition: "Foggy", icon: "fog" },
  48: { condition: "Depositing rime fog", icon: "fog" },
  51: { condition: "Light drizzle", icon: "drizzle" },
  53: { condition: "Moderate drizzle", icon: "drizzle" },
  55: { condition: "Dense drizzle", icon: "drizzle" },
  61: { condition: "Slight rain", icon: "rain" },
  63: { condition: "Moderate rain", icon: "rain" },
  65: { condition: "Heavy rain", icon: "rain-heavy" },
  71: { condition: "Slight snow", icon: "snow" },
  73: { condition: "Moderate snow", icon: "snow" },
  75: { condition: "Heavy snow", icon: "snow-heavy" },
  77: { condition: "Snow grains", icon: "snow" },
  80: { condition: "Slight rain showers", icon: "rain-shower" },
  81: { condition: "Moderate rain showers", icon: "rain-shower" },
  82: { condition: "Violent rain showers", icon: "rain-heavy" },
  85: { condition: "Slight snow showers", icon: "snow-shower" },
  86: { condition: "Heavy snow showers", icon: "snow-heavy" },
  95: { condition: "Thunderstorm", icon: "thunderstorm" },
  96: { condition: "Thunderstorm with slight hail", icon: "thunderstorm" },
  99: { condition: "Thunderstorm with heavy hail", icon: "thunderstorm" }
}

LOOKUP: IF code not in map, use { condition: "Unknown", icon: "cloud" }
```

##### Temperature Unit Conversion

**Purpose:** Convert temperature between Celsius and Fahrenheit based on user preference.

**Inputs:**
- temp_c: float - Temperature in Celsius
- user_unit: enum - "celsius" or "fahrenheit"

**Logic:**

```
1. IF user_unit = "fahrenheit":
     temp_display = round(temp_c * 9/5 + 32)
     unit_label = "F"
2. ELSE:
     temp_display = round(temp_c)
     unit_label = "C"
3. RETURN { temp_display, unit_label }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Weather API unreachable | Widget shows "Weather unavailable" or uses expired cache with a "cached" indicator | Retry on next interval or when user taps the widget |
| API rate limited | Same as unreachable. Open-Meteo has generous limits (10,000 requests/day) so this is unlikely for personal use. | Automatic retry after cache interval |
| Invalid coordinates (e.g., 0,0 in Atlantic Ocean) | Weather data for that grid point is shown. May not be meaningful. | No action needed. User moves the map to a meaningful location. |
| Forecast date too far in future (>16 days) | Trip day weather card shows: "Forecast available within 16 days of the date" | User checks back closer to the trip date |
| Network timeout during fetch | Widget shows cached data or "Weather unavailable". No disruptive error. | Automatic retry on next access |

**Validation Timing:**
- Current conditions are fetched when the map view loads or when the map center changes by more than 10 km
- Forecast data is fetched when a Trip Detail screen loads (for each trip day)
- Cache expiry is checked on every data access

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is viewing the map with network connectivity,
   **When** the map centers on a location,
   **Then** the weather widget shows the current temperature, condition icon, wind speed, and humidity for that location.

2. **Given** a trip is planned for a date 5 days from now,
   **When** the user views the Trip Detail screen,
   **Then** each trip day shows a weather forecast with high/low temperature, precipitation probability, and condition icon.

3. **Given** the user taps the weather widget on the map,
   **When** the widget expands,
   **Then** a 24-hour hourly forecast is displayed with temperatures and condition icons for each hour.

**Edge Cases:**

4. **Given** the device is offline and weather data was cached 2 hours ago,
   **When** the user views the map,
   **Then** the weather widget shows the cached data with a "cached" indicator, and no error is displayed.

5. **Given** a trip is planned for a date 20 days from now,
   **When** the user views the Trip Detail screen,
   **Then** the weather card shows "Forecast available within 16 days of the date" instead of a forecast.

**Negative Tests:**

6. **Given** the device is offline and no cached weather data exists for the current location,
   **When** the user views the map,
   **Then** the weather widget shows "Weather unavailable - offline" in subdued text.
   **And** the map and recording features are fully functional without weather data.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| weather code maps correctly | code: 61 | condition: "Slight rain", icon: "rain" |
| unknown weather code maps to default | code: 999 | condition: "Unknown", icon: "cloud" |
| temperature conversion to Fahrenheit | temp_c: 20, unit: fahrenheit | temp_display: 68, unit_label: "F" |
| temperature conversion stays Celsius | temp_c: 20, unit: celsius | temp_display: 20, unit_label: "C" |
| cache key rounds coordinates | lat: 37.7749, lon: -122.4194 | cache key uses lat: 37.77, lon: -122.42 |
| cache hit returns cached data | valid cache entry exists | returns cached data, no API call |
| cache miss triggers API call | no cache entry | API call made |
| expired cache used as fallback offline | expired entry exists, device offline | returns expired data with cached flag |
| forecast unavailable for >16 days | date: 20 days from now | returns "not available" message |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Weather loads on map view | 1. Open map with network, 2. View weather widget | Widget shows current conditions for map center |
| Weather caching works | 1. Load weather for location, 2. Go offline, 3. Return to same location | Cached weather displayed with indicator |
| Trip forecast integration | 1. Create trip starting in 3 days, 2. Open Trip Detail | Each day shows forecast from Open-Meteo |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Check weather before hiking | 1. Open map at planned trail location, 2. View current weather widget, 3. Tap to expand hourly forecast, 4. Decide to go based on conditions | Weather widget shows current and hourly forecast. User makes an informed decision. Map and recording remain fully functional. |

---

### TR-014: Wrong-Turn Alerts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-014 |
| **Feature Name** | Wrong-Turn Alerts |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a backpacker, I want to be alerted when I stray too far from my planned route so that I can correct my course before getting seriously lost.

**Secondary:**
> As a day hiker following a GPX route from a friend, I want my phone to vibrate when I go off-trail so that I notice the deviation even when my phone is in my pocket.

**Tertiary:**
> As a trip planner, I want to configure how far off-route I can go before being alerted so that I can adjust sensitivity for different terrain (wide open meadows vs. dense forest).

#### 3.3 Detailed Description

Wrong-Turn Alerts monitors the user's current GPS position during an active recording and compares it against a planned route or imported GPX track. When the user's position deviates beyond a configurable threshold distance from the planned route, the system triggers an alert via sound, vibration, and on-screen notification.

The feature works by computing the perpendicular distance from the user's current position to the nearest segment of the reference route. If this distance exceeds the alert threshold for a sustained period (not just a momentary GPS glitch), the system triggers the alert.

Users set up wrong-turn alerts by selecting a reference route before or during recording. The reference route can be:
1. A planned route from a trip day (TR-009)
2. An imported GPX track (TR-007)
3. A previously recorded track (from TR-002)

The alert threshold is configurable: 50m (tight - for well-marked trails), 100m (default), 200m (loose - for open terrain), or custom (user enters a distance). The system requires the user to be off-route for at least 30 seconds before triggering an alert, to avoid false positives from momentary GPS drift.

When an alert triggers, the system provides:
1. A haptic vibration pattern (three short pulses)
2. An audio alert tone (configurable, default: three ascending beeps)
3. An on-screen banner with the deviation distance and a compass direction back toward the route
4. On the map, a red dashed line from the user's current position to the nearest point on the reference route

The user can dismiss the alert, which mutes it until they deviate again after returning to the route. The system also shows a "back on track" notification when the user returns within the threshold distance.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Active recording provides the current GPS position
- TR-009: Trip Planning - Planned routes serve as reference routes

**External Dependencies:**
- Device haptics for vibration alerts
- Device audio for alert tones

**Assumed Capabilities:**
- The app can compute point-to-line-segment distances
- The app can trigger haptic and audio feedback
- The app can run deviation checks in real time during background recording

#### 3.5 User Interface Requirements

##### Component: Route Guidance Setup (on recording screen, pre-recording)

**Layout:**
- Below the activity type selector on the pre-recording screen, a "Follow a Route" option
- When enabled, a route source picker appears with three options: "From Trip" (lists trip days with planned routes), "From GPX" (opens file picker), "From History" (lists past tracks)
- Below the route source: an alert threshold selector with options 50m, 100m (default), 200m, and Custom
- A toggle: "Audio Alert" (default: ON)
- A toggle: "Vibration Alert" (default: ON)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Disabled | "Follow a Route" is OFF | Compact toggle with label only |
| Setup | Enabled, no route selected | Expanded form with route source options |
| Route Selected | Reference route loaded | Map shows the reference route as a thin dashed blue polyline. Stats show reference route distance and elevation. |
| Active - On Route | Recording, user within threshold | Recording screen shows a small green "On Route" badge. Reference route is visible on map. |
| Active - Off Route | User exceeds threshold for >30s | Red banner: "Off Route - [X]m from trail. Head [direction] to return." Three-pulse vibration. Audio alert plays. Red dashed line to nearest route point. |
| Back on Track | User returns within threshold after alert | Green banner: "Back on track!" (auto-dismisses after 3 seconds). Badge returns to green "On Route". |

**Interactions:**
- Toggle "Follow a Route" ON: Expands the route setup form
- Select route source: Choose a planned route, GPX file, or historical track as reference
- Adjust threshold: Select 50m, 100m, 200m, or enter custom distance
- Dismiss off-route alert: Mutes the alert until the user returns to route and deviates again
- Tap "Stop Guidance": Disables wrong-turn alerts during recording

**Transitions/Animations:**
- Off-route banner slides down from the top with a red flash (200ms)
- Red dashed line draws from user position to route point (300ms)
- "Back on track" banner slides in from the top with a green highlight, auto-dismisses after 3 seconds with a fade-out

#### 3.6 Data Requirements

This feature does not introduce new persistent entities. It operates on in-memory state during an active recording, using reference route data from PlannedWaypoint (TR-009), imported GPX TrackPoints (TR-007), or historical Track TrackPoints (TR-001).

**In-Memory State:**

| Field | Type | Description |
|-------|------|-------------|
| reference_route_points | array of {lat, lon} | The reference route coordinates |
| alert_threshold_m | float | Distance threshold in meters (50, 100, 200, or custom) |
| is_off_route | boolean | Whether the user is currently off-route |
| off_route_since | datetime or null | Timestamp when deviation was first detected |
| alert_triggered | boolean | Whether an alert has been shown for the current deviation |
| audio_enabled | boolean | Whether audio alerts are active |
| vibration_enabled | boolean | Whether vibration alerts are active |

#### 3.7 Business Logic Rules

##### Point-to-Route Distance Calculation

**Purpose:** Calculate the minimum distance from the user's current position to the nearest segment of the reference route.

**Inputs:**
- user_lat: float - User's current latitude
- user_lon: float - User's current longitude
- route_points: array of {lat, lon} - Reference route points in order

**Logic:**

```
1. IF route_points.length < 2:
     RETURN infinity (no valid route to compare against)
2. min_distance = infinity
3. nearest_point = null
4. FOR i = 0 to route_points.length - 2:
     segment_start = route_points[i]
     segment_end = route_points[i + 1]
     d = point_to_segment_distance(user_lat, user_lon,
         segment_start.lat, segment_start.lon,
         segment_end.lat, segment_end.lon)
     IF d < min_distance:
       min_distance = d
       nearest_point = closest point on this segment
5. RETURN { distance_m: min_distance, nearest_point: nearest_point }
```

##### Point-to-Segment Distance (Geodesic)

**Purpose:** Calculate the perpendicular distance from a point to a line segment on the Earth's surface.

**Inputs:**
- p_lat, p_lon: float - The query point
- a_lat, a_lon: float - Segment start point
- b_lat, b_lon: float - Segment end point

**Logic:**

```
1. Convert all coordinates to a local Cartesian approximation:
   (Use flat-Earth approximation for short distances, accurate within ~0.1% for <10km)
   cos_lat = cos(a_lat * pi / 180)
   ax = 0, ay = 0 (segment start as origin)
   bx = (b_lon - a_lon) * cos_lat * 111320
   by = (b_lat - a_lat) * 111320
   px = (p_lon - a_lon) * cos_lat * 111320
   py = (p_lat - a_lat) * 111320
2. Compute projection of P onto line AB:
   ab_x = bx - ax, ab_y = by - ay
   ap_x = px - ax, ap_y = py - ay
   ab_sq = ab_x^2 + ab_y^2
   IF ab_sq = 0:
     RETURN haversine(p_lat, p_lon, a_lat, a_lon)
   t = (ap_x * ab_x + ap_y * ab_y) / ab_sq
   t = clamp(t, 0, 1)
3. Nearest point on segment:
   nearest_x = ax + t * ab_x
   nearest_y = ay + t * ab_y
4. Distance = sqrt((px - nearest_x)^2 + (py - nearest_y)^2)
5. RETURN distance in meters
```

**Edge Cases:**
- Segment start equals segment end (zero-length segment): Return distance from point to the single coordinate
- Point is exactly on the segment: Return 0.0
- Point is beyond segment endpoints: Projection is clamped, so nearest point is the closer endpoint

##### Deviation Detection State Machine

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| On Route | Distance > threshold | Deviation Detected | Set off_route_since = now. Start 30-second sustain timer. |
| Deviation Detected | Distance returns within threshold before 30s | On Route | Clear off_route_since. Reset timer. |
| Deviation Detected | 30 seconds elapsed still off-route | Off Route (Alert) | Trigger vibration (3 pulses). Play audio alert. Show off-route banner with distance and direction. Draw red dashed line on map. |
| Off Route (Alert) | User dismisses alert | Off Route (Muted) | Mute audio/vibration. Banner changes to a smaller persistent indicator. |
| Off Route (Alert) | Distance returns within threshold | On Route | Show "Back on track!" banner. Clear red line. Reset all deviation state. |
| Off Route (Muted) | Distance returns within threshold | On Route | Show "Back on track!" banner. Reset all deviation state. |
| Off Route (Muted) | Distance increases further (>2x threshold) | Off Route (Alert) | Re-trigger alert (unmute). User is getting more lost. |

##### Direction Back to Route

**Purpose:** Calculate the compass direction from the user's position to the nearest point on the reference route.

**Inputs:**
- user_lat, user_lon: float - User's current position
- nearest_lat, nearest_lon: float - Nearest point on the route

**Logic:**

```
1. dlon = nearest_lon - user_lon
2. y = sin(dlon * pi/180) * cos(nearest_lat * pi/180)
3. x = cos(user_lat * pi/180) * sin(nearest_lat * pi/180) -
       sin(user_lat * pi/180) * cos(nearest_lat * pi/180) * cos(dlon * pi/180)
4. bearing_rad = atan2(y, x)
5. bearing_deg = (bearing_rad * 180/pi + 360) % 360
6. Map bearing to cardinal direction:
   0-22.5 or 337.5-360: "N"
   22.5-67.5: "NE"
   67.5-112.5: "E"
   112.5-157.5: "SE"
   157.5-202.5: "S"
   202.5-247.5: "SW"
   247.5-292.5: "W"
   292.5-337.5: "NW"
7. RETURN { bearing_deg, cardinal_direction }
```

**Edge Cases:**
- User is at the same position as the nearest route point: Return 0 degrees / "N" (arbitrary)
- Points near the poles: Bearing calculation may be less intuitive but mathematically correct

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Reference route has fewer than 2 points | Alert: "Selected route does not have enough waypoints for navigation guidance." Guidance is disabled. | User selects a different reference route |
| GPS accuracy too poor for reliable deviation detection (>50m accuracy) | Deviation detection pauses. Small note on recording screen: "GPS accuracy too low for route guidance." | Automatic resume when GPS accuracy improves |
| Reference route file is corrupted | Alert: "Could not load reference route." Guidance is disabled, recording continues normally. | User selects a different route |
| Audio playback fails | Vibration alert still triggers. No audio error shown. | Vibration serves as fallback |
| Vibration unavailable (device limitation) | Audio alert still triggers. No vibration error shown. | Audio serves as fallback |

**Validation Timing:**
- Reference route validity checked when selected (before recording starts)
- GPS accuracy checked on each location update during recording
- Deviation distance computed on each high-confidence GPS point received

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has selected a planned route as reference and started recording,
   **When** they are walking along the route within 100m threshold,
   **Then** the recording screen shows a green "On Route" badge and the reference route is visible as a blue dashed polyline on the map.

2. **Given** the user has been off-route by 150m for more than 30 seconds,
   **When** the sustained deviation is confirmed,
   **Then** the phone vibrates (3 pulses), an audio alert plays, a red banner shows "Off Route - 150m from trail. Head SE to return.", and a red dashed line draws from the user's position to the nearest route point.

3. **Given** the user is off-route and follows the direction indicator back,
   **When** they return within 100m of the reference route,
   **Then** a green "Back on track!" banner appears, the red line disappears, and the badge returns to green "On Route."

**Edge Cases:**

4. **Given** GPS accuracy is worse than 50m,
   **When** deviation detection would normally trigger,
   **Then** the system pauses deviation checks and shows "GPS accuracy too low for route guidance" instead of a false positive alert.

5. **Given** the user is off-route and dismisses the alert,
   **When** they continue walking further off-route (>2x the threshold),
   **Then** the alert re-triggers (unmuted) to warn of increasing deviation.

**Negative Tests:**

6. **Given** the user momentarily drifts 120m from the route due to a GPS glitch for 5 seconds,
   **When** the position returns within threshold within 30 seconds,
   **Then** no alert is triggered (the 30-second sustain requirement prevents false positives).
   **And** no vibration or audio plays.

7. **Given** the selected reference route has only 1 waypoint,
   **When** the user attempts to start route guidance,
   **Then** an alert shows "Selected route does not have enough waypoints for navigation guidance."
   **And** guidance is disabled. Recording can still start without guidance.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| point on segment returns 0 | point at midpoint of segment | distance: 0.0m |
| point perpendicular to segment | point 100m perpendicular to segment midpoint | distance: approximately 100m |
| point beyond segment endpoint | point past segment end, 50m from endpoint | distance: approximately 50m to nearest endpoint |
| point far from short segment | point 500m from a 10m segment | distance: approximately 500m |
| min distance finds nearest segment | 5-segment route, point nearest to segment 3 | returns distance to segment 3 |
| bearing calculation N | user south of route point, same longitude | cardinal: "N" |
| bearing calculation SW | user NE of route point | cardinal: "SW" |
| bearing at same point | user at route point | bearing: 0, cardinal: "N" |
| deviation not triggered before 30s | off-route for 20s | is_off_route: false |
| deviation triggered after 30s | off-route for 31s | is_off_route: true, alert_triggered: true |
| deviation cleared when back on route | returns within threshold at 25s | is_off_route: false, no alert |
| re-alert at 2x threshold | dismissed alert, distance now 2x threshold | alert re-triggered |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Off-route alert lifecycle | 1. Select route, start recording, 2. Simulate GPS going 150m off-route, 3. Wait 30s, 4. Verify alert | Vibration, audio, banner, and red line all trigger after 30s sustain |
| Back on track notification | 1. Trigger off-route alert, 2. Simulate GPS returning to within 100m of route | "Back on track!" banner appears, red line disappears |
| Dismissal and re-alert | 1. Trigger alert, 2. Dismiss, 3. Continue 250m off-route | Alert re-triggers at 2x threshold |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Follow a planned route with one wrong turn | 1. Plan a route with 5 waypoints, 2. Start recording with route guidance at 100m threshold, 3. Walk along route correctly, 4. Take a wrong turn (>100m off-route for >30s), 5. Get alerted, 6. Return to correct route | Alert triggered at the wrong turn. "Back on track" shown on return. Recording captures the entire route including the detour. |

---

### TR-015: Waypoint Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-015 |
| **Feature Name** | Waypoint Management |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a backpacker, I want to drop labeled waypoints along my route during a hike so that I can mark water sources, campsites, trail junctions, and other notable locations for future reference.

**Secondary:**
> As a day hiker, I want to add waypoints to a completed track after the fact so that I can annotate interesting spots I forgot to mark during the hike.

**Tertiary:**
> As a trip planner, I want to browse all my saved waypoints on a map so that I can find previously visited locations when planning new trips.

#### 3.3 Detailed Description

Waypoint Management allows users to create, edit, and organize named location markers (waypoints) during or after an outdoor activity. Waypoints serve as annotated pins on the route map, marking points of interest such as water sources, scenic viewpoints, rest stops, trail junctions, campsites, parking areas, and hazards.

During an active recording, the user taps the waypoint button on the control bar to drop a pin at their current GPS position. A quick-entry form appears allowing the user to enter a name (required, max 100 characters), select a category from a predefined list, and optionally add notes (max 500 characters). Common categories include: Water Source, Campsite, Viewpoint, Trail Junction, Parking, Hazard, Rest Stop, Summit, and Custom.

After saving an activity, users can add waypoints to a completed track by long-pressing on the route map at the desired location. The same quick-entry form appears, positioned at the map-tapped coordinates.

All waypoints are displayed on the route map as category-specific icons (blue droplet for water, tent for campsite, mountain for summit, etc.). Tapping a waypoint marker shows a popup with the name, category, notes, and coordinates. Users can edit or delete waypoints from this popup.

A dedicated Waypoints screen (accessible from the main navigation) shows all waypoints across all tracks in a searchable, filterable list. Users can filter by category, search by name, or view all waypoints plotted on a single map. This aggregate view is valuable for trip planning, allowing users to find previously discovered water sources or campsites in an area.

Waypoints are exported as `<wpt>` elements in GPX exports (TR-007) and included as markers on shared route maps.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Provides the active recording context for dropping waypoints at the current position
- TR-006: Offline Map Tiles - Waypoints are displayed on the map

**External Dependencies:**
- None (all data is local)

**Assumed Capabilities:**
- The app can render custom marker icons on the map
- The app can handle map tap events to determine coordinates

#### 3.5 User Interface Requirements

##### Component: Waypoint Quick-Entry (during recording or on Trail Detail)

**Layout:**
- A compact bottom sheet that appears when the user taps the waypoint button (during recording) or long-presses the route map (on Trail Detail)
- Fields: Name (text input, required, max 100 chars), Category (horizontal scrollable chip selector with icons), Notes (text area, optional, max 500 chars)
- Two buttons: "Save" (primary) and "Cancel" (secondary)
- GPS coordinates are shown in small text below the name field (auto-filled, not editable during recording; editable for after-the-fact waypoints)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Entry | Quick-entry form is open | Bottom sheet with name, category, and notes fields |
| Saving | Waypoint is being saved | Brief spinner (under 300ms) |
| Saved | Waypoint stored successfully | Bottom sheet dismisses. Waypoint marker appears on map with a pop-in animation. Toast: "Waypoint saved" |
| Error | Save failed | Alert: "Could not save waypoint. Please try again." |

**Interactions:**
- Enter name: Required field, inline validation on save
- Select category: Tap a chip to select. Only one category can be active.
- Enter notes: Optional free-text area
- Tap "Save": Validates name is not empty, saves waypoint, dismisses sheet, places marker on map
- Tap "Cancel": Dismisses the sheet without saving

##### Screen: Waypoints List

**Layout:**
- Top navigation bar with title "Waypoints" and a map/list toggle button
- A search bar below the navigation bar for filtering by name
- A horizontal scrollable row of category filter chips: All, Water Source, Campsite, Viewpoint, Trail Junction, Parking, Hazard, Rest Stop, Summit, Custom
- List view: vertically scrollable list of waypoint cards, each showing: category icon, name (bold), notes preview (truncated to 1 line), track name (small text), date, and coordinates
- Map view: all waypoints plotted on a single map with category-specific icons. Tapping a marker shows the same popup as on the Trail Detail map.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No waypoints saved | Illustration with "No waypoints saved yet. Drop pins during your next adventure!" |
| Populated - List | One or more waypoints, list view | Scrollable list of waypoint cards |
| Populated - Map | One or more waypoints, map view | Map with all waypoints as markers |
| Filtered - No Results | Search or filter active, no matches | "No matching waypoints" with a "Clear Filters" button |

**Interactions:**
- Tap a waypoint card (list view): Navigates to the Trail Detail screen for the associated track, map centered on the waypoint
- Tap a waypoint marker (map view): Shows popup with name, category, notes, track, and date. Popup has "Edit" and "Delete" buttons.
- Swipe left on a card (list view): Reveals "Delete" action
- Toggle list/map: Switches between list and map views
- Tap a category chip: Filters to that category
- Type in search bar: Filters by waypoint name (case-insensitive substring match)

#### 3.6 Data Requirements

##### Entity: Waypoint

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| track_id | string | Foreign key to Track.id, nullable | null | The track this waypoint is associated with (null for standalone waypoints) |
| name | string | Required, max 100 chars, not empty after trimming | None | Waypoint name (e.g., "Creek Crossing", "Camp 2") |
| category | enum | One of: water_source, campsite, viewpoint, trail_junction, parking, hazard, rest_stop, summit, custom | custom | Waypoint category |
| latitude | float | -90.0 to 90.0, required | None | WGS84 latitude |
| longitude | float | -180.0 to 180.0, required | None | WGS84 longitude |
| elevation_m | float | Nullable | null | Elevation at this waypoint |
| notes | string | Optional, max 500 chars | null | Free-text notes about this location |
| distance_from_start_m | float | Min: 0.0, nullable | null | Distance along the track where this waypoint is located |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- Track has many Waypoints (one-to-many via track_id)
- Waypoints with null track_id are standalone waypoints (not tied to a specific track)

**Indexes:**
- Waypoint(track_id) - list waypoints for a specific track
- Waypoint(category) - filter by category
- Waypoint(name) - search by name

**Validation Rules:**
- name must not be empty after trimming whitespace
- latitude must be between -90.0 and 90.0
- longitude must be between -180.0 and 180.0
- A Track may have a maximum of 500 waypoints

**Example Data:**

```
Waypoint:
{
  "id": "wp-001",
  "track_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Creek Crossing",
  "category": "water_source",
  "latitude": 37.8932,
  "longitude": -122.5698,
  "elevation_m": 78.5,
  "notes": "Seasonal creek, flowing in March. Good for refill.",
  "distance_from_start_m": 2450.0,
  "created_at": "2026-03-06T09:15:00Z",
  "updated_at": "2026-03-06T09:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Waypoint Category Icon Mapping

**Purpose:** Map waypoint categories to display icons for map markers and list items.

**Logic:**

```
CATEGORY_ICONS = {
  "water_source": { icon: "droplet", color: "#4A90D9" },
  "campsite": { icon: "tent", color: "#6B8E23" },
  "viewpoint": { icon: "eye", color: "#FF8C00" },
  "trail_junction": { icon: "signpost", color: "#808080" },
  "parking": { icon: "car", color: "#4169E1" },
  "hazard": { icon: "warning-triangle", color: "#DC143C" },
  "rest_stop": { icon: "bench", color: "#8B4513" },
  "summit": { icon: "mountain-peak", color: "#2E8B57" },
  "custom": { icon: "pin", color: "#9370DB" }
}
```

##### Waypoint Distance Along Route

**Purpose:** Compute the distance from the start of a track to the waypoint's position along the route (same algorithm as TR-008 Photo distance calculation).

**Inputs:**
- waypoint_lat, waypoint_lon: float
- track_points: array of TrackPoint ordered by timestamp

**Logic:**
Same as the "Distance Along Route Calculation" defined in TR-008 section 3.7.

**Edge Cases:**
- Waypoint placed off the route (>200m from nearest point): Assign to nearest point on route
- No track points: distance_from_start_m = 0.0

##### Waypoint Search and Filter

**Purpose:** Filter and search waypoints across all tracks.

**Inputs:**
- search_query: string (optional)
- category_filter: enum or null
- all_waypoints: array of Waypoint

**Logic:**

```
1. Start with all_waypoints
2. IF category_filter is not null:
     Filter WHERE category = category_filter
3. IF search_query is not null and not empty:
     Filter WHERE name contains search_query (case-insensitive substring)
4. Sort by created_at DESC (most recent first)
5. RETURN filtered list
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty waypoint name | Inline validation below name field: "Waypoint name is required" | User enters a name |
| Waypoint save fails | Alert: "Could not save waypoint. Please try again." | User retries |
| 500 waypoint limit per track reached | Alert: "Maximum of 500 waypoints per activity." | User deletes existing waypoints |
| Waypoint delete fails | Toast: "Could not delete waypoint." | User retries |
| Map tap produces invalid coordinates (off-screen edge case) | No waypoint form appears. Map handles the gesture as a pan instead. | User taps directly on the route |

**Validation Timing:**
- Name validation on save (not on each keystroke)
- Coordinate validation on creation
- Waypoint count limit checked before opening the quick-entry form

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a recording is in progress,
   **When** the user taps the waypoint button, enters "Creek Crossing", selects "Water Source", adds a note, and saves,
   **Then** a blue droplet marker appears on the map at the current GPS position, and the waypoint is stored with the correct name, category, coordinates, and notes.

2. **Given** the user opens the Waypoints screen and has 20 waypoints across 5 tracks,
   **When** they filter by "Campsite" category,
   **Then** only campsite waypoints are shown, each with the tent icon, name, notes preview, and associated track name.

3. **Given** the user is viewing a completed track on the Trail Detail screen,
   **When** they long-press on the route map at a specific location,
   **Then** the waypoint quick-entry form appears with the tapped coordinates pre-filled, and saving creates a waypoint at that position.

**Edge Cases:**

4. **Given** the user searches for "water" on the Waypoints screen,
   **When** 3 waypoints contain "water" in their name,
   **Then** exactly 3 results appear, regardless of category or track.

5. **Given** the Waypoints screen is in map view,
   **When** the user taps a waypoint marker,
   **Then** a popup shows the waypoint's name, category icon, notes, associated track, and date, with "Edit" and "Delete" buttons.

**Negative Tests:**

6. **Given** the user opens the waypoint quick-entry and leaves the name field empty,
   **When** they tap "Save",
   **Then** an inline validation message shows "Waypoint name is required."
   **And** the waypoint is not saved.

7. **Given** a track already has 500 waypoints,
   **When** the user taps the waypoint button during recording,
   **Then** an alert shows "Maximum of 500 waypoints per activity."
   **And** the quick-entry form does not open.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| category icon mapping for water_source | category: "water_source" | icon: "droplet", color: "#4A90D9" |
| category icon mapping for unknown defaults | category: "nonexistent" | falls back to custom icon |
| search filters by name substring | query: "creek", waypoints: ["Creek Crossing", "Summit Peak", "Dry Creek"] | 2 results: "Creek Crossing", "Dry Creek" |
| search is case-insensitive | query: "CREEK", waypoints: ["Creek Crossing"] | 1 result |
| category filter works | category: "campsite", waypoints with mixed categories | only campsite waypoints returned |
| empty name rejected | name: "   " (whitespace only) | validation error |
| valid name accepted | name: "Camp 1" | validation passes |
| waypoint count limit at 500 | track with 500 waypoints, attempt to add | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Drop waypoint during recording | 1. Start recording, 2. Walk 1km, 3. Drop waypoint "Water Source", 4. Continue recording | Waypoint marker appears on map. Waypoint saved with correct coordinates and distance_from_start. |
| Add waypoint to completed track | 1. View completed track, 2. Long-press on route, 3. Enter name and save | Waypoint appears on trail detail map at the pressed location |
| GPX export includes waypoints | 1. Record track with 3 waypoints, 2. Export as GPX | GPX file contains 3 `<wpt>` elements with correct coordinates and names |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Mark points of interest on a hike | 1. Start recording, 2. Drop 4 waypoints (water source, viewpoint, hazard, campsite), 3. Finish recording, 4. View Trail Detail, 5. Open Waypoints screen | Trail Detail shows 4 markers with category-specific icons on the route. Waypoints screen lists all 4 with correct categories. Map view plots all 4 on the aggregate map. |

---

### TR-016: Activity Type Support

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-016 |
| **Feature Name** | Activity Type Support |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a trail runner, I want to select "Run" as my activity type before recording so that my stats are categorized correctly and I can filter my run history separately from hikes.

**Secondary:**
> As a weekend explorer who sometimes hikes and sometimes cycles, I want to see type-specific stats (pace for hikes, speed for bikes) so that each activity type shows the metrics that matter most.

**Tertiary:**
> As a user who occasionally takes walks in the park, I want "Walk" as an option so that casual walks are not mixed in with serious hikes in my statistics.

#### 3.3 Detailed Description

Activity Type Support defines the set of outdoor activity types that MyTrails tracks and customizes the recording experience, statistics display, and analytics for each type. The system supports five activity types at launch: Hike, Run, Bike, Walk, and Other.

Each activity type has type-specific display preferences. Hikes and walks prioritize pace (minutes per kilometer) as the primary speed metric, while runs show both pace and speed. Bike activities prioritize speed (km/h) over pace. The recording screen stats panel adapts based on the selected type, showing the most relevant metrics.

Activity type selection occurs before recording starts. On the pre-recording screen, a segmented control or selector presents all five types with distinct icons and colors. The last-used activity type is remembered as the default for the next recording (persisted in user preferences).

Activity types affect several downstream features:
- Trail History (TR-002): Filterable by activity type
- Stats Dashboard (TR-005): Breakdown by type, type-specific personal records
- Difficulty Rating (TR-010): Thresholds could theoretically differ by type (currently uniform)
- Achievement Badges (TR-012): Variety badges require multiple types
- GPX Export (TR-007): Activity type is written to the `<type>` element

The system does not allow creating custom activity types in v1 (to keep the data model simple), but the "Other" type with an optional label field serves as a catch-all.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Activity type is selected before recording and stored on the Track entity

**External Dependencies:**
- None

**Assumed Capabilities:**
- The app can persist a user preference for the last-used activity type

#### 3.5 User Interface Requirements

##### Component: Activity Type Selector (on pre-recording screen)

**Layout:**
- A horizontal row of 5 selectable buttons, evenly spaced across the screen width
- Each button shows: an icon (top), type name (bottom), with a colored background highlight on the selected type
- Type definitions:

| Type | Icon | Color | Primary Speed Metric |
|------|------|-------|---------------------|
| Hike | Boot/shoe | #6B8E23 (olive green) | Pace (min/km) |
| Run | Running figure | #DC143C (crimson) | Pace (min/km) + Speed (km/h) |
| Bike | Bicycle | #4169E1 (royal blue) | Speed (km/h) |
| Walk | Walking figure | #FF8C00 (dark orange) | Pace (min/km) |
| Other | Compass/star | #808080 (gray) | Speed (km/h) |

- When "Other" is selected, an optional text field appears: "Activity label (optional)" for the user to describe the activity (e.g., "Snowshoe", "Kayak")
- The selector remembers the last-used type and pre-selects it on next launch

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | First launch, no history | "Hike" pre-selected |
| Remembered | User has previously recorded | Last-used type pre-selected |
| Other Selected | "Other" is active | Additional text field for activity label appears below the selector |

**Interactions:**
- Tap a type button: Selects that type, deselects others. Color highlight animates to the tapped button (150ms slide).
- Tap "Other": Selects Other and reveals the activity label text field
- Selection persists: The selected type is saved to user preferences for next session

##### Component: Type-Specific Stats Panel (on recording screen)

**Layout:**
- The 2x2 stats grid on the recording screen adapts based on activity type:

| Activity Type | Top-Left | Top-Right | Bottom-Left | Bottom-Right |
|--------------|----------|-----------|-------------|--------------|
| Hike | Elapsed Time | Distance | Elevation Gain | Pace (min/km) |
| Run | Elapsed Time | Distance | Pace (min/km) | Speed (km/h) |
| Bike | Elapsed Time | Distance | Speed (km/h) | Elevation Gain |
| Walk | Elapsed Time | Distance | Elevation Gain | Pace (min/km) |
| Other | Elapsed Time | Distance | Speed (km/h) | Elevation Gain |

**Interactions:**
- Long-press any stat cell: Shows a popup to swap that cell's metric with an alternate (advanced customization)

#### 3.6 Data Requirements

This feature uses the `activity_type` field already defined on the Track entity in TR-001 (enum: hike, run, bike, walk, other).

**New Field on Track:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| activity_label | string | Optional, max 50 chars | null | Custom label for "Other" activity type (e.g., "Snowshoe") |

**User Preference:**

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| last_activity_type | enum | hike | The most recently used activity type, for pre-selection |

#### 3.7 Business Logic Rules

##### Type-Specific Metric Display

**Purpose:** Determine which metrics to display in the recording stats panel based on activity type.

**Inputs:**
- activity_type: enum - The selected activity type

**Logic:**

```
1. SWITCH activity_type:
   case "hike":
     primary_speed = "pace" (seconds per km, displayed as MM:SS/km)
     stats_layout = [time, distance, elevation_gain, pace]
   case "run":
     primary_speed = "pace" (seconds per km)
     stats_layout = [time, distance, pace, speed]
   case "bike":
     primary_speed = "speed" (km/h)
     stats_layout = [time, distance, speed, elevation_gain]
   case "walk":
     primary_speed = "pace" (seconds per km)
     stats_layout = [time, distance, elevation_gain, pace]
   case "other":
     primary_speed = "speed" (km/h)
     stats_layout = [time, distance, speed, elevation_gain]
2. RETURN { primary_speed, stats_layout }
```

##### Speed Display Formatting

**Purpose:** Format speed values according to the metric type (pace vs. speed).

**Inputs:**
- speed_m_per_s: float - Speed in meters per second
- metric_type: enum - "pace" or "speed"
- unit_system: enum - "metric" or "imperial"

**Logic:**

```
1. IF speed_m_per_s <= 0 OR speed_m_per_s is null:
     RETURN "N/A"
2. IF metric_type = "pace":
     IF unit_system = "metric":
       pace_s_per_km = 1000 / speed_m_per_s
       minutes = floor(pace_s_per_km / 60)
       seconds = round(pace_s_per_km % 60)
       RETURN format as "{minutes}:{seconds:02d} /km"
     ELSE (imperial):
       pace_s_per_mi = 1609.34 / speed_m_per_s
       minutes = floor(pace_s_per_mi / 60)
       seconds = round(pace_s_per_mi % 60)
       RETURN format as "{minutes}:{seconds:02d} /mi"
3. IF metric_type = "speed":
     IF unit_system = "metric":
       speed_kmh = speed_m_per_s * 3.6
       RETURN format as "{speed_kmh:.1f} km/h"
     ELSE (imperial):
       speed_mph = speed_m_per_s * 2.23694
       RETURN format as "{speed_mph:.1f} mph"
```

**Edge Cases:**
- Zero speed: Display "N/A"
- Very slow pace (>60 min/km): Display as "60:00+ /km" (capped display)
- Very fast speed (>100 km/h): Display normally (user might be in a vehicle, but we do not restrict)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Activity type not selected before recording | Should not occur (default is always pre-selected). If somehow null, default to "hike". | Automatic fallback |
| Last-used type preference corrupted | Default to "hike" | Automatic fallback, preference resets on next selection |
| "Other" label too long (>50 chars) | Inline validation: "Label must be 50 characters or less" | User shortens the label |

**Validation Timing:**
- Activity type is validated before recording starts (always has a valid value due to default)
- "Other" label length is validated on input

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the pre-recording screen for the first time,
   **When** the activity type selector is displayed,
   **Then** "Hike" is pre-selected as the default, and the recording stats panel shows: Elapsed Time, Distance, Elevation Gain, Pace.

2. **Given** the user selects "Bike" before recording,
   **When** they start recording,
   **Then** the stats panel shows: Elapsed Time, Distance, Speed (km/h), Elevation Gain, and the saved Track has activity_type = "bike".

3. **Given** the user recorded a run yesterday and opens the app today,
   **When** the pre-recording screen appears,
   **Then** "Run" is pre-selected (remembered from last session).

**Edge Cases:**

4. **Given** the user selects "Other" and enters "Snowshoe" as the label,
   **When** they record the activity,
   **Then** the Track is saved with activity_type = "other" and activity_label = "Snowshoe". The trail history card shows "Snowshoe" instead of "Other".

5. **Given** the user is viewing the Trail History with mixed activity types,
   **When** they tap the "Bike" filter chip,
   **Then** only bike activities are shown, and summary stats reflect bikes only.

**Negative Tests:**

6. **Given** the user selects "Other" and enters a label of 60 characters,
   **When** they exceed the 50-character limit,
   **Then** input is truncated or an inline validation message shows "Label must be 50 characters or less."
   **And** recording can still start once the label is corrected or left blank.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| hike stats layout | activity_type: "hike" | layout: [time, distance, elevation_gain, pace] |
| run stats layout | activity_type: "run" | layout: [time, distance, pace, speed] |
| bike stats layout | activity_type: "bike" | layout: [time, distance, speed, elevation_gain] |
| pace formatting metric | speed: 1.389 m/s (5 km/h), unit: metric | "12:00 /km" |
| pace formatting imperial | speed: 1.389 m/s, unit: imperial | "19:19 /mi" |
| speed formatting metric | speed: 5.556 m/s (20 km/h), unit: metric | "20.0 km/h" |
| speed formatting imperial | speed: 5.556 m/s, unit: imperial | "12.4 mph" |
| zero speed returns N/A | speed: 0.0 | "N/A" |
| very slow pace caps display | speed: 0.01 m/s | "60:00+ /km" |
| last-used type persistence | select "run", then reopen | "run" pre-selected |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Type-specific recording | 1. Select "Run", 2. Record activity, 3. View Trail Detail | Track saved as "run". Detail screen shows pace as primary speed metric. History card shows running icon. |
| "Other" with custom label | 1. Select "Other", 2. Enter "Kayak", 3. Record, 4. View history | History card shows "Kayak" label. Filter by "Other" includes this track. |
| Type remembered across sessions | 1. Select "Bike", 2. Record, 3. Close app, 4. Reopen | Pre-recording screen shows "Bike" pre-selected |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Multi-type user workflow | 1. Record a hike, 2. Record a run, 3. Record a bike ride, 4. View Trail History, 5. Filter by each type, 6. View Stats breakdown | Each activity saved with correct type. Filters show correct subsets. Stats breakdown shows per-type totals. Pace shown for hike/run, speed shown for bike. |

---

### TR-017: Privacy Zones

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-017 |
| **Feature Name** | Privacy Zones |
| **Priority** | P1 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious user, I want to define zones around my home and workplace so that when I export or share a track, GPS points within those zones are automatically removed.

**Secondary:**
> As a backpacker who starts hikes from my home, I want my exported GPX files to not reveal my home address even though my tracks start from my front door.

**Tertiary:**
> As a parent, I want to set a privacy zone around my child's school so that any shared tracks do not disclose the school's location.

#### 3.3 Detailed Description

Privacy Zones allows users to define circular geographic areas where GPS track data is automatically redacted on export. This is a critical privacy feature because outdoor activities often start and end at the user's home, workplace, or other sensitive locations. Without privacy zones, sharing a GPX file effectively shares your home address.

A privacy zone is defined by a center point (latitude, longitude) and a radius (in meters). Users create zones by placing a pin on the map and setting a radius with a slider (100m to 2000m, default 500m). The zone is visualized as a translucent circle on the map during setup.

Privacy zones affect the following operations:
1. **GPX Export (TR-007):** TrackPoints within any privacy zone are removed from the exported GPX file. This may create gaps in the route at the beginning and end of activities.
2. **Route preview thumbnails (TR-002):** Thumbnails for tracks that start or end within a privacy zone are generated from the portion of the route outside the zone.
3. **Live Location Sharing (TR-011):** Position updates are suppressed while the user is within a privacy zone. The recipient sees no updates until the user exits the zone.

Privacy zones do NOT affect stored track data. The full track with all GPS points is always preserved in local storage. Zones only affect what is shared externally.

Users manage zones through a Privacy Zones settings screen. This screen lists all configured zones with their name, radius, and a map thumbnail. Users can add, edit, or delete zones. The system supports up to 10 privacy zones.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone privacy feature)

**External Dependencies:**
- Map tile data for zone placement (online or offline)

**Assumed Capabilities:**
- The app can render translucent circles on the map
- The app can compute point-in-circle tests for GPS coordinates

#### 3.5 User Interface Requirements

##### Screen: Privacy Zones (Settings)

**Layout:**
- Top navigation bar with title "Privacy Zones" and a "+" (add) button
- A brief explanation at the top: "Privacy zones hide GPS data near sensitive locations when you export or share your activities. Your stored data is not affected."
- Below: a list of configured zones, each showing: zone name, radius (e.g., "500m radius"), a small map thumbnail (100x100 px) showing the zone circle, and an on/off toggle
- An "Add Zone" button at the bottom if fewer than 10 zones exist
- If 10 zones exist, the "+" button is disabled with a note: "Maximum of 10 privacy zones"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No zones configured | Illustration with text: "No privacy zones set. Add zones to protect your home, work, or other locations from appearing in exports." |
| Populated | 1-10 zones configured | List of zone cards with toggle switches |

**Interactions:**
- Tap "+" or "Add Zone": Navigates to the Zone Editor screen
- Tap a zone card: Opens the Zone Editor for that zone
- Toggle a zone on/off: Temporarily enables/disables the zone without deleting it
- Swipe left on a zone: Reveals "Delete" action with confirmation

##### Screen: Zone Editor

**Layout:**
- A full-screen map where the user places the zone center
- A translucent circle overlay shows the zone radius in real time
- Below the map: a name text field (required, max 100 chars, e.g., "Home", "Work"), a radius slider (100m min, 2000m max, default 500m, step 50m), and the current radius value displayed in meters
- "Save" button at the bottom
- For editing an existing zone: "Delete Zone" button at the bottom (red text)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New Zone | Creating a new zone | Map centered on user's current location. Pin is movable. Name field empty. |
| Editing | Modifying an existing zone | Map centered on zone location. Pin at zone center. Name and radius pre-filled. |
| Pin Placed | User has positioned the zone center | Translucent circle visible at the set radius around the pin |

**Interactions:**
- Tap on map: Places or moves the zone center pin
- Drag the pin: Repositions the zone center. Circle overlay follows.
- Adjust radius slider: Circle overlay expands/contracts in real time
- Enter name: Label for the zone (e.g., "Home", "Work", "Kids School")
- Tap "Save": Validates and saves the zone
- Tap "Delete Zone": Confirmation dialog, then deletes

#### 3.6 Data Requirements

##### Entity: PrivacyZone

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| name | string | Required, max 100 chars | None | User label (e.g., "Home") |
| center_lat | float | -90.0 to 90.0, required | None | Center point latitude |
| center_lon | float | -180.0 to 180.0, required | None | Center point longitude |
| radius_m | float | Min: 100, Max: 2000 | 500 | Zone radius in meters |
| is_enabled | boolean | - | true | Whether the zone is currently active |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Indexes:**
- PrivacyZone(is_enabled) - quickly retrieve active zones

**Validation Rules:**
- name must not be empty after trimming
- radius_m must be between 100 and 2000 inclusive
- Maximum 10 PrivacyZone records total
- center_lat must be between -90.0 and 90.0
- center_lon must be between -180.0 and 180.0

**Example Data:**

```
PrivacyZone:
{
  "id": "zone-001",
  "name": "Home",
  "center_lat": 37.7749,
  "center_lon": -122.4194,
  "radius_m": 500,
  "is_enabled": true,
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-01T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Point-in-Privacy-Zone Test

**Purpose:** Determine whether a GPS coordinate falls within any active privacy zone.

**Inputs:**
- point_lat: float - Latitude of the point to test
- point_lon: float - Longitude of the point to test
- zones: array of PrivacyZone - All active (is_enabled = true) privacy zones

**Logic:**

```
1. FOR each zone in zones:
     a. IF zone.is_enabled is false, SKIP
     b. distance = haversine(point_lat, point_lon, zone.center_lat, zone.center_lon)
     c. IF distance <= zone.radius_m:
          RETURN { in_zone: true, zone_id: zone.id, zone_name: zone.name }
2. RETURN { in_zone: false }
```

**Formulas:**
- Uses the Haversine formula from TR-001 to compute distance between the point and zone center
- If distance <= radius_m, the point is within the zone

**Edge Cases:**
- Point exactly on the zone boundary (distance = radius_m): Considered INSIDE the zone
- No active zones: All points return in_zone = false
- Point near the zone center (distance = 0): Inside the zone
- Zones overlapping: Point may be inside multiple zones; first match is returned

##### Privacy Zone Application for Export

**Purpose:** Remove track points that fall within active privacy zones before generating a GPX export.

**Inputs:**
- points: array of TrackPoint
- zones: array of PrivacyZone (active only)

**Logic:**

```
1. IF zones is empty:
     RETURN points (no filtering needed)
2. filtered_points = []
3. FOR each point in points:
     result = point_in_privacy_zone(point.latitude, point.longitude, zones)
     IF result.in_zone is false:
       filtered_points.append(point)
4. RETURN filtered_points
```

**Edge Cases:**
- All points in a privacy zone: Return empty array (warn user before export)
- No points in any zone: Return all points unchanged
- Track passes through a zone mid-route: Creates a gap in the exported track

##### Privacy Zone Application for Live Sharing

**Purpose:** Suppress location updates when the user is within an active privacy zone during live sharing.

**Inputs:**
- current_position: {lat, lon}
- zones: array of PrivacyZone (active only)
- sharing_session: SharingSession

**Logic:**

```
1. result = point_in_privacy_zone(current_position.lat, current_position.lon, zones)
2. IF result.in_zone is true:
     Do NOT send location update to relay server
     RETURN { suppressed: true, reason: "in privacy zone" }
3. ELSE:
     Send location update normally
     RETURN { suppressed: false }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Zone name empty | Inline validation: "Zone name is required" | User enters a name |
| Radius outside valid range | Slider prevents out-of-range values. If entered manually: "Radius must be between 100m and 2000m" | User adjusts the slider |
| Maximum 10 zones reached | "+" button disabled. Note: "Maximum of 10 privacy zones. Delete an existing zone to add a new one." | User deletes an unused zone |
| Zone save fails | Alert: "Could not save privacy zone. Please try again." | User retries |
| Privacy zone causes empty export | Warning before export: "All track points are within privacy zones. The exported file would be empty." Export is blocked. | User can disable zones for this export or adjust zone settings |

**Validation Timing:**
- Zone name and radius validated on save
- Zone count validated before opening the zone editor for a new zone
- Privacy zone filtering applied at export time

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a privacy zone named "Home" with a 500m radius centered on their home address,
   **When** they export a track that starts from home,
   **Then** the exported GPX file does not contain any track points within 500m of the zone center. The route has a gap at the start corresponding to the privacy zone.

2. **Given** the user has 2 active privacy zones (Home, Work),
   **When** they export a track that passes through both zones,
   **Then** the exported GPX has gaps at both locations, and the interior track data between the zones is fully preserved.

3. **Given** the user navigates to Privacy Zones settings,
   **When** they view the list of configured zones,
   **Then** each zone shows its name, radius, map thumbnail, and an on/off toggle. Toggling a zone off immediately excludes it from future exports.

**Edge Cases:**

4. **Given** a privacy zone is disabled (toggled off),
   **When** the user exports a track that passes through that zone,
   **Then** no points are removed for the disabled zone (only enabled zones apply).

5. **Given** live location sharing is active and the user enters a privacy zone,
   **When** they are within the zone,
   **Then** no location updates are sent to the relay server. The recipient sees "Last updated X minutes ago." Updates resume when the user exits the zone.

**Negative Tests:**

6. **Given** the user already has 10 privacy zones,
   **When** they attempt to add an 11th,
   **Then** the "Add Zone" button is disabled with a note "Maximum of 10 privacy zones."
   **And** no new zone editor opens.

7. **Given** a track is entirely within a privacy zone,
   **When** the user attempts to export it with privacy zones enabled,
   **Then** a warning appears: "All track points are within privacy zones. The exported file would be empty."
   **And** the export does not proceed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| point inside zone | point at zone center, radius 500m | in_zone: true |
| point outside zone | point 600m from center, radius 500m | in_zone: false |
| point on zone boundary | point exactly 500m from center, radius 500m | in_zone: true |
| no active zones | empty zones array | in_zone: false for any point |
| disabled zone ignored | point in disabled zone | in_zone: false |
| filter removes zone points | 10 points, 3 inside zone | 7 points returned |
| filter with no zones | 10 points, no zones | 10 points returned |
| filter removes all points | all points inside zone | empty array returned |
| live sharing suppressed in zone | user in zone | suppressed: true |
| live sharing not suppressed outside | user outside all zones | suppressed: false |
| radius validation min | radius: 50 | validation error |
| radius validation max | radius: 3000 | validation error |
| zone count limit at 10 | 10 zones exist | cannot add more |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Export with privacy zone | 1. Create zone at home, 2. Record track starting from home, 3. Export GPX with zones enabled | GPX file has no points within zone radius of home |
| Toggle zone and re-export | 1. Export with zone on (points removed), 2. Toggle zone off, 3. Re-export same track | Second export includes all points |
| Live sharing respects zone | 1. Set zone, 2. Start sharing, 3. Move from inside zone to outside | No updates while inside zone. Updates begin when exiting zone. |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Protect home address on export | 1. Create "Home" privacy zone (500m), 2. Record a hike starting from home (walk 1km out), 3. Export as GPX with privacy zones ON | GPX file starts approximately 500m from home. No points within the zone. Track distance in GPX is approximately 500m less than the full recorded distance. Original track in app retains all points. |

---

### TR-018: Packing List Generator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-018 |
| **Feature Name** | Packing List Generator |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a trip planner, I want to generate a packing checklist based on my trip's activity types and duration so that I do not forget essential gear.

**Secondary:**
> As a backpacker preparing for a multi-day trip, I want the packing list to adjust based on the weather forecast at my destination so that I bring the right clothing layers.

**Tertiary:**
> As a weekend explorer, I want to save and reuse packing list templates so that I can quickly prepare for recurring trip types.

#### 3.3 Detailed Description

Packing List Generator creates customized gear checklists for planned trips based on the trip's activity types, duration, expected weather conditions, and elevation. The generator uses a curated item database organized by category and produces a checklist the user can review, customize, and check off as they pack.

The generator takes three inputs: the trip details (activity types per day, number of days, and whether camping is involved), the weather forecast for the trip destination (from TR-013), and optional user preferences (dietary restrictions for food suggestions, experience level for gear recommendations).

Items are organized into categories: Essentials (always included), Navigation, Clothing, Shelter/Sleep, Food/Water, First Aid, Hygiene, Tools, Electronics, and Activity-Specific. Each item in the database has conditions that determine when it is included: activity types it applies to, minimum trip duration, weather conditions (rain, cold, hot, snow), and whether camping is involved.

Generated packing lists are editable. Users can add custom items, remove suggested items, and adjust quantities. Lists are saved with their associated trip and can be checked off item by item as the user packs. A progress indicator shows packing completion (e.g., "24 of 32 items packed").

The system includes 8 predefined templates: Day Hike, Trail Run, Mountain Bike Ride, Multi-Day Backpack, Winter Hike, Beach Walk, Camping Trip, and Ultralight. Users can create custom templates from any generated or modified list.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-009: Trip Planning - Packing lists are generated from trip details

**External Dependencies:**
- Weather forecast data (from TR-013, optional) for weather-based item recommendations

**Assumed Capabilities:**
- The app can store and query a curated item database
- The app can render checkbox lists with category grouping

#### 3.5 User Interface Requirements

##### Screen: Generate Packing List (from Trip Detail)

**Layout:**
- Accessed from the Trip Detail screen via a "Packing List" button
- If no list exists for this trip: a "Generate List" button with configuration options below:
  - Activity types (auto-filled from trip days, editable)
  - Duration (auto-filled from trip date range)
  - Camping toggle (yes/no)
  - Weather summary (auto-filled from TR-013 forecast if available)
  - Experience level selector: Beginner, Intermediate, Experienced
  - Template selector: "Start from template" dropdown with predefined templates
- If a list exists: the checklist view (see below)

##### Screen: Packing Checklist

**Layout:**
- A top bar showing: trip name, packing progress (e.g., "24 / 32 packed"), and a progress bar
- Below: checklist organized by category sections (collapsible)
- Each category section header shows: category name, items packed/total for that category
- Each item shows: checkbox (tappable), item name, and an optional quantity (e.g., "x2")
- At the bottom of each category: an "Add Item" text button to add custom items to that category
- A floating action button: "Add Custom Item" (adds to a "Custom" category)
- A top-right menu with: "Reset List" (regenerate from scratch), "Save as Template", "Share List" (plain text export)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Not Generated | No packing list for this trip | Generator form with configuration options and "Generate" button |
| Generated | List created, items unchecked | Full checklist with all items unchecked. Progress: "0 / X packed" |
| In Progress | Some items checked | Checked items show strikethrough text and dimmed style. Progress updates. |
| Complete | All items checked | All items checked. Progress: "X / X packed". A green "All packed!" banner. |

**Interactions:**
- Tap checkbox: Toggles item packed/unpacked. Progress bar updates.
- Tap item name: Opens an edit sheet to change item name or quantity
- Swipe left on item: Reveals "Remove" action
- Tap "Add Item": Adds a text field at the bottom of the category for entering a custom item name
- Tap category header: Collapses or expands the category
- Tap "Save as Template": Saves the current list as a reusable template with a name

**Transitions/Animations:**
- Checkbox check animates with a checkmark draw-in (150ms)
- Checked items animate to strikethrough with a fade to 60% opacity (200ms)
- Progress bar animates smoothly on each check/uncheck (100ms)

#### 3.6 Data Requirements

##### Entity: PackingList

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| trip_id | string | Foreign key to Trip.id, nullable | null | The trip this list is for (null for templates) |
| name | string | Required, max 200 chars | Auto from trip name or template name | List name |
| is_template | boolean | - | false | Whether this is a reusable template |
| total_items | integer | Min: 0 | 0 | Total number of items in the list |
| packed_items | integer | Min: 0 | 0 | Number of items checked as packed |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: PackingItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| packing_list_id | string | Foreign key to PackingList.id, required | None | The list this item belongs to |
| name | string | Required, max 100 chars | None | Item name (e.g., "Rain jacket") |
| category | enum | One of: essentials, navigation, clothing, shelter_sleep, food_water, first_aid, hygiene, tools, electronics, activity_specific, custom | None | Item category |
| quantity | integer | Min: 1 | 1 | Number of this item to pack |
| is_packed | boolean | - | false | Whether the item has been checked off |
| is_custom | boolean | - | false | Whether the user added this item manually |
| sort_order | integer | Min: 0 | Auto-incremented within category | Order within the category |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- PackingList has many PackingItems (one-to-many via packing_list_id)
- PackingList optionally belongs to a Trip (via trip_id)

**Indexes:**
- PackingItem(packing_list_id, category, sort_order) - ordered items by category
- PackingList(trip_id) - find list for a specific trip
- PackingList(is_template) - filter to templates only

**Validation Rules:**
- name must not be empty after trimming
- quantity must be at least 1
- packed_items must not exceed total_items
- Maximum 200 items per packing list

#### 3.7 Business Logic Rules

##### Packing List Generation Algorithm

**Purpose:** Generate an initial packing list based on trip parameters, weather, and activity types.

**Inputs:**
- activity_types: array of enum - Activity types from the trip days
- duration_days: integer - Number of trip days
- is_camping: boolean - Whether the trip involves camping
- weather_forecast: object or null - Weather data from TR-013 (temperature range, precipitation probability)
- experience_level: enum - beginner, intermediate, experienced
- template_id: string or null - Optional starting template

**Logic:**

```
1. IF template_id is not null:
     Start with template items as base list
   ELSE:
     Start with empty list
2. Always include "essentials" category items:
   - Map/Navigation device
   - Headlamp + extra batteries
   - Sun protection (sunscreen, sunglasses, hat)
   - First aid kit
   - Knife/multi-tool
   - Fire starter (matches/lighter)
   - Emergency shelter (space blanket)
   - Extra food (1 day supply)
   - Extra water (1 liter minimum)
   - Rain protection (jacket or poncho)
3. Add navigation items:
   - Phone with offline maps (always)
   - Physical map of area (if experience_level = "beginner")
   - Compass (always)
4. Add clothing based on weather:
   a. Extract temperature range from weather_forecast
   b. IF min_temp < 5 C: Add insulation layers (fleece, puffy jacket, warm hat, gloves)
   c. IF min_temp < 0 C: Add winter gear (thermal base layers x duration, hand warmers)
   d. IF max_temp > 25 C: Add sun protection (lightweight shirt, extra water x2)
   e. IF precipitation_probability > 40%: Add rain gear (rain jacket, rain pants, pack cover)
   f. IF no weather data: Add a default layering set
   g. Always: hiking socks x (duration_days + 1), underwear x duration_days
5. Add shelter/sleep if is_camping:
   - Tent or shelter
   - Sleeping bag
   - Sleeping pad
   - Pillow (optional, if experience_level != "experienced" who might skip it)
6. Add food/water:
   - Water bottles/bladder (2L minimum)
   - Water filter/purification (if duration > 1 day)
   - Meals x (3 * duration_days)
   - Snacks x (2 * duration_days)
   - Cooking stove + fuel (if is_camping)
   - Utensils (if is_camping)
7. Add activity-specific items:
   - IF "run" in activity_types: Running shoes, running shorts, GPS watch
   - IF "bike" in activity_types: Helmet, bike repair kit, spare tube, pump
   - IF "hike" in activity_types: Trekking poles (optional), gaiters (if muddy/snowy)
8. Add electronics:
   - Phone charger / portable battery
   - Camera (optional)
9. Adjust quantities for multi-day:
   - Multiply consumables by duration_days
   - Add extra batteries for duration > 3 days
10. IF experience_level = "beginner":
      Add extra comfort items: camp chair, extra clothing layers
    IF experience_level = "experienced":
      Remove optional comfort items to reduce pack weight
11. RETURN generated packing list items with categories and quantities
```

**Edge Cases:**
- No weather data available: Use a moderate-weather default set (layers for 10-20 C)
- Single-day trip: Skip shelter/sleep category, reduce food quantities
- No activity types selected: Default to "hike" gear set
- Template plus additions: Start from template, add any missing items from the algorithm

##### Packing Progress Calculation

**Purpose:** Compute packing completion percentage for progress bar display.

**Inputs:**
- packing_list: PackingList record
- items: array of PackingItem

**Logic:**

```
1. total = items.length
2. packed = count of items WHERE is_packed = true
3. IF total = 0:
     RETURN 0%
4. progress_pct = round((packed / total) * 100)
5. UPDATE packing_list with total_items = total, packed_items = packed
6. RETURN progress_pct
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No trip data for generation | Alert: "Create a trip first to generate a packing list." | User creates a trip via TR-009 |
| Weather data unavailable | List generated with moderate-weather defaults. Note: "Weather forecast not available. List uses default clothing recommendations." | User can manually add/remove weather-specific items |
| Item name empty | Inline validation: "Item name is required" | User enters a name |
| Maximum 200 items reached | Alert: "Maximum of 200 items per packing list." | User removes unnecessary items |
| List save fails | Alert: "Could not save packing list. Please try again." | User retries |

**Validation Timing:**
- Item name validated on add/edit
- Item count validated before adding a new item
- Progress calculated on every check/uncheck

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a 3-day camping trip with hiking and a weather forecast of 10-18 C with 60% rain chance,
   **When** the user taps "Generate List",
   **Then** the generated list includes essentials, camping gear (tent, sleeping bag, pad), rain gear (jacket, pants, pack cover), 3 days of meals and snacks, extra clothing layers for cool temperatures, and activity-specific hiking items.

2. **Given** a generated packing list with 32 items,
   **When** the user checks off 24 items,
   **Then** the progress bar shows 75%, the header reads "24 / 32 packed", and checked items display with strikethrough text.

3. **Given** the user has a completed packing list they want to reuse,
   **When** they tap "Save as Template" and name it "Weekend Backpack",
   **Then** the template appears in the template selector for future trips.

**Edge Cases:**

4. **Given** a day hike (single day, no camping) in hot weather (30 C),
   **When** the list is generated,
   **Then** shelter/sleep items are excluded, extra water is included, sun protection is emphasized, and food quantities are for 1 day only.

5. **Given** the user adds 5 custom items to a generated list,
   **When** they view the list,
   **Then** custom items appear in a "Custom" category section at the bottom, are editable, and are included in the progress count.

**Negative Tests:**

6. **Given** no trip has been created,
   **When** the user attempts to generate a packing list,
   **Then** an alert shows "Create a trip first to generate a packing list."
   **And** no list is generated.

7. **Given** a packing list already has 200 items,
   **When** the user tries to add another,
   **Then** an alert shows "Maximum of 200 items per packing list."
   **And** the item is not added.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| essentials always included | any trip configuration | essentials category has >= 10 items |
| rain gear added for >40% precip | precipitation: 60% | rain jacket, rain pants, pack cover in list |
| rain gear excluded for 0% precip | precipitation: 0% | no rain-specific items |
| camping gear added when camping | is_camping: true | tent, sleeping bag, sleeping pad in list |
| camping gear excluded for day trip | is_camping: false, duration: 1 | no shelter/sleep items |
| cold weather adds insulation | min_temp: 2 C | fleece, puffy jacket, warm hat in list |
| hot weather adds sun protection | max_temp: 30 C | extra water, lightweight shirt in list |
| multi-day multiplies consumables | duration: 3 days | meals: 9, snacks: 6 |
| bike activity adds helmet | activity_types includes "bike" | helmet, repair kit in list |
| progress at 0% | 0 of 10 packed | 0% |
| progress at 75% | 15 of 20 packed | 75% |
| progress at 100% | 20 of 20 packed | 100% |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Generate list for camping trip | 1. Create 3-day camping trip, 2. Generate packing list | List includes camping gear, multi-day food quantities, essentials |
| Check items and verify progress | 1. Generate list (30 items), 2. Check 15 items | Progress shows 50%, checked items have strikethrough |
| Save and use template | 1. Generate list, 2. Modify it, 3. Save as template, 4. Create new trip, 5. Generate from template | New list starts with template items |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Prepare for a backpacking trip | 1. Create 3-day backpacking trip, 2. Generate packing list with weather data, 3. Review list, 4. Add 2 custom items, 5. Check off items as packing, 6. Reach 100% | Packing list shows "All packed!" banner. 100% progress bar. All items checked. Custom items included. Weather-specific gear present. |

---

### TR-019: Segment Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-019 |
| **Feature Name** | Segment Tracking |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a trail runner, I want to define segments on frequently-run trails and automatically compare my times on those segments across different runs so that I can track my improvement.

**Secondary:**
> As a day hiker, I want to see my fastest time on a specific trail segment (like the climb to a summit) so that I can challenge myself to beat it next time.

**Tertiary:**
> As a weekend explorer, I want the system to automatically detect when I run a previously recorded segment so that I do not have to manually mark segments each time.

#### 3.3 Detailed Description

Segment Tracking allows users to define named trail segments and automatically track their performance across multiple visits to the same segment. A segment is a section of trail defined by a start point and an end point. When the user records an activity that passes through a known segment, the system automatically detects the segment match and records the segment time, pace, and other metrics.

Users create segments in two ways. First, they can manually define a segment by selecting a start and end point on a completed track's route map. Second, the system can auto-detect repeated segments across different tracks - if the user has recorded two or more tracks that share a common sub-route (within a 50m corridor), the system suggests creating a segment from the overlapping portion.

When a segment match is detected during or after a recording, the system compares the current effort against the user's personal best time for that segment. A notification shows whether the current effort is a new personal best (PR), how it compares to previous efforts, and the ranking among all recorded efforts on that segment.

The Segment Detail screen shows a leaderboard of all the user's recorded efforts on a segment, sorted by time (fastest first). Each entry shows: date, time, average pace, average speed, and weather conditions (if available). A chart compares effort times over the history to visualize improvement trends.

Segment matching uses a geographic corridor approach: a recorded track is considered to match a segment if at least 90% of the segment's points have a corresponding track point within 50 meters. This accounts for minor GPS drift and slight path variations while ensuring the user actually traversed the segment.

All segment data is private and local. There are no shared leaderboards, no social competition, and no upload of segment data. This directly contrasts with Strava's public segments, which have caused safety and privacy concerns.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-001: GPS Trail Recording - Provides the TrackPoint data for segment matching
- TR-002: Trail History Log - Historical tracks are scanned for segment matches

**External Dependencies:**
- None (all computation is local)

**Assumed Capabilities:**
- The app can perform geographic corridor matching between route segments
- The app can run segment detection on historical track data

#### 3.5 User Interface Requirements

##### Screen: Segment Detail

**Layout:**
- Header section: segment name, total distance, elevation gain/loss, map preview showing the segment highlighted on the broader trail
- Below the header: a personal best (PR) card showing the fastest time, date, and pace
- A leaderboard list of all recorded efforts sorted by elapsed time (fastest first), each showing: rank number, date, elapsed time, average pace, improvement vs. PR (e.g., "+12s" or "PR!")
- A trend chart at the bottom showing effort times plotted over date (line chart), with a trendline indicating improvement or regression

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Single Effort | Only 1 recorded effort | PR card shows the single effort. Leaderboard has 1 entry. Trend chart is not shown (need >= 3 efforts). |
| Multiple Efforts | 2 or more recorded efforts | Full leaderboard and PR card. Trend chart shown for 3+ efforts. |
| New PR | Latest effort is the fastest | PR card highlighted with a gold border. Latest effort in leaderboard shows "PR!" badge. |

**Interactions:**
- Tap a leaderboard entry: Navigates to the Trail Detail for the track that contains this effort
- Tap the map preview: Expands to full-screen map showing the segment route
- Tap "Edit Segment": Opens editor to rename or adjust start/end points
- Tap "Delete Segment": Confirmation dialog, then deletes segment and all associated effort records

##### Component: Segment Match Notification (post-recording)

**Layout:**
- After saving a recording, if segment matches are detected, a notification card appears on the save summary screen
- Shows: segment name, segment time for this effort, comparison to PR ("New PR!" or "+Xs behind your best")
- Tapping the notification navigates to the Segment Detail screen

##### Screen: Segments List

**Layout:**
- Accessible from the Stats Dashboard or main navigation
- A list of all user-defined segments, each showing: segment name, distance, number of recorded efforts, PR time, and a small map preview
- A "Create Segment" button
- Sort by: Name, Distance, Number of Efforts, Recent Activity

**Interactions:**
- Tap a segment card: Opens the Segment Detail screen
- Swipe left: Delete action with confirmation
- Tap "Create Segment": Opens a track selector, then route selector for defining start/end points

#### 3.6 Data Requirements

##### Entity: Segment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| name | string | Required, max 100 chars | Auto-generated from location | Segment name |
| start_lat | float | -90.0 to 90.0 | None | Start point latitude |
| start_lon | float | -180.0 to 180.0 | None | Start point longitude |
| end_lat | float | -90.0 to 90.0 | None | End point latitude |
| end_lon | float | -180.0 to 180.0 | None | End point longitude |
| distance_m | float | Min: 0.0 | 0.0 | Segment distance in meters |
| elevation_gain_m | float | Min: 0.0 | 0.0 | Elevation gain across the segment |
| elevation_loss_m | float | Min: 0.0 | 0.0 | Elevation loss across the segment |
| reference_points | string | JSON array of {lat, lon} | None | The canonical path of the segment (for corridor matching) |
| corridor_width_m | float | Min: 10, Max: 200 | 50 | Width of the matching corridor in meters |
| match_threshold_pct | float | 0.0 to 1.0 | 0.90 | Minimum percentage of reference points that must match |
| effort_count | integer | Min: 0 | 0 | Number of recorded efforts on this segment |
| pr_time_ms | integer | Nullable | null | Personal record time in milliseconds |
| pr_effort_id | string | Nullable, FK to SegmentEffort.id | null | The effort that holds the PR |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: SegmentEffort

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| segment_id | string | Foreign key to Segment.id, required | None | The segment this effort is for |
| track_id | string | Foreign key to Track.id, required | None | The track that contains this effort |
| elapsed_time_ms | integer | Min: 0 | None | Time to traverse the segment in milliseconds |
| avg_pace_s_per_km | float | Nullable | null | Average pace during the segment |
| avg_speed_m_per_s | float | Nullable | null | Average speed during the segment |
| start_timestamp | datetime | Required | None | When the user entered the segment |
| end_timestamp | datetime | Required | None | When the user exited the segment |
| is_pr | boolean | - | false | Whether this is the current personal record |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Relationships:**
- Segment has many SegmentEfforts (one-to-many via segment_id)
- SegmentEffort belongs to a Track (via track_id)

**Indexes:**
- SegmentEffort(segment_id, elapsed_time_ms) - leaderboard query (sorted by time)
- SegmentEffort(track_id) - find efforts for a specific track
- Segment(pr_time_ms) - sort segments by fastest time

**Validation Rules:**
- A segment must have at least 2 reference points
- distance_m must be at least 100 meters (to avoid trivially short segments)
- Maximum 100 segments per user

#### 3.7 Business Logic Rules

##### Segment Corridor Matching

**Purpose:** Determine if a recorded track passes through a defined segment by checking geographic corridor overlap.

**Inputs:**
- track_points: array of TrackPoint - The recorded track
- segment: Segment - The segment to match against

**Logic:**

```
1. Parse segment.reference_points from JSON into array of {lat, lon}
2. matched_count = 0
3. FOR each ref_point in segment reference_points:
     min_dist = infinity
     FOR each track_point in track_points:
       d = haversine(ref_point.lat, ref_point.lon,
                     track_point.latitude, track_point.longitude)
       IF d < min_dist:
         min_dist = d
     IF min_dist <= segment.corridor_width_m:
       matched_count = matched_count + 1
4. match_pct = matched_count / segment.reference_points.length
5. IF match_pct >= segment.match_threshold_pct:
     RETURN { matched: true, match_pct: match_pct }
6. ELSE:
     RETURN { matched: false, match_pct: match_pct }
```

**Edge Cases:**
- Track passes through segment in reverse direction: Still matches (direction-agnostic by default)
- Track passes through segment twice (out-and-back): Both passes are detected as separate efforts
- GPS drift pushes some points outside corridor: The 90% threshold tolerates up to 10% of points missing
- Very short segment (<100m): Rejected at creation time

##### Segment Effort Extraction

**Purpose:** Extract the portion of a track that corresponds to a segment match and compute effort metrics.

**Inputs:**
- track_points: array of TrackPoint ordered by timestamp
- segment: Segment

**Logic:**

```
1. Find entry point: the first track_point within corridor_width_m of
   segment start point (start_lat, start_lon)
2. Find exit point: the first track_point (after entry) within
   corridor_width_m of segment end point (end_lat, end_lon)
3. IF entry and exit not found:
     Also check reverse direction (exit before entry)
4. IF neither direction matches: RETURN null (no valid effort)
5. effort_points = track_points from entry_point to exit_point
6. elapsed_time_ms = exit_point.timestamp - entry_point.timestamp
7. effort_distance = sum of Haversine distances across effort_points
8. avg_speed = effort_distance / (elapsed_time_ms / 1000)
9. avg_pace = (elapsed_time_ms / 1000) / (effort_distance / 1000)
10. Create SegmentEffort record:
      segment_id = segment.id
      track_id = track.id
      elapsed_time_ms = computed
      avg_pace_s_per_km = avg_pace
      avg_speed_m_per_s = avg_speed
      start_timestamp = entry_point.timestamp
      end_timestamp = exit_point.timestamp
11. Check if new PR:
      IF segment.pr_time_ms is null OR elapsed_time_ms < segment.pr_time_ms:
        is_pr = true
        UPDATE segment.pr_time_ms = elapsed_time_ms
        UPDATE segment.pr_effort_id = new effort id
        Mark previous PR effort as is_pr = false
12. INCREMENT segment.effort_count
13. RETURN effort
```

**Edge Cases:**
- Entry found but exit not found (user turned around before completing segment): No effort recorded
- Track paused within the segment: Elapsed time includes pause time (user can note this)
- Multiple entries/exits (zigzag through segment): Record first complete traversal

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Segment creation with <100m distance | Inline validation: "Segment must be at least 100 meters long" | User selects start/end points farther apart |
| Corridor matching computation slow (>5 seconds) | Processing spinner on save screen: "Checking for segment matches..." | Runs asynchronously; results shown when ready |
| Too many segments (>100) | Alert: "Maximum of 100 segments. Delete unused segments to create new ones." | User deletes old segments |
| Segment reference points corrupt | Segment shows "Data error" on the segments list. Matches are not attempted. | User can delete and recreate the segment |

**Validation Timing:**
- Segment distance validated on creation
- Corridor matching runs after each recording is saved
- PR comparison runs during effort extraction

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects a start and end point on a completed track to define a segment named "Summit Push",
   **When** they save the segment,
   **Then** the segment appears in the Segments List with the correct distance, elevation gain, and a map preview showing the highlighted section.

2. **Given** a segment "Summit Push" exists and the user records a new hike that passes through it,
   **When** the recording is saved,
   **Then** a notification appears: "Segment matched: Summit Push - 18:42" showing the effort time and comparison to PR.

3. **Given** a segment has 5 recorded efforts,
   **When** the user opens the Segment Detail screen,
   **Then** the leaderboard shows all 5 efforts ranked by time, the PR card shows the fastest time, and the trend chart plots times across dates.

**Edge Cases:**

4. **Given** the user records a track that is 92% within a segment's corridor,
   **When** matching is evaluated with a 90% threshold,
   **Then** the segment matches and an effort is recorded.

5. **Given** the user records a new fastest time on a segment,
   **When** the effort is saved,
   **Then** the effort is marked as PR, the previous PR entry in the leaderboard loses its PR badge, and the segment's pr_time_ms is updated.

**Negative Tests:**

6. **Given** the user tries to create a segment from two points only 50 meters apart,
   **When** they attempt to save,
   **Then** a validation error shows: "Segment must be at least 100 meters long."
   **And** the segment is not created.

7. **Given** a track only passes through 80% of a segment's corridor (threshold is 90%),
   **When** matching is evaluated,
   **Then** no match is detected and no effort is recorded.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| corridor match at 100% | all reference points within 50m of track | matched: true, match_pct: 1.0 |
| corridor match at 90% threshold | 90 of 100 ref points within corridor | matched: true |
| corridor match below threshold | 80 of 100 ref points within corridor | matched: false |
| effort extraction finds entry and exit | track passes through segment start and end | effort with correct elapsed time |
| effort extraction reverse direction | track traverses segment in reverse | effort still extracted |
| effort extraction no exit | track enters but does not reach segment end | null (no effort) |
| PR detection - first effort | no existing efforts | is_pr: true |
| PR detection - new fastest | existing PR 20:00, new effort 18:00 | is_pr: true, old PR updated |
| PR detection - slower effort | existing PR 18:00, new effort 20:00 | is_pr: false |
| segment distance validation | distance: 50m | rejected (<100m minimum) |
| segment distance validation pass | distance: 500m | accepted |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create segment and match on next recording | 1. Record track A, 2. Create segment from portion of A, 3. Record track B through same area | Segment effort created for track B with correct time and pace |
| PR update across multiple efforts | 1. Create segment, 2. Record 3 tracks through it with times 20min, 18min, 22min | PR is 18min. Leaderboard: 18min (PR), 20min, 22min |
| Segment auto-detection suggestion | 1. Record 3 tracks with overlapping sub-routes, 2. System detects overlap | System suggests creating a segment from the common portion |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Track improvement on a favorite trail section | 1. Record initial hike, 2. Create "Hill Climb" segment, 3. Re-hike same trail 3 more times, 4. View Segment Detail | 4 efforts in leaderboard. PR highlighted. Trend chart shows times across 4 dates. Map shows segment highlighted on the trail. |

---

### TR-020: Trail Search and Filtering

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | TR-020 |
| **Feature Name** | Trail Search and Filtering |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a day hiker with 50+ recorded tracks, I want to search my trail history by name or location so that I can quickly find a specific past hike without scrolling through the entire list.

**Secondary:**
> As a trail runner, I want to filter my activities by distance range (e.g., 5-10 km runs) and difficulty so that I can find suitable routes for my next training session.

**Tertiary:**
> As a trip planner, I want to search my waypoints and past tracks near a specific area so that I can plan new routes using my prior knowledge of the terrain.

#### 3.3 Detailed Description

Trail Search and Filtering provides comprehensive search and advanced filtering capabilities across the user's recorded tracks, waypoints, and trips. The feature enhances the basic filtering in the Trail History Log (TR-002) with full-text search, geographic search (find tracks near a location), distance range filters, elevation range filters, date range filters, and combined multi-filter queries.

The search engine supports two modes. Text search matches against track names, notes, waypoint names, and trip names using case-insensitive substring matching. Geographic search allows users to draw a circle on the map and find all tracks that pass through that area (any track with at least one TrackPoint within the circle is a match).

Advanced filters can be combined freely. The user can, for example, find all "hard" difficulty hikes between 10-20 km in distance, recorded in 2026, near Yosemite. Each active filter is displayed as a removable chip at the top of the results, making it clear what criteria are applied and easy to remove individual filters.

Search results are displayed in the same card format as the Trail History Log, with the addition of match context: if a track matched by name or notes, the matching text is highlighted in the card. If matched by geographic proximity, the distance from the search center is shown. Results are sortable by relevance (text search), date, distance, or proximity (geographic search).

The search index is built from local data only. No search queries are sent to any server. The search operates on the full SQLite dataset with optimized indexes for fast results even with thousands of tracks.

#### 3.4 Prerequisites

**Feature Dependencies:**
- TR-002: Trail History Log - Search extends the history list with advanced filtering

**External Dependencies:**
- None (all search is local)

**Assumed Capabilities:**
- The app can perform efficient text search on local data (FTS5 or equivalent)
- The app can compute geographic distance queries on TrackPoint data

#### 3.5 User Interface Requirements

##### Screen: Search

**Layout:**
- A search bar at the top with a text input and a "Filters" button (funnel icon) to the right
- Below the search bar: a row of active filter chips. Each chip shows the filter type and value (e.g., "Difficulty: Hard", "Distance: 10-20 km", "Near: Yosemite"). Each chip has an "X" to remove it.
- Below the chips: a results count (e.g., "12 results") and sort selector (Relevance, Date, Distance, Proximity)
- The main area is a scrollable list of matching track cards (same format as Trail History cards with additional match context)
- A "Map View" toggle to switch between list results and results plotted on a map

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Initial | Search screen opened, no query | Recent searches listed (last 10 queries). Suggested searches: "Longest hike", "This month's activities", "Near [current location]". |
| Searching | User is typing a query | Results update live as the user types (debounced by 300ms). Each result card highlights the matching text. |
| Results - List | Results found, list view | Scrollable list of matching track cards with result count |
| Results - Map | Results found, map view | Map showing all matching tracks as route polylines. Tapping a route shows a summary popup. |
| No Results | Query returns zero matches | "No activities match your search." with suggestions: "Try a different query" or "Adjust your filters." |
| Filters Active | One or more advanced filters applied | Filter chips visible below search bar. Results reflect combined filters. |

**Interactions:**
- Type in search bar: Live text search with 300ms debounce. Results update as the user types.
- Tap "Filters" button: Opens the Advanced Filters bottom sheet
- Tap a filter chip "X": Removes that filter and updates results
- Tap a result card: Navigates to the Trail Detail screen for that track
- Toggle list/map view: Switches between list results and map results
- Tap a recent search: Re-runs that search query
- Clear search bar: Returns to the initial state with recent searches

##### Bottom Sheet: Advanced Filters

**Layout:**
- A bottom sheet with multiple filter sections:
  1. **Activity Type:** Chips for Hike, Run, Bike, Walk, Other (multi-select)
  2. **Distance Range:** Two inputs (min km, max km) or preset buttons (0-5 km, 5-10 km, 10-20 km, 20+ km)
  3. **Elevation Gain Range:** Two inputs (min m, max m) or presets (0-300 m, 300-600 m, 600-1200 m, 1200+ m)
  4. **Difficulty:** Chips for Easy, Moderate, Hard, Expert (multi-select)
  5. **Date Range:** Preset buttons (This Week, This Month, This Year, Custom) with a custom date picker
  6. **Geographic Area:** "Search Near" button that opens a map for drawing a search circle (center + radius)
  7. **Favorites Only:** Toggle
- "Apply Filters" button at the bottom
- "Reset All" text button at the top-right

**Interactions:**
- Select filter values: Multiple filters can be combined
- Tap "Apply Filters": Applies all selected filters and closes the bottom sheet. Filter chips appear below the search bar.
- Tap "Reset All": Clears all filters
- Tap "Search Near": Opens a map where the user taps a center point and drags to set a radius (default 10 km, max 100 km). Tracks with any TrackPoint within this circle are matched.

#### 3.6 Data Requirements

This feature queries existing entities (Track, TrackPoint, Waypoint, Trip) defined in other feature specs. No new persistent entities are introduced.

**Search Indexes (for performance):**

| Entity | Index Type | Fields | Purpose |
|--------|-----------|--------|---------|
| Track | Full-text search (FTS5) | name, notes | Text search on track name and notes |
| Waypoint | Full-text search (FTS5) | name, notes | Text search on waypoint name and notes |
| Trip | Full-text search (FTS5) | name, destination, notes | Text search on trip data |
| Track | Standard | activity_type, difficulty_rating | Filter by type and difficulty |
| Track | Standard | distance_m | Filter by distance range |
| Track | Standard | elevation_gain_m | Filter by elevation range |
| Track | Standard | started_at | Filter by date range |
| TrackPoint | Spatial (or bounding box) | latitude, longitude | Geographic proximity search |

**Derived Data (in-memory):**

| Field | Type | Description |
|-------|------|-------------|
| match_type | enum | How the result matched: text, geographic, filter_only |
| match_text | string or null | The matching text snippet (for highlighting) |
| proximity_m | float or null | Distance from the search center (for geographic search) |

#### 3.7 Business Logic Rules

##### Text Search

**Purpose:** Search tracks, waypoints, and trips by name or text content.

**Inputs:**
- query: string - The search query
- search_targets: enum - tracks, waypoints, trips, or all

**Logic:**

```
1. Normalize query: trim whitespace, convert to lowercase
2. IF query is empty: RETURN all results (filter-only mode)
3. Search using FTS5 (full-text search):
   a. Match against Track.name and Track.notes
   b. Match against Waypoint.name and Waypoint.notes
   c. Match against Trip.name, Trip.destination, and Trip.notes
4. Rank results by relevance:
   a. Exact name match: highest rank
   b. Name starts with query: high rank
   c. Name contains query: medium rank
   d. Notes contain query: low rank
5. RETURN ranked results with match_text excerpts
```

**Edge Cases:**
- Single character query: Match normally (but likely many results)
- Special characters in query: Escape for FTS5 safety
- No matches: Return empty results

##### Geographic Proximity Search

**Purpose:** Find all tracks that pass within a specified radius of a given point.

**Inputs:**
- center_lat: float - Center of the search area
- center_lon: float - Center of the search area
- radius_m: float - Search radius in meters

**Logic:**

```
1. First, compute a bounding box from center and radius to narrow the query:
   lat_delta = radius_m / 111320
   lon_delta = radius_m / (111320 * cos(center_lat * pi / 180))
   min_lat = center_lat - lat_delta
   max_lat = center_lat + lat_delta
   min_lon = center_lon - lon_delta
   max_lon = center_lon + lon_delta
2. Query Track bounding boxes that overlap the search bounding box:
   WHERE bounding_box_ne_lat >= min_lat
     AND bounding_box_sw_lat <= max_lat
     AND bounding_box_ne_lon >= min_lon
     AND bounding_box_sw_lon <= max_lon
3. For each candidate Track, verify with precise check:
   SELECT COUNT(*) FROM TrackPoint
   WHERE track_id = candidate.id
     AND latitude BETWEEN min_lat AND max_lat
     AND longitude BETWEEN min_lon AND max_lon
   For each point in the bounding box:
     IF haversine(point.lat, point.lon, center_lat, center_lon) <= radius_m:
       Track is a match. BREAK.
4. Compute proximity_m = minimum haversine distance from any of the track's
   points to the search center
5. RETURN matching tracks with proximity_m for sorting
```

**Edge Cases:**
- Very large radius (>100 km): May match many tracks; limit results to 100
- No tracks near the area: Return empty results
- Track bounding box overlaps but no individual point is within radius: Excluded by precise check

##### Combined Filter Application

**Purpose:** Apply multiple filters simultaneously to narrow search results.

**Inputs:**
- text_query: string or null
- activity_types: array of enum or null
- distance_min_m: float or null
- distance_max_m: float or null
- elevation_min_m: float or null
- elevation_max_m: float or null
- difficulty_ratings: array of enum or null
- date_start: date or null
- date_end: date or null
- geo_center: {lat, lon} or null
- geo_radius_m: float or null
- favorites_only: boolean

**Logic:**

```
1. Start with all Track records
2. IF text_query is not null and not empty:
     Apply text search filter (FTS5 match on name/notes)
3. IF activity_types is not null and not empty:
     Filter WHERE activity_type IN activity_types
4. IF distance_min_m is not null:
     Filter WHERE distance_m >= distance_min_m
5. IF distance_max_m is not null:
     Filter WHERE distance_m <= distance_max_m
6. IF elevation_min_m is not null:
     Filter WHERE elevation_gain_m >= elevation_min_m
7. IF elevation_max_m is not null:
     Filter WHERE elevation_gain_m <= elevation_max_m
8. IF difficulty_ratings is not null and not empty:
     Filter WHERE difficulty_rating IN difficulty_ratings
9. IF date_start is not null:
     Filter WHERE started_at >= date_start
10. IF date_end is not null:
      Filter WHERE started_at <= date_end (end of day)
11. IF favorites_only is true:
      Filter WHERE is_favorite = true
12. IF geo_center is not null:
      Apply geographic proximity filter (bounding box + precise check)
13. Sort results:
      IF text_query active: sort by relevance (FTS rank)
      ELSE IF geo_center active: sort by proximity_m
      ELSE: sort by started_at DESC (default)
14. RETURN filtered, sorted results
```

**Edge Cases:**
- All filters applied and no results: Show "No activities match your search" with suggestion to adjust filters
- Only geographic filter with large radius: May return many results; paginate
- Conflicting filters (e.g., distance min > max): Show validation error "Minimum must be less than maximum"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| FTS5 index not built | Search falls back to simple LIKE query (slower but functional) | Index is rebuilt in background |
| Search query too long (>200 chars) | Inline validation: "Search query is too long" | User shortens the query |
| Distance min > max | Inline validation: "Minimum distance must be less than maximum" | User corrects the values |
| Geographic search with 0 radius | Default to 1 km radius | Automatic |
| Database query timeout (very large dataset) | Spinner shows for up to 5 seconds. If still running: "Search is taking longer than usual. Try a more specific query." | User adds more filters or a more specific text query |

**Validation Timing:**
- Text search triggers 300ms after the user stops typing (debounced)
- Filter validation runs when "Apply Filters" is tapped
- Geographic search runs after the user sets center and radius

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 50 recorded tracks,
   **When** they type "Muir" in the search bar,
   **Then** all tracks with "Muir" in the name or notes appear in real time (within 300ms of typing), with "Muir" highlighted in the matching text.

2. **Given** the user applies filters: activity type "Hike", distance 10-20 km, difficulty "Hard",
   **When** the filters are applied,
   **Then** only hikes between 10-20 km rated "Hard" are shown. Three filter chips appear below the search bar: "Hike", "10-20 km", "Hard".

3. **Given** the user taps "Search Near" and draws a 5 km circle around Yosemite Valley,
   **When** the geographic search runs,
   **Then** all tracks with any TrackPoint within 5 km of the selected center appear, sorted by proximity (closest first).

**Edge Cases:**

4. **Given** the user combines text search "Summit" with activity type filter "Run" and date filter "This Year",
   **When** all three filters are applied together,
   **Then** only runs from this year with "Summit" in the name or notes appear. All three filter chips are visible and individually removable.

5. **Given** the user switches to map view in search results,
   **When** 8 matching tracks are found,
   **Then** all 8 route polylines are drawn on the map with different colors, and tapping a route shows a summary popup with track name, date, and distance.

**Negative Tests:**

6. **Given** a search query returns zero results,
   **When** the results area is empty,
   **Then** a "No activities match your search" message appears with suggestions to try a different query or adjust filters.
   **And** no error is shown.

7. **Given** the user sets distance min as 20 km and max as 10 km,
   **When** they tap "Apply Filters",
   **Then** an inline validation message shows "Minimum distance must be less than maximum."
   **And** the filter is not applied.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| text search matches name | query: "Muir", tracks: ["Muir Woods Hike", "Other Trail"] | 1 result: "Muir Woods Hike" |
| text search matches notes | query: "waterfall", tracks with notes containing "waterfall" | matching tracks returned |
| text search is case-insensitive | query: "MUIR", track name: "muir woods" | match found |
| text search no matches | query: "xyz123", no matching tracks | empty results |
| geographic search bounding box | center: (37.7, -122.4), radius: 5km | correct min/max lat/lon bounds |
| geographic search matches nearby track | track with point 3km from center, radius 5km | track matched |
| geographic search excludes far track | track with all points >10km from center, radius 5km | track not matched |
| combined filter AND logic | type: hike AND distance: 10-20km | only hikes in range returned |
| distance range validation | min: 20, max: 10 | validation error |
| empty query returns all | query: "" | all tracks returned |
| relevance ranking | exact name match vs. notes match | name match ranked higher |
| filter chip removal | remove "Hike" filter chip | results update to include all types |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Text search with live results | 1. Type "trail" in search bar, 2. Verify results update after 300ms debounce | Results show all tracks with "trail" in name or notes, matching text highlighted |
| Geographic search on map | 1. Open filters, 2. Tap "Search Near", 3. Select center point, 4. Set 10km radius, 5. Apply | Only tracks within 10km of center appear, sorted by proximity |
| Multi-filter combination | 1. Apply type filter "Run", 2. Apply distance 5-15km, 3. Apply date "This Year", 4. View results | Only runs from this year between 5-15km shown. 3 filter chips visible. |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Find a specific past hike | 1. Open Search, 2. Type trail name, 3. See matching results, 4. Tap result, 5. View Trail Detail | Correct trail found and opened. Search highlights matching text. Trail Detail shows full route and stats. |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the Track entity, which represents a single recorded outdoor activity. Each Track contains many TrackPoints (GPS samples captured during recording) that define the route geometry. Tracks can be enriched with GeoPhotos (geotagged images), Waypoints (named location markers), and SegmentEfforts (performance data on defined trail segments).

Trip planning data forms a parallel hierarchy: a Trip contains TripDays, each of which contains PlannedWaypoints (route plan coordinates). TripDays can be linked to actual Tracks post-trip to compare planned versus actual performance.

Supporting entities include MapRegions and CachedTiles for offline map storage, PrivacyZones for location data protection, SharingSessions for live location broadcasts, Badges and EarnedBadges for gamification, PackingLists and PackingItems for trip preparation, Segments and SegmentEfforts for performance tracking, and WeatherCache for cached forecast data.

All entities use the `tr_` table prefix in the MyLife hub SQLite database.

### 4.2 Complete Entity Definitions

#### Entity: Track

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique track identifier |
| name | string | Optional, max 200 chars | Auto from date + type | User-editable activity name |
| activity_type | enum | hike, run, bike, walk, other | hike | Activity type |
| activity_label | string | Optional, max 50 chars | null | Custom label for "Other" type |
| started_at | datetime | Required, ISO 8601 | Set on start | Recording start time |
| finished_at | datetime | Required, ISO 8601 | Set on stop | Recording end time |
| elapsed_time_ms | integer | Min: 0 | 0 | Active recording time (excludes pauses) |
| distance_m | float | Min: 0.0 | 0.0 | Total Haversine distance |
| elevation_gain_m | float | Min: 0.0 | 0.0 | Cumulative uphill (3m noise filter) |
| elevation_loss_m | float | Min: 0.0 | 0.0 | Cumulative downhill (3m noise filter) |
| max_elevation_m | float | Nullable | null | Highest point reached |
| min_elevation_m | float | Nullable | null | Lowest point reached |
| avg_pace_s_per_km | float | Nullable, Min: 0.0 | null | Average pace |
| max_speed_m_per_s | float | Nullable, Min: 0.0 | null | Maximum speed |
| avg_speed_m_per_s | float | Nullable, Min: 0.0 | null | Average speed |
| bounding_box_ne_lat | float | -90.0 to 90.0 | null | NE corner latitude |
| bounding_box_ne_lon | float | -180.0 to 180.0 | null | NE corner longitude |
| bounding_box_sw_lat | float | -90.0 to 90.0 | null | SW corner latitude |
| bounding_box_sw_lon | float | -180.0 to 180.0 | null | SW corner longitude |
| notes | string | Optional, max 5000 chars | null | User notes |
| difficulty_rating | enum | easy, moderate, hard, expert, null | null | User-assigned difficulty |
| auto_difficulty | enum | easy, moderate, hard, expert, null | null | System-suggested difficulty |
| is_favorite | boolean | - | false | Favorited flag |
| privacy_zone_applied | boolean | - | false | Whether export was trimmed |
| created_at | datetime | Auto | Current timestamp | Creation time |
| updated_at | datetime | Auto | Current timestamp | Modification time |

#### Entity: TrackPoint

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | PK, UUID | Auto | Unique point identifier |
| track_id | string | FK to Track.id, required | None | Parent track |
| latitude | float | -90.0 to 90.0, required | None | WGS84 latitude |
| longitude | float | -180.0 to 180.0, required | None | WGS84 longitude |
| elevation_m | float | Nullable | null | Altitude in meters |
| timestamp | datetime | Required, ISO 8601 | None | Capture time |
| accuracy_m | float | Min: 0.0, nullable | null | Horizontal accuracy |
| speed_m_per_s | float | Min: 0.0, nullable | null | Instantaneous speed |
| bearing_deg | float | 0.0-360.0, nullable | null | Direction of travel |
| segment_index | integer | Min: 0 | 0 | Segment number (pause/resume) |
| is_low_confidence | boolean | - | false | True if accuracy > 30m |
| created_at | datetime | Auto | Current timestamp | Creation time |

#### Entity: GeoPhoto

See TR-008 section 3.6 for full definition.

#### Entity: Waypoint

See TR-015 section 3.6 for full definition.

#### Entity: Trip

See TR-009 section 3.6 for full definition.

#### Entity: TripDay

See TR-009 section 3.6 for full definition.

#### Entity: PlannedWaypoint

See TR-009 section 3.6 for full definition.

#### Entity: MapRegion

See TR-006 section 3.6 for full definition.

#### Entity: CachedTile

See TR-006 section 3.6 for full definition.

#### Entity: PrivacyZone

See TR-017 section 3.6 for full definition.

#### Entity: SharingSession

See TR-011 section 3.6 for full definition.

#### Entity: Badge

See TR-012 section 3.6 for full definition (static reference data, 90 records).

#### Entity: EarnedBadge

See TR-012 section 3.6 for full definition.

#### Entity: PackingList

See TR-018 section 3.6 for full definition.

#### Entity: PackingItem

See TR-018 section 3.6 for full definition.

#### Entity: Segment

See TR-019 section 3.6 for full definition.

#### Entity: SegmentEffort

See TR-019 section 3.6 for full definition.

#### Entity: WeatherCache

See TR-013 section 3.6 for full definition.

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Track -> TrackPoint | one-to-many | A track contains many GPS sample points |
| Track -> GeoPhoto | one-to-many | A track has many geotagged photos |
| Track -> Waypoint | one-to-many | A track has many named waypoints |
| Track -> SharingSession | one-to-zero-or-one | A track has at most one active sharing session |
| Track -> SegmentEffort | one-to-many | A track may have efforts on multiple segments |
| Trip -> TripDay | one-to-many | A trip contains multiple day entries |
| TripDay -> PlannedWaypoint | one-to-many | Each trip day has planned route waypoints |
| TripDay -> Track | many-to-one (optional) | A trip day can link to an actual recorded track |
| MapRegion -> CachedTile | one-to-many | A downloaded region contains many tiles |
| Segment -> SegmentEffort | one-to-many | A segment has many recorded efforts |
| Badge -> EarnedBadge | one-to-one | Each badge can be earned once |
| EarnedBadge -> Track | many-to-one (optional) | An earned badge may reference the triggering track |
| PackingList -> PackingItem | one-to-many | A packing list contains many items |
| PackingList -> Trip | many-to-one (optional) | A packing list belongs to a trip (or is a template) |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| TrackPoint | track_timestamp | (track_id, timestamp) | Ordered point retrieval within a track |
| TrackPoint | track_segment | (track_id, segment_index) | Segment-based queries |
| Track | started_at | (started_at) | Sort tracks by date |
| Track | activity_type | (activity_type) | Filter by activity type |
| Track | distance | (distance_m) | Filter by distance range |
| Track | elevation | (elevation_gain_m) | Filter by elevation range |
| Track | difficulty | (difficulty_rating) | Filter by difficulty |
| Track | fts_name_notes | FTS5(name, notes) | Full-text search |
| GeoPhoto | track_captured | (track_id, captured_at) | Photos for a track in order |
| Waypoint | track_id | (track_id) | Waypoints for a track |
| Waypoint | category | (category) | Filter by category |
| Waypoint | fts_name | FTS5(name, notes) | Full-text search |
| Trip | start_date | (start_date) | Sort trips by date |
| Trip | fts_name | FTS5(name, destination, notes) | Full-text search |
| TripDay | trip_day | (trip_id, day_number) | Ordered days within a trip |
| PlannedWaypoint | day_sequence | (trip_day_id, sequence_number) | Ordered waypoints within a day |
| CachedTile | tile_coords | (zoom, tile_x, tile_y) UNIQUE | Fast tile lookup |
| CachedTile | region | (region_id) | Delete by region |
| CachedTile | lru | (last_accessed_at) | LRU eviction |
| PrivacyZone | enabled | (is_enabled) | Active zone lookup |
| SharingSession | track | (track_id) | Session by track |
| SharingSession | url | (share_url) | Lookup by URL |
| SegmentEffort | segment_time | (segment_id, elapsed_time_ms) | Leaderboard |
| SegmentEffort | track | (track_id) | Efforts for a track |
| EarnedBadge | badge | (badge_id) UNIQUE | One earning per badge |
| PackingItem | list_category | (packing_list_id, category, sort_order) | Ordered items |

### 4.5 Table Prefix

**MyLife hub table prefix:** `tr_`

All table names in the SQLite database are prefixed to avoid collisions with other modules in the MyLife hub. Examples:
- `tr_tracks`
- `tr_track_points`
- `tr_geo_photos`
- `tr_waypoints`
- `tr_trips`
- `tr_trip_days`
- `tr_planned_waypoints`
- `tr_map_regions`
- `tr_cached_tiles`
- `tr_privacy_zones`
- `tr_sharing_sessions`
- `tr_badges`
- `tr_earned_badges`
- `tr_packing_lists`
- `tr_packing_items`
- `tr_segments`
- `tr_segment_efforts`
- `tr_weather_cache`

### 4.6 Migration Strategy

- Tables are created on module enable. Schema version is tracked in a module_migrations table (`tr_migrations`).
- Each migration has a version number, description, and SQL statements.
- Migrations run sequentially on module enable and on app update.
- Data from standalone MyTrails app (future) can be imported via the MyLife data importer.
- Destructive migrations (column removal, table drop) are deferred to major versions only.
- TrackPoint data is the largest table (potentially millions of rows). Migrations on TrackPoint must be non-blocking (no full table scans during migration).
- CachedTile data (binary blobs) is stored in a separate SQLite database file (`tr_tiles.sqlite`) to keep the main database performant.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Record | Circle (record button) | Recording Screen | Start, pause, resume, and stop GPS recording |
| Trails | List/path icon | Trail History | Chronological list of all recorded activities |
| Search | Magnifying glass | Search | Full-text and geographic search across all data |
| Stats | Bar chart | Stats Dashboard | Aggregate statistics, personal records, badges |
| Settings | Gear | Settings | App preferences, privacy zones, offline maps, import/export |

### 5.2 Navigation Flow

```
[Tab 1: Record]
  ├── Pre-Recording (activity type, sharing setup, route guidance)
  └── Active Recording
        ├── Camera (geotagged photo capture)
        ├── Waypoint Quick-Entry
        └── End Activity -> Trail Detail

[Tab 2: Trails]
  ├── Trail History Log (filterable list)
  │     └── Trail Detail
  │           ├── Route Map (full-screen expandable)
  │           ├── Elevation Profile
  │           ├── Photo Gallery -> Full-Screen Viewer
  │           ├── Waypoints on Map
  │           ├── Segment Efforts
  │           ├── Difficulty Rating Selector
  │           └── Export GPX
  ├── Trips List
  │     └── Trip Detail
  │           ├── Day Detail -> Route Planner
  │           ├── Packing List -> Packing Checklist
  │           ├── Weather Forecast Cards
  │           └── Map Overlay (all days)
  └── Waypoints List (list + map view)

[Tab 3: Search]
  ├── Text Search (live results)
  ├── Advanced Filters (bottom sheet)
  ├── Geographic Search (map circle)
  └── Results -> Trail Detail

[Tab 4: Stats]
  ├── Stats Dashboard
  │     ├── Period Stats (week/month/year/all/custom)
  │     ├── Activity Frequency Chart
  │     ├── Personal Records -> Trail Detail
  │     └── Activity Type Breakdown
  ├── Badges Screen
  │     └── Badge Detail (popup)
  └── Segments List
        └── Segment Detail (leaderboard, trend chart)

[Tab 5: Settings]
  ├── Privacy Zones
  │     └── Zone Editor (map + radius)
  ├── Downloaded Maps
  │     └── Download Region (map + zoom selector)
  ├── Import GPX
  │     └── Import Preview
  ├── Units (metric/imperial)
  ├── Live Sharing Preferences
  └── About / Data Management
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Pre-Recording | `/record` | Configure activity type, sharing, route guidance before starting | Tab 1 tap, "Record" buttons from empty states |
| Active Recording | `/record/active` | Live GPS recording with map and stats | Start button on pre-recording |
| Trail History | `/trails` | Chronological list of activities | Tab 2 tap |
| Trail Detail | `/trails/:id` | Complete activity review with map, stats, photos | Tap history card, search result, badge record |
| Route Map (full-screen) | `/trails/:id/map` | Expanded interactive route map | Expand button on trail detail map |
| Trip List | `/trails/trips` | Upcoming and past trip itineraries | Trips section on Tab 2 |
| Trip Detail | `/trails/trips/:id` | Trip overview with days, routes, weather | Tap trip card |
| Route Planner | `/trails/trips/:id/day/:dayId` | Waypoint-based route planning on map | Tap trip day card |
| Packing Checklist | `/trails/trips/:id/packing` | Trip packing list with checkboxes | "Packing List" on trip detail |
| Waypoints List | `/trails/waypoints` | All waypoints across tracks | Waypoints section on Tab 2 |
| Search | `/search` | Text and geographic search | Tab 3 tap |
| Stats Dashboard | `/stats` | Aggregate stats and period analytics | Tab 4 tap |
| Badges | `/stats/badges` | Achievement badge grid and progress | Stats dashboard link |
| Segments List | `/stats/segments` | All user-defined segments | Stats dashboard link |
| Segment Detail | `/stats/segments/:id` | Segment leaderboard and trends | Tap segment card |
| Settings | `/settings` | App configuration | Tab 5 tap |
| Privacy Zones | `/settings/privacy-zones` | Manage privacy zones | Settings menu item |
| Zone Editor | `/settings/privacy-zones/:id` | Create/edit a privacy zone | Add/edit on privacy zones |
| Downloaded Maps | `/settings/offline-maps` | Manage downloaded map regions | Settings menu item |
| Download Region | `/settings/offline-maps/download` | Download map tiles for a region | "Download" on downloaded maps |
| Import GPX | `/settings/import` | Import GPX files | Settings menu item |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://trails/record` | Pre-Recording Screen | None |
| `mylife://trails/:id` | Trail Detail | id: Track UUID |
| `mylife://trails/trips/:id` | Trip Detail | id: Trip UUID |
| `mylife://trails/stats` | Stats Dashboard | None |
| `mylife://trails/badges` | Badges Screen | None |
| `mylife://trails/search?q=:query` | Search with query | query: search string |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Outdoor activity as workout | Trails | Workouts | Trails sends activity type, duration, distance, elevation gain, calories estimate | On recording save |
| Trail activity as health data | Trails | Health | Trails sends outdoor activity duration, distance, active minutes | On recording save |
| Outdoor frequency as habit | Trails | Habits | Trails reports whether an outdoor activity was recorded today | On recording save |
| Trip expense tracking | Trails | Budget | Trails provides trip context; Budget links spending to a trip ID | User manually links expenses to trip |
| Trail meal planning | Trails | Recipes | Trails provides trip duration and camping flag; Recipes suggests trail-friendly meals | User opens meal planner from trip detail |

**Calorie estimation for workout integration:**

```
Calories = MET * weight_kg * duration_hours
MET values by activity type:
  hike (moderate): 6.0
  hike (hard/expert): 8.0
  run: 9.8
  bike: 7.5
  walk: 3.5
  other: 5.0
Default weight: 70 kg (user-configurable in profile)
```

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Track and TrackPoint data | Local SQLite (`tr_` tables) | At rest (OS-level) | No | GPS history never leaves device unless user exports |
| Geotagged photos | Local file system | At rest (OS-level) | No | Photos stored as JPEG files, never uploaded |
| Waypoint data | Local SQLite | At rest (OS-level) | No | Location markers stored locally |
| Trip plans | Local SQLite | At rest (OS-level) | No | Itineraries stored locally |
| Offline map tiles | Local SQLite/files (`tr_tiles.sqlite`) | No | No | Publicly available OSM tile images |
| Privacy zone definitions | Local SQLite | At rest (OS-level) | No | Sensitive (reveal protected locations); OS-level encryption |
| Weather cache | Local SQLite | No | No | Publicly available forecast data |
| Sharing session metadata | Local SQLite + relay server (in-memory) | HTTPS in transit | Relay only | Relay holds only latest position, no history, auto-deletes |
| Badge data | Local SQLite | No | No | Gamification state, no sensitive data |
| Packing lists | Local SQLite | No | No | Gear checklists, no sensitive data |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Map tile fetch | Load map imagery | Tile coordinates (z/x/y), User-Agent header | PNG tile image | Implicit (user views map) |
| Map tile bulk download | Download offline region | Tile coordinates, User-Agent header | PNG tile images | Explicit (user initiates download) |
| Weather forecast | Display conditions | Latitude, longitude (rounded to 2 decimals) | JSON weather data | Implicit (user views weather) |
| Live location sharing | Safety feature | Current lat/lon, elevation, battery % | Share URL confirmation | Explicit (user enables sharing) |
| Overdue alert SMS | Safety notification | Alert message with last known position | SMS delivery status | Explicit (user sets return time) |

### 7.3 Data That Never Leaves the Device

- Complete GPS track history (all TrackPoints)
- Geotagged photo files
- Waypoint locations and notes
- Trip plans and itineraries
- User ratings and difficulty assessments
- Activity statistics and personal records
- Badge progress and earned achievements
- Packing list contents
- Segment definitions and performance history
- Privacy zone locations (these are especially sensitive, as they typically mark home/work)
- Search queries and recent search history
- User preferences and settings

### 7.4 User Data Ownership

- **Export:** Users can export all data as GPX (tracks), JSON (trips, waypoints, settings), or CSV (stats summary)
- **Delete:** Users can delete all module data from Settings with a single action (irreversible, confirmation dialog with typed confirmation "DELETE")
- **Selective Delete:** Users can delete individual tracks, trips, waypoints, photos, segments, or badges
- **Portability:** GPX is the universal standard for GPS data; any competing app can import MyTrails exports
- **Privacy Zone Transparency:** Users can see exactly what data is removed by privacy zones before exporting (preview mode)

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Location permission | Required for recording; app explains why before requesting | Foreground and background permission requested separately |
| Camera permission | Required for geotagged photos only | Requested on first camera use, not at app launch |
| Contacts permission | Required for live sharing contact selection | Requested on first sharing setup |
| Photo library permission | Required for attaching existing photos | Requested on first library access |
| Share URL expiry | Live sharing URLs expire 24 hours after session ends | Prevents stale links from being usable |
| Relay server data retention | Zero retention: only latest position held in-memory | No GPS history stored on any server |
| Privacy zone enforcement | Zones applied automatically on all export operations | User can override per-export with explicit toggle |
| Overdue alert rate limiting | Maximum 1 overdue alert per sharing session | Prevents SMS spam |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Activity | A single recorded outdoor session (hike, run, bike, walk, or other) |
| Bounding Box | A geographic rectangle defined by northeast and southwest corners that encloses all points of a route |
| Corridor | A geographic buffer zone around a reference route used for segment matching; default width is 50 meters |
| Effort | A single traversal of a defined segment, with associated timing and performance metrics |
| Elevation Gain | The cumulative positive elevation change during an activity, calculated with a 3-meter noise filter to suppress GPS altitude jitter |
| Elevation Profile | A 2D chart plotting elevation (y-axis) against distance from start (x-axis) for a recorded or planned route |
| FTS5 | SQLite full-text search extension version 5, used for efficient text search on track names, notes, and waypoint data |
| Geotagging | The process of attaching GPS coordinates to a photo, linking it to a specific location on the route |
| GPX | GPS Exchange Format, an XML-based standard for sharing GPS data between applications. MyTrails uses GPX 1.1. |
| Gradient | The slope percentage between two points, calculated as (elevation change / horizontal distance) * 100. Positive values indicate uphill. |
| Haversine Formula | A formula for calculating the great-circle distance between two points on a sphere given their latitudes and longitudes: d = 2R * arcsin(sqrt(sin^2(dlat/2) + cos(lat1) * cos(lat2) * sin^2(dlon/2))) |
| LRU | Least Recently Used, a cache eviction policy that removes the oldest-accessed items first |
| Naismith's Rule | A hiking time estimation formula: 5 km/h on flat terrain plus 1 hour per 600 meters of elevation gain |
| Noise Filter | A threshold (3 meters for elevation) below which changes are ignored to suppress sensor noise |
| Pace | Time per unit distance, typically expressed as minutes:seconds per kilometer or mile. The primary speed metric for hiking and running. |
| Personal Record (PR) | The best performance on a specific metric (fastest segment time, longest distance, most elevation gain, etc.) |
| Privacy Zone | A circular geographic area defined by the user where GPS data is automatically removed from exports to protect sensitive locations |
| Relay Server | A lightweight server that temporarily holds the latest GPS position during live location sharing; stores no historical data |
| Segment | A named section of trail defined by start and end points, used for tracking performance across multiple visits |
| Slippy Map | A map display convention using 256x256 pixel tiles addressed by zoom level and x,y coordinates, following the OpenStreetMap standard |
| TrackPoint | A single GPS sample captured during recording, containing latitude, longitude, elevation, timestamp, and accuracy data |
| Waypoint | A named geographic marker placed on a route during or after recording, categorized by type (water source, campsite, viewpoint, etc.) |
| WGS84 | World Geodetic System 1984, the standard coordinate reference system used by GPS. All coordinates in MyTrails use WGS84 decimal degrees. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification - Sections 1-2, features TR-001 through TR-007 |
| 1.1 | 2026-03-07 | Claude (Spec Writer Agent) | Complete specification - Features TR-008 through TR-020, Sections 4-8 |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should turn-by-turn voice navigation be added as a future feature? | Komoot's key differentiator. High implementation complexity (requires routing engine). | Deferred to v2.0 roadmap | - |
| 2 | Should the relay server for live sharing be self-hosted or use a managed service? | Affects privacy guarantees and operational complexity | Pending architecture decision | - |
| 3 | Should trail database integration (OpenStreetMap trail data) be included in the MVP? | AllTrails has 400K+ trails. Starting from zero trail data is a gap. | Deferred to v2.0 per roadmap | - |
| 4 | Should segment matching support directional matching (uphill only vs. both directions)? | Strava segments are directional. Some users may want uphill-only segments for climbing challenges. | Pending user feedback | - |
| 5 | Should the weather API be configurable (allow users to swap Open-Meteo for another provider)? | Reduces vendor lock-in but adds complexity | Pending | - |
