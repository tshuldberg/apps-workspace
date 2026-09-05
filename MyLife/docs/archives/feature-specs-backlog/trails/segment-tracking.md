# Feature Spec: Segment Tracking

## Metadata
- **Module:** trails
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [2] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 6
- **Estimated CC Time:** 2-3 hours (Complexity Inverse = 2, "Large")
- **Depends On:** GPS trail recording (V1), waypoints, geo engine
- **Blocks:** none

## Business Context

### Why This Feature Exists
Strava popularized the concept of "segments" -- defined sections of a trail where users can track and compare their performance over time. A steep hill climb, a fast descent, or a technical section becomes a named segment with personal bests and effort history. Segment tracking transforms a simple trail recording into a performance tool, especially for trail runners and competitive hikers. It answers the question: "Am I getting faster on this hill?" without requiring external analysis. AllTrails doesn't have segments (their focus is discovery, not performance), which makes this a differentiator for MyTrails against both AllTrails (adds performance tracking they lack) and Strava (adds trail-specific context Strava lacks).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Strava | Yes | Yes ($79.99/yr) | User-created segments on any road/trail. Leaderboards, personal bests, effort analysis. 120M+ users. Segments are the core engagement mechanic. |
| AllTrails | No | N/A | No segment concept. Tracks full-trail stats only. No split or section-level analysis. |
| Komoot | No | N/A | Highlights on routes (scenic points, danger) but no timed segments for performance tracking. |
| Gaia GPS | No | N/A | No segment tracking. Raw GPS data only; users export to Strava for segment analysis. |

### Target User
Trail runners (22-38) who run the same trails regularly and want to track improvement on specific climbs or sections. Competitive hikers who challenge themselves on steep ascents. Strava free-tier users who lost segment leaderboard access when Strava moved it behind the paywall in 2020. Users who want personal-best tracking on their local trails without Strava's social pressure and public data sharing.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New Segment, SegmentEffort, CreateSegmentInput schemas
  db/schema.ts                  -- New tr_segments, tr_segment_efforts tables (migration V5)
  db/crud.ts                    -- CRUD for segments and efforts
  engine/
    segment-matcher.ts          -- NEW: match recording waypoints to segment boundaries
  definition.ts                 -- Add V5 migration, bump schemaVersion
  index.ts                      -- Export new segment functions and types

apps/mobile/app/(trails)/
  recording.tsx                 -- Updated: segment entry/exit notifications during recording
  trail-detail.tsx              -- Updated: segment list on trail detail
  segment-detail.tsx            -- NEW: segment history with personal bests

apps/web/app/trails/
  page.tsx                      -- Updated: segment list and effort history
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Trails tab
            └── Trail Detail screen
                 └── Segments section ← list of segments on this trail
                      └── Segment Detail ← effort history, personal best
       └── Recordings tab
            └── Recording Detail
                 └── Segment Efforts ← segments hit during this recording
```

### Data Model

```sql
-- Migration V5: Segment tracking
CREATE TABLE IF NOT EXISTS tr_segments (
  id TEXT PRIMARY KEY NOT NULL,
  trail_id TEXT NOT NULL REFERENCES tr_trails(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_lat REAL NOT NULL,
  start_lng REAL NOT NULL,
  end_lat REAL NOT NULL,
  end_lng REAL NOT NULL,
  distance_meters REAL NOT NULL DEFAULT 0,
  elevation_gain_meters REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tr_segment_efforts (
  id TEXT PRIMARY KEY NOT NULL,
  segment_id TEXT NOT NULL REFERENCES tr_segments(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL REFERENCES tr_recordings(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL,
  pace_min_per_km REAL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  is_personal_best INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_segments_trail ON tr_segments(trail_id);
CREATE INDEX IF NOT EXISTS idx_tr_segment_efforts_segment ON tr_segment_efforts(segment_id);
CREATE INDEX IF NOT EXISTS idx_tr_segment_efforts_recording ON tr_segment_efforts(recording_id);
CREATE INDEX IF NOT EXISTS idx_tr_segment_efforts_pb ON tr_segment_efforts(segment_id, is_personal_best);
```

### Dependencies
- **Internal:** `@mylife/trails` (trails, recordings, waypoints, geo engine haversineDistance), `@mylife/db` (DatabaseAdapter)
- **External:** None. All computation is local.
- **Cross-Module:** Workouts module has a similar concept (workout splits/intervals). A future cross-module effort could share a segment abstraction. Score: 2 (mild future benefit).

## Functional Requirements

### User Stories
1. As a trail runner, I want to define a segment on a hill I run regularly so that I can track my climb time and see if I'm improving.
2. As a hiker reviewing a recording, I want to see which segments I passed through and my effort on each so that I can analyze my performance section by section.
3. As a user, I want to see my personal best time on each segment so that I have a clear goal to beat.
4. As a competitive hiker, I want to be notified during a recording when I enter and exit a segment so that I can push harder on tracked sections.

### Behavior Specification

**Creating a segment:**
1. User opens a trail detail screen
2. User taps "Add Segment"
3. User selects a start point and end point from the trail's recorded waypoints (map picker or list)
4. System calculates distance and elevation gain between the two points
5. User names the segment (e.g., "Summit Push," "Ridge Climb")
6. Segment is saved and appears in the trail's segment list

**Segment matching during recording:**
1. User starts a recording on a trail that has defined segments
2. On each GPS update, the segment matcher checks if the user's position is within the entry radius (30m) of any segment start point
3. When user enters a segment: brief notification ("Entering: Summit Push") and timer starts
4. When user reaches the segment end point (within 30m): timer stops, effort is recorded
5. If effort is faster than all previous efforts on this segment, it's marked as a personal best with a celebration notification

**Viewing segment efforts:**
1. Trail detail screen shows a "Segments" section listing all segments with:
   - Segment name, distance, elevation gain
   - Personal best time
   - Number of efforts
2. Tapping a segment opens segment detail with:
   - Effort history (chronological list with time, pace, date)
   - Personal best highlighted
   - Improvement trend (are recent efforts faster or slower?)

### Edge Cases

- **Recording without passing through a segment:** Not all recordings will hit all segments. Only record efforts for segments the user actually passed through.
- **Segment start/end point GPS accuracy:** Use a 30m radius for start/end detection to account for GPS drift. If the user passes within 30m of the start but GPS jitter puts them at 31m, they might miss the segment. Consider the effective threshold from GPS accuracy.
- **Walking the segment in reverse:** Track direction by requiring the user to hit start before end. If they hit end first, no effort is recorded (they're going the opposite direction).
- **Multiple segments on the same trail:** Segments can overlap. The matcher checks all segments independently. A user can be "in" multiple segments simultaneously.
- **Very short segment (<100m):** Allow it but warn that GPS accuracy may affect timing. Minimum segment length: 50m.
- **Segment on a trail with no previous recordings:** Segments require at least one recorded track to define start/end points from waypoints. Show "Record this trail first" if no recordings exist.
- **Deleting a trail:** Cascades to delete all segments and efforts (ON DELETE CASCADE).
- **Deleting a recording:** Cascades to delete efforts from that recording. Does not affect segment definitions or other recordings' efforts. Personal best status is recalculated.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can create a named segment on a trail by selecting start and end points
- [ ] **AC-2:** Trail detail screen lists all segments with name, distance, elevation, and personal best time
- [ ] **AC-3:** During a recording, user sees a notification when entering a segment
- [ ] **AC-4:** During a recording, user sees effort time when exiting a segment
- [ ] **AC-5:** Personal best efforts are highlighted with a distinct visual indicator
- [ ] **AC-6:** Segment detail shows chronological effort history with pace and date
- [ ] **AC-7:** New personal best triggers a celebration notification during recording
- [ ] **AC-8:** Recording detail shows all segment efforts from that recording

### Technical Criteria
- [ ] **TC-1:** `tr_segments` and `tr_segment_efforts` tables are created by migration V5
- [ ] **TC-2:** Segment matcher correctly detects entry/exit within 30m radius
- [ ] **TC-3:** Personal best is recalculated when a recording with the current PB is deleted
- [ ] **TC-4:** Segment matching processes in <5ms per GPS update
- [ ] **TC-5:** Direction is enforced: segment must be traversed start-to-end

### Negative Criteria
- [ ] **NC-1:** Segment tracking must NOT require network (all computation on-device)
- [ ] **NC-2:** Segment efforts must NOT be shared publicly or uploaded to any server
- [ ] **NC-3:** Deleting a segment must NOT affect the underlying trail or recordings
- [ ] **NC-4:** Segments must NOT be auto-created without user action

## UI Specification

### Mobile (Expo)

**Segment List (trail detail):**
- Section below trail stats
- Glass card per segment: name, distance pill, elevation pill, PB time (bold)
- Effort count badge: "12 efforts"
- Tap to open segment detail

**Segment Detail:**
- Header: segment name, distance, elevation gain
- Personal best card: highlighted with lime accent `#65A30D`, time in `stat` variant (36px)
- Effort list: glass cards, each showing date, time, pace, delta from PB
- Improvement indicator: green arrow (faster) or red arrow (slower) vs previous effort

**During Recording (segment notifications):**
- Entry: toast notification at top, "Entering: [Name]" with lime accent
- Exit: toast with effort time, "Summit Push: 12:34" + PB indicator if applicable
- PB celebration: brief confetti-style animation with "New Personal Best!" text

### Web (Next.js)

- Segments section in trail detail sidebar
- Effort history as a sortable table
- No live segment matching on web (recording is mobile-only)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty | "Add your first segment" + CTA button | Trail has no segments |
| Loading | Skeleton cards for segment list | Initial segment fetch |
| Success | List of segments with PB times and effort counts | Segments exist |
| Recording | Entry/exit toasts during active recording | GPS enters/exits segment bounds |
| PB | Celebration notification with new time | New personal best achieved |

## Test Requirements

### Unit Tests
- [ ] `createSegment`: creates with correct distance and elevation
- [ ] `getSegmentsByTrail`: returns all segments for a trail
- [ ] `createSegmentEffort`: records effort with correct duration
- [ ] `getEffortsBySegment`: returns efforts ordered chronologically
- [ ] `getPersonalBest`: returns fastest effort for a segment
- [ ] `isWithinRadius(point, target, radius)`: correctly detects entry/exit at 30m
- [ ] `isWithinRadius`: handles GPS coordinates correctly (haversine, not Euclidean)
- [ ] `matchSegment(position, segments)`: returns matching segment on entry
- [ ] `matchSegment`: handles multiple overlapping segments
- [ ] `matchSegment`: enforces direction (start before end)
- [ ] `recalculatePersonalBest`: updates PB flag after effort deletion
- [ ] Segment with 0 efforts shows no PB

### Integration Tests
- [ ] Full flow: create segment -> record trail -> match segment -> effort recorded with PB
- [ ] PB flow: record faster effort -> verify PB flag moves to new effort
- [ ] Delete flow: delete recording with PB -> verify PB recalculated to next-fastest
- [ ] Cascade: delete trail -> verify segments and efforts all deleted

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to a trail with a previous recording
3. Tap "Add Segment," select start and end points, name it "Test Climb"
4. Verify: segment appears in trail detail with distance and elevation -- corresponds to AC-1, AC-2
5. Start a new recording on this trail
6. Simulate GPS moving through the segment start point
7. Verify: "Entering: Test Climb" notification appears -- corresponds to AC-3
8. Simulate GPS moving through the segment end point
9. Verify: effort time shown in exit notification -- corresponds to AC-4
10. Open the recording detail
11. Verify: "Test Climb" effort listed with time -- corresponds to AC-8
12. Open segment detail
13. Verify: effort listed with PB indicator (first effort = automatic PB) -- corresponds to AC-5, AC-6
14. Record the trail again with a faster time through the segment
15. Verify: "New Personal Best!" celebration notification -- corresponds to AC-7

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to segment list, segment detail, verify all states

### Required: Complexity <= 2 (this feature is Complexity 2 = Large):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Validate segment matching performance.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for segment-matcher engine

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Trails module records full-trail stats (total distance, elevation, duration)
- No section-level analysis or named segments
- Geo engine has haversine distance for point-to-point checks

### After This Work
- New V5 migration adds `tr_segments` and `tr_segment_efforts` tables
- New `engine/segment-matcher.ts` with radius detection and direction enforcement
- Trail detail shows segment list with personal bests
- Recording detects segment entry/exit and records efforts
- Segment detail shows effort history with improvement trends

### Files Changed
- `modules/trails/src/types.ts` -- New `Segment`, `SegmentEffort`, `CreateSegmentInput` schemas
- `modules/trails/src/db/schema.ts` -- V5 migration SQL for segments and efforts tables
- `modules/trails/src/db/crud.ts` -- CRUD for segments and efforts
- `modules/trails/src/engine/segment-matcher.ts` -- Segment entry/exit detection, direction enforcement
- `modules/trails/src/definition.ts` -- Add V5 migration, bump schemaVersion
- `modules/trails/src/index.ts` -- Export new segment functions
- `apps/mobile/app/(trails)/trail-detail.tsx` -- Segment list section
- `apps/mobile/app/(trails)/recording.tsx` -- Segment entry/exit notifications
- `apps/mobile/app/(trails)/segment-detail.tsx` -- Effort history screen
- `apps/web/app/trails/page.tsx` -- Segment list and effort history

### Known Limitations
- **No public leaderboards:** Unlike Strava, segments are private. Only the user's own efforts are tracked. Community/social segments are a future feature.
- **No auto-segment detection:** Segments must be manually created by the user. Automatic detection of "interesting" sections (steepest climb, fastest descent) is a future enhancement.
- **Direction-dependent only:** Segments track one direction. An out-and-back on the same section records only the direction matching start-to-end.

### Context for Next Agent
- Use `haversineDistance` from `engine/geo.ts` for the 30m radius check. Do NOT use Euclidean distance on lat/lng (it's wrong at non-equatorial latitudes).
- The segment matcher needs to run on every GPS update (1Hz). Keep it under 5ms. With typically <10 segments per trail, a simple loop is fine; no spatial indexing needed at this scale.
- Personal best recalculation: when deleting a recording that held the PB, query all remaining efforts for that segment, find the fastest, and update its `is_personal_best` flag.
