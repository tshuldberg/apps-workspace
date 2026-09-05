# Feature Spec: Zodiac Calendar

## Metadata
- **Module:** stars
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3-4
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Existing astro engine (getZodiacSign)
- **Blocks:** none
- **Spec Reference:** SPEC-mystars.md ST-013 (Zodiac Events Calendar)

## Business Context

### Why This Feature Exists
Users want to see upcoming astrological events: zodiac season changes (Sun entering a new sign), planet sign ingresses, retrogrades, and eclipses. This provides the "cosmic weather" view that users discuss socially ("it's Aries season!"). The zodiac calendar is chart-independent, meaning it works for all users without requiring a birth profile.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Co-Star | Yes | Free | Shows zodiac season, retrograde status, and major events in the daily view |
| Star Walk 2 | Yes | Premium ($2.99) | Sky events calendar with notifications |
| Night Sky | Yes | Premium ($39.99/yr) | Celestial events with AR visualization |
| TimePassages | Yes | Premium | Detailed transit calendar with exact times |
| Stellarium | Yes | Free | Astronomical event predictions |

### Target User
Casual Stargazers who follow zodiac seasons and want to know when Mercury goes retrograde. Spiritual Explorers who plan around astrological events. No birth data required, making this accessible to every MyStars user.

## Technical Context

### Where This Lives in MyLife

```
modules/stars/src/engine/zodiac-events.ts        -- Event detection and computation
modules/stars/src/engine/interpretations.ts       -- Event interpretation text library
modules/stars/src/db/schema.ts                    -- V2 migration: st_zodiac_events table
modules/stars/src/db/crud.ts                      -- Zodiac events CRUD
modules/stars/src/types.ts                        -- ZodiacEvent, EventType, EventCategory schemas
modules/stars/src/__tests__/zodiac-events.test.ts -- Engine + CRUD tests
apps/mobile/app/(stars)/zodiac-events.tsx         -- Mobile events timeline
apps/web/app/stars/events/page.tsx                -- Web events page
```

### Wireframe Position

```
Hub Dashboard
  └── MyStars card
       └── Chart tab
       └── Transits tab
       └── Events ← NEW (accessible from Transits tab or as dedicated entry)
            └── Zodiac Events Timeline ← YOU ARE HERE
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS st_zodiac_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL,
  event_date TEXT NOT NULL,
  body TEXT NOT NULL,
  from_sign TEXT,
  to_sign TEXT,
  title TEXT NOT NULL,
  description_brief TEXT NOT NULL,
  description_full TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_type, body, event_date)
);

CREATE INDEX IF NOT EXISTS st_zodiac_events_date_idx ON st_zodiac_events(event_date);
CREATE INDEX IF NOT EXISTS st_zodiac_events_category_idx ON st_zodiac_events(category);
CREATE INDEX IF NOT EXISTS st_zodiac_events_type_body_idx ON st_zodiac_events(event_type, body);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing `engine/astro.ts` (getZodiacSign, zodiac boundaries)
- **External:** None. Zodiac season dates are deterministic from zodiac boundaries. Planet ingresses require ephemeris data for non-Sun bodies.
- **Cross-Module:** None.

## Functional Requirements

### User Stories
1. As a Casual Stargazer, I want to see when Aries season starts or when Mercury goes retrograde, so that I can follow astrological discussions.
2. As a Spiritual Explorer, I want a timeline of upcoming astrological events for the next 90 days, so that I can plan my life around cosmic weather.
3. As a user without a birth profile, I want to access zodiac events immediately, so that I do not need to enter personal data to use this feature.

### Behavior Specification

1. User navigates to the Zodiac Events screen (from Transits tab or a new Events entry).
2. System displays a vertical timeline showing events from today minus 7 days to today plus 90 days.
3. Each event card shows: category badge ("Season" gold, "Major" purple, "Minor" gray), title, date/time, planet/sign glyphs, and 1-2 sentence description.
4. A filter chip row at the top allows filtering: "All Events", "Season Changes", "Major Events", "Minor Events".
5. User taps a filter chip: timeline filters to matching events.
6. User taps an event card: card expands to show a detailed 2-3 paragraph interpretation.
7. Past events (last 7 days) appear above the "Today" marker in a dimmed style.
8. User pulls to refresh: recomputes events from current date.

### Edge Cases
- No events match the active filter in the next 90 days: show message "No [category] events in the next 90 days."
- Mercury retrograde crossing back into a previous sign: generates separate ingress events for both transitions.
- Planet stationed at a sign boundary oscillating: merge ingress events if within 48 hours of each other.
- Very slow outer planet ingress (Pluto): may only have 1-2 events in 90 days.
- All Sun ingress dates are deterministic from zodiac boundaries (no ephemeris needed for Sun).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Events timeline shows events from the past 7 days through the next 90 days.
- [ ] **AC-2:** Each event card displays a colored category badge, title, date/time, and brief description.
- [ ] **AC-3:** Filter chips ("All", "Season Changes", "Major", "Minor") filter the timeline.
- [ ] **AC-4:** Tapping an event card expands to show a detailed interpretation.
- [ ] **AC-5:** Past events appear dimmed above the "Today" marker.
- [ ] **AC-6:** Pull-to-refresh recomputes events.
- [ ] **AC-7:** This feature works without any birth profile.

### Technical Criteria
- [ ] **TC-1:** Sun ingress events (zodiac season changes) are computed correctly for all 12 boundaries using getZodiacSign logic.
- [ ] **TC-2:** Events are cached in `st_zodiac_events` and not recomputed until pull-to-refresh or 24 hours pass.
- [ ] **TC-3:** Event type + body + date uniqueness constraint prevents duplicate events.
- [ ] **TC-4:** Season change events categorized as "season", outer planet events as "major", inner planet events as "minor".
- [ ] **TC-5:** Timeline computation completes in under 2 seconds for 90 days.

### Negative Criteria
- [ ] **NC-1:** This feature must NOT reference the user's natal chart. It is chart-independent.
- [ ] **NC-2:** This feature must NOT make network requests.
- [ ] **NC-3:** Duplicate events must NOT appear in the timeline.

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Event cards: glass surface with category badge colored appropriately
- Category badges: Season = `#FFD700` (gold), Major = `#8B5CF6` (stars accent), Minor = `rgba(255,255,255,0.4)`
- Today marker: horizontal line with `#8B5CF6` accent and "Today" label
- Past events: 50% opacity
- Filter chips: pill-shaped buttons, active chip uses accent background

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/stars/events`
- Timeline in a centered column (max-width 640px)
- Filter chips sticky at top on scroll

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Scanning upcoming events..." shimmer | First computation or refresh |
| Empty | "No events in the next 90 days." | Filtered category with no matches |
| Error | "Could not compute events. Pull to retry." | Computation failure |
| Success | Vertical timeline with event cards | Data loaded |
| Partial | N/A (events computed atomically) | N/A |

## Test Requirements

### Unit Tests
- [ ] `computeSunIngresses`: produces 3-4 sun ingress events for any 90-day window
- [ ] `computeSunIngresses`: dates match zodiac boundary dates
- [ ] `categorizeEvent`: sun ingress -> season, jupiter station -> major, mercury ingress -> minor
- [ ] `deduplicateEvents`: merges events within 48 hours for the same body
- [ ] Zodiac events CRUD: insert, query by date range, query by category, unique constraint

### Integration Tests
- [ ] Full flow: compute events -> cache -> filter by category -> correct subset displayed
- [ ] Refresh: pull-to-refresh replaces old cached events with freshly computed ones

### QA Verification Script
1. Open MyStars module
2. Navigate to Zodiac Events
3. Verify: timeline shows events spanning next 90 days -- AC-1
4. Verify: each card has a colored badge, title, date, description -- AC-2
5. Tap "Season Changes" filter
6. Verify: only Sun ingress events shown -- AC-3
7. Tap an event card
8. Verify: card expands with detailed interpretation -- AC-4
9. Scroll up past "Today" marker
10. Verify: past events appear dimmed -- AC-5
11. Pull down to refresh
12. Verify: timeline refreshes -- AC-6
13. Delete all birth profiles, reopen events
14. Verify: events still display normally -- AC-7

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to events timeline, test filters, verify all states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for event detection engine

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No zodiac events calendar exists. The `getZodiacSign` engine function can determine what zodiac sign a date falls under, but there is no forward-scanning event detection, no event categorization, and no event interpretation text.

### After This Work
- New `engine/zodiac-events.ts` with Sun ingress detection for all 12 zodiac boundaries
- Interpretation text in `engine/interpretations.ts`
- New `st_zodiac_events` table with V2 migration
- Events CRUD with caching and deduplication
- Mobile and web timeline screens with category filtering

### Files Changed
- `modules/stars/src/engine/zodiac-events.ts` -- event detection engine
- `modules/stars/src/engine/interpretations.ts` -- event interpretation text
- `modules/stars/src/db/schema.ts` -- V2 migration adding st_zodiac_events
- `modules/stars/src/db/crud.ts` -- events CRUD
- `modules/stars/src/types.ts` -- ZodiacEvent, EventType, EventCategory schemas
- `modules/stars/src/definition.ts` -- V2 migration entry
- `modules/stars/src/__tests__/zodiac-events.test.ts` -- tests
- `apps/mobile/app/(stars)/zodiac-events.tsx` -- mobile screen
- `apps/web/app/stars/events/page.tsx` -- web page

### Known Limitations
- Planet ingress detection (non-Sun bodies) and retrograde station detection require the Swiss Ephemeris engine (ST-004). Initial implementation computes Sun ingresses only (deterministic from zodiac boundaries) and stubs planet ingresses/retrogrades as "coming soon" or uses pre-computed static data for the current year.
- Eclipse detection requires Sun-Moon-Node geometry computation, which depends on ST-004. Omit eclipses in V1.

### Context for Next Agent
- Sun ingress dates are deterministic: iterate through ZODIAC_BOUNDARIES in `engine/astro.ts` and produce events for each boundary within the date range. No ephemeris needed.
- Non-Sun planet events require ephemeris. If building without ST-004, consider pre-computing a static events JSON for 2025-2027 and bundling it. This can be replaced with dynamic computation later.
- Event interpretations should be organized as `SEASON_DESCRIPTIONS[sign]`, `INGRESS_DESCRIPTIONS[body][sign]`, etc. in the interpretations file.
