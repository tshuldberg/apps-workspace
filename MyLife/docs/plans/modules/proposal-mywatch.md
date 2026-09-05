# Module Proposal: MyWatch

**Status:** Proposal - awaiting founder review
**Module ID candidate:** `watch`
**Table prefix:** `wt_`
**Tier:** Pro (premium)
**Target module number:** #37
**Date:** 2026-04-20
**Demographic pull:** Universal (ages 12-70)

---

## Executive Summary

Letterboxd has 15M users proving people want to track movies privately with ratings and reviews. But there's no unified entertainment tracker that combines movies + TV series + documentaries + podcasts + YouTube channels into one clean interface. Every existing option is either owned by Amazon (Goodreads/IMDb), ad-supported (TV Time), or single-format (Letterboxd = movies only, Podchaser = podcasts only).

MyWatch is your private entertainment journal: what you watched, what you thought, what's next.

**Positioning sentence:** *IMDb rates movies for everyone. MyWatch remembers what they meant to you.*

---

## Why This Module

1. **Letterboxd's 15M users** prove the model works. But Letterboxd is movies only and public-by-default.
2. **TV tracking is broken.** TV Time was the leader, then sold user data and pivoted to advertising. Trakt requires complex setup. Nothing "just works."
3. **Podcast tracking is fragmented.** Apple Podcasts, Spotify, Overcast all track separately. No unified listening journal exists.
4. **"What should we watch tonight?"** is a universal household question with no good private answer. Watchlists scattered across Netflix, Hulu, Max, Disney+, Peacock...
5. **Cross-module:** Mood (entertainment-mood correlation), friends (who recommended what), budget (streaming subscriptions), journal (meaningful films), dining (movie night planning).

---

## Full Feature Set

### Core: Movie Tracker

- **Log movies:** Title, year, director, genre, watched date, where (theater/streaming/home), with whom
- **Rating:** 1-10 scale (or 5-star, configurable)
- **Private review:** Your thoughts, spoiler-marked sections
- **Rewatch tracking:** Multiple viewings with different ratings/notes
- **Theater vs streaming:** Track how you watched
- **Discovery source:** "Recommended by Alex," "Saw trailer," "Film class"
- **Viewing context:** "Date night," "Solo comfort watch," "Family movie night"
- **Mood before/after:** How did this film affect your emotional state?
- **Favorite scenes/quotes:** Note memorable moments
- **Rating categories:** Overall, cinematography, acting, writing, soundtrack (all optional)

### Core: TV Series Tracker

- **Series tracking:** Add shows, track seasons and episodes
- **Status:** Watching, Completed, On Hold, Dropped, Wishlist
- **Episode progress:** Which episodes you've watched per season
- **Season ratings:** Rate each season separately (shows vary in quality)
- **Binge log:** When did you start/finish a season? Track your pace.
- **Episode notes:** Notable episodes, plot summits, favorite moments
- **"Waiting for next season":** Track shows between seasons with release date alerts
- **Rewatch tracking:** Mark series as rewatched with new notes
- **Spoiler protection:** Mark notes as spoiler-sensitive

### Core: Podcast Tracker

- **Subscribe to shows:** Track podcasts you listen to
- **Episode log:** Mark episodes listened, with rating and notes
- **Listening queue:** What's next across all subscriptions
- **Highlights/quotes:** Note memorable segments with timestamp reference
- **Discovery log:** How you found each podcast
- **Host notes:** Private notes about podcast hosts/guests
- **Listening stats:** Hours per week, shows per month, genre breakdown
- **Archive tracking:** Podcast backlogs you're working through
- **Guest tracking:** Notable guests across different shows

### Core: YouTube / Streaming Content

- **Channel following:** Track YouTube channels and creators you watch
- **Video log:** Notable videos worth remembering (not every video, just standouts)
- **Series tracking:** YouTube series/playlists you're following
- **Creator notes:** Private notes about creators you follow
- **Educational content:** Mark learning-focused content separately

### Core: Watchlist / Queue

- **Unified watchlist:** Movies, shows, podcasts, documentaries all in one place
- **Source tracking:** Which streaming service has it (manual entry)
- **Priority queue:** What to watch next, sorted by you
- **Recommendation sources:** Who told you to watch this?
- **Genre mood filter:** "I want something funny" -- filter your watchlist by mood/genre
- **Availability awareness:** "Leaving Netflix in 5 days" (manual note, not automated)
- **Decision helper:** Random pick from watchlist with genre/length filters
- **Group watchlist:** "Things to watch with Sarah" per-person lists

### Advanced: Year-in-Review

- **Annual summary:** Movies watched, shows completed, podcasts consumed, hours spent
- **Monthly breakdown:** Consumption patterns by month
- **Genre diversity:** How varied was your watching?
- **Best of the year:** Your personal top 10 films, top 5 shows, top 5 podcasts
- **Discovery stats:** How you found new content (friends, algorithm, press, self-discovery)
- **Rewatch patterns:** What did you come back to?
- **Theater vs home:** Ratio of theatrical experiences
- **Shareable card:** Beautiful summary image

### Advanced: Collections & Lists

- **Custom lists:** "Best horror films," "Comfort rewatches," "Watch with kids"
- **Director tracking:** Follow filmographies, rate progression
- **Actor tracking:** "Everything with Saoirse Ronan" -- track across films
- **Franchise tracking:** Marvel, Star Wars, Criterion Collection, A24
- **Decade lists:** Best of each decade (personal)
- **Genre deep dives:** "My journey through Korean cinema"

### Advanced: Social (Private-First)

- **Recommendation tracking:** Who recommended what, and was it good?
- **Sharing lists:** Generate a shareable list link for friends
- **Watch-together log:** Track viewing experiences with specific people
- **Gift recommendations:** "Mom would love this show" notes

### Import & Export

- **Letterboxd import:** CSV diary export
- **IMDb import:** Rating CSV export
- **Trakt import:** JSON export
- **Netflix history import:** Activity CSV
- **CSV export:** Full data portability
- **Markdown export:** Human-readable diary format

---

## Data Model

```
wt_movies
  id, title, year, director, genres (json), runtime_minutes,
  imdb_id, tmdb_id, poster_uri,
  status (watched|wishlist), first_watched_at, watch_count,
  rating, review_md, is_favorite,
  discovery_source, watched_with (json),
  venue (theater|streaming|home|flight), streaming_service,
  mood_tag, context_tag, created_at, updated_at

wt_tv_series
  id, title, start_year, end_year, genres (json),
  total_seasons, total_episodes, episode_runtime_minutes,
  status (watching|completed|on_hold|dropped|wishlist),
  current_season, current_episode, overall_rating,
  review_md, is_favorite, discovery_source,
  started_at, completed_at, created_at, updated_at

wt_tv_episodes
  id, series_id, season, episode, title,
  watched_at, rating, notes_md, is_standout, created_at

wt_podcasts
  id, title, host, genre, description,
  status (listening|completed|on_hold|dropped|wishlist),
  episodes_listened, total_episodes (nullable),
  rating, notes_md, discovery_source,
  started_at, created_at, updated_at

wt_podcast_episodes
  id, podcast_id, title, episode_number, listened_at,
  duration_minutes, rating, highlights_md,
  guest_name, created_at

wt_youtube_channels
  id, name, creator, genre, url,
  status (following|archived), notes_md, created_at

wt_watchlist
  id, type (movie|series|podcast|documentary|youtube),
  reference_id (nullable), title, priority,
  recommended_by, streaming_service, genre,
  mood_filter_tags (json), group_list_name,
  added_at, watched_at

wt_lists
  id, name, description, type, items (json),
  is_shareable, share_token, created_at, updated_at

wt_tags
  id, name, color, kind (genre|mood|context|custom)

wt_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | Movie tracker: log, rate, review, rewatch, search | 2-3 |
| P2 | TV series: show tracking, episode progress, season ratings | 2-3 |
| P3 | Watchlist: unified queue, priority, filters, decision helper | 1-2 |
| P4 | Podcasts: subscribe, episode log, highlights, stats | 2 |
| P5 | Collections, custom lists, director/actor tracking | 1-2 |
| P6 | Year-in-review + shareable cards | 1-2 |
| P7 | Import (Letterboxd, IMDb, Netflix, Trakt) + export | 2 |
| P8 | Cross-module integration (mood, friends, budget, journal, dining) | 2 |
| **Total P0-P8** | | **~15-20 weeks** |

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Mood** | Entertainment-mood correlation, comfort watch recommendations on bad days |
| **Friends** | Who recommended what, watching together log, shared lists |
| **Budget** | Streaming subscription tracking (links to Subs module too) |
| **Journal** | "The night we watched X" auto-linked from journal |
| **Dining** | Movie night dinner planning, "dinner and a show" pairing |
| **Music** | Soundtrack recognition, "film scores I loved" |
| **Classes** | Films watched for school, documentary study notes |

---

## Competitor Analysis

| App | What It Does | Why It Falls Short |
|-----|-------------|-------------------|
| Letterboxd | Movie diary + social | Movies only, public-default, no TV/podcasts |
| TV Time | Show tracking | Sold to ad company, privacy nightmare, bloated |
| Trakt | Multi-format tracking | Complex setup, power-user only, requires scrobbler |
| IMDb | Database + ratings | Amazon-owned, public, no personal journal |
| JustWatch | Streaming availability | Discovery tool, not a personal tracker |
| Serializd | Show tracking | Small, web-only, limited |
| Podchaser | Podcast tracking | Podcasts only, social/public, small |
| Reelgood | Streaming aggregator | Discovery, not personal tracking |

**Gap:** No private, unified entertainment tracker across all formats with mood integration and zero ads.

---

## Open Questions (Founder Input Needed)

1. **Module accent color?** Suggestions: Cinema red #DC2626, popcorn gold #F59E0B, screen blue #3B82F6
2. **YouTube inclusion?** Keep or remove? YouTube is huge for Gen Z but logging every video is impractical. Recommend: include but position as "standout videos only."
3. **Movie metadata source?** TMDB API (free, community-maintained) vs OMDB (limited free tier) vs manual. Recommend TMDB.
4. **Letterboxd-style diary format?** Calendar view showing what you watched each day? Recommend yes -- it's the killer feature Letterboxd proved.
5. **Streaming subscription overlap with Subs module?** The Subs module already tracks subscriptions. Should MyWatch also show "which services you're paying for"? Recommend: link to Subs module, don't duplicate.
6. **Social features:** Shareable lists from day one, or defer? Recommend day one -- they're the viral loop ("here's my top 10 films" shared via link).
