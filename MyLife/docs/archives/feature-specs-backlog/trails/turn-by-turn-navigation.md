# Feature Spec: Turn-by-Turn Navigation

## Metadata
- **Module:** trails
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [4] x3 + Complexity [0] x2 + CrossModule [1] x1 + PaidUser [4] x1
- **Sprint:** 7
- **Estimated CC Time:** 4-5 hours (Complexity Inverse = 0, "Massive")
- **Depends On:** Offline map downloads (V2), wrong-turn alerts (V3, deviation detection engine), route geofence
- **Blocks:** none

## Business Context

### Why This Feature Exists
Komoot's turn-by-turn voice navigation is their most-loved feature, driving conversions from free to paid. Hikers and cyclists get spoken directions ("Turn left in 200 meters") at decision points, eliminating the need to constantly check the phone screen. This is especially valuable for cyclists (phone is mounted, can't easily look at screen), trail runners (moving too fast to check map), and hikers in low-visibility conditions (fog, night, dense forest). Wrong-turn alerts (V3, already built) detect when users stray from the route, but they're reactive. Turn-by-turn navigation is proactive: it tells you where to go before you reach the junction. Combined with offline maps and wrong-turn alerts, this completes the core navigation safety trio that justifies MyTrails as a premium module.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Komoot | Yes | Yes ($29.99 one-time) | Voice turn-by-turn with distance countdown. Works offline. Adapts to sport type (cycling gets different prompts than hiking). 35M+ users. |
| AllTrails | No | N/A | No turn-by-turn. Shows route on map; user must manually follow. Wrong-turn alerts only. |
| Gaia GPS | No | N/A | No navigation. Shows route overlay only. Power users use a dedicated GPS device for navigation. |
| Google Maps | Partial | Free | Driving/walking turn-by-turn but not trail-aware. Routes to roads, not trails. Useless in backcountry. |

### Target User
Komoot users ($30 one-time) who want voice navigation on trails without uploading data to Komoot's servers. Cyclists using phone mounts who need audio cues at turns. Trail runners moving at pace who can't check the screen at every junction. Hikers in areas with confusing trail junctions (dense forest, unmaintained trails with multiple use paths). Users who already have wrong-turn alerts and want the proactive complement.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New NavigationInstruction, TurnType, NavigationState schemas
  engine/
    navigation-engine.ts        -- NEW: instruction generation from route waypoints
    turn-detector.ts            -- NEW: junction detection, turn type classification
  definition.ts                 -- No new migration (uses existing tables + in-memory state)
  index.ts                      -- Export new navigation functions and types

apps/mobile/app/(trails)/
  recording.tsx                 -- Updated: navigation HUD overlay during guided recording
  trail-detail.tsx              -- Updated: "Navigate" button (starts guided recording with voice nav)

apps/web/app/trails/
  page.tsx                      -- Updated: navigation instruction preview (read-only, no live nav)
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Trail Detail
            └── "Navigate This Trail" button
                 └── Navigation HUD ← active during guided recording
                      ├── Next turn card (direction, distance countdown)
                      ├── Route overview mini-map
                      └── Voice announcements at approach distance
```

### Data Model

No new tables required. Navigation instructions are computed in real-time from the trail's existing waypoint data (`tr_waypoints`). The navigation engine generates instructions on-the-fly by analyzing direction changes in the waypoint sequence.

Navigation state is held in-memory during an active recording session:
- Current instruction index
- Distance to next turn
- Voice announcement queue
- Route progress percentage

### Dependencies
- **Internal:** `@mylife/trails` (waypoints, recordings, geo engine, deviation detector, route geofence), `@mylife/db` (DatabaseAdapter)
- **External:**
  - Mobile: `expo-speech` for text-to-speech voice announcements
  - Mobile: `expo-location` for continuous GPS (already used for recordings)
  - Mobile: `expo-haptics` for haptic feedback at turns (already used for wrong-turn alerts)
- **Cross-Module:** None (score: 1).

## Functional Requirements

### User Stories
1. As a hiker on an unfamiliar trail, I want voice directions at each turn so that I can keep my phone in my pocket and focus on the scenery.
2. As a cyclist with a phone mount, I want audio announcements 200m before each turn so that I can slow down and navigate safely.
3. As a trail runner, I want brief, clear turn cues ("left in 100 meters") so that I don't miss junctions at speed.
4. As a hiker in fog, I want both voice and haptic feedback at turns so that I know when to change direction even if I can't hear well (wind).
5. As a privacy-conscious user, I want navigation to work entirely on-device without sending my route or position to any server.

### Behavior Specification

**Starting navigation:**
1. User opens a trail detail screen for a trail with recorded waypoints
2. User taps "Navigate This Trail"
3. System generates navigation instructions from the trail's waypoint sequence
4. Recording starts with navigation overlay active
5. Map shows the planned route plus the live GPS track

**Instruction generation (offline, from waypoints):**
1. Analyze consecutive waypoint segments for significant direction changes (>30 degrees)
2. Classify each direction change as a turn type: slight left, left, sharp left, straight, slight right, right, sharp right, U-turn
3. Each instruction includes: turn type, direction, distance from previous instruction, description text
4. Instructions are ordered along the route from start to finish

**Live navigation during recording:**
1. On each GPS update, calculate distance to the next instruction point
2. At 200m before the next turn: voice announcement ("Turn left in 200 meters")
3. At 50m before the next turn: second announcement ("Turn left ahead") + haptic feedback
4. When user passes the turn point: advance to next instruction
5. Navigation HUD shows: next turn card (icon + distance countdown), route progress bar

**Voice announcements:**
1. Announcements use `expo-speech` with the device's default language
2. Format: "[Turn type] in [distance]" then "[Turn type] ahead" at the approach
3. Volume follows device volume settings
4. User can mute voice (haptic-only mode) or disable navigation audio entirely
5. Announcements are not made if the user is stopped (speed < 0.5 m/s) to avoid spam at rest stops

**Navigation HUD:**
1. Overlay at the top of the map during navigation
2. Next turn card: large turn arrow icon + "Turn left in 180m" text
3. Route progress bar: thin lime bar showing % of route completed
4. Distance remaining to end of trail
5. Estimated time remaining (based on current pace)

### Edge Cases

- **No waypoints available:** If the trail has no recorded waypoints, "Navigate This Trail" button is disabled with tooltip "Record this trail first to enable navigation."
- **Sparse waypoints:** If waypoints are very sparse (>500m apart), navigation instructions may miss intermediate turns. The route geofence builder (already implemented) interpolates sparse sections, but interpolated points don't represent real junctions. Show a warning: "Navigation may be less accurate on trails with sparse GPS data."
- **Very winding trail:** On switchbacks, multiple turns occur in rapid succession. Batch announcements: if next turn is <50m after the current one, combine into "Turn right, then immediately turn left."
- **User deviates from route:** Wrong-turn alerts (V3) handle deviation. Navigation pauses ("Recalculating...") and resumes when user returns on-route. Do not generate new instructions to an off-route position.
- **GPS signal loss:** In tunnels or deep canyons, GPS may drop. Navigation shows "GPS signal lost" and pauses instruction advancement. Resumes automatically when GPS returns.
- **User reaches end of route:** Final instruction: "You have arrived at [trail name]." Navigation overlay dismisses. Recording continues if user wants.
- **User starts mid-route:** If user starts recording partway along the trail, navigation finds the nearest instruction point and begins from there, not from the start.
- **Offline operation:** Navigation is entirely on-device. Waypoints are in local SQLite, instructions generated locally, speech synthesis is on-device. Works in airplane mode.
- **Background audio:** Voice announcements should play even if another audio app is active (music). Use `expo-av` audio session mixing if needed.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can tap "Navigate This Trail" to start a guided recording with voice navigation
- [ ] **AC-2:** Navigation HUD shows next turn with direction icon and distance countdown
- [ ] **AC-3:** Voice announcement plays at 200m before each turn
- [ ] **AC-4:** Second voice announcement + haptic plays at 50m before each turn
- [ ] **AC-5:** After passing a turn, HUD advances to show the next instruction
- [ ] **AC-6:** Route progress bar shows percentage of route completed
- [ ] **AC-7:** User can mute voice announcements (haptic-only mode)
- [ ] **AC-8:** Navigation says "You have arrived" at the end of the route
- [ ] **AC-9:** If user deviates, navigation shows "Recalculating..." and resumes when on-route
- [ ] **AC-10:** Navigation works fully offline (airplane mode)

### Technical Criteria
- [ ] **TC-1:** `generateInstructions(waypoints)` produces correct turn types for >30-degree direction changes
- [ ] **TC-2:** Turn classification correctly distinguishes slight/normal/sharp turns
- [ ] **TC-3:** Instruction generation completes in <100ms for a 2000-waypoint route
- [ ] **TC-4:** Voice announcements do not play when user speed is below 0.5 m/s
- [ ] **TC-5:** Navigation correctly finds the nearest instruction when user starts mid-route

### Negative Criteria
- [ ] **NC-1:** Navigation must NOT send route, position, or instruction data to any server
- [ ] **NC-2:** Navigation must NOT generate instructions to off-route positions when user deviates
- [ ] **NC-3:** Voice announcements must NOT play when navigation is muted
- [ ] **NC-4:** Navigation must NOT require an internet connection for any functionality
- [ ] **NC-5:** Navigation battery drain must NOT exceed 20% more than a standard recording (voice + GPS + screen)

## UI Specification

### Mobile (Expo)

**Navigation HUD (during recording):**
- Overlay at top of map, below status bar
- Glass card background (`rgba(18,18,26,0.65)`) with blur
- Next turn: large directional arrow (white, 48px) + "Turn left in 180m" in `subheading` (18px)
- Distance countdown updates in real-time
- Route progress: thin horizontal bar, lime `#65A30D` fill
- Bottom row: distance remaining + ETA
- "Mute" button (speaker icon) in top-right of HUD

**Trail Detail "Navigate" button:**
- Primary CTA button: lime `#65A30D` background, white text, "Navigate This Trail"
- Disabled state: grey background, "Record trail first" tooltip

### Web (Next.js)

- Read-only instruction list in trail detail: shows all generated turns as a numbered list
- No live navigation on web (GPS recording is mobile-only)
- "Navigation instructions" section for trip planning reference

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Disabled | Grey "Navigate" button with tooltip | Trail has no waypoint data |
| Ready | Lime "Navigate" button | Trail has waypoints, navigation available |
| Active | Navigation HUD with next turn + progress | Navigation started |
| Approaching | HUD distance counting down + voice announcement | Within 200m of next turn |
| Deviation | "Recalculating..." overlay | User is off-route |
| Arrived | "You have arrived" notification | User reaches end of route |
| Muted | HUD visible, speaker icon crossed out, no voice | User tapped mute |

## Test Requirements

### Unit Tests
- [ ] `generateInstructions(waypoints)`: produces no instructions for straight path
- [ ] `generateInstructions(waypoints)`: detects left turn at >30 degrees
- [ ] `generateInstructions(waypoints)`: detects right turn at >30 degrees
- [ ] `generateInstructions(waypoints)`: classifies slight vs normal vs sharp turns
- [ ] `generateInstructions(waypoints)`: handles U-turn (>150 degrees)
- [ ] `generateInstructions(waypoints)`: handles empty/single waypoint input
- [ ] `classifyTurn(angleDegrees)`: returns correct TurnType for all ranges
- [ ] `calculateBearing(pointA, pointB)`: returns correct compass bearing
- [ ] `angleBetweenBearings(bearing1, bearing2)`: handles 360/0 wraparound
- [ ] `distanceToInstruction(currentPos, nextInstruction)`: returns correct haversine distance
- [ ] `findNearestInstruction(currentPos, instructions)`: finds closest instruction for mid-route start
- [ ] `shouldAnnounce(speed)`: returns false when speed < 0.5 m/s
- [ ] `formatAnnouncementText(instruction, distance)`: produces correct speech text

### Integration Tests
- [ ] Full navigation flow: start navigation -> advance through 3 turns -> arrive at end
- [ ] Deviation flow: navigate -> deviate -> show recalculating -> return -> resume
- [ ] Mid-route start: begin navigation halfway -> first instruction is nearest, not first
- [ ] Mute flow: start navigation -> mute -> verify no voice but HUD still updates

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to a trail with recorded waypoints (at least 3 direction changes)
3. Tap "Navigate This Trail"
4. Verify: navigation HUD appears with first instruction -- corresponds to AC-1, AC-2
5. Simulate GPS moving along the route toward the first turn
6. At 200m before the turn, verify: voice announcement plays -- corresponds to AC-3
7. At 50m before the turn, verify: second announcement + haptic -- corresponds to AC-4
8. Simulate passing the turn
9. Verify: HUD advances to next instruction -- corresponds to AC-5
10. Check the route progress bar
11. Verify: progress bar reflects approximate route completion -- corresponds to AC-6
12. Tap the mute button
13. Simulate approaching the next turn
14. Verify: no voice announcement (HUD still updates) -- corresponds to AC-7
15. Simulate GPS reaching the end of the route
16. Verify: "You have arrived" announcement/notification -- corresponds to AC-8
17. Start a new navigation, then simulate GPS moving off-route (50m from trail)
18. Verify: "Recalculating..." appears, no new turn instructions -- corresponds to AC-9
19. Simulate returning to the route
20. Verify: navigation resumes from the nearest instruction
21. Enable airplane mode, start navigation on a different trail
22. Verify: navigation works fully -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to trail detail, verify navigation HUD and all states

### Required: Complexity <= 2 (this feature is Complexity 0 = Massive):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Validate instruction generation approach and battery impact.

### Required: Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate navigation engine approach, voice synthesis strategy, and battery impact

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for navigation-engine and turn-detector

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Wrong-turn alerts detect deviation (reactive safety)
- Route geofence builds dense polylines from waypoints
- Deviation detector calculates distance from user to route
- No proactive navigation or turn-by-turn directions
- No voice announcements

### After This Work
- New `engine/navigation-engine.ts` generates turn instructions from waypoints
- New `engine/turn-detector.ts` classifies direction changes into turn types
- Trail detail has "Navigate This Trail" button
- Recording screen shows navigation HUD during guided recording
- Voice announcements at 200m and 50m before each turn
- Web shows read-only instruction list for trip planning

### Files Changed
- `modules/trails/src/types.ts` -- New `NavigationInstruction`, `TurnType`, `NavigationState` schemas
- `modules/trails/src/engine/navigation-engine.ts` -- Instruction generation from waypoints
- `modules/trails/src/engine/turn-detector.ts` -- Bearing calculation, turn classification
- `modules/trails/src/index.ts` -- Export navigation functions
- `apps/mobile/app/(trails)/recording.tsx` -- Navigation HUD overlay
- `apps/mobile/app/(trails)/trail-detail.tsx` -- "Navigate" button
- `apps/web/app/trails/page.tsx` -- Instruction list section

### Known Limitations
- **No re-routing:** If the user deviates, the system waits for them to return to the route. It does not calculate a new route to rejoin the trail. Re-routing requires a path-finding algorithm and trail graph data (future enhancement).
- **Instruction quality depends on waypoint density:** Sparse waypoints mean fewer detected turns. The interpolation from route-geofence helps but cannot invent junction data that wasn't recorded.
- **No sport-specific voice:** All users get the same announcement style. Komoot adapts tone and detail to sport type (cycling gets "take the second exit at the roundabout"). Future enhancement.
- **Single language:** V1 uses device default language via expo-speech. Multi-language support is inherent in the platform but not explicitly tested.

### Context for Next Agent
- `expo-speech` has `Speech.speak(text, options)`. Use `{ rate: 0.9, pitch: 1.0 }` for clear, calm announcements. Test on actual device (simulator may not have speech synthesis).
- Bearing calculation: `Math.atan2(sin(dLng)*cos(lat2), cos(lat1)*sin(lat2) - sin(lat1)*cos(lat2)*cos(dLng))`. Convert to degrees. The angle between two consecutive bearings gives the turn direction.
- Turn classification thresholds: <30 degrees = straight (no instruction), 30-60 = slight turn, 60-120 = turn, 120-150 = sharp turn, >150 = U-turn.
- The existing `DeviationStateMachine` from wrong-turn alerts should be reused for the "recalculating" state. When deviation is detected, pause navigation instruction advancement.
- Battery: voice synthesis + screen-on + GPS is demanding. Test battery impact and add a "battery saver" option that reduces announcement frequency.
