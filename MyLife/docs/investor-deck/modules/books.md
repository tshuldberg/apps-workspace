# MyBooks — Module Audit

**ID:** books | **Prefix:** bk_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0 (schema v10)
**One-line promise:** Read in peace

## User Value
- Track your full reading life (shelves, goals, series, reviews, quotes) in a single private library.
- Log reading sessions with a built-in timer and get personal insights on speed, peak hours, and genre diversity.
- Read ePub/PDF inside the app with annotations and private reader notes.
- Join local or connected book clubs and community reading challenges without surrendering your data to Amazon.
- Import from Goodreads and StoryGraph CSVs; scan barcodes to add new titles.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Multi-shelf library + system seeds | modules/books/src/db/schema.ts (SEED_SYSTEM_SHELVES) | shipped |
| FTS5 full-text search (books + journal + quotes) | modules/books/src/db/schema.ts | shipped |
| Reading sessions + timed sessions | modules/books/src/db/reading-sessions.ts, timed-sessions.ts | shipped |
| ePub/PDF reader | modules/books/src/reader/, db/reader-documents.ts | shipped |
| Reading goals + year-in-review | modules/books/src/db/reading-goals.ts, stats/ | shipped |
| Challenges + community challenges | modules/books/src/challenges/, community-challenges/ | shipped |
| Badges (31 achievements) | modules/books/src/badges/badge-engine.ts, definitions.ts | shipped |
| Book clubs (local + connected) | modules/books/src/clubs/club-engine.ts | shipped |
| Recommendations (on-device) | modules/books/src/recommendations/ | shipped |
| Discovery engine | modules/books/src/discovery/discovery-engine.ts | shipped |
| Insights (speed, peak hours, on-this-day, genre evolution) | modules/books/src/insights/ | shipped |
| Goodreads + StoryGraph CSV import | modules/books/src/import/goodreads.ts, storygraph.ts | shipped |
| Encrypted journal with photos | modules/books/src/journal/, db/journal-*.ts | shipped |
| Quotes + FTS | modules/books/src/quotes/, db/quotes.ts | shipped |
| Share events + social feed (opt-in) | modules/books/src/sharing/, social/, db/sharing.ts | shipped |
| Hub attachment pointer (v10) | modules/books/src/db/schema-v10.ts | shipped |

## Data Model
- Core: bk_books, bk_shelves, bk_book_shelves, bk_tags, bk_book_tags, bk_reviews, bk_reading_goals, bk_reading_sessions, bk_timed_sessions, bk_progress_updates.
- Library metadata: bk_series, bk_series_books, bk_mood_tags, bk_content_warnings, bk_ol_cache (OpenLibrary cache), bk_import_log.
- Reader: bk_reader_documents, bk_reader_notes, bk_reader_preferences.
- Social + gamification: bk_challenges, bk_challenge_progress, bk_community_challenges, bk_community_challenge_participation, bk_badges, bk_book_clubs, bk_club_members, bk_club_notes, bk_club_history, bk_share_events.
- Journal: bk_journal_entries, bk_journal_photos, bk_journal_book_links (+ bk_journal_fts).
- Quotes: bk_quotes (+ bk_quotes_fts). FTS: bk_books_fts.

## Screens / User Flows
- Mobile: apps/mobile/app/(books)/ -- index, library, discover, book/, reader, journal/, quotes/, clubs, club/, challenges, community, recommendations, insights, badges, rate-books, scan, import, onboarding.
- Web: apps/web/app/books/ -- page, [id], reader, search, stats, import, ui.ts, actions.ts.

## Distinctive / Moat-worthy
- Local-first ePub/PDF reader tied to the same library and insights (no Kindle lock-in).
- Connected book clubs with pace tracking that do not require a public social feed.
- Community challenges and badges as local engines, not a leaderboard SaaS.
- Cross-module cards and signals (vocabulary cards to MyFlash, journal links to MyJournal).

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- None -- section marks 100% parity, no unchecked items.

## Investor-facing hook
The only reader app that combines Goodreads-style tracking, a built-in reader, and bot-free book clubs inside a private suite, with no ads and no data sold to Amazon.
