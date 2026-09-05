# Feature Spec: Search

## Metadata
- **Module:** mail
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [5] x3 + Complexity [2] x2 + CrossModule [0] x1 + PaidUser [0] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (existing in-memory searchMessages is a foundation, but this replaces it with FTS5)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The existing `searchMessages()` function does in-memory substring matching, which is unusable beyond a few hundred messages. Real email users have thousands of messages and need instant full-text search. Gmail's search is its killer feature; Superhuman charges $30/mo largely for search speed. MyMail needs server-grade search performance on local SQLite via FTS5. Without fast search, power users will not adopt MyMail.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Yes | No | Full-text search with operators (from:, to:, subject:, has:attachment), search suggestions, recent search history |
| Outlook | Yes | No | Focused search with filters (from, date range, has attachments), search folders, AQL syntax |
| Superhuman | Yes | Yes ($30/mo) | "Instant search" -- results as you type, split-second indexing, search history |
| Spark | Yes | No | Full-text search with smart suggestions, search by sender/subject/content |
| ProtonMail | Yes | No | Client-side search (encrypted), limited full-text on paid plans |

### Target User
Any email user with more than 100 messages who needs to find a specific message. Gmail users accustomed to powerful search operators. Superhuman users paying premium for search speed. This is every email user.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- New types: MailSearchResult, SearchOptions
  db/schema.ts                        -- V2 migration: ml_messages_fts FTS5 virtual table
  db/crud.ts                          -- New: searchMessagesDb (FTS5 query), reindexMessages
  engine/search.ts                    -- MODIFIED: add FTS5-backed search, keep in-memory as fallback

apps/mobile/app/(mail)/
  components/SearchBar.tsx             -- NEW: search input with real-time results
  components/SearchResults.tsx         -- NEW: result list with highlighted snippets
  search.tsx                           -- NEW: dedicated search screen

apps/web/app/mail/
  search/page.tsx                      -- NEW: search page with filters sidebar
  components/SearchBar.tsx             -- NEW: global search bar in mail header
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Inbox (top: search bar) ← SEARCH BAR HERE
       └── Search screen (tap search bar) ← RESULTS HERE
```

### Data Model

```sql
-- V2 migration (add to same V2 as attachments if built together, otherwise V3)
CREATE VIRTUAL TABLE IF NOT EXISTS ml_messages_fts USING fts5(
  subject,
  "from",
  body,
  content=ml_messages,
  content_rowid=rowid,
  tokenize='porter unicode61'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS ml_messages_fts_insert AFTER INSERT ON ml_messages BEGIN
  INSERT INTO ml_messages_fts(rowid, subject, "from", body)
  VALUES (NEW.rowid, NEW.subject, NEW."from", NEW.body);
END;

CREATE TRIGGER IF NOT EXISTS ml_messages_fts_delete AFTER DELETE ON ml_messages BEGIN
  INSERT INTO ml_messages_fts(ml_messages_fts, rowid, subject, "from", body)
  VALUES ('delete', OLD.rowid, OLD.subject, OLD."from", OLD.body);
END;

CREATE TRIGGER IF NOT EXISTS ml_messages_fts_update AFTER UPDATE ON ml_messages BEGIN
  INSERT INTO ml_messages_fts(ml_messages_fts, rowid, subject, "from", body)
  VALUES ('delete', OLD.rowid, OLD.subject, OLD."from", OLD.body);
  INSERT INTO ml_messages_fts(rowid, subject, "from", body)
  VALUES (NEW.rowid, NEW.subject, NEW."from", NEW.body);
END;
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, FTS5 support), `@mylife/search` (pattern reference for FTS5 usage)
- **External:** None (SQLite FTS5 is built into expo-sqlite and better-sqlite3)
- **Cross-Module:** `@mylife/search` hub_search_index (mail messages should be indexed for cross-module Cmd+K search)

## Functional Requirements

### User Stories
1. As a mail user, I want to search my messages by keyword so that I can find specific emails quickly.
2. As a mail user, I want search results highlighted with matching text so that I can see why each result matched.
3. As a mail user, I want to filter search results by folder or account so that I can narrow results.
4. As a mail user, I want recent searches saved so that I can quickly repeat common queries.

### Behavior Specification

1. User taps the search bar at the top of the inbox
2. Keyboard opens, search screen appears with recent searches (last 10, stored in ml_search_history or AsyncStorage)
3. User types a query. After 80ms debounce, system runs FTS5 MATCH query against ml_messages_fts
4. Results appear in a list sorted by relevance (FTS5 rank), then by received_at DESC
5. Each result shows: subject (highlighted match), sender, snippet (40-char context around match with **bold** markers), date, folder badge
6. User can tap filter chips: "All", specific folder names, specific accounts
7. Tapping a result navigates to message detail
8. Empty results show "No messages match '[query]'" with suggestion to try different terms
9. Search history: tapping search bar shows 10 most recent unique queries. Tapping one fills the search field
10. Clear history button removes all saved searches

### Edge Cases

- Empty query: show recent searches, do not run FTS5
- Query under 2 characters: show "Type at least 2 characters" hint
- Very long query (100+ chars): truncate to first 10 words before FTS5 match
- Special FTS5 characters (*, ", -): escape before passing to MATCH to prevent syntax errors
- No FTS5 index yet (upgrade from V1): run one-time reindex, show spinner with "Indexing messages..."
- Account has 50,000+ messages: FTS5 handles this natively, but limit results to 100 with "Show more" pagination
- Query matches only in body but subject is blank: show "[No subject]" with body snippet

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping search bar opens search screen with recent searches
- [ ] **AC-2:** Typing a query shows results within 200ms (after 80ms debounce)
- [ ] **AC-3:** Search results show subject with highlighted matching text
- [ ] **AC-4:** Search results show snippet with context around the match
- [ ] **AC-5:** Tapping a result navigates to message detail
- [ ] **AC-6:** Filter chips allow narrowing by folder
- [ ] **AC-7:** Recent searches persist across app restarts (up to 10)
- [ ] **AC-8:** "No results" state shows helpful message

### Technical Criteria
- [ ] **TC-1:** FTS5 virtual table ml_messages_fts created in migration
- [ ] **TC-2:** FTS5 triggers keep index in sync on INSERT, UPDATE, DELETE
- [ ] **TC-3:** FTS5 MATCH query returns results sorted by rank then received_at
- [ ] **TC-4:** Search completes in < 200ms for 10,000 messages
- [ ] **TC-5:** Special characters escaped to prevent FTS5 syntax errors
- [ ] **TC-6:** Reindex function populates FTS5 from existing ml_messages

### Negative Criteria
- [ ] **NC-1:** Search must NOT load all messages into memory (use FTS5 SQL, not in-memory filter)
- [ ] **NC-2:** Search must NOT block the UI thread (run on database thread)
- [ ] **NC-3:** FTS5 index must NOT grow larger than 2x the source text size

## UI Specification

### Mobile (Expo)
- Search bar: `rgba(255,255,255,0.04)` glass background, search icon left, clear X right, placeholder "Search messages..."
- Result cards: `#12121A` surface background, subject in `#F0F0F5` primary text, snippet in `rgba(240,240,245,0.65)` secondary, match highlights in `#3B82F6` accent
- Filter chips: horizontal scroll row below search bar, active chip filled `#3B82F6`, inactive `rgba(255,255,255,0.08)`
- Recent searches: list with clock icon, each query tappable

### Web (Next.js)
- Search bar: in mail header, same glass styling via CSS variables
- Results page: two-column layout on wide screens (filters left, results right)
- Keyboard shortcut: `/` focuses search bar (consistent with Cmd+K hub search)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton shimmer on result cards | FTS5 query running |
| Empty | Recent searches list | Search bar focused, no query |
| Error | "Search unavailable, rebuilding index..." with spinner | FTS5 index corrupted |
| Success | Result list with highlighted matches | Query returns results |
| Partial | "Showing first 100 results" with load-more button | Many results |

## Test Requirements

### Unit Tests
- [ ] FTS5 search: returns messages matching subject keyword
- [ ] FTS5 search: returns messages matching body keyword
- [ ] FTS5 search: returns messages matching sender
- [ ] FTS5 search: handles empty query (returns empty array)
- [ ] FTS5 search: handles special characters without error
- [ ] FTS5 search: respects folder filter
- [ ] FTS5 search: respects account filter
- [ ] FTS5 triggers: new message appears in search results
- [ ] FTS5 triggers: deleted message disappears from search results
- [ ] FTS5 triggers: updated message reflects changes in search
- [ ] Reindex: populates FTS5 from existing messages
- [ ] Snippet extraction: returns 40-char context around match

### Integration Tests
- [ ] Full flow: compose + send message -> search by subject -> find message -> navigate to detail
- [ ] Filter flow: search with folder filter -> results only from that folder

### QA Verification Script

1. Open MyMail on mobile
2. Ensure at least 20 messages exist across multiple folders
3. Tap the search bar at top of inbox
4. Verify: recent searches appear (or empty if first time) -- corresponds to AC-1
5. Type "invoice" (a word in at least one message subject)
6. Verify: results appear within 200ms with highlighted "invoice" in subject -- corresponds to AC-2, AC-3
7. Verify: snippet shows context around the match -- corresponds to AC-4
8. Tap a result
9. Verify: navigates to message detail -- corresponds to AC-5
10. Go back, tap a folder filter chip
11. Verify: results narrow to only that folder -- corresponds to AC-6
12. Type a query with no matches ("xyzzy12345")
13. Verify: "No messages match" state -- corresponds to AC-8
14. Close and reopen app
15. Tap search bar
16. Verify: previous search queries appear in recent list -- corresponds to AC-7

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to search screen, test query flow, verify all states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
Mail module has in-memory `searchMessages()` that does substring matching. No FTS5 index. No search UI. Search degrades rapidly beyond 100 messages.

### After This Work
FTS5 virtual table with auto-sync triggers. Database-level search returning ranked, snippeted results in < 200ms. Dedicated search screen with recent history and folder filters.

### Files Changed
- `modules/mail/src/types.ts` -- Added MailSearchResult, SearchOptions types
- `modules/mail/src/db/schema.ts` -- Added FTS5 virtual table + triggers
- `modules/mail/src/db/crud.ts` -- Added searchMessagesDb, reindexMessages
- `modules/mail/src/engine/search.ts` -- Modified to use FTS5 with in-memory fallback
- `modules/mail/src/definition.ts` -- V2/V3 migration entry
- `apps/mobile/app/(mail)/search.tsx` -- NEW search screen
- `apps/mobile/app/(mail)/components/SearchBar.tsx` -- NEW
- `apps/mobile/app/(mail)/components/SearchResults.tsx` -- NEW
- `apps/web/app/mail/search/page.tsx` -- NEW
- `apps/web/app/mail/components/SearchBar.tsx` -- NEW

### Known Limitations
- No search operators (from:, to:, has:attachment). FTS5 MATCH only.
- No search result ranking by recency boost (just FTS5 rank + received_at).
- No attachment content search (only subject, from, body).

### Context for Next Agent
The FTS5 table pattern follows `@mylife/search` hub_search_index. Use the same porter+unicode61 tokenizer. When building Threading, threaded search results should group by thread rather than individual messages. The reindexMessages function should be idempotent and safe to call on every app launch if the FTS5 table is empty.
