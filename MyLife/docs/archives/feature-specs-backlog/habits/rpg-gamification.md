# Feature Spec: RPG Gamification (XP & Levels)

## Metadata
- **Module:** habits
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 4 x3 + Complexity 0 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 6-8 hours
- **Depends On:** HB-002 (Daily Check-In), Milestone celebrations (milestone XP bonuses)
- **Blocks:** Pet/avatar collection (cosmetic items unlocked via leveling)

## Business Context

### Why This Feature Exists
Habitica built a $10M+/yr business entirely on RPG gamification of habits. Their 4M+ users earn XP, level up characters, collect pets, and complete quests -- all driven by habit completion. The core insight: gamification creates a secondary motivation loop that keeps users engaged even when intrinsic motivation dips. MyHabits already has the habit tracking foundation. Adding an optional XP/leveling layer creates a direct Habitica competitor while avoiding Habitica's primary criticism: that the gamification overwhelms the habit tracking itself. Our design philosophy makes gamification a toggle, not the default.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Habitica | Yes | Partially ($59.88/yr premium) | Full RPG: XP, levels, classes, pets, mounts, quests, guilds, equipment. 70+ levels. Cloud-required. |
| Finch | Yes (partial) | Freemium | Self-care pet that grows with habit completion. Simplified gamification. |
| Habitify | No | N/A | No gamification layer. Clean habit tracking only. |
| Streaks | No | N/A | No gamification. Streak counters only. |
| Fabulous | No | N/A | Journey-based motivation, no RPG elements. |

### Target User
Habitica users ($59.88/yr) who love the gamification mechanic but find Habitica's RPG complexity distracting, or who want their data local. Also users who enjoy progress bars and leveling systems in games and want that dopamine loop applied to real life habits. Migration path: Habitica user discovers MyLife does XP/levels with a simple toggle, offline-first, no cloud account, and integrates with 28 other life modules.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  rpg/
    engine.ts                     -- NEW: XP calculation, leveling curve, level-up detection
    xp-table.ts                   -- NEW: XP award rules and unlockable items table
    __tests__/engine.test.ts      -- NEW: Engine tests
  db/
    rpg.ts                        -- NEW: Player profile + XP transaction CRUD
    schema.ts                     -- MODIFY: Add hb_player_profile, hb_xp_transactions tables (V4)
  types.ts                        -- MODIFY: Add PlayerProfile, XPTransaction, UnlockableItem schemas
  definition.ts                   -- MODIFY: Add V4 migration
  index.ts                        -- MODIFY: Export RPG engine + types + CRUD
apps/mobile/app/(habits)/
  (no new screen; XP bar integrates into existing Today screen)
apps/web/app/habits/
  (no new page; XP bar integrates into existing layout)
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    ├── [XP Bar - Level X | XXXX / XXXX XP] ← YOU ARE HERE (top)
       │    └── [Habit list]
       ├── Habits tab
       ├── Stats tab
       │    └── [RPG Stats section: level, total XP, history]
       └── Settings tab
            └── [RPG Mode toggle]
```

### Data Model

```sql
-- Player RPG profile (singleton per user)
CREATE TABLE IF NOT EXISTS hb_player_profile (
  id TEXT PRIMARY KEY DEFAULT 'player',
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  gamification_enabled INTEGER NOT NULL DEFAULT 0 CHECK (gamification_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- XP transaction log
CREATE TABLE IF NOT EXISTS hb_xp_transactions (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL,  -- 'completion', 'streak_bonus', 'milestone', 'craving_resist', 'daily_pledge', 'all_complete'
  habit_id TEXT REFERENCES hb_habits(id) ON DELETE SET NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hb_xp_transactions_source_idx ON hb_xp_transactions(source);
CREATE INDEX IF NOT EXISTS hb_xp_transactions_habit_idx ON hb_xp_transactions(habit_id);
CREATE INDEX IF NOT EXISTS hb_xp_transactions_earned_idx ON hb_xp_transactions(earned_at DESC);
```

### Dependencies
- **Internal:** `@mylife/habits` (completion events, streak data, milestone triggers, craving outcomes, pledge recording), `@mylife/db` (DatabaseAdapter)
- **External:** None. Pure local calculation.
- **Cross-Module:** Pet/avatar companion (cosmetic items unlocked at specific levels). Achievement badges (badge unlocks could award bonus XP).

## Functional Requirements

### User Stories
1. As a user who enjoys gamification, I want to earn XP for completing habits and see a progress bar showing my level, so that habit tracking feels rewarding.
2. As a user reaching a new level, I want a celebration animation and to see what item I unlocked, so that leveling up feels exciting.
3. As a user who dislikes gamification, I want a single toggle to hide all RPG elements so they never clutter my experience.
4. As a user who toggles gamification off and on, I want my XP and level preserved so I don't lose progress.

### Behavior Specification

**XP award system:**

| Action | Base XP | Conditions |
|--------|---------|------------|
| Complete a standard habit | 10 XP | Per completion |
| Complete a timed session (met target) | 15 XP | Duration >= target |
| Complete a measurable habit (met target) | 12 XP | Value >= target |
| Resist a craving | 20 XP | Craving logged with outcome "resisted" |
| Maintain streak (daily bonus) | streak * 1 XP | Capped at 50 XP/day |
| Hit milestone (7 days) | 50 XP | One-time |
| Hit milestone (30 days) | 150 XP | One-time |
| Hit milestone (90 days) | 500 XP | One-time |
| Hit milestone (365 days) | 2000 XP | One-time |
| Take daily pledge | 5 XP | Per pledge |
| Complete all habits for the day | 25 XP | 100% daily completion |

**Leveling curve:**
- Formula: `xpForLevel(n) = floor(100 * (1.2 ^ (n - 1)))`
- Level 1: 0 XP (start). Level 2: 100 XP. Level 5: 537 cumulative XP. Level 10: 2,080 cumulative XP. Level 15: 5,920 cumulative XP. Level 20: 15,476 cumulative XP.
- Maximum level is unbounded (curve continues indefinitely).

**Unlockable items (first 20 levels):**

| Level | XP Required | Unlockable |
|-------|-------------|------------|
| 1 | 0 | Default avatar |
| 2 | 100 | Blue background |
| 3 | 120 | Green hat |
| 4 | 144 | Red scarf |
| 5 | 173 | Gold border |
| 6 | 207 | Purple aura |
| 7 | 249 | Silver crown |
| 8 | 299 | Rainbow trail |
| 9 | 358 | Star badge |
| 10 | 430 | "Habit Master" title |
| 15 | 1,070 | "Habit Legend" title |
| 20 | 2,663 | "Habit Grandmaster" title |

**XP bar (Today screen):**
1. Thin progress bar below the navigation bar, visible only when gamification is enabled.
2. Left: "Level X" label. Right: "current / needed XP" counter.
3. Bar fills with accent color proportional to progress toward next level.
4. On level-up: bar flashes, level number increments.

**Level-up celebration (overlay):**
1. Full-screen overlay: "Level Up!" text with large level number.
2. If an item was unlocked: item preview with name.
3. Particle/confetti effect.
4. "Continue" dismiss button.

**Settings toggle:**
1. "RPG Mode" toggle in Settings tab.
2. Off by default (gamification is opt-in, not default).
3. Toggling off hides all gamification UI. XP and level are preserved.
4. Toggling on shows XP bar with current progress.

### Edge Cases

- **XP is never subtracted.** Un-completing a habit does not remove XP. This prevents gaming by toggle-completing.
- **Toggling gamification off:** XP bar disappears. XP/level preserved. XP continues to be silently earned in the background so toggling back on shows accurate progress.
- **Multiple completions per day per habit:** Each completion earns XP. No per-day cap per habit (but streak bonus is capped at 50 XP/day).
- **Level calculation discrepancy:** If totalXP doesn't match currentLevel (e.g., data corruption), recompute level from totalXP on next launch.
- **Very high levels (100+):** XP curve continues. Level 100 requires ~8.3M XP total. At 5 habits/day that's ~300 years. Realistically, dedicated users hit level 20-30.
- **Module disabled:** XP pauses. On re-enable, XP resumes from where it was.
- **First enable after existing data:** No retroactive XP award. XP starts accumulating from the moment gamification is enabled.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** XP bar appears on Today screen when gamification is enabled
- [ ] **AC-2:** Completing a standard habit adds 10 XP and the bar animates
- [ ] **AC-3:** Level-up triggers a celebration overlay with the new level number
- [ ] **AC-4:** Unlockable item is shown during level-up celebration
- [ ] **AC-5:** "RPG Mode" toggle in Settings shows/hides all gamification UI
- [ ] **AC-6:** Toggling off and on preserves XP and level
- [ ] **AC-7:** Streak bonus XP is capped at 50 XP/day
- [ ] **AC-8:** Resisting a craving awards 20 XP
- [ ] **AC-9:** 100% daily completion awards 25 XP bonus

### Technical Criteria
- [ ] **TC-1:** `calculateXPForAction(action, context)` returns correct XP for each action type
- [ ] **TC-2:** `xpForLevel(n)` matches the exponential curve: `floor(100 * 1.2^(n-1))`
- [ ] **TC-3:** `getLevelForXP(totalXP)` correctly maps cumulative XP to level
- [ ] **TC-4:** `getUnlockableForLevel(level)` returns correct item or null
- [ ] **TC-5:** V4 migration creates hb_player_profile and hb_xp_transactions tables
- [ ] **TC-6:** Player profile is a singleton (id = 'player')
- [ ] **TC-7:** XP transactions have positive-only amounts (CHECK constraint)
- [ ] **TC-8:** Engine functions are pure (no side effects, no database calls)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** XP must NOT be subtracted for any reason (un-complete, delete, etc.)
- [ ] **NC-2:** Gamification UI must NOT appear when RPG mode is disabled
- [ ] **NC-3:** Level must NOT decrease even if XP calculation changes
- [ ] **NC-4:** Streak bonus must NOT exceed 50 XP per day

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- XP bar: `#8B5CF6` (habits accent) fill on `rgba(255,255,255,0.08)` background, 4px height
- Level label: 14pt bold, white
- XP counter: 12pt, textSecondary
- Level-up overlay: full-screen glass background, large level number in accent color, confetti particles
- Toggle: standard iOS/Android switch in Settings

Layout:
```
[Today Screen - with RPG Mode ON]

  [Level 7 ████████████░░░░░░░ 993 / 1242 XP]

  [Habit list as usual...]
```

Level-up overlay:
```
  [Glass overlay]

       ⭐ LEVEL UP! ⭐

          Level 7

    Unlocked: Silver Crown 👑

       [Continue]
```

### Web (Next.js)

- XP bar renders in the habits page header, same accent color
- Level-up uses a modal dialog instead of full-screen overlay
- Same tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Gamification off | No XP bar, no level info | RPG Mode toggle is off |
| Gamification on, low level | Thin XP bar, "Level 1" | Just enabled |
| XP earned | Bar animates forward | Habit completed |
| Level up | Celebration overlay | XP crosses threshold |
| High level | Full bar, large level number | Extended usage |

## Test Requirements

### Unit Tests
- [ ] `calculateXPForAction`: standard completion = 10 XP
- [ ] `calculateXPForAction`: timed session (met target) = 15 XP
- [ ] `calculateXPForAction`: measurable habit (met target) = 12 XP
- [ ] `calculateXPForAction`: craving resisted = 20 XP
- [ ] `calculateXPForAction`: daily pledge = 5 XP
- [ ] `calculateXPForAction`: all habits complete = 25 XP
- [ ] `calculateStreakBonus`: streak of 15 = 15 XP
- [ ] `calculateStreakBonus`: streak of 100 = 50 XP (capped)
- [ ] `xpForLevel`: level 1 = 0, level 2 = 100, level 5 = 173, level 10 = 430
- [ ] `getLevelForXP`: 0 XP = level 1
- [ ] `getLevelForXP`: 100 XP = level 2
- [ ] `getLevelForXP`: 537 XP = level 5
- [ ] `getLevelForXP`: 99 XP = level 1 (not enough for level 2)
- [ ] `getUnlockableForLevel`: level 3 = "Green hat"
- [ ] `getUnlockableForLevel`: level 10 = "Habit Master title"
- [ ] `getUnlockableForLevel`: level 99 = null (no unlock defined)

### Integration Tests
- [ ] Full flow: enable RPG mode -> complete habit -> 10 XP added -> bar updates
- [ ] Level-up flow: XP reaches threshold -> level increments -> celebration fires -> item unlocked
- [ ] Toggle flow: earn 200 XP -> toggle off -> toggle on -> XP and level preserved

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyHabits > Settings
3. Enable "RPG Mode"
4. Navigate to Today tab
5. Verify: XP bar visible at top showing "Level 1 | 0 / 100 XP" -- AC-1
6. Complete a standard habit
7. Verify: XP bar shows 10 XP, bar animates -- AC-2
8. Complete 9 more habits (total 100 XP)
9. Verify: Level-up celebration overlay appears, shows "Level 2" -- AC-3
10. Verify: "Blue background" unlock is shown -- AC-4
11. Navigate to Settings, toggle RPG Mode off
12. Navigate to Today tab
13. Verify: No XP bar visible -- AC-5
14. Toggle RPG Mode back on
15. Verify: Level 2 with 100 XP is preserved -- AC-6

## gstack Quality Gates

Based on Complexity score 0 (Massive -- high feature surface, XP table balancing, UI integration):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- verify XP bar rendering, test level-up animation, verify toggle

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate XP balancing and gamification approach
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for XP calculation and leveling curve

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Habits module has completions, streaks, milestones, cravings, sobriety pledges, focus sessions.
- No gamification layer. No XP. No levels. No unlockable items.
- Milestones exist but are celebrations, not a persistent leveling system.

### After This Work
- New engine: `modules/habits/src/rpg/engine.ts` with XP calculation, leveling curve, level detection.
- New data: `modules/habits/src/rpg/xp-table.ts` with XP award rules and unlockable items.
- New CRUD: `modules/habits/src/db/rpg.ts` for player profile and XP transactions.
- New tables: `hb_player_profile`, `hb_xp_transactions` (V4 migration).
- XP bar component integrated into Today screen (conditional on gamification toggle).

### Files Changed
- `modules/habits/src/rpg/engine.ts` -- NEW: XP + leveling engine
- `modules/habits/src/rpg/xp-table.ts` -- NEW: XP award rules and unlockable items
- `modules/habits/src/rpg/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/db/rpg.ts` -- NEW: Player profile + XP CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add V4 tables + indexes
- `modules/habits/src/types.ts` -- MODIFY: Add PlayerProfile, XPTransaction schemas
- `modules/habits/src/definition.ts` -- MODIFY: Add V4 migration
- `modules/habits/src/index.ts` -- MODIFY: Export RPG engine + types + CRUD
- `apps/mobile/app/(habits)/today.tsx` -- MODIFY: Add conditional XP bar component
- `apps/web/app/habits/page.tsx` -- MODIFY: Add conditional XP bar component

### Known Limitations
- **No classes/specializations.** Habitica has warrior/mage/healer/rogue. Out of scope for V1.
- **No quests or group challenges.** Solo leveling only. No social/multiplayer RPG elements.
- **No equipment system.** Unlockable items are cosmetic only (for pet/avatar), not stat-boosting equipment.
- **No retroactive XP on first enable.** XP starts fresh when RPG mode is toggled on, not from historical data. This keeps it simple but means early users don't get a "burst" of XP.
- **XP balancing is approximate.** The award table may need tuning based on real usage patterns.

### Context for Next Agent
- The player profile is a singleton row with `id = 'player'`. Use `INSERT OR REPLACE` when creating/updating.
- XP transactions are a write-ahead log. The `total_xp` on the profile is the source of truth for the current level; transactions are for history/debugging.
- The leveling curve formula `floor(100 * 1.2^(n-1))` is exponential. Pre-compute the first 50 levels into a static array for fast lookup. Beyond 50, compute dynamically.
- `calculateXPForAction` is called from the completion/milestone/craving/pledge event handlers. It should return the XP amount and source string. The caller persists the transaction and updates the profile.
- The XP bar and level-up overlay are UI components that integrate into existing screens. They are NOT separate screens in the definition. No new routes needed.
- Gamification defaults to OFF (`gamification_enabled = 0`). This is intentional. The feature is opt-in to avoid the Habitica criticism of gamification being inescapable.
