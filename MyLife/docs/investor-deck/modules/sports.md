# MySports Module Audit

**ID:** sports | **Prefix:** sp_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Your sports life, together

## User Value
- Live scores across NFL/NBA/MLB/NHL/MLS with a followed-team dashboard
- Team following with tiers (casual/fan/diehard) and rival flags
- Adaptive polling: 30s live, 5m near-kickoff, 1h idle
- Bet tracking, fantasy companion, personal sports play logging
- No ads, no sponsored content, no dark-pattern gambling funnels

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---|---|---|
| Team following CRUD | src/db/crud/teams.ts | shipped (V1) |
| ESPN team search + LRU cache | src/engine/team-search.ts | shipped (P1-A) |
| Games cache CRUD | src/db/crud/games.ts | shipped (V2) |
| ESPN scoreboard fan-out | src/engine/scores.ts | shipped (P1-B) |
| Adaptive polling cadence | src/engine/polling.ts | shipped |
| Scores / Live / Upcoming / Final dashboard | apps/mobile/app/(sports)/index.tsx | shipped |
| Web Scores split (server + client) | apps/web/app/sports/page.tsx + ScoreboardClient.tsx | shipped |
| Notifications log | migrations/v3-notifications-log | shipped |
| Teams tab | app/(sports)/teams.tsx | shipped |
| Betting tab | app/(sports)/betting.tsx | shipped |
| Fantasy tab | app/(sports)/fantasy.tsx | shipped |
| Play (personal participation) tab | app/(sports)/play.tsx | shipped |
| Schedule + standings + history + game + team detail | app/(sports)/* | shipped |

## Data Model
Prefix `sp_`, schema v3. Tables: sp_teams (tier, rival, notif prefs), sp_games (id, league, sport, home/away, scores, start_at, status, period, clock, venue, broadcast), plus notifications log. Additive migrations, indexed on start_at/status/team pair.

## Screens / User Flows
Mobile tabs: Scores, Teams, Betting, Fantasy, Play, Settings. Additional: schedule, standings, history, game detail, team detail. Web route parity at apps/web/app/sports.

## Distinctive / Moat-worthy
- ESPN public scoreboard fan-out with 20s TTL LRU (no paid sports API needed)
- Pure TS + Zod polling engine (zero React deps)
- Bundles scores + betting + fantasy + personal play in one surface, four apps in one

## Gaps vs competitors
- No push notifications for live events yet (schema ready)
- No video highlights or editorial (by design, ESPN's moat)
- Requires network for scores (live data, cached 20s)

## Investor-facing hook
ESPN + Action Network + Yahoo Fantasy in one local-first surface, funded by subscription instead of sportsbook kickbacks.
