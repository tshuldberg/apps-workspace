# Feature Spec: Progressed Chart

## Metadata
- **Module:** stars
- **Priority Score:** 17 / 50 (C-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5-8
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Birth profile CRUD, natal chart computation (ST-002), planet position calculator (ST-004)
- **Blocks:** none
- **Spec Reference:** SPEC-mystars.md ST-019 (Progressed Chart)

## Business Context

### Why This Feature Exists
Secondary Progressions are the primary technique for understanding long-term personal evolution in astrology. Each day after birth represents one year of life, creating a slowly evolving chart that reveals decade-spanning developmental themes. The Progressed Moon (changing signs every 2-3 years) is the single most consulted progressed element. TimePassages is the main competitor offering this feature. Like Solar Return, the low market score (1) reflects the niche audience, but the high paid user score (3) means dedicated astrology users will pay for it.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| TimePassages | Yes | Premium | Full progressed chart with sign change timeline, detailed interpretations |
| Co-Star | No | N/A | Does not offer progressed charts |
| The Pattern | Partial | Premium ($120/yr) | Proprietary "progression" features, not standard secondary progressions |
| Astro.com | Yes | Free (basic), Premium (detailed) | Secondary progressions with day-for-a-year method |
| Nebula | No | N/A | Does not offer progressed charts |

### Target User
Dedicated Practitioners who study secondary progressions to understand long-term life themes. Users migrating from TimePassages or Astro.com who want this in a privacy-first app. Users in their late 20s/early 30s experiencing a "progressed Moon sign change" and wanting to understand the shift.

## Technical Context

### Where This Lives in MyLife

```
modules/stars/src/engine/progressions.ts          -- Progressed date calculation, Moon/Sun tracking
modules/stars/src/engine/interpretations.ts       -- Progressed chart interpretation text
modules/stars/src/db/schema.ts                    -- V2 migration: st_progressed_charts table
modules/stars/src/db/crud.ts                      -- Progressed chart CRUD
modules/stars/src/types.ts                        -- ProgressedChart, ProgressedMoon schemas
modules/stars/src/__tests__/progressions.test.ts  -- Engine + CRUD tests
apps/mobile/app/(stars)/progressions.tsx           -- Mobile progressions screen
apps/web/app/stars/progressions/page.tsx           -- Web progressions page
```

### Wireframe Position

```
Hub Dashboard
  └── MyStars card
       └── Chart tab
            └── Birth Chart (existing)
            └── Solar Return
            └── Progressions ← NEW
                 ├── Progressed Moon highlight card
                 ├── Progressed Sun card
                 ├── Progressed Planets list
                 ├── Sign Change Timeline
                 └── Progressed Aspects
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS st_progressed_charts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  progressed_date TEXT NOT NULL,
  current_age_years REAL NOT NULL,
  moon_longitude REAL NOT NULL,
  moon_sign TEXT NOT NULL,
  moon_degree INTEGER NOT NULL,
  moon_next_sign_change_date TEXT,
  moon_next_sign TEXT,
  sun_longitude REAL NOT NULL,
  sun_sign TEXT NOT NULL,
  sun_degree INTEGER NOT NULL,
  planet_positions TEXT,
  progressed_aspects TEXT,
  sign_change_timeline TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS st_progressed_profile_idx ON st_progressed_charts(profile_id);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), birth profile CRUD, `engine/astro.ts` (getZodiacSign)
- **External:** Swiss Ephemeris data (bundled) for computing planet positions at the progressed date. This is the primary dependency.
- **Cross-Module:** None.

## Functional Requirements

### User Stories
1. As a Dedicated Practitioner, I want to see my current progressed Moon sign and how many years until it changes, so that I can understand my evolving emotional focus.
2. As a Spiritual Explorer, I want a sign change timeline showing past and future progressed sign changes, so that I can contextualize major life transitions.
3. As a Dedicated Practitioner, I want to see progressed-to-natal aspects within 1-degree orb, so that I can identify active progressed influences.

### Behavior Specification

1. User navigates to the Progressions screen (from Chart tab).
2. System checks that a natal chart exists for the selected profile. If not, shows "Calculate your natal chart to view progressions."
3. System computes the progressed chart:
   a. Calculates age: `age_in_years = (today - birth_date) / 365.25`
   b. Computes progressed date: `birth_date + floor(age_in_years) days`
   c. Computes planet positions at the progressed date using Swiss Ephemeris.
   d. Determines progressed Moon sign, degree, and next sign change date.
   e. Determines progressed Sun sign and degree.
   f. Computes progressed-to-natal aspects within 1-degree orb.
4. Screen shows:
   - **Progressed Moon highlight card**: Current sign, degree, years until next sign change, 2-3 sentence interpretation.
   - **Progressed Sun card**: Current sign, degree, interpretation (changes every ~30 years).
   - **Progressed Planets list**: Mercury, Venus, Mars positions (outer planets omitted, they barely move in progressions).
   - **Sign Change Timeline**: Horizontal scrollable timeline showing past and future Moon/Sun sign changes.
   - **Progressed Aspects**: List of progressed planets within 1-degree orb of natal planets.
5. User taps Progressed Moon card: expands to show 2-3 paragraphs about the current progressed Moon sign.
6. User taps a sign change on the timeline: shows the date and interpretation.
7. User taps a progressed aspect: shows the interpretation.

### Edge Cases
- Natal chart not computed: show message with CTA.
- Very young user (age < 1): progressed date is within the first day after birth; planets barely moved. Show message: "Progressions become meaningful after age 1."
- Progressed Moon near 29 degrees of a sign: sign change is imminent (within months). Highlight prominently.
- Progressed Sun sign change (rare, ~every 30 years): highlight as a major life theme shift.
- Outer planet progressions (Jupiter through Pluto): they move fractions of a degree over a lifetime. Exclude from the planet list but mention in a note.
- Fractional year: the progressed date includes the fractional part (e.g., age 30.5 = 30 days + 12 hours after birth).
- Profile is one-to-one: only one progressed chart per profile. Recomputing replaces the existing one.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Progressed Moon card shows current sign, degree, and years until next sign change.
- [ ] **AC-2:** Progressed Moon card interpretation is 2-3 sentences about the current sign.
- [ ] **AC-3:** Progressed Sun card shows current sign and degree.
- [ ] **AC-4:** Progressed Planets list shows Mercury, Venus, Mars positions.
- [ ] **AC-5:** Sign Change Timeline shows past and future Moon/Sun sign changes as a scrollable timeline.
- [ ] **AC-6:** Progressed Aspects section lists progressed planets within 1-degree orb of natal planets.
- [ ] **AC-7:** Tapping cards/aspects expands to show interpretations.
- [ ] **AC-8:** Without a natal chart, a "Calculate your chart" message appears.

### Technical Criteria
- [ ] **TC-1:** Progressed date computation: `birth_date + floor(age_in_years) days` matches expected dates for known test cases.
- [ ] **TC-2:** Progressed Moon sign computed from planet positions at the progressed date.
- [ ] **TC-3:** Moon next sign change forecast uses degree-to-boundary / speed formula.
- [ ] **TC-4:** Progressed aspects use 1-degree maximum orb for all aspect types.
- [ ] **TC-5:** Only Sun, Moon, Mercury, Venus, Mars included in progressed chart (outer planets excluded).
- [ ] **TC-6:** Results cached in `st_progressed_charts` with profile_id uniqueness (one-to-one).
- [ ] **TC-7:** Cascade delete removes progressed chart when profile is deleted.

### Negative Criteria
- [ ] **NC-1:** This feature must NOT work without a natal chart.
- [ ] **NC-2:** This feature must NOT make network requests.
- [ ] **NC-3:** Outer planet progressions (Jupiter through Pluto) must NOT appear in the planet list (they are meaningless in progressions).

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Progressed Moon card: prominent glass surface with moon glyph, sign name large, degree, and "Changes to [next sign] in ~[N] years" subtitle. Accent border `#8B5CF6`.
- Progressed Sun card: glass surface, smaller than Moon card
- Planet rows: glass list items with planet glyph, sign, degree
- Sign Change Timeline: horizontal scrollable timeline with dots on a line. Past changes on the left, future on the right. Current position marked with accent dot.
- Progressed aspects: glass list items with aspect symbol between progressed and natal planet glyphs

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/stars/progressions`
- Moon and Sun cards side-by-side on desktop
- Timeline as a horizontal scrollable component
- Planet list and aspects in a two-column layout

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Computing your progressions..." | Computing chart |
| No Chart | "Calculate your natal chart to view progressions" with CTA | No natal chart |
| Success | Full progressions display with all sections | Data computed/cached |
| Error | "Could not compute progressions. Try again." | Computation failure |
| Too Young | "Progressions become meaningful after age 1." | User under age 1 |

## Test Requirements

### Unit Tests
- [ ] `computeProgressedDate`: age 30 -> birth_date + 30 days
- [ ] `computeProgressedDate`: age 0.5 -> birth_date + 0 days (floor)
- [ ] `computeProgressedDate`: handles leap year birth dates
- [ ] `forecastMoonSignChange`: correctly computes years to next sign boundary
- [ ] `forecastMoonSignChange`: handles wrap-around from Pisces to Aries
- [ ] `detectProgressedAspects`: finds aspects within 1-degree orb
- [ ] `detectProgressedAspects`: excludes outer planets
- [ ] Progressed chart CRUD: create, get by profile, update (replace), cascade delete

### Integration Tests
- [ ] Full flow: profile with natal chart -> compute progressions -> display Moon/Sun/planets/aspects
- [ ] Update flow: time passes -> recompute -> progressed positions update

### QA Verification Script
1. Open MyStars, ensure a profile with full natal chart exists
2. Navigate to Progressions screen
3. Verify: Progressed Moon card shows sign, degree, years until change -- AC-1
4. Verify: Moon card interpretation is 2-3 sentences -- AC-2
5. Verify: Progressed Sun card shows sign and degree -- AC-3
6. Verify: Mercury, Venus, Mars listed in Progressed Planets -- AC-4
7. Verify: Sign Change Timeline shows past and future changes -- AC-5
8. Check for any progressed aspects listed
9. If aspects exist, verify they are within 1-degree orb -- AC-6
10. Tap Moon card
11. Verify: interpretation expands -- AC-7
12. Delete natal chart, reopen Progressions
13. Verify: "Calculate your chart" message shown -- AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to progressions screen, verify all sections
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Complexity score is 2.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for progressed date and Moon sign change forecast

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No progressed chart computation exists. The `st_saved_charts` table can store generic chart JSON but has no structure for progressed chart specific fields (progressed date, moon sign change forecast, progressed aspects). The Swiss Ephemeris engine (ST-004) may or may not be built yet.

### After This Work
- New `engine/progressions.ts` with progressed date computation, Moon/Sun tracking, sign change forecasting
- Progressed interpretation text in `engine/interpretations.ts`
- New `st_progressed_charts` table with V2 migration (one-to-one with profiles)
- Progressed chart CRUD
- Mobile and web screens with Moon highlight, Sun card, planet list, timeline, and aspects

### Files Changed
- `modules/stars/src/engine/progressions.ts` -- progressions engine
- `modules/stars/src/engine/interpretations.ts` -- progressed chart interpretation text
- `modules/stars/src/db/schema.ts` -- V2 migration adding st_progressed_charts
- `modules/stars/src/db/crud.ts` -- progressed chart CRUD
- `modules/stars/src/types.ts` -- ProgressedChart, ProgressedMoon schemas
- `modules/stars/src/definition.ts` -- V2 migration entry, navigation update
- `modules/stars/src/__tests__/progressions.test.ts` -- tests
- `apps/mobile/app/(stars)/progressions.tsx` -- mobile screen
- `apps/web/app/stars/progressions/page.tsx` -- web page

### Known Limitations
- Like Solar Return, this feature depends on the Swiss Ephemeris engine (ST-004) for accurate planet positions at the progressed date. Without it, approximate positions can be computed using simplified orbital mechanics, but precision will be lower (1-2 degrees vs sub-degree).
- The sign change timeline forecast is an approximation: it uses the Moon's average speed at the progressed date to estimate when it crosses the next sign boundary. Actual speed varies slightly.
- Outer planet progressions are intentionally excluded. In secondary progressions, Jupiter through Pluto move so slowly that they are effectively identical to their natal positions. Including them would add visual noise without analytical value.

### Context for Next Agent
- The core computation is simple: `progressed_date = birth_date + floor(age_in_years)` calendar days. Then compute planet positions for that date using the same engine as natal charts.
- The Progressed Moon is the star of the show (pun intended). It moves ~12-14 degrees per progressed year and changes signs every ~2.5 years. Make it visually prominent.
- The sign change timeline should show at least 5 past and 5 future sign changes for the Moon, plus the Sun's sign changes (much rarer, ~every 30 years). Use the formula: `years_to_change = degrees_to_boundary / speed_per_year`.
- This is a one-to-one relationship: each profile has exactly one progressed chart. When recomputing, replace the existing chart rather than creating a new row.
