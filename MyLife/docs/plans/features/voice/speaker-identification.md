# Feature Spec: Speaker Identification

## Metadata
- **Module:** voice
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [4] x3 + Complexity [1] x2 + CrossModule [2] x1 + PaidUser [4] x1
- **Sprint:** 3-4
- **Estimated CC Time:** 4-6 hours
- **Depends On:** none (builds on existing vc_transcriptions table)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Speaker identification (diarization) lets users distinguish who said what in multi-person recordings. This is critical for meeting notes, interviews, and group conversations where a raw transcript blending all speakers together loses most of its value. Otter.ai's speaker ID is the #1 reason users pay $100/yr, and Notta charges even more for the same capability.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Otter.ai | Yes | Yes ($100/yr Pro) | Automatic diarization with speaker labels, learns voices over time, allows manual corrections |
| Notta | Yes | Yes ($100-180/yr) | Real-time speaker separation, team-based voice profiles, up to 10 speakers |
| Apple Voice Memos | No | N/A | No speaker separation |
| Google Recorder | Partial | No | Basic speaker labels in transcription, no training |

### Target User
Anyone who records meetings, interviews, lectures, or group conversations and needs to know who said what. Primary migration path: Otter.ai users paying $100/yr who want privacy-first speaker ID without cloud processing. Secondary: podcast listeners/creators doing interview transcriptions.

## Technical Context

### Where This Lives in MyLife

```
modules/voice/src/db/schema.ts       -- New table DDL (vc_speakers, vc_speaker_segments)
modules/voice/src/db/crud.ts         -- New CRUD operations for speakers and segments
modules/voice/src/types.ts           -- New Zod schemas (Speaker, SpeakerSegment)
modules/voice/src/engine/speaker.ts  -- Speaker matching and diarization engine
modules/voice/src/definition.ts      -- Migration v2
modules/voice/src/index.ts           -- Re-export new APIs
apps/mobile/app/(voice)/             -- Speaker management screen, diarized transcript view
apps/web/app/voice/                  -- Web equivalents
```

### Wireframe Position

```
Hub Dashboard
  └── MyVoice card
       └── History tab
            └── Transcription detail
                 └── Speaker Timeline view ← NEW
       └── Settings tab
            └── Manage Speakers ← NEW
```

### Data Model

```sql
-- New table: speaker profiles
CREATE TABLE IF NOT EXISTS vc_speakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  voice_print_hash TEXT,
  sample_count INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#EF4444',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: speaker-attributed segments within a transcription
CREATE TABLE IF NOT EXISTS vc_speaker_segments (
  id TEXT PRIMARY KEY,
  transcription_id TEXT NOT NULL REFERENCES vc_transcriptions(id) ON DELETE CASCADE,
  speaker_id TEXT REFERENCES vc_speakers(id) ON DELETE SET NULL,
  speaker_label TEXT NOT NULL DEFAULT 'Speaker 1',
  start_seconds REAL NOT NULL,
  end_seconds REAL NOT NULL,
  text TEXT NOT NULL,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS vc_speakers_name_idx ON vc_speakers(name);
CREATE INDEX IF NOT EXISTS vc_speaker_segments_transcription_idx ON vc_speaker_segments(transcription_id);
CREATE INDEX IF NOT EXISTS vc_speaker_segments_speaker_idx ON vc_speaker_segments(speaker_id);
CREATE INDEX IF NOT EXISTS vc_speaker_segments_time_idx ON vc_speaker_segments(transcription_id, start_seconds);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/module-registry` (ModuleDefinition migration system)
- **External:** On-device speech recognition APIs (expo-speech for basic features; platform-native APIs for diarization -- Apple Speech Framework on iOS, Android SpeechRecognizer). No cloud APIs required.
- **Cross-Module:** Journal module could import speaker-labeled transcriptions as structured entries. Mood module could correlate speaking patterns with mood tracking.

## Functional Requirements

### User Stories
1. As a user recording a meeting, I want the transcript to show who said what so that I can review the discussion by speaker.
2. As a user who records frequently, I want to save speaker profiles so that the app recognizes returning speakers automatically.
3. As a user reviewing a transcript, I want to manually correct speaker labels when auto-detection is wrong.
4. As a user, I want to see a color-coded timeline showing when each speaker was talking so that I can quickly scan the conversation.

### Behavior Specification

**Recording with speaker detection:**
1. User taps Record on the Dictate tab
2. System begins audio capture and on-device diarization
3. During recording, live transcript shows speaker change indicators (colored dots)
4. User taps Stop
5. System finalizes diarization, splits transcript into speaker segments
6. Transcription detail shows speaker-labeled segments with timestamps

**Managing speaker profiles:**
1. User navigates to Settings > Manage Speakers
2. User sees list of known speakers (name, sample count, color)
3. User taps "Add Speaker" and provides a name + optional voice sample
4. System creates a speaker profile with a voice print hash from the sample
5. User can edit name, color, or delete a speaker profile

**Correcting speaker labels:**
1. User opens a transcription with diarization
2. User long-presses a segment
3. Context menu shows: "Change Speaker" with list of known speakers + "New Speaker"
4. User selects correct speaker
5. System updates the segment's speaker_id and optionally improves the voice print

**Speaker timeline view:**
1. User opens transcription detail
2. Below the text transcript, a horizontal timeline bar shows colored blocks per speaker
3. Tapping a block scrolls the transcript to that segment
4. Timeline is proportional to duration

### Edge Cases
- Recording with only one speaker: system assigns all segments to "Speaker 1", no timeline shown
- Speaker not in profile database: assigned auto-label ("Speaker 1", "Speaker 2") with option to save as new profile
- Very short segments (<1 second): merged with adjacent segment from same speaker
- Overlapping speech: attributed to the dominant speaker with lower confidence score
- Audio quality too poor for diarization: system falls back to single-speaker mode with a notice
- Recording interrupted (app backgrounded, call): segments before/after gap are treated as separate sections
- Module disabled mid-recording: recording stops gracefully, partial diarization is saved
- Speaker profile deleted: existing segments retain the speaker_label text but speaker_id becomes NULL
- Maximum speakers: cap at 10 speakers per transcription (UI shows warning at 8+)
- Empty voice sample: speaker created without voice_print_hash, relies on manual labeling only

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Recording a conversation with 2+ speakers produces a transcript with distinct speaker labels
- [ ] **AC-2:** Each speaker segment displays the speaker name, color indicator, and timestamp
- [ ] **AC-3:** Speaker timeline bar appears below the transcript with proportional colored blocks
- [ ] **AC-4:** Tapping a timeline block scrolls to the corresponding segment
- [ ] **AC-5:** Long-pressing a segment opens a speaker correction menu
- [ ] **AC-6:** Changing a segment's speaker updates immediately in both transcript and timeline
- [ ] **AC-7:** Settings > Manage Speakers shows all saved profiles with name, color, and sample count
- [ ] **AC-8:** Adding a new speaker profile works with name-only (no voice sample required)
- [ ] **AC-9:** Deleting a speaker profile preserves existing segment text but removes the link
- [ ] **AC-10:** Single-speaker recordings show a simple transcript without speaker UI clutter

### Technical Criteria
- [ ] **TC-1:** vc_speakers and vc_speaker_segments tables are created by migration v2
- [ ] **TC-2:** Speaker segments are persisted with correct transcription_id foreign key
- [ ] **TC-3:** Deleting a transcription cascades to delete all its speaker segments
- [ ] **TC-4:** Deleting a speaker sets speaker_id to NULL on related segments (ON DELETE SET NULL)
- [ ] **TC-5:** Speaker segments have non-overlapping time ranges within a transcription
- [ ] **TC-6:** Stats query includes speaker breakdown (segments per speaker per transcription)
- [ ] **TC-7:** All CRUD operations work with the existing DatabaseAdapter pattern
- [ ] **TC-8:** Zod schemas validate speaker and segment data at boundaries

### Negative Criteria
- [ ] **NC-1:** Speaker voice data must NOT leave the device (no cloud processing)
- [ ] **NC-2:** Diarization must NOT block the recording (process async after capture or in real-time without lag)
- [ ] **NC-3:** Speaker identification must NOT affect existing single-speaker transcription workflows

## UI Specification

### Mobile (Expo)

**Transcription Detail (diarized):**
- Background: `#0A0A0F` (background token)
- Speaker segments in glass cards (`rgba(255,255,255,0.04)` with `rgba(255,255,255,0.10)` border)
- Each segment: left color bar (speaker color), speaker name in `textSecondary`, timestamp right-aligned, text in `text` token
- Module accent: `#EF4444`
- Timeline bar: 48px height, horizontal, full-width, each speaker block uses their assigned color

**Manage Speakers screen:**
- List of speaker cards with avatar circle (colored, initial letter), name, "X samples" subtitle
- "Add Speaker" button at bottom with `+` icon
- Swipe-to-delete on each card with danger confirmation

### Web (Next.js)

- Same tokens via CSS variables
- Sidebar navigation: accessible via `/voice/settings/speakers` route
- Transcription detail: two-column layout on wide screens (transcript left, timeline right)
- Speaker management: table-style list with inline edit for name/color

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards for segments | Opening diarized transcription |
| Empty | "No speakers identified" + explanation | Transcription processed without diarization |
| Error | "Speaker analysis failed" + retry button | Diarization engine error |
| Success | Color-coded speaker segments + timeline | Normal diarized result |
| Partial | Some segments labeled, others "Unknown Speaker" | Low-confidence diarization |

## Test Requirements

### Unit Tests
- [ ] `createSpeaker`: creates with name + color, returns Speaker object
- [ ] `createSpeaker`: handles missing voice_print_hash (nullable)
- [ ] `getSpeaker`: returns null for non-existent ID
- [ ] `updateSpeaker`: updates name, color, increments sample_count
- [ ] `deleteSpeaker`: removes speaker, segments retain speaker_label
- [ ] `createSpeakerSegment`: validates start_seconds < end_seconds
- [ ] `createSpeakerSegment`: links to transcription and speaker correctly
- [ ] `getSpeakerSegments`: returns segments ordered by start_seconds
- [ ] `getSpeakerSegments`: filters by transcription_id
- [ ] `updateSegmentSpeaker`: changes speaker_id and speaker_label
- [ ] `deleteSpeakerSegments`: cascade test via transcription delete
- [ ] Speaker engine: assigns labels to 2-speaker simulated input
- [ ] Speaker engine: handles single-speaker input (no diarization)
- [ ] Speaker engine: merges short segments (<1s) with neighbors

### Integration Tests
- [ ] Full flow: create transcription -> run diarization -> speaker segments persisted -> query returns labeled segments
- [ ] Correction flow: change speaker on segment -> re-query shows updated label
- [ ] Delete flow: delete speaker -> segments show NULL speaker_id but retain label text

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyVoice > Settings > Manage Speakers
3. Tap "Add Speaker", enter name "Alice", pick a color -- verify card appears (AC-8)
4. Add a second speaker "Bob" with different color
5. Go to Dictate tab, record a 30+ second conversation with 2 people
6. Stop recording, wait for processing
7. Open the transcription from History -- verify speaker labels appear (AC-1, AC-2)
8. Verify timeline bar shows colored blocks (AC-3)
9. Tap a timeline block -- verify transcript scrolls (AC-4)
10. Long-press a segment -- verify speaker correction menu appears (AC-5)
11. Change a segment from "Speaker 1" to "Alice" -- verify immediate update (AC-6)
12. Go to Settings > Manage Speakers -- verify sample counts updated (AC-7)
13. Delete "Bob" speaker profile
14. Return to transcription -- verify Bob's segments still show text but with generic label (AC-9)
15. Record a solo voice note -- verify no speaker UI clutter (AC-10)

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the speaker matching engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- voice has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Voice module has 3 tables (vc_transcriptions, vc_voice_notes, vc_settings), 14 CRUD functions, and 5 text engine functions. No speaker awareness. VoiceCommand type exists in types.ts but has no table. Schema version 1.

### After This Work
Voice module has 5 tables (+vc_speakers, +vc_speaker_segments), ~24 CRUD functions, speaker diarization engine. Schema version 2. Transcription detail view supports speaker-labeled segments with timeline visualization.

### Files Changed
- `modules/voice/src/db/schema.ts` -- added CREATE_SPEAKERS, CREATE_SPEAKER_SEGMENTS DDL, new indexes
- `modules/voice/src/db/crud.ts` -- added speaker CRUD (create, get, update, delete) and segment CRUD (create, get by transcription, update speaker, delete)
- `modules/voice/src/types.ts` -- added SpeakerSchema, SpeakerSegmentSchema Zod types
- `modules/voice/src/engine/speaker.ts` -- new file: diarization engine, segment merging, label assignment
- `modules/voice/src/definition.ts` -- added migration v2 with new tables
- `modules/voice/src/index.ts` -- re-exported new APIs
- `apps/mobile/app/(voice)/transcription-detail.tsx` -- speaker segment view + timeline
- `apps/mobile/app/(voice)/speakers.tsx` -- new: Manage Speakers screen
- `apps/web/app/voice/speakers/page.tsx` -- new: web speaker management

### Known Limitations
- Voice print matching is basic (hash-based) and will not match Otter.ai's ML-powered speaker recognition. A future iteration could add on-device ML models.
- No real-time speaker labels during recording in v1; diarization runs post-capture.
- Limited to 10 speakers per transcription.

### Context for Next Agent
- The voice_print_hash field is a placeholder for future ML-based speaker fingerprinting. For v1, implement basic audio feature hashing or leave it optional with manual labeling as the primary workflow.
- Speaker colors should use a preset palette (8-10 distinct colors) that work on the Cool Obsidian dark background. Avoid colors that clash with the module accent (#EF4444).
- The speaker timeline bar is a custom component; consider making it reusable as it could serve the podcast/audio features in other modules.
