# Feature Spec: Printed Books from Entries

## Metadata
- **Module:** journal
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 0 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** Sprint 7 (B+C Features, Late)
- **Estimated CC Time:** 4-5 hours
- **Depends On:** JR-012 (Export -- implemented, `engine/export.ts`)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Day One charges $34.99/yr and prominently features "printed books from your journal" as a premium selling point. Turning digital journal entries into a physical, printed book is deeply emotional: it transforms ephemeral daily writing into a tangible artifact. Day One partners with a print-on-demand service for fulfillment. MyJournal can offer the same book compilation experience without a cloud partnership by generating a print-ready PDF that users upload to any print service (Blurb, Lulu, Amazon KDP) or take to a local print shop. No data leaves the device beyond the final PDF the user explicitly exports.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Day One | Yes | $34.99/yr | In-app book builder with direct print ordering. Cloud-processed. Ships physical books. |
| Chatbooks | Yes | Pay-per-book | Photo book service, not journal-specific. Cloud-processed. |
| Blurb | Yes | Pay-per-book | DIY book creation platform. Upload your own PDF. |
| Daylio | No | N/A | No book printing feature. |
| Apple Journal | No | N/A | No export or print feature. |

### Target User
Long-term journalers (1+ years of entries) who want a physical keepsake. Day One users who use the printed book feature and are considering switching. Gift-givers who want to print travel journals, gratitude journals, or year-in-review collections. Parents creating baby journals or family memory books.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/book-builder/                  -- NEW: book compilation engine
modules/journal/src/book-builder/types.ts          -- BookConfig, BookLayout, CoverTemplate types
modules/journal/src/book-builder/covers.ts         -- 5 cover template definitions
modules/journal/src/book-builder/page-layout.ts    -- Entry-to-page conversion, pagination
modules/journal/src/book-builder/book-engine.ts    -- Book assembly, preview generation, page estimation
modules/journal/src/book-builder/index.ts          -- Barrel export
modules/journal/src/book-builder/__tests__/        -- Tests
apps/mobile/app/(journal)/book-builder.tsx         -- Mobile 4-step wizard
apps/web/app/journal/book/page.tsx                 -- Web book builder
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Settings tab
            └── "Create Printed Book" ← YOU ARE HERE
                 └── 4-Step Book Builder Wizard
```

### Data Model

No new database tables required. Book configuration is transient (exists only during the wizard session). The output is a PDF file exported to the device.

New settings:

```sql
INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('lastBookTitle', '');
INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('lastBookAuthor', '');
INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('lastBookFormat', '6x9');
```

Book configuration is a pure TypeScript type, not persisted in SQLite:

```typescript
interface BookConfig {
  title: string;            // max 100 chars
  subtitle: string | null;  // max 200 chars
  author: string;           // max 100 chars
  coverTemplate: 'minimalist' | 'photo' | 'classic' | 'modern' | 'nature';
  coverImageUri: string | null; // for 'photo' template only
  bodyFont: 'georgia' | 'merriweather' | 'open_sans' | 'source_code_pro';
  pageSize: '6x9' | '5.5x8.5' | '8.5x11';
  entryIds: string[];       // selected entries (1-500)
  includePhotos: boolean;
  includeMoodTags: boolean;
  includeMetadata: boolean; // location, weather
}
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD, export engine from `engine/export.ts`, image URI handling
- **External:** PDF rendering library capable of multi-page documents with custom fonts and images (e.g., `react-native-pdf-lib` on mobile, `pdfkit` or `jspdf` on web)
- **Cross-Module:** none

## Functional Requirements

### User Stories
1. As a reflective thinker, I want to turn my journal entries into a printed physical book so that I can hold my memories in tangible form.
2. As a long-time journaler, I want to select a date range and customize the book layout so that the printed book feels personal.
3. As a gift giver, I want to create a printed book of my travel journal or gratitude entries to share meaningful memories.

### Behavior Specification

1. User navigates to Settings > "Create Printed Book."
2. **4-Step Book Builder Wizard:**

3. **Step 1: Select Entries**
   a. Date range selector (start date, end date).
   b. Filter options: by journal, by tag, by entry type (standard, therapy_prep, grid).
   c. Entry count display: "127 entries selected (est. 142 pages)."
   d. "Select All" / "Deselect All" toggles.
   e. Individual entry checkboxes in scrollable list (date, title preview).
   f. Minimum 1 entry, maximum 500 entries per book.

4. **Step 2: Customize Book**
   a. Book title (max 100 chars, required).
   b. Subtitle (max 200 chars, optional).
   c. Author name (max 100 chars, required).
   d. Cover design: 5 template thumbnails (Minimalist, Photo, Classic, Modern, Nature).
   e. If "Photo Cover" selected: image picker for cover photo.
   f. Body font: 4 options (Georgia, Merriweather, Open Sans, Source Code Pro).
   g. Page size: 3 options (6x9, 5.5x8.5, 8.5x11).
   h. Toggle options: include photos, include mood tags, include metadata.

5. **Step 3: Preview**
   a. Estimated page count based on word count and image count.
   b. Sample pages: cover, table of contents, and 2-3 entry pages rendered as thumbnails.
   c. "Edit" buttons to return to Step 1 or Step 2.

6. **Step 4: Generate**
   a. Progress bar: "Generating your book... (page 42 of 142)"
   b. On completion: "Your book is ready!" with file size.
   c. "Share" button: opens system share sheet with the PDF.
   d. "Save to Files" button: saves PDF to device storage.
   e. PDF saved with name: `{title}-{YYYY-MM-DD}.pdf`.

7. **Book layout:**
   a. Cover page: template design with title, subtitle, author.
   b. Page 2: blank (inside front cover).
   c. Table of contents: entry dates and titles with page numbers.
   d. Entry pages: date header, title, mood emoji (if enabled), body text, inline photos (if enabled), location/weather footer (if metadata enabled).
   e. Back cover: "Created with MyJournal" watermark (subtle, bottom center).

### Edge Cases

- **No entries selected:** "Next" disabled, inline message "Select at least 1 entry."
- **500+ entries selected:** Warning "Maximum 500 entries per book. Consider splitting into multiple volumes."
- **Very long entries (5000+ words):** Split across pages with proper pagination.
- **Entries with no title:** Use date as heading.
- **Entries with images:** Images placed inline at approximate position, scaled to fit page width.
- **Grid entries:** Render grid cells as structured sections (not raw Markdown).
- **Therapy prep entries:** Render structured sections with headers.
- **PDF generation takes > 30 seconds:** Show progress bar with page count. Do not time out.
- **Insufficient device storage for PDF:** Toast with "Not enough storage. Free up space."
- **Book with 0 images and metadata disabled:** Smaller, text-only PDF.
- **Cover photo not found (file deleted):** Fall back to Minimalist template.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Create Printed Book" option accessible from Settings.
- [ ] **AC-2:** Step 1 allows date range selection and entry filtering by journal/tag/type.
- [ ] **AC-3:** Step 1 shows entry count and estimated page count.
- [ ] **AC-4:** Step 2 allows title, subtitle, author, cover design, font, and page size customization.
- [ ] **AC-5:** 5 cover templates shown with visual thumbnails.
- [ ] **AC-6:** Step 3 shows preview with sample pages (cover, TOC, entry pages).
- [ ] **AC-7:** Step 4 generates PDF with progress bar.
- [ ] **AC-8:** Generated PDF can be shared via system share sheet.
- [ ] **AC-9:** Generated PDF can be saved to device storage.
- [ ] **AC-10:** Book includes cover, TOC, and formatted entry pages.
- [ ] **AC-11:** Mood tags appear as emoji markers next to entry dates (when enabled).
- [ ] **AC-12:** Photos appear inline in entries (when enabled).

### Technical Criteria
- [ ] **TC-1:** PDF generated with proper margins for print (0.5" inner, 0.75" outer for 6x9).
- [ ] **TC-2:** Page estimation formula: ~250 words per page + 1 page per photo.
- [ ] **TC-3:** TOC includes entry dates and page numbers, linked in the PDF.
- [ ] **TC-4:** Font files bundled with the app (Georgia, Merriweather, Open Sans, Source Code Pro).
- [ ] **TC-5:** PDF file size reasonable: ~100KB per text page, ~500KB per image page.
- [ ] **TC-6:** Maximum 500 entries per book (enforced in UI).
- [ ] **TC-7:** Book generation does not block the UI (runs in background/worker thread).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Journal entry data must NEVER be sent to any external print service. PDF generation is entirely on-device.
- [ ] **NC-2:** Book generation must NOT modify the source entries.
- [ ] **NC-3:** The generated PDF must NOT contain any tracking metadata (no device IDs, no user info beyond what the user explicitly included).
- [ ] **NC-4:** Book generation must NOT crash on entries with unusual content (very long, empty body, special characters).

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Wizard: 4-step indicator dots (same pattern as CBT wizard)
- Entry selector: scrollable list with checkboxes, date headers
- Cover template thumbnails: glass cards with template previews
- Font preview: sample text rendered in each font option
- Progress bar: accent color fill with page count text
- Completion screen: glass card with book icon, file size, "Share" and "Save" buttons
- Module accent: `#A78BFA`

### Web (Next.js)

- Route: `/journal/book`
- Wider layout: entry list on left, customization on right
- Cover templates in 5-column grid
- Live preview pane shows sample pages as user customizes

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Step 1 | Entry selector with date range and filters | Wizard opened |
| Step 2 | Customization form with cover templates and font options | Step 1 completed |
| Step 3 | Preview thumbnails with estimated page count | Step 2 completed |
| Generating | Progress bar with "page X of Y" | User confirmed generation |
| Complete | "Your book is ready!" with Share/Save buttons | PDF generation finished |
| Error | "Not enough storage" or "Generation failed" with retry | Generation error |
| No Entries | "Select at least 1 entry" with disabled Next | No entries selected |

## Test Requirements

### Unit Tests
- [ ] `estimatePageCount`: 1000 words, 0 photos -> 4 pages + cover + TOC = 6
- [ ] `estimatePageCount`: 500 words, 5 photos -> 2 + 5 + cover + TOC = 9
- [ ] `estimatePageCount`: 0 entries -> 0 (validation error)
- [ ] `validateBookConfig`: empty title -> validation error
- [ ] `validateBookConfig`: title 101 chars -> validation error
- [ ] `validateBookConfig`: 501 entries -> validation error
- [ ] `formatEntryForPage`: entry with title -> date header + title + body
- [ ] `formatEntryForPage`: entry without title -> date header + body
- [ ] `formatEntryForPage`: entry with mood -> mood emoji next to date
- [ ] `formatEntryForPage`: entry with metadata -> location/weather footer
- [ ] `generateTOC`: 10 entries with dates and page numbers -> correct TOC structure
- [ ] `getPageDimensions`: '6x9' -> { width: 432, height: 648 } (points)
- [ ] `getPageDimensions`: '8.5x11' -> { width: 612, height: 792 } (points)
- [ ] `getMargins`: '6x9' -> { inner: 54, outer: 36, top: 54, bottom: 54 } (0.75"/0.5" at 72dpi)

### Integration Tests
- [ ] Full flow: select 10 entries -> customize (Minimalist cover, Georgia font, 6x9) -> preview -> generate -> valid PDF file
- [ ] Photo inclusion: entries with images -> images appear inline in PDF
- [ ] Grid entry in book: grid entry -> rendered as structured sections
- [ ] Large book: 100 entries -> generates without error

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Settings
3. Verify: "Create Printed Book" option exists -- corresponds to AC-1
4. Tap "Create Printed Book"
5. Verify: Step 1 with date range selector and entry list -- corresponds to AC-2
6. Select a date range with 20 entries
7. Verify: entry count and page estimate shown -- corresponds to AC-3
8. Tap "Next"
9. Verify: Step 2 with title, subtitle, author, cover, font, size fields -- corresponds to AC-4
10. Enter title, author, select "Minimalist" cover, "Georgia" font, "6x9"
11. Verify: 5 cover template thumbnails visible -- corresponds to AC-5
12. Tap "Next"
13. Verify: Step 3 shows preview thumbnails -- corresponds to AC-6
14. Tap "Generate"
15. Verify: progress bar with page count -- corresponds to AC-7
16. Wait for completion
17. Verify: "Your book is ready!" with file size
18. Tap "Share"
19. Verify: system share sheet opens -- corresponds to AC-8
20. Tap "Save to Files"
21. Verify: PDF saved to device -- corresponds to AC-9
22. Open the PDF externally
23. Verify: cover page, TOC, formatted entries -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal has a basic export engine (`engine/export.ts`) that produces a JSON bundle. No PDF generation, no book layout, no print-ready output.

### After This Work
A `book-builder/` directory provides page layout calculation, entry-to-page formatting, cover template definitions, TOC generation, and page estimation. The book builder wizard (4 steps) produces a print-ready PDF with proper margins, fonts, and pagination. No new database tables needed (config is transient).

### Files Changed
- `modules/journal/src/book-builder/types.ts` -- BookConfig, BookLayout, CoverTemplate, PageDimensions types
- `modules/journal/src/book-builder/covers.ts` -- 5 cover template definitions (Minimalist, Photo, Classic, Modern, Nature)
- `modules/journal/src/book-builder/page-layout.ts` -- getPageDimensions, getMargins, formatEntryForPage, paginateEntries
- `modules/journal/src/book-builder/book-engine.ts` -- estimatePageCount, generateTOC, validateBookConfig, assembleBook
- `modules/journal/src/book-builder/index.ts` -- barrel export
- `modules/journal/src/book-builder/__tests__/book-engine.test.ts` -- 14+ unit tests
- `modules/journal/src/db/schema.ts` -- add settings for last book config
- `modules/journal/src/definition.ts` -- add settings to JOURNAL_MIGRATION_V4
- `modules/journal/src/index.ts` -- re-export book-builder module
- `apps/mobile/app/(journal)/book-builder.tsx` -- 4-step wizard
- `apps/web/app/journal/book/page.tsx` -- web book builder

### Known Limitations
- No direct print-on-demand integration. Users must upload the PDF to Blurb, Lulu, or Amazon KDP themselves.
- PDF rendering depends on a PDF library that supports custom fonts and images. Library selection is platform-specific.
- No spine calculation or ISBN support. Users adding to print services handle those details.
- No book history (previously generated books are not tracked).
- Cover template rendering is simplified (no advanced typography or bleeding).

### Context for Next Agent
- The existing `engine/export.ts` exports `serializeJournalExport()` which produces a JSON bundle. The book builder is separate but can reuse `listJournalEntries` with filters.
- PDF page dimensions in points (72 points per inch): 6x9" = 432x648pt, 5.5x8.5" = 396x612pt, 8.5x11" = 612x792pt.
- Margins for trade paperback (6x9"): 0.75" inner (binding side), 0.5" outer/top/bottom. Other sizes scale proportionally.
- The `body` column on entries is Markdown. For PDF rendering, convert Markdown to styled text (headings, bold, italic, lists).
- Grid entries should render as structured sections, not raw Markdown. Check `entry_type` and render accordingly.
- Therapy prep entries should render with section headings from `jn_therapy_topics`.
- For photo inclusion, read `image_uris_json` from the entry and inline the images at appropriate positions.
- Mood tags can be mapped to emoji: low=:(, okay=:|, good=:), great=:D, grateful=heart.
- Book generation should run in a background thread or worker to avoid blocking the UI.
