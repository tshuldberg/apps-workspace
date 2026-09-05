# Feature Spec: Social Feed

## Metadata
- **Module:** workouts
- **Feature ID:** WO-023
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [4] x3 + Switching [3] x3 + Complexity [0] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** S10+
- **Estimated CC Time:** 8-12 hours
- **Depends On:** WO-021 (Workout Sharing - summary data format for posts)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Social accountability is the #1 predictor of long-term fitness habit retention. Strava built a $12B company on the insight that sharing workouts creates a positive feedback loop: post workout, get likes, feel motivated, work out again. Hevy's social feed is a core differentiator cited in their 9M user growth. MyWorkouts currently has zero social features, meaning users who want social accountability must use a second app alongside ours. Adding an opt-in social feed keeps users within MyLife and unlocks network effects.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Strava | Yes | Free (basic), Paid (full) | Activity feed with route maps, kudos, comments, clubs. 180M users |
| Hevy | Yes | Free | Workout feed with exercises, volume, likes, comments. 9M athletes |
| Peloton | Yes | Paid ($192/yr) | Workout feed with leaderboards, high-fives, class reviews |
| JEFIT | Partial | Free | Community forums but no personal activity feed |
| Strong | No | N/A | No social features |
| Fitbod | No | N/A | No social features |

### Target User
Social gym-goers (18-35) who want accountability partners and public motivation. Users who currently dual-app with Strava or Hevy for social features. Users in gym groups or fitness challenges who want a shared view of team progress.

## Technical Context

### Where This Lives in MyLife
```
modules/workouts/src/social/types.ts          -- Social entity types + Zod schemas
modules/workouts/src/social/privacy.ts        -- Privacy filter engine
modules/workouts/src/social/feed.ts           -- Feed query builder
apps/mobile/app/(workouts)/social.tsx          -- Mobile social feed screen
apps/mobile/app/(workouts)/social-profile.tsx  -- User profile screen
apps/mobile/components/workouts/PostCard.tsx   -- Individual post card component
apps/mobile/components/workouts/CommentThread.tsx -- Comment thread component
apps/web/app/workouts/social/page.tsx          -- Web social feed
apps/web/app/workouts/social/[userId]/page.tsx -- Web user profile
```

### Wireframe Position
```
Hub Dashboard
  └── MyWorkouts card
       └── Profile tab
            └── Social Feed ← YOU ARE HERE (or dedicated Social tab)
                 ├── Feed (scrollable posts from followed users)
                 ├── User Profile (stats, follow/unfollow, posts grid)
                 └── Privacy Settings (configure what to share)
```

### Data Model

Social data lives in Supabase (cloud), not local SQLite, because it requires multi-user data exchange.

**Supabase tables (managed via Supabase migrations, not local SQLite):**

```sql
-- Social posts (workout completions shared to feed)
CREATE TABLE wk_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  content JSONB NOT NULL,
  privacy_settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wk_social_posts_user_idx ON wk_social_posts(user_id, created_at DESC);
CREATE INDEX wk_social_posts_created_idx ON wk_social_posts(created_at DESC);

-- Likes
CREATE TABLE wk_social_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES wk_social_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX wk_social_likes_post_idx ON wk_social_likes(post_id);

-- Comments
CREATE TABLE wk_social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES wk_social_posts(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wk_social_comments_post_idx ON wk_social_comments(post_id, created_at ASC);

-- Follows
CREATE TABLE wk_social_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX wk_social_follows_follower_idx ON wk_social_follows(follower_id);
CREATE INDEX wk_social_follows_following_idx ON wk_social_follows(following_id);

-- Privacy settings per user
CREATE TABLE wk_social_privacy (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  share_title BOOLEAN NOT NULL DEFAULT true,
  share_exercises BOOLEAN NOT NULL DEFAULT true,
  share_weight_details BOOLEAN NOT NULL DEFAULT false,
  share_prs BOOLEAN NOT NULL DEFAULT true,
  share_duration BOOLEAN NOT NULL DEFAULT true,
  profile_visible BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE wk_social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wk_social_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wk_social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wk_social_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE wk_social_privacy ENABLE ROW LEVEL SECURITY;

-- Users can read posts from users they follow or their own
CREATE POLICY "read_followed_posts" ON wk_social_posts FOR SELECT USING (
  user_id = auth.uid() OR
  user_id IN (SELECT following_id FROM wk_social_follows WHERE follower_id = auth.uid())
);

-- Users can insert their own posts
CREATE POLICY "insert_own_posts" ON wk_social_posts FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can delete their own posts
CREATE POLICY "delete_own_posts" ON wk_social_posts FOR DELETE USING (user_id = auth.uid());

-- Likes: users can read all likes on visible posts
CREATE POLICY "read_likes" ON wk_social_likes FOR SELECT USING (true);
CREATE POLICY "insert_own_likes" ON wk_social_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete_own_likes" ON wk_social_likes FOR DELETE USING (user_id = auth.uid());

-- Comments: readable on visible posts
CREATE POLICY "read_comments" ON wk_social_comments FOR SELECT USING (true);
CREATE POLICY "insert_own_comments" ON wk_social_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete_own_comments" ON wk_social_comments FOR DELETE USING (user_id = auth.uid());

-- Follows: users manage their own follows
CREATE POLICY "read_follows" ON wk_social_follows FOR SELECT USING (
  follower_id = auth.uid() OR following_id = auth.uid()
);
CREATE POLICY "insert_own_follows" ON wk_social_follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "delete_own_follows" ON wk_social_follows FOR DELETE USING (follower_id = auth.uid());

-- Privacy: users read/write their own settings
CREATE POLICY "own_privacy" ON wk_social_privacy FOR ALL USING (user_id = auth.uid());
```

### Dependencies
- **Internal:** `@mylife/db` (local session data for generating post content), `@mylife/auth` (user identity, Supabase Auth), `@mylife/ui` (Cool Obsidian tokens)
- **External:** Supabase (Auth, Database, Realtime subscriptions for live feed updates)
- **Cross-Module:** Reuses `WorkoutSummaryCard` type from WO-021 (Workout Sharing) as the post content format

## Functional Requirements

### User Stories
1. As a social gym-goer, I want to see my friends' completed workouts in a feed so I stay motivated by their activity.
2. As a user, I want to like and comment on my friends' workouts to encourage them.
3. As a user, I want to follow other users by username or invite link.
4. As a privacy-conscious user, I want granular control over what workout data appears in my posts (hide weight details, show only duration and exercises).
5. As a user, I want to opt into social features explicitly (not auto-enrolled).
6. As a user, I want a chronological feed (no algorithmic ranking or engagement optimization).

### Behavior Specification

**Onboarding (First-Time Social Setup):**
1. User navigates to the Social tab or Social Feed screen.
2. If not authenticated: show "Sign in to join the social feed" with sign-in button.
3. If authenticated but social not set up: show onboarding card explaining privacy controls.
4. User configures privacy settings (what to share).
5. User profile becomes visible to other users (if profile_visible = true).

**Posting a Workout:**
1. After completing a workout, the Completion Summary screen shows a "Share to Feed" toggle (off by default).
2. If user toggles it on, system creates a `wk_social_posts` record in Supabase.
3. Post content is the `WorkoutSummaryCard` from WO-021, filtered through the user's privacy settings.
4. Post appears in the feeds of all users who follow this user.

**Viewing the Feed:**
1. User opens the Social Feed screen.
2. System queries posts from followed users, ordered by created_at DESC, paginated (50 per page).
3. Each post shows: user avatar, display name, time ago, workout summary card, like count, comment count.
4. Like button: tap to toggle like (optimistic UI update, synced to Supabase).
5. Comment button: opens comment thread modal with existing comments and text input.
6. Pull-to-refresh loads latest posts.
7. Realtime subscription updates feed when new posts arrive from followed users.

**Following Users:**
1. User taps a username on a post or searches for a user.
2. User Profile screen shows: avatar, display name, member since, total workouts, streak, followers/following count.
3. "Follow" button sends a follow request (instant, no approval needed).
4. "Unfollow" button removes the follow relationship.
5. Users can also be followed via invite link (deep link to profile).

**Privacy Controls:**
1. Accessible from Social Settings.
2. Toggle each data field: workout title, exercise names, weight/rep details, PRs, duration.
3. Weight/rep details default to OFF (most privacy-sensitive).
4. Profile visibility toggle: if off, user does not appear in search results and profile returns 404.

### Edge Cases
- User is not authenticated: show sign-in prompt. Social features require Supabase Auth.
- User follows 0 people: show empty feed with "Find friends to follow" and search button.
- User follows someone who has never posted: feed is empty but shows "Waiting for [username]'s first workout".
- Post from a user who has since deleted their account: hide the post (CASCADE delete handles DB).
- Comment with offensive content: no moderation in v1. Future: add report button.
- Very old posts: paginated feed loads 50 at a time, infinite scroll.
- Realtime subscription disconnects: fall back to pull-to-refresh.
- User disables social after posting: existing posts remain unless manually deleted.
- Privacy settings changed after posting: existing posts are NOT retroactively updated. New posts use new settings.
- Self-follow attempt: blocked by DB constraint (follower_id != following_id).
- Duplicate like: blocked by unique constraint (user_id, post_id).
- Comment > 500 chars: truncated or rejected by DB constraint.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Social feed shows posts from followed users in reverse chronological order.
- [ ] **AC-2:** Each post displays user avatar, display name, time ago, and workout summary card.
- [ ] **AC-3:** Tapping the like button toggles the like state and updates the count.
- [ ] **AC-4:** Tapping the comment button opens a comment thread with existing comments and text input.
- [ ] **AC-5:** Pull-to-refresh loads the latest posts.
- [ ] **AC-6:** "Share to Feed" toggle on workout completion creates a post visible to followers.
- [ ] **AC-7:** Privacy settings allow toggling: title, exercises, weight details, PRs, duration.
- [ ] **AC-8:** With weight sharing disabled, posts show exercise names and duration but no weight/reps.
- [ ] **AC-9:** Following a user via the Follow button makes their posts appear in the feed.
- [ ] **AC-10:** Unfollowing a user removes their posts from the feed.
- [ ] **AC-11:** Unauthenticated users see a sign-in prompt instead of the feed.
- [ ] **AC-12:** Empty feed (no follows) shows "Find friends to follow" with search.
- [ ] **AC-13:** User profile shows total workouts, current streak, follower/following counts.

### Technical Criteria
- [ ] **TC-1:** All social tables have RLS policies enforcing user-level access control.
- [ ] **TC-2:** Feed query uses pagination (50 per page) with cursor-based loading.
- [ ] **TC-3:** Privacy filter applies user's privacy settings to post content before inserting.
- [ ] **TC-4:** Realtime subscription delivers new posts within 2 seconds of creation.
- [ ] **TC-5:** Like toggle uses optimistic UI update with rollback on failure.
- [ ] **TC-6:** Self-follow is prevented by DB constraint.
- [ ] **TC-7:** Duplicate likes are prevented by unique constraint.
- [ ] **TC-8:** Comments are limited to 500 characters by DB constraint.

### Negative Criteria
- [ ] **NC-1:** The feed must NOT use algorithmic ranking. Strict reverse chronological order only.
- [ ] **NC-2:** Social features must NOT be enabled by default. User must explicitly opt in.
- [ ] **NC-3:** Weight/rep details must NOT be shared by default (default: off in privacy settings).
- [ ] **NC-4:** No read receipts, no "typing" indicators, no engagement metrics visible to users.
- [ ] **NC-5:** No push notifications for social interactions in v1 (likes, comments, follows).
- [ ] **NC-6:** Changing privacy settings must NOT retroactively modify existing posts.

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Post cards: glass card style (`rgba(255,255,255,0.04)`) with glass border
- User avatar: 40px circle, top-left of post
- Display name: bold, `#F0F0F5`
- Time ago: `textSecondary`
- Workout summary: embedded summary card (from WO-021)
- Like button: heart icon, unfilled = gray, filled = `#EF4444` (module accent)
- Comment button: speech bubble icon, gray
- Pull-to-refresh: standard iOS pull-down refresh
- Empty state: illustration + "Find friends to follow" CTA

### Web (Next.js)
- Same tokens via CSS variables
- Feed route: `/workouts/social`
- Profile route: `/workouts/social/[userId]`
- Side panel layout: feed in center column, trending/suggested follows in right sidebar

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton post cards with shimmer | Initial feed fetch |
| Empty Feed | "Find friends to follow" with search CTA | User follows 0 people |
| Success | Scrollable feed of workout posts | Posts loaded |
| Error | "Could not load feed. Pull to refresh." | Network/query failure |
| Unauthenticated | "Sign in to join the social feed" + sign-in button | No auth session |
| Onboarding | Privacy settings card + "Get Started" | First-time social setup |

## Test Requirements

### Unit Tests
- [ ] `buildPostContent`: applies privacy filter to WorkoutSummaryCard
- [ ] `buildPostContent` with weight sharing off: removes weight/rep fields
- [ ] `buildPostContent` with all sharing on: includes all fields
- [ ] `filterFeedPosts`: returns only posts from followed user IDs
- [ ] `filterFeedPosts`: returns empty array when following nobody
- [ ] Privacy defaults: weight_details defaults to false, others default to true
- [ ] Comment length validation: rejects > 500 characters

### Integration Tests
- [ ] Full flow: complete workout -> toggle "Share to Feed" -> post appears in follower's feed
- [ ] Like flow: tap like -> count increments -> tap again -> count decrements
- [ ] Comment flow: write comment -> submit -> comment appears in thread
- [ ] Follow flow: search user -> follow -> their posts appear in feed

### QA Verification Script
1. Open the app on mobile, ensure user is authenticated via Supabase
2. Navigate to MyWorkouts > Social Feed
3. If first time: verify onboarding card appears with privacy settings -- AC-7
4. Configure privacy: enable title, exercises, duration. Disable weight details
5. Navigate to Workouts, complete a workout with set weights logged
6. On completion screen, toggle "Share to Feed" on
7. Verify: toast confirms "Shared to feed" -- corresponds to AC-6
8. Open Social Feed
9. Verify: your post appears with exercise names and duration but NO weight details -- AC-8
10. Using a second test account that follows the first account:
11. Open Social Feed on the second account
12. Verify: the first account's post appears in chronological order -- AC-1, AC-2
13. Tap the like button on the post -- AC-3
14. Verify: like count increments, heart fills red
15. Tap comment button, type "Great workout!", submit -- AC-4
16. Verify: comment appears in thread
17. Pull down to refresh -- AC-5

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to social feed, test like/comment/follow, verify all 6 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building (Complexity score: 0 = Massive)
- [ ] `/office-hours` (builder mode) -- validate approach before implementation

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] `/design-review` -- social feed is a high-visibility surface

## Handoff State

### Before This Work
No social features exist in MyWorkouts. No Supabase social tables. No feed, no follows, no likes, no comments. The `WorkoutSummaryCard` type from WO-021 (Workout Sharing) should exist before this feature is built (it is a dependency).

### After This Work
- 5 Supabase tables with RLS: posts, likes, comments, follows, privacy
- Privacy filter engine that strips sensitive data from posts based on user settings
- Feed query builder with pagination and followed-user filtering
- Post creation from workout completion flow
- Like/unlike with optimistic UI
- Comment thread with creation and display
- Follow/unfollow with profile display
- Onboarding flow for first-time social setup
- Realtime feed updates via Supabase subscriptions

### Files Changed
- `modules/workouts/src/social/types.ts` -- new file: all social entity types and Zod schemas
- `modules/workouts/src/social/privacy.ts` -- new file: privacy filter engine
- `modules/workouts/src/social/feed.ts` -- new file: feed query builder
- `modules/workouts/src/index.ts` -- export social module
- `supabase/migrations/YYYYMMDDHHMMSS_add_workouts_social.sql` -- Supabase migration
- `apps/mobile/app/(workouts)/social.tsx` -- social feed screen
- `apps/mobile/app/(workouts)/social-profile.tsx` -- user profile screen
- `apps/mobile/components/workouts/PostCard.tsx` -- post card component
- `apps/mobile/components/workouts/CommentThread.tsx` -- comment thread component
- `apps/web/app/workouts/social/page.tsx` -- web social feed
- `apps/web/app/workouts/social/[userId]/page.tsx` -- web user profile

### Known Limitations
- No content moderation in v1 (no report button, no spam detection).
- No push notifications for social interactions (likes, comments, new followers).
- No suggested follows algorithm (manual search only).
- No group workouts or challenges.
- Privacy settings are not retroactive (existing posts keep their original visibility).
- No block/mute functionality in v1.
- Feed is strictly chronological (no trending, no highlights).

### Context for Next Agent
This feature requires Supabase Auth to be fully integrated. The `@mylife/auth` package handles auth state. The social tables live in Supabase (not local SQLite) because they require multi-user data exchange. The `WorkoutSummaryCard` type from WO-021 must be created first since it serves as the `content` field in social posts. Realtime subscriptions use Supabase's `postgres_changes` channel. RLS policies are critical for security and must be tested thoroughly.
