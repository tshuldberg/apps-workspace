# Feature Spec: MyVoice Full Mobile UI

## Metadata
- **Module:** voice
- **Task ID:** M11-7
- **Priority:** P0 (foundation for all Voice mobile work)
- **Estimated CC Time:** 6-8 hours
- **Depends On:** All V1/V2 CRUD and engines already implemented (transcriptions, voice notes, speakers, commands, language profiles)
- **Blocks:** Voice web UI, voice cross-module command integrations

## Business Context

### Why This Spec Exists
MyVoice has 50+ exported functions across 2 schema versions, 4 engines (text processing, speaker diarization, command matching, language detection), 8 database tables, 10 types/schemas, and 18 supported languages. The entire backend is complete and tested with 25+ passing tests. But the mobile UI is a single placeholder screen that only shows a basic dictation interface. The module is entirely unusable as a product. This spec designs the full mobile experience: 6 primary screens organized into 4 tabs that surface every feature the backend already supports.

### Competitor Landscape (Mobile UX)

| Competitor | Screen Count | Key Feature | Paywall? | Gap We Fill |
|-----------|-------------|-------------|----------|-------------|
| Otter.ai | ~8 | AI transcription, speaker labels, search | Yes ($100/yr) | Cloud-only, no privacy, no cross-app commands |
| Notta | ~6 | Multi-language, real-time collab | Yes ($120/yr) | Cloud-dependent, no offline, no hub integration |
| Rev Voice Recorder | ~4 | Simple record + transcribe | Freemium | No speaker ID, no commands, no language detection |
| Apple Voice Memos | ~3 | Record, trim, organize | Free | No transcription, no speaker ID, no commands |
| Just Press Record | ~3 | One-tap record + transcription | $7.99 | No speakers, no commands, no multi-language |
| Whisper Transcription | ~4 | On-device Whisper model | $5.99 | No commands, no hub integration, basic UI |

### MyVoice Differentiators
- **Privacy-first:** All transcription on-device, zero cloud dependency, zero analytics
- **Cross-module commands:** "Start fasting," "Add expense $50," "Log mood 4" route to 10+ MyLife modules
- **Speaker diarization:** Color-coded speaker timeline with named profiles and voice print tracking
- **Multi-language:** 18 languages with auto-detection, language profiles, and per-segment breakdown
- **Hub integration:** Voice becomes a universal input method for the entire MyLife suite

### Target User
Primary: professionals and students who record meetings, lectures, interviews, and personal memos. They currently use Otter.ai or Notta but are frustrated by subscription costs ($100+/yr), cloud dependency, and privacy concerns. Secondary: multilingual users who switch languages mid-conversation and need accurate per-segment attribution. Tertiary: power users who want hands-free control of their MyLife modules via voice commands.

## Screen Architecture

### Navigation Structure

```
(voice)/
  _layout.tsx              -- Tabs navigator (4 tabs) + hidden stack screens
  index.tsx                -- Tab 1: Record (live dictation with waveform)
  notes.tsx                -- Tab 2: Notes (voice notes list)
  commands.tsx             -- Tab 3: Commands (command center)
  settings.tsx             -- Tab 4: Settings (preferences, links)
  note/[id].tsx            -- Stack: Note detail (speaker timeline, language segments)
  command/add.tsx          -- Stack: Command builder / editor
  command/log.tsx          -- Stack: Command execution history
  speakers.tsx             -- Stack: Speaker directory
  speaker/[id].tsx         -- Stack: Speaker profile / editor
  languages.tsx            -- Stack: Language profile management
  language/add.tsx         -- Stack: Create / edit language profile
  stats.tsx                -- Stack: Transcription statistics dashboard
```

### Tab Bar Configuration

| Tab | Label | Icon | Screen | Badge |
|-----|-------|------|--------|-------|
| 1 | Record | `mic` | `index.tsx` | Recording indicator (red dot) when active |
| 2 | Notes | `file-text` | `notes.tsx` | Unread count (new since last viewed) |
| 3 | Commands | `zap` | `commands.tsx` | -- |
| 4 | Settings | `settings` | `settings.tsx` | -- |

Stack screens are hidden from the tab bar via `href: null` (same pattern as recipes/rsvp modules).

### Layout Pattern

Follow the recipes module layout pattern (`apps/mobile/app/(recipes)/_layout.tsx`):
- `Tabs` navigator from `expo-router`
- `ModuleErrorBoundary` wrapper with `moduleName="MyVoice"`
- `BackToHubButton` in `headerLeft`
- Accent color: `colors.modules.voice` (`#EF4444`)
- Cool Obsidian theme tokens throughout

### Wireframe Position

```
Hub Dashboard
  |-- MyVoice card
       |-- (voice) tab navigator
            |-- Record tab (index.tsx)
            |     |-- Waveform visualizer
            |     |-- Live transcript panel
            |     |-- Speaker labels (if multi-speaker)
            |     |-- Language badge (if detected)
            |     |-- Record/stop/pause controls
            |
            |-- Notes tab (notes.tsx)
            |     |-- Search bar + filter chips
            |     |-- Voice note cards
            |     |-- [tap] -> Note Detail (note/[id].tsx)
            |     |     |-- Full transcript
            |     |     |-- Speaker timeline
            |     |     |-- Language segments
            |     |     |-- Keywords + summary
            |     |     |-- Actions (share, export, delete)
            |     |-- [swipe] -> favorite toggle / delete
            |
            |-- Commands tab (commands.tsx)
            |     |-- Active commands list
            |     |-- Preset templates section
            |     |-- [tap] -> Command builder (command/add.tsx)
            |     |-- History icon -> Command log (command/log.tsx)
            |
            |-- Settings tab (settings.tsx)
                  |-- Language Profiles -> languages.tsx
                  |-- Speaker Directory -> speakers.tsx
                  |-- Transcription Stats -> stats.tsx
                  |-- Recording preferences
                  |-- Data export
```

### Data Model Summary

8 tables across 2 schema migrations (V1 + V2):

| Table | Key Fields | Engine |
|-------|-----------|--------|
| `vc_transcriptions` | text, duration_seconds, language, confidence, audio_uri | text-engine |
| `vc_voice_notes` | title, transcription_id (FK), tags, is_favorite | -- |
| `vc_settings` | key/value pairs | -- |
| `vc_speakers` | name, voice_print_hash, sample_count, color | speaker-engine |
| `vc_speaker_segments` | transcription_id, speaker_id, speaker_label, start/end seconds, text | speaker-engine |
| `vc_commands` | phrase, action, module_target, params, is_enabled, priority, usage_count | command-engine |
| `vc_command_log` | command_id, matched_phrase, match_confidence, success, error_message | command-engine |
| `vc_language_segments` | transcription_id, language, start/end seconds, text, confidence | language-engine |
| `vc_language_profiles` | name, languages (JSON array), is_default | language-engine |

### Dependencies
- **Internal:** `@mylife/voice` (all 4 engines, all CRUD functions), `@mylife/ui` (Cool Obsidian tokens, Card, Text), `@mylife/db` (database provider), `@mylife/module-registry` (for command target validation)
- **External:** `expo-router` (tabs + stack), `expo-av` (audio recording/playback), `expo-haptics` (recording start/stop feedback), `react-native-reanimated` (waveform animation)
- **Cross-Module:** Voice commands target 10 modules (fast, budget, recipes, mood, habits, meds, journal, notes, workouts) via PRESET_TEMPLATES.

### Hooks (new, to be created)

| Hook | Purpose | Returns |
|------|---------|---------|
| `useVoiceNotes(options?)` | Paginated voice notes list with search/filter | `{ notes, loading, error, loadMore, refresh }` |
| `useVoiceNote(id)` | Single note with linked transcription, speakers, languages | `{ note, transcription, speakerSegments, languageSegments, loading }` |
| `useTranscriptionStats()` | Aggregate stats (total count, duration, by language) | `{ stats, loading }` |
| `useSpeakers()` | All speaker profiles | `{ speakers, loading, refresh }` |
| `useCommands(options?)` | Commands list with optional enabled-only filter | `{ commands, loading, refresh }` |
| `useCommandLog(options?)` | Command execution history | `{ log, loading, loadMore }` |
| `useLanguageProfiles()` | Language profiles with default indicator | `{ profiles, defaultProfile, loading }` |
| `useRecorder()` | Recording state machine (idle/recording/paused/processing) | `{ state, duration, start, stop, pause, resume, waveformData }` |

---

## Screen Specifications

### Screen 1: Record Tab (`index.tsx`)

**Purpose:** Primary recording experience. The hero screen of MyVoice. Users land here to start a new recording with live transcription, speaker labels, and language detection.

**Layout:**
```
┌─────────────────────────────────────┐
│ ← MyVoice                    ⚙️ 🕐  │  Header: settings gear + recent notes clock
├─────────────────────────────────────┤
│                                     │
│        ┌───────────────────┐        │
│        │  ~~~~~~~~~~~~     │        │  Waveform visualizer (animated)
│        │  ~~~~~~~~~~       │        │  Real-time audio amplitude bars
│        │  ~~~~~~~~~~~~     │        │  Module red accent (#EF4444)
│        └───────────────────┘        │
│                                     │
│           02:34 recording           │  Duration counter (large, center)
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 🔵 Speaker 1: "I think we  │    │  Live transcript panel (scrolling)
│  │   should launch next week." │    │  Color-coded by speaker
│  │ 🟠 Speaker 2: "That works  │    │  Auto-scrolls to latest segment
│  │   for me, let's finalize   │    │  Language badge inline if multi-lang
│  │   the design first."       │    │
│  │ 🔵 Speaker 1: "Agreed."   │    │
│  │                    ▼ more   │    │
│  └─────────────────────────────┘    │
│                                     │
│    [en-US 🇺🇸]  [2 speakers]       │  Status badges (language + speaker count)
│                                     │
│  ┌─────┐   ┌─────────┐   ┌─────┐  │
│  │  ⏸  │   │  ⏺ REC  │   │  ✓  │  │  Controls: Pause | Record/Stop | Save
│  └─────┘   └─────────┘   └─────┘  │  Record button: large, red, pulsing
│                                     │
│    [Quick Note]  [Command Mode]     │  Mode toggles (bottom row)
└─────────────────────────────────────┘
```

**Recording States:**

| State | Waveform | Button | Duration | Transcript Panel |
|-------|----------|--------|----------|-----------------|
| Idle | Flat line, dimmed | Red circle "Tap to record" | Hidden | "Tap record to start capturing" |
| Recording | Animated bars, red accent | Pulsing red square "Recording" | Counting up, bold | Live text streaming, auto-scroll |
| Paused | Frozen bars, amber tint | Amber circle "Resume" | Frozen, "(paused)" label | Paused indicator, scroll enabled |
| Processing | Shimmer animation | Spinner "Processing..." | Final duration shown | "Analyzing transcription..." skeleton |
| Complete | Fade out | "Save as Note" CTA | Final duration | Full transcript, editable title field |

**State Transition Animations:**
- Idle -> Recording: record button scales from 1.0 to 0.9 with spring easing (300ms), waveform bars fade in from bottom (staggered 50ms per bar), duration counter fades in. Haptic: medium impact.
- Recording -> Paused: waveform bars freeze in place, button color crossfades to amber (200ms), "(paused)" label fades in. Haptic: light impact.
- Paused -> Recording: reverse of pause animation. Haptic: light impact.
- Recording -> Processing: waveform bars collapse to center line (200ms ease-out), shimmer overlay fades in, spinner replaces button (crossfade 150ms).
- Processing -> Complete: shimmer fades out, transcript panel scrolls to top, title field slides down from top (250ms spring). "Save as Note" button slides up from bottom (250ms spring).
- All transitions use `react-native-reanimated` `withSpring` (damping: 15, stiffness: 150) or `withTiming` (duration specified above, easing: Easing.out(Easing.cubic)).

**Behavior:**
1. User taps the record button
2. `expo-av` starts audio recording, `useRecorder` transitions to `recording` state
3. Waveform animates in real-time from audio amplitude data
4. Live transcript appears in the panel (on-device speech recognition)
5. If multiple speakers detected, segments are color-coded using `SPEAKER_COLORS`
6. If language switches detected, inline language badge appears (e.g., `[es]`)
7. User can tap Pause to freeze recording (audio continues buffering)
8. User taps Stop or checkmark
9. State transitions to Processing: full transcription is finalized, speakers labeled, language segments merged
10. State transitions to Complete: user can edit the auto-generated title, add tags, then save
11. Saving creates both a `Transcription` and a `VoiceNote` record

**Quick Note Mode:** Single-tap shortcut that starts recording immediately, auto-saves after 2 seconds of silence, uses "Voice Note - [timestamp]" as default title. For rapid capture. During Quick Note, the UI shows a minimal overlay: pulsing red dot + duration counter. On auto-save, a toast appears: "Saved: Voice Note - [timestamp]" and the note is appended to the Notes list. The user is NOT navigated away from the Record tab. If the user taps another button during auto-save, the save completes first (debounced).

**Command Mode Toggle:** When active, the recording engine also runs `matchCommand()` against registered commands in real-time. Matched commands show a confirmation toast with the target module icon. Command execution is fully async/fire-and-forget: the command dispatches to the target module in the background and does NOT pause, modify, or interrupt the recording pipeline. The recording continues uninterrupted regardless of command success or failure.

**Live Transcription Fallback:** If the platform Speech API is unavailable on the device (e.g., older Android, simulator), the transcript panel shows "Live transcription unavailable on this device." The user can still record audio; the transcription field will be empty. This is NOT an error state. The waveform, duration counter, and all other recording features work normally. Settings toggle "Show live transcript" disables the transcript panel entirely for users who prefer audio-only recording.

**Waveform Decision:** V1 uses amplitude bar chart only (vertical bars proportional to audio volume, animated at 60fps via react-native-reanimated). Spectrogram view is explicitly deferred to V2. If spectrogram is desired later, open a new feature spec rather than modifying this one.

**Engine Functions Used:**
- Recording: `expo-av` Audio.Recording
- Live transcription: platform speech recognition (Speech API)
- Speaker processing: `processDiarization()`, `getSpeakerColor()`, `isMultiSpeaker()`
- Language detection: `processLanguageDetection()`, `getLanguageColor()`, `isMultiLanguage()`
- Text analysis: `calculateWordCount()`, `extractKeywords()`
- Command matching: `matchCommand()` with `getCommands(db, { enabledOnly: true })`
- Save: `createTranscription()`, `createVoiceNote()`, `createSpeakerSegment()`, `createLanguageSegment()`

**User Journey (emotional arc):**

| Step | User Does | User Feels | Design Supports It |
|------|-----------|-----------|-------------------|
| 1 | Opens MyVoice | "What can I do here?" (orientation) | Large record button as focal point, calm dark background, no clutter |
| 2 | Taps record | "It's listening" (activation) | Haptic confirmation, waveform springs to life, red pulsing = active |
| 3 | Speaks naturally | "It's capturing everything" (confidence) | Live transcript scrolling, speaker colors appearing, language badge |
| 4 | Pauses to think | "I can take my time" (control) | Amber = safe/paused, duration frozen, no data loss anxiety |
| 5 | Stops recording | "Let me see what I said" (review) | Smooth transition to complete state, full transcript visible |
| 6 | Edits title, saves | "This is mine, organized" (ownership) | Title field focused, tags available, save is one tap |
| 7 | Finds note later | "I can always find it" (trust) | Search, filter chips, preview text on cards |

**States:**

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton waveform + controls | Initial module load |
| Idle | Flat waveform, "Tap to record" CTA | Default / after save |
| Recording | Animated waveform, live transcript, pulsing red button | Record tapped |
| Paused | Frozen waveform, amber button, "(paused)" label | Pause tapped |
| Processing | Shimmer waveform, spinner button | Stop tapped |
| Complete | Full transcript, title field, save button | Processing done |
| Error | "Microphone access denied" with settings link | Permission denied |

---

### Screen 2: Voice Notes List (`notes.tsx`)

**Purpose:** Browse, search, and manage all voice notes. The library of everything the user has recorded. Primary way to find and re-read past recordings.

**Layout:**
```
┌─────────────────────────────────────┐
│ ← MyVoice                      🔍  │  Header with search toggle
├─────────────────────────────────────┤
│ [🔍 Search notes, tags, keywords...│  Search bar (collapsible)
├─────────────────────────────────────┤
│ [All] [Favorites ★] [Multi-Speaker]│  Filter chips (horizontal scroll)
│ [Multi-Language] [Has Commands]     │  Active chip = accent fill
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ★ Team Standup Notes           │ │  Voice note card (glass morphism)
│ │ 2m 34s · 3 speakers · en-US   │ │  Duration + speaker count + language
│ │ "I think we should launch..."  │ │  First line of transcript (preview)
│ │ #meeting #product              │ │  Tags (pill badges)
│ │                    Mar 23, 10a │ │  Timestamp (right-aligned, caption)
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Grocery List Dictation          │ │  Note without speakers (no badge)
│ │ 0m 45s · en-US                 │ │
│ │ "Milk, eggs, bread, and..."    │ │
│ │                    Mar 22, 3p  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Spanish Practice Session       │ │  Multi-language note
│ │ 5m 12s · en/es                 │ │  Language badge shows both
│ │ "Hola, vamos a practicar..."   │ │
│ │ #spanish #practice             │ │
│ │                    Mar 21, 7p  │ │
│ └─────────────────────────────────┘ │
│                                     │
│         Empty State:                │
│    🎙️ "No voice notes yet.         │
│     Record your first note on       │
│     the Record tab."                │
│                                     │
│                              [+ ●]  │  FAB: Quick Record (navigates to Record tab)
└─────────────────────────────────────┘
```

**Card Design:**
- Background: glass surface (`rgba(255,255,255,0.04)`) with `glassBorder`
- Favorite star: `#FBBF24` (amber) if favorited, dimmed if not
- Speaker count badge: colored dots matching speaker colors, e.g., "🔵🟠🟢 3 speakers"
- Language badge: flag emoji + code (e.g., "🇺🇸 en" or "🇺🇸🇪🇸 en/es" for multi-language)
- Tag pills: `surfaceElevated` background, `textSecondary` text, rounded
- Duration: formatted via `formatDuration()` engine function

**Swipe Actions:**
- Swipe left: Delete (red, with confirmation)
- Swipe right: Toggle favorite (amber star)

**Sort Options** (accessible via header menu):
- Most recent (default)
- Longest duration
- Most speakers
- Alphabetical

**Engine Functions Used:**
- `getVoiceNotes(db, { limit, offset })` with pagination
- `getTranscription(db, note.transcriptionId)` for preview text
- `getSpeakerSegments(db, transcriptionId)` for speaker count
- `getLanguageSegments(db, transcriptionId)` for language badge
- `formatDuration()` for duration display
- `toggleFavorite()` for swipe action

**States:**

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton note cards (shimmer) | Initial load |
| Empty | Illustration + "No voice notes yet" + CTA to Record tab | No notes in DB |
| Success | Scrollable note card list | Notes exist |
| Search active | Filtered results, "No matches" if empty | Search text entered |
| Filter active | Filtered by chip (favorites, multi-speaker, etc.) | Chip selected |
| Error | "Failed to load notes" + retry button | DB read fails |

---

### Screen 3: Note Detail (`note/[id].tsx`)

**Purpose:** Full view of a single voice note with rich transcription features: speaker timeline, language segments, text analysis, and playback controls. This is the deep-dive screen where the user reviews and works with their recording.

**Layout:**
```
┌─────────────────────────────────────┐
│ ← Note Detail              ★  ⋮   │  Header: favorite toggle + overflow menu
├─────────────────────────────────────┤
│                                     │
│  Team Standup Notes                 │  Title (editable on tap, heroTitle style)
│  Mar 23, 2026 · 10:14 AM           │  Date (caption, textSecondary)
│  #meeting #product                  │  Tags (editable pill row)
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ▶ ─────●──────────── 2:34  │    │  Audio playback bar
│  │   0:00                      │    │  Scrubber + play/pause + timestamps
│  └─────────────────────────────┘    │
│                                     │
│  [Transcript] [Speakers] [Languages]│  Segment control (3 views)
│                                     │
│  ── Transcript View ──────────────  │
│  ┌─────────────────────────────┐    │
│  │ 🔵 Alex (0:00-0:45)        │    │  Speaker-labeled segments
│  │ I think we should launch    │    │  Tappable to seek audio to timestamp
│  │ the feature next week. The  │    │  Speaker color dot + name
│  │ designs are almost final.   │    │
│  │                             │    │
│  │ 🟠 Jordan (0:45-1:12)      │    │
│  │ That works for me. Let's    │    │
│  │ finalize the design first   │    │
│  │ and do a quick review.      │    │
│  │                             │    │
│  │ 🔵 Alex (1:12-2:34)        │    │
│  │ Agreed. I'll send the mock  │    │
│  │ ups tonight and we can      │    │
│  │ review tomorrow morning.    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ── Analysis Card ────────────────  │
│  ┌─────────────────────────────┐    │
│  │ 📊 Analysis                 │    │  Glass card with stats
│  │ Words: 156   Reading: 1 min │    │  Word count + reading time
│  │ Duration: 2m 34s            │    │  Recording duration
│  │ Keywords: launch, design,   │    │  Top 5 extracted keywords
│  │   review, feature, final    │    │
│  │ Summary: "Team discussed    │    │  Auto-generated summary (3 sentences)
│  │   launching feature next    │    │
│  │   week after design review."│    │
│  └─────────────────────────────┘    │
│                                     │
│  [Export TXT]  [Copy Text]  [Share] │  Action buttons (bottom row)
│                                     │
└─────────────────────────────────────┘
```

**Segment Control Views:**

**1. Transcript View (default):** Full text with speaker labels, timestamps, and tappable segments that seek the audio player to that position. If no speakers detected, shows plain text with paragraph breaks.

**2. Speakers View:** Visual speaker timeline + breakdown.
```
┌─────────────────────────────────┐
│ Speaker Timeline                │
│ ┌───────────────────────────┐   │
│ │ 🔵████░░🟠███░░🔵████████│   │  Horizontal timeline bar
│ │ 0:00          1:00    2:34│   │  Color segments = who's speaking
│ └───────────────────────────┘   │
│                                 │
│ Speaker Breakdown               │
│ 🔵 Alex         1m 47s (69%)   │  Per-speaker stats
│    12 segments · Tap to edit    │
│ 🟠 Jordan       0m 47s (31%)   │
│    6 segments · Tap to edit     │
│                                 │
│ [Manage Speakers]               │  Link to speakers.tsx directory
└─────────────────────────────────┘
```

**3. Languages View:** Language segment breakdown (only shown if multi-language or language data exists).
```
┌─────────────────────────────────┐
│ Language Breakdown              │
│ ┌───────────────────────────┐   │
│ │ 🔵████████████░░🟠██████│   │  Horizontal timeline bar
│ │ en-US              es-US  │   │  Color = language
│ └───────────────────────────┘   │
│                                 │
│ 🇺🇸 English (US)  1m 50s (72%) │  Per-language stats
│ 🇪🇸 Spanish (US)  0m 44s (28%) │
│                                 │
│ Segments                        │
│ 0:00-1:50  en-US  "I think..." │  Tappable segment list
│ 1:50-2:34  es-US  "Vamos a..." │  Seeks audio on tap
└─────────────────────────────────┘
```

**Overflow Menu Actions:**
- Edit title
- Edit tags
- Reassign speaker (select segment, pick different speaker)
- Delete note (with confirmation)

**Audio Playback + Transcript Sync:** Seeking to a timestamp via the scrubber highlights the corresponding speaker segment in the transcript view with a subtle accent-color left border. A "now playing" indicator (thin vertical accent line) moves through the speaker timeline bar in Speakers view. Tapping a transcript segment seeks the audio to that segment's `startSeconds`. During playback, the transcript auto-scrolls to keep the active segment visible.

**Engine Functions Used:**
- `getVoiceNote(db, id)` + `getTranscription(db, transcriptionId)` for note data
- `getSpeakerSegments(db, transcriptionId)` for speaker timeline
- `getSpeakerBreakdown(segments)` for speaker stats
- `getLanguageSegments(db, transcriptionId)` for language view
- `getLanguageBreakdown(db, transcriptionId)` for language percentages
- `calculateWordCount(text)`, `calculateReadingTime(text)` for analysis
- `extractKeywords(text, 5)` for keyword extraction
- `summarizeText(text, 3)` for auto-summary
- `formatDuration(seconds)` for duration display
- `getSpeakerColor(index)` for speaker colors
- `getLanguageColor(code)` for language colors

**States:**

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton content blocks | Navigating to detail |
| Success | Full note with transcript, analysis, playback | Note loaded |
| No audio | Transcript shown, playback bar hidden | audioUri is null |
| No speakers | Plain transcript, Speakers tab hidden | No speaker segments |
| No languages | Languages tab hidden | No language segments |
| Error | "Note not found" + back button | Invalid ID / deleted |

---

### Screen 4: Command Manager (`commands.tsx`)

**Purpose:** Central hub for managing voice commands. Browse active commands, install presets, toggle commands on/off, and access execution history. This is where voice becomes a control surface for the entire MyLife hub.

**Layout:**
```
┌─────────────────────────────────────┐
│ ← MyVoice Commands          📋 +   │  Header: log icon + add button
├─────────────────────────────────────┤
│                                     │
│  Active Commands (4)                │  Section header with count
│  ┌─────────────────────────────┐    │
│  │ "Start fasting"             │    │  Command card (glass morphism)
│  │ 🍽️ Fast · start_fast        │    │  Module icon + name + action
│  │ Used 12 times          [●]  │    │  Usage count + enable toggle
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ "Add expense [amount]"      │    │  Variable slot shown in brackets
│  │ 💰 Budget · add_expense     │    │
│  │ Used 8 times           [●]  │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ "Log mood [rating]"         │    │  Disabled command (dimmed)
│  │ 🎭 Mood · log_mood          │    │
│  │ Used 3 times           [○]  │    │  Toggle off = outline circle
│  └─────────────────────────────┘    │
│                                     │
│  ── Preset Templates ───────────── │  Collapsible section
│  Browse 10 ready-made commands      │
│  for Fast, Budget, Recipes, and     │
│  7 more modules.                    │
│  [Browse Templates →]               │  Expands to show template list
│                                     │
│  ── Recently Executed ──────────── │  Mini log (last 3 executions)
│  ✅ "Start fasting" · 2 min ago    │  Green check = success
│  ✅ "Add expense 50" · 1 hr ago    │  Shows matched phrase + time
│  ❌ "Log mood 4" · 3 hrs ago       │  Red X = failure (module disabled)
│  [View Full History →]              │  Link to command/log.tsx
│                                     │
│  Empty State:                       │
│  🎤 "No commands yet.              │
│   Voice commands let you control    │
│   MyLife hands-free. Start with     │
│   preset templates."                │
│  [Browse Templates]                 │
│                                     │
└─────────────────────────────────────┘
```

**Command Card Design:**
- Background: glass surface, `glassBorder`
- Phrase: `text` token, bold, with variable slots highlighted in accent color
- Module badge: module icon + name in `textSecondary`
- Usage count: `textSecondary`, right side
- Toggle: accent red when enabled, outline when disabled
- Tap card: opens command/add.tsx in edit mode
- Long press: shows delete confirmation

**Template Browser (expanded):**
```
┌─────────────────────────────────┐
│ Preset Templates                │
│                                 │
│ 🍽️ Fasting                      │  Grouped by module
│   "Start fasting"        [Add]  │  One-tap install button
│   "End my fast"          [Add]  │
│                                 │
│ 💰 Budget                       │
│   "Add expense [amount]" [Add]  │
│                                 │
│ 🍳 Recipes                      │
│   "Add [item] to list"   [Add]  │
│                                 │
│ 🎭 Mood                         │
│   "Log mood [rating]"    [Add]  │
│                                 │
│ ... (6 more modules)            │
└─────────────────────────────────┘
```

**Engine Functions Used:**
- `getCommands(db)` for full list
- `getCommands(db, { enabledOnly: true })` for active count
- `getCommandLog(db, { limit: 3 })` for recent executions
- `PRESET_TEMPLATES` constant for template browser
- `createCommand()` for installing templates
- `updateCommand()` for toggling enabled state
- `deleteCommand()` for removal
- `incrementCommandUsage()` after execution

**States:**

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton command cards | Initial load |
| Empty | Illustration + "No commands yet" + templates CTA | No commands in DB |
| Success | Active commands + templates + recent log | Commands exist |
| Partial | Some commands with "module disabled" warning badge | Target module disabled |
| Error | "Failed to load commands" + retry | DB read fails |

---

### Screen 5: Language Profiles (`languages.tsx`)

**Purpose:** Manage language profiles that control multi-language detection behavior. Users create profiles for their common language combinations (e.g., "Work: English + Spanish" or "Family: Mandarin + English") and set a default for new recordings.

**Layout:**
```
┌─────────────────────────────────────┐
│ ← Language Profiles             +   │  Header with add button
├─────────────────────────────────────┤
│                                     │
│  Default Profile                    │  Section: current default (highlighted)
│  ┌─────────────────────────────┐    │
│  │ ★ Work Meetings             │    │  Default badge (amber star)
│  │ 🇺🇸 English (US)             │    │  Language list with flags
│  │ 🇪🇸 Spanish (US)             │    │
│  │                     Default  │    │  "Default" label (accent color)
│  └─────────────────────────────┘    │
│                                     │
│  Other Profiles (2)                 │  Section: additional profiles
│  ┌─────────────────────────────┐    │
│  │ Family Calls                │    │  Profile card (glass surface)
│  │ 🇨🇳 Mandarin (Simplified)    │    │
│  │ 🇺🇸 English (US)             │    │
│  │               [Set Default]  │    │  Action button
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ Language Practice           │    │
│  │ 🇫🇷 French (France)          │    │
│  │ 🇩🇪 German                   │    │
│  │ 🇺🇸 English (US)             │    │
│  │               [Set Default]  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ── Supported Languages ────────── │  Reference section (collapsible)
│  18 languages available:            │
│  English (US/UK), Spanish (US/ES/  │
│  MX), Mandarin (CN/TW), French    │
│  (FR/CA), German, Japanese, Korean,│
│  Portuguese (BR/PT), Hindi, Arabic,│
│  Italian, Russian                   │
│                                     │
│  Empty State:                       │
│  🌐 "No language profiles yet.     │
│   Create a profile to enable       │
│   multi-language detection during   │
│   recording."                       │
│  [Create Profile]                   │
│                                     │
└─────────────────────────────────────┘
```

**Profile Card Design:**
- Background: glass surface, `glassBorder`
- Default profile: amber star icon + "Default" label in accent color
- Language rows: flag emoji + full name, one per line
- Max 5 languages per profile (enforced by `MAX_PROFILE_LANGUAGES`)
- Tap card: opens language/add.tsx in edit mode
- Swipe left: delete (with confirmation, cannot delete default)

**Create/Edit Profile (`language/add.tsx`):**
```
┌─────────────────────────────────┐
│ ← New Profile            Save   │
├─────────────────────────────────┤
│ Profile Name                    │
│ [Work Meetings              ]   │  Text input
│                                 │
│ Languages (select up to 5)      │
│                                 │
│ Selected:                       │
│ ✅ 🇺🇸 English (US)        [×]  │  Removable selected items
│ ✅ 🇪🇸 Spanish (US)        [×]  │
│                                 │
│ Available:                      │  Grouped by region
│ ── Global ──                    │
│ ☐ 🇬🇧 English (UK)             │
│ ── Americas ──                  │
│ ☐ 🇪🇸 Spanish (Mexico)         │
│ ☐ 🇧🇷 Portuguese (Brazil)      │
│ ☐ 🇨🇦 French (Canada)          │
│ ── Europe ──                    │
│ ☐ 🇪🇸 Spanish (Spain)          │
│ ☐ 🇫🇷 French (France)          │
│ ☐ 🇩🇪 German                   │
│ ... (more)                      │
│                                 │
│ [  ] Set as default profile     │  Checkbox
└─────────────────────────────────┘
```

**Engine Functions Used:**
- `getLanguageProfiles(db)` for profile list
- `createLanguageProfile(db, id, input)` for new profiles
- `setDefaultProfile(db, id)` for default switching
- `deleteLanguageProfile(db, id)` for removal
- `validateProfileLanguages(languages)` for validation (1-5 languages, valid BCP 47)
- `SUPPORTED_LANGUAGES` constant for available language list
- `getLanguageColor(code)` for flag/badge coloring

**States:**

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton profile cards | Initial load |
| Empty | Illustration + "No profiles" + create CTA | No profiles in DB |
| Success | Default profile highlighted + other profiles listed | Profiles exist |
| Error | "Failed to load profiles" + retry | DB read fails |

---

### Screen 6: Transcription Stats (`stats.tsx`)

**Purpose:** Analytics dashboard showing transcription patterns, usage trends, and insights. Motivational progress tracking that answers: "How much have I recorded? In what languages? With whom?"

**Layout:**
```
┌─────────────────────────────────────┐
│ ← Transcription Stats               │  Header
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Total Recordings             │    │  Hero stat card (glass, full width)
│  │      47                      │    │  Large number (stat style, 36px, accent)
│  │ 2h 34m total · 3m 17s avg  │    │  Total + average duration
│  └─────────────────────────────┘    │
│                                     │
│  ┌──────────┐  ┌──────────┐        │  Stat pair (side by side)
│  │ Words    │  │ Speakers │        │
│  │  12,847  │  │    8     │        │  Total word count + unique speakers
│  │ captured │  │ identified│        │
│  └──────────┘  └──────────┘        │
│                                     │
│  ── By Language ───────────────── │  Language breakdown section
│  ┌─────────────────────────────┐    │
│  │ ████████████████░░░░░░░░░   │    │  Horizontal stacked bar
│  │ 🇺🇸 English      72% (34)   │    │  Per-language: % + count
│  │ 🇪🇸 Spanish      18% (8)    │    │  Sorted by usage
│  │ 🇫🇷 French       10% (5)    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ── Top Speakers ─────────────── │  Speaker leaderboard
│  ┌─────────────────────────────┐    │
│  │ 🔵 Alex          1h 12m     │    │  Speaker name + total time
│  │    ████████████████ (47%)    │    │  Progress bar
│  │ 🟠 Jordan        0h 42m     │    │
│  │    ██████████░░░░░ (27%)     │    │
│  │ 🟢 Sam           0h 24m     │    │
│  │    ██████░░░░░░░░ (16%)      │    │
│  │ 🟣 Others        0h 16m     │    │
│  │    ████░░░░░░░░░░ (10%)      │    │
│  └─────────────────────────────┘    │
│                                     │
│  ── Commands ─────────────────── │  Command usage section
│  ┌─────────────────────────────┐    │
│  │ 23 commands executed         │    │  Total executions
│  │ 91% success rate             │    │  Success percentage
│  │                              │    │
│  │ Top: "Start fasting" (12x)   │    │  Most-used command
│  │ Modules: Fast, Budget, Mood  │    │  Unique modules triggered
│  └─────────────────────────────┘    │
│                                     │
│  ── Favorites ───────────────── │  Quick access section
│  ┌─────────────────────────────┐    │
│  │ 7 favorited notes            │    │  Favorite count
│  │ Most tagged: #meeting (12)   │    │  Most common tag
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**Stat Card Design:**
- Hero stat: large accent-colored number (36px, `#EF4444`), subtitle in `textSecondary`
- Pair stats: side-by-side glass cards, number bold, label below
- Bar charts: horizontal stacked bars using speaker/language colors
- All values computed from DB aggregates, no external analytics

**Engine Functions Used:**
- `getTranscriptionStats(db)` for core stats (totalCount, totalDuration, avgDuration, byLanguage)
- `getSpeakers(db)` + aggregate speaker segment durations for speaker leaderboard
- `getCommands(db)` + `getCommandLog(db)` for command stats
- `getVoiceNotes(db)` for favorite count + tag analysis
- `formatDuration()` for all duration formatting
- `getSpeakerColor()` for speaker bar colors
- `getLanguageColor()` for language bar colors

**States:**

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton stat cards | Initial load |
| Empty | All zeros, "Start recording to see your stats" | No transcriptions |
| Success | Full dashboard with all sections populated | Data exists |
| Partial | Some sections populated, others show "No data yet" | e.g., no speakers, no commands |
| Error | "Failed to load stats" + retry | DB read fails |

---

### Settings Tab (`settings.tsx`)

**Purpose:** Module preferences and navigation hub to deeper screens (speakers, languages, stats). Keeps the tab bar focused on the 3 primary actions (Record, Notes, Commands) while settings provides access to configuration and secondary features.

**Layout:**
```
┌─────────────────────────────────────┐
│ ← MyVoice Settings                  │
├─────────────────────────────────────┤
│                                     │
│  ── Recording ──────────────────── │
│  Audio Quality      [High ▼]       │  Picker: Low / Medium / High
│  Auto-save silence  [2s   ▼]       │  Picker: Off / 2s / 5s / 10s
│  Show live transcript [●]          │  Toggle (on by default)
│  Haptic feedback      [●]          │  Toggle (on by default)
│                                     │
│  ── Detection ──────────────────── │
│  Speaker detection   [●]           │  Toggle (on by default)
│  Language detection  [●]           │  Toggle (on by default)
│  Command detection   [●]           │  Toggle (on by default)
│                                     │
│  ── Manage ─────────────────────── │
│  Language Profiles          [>]     │  -> languages.tsx (profile count badge)
│  Speaker Directory          [>]     │  -> speakers.tsx (speaker count badge)
│  Transcription Stats        [>]     │  -> stats.tsx
│                                     │
│  ── Data ───────────────────────── │
│  Export All Notes     [Export]      │  Export as .txt or .json
│  Clear All Data       [Clear]      │  Destructive, double confirmation
│                                     │
│  ── About ──────────────────────── │
│  Version              0.2.0        │
│  Tables               8            │
│  Schema Version       2            │
│                                     │
└─────────────────────────────────────┘
```

**Engine Functions Used:**
- `getSetting(db, key)` / `setSetting(db, key, value)` for all preferences
- `getSettings(db)` for loading all settings at once
- `getLanguageProfiles(db).length` for profile count badge
- `getSpeakers(db).length` for speaker count badge

---

### Supporting Stack Screens

#### Command Builder (`command/add.tsx`)

Step-by-step form for creating or editing a voice command:
1. **Phrase input:** Text field with microphone button (record a phrase to use as trigger)
2. **Action picker:** Dropdown grouped by module (e.g., Fast > Start Fast, Budget > Add Expense)
3. **Module target:** Auto-filled from action, or manual override
4. **Parameters:** Dynamic fields based on action type (e.g., `[amount]` shows number input)
5. **Priority:** Slider (0-10, higher = wins ties)
6. **Preview card:** Shows how the command will look in the list
7. **Test button:** Simulates matching without executing

#### Command Log (`command/log.tsx`)

Timeline of all command executions:
- Each entry: matched phrase, module icon, timestamp, success/fail badge
- Failed entries: expandable to show error message
- Filter by: All, Success only, Failures only
- Tap entry: shows full detail (confidence score, command ID, execution time)

#### Speaker Directory (`speakers.tsx`)

List of all identified speakers:
- Each card: colored dot + name + sample count + last seen date
- Tap: opens speaker/[id].tsx for editing name/color
- Add manually: create speaker without voice print (for labeling recorded segments after the fact)
- Merge speakers: select 2 speakers, merge into one (combines segments)

#### Speaker Profile (`speaker/[id].tsx`)

Edit a speaker's details:
- Name (editable)
- Color picker (10 preset colors from `SPEAKER_COLORS`)
- Sample count (read-only)
- Recent appearances: list of notes where this speaker was detected
- Delete speaker: reassigns their segments to "Unknown"
- Merge speakers: tap "Merge" button, select a second speaker from a picker, confirm. All segments from the second speaker are reassigned to the first. The second speaker record is deleted. Merge is NOT reversible (segments are reassigned in-place via `updateSegmentSpeaker()`). Confirmation dialog warns: "Merge [Speaker B] into [Speaker A]? This cannot be undone."

---

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can start a recording with one tap and see live waveform animation
- [ ] **AC-2:** Live transcript appears during recording with speaker color coding
- [ ] **AC-3:** User can pause and resume recording without losing data
- [ ] **AC-4:** After stopping, user can edit title and tags before saving as voice note
- [ ] **AC-5:** Voice notes list shows all notes with duration, speaker count, language, and preview text
- [ ] **AC-6:** Search bar filters notes by title, tags, and transcript keywords
- [ ] **AC-7:** Note detail shows full transcript with speaker-labeled segments
- [ ] **AC-8:** Audio playback bar allows scrubbing; tapping a segment seeks to that position
- [ ] **AC-9:** Speaker timeline view shows color-coded horizontal bar with per-speaker breakdown
- [ ] **AC-10:** Language view shows per-language breakdown with flag badges and percentages
- [ ] **AC-11:** Analysis card shows word count, reading time, keywords, and auto-summary
- [ ] **AC-12:** Command manager lists all commands with enable/disable toggles
- [ ] **AC-13:** Preset templates are browseable by module and installable with one tap
- [ ] **AC-14:** Command log shows execution history with success/fail indicators
- [ ] **AC-15:** Language profiles can be created with up to 5 languages from the supported list
- [ ] **AC-16:** Default language profile can be set and is used for new recordings
- [ ] **AC-17:** Stats dashboard shows total recordings, duration, language breakdown, and speaker leaderboard
- [ ] **AC-18:** Quick Note auto-saves after 2s silence with toast confirmation, without navigating away from Record tab
- [ ] **AC-19:** Two speakers can be merged from Speaker Profile screen, reassigning all segments irreversibly
- [ ] **AC-20:** Stats sections with no data (e.g., no speakers, no commands) show "No data yet" instead of empty/broken charts
- [ ] **AC-21:** If Speech API is unavailable, Record screen shows "Live transcription unavailable" but recording still works

### Technical Criteria
- [ ] **TC-1:** 4-tab navigator using expo-router Tabs with ModuleErrorBoundary wrapper
- [ ] **TC-2:** 8 hooks created for data fetching (useVoiceNotes, useVoiceNote, useTranscriptionStats, useSpeakers, useCommands, useCommandLog, useLanguageProfiles, useRecorder)
- [ ] **TC-3:** Audio recording uses expo-av with proper permission handling (request on first record)
- [ ] **TC-4:** All screens use Cool Obsidian theme tokens (background, surface, text, glass, glassBorder)
- [ ] **TC-5:** Swipe actions on notes list use react-native-gesture-handler with haptic feedback
- [ ] **TC-6:** Waveform visualization uses react-native-reanimated for smooth 60fps animation
- [ ] **TC-7:** Pagination on notes list and command log (50 items per page, infinite scroll)
- [ ] **TC-8:** Module accent color `#EF4444` used consistently for active states, badges, and CTAs
- [ ] **TC-9:** All CRUD operations use existing `@mylife/voice` functions (no raw SQL in UI layer)
- [ ] **TC-10:** Settings persisted via `setSetting()` / `getSetting()` with proper defaults

### Negative Criteria
- [ ] **NC-1:** Recording must NOT require network access (all on-device)
- [ ] **NC-2:** Audio files must NOT be stored externally or uploaded anywhere
- [ ] **NC-3:** Transcription text must NOT be sent to cloud services
- [ ] **NC-4:** Command execution must NOT block the recording pipeline
- [ ] **NC-5:** Deleting a voice note must NOT delete the underlying transcription (they are separate entities, transcription may be reused)
- [ ] **NC-6:** Stats must NOT use any third-party analytics library

## Accessibility Specification

### VoiceOver Announcements (iOS)
Recording state transitions must be announced via `AccessibilityInfo.announceForAccessibility()`:
- Idle -> Recording: "Recording started"
- Recording -> Paused: "Recording paused"
- Paused -> Recording: "Recording resumed"
- Recording -> Processing: "Processing transcription"
- Processing -> Complete: "Transcription complete. [word count] words captured."
- Save: "Voice note saved: [title]"
- Quick Note auto-save: "Quick note saved"

### Accessible Labels
| Element | Label | Hint |
|---------|-------|------|
| Record button (idle) | "Record" | "Double tap to start recording" |
| Record button (recording) | "Stop recording" | "Double tap to stop" |
| Pause button | "Pause recording" | "Double tap to pause" |
| Resume button | "Resume recording" | "Double tap to resume" |
| Save button | "Save voice note" | "Double tap to save with current title" |
| Favorite toggle | "Favorite" / "Unfavorite" | "Double tap to toggle favorite" |
| Command toggle | "[phrase], enabled" / "[phrase], disabled" | "Double tap to toggle" |
| Speaker segment | "[speaker name], [timestamp range]: [text preview]" | "Double tap to seek audio" |
| Language segment | "[language name], [percentage]: [text preview]" | "Double tap to seek audio" |

### Touch Targets
All interactive elements must have minimum 44x44pt touch target (iOS HIG). Specific elements:
- Record/pause/stop buttons: 64x64pt (primary action, generous target)
- Filter chips: 44pt height, min 80pt width
- Note cards: full-width, min 80pt height
- Command toggles: 44x44pt
- Swipe action zones: full card height
- Tab bar icons: 44x44pt (handled by expo-router Tabs)

### Reduced Motion
When `AccessibilityInfo.isReduceMotionEnabled()` is true:
- Waveform: replace animated bars with a static "Recording" text indicator
- Recording pulse: replace pulsing animation with solid red background
- State transitions: replace spring/timing animations with instant crossfades
- Speaker timeline: static bar (no playback animation)

### Color Independence
All information conveyed by color (speaker dots, language badges, command status) must also have a text label. Speaker segments show both the color dot AND the speaker name. Language segments show both the flag AND the language name. Command status shows both the toggle color AND "enabled"/"disabled" text.

---

## QA Verification Script

### Record Tab
1. Open app, navigate to MyVoice
2. Verify Record tab is the default landing screen (Idle state)
3. Tap record button, verify microphone permission prompt appears (first time)
4. Grant permission, verify waveform animation starts (Recording state)
5. Speak clearly for 10+ seconds, verify live transcript appears
6. Tap pause, verify waveform freezes and "(paused)" label shows (Paused state)
7. Tap resume, verify recording continues
8. Tap stop, verify processing spinner appears briefly (Processing state)
9. Verify Complete state: title field (editable), tag field, full transcript, Save button
10. Edit title to "Test Recording", add tag "#test", tap Save
11. Verify navigation to Notes tab with new note at top

### Notes List
12. Verify "Test Recording" card shows: duration, language, preview text, "#test" tag
13. Swipe right on card, verify favorite toggle (amber star appears)
14. Tap search icon, type "test", verify filtered results
15. Tap filter chip "Favorites", verify only favorited notes shown
16. Tap card, verify navigation to Note Detail

### Note Detail
17. Verify title "Test Recording", date, "#test" tag displayed
18. Verify audio playback bar with play/pause and scrubber
19. Tap play, verify audio plays
20. Tap a transcript segment, verify audio seeks to that timestamp (AC-8)
21. Switch to Speakers view via segment control
22. If single speaker: verify "1 speaker" breakdown shown
23. Switch to Languages view, verify language badge and percentage
24. Verify Analysis card: word count, reading time, keywords, summary (AC-11)
25. Tap overflow menu > Edit title, change to "Updated Test", verify saved
26. Tap "Copy Text", verify clipboard contains transcript

### Commands
27. Navigate to Commands tab
28. Verify empty state shows templates CTA
29. Tap "Browse Templates", verify 10 presets grouped by module (AC-13)
30. Tap "Add" on "Start fasting" template, verify it appears in active list
31. Tap "+" to create custom command, verify builder screen
32. Enter phrase "test command", action "create_note", module "Notes"
33. Save, verify command appears in list
34. Toggle command off, verify visual state changes to disabled (AC-12)
35. Toggle back on
36. Tap command card, verify edit mode opens
37. Navigate to command log via history icon, verify empty or shows recent executions

### Language Profiles
38. Navigate to Settings > Language Profiles
39. Verify empty state with "Create Profile" CTA
40. Tap "+", enter name "Test Profile", select English (US) and Spanish (US)
41. Check "Set as default", save
42. Verify profile appears with default star badge (AC-16)
43. Create second profile "Work" with English (US) only
44. Tap "Set Default" on Work profile, verify default switches (AC-15)
45. Swipe to delete Test Profile, verify confirmation and removal

### Stats
46. Navigate to Settings > Transcription Stats
47. Verify hero stat shows "1" total recording (or current count)
48. Verify duration, word count displayed correctly
49. Verify language breakdown shows detected language(s)
50. Verify command stats section (if commands were executed)

### Settings
51. Navigate to Settings tab
52. Toggle "Speaker detection" off, verify setting persisted
53. Toggle back on
54. Verify Language Profiles shows count badge
55. Verify Speaker Directory shows count badge
56. Tap Export All Notes, verify export options

### Edge Cases
57. Deny microphone permission, verify error state with settings link (Record tab)
58. Record with no speech (silence only), verify "No transcription detected" handling
59. Create 50+ notes, verify pagination loads on scroll
60. Delete a note from the detail screen, verify notes list updates

---

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- already run for text, speaker, commands, language engines (25+ tests)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- voice has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

---

## Navigation Update

The current `VOICE_MODULE.navigation` in `definition.ts` defines 3 tabs (dictate, history, settings) and 1 stack screen. This spec expands to:

**Updated tabs (4):**

| Tab Key | Label | Icon |
|---------|-------|------|
| `record` | Record | `mic` |
| `notes` | Notes | `file-text` |
| `commands` | Commands | `zap` |
| `settings` | Settings | `settings` |

**Updated stack screens (8):**

| Screen Name | Title | Route |
|-------------|-------|-------|
| `note-detail` | Note | `note/[id]` |
| `command-add` | New Command | `command/add` |
| `command-log` | Command History | `command/log` |
| `speakers` | Speakers | `speakers` |
| `speaker-detail` | Speaker | `speaker/[id]` |
| `languages` | Language Profiles | `languages` |
| `language-add` | New Profile | `language/add` |
| `stats` | Stats | `stats` |

The `definition.ts` navigation object should be updated when building this spec:

```typescript
navigation: {
  tabs: [
    { key: 'record', label: 'Record', icon: 'mic' },
    { key: 'notes', label: 'Notes', icon: 'file-text' },
    { key: 'commands', label: 'Commands', icon: 'zap' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
  ],
  screens: [
    { name: 'note-detail', title: 'Note' },
    { name: 'command-add', title: 'New Command' },
    { name: 'command-log', title: 'Command History' },
    { name: 'speakers', title: 'Speakers' },
    { name: 'speaker-detail', title: 'Speaker' },
    { name: 'languages', title: 'Language Profiles' },
    { name: 'language-add', title: 'New Profile' },
    { name: 'stats', title: 'Stats' },
  ],
},
```

---

## Handoff State

### Before This Work
Voice module has a complete backend (50+ functions, 8 tables, 4 engines, 25+ tests) but the mobile UI is a single placeholder screen. Users cannot access speaker diarization, voice commands, language profiles, or transcription stats from the app.

### After This Work
Voice module has a full 12-screen mobile UI organized into 4 tabs: Record (live dictation with waveform, speaker labels, language detection), Notes (searchable/filterable library), Commands (cross-module voice control), and Settings (preferences + links to speakers, languages, stats). Every backend capability is surfaced through an intuitive, Cool Obsidian-themed interface.

### Files to Create

```
apps/mobile/app/(voice)/
  _layout.tsx              -- Tabs + stack navigator
  index.tsx                -- Record tab (live recording)
  notes.tsx                -- Notes list tab
  commands.tsx             -- Command manager tab
  settings.tsx             -- Settings tab
  note/[id].tsx            -- Note detail (speaker timeline, languages, analysis)
  command/add.tsx          -- Command builder / editor
  command/log.tsx          -- Command execution history
  speakers.tsx             -- Speaker directory
  speaker/[id].tsx         -- Speaker profile editor
  languages.tsx            -- Language profile management
  language/add.tsx         -- Create/edit language profile
  stats.tsx                -- Transcription statistics dashboard

apps/mobile/hooks/
  useVoiceNotes.ts         -- Paginated voice notes with search/filter
  useVoiceNote.ts          -- Single note with linked data
  useTranscriptionStats.ts -- Aggregate stats
  useSpeakers.ts           -- Speaker profiles
  useCommands.ts           -- Commands with filter
  useCommandLog.ts         -- Execution history
  useLanguageProfiles.ts   -- Language profiles with default
  useRecorder.ts           -- Recording state machine
```

### Files to Modify

```
modules/voice/src/definition.ts    -- Update navigation (4 tabs + 8 stack screens)
modules/voice/CLAUDE.md            -- Update exports, screen list, hook inventory
```

### Known Limitations
- Audio transcription depends on platform speech recognition APIs (expo-speech or native). Quality varies by device and OS version. No custom Whisper model in V1.
- Speaker diarization in V1 is label-based (automatic "Speaker 1/2/3" assignment). True voice print matching (voicePrintHash) is schema-ready but the matching algorithm is not yet implemented.
- Command detection during recording requires the command mode toggle to be active. There is no "always listening" wake word in V1.
- Waveform visualization is amplitude-based (simple bar chart), not a true spectrogram. Spectrogram view could be a V2 enhancement.
- Export formats limited to plain text and JSON. PDF export with speaker-colored formatting could be a future feature.

### Context for Next Agent
- All 4 engines are fully implemented and tested. The UI layer should only call exported functions from `@mylife/voice`, never write raw SQL.
- The `useRecorder` hook is the most complex piece: it manages a state machine (idle/recording/paused/processing/complete) and coordinates expo-av recording with live speech recognition callbacks.
- Speaker segments and language segments are stored per-transcription, not per-note. A note links to a transcription via `transcriptionId`. Always fetch segments via the transcription ID, not the note ID.
- The `PRESET_TEMPLATES` array in `engine/commands.ts` is the source of truth for preset commands. These are static templates, not DB records. They get copied into `vc_commands` when the user installs them.
- Settings use a simple key/value store (`vc_settings`). Define setting keys as constants (e.g., `SETTING_AUDIO_QUALITY = 'audio_quality'`) to avoid magic strings.
- **VoiceProvider context (from eng review):** Create `VoiceContext.tsx` following the RSVP `RsvpProvider` pattern. Wrap the tab navigator in `_layout.tsx`. Recording state (`useRecorder`) lives in this context so all tabs can access recording status. Other data hooks (`useVoiceNotes`, `useCommands`, etc.) remain standalone.
- **Command execution deferred (from eng review):** The Commands tab is a management UI only. Actual cross-module command execution requires a `quickActions` dispatch mechanism in `@mylife/module-registry` that does not exist yet. Build the tab to create/edit/toggle/delete commands and browse presets. Mark execution as "wired when quickActions API ships."
- **Critical edge cases (from eng review):** Wrap command toggle in try/catch with error toast. Add optimistic locking to speaker merge. Prevent deletion of default language profile (force user to set new default first). These prevent silent failures.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | -- | -- |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | -- | -- |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 3 issues (cross-module routing, VoiceContext, journal reuse), 3 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 7/10 -> 9/10, 5 decisions (motion specs, user journey, accessibility, touch targets, Reduced Motion) |

**UNRESOLVED:** 0
**VERDICT:** ENG + DESIGN CLEARED -- ready to implement.
