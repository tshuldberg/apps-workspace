# Feature Spec: Lunar Cycle Guide

## Metadata
- **Module:** stars
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3-4
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Existing astro engine (getMoonPhase, getZodiacSign)
- **Blocks:** none
- **Spec Reference:** SPEC-mystars.md ST-009 (Moon Phase Calendar)

## Business Context

### Why This Feature Exists
Users want a dedicated monthly moon phase calendar showing all eight lunar phases, the Moon's zodiac sign each day, and astrological interpretations. The moon is the fastest-moving astrological factor and the most consulted for daily planning. This is table stakes for any astrology app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Night Sky | Yes | Premium ($39.99/yr) | AR moon phase guide with illumination data, Apple Watch complication |
| Co-Star | Yes | Free (basic) | Daily moon sign and phase in the daily reading, no dedicated calendar |
| Stardust | Yes | Free (basic) | Moon phase tracker with notifications, clean design |
| The Pattern | No | N/A | Focuses on planetary patterns, no moon calendar |
| TimePassages | Yes | Premium | Detailed moon phase with ephemeris precision |

### Target User
Spiritual Explorers who plan intentions, rituals, or habits around lunar cycles. Also Casual Stargazers who want to know when the next full or new moon is. Users coming from Night Sky ($39.99/yr) or Stardust who want moon tracking bundled with full astrology.

## Technical Context

### Where This Lives in MyLife

```
modules/stars/src/engine/lunar.ts        -- Moon calendar computation engine
modules/stars/src/db/schema.ts           -- V2 migration: st_moon_calendar table
modules/stars/src/db/crud.ts             -- Moon calendar CRUD operations
modules/stars/src/types.ts               -- MoonCalendarDay, CreateMoonCalendarInput schemas
modules/stars/src/__tests__/lunar.test.ts -- Engine + CRUD tests
apps/mobile/app/(stars)/moon-calendar.tsx -- Mobile moon calendar screen
apps/web/app/stars/moon-calendar/page.tsx -- Web moon calendar page
```

### Wireframe Position

```
Hub Dashboard
  └── MyStars card
       └── Chart tab (existing)
       └── Transits tab (existing)
       └── Moon tab ← NEW TAB (or accessible from Chart tab)
            └── Moon Phase Calendar ← YOU ARE HERE
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS st_moon_calendar (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  moon_phase TEXT NOT NULL,
  moon_sign TEXT NOT NULL,
  moon_degree INTEGER,
  illumination_pct REAL NOT NULL,
  is_key_phase INTEGER NOT NULL DEFAULT 0,
  key_phase_time TEXT,
  phase_interpretation TEXT,
  sign_interpretation TEXT,
  void_of_course_start TEXT,
  void_of_course_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS st_moon_calendar_date_idx ON st_moon_calendar(date);
CREATE INDEX IF NOT EXISTS st_moon_calendar_phase_idx ON st_moon_calendar(moon_phase);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing `engine/astro.ts` (getMoonPhase, getZodiacSign)
- **External:** None. All computation on-device using synodic period math and zodiac boundary lookup.
- **Cross-Module:** Potential link to Mood module (moon phase correlation with mood entries) and Journal module (lunar context in journal entries).

## Functional Requirements

### User Stories
1. As a Spiritual Explorer, I want to see a monthly calendar with moon phases and zodiac signs for each day, so that I can plan rituals and intentions around lunar cycles.
2. As a Casual Stargazer, I want to know when the next full moon and new moon are, so that I can observe them.
3. As a Dedicated Practitioner, I want to see void-of-course Moon periods, so that I can avoid starting important ventures during these times.

### Behavior Specification

1. User taps the "Moon" tab (or navigates to moon calendar from the Chart screen).
2. System displays the current month's calendar grid with moon phase icons and zodiac sign glyphs on each day.
3. Key phase days (New Moon, First Quarter, Full Moon, Last Quarter) are highlighted with larger icons and the phase name below.
4. Today's cell has a ring highlight.
5. Below the calendar grid, a "This Month's Lunation" summary card shows: New Moon (date, sign), Full Moon (date, sign), First/Last Quarter dates.
6. User taps a day cell.
7. System shows a Day Detail card below the calendar: large moon phase icon, phase name, illumination percentage, moon sign and degree, 2-3 sentence phase interpretation, 2-3 sentence moon-in-sign interpretation, void-of-course indicator if applicable.
8. User taps left/right arrows to navigate months (12 months backward, 12 months forward).
9. System computes moon data for the selected month and caches it.

### Edge Cases
- Month with two Full Moons (Blue Moon): both are marked as key phase days.
- Moon sign changes mid-day: display the sign at noon; Day Detail shows both signs with approximate transition time.
- Void-of-course period spans midnight: split across two day entries.
- Void-of-course period shorter than 30 minutes: do not display.
- First load of the module (no cached data): show loading shimmer for under 500ms while computing.
- User navigates beyond the 12-month boundary: arrows become disabled.
- Module disabled while viewing: graceful return to hub dashboard.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Opening moon calendar shows current month with today highlighted by a ring.
- [ ] **AC-2:** Each day cell displays a moon phase icon and tiny zodiac sign glyph.
- [ ] **AC-3:** Key phase days (New, Full, First Quarter, Last Quarter) have highlighted backgrounds and phase name labels.
- [ ] **AC-4:** Tapping a day cell opens a Day Detail card with: phase name, illumination %, moon sign, phase interpretation, sign interpretation.
- [ ] **AC-5:** "This Month's Lunation" summary card below the grid shows New Moon and Full Moon dates with their zodiac signs.
- [ ] **AC-6:** Left/right arrows navigate months, sliding the calendar.
- [ ] **AC-7:** Navigation is bounded to 12 months back and 12 months forward.
- [ ] **AC-8:** Void-of-course periods (when applicable) display in the Day Detail card.

### Technical Criteria
- [ ] **TC-1:** Moon calendar data is cached per month in `st_moon_calendar` and not recomputed on revisit.
- [ ] **TC-2:** Moon phase computation matches the existing `getMoonPhase` engine output for the same dates.
- [ ] **TC-3:** Illumination percentage is computed from phase angle: `(1 - cos(phaseAngle * PI / 180)) / 2 * 100`.
- [ ] **TC-4:** Month computation completes in under 500ms for any month.
- [ ] **TC-5:** All data persists to SQLite with `st_` prefix via V2 migration.

### Negative Criteria
- [ ] **NC-1:** This feature must NOT require a birth profile. It works for any user immediately.
- [ ] **NC-2:** This feature must NOT make any network requests.
- [ ] **NC-3:** Navigating months must NOT cause visible layout shifts or jank.

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Calendar grid cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Key phase highlight: `#8B5CF6` (stars accent) at 20% opacity background
- Today ring: `#8B5CF6` solid 2px border
- Moon phase icons: Custom SVG or Unicode moon symbols, sized 20x20 in grid, 48x48 in Day Detail
- Zodiac glyphs: 10px secondary text color
- Day Detail card: slides up from below calendar, glass surface with blur

### Web (Next.js)
- Same design tokens via CSS variables
- Calendar accessible via `/stars/moon-calendar` route
- Day Detail appears as a right panel on wider screens (>768px), bottom sheet on mobile widths
- Month navigation via keyboard arrows in addition to click

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Shimmer overlay on calendar grid | First computation for a month |
| Empty | Never occurs (computation always produces data) | N/A |
| Error | "Could not compute moon data. Pull down to retry." | Computation failure |
| Success | Full calendar grid with phase icons and signs | Data loaded/cached |
| Partial | N/A (month is always computed atomically) | N/A |

## Test Requirements

### Unit Tests
- [ ] `computeMoonCalendarMonth`: produces 28-31 entries for any valid month
- [ ] `computeMoonCalendarMonth`: marks exactly 4 key phases per lunation cycle
- [ ] `computeIllumination`: returns 0% at new moon, 100% at full moon
- [ ] `computeIllumination`: returns ~50% at first/last quarter
- [ ] `getMoonSignForDate`: returns correct zodiac sign for known dates
- [ ] `detectVoidOfCourse`: returns null for periods under 30 minutes
- [ ] Moon calendar CRUD: insert, query by date, query by month range

### Integration Tests
- [ ] Full flow: compute month -> cache to SQLite -> retrieve from cache -> render matches
- [ ] Month navigation: compute new month -> cache -> navigate back -> cached data loads instantly

### QA Verification Script
1. Open the app on iOS/Android
2. Navigate to MyStars module
3. Tap Moon tab (or navigate to moon calendar)
4. Verify: current month displays with today highlighted -- AC-1
5. Verify: each day shows a moon phase icon and zodiac glyph -- AC-2
6. Verify: at least one key phase day (New/Full Moon) is highlighted with label -- AC-3
7. Tap any day cell
8. Verify: Day Detail card appears with phase name, illumination %, sign, interpretations -- AC-4
9. Verify: "This Month's Lunation" summary shows below the grid -- AC-5
10. Tap right arrow to go to next month
11. Verify: calendar slides to next month with correct data -- AC-6
12. Navigate forward 12 months
13. Verify: right arrow becomes disabled -- AC-7
14. Tap a day with void-of-course data (if any this month)
15. Verify: VOC start and end times display -- AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the moon calendar URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for lunar computation engine

### Post-merge:
- [ ] `/parity-check` -- stars has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Moon phase computation exists in `engine/astro.ts` (getMoonPhase) but only returns the phase name for a single date. No calendar view, no caching, no illumination percentage, no void-of-course detection, no sign interpretation text.

### After This Work
- New `engine/lunar.ts` with `computeMoonCalendarMonth()` producing full month data
- New `st_moon_calendar` table with V2 migration
- CRUD for inserting and querying cached moon calendar data
- Mobile and web screens showing the calendar UI
- Interpretation text bundled as constants

### Files Changed
- `modules/stars/src/engine/lunar.ts` -- new lunar calendar computation engine
- `modules/stars/src/db/schema.ts` -- V2 migration adding st_moon_calendar
- `modules/stars/src/db/crud.ts` -- moon calendar CRUD operations
- `modules/stars/src/types.ts` -- MoonCalendarDay schema and types
- `modules/stars/src/definition.ts` -- V2 migration, new "moon" tab in navigation
- `modules/stars/src/__tests__/lunar.test.ts` -- engine and CRUD tests
- `apps/mobile/app/(stars)/moon-calendar.tsx` -- mobile screen
- `apps/web/app/stars/moon-calendar/page.tsx` -- web page

### Known Limitations
- Void-of-course computation requires aspect detection between the Moon and all other planets, which depends on the full Swiss Ephemeris engine (ST-004). Initial implementation may use simplified VOC detection or omit it until ST-004 is built.
- Moon sign degree and minute precision depends on the accuracy of the underlying position calculator. The current synodic period approach gives phase accuracy but not sub-degree positional accuracy.

### Context for Next Agent
- The existing `getMoonPhase` in `engine/astro.ts` uses synodic period math. The new `computeMoonCalendarMonth` should call it but also compute illumination and zodiac sign per day.
- Interpretation text should be stored as a constant map (phase -> text, sign -> text) in a separate file like `engine/interpretations.ts` to keep engine logic clean.
- The V2 migration pattern follows the same structure as V1 in `definition.ts`.
