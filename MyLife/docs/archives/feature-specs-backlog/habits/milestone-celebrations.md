# Feature Spec: Milestone Celebrations

## Metadata
- **Module:** habits
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 5 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Sobriety clock (for sobriety milestones); core streaks (for streak milestones)
- **Blocks:** Achievement badges (B-Tier, builds on milestones)

## Business Context

### Why This Feature Exists
Milestone celebrations are the #1 retention mechanic in habit apps. I Am Sober celebrates sobriety milestones (1 day, 1 week, 1 month, 100 days, 1 year). Habitica rewards milestones with loot drops and experience points. Streaks shows a flame icon that grows with streak length. Research shows that celebrating small wins increases habit adherence by 22% (BJ Fogg, Stanford Behavior Design Lab). MyLife's habits module has streak tracking but zero celebration UI. Users complete a 30-day streak and see the same bland number. Adding animated celebrations, confetti, and milestone cards turns silent achievements into dopamine-reinforcing moments.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| I Am Sober | Yes | Free (basic), Premium (custom) | Milestone cards at 1d/3d/1w/2w/1m/3m/6m/1y/etc. Share to social. Daily motivational messages on milestone days. |
| Habitica | Yes | Free (basic), Premium (enhanced) | Experience points, level-ups, loot drops, quest progress, pet evolution at milestones. Heavy gamification. |
| Streaks | Yes | $4.99 one-time | Visual streak flame that grows. Simple but effective. Apple Watch complications. |
| Habitify | Partial | $59.88/yr | Shows "best streak" badge but no celebrations or animations. |
| Fabulous | Yes | $59.99/yr | Journey milestones with coaching messages and visual progress maps. |

### Target User
Any habit tracker user who wants positive reinforcement. Specifically: users who complete streaks without recognition and eventually lose motivation. Also sobriety trackers who want to mark significant dates. Migration: Habitica users who want RPG-style rewards without the full gamification overhead.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  milestones/
    engine.ts                   -- NEW: Milestone detection, schedule, unlocking
    __tests__/engine.test.ts    -- NEW: Engine tests
  db/
    milestones.ts               -- NEW: Milestone CRUD
    schema.ts                   -- MODIFY: Add hb_milestones table
  types.ts                      -- MODIFY: Add milestone Zod schemas
  definition.ts                 -- MODIFY: Add to V3 migration
  index.ts                      -- MODIFY: Export milestone engine + types
apps/mobile/app/(habits)/
  today.tsx                     -- MODIFY: Show milestone celebration overlay when triggered
apps/web/app/habits/
  page.tsx                      -- MODIFY: Show milestone celebration on web
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab             ← Celebration overlay appears here
       │    └── [Habit card] -> tap to complete -> milestone fires if threshold met
       ├── Habits tab
       │    └── [Habit detail] -> Milestones section (achieved list)
       ├── Stats tab
       │    └── [Milestones earned section]
       └── Settings tab
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hb_milestones (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
  milestone_type TEXT NOT NULL
    CHECK (milestone_type IN ('streak', 'total_completions', 'sobriety_days', 'sobriety_money', 'custom')),
  threshold INTEGER NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT,
  achieved_at TEXT,
  dismissed INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hb_milestones_habit_idx ON hb_milestones(habit_id);
CREATE INDEX IF NOT EXISTS hb_milestones_achieved_idx ON hb_milestones(achieved_at);
CREATE INDEX IF NOT EXISTS hb_milestones_type_idx ON hb_milestones(milestone_type, threshold);
```

### Dependencies
- **Internal:** `@mylife/habits` (streaks engine, sobriety engine, completions), `@mylife/db`
- **External:** Confetti animation library. Recommendation: `react-native-confetti-cannon` for mobile (lightweight, Expo-compatible), CSS keyframe animation for web (no library needed).
- **Cross-Module:** Hub dashboard activity feed shows milestone achievements.

## Functional Requirements

### User Stories
1. As a habit tracker, I want to see a celebration animation when I hit a streak milestone so I feel rewarded.
2. As a sobriety tracker, I want milestone cards for significant sobriety dates (1 week, 1 month, 100 days, 1 year).
3. As a user, I want to see all my earned milestones in one place so I can look back on my achievements.
4. As a user, I want milestones to fire automatically without any setup so the magic just happens.

### Behavior Specification

**Milestone schedule (built-in, no user configuration needed):**

For **streak milestones** (all habit types):
- 3 days, 7 days, 14 days, 21 days, 30 days, 60 days, 90 days, 100 days, 180 days, 365 days, 500 days, 1000 days

For **total completions** (standard + timed + measurable habits):
- 10, 25, 50, 100, 250, 500, 1000, 2500, 5000

For **sobriety days** (negative habits with sobriety profile):
- 1 day, 3 days, 7 days, 14 days, 30 days, 60 days, 90 days, 100 days, 180 days, 365 days, 500 days, 730 days (2 years), 1095 days (3 years)

For **sobriety money saved** (negative habits with daily_cost > 0):
- $100, $500, $1000, $2500, $5000, $10000

**Milestone detection:**
1. After each habit completion (or sobriety clock update), the milestone engine runs.
2. It checks: current streak, total completions, sobriety days, money saved.
3. For each unachieved milestone whose threshold is met, mark it as achieved (`achieved_at = now`).
4. Return a list of newly achieved milestones for UI celebration.

**Celebration overlay:**
1. When a milestone fires, a full-screen overlay appears for 3 seconds:
   - Confetti animation
   - Large emoji (milestone-specific)
   - Milestone label: "7-Day Streak!" or "100 Days Sober!" or "$1,000 Saved!"
   - Subtitle: habit name
   - "Awesome!" dismiss button (auto-dismisses after 3s)
2. If multiple milestones fire simultaneously, queue them (show one after another).
3. The celebration does not block other interactions (tap anywhere to dismiss).

**Milestones section (habit detail and stats):**
1. On the habit detail screen, a "Milestones" section shows:
   - Achieved milestones with emoji, label, and date achieved.
   - Upcoming milestones with a progress bar showing how close the user is.
2. On the stats tab, an "All Milestones" section shows achievements across all habits.

**Milestone seeding:**
When a habit is created or when the milestone feature first launches, seed all standard milestones for each habit as unachieved records. This makes it easy to query "next milestone" and show progress bars.

### Edge Cases

- **Multiple milestones at once:** Queue celebrations. Show one at a time with brief delay.
- **Habit deleted:** Milestones cascade delete (ON DELETE CASCADE).
- **Streak broken and rebuilt:** Same milestone can be achieved again on the next streak? No, milestones are one-time achievements. Once achieved_at is set, it stays.
- **Very high values:** User with 1000+ day streak has achieved all streak milestones. No new celebrations fire. The counter still shows the streak.
- **Custom milestones (future):** Schema supports `milestone_type = 'custom'` but V1 only uses built-in schedules.
- **Module disabled:** Milestones stop detecting but achieved ones persist.
- **Retroactive milestones:** When the feature first deploys, check existing streaks and mark past milestones as achieved (with achieved_at = created_at of the milestone or habit creation date). Do NOT fire celebrations for retroactive achievements.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Confetti celebration fires when user completes a habit that crosses a milestone threshold
- [ ] **AC-2:** Celebration overlay shows emoji, milestone label, and habit name
- [ ] **AC-3:** Overlay auto-dismisses after 3 seconds or on tap
- [ ] **AC-4:** Multiple simultaneous milestones are shown sequentially
- [ ] **AC-5:** Habit detail shows achieved milestones with dates
- [ ] **AC-6:** Habit detail shows upcoming milestones with progress bars
- [ ] **AC-7:** Stats tab shows all milestones across all habits
- [ ] **AC-8:** Sobriety milestones fire at correct thresholds (1d, 7d, 30d, 100d, 365d)
- [ ] **AC-9:** Money-saved milestones fire at correct dollar thresholds
- [ ] **AC-10:** Feature works on both mobile and web
- [ ] **AC-11:** Retroactive milestones are marked as achieved without celebration

### Technical Criteria
- [ ] **TC-1:** `detectNewMilestones` returns only newly achieved milestones (not already achieved)
- [ ] **TC-2:** Milestone seeding creates all standard milestones for a habit on creation
- [ ] **TC-3:** `getNextMilestone` returns the closest unachieved milestone with progress percentage
- [ ] **TC-4:** V3 migration creates hb_milestones table
- [ ] **TC-5:** Milestone detection runs in < 50ms per habit (lightweight query)
- [ ] **TC-6:** Celebration animation does not block the main thread

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Same milestone must NOT fire twice for the same habit
- [ ] **NC-2:** Celebration must NOT block user from interacting with the app
- [ ] **NC-3:** Retroactive milestone detection must NOT trigger celebration animations
- [ ] **NC-4:** Milestones must NOT fire for archived habits

## UI Specification

### Mobile (Expo)

- Module accent: `#8B5CF6` (habits purple)
- Celebration overlay: Full screen, semi-transparent black background (`rgba(0,0,0,0.7)`)
- Confetti: Multi-colored particles from top
- Milestone emoji: 64pt centered
- Label: 28pt bold white
- Dismiss area: tap anywhere

Celebration overlay:
```
[Full screen overlay]
  🎉 [confetti particles falling]

  🔥                              [large milestone emoji]
  "30-Day Streak!"               [bold, white, 28pt]
  "Morning Meditation"           [secondary, 18pt]

  [Awesome!]                     [pill button, accent purple]
```

Milestone section on habit detail:
```
[Milestones]
  ✅ 🔥 7-Day Streak          Mar 15, 2026
  ✅ 🔥 14-Day Streak         Mar 22, 2026
  ✅ 🔥 21-Day Streak         Mar 29, 2026
  ⏳ 🔥 30-Day Streak         [===-------] 70%
  ⏳ 🎯 50 Total Completions  [====------] 43%
```

### Web (Next.js)

- Celebration: CSS confetti animation (keyframes), centered modal
- Same Glass Obsidian tokens
- Milestone list in habit detail sidebar or section

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No milestones yet | "Keep going! Your first milestone is at 3 days" | New habit, no completions |
| Milestone earned | Full-screen confetti celebration | Completion crosses threshold |
| Progress view | Progress bars showing distance to next milestone | Viewing habit detail |
| All earned | Full list with dates, no upcoming (all achieved) | Very long streak |
| Error | Silently skip celebration (milestone still recorded) | Animation failure |

## Test Requirements

### Unit Tests
- [ ] `detectNewMilestones`: streak = 7, no milestone achieved yet -> returns 7-day milestone
- [ ] `detectNewMilestones`: streak = 7, 7-day already achieved -> returns empty
- [ ] `detectNewMilestones`: streak = 30, 7/14/21 achieved -> returns 30-day only
- [ ] `detectNewMilestones`: total completions = 100 -> returns 100-completion milestone
- [ ] `detectNewMilestones`: sobriety_days = 365 -> returns 365-day sobriety milestone
- [ ] `detectNewMilestones`: money_saved = 150000 (cents) -> returns $1000 milestone
- [ ] `getNextMilestone`: streak = 5 -> next = 7 days, progress = 71%
- [ ] `getNextMilestone`: all milestones achieved -> returns null
- [ ] `seedMilestones`: creates correct number of milestones for standard habit
- [ ] `seedMilestones`: creates sobriety + money milestones for negative habit with profile

### Integration Tests
- [ ] Full flow: complete habit 7 times -> 7-day streak milestone fires
- [ ] Retroactive: habit with 50-day streak, milestones feature added -> 3/7/14/21/30 marked achieved, no celebrations
- [ ] Multiple: complete habit that crosses both 100-completion and 30-day streak -> both fire sequentially

### QA Verification Script

1. Open the app on [iOS / web]
2. Create a standard daily habit "Meditate"
3. Record 6 completions for the past 6 days
4. Complete the habit for today (day 7)
5. Verify: Confetti celebration fires with "7-Day Streak!" -- AC-1, AC-2
6. Verify: Overlay dismisses after 3 seconds or on tap -- AC-3
7. Navigate to habit detail
8. Verify: 3-day and 7-day milestones shown as achieved -- AC-5
9. Verify: 14-day milestone shows progress bar -- AC-6
10. Create a negative habit with sobriety (quit date = 30 days ago, $10/day)
11. Navigate to sobriety clock
12. Verify: 1d, 3d, 7d, 14d, 30d sobriety milestones marked achieved -- AC-8, AC-11
13. Verify: $100 money milestone achieved ($300 saved) -- AC-9
14. Navigate to Stats tab
15. Verify: All milestones across both habits shown -- AC-7
16. Verify on web -- AC-10

## gstack Quality Gates

Based on Complexity score 5 (Trivial):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- trigger a milestone, verify celebration animation

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Streak tracking exists (getStreaksWithGrace, getNegativeStreaks, getMeasurableStreaks).
- Sobriety tracking planned (sobriety clock spec).
- No milestone detection, no celebrations, no milestone UI.
- Cross-module activity feed already emits milestone events at [7, 14, 30, 60, 100, 365] day streaks (in `cross-module.ts`), but these are feed items, not celebrations.

### After This Work
- Milestone engine: detection, seeding, progress tracking.
- Milestone table: `hb_milestones`.
- Celebration overlay on Today tab (mobile) and habits page (web).
- Milestone section on habit detail and stats tab.

### Files Changed
- `modules/habits/src/milestones/engine.ts` -- NEW: Detection, seeding, progress
- `modules/habits/src/milestones/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/db/milestones.ts` -- NEW: Milestone CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add hb_milestones table
- `modules/habits/src/types.ts` -- MODIFY: Add Milestone, MilestoneType schemas
- `modules/habits/src/definition.ts` -- MODIFY: V3 migration
- `modules/habits/src/index.ts` -- MODIFY: Export milestone engine
- `apps/mobile/app/(habits)/today.tsx` -- MODIFY: Celebration overlay
- `apps/web/app/habits/page.tsx` -- MODIFY: Celebration modal

### Known Limitations
- **No shareable milestone cards.** I Am Sober lets users share milestone images to social. Future feature.
- **No custom milestones.** Users can't create their own thresholds. Schema supports it for future.
- **No sound effects.** Celebrations are visual only. Future: haptic feedback on mobile.
- **Single-fire only.** If a user breaks and rebuilds a 30-day streak, the 30-day milestone doesn't fire again.

### Context for Next Agent
- The milestone engine should be called after every completion and after every sobriety snapshot. It takes the current state (streak, total, sobriety days, money saved) and returns newly achieved milestones.
- Seed milestones when: (1) a habit is created, (2) the feature first deploys (retroactive seeding for existing habits). Use a setting flag `milestones_seeded` in `hb_settings` to avoid re-seeding.
- The celebration overlay should be a React context provider wrapping the habits screens. When milestones fire, push them into a queue. The provider renders the overlay from the queue.
- `react-native-confetti-cannon` is a single component: `<ConfettiCannon count={200} origin={{x: -10, y: 0}} />`. Auto-fires on mount.
- For web, use CSS keyframe confetti (no external library). Many lightweight implementations exist as single React components.
