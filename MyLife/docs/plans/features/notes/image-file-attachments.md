# Feature Spec: Image/File Attachments

## Metadata
- **Module:** notes
- **Priority Score:** 38 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** NT-001 (Markdown Editor -- implemented)
- **Blocks:** NT-OCR (OCR in Images depends on attachments existing)

## Business Context

### Why This Feature Exists
Image and file attachments are a core expectation for any modern note-taking app. Evernote built its entire business around "capture everything" -- photos of whiteboards, receipts, PDFs, scanned documents. Apple Notes includes inline image support in its free app. Notion supports images, files, videos, and embeds. MyNotes currently stores only plain text in the `body` column with no mechanism for binary attachments. Adding image/file attachments with local-only storage is critical for competitive parity and is a key migration driver: users switching from Evernote or Notion need to bring their images with them.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Notion | Yes | Free (5MB limit) | Inline images, file blocks, drag-and-drop, cloud storage. Premium raises limit. |
| Evernote | Yes | Free (60MB/mo) | Image attachments, PDF viewing, document scanning. Cloud-synced. Premium = 10GB/mo. |
| Apple Notes | Yes | Free | Inline images, document scanning, photo gallery. iCloud synced. |
| Obsidian | Yes | Free | Local file attachments in vault, `![[image.png]]` embed syntax. Sync is paid ($50/yr). |

### Target User
Users who capture visual information alongside text: whiteboard photos, meeting diagrams, receipts, screenshots, reference PDFs. Primary migration target: Evernote users paying $179.88/yr whose notes contain embedded images and documents. Also Apple Notes users who attach photos to notes.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/attachments/                    -- NEW: attachment management
modules/notes/src/attachments/types.ts            -- Attachment, AttachmentType types
modules/notes/src/attachments/manager.ts          -- File storage, thumbnails, size tracking
modules/notes/src/attachments/index.ts            -- Barrel export
modules/notes/src/attachments/__tests__/          -- Tests
modules/notes/src/db/attachments.ts               -- NEW: attachment CRUD
apps/mobile/app/(notes)/components/AttachmentBar.tsx     -- Attachment toolbar + inline display
apps/mobile/app/(notes)/components/ImageViewer.tsx       -- Full-screen image viewer
apps/web/app/notes/components/AttachmentBar.tsx          -- Web attachment UI
apps/web/app/notes/components/ImageViewer.tsx            -- Web image viewer
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab -> Note Editor
            └── Formatting toolbar
                 └── Paperclip/Image button ← YOU ARE HERE
            └── Note body
                 └── Inline images/file cards ← AND HERE
```

### Data Model

New table in migration V2:

```sql
CREATE TABLE IF NOT EXISTS nt_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES nt_notes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL,
  attachment_type TEXT NOT NULL DEFAULT 'image'
    CHECK (attachment_type IN ('image', 'pdf', 'file')),
  width INTEGER,
  height INTEGER,
  thumbnail_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS nt_attachments_note_idx ON nt_attachments(note_id, sort_order);
```

### Dependencies
- **Internal:** `@mylife/db`, notes CRUD, `expo-file-system` (mobile), `expo-image-picker` (mobile)
- **External:** `expo-image-picker` (camera/gallery), `expo-document-picker` (files), `expo-image-manipulator` (thumbnail generation)
- **Cross-Module:** Attachment infrastructure could be shared with journal (image_uris_json). OCR feature (NT-OCR) depends on this table existing.

## Functional Requirements

### User Stories
1. As a note-taker, I want to embed images inline in my notes so that visual references appear alongside my text.
2. As a student, I want to attach PDFs to my notes so that I can keep lecture slides with my lecture notes.
3. As a privacy-conscious user, I want all attachments stored locally on my device so that no files leave my phone.

### Behavior Specification

1. User opens the note editor.
2. Formatting toolbar shows an image/attach button (paperclip icon).
3. User taps the button:
   a. Action sheet appears: "Take Photo", "Choose from Library", "Attach File".
   b. "Take Photo": opens camera. Photo saved to app storage.
   c. "Choose from Library": opens image picker. Selected image copied to app storage.
   d. "Attach File": opens document picker. Selected file copied to app storage.
4. File is processed:
   a. Images: resized to max 2048px on longest edge (preserving aspect ratio), JPEG 80% quality. Thumbnail generated at 200px.
   b. PDFs: stored as-is. First page rendered as thumbnail.
   c. Other files: stored as-is. Generic file icon used as placeholder.
5. Attachment record created in `nt_attachments`.
6. Markdown reference inserted at cursor: `![filename](attachment://[id])` for images, `[filename](attachment://[id])` for files.
7. In editor/preview, `attachment://[id]` URLs resolve to local file paths for rendering.
8. Images render inline at note width (max) with tap-to-zoom.
9. PDFs and files render as compact cards: file icon + name + size.
10. User can tap an image to open full-screen viewer with pinch-to-zoom.
11. User can long-press an attachment to get options: "Share", "Save to Device", "Delete".
12. Deleting an attachment removes the file from disk, the `nt_attachments` row, and the markdown reference from the body.

### Edge Cases

- **Large file (>50MB):** Reject with toast "File is too large (max 50MB)."
- **Unsupported file type:** Accept and store, but display as generic file card.
- **Storage full:** Toast "Not enough storage space." Attachment not saved.
- **Image from camera fails:** Toast "Could not capture photo." No attachment created.
- **Note deleted:** CASCADE deletes `nt_attachments` rows. File cleanup runs to delete files from disk.
- **Attachment file missing from disk:** Show "File not found" placeholder. Do not crash.
- **Multiple attachments:** Notes can have unlimited attachments. List view shows attachment count badge.
- **Drag-and-drop (web):** Dropping an image or file onto the editor area triggers the attachment flow.
- **Copy-paste images (web):** Pasting an image from clipboard creates an attachment.
- **Markdown reference without attachment:** `![](attachment://nonexistent)` shows placeholder.
- **Same file attached twice:** Each gets its own copy and attachment record (no dedup by content).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Image/attach button appears in the note editor formatting toolbar.
- [ ] **AC-2:** Action sheet offers "Take Photo", "Choose from Library", "Attach File".
- [ ] **AC-3:** Selected images render inline in the note at full width.
- [ ] **AC-4:** Tapping an inline image opens full-screen viewer with pinch-to-zoom.
- [ ] **AC-5:** PDFs and files render as compact cards with file icon, name, and size.
- [ ] **AC-6:** Long-press on attachment shows "Share", "Save to Device", "Delete" options.
- [ ] **AC-7:** Deleting an attachment removes the inline reference, file from disk, and database row.
- [ ] **AC-8:** Note list shows attachment count badge for notes with attachments.
- [ ] **AC-9:** Images are resized to max 2048px before storage.
- [ ] **AC-10:** Drag-and-drop images onto the web editor creates attachments.

### Technical Criteria
- [ ] **TC-1:** Migration V2 creates `nt_attachments` table with all columns and indexes.
- [ ] **TC-2:** Images stored at `[app-data-dir]/nt_attachments/[note_id]/[attachment_id].[ext]`.
- [ ] **TC-3:** Thumbnails generated at 200px for images, first-page render for PDFs.
- [ ] **TC-4:** Attachment files stored locally -- no network transmission.
- [ ] **TC-5:** `attachment://[id]` URLs resolved to local file paths at render time.
- [ ] **TC-6:** Note deletion cascades to attachment rows and triggers file cleanup.
- [ ] **TC-7:** File size validated before storage (reject >50MB).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Attachment files must NEVER be transmitted over the network.
- [ ] **NC-2:** Deleting an attachment must NOT affect other attachments in the same note.
- [ ] **NC-3:** A missing attachment file must NOT crash the app or prevent the note from opening.
- [ ] **NC-4:** Attachment storage must NOT use the SQLite database for binary data (files go on disk).

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Attach button: paperclip icon in `#64748B` (accent), positioned in formatting toolbar
- Inline image: full-width, rounded corners (8px), 1px `rgba(255,255,255,0.06)` border
- Image loading: skeleton placeholder with pulse animation
- File card: glass card (`rgba(255,255,255,0.04)`), file-type icon (24px), filename (14px), size text (12px, textSecondary)
- Full-screen viewer: black background, pinch-to-zoom, close button top-right
- Attachment count badge: paperclip icon + count in textSecondary, in note list row
- Module accent: `#64748B`

### Web (Next.js)

- Route: existing note editor at `/notes/[id]`
- Drag-and-drop zone: entire editor area, shows dashed border on drag-over
- Paste from clipboard: auto-detects image data in paste event
- File card styling matches mobile
- Image viewer: modal overlay with zoom controls

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Attachments | Normal note, no attachment UI beyond toolbar button | No attachments in note |
| Uploading | Progress bar on attachment card | File being copied/resized |
| Image Loaded | Inline image at note width | Image attachment rendered |
| File Card | Compact card with icon, name, size | Non-image attachment |
| Missing File | "File not found" placeholder card | Attachment file deleted from disk |
| Full-Screen | Black background, zoomable image | User taps inline image |
| Drag Over (Web) | Dashed border on editor | User drags file over editor |

## Test Requirements

### Unit Tests
- [ ] `resizeImage`: 4000x3000 image -> resized to 2048x1536, JPEG 80%
- [ ] `resizeImage`: 1000x800 image -> no resize (already under max)
- [ ] `generateThumbnail`: creates 200px thumbnail
- [ ] `validateFileSize`: 51MB file -> rejected
- [ ] `validateFileSize`: 49MB file -> accepted
- [ ] `buildAttachmentPath`: note_id + attachment_id -> correct file path
- [ ] `resolveAttachmentUrl`: `attachment://abc123` -> local file path
- [ ] `cleanupAttachmentFiles`: deletes files for given note_id
- [ ] `insertAttachmentMarkdown`: image -> `![name](attachment://id)`, file -> `[name](attachment://id)`
- [ ] `removeAttachmentMarkdown`: removes markdown reference from body

### Integration Tests
- [ ] Full flow: attach image -> inline render -> save -> re-open -> image visible
- [ ] Delete flow: attach image -> delete attachment -> markdown reference removed, file deleted

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Notes tab
3. Create a new note
4. Tap the attachment button in the toolbar
5. Verify: action sheet with "Take Photo", "Choose from Library", "Attach File" -- corresponds to AC-1, AC-2
6. Choose "Choose from Library" and select an image
7. Verify: image renders inline in the note -- corresponds to AC-3
8. Tap the inline image
9. Verify: full-screen viewer opens with pinch-to-zoom -- corresponds to AC-4
10. Close viewer, tap attachment button again
11. Choose "Attach File" and select a PDF
12. Verify: PDF renders as compact card with icon, name, size -- corresponds to AC-5
13. Long-press the image attachment
14. Verify: "Share", "Save to Device", "Delete" options shown -- corresponds to AC-6
15. Tap "Delete"
16. Verify: image removed from note, file deleted -- corresponds to AC-7
17. Go back to note list
18. Verify: attachment count badge visible for notes with attachments -- corresponds to AC-8
19. Open the app on web
20. Drag an image file onto the note editor
21. Verify: image attached and rendered inline -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to note editor, attach image, verify inline rendering and viewer

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Notes store only text in the `body` column. No mechanism for binary attachments. No image embedding. The SPEC mentions image/file support but nothing is implemented.

### After This Work
`nt_attachments` table stores attachment metadata. Files stored on disk at `[app-data-dir]/nt_attachments/[note_id]/`. Images render inline via `attachment://[id]` URL scheme. Full-screen image viewer with zoom. File cards for non-image attachments. Note deletion cascades to file cleanup.

### Files Changed
- `modules/notes/src/db/schema.ts` -- add CREATE_ATTACHMENTS table and index
- `modules/notes/src/definition.ts` -- add NOTES_MIGRATION_V2 with attachment table, increment schemaVersion to 2
- `modules/notes/src/attachments/types.ts` -- Attachment, AttachmentType types
- `modules/notes/src/attachments/manager.ts` -- resizeImage, generateThumbnail, buildAttachmentPath, cleanupAttachmentFiles
- `modules/notes/src/attachments/index.ts` -- barrel export
- `modules/notes/src/attachments/__tests__/manager.test.ts` -- 10+ unit tests
- `modules/notes/src/db/attachments.ts` -- attachment CRUD (create, list, delete, getByNoteId)
- `modules/notes/src/types.ts` -- add AttachmentSchema, AttachmentType
- `modules/notes/src/index.ts` -- re-export attachment module
- `apps/mobile/app/(notes)/components/AttachmentBar.tsx` -- attachment toolbar + inline display
- `apps/mobile/app/(notes)/components/ImageViewer.tsx` -- full-screen image viewer
- `apps/web/app/notes/components/AttachmentBar.tsx` -- web attachment UI
- `apps/web/app/notes/components/ImageViewer.tsx` -- web image viewer

### Known Limitations
- No image annotation or markup (drawing on images).
- No image cropping or editing after attachment.
- No cloud sync for attachments (local-only by design).
- No video playback (video files stored as generic file attachments).
- No content deduplication (same image attached twice = two copies on disk).

### Context for Next Agent
- Attachment files go on disk, NOT in SQLite. Only metadata (path, size, mime type) goes in the database.
- The `attachment://[id]` URL scheme is a custom protocol resolved at render time. The renderer maps it to the local file path from `nt_attachments.file_path`.
- For `expo-image-picker`, use `launchImageLibraryAsync` with `mediaTypes: Images` and `allowsEditing: false`.
- For `expo-document-picker`, use `getDocumentAsync` with `copyToCacheDirectory: true`, then move to permanent storage.
- Image resize uses `expo-image-manipulator`: `manipulateAsync(uri, [{ resize: { width: 2048 } }], { compress: 0.8, format: SaveFormat.JPEG })`.
- CASCADE delete on `nt_attachments` handles DB cleanup, but file cleanup requires explicit disk deletion. Add cleanup logic to the note delete path.
- The OCR feature (NT-OCR) will extend this table with `ocr_text` and `ocr_status` columns in a later migration.
