# Feature Spec: Real-time Updates

## Metadata
- **Module:** forums
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [2] x2 + CrossModule [2] x1 + PaidUser [1] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (builds on existing Supabase infrastructure)
- **Blocks:** Voice channels (real-time presence is prerequisite for voice)

## Business Context

### Why This Feature Exists
Without real-time updates, forums feel static. Users must manually refresh to see new replies, vote changes, and thread activity. Discord set the expectation that community platforms update instantly. Reddit added live comments in 2023 specifically to compete. Real-time transforms MyForums from a "post and check back later" experience into an active, engaging conversation space that keeps users in the app longer.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Discord | Yes | No | Full real-time via WebSocket: messages, reactions, presence, typing indicators, voice state |
| Reddit | Yes | No | Subreddit live feeds, live comments in threads (launched 2023), notification badges for replies |
| Lemmy | Partial | No | WebSocket for real-time comment updates, no typing indicators or presence |

### Target User
Active participants in ongoing conversations who want instant feedback when someone replies to their thread, votes on their post, or joins their community. Discord users (200M+ MAU) who expect sub-second message delivery, and Reddit users who now have live comment threads. Without real-time, MyForums feels a generation behind.

## Technical Context

### Where This Lives in MyLife

```
modules/forums/src/
  types.ts                            -- New Zod schemas: RealtimeEvent, PresenceState, TypingIndicator
  cloud/realtime.ts                   -- NEW: Supabase Realtime subscription manager
  cloud/client.ts                     -- MODIFIED: integrate realtime into existing queries

apps/mobile/app/(forums)/
  thread-detail.tsx                   -- MODIFIED: subscribe to thread updates (new replies, vote changes)
  components/TypingIndicator.tsx      -- NEW: "X is typing..." animation
  components/NewRepliesBanner.tsx     -- NEW: "N new replies" pull-to-reveal banner
  components/OnlineIndicator.tsx      -- NEW: green dot for online community members

apps/web/app/forums/
  components/TypingIndicator.tsx      -- NEW: web typing indicator
  components/NewRepliesBanner.tsx     -- NEW: web new replies banner
  components/OnlineIndicator.tsx      -- NEW: web online indicator
```

### Wireframe Position

```
Hub Dashboard
  └── MyForums card
       └── Community / Thread Detail
            └── Real-time overlay ← YOU ARE HERE
                 ├── "3 new replies" banner (top of reply list)
                 ├── Typing indicator ("Alice is typing..." at bottom)
                 ├── Live vote score updates (inline on threads/replies)
                 └── Online member count (community header)
```

### Data Model

```sql
-- Supabase Realtime channels (no new tables needed for basic real-time)
-- Leverage Supabase Realtime's built-in features:
-- 1. Postgres Changes: subscribe to INSERT/UPDATE/DELETE on fr_threads, fr_replies, fr_votes
-- 2. Presence: track online users per community
-- 3. Broadcast: typing indicators (ephemeral, no persistence)

-- New table for presence tracking (optional, for offline status display)
CREATE TABLE IF NOT EXISTS fr_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id UUID REFERENCES fr_communities(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'idle', 'offline'))
);

CREATE INDEX idx_fr_presence_community ON fr_presence (community_id, status);

ALTER TABLE fr_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Presence is publicly readable" ON fr_presence FOR SELECT USING (true);
CREATE POLICY "Users update own presence" ON fr_presence FOR ALL USING (auth.uid() = user_id);
```

### Dependencies
- **Internal:** `@mylife/db` (SQLite adapter for offline state), `@mylife/auth` (user identity for presence)
- **External:** Supabase Realtime (included in Supabase plan): Postgres Changes, Presence, Broadcast channels
- **Cross-Module:** `@mylife/social` -- real-time events could trigger cross-module notifications (e.g., "someone replied to your thread" surfacing in hub notification center)

## Functional Requirements

### User Stories
1. As a thread viewer, I want new replies to appear automatically without refreshing so I can follow live conversations.
2. As a thread participant, I want to see when someone is typing a reply so I know a response is coming.
3. As a community member, I want to see how many members are currently online so I know if the community is active.
4. As a voter, I want vote scores to update in real-time so I see the community's reaction live.

### Behavior Specification

1. **Thread detail real-time replies:** When viewing a thread, the app subscribes to Supabase Realtime Postgres Changes on `fr_replies` filtered by `thread_id`. New replies appear at the bottom of the reply list with a slide-in animation. If the user has scrolled up, a "N new replies" banner appears at the bottom instead of auto-scrolling.
2. **Vote score live updates:** Subscribing to changes on `fr_votes` for the current thread's threads and replies. When a vote is cast/removed, the corresponding vote_score on the thread/reply card updates with a brief number animation (count up/down).
3. **Typing indicators:** When a user starts typing in the reply composer, a Broadcast message is sent to the thread's channel. Other subscribers see "Alice is typing..." at the bottom of the reply list. Indicator disappears 3 seconds after the last Broadcast. Multiple typers: "Alice and Bob are typing..." or "3 people are typing...".
4. **Presence tracking:** When a user enters a community view, their presence is registered via Supabase Realtime Presence. The community header shows "N online" with a green dot. Presence automatically times out after 60 seconds of inactivity (no page interaction).
5. **Feed real-time:** On the main feed, new threads appear with a "N new posts" banner at the top. Tapping the banner scrolls to top and reveals them. Thread cards update vote_score and reply_count in real-time.
6. **Connection state:** The app displays a subtle banner when the real-time connection is lost ("Reconnecting...") and auto-reconnects with exponential backoff (1s, 2s, 4s, max 30s). When reconnected, missed events are fetched via a delta query.
7. **Subscription lifecycle:** Channels are subscribed when the screen mounts and unsubscribed on unmount. Each thread gets its own channel. Community presence uses a shared community channel. Global feed uses a per-user channel filtered by joined communities.
8. **Battery/data optimization (mobile):** When the app is backgrounded, real-time subscriptions are paused. They resume on foreground. No background data usage for real-time.

### Edge Cases

- **Rapid-fire updates:** If 50 replies arrive in 1 second (e.g., active thread), batch UI updates to 1 render per 500ms max to prevent jank.
- **Stale presence:** If a user's device loses connectivity without graceful disconnect, presence shows stale "online" status. The fr_presence.last_seen_at column plus a 60-second timeout handles this: server-side cron marks users idle after 60s, offline after 5 minutes.
- **Typing indicator spam:** Debounce typing broadcast to 1 message per 2 seconds per user. Ignore rapid keystroke events.
- **Large thread (1000+ replies):** Real-time only subscribes to new inserts, not historical. Pagination for existing replies remains unchanged.
- **Network reconnection:** After reconnection, fetch all changes since last known timestamp via a single query. Merge with local state.
- **Multiple tabs (web):** Each tab manages its own subscription. Supabase Realtime handles multiplexing.
- **Module disabled:** All subscriptions are torn down on module disable. No lingering connections.
- **Auth token expiry:** If the Supabase auth token expires mid-session, the real-time connection drops. The app refreshes the token and re-subscribes.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** New replies appear in thread detail without manual refresh
- [ ] **AC-2:** New replies slide in with animation when user is at bottom of scroll
- [ ] **AC-3:** "N new replies" banner appears when user has scrolled away from bottom
- [ ] **AC-4:** Tapping the "N new replies" banner scrolls to the newest reply
- [ ] **AC-5:** Vote scores update in real-time with number animation
- [ ] **AC-6:** "X is typing..." indicator appears when another user is composing a reply
- [ ] **AC-7:** Typing indicator disappears 3 seconds after last activity
- [ ] **AC-8:** Community header shows "N online" with green dot for active members
- [ ] **AC-9:** Feed shows "N new posts" banner when new threads are created
- [ ] **AC-10:** "Reconnecting..." banner appears when connection is lost
- [ ] **AC-11:** Connection auto-recovers and missed updates are fetched

### Technical Criteria
- [ ] **TC-1:** Supabase Realtime Postgres Changes subscription for fr_replies, fr_votes is established on thread mount
- [ ] **TC-2:** Supabase Realtime Presence tracks online users per community
- [ ] **TC-3:** Supabase Realtime Broadcast is used for typing indicators (ephemeral, not persisted)
- [ ] **TC-4:** Subscriptions are cleaned up on screen unmount (no leaked channels)
- [ ] **TC-5:** Mobile: subscriptions pause on app background, resume on foreground
- [ ] **TC-6:** UI updates are batched to max 1 render per 500ms during rapid events
- [ ] **TC-7:** Reconnection uses exponential backoff (1s, 2s, 4s... max 30s)
- [ ] **TC-8:** Delta query fetches missed events after reconnection

### Negative Criteria
- [ ] **NC-1:** Real-time subscriptions must NOT run when app is backgrounded (mobile)
- [ ] **NC-2:** Typing indicators must NOT persist to any database (ephemeral only)
- [ ] **NC-3:** Real-time must NOT cause excessive re-renders (batching enforced)
- [ ] **NC-4:** Presence must NOT show stale "online" status for more than 5 minutes after disconnect

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- New replies banner: `#F43F5E` (accent) pill at bottom of reply list, "3 new replies ↓", 32px height
- Typing indicator: `rgba(255,255,255,0.04)` bar at bottom, 14px textSecondary, animated "..." dots
- Online indicator: 8px circle, `#30D158` (success green), next to member count in community header
- Reconnecting banner: full-width at top, `rgba(255,255,255,0.08)` glass background, spinning icon + "Reconnecting..."
- Vote animation: number scales up 1.2x briefly, color flashes `#F43F5E` for upvote, `rgba(240,240,245,0.65)` for neutral

### Web (Next.js)

- Same tokens via CSS variables
- New replies banner: sticky at bottom of reply container
- Typing indicator: inline below last reply
- Online count: pill in community sidebar
- Reconnecting: toast notification at top-right

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Normal static view while subscription establishes | Screen mount |
| Empty | No real-time indicators (no other users active) | Solo viewer |
| Error | "Reconnecting..." banner | WebSocket disconnects |
| Success | Live updates flowing: new replies, vote changes, typing, presence | Active connection |
| Partial | Some channels connected, others reconnecting | Intermittent connectivity |

## Test Requirements

### Unit Tests
- [ ] Typing indicator debounce: broadcasts at most 1 message per 2 seconds
- [ ] Batch renderer: coalesces rapid events into single render
- [ ] Presence timeout: marks users idle after 60s, offline after 5min
- [ ] Reconnection backoff: follows 1s, 2s, 4s, 8s, 16s, 30s, 30s pattern
- [ ] Delta query builder: constructs correct "since timestamp" query
- [ ] Event type router: routes INSERT/UPDATE/DELETE to correct handler

### Integration Tests
- [ ] Full flow: User A posts reply -> User B sees reply appear in real-time
- [ ] Typing flow: User A starts typing -> User B sees typing indicator -> User A stops -> indicator fades
- [ ] Presence flow: User enters community -> online count increments -> user leaves -> count decrements
- [ ] Reconnection flow: disconnect network -> "Reconnecting..." banner -> reconnect -> missed events appear

### QA Verification Script

1. Open the app on two devices (or two browser tabs)
2. Both navigate to MyForums, same community, same thread
3. On Device A, start typing a reply
4. Verify on Device B: "User A is typing..." appears at bottom -- corresponds to AC-6
5. On Device A, stop typing for 3 seconds
6. Verify on Device B: typing indicator disappears -- corresponds to AC-7
7. On Device A, submit the reply
8. Verify on Device B: new reply slides in at bottom -- corresponds to AC-1, AC-2
9. On Device B, scroll up in the reply list
10. On Device A, submit another reply
11. Verify on Device B: "1 new reply" banner appears at bottom (not auto-scroll) -- corresponds to AC-3
12. On Device B, tap the banner
13. Verify: scroll jumps to the newest reply -- corresponds to AC-4
14. On Device A, upvote a reply
15. Verify on Device B: vote score updates with animation -- corresponds to AC-5
16. Check community header on both devices
17. Verify: "2 online" with green dot -- corresponds to AC-8
18. On Device A, navigate away from the community
19. Verify on Device B: online count decreases to 1 after ~60s -- corresponds to AC-8
20. On Device B (mobile), put app in background for 10 seconds, return to foreground
21. Verify: connection re-establishes, no missed data -- corresponds to TC-5
22. Simulate network drop (airplane mode briefly)
23. Verify: "Reconnecting..." banner appears -- corresponds to AC-10
24. Restore network
25. Verify: banner disappears, any missed events catch up -- corresponds to AC-11

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- test real-time updates across two tabs, verify all 5 states
- [ ] Batch QA: after 5 features in forums module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec before building (Complexity = 2)

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The forums module fetches data via one-shot Supabase queries. Users must pull-to-refresh or navigate away and back to see new content. No WebSocket connections, no presence tracking, no typing indicators.

### After This Work
Full real-time system: Supabase Realtime Postgres Changes for live reply/vote/thread updates, Presence for online member tracking, Broadcast for ephemeral typing indicators. Connection state management with auto-reconnect and delta sync. Battery-optimized with background pause on mobile.

### Files Changed
- `modules/forums/src/types.ts` -- Added RealtimeEvent, PresenceState, TypingIndicator schemas
- `modules/forums/src/cloud/realtime.ts` -- Supabase Realtime subscription manager
- `modules/forums/src/cloud/schema.sql` -- Added fr_presence table
- `modules/forums/src/cloud/client.ts` -- Integrated realtime into existing queries
- `apps/mobile/app/(forums)/thread-detail.tsx` -- Subscribe to thread updates
- `apps/mobile/app/(forums)/components/TypingIndicator.tsx` -- Typing animation
- `apps/mobile/app/(forums)/components/NewRepliesBanner.tsx` -- New replies notification
- `apps/mobile/app/(forums)/components/OnlineIndicator.tsx` -- Presence dot
- `apps/web/app/forums/components/TypingIndicator.tsx` -- Web typing indicator
- `apps/web/app/forums/components/NewRepliesBanner.tsx` -- Web new replies banner
- `apps/web/app/forums/components/OnlineIndicator.tsx` -- Web online indicator

### Known Limitations
- No per-message delivery receipts (no "read" status on replies)
- No server-sent push notifications for real-time events (uses in-app subscription only; push notifications are a separate feature)
- Presence accuracy depends on client heartbeat; may be stale for up to 60 seconds
- No real-time updates for the Saved/Bookmarks tab (bookmarked threads do not live-update)

### Context for Next Agent
The Supabase Realtime subscription manager (`cloud/realtime.ts`) is designed to be reusable. It exports a `createForumChannel(channelName, filters)` factory that returns subscribe/unsubscribe handles. Voice channels will need a similar pattern but with Broadcast for audio signaling. The presence system tracks users per-community, which Direct Messaging will extend to per-conversation presence.
