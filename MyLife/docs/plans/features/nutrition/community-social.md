# Feature Spec: Community/Social

## Metadata
- **Module:** nutrition
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 2 x3 + Complexity 0 x2 + CrossModule 2 x1 + PaidUser 1 x1
- **Sprint:** 8
- **Estimated CC Time:** 8-10 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
MyFitnessPal's community features (forums, challenges, social feed) are a core retention lever across their 220M registered users. Community/social features in calorie trackers drive accountability and long-term habit formation. Users who have social accountability are significantly more likely to sustain tracking behavior. This is a high-market-presence feature (4/5) but moderate switching motivator (2/5) because users rarely switch apps just for community. Complexity is 0 (massive) because it requires a user identity system, content moderation pipeline, feed infrastructure, and privacy-first social graph. The privacy-first constraint is what makes this especially challenging: MyLife must provide social accountability without the data harvesting that competitors rely on.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| MyFitnessPal | Yes | Partial | Community forums, friends feed, group challenges, social sharing, status updates |
| Lose It! | Yes | Partial ($39.99/yr) | Community challenges, groups, social feed, streak sharing |
| Cronometer | Minimal | No | Basic sharing/export, no in-app community |
| MacroFactor | No | N/A | No social features at all |

### Target User
Users who want accountability partners for their nutrition goals but don't want their food diary data harvested or sold. Fitness-minded people who are motivated by seeing friends' streaks and progress. Couples, roommates, or workout partners who eat together and want to share meal plans. Users migrating from MyFitnessPal who rely on community challenge features for motivation.

## Technical Context

### Where This Lives in MyLife

```
modules/nutrition/src/community/types.ts        -- Community data types
modules/nutrition/src/community/profiles.ts      -- Privacy-controlled profile CRUD
modules/nutrition/src/community/connections.ts   -- Friend/connection management
modules/nutrition/src/community/sharing.ts       -- Selective diary sharing engine
modules/nutrition/src/community/challenges.ts    -- Challenge creation and tracking
modules/nutrition/src/community/feed.ts          -- Activity feed aggregation
modules/nutrition/src/community/index.ts         -- Barrel export
modules/nutrition/src/db/schema.ts               -- New nu_community_* tables (V5)
modules/nutrition/src/db/migrations.ts           -- V5 migration
modules/nutrition/src/models/schemas.ts          -- Zod schemas for community types
modules/nutrition/src/index.ts                   -- Updated exports
apps/mobile/app/(nutrition)/community.tsx        -- Community hub screen
apps/mobile/app/(nutrition)/community-profile.tsx -- Profile view
apps/mobile/app/(nutrition)/community-challenge.tsx -- Challenge detail screen
apps/mobile/app/(nutrition)/community-feed.tsx   -- Activity feed screen
apps/web/app/nutrition/community/page.tsx        -- Web community hub
apps/web/app/nutrition/community/[id]/page.tsx   -- Web challenge detail
```

### Wireframe Position

```
Hub Dashboard
  └── MyNutrition card
       └── [New] Community tab (after Trends, before Settings)
            ├── Activity Feed (friends' public activity)
            ├── My Connections (friend list, requests)
            ├── Challenges (active + browse)
            │    ├── Challenge Detail (leaderboard, progress)
            │    └── Create Challenge
            └── My Profile (sharing settings)
```

### Data Model

```sql
-- V5 Migration: Community/Social tables

-- User community profile (privacy-controlled public face)
CREATE TABLE IF NOT EXISTS nu_community_profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    avatar_emoji TEXT NOT NULL DEFAULT '🥦',
    bio TEXT,
    share_streaks INTEGER NOT NULL DEFAULT 1,      -- Share streak count publicly
    share_goals INTEGER NOT NULL DEFAULT 0,         -- Share goal targets
    share_calories INTEGER NOT NULL DEFAULT 0,      -- Share daily calorie totals
    share_macros INTEGER NOT NULL DEFAULT 0,        -- Share macro breakdown
    share_weight INTEGER NOT NULL DEFAULT 0,        -- Share weight progress
    profile_visibility TEXT NOT NULL DEFAULT 'connections'
        CHECK (profile_visibility IN ('private', 'connections', 'public')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Connection graph (follow/friend model)
CREATE TABLE IF NOT EXISTS nu_community_connections (
    id TEXT PRIMARY KEY,
    from_profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    to_profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Shared activity feed items
CREATE TABLE IF NOT EXISTS nu_community_feed (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL
        CHECK (activity_type IN ('streak', 'goal_hit', 'challenge_joined', 'challenge_complete', 'milestone', 'custom')),
    title TEXT NOT NULL,
    body TEXT,
    metadata_json TEXT,              -- Flexible JSON payload per activity_type
    visibility TEXT NOT NULL DEFAULT 'connections'
        CHECK (visibility IN ('private', 'connections', 'public')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Challenges (group accountability)
CREATE TABLE IF NOT EXISTS nu_community_challenges (
    id TEXT PRIMARY KEY,
    creator_profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    challenge_type TEXT NOT NULL
        CHECK (challenge_type IN ('streak', 'calorie_target', 'protein_target', 'water_target', 'log_streak', 'custom')),
    target_value REAL,                -- e.g., 7 for "7-day streak", 150 for "150g protein"
    target_unit TEXT,                 -- e.g., 'days', 'g', 'ml'
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    max_participants INTEGER DEFAULT 50,
    join_type TEXT NOT NULL DEFAULT 'invite'
        CHECK (join_type IN ('open', 'invite', 'approval')),
    status TEXT NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Challenge participants
CREATE TABLE IF NOT EXISTS nu_community_challenge_members (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES nu_community_challenges(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES nu_community_profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('creator', 'member')),
    current_value REAL NOT NULL DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS nu_cc_from_idx ON nu_community_connections(from_profile_id);
CREATE INDEX IF NOT EXISTS nu_cc_to_idx ON nu_community_connections(to_profile_id);
CREATE INDEX IF NOT EXISTS nu_cc_status_idx ON nu_community_connections(status);
CREATE UNIQUE INDEX IF NOT EXISTS nu_cc_pair_idx ON nu_community_connections(from_profile_id, to_profile_id);
CREATE INDEX IF NOT EXISTS nu_cf_profile_idx ON nu_community_feed(profile_id);
CREATE INDEX IF NOT EXISTS nu_cf_created_idx ON nu_community_feed(created_at);
CREATE INDEX IF NOT EXISTS nu_cf_type_idx ON nu_community_feed(activity_type);
CREATE INDEX IF NOT EXISTS nu_cch_status_idx ON nu_community_challenges(status);
CREATE INDEX IF NOT EXISTS nu_cch_dates_idx ON nu_community_challenges(start_date, end_date);
CREATE INDEX IF NOT EXISTS nu_ccm_challenge_idx ON nu_community_challenge_members(challenge_id);
CREATE INDEX IF NOT EXISTS nu_ccm_profile_idx ON nu_community_challenge_members(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS nu_ccm_pair_idx ON nu_community_challenge_members(challenge_id, profile_id);
```

### Dependencies
- **Internal:** `@mylife/module-registry` (new nav tab + screens), `@mylife/db` (migration V5), `@mylife/ui` (Cool Obsidian tokens, glass cards, list components)
- **External:** None. All community data is local-first. No server required for MVP (local device social = share codes, QR-based friend connect).
- **Cross-Module:** Could surface in `workouts` (shared workout challenges), `fast` (fasting streaks), `habits` (habit accountability). Cross-module scoring = 2/5. Initial implementation is nutrition-only; cross-module hooks are a future extension.

## Functional Requirements

### User Stories
1. As a nutrition tracker, I want to create a community profile so that I can share selected progress with friends.
2. As a user, I want to connect with friends via share code so that we can see each other's activity without exposing personal data by default.
3. As a user, I want granular control over what I share (streaks, calories, macros, goals, weight) so that I only reveal what I'm comfortable with.
4. As a user, I want to see an activity feed of my connections' shared milestones so that I feel accountability and motivation.
5. As a user, I want to create or join group challenges (e.g., "7-day protein challenge") so that I have a concrete goal with friends.
6. As a user, I want to see a leaderboard within a challenge so that friendly competition keeps me engaged.
7. As a user, I want to block or remove a connection so that I control my social experience.
8. As a user, I want to share a challenge invite via system share sheet so that I can invite friends who may not have the app yet.

### Behavior Specification

**Profile Setup Flow:**
1. User navigates to the Community tab for the first time
2. System shows a setup wizard: choose display name, pick avatar emoji, set sharing preferences (checkboxes for streaks/goals/calories/macros/weight)
3. User taps "Create Profile"
4. System generates a unique 8-character share code (e.g., `NUTR-A3K9`)
5. Profile is saved to `nu_community_profiles`
6. User lands on the community hub (empty state with "Invite friends" CTA)

**Connection Flow:**
1. User A taps "Add Connection"
2. Options: "Enter share code" or "Show my code" (displays code + QR)
3. User A enters User B's share code
4. System creates a `nu_community_connections` row with status `pending`
5. User B sees a pending request in their Connections section
6. User B taps Accept or Decline
7. If accepted: status updates to `accepted`, both users appear in each other's feed
8. If declined: row is deleted

**Activity Feed:**
1. System auto-generates feed items when a connected user hits milestones:
   - Logging streak milestone (3, 7, 14, 30, 60, 90, 180, 365 days)
   - Hit daily calorie goal
   - Hit daily protein/macro target
   - Joined or completed a challenge
2. Feed shows items from accepted connections only
3. Items respect the poster's sharing preferences (if they disabled calorie sharing, no calorie-related items appear)
4. Feed is sorted reverse chronological
5. User can "cheer" (single reaction) a feed item -- stored locally, no server needed

**Challenge Flow:**
1. User taps "Create Challenge"
2. Fills in: title, type (streak/calorie/protein/water/log-streak/custom), target, start date, end date, join type (open/invite/approval)
3. System creates `nu_community_challenges` row + creator as first member
4. Creator shares challenge invite code via share sheet
5. Other users enter invite code to join
6. During challenge: each user's progress is tracked in `nu_community_challenge_members.current_value`
7. Progress updates happen automatically when relevant logs are added (e.g., logging food increments a log-streak challenge)
8. Challenge detail screen shows leaderboard sorted by current_value
9. When end_date passes, status changes to `completed`, winner is determined by highest current_value

### Edge Cases
- **No profile yet:** Community tab shows setup wizard. All other community screens redirect to setup.
- **Empty connections:** Show "Invite your first friend" with share code prominently displayed.
- **Empty feed:** Show motivational message: "Connect with friends to see their progress here."
- **Duplicate connection request:** If A already sent request to B, show "Request already pending."
- **Self-connection:** Reject entering own share code with "That's your own code!"
- **Blocked user sends request:** Silently ignore (do not reveal block status).
- **Challenge with 0 participants besides creator:** Still valid. Show "Waiting for participants."
- **Challenge end date in the past when creating:** Reject with validation error.
- **Challenge start date after end date:** Reject with validation error.
- **User disables module mid-challenge:** Challenge membership preserved but progress stops updating. Rejoining the module resumes from where they left off.
- **Profile deletion:** Cascade deletes all connections, feed items, and challenge memberships. Other users see "[Deleted User]" in historical feed items.
- **Max participants reached:** Show "Challenge is full" when trying to join.
- **Very long display name:** Truncate at 30 characters.
- **Empty bio:** Valid, bio is optional.
- **Changing sharing preferences after connections exist:** Immediately hides/shows relevant feed items on next feed load. Does not delete historical items but filters them from view.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Tapping the Community tab for the first time shows the profile setup wizard
- [ ] **AC-2:** After creating a profile, user sees their 8-character share code
- [ ] **AC-3:** Entering another user's share code sends a connection request
- [ ] **AC-4:** Accepting a connection request makes both users appear in each other's feed
- [ ] **AC-5:** Declining a connection request removes it from the pending list
- [ ] **AC-6:** Blocking a connection removes them from feed and connections list
- [ ] **AC-7:** Activity feed shows reverse-chronological items from accepted connections
- [ ] **AC-8:** Feed items respect the poster's sharing preferences (hidden items are not shown)
- [ ] **AC-9:** "Cheer" reaction on a feed item shows visual confirmation
- [ ] **AC-10:** Creating a challenge shows it in the Challenges section
- [ ] **AC-11:** Sharing a challenge invite code via system share sheet works on iOS and Android
- [ ] **AC-12:** Joining a challenge via invite code adds user to the challenge members
- [ ] **AC-13:** Challenge leaderboard shows all participants sorted by progress
- [ ] **AC-14:** Logging relevant nutrition data (food, water) automatically updates challenge progress
- [ ] **AC-15:** Past-end-date challenges show "Completed" status with final standings
- [ ] **AC-16:** Profile edit screen allows changing display name, emoji, bio, and all sharing toggles
- [ ] **AC-17:** The Community tab icon appears in the navigation after Trends and before Settings

### Technical Criteria
- [ ] **TC-1:** V5 migration creates all 5 community tables with correct schema
- [ ] **TC-2:** V5 migration is idempotent (running twice does not error)
- [ ] **TC-3:** All CRUD operations for profiles, connections, feed, challenges persist correctly in SQLite
- [ ] **TC-4:** Share code generation produces unique 8-character codes with format `NUTR-XXXX`
- [ ] **TC-5:** Connection uniqueness constraint prevents duplicate requests between same pair
- [ ] **TC-6:** Challenge progress auto-updates happen within the same transaction as the food/water log insert
- [ ] **TC-7:** Feed query filters by connection status AND poster's sharing preferences in a single query
- [ ] **TC-8:** All community tables use `nu_` prefix consistently
- [ ] **TC-9:** Cascade deletes work correctly: deleting a profile removes all related rows
- [ ] **TC-10:** Zod schemas validate all community input types correctly

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** A user's calorie/macro/weight data must NOT be visible to connections if the corresponding sharing toggle is off
- [ ] **NC-2:** Blocked users must NOT see any of the blocker's feed items or profile
- [ ] **NC-3:** Community features must NOT require network connectivity for core operations (local-first)
- [ ] **NC-4:** Community data must NOT be included in CSV exports from the export feature
- [ ] **NC-5:** Challenge progress must NOT be modifiable directly (only updated via logged nutrition activity)
- [ ] **NC-6:** A user who has not created a profile must NOT be able to access any community screen besides setup

## UI Specification

### Mobile (Expo)

**Community Hub Screen (community.tsx):**
- Background: `#0A0A0F` (background token)
- Three section cards in glass style: Activity Feed, My Connections, Challenges
- Each section card: `rgba(255,255,255,0.04)` fill, `rgba(255,255,255,0.10)` border, 12px radius
- Module accent: `#F97316` (nutrition orange) for active states, CTAs
- Top area: user's profile card with avatar emoji (large, 48px), display name, share code (tappable to copy)

**Activity Feed Screen (community-feed.tsx):**
- Full-screen scrollable list of feed items
- Each item: glass card with avatar emoji, display name, activity description, timestamp
- "Cheer" button (heart icon) on each item, accent color when active
- Pull-to-refresh gesture

**Challenge Detail Screen (community-challenge.tsx):**
- Header: challenge title, type badge, date range, progress ring
- Leaderboard: ranked list of members with avatar, name, progress bar, current_value
- Own position highlighted with accent border
- "Share Invite" button at bottom (system share sheet)

**Profile Setup Wizard:**
- Step 1: Display name input + avatar emoji picker (grid of 20 food/fitness emojis)
- Step 2: Sharing preference toggles (5 toggles with clear labels and descriptions)
- Step 3: Confirmation with share code display

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Sidebar navigation: Community accessible via `/nutrition/community`
- Two-column layout: feed on left (wider), profile/connections/challenges sidebar on right
- Challenge detail at `/nutrition/community/[id]`
- Responsive: collapses to single column below 768px

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards with pulse animation | Initial data fetch |
| Empty (no profile) | Setup wizard with step indicator | First visit to Community tab |
| Empty (no connections) | Share code card + "Invite friends" CTA | Profile exists but no connections |
| Empty (no feed) | "Connect with friends to see activity" message | Connections exist but no feed items yet |
| Error | "Something went wrong" + retry button | Database read failure |
| Success | Full feed, connections list, active challenges | Normal state with data |
| Partial | Feed items loading while connections list is ready | Staggered data loads |

## Test Requirements

### Unit Tests
- [ ] `createProfile`: creates profile with valid input, returns share code
- [ ] `createProfile`: rejects empty display name
- [ ] `createProfile`: rejects display name over 30 characters
- [ ] `generateShareCode`: produces 8-char code in `NUTR-XXXX` format
- [ ] `generateShareCode`: produces unique codes across 1000 iterations
- [ ] `sendConnectionRequest`: creates pending connection row
- [ ] `sendConnectionRequest`: rejects duplicate request
- [ ] `sendConnectionRequest`: rejects self-connection
- [ ] `acceptConnection`: updates status to accepted
- [ ] `blockConnection`: updates status to blocked
- [ ] `blockConnection`: prevents future requests from blocked user
- [ ] `getFeed`: returns items from accepted connections only
- [ ] `getFeed`: respects poster sharing preferences
- [ ] `getFeed`: returns items in reverse chronological order
- [ ] `createChallenge`: creates challenge with valid input
- [ ] `createChallenge`: rejects end_date before start_date
- [ ] `createChallenge`: rejects past end_date
- [ ] `joinChallenge`: adds member to challenge
- [ ] `joinChallenge`: rejects when max_participants reached
- [ ] `joinChallenge`: rejects duplicate join
- [ ] `updateChallengeProgress`: increments current_value correctly
- [ ] `getChallengeLeaderboard`: returns members sorted by current_value desc

### Integration Tests
- [ ] Full flow: create profile -> send request -> accept -> log food -> feed item appears
- [ ] Full flow: create challenge -> join -> log food -> progress updates -> challenge completes
- [ ] Error flow: database constraint violation -> graceful error message -> user can retry
- [ ] Privacy flow: disable calorie sharing -> calorie-related feed items hidden from connections

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyNutrition module
3. Tap the Community tab
4. Verify: setup wizard appears with display name input -- corresponds to AC-1
5. Enter "TestUser" as display name, pick avocado emoji, enable streaks sharing only
6. Tap "Create Profile"
7. Verify: share code displayed in format `NUTR-XXXX` -- corresponds to AC-2
8. Tap share code to copy
9. Verify: "Copied!" toast appears
10. On a second device/simulator, create another profile "FriendUser"
11. On FriendUser: tap "Add Connection", enter TestUser's share code
12. Verify: request sent confirmation -- corresponds to AC-3
13. On TestUser: navigate to Connections, verify pending request from FriendUser
14. Tap Accept
15. Verify: FriendUser appears in connections list -- corresponds to AC-4
16. On FriendUser: log 3 consecutive days of food to trigger a streak milestone
17. On TestUser: navigate to Activity Feed
18. Verify: FriendUser's streak milestone appears in feed -- corresponds to AC-7
19. Tap "Cheer" on the feed item
20. Verify: heart icon fills with accent color -- corresponds to AC-9
21. On TestUser: tap "Create Challenge"
22. Fill in: "7-Day Protein Challenge", type=protein_target, target=150, start=today, end=7 days, join=invite
23. Verify: challenge appears in Challenges section -- corresponds to AC-10
24. Tap "Share Invite" and verify system share sheet opens -- corresponds to AC-11
25. On FriendUser: join the challenge via invite code
26. Verify: FriendUser appears on leaderboard -- corresponds to AC-12, AC-13
27. On FriendUser: log a meal with 50g protein
28. Verify: challenge progress updates to 50 -- corresponds to AC-14
29. On FriendUser: go to profile settings, disable streak sharing
30. On TestUser: refresh feed
31. Verify: FriendUser's streak items are no longer visible -- corresponds to AC-8
32. On TestUser: block FriendUser from connections
33. Verify: FriendUser removed from connections and feed -- corresponds to AC-6

## gstack Quality Gates

Based on this feature's complexity score of 0 (Massive), ALL gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for challenge progress tracking engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The nutrition module has 4 schema versions across 14+ tables covering foods, nutrients, food logging, goals, settings, barcode cache, photo log, water tracking, energy balance, daily notes, and restaurants. There are no community or social features. The module has 5 navigation tabs (Diary, Search, Dashboard, Trends, Settings) and 12 screens. All data is entirely local and private.

### After This Work
A V5 migration adds 5 community tables (`nu_community_profiles`, `nu_community_connections`, `nu_community_feed`, `nu_community_challenges`, `nu_community_challenge_members`). A new Community tab is added to navigation (6 tabs total). 4 new screens are wired (community hub, profile, challenge detail, feed). Users can create profiles, connect via share codes, see activity feeds, and participate in group challenges. All community data remains local-first with no server dependency.

### Files Changed

- `modules/nutrition/src/community/types.ts` -- Community type definitions
- `modules/nutrition/src/community/profiles.ts` -- Profile CRUD + share code generation
- `modules/nutrition/src/community/connections.ts` -- Connection request/accept/block logic
- `modules/nutrition/src/community/sharing.ts` -- Sharing preference enforcement
- `modules/nutrition/src/community/challenges.ts` -- Challenge CRUD + progress tracking
- `modules/nutrition/src/community/feed.ts` -- Feed aggregation + filtering
- `modules/nutrition/src/community/index.ts` -- Barrel export
- `modules/nutrition/src/db/schema.ts` -- V5 community tables added
- `modules/nutrition/src/db/migrations.ts` -- V5 migration added
- `modules/nutrition/src/models/schemas.ts` -- Zod schemas for community types
- `modules/nutrition/src/definition.ts` -- Community tab + screens added, schemaVersion bumped to 5
- `modules/nutrition/src/index.ts` -- Community exports added
- `apps/mobile/app/(nutrition)/community.tsx` -- Community hub screen
- `apps/mobile/app/(nutrition)/community-profile.tsx` -- Profile view/edit
- `apps/mobile/app/(nutrition)/community-challenge.tsx` -- Challenge detail + leaderboard
- `apps/mobile/app/(nutrition)/community-feed.tsx` -- Activity feed screen
- `apps/web/app/nutrition/community/page.tsx` -- Web community hub
- `apps/web/app/nutrition/community/[id]/page.tsx` -- Web challenge detail

### Known Limitations
- **Local-first only:** MVP does not sync community data across devices. Cross-device sync requires a server component (future work).
- **No real-time updates:** Feed and challenge progress are fetched on navigation, not pushed in real-time.
- **No content moderation:** Display names and challenge titles are not filtered for profanity. A future version should add a basic content filter.
- **No notifications:** Users are not notified of connection requests or challenge invites outside of the app. Push notifications are a future addition.
- **Single-device social graph:** Because all data is on-device, the "social" aspect requires both users to be on the same physical device network for share code exchange (or manual code entry). A cloud relay for share codes is a future enhancement.
- **No cross-module challenges:** Initial implementation supports nutrition-only challenge types. Extending to workouts/fasting/habits challenges is a natural next step.

### Context for Next Agent
- The `nu_` prefix is mandatory for all new tables. Check `modules/nutrition/src/definition.ts` for `tablePrefix: 'nu_'`.
- The migration system uses sequential version numbers. V4 is the current latest. This feature is V5.
- Share code generation should use `crypto.randomUUID().slice(0,4).toUpperCase()` formatted as `NUTR-XXXX` for simplicity.
- The challenge progress engine is the most complex piece. It needs to hook into existing food log and water log insert functions to auto-increment participant progress. Use a post-insert callback pattern rather than database triggers to keep it testable.
- Feed item generation should be event-driven: when a milestone is hit (streak, goal), create a feed item immediately. Do not batch-compute feed items.
- Privacy enforcement (sharing preferences) must happen at query time, not at write time. Always write feed items, but filter them based on the poster's current preferences when reading. This allows users to change preferences and immediately see the effect.
