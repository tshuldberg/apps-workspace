# Feature Spec: Book Clubs

## Metadata
- **Module:** books
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** BK-001 (Library Management -- implemented), BK-006 (Reading Sessions -- implemented)
- **Blocks:** Connected book clubs (future Supabase integration)

## Business Context

### Why This Feature Exists
Book clubs are one of Goodreads' stickiest features, keeping users engaged even when they don't actively track reading. Goodreads hosts thousands of active book clubs, and leaving a club means losing discussion history. MyBooks can capture this use case with a local-first approach: users track their own book club reading schedules, discussion notes, and progress without requiring an account or internet connection. This serves both solo readers who participate in IRL book clubs (tracking their club reads) and the foundation for future connected clubs.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Goodreads | Yes | Free | Cloud-based groups with forums, polls, reading schedules. Massive scale (10K+ clubs). |
| StoryGraph | No | N/A | No book club feature. Buddy reads only. |
| Bookly | No | N/A | No social features. |
| Literal | Yes | Free | "Clubs" with shared reading lists and discussion. Smaller scale. |

### Target User
Readers who participate in 1-3 book clubs (in-person, Zoom, Discord, or online) and want to track their club reading schedule, discussion notes, and progress in the same app where they track all their reading. Currently these users maintain separate notes or calendar reminders for club reads.

## Technical Context

### Where This Lives in MyLife

```
modules/books/src/clubs/                        -- NEW: club engine + types
modules/books/src/clubs/types.ts                -- BookClub, ClubNote, ClubHistory types
modules/books/src/clubs/club-engine.ts          -- Club CRUD, progress tracking, history
modules/books/src/clubs/index.ts                -- Barrel export
modules/books/src/clubs/__tests__/              -- Tests
modules/books/src/db/clubs.ts                   -- NEW: SQLite CRUD for club tables
modules/books/src/db/club-notes.ts              -- NEW: SQLite CRUD for club notes
apps/mobile/app/(books)/clubs.tsx               -- Mobile clubs list screen
apps/mobile/app/(books)/club-detail.tsx         -- Mobile club detail screen
apps/web/app/books/clubs/page.tsx               -- Web clubs list page
apps/web/app/books/clubs/[id]/page.tsx          -- Web club detail page
```

### Wireframe Position

```
Hub Dashboard
  └── MyBooks card
       └── Stats tab (or new Clubs tab if 6th tab warranted)
            └── Book Clubs section
                 └── Clubs List ← YOU ARE HERE
                      └── Club Detail
```

### Data Model

Two new tables in migration V5:

```sql
-- Book Clubs
CREATE TABLE IF NOT EXISTS bk_book_clubs (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  current_book_id TEXT REFERENCES bk_books(id) ON DELETE SET NULL,
  reading_start_date TEXT,
  reading_end_date TEXT,
  mode TEXT NOT NULL DEFAULT 'local'
    CHECK (mode IN ('local', 'connected')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Club Notes / Discussion
CREATE TABLE IF NOT EXISTS bk_club_notes (
  id TEXT PRIMARY KEY NOT NULL,
  club_id TEXT NOT NULL REFERENCES bk_book_clubs(id) ON DELETE CASCADE,
  book_id TEXT REFERENCES bk_books(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'discussion'
    CHECK (note_type IN ('discussion', 'prompt', 'schedule', 'milestone')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Club History (tracks previously read books)
CREATE TABLE IF NOT EXISTS bk_club_history (
  id TEXT PRIMARY KEY NOT NULL,
  club_id TEXT NOT NULL REFERENCES bk_book_clubs(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES bk_books(id) ON DELETE CASCADE,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS bk_club_notes_club_idx ON bk_club_notes(club_id);
CREATE INDEX IF NOT EXISTS bk_club_notes_book_idx ON bk_club_notes(book_id);
CREATE INDEX IF NOT EXISTS bk_club_notes_created_idx ON bk_club_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS bk_club_history_club_idx ON bk_club_history(club_id);
CREATE INDEX IF NOT EXISTS bk_club_history_book_idx ON bk_club_history(book_id);
CREATE INDEX IF NOT EXISTS bk_book_clubs_active_idx ON bk_book_clubs(is_active) WHERE is_active = 1;
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), books CRUD (book lookup), reading sessions (progress tracking)
- **External:** none for local mode. Future: Supabase Auth + Realtime for connected mode.
- **Cross-Module:** Club reading activity could feed into `crossModule.getActivityFeed()` (books already implements this)

## Functional Requirements

### User Stories
1. As a book club member, I want to create a club in the app with a name and current book so that I can track my club reading alongside my personal reading.
2. As a club organizer, I want to set a reading schedule (start/end dates) so that I can pace my reading and see days remaining.
3. As a club participant, I want to add discussion notes and prompts so that I have a record of our conversations and preparation.
4. As a reader in multiple clubs, I want to see all my clubs in one list with their current books and deadlines so that I can manage my club commitments.
5. As a long-term club member, I want to see a history of all books my club has read so that I have a record of our reading journey.

### Behavior Specification

1. User navigates to MyBooks > Stats tab (or Clubs tab if added).
2. "Book Clubs" section shows a list of the user's clubs (or empty state).
3. User taps "Create Club" button.
4. Create Club modal appears with fields: name (required), description (optional), select first book from library, reading schedule (start/end dates), mode selector (local only -- connected greyed out).
5. User fills in club details and taps "Create".
6. New club appears in the clubs list with: name, current book cover, days remaining.
7. User taps a club to view the Club Detail screen.
8. Club Detail shows: club name/description, current book with cover/title/progress, reading schedule with days remaining, discussion thread (chronological notes), and a "Set Next Book" button.
9. User taps "Add Note" to write a discussion note, prompt, or schedule note.
10. Note appears in the discussion thread with timestamp and type badge.
11. When the reading deadline passes, a "Reading period ended" banner appears with option to extend or set next book.
12. User taps "Set Next Book" to archive the current book to club history and select a new book.
13. Club history is accessible via "History" button showing all previously read books with dates.

### Edge Cases

- **Club with no current book:** Show "Set a book to start reading together" prompt.
- **Current book not in user's library:** Show "Add [Book Title] to your library to track your progress."
- **Reading deadline passed:** "Reading period ended" banner. Do not auto-archive -- user decides when to move on.
- **Changing current book:** Previous book moves to club history with finished_at timestamp. New book becomes current.
- **Deleting a club:** Confirmation dialog. Deletes club, all notes, and history. Does NOT delete the books themselves.
- **Deleting the current book from library:** `current_book_id` set to NULL via ON DELETE SET NULL. Club shows "Book removed from library" state.
- **Empty discussion thread:** Show "Start a discussion! Add notes about your current read."
- **Very long club name:** Truncated in list view, full name shown in detail.
- **Many clubs (10+):** Scrollable list, no practical limit.
- **Module disabled:** Club data preserved in SQLite but not accessible.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can create a book club with a name and optional description.
- [ ] **AC-2:** User can select a book from their library as the current club read.
- [ ] **AC-3:** User can set a reading schedule with start and end dates.
- [ ] **AC-4:** Club list shows all clubs with name, current book cover, and days remaining.
- [ ] **AC-5:** Club detail screen shows current book, reading progress, and schedule.
- [ ] **AC-6:** User can add discussion notes with type (discussion/prompt/schedule/milestone).
- [ ] **AC-7:** Notes appear in chronological order in the discussion thread.
- [ ] **AC-8:** User can set a new current book, archiving the previous book to history.
- [ ] **AC-9:** Club history shows all previously read books with start/finish dates.
- [ ] **AC-10:** Deleting a club requires confirmation and removes club + notes + history (not the books).
- [ ] **AC-11:** Club with no current book shows a prompt to set one.
- [ ] **AC-12:** "Connected" mode is visible but disabled with "Coming soon" label.

### Technical Criteria
- [ ] **TC-1:** Migration V5 creates `bk_book_clubs`, `bk_club_notes`, and `bk_club_history` tables with all indexes.
- [ ] **TC-2:** Club CRUD operations use the `bk_` prefix consistently.
- [ ] **TC-3:** Setting a new current book creates a `bk_club_history` record for the previous book.
- [ ] **TC-4:** Deleting a club cascades to notes and history but not to books (CASCADE on club_id, SET NULL on book_id).
- [ ] **TC-5:** Reading progress displayed for current book is fetched from existing `bk_reading_sessions` for the current_book_id.
- [ ] **TC-6:** Days remaining is computed as `ceil((end_date - today) / (1000*60*60*24))`. Negative values show "X days overdue".

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Deleting a club must NOT delete the books from the user's library.
- [ ] **NC-2:** Connected mode must NOT be functional in this implementation. UI shows it as disabled.
- [ ] **NC-3:** Club data must NOT require network connectivity. Everything is local SQLite.
- [ ] **NC-4:** Club notes must NOT be encrypted (unlike journal entries). They are plain text.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Club cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Current book cover: 60x90px thumbnail on club card, 120x180px on detail screen
- Module accent: `#C9894D` for "Create Club" button, active indicators, days remaining badge
- Discussion thread: glass card per note, type badge (colored chip), timestamp in textSecondary
- Days remaining badge: green (<7 days), amber (3-7 days), red (<3 days or overdue)

### Web (Next.js)

- Route: `/books/clubs` (list), `/books/clubs/[id]` (detail)
- Same tokens via CSS variables
- Two-column layout on detail: left column for book + schedule, right column for discussion thread
- "Create Club" button in page header

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton club cards | Initial data fetch |
| Empty | "No book clubs yet. Create one to track your group reads!" + "Create Club" CTA | No clubs created |
| Error | "Could not load clubs. Pull down to retry." | Database read failure |
| Success | List of club cards with current books and deadlines | 1+ clubs exist |
| Partial | Club card with "No book selected" placeholder | Club created without selecting a book |

## Test Requirements

### Unit Tests
- [ ] `createClub`: creates club with name, description, current_book_id, dates
- [ ] `createClubMinimal`: creates club with only a name (description, book, dates all optional)
- [ ] `addNoteToClub`: creates a discussion note linked to club and optional book
- [ ] `setNextBook`: archives current book to history, updates current_book_id
- [ ] `setNextBookNoCurrentBook`: setting first book creates no history entry
- [ ] `getClubHistory`: returns previously read books in chronological order
- [ ] `deleteClub`: removes club, notes, and history but not the books
- [ ] `deactivateClub`: sets is_active to 0, club hidden from active list
- [ ] `daysRemaining`: correctly computes positive, zero, and negative days
- [ ] `clubWithDeletedBook`: current_book_id is NULL after book deletion

### Integration Tests
- [ ] Full flow: create club -> set book -> add notes -> set next book -> verify history
- [ ] Delete flow: create club with notes -> delete club -> verify books still exist in library

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyBooks > Stats tab
3. Verify: "Book Clubs" section shows empty state -- corresponds to AC (empty state)
4. Tap "Create Club"
5. Enter name "Sci-Fi Monthly", description "Monthly sci-fi reads"
6. Select "Dune" from library as current book
7. Set start date to today, end date to 30 days from now
8. Tap "Create"
9. Verify: club appears in list with "Dune" cover and "30 days remaining" -- corresponds to AC-4
10. Tap the club card
11. Verify: Club Detail shows "Dune" with cover, reading progress, and schedule -- corresponds to AC-5
12. Tap "Add Note"
13. Select type "discussion", enter "Chapter 1-5 was incredible"
14. Verify: note appears in thread with timestamp -- corresponds to AC-6, AC-7
15. Tap "Set Next Book"
16. Select "Project Hail Mary" from library
17. Verify: "Dune" moves to history, "Project Hail Mary" becomes current -- corresponds to AC-8
18. Tap "History"
19. Verify: "Dune" appears with start/finish dates -- corresponds to AC-9
20. Go back to clubs list
21. Long-press or tap delete on the club
22. Confirm deletion
23. Verify: club is removed, but "Dune" and "Project Hail Mary" still in library -- corresponds to AC-10
24. Open the app on web
25. Navigate to Books > Clubs
26. Verify: same club CRUD functionality works on web

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /books/clubs, create a club, verify all 5 states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building (Complexity score is 1)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- verify hub module integrity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No club functionality exists. The SPEC-mybooks.md defines BK-028 with local and connected modes, and schema for `bk_book_clubs` and `bk_club_notes` tables. The books module is at schema version 4 with 28+ tables.

### After This Work
Three new tables (`bk_book_clubs`, `bk_club_notes`, `bk_club_history`) exist via migration V5. A `clubs/` directory provides club engine with CRUD, history tracking, and progress computation. Mobile and web UIs allow creating clubs, managing books, adding notes, and viewing history. Connected mode is visible but disabled.

### Files Changed
- `modules/books/src/db/schema.ts` -- add CREATE_BOOK_CLUBS, CREATE_CLUB_NOTES, CREATE_CLUB_HISTORY, CREATE_CLUB_INDEXES
- `modules/books/src/definition.ts` -- add BOOKS_MIGRATION_V5 with club tables, increment schemaVersion to 5
- `modules/books/src/db/clubs.ts` -- club CRUD operations
- `modules/books/src/db/club-notes.ts` -- club notes CRUD
- `modules/books/src/clubs/types.ts` -- BookClub, ClubNote, ClubHistory, ClubWithProgress types
- `modules/books/src/clubs/club-engine.ts` -- setNextBook, getClubProgress, daysRemaining functions
- `modules/books/src/clubs/index.ts` -- barrel export
- `modules/books/src/clubs/__tests__/club-engine.test.ts` -- 10+ unit tests
- `modules/books/src/models/schemas.ts` -- add BookClub, ClubNote, ClubHistory Zod schemas
- `modules/books/src/index.ts` -- re-export clubs module
- `apps/mobile/app/(books)/clubs.tsx` -- mobile clubs list
- `apps/mobile/app/(books)/club-detail.tsx` -- mobile club detail
- `apps/web/app/books/clubs/page.tsx` -- web clubs list
- `apps/web/app/books/clubs/[id]/page.tsx` -- web club detail

### Known Limitations
- Local mode only. Connected mode (multi-user sync via Supabase) is deferred.
- No group progress visualization (only individual user progress for local mode).
- No reading pace recommendations or automatic milestone calculation.
- Club notes are plain text only, no rich text or image attachments.

### Context for Next Agent
- Migration V5 adds club tables. If badge/achievement spec also requires V5, coordinate: either combine into one V5 migration or sequence as V5 (clubs) + V6 (badges).
- Reading progress for the current book is fetched from `bk_reading_sessions` where `book_id = current_book_id`. Use existing `getReadingSessionsForBook()` from `db/reading-sessions.ts`.
- The `clubs/` directory follows the same pattern as `challenges/`, `discovery/`, and `journal/` -- a `types.ts`, engine file, index barrel, and `__tests__/` directory.
- Future connected mode will require Supabase tables mirroring the local schema plus user_id columns and RLS policies. Design the local schema to be forward-compatible.
