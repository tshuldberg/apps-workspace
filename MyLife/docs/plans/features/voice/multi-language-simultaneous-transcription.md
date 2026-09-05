# Feature Spec: Multi-Language Simultaneous Transcription

## Metadata
- **Module:** voice
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [1] x2 + CrossModule [1] x1 + PaidUser [4] x1
- **Sprint:** 3-4
- **Estimated CC Time:** 4-6 hours
- **Depends On:** none (builds on existing vc_transcriptions language field)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Multi-language simultaneous transcription supports conversations where participants switch between languages or speak different languages at the same time. This is common in bilingual households, international meetings, and multicultural social settings. Notta charges $100-180/yr specifically because of this capability, targeting the 1.5+ billion bilingual speakers worldwide. MyLife's privacy-first approach (on-device processing) is a direct advantage over cloud-dependent competitors for sensitive multilingual conversations.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Notta | Yes | Yes ($100-180/yr) | Real-time multi-language transcription with translation, supports 100+ languages, cloud-processed |
| Otter.ai | Partial | Yes ($100/yr) | English-primary with limited language detection, no simultaneous multi-language |
| Apple Dictation | Partial | Free | Auto language detection in iOS 17+, one language at a time, limited to ~20 languages |
| Google Recorder | No | N/A | English-only on-device transcription |

### Target User
Bilingual and multilingual users who have conversations that naturally switch between languages. Primary: bilingual families (e.g., English/Spanish households in the US, English/Mandarin in tech communities). Secondary: international professionals who attend meetings with mixed-language participants. Migration path: Notta users paying $100-180/yr who want privacy-first multilingual transcription without cloud upload.

## Technical Context

### Where This Lives in MyLife

```
modules/voice/src/db/schema.ts           -- New table DDL (vc_language_segments, vc_language_profiles)
modules/voice/src/db/crud.ts             -- New CRUD for language segments and profiles
modules/voice/src/types.ts               -- New Zod schemas (LanguageSegment, LanguageProfile)
modules/voice/src/engine/language.ts     -- Language detection engine, segment splitter
modules/voice/src/definition.ts          -- Migration (v2/v3 depending on build order)
modules/voice/src/index.ts               -- Re-export new APIs
apps/mobile/app/(voice)/                 -- Multi-language transcript view, language profile settings
apps/web/app/voice/                      -- Web equivalents
```

### Wireframe Position

```
Hub Dashboard
  └── MyVoice card
       └── Dictate tab
            └── Language selector (multi-select) ← ENHANCED
       └── History tab
            └── Transcription detail
                 └── Language-segmented view ← NEW
       └── Settings tab
            └── Language Profiles ← NEW
```

### Data Model

```sql
-- New table: language-specific segments within a transcription
CREATE TABLE IF NOT EXISTS vc_language_segments (
  id TEXT PRIMARY KEY,
  transcription_id TEXT NOT NULL REFERENCES vc_transcriptions(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  start_seconds REAL NOT NULL,
  end_seconds REAL NOT NULL,
  text TEXT NOT NULL,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: saved language profiles (sets of languages to detect)
CREATE TABLE IF NOT EXISTS vc_language_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  languages TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS vc_lang_segments_transcription_idx ON vc_language_segments(transcription_id);
CREATE INDEX IF NOT EXISTS vc_lang_segments_language_idx ON vc_language_segments(language);
CREATE INDEX IF NOT EXISTS vc_lang_segments_time_idx ON vc_language_segments(transcription_id, start_seconds);
CREATE INDEX IF NOT EXISTS vc_lang_profiles_default_idx ON vc_language_profiles(is_default);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/module-registry` (ModuleDefinition migration system)
- **External:** Platform speech recognition APIs with language detection (Apple Speech Framework supports language identification, Android SpeechRecognizer supports multilingual mode). `expo-speech` or `expo-av` for audio capture. BCP 47 language codes (ISO 639-1 + region) for standardized language identification.
- **Cross-Module:** Minimal cross-module impact. The existing transcription stats already group by language. Language profiles could eventually be shared with the Words module for vocabulary context.

## Functional Requirements

### User Stories
1. As a bilingual user, I want to record a conversation that switches between languages and get an accurate transcript for each language so that nothing is lost in translation.
2. As a user, I want to set up language profiles (e.g., "Home: English + Spanish") so that the app knows which languages to expect.
3. As a user, I want to see language labels on each segment of the transcript so that I can quickly identify which language was spoken.
4. As a user, I want transcription stats broken down by language so that I can see my language usage patterns.
5. As a user, I want to filter my transcript history by language so that I can find recordings in a specific language.

### Behavior Specification

**Setting up a language profile:**
1. User navigates to Settings > Language Profiles
2. User taps "Create Profile"
3. Profile creation screen: name field + language multi-selector
4. Language selector shows searchable list of supported languages with flags/icons
5. User selects 2-5 languages and gives the profile a name (e.g., "Home", "Work", "Travel")
6. User can set one profile as default
7. Profile is saved

**Recording with multi-language detection:**
1. User opens Dictate tab
2. Below the record button, a language profile selector shows the default profile (or "Auto-detect")
3. User can tap to switch profiles or choose "Auto-detect" for single-language mode
4. User taps Record
5. System initializes speech recognition with the selected language set
6. As user speaks, system performs real-time language identification per utterance
7. Live transcript shows language tags inline (e.g., "[EN]" or "[ES]") with each segment
8. User taps Stop
9. System finalizes language segments and persists them

**Viewing multi-language transcript:**
1. User opens a transcription from History
2. If multi-language segments exist, transcript shows language indicators:
   - Small language badge (e.g., "EN", "ES") at the start of each language switch
   - Subtle background tint per language (very light, not distracting)
3. Language breakdown summary at the top: "English 65% | Spanish 35%"
4. User can toggle "Show language labels" on/off in the view

**Filtering by language:**
1. In the History tab, user taps the filter icon
2. Filter options include: language dropdown populated from all detected languages in the user's history
3. Selecting a language shows only transcriptions containing that language
4. Results show the percentage of each transcription in the selected language

### Edge Cases
- Single language detected despite multi-language profile active: show as normal single-language transcription, no language segments created
- Unknown/unrecognized language: label as "Unknown" with low confidence, still capture the text
- Mid-word language switch (code-switching within a sentence): attribute the entire sentence to the dominant language
- Very short segment in a different language (<2 seconds, single word): still capture but flag as low-confidence language detection
- Language not supported by platform speech recognition: warn user at profile creation, exclude from detection set
- More than 5 languages in a profile: cap at 5, show warning "more languages reduces accuracy"
- All segments same language despite multi-language profile: treat as single-language, no language badges shown
- Audio quality too low for language detection: fall back to the profile's primary language (first in list)
- Profile deleted while recording active: recording continues with current language set, profile deletion takes effect on next recording
- Language profile with only one language: valid, functions as a language preference hint (not multi-language mode)
- Platform does not support multi-language detection: degrade gracefully to single-language with auto-detect, show info message explaining limitation

### Supported Languages (Initial Set)

The following languages are supported at launch, chosen by speaker population and bilingual demand:

| Language | BCP 47 Code | Region Focus |
|----------|-------------|-------------|
| English | en-US, en-GB | Global |
| Spanish | es-US, es-ES, es-MX | Americas, Europe |
| Mandarin Chinese | zh-CN, zh-TW | Asia, Americas |
| French | fr-FR, fr-CA | Americas, Europe, Africa |
| German | de-DE | Europe |
| Japanese | ja-JP | Asia |
| Korean | ko-KR | Asia |
| Portuguese | pt-BR, pt-PT | Americas, Europe |
| Hindi | hi-IN | Asia |
| Arabic | ar-SA | Middle East, Africa |
| Italian | it-IT | Europe |
| Russian | ru-RU | Europe, Asia |

Additional languages can be added if the platform speech recognition APIs support them.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can create a language profile with 2-5 selected languages
- [ ] **AC-2:** Language profile selector appears on the Dictate screen below the record button
- [ ] **AC-3:** Default language profile is pre-selected on the Dictate screen
- [ ] **AC-4:** Recording with a multi-language profile produces language-tagged segments in the transcript
- [ ] **AC-5:** Transcript detail shows language badges (e.g., "EN", "ES") at each language switch point
- [ ] **AC-6:** Language breakdown summary (percentages) appears at the top of multi-language transcripts
- [ ] **AC-7:** User can toggle language labels on/off in transcript view
- [ ] **AC-8:** History tab filter includes language dropdown populated from user's detected languages
- [ ] **AC-9:** Filtering by language shows matching transcriptions with per-transcript language percentage
- [ ] **AC-10:** Transcription stats page shows language breakdown across all recordings
- [ ] **AC-11:** Single-language recordings show no language UI clutter (same as current behavior)

### Technical Criteria
- [ ] **TC-1:** vc_language_segments and vc_language_profiles tables created by migration
- [ ] **TC-2:** Language segments are persisted with correct transcription_id foreign key
- [ ] **TC-3:** Deleting a transcription cascades to delete all its language segments
- [ ] **TC-4:** Language codes follow BCP 47 format (validated by Zod schema)
- [ ] **TC-5:** Profile languages stored as JSON array in the languages TEXT column
- [ ] **TC-6:** Only one profile can be is_default=1 at a time (enforce via CRUD logic)
- [ ] **TC-7:** Existing getTranscriptionStats query enhanced to use language segments when available
- [ ] **TC-8:** Language filter query uses index on vc_language_segments.language
- [ ] **TC-9:** All CRUD operations work with the existing DatabaseAdapter pattern

### Negative Criteria
- [ ] **NC-1:** Audio must NOT be sent to any cloud service for language detection (all on-device)
- [ ] **NC-2:** Multi-language mode must NOT degrade single-language transcription quality
- [ ] **NC-3:** Language profile data must NOT contain any personally identifiable information
- [ ] **NC-4:** Language detection must NOT add perceptible latency to the live transcription display (process async)

## UI Specification

### Mobile (Expo)

**Dictate tab (enhanced):**
- Below the record button: horizontal pill selector showing current language profile name
- Tap to open profile picker (bottom sheet with profile list + "Auto-detect" option)
- During recording with multi-language: live transcript shows inline language badges (small rounded pills, e.g., "EN" in blue, "ES" in orange)
- Module accent: `#EF4444`

**Transcript detail (multi-language):**
- Background: `#0A0A0F` (background token)
- Top bar: language breakdown (e.g., "EN 65% | ES 35%") in `textSecondary`
- Each language switch: small language badge (rounded, colored per language) before the segment text
- Language colors: predefined palette (EN=blue, ES=orange, ZH=red, FR=indigo, etc.) -- max 12 distinct
- Toggle button in header: "Show/Hide language labels"
- Segments in glass cards (`rgba(255,255,255,0.04)`) with subtle left-border color matching the language

**Language Profiles screen:**
- Settings > Language Profiles
- Profile cards: name, language flag icons, "Default" badge on the active default
- "Create Profile" button at bottom
- Profile creation: name input + searchable language grid (flag + name + code for each)
- Swipe-to-delete on profile cards

### Web (Next.js)

- Same tokens via CSS variables
- Sidebar navigation: `/voice/settings/languages` route
- Transcript detail: language badges inline, breakdown bar at top (stacked horizontal bar chart)
- Language profile management: `/voice/languages` with table-style list
- Filter in history: dropdown in the page header

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton segments with placeholder badges | Opening multi-language transcription |
| Empty | "No language profiles" + "Create your first profile" CTA | No profiles created yet |
| Error | "Language detection unavailable on this device" + explanation | Platform doesn't support multi-language |
| Success | Color-coded language segments with breakdown | Normal multi-language result |
| Partial | Some segments labeled, some marked "Unknown" | Low-confidence language detection |

## Test Requirements

### Unit Tests
- [ ] `createLanguageProfile`: creates with name + languages array, returns profile
- [ ] `createLanguageProfile`: validates max 5 languages
- [ ] `getLanguageProfile`: returns null for non-existent ID
- [ ] `getLanguageProfiles`: returns all profiles ordered by name
- [ ] `setDefaultProfile`: sets one profile as default, unsets previous default
- [ ] `deleteLanguageProfile`: removes profile (does not affect existing recordings)
- [ ] `createLanguageSegment`: creates with transcription FK, language code, time range
- [ ] `createLanguageSegment`: validates start_seconds < end_seconds
- [ ] `getLanguageSegments`: returns segments for transcription ordered by start_seconds
- [ ] `getLanguageBreakdown`: returns percentage per language for a transcription
- [ ] `getLanguageBreakdown`: handles single-language case (100%)
- [ ] `getLanguageBreakdown`: handles empty segments (returns empty array)
- [ ] Language engine: detects language switch in simulated bilingual input
- [ ] Language engine: handles single-language input (no segments created)
- [ ] Language engine: merges adjacent segments in the same language
- [ ] Language engine: validates BCP 47 language codes
- [ ] Language engine: caps profile at 5 languages

### Integration Tests
- [ ] Full flow: create profile -> record with multi-language -> segments persisted -> transcript shows language badges
- [ ] Filter flow: multiple transcriptions in different languages -> filter by language -> correct subset returned
- [ ] Stats flow: multiple multi-language transcriptions -> stats show accurate language breakdown

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyVoice > Settings > Language Profiles
3. Verify empty state shows "No language profiles" CTA (Empty state)
4. Tap "Create Profile", name it "Home", select English and Spanish (AC-1)
5. Save -- verify profile appears in list
6. Set as default -- verify "Default" badge appears
7. Go to Dictate tab -- verify language profile selector shows "Home" below record button (AC-2, AC-3)
8. Start recording
9. Speak a sentence in English, then switch to Spanish, then back to English
10. Stop recording, wait for processing
11. Open the transcription from History
12. Verify language badges appear at switch points (e.g., "EN", "ES") (AC-4, AC-5)
13. Verify language breakdown at top (e.g., "EN 60% | ES 40%") (AC-6)
14. Toggle "Hide language labels" -- verify badges disappear (AC-7)
15. Toggle back on
16. Go to History tab, tap filter icon
17. Verify language dropdown shows "English" and "Spanish" (AC-8)
18. Filter by "Spanish" -- verify matching transcription appears with percentage (AC-9)
19. Navigate to stats/settings -- verify language breakdown across all recordings (AC-10)
20. Record a new transcription in only English -- verify no language UI clutter (AC-11)

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the language detection engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- voice has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Voice module has basic language support: a single `language` TEXT column on vc_transcriptions (stores detected language for the entire recording). TranscriptionStats groups by this single language field. No multi-language awareness, no language profiles, no per-segment language detection.

### After This Work
Voice module supports full multi-language transcription: vc_language_segments tracks per-segment language with timestamps, vc_language_profiles stores user-defined language sets, the Dictate screen has a profile selector, transcript detail shows language-segmented views with color-coded badges, and history can be filtered by language.

### Files Changed
- `modules/voice/src/db/schema.ts` -- added CREATE_LANGUAGE_SEGMENTS, CREATE_LANGUAGE_PROFILES DDL, new indexes
- `modules/voice/src/db/crud.ts` -- added language profile CRUD, language segment CRUD, language breakdown query, enhanced stats
- `modules/voice/src/types.ts` -- added LanguageSegmentSchema, LanguageProfileSchema Zod types
- `modules/voice/src/engine/language.ts` -- new file: language detection engine, segment merger, BCP 47 validation
- `modules/voice/src/definition.ts` -- added migration with new tables
- `modules/voice/src/index.ts` -- re-exported new APIs
- `apps/mobile/app/(voice)/dictate.tsx` -- added language profile selector below record button
- `apps/mobile/app/(voice)/transcription-detail.tsx` -- added language badges, breakdown bar, toggle
- `apps/mobile/app/(voice)/language-profiles.tsx` -- new: profile management screen
- `apps/web/app/voice/languages/page.tsx` -- new: web language profile management

### Known Limitations
- On-device language detection accuracy depends heavily on platform capabilities. Apple Speech Framework has better multi-language support than Android SpeechRecognizer. Accuracy may vary significantly between platforms.
- Code-switching within a single sentence (e.g., Spanglish) is attributed to the dominant language of the sentence, not split mid-sentence.
- Initial launch supports 12 languages. Additional languages require platform API support verification before adding to the supported set.
- No translation between languages in v1. Segments are transcribed in their detected language only.

### Context for Next Agent
- The existing `language` column on vc_transcriptions stores a single language for backward compatibility. When language segments exist, this column should store the primary/dominant language. The segments table is the source of truth for per-segment language data.
- Language colors should be a static map in the engine (language code -> hex color). Keep colors visually distinct on the Cool Obsidian dark background. Reserve `#EF4444` (module accent) for UI controls, not language badges.
- The languages column in vc_language_profiles stores a JSON array (e.g., `["en-US","es-MX"]`). Parse with `JSON.parse()` on read, `JSON.stringify()` on write. Zod schema should validate the parsed array.
- If speaker identification ships first, language segments and speaker segments can coexist on the same transcription. A segment can have both a speaker_id and a language code. Consider whether to merge these into a single unified segments table in a future iteration.
