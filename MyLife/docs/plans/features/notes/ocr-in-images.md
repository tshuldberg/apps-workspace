# Feature Spec: OCR in Images

## Metadata
- **Module:** notes
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Image/File Attachments (nt_attachments table must exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Evernote's OCR-powered image search is one of its most compelling features and a core reason users pay $179.88/yr. Users photograph whiteboards, receipts, handwritten notes, business cards, and documents -- then search for text within those images later. "I know I took a photo of that whiteboard -- let me search for 'Q3 roadmap'" is the killer use case. Apple Notes has document scanning with OCR built in. MyNotes can offer on-device OCR that keeps all extracted text local, never sending image data to cloud processing services. This is a privacy-first alternative to Evernote's cloud-based OCR.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Evernote | Yes | Premium | Cloud-based OCR on all image attachments. Text searchable across all notes. Premium feature for PDFs. |
| Apple Notes | Yes | Free | On-device OCR via Vision framework. Document scanning. Live Text in iOS 15+. |
| Notion | No | N/A | No OCR. Images are not searchable by content. |
| Obsidian | No | N/A | No OCR. Community plugin (Text Extractor) uses Tesseract. |
| Google Keep | Yes | Free | Cloud-based OCR. "Grab image text" feature. |

### Target User
Users who capture visual information: whiteboard photos, receipts, handwritten notes, business cards, menus, signs, documents. Primary migration target: Evernote users who rely on image search to find content across thousands of image-heavy notes.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/ocr/                            -- NEW: OCR engine
modules/notes/src/ocr/types.ts                    -- OcrResult, OcrStatus types
modules/notes/src/ocr/recognizer.ts               -- On-device text recognition interface
modules/notes/src/ocr/index.ts                    -- Barrel export
modules/notes/src/ocr/__tests__/                  -- Tests
apps/mobile/app/(notes)/components/OcrOverlay.tsx  -- Mobile OCR text overlay on images
apps/web/app/notes/components/OcrOverlay.tsx       -- Web OCR overlay
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab -> Note Editor
            └── Image attachment
                 └── "Extract Text" button ← YOU ARE HERE
       └── Search tab
            └── Search results include image text ← AND HERE
```

### Data Model

Extend `nt_attachments` table in migration V2 (or V3 if attachments are in V2):

```sql
ALTER TABLE nt_attachments ADD COLUMN ocr_text TEXT;
ALTER TABLE nt_attachments ADD COLUMN ocr_status TEXT DEFAULT 'none'
  CHECK (ocr_status IN ('none', 'processing', 'complete', 'failed', 'skipped'));
ALTER TABLE nt_attachments ADD COLUMN ocr_language TEXT DEFAULT 'en';
```

Update FTS5 to include OCR text:

```sql
-- Rebuild FTS to include attachment OCR text
-- (Alternative: separate FTS table for attachment text)
CREATE VIRTUAL TABLE IF NOT EXISTS nt_attachments_fts USING fts5(
  ocr_text,
  content='nt_attachments',
  content_rowid='rowid'
);
```

### Dependencies
- **Internal:** `@mylife/db`, attachments module (`nt_attachments`), FTS search infrastructure
- **External:** On-device OCR engine. iOS: Vision framework (`VNRecognizeTextRequest`). Android: ML Kit Text Recognition. Web: Tesseract.js (WASM-based, runs in browser).
- **Cross-Module:** OCR text feeds into cross-module search via `crossModule.getSearchableContent()`.

## Functional Requirements

### User Stories
1. As a user with image attachments, I want text in my images automatically extracted so that I can search for text in photos.
2. As a whiteboard photographer, I want to see the extracted text overlay on my images so that I can verify OCR accuracy.
3. As a privacy-conscious user, I want OCR processing done entirely on my device so that my image content never leaves my phone.

### Behavior Specification

1. User attaches an image to a note (via the attachments feature).
2. OCR processing triggers automatically (if enabled in settings):
   a. `ocr_status` set to `processing`.
   b. Image sent to on-device text recognition engine.
   c. Extracted text stored in `ocr_text` column.
   d. `ocr_status` set to `complete` (or `failed` if recognition fails).
   e. FTS index updated to include the extracted text.
3. User can also manually trigger OCR:
   a. Long-press an image attachment -> "Extract Text".
   b. Useful if auto-OCR is disabled or if the image was attached before OCR was enabled.
4. Extracted text is searchable:
   a. FTS search (`searchNotes`) now also searches `ocr_text` in attachments.
   b. Search results show which image matched and highlight the matched text.
5. OCR text overlay:
   a. When viewing an image, user can tap "Show Text" to see the extracted text overlaid on the image (bounding boxes around recognized text regions).
   b. User can tap a text region to copy that specific text.
6. "Copy All Text" button copies the entire OCR result to clipboard.
7. Settings:
   a. Auto-OCR toggle (default: on).
   b. OCR language (default: device language, options: en, es, fr, de, zh, ja, ko, pt, it, ru).

### Edge Cases

- **Image with no text:** OCR returns empty string. `ocr_status = 'complete'`, `ocr_text = ''`.
- **Handwritten text:** Recognition quality varies. On-device engines handle print handwriting well, cursive poorly. No guarantee of accuracy.
- **Rotated or skewed text:** Modern OCR engines handle rotation. Results may be partial for extreme angles.
- **Very large image:** OCR may take several seconds. Processing is async and non-blocking.
- **Non-image attachment:** OCR skipped for PDFs and files. `ocr_status = 'skipped'`.
- **OCR for PDFs:** Deferred. PDF OCR requires page-by-page rendering + recognition.
- **Multiple languages in one image:** Use the configured language. Multi-language detection is a future enhancement.
- **OCR on previously attached images:** Manual trigger available. No retroactive auto-processing unless user initiates.
- **Device doesn't support on-device OCR:** Web uses Tesseract.js. Show fallback message if neither is available.
- **Auto-OCR disabled:** No automatic processing. "Extract Text" button available for manual trigger.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Images with text are automatically OCR-processed when attached (if auto-OCR enabled).
- [ ] **AC-2:** OCR processing indicator shown during text extraction.
- [ ] **AC-3:** Extracted text searchable via the Notes search.
- [ ] **AC-4:** Search results highlight which image matched and the matched text.
- [ ] **AC-5:** "Show Text" overlay displays recognized text regions on the image.
- [ ] **AC-6:** Tapping a text region in overlay copies that text.
- [ ] **AC-7:** "Copy All Text" copies entire OCR result.
- [ ] **AC-8:** Manual "Extract Text" trigger via long-press on image.
- [ ] **AC-9:** OCR settings: auto-OCR toggle, language selection.
- [ ] **AC-10:** Non-image attachments are skipped (no OCR attempt).

### Technical Criteria
- [ ] **TC-1:** Migration adds ocr_text, ocr_status, ocr_language columns to nt_attachments.
- [ ] **TC-2:** OCR processing uses on-device engine exclusively (Vision on iOS, ML Kit on Android, Tesseract.js on web).
- [ ] **TC-3:** FTS index includes OCR text for searchability.
- [ ] **TC-4:** OCR processing is async and non-blocking.
- [ ] **TC-5:** OCR text includes bounding box coordinates for overlay rendering (stored in ocr_text as structured JSON or alongside plain text).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Image data must NEVER be sent to a cloud OCR service.
- [ ] **NC-2:** OCR processing must NOT block the note editor or image viewing.
- [ ] **NC-3:** Failed OCR must NOT prevent the image from being viewed or the note from being saved.
- [ ] **NC-4:** OCR must NOT run on non-image attachments (PDFs, files).

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- OCR processing indicator: small spinner badge on image corner during processing
- "Show Text" button: glass pill button overlaid on image, `#64748B` accent
- Text overlay: semi-transparent boxes around recognized text, `rgba(100,116,139,0.3)` fill, `#64748B` border
- Tapped text region: highlighted in `#64748B`, copied text toast
- "Copy All Text" button: below image, full-width, subtle glass style
- Search result with OCR match: image thumbnail + highlighted OCR text snippet
- Module accent: `#64748B`

### Web (Next.js)

- Same overlay UI on image viewer
- Tesseract.js WASM worker for OCR processing
- Progress bar during processing (Tesseract provides progress events)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No OCR | Image without text overlay or search indexing | Auto-OCR disabled, no manual trigger |
| Processing | Spinner badge on image corner | OCR running |
| Complete | "Show Text" button available, text searchable | OCR succeeded |
| Failed | Small warning icon on image | OCR engine error |
| Overlay | Text bounding boxes on image | User taps "Show Text" |
| Skipped | No OCR indicator | Non-image attachment |

## Test Requirements

### Unit Tests
- [ ] `processOcr`: image with text -> returns extracted text string
- [ ] `processOcr`: image without text -> returns empty string, status complete
- [ ] `processOcr`: non-image file -> returns status skipped
- [ ] `updateOcrStatus`: sets status and text on attachment record
- [ ] `searchWithOcr`: search query matches ocr_text -> returns attachment's note
- [ ] `getOcrLanguages`: returns list of supported language codes
- [ ] `shouldAutoOcr`: auto-OCR enabled + image attachment -> true
- [ ] `shouldAutoOcr`: auto-OCR disabled -> false
- [ ] `shouldAutoOcr`: PDF attachment -> false

### Integration Tests
- [ ] Full flow: attach image with text -> auto-OCR processes -> search for text in image -> note found in results
- [ ] Manual flow: attach image with auto-OCR off -> long-press "Extract Text" -> text extracted -> searchable

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Settings
3. Verify: Auto-OCR toggle and language setting -- corresponds to AC-9
4. Enable Auto-OCR
5. Create a new note
6. Attach an image containing text (e.g., photo of a book page)
7. Verify: processing indicator shown -- corresponds to AC-2
8. Wait for processing to complete
9. Navigate to Search tab
10. Search for a word visible in the image
11. Verify: note appears in search results with image highlight -- corresponds to AC-3, AC-4
12. Open the note, view the image
13. Tap "Show Text"
14. Verify: text overlay with bounding boxes -- corresponds to AC-5
15. Tap a text region
16. Verify: text copied -- corresponds to AC-6
17. Tap "Copy All Text"
18. Verify: all OCR text copied to clipboard -- corresponds to AC-7
19. Disable Auto-OCR
20. Attach another image
21. Long-press the image
22. Verify: "Extract Text" option available -- corresponds to AC-8
23. Verify: PDF attachment shows no OCR option -- corresponds to AC-10
24. Open the app on web
25. Verify: same OCR functionality with Tesseract.js

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to note with image, verify OCR overlay and search

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Image attachments are stored and displayed but contain no searchable text content. Users cannot find notes by searching for text visible in their images. No OCR capability exists.

### After This Work
On-device OCR extracts text from image attachments automatically (or manually). Extracted text stored in `nt_attachments.ocr_text` and indexed via FTS. Search results include OCR matches. Text overlay visualizes recognized regions on images.

### Files Changed
- `modules/notes/src/db/schema.ts` -- ALTER TABLE for ocr_text, ocr_status, ocr_language on nt_attachments + FTS table
- `modules/notes/src/definition.ts` -- add OCR columns to migration
- `modules/notes/src/ocr/types.ts` -- OcrResult, OcrStatus, OcrLanguage types
- `modules/notes/src/ocr/recognizer.ts` -- processOcr (platform-specific: Vision/ML Kit/Tesseract.js)
- `modules/notes/src/ocr/index.ts` -- barrel export
- `modules/notes/src/ocr/__tests__/recognizer.test.ts` -- 9+ unit tests
- `modules/notes/src/db/crud.ts` -- extend searchNotes to include OCR text matches
- `modules/notes/src/types.ts` -- extend AttachmentSchema with OCR fields
- `modules/notes/src/index.ts` -- re-export OCR module
- `apps/mobile/app/(notes)/components/OcrOverlay.tsx` -- text overlay component
- `apps/web/app/notes/components/OcrOverlay.tsx` -- web overlay

### Known Limitations
- No PDF OCR (requires page-by-page rendering + recognition, deferred).
- Handwriting recognition quality varies by device and handwriting style.
- No multi-language detection in a single image.
- Bounding box accuracy depends on the OCR engine.
- Tesseract.js (web) is slower than native Vision/ML Kit.
- No OCR for video frames or audio transcription.

### Context for Next Agent
- iOS: Use `VNRecognizeTextRequest` from the Vision framework with `.accurate` recognition level. Set `recognitionLanguages` to the configured language. This runs on-device with no network.
- Android: Use ML Kit Text Recognition (`com.google.mlkit:text-recognition`). The on-device model supports Latin scripts; additional language models can be downloaded.
- Web: Use `tesseract.js` v5 with WASM worker. Load language data files from the app bundle (not CDN) for privacy. Provides progress events.
- The `ocr_text` column stores plain text for searchability. Bounding box data can be stored in a separate JSON field or as structured data within `ocr_text` (recommend a separate `ocr_regions_json` column if precise overlay is needed).
- Extend `searchNotes` to JOIN on `nt_attachments` and MATCH against `nt_attachments_fts` when the search query doesn't match `nt_notes_fts`.
- This feature depends on the Image/File Attachments feature -- the `nt_attachments` table must exist before OCR columns are added.
