# Feature Spec: Guided Meditation

## Metadata
- **Module:** mood
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [2] x3 + Complexity [2] x2 + CrossModule [3] x1 + PaidUser [4] x1
- **Sprint:** 3-4
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Existing breathing engine (`engine/breathing.ts`), `mo_breathing_sessions` table
- **Blocks:** none

## Business Context

### Why This Feature Exists
Calm ($69.99/yr, $100M+ ARR) and Headspace ($69.99/yr) have proven that guided meditation is a multi-billion dollar feature category. MyMood already has guided breathing (3 patterns), but no structured meditation sessions with progressive steps (body scan, visualization, mindfulness). The high PaidUser score (4/5) reflects that meditation is a strong premium conversion driver -- users willingly pay $70/yr for Calm/Headspace primarily for this feature. MyMood can deliver text-guided meditation sessions (no audio files needed) with timer, step progression, and session tracking, all offline and free from subscription fatigue. The cross-module score (3/5) allows integration with Health (log meditation minutes) and Journal (post-meditation reflection prompt).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Calm | Yes | Yes ($69.99/yr) | Massive audio library (1000+ sessions), celebrity narration, daily calm |
| Headspace | Yes | Yes ($69.99/yr) | Structured courses (beginner -> advanced), themed packs, animations |
| Daylio | No | N/A | No meditation features |
| Bearable | No | N/A | No meditation features |
| Reflectly | No | N/A | Journaling focus, no guided meditation |

### Target User
Users who want meditation guidance without paying $70/yr for Calm/Headspace. Beginners who need structure (step-by-step instructions) rather than open-ended "sit and breathe." Existing MyMood breathing users who want to expand their mindfulness practice. Privacy-conscious users who want meditation without cloud accounts, tracking, or social features.

## Technical Context

### Where This Lives in MyLife

```
modules/mood/src/
  types.ts                               -- New types: MeditationSession, MeditationTemplate, MeditationStep, MeditationCategory
  db/schema-v3.ts                        -- V3 migration for mo_meditation_sessions, mo_meditation_templates
  db/meditation.ts                       -- NEW: Meditation CRUD (sessions, templates)
  engine/meditation.ts                   -- NEW: Meditation engine (step timer, progress tracking)
  __tests__/meditation.test.ts           -- NEW: Tests

apps/mobile/app/(mood)/
  meditation.tsx                         -- NEW: Meditation session screen (timer + step display)
  meditation-library.tsx                 -- NEW: Template library browser
  components/MeditationTimer.tsx         -- NEW: Circular timer component

apps/web/app/mood/
  meditation/page.tsx                    -- NEW: Meditation session page
  meditation/library/page.tsx            -- NEW: Template library page
```

### Wireframe Position

```
Hub Dashboard
  └── MyMood card
       └── Today tab
            ├── Mood log (existing)
            ├── Breathing (existing)
            └── Meditation ← YOU ARE HERE
                 ├── "Start Meditation" button
                 ├── Quick picks (3 featured templates)
                 └── "Browse Library" link
                      └── Meditation Library
                           ├── Categories (Beginner, Body Scan, Visualization, Mindfulness, Sleep)
                           └── Template cards with duration + difficulty
```

### Data Model

```sql
-- V3 Migration: Meditation sessions and templates

CREATE TABLE IF NOT EXISTS mo_meditation_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK(difficulty IN ('beginner', 'intermediate', 'advanced')),
  duration_seconds INTEGER NOT NULL,
  steps_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mo_meditation_sessions (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES mo_meditation_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  steps_completed INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL,
  pre_mood_score INTEGER CHECK(pre_mood_score >= 1 AND pre_mood_score <= 10),
  post_mood_score INTEGER CHECK(post_mood_score >= 1 AND post_mood_score <= 10),
  completed INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS mo_meditation_sessions_started_idx ON mo_meditation_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS mo_meditation_templates_category_idx ON mo_meditation_templates(category);
```

**Step JSON format** (stored in `steps_json`):
```json
[
  { "instruction": "Find a comfortable position and close your eyes.", "durationSeconds": 10 },
  { "instruction": "Take three deep breaths. Inhale through your nose, exhale through your mouth.", "durationSeconds": 30 },
  { "instruction": "Bring your attention to your feet. Notice any sensations there.", "durationSeconds": 45 }
]
```

### Dependencies
- **Internal:** `@mylife/mood` (breathing engine for breathing-meditation hybrid, settings), `@mylife/ui` (Cool Obsidian tokens)
- **External:** `expo-haptics` (gentle haptic on step transition), `expo-keep-awake` (prevent screen sleep during session)
- **Cross-Module:** Optional integration with Health module (log meditation minutes to health timeline), Journal module (post-meditation reflection prompt)

## Functional Requirements

### User Stories
1. As a beginner, I want to follow step-by-step guided meditation instructions so that I can learn to meditate without prior experience.
2. As a regular meditator, I want to choose from different meditation types (body scan, visualization, mindfulness) so that I can vary my practice.
3. As a user tracking my wellness, I want to see my meditation history and mood impact so that I can understand whether meditation is helping me.
4. As a user, I want to create custom meditation sessions so that I can practice my preferred technique.

### Behavior Specification

**Starting a Session:**
1. User navigates to Meditation section (Today tab or dedicated screen).
2. User sees "Quick Start" (5-min beginner) and 3 featured templates.
3. User taps a template or "Browse Library" for the full catalog.
4. Before starting, optional pre-session mood check (1-10 slider, skippable).
5. Session begins: screen dims, instruction text appears with countdown timer.

**During a Session:**
1. Current step instruction displayed as large centered text.
2. Circular progress timer shows time remaining in current step.
3. Soft transition between steps (fade out/in, 500ms).
4. Gentle haptic pulse on step transitions (mobile only).
5. Overall progress bar at top shows position in total session.
6. "Pause" button available -- pauses timer but keeps screen dim.
7. "End Early" button ends session and saves partial progress.
8. Screen stays awake during active session (expo-keep-awake).

**Completing a Session:**
1. Final step: "Slowly open your eyes. Take a moment to notice how you feel."
2. Post-session mood check (1-10 slider, skippable).
3. Session summary: duration, steps completed, mood change (if both pre/post provided).
4. "Great job" message with streak info if applicable.
5. Session saved to `mo_meditation_sessions`.

**Meditation Library:**
1. Templates organized by category: Beginner, Body Scan, Visualization, Mindfulness, Sleep.
2. Each template shows: name, description, duration, difficulty badge, category icon.
3. Default library ships with 15 templates (3 per category).
4. User can create custom templates (add steps with text + duration).

### Edge Cases

- User force-quits mid-session: save partial session on next app launch using started_at without completed_at, mark completed = 0.
- Screen rotates during session: maintain timer state across orientation changes.
- Phone call interrupts session: pause session, resume when call ends.
- User creates template with 0 steps: reject with validation error.
- User creates template with total duration > 60 minutes: warn but allow.
- Step with 0-second duration: skip to next step immediately.
- All templates deleted by user: show "Create your first meditation" prompt. Default templates can be restored from settings.
- Module disabled mid-session: complete current session before respecting disable.
- Web platform: no haptics, no keep-awake needed (browser doesn't sleep).
- Timer drift: use absolute timestamps for step transitions, not interval-based counting.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Quick Start" button launches a 5-minute beginner meditation immediately
- [ ] **AC-2:** Meditation library displays templates organized by 5 categories
- [ ] **AC-3:** Each template card shows name, duration, difficulty badge, and category icon
- [ ] **AC-4:** Pre-session mood check slider appears before session starts (skippable)
- [ ] **AC-5:** During session: instruction text, circular timer, and overall progress bar are visible
- [ ] **AC-6:** Step transitions have smooth fade animation (500ms) and haptic pulse (mobile)
- [ ] **AC-7:** "Pause" button pauses timer, "Resume" continues from exact position
- [ ] **AC-8:** "End Early" saves partial session with correct steps_completed count
- [ ] **AC-9:** Post-session shows summary with duration, steps completed, and mood change delta
- [ ] **AC-10:** Screen stays awake during active meditation session (mobile)
- [ ] **AC-11:** User can create custom meditation templates with step-by-step editor
- [ ] **AC-12:** Default library ships with 15 templates across 5 categories

### Technical Criteria
- [ ] **TC-1:** Meditation session is persisted to `mo_meditation_sessions` with all fields
- [ ] **TC-2:** Pre/post mood scores stored when provided, null when skipped
- [ ] **TC-3:** V3 migration creates both tables, index, and seeds 15 default templates
- [ ] **TC-4:** Steps JSON is valid and parseable for all default templates
- [ ] **TC-5:** Timer uses absolute timestamp comparison (not intervals) to prevent drift
- [ ] **TC-6:** Custom template validation rejects empty steps array
- [ ] **TC-7:** Session tracking is accurate even after pause/resume cycles

### Negative Criteria
- [ ] **NC-1:** Meditation must NOT require network access (no audio streaming)
- [ ] **NC-2:** Meditation must NOT play audio files (text-guided only for V1)
- [ ] **NC-3:** Timer must NOT drift more than 1 second over a 30-minute session
- [ ] **NC-4:** Screen must NOT turn off during active meditation (mobile)
- [ ] **NC-5:** Custom templates must NOT allow steps with empty instruction text

## UI Specification

### Mobile (Expo)
- **Session Screen Background:** `#0A0A0F` (background), dimmed ambient. No status bar.
- **Instruction Text:** Centered, 22sp, `#F0F0F5` (text token), max 3 lines with line-height 1.6.
- **Circular Timer:** 180dp diameter, stroke `#FB923C` (mood accent), 4dp stroke width. Countdown text in center, 32sp monospace, `#F0F0F5`.
- **Progress Bar:** Top of screen, full width, 3dp height, `rgba(255,255,255,0.06)` track, `#FB923C` fill.
- **Pause/End Buttons:** Bottom center. Pause: ghost button, `rgba(255,255,255,0.08)`. End Early: text button, `rgba(240,240,245,0.65)`.
- **Template Cards:** Glass morphism card, `rgba(255,255,255,0.04)` fill, 12dp radius. Category icon left (24dp), name 16sp, duration + difficulty badges right.
- **Difficulty Badges:** Beginner = `#30D158`, Intermediate = `#FB923C`, Advanced = `#FF453A`.

### Web (Next.js)
- Same tokens via CSS variables.
- Session screen uses full viewport height with centered content.
- Timer animation via CSS `conic-gradient` rotation.
- Keyboard shortcuts: Space = pause/resume, Escape = end early.
- Template library in responsive grid (3 columns desktop, 1 column mobile).

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Template library skeleton cards | Initial data fetch |
| Empty | "Create your first meditation" CTA | No templates (all deleted) |
| Error | "Session couldn't be saved" toast | SQLite write failure |
| Success | Session summary with mood delta | Session completed |
| Partial | "Session ended early" with partial stats | User tapped "End Early" |

## Test Requirements

### Unit Tests
- [ ] Meditation engine: parses steps_json correctly
- [ ] Meditation engine: calculates total session duration from step durations
- [ ] Meditation engine: advances to next step when step timer expires
- [ ] Meditation engine: handles pause/resume with correct remaining time
- [ ] Meditation engine: reports correct steps_completed on early exit
- [ ] Template validation: rejects empty steps array
- [ ] Template validation: rejects step with empty instruction
- [ ] Template CRUD: create, read, update, delete templates
- [ ] Session CRUD: create session with pre_mood_score, complete with post_mood_score
- [ ] Session CRUD: get sessions ordered by started_at DESC
- [ ] Default templates: 15 templates, 3 per category, all with valid steps_json

### Integration Tests
- [ ] Full flow: select template -> pre-mood check -> complete all steps -> post-mood check -> session saved
- [ ] Partial flow: start session -> complete 2/5 steps -> "End Early" -> session saved with steps_completed = 2
- [ ] Custom template: create template -> start session from it -> complete -> verify template_id in session

### QA Verification Script

1. Open app, navigate to MyMood > Today tab
2. Verify: Meditation section visible with "Quick Start" and featured templates
3. Tap "Quick Start"
4. Verify: Pre-session mood slider appears -- corresponds to AC-4
5. Set pre-mood to 4, tap "Begin"
6. Verify: Instruction text, circular timer, progress bar visible -- corresponds to AC-5
7. Wait for step transition
8. Verify: Smooth fade animation and haptic pulse -- corresponds to AC-6
9. Tap "Pause"
10. Verify: Timer stops, "Resume" button appears -- corresponds to AC-7
11. Tap "Resume", verify timer continues
12. Wait for session to complete naturally (or use Quick Start short session)
13. Verify: Post-session mood slider appears
14. Set post-mood to 6
15. Verify: Summary shows duration, steps completed, "+2 mood improvement" -- corresponds to AC-9
16. Navigate to Meditation Library
17. Verify: 5 categories with templates -- corresponds to AC-2
18. Verify: Template cards show name, duration, difficulty badge -- corresponds to AC-3
19. Start a new session, tap "End Early" after 2 steps
20. Verify: Partial session summary shows correct steps_completed -- corresponds to AC-8
21. Verify: Screen stayed awake during session -- corresponds to AC-10
22. Navigate to meditation settings/custom
23. Create a custom template with 3 steps
24. Verify: Template appears in library -- corresponds to AC-11
25. Count default templates
26. Verify: 15 default templates present -- corresponds to AC-12
27. Test on web: navigate to /mood/meditation
28. Verify: Same flow with keyboard shortcuts (Space = pause, Escape = end)

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to meditation URL, run a session, verify all 5 states
- [ ] Batch QA: after 5 features in mood module, run `/qa` on mood URL

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for meditation step timer and progress tracking

### Post-merge:
- [ ] `/parity-check` -- mood module has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyMood has guided breathing (3 patterns with step-by-step inhale/hold/exhale cycles) but no structured meditation sessions. No meditation templates, no session tracking with pre/post mood comparison.

### After This Work
- V3 migration adds `mo_meditation_templates` and `mo_meditation_sessions` tables
- 15 default meditation templates across 5 categories (Beginner, Body Scan, Visualization, Mindfulness, Sleep)
- Meditation engine with step timer, pause/resume, and progress tracking
- Custom template creation
- Pre/post mood tracking per session
- Session history with completion stats

### Files Changed
- `modules/mood/src/types.ts` -- New types: MeditationSession, MeditationTemplate, MeditationStep, MeditationCategory
- `modules/mood/src/db/schema-v3.ts` -- V3 migration SQL + default template seeds
- `modules/mood/src/db/meditation.ts` -- NEW: Meditation session and template CRUD
- `modules/mood/src/engine/meditation.ts` -- NEW: Step timer, progress tracking, pause/resume logic
- `modules/mood/src/definition.ts` -- Add V3 migration, bump schemaVersion to 3
- `modules/mood/src/index.ts` -- Export new meditation types, CRUD, engine
- `modules/mood/src/__tests__/meditation.test.ts` -- NEW: Tests
- `apps/mobile/app/(mood)/meditation.tsx` -- NEW: Meditation session screen
- `apps/mobile/app/(mood)/meditation-library.tsx` -- NEW: Template library browser
- `apps/mobile/app/(mood)/components/MeditationTimer.tsx` -- NEW: Circular timer component
- `apps/web/app/mood/meditation/page.tsx` -- NEW: Web meditation session
- `apps/web/app/mood/meditation/library/page.tsx` -- NEW: Web template library

### Known Limitations
- Text-guided only. No audio narration, background sounds, or music. Audio requires content licensing and file bundling that is out of scope for V1.
- No social features (shared meditations, group sessions).
- No integration with Apple Health meditation minutes (future HealthKit write).
- Default template content is authored by developers, not certified meditation instructors.

### Context for Next Agent
- The breathing engine at `engine/breathing.ts` provides a pattern for step-based timed exercises. Meditation follows the same "step with duration" model but with text instructions instead of breathing phases.
- `expo-keep-awake` should be activated when session starts and deactivated on complete/exit. Use `activateKeepAwakeAsync()` / `deactivateKeepAwake()`.
- Timer should use `Date.now()` snapshots for step transition timing, not `setInterval` counts. Store `stepStartedAt` and compare against `Date.now()` on each tick. This prevents drift.
- The steps_json column stores a JSON array of `{ instruction: string, durationSeconds: number }`. Parse on read, validate on write.
- V3 migration needs to seed the 15 default templates. Use INSERT OR IGNORE to make it idempotent.
