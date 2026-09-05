# Feature Spec: Streak Celebration

## Metadata
- **Module:** flash
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 2 x3 + Complexity 5 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 1-1.5 hours
- **Depends On:** FL-014 (Streak Tracking -- `calculateStudyStreak` + `getFlashDashboard` both implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Duolingo's streak celebration is the most copied feature in edtech. Their research shows that streak celebrations increase Day-7 retention by 15%. Quizlet adopted similar celebrations and saw increased session length. MyFlash already tracks streaks (`calculateStudyStreak` in scheduler.ts, `currentStreak`/`longestStreak` in dashboard) but has zero celebration or visual reward. The streak data is computed but invisible. Adding celebrations turns the existing streak engine into a retention tool.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Quizlet | Yes | Free | Streak celebration with confetti animation at milestones (7, 30, 100 days). |
| Duolingo | Yes | Free | Industry-leading streak celebrations with character animations, confetti, streakfreeze shop. |
| Anki | No | N/A | No gamification. Streak count only in stats. |
| Brainscape | No | N/A | No streak celebrations. Progress bars only. |

### Target User
Any flashcard user who responds to gamification cues. Research shows 65%+ of users are motivated by visual streak rewards. This feature requires minimal code (the streak engine already exists) and has outsized retention impact.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/streaks/                      -- NEW: celebration logic + milestone defs
modules/flash/src/streaks/types.ts              -- StreakMilestone, CelebrationEvent types
modules/flash/src/streaks/milestones.ts         -- Milestone definitions and checks
modules/flash/src/streaks/index.ts              -- Barrel export
modules/flash/src/streaks/__tests__/            -- Tests
apps/mobile/app/(flash)/components/StreakBadge.tsx        -- Streak display component
apps/mobile/app/(flash)/components/StreakCelebration.tsx  -- Celebration modal
apps/web/app/flash/components/StreakBadge.tsx             -- Web streak display
apps/web/app/flash/components/StreakCelebration.tsx       -- Web celebration
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Study tab / Decks tab (header area)
            └── Streak Badge ← ALWAYS VISIBLE
       └── After completing daily target review
            └── Streak Celebration modal ← TRIGGERS ON MILESTONE
```

### Data Model

One new settings key (no migration needed, stored in `fl_settings`):

```sql
INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('lastCelebratedStreak', '0');
INSERT OR IGNORE INTO fl_settings (key, value) VALUES ('streakCelebrationsEnabled', '1');
```

No new tables. Streak data is already computed by `calculateStudyStreak` from review log dates. Milestones are defined as constants in code.

### Dependencies
- **Internal:** `@mylife/db`, `calculateStudyStreak`, `getFlashDashboard`, `getFlashSetting`, `setFlashSetting`
- **External:** `react-native-confetti-cannon` or similar (mobile confetti), CSS animations (web)
- **Cross-Module:** `crossModule.getActivityFeed()` could report streak milestones

## Functional Requirements

### User Stories
1. As a learner who just completed my daily reviews, I want to see a celebration animation when I hit a streak milestone so that I feel rewarded for consistency.
2. As a streak-motivated user, I want to see my current streak prominently displayed so that I'm aware of my progress at a glance.
3. As a user who broke my streak, I want encouraging messaging (not shame) so that I'm motivated to start a new streak.

### Behavior Specification

1. **Streak Badge** (always visible):
   a. Displayed in the header of Study/Decks tab.
   b. Shows flame icon + streak count number.
   c. Color coding: 0 (gray), 1-6 (orange), 7-29 (bright orange/amber), 30+ (fire red with pulse animation).
   d. Tap badge: expands to show "Current: X days", "Best: Y days", "Total days studied: Z".
   e. At-risk state: if today has not met the study target and streak >= 1, badge shows warning pulse animation.

2. **Streak Celebration** (milestone triggers):
   a. After a review session, if the streak has increased AND the new streak matches a milestone:
   b. Celebration modal appears: confetti animation, large flame icon, milestone text, motivational message.
   c. Milestones: 3, 7, 14, 30, 50, 100, 150, 200, 250, 365, 500, 1000 days.
   d. Special milestones (7, 30, 100, 365) get enhanced animations (longer confetti, special message).
   e. New record celebrations: when current streak exceeds longest streak.
   f. Modal auto-dismisses after 4 seconds or on tap.
   g. After dismissing, `lastCelebratedStreak` is updated to prevent duplicate celebrations.

3. **Streak Recovery** (encouraging, not shaming):
   a. If streak was broken (currentStreak = 0 or 1 after being higher):
   b. Show encouraging message: "Every great streak starts with Day 1. Let's go!"
   c. No shame messaging. Never say "You lost your streak."

### Edge Cases

- **Multiple milestones crossed in one session:** Only celebrate the highest milestone. E.g., if streak jumps from 0 to 7 (app unused for a week, then studied), celebrate 7-day milestone.
- **Streak already celebrated:** Check `lastCelebratedStreak` setting. If current streak <= `lastCelebratedStreak`, no celebration.
- **User disables celebrations:** `streakCelebrationsEnabled` setting respects user preference. Badge still shows.
- **Streak freeze used (future):** If streak tracking adds freeze support, celebrations still fire normally.
- **App crash during celebration:** Celebration state is tracked by `lastCelebratedStreak`. Restart will not re-trigger.
- **Very long streaks (1000+):** Milestone at 1000, then no more until a user-defined custom milestone.
- **Module disabled and re-enabled:** Streak is preserved from review log data. Celebration fires if a new milestone was crossed.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Streak badge is visible in the header of Study and Decks tabs showing flame icon + count.
- [ ] **AC-2:** Badge is gray when streak = 0, orange for 1-6, bright amber for 7-29, red with pulse for 30+.
- [ ] **AC-3:** Tapping the badge expands to show current streak, best streak, total days studied.
- [ ] **AC-4:** Badge shows warning pulse when today's study target is not yet met and streak >= 1.
- [ ] **AC-5:** Celebration modal appears when a milestone is reached (3, 7, 14, 30, 50, 100, 365 days).
- [ ] **AC-6:** Celebration includes confetti animation, large flame icon, and milestone-specific text.
- [ ] **AC-7:** Special milestones (7, 30, 100, 365) have enhanced animations (longer duration, unique text).
- [ ] **AC-8:** New record celebration fires when current streak exceeds longest streak.
- [ ] **AC-9:** Celebration auto-dismisses after 4 seconds or on tap.
- [ ] **AC-10:** Same milestone is never celebrated twice (tracked via `lastCelebratedStreak`).
- [ ] **AC-11:** Broken streak shows encouraging message, never shame.
- [ ] **AC-12:** Celebrations can be disabled via settings toggle.

### Technical Criteria
- [ ] **TC-1:** `lastCelebratedStreak` persisted in `fl_settings` to prevent duplicate celebrations.
- [ ] **TC-2:** Milestone check runs after `rateFlashcard` when the daily target is met for the first time today.
- [ ] **TC-3:** Streak data sourced from existing `getFlashDashboard` (no new queries).
- [ ] **TC-4:** Confetti animation renders via `react-native-confetti-cannon` (mobile) or CSS keyframes (web).
- [ ] **TC-5:** Celebration modal is dismissible and does not block study flow.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Celebrations must NOT fire for already-celebrated milestones.
- [ ] **NC-2:** Streak display must NOT show negative messaging when streak breaks.
- [ ] **NC-3:** Celebrations must NOT block the user from navigating or studying.
- [ ] **NC-4:** Celebration animations must NOT persist longer than 5 seconds.

## UI Specification

### Mobile (Expo)

- Streak badge: 36px flame emoji + streak count in 24px bold, accent `#FBBF24`
- Badge expanded: glass card popup with stats
- Color scale: 0 = `rgba(255,255,255,0.3)`, 1-6 = `#FBBF24`, 7-29 = `#F59E0B`, 30+ = `#EF4444` with pulse
- At-risk pulse: 2s animation, subtle scale 1.0-1.1
- Celebration modal: centered, glass background with `expo-blur`, flame icon 96px, confetti from top, milestone text in 28px bold, motivational text in textSecondary
- Confetti: ~50 pieces, 3s duration, module accent colors (`#FBBF24`, `#F59E0B`, `#EF4444`)
- Auto-dismiss: 4s timer, or tap anywhere

### Web (Next.js)

- Same badge in page header
- Celebration: CSS confetti animation (no external dependency), glass modal overlay
- `@keyframes confetti-fall` with randomized positions

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Streak | Gray flame, "0", "Study today to start a streak!" | currentStreak = 0 |
| Active | Colored flame + count, "Keep it going!" | currentStreak >= 1, studied today |
| At Risk | Pulsing flame, "Study now to keep your X-day streak!" | currentStreak >= 1, not studied today |
| Milestone | Confetti + modal with milestone text | Streak hits 3/7/14/30/50/100/365/1000 |
| New Record | Enhanced celebration with "New record!" badge | currentStreak > longestStreak |
| Broken | Gray flame, "Every great streak starts with Day 1" | Streak reset to 0 |

## Test Requirements

### Unit Tests
- [ ] `checkMilestone3`: streak = 3 -> milestone triggered
- [ ] `checkMilestone7`: streak = 7 -> milestone triggered with enhanced flag
- [ ] `checkNoMilestone5`: streak = 5 -> no milestone (not in list)
- [ ] `checkAlreadyCelebrated`: lastCelebratedStreak = 7, currentStreak = 7 -> no celebration
- [ ] `checkNewRecord`: currentStreak = 15, longestStreak = 10 -> new record celebration
- [ ] `checkMultipleMilestonesCrossed`: streak jumps from 0 to 10 -> celebrate 7 (highest milestone <= 10)
- [ ] `getBadgeColor`: streak 0 -> gray, 3 -> orange, 15 -> amber, 50 -> red
- [ ] `getAtRiskState`: streak 5, not studied today -> atRisk = true
- [ ] `getEncouragingMessage`: streak broken -> positive message, no shame

### Integration Tests
- [ ] Full flow: study to hit 3-day streak -> celebration fires -> badge updates to 3
- [ ] Disable flow: disable celebrations -> hit milestone -> no modal (badge still updates)

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyFlash
3. Verify: streak badge visible in header with current streak count -- corresponds to AC-1
4. If streak = 0, verify: badge is gray with "Study today to start a streak!" -- corresponds to AC-2
5. Complete one day's study target
6. Verify: badge shows 1 with orange color -- corresponds to AC-2
7. Study for 3 consecutive days (advance device date or seed review logs)
8. Complete reviews on day 3
9. Verify: celebration modal appears with confetti and "3-day streak!" text -- corresponds to AC-5, AC-6
10. Verify: modal auto-dismisses after 4 seconds -- corresponds to AC-9
11. Complete reviews on day 7
12. Verify: enhanced celebration (longer confetti) with "7-day streak!" -- corresponds to AC-7
13. Verify: streak badge now shows 7 with bright amber color
14. Tap the streak badge
15. Verify: expanded view shows current, best, total days -- corresponds to AC-3
16. Miss a day (advance date), then study
17. If streak reset: verify encouraging message, not shame -- corresponds to AC-11
18. Go to Settings, disable streak celebrations
19. Hit another milestone
20. Verify: no celebration modal (badge still updates) -- corresponds to AC-12
21. Open the app on web
22. Verify: streak badge and celebration work with CSS confetti

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /flash, verify badge states and celebration trigger

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Streak calculation exists (`calculateStudyStreak`) and dashboard exposes `currentStreak`/`longestStreak`, but there is no visual streak display and no celebration behavior.

### After This Work
A streak badge is always visible in the Flash module header. Milestone celebrations fire with confetti and motivational text. `lastCelebratedStreak` prevents duplicate celebrations. Celebrations are toggleable.

### Files Changed
- `modules/flash/src/streaks/types.ts` -- StreakMilestone, CelebrationEvent, BadgeState types
- `modules/flash/src/streaks/milestones.ts` -- MILESTONES constant array, checkMilestone, getBadgeColor, getEncouragingMessage
- `modules/flash/src/streaks/index.ts` -- barrel export
- `modules/flash/src/streaks/__tests__/milestones.test.ts` -- 9+ unit tests
- `modules/flash/src/index.ts` -- re-export streaks module
- `apps/mobile/app/(flash)/components/StreakBadge.tsx` -- streak badge component
- `apps/mobile/app/(flash)/components/StreakCelebration.tsx` -- celebration modal with confetti
- `apps/web/app/flash/components/StreakBadge.tsx` -- web badge
- `apps/web/app/flash/components/StreakCelebration.tsx` -- web celebration with CSS confetti

### Known Limitations
- No streak freeze feature in this spec (FL-014 streak tracking spec includes freeze logic, implement separately).
- Confetti library adds ~15KB to bundle. Acceptable for the retention benefit.
- No shareable streak images (could integrate with a future sharing feature).

### Context for Next Agent
- Streak data comes from `getFlashDashboard(db)` which already computes `currentStreak` and `longestStreak` from review logs.
- The `lastCelebratedStreak` setting is stored in `fl_settings`. Use `getFlashSetting(db, 'lastCelebratedStreak')` to read and `setFlashSetting(db, 'lastCelebratedStreak', String(currentStreak))` to update.
- The milestone check should run in the study screen after `rateFlashcard` completes. Query dashboard, compare to lastCelebrated, and trigger celebration if a new milestone is reached.
- For the badge at-risk state, compare `currentStreak >= 1` with "has the user studied today" (check `reviewedToday > 0` from dashboard or `dailyStudyTarget`).
