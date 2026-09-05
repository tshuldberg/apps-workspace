# MyFilms - Feature Gap Design Doc
**Source:** Competitive Feature Analysis (2026-03-05)
**Status:** New Module (not yet built)

## Rationale

MyFilms is ranked #8 highest-impact module for MyLife. Letterboxd has 15M+ users and charges $19-49/yr for premium features. The module follows the same "item tracking" pattern as MyBooks (search, log, rate, review, stats, year-in-review), making implementation efficient since much of the UI component infrastructure and data patterns can be reused. This is a lightweight module with high user engagement potential and a well-understood feature set.

## Competitors Analyzed

| Competitor | Pricing | Notable Issues |
|-----------|---------|----------------|
| Letterboxd | $19-49/yr (15M+ users) | Requires cloud account, social features are core to the experience |

## Recommended MVP Features

| Feature | Priority | Competitors That Have It | Implementation Difficulty | Notes |
|---------|----------|--------------------------|--------------------------|-------|
| Film logging (watched/want to watch) | P0 | Letterboxd | Low | Mark films as watched with date |
| Watchlist | P0 | Letterboxd | Low | Queue of films to watch |
| Half-star ratings (0.5-5.0) | P0 | Letterboxd | Low | Reuse MyBooks rating component directly |
| Reviews/notes | P0 | Letterboxd | Low | Write personal reviews and thoughts on each film |
| Film search (TMDb API) | P0 | Letterboxd | Low | Search by title using The Movie Database API (free, open) |
| Custom lists | P0 | Letterboxd | Low | Create themed lists (Best Horror, 2024 Favorites, etc.) |

## Full Feature Roadmap

### P1 - Post-MVP Core

| Feature | Competitors That Have It | Implementation Difficulty | Notes |
|---------|--------------------------|--------------------------|-------|
| Year-in-review stats | Letterboxd | Low | Reuse MyBooks year-in-review pattern (most watched genre, highest rated, total films) |
| Diary/calendar view | Letterboxd | Low | Calendar showing which films were watched on which dates |
| Genre/decade/director stats | Letterboxd | Low | Viewing statistics broken down by category |
| Where to stream finder | Letterboxd, JustWatch | Low | Show which streaming services have the film (JustWatch API) |
| Film import (Letterboxd CSV, IMDb) | Letterboxd | Low | Import existing film logs from other platforms |
| Tag-based organization | Letterboxd | Low | Custom tags for personal categorization |

### P2 - Advanced Features

| Feature | Competitors That Have It | Implementation Difficulty | Notes |
|---------|--------------------------|--------------------------|-------|
| Barcode/poster scanning | None | Medium | Scan DVD/Blu-ray barcode to log film |
| TV show tracking | None (Trakt/TV Time territory) | Medium | Track episodes watched, seasons, progress |
| Social feed (opt-in) | Letterboxd | Medium | See friends' watches and ratings |
| Film recommendations | Letterboxd | Medium | "If you liked X" based on local ratings data |
| Director/actor filmography view | Letterboxd | Low | Browse by filmmaker, track how much of their work you have seen |
| Challenges/goals | None | Low | "Watch 100 films this year" with progress tracking |

### P3 - Long-Term

| Feature | Competitors That Have It | Implementation Difficulty | Notes |
|---------|--------------------------|--------------------------|-------|
| Popular/trending lists | Letterboxd | Medium | Requires some form of aggregated data |

## Privacy Competitive Advantage

Letterboxd is relatively privacy-friendly compared to many competitors but still requires a cloud account. All viewing data, ratings, and reviews are stored on Letterboxd's servers. Your complete cross-platform viewing history is centralized in one place.

MyFilms keeps all viewing data entirely local. No streaming service learns your complete viewing history across platforms. No third party sees your ratings, reviews, or watchlist. Film metadata is fetched from TMDb (a free, open API) without transmitting personal viewing data. Your film diary is yours alone.

## Cross-Module Integration

| Module | Integration |
|--------|------------|
| **MyBooks** | Shared "media tracking" pattern and UI components (rating widget, year-in-review, import/export, stats engine) |
| **MyMood** | Correlate film watching patterns with mood entries |
| **MyBudget** | Entertainment spending tracking (theater tickets, streaming subscriptions, physical media) |
| **MyHabits** | Film watching as a habit or goal (e.g., "watch one classic film per week") |
| **MyJournal** | Film reflection entries, link journal entries to specific films |
| **MyRSVP** | Movie night event planning, group watchlist coordination |
