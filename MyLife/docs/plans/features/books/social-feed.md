# Feature Spec: Social Feed

## Metadata
- **Module:** books
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 3-4 hours
- **Depends On:** BK-001 (Library Management -- implemented), BK-023 (Share Events -- implemented). Requires hub-level Supabase auth and `hub_friendships` table.
- **Blocks:** Connected Book Clubs (BK-028 connected mode), Reactions on feed items (future)

## Business Context

### Why This Feature Exists
Social discovery is the #1 reason people stay on Goodreads despite its terrible UX. Seeing what friends are reading and rating creates a trust-based discovery loop that no algorithm can replicate. Goodreads has 150M users largely because of this social lock-in. MyBooks can offer the same social feed with a critical difference: opt-in visibility controls on every single activity. Users choose what to share, with whom, and can revoke at any time. The existing `bk_share_events` table (V2 migration) already stores visibility-controlled events -- the social feed simply surfaces them.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Goodreads | Yes | Free | Full activity feed with updates, reviews, ratings. Default public. Aggressive Amazon product placement. |
| Literal | Yes | Free | Clean social feed with book ratings and reviews. Friend-based. |
| StoryGraph | No | N/A | No social feed. Buddy reads only. |
| Bookly | No | N/A | No social features at all. |

### Target User
Social readers who want to see what friends are reading without joining a massive platform like Goodreads. These users value trust-based discovery (friend recommendations over algorithmic ones) and privacy controls (choosing exactly what to share). Primary target: Goodreads users uncomfortable with Amazon data practices who want a social reading experience on their terms.

## Technical Context

### Where This Lives in MyLife

```
modules/books/src/social/                       -- NEW: feed engine + types
modules/books/src/social/types.ts               -- FeedItem, FeedFilter, FriendProfile types
modules/books/src/social/feed-engine.ts         -- Feed assembly, friend activity queries
modules/books/src/social/index.ts               -- Barrel export
modules/books/src/social/__tests__/             -- Tests
apps/mobile/app/(books)/social.tsx              -- Mobile social feed screen
apps/mobile/app/(books)/social-friends.tsx      -- Mobile friend search/manage screen
apps/web/app/books/social/page.tsx              -- Web social feed page
apps/web/app/books/social/friends/page.tsx      -- Web friend management page
```

### Wireframe Position

```
Hub Dashboard
  └── MyBooks card
       └── Social tab (new tab, or section within Home tab)
            └── Social Feed ← YOU ARE HERE
            └── Friend Search/Manage
```

### Data Model

The social feed relies on two data layers:

**Local (already exists):**
- `bk_share_events` -- local activity events with visibility (private/friends/public). Created in V2 migration.

**Cloud (Supabase -- new tables):**

```sql
-- Friend Connections (Supabase, not local SQLite)
-- Lives in supabase/migrations/
CREATE TABLE IF NOT EXISTS friend_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (requester_id, responder_id)
);

-- Synced Share Events (Supabase, not local SQLite)
CREATE TABLE IF NOT EXISTS synced_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('book_rating', 'book_review', 'book_finished', 'book_started', 'book_added')),
  book_title TEXT NOT NULL,
  book_cover_url TEXT,
  book_authors TEXT,
  rating REAL,
  review_excerpt TEXT,
  visibility TEXT NOT NULL DEFAULT 'friends'
    CHECK (visibility IN ('friends', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS friend_connections_requester_idx ON friend_connections(requester_id);
CREATE INDEX IF NOT EXISTS friend_connections_responder_idx ON friend_connections(responder_id);
CREATE INDEX IF NOT EXISTS friend_connections_status_idx ON friend_connections(status);
CREATE INDEX IF NOT EXISTS synced_share_events_user_idx ON synced_share_events(user_id);
CREATE INDEX IF NOT EXISTS synced_share_events_created_idx ON synced_share_events(created_at DESC);
CREATE INDEX IF NOT EXISTS synced_share_events_visibility_idx ON synced_share_events(visibility);

-- RLS Policies
ALTER TABLE friend_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_share_events ENABLE ROW LEVEL SECURITY;

-- Users can see their own connections
CREATE POLICY "Users see own connections" ON friend_connections
  FOR SELECT USING (requester_id = auth.uid() OR responder_id = auth.uid());

-- Users can insert friend requests
CREATE POLICY "Users can send requests" ON friend_connections
  FOR INSERT WITH CHECK (requester_id = auth.uid());

-- Users can update connections they're part of
CREATE POLICY "Users can update own connections" ON friend_connections
  FOR UPDATE USING (requester_id = auth.uid() OR responder_id = auth.uid());

-- Users see friend and public events
CREATE POLICY "Users see friend events" ON synced_share_events
  FOR SELECT USING (
    user_id = auth.uid()
    OR visibility = 'public'
    OR (visibility = 'friends' AND EXISTS (
      SELECT 1 FROM friend_connections
      WHERE status = 'accepted'
        AND ((requester_id = auth.uid() AND responder_id = synced_share_events.user_id)
          OR (responder_id = auth.uid() AND requester_id = synced_share_events.user_id))
    ))
  );

-- Users can insert their own events
CREATE POLICY "Users can create events" ON synced_share_events
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

### Dependencies
- **Internal:** `@mylife/db`, `@mylife/auth` (Supabase auth wrapper), books sharing module (`db/sharing.ts`), existing share event CRUD
- **External:** Supabase Auth, Supabase Realtime (for live feed updates), Supabase PostgREST
- **Cross-Module:** Hub-level auth (`packages/auth/`). The `hub_friendships` table referenced in `sharing.ts` should be replaced by or aliased to `friend_connections` in Supabase.

## Functional Requirements

### User Stories
1. As a social reader, I want to see what my friends are reading and rating so that I can discover books through trusted recommendations.
2. As a privacy-conscious user, I want to choose exactly what reading activity to share and with whom (friends-only or public).
3. As a user, I want to search for and connect with friends so that we can see each other's reading activity.
4. As a user, I want to tap on a book in a friend's feed to see its details or add it to my library.

### Behavior Specification

1. User navigates to MyBooks and sees a "Social" tab (or section on Home).
2. **If not signed in:** "Sign in to see what your friends are reading" with sign-in button. Tapping opens Supabase auth flow.
3. **If signed in, no friends:** "Connect with friends to see their reading activity" with "Find Friends" button.
4. **If signed in with friends:** Reverse-chronological feed of friend activity.
5. Each feed item shows: friend display name + avatar, action description, book cover thumbnail, timestamp.
6. Action format examples:
   - "Alice rated Dune 4.5 stars" (with star display)
   - "Bob finished Project Hail Mary" (with checkmark icon)
   - "Carol started reading The Name of the Wind" (with book icon)
   - "Dave reviewed The Way of Kings" (with expandable review excerpt)
   - "Eve added Neuromancer to their library" (with plus icon)
7. Tap book cover/title: navigates to book detail if in library, or shows "Add to Library" option.
8. Tap friend name: shows friend's public profile (display name, shared book count, mutual books).
9. Pull-to-refresh fetches latest activity from Supabase.
10. Infinite scroll loads 50 items at a time.
11. User navigates to Friends screen to search by username, manage connections, and view pending requests.
12. Friend connection is mutual: both users must accept. Either can remove the connection.

### Edge Cases

- **Network unavailable:** Show cached feed data with "Last updated X ago" indicator. "Pull down to refresh when online."
- **Friend request to self:** "You cannot add yourself as a friend." Blocked in UI and API.
- **Duplicate friend request:** "Request already sent to this user." Prevented by UNIQUE constraint.
- **Friend request limit:** Max 100 accepted connections per user. Enforced in application logic.
- **User blocks another:** Status set to 'blocked'. Cannot re-request. Block is one-directional (blocker doesn't see blocked user's content).
- **User deletes account:** CASCADE deletes all their friend_connections and synced_share_events.
- **Private activity:** When a user creates a share event with visibility 'private', no synced_share_event is created. Feed never shows private items.
- **Very old feed items:** Feed query limits to last 90 days for performance.
- **Feed item for book not in user's library:** Show book card with "Add to Library" button.
- **Real-time updates:** Use Supabase Realtime subscription for live feed updates (new items appear without refresh).
- **Module disabled:** Social features are hidden but friend connections are preserved.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Signed-out user sees sign-in prompt on the Social tab.
- [ ] **AC-2:** Signed-in user with no friends sees "Connect with friends" prompt with "Find Friends" button.
- [ ] **AC-3:** Signed-in user with friends sees reverse-chronological activity feed.
- [ ] **AC-4:** Feed items show friend name, action type, book info, and timestamp.
- [ ] **AC-5:** Feed shows 5 event types: rated, reviewed, finished, started, added.
- [ ] **AC-6:** Tapping a book in the feed navigates to book detail or shows "Add to Library".
- [ ] **AC-7:** Tapping a friend name shows their public profile with shared stats.
- [ ] **AC-8:** Pull-to-refresh fetches latest activity.
- [ ] **AC-9:** Friend search allows finding users by username.
- [ ] **AC-10:** Friend request flow: send request -> pending -> accept -> mutual connection.
- [ ] **AC-11:** Private activities (visibility = 'private') never appear in any feed.
- [ ] **AC-12:** Offline mode shows cached feed with "Last updated" indicator.

### Technical Criteria
- [ ] **TC-1:** Supabase migration creates `friend_connections` and `synced_share_events` tables with RLS policies.
- [ ] **TC-2:** Feed query uses Supabase PostgREST: filter by friend IDs + visibility, order by created_at DESC, limit 50.
- [ ] **TC-3:** When a user creates a share event with visibility 'friends' or 'public', a corresponding synced_share_event is inserted via Supabase.
- [ ] **TC-4:** Friend connection UNIQUE constraint prevents duplicate requests.
- [ ] **TC-5:** Max 100 friend connections enforced in application logic before INSERT.
- [ ] **TC-6:** Feed items older than 90 days are excluded from queries.
- [ ] **TC-7:** Supabase Realtime subscription on `synced_share_events` for live feed updates.
- [ ] **TC-8:** RLS policies enforce: users see own events + public events + friend events (accepted connections only).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Private share events (visibility = 'private') must NEVER be synced to Supabase.
- [ ] **NC-2:** Blocked users must NOT see each other's activity or send new requests.
- [ ] **NC-3:** Feed must NOT show activity from non-friend users with 'friends' visibility.
- [ ] **NC-4:** Social features must NOT be visible to users who are not signed in (no data leakage).
- [ ] **NC-5:** Friend connections must NOT be created without both users' consent (mutual acceptance).
- [ ] **NC-6:** The social feed must NOT share any user's full reading history. Only explicitly shared events appear.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Feed item card: `rgba(255,255,255,0.04)` (glass), 12px padding, 8px gap between items
- Friend avatar: 36px circle, fallback to initials on accent color
- Action text: `#F0F0F5` (text), friend name bold, action verb normal
- Book cover thumbnail: 40x60px
- Star display: filled stars in `#FFD700`, empty in `rgba(255,255,255,0.2)`
- Timestamp: `rgba(240,240,245,0.65)` (textSecondary), relative format ("2h ago", "yesterday")
- Module accent: `#C9894D` for buttons and active states
- Pull-to-refresh: standard Expo/RN pull indicator
- Sign-in prompt: centered, glass card, icon + heading + accent-colored sign-in button

### Web (Next.js)

- Route: `/books/social` (feed), `/books/social/friends` (friend management)
- Same tokens via CSS variables
- Feed centered with max-width 600px (social feed pattern)
- Friend management page: search bar + pending requests + friend list in two columns

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Not Signed In | "Sign in to see what your friends are reading" + sign-in button | No Supabase auth session |
| No Friends | "Connect with friends to see their reading activity" + Find Friends CTA | Signed in, 0 accepted connections |
| Empty Feed | "Your friends haven't shared anything recently" | Friends connected, no recent events |
| Loading | Skeleton feed items (3 placeholders) | Initial fetch or refresh |
| Success | Scrollable feed of friend activity | Friends connected, events exist |
| Offline | Cached feed + "Last updated 2 hours ago" banner | No network connectivity |
| Error | "Could not load feed. Pull down to retry." | Supabase query failure |

## Test Requirements

### Unit Tests
- [ ] `feedShowsOnlyFriendActivity`: 3 friend events + 2 non-friend events -> only friend events in feed
- [ ] `feedRespectsVisibility`: friend with private event -> event NOT in feed
- [ ] `feedShowsPublicFromNonFriends`: public event from non-friend -> appears in discovery section
- [ ] `friendConnectionRequiresAcceptance`: pending connection -> no shared events visible
- [ ] `feedOrderedByRecency`: 5 events at different timestamps -> sorted newest first
- [ ] `maxFriendsEnforced`: attempt 101st connection -> error: friend limit reached
- [ ] `blockedUserCannotRequest`: blocked status -> re-request rejected
- [ ] `feedPagination`: 60 events -> first page returns 50, second returns 10
- [ ] `offlineFeedCache`: no network -> returns cached data with stale flag
- [ ] `privateEventNotSynced`: create share event with visibility 'private' -> no synced_share_event created

### Integration Tests
- [ ] Full flow: sign in -> send friend request -> friend accepts -> share event -> appears in friend's feed
- [ ] Offline flow: load feed -> go offline -> pull to refresh -> cached data shown with indicator

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyBooks > Social tab
3. Verify: sign-in prompt appears -- corresponds to AC-1
4. Sign in with Supabase auth
5. Verify: "Connect with friends" prompt appears -- corresponds to AC-2
6. Navigate to Find Friends
7. Search for a test friend by username
8. Send friend request
9. On the friend's device/session, accept the request
10. Navigate back to Social tab
11. Have the friend rate a book with "friends" visibility
12. Pull-to-refresh
13. Verify: friend's rating appears in feed with name, stars, book cover -- corresponds to AC-3, AC-4, AC-5
14. Tap the book cover in the feed
15. Verify: navigates to book detail or shows "Add to Library" -- corresponds to AC-6
16. Tap the friend's name
17. Verify: public profile shown -- corresponds to AC-7
18. Have the friend create a private share event
19. Pull-to-refresh
20. Verify: private event does NOT appear in feed -- corresponds to AC-11
21. Put device in airplane mode
22. Navigate to Social tab
23. Verify: cached feed shown with "Last updated" indicator -- corresponds to AC-12
24. Open the app on web
25. Navigate to Books > Social
26. Verify: same feed and friend management works

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /books/social, verify all 7 states (including not-signed-in, no-friends, offline)

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building (Complexity score is 1). Cloud schema and RLS policies need review.

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- verify hub module integrity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The books module has `bk_share_events` (V2 migration) with visibility-controlled local events and a `listShareEventsVisibleToUser` function that queries `hub_friendships`. No cloud sync, no friend connections, no social feed UI exists.

### After This Work
Supabase tables (`friend_connections`, `synced_share_events`) exist with RLS policies. A `social/` directory contains the feed engine that queries Supabase for friend activity. Mobile and web UIs show the social feed with sign-in gating, friend management, and offline caching. When users create share events with 'friends' or 'public' visibility, they are synced to Supabase.

### Files Changed
- `supabase/migrations/YYYYMMDDHHMMSS_add_social_feed.sql` -- friend_connections and synced_share_events tables with RLS
- `modules/books/src/social/types.ts` -- FeedItem, FeedFilter, FriendConnection, FriendProfile types
- `modules/books/src/social/feed-engine.ts` -- assembleFeed, sendFriendRequest, acceptFriendRequest, syncShareEvent functions
- `modules/books/src/social/index.ts` -- barrel export
- `modules/books/src/social/__tests__/feed-engine.test.ts` -- 10+ unit tests
- `modules/books/src/db/sharing.ts` -- add syncToSupabase hook when creating share events with non-private visibility
- `modules/books/src/index.ts` -- re-export social module
- `apps/mobile/app/(books)/social.tsx` -- mobile social feed
- `apps/mobile/app/(books)/social-friends.tsx` -- mobile friend management
- `apps/web/app/books/social/page.tsx` -- web social feed
- `apps/web/app/books/social/friends/page.tsx` -- web friend management

### Known Limitations
- Requires Supabase auth. Users without an account cannot access social features.
- No reactions (likes, hearts) on feed items. Display-only feed.
- No push notifications for friend activity. Pull-to-refresh and Realtime subscriptions only.
- Friend search is by exact username. No fuzzy search or contact book integration.
- Feed limited to last 90 days of activity for performance.

### Context for Next Agent
- The existing `db/sharing.ts` has `createShareEvent()` and `listShareEventsVisibleToUser()`. The social feed extends this by syncing non-private events to Supabase.
- The `hub_friendships` table referenced in `listShareEventsVisibleToUser()` needs to be reconciled with the new `friend_connections` Supabase table. Option 1: migrate hub_friendships to Supabase. Option 2: keep hub_friendships for local queries and friend_connections for cloud. Recommend Option 1.
- Supabase client is in `packages/api/` (if it exists) or should be initialized via `@supabase/supabase-js` with the project URL and anon key from environment.
- RLS policies are critical for security. Test them thoroughly: a user should never see 'friends' visibility events from non-friends.
- For offline caching, store the last-fetched feed in local SQLite (a new `bk_feed_cache` table or `bk_settings` key) so the feed is available without network.
