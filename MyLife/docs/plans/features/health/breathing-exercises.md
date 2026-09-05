# Feature Spec: Breathing Exercises

## Metadata
- **Module:** health
- **Priority Score:** 39 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 4 x1 + PaidUser 3 x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (reuses existing breathing engine from mood module)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Breathing exercises score high on complexity (4 = easy to build) because the core engine already exists in the mood module (3 patterns: box, 4-7-8, relaxing). This feature surfaces those exercises in MyHealth with an expanded library and session logging. Apple Health, Bearable, and CareClinic all offer breathing exercises. It's a high-impact, low-effort win that connects the mood and health modules.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | Breathe app on Apple Watch, mindful minutes tracking |
| Bearable | Yes | Yes ($34.99/yr) | Guided breathing with symptom tracking integration |
| CareClinic | Yes | Yes ($9.99/mo) | Breathing as part of therapy tools |
| Calm | Yes | Yes ($69.99/yr) | Premium breathing programs with animations |

### Target User
Anyone seeking stress relief, anxiety management, or improved focus through guided breathing. Users who already log mood in MyLife and want a quick tool to improve their state without leaving the health module.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/breathing/engine.ts      -- Breathing pattern definitions and timer logic
modules/health/src/breathing/types.ts       -- Session and pattern types
modules/health/src/breathing/crud.ts        -- Session logging CRUD
modules/health/src/db/schema.ts             -- New hl_breathing_sessions table
modules/health/src/index.ts                 -- Export breathing functions
apps/mobile/app/(health)/breathing.tsx      -- Breathing exercise screen
apps/web/app/health/breathing/              -- Web breathing page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Today tab
            └── Quick Actions
                 └── Breathe ← YOU ARE HERE (shortcut)
       └── Insights tab
            └── Breathing history and streaks
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hl_breathing_sessions (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,              -- 'box' | '478' | 'relaxing' | 'energizing' | 'sleep'
  duration_seconds INTEGER NOT NULL,
  cycles_completed INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,  -- 0 if abandoned early
  mood_before INTEGER,                -- 1-10 optional pre-session mood
  mood_after INTEGER,                 -- 1-10 optional post-session mood
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hl_breathing_date_idx ON hl_breathing_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS hl_breathing_pattern_idx ON hl_breathing_sessions(pattern);
```

### Dependencies
- **Internal:** `@mylife/db`, existing mood module breathing patterns (can be referenced or copied)
- **External:** None. Haptic feedback via Expo Haptics.
- **Cross-Module:** Mood module has 3 breathing patterns. Health module expands to 5. Session data feeds into wellness timeline. Mood before/after can feed mood correlation analysis.

## Functional Requirements

### User Stories
1. As a stressed user, I want to quickly start a breathing exercise from the Today tab so I can calm down in under 2 minutes.
2. As a user, I want to choose from multiple breathing patterns suited to different needs (calm, focus, sleep, energy).
3. As a user tracking my wellness, I want my breathing sessions logged so I can see patterns and correlate with mood.
4. As a user, I want optional pre/post mood check to see if breathing actually helps.

### Behavior Specification

**Starting a session:**
1. User taps "Breathe" quick action on Today tab (or navigates to breathing screen directly)
2. System shows pattern selection with 5 options:
   - Box Breathing (4-4-4-4): Calm and focus
   - 4-7-8 Breathing: Deep relaxation
   - Relaxing Breath (4-7-8 variant): Gentle wind-down
   - Energizing Breath (2-2-4-2): Wake up and energize
   - Sleep Breath (4-7-8 extended): Fall asleep
3. User selects a pattern and taps "Start"
4. Optional: pre-session mood prompt (1-10 slider, can skip)

**During session:**
1. Full-screen animated breathing guide:
   - Expanding/contracting circle synchronized to the pattern
   - Phase labels: "Breathe In", "Hold", "Breathe Out", "Hold"
   - Cycle counter (e.g., "Cycle 3 of 8")
   - Timer showing elapsed time
2. Haptic pulses on phase transitions (gentle tap)
3. Session runs for the configured number of cycles (default: 8 cycles, configurable 4/8/12)
4. User can tap to pause or end early

**After session:**
1. "Session Complete" screen shows:
   - Duration and cycles completed
   - Optional: post-session mood prompt (1-10 slider, can skip)
2. Session saved to hl_breathing_sessions
3. If mood before/after provided, shows mood delta: "+2 improvement"
4. User returns to previous screen

**Breathing patterns (phase durations in seconds):**

| Pattern | Inhale | Hold 1 | Exhale | Hold 2 | Default Cycles |
|---------|--------|--------|--------|--------|----------------|
| Box | 4 | 4 | 4 | 4 | 8 |
| 4-7-8 | 4 | 7 | 8 | 0 | 6 |
| Relaxing | 4 | 7 | 8 | 0 | 8 |
| Energizing | 2 | 2 | 4 | 2 | 10 |
| Sleep | 4 | 7 | 8 | 0 | 10 |

### Edge Cases

- **User exits mid-session:** Save partial session with completed=0 and actual cycles completed.
- **App backgrounded during session:** Pause session. Resume when foregrounded.
- **Phone call during session:** Same as backgrounding. Pause and resume.
- **Zero cycles completed:** Don't save a session record.
- **Mood rating skipped:** Store null for mood_before/mood_after.
- **Screen lock during session:** Use Expo's keepAwake to prevent screen dimming during active breathing.
- **Module disabled:** Session data preserved. Re-enabling shows history.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Breathe" quick action on Today tab opens the breathing screen
- [ ] **AC-2:** 5 breathing patterns are available with descriptions
- [ ] **AC-3:** Animated circle expands/contracts in sync with the selected pattern timing
- [ ] **AC-4:** Phase labels ("Breathe In", "Hold", "Breathe Out") update in real-time
- [ ] **AC-5:** Haptic feedback triggers on each phase transition
- [ ] **AC-6:** Cycle counter increments correctly
- [ ] **AC-7:** Session complete screen shows duration and cycles
- [ ] **AC-8:** Optional mood before/after capture works and shows delta
- [ ] **AC-9:** Ending a session early saves partial data with completed=0
- [ ] **AC-10:** Breathing session history is viewable in Insights

### Technical Criteria
- [ ] **TC-1:** hl_breathing_sessions table created by migration
- [ ] **TC-2:** Session CRUD (create, get history, get stats) works correctly
- [ ] **TC-3:** Pattern timing is accurate (within 100ms of specified durations)
- [ ] **TC-4:** Screen stays awake during session (keepAwake)
- [ ] **TC-5:** Session pauses on background and resumes on foreground

### Negative Criteria
- [ ] **NC-1:** Breathing exercises must NOT require network access
- [ ] **NC-2:** Audio must NOT play by default (silent visual-only guide)
- [ ] **NC-3:** Sessions with 0 cycles must NOT be saved

## UI Specification

### Mobile (Expo)
- **Pattern selection:** Glass cards with pattern name, subtitle, duration estimate
- **Exercise screen:** Full-screen, dark background (`#0A0A0F`). Large central circle in `#10B981` accent with smooth scale animation. Phase label in `#F0F0F5`, centered below circle. Cycle counter in `rgba(240,240,245,0.65)`. Pause button bottom-center.
- **Completion screen:** Glass card with session stats, mood delta in `#30D158` (improvement) or `#FF453A` (decline)

### Web (Next.js)
- Same breathing animation with CSS transitions
- `/health/breathing` route
- Keyboard spacebar to start/pause

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Pattern select | 5 pattern cards with descriptions | Initial navigation |
| Pre-mood | Optional mood slider (1-10) | After pattern selection |
| Active | Animated circle + phase labels | Session started |
| Paused | Frozen circle with "Resume" button | User taps pause |
| Complete | Stats card with mood delta | All cycles finished |
| History | Session list with patterns and durations | Insights tab |

## Test Requirements

### Unit Tests
- [ ] `getPatternConfig`: returns correct timing for all 5 patterns
- [ ] `calculateSessionDuration`: box 8 cycles = 128 seconds
- [ ] `createBreathingSession`: stores all fields correctly
- [ ] `createBreathingSession`: rejects 0 cycles
- [ ] `getBreathingSessions`: returns in reverse chronological order
- [ ] `getBreathingStats`: returns total sessions, total minutes, favorite pattern
- [ ] `calculateMoodDelta`: returns correct difference (after - before)
- [ ] `calculateMoodDelta`: returns null when either mood is null

### Integration Tests
- [ ] Full flow: select pattern -> complete session -> session saved -> appears in history
- [ ] Early exit flow: start session -> exit at cycle 3 -> partial session saved with completed=0

### QA Verification Script

1. Open app, navigate to MyHealth > Today tab
2. Tap "Breathe" quick action
3. Verify: 5 breathing patterns displayed -- corresponds to AC-2
4. Select "Box Breathing"
5. Rate pre-session mood as 4
6. Verify: Animated circle begins expanding (inhale phase) -- corresponds to AC-3
7. Verify: "Breathe In" label displays -- corresponds to AC-4
8. Verify: Haptic pulse felt on phase change -- corresponds to AC-5
9. Complete 2 full cycles
10. Verify: Cycle counter shows "Cycle 2 of 8" -- corresponds to AC-6
11. Let session complete all 8 cycles
12. Verify: Completion screen shows "2 min 8 sec, 8 cycles" -- corresponds to AC-7
13. Rate post-session mood as 7
14. Verify: Shows "+3 improvement" -- corresponds to AC-8
15. Start a new session, tap end after 1 cycle
16. Verify: Partial session saved -- corresponds to AC-9
17. Navigate to Insights
18. Verify: Both sessions appear in breathing history -- corresponds to AC-10

## gstack Quality Gates

Based on Complexity 4 (Inverse), this feature is "Small" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Post-merge:
- [ ] `/parity-check` -- health has no standalone counterpart (skip)

## Handoff State

### Before This Work
Mood module has 3 breathing patterns (box, 4-7-8, relaxing) built into its UI. Health module has no breathing features. No session logging exists anywhere.

### After This Work
- 5 breathing patterns with configurable cycle counts
- Animated breathing guide with haptic feedback
- Session logging with optional mood before/after
- Breathing history and stats in Insights
- Quick action from Today tab

### Files Changed
- `modules/health/src/breathing/engine.ts` -- Pattern definitions and timer logic
- `modules/health/src/breathing/types.ts` -- Session and pattern types
- `modules/health/src/breathing/crud.ts` -- Session CRUD
- `modules/health/src/db/schema.ts` -- hl_breathing_sessions table
- `modules/health/src/definition.ts` -- Migration version 2
- `modules/health/src/index.ts` -- Export breathing functions
- `apps/mobile/app/(health)/breathing.tsx` -- Breathing UI

### Known Limitations
- No audio guidance (visual + haptic only)
- No Apple Watch companion (future)
- No integration with Apple Health Mindful Minutes (requires HealthKit write)
- Patterns are fixed (not user-customizable timing)

### Context for Next Agent
- The mood module's existing breathing patterns should be referenced for consistency but the health module breathing engine is independent (health-specific session logging, expanded patterns)
- Use Expo Haptics for phase transition feedback: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`
- Use `expo-keep-awake` to prevent screen dimming during sessions
- The animation should use React Native Animated API with Animated.timing for smooth circle scaling
