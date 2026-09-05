# Feature Spec: Attachments

## Metadata
- **Module:** mail
- **Priority Score:** 29 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [5] x3 + Complexity [2] x2 + CrossModule [1] x1 + PaidUser [0] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (V1 schema already has messages table)
- **Blocks:** Encryption (encrypted attachments depend on attachment storage)

## Business Context

### Why This Feature Exists
Email without attachments is not email. Every email client since the 1990s supports file attachments. Users cannot meaningfully use MyMail without the ability to send and receive files. This is a table-stakes feature that gates adoption by any serious email user. Without attachments, MyMail is a read-only message viewer, not a mail client.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Yes | No (15 GB storage free) | Inline display for images/PDFs, Google Drive integration for large files, 25 MB per-message limit |
| Outlook | Yes | No (15 GB free) | OneDrive integration for large files, inline preview for Office docs, 20 MB limit |
| Superhuman | Yes | Yes ($30/mo) | Instant attachment search, attachment previews, 25 MB limit |
| Spark | Yes | No | Standard attachment support, cloud file picker, 25 MB limit |
| ProtonMail | Yes | No (500 MB free) | End-to-end encrypted attachments, 25 MB limit |

### Target User
Any email user migrating from Gmail, Outlook, or another client. Attachments are so fundamental that their absence would disqualify MyMail from consideration. The target is every single MyMail user.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- New Zod schemas: MailAttachment, CreateAttachmentInput
  db/schema.ts                        -- V2 migration: ml_attachments table
  db/crud.ts                          -- New attachment CRUD: create, get, list by message, delete
  engine/attachments.ts               -- NEW: file type detection, size validation, MIME mapping

apps/mobile/app/(mail)/
  components/AttachmentPicker.tsx      -- NEW: file picker (expo-document-picker + expo-image-picker)
  components/AttachmentPreview.tsx     -- NEW: inline preview for images/PDFs, download button for others
  components/AttachmentBadge.tsx       -- NEW: attachment indicator on message list items

apps/web/app/mail/
  components/AttachmentPicker.tsx      -- NEW: drag-and-drop + file input
  components/AttachmentPreview.tsx     -- NEW: inline preview with download
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Compose Message
            └── Attachment Picker (bottom toolbar button) ← YOU ARE HERE
       └── Message Detail
            └── Attachment List (below message body) ← AND HERE
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS ml_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES ml_messages(id) ON DELETE CASCADE,
  draft_id TEXT REFERENCES ml_drafts(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  local_path TEXT,
  is_inline INTEGER NOT NULL DEFAULT 0,
  content_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ml_attachments_message_idx ON ml_attachments(message_id);
CREATE INDEX IF NOT EXISTS ml_attachments_draft_idx ON ml_attachments(draft_id);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (file size formatting)
- **External:** `expo-document-picker` (mobile file selection), `expo-image-picker` (mobile photo selection), `expo-file-system` (mobile file storage)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a mail user, I want to attach files to outgoing messages so that I can share documents and images.
2. As a mail user, I want to view and download attachments on received messages so that I can access shared files.
3. As a mail user, I want to see attachment indicators in the message list so that I can quickly identify messages with files.
4. As a mail user, I want to preview images and PDFs inline so that I don't have to download every file.

### Behavior Specification

1. User opens compose screen and taps the attachment icon in the bottom toolbar
2. System shows picker with options: "Document" (opens file picker) or "Photo" (opens image picker)
3. User selects a file. System validates size (max 25 MB per file, max 50 MB total per message)
4. File is saved to local storage with a unique name. An `ml_attachments` row is created linked to the draft
5. Compose screen shows attachment chips below the body field with filename, size, and a remove button
6. User can add multiple attachments. Each appears as a chip
7. When message is sent, attachments are included in the IMAP MIME multipart payload
8. On received messages, attachment list appears below the message body
9. Tapping an image attachment shows inline preview (full-width, max 300px height)
10. Tapping a PDF shows a preview modal (on mobile via expo-sharing, on web via iframe)
11. Tapping any other file type triggers download to device
12. Message list items show a paperclip icon badge if the message has one or more attachments

### Edge Cases

- File exceeds 25 MB limit: show error toast "File too large (max 25 MB)" and do not attach
- Total attachments exceed 50 MB: show error toast "Total attachment size exceeds 50 MB"
- File type is blocked (.exe, .bat, .cmd, .scr): show error toast "This file type is not allowed"
- User removes attachment mid-compose: delete from local storage and ml_attachments row
- User discards draft with attachments: cascade delete removes attachment rows, cleanup job removes local files
- Network drops during attachment download: show retry button with partial download indicator
- Inline image has no MIME type: fall back to generic file icon with download button
- Message has 20+ attachments: show first 5 inline, "Show all (N)" expandable section
- Zero-byte file: reject with "Empty file cannot be attached"
- Duplicate filename: append " (2)", " (3)" suffix

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping attach icon shows Document/Photo picker options
- [ ] **AC-2:** Selected file appears as a removable chip below compose body
- [ ] **AC-3:** Attachment chip shows filename and human-readable size (e.g., "report.pdf - 2.3 MB")
- [ ] **AC-4:** Message list shows paperclip icon on messages with attachments
- [ ] **AC-5:** Message detail shows attachment list below body with filename, size, and download button
- [ ] **AC-6:** Image attachments render inline preview in message detail
- [ ] **AC-7:** Tapping download on a non-image attachment saves to device / triggers browser download
- [ ] **AC-8:** Multiple attachments can be added to a single message

### Technical Criteria
- [ ] **TC-1:** ml_attachments table created in V2 migration with correct indexes
- [ ] **TC-2:** Attachment metadata persisted to SQLite on file selection
- [ ] **TC-3:** Cascade delete removes attachments when message or draft is deleted
- [ ] **TC-4:** File size validation enforced before storage (25 MB per file, 50 MB per message)
- [ ] **TC-5:** Blocked file extensions (.exe, .bat, .cmd, .scr) rejected at picker level
- [ ] **TC-6:** Local file storage uses unique filenames to prevent collisions
- [ ] **TC-7:** Attachment CRUD operations complete in < 50ms

### Negative Criteria
- [ ] **NC-1:** Attachment file data must NOT be stored in SQLite (only metadata and local path)
- [ ] **NC-2:** Blocked file types must NOT bypass validation regardless of renamed extension
- [ ] **NC-3:** Orphaned local files must NOT accumulate after draft/message deletion

## UI Specification

### Mobile (Expo)
- Attachment button: icon in compose toolbar row (paperclip icon), `#3B82F6` accent
- Attachment chips: `rgba(255,255,255,0.04)` glass background, `rgba(255,255,255,0.10)` border, filename truncated at 24 chars with ellipsis
- Inline image preview: full-width, max 300px height, rounded corners (8px), `#0A0A0F` background
- Download button: `#3B82F6` text, arrow-down icon
- Size text: `rgba(240,240,245,0.65)` secondary text

### Web (Next.js)
- Drag-and-drop zone: dashed border `rgba(255,255,255,0.10)`, "Drop files here" text, highlights on drag-over with `rgba(59,130,246,0.1)` background
- File input as fallback button: "Attach files" with paperclip icon
- Same chip and preview patterns as mobile via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Spinner on attachment chip while file copies to local storage | File selected |
| Empty | No attachments section visible (compose: no chips, detail: no attachment list) | No attachments |
| Error | Toast: "File too large" / "File type not allowed" / "Download failed" | Validation failure |
| Success | Chip with filename + size (compose) or preview + download (detail) | File attached/loaded |
| Partial | Some attachments loaded, others showing spinner | Multiple files, mixed states |

## Test Requirements

### Unit Tests
- [ ] `createAttachment`: persists metadata to ml_attachments
- [ ] `getAttachmentsByMessage`: returns all attachments for a message ID
- [ ] `deleteAttachment`: removes row and returns true
- [ ] `validateFileSize`: rejects files > 25 MB, accepts files <= 25 MB
- [ ] `validateTotalSize`: rejects when cumulative > 50 MB
- [ ] `validateFileType`: blocks .exe/.bat/.cmd/.scr, allows .pdf/.jpg/.png/.docx
- [ ] `getMimeType`: maps common extensions to MIME types correctly
- [ ] `formatFileSize`: returns human-readable sizes (bytes, KB, MB)
- [ ] Cascade: deleting a message removes its attachment rows

### Integration Tests
- [ ] Full flow: compose -> attach file -> send -> verify attachment persisted with message
- [ ] Remove flow: attach -> remove chip -> verify ml_attachments row deleted and local file cleaned
- [ ] Download flow: open message with attachment -> tap download -> verify file saved

### QA Verification Script

1. Open MyMail on mobile
2. Tap Compose
3. Tap attachment (paperclip) icon
4. Select "Document" and pick a PDF under 25 MB
5. Verify: chip appears with filename and size -- corresponds to AC-2, AC-3
6. Select "Photo" and pick an image
7. Verify: second chip appears -- corresponds to AC-8
8. Tap X on first chip
9. Verify: chip removed, only image chip remains
10. Send the message
11. Navigate to Sent folder
12. Open the sent message
13. Verify: attachment list shows the image with inline preview -- corresponds to AC-5, AC-6
14. Try attaching a 30 MB file
15. Verify: error toast "File too large (max 25 MB)" -- corresponds to TC-4
16. Try attaching a .exe file
17. Verify: error toast "This file type is not allowed" -- corresponds to TC-5
18. Open a received message with attachments
19. Verify: paperclip icon visible in message list -- corresponds to AC-4
20. Tap download on a .docx attachment
21. Verify: file downloads to device -- corresponds to AC-7

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to compose and message detail, verify attachment picker and preview
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
Mail module has V1 schema with 4 tables (accounts, messages, drafts, folders). Messages have no attachment support. Compose screen has no file picker. Message detail has no attachment display.

### After This Work
V2 migration adds ml_attachments table. Compose screen has attachment picker with validation. Message detail shows inline previews for images, download for other files. Message list shows paperclip badge.

### Files Changed
- `modules/mail/src/types.ts` -- Added MailAttachment schema, CreateAttachmentInput, file validation types
- `modules/mail/src/db/schema.ts` -- Added ml_attachments CREATE TABLE + indexes
- `modules/mail/src/db/crud.ts` -- Added attachment CRUD (create, getByMessage, delete)
- `modules/mail/src/engine/attachments.ts` -- NEW: file validation, MIME detection, size formatting
- `modules/mail/src/definition.ts` -- V2 migration entry
- `apps/mobile/app/(mail)/components/AttachmentPicker.tsx` -- NEW
- `apps/mobile/app/(mail)/components/AttachmentPreview.tsx` -- NEW
- `apps/mobile/app/(mail)/components/AttachmentBadge.tsx` -- NEW
- `apps/web/app/mail/components/AttachmentPicker.tsx` -- NEW
- `apps/web/app/mail/components/AttachmentPreview.tsx` -- NEW

### Known Limitations
- No cloud storage integration (Google Drive, iCloud). Files stored locally only.
- No attachment search (searching by attachment filename or type is a future feature).
- No virus/malware scanning beyond extension blocking.

### Context for Next Agent
The ml_attachments table uses `message_id` and optional `draft_id` foreign keys. When implementing Encryption, encrypted attachments should encrypt the local file referenced by `local_path` and store the encrypted version, not the original. The `content_id` field is for inline CID references in HTML emails.
