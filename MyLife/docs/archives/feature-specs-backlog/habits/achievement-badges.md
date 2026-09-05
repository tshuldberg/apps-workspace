# Feature Spec: Achievement Badges

## Metadata
- **Module:** habits
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Milestone celebrations (V3 milestones table), Sobriety clock (sobriety milestones)
- **Blocks:** RPG gamification (badges award XP)

## Business Context

### Why This Feature Exists
Achievement badges are a proven retention mechanic used by every major habit app. Habitica awards badges for streaks, total completions, and special events. Habitify uses badges to reward consistent behavior. The existing milestones system (V3) handles threshold detection and celebration, but it only covers numeric milestones (7-day streak, 100 completions). Achievement badges extend this into a visual collectible system: a badge gallery where users can see all badges they've earned across all habits, organized by category. This transforms milestones from transient celebrations into persistent, visible rewards.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Habitica | Yes | Partially | 70+ badges for streaks, quests, challenges, and events. Displayed on user profile. Premium badges for subscribers. |
| Habitify | Yes | Yes ($59.88/yr) | Achievement system with streak badges, completion badges. Premium tier only. |
| Streaks | No | N/A | No badge system. Relies on streak counters alone. |
| Fabulous | No | N/A | No badge system. Uses journey completion certificates. |
| Productive | Yes (partial) | No | Simple streak badges (7, 21, 30, 66, 100 days). |

### Target User
Users who are motivated by collectibles and visual progress markers. The "completionist" personality type that wants to fill a gallery. Also recovery users who value sobriety milestones as tangible achievements. Migration path: Habitica users who want the badge/collectible mechanic without the RPG complexity and cloud requirement.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  badges/
    engine.ts                     -- NEW: Badge catalog, unlock detection, gallery logic
    catalog.ts                    -- NEW: Complete badge definitions (40+ badges)
    __tests__/engine.test.ts      -- NEW: Engine tests
  db/
    badges.ts                     -- NEW: Badge CRUD (read/write badge unlock state)
    schema.ts                     -- MODIFY: Add hb_badges table (V4)
  types.ts                        -- MODIFY: Add Badge, BadgeCategory, BadgeRarity schemas
  definition.ts                   -- MODIFY: Add V4 migration, add badge-gallery screen
  index.ts                        -- MODIFY: Export badge engine + types + CRUD
apps/mobile/app/(habits)/
  badge-gallery.tsx               -- NEW: Badge gallery screen
apps/web/app/habits/
  badges/page.tsx                 -- NEW: Web badge gallery page (or fallback)
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    └── [Badge unlock toast notification]
       ├── Habits tab
       ├── Stats tab
       │    └── Badges section
       │         └── Badge Gallery ← YOU ARE HERE
       └── Settings tab
```

### Data Model

```sql
-- Badge unlock records
CREATE TABLE IF NOT EXISTS hb_badges (
  id TEXT PRIMARY KEY,
  badge_key TEXT NOT NULL,       -- unique badge identifier from catalog (e.g., "streak_7")
  habit_id TEXT REFERENCES hb_habits(id) ON DELETE SET NULL,  -- null for global badges
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  dismissed INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(badge_key, habit_id)    -- one badge per habit (or one global)
);

CREATE INDEX IF NOT EXISTS hb_badges_key_idx ON hb_badges(badge_key);
CREATE INDEX IF NOT EXISTS hb_badges_habit_idx ON hb_badges(habit_id);
CREATE INDEX IF NOT EXISTS hb_badges_unlocked_idx ON hb_badges(unlocked_at DESC);
```

### Dependencies
- **Internal:** `@mylife/habits` (milestones system, streak data, completion counts, sobriety stats), `@mylife/db` (DatabaseAdapter)
- **External:** None. Pure local calculation.
- **Cross-Module:** RPG gamification (badge unlocks award XP). Pet/avatar (certain badges could unlock pet cosmetics).

## Functional Requirements

### User Stories
1. As a user who values visual progress, I want to see a gallery of all badges I can earn, with locked badges shown as silhouettes so I know what to aim for.
2. As a user who just unlocked a badge, I want a celebratory notification so I feel rewarded immediately.
3. As a user with many habits, I want badges categorized (streak, completion, sobriety, special) so I can browse them easily.
4. As a user, I want to see which habit earned each badge so I can track per-habit achievements.

### Behavior Specification

**Badge catalog (40+ badges across 5 categories):**

1. **Streak badges:** First Streak (3 days), Week Warrior (7 days), Fortnight Fighter (14 days), Month Master (30 days), Quarter Champion (90 days), Half-Year Hero (180 days), Year Legend (365 days), Unbreakable (500 days), Eternal (1000 days).
2. **Completion badges:** First Step (1 completion), Getting Started (10), Committed (50), Century (100), Dedicated (250), Powerhouse (500), Thousand Club (1000), Five Thousand (5000), Ten Thousand (10000).
3. **Sobriety badges:** One Day Clean, One Week Clean, One Month Clean, 90 Days Clean, Six Months Clean, One Year Clean, Two Years Clean, Five Years Clean.
4. **Habit collection badges:** Beginner (create 1 habit), Builder (3 habits), Collector (5 habits), Organizer (10 habits), Life Manager (15 habits), Master Planner (20 habits).
5. **Special badges:** Early Bird (complete all morning habits before 9 AM), Night Owl (complete all evening habits after 8 PM), Perfect Day (100% completion), Perfect Week (7 consecutive perfect days), Focus Master (10 Pomodoro sessions completed), Comeback Kid (resume after 7+ day gap), Pledge Keeper (30 consecutive daily pledges).

**Badge unlock detection:**
1. After each habit completion, streak update, or milestone achievement, run badge detection.
2. Compare current stats against the badge catalog.
3. For any newly qualified badge not already unlocked, create an `hb_badges` record.
4. Show a toast notification: "[Badge emoji] [Badge name] unlocked!"
5. Badge is visible in the gallery immediately.

**Badge gallery screen:**
1. Grid layout showing all badges.
2. Unlocked badges: full color with emoji, name, and unlock date.
3. Locked badges: silhouette/greyed out with "?" and a hint (e.g., "Maintain a 30-day streak").
4. Tapping an unlocked badge shows: name, description, which habit earned it, unlock date.
5. Category tabs/filters: All, Streaks, Completions, Sobriety, Collection, Special.
6. Progress counter: "23 of 40 badges unlocked."

### Edge Cases

- **Badge already unlocked for a different habit:** Each habit can earn the same badge type independently. "7-day streak" can be earned for Meditation AND for Running.
- **Habit deleted:** Badge record retains the badge (habit_id set to NULL via ON DELETE SET NULL). Badge is still shown in gallery as earned.
- **Multiple badges unlocked simultaneously:** All are queued and shown sequentially in toast notifications.
- **Retroactive badge detection:** On first launch after update, run full detection against existing data. Users with existing 30-day streaks should immediately see those badges.
- **Module disabled:** Badges are preserved but gallery is inaccessible. Re-enable shows all badges.
- **Very fast completion (unlock many at once):** Toast queue shows them one by one with a short delay.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Badge gallery shows all available badges with unlocked (color) and locked (silhouette) states
- [ ] **AC-2:** Category filters (All, Streaks, Completions, Sobriety, Collection, Special) work correctly
- [ ] **AC-3:** Toast notification appears immediately when a badge is unlocked
- [ ] **AC-4:** Tapping an unlocked badge shows name, description, habit, unlock date
- [ ] **AC-5:** Progress counter shows "X of Y badges unlocked"
- [ ] **AC-6:** Retroactive badge detection unlocks badges for existing achievements on first run
- [ ] **AC-7:** Badges persist even when the earning habit is deleted
- [ ] **AC-8:** Feature renders correctly on both mobile and web

### Technical Criteria
- [ ] **TC-1:** `detectNewBadges(stats)` returns correct badge keys for given user stats
- [ ] **TC-2:** `BADGE_CATALOG` contains 40+ badge definitions with unique keys
- [ ] **TC-3:** V4 migration creates hb_badges table
- [ ] **TC-4:** UNIQUE(badge_key, habit_id) prevents duplicate badge records
- [ ] **TC-5:** ON DELETE SET NULL preserves badges when habits are deleted
- [ ] **TC-6:** Badge detection engine is pure (no side effects, no database calls)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Badges must NOT be lost when the module is disabled and re-enabled
- [ ] **NC-2:** Badge detection must NOT run on every render (only on completion/milestone events)
- [ ] **NC-3:** Locked badge hints must NOT reveal the exact requirement (use hints, not exact numbers for rare badges)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#8B5CF6` (habits purple)
- Unlocked badge: full color emoji (48pt) + name + date in glass card
- Locked badge: grey circle with "?" + hint text in muted glass card
- Toast: accent-colored banner at top with badge emoji and name
- Category tabs: horizontal scrollable pill buttons

Layout:
```
[Badge Gallery Screen]

  "23 of 40 badges unlocked"     [progress text]

  [All] [Streaks] [Completions] [Sobriety] [Collection] [Special]

  [Grid of badges, 3 per row]
  [🔥 7-Day Streak]   [💪 14-Day Streak]   [🏆 30-Day Streak]
  [Unlocked Mar 5]    [Unlocked Mar 12]    [? 30-day hint]

  [⭐ First Step]      [🎯 Committed]       [💯 Century]
  [Unlocked Feb 1]    [Unlocked Mar 1]     [? 100 completions]
  ...
```

### Web (Next.js)

- Route: `/habits/badges`
- Same tokens via CSS variables
- Grid: 4 columns on desktop, 3 tablet, 2 mobile
- Responsive: max-width 800px centered

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton grid | Initial data fetch |
| Empty (new user) | All badges locked with hints | No badges earned yet |
| Partial | Mix of unlocked (color) and locked (grey) badges | Some achievements |
| All unlocked | Full color grid, "40 of 40 badges!" | All achievements met |
| Badge unlock toast | Animated banner with emoji and name | New badge earned |
| Error | "Could not load badges" + retry | Data fetch failure |

## Test Requirements

### Unit Tests
- [ ] `detectNewBadges`: user with 7-day streak returns "streak_7" badge key
- [ ] `detectNewBadges`: user with 100 completions returns "completion_100" badge key
- [ ] `detectNewBadges`: user with 30 clean sobriety days returns "sobriety_30" badge key
- [ ] `detectNewBadges`: user with 5 habits returns "collection_5" badge key
- [ ] `detectNewBadges`: user with no qualifications returns empty array
- [ ] `detectNewBadges`: already-unlocked badges are excluded from results
- [ ] `BADGE_CATALOG`: all 40+ badges have unique keys
- [ ] `BADGE_CATALOG`: all badges have non-empty name, description, emoji, category
- [ ] `getBadgesByCategory`: filtering by "streak" returns only streak badges
- [ ] `getBadgeHint`: returns hint text that does not reveal exact threshold for rare badges

### Integration Tests
- [ ] Full flow: complete habit -> streak reaches 7 -> badge detected -> record created -> gallery shows unlocked
- [ ] Delete flow: delete habit -> badge remains in gallery with null habit
- [ ] Retroactive flow: existing data with 30-day streak -> first badge detection -> badge unlocked immediately

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyHabits > Stats > Badges
3. Verify: Gallery shows locked badges with silhouettes and hints -- AC-1
4. Verify: Category filters work (tap Streaks, see only streak badges) -- AC-2
5. Verify: Progress counter shows "0 of 40 badges unlocked" (for new user) -- AC-5
6. Create a habit and complete it 1 time
7. Verify: "First Step" badge toast appears -- AC-3
8. Navigate to badge gallery
9. Verify: "First Step" badge is unlocked with date -- AC-4
10. Tap the badge
11. Verify: Detail shows name, description, habit name, unlock date -- AC-4
12. Complete habit daily for 7 days
13. Verify: "Week Warrior" badge toast appears
14. Delete the habit
15. Verify: Badges remain in gallery -- AC-7
16. Verify on web at /habits/badges -- AC-8

## gstack Quality Gates

Based on Complexity score 4 (Small), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to badge gallery, verify grid, test unlock toast

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for badge detection engine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Milestones system exists (V3) with threshold-based detection and celebration.
- Streak and completion data is available via existing CRUD.
- No visual badge gallery, no badge catalog, no collectible system.

### After This Work
- New engine: `modules/habits/src/badges/engine.ts` with detection, catalog lookup, category filtering.
- New catalog: `modules/habits/src/badges/catalog.ts` with 40+ badge definitions.
- New CRUD: `modules/habits/src/db/badges.ts` for badge unlock records.
- New table: `hb_badges` (V4 migration).
- New screens: mobile badge gallery, web `/habits/badges` page.

### Files Changed
- `modules/habits/src/badges/engine.ts` -- NEW: Badge detection engine
- `modules/habits/src/badges/catalog.ts` -- NEW: 40+ badge definitions
- `modules/habits/src/badges/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/db/badges.ts` -- NEW: Badge CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add V4 table + indexes
- `modules/habits/src/types.ts` -- MODIFY: Add Badge, BadgeCategory, BadgeRarity schemas
- `modules/habits/src/definition.ts` -- MODIFY: Add V4 migration, add badge-gallery screen
- `modules/habits/src/index.ts` -- MODIFY: Export badge engine + types + CRUD
- `apps/mobile/app/(habits)/badge-gallery.tsx` -- NEW: Mobile badge gallery screen
- `apps/web/app/habits/badges/page.tsx` -- NEW: Web badge gallery page

### Known Limitations
- **No badge sharing.** Can't share badges to social media. Future: share cards via Share Sheet.
- **No animated badge icons.** Badges use static emoji. Future: Lottie animations for rare badges.
- **Badge detection is not real-time push.** It runs on completion events, not continuously.
- **No badge notifications.** Toast only appears while the app is open. Future: push notifications for badge unlocks.

### Context for Next Agent
- Badges extend the existing milestones system but are separate entities. Milestones are per-habit threshold markers; badges are collectible achievements that can span habits.
- The `badge_key` column uses a string key like "streak_7", "completion_100", "sobriety_30" that maps to the catalog. The catalog is a static TypeScript const, not stored in the database.
- ON DELETE SET NULL means `habit_id` can be null for badges whose earning habit was deleted. The gallery should handle this gracefully ("Earned from a deleted habit" or just omit the habit name).
- Retroactive detection should run once on migration by querying existing streak/completion/sobriety data and creating badge records for already-qualified badges with `unlocked_at` set to the current timestamp.
- The badge detection function takes a stats summary object (streaks, completions, sobriety days, habit count, etc.) and returns a list of newly qualified badge keys. The caller is responsible for checking against existing unlocks.
