# Feature Spec: Frost Date Alerts

## Metadata
- **Module:** garden
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Frost dates determine when gardeners can safely plant outdoors and when to protect tender plants in fall. In the US, the USDA hardiness zone and average last/first frost dates are the foundation of all planting calendars. Every spring, gardeners check their frost dates to decide when to transplant seedlings. Every fall, they watch for the first frost to bring plants indoors or cover them. Seed to Spoon's frost date integration is a core premium feature. A bundled frost date dataset by US zip code/zone gives users instant, offline answers without relying on weather APIs.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Seed to Spoon | Yes | Premium ($46.99/yr) | Zip code-based frost date lookup, planting calendar, frost alerts via push notification |
| GrowVeg | Yes | Premium ($35) | Location-based frost dates, integrated with planting schedule |
| Planter | Partial | Premium ($49.99) | Seasonal calendar but no specific frost date alerts |
| PlantIn | No | N/A | No frost feature (houseplant-focused) |

### Target User
Outdoor gardeners in the US who need to know their frost dates for planting decisions. Seed starters who need to count backwards from last frost to determine indoor seed start dates. Fall gardeners who need first frost alerts to protect tender plants.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/engine/frost.ts                 -- Frost date calculations, countdown
modules/garden/src/engine/frost-data.ts             -- Bundled frost date dataset (US zones)
modules/garden/src/types.ts                        -- FrostConfig, FrostAlert types
modules/garden/src/db/schema.ts                    -- gd_frost_config table (V2 migration)
modules/garden/src/db/crud.ts                      -- Frost config CRUD
modules/garden/src/definition.ts                   -- V2 migration
apps/mobile/app/(garden)/frost.tsx                 -- Frost date dashboard screen
apps/mobile/app/(garden)/components/FrostCountdown.tsx  -- Countdown widget
apps/mobile/app/(garden)/components/PlantingCalendar.tsx -- When-to-plant calendar
apps/web/app/garden/frost/page.tsx                 -- Web frost dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Garden tab
            └── Top info card: "Last frost: [date] ([X] days away)"
       └── Settings tab
            └── "Frost Dates" section
                 └── Configure zip/zone ← CONFIGURE HERE
       └── Garden tab > action bar
            └── "Frost Calendar" ← FULL VIEW HERE
```

### Data Model

```sql
-- V2 migration: frost date configuration
CREATE TABLE IF NOT EXISTS gd_frost_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  zip_code TEXT,
  usda_zone TEXT,
  avg_last_frost TEXT,
  avg_first_frost TEXT,
  notification_days_before INTEGER NOT NULL DEFAULT 7,
  custom_last_frost TEXT,
  custom_first_frost TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Column notes:**
- `id`: singleton row ('default') -- only one frost config per user
- `zip_code`: US zip code entered by user (used to look up frost dates from bundled data)
- `usda_zone`: USDA hardiness zone (e.g., '9b', '7a') -- derived from zip or manually entered
- `avg_last_frost`: average last spring frost date (MM-DD format, e.g., '03-15')
- `avg_first_frost`: average first fall frost date (MM-DD format, e.g., '11-15')
- `notification_days_before`: how many days before frost to alert (default 7)
- `custom_last_frost` / `custom_first_frost`: user overrides (if they know better than averages)

**Bundled frost data (frost-data.ts):**
- Static TypeScript map: USDA zone -> { avgLastFrost: 'MM-DD', avgFirstFrost: 'MM-DD', growingSeasonDays: number }
- Also a zip-to-zone lookup for the ~43,000 US zip codes (can be a compressed JSON file ~200KB)
- Data sourced from NOAA/NWS historical frost probability data (public domain)

### Dependencies
- **Internal:** `@mylife/garden` (types, settings), `@mylife/ui`
- **External:** `expo-notifications` (optional push alerts for frost dates)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a gardener, I want to enter my zip code and see my average last/first frost dates so that I know my growing season boundaries.
2. As a gardener, I want a countdown showing days until last spring frost so that I know when it's safe to transplant.
3. As a gardener, I want an alert before the first fall frost so that I can protect or bring in tender plants.
4. As a gardener, I want a planting calendar based on my frost dates so that I know when to start seeds indoors, transplant, and direct sow.
5. As a gardener, I want to override the average frost dates with my own observations so that the calendar reflects my microclimate.

### Behavior Specification

**Setup (one-time):**
1. On first access to frost features (or from Settings > Frost Dates), user enters zip code
2. System looks up USDA zone and average frost dates from bundled data
3. Display: "Your zone: [X], Average last frost: [date], Average first frost: [date], Growing season: [N] days"
4. User can accept defaults or override with custom dates
5. Config saved to gd_frost_config

**Frost dashboard:**
1. Header card: "Spring: Last frost [date] ([X] days away / [X] days ago)" and "Fall: First frost [date] ([X] days away)"
2. Visual timeline showing the growing season between frost dates, with current date marker
3. Planting calendar section: grid of common vegetables/herbs with recommended action by timing relative to frost:
   - "Start indoors: [X] weeks before last frost"
   - "Transplant: [X] weeks after last frost"
   - "Direct sow: [X] weeks after last frost"
   - "Harvest before: [X] weeks before first frost"
4. Each calendar entry is color-coded: red (not yet time), yellow (coming up), green (now), gray (past)

**Garden tab integration:**
1. A persistent info card at the top of the Garden tab shows frost countdown
2. In spring: "Last frost in [X] days ([date])" with a frost icon
3. In growing season: "Growing season -- [X] days until first frost"
4. In fall: "First frost in [X] days ([date])! Protect tender plants."
5. In winter: "Off-season. Last frost: [date] ([X] days away)"

**Alerts:**
1. User configures notification_days_before (default 7) in Settings
2. Before first fall frost: push notification "[X] days until first frost! Time to protect tender plants."
3. Before last spring frost: push notification "[X] days until last frost! Start planning transplants."
4. Notifications scheduled locally (no server needed)

### Edge Cases

- **Non-US location:** Show "Frost date data is currently available for US locations only. Enter custom frost dates for your area." Allow manual date entry.
- **Invalid zip code:** "No frost data found for this zip code. Check the zip or enter your USDA zone manually."
- **Zip code with no frost (tropical zones 10b-13):** Show "Your zone rarely experiences frost. Average frost dates are not applicable." Still allow custom dates.
- **Frost date in the past (current year):** Show "Last frost was [X] days ago" instead of countdown.
- **Custom dates override average:** Custom dates take priority in all calculations and displays. Show indicator: "Using custom frost dates."
- **Notification permission denied:** Feature works without notifications. Show "Enable notifications in Settings for frost alerts."
- **Leap year:** Feb 29 handled correctly in date calculations.
- **No frost config set:** Garden tab shows "Set up your frost dates" CTA instead of countdown card.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Entering zip code shows USDA zone and average frost dates from bundled data
- [ ] **AC-2:** Frost dashboard shows countdown to next frost event (spring or fall)
- [ ] **AC-3:** Visual timeline shows growing season with current date marker
- [ ] **AC-4:** Planting calendar shows timing for common crops relative to frost dates
- [ ] **AC-5:** Calendar entries color-coded by timing (not yet, coming up, now, past)
- [ ] **AC-6:** Garden tab persistent card shows frost countdown
- [ ] **AC-7:** User can override frost dates with custom values
- [ ] **AC-8:** Fall frost alert delivered [N] days before first frost date
- [ ] **AC-9:** Settings allow configuring notification timing (days before frost)
- [ ] **AC-10:** Non-US users can enter custom frost dates manually

### Technical Criteria
- [ ] **TC-1:** Frost config persisted as singleton row in gd_frost_config
- [ ] **TC-2:** Zip-to-zone lookup covers US zip codes (bundled dataset ~200KB)
- [ ] **TC-3:** Frost date calculations handle year transitions correctly
- [ ] **TC-4:** Countdown calculates days accurately across months
- [ ] **TC-5:** Planting calendar timing relative to frost dates is horticulturally correct
- [ ] **TC-6:** Local notifications scheduled via expo-notifications
- [ ] **TC-7:** Custom frost dates override averages in all calculations

### Negative Criteria
- [ ] **NC-1:** Frost feature must NOT require network connectivity
- [ ] **NC-2:** Zip code must NOT be transmitted to any external service
- [ ] **NC-3:** Frost data must NOT modify plant care schedules (informational only)
- [ ] **NC-4:** Notifications must NOT send user location data anywhere

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E`
- Frost countdown card: glass morphism, frost icon (❄️), large countdown number in white, date in secondary text. Spring frost: blue accent (#3B82F6). Fall frost: orange accent (#F97316).
- Growing season timeline: horizontal bar, blue on left (pre-frost), green in middle (growing season), orange on right (post-frost), white dot for current date
- Planting calendar: grid of crop rows, each with colored timing bars (red/yellow/green/gray), crop icon + name on left
- Settings: simple form with zip code input, zone display, date pickers for overrides, notification toggle + days picker

### Web (Next.js)

- Same tokens via CSS variables
- Route: `/garden/frost`
- Full-width timeline at top, planting calendar as table below
- Setup wizard in a centered card if no config exists
- No push notifications on web (display-only)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Config | "Set up your frost dates" setup card | First access, no gd_frost_config row |
| Loading | Skeleton timeline | Config exists, calculating |
| Pre-Season | Blue frost countdown: "Last frost in [X] days" | Before last spring frost |
| Growing | Green bar: "Growing season -- [X] days to first frost" | Between frost dates |
| Pre-Frost | Orange warning: "First frost in [X] days!" | <30 days before first frost |
| Off-Season | Gray: "Off-season. Spring frost in [X] days" | After first frost, before last frost |
| Tropical | "Your zone rarely freezes" info card | Zone 10b+ with no frost |

## Test Requirements

### Unit Tests
- [ ] `lookupZone()`: returns correct USDA zone for known zip codes
- [ ] `lookupZone()`: returns null for invalid zip codes
- [ ] `getFrostDates()`: returns correct avg dates for a zone
- [ ] `calculateCountdown()`: correct days from today to target date
- [ ] `calculateCountdown()`: handles year transitions (Dec to Mar)
- [ ] `getCurrentFrostPhase()`: returns pre-season/growing/pre-frost/off-season correctly
- [ ] `getPlantingCalendar()`: returns correct timing for tomato (8 weeks before last frost indoor start)
- [ ] `getPlantingCalendar()`: handles crops with no frost sensitivity
- [ ] Custom date override: calculations use custom over average
- [ ] Tropical zone: returns no-frost indicator

### Integration Tests
- [ ] Full flow: enter zip -> see zone/dates -> verify countdown -> verify planting calendar
- [ ] Override flow: set custom dates -> verify calculations use custom values
- [ ] Notification scheduling: configure -> verify notification scheduled at correct date

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden > Settings > Frost Dates
3. Enter a zip code (e.g., 94110 for San Francisco)
4. Verify: shows USDA zone (10a/10b) and avg frost dates -- AC-1
5. Navigate to frost dashboard (or Garden tab action bar > "Frost Calendar")
6. Verify: countdown to next frost event displayed -- AC-2
7. Verify: growing season timeline with current date marker -- AC-3
8. Scroll to planting calendar
9. Verify: common crops shown with timing bars relative to frost dates -- AC-4
10. Verify: bars color-coded (red/yellow/green/gray) by current timing -- AC-5
11. Go back to Garden tab
12. Verify: persistent frost countdown card at top -- AC-6
13. Go to Settings > Frost Dates
14. Override last frost date with a custom value
15. Verify: dashboard updates with "Using custom frost dates" indicator -- AC-7
16. Configure notification: 7 days before first frost
17. Verify: notification permission requested (or settings guidance) -- AC-9
18. Enter a tropical zip code (e.g., 96815 for Honolulu)
19. Verify: "Your zone rarely freezes" message -- TC boundary case
20. Clear zip code and enter custom dates only
21. Verify: frost dates work with manual entry only -- AC-10
22. On web: navigate to /garden/frost
23. Verify: setup wizard appears, then dashboard after config

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for frost date calculations and countdown logic

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No frost date awareness in the garden module. The spec (SPEC-mygarden.md) mentions frost dates but nothing is implemented.

### After This Work
- Bundled frost date dataset covering US zones and zip codes
- gd_frost_config singleton table for user's location/zone
- Frost date engine with countdown, phase detection, planting calendar
- Frost dashboard with timeline and planting calendar
- Garden tab integration with persistent frost countdown card
- Local push notifications for fall/spring frost alerts
- Support for custom date overrides and non-US manual entry

### Files Changed
- `modules/garden/src/engine/frost.ts` -- Countdown, phase detection, planting calendar calculations
- `modules/garden/src/engine/frost-data.ts` -- Bundled zone-to-frost-date map + zip-to-zone lookup
- `modules/garden/src/types.ts` -- FrostConfig, FrostPhase, PlantingCalendarEntry types
- `modules/garden/src/db/schema.ts` -- gd_frost_config table
- `modules/garden/src/db/crud.ts` -- Frost config CRUD (get/set singleton)
- `modules/garden/src/definition.ts` -- V2 migration
- `apps/mobile/app/(garden)/frost.tsx` -- Frost dashboard
- `apps/mobile/app/(garden)/components/FrostCountdown.tsx` -- Countdown widget
- `apps/mobile/app/(garden)/components/PlantingCalendar.tsx` -- Planting calendar
- `apps/web/app/garden/frost/page.tsx` -- Web frost dashboard

### Known Limitations
- V1 covers US zip codes only. International frost data requires different datasets.
- Frost dates are averages. Actual frost can vary by 2-4 weeks in any given year. A disclaimer should note this.
- The planting calendar covers ~30 common vegetables/herbs. Exotic crops are not included.
- Zip-to-zone data is static. USDA zones shift over decades due to climate change; the dataset should be periodically updated.

### Context for Next Agent
- The frost-data.ts file should export two lookups: `ZIP_TO_ZONE` (Map<string, string>) and `ZONE_FROST_DATES` (Map<string, { avgLastFrost: string, avgFirstFrost: string, growingSeasonDays: number }>). The zip-to-zone map is large (~43K entries) and should be loaded lazily or stored as compressed JSON.
- Frost dates use MM-DD format (not full ISO dates) because they represent recurring annual events. To calculate countdown, combine with the current year.
- The planting calendar data is a static array of crops with relative timing: `{ crop: "Tomato", indoorStartWeeksBefore: 8, transplantWeeksAfter: 2, directSow: false, harvestWeeksBefore: 2 }`. The engine computes absolute dates from these relative offsets.
- The gd_frost_config table uses a singleton pattern (id='default'). Use INSERT...ON CONFLICT for upsert.
