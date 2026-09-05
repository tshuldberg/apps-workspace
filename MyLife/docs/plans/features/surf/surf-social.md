# Feature Spec: Surf Social Features

## Metadata
- **Module:** surf
- **Priority Score:** 16 / 50 (C-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 2 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** TBD
- **Estimated CC Time:** 5-6 hours
- **Depends On:** none (community reviews/photos already exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Surfing is inherently social. Surfers share sessions, compare wave counts, coordinate dawn patrols, and build local crew connections. Surfline has a social layer (session sharing, surf feed) that creates stickiness beyond the forecast data. MySurf already has community reviews and photos -- social features extend this into ongoing engagement through session sharing, activity feeds, and crew coordination.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Surfline | Yes | Partial | Session sharing, social feed, "Sessions" feature tracks wave count and shares to profile. Premium for full stats. |
| Magic Seaweed | Partial | No | Community reports and forums, no structured social feed |
| Strava (adjacent) | Yes | Yes | Activity feed, following, kudos, leaderboards. Not surf-specific but sets social fitness expectations. |
| Dawn Patrol (niche) | Yes | No | Surf-only social app -- crew coordination, session check-ins, local communities |

### Target User
Social surfers who want to share their sessions, see what their crew is surfing, and coordinate meetups. Overlaps with users who already use Strava for other sports and expect a social activity feed. The Strava-style social layer adds daily engagement beyond the "check forecast, close app" pattern.

## Technical Context

### Where This Lives in MyLife

```
modules/surf/src/types.ts                  -- SurfProfileSchema, FollowSchema, SharedSessionSchema, FeedItemSchema
modules/surf/src/db/schema.ts              -- sf_profiles, sf_follows, sf_shared_sessions, sf_feed_items tables
modules/surf/src/db/crud.ts                -- Social CRUD functions
modules/surf/src/cloud/social.ts           -- NEW: cloud social queries
modules/surf/src/cloud/index.ts            -- Export social functions
modules/surf/src/engine/feed.ts            -- NEW: feed generation engine
modules/surf/src/index.ts                  -- Export new types and CRUD
modules/surf/src/definition.ts             -- Migration version bump
apps/mobile/app/(surf)/feed.tsx            -- Social activity feed screen
apps/mobile/app/(surf)/profile/[id].tsx    -- Surfer profile screen
apps/mobile/app/(surf)/crew.tsx            -- Crew management screen
apps/web/app/surf/feed/page.tsx            -- Web social feed
apps/web/app/surf/profile/[id]/page.tsx    -- Web surfer profile
```

### Wireframe Position

```
Hub Dashboard
  └── MySurf card
       └── Feed tab ← NEW TAB (replaces or supplements Profile tab)
            └── Activity feed (sessions from followed surfers)
            └── Session detail cards
       └── Profile tab (existing, enhanced)
            └── Public surf profile
            └── Session history (shareable)
            └── Stats summary (waves, hours, spots visited)
            └── Followers / Following
       └── Crew screen (accessible from profile)
            └── Crew list
            └── Invite / manage members
```

### Data Model

```sql
-- Surf-specific user profiles (extends auth user)
CREATE TABLE IF NOT EXISTS sf_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  home_spot_id TEXT REFERENCES sf_spots(id),
  skill_level TEXT DEFAULT 'intermediate',
  board_quiver_json TEXT DEFAULT '[]',
  session_count INTEGER NOT NULL DEFAULT 0,
  total_waves INTEGER NOT NULL DEFAULT 0,
  total_hours REAL NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Follow relationships
CREATE TABLE IF NOT EXISTS sf_follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(follower_id, following_id)
);

-- Shared sessions (public versions of surf sessions)
CREATE TABLE IF NOT EXISTS sf_shared_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sf_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  spot_id TEXT NOT NULL REFERENCES sf_spots(id),
  caption TEXT,
  wave_count INTEGER,
  best_wave_duration_s REAL,
  conditions_summary TEXT,
  photo_urls_json TEXT DEFAULT '[]',
  stoke_level INTEGER NOT NULL DEFAULT 3,
  is_public INTEGER NOT NULL DEFAULT 1,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Social interactions on shared sessions
CREATE TABLE IF NOT EXISTS sf_session_comments (
  id TEXT PRIMARY KEY,
  shared_session_id TEXT NOT NULL REFERENCES sf_shared_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sf_session_likes (
  id TEXT PRIMARY KEY,
  shared_session_id TEXT NOT NULL REFERENCES sf_shared_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(shared_session_id, user_id)
);

-- Crew groups for coordinating sessions
CREATE TABLE IF NOT EXISTS sf_crews (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  description TEXT,
  home_spot_id TEXT REFERENCES sf_spots(id),
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sf_crew_members (
  id TEXT PRIMARY KEY,
  crew_id TEXT NOT NULL REFERENCES sf_crews(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(crew_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS sf_profiles_user_idx ON sf_profiles(user_id);
CREATE INDEX IF NOT EXISTS sf_follows_follower_idx ON sf_follows(follower_id);
CREATE INDEX IF NOT EXISTS sf_follows_following_idx ON sf_follows(following_id);
CREATE INDEX IF NOT EXISTS sf_shared_sessions_user_idx ON sf_shared_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sf_shared_sessions_spot_idx ON sf_shared_sessions(spot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sf_comments_session_idx ON sf_session_comments(shared_session_id);
CREATE INDEX IF NOT EXISTS sf_likes_session_idx ON sf_session_likes(shared_session_id);
CREATE INDEX IF NOT EXISTS sf_crew_members_crew_idx ON sf_crew_members(crew_id);
CREATE INDEX IF NOT EXISTS sf_crew_members_user_idx ON sf_crew_members(user_id);
```

### Dependencies
- **Internal:** `@mylife/auth` (user identity for profiles), `@mylife/db` (migration), existing `sf_sessions` + `sf_session_waves` tables
- **External:** Supabase Auth (user IDs), Supabase Realtime (live feed updates), push notifications for social interactions
- **Cross-Module:** `forums` module shares social patterns (profiles, follows). If a hub-wide social profile exists in the future, surf profiles should be compatible. The `CrossModule` score of 2 reflects this potential overlap.

## Functional Requirements

### User Stories
1. As a surfer, I want to share my session with my crew so they can see what I surfed and how it was.
2. As a surfer, I want to follow other surfers so I can see their sessions in my feed.
3. As a crew organizer, I want to create a crew group so we can coordinate dawn patrol meetups.
4. As a surfer, I want to see a feed of recent sessions from people I follow so I stay motivated and informed.
5. As a surfer, I want a public profile showing my stats (sessions, waves, hours) so others can see my surf history.
6. As a surfer, I want to like and comment on shared sessions to engage with my crew.

### Behavior Specification

**Session Sharing Flow:**
1. User completes a surf session (already logged via session log)
2. A "Share" prompt appears after saving the session
3. User adds optional caption, stoke level (1-5, emoji-based), and photos
4. User selects visibility: Public (anyone), Followers Only, or Crew Only
5. Shared session appears in the user's profile and in followers' feeds

**Feed:**
1. User navigates to the Feed tab
2. Feed shows shared sessions from followed surfers, sorted by recency
3. Each feed card shows: surfer avatar + name, spot name, date, wave count, stoke level, caption, conditions summary, and up to 3 photos
4. User can like (stoke) or comment on any session
5. Tapping the spot name navigates to that spot's detail page
6. Tapping the surfer name navigates to their profile

**Profile:**
1. User's profile shows: display name, avatar, bio, home spot, skill level, board quiver
2. Stats section: total sessions, total waves, total hours, spots visited, average stoke
3. Session history: reverse-chronological list of shared sessions
4. Followers / Following counts with tap to see lists
5. Other users can follow/unfollow from the profile page

**Crews:**
1. User creates a crew with a name, description, and optional home spot
2. User invites members by searching for surfer profiles
3. Crew members see crew-only shared sessions in a dedicated crew feed
4. Crew page shows member list, recent crew sessions, and home spot forecast

### Edge Cases

- **User has no followers:** Feed shows empty state with "Find surfers to follow" suggestions (popular local profiles or crew discovery)
- **Shared session with no photos:** Display text-only card with conditions summary and stoke emoji
- **User sets profile to private:** Only followers see their sessions. Follow requests require approval.
- **User deletes their session:** Shared session is also removed. Comments and likes on it are cascade-deleted.
- **User blocks another user:** Blocked user's sessions are hidden from feed. Blocked user cannot follow, like, or comment.
- **Very long caption:** Truncate to 280 characters in feed card, show full text on session detail tap.
- **Crew with 1 member:** Show empty crew feed with "Invite surfers" CTA.
- **User is in multiple crews:** Crew selector dropdown on the crew feed page.
- **Stale feed (>24h since last refresh):** Show "Pull to refresh" indicator and a "Last updated X hours ago" banner.
- **Offline mode:** Cache the last 20 feed items for offline browsing. Social actions (like, comment, share) queue and sync when back online.
- **Profile without sessions logged:** Show "No sessions yet" with a CTA to log their first session.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** After saving a session, a "Share" prompt appears with caption, stoke level, photo, and visibility options
- [ ] **AC-2:** Feed tab shows shared sessions from followed surfers in reverse chronological order
- [ ] **AC-3:** Feed cards display surfer name/avatar, spot, date, wave count, stoke level, caption, and photos
- [ ] **AC-4:** User can like (stoke) a shared session with a single tap
- [ ] **AC-5:** User can comment on a shared session
- [ ] **AC-6:** Profile page shows display name, avatar, bio, stats (sessions/waves/hours), and session history
- [ ] **AC-7:** User can follow/unfollow other surfers from their profile
- [ ] **AC-8:** Followers/Following counts are visible and tappable to see lists
- [ ] **AC-9:** User can create a crew, invite members, and see a crew-specific feed
- [ ] **AC-10:** Privacy controls work: private profiles require follow approval, visibility settings on shared sessions are enforced

### Technical Criteria
- [ ] **TC-1:** Migration creates all 7 social tables (sf_profiles, sf_follows, sf_shared_sessions, sf_session_comments, sf_session_likes, sf_crews, sf_crew_members) with indexes
- [ ] **TC-2:** Profile CRUD: create, get by user_id, update, increment stats
- [ ] **TC-3:** Follow CRUD: follow, unfollow, get followers, get following, check is_following
- [ ] **TC-4:** Shared session CRUD: create, list by user, list by spot, delete
- [ ] **TC-5:** Comment CRUD: create, list by session, delete
- [ ] **TC-6:** Like CRUD: toggle like, get like count, check is_liked
- [ ] **TC-7:** Crew CRUD: create, get, list user's crews, add member, remove member
- [ ] **TC-8:** Feed engine: given a user_id, return shared sessions from followed users + crew members, paginated, sorted by created_at DESC
- [ ] **TC-9:** Feed query returns in <300ms for users following up to 200 surfers
- [ ] **TC-10:** Profile stats (session_count, total_waves, total_hours) update atomically when a session is shared or deleted

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Private sessions (not shared) must NOT appear in any feed or on any profile
- [ ] **NC-2:** Blocked users must NOT see each other's sessions, profiles, or crews
- [ ] **NC-3:** Session sharing must NOT be required -- logging a session without sharing must work exactly as before
- [ ] **NC-4:** Social features must NOT require network for core session logging -- social is cloud-only but session logging stays offline-capable
- [ ] **NC-5:** Crew invites must NOT auto-accept -- invited user must confirm

## UI Specification

### Mobile (Expo)

- **Feed tab:** Vertical scrollable list of session cards. Each card is a glass card (`rgba(255,255,255,0.04)`) with:
  - Header: avatar (32px circle), display name, relative time
  - Spot name (tappable, accent `#3B82F6`)
  - Photo carousel (if photos exist): horizontal scroll, 16:9 aspect
  - Caption text (max 3 lines, "more..." to expand)
  - Footer: stoke emoji + level, wave count badge, like button + count, comment button + count
- **Share prompt:** Bottom sheet after session save. Caption input, stoke level slider (emoji scale 1-5), photo picker, visibility toggle.
- **Profile:** Scrollable screen with header card (avatar, name, bio, stats), followed by session list
- **Crew page:** Glass card with crew name, member avatars (horizontal stack), and mini-feed
- Background: `#0A0A0F`, accent: `#3B82F6`, stoke colors: `#30D158` (stoked), `#FFD60A` (fun), `#FF453A` (flat)

### Web (Next.js)

- **Feed page (`/surf/feed`):** Two-column layout on desktop: feed cards (left 2/3), suggested surfers + crew sidebar (right 1/3)
- **Profile (`/surf/profile/[id]`):** Full-width header with stats, tabbed content (Sessions, Following, Followers)
- **Crew (`/surf/crew/[id]`):** Member list + crew feed
- Same Cool Obsidian tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton feed cards with shimmer | Initial feed fetch |
| Empty (no follows) | "Follow surfers to see their sessions" with suggested profiles | User follows nobody |
| Empty (follows, no posts) | "No recent sessions from your crew" | Follows exist but no shared sessions |
| Error | "Unable to load feed" + retry | Network error |
| Success | Scrollable feed of session cards | Feed data loaded |
| Partial | Cached feed visible, "Refreshing..." banner at top | Stale cache + background refresh |

## Test Requirements

### Unit Tests
- [ ] Profile CRUD: create, get, update, stat increment/decrement
- [ ] Follow CRUD: follow, unfollow, mutual follow detection, follower count
- [ ] Shared session CRUD: create from session, list by user, list by spot, delete cascading
- [ ] Comment CRUD: create, list, delete
- [ ] Like CRUD: toggle on/off, count, duplicate prevention
- [ ] Crew CRUD: create, add member, remove member, list user crews
- [ ] Feed engine: returns sessions from followed users only, respects privacy, pagination works
- [ ] Privacy: private profile sessions not visible to non-followers

### Integration Tests
- [ ] Full share flow: log session -> share -> verify appears in follower's feed
- [ ] Follow + feed: follow user A -> A shares session -> feed includes it -> unfollow A -> feed no longer includes it
- [ ] Crew flow: create crew -> invite member -> member shares to crew -> crew feed includes it
- [ ] Delete cascade: delete shared session -> comments and likes removed

### QA Verification Script

1. Open the app on mobile
2. Log a surf session and tap "Save"
3. Verify the "Share" prompt appears -- corresponds to AC-1
4. Add a caption, set stoke level to 4, select "Public" visibility, tap "Share"
5. Navigate to Feed tab -- verify the shared session appears -- corresponds to AC-2
6. Verify feed card shows name, spot, stoke, caption -- corresponds to AC-3
7. Tap the like button -- verify count increments -- corresponds to AC-4
8. Tap comment button, type a comment, submit -- verify it appears -- corresponds to AC-5
9. Navigate to your profile -- verify stats and session history -- corresponds to AC-6
10. Navigate to another surfer's profile, tap Follow -- corresponds to AC-7
11. Verify follower count updates -- corresponds to AC-8
12. Navigate to Crew, create a new crew, invite a member -- corresponds to AC-9
13. Set profile to private, verify follow requests require approval -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the feed generation engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- MySurf has community features: spot reviews, photos, and guides
- Sessions are logged locally (sf_sessions) and synced to cloud (cloudCreateSurfSession)
- No social profiles, no following, no session sharing, no feed, no crews
- The account/profile tab shows basic settings only

### After This Work
- 7 new social tables in the sf_ namespace
- Surf-specific profiles with stats tracking
- Follow/unfollow system
- Session sharing with visibility controls
- Activity feed showing sessions from followed surfers
- Like and comment interactions on shared sessions
- Crew groups with dedicated feeds and member management
- Feed generation engine for paginated timeline queries

### Files Changed

- `modules/surf/src/types.ts` -- Add SurfProfileSchema, FollowSchema, SharedSessionSchema, SessionCommentSchema, SessionLikeSchema, CrewSchema, CrewMemberSchema, StokeLevelSchema
- `modules/surf/src/db/schema.ts` -- 7 new table DDL statements and indexes
- `modules/surf/src/db/crud.ts` -- Social CRUD functions (profile, follow, share, comment, like, crew)
- `modules/surf/src/cloud/social.ts` -- New cloud adapter file for social queries
- `modules/surf/src/cloud/index.ts` -- Export social functions
- `modules/surf/src/engine/feed.ts` -- New feed generation engine
- `modules/surf/src/definition.ts` -- Migration version bump
- `modules/surf/src/index.ts` -- Export new types, engine, and CRUD
- `apps/mobile/app/(surf)/feed.tsx` -- New feed screen
- `apps/mobile/app/(surf)/profile/[id].tsx` -- Enhanced profile screen
- `apps/mobile/app/(surf)/crew.tsx` -- New crew screen
- `apps/mobile/app/(surf)/_layout.tsx` -- Add Feed tab (or replace existing tab)
- `apps/web/app/surf/feed/page.tsx` -- Web feed page
- `apps/web/app/surf/profile/[id]/page.tsx` -- Web profile page

### Known Limitations
- V1 does not include push notifications for social interactions (likes, comments, follows) -- this is a fast-follow
- No real-time feed updates (Supabase Realtime) in V1 -- pull-to-refresh only
- Photo uploads in shared sessions reuse the existing spot photo infrastructure -- no separate photo pipeline
- No moderation tools in V1 -- rely on user blocking and report (via existing review reporting) for now
- Crew size is uncapped in V1 -- may need limits if abuse occurs
- No DM/messaging between surfers in V1 -- this would be a separate feature (or cross-module with forums)

### Context for Next Agent
- The existing community features (reviews, photos, guides in V3) share the same Supabase infrastructure. Social features build on the same patterns but add user-to-user relationships.
- The `forums` module has a similar social graph concept. If a hub-wide profile system is planned, coordinate with forums to avoid duplicate profile tables. For now, `sf_profiles` is surf-specific.
- Session sharing is opt-in -- the existing session log flow (create session -> save) must work exactly as before. The share prompt is additive.
- Feed pagination should use cursor-based pagination (created_at + id) for consistency with other MyLife cloud queries.
- Stoke level is a 1-5 emoji scale: 1 = flat/disappointed, 2 = meh, 3 = fun, 4 = stoked, 5 = epic. Use surf-appropriate emoji (not generic).
