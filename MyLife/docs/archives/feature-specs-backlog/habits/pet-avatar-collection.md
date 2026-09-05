# Feature Spec: Pet/Avatar Collection

## Metadata
- **Module:** habits
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 1 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 4
- **Estimated CC Time:** 5-7 hours
- **Depends On:** RPG gamification (cosmetic items unlocked via leveling system)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Finch (freemium, millions of downloads) proved that a virtual pet companion tied to self-care creates strong emotional attachment and daily engagement. Habitica's pets and mounts (300+ collectible creatures) are a primary retention driver. The core mechanic: completing habits keeps your pet happy and healthy; neglecting habits makes it sad. This creates a gentle emotional incentive that's more effective than raw streaks or numbers for many users. The pet is a visual proxy for habit consistency that users develop a genuine connection with. MyHabits' privacy-first approach means no monetization of pet items (unlike Finch's in-app purchases), making all cosmetics earnable through gameplay alone.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Habitica | Yes | Partially ($59.88/yr) | 300+ pets and mounts. Pets hatch from eggs + potions (earned or purchased). Mounts from feeding pets. Premium pets for subscribers. |
| Finch | Yes | Freemium | Self-care bird companion. Grows with habit completion. Cosmetic items purchasable. Cloud-required. |
| Forest | Yes (conceptual) | $3.99 one-time | Virtual trees grow during focus sessions. Not a pet but same emotional mechanic. |
| Streaks | No | N/A | No companion or pet system. |
| Habitify | No | N/A | No companion. Clean analytics only. |

### Target User
Users who respond to emotional/visual motivation more than numbers. The "nurturing" personality type that will complete habits to keep their virtual companion happy. Also younger users (18-25) who grew up with Tamagotchi and virtual pets. Migration path: Finch user who wants a pet companion WITHOUT cloud accounts or in-app purchases. Habitica user who wants pets but finds the full RPG overwhelming.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  pet/
    engine.ts                     -- NEW: Pet mood calculation, state management, wardrobe
    species.ts                    -- NEW: Pet species catalog (5+ species)
    cosmetics.ts                  -- NEW: All cosmetic items catalog (tied to RPG levels)
    __tests__/engine.test.ts      -- NEW: Engine tests
  db/
    pet.ts                        -- NEW: Pet state CRUD
    schema.ts                     -- MODIFY: Add hb_pet_state table (V4)
  types.ts                        -- MODIFY: Add PetState, PetMood, PetSpecies, CosmeticItem schemas
  definition.ts                   -- MODIFY: Add V4 migration, add pet-detail screen
  index.ts                        -- MODIFY: Export pet engine + types + CRUD
apps/mobile/app/(habits)/
  pet-detail.tsx                  -- NEW: Pet detail screen with wardrobe
apps/web/app/habits/
  pet/page.tsx                    -- NEW: Web pet page (or fallback)
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    ├── [Pet widget at top of habit list] ← SMALL PET DISPLAY
       │    └── [Habit list]
       ├── Habits tab
       ├── Stats tab
       └── Settings tab
            └── Pet Settings
                 └── Pet Detail ← YOU ARE HERE (full view)
```

### Data Model

```sql
-- Pet state (singleton per user)
CREATE TABLE IF NOT EXISTS hb_pet_state (
  id TEXT PRIMARY KEY DEFAULT 'pet',
  name TEXT NOT NULL DEFAULT 'Buddy',
  species TEXT NOT NULL DEFAULT 'fox',
  equipped_items TEXT NOT NULL DEFAULT '[]',  -- JSON array of cosmetic item IDs
  days_together INTEGER NOT NULL DEFAULT 0,
  total_habits_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Note: Pet mood is calculated in real-time from today's completion rate, not stored. This keeps the mood always current without requiring background updates.

### Dependencies
- **Internal:** `@mylife/habits` (completion data for mood calculation, RPG level for unlocks), `@mylife/db` (DatabaseAdapter)
- **External:** None for V1. Future: Lottie animations for pet states. Emoji-based visuals for V1.
- **Cross-Module:** RPG gamification (cosmetic items unlocked at specific levels from the RPG system). Achievement badges (certain badges could grant exclusive pet items).

## Functional Requirements

### User Stories
1. As a user who enjoys virtual companions, I want a pet whose mood reflects my daily habit completion, so I feel emotionally motivated to complete my habits.
2. As a user, I want to customize my pet's name and species so it feels personal.
3. As a user leveling up in RPG mode, I want to equip cosmetic items on my pet that I unlocked through leveling.
4. As a user, I want to see my pet's stats (days together, total habits completed) so I feel the depth of our journey together.

### Behavior Specification

**Pet creation (first launch):**
1. On first habit module activation, a pet is created with default settings.
2. Pet name: "Buddy" (customizable).
3. Pet species: Fox (default, changeable from 5 options).
4. No items equipped.

**Pet species options (V1):**

| Species | Emoji | Description |
|---------|-------|-------------|
| Fox | 🦊 | Clever and energetic. Default choice. |
| Cat | 🐱 | Independent and cozy. |
| Dog | 🐶 | Loyal and enthusiastic. |
| Owl | 🦉 | Wise and calm. |
| Penguin | 🐧 | Resilient and determined. |

**Pet mood calculation (real-time):**
1. Calculate today's completion percentage: `completed / total active habits * 100`.
2. Map to mood state:
   - 80-100%: Thriving (sparkle, bouncy, bright colors)
   - 60-79%: Happy (smiling, normal animation)
   - 40-59%: Neutral (calm, minimal movement)
   - 20-39%: Tired (droopy, slow, muted colors)
   - 0-19%: Sleepy (eyes closed, zzz, very muted)
3. If no habits exist: Neutral (not sad, there's nothing to do).

**Design philosophy:** The pet should create gentle emotional incentive without guilt-tripping. A neglected pet looks tired, not dying. The tone is "your pet missed you" not "you're failing your pet."

**Pet display (Today screen widget):**
1. Small pet avatar at the top of the Today screen.
2. Shows current mood state with appropriate emoji and mood indicator.
3. Tapping the pet opens the Pet Detail screen.
4. If RPG mode is off, pet still shows mood (pet is independent of RPG toggle).

**Pet detail screen:**
1. Large pet display with mood indicator.
2. Pet name (editable) and species (changeable).
3. Mood label: "Thriving!", "Happy", "Okay", "Tired", "Sleepy."
4. Today's completion percentage.
5. Stats card: days together, total habits completed, longest streak across all habits.
6. Wardrobe section: grid of all cosmetic items.
   - Unlocked items (from RPG levels): selectable, tap to equip/unequip.
   - Locked items: greyed out with level requirement shown.
7. Pet does not die, reset, or degrade permanently. Mood is always recoverable by completing habits.

**Cosmetic items (tied to RPG levels):**
- Items are defined in the RPG spec's unlock table (Blue background at Level 2, Green hat at Level 3, etc.).
- Equipping an item stores its ID in the pet's `equipped_items` JSON array.
- Multiple items can be equipped simultaneously (hat + background + accessory).
- Items are purely visual. No stats, no bonuses, no gameplay impact.

### Edge Cases

- **No habits exist:** Pet mood is Neutral. Message: "Create some habits and I'll cheer you on!"
- **All habits archived:** Same as no habits. Pet is Neutral.
- **RPG mode disabled but pet visible:** Pet still shows mood based on completion rate. Wardrobe items that were equipped stay equipped. New items can't be unlocked until RPG mode is re-enabled.
- **Pet species changed:** Purely visual. All equipped items apply to the new species.
- **Module disabled:** Pet state preserved. On re-enable, pet appears with current mood.
- **New day (midnight):** Pet mood resets to "Sleepy" (0% completion) until habits are completed.
- **Partial day (some habits completed):** Pet mood reflects current completion %.
- **Very many habits (20+):** Completing 4/20 = 20% = Tired. Mood thresholds may feel harsh with many habits. This is intentional; it encourages focusing on achievable habit counts.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Pet widget appears at the top of the Today screen with current mood
- [ ] **AC-2:** Tapping the pet opens the Pet Detail screen
- [ ] **AC-3:** Pet mood updates in real-time as habits are completed
- [ ] **AC-4:** Pet name and species are customizable
- [ ] **AC-5:** Wardrobe shows unlocked items (equippable) and locked items (with level requirement)
- [ ] **AC-6:** Equipping an item updates the pet's appearance
- [ ] **AC-7:** Pet stats show days together and total completions
- [ ] **AC-8:** Pet mood is Neutral when no habits exist (not sad)
- [ ] **AC-9:** Feature renders correctly on both mobile and web

### Technical Criteria
- [ ] **TC-1:** `calculatePetMood(completedCount, totalActiveHabits)` returns correct mood for each threshold
- [ ] **TC-2:** `PET_SPECIES_CATALOG` contains 5 species with emoji and description
- [ ] **TC-3:** Pet state is a singleton (id = 'pet')
- [ ] **TC-4:** `equipped_items` is stored as valid JSON array
- [ ] **TC-5:** V4 migration creates hb_pet_state table
- [ ] **TC-6:** Engine functions are pure (no side effects, no database calls)
- [ ] **TC-7:** Days together is calculated from pet createdAt, not stored as incrementing counter

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Pet must NOT "die" or be permanently damaged by inactivity
- [ ] **NC-2:** Pet cosmetic items must NOT have gameplay effects (no stat bonuses)
- [ ] **NC-3:** Pet mood must NOT show negative/aggressive emotions (sad is "sleepy," not "angry")
- [ ] **NC-4:** Pet must NOT require RPG mode to be visible (pet works independently)
- [ ] **NC-5:** Pet items must NOT be purchasable (all earned through gameplay)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#8B5CF6` (habits purple)
- Pet widget: 60x60 emoji in a glass card with mood text below
- Pet detail: 120pt emoji with mood animation indicators
- Wardrobe grid: 4 items per row, unlocked items have accent border

Layout (Pet widget on Today screen):
```
[Today Screen]

  [🦊 Thriving!  ✨]           [small pet card, tappable]

  [Habit list...]
```

Layout (Pet Detail screen):
```
[Pet Detail Screen]

       🦊                       [large, 120pt]
     "Buddy"                    [name, editable]
   ✨ Thriving! ✨              [mood label]
   85% complete today           [completion rate]

  [Stats Card]
  📅 47 days together
  ✅ 312 habits completed
  🔥 Best streak: 21 days

  [Wardrobe]
  [🎨 Blue BG ✓]  [🎩 Green Hat]  [🧣 Red Scarf]  [🔒 Lvl 5]
  [🔒 Lvl 6]      [🔒 Lvl 7]      [🔒 Lvl 8]      [🔒 Lvl 9]

  [Species: Fox ▾]             [species selector]
```

### Web (Next.js)

- Route: `/habits/pet`
- Same tokens via CSS variables
- Centered layout, max-width 500px
- Wardrobe grid: 5 items per row on desktop

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton pet card | Initial data fetch |
| New pet | Default fox "Buddy" with Neutral mood | First module activation |
| Thriving | Pet emoji with sparkle, bright mood text | 80-100% completion |
| Happy | Pet emoji with smile | 60-79% completion |
| Neutral | Pet emoji, calm | 40-59% completion or no habits |
| Tired | Pet emoji, muted colors, droopy text | 20-39% completion |
| Sleepy | Pet emoji with zzz | 0-19% completion |
| Error | "Could not load pet data" + retry | Data fetch failure |

## Test Requirements

### Unit Tests
- [ ] `calculatePetMood`: 6/6 complete (100%) -> "thriving"
- [ ] `calculatePetMood`: 4/6 complete (67%) -> "happy"
- [ ] `calculatePetMood`: 3/6 complete (50%) -> "neutral"
- [ ] `calculatePetMood`: 1/6 complete (17%) -> "sleepy"
- [ ] `calculatePetMood`: 0/6 complete (0%) -> "sleepy"
- [ ] `calculatePetMood`: 0 total habits -> "neutral" (not sleepy)
- [ ] `calculatePetMood`: 1/5 complete (20%) -> "tired" (boundary)
- [ ] `calculatePetMood`: 4/5 complete (80%) -> "thriving" (boundary)
- [ ] `PET_SPECIES_CATALOG`: all 5 species have emoji and description
- [ ] `getSpeciesByKey`: "fox" returns fox species data
- [ ] `getSpeciesByKey`: invalid key returns null
- [ ] `equipItem`: adds item ID to equipped list
- [ ] `unequipItem`: removes item ID from equipped list
- [ ] `getDaysTogether`: created 47 days ago -> 47

### Integration Tests
- [ ] Full flow: pet created -> complete 5/6 habits -> mood updates to "happy" -> complete 6th -> "thriving"
- [ ] Customization: change name to "Max" -> persists after reload
- [ ] Wardrobe: unlock item via RPG level -> equip -> pet shows item

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyHabits > Today tab
3. Verify: Pet widget shows at top with default fox "Buddy" and mood -- AC-1
4. Tap the pet widget
5. Verify: Pet Detail screen opens -- AC-2
6. Complete 5/6 habits
7. Verify: Pet mood updates to "Happy" or "Thriving" -- AC-3
8. Tap pet name, change to "Max"
9. Verify: Name persists -- AC-4
10. Change species to Cat
11. Verify: Emoji changes to 🐱 -- AC-4
12. If RPG mode is on and items unlocked: tap an item in wardrobe
13. Verify: Item equips -- AC-5, AC-6
14. Check stats card
15. Verify: Days together and completion count are shown -- AC-7
16. Delete all habits
17. Verify: Pet mood is Neutral, message "Create some habits..." -- AC-8
18. Verify on web at /habits/pet -- AC-9

## gstack Quality Gates

Based on Complexity score 1 (Complex -- significant UI work, multiple states, integration with RPG):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to pet detail, test mood changes, verify wardrobe

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate emotional design approach
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for mood calculation engine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- RPG gamification exists with XP, levels, and unlockable item definitions.
- No pet/avatar system. No mood visualization. No cosmetic wardrobe.
- Milestones and badges exist but are not tied to a visual companion.

### After This Work
- New engine: `modules/habits/src/pet/engine.ts` with mood calculation, wardrobe management.
- New catalogs: species.ts (5 species), cosmetics.ts (item definitions linked to RPG levels).
- New CRUD: `modules/habits/src/db/pet.ts` for pet state.
- New table: `hb_pet_state` (V4 migration).
- New screens: mobile pet-detail, web `/habits/pet` page.
- Modified: Today screen with pet widget at top.

### Files Changed
- `modules/habits/src/pet/engine.ts` -- NEW: Pet mood engine
- `modules/habits/src/pet/species.ts` -- NEW: 5 pet species definitions
- `modules/habits/src/pet/cosmetics.ts` -- NEW: Cosmetic items catalog
- `modules/habits/src/pet/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/db/pet.ts` -- NEW: Pet state CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add V4 table
- `modules/habits/src/types.ts` -- MODIFY: Add PetState, PetMood, PetSpecies schemas
- `modules/habits/src/definition.ts` -- MODIFY: Add V4 migration, add pet-detail screen
- `modules/habits/src/index.ts` -- MODIFY: Export pet engine + types + CRUD
- `apps/mobile/app/(habits)/pet-detail.tsx` -- NEW: Pet detail screen
- `apps/mobile/app/(habits)/today.tsx` -- MODIFY: Add pet widget
- `apps/web/app/habits/pet/page.tsx` -- NEW: Web pet page

### Known Limitations
- **Emoji-based visuals only in V1.** No animated sprites or Lottie animations. Future: animated pet states.
- **No pet evolution.** Pet doesn't evolve or transform based on long-term consistency. Future: species evolution at milestone levels.
- **No pet interactions.** Can't tap/play with the pet. It's a visual mood indicator only. Future: mini-games.
- **No pet notifications.** Pet doesn't send "I miss you" push notifications. Future: optional gentle reminders.
- **Cosmetic items are text/emoji based.** No image assets needed for V1. Future: proper art assets.

### Context for Next Agent
- The pet state is a singleton row with `id = 'pet'`. Use `INSERT OR REPLACE` for creation/update.
- Pet mood is NEVER stored in the database. It's always calculated from `getCompletionsForDate(db, null, todayString)` vs `getHabits(db, { isArchived: false })`. This ensures the mood is always accurate without background tasks.
- `equipped_items` is a JSON array stored as TEXT. Parse with `JSON.parse()`. Validate items against the cosmetics catalog.
- The cosmetics catalog references the same item IDs defined in the RPG system's `xp-table.ts`. Keep these in sync.
- `days_together` should be calculated as `daysBetween(pet.createdAt, today)`, not stored and incremented. This avoids drift if the app isn't opened daily.
- `total_habits_completed` IS stored and incremented on each completion (unlike mood, this is a lifetime counter that's expensive to recompute from completions table).
- The pet widget on the Today screen should be a simple glass card with the species emoji, pet name, and mood text. Keep it small (60px) to not dominate the screen.
