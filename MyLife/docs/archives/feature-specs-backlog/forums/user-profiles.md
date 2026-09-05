# Feature Spec: User Profiles

## Metadata
- **Module:** forums
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [3] x1 + PaidUser [1] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (builds on existing fr_user_stats and fr_community_members)
- **Blocks:** Direct messaging (profiles needed as DM recipients)

## Business Context

### Why This Feature Exists
Community forums without user identity feel anonymous and disposable. User profiles give members a persistent identity across communities, build reputation through karma and contribution history, and create the social fabric that transforms a discussion board into a community. Both Discord and Reddit consider profiles foundational to engagement and retention.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Discord | Yes | Partial (Nitro for banners/animated avatars) | Display name, avatar, banner, bio, status, connected accounts, mutual servers, role badges |
| Reddit | Yes | Partial (Premium for avatar builder) | Username, avatar, banner, bio, karma score, trophy case, post/comment history, cake day |
| Lemmy | Yes | No | Username, bio, avatar, banner, post/comment history, joined communities, account age |

### Target User
Active community participants who want recognition for contributions. Reddit users (430M+ MAU) who are accustomed to karma systems and profile pages, or Discord users (200M+ MAU) who expect customizable profiles with status and badges. Users migrating from these platforms expect profile functionality as baseline.

## Technical Context

### Where This Lives in MyLife

```
modules/forums/src/
  types.ts                            -- New Zod schemas: UserProfile, ProfileBadge, ProfileStatus
  cloud/client.ts                     -- New cloud functions: profile CRUD, activity feed
  cloud/schema.sql                    -- New tables: fr_profiles, fr_profile_badges
  db/schema.ts                        -- New cache table: fr_profiles_cache
  db/crud.ts                          -- New cache CRUD for profiles
  definition.ts                       -- Migration v2 for profile cache table

apps/mobile/app/(forums)/
  user-profile.tsx                    -- MODIFIED: full profile screen (currently minimal)
  edit-profile.tsx                    -- NEW: profile editing screen
  activity-feed.tsx                   -- NEW: user's post/reply history

apps/web/app/forums/
  profile/[id]/page.tsx               -- NEW: public profile page
  profile/edit/page.tsx               -- NEW: profile editing page
```

### Wireframe Position

```
Hub Dashboard
  └── MyForums card
       └── Profile tab (5th tab, icon: user)
            └── My Profile ← YOU ARE HERE
                 ├── Avatar + Banner + Display Name
                 ├── Bio + Stats (karma, threads, replies, joined)
                 ├── Badge shelf
                 ├── Community list
                 ├── Recent Activity feed
                 └── Edit Profile button
```

Also accessible from:
1. Tapping any username in a thread or reply
2. Community member list
3. Profile tab in bottom navigation

### Data Model

```sql
-- New table: fr_profiles (Supabase cloud, Migration v2)
CREATE TABLE IF NOT EXISTS fr_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL UNIQUE,
  bio TEXT DEFAULT '' CHECK (char_length(bio) <= 500),
  avatar_url TEXT,
  banner_url TEXT,
  status_text TEXT DEFAULT '' CHECK (char_length(status_text) <= 100),
  status_emoji TEXT DEFAULT '',
  location TEXT DEFAULT '' CHECK (char_length(location) <= 100),
  website_url TEXT,
  karma INTEGER NOT NULL DEFAULT 0,
  thread_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  communities_joined INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Badge system
CREATE TABLE IF NOT EXISTS fr_profile_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES fr_profiles(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  badge_label TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, badge_type)
);

-- Indexes
CREATE INDEX idx_fr_profiles_username ON fr_profiles (username);
CREATE INDEX idx_fr_profiles_karma ON fr_profiles (karma DESC);
CREATE INDEX idx_fr_profile_badges_profile ON fr_profile_badges (profile_id);

-- RLS
ALTER TABLE fr_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are publicly readable" ON fr_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON fr_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON fr_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE fr_profile_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are publicly readable" ON fr_profile_badges FOR SELECT USING (true);

-- SQLite cache table (Migration v2)
-- Added to modules/forums/src/db/schema.ts
CREATE TABLE IF NOT EXISTS fr_profiles_cache (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL UNIQUE,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  banner_url TEXT,
  status_text TEXT DEFAULT '',
  status_emoji TEXT DEFAULT '',
  location TEXT DEFAULT '',
  website_url TEXT,
  karma INTEGER NOT NULL DEFAULT 0,
  thread_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  communities_joined INTEGER NOT NULL DEFAULT 0,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Dependencies
- **Internal:** `@mylife/db` (SQLite adapter), `@mylife/auth` (user identity), `@mylife/ui` (Cool Obsidian tokens, Avatar component)
- **External:** Supabase Storage for avatar/banner uploads, Supabase Auth for user_id linkage
- **Cross-Module:** `@mylife/social` for activity feed events. Profile display name/avatar could surface in hub-level user settings if users want a unified identity across modules.

## Functional Requirements

### User Stories
1. As a forum member, I want to create a profile with a display name, bio, and avatar so that other members can identify me.
2. As a forum member, I want to view other members' profiles to see their reputation, communities, and recent activity.
3. As a community participant, I want to earn badges for milestones (first post, 100 karma, etc.) so I feel rewarded for contributing.
4. As a forum browser, I want to see author profiles inline (avatar + name + karma) on threads and replies.

### Behavior Specification

1. **First-time setup:** When a user first opens MyForums and attempts a write action (post, reply, vote), the app checks for an existing fr_profiles row. If none exists, a profile creation modal appears with fields for display name, username, bio, and avatar upload.
2. **Username validation:** Usernames must be 3-30 characters, lowercase alphanumeric plus hyphens, unique across all profiles. Real-time availability check on keystroke (debounced 300ms).
3. **Avatar upload:** User selects an image from device gallery. Image is resized client-side to 256x256px, compressed to WebP, uploaded to Supabase Storage bucket `forum-avatars`. URL stored in fr_profiles.avatar_url.
4. **Banner upload:** Same flow as avatar but resized to 1200x400px. Stored in `forum-banners` bucket.
5. **Profile viewing:** Tapping any username anywhere in the forums opens the profile screen. Shows avatar, banner, display name, username, bio, stats (karma, threads, replies, communities joined, member since), badge shelf, list of joined communities, and paginated recent activity (threads + replies, newest first).
6. **Profile editing:** From own profile, tap "Edit Profile" to modify display name, bio, avatar, banner, status text, status emoji, location, website URL. Changes save immediately on field blur or explicit "Save" tap.
7. **Badge system:** Badges are server-computed via Supabase triggers. Badge types: `first_post` (first thread created), `first_reply`, `karma_100`, `karma_1000`, `karma_10000`, `veteran` (account > 1 year), `moderator` (has mod role in any community), `prolific` (100+ threads). Badges display as colored pills on profile.
8. **Inline author display:** Thread cards and reply cards show author avatar (24px circle), display name, and karma badge inline. Tapping opens full profile.
9. **Stats are live-computed:** fr_profiles stat columns (karma, thread_count, reply_count, communities_joined) are updated by Supabase triggers on inserts/deletes to fr_threads, fr_replies, fr_votes, and fr_community_members.

### Edge Cases

- **Username taken:** Show inline error "Username is taken" with red border. Do not allow save until resolved.
- **No avatar uploaded:** Show default gradient avatar generated from username hash (deterministic color).
- **Profile not yet created:** Show "Anonymous" with default avatar for posts created before profile system. Backfill profiles for existing users via migration script.
- **Very long bio:** Truncate display to 3 lines with "Show more" toggle. Input enforces 500-char limit.
- **Deleted account:** Profile row cascades on auth.users deletion. Threads/replies show "[deleted]" as author with no clickable profile.
- **Slow network on avatar upload:** Show upload progress indicator. If upload fails, keep previous avatar and show toast error.
- **Offensive content in bio/display name:** Content moderation is deferred to community moderators via existing report system. No automated filtering in v1.
- **Module disabled mid-view:** Profile screen gracefully returns to hub dashboard.
- **Viewing own profile vs others:** Edit button only visible on own profile. Block/report buttons visible on others' profiles.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can create a profile with display name, username, bio, and avatar from the profile tab
- [ ] **AC-2:** User can view any member's profile by tapping their name in threads, replies, or member lists
- [ ] **AC-3:** Profile displays avatar, banner, display name, username, bio, karma, thread count, reply count, communities joined, and member since date
- [ ] **AC-4:** Profile displays earned badges as colored pills below the bio
- [ ] **AC-5:** Profile shows paginated recent activity (threads + replies) sorted newest first
- [ ] **AC-6:** Profile shows list of communities the user has joined
- [ ] **AC-7:** User can edit own profile (display name, bio, avatar, banner, status, location, website)
- [ ] **AC-8:** Thread cards and reply cards display inline author avatar (24px), display name, and karma
- [ ] **AC-9:** Default gradient avatar is shown when no avatar is uploaded
- [ ] **AC-10:** Username availability is checked in real-time during profile creation/editing
- [ ] **AC-11:** Upload progress is shown during avatar/banner upload

### Technical Criteria
- [ ] **TC-1:** fr_profiles row is created on first write action if missing, with unique username constraint enforced
- [ ] **TC-2:** Avatar images are resized to 256x256 and converted to WebP before upload
- [ ] **TC-3:** Banner images are resized to 1200x400 and converted to WebP before upload
- [ ] **TC-4:** Karma, thread_count, reply_count, communities_joined are auto-updated by Supabase triggers
- [ ] **TC-5:** Badges are auto-assigned by Supabase triggers on milestone events
- [ ] **TC-6:** Profile data is cached in fr_profiles_cache for offline viewing
- [ ] **TC-7:** RLS policies allow public read, owner-only write
- [ ] **TC-8:** Username validation: 3-30 chars, lowercase alphanumeric + hyphens, unique
- [ ] **TC-9:** Profile activity feed paginates at 20 items per page with cursor-based pagination

### Negative Criteria
- [ ] **NC-1:** Users must NOT be able to edit another user's profile
- [ ] **NC-2:** Profile creation must NOT block read-only browsing (only required for write actions)
- [ ] **NC-3:** Deleted user profiles must NOT leave orphaned data -- cascade delete handles cleanup
- [ ] **NC-4:** Avatar/banner uploads must NOT accept files larger than 5MB

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Profile card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#F43F5E` (forums rose)
- Banner: full-width at top, 200px height, blurred bottom edge fading into background
- Avatar: 80px circle, positioned overlapping banner bottom edge, 3px `#F43F5E` border
- Display name: 20px bold, `#F0F0F5` (text token)
- Username: 14px, `rgba(240,240,245,0.65)` (textSecondary)
- Stats row: horizontal 4-column grid (karma, threads, replies, communities)
- Badge shelf: horizontal scroll of pill components, each with icon + label
- Activity feed: vertical list with thread/reply cards matching existing forums card style

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Profile accessible via `/forums/profile/[id]`
- Two-column layout: left sidebar (avatar, stats, badges, communities), right main area (bio, activity feed)
- Banner spans full content width
- Edit profile at `/forums/profile/edit`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton placeholder for avatar, name, stats, activity | Initial profile fetch |
| Empty | "No activity yet" with illustration | User has no threads or replies |
| Error | "Could not load profile" with retry button | Network failure |
| Success | Full profile with all sections populated | Data loaded |
| Partial | Profile header loaded, activity feed still loading spinner | Staggered fetch |

## Test Requirements

### Unit Tests
- [ ] Username validation: accepts valid usernames (alphanumeric, hyphens, 3-30 chars)
- [ ] Username validation: rejects invalid usernames (spaces, uppercase, too short/long, special chars)
- [ ] Default avatar color generation: deterministic for same username
- [ ] Badge eligibility check: correctly identifies milestone badges
- [ ] Profile schema validation: accepts valid profile data
- [ ] Profile schema validation: rejects bio > 500 chars, status_text > 100 chars

### Integration Tests
- [ ] Full flow: create profile -> view profile -> edit profile -> changes persisted
- [ ] Badge assignment: create first thread -> fr_profile_badges gains `first_post` row
- [ ] Stats update: create thread -> profile thread_count increments
- [ ] Cache sync: profile fetched from cloud -> cached locally -> available offline
- [ ] Error flow: network failure during avatar upload -> previous avatar preserved, toast shown

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyForums via hub dashboard
3. Tap the Profile tab (5th tab)
4. Verify: profile creation form appears with display name, username, bio, avatar fields -- corresponds to AC-1
5. Enter display name "Test User", username "test-user", bio "Hello world"
6. Verify: username shows green checkmark (available) -- corresponds to AC-10
7. Try username "a" (too short) -- verify red error message
8. Upload an avatar image
9. Verify: upload progress indicator appears -- corresponds to AC-11
10. Tap "Create Profile"
11. Verify: full profile screen appears with all entered data + default stats (0 karma, 0 threads) -- corresponds to AC-3
12. Verify: default badge shelf is empty or shows only account creation badge -- corresponds to AC-4
13. Navigate to a community, create a thread
14. Return to profile
15. Verify: thread_count now shows 1, activity feed shows the thread -- corresponds to AC-5
16. Tap "Edit Profile", change bio to "Updated bio"
17. Verify: bio updates immediately on save -- corresponds to AC-7
18. Navigate to a thread by another user, tap their username
19. Verify: their profile opens with their stats and activity -- corresponds to AC-2
20. Verify: no "Edit Profile" button on another user's profile -- corresponds to NC-1
21. On web, navigate to `/forums/profile/[id]`
22. Verify: two-column layout with same data as mobile -- corresponds to AC-3
23. Toggle airplane mode
24. Navigate to a previously viewed profile
25. Verify: cached profile data displays (may show stale stats) -- corresponds to TC-6

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the profile tab, create profile, edit profile, view other profiles, verify all 5 states
- [ ] Batch QA: after 5 features in forums module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] Not applicable (Complexity = 3)

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The forums module has a Profile tab and a `user-profile` screen in navigation, but no profile data model beyond `fr_user_stats` (which only tracks aggregate counts). Thread and reply cards show `authorId` (UUID) with no display name or avatar resolution.

### After This Work
Full profile system with Supabase cloud table, SQLite cache, avatar/banner uploads, badge system, activity feed, inline author display on all thread/reply cards, and profile creation flow for new users.

### Files Changed
- `modules/forums/src/types.ts` -- Added UserProfile, ProfileBadge, ProfileStatus schemas
- `modules/forums/src/cloud/schema.sql` -- Added fr_profiles, fr_profile_badges tables with RLS and triggers
- `modules/forums/src/cloud/client.ts` -- Added profile CRUD and activity feed cloud functions
- `modules/forums/src/db/schema.ts` -- Added fr_profiles_cache table
- `modules/forums/src/db/crud.ts` -- Added profile cache CRUD functions
- `modules/forums/src/definition.ts` -- Migration v2 for fr_profiles_cache
- `apps/mobile/app/(forums)/user-profile.tsx` -- Full profile screen with all sections
- `apps/mobile/app/(forums)/edit-profile.tsx` -- Profile editing screen
- `apps/mobile/app/(forums)/activity-feed.tsx` -- User activity history
- `apps/web/app/forums/profile/[id]/page.tsx` -- Public profile web page
- `apps/web/app/forums/profile/edit/page.tsx` -- Profile editing web page

### Known Limitations
- No automated content moderation for bios/display names (relies on community reporting)
- No profile privacy settings (all profiles are public in v1)
- No profile cover video (images only in v1)
- Badge system is server-side only with no real-time push to client on badge earn

### Context for Next Agent
The fr_profiles table becomes the identity backbone for all subsequent social features (direct messaging, voice channels). The `user_id` column links to Supabase auth.users, and the `id` column is the foreign key used by other forum tables. When building Direct Messaging, use fr_profiles.id as the participant identifier, not auth.users.id directly.
