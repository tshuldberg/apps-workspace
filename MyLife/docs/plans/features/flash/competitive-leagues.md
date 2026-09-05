# Feature Spec: Competitive Leagues

## Metadata
- **Module:** flash
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 2 x3 + Complexity 0 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 6+ (B+C Features)
- **Estimated CC Time:** 6-8 hours
- **Depends On:** Streak tracking (A-tier, implemented), Hub auth system (for user identity)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Quizlet's competitive leagues (called "Streaks Leaderboards" and "Class Progress") are one of its highest-engagement features: students compete weekly on study activity, driving consistent daily usage. Gamification through competition dramatically improves retention: Duolingo's leagues increased 7-day retention by 17% (per their S-1 filing). MyFlash currently tracks individual streaks and milestones but has no social dimension. Users study in isolation. Adding competitive leagues transforms MyFlash from a solo tool into a social learning platform where friends, classmates, or strangers compete on study effort. This is the single most impactful feature for daily active user retention and is critical for subscription justification: users who compete weekly are far less likely to cancel.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Quizlet | Yes | Free (basic) / $35.99/yr (advanced stats) | Weekly leaderboards by XP earned. Divisions (Bronze to Diamond). Class-level competitions. |
| Duolingo | Yes | Free | Weekly leagues with 30 players, promotion/demotion tiers (Bronze to Diamond, 10 tiers). XP-based ranking. Streak freezes for premium. |
| Anki | No | N/A | No social features whatsoever. Pure solo tool. |
| Brainscape | Partial | $79.99/yr | Class leaderboards for teacher-created content. No global competition. |

### Target User
Students studying with friends or classmates who want accountability and motivation through friendly competition. Language learners who respond to Duolingo-style gamification. Self-directed learners who need external motivation to maintain consistency. Study groups preparing for the same exam (MCAT, bar exam, NCLEX) who want to see each other's progress.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/leagues/types.ts                   -- League, LeagueMember, LeagueScore types
modules/flash/src/leagues/engine.ts                  -- Scoring rules, tier promotion/demotion logic
modules/flash/src/leagues/tiers.ts                   -- Tier definitions (Bronze to Diamond)
modules/flash/src/leagues/index.ts                   -- Barrel export
modules/flash/src/leagues/__tests__/                 -- Tests
modules/flash/src/db/leagues.ts                      -- SQLite CRUD for local league data + sync cache
modules/flash/src/db/schema.ts                       -- V4 migration: fl_leagues, fl_league_members, fl_league_scores
modules/flash/src/definition.ts                      -- Add V4 migration
packages/db/src/sync/league-sync.ts                  -- Supabase real-time sync for league data
supabase/migrations/YYYYMMDD_flash_leagues.sql       -- Cloud schema for league state
apps/mobile/app/(flash)/leagues.tsx                  -- League leaderboard screen
apps/mobile/app/(flash)/components/LeagueCard.tsx    -- League card for dashboard/study tab
apps/mobile/app/(flash)/components/TierBadge.tsx     -- Tier badge component
apps/web/app/flash/leagues/page.tsx                  -- Web league page
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Study tab -> League Card (shows current rank + tier)
            └── leagues.tsx (full leaderboard) <- YOU ARE HERE
```

Also:
```
Stats tab -> "Leagues" section showing tier badge and season history
```

### Data Model

**Local SQLite tables** (cache for offline viewing + local activity tracking):

```sql
-- V4 migration: competitive leagues
CREATE TABLE IF NOT EXISTS fl_leagues (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  season_start TEXT NOT NULL,
  season_end TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  max_members INTEGER NOT NULL DEFAULT 30,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fl_league_members (
  id TEXT PRIMARY KEY NOT NULL,
  league_id TEXT NOT NULL REFERENCES fl_leagues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_self INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fl_league_scores (
  id TEXT PRIMARY KEY NOT NULL,
  league_id TEXT NOT NULL REFERENCES fl_leagues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS fl_leagues_active_idx ON fl_leagues(is_active, season_start DESC);
CREATE INDEX IF NOT EXISTS fl_league_members_league_idx ON fl_league_members(league_id, user_id);
CREATE INDEX IF NOT EXISTS fl_league_scores_league_idx ON fl_league_scores(league_id, week_start, xp_earned DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fl_league_scores_unique_idx ON fl_league_scores(league_id, user_id, week_start);
```

**Cloud schema** (Supabase, source of truth for league state):

```sql
-- supabase/migrations/YYYYMMDD_flash_leagues.sql
CREATE TABLE flash_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL DEFAULT 'bronze',
  season_start TIMESTAMPTZ NOT NULL,
  season_end TIMESTAMPTZ NOT NULL,
  max_members INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE flash_league_members (
  league_id UUID NOT NULL REFERENCES flash_leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id)
);

CREATE TABLE flash_league_scores (
  league_id UUID NOT NULL REFERENCES flash_leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id, week_start)
);

-- RLS: users can read all members/scores in their league, write only their own scores
ALTER TABLE flash_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_league_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_own_leagues" ON flash_leagues
  FOR SELECT USING (id IN (SELECT league_id FROM flash_league_members WHERE user_id = auth.uid()));

CREATE POLICY "read_league_members" ON flash_league_members
  FOR SELECT USING (league_id IN (SELECT league_id FROM flash_league_members WHERE user_id = auth.uid()));

CREATE POLICY "update_own_scores" ON flash_league_scores
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "read_league_scores" ON flash_league_scores
  FOR SELECT USING (league_id IN (SELECT league_id FROM flash_league_members WHERE user_id = auth.uid()));
```

### Dependencies
- **Internal:** `@mylife/flash` (streak system, review log for XP calculation), `@mylife/auth` (user identity for league membership), `@mylife/db` (SQLite + Supabase sync), `@mylife/ui` (Cool Obsidian tokens)
- **External:** Supabase (real-time subscriptions for live leaderboard updates), Supabase Auth (user identity)
- **Cross-Module:** Forums module (future): league chat channel. Hub auth: required for user identity.

## Functional Requirements

### User Stories
1. As a student, I want to join a weekly league and compete on study activity so that I stay motivated to study every day.
2. As a competitive learner, I want to see my rank on a leaderboard relative to other users so that I can push myself to study more.
3. As a consistent studier, I want to be promoted to higher tiers over time so that I compete with equally dedicated people.
4. As a social learner, I want to create a private league and invite friends so that we can compete together for an exam.
5. As a casual user, I want leagues to be optional so that I don't feel pressured if I prefer solo study.

### Behavior Specification

**Joining a league:**
1. User navigates to Study tab, sees "Join a League" CTA card (if not in a league)
2. User taps "Join a League"
3. System creates/finds an open league in the user's tier (Bronze for first-timers)
4. User is added to the league (max 30 members per league, Duolingo-style)
5. Leaderboard appears showing all members with current week's XP

**XP scoring system:**
- Each card reviewed: +10 XP
- Each card rated "Good" or "Easy": +5 XP bonus
- Daily streak maintained: +50 XP
- Practice test completed: +100 XP (flat bonus, not per question)
- Match game completed: +25 XP
- Multiple choice session completed: +25 XP
- XP is calculated locally from review logs and study activity, then synced to Supabase

**Weekly cycle:**
1. Leagues run Monday 00:00 UTC to Sunday 23:59 UTC
2. Scores reset every Monday
3. At week end, top 5 in each league are promoted to the next tier
4. Bottom 5 are demoted to the previous tier (Bronze cannot demote)
5. Everyone else stays in their current tier
6. Users are reassigned to new league groups in their tier each week

**Tier system:**
| Tier | Color | Promote Top | Demote Bottom | Icon |
|------|-------|-------------|---------------|------|
| Bronze | `#CD7F32` | Top 5 -> Silver | N/A (floor) | Bronze shield |
| Silver | `#C0C0C0` | Top 5 -> Gold | Bottom 5 -> Bronze | Silver shield |
| Gold | `#FFD700` | Top 5 -> Platinum | Bottom 5 -> Silver | Gold shield |
| Platinum | `#E5E4E2` | Top 5 -> Diamond | Bottom 5 -> Gold | Platinum shield |
| Diamond | `#B9F2FF` | N/A (ceiling) | Bottom 5 -> Platinum | Diamond shield |

**Private leagues:**
1. User taps "Create Private League" from the leagues screen
2. User enters league name and optionally sets an invite-only flag
3. System generates a 6-character invite code
4. User shares the code with friends
5. Friends enter the code to join
6. Private leagues follow the same weekly cycle but do not promote/demote (everyone stays in the private league)
7. Private leagues have no member cap (but max 100 for performance)

**Leaderboard display:**
1. Shows all members ranked by weekly XP (descending)
2. Current user's row is highlighted with accent color
3. Each row shows: rank #, avatar, display name, XP earned, cards reviewed, streak badge
4. Promotion zone (top 5) has a green background tint
5. Demotion zone (bottom 5) has a red background tint
6. Updates in real-time via Supabase Realtime subscriptions

### Edge Cases

- **User opts out of leagues:** Leagues are entirely optional. Study tab shows the "Join" CTA but never forces participation. Opting out removes the user from their current league at end of week.
- **User joins mid-week:** They start with 0 XP. They cannot be promoted that week (need a full week) but can be demoted.
- **League has fewer than 30 members:** Smaller leagues still function. Promotion/demotion thresholds scale: promote top ceil(N/6), demote bottom ceil(N/6).
- **User goes offline for the week:** Their XP stays at whatever was last synced. They can be demoted due to inactivity. Local XP accumulates and syncs when back online.
- **User studies without auth (offline mode):** XP is tracked locally. When auth is available, sync pending XP to Supabase.
- **Network failure during score sync:** Queue XP updates locally. Sync when connection restores. Use `updated_at` timestamps to resolve conflicts (latest wins).
- **User changes display name:** Updated via `@mylife/auth`. Syncs to `flash_league_members` on next score update.
- **Private league creator leaves:** League persists. Any member can share the invite code.
- **Week boundary during active study session:** XP earned during the session is attributed to the week the review occurred in, not the session start time.
- **Module disabled while in a league:** User is marked inactive for the week. They can be demoted. Re-enabling places them back in their tier.
- **Cheating prevention:** XP is derived from `fl_review_logs` timestamps. Reviewing the same card 100 times in 1 minute does not earn 100x XP (cap: max 10 XP per card per day). Practice test XP caps at 3 tests per day.

### Data Integrity Rules
- XP is always calculated from source data (review logs, test completions), never from user input
- The Supabase cloud schema is the source of truth for league membership and rankings
- Local SQLite is a read cache that enables offline leaderboard viewing
- Score conflicts resolved by `updated_at` (last write wins)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Study tab shows "Join a League" CTA card when user is not in a league
- [ ] **AC-2:** Tapping "Join" places the user in a Bronze league with up to 30 members
- [ ] **AC-3:** Leaderboard shows all members ranked by weekly XP, with the current user highlighted
- [ ] **AC-4:** Each leaderboard row shows rank, avatar, name, XP, cards reviewed, streak badge
- [ ] **AC-5:** Promotion zone (top 5) has a green tint, demotion zone (bottom 5) has a red tint
- [ ] **AC-6:** After completing a review, the leaderboard XP updates within 5 seconds
- [ ] **AC-7:** At end of week, promoted users see a celebration screen: "Promoted to [Tier]!"
- [ ] **AC-8:** At end of week, demoted users see a motivational screen: "Keep studying to stay in [Tier]!"
- [ ] **AC-9:** "Create Private League" generates an invite code and shareable link
- [ ] **AC-10:** Entering a valid invite code joins the private league
- [ ] **AC-11:** Leagues are optional; users can leave at any time

### Technical Criteria
- [ ] **TC-1:** XP calculation: cards reviewed x10, good/easy bonus +5, streak +50/day, tests +100, MC/match +25
- [ ] **TC-2:** Local XP syncs to Supabase within 30 seconds of a review session ending
- [ ] **TC-3:** Supabase Realtime subscription updates leaderboard without manual refresh
- [ ] **TC-4:** Promotion/demotion runs at week boundary (Monday 00:00 UTC)
- [ ] **TC-5:** RLS policies prevent users from reading/writing other users' scores
- [ ] **TC-6:** V4 migration creates local cache tables; Supabase migration creates cloud tables
- [ ] **TC-7:** Anti-cheat: max 10 XP per card per day, max 3 practice test bonuses per day

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** League participation must NOT be required for any Flash feature
- [ ] **NC-2:** XP from leagues must NOT affect SRS scheduling (ease, intervals)
- [ ] **NC-3:** User's actual card content must NOT be visible to other league members
- [ ] **NC-4:** Demotion must NOT delete user data or study progress
- [ ] **NC-5:** Private league invite codes must NOT be guessable (use crypto-random)
- [ ] **NC-6:** League scores must NOT be manually editable (derived from review log data only)

## UI Specification

### Mobile (Expo)

**League Card (Study tab)**
- Glass card with current tier badge (left), "Week 3 of Diamond" text, current rank "#4 of 28"
- XP bar: progress toward top-5 (promotion) or bottom-5 (demotion) threshold
- Tapping opens the full leaderboard

**Leaderboard Screen (full-screen)**
- Background: `#0A0A0F` (background token)
- Header: league tier badge + season dates + "Week ending [date]"
- My position: sticky card at top showing own rank, XP, trend arrow (up/down/same vs last week)
- Leaderboard list:
  - Promotion zone (top 5): `rgba(48, 209, 88, 0.08)` background tint
  - Neutral zone: standard glass cards
  - Demotion zone (bottom 5): `rgba(255, 69, 58, 0.08)` background tint
  - Each row: rank medal (gold/silver/bronze for top 3), avatar (32px circle), display name, XP (bold), cards reviewed (dimmer), streak fire icon + count
- Current user row: `#FBBF24` left border, slightly brighter background

**Tier Badge Component**
- Shield shape, tier color fill, tier name text
- Sizes: small (16px, for inline), medium (32px, for cards), large (64px, for celebration)

**Promotion/Demotion Screen (modal on week end)**
- Full-screen modal with animation
- Promotion: confetti particles, tier badge scaling up, "Promoted to Gold!" text
- Demotion: subdued animation, encouragement text, "You'll get it next week!"

### Web (Next.js)

- Same design tokens via CSS variables
- Leaderboard: table layout with sortable columns
- Route: `/flash/leagues` (leaderboard + join/create), `/flash/leagues/:id` (specific league)
- Private league: share modal with invite code + copy button

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Not Joined | "Join a League" CTA card | No active league membership |
| Loading | Skeleton leaderboard | Fetching league data from Supabase |
| Active | Live leaderboard with rankings | Data loaded, subscription active |
| Offline | Cached leaderboard with "Last updated" timestamp | No network |
| Week End | Promotion/demotion modal | Weekly boundary reached |
| Private | Leaderboard with invite code visible | In a private league |

## Test Requirements

### Unit Tests
- [ ] `calculateXP(reviewLogs)`: 10 XP per review, +5 for good/easy
- [ ] `calculateXP(reviewLogs)`: caps at 10 XP per card per day
- [ ] `calculateXP(reviewLogs)`: streak bonus +50 per day maintained
- [ ] `calculateXP([])`: returns 0
- [ ] `determinePromotion(league, scores)`: top 5 promoted
- [ ] `determinePromotion(league, scores)`: bottom 5 demoted (not in Bronze)
- [ ] `determinePromotion(bronzeLeague, scores)`: bottom 5 stay in Bronze
- [ ] `determinePromotion(smallLeague, scores)`: scales thresholds for < 30 members
- [ ] `generateInviteCode()`: returns 6-character alphanumeric string
- [ ] `generateInviteCode()`: two calls produce different codes
- [ ] `getTierDefinition('gold')`: returns correct color, icon, thresholds
- [ ] V4 migration: local tables created
- [ ] Supabase migration: cloud tables created with correct RLS

### Integration Tests
- [ ] Full flow: join league -> review cards -> XP updates on leaderboard
- [ ] Private flow: create league -> get code -> second user joins with code -> both visible
- [ ] Week-end flow: simulate week end -> promotion/demotion applied correctly
- [ ] Offline flow: review cards offline -> reconnect -> XP syncs to leaderboard

### QA Verification Script

1. Open the app on iOS simulator (with Supabase running and auth configured)
2. Navigate to MyFlash -> Study tab
3. **Verify:** "Join a League" CTA visible (AC-1)
4. Tap "Join a League"
5. **Verify:** Placed in a Bronze league (AC-2)
6. **Verify:** Leaderboard shows members ranked by XP, self highlighted (AC-3)
7. **Verify:** Each row shows rank, avatar, name, XP, cards reviewed, streak (AC-4)
8. **Verify:** Top 5 has green tint, bottom 5 has red tint (AC-5)
9. Navigate away, review 10 cards in a deck
10. Return to the leaderboard
11. **Verify:** XP updated (should be 100+ XP from 10 reviews) within 5 seconds (AC-6)
12. Tap "Create Private League"
13. Enter a league name
14. **Verify:** Invite code generated (AC-9)
15. On a second device/simulator, enter the invite code
16. **Verify:** Second user joins the private league (AC-10)
17. Tap "Leave League"
18. **Verify:** User removed from league, CTA reappears (AC-11)
19. Test promotion: simulate week-end with user in top 5
20. **Verify:** Promotion celebration screen shown (AC-7)
21. Test demotion: simulate week-end with user in bottom 5
22. **Verify:** Motivational screen shown (AC-8)
23. Open web at /flash/leagues, repeat steps 3-17
24. **Verify:** Web leaderboard works identically
25. Put device in airplane mode, verify cached leaderboard visible

## gstack Quality Gates

Based on this feature's complexity score (0 -- Massive), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in flash module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for XP calculation and tier promotion engines

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if standalone counterpart exists
- [ ] `/design-review` -- batch visual QA (leaderboard is a new major UI surface)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Flash module has individual streak tracking (`streaks/`), milestone celebrations, and badge states. All study data is local SQLite. There is no social dimension, no user identity awareness, no network-dependent features, and no Supabase integration. The module has `requiresAuth: false` and `requiresNetwork: false` in its definition.

### After This Work
- Three local SQLite cache tables: `fl_leagues`, `fl_league_members`, `fl_league_scores`
- Supabase cloud schema: `flash_leagues`, `flash_league_members`, `flash_league_scores` with RLS
- League sync layer connecting local XP calculation to cloud leaderboard
- Five tiers (Bronze to Diamond) with weekly promotion/demotion
- Private leagues with invite codes
- Leaderboard UI on mobile and web with real-time updates
- XP system derived from review activity (anti-cheat caps included)
- Note: `requiresNetwork` should remain `false` for the module (leagues are an optional feature within flash, not a module requirement). Network is needed only for live leaderboard sync.

### Files Changed
- `modules/flash/src/leagues/types.ts` -- New: League, LeagueMember, LeagueScore, Tier types
- `modules/flash/src/leagues/engine.ts` -- New: XP calculation, promotion/demotion logic
- `modules/flash/src/leagues/tiers.ts` -- New: tier definitions with colors, thresholds
- `modules/flash/src/leagues/index.ts` -- New: barrel export
- `modules/flash/src/leagues/__tests__/engine.test.ts` -- New: unit tests
- `modules/flash/src/db/leagues.ts` -- New: local SQLite CRUD for league cache
- `modules/flash/src/db/schema.ts` -- Add V4 migration SQL
- `modules/flash/src/definition.ts` -- Add FLASH_MIGRATION_V4
- `modules/flash/src/index.ts` -- Export league types and functions
- `packages/db/src/sync/league-sync.ts` -- New: Supabase real-time sync for league data
- `supabase/migrations/YYYYMMDD_flash_leagues.sql` -- New: cloud schema with RLS
- `apps/mobile/app/(flash)/leagues.tsx` -- New: leaderboard screen
- `apps/mobile/app/(flash)/components/LeagueCard.tsx` -- New: league summary card
- `apps/mobile/app/(flash)/components/TierBadge.tsx` -- New: tier badge component
- `apps/web/app/flash/leagues/page.tsx` -- New: web leaderboard

### Known Limitations
- V1 does not support team leagues (e.g., class vs class). Individual competition only.
- V1 does not support custom league rules (promotion thresholds, scoring weights). Fixed rules only.
- V1 does not include friend-finding or user search. Users share invite codes manually.
- No chat or messaging within leagues. Use Forums module for social communication.
- Season history is not tracked beyond the current and previous week. Future: full season archive.
- Avatar is placeholder (initials) until Hub auth includes profile photo support.

### Context for Next Agent
- This feature requires Supabase Auth for user identity. The `@mylife/auth` package must be wired before league membership can work. If auth is not ready, implement the local XP engine and leaderboard UI as stubs that display sample data.
- XP is derived from `fl_review_logs`, not from a separate XP tracking table. The `calculateXP` function queries review logs for the current week and computes XP. This is idempotent: calling it multiple times produces the same result.
- Supabase Realtime subscriptions should be used for the leaderboard. Subscribe to `flash_league_scores` changes for the user's current league. This delivers push updates when other members study.
- The anti-cheat system caps XP per card per day (10 XP) and test bonuses per day (3). This is enforced in `calculateXP`, not in the review path. A determined user could game the system by reviewing thousands of unique cards, but this is acceptable: studying is studying.
- Private league invite codes should use `crypto.randomUUID().slice(0, 6).toUpperCase()` for simplicity and unpredictability.
- The V4 migration for leagues is local SQLite only. The Supabase migration is a separate file in `supabase/migrations/` and runs independently.
