# Feature Spec: Book Recommendations Engine

## Metadata
- **Module:** books
- **Priority Score:** 37 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** BK-001 (Library Management), BK-005 (Ratings/Reviews), BK-007 (Tags), BK-019 (Mood-Based Discovery) -- all implemented
- **Blocks:** none

## Business Context

### Why This Feature Exists
Book recommendations are the primary reason users stay on Goodreads (150M users) and StoryGraph (5M+ users). Both rely on cloud-based algorithms that profile user behavior for ad targeting. MyBooks can differentiate by running a recommendation engine entirely on-device using existing rating, genre, and tag data. This turns the privacy-first constraint into a feature: "Your recommendations are computed locally. We never see your reading preferences." The engine also increases engagement with the TBR shelf, reducing the "I don't know what to read next" problem that causes users to open a competitor app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Goodreads | Yes | Free | Cloud ML model trained on 150M users' ratings. Collaborative filtering. Heavy Amazon product integration. |
| StoryGraph | Yes | Free (basic) / $49.99/yr (advanced) | Mood/pace/genre-based discovery. Content warnings integration. "Because you liked X" style. |
| Bookly | No | N/A | No recommendation engine, stats-only app. |
| Literal | Yes | Free | Community-driven recommendations via curated lists and friend activity. |

### Target User
Readers who have rated 5+ books and want to discover their next read from their existing TBR shelf or from an author they already love. These are Goodreads users paying $0 but uncomfortable with Amazon's data profiling, and StoryGraph users paying $49.99/yr who would switch to a privacy-first alternative with comparable discovery.

## Technical Context

### Where This Lives in MyLife

```
modules/books/src/recommendations/             -- NEW: engine + types
modules/books/src/recommendations/types.ts      -- Recommendation, RecommendationSet types
modules/books/src/recommendations/engine.ts     -- Core recommendation algorithms
modules/books/src/recommendations/index.ts      -- Barrel export
modules/books/src/recommendations/__tests__/    -- Tests
apps/mobile/app/(books)/recommendations.tsx     -- Mobile recommendations screen
apps/web/app/books/recommendations/page.tsx     -- Web recommendations page
```

### Wireframe Position

```
Hub Dashboard
  └── MyBooks card
       └── Home tab
            └── "Recommendations" section (horizontal scroll rows)
            └── "See All" -> Recommendations screen ← YOU ARE HERE
```

### Data Model

No new tables required. Recommendations are computed at runtime from existing data:
- `bk_books` -- book metadata, subjects, authors
- `bk_reviews` -- ratings (4.0+ threshold for affinity)
- `bk_tags` / `bk_book_tags` -- user-created tags for similarity
- `bk_mood_tags` -- mood/pace/genre tags for discovery
- `bk_reading_sessions` -- finished status for filtering read vs unread
- `bk_book_shelves` / `bk_shelves` -- TBR shelf identification

Optional computed cache (no migration needed, stored in `bk_settings`):
```sql
-- Cache recommendations as JSON in bk_settings for performance
INSERT OR REPLACE INTO bk_settings (key, value)
VALUES ('recommendations_cache', '{"computed_at": "...", "results": [...]}');
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing books module CRUD, discovery engine, stats engine
- **External:** Open Library API (optional, for author affinity -- fetching other works by loved authors)
- **Cross-Module:** `crossModule.getSearchableContent()` already implemented; recommendations engine is books-internal

## Functional Requirements

### User Stories
1. As a reader who has rated 10+ books, I want to see personalized book recommendations based on my reading history so that I can find my next great read without leaving the app.
2. As a reader with a large TBR shelf, I want the app to surface TBR books that match my taste so that I prioritize the books I'm most likely to enjoy.
3. As a fan of a specific author, I want to discover their other works I haven't read yet so that I can continue reading authors I love.

### Behavior Specification

1. User navigates to the Home tab of MyBooks.
2. Below existing sections, a "Recommended for You" section appears (if 5+ rated books exist).
3. Three horizontal scroll rows are shown:
   - **"More by Authors You Love"** -- books by highly-rated authors not yet read
   - **"Based on Your Favorites"** -- TBR books matching subjects/tags of 4+ star books
   - **"Popular in Your Top Genres"** -- TBR books in the user's most-read genres
4. Each row shows book cards: cover, title, author. Tap navigates to book detail.
5. For author affinity results that include Open Library suggestions (books not in library), an "Add" button overlay appears on the card.
6. Each row has a "See All" link that expands to a full vertical list.
7. User taps "See All" on any section to view the full recommendations screen.
8. Recommendations screen shows all three sections in full vertical layout with reason text under each book (e.g., "Because you rated Dune 5 stars").
9. Pull-to-refresh recomputes recommendations from current data.

### Edge Cases

- **Fewer than 5 rated books:** Show a prompt "Rate at least 5 books to unlock personalized recommendations" with a CTA to browse library.
- **All TBR books already recommended:** Show "You've read everything we'd suggest! Add more books to your Want to Read shelf."
- **No subjects/tags on books:** Fall back to author affinity only. Genre and similar-book sections show "Tag your books to improve recommendations."
- **Author has no other works on Open Library:** Skip that author in the author affinity section.
- **Open Library API unavailable:** Degrade gracefully to local-only recommendations (TBR books by loved authors already in library).
- **Very large library (1000+ books):** Limit recommendation computation to top 20 authors and top 15 genres. Cache results in `bk_settings`.
- **Module disabled mid-computation:** Engine uses synchronous SQLite queries, no async state to leak.
- **Books with no page count or ratings:** Include in results but rank lower in similarity scoring.
- **Duplicate recommendations across sections:** Deduplicate. Book appears in the highest-priority section only (author > favorites > genre).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User with 5+ rated books sees "Recommended for You" section on the Home tab with at least one recommendation row populated.
- [ ] **AC-2:** Each recommendation card displays the book cover, title, and author.
- [ ] **AC-3:** Tapping a recommendation card navigates to the book detail screen.
- [ ] **AC-4:** "More by Authors You Love" row shows unread books by authors the user rated 4.0+ average.
- [ ] **AC-5:** "Based on Your Favorites" row shows TBR books with subject/tag overlap to 4+ star books.
- [ ] **AC-6:** "Popular in Your Top Genres" row shows TBR books in the user's most-read genres.
- [ ] **AC-7:** Each recommendation includes a reason string (e.g., "More by Andy Weir", "Because you liked Dune").
- [ ] **AC-8:** "See All" link expands each section to a full list view.
- [ ] **AC-9:** Pull-to-refresh on the recommendations screen recomputes results.
- [ ] **AC-10:** User with fewer than 5 rated books sees the insufficient data prompt instead of recommendations.
- [ ] **AC-11:** Open Library author works appear with an "Add to Library" button when network is available.
- [ ] **AC-12:** Recommendations work fully offline using only local library data.

### Technical Criteria
- [ ] **TC-1:** Author affinity algorithm ranks authors by weighted score: `(count * 0.4) + (avgRating * 0.6)`.
- [ ] **TC-2:** Genre affinity weights genres by rating: `genre_score[subject] += rating` for each finished book.
- [ ] **TC-3:** Similar book matching uses Jaccard similarity (shared attributes / total unique attributes) with 0.3 minimum threshold.
- [ ] **TC-4:** Recommendations are deduplicated across sections. A book appears in only the highest-priority section.
- [ ] **TC-5:** Computation completes in under 500ms for a library of 500 books.
- [ ] **TC-6:** Optional Open Library fetch for author works degrades gracefully on network failure.
- [ ] **TC-7:** Results are optionally cached in `bk_settings` with a `computed_at` timestamp. Cache invalidated when a new rating is added or a book is finished.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** No user data (ratings, preferences, reading history) must leave the device. All computation is local.
- [ ] **NC-2:** The recommendation engine must NOT require network connectivity for basic functionality.
- [ ] **NC-3:** Recommendations must NOT include books the user has already finished (status = 'finished').
- [ ] **NC-4:** The engine must NOT break existing discovery engine functionality (`discoverBooks`, `getBookDiscoveryProfile`).

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Section headers: `#F0F0F5` (text token), 18px semibold
- Book cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 120x180px cover
- Module accent: `#C9894D` (books accent) for "See All" links and section indicators
- Reason text: `rgba(240,240,245,0.65)` (textSecondary), 12px italic
- Horizontal scroll rows with snap behavior, 12px gaps between cards
- Insufficient data prompt: centered, glass card, icon + heading + CTA button

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Recommendations accessible via sidebar navigation under Books > Recommendations
- Route: `/books/recommendations`
- Horizontal scroll rows use CSS `overflow-x: auto` with `scroll-snap-type: x mandatory`
- Cards have hover state: slight scale + border glow with accent color

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (3 per row, shimmer animation) | Initial computation |
| Empty | "Rate at least 5 books to unlock personalized recommendations" + CTA | Fewer than 5 rated books |
| Error | "Could not compute recommendations. Pull down to retry." | Engine exception (should not happen with local data) |
| Success | Three recommendation rows with book cards and reason text | 5+ rated books, matches found |
| Partial | Some rows populated, others show "Tag your books to improve recommendations" | Limited metadata on books |

## Test Requirements

### Unit Tests
- [ ] `authorAffinityRanking`: 3 authors with different counts/ratings produces correct weighted ranking
- [ ] `authorAffinityFiltersRead`: books by loved author that are already finished are excluded
- [ ] `genreAffinityWeightsByRating`: genres from 4.5-rated books score higher than 2.0-rated
- [ ] `similarBookJaccard`: books A (subjects ["sci-fi","space","aliens"]) and B (["sci-fi","space","fantasy"]) produce similarity 0.5
- [ ] `similarBookMinThreshold`: similarity 0.2 is excluded (below 0.3)
- [ ] `requiresMinimum5Ratings`: 3 rated books returns `{ insufficientData: true }`
- [ ] `deduplicatesAcrossSections`: same book in author and genre sections appears only in author section
- [ ] `handlesEmptyLibrary`: returns `{ insufficientData: true }` with no books
- [ ] `handlesBooksWithNoSubjects`: still produces author affinity results
- [ ] `cacheInvalidation`: adding a new rating clears the recommendations cache

### Integration Tests
- [ ] Full flow: rate 5 books -> compute recommendations -> verify results contain expected books
- [ ] Offline flow: disable network -> compute recommendations -> verify local-only results returned

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyBooks module
3. Verify: with 0-4 rated books, the insufficient data prompt appears -- corresponds to AC-10
4. Rate 5 books (give 3 books 4+ stars with overlapping genres)
5. Navigate to Home tab
6. Verify: "Recommended for You" section appears with at least one row -- corresponds to AC-1
7. Verify: "More by Authors You Love" shows unread books by the highly-rated author -- corresponds to AC-4
8. Verify: each card shows cover, title, author -- corresponds to AC-2
9. Verify: each card shows a reason string -- corresponds to AC-7
10. Tap a recommendation card
11. Verify: navigates to book detail screen -- corresponds to AC-3
12. Go back, tap "See All" on any section
13. Verify: full list view appears -- corresponds to AC-8
14. Pull-to-refresh on the recommendations screen
15. Verify: results recompute (spinner appears briefly) -- corresponds to AC-9
16. Put device in airplane mode
17. Navigate to recommendations
18. Verify: local-only recommendations still appear -- corresponds to AC-12
19. Open the app on web (localhost:3000)
20. Navigate to Books > Recommendations
21. Verify: same three sections appear with book cards
22. Verify: hover state on cards shows scale + glow effect

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /books/recommendations, click every button, verify all 5 states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the recommendation engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- books standalone is archived, but verify hub module integrity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The books module has a discovery engine (`discoverBooks`, `getBookDiscoveryProfile`) that filters by mood/pace/genre/tags and a stats engine that computes reading statistics. Share events exist but no recommendation system. The SPEC-mybooks.md defines BK-024 with three algorithms (author affinity, genre affinity, similar book matching) but no implementation exists.

### After This Work
A `recommendations/` directory exists in `modules/books/src/` with a complete on-device recommendation engine. Three algorithms produce ranked, deduplicated recommendations with reason strings. Mobile and web UIs display recommendations on the Home tab and a dedicated screen. Optional Open Library integration fetches author works for the author affinity section.

### Files Changed
- `modules/books/src/recommendations/types.ts` -- Recommendation, RecommendationSet, RecommendationSource types
- `modules/books/src/recommendations/engine.ts` -- authorAffinity, genreAffinity, similarBooks, computeRecommendations functions
- `modules/books/src/recommendations/index.ts` -- barrel export
- `modules/books/src/recommendations/__tests__/engine.test.ts` -- 10+ unit tests
- `modules/books/src/index.ts` -- re-export recommendations module
- `apps/mobile/app/(books)/recommendations.tsx` -- mobile recommendations screen
- `apps/web/app/books/recommendations/page.tsx` -- web recommendations page

### Known Limitations
- Recommendations are content-based only (no collaborative filtering since there is no cloud user data). Quality depends on how well users tag/rate their books.
- Open Library author works may include non-book entries (articles, pamphlets). Filtering by type is best-effort.
- No machine learning. The engine uses weighted scoring, which is simpler but less sophisticated than Goodreads' collaborative filtering.

### Context for Next Agent
- The discovery engine at `modules/books/src/discovery/discovery-engine.ts` handles mood/pace/genre filtering and is a sibling feature, not a dependency. Do not modify it.
- The stats engine at `modules/books/src/stats/stats.ts` provides `calculateReadingStats` which returns `topAuthors` -- reuse this for author affinity.
- Book authors are stored as JSON arrays in the `authors` TEXT column. Use `JSON.parse()` with fallback (see `safeParseJSON` in stats.ts).
- The `bk_shelves` system shelf with slug `want-to-read` (id: `shelf-tbr`) identifies TBR books.
- Open Library API endpoints: `/search.json?author=X` for author search, `/authors/{olid}/works.json` for works list. See `modules/books/src/api/open-library.ts` for existing client code.
