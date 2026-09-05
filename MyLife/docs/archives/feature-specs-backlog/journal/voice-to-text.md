# Feature Spec: Voice-to-Text Entries

## Metadata
- **Module:** journal
- **Priority Score:** 34 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 4 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** JR-001 (Rich Text Editor -- implemented, `body` column stores markdown text)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Day One ($34.99/yr) has voice-to-text as a premium feature that drives subscriptions. Many users journal during commutes, walks, or before bed when typing is inconvenient. Voice journaling captures raw emotional expression that typing filters out -- the pauses, the searching for words, the sighs. On-device speech recognition is now excellent on iOS (Speech framework) and Android (SpeechRecognizer), making this achievable with zero data transmission. The journal module already supports text entries and image URIs; adding voice-to-text extends the input modality while keeping everything local.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Day One | Yes | $34.99/yr | Voice memo with cloud transcription (audio sent to Apple servers). Premium feature. |
| Daylio | No | N/A | Micro-diary format, no voice input. |
| Apple Journal | Partial | Free | Uses iOS dictation (system-level, not in-app recording). No audio attachment. |
| Reflectly | No | N/A | Text-only input with AI prompts. |

### Target User
Commuters, walkers, and people who process thoughts verbally. Also users with accessibility needs who find typing difficult. These users currently use the iOS dictation keyboard (which sends audio to Apple) or open Voice Memos + a separate journal app. MyJournal can offer voice-to-text with on-device processing, keeping audio data entirely local.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/voice/                      -- NEW: voice recording + transcription
modules/journal/src/voice/types.ts              -- VoiceRecording, TranscriptionResult types
modules/journal/src/voice/recorder.ts           -- Recording management, audio file handling
modules/journal/src/voice/transcriber.ts        -- On-device speech recognition interface
modules/journal/src/voice/index.ts              -- Barrel export
modules/journal/src/voice/__tests__/            -- Tests
apps/mobile/app/(journal)/components/VoiceButton.tsx     -- Voice recording toolbar button
apps/mobile/app/(journal)/components/AudioPlayer.tsx     -- Inline audio player for entries
apps/web/app/journal/components/VoiceButton.tsx          -- Web voice button (limited)
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Today tab -> Entry Editor
            └── Formatting toolbar
                 └── Microphone button ← YOU ARE HERE
```

### Data Model

New columns on `jn_entries` and a new table in migration V3:

```sql
-- Add voice attachment columns to entries
ALTER TABLE jn_entries ADD COLUMN audio_path TEXT;
ALTER TABLE jn_entries ADD COLUMN audio_duration_ms INTEGER;
ALTER TABLE jn_entries ADD COLUMN transcription_source TEXT
  CHECK (transcription_source IN ('voice', 'manual'));

-- Voice recordings table for multi-recording entries
CREATE TABLE IF NOT EXISTS jn_voice_recordings (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  transcription TEXT,
  transcription_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (transcription_status IN ('pending', 'transcribing', 'complete', 'failed')),
  keep_audio INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS jn_voice_recordings_entry_idx ON jn_voice_recordings(entry_id);
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD (`createJournalEntry`, `updateJournalEntry`)
- **External:** `expo-av` (audio recording), `expo-speech` or native Speech framework (transcription), `expo-file-system` (audio file storage)
- **Cross-Module:** Voice module in MyVoice module could share audio infrastructure; journal voice recordings could feed into `crossModule.getSearchableContent()` via transcription text

## Functional Requirements

### User Stories
1. As a commuter, I want to dictate a journal entry while walking so that I can capture my thoughts without looking at my phone.
2. As a voice journaler, I want to keep the original audio recording alongside the transcription so that I can listen back to the emotion in my voice.
3. As a privacy-conscious user, I want voice transcription processed entirely on my device so that my spoken journal entries are never sent to any server.

### Behavior Specification

1. User opens the entry editor (Today tab or New Entry).
2. Formatting toolbar shows a microphone button (after existing buttons).
3. User taps the microphone button.
4. First-time: microphone permission dialog. If denied, show toast with Settings link.
5. Permission granted: toolbar transforms to recording interface -- pulsing red dot, elapsed timer (MM:SS), waveform visualization, "Stop" button.
6. User speaks their journal entry.
7. User taps "Stop" (or recording auto-stops at 10 minutes).
8. Transcription begins: spinner with "Transcribing..." in the content area.
9. On-device speech recognition processes the audio:
   - iOS: Speech framework with `SFSpeechRecognizer`, on-device mode
   - Android: SpeechRecognizer with `EXTRA_PREFER_OFFLINE`
10. Transcription completes: text is inserted at the cursor position in the entry body.
11. Toast: "Transcription complete. You can edit the text."
12. If "Keep audio" is enabled (default: on): audio file saved to `jn_voice/[entry_id]/[recording_id].aac`. Inline audio player appears below the text.
13. If "Keep audio" is disabled: temporary audio file deleted after transcription.
14. User can record multiple clips within a single entry. Each appends text.
15. Audio player shows: play/pause button, waveform, duration. Tap "x" to remove audio (transcription text stays).

### Edge Cases

- **Microphone permission denied:** Toast "Microphone access needed for voice entries. Enable in Settings." with "Open Settings" button.
- **Speech recognition unavailable:** Toast "Voice-to-text is not available on this device. You can still record audio without transcription."
- **No speech detected:** Insert "[No speech detected]" placeholder. Toast explains.
- **Transcription partially fails:** Insert partial text + "[transcription incomplete]" marker.
- **Recording exceeds 10 minutes:** Auto-stop with toast "Maximum recording length reached (10 minutes)."
- **Audio exceeds 50MB:** Reject with size error (unlikely at AAC 64kbps -- 10 min is ~4.7MB).
- **Recording interrupted by phone call:** Pause recording, resume when call ends.
- **Storage full:** Toast "Not enough storage space for this recording."
- **Web platform:** Use Web Speech API (SpeechRecognition) where available. Show "Voice-to-text requires a supported browser" otherwise.
- **Multiple recordings in one entry:** Each recording appends a new paragraph with optional audio player.
- **Entry deleted:** CASCADE deletes voice recordings and audio files.
- **Long press microphone:** Shows options "Record and Transcribe" (default) or "Record Audio Only" (skips transcription).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Microphone button appears in the entry editor formatting toolbar.
- [ ] **AC-2:** Tapping the button requests microphone permission on first use.
- [ ] **AC-3:** Recording interface shows pulsing red dot, elapsed timer, waveform, and "Stop" button.
- [ ] **AC-4:** After stopping, "Transcribing..." spinner appears while on-device recognition runs.
- [ ] **AC-5:** Transcribed text is inserted at the cursor position in the entry body.
- [ ] **AC-6:** Inline audio player appears below the transcribed text (if "Keep audio" is enabled).
- [ ] **AC-7:** Audio player has play/pause, waveform, duration display, and "x" remove button.
- [ ] **AC-8:** Removing audio keeps the transcription text in the entry.
- [ ] **AC-9:** Multiple recordings in one entry append separate paragraphs.
- [ ] **AC-10:** First-time privacy notice explains on-device processing.
- [ ] **AC-11:** Recording auto-stops at 10 minutes with a toast.
- [ ] **AC-12:** Long-press offers "Record Audio Only" option (no transcription).

### Technical Criteria
- [ ] **TC-1:** Migration V3 adds `audio_path`, `audio_duration_ms`, `transcription_source` to `jn_entries` and creates `jn_voice_recordings` table.
- [ ] **TC-2:** Audio recorded as AAC, 64kbps, mono, 44100Hz sample rate.
- [ ] **TC-3:** Speech recognition uses on-device mode exclusively (iOS `requiresOnDeviceRecognition`, Android `EXTRA_PREFER_OFFLINE`).
- [ ] **TC-4:** Audio files stored at `[app-data-dir]/jn_voice/[entry_id]/[recording_id].aac`.
- [ ] **TC-5:** Transcription text appended to `body` column using existing `updateJournalEntry`.
- [ ] **TC-6:** `jn_voice_recordings` tracks each recording with duration, size, transcription status, and file path.
- [ ] **TC-7:** Deleting an entry cascades to voice recordings and deletes audio files from disk.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Audio data must NEVER be sent to any external transcription service. All processing is on-device.
- [ ] **NC-2:** Voice recordings must NEVER be accessible to other modules without explicit user action.
- [ ] **NC-3:** Deleting the audio attachment must NOT delete the transcribed text.
- [ ] **NC-4:** Recording must NOT block the entry editor. User can type in other parts while audio processes.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Microphone button: icon in `#A78BFA` (journal accent), positioned in formatting toolbar
- Recording interface: toolbar transforms -- red pulsing dot (1s cycle), timer in `#F0F0F5`, waveform in `#A78BFA`
- "Stop" button: red circle, 44px
- Transcribing state: spinner in content area with "Transcribing..." text in textSecondary
- Audio player: glass card (`rgba(255,255,255,0.04)`), play/pause circle in accent, waveform, duration text, "x" remove
- First-use notice: glass modal with lock icon, privacy text, "Got it" button
- Module accent: `#A78BFA`

### Web (Next.js)

- Same toolbar button (microphone icon)
- Uses Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`)
- No audio file recording on web (transcription only via Web Speech API streaming)
- Unsupported browsers: microphone button disabled with tooltip

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Ready | Microphone icon in toolbar | Entry editor open |
| Permission Needed | System permission dialog | First tap on microphone |
| Permission Denied | Toast with Settings link | User denies permission |
| Recording | Red dot, timer, waveform, Stop button | Recording active |
| Transcribing | Spinner + "Transcribing..." | Recording stopped, processing |
| Complete | Transcribed text + optional audio player | Transcription done |
| Failed | "[No speech detected]" or "[transcription incomplete]" | Recognition returned empty/partial |
| Unavailable | Grayed microphone with tooltip | Device lacks speech recognition |

## Test Requirements

### Unit Tests
- [ ] `buildRecordingPath`: entry_id + recording_id -> correct file path
- [ ] `insertTranscription`: transcribed text appended to body at cursor position
- [ ] `handleEmptyTranscription`: empty result -> "[No speech detected]" placeholder
- [ ] `handlePartialTranscription`: partial result + failure -> text + "[transcription incomplete]"
- [ ] `removeAudioKeepText`: delete recording -> audio file removed, body text preserved
- [ ] `multipleRecordings`: 3 recordings -> 3 voice_recording rows, text appended 3 times
- [ ] `autoStopAt10Min`: recording duration >= 600000ms -> auto-stop triggered
- [ ] `cascadeDeleteRecordings`: delete entry -> voice recordings and files removed
- [ ] `audioOnlyMode`: keep_audio = 1, transcription skipped -> audio saved, no text inserted

### Integration Tests
- [ ] Full flow: record audio -> transcribe -> text appears in entry -> save entry -> re-open -> text and audio player visible
- [ ] Delete flow: record audio with "Keep audio" -> delete audio from entry -> transcription text remains

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Today tab
3. Verify: microphone button visible in formatting toolbar -- corresponds to AC-1
4. Tap microphone button
5. Verify: permission dialog appears (first use) -- corresponds to AC-2
6. Grant permission
7. Verify: first-use privacy notice appears -- corresponds to AC-10
8. Dismiss notice
9. Verify: recording interface with red dot, timer, waveform -- corresponds to AC-3
10. Speak for 10 seconds, tap "Stop"
11. Verify: "Transcribing..." spinner appears -- corresponds to AC-4
12. Wait for transcription (2-5 seconds)
13. Verify: transcribed text appears in the entry body -- corresponds to AC-5
14. Verify: audio player appears below the text -- corresponds to AC-6
15. Tap play on audio player
16. Verify: audio plays back -- corresponds to AC-7
17. Tap "x" on audio player
18. Verify: audio removed, transcription text remains -- corresponds to AC-8, NC-3
19. Record a second clip in the same entry
20. Verify: new text appended as new paragraph -- corresponds to AC-9
21. Let a recording run for 10 minutes
22. Verify: auto-stops with toast -- corresponds to AC-11
23. Long-press microphone button
24. Verify: "Record Audio Only" option shown -- corresponds to AC-12
25. Save the entry, close and re-open
26. Verify: all transcribed text persisted

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to journal entry editor, test recording flow

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal entries support text body (markdown) and image URI attachments. No voice input or audio capability exists.

### After This Work
A `voice/` directory provides recording, file management, and on-device transcription. Entry editor has a microphone button for voice-to-text. Audio recordings are optionally preserved as attachments. Migration V3 adds audio columns and voice recordings table.

### Files Changed
- `modules/journal/src/db/schema.ts` -- add ALTER TABLE columns, CREATE_VOICE_RECORDINGS, indexes
- `modules/journal/src/definition.ts` -- add JOURNAL_MIGRATION_V3, increment schemaVersion to 3
- `modules/journal/src/voice/types.ts` -- VoiceRecording, TranscriptionResult, RecordingConfig types
- `modules/journal/src/voice/recorder.ts` -- startRecording, stopRecording, deleteRecording
- `modules/journal/src/voice/transcriber.ts` -- transcribeAudio (platform-specific on-device recognition)
- `modules/journal/src/voice/index.ts` -- barrel export
- `modules/journal/src/voice/__tests__/recorder.test.ts` -- 9+ unit tests
- `modules/journal/src/db/crud.ts` -- add voice recording CRUD functions
- `modules/journal/src/types.ts` -- add VoiceRecording Zod schema
- `modules/journal/src/index.ts` -- re-export voice module
- `apps/mobile/app/(journal)/components/VoiceButton.tsx` -- recording toolbar button
- `apps/mobile/app/(journal)/components/AudioPlayer.tsx` -- inline audio player
- `apps/web/app/journal/components/VoiceButton.tsx` -- web voice button (Web Speech API)

### Known Limitations
- On-device transcription quality varies by device hardware and language model availability.
- Web Speech API has limited browser support (Chrome/Edge only, not Firefox/Safari).
- No real-time streaming transcription (transcription runs after recording stops).
- Maximum 10 minutes per recording. Users can chain multiple recordings.

### Context for Next Agent
- The `jn_entries` table uses `body` TEXT column for entry content. Transcribed text is appended to `body` via `updateJournalEntry`.
- Audio files go in `jn_voice/[entry_id]/[recording_id].aac`, NOT in the SQLite database.
- For iOS: use `AVAudioRecorder` for recording and `SFSpeechRecognizer` with `supportsOnDeviceRecognition` for transcription.
- For Android: use `expo-av` Audio.Recording for recording and Android `SpeechRecognizer` with `EXTRA_PREFER_OFFLINE`.
- The `keep_audio` flag on `jn_voice_recordings` controls whether the file persists after transcription.
- Entry deletion cascades to `jn_voice_recordings` rows, but audio files on disk must be explicitly cleaned up (add cleanup logic to the delete path).
