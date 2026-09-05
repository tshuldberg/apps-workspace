# MyBooks - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (spec-mybooks agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyBooks
- **Tagline:** Track your reading life
- **Module ID:** `books`
- **Feature ID Prefix:** `BK`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Casual Reader | Ages 18-35, reads 5-15 books/year, uses phone primarily | Track what they have read, get simple stats, find next book to read |
| Avid Reader | Ages 25-55, reads 30+ books/year, uses phone and tablet | Deep reading analytics, reading goals, detailed reviews, year-in-review |
| Book Club Member | Ages 20-45, participates in 1-3 book clubs | Group reading coordination, discussion threads, shared progress |
| Privacy-Conscious Reader | Any age, concerned about data exploitation | Full data ownership, no tracking, no Amazon/Goodreads profiling |
| Academic/Student | Ages 16-30, reads for study and pleasure | Annotation, highlights, notes per book, export for research |

### 1.3 Core Value Proposition

MyBooks is a privacy-first book tracking app that keeps all reading data on-device in local SQLite. Users manage their personal library, track reading sessions, set goals, write reviews, and analyze reading habits without any data leaving their device. Unlike Goodreads (owned by Amazon), MyBooks never shares reading habits with advertisers or recommendation engines. Your reading list is nobody's business but yours.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Goodreads | Massive community (150M+ users), Amazon integration, vast book database | Amazon-owned (data exploitation), bloated UI, slow, no offline mode | Full privacy, offline-first, no data monetization |
| Literal | Clean modern UI, social reading features | Requires account, cloud-only, limited stats | No account required, offline-first, deeper stats engine |
| StoryGraph | Excellent mood/pace-based discovery, no Amazon affiliation | Cloud-only, requires account, limited export | On-device mood discovery, full data export, no account needed |
| Bookly | Reading timer, good stats | Limited library management, subscription model | Complete library management, one-time purchase option |
| Apple Books | Native iOS integration, built-in reader | No cross-platform, limited tracking, no social | Cross-platform, rich tracking, book clubs |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export (CSV, JSON, Markdown) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export or opts into social features
- Book metadata is fetched from Open Library API but no user reading data is transmitted
- Search queries sent to Open Library contain only the search term (title/author/ISBN), never user identity
- Social features are entirely opt-in with granular visibility controls (private, friends, public)
- The recommendation engine runs entirely on-device using local ratings and reading patterns
- Journal entries support optional encryption with a user-provided passphrase

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| BK-001 | Library Management | P0 | Core | None | Implemented |
| BK-002 | Book Search (Open Library) | P0 | Core | BK-001 | Implemented |
| BK-003 | Barcode Scanning | P0 | Core | BK-001, BK-002 | Implemented |
| BK-004 | Shelves and Lists | P0 | Data Management | BK-001 | Implemented |
| BK-005 | Ratings and Reviews | P0 | Core | BK-001 | Implemented |
| BK-006 | Reading Sessions | P0 | Core | BK-001 | Implemented |
| BK-007 | Tags and Categorization | P1 | Data Management | BK-001 | Implemented |
| BK-008 | Reading Goals | P1 | Analytics | BK-006 | Implemented |
| BK-009 | Reading Statistics | P1 | Analytics | BK-001, BK-006 | Implemented |
| BK-010 | Year-in-Review | P1 | Analytics | BK-009 | Implemented |
| BK-011 | Full-Text Search (FTS5) | P1 | Data Management | BK-001 | Implemented |
| BK-012 | E-Reader | P1 | Core | BK-001 | Implemented |
| BK-013 | Reading Challenges | P1 | Analytics | BK-006 | Implemented |
| BK-014 | Encrypted Journal | P1 | Core | BK-001 | Implemented |
| BK-015 | Goodreads Import | P1 | Import/Export | BK-001 | Implemented |
| BK-016 | StoryGraph Import | P1 | Import/Export | BK-001 | Implemented |
| BK-017 | Data Export (CSV/JSON/Markdown) | P1 | Import/Export | BK-001 | Implemented |
| BK-018 | Series Management | P1 | Data Management | BK-001 | Implemented |
| BK-019 | Mood-Based Discovery | P1 | Data Management | BK-001, BK-007 | Implemented |
| BK-020 | Content Warnings | P1 | Data Management | BK-001 | Implemented |
| BK-021 | Reading Progress Tracking | P1 | Core | BK-006 | Implemented |
| BK-022 | Timed Reading Sessions | P1 | Core | BK-006 | Implemented |
| BK-023 | Share Events | P2 | Social | BK-001, BK-005 | Implemented |
| BK-024 | Book Recommendation Engine | P1 | Analytics | BK-001, BK-005, BK-007 | Not Started |
| BK-025 | Social Feed | P2 | Social | BK-001, BK-023 | Not Started |
| BK-026 | Badge/Achievement System | P2 | Analytics | BK-006, BK-009 | Not Started |
| BK-027 | Reading Stats Sharing | P2 | Social | BK-009, BK-010 | Not Started |
| BK-028 | Book Clubs | P2 | Social | BK-001, BK-006, BK-025 | Not Started |
| BK-029 | Author Following | P3 | Core | BK-001, BK-002 | Not Started |
| BK-030 | Reading Streak Tracking | P2 | Analytics | BK-006 | Not Started |
| BK-031 | Settings and Preferences | P0 | Settings | None | Implemented |
| BK-032 | Onboarding and First-Run | P1 | Onboarding | BK-001 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

---

## 3. Feature Specifications

### BK-001: Library Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-001 |
| **Feature Name** | Library Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to add books to my personal library, so that I can keep a record of everything I own, have read, or want to read.

**Secondary:**
> As an organized reader, I want to edit book details and delete books from my library, so that I can keep my collection accurate and tidy.

#### 3.3 Detailed Description

Library Management is the foundational feature of MyBooks. It provides the ability to create, read, update, and delete book records in the local SQLite database. Every book record stores comprehensive metadata including title, subtitle, authors, ISBNs (10 and 13), Open Library identifiers, cover image URL (with optional local cache path), publisher, publication year, page count, subjects/genres, description, language, format (physical, ebook, audiobook), and the source of how it was added (manual entry, search, barcode scan, or import).

Users can add books in three ways: manual entry (typing in details), searching the Open Library API (BK-002), or scanning a barcode (BK-003). Each method sets the `added_source` field accordingly so the user can see how each book entered their library.

The library view displays all books in a scrollable list or grid, sortable by title, author, date added, publication year, or page count. Users can filter by format, shelf assignment, tags, and reading status.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local storage for SQLite database
- File system access for cached cover images

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Library List

**Layout:**
- Top navigation bar displays "Library" title and a count badge showing total books (e.g., "Library (47)")
- Right side of nav bar has an "Add" button (plus icon) that opens an action sheet with options: "Search", "Scan Barcode", "Add Manually"
- Below the nav bar is a filter/sort toolbar with: a search text input (triggers FTS5 search when 2+ characters entered), a sort dropdown (Title A-Z, Title Z-A, Date Added, Author, Pages, Year Published), a view toggle (list/grid), and filter chips for format and shelf
- Main content area displays books in the selected view mode (list or grid)
- In list view: each row shows cover thumbnail (40x60px), title (bold, single line, truncated), author(s) (secondary text, single line), and format icon (book/tablet/headphones)
- In grid view: cover image fills card (3 columns), title below cover (2 lines max), author below title (1 line)
- Pull-to-refresh recalculates any computed data

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No books in library | Centered illustration of an empty bookshelf, heading "Your library is empty", subtext "Add your first book to get started", primary button "Search for a Book", secondary button "Scan a Barcode" |
| Loading | Database query in progress | Skeleton placeholders matching list/grid layout |
| Populated | 1+ books exist | Scrollable list/grid of book items |
| Error | Database read fails | Inline error banner: "Could not load your library. Pull down to retry." |
| Search Active | User types in search bar | Filtered results from FTS5; if no matches: "No books matching '[query]'" with suggestion to search Open Library |

**Interactions:**
- Tap book item: navigates to Book Detail screen
- Long press book item: opens context menu with "Edit", "Move to Shelf", "Delete"
- Swipe left on list item: reveals "Delete" action (red)
- Pull-to-refresh: reloads book list from database

##### Screen: Book Detail

**Layout:**
- Full-width cover image at top (if available), otherwise a colored placeholder with the book's first letter
- Below cover: title (large, bold), subtitle (if present, medium, secondary color), authors (tappable, secondary text)
- Metadata row: format icon + label, page count, publication year, language, publisher
- Horizontal divider
- Current reading status badge (color-coded: gray for want_to_read, blue for reading, green for finished, red for DNF)
- Shelves section: horizontal scrollable chips showing assigned shelves, plus "+" chip to add to shelf
- Tags section: horizontal scrollable chips showing assigned tags, plus "+" chip to add tag
- Rating display: half-star rating (if reviewed), tap to rate/edit
- Review section: review text (if exists), favorite quote, "Write Review" button if no review
- Reading sessions section: list of sessions with dates and status
- Series section (if part of a series): series name, position in series, other books in series
- Action buttons row: "Edit", "Share", "Delete"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Complete | All metadata present | Full detail view as described |
| Minimal | Only title and author | Detail view with empty sections collapsed |
| With Cover | Cover URL exists | Cover image rendered from URL or cache |
| Without Cover | No cover URL | Colored placeholder with initial letter |

**Interactions:**
- Tap "Edit": opens Edit Book modal
- Tap author name: filters library to books by that author
- Tap shelf chip: navigates to shelf view
- Tap rating stars: opens rating half-star picker
- Tap "Delete": confirmation dialog, then removes book and all related data (sessions, reviews, tags, shelf assignments)
- Tap "Share": generates a share card with book cover, title, author, and rating

##### Modal: Add Book Manually

**Layout:**
- Modal sheet sliding up from bottom
- Title: "Add Book"
- Form fields in scrollable view:
  - Title (required, text input, max 500 characters)
  - Subtitle (optional, text input, max 500 characters)
  - Authors (required, text input, comma-separated, max 1000 characters)
  - ISBN-13 (optional, text input, 13 digits)
  - ISBN-10 (optional, text input, 10 characters)
  - Page Count (optional, numeric input, min 1, max 99999)
  - Publisher (optional, text input, max 255 characters)
  - Publication Year (optional, numeric input, min 1000, max current year + 1)
  - Language (optional, text input, defaults to "en")
  - Format (segmented control: Physical, eBook, Audiobook, default Physical)
  - Description (optional, multiline text, max 5000 characters)
  - Cover URL (optional, text input for URL, or "Choose Image" button for local file)
- Footer: "Cancel" button (left) and "Save" button (right, disabled until title and authors are filled)

**Interactions:**
- Tap "Save": validates fields, generates UUID, inserts book record, closes modal, navigates to new Book Detail screen
- Tap "Cancel": dismisses modal with confirmation if form has unsaved data
- Inline validation: title field shows "Title is required" if blurred while empty

##### Modal: Edit Book

**Layout:**
- Same form fields as Add Book Manual, pre-populated with existing values
- Title: "Edit Book"
- Footer: "Cancel" and "Save Changes"

**Interactions:**
- Tap "Save Changes": validates, updates book record, updates FTS index (via trigger), closes modal
- Fields that changed are highlighted with a subtle indicator

#### 3.6 Data Requirements

##### Entity: Book

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| title | TEXT | Required, min 1 char | None | Book title |
| subtitle | TEXT | Optional | null | Book subtitle |
| authors | TEXT | Required, JSON array as string | None | Author names as JSON array, e.g., '["Author Name"]' |
| isbn_10 | TEXT | Optional, 10 characters | null | ISBN-10 identifier |
| isbn_13 | TEXT | Optional, 13 characters | null | ISBN-13 identifier |
| open_library_id | TEXT | Optional | null | Open Library work ID (e.g., "OL12345W") |
| open_library_edition_id | TEXT | Optional | null | Open Library edition ID |
| cover_url | TEXT | Optional, valid URL | null | URL to cover image |
| cover_cached_path | TEXT | Optional | null | Local file path to cached cover image |
| publisher | TEXT | Optional | null | Publisher name |
| publish_year | INTEGER | Optional, 1000-2100 | null | Year of publication |
| page_count | INTEGER | Optional, positive integer | null | Total page count |
| subjects | TEXT | Optional, JSON array as string | null | Subject/genre tags from Open Library |
| description | TEXT | Optional | null | Book description or synopsis |
| language | TEXT | Optional | 'en' | ISO language code |
| format | TEXT | One of: 'physical', 'ebook', 'audiobook' | 'physical' | Book format |
| added_source | TEXT | One of: 'search', 'scan', 'manual', 'import_goodreads', 'import_storygraph' | 'manual' | How the book was added |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Indexes:**
- `isbn_13` - Frequently queried for deduplication on import/scan
- `isbn_10` - Frequently queried for deduplication on import/scan
- `open_library_id` - Queried when refreshing metadata
- `title COLLATE NOCASE` - Sorted listing by title (case-insensitive)

**Validation Rules:**
- `title`: Must not be empty string after trimming whitespace
- `authors`: Must be a valid JSON array string with at least one non-empty string element
- `isbn_13`: If provided, must be exactly 13 characters
- `isbn_10`: If provided, must be exactly 10 characters
- `format`: Must be one of the allowed enum values
- `added_source`: Must be one of the allowed enum values

**Example Data:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Project Hail Mary",
  "subtitle": null,
  "authors": "[\"Andy Weir\"]",
  "isbn_10": "0593135202",
  "isbn_13": "9780593135204",
  "open_library_id": "OL20665488W",
  "open_library_edition_id": "OL32159931M",
  "cover_url": "https://covers.openlibrary.org/b/id/10741012-L.jpg",
  "cover_cached_path": null,
  "publisher": "Ballantine Books",
  "publish_year": 2021,
  "page_count": 496,
  "subjects": "[\"Science Fiction\",\"Space Exploration\"]",
  "description": "A lone astronaut must save the earth from disaster...",
  "language": "en",
  "format": "physical",
  "added_source": "search",
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-15T10:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Book Deduplication

**Purpose:** Prevent the same book from being added twice to the library.

**Inputs:**
- new_isbn_13: string (optional)
- new_isbn_10: string (optional)
- new_title: string
- new_authors: string

**Logic:**

```
1. IF new_isbn_13 is provided THEN
     Query: SELECT id FROM bk_books WHERE isbn_13 = new_isbn_13
     IF result exists THEN RETURN "duplicate" with existing book ID
2. IF new_isbn_10 is provided THEN
     Query: SELECT id FROM bk_books WHERE isbn_10 = new_isbn_10
     IF result exists THEN RETURN "duplicate" with existing book ID
3. Query: SELECT id FROM bk_books WHERE title = new_title COLLATE NOCASE
   IF result exists AND authors overlap THEN
     RETURN "possible_duplicate" with existing book ID (let user decide)
4. RETURN "unique" (no duplicate found)
```

**Edge Cases:**
- Different editions of the same book (different ISBNs): treated as separate books
- Same title by different authors: not flagged as duplicates
- Whitespace-only differences in title: trimmed before comparison

##### Cover Image Caching

**Purpose:** Cache cover images locally so they display without network.

**Logic:**

```
1. When a book with cover_url is displayed and cover_cached_path is null:
2. Download image from cover_url to local file system
3. Store local path in cover_cached_path
4. Display from local cache on subsequent views
5. IF download fails, display cover_url directly (requires network)
6. IF both fail, show placeholder
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Date added (most recent first)
- **Available sort options:** Title A-Z, Title Z-A, Date Added (newest), Date Added (oldest), Author A-Z, Page Count (high to low), Page Count (low to high), Publication Year (newest), Publication Year (oldest)
- **Filter options:** Format (physical/ebook/audiobook), Shelf assignment, Tag, Reading status. Filters are combinable (AND logic).
- **Search:** FTS5 full-text search across title, subtitle, authors, and subjects. Supports prefix matching and Porter stemming.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on add | Toast: "Could not save book. Please try again." | User taps retry or re-submits form |
| Database write fails on edit | Toast: "Could not update book. Please try again." | User taps retry |
| Required field left blank | Inline validation below field: "Title is required" | User fills field, error clears on input |
| Duplicate ISBN detected | Dialog: "This book may already be in your library. View existing?" with "View" and "Add Anyway" buttons | User chooses to view existing or force add |
| Cover image download fails | Placeholder image shown, no error toast | System retries on next view |

**Validation Timing:**
- Field-level validation runs on blur
- Form-level validation runs on save button tap
- Deduplication check runs on save, before insert

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the library is empty,
   **When** the user taps "Add" then "Add Manually", fills in title "Dune" and author "Frank Herbert", and taps Save,
   **Then** a new book record is created, the library shows 1 book, and the user is navigated to the Book Detail screen.

2. **Given** a book exists in the library,
   **When** the user taps the book, then taps "Edit", changes the title, and saves,
   **Then** the book title is updated in the database and reflected everywhere in the UI.

3. **Given** a book exists in the library,
   **When** the user taps the book, then taps "Delete" and confirms,
   **Then** the book and all its related records (sessions, reviews, shelf assignments, tags) are deleted.

**Edge Cases:**

4. **Given** a book with ISBN "9780593135204" exists,
   **When** the user adds another book with the same ISBN,
   **Then** a duplicate warning dialog appears offering to view the existing book or add anyway.

5. **Given** 500 books in the library,
   **When** the user scrolls through the list,
   **Then** the list renders smoothly with no jank (60fps target, virtualized list).

**Negative Tests:**

6. **Given** the Add Book form is open,
   **When** the user leaves the title field empty and taps Save,
   **Then** the system shows inline error "Title is required" and does not create a record.

7. **Given** the Add Book form is open,
   **When** the user enters only whitespace in the title field and taps Save,
   **Then** the system shows inline error "Title is required" and does not create a record.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates book with minimum required fields | title: "Test", authors: '["Auth"]' | Book record with id, title, authors, default format "physical", default source "manual" |
| rejects empty title | title: "" | Zod validation error on title field |
| rejects whitespace-only title | title: "   " | Zod validation error on title field |
| accepts all three format values | format: each of physical/ebook/audiobook | Valid book for each format |
| rejects invalid format | format: "pdf" | Zod validation error on format field |
| stores authors as JSON array string | authors: '["A","B"]' | authors field contains '["A","B"]' |
| sets created_at and updated_at on insert | (any valid book) | Both timestamps set to current time |
| updates updated_at on edit without changing created_at | (existing book, edit title) | created_at unchanged, updated_at updated |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add book and verify in library list | 1. Insert book via CRUD, 2. Query all books | New book appears in result set |
| Delete book cascades to related records | 1. Add book, 2. Add review for book, 3. Add session for book, 4. Delete book | Book, review, and session all removed |
| Edit book updates FTS index | 1. Add book with title "Original", 2. Update title to "Changed", 3. FTS search for "Changed" | FTS returns the updated book |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user adds first book manually | 1. Open app (empty library), 2. Tap add, 3. Choose "Add Manually", 4. Fill title + author, 5. Save | Library shows 1 book, detail screen displays correct info |
| User manages library with 100+ books | 1. Import 100 books via Goodreads CSV, 2. Sort by title A-Z, 3. Filter by "ebook" format, 4. Verify filtered count | Filtered list shows only ebooks, sorted alphabetically |

---

### BK-002: Book Search (Open Library)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-002 |
| **Feature Name** | Book Search (Open Library) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to search for books by title, author, or ISBN, so that I can quickly add books to my library with complete metadata.

**Secondary:**
> As a reader adding a new book, I want the app to auto-fill book details from a search result, so that I do not have to type everything manually.

#### 3.3 Detailed Description

Book Search connects to the Open Library API (openlibrary.org) to search their catalog of 40M+ records. Users type a query (title, author, or ISBN) and see paginated results with cover thumbnails. Tapping a result auto-fills the Add Book form with all available metadata (title, authors, ISBNs, cover URL, publisher, year, page count, subjects, description). The user can review and edit before saving.

The search caches results in `bk_ol_cache` to reduce redundant API calls. Cached results are served when the same ISBN is queried again within a configurable TTL (default: 7 days).

Open Library provides work-level and edition-level data. The search endpoint returns work-level results. When a user selects a result, the app fetches the best edition (preferring English, most complete metadata) to populate page count and ISBNs.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Search results are added to the library

**External Dependencies:**
- Network access for Open Library API calls
- Open Library API availability (public, no API key required, rate limited)

**Assumed Capabilities:**
- User has network connectivity
- Open Library API endpoints: `/search.json`, `/works/{olid}.json`, `/books/{olid}.json`, `/authors/{olid}.json`

#### 3.5 User Interface Requirements

##### Screen: Book Search

**Layout:**
- Search bar at top with auto-focus and placeholder text "Search by title, author, or ISBN..."
- Below search bar: recent search terms (up to 5, tappable to re-search)
- Search results appear in a scrollable list below
- Each result row shows: cover thumbnail (40x60px), title (bold), author(s) (secondary), first publish year, and edition count
- At bottom of results: "Load More" button if more pages available
- Floating "Add Manually" link at bottom for when search does not find the book

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle | No search performed | Recent searches list, or prompt "Search Open Library's catalog of 40 million books" |
| Loading | API request in progress | Skeleton rows (3-5 placeholder cards) |
| Results | API returned matches | Scrollable list of result rows |
| No Results | API returned 0 matches | "No books found for '[query]'. Try a different search or add manually." with "Add Manually" button |
| Error | Network or API error | "Could not connect to Open Library. Check your connection and try again." with "Retry" button |
| Offline | No network detected | "Search requires an internet connection. You can add books manually while offline." with "Add Manually" button |

**Interactions:**
- Type in search bar: debounced search (300ms delay after last keystroke, minimum 2 characters)
- Tap result: opens a pre-filled Add Book form with metadata from the search result
- Tap "Load More": fetches next page of results (page size: 20)
- Tap recent search term: re-runs that search
- Tap "X" on search bar: clears query, returns to idle state

#### 3.6 Data Requirements

##### Entity: OLCache

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| isbn | TEXT | Primary key | None | ISBN used as cache key |
| response_json | TEXT | Required, valid JSON | None | Full API response as JSON string |
| cover_downloaded | INTEGER | 0 or 1 | 0 | Whether cover image has been cached locally |
| fetched_at | TEXT | ISO datetime | Current timestamp | When the cache entry was created |

**Validation Rules:**
- `isbn`: Must not be empty
- `response_json`: Must be valid JSON string
- Cache entries older than 7 days are considered stale and re-fetched

#### 3.7 Business Logic Rules

##### Search Query Processing

**Purpose:** Transform user input into an effective Open Library API query.

**Logic:**

```
1. Trim whitespace from query
2. IF query looks like ISBN (10 or 13 digits, optional hyphens):
     Strip hyphens
     Call /search.json?isbn={isbn}
3. ELSE:
     Call /search.json?q={query}&limit=20&offset={page * 20}
4. Parse response into OLSearchDoc array
5. For each doc, extract: title, author_name, first_publish_year,
   cover_i (for cover URL), key (work ID), isbn (array)
6. RETURN formatted results
```

##### API Response Transformation

**Purpose:** Convert Open Library search doc to BookInsert format.

**Logic:**

```
1. Map OLSearchDoc fields to BookInsert:
   - title -> title
   - author_name[0..n] -> authors (as JSON array)
   - isbn[0] (13-digit preferred) -> isbn_13
   - isbn[1] (10-digit) -> isbn_10
   - cover_i -> cover_url (https://covers.openlibrary.org/b/id/{cover_i}-L.jpg)
   - first_publish_year -> publish_year
   - subject[0..n] -> subjects (as JSON array)
   - key -> open_library_id
2. Set added_source = 'search'
3. RETURN BookInsert object
```

**Edge Cases:**
- Book with no cover image: cover_url is null, placeholder shown in UI
- Book with no ISBN: isbn_10 and isbn_13 are null
- Book with multiple editions: first result's data used, user can edit
- API rate limiting (429 response): show "Too many searches. Please wait a moment." and retry after 5 seconds

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Network timeout (5 second limit) | "Search timed out. Check your connection and try again." | User taps Retry |
| API returns 429 (rate limited) | "Too many searches. Please wait a moment." | Auto-retry after 5 seconds, up to 3 attempts |
| API returns 500+ (server error) | "Open Library is temporarily unavailable. Try again later." | User taps Retry |
| Malformed API response | Results omitted silently, valid results still shown | No user action needed |
| No network | "Search requires an internet connection." | User enables network or uses manual add |

#### 3.9 Acceptance Criteria

1. **Given** the user is on the Search screen with network,
   **When** they type "Project Hail Mary",
   **Then** results from Open Library appear within 3 seconds showing the book by Andy Weir.

2. **Given** search results are displayed,
   **When** the user taps a result,
   **Then** the Add Book form opens pre-filled with title, author, ISBN, cover, and other metadata.

3. **Given** the user searches with an ISBN "9780593135204",
   **When** results load,
   **Then** the exact edition matching that ISBN appears as the top result.

4. **Given** no network connection,
   **When** the user attempts to search,
   **Then** an offline message is displayed with an option to add books manually.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| transforms OL search doc to BookInsert | OLSearchDoc with all fields | BookInsert with mapped fields, added_source "search" |
| handles missing cover_i | OLSearchDoc with cover_i: undefined | BookInsert with cover_url: null |
| detects ISBN query (13 digits) | "9780593135204" | Query sent as isbn= parameter |
| detects ISBN query with hyphens | "978-0-593-13520-4" | Hyphens stripped, sent as isbn= |
| treats non-ISBN as title query | "Dune Frank Herbert" | Query sent as q= parameter |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Search and add book | 1. Search "Dune", 2. Tap first result, 3. Save | Book added to library with OL metadata |
| Cache prevents duplicate API call | 1. Search by ISBN, 2. Search same ISBN again | Second search served from bk_ol_cache, no API call |

---

### BK-003: Barcode Scanning

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-003 |
| **Feature Name** | Barcode Scanning |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to scan a book's barcode with my phone camera, so that I can instantly add it to my library without typing anything.

#### 3.3 Detailed Description

Barcode Scanning uses the device camera to read ISBN barcodes (EAN-13 format) printed on book covers. When a valid ISBN is detected, the app automatically searches the Open Library API for that ISBN, retrieves full metadata, and presents the pre-filled Add Book form. This is the fastest way to add physical books.

The scanner supports both standard EAN-13 barcodes and the older ISBN-10 format. Multiple scans can be performed in sequence without returning to the library (batch mode).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Scanned books are added to the library
- BK-002: Book Search - ISBN is looked up via Open Library API

**External Dependencies:**
- Camera hardware and permission
- Network access for ISBN lookup via Open Library

#### 3.5 User Interface Requirements

##### Screen: Barcode Scanner

**Layout:**
- Full-screen camera viewfinder
- Semi-transparent overlay with a centered rectangular scanning region (guides)
- Top bar: "Cancel" button (left), "Scan a Book" title (center)
- Bottom area: brief instruction text "Point your camera at the barcode on the back of the book"
- When barcode detected: brief haptic feedback, scanning region flashes green

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Scanning | Camera active, no barcode detected | Live camera feed with scanning guides |
| Detected | Valid barcode read | Green flash, haptic, auto-transition to lookup |
| Looking Up | ISBN sent to Open Library | Loading spinner overlay: "Looking up ISBN..." |
| Found | Book metadata returned | Transition to pre-filled Add Book form |
| Not Found | ISBN not in Open Library | Dialog: "Book not found for ISBN [isbn]. Add manually?" with "Add Manually" and "Scan Again" buttons |
| Camera Denied | User denied camera permission | Message: "Camera access is needed to scan barcodes. Enable in Settings." with "Open Settings" button |

**Interactions:**
- Hold phone over barcode: auto-detects and reads
- Tap "Cancel": returns to library
- After successful add: scanner remains open for batch scanning (toast "Book added!" at top)

#### 3.6 Data Requirements

No new entities. Scanned books use the Book entity (BK-001) with `added_source` set to `'scan'`.

#### 3.7 Business Logic Rules

##### Barcode Processing

**Logic:**

```
1. Camera detects EAN-13 barcode
2. Extract 13-digit number
3. IF starts with 978 or 979 (book ISBN prefix):
     Treat as ISBN-13
4. ELSE:
     Show "Not a book barcode. Please scan the ISBN barcode."
5. Check bk_books for existing book with this ISBN-13
6. IF duplicate found:
     Show duplicate dialog (same as BK-001 dedup)
7. ELSE:
     Call Open Library API with ISBN (BK-002 flow)
8. On success: present pre-filled Add Book form
```

**Edge Cases:**
- QR codes or non-ISBN barcodes: ignored with message "Not a book barcode"
- Book has only ISBN-10 barcode: convert to ISBN-13 using standard algorithm
- Multiple barcodes in frame: prioritize the one closest to center of scanning region

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | Instruction to enable in Settings | User opens device Settings |
| Non-book barcode scanned | Toast: "Not a book barcode. Look for the ISBN barcode." | User repositions camera |
| ISBN not found in Open Library | Dialog with "Add Manually" and "Scan Again" options | User chooses path |
| Network unavailable | "Cannot look up book without internet. Save ISBN and try later?" | ISBN stored, manual add offered |

#### 3.9 Acceptance Criteria

1. **Given** the scanner is open and camera is active,
   **When** the user points at a valid ISBN barcode,
   **Then** the barcode is read within 2 seconds, haptic feedback fires, and Open Library lookup begins.

2. **Given** a barcode is successfully read,
   **When** Open Library returns metadata,
   **Then** the Add Book form opens pre-filled with the book's details.

3. **Given** a book with the scanned ISBN already exists in the library,
   **When** the barcode is scanned,
   **Then** the duplicate warning dialog appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates ISBN-13 prefix 978 | "9780593135204" | Valid ISBN |
| validates ISBN-13 prefix 979 | "9791234567890" | Valid ISBN |
| rejects non-book EAN | "5901234123457" | Invalid: not a book barcode |
| converts ISBN-10 to ISBN-13 | "0593135202" | "9780593135204" |

---

### BK-004: Shelves and Lists

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-004 |
| **Feature Name** | Shelves and Lists |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to organize my books into shelves like "Want to Read", "Currently Reading", and "Finished", so that I can easily see what I am reading and what is next.

**Secondary:**
> As an organized reader, I want to create custom shelves (like "Favorites", "Book Club Picks", "Lent Out"), so that I can categorize books beyond the default reading statuses.

#### 3.3 Detailed Description

Shelves provide the primary organizational structure for books. Three system shelves are created automatically and cannot be deleted or renamed: "Want to Read", "Currently Reading", and "Finished". Users can create unlimited custom shelves with custom names, icons, and colors.

A book can belong to multiple shelves simultaneously. The book-shelf relationship is many-to-many via a junction table. Each shelf tracks its own book count for quick display without querying the junction table.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Books must exist to be shelved

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Shelf List (within Library tab)

**Layout:**
- Section header "Shelves" with "Manage" button on right
- Horizontal scrollable row of shelf cards, or vertical list depending on view mode
- Each shelf card shows: icon, shelf name, book count badge
- System shelves always appear first in order: Want to Read, Currently Reading, Finished
- Custom shelves appear after, in user-defined sort order
- "+" card at end to create new shelf

**Interactions:**
- Tap shelf card: navigates to shelf detail showing only books on that shelf
- Tap "+": opens Create Shelf modal
- Tap "Manage": opens Shelf Management screen (reorder, edit, delete custom shelves)

##### Modal: Create/Edit Shelf

**Layout:**
- Name input (required, max 100 characters, unique)
- Icon picker (emoji selector)
- Color picker (preset palette of 12 colors)
- "Save" and "Cancel" buttons

**Interactions:**
- Save: creates shelf record, returns to shelf list
- Name uniqueness validated on save (case-insensitive)

#### 3.6 Data Requirements

##### Entity: Shelf

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| name | TEXT | Required, unique, min 1, max 100 | None | Shelf display name |
| slug | TEXT | Required, unique | None | URL-safe identifier |
| icon | TEXT | Optional | null | Emoji or icon identifier |
| color | TEXT | Optional | null | Hex color code |
| is_system | INTEGER | 0 or 1 | 0 | Whether this is a system shelf (non-deletable) |
| sort_order | INTEGER | Non-negative | 0 | Display order (lower = first) |
| book_count | INTEGER | Non-negative | 0 | Cached count of books on this shelf |
| created_at | TEXT | ISO datetime | Current timestamp | Record creation time |

##### Entity: BookShelf (Junction)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE | None | Book reference |
| shelf_id | TEXT (UUID) | References bk_shelves.id, ON DELETE CASCADE | None | Shelf reference |
| added_at | TEXT | ISO datetime | Current timestamp | When book was added to shelf |

**Primary Key:** Composite (book_id, shelf_id)

**System Shelf Seeds:**

| ID | Name | Slug | Icon | Sort Order |
|-----|------|------|------|-----------|
| shelf-tbr | Want to Read | want-to-read | book stack emoji | 0 |
| shelf-reading | Currently Reading | currently-reading | open book emoji | 1 |
| shelf-finished | Finished | finished | checkmark emoji | 2 |

#### 3.7 Business Logic Rules

##### Book Count Maintenance

**Purpose:** Keep the cached `book_count` field on shelves accurate.

**Logic:**

```
1. On INSERT into bk_book_shelves:
     UPDATE bk_shelves SET book_count = book_count + 1 WHERE id = shelf_id
2. On DELETE from bk_book_shelves:
     UPDATE bk_shelves SET book_count = book_count - 1 WHERE id = shelf_id
3. book_count must never go below 0
```

##### System Shelf Protection

**Logic:**

```
1. IF shelf.is_system = 1 THEN
     Block: rename, delete, change icon
     Allow: change color, change sort_order
```

**Edge Cases:**
- Deleting a custom shelf does not delete the books on it (only removes the junction records)
- A book with no shelf assignments still appears in the main library view

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate shelf name | Inline error: "A shelf named '[name]' already exists." | User changes name |
| Attempt to delete system shelf | Action not available in UI (delete button hidden for system shelves) | N/A |
| Attempt to rename system shelf | Action not available in UI (name field disabled for system shelves) | N/A |

#### 3.9 Acceptance Criteria

1. **Given** the app is freshly installed,
   **When** the user opens the Library tab,
   **Then** three system shelves exist: "Want to Read" (0), "Currently Reading" (0), "Finished" (0).

2. **Given** the user creates a custom shelf "Summer Reads",
   **When** they add a book to it,
   **Then** the shelf shows book_count = 1 and the book appears when the shelf is tapped.

3. **Given** a book is on two shelves ("Currently Reading" and "Book Club"),
   **When** the user removes it from "Book Club",
   **Then** it remains on "Currently Reading" and "Book Club" count decreases by 1.

4. **Given** the user tries to create a shelf named "Want to Read" (already exists),
   **Then** an error message appears and the shelf is not created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| system shelves seeded on init | (fresh database) | 3 shelves with is_system=1, correct names and slugs |
| prevents duplicate shelf name | name: "Want to Read" | Error: name not unique |
| book_count increments on add | add book to shelf | shelf.book_count = previous + 1 |
| book_count decrements on remove | remove book from shelf | shelf.book_count = previous - 1 |
| deleting shelf preserves books | delete custom shelf with 3 books | 3 books still in library, junction records removed |

---

### BK-005: Ratings and Reviews

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-005 |
| **Feature Name** | Ratings and Reviews |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to rate books on a half-star scale (0.5 to 5.0), so that I can record nuanced opinions about what I have read.

**Secondary:**
> As a reader, I want to write a text review and save a favorite quote, so that I can remember my thoughts about each book.

#### 3.3 Detailed Description

Ratings use a half-star system allowing values from 0.5 to 5.0 in 0.5 increments, providing 10 possible rating values. This is more nuanced than Goodreads' integer-only 1-5 scale. Reviews include free-text review content, an optional favorite quote field, and a "favorite" toggle. A review is linked to a specific book and optionally to a specific reading session.

Users can rate without writing a review (rating-only) or write a review without a rating (text-only). Both are optional and independent.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Reviews are attached to books

#### 3.5 User Interface Requirements

##### Component: Half-Star Rating Picker

**Layout:**
- Row of 5 star outlines
- Tapping the left half of a star sets that star to half-filled (e.g., tapping left half of star 3 = 2.5)
- Tapping the right half fills the full star (e.g., tapping right half of star 3 = 3.0)
- Current rating displayed as number beside stars (e.g., "3.5")
- Tap current rating to clear (set to null/unrated)

##### Screen: Write Review

**Layout:**
- Half-star rating picker at top
- "Favorite" toggle (heart icon) on right of rating row
- Multiline text input for review (placeholder: "What did you think?", max 10000 characters)
- Single-line text input for favorite quote (placeholder: "Favorite quote from the book", max 2000 characters)
- Character count shown below each text field
- "Save" button at bottom

**Interactions:**
- Tap star position: sets half-star rating with haptic feedback
- Tap heart: toggles favorite status
- Tap Save: validates and saves review record

#### 3.6 Data Requirements

##### Entity: Review

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE, Required | None | Associated book |
| session_id | TEXT (UUID) | References bk_reading_sessions.id, ON DELETE SET NULL, Optional | null | Associated reading session |
| rating | REAL | Min 0.5, Max 5.0, step 0.5, nullable | null | Half-star rating |
| review_text | TEXT | Optional, max 10000 chars | null | Written review content |
| favorite_quote | TEXT | Optional, max 2000 chars | null | User's favorite quote from the book |
| is_favorite | INTEGER | 0 or 1 | 0 | Whether user marked book as a favorite |
| created_at | TEXT | ISO datetime | Current timestamp | Review creation time |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification time |

**Indexes:**
- `book_id` - Queried when loading book detail
- `rating` - Used in stats calculations and sorting
- `is_favorite` (partial, WHERE is_favorite = 1) - Quick lookup of favorites

**Validation Rules:**
- `rating`: If provided, must be a multiple of 0.5 between 0.5 and 5.0 inclusive
- A review must have either a rating or review_text (or both); a completely empty review is not saved

#### 3.7 Business Logic Rules

##### Rating Statistics

**Purpose:** Compute average rating and distribution for stats display.

**Logic:**

```
1. Collect all reviews with non-null rating
2. average_rating = SUM(ratings) / COUNT(ratings), rounded to 2 decimal places
3. rating_distribution = count of reviews per rating value (0.5, 1.0, ... 5.0)
4. IF no ratings exist, average_rating = null
```

**Edge Cases:**
- Book with multiple reviews (re-reads): each session can have its own review; stats use all ratings
- Rating of exactly 0 is not allowed (minimum is 0.5)
- Clearing a rating sets it to null, not 0

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Save with no rating and no text | Toast: "Add a rating or write something to save your review." | User adds content |
| Database write fails | Toast: "Could not save review. Please try again." | User retaps Save |

#### 3.9 Acceptance Criteria

1. **Given** a book detail screen,
   **When** the user taps the left half of the third star,
   **Then** the rating is set to 2.5 and displayed as "2.5" with 2.5 stars filled.

2. **Given** a review with rating 4.0 and review text,
   **When** saved,
   **Then** the review appears on the book detail screen showing stars, text, and timestamp.

3. **Given** the user wants to mark a book as favorite,
   **When** they tap the heart toggle,
   **Then** `is_favorite` is set to 1 and the book appears in the favorites filter.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| accepts valid half-star ratings | rating: 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0 | All pass validation |
| rejects rating below 0.5 | rating: 0.0 | Validation error |
| rejects rating above 5.0 | rating: 5.5 | Validation error |
| rejects non-half-star value | rating: 2.3 | Validation error (not multiple of 0.5) |
| allows null rating with review text | rating: null, review_text: "Good book" | Valid review |
| calculates average rating correctly | ratings: [3.0, 4.5, 5.0] | average: 4.17 |
| handles zero ratings for average | ratings: [] | average: null |

---

### BK-006: Reading Sessions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-006 |
| **Feature Name** | Reading Sessions |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to track my reading progress through a book with start and finish dates, so that I can see how long each book took me to read.

**Secondary:**
> As a reader who abandons some books, I want to mark a book as "Did Not Finish" with a reason, so that I can remember why I stopped reading it.

#### 3.3 Detailed Description

A Reading Session represents one read-through of a book. It tracks the reading status lifecycle: want_to_read -> reading -> finished (or dnf). Each session records start date, finish date, current page, and optional DNF reason. A single book can have multiple sessions (for re-reads).

The reading status is the most important organizational signal in the app. It determines which system shelf a book appears on and drives statistics calculations. Only "finished" sessions count toward reading goals and year-in-review.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Sessions are attached to books

#### 3.5 User Interface Requirements

##### Component: Status Picker

**Layout:**
- Segmented control or bottom sheet with four options:
  - "Want to Read" (gray, bookmark icon)
  - "Reading" (blue, open book icon)
  - "Finished" (green, checkmark icon)
  - "DNF" (red, x-circle icon)
- Current status is highlighted

**Interactions:**
- Tap "Reading": sets started_at to now (if not already set), status to 'reading'
- Tap "Finished": sets finished_at to now, status to 'finished', triggers challenge auto-logging
- Tap "DNF": opens DNF reason dialog, then sets status to 'dnf'
- Tap "Want to Read": resets to initial state (clears dates if moving backwards)

#### 3.6 Data Requirements

##### Entity: ReadingSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE | None | Associated book |
| started_at | TEXT | ISO datetime, optional | null | When the user started reading |
| finished_at | TEXT | ISO datetime, optional | null | When the user finished reading |
| current_page | INTEGER | Non-negative | 0 | Current page number |
| status | TEXT | One of: 'want_to_read', 'reading', 'finished', 'dnf' | 'want_to_read' | Current reading status |
| dnf_reason | TEXT | Optional | null | Why the user did not finish |
| created_at | TEXT | ISO datetime | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification time |

**Indexes:**
- `book_id` - Queried when loading book detail
- `status` - Filtered views by reading status
- `finished_at` - Used in stats and year-in-review calculations
- `started_at` - Used in reading duration calculations

#### 3.7 Business Logic Rules

##### State Machine: Reading Status

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| want_to_read | User taps "Reading" | reading | Set started_at to now |
| want_to_read | User taps "Finished" | finished | Set started_at to now, finished_at to now |
| reading | User taps "Finished" | finished | Set finished_at to now, trigger BK-013 challenge logging, trigger BK-030 streak update |
| reading | User taps "DNF" | dnf | Set finished_at to now, prompt for dnf_reason |
| reading | User taps "Want to Read" | want_to_read | Clear started_at |
| finished | User taps "Reading" (re-read) | reading | Create NEW session with started_at = now |
| dnf | User taps "Reading" (retry) | reading | Create NEW session with started_at = now |

**Edge Cases:**
- Finishing a book with no page_count: reading speed cannot be calculated, stats note "unknown page count"
- Multiple active "reading" sessions for different books: all valid, user can read multiple books
- Re-reading a finished book: creates a new session, original remains with its dates

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Status update fails | Toast: "Could not update reading status." | User retries |
| DNF without reason | Allowed (reason is optional), but dialog prompts for one | User can skip or type reason |

#### 3.9 Acceptance Criteria

1. **Given** a book with status "want_to_read",
   **When** the user changes status to "reading",
   **Then** `started_at` is set to current timestamp and the book moves to "Currently Reading" shelf.

2. **Given** a book with status "reading",
   **When** the user changes status to "finished",
   **Then** `finished_at` is set, the book moves to "Finished" shelf, and active challenges are updated.

3. **Given** a finished book,
   **When** the user wants to re-read it,
   **Then** a new reading session is created (original session preserved) with status "reading".

4. **Given** a book being read,
   **When** the user marks it DNF and provides reason "Too slow pacing",
   **Then** status is "dnf", dnf_reason is saved, finished_at is set.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| valid status transitions | want_to_read -> reading | Valid, started_at set |
| sets finished_at on completion | reading -> finished | finished_at = now |
| allows re-read from finished | finished -> reading | New session created |
| allows retry from dnf | dnf -> reading | New session created |
| preserves original session on re-read | (existing finished session) | Original session unchanged, new session created |

---

### BK-007: Tags and Categorization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-007 |
| **Feature Name** | Tags and Categorization |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to tag books with custom labels, so that I can create my own categorization system beyond shelves and genres.

#### 3.3 Detailed Description

Tags provide a flexible, user-defined categorization system. Unlike shelves (which represent reading state/lists), tags represent content attributes or personal categories (e.g., "mind-bending", "comfort read", "gift from mom", "thesis research"). A book can have unlimited tags. Tags have names, optional colors, and track their usage count for quick sorting by popularity.

Tags are distinct from mood tags (BK-019) which use a fixed vocabulary for discovery filtering. User tags are free-form.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Tags are attached to books

#### 3.5 User Interface Requirements

##### Component: Tag Chips

**Layout:**
- Horizontal scrollable row of tag chips on Book Detail screen
- Each chip shows tag name with optional color dot
- "+" chip at end to add a new tag
- Tap chip: filters library by that tag
- Long press chip: options to edit tag color or remove from this book

##### Modal: Add/Create Tag

**Layout:**
- Text input with auto-complete dropdown showing existing tags sorted by usage_count (most used first)
- Color picker (12 preset colors, optional)
- "Create" button for new tags, or tap existing tag to assign

#### 3.6 Data Requirements

##### Entity: Tag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| name | TEXT | Required, unique, min 1, max 100 | None | Tag display name |
| color | TEXT | Optional, hex color | null | Tag color for display |
| usage_count | INTEGER | Non-negative | 0 | Number of books using this tag |
| created_at | TEXT | ISO datetime | Current timestamp | Tag creation time |

##### Entity: BookTag (Junction)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE | None | Book reference |
| tag_id | TEXT (UUID) | References bk_tags.id, ON DELETE CASCADE | None | Tag reference |

**Primary Key:** Composite (book_id, tag_id)

**Indexes:**
- `name` on tags - Autocomplete search
- `usage_count DESC` on tags - Sort by popularity
- `tag_id` on book_tags - Reverse lookup

#### 3.7 Business Logic Rules

##### Usage Count Maintenance

**Logic:**

```
1. On INSERT into bk_book_tags: UPDATE bk_tags SET usage_count = usage_count + 1
2. On DELETE from bk_book_tags: UPDATE bk_tags SET usage_count = usage_count - 1
3. usage_count must never go below 0
```

##### Orphan Tag Cleanup

**Logic:**

```
1. Tags with usage_count = 0 are NOT auto-deleted (user may reuse them)
2. User can manually delete unused tags from tag management screen
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate tag name | Auto-complete suggests existing tag instead of creating duplicate | User selects existing tag |
| Empty tag name | "Tag name is required" inline error | User enters name |

#### 3.9 Acceptance Criteria

1. **Given** a book with no tags,
   **When** the user adds tag "Science Fiction",
   **Then** the tag chip appears on the book detail and tag usage_count increments.

2. **Given** a tag "Favorites" used on 5 books,
   **When** the user removes the tag from one book,
   **Then** usage_count decreases to 4 and the tag remains available.

3. **Given** the user types "sci" in the tag input,
   **Then** existing tags containing "sci" appear in autocomplete dropdown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates tag with valid name | name: "Fantasy" | Tag created with usage_count 0 |
| rejects duplicate tag name | name: "Fantasy" (exists) | Error: name not unique |
| increments usage on book assignment | assign tag to book | usage_count + 1 |
| decrements usage on book removal | remove tag from book | usage_count - 1 |

---

### BK-008: Reading Goals

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-008 |
| **Feature Name** | Reading Goals |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to set an annual reading goal (e.g., "Read 24 books in 2026"), so that I can motivate myself to read more and track my progress throughout the year.

**Secondary:**
> As a data-oriented reader, I want to set a page count goal alongside my book count goal, so that I can track total pages read in a year.

#### 3.3 Detailed Description

Reading Goals allow users to set annual targets for books read and optionally pages read. The system tracks progress automatically by counting finished reading sessions for the goal year. Progress is displayed as a visual bar/ring showing percent complete, with projected completion based on current pace.

Only one goal per year is allowed (enforced by unique index on year). Goals are separate from Reading Challenges (BK-013), which are more flexible and support custom time frames and themed challenges.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-006: Reading Sessions - Goal progress is counted from finished sessions

#### 3.5 User Interface Requirements

##### Component: Goal Progress Card (Home Tab)

**Layout:**
- Circular progress ring showing percent complete
- Center of ring: "12 / 24 books" (current/target)
- Below ring: "On track" or "Behind by X books" or "Ahead by X books" based on pace
- If page goal set: secondary progress bar below with "3,200 / 8,000 pages"
- Tap card: navigates to Goal Detail screen

##### Screen: Set/Edit Goal

**Layout:**
- Year selector (defaults to current year)
- Book target input (numeric, min 1, max 9999)
- Page target input (optional, numeric, min 1, max 999999)
- "Save Goal" button

#### 3.6 Data Requirements

##### Entity: ReadingGoal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| year | INTEGER | Required, 1900-2100, unique | None | Goal year |
| target_books | INTEGER | Required, positive | None | Target number of books to read |
| target_pages | INTEGER | Optional, positive | null | Target number of pages to read |
| created_at | TEXT | ISO datetime | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification time |

**Indexes:**
- Unique index on `year` - Only one goal per year

#### 3.7 Business Logic Rules

##### Goal Progress Calculation

**Purpose:** Determine current progress toward annual goal.

**Inputs:**
- goal: ReadingGoal
- finished_sessions: sessions with status='finished' and finished_at in goal.year

**Logic:**

```
1. books_read = COUNT(finished_sessions in goal.year)
2. percent_complete = (books_read / goal.target_books) * 100, capped at 100
3. days_elapsed = days since Jan 1 of goal.year
4. days_in_year = 365 (or 366 for leap year)
5. expected_pace = goal.target_books * (days_elapsed / days_in_year)
6. IF books_read >= expected_pace THEN status = "on_track" or "ahead"
7. ELSE status = "behind"
8. books_behind = CEIL(expected_pace) - books_read
9. projected_total = ROUND(books_read * (days_in_year / days_elapsed))
```

**Edge Cases:**
- Goal set mid-year: pace calculation starts from Jan 1 regardless
- Zero days elapsed (Jan 1): projected_total = 0, status = "on_track"
- Goal already exceeded: show "Goal reached! X books beyond target"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Goal already exists for year | "You already have a goal for [year]. Edit it instead?" | Navigate to edit |
| Target of 0 books | Validation: "Target must be at least 1 book" | User enters valid number |

#### 3.9 Acceptance Criteria

1. **Given** no goal for 2026,
   **When** the user sets a goal of 24 books,
   **Then** the goal card appears showing "0 / 24 books" with 0% progress.

2. **Given** a goal of 24 books for 2026 and 6 books finished by March 31,
   **When** the progress is calculated,
   **Then** expected pace is ~6 books, status is "on_track", percent is 25%.

3. **Given** a goal of 12 books and 15 finished,
   **When** progress is displayed,
   **Then** progress shows 100% with message "Goal reached! 3 books beyond target."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates percent complete | 6 of 24 | 25% |
| caps percent at 100 | 30 of 24 | 100% |
| detects on_track pace | 6 books by day 90 of 365, target 24 | on_track (expected ~5.9) |
| detects behind pace | 3 books by day 180 of 365, target 24 | behind by ~9 books |
| prevents duplicate year goal | year: 2026 (exists) | Error: unique constraint |
| handles leap year | year: 2028 | days_in_year = 366 |

---

### BK-009: Reading Statistics

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-009 |
| **Feature Name** | Reading Statistics |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a data-oriented reader, I want to see aggregate statistics about my reading habits, so that I can understand my patterns and preferences.

#### 3.3 Detailed Description

Reading Statistics provides an analytics dashboard computed from finished reading sessions, reviews, and book metadata. The stats engine calculates: total books read, total pages read, books per month, pages per month, average rating, rating distribution, average pages per book, average days per book, top authors by books read, fastest and slowest reads, and longest and shortest books. All computation happens on-device from local SQLite data.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Book metadata for page counts, authors
- BK-006: Reading Sessions - Session data for completion dates, durations

#### 3.5 User Interface Requirements

##### Screen: Stats Dashboard (Stats Tab)

**Layout:**
- Time period selector at top: "All Time", "This Year", "Last 12 Months", "This Month"
- Summary cards row: Total Books (large number), Total Pages, Average Rating (stars)
- Books Per Month bar chart (horizontal or vertical bars, 12 months)
- Pages Per Month bar chart
- Rating Distribution bar chart (10 bars for 0.5 through 5.0)
- Top Authors list (top 10, with book count per author)
- Records section: Fastest Read, Slowest Read, Longest Book, Shortest Book (each with title and metric)
- Averages section: Avg Pages/Book, Avg Days/Book

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No finished sessions | Illustration with "Finish your first book to see your reading stats" |
| Populated | 1+ finished sessions | Full stats dashboard |
| Loading | Calculating stats | Brief skeleton/shimmer on chart areas |

#### 3.6 Data Requirements

No new entities. Stats are computed from existing Book, ReadingSession, and Review entities.

##### Computed Type: ReadingStats

| Field | Type | Description |
|-------|------|-------------|
| totalBooks | number | Count of finished sessions |
| totalPages | number | Sum of page_count for finished books |
| booksPerMonth | Record<string, number> | "YYYY-MM" to count mapping |
| pagesPerMonth | Record<string, number> | "YYYY-MM" to page sum mapping |
| averageRating | number or null | Mean of all non-null ratings, 2 decimal places |
| ratingDistribution | Record<number, number> | Rating value (0.5-5.0) to count |
| averagePagesPerBook | number or null | totalPages / totalBooks, rounded |
| averageDaysPerBook | number or null | Mean reading duration in days |
| topAuthors | Array<{author, count}> | Top 10 authors by books read |
| fastestRead | {title, days} or null | Book finished in fewest days |
| slowestRead | {title, days} or null | Book that took longest to finish |
| longestBook | {title, pages} or null | Book with most pages |
| shortestBook | {title, pages} or null | Book with fewest pages |

#### 3.7 Business Logic Rules

##### Stats Calculation Algorithm

**Purpose:** Compute aggregate reading statistics.

**Inputs:**
- sessions: all ReadingSession records (filtered by time period)
- reviews: all Review records
- books: all Book records

**Logic:**

```
1. Filter sessions to status = 'finished'
2. For each finished session:
   a. Look up book metadata (page_count, authors)
   b. Accumulate totalPages += page_count (if known)
   c. Track books per month using finished_at month
   d. Track pages per month using finished_at month + page_count
   e. Calculate reading duration = finished_at - started_at in days (min 1)
   f. Track fastest/slowest reads
   g. Track longest/shortest books by page_count
   h. Accumulate author counts
3. For reviews with non-null rating:
   a. Compute average (sum / count, round to 2 decimals)
   b. Build distribution histogram
4. Compute derived averages:
   a. averagePagesPerBook = totalPages / totalBooks (round to integer)
   b. averageDaysPerBook = sum(durations) / count(durations) (round to integer)
5. Sort topAuthors by count descending, take top 10
```

**Edge Cases:**
- Book with no page_count: excluded from page statistics, included in book count
- Book with no started_at: excluded from duration statistics
- Division by zero: return null for averages when denominator is 0
- Finished session with started_at after finished_at: treat duration as 1 day

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database query fails | "Could not load stats. Pull down to retry." | User pulls to refresh |
| Corrupt date values | Excluded from calculation silently | No user action needed |

#### 3.9 Acceptance Criteria

1. **Given** 10 finished books with an average of 300 pages,
   **When** the user opens the Stats tab,
   **Then** Total Books shows 10, Total Pages shows 3000, Avg Pages/Book shows 300.

2. **Given** books with ratings [3.0, 4.0, 4.5, 5.0],
   **When** stats are calculated,
   **Then** average rating shows 4.13 and distribution shows counts for each rating value.

3. **Given** no finished books,
   **When** the user opens the Stats tab,
   **Then** an empty state message appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates totalBooks from finished sessions | 5 finished, 3 reading | totalBooks: 5 |
| calculates totalPages correctly | books with pages [100, 200, 300] | totalPages: 600 |
| skips books without page_count | 2 books with pages, 1 without | totalPages from 2 books only |
| calculates averageRating | ratings [3.0, 4.5, 5.0] | 4.17 |
| returns null averageRating for no ratings | no reviews with ratings | averageRating: null |
| calculates averageDaysPerBook | durations [10, 20, 30] | 20 |
| identifies fastest read | 3 books, durations [5, 10, 15] | {title of 5-day book, days: 5} |
| builds monthly breakdown | books finished in Jan(2), Mar(1), Jul(3) | correct month counts |
| handles zero finished books | empty sessions | all counts 0, all averages null |

---

### BK-010: Year-in-Review

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-010 |
| **Feature Name** | Year-in-Review |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to see a beautiful year-in-review summary at the end of each year, so that I can celebrate my reading accomplishments and reflect on the year.

#### 3.3 Detailed Description

Year-in-Review generates a comprehensive annual reading summary for any given year. It includes total books and pages, top-rated books, monthly reading breakdown (all 12 months), favorite books, longest/shortest books, fastest read, average rating, author diversity count, and top authors. This is the showpiece analytics feature, designed to be shareable via BK-027 (Stats Sharing).

The engine filters all finished sessions to those with `finished_at` in the specified year, then computes year-specific versions of the stats from BK-009.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-009: Reading Statistics - Shares calculation patterns

#### 3.5 User Interface Requirements

##### Screen: Year-in-Review

**Layout:**
- Year selector at top (dropdown of years that have any finished books)
- Hero section: "Your [Year] in Books" with total books and pages in large type
- Monthly breakdown: visual chart showing books per month (all 12 months, including zeros)
- Top Rated section: up to 5 highest-rated books with cover, title, author, rating
- Favorites section: books marked is_favorite during this year
- Records: longest book, shortest book, fastest read
- Author Stats: total unique authors read, top 5 authors
- Average Rating with star display
- "Share" button at bottom (links to BK-027)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Data | No finished books for selected year | "You haven't finished any books in [year] yet. Start reading!" |
| Populated | 1+ finished books in year | Full year-in-review layout |

#### 3.6 Data Requirements

##### Computed Type: YearInReview

| Field | Type | Description |
|-------|------|-------------|
| year | number | The review year |
| totalBooks | number | Books finished in this year |
| totalPages | number | Sum of pages of finished books |
| topRated | Array<{title, authors, rating}> | Top 5 highest-rated books |
| monthlyBreakdown | Array<{month, count}> | 12 entries, one per month |
| favorites | Array<{title, authors}> | Books marked as favorites |
| longestBook | {title, pages} or null | Book with most pages |
| shortestBook | {title, pages} or null | Book with fewest pages |
| fastestRead | {title, days} or null | Fastest completion |
| averageRating | number or null | Mean rating for the year |
| authorCount | number | Unique authors read |
| topAuthors | Array<{author, count}> | Top 5 authors by frequency |

#### 3.7 Business Logic Rules

##### Year Filtering

**Logic:**

```
1. Filter sessions WHERE status = 'finished'
   AND YEAR(finished_at) = target_year
2. Apply same calculation logic as BK-009 ReadingStats
   but scoped to year-filtered sessions
3. Top rated: sort reviews by rating DESC, take top 5
4. Monthly breakdown: initialize all 12 months to 0,
   then increment based on MONTH(finished_at)
```

**Edge Cases:**
- Book started in December, finished in January: counted in the January year
- Year with only 1 finished book: all stats are about that single book
- Year before the user started using the app: no data, show "No Data" state

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No finished books for year | "No Data" empty state | User selects different year |

#### 3.9 Acceptance Criteria

1. **Given** 15 books finished in 2025 across all months,
   **When** the user views Year-in-Review 2025,
   **Then** all 15 books are counted, monthly chart shows distribution, top rated shows highest-rated 5.

2. **Given** books finished in 2024 and 2025,
   **When** the user selects 2024 from the year selector,
   **Then** only 2024 data is shown.

3. **Given** a book started in Dec 2025 and finished Jan 2, 2026,
   **When** 2026 year-in-review is shown,
   **Then** the book counts toward 2026 (based on finished_at).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| filters to correct year | sessions across 2024/2025, year=2025 | Only 2025 sessions counted |
| produces 12-month breakdown | 5 books in Jan, 3 in Mar | monthlyBreakdown[0].count=5, [2].count=3, rest=0 |
| selects top 5 rated | 10 books with ratings | Top 5 by rating DESC |
| counts unique authors | 8 books by 5 authors | authorCount: 5 |
| handles year with no books | year=2020, no sessions | totalBooks: 0, all null/empty |

---

### BK-011: Full-Text Search (FTS5)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-011 |
| **Feature Name** | Full-Text Search (FTS5) |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader with a large library, I want to search across all my books by title, author, or subject instantly, so that I can find any book without scrolling through hundreds of entries.

#### 3.3 Detailed Description

Full-Text Search uses SQLite FTS5 virtual tables with Porter stemming and Unicode tokenization to provide sub-millisecond search across the entire library. The FTS index covers title, subtitle, authors, and subjects fields. It is kept in sync with the books table via database triggers that fire on INSERT, UPDATE, and DELETE.

Search supports prefix matching (typing "har" matches "Harry Potter" and "Harper Lee"), stemming ("running" matches "run"), and multi-word queries (each word must match in at least one indexed field).

A separate FTS index exists for journal entries (BK-014), searching across journal title and content fields.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - FTS indexes the books table

#### 3.5 User Interface Requirements

The FTS search is integrated into the Library List screen (BK-001) search bar. No separate screen is needed.

**Behavior:**
- User types 2+ characters in the library search bar
- Results appear in real-time as the user types (no debounce needed for local FTS)
- Results are ranked by relevance (FTS5 rank function)
- Matching terms are highlighted in results (bold the matched portion)
- Search covers: title, subtitle, authors, subjects

#### 3.6 Data Requirements

##### Virtual Table: bk_books_fts

| Column | Source | Description |
|--------|--------|-------------|
| title | bk_books.title | Book title |
| subtitle | bk_books.subtitle | Book subtitle |
| authors | bk_books.authors | Author names (JSON array as string) |
| subjects | bk_books.subjects | Subject/genre tags (JSON array as string) |

**Tokenizer:** `porter unicode61` (Porter stemming + Unicode support)
**Content table:** `bk_books` (content-sync mode)

**Triggers:**
- `bk_books_fts_ai`: After INSERT on bk_books, insert into FTS
- `bk_books_fts_ad`: After DELETE on bk_books, delete from FTS
- `bk_books_fts_au`: After UPDATE on bk_books, delete old + insert new in FTS

#### 3.7 Business Logic Rules

##### Search Query Execution

**Logic:**

```
1. Take user query string
2. Escape special FTS5 characters
3. Append * for prefix matching (e.g., "har" becomes "har*")
4. Execute: SELECT b.* FROM bk_books b
   INNER JOIN bk_books_fts fts ON b.rowid = fts.rowid
   WHERE bk_books_fts MATCH ?
   ORDER BY rank
   LIMIT 50
5. RETURN matching books sorted by relevance
```

**Edge Cases:**
- Empty query: return all books (no FTS filter)
- Single character: do not search (minimum 2 characters)
- Special characters in query (quotes, asterisks): escaped before passing to FTS5
- Very large library (10,000+ books): FTS5 returns results in <10ms

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| FTS index corrupted | Fallback to LIKE query on title | Rebuild FTS index in background |
| Malformed FTS query | Silent fallback to LIKE query | No user action needed |

#### 3.9 Acceptance Criteria

1. **Given** a library with 500 books including "Harry Potter and the Philosopher's Stone",
   **When** the user types "harry",
   **Then** Harry Potter books appear in results within 50ms.

2. **Given** a book with author "J.K. Rowling",
   **When** the user searches "rowling",
   **Then** the book appears in results.

3. **Given** a book with subjects ["Science Fiction", "Space"],
   **When** the user searches "science",
   **Then** the book appears in results.

4. **Given** the user searches "run",
   **When** a book has "running" in its title,
   **Then** the book appears (Porter stemming matches "run" to "running").

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| matches title prefix | query: "har", book: "Harry Potter" | Match found |
| matches author name | query: "weir", book by "Andy Weir" | Match found |
| matches subject | query: "fiction", subjects: ["Science Fiction"] | Match found |
| porter stemming works | query: "run", title: "Running Wild" | Match found |
| no match returns empty | query: "xyzabc123" | Empty results |
| FTS trigger on insert | insert book, then search by title | Found |
| FTS trigger on update | update title, search old title | Not found; search new title: found |
| FTS trigger on delete | delete book, search by title | Not found |

---

### BK-012: E-Reader

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-012 |
| **Feature Name** | E-Reader |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to read ePub and PDF files directly in the app, so that I can track my reading and take notes without switching between apps.

**Secondary:**
> As a reader, I want to highlight passages and add notes while reading, so that I can reference them later from the book detail screen.

#### 3.3 Detailed Description

The E-Reader provides a built-in reading experience for ePub and PDF documents. Users can upload files from their device, which are parsed and stored as plain text in the database. The reader supports customizable font size, line height, font family, theme (dark/sepia/light), and margin size. Per-document preferences are saved so each book remembers its reading settings.

The reader tracks reading position (character offset and percentage), supports highlights (colored text selections), bookmarks (position markers), and notes (text annotations attached to positions). All reader data is linked to the corresponding book record when applicable.

Documents are parsed on upload: ePub files have their HTML content extracted and converted to plain text; PDF files have their text content extracted. The parsed text is stored in `bk_reader_documents.text_content`, and a SHA-256 content hash detects duplicate uploads.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Documents can be linked to book records

**External Dependencies:**
- File system access for document upload
- ePub/PDF parsing libraries

#### 3.5 User Interface Requirements

##### Screen: Reader Library (Reader Tab)

**Layout:**
- List of uploaded documents sorted by last_opened_at (most recent first)
- Each row: document title, author (if known), progress bar, progress percent, last opened date
- "Upload" button (floating action button or in nav bar)
- Filter: All, ePub, PDF, Notes

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No documents uploaded | "Upload an ePub or PDF to start reading in-app" with Upload button |
| Populated | 1+ documents | Scrollable document list |

##### Screen: Reading View

**Layout:**
- Full-screen text content area with customizable styling
- Top bar: back button, document title (truncated), settings gear icon
- Bottom bar: progress bar (draggable), page/position indicator, bookmark button
- Settings panel (slide-in from right): font size slider (12-48), line height slider (1.0-3.0), font family picker (serif, sans-serif, monospace), theme toggle (dark/sepia/light), margin size slider (0-64px)
- Text selection: shows contextual menu with "Highlight", "Add Note", "Copy"
- Highlights shown as colored background on text
- Bookmark icon toggles bookmark at current position
- Notes shown as small indicator icons in the margin

**Interactions:**
- Scroll text: updates current_position and progress_percent
- Select text: contextual menu appears
- Tap "Highlight": highlights selected text in chosen color (yellow, green, blue, pink)
- Tap "Add Note": opens note input modal, saves annotation at selection position
- Tap settings gear: opens/closes settings panel
- Drag progress bar: jumps to position in document

#### 3.6 Data Requirements

##### Entity: ReaderDocument

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE SET NULL, optional | null | Linked book record |
| title | TEXT | Required, min 1 | None | Document title |
| author | TEXT | Optional | null | Document author |
| source_type | TEXT | One of: 'upload', 'import', 'note' | 'upload' | How document was added |
| mime_type | TEXT | Optional | null | MIME type (application/epub+zip, application/pdf) |
| file_name | TEXT | Optional | null | Original file name |
| file_extension | TEXT | Optional | null | File extension (epub, pdf) |
| text_content | TEXT | Required | None | Full parsed text content |
| content_hash | TEXT | Optional | null | SHA-256 hash for deduplication |
| total_chars | INTEGER | Non-negative | 0 | Total character count |
| total_words | INTEGER | Non-negative | 0 | Total word count |
| current_position | INTEGER | Non-negative | 0 | Current reading position (char offset) |
| progress_percent | REAL | 0-100 | 0 | Reading progress percentage |
| last_opened_at | TEXT | ISO datetime, optional | null | Last time document was opened |
| created_at | TEXT | ISO datetime | Current timestamp | Upload time |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification |

##### Entity: ReaderNote

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| document_id | TEXT (UUID) | References bk_reader_documents.id, ON DELETE CASCADE | None | Parent document |
| note_type | TEXT | One of: 'note', 'highlight', 'bookmark' | 'note' | Annotation type |
| selection_start | INTEGER | Non-negative | 0 | Start character offset |
| selection_end | INTEGER | Non-negative | 0 | End character offset |
| selected_text | TEXT | Optional | null | The highlighted/selected text |
| note_text | TEXT | Optional | null | User's note content |
| color | TEXT | Optional | null | Highlight color |
| created_at | TEXT | ISO datetime | Current timestamp | Creation time |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification |

##### Entity: ReaderPreference

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| document_id | TEXT (UUID) | Primary key, References bk_reader_documents.id, ON DELETE CASCADE | None | Per-document settings |
| font_size | INTEGER | 12-48 | 20 | Font size in pixels |
| line_height | REAL | 1.0-3.0 | 1.6 | Line height multiplier |
| font_family | TEXT | Min 1 char | 'serif' | Font family name |
| theme | TEXT | One of: 'dark', 'sepia', 'light' | 'sepia' | Reader color theme |
| margin_size | INTEGER | 0-64 | 20 | Horizontal margin in pixels |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification |

#### 3.7 Business Logic Rules

##### Document Upload and Parsing

**Logic:**

```
1. User selects file from device
2. Read file bytes
3. IF extension = .epub:
     Parse ePub container, extract HTML chapters, strip tags to plain text
4. IF extension = .pdf:
     Extract text content from PDF pages
5. Compute content_hash = SHA-256(text_content)
6. Check for duplicate: SELECT id FROM bk_reader_documents WHERE content_hash = ?
7. IF duplicate: warn user "This document is already in your reader"
8. Compute total_chars = text_content.length
9. Compute total_words = text_content.split(/\s+/).length
10. Insert ReaderDocument record
11. Optionally link to existing book if ISBN or title matches
```

##### Progress Tracking

**Logic:**

```
1. On scroll/position change:
   current_position = character offset of first visible character
   progress_percent = (current_position / total_chars) * 100
2. Update bk_reader_documents SET current_position, progress_percent, last_opened_at = now
3. Debounce position saves: update at most every 2 seconds
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Unsupported file format | Toast: "Only ePub and PDF files are supported." | User selects correct format |
| ePub parsing fails | "Could not read this ePub file. The file may be corrupted or DRM-protected." | User tries different file |
| PDF with no extractable text (scanned images) | "This PDF contains only images. Text extraction is not available." | User acknowledged |
| File too large (>50MB) | "File is too large. Maximum size is 50MB." | User selects smaller file |
| Duplicate document | "This document is already in your reader. Open it?" | User opens existing |

#### 3.9 Acceptance Criteria

1. **Given** the user uploads a valid ePub file,
   **When** parsing completes,
   **Then** the document appears in the Reader Library with title, word count, and 0% progress.

2. **Given** the user is reading a document at position 5000 of 10000 characters,
   **When** they close and reopen the document,
   **Then** reading resumes at position 5000 (50% progress).

3. **Given** the user selects text and taps "Highlight",
   **Then** the text is stored as a ReaderNote with type 'highlight' and the selected text is visually highlighted.

4. **Given** the user changes font size to 24 and theme to "dark" for a document,
   **When** they reopen that document,
   **Then** font size 24 and dark theme are restored.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses ePub to plain text | valid ePub bytes | text_content with stripped HTML, correct word/char counts |
| rejects non-ePub/PDF | .docx file | Error: unsupported format |
| computes content hash | text_content: "Hello world" | SHA-256 hash of "Hello world" |
| detects duplicate by hash | same file uploaded twice | Duplicate warning |
| calculates progress percent | position: 250, total: 1000 | 25.0% |
| saves and restores preferences | font_size: 24, theme: "dark" | Preferences retrieved match saved values |

---

### BK-013: Reading Challenges

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-013 |
| **Feature Name** | Reading Challenges |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a motivated reader, I want to create reading challenges with specific targets and time frames, so that I can push myself beyond simple annual goals.

**Secondary:**
> As a reader, I want challenge progress to update automatically when I finish books or log reading time, so that I do not have to manually track progress.

#### 3.3 Detailed Description

Reading Challenges extend the goal system (BK-008) with flexible, structured multi-target challenges. Unlike the simple annual goal, challenges support four types: books_count (read N books), pages_count (read N pages), minutes_count (read N minutes), and themed (read N books matching a theme prompt). Challenges have configurable time frames (yearly, monthly, weekly, custom date range).

Progress is auto-logged when a book is marked as finished (BK-006 state transition triggers). Books_count and themed challenges get +1 per completion. Pages_count challenges get the book's page_count. Minutes_count challenges get duration from timed reading sessions (BK-022).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-006: Reading Sessions - Challenge progress triggers on session completion

#### 3.5 User Interface Requirements

##### Screen: Challenges List

**Layout:**
- Active challenges at top, each showing: name, progress bar, current/target with unit, time remaining
- Completed challenges section below (collapsed by default)
- "Create Challenge" button

##### Modal: Create Challenge

**Layout:**
- Name input (required, max 200 characters)
- Description input (optional, max 1000 characters)
- Challenge type selector: "Books", "Pages", "Minutes", "Themed"
- Target value input (numeric, positive)
- Time frame selector: "Yearly", "Monthly", "Weekly", "Custom"
- If Custom: start date and end date pickers
- If Themed: theme prompt input (e.g., "Read books by women authors", max 500 characters)
- "Create" button

#### 3.6 Data Requirements

##### Entity: Challenge

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| name | TEXT | Required, min 1, max 200 | None | Challenge name |
| description | TEXT | Optional, max 1000 | null | Challenge description |
| challenge_type | TEXT | One of: 'books_count', 'pages_count', 'minutes_count', 'themed' | None | What is being counted |
| target_value | INTEGER | Required, positive | None | Target number to reach |
| target_unit | TEXT | One of: 'books', 'pages', 'minutes' | None | Unit of measurement |
| time_frame | TEXT | One of: 'yearly', 'monthly', 'weekly', 'custom' | None | Duration type |
| start_date | TEXT | Required, ISO date | None | Challenge start date |
| end_date | TEXT | Required, ISO date | None | Challenge end date |
| theme_prompt | TEXT | Optional, max 500 | null | Theme description for themed challenges |
| is_active | INTEGER | 0 or 1 | 1 | Whether challenge is currently active |
| created_at | TEXT | ISO datetime | Current timestamp | Creation time |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification |

##### Entity: ChallengeProgress

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| challenge_id | TEXT (UUID) | References bk_challenges.id, ON DELETE CASCADE | None | Parent challenge |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE SET NULL, optional | null | Associated book |
| session_id | TEXT (UUID) | References bk_reading_sessions.id, ON DELETE SET NULL, optional | null | Associated session |
| value_added | INTEGER | Non-negative | 0 | Units of progress added |
| note | TEXT | Optional | null | Description of progress |
| logged_at | TEXT | ISO datetime | Current timestamp | When progress was logged |

#### 3.7 Business Logic Rules

##### Auto-Logging on Book Completion

**Purpose:** Automatically add progress to active challenges when a book is finished.

**Logic:**

```
1. On reading session status change to 'finished':
2. Get all active challenges (is_active = 1)
3. For each challenge:
   a. IF challenge_type = 'books_count' OR 'themed':
        Log progress: value_added = 1, note = "Auto-logged: book completed"
   b. IF challenge_type = 'pages_count' AND book.page_count > 0:
        Log progress: value_added = book.page_count
4. For minutes_count challenges: logged separately via BK-022 timed sessions
```

##### Challenge Status Calculation

**Logic:**

```
1. currentValue = SUM(value_added) from bk_challenge_progress WHERE challenge_id = ?
2. percentComplete = MIN(ROUND(currentValue / targetValue * 100), 100)
3. isComplete = currentValue >= targetValue
```

**Edge Cases:**
- Challenge with end_date in the past and not complete: mark as expired, keep is_active = 0
- Multiple challenges active simultaneously: all receive progress on book completion
- Themed challenge: auto-logging adds progress, but user is trusted to read on-theme books

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| end_date before start_date | Validation: "End date must be after start date" | User corrects dates |
| target_value of 0 | Validation: "Target must be at least 1" | User enters valid target |

#### 3.9 Acceptance Criteria

1. **Given** an active "Read 5 books this month" challenge with 3 books completed,
   **When** the user finishes a 4th book,
   **Then** progress auto-updates to 4/5 (80%).

2. **Given** a pages_count challenge targeting 2000 pages,
   **When** the user finishes a 350-page book,
   **Then** 350 is added to the challenge progress.

3. **Given** a challenge reaches its target,
   **When** progress is displayed,
   **Then** the challenge shows 100% with a "Complete" badge.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| getChallengeStatus returns correct percent | current: 3, target: 10 | percentComplete: 30, isComplete: false |
| caps percent at 100 | current: 15, target: 10 | percentComplete: 100, isComplete: true |
| logBookCompletion adds to books_count | active books_count challenge, finish book | progress +1 |
| logBookCompletion adds pages | active pages_count challenge, finish 300-page book | progress +300 |
| logBookCompletion skips pages for no page_count | book with no page_count | No pages_count progress logged |
| logReadingMinutes adds to minutes_count | 45 minutes | progress +45 |
| logReadingMinutes skips zero minutes | 0 minutes | No progress logged |

---

### BK-014: Encrypted Journal

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-014 |
| **Feature Name** | Encrypted Journal |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a reflective reader, I want to write private journal entries about my reading experiences, so that I can capture my thoughts and feelings without worrying about privacy.

**Secondary:**
> As a privacy-conscious reader, I want to encrypt my journal entries with a passphrase, so that even if someone accesses my device, they cannot read my private reflections.

#### 3.3 Detailed Description

The Encrypted Journal provides a private space for reading reflections, thoughts, and personal notes linked to specific books. Each entry has optional title, content (required), mood tag, and can be linked to one or more books. Entries support optional passphrase-based encryption using AES-256-GCM with PBKDF2 key derivation.

Encrypted entries store the ciphertext, salt, and IV in the database. Decryption requires the user to re-enter their passphrase. The passphrase is never stored. If the passphrase is lost, the entry cannot be recovered.

Journal entries also have an FTS5 index for full-text search across titles and content (unencrypted entries only). Photos can be attached to entries. Entries can be exported to Markdown with YAML frontmatter.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Journal entries can link to books

**External Dependencies:**
- Crypto API for AES-256-GCM encryption
- File system access for photo attachments

#### 3.5 User Interface Requirements

##### Screen: Journal List

**Layout:**
- Chronological list of journal entries (newest first)
- Each entry row: title (or first line of content if no title), date, mood emoji (if set), word count, book link indicator (book icon if linked), lock icon if encrypted
- Filter bar: All, Favorites, Encrypted, By Book
- "New Entry" floating action button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No journal entries | "Start your reading journal" with illustration and "Write First Entry" button |
| Populated | 1+ entries | Scrollable entry list |

##### Screen: Journal Entry View

**Layout:**
- Title (large, if present)
- Date and word count
- Mood badge
- Content area (full text, or "This entry is encrypted. Enter passphrase to read." with passphrase input)
- Linked books section: covers/titles of linked books (tappable)
- Attached photos (scrollable gallery)
- Action buttons: Edit, Delete, Export, Favorite toggle

##### Modal: Write/Edit Entry

**Layout:**
- Title input (optional, max 200 characters)
- Content input (required, multiline, max 50000 characters)
- Mood picker (row of mood emojis: happy, thoughtful, sad, excited, calm, frustrated, inspired)
- Link books: search/select from library (multi-select)
- Attach photos: camera or photo library picker (up to 10 photos)
- Encryption toggle: "Encrypt this entry" with passphrase input (if enabled)
- Word count display (live, below content)
- "Save" button

#### 3.6 Data Requirements

##### Entity: JournalEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| title | TEXT | Optional, max 200 | null | Entry title |
| content | TEXT | Required | None | Entry text (plaintext or ciphertext) |
| content_encrypted | INTEGER | 0 or 1 | 0 | Whether content is encrypted |
| encryption_salt | TEXT | Required if encrypted | null | PBKDF2 salt (base64) |
| encryption_iv | TEXT | Required if encrypted | null | AES-GCM IV (base64) |
| word_count | INTEGER | Non-negative | 0 | Word count of plaintext content |
| mood | TEXT | Optional | null | Mood tag string |
| is_favorite | INTEGER | 0 or 1 | 0 | Favorite flag |
| created_at | TEXT | ISO datetime | Current timestamp | Creation time |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification |

##### Entity: JournalPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| entry_id | TEXT (UUID) | References bk_journal_entries.id, ON DELETE CASCADE | None | Parent entry |
| file_path | TEXT | Required | None | Local file path to photo |
| file_name | TEXT | Optional | null | Original file name |
| width | INTEGER | Optional, positive | null | Image width in pixels |
| height | INTEGER | Optional, positive | null | Image height in pixels |
| sort_order | INTEGER | Non-negative | 0 | Display order |
| created_at | TEXT | ISO datetime | Current timestamp | Creation time |

##### Entity: JournalBookLink (Junction)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| entry_id | TEXT (UUID) | References bk_journal_entries.id, ON DELETE CASCADE | None | Journal entry |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE | None | Linked book |
| created_at | TEXT | ISO datetime | Current timestamp | Link creation time |

**Primary Key:** Composite (entry_id, book_id)

#### 3.7 Business Logic Rules

##### Encryption Flow

**Purpose:** Encrypt journal content with user-provided passphrase.

**Logic:**

```
1. User provides passphrase string
2. Generate random 16-byte salt
3. Derive 256-bit key using PBKDF2(passphrase, salt, 100000 iterations, SHA-256)
4. Generate random 12-byte IV
5. Encrypt content using AES-256-GCM(key, iv, plaintext)
6. Store: content = base64(ciphertext), encryption_salt = base64(salt),
   encryption_iv = base64(iv), content_encrypted = 1
7. word_count is computed from plaintext BEFORE encryption
```

##### Decryption Flow

**Logic:**

```
1. User provides passphrase
2. Decode salt and IV from base64
3. Derive key using PBKDF2(passphrase, salt, 100000 iterations, SHA-256)
4. Decrypt using AES-256-GCM(key, iv, ciphertext)
5. IF decryption succeeds: display plaintext
6. IF decryption fails (wrong passphrase): show "Incorrect passphrase"
7. Passphrase is NEVER stored in database or memory beyond the decryption call
```

##### Word Count

**Logic:**

```
1. Trim whitespace from content
2. IF empty: return 0
3. Split by whitespace regex (/\s+/)
4. RETURN array length
```

##### Journal Stats

**Logic:**

```
1. totalEntries = COUNT(*) from bk_journal_entries
2. entriesThisMonth = COUNT(*) WHERE created_at >= first day of current month
3. Calculate streaks from distinct entry dates (consecutive days)
4. longestStreak = max consecutive days with entries
5. currentStreak = consecutive days counting back from today/yesterday
```

##### Streak Calculation

**Logic:**

```
1. Get sorted distinct dates: SELECT DISTINCT date(created_at) ORDER BY ASC
2. Walk dates forward, tracking consecutive runs
3. Longest streak = max run length
4. Current streak: count backwards from last entry date
   - IF last entry is today or yesterday: start counting back
   - ELSE: current streak = 0
```

**Edge Cases:**
- Encrypted entry searched via FTS: encrypted entries are NOT indexed (ciphertext is meaningless for search)
- Wrong passphrase: returns generic "incorrect passphrase" error, no hint about correct passphrase
- Entry with both plaintext content and encryption: encryption flag determines behavior
- Journal export of encrypted entries: exports with [ENCRYPTED] placeholder, not ciphertext

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Wrong passphrase | "Incorrect passphrase. Please try again." | User retries with correct passphrase |
| Empty content on save | "Write something before saving." | User adds content |
| Photo attachment fails | Toast: "Could not attach photo." | User retries |
| Passphrase too short (<8 chars) | "Passphrase must be at least 8 characters." | User enters longer passphrase |

#### 3.9 Acceptance Criteria

1. **Given** the user writes a journal entry "Loved the ending of Dune" linked to the book "Dune",
   **When** saved,
   **Then** the entry appears in the journal list with date, word count, and book link indicator.

2. **Given** the user encrypts an entry with passphrase "mySecret123",
   **When** they view the entry,
   **Then** a lock icon appears and the content shows "This entry is encrypted" until the passphrase is entered.

3. **Given** an encrypted entry,
   **When** the user enters the wrong passphrase,
   **Then** "Incorrect passphrase" error appears and content remains hidden.

4. **Given** the user has written entries on 5 consecutive days,
   **When** journal stats are calculated,
   **Then** currentStreak shows 5 (assuming today or yesterday is the last entry date).

5. **Given** encrypted entries exist,
   **When** the user exports journal to Markdown,
   **Then** encrypted entries show "[ENCRYPTED]" as content, not ciphertext.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| countWords empty string | "" | 0 |
| countWords whitespace only | "   " | 0 |
| countWords normal text | "Hello beautiful world" | 3 |
| countWords with extra spaces | "  Hello   world  " | 2 |
| encrypt then decrypt roundtrip | content: "test", passphrase: "pass1234" | Decrypted content equals "test" |
| wrong passphrase fails | encrypt with "pass1", decrypt with "pass2" | Decryption error |
| streak calculation - consecutive | dates: [Jan 1, Jan 2, Jan 3] | longestStreak: 3 |
| streak calculation - gap | dates: [Jan 1, Jan 2, Jan 5, Jan 6] | longestStreak: 2 |
| streak calculation - empty | dates: [] | longestStreak: 0, currentStreak: 0 |

---

### BK-015: Goodreads Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-015 |
| **Feature Name** | Goodreads Import |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Goodreads user, I want to import my Goodreads library export (CSV) into MyBooks, so that I can migrate away from Goodreads without losing my reading history.

#### 3.3 Detailed Description

Goodreads provides a CSV export of a user's entire library. This feature parses that CSV file and imports books, shelves, ratings, reviews, and reading dates into MyBooks. The import is intelligent: it maps Goodreads shelf names to MyBooks system shelves (e.g., "to-read" maps to "Want to Read"), converts Goodreads integer ratings to MyBooks half-star ratings, and creates reading sessions from date read fields.

The import runs in a transaction. If the import fails partway, all changes are rolled back. An import log records the result (books imported, books skipped, errors).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Imported books are stored as Book records
- BK-004: Shelves - Imported shelves map to MyBooks shelves
- BK-005: Ratings and Reviews - Imported ratings and reviews become Review records
- BK-006: Reading Sessions - Imported dates become ReadingSession records

**External Dependencies:**
- File picker for CSV file selection

#### 3.5 User Interface Requirements

##### Screen: Import (within Settings)

**Layout:**
- "Import from Goodreads" card with Goodreads logo, description, and "Select CSV File" button
- After file selected: preview showing row count, sample of first 5 books, and mapping preview
- "Import" button with progress indicator during import

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | No file selected | Instructions for exporting from Goodreads + file picker button |
| Preview | File parsed | Preview of books to import, count, any warnings |
| Importing | Import in progress | Progress bar with "Importing X of Y books..." |
| Complete | Import finished | Summary: "Imported 142 books, skipped 3, 1 error" with details |
| Error | Parse failed | "Could not read this file. Make sure it's a Goodreads CSV export." |

**Interactions:**
- Tap "Select CSV File": opens device file picker filtered to .csv
- Tap "Import": begins import with progress display
- Tap error detail: expands to show which rows failed and why

#### 3.6 Data Requirements

##### Entity: ImportLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| source | TEXT | One of: 'goodreads', 'storygraph' | None | Import source |
| filename | TEXT | Required | None | Original file name |
| books_imported | INTEGER | Non-negative | 0 | Successfully imported count |
| books_skipped | INTEGER | Non-negative | 0 | Skipped (duplicate, invalid) count |
| errors | TEXT | Optional, JSON array | null | Array of error messages |
| imported_at | TEXT | ISO datetime | Current timestamp | Import timestamp |

#### 3.7 Business Logic Rules

##### Goodreads CSV Parsing

**Purpose:** Parse Goodreads export CSV and map to MyBooks entities.

**Expected CSV columns:** Title, Author, Author l-f, Additional Authors, ISBN, ISBN13, My Rating, Average Rating, Publisher, Binding, Number of Pages, Year Published, Original Publication Year, Date Read, Date Added, Bookshelves, Bookshelves with positions, Exclusive Shelf, My Review, Spoiler, Private Notes, Read Count, Owned Copies

**Mapping:**

```
1. For each CSV row:
   a. title = row["Title"]
   b. authors = [row["Author"]] + split(row["Additional Authors"], ", ")
   c. isbn_13 = clean(row["ISBN13"]) (strip = and quotes)
   d. isbn_10 = clean(row["ISBN"])
   e. page_count = parseInt(row["Number of Pages"])
   f. publisher = row["Publisher"]
   g. publish_year = parseInt(row["Year Published"])
   h. format = mapBinding(row["Binding"]) // "Paperback" -> "physical", "Kindle Edition" -> "ebook", etc.
   i. added_source = 'import_goodreads'
2. Create Book record
3. Map Exclusive Shelf:
   - "to-read" -> shelf-tbr (Want to Read), status = want_to_read
   - "currently-reading" -> shelf-reading, status = reading
   - "read" -> shelf-finished, status = finished
4. Create ReadingSession:
   - started_at = row["Date Added"] (approximation)
   - finished_at = row["Date Read"] (if Exclusive Shelf = "read")
   - status = mapped status
5. IF row["My Rating"] > 0:
   - Create Review: rating = row["My Rating"] (integer 1-5, kept as-is for MyBooks half-star scale)
   - review_text = row["My Review"]
6. Deduplication: skip if isbn_13 already exists in bk_books
```

**Edge Cases:**
- Malformed CSV (wrong columns): reject with clear error
- Book with no ISBN: import by title/author, flag for potential duplicates
- Rating of 0 in Goodreads means "not rated": import as rating: null
- HTML in review text: strip HTML tags
- Multiple reads of same book (Read Count > 1): create multiple sessions

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| File is not CSV format | "This doesn't look like a CSV file." | User selects correct file |
| Missing expected columns | "This file doesn't match the Goodreads export format." | User re-exports from Goodreads |
| Duplicate book detected | Book skipped, counted in books_skipped | Noted in import summary |
| Malformed row (e.g., invalid date) | Row skipped, error logged | Shown in error details |
| Import interrupted (app crash) | Transaction rolled back, no partial data | User re-imports |

#### 3.9 Acceptance Criteria

1. **Given** a valid Goodreads CSV with 150 books,
   **When** the user imports it,
   **Then** 150 books are created with correct shelves, ratings, and reading sessions.

2. **Given** a Goodreads CSV with a book already in the library (matching ISBN),
   **When** imported,
   **Then** the duplicate is skipped and reported in the summary.

3. **Given** a Goodreads CSV with a book rated 4 and reviewed,
   **When** imported,
   **Then** a Review record is created with rating 4.0 and the review text.

4. **Given** a malformed CSV file,
   **When** the user tries to import,
   **Then** a clear error message explains the problem.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses standard Goodreads CSV | valid CSV string | Array of ParsedBook objects |
| maps "to-read" to want_to_read | Exclusive Shelf: "to-read" | status: want_to_read, shelf: shelf-tbr |
| maps "read" to finished | Exclusive Shelf: "read" | status: finished, shelf: shelf-finished |
| strips ISBN formatting | ISBN: ="0593135202" | isbn_10: "0593135202" |
| handles 0 rating as null | My Rating: 0 | rating: null |
| handles missing Date Read | Date Read: "" | finished_at: null |
| strips HTML from review | review with <br> tags | Clean text without HTML |

---

### BK-016: StoryGraph Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-016 |
| **Feature Name** | StoryGraph Import |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a StoryGraph user, I want to import my StoryGraph export into MyBooks, so that I can migrate without losing my reading history.

#### 3.3 Detailed Description

StoryGraph provides a CSV export of user data. This import parser handles the StoryGraph CSV format, which differs from Goodreads in column names, date formats, and shelf naming. The import logic follows the same patterns as BK-015 but with StoryGraph-specific mappings.

#### 3.4 Prerequisites

**Feature Dependencies:**
- Same as BK-015

#### 3.5 User Interface Requirements

Same UI as BK-015 import screen, with "Import from StoryGraph" card alongside the Goodreads option.

#### 3.6 Data Requirements

Uses same ImportLog entity as BK-015, with `source` = 'storygraph'.

#### 3.7 Business Logic Rules

##### StoryGraph CSV Parsing

**Expected columns:** Title, Authors, ISBN/UID, Format, Shelves, Read Status, Star Rating, Review, Tags, Read Dates, Moods, Pace, Content Warnings

**Mapping:**

```
1. For each CSV row:
   a. title = row["Title"]
   b. authors = split(row["Authors"], ", ")
   c. isbn = row["ISBN/UID"] (may be ISBN-13 or StoryGraph UID)
   d. format = mapFormat(row["Format"])
   e. added_source = 'import_storygraph'
2. Map Read Status:
   - "to-read" -> want_to_read
   - "currently-reading" -> reading
   - "read" -> finished
   - "did-not-finish" -> dnf
3. IF row["Star Rating"] is present and > 0:
   - Create Review with rating (StoryGraph supports half-stars, maps directly)
4. IF row["Moods"]: import as mood tags (BK-019)
5. IF row["Pace"]: import as pace tags
6. IF row["Content Warnings"]: import as content warnings (BK-020)
```

**Edge Cases:**
- StoryGraph UIDs (not ISBNs): stored as open_library_id placeholder
- StoryGraph mood/pace data: mapped to bk_mood_tags for discovery integration
- Read Dates may contain date ranges: parse start and end dates for session

#### 3.8 Error Handling

Same error handling patterns as BK-015.

#### 3.9 Acceptance Criteria

1. **Given** a valid StoryGraph CSV,
   **When** imported,
   **Then** books are created with correct statuses, ratings, and mood/pace tags.

2. **Given** StoryGraph's half-star ratings,
   **When** imported,
   **Then** ratings map directly to MyBooks' half-star system (e.g., 3.5 stays 3.5).

3. **Given** StoryGraph mood and pace data,
   **When** imported,
   **Then** mood tags are created in bk_mood_tags for discovery integration.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses StoryGraph CSV format | valid StoryGraph CSV | Array of ParsedBook objects |
| maps "did-not-finish" to dnf | Read Status: "did-not-finish" | status: dnf |
| preserves half-star ratings | Star Rating: 3.5 | rating: 3.5 |
| imports mood tags | Moods: "adventurous, hopeful" | 2 mood tag records |
| imports pace tags | Pace: "fast" | 1 pace tag record |
| imports content warnings | Content Warnings: "violence, death" | 2 content warning records |

---

### BK-017: Data Export (CSV/JSON/Markdown)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-017 |
| **Feature Name** | Data Export (CSV/JSON/Markdown) |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user who owns my data, I want to export my entire library in standard formats, so that I can back up my data or migrate to another app.

#### 3.3 Detailed Description

Data Export generates the user's complete library data in three formats: CSV (spreadsheet-compatible), JSON (structured data for developers), and Markdown (human-readable). Each format includes all books with their metadata, shelves, tags, ratings, reviews, reading sessions, and reading goals. The export is triggered from the Settings screen and shared via the system share sheet.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management

#### 3.5 User Interface Requirements

##### Section: Export (within Settings)

**Layout:**
- "Export Library" card with three format buttons: "CSV", "JSON", "Markdown"
- Each button generates the file and opens the system share sheet
- Optional: "Export Journal" button (separate from library export)

**Interactions:**
- Tap format button: generates export file, shows progress for large libraries (500+ books), opens share sheet
- Share sheet allows: save to Files, AirDrop, email, etc.

#### 3.6 Data Requirements

No new entities. Exports read from existing entities.

##### CSV Export Columns

Title, Subtitle, Authors, ISBN-13, ISBN-10, Publisher, Year, Pages, Format, Rating, Review, Status, Started, Finished, Shelves, Tags, Added Source, Date Added

##### JSON Export Structure

```json
{
  "exported_at": "2026-03-06T10:00:00Z",
  "version": "1.0",
  "books_count": 47,
  "books": [
    {
      "title": "...",
      "authors": ["..."],
      "isbn_13": "...",
      "shelves": ["Want to Read"],
      "tags": ["Fantasy"],
      "sessions": [{ "status": "finished", "started_at": "...", "finished_at": "..." }],
      "reviews": [{ "rating": 4.5, "text": "..." }]
    }
  ]
}
```

##### Markdown Export Format

```markdown
# My Library

## Project Hail Mary
- **Author:** Andy Weir
- **Rating:** 4.5/5
- **Status:** Finished
- **Pages:** 496
- **Review:** Amazing science fiction...
```

#### 3.7 Business Logic Rules

##### Export Generation

**Logic:**

```
1. Query all books with their related data (shelves, tags, sessions, reviews)
2. For CSV: flatten to rows, one book per row, arrays joined with semicolons
3. For JSON: nest related data under each book object
4. For Markdown: format as human-readable document with headers per book
5. Return generated string/file
```

**Edge Cases:**
- Book with no review: rating/review columns blank in CSV
- Authors with commas in names: properly escaped in CSV
- Very large library (5000+ books): generate in chunks, show progress
- Encrypted journal entries in export: show "[ENCRYPTED]" placeholder

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Export generation fails | Toast: "Could not generate export. Please try again." | User retries |
| Share sheet cancelled | No action, file discarded | User can re-export |
| Empty library | Toast: "No books to export." | No file generated |

#### 3.9 Acceptance Criteria

1. **Given** a library with 50 books, ratings, reviews, and shelves,
   **When** the user exports as CSV,
   **Then** a CSV file with 50 data rows is generated with all columns populated correctly.

2. **Given** a library with 50 books,
   **When** the user exports as JSON,
   **Then** a valid JSON file with nested books, sessions, reviews, shelves, and tags is generated.

3. **Given** the exported CSV is opened in a spreadsheet app,
   **Then** all columns are properly separated with no data corruption from special characters.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| exports CSV with correct headers | 1 book | CSV with all column headers |
| exports CSV escapes commas in authors | author: "Doe, John" | Properly quoted CSV cell |
| exports JSON with valid structure | 2 books | Valid JSON with books array of length 2 |
| exports Markdown with book sections | 1 book with rating | Markdown with book header, rating, author |
| exports empty library | 0 books | Empty CSV (headers only) or JSON with empty array |
| exports book with all relations | book with 2 shelves, 3 tags, 1 review | All relations present in output |

---

### BK-018: Series Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-018 |
| **Feature Name** | Series Management |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a reader of book series, I want to group books into a series with reading order, so that I can track my progress through multi-book series.

#### 3.3 Detailed Description

Series Management allows users to create named series and assign books to them with a defined reading order. Each series has a name, optional description, and optional total book count (so users know how many books exist in the series even if they do not own all of them). Books within a series have a sort_order that defines the reading sequence.

On the Book Detail screen, if a book belongs to a series, the series name and position are shown (e.g., "Book 3 of The Expanse"). Tapping the series name shows all books in the series with their reading status.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management

#### 3.5 User Interface Requirements

##### Component: Series Badge (Book Detail)

**Layout:**
- Below book metadata: "Book [N] of [Series Name]" (e.g., "Book 3 of The Expanse")
- Tappable to open Series Detail

##### Screen: Series Detail

**Layout:**
- Series name (large), description (if present)
- "X of Y books in your library" (e.g., "5 of 9 books")
- Ordered list of books: sort_order number, cover thumbnail, title, reading status badge
- Books not in library shown as placeholder rows with "Add" button (if total_books > owned)
- "Add Book to Series" button

##### Modal: Create/Edit Series

**Layout:**
- Name input (required, max 200 characters)
- Description input (optional, max 1000 characters)
- Total books in series input (optional, numeric)

#### 3.6 Data Requirements

##### Entity: Series

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| name | TEXT | Required, min 1, max 200 | None | Series name |
| description | TEXT | Optional, max 1000 | null | Series description |
| total_books | INTEGER | Optional, non-negative | null | Total books in the series (may exceed owned) |
| created_at | TEXT | ISO datetime | Current timestamp | Creation time |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification |

##### Entity: SeriesBook (Junction)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| series_id | TEXT (UUID) | References bk_series.id, ON DELETE CASCADE | None | Series reference |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE | None | Book reference |
| sort_order | INTEGER | Non-negative | 0 | Position in series (1-based for display) |
| created_at | TEXT | ISO datetime | Current timestamp | Assignment time |

**Primary Key:** Composite (series_id, book_id)

**Indexes:**
- `name COLLATE NOCASE` on series - Search by series name
- `book_id` on series_books - Reverse lookup (what series is this book in?)
- `(series_id, sort_order)` on series_books - Ordered listing

#### 3.7 Business Logic Rules

##### Sort Order Management

**Logic:**

```
1. When adding a book to a series:
   - Default sort_order = MAX(sort_order) + 1 for that series
   - User can manually set sort_order
2. When removing a book: other sort_orders are NOT re-numbered (gaps are allowed)
3. When reordering: update sort_order values directly
```

**Edge Cases:**
- Book in multiple series: allowed (e.g., a crossover novel)
- Series with total_books = null: "Book N of [Series Name]" (no "of Y" shown)
- Series with 0 books remaining (all deleted): series record persists until manually deleted

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate book in same series | "This book is already in this series." | No action needed |
| Empty series name | "Series name is required." | User enters name |

#### 3.9 Acceptance Criteria

1. **Given** three Harry Potter books in the library,
   **When** the user creates "Harry Potter" series and assigns them with orders 1, 2, 3,
   **Then** the Series Detail shows the three books in order with their reading status.

2. **Given** a book belongs to "The Expanse" series at position 3,
   **When** the Book Detail screen is viewed,
   **Then** "Book 3 of The Expanse" is displayed below metadata.

3. **Given** a series with total_books = 9 and 5 owned,
   **When** Series Detail is viewed,
   **Then** "5 of 9 books in your library" is shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates series with name | name: "Dune Saga" | Series record created |
| assigns book with sort_order | book at position 3 | sort_order = 3 |
| prevents duplicate book in series | same book_id + series_id | Constraint violation |
| auto-increments sort_order | 2 books at orders 1, 2, add third | Default order = 3 |

---

### BK-019: Mood-Based Discovery

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-019 |
| **Feature Name** | Mood-Based Discovery |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader looking for my next book, I want to find books by mood, pace, and genre using tags that describe the reading experience, so that I can find something that matches how I want to feel.

#### 3.3 Detailed Description

Mood-Based Discovery provides a multi-filter search system using mood tags (e.g., "hopeful", "dark", "funny"), pace tags (e.g., "fast", "medium", "slow"), and genre tags (e.g., "sci-fi", "romance", "thriller"). These are stored in a unified bk_mood_tags table with a tag_type discriminator. Users tag their own books with these descriptors, building a personal discovery system.

Unlike user-created tags (BK-007) which are free-form, mood/pace tags use a curated vocabulary for consistency. The discovery engine (BK-019) queries across all three dimensions plus content warning exclusions.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management
- BK-007: Tags - Conceptually related, but uses separate table

#### 3.5 User Interface Requirements

##### Screen: Discovery

**Layout:**
- "What are you in the mood for?" heading
- Mood filter: scrollable row of mood chip buttons (happy, dark, funny, thought-provoking, adventurous, romantic, mysterious, hopeful, sad, inspiring)
- Pace filter: three toggle buttons (Slow, Medium, Fast)
- Genre filter: scrollable row of genre chips
- "Exclude content warnings" toggle + warning selector
- Results grid: books matching all selected filters
- If no filters selected: show all books
- If no matches: "No books match these filters. Try removing a filter."

**Interactions:**
- Tap mood/pace/genre chip: toggles filter on/off, results update immediately
- Multiple selections within a category: OR logic (e.g., "happy OR funny")
- Across categories: AND logic (e.g., "happy AND fast-paced")
- Tap book result: navigates to Book Detail

#### 3.6 Data Requirements

##### Entity: MoodTag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE | None | Tagged book |
| tag_type | TEXT | One of: 'mood', 'pace', 'genre' | None | Category of tag |
| value | TEXT | Required, min 1 | None | Tag value (e.g., "hopeful", "fast") |
| created_at | TEXT | ISO datetime | Current timestamp | Tag creation time |

**Unique Index:** (book_id, tag_type, value) - Prevents duplicate tags on same book

#### 3.7 Business Logic Rules

##### Discovery Query Engine

**Purpose:** Find books matching multi-dimensional filter criteria.

**Logic:**

```
1. Start with: SELECT b.* FROM bk_books b
2. For each active filter dimension (moods, paces, genres):
   - Add subquery: b.id IN (SELECT book_id FROM bk_mood_tags
     WHERE tag_type = ? AND value IN (?...))
3. For content warning exclusions:
   - Add: b.id NOT IN (SELECT book_id FROM bk_content_warnings
     WHERE warning IN (?...))
4. For user tag filters:
   - Add: b.id IN (SELECT bt.book_id FROM bk_book_tags bt
     INNER JOIN bk_tags t ON bt.tag_id = t.id WHERE t.name IN (?...))
5. Combine all conditions with AND
6. ORDER BY b.title
7. LIMIT ? OFFSET ?
8. Default limit: 50
```

**Edge Cases:**
- No filters selected: returns all books (no WHERE clause)
- All dimensions have selections but no books match all: empty result
- Book with no mood tags: only appears when no mood filter is active

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No matching books | "No books match these filters." | User removes filters |
| Database query error | "Could not search. Pull down to retry." | User retries |

#### 3.9 Acceptance Criteria

1. **Given** 3 books tagged "hopeful" and 2 books tagged "dark",
   **When** the user selects mood filter "hopeful",
   **Then** 3 books are shown.

2. **Given** 2 books tagged both "hopeful" and "fast",
   **When** the user selects mood "hopeful" AND pace "fast",
   **Then** 2 books are shown.

3. **Given** a book with content warning "violence",
   **When** the user excludes "violence",
   **Then** that book is hidden from results.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| filters by single mood | moods: ["hopeful"] | Books with "hopeful" mood tag |
| filters by multiple moods (OR) | moods: ["hopeful", "funny"] | Books with either tag |
| combines mood + pace (AND) | moods: ["dark"], paces: ["fast"] | Books matching both |
| excludes content warnings | excludeWarnings: ["violence"] | Books without "violence" warning |
| no filters returns all | filters: {} | All books |
| respects limit and offset | limit: 10, offset: 5 | 10 results starting from 6th |

---

### BK-020: Content Warnings

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-020 |
| **Feature Name** | Content Warnings |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a sensitive reader, I want to see content warnings on books before I start reading, so that I can avoid content that I find distressing.

**Secondary:**
> As a helpful reader, I want to add content warnings to books I have read, so that other readers (or my future self) can be informed.

#### 3.3 Detailed Description

Content Warnings allow users to tag books with warnings about potentially distressing content (e.g., "violence", "death", "sexual assault", "addiction"). Each warning has a severity level (mild, moderate, severe). Warnings integrate with the Discovery engine (BK-019) to allow filtering out books with specific warnings.

Warnings are displayed on the Book Detail screen in a collapsible section (collapsed by default to avoid spoilers, with a "Show Content Warnings" button).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management

#### 3.5 User Interface Requirements

##### Component: Content Warnings (Book Detail)

**Layout:**
- Collapsible section with header "Content Warnings" and warning count badge
- Collapsed by default (respects reader preference to avoid spoilers)
- When expanded: list of warnings with severity color coding (mild=yellow, moderate=orange, severe=red)
- "Add Warning" button at bottom of section

##### Modal: Add Content Warning

**Layout:**
- Warning text input (free text, max 200 characters) with common suggestions dropdown
- Severity picker: Mild, Moderate, Severe
- "Add" button

#### 3.6 Data Requirements

##### Entity: ContentWarning

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE | None | Associated book |
| warning | TEXT | Required, min 1, max 200 | None | Warning description |
| severity | TEXT | One of: 'mild', 'moderate', 'severe' | 'moderate' | Warning severity |
| created_at | TEXT | ISO datetime | Current timestamp | Creation time |

**Indexes:**
- `book_id` - Queried when loading book detail

#### 3.7 Business Logic Rules

No complex business logic. CRUD operations with validation.

**Edge Cases:**
- Duplicate warning on same book: allowed (e.g., "violence" can appear with different severities if context differs)
- Very long warning text: truncated in display with "..." and full text on tap

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty warning text | "Warning text is required." | User enters text |

#### 3.9 Acceptance Criteria

1. **Given** a book with no content warnings,
   **When** the user adds "violence" with severity "moderate",
   **Then** the content warnings section shows "1 warning" and when expanded shows "violence (moderate)".

2. **Given** a book with warnings,
   **When** the Book Detail screen loads,
   **Then** the warnings section is collapsed by default.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates content warning | warning: "violence", severity: "moderate" | Record created |
| defaults severity to moderate | warning: "death" (no severity) | severity: "moderate" |
| rejects empty warning | warning: "" | Validation error |
| accepts all severity values | each of mild/moderate/severe | Valid for each |

---

### BK-021: Reading Progress Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-021 |
| **Feature Name** | Reading Progress Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to log my page progress as I read, so that I can see how far I am through each book and track my reading speed.

#### 3.3 Detailed Description

Reading Progress Tracking extends reading sessions with granular progress updates. Each time the user reports their current page, a progress update is recorded with page number, percent complete, and optional note. These updates build a timeline that can be charted, showing reading velocity over time.

The system also computes reading speed by correlating progress updates with timed sessions (BK-022) to calculate pages per hour.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-006: Reading Sessions

#### 3.5 User Interface Requirements

##### Component: Progress Update (Book Detail, Reading Status section)

**Layout:**
- Current page input (numeric) and/or progress slider (0-100%)
- "Update" button
- Below: mini progress bar showing percent complete
- "View Progress Timeline" link

##### Screen: Progress Timeline

**Layout:**
- Line chart: X-axis = date, Y-axis = page number
- Data points from progress updates
- Reading speed stat: "You read this book at X pages/hour"

#### 3.6 Data Requirements

##### Entity: ProgressUpdate

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| session_id | TEXT (UUID) | References bk_reading_sessions.id, ON DELETE CASCADE | None | Parent session |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE | None | Associated book |
| page_number | INTEGER | Optional, non-negative | null | Current page |
| percent_complete | REAL | Optional, 0-100 | null | Percent through book |
| note | TEXT | Optional | null | Optional note with update |
| created_at | TEXT | ISO datetime | Current timestamp | Update time |

**Indexes:**
- `session_id` - Query updates for a session
- `book_id` - Query updates for a book
- `created_at` - Chronological ordering

#### 3.7 Business Logic Rules

##### Progress Percent Calculation

**Logic:**

```
1. IF page_number provided AND book.page_count > 0:
     percent_complete = MIN(100, (page_number / book.page_count) * 100)
2. ELSE IF page_number provided but no page_count:
     percent_complete = null (cannot compute)
3. User can also directly set percent_complete without page number
```

##### Reading Speed Aggregation

**Logic:**

```
1. Get all timed sessions for a book (BK-022)
2. Sum total reading time in milliseconds
3. Sum total pages read across timed sessions
4. IF both > 0: averagePagesPerHour = (totalPagesRead / totalReadingTimeMs) * 3,600,000
5. ELSE: null (insufficient data)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Page number exceeds book page count | Warning: "Page [N] exceeds the book's [M] pages. Update page count?" | User can update page_count or correct page |
| Negative page number | Validation: must be 0 or greater | User enters valid page |

#### 3.9 Acceptance Criteria

1. **Given** a 300-page book at page 150,
   **When** the user logs page 150,
   **Then** progress shows 50% and a timeline entry is created.

2. **Given** 5 progress updates over a week,
   **When** the timeline chart is viewed,
   **Then** 5 data points are plotted showing reading velocity.

3. **Given** timed sessions totaling 5 hours and 200 pages,
   **When** reading speed is calculated,
   **Then** averagePagesPerHour shows 40.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates percent from page | page: 150, total: 300 | percent: 50.0 |
| caps percent at 100 | page: 350, total: 300 | percent: 100.0 |
| null percent when no page_count | page: 150, total: null | percent: null |
| calculates reading speed | 5 hours, 200 pages | 40 pages/hour |
| null speed with no data | 0 sessions | null |
| builds timeline entries | 3 progress updates | 3 timeline entries with date, page, percent |

---

### BK-022: Timed Reading Sessions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-022 |
| **Feature Name** | Timed Reading Sessions |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to time my reading sessions with a built-in timer, so that I can track exactly how long I spend reading and see my reading speed.

#### 3.3 Detailed Description

Timed Reading Sessions add a stopwatch-style timer to reading sessions. The user starts a timer when they begin reading, optionally records their starting page, and stops the timer when done, recording the ending page. The system calculates duration, pages read, and pages per hour for each timed session.

Timed sessions feed into the reading speed calculation (BK-021) and the minutes_count challenge type (BK-013).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-006: Reading Sessions

#### 3.5 User Interface Requirements

##### Component: Reading Timer (Book Detail)

**Layout:**
- "Start Reading" button (when no timer active)
- When active: elapsed time display (HH:MM:SS), "Pause" and "Stop" buttons
- On stop: prompt for start page and end page (optional)
- Summary after stop: duration, pages read, pages/hour

**Interactions:**
- Tap "Start Reading": begins timer, records started_at
- Tap "Pause": pauses timer (not persisted as separate record)
- Tap "Stop": stops timer, records ended_at, prompts for page numbers
- App backgrounding: timer continues running (uses started_at and current time)

#### 3.6 Data Requirements

##### Entity: TimedSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| session_id | TEXT (UUID) | References bk_reading_sessions.id, ON DELETE CASCADE | None | Parent reading session |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE CASCADE | None | Associated book |
| started_at | TEXT | Required, ISO datetime | None | Timer start time |
| ended_at | TEXT | Optional, ISO datetime | null | Timer end time |
| duration_ms | INTEGER | Optional, non-negative | null | Duration in milliseconds |
| start_page | INTEGER | Optional, non-negative | null | Page when timer started |
| end_page | INTEGER | Optional, non-negative | null | Page when timer stopped |
| pages_read | INTEGER | Optional, non-negative | null | end_page - start_page |
| pages_per_hour | REAL | Optional, non-negative | null | Computed reading speed |
| created_at | TEXT | ISO datetime | Current timestamp | Record creation time |

**Indexes:**
- `session_id` - Query timed sessions for a reading session
- `book_id` - Query timed sessions for a book
- `started_at` - Chronological ordering

#### 3.7 Business Logic Rules

##### Timer Completion Calculation

**Logic:**

```
1. duration_ms = ended_at - started_at (in milliseconds)
2. IF start_page AND end_page provided:
     pages_read = end_page - start_page
     IF pages_read > 0 AND duration_ms > 0:
       pages_per_hour = (pages_read / duration_ms) * 3,600,000
3. On completion: trigger logReadingMinutes for active minutes_count challenges
   minutes = ROUND(duration_ms / 60,000)
```

**Edge Cases:**
- Timer left running overnight: valid, full duration recorded
- Pages read = 0 (user just listened or re-read): pages_per_hour = null
- end_page < start_page: reject with "End page must be after start page"
- Very short sessions (<1 minute): recorded normally

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| end_page < start_page | "End page must be after start page." | User corrects |
| Timer running when app killed | Timer data preserved; on next open, prompt "You had a reading timer running. Stop it now?" | User confirms duration |

#### 3.9 Acceptance Criteria

1. **Given** the user starts a timer and reads for 30 minutes from page 50 to page 80,
   **When** they stop the timer and enter pages,
   **Then** duration shows ~30 min, pages_read = 30, pages_per_hour = ~60.

2. **Given** an active minutes_count challenge,
   **When** a timed session of 45 minutes completes,
   **Then** 45 minutes are auto-logged to the challenge.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates duration_ms | start: T00:00, end: T00:30 | 1,800,000 ms |
| calculates pages_read | start_page: 50, end_page: 80 | 30 |
| calculates pages_per_hour | 30 pages in 30 min | 60.0 |
| handles no page data | start_page: null | pages_read: null, pages_per_hour: null |
| rejects end before start page | start: 80, end: 50 | Validation error |
| logs minutes to challenges | 45 min session | logReadingMinutes called with 45 |

---

### BK-023: Share Events

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-023 |
| **Feature Name** | Share Events |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a reader, I want to control the visibility of my reading activity, so that I can choose what to share with friends and what to keep private.

#### 3.3 Detailed Description

Share Events provide the data layer for social features. When a user rates, reviews, or adds a book to a list, a share event can optionally be created with a visibility level: private (default, not shared), friends (visible to connected users), or public (visible to anyone). Share events are the foundation for the Social Feed (BK-025).

This feature is the opt-in mechanism for social participation. By default, all activity is private. Users explicitly choose to share specific actions.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management
- BK-005: Ratings and Reviews

#### 3.5 User Interface Requirements

##### Component: Visibility Selector

**Layout:**
- After rating or reviewing, an optional "Share" button appears
- Tapping opens a visibility picker: Private (lock icon), Friends (people icon), Public (globe icon)
- Default: Private (no share event created)
- If Friends or Public selected: ShareEvent record created

#### 3.6 Data Requirements

##### Entity: ShareEvent

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| actor_user_id | TEXT | Required | None | User who performed the action |
| object_type | TEXT | One of: 'book_rating', 'book_review', 'list_item', 'generic' | None | Type of shared object |
| object_id | TEXT | Required | None | ID of the shared object (review ID, book ID, etc.) |
| visibility | TEXT | One of: 'private', 'friends', 'public' | 'private' | Who can see this |
| payload_json | TEXT | Valid JSON | '{}' | Additional data (e.g., rating value, book title for feed display) |
| created_at | TEXT | ISO datetime | Current timestamp | When shared |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification |

**Indexes:**
- `(actor_user_id, created_at DESC)` - User's activity feed
- `(object_type, object_id)` - Lookup shares for a specific object
- `(visibility, created_at DESC)` - Filter by visibility level

#### 3.7 Business Logic Rules

##### Share Event Creation

**Logic:**

```
1. User performs action (rate, review, add to list)
2. IF user chooses to share (visibility != private):
     Create ShareEvent with object reference and visibility
3. payload_json stores display data so feed can render without joining
   e.g., { "book_title": "Dune", "rating": 4.5, "cover_url": "..." }
4. Default visibility: private (no ShareEvent created at all)
```

**Edge Cases:**
- Changing visibility after sharing: updates existing ShareEvent
- Deleting the source object (review, book): ShareEvent is NOT cascade deleted (it serves as a historical record); feed rendering handles missing objects gracefully
- User with no friends: Friends visibility events exist but are not visible to anyone

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Share event creation fails | Toast: "Could not share. Try again." | User retries |

#### 3.9 Acceptance Criteria

1. **Given** the user rates a book 4.5 stars,
   **When** they choose to share with "Friends" visibility,
   **Then** a ShareEvent is created with object_type "book_rating", visibility "friends", and rating in payload.

2. **Given** no share action is taken after a review,
   **Then** no ShareEvent is created (private by default).

3. **Given** a shared review,
   **When** the user changes visibility to "private",
   **Then** the ShareEvent visibility is updated and the review disappears from friends' feeds.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates share event with friends visibility | visibility: "friends" | ShareEvent created |
| no event for private | visibility: "private" | No ShareEvent created |
| stores payload json | payload: {rating: 4.5} | payload_json contains rating |
| updates visibility | change from "friends" to "private" | visibility field updated |

---

### BK-024: Book Recommendation Engine

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-024 |
| **Feature Name** | Book Recommendation Engine |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a reader, I want the app to suggest books I might enjoy based on my reading history and ratings, so that I can discover new books without relying on a cloud-based recommendation algorithm.

#### 3.3 Detailed Description

The Book Recommendation Engine runs entirely on-device using the user's local ratings, genre preferences, author history, and reading patterns. No data leaves the device. The engine uses three recommendation strategies layered in priority:

1. **Author affinity** - "More by authors you love": identifies authors the user has rated highly (average 4.0+) and suggests their other works available on Open Library.
2. **Genre affinity** - "Popular in genres you read": identifies the user's most-read genres (from subjects and mood tags) and suggests highly-rated books in those genres from the user's own unread library.
3. **Similar book matching** - "Because you liked X": for each highly-rated book (4.0+), finds books in the user's library with overlapping subjects, tags, or mood tags that the user has not yet read.

The engine only recommends books already in the user's library (TBR shelf) or suggests new books to add via Open Library search. Recommendations update when the user finishes a book, adds a rating, or changes tags.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Book metadata for matching
- BK-005: Ratings and Reviews - Ratings drive affinity scores
- BK-007: Tags - User tags inform similarity
- BK-019: Mood-Based Discovery - Mood/genre tags inform recommendations

**External Dependencies:**
- Open Library API for suggesting books not yet in library (optional, network required)

#### 3.5 User Interface Requirements

##### Screen: Recommendations (Home Tab section or dedicated screen)

**Layout:**
- Section: "More by Authors You Love" - horizontal scrollable row of book cards, each showing cover, title, author. Books from author's bibliography not yet in user's library (via Open Library) shown with "Add" button overlay.
- Section: "Based on Your Favorites" - horizontal scrollable row of books from user's TBR shelf that share subjects/tags with 4+ rated books.
- Section: "Popular in Genres You Read" - horizontal scrollable row of TBR books in the user's most-read genres.
- Each section has "See All" link expanding to full list.
- If insufficient data (fewer than 5 rated books): show prompt "Rate more books to get personalized recommendations."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Insufficient Data | Fewer than 5 rated books | "Rate at least 5 books to unlock personalized recommendations" |
| Loading | Computing recommendations | Skeleton cards |
| Populated | 5+ rated books | Recommendation sections as described |
| No Recommendations | Rated books but no unread matches | "You've read everything we'd suggest! Add more books to your TBR list." |

#### 3.6 Data Requirements

No new entities needed. Recommendations are computed at runtime from existing Book, Review, Tag, MoodTag, and Shelf data.

##### Computed Type: Recommendation

| Field | Type | Description |
|-------|------|-------------|
| book | Book | The recommended book |
| reason | string | Why this is recommended (e.g., "Because you liked Dune") |
| score | number | Affinity score (0-100) for ranking |
| source | string | One of: 'author_affinity', 'genre_affinity', 'similar_book' |

#### 3.7 Business Logic Rules

##### Author Affinity Algorithm

**Purpose:** Find authors the user loves and suggest their other works.

**Logic:**

```
1. Get all reviews with rating >= 4.0
2. Extract author names from those books
3. Count books per author, compute average rating per author
4. Rank authors by: (count * 0.4) + (averageRating * 0.6)
5. For top 10 authors:
   a. Check user's library for unread books by this author
   b. Optionally: query Open Library for other works by author (requires network)
6. RETURN recommendations with reason "More by [Author Name]"
```

##### Genre Affinity Algorithm

**Purpose:** Suggest unread books in the user's favorite genres.

**Logic:**

```
1. Aggregate subjects from all finished+rated books
2. Weight by rating: genre_score[subject] += rating for each book
3. Rank genres by total score
4. Find books on TBR shelf matching top genres
5. Score each TBR book by genre overlap with top genres
6. RETURN ranked TBR recommendations with reason "Popular in [Genre]"
```

##### Similar Book Algorithm

**Purpose:** Find books similar to ones the user rated highly.

**Logic:**

```
1. For each book rated 4.0+:
   a. Get subjects, tags, and mood tags
   b. Search TBR shelf for books with overlapping attributes
   c. Similarity score = count of shared attributes / total unique attributes
   d. Filter to similarity >= 0.3 (at least 30% overlap)
2. Deduplicate across source books
3. RETURN with reason "Because you liked [Source Book Title]"
```

**Edge Cases:**
- New user with no ratings: show "Rate more books" prompt
- User with all books read (no TBR): suggest adding new books
- Books with no subjects/tags: low similarity scores, still included if author matches
- Recommendation caching: recompute on each view (local SQLite is fast enough)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient data | "Rate at least 5 books" prompt | User rates more books |
| No matches found | "No recommendations right now" | User adds more TBR books |
| Open Library query fails (for author works) | Local-only recommendations shown | Silently degraded |

#### 3.9 Acceptance Criteria

1. **Given** a user who rated 3 books by Andy Weir 4.5+ stars,
   **When** recommendations are computed,
   **Then** "More by Authors You Love" includes Andy Weir's other books.

2. **Given** a user who reads mostly science fiction (10 sci-fi books rated),
   **When** recommendations are computed,
   **Then** "Popular in Genres You Read" shows sci-fi books from the user's TBR shelf.

3. **Given** a user rated "Dune" 5 stars (subjects: "Science Fiction", "Space"),
   **When** similar book matching runs,
   **Then** TBR books with "Science Fiction" or "Space" subjects are recommended with "Because you liked Dune".

4. **Given** fewer than 5 rated books,
   **When** the recommendations screen loads,
   **Then** a prompt appears instead of recommendations.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| author affinity ranks by score | 3 authors with different counts/ratings | Sorted by weighted score |
| genre affinity weights by rating | genres from 4.5-rated and 2.0-rated books | 4.5-rated genre scores higher |
| similar book calculates overlap | book A subjects ["a","b","c"], book B subjects ["b","c","d"] | similarity: 2/4 = 0.5 |
| filters minimum similarity | similarity 0.2 | Excluded (below 0.3 threshold) |
| requires minimum 5 ratings | 3 rated books | Returns insufficient_data flag |
| deduplicates across sources | same book recommended by 2 strategies | Appears once with highest score |

---

### BK-025: Social Feed

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-025 |
| **Feature Name** | Social Feed |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a social reader, I want to see what my friends are reading and rating, so that I can discover books through people I trust and engage with their reading activity.

#### 3.3 Detailed Description

The Social Feed is an opt-in activity stream showing friends' reading activity. It displays share events (BK-023) from connected users with visibility set to "friends" or "public". Activities include: rated a book, wrote a review, finished a book, added a book to their library, and started reading.

The social layer requires the optional Supabase authentication and sync features (from MyLife hub Phase 3). Users must create an account and explicitly opt in to social features. Friend connections are mutual (both users must accept). All social data sync is encrypted in transit.

For local-only users (no account), this feature is hidden entirely.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management
- BK-023: Share Events - Feed items come from share events

**External Dependencies:**
- Supabase Auth (optional, from MyLife hub) for user identity
- Network connectivity for syncing friend activity
- Push notifications service for activity alerts

#### 3.5 User Interface Requirements

##### Screen: Social Feed

**Layout:**
- Reverse-chronological feed of friend activity
- Each feed item: friend avatar/name, action description, book cover thumbnail, timestamp
- Action types and display:
  - "Alice rated Dune 4.5 stars" (with star display)
  - "Bob finished Project Hail Mary" (with checkmark)
  - "Carol started reading The Name of the Wind"
  - "Dave reviewed The Way of Kings" (with expandable review text)
- Tap book cover/title: navigates to Book Detail (or "Add to Library" if not owned)
- Tap friend name: shows friend's public profile (shared books, stats)
- Pull-to-refresh: fetches latest activity

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Not Signed In | No account | "Sign in to see what your friends are reading" with sign-in button |
| No Friends | Signed in, 0 connections | "Connect with friends to see their reading activity" with invite/search option |
| Empty Feed | Friends connected, no recent activity | "Your friends haven't shared anything recently" |
| Populated | Activity exists | Scrollable feed |

##### Screen: Friend Search/Invite

**Layout:**
- Search by username or email
- "Invite via Link" option (generates shareable invite URL)
- Pending requests section (incoming and outgoing)
- Friends list with "Remove" option

#### 3.6 Data Requirements

Social data lives in Supabase (cloud), not local SQLite. The following entities are specified for the cloud schema:

##### Cloud Entity: FriendConnection

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | UUID | Primary key | Auto | Unique identifier |
| requester_id | UUID | References auth.users.id | None | User who sent request |
| responder_id | UUID | References auth.users.id | None | User who received request |
| status | TEXT | One of: 'pending', 'accepted', 'rejected' | 'pending' | Connection status |
| created_at | TIMESTAMPTZ | Auto-set | Current timestamp | Request time |
| accepted_at | TIMESTAMPTZ | Optional | null | Acceptance time |

##### Cloud Entity: SyncedShareEvent

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | UUID | Primary key | Auto | Unique identifier |
| user_id | UUID | References auth.users.id | None | Actor |
| event_type | TEXT | One of: 'book_rating', 'book_review', 'book_finished', 'book_started', 'book_added' | None | Activity type |
| book_title | TEXT | Required | None | Book title for display |
| book_cover_url | TEXT | Optional | null | Cover for display |
| book_authors | TEXT | Optional | null | Authors for display |
| rating | REAL | Optional | null | Rating if applicable |
| review_excerpt | TEXT | Optional, max 500 chars | null | First 500 chars of review |
| visibility | TEXT | One of: 'friends', 'public' | 'friends' | Who can see |
| created_at | TIMESTAMPTZ | Auto-set | Current timestamp | Event time |

#### 3.7 Business Logic Rules

##### Feed Assembly

**Logic:**

```
1. Get list of accepted friend IDs
2. Query SyncedShareEvents WHERE user_id IN (friend_ids)
   AND visibility IN ('friends', 'public')
   ORDER BY created_at DESC
   LIMIT 50
3. For 'public' events: also show from non-friends in discovery section
4. Paginate: load 50 at a time, infinite scroll
```

##### Friend Connection Flow

**Logic:**

```
1. User A searches for User B by username
2. User A taps "Add Friend" -> creates FriendConnection (status: pending)
3. User B sees pending request -> taps "Accept" -> status: accepted
4. Both users' share events now visible to each other
5. Either user can remove the connection (deletes FriendConnection record)
```

**Edge Cases:**
- User blocks another: rejected connections cannot be re-requested
- User deletes account: all their SyncedShareEvents and FriendConnections are deleted
- Offline: feed shows cached data with "Last updated X ago" indicator
- Rate limiting: max 100 friend connections per user

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Network unavailable | "Could not load feed. Pull down to retry." with cached data shown | User retries when online |
| Friend request to self | "You cannot add yourself as a friend." | N/A |
| Friend request already sent | "Request already sent to this user." | N/A |
| User not found | "No user found with that username." | User checks spelling |

#### 3.9 Acceptance Criteria

1. **Given** Alice and Bob are friends,
   **When** Alice rates a book with "friends" visibility,
   **Then** Bob sees "Alice rated [Book] [Rating]" in their feed.

2. **Given** a user is not signed in,
   **When** they navigate to the Social tab,
   **Then** a sign-in prompt is shown instead of the feed.

3. **Given** Alice sends a friend request to Bob,
   **When** Bob accepts,
   **Then** both see each other's shared activity.

4. **Given** a user sets visibility to "private" on an activity,
   **Then** no SyncedShareEvent is created and friends do not see it.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| feed shows only friend activity | 3 friends, 2 non-friends with events | Only friend events in feed |
| feed respects visibility | friend with private event | Event not in feed |
| friend connection requires acceptance | pending connection | No shared events yet |
| feed ordered by recency | 5 events at different times | Newest first |
| max 100 friends enforced | attempt 101st connection | Error: friend limit reached |

---

### BK-026: Badge/Achievement System

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-026 |
| **Feature Name** | Badge/Achievement System |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a gamification-motivated reader, I want to earn badges for reading milestones, so that I feel rewarded for my reading habits and inspired to read more.

#### 3.3 Detailed Description

The Badge/Achievement System awards badges for reading milestones, computed entirely from local data. Badges are earned automatically when criteria are met. Categories include:

- **Volume badges:** 10, 25, 50, 100, 250, 500, 1000 books read
- **Page badges:** 5,000, 10,000, 25,000, 50,000, 100,000 pages read
- **Genre explorer:** Read from 5, 10, 15, 20 distinct genres
- **Author diversity:** Read 10, 25, 50, 100 unique authors
- **Streak badges:** 7-day, 30-day, 90-day, 365-day reading streaks
- **Challenge badges:** Complete 1, 5, 10, 25 challenges
- **Speed badges:** Finish a book in 1 day, 3 days
- **Review badges:** Write 10, 25, 50, 100 reviews
- **Journal badges:** Write 10, 25, 50 journal entries

Badges have three tiers: bronze, silver, gold (different thresholds within the same category). Each badge has a name, description, icon, and earned date. Badges are checked on every relevant state change (book finished, review written, etc.).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-006: Reading Sessions - Completion data
- BK-009: Reading Statistics - Stats for threshold checks
- BK-013: Reading Challenges - Challenge completion counts
- BK-014: Encrypted Journal - Journal entry counts

#### 3.5 User Interface Requirements

##### Screen: Badges

**Layout:**
- Grid of badge icons (4 columns)
- Earned badges: full color with earned date
- Unearned badges: grayed out with progress indicator (e.g., "7/10 books")
- Tap badge: expands to show name, description, criteria, and progress
- Categories as horizontal tab bar: All, Volume, Genres, Streaks, Challenges, Reviews

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Badges | New user | All badges grayed out with "Start reading to earn your first badge!" |
| Some Earned | Mix of earned and unearned | Earned badges in color at top, unearned below |

##### Component: Badge Notification

**Layout:**
- When a badge is newly earned: celebratory toast/modal with badge icon, name, and "You earned a new badge!" message
- Confetti animation (brief, 1-2 seconds)

#### 3.6 Data Requirements

##### Entity: Badge (new table, migration v5)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | None | Badge identifier (e.g., "volume_50_books") |
| category | TEXT | One of: 'volume', 'pages', 'genre', 'author', 'streak', 'challenge', 'speed', 'review', 'journal' | None | Badge category |
| name | TEXT | Required | None | Display name (e.g., "Bookworm") |
| description | TEXT | Required | None | How to earn (e.g., "Read 50 books") |
| tier | TEXT | One of: 'bronze', 'silver', 'gold' | None | Badge tier |
| threshold | INTEGER | Required, positive | None | Number to reach |
| icon | TEXT | Required | None | Badge icon/emoji |
| earned_at | TEXT | Optional, ISO datetime | null | When earned (null = not yet earned) |

#### 3.7 Business Logic Rules

##### Badge Evaluation

**Purpose:** Check if any new badges should be awarded after a state change.

**Logic:**

```
1. On trigger event (book finished, review written, challenge completed, etc.):
2. Get current stats: total books, total pages, genre count, author count,
   current streak, challenge completions, review count, journal count
3. For each badge definition:
   a. IF badge.earned_at IS NOT NULL: skip (already earned)
   b. IF current_stat >= badge.threshold:
        SET badge.earned_at = now
        Show celebration notification
4. Batch evaluate all badges in category related to the trigger
```

##### Badge Definitions (Complete List)

| ID | Category | Name | Tier | Threshold | Criteria |
|----|----------|------|------|-----------|---------|
| volume_10 | volume | First Steps | bronze | 10 | Read 10 books |
| volume_25 | volume | Page Turner | bronze | 25 | Read 25 books |
| volume_50 | volume | Bookworm | silver | 50 | Read 50 books |
| volume_100 | volume | Bibliophile | silver | 100 | Read 100 books |
| volume_250 | volume | Library Builder | gold | 250 | Read 250 books |
| volume_500 | volume | Reading Machine | gold | 500 | Read 500 books |
| volume_1000 | volume | Legendary Reader | gold | 1000 | Read 1000 books |
| pages_5k | pages | Getting Started | bronze | 5000 | Read 5,000 pages |
| pages_10k | pages | Ten Thousand Pages | bronze | 10000 | Read 10,000 pages |
| pages_25k | pages | Quarter Centurion | silver | 25000 | Read 25,000 pages |
| pages_50k | pages | Page Devourer | silver | 50000 | Read 50,000 pages |
| pages_100k | pages | Hundred Grand | gold | 100000 | Read 100,000 pages |
| genre_5 | genre | Genre Curious | bronze | 5 | Read from 5 genres |
| genre_10 | genre | Genre Explorer | silver | 10 | Read from 10 genres |
| genre_20 | genre | Genre Master | gold | 20 | Read from 20 genres |
| author_10 | author | Author Sampler | bronze | 10 | Read 10 unique authors |
| author_50 | author | Author Collector | silver | 50 | Read 50 unique authors |
| author_100 | author | Author Connoisseur | gold | 100 | Read 100 unique authors |
| streak_7 | streak | Week Warrior | bronze | 7 | 7-day reading streak |
| streak_30 | streak | Month of Reading | silver | 30 | 30-day reading streak |
| streak_90 | streak | Quarter Crusader | silver | 90 | 90-day reading streak |
| streak_365 | streak | Year of Reading | gold | 365 | 365-day reading streak |
| challenge_1 | challenge | Challenger | bronze | 1 | Complete 1 challenge |
| challenge_5 | challenge | Challenge Seeker | silver | 5 | Complete 5 challenges |
| challenge_10 | challenge | Challenge Master | gold | 10 | Complete 10 challenges |
| speed_1day | speed | Speed Reader | silver | 1 | Finish a book in 1 day |
| speed_3day | speed | Quick Read | bronze | 3 | Finish a book in 3 days or less |
| review_10 | review | Critic | bronze | 10 | Write 10 reviews |
| review_50 | review | Reviewer | silver | 50 | Write 50 reviews |
| review_100 | review | Master Critic | gold | 100 | Write 100 reviews |
| journal_10 | journal | Reflective Reader | bronze | 10 | Write 10 journal entries |
| journal_50 | journal | Journaler | silver | 50 | Write 50 journal entries |

**Edge Cases:**
- Badge thresholds are checked on relevant events only (performance optimization)
- All badges are computed from local data; no network required
- Badges are never revoked (if a book is deleted, badge remains earned)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Badge evaluation fails | Silently retries on next event | No user action needed |

#### 3.9 Acceptance Criteria

1. **Given** a user finishes their 10th book,
   **When** the badge system evaluates,
   **Then** the "First Steps" badge (volume_10) is awarded with a celebration notification.

2. **Given** a user has earned 5 badges,
   **When** they view the Badges screen,
   **Then** 5 badges are shown in color, remaining badges are grayed with progress.

3. **Given** a badge has been earned,
   **When** the triggering data is deleted (book removed),
   **Then** the badge remains earned (never revoked).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| awards badge at threshold | totalBooks: 10 | volume_10 earned |
| does not award below threshold | totalBooks: 9 | volume_10 not earned |
| skips already earned badge | volume_10 already earned, totalBooks: 11 | No duplicate award |
| awards multiple badges simultaneously | totalBooks: 50 (earns 10, 25, 50) | All three awarded |
| streak badge from reading data | 7 consecutive days with sessions | streak_7 earned |
| speed badge from session duration | book finished in 1 day | speed_1day earned |

---

### BK-027: Reading Stats Sharing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-027 |
| **Feature Name** | Reading Stats Sharing |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a proud reader, I want to generate a beautiful shareable image of my year-in-review stats, so that I can share my reading accomplishments on social media.

#### 3.3 Detailed Description

Reading Stats Sharing generates visually appealing stats cards as images that can be shared via the system share sheet. Cards are generated locally from the user's reading stats and year-in-review data. No data is transmitted to any server; the image is rendered on-device.

Card templates include: Year-in-Review summary (total books, pages, top rated), monthly reading chart, genre breakdown, top authors, and reading streak achievements. Each card is branded with the MyBooks logo and the user's display name (optional).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-009: Reading Statistics - Stats data for card content
- BK-010: Year-in-Review - Year-specific data

#### 3.5 User Interface Requirements

##### Screen: Share Stats

**Layout:**
- Card template selector (horizontal scroll of card previews)
- Live preview of selected card with user's data
- "Customize" button: toggle display name, choose card color theme
- "Share" button: opens system share sheet with rendered image

**Card Templates:**

1. **Year Summary** - Total books, total pages, average rating, top 3 books (covers + titles)
2. **Monthly Chart** - Bar chart of books per month, total at top
3. **Genre Pie** - Genre breakdown pie/donut chart with labels
4. **Top Authors** - List of top 5 authors with book count
5. **Reading Streak** - Current and longest streak with calendar visualization

**Interactions:**
- Swipe through card templates
- Tap "Share": renders current card as PNG (1080x1920px for social media optimal), opens share sheet

#### 3.6 Data Requirements

No new entities. Cards are rendered from computed ReadingStats and YearInReview data.

#### 3.7 Business Logic Rules

##### Card Rendering

**Logic:**

```
1. Compute stats for selected time period (year, all-time)
2. Populate card template with data values
3. Render to canvas/image at 1080x1920px (9:16 aspect ratio)
4. Export as PNG
5. Open system share sheet with image
```

**Edge Cases:**
- Insufficient data for a card type (e.g., no genre data for Genre Pie): card template disabled with tooltip "Rate more books to unlock this card"
- Very long book titles on card: truncated with "..."
- No cover images: placeholder covers used in card

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Image generation fails | Toast: "Could not generate image. Try again." | User retries |
| No stats data | Cards disabled with prompt | User reads more books |

#### 3.9 Acceptance Criteria

1. **Given** the user has a complete year-in-review for 2025,
   **When** they select the Year Summary card and tap Share,
   **Then** a 1080x1920px PNG image is generated with their stats and the share sheet opens.

2. **Given** the user has no finished books,
   **When** they open Share Stats,
   **Then** all card templates show "Read more books to share your stats."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| renders year summary card | YearInReview data | PNG blob with non-zero size |
| truncates long titles | title: 100+ chars | Truncated to fit card layout |
| disables card with insufficient data | 0 finished books | Card marked as disabled |

---

### BK-028: Book Clubs

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-028 |
| **Feature Name** | Book Clubs |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a book club member, I want to create and join book clubs in the app, so that I can coordinate group reading and discuss books with fellow readers.

#### 3.3 Detailed Description

Book Clubs provide group reading coordination with discussion threads, shared reading pace tracking, and group ratings. A club has a name, description, members, and a current book. Members can see each other's reading progress for the current book and post discussion messages.

Book Clubs can operate in two modes:
1. **Local-only** - Single user tracks personal book club notes, discussion prompts, and reading schedule. No network needed.
2. **Connected** - Multiple users in a synced club via Supabase. Requires authentication and network.

The initial implementation focuses on local-only mode, with connected mode planned for a future phase.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Club books must exist in library
- BK-006: Reading Sessions - Progress tracking for club reads
- BK-025: Social Feed - Connected mode uses social infrastructure

**External Dependencies:**
- Supabase Auth and Realtime (for connected mode, future)

#### 3.5 User Interface Requirements

##### Screen: Book Clubs List

**Layout:**
- List of clubs the user belongs to (or created)
- Each club card: name, current book cover, member count, reading deadline
- "Create Club" button

##### Screen: Club Detail

**Layout:**
- Club name, description
- Current book section: cover, title, group progress (average % across members)
- Reading schedule: start date, end date, current milestone
- Discussion thread: chronological messages (local notes in local mode)
- Members list (connected mode) with individual progress bars
- "Set Next Book" button (for club admin)

##### Modal: Create Club

**Layout:**
- Club name (required, max 200)
- Description (optional, max 1000)
- Select first book from library
- Reading schedule: start date, end date
- Mode: Local Only or Connected (connected greyed out until Phase 3)

#### 3.6 Data Requirements

##### Entity: BookClub (new table, migration v5)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| name | TEXT | Required, min 1, max 200 | None | Club name |
| description | TEXT | Optional, max 1000 | null | Club description |
| current_book_id | TEXT (UUID) | References bk_books.id, ON DELETE SET NULL | null | Currently reading |
| reading_start_date | TEXT | Optional, ISO date | null | When club reading starts |
| reading_end_date | TEXT | Optional, ISO date | null | Reading deadline |
| mode | TEXT | One of: 'local', 'connected' | 'local' | Club mode |
| is_active | INTEGER | 0 or 1 | 1 | Whether club is active |
| created_at | TEXT | ISO datetime | Current timestamp | Creation time |
| updated_at | TEXT | ISO datetime | Current timestamp | Last modification |

##### Entity: BookClubNote (new table, migration v5)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| club_id | TEXT (UUID) | References bk_book_clubs.id, ON DELETE CASCADE | None | Parent club |
| book_id | TEXT (UUID) | References bk_books.id, ON DELETE SET NULL | null | Related book |
| content | TEXT | Required, max 5000 | None | Note/discussion content |
| note_type | TEXT | One of: 'discussion', 'prompt', 'schedule' | 'discussion' | Type of note |
| created_at | TEXT | ISO datetime | Current timestamp | Creation time |

#### 3.7 Business Logic Rules

##### Club Reading Progress

**Logic:**

```
1. For local mode: track user's own progress via existing ReadingSession for current_book_id
2. For connected mode (future): aggregate progress from all members via Supabase
3. Display as group progress bar with individual member indicators
```

**Edge Cases:**
- Club with no current book: show "Set a book to start reading together"
- Changing current book: previous book's progress archived, new book's progress starts fresh
- Member has not added the club's book to their library: prompt "Add [Book] to your library to join the reading"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Club book not in user's library | Prompt to add book | User adds book |
| Reading deadline passed | "Reading period ended" banner with option to extend | Admin extends deadline |

#### 3.9 Acceptance Criteria

1. **Given** the user creates a local book club "Sci-Fi Monthly" with "Dune" as current book,
   **When** they view the club,
   **Then** the club detail shows "Dune" as current read with the user's reading progress.

2. **Given** a book club with a reading schedule,
   **When** the deadline approaches,
   **Then** the club card shows days remaining.

3. **Given** the user adds discussion notes to a club,
   **Then** notes are saved and displayed in chronological order.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates club with name and book | name: "Monthly", book_id: valid | Club record created |
| adds note to club | content: "Great chapter 5!" | Note saved with timestamp |
| sets current book | book_id: new book | current_book_id updated |
| deactivates club | is_active: 0 | Club hidden from active list |

---

### BK-029: Author Following

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-029 |
| **Feature Name** | Author Following |
| **Priority** | P3 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a fan of specific authors, I want to follow my favorite authors and get notified when they publish new books, so that I never miss a new release.

#### 3.3 Detailed Description

Author Following lets users mark authors as "followed." The system periodically polls the Open Library API for new works by followed authors and notifies the user of new releases. Polling happens at most once per day per author when the app is opened.

Authors are identified by their Open Library Author ID (OLID). When a user follows an author, the app stores the OLID and the list of known work IDs. On each poll, it compares the current works list with the stored list to detect new additions.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-001: Library Management - Author data from books
- BK-002: Book Search - Open Library API for polling

**External Dependencies:**
- Network for Open Library API polling
- Local notifications for new release alerts

#### 3.5 User Interface Requirements

##### Screen: Followed Authors

**Layout:**
- List of followed authors with name, book count in user's library, last checked date
- "Follow" button on author pages and Book Detail author names
- New release indicator: badge on author row when new work detected

##### Component: Author Profile

**Layout:**
- Author name, photo (from Open Library), bio excerpt
- Books in user's library by this author
- Other works by this author (from Open Library, with "Add to Library" buttons)
- "Follow" / "Unfollow" toggle

#### 3.6 Data Requirements

##### Entity: FollowedAuthor (new table, migration v5)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| author_name | TEXT | Required | None | Author display name |
| open_library_author_id | TEXT | Required, unique | None | Open Library Author ID (OLID) |
| known_work_ids | TEXT | JSON array | '[]' | List of known work OLIDs |
| last_checked_at | TEXT | Optional, ISO datetime | null | Last poll time |
| new_works_count | INTEGER | Non-negative | 0 | Unacknowledged new works |
| created_at | TEXT | ISO datetime | Current timestamp | Follow time |

#### 3.7 Business Logic Rules

##### New Release Detection

**Logic:**

```
1. On app open (at most once per day per author):
2. For each followed author where last_checked_at is > 24 hours ago:
   a. Fetch /authors/{olid}/works.json from Open Library
   b. Compare work IDs with known_work_ids
   c. IF new works found:
        new_works_count += count of new works
        Append new work IDs to known_work_ids
        Send local notification: "[Author] has a new book: [Title]"
   d. Update last_checked_at
3. Rate limit: max 10 author checks per app open session
```

**Edge Cases:**
- Author with hundreds of works: only store work IDs, not full metadata
- Open Library API down: skip check, try again next day
- Author OLID changes (rare): handle gracefully, log warning
- User follows author with no OLID in their books: prompt to search Open Library for the author

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| API unavailable | Silent retry next session | No user action |
| Author not found on Open Library | "Could not find this author on Open Library." | User searches manually |

#### 3.9 Acceptance Criteria

1. **Given** the user follows "Andy Weir" (OLID: OL7115219A),
   **When** the app checks and finds a new work not in known_work_ids,
   **Then** a notification appears: "Andy Weir has a new book: [Title]".

2. **Given** 5 followed authors,
   **When** the app opens after 24+ hours,
   **Then** up to 5 author checks are performed (rate limited to 10).

3. **Given** a new work notification,
   **When** the user taps it,
   **Then** they are shown the new book with an option to add it to their library.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects new work | known: [W1, W2], current: [W1, W2, W3] | new_works_count: 1, W3 detected |
| no new works | known: [W1, W2], current: [W1, W2] | new_works_count: 0 |
| respects 24-hour cooldown | last_checked: 12 hours ago | Skip check |
| rate limits checks | 15 authors, app open | Only 10 checked |

---

### BK-030: Reading Streak Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-030 |
| **Feature Name** | Reading Streak Tracking |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a habit-forming reader, I want to track my daily reading streak, so that I am motivated to read every day and maintain my streak.

#### 3.3 Detailed Description

Reading Streak Tracking monitors consecutive days with reading activity. A day counts as "active" if the user logged a timed reading session (BK-022) or updated their reading progress (BK-021) on that day. The system tracks current streak length and longest-ever streak.

Streak data is computed from existing timed session and progress update timestamps. No new data storage is needed; streaks are derived on demand.

Optional push notifications remind the user to read if their streak is at risk (e.g., "You haven't read today. Keep your 15-day streak alive!").

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-006: Reading Sessions
- BK-021: Reading Progress Tracking
- BK-022: Timed Reading Sessions

#### 3.5 User Interface Requirements

##### Component: Streak Display (Home Tab)

**Layout:**
- Flame icon with streak count in large text (e.g., "15" with flame emoji)
- "day reading streak" label
- Below: "Longest streak: 42 days"
- Weekly calendar row showing last 7 days with filled/unfilled indicators
- If streak is 0: "Start your reading streak today!"

##### Component: Streak Notification

**Layout:**
- Evening push notification (configurable time, default 8 PM): "You haven't read today. Your [N]-day streak is at risk!"
- Only sent if streak >= 3 days and no activity recorded today

#### 3.6 Data Requirements

No new entities. Streaks are computed from existing `bk_timed_sessions.started_at` and `bk_progress_updates.created_at` timestamps.

##### Computed Type: StreakData

| Field | Type | Description |
|-------|------|-------------|
| currentStreak | number | Consecutive days with activity up to today |
| longestStreak | number | Longest-ever consecutive day run |
| todayActive | boolean | Whether today has activity |
| weekHistory | boolean[] | Last 7 days activity (index 0 = 6 days ago, 6 = today) |

#### 3.7 Business Logic Rules

##### Streak Calculation

**Logic:**

```
1. Get distinct dates from:
   - SELECT DISTINCT date(started_at) FROM bk_timed_sessions
   - UNION
   - SELECT DISTINCT date(created_at) FROM bk_progress_updates
2. Sort dates ascending
3. Walk dates to find consecutive runs:
   - longestStreak = max run length
4. Current streak: count backwards from today
   - IF today or yesterday has activity: start counting consecutive days back
   - ELSE: currentStreak = 0
5. Week history: check each of last 7 days for activity
```

**Edge Cases:**
- Multiple activities on same day: still counts as 1 day
- Timezone handling: use device local timezone for day boundaries
- No activity ever: currentStreak = 0, longestStreak = 0
- Streak broken yesterday: currentStreak = 0 (even if active today, starts new streak of 1)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Notification permission denied | Streak reminder not sent | Feature works without notifications |

#### 3.9 Acceptance Criteria

1. **Given** the user has read every day for 15 consecutive days,
   **When** the streak is displayed,
   **Then** currentStreak shows 15 with flame icon.

2. **Given** a 15-day streak and the user misses a day,
   **When** streak is recalculated,
   **Then** currentStreak resets to 0 (or 1 if they read the following day).

3. **Given** streak notifications are enabled and streak >= 3 days,
   **When** 8 PM arrives with no reading activity today,
   **Then** a notification is sent.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates current streak | 5 consecutive days including today | currentStreak: 5 |
| resets streak on gap | last activity 2 days ago | currentStreak: 0 |
| finds longest streak | streaks of 3, 7, 5 | longestStreak: 7 |
| week history correct | active Mon, Wed, Thu, Fri | [true, false, true, true, true, false, false] (mapped to last 7) |
| handles no data | no sessions or updates | currentStreak: 0, longestStreak: 0 |

---

### BK-031: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-031 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user, I want to customize app behavior and manage my data, so that the app works the way I prefer.

#### 3.3 Detailed Description

Settings provides a central location for app configuration, data management, and account actions. Settings are stored as key-value pairs in the `bk_settings` table. Available settings include default sort order, default view mode (list/grid), reading goal reminders, streak notifications, theme preference, and social privacy defaults.

The Settings screen also provides access to Import (BK-015, BK-016), Export (BK-017), and data deletion.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Settings (Settings Tab)

**Layout:**
- Grouped settings sections:
  - **Library:** Default sort order, Default view mode (list/grid)
  - **Reading:** Reading goal reminders (on/off + time), Streak notifications (on/off + time)
  - **Privacy:** Default share visibility (private/friends/public), Social features (on/off)
  - **Data:** Import from Goodreads, Import from StoryGraph, Export Library (CSV/JSON/Markdown), Export Journal, Delete All Data
  - **About:** Version, Open Source licenses, Privacy Policy, Send Feedback

**Interactions:**
- Toggle switches for on/off settings
- Picker/dropdown for multi-option settings
- "Delete All Data" requires typed confirmation ("DELETE") plus biometric/PIN confirmation
- Each import/export option navigates to its respective screen

#### 3.6 Data Requirements

##### Entity: Settings (key-value store)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| default_sort | string | 'date_added_desc' | Default library sort order |
| default_view | string | 'list' | Library view mode (list/grid) |
| goal_reminder_enabled | string | 'false' | Reading goal reminder toggle |
| goal_reminder_time | string | '20:00' | Reminder time (HH:MM) |
| streak_notification_enabled | string | 'false' | Streak notification toggle |
| streak_notification_time | string | '20:00' | Notification time |
| default_visibility | string | 'private' | Default share visibility |
| social_enabled | string | 'false' | Social features master toggle |

#### 3.7 Business Logic Rules

##### Delete All Data

**Purpose:** Irreversibly remove all MyBooks data.

**Logic:**

```
1. User taps "Delete All Data"
2. Confirmation dialog: "This will permanently delete all your books, reviews,
   reading history, journal entries, and settings. This cannot be undone."
3. User must type "DELETE" to confirm
4. Optionally require biometric/PIN authentication
5. Drop all bk_* tables
6. Recreate empty schema (run migrations from v1)
7. Toast: "All data has been deleted."
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Setting save fails | Toast: "Could not save setting." | User retries |
| Data deletion fails | Toast: "Could not delete data. Please try again." | User retries |
| Invalid setting value | Setting reverted to previous value | Automatic |

#### 3.9 Acceptance Criteria

1. **Given** the user changes default sort to "Title A-Z",
   **When** they open the Library tab,
   **Then** books are sorted by title A-Z by default.

2. **Given** the user taps "Delete All Data" and types "DELETE" to confirm,
   **Then** all bk_* data is removed and the app returns to empty state with system shelves.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| saves and retrieves setting | key: "default_sort", value: "title_asc" | Retrieved value matches |
| default values for missing keys | key not in database | Default returned |
| delete all data clears tables | (populated database) | All bk_* tables empty, system shelves re-seeded |

---

### BK-032: Onboarding and First-Run

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BK-032 |
| **Feature Name** | Onboarding and First-Run |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a new user, I want a brief introduction to the app's features, so that I understand what MyBooks can do and how to get started.

#### 3.3 Detailed Description

The onboarding flow appears on first launch only (tracked via bk_settings key "onboarding_completed"). It consists of 3-4 swipeable screens introducing key features, followed by a quick-start action (scan a book, search, or skip).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BK-031: Settings - Onboarding state stored in settings

#### 3.5 User Interface Requirements

##### Screen: Onboarding Flow (3-4 pages)

**Layout:**
- Page 1: "Welcome to MyBooks" - app logo, tagline "Track your reading life", privacy message
- Page 2: "Your Library, Your Rules" - illustration of library features, privacy callout
- Page 3: "Track Everything" - reading sessions, goals, stats highlights
- Page 4: "Get Started" - three action buttons: "Search for a Book", "Scan a Barcode", "Skip for Now"
- Dot indicators at bottom showing current page
- "Skip" link in top right on all pages

**Interactions:**
- Swipe left/right to navigate pages
- Tap action button on last page: performs action and sets onboarding_completed = true
- Tap "Skip" on any page: sets onboarding_completed = true, goes to empty library

#### 3.6 Data Requirements

No new entities. Uses `bk_settings` with key `onboarding_completed` (value: 'true'/'false').

#### 3.7 Business Logic Rules

**Logic:**

```
1. On app launch: check bk_settings WHERE key = 'onboarding_completed'
2. IF value = 'true' OR key exists with truthy value: skip onboarding
3. ELSE: show onboarding flow
4. On completion (any exit path): SET onboarding_completed = 'true'
5. Onboarding never shows again
```

#### 3.8 Error Handling

No error scenarios; onboarding is read-only.

#### 3.9 Acceptance Criteria

1. **Given** a fresh app install,
   **When** the app launches for the first time,
   **Then** the onboarding flow appears.

2. **Given** onboarding was completed,
   **When** the app launches again,
   **Then** onboarding does not appear (goes straight to library).

3. **Given** the user taps "Skip" on the first onboarding page,
   **Then** onboarding is dismissed and marked complete.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| shows onboarding on fresh install | no onboarding_completed key | Onboarding displayed |
| skips onboarding when completed | onboarding_completed = 'true' | Onboarding not displayed |
| completing onboarding sets flag | user finishes onboarding | onboarding_completed = 'true' saved |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Book** entity. Each Book can have multiple ReadingSessions (tracking read-throughs), Reviews (with half-star ratings), Tags (user-created labels), MoodTags (mood/pace/genre descriptors), ContentWarnings, and JournalEntries (private reflections). Books are organized into Shelves via a many-to-many junction. Books can belong to Series with defined reading order.

The E-Reader subsystem adds ReaderDocuments (uploaded ePub/PDF content) with ReaderNotes (highlights, bookmarks, annotations) and per-document ReaderPreferences. Documents can optionally link to a Book record.

Reading progress is tracked via ProgressUpdates (page snapshots) and TimedSessions (stopwatch-based reading measurements). Challenges define reading goals with flexible types and time frames, with ChallengeProgress tracking auto-logged achievements.

Social features use ShareEvents for visibility-controlled activity publishing. Book Clubs (local mode) store club metadata and discussion notes. Author Following tracks Open Library author IDs for new release detection. Badges are earned from milestone achievements.

All entities use the `bk_` table prefix in the shared MyLife SQLite database.

### 4.2 Complete Entity Definitions

#### Entity: Book (bk_books)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| title | TEXT | Required, min 1 | None | Book title |
| subtitle | TEXT | Optional | null | Book subtitle |
| authors | TEXT | Required | None | JSON array of author names |
| isbn_10 | TEXT | Optional | null | ISBN-10 |
| isbn_13 | TEXT | Optional | null | ISBN-13 |
| open_library_id | TEXT | Optional | null | OL work ID |
| open_library_edition_id | TEXT | Optional | null | OL edition ID |
| cover_url | TEXT | Optional | null | Cover image URL |
| cover_cached_path | TEXT | Optional | null | Local cache path |
| publisher | TEXT | Optional | null | Publisher name |
| publish_year | INTEGER | Optional | null | Publication year |
| page_count | INTEGER | Optional, positive | null | Total pages |
| subjects | TEXT | Optional | null | JSON array of subjects |
| description | TEXT | Optional | null | Book description |
| language | TEXT | Optional | 'en' | ISO language code |
| format | TEXT | physical/ebook/audiobook | 'physical' | Book format |
| added_source | TEXT | search/scan/manual/import_* | 'manual' | How added |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: Shelf (bk_shelves)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| name | TEXT | Required, unique | None | Shelf name |
| slug | TEXT | Required, unique | None | URL-safe slug |
| icon | TEXT | Optional | null | Emoji/icon |
| color | TEXT | Optional | null | Hex color |
| is_system | INTEGER | 0/1 | 0 | System shelf flag |
| sort_order | INTEGER | Non-negative | 0 | Display order |
| book_count | INTEGER | Non-negative | 0 | Cached book count |
| created_at | TEXT | ISO datetime | now | Created |

#### Entity: BookShelf (bk_book_shelves)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Book reference |
| shelf_id | TEXT (UUID) | FK -> bk_shelves, CASCADE | None | Shelf reference |
| added_at | TEXT | ISO datetime | now | Assignment time |

PK: (book_id, shelf_id)

#### Entity: ReadingSession (bk_reading_sessions)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Associated book |
| started_at | TEXT | Optional | null | Start date |
| finished_at | TEXT | Optional | null | Finish date |
| current_page | INTEGER | Non-negative | 0 | Current page |
| status | TEXT | want_to_read/reading/finished/dnf | 'want_to_read' | Reading status |
| dnf_reason | TEXT | Optional | null | DNF reason |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: Review (bk_reviews)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Associated book |
| session_id | TEXT (UUID) | FK -> bk_reading_sessions, SET NULL | null | Associated session |
| rating | REAL | 0.5-5.0, step 0.5, nullable | null | Half-star rating |
| review_text | TEXT | Optional | null | Review content |
| favorite_quote | TEXT | Optional | null | Favorite quote |
| is_favorite | INTEGER | 0/1 | 0 | Favorite flag |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: Tag (bk_tags)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| name | TEXT | Required, unique | None | Tag name |
| color | TEXT | Optional | null | Hex color |
| usage_count | INTEGER | Non-negative | 0 | Book count using tag |
| created_at | TEXT | ISO datetime | now | Created |

#### Entity: BookTag (bk_book_tags)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Book |
| tag_id | TEXT (UUID) | FK -> bk_tags, CASCADE | None | Tag |

PK: (book_id, tag_id)

#### Entity: ReadingGoal (bk_reading_goals)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| year | INTEGER | 1900-2100, unique | None | Goal year |
| target_books | INTEGER | Positive | None | Book target |
| target_pages | INTEGER | Optional, positive | null | Page target |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: OLCache (bk_ol_cache)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| isbn | TEXT | PK | None | Cache key |
| response_json | TEXT | Required | None | Cached API response |
| cover_downloaded | INTEGER | 0/1 | 0 | Cover cached locally |
| fetched_at | TEXT | ISO datetime | now | Cache time |

#### Entity: ImportLog (bk_import_log)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| source | TEXT | goodreads/storygraph | None | Import source |
| filename | TEXT | Required | None | File name |
| books_imported | INTEGER | Non-negative | 0 | Success count |
| books_skipped | INTEGER | Non-negative | 0 | Skip count |
| errors | TEXT | Optional, JSON | null | Error messages |
| imported_at | TEXT | ISO datetime | now | Import time |

#### Entity: Settings (bk_settings)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | TEXT | PK | None | Setting key |
| value | TEXT | Required | None | Setting value |

#### Entity: ShareEvent (bk_share_events)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| actor_user_id | TEXT | Required | None | Acting user |
| object_type | TEXT | book_rating/book_review/list_item/generic | None | Object type |
| object_id | TEXT | Required | None | Object reference |
| visibility | TEXT | private/friends/public | 'private' | Visibility |
| payload_json | TEXT | JSON | '{}' | Display payload |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: ReaderDocument (bk_reader_documents)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| book_id | TEXT (UUID) | FK -> bk_books, SET NULL | null | Linked book |
| title | TEXT | Required | None | Document title |
| author | TEXT | Optional | null | Author |
| source_type | TEXT | upload/import/note | 'upload' | Source |
| mime_type | TEXT | Optional | null | MIME type |
| file_name | TEXT | Optional | null | Original filename |
| file_extension | TEXT | Optional | null | Extension |
| text_content | TEXT | Required | None | Parsed text |
| content_hash | TEXT | Optional | null | SHA-256 hash |
| total_chars | INTEGER | Non-negative | 0 | Character count |
| total_words | INTEGER | Non-negative | 0 | Word count |
| current_position | INTEGER | Non-negative | 0 | Reading position |
| progress_percent | REAL | 0-100 | 0 | Progress % |
| last_opened_at | TEXT | Optional | null | Last opened |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: ReaderNote (bk_reader_notes)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| document_id | TEXT (UUID) | FK -> bk_reader_documents, CASCADE | None | Parent doc |
| note_type | TEXT | note/highlight/bookmark | 'note' | Annotation type |
| selection_start | INTEGER | Non-negative | 0 | Start offset |
| selection_end | INTEGER | Non-negative | 0 | End offset |
| selected_text | TEXT | Optional | null | Selected text |
| note_text | TEXT | Optional | null | Note content |
| color | TEXT | Optional | null | Highlight color |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: ReaderPreference (bk_reader_preferences)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| document_id | TEXT (UUID) | PK, FK -> bk_reader_documents, CASCADE | None | Per-doc settings |
| font_size | INTEGER | 12-48 | 20 | Font size px |
| line_height | REAL | 1.0-3.0 | 1.6 | Line height |
| font_family | TEXT | Min 1 | 'serif' | Font family |
| theme | TEXT | dark/sepia/light | 'sepia' | Reader theme |
| margin_size | INTEGER | 0-64 | 20 | Margin px |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: ProgressUpdate (bk_progress_updates)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| session_id | TEXT (UUID) | FK -> bk_reading_sessions, CASCADE | None | Parent session |
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Book |
| page_number | INTEGER | Optional, non-negative | null | Current page |
| percent_complete | REAL | Optional, 0-100 | null | Percent |
| note | TEXT | Optional | null | Note |
| created_at | TEXT | ISO datetime | now | Created |

#### Entity: TimedSession (bk_timed_sessions)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| session_id | TEXT (UUID) | FK -> bk_reading_sessions, CASCADE | None | Parent session |
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Book |
| started_at | TEXT | Required | None | Timer start |
| ended_at | TEXT | Optional | null | Timer end |
| duration_ms | INTEGER | Optional, non-negative | null | Duration ms |
| start_page | INTEGER | Optional, non-negative | null | Start page |
| end_page | INTEGER | Optional, non-negative | null | End page |
| pages_read | INTEGER | Optional, non-negative | null | Pages read |
| pages_per_hour | REAL | Optional, non-negative | null | Speed |
| created_at | TEXT | ISO datetime | now | Created |

#### Entity: Series (bk_series)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| name | TEXT | Required | None | Series name |
| description | TEXT | Optional | null | Description |
| total_books | INTEGER | Optional, non-negative | null | Total in series |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: SeriesBook (bk_series_books)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| series_id | TEXT (UUID) | FK -> bk_series, CASCADE | None | Series |
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Book |
| sort_order | INTEGER | Non-negative | 0 | Position |
| created_at | TEXT | ISO datetime | now | Created |

PK: (series_id, book_id)

#### Entity: MoodTag (bk_mood_tags)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Book |
| tag_type | TEXT | mood/pace/genre | None | Tag category |
| value | TEXT | Required | None | Tag value |
| created_at | TEXT | ISO datetime | now | Created |

Unique: (book_id, tag_type, value)

#### Entity: ContentWarning (bk_content_warnings)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Book |
| warning | TEXT | Required | None | Warning text |
| severity | TEXT | mild/moderate/severe | 'moderate' | Severity |
| created_at | TEXT | ISO datetime | now | Created |

#### Entity: Challenge (bk_challenges)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| name | TEXT | Required | None | Challenge name |
| description | TEXT | Optional | null | Description |
| challenge_type | TEXT | books_count/pages_count/minutes_count/themed | None | Type |
| target_value | INTEGER | Positive | None | Target |
| target_unit | TEXT | books/pages/minutes | None | Unit |
| time_frame | TEXT | yearly/monthly/weekly/custom | None | Duration |
| start_date | TEXT | Required | None | Start |
| end_date | TEXT | Required | None | End |
| theme_prompt | TEXT | Optional | null | Theme (for themed type) |
| is_active | INTEGER | 0/1 | 1 | Active flag |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: ChallengeProgress (bk_challenge_progress)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| challenge_id | TEXT (UUID) | FK -> bk_challenges, CASCADE | None | Challenge |
| book_id | TEXT (UUID) | FK -> bk_books, SET NULL | null | Book |
| session_id | TEXT (UUID) | FK -> bk_reading_sessions, SET NULL | null | Session |
| value_added | INTEGER | Non-negative | 0 | Progress added |
| note | TEXT | Optional | null | Note |
| logged_at | TEXT | ISO datetime | now | Log time |

#### Entity: JournalEntry (bk_journal_entries)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| title | TEXT | Optional | null | Entry title |
| content | TEXT | Required | None | Text or ciphertext |
| content_encrypted | INTEGER | 0/1 | 0 | Encrypted flag |
| encryption_salt | TEXT | Optional | null | PBKDF2 salt |
| encryption_iv | TEXT | Optional | null | AES-GCM IV |
| word_count | INTEGER | Non-negative | 0 | Word count |
| mood | TEXT | Optional | null | Mood tag |
| is_favorite | INTEGER | 0/1 | 0 | Favorite |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: JournalPhoto (bk_journal_photos)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| entry_id | TEXT (UUID) | FK -> bk_journal_entries, CASCADE | None | Parent entry |
| file_path | TEXT | Required | None | Local file path |
| file_name | TEXT | Optional | null | Original name |
| width | INTEGER | Optional, positive | null | Image width |
| height | INTEGER | Optional, positive | null | Image height |
| sort_order | INTEGER | Non-negative | 0 | Display order |
| created_at | TEXT | ISO datetime | now | Created |

#### Entity: JournalBookLink (bk_journal_book_links)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| entry_id | TEXT (UUID) | FK -> bk_journal_entries, CASCADE | None | Entry |
| book_id | TEXT (UUID) | FK -> bk_books, CASCADE | None | Book |
| created_at | TEXT | ISO datetime | now | Created |

PK: (entry_id, book_id)

#### Entity: Badge (bk_badges) - NEW, migration v5

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PK | None | Badge identifier |
| category | TEXT | volume/pages/genre/author/streak/challenge/speed/review/journal | None | Category |
| name | TEXT | Required | None | Display name |
| description | TEXT | Required | None | How to earn |
| tier | TEXT | bronze/silver/gold | None | Tier |
| threshold | INTEGER | Positive | None | Target number |
| icon | TEXT | Required | None | Badge icon |
| earned_at | TEXT | Optional | null | When earned |

#### Entity: BookClub (bk_book_clubs) - NEW, migration v5

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| name | TEXT | Required | None | Club name |
| description | TEXT | Optional | null | Description |
| current_book_id | TEXT (UUID) | FK -> bk_books, SET NULL | null | Current read |
| reading_start_date | TEXT | Optional | null | Start date |
| reading_end_date | TEXT | Optional | null | End date |
| mode | TEXT | local/connected | 'local' | Club mode |
| is_active | INTEGER | 0/1 | 1 | Active flag |
| created_at | TEXT | ISO datetime | now | Created |
| updated_at | TEXT | ISO datetime | now | Updated |

#### Entity: BookClubNote (bk_book_club_notes) - NEW, migration v5

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| club_id | TEXT (UUID) | FK -> bk_book_clubs, CASCADE | None | Parent club |
| book_id | TEXT (UUID) | FK -> bk_books, SET NULL | null | Related book |
| content | TEXT | Required | None | Note content |
| note_type | TEXT | discussion/prompt/schedule | 'discussion' | Type |
| created_at | TEXT | ISO datetime | now | Created |

#### Entity: FollowedAuthor (bk_followed_authors) - NEW, migration v5

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | PK | Auto | Unique identifier |
| author_name | TEXT | Required | None | Display name |
| open_library_author_id | TEXT | Required, unique | None | OL Author ID |
| known_work_ids | TEXT | JSON array | '[]' | Known work OLIDs |
| last_checked_at | TEXT | Optional | null | Last poll time |
| new_works_count | INTEGER | Non-negative | 0 | Unacknowledged new works |
| created_at | TEXT | ISO datetime | now | Follow time |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Book -> ReadingSession | one-to-many | A book can be read multiple times |
| Book -> Review | one-to-many | A book can have multiple reviews (re-reads) |
| Book <-> Shelf | many-to-many | A book can be on many shelves; a shelf has many books |
| Book <-> Tag | many-to-many | A book can have many tags; a tag can be on many books |
| Book -> MoodTag | one-to-many | A book can have many mood/pace/genre tags |
| Book -> ContentWarning | one-to-many | A book can have many content warnings |
| Book <-> Series | many-to-many | A book can be in multiple series; a series has many books |
| Book <-> JournalEntry | many-to-many | A journal entry can reference many books |
| Book -> ReaderDocument | one-to-many | A book can have multiple uploaded documents |
| Book -> ProgressUpdate | one-to-many | A book has many progress snapshots |
| Book -> TimedSession | one-to-many | A book has many timed reading measurements |
| ReadingSession -> ProgressUpdate | one-to-many | A session has many progress updates |
| ReadingSession -> TimedSession | one-to-many | A session has many timed measurements |
| ReadingSession -> Review | one-to-one (optional) | A session can have one review |
| ReaderDocument -> ReaderNote | one-to-many | A document has many notes/highlights |
| ReaderDocument -> ReaderPreference | one-to-one | Each document has one preference set |
| Challenge -> ChallengeProgress | one-to-many | A challenge has many progress entries |
| JournalEntry -> JournalPhoto | one-to-many | An entry can have many photos |
| BookClub -> BookClubNote | one-to-many | A club has many discussion notes |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Book | bk_books_isbn13_idx | isbn_13 | Deduplication on import/scan |
| Book | bk_books_isbn10_idx | isbn_10 | Deduplication on import/scan |
| Book | bk_books_ol_id_idx | open_library_id | Metadata refresh |
| Book | bk_books_title_idx | title COLLATE NOCASE | Sorted listing |
| BookShelf | bk_book_shelves_shelf_idx | shelf_id | Books on a shelf |
| ReadingSession | bk_sessions_book_idx | book_id | Sessions for a book |
| ReadingSession | bk_sessions_status_idx | status | Filter by status |
| ReadingSession | bk_sessions_finished_idx | finished_at | Stats and year-in-review |
| ReadingSession | bk_sessions_started_idx | started_at | Duration calculations |
| Review | bk_reviews_book_idx | book_id | Reviews for a book |
| Review | bk_reviews_rating_idx | rating | Stats calculations |
| Review | bk_reviews_favorite_idx | is_favorite (partial) | Quick favorites lookup |
| Tag | bk_tags_name_idx | name | Autocomplete search |
| Tag | bk_tags_usage_idx | usage_count DESC | Sort by popularity |
| BookTag | bk_book_tags_tag_idx | tag_id | Reverse lookup |
| ReadingGoal | bk_goals_year_idx | year (unique) | One goal per year |
| ShareEvent | bk_share_events_actor_created_idx | actor_user_id, created_at DESC | User activity feed |
| ShareEvent | bk_share_events_object_idx | object_type, object_id | Object lookup |
| ShareEvent | bk_share_events_visibility_created_idx | visibility, created_at DESC | Visibility filter |
| ReaderDocument | bk_reader_documents_book_idx | book_id | Documents for a book |
| ReaderDocument | bk_reader_documents_last_opened_idx | last_opened_at DESC | Recent documents |
| ReaderNote | bk_reader_notes_document_created_idx | document_id, created_at DESC | Notes for a doc |
| ProgressUpdate | bk_progress_updates_session_idx | session_id | Updates per session |
| ProgressUpdate | bk_progress_updates_book_idx | book_id | Updates per book |
| TimedSession | bk_timed_sessions_book_idx | book_id | Timed sessions per book |
| TimedSession | bk_timed_sessions_started_idx | started_at | Chronological order |
| Series | bk_series_name_idx | name COLLATE NOCASE | Search by name |
| SeriesBook | bk_series_books_order_idx | series_id, sort_order | Ordered listing |
| MoodTag | bk_mood_tags_book_type_value_idx | book_id, tag_type, value (unique) | Prevent duplicates |
| MoodTag | bk_mood_tags_type_value_idx | tag_type, value | Discovery queries |
| Challenge | bk_challenges_active_idx | is_active (partial) | Active challenges |
| JournalEntry | bk_journal_entries_created_idx | created_at DESC | Chronological listing |
| JournalEntry | bk_journal_entries_favorite_idx | is_favorite (partial) | Favorites filter |

### 4.5 Table Prefix

**MyLife hub table prefix:** `bk_`

All table names in the SQLite database are prefixed with `bk_` to avoid collisions with other modules in the MyLife hub. Example: the `books` table is `bk_books`, the `shelves` table is `bk_shelves`.

### 4.6 Migration Strategy

- **Migration v1:** Core tables (books, shelves, book_shelves, reading_sessions, reviews, tags, book_tags, reading_goals, ol_cache, import_log, settings), FTS5 index, FTS triggers, core indexes, system shelf seeds.
- **Migration v2:** Share events table and share indexes.
- **Migration v3:** E-reader tables (reader_documents, reader_notes, reader_preferences) and reader indexes.
- **Migration v4:** Progress updates, timed sessions, series, series_books, mood_tags, content_warnings, challenges, challenge_progress, journal_entries, journal_photos, journal_book_links, journal FTS, and feature indexes.
- **Migration v5 (planned):** Badges, book_clubs, book_club_notes, followed_authors tables and indexes.
- Tables are created on module enable. Schema version is tracked in the hub's module_migrations table.
- Data from standalone MyBooks app can be imported via the data importer.
- Destructive migrations (column removal) are deferred to major versions only.
- All migrations run inside a transaction; failure rolls back the entire migration.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Home | House | Home Dashboard | Reading activity summary, current reads, goal progress, streak, recommendations |
| Library | Book | Library List | All books with search, sort, filter, shelf navigation |
| Search | Magnifying glass | Book Search | Open Library search, barcode scanner access |
| Reader | Open book | Reader Library | Uploaded ePub/PDF documents, built-in reader |
| Stats | Bar chart | Stats Dashboard | Reading statistics, year-in-review, badges, challenges |
| Settings | Gear | Settings | Preferences, import/export, data management, about |

### 5.2 Navigation Flow

```
[Tab 1: Home]
  +-- Goal Progress Card -> Set/Edit Goal
  +-- Currently Reading Section -> Book Detail
  +-- Recommendations Section -> Book Detail / Add Book
  +-- Streak Card
  +-- Recent Activity

[Tab 2: Library]
  +-- Shelf Cards -> Shelf Detail (filtered book list)
  +-- Book List/Grid -> Book Detail
  |     +-- Edit Book (modal)
  |     +-- Write/Edit Review
  |     +-- Add to Shelf (modal)
  |     +-- Add Tag (modal)
  |     +-- Add Content Warning (modal)
  |     +-- Series Badge -> Series Detail
  |     |     +-- Book Detail (other books in series)
  |     +-- Journal Entries for Book -> Journal Entry View
  |     +-- Reading Timer -> Timed Session Summary
  |     +-- Progress Timeline
  |     +-- Share (visibility picker)
  +-- Add Book Action Sheet
        +-- Search (Tab 3)
        +-- Scan Barcode -> Scanner -> Add Book Form
        +-- Add Manually -> Add Book Form

[Tab 3: Search]
  +-- Search Results -> Book Detail / Add Book Form
  +-- Recent Searches

[Tab 4: Reader]
  +-- Document List -> Reading View
  |     +-- Settings Panel
  |     +-- Highlights/Notes List
  +-- Upload Document

[Tab 5: Stats]
  +-- Stats Dashboard (time period filter)
  +-- Year-in-Review -> Share Stats
  +-- Challenges List -> Challenge Detail
  |     +-- Create Challenge (modal)
  +-- Badges Grid -> Badge Detail
  +-- Book Clubs List -> Club Detail
  |     +-- Create Club (modal)
  +-- Followed Authors -> Author Profile

[Tab 6: Settings]
  +-- Library Settings
  +-- Reading Settings
  +-- Privacy Settings
  +-- Import from Goodreads -> Import Screen
  +-- Import from StoryGraph -> Import Screen
  +-- Export Library
  +-- Export Journal
  +-- Delete All Data
  +-- About
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Home Dashboard | /home | Activity summary, current reads, recommendations | Tab bar |
| Library List | /library | Browse all books | Tab bar |
| Book Detail | /library/:id | View book metadata, status, review, sessions | Library, Search, Home, Series, Journal |
| Add Book Form | /library/add | Add new book manually or from search | Library add button, Search result, Scanner |
| Edit Book | /library/:id/edit | Edit book metadata | Book Detail |
| Shelf Detail | /library/shelf/:id | Books on a specific shelf | Library shelf cards |
| Book Search | /search | Search Open Library | Tab bar, Library add |
| Barcode Scanner | /search/scan | Scan book barcode | Search screen, Library add |
| Reader Library | /reader | List uploaded documents | Tab bar |
| Reading View | /reader/:id | Read ePub/PDF with annotations | Reader Library |
| Stats Dashboard | /stats | Reading statistics | Tab bar |
| Year-in-Review | /stats/year/:year | Annual reading summary | Stats Dashboard |
| Share Stats | /stats/share | Generate shareable stats cards | Year-in-Review, Stats |
| Challenges List | /stats/challenges | Active and completed challenges | Stats Dashboard |
| Challenge Detail | /stats/challenges/:id | Individual challenge progress | Challenges List |
| Badges | /stats/badges | Earned and available badges | Stats Dashboard |
| Book Clubs | /stats/clubs | Book club list | Stats Dashboard |
| Club Detail | /stats/clubs/:id | Individual club with discussion | Book Clubs |
| Followed Authors | /stats/authors | Followed authors with alerts | Stats Dashboard |
| Author Profile | /stats/authors/:id | Author info and works | Followed Authors, Book Detail |
| Journal List | /journal | All journal entries | Stats, Book Detail |
| Journal Entry | /journal/:id | View/decrypt journal entry | Journal List |
| Write Entry | /journal/new | Create journal entry | Journal List, Book Detail |
| Settings | /settings | App configuration | Tab bar |
| Import | /settings/import | Goodreads/StoryGraph CSV import | Settings |
| Social Feed | /social | Friend activity feed | Tab bar (if enabled) |
| Friend Search | /social/friends | Find and manage friends | Social Feed |
| Onboarding | /onboarding | First-run tutorial | App launch (first time) |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| mylife://books/:id | Book Detail | id: UUID of book |
| mylife://books/add | Add Book Form | None |
| mylife://books/search?q=:query | Book Search | query: search string |
| mylife://books/scan | Barcode Scanner | None |
| mylife://books/stats/year/:year | Year-in-Review | year: integer |
| mylife://books/challenge/:id | Challenge Detail | id: UUID of challenge |
| mylife://books/journal/:id | Journal Entry | id: UUID of entry |
| mylife://books/reader/:id | Reading View | id: UUID of document |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Reading time to habits | Books | Habits | Books sends daily reading minutes (from timed sessions) | On timed session end |
| Reading streak as habit | Books | Habits | Daily reading activity flag | On any reading progress update |
| Book reflections to journal | Books | Journal (MyJournal) | Journal entries tagged with book context | User links entry to book |
| Reading mood correlation | Books | Mood (MyMood) | Reading activity data available for mood analysis | On request from MyMood |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Library data (books, shelves, tags) | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Reading sessions and progress | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Ratings and reviews | Local SQLite | At rest (OS-level) | No | Never leaves device unless user shares |
| Journal entries (unencrypted) | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Journal entries (encrypted) | Local SQLite | AES-256-GCM | No | Encrypted by user passphrase |
| E-reader documents | Local SQLite | At rest (OS-level) | No | Parsed text stored locally |
| Book metadata cache | Local SQLite | No | No | Fetched from public Open Library API |
| User preferences | Local SQLite | No | No | App settings |
| Social share events | Local SQLite + Supabase (if social enabled) | In transit (TLS) | If social enabled | Only with explicit user consent |
| Friend connections | Supabase (if social enabled) | In transit (TLS) | Yes | Only if user creates account |
| Badge data | Local SQLite | No | No | Computed locally |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Book search | Fetch metadata | Search query (title/author/ISBN) | Book metadata (title, author, cover URL) | Implicit (user initiates search) |
| Cover image download | Display book covers | Cover ID in URL | JPEG/PNG image | Implicit (part of search) |
| Author works check | New release detection | Author OLID in URL | List of work IDs | Explicit (user follows author) |
| Social sync | Share reading activity | Share events with chosen visibility | Friend activity feed | Explicit (user opts in, creates account) |
| Friend management | Connect with other users | Username/email search query | User profiles | Explicit (user initiates search) |

### 7.3 Data That Never Leaves the Device

- Complete reading history (which books, when started, when finished, how long)
- Personal ratings and reviews (unless user explicitly shares via social features)
- Reading speed and progress data
- Journal entries (including encrypted content)
- Badge/achievement history
- Discovery preferences (mood tags, pace tags)
- Content warnings added by the user
- E-reader documents, highlights, and notes
- Reading goals and challenge data
- Search history within the library (FTS queries)
- Usage patterns, session counts, and behavioral data

### 7.4 User Data Ownership

- **Export:** Users can export all their data in CSV, JSON, and Markdown formats
- **Delete:** Users can delete all module data from Settings (irreversible, with typed confirmation "DELETE" and optional biometric verification)
- **Portability:** Export formats are documented, human-readable, and compatible with spreadsheet applications
- **Journal export:** Unencrypted entries export as Markdown with YAML frontmatter; encrypted entries export as "[ENCRYPTED]" placeholder
- **No vendor lock-in:** All data formats are open standards; no proprietary encoding

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Journal encryption | Optional AES-256-GCM encryption with user passphrase | PBKDF2 key derivation, 100,000 iterations |
| Passphrase policy | Minimum 8 characters for journal encryption | Enforced at UI level |
| Data deletion | Typed confirmation + optional biometric | Prevents accidental deletion |
| Social opt-in | All social features disabled by default | Master toggle in Settings |
| Visibility controls | Per-activity privacy (private/friends/public) | Default: private |
| API rate limiting | Open Library queries rate-limited client-side | Max search requests per session |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Book | A single publication record in the user's library, including physical books, ebooks, and audiobooks |
| Shelf | A named collection for organizing books. Three system shelves exist by default (Want to Read, Currently Reading, Finished). Users can create unlimited custom shelves. |
| Reading Session | One read-through of a book, tracking status transitions from want_to_read through reading to finished or DNF |
| DNF | "Did Not Finish" - a reading status indicating the user abandoned the book before completion |
| Half-Star Rating | A rating system allowing values from 0.5 to 5.0 in 0.5 increments (10 possible values) |
| FTS5 | SQLite Full-Text Search version 5, providing fast text search with Porter stemming and Unicode support |
| Open Library | An open-source project (openlibrary.org) with a free API providing book metadata for 40M+ records |
| OLID | Open Library Identifier - a unique ID for works, editions, and authors in the Open Library system |
| Timed Session | A stopwatch-measured reading period that records duration, pages read, and reading speed |
| Progress Update | A snapshot of the user's current position in a book, used to build reading velocity timelines |
| Mood Tag | A descriptive label from a curated vocabulary (mood, pace, or genre) attached to books for discovery |
| Content Warning | A user-added warning about potentially distressing content in a book, with severity level |
| Challenge | A structured reading goal with a specific target, time frame, and type (books, pages, minutes, or themed) |
| Badge | An achievement award earned for reaching reading milestones, computed from local data |
| Share Event | A record of a user action (rating, review, etc.) with a visibility level controlling who can see it |
| Book Club | A group reading coordination feature with shared book selection, progress tracking, and discussion |
| Series | A named sequence of books with defined reading order |
| Reader Document | An uploaded ePub or PDF file whose text content is stored in the database for in-app reading |
| Table Prefix | The `bk_` string prepended to all MyBooks table names in the shared MyLife SQLite database |
| Privacy-first | Design principle where all user data stays on-device by default, with cloud features being opt-in only |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (spec-mybooks agent) | Initial specification - 32 features, 28+ entities |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should book clubs support async reading schedules (e.g., "read chapters 1-5 by Friday")? | Club Detail milestone tracking | Pending | - |
| 2 | Should the recommendation engine also suggest books not in the user's library via Open Library? | BK-024 author affinity could fetch external books | Planned for author affinity; deferred for genre/similar | - |
| 3 | Should badges be syncable across devices if the user enables cloud features? | BK-026 currently local-only | Defer to Phase 4 cloud sync | - |
| 4 | Should the social feed support reactions (like, heart) on friend activity? | BK-025 currently displays activity only | Defer to post-MVP social iteration | - |
| 5 | Should StoryGraph import handle their "Read Dates" multi-date format for re-reads? | BK-016 date parsing | Pending investigation of StoryGraph CSV format evolution | - |
| 6 | What is the maximum library size we should test against for performance? | FTS5 and stats calculation performance | Recommend testing up to 10,000 books | - |
| 7 | Should content warnings be community-sourced in connected mode? | BK-020 currently user-only | Defer to post-MVP social features | - |
