# Feature Spec: Sleep Aids

## Metadata
- **Module:** health
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Sleep aids (ambient sounds, sleep stories, wind-down routines) are a major premium driver (PaidUser 4/5). Calm generates $150M+ in annual revenue largely from sleep stories. Apple Health offers Sleep Focus mode with wind-down. MyHealth can offer a lighter privacy-first alternative: sleep soundscapes (procedurally generated or embedded), a bedtime routine builder, and sleep hygiene tips, all integrated with sleep tracking.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Calm | Yes | Yes ($69.99/yr) | Sleep stories (celebrity narration), soundscapes, sleep music |
| Headspace | Yes | Yes ($69.99/yr) | Sleepcasts, sleep music, wind-down exercises |
| Apple Health | Yes | Free | Sleep Focus mode, wind-down routine, bedtime reminders |
| Sleep Cycle | Yes | Yes ($39.99/yr) | Smart alarm, sleep sounds, snore detection |

### Target User
Users who struggle to fall asleep and want tools within their health hub instead of a separate app. Users who want a wind-down routine integrated with their sleep tracking so they can correlate habits with sleep quality.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/sleep-aids/routines.ts    -- Wind-down routine definitions
modules/health/src/sleep-aids/types.ts       -- Sleep aid types
modules/health/src/sleep-aids/crud.ts        -- Routine completion logging
modules/health/src/db/schema.ts              -- New hl_sleep_routines table
modules/health/src/index.ts                  -- Export sleep aid functions
apps/mobile/app/(health)/sleep-aids.tsx      -- Sleep aids screen
apps/mobile/app/(health)/wind-down.tsx       -- Wind-down routine player
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Vitals tab
            └── Sleep section
                 └── Sleep Aids ← YOU ARE HERE
                      ├── Wind-down routines
                      ├── Sleep sounds (ambient)
                      ├── Bedtime reminders
                      └── Sleep hygiene tips
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS hl_sleep_routines (
  id TEXT PRIMARY KEY,
  routine_type TEXT NOT NULL,          -- 'wind_down' | 'soundscape' | 'breathing'
  routine_name TEXT NOT NULL,          -- 'Evening Wind-Down' | 'Rain Sounds' | 'Sleep Breathing'
  duration_seconds INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  sleep_session_id TEXT,               -- Link to subsequent sleep session if tracked
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hl_routine_date_idx ON hl_sleep_routines(created_at DESC);
CREATE INDEX IF NOT EXISTS hl_routine_sleep_idx ON hl_sleep_routines(sleep_session_id);
```

### Dependencies
- **Internal:** `@mylife/db`, breathing exercises (reuse for sleep breathing), hl_sleep_sessions (link routine to subsequent sleep)
- **External:** expo-av for audio playback (ambient sounds). Embedded audio assets (small files, <1MB each).
- **Cross-Module:** Sleep tracking correlates routine use with sleep quality. Meditation module has overlap (sleep prep meditation).

## Functional Requirements

### User Stories
1. As a user who struggles to fall asleep, I want a guided wind-down routine before bed.
2. As a user, I want ambient sleep sounds (rain, white noise, ocean) to help me drift off.
3. As a user, I want to set a bedtime reminder so I maintain consistent sleep habits.
4. As a user, I want to see if using sleep aids correlates with better sleep quality.

### Behavior Specification

**Wind-down routines:**
1. User navigates to Sleep section > Sleep Aids
2. Pre-built routines available:
   - Evening Wind-Down (15 min): Stretch prompts -> breathing -> gratitude reflection
   - Quick Wind-Down (5 min): Breathing exercise -> body scan
   - Sleep Breathing (10 min): Extended 4-7-8 breathing for sleep
3. User selects a routine and taps "Start"
4. Guided text prompts (like meditation) walk through each step
5. At the end, system asks: "Ready to sleep? We'll track your sleep from now."
6. If yes, links the routine to the subsequent sleep session

**Sleep sounds:**
1. Ambient sound options:
   - Rain, Ocean Waves, White Noise, Forest, Wind, Crickets
2. User selects a sound and sets a timer (15/30/60 min or continuous)
3. Sound plays with a fade-out timer
4. Screen dims during playback
5. Sound stops at timer end (or when app is backgrounded for >30 min)

**Bedtime reminders:**
1. User sets a target bedtime (e.g., 10:30 PM)
2. System sends a local notification 30 minutes before: "Time to start winding down"
3. Notification links to sleep aids screen

**Sleep hygiene tips:**
1. Static list of evidence-based tips (e.g., "Avoid screens 1 hour before bed", "Keep bedroom cool (65-68 F)")
2. Displayed as cards in the Sleep Aids section
3. One "Tip of the day" rotates daily

**Correlation tracking:**
1. When a routine is linked to a sleep session, the system can compare:
   - Sleep quality on routine nights vs non-routine nights
2. Displayed in Insights: "You sleep 12% better on nights you do a wind-down routine"

### Edge Cases

- **Sound playing when app backgrounds:** Continue playback for up to 30 minutes. Use background audio mode.
- **Sound timer expires during sleep:** Fade out over 30 seconds.
- **No sleep session logged after routine:** Routine saved unlinked. No error.
- **Bedtime reminder when DND is on:** Respect system DND settings.
- **Multiple routines in one evening:** All logged. Latest one linked to sleep session.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** 3 wind-down routines available with durations
- [ ] **AC-2:** Guided routine plays text prompts step-by-step
- [ ] **AC-3:** 6 ambient sound options available with timer selection
- [ ] **AC-4:** Sounds play and fade out at timer end
- [ ] **AC-5:** Bedtime reminder can be set with target time
- [ ] **AC-6:** Sleep hygiene tips displayed as cards
- [ ] **AC-7:** Routine linked to subsequent sleep session when user confirms
- [ ] **AC-8:** Insight shows correlation between routine use and sleep quality

### Technical Criteria
- [ ] **TC-1:** hl_sleep_routines table created by migration
- [ ] **TC-2:** Audio playback works with background mode
- [ ] **TC-3:** Timer fade-out is smooth (30-second gradient)
- [ ] **TC-4:** Local notifications fire at correct time for bedtime reminder
- [ ] **TC-5:** Routine-to-sleep linking uses sleep_session_id FK correctly

### Negative Criteria
- [ ] **NC-1:** Audio files must NOT exceed 1MB each
- [ ] **NC-2:** Sound playback must NOT continue indefinitely if user forgets (max 2 hours)
- [ ] **NC-3:** Must NOT require network for core functionality (embedded sounds)

## UI Specification

### Mobile (Expo)
- **Sleep Aids screen:** Sections for Routines, Sounds, Tips. Glass cards.
- **Routine player:** Same as meditation (dark screen, text prompts, timer).
- **Sound player:** Full-screen dark with animated waveform visualization. Timer selector. Stop button center.
- **Tip cards:** Horizontal scrollable cards with sleep tip icons.

### Web (Next.js)
- `/health/sleep/aids` route. Audio playback via Web Audio API.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Library | Routines + sounds + tips | Initial navigation |
| Routine active | Guided text prompts | Routine started |
| Sound playing | Waveform + timer | Sound selected |
| Timer ending | Fade out animation | Timer expires |
| Insight | Correlation stat | Routines linked to sleep sessions |

## Test Requirements

### Unit Tests
- [ ] `getRoutineDefinition`: returns correct steps for each routine
- [ ] `createSleepRoutine`: stores all fields
- [ ] `linkRoutineToSleep`: updates sleep_session_id correctly
- [ ] `getCorrelation`: compares quality on routine vs non-routine nights
- [ ] `getCorrelation`: handles no linked sessions gracefully

### Integration Tests
- [ ] Full flow: start routine -> complete -> link to sleep -> correlation shows in insights
- [ ] Sound flow: play rain sounds -> timer expires -> sound fades out

### QA Verification Script

1. Navigate to MyHealth > Vitals > Sleep > Sleep Aids
2. Verify: 3 routines, 6 sounds, tips visible -- corresponds to AC-1, AC-3, AC-6
3. Start "Evening Wind-Down"
4. Verify: Guided prompts play -- corresponds to AC-2
5. Complete routine, confirm sleep tracking
6. Verify: Routine linked to sleep session -- corresponds to AC-7
7. Select "Rain" sound, set 1 min timer
8. Verify: Sound plays and fades out at timer end -- corresponds to AC-4
9. Set bedtime reminder for 10:30 PM
10. Verify: Notification fires at 10:00 PM -- corresponds to AC-5
11. Log a few nights with/without routines
12. Check Insights
13. Verify: Correlation stat shown -- corresponds to AC-8

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
Sleep section has logging and quality scoring but no pre-sleep tools, sounds, or routines.

### After This Work
- 3 guided wind-down routines with text prompts
- 6 ambient sleep sounds with timer and fade-out
- Bedtime reminder via local notifications
- Sleep hygiene tips
- Routine-to-sleep session linking for correlation analysis

### Files Changed
- `modules/health/src/sleep-aids/routines.ts` -- Routine definitions
- `modules/health/src/sleep-aids/types.ts` -- Types
- `modules/health/src/sleep-aids/crud.ts` -- CRUD
- `modules/health/src/db/schema.ts` -- hl_sleep_routines
- `modules/health/src/definition.ts` -- Migration bump
- `modules/health/src/index.ts` -- Exports
- `apps/mobile/app/(health)/sleep-aids.tsx` -- Sleep aids UI
- `apps/mobile/app/(health)/wind-down.tsx` -- Routine player
- `assets/sounds/` -- Embedded ambient sound files

### Known Limitations
- No sleep stories (text narration, not audio stories)
- No custom sound mixing
- Limited to 6 embedded sounds (no streaming library)
- No smart alarm integration

### Context for Next Agent
- Ambient sounds should be short loops (15-30 seconds) that seamlessly loop. Embed as .mp3 files under 1MB each.
- Use expo-av for audio playback with `shouldPlay`, `isLooping`, and volume fade.
- Background audio requires adding 'audio' to UIBackgroundModes in app.json.
- Bedtime reminders use expo-notifications for local notification scheduling.
- The routine-to-sleep link is set after the routine completes; the next sleep session logged becomes the linked session.
