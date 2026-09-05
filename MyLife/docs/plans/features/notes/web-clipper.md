# Feature Spec: Web Clipper

## Metadata
- **Module:** notes
- **Priority Score:** 33 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 0 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** NT-001 (Markdown Editor -- implemented), Image/File Attachments (for saving clipped images)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Evernote's web clipper was the feature that built the company -- 225M+ users installed it. Users clip articles, recipes, research, and reference material from the web directly into their notes. Notion's web clipper is a top browser extension. The ability to save web content as clean markdown with images is a massive switching cost reducer: users who clip regularly are deeply locked into their current tool. MyNotes can offer a privacy-first web clipper that saves content locally (no cloud processing), combining the Evernote/Notion clipping experience with Obsidian's local-first philosophy.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Evernote | Yes | Free tier | Browser extension, iOS/Android share sheet. Full page, article, simplified, screenshot modes. Cloud-processed. |
| Notion | Yes | Free tier | Browser extension. Saves as database entry or page. Markdown conversion. Cloud-processed. |
| Obsidian | Partial | Free | Community plugins (MarkDownload, Obsidian Web Clipper). No official clipper. |
| Apple Notes | Partial | Free | iOS share sheet saves links and images. No markdown conversion. Basic. |

### Target User
Researchers, students, content curators, and anyone who saves web content for later reference. Primary migration target: Evernote users (225M+) whose web clipper habit is their primary lock-in factor. Also Notion users who rely on web clipping for research.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/clipper/                        -- NEW: web clipping engine
modules/notes/src/clipper/types.ts                -- ClipperInput, ClipperResult types
modules/notes/src/clipper/parser.ts               -- HTML-to-markdown conversion
modules/notes/src/clipper/index.ts                -- Barrel export
modules/notes/src/clipper/__tests__/              -- Tests
apps/mobile/app/(notes)/clip.tsx                  -- Mobile share extension target screen
apps/web/app/notes/clip/page.tsx                  -- Web clip page (from URL input)
```

### Wireframe Position

```
External browser / app
  └── Share sheet
       └── "Save to MyNotes" ← YOU ARE HERE (mobile)

Hub Dashboard
  └── MyNotes card
       └── Notes tab -> "Clip from URL" button ← ALSO HERE (web)
```

### Data Model

New columns on `nt_notes` in migration V2:

```sql
ALTER TABLE nt_notes ADD COLUMN source_url TEXT;
ALTER TABLE nt_notes ADD COLUMN clipped_at TEXT;
ALTER TABLE nt_notes ADD COLUMN clip_type TEXT
  CHECK (clip_type IN ('article', 'full_page', 'selection', 'bookmark'));
```

### Dependencies
- **Internal:** `@mylife/db`, notes CRUD (`createNote`), attachments module (for saving clipped images)
- **External:** HTML-to-markdown converter (e.g., `turndown` library), `expo-sharing` (share sheet integration), readability parser (e.g., `@mozilla/readability` or custom)
- **Cross-Module:** Clipped notes could be tagged and linked like any other note. Search indexes clipped content.

## Functional Requirements

### User Stories
1. As a researcher, I want to clip web articles directly into MyNotes as clean markdown so that I can reference them later without re-visiting the website.
2. As a mobile user, I want to share a URL from my browser to MyNotes so that I can save interesting content with one tap.
3. As a privacy-conscious user, I want web clipping to process content on my device so that the article content never passes through a third-party server.

### Behavior Specification

1. **Mobile (Share Sheet):**
   a. User reads an article in Safari/Chrome.
   b. User taps Share -> "Save to MyNotes".
   c. Share extension opens: shows article title, preview, and options:
      - Clip mode: "Article" (reader mode, clean text), "Full Page" (all content), "Selection" (highlighted text), "Bookmark" (title + URL only).
      - Folder: choose destination folder.
      - Tags: add tags.
   d. User taps "Save".
   e. Content is fetched, parsed, converted to markdown, and saved as a new note.
   f. Images in the article are downloaded and saved as local attachments.
   g. Source URL and clip timestamp stored on the note.

2. **Web (URL Input):**
   a. User navigates to Notes > "Clip from URL".
   b. User pastes a URL.
   c. System fetches the page, parses it (readability extraction), converts to markdown.
   d. Preview shown. User can edit before saving.
   e. User taps "Save to Notes".

3. **Clip Processing Pipeline:**
   a. Fetch HTML from URL.
   b. Run readability parser to extract article content (title, author, date, body).
   c. Convert HTML body to markdown using turndown.
   d. Download and localize images (save as attachments, replace URLs with `attachment://` references).
   e. Prepend metadata block: title, source URL, author, date clipped.
   f. Create note with body = markdown content, source_url = original URL, clip_type = mode.

### Edge Cases

- **URL unreachable:** Toast "Could not fetch this page. Check your connection."
- **Paywall/login-required content:** Clip whatever is publicly accessible. May result in partial content.
- **Very large page (>1MB HTML):** Truncate at 500KB of markdown content with "[Content truncated]" marker.
- **No article content detected:** Fallback to bookmark mode (title + URL + description meta tag).
- **Images fail to download:** Skip failed images, replace with `[Image not available]` placeholder.
- **Duplicate URL clipped:** Allow it. Each clip creates a new note. No dedup.
- **JavaScript-rendered content (SPA):** Basic fetch gets the initial HTML. JS-rendered content may not be captured. Note this limitation to the user.
- **PDF URL:** Save as file attachment rather than attempting to convert.
- **Offline:** Cannot clip. Toast "Web clipping requires an internet connection."
- **Share extension memory limit (iOS):** iOS share extensions have limited memory. Process content asynchronously.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Save to MyNotes" appears in the iOS/Android share sheet when sharing a URL.
- [ ] **AC-2:** Share extension shows article preview with clip mode, folder, and tag options.
- [ ] **AC-3:** "Article" mode extracts clean article text as markdown.
- [ ] **AC-4:** "Bookmark" mode saves title + URL + description only.
- [ ] **AC-5:** Clipped note includes source URL and clip timestamp.
- [ ] **AC-6:** Images in articles are downloaded and stored locally as attachments.
- [ ] **AC-7:** Web app has "Clip from URL" with preview before saving.
- [ ] **AC-8:** Clipped notes appear in the note list with a link/clip icon badge.
- [ ] **AC-9:** Source URL is tappable to open the original page.
- [ ] **AC-10:** Clip modes: article, full page, selection, bookmark all functional.

### Technical Criteria
- [ ] **TC-1:** Migration V2 adds source_url, clipped_at, clip_type columns to `nt_notes`.
- [ ] **TC-2:** HTML-to-markdown conversion handles headings, paragraphs, lists, links, images, code blocks, tables.
- [ ] **TC-3:** Readability parser extracts article content from HTML (strips nav, ads, footer).
- [ ] **TC-4:** Images downloaded and saved via the attachments module.
- [ ] **TC-5:** Clip processing is entirely on-device. No third-party API for content extraction.
- [ ] **TC-6:** Share extension works within iOS memory limits.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Article content must NEVER be sent to a third-party content extraction API.
- [ ] **NC-2:** Web clipping must NOT store cookies, session data, or login credentials from the source site.
- [ ] **NC-3:** Failed image downloads must NOT prevent the note from being saved.
- [ ] **NC-4:** Clipping must NOT modify the source website in any way.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Share extension: compact modal with article title (18px semibold), domain name (14px, textSecondary), body preview (4 lines)
- Clip mode selector: segmented control with 4 modes, accent-highlighted active mode
- Folder picker: dropdown, defaults to root
- Tag input: tag chips with add button
- "Save" button: full-width, `#64748B` accent
- Processing state: progress indicator with "Clipping..." text
- Clip badge in note list: link icon (16px) in `#64748B`
- Module accent: `#64748B`

### Web (Next.js)

- Route: `/notes/clip`
- URL input field with "Clip" button
- Two-column layout: left = clip settings (mode, folder, tags), right = markdown preview
- Same processing pipeline

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Input | URL field or share sheet with options | User initiates clip |
| Processing | Progress indicator, "Clipping..." | Fetch + parse in progress |
| Preview | Markdown preview of clipped content | Processing complete |
| Saved | Toast "Saved to MyNotes", note opens | User taps Save |
| Error | "Could not fetch this page" with retry | URL unreachable |
| Partial | Content with "[Image not available]" placeholders | Some images failed |

## Test Requirements

### Unit Tests
- [ ] `htmlToMarkdown`: `<h1>Title</h1><p>Body</p>` -> `# Title\n\nBody`
- [ ] `htmlToMarkdown`: `<a href="url">link</a>` -> `[link](url)`
- [ ] `htmlToMarkdown`: `<img src="url" alt="desc">` -> `![desc](url)`
- [ ] `htmlToMarkdown`: `<ul><li>item</li></ul>` -> `- item`
- [ ] `htmlToMarkdown`: `<pre><code>code</code></pre>` -> fenced code block
- [ ] `extractReadableContent`: full HTML page -> article content only (no nav, ads, footer)
- [ ] `buildClipMetadata`: URL + title + author -> markdown metadata block
- [ ] `localizeImages`: replaces remote URLs with `attachment://` references
- [ ] `truncateContent`: 600KB markdown -> truncated to 500KB with marker
- [ ] `detectClipType`: article page -> "article", no content -> "bookmark"

### Integration Tests
- [ ] Full flow: paste URL -> fetch -> parse -> preview -> save -> note exists with markdown content and source_url
- [ ] Bookmark flow: URL to paywall page -> fallback to bookmark mode -> note with title + URL only

### QA Verification Script

1. Open Safari on mobile
2. Navigate to a news article
3. Tap Share -> "Save to MyNotes"
4. Verify: share extension shows article title and preview -- corresponds to AC-1, AC-2
5. Select "Article" mode
6. Tap "Save"
7. Verify: note created with clean markdown content -- corresponds to AC-3
8. Open the clipped note
9. Verify: source URL shown and tappable -- corresponds to AC-5, AC-9
10. Verify: images saved locally inline -- corresponds to AC-6
11. Go back to note list
12. Verify: clip icon badge on the note -- corresponds to AC-8
13. Share a URL and select "Bookmark" mode
14. Verify: note saved with title + URL only -- corresponds to AC-4
15. Open the web app
16. Navigate to Notes > "Clip from URL"
17. Paste a URL and clip
18. Verify: preview shown before saving -- corresponds to AC-7
19. Verify: selection mode works when text is highlighted before sharing -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to clip page, paste URL, verify clip and preview

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Notes have no concept of web clipping. No share extension. No HTML-to-markdown conversion. Users must manually copy-paste content from web pages into notes.

### After This Work
iOS/Android share sheet integration for "Save to MyNotes." Readability extraction + HTML-to-markdown conversion. Image localization via attachments. Source URL tracking. Web "Clip from URL" page. Four clip modes: article, full page, selection, bookmark.

### Files Changed
- `modules/notes/src/db/schema.ts` -- ALTER TABLE for source_url, clipped_at, clip_type columns
- `modules/notes/src/definition.ts` -- add clip columns to NOTES_MIGRATION_V2
- `modules/notes/src/clipper/types.ts` -- ClipperInput, ClipperResult, ClipMode types
- `modules/notes/src/clipper/parser.ts` -- htmlToMarkdown, extractReadableContent, localizeImages, truncateContent
- `modules/notes/src/clipper/index.ts` -- barrel export
- `modules/notes/src/clipper/__tests__/parser.test.ts` -- 10+ unit tests
- `modules/notes/src/types.ts` -- extend NoteSchema with source_url, clipped_at, clip_type
- `modules/notes/src/index.ts` -- re-export clipper module
- `apps/mobile/app/(notes)/clip.tsx` -- share extension target screen
- `apps/web/app/notes/clip/page.tsx` -- web clip page

### Known Limitations
- JavaScript-rendered content (SPAs) may not be captured. Basic HTTP fetch only.
- No browser extension (future work). Mobile uses share sheet, web uses URL input.
- No annotation or highlighting of clipped content (clip is a one-time snapshot).
- Paywall content may result in partial or empty clips.
- No scheduled/recurring clipping (e.g., clip a page daily).

### Context for Next Agent
- Use `turndown` (npm package) for HTML-to-markdown conversion. It is well-maintained and handles most HTML elements.
- For readability extraction, use `@mozilla/readability` or a simplified custom parser that strips `<nav>`, `<footer>`, `<aside>`, and common ad selectors.
- Image localization: for each `<img>` in the article, download the image, save via the attachments module, and replace the `src` URL with `attachment://[id]` in the markdown.
- The share extension on iOS is a separate target in the Xcode project. Expo supports share extensions via `expo-share-intent` or custom native modules.
- V2 migration coordination: shares V2 with image/file attachments, daily notes, and templates. Combine all into one V2.
- The Complexity score is 0 (most complex tier) because the share extension requires native platform integration.
