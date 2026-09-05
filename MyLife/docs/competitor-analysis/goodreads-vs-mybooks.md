# Goodreads vs MyBooks: Feature Comparison

**Date:** 2026-03-29
**Source:** Screen recording of Goodreads iOS app v4.33.0 (1.8 min walkthrough)
**Screenshots:** `docs/competitor-analysis/goodreads-screens/labeled/`

## Summary

Goodreads is the dominant book tracking platform with 150M+ members, owned by Amazon. Our MyBooks module already matches or exceeds Goodreads in many areas (half-star ratings, reading timer, built-in e-reader, on-device recommendations, privacy, badges, quote collection, encrypted journal). The main gaps are in **onboarding UX**, **book cover scanning** (not just barcode), **rapid-fire rating flow** for recommendation tuning, **discovery/trending content**, and **scanned books history**.

---

## Feature-by-Feature Comparison

| # | Goodreads Feature | MyBooks Has It? | Notes |
|---|---|---|---|
| **FIRST RUN / ONBOARDING** | | | |
| 1 | "What's New" feature announcement splash | NO | Goodreads shows new features (DNF shelf, Discover, Shelves, Rereading) on app open |
| 2 | Welcome onboarding modal ("Welcome to My Books!") | NO | Full-screen green modal with two CTAs: "SEARCH FOR BOOKS" + "SCAN YOUR LIBRARY" |
| 3 | Guided library bootstrapping | NO | Immediately prompts user to populate shelves, not land on empty state |
| **HOME / SOCIAL FEED** | | | |
| 4 | Social activity feed (friend ratings/reviews) | YES | social/feed-engine.ts, Supabase-backed opt-in |
| 5 | Like / Comment on feed items | PARTIAL | Feed exists but need to verify like/comment engagement actions |
| 6 | Promotional/seasonal banners ("Big Books of Spring") | NO | No editorial content, curated seasonal lists, or promotional banners |
| 7 | "Last Updated" timestamp on feed | NO | Minor UX detail showing feed freshness |
| 8 | Search bar on Home with camera + notification badge | PARTIAL | FTS5 search exists, but not top-of-feed persistent search bar |
| **MY BOOKS / LIBRARY** | | | |
| 9 | Shelves: Reading, Want to Read, Read, Did Not Finish | YES | ReadingStatus enum: want_to_read, reading, finished, dnf |
| 10 | Visual progress bar with "UPDATE PROGRESS" | YES | Reading sessions track current_page and progress |
| 11 | Custom tags/shelves creation | YES | Shelves + tags system in bk_shelves |
| 12 | "Search books on your shelves" (local search) | YES | FTS5 search across library |
| 13 | Reading Challenge (annual goal) | YES | Annual goals + year-in-review stats |
| 14 | Kindle Notes & Highlights integration | NO | No Kindle/Amazon integration (by design -- privacy-first) |
| 15 | "Add books from favorite genres" with EDIT | NO | No favorite-genres picker that feeds into recommendations/discovery |
| 16 | Rereading support (multiple read dates) | YES | Multiple reading sessions per book supported |
| **DISCOVER / RECOMMENDATIONS** | | | |
| 17 | Discover tab: editorial content, curated lists | NO | No editorial content layer, seasonal lists, or "Readers' Most Anticipated" |
| 18 | "Trending with Goodreads members" carousel | NO | No community trending data (would require opt-in social aggregate) |
| 19 | "Most read this week" carousel | NO | Same -- requires community aggregate data |
| 20 | Genre exploration with visual cards (6 genres) | NO | No visual genre browsing cards on a discover screen |
| 21 | "EXPLORE ALL GENRES" browser | PARTIAL | Genre data exists in models but no dedicated browse-by-genre screen |
| 22 | Personalized recommendations | YES | recommendations/engine.ts, on-device author/genre affinity |
| 23 | "Rate Books" rapid-fire flow (tune recs) | NO | No swipe/tap-through rating flow to bootstrap recommendation engine |
| 24 | "Top picks for you" section | PARTIAL | Recommendations exist but not prominently surfaced as "Top Picks" |
| **SOCIAL / COMMUNITY** | | | |
| 25 | Profile page (About/Updates tabs) | PARTIAL | Social exists but need to verify profile page with tabs |
| 26 | Share profile button | NO | Sharing cards exist (5 templates) but not profile sharing |
| 27 | Groups (search, join, member count, activity) | PARTIAL | Book clubs exist, but not large-scale searchable groups with member counts |
| 28 | Add Friends flow | YES | Friend connections via share codes |
| 29 | Friends' reading challenge visibility | NO | Cannot see how friends are progressing on their reading challenges |
| 30 | Giveaways | NO | Out of scope for privacy-first app |
| 31 | Choice Awards (annual community voting) | NO | Out of scope -- requires massive user base |
| **SCANNING** | | | |
| 32 | Barcode scanning | YES | Scan screen with camera |
| 33 | Book COVER recognition (not just barcode) | NO | Goodreads recognizes book covers visually, not just barcodes. Identified "Sorrow and Bliss" from cover photo. |
| 34 | "Scanned Books" tab (scan history) | NO | No history of previously scanned books. Scan is fire-and-forget. |
| 35 | Flash/torch toggle on scanner | NO | Same gap as nutrition module -- no flash control |
| 36 | Inline result card after scan (cover + rating + status + "Rate this book") | PARTIAL | Scan probably navigates to book detail, but Goodreads shows inline result card |
| **RATINGS & REVIEWS** | | | |
| 37 | Star ratings | YES | Half-star ratings (exceeds Goodreads whole-star only) |
| 38 | Written reviews | YES | Reviews with encrypted journal option |
| 39 | Community ratings display ("4.07 . 124,736 ratings") | PARTIAL | Open Library data available but may not show rating count inline |
| **SETTINGS** | | | |
| 40 | Account settings | YES | Settings screen exists |
| 41 | Help / Support | PARTIAL | No dedicated in-app help |
| 42 | Ads Policy / Privacy links | N/A | We have no ads -- privacy advantage |

---

## Where MyBooks EXCEEDS Goodreads

| Feature | MyBooks | Goodreads |
|---------|---------|-----------|
| Half-star ratings | Yes (0.5 increments) | No (whole stars only) |
| Reading timer / sessions | Built-in session timer with speed stats | No timer at all |
| Built-in e-reader | ePub + PDF reader | No reader (links to Kindle) |
| On-device recommendations | Author/genre affinity, zero cloud | Requires 150M user data + Amazon ML |
| Privacy | Zero telemetry, 100% local by default | Amazon-owned, tracks everything, shows ads |
| Encrypted journal | AES-encrypted reading reflections | No journal feature |
| Badge system | 31 badges across 9 categories | No badges (recently added achievements for challenges only) |
| Quote collection | FTS search, favorites, random surfacing | Massive library but community-driven, not personal |
| Reading insights | Speed patterns, peak hours, genre evolution, "On This Day" | Basic "Year in Books" summary only |
| Stats sharing cards | 5 shareable templates (year, monthly, genre, authors, streak) | Basic sharing |
| DNF with reason | dnf_reason field for why you stopped | Just added DNF shelf, no reason tracking |
| Content warnings | Can add per-book (via community challenges) | No content warnings |
| Offline-first | Everything works offline | Requires network for most features |

---

## Priority Gaps to Close

### P0 -- High Impact, Should Have

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 1 | **Books onboarding wizard** | First-run experience is empty state. Goodreads immediately prompts "Search for Books" or "Scan Your Library." Users who see an empty library on first open have high churn. | Small |
| 2 | **Book cover scanning** | Goodreads scans covers AND barcodes. Many books on a shelf have spines visible, not barcodes. Cover recognition via on-device ML (Apple Vision framework) dramatically speeds up library population. This is a "scan your entire bookshelf" feature. | Large |
| 3 | **Rapid-fire "Rate Books" flow** | Goodreads shows large cover cards with star rating, swipe to next. This bootstraps the recommendation engine. Without it, recs are cold-start until users manually rate many books. | Medium |
| 4 | **Favorite genres picker** | Goodreads puts "ADD BOOKS FROM FAVORITE GENRES" on the My Books tab. This is a lightweight onboarding signal that improves first-session recommendations. | Small |
| 5 | **Flash toggle on scanner** | Same gap found in nutrition. Low-light scanning needs torch control. | Small |

### P1 -- Nice to Have

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 6 | **Scanned Books history tab** | Goodreads keeps a "Scanned Books (1)" tab showing previous scans. Useful for bookstore trips where you scan many books to review later. | Small |
| 7 | **Genre browsing with visual cards** | Discover screen with genre cards (Classics, Romance, Fantasy, etc.) for browsing. More engaging than a flat search. | Small |
| 8 | **Friends' challenge visibility** | "Your friends' 2026 Challenge" -- see how friends are doing on their reading goals. Social motivation. | Medium |
| 9 | **"What's New" feature announcements** | Show new features on first open after update. Low-effort engagement and feature discovery. | Small |
| 10 | **Inline scan result card** | After scanning, show book result inline with cover, rating count, status dropdown, and "Rate this book" -- without navigating away from the scanner. Enables rapid multi-book scanning. | Medium |
| 11 | **Community rating counts** | Show "4.07 . 124,736 ratings" on book cards. Social proof helps with book selection. | Small |

### P2 -- Consider Later

| # | Feature | Why | Effort |
|---|---------|-----|--------|
| 12 | **Curated/trending lists** | "Trending with members" and "Most read this week" require opt-in social aggregate data. Interesting but complex privacy-preserving implementation. | Large |
| 13 | **Seasonal editorial content** | "Big Books of Spring" banners. Requires editorial pipeline or automated list generation. | Medium |
| 14 | **Groups (beyond clubs)** | Large-scale searchable discussion groups with thousands of members. Clubs cover small-group reading. | Large |
| 15 | **Profile sharing** | Shareable profile link/page. Stats sharing cards partially cover this need. | Medium |

### Out of Scope (By Design)

| Feature | Reason |
|---------|--------|
| Kindle integration | Privacy-first; no Amazon dependency |
| Giveaways | Requires publisher partnerships + cloud infrastructure |
| Choice Awards | Requires massive user base for meaningful voting |
| Advertising | Zero-ad model is our competitive advantage |
| Account required | We work fully offline; no mandatory sign-up |

---

## Screenshot Reference

All labeled screenshots are in:
```
docs/competitor-analysis/goodreads-screens/labeled/
├── 01-whats-new/     (1 image)
├── 02-home-feed/     (3 images)
├── 03-my-books/      (4 images)
├── 04-discover/      (1 image)
├── 05-search-more/   (1 image)
├── 06-profile/       (1 image)
├── 07-groups/        (1 image)
├── 08-recommendations/ (2 images)
├── 09-reading-challenges/ (1 image)
├── 10-scan-books/    (3 images)
└── 11-settings/      (1 image)
```
