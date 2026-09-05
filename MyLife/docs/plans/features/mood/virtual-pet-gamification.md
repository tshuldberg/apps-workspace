# Feature Spec: Virtual Pet Gamification

## Metadata
- **Module:** mood
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [2] x3 + Complexity [1] x2 + CrossModule [3] x1 + PaidUser [3] x1
- **Sprint:** 3-4
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Existing mood entry CRUD, streak engine (`engine/streak.ts`), breathing sessions CRUD
- **Blocks:** none

## Business Context

### Why This Feature Exists
Finch (self-care pet app) has proven that virtual pet gamification drives consistent daily engagement in wellness apps. Users who struggle with motivation to track mood daily respond well to extrinsic reward loops: caring for a virtual pet by completing wellness activities. The low complexity score (1/5, inverted = high simplicity) reflects that this is primarily a state machine on top of existing mood logging with no new external dependencies. The cross-module score (3/5) means the pet's happiness can respond to activities across MyLife -- logging a mood, completing a workout, journaling -- creating a hub-wide engagement loop.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Finch | Yes | Yes ($39.99/yr) | Dedicated self-care pet app: hatch + grow pets, dress them up, explore virtual world |
| Daylio | No | N/A | Achievement badges but no virtual pet |
| Bearable | No | N/A | No gamification |
| Reflectly | No | N/A | No gamification |
| Habitica | Partial | Freemium | RPG avatar (not pet), shared with habits, MMO-style |

### Target User
Users who need extrinsic motivation to maintain daily mood logging habits. Younger demographics (18-30) who respond to gamification. Finch users ($39.99/yr) who want a pet system integrated into a broader life-tracking app rather than a standalone pet app. Users who have tried mood trackers before but dropped off after the novelty wore off.

## Technical Context

### Where This Lives in MyLife

```
modules/mood/src/
  types.ts                               -- New types: VirtualPet, PetMood, PetEvolution, PetActivity
  db/schema-v3.ts                        -- V3 migration for mo_pet, mo_pet_activities
  db/pet.ts                              -- NEW: Pet CRUD (get/update pet state, log activities)
  engine/pet.ts                          -- NEW: Pet state machine (happiness decay, evolution, activity effects)
  __tests__/pet.test.ts                  -- NEW: Pet engine tests

apps/mobile/app/(mood)/
  components/PetWidget.tsx               -- NEW: Pet display widget (Today tab)
  pet.tsx                                -- NEW: Pet detail screen (stats, history, customization)

apps/web/app/mood/
  components/PetWidget.tsx               -- NEW: Web pet display widget
```

### Wireframe Position

```
Hub Dashboard
  └── MyMood card
       └── Today tab
            ├── Pet Widget ← YOU ARE HERE (top of Today tab)
            │    ├── Pet avatar (emoji-based, evolving)
            │    ├── Happiness bar
            │    ├── "Feed" actions (log mood, breathe, journal)
            │    └── Tap for pet detail screen
            ├── Mood log (existing)
            └── Breathing (existing)
```

### Data Model

```sql
-- V3 Migration: Virtual pet tables

CREATE TABLE IF NOT EXISTS mo_pet (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  name TEXT NOT NULL DEFAULT 'Buddy',
  species TEXT NOT NULL DEFAULT 'egg',
  evolution_stage INTEGER NOT NULL DEFAULT 0,
  happiness INTEGER NOT NULL DEFAULT 50 CHECK(happiness >= 0 AND happiness <= 100),
  experience INTEGER NOT NULL DEFAULT 0,
  total_feeds INTEGER NOT NULL DEFAULT 0,
  streak_bonus INTEGER NOT NULL DEFAULT 0,
  last_fed_at TEXT,
  hatched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mo_pet_activities (
  id TEXT PRIMARY KEY,
  activity_type TEXT NOT NULL CHECK(activity_type IN ('mood_log', 'breathing', 'meditation', 'journal', 'workout', 'experiment', 'streak_bonus')),
  happiness_delta INTEGER NOT NULL,
  experience_delta INTEGER NOT NULL,
  source_module TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS mo_pet_activities_type_idx ON mo_pet_activities(activity_type);
CREATE INDEX IF NOT EXISTS mo_pet_activities_created_idx ON mo_pet_activities(created_at DESC);
```

### Dependencies
- **Internal:** `@mylife/mood` (entry CRUD, streak engine, breathing sessions), `@mylife/ui` (Cool Obsidian tokens)
- **External:** None (emoji-based rendering, no sprite assets)
- **Cross-Module:** `@mylife/module-registry` (detect enabled modules for cross-module feeds). Optional feed sources: Workouts (log workout = feed pet), Journal (write entry = feed pet), Health (meditation = feed pet)

## Functional Requirements

### User Stories
1. As a new user, I want to hatch a virtual pet by logging my first 3 mood entries so that I have a companion to motivate daily logging.
2. As a daily user, I want my pet's happiness to increase when I log mood, breathe, or do other wellness activities so that I feel rewarded.
3. As a streak holder, I want my pet to evolve to a new stage when I reach streak milestones so that I have long-term goals.
4. As a user who missed a day, I want my pet to look sad (but not die) so that I feel gently nudged to log again.

### Behavior Specification

**Hatching (Onboarding):**
1. When mood module is first enabled, pet starts as "egg" (evolution_stage = 0).
2. Egg shows on Today tab with "Log 3 moods to hatch me!" prompt.
3. After 3rd mood entry, egg "hatches" with celebration animation.
4. User names their pet (default: "Buddy"). Species assigned based on first mood emotions.
5. Pet enters stage 1 (baby).

**Daily Care Loop:**
1. Each wellness activity "feeds" the pet, adding happiness + experience:
   - Log mood entry: +10 happiness, +5 XP
   - Complete breathing session: +8 happiness, +3 XP
   - Complete meditation session: +12 happiness, +5 XP
   - Log in another module (cross-module): +5 happiness, +2 XP
2. Each "feed" is recorded in `mo_pet_activities`.
3. Max 3 feeds per activity type per day (prevent gaming).
4. Happiness decays by 5 points per day if no activity is logged.
5. Happiness is clamped to 0-100.

**Evolution:**
1. Pet evolves at XP thresholds: stage 1 (0 XP), stage 2 (100 XP), stage 3 (500 XP), stage 4 (2000 XP), stage 5 (5000 XP).
2. Each evolution changes the pet's emoji avatar and unlocks a new expression set.
3. Evolution is celebrated with animation + "Your pet evolved!" message.

**Pet Moods (Emoji-Based Display):**
| Happiness Range | Pet Mood | Display |
|-----------------|----------|---------|
| 80-100 | Ecstatic | Bouncing animation, sparkle eyes |
| 60-79 | Happy | Gentle bob, smile |
| 40-59 | Content | Still, neutral expression |
| 20-39 | Sad | Droopy, slow pulse |
| 0-19 | Neglected | Gray overlay, tear drop |

**Evolution Stages (Emoji Progression):**
| Stage | XP Required | Emoji | Name |
|-------|-------------|-------|------|
| 0 | 0 | egg | Egg |
| 1 | 0 (hatched) | hatching_chick | Baby |
| 2 | 100 | baby_chick | Youngster |
| 3 | 500 | bird | Teen |
| 4 | 2000 | parrot | Adult |
| 5 | 5000 | phoenix | Legendary |

**Streak Bonus:**
- Consecutive daily logging streak adds bonus: +2 happiness per streak day (capped at +14 for 7-day streak).
- Streak resets to 0 on missed day. Pet doesn't "die" -- just gets sad.

### Edge Cases

- User never names pet: use default "Buddy".
- User changes pet name: update mo_pet.name. No other side effects.
- Happiness reaches 0: pet looks neglected but stays alive. Logging any activity restores happiness.
- Multiple mood entries in rapid succession: only first 3 per activity_type per day count.
- User disables mood module: pet state is frozen (no decay). Re-enabling resumes from last state.
- Cross-module feed from disabled module: ignore. Only count feeds from currently-enabled modules.
- Pet at max evolution (stage 5): XP continues to accumulate but no further evolution. Show "Legendary" badge.
- Date rollover mid-session: happiness decay runs on next app open, comparing last_fed_at to current date.
- User deletes mood entry that triggered a feed: feed record stays (don't retroactively remove happiness). This keeps the system simple.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** New users see an egg on the Today tab with "Log 3 moods to hatch me!" prompt
- [ ] **AC-2:** After 3rd mood entry, egg hatches with celebration animation and naming prompt
- [ ] **AC-3:** Logging a mood entry visibly increases the pet's happiness bar
- [ ] **AC-4:** Pet's emoji/expression changes based on happiness level (5 distinct moods)
- [ ] **AC-5:** Pet evolves at XP thresholds with evolution animation and congratulation message
- [ ] **AC-6:** Missing a day causes happiness to decrease by 5 (pet looks sadder)
- [ ] **AC-7:** Consecutive day streak shows bonus indicator on pet widget
- [ ] **AC-8:** Pet detail screen shows: name, species, stage, XP, happiness, activity history
- [ ] **AC-9:** Cross-module activities (if other modules enabled) also feed the pet
- [ ] **AC-10:** User can rename pet from pet detail screen

### Technical Criteria
- [ ] **TC-1:** Pet state persisted in singleton `mo_pet` row with correct fields
- [ ] **TC-2:** Pet activities logged to `mo_pet_activities` with type, deltas, and source module
- [ ] **TC-3:** Max 3 feeds per activity type per day enforced in engine
- [ ] **TC-4:** Happiness decay calculated correctly on app open (5 points per missed day)
- [ ] **TC-5:** Evolution triggers at correct XP thresholds (0, 100, 500, 2000, 5000)
- [ ] **TC-6:** V3 migration creates both tables and indexes
- [ ] **TC-7:** Happiness clamped to 0-100 in all operations

### Negative Criteria
- [ ] **NC-1:** Pet must NOT die or be permanently lost (always recoverable by logging)
- [ ] **NC-2:** Pet state must NOT be synced to any cloud service
- [ ] **NC-3:** Gamification must NOT prevent normal mood logging (pet is additive, not blocking)
- [ ] **NC-4:** Cross-module feeds must NOT trigger if the source module is disabled
- [ ] **NC-5:** Pet must NOT be available to other modules (mood-internal feature)

## UI Specification

### Mobile (Expo)
- **Pet Widget:** Top of Today tab, 120dp height. `rgba(255,255,255,0.04)` (glass) background, 16dp border radius. Left: pet emoji (48dp), mood-dependent animation. Center: name (16sp, `#F0F0F5`), stage label (12sp, `rgba(240,240,245,0.65)`). Right: happiness bar (vertical, 8dp wide, `#FB923C` fill, `rgba(255,255,255,0.06)` track).
- **Happiness Bar:** Gradient from `#FF453A` (low) through `#FB923C` (mid) to `#30D158` (high).
- **Feed Animation:** When pet is fed, emoji bounces (+10dp up, spring animation) and happiness bar fills with pulse.
- **Evolution Animation:** Full-screen overlay, sparkle particles, old emoji morphs to new emoji, "Your pet evolved!" text, 2-second auto-dismiss.
- **Pet Detail Screen:** Full-width pet emoji (96dp), name editable, stats grid (Stage, XP, Happiness, Total Feeds, Streak), activity history list (recent 20 feeds).

### Web (Next.js)
- Same tokens via CSS variables.
- Pet widget as a card component in the mood dashboard.
- Animations via CSS transitions (bounce, pulse).
- Evolution animation uses CSS @keyframes with scale + opacity transitions.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Pet widget with skeleton | Initial pet data fetch |
| Empty | Egg with "Log 3 moods" prompt | New user, stage 0 |
| Error | Pet widget hidden, mood logging unaffected | SQLite failure |
| Success | Pet with current mood expression and stats | Pet data loaded |
| Partial | Pet with stale happiness (pre-decay calculation) | App reopened after gap |

## Test Requirements

### Unit Tests
- [ ] Pet engine: hatches egg after 3 mood entries
- [ ] Pet engine: adds happiness correctly for each activity type
- [ ] Pet engine: caps happiness at 100
- [ ] Pet engine: floors happiness at 0
- [ ] Pet engine: decays happiness by 5 per missed day
- [ ] Pet engine: limits feeds to 3 per activity type per day
- [ ] Pet engine: evolves at correct XP thresholds
- [ ] Pet engine: does not evolve beyond stage 5
- [ ] Pet engine: calculates streak bonus correctly (capped at +14)
- [ ] Pet engine: maps happiness range to correct pet mood
- [ ] Pet CRUD: creates singleton pet row
- [ ] Pet CRUD: updates pet state (happiness, XP, evolution)
- [ ] Pet CRUD: logs activity with correct deltas and source

### Integration Tests
- [ ] Full loop: create pet -> log 3 moods -> hatch -> log more -> see happiness increase -> reach 100 XP -> evolve
- [ ] Decay test: log mood today -> advance date by 2 days -> open app -> verify happiness decreased by 10
- [ ] Cross-module: enable Workouts -> log workout -> verify pet activity recorded with source_module = 'workouts'

### QA Verification Script

1. Open app, navigate to MyMood
2. Verify: Egg widget visible at top of Today tab -- corresponds to AC-1
3. Log mood entry #1 (score 7)
4. Verify: Egg shows "2 more!" counter
5. Log mood entry #2, then #3
6. Verify: Hatch animation plays, naming prompt appears -- corresponds to AC-2
7. Name pet "Luna", confirm
8. Verify: Pet now shows as baby chick with happiness bar
9. Log another mood entry
10. Verify: Pet bounces, happiness bar increases -- corresponds to AC-3
11. Check happiness level, verify pet expression matches range -- corresponds to AC-4
12. Log breathing session
13. Verify: Pet happiness increases again
14. Navigate to pet detail screen (tap pet)
15. Verify: Name, stage, XP, happiness, feeds shown -- corresponds to AC-8
16. Tap pet name, rename to "Stella"
17. Verify: Name updates -- corresponds to AC-10
18. Close app, change device date forward by 2 days (or wait)
19. Reopen app
20. Verify: Pet happiness decreased, expression is sadder -- corresponds to AC-6
21. Accumulate 100 XP through activities
22. Verify: Evolution animation plays -- corresponds to AC-5
23. Log 4 mood entries in quick succession (same day)
24. Verify: Only first 3 increase happiness (4th shows "pet is full for today")
25. Enable Workouts module, complete a workout
26. Return to MyMood
27. Verify: Pet received cross-module feed -- corresponds to AC-9
28. Test on web: verify pet widget renders with same state

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to mood Today tab, verify pet widget in all states
- [ ] Batch QA: after 5 features in mood module, run `/qa` on mood URL

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for pet state machine (happiness decay, evolution, feed limits)

### Post-merge:
- [ ] `/parity-check` -- mood module has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyMood has streak tracking and breathing exercises but no gamification layer. No virtual pet, no extrinsic reward loop, no cross-module engagement incentives.

### After This Work
- V3 migration adds `mo_pet` (singleton) and `mo_pet_activities` tables
- Pet state machine with hatching, feeding, happiness decay, and 5-stage evolution
- Emoji-based pet rendering with 5 mood expressions
- Cross-module feed system (opt-in, enabled-module-aware)
- Pet widget on Today tab, pet detail screen with stats and history
- 3-per-type daily feed cap to prevent gaming

### Files Changed
- `modules/mood/src/types.ts` -- New types: VirtualPet, PetMood, PetEvolution, PetActivity
- `modules/mood/src/db/schema-v3.ts` -- V3 migration SQL for mo_pet, mo_pet_activities
- `modules/mood/src/db/pet.ts` -- NEW: Pet and pet activity CRUD
- `modules/mood/src/engine/pet.ts` -- NEW: Pet state machine engine
- `modules/mood/src/definition.ts` -- Add V3 migration, bump schemaVersion to 3
- `modules/mood/src/index.ts` -- Export new pet types, CRUD, engine
- `modules/mood/src/__tests__/pet.test.ts` -- NEW: Pet engine tests
- `apps/mobile/app/(mood)/components/PetWidget.tsx` -- NEW: Pet display widget
- `apps/mobile/app/(mood)/pet.tsx` -- NEW: Pet detail screen
- `apps/web/app/mood/components/PetWidget.tsx` -- NEW: Web pet widget

### Known Limitations
- Emoji-only rendering. No custom sprite art or animated characters. Future versions could add illustrated pets.
- Single pet per user. No pet collection, trading, or social features.
- Cross-module feeds require the source module to dispatch a feed event. For V1, the feed is triggered when the mood module detects new data from other modules (polling on app open), not real-time.
- No push notifications for pet status ("Your pet misses you!"). Requires notification infrastructure.

### Context for Next Agent
- The pet is a singleton row in `mo_pet` (id = 'singleton'). Use INSERT OR IGNORE for initialization, then UPDATE for all state changes.
- Happiness decay should be calculated lazily on app open: compare `last_fed_at` date to today, multiply days by 5, clamp to 0. Don't use background timers.
- Cross-module feed detection: on mood module mount, check `@mylife/module-registry` for enabled modules. For each enabled module, query their latest activity timestamp. If newer than `last_fed_at`, create a feed activity.
- The emoji progression (egg -> hatching_chick -> baby_chick -> bird -> parrot -> phoenix) uses Unicode emoji. Render with platform-native emoji (no image assets needed).
- Pet engine should be pure functions (input: current pet state + activities -> output: new pet state). This makes it trivially testable.
