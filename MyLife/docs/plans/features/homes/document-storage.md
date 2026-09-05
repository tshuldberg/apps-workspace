# Feature Spec: Document Storage

## Metadata
- **Module:** homes
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 7
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Maintenance schedule reminders (A-tier, done)
- **Blocks:** Home inventory (B-tier, Sprint 8)

## Business Context

### Why This Feature Exists
Homeowners accumulate dozens of critical documents (deeds, insurance policies, warranties, permits, appliance manuals) that are scattered across filing cabinets, email attachments, and random phone photos. When a pipe bursts or an insurance claim is needed, finding the right document under pressure is stressful and slow. Centriq ($32/yr) built their entire product around organizing home documents per appliance. HomeZada ($59-99/yr) offers a full document vault. By adding document storage to MyHomes alongside the existing maintenance reminders, users get a single privacy-first hub for all home management. The expiry tracking sub-feature (insurance renewals, warranty expirations, permit deadlines) adds proactive value beyond simple storage.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| HomeZada | Yes | Yes ($59-99/yr) | Cloud document vault with folders per property, unlimited uploads, tagging, search, shareable with contractors. Requires account. |
| Centriq | Yes | Yes ($32/yr) | Document storage tied to appliances/products via barcode scan. Warranty tracking, how-to guide linking. Cloud-backed. |
| Thumbtack | No | N/A | No document management. Contractor marketplace only. |
| Angi | No | N/A | No document management. Tips and contractor directory only. |

### Target User
Homeowners (30-65) who store home documents in disorganized folders, shoe boxes, or scattered across email. Users of Centriq ($32/yr) who want document storage without cloud dependency. First-time homebuyers overwhelmed by closing documents (deed, title insurance, survey, HOA docs) who want a single place to store everything. Landlords managing documents across multiple rental properties. The privacy-first angle (all files stored on-device, never uploaded) is a strong differentiator vs. HomeZada and Centriq, both of which require cloud accounts.

## Technical Context

### Where This Lives in MyLife

```
modules/homes/src/
  types.ts                                  -- New Zod schemas: Document, DocumentCategory, DocumentStats
  db/schema.ts                              -- New table: hm_documents + indexes
  db/crud.ts                                -- New CRUD: document create/read/update/delete, search, expiry queries
  engines/document-engine.ts                -- NEW: getDocumentsByProperty, getExpiringDocuments, searchDocuments, getDocumentStats
  definition.ts                             -- Migration v3 (or v4 if cost-tracking lands first)
  __tests__/document-engine.test.ts         -- NEW: unit tests for document engine

apps/mobile/app/(homes)/
  documents.tsx                             -- NEW: Document list screen (per property)
  add-document.tsx                          -- NEW: Add/Edit document form (photo/PDF capture)
  document-detail.tsx                       -- NEW: Document detail/viewer

apps/web/app/homes/
  documents/page.tsx                        -- NEW: Document management web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHomes card
       ├── Search tab (existing)
       ├── Saved tab (existing)
       ├── Properties tab (existing)
       │    └── Property Detail
       │         ├── Maintenance section (existing)
       │         └── Documents section ← NEW (YOU ARE HERE)
       │              ├── Document cards by category
       │              ├── Expiring documents alert banner
       │              └── "Add Document" button
       └── Reminders tab (existing)
```

Documents are accessed from:
1. Property detail screen's "Documents" section (primary entry point)
2. A standalone "Documents" screen accessible from the property detail (for full-screen document browsing)
3. Maintenance schedule detail screen's "Attach Document" action (e.g., linking an appliance manual to a schedule)

### Data Model

```sql
-- New table: hm_documents (Migration v3 or v4)
CREATE TABLE IF NOT EXISTS hm_documents (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',           -- deed, warranty, insurance, permit, receipt, manual, contract, other
    file_uri TEXT NOT NULL,                            -- local file path (on-device storage)
    file_type TEXT NOT NULL DEFAULT 'image',           -- pdf, image, other
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    expiry_date TEXT,                                  -- ISO date string, nullable (not all docs expire)
    notes TEXT,
    tags TEXT,                                         -- comma-separated tags for searchability
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS hm_documents_property_idx
    ON hm_documents(property_id);
CREATE INDEX IF NOT EXISTS hm_documents_category_idx
    ON hm_documents(category);
CREATE INDEX IF NOT EXISTS hm_documents_expiry_idx
    ON hm_documents(expiry_date ASC);
```

**category enum values:** `deed`, `warranty`, `insurance`, `permit`, `receipt`, `manual`, `contract`, `other`

**file_type enum values:** `pdf`, `image`, `other`

**tags:** Stored as a comma-separated string in SQLite. Parsed into an array in the application layer. Enables lightweight search without FTS5 overhead. Example: "closing,2024,first-mortgage".

**expiry_date:** Nullable. Documents like deeds never expire. Insurance policies, warranties, and permits have expiry dates that the app proactively tracks.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type)
- **External:** `expo-image-picker` (photo capture on mobile), `expo-document-picker` (PDF file selection on mobile), `expo-file-system` (file storage and management), `zod` (schema validation). No external APIs required.
- **Cross-Module:** Loose link to home inventory (B-tier, Sprint 8). Inventory items can optionally reference a document_id FK for warranty/manual linking. This cross-reference is wired in the inventory spec, not here.

## Functional Requirements

### User Stories
1. As a homeowner, I want to photograph my deed, insurance policy, and warranties and store them organized by property, so I can find critical documents instantly when needed.
2. As a homeowner, I want to import PDF documents (closing docs, permits, contracts) from my phone's file system, so I don't have to re-photograph printed documents.
3. As a homeowner, I want to track expiry dates on insurance policies, warranties, and permits, so I get alerted before they lapse.
4. As a homeowner, I want to search my documents by title, category, or tag, so I can quickly find what I need.
5. As a multi-property owner, I want documents organized per property, so I can manage paperwork for each home separately.
6. As a homeowner, I want to attach a document (e.g., appliance manual) to a maintenance schedule, so relevant reference material is one tap away when a task is due.
7. As a privacy-first user, I want all documents stored on-device only, never uploaded to any server.

### Behavior Specification

**Adding a document (photo capture):**
1. User navigates to Property Detail > Documents section.
2. User taps "Add Document".
3. System presents options: "Take Photo", "Choose from Library", "Import File".
4. User selects "Take Photo". Camera opens. User captures the document.
5. System saves the photo to the app's local document directory.
6. Add Document form appears with the photo preview: title (required), category selector (deed/warranty/insurance/permit/receipt/manual/contract/other), expiry date (optional date picker), tags (optional comma-separated text input), notes (optional text area).
7. User fills in details and taps Save.
8. Document record is created with file_uri pointing to the local file, file_type = "image", file_size_bytes calculated from the saved file.

**Adding a document (PDF import):**
1. User selects "Import File" from the add options.
2. System opens the document picker (filtered to PDF and image types).
3. User selects a file. System copies it to the app's local document directory.
4. Same form as photo capture (step 6 above). file_type set to "pdf" or "image" based on MIME type.

**Viewing documents for a property:**
1. User navigates to Property Detail > Documents section.
2. Documents displayed as a grid of cards, grouped by category.
3. Each card shows: thumbnail (first page for PDFs, photo for images), title, category badge, expiry indicator (if set).
4. Expiring-soon documents (within 30 days) show an amber warning badge.
5. Expired documents show a red badge.
6. Category filter chips at the top allow filtering to a single category.

**Viewing document detail:**
1. User taps a document card.
2. Detail screen opens with full-screen document viewer (image viewer for photos, PDF viewer for PDFs).
3. Metadata shown below the viewer: title, category, file type, file size, expiry date (with status), tags, notes, date added.
4. Action buttons: "Edit", "Share" (system share sheet), "Delete".

**Searching documents:**
1. Search bar at the top of the Documents section.
2. Searches across title, category, tags, and notes fields.
3. Results displayed as filtered document cards.
4. Search is instant (LIKE queries on indexed columns plus tag string matching).

**Expiring documents alert:**
1. On the Property Detail > Documents section, if any documents have an expiry_date within the next 30 days:
2. An alert banner appears at the top: "N document(s) expiring soon" in amber.
3. If any documents are already expired: "N document(s) expired" in red.
4. Tapping the banner filters to show only expiring/expired documents.

**Linking a document to a maintenance schedule:**
1. From a maintenance schedule detail screen, user sees "Attached Documents" section.
2. User taps "Attach Document". A picker shows existing documents for this property.
3. User selects a document. The link is stored (schedule holds a reference, not the document table).
4. The document card on the schedule detail is tappable to view the full document.
5. Note: This linkage is stored via a join table or a reference column on the schedule. For MVP, use a comma-separated `document_ids` text column on hm_maintenance_schedules. A proper join table can be added in a future normalization pass.

### Edge Cases

- **No properties exist:** Documents section is unreachable (documents live under property detail). No empty state needed at the top level.
- **Property with no documents:** Documents section shows "No documents yet" with "Add Document" CTA.
- **File too large (> 50MB):** Reject with validation error: "File is too large. Maximum size is 50MB." This prevents storage bloat on-device.
- **Unsupported file type:** Only PDF and image files (JPEG, PNG, HEIC) are accepted. Other types show: "Unsupported file type. Please use PDF or image files."
- **File deleted outside the app:** Display placeholder "File unavailable" with option to re-attach. Do not crash.
- **Expired document:** Show red "Expired" badge but do not auto-delete. User may want to keep expired documents for records.
- **Document with no expiry_date:** No expiry badge shown. Treated as a permanent document.
- **Duplicate title for same property:** Allowed. Documents with the same title may exist (e.g., "Insurance Policy" for 2024 and 2025).
- **Search with no results:** Show "No documents match your search" message.
- **Tags with special characters:** Tags are sanitized on save (lowercase, trim whitespace, remove special chars except hyphens). "Closing , 2024, First-Mortgage" becomes "closing,2024,first-mortgage".
- **Deleting a property:** CASCADE deletes all document records. Physical files remain on disk (orphaned). A future cleanup pass can remove orphaned files.
- **Module disabled:** Data and files preserved. Re-enabling restores access.
- **Very long document title:** Truncated with ellipsis in card view. Full title in detail view. Max 200 characters enforced by Zod.
- **Many documents (100+ per property):** Pagination via infinite scroll (load 20 at a time). Grid layout handles gracefully.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Taking a photo of a document via camera saves it locally and creates a document record visible in the Documents section.
- [ ] **AC-2:** Importing a PDF from the file system saves it locally and creates a document record with file_type = "pdf".
- [ ] **AC-3:** Choosing a photo from the library saves it and creates a document record with file_type = "image".
- [ ] **AC-4:** Documents are displayed as a card grid grouped by category with thumbnails, titles, and category badges.
- [ ] **AC-5:** Category filter chips allow filtering documents to a single category.
- [ ] **AC-6:** Tapping a document card opens the detail viewer (image viewer for photos, PDF viewer for PDFs).
- [ ] **AC-7:** Editing a document's title, category, tags, or expiry date saves correctly and reflects immediately.
- [ ] **AC-8:** Deleting a document removes the record and shows confirmation dialog first.
- [ ] **AC-9:** Documents with expiry_date within 30 days show an amber "Expiring soon" badge.
- [ ] **AC-10:** Documents with expiry_date in the past show a red "Expired" badge.
- [ ] **AC-11:** The expiry alert banner at the top of Documents section shows count of expiring/expired documents.
- [ ] **AC-12:** Searching by title, category, or tag returns matching documents instantly.
- [ ] **AC-13:** Adding tags to a document stores them and makes the document searchable by those tags.
- [ ] **AC-14:** The "Share" button on document detail opens the system share sheet with the file.
- [ ] **AC-15:** Linking a document to a maintenance schedule makes it visible in the schedule detail's "Attached Documents" section.

### Technical Criteria
- [ ] **TC-1:** Schema migration creates hm_documents table with all columns, indexes, and correct hm_ prefix.
- [ ] **TC-2:** `getDocumentsByProperty(db, propertyId)` returns all documents for the given property, sorted by created_at DESC.
- [ ] **TC-3:** `getExpiringDocuments(db, propertyId, withinDays)` returns documents with expiry_date within the specified number of days from today.
- [ ] **TC-4:** `searchDocuments(db, propertyId, query)` searches across title, category, tags, and notes using LIKE queries.
- [ ] **TC-5:** `getDocumentStats(db, propertyId)` returns total count, count by category, count expiring soon, and total storage size.
- [ ] **TC-6:** Zod validation requires title (min 1, max 200) and file_uri (min 1).
- [ ] **TC-7:** Zod validation restricts category to the 8 allowed values.
- [ ] **TC-8:** Zod validation restricts file_type to "pdf", "image", or "other".
- [ ] **TC-9:** Zod validation requires file_size_bytes as a non-negative integer.
- [ ] **TC-10:** Deleting a property CASCADE-deletes all associated document records.
- [ ] **TC-11:** Document CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-12:** File size validation rejects files > 50MB before creating a record.
- [ ] **TC-13:** Tag sanitization converts input to lowercase, trims whitespace, removes non-alphanumeric characters (except hyphens).
- [ ] **TC-14:** `searchDocuments` query completes in < 200ms for a property with 100+ documents.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Document files must NOT be uploaded to any server. All storage is on-device only.
- [ ] **NC-2:** Adding or editing documents must NOT affect hm_properties, hm_maintenance_schedules, or hm_listings records.
- [ ] **NC-3:** Deleting a document record must NOT delete the physical file (orphan cleanup is a separate concern).
- [ ] **NC-4:** Expired documents must NOT be auto-deleted. They remain accessible until the user manually deletes them.
- [ ] **NC-5:** Document search must NOT use external search APIs. All search is via local SQLite LIKE queries.

## UI Specification

### Mobile (Expo)

**Documents Section (within Property Detail):**
- Background: `#0A0A0F` (background token)
- Section header: "Documents" with document count badge, amber accent `#D97706`
- Expiry alert banner (if applicable):
  - Amber banner (`#FFD60A` background, dark text): "N document(s) expiring soon"
  - Red banner (`#FF453A` background, white text): "N document(s) expired"
  - Tappable to filter
- Category filter chips: horizontal scroll row, glass styling, selected chip uses `#D97706` fill
- Document grid: 2-column grid layout
  - Each card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
  - Thumbnail: rounded top corners, 1:1 aspect ratio (cropped center for images, first page render for PDFs)
  - Below thumbnail: title (text token, bold, 1 line), category badge (small, colored by category), expiry badge (if applicable)
- "Add Document" button: accent color outline, glass background, centered at bottom of section
- Search bar: glass-bordered input at top of section, magnifying glass icon

**Add/Edit Document Form:**
- Background: `#0A0A0F`
- Source selection (before form): 3 large glass cards in a row: "Camera" (camera icon), "Library" (photo icon), "File" (document icon)
- Preview area: large thumbnail of captured/selected file
- Form fields below preview: title (text input), category (dropdown), expiry date (date picker, optional), tags (text input with comma hint), notes (text area)
- Save button: full-width, `#D97706` background, white text

**Document Detail/Viewer:**
- Full-screen viewer: image pinch-to-zoom for photos, native PDF renderer for PDFs
- Metadata panel (collapsible, bottom): title, category badge, file type, file size (formatted: "2.4 MB"), expiry date with status badge, tags as chips, notes
- Action bar at bottom: "Edit" (pencil icon), "Share" (share icon), "Delete" (trash icon, red)

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Documents accessible at `/homes/properties/[id]/documents` route
- Layout: sidebar navigation (existing), main content area
- Document grid: 3-4 column responsive grid
- Category filter as horizontal button group
- Search bar in header area
- Document detail opens as a side panel with embedded viewer (PDF.js for PDFs, native img for images)
- Expiry alert banner at top of grid
- File upload via drag-and-drop zone or file input
- "Add Document" button in header area

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton grid (6 cards) with pulsing animation | Initial data fetch from SQLite |
| Empty | Centered document icon, "No documents yet" + "Add Document" CTA button | No document records for this property |
| Error | "Something went wrong loading documents" + retry button | SQLite read failure |
| Success | Document card grid with thumbnails, category badges, and expiry indicators | Documents loaded |
| Success (with expiry alerts) | Alert banner at top + document grid | Some documents expiring soon or expired |
| Partial | Some cards loaded with thumbnails, others showing skeleton placeholders | Large grid, staggered thumbnail generation |

## Test Requirements

### Unit Tests (modules/homes/src/__tests__/document-engine.test.ts)
- [ ] `getDocumentsByProperty`: returns all documents for a property sorted by created_at DESC
- [ ] `getDocumentsByProperty`: returns empty array when no documents exist
- [ ] `getExpiringDocuments`: returns documents expiring within 30 days
- [ ] `getExpiringDocuments`: excludes documents with null expiry_date
- [ ] `getExpiringDocuments`: excludes documents with expiry_date more than N days away
- [ ] `getExpiringDocuments`: includes already-expired documents when withinDays is 0 or negative
- [ ] `searchDocuments`: finds documents by title substring
- [ ] `searchDocuments`: finds documents by category match
- [ ] `searchDocuments`: finds documents by tag match
- [ ] `searchDocuments`: finds documents by notes substring
- [ ] `searchDocuments`: returns empty array when no matches
- [ ] `searchDocuments`: is case-insensitive
- [ ] `getDocumentStats`: returns correct total count and count by category
- [ ] `getDocumentStats`: returns correct count of expiring-soon documents
- [ ] `getDocumentStats`: returns correct total storage size (sum of file_size_bytes)
- [ ] `sanitizeTags`: converts "Closing , 2024, First-Mortgage" to "closing,2024,first-mortgage"
- [ ] `sanitizeTags`: removes special characters except hyphens
- [ ] `sanitizeTags`: handles empty string input
- [ ] Zod validation: accepts valid DocumentSchema with all required fields
- [ ] Zod validation: rejects document with empty title
- [ ] Zod validation: rejects document with title > 200 characters
- [ ] Zod validation: rejects document with invalid category
- [ ] Zod validation: rejects document with empty file_uri
- [ ] Zod validation: rejects document with negative file_size_bytes
- [ ] Zod validation: accepts document with null expiry_date (no expiry)

### Integration Tests
- [ ] Full flow: capture photo, fill form, save document, verify record persisted with correct file_uri and file_type
- [ ] Full flow: import PDF, save document, verify file_type = "pdf" and file_size_bytes correct
- [ ] Full flow: add 3 documents with different categories, filter by category, verify correct filtering
- [ ] Full flow: add document with expiry_date 15 days from now, verify it appears in getExpiringDocuments(30)
- [ ] Full flow: search by title substring, verify matching document returned
- [ ] Full flow: edit document title and tags, verify updates persisted
- [ ] Full flow: delete document, verify record removed
- [ ] Full flow: delete property, verify all documents CASCADE-deleted
- [ ] Error flow: attempt to add document > 50MB, verify rejection before record creation

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyHomes > Properties tab. Select an existing property (or create one). -- Setup.
3. Scroll to "Documents" section on property detail. Verify empty state with "Add Document" CTA. -- Verifies empty state.
4. Tap "Add Document". Verify 3 options appear: Camera, Library, File. -- Source selection present.
5. Select "Camera". Take a photo of a document. Verify preview appears on the Add Document form. -- Camera capture works.
6. Fill in: title "Home Deed", category "deed", no expiry date. Save. -- Corresponds to AC-1.
7. Verify the document card appears in the grid with thumbnail and "deed" badge. -- Corresponds to AC-1, AC-4.
8. Tap "Add Document" again. Select "File". Choose a PDF from the file system. -- PDF import.
9. Fill in: title "Insurance Policy 2026", category "insurance", expiry date 30 days from today, tags "annual,state-farm". Save. -- Corresponds to AC-2.
10. Verify the document card appears with "insurance" badge and amber "Expiring soon" indicator. -- Corresponds to AC-2, AC-9.
11. Verify the expiry alert banner appears at top: "1 document(s) expiring soon". -- Corresponds to AC-11.
12. Tap "Add Document". Select "Library". Choose a photo. Fill in: title "Warranty - Dishwasher", category "warranty", expiry date 6 months from now, tags "kitchen,bosch". Save. -- Corresponds to AC-3.
13. Tap the category filter chip "warranty". Verify only the dishwasher warranty card is visible. -- Corresponds to AC-5.
14. Clear the filter. Verify all 3 documents visible. -- Corresponds to AC-5.
15. Type "dishwasher" in the search bar. Verify only the warranty document appears. -- Corresponds to AC-12.
16. Clear search. Type "bosch" (a tag). Verify the warranty document appears. -- Corresponds to AC-13.
17. Tap the "Home Deed" card. Verify the image viewer opens with full-screen photo. Verify metadata panel shows title, category, file size. -- Corresponds to AC-6.
18. Tap the PDF document card. Verify the PDF viewer opens. -- Corresponds to AC-6.
19. On the deed detail, tap "Edit". Change title to "Home Deed - 123 Oak St". Save. Verify title updates in the grid. -- Corresponds to AC-7.
20. On the deed detail, tap "Share". Verify system share sheet opens. -- Corresponds to AC-14.
21. On the deed detail, tap "Delete". Confirm. Verify the card is removed from the grid. -- Corresponds to AC-8.
22. Edit the insurance policy expiry date to yesterday. Verify it now shows a red "Expired" badge instead of amber. -- Corresponds to AC-10.
23. Navigate to Reminders tab. Open a maintenance schedule detail. Verify "Attached Documents" section exists. Tap "Attach Document". Select the warranty. Verify it appears linked. -- Corresponds to AC-15.
24. Repeat key steps (4-8, 14-18, 21) on web at `/homes/properties/[id]/documents`. Verify functional parity. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to a property's Documents section, click every button, verify all 5 states (loading, empty, error, success, success-with-expiry-alerts)
- [ ] Batch QA: after 5 features in homes module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `document-engine.ts` (getDocumentsByProperty, getExpiringDocuments, searchDocuments, getDocumentStats, sanitizeTags)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- homes module has active standalone counterpart (MyHomes)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Homes module has 5 tables: hm_listings, hm_tours, hm_properties, hm_maintenance_schedules, hm_settings
- Schema version 2 (or 3 if cost-tracking lands first)
- No concept of document storage or file management
- Maintenance schedules have no way to reference related documents

### After This Work
- Homes module gains 1 new table (hm_documents) with 3 new indexes
- Schema version incremented by 1 (v3 or v4 depending on ordering with cost-tracking)
- Property detail screen gains a "Documents" section with grid display, category filtering, search, and expiry tracking
- Full document lifecycle: capture/import, categorize, tag, set expiry dates, view, search, share, delete
- `document-engine.ts` contains pure functions for document queries, expiry detection, search, statistics, and tag sanitization
- Maintenance schedule detail screen gains "Attached Documents" section
- On-device file storage for all captured/imported files

### Files Changed

- `modules/homes/src/types.ts` -- Add DocumentCategorySchema, FileTypeSchema, DocumentSchema, DocumentStatsSchema Zod schemas and types
- `modules/homes/src/db/schema.ts` -- Add CREATE_DOCUMENTS table, 3 indexes, V3_TABLES (or V4_TABLES) export
- `modules/homes/src/db/crud.ts` -- Add document CRUD (create, get, getByProperty, getByCategory, search, getExpiring, update, delete), document stats query
- `modules/homes/src/engines/document-engine.ts` -- NEW: getDocumentsByProperty, getExpiringDocuments, searchDocuments, getDocumentStats, sanitizeTags
- `modules/homes/src/definition.ts` -- Add migration for new table, update schemaVersion
- `modules/homes/src/index.ts` -- Re-export new types and engine functions
- `modules/homes/src/__tests__/document-engine.test.ts` -- NEW: 25+ unit tests for document engine
- `apps/mobile/app/(homes)/documents.tsx` -- NEW: Document list/grid screen
- `apps/mobile/app/(homes)/add-document.tsx` -- NEW: Add/Edit document form with capture
- `apps/mobile/app/(homes)/document-detail.tsx` -- NEW: Document detail/viewer screen
- `apps/web/app/homes/documents/page.tsx` -- NEW: Document management web page

### Known Limitations
- All files stored on-device only. No cloud backup or cross-device sync.
- No OCR or text extraction from images/PDFs. Search is metadata-only (title, category, tags, notes).
- No multi-page document scanning (one photo per document record). Users can import multi-page PDFs instead.
- Physical files are not cleaned up when document records are deleted. Orphan cleanup is a future maintenance task.
- No document versioning. Editing a document replaces the record; previous versions are not preserved.
- The schedule-to-document linkage uses a text column (document_ids) rather than a proper join table. This is an MVP simplification.
- No folder/sub-folder organization beyond category. Flat list within each category.
- Web PDF viewing requires a client-side renderer (PDF.js or browser native). No server-side processing.

### Context for Next Agent
- The document engine should follow the same pure-function pattern as `reminder-engine.ts` and `cost-engine.ts`. Functions take a DatabaseAdapter and return typed results.
- File storage on mobile uses `expo-file-system` documentDirectory. Files are copied to `${documentDirectory}/homes/documents/${documentId}.{ext}`. On web, use IndexedDB or a Blob URL approach.
- The `tags` column is a comma-separated string in SQLite. In the application layer, parse to `string[]` on read and join on write. The `sanitizeTags` function handles normalization.
- The `hm_documents` table uses ON DELETE CASCADE for property_id. When a property is deleted, all document records are removed, but physical files remain. This is intentional to avoid complex file system operations in the SQL migration layer.
- The document-to-schedule link for MVP is a text `document_ids` column on `hm_maintenance_schedules`. This keeps the migration simple. The inventory spec (Sprint 8) also references documents via an optional `document_id` FK. These are independent linkage mechanisms.
- Migration ordering: if cost-tracking (Sprint 7) lands first, this becomes migration v4. If this lands first, it is v3 and cost-tracking becomes v4. The migration version is determined at implementation time. Both specs are self-contained.
- The expiry_date check uses the same 14-day "due_soon" pattern from the reminder engine. However, documents use a 30-day window by default (configurable via the `withinDays` parameter on `getExpiringDocuments`).
