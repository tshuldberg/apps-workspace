# Feature Spec: Friend Compatibility

## Metadata
- **Module:** stars
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 4 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3-4
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Existing birth profile CRUD, calculateCompatibility engine
- **Blocks:** none
- **Spec Reference:** SPEC-mystars.md ST-007 (Zodiac Compatibility / Synastry)

## Business Context

### Why This Feature Exists
Zodiac compatibility is the #1 social hook in astrology apps. Users want to compare their chart with friends, partners, and family. Co-Star built their entire viral growth loop on shareable compatibility results. This feature takes the existing `calculateCompatibility` engine (element-based scoring) and wraps it in a full UI with profile selection, cached results, and multi-dimension analysis.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Co-Star | Yes | Free (basic), Premium (detailed) | Full synastry with social sharing, friend graph, daily compatibility updates |
| The Pattern | Yes | Premium ($120/yr) | Deep "bond" analysis using proprietary algorithm, relationship timeline |
| Nebula | Yes | Premium ($50/yr) | Synastry charts with aspect overlays |
| Stardust | Yes | Free (basic) | Simple sun sign compatibility |
| TimePassages | Yes | Premium | Full synastry with aspect tables, educational |

### Target User
Compatibility Seekers (ages 18-35) who enter friends' and partners' birth data to check relationship dynamics. This is the single most viral feature in astrology apps. Users coming from Co-Star who want the same compatibility analysis without the data harvesting.

## Technical Context

### Where This Lives in MyLife

```
modules/stars/src/engine/compatibility.ts     -- Extended compatibility engine
modules/stars/src/db/schema.ts                -- V2 migration: st_compatibility_results table
modules/stars/src/db/crud.ts                  -- Compatibility CRUD operations
modules/stars/src/types.ts                    -- CompatibilityAnalysis, FullSynastryResult schemas
modules/stars/src/__tests__/compatibility.test.ts -- Engine + CRUD tests
apps/mobile/app/(stars)/compatibility.tsx      -- Profile selection screen
apps/mobile/app/(stars)/compatibility-results.tsx -- Results screen
apps/web/app/stars/compatibility/page.tsx      -- Web compatibility page
```

### Wireframe Position

```
Hub Dashboard
  └── MyStars card
       └── Match tab ← EXISTING TAB
            └── Profile Selection ← YOU ARE HERE
            └── Compatibility Results
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS st_compatibility_results (
  id TEXT PRIMARY KEY,
  profile_a_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  profile_b_id TEXT NOT NULL REFERENCES st_birth_profiles(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL DEFAULT 'quick_match',
  overall_score INTEGER NOT NULL,
  emotional_score INTEGER,
  communication_score INTEGER,
  attraction_score INTEGER,
  growth_score INTEGER,
  element_compatibility TEXT NOT NULL,
  sun_sign_description TEXT,
  top_aspects TEXT,
  challenge_aspects TEXT,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_a_id, profile_b_id)
);

CREATE INDEX IF NOT EXISTS st_compat_profiles_idx ON st_compatibility_results(profile_a_id, profile_b_id);
CREATE INDEX IF NOT EXISTS st_compat_computed_idx ON st_compatibility_results(computed_at);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing `engine/astro.ts` (calculateCompatibility, getZodiacElement), birth profile CRUD
- **External:** None.
- **Cross-Module:** None directly, though compatibility data could inform Journal module entries.

## Functional Requirements

### User Stories
1. As a Compatibility Seeker, I want to select two birth profiles and see a compatibility score, so that I can understand our astrological dynamics.
2. As a Casual Stargazer, I want a quick compatibility check using just sun signs, so that I can get a fast result without entering full birth data.
3. As a Dedicated Practitioner, I want multi-dimension scoring (emotional, communication, attraction, growth), so that I get nuanced relationship insights.

### Behavior Specification

1. User taps the "Match" tab in MyStars.
2. System shows the Compatibility Selection screen: Person 1 defaults to the primary profile; Person 2 shows "Select a profile" placeholder.
3. User taps Person 2 card and selects a profile from the picker modal.
4. "Compare" button becomes enabled.
5. User taps "Compare".
6. System checks if a cached result exists for this pair.
7. If cached, system shows results immediately. If not, system computes compatibility.
8. **Quick Match mode** (default): Shows element compatibility card, overall score (0-100%), sun-sign description (2-3 paragraphs).
9. If both profiles have sun, moon, and rising signs: a "Full Analysis" toggle becomes available.
10. **Full Analysis mode**: Shows five dimension cards (Emotional, Communication, Attraction, Growth, Challenges) with individual scores and key aspects.
11. User can tap a dimension card to expand and see contributing aspects.
12. Below the results, a "Recent Comparisons" list shows up to 10 past comparisons.

### Edge Cases
- Only one profile exists: show message "Add another profile to compare compatibility" with link to Add Profile screen.
- Same profile selected for both: "Compare" button disabled, message "Select two different profiles".
- Profile deleted after comparison: cascade delete removes the cached result.
- Maximum 100 cached results: oldest purged on creation of new ones.
- Profile A + Profile B produces same result as B + A: always store with lexicographically smaller ID as profile_a_id.
- Profile has no sun sign set: fall back to computing sun sign from birthDate using getZodiacSign.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Match tab shows Person 1 (primary profile) and Person 2 (placeholder) selection cards.
- [ ] **AC-2:** Selecting two different profiles enables the "Compare" button.
- [ ] **AC-3:** Tapping "Compare" shows results with an overall compatibility percentage in a circular progress indicator (animates from 0% to final value over 800ms).
- [ ] **AC-4:** Quick Match mode shows element compatibility card and sun-sign description.
- [ ] **AC-5:** Full Analysis toggle appears when both profiles have sun, moon, and rising signs.
- [ ] **AC-6:** Full Analysis mode shows 5 dimension cards (Emotional, Communication, Attraction, Growth, Challenges) with scores.
- [ ] **AC-7:** Tapping a dimension card expands it to show contributing aspects.
- [ ] **AC-8:** Recent comparisons list shows up to 10 past results, tappable to view cached results.
- [ ] **AC-9:** Comparing the same two profiles in reverse order shows the same result.

### Technical Criteria
- [ ] **TC-1:** Quick Match score matches existing `calculateCompatibility` engine output for the same sign pair.
- [ ] **TC-2:** Results are cached in `st_compatibility_results` and loaded from cache on subsequent views.
- [ ] **TC-3:** Profile pair is stored in canonical order (lexicographically smaller ID as profile_a_id).
- [ ] **TC-4:** Cascade delete removes compatibility results when a profile is deleted.
- [ ] **TC-5:** Maximum 100 cached results enforced; oldest purged automatically.

### Negative Criteria
- [ ] **NC-1:** This feature must NOT send compatibility data over the network.
- [ ] **NC-2:** This feature must NOT allow comparing a profile with itself.
- [ ] **NC-3:** Deleting a profile must NOT leave orphaned compatibility results.

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Profile selection cards: glass surface with profile name, sun sign glyph, and accent border
- Circular progress indicator: `#8B5CF6` (stars accent) stroke
- Dimension cards: glass cards with score bars using accent color fill
- Element compatibility badge: colored by element (fire=red, earth=green, air=yellow, water=blue)

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/stars/compatibility`
- Side-by-side profile selection on wider screens
- Dimension cards in a 2x2 grid on desktop, stacked on mobile

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Comparing charts..." with spinner | Computing compatibility |
| Empty | "Add another profile to compare" with CTA | Only 1 profile exists |
| Error | "Could not compute compatibility. Try again." | Computation failure |
| Success | Full results with score and dimensions | Data computed or cached |
| Partial | Quick Match only (no Full Analysis toggle) | Profiles lack moon/rising data |

## Test Requirements

### Unit Tests
- [ ] `computeQuickMatch`: returns same score as existing `calculateCompatibility` for all element pairs
- [ ] `computeQuickMatch`: clamps result to [20, 95] range
- [ ] `computeQuickMatch`: same-sign bonus applied correctly (+5%)
- [ ] Canonical pair ordering: always stores smaller ID as profile_a_id
- [ ] Full Analysis scoring: dimension scores sum/average to approximately the overall score
- [ ] Compatibility CRUD: create, get by pair, list recent (limit 10), cascade delete

### Integration Tests
- [ ] Full flow: select 2 profiles -> compute -> persist -> reload screen -> cached result displayed
- [ ] Reverse pair: comparing B,A after A,B returns same cached result
- [ ] Profile deletion: delete profile -> verify compatibility result cascade deleted

### QA Verification Script
1. Open MyStars module, go to Match tab
2. Verify: Person 1 shows primary profile, Person 2 shows placeholder -- AC-1
3. Tap Person 2, select a different profile
4. Verify: "Compare" button is enabled -- AC-2
5. Tap "Compare"
6. Verify: circular progress animates to show overall score -- AC-3
7. Verify: element compatibility card and sun-sign description shown -- AC-4
8. If both profiles have moon/rising signs, verify Full Analysis toggle appears -- AC-5
9. Toggle Full Analysis
10. Verify: 5 dimension cards with individual scores -- AC-6
11. Tap a dimension card
12. Verify: card expands to show aspects -- AC-7
13. Go back to Match tab
14. Verify: recent comparison appears in the list -- AC-8
15. Compare same profiles in reverse order
16. Verify: same score displayed -- AC-9

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to compatibility screen, verify all states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for compatibility scoring

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
`calculateCompatibility` in `engine/astro.ts` returns a single 0-100 score based on element pairs. No UI, no caching, no multi-dimension analysis, no profile selection flow. The existing `CompatibilityResultSchema` in types.ts defines a basic result shape.

### After This Work
- Extended `engine/compatibility.ts` with Quick Match and Full Analysis computations
- New `st_compatibility_results` table with V2 migration
- Full profile selection and results UI on mobile and web
- Cached results with canonical pair ordering
- Recent comparisons list

### Files Changed
- `modules/stars/src/engine/compatibility.ts` -- extended compatibility engine
- `modules/stars/src/db/schema.ts` -- V2 migration adding st_compatibility_results
- `modules/stars/src/db/crud.ts` -- compatibility CRUD
- `modules/stars/src/types.ts` -- CompatibilityAnalysis, FullSynastryResult schemas
- `modules/stars/src/definition.ts` -- V2 migration entry
- `modules/stars/src/__tests__/compatibility.test.ts` -- tests
- `apps/mobile/app/(stars)/compatibility.tsx` -- selection screen
- `apps/mobile/app/(stars)/compatibility-results.tsx` -- results screen
- `apps/web/app/stars/compatibility/page.tsx` -- web page

### Known Limitations
- Full Synastry (5-dimension analysis) requires full natal chart positions from the Swiss Ephemeris engine (ST-002, ST-004, ST-010). Initial implementation may support Quick Match only and stub Full Analysis behind a feature gate until those dependencies are built.
- The existing `calculateCompatibility` uses simple element-based scoring. The Full Analysis dimension scores are synthetic (derived from element compatibility plus sign-specific modifiers) until real aspect-based computation is available.

### Context for Next Agent
- Always normalize the profile pair to canonical order before storing or querying: `profile_a_id = min(id1, id2)`, `profile_b_id = max(id1, id2)`.
- The `CompatibilityResultSchema` already exists in `types.ts` with sign1, sign2, score, element1, element2, description. The new schema extends this with the full analysis fields.
- Element pair descriptions should be stored in `engine/interpretations.ts` alongside moon phase interpretations.
