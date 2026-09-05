# MyVoice Module Audit

**ID:** voice | **Prefix:** vc_ | **Tier:** free | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.2.0
**One-line promise:** Private on-device dictation

## User Value
- Record voice notes and transcribe on-device
- Full transcription + voice-note library with favorites and tags
- Speaker identification and segmentation (V2)
- Custom voice commands (V2)
- Multi-language transcription with language profiles (V2)
- Text analytics: word count, reading time, keyword extraction, auto summary
- Free tier, no subscription needed

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Transcription CRUD | src/db/crud.ts | shipped |
| Voice note CRUD + favorites | src/db/crud.ts | shipped |
| Settings (key/value) | src/db/crud.ts | shipped |
| Transcription stats (count, duration, by language) | src/db/crud.ts | shipped |
| Word count, reading time, keyword extraction | src/engine/text.ts | shipped |
| First-N-sentence summarization | src/engine/text.ts | shipped |
| V2 speakers + speaker_segments | src/db/schema.ts | shipped |
| V2 custom commands + command_log | src/db/schema.ts | shipped |
| V2 language_profiles + language_segments | src/db/schema.ts | shipped |
| Dictate tab | app/(voice)/index.tsx | shipped |
| History tab | implied by nav; screens scaffold minimal | partial |
| Settings | app/(voice)/settings.tsx | shipped |

## Data Model
Prefix `vc_`, schema v2. V1 tables: vc_transcriptions, vc_voice_notes, vc_settings. V2 adds vc_speakers, vc_speaker_segments, vc_commands, vc_command_log, vc_language_segments, vc_language_profiles. All data local, no network. Not an MCP module despite "voice" naming; this is dictation with on-device STT.

## Screens / User Flows
Mobile tabs: Dictate, History, Settings (minimal screens directory: index, settings). Screen: transcription-detail. Web route parity.

## Distinctive / Moat-worthy
- Free tier, only 5 modules in the registry qualify (fast, journal, mood, notes, voice)
- 100 percent on-device transcription (no Otter.ai-style cloud upload)
- Speaker diarization and custom commands in V2 schema
- Text analytics engine is pure functions, 25+ tests

## Gaps vs competitors
- History tab UI is minimal, transcription detail screen exists but list views thin
- No real-time meeting transcription UX yet
- No integrations into notes/journal/meds (potential cross-module wiring)

## Investor-facing hook
A private Otter.ai and Apple Voice Memos in one free-tier module with speaker ID, custom commands, and 270-language-ready scaffolding, without ever uploading audio.
