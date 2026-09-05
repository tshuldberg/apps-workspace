# Feature Spec: Photo/Voice Attachments

## Metadata
- **Module:** mood
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 3-4
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Existing mood entry CRUD (`db/crud.ts`), `mo_entries` table
- **Blocks:** none

## Business Context

### Why This Feature Exists
Mood logging is more expressive when users can attach context beyond a 1-10 score and text note. Daylio (20M users, $35.99/yr) popularized photo attachments as a "mood memory" feature, letting users capture what their day looked like alongside the numeric score. Voice memos add a hands-free option for users who find typing difficult during emotional moments. The switching score (3/5) reflects that Daylio and Reflectly users expect this capability. Complexity is moderate (3/5) because we need file storage management on-device, thumbnail generation, and audio recording with playback, all without any cloud dependency.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Daylio | Yes (photos) | Yes ($35.99/yr) | Photo attachments on mood entries, gallery view, no voice |
| Reflectly | Yes (photos) | Yes ($59.99/yr) | Photo attachments with AI-generated journal prompts based on image |
| Bearable | No | N/A | Text notes only |
| Calm | No | N/A | No mood logging |
| Headspace | No | N/A | No mood logging |

### Target User
Daylio users (20M installed base) who attach photos to mood entries as visual memory anchors. Users who prefer voice notes over typing (hands-free logging while driving, walking, or during emotional moments). Privacy-conscious users who want photo/voice attachments stored locally with zero cloud upload.

## Technical Context

### Where This Lives in MyLife

```
modules/mood/src/
  types.ts                               -- New types: MoodAttachment, AttachmentType
  db/schema-v3.ts                        -- V3 migration for mo_attachments table
  db/attachments.ts                      -- NEW: Attachment CRUD (create, get, delete, get by entry)
  engine/media.ts                        -- NEW: Thumbnail generation, audio duration calc, file size validation
  __tests__/attachments.test.ts          -- NEW: Attachment CRUD + media engine tests

apps/mobile/app/(mood)/
  log-mood.tsx                           -- MODIFIED: Add photo/voice attachment buttons to entry form
  day-detail.tsx                         -- MODIFIED: Display attachments in entry detail view
  components/AttachmentPicker.tsx        -- NEW: Camera/gallery/voice recorder component
  components/AttachmentPreview.tsx       -- NEW: Thumbnail grid + audio player component

apps/web/app/mood/
  components/AttachmentUpload.tsx        -- NEW: File upload + audio recorder for web
  components/AttachmentDisplay.tsx       -- NEW: Image/audio display for web
```

### Wireframe Position

```
Hub Dashboard
  └── MyMood card
       └── Today tab
            └── Log Mood screen
                 ├── Score slider (existing)
                 ├── Emotion tags (existing)
                 ├── Activities (existing)
                 ├── Note text field (existing)
                 └── Attachments ← YOU ARE HERE
                      ├── [+Photo] button -> camera/gallery picker
                      ├── [+Voice] button -> audio recorder
                      └── Thumbnail grid of attached media
```

### Data Model

```sql
-- V3 Migration: Attachments table

CREATE TABLE IF NOT EXISTS mo_attachments (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES mo_entries(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('photo', 'voice')),
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_size_bytes INTEGER NOT NULL,
  duration_seconds REAL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS mo_attachments_entry_idx ON mo_attachments(entry_id);
CREATE INDEX IF NOT EXISTS mo_attachments_type_idx ON mo_attachments(type);
```

**File storage convention:**
- Photos stored at: `{documentDirectory}/mood/photos/{entryId}/{attachmentId}.jpg`
- Voice memos stored at: `{documentDirectory}/mood/voice/{entryId}/{attachmentId}.m4a`
- Thumbnails stored at: `{documentDirectory}/mood/thumbnails/{attachmentId}_thumb.jpg`
- Web: files stored in IndexedDB via File System Access API fallback

### Dependencies
- **Internal:** `@mylife/mood` (entry CRUD), `@mylife/ui` (Cool Obsidian tokens), `@mylife/db` (migration orchestration)
- **External:** `expo-image-picker` (camera/gallery access), `expo-av` (audio recording/playback), `expo-file-system` (local file management), `expo-image-manipulator` (thumbnail generation)
- **Cross-Module:** Minimal. Attachments are mood-internal. Future: Journal module could reference mood photos.

## Functional Requirements

### User Stories
1. As a user logging my mood, I want to attach a photo from my camera or gallery so that I can capture a visual memory of the moment.
2. As a user logging my mood, I want to record a voice memo so that I can express my feelings without typing.
3. As a user viewing past entries, I want to see photo thumbnails and play back voice memos so that I can relive the context of that moment.
4. As a user managing storage, I want to delete individual attachments without deleting the mood entry.

### Behavior Specification

**Photo Attachment Flow:**
1. User taps [+Photo] button in mood entry form.
2. Bottom sheet appears with options: "Take Photo" (camera) or "Choose from Library" (gallery).
3. User takes/selects a photo.
4. Photo is resized to max 1920px on longest edge (preserve aspect ratio).
5. Thumbnail (200x200, center-crop) is generated.
6. Both files saved to document directory. Attachment record created in `mo_attachments`.
7. Thumbnail appears in attachment grid below the note field.
8. User can tap thumbnail to view full-size, or long-press to delete.

**Voice Memo Flow:**
1. User taps [+Voice] button.
2. Recording UI appears: red pulsing circle, elapsed time counter, "Stop" button.
3. Recording uses AAC codec (`.m4a`), max duration 5 minutes.
4. User taps "Stop".
5. Audio file saved. Duration calculated and stored.
6. Waveform preview appears in attachment grid with duration label.
7. User can tap to play/pause, or long-press to delete.

**Viewing Attachments:**
1. In day-detail or history view, entries with attachments show a media indicator icon.
2. Tapping an entry with attachments shows the full attachment grid: photo thumbnails + voice memo players.
3. Photos open in a lightbox (pinch-to-zoom on mobile).
4. Voice memos have inline play/pause with progress bar.

### Edge Cases

- Camera/microphone permissions denied: show system settings redirect prompt.
- Very large photo selected from gallery (>20MB): compress to target max 5MB.
- Voice recording interrupted by phone call: save partial recording, mark duration.
- User deletes a mood entry: CASCADE delete removes all attachment records. File cleanup job removes orphaned files.
- Disk space low (<50MB free): warn user before allowing new attachments.
- Multiple attachments on one entry: max 5 photos + 1 voice memo per entry.
- Corrupt/missing file on playback: show "File not found" placeholder, offer to remove broken reference.
- Module disabled: files remain on disk (data preservation). Re-enabling restores access.
- Web platform: use `<input type="file" accept="image/*">` for photos, `MediaRecorder` API for voice. No camera access needed (upload-only).
- Attachment added to entry, then entry is not saved (user navigates away): clean up orphaned files on next app start.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** [+Photo] button opens a bottom sheet with "Take Photo" and "Choose from Library" options
- [ ] **AC-2:** Selected/captured photo appears as thumbnail in the attachment grid within 1 second
- [ ] **AC-3:** [+Voice] button starts audio recording with visual indicator (red dot, elapsed time)
- [ ] **AC-4:** Stopping recording shows waveform preview with duration label
- [ ] **AC-5:** Tapping a photo thumbnail opens a full-size lightbox viewer
- [ ] **AC-6:** Tapping a voice memo plays audio with progress bar and pause capability
- [ ] **AC-7:** Long-pressing an attachment shows a delete confirmation
- [ ] **AC-8:** Entries with attachments show a media indicator icon in history/list views
- [ ] **AC-9:** Maximum 5 photos + 1 voice memo enforced per entry with user-visible message
- [ ] **AC-10:** Attachments persist after app restart

### Technical Criteria
- [ ] **TC-1:** Photos are resized to max 1920px longest edge before storage
- [ ] **TC-2:** Thumbnails are generated at 200x200 center-crop
- [ ] **TC-3:** Voice recordings use AAC codec (.m4a) with max 5-minute duration
- [ ] **TC-4:** File paths follow convention: `mood/photos/{entryId}/{id}.jpg`, `mood/voice/{entryId}/{id}.m4a`
- [ ] **TC-5:** Deleting a mood entry cascade-deletes attachment records AND removes files from disk
- [ ] **TC-6:** V3 migration creates `mo_attachments` table with correct constraints and indexes
- [ ] **TC-7:** Attachment file_size_bytes is accurately recorded
- [ ] **TC-8:** All attachment operations work offline (zero network calls)

### Negative Criteria
- [ ] **NC-1:** Photos must NOT be uploaded to any cloud service or external API
- [ ] **NC-2:** Voice recordings must NOT be transcribed or processed by external services
- [ ] **NC-3:** Attachment files must NOT be accessible to other modules without explicit API
- [ ] **NC-4:** Camera/microphone must NOT be accessed without explicit user permission grant
- [ ] **NC-5:** Thumbnails must NOT contain EXIF location data (strip metadata on generation)

## UI Specification

### Mobile (Expo)
- **Attachment Buttons:** Row below note field. [+Photo] with camera icon, [+Voice] with mic icon. `rgba(255,255,255,0.08)` (glassStrong) background, `#FB923C` (mood accent) icon, 44dp tap target.
- **Thumbnail Grid:** 3-column grid, 100dp per cell, 4dp gap. `rgba(255,255,255,0.04)` (glass) background with `rgba(255,255,255,0.10)` (glassBorder) border. Corner badge for count if >3.
- **Voice Recorder Overlay:** Bottom sheet, `#0A0A0F` background. Red pulsing dot (12dp, `#FF453A`), timer in `#F0F0F5`, 20sp monospace. "Stop" button: `#FF453A` circle, 56dp.
- **Audio Player:** Inline card in attachment grid. Waveform visualization (if available, else simple progress bar). Play/pause icon, duration label in `rgba(240,240,245,0.65)` (textSecondary).
- **Lightbox:** Full-screen, black background, pinch-to-zoom, swipe-to-dismiss. Close button top-right.

### Web (Next.js)
- Same tokens via CSS variables.
- Photo upload via drag-and-drop zone or file input.
- Voice recording via `MediaRecorder` API with fallback message for unsupported browsers.
- Lightbox uses `<dialog>` element with backdrop-filter.
- Audio player uses native `<audio>` element styled with Cool Obsidian tokens.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Thumbnail placeholder skeleton | Photo processing/resize in progress |
| Empty | "Add a photo or voice memo" hint text with icons | No attachments on entry |
| Error | "File not found" placeholder with remove option | Corrupt/missing file |
| Success | Thumbnail grid with photos + voice player | Attachments loaded |
| Partial | Some thumbnails loaded, others showing skeleton | Large photos still processing |

## Test Requirements

### Unit Tests
- [ ] `createAttachment`: creates record with correct fields
- [ ] `createAttachment`: rejects invalid type (not 'photo' or 'voice')
- [ ] `getAttachmentsForEntry`: returns all attachments for an entry, ordered by created_at
- [ ] `getAttachmentsForEntry`: returns empty array for entry with no attachments
- [ ] `deleteAttachment`: removes record
- [ ] `deleteAttachment`: non-existent ID is no-op
- [ ] Media engine: `resizePhoto` produces image <= 1920px on longest edge
- [ ] Media engine: `generateThumbnail` produces 200x200 output
- [ ] Media engine: `validateFileSize` rejects files > 5MB
- [ ] Media engine: `stripExifMetadata` removes GPS data from photo
- [ ] Attachment count: enforces max 5 photos + 1 voice per entry

### Integration Tests
- [ ] Full flow: log mood -> attach photo -> save entry -> view entry -> see thumbnail -> tap to view full size
- [ ] Delete flow: delete mood entry -> verify attachment records removed -> verify files removed from disk
- [ ] Voice flow: record audio -> stop -> verify .m4a file exists -> play back -> verify duration

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyMood > Today > Log Mood
3. Set mood score to 7
4. Tap [+Photo] button
5. Verify: Bottom sheet with "Take Photo" and "Choose from Library" -- corresponds to AC-1
6. Select "Choose from Library", pick a photo
7. Verify: Thumbnail appears in attachment grid within 1 second -- corresponds to AC-2
8. Tap [+Voice] button
9. Verify: Recording UI with red dot and timer -- corresponds to AC-3
10. Record for 10 seconds, tap Stop
11. Verify: Waveform/progress bar with "0:10" duration -- corresponds to AC-4
12. Save the mood entry
13. Navigate to History, find the entry
14. Verify: Media indicator icon on the entry row -- corresponds to AC-8
15. Tap the entry
16. Verify: Photo thumbnail and voice player visible
17. Tap the photo thumbnail
18. Verify: Full-size lightbox opens with pinch-to-zoom -- corresponds to AC-5
19. Dismiss lightbox, tap voice player play button
20. Verify: Audio plays with progress bar -- corresponds to AC-6
21. Long-press the photo
22. Verify: Delete confirmation appears -- corresponds to AC-7
23. Confirm delete
24. Verify: Photo removed from grid
25. Close app, reopen, navigate to the entry
26. Verify: Voice memo still present and playable -- corresponds to AC-10
27. Try adding 6 photos to a single entry
28. Verify: "Maximum 5 photos" message appears -- corresponds to AC-9
29. Repeat photo upload flow on web at /mood
30. Verify: Drag-and-drop and file input both work

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to log-mood screen, test photo + voice flows, verify all 5 states
- [ ] Batch QA: after 5 features in mood module, run `/qa` on mood URL

### Post-merge:
- [ ] `/parity-check` -- mood module has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Mood entries support only a numeric score (1-10), text note (max 500 chars), Plutchik emotion tags, and activity links. No binary file attachments of any kind.

### After This Work
- V3 migration adds `mo_attachments` table with CASCADE delete
- Photo capture/selection with auto-resize and thumbnail generation
- Voice recording with AAC codec and duration tracking
- Attachment grid on mood entry form and detail views
- Lightbox photo viewer and inline audio player
- File cleanup on entry deletion

### Files Changed
- `modules/mood/src/types.ts` -- New types: MoodAttachment, AttachmentType, CreateAttachmentInput
- `modules/mood/src/db/schema-v3.ts` -- NEW: V3 migration SQL for mo_attachments
- `modules/mood/src/db/attachments.ts` -- NEW: Attachment CRUD functions
- `modules/mood/src/engine/media.ts` -- NEW: Photo resize, thumbnail gen, EXIF strip, audio duration calc
- `modules/mood/src/definition.ts` -- Add V3 migration, bump schemaVersion to 3
- `modules/mood/src/index.ts` -- Export new attachment types, CRUD, media engine
- `modules/mood/src/__tests__/attachments.test.ts` -- NEW: Tests
- `apps/mobile/app/(mood)/log-mood.tsx` -- Add attachment buttons and grid
- `apps/mobile/app/(mood)/day-detail.tsx` -- Display attachments in detail view
- `apps/mobile/app/(mood)/components/AttachmentPicker.tsx` -- NEW: Camera/gallery/voice picker
- `apps/mobile/app/(mood)/components/AttachmentPreview.tsx` -- NEW: Thumbnail grid + audio player
- `apps/web/app/mood/components/AttachmentUpload.tsx` -- NEW: Web file upload + recorder
- `apps/web/app/mood/components/AttachmentDisplay.tsx` -- NEW: Web image/audio display

### Known Limitations
- No cloud backup for attachment files. If user wipes app data, photos/voice memos are lost. Future: integrate with backup system (P0 TODO).
- No video attachment support. Photos and voice only for V1.
- No AI analysis of photos (e.g., facial expression detection). Pure storage and display.
- Web voice recording requires modern browser with MediaRecorder API support.

### Context for Next Agent
- The `expo-image-picker` package needs camera/photo library permissions configured in `app.json`. Check existing Expo config before adding duplicates.
- The `expo-av` package is likely already used by the Voice module. Check for existing installation.
- File cleanup on entry delete should happen in a transaction: delete DB records first, then remove files. If file removal fails, log warning but don't fail the transaction.
- Thumbnail generation with `expo-image-manipulator` is async. Generate thumbnails in a background task after the entry is saved, using a placeholder until ready.
- EXIF stripping is critical for privacy. Use `expo-image-manipulator` compress step which strips metadata by default.
