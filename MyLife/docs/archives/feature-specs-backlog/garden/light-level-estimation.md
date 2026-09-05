# Feature Spec: Light Level Estimation

## Metadata
- **Module:** garden
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** room/zone organization (light readings attach to zones)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Light is the #1 factor in plant health, but most people misjudge their home's light conditions. "Bright indirect" means different things to different people. PlantIn's light meter is a key premium feature that measures actual lux levels via the phone camera and classifies the reading into plant-friendly categories (low/medium/bright indirect/direct). Users can then compare their measured conditions against their plants' requirements. This removes guesswork from plant placement and is especially valuable for indoor plant parents moving plants between rooms.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| PlantIn | Yes | Pro ($29.99/yr) | Camera-based lux meter, classifies light into 4 categories, recommends plant placement |
| Planta | No | N/A | Manual light level selection per room (no measurement) |
| Planter | No | N/A | No light measurement |
| Lux Light Meter (standalone) | Yes | Free/$2.99 | Dedicated light meter app using camera, no plant integration |

### Target User
Indoor plant parents who want to verify light conditions before placing plants. Users who have struggled with plants dying from insufficient light and want data-driven placement decisions. PlantIn users who value the light meter but want privacy-first measurement.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/engine/light-meter.ts           -- Camera-based lux estimation engine
modules/garden/src/engine/light-classification.ts   -- Lux-to-category mapping, plant matching
modules/garden/src/types.ts                        -- LightReading, LightLevel types
modules/garden/src/db/schema.ts                    -- gd_light_readings table (V2 migration)
modules/garden/src/db/crud.ts                      -- Light reading CRUD, history
modules/garden/src/definition.ts                   -- V2 migration
apps/mobile/app/(garden)/light-meter.tsx           -- Light measurement screen
apps/mobile/app/(garden)/components/LuxGauge.tsx   -- Real-time lux gauge component
apps/web/app/garden/light/page.tsx                 -- Web: manual light level entry (no camera meter)
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Garden tab
            └── Zone Detail (or top action bar)
                 └── "Measure Light" icon
                      └── Light Meter ← YOU ARE HERE
```

Also accessible from Plant Detail > "Check Light" which pre-selects the plant's zone.

### Data Model

```sql
-- V2 migration: light level readings
CREATE TABLE IF NOT EXISTS gd_light_readings (
  id TEXT PRIMARY KEY,
  zone_id TEXT REFERENCES gd_zones(id) ON DELETE CASCADE,
  reading_lux INTEGER NOT NULL,
  light_level TEXT NOT NULL,
  reading_date TEXT NOT NULL,
  reading_time TEXT,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS gd_light_readings_zone_idx ON gd_light_readings(zone_id);
CREATE INDEX IF NOT EXISTS gd_light_readings_date_idx ON gd_light_readings(reading_date DESC);
```

**Column notes:**
- `reading_lux`: measured luminance in lux (e.g., 500, 10000, 50000)
- `light_level`: classified category: 'low' | 'medium' | 'bright_indirect' | 'direct'
- `reading_time`: time of day for context (light varies by hour)
- `duration_minutes`: how long the reading was sustained (optional, for users who measure over time)

**Light classification thresholds (standard horticultural ranges):**
- Low: < 500 lux (north-facing rooms, far from windows)
- Medium: 500 - 2,500 lux (east/west windows, filtered light)
- Bright indirect: 2,500 - 10,000 lux (near south window, sheer curtains)
- Direct: > 10,000 lux (direct sun hitting the sensor)

### Dependencies
- **Internal:** `@mylife/garden` (types, zones), `@mylife/ui`
- **External:** `expo-camera` (access camera stream for brightness estimation), `expo-sensors` (ambient light sensor if available on device)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a plant parent, I want to measure the light level in a specific location using my phone so that I know the actual lux reading.
2. As a plant parent, I want the reading classified into plant-friendly categories (low/medium/bright indirect/direct) so that I can match it to plant requirements.
3. As a plant parent, I want to save readings to a zone so that I can track light conditions over time and across seasons.
4. As a plant parent, I want to see which of my plants match a zone's light level so that I know if plants are correctly placed.
5. As a plant parent, I want to take readings at different times of day so that I understand how light changes throughout the day.

### Behavior Specification

**Light measurement flow (mobile):**
1. User taps "Measure Light" from zone detail, plant detail, or top action bar
2. Camera viewfinder opens with a lux gauge overlay (circular gauge with needle)
3. Real-time lux reading updates every 500ms as the camera processes frame brightness
4. Display shows: current lux number (large), classified category label, category color indicator
5. User points phone camera at the light source or the spot where a plant sits
6. Instruction text: "Point your camera where the plant would sit. Hold steady for 3 seconds."
7. After 3-second hold: reading stabilizes, "Save Reading" button becomes active
8. User taps "Save Reading": zone picker (pre-filled if came from zone), optional time-of-day note
9. Saved to gd_light_readings

**Light history per zone:**
1. Zone detail shows "Light Readings" section with saved measurements
2. Each reading: lux value, category badge, date, time of day
3. Average light level computed from all readings for the zone
4. If average differs from manually set light level (from zone organization feature), show a suggestion: "Your readings suggest this zone is [category]. Update zone light level?"

**Plant compatibility check:**
1. After taking a reading or viewing zone light data, user sees "Plants for this light level" section
2. Lists plants from user's collection that match or tolerate the measured category
3. Also lists plants currently in this zone that may be getting too much or too little light (mismatch warning)

**Web version:**
1. No camera-based measurement on web
2. Manual light level entry: select zone, enter estimated lux or pick category, save
3. Can view reading history and plant compatibility from saved data

### Edge Cases

- **Camera permission denied:** Show explanation screen: "Camera access is needed to measure light levels." + "Open Settings" button. Offer manual entry as fallback.
- **Very dark (<10 lux):** Show "Very low light -- most plants will struggle here. Consider supplemental grow lights."
- **Very bright (>100,000 lux):** Clip at 100,000 lux. Show "Full direct sun."
- **Rapid fluctuations:** Average over 3-second window before displaying. Don't show unstable readings.
- **Camera covered or obstructed:** If lux reads 0 for >2s, show "Ensure camera is not covered."
- **No zones defined:** Allow measurement but show "Create a zone to save this reading."
- **Zone deleted:** CASCADE deletes associated light readings.
- **Device without camera (web):** Manual entry only.
- **Nighttime measurement:** Valid (tracking artificial grow light levels).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Light meter shows real-time lux reading with gauge visualization
- [ ] **AC-2:** Reading classified into one of 4 categories (low/medium/bright indirect/direct)
- [ ] **AC-3:** 3-second stabilization before "Save" becomes active
- [ ] **AC-4:** Saved reading appears in zone detail's light readings section
- [ ] **AC-5:** Multiple readings per zone tracked with date, time, and lux value
- [ ] **AC-6:** Average light level calculated from saved readings
- [ ] **AC-7:** Plant compatibility section shows matching plants from collection
- [ ] **AC-8:** Mismatch warning shown for plants in zones with incompatible light
- [ ] **AC-9:** Light level suggestion offered when readings differ from manually set level
- [ ] **AC-10:** Web allows manual light level entry with zone assignment

### Technical Criteria
- [ ] **TC-1:** Light readings persisted to gd_light_readings
- [ ] **TC-2:** Lux estimation from camera frame uses average pixel brightness formula
- [ ] **TC-3:** Classification thresholds: <500 low, 500-2500 medium, 2500-10000 bright indirect, >10000 direct
- [ ] **TC-4:** Real-time reading updates at 500ms intervals
- [ ] **TC-5:** 3-second rolling average stabilizes before save
- [ ] **TC-6:** CASCADE delete on zone_id removes readings
- [ ] **TC-7:** Average calculation handles zero readings (returns null, not NaN)

### Negative Criteria
- [ ] **NC-1:** Camera frames must NOT be stored or transmitted (only lux values saved)
- [ ] **NC-2:** Light meter must NOT require network connectivity
- [ ] **NC-3:** Readings must NOT automatically change zone light level (only suggest)
- [ ] **NC-4:** Must NOT crash on devices without cameras (fallback to manual entry)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Module accent: `#22C55E`
- Lux gauge: circular arc gauge (180 degrees), gradient from dark blue (low) through green (medium/bright indirect) to yellow/orange (direct). Needle points to current lux. Large lux number centered inside gauge.
- Category label: pill badge below gauge, color-coded:
  - Low: `#3B82F6` (blue)
  - Medium: `#22C55E` (green)
  - Bright indirect: `#F59E0B` (amber)
  - Direct: `#FF453A` (red/orange)
- Camera viewfinder behind the gauge: subtle live preview, dimmed overlay except center area
- "Save Reading" button: accent-colored, appears after 3s stabilization. Disabled with "Hold steady..." text before.
- Saved readings list: glass cards with lux number, category pill, date/time

### Web (Next.js)

- Same tokens via CSS variables
- Route: `/garden/light`
- No camera meter on web -- manual entry form: zone picker, lux input OR category picker, date, notes
- Reading history table below form
- Plant compatibility cards alongside readings

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Measuring | Camera viewfinder with live gauge | Screen opened on mobile |
| Stabilizing | "Hold steady..." with pulsing gauge | Before 3s hold completes |
| Ready to Save | "Save Reading" button active | 3s stable reading |
| Saved | Success toast + reading added to history | After save |
| No Camera | Manual entry form | Web or camera unavailable |
| Error | "Camera unavailable. Enter light level manually." | Camera init fails |

## Test Requirements

### Unit Tests
- [ ] `estimateLux()`: converts camera brightness to lux value
- [ ] `classifyLight()`: <500 returns 'low', 500-2500 returns 'medium', 2500-10000 returns 'bright_indirect', >10000 returns 'direct'
- [ ] `classifyLight()`: boundary values (exactly 500, exactly 2500, exactly 10000)
- [ ] `stabilizeReading()`: returns average of last 6 readings (3s at 500ms)
- [ ] `createLightReading()`: persists to gd_light_readings
- [ ] `getZoneAverage()`: computes correct average lux from multiple readings
- [ ] `getZoneAverage()`: handles zero readings (returns null)
- [ ] `getPlantsForLightLevel()`: returns plants matching a given category
- [ ] `getLightMismatches()`: identifies plants in wrong light zone

### Integration Tests
- [ ] Full flow: take reading -> save to zone -> verify in zone detail -> check plant compatibility
- [ ] Suggestion flow: readings disagree with manual level -> verify suggestion appears

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden > zone detail (or tap "Measure Light" from Garden tab)
3. Verify: camera opens with lux gauge overlay -- AC-1
4. Point camera at a window
5. Verify: real-time lux reading updates, category label changes -- AC-2
6. Hold camera steady for 3 seconds
7. Verify: "Save Reading" becomes active -- AC-3
8. Tap "Save Reading", select a zone
9. Verify: reading appears in zone detail's light section -- AC-4
10. Take 3 more readings at different times/positions
11. Verify: all readings shown with date/time -- AC-5
12. Verify: average light level displayed -- AC-6
13. Scroll to "Plants for this light level"
14. Verify: matching plants from collection shown -- AC-7
15. Place a low-light plant in a high-light zone
16. Verify: mismatch warning appears -- AC-8
17. If zone's manual light level differs from readings
18. Verify: suggestion to update appears -- AC-9
19. On web: navigate to /garden/light
20. Verify: manual entry form instead of camera meter -- AC-10
21. Enter a reading manually, save
22. Verify: appears in reading history

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for lux estimation and classification

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Room/zone organization (if built) has a manual light_level field per zone. No measurement capability, no reading history, no plant-light compatibility checking.

### After This Work
- Camera-based lux meter on mobile
- Light classification engine with horticultural thresholds
- gd_light_readings table for persistent measurements
- Zone-level light history with averaging
- Plant compatibility checking against measured light
- Mismatch warnings for incorrectly placed plants
- Manual entry fallback on web

### Files Changed
- `modules/garden/src/engine/light-meter.ts` -- Camera brightness to lux conversion
- `modules/garden/src/engine/light-classification.ts` -- Lux thresholds, plant matching
- `modules/garden/src/types.ts` -- LightReading, LightLevel types
- `modules/garden/src/db/schema.ts` -- gd_light_readings table
- `modules/garden/src/db/crud.ts` -- Light reading CRUD, zone average, mismatches
- `modules/garden/src/definition.ts` -- V2 migration
- `apps/mobile/app/(garden)/light-meter.tsx` -- Camera measurement screen
- `apps/mobile/app/(garden)/components/LuxGauge.tsx` -- Gauge visualization
- `apps/web/app/garden/light/page.tsx` -- Manual entry + history

### Known Limitations
- Camera-based lux estimation is approximate. Phone cameras are not calibrated light meters. Accuracy varies by device, camera quality, and exposure settings. Good enough for classification, not laboratory measurement.
- The estimation formula uses average frame brightness and an empirically tuned scaling factor. Different devices will have different scaling. A calibration step could improve this in V2.
- No tracking of light over a full day (continuous monitoring). Each reading is a snapshot.

### Context for Next Agent
- The lux estimation from camera uses: capture a low-resolution frame, compute average pixel luminance (0-255), apply a scaling factor to convert to approximate lux. The scaling factor varies by device; a reasonable default is `lux = brightness * 4` for most modern phones, capped at 100,000.
- `expo-camera` provides frame access via `useFrameProcessor` or by taking a quick photo and analyzing it. The simpler approach (for V1) is to take a photo, resize to 1x1px to get average brightness, then convert.
- The room/zone organization feature adds a `light_level` field to gd_zones. This feature adds measured readings that can confirm or conflict with the manual setting. The suggestion logic should compare the zone average reading category against the manual `light_level` field.
