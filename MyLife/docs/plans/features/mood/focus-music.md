# Feature Spec: Focus Music

## Metadata
- **Module:** mood
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [1] x3 + Complexity [1] x2 + CrossModule [2] x1 + PaidUser [4] x1
- **Sprint:** 3-4
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Existing breathing engine, `mo_settings`
- **Blocks:** none

## Business Context

### Why This Feature Exists
Calm ($69.99/yr, $100M+ ARR) generates significant revenue from focus music and "soundscapes" -- ambient audio that users play while working, studying, or sleeping. The switching score is low (1/5) because focus music is not a strong migration trigger, but the PaidUser score is high (4/5) because it's a strong premium retention feature: users who play focus music daily are far less likely to churn. MyMood can provide algorithmic ambient soundscapes generated on-device (no audio file streaming, no licensing) using Web Audio API / expo-av tone synthesis. The complexity is low (1/5, inverted = high simplicity) because this is fundamentally a sound generator with timer and presets, not a content library.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Calm | Yes | Yes ($69.99/yr) | "Scenes" with nature sounds, rain, ocean, forest, fireplace. Curated audio library. |
| Headspace | Yes | Yes ($69.99/yr) | "Focus" mode with ambient music, nature sounds, and productivity timer |
| Brain.fm | Yes | Yes ($49.99/yr) | AI-generated music designed for focus, relax, sleep. Neural phase-locking claims. |
| Daylio | No | N/A | No audio features |
| Bearable | No | N/A | No audio features |

### Target User
Users who play ambient/focus music while working or studying and currently use Calm, Brain.fm, or YouTube for this purpose. Users who want focus sounds integrated into their mood tracking app (listen to rain while logging mood). Students and remote workers who want a distraction-free audio environment without ads or recommendations. Users who value privacy and offline capability over curated content libraries.

## Technical Context

### Where This Lives in MyLife

```
modules/mood/src/
  types.ts                               -- New types: Soundscape, SoundLayer, FocusSession, SoundPreset
  db/schema-v3.ts                        -- V3 migration for mo_focus_sessions, mo_sound_presets
  db/focus.ts                            -- NEW: Focus session and preset CRUD
  engine/soundscape.ts                   -- NEW: Algorithmic soundscape generator (Web Audio API abstraction)
  engine/sounds.ts                       -- NEW: Sound layer definitions (rain, ocean, wind, birds, white noise, brown noise, etc.)
  __tests__/focus.test.ts                -- NEW: Soundscape engine and CRUD tests

apps/mobile/app/(mood)/
  focus.tsx                              -- NEW: Focus music player screen
  components/SoundMixer.tsx              -- NEW: Layer mixer with individual volume sliders

apps/web/app/mood/
  focus/page.tsx                         -- NEW: Focus music web page
  components/SoundMixer.tsx              -- NEW: Web sound mixer
```

### Wireframe Position

```
Hub Dashboard
  └── MyMood card
       └── Today tab
            ├── Mood log (existing)
            ├── Breathing (existing)
            └── Focus Music ← YOU ARE HERE
                 ├── "Start Focus" button with timer picker
                 ├── Preset quick picks (Rain, Ocean, Forest, Cafe, White Noise)
                 └── Custom mixer (tap for full screen)
                      ├── Layer toggles with volume sliders
                      ├── Timer (25min Pomodoro / 45min Deep / 90min Flow / Custom)
                      └── Save as preset
```

### Data Model

```sql
-- V3 Migration: Focus sessions and custom presets

CREATE TABLE IF NOT EXISTS mo_focus_sessions (
  id TEXT PRIMARY KEY,
  preset_name TEXT NOT NULL,
  layers_json TEXT NOT NULL,
  target_duration_seconds INTEGER NOT NULL,
  actual_duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  pre_mood_score INTEGER CHECK(pre_mood_score >= 1 AND pre_mood_score <= 10),
  post_mood_score INTEGER CHECK(post_mood_score >= 1 AND post_mood_score <= 10),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mo_sound_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  layers_json TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS mo_focus_sessions_started_idx ON mo_focus_sessions(started_at DESC);
```

**Layers JSON format:**
```json
[
  { "sound": "rain", "volume": 0.7 },
  { "sound": "thunder_distant", "volume": 0.3 },
  { "sound": "fireplace", "volume": 0.5 }
]
```

### Dependencies
- **Internal:** `@mylife/mood` (settings, entry CRUD for mood check), `@mylife/ui` (Cool Obsidian tokens)
- **External:** `expo-av` (audio playback on mobile), Web Audio API (browser audio synthesis). Note: actual audio generation uses oscillators and noise generators, not pre-recorded files.
- **Cross-Module:** Minimal. Focus session data could integrate with Health (focus time tracking) in the future.

## Functional Requirements

### User Stories
1. As a user who wants to focus, I want to start an ambient soundscape with one tap so that I can enter a productive state quickly.
2. As a user with specific preferences, I want to mix multiple sound layers (rain + cafe + piano) and save my custom preset.
3. As a user who tracks my productivity, I want focus sessions to log duration and optional mood impact.
4. As a user who meditates, I want to use soundscapes as background for breathing exercises or meditation.

### Behavior Specification

**Starting a Focus Session:**
1. User navigates to Focus Music section (Today tab card or dedicated screen).
2. User sees preset quick picks: Rain, Ocean, Forest, Cafe, White Noise.
3. User selects a preset (or taps "Custom Mix").
4. Timer picker appears: 25min (Pomodoro), 45min (Deep Focus), 90min (Flow), Custom.
5. Optional pre-session mood check (1-10 slider, skippable).
6. Audio begins playing immediately.

**During a Session:**
1. Sound mixer visible: each active layer has a toggle + volume slider (0-100%).
2. User can add/remove layers and adjust volumes in real-time.
3. Timer shows countdown at the top.
4. "Pause" button pauses audio and timer.
5. "End" button stops session.
6. Screen can be locked (audio continues in background on mobile).
7. Gentle fade-in on start (2 seconds), gentle fade-out on end (3 seconds).

**Sound Layer Catalog (Algorithmic):**
| Layer | Type | Description |
|-------|------|-------------|
| rain | Noise + filter | Brown noise filtered to sound like rainfall |
| rain_heavy | Noise + filter | Louder, broader rain |
| ocean | Oscillator + LFO | Sine wave with slow LFO for wave rhythm |
| wind | Noise + filter | White noise with bandpass sweep |
| thunder_distant | Noise + envelope | Low burst with long decay |
| fireplace | Noise + filter | Narrow crackle with random pops |
| birds | Oscillator + random | Chirp patterns with randomized timing |
| cafe | Noise + filter | Pink noise shaped to cafe murmur |
| white_noise | Generator | Pure white noise |
| brown_noise | Generator | Pure brown noise |
| pink_noise | Generator | Pure pink noise |
| creek | Noise + filter | Water-like filtered noise with modulation |

**Completing a Session:**
1. Timer reaches 0 (or user taps "End").
2. Audio fades out over 3 seconds.
3. Optional post-session mood check.
4. Session summary: duration, preset used, mood change.
5. Session saved to `mo_focus_sessions`.

**Custom Presets:**
1. User adjusts layers and volumes.
2. Taps "Save Preset."
3. Names the preset.
4. Preset appears in their personal preset list.

### Edge Cases

- Audio focus interrupted by phone call: pause audio, resume after call (OS handles this on mobile).
- User locks screen during session: audio continues via background audio mode (`expo-av` `staysActiveInBackground`).
- User switches to another app: audio continues in background.
- Bluetooth headphone disconnects: audio pauses (OS default behavior).
- Timer set to 0 (infinite): no countdown, session runs until manual stop.
- All layers muted (volume 0): session timer still runs, no audio output.
- Very long session (>3 hours): no enforced cap, session continues.
- Web: Web Audio API requires user gesture to start AudioContext. First tap initializes the context.
- Safari: Web Audio API has known limitations. Use `createScriptProcessor` fallback if `AudioWorklet` is unavailable.
- Multiple browser tabs: only one tab should play audio. Use singleton pattern.
- Custom preset with 0 layers: reject with validation error.
- Device volume at 0: session runs normally, user controls system volume.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Preset quick picks (Rain, Ocean, Forest, Cafe, White Noise) are visible and start with one tap
- [ ] **AC-2:** Timer picker offers 25min, 45min, 90min, and Custom options
- [ ] **AC-3:** Audio begins within 500ms of session start with 2-second fade-in
- [ ] **AC-4:** Sound mixer shows toggleable layers with individual volume sliders
- [ ] **AC-5:** Adding/removing layers and adjusting volume changes audio in real-time
- [ ] **AC-6:** Audio continues when screen is locked or app is backgrounded (mobile)
- [ ] **AC-7:** Session ends with 3-second fade-out (no abrupt cut)
- [ ] **AC-8:** Post-session summary shows duration and mood change (if provided)
- [ ] **AC-9:** User can create and name custom presets
- [ ] **AC-10:** Custom presets appear in the preset list and are playable
- [ ] **AC-11:** "Pause" button pauses both audio and timer, "Resume" continues
- [ ] **AC-12:** All soundscapes are generated algorithmically (no downloaded audio files)

### Technical Criteria
- [ ] **TC-1:** Soundscape engine generates audio using Web Audio API (oscillators + noise generators + filters)
- [ ] **TC-2:** Focus session persisted to `mo_focus_sessions` with layers_json, durations, and timestamps
- [ ] **TC-3:** Custom presets persisted to `mo_sound_presets` with layers_json
- [ ] **TC-4:** V3 migration creates both tables and index, seeds 5 default presets
- [ ] **TC-5:** Audio playback works in background on mobile (expo-av staysActiveInBackground)
- [ ] **TC-6:** Fade-in (2s) and fade-out (3s) use linear gain ramp
- [ ] **TC-7:** Sound layers can be mixed at runtime without audio glitches

### Negative Criteria
- [ ] **NC-1:** Focus music must NOT require network access (no streaming, no downloads)
- [ ] **NC-2:** Focus music must NOT bundle pre-recorded audio files (algorithmic generation only)
- [ ] **NC-3:** Focus music must NOT drain battery excessively (target <5% per hour of playback)
- [ ] **NC-4:** Focus music must NOT interfere with other apps' audio (respect audio session category)
- [ ] **NC-5:** Focus session timer must NOT drift more than 2 seconds over a 90-minute session

## UI Specification

### Mobile (Expo)
- **Player Screen Background:** `#0A0A0F` (background), ambient glow effect using module accent color `#FB923C` at 5% opacity.
- **Timer Display:** Large centered countdown, 48sp monospace, `#F0F0F5`. Circular progress ring (180dp diameter), `#FB923C` stroke.
- **Sound Mixer:** Vertical list of layer rows. Each row: toggle (24dp circle, `#FB923C` when active), label (14sp, `#F0F0F5`), volume slider (track `rgba(255,255,255,0.06)`, thumb `#FB923C`). `rgba(255,255,255,0.04)` (glass) row background.
- **Preset Cards:** Horizontal scroll, `rgba(255,255,255,0.04)` (glass) cards, 80dp x 100dp, icon + name, `rgba(255,255,255,0.10)` border. Selected card: `#FB923C` border.
- **Controls:** Pause/Resume: 56dp circle, `rgba(255,255,255,0.08)` (glassStrong), icon `#F0F0F5`. End: text button, `rgba(240,240,245,0.65)`.
- **Fade-in/out:** Audio gain animated via `expo-av` volume API or Web Audio `linearRampToValueAtTime`.

### Web (Next.js)
- Same tokens via CSS variables.
- Sound mixer in a side panel or below the timer.
- Web Audio API `AudioContext` for all sound generation.
- Keyboard: Space = pause/resume, Escape = end session.
- Volume sliders use `<input type="range">` styled with Cool Obsidian.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Brief initialization (AudioContext setup) | First session start |
| Empty | Preset selection with timer picker | No active session |
| Error | "Audio unavailable" message with retry | AudioContext blocked or unavailable |
| Success | Active player with timer, mixer, controls | Session in progress |
| Partial | Timer paused, audio silent, "Resume" visible | User paused session |

## Test Requirements

### Unit Tests
- [ ] Soundscape engine: creates noise generator for rain/ocean/wind layers
- [ ] Soundscape engine: applies correct filter for each layer type
- [ ] Soundscape engine: mixes multiple layers without clipping (gain normalization)
- [ ] Soundscape engine: fade-in produces linear gain ramp from 0 to target over 2s
- [ ] Soundscape engine: fade-out produces linear gain ramp from current to 0 over 3s
- [ ] Focus session CRUD: creates session with correct fields
- [ ] Focus session CRUD: updates actual_duration and completed on end
- [ ] Preset CRUD: creates custom preset with valid layers_json
- [ ] Preset CRUD: validates non-empty layers array
- [ ] Preset CRUD: seeds 5 default presets
- [ ] Timer: calculates correct remaining time after pause/resume cycles

### Integration Tests
- [ ] Full flow: select preset -> start -> play 10 seconds -> end -> session persisted with actual_duration >= 10
- [ ] Custom preset: create preset -> select it -> start session -> verify layers_json matches
- [ ] Background audio: start session -> background app -> verify audio continues (mobile-specific test)

### QA Verification Script

1. Open app, navigate to MyMood > Today tab
2. Verify: Focus Music section visible with preset quick picks -- corresponds to AC-1
3. Tap "Rain" preset
4. Verify: Timer picker appears with 25min/45min/90min/Custom -- corresponds to AC-2
5. Select 25min
6. Verify: Audio starts within 500ms with gentle fade-in -- corresponds to AC-3
7. Verify: Rain sound is playing (listen for filtered noise)
8. Open sound mixer
9. Verify: Layer toggles and volume sliders visible -- corresponds to AC-4
10. Toggle "fireplace" layer on, adjust volume
11. Verify: Fireplace sound blends in real-time -- corresponds to AC-5
12. Tap "Pause"
13. Verify: Audio stops, timer pauses, "Resume" visible -- corresponds to AC-11
14. Tap "Resume", verify continues
15. Lock screen (mobile)
16. Verify: Audio continues playing -- corresponds to AC-6
17. Unlock, tap "End"
18. Verify: Audio fades out over 3 seconds -- corresponds to AC-7
19. Verify: Post-session summary shows duration -- corresponds to AC-8
20. Adjust layers to custom mix (rain + ocean + birds)
21. Tap "Save Preset", name it "My Mix"
22. Verify: "My Mix" appears in preset list -- corresponds to AC-9
23. Tap "My Mix" to start new session
24. Verify: Same layer configuration loads -- corresponds to AC-10
25. Verify: No audio files downloaded (check network tab) -- corresponds to AC-12
26. Test on web: navigate to /mood/focus
27. Verify: Same flow works with Web Audio API
28. Verify: Keyboard shortcuts work (Space = pause, Escape = end)

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to focus music URL, start a session, verify all 5 states
- [ ] Batch QA: after 5 features in mood module, run `/qa` on mood URL

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for soundscape engine (layer mixing, fade curves, timer accuracy)

### Post-merge:
- [ ] `/parity-check` -- mood module has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
MyMood has guided breathing (3 patterns) but no ambient audio, no soundscapes, and no focus timer. No audio generation capability in the module.

### After This Work
- V3 migration adds `mo_focus_sessions` and `mo_sound_presets` tables with 5 default presets
- Algorithmic soundscape engine using Web Audio API (12 sound layers)
- Focus timer with Pomodoro/Deep/Flow/Custom durations
- Real-time sound mixer with layer toggles and volume control
- Custom preset creation and management
- Session tracking with pre/post mood comparison
- Background audio playback on mobile

### Files Changed
- `modules/mood/src/types.ts` -- New types: Soundscape, SoundLayer, FocusSession, SoundPreset
- `modules/mood/src/db/schema-v3.ts` -- V3 migration SQL + default preset seeds
- `modules/mood/src/db/focus.ts` -- NEW: Focus session and preset CRUD
- `modules/mood/src/engine/soundscape.ts` -- NEW: Web Audio API soundscape generator
- `modules/mood/src/engine/sounds.ts` -- NEW: Sound layer definitions and parameters
- `modules/mood/src/definition.ts` -- Add V3 migration, bump schemaVersion to 3
- `modules/mood/src/index.ts` -- Export new focus types, CRUD, soundscape engine
- `modules/mood/src/__tests__/focus.test.ts` -- NEW: Tests
- `apps/mobile/app/(mood)/focus.tsx` -- NEW: Focus player screen
- `apps/mobile/app/(mood)/components/SoundMixer.tsx` -- NEW: Layer mixer component
- `apps/web/app/mood/focus/page.tsx` -- NEW: Web focus player
- `apps/web/app/mood/components/SoundMixer.tsx` -- NEW: Web sound mixer

### Known Limitations
- Algorithmic sounds only. No recorded audio (no bird songs, no real rain, no music). The quality will be "good enough" ambient noise but not Calm-quality curated content.
- No binaural beats or neural entrainment (Brain.fm's differentiator). Pure ambient noise generation.
- No sleep timer with gradual volume decrease (could be added as a follow-up).
- Web Audio API support varies. Older browsers or restricted environments may not support all features.
- Battery impact needs real-device testing. Audio processing is lightweight but continuous.

### Context for Next Agent
- Web Audio API is available in all modern browsers and in React Native via `expo-av` or a polyfill. On mobile, use `expo-av` for audio playback management (background mode, interruption handling) but the actual sound generation logic should be platform-agnostic.
- The soundscape engine should abstract over the audio backend: define a `SoundscapePlayer` interface that can be implemented with Web Audio API (web) or `expo-av` (mobile).
- For noise generation: use `AudioContext.createBufferSource()` with a buffer filled with random samples (white noise), then apply `BiquadFilterNode` for colored noise variants (brown = lowpass, pink = pinkish filter).
- `expo-av` requires `Audio.setAudioModeAsync({ staysActiveInBackground: true })` for background playback. Set this on session start, reset on session end.
- The `layers_json` column stores the active layer configuration. Parse on read. Each layer has a `sound` key (matching the catalog) and a `volume` (0.0 - 1.0).
- Gain normalization: when mixing N layers, multiply each layer's gain by `1 / sqrt(N)` to prevent clipping.
