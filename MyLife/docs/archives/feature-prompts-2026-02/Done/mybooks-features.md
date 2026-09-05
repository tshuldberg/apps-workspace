# MyBooks Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. Each module implements a `ModuleDefinition` contract from `@mylife/module-registry` and stores data in a shared SQLite database using table-name prefixes (`bk_` for books).

**MyBooks** is a privacy-first book tracking app for iOS, Android, and web. The standalone source of truth lives at `/Users/trey/Desktop/Apps/MyLife/MyBooks/`, a Turborepo monorepo with `packages/shared/src/` containing: db schema, models, API client (Open Library), import/export engines, stats engine, year-in-review aggregation, reader with notes/highlights, and FTS5 search. The hub module lives at `modules/books/` with passthrough web routes in `apps/web/app/books/`.

**What already exists:** Library management with shelves (3 system + custom), reading sessions with status tracking (want-to-read/reading/finished), half-star ratings and reviews, tags, reading goals (books/year), stats engine, year-in-review, built-in reader with notes and highlights, FTS5 full-text search, Goodreads and StoryGraph CSV import, CSV/JSON/Markdown export, Open Library API metadata, barcode scanning. The standalone has 11 SQLite tables and the shared package at `MyBooks/packages/shared/src/` contains: `db/`, `models/`, `api/`, `import/`, `export/`, `stats/`, `reader/`, `search/`, `year-review/`.

**Consolidation context:** MyBooks absorbs **MyJournal** (a planned journaling app that does not yet have runtime code). MyBooks becomes the single destination for reading and personal journaling. Book-linked journal entries connect the two experiences: a user reads a book and writes reflections tied to that specific title.

**What needs to be built (3 feature sets):**

### Feature Set 1: Reading Progress and Session Tracking

Reading progress is the most requested feature in competing apps (Goodreads, StoryGraph, Bookly). Users currently mark books as "reading" but cannot track where they are in the book or how long reading sessions last.

**Features:**
- Page number / percentage progress tracking with a visual progress bar on the book detail screen
- Start/stop reading timer that logs session duration, pages read, and pages-per-hour
- Re-reads and multiple reading instances (finish a book, start it again, track separately)
- Series tracking with a series table, reading order, and "next up" indicator

### Feature Set 2: Discovery, Social, and Challenges

StoryGraph differentiates with mood-based discovery and rich challenge systems. MyBooks needs comparable depth without sacrificing privacy.

**Features:**
- Mood, pace, and genre tags for discovery filtering (e.g., "dark, fast-paced, literary fiction")
- Content warnings per book (user-contributed, stored locally)
- Reading challenge variety beyond "books per year" (pages-per-month, minutes-per-week, themed prompts like "read a debut novel")
- Monthly and annual shareable wrap-up graphics (rendered locally, exported as PNG)
- Owned-books tracking (distinguish owned vs. borrowed vs. library vs. wishlist)
- Home screen widgets (iOS/Android) showing current read, progress, streak

### Feature Set 3: Journaling Integration (MyJournal Consolidation)

MyJournal features integrate directly into MyBooks as a "Journal" tab. Journal entries can exist standalone or linked to a specific book for reading reflections.

**Features:**
- Rich Markdown journal entries with date-based navigation (calendar picker, timeline view)
- Photo attachments stored locally (on-device, no cloud)
- Encrypted local storage for journal content (AES-256 with user-set passphrase)
- Full-text search across journal entries (extend existing FTS5)
- Tags for journal entries (reuse existing tag system)
- Voice-to-journal via on-device Whisper transcription
- Export journal entries to Markdown or PDF
- Book-linked journal entries: when writing a reflection, optionally link to a book from the library

---

## Acceptance Criteria

### Feature Set 1: Reading Progress and Session Tracking

1. User opens a book marked "reading" and taps "Update Progress" -> sees a number input for page/percentage, a progress bar updates immediately on the book detail and library list views
2. User taps "Start Reading" on a book detail screen -> a timer begins counting; user taps "Stop" -> a reading session is saved with duration, start/end page, and pages-per-hour is calculated and displayed
3. User finishes a book and taps "Read Again" -> a new reading instance is created; the book shows "Read 2 times" with separate progress and session histories per instance
4. User adds a book to a series via "Add to Series" -> sees a series detail screen with books in reading order and a "Next Up" badge on the next unread entry
5. User views reading stats -> sees pages-per-hour average, total reading time, and a progress-over-time chart for the current book

### Feature Set 2: Discovery, Social, and Challenges

6. User tags a book with mood ("dark"), pace ("fast"), and content warnings ("violence") -> these appear on the book detail and are filterable in library search
7. User creates a custom reading challenge ("Read 5,000 pages this year") -> sees a progress tracker on the home screen updating as books and pages are logged
8. User opens "Year in Review" at year end -> sees a shareable graphic card (PNG export) with top books, total pages, genres, mood breakdown, and reading streaks

### Feature Set 3: Journaling Integration

9. User navigates to the Journal tab -> sees a chronological list of entries with a "New Entry" button; taps it -> opens a Markdown editor with formatting toolbar, date stamp, and optional photo attachment
10. User writes a journal entry and taps "Link to Book" -> sees their library as a picker; selects a book -> the entry appears both in the journal timeline and on that book's detail page under "My Reflections"

---

## Constraint Architecture

**Musts:**
- All data stored in local SQLite with `bk_` table prefix (new tables: `bk_reading_progress`, `bk_reading_sessions`, `bk_series`, `bk_series_books`, `bk_mood_tags`, `bk_content_warnings`, `bk_challenges`, `bk_challenge_progress`, `bk_journal_entries`, `bk_journal_photos`, `bk_journal_book_links`)
- Zero network calls for journaling (all on-device)
- Extend existing FTS5 index to cover journal content
- Follow the existing `ModuleDefinition` pattern in `modules/books/src/definition.ts`
- Migrations must be additive only (CREATE TABLE IF NOT EXISTS, never ALTER or DROP existing tables)
- Both standalone (`MyBooks/`) and hub module (`modules/books/`) must receive changes in the same session

**Must-nots:**
- Do not remove or modify existing tables (`bk_books`, `bk_shelves`, etc.)
- Do not add cloud sync, accounts, or telemetry
- Do not modify `packages/module-registry/` or other modules
- Do not use third-party journaling or Markdown libraries heavier than 50KB gzipped

**Preferences:**
- Reuse the existing tag system for mood/pace/genre tags rather than creating a parallel system
- Use `expo-crypto` for journal encryption on mobile, Web Crypto API on web
- Progress bar component should be reusable across modules (add to `packages/ui/`)
- Reading timer should use `requestAnimationFrame` / `setInterval` with background persistence

**Escalation triggers:**
- If the existing stats engine in `MyBooks/packages/shared/src/stats/` cannot accommodate reading-session data without a rewrite, stop and document the gap
- If encrypted storage requires a third-party native module not already in the Expo ecosystem, flag for review
- If Whisper.cpp integration requires native code beyond Expo's capabilities, defer voice-to-journal and document

---

## Subtask Decomposition

**Subtask 1: Reading Progress Schema and Engine (90 min)**
Add `bk_reading_progress` and `bk_reading_sessions` tables to the shared DB schema. Build a `ProgressEngine` in `packages/shared/src/` with methods for recording page updates, calculating completion percentage, and aggregating session stats. Write unit tests.

**Subtask 2: Series Tracking (60 min)**
Add `bk_series` and `bk_series_books` tables. Build series CRUD in shared package. Add "Next Up" logic that finds the first unfinished book in series order. Wire into book detail screen.

**Subtask 3: Mood Tags, Content Warnings, and Discovery Filters (60 min)**
Extend existing tag system with `bk_mood_tags` and `bk_content_warnings` tables. Add filter queries to the search/browse engine. Update library list to support mood/pace filtering.

**Subtask 4: Reading Challenges Engine (60 min)**
Add `bk_challenges` and `bk_challenge_progress` tables. Build challenge types (books-count, pages-count, minutes-count, themed). Progress auto-updates when reading sessions or book completions are logged.

**Subtask 5: Journal Schema and Core Engine (90 min)**
Add journal tables (`bk_journal_entries`, `bk_journal_photos`, `bk_journal_book_links`). Build journal CRUD in shared package with Markdown storage, photo path references, book linking, and FTS5 indexing. Implement AES-256 encryption for entry content.

**Subtask 6: Journal UI and Book Linking (90 min)**
Build the Journal tab with entry list, Markdown editor, photo attachment, and book picker. Wire book-linked entries to appear on book detail pages under "My Reflections".

**Subtask 7: Wrap-up Graphics and Widget Data (60 min)**
Build a local renderer for shareable year/month summary cards. Export as PNG via canvas. Expose widget-ready data queries for current read, progress, and streak.

---

## Evaluation Design

1. **Schema completeness:** `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'bk_%'` returns all existing + new tables (target: 20+ tables total)
2. **Progress tracking:** Create a book, log 3 progress updates -> `getProgressHistory(bookId)` returns 3 entries with ascending page numbers and timestamps
3. **Reading timer:** Start a session, wait 5 seconds, stop -> session record shows duration >= 5000ms with correct page delta
4. **Journal encryption:** Write an entry with encryption enabled -> raw SQLite row content is not readable plaintext; decrypt with correct passphrase -> content matches original
5. **Parity gate:** `pnpm typecheck` exits 0; `pnpm check:parity` exits 0
