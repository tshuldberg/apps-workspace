# Module Proposal: MyMusic

**Status:** Proposal - awaiting founder review
**Module ID candidate:** `music`
**Table prefix:** `mu_`
**Tier:** Pro (premium)
**Target module number:** #32
**Date:** 2026-04-20
**Demographic pull:** Ages 10-25 (strongest), universal appeal

---

## Executive Summary

Music is the #1 identity signal for people aged 10-25. No privacy-first alternative exists that combines listening logs, concert tracking, vinyl collections, album ratings, and discovery without feeding everything to Spotify's recommendation algorithm or Last.fm's public profiles. MyMusic owns the user's relationship to sound the way MyDining owns their relationship to food.

**Positioning sentence:** *Spotify knows what you listen to. MyMusic remembers what it meant to you.*

---

## Why This Module

1. **Strongest youth magnet.** Teens define themselves by music taste more than any other signal. A module that tracks and visualizes their evolving taste is deeply personal.
2. **Spotify Wrapped proved the demand.** 200M+ people share Wrapped each December. They WANT to see their data as identity. But Wrapped is Spotify's marketing, not the user's record.
3. **No privacy-first option exists.** Last.fm is public-by-default. Spotify profiles are public. Apple Music has no tracking export. RateYourMusic is web-only and niche.
4. **Concert market is $35B/yr.** Teens are the most active concertgoers. Tracking shows, setlists, and memories is a massive unmet need.
5. **Cross-module integration is extraordinary.** Music touches mood, budget, trails (venues), RSVP (concerts with friends), journal, and friends.
6. **Business flywheel.** Indie venues and artists pay 25-35% to Ticketmaster/Live Nation. A venue SaaS at 3% + $49/mo using MyLife's audience as free diner acquisition = same Resy structural wedge.

---

## Target Demographic

| Age | Hook |
|-----|------|
| 10-14 | First music obsessions, concert wishlists, artist posters-as-identity |
| 15-18 | Concert attendance ramps up, vinyl collecting begins, taste becomes social currency |
| 19-25 | Peak concert spending, music discovery as lifestyle, nostalgic tracking of taste evolution |
| 25-40 | Concert memories, vinyl collections, "what was I listening to when..." nostalgia |
| 40+ | Legacy music collections, concert bucket lists, sharing taste with kids |

---

## Full Feature Set

### Core: Listening Log

- **Manual logging:** Add what you're listening to (album, artist, date, context)
- **Bulk import:** Import listening history from Spotify (GDPR export), Apple Music (export), Last.fm (CSV)
- **Rating system:** 1-10 scale for albums, optional half-stars
- **Private reviews:** Markdown notes per album. Not public. Not shared unless you choose.
- **First-listen vs revisit tracking:** Know when you discovered something vs when you came back to it
- **Context tags:** "Road trip," "Working out," "Late night," "Breakup," "Discovery" -- what were you doing when this hit?
- **Mood tagging:** Link to mood module -- how did this make you feel?
- **Play count tracking:** Manual increment or imported. See your most-played over any time period.
- **Discovery source tracking:** "Found via: friend, algorithm, radio, movie, TikTok, live show, sample"

### Core: Album & Song Management

- **Album database:** Artist, album, year, genre, label, format (vinyl, CD, digital, cassette)
- **Song-level tracking:** Favorite tracks within albums, skip-worthy tracks
- **Genre exploration:** Personal genre map showing what you listen to and how it's evolved
- **Decade view:** Your listening broken down by release decade
- **New release radar:** Manual queue of upcoming albums you're watching for (no algorithmic recommendation -- YOU decide what you're anticipating)
- **Re-release tracking:** Deluxe editions, remasters, anniversary pressings

### Core: Concert Tracker

- **Past concerts:** Venue, date, artist(s), setlist, photos, who you went with, rating
- **Setlist logging:** Songs played, order, encores, special guests, covers
- **Upcoming concerts:** Calendar integration, ticket price paid, seat/section
- **Concert wishlist:** Artists you'd see if they came to your city
- **Venue ratings:** Sound quality, sightlines, accessibility, vibe, drink prices
- **Festival tracker:** Multi-day festivals with per-day breakdown
- **Concert companions:** Who you went with (links to MyFriends module)
- **Photo journal:** Attach photos/videos to concerts, auto-organize by date
- **Ticket stub archive:** Photo of physical tickets, digital ticket screenshots
- **Cost tracking:** Ticket price, fees, merch, drinks, parking, travel -- total cost per show
- **Live recordings:** Note if you recorded audio/video, link to files
- **Post-show notes:** "The guitarist switched to a Les Paul for the encore," "Met the bassist after the show"

### Core: Physical Collection

- **Vinyl tracker:** Album, pressing info (year, label, color, limited edition, numbered)
- **Condition grading:** Mint, Near Mint, VG+, VG, Good, Fair, Poor (Goldmine standard)
- **Purchase history:** Where bought, price paid, date
- **Wishlist:** Pressings you're hunting for
- **Value tracking:** Optional Discogs price reference (manual entry, no scraping)
- **Storage location:** "Shelf 3, Row 2" or "In storage unit"
- **CD/Cassette/8-track:** Not vinyl-only -- any physical format
- **Equipment log:** Turntable, speakers, cartridge, amp -- your setup
- **Listening room photos:** Document your setup evolution over time

### Core: Taste Evolution

- **Timeline view:** See what you were listening to in any month/year of your life
- **Taste phases:** Name periods of your life by their soundtrack ("Summer 2024: shoegaze era")
- **Genre drift chart:** Visual showing how your genre balance shifted over years
- **Artist loyalty map:** Who you've returned to most over time vs one-listen-and-done
- **Decade comparison:** What you listened to at 14 vs 16 vs 18 vs 22
- **Seasonal patterns:** Do you listen to different music in winter vs summer?
- **Influence web:** "Discovered Band B because of Band A" -- trace your discovery paths

### Advanced: Social (Private-First)

- **Shareable taste cards:** Generate a beautiful card of your top 5/10/25 albums for any period. Share as image or link.
- **Recommendation lists:** Curate private lists for specific friends ("Jazz for Alex," "Running playlist for Sam")
- **Listening together log:** Track who introduced you to what artist
- **Group concert planning:** "Who wants to see X when they come to town?" (links to RSVP)
- **Music memory sharing:** Share a specific album memory with a friend (opt-in, not broadcast)

### Advanced: Year-in-Review

- **Annual summary:** Top albums, artists, genres, concerts, discoveries
- **Monthly breakdown:** "January was all post-punk, February pivoted to ambient"
- **Stats:** Total albums logged, concerts attended, money spent, hours listened (estimated)
- **Photo collage:** Auto-generated from concert photos
- **Shareable card:** Beautiful summary image, generated locally, share anywhere
- **Multi-year trends:** See your evolution across 3, 5, 10 years

### Advanced: Discovery & Queues

- **To-listen queue:** Albums people recommended, things you saw mentioned, stuff you want to get to
- **Discovery journal:** Where you found each new artist/album and why you checked it out
- **Sample tracking:** "This song samples X from Y album" -- trace the lineage
- **Soundtrack log:** "Heard in movie/show/game X" -- link entertainment to music discovery
- **Music DNA:** Your personal genre fingerprint based on actual listening, not algorithmic inference

### Settings & Privacy

- **Default privacy:** Everything private. Nothing shared without explicit action.
- **Export:** Full data export in JSON, CSV, or Markdown at any time
- **Import sources:** Spotify GDPR, Apple Music export, Last.fm CSV, Discogs CSV, manual
- **EXIF strip on concert photos:** Optional location removal
- **No network requirement:** Works entirely offline. Sync only if user opts into future cloud backup.
- **No listening telemetry:** We never phone home about what you listen to.

---

## Data Model

```
mu_artists
  id, name, genres (json), origin_country, formed_year,
  photo_id, notes_md, is_favorite, created_at, updated_at

mu_albums
  id, artist_id, title, release_year, genre, label, format,
  track_count, runtime_minutes, rating (1-10), review_md,
  first_listened_at, listen_count, is_favorite, cover_photo_id,
  discovery_source, context_tags (json), created_at, updated_at

mu_songs
  id, album_id, title, track_number, duration_seconds,
  rating, is_favorite, is_skip, notes_md, created_at

mu_listens
  id, album_id, song_id (nullable), listened_at, context,
  mood_tag, companion_ids (json), notes_md, created_at

mu_concerts
  id, venue_id, date, artist_ids (json), headliner_id,
  support_acts (json), overall_rating, sound_rating,
  vibe_rating, setlist_id, ticket_price_cents, total_cost_cents,
  section, seat, companion_ids (json), notes_md,
  photo_ids (json), festival_id (nullable), created_at, updated_at

mu_setlists
  id, concert_id, songs (json array of {title, is_encore, is_cover, cover_of, notes})

mu_venues
  id, name, city, address, lat, lng, capacity, type,
  sound_rating, sightline_rating, vibe_rating, accessibility_notes,
  notes_md, photo_id, website_url, created_at, updated_at

mu_collection
  id, album_id, format (vinyl|cd|cassette|8track|minidisc),
  pressing_year, label, color, edition_notes, condition,
  purchase_price_cents, purchase_source, purchase_date,
  storage_location, notes_md, photo_id, created_at

mu_wishlist
  id, type (album|concert|vinyl|artist_live), reference_id,
  priority, notes, target_price_cents, notify_enabled,
  created_at, updated_at

mu_taste_phases
  id, name, start_date, end_date, description_md,
  primary_genres (json), key_albums (json), created_at

mu_photos
  id, concert_id, album_id, kind (concert|setup|ticket|cover|merch),
  local_uri, caption, taken_at, exif_stripped, created_at

mu_tags
  id, name, color, kind (genre|context|mood|custom)

mu_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | Album + artist management, listening log, ratings, reviews | 2-3 |
| P2 | Concert tracker: past shows, setlists, venues, photos | 2-3 |
| P3 | Physical collection: vinyl/CD tracking, condition, wishlist | 1-2 |
| P4 | Taste evolution: timeline, genre drift, phases, influence web | 2-3 |
| P5 | Import: Spotify GDPR, Apple Music, Last.fm, Discogs CSV parsers | 2-3 |
| P6 | Year-in-review + shareable cards + discovery journal | 2 |
| P7 | Cross-module integration (mood, budget, friends, RSVP, trails, journal) | 2-3 |
| P8 | Advanced: social sharing, concert planning, equipment log | 2 |
| **Total P0-P7** | | **~15-18 weeks** |

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Mood** | "What was I listening to on my best/worst days?" correlation view |
| **Budget** | Concert spending category, vinyl/merch purchase tracking |
| **Friends** | Who introduced you to what, concert companions, shared playlists |
| **RSVP** | Group concert planning, festival coordination |
| **Trails** | Venues visited on trips, festival locations on map |
| **Journal** | "The night I saw X live" as journal entries auto-linked |
| **Dining** | Pre/post-show restaurants, "dinner before the concert" planning |
| **Habits** | Daily listening habit, practice instrument streaks |
| **Calendar** | Concert dates synced to system calendar |

---

## Business Flywheel (The Resy Pattern)

### Why Ticketmaster/Live Nation can't compete on our terms

- Live Nation's debt service requires 25-35% fees on every ticket
- Ticketmaster's exclusive venue contracts prevent price competition
- Neither can offer "fan owns their data" because selling fan data to artists/labels is a revenue stream
- Their tech is built for 50,000-seat arenas, not 200-cap indie venues

### The MyLife Venue/Artist SaaS (Year 2-3)

| Feature | MyLife | Ticketmaster | Eventbrite |
|---------|--------|--------------|------------|
| Fee | 3% + $49/mo | 25-35% | 3.7% + $1.79/ticket |
| Venue size | 50-2,000 cap | 5,000+ (core) | Any |
| Fan data | Fan owns it | Platform sells it | Platform owns it |
| Discovery | Built-in MyLife audience | SEO/partnerships | SEO |
| Mission | PBC-locked pricing | Public company (LYV) | Public company |

**The structural wedge:** Every MyLife user tracking concerts in MyMusic is a free discovery channel for venues on the platform. No standalone ticketing startup can replicate having 1M+ music-obsessed users already logging their taste and wishlists.

---

## Competitor Analysis

| Competitor | What It Does | What It Misses |
|-----------|-------------|----------------|
| Last.fm | Scrobbling (auto-listening tracking) | Public-only, no concerts, no collection, dying platform |
| RateYourMusic | Album ratings database | Web-only, no mobile, public profiles, no concerts |
| Discogs | Physical collection + marketplace | Collector-focused, no listening log, no concerts |
| Setlist.fm | Concert setlist crowdsource | Web-first, no personal tracking, no collection |
| Album of the Year | Aggregated reviews/ratings | No personal tracking, no privacy |
| Letterboxd (for music) | Doesn't exist yet | This is the gap |
| Spotify Wrapped | Annual summary | Once per year, Spotify-only, marketing not personal |

**None of these combine:** listening log + concerts + collection + taste evolution + privacy + cross-module integration.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Spotify/Apple could build this themselves | Medium | They won't -- showing competitor streaming data conflicts with their walled garden. We're platform-agnostic. |
| Import parsers break when Spotify/Apple change export formats | Low | Versioned parsers, GDPR exports are standardized |
| Concert data entry is tedious | Medium | Smart defaults, venue auto-suggest, setlist community imports (future) |
| Module perceived as "too niche" | Low | Music is universal. 80%+ of humans listen daily. |
| Legal risk from showing any price/ticket data | Low | We only track what the user paid (their own purchases), not live pricing |

---

## Open Questions (Founder Input Needed)

1. **Module accent color?** Suggestions: Deep purple #7C3AED (music/creative), electric blue #2563EB (vinyl/audio), or warm gold #D97706 (record label warm)
2. **Streaming integration depth?** Option A: Import-only (GDPR export, then done). Option B: Optional live scrobbling via user-provided API keys. Recommend A for launch.
3. **Social features at launch?** Include shareable cards from P0, or wait until P8? Recommend shareable cards early -- they're the viral loop.
4. **Venue/Artist SaaS timeline?** Same Year 2 as Restaurant SaaS, or Year 3? Recommend Year 2.5 -- reuse 80% of the Restaurant SaaS architecture.
5. **Free vs Pro?** Recommend Pro, consistent with other lifestyle modules. BUT: consider making listening log + 10 album limit free as teen acquisition hook.
6. **Concert photo handling?** Same encrypted local pattern as Journal/Dining, or lighter-weight (unencrypted local)?
