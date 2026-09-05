# Feature Spec: SOS/Panic Button

## Metadata
- **Module:** mood
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [2] x3 + Complexity [4] x2 + CrossModule [3] x1 + PaidUser [3] x1
- **Sprint:** 3-4
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Existing breathing engine (`engine/breathing.ts`), mood entry CRUD, `mo_settings`
- **Blocks:** none

## Business Context

### Why This Feature Exists
When a user is in acute emotional distress (panic attack, severe anxiety, emotional crisis), they need immediate, one-tap access to calming tools rather than navigating through menus. Calm ($69.99/yr, $100M+ ARR) and Headspace ($69.99/yr) both offer "SOS" or "emergency calm" features as premium differentiators. MyMood already has guided breathing built in -- the SOS button wraps existing breathing + grounding exercises into a distress-optimized flow with large tap targets, minimal text, and auto-escalating interventions. This feature is high-complexity (score 4) because the UI must be accessible under duress with haptic feedback, auto-progression, and optional emergency contact display.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Calm | Yes | Yes ($69.99/yr) | "SOS" emergency calm sessions, curated audio, 3-10 min guided breathing |
| Headspace | Yes | Yes ($69.99/yr) | "SOS" tab with 3-minute exercises for panic, anger, grief, overwhelm |
| Daylio | No | N/A | No crisis support features |
| Bearable | No | N/A | No crisis support features |
| Reflectly | No | N/A | No crisis support features |

### Target User
Users experiencing acute emotional distress (panic attacks, anxiety spikes, emotional overwhelm) who need immediate in-app calming tools. Also appeals to therapy patients who practice grounding techniques and want a digital companion. Key migration path: Calm/Headspace users paying $69.99/yr who primarily use the SOS features.

## Technical Context

### Where This Lives in MyLife

```
modules/mood/src/
  types.ts                               -- New types: SOSSession, SOSStep, GroundingExercise
  db/schema-v3.ts                        -- NEW: V3 migration for mo_sos_sessions, mo_emergency_contacts
  db/sos.ts                              -- NEW: SOS CRUD (create/get sessions, manage contacts)
  engine/sos.ts                          -- NEW: SOS flow engine (step sequencing, grounding exercises)
  __tests__/sos.test.ts                  -- NEW: Unit tests for SOS engine + CRUD

apps/mobile/app/(mood)/
  sos.tsx                                -- NEW: SOS full-screen distress mode
  sos-settings.tsx                       -- NEW: SOS settings (contacts, auto-call, customization)

apps/web/app/mood/
  sos/page.tsx                           -- NEW: SOS web page (same flow, keyboard-navigable)
```

### Wireframe Position

```
Hub Dashboard
  └── MyMood card
       ├── SOS Button (floating, always visible) ← YOU ARE HERE
       │    └── Full-screen distress mode
       │         ├── Step 1: Breathing exercise (auto-starts)
       │         ├── Step 2: 5-4-3-2-1 grounding
       │         ├── Step 3: Affirmation cards
       │         └── Step 4: Emergency contacts (optional)
       └── Settings tab
            └── SOS Settings
                 ├── Emergency contacts (up to 3)
                 ├── Default breathing pattern
                 └── Auto-call toggle
```

### Data Model

```sql
-- V3 Migration: SOS sessions and emergency contacts

CREATE TABLE IF NOT EXISTS mo_sos_sessions (
  id TEXT PRIMARY KEY,
  trigger_mood_score INTEGER CHECK(trigger_mood_score >= 1 AND trigger_mood_score <= 10),
  steps_completed INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  exit_mood_score INTEGER CHECK(exit_mood_score >= 1 AND exit_mood_score <= 10),
  breathing_pattern TEXT,
  grounding_completed INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mo_emergency_contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  relationship TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS mo_sos_sessions_started_idx ON mo_sos_sessions(started_at DESC);
```

### Dependencies
- **Internal:** `@mylife/mood` (breathing engine, settings CRUD), `@mylife/ui` (Cool Obsidian tokens, haptics)
- **External:** `expo-haptics` (mobile vibration feedback), `expo-linking` (phone call launch)
- **Cross-Module:** Optional integration with Health module (log crisis event to health timeline), Journal module (prompt post-SOS journal entry)

## Functional Requirements

### User Stories
1. As a user having a panic attack, I want to tap one button and immediately start a calming exercise so that I can ground myself without navigating menus.
2. As a user setting up SOS, I want to add emergency contacts so that I can quickly call someone if breathing exercises aren't enough.
3. As a user who completed an SOS session, I want to optionally log my exit mood so that I can track whether SOS sessions help over time.
4. As a user reviewing my history, I want to see past SOS sessions so that I can understand my crisis patterns.

### Behavior Specification

1. User opens MyMood module (any tab).
2. A floating SOS button is always visible in the bottom-right corner (red circle, pulse animation when mood score <= 3 was logged today).
3. User taps SOS button.
4. Screen transitions to full-screen distress mode (dark background, large elements, minimal text).
5. **Step 1 -- Breathing (auto-starts):** Box breathing begins immediately with large animated circle. Haptic pulses on inhale/exhale transitions. "Breathe with me" text. Duration: 2 minutes (configurable). Skip button available.
6. **Step 2 -- 5-4-3-2-1 Grounding:** Interactive prompts: "Name 5 things you can see", "4 things you can touch", "3 things you can hear", "2 things you can smell", "1 thing you can taste." User taps to advance each count. No text input required.
7. **Step 3 -- Affirmation Cards:** 5 rotating affirmation cards (swipe to cycle). Default set provided, user can customize in settings. Cards fade in/out gently.
8. **Step 4 -- Exit:** "Feeling better?" prompt with optional 1-10 mood re-check. Show emergency contacts if configured. "Call [Name]" buttons. "I'm okay" dismisses.
9. Session data is saved to `mo_sos_sessions`.
10. If user exits early (back button / swipe away), partial session is still saved with steps_completed count.

### Edge Cases

- User triggers SOS with no emergency contacts configured: skip Step 4 contact display, show crisis hotline numbers instead (988 Suicide & Crisis Lifeline, Crisis Text Line).
- User triggers SOS immediately after opening module (no today entries): trigger_mood_score is null.
- User has Do Not Disturb enabled: phone call launch still works (system handles DND bypass for direct calls).
- User triggers SOS while another SOS session is in progress: resume existing session, don't create a duplicate.
- User force-quits app mid-SOS: save partial session on next app launch using started_at without completed_at.
- Module is disabled mid-SOS: SOS should complete its current flow before respecting disable (graceful teardown).
- Very rapid repeated taps on SOS: debounce to prevent multiple session creation (500ms).
- User has no breathing pattern preference set: default to "box" breathing.
- Web platform: no haptics available, skip haptic calls silently.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping the SOS button from any MyMood tab opens full-screen distress mode within 300ms
- [ ] **AC-2:** Breathing exercise auto-starts with animated visual circle and phase labels (inhale/hold/exhale)
- [ ] **AC-3:** Haptic feedback pulses on each breathing phase transition (mobile only)
- [ ] **AC-4:** 5-4-3-2-1 grounding prompts advance on tap with countdown visible (5 -> 4 -> 3 -> 2 -> 1)
- [ ] **AC-5:** Affirmation cards display and can be swiped to cycle through
- [ ] **AC-6:** Exit screen shows optional mood re-check (1-10 slider) and emergency contacts
- [ ] **AC-7:** Emergency contacts display "Call [Name]" buttons that launch phone dialer
- [ ] **AC-8:** SOS button shows subtle pulse animation when today's mood score <= 3
- [ ] **AC-9:** User can skip any step to advance to the next
- [ ] **AC-10:** Full SOS flow works without network connectivity (offline-first)
- [ ] **AC-11:** SOS settings screen allows adding/editing/removing up to 3 emergency contacts
- [ ] **AC-12:** SOS settings screen allows choosing default breathing pattern (box, 4-7-8, relaxing)

### Technical Criteria
- [ ] **TC-1:** SOS session is persisted to `mo_sos_sessions` with correct steps_completed, total_duration_seconds, and timestamps
- [ ] **TC-2:** Exit mood score is stored when provided, null when skipped
- [ ] **TC-3:** Emergency contacts are persisted to `mo_emergency_contacts` with CRUD operations
- [ ] **TC-4:** V3 migration creates both tables and index without errors on fresh install
- [ ] **TC-5:** V3 migration is idempotent (re-running doesn't fail)
- [ ] **TC-6:** SOS engine generates correct step sequence (breathing -> grounding -> affirmation -> exit)
- [ ] **TC-7:** Grounding exercise engine produces correct 5-4-3-2-1 prompt sequence with sense labels

### Negative Criteria
- [ ] **NC-1:** SOS feature must NOT require network access at any point
- [ ] **NC-2:** SOS sessions must NOT be visible to other modules without explicit cross-module API
- [ ] **NC-3:** Emergency contact phone numbers must NOT be synced to any cloud service
- [ ] **NC-4:** SOS button must NOT interfere with normal mood logging workflow
- [ ] **NC-5:** Partial sessions (early exit) must NOT be counted as "completed" in analytics

## UI Specification

### Mobile (Expo)
- **SOS Button:** Floating action button, bottom-right corner, 56x56dp, `#FF453A` (danger token) background, white phone-heart icon, 8dp border radius. Pulse animation (scale 1.0 -> 1.08 -> 1.0, 2s loop) when today's low mood detected.
- **Distress Mode Background:** `#0A0A0F` (background token), full screen, status bar hidden.
- **Breathing Circle:** Centered, 200dp diameter, stroke color `#FB923C` (mood accent), fills/empties with breathing phase. Phase label below in `#F0F0F5` (text token), 24sp.
- **Grounding Prompts:** Large text center-screen, 28sp, `#F0F0F5`. Counter badge (5/4/3/2/1) in `#FB923C` circle, 48dp.
- **Affirmation Cards:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 16dp padding, 24sp text centered.
- **Exit Buttons:** "I'm okay" primary button (`#30D158` success token). "Call [Name]" secondary buttons (`rgba(255,255,255,0.08)` glassStrong).

### Web (Next.js)
- Same tokens via CSS variables in `globals.css`.
- SOS button positioned fixed bottom-right of mood module content area.
- Breathing animation uses CSS `@keyframes` (no canvas needed).
- Grounding prompts advance on Enter key or click.
- No haptics on web (gracefully skipped).
- Phone call buttons use `tel:` links.
- Accessible: full keyboard navigation, ARIA labels on all interactive elements.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Brief fade-in (200ms) to breathing step | SOS button tap |
| Empty | Default crisis hotline numbers (no contacts) | No emergency contacts configured |
| Error | "Session couldn't be saved" toast, flow continues | SQLite write failure |
| Success | "Feeling better?" with mood slider and contacts | All steps completed |
| Partial | "Take your time" message, step indicators | User is mid-flow |

## Test Requirements

### Unit Tests
- [ ] `createSOSSession`: creates session with correct defaults
- [ ] `createSOSSession`: handles null trigger_mood_score
- [ ] `completeSOSSession`: updates steps_completed, total_duration, exit_mood_score
- [ ] `getSOSSessions`: returns sessions ordered by started_at DESC
- [ ] `getSOSSessions`: respects limit parameter
- [ ] SOS engine: generates 4-step sequence (breathing, grounding, affirmation, exit)
- [ ] SOS engine: grounding produces 5-4-3-2-1 prompt array with correct sense labels
- [ ] SOS engine: uses configured breathing pattern, falls back to "box"
- [ ] Emergency contacts CRUD: create, read, update, delete, max 3 enforcement
- [ ] Emergency contacts: sort_order is respected

### Integration Tests
- [ ] Full flow: SOS tap -> breathing -> grounding -> affirmation -> exit -> session persisted with all fields
- [ ] Partial flow: SOS tap -> breathing -> early exit -> session persisted with steps_completed = 1
- [ ] Emergency contact call: "Call [Name]" triggers `Linking.openURL('tel:...')`

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyMood module
3. Verify: SOS button visible in bottom-right corner (red circle) -- corresponds to AC-1
4. Log a mood entry with score 2
5. Verify: SOS button has subtle pulse animation -- corresponds to AC-8
6. Tap SOS button
7. Verify: Full-screen distress mode opens within 300ms -- corresponds to AC-1
8. Verify: Breathing animation starts automatically with phase labels -- corresponds to AC-2
9. Wait for 2 breathing cycles
10. Verify: Haptic feedback on phase transitions (check device vibration) -- corresponds to AC-3
11. Tap "Skip" to advance to grounding
12. Verify: "Name 5 things you can see" prompt with counter badge showing 5 -- corresponds to AC-4
13. Tap 5 times to count down
14. Verify: Prompt advances through senses (see, touch, hear, smell, taste) -- corresponds to AC-4
15. Complete grounding (all 5 senses)
16. Verify: Affirmation cards appear, swipeable -- corresponds to AC-5
17. Swipe through 2-3 cards
18. Tap "Next" to proceed to exit
19. Verify: "Feeling better?" with mood slider and emergency contacts -- corresponds to AC-6
20. Set exit mood to 6
21. Tap "I'm okay"
22. Verify: Returns to MyMood module, session saved
23. Navigate to SOS settings
24. Add an emergency contact (name: "Mom", phone: "555-0100")
25. Verify: Contact saved -- corresponds to AC-11
26. Trigger another SOS session
27. At exit step, verify: "Call Mom" button is visible -- corresponds to AC-7
28. Test on web: navigate to /mood/sos
29. Verify: Same flow works with keyboard navigation (Enter to advance)
30. Verify: No haptic errors in console -- corresponds to TC-7
31. Enable airplane mode, trigger SOS
32. Verify: Full flow works offline -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the SOS URL, trigger full flow, verify all 5 states
- [ ] Batch QA: after 5 features in mood module, run `/qa` on mood URL

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for SOS engine step sequencing and grounding exercise

### Post-merge:
- [ ] `/parity-check` -- mood module has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyMood has breathing exercises accessible via the Settings or dedicated breathing screen, but no distress-optimized flow. No emergency contact storage. No SOS session tracking. Breathing patterns exist as pure functions in `engine/breathing.ts`.

### After This Work
- V3 migration adds `mo_sos_sessions` and `mo_emergency_contacts` tables
- SOS engine provides step sequencing and grounding exercise generation
- Floating SOS button visible on all MyMood tabs
- Full-screen distress mode with 4-step flow
- Emergency contacts CRUD with up to 3 contacts
- SOS session history tracking with entry/exit mood scores

### Files Changed
- `modules/mood/src/types.ts` -- New types: SOSSession, SOSStep, GroundingExercise, EmergencyContact
- `modules/mood/src/db/schema-v3.ts` -- NEW: V3 migration SQL
- `modules/mood/src/db/sos.ts` -- NEW: SOS session and emergency contact CRUD
- `modules/mood/src/engine/sos.ts` -- NEW: SOS flow engine, grounding exercise generator
- `modules/mood/src/definition.ts` -- Add V3 migration to MOOD_MODULE
- `modules/mood/src/index.ts` -- Export new SOS types, CRUD, engine functions
- `modules/mood/src/__tests__/sos.test.ts` -- NEW: SOS engine and CRUD tests
- `apps/mobile/app/(mood)/sos.tsx` -- NEW: Full-screen SOS distress mode
- `apps/mobile/app/(mood)/sos-settings.tsx` -- NEW: SOS configuration screen
- `apps/web/app/mood/sos/page.tsx` -- NEW: SOS web page

### Known Limitations
- Audio-guided breathing not included (no audio file infrastructure yet). Visual + haptic only.
- Crisis hotline numbers are US-only defaults. Internationalization is a future feature.
- No push notification trigger for SOS (would require background monitoring of mood scores).

### Context for Next Agent
- The breathing engine at `engine/breathing.ts` is pure and well-tested. Reuse `getBreathingCycleSteps()` directly.
- V3 migration must be added to the `migrations` array in `definition.ts` after the existing V2 entry. Bump `schemaVersion` to 3.
- The `mo_settings` table can store SOS preferences (default pattern, auto-call toggle) using existing `getSetting`/`setSetting` CRUD.
- Haptics should use `expo-haptics` `impactAsync` with `ImpactFeedbackStyle.Medium` for breathing transitions.
- The `expo-linking` package handles `tel:` URL scheme for phone calls on mobile.
