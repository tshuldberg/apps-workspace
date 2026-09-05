# Feature Spec: Transit Tracking

## Metadata
- **Module:** stars
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 4 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3-4
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Existing birth profile CRUD, transit CRUD (basic), astro engine
- **Blocks:** Astrology Journal (uses active transits for context capture)
- **Spec Reference:** SPEC-mystars.md ST-008 (Planetary Transit Tracking)

## Business Context

### Why This Feature Exists
Transit tracking is the core "personalized cosmic weather" feature. It compares current planet positions against the user's natal chart to show which transits are active, upcoming, and recent. This is what makes an astrology app feel personal rather than generic. Co-Star and The Pattern both center their daily experience on personalized transits.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Co-Star | Yes | Free (basic transits), Premium (full) | Daily personalized transit updates, push notifications, social sharing |
| TimePassages | Yes | Premium | Detailed transit timeline with exact dates, orbs, interpretations |
| The Pattern | Yes | Premium ($120/yr) | "Timing" feature showing personal cycles, proprietary algorithm |
| Nebula | Yes | Premium ($50/yr) | Transit calendar with natal chart overlay |
| Stardust | Yes | Free (basic) | Major transits only, simplified |

### Target User
Dedicated Practitioners who track how current planetary positions aspect their natal chart. Spiritual Explorers who want to understand why certain days feel different. Users migrating from TimePassages who want the same transit depth with modern UX.

## Technical Context

### Where This Lives in MyLife

```
modules/stars/src/engine/transits.ts              -- Transit detection and significance engine
modules/stars/src/engine/interpretations.ts        -- Transit interpretation text library
modules/stars/src/db/schema.ts                     -- V2 migration: st_transit_events table
modules/stars/src/db/crud.ts                       -- Transit event CRUD (extended)
modules/stars/src/types.ts                         -- TransitEvent, TransitSignificance schemas
modules/stars/src/__tests__/transits.test.ts       -- Engine + CRUD tests
apps/mobile/app/(stars)/transit-timeline.tsx        -- Mobile transit timeline
apps/mobile/app/(stars)/transit-calendar.tsx        -- Mobile transit calendar view
apps/web/app/stars/transits/page.tsx               -- Web transit page
```

### Wireframe Position

```
Hub Dashboard
  └── MyStars card
       └── Transits tab ← EXISTING TAB
            └── Transit Timeline ← YOU ARE HERE
                 ├── Active (default segment)
                 ├── Upcoming
                 └── Recent
            └── Transit Calendar (sub-screen)
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS st_transit_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  transiting_body TEXT NOT NULL,
  natal_body TEXT NOT NULL,
  aspect_type TEXT NOT NULL,
  significance TEXT NOT NULL DEFAULT 'minor',
  current_orb REAL,
  exact_date TEXT NOT NULL,
  entering_orb_date TEXT,
  leaving_orb_date TEXT,
  is_applying INTEGER NOT NULL DEFAULT 1,
  interpretation_brief TEXT,
  interpretation_full TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id, transiting_body, natal_body, aspect_type, exact_date)
);

CREATE INDEX IF NOT EXISTS st_transit_events_profile_date_idx ON st_transit_events(profile_id, exact_date);
CREATE INDEX IF NOT EXISTS st_transit_events_date_idx ON st_transit_events(exact_date);
CREATE INDEX IF NOT EXISTS st_transit_events_significance_idx ON st_transit_events(significance);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing `engine/astro.ts` (getZodiacSign, calculateCompatibility), birth profile CRUD, existing basic transit CRUD
- **External:** None. Planet position computation uses on-device ephemeris data. For V1 without Swiss Ephemeris, Sun and Moon transits can be approximated.
- **Cross-Module:** Astrology Journal feature consumes active transits for context auto-capture.

## Functional Requirements

### User Stories
1. As a Dedicated Practitioner, I want to see which planets are currently aspecting my natal chart, so that I can understand the astrological influences affecting my life right now.
2. As a Spiritual Explorer, I want to see upcoming transits for the next 30 days, so that I can prepare for and work with upcoming cosmic energy.
3. As a Casual Stargazer, I want to filter transits by significance (Major vs Minor), so that I only see the most impactful ones.

### Behavior Specification

1. User taps the "Transits" tab in MyStars.
2. System shows the Transit Timeline screen with a segmented control: Active / Upcoming / Recent.
3. **Active tab** (default): Lists transits currently within orb, sorted by tightest orb first. Each card shows: significance badge (Major=orange, Minor=gray), transit name (e.g., "Saturn square natal Moon"), orb, progress bar from entering orb to exact to leaving orb, and a brief summary.
4. **Upcoming tab**: Lists transits becoming exact within 30 days, sorted by date.
5. **Recent tab**: Lists transits that were exact within the past 14 days, sorted by most recent.
6. Filter chip row: "All", "Major Only", "Minor Only".
7. User taps a transit card: expands to show a detailed 3-5 paragraph interpretation.
8. Below the transit list, a "Transit Calendar" link navigates to a monthly calendar view with transit dates marked by colored dots.
9. Pull-to-refresh: recalculates current positions and updates orbs.

### Edge Cases
- No natal chart computed: show message "Calculate your natal chart to track transits" with a button to navigate to the natal chart screen.
- No active transits: show "No active transits" with a suggestion to check Upcoming.
- Retrograde station within orb: a transit may become exact, separate, and become exact again. Record as a single event with the earliest exact date.
- Moon transits are very brief (hours): compute at 2-hour increments if lunar transits are included, or filter them out for a cleaner view.
- Transit card count could be large (50+ for all bodies): default to Major Only filter for users with many transits.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Transit Timeline opens with the Active tab selected by default.
- [ ] **AC-2:** Each transit card shows significance badge, transit name, orb, and brief summary.
- [ ] **AC-3:** Active transits have a progress bar showing position within orb window.
- [ ] **AC-4:** Segmented control switches between Active, Upcoming, and Recent views.
- [ ] **AC-5:** Filter chips (All, Major Only, Minor Only) filter the transit list.
- [ ] **AC-6:** Tapping a transit card expands to show a detailed interpretation.
- [ ] **AC-7:** "Transit Calendar" link shows a monthly calendar with transit dots.
- [ ] **AC-8:** Pull-to-refresh updates transit orbs and positions.
- [ ] **AC-9:** Without a natal chart, a "Calculate your chart" message appears instead.

### Technical Criteria
- [ ] **TC-1:** Major transits are correctly classified: transiting body is saturn, uranus, neptune, or pluto.
- [ ] **TC-2:** Transit events cached in `st_transit_events` with profile+body+aspect+date uniqueness.
- [ ] **TC-3:** Cascade delete removes transit events when a profile is deleted.
- [ ] **TC-4:** Active transits are sorted by tightest orb first.
- [ ] **TC-5:** Date range: today minus 14 days to today plus 30 days.
- [ ] **TC-6:** Orb calculation: `abs(transiting_longitude - natal_longitude)` with 360-degree wrap handling.

### Negative Criteria
- [ ] **NC-1:** This feature must NOT show transits if no natal chart exists. Do not show generic data.
- [ ] **NC-2:** This feature must NOT make network requests.
- [ ] **NC-3:** A planet must NOT transit itself (transiting_body != natal_body).

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Transit cards: glass surface with significance badge
- Major badge: `#FF9500` (orange), Minor badge: `rgba(255,255,255,0.4)` (gray)
- Progress bar: `#8B5CF6` fill on `rgba(255,255,255,0.06)` track
- Segmented control: standard Expo segment component with accent color
- Transit calendar dots: orange for Major, gray for Minor

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/stars/transits`
- Transit cards in a centered column
- Calendar view as a sub-route: `/stars/transits/calendar`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Scanning the sky..." shimmer | Computing transits |
| Empty | "No [active/upcoming/recent] transits" + tab suggestion | No matching transits |
| Error | "Could not compute transits. Pull to retry." | Computation failure |
| Success | Transit cards sorted and filtered | Data loaded |
| No Chart | "Calculate your natal chart to track transits" with CTA | No natal chart computed |

## Test Requirements

### Unit Tests
- [ ] `detectTransit`: correctly identifies conjunction (0-degree aspect) within orb
- [ ] `detectTransit`: correctly identifies opposition (180-degree aspect) with wrap handling
- [ ] `classifySignificance`: saturn/uranus/neptune/pluto -> major, all others -> minor
- [ ] `computeOrb`: handles 360-degree wrap (e.g., 355 vs 5 degrees)
- [ ] `isApplying`: returns true when orb is decreasing, false when increasing
- [ ] Transit event CRUD: create, query by profile+date, query active/upcoming/recent, cascade delete

### Integration Tests
- [ ] Full flow: create profile with natal data -> compute transits -> display in timeline
- [ ] Filter flow: compute transits -> filter Major Only -> only major transits shown
- [ ] Refresh flow: pull-to-refresh -> orbs update to reflect current positions

### QA Verification Script
1. Open MyStars, ensure a profile with sun/moon/rising signs exists
2. Navigate to Transits tab
3. Verify: Active tab is selected by default -- AC-1
4. Verify: transit cards show badge, name, orb, summary -- AC-2
5. Verify: active transit cards have progress bars -- AC-3
6. Tap Upcoming segment
7. Verify: upcoming transits shown sorted by date -- AC-4
8. Tap "Major Only" filter
9. Verify: only Major transits displayed -- AC-5
10. Tap a transit card
11. Verify: card expands with detailed interpretation -- AC-6
12. Tap "Transit Calendar" link
13. Verify: calendar view with transit dots -- AC-7
14. Pull to refresh
15. Verify: transit data refreshes -- AC-8
16. Delete all profiles, reopen Transits
17. Verify: "Calculate your chart" message appears -- AC-9

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to transits, test all segments and filters
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for transit detection engine

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Basic transit CRUD exists (`createTransit`, `getTransitsByProfile`, `getTransitsByDate`) for manual transit logging. No automated transit detection, no significance classification, no orb computation, no interpretation text, no timeline UI.

### After This Work
- New `engine/transits.ts` with automated transit detection, orb computation, significance classification
- Extended transit schema with st_transit_events table
- Full timeline and calendar UI on mobile and web
- Cached transit computations with refresh capability
- Interpretation text library for transit aspect combinations

### Files Changed
- `modules/stars/src/engine/transits.ts` -- transit detection engine
- `modules/stars/src/engine/interpretations.ts` -- transit interpretation text
- `modules/stars/src/db/schema.ts` -- V2 migration adding st_transit_events
- `modules/stars/src/db/crud.ts` -- extended transit CRUD
- `modules/stars/src/types.ts` -- TransitEvent, TransitSignificance schemas
- `modules/stars/src/definition.ts` -- V2 migration entry
- `modules/stars/src/__tests__/transits.test.ts` -- tests
- `apps/mobile/app/(stars)/transit-timeline.tsx` -- mobile timeline
- `apps/mobile/app/(stars)/transit-calendar.tsx` -- mobile calendar
- `apps/web/app/stars/transits/page.tsx` -- web page

### Known Limitations
- Full transit detection requires accurate planet position computation (Swiss Ephemeris, ST-004). V1 can use simplified Sun transit detection (Sun position is deterministic from getZodiacSign) and approximate other planet positions, or use pre-computed transit tables for the current year.
- Moon transits occur every few hours and generate significant noise. Consider excluding Moon transits by default or showing them only in a separate "Lunar Transits" section.
- Aspect orbs vary by tradition. Use standard orbs: conjunction 8 deg, opposition 8 deg, trine 8 deg, square 7 deg, sextile 6 deg. These can be made configurable in Settings later.

### Context for Next Agent
- The existing `st_transits` table stores manually logged transits. The new `st_transit_events` table stores automatically detected transits. Do not modify the existing table; create the new one alongside it.
- Transit interpretation text follows the pattern: `TRANSIT_INTERPRETATIONS[transiting_body][natal_body][aspect_type]` = { brief, full }. This is a large text library (~400KB). Consider generating it as a separate JSON file bundled at build time.
- The `is_applying` flag is critical for UX: it determines whether the transit is building toward exact (increasing intensity) or separating (fading).
