# Feature Spec: Community Forums (Cycle)

## Metadata
- **Module:** cycle (cross-module with forums)
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 2 x3 + Complexity 0 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** 3-4
- **Estimated CC Time:** 3-5 hours
- **Depends On:** `@mylife/forums` module must be wired and functional (Supabase cloud + local cache)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Period tracking is deeply personal, and users need a safe space to discuss symptoms, experiences, and questions without judgment or data harvesting. Flo's community forums (called "Secret Chats") are one of their highest-engagement features, with anonymous peer support driving daily active usage beyond just logging. MyLife's existing `@mylife/forums` module provides the full forum infrastructure (threaded discussions, voting, moderation, anonymous mode). This feature wires a pre-seeded, Cycle-linked community into the MyCycle module so users can access peer support without leaving the cycle tracking context.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Flo | Yes | Partially ($49.99/yr) | "Secret Chats" with anonymous posting, topic-based channels, moderated by health experts. Premium unlocks more topics. 440M registered users drive massive engagement. |
| Clue | No | N/A | No built-in community. Relies on external blog content and social media. |
| Natural Cycles | No | N/A | No community features. Pure tracking + contraception focus. |
| Ovia | Yes | No (free) | Community forums organized by due date groups and topics. Employer-sponsored model subsidizes costs. |

### Target User
People who track their cycles and want to ask questions, share experiences, or find solidarity around menstrual health, fertility, pregnancy, and symptom management. Especially valuable for: (1) users with irregular cycles or PCOS who want peer support, (2) TTC (trying to conceive) users who want to compare chart patterns, (3) users new to cycle tracking who have basic questions, and (4) users going through pregnancy who want trimester-specific community. These users currently rely on Reddit (r/periods, r/TryingForABaby, r/BabyBumps) or Flo's Secret Chats, both of which either lack privacy or require a separate paid app.

## Technical Context

### Where This Lives in MyLife

This feature is a **cross-module integration** between `@mylife/cycle` and `@mylife/forums`. No new tables are created in the Cycle module. Instead, the Cycle module gets UI entry points that deep-link into the Forums module with a pre-filtered `linkedModuleId: 'cycle'` community.

```
modules/cycle/src/                          -- No schema changes needed
modules/forums/src/cloud/client.ts          -- Existing: getCommunitiesByModule() query
apps/mobile/app/(cycle)/community.tsx       -- New screen: embedded forum view for cycle
apps/mobile/app/(cycle)/_layout.tsx         -- Updated: add community tab or entry point
apps/web/app/cycle/community/page.tsx       -- New page: web community view for cycle
apps/web/app/cycle/community/[threadId]/page.tsx  -- Thread detail within cycle context
```

### Wireframe Position

```
Hub Dashboard
  +-- MyCycle card
       +-- Today tab
       +-- Calendar tab
       +-- Insights tab
       +-- Community tab (or button on Today) <-- YOU ARE HERE
            +-- Feed (threads in cycle-linked communities)
            +-- Create Thread
            +-- Thread Detail (replies, voting)
```

Two navigation options (agent should implement Option A unless lead overrides):

**Option A - Tab addition:** Add a 5th tab "Community" with icon `message-circle` to the MyCycle navigation. This makes community a first-class feature within the cycle module.

**Option B - Settings entry:** Add a "Community" link in the Settings tab that navigates to the forums module filtered to cycle communities. Lower prominence, lower risk of scope creep.

### Data Model

**No new Cycle-module tables.** This feature uses the existing `@mylife/forums` infrastructure:

- `fr_communities` (cloud, Supabase) -- The community is created with `linkedModuleId = 'cycle'`
- `fr_threads`, `fr_replies`, `fr_votes` (cloud) -- Standard forum operations
- `fr_communities_cache`, `fr_threads_cache` etc. (local SQLite) -- Offline browsing cache

A **seed community** must be created in Supabase during module setup:

```sql
-- Seed community for MyCycle (run once via Supabase migration or seed script)
INSERT INTO fr_communities (id, creator_id, name, display_name, description, community_type, linked_module_id, member_count, thread_count, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',  -- system user
  'mycycle',
  'MyCycle Community',
  'Discuss periods, fertility, symptoms, and reproductive health with fellow MyCycle users. Anonymous posting supported.',
  'public',
  'cycle',
  0,
  0,
  now(),
  now()
);

-- Seed community rules
INSERT INTO fr_community_rules (id, community_id, title, description, position)
VALUES
  (gen_random_uuid(), [community_id], 'Be respectful', 'Treat everyone with kindness. No shaming, judgment, or dismissive language about anyone''s body or experience.', 0),
  (gen_random_uuid(), [community_id], 'No medical advice', 'Share experiences, not diagnoses. Encourage professional consultation for medical concerns.', 1),
  (gen_random_uuid(), [community_id], 'Protect privacy', 'Do not share others'' personal information. Use anonymous mode for sensitive topics.', 2),
  (gen_random_uuid(), [community_id], 'Stay on topic', 'Discussions should relate to menstrual health, fertility, pregnancy, or cycle tracking.', 3);

-- Seed tags
INSERT INTO fr_tags (id, community_id, name, color)
VALUES
  (gen_random_uuid(), [community_id], 'periods', '#F472B6'),
  (gen_random_uuid(), [community_id], 'fertility', '#A78BFA'),
  (gen_random_uuid(), [community_id], 'ttc', '#34D399'),
  (gen_random_uuid(), [community_id], 'pregnancy', '#FB923C'),
  (gen_random_uuid(), [community_id], 'pcos', '#F87171'),
  (gen_random_uuid(), [community_id], 'symptoms', '#60A5FA'),
  (gen_random_uuid(), [community_id], 'question', '#FBBF24');
```

### Dependencies
- **Internal:** `@mylife/forums` (forum infrastructure, cloud client, cache CRUD), `@mylife/auth` (user identity for posting), `@mylife/module-registry` (module linking)
- **External:** Supabase (cloud storage for forum data, auth for write operations)
- **Cross-Module:** This is the first module-linked community. The `linkedModuleId` field on `fr_communities` is the integration seam. The Forums module already supports this field. Future modules (workouts, recipes, etc.) can follow the same pattern.

## Functional Requirements

### User Stories
1. As a MyCycle user, I want to browse community discussions about menstrual health so that I can learn from others' experiences without leaving the cycle tracker.
2. As a MyCycle user, I want to post questions anonymously so that I can ask sensitive health questions without revealing my identity.
3. As a MyCycle user, I want to filter threads by tags (periods, fertility, TTC, pregnancy, PCOS, symptoms) so that I can find relevant discussions quickly.
4. As a MyCycle user, I want to upvote helpful replies so that the best advice surfaces to the top.
5. As a MyCycle user, I want to bookmark threads so that I can return to useful discussions later.
6. As a MyCycle user, I want to report inappropriate content so that the community stays safe.

### Behavior Specification

#### First-time experience (unauthenticated)
1. User opens MyCycle and taps the Community tab
2. System checks if `@mylife/forums` module is enabled
   - If not enabled: show a card explaining "Enable MyForums to join the MyCycle community" with an "Enable" button that activates the forums module
   - If enabled: proceed to step 3
3. System fetches threads from the cycle-linked community via `getThreadsByCommunity()` with `linkedModuleId: 'cycle'`
4. User sees a feed of threads sorted by recent activity (default) or top-voted
5. User can browse threads and read replies without authentication
6. Tapping "Create Thread" or "Reply" prompts authentication via `@mylife/auth`

#### Creating a thread
1. User taps "New Thread" (floating action button or header button)
2. If not authenticated, auth flow triggers first
3. User enters title (3-300 chars) and body (up to 40,000 chars)
4. User optionally selects one or more tags from the pre-seeded list
5. User optionally toggles "Post anonymously" (if the forums module supports anonymous mode)
6. User taps "Post"
7. Thread is created via `createThread()` cloud client
8. Local cache is updated
9. User returns to feed with their new thread at the top

#### Reading and replying
1. User taps a thread from the feed
2. Thread detail screen shows title, body, vote score, author (or "Anonymous"), timestamp, tags
3. Replies are shown in nested/threaded view (respecting `parentReplyId` and `depth`)
4. User can reply to the thread or to a specific reply (nested)
5. User can upvote/downvote threads and replies
6. User can bookmark threads for later

#### Moderation
1. Any user can report a thread or reply (spam, harassment, misinformation, off_topic, nsfw, other)
2. Community owner/admin/moderator can remove threads, lock threads, pin threads, ban/mute users
3. Mod actions are logged in `fr_mod_actions`
4. Reported content shows a visual indicator to moderators

### Edge Cases
- **Forums module not enabled:** Show an inline prompt to enable MyForums. Do not crash or show an empty state.
- **No network connectivity:** Show cached threads from `fr_threads_cache`. Display a banner "You're viewing cached content. Connect to the internet for the latest discussions." Disable create/reply/vote actions.
- **Empty community (no threads yet):** Show an encouraging empty state: "Be the first to start a conversation! Ask a question, share your experience, or discuss symptoms." with a CTA to create a thread.
- **User is banned/muted:** Show threads read-only. Display a notice if they try to post: "Your posting privileges have been suspended."
- **Thread is locked:** Show all content but hide reply input. Display "This thread has been locked by a moderator."
- **Extremely long thread (hundreds of replies):** Paginate replies (20 per page). Load nested replies on demand (collapse after depth 3).
- **Module disabled mid-browse:** If the user disables MyCycle while viewing community, the community tab disappears on next navigation. Forum data is preserved in the cloud.
- **Supabase auth mismatch:** If the user has a local MyCycle session but no Supabase auth, prompt re-authentication before any write operations.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping the Community tab in MyCycle shows a feed of threads from the cycle-linked community
- [ ] **AC-2:** Threads display title, author (or "Anonymous"), vote score, reply count, tags, and relative timestamp
- [ ] **AC-3:** Tapping a thread opens a detail view with the full body and nested replies
- [ ] **AC-4:** Creating a thread with title, body, and tags publishes to the community and appears in the feed
- [ ] **AC-5:** Replying to a thread adds the reply in the correct position (nested under parent if replying to a reply)
- [ ] **AC-6:** Upvoting/downvoting a thread or reply updates the vote score immediately (optimistic UI)
- [ ] **AC-7:** Bookmarking a thread saves it and shows a filled bookmark icon
- [ ] **AC-8:** Filtering by tag shows only threads with that tag
- [ ] **AC-9:** Sort toggle switches between "Recent" and "Top" ordering
- [ ] **AC-10:** Anonymous posting hides the author's identity, showing "Anonymous" instead
- [ ] **AC-11:** Reporting a thread/reply opens a reason picker and submits the report
- [ ] **AC-12:** When the forums module is not enabled, a clear prompt to enable it is shown instead of the community feed
- [ ] **AC-13:** When offline, cached threads are shown with a connectivity banner, and write actions are disabled

### Technical Criteria
- [ ] **TC-1:** The cycle-linked community exists in Supabase with `linked_module_id = 'cycle'` after seed migration runs
- [ ] **TC-2:** Thread creation calls the forums cloud client `createThread()` with the correct `communityId`
- [ ] **TC-3:** Replies respect the `parentReplyId` chain and increment `depth` correctly
- [ ] **TC-4:** Vote operations use the existing `castVote()` / `removeVote()` cloud client functions
- [ ] **TC-5:** Local cache tables (`fr_threads_cache`, `fr_replies_cache`) are populated after each fetch for offline fallback
- [ ] **TC-6:** Pagination loads 20 threads per page with cursor-based pagination (not offset)
- [ ] **TC-7:** Nested replies collapse after depth 3 with a "Show more replies" expander
- [ ] **TC-8:** All write operations require Supabase authentication via `@mylife/auth`

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Community forums must NOT store any thread or reply data in the Cycle module's SQLite tables (`cy_*`). All forum data flows through `@mylife/forums` infrastructure.
- [ ] **NC-2:** The community tab must NOT appear if the forums module is not installed/available in the module registry.
- [ ] **NC-3:** Anonymous posts must NOT leak the author's identity anywhere in the UI (including network requests visible to other users).
- [ ] **NC-4:** Community features must NOT require network for read-only browsing when cached data exists.
- [ ] **NC-5:** No user-generated content from the community should be indexed or stored locally in a way that bypasses Supabase RLS policies.

## UI Specification

### Mobile (Expo)

**Community Tab (Feed)**
- Background: `#0A0A0F` (background token)
- Thread cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent for tags and highlights: `#F472B6` (MyCycle accent)
- Each thread card shows:
  - Title (16px, `#F0F0F5`, semibold)
  - Preview of body (14px, `rgba(240,240,245,0.65)`, 2 lines max)
  - Author or "Anonymous" (12px, secondary text)
  - Tag pills (12px, accent-colored backgrounds at 15% opacity)
  - Bottom row: vote score (with up/down arrows), reply count icon, relative time
- Floating action button (bottom-right): `#F472B6` circle with `+` icon for new thread
- Sort toggle: pill group at top ("Recent" / "Top")
- Pull-to-refresh updates the feed

**Thread Detail**
- Same card styling for the OP (original post) at top
- Replies in a flat list with indentation per depth level (16px indent per level)
- Reply input at bottom with text field and "Post" button
- "Anonymous" toggle switch in reply input area
- Collapse indicator for deep threads ("> Show N more replies")

**Empty State**
- Centered illustration placeholder (simple `MessageCircle` icon at 64px, `rgba(255,255,255,0.10)`)
- Title: "Start a conversation" (18px, primary text)
- Subtitle: "Ask questions, share experiences, and connect with other cycle trackers." (14px, secondary text)
- CTA button: "Create First Thread" (accent colored)

**Offline Banner**
- Full-width banner at top of feed: `rgba(251,191,36,0.15)` background, `#FBBF24` text
- Text: "Offline - showing cached content"
- Dismiss X button

### Web (Next.js)

- Same tokens via CSS variables
- Sidebar navigation: community accessible via `/cycle/community` route
- Thread list on left (2/3 width), thread detail on right (1/3 width) for desktop. Stacked on mobile breakpoints.
- Sort and tag filter controls in a toolbar above the thread list
- Thread creation via modal dialog
- Same empty state content, adapted to web layout

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (3 placeholder thread cards with shimmer) | Initial fetch or page load |
| Empty | "Start a conversation" illustration + CTA | Community has zero threads |
| Error | "Couldn't load discussions. Tap to retry." with retry button | Network error, Supabase down |
| Success | Thread feed with cards, sort toggle, tag filter | Data loaded |
| Partial | Cached threads shown + offline banner | No network, cache exists |
| Forums Disabled | "Enable MyForums to join" card with Enable button | Forums module not enabled |
| Auth Required | Auth prompt overlay when user tries to write | Unauthenticated write attempt |
| Banned | Read-only feed + "Posting suspended" notice | User banned from community |

## Test Requirements

### Unit Tests
- [ ] `getCommunitiesByModule('cycle')`: returns community with `linkedModuleId = 'cycle'`
- [ ] `getCommunitiesByModule('cycle')`: returns empty array when no cycle community exists
- [ ] Thread creation input validation: rejects title < 3 chars, body > 40000 chars
- [ ] Tag filtering: correctly filters threads by tag ID
- [ ] Vote toggling: upvote then upvote again removes the vote (toggle behavior)
- [ ] Reply depth calculation: nested reply increments parent depth by 1
- [ ] Anonymous thread: `authorId` is set server-side but not exposed in the response view

### Integration Tests
- [ ] Full flow: create thread -> thread appears in feed -> reply to thread -> reply count increments
- [ ] Offline flow: fetch threads -> go offline -> threads still render from cache -> write actions show disabled state
- [ ] Module gating: forums module disabled -> community tab shows enable prompt -> enable forums -> community feed loads

### QA Verification Script

1. Open the app on mobile (iOS simulator)
2. Navigate to MyCycle module
3. Tap the "Community" tab
4. Verify: thread feed loads with pre-seeded threads (or empty state if none) -- corresponds to AC-1
5. If empty, tap "Create First Thread" -- verify the create form opens -- AC-4
6. Enter title "Testing period symptoms" and body "Has anyone experienced..." and select the "symptoms" tag
7. Tap "Post" -- verify thread appears in feed with correct title, tag, and author -- AC-4, AC-2
8. Tap on the thread -- verify detail view shows full body and reply section -- AC-3
9. Type a reply "I had a similar experience..." and tap Post -- verify reply appears -- AC-5
10. Tap the upvote arrow on the thread -- verify vote score increments by 1 -- AC-6
11. Tap the bookmark icon -- verify it fills in -- AC-7
12. Go back to feed and tap the "symptoms" tag filter -- verify only tagged threads show -- AC-8
13. Toggle sort to "Top" -- verify threads reorder by vote score -- AC-9
14. Create a new thread with "Post anonymously" toggled on -- verify author shows as "Anonymous" -- AC-10
15. Tap the "..." menu on any thread and select "Report" -- verify reason picker appears -- AC-11
16. Disable the forums module in hub settings, return to MyCycle -- verify community tab shows enable prompt -- AC-12
17. Enable airplane mode, return to community -- verify cached threads show with offline banner -- AC-13
18. Repeat steps 2-13 on web at `/cycle/community` route

## gstack Quality Gates

Based on Complexity score 0 (massive: forum infrastructure + moderation), these gates are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the community tab on mobile and `/cycle/community` on web, verify all 8 states above
- [ ] Batch QA: this is feature 4 of 4 in Cycle, run `/qa` on the cycle module URL after this

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. The cross-module integration between cycle and forums needs architectural validation.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization, specifically around: Supabase community seeding strategy, forums module dependency enforcement, offline cache sync behavior

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- cycle has an active standalone (MyCar pattern), verify no standalone drift
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- MyCycle module has 4 tabs (Today, Calendar, Insights, Settings) and no community features
- `@mylife/forums` module exists with full infrastructure (23 Zod schemas, 17 cache CRUD functions, 22 cloud client functions, 14 cloud tables, 6 cache tables) but has no module-linked communities seeded
- The `linkedModuleId` field on `fr_communities` exists but is unused
- No test coverage in the forums module (scaffold only)

### After This Work
- MyCycle module has 5 tabs (Today, Calendar, Insights, Community, Settings)
- A cycle-linked community is seeded in Supabase with rules and tags
- Users can browse, post, reply, vote, bookmark, and report within the cycle community context
- Offline browsing works via the forums cache layer
- The `linkedModuleId` integration pattern is proven and replicable for other modules

### Files Changed
- `modules/cycle/src/definition.ts` -- Add 'community' tab to navigation
- `apps/mobile/app/(cycle)/community.tsx` -- New screen: community feed and thread detail
- `apps/mobile/app/(cycle)/_layout.tsx` -- Register community tab
- `apps/web/app/cycle/community/page.tsx` -- New page: web community feed
- `apps/web/app/cycle/community/[threadId]/page.tsx` -- New page: web thread detail
- `supabase/seed.sql` (or new migration) -- Seed cycle community, rules, and tags
- `modules/forums/src/__tests__/linked-community.test.ts` -- Integration tests for module-linked community queries

### Known Limitations
- **No real-time updates:** Thread feed uses pull-to-refresh, not Supabase Realtime subscriptions. Real-time can be added later.
- **No push notifications:** Users are not notified of replies to their threads. Requires a notification infrastructure that does not exist yet.
- **No rich text:** Thread bodies and replies are plain text. Markdown support could be added to the forums module later.
- **No image attachments:** Users cannot attach images to threads or replies. Requires media upload infrastructure (Supabase Storage or R2).
- **Moderation is manual:** No automated spam detection or content filtering. Relies on user reports and manual moderator action.
- **Single community per module:** The current design seeds one community per module. If users want sub-communities (e.g., "TTC" vs "PCOS"), that requires additional seeding or user-created communities within the module scope.

### Context for Next Agent
- The `linkedModuleId` field is the key integration point. Query communities with `getCommunitiesByModule(moduleId)` from the forums cloud client.
- The forums module requires Supabase auth for writes. Make sure the auth flow is integrated before the user tries to post.
- The forums module's `requiresNetwork: true` means it will not work purely offline. The cache layer provides read-only offline fallback, not offline-first writes.
- If the forums module is not enabled by the user, the community tab should gracefully degrade (show enable prompt, not crash).
- The complexity score of 0 reflects "Forum infrastructure, moderation" being a large system. However, since `@mylife/forums` already exists, the actual Cycle-side work is primarily UI wiring and community seeding. The hard part is already built.
