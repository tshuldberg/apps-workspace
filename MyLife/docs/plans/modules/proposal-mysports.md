# Module Proposal: MySports

**Status:** Proposal - awaiting founder review
**Module ID candidate:** `sports`
**Table prefix:** `sp_`
**Tier:** Pro (premium)
**Target module number:** #36
**Date:** 2026-04-20
**Demographic pull:** Ages 10-65 (universal), strongest 12-35

---

## Executive Summary

Yahoo Sports is a cluttered advertising billboard with scores buried under sponsored content. ESPN is a cable company wearing a mobile skin. The Score got acquired by DraftKings and is now a gambling funnel. Every major sports app optimizes for ad impressions and betting conversion, not for fans who just want to follow their teams cleanly.

MySports is the anti-clutter sports hub: live scores, betting odds tracking, team following, personal sports participation, fantasy companion, and sports memories -- without a single ad, sponsored post, or dark-pattern gambling push.

**Positioning sentence:** *ESPN shows you what advertisers want you to see. MySports shows you what you actually care about.*

---

## Why This Module

1. **Every major sports app is an ad/gambling delivery vehicle.** Yahoo Sports, ESPN, The Score, Bleacher Report, CBS Sports -- all monetize attention, not utility.
2. **800M+ people worldwide follow sports daily.** This is one of the largest addressable audiences.
3. **60%+ of US teens play organized sports.** Personal participation tracking is an unserved adjacent need.
4. **Fantasy sports is a $30B/yr market.** A companion tool (not a platform) for tracking your fantasy teams across platforms is needed.
5. **Sports betting is a $100B/yr market.** Privacy-first bet tracking (without the gambling company owning your history) is unique.
6. **Cross-module heavy.** Budget (betting/tickets), friends (who you watch with), mood (team performance correlation), health/workouts (personal sports).

---

## Full Feature Set

### Core: Live Scores & Standings

- **Real-time scores:** All major leagues: NFL, NBA, MLB, NHL, MLS, Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, NCAA (football + basketball), UFC/MMA, F1, NASCAR, tennis (ATP/WTA/Grand Slams), golf (PGA), boxing
- **Clean scoreboard:** Score, time/period, key stats. NO ads. NO sponsored content. NO "trending" distractions.
- **Score notifications:** Push alerts for your teams only. Game start, end, close game, overtime. Configurable per team.
- **Live game tracker:** Period-by-period or play-by-play summary. Minimal, clean, no bloat.
- **Standings:** League standings, conference/division, playoff picture. Updated in real-time.
- **Schedule view:** Your teams' upcoming games in a clean calendar
- **Scores history:** Past game results, searchable by date
- **Multi-sport dashboard:** See all your teams' live/upcoming games in one view. Zero clutter.

### Core: Team Following

- **Follow teams:** Select your teams across all sports. One-tap follow.
- **Priority tiers:** Die-hard (never miss), casual (check scores), occasional (playoffs only)
- **Notification control per team:** Granular: start, end, close games, injuries, trades, milestones
- **Team pages:** Schedule, roster, stats, standings -- just the facts
- **Rivalry tracking:** Flag rival teams for schadenfreude alerts (optional, fun)
- **Season record tracking:** Your teams' W-L records all in one view
- **"My Sports Day" view:** Everything happening today relevant to YOUR teams. Nothing else.

### Core: Betting Odds Tracker

- **Odds display:** Moneyline, spread, over/under for all games
- **Line movement tracking:** See how odds move from open to game time
- **Odds comparison:** View odds across sportsbooks (FanDuel, DraftKings, BetMGM, Caesars, PointsBet)
- **Bet logger:** Track YOUR bets privately. What you bet, where, odds taken, result.
- **Parlay builder:** Build and track parlay bets with calculated payouts
- **Bankroll tracker:** Starting bankroll, current balance, ROI, units won/lost
- **Bet history:** Full history with filters (sport, type, book, W/L, date range)
- **Performance analytics:** Win rate by sport, by bet type (ML/spread/total/prop), by league
- **Unit tracking:** Standard unit-based tracking for responsible bankroll management
- **Prop bet tracking:** Player props, game props, futures, specials
- **Futures tracker:** Season-long bets (championship, MVP, etc.) with current odds update
- **NO gambling features:** We don't place bets, process money, or connect to sportsbooks. This is a JOURNAL of your betting activity, not a betting platform.
- **Responsible gambling tools:** Self-set limits, loss alerts, cool-down period suggestions (non-judgmental)

### Core: Fantasy Sports Companion

- **Multi-platform tracking:** Track teams across ESPN, Yahoo, Sleeper, NFL.com, CBS
- **Team roster journal:** Log your roster, trades, waiver pickups, drops
- **Matchup tracking:** Weekly matchup results and notes
- **Draft log:** Who you drafted, when, what pick, notes on strategy
- **Season record:** W-L, points for/against, standings
- **Trade journal:** Trades proposed, accepted, rejected -- and your reasoning
- **Waiver wire notes:** Players you're watching, claims you placed
- **Multi-league support:** Track 5, 10, 20 fantasy leagues across platforms
- **Performance notes:** "Should have started X over Y" -- learn from your decisions
- **Commissioner notes:** For league managers, track rule changes and disputes

### Core: Personal Sports Participation

- **Play logger:** Track YOUR participation: basketball pickup games, tennis matches, golf rounds, runs, bike rides
- **Team/league tracking:** Rec league schedule, roster, standings
- **Personal stats:** Points scored, goals, assists -- whatever matters for your sport
- **Season records:** Your team's record if you play organized sports
- **Training log:** Practice sessions, drills, skills worked on (links to Workouts module)
- **Equipment tracker:** Gear used, wear/replacement dates, cost
- **Injury log:** Injuries sustained, recovery timeline, return-to-play (links to Health module)
- **Personal bests:** Fastest mile, longest drive, highest score, most goals in a game
- **Game day journal:** Pre-game, during, post-game notes and feelings
- **Teammate profiles:** Who you play with (links to Friends module)

### Advanced: Events & Experiences

- **Game attendance log:** Games you went to in person: venue, seats, companions, photos
- **Venue tracker:** Stadiums/arenas visited, ratings, bucket list
- **Stadium bucket list:** Every NFL stadium, every MLB park, Premier League grounds
- **Watch party log:** Where you watched the game, who was there
- **Tailgate notes:** What you ate, what you brought, where you parked
- **Memorabilia tracker:** Signed items, game-used, tickets, cards, jerseys
- **Sports trip planning:** "Going to see Arsenal in London" (links to Travel/Trails)

### Advanced: Stats & Insights

- **Player favorites:** Track players across teams and leagues
- **Stat lookup:** Quick access to player/team stats (via deep-link to reference sites)
- **Historical tracking:** "My team's record every year since I started following them"
- **Playoff bracket tracker:** NCAA March Madness, NFL playoffs, World Cup brackets -- private predictions
- **Award predictions:** MVP, Rookie of Year, Champion -- log your pre-season picks and check accuracy
- **Sports calendar:** Major events, draft dates, free agency, trade deadlines

### Advanced: Year-in-Review

- **Annual sports summary:** Teams followed, games attended, bets placed, fantasy results
- **Best moments:** Mark your top sports moments of the year
- **Attendance map:** Venues visited this year
- **Betting recap:** Full P&L, best/worst bets, ROI by sport
- **Fantasy recap:** Best/worst fantasy seasons, notable trades
- **Personal sports recap:** Games played, stats, improvement

### Settings & Privacy

- **All personal data local.** Bets, fantasy, notes, memories -- device-only.
- **Scores from public APIs.** Real-time scores via free/open sports data APIs.
- **Odds from public sources.** Displayed for information, not for placing bets.
- **No gambling company partnerships.** We don't take money from DraftKings, FanDuel, etc.
- **No bet placement.** This is a journal, not a sportsbook.
- **Notification control:** Granular per-team, per-sport. YOU decide what interrupts you.
- **Export:** Full bet history, attendance log, fantasy records -- your data, your format.

---

## Data Model

```
sp_teams
  id, name, league, sport, conference, division,
  logo_url, primary_color, secondary_color,
  follow_tier (diehard|casual|occasional),
  notify_start, notify_end, notify_close, notify_trades,
  is_rival, notes_md, created_at, updated_at

sp_games
  id, sport, league, home_team, away_team,
  start_at, status (scheduled|live|final),
  home_score, away_score, period, game_clock,
  venue, broadcast, notes_md,
  attended (bool), attendance_notes,
  created_at, updated_at

sp_bets
  id, game_id (nullable), sport, league,
  bet_type (moneyline|spread|total|prop|parlay|future),
  description, sportsbook, odds_taken, odds_format (american|decimal|fractional),
  stake_cents, potential_payout_cents, units,
  result (pending|won|lost|push|void),
  profit_loss_cents, settled_at,
  legs (json for parlays), notes_md,
  created_at, updated_at

sp_bankroll
  id, name (default|separate per book), starting_cents,
  current_cents, total_wagered_cents, total_won_cents,
  unit_size_cents, roi_percent,
  created_at, updated_at

sp_fantasy_leagues
  id, platform (espn|yahoo|sleeper|nfl|cbs|custom),
  sport, league_name, season, format (redraft|dynasty|keeper|bestball),
  team_name, roster (json), record_wins, record_losses, record_ties,
  points_for, points_against, standings_position,
  buy_in_cents, prize_cents, notes_md,
  created_at, updated_at

sp_fantasy_transactions
  id, league_id, type (draft|trade|waiver_add|waiver_drop|fa_add),
  players_in (json), players_out (json), description,
  reasoning_md, happened_at, created_at

sp_participation_sessions
  id, sport, activity (game|practice|pickup|training),
  date, duration_minutes, location, teammates (json),
  stats (json), personal_best, mood_before, mood_after,
  injury_notes, notes_md, photo_ids (json), created_at

sp_rec_leagues
  id, sport, league_name, team_name, season,
  schedule (json), roster (json),
  record_wins, record_losses, record_ties,
  notes_md, created_at, updated_at

sp_attendance
  id, game_id, venue, section, row, seat,
  companion_ids (json), cost_cents, photo_ids (json),
  tailgate_notes, parking_notes, rating,
  notes_md, created_at

sp_memorabilia
  id, type (card|jersey|signed|ticket|ball|other),
  description, sport, team, player,
  purchase_price_cents, estimated_value_cents,
  photo_id, notes_md, created_at

sp_venues
  id, name, city, sport, team, capacity,
  visited (bool), visit_date, rating, notes_md,
  bucket_list (bool), photo_id, lat, lng, created_at

sp_brackets
  id, tournament, year, predictions (json),
  actual_results (json), score, notes_md, created_at

sp_photos
  id, attendance_id, session_id, memorabilia_id,
  local_uri, caption, taken_at, created_at

sp_settings
  key, value
```

---

## Phase Plan

| Phase | Scope | Weeks |
|-------|-------|-------|
| P0 | Foundation: scaffold, schema, definition, empty hub screens | 1-2 |
| P1 | Team following + live scores + standings + clean dashboard | 3-4 |
| P2 | Schedule + notifications + game tracker | 2 |
| P3 | Betting odds display + bet logger + bankroll tracker | 3-4 |
| P4 | Fantasy companion: multi-platform tracking, draft log, transactions | 2-3 |
| P5 | Personal sports: play logger, rec leagues, stats, personal bests | 2-3 |
| P6 | Events: attendance log, venues, memorabilia, watch parties | 2 |
| P7 | Year-in-review + brackets + predictions + insights | 2 |
| P8 | Cross-module integration (budget, friends, mood, workouts, health, trails) | 2 |
| **Total P0-P8** | | **~20-26 weeks** |

---

## Score Data Architecture

### How we get live scores without building ESPN

**Option A: Open/Free APIs (recommended for launch)**
- ESPN public endpoints (unofficial but widely used, no auth required)
- TheSportsDB (free tier: 30 req/min)
- API-Sports (free tier: 100 req/day, paid: $20/mo unlimited)
- football-data.org (free for non-commercial, Premier League + others)
- NHL/MLB/NBA all have public stat feeds

**Option B: Paid aggregator (scale)**
- Sportradar ($500+/mo, official data partner of most leagues)
- Stats Perform (enterprise pricing)

**Recommendation:** Start with free APIs for P1. Cache aggressively (30-second TTL for live games, 1-hour for standings). No real-time websocket needed at launch -- polling every 30s during live games is sufficient and keeps costs at zero. If we hit scale (100K+ active sports users), negotiate Sportradar deal.

**Odds data:**
- The Odds API (free: 500 req/mo, $20/mo for 10K req)
- Odds from public sportsbook pages (manual curation, not scraping)

---

## Cross-Module Integration Map

| Module | Integration |
|--------|-------------|
| **Budget** | Ticket spending, betting P&L, fantasy buy-ins, memorabilia costs |
| **Friends** | Who you watch with, game attendance companions, rec league teammates |
| **Mood** | Team performance correlation ("My mood tanks when the Jets lose") |
| **Workouts** | Personal sports training, game-day warmups |
| **Health** | Sports injury tracking, recovery timeline |
| **Trails** | Sports venue mapping, road trips to away games |
| **Dining** | Pre/post-game meals, tailgate food tracking |
| **Calendar** | Game schedule, fantasy draft dates, season milestones |
| **Music** | Walk-up songs, stadium playlists (fun cross-reference) |

---

## Business Flywheel (Future)

### Coach/Club SaaS (Year 3+)

**Incumbent:** TeamSnap ($13-25/mo per team), LeagueApps ($1-3/player/mo)

**The wedge:**
- $9/mo per team (vs TeamSnap's $13-25)
- Built-in player profiles from MyLife (with player consent)
- Scheduling, roster management, stat tracking, parent communication
- Payment collection for dues/equipment
- Privacy: coach sees only what the player/parent shares

This is a natural extension but Year 3+ at earliest. The consumer module stands alone.

---

## Competitor Analysis

| App | What It Does | What's Wrong With It |
|-----|-------------|---------------------|
| **Yahoo Sports** | Scores, news, fantasy | CLUTTERED. Ads everywhere. Sponsored content mixed with scores. Betting push. |
| **ESPN** | Scores, news, streaming | Cable company skin. Disney ad machine. Bloated app, 500MB+. |
| **The Score** | Scores, betting | Acquired by DraftKings. Now a gambling funnel. |
| **Bleacher Report** | News, highlights | More entertainment than utility. Clickbait headlines. |
| **CBS Sports** | Scores, fantasy | Ad-supported, dated UX, Paramount+ upsell. |
| **FanDuel/DraftKings** | Betting + scores | The scores are the hook for the gambling. |
| **Sofascore** | Live scores (soccer focus) | Closest to clean UX, but still ad-supported, no betting tracking, no personal sports |
| **TeamSnap** | Team management | For coaches/parents, not fans. No scores, no betting, no fantasy. |
| **Apple Sports** | Scores | Clean but extremely limited. No betting, no fantasy, no personal tracking, no journal. |

**The gap:** No app combines clean scores + betting journal + fantasy companion + personal sports + memories + zero ads. Every existing option is either an ad delivery vehicle, a gambling funnel, or too limited.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Free sports APIs get rate-limited or shut down | High | Multiple sources, aggressive caching, paid API as scale backup |
| Gambling tracking could attract regulatory scrutiny | Medium | We don't place bets or process money. This is a journal, same as a spreadsheet. Disclaim clearly. |
| League IP concerns (logos, team names) | Medium | Use official public data; link to official sources for logos; don't host copyrighted images |
| Real-time score latency | Medium | 30-second polling is acceptable for 99% of users. Not building a live ticker. |
| Module scope creep (this is huge) | High | Phase strictly. P0-P2 is the MVP (scores + following). Everything else is gravy. |
| Competing with Apple Sports (free, clean) | Medium | Apple Sports has no betting, no fantasy, no personal sports, no memories, no journal. We go deeper. |

---

## Open Questions (Founder Input Needed)

1. **Module accent color?** Suggestions: Stadium green #16A34A, championship gold #EAB308, midnight blue #1E3A5F
2. **Which sports at launch?** Recommend: NFL, NBA, MLB, NHL, Premier League, MLS, NCAA FB/BB, UFC. Add others in P2+.
3. **Betting odds at launch or deferred?** High demand but also high sensitivity. Recommend P3 (after core scores ship).
4. **Free or Pro?** Scores could be free (acquisition hook). Betting + fantasy + personal sports = Pro. Recommend hybrid: free scores, Pro for everything else.
5. **Score data source?** Start free (ESPN public API + TheSportsDB) or pay from day one (API-Sports $20/mo)? Recommend free to start.
6. **Gambling responsibility features?** How prominent? Recommend: present but not preachy. Self-set limits, never judgmental, always private.
7. **Fantasy platform integration?** Deep-link to ESPN/Yahoo/Sleeper for actual management, or try to pull data via their APIs? Recommend: manual logging + deep-link out. Don't depend on their APIs.
8. **Social features?** Watch party planning, group predictions, league chat? Recommend: defer to P9+. Keep it personal first.
