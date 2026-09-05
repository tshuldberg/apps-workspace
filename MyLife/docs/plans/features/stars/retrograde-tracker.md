# Feature Spec: Retrograde Tracker

## Metadata
- **Module:** stars
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3-4
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Existing astro engine; benefits from Zodiac Calendar (event detection)
- **Blocks:** none
- **Spec Reference:** SPEC-mystars.md ST-014 (Retrograde Alerts)

## Business Context

### Why This Feature Exists
"Is Mercury in retrograde?" is the single most asked astrology question by the general public. A dedicated retrograde dashboard with survival tips makes astrology accessible and practical. Co-Star and The Pattern both prominently feature retrograde status. This feature is lightweight, requires no birth profile, and serves as an engagement hook for casual users.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Co-Star | Yes | Free | Retrograde status in daily view, push notifications when retrogrades begin |
| The Pattern | Yes | Free (basic) | "Timing" section shows retrograde periods with personal impact |
| Stardust | Yes | Free | Mercury retrograde countdown and status banner |
| Night Sky | No | N/A | Focuses on sky observation, not astrological retrogrades |
| TimePassages | Yes | Premium | Retrograde stations listed in transit calendar |

### Target User
Every MyStars user. Retrograde status is the most universally understood astrological concept. Casual Stargazers who just want to know "is Mercury retrograde?". Spiritual Explorers who want actionable survival tips for navigating retrograde periods.

## Technical Context

### Where This Lives in MyLife

```
modules/stars/src/engine/retrograde.ts            -- Retrograde detection and status engine
modules/stars/src/engine/retrograde-tips.ts        -- Survival tips text library
modules/stars/src/types.ts                         -- RetrogradeStatus, RetrogradeBanner schemas
modules/stars/src/__tests__/retrograde.test.ts     -- Engine tests
apps/mobile/app/(stars)/retrograde-dashboard.tsx   -- Mobile retrograde dashboard
apps/web/app/stars/retrogrades/page.tsx            -- Web retrograde page
```

### Wireframe Position

```
Hub Dashboard
  └── MyStars card
       └── Chart tab
       └── Transits tab
            └── Retrograde Dashboard ← Accessible from Transits or as top-level entry
                 ├── Status Banner
                 ├── Currently Retrograde section
                 └── Upcoming Retrogrades section
```

### Data Model

No new SQLite table required. Retrograde status is a transient computation cached in memory for the session. If the Zodiac Calendar feature is built first, retrograde station events will already be in `st_zodiac_events` and can be queried.

For standalone operation without Zodiac Calendar:

```typescript
// Computed in-memory, not persisted
interface RetrogradeStatus {
  body: Planet;
  isRetrograde: boolean;
  retrogradeStart: string | null;  // ISO date
  retrogradeEnd: string | null;    // ISO date
  retrogradeSign: ZodiacSign | null;
  progress: number | null;         // 0.0 to 1.0
  survivalTips: string[];          // 3-5 tips
  interpretation: string;          // 2-3 paragraphs
  daysUntilStart: number | null;   // null if currently active
}
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, if querying zodiac events), existing `engine/astro.ts`
- **External:** None. Retrograde detection uses planet speed sign (positive = direct, negative = retrograde). For V1 without Swiss Ephemeris, use pre-computed retrograde date tables for 2025-2027.
- **Cross-Module:** None.

## Functional Requirements

### User Stories
1. As a Casual Stargazer, I want a glanceable dashboard showing whether Mercury is retrograde, so that I can check at any time without searching online.
2. As a Spiritual Explorer, I want practical survival tips for each retrograde planet, so that I can adjust my plans and expectations.
3. As any user, I want to see upcoming retrogrades for the next 90 days, so that I can prepare in advance.

### Behavior Specification

1. User navigates to the Retrograde Dashboard.
2. System computes current retrograde status for all 8 applicable planets (Mercury through Pluto, excluding Sun and Moon which never retrograde).
3. **Status banner** at the top:
   - If Mercury is retrograde: amber banner "Mercury Retrograde in [Sign] until [date]"
   - If Mercury retrograde starts within 7 days: yellow banner "Mercury goes retrograde in [N] days"
   - If an inner planet (Venus, Mars) is retrograde but not Mercury: banner for that planet
   - Otherwise: green banner "All Clear -- No Inner Planet Retrogrades Active"
4. **Currently Retrograde section**: Cards for each currently retrograde planet showing planet name, "Retrograde in [Sign]", date range, progress bar, and 3-5 survival tips.
5. If no planets are retrograde: "No planets are currently retrograde. Enjoy the smooth sailing!"
6. **Upcoming Retrogrades section**: List of future retrograde periods within 90 days showing planet, sign, start date, countdown.
7. User taps a retrograde card: expands to show 2-3 paragraph interpretation.
8. User taps an upcoming entry: shows survival tips preemptively.

### Edge Cases
- Three or more planets simultaneously retrograde (common for outer planets): all shown in the active section with individual cards.
- Mercury retrograde ends tomorrow: progress bar shows ~95% complete.
- No retrogrades starting in the next 90 days: "No retrogrades starting in the next 90 days."
- Venus retrograde (rare, every 18 months): may not appear in 90-day window.
- Retrograde crosses two signs: use the sign where it stationed retrograde (not current sign).
- Survival tips text missing for a planet: show generic tips.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Retrograde Dashboard shows a status banner indicating current Mercury retrograde status.
- [ ] **AC-2:** Amber banner appears when Mercury is retrograde, with sign and end date.
- [ ] **AC-3:** Green "All Clear" banner appears when no inner planets are retrograde.
- [ ] **AC-4:** Currently retrograde planets have individual cards with progress bars and 3-5 survival tips.
- [ ] **AC-5:** Upcoming retrogrades section shows countdown days to start.
- [ ] **AC-6:** Tapping a retrograde card expands to show a detailed interpretation.
- [ ] **AC-7:** This feature works without any birth profile.

### Technical Criteria
- [ ] **TC-1:** Retrograde detection correctly identifies planets with negative speed as retrograde.
- [ ] **TC-2:** Progress computation: `(today - start) / (end - start)` clamped to [0, 1].
- [ ] **TC-3:** Banner priority: Mercury retrograde > Mercury approaching > other inner planet retrograde > all clear.
- [ ] **TC-4:** Status is computed on screen load and cached for the session.
- [ ] **TC-5:** Survival tips loaded from `retrograde-tips.ts` constant map keyed by planet.

### Negative Criteria
- [ ] **NC-1:** This feature must NOT require a birth profile.
- [ ] **NC-2:** This feature must NOT make network requests.
- [ ] **NC-3:** An "all clear" banner must NOT display when any inner planet is retrograde.

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Status banner: full-width, rounded corners. Amber (`#FF9500`), Yellow (`#FFD60A`), or Green (`#30D158`) background at 15% opacity with matching text color.
- Retrograde cards: glass surface with planet glyph and progress bar
- Progress bar: `#8B5CF6` fill with `rgba(255,255,255,0.06)` track
- Survival tips: bulleted list in secondary text color
- Upcoming entries: compact list items with countdown badge

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/stars/retrogrades`
- Banner spans full content width
- Cards in a single column, max-width 640px

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Shimmer overlay | Computing retrograde status |
| Active | Amber/yellow banner + retrograde cards | Planets are retrograde |
| All Clear | Green banner + "no planets retrograde" message | No planets retrograde |
| Error | "Could not determine retrograde status. Pull to retry." | Computation failure |
| Success | Full dashboard with active + upcoming sections | Data computed |

## Test Requirements

### Unit Tests
- [ ] `detectRetrograde`: negative planet speed -> isRetrograde = true
- [ ] `detectRetrograde`: positive planet speed -> isRetrograde = false
- [ ] `computeProgress`: at midpoint -> 0.5, at start -> 0.0, at end -> 1.0
- [ ] `determineBanner`: Mercury retrograde -> amber
- [ ] `determineBanner`: Mercury approaching (7 days) -> yellow
- [ ] `determineBanner`: Venus retrograde, Mercury direct -> Venus banner
- [ ] `determineBanner`: all direct -> green
- [ ] `getSurvivalTips`: returns 3-5 tips for each planet
- [ ] `getSurvivalTips`: returns generic tips for unknown planet

### Integration Tests
- [ ] Full flow: detect retrograde status -> render dashboard -> verify banner and cards match
- [ ] All clear flow: no retrogrades -> green banner -> "no planets" message

### QA Verification Script
1. Open MyStars module
2. Navigate to Retrograde Dashboard
3. Verify: status banner appears at top -- AC-1
4. If Mercury is retrograde: verify amber banner with sign and end date -- AC-2
5. If no inner planets retrograde: verify green "All Clear" banner -- AC-3
6. Verify: each retrograde planet has a card with progress bar and tips -- AC-4
7. Scroll to Upcoming section
8. Verify: upcoming retrogrades show countdown days -- AC-5
9. Tap a retrograde card
10. Verify: detailed interpretation expands -- AC-6
11. Delete all profiles, reopen dashboard
12. Verify: dashboard still works -- AC-7

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to retrograde dashboard, verify banner logic
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No retrograde tracking UI exists. The basic transit CRUD can store transits but has no concept of retrograde status, progress bars, survival tips, or banner logic. No pre-computed retrograde date data exists.

### After This Work
- New `engine/retrograde.ts` with retrograde detection, progress computation, banner logic
- New `engine/retrograde-tips.ts` with survival tips for all 8 planets
- Mobile and web dashboard screens
- Session-cached retrograde status (no SQLite persistence needed)

### Files Changed
- `modules/stars/src/engine/retrograde.ts` -- retrograde detection engine
- `modules/stars/src/engine/retrograde-tips.ts` -- survival tips constant map
- `modules/stars/src/types.ts` -- RetrogradeStatus, RetrogradeBanner schemas
- `modules/stars/src/__tests__/retrograde.test.ts` -- tests
- `apps/mobile/app/(stars)/retrograde-dashboard.tsx` -- mobile screen
- `apps/web/app/stars/retrogrades/page.tsx` -- web page

### Known Limitations
- Real-time retrograde detection from planet speeds requires the Swiss Ephemeris engine (ST-004). V1 should use pre-computed retrograde date tables for 2025-2027 (easily found in published ephemeris data). This gives accurate dates without the full computation engine.
- Pre-computed data means the feature cannot dynamically detect retrogrades beyond the data range. Update the table annually.

### Context for Next Agent
- Pre-computed retrograde dates are widely published. Bundle a JSON constant with Mercury, Venus, Mars, Jupiter, Saturn retrograde start/end/sign data for 2025-2027. Uranus, Neptune, Pluto retrograde for approximately half of each year, so include those too.
- The banner logic has a clear priority chain: Mercury Rx > Mercury approaching > other inner planet Rx > all clear. Implement as a simple if-else chain.
- Survival tips should be warm and practical, not doom-and-gloom. Examples: "Double-check emails before sending", "Back up your devices", "Revisit old projects rather than starting new ones."
