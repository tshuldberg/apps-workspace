# Feature Spec: Guided Meditation

## Metadata
- **Module:** health
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Guided meditation is a high-value premium feature (PaidUser 4/5) found in Apple Health, Bearable, and dedicated apps like Calm ($69.99/yr) and Headspace ($69.99/yr). MyHealth can offer a lighter but privacy-first alternative: offline-first guided sessions with text prompts (not audio) and session logging that integrates with mood and wellness tracking. This bridges the gap between breathing exercises and full therapeutic tools.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Calm | Yes | Yes ($69.99/yr) | Audio-guided sessions, sleep stories, celebrity voices |
| Headspace | Yes | Yes ($69.99/yr) | Structured courses, animations, progress tracking |
| Apple Health | Yes | Free | Mindful minutes tracking via Apple Watch |
| Bearable | Yes | Yes ($34.99/yr) | Simple mindfulness timer with symptom correlation |

### Target User
Users who want mindfulness practice without paying $70/yr for Calm or Headspace. Users who prefer text-guided (silent) meditation they can do anywhere, not audio-dependent sessions. Users who want their meditation practice tracked alongside their health data.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/meditation/sessions.ts    -- Session definitions (static data)
modules/health/src/meditation/types.ts       -- Meditation types
modules/health/src/meditation/crud.ts        -- Completed session persistence
modules/health/src/db/schema.ts              -- New hl_meditation_sessions table
modules/health/src/index.ts                  -- Export meditation functions
apps/mobile/app/(health)/meditation.tsx      -- Meditation library + session screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Today tab
            └── Quick Actions
                 └── Meditate ← YOU ARE HERE
       └── Insights tab
            └── Meditation history and streak
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hl_meditation_sessions (
  id TEXT PRIMARY KEY,
  meditation_type TEXT NOT NULL,       -- 'body_scan' | 'loving_kindness' | 'mindful_awareness' | 'stress_relief' | 'sleep_prep' | 'focus' | 'gratitude' | 'custom_timer'
  duration_seconds INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  mood_before INTEGER,
  mood_after INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hl_meditation_date_idx ON hl_meditation_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS hl_meditation_type_idx ON hl_meditation_sessions(meditation_type);
```

### Dependencies
- **Internal:** `@mylife/db`, mood system (for before/after tracking)
- **External:** None. No audio files. Text-guided only.
- **Cross-Module:** Sessions feed wellness timeline. Mood before/after links to mood module. Mindful minutes could feed HealthKit (future write-back).

## Functional Requirements

### User Stories
1. As a user, I want to choose from different meditation types based on my current need (stress, sleep, focus).
2. As a user, I want text-guided meditation prompts that walk me through the practice step by step.
3. As a user, I want a simple timer option for unguided meditation.
4. As a user, I want my meditation history logged for streak tracking and wellness correlation.

### Behavior Specification

**Meditation library:**
1. User taps "Meditate" quick action on Today tab or navigates to meditation screen
2. 8 meditation types displayed:
   - Body Scan (5-15 min): Progressive body awareness
   - Loving Kindness (5-10 min): Compassion meditation
   - Mindful Awareness (3-10 min): Present-moment attention
   - Stress Relief (5-10 min): Tension release and calm
   - Sleep Prep (10-15 min): Pre-sleep wind-down
   - Focus (5-10 min): Concentration practice
   - Gratitude (3-5 min): Appreciation reflection
   - Custom Timer (any duration): Unguided with bell
3. Each type shows duration options (short/medium/long)

**Guided session (text-based):**
1. User selects type and duration
2. Optional: pre-session mood (1-10)
3. Full-screen session view:
   - Background dims to very dark
   - Text prompts appear one at a time, fading in/out
   - Timer counting down at bottom
   - Gentle haptic pulse between prompt transitions
   - Example prompts (Body Scan):
     a. "Close your eyes and take three deep breaths..."
     b. "Bring your attention to the top of your head..."
     c. "Notice any sensations in your forehead and temples..."
     d. "Let your awareness flow down to your shoulders..."
     e. (continues through body parts)
   - Final prompt: "Gently bring your awareness back to the room..."
4. Session complete:
   - Optional: post-session mood (1-10)
   - Session saved to hl_meditation_sessions

**Custom timer:**
1. User sets duration (1-60 minutes, picker)
2. Simple countdown with optional interval bell (every 5 min)
3. No text prompts. Just timer + dark screen.
4. End bell (haptic + optional sound)

**History and streaks:**
1. Meditation history in Insights shows completed sessions
2. Streak: consecutive days with at least one meditation
3. Stats: total sessions, total minutes, favorite type, avg mood improvement

### Edge Cases

- **User exits mid-session:** Save partial session with completed=0 and actual duration.
- **Phone call during session:** Pause. Resume on return.
- **Screen lock:** Use keepAwake during active session.
- **0 duration (immediate exit):** Don't save.
- **Custom timer set to 0:** Prevent. Minimum 1 minute.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** 8 meditation types displayed with descriptions and duration options
- [ ] **AC-2:** Text prompts fade in/out during guided session
- [ ] **AC-3:** Timer counts down and shows remaining time
- [ ] **AC-4:** Session ends with completion confirmation and mood capture
- [ ] **AC-5:** Custom timer works with configurable duration
- [ ] **AC-6:** Meditation history shows completed sessions with dates
- [ ] **AC-7:** Streak counter tracks consecutive meditation days
- [ ] **AC-8:** Mood improvement tracked and displayed

### Technical Criteria
- [ ] **TC-1:** hl_meditation_sessions table created by migration
- [ ] **TC-2:** Session CRUD works correctly
- [ ] **TC-3:** Prompt sequences defined for all 7 guided types
- [ ] **TC-4:** Timer accuracy within 1 second over a 15-minute session
- [ ] **TC-5:** keepAwake prevents screen lock during session

### Negative Criteria
- [ ] **NC-1:** No audio files required (text + haptic only)
- [ ] **NC-2:** No network access required
- [ ] **NC-3:** Sessions with 0 duration must NOT be saved

## UI Specification

### Mobile (Expo)
- **Library:** Glass cards with meditation type icon (emoji), name, duration badges. Accent `#10B981`.
- **Session screen:** Near-black background (`#050508`). Text prompts in `#F0F0F5` with fade animation, centered vertically, max 2 lines. Timer at bottom in `rgba(240,240,245,0.40)`. Pause button subtle.
- **Completion:** Glass card with stats and mood delta.

### Web (Next.js)
- `/health/meditation` route. Same dark session view. Keyboard Enter to start/pause.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Library | 8 type cards | Navigation |
| Pre-mood | Mood slider | Session starting |
| Active | Dark screen + text prompts | Session in progress |
| Paused | Frozen with "Resume" | User pauses |
| Complete | Stats + mood delta | Session ends |
| History | Session list + streaks | Insights tab |

## Test Requirements

### Unit Tests
- [ ] `getMeditationPrompts`: returns correct prompts for each of 7 guided types
- [ ] `createMeditationSession`: stores all fields
- [ ] `createMeditationSession`: rejects 0 duration
- [ ] `getMeditationSessions`: returns reverse chronological
- [ ] `getMeditationStats`: total sessions, minutes, favorite type
- [ ] `getMeditationStreak`: consecutive days correctly counted
- [ ] `getMeditationStreak`: gap resets streak

### Integration Tests
- [ ] Full flow: select type -> complete session -> saved -> appears in history
- [ ] Custom timer: set 2 min -> timer counts down -> session saved

### QA Verification Script

1. Navigate to MyHealth > Today > Meditate
2. Verify: 8 meditation types visible -- corresponds to AC-1
3. Select "Body Scan" (5 min)
4. Verify: Text prompts fade in/out -- corresponds to AC-2
5. Verify: Timer counting down -- corresponds to AC-3
6. Let session complete
7. Rate mood before and after
8. Verify: Completion screen with mood delta -- corresponds to AC-4, AC-8
9. Select "Custom Timer", set 2 minutes
10. Verify: Timer starts and counts down -- corresponds to AC-5
11. Navigate to Insights > Meditation
12. Verify: Both sessions in history -- corresponds to AC-6
13. Complete meditation on consecutive days
14. Verify: Streak counter updates -- corresponds to AC-7

## gstack Quality Gates

Based on Complexity 2 (Inverse), this feature is "Large" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2:
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Health module has breathing exercises but no meditation feature. No mindfulness session logging exists.

### After This Work
- 7 guided meditation types + custom timer
- Text-based prompts (no audio dependency)
- Session logging with mood before/after
- Streak tracking and stats
- Quick action from Today tab

### Files Changed
- `modules/health/src/meditation/sessions.ts` -- Meditation definitions and prompts
- `modules/health/src/meditation/types.ts` -- Types
- `modules/health/src/meditation/crud.ts` -- CRUD
- `modules/health/src/db/schema.ts` -- hl_meditation_sessions
- `modules/health/src/definition.ts` -- Migration bump
- `modules/health/src/index.ts` -- Exports
- `apps/mobile/app/(health)/meditation.tsx` -- UI

### Known Limitations
- No audio guidance (text prompts only)
- No animated backgrounds or visuals beyond text fade
- No courses or structured multi-day programs
- No Apple Watch companion

### Context for Next Agent
- Meditation prompts are static text arrays, not AI-generated. Each type has 10-20 prompts that are selected and paced based on the chosen duration.
- The text fade animation should use React Native Animated with Animated.timing for opacity transitions, pacing each prompt to fill the session duration evenly.
- Use expo-keep-awake to prevent screen dimming.
- The meditation session table is separate from breathing sessions (different purposes, different types).
