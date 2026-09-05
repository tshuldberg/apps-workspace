# Feature Spec: Focus Timer

## Metadata
- **Module:** habits
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (timed session infrastructure already exists)
- **Blocks:** Time tracking (B-Tier, builds on focus timer)

## Business Context

### Why This Feature Exists
Focus timers (Pomodoro technique) are the #1 requested feature in habit app reviews. Habitify charges $59.88/yr and markets their focus timer as a premium feature. Forest (focus timer app) has 15M+ downloads and $10M+/yr revenue from a single feature: a timer that grows a virtual tree while you stay focused. MyLife already has timed sessions in the habits module (`hb_timed_sessions` table, `startSession`/`endSession` CRUD), but they're raw timer infrastructure with no Pomodoro structure, no break management, and no session analytics. Adding a structured focus timer with work/break intervals turns the existing foundation into a full Pomodoro competitor.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Habitify | Yes | Yes ($59.88/yr) | Pomodoro timer with custom work/break intervals. Integrates with habit completion. Session history. |
| Forest | Yes | $3.99 one-time | Focus timer grows a virtual tree. Tree dies if you leave the app. Social forest planting. |
| Fabulous | Partial | $59.99/yr | Meditation timer. No Pomodoro structure. |
| Habitica | No | N/A | No timer feature. |
| Streaks | No | N/A | No timer feature. |

### Target User
Productivity-focused users who use Pomodoro technique for work, study, or deep focus. Forest users who want a timer integrated with their habit tracking. Students using timed study sessions. Migration path: Forest/Habitify user gets focus timer + habit tracking + health correlation in one app.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  focus/
    engine.ts                   -- NEW: Pomodoro state machine, session analytics
    __tests__/engine.test.ts    -- NEW: Engine tests
  db/
    focus.ts                    -- NEW: Focus session CRUD (extends timed-sessions)
    schema.ts                   -- MODIFY: Add hb_focus_sessions table
  types.ts                      -- MODIFY: Add focus Zod schemas
  definition.ts                 -- MODIFY: Add to V3 migration
  index.ts                      -- MODIFY: Export focus engine + types
apps/mobile/app/(habits)/
  focus-timer.tsx               -- NEW: Focus timer screen with circular progress
apps/web/app/habits/
  focus/page.tsx                -- NEW: Web focus timer page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    └── [Timed habit card] -> Focus Timer screen
       ├── Habits tab
       │    └── [Timed habit detail] -> "Start Focus Session" button
       ├── Stats tab
       │    └── [Focus Stats section]
       └── Settings tab
            └── [Focus Timer defaults]
```

### Data Model

```sql
-- Focus sessions: extends timed sessions with Pomodoro structure
CREATE TABLE IF NOT EXISTS hb_focus_sessions (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
  work_duration INTEGER NOT NULL,
  break_duration INTEGER NOT NULL,
  rounds_target INTEGER NOT NULL DEFAULT 4,
  rounds_completed INTEGER NOT NULL DEFAULT 0,
  total_focus_seconds INTEGER NOT NULL DEFAULT 0,
  total_break_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hb_focus_sessions_habit_idx ON hb_focus_sessions(habit_id);
CREATE INDEX IF NOT EXISTS hb_focus_sessions_status_idx ON hb_focus_sessions(status);
CREATE INDEX IF NOT EXISTS hb_focus_sessions_started_idx ON hb_focus_sessions(started_at DESC);
```

The existing `hb_timed_sessions` table records raw timing data. `hb_focus_sessions` adds Pomodoro structure: work/break intervals, round tracking, and session status.

### Dependencies
- **Internal:** `@mylife/habits` (timed sessions CRUD, completions), `@mylife/db`
- **External:** None for the engine. On mobile, may use `expo-keep-awake` to prevent screen sleep during focus. On web, use `document.title` to show timer in tab title.
- **Cross-Module:** Health module (focus minutes as a health metric). Mood module (focus sessions correlated with mood).

## Functional Requirements

### User Stories
1. As a user, I want a Pomodoro timer with configurable work/break intervals so I can structure my focus sessions.
2. As a user, I want the timer to automatically switch between work and break periods so I don't have to manually manage transitions.
3. As a user, I want to see how many rounds I've completed and how many are left so I can pace my session.
4. As a user, I want focus session stats (total focus time today, this week, this month) so I can track my productivity.
5. As a user, I want completing a focus session to automatically count as a habit completion so my streak is maintained.

### Behavior Specification

**Starting a focus session:**
1. User navigates to a timed habit or taps "Start Focus" on the Today tab.
2. A pre-session screen shows configurable settings:
   - Work duration: 25 minutes (default), adjustable 5-120 minutes in 5-min increments.
   - Break duration: 5 minutes (default), adjustable 1-30 minutes.
   - Long break duration: 15 minutes (default), after every 4 rounds.
   - Number of rounds: 4 (default), adjustable 1-12.
3. User taps "Start" to begin.

**Focus timer screen:**
1. Full-screen timer with circular progress ring.
2. Center shows: current time remaining (MM:SS, counting down).
3. Below: "Round 2 of 4" indicator.
4. Status label: "Focus" (during work) or "Break" (during break).
5. Controls: Pause | Skip | Stop.
6. When work period ends:
   - Play a gentle chime/vibration (if notifications enabled).
   - Auto-transition to break period. Ring changes color (work = accent purple, break = green).
7. When break period ends:
   - Auto-transition to next work period.
   - If it was round 4 of 4 (or whatever target), transition to long break.
8. When all rounds complete:
   - Show "Session Complete!" celebration.
   - Auto-record a habit completion.
   - Log the focus session to `hb_focus_sessions`.

**Timer controls:**
- **Pause:** Pauses the countdown. Timer shows paused state. "Resume" button replaces "Pause."
- **Skip:** Skips the current interval (work or break). Moves to the next phase.
- **Stop:** Ends the session early. Prompts: "End session? Completed rounds will still be saved."
  - If at least 1 round completed, saves as partial session.
  - If 0 rounds completed, saves as abandoned.

**Focus stats:**
- Today: total focus minutes today.
- This week: total focus minutes, average per day, completed sessions.
- This month: same but monthly.
- Streak: consecutive days with at least one focus session.
- Best session: longest single-session focus time.

**Settings defaults:**
Stored in `hb_settings` with keys: `focus_work_duration`, `focus_break_duration`, `focus_long_break_duration`, `focus_rounds`. Changeable on the pre-session screen and in Settings tab.

### Edge Cases

- **App backgrounded during focus:** Timer continues counting locally. When foregrounded, reconcile with `Date.now() - startTime`. If the elapsed time exceeds the current interval, advance to the next phase.
- **Phone locked during focus:** Same as backgrounded. Timer logic is time-based, not tick-based.
- **User exits mid-session:** Prompt to save or abandon. Don't silently lose data.
- **All work, no break (break = 0):** Valid. Continuous focus with round tracking only.
- **Single round (rounds = 1):** Valid. One work period, done.
- **Very long work period (120 min):** Supported. Progress ring still works. Warn user if > 60 min.
- **No timed habits exist:** Show "Create a timed habit first" or allow focus sessions without a linked habit (general focus).
- **Session completed while on a different screen:** Log the session, show a notification/toast on return.
- **Double-tap start:** Prevent. Disable start button after first tap until session is initialized.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Pre-session screen shows configurable work/break/rounds settings
- [ ] **AC-2:** Timer displays a circular progress ring with countdown (MM:SS)
- [ ] **AC-3:** Timer automatically transitions from work to break and back
- [ ] **AC-4:** Round indicator shows current round out of total (e.g., "Round 2 of 4")
- [ ] **AC-5:** Pause button pauses the countdown; resume continues from where it stopped
- [ ] **AC-6:** Skip button advances to the next interval
- [ ] **AC-7:** Completing all rounds shows a celebration and logs a habit completion
- [ ] **AC-8:** Focus stats show today/week/month totals
- [ ] **AC-9:** Timer survives app backgrounding and returns to correct state
- [ ] **AC-10:** Feature works on both mobile and web
- [ ] **AC-11:** Long break (15 min default) triggers after every 4th work period

### Technical Criteria
- [ ] **TC-1:** Pomodoro state machine correctly transitions: work -> break -> work -> ... -> long_break -> work
- [ ] **TC-2:** Focus session saved to `hb_focus_sessions` with correct round counts and durations
- [ ] **TC-3:** Habit completion auto-recorded when session completes all rounds
- [ ] **TC-4:** Timer uses `Date.now()` arithmetic, not `setInterval` counting (handles background)
- [ ] **TC-5:** Focus defaults stored in `hb_settings` and applied to pre-session screen
- [ ] **TC-6:** V3 migration creates hb_focus_sessions table
- [ ] **TC-7:** Partial sessions (stopped early) save correctly with actual rounds completed

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Timer must NOT drift if app is backgrounded (use timestamp-based calculation)
- [ ] **NC-2:** Session must NOT be lost if user navigates away (persist state)
- [ ] **NC-3:** Double-tapping start must NOT create duplicate sessions
- [ ] **NC-4:** Break time must NOT count toward focus time totals

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Module accent: `#8B5CF6` (habits purple)
- Work ring: `#8B5CF6` (purple) stroke on dark ring track
- Break ring: `#22C55E` (green) stroke
- Timer text: 48pt monospace, white, centered
- Controls: glass pill buttons, 44pt touch targets

Timer screen layout:
```
[Focus Timer]

  "Focus"                        [or "Break", status label]
  Round 2 of 4                   [small, secondary]

  ┌─────────────────┐
  │                 │
  │    ◯ 18:42     │           [circular progress ring]
  │                 │
  └─────────────────┘

  [⏸ Pause]  [⏭ Skip]  [⏹ Stop]  [control buttons]
```

Completion screen:
```
[Session Complete! 🎉]

  4 rounds completed
  100 minutes focused
  20 minutes break

  [habit automatically completed ✓]

  [Done]
```

### Web (Next.js)

- Route: `/habits/focus`
- Timer in browser tab title: "18:42 - Focus | MyLife"
- Same circular ring using SVG
- Keyboard shortcuts: Space = pause/resume, Enter = skip, Escape = stop

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Pre-session | Settings form with start button | Navigating to focus timer |
| Working | Purple ring counting down, "Focus" label | Work interval active |
| Break | Green ring counting down, "Break" label | Break interval active |
| Long break | Green ring, "Long Break" label | Every 4th break |
| Paused | Frozen timer, "Resume" button | User tapped pause |
| Completed | Celebration, session summary | All rounds finished |
| Abandoned | Brief summary of partial progress | User stopped early |

## Test Requirements

### Unit Tests
- [ ] `PomodoroStateMachine`: initial state is 'work', round 1
- [ ] `PomodoroStateMachine`: work -> break transition after work_duration elapsed
- [ ] `PomodoroStateMachine`: break -> work transition after break_duration elapsed
- [ ] `PomodoroStateMachine`: long break after every 4th round
- [ ] `PomodoroStateMachine`: completes after target rounds reached
- [ ] `PomodoroStateMachine`: skip advances to next phase
- [ ] `PomodoroStateMachine`: pause/resume preserves remaining time
- [ ] `calculateFocusStats`: 3 sessions today totaling 75 min -> today = 75
- [ ] `calculateFocusStats`: no sessions -> all zeros
- [ ] Session persistence: partial session saves with correct rounds_completed

### Integration Tests
- [ ] Full flow: start 2-round session -> complete both rounds -> habit completion recorded
- [ ] Partial flow: start 4-round session -> stop after 2 -> saved as partial with 2 rounds
- [ ] Background: start timer -> background 2 minutes -> foreground -> timer shows correct remaining time

### QA Verification Script

1. Open the app on [iOS / web]
2. Create a timed habit "Deep Work"
3. Navigate to Focus Timer
4. Verify: Pre-session screen with work (25min), break (5min), rounds (4) -- AC-1
5. Change to work=2min, break=1min, rounds=2 (for quick testing)
6. Tap Start
7. Verify: Purple circular ring with countdown -- AC-2
8. Verify: "Round 1 of 2" shown -- AC-4
9. Wait for work period to end
10. Verify: Auto-transitions to break (green ring) -- AC-3
11. Wait for break to end
12. Verify: Transitions back to work (round 2) -- AC-3
13. Tap Pause
14. Verify: Timer freezes, Resume button shown -- AC-5
15. Tap Resume, then Skip
16. Verify: Advances to next interval -- AC-6
17. Complete all rounds
18. Verify: Celebration and habit completion logged -- AC-7
19. Navigate to Stats
20. Verify: Focus stats show today's session -- AC-8
21. Background the app for 30 seconds during a session, return
22. Verify: Timer shows correct remaining time -- AC-9
23. Verify on web -- AC-10

## gstack Quality Gates

Based on Complexity score 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- start a focus session, verify timer states, complete a session

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- eval suite for Pomodoro state machine

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Timed sessions exist: `hb_timed_sessions` table with startSession/endSession CRUD.
- No Pomodoro structure, no work/break intervals, no round tracking.
- Timed habit type exists but only records raw duration.

### After This Work
- Pomodoro state machine: `modules/habits/src/focus/engine.ts`.
- Focus sessions table: `hb_focus_sessions` with round tracking and status.
- Focus timer screen with circular progress ring on mobile and web.
- Auto-completion of habit when session finishes.
- Focus stats integrated into Stats tab.

### Files Changed
- `modules/habits/src/focus/engine.ts` -- NEW: Pomodoro state machine + analytics
- `modules/habits/src/focus/__tests__/engine.test.ts` -- NEW: State machine tests
- `modules/habits/src/db/focus.ts` -- NEW: Focus session CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add hb_focus_sessions table
- `modules/habits/src/types.ts` -- MODIFY: Add FocusSession, PomodoroState schemas
- `modules/habits/src/definition.ts` -- MODIFY: V3 migration
- `modules/habits/src/index.ts` -- MODIFY: Export focus engine
- `apps/mobile/app/(habits)/focus-timer.tsx` -- NEW: Mobile focus timer
- `apps/web/app/habits/focus/page.tsx` -- NEW: Web focus timer

### Known Limitations
- **No ambient sounds/white noise.** Forest and other focus apps play background sounds. Future feature.
- **No gamification (growing trees, etc.).** Forest's core mechanic. Potential future enhancement.
- **No Apple Watch support.** Timer is phone/web only.
- **No "do not disturb" integration.** Future: trigger DND on session start.
- **No team/shared focus sessions.** Individual only.

### Context for Next Agent
- The Pomodoro state machine should be a pure function that takes config (work/break/long_break/rounds) and current state, and returns the next state. Use a discriminated union for phases: `{ phase: 'work' | 'break' | 'long_break' | 'completed', round: number, remainingMs: number }`.
- Timer display: use `Date.now() - phaseStartTime` to compute elapsed. Remaining = phaseDuration - elapsed. This survives backgrounding because it's timestamp-based.
- `expo-keep-awake` prevents screen sleep: `import { useKeepAwake } from 'expo-keep-awake'; useKeepAwake();` in the timer component.
- Auto-completion: when all rounds finish, call `recordCompletion(db, uuid(), habitId, now)`. This integrates naturally with streaks.
- The focus session table is separate from `hb_timed_sessions` because the Pomodoro structure (rounds, work/break split) doesn't fit the simple start/end model. Future: consider unifying.
