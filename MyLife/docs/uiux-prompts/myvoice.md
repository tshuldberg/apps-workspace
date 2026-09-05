# MyVoice -- UI/UX Design Prompt

Tagline: Capture every word, privately
Icon: 🎙️ | Accent: #EF4444 | Tier: Free
Note: Voice has minimal mobile (2 screens) but rich web (9 pages). Both platforms designed below.

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyVoice
Accent color: #EF4444 (red)
Platform: Mobile (Expo / React Native) + Web (Next.js 15)
Total screens: 11

---

SCREEN 1 — HOME (index.tsx) [Mobile]

- Recording list
  - Scrollable list of all recordings
  - Each row: title (auto-generated or user-named), duration (e.g. "4:23"), date
  - Transcription preview (first line, truncated) if transcription exists
  - Status badge: "Transcribed" (green), "Processing" (amber), "Audio Only" (gray)
  - Tap to play/view recording detail
  - Swipe left to delete (with confirmation)
- Quick record FAB button
  - Floating action button in bottom-right corner
  - Large red circle with microphone icon
  - Tap to begin recording immediately
  - While recording: FAB transforms to pulsing stop button, waveform animation appears at bottom of screen, elapsed time counter
- Stats summary card at top
  - Glass card with three stat pills:
    - Total recordings count
    - Total duration (e.g. "12h 34m")
    - Total words transcribed (if available)
- Empty state
  - Microphone illustration
  - "Tap the red button to start your first recording"

---

SCREEN 2 — SETTINGS (settings.tsx) [Mobile]

- Language selection
  - Current language displayed
  - Tap to open language picker
  - Affects transcription language
- Recording quality setting
  - Segmented control: Low (smaller files), Medium, High (best quality)
  - File size estimate per minute shown for each option
- Storage info
  - Total storage used by recordings
  - Number of recordings
  - "Clear All Recordings" button (danger styled, with confirmation)
- Transcription settings
  - Toggle: auto-transcribe after recording
  - Toggle: include timestamps in transcription
- About section
  - Privacy notice: "All recordings stay on your device"

---

SCREEN 3 — HUB (/voice) [Web]

- Dashboard layout with card grid
- Recent transcriptions card
  - List of last 5-10 transcriptions
  - Each row: title, date, duration, word count
  - Tap to navigate to Recording Detail
- Stats cards row
  - Three stat cards side by side:
    - Total recordings (number + icon)
    - Total duration (formatted hours/minutes)
    - Total words transcribed
- Quick actions
  - "New Recording" button (if web recording supported)
  - "Upload Audio" button for file upload
  - "Search Transcriptions" button
- Activity chart
  - Small bar chart: recordings per week over last 8 weeks

---

SCREEN 4 — RECORDINGS (/voice/recordings) [Web]

- Full recording browser
  - Table or card list of all recordings
  - Columns/fields: title, date, duration, word count, language, tags
  - Inline audio play button per row (small play icon)
- Search bar
  - Full-text search across recording titles and transcription content
  - Real-time filtering as user types
- Filters
  - Date range picker
  - Language filter dropdown
  - Tag filter (multi-select)
  - Duration range slider
- Sort options
  - Sort by: date (newest/oldest), duration, word count, title
- Bulk actions
  - Multi-select with checkboxes
  - Bulk delete, bulk export, bulk tag
- Pagination
  - Page controls at bottom or infinite scroll

---

SCREEN 5 — RECORDING DETAIL (/voice/recordings/[id]) [Web]

- Audio playback
  - Waveform visualization of the audio
  - Play/pause button, seek bar, current time / total time
  - Playback speed control: 0.5x, 1x, 1.25x, 1.5x, 2x
  - Volume control
- Full transcription text
  - Complete transcription displayed in readable format
  - Paragraphs separated by speaker turns (if speaker detection available)
  - Timestamps shown inline or in margin (toggleable)
- Keyword highlights
  - Frequently occurring words highlighted with accent color
  - Click a highlighted word to see all occurrences
- Edit transcription
  - "Edit" button toggles transcription into editable text area
  - Save/Cancel buttons appear
  - Edit history preserved
- Tags
  - Tag pills below audio player
  - "Add Tag" button with autocomplete from existing tags
  - Click tag to remove
- Metadata sidebar (on wider screens)
  - Recording date, duration, file size, language, quality, word count
- Actions
  - Export (text, markdown, PDF)
  - Delete recording
  - Re-transcribe (re-process audio)

---

SCREEN 6 — SEARCH (/voice/search) [Web]

- FTS search input
  - Large search bar at top
  - Full-text search across all transcriptions
  - Search as you type with debounce
- Result highlighting
  - Search results show transcription excerpts with matching terms highlighted in accent color
  - Context shown: surrounding sentences around each match
- Result list
  - Each result: recording title, date, matched excerpt with highlights
  - Click to navigate to Recording Detail, scrolled to match position
- Result count and filters
  - "42 results for 'meeting notes'" at top
  - Filter by date range, language, tags
- Advanced search
  - Exact phrase matching (quotes)
  - Exclude terms (minus sign)
  - Search within specific tags

---

SCREEN 7 — COMMANDS (/voice/commands) [Web]

- Custom voice command list
  - Table of 20 command definitions
  - Columns: command trigger phrase, action description, enabled toggle
  - Each row expandable for detail editing
- Create new command
  - "Add Command" button
  - Form: trigger phrase input, action type dropdown, action parameters
  - Action types: create note, set timer, add task, search, custom
- Edit command
  - Inline edit or modal form
  - Test command button (simulates the trigger)
- Command categories
  - Sections: Navigation, Productivity, Recording, Custom
- Enable/disable toggles
  - Per-command on/off switch
  - Global "Enable Voice Commands" master toggle at top

---

SCREEN 8 — SPEAKERS (/voice/speakers) [Web]

- Speaker identification profiles
  - List/card grid of identified speakers
  - Each card: speaker name (editable), avatar placeholder, recording count, total duration
- Voice fingerprints
  - Per-speaker detail view
  - Waveform signature visualization
  - Confidence score for identification
- Assign recordings to speakers
  - Recording list with speaker assignment dropdown
  - "Unassigned" recordings highlighted
  - Bulk assign: select multiple recordings, assign to speaker
- Add new speaker
  - "Add Speaker" button
  - Name input, optional sample recording for voice fingerprint
- Speaker stats
  - Per-speaker: total recordings, total words, most active dates
- Merge speakers
  - Select two speaker profiles to merge (correct mis-identifications)

---

SCREEN 9 — LANGUAGES (/voice/languages) [Web]

- Multi-language profile management
  - List of language profiles configured
  - Each row: language name, flag icon, number of recordings in that language
  - Primary language badge on default
- Detection confidence display
  - Per-recording language detection confidence percentage
  - Chart: language distribution across all recordings (donut chart)
- Add language profile
  - "Add Language" button
  - Language picker with search
  - Set as primary/secondary
- Language-specific settings
  - Per-language: preferred transcription model, custom vocabulary words
  - Toggle: auto-detect language per recording
- Statistics per language
  - Total recordings, total words, average accuracy

---

SCREEN 10 — EXPORT (/voice/export) [Web]

- Export format selection
  - Radio buttons or cards: Plain Text (.txt), Markdown (.md), PDF (.pdf)
  - Format preview showing how output will look
- Single export
  - Select one recording from dropdown
  - Preview of exported content
  - "Export" download button
- Batch export
  - Multi-select recordings with checkboxes
  - Or use filters: date range, language, tag
  - "Select All" / "Deselect All" buttons
  - "Export X recordings" button with count
- Export options
  - Toggle: include timestamps
  - Toggle: include speaker labels
  - Toggle: include metadata header (date, duration, language)
- Download
  - Single file or ZIP archive for batch exports
  - Download progress indicator for large batches

---

SCREEN 11 — SETTINGS (/voice/settings) [Web]

- Preferences section
  - Default language for new recordings
  - Default transcription quality (standard / enhanced)
  - Auto-transcribe toggle
  - Include timestamps by default toggle
- Storage management
  - Total storage used with breakdown chart (audio vs transcription data)
  - Per-recording storage list (sortable by size)
  - "Delete recordings older than..." with date picker
  - "Clear all data" with confirmation
- Quality settings
  - Recording quality: Low / Medium / High
  - Transcription model preference
  - Audio format selection (if applicable)
- Language defaults
  - Default recording language
  - Auto-detect language toggle
  - Preferred languages list (for auto-detect priority)
- Import section
  - Upload audio files for transcription
  - Supported formats listed: WAV, MP3, M4A, FLAC, OGG
  - Drag-and-drop upload zone
```
