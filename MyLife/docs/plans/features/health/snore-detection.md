# Feature Spec: Snore Detection

## Metadata
- **Module:** health
- **Priority Score:** 20 / 50 (C-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 1 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** 7
- **Estimated CC Time:** 6-8 hours
- **Depends On:** Sleep stage analysis (sleep session context)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Snore detection records and analyzes snoring during sleep using the phone's microphone. Sleep Cycle and SnoreLab both offer this and have significant paid user bases. Snoring correlation with sleep quality, body position, and lifestyle factors (alcohol, allergies) provides actionable health insights. Complexity is 1 (hardest) because it requires real-time audio processing, noise classification, and background recording while the phone sits on the nightstand. This is a premium-justifying feature (PaidUser 3/5).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Sleep Cycle | Yes | Yes ($39.99/yr) | Audio-based snore detection with recording snippets |
| SnoreLab | Yes | Freemium ($24.99/yr) | Dedicated snore tracking, intensity scoring, remedies |
| Apple Health | Partial | Free | iPhone can detect snoring via Apple Watch or iPhone mic (iOS 17+) |
| Pillow | Yes | Yes ($4.99/mo) | Snore and sleep talk recording with audio playback |
| SleepWatch | Yes | Yes ($29.99/yr) | Snore detection with intensity levels |

### Target User
Users who suspect they snore and want evidence. Partners of snorers who want to show data to motivate change. Users concerned about sleep apnea who want a screening tool before seeing a doctor. Anyone who wants to correlate snoring with sleep quality, alcohol consumption, or body position.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/snore/engine.ts             -- Snore classification and scoring
modules/health/src/snore/types.ts              -- Snore session and event types
modules/health/src/snore/crud.ts               -- Snore data persistence
modules/health/src/db/schema.ts                -- New hl_snore_sessions, hl_snore_events tables
modules/health/src/index.ts                    -- Export snore detection functions
apps/mobile/app/(health)/snore.tsx             -- Snore detection screen
apps/mobile/app/(health)/snore-detail.tsx      -- Snore session detail with audio playback
apps/web/app/health/snore/page.tsx             -- Web snore history (no recording)
```

### Wireframe Position

```
Hub Dashboard
  +-- MyHealth card
       +-- Vitals tab
            +-- Sleep section
                 +-- Snore Detection <-- YOU ARE HERE
                      |-- Start recording button
                      |-- Snore intensity score (0-100)
                      |-- Timeline of snore events
                      |-- Audio snippet playback
                      +-- Trend over time
```

### Data Model

```sql
-- Snore session: one per night of recording
CREATE TABLE IF NOT EXISTS hl_snore_sessions (
    id TEXT PRIMARY KEY,
    sleep_session_id TEXT,                -- Link to hl_sleep_sessions if available
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_minutes INTEGER,
    snore_score INTEGER,                  -- 0-100 intensity score
    snore_minutes INTEGER DEFAULT 0,      -- Total minutes of snoring detected
    snore_percentage REAL,                -- % of recording time spent snoring
    loudest_db REAL,                      -- Loudest snore in decibels
    average_db REAL,                      -- Average snore volume
    event_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'recording',  -- recording | completed | cancelled
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Individual snore events within a session
CREATE TABLE IF NOT EXISTS hl_snore_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES hl_snore_sessions(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,              -- When the snore occurred
    duration_seconds REAL NOT NULL,       -- Length of the snore event
    intensity TEXT NOT NULL,              -- 'light' | 'moderate' | 'loud' | 'epic'
    decibels REAL,                        -- Peak dB reading
    audio_clip_path TEXT,                 -- Path to saved audio snippet (nullable)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hl_snore_session_date_idx ON hl_snore_sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS hl_snore_session_sleep_idx ON hl_snore_sessions(sleep_session_id);
CREATE INDEX IF NOT EXISTS hl_snore_event_session_idx ON hl_snore_events(session_id);
CREATE INDEX IF NOT EXISTS hl_snore_event_time_idx ON hl_snore_events(timestamp);
```

### Dependencies
- **Internal:** `@mylife/db`, hl_sleep_sessions (for linking snore data to sleep), sleep stage analysis (correlate snoring with stage)
- **External:** `expo-av` (audio recording), device microphone, potentially `expo-audio-analysis` or a lightweight audio classification library for snore vs. non-snore sounds
- **Cross-Module:** Sleep tracking correlation. Wellness timeline could show snore events. Readiness score could factor in severe snoring nights.

## Functional Requirements

### User Stories
1. As a user who suspects I snore, I want to record my sleep sounds so I have evidence and data.
2. As a user, I want a snore intensity score so I can track whether my snoring is improving or worsening.
3. As a user, I want to listen to audio snippets of my snoring so I can hear what my partner hears.
4. As a user, I want to see snoring trends over time so I can correlate with lifestyle changes (e.g., "I snore less when I avoid alcohol").

### Behavior Specification

**Starting a snore recording:**
1. User navigates to Vitals > Sleep > Snore Detection
2. Screen shows "Start Recording" button with instructions:
   - "Place your phone on the nightstand, screen down"
   - "Plug in your charger (recording uses battery)"
   - "Recording will auto-stop after 10 hours or when you wake"
3. User taps "Start Recording"
4. Microphone permissions requested if not granted
5. Recording begins. Screen dims. keepAwake enabled.
6. Small indicator shows recording is active

**During recording:**
1. Audio is processed in chunks (30-second windows)
2. Each chunk is analyzed for snore-like sounds:
   - Frequency range: 100-800 Hz (typical snoring range)
   - Pattern: rhythmic, repeating bursts of 0.5-3 seconds
   - Volume: above ambient noise floor
3. When a snore is detected:
   - Create an hl_snore_events record with timestamp, duration, intensity
   - Optionally save a 10-second audio clip centered on the event
4. Intensity classification based on peak decibels:
   - Light: 40-50 dB
   - Moderate: 50-60 dB
   - Loud: 60-70 dB
   - Epic: >70 dB

**After recording (morning):**
1. User taps "Stop Recording" or recording auto-stops at 10 hours
2. System finalizes the snore session:
   - Calculate snore_score (0-100) based on frequency, duration, and intensity
   - Calculate snore_minutes and snore_percentage
   - Find loudest_db and average_db
   - Count total events
   - Link to sleep session if one exists for the same time window
3. Display session summary:
   - Snore Score: large number with color (green <30, yellow 30-60, orange 60-80, red >80)
   - Timeline visualization: horizontal bar showing when snoring occurred during the night
   - Stats: total snore time, event count, loudest reading
   - Audio clips: list of saved snippets (tap to play)

**Snore history and trends:**
1. History screen shows past snore sessions as cards
2. Each card: date, snore score, snore minutes
3. Trend chart: snore score over time (7/30 day view)
4. Correlation note: "You snored X% more on nights after logging alcohol" (if habits module is connected)

**Score calculation:**
1. Base score = snore_percentage * 100 (if you snore 40% of the night, base = 40)
2. Intensity multiplier: average intensity weighted (light=0.5, moderate=1.0, loud=1.5, epic=2.0)
3. Final score = clamp(base * intensity_multiplier, 0, 100)
4. Score interpretation:
   - 0-10: Quiet sleeper (green)
   - 11-30: Light snorer (green)
   - 31-60: Moderate snorer (yellow)
   - 61-80: Heavy snorer (orange)
   - 81-100: Severe snorer (red, suggest medical consultation)

### Edge Cases

- **No microphone permission:** Show permission request. If denied, feature is unavailable. Show settings link.
- **Very noisy environment (fan, traffic):** Ambient noise calibration on recording start. Snore detection filters for rhythmic, body-frequency sounds above the calibrated noise floor.
- **Partner snoring:** Cannot distinguish between users. Mention this limitation: "Place phone closer to your pillow for best results."
- **Phone moved during recording:** Audio levels may shift. Engine recalibrates ambient noise periodically (every 5 minutes).
- **10-hour recording limit reached:** Auto-stop and finalize session. Show note: "Recording stopped after 10 hours."
- **Battery dies during recording:** Session saved as 'cancelled' with data recorded up to that point.
- **Storage full (too many audio clips):** Stop saving new clips. Keep metadata. Show "Storage full" warning.
- **No snoring detected all night:** Score = 0, show encouraging message: "Quiet night! No snoring detected."
- **App killed during recording:** Background audio mode should keep it alive. If killed anyway, save partial session.
- **Sleep talk detected:** Current version does not distinguish snoring from sleep talking. Both count as sound events. Future enhancement could add classification.
- **Module disabled:** Recordings and data preserved. Re-enabling shows history.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Start Recording" button begins audio recording with microphone
- [ ] **AC-2:** Recording indicator visible while active (subtle, screen-dimmed)
- [ ] **AC-3:** Recording auto-stops after 10 hours or manual stop
- [ ] **AC-4:** Session summary shows snore score, timeline, and stats after stopping
- [ ] **AC-5:** Snore events shown on a timeline visualization (when during the night)
- [ ] **AC-6:** Audio clips are playable from the session detail screen
- [ ] **AC-7:** Snore score is color-coded (green/yellow/orange/red)
- [ ] **AC-8:** History screen shows past sessions with trend chart
- [ ] **AC-9:** Intensity labels (Light/Moderate/Loud/Epic) display correctly per event
- [ ] **AC-10:** Severe snoring (>80) shows medical consultation suggestion

### Technical Criteria
- [ ] **TC-1:** hl_snore_sessions and hl_snore_events tables created by migration
- [ ] **TC-2:** Audio recording works in background mode (app can be screen-locked)
- [ ] **TC-3:** Snore detection processes 30-second audio chunks in near-real-time
- [ ] **TC-4:** Ambient noise calibration adjusts detection threshold
- [ ] **TC-5:** Audio clips stored locally with configurable retention (default: 30 days)
- [ ] **TC-6:** Snore score formula produces values in 0-100 range correctly
- [ ] **TC-7:** Session-to-sleep linking uses overlapping time windows

### Negative Criteria
- [ ] **NC-1:** Audio recordings must NOT be uploaded or sent over network
- [ ] **NC-2:** Must NOT record continuously when app is not in recording mode
- [ ] **NC-3:** Must NOT present results as medical diagnosis (disclaimer required)
- [ ] **NC-4:** Must NOT drain battery excessively (target <15% for 8-hour recording)

## UI Specification

### Mobile (Expo)
- **Start screen:** Large center button (pulsing circle in `#10B981`), instructions text in `rgba(240,240,245,0.65)`, charger reminder. Dark background `#0A0A0F`.
- **Recording active:** Very dim screen. Small red recording dot top-left. Elapsed time counter. "Stop" button bottom-center.
- **Session summary:** Glass card with snore score as large colored number. Horizontal timeline bar below (quiet=dark, snoring=red/orange/yellow by intensity). Stats in three columns: Duration, Events, Loudest.
- **Audio clips:** List of clips with play button, timestamp, and intensity badge. Waveform visualization during playback.
- **History:** Glass cards per session with date, score badge, snore minutes. Trend chart in `#10B981`.

### Web (Next.js)
- `/health/snore` route. View-only (no recording on web). Shows history and trends.
- Note: "Snore recording is available on the mobile app only."

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Ready | Start button + instructions | Initial navigation |
| Permission | Microphone permission dialog | First recording attempt |
| Recording | Dim screen + recording indicator | Recording active |
| Processing | "Analyzing your night..." spinner | Recording stopped |
| Summary | Score + timeline + stats + clips | Analysis complete |
| No snoring | Score 0 with encouraging message | No events detected |
| History | Past sessions with trend chart | History tab |
| No permission | "Microphone access required" + settings link | Permission denied |

## Test Requirements

### Unit Tests
- [ ] `classifySnoreIntensity`: 45 dB = 'light'
- [ ] `classifySnoreIntensity`: 55 dB = 'moderate'
- [ ] `classifySnoreIntensity`: 65 dB = 'loud'
- [ ] `classifySnoreIntensity`: 75 dB = 'epic'
- [ ] `calculateSnoreScore`: 0% snoring = 0
- [ ] `calculateSnoreScore`: 50% light snoring ~= 25
- [ ] `calculateSnoreScore`: 50% loud snoring ~= 75
- [ ] `calculateSnoreScore`: clamps to 100 max
- [ ] `getScoreCategory`: 5 = 'quiet', 25 = 'light', 45 = 'moderate', 70 = 'heavy', 90 = 'severe'
- [ ] `calculateSnorePercentage`: 120 snore minutes / 480 total = 25%
- [ ] `finalizeSession`: computes all aggregate stats correctly
- [ ] `linkToSleepSession`: matches by overlapping time window
- [ ] `createSnoreEvent`: stores all fields correctly
- [ ] `getSnoreHistory`: returns sessions in reverse chronological order

### Integration Tests
- [ ] Full flow: start recording -> detect snore events -> stop -> summary computed -> in history
- [ ] Empty flow: record with no snoring -> score 0 -> encouraging message
- [ ] Linking flow: snore session overlaps sleep session -> linked correctly

### QA Verification Script

1. Navigate to MyHealth > Vitals > Sleep > Snore Detection
2. Verify: Start recording button and instructions visible
3. Tap "Start Recording"
4. Verify: Microphone permission requested (if first time)
5. Verify: Recording indicator visible -- corresponds to AC-2
6. Play snoring sounds near the phone (use a YouTube snoring video for testing)
7. Wait 2 minutes, then tap "Stop Recording"
8. Verify: Session summary shows with snore score -- corresponds to AC-4
9. Verify: Score is color-coded -- corresponds to AC-7
10. Verify: Timeline shows when snoring occurred -- corresponds to AC-5
11. Verify: Events have intensity labels -- corresponds to AC-9
12. Tap an audio clip
13. Verify: Clip plays back -- corresponds to AC-6
14. Navigate to snore history
15. Verify: Session appears in history -- corresponds to AC-8
16. Record a quiet night (in a silent room)
17. Verify: Score 0 with encouraging message

## gstack Quality Gates

Based on Complexity 1 (Inverse), this feature is "Complex" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for snore scoring

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Health module has sleep tracking with stage analysis and quality scoring, but no audio-based snore detection. No microphone recording exists in the app.

### After This Work
- Overnight audio recording via phone microphone
- Real-time snore event detection with intensity classification
- Snore scoring (0-100) with color-coded categories
- Audio clip saving and playback
- Session-to-sleep linking for correlation
- Snore history with trend visualization
- Ambient noise calibration for noisy environments

### Files Changed
- `modules/health/src/snore/engine.ts` -- Snore classification, scoring, ambient calibration (NEW)
- `modules/health/src/snore/types.ts` -- Snore session/event types (NEW)
- `modules/health/src/snore/crud.ts` -- CRUD for sessions and events (NEW)
- `modules/health/src/db/schema.ts` -- hl_snore_sessions + hl_snore_events tables
- `modules/health/src/db/migrations.ts` -- V3 migration (or part of V3 with smart alarm)
- `modules/health/src/definition.ts` -- schemaVersion bump
- `modules/health/src/index.ts` -- Export snore functions
- `apps/mobile/app/(health)/snore.tsx` -- Snore detection UI (NEW)
- `apps/mobile/app/(health)/snore-detail.tsx` -- Session detail with audio (NEW)

### Known Limitations
- Cannot distinguish between user's snoring and partner's snoring
- No sleep talk vs. snore classification (both counted as sound events)
- No integration with smart alarm (e.g., "don't wake me if I'm snoring lightly")
- Audio clips limited to 10-second snippets (not full-night recordings)
- No positional tracking (cannot detect body position during snoring)
- Battery usage may be significant for 8+ hour recordings
- No Apple Watch microphone support (phone mic only)
- Not a medical device: cannot diagnose sleep apnea (disclaimer required)

### Context for Next Agent
- The hardest part of this feature is reliable snore classification from raw audio. Consider these approaches in order of complexity:
  1. **Simple amplitude + frequency:** Detect rhythmic sound bursts in the 100-800 Hz range above ambient threshold. This is what SnoreLab v1 used. Good enough for v1.
  2. **FFT analysis:** Run FFT on 30-second chunks, look for peaks in the snoring frequency range. More accurate but heavier.
  3. **ML classification:** Use a pre-trained TFLite model for snore vs. non-snore. Best accuracy but requires bundling a model. Save for v2.
- Use expo-av for recording: `Audio.Recording.createAsync()` with `RECORDING_OPTIONS_PRESET_LOW_QUALITY` to minimize file size. Process audio in 30-second chunks.
- Background audio recording requires: (a) 'audio' in UIBackgroundModes (app.json), (b) audio session category set to 'record', (c) keepAwake to prevent screen sleep that might interrupt recording.
- Audio clips should be saved as .m4a (AAC) files in the app's document directory. Implement auto-cleanup for clips older than 30 days to manage storage.
- The snore score formula intentionally weights intensity higher than duration. A few loud snores are more concerning than many light ones. The multiplier system (light=0.5, loud=1.5, epic=2.0) achieves this.
- Include a medical disclaimer: "Snore detection is for informational purposes only and is not a medical device. Consult a healthcare provider if you suspect a sleep disorder."
