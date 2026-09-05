# Feature Spec: Affirmations Tracker

## Metadata
- **Module:** journal
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 6 (B+C Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** JR-001 (Rich Text Editor -- implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The Gratitude app ($23/yr) and Reflectly ($59.99/yr) both feature daily affirmations as engagement drivers. Affirmations create a daily touchpoint that brings users back to the app even on days they do not write a full entry. The affirmation streak creates a lightweight habit loop separate from the journaling streak. MyJournal can offer the same daily affirmation experience with a 100-affirmation built-in library, custom affirmation creation, and a favorite-weighted rotation algorithm, all stored locally.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gratitude (app) | Yes | $23/yr | Daily affirmations, vision boards, gratitude journal. Cloud-synced. |
| Reflectly | Yes | $59.99/yr | Daily affirmations integrated with AI journaling. Cloud-stored. |
| Stoic | Partial | $40/yr | Daily Stoic affirmations. Part of premium subscription. |
| Day One | No | N/A | No affirmation feature. |
| Daylio | No | N/A | No affirmation feature. |

### Target User
Gratitude practitioners and positive psychology enthusiasts who start each day with an affirmation. Users currently using the Gratitude app ($23/yr) or Reflectly ($59.99/yr) for daily affirmations. People building self-talk habits alongside journaling.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/affirmations/                  -- NEW: affirmation engine
modules/journal/src/affirmations/types.ts          -- Affirmation, AffirmationLog, AffirmationCategory types
modules/journal/src/affirmations/built-in.ts       -- 100 built-in affirmation definitions
modules/journal/src/affirmations/selection.ts      -- Daily selection algorithm, streak calculation
modules/journal/src/affirmations/index.ts          -- Barrel export
modules/journal/src/affirmations/__tests__/        -- Tests
modules/journal/src/db/affirmations.ts             -- NEW: CRUD for affirmations and logs
apps/mobile/app/(journal)/components/AffirmationCard.tsx -- Mobile daily affirmation card
apps/mobile/app/(journal)/affirmation-library.tsx        -- Mobile affirmation library
apps/web/app/journal/affirmations/page.tsx               -- Web affirmation library
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Today tab
            └── Daily Affirmation Card ← YOU ARE HERE (top of today tab)
       └── Settings
            └── Affirmation Library ← ALSO HERE
```

### Data Model

New tables in migration V4:

```sql
CREATE TABLE IF NOT EXISTS jn_affirmations (
  id TEXT PRIMARY KEY NOT NULL,
  text TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN (
      'self_worth', 'resilience', 'growth', 'health',
      'relationships', 'gratitude', 'productivity', 'peace'
    )),
  is_builtin INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_dismissed INTEGER NOT NULL DEFAULT 0,
  times_shown INTEGER NOT NULL DEFAULT 0,
  times_affirmed INTEGER NOT NULL DEFAULT 0,
  last_shown_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jn_affirmation_logs (
  id TEXT PRIMARY KEY NOT NULL,
  affirmation_id TEXT NOT NULL REFERENCES jn_affirmations(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('shown', 'affirmed', 'wrote_entry', 'dismissed')),
  entry_id TEXT REFERENCES jn_entries(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS jn_affirmations_dismissed_idx ON jn_affirmations(is_dismissed);
CREATE INDEX IF NOT EXISTS jn_affirmations_favorite_idx ON jn_affirmations(is_favorite);
CREATE INDEX IF NOT EXISTS jn_affirmations_category_idx ON jn_affirmations(category);
CREATE INDEX IF NOT EXISTS jn_affirmations_last_shown_idx ON jn_affirmations(last_shown_date);
CREATE INDEX IF NOT EXISTS jn_affirmation_logs_date_idx ON jn_affirmation_logs(log_date, action);
CREATE INDEX IF NOT EXISTS jn_affirmation_logs_aff_idx ON jn_affirmation_logs(affirmation_id);

INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('affirmationsEnabled', 'true');
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD, journal streak calculation from `engine/stats.ts`
- **External:** none (fully local)
- **Cross-Module:** none

## Functional Requirements

### User Stories
1. As a gratitude practitioner, I want to see a daily affirmation on my journal home screen and track which affirmations resonate with me.
2. As a daily journaler, I want to create custom affirmations and have them rotate alongside built-in ones.
3. As a therapeutic writer, I want to write a journal entry inspired by an affirmation with one tap.

### Behavior Specification

1. User enables Affirmations in Settings (default: on).
2. Daily Affirmation Card appears at the top of the Today tab.
3. **Daily selection algorithm:**
   a. Build active pool: all affirmations WHERE is_dismissed = 0.
   b. Sort by last_shown_date ASC NULLS FIRST (least recently shown first).
   c. Among ties, favorites get 2x weight (appear twice in the sorted list).
   d. Select the first item.
   e. Update: last_shown_date = today, times_shown += 1.
   f. Log action = 'shown' in jn_affirmation_logs.
   g. Cache today's selection so it remains stable throughout the day.
4. Card displays: affirmation text (large, centered), category label, action row.
5. **Actions:**
   a. "I Affirm" -- marks today's affirmation as acknowledged, updates affirmation streak, logs action = 'affirmed'.
   b. Heart icon -- toggles is_favorite.
   c. "Write About This" -- opens new entry with affirmation as first line, on save logs action = 'wrote_entry' with entry_id.
   d. "Skip" (x icon) -- sets is_dismissed = 1, loads next affirmation.
6. **Affirmation streak:** Consecutive days where at least one 'affirmed' or 'wrote_entry' log exists. Uses 1-day grace period (same as journal streak).
7. **Affirmation Library:** tabs for All, Built-in, Custom, Favorites, Dismissed. CRUD for custom affirmations. Swipe to favorite/dismiss.

### Edge Cases

- **All affirmations dismissed:** Card shows "No affirmations available. Add custom affirmations or reset dismissed ones." with "Reset Dismissed" button.
- **Single affirmation in pool:** Shows it every day.
- **First launch:** All last_shown_date values are null; select randomly.
- **Date change during active use:** Card refreshes on date boundary.
- **Custom affirmation text empty:** Validation blocks save with "Write your affirmation."
- **Custom affirmation exceeds 200 chars:** Character counter turns red, input blocked.
- **Built-in affirmation delete attempt:** Block with "Built-in affirmations cannot be deleted. You can dismiss it instead."
- **User taps "I Affirm" multiple times same day:** Only first tap counts. Button stays in "Affirmed" state.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Daily Affirmation Card appears at top of Today tab with affirmation text, category, and action row.
- [ ] **AC-2:** "I Affirm" button transitions card to "Affirmed" state and increments streak.
- [ ] **AC-3:** "Write About This" opens entry editor with affirmation as first line.
- [ ] **AC-4:** Heart icon toggles favorite status (filled/outlined).
- [ ] **AC-5:** "Skip" dismisses current affirmation and loads next from pool.
- [ ] **AC-6:** Affirmation Library shows All/Built-in/Custom/Favorites/Dismissed tabs.
- [ ] **AC-7:** Custom affirmations can be created, edited, and deleted.
- [ ] **AC-8:** Built-in affirmations cannot be edited or deleted (only dismissed).
- [ ] **AC-9:** Affirmation streak shows consecutive affirmed days with 1-day grace period.
- [ ] **AC-10:** Settings toggle controls affirmation visibility (default: on).
- [ ] **AC-11:** "Reset Dismissed" restores all dismissed affirmations to the pool.
- [ ] **AC-12:** Different affirmation shown each day (rotation, no immediate repetition).

### Technical Criteria
- [ ] **TC-1:** Migration V4 creates `jn_affirmations` (seeded with 100 built-in) and `jn_affirmation_logs` tables.
- [ ] **TC-2:** Built-in library: 100 affirmations across 8 categories (12-15 per category).
- [ ] **TC-3:** Selection algorithm: least-recently-shown first, favorites 2x weighted.
- [ ] **TC-4:** Streak calculation uses same logic as `calculateJournalStreak` with 1-day grace.
- [ ] **TC-5:** All affirmation actions logged in `jn_affirmation_logs` with correct action type.
- [ ] **TC-6:** Custom affirmation text max 200 characters, validated on create and edit.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Built-in affirmations must NOT be editable or deletable by the user.
- [ ] **NC-2:** Dismissing an affirmation must NOT delete it from the database (only excluded from rotation).
- [ ] **NC-3:** "I Affirm" tapped multiple times same day must NOT increment streak multiple times.
- [ ] **NC-4:** Affirmation data must NEVER leave the device.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Affirmation Card: glass card with accent-tinted gradient background, prominent placement
- Text: 20px medium weight, centered, `#F0F0F5`, max 3 lines
- Category label: 12px, textSecondary, below text
- "I Affirm" button: accent color, checkmark icon, 44px height
- Heart: icon toggle, accent when filled
- "Write About This": ghost button with pen icon
- "Skip": small x icon, textTertiary
- Affirmed state: card muted with checkmark overlay and "Affirmed" label
- Module accent: `#A78BFA`

### Web (Next.js)

- Route: `/journal/affirmations` (library)
- Daily card on journal home page
- Library with sidebar filters and search

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| New | Prominent card with full styling, "I Affirm" active | Daily affirmation not yet acknowledged |
| Affirmed | Muted card, checkmark, "Affirmed" label | User tapped "I Affirm" |
| Written | Card shows "Entry written" badge | User wrote entry from affirmation |
| Empty Pool | "No affirmations available" + "Reset Dismissed" button | All affirmations dismissed |
| Disabled | No card | Feature toggle off |

## Test Requirements

### Unit Tests
- [ ] `selectDailyAffirmation`: 5 affirmations, last_shown [null, null, '2026-03-01', '2026-03-03', '2026-03-05'] -> selects one of the nulls
- [ ] `selectDailyAffirmation`: favorites get 2x weight in selection
- [ ] `selectDailyAffirmation`: excludes dismissed (is_dismissed = 1)
- [ ] `calculateAffirmationStreak`: affirmed 7 consecutive days -> streak = 7
- [ ] `calculateAffirmationStreak`: grace period active (missed 1 day) -> streak preserved
- [ ] `calculateAffirmationStreak`: missed 2 days -> streak = 0
- [ ] `validateAffirmationText`: empty -> validation error
- [ ] `validateAffirmationText`: 201 chars -> validation error
- [ ] `validateAffirmationText`: 200 chars -> accepted
- [ ] `blockBuiltinDeletion`: is_builtin = 1 -> deletion rejected
- [ ] `resetDismissed`: 3 dismissed -> all restored to pool (is_dismissed = 0)
- [ ] `multipleAffirmSameDay`: second "I Affirm" -> no duplicate log or streak increment

### Integration Tests
- [ ] Full flow: view affirmation -> tap "I Affirm" -> streak incremented -> log created
- [ ] Write flow: view affirmation -> "Write About This" -> write and save -> log with entry_id
- [ ] Custom CRUD: create custom affirmation -> edit text -> favorite -> delete
- [ ] Dismiss and restore: dismiss 3 affirmations -> reset dismissed -> all 3 back in pool

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Today tab
3. Verify: Daily Affirmation Card visible at top -- corresponds to AC-1
4. Verify: affirmation text, category label, action buttons present
5. Tap "I Affirm"
6. Verify: card transitions to "Affirmed" state -- corresponds to AC-2
7. Create a new entry from "Write About This" on the next day's affirmation
8. Verify: entry editor pre-filled with affirmation text -- corresponds to AC-3
9. Save the entry
10. Tap heart icon on an affirmation
11. Verify: heart fills (favorite toggled) -- corresponds to AC-4
12. Tap "Skip" (x) on an affirmation
13. Verify: next affirmation loads -- corresponds to AC-5
14. Navigate to Affirmation Library
15. Verify: tabs for All, Built-in, Custom, Favorites, Dismissed -- corresponds to AC-6
16. Create a custom affirmation
17. Verify: custom affirmation appears in library -- corresponds to AC-7
18. Try to delete a built-in affirmation
19. Verify: blocked with message -- corresponds to AC-8
20. Affirm daily for 3 consecutive days
21. Verify: streak shows 3 -- corresponds to AC-9
22. Dismiss all affirmations
23. Verify: "No affirmations available" + "Reset Dismissed" button -- corresponds to AC-11
24. Tap "Reset Dismissed"
25. Verify: all affirmations restored -- corresponds to AC-11

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to journal today tab, verify affirmation card and library

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for selection algorithm and streak calculation

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal has no affirmation system. The closest feature is daily prompts in `engine/prompts.ts` which cycle statically by date.

### After This Work
Two new tables (`jn_affirmations` seeded with 100 built-in, `jn_affirmation_logs`). An `affirmations/` directory provides the selection algorithm (weighted rotation with cooldown), streak calculation, and library management. Daily Affirmation Card on Today tab. Library screen with category tabs, CRUD for custom affirmations.

### Files Changed
- `modules/journal/src/db/schema.ts` -- add CREATE_AFFIRMATIONS, CREATE_AFFIRMATION_LOGS, indexes, settings
- `modules/journal/src/definition.ts` -- add to JOURNAL_MIGRATION_V4
- `modules/journal/src/affirmations/types.ts` -- Affirmation, AffirmationLog, AffirmationCategory types
- `modules/journal/src/affirmations/built-in.ts` -- 100 affirmation seed records across 8 categories
- `modules/journal/src/affirmations/selection.ts` -- selectDailyAffirmation, calculateAffirmationStreak
- `modules/journal/src/affirmations/index.ts` -- barrel export
- `modules/journal/src/affirmations/__tests__/selection.test.ts` -- 12+ unit tests
- `modules/journal/src/db/affirmations.ts` -- CRUD for affirmations and logs
- `modules/journal/src/types.ts` -- add Affirmation, AffirmationLog Zod schemas
- `modules/journal/src/index.ts` -- re-export affirmations module
- `apps/mobile/app/(journal)/components/AffirmationCard.tsx` -- daily affirmation card
- `apps/mobile/app/(journal)/affirmation-library.tsx` -- library screen
- `apps/web/app/journal/affirmations/page.tsx` -- web library

### Known Limitations
- 100 built-in affirmations is sufficient for 3+ months of daily rotation. Future versions may add more.
- No integration with mood data (affirmations do not adapt to emotional state unlike AI prompts).
- No reminder/notification to affirm daily. Users must open the app.
- No analytics beyond streak and times_affirmed. Future: category preference analysis.

### Context for Next Agent
- The `built-in.ts` file will contain 100 affirmation objects, each with text (max 200 chars), category (one of 8), and is_builtin = 1. Generate positive, actionable affirmations distributed evenly across categories.
- The selection algorithm uses `last_shown_date ASC NULLS FIRST` with favorites getting 2x representation. Implementation: sort the active pool, insert each favorite a second time, pick index 0.
- Affirmation streak uses the same algorithm as `calculateJournalStreak` in `engine/stats.ts`. Reuse or adapt that function.
- Custom affirmations have is_builtin = 0 and can be full CRUD'd. Built-in affirmations can only be favorited or dismissed.
- Migration V4 coordination: combine with other V4 features (AI prompts, stoic prompts) if shipping in the same sprint.
