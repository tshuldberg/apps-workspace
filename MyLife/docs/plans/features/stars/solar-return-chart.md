# Feature Spec: Solar Return Chart

## Metadata
- **Module:** stars
- **Priority Score:** 17 / 50 (C-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5-8
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Birth profile CRUD, natal chart computation (ST-002), planet position calculator (ST-004), aspect calculations (ST-010)
- **Blocks:** none
- **Spec Reference:** SPEC-mystars.md ST-018 (Solar Return Chart)

## Business Context

### Why This Feature Exists
A Solar Return Chart is cast for the exact moment the Sun returns to its natal position each year (near the user's birthday). It is the primary technique astrologers use to forecast the themes and energy of a person's year ahead. TimePassages is the main competitor offering this feature. The low market score (1) reflects the niche astrology audience, but the high paid user score (3) indicates this is a premium feature that dedicated practitioners will pay for.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| TimePassages | Yes | Premium | Full solar return chart with detailed interpretations, year-by-year navigation |
| Co-Star | No | N/A | Does not offer solar return charts |
| The Pattern | No | N/A | Focuses on proprietary "patterns" rather than traditional chart types |
| Nebula | Yes | Premium ($50/yr) | Solar return chart with basic interpretation |
| Astro.com | Yes | Free (basic), Premium (detailed) | Solar return chart generation with Placidus houses |

### Target User
Dedicated Practitioners who study solar return charts to understand yearly themes. Users migrating from TimePassages or Astro.com who want this analysis in a privacy-first, offline app.

## Technical Context

### Where This Lives in MyLife

```
modules/stars/src/engine/solar-return.ts          -- Solar return moment finder + chart computation
modules/stars/src/engine/interpretations.ts       -- Solar return interpretation text
modules/stars/src/db/schema.ts                    -- V2 migration: st_solar_returns table
modules/stars/src/db/crud.ts                      -- Solar return CRUD
modules/stars/src/types.ts                        -- SolarReturnChart, SolarReturnTheme schemas
modules/stars/src/__tests__/solar-return.test.ts  -- Engine + CRUD tests
apps/mobile/app/(stars)/solar-return.tsx           -- Mobile solar return screen
apps/web/app/stars/solar-return/page.tsx           -- Web solar return page
```

### Wireframe Position

```
Hub Dashboard
  └── MyStars card
       └── Chart tab
            └── Birth Chart (existing)
            └── Solar Return ← NEW (accessible from Chart tab or as a screen)
                 ├── Year Theme banner
                 ├── Planet Positions
                 ├── Key Themes cards
                 └── Compare to Natal button
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS st_solar_returns (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  return_year INTEGER NOT NULL,
  return_datetime TEXT NOT NULL,
  return_datetime_local TEXT,
  natal_sun_longitude REAL NOT NULL,
  location_lat REAL,
  location_lng REAL,
  ascendant_longitude REAL,
  planet_positions TEXT NOT NULL,
  house_cusps TEXT,
  aspects TEXT,
  year_theme TEXT,
  key_themes TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id, return_year)
);

CREATE INDEX IF NOT EXISTS st_solar_returns_profile_year_idx ON st_solar_returns(profile_id, return_year);
CREATE INDEX IF NOT EXISTS st_solar_returns_year_idx ON st_solar_returns(return_year);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), birth profile CRUD, `engine/astro.ts` (getZodiacSign)
- **External:** Swiss Ephemeris data (bundled) for precise Sun longitude computation and planet positions at the return moment. This is the primary dependency.
- **Cross-Module:** None.

## Functional Requirements

### User Stories
1. As a Dedicated Practitioner, I want to compute my solar return chart for the current year, so that I can understand the major themes of my birthday year.
2. As a Spiritual Explorer, I want a "Year Theme" summary based on my solar return, so that I can set intentions aligned with the year's cosmic energy.
3. As a Dedicated Practitioner, I want to navigate between past and future solar returns (5 years back, 2 years forward), so that I can compare yearly themes.

### Behavior Specification

1. User navigates to the Solar Return screen (from Chart tab).
2. System checks that a natal chart exists for the selected profile. If not, shows "Calculate your natal chart to view your solar return."
3. System computes the solar return for the current year:
   a. Finds the exact moment (to the minute) when transiting Sun longitude matches natal Sun longitude.
   b. Computes all planet positions at that moment.
   c. Computes house cusps using the user's birth location (or current location if available).
   d. Computes aspects between solar return planets.
4. Screen shows:
   - Banner: "Your [Year] Solar Return: [Date] at [Time]"
   - Year Theme card: 2-3 sentence summary based on Solar Return Ascendant and Sun house.
   - Planet Positions list: all planets in the solar return chart.
   - Key Themes section: 3-5 cards (Sun house, Moon sign/house, Ascendant, significant aspects).
   - "Compare to Natal" button: shows side-by-side view.
5. User taps left/right arrows to navigate years (5 back, 2 forward).
6. User taps a planet row: expands to show solar return interpretation for that placement.
7. User taps "Compare to Natal": overlay or side-by-side view of natal vs solar return.

### Edge Cases
- Natal chart not computed: show message with CTA to compute chart.
- Year outside ephemeris range (1900-2100): show "Solar return data is available for years 1900-2100."
- Leap year birthday (Feb 29): expand search window to 5 days instead of 4.
- Sun longitude near 0/360 boundary (late Pisces/early Aries): handle wrap-around in binary search.
- Solar return moment falls on a different calendar day than the birthday: this is normal, display the actual date.
- Location data missing: use birth location as default, show note "Using birth location for house calculation."
- Binary search fails to converge: set maximum 20 iterations (precision better than 1 second), fall back to nearest computed point.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Solar Return screen shows banner with the exact solar return date and time for the current year.
- [ ] **AC-2:** Year Theme card displays a 2-3 sentence summary of the year's theme.
- [ ] **AC-3:** Planet Positions list shows all planet placements at the solar return moment.
- [ ] **AC-4:** Key Themes section shows 3-5 cards for significant placements (Sun house, Moon, Ascendant).
- [ ] **AC-5:** Left/right arrows navigate between years (5 years back, 2 years forward).
- [ ] **AC-6:** Tapping a planet row expands to show interpretation.
- [ ] **AC-7:** "Compare to Natal" shows natal vs solar return comparison.
- [ ] **AC-8:** Without a natal chart, a "Calculate your chart" message appears.

### Technical Criteria
- [ ] **TC-1:** Solar return moment computed to within 1 minute of the exact Sun longitude match (20 binary search iterations).
- [ ] **TC-2:** Solar return moment falls within 2 days of the user's birthday in the target year.
- [ ] **TC-3:** Results cached in `st_solar_returns` with (profile_id, return_year) uniqueness.
- [ ] **TC-4:** Cascade delete removes solar return data when a profile is deleted.
- [ ] **TC-5:** Year range validated: 1900-2100.
- [ ] **TC-6:** Planet positions JSON includes all 10 planets (Sun through Pluto) with sign, degree, minute.

### Negative Criteria
- [ ] **NC-1:** This feature must NOT work without a natal chart. Solar return requires natal Sun longitude.
- [ ] **NC-2:** This feature must NOT make network requests.
- [ ] **NC-3:** Solar return computation must NOT take more than 3 seconds.

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Banner: elevated surface with accent border, shows year prominently
- Year Theme card: glass surface with larger text for the theme summary
- Planet rows: glass list items with planet glyph, sign glyph, degree
- Key Themes cards: glass cards with accent-colored headers
- Year navigation arrows: `#8B5CF6` accent, disabled state at 30% opacity

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/stars/solar-return`
- Planet positions in a two-column grid on desktop
- Key Themes cards in a responsive grid (3-col desktop, 1-col mobile)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Finding your solar return..." | Computing chart |
| No Chart | "Calculate your natal chart to view your solar return" with CTA | No natal chart |
| Success | Full solar return display with all sections | Data computed/cached |
| Error | "Could not compute your solar return. Try again." | Computation failure |
| Year OOB | "Solar return data is available for years 1900-2100." | Year outside range |

## Test Requirements

### Unit Tests
- [ ] `findSolarReturnMoment`: finds moment within 1 minute precision for known test case
- [ ] `findSolarReturnMoment`: handles Sun longitude at 0/360 boundary
- [ ] `findSolarReturnMoment`: handles leap year birthdays (Feb 29)
- [ ] `findSolarReturnMoment`: result falls within 2 days of birthday
- [ ] `computeSolarReturnChart`: produces positions for all 10 planets
- [ ] `generateYearTheme`: produces non-empty theme text for any Sun house
- [ ] Solar return CRUD: create, get by profile+year, cascade delete, uniqueness constraint

### Integration Tests
- [ ] Full flow: profile with natal chart -> compute solar return -> cache -> navigate years -> cached data loads
- [ ] Compare flow: compute solar return -> tap Compare to Natal -> both charts displayed

### QA Verification Script
1. Open MyStars, ensure a profile with full natal chart exists
2. Navigate to Solar Return screen
3. Verify: banner shows solar return date and time for current year -- AC-1
4. Verify: Year Theme card with 2-3 sentence summary -- AC-2
5. Verify: Planet Positions list shows all planets -- AC-3
6. Verify: Key Themes section shows 3-5 cards -- AC-4
7. Tap left arrow to view previous year
8. Verify: chart updates to the previous year's solar return -- AC-5
9. Tap a planet row
10. Verify: interpretation expands -- AC-6
11. Tap "Compare to Natal"
12. Verify: comparison view appears -- AC-7
13. Delete natal chart, reopen Solar Return
14. Verify: "Calculate your chart" message shown -- AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to solar return screen, test year navigation
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Complexity score is 2.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for solar return moment computation

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No solar return computation exists. The `st_saved_charts` table can store generic chart data but has no structure for solar return specific fields (return year, year theme, key themes). The Swiss Ephemeris engine (ST-004) may or may not be built yet.

### After This Work
- New `engine/solar-return.ts` with binary search for solar return moment and full chart computation
- Solar return interpretation text in `engine/interpretations.ts`
- New `st_solar_returns` table with V2 migration
- Solar return CRUD with year navigation
- Mobile and web screens with theme summary, planet positions, key themes, and natal comparison

### Files Changed
- `modules/stars/src/engine/solar-return.ts` -- solar return computation engine
- `modules/stars/src/engine/interpretations.ts` -- solar return interpretation text
- `modules/stars/src/db/schema.ts` -- V2 migration adding st_solar_returns
- `modules/stars/src/db/crud.ts` -- solar return CRUD
- `modules/stars/src/types.ts` -- SolarReturnChart, SolarReturnTheme schemas
- `modules/stars/src/definition.ts` -- V2 migration entry, navigation update
- `modules/stars/src/__tests__/solar-return.test.ts` -- tests
- `apps/mobile/app/(stars)/solar-return.tsx` -- mobile screen
- `apps/web/app/stars/solar-return/page.tsx` -- web page

### Known Limitations
- This feature is heavily dependent on the Swiss Ephemeris engine (ST-004) for accurate Sun longitude computation. Without it, the solar return moment cannot be precisely found. If ST-004 is not built, this feature should be deferred or implemented with a simplified approximation (birthday at noon as the return moment, which is accurate to within ~12 hours).
- House cusp computation (Placidus system) requires latitude/longitude and the sidereal time algorithm. This is complex to implement from scratch. Consider using a bundled library or simplified whole-sign houses.
- Year theme generation requires a large interpretation text library (~200KB). This can be structured as `SOLAR_RETURN_THEMES[sun_house][ascendant_sign]`.

### Context for Next Agent
- The binary search for the solar return moment works by: setting a 4-day window around the birthday, computing Sun longitude at the midpoint, comparing to natal Sun longitude, and narrowing. 20 iterations gives sub-second precision.
- Handle the 0/360 degree wrap: if natal Sun is at 358 degrees and transiting Sun is at 2 degrees, the angular difference should be 4 degrees, not 356 degrees. Use `((transiting - natal + 540) % 360) - 180` for signed difference.
- The solar return is one chart per year per profile. Caching is straightforward: (profile_id, return_year) unique.
