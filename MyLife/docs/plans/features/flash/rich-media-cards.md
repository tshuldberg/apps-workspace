# Feature Spec: Rich Media Cards

## Metadata
- **Module:** flash
- **Priority Score:** 34 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** FL-001 (Flashcard Creation -- implemented via `createFlashcards`)
- **Blocks:** FL-010 (Image Occlusion), Anki .apkg import with media

## Business Context

### Why This Feature Exists
Rich media is table stakes for flashcard apps. Quizlet, Anki, and Brainscape all support images and audio on cards. Medical students need anatomical images. Language learners need audio pronunciation. Without media support, MyFlash cannot serve these two largest flashcard user segments. Currently, `fl_cards` only stores plain text in `front` and `back` columns. Adding media support unlocks the Anki power user migration path (Anki decks heavily use images) and enables future image occlusion (FL-010).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Quizlet | Yes | Free (images) / $35.99/yr (audio) | Image upload, text-to-speech audio, custom audio upload (premium). |
| Anki | Yes | Free | Full media: images, audio, video. Files stored in `collection.media/`. Referenced via `<img>` and `[sound:]` tags. |
| Brainscape | Yes | $79.99/yr | Images and audio in cards. Premium feature. |
| StudyFetch | Yes | $228/yr | AI-generated images for cards. Premium only. |

### Target User
Medical students studying anatomy (images), language learners needing pronunciation (audio), and Anki users migrating to MyFlash who expect their media-rich decks to work. Without this feature, any user with media in their Anki decks cannot migrate.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/media/                        -- NEW: media storage + types
modules/flash/src/media/types.ts                -- MediaFile, MediaType, MediaReference types
modules/flash/src/media/storage.ts              -- SHA256 dedup, resize, file management
modules/flash/src/media/audio-utils.ts          -- Audio duration extraction, format validation
modules/flash/src/media/index.ts                -- Barrel export
modules/flash/src/media/__tests__/              -- Tests
modules/flash/src/db/media.ts                   -- NEW: SQLite CRUD for media table
apps/mobile/app/(flash)/components/MediaToolbar.tsx   -- Media attachment toolbar
apps/mobile/app/(flash)/components/AudioRecorder.tsx  -- In-app audio recorder
apps/web/app/flash/components/MediaToolbar.tsx        -- Web media toolbar
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Decks tab -> Card Editor
            └── Media Toolbar (below content fields) ← YOU ARE HERE
```

### Data Model

One new table in migration V3:

```sql
CREATE TABLE IF NOT EXISTS fl_media (
  id TEXT PRIMARY KEY NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'audio')),
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  local_path TEXT NOT NULL,
  reference_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS fl_media_hash_idx ON fl_media(hash);
CREATE INDEX IF NOT EXISTS fl_media_type_idx ON fl_media(media_type);
```

Card content references media inline using Anki-compatible syntax:
- Images: `<img src="fl_media/hash.ext">`
- Audio: `[sound:hash.ext]`

### Dependencies
- **Internal:** `@mylife/db`, flash card CRUD, card editor UI
- **External:** `expo-image-picker` (mobile image selection), `expo-camera` (photo capture), `expo-av` (audio recording/playback), `expo-file-system` (file storage), `expo-crypto` (SHA256)
- **Cross-Module:** none (flash-internal)

## Functional Requirements

### User Stories
1. As a medical student, I want to add anatomical images to my flashcards so that I can study visual material alongside text.
2. As a language learner, I want to record audio pronunciation and attach it to vocabulary cards so that I practice listening.
3. As an Anki migrant, I want my existing media-rich cards to display correctly after import.

### Behavior Specification

1. User opens the card editor (new card or edit existing).
2. Below the front/back text fields, a media toolbar appears with two buttons: Image (camera icon) and Audio (microphone icon).
3. **Adding an image:**
   a. User taps the image button.
   b. Source picker appears: "Photo Library", "Camera", "Files".
   c. User selects/captures an image.
   d. Image is processed: SHA256 hash computed, resized if >2048px longest side, saved to `fl_media/` directory.
   e. If hash already exists (dedup), existing file is reused and `reference_count` incremented.
   f. Image thumbnail appears inline in the content field with an "X" delete button.
   g. An `<img src="fl_media/hash.ext">` tag is inserted into the card content.
4. **Adding audio:**
   a. User taps the audio button.
   b. Source picker appears: "Files" or "Record New".
   c. If "Record New": audio recorder modal opens with red record button, waveform, timer.
   d. User records, previews, and saves the clip.
   e. Audio is processed: SHA256 hash, saved to `fl_media/` directory.
   f. Audio widget appears inline (play button + filename + duration).
   g. A `[sound:hash.ext]` tag is inserted into the card content.
5. **During review:**
   a. Images render inline at card width (max 100% width, maintain aspect ratio).
   b. Audio clips show a play button. Tapping plays the audio.
   c. Audio auto-plays if the card is configured for auto-play (settings option).
6. **Deleting media:**
   a. User taps "X" on media item in editor.
   b. Media reference tag is removed from content.
   c. `reference_count` decremented on the `fl_media` record.
   d. Orphan cleanup: if `reference_count` reaches 0, file is deleted from disk.

### Edge Cases

- **Image exceeds 10MB:** Toast "Image exceeds 10MB limit. Choose a smaller image."
- **Audio exceeds 50MB:** Toast "Audio file too large. Maximum 50MB."
- **Unsupported format:** Toast "Format not supported. Use JPEG, PNG, GIF, WebP for images or MP3, M4A, WAV, OGG for audio."
- **Duplicate media (same hash):** Reuse existing file, increment reference_count. No duplicate storage.
- **Camera permission denied:** Alert with link to system settings.
- **Microphone permission denied:** Alert with link to system settings.
- **Storage full:** Alert "Not enough storage space."
- **Media file missing on disk but referenced in card:** Show placeholder "Image not found" / "Audio not found" with option to re-add.
- **Card deleted with media:** Decrement reference_count. Clean up orphans.
- **Very large image (4000x3000):** Resize to 2048x1536 before storage.
- **Long audio recording (>5 min):** Allow but show warning "Long recordings use more storage."
- **Cloze cards with media:** Media tags in the cloze template are preserved across all generated cards.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Card editor shows media toolbar with image and audio buttons.
- [ ] **AC-2:** Tapping image button shows source picker (Photo Library, Camera, Files).
- [ ] **AC-3:** Selected image appears as inline thumbnail in card content with "X" delete button.
- [ ] **AC-4:** Tapping audio button shows source picker (Files, Record New).
- [ ] **AC-5:** Audio recorder modal shows record button, waveform, timer, and preview/save/discard.
- [ ] **AC-6:** Audio clip appears as playback widget (play button + duration) in card content.
- [ ] **AC-7:** During review, images render inline at full card width maintaining aspect ratio.
- [ ] **AC-8:** During review, audio play button triggers audio playback.
- [ ] **AC-9:** Duplicate images (same content) are deduplicated by SHA256 hash.
- [ ] **AC-10:** Deleting media from a card decrements reference_count and cleans up orphans.
- [ ] **AC-11:** Images exceeding 2048px longest side are resized before storage.
- [ ] **AC-12:** Images exceeding 10MB are rejected with a user-friendly error.

### Technical Criteria
- [ ] **TC-1:** Migration V3 creates `fl_media` table with hash and type indexes.
- [ ] **TC-2:** Media files stored in device-local directory at `fl_media/{hash[0:2]}/{hash[2:4]}/{hash}.{ext}`.
- [ ] **TC-3:** SHA256 hash computed from file contents for deduplication.
- [ ] **TC-4:** Image resize uses max 2048px longest side, JPEG quality 85 for raster formats.
- [ ] **TC-5:** Card content uses Anki-compatible tags: `<img src="fl_media/hash.ext">` and `[sound:hash.ext]`.
- [ ] **TC-6:** Reference counting tracks how many cards use each media file.
- [ ] **TC-7:** Orphan cleanup runs on card deletion and app launch.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Media files must NOT be stored in the SQLite database (only metadata is stored; files are on disk).
- [ ] **NC-2:** Media must NOT be uploaded to any server. All storage is local.
- [ ] **NC-3:** Deleting a card must NOT delete media files that are referenced by other cards.
- [ ] **NC-4:** Media processing (resize, hash) must NOT block the UI thread.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Media toolbar: horizontal bar with glass background, below card content fields
- Image button: camera icon in `#FBBF24` (accent), Audio button: microphone icon
- Image thumbnail: rounded corners, 120px height, fit width, "X" overlay top-right
- Audio widget: glass card, play/pause circle button (`#FBBF24`), filename, duration text
- Audio recorder modal: full-screen, dark background, large red record button (64px), waveform visualization, timer
- Module accent: `#FBBF24`

### Web (Next.js)

- Same media toolbar in card editor
- Image sources: file picker only (no camera capture)
- Audio: file picker only (no in-app recording unless MediaRecorder API available)
- Drag-and-drop support for images into the card editor

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Media | Toolbar icons in default state, no thumbnails | New card or card with no media |
| Has Images | Image thumbnails inline, media count badge on toolbar | Image added to card |
| Has Audio | Audio widgets inline, media count badge | Audio added to card |
| Recording | Red indicator, waveform, timer, stop button | User tapped "Record New" |
| Processing | Spinner on media item | Image resizing or audio processing |
| Error | Toast with error message | Permission denied, file too large, unsupported format |

## Test Requirements

### Unit Tests
- [ ] `computeMediaHash`: identical files produce identical SHA256 hash
- [ ] `deduplicateMedia`: adding same image twice creates one file, reference_count = 2
- [ ] `decrementReference`: removing media from card decrements count to 1
- [ ] `orphanCleanup`: reference_count = 0 triggers file deletion
- [ ] `resizeImage`: 4000x3000 image resized to 2048x1536
- [ ] `rejectOversizedImage`: 11MB image returns error
- [ ] `rejectOversizedAudio`: 51MB audio returns error
- [ ] `rejectUnsupportedFormat`: .bmp image returns format error
- [ ] `extractAudioDuration`: MP3 file returns duration in milliseconds
- [ ] `insertMediaTag`: adds correct Anki-compatible tag to card content
- [ ] `removeMediaTag`: strips media tag from content on delete

### Integration Tests
- [ ] Full flow: add image to card -> save card -> review card -> image renders
- [ ] Dedup flow: add same image to 2 cards -> verify 1 file on disk -> delete one card -> file still exists

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyFlash > Decks > select a deck > Add Card
3. Verify: media toolbar visible below content fields -- corresponds to AC-1
4. Tap image button
5. Verify: source picker shows Photo Library, Camera, Files -- corresponds to AC-2
6. Select a photo from library
7. Verify: image thumbnail appears inline in front content -- corresponds to AC-3
8. Tap audio button
9. Verify: source picker shows Files, Record New -- corresponds to AC-4
10. Tap "Record New"
11. Verify: recorder opens with red record button and waveform -- corresponds to AC-5
12. Record 3 seconds, tap stop, tap save
13. Verify: audio widget appears with play button and "0:03" duration -- corresponds to AC-6
14. Save the card
15. Start a review session with this card
16. Verify: image renders inline in the card -- corresponds to AC-7
17. Tap audio play button
18. Verify: audio plays -- corresponds to AC-8
19. Add the same image to a different card
20. Verify: no duplicate file created on disk (check storage) -- corresponds to AC-9
21. Delete the first card
22. Verify: image still exists (referenced by second card) -- corresponds to NC-3
23. Open the app on web
24. Navigate to Flash > card editor
25. Verify: media toolbar with image button (file picker) works

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to card editor, add media, verify rendering in review

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- media storage architecture review before building

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Cards store plain text only in `front` and `back` TEXT columns. No media support exists.

### After This Work
A `fl_media` table tracks media files with SHA256 dedup. Card content can contain `<img>` and `[sound:]` tags. Media toolbar in card editor allows adding images and audio. Review UI renders media inline.

### Files Changed
- `modules/flash/src/db/schema.ts` -- add CREATE_MEDIA, CREATE_MEDIA_INDEXES
- `modules/flash/src/definition.ts` -- add FLASH_MIGRATION_V3 with media table, increment schemaVersion to 3
- `modules/flash/src/db/media.ts` -- media CRUD: create, getByHash, incrementRef, decrementRef, deleteOrphans
- `modules/flash/src/media/types.ts` -- MediaFile, MediaType, MediaReference types
- `modules/flash/src/media/storage.ts` -- addMedia, removeMedia, computeHash, resizeImage, cleanupOrphans
- `modules/flash/src/media/audio-utils.ts` -- extractDuration, validateAudioFormat
- `modules/flash/src/media/index.ts` -- barrel export
- `modules/flash/src/media/__tests__/storage.test.ts` -- 11+ unit tests
- `modules/flash/src/types.ts` -- add MediaFile Zod schema
- `modules/flash/src/index.ts` -- re-export media module
- `apps/mobile/app/(flash)/components/MediaToolbar.tsx` -- media attachment toolbar
- `apps/mobile/app/(flash)/components/AudioRecorder.tsx` -- audio recorder modal
- `apps/web/app/flash/components/MediaToolbar.tsx` -- web media toolbar

### Known Limitations
- No video support. Images and audio only.
- SVG images are stored as-is (no rasterization).
- In-app audio recording is mobile-only. Web uses file picker only.
- No text-to-speech integration (future feature).

### Context for Next Agent
- Media files are stored on disk, NOT in SQLite. Only metadata (hash, path, dimensions, duration) is in the `fl_media` table.
- Use Anki-compatible tags: `<img src="fl_media/hash.ext">` and `[sound:hash.ext]`. This ensures future .apkg import/export compatibility.
- The card content parsing regex for rendering should detect both `<img>` and `[sound:]` tags and replace them with platform-appropriate components (Image/AudioPlayer on mobile, `<img>`/`<audio>` on web).
- SHA256 hashing should use `expo-crypto` on mobile and `crypto.subtle` on web.
- The two-level directory structure (`hash[0:2]/hash[2:4]/hash.ext`) prevents filesystem performance issues with many files.
