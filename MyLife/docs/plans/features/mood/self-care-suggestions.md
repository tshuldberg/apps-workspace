# Feature Spec: Self-Care Suggestions

## Metadata
- **Module:** mood
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [2] x3 + Complexity [3] x2 + CrossModule [4] x1 + PaidUser [3] x1
- **Sprint:** 3-4
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Existing mood entry CRUD, activity correlations, insight engine (`engine/insight.ts`), breathing engine
- **Blocks:** none

## Business Context

### Why This Feature Exists
Most mood trackers stop at showing data. Users see they feel bad but get no guidance on what to do about it. Bearable ($34.99/yr) and Reflectly ($59.99/yr) both offer self-care tips, but those are generic and cloud-dependent. MyMood's advantage is that it already has activity correlation data (Pearson r) and the insight engine -- self-care suggestions can be personalized based on the user's own data ("Exercise improved your mood by +1.3 points last month. Try a walk?"). The high cross-module score (4/5) reflects that suggestions can pull from other modules: recommend a breathing exercise, suggest journaling, or nudge a workout based on the user's history.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Bearable | Yes | Yes ($34.99/yr) | Generic self-care tips based on tracked factors, no personalization engine |
| Reflectly | Yes | Yes ($59.99/yr) | AI-generated self-care prompts, cloud-processed, personalized to journal entries |
| Daylio | No | N/A | Shows activity correlations but no actionable suggestions |
| Calm | Partial | Yes ($69.99/yr) | Recommends meditation sessions based on mood selection, not data-driven |
| Headspace | Partial | Yes ($69.99/yr) | Content recommendations based on selected focus areas, not mood data |

### Target User
Regular mood loggers (2+ weeks of data) who want actionable next steps, not just charts. Users who feel stuck and want the app to suggest what has worked for them before. Mental health app users migrating from Bearable/Reflectly who expect self-care guidance as a core feature.

## Technical Context

### Where This Lives in MyLife

```
modules/mood/src/
  types.ts                               -- New types: SelfCareSuggestion, SuggestionCategory, SuggestionSource
  engine/suggestions.ts                  -- NEW: Suggestion engine (data-driven + default catalog)
  db/suggestions.ts                      -- NEW: Suggestion history CRUD (track shown/completed/dismissed)
  db/schema-v3.ts                        -- V3 migration for mo_suggestion_history
  __tests__/suggestions.test.ts          -- NEW: Suggestion engine tests

apps/mobile/app/(mood)/
  components/SuggestionCard.tsx          -- NEW: Individual suggestion card component
  components/SuggestionFeed.tsx          -- NEW: Suggestion feed section

apps/web/app/mood/
  components/SuggestionCard.tsx          -- NEW: Web suggestion card
```

### Wireframe Position

```
Hub Dashboard
  └── MyMood card
       └── Today tab
            ├── Mood score (existing)
            ├── Quick log button (existing)
            └── Self-Care Suggestions ← YOU ARE HERE
                 ├── "Based on your data" header
                 ├── Personalized suggestion cards (1-3)
                 └── "More ideas" expandable section
```

Also appears in:
```
Insights tab
  └── Suggestions section (below insights)
```

### Data Model

```sql
-- V3 Migration: Suggestion history tracking

CREATE TABLE IF NOT EXISTS mo_suggestion_history (
  id TEXT PRIMARY KEY,
  suggestion_key TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('data_driven', 'catalog', 'cross_module')),
  shown_at TEXT NOT NULL,
  action TEXT CHECK(action IN ('completed', 'dismissed', 'ignored')),
  acted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS mo_suggestion_history_key_idx ON mo_suggestion_history(suggestion_key);
CREATE INDEX IF NOT EXISTS mo_suggestion_history_shown_idx ON mo_suggestion_history(shown_at DESC);
```

### Dependencies
- **Internal:** `@mylife/mood` (activity correlations, insight engine, breathing engine, settings), `@mylife/ui` (Cool Obsidian tokens)
- **External:** None (all on-device)
- **Cross-Module:** `@mylife/module-registry` (check which modules are enabled for cross-module suggestions). Optional integrations with: Journal (suggest journaling), Health (suggest breathing/meditation from Health module if enabled), Workouts (suggest exercise based on mood-workout correlation), Fast (suggest hydration if fasting module enabled)

## Functional Requirements

### User Stories
1. As a user who just logged a low mood, I want to see relevant self-care suggestions so that I know what I can do to feel better.
2. As a user with activity correlation data, I want suggestions that reflect my personal patterns (e.g., "Exercise improved your mood by +1.3 points") so that I can make data-informed decisions.
3. As a user who completed a suggestion, I want to mark it as done so that the system can track what works for me.
4. As a user who dismisses a suggestion, I want to see different suggestions next time.

### Behavior Specification

**Suggestion Generation:**
1. After a mood entry is logged, the suggestion engine runs.
2. Engine checks the entry score. If score <= 5 (low mood), generate 2-3 suggestions. If score > 5, generate 0-1 suggestions (lighter touch).
3. Suggestion sources (priority order):
   a. **Data-driven:** Query activity correlations. If an activity has Pearson r >= 0.2 and has not been logged today, suggest it. ("Exercise improved your mood by +1.3 points on average. Try it today?")
   b. **Cross-module:** If Workouts module enabled and user hasn't worked out today, suggest a quick workout. If Journal enabled, suggest journaling. If breathing not done today, suggest a breathing exercise.
   c. **Catalog:** Fallback to curated catalog of 25+ self-care activities organized by category (physical, social, creative, relaxation, mindfulness).
4. Deduplicate: don't show the same suggestion_key within 24 hours.
5. Rank by relevance: data-driven > cross-module > catalog. Within catalog, randomize.

**Display:**
1. Suggestion cards appear on the Today tab below the mood log.
2. Each card shows: icon, title, description, source tag ("Based on your data" / "Try something new"), and action buttons (checkmark = completed, X = dismiss).
3. Tapping a cross-module suggestion deep-links to that module's relevant screen.
4. Cards have a gentle entrance animation (slide up, 200ms).

**Tracking:**
1. When a suggestion is shown, record to `mo_suggestion_history` with source and category.
2. When user taps checkmark, update action to 'completed'.
3. When user taps X, update action to 'dismissed'.
4. If user ignores (navigates away), action stays null ('ignored' on next generation cycle).

### Edge Cases

- User has fewer than 7 days of data: skip data-driven suggestions, use catalog only.
- No activity correlations available (no activities logged): skip data-driven, use catalog.
- All catalog suggestions shown in last 24 hours: show the least-recently-shown suggestion.
- User has no other modules enabled: skip cross-module suggestions entirely.
- Score is exactly 5 (neutral): show 1 suggestion (lighter touch).
- Multiple mood entries in one day: generate suggestions only on the first entry or if score drops significantly (>= 2 points below previous).
- User has dismissed all data-driven suggestions: cycle back to catalog with "new ideas" framing.
- Module disabled and re-enabled: suggestion history is preserved.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** After logging a mood score <= 5, 2-3 suggestion cards appear on the Today tab
- [ ] **AC-2:** After logging a mood score > 5, 0-1 suggestion cards appear
- [ ] **AC-3:** Data-driven suggestions include the user's personal correlation metric (e.g., "+1.3 pts")
- [ ] **AC-4:** Cross-module suggestions show the linked module's icon and deep-link on tap
- [ ] **AC-5:** Tapping checkmark on a card marks it as completed with visual feedback (green checkmark, card fades)
- [ ] **AC-6:** Tapping X on a card dismisses it with slide-out animation
- [ ] **AC-7:** Same suggestion does not reappear within 24 hours
- [ ] **AC-8:** Suggestions work entirely offline
- [ ] **AC-9:** "More ideas" section shows additional catalog suggestions when expanded
- [ ] **AC-10:** Suggestion cards display with Cool Obsidian glass morphism styling

### Technical Criteria
- [ ] **TC-1:** Suggestion engine produces data-driven suggestions when activity Pearson r >= 0.2
- [ ] **TC-2:** Suggestion engine falls back to catalog when insufficient data (<7 days or no correlations)
- [ ] **TC-3:** Suggestion history records are created with correct source, category, and timestamps
- [ ] **TC-4:** Deduplication prevents same suggestion_key within 24 hours
- [ ] **TC-5:** V3 migration creates `mo_suggestion_history` table with correct constraints
- [ ] **TC-6:** Cross-module suggestions are only generated for enabled modules
- [ ] **TC-7:** Catalog contains at least 25 suggestions across 5 categories

### Negative Criteria
- [ ] **NC-1:** Suggestions must NOT require network access
- [ ] **NC-2:** Suggestions must NOT reference specific therapy or medical advice (keep to self-care activities)
- [ ] **NC-3:** Suggestion engine must NOT slow down mood entry creation (run async after save)
- [ ] **NC-4:** Dismissed suggestions must NOT reappear within 24 hours
- [ ] **NC-5:** Cross-module suggestions must NOT appear for modules the user has not enabled

## UI Specification

### Mobile (Expo)
- **Suggestion Card:** `rgba(255,255,255,0.04)` (glass) fill, `rgba(255,255,255,0.10)` (glassBorder) border, 12dp border radius, 16dp padding. Left: 32dp category icon in `#FB923C` (mood accent). Title: 16sp `#F0F0F5`, description: 14sp `rgba(240,240,245,0.65)`. Source tag: 11sp, pill shape, data-driven = `#FB923C` bg, catalog = `rgba(255,255,255,0.08)` bg.
- **Action Buttons:** Right side of card. Checkmark: 24dp, `#30D158` (success). X: 24dp, `rgba(240,240,245,0.65)` (textSecondary). 44dp tap targets.
- **Feed Layout:** Vertical stack below mood log area. Max 3 visible cards, "More ideas" expandable.
- **Animations:** Cards slide up on appear (translateY 20 -> 0, 200ms ease-out). Completed: green pulse then fade (300ms). Dismissed: slide right to exit (200ms).

### Web (Next.js)
- Same tokens via CSS variables.
- Cards in a column layout within the Today tab content area.
- Cross-module deep links navigate via Next.js router.
- Animations via CSS transitions.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (shimmer) | Suggestion engine computing |
| Empty | No suggestion section visible | Score > 7 or engine returns 0 suggestions |
| Error | Silent (no error UI, just no suggestions) | Engine failure |
| Success | 1-3 suggestion cards with actions | Suggestions generated |
| Partial | Mix of data-driven and catalog cards | Some data available, gaps filled by catalog |

## Test Requirements

### Unit Tests
- [ ] Suggestion engine: returns data-driven suggestions when correlations have r >= 0.2
- [ ] Suggestion engine: skips data-driven when less than 7 days of data
- [ ] Suggestion engine: falls back to catalog when no correlations available
- [ ] Suggestion engine: deduplicates by suggestion_key within 24 hours
- [ ] Suggestion engine: respects score threshold (low mood = 2-3 suggestions, high mood = 0-1)
- [ ] Suggestion engine: generates cross-module suggestions only for enabled modules
- [ ] Suggestion engine: returns at least 1 suggestion for any score <= 5
- [ ] Catalog: contains 25+ entries across 5 categories
- [ ] Suggestion history: creates record with correct fields
- [ ] Suggestion history: updates action to 'completed' or 'dismissed'
- [ ] Suggestion history: queries recently-shown suggestions for dedup

### Integration Tests
- [ ] Full flow: log low mood -> suggestions appear -> mark completed -> re-query -> different suggestion shown
- [ ] Cross-module: enable Workouts module -> log low mood -> verify workout suggestion appears
- [ ] Dedup: log mood, see suggestions, dismiss all, log another mood within 24hrs -> verify different suggestions

### QA Verification Script

1. Open app, navigate to MyMood
2. Log a mood entry with score 3 (low mood)
3. Verify: 2-3 suggestion cards appear on Today tab -- corresponds to AC-1
4. Verify: Cards use glass morphism styling with mood accent icon -- corresponds to AC-10
5. If activity correlations exist, verify: data-driven card shows personal metric -- corresponds to AC-3
6. Tap checkmark on first suggestion
7. Verify: Green pulse, card fades, marked as completed -- corresponds to AC-5
8. Tap X on second suggestion
9. Verify: Card slides out -- corresponds to AC-6
10. Log another mood entry (score 3) immediately
11. Verify: Dismissed/completed suggestions do not reappear -- corresponds to AC-7
12. Log a mood entry with score 8 (good mood)
13. Verify: 0-1 suggestion cards (lighter touch) -- corresponds to AC-2
14. Enable Workouts module from hub dashboard
15. Return to MyMood, log score 4
16. Verify: Cross-module "Try a workout" suggestion appears with workout icon -- corresponds to AC-4
17. Tap the cross-module suggestion
18. Verify: Deep-links to Workouts module
19. Navigate back to MyMood Today tab
20. Tap "More ideas" section
21. Verify: Additional catalog suggestions appear -- corresponds to AC-9
22. Enable airplane mode, log a mood score 2
23. Verify: Suggestions appear offline -- corresponds to AC-8
24. Test on web: navigate to /mood
25. Verify: Same suggestion behavior on web

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to Today tab, log low mood, verify suggestion cards appear and interact
- [ ] Batch QA: after 5 features in mood module, run `/qa` on mood URL

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for suggestion engine (data-driven ranking, dedup, score thresholds)

### Post-merge:
- [ ] `/parity-check` -- mood module has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyMood shows insights (via insight engine) and activity correlations but provides no actionable suggestions. Users must interpret data themselves and decide what to do. No suggestion catalog, no tracking of user actions on suggestions.

### After This Work
- V3 migration adds `mo_suggestion_history` table
- Suggestion engine generates personalized, data-driven suggestions based on activity correlations
- Cross-module suggestions leverage other enabled MyLife modules
- Curated catalog of 25+ self-care activities as fallback
- Suggestion feed on Today tab with completed/dismissed tracking
- 24-hour deduplication window

### Files Changed
- `modules/mood/src/types.ts` -- New types: SelfCareSuggestion, SuggestionCategory, SuggestionSource
- `modules/mood/src/db/schema-v3.ts` -- V3 migration SQL for mo_suggestion_history
- `modules/mood/src/db/suggestions.ts` -- NEW: Suggestion history CRUD
- `modules/mood/src/engine/suggestions.ts` -- NEW: Suggestion engine with data-driven, cross-module, and catalog sources
- `modules/mood/src/definition.ts` -- Add V3 migration, bump schemaVersion to 3
- `modules/mood/src/index.ts` -- Export new suggestion types, CRUD, engine functions
- `modules/mood/src/__tests__/suggestions.test.ts` -- NEW: Tests
- `apps/mobile/app/(mood)/components/SuggestionCard.tsx` -- NEW: Suggestion card component
- `apps/mobile/app/(mood)/components/SuggestionFeed.tsx` -- NEW: Suggestion feed section
- `apps/web/app/mood/components/SuggestionCard.tsx` -- NEW: Web suggestion card

### Known Limitations
- No machine learning. Suggestions are rule-based using Pearson r thresholds and catalog randomization.
- Cross-module suggestions are simple presence checks (is module enabled? was activity done today?), not deep integrations.
- Catalog is English-only for V1. Internationalization is a future concern.
- No push notification for suggestions (requires notification infrastructure).

### Context for Next Agent
- The activity correlation data is already available via `getActivityCorrelations()` in `db/crud.ts`. Use this directly for data-driven suggestions.
- Cross-module checks should use `@mylife/module-registry` to verify which modules are enabled before generating cross-module suggestions.
- The suggestion engine should be a pure function that takes correlation data + enabled modules + recent history as input and returns suggestion array. Keep it testable.
- The self-care catalog should be defined as a constant array in the engine file, not in a database table. It's static content.
