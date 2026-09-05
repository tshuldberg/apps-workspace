# MyBooks - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** Complete -- all gaps closed (35+ tables, 6 migrations)
**CEO Review:** 2026-03-24 (Scope Expansion mode)

## Current State

MyBooks is a fully implemented privacy-first book tracking module. Tagline: "Read in peace." Full feature set: library management, FTS5 search, half-star ratings, reading sessions with timer, annual goals, year-in-review stats, built-in e-reader (ePub/PDF), reading challenges, encrypted journal, Goodreads/StoryGraph import, barcode scanning, book recommendations (on-device), social feed (opt-in), stats sharing cards, badges (31 across 9 categories), book clubs, community challenges, quote collection, personalized reading insights, genre evolution timeline, and "On This Day" reading history. All core data local SQLite with `bk_` prefix. Social features use opt-in Supabase sync.

## Competitors Analyzed

| Competitor | Price | Category | Key Strength |
|-----------|-------|----------|-------------|
| Goodreads | Free | Book tracking | Massive community, Amazon integration |
| StoryGraph | $49.99/yr | Book tracking | Mood-based recs, content warnings, stats |
| Bookly | $30/yr | Book tracking | Reading timer, streaks, statistics |
| Literal | Free | Book tracking | Clean design, social reading lists |
| Letterboxd | $19-49/yr | Film tracking (pattern) | Beautiful stats, social sharing culture |
| Untappd | $55/yr | Beer tracking (pattern) | Badge/gamification system |

## Feature Gaps -- All Closed

| Feature | Status | Implementation | Notes |
|---------|--------|---------------|-------|
| Book recommendations engine | DONE | `recommendations/engine.ts` | Author/genre affinity, on-device, no cloud ML |
| Social feed | DONE | `social/feed-engine.ts` | Supabase-backed, opt-in, friend connections |
| Reading stats sharing | DONE | `sharing/card-renderer.ts` | 5 templates (year summary, monthly, genre, authors, streak) |
| Badge/achievement system | DONE | `badges/badge-engine.ts` | 31 badges, 9 categories, bronze/silver/gold tiers |
| Book clubs | DONE | `clubs/club-engine.ts` | Local + connected modes, reading pace tracking |
| Community challenges | DONE | `community-challenges/` | 12 preset templates, custom creation |
| Quote collection | DONE | `quotes/`, `db/quotes.ts` | FTS search, favorites, random surfacing |
| Reading insights | DONE | `insights/insights-engine.ts` | Speed patterns, peak hours, session trends, diversity |
| Genre evolution | DONE | `insights/genre-evolution.ts` | Taste changes over years with dominant genre shifts |
| "On This Day" history | DONE | `insights/on-this-day.ts` | Calendar-date reading events from prior years |
| Author following | DEFERRED | -- | P3, Open Library API polling for new releases |

## Privacy Architecture

MyBooks follows the "Read in peace" principle: private by default, social by choice.

### Default (zero cloud)
- All book data, reading sessions, stats, journal entries, badges, challenges, and quotes stored in local SQLite
- Recommendations computed entirely on-device from local ratings
- Sharing cards generated locally as images, exported via system share sheet
- No analytics, no telemetry, no data collection

### Opt-in social layer
- Social features (feed, friend connections, community challenges) require explicit user opt-in
- Per-module toggle: users enable social for MyBooks independently of other modules
- Hub-level prompt on first launch, then per-module settings
- Even in social mode: no tracking, no data selling, no advertising
- Data sent to Supabase is limited to what the user explicitly chooses to share (ratings, reviews, reading activity)
- Users can revoke social access and delete synced data at any time

### Marketing message
"Your reading list is nobody's business but yours. But if you want to share it, we'll respect you there too."

## Cross-Module Integration

| Module | Integration |
|--------|------------|
| **MyJournal** | Reading reflections linked to specific books or reading sessions |
| **MyHabits** | Reading streak as a trackable habit |
| **MyMood** | Correlate reading activity with mood entries |
| **Hub Search** | CrossModuleInterface exports searchable books and reviews |
| **Hub Dashboard** | Data summary with currently reading count, books finished, avg rating |
| **Hub Activity** | Activity feed items for books started, finished, and added |

## 10-Star Experience Ladder (CEO Review 2026-03-24)

```
1-star:  Write down books you read
3-star:  Library with search, ratings, shelves
5-star:  Stats, goals, Goodreads import, year-in-review
7-star:  Built-in reader, discovery, challenges, journal, recommendations
8-star:  Reading insights, quote collection, genre evolution, on-this-day
9-star:  Beautiful shareable cards, badges, clubs, opt-in social
10-star: The app understands your taste better than you do. You open it
         and feel compelled to read instead of scroll. Social feels safe.
```

Current assessment: 8-9/10. The remaining delta to 10 is polish, not features.
