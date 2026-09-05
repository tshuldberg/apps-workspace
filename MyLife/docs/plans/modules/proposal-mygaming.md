# Module Proposal: MyGaming

**Status:** Proposal - awaiting founder review
**Module ID candidate:** `gaming`
**Table prefix:** `gm_`
**Tier:** Pro (premium)
**Target module number:** #33
**Date:** 2026-04-20
**Demographic pull:** Ages 10-18 (strongest), extends to 35+

---

## Executive Summary

Gaming is the dominant activity for ages 10-18 (4.5 hrs/day average screen time, majority gaming). 380M Roblox users, 204M Minecraft MAU, 60M Fortnite DAU. No privacy-first game tracking app exists that combines library management, play sessions, achievement tracking, and backlog management without feeding data to Steam, Xbox, or PlayStation's advertising pipelines.

**Positioning sentence:** *Steam knows what you bought. MyGaming remembers what you played, why you loved it, and what's next.*

---

## Why This Module

1. **Largest youth activity by time spent.** Gaming eclipses social media for ages 10-16.
2. **No privacy-first tracker exists.** Steam profiles are public-by-default. Console achievement systems are platform-locked. Backloggd is niche and web-only.
3. **$200B/yr industry.** Teens spend more on games than any other entertainment category.
4. **Cross-module heavy.** Budget (game spending), friends (who you play with), mood (gaming mood correlation), habits (screen time goals).
5. **The "Goodreads for games" gap.** Goodreads has 150M users tracking books. No equivalent exists for the larger gaming market.
6. **Nostalgia tracking.** "What was I playing at age 12?" is a question people desperately want answered but have no record of.

---

## Full Feature Set

### Core: Game Library

- **Add games:** Title, platform(s), genre, release year, developer, publisher
- **Status tracking:** Playing, Completed, On Hold, Dropped, Backlog, Wishlist, 100%'d
- **Platform tagging:** PC, PlayStation, Xbox, Nintendo Switch, Mobile, VR, Retro
- **Multi-platform ownership:** Own same game on PC + Switch? Track both.
- **Physical vs digital:** Track format, with physical collection location
- **Purchase tracking:** Price paid, where bought, date, on sale? gifted?
- **DLC/expansion tracking:** Track base game + all DLC separately
- **Edition tracking:** Standard, Deluxe, Collector's, GOTY
- **Franchise grouping:** All Zelda games together, all Souls games together
- **Custom collections:** "Cozy games," "Competitive," "Play with partner," "Childhood favorites"

### Core: Play Sessions

- **Session logging:** Game, start time, duration, platform, notes
- **Manual or timer-based:** Start a timer when you play, or log after the fact
- **Progress notes:** "Beat Chapter 3," "Hit level 40," "Found the secret area"
- **Companion tracking:** Who you played with (links to MyFriends)
- **Mood before/after:** How did gaming affect your mood? (links to Mood module)
- **Screenshot attachment:** Save memorable moments with photos/screenshots
- **Weekly/monthly play time breakdown:** See where your time went
- **Streak tracking:** "Played X days in a row" (optional, non-punishing)
- **Session quality rating:** Was this session fun? Grinding? Frustrating? Flow state?

### Core: Ratings & Reviews

- **Game rating:** 1-10 scale
- **Sub-ratings:** Gameplay, Story, Graphics, Sound, Replayability
- **Private reviews:** Markdown notes. Your thoughts, not a public review.
- **Spoiler-safe notes:** Mark sections as spoiler for your own reference
- **Completion notes:** "Beat in 47 hours on Hard mode," "Platinum trophy obtained"
- **Comparison tags:** "Better than X but worse than Y" -- private ranking
- **Play-it-again probability:** Would you replay this in 5 years? 10 years?

### Core: Achievement/Trophy Tracking

- **Manual achievement log:** Track notable achievements/trophies you're proud of
- **Completion percentage:** Self-reported % completion per game
- **Challenge runs:** Track self-imposed challenges ("No-hit run," "Pacifist," "Speedrun")
- **Personal bests:** Speedrun times, high scores, rankings
- **Milestone tracking:** "First platinum," "100th game completed," "1000 hours in one game"
- **Trophy/achievement screenshots:** Attach proof photos

### Core: Backlog Management

- **Backlog queue:** Priority-ordered list of "play next"
- **Estimated time to beat:** Manual entry (reference HowLongToBeat data if desired)
- **Backlog stats:** Total estimated hours remaining, games by priority
- **"Random pick" feature:** Can't decide? Random selection from backlog with filters
- **Backlog health:** Ratio of backlog growth vs completion rate
- **Guilt-free dropping:** Explicitly mark games as "dropped, no guilt" -- normalize not finishing everything
- **Seasonal planning:** "This summer I want to play these 5 games"

### Core: Wishlist & Deals

- **Game wishlist:** Games you want to buy
- **Platform preference:** Which platform would you buy it on?
- **Price threshold:** "Buy if under $20" -- personal price target
- **Release tracking:** Upcoming games with expected release dates
- **Hype level:** Rate anticipation 1-5 for upcoming releases
- **Deal logging:** Track sales you noticed (manual entry, not price scraping)
- **Gift wishlist:** Shareable subset for birthdays/holidays (opt-in share link)

### Advanced: Social Gaming

- **Gaming friends list:** Who you play with regularly (private, links to MyFriends)
- **Co-op compatibility:** "Games both me and Alex own" helper
- **Play-together log:** Sessions tagged with who joined
- **Recommendation sharing:** "You should play X" private notes per friend
- **Gaming groups:** Track your regular groups (Friday night Minecraft crew, etc.)
- **Challenge friends:** Private challenges between friends (who beats X first?)

### Advanced: Year-in-Review

- **Annual summary:** Games played, completed, hours spent, favorite genres
- **Monthly breakdown:** Gaming patterns across the year
- **Genre evolution:** How your taste changed over time
- **Platform split:** Where you spent your gaming time
- **Completion rate:** Finished vs dropped vs abandoned
- **Top 10 of the year:** Your personal GOTY ranking
- **All-time stats:** Cumulative since you started tracking
- **Shareable card:** Beautiful summary image, generated locally

### Advanced: Retro & Collection

- **Retro game library:** Track childhood games, even without playing them now
- **Physical collection:** Cartridges, discs, boxes, manuals, condition grading
- **Console collection:** Track hardware owned (current + retro)
- **Setup photos:** Document your gaming setup evolution
- **Nostalgia timeline:** "Games that defined each year of my life"
- **Emulation log:** Track what you've replayed via emulation (no judgment)

### Advanced: Streaming & Content

- **Stream log:** Track your own streams (date, game, platform, viewers, highlights)
- **Content creation:** Videos made, guides written, clips captured
- **Viewer milestones:** Track your growth as a creator if applicable
- **VOD archive references:** Link to your saved streams

### Settings & Privacy

- **Completely private by default.** No profiles, no public pages, no social graph.
- **Offline-first.** Works without internet.
- **Export:** Full JSON/CSV export at any time
- **Import:** Steam library CSV, PSN trophy list (manual), Xbox achievements (manual)
- **No telemetry.** We never report what you play to anyone.
- **Screen time awareness:** Optional gentle alerts, never punishing or guilt-inducing
- **Parental note:** If under 13, no data leaves device. Ever.

---

## Data Model

```
gm_games
  id, title, platform (json array), genre (json), developer, publisher,
  release_year, format (digital|physical), edition, franchise,
  status (playing|completed|on_hold|dropped|backlog|wishlist|100_percent),
  rating, gameplay_rating, story_rating, graphics_rating, sound_rating,
  replayability_rating, review_md, completion_percent, completion_notes,
  hours_played, started_at, completed_at, dropped_at,
  cover_photo_id, purchase_price_cents, purchase_source, purchase_date,
  collection_ids (json), is_favorite, created_at, updated_at

gm_sessions
  id, game_id, started_at, duration_minutes, platform, notes_md,
  companion_ids (json), mood_before, mood_after, quality_rating,
  progress_notes, screenshot_ids (json), created_at

gm_achievements
  id, game_id, name, description, achieved_at, difficulty,
  screenshot_id, notes_md, is_proud_of, created_at

gm_challenges
  id, game_id, name, description_md, type (speedrun|no_hit|pacifist|custom),
  personal_best, goal, status (active|completed|abandoned),
  attempts, started_at, completed_at, notes_md, created_at

gm_wishlist
  id, game_id (nullable), title, platform_preference, price_threshold_cents,
  release_date, hype_level, is_gift_list, notes, created_at, updated_at

gm_collections
  id, name, description, icon, color, game_ids (json),
  sort_order, created_at

gm_friends
  id, display_name, gamertags (json: {platform: tag}),
  games_in_common (json), notes, friend_id (-> MyFriends module),
  created_at

gm_hardware
  id, name, type (console|pc|peripheral|controller|vr),
  brand, model, purchase_date, purchase_price_cents,
  condition, notes_md, photo_id, is_active, created_at

gm_photos
  id, game_id, session_id, achievement_id, kind (screenshot|setup|collection|hardware),
  local_uri, caption, taken_at, created_at

gm_tags
  id, name, color, kind (genre|context|platform|custom)

gm_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | Game library: add, status, platform, ratings, reviews | 2-3 |
| P2 | Play sessions: timer, logging, companions, progress notes | 2 |
| P3 | Backlog management: queue, random pick, planning, dropping | 1-2 |
| P4 | Wishlist + deals: price targets, release tracking, gift list | 1-2 |
| P5 | Achievements + challenges: manual tracking, personal bests | 1-2 |
| P6 | Year-in-review + taste evolution + stats | 2 |
| P7 | Social gaming: friends, co-op compatibility, group tracking | 1-2 |
| P8 | Physical collection + retro + hardware log | 1-2 |
| P9 | Cross-module integration (budget, friends, mood, habits) | 2 |
| **Total P0-P9** | | **~16-20 weeks** |

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Budget** | Game spending category, monthly gaming budget tracking |
| **Friends** | Who you play with, gaming groups, co-op buddies |
| **Mood** | Pre/post-session mood tracking, gaming-mood correlation |
| **Habits** | Screen time goals, daily gaming habit, play-every-day streaks |
| **Flash** | Game trivia decks, speedrun strat memorization |
| **Journal** | "The night we finally beat the raid" as journal entries |
| **Notes** | Game guides, personal walkthroughs, strategy notes |
| **Calendar** | Release dates synced, gaming sessions visible |

---

## Business Flywheel (Future Consideration)

### Indie Game Analytics (Year 3+)

Indie game studios pay $50-200K/yr for player analytics (Amplitude, GameAnalytics, Unity Analytics). These tools spy on players without consent.

**Inverted model:** MyGaming users who opt-in to share anonymized play data with specific indie studios they want to support. The studio gets real engagement data (session length, completion rate, where players drop off). The player controls exactly what's shared and with whom.

- Players get: direct influence on games they love, potential early access, recognition
- Studios get: honest engagement data without building surveillance into their game
- MyLife gets: modest fee per data relationship ($5-10/mo per studio)

This is speculative and far-future. The consumer module stands alone without it.

---

## Competitor Analysis

| Competitor | What It Does | What It Misses |
|-----------|-------------|----------------|
| Steam | PC game library + achievements | Public profiles, PC-only, no play journaling |
| Backloggd | Game tracking (Letterboxd-style) | Web-only, public, no sessions, small community |
| HowLongToBeat | Game length database | No personal tracking, no privacy |
| GG (gg.deals) | Price tracking | Deal-focused only, no personal library |
| Playnite | PC game library launcher | Desktop-only, no mobile, no journaling |
| Xbox/PSN profiles | Achievement tracking | Platform-locked, public, no cross-platform |

**None combine:** multi-platform library + private sessions + achievements + backlog + wishlist + collection + privacy.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Game metadata entry is tedious | High | Smart search with auto-complete, barcode scan for physical, import from platform exports |
| Teens won't manually track sessions | Medium | Optional timer mode, weekly "what did you play?" prompt, habit-light approach |
| Platform APIs change/restrict exports | Medium | Manual entry always works as fallback |
| "Just use Steam" objection | Medium | Steam is PC-only and public. We're private, cross-platform, and richer. |
| Screen time tracking feels surveillance-y | Medium | Frame as self-awareness tool, never punishing, no parental reporting |

---

## Open Questions (Founder Input Needed)

1. **Module accent color?** Suggestions: Gaming green #10B981, electric purple #8B5CF6, neon blue #06B6D4
2. **Timer approach?** Active timer (start/stop) vs passive logging (add after the fact) vs both? Recommend both with passive as default.
3. **Game database?** Option A: Fully manual entry. Option B: Include a local game title database for autocomplete (bundled, ~50K titles, no network). Recommend B for UX.
4. **Screen time framing?** Purely neutral tracking, or include optional "goals" (play less, play more, play different)? Recommend neutral -- teens get enough judgment about screen time.
5. **Minimum age consideration?** COPPA requires parental consent under 13. Since all data is local and never leaves device, this may not apply. Legal review needed.
6. **Console/platform integration depth?** Option A: Manual only. Option B: Accept exported CSVs from PlayStation/Xbox/Steam. Recommend B for import, A for ongoing tracking.
