# MyBooks — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyBooks** — Your reading list. Not Amazon's ad profile.

A private, local-first book tracking app for iOS, Android, Mac, and web. Library management, reading lists (TBR/reading/finished), private ratings and reviews, reading stats and goals, book search via Open Library API (no Amazon dependency), barcode scanning for quick adds, and year-in-review. No accounts, no social features by default, no telemetry. Your reading habits stay on your device.

### Core Differentiators

1. **Truly private** — All reading history stored locally in SQLite. No server, no sync, no analytics. Amazon cannot build an ad profile from your reading habits.
2. **One-time purchase** — $4.99 forever. No subscription fatigue. StoryGraph charges $49.99/yr, Bookly charges $19.99/6mo. Your book tracker shouldn't cost more than a paperback.
3. **Amazon-free book data** — Open Library API (Internet Archive) for book metadata and covers. 30M+ titles indexed. No Amazon product IDs, no affiliate links, no tracking pixels.
4. **Barcode scanning** — Point your camera at any book's ISBN barcode to instantly add it. No typing, no searching. Works offline after first metadata fetch.
5. **Source-available** — FSL license means you can audit every line of code. Trust, but verify.
6. **Native quality, cross-platform** — Expo + Next.js delivers native feel on every platform from a single TypeScript codebase.

---

## Problem Statement

Goodreads has 150 million users and hasn't meaningfully updated its UI since Amazon acquired it in 2013. Amazon mines every book you shelve, rate, and review to feed its advertising machine. Your reading history is cross-referenced with your purchase data, browsing history, and Alexa interactions to build an advertising profile. Goodreads' Review Partner program sells user reviews to third parties. Users have no ownership of their data under the Terms of Service.

The alternatives each have their own problems. StoryGraph is growing fast (4M users) but is subscription-based ($49.99/yr) and cloud-dependent. Hardcover is social-first, which means your reading habits are public by default. Bookly is a reading timer app that happens to track books, not a library manager. Apple's Books app only tracks purchases from Apple.

The market offers a false choice: either use a polished app that feeds your reading data to a corporation, or keep a spreadsheet. MyBooks eliminates this trade-off by delivering a beautiful, feature-rich book tracking experience where reading history physically cannot leave the device, powered by the Internet Archive's free Open Library API instead of Amazon's product database.

---

## Target User Persona

### Primary: "Privacy-Conscious Reader"
- **Age:** 25-40
- **Gender:** Skews female (60-75% of book tracking app users are women)
- **Reading pace:** 20-50 books per year
- **Behavior:** Maintains a TBR list, rates and reviews books for personal reference, sets annual reading goals
- **Pain point:** Uses Goodreads out of inertia but resents Amazon ownership. Wants to leave but hasn't found a compelling alternative.
- **Willingness to pay:** High — already pays for reading apps or services. Turned off by subscriptions for what feels like a utility.
- **Tech savvy:** Moderate — uses iPhone/Android daily, understands "local data" vs "cloud" at a high level
- **Trigger:** Read an article about Amazon data harvesting, or a friend switched to StoryGraph and mentioned it

### Secondary: "Avid Cataloger"
- **Age:** 20-35
- **Reading pace:** 50-100+ books per year (r/52book community)
- **Behavior:** Meticulously tracks start/finish dates, page counts, ratings, personal notes. Loves year-in-review stats.
- **Pain point:** Goodreads' half-star rating limitation (no 3.5 stars), slow UI, terrible search, Amazon-cluttered recommendations
- **Willingness to pay:** Moderate — wants a tool that respects the craft of tracking. $4.99 one-time is a no-brainer.

### Tertiary: "Bookstore Browser"
- **Age:** 25-50
- **Behavior:** Browses physical bookstores, takes photos of interesting covers, buys impulsively. Needs a way to capture "I want to read this" in the moment.
- **Pain point:** Goodreads' barcode scanner is slow and broken. Manually searching for books is friction that kills the habit.
- **Willingness to pay:** Moderate — values speed and convenience. Barcode scan is the killer feature.

---

## Competitive Landscape

| App | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|-----|-------|-----------|-------------|----------------|-------------|
| **Goodreads** (Amazon) | Free | 150M+ | ~$22-78M/yr (est.) | Amazon subsidiary. Reading data feeds ad profile. Review Partner program sells reviews to third parties. | UI frozen since 2013. Amazon data harvesting. Review bombing. No half-star ratings. Broken barcode scanner. Recommendations cluttered with Amazon products. |
| **StoryGraph** | Free / $49.99/yr | 4M+ | ~$5-10M ARR (est.) | Independent, privacy-friendlier than Goodreads. Cloud-stored user data. | Subscription fatigue ($49.99/yr for stats features). Cloud-dependent. Solo founder scaling risk. Import sometimes unreliable. |
| **Hardcover** | Free / Supporter tier | ~100K (est.) | <$500K (bootstrapped) | Independent, ad-free, small team. Per-book privacy controls. | Social-first design (public reading by default). Small team, slow feature velocity. Limited mobile app. |
| **Bookly** | Free / $19.99 per 6mo | ~500K (est.) | ~$2-5M ARR (est.) | Local-first, minimal data collection. | Reading timer focus, not library management. Limited book metadata. 10-book limit on free tier. No web version. |
| **Literal** | Free | ~200K (est.) | <$1M (startup) | Small startup, social platform. Cloud-stored. | Niche social reading platform. Small community. Uncertain business model sustainability. |
| **Apple Books** | Free (bundled) | N/A | $0 (bundled) | On-device + iCloud. Apple ecosystem only. | Only tracks Apple purchases. No physical book tracking. No TBR lists. No reading goals. No barcode scanning. |
| **Libby/OverDrive** | Free | 30M+ | N/A (library-funded) | Library system, relatively private. | Library borrowing only. Not a personal library tracker. No ratings/reviews. |
| **MyBooks** | **$4.99 one-time** | 0 (launch) | TBD | **Local-only, source-available, Amazon-free metadata** | New entrant, no brand recognition |

### Market Opportunity

The book reading apps market is valued at ~$5.2-5.5B (2024) and projected to reach $12.5-15B by 2033, growing at 10-12% CAGR. The "Goodreads alternative" search trend has grown consistently year-over-year since 2020. Entire Reddit threads, blog posts, and newsletters are dedicated to "leaving Goodreads." StoryGraph's growth from 0 to 4M users in ~4 years proves the demand is real.

The privacy angle is underserved. StoryGraph positions on "better recommendations." Hardcover positions on "better community." Nobody positions on "your reading data stays on your device." That's the gap.

**Key market signals:**
- 150M Goodreads users = massive addressable market of dissatisfied users
- 80% of book tracking users are women aged 18-44 — a demographic that indexes high on privacy awareness
- StoryGraph grew to 4M users with zero paid marketing — purely word of mouth from Goodreads dissatisfaction
- "The Case for Leaving Goodreads" articles appear regularly on major book blogs and independent bookstore websites
- Amazon's 2025 privacy policy changes (Iranian user account purges without warning) further eroded trust

---

## Key Features (MVP)

### Library Management
1. **Personal library** — Add books via search, barcode scan, or manual entry. Every book in your library shows cover, title, author, page count, ISBN, publisher, and publication year.
2. **Shelves** — Three default shelves: "Want to Read" (TBR), "Currently Reading", "Finished". Custom shelves for any purpose (e.g., "Lent to Sarah", "Favorites", "Book Club 2026").
3. **Book detail view** — Cover image, metadata, personal rating, review/notes, reading dates, shelf assignment, tags. Clean, book-cover-forward layout.
4. **Barcode scanner** — Camera-based ISBN barcode scanning. Point at any book, auto-detect ISBN, fetch metadata from Open Library. Works in bookstores, libraries, at home. Batch scanning mode for cataloging entire shelves.
5. **Manual entry** — For books not in Open Library's database. Title, author, page count, cover photo (camera or gallery).
6. **Import from Goodreads** — Parse Goodreads CSV export. Map shelves, ratings, dates, reviews. One-time import, no ongoing connection.
7. **Import from StoryGraph** — Parse StoryGraph export format similarly.

### Ratings & Reviews (Private)
8. **Half-star ratings** — 0.5 to 5.0 in half-star increments. The #1 Goodreads complaint finally addressed.
9. **Private reviews/notes** — Free-text notes per book. These never leave the device. Write honest reviews without social pressure.
10. **Tags** — Custom tags per book (e.g., "sci-fi", "beach read", "mind-blowing", "DNF"). Filter and browse by tag.

### Reading Stats & Goals
11. **Annual reading goal** — Set a target (e.g., "Read 30 books in 2026"). Progress bar on home screen. Adjustable mid-year.
12. **Reading stats dashboard** — Books read by month/year, pages read, average rating, genre distribution, author diversity, average book length.
13. **Year-in-review** — Beautiful, shareable summary card at year end: total books, top-rated, favorite genre, fastest read, longest book, reading streak, monthly breakdown. Exportable as image.
14. **Reading timeline** — Visual timeline showing when you started and finished each book. See overlapping reads and reading pace patterns.

### Book Search & Discovery
15. **Open Library search** — Search 30M+ titles by title, author, or ISBN. Results show cover, title, author, first publish year, edition count. Powered by Internet Archive's free API.
16. **Offline metadata cache** — Book metadata is cached locally after first fetch. Browse your library and search your shelves entirely offline.
17. **No recommendations algorithm** — Deliberately no "you might also like" engine. No behavioral tracking. Your library is curated by you, not an algorithm.

### Data Ownership
18. **Export to CSV/JSON** — Full library export in open formats. Move to any other app or build your own analysis.
19. **Export to Markdown** — Each book as a markdown file with all metadata and notes. Perfect for Obsidian integration.
20. **No account required** — Open the app and start adding books. No email, no sign-up, no verification.

---

## Technical Architecture

### Stack

- **Frontend (Mobile):** Expo (React Native) — iOS + Android from single codebase
- **Frontend (Web):** Next.js 15
- **Frontend (Desktop):** Next.js as desktop webapp (via system browser or Electron/Tauri later)
- **Database:** SQLite via `expo-sqlite` (mobile) / `better-sqlite3` (web/desktop)
- **Book Metadata:** Open Library API (Internet Archive) — free, no API key required
- **Barcode Scanning:** `expo-camera` + `expo-barcode-scanner` (mobile), `html5-qrcode` (web)
- **Image Caching:** Book covers cached locally in app storage
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Language:** TypeScript everywhere
- **License:** FSL-1.1-Apache-2.0

### Open Library API Integration

```
Base URL: https://openlibrary.org

Endpoints used:
  Search:    GET /search.json?q={query}&limit=20
  ISBN:      GET /isbn/{isbn}.json
  Works:     GET /works/{olid}.json
  Authors:   GET /authors/{olid}.json
  Covers:    GET https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg
             GET https://covers.openlibrary.org/b/olid/{olid}-L.jpg

Rate limits: ~100 requests/minute (polite use, no API key needed)
Cover sizes: S (small), M (medium), L (large)
```

**Why Open Library, not Amazon/Google:**
- Free with no API key, no authentication, no usage limits for reasonable use
- 30M+ titles with ISBNs, covers, authors, subjects, publishers
- Operated by Internet Archive — a non-profit with a mission to provide universal access to knowledge
- No tracking pixels, no affiliate links, no advertising IDs
- Open data — all metadata is public domain or CC0

### Monorepo Structure

```
MyBooks/
├── apps/
│   ├── mobile/                # Expo (React Native) — iOS + Android
│   │   ├── app/               # Expo Router file-based routing
│   │   │   ├── (tabs)/        # Tab navigator
│   │   │   │   ├── index.tsx          # Home / currently reading
│   │   │   │   ├── library.tsx        # Full library browser
│   │   │   │   ├── search.tsx         # Book search (Open Library)
│   │   │   │   ├── stats.tsx          # Reading stats & goals
│   │   │   │   └── settings.tsx       # Settings
│   │   │   ├── book/
│   │   │   │   ├── [id].tsx           # Book detail view
│   │   │   │   └── add.tsx            # Add book (search/scan/manual)
│   │   │   ├── scan.tsx               # Barcode scanner
│   │   │   ├── shelf/
│   │   │   │   └── [id].tsx           # Shelf view
│   │   │   └── _layout.tsx
│   │   ├── components/        # Mobile-specific components
│   │   │   ├── book/          # Book card, cover image, rating stars
│   │   │   ├── scanner/       # Camera barcode scanner UI
│   │   │   ├── shelves/       # Shelf grid, shelf picker
│   │   │   └── stats/         # Charts, goal progress, year-in-review
│   │   └── assets/
│   └── web/                   # Next.js 15 — Web + Desktop
│       ├── app/
│       │   ├── page.tsx               # Home / currently reading
│       │   ├── library/page.tsx       # Library browser
│       │   ├── search/page.tsx        # Book search
│       │   ├── book/[id]/page.tsx     # Book detail
│       │   ├── shelf/[id]/page.tsx    # Shelf view
│       │   ├── stats/page.tsx         # Stats dashboard
│       │   ├── year-review/page.tsx   # Year-in-review
│       │   └── settings/page.tsx      # Settings
│       ├── components/
│       └── public/
├── packages/
│   ├── shared/                # Types, utils, business logic
│   │   ├── src/
│   │   │   ├── types/         # Book, Shelf, ReadingSession, Review, Goal types
│   │   │   ├── db/            # SQLite schema, migrations, queries
│   │   │   ├── api/           # Open Library API client
│   │   │   ├── import/        # Goodreads/StoryGraph CSV parser
│   │   │   ├── export/        # CSV/JSON/Markdown export logic
│   │   │   ├── search/        # FTS5 query builder for local search
│   │   │   ├── stats/         # Reading stats computation, goal tracking
│   │   │   └── year-review/   # Year-in-review data aggregation
│   │   └── package.json
│   └── ui/                    # Shared component library
│       ├── src/
│       │   ├── book/          # BookCard, BookCover, BookGrid, BookList
│       │   ├── rating/        # StarRating (half-star support), RatingDistribution
│       │   ├── shelves/       # ShelfPicker, ShelfGrid, ShelfBadge
│       │   ├── stats/         # ReadingGoalRing, MonthlyChart, YearHeatmap
│       │   ├── search/        # SearchBar, SearchResults, ISBNInput
│       │   └── theme/         # Design tokens, dark/literary themes
│       └── package.json
├── turbo.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── CLAUDE.md
├── README.md
└── timeline.md
```

### Data Model (SQLite Schema)

```sql
-- Books (core entity — one row per unique book in user's library)
CREATE TABLE books (
    id TEXT PRIMARY KEY,                           -- UUID v4
    title TEXT NOT NULL,
    subtitle TEXT,
    authors TEXT NOT NULL,                          -- JSON array: ["Author Name", ...]
    isbn_10 TEXT,
    isbn_13 TEXT,
    open_library_id TEXT,                           -- Open Library work ID (e.g., "OL45804W")
    open_library_edition_id TEXT,                   -- Open Library edition ID (e.g., "OL7353617M")
    cover_url TEXT,                                 -- Open Library cover URL
    cover_cached_path TEXT,                         -- Local cached cover file path
    publisher TEXT,
    publish_year INTEGER,
    page_count INTEGER,
    subjects TEXT,                                  -- JSON array: ["Fiction", "Science Fiction", ...]
    description TEXT,                               -- Book description/synopsis
    language TEXT DEFAULT 'en',
    format TEXT DEFAULT 'physical'                  -- 'physical', 'ebook', 'audiobook'
        CHECK (format IN ('physical', 'ebook', 'audiobook')),
    added_source TEXT DEFAULT 'manual'              -- 'search', 'scan', 'manual', 'import_goodreads', 'import_storygraph'
        CHECK (added_source IN ('search', 'scan', 'manual', 'import_goodreads', 'import_storygraph')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX books_isbn13_idx ON books(isbn_13);
CREATE INDEX books_isbn10_idx ON books(isbn_10);
CREATE INDEX books_ol_id_idx ON books(open_library_id);
CREATE INDEX books_title_idx ON books(title COLLATE NOCASE);

-- Full-text search for local book library
CREATE VIRTUAL TABLE books_fts USING fts5(
    title,
    subtitle,
    authors,
    subjects,
    content='books',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- FTS sync triggers
CREATE TRIGGER books_fts_ai AFTER INSERT ON books BEGIN
    INSERT INTO books_fts(rowid, title, subtitle, authors, subjects)
    VALUES (new.rowid, new.title, new.subtitle, new.authors, new.subjects);
END;

CREATE TRIGGER books_fts_ad AFTER DELETE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, subtitle, authors, subjects)
    VALUES ('delete', old.rowid, old.title, old.subtitle, old.authors, old.subjects);
END;

CREATE TRIGGER books_fts_au AFTER UPDATE ON books BEGIN
    INSERT INTO books_fts(books_fts, rowid, title, subtitle, authors, subjects)
    VALUES ('delete', old.rowid, old.title, old.subtitle, old.authors, old.subjects);
    INSERT INTO books_fts(rowid, title, subtitle, authors, subjects)
    VALUES (new.rowid, new.title, new.subtitle, new.authors, new.subjects);
END;

-- Shelves (user-defined organizational containers)
CREATE TABLE shelves (
    id TEXT PRIMARY KEY,                           -- UUID v4
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,                      -- URL-friendly name
    icon TEXT,                                      -- Emoji or icon identifier
    color TEXT,                                     -- Hex color for shelf badge
    is_system INTEGER NOT NULL DEFAULT 0,           -- Boolean: built-in shelves (TBR, Reading, Finished)
    sort_order INTEGER NOT NULL DEFAULT 0,
    book_count INTEGER NOT NULL DEFAULT 0,          -- Denormalized count for performance
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed system shelves
INSERT INTO shelves (id, name, slug, icon, is_system, sort_order)
VALUES
    ('shelf-tbr', 'Want to Read', 'want-to-read', '📚', 1, 0),
    ('shelf-reading', 'Currently Reading', 'currently-reading', '📖', 1, 1),
    ('shelf-finished', 'Finished', 'finished', '✅', 1, 2);

-- Many-to-many: books <-> shelves
CREATE TABLE book_shelves (
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    shelf_id TEXT NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (book_id, shelf_id)
);

CREATE INDEX book_shelves_shelf_idx ON book_shelves(shelf_id);

-- Reading sessions (tracks when user starts/finishes a book)
CREATE TABLE reading_sessions (
    id TEXT PRIMARY KEY,                           -- UUID v4
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    started_at TEXT,                                -- ISO datetime when user started reading
    finished_at TEXT,                               -- ISO datetime when user finished
    current_page INTEGER DEFAULT 0,                -- Current page progress
    status TEXT NOT NULL DEFAULT 'want_to_read'    -- 'want_to_read', 'reading', 'finished', 'dnf'
        CHECK (status IN ('want_to_read', 'reading', 'finished', 'dnf')),
    dnf_reason TEXT,                               -- Optional reason for Did Not Finish
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX sessions_book_idx ON reading_sessions(book_id);
CREATE INDEX sessions_status_idx ON reading_sessions(status);
CREATE INDEX sessions_finished_idx ON reading_sessions(finished_at);
CREATE INDEX sessions_started_idx ON reading_sessions(started_at);

-- Reviews (private, per reading session)
CREATE TABLE reviews (
    id TEXT PRIMARY KEY,                           -- UUID v4
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES reading_sessions(id) ON DELETE SET NULL,
    rating REAL CHECK (rating >= 0.5 AND rating <= 5.0),  -- 0.5 to 5.0 in 0.5 steps
    review_text TEXT,                              -- Free-text review/notes
    favorite_quote TEXT,                           -- Optional favorite quote from the book
    is_favorite INTEGER NOT NULL DEFAULT 0,        -- Boolean: mark as all-time favorite
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX reviews_book_idx ON reviews(book_id);
CREATE INDEX reviews_rating_idx ON reviews(rating);
CREATE INDEX reviews_favorite_idx ON reviews(is_favorite) WHERE is_favorite = 1;

-- Tags (user-defined labels for books)
CREATE TABLE tags (
    id TEXT PRIMARY KEY,                           -- UUID v4
    name TEXT NOT NULL UNIQUE,
    color TEXT,                                     -- Hex color for tag pill
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX tags_name_idx ON tags(name);
CREATE INDEX tags_usage_idx ON tags(usage_count DESC);

-- Many-to-many: books <-> tags
CREATE TABLE book_tags (
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, tag_id)
);

CREATE INDEX book_tags_tag_idx ON book_tags(tag_id);

-- Reading goals (annual or custom period)
CREATE TABLE reading_goals (
    id TEXT PRIMARY KEY,                           -- UUID v4
    year INTEGER NOT NULL,                         -- e.g., 2026
    target_books INTEGER NOT NULL,                 -- Number of books to read
    target_pages INTEGER,                          -- Optional: page target
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX goals_year_idx ON reading_goals(year);

-- Open Library metadata cache (avoid re-fetching)
CREATE TABLE ol_cache (
    isbn TEXT PRIMARY KEY,                         -- ISBN-13 or ISBN-10
    response_json TEXT NOT NULL,                    -- Full API response
    cover_downloaded INTEGER NOT NULL DEFAULT 0,    -- Boolean: cover image cached locally
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Goodreads/StoryGraph import log
CREATE TABLE import_log (
    id TEXT PRIMARY KEY,                           -- UUID v4
    source TEXT NOT NULL,                           -- 'goodreads', 'storygraph'
    filename TEXT NOT NULL,
    books_imported INTEGER NOT NULL DEFAULT 0,
    books_skipped INTEGER NOT NULL DEFAULT 0,
    errors TEXT,                                    -- JSON array of error messages
    imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings (key-value store)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Schema version tracking
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Goodreads CSV Import Mapping

```
Goodreads CSV Column          → MyBooks Field
─────────────────────────────────────────────────
Book Id                       → (ignored — Goodreads internal ID)
Title                         → books.title
Author                        → books.authors (JSON array)
Author l-f                    → (ignored — use Author)
Additional Authors            → books.authors (appended to array)
ISBN                          → books.isbn_10 (stripped of ="")
ISBN13                        → books.isbn_13 (stripped of ="")
My Rating                     → reviews.rating (multiply by 1.0)
Average Rating                → (ignored)
Publisher                     → books.publisher
Binding                       → books.format mapping (Hardcover/Paperback→physical, Kindle→ebook)
Number of Pages               → books.page_count
Year Published                → books.publish_year
Original Publication Year     → (preferred over Year Published if present)
Date Read                     → reading_sessions.finished_at
Date Added                    → books.created_at
Bookshelves                   → book_shelves mapping:
                                 "to-read" → shelf-tbr
                                 "currently-reading" → shelf-reading
                                 "read" → shelf-finished
                                 Custom shelves → create new shelf
Bookshelves with positions    → (ignored — use Bookshelves)
Exclusive Shelf               → reading_sessions.status mapping
My Review                     → reviews.review_text
Spoiler                       → (ignored)
Private Notes                 → reviews.review_text (appended with divider)
Read Count                    → (create N reading_sessions if > 1)
Owned Copies                  → (ignored)
```

---

## Privacy Architecture

```
┌─────────────────────────────────────────────────────┐
│                    MyBooks App                       │
│                                                      │
│  ┌────────────────┐  ┌───────────────────────────┐  │
│  │   UI Layer      │  │  Barcode Scanner Engine    │  │
│  │  (React Native  │  │  (on-device camera,        │  │
│  │   / Next.js)    │  │   local ISBN decoding)     │  │
│  └───────┬─────────┘  └───────────┬───────────────┘  │
│          │                        │                  │
│  ┌───────▼────────────────────────▼───────────────┐  │
│  │             Business Logic Layer                │  │
│  │  (packages/shared)                              │  │
│  │  - Book CRUD                                    │  │
│  │  - Shelf management                             │  │
│  │  - FTS5 local search                            │  │
│  │  - Stats computation                            │  │
│  │  - CSV import/export                            │  │
│  │  - Year-in-review aggregation                   │  │
│  └───────────────────┬────────────────────────────┘  │
│                      │                               │
│  ┌───────────────────▼────────────────────────────┐  │
│  │              SQLite (Local Only)                │  │
│  │  Books, shelves, sessions, reviews, goals       │  │
│  │  FTS5 index for library search                  │  │
│  │  Open Library response cache                    │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │         Local File Storage                      │  │
│  │  - Cached book cover images (JPEG)              │  │
│  │  - Export files (CSV, JSON, Markdown)            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Network: Open Library API ONLY                 │  │
│  │  - Book search by title/author/ISBN             │  │
│  │  - Cover image downloads                        │  │
│  │  - No authentication, no tracking, no cookies   │  │
│  │  - Operated by Internet Archive (non-profit)    │  │
│  │  - All requests cacheable; works offline after   │  │
│  │    initial fetch                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ❌ No user accounts                                │
│  ❌ No analytics SDK                                │
│  ❌ No crash reporting SDK                          │
│  ❌ No ad SDK                                       │
│  ❌ No Amazon API calls                             │
│  ❌ No social features or public profiles            │
│  ❌ No recommendation algorithm                     │
│  ❌ No telemetry of any kind                        │
└─────────────────────────────────────────────────────┘
```

**Backup exclusion:**
- iOS: Set `NSURLIsExcludedFromBackupKey` on app data directory — prevents iCloud backup of user data
- Android: Set `android:allowBackup="false"` in AndroidManifest.xml — prevents Google Drive backup of user data
- All platforms: User data never leaves the device, even through system backups

**Key privacy decisions:**
- The ONLY network traffic is to `openlibrary.org` and `covers.openlibrary.org` — both operated by Internet Archive, a non-profit. No Amazon domains, no Google Analytics, no Facebook SDK.
- Open Library API requires no authentication, sets no tracking cookies, and returns no advertising identifiers. The API is public infrastructure.
- All book metadata is cached locally after first fetch. The app works fully offline for browsing your library, writing reviews, and viewing stats.
- Reading sessions (what you read, when you started, when you finished) are stored exclusively in local SQLite. This data NEVER touches a network.
- Ratings and reviews are private by default with no mechanism to publish them. There is no social layer.
- CSV/JSON export puts data in open formats. No proprietary lock-in. You own your reading history.
- The app does not fingerprint the device, generate advertising IDs, or participate in Apple's ATT framework (because there's nothing to track).

**Data flow comparison:**

```
Goodreads: You rate a book → Amazon ad profile updated →
           personalized ads on Amazon, Kindle, Alexa,
           Fire TV, Ring, Twitch, Whole Foods app

MyBooks:   You rate a book → written to local SQLite →
           visible to you and nobody else. Ever.
```

---

## UI/UX Direction

### Design Philosophy
- **Literary warmth** — The app should feel like a well-curated personal bookshelf, not a sterile database. Warm cream and amber tones evoke aged paper and leather bindings.
- **Cover-forward** — Book covers are the primary visual element. Large, high-quality cover images everywhere. The library should look like a bookshelf, not a spreadsheet.
- **Calm utility** — No push notifications, no streaks, no gamification. A tool for readers, not a dopamine machine.
- **Dark by default** — Deep charcoal backgrounds with warm cream text. Comfortable for bedtime reading list browsing.

### Design Tokens (Dark Theme — Literary)

```typescript
const theme = {
  colors: {
    background: '#0E0C09',          // Warm near-black (aged leather)
    surface: '#1A1610',             // Warm dark surface (dark walnut)
    surfaceElevated: '#23201A',     // Elevated card (mahogany)
    text: '#F4EDE2',               // Warm cream (aged paper)
    textSecondary: '#A99E8E',      // Warm grey (pencil mark)
    textTertiary: '#6B6155',       // Dim warm grey
    accent: '#C9894D',             // Warm amber-gold (gilded pages)
    accentLight: '#E0B07A',        // Light gold for highlights
    accentDim: '#7A5530',          // Dimmed gold for subtle accents
    star: '#E8B84B',               // Rating star gold
    starEmpty: '#3A352D',          // Empty star outline
    shelf: '#2C6B50',              // Shelf green (library shelf)
    shelfLight: '#3D8A68',         // Light shelf green
    reading: '#4A90D9',            // Currently reading blue
    finished: '#5BA55B',           // Finished green
    tbr: '#C9894D',               // TBR amber (matches accent)
    dnf: '#9E6060',               // DNF muted red
    tagDefault: '#6B8DA6',         // Default tag blue-grey
    coverShadow: 'rgba(0,0,0,0.4)',// Book cover shadow
    border: '#2A2520',             // Subtle warm border
    danger: '#CC5555',             // Delete actions
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, cover: 3 },
  typography: {
    heading: { fontFamily: 'Inter', fontSize: 24, fontWeight: '700' },
    subheading: { fontFamily: 'Inter', fontSize: 18, fontWeight: '600' },
    body: { fontFamily: 'Inter', fontSize: 16, fontWeight: '400', lineHeight: 26 },
    bookTitle: { fontFamily: 'Literata', fontSize: 20, fontWeight: '600', lineHeight: 26 },
    bookAuthor: { fontFamily: 'Inter', fontSize: 14, fontWeight: '400', color: '#A99E8E' },
    review: { fontFamily: 'Literata', fontSize: 16, fontWeight: '400', lineHeight: 28 },
    stat: { fontFamily: 'Inter', fontSize: 36, fontWeight: '700' },
    caption: { fontFamily: 'Inter', fontSize: 13, fontWeight: '500' },
    label: { fontFamily: 'Inter', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  },
  coverAspectRatio: 2 / 3,          // Standard book cover ratio
  coverSizes: {
    small: { width: 60, height: 90 },
    medium: { width: 100, height: 150 },
    large: { width: 160, height: 240 },
    detail: { width: 200, height: 300 },
  },
};
```

### Navigation (Bottom Tabs)

| Tab | Icon | Screen |
|-----|------|--------|
| Home | Open book | Currently reading + recent activity |
| Library | Grid of books | Full library browser with shelf filters |
| Search | Magnifying glass | Open Library search + barcode scan button |
| Stats | Bar chart | Reading stats, goals, year-in-review |
| Settings | Gear | Preferences, import/export, about |

### Screen Flows

#### 1. First Launch / Onboarding
1. Welcome screen: "Your reading list. Not Amazon's ad profile." App name, warm book illustration.
2. Import prompt: "Already tracking books? Import from Goodreads or StoryGraph." CSV file picker. "Skip — I'll start fresh."
3. Reading goal: "How many books do you want to read in 2026?" Number picker with slider (default 24). "Skip — I'll set this later."
4. Done: "Start building your library." Arrow to home screen.

#### 2. Home Screen
- **Top section:** Reading goal progress ring (e.g., "8 of 30 books"). Tap to adjust goal.
- **Currently reading:** Horizontal scroll of book covers with progress bars (current page / total pages). Tap to open book detail. "Update progress" quick action.
- **Recently finished:** Last 3-5 finished books in a row. "You finished 'Project Hail Mary' 2 days ago."
- **Quick add:** Floating action button. Tap → choose: Search, Scan Barcode, Manual Entry.

#### 3. Library Screen
- **Shelf tabs:** Horizontal scroll of shelf names: All | Want to Read | Currently Reading | Finished | [Custom shelves...]
- **Sort controls:** Sort by: Date Added, Title, Author, Rating, Date Read. Toggle ascending/descending.
- **View toggle:** Grid (covers only, 3 columns) / List (cover + title + author + rating)
- **Filter chips:** Filter by tag, by rating, by year read, by format (physical/ebook/audiobook)
- **Book count:** "247 books" at top

#### 4. Book Detail Screen
- **Cover hero:** Large cover image with shadow, centered
- **Metadata:** Title, author(s), publisher, year, page count, ISBN, format
- **Shelf badge:** Current shelf (Want to Read / Currently Reading / Finished / DNF)
- **Rating:** Half-star picker (5 stars, tap for 0.5 precision)
- **Reading progress:** If currently reading: page slider or number input. "Page 142 of 384 — 37%"
- **Dates:** Started reading: [date picker]. Finished reading: [date picker].
- **Review/Notes:** Free-text editor. "Write your thoughts..."
- **Favorite quote:** Dedicated quote field with quotation marks styling
- **Tags:** Tag pills + "add tag" button with autocomplete
- **Actions:** Move to shelf, share book info (title + author text only — no reading data), delete from library
- **Open Library link:** "View on Open Library" link for additional metadata/editions

#### 5. Search & Add Screen
- **Search bar:** "Search by title, author, or ISBN"
- **Scan button:** Camera icon next to search bar. Opens barcode scanner.
- **Results grid:** Book covers from Open Library search. Each shows title, author, cover. "Add to library" button on each.
- **Barcode scanner overlay:** Camera viewfinder with ISBN barcode guide. Auto-detect and fetch. "Book found: {title} by {author}" confirmation sheet with "Add to Want to Read" and shelf picker.
- **Manual add:** Link at bottom: "Can't find your book? Add it manually."

#### 6. Stats Screen
- **Year at a glance:** "2026: 8 books read" with goal ring
- **Monthly chart:** Bar chart showing books finished per month
- **Rating distribution:** Histogram of your ratings (how many 5-stars, 4.5-stars, etc.)
- **Pages read:** Total pages this year, average pages per book
- **Author stats:** "Most-read author: Brandon Sanderson (4 books)"
- **Genre/tag breakdown:** Pie chart of books by tag
- **Reading pace:** Average days per book, fastest/slowest reads
- **Year-in-review button:** Tap to generate a beautiful summary card

#### 7. Year-in-Review
- **Full-screen card sequence** (swipeable, like Spotify Wrapped):
  1. "Your Year in Books — 2026" with total count
  2. "Top Rated" — your 5-star books with covers
  3. "The Numbers" — books, pages, authors, genres
  4. "Month by Month" — bar chart of reading pace
  5. "Your Favorites" — books marked as favorites
  6. "Reading Streak" — longest consecutive reading streak
  7. "Export" — save as image, export full data as CSV
- **Shareable image:** Generates a single card with key stats (no book-level data — just aggregate numbers). Users choose what to share.

#### 8. Settings Screen
- **Library:** Default shelf for new books, cover image quality (S/M/L), sort preferences
- **Goals:** Annual reading goal, page goal
- **Import:** Import from Goodreads (CSV), Import from StoryGraph (CSV)
- **Export:** Export library (CSV / JSON / Markdown), export year-in-review image
- **Appearance:** Theme (Dark Literary / Dark / Light), font size, cover grid size
- **Data:** Database size, cached covers size, total books, "Erase all data" (danger zone)
- **About:** Version, license (FSL), source code link, privacy statement, "Powered by Open Library"

---

## Monetization

### Pricing Model
- **$4.99 one-time purchase** — Full app, all features, forever
- **7-day free trial** with full functionality. After trial, read-only mode (can view library and stats but cannot add new books, log reading, or create reviews). This preserves user data and creates natural conversion when the reader wants to add their next book.
- No subscriptions, no ads, no IAP upsells
- The App Store listing price IS the price

### Why $4.99
- **Below psychological barrier:** $4.99 feels like "the price of a latte" — an easy impulse buy. Under $5 removes the need to deliberate.
- **Undercuts all competitors:** StoryGraph Plus is $49.99/yr (10x the lifetime cost of MyBooks in year one alone). Bookly Pro is $39.98/yr. Even Goodreads is "free" but you pay with your data — and privacy has a cost.
- **Consistent suite pricing:** All MyApps share the same $4.99 price point, building brand recognition and trust.
- **Sustainable at scale:** With zero server costs and zero marginal cost per user, even modest adoption generates meaningful revenue.

### Revenue Projections (Conservative)

Based on 7-day free trial model with conversion after trial expiry.

| Metric | Month 1 | Month 6 | Year 1 | Year 2 |
|--------|---------|---------|--------|--------|
| Downloads | 3,000 | 6,000/mo | 50,000 | 130,000 |
| Revenue (gross) | $21,000 | $42,000/mo | $350,000 | $910,000 |
| Apple/Google cut (30%→15%) | $6,300 | $12,600/mo | $87,500 | $136,500 |
| Net revenue | $14,700 | $29,400/mo | $262,500 | $773,500 |

### Why One-Time Works
- Zero server costs — no cloud, no sync, no API quota fees (Open Library is free)
- Zero ongoing data costs — book metadata cached locally, no recurring API charges
- Marginal cost per user is effectively $0
- One-time pricing is word-of-mouth fuel: "$7 and I own it forever" vs "$50/yr for StoryGraph"
- Every StoryGraph/Bookly renewal date is a decision point where subscribers discover MyBooks

### Mac App Store + Direct Sales
- Mac version sold separately at $4.99 (Mac App Store) or $4.99 (Lemon Squeezy direct)
- Lemon Squeezy avoids Apple's 30% cut for direct web sales
- RevenueCat handles IAP receipt validation on iOS/Android

---

## Marketing Angle

### Tagline
**"Your reading list. Not Amazon's ad profile."**

### Alternative Taglines
- "Goodreads without the Amazon."
- "Track your books. Keep your privacy."
- "What you read is nobody's business."

### Positioning Statement
MyBooks is for readers who want a beautiful book tracking app without feeding Amazon's advertising machine. One-time purchase. No accounts. No cloud. No recommendations algorithm. Your reading history lives on your device and nowhere else. Powered by Open Library, not Amazon.

### Launch Channels

| Channel | Approach | Expected Impact |
|---------|----------|----------------|
| **r/books** (25M+) | "I left Goodreads and built my own book tracker" — founder story with privacy focus | Very High — largest book community on the internet |
| **r/52book** (300K+) | "A book tracker designed for people who read 50+ books a year" — stats and goal features showcase | High — avid readers who care about tracking |
| **r/suggestmeabook** (4M+) | Organic mentions in "what app do you use to track books" threads | Medium — ongoing discovery |
| **r/privacy** (1.8M) | Technical deep-dive: "How MyBooks tracks books without tracking you" | High — privacy advocates with purchasing power |
| **r/degoogle** (300K+) | "Book tracking without Amazon: powered by Open Library" | Medium — anti-Big Tech sentiment |
| **BookTok / Bookstagram** | Short-form video: satisfying barcode scan → instant add animation. "My anti-Goodreads setup" aesthetic | Very High — massive book community with sharing culture |
| **Product Hunt** | "$4.99 once, not $50/year. No Amazon. No accounts." | High — one-time pricing is PH catnip |
| **Hacker News** | "Show HN: Local-first book tracker powered by Open Library API" | High — technical privacy audience |
| **Independent bookstore partnerships** | QR code cards at checkout: "Track your purchase in MyBooks" | Medium — bookstore browsers are the ideal customer |
| **Book club newsletters** | Guest posts in BookRiot, LitHub, Electric Lit about privacy and reading | Medium — trusted book community voices |

### Content Marketing
- Blog post: "What Amazon knows about your reading habits (and why it matters)"
- Blog post: "Why Open Library is the ethical alternative to Amazon's book database"
- Blog post: "Goodreads vs StoryGraph vs MyBooks: a privacy comparison"
- Blog post: "How to export your Goodreads library (before Amazon makes it harder)"
- Video: 30-second barcode scanning demo at a bookstore
- Video: Year-in-review feature showcase

### PR Angle
- "In a world of subscription apps, MyBooks charges once and never again"
- "The book tracker that refuses to connect to Amazon"
- Pitch to The Verge, Ars Technica, Wirecutter, and literary publications (LitHub, The Millions)
- Position against the "Goodreads was the future of book reviews. Then Amazon bought it" narrative

---

## MVP Timeline (Week-by-Week)

### Week 1: Foundation
- [ ] Initialize Turborepo monorepo with pnpm
- [ ] Set up Expo app with file-based routing (Expo Router)
- [ ] Set up Next.js 15 web app with App Router
- [ ] Configure shared TypeScript config, ESLint, Prettier
- [ ] Implement SQLite schema with all tables, indexes, and FTS5
- [ ] Write migration system (versioned schema changes)
- [ ] Build Open Library API client (search, ISBN lookup, cover URLs)
- [ ] Implement response caching layer (ol_cache table)

### Week 2: Core Library
- [ ] Build Book model with CRUD operations in shared package
- [ ] Build Shelf model with system shelves and custom shelf support
- [ ] Implement book search via Open Library API
- [ ] Build BookCard component (cover + title + author + rating)
- [ ] Build Library screen with shelf tabs and sort/filter controls
- [ ] Build Book Detail screen with metadata display
- [ ] Implement half-star rating picker component
- [ ] Build review/notes editor per book

### Week 3: Adding Books
- [ ] Integrate expo-barcode-scanner for ISBN scanning
- [ ] Build barcode scanner UI with viewfinder overlay
- [ ] Implement ISBN → Open Library lookup → add to library flow
- [ ] Build search screen with Open Library results grid
- [ ] Build manual entry form (title, author, pages, cover photo)
- [ ] Implement cover image caching (download and store locally)
- [ ] Build "Add to shelf" picker sheet

### Week 4: Reading Sessions & Progress
- [ ] Build reading session tracking (start, update progress, finish, DNF)
- [ ] Build page progress slider/input on book detail
- [ ] Build "Currently Reading" section on home screen
- [ ] Build home screen with reading goal progress ring
- [ ] Implement reading goal model (annual target, progress calculation)
- [ ] Build tag system (create, assign to books, filter by tag)
- [ ] Build FTS5 local library search

### Week 5: Stats & Import/Export
- [ ] Build stats dashboard (books/month chart, rating histogram, pages, pace)
- [ ] Build year-in-review card sequence
- [ ] Build year-in-review image export
- [ ] Implement Goodreads CSV import parser with field mapping
- [ ] Implement StoryGraph CSV import parser
- [ ] Build export to CSV, JSON, and Markdown
- [ ] Build import flow UI (file picker, progress, result summary)

### Week 6: Polish & Launch
- [ ] Dark literary theme refinement (warm cream/amber/gold)
- [ ] Onboarding flow (welcome, import, goal setting)
- [ ] App icon design (book + privacy shield concept)
- [ ] App Store screenshots and description
- [ ] Privacy policy page ("We don't collect data. At all.")
- [ ] Light theme variant
- [ ] Beta testing (TestFlight + internal)
- [ ] Submit to App Store and Google Play
- [ ] Prepare Product Hunt, Reddit, and Hacker News launch posts
- [ ] Reach out to BookTok creators for launch day coverage

---

## Acceptance Criteria

### Must pass before launch:
1. **Privacy verification:** Only network traffic is to `openlibrary.org` and `covers.openlibrary.org`. Verified via iOS privacy report and network proxy. No other domains contacted.
2. **Library CRUD:** Create, read, update, delete books. All operations persist across app restart. Library with 500+ books scrolls smoothly.
3. **Shelf management:** Three system shelves work correctly. Custom shelves can be created, renamed, deleted. Books can be moved between shelves.
4. **Barcode scanning:** ISBN barcodes on physical books are detected within 2 seconds. Correct book metadata is fetched from Open Library.
5. **Search accuracy:** Open Library search returns relevant results for title, author, and ISBN queries. Local FTS5 search finds books by title, author, and subject keywords.
6. **Half-star ratings:** Rating picker allows 0.5 through 5.0 in 0.5 increments. Ratings persist correctly.
7. **Reading progress:** Page progress updates correctly. "Currently Reading" section shows progress bars. Finishing a book moves it to Finished shelf.
8. **Goodreads import:** Successfully imports a Goodreads CSV export with 100+ books. Shelves, ratings, dates, and reviews are mapped correctly.
9. **Export fidelity:** CSV export opens correctly in Excel/Numbers/Google Sheets. JSON export is valid JSON. Markdown export produces valid .md files.
10. **Stats accuracy:** Reading stats match manual count of finished books. Year-in-review numbers are correct.
11. **Offline resilience:** After initial metadata fetch, the entire library is browsable offline. Search, stats, and reading progress work without network.
12. **Performance:** App launches in <1 second. Library grid with 500+ books scrolls at 60fps. Barcode scanner opens in <500ms.
13. **Cross-platform parity:** Core features (library, search, stats, import/export) work identically on iOS, Android, and web. Barcode scanning is mobile-only.

### Quality gates:
- Zero crashes in 24-hour soak test with 500+ books in library
- Accessibility: VoiceOver/TalkBack can navigate all screens
- Dark mode: no white flashes on any screen transition
- Cover images load with graceful placeholders (no broken image icons)
- Supports iOS 16+, Android 10+, Chrome/Safari/Firefox (latest 2 versions)

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Goodreads CSV format changes break import | Medium | High | Pin import parser to versioned column list; add format auto-detection with clear error messaging when unrecognized columns appear; maintain test fixtures from real Goodreads exports |
| Open Library API goes down or rate-limits aggressively | Low | High | All metadata is cached locally after first fetch; app works fully offline for existing library; add exponential back-off and queue for API requests; display cached covers even when API is unreachable |
| Open Library cover image quality is inconsistent | High | Medium | Fall back to placeholder cover with title/author text overlay; allow users to set a custom cover photo from camera or gallery; pre-fetch Large size covers and cache locally |
| StoryGraph export format is undocumented and changes without notice | Medium | Medium | Treat StoryGraph import as best-effort; ship with format auto-detection; surface clear warnings on parse failures with row-level skip-and-continue behavior |
| App Store rejection for lacking "unique functionality" vs built-in Books app | Low | High | Emphasize barcode scanning, Goodreads import, half-star ratings, year-in-review, and cross-platform support in review notes; these are clear differentiators from Apple's built-in app |
