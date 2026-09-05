# Feature Spec: MyForums Full Web UI

## Metadata
- **Module:** forums
- **Task ID:** W14-12
- **Priority Score:** 38 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 10-14 hours
- **Depends On:** V1+V2 Zod types, cloud client (22 cloud functions), local cache CRUD (17 functions), 6 engine modules (profile, media, messaging, realtime, voice, federation), mobile UI reference (14 screens)
- **Blocks:** Forums full cross-platform parity, web module completion dashboard metric
- **Reference Implementation:** `apps/web/app/books/` (layout, page, actions, sub-routes, tests)
- **Design Pipeline:** /office-hours (builder) -> /plan-eng-review -> /plan-design-review -> /design-consultation

---

## Phase 1: Office Hours (Builder Mode) -- Web UX Brainstorm

### What Makes a Forums Web App Delightful vs Mobile

Desktop is where forums were born. Reddit, Discourse, Hacker News, old phpBB -- the web is the native home for threaded discussion. A forums app that only works well on mobile is fighting against 25 years of user expectation. The web UI must exploit desktop affordances ruthlessly:

1. **Three-panel layout.** The killer desktop pattern for forums: community sidebar (left) + thread list (center) + thread detail (right). You can browse, select, and read without ever leaving the page. Mobile forces single-screen focus; desktop lets you hold context across all three levels simultaneously.

2. **Keyboard-first navigation.** `j/k` to move between threads, `a/z` or arrow keys for up/down vote, `r` to reply, `s` to save, `Cmd+Enter` to submit. Forum power users expect vim-style shortcuts. Every action should be reachable without touching the mouse.

3. **Nested reply trees with full depth.** Mobile collapses reply trees aggressively because screen width is limited. On desktop, show 4-5 levels of nesting with clear visual indentation, collapse indicators, and "load more" at depth boundaries. Reddit's old.reddit.com thread view is the gold standard for reply depth rendering.

4. **Split-pane messaging.** Conversation list on the left, message thread on the right. No page transitions to read a message. Typing indicators and read receipts update in real-time. Desktop messaging should feel like Slack's DM pane, not like a mobile chat app.

5. **Information-dense community directory.** Show community cards with member counts, thread counts, description preview, join/leave button, and activity sparkline all in a grid. Mobile shows a compact list; desktop shows a rich browsable grid.

6. **Moderation dashboard as a data table.** Mod log, reports queue, member list, community settings -- these are inherently tabular. Desktop renders them as sortable, filterable tables with inline actions. Mobile stuffs them into stack screens.

7. **Rich text composing.** Thread creation on desktop should offer markdown preview side-by-side. Drag-and-drop image upload, link preview, mention autocomplete with `@username`. The compose experience should feel like writing in Linear or Notion.

### The Narrowest Wedge

**The thread reading view.** The single screen that makes users say "I need this on desktop" is seeing a thread with its full nested reply tree, vote scores, author badges, and community sidebar all in one viewport. On mobile you scroll a flat list and tap to expand. On desktop you see the conversation structure at a glance -- who replied to whom, which branches are active, where the interesting discussion lives. The three-panel layout (community nav + thread list + thread detail) is the wedge.

### How Information Density Differs From Mobile

| Dimension | Mobile | Web |
|-----------|--------|-----|
| Thread list items | Title + 1-line preview | Title + preview + author + score + reply count + tags + timestamp |
| Reply tree depth | 2-3 visible, rest collapsed | 4-5 visible with progressive collapse |
| Community detail | Full-screen stack push | Sidebar panel or overlay |
| Voting | Tap arrows | Click arrows + keyboard `a`/`z` |
| Thread compose | Full-screen modal | Side panel or inline expansion |
| Message threads | Full-screen push per conversation | Split-pane (list left, messages right) |
| Mod dashboard | Stack of screens | Tabbed data table |
| Search results | Vertical list | Two-column (threads left, communities right) |
| Profile | Full-screen card | Side panel overlay or dedicated page |
| Navigation | 5 bottom tabs | Sidebar tabs + keyboard shortcuts |

### Linear/Raycast Aesthetic Patterns for Forums

- **Command palette (`Cmd+K`):** Jump to any community, search threads, navigate to messages, open profile. Primary navigation accelerator.
- **Glass card thread items:** Each thread is a frosted card with subtle hover elevation and accent border on selection.
- **Inline keyboard shortcut hints:** Show `j/k` next to thread list, `Cmd+Enter` on compose, `s` next to bookmark icon.
- **Dense metadata row:** Author avatar (16px) + username + karma badge + timestamp + community tag -- all in one compact row per thread.
- **No hero sections.** The feed page is immediately useful content. No "Welcome to Forums" banner.
- **Hover actions.** Vote arrows, bookmark, share, and report icons appear on thread/reply hover. Clean interface when not interacting.

---

## Phase 2: Engineering Review -- Architecture Lock

### Module Exports Audit

The `@mylife/forums` module exports 100+ items across 8 categories. Here is what the web UI needs:

| Category | Functions Needed | Count | Status |
|----------|-----------------|-------|--------|
| **V1 Cloud Client** | `cloudGetCommunities`, `cloudGetCommunityById`, `cloudGetCommunityByName`, `cloudCreateCommunity`, `cloudSearchCommunities`, `cloudJoinCommunity`, `cloudLeaveCommunity`, `cloudGetThreads`, `cloudGetThreadById`, `cloudCreateThread`, `cloudSearchThreads`, `cloudGetReplies`, `cloudCreateReply`, `cloudCastVote`, `cloudRemoveVote`, `cloudGetBookmarks`, `cloudToggleBookmark`, `cloudGetUserStats`, `cloudGetModLog`, `cloudCreateReport`, `cloudGetCommunityRules`, `cloudGetTags` | 22 | All exported, none in actions.ts |
| **V2 Cloud: Profiles** | `cloudGetProfile`, `cloudGetProfileByUsername`, `cloudGetMyProfile`, `cloudCreateProfile`, `cloudUpdateProfile`, `cloudGetProfileBadges`, `cloudGetProfileActivity` | 7 | All exported, none in actions.ts |
| **V2 Cloud: Media** | `cloudUploadMedia`, `cloudGetMediaForTarget`, `cloudDeleteMedia`, `cloudGetLinkPreview` | 4 | All exported, none in actions.ts |
| **V2 Cloud: Messaging** | `cloudGetConversations`, `cloudCreateConversation`, `cloudGetMessages`, `cloudSendMessage`, `cloudUpdateLastRead`, `cloudGetParticipants` | 6 | All exported, none in actions.ts |
| **V2 Cloud: Voice** | `cloudGetVoiceChannels`, `cloudCreateVoiceChannel`, `cloudJoinVoiceChannel`, `cloudLeaveVoiceChannel`, `cloudGetVoiceParticipants` | 5 | All exported, none in actions.ts |
| **Profile Engine** | `validateUsername`, `getDefaultAvatarColor`, `getEligibleBadges`, `getBadgeLabel`, `getBadgeColor` | 5 | All exported |
| **Messaging Engine** | `findExisting1to1`, `isUserBlocked`, `validateMessageBody`, `getCharacterCountInfo`, `sortConversationsByLastMessage` | 5 | All exported |
| **Realtime Engine** | `buildThreadChannel`, `buildCommunityPresenceChannel`, `buildFeedChannel`, `buildDMChannel`, `formatTypingText`, `pruneExpiredTypers`, `countOnlineMembers` | 7 | All exported |
| **Local Cache CRUD** | All 17 cache functions | 17 | All exported, none in actions.ts |
| **V2 Cache CRUD** | `getCachedProfileById`, `getCachedProfileByUsername`, `getCachedProfileByUserId`, `upsertCachedProfile`, `getCachedConversations`, `getCachedConversationById`, `upsertCachedConversation`, `getCachedMessages`, `upsertCachedMessage` | 9 | All exported, none in actions.ts |

### Missing Server Actions (actions.ts)

The forums web module has **zero** actions.ts file. It needs one covering ~45 server actions:

```typescript
// ── File: apps/web/app/forums/actions.ts ─────────────────────────────

// === Community CRUD (10 actions) ===
fetchCommunities(options?: { type?: string; limit?: number; offset?: number })
fetchCommunityById(id: string)
fetchCommunityByName(name: string)
createCommunity(input: CreateCommunityInput)
searchCommunities(query: string)
joinCommunity(communityId: string)
leaveCommunity(communityId: string)
fetchCommunityRules(communityId: string)
fetchCommunityMembers(communityId: string)
fetchCommunityTags(communityId: string)

// === Thread CRUD (6 actions) ===
fetchThreads(communityId: string, options?: { sort?: 'new' | 'hot' | 'top'; limit?: number; offset?: number })
fetchThreadById(id: string)
createThread(input: CreateThreadInput)
searchThreads(query: string, communityId?: string)
fetchBookmarks(profileId: string)
toggleBookmark(threadId: string)

// === Reply CRUD (3 actions) ===
fetchReplies(threadId: string, options?: { parentReplyId?: string; limit?: number })
createReply(input: CreateReplyInput)
// Nested reply loading handled by fetchReplies with parentReplyId

// === Voting (2 actions) ===
castVote(targetType: VoteTargetType, targetId: string, direction: VoteDirection)
removeVote(targetType: VoteTargetType, targetId: string)

// === Profile (6 actions) ===
fetchMyProfile()
fetchProfile(profileId: string)
fetchProfileByUsername(username: string)
createProfile(input: CreateProfileInput)
updateProfile(input: UpdateProfileInput)
fetchProfileBadges(profileId: string)

// === Messaging (6 actions) ===
fetchConversations()
createConversation(input: CreateConversationInput)
fetchMessages(conversationId: string, options?: { limit?: number })
sendMessage(input: SendMessageInput)
updateLastRead(conversationId: string)
fetchParticipants(conversationId: string)

// === Moderation (3 actions) ===
fetchModLog(communityId: string)
createReport(input: { communityId: string; targetType: VoteTargetType; targetId: string; reason: ForumReportReason; details?: string })
fetchUserStats(profileId: string)

// === Media (3 actions) ===
uploadMedia(file: FormData)
fetchMediaForTarget(targetType: string, targetId: string)
fetchLinkPreview(url: string)

// === Voice (5 actions) ===
fetchVoiceChannels(communityId: string)
createVoiceChannel(communityId: string, name: string)
joinVoiceChannel(channelId: string)
leaveVoiceChannel(channelId: string)
fetchVoiceParticipants(channelId: string)
```

### Data Flow Architecture

```
User Action (click/keyboard)
  |
  v
Client Component (React state + optimistic update)
  |
  v
Server Action (actions.ts -- 'use server')
  |
  +---> Supabase Cloud Client (primary: cloud/client.ts)
  |       |
  |       v
  |     Supabase PostgreSQL (canonical data)
  |
  +---> Local SQLite Cache (secondary: db/crud.ts)
          |
          v
        SQLite file (offline reads)
```

**Key architectural decisions:**
1. **Cloud-first, cache-second.** Unlike SQLite-only modules (books, budget), forums is Supabase-primary. Server actions call cloud client functions, then optionally cache to local SQLite for offline reads.
2. **Optimistic UI for votes/bookmarks.** Cast vote locally, update UI immediately, then sync to Supabase. Revert on error.
3. **No auth gating on reads.** Browse communities and threads without authentication. Auth required only for: creating threads/replies, voting, bookmarking, messaging, profile creation.
4. **Realtime subscriptions for live updates.** Use Supabase Realtime channels for: new replies in active thread, typing indicators in DMs, presence in voice channels. Engine functions from `realtime/engine.ts` build channel names.

### State Management

| State | Source | Update Pattern |
|-------|--------|---------------|
| Community list | Supabase + local cache | Fetch on mount, paginate on scroll |
| Thread list | Supabase + local cache | Fetch per community, sort/filter client-side |
| Thread detail + replies | Supabase | Fetch on navigate, Realtime subscription for new replies |
| Vote state | Supabase + optimistic | Optimistic local update, confirm from server |
| Bookmarks | Supabase + optimistic | Toggle optimistic, sync to server |
| Profile | Supabase + local cache | Fetch once per session, cache locally |
| Conversations | Supabase + Realtime | Fetch on mount, subscribe to new messages |
| Messages | Supabase + Realtime | Fetch per conversation, subscribe to channel |
| Voice state | WebRTC + Supabase | Local peer connections, Supabase for signaling |

### Schema Verification

All planned features are supported by the existing schema:

| Feature | Tables Required | Indexes | Status |
|---------|----------------|---------|--------|
| Community browsing | fr_communities, fr_community_members | name, type, member | Exists |
| Thread listing + sorting | fr_threads | community, author, created, score | Exists |
| Nested replies | fr_replies | thread, parent_reply | Exists (depth column for nesting) |
| Voting | fr_votes | (cloud-only, no cache) | Exists |
| Bookmarks | fr_bookmarks | profile | Exists |
| Tags/flair | fr_tags, fr_thread_tags | community | Exists |
| Full-text search | fr_communities (search_vector), fr_threads (search_vector) | tsvector GIN | Exists (cloud) |
| Profiles + badges | fr_profiles_cache | username, karma | Exists |
| DM conversations | fr_conversations_cache, fr_messages_cache | last_msg, conv+created | Exists |
| Moderation | fr_mod_actions, fr_reports, fr_blocks | (cloud-only) | Exists |
| Community rules | fr_community_rules | (cloud-only) | Exists |
| Voice channels | (cloud-only, no cache) | | Exists |
| Federation | (cloud-only, no cache) | | Exists (future) |

**No new tables or migrations needed.** The schema fully supports all planned features.

### Web Route Structure (Next.js App Router)

```
apps/web/app/forums/
  layout.tsx              # Forums shell: sidebar nav + glass header
  page.tsx                # Feed: aggregated threads from joined communities
  actions.ts              # ~45 server actions wrapping cloud + cache
  ui.ts                   # Shared formatters and UI helpers
  communities/
    page.tsx              # Community directory (grid of community cards)
    create/
      page.tsx            # Create community form
    [id]/
      page.tsx            # Community detail: thread list + community sidebar
      settings/
        page.tsx          # Community settings (owner/admin only)
      mod-log/
        page.tsx          # Moderation log table
  thread/
    [id]/
      page.tsx            # Thread detail: post + nested reply tree
    create/
      page.tsx            # Create thread (query param: ?community=<id>)
  search/
    page.tsx              # Global search: threads + communities
  saved/
    page.tsx              # Bookmarked threads list
  profile/
    page.tsx              # Current user's profile (redirects to /profile/[id])
    edit/
      page.tsx            # Edit profile form
    [id]/
      page.tsx            # Public profile: stats, badges, recent activity
  messages/
    page.tsx              # Conversation list (split-pane left)
    new/
      page.tsx            # New conversation composer
    [id]/
      page.tsx            # Conversation detail (split-pane right)
  voice/
    [channelId]/
      page.tsx            # Voice channel: participant grid + controls
  __tests__/
    actions.test.ts       # Server action tests
    page.test.tsx         # Page render tests
```

**Route count:** 17 pages (up from 7 stubs). Plus layout.tsx, actions.ts, ui.ts, and test files.

### Missing Engine Functions

The existing engines are comprehensive. No new engine functions needed for web UI. Existing engines cover:

| Engine | Functions | Web Usage |
|--------|-----------|-----------|
| `profile/engine.ts` | `validateUsername`, `getDefaultAvatarColor`, `getEligibleBadges`, `getBadgeLabel`, `getBadgeColor` | Profile creation/edit, badge rendering |
| `media/engine.ts` | `calculateResizeDimensions`, `calculateThumbnailDimensions`, `buildStoragePath`, `detectMediaType`, `validateAttachmentCount` | Image upload in threads/replies/DMs |
| `realtime/engine.ts` | `buildThreadChannel`, `buildCommunityPresenceChannel`, `buildFeedChannel`, `buildDMChannel`, `formatTypingText`, `pruneExpiredTypers`, `countOnlineMembers` | Live updates, typing indicators, presence |
| `messaging/engine.ts` | `findExisting1to1`, `isUserBlocked`, `validateMessageBody`, `getCharacterCountInfo`, `sortConversationsByLastMessage` | DM compose, conversation sorting |
| `voice/engine.ts` | `detectSpeaking`, `calculateRMS`, `getActiveParticipants`, `getMeshConnectionCount`, `getMeshQualityWarning`, `ICE_SERVERS` | Voice channel UI |
| `federation/engine.ts` | ActivityPub helpers | Future: federated instances |

---

## Phase 3: Design Review -- Design Dimension Ratings

### Dimension Scores

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Layout & Hierarchy** | 9/10 | Three-panel layout perfectly matches forum mental model. Thread list as center of gravity. |
| **Information Density** | 9/10 | Desktop can show thread metadata inline (score, replies, author, tags, timestamp). No wasted space. |
| **Typography** | 8/10 | Inter works well for dense forum text. Thread titles as `subheading` (18/600), body as `body` (16/400), metadata as `caption` (13/500). |
| **Color & Theming** | 9/10 | Rose accent (#F43F5E) is distinctive and energetic. Works well as upvote highlight, active community indicator, and CTA. |
| **Glass Morphism** | 8/10 | Thread cards, community sidebar, and compose panel all benefit from glass treatment. Thread detail should use `surface` not glass (readability over style). |
| **Motion & Transitions** | 7/10 | Thread selection should be instant. Page transitions 200ms fade. Voting animation: number bounce. Avoid anything that slows browsing. |
| **Empty States** | 9/10 | Each section gets a warm, module-specific empty state: "Start a conversation" for DMs, "Find your people" for communities, "Save threads for later" for bookmarks. |
| **Error States** | 8/10 | Network errors especially important for cloud-first module. "Your connection dropped. Cached threads are still available." with retry. |
| **Loading States** | 8/10 | Thread list skeleton: 6 glass card rectangles pulsing. Reply tree skeleton: indented lines with avatar circles. No spinners. |
| **Accessibility** | 8/10 | Keyboard navigation critical. Tab order: sidebar -> thread list -> thread detail. Arrow keys within lists. Focus ring: 2px rose (#F43F5E). |
| **Responsive** | 8/10 | Three-panel at >1024px. Two-panel (list + detail) at 768-1024px. Single column at <768px. Sidebar collapses at tablet. |

**Overall Design Score: 8.3/10**

### What Would Make Each a 10

- **Layout:** Add resizable panel dividers (like VS Code) so users can customize width ratios.
- **Motion:** Stagger reply tree rendering by 30ms per level for a cascade effect when expanding a thread.
- **Responsive:** True responsive sidebar that remembers collapse state per breakpoint.
- **Accessibility:** Full screen reader announcement of vote score changes and new reply notifications.

### Cool Obsidian Compliance Checklist

| Rule | Status | Notes |
|------|--------|-------|
| Background: `#0A0A0F` | Pass | All pages use deepest background |
| Surface: `#12121A` | Pass | Thread cards, sidebar panels |
| Glass cards: `rgba(255,255,255,0.04)` + border `rgba(255,255,255,0.06)` | Pass | Community cards, compose panel |
| Glass blur: `backdrop-filter: blur(40px) saturate(180%)` | Pass | Header bar, sidebar |
| Text: `#F0F0F5` primary, `rgba(240,240,245,0.65)` secondary | Pass | Thread titles, metadata |
| Module accent: `#F43F5E` (rose) | Pass | Upvote highlight, active nav, CTAs |
| Border radius: 16px cards, 8px buttons, 999px pills | Pass | Standard Cool Obsidian radii |
| No light theme cards inside dark backgrounds | Pass | Lesson from workouts audit |
| No spinners (skeletons only) | Pass | Skeleton layouts for all loading states |
| No "No items found" (warm CTAs instead) | Pass | Custom empty states per section |
| No "Coming Soon" on visible features | Pass | All routes lead to functional UI |
| 44px minimum touch/click targets | Pass | All interactive elements |
| `prefers-reduced-motion` respected | Pass | Animations disabled when preference set |

### 5-State Design Matrix

Every page must handle all 5 states:

| Page | Loading | Empty | Error | Success | Partial |
|------|---------|-------|-------|---------|---------|
| **Feed** | 6 skeleton thread cards | "Find your communities" + browse CTA | "Couldn't load feed" + retry | Thread list with inline vote/save | Some threads loaded, "Load more" at bottom |
| **Communities** | 8 skeleton community cards in grid | "Explore communities" + create CTA | "Couldn't load communities" + retry | Community grid with join/leave buttons | Mixed: some cards loaded, some skeleton |
| **Community Detail** | Sidebar skeleton + 4 skeleton thread cards | "Start the conversation" + create thread CTA | "Community not found" + back link | Thread list + community info sidebar | Community loaded, threads still loading |
| **Thread Detail** | OP skeleton + 3 reply skeletons at varied indents | N/A (thread always has OP) | "Thread not found" + back link | OP + nested reply tree with voting | OP loaded, deeper replies lazy-loading |
| **Search** | Skeleton result rows | "Search communities and threads" prompt | "Search failed" + retry | Two-column results (threads + communities) | Threads loaded, community results pending |
| **Saved** | 4 skeleton bookmark cards | "Save threads for later" + browse CTA | "Couldn't load bookmarks" + retry | Bookmarked thread list | N/A (all or nothing) |
| **Profile** | Avatar circle skeleton + stat blocks | "Create your profile" + setup CTA | "Profile not found" + home link | Full profile: avatar, stats, badges, activity | Profile loaded, activity still loading |
| **Messages** | Left pane: 4 conversation skeletons | "Start a conversation" + new DM CTA | "Couldn't load messages" + retry | Split-pane: conversations left, messages right | Conversation list loaded, messages loading |
| **Voice Channel** | Participant grid skeleton (4 circles) | "No one here yet" + invite CTA | "Couldn't connect" + retry | Participant grid with speaking indicators | Some participants connected, others joining |
| **Mod Log** | Table skeleton (6 rows) | "No mod actions yet" | "Couldn't load mod log" + retry | Sortable data table of actions | N/A |

---

## Phase 4: Design Consultation -- Module Design System

### Color Accent Application

| Element | Color | Usage |
|---------|-------|-------|
| Primary CTA buttons | `#F43F5E` bg, white text | Create thread, join community, send message |
| Active nav indicator | `#F43F5E` left border (3px) | Active sidebar item |
| Upvote highlight | `#F43F5E` | Upvoted arrow and score text |
| Downvote highlight | `#3B82F6` (blue) | Downvoted arrow and score (contrast from upvote) |
| Unread badge | `#F43F5E` bg, white text | Message count, new thread indicator |
| Profile karma badge | `#F43F5E` at 15% opacity bg | Karma score display |
| Thread pinned indicator | `#F43F5E` pin icon | Pinned threads in community |
| Header accent | `#F43F5E` gradient underline | Module header "MyForums" text |

### Iconography

Use Lucide icons (consistent with other MyLife web modules):

| Context | Icon | Size |
|---------|------|------|
| Feed tab | `Newspaper` | 18px |
| Communities tab | `Users` | 18px |
| Search tab | `Search` | 18px |
| Saved tab | `Bookmark` | 18px |
| Profile tab | `User` | 18px |
| Messages | `MessageCircle` | 18px |
| Voice | `Mic` | 18px |
| Upvote | `ChevronUp` | 16px |
| Downvote | `ChevronDown` | 16px |
| Reply | `MessageSquare` | 14px |
| Share | `Share2` | 14px |
| Report | `Flag` | 14px |
| Pin | `Pin` | 14px |
| Lock | `Lock` | 14px |
| Settings | `Settings` | 16px |
| Create | `Plus` | 16px |
| Mod shield | `Shield` | 14px |

### Information Density

Forums is the densest module in MyLife. Design for power users who scan hundreds of threads:

- **Thread list items:** 72px height. Avatar (32px) + title (18/600) + metadata row (author, score, replies, time, tags) all in one card.
- **Reply items:** Variable height. Avatar (24px) + username + timestamp on row 1, body text below, vote controls on the left rail.
- **Community cards:** 160px height in grid. Icon (48px) + name + description (2 lines, clamp) + member count + thread count + join button.
- **Message items:** 56px height. Avatar (32px) + sender name + preview (1 line, clamp) + timestamp + unread badge.
- **Sidebar width:** 240px collapsed to icon-only at 56px on tablet.

### Component Reuse from packages/ui/ and Existing Web Modules

| Component | Source | Forums Usage |
|-----------|--------|-------------|
| Glass card container | `packages/ui/` tokens | Thread cards, community cards, compose panels |
| Skeleton loader | Books/Words pattern | Thread skeletons, community skeletons |
| Empty state pattern | Standard across modules | Per-section empty states |
| Module layout shell | Books `layout.tsx` pattern | Forums layout with sidebar nav |
| Action button (pill) | Books page.tsx pattern | Join, Create Thread, New Message |
| Search input | Words search pattern | Global search with `Cmd+K` |
| Data table | New component (shared via ui package after forums builds it) | Mod log, member list |
| Avatar circle | New component (reusable across forums, profile, messages) | Thread author, reply author, DM sender |
| Vote control | New component (forums-specific, potential share to other modules) | Thread/reply up/down voting |
| Nested reply tree | New component (forums-specific) | Thread detail page |
| Split pane | New component (reusable for any two-panel layout) | Messages split view |
| Markdown renderer | New component (reusable for notes, words, forums) | Thread body, reply body |

### New Shared Components to Extract to packages/ui/

After forums builds these, extract to packages/ui/ for cross-module reuse:

1. **`<DataTable>`** -- Sortable, filterable table with glass styling. Used by: forums mod log, budget transaction table, workouts log.
2. **`<Avatar>`** -- Circle with image, fallback initial + color. Used by: forums, any future social feature.
3. **`<SplitPane>`** -- Resizable two-panel layout. Used by: forums messages, potential books reader view.
4. **`<MarkdownBody>`** -- Render markdown content safely. Used by: forums threads/replies, notes module, words definitions.

---

## Page-by-Page Wireframes

### 1. Feed (`/forums` and `/forums/feed`)

```
+--[Sidebar 240px]--+--[Feed Center]-------------------------------------+
| MyForums          | Feed                                    [+ Thread] |
| ─────────────     | ──────────────────────────────────────────────────  |
| @ Feed       (●)  | [Sort: Hot | New | Top]        [Filter: All Tags]  |
| C Communities      | ┌─────────────────────────────────────────────────┐|
| S Search           | │ ▲ 42 │ Thread title here                       │|
| B Saved            | │   ▼  │ u/author · 3h · r/community-name · 💬12 │|
| P Profile          | │      │ Preview text of the thread body...       │|
|                    | └─────────────────────────────────────────────────┘|
| ── Messages ──     | ┌─────────────────────────────────────────────────┐|
| 💬 3 unread        | │ ▲ 18 │ Another thread title                    │|
|                    | │   ▼  │ u/author2 · 1d · r/another-comm · 💬5   │|
| ── Communities ──  | │      │ Preview of the body text...              │|
| r/general          | └─────────────────────────────────────────────────┘|
| r/feedback         | ... more thread cards ...                          |
| r/mybooks-club     |                                                    |
|                    | [Load more]                                        |
+--------------------+----------------------------------------------------+
```

### 2. Community Detail (`/forums/communities/[id]`)

```
+--[Sidebar]--+--[Thread List]---------------------+--[Community Info]--+
|             | r/community-name              [+]  | ┌────────────────┐|
|             | ─────────────────────────────────── | │ 🎯 Community   │|
|             | [Hot] [New] [Top]     [Filter Tags] | │ Name Here      │|
|             | ┌──────────────────────────────────┐| │                │|
|             | │ 📌 Pinned: Welcome thread       │| │ 1,234 members  │|
|             | │ u/creator · pinned              │| │ 567 threads    │|
|             | └──────────────────────────────────┘| │                │|
|             | ┌──────────────────────────────────┐| │ Description    │|
|             | │ ▲ 28 │ Regular thread title     │| │ text here...   │|
|             | │   ▼  │ u/poster · 2h · 💬 8     │| │                │|
|             | └──────────────────────────────────┘| │ ── Rules ──    │|
|             | ┌──────────────────────────────────┐| │ 1. Be kind     │|
|             | │ ▲ 12 │ Another thread           │| │ 2. Stay on     │|
|             | │   ▼  │ u/author · 5h · 💬 3     │| │    topic       │|
|             | └──────────────────────────────────┘| │                │|
|             |                                     | │ [Leave]        │|
|             |                                     | │ [Settings] ⚙️  │|
+-------------+-------------------------------------+------------------+
```

### 3. Thread Detail (`/forums/thread/[id]`)

```
+--[Sidebar]--+--[Thread Content]------------------------------------------------+
|             | ← Back to r/community-name                                       |
|             | ┌────────────────────────────────────────────────────────────────┐|
|             | │ Thread Title Here (heading, 24/700)                           │|
|             | │ u/author · 3h ago · r/community-name                          │|
|             | │                                                                │|
|             | │ Full thread body rendered as markdown. Can include images,     │|
|             | │ links, code blocks, etc.                                       │|
|             | │                                                                │|
|             | │ ▲ 42  💬 18 replies  🔖 Save  🔗 Share  🚩 Report            │|
|             | │ ▼                                                              │|
|             | └────────────────────────────────────────────────────────────────┘|
|             |                                                                   |
|             | ── Replies (18) ── [Sort: Best | New | Old]                       |
|             |                                                                   |
|             | ┌── u/replier1 · 2h · ▲ 12 ▼                                    |
|             | │   This is a top-level reply with some content.                  |
|             | │   [Reply] [Share] [Report]                                      |
|             | │                                                                 |
|             | │   ┌── u/replier2 · 1h · ▲ 5 ▼                                 |
|             | │   │   Nested reply at depth 1.                                  |
|             | │   │   [Reply] [Share]                                           |
|             | │   │                                                             |
|             | │   │   ┌── u/replier3 · 45m · ▲ 2 ▼                            |
|             | │   │   │   Depth 2 nested reply.                                 |
|             | │   │   └──                                                       |
|             | │   └──                                                           |
|             | └──                                                               |
|             |                                                                   |
|             | ┌── Reply box ────────────────────────────────────────────────── |
|             | │ Write a reply...                                    [Cmd+Enter]│|
|             | └────────────────────────────────────────────────────────────────┘|
+-------------+-------------------------------------------------------------------+
```

### 4. Messages (`/forums/messages`)

```
+--[Sidebar]--+--[Conversations]--------+--[Message Thread]-------------------+
|             | Messages     [+ New]     | u/friend-name                       |
|             | ─────────────────────    | ─────────────────────────────────── |
|             | ┌───────────────────┐    | ┌─────────────────────────────────┐ |
|             | │ 🟢 u/alice (●2)  │    | │ u/friend · 2:30 PM             │ |
|             | │ "Hey, did you..."│    | │ Hey, did you see the new...     │ |
|             | └───────────────────┘    | └─────────────────────────────────┘ |
|             | ┌───────────────────┐    | ┌─────────────────────────────────┐ |
|             | │ u/bob            │    | │ You · 2:32 PM                  │ |
|             | │ "Thanks for..."  │    | │ Yeah! That was really cool...   │ |
|             | └───────────────────┘    | └─────────────────────────────────┘ |
|             | ┌───────────────────┐    |                                     |
|             | │ Group: Book Club │    | ... more messages ...               |
|             | │ "Meeting at 5"   │    |                                     |
|             | └───────────────────┘    | ┌─────────────────────────────────┐ |
|             |                          | │ Type a message...    [Cmd+Enter]│ |
|             |                          | └─────────────────────────────────┘ |
+-------------+--------------------------+-------------------------------------+
```

### 5. Search (`/forums/search`)

```
+--[Sidebar]--+--[Search Results]------------------------------------------------+
|             | 🔍 [Search forums...                              ] [Cmd+K]     |
|             |                                                                   |
|             | ── Threads (24 results) ──────────  ── Communities (6) ────────── |
|             | ┌──────────────────────────────┐   ┌──────────────────────────┐  |
|             | │ Thread title matching query  │   │ 🎯 r/community-match    │  |
|             | │ u/author · r/comm · ▲12 💬5  │   │ 456 members · "Desc..." │  |
|             | └──────────────────────────────┘   │ [Join]                   │  |
|             | ┌──────────────────────────────┐   └──────────────────────────┘  |
|             | │ Another matching thread      │   ┌──────────────────────────┐  |
|             | │ u/author2 · r/comm2 · ▲8 💬2 │   │ 🎯 r/another-match     │  |
|             | └──────────────────────────────┘   │ 123 members · "Desc..." │  |
|             | ... more results ...               │ [Join]                   │  |
|             |                                    └──────────────────────────┘  |
+-------------+-------------------------------------------------------------------+
```

### 6. Profile (`/forums/profile/[id]`)

```
+--[Sidebar]--+--[Profile Content]-----------------------------------------------+
|             | ┌────────────────────────────────────────────────────────────────┐|
|             | │ [Banner Image or gradient]                                    │|
|             | │                                                                │|
|             | │  (64px avatar)  Display Name  @username  ✓ Verified           │|
|             | │                 "Status emoji + text"                          │|
|             | │                 📍 Location · 🔗 website.com                  │|
|             | │                                                                │|
|             | │  Bio text goes here, up to 500 characters...                  │|
|             | │                                                                │|
|             | │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                │|
|             | │  │  1,234 │ │    567 │ │    42  │ │  8,901 │                │|
|             | │  │ Karma  │ │Threads │ │Replies │ │Commun. │                │|
|             | │  └────────┘ └────────┘ └────────┘ └────────┘                │|
|             | │                                                                │|
|             | │  Badges: [🏆 First Post] [⭐ Karma 1000] [🛡️ Moderator]      │|
|             | │                                                                │|
|             | │  [Edit Profile] or [Send Message]                              │|
|             | └────────────────────────────────────────────────────────────────┘|
|             |                                                                   |
|             | ── Recent Activity ──                                             |
|             | Thread: "Title" in r/community · 2h ago                           |
|             | Reply in "Thread title" · 5h ago                                  |
|             | Joined r/new-community · 1d ago                                   |
+-------------+-------------------------------------------------------------------+
```

---

## Component Inventory

### New Components to Build

| Component | Location | Props | Responsibility |
|-----------|----------|-------|---------------|
| `ForumsLayout` | `forums/layout.tsx` | children | Sidebar nav + glass header shell |
| `ForumsSidebar` | inline in layout or extracted | activeRoute, communities, unreadCount | Left nav panel with tabs + community list |
| `ThreadCard` | inline or `forums/components/` | thread, onVote, onSave | Thread list item with vote controls |
| `VoteControl` | inline | score, direction, onVote | Up/down arrows with score display |
| `ReplyTree` | inline in thread page | replies, depth, onReply, onVote | Recursive nested reply renderer |
| `ReplyItem` | inline | reply, depth, onReply, onVote | Single reply with nesting indent |
| `ComposeBox` | inline | placeholder, onSubmit | Markdown-aware text input with submit |
| `CommunityCard` | inline | community, onJoin | Grid card for community directory |
| `CommunitySidebar` | inline | community, rules, members | Right panel on community detail |
| `ProfileCard` | inline | profile, badges, stats | Full profile display with stats |
| `ConversationList` | inline | conversations, activeId | Left pane of messages split view |
| `MessageThread` | inline | messages, onSend | Right pane of messages split view |
| `SearchResults` | inline | threads, communities | Two-column search results layout |
| `ModLogTable` | inline | actions | Sortable data table for mod actions |
| `EmptyState` | inline (pattern) | icon, title, body, ctaLabel, ctaHref | Module-specific empty state |
| `SkeletonThread` | inline | -- | Thread card skeleton for loading |
| `SkeletonCommunity` | inline | -- | Community card skeleton for loading |
| `SortTabs` | inline | options, active, onChange | Hot/New/Top sorting tabs |

### Shared Components Used from Existing Patterns

| Component/Pattern | Source | How It's Used |
|-------------------|--------|---------------|
| Glass card styling | `packages/ui/` tokens | All cards: thread, community, profile, messages |
| Module layout shell | `apps/web/app/books/layout.tsx` pattern | Forums layout header + nav |
| Server action pattern | `apps/web/app/books/actions.ts` pattern | All 45 server actions |
| `ModuleWebFallback` | `@/components/module-web-fallback` | Removed (replaced with real pages) |
| Pill button | Books page.tsx pattern | Join, Create, Send |

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
|----------|---------|--------|
| `Cmd+K` | Global | Open command palette (search communities, threads, users) |
| `j` / `k` | Thread list | Move selection down / up |
| `Enter` | Thread list | Open selected thread |
| `a` | Thread list or detail | Upvote selected item |
| `z` | Thread list or detail | Downvote selected item |
| `s` | Thread list or detail | Toggle bookmark on selected item |
| `r` | Thread detail | Focus reply compose box |
| `Cmd+Enter` | Compose box | Submit thread/reply/message |
| `Escape` | Compose box, modals | Close/cancel |
| `g` then `f` | Global | Go to Feed |
| `g` then `c` | Global | Go to Communities |
| `g` then `m` | Global | Go to Messages |
| `g` then `p` | Global | Go to Profile |
| `/` | Global | Focus search input |

---

## Test Plan

### Unit Tests (actions.test.ts)

| Test | What It Verifies |
|------|-----------------|
| `fetchCommunities` returns array | Cloud client called, result shaped correctly |
| `createThread` validates input | CreateThreadInputSchema enforced |
| `castVote` with valid direction | Cloud client receives correct params |
| `castVote` with invalid target | Throws validation error |
| `fetchReplies` with pagination | Offset/limit passed through |
| `createProfile` validates username | UsernameSchema enforced (3-30 chars, lowercase alphanumeric) |
| `sendMessage` validates body | MessageBody max length enforced |
| `toggleBookmark` toggles state | Returns new bookmark state |
| `createCommunity` validates name | Name regex enforced |
| `fetchModLog` returns actions array | Cloud client called for mod log |

### Integration Tests (page.test.tsx)

| Test | What It Verifies |
|------|-----------------|
| Feed page renders thread list | Skeleton -> thread cards after data loads |
| Feed page empty state | Shows "Find your communities" when no threads |
| Community detail renders correctly | Thread list + community info sidebar |
| Thread detail renders reply tree | OP card + nested replies at correct depths |
| Search results render two columns | Thread results left, community results right |
| Messages split pane renders | Conversation list left, message thread right |
| Profile page renders stats | Avatar, karma, thread count, badges |
| Vote control updates optimistically | Score changes immediately on click |
| Keyboard shortcut `j/k` | Moves selection in thread list |
| Error state renders retry | Shows error card with retry button on fetch failure |

### Visual QA Checklist

| Item | Acceptance Criteria |
|------|-------------------|
| Thread card glass styling | Background: rgba(255,255,255,0.04), border: rgba(255,255,255,0.06), radius: 16px |
| Vote arrows accent color | Upvoted: #F43F5E, downvoted: #3B82F6, neutral: textSecondary |
| Sidebar active indicator | 3px left border, #F43F5E, on active nav item |
| Empty states per section | Each has: icon, warm headline, description, CTA button |
| Skeleton loading | Pulsing glass rectangles matching content layout |
| Thread nesting indentation | 24px indent per depth level, left border line |
| Profile badges | Pill-shaped, accent color at 15% opacity bg |
| Message unread badge | Small rose circle with white count text |
| Responsive at 768px | Sidebar collapses, two-panel becomes one |
| Responsive at <768px | Single column, bottom nav visible |
| No horizontal scroll | At any breakpoint, no content overflows |
| Dark mode consistency | No light-themed elements inside dark containers |
| Focus indicators | 2px #F43F5E outline on all focusable elements |
| Hover states on thread cards | Subtle elevation shift + border brightness increase |

---

## Implementation Phases

### Phase A: Foundation (layout + actions + feed)
- [ ] Create `forums/layout.tsx` with sidebar nav
- [ ] Create `forums/actions.ts` with all ~45 server actions
- [ ] Create `forums/ui.ts` with shared formatters
- [ ] Create `forums/page.tsx` (feed page) with thread cards, voting, sorting
- [ ] Wire all 5 states for feed page

### Phase B: Community Experience
- [ ] Create `forums/communities/page.tsx` (directory grid)
- [ ] Create `forums/communities/[id]/page.tsx` (community detail with thread list + sidebar)
- [ ] Create `forums/communities/create/page.tsx` (create form)
- [ ] Create `forums/communities/[id]/settings/page.tsx` (settings panel)
- [ ] Create `forums/communities/[id]/mod-log/page.tsx` (data table)
- [ ] Wire all 5 states for each page

### Phase C: Thread Experience
- [ ] Create `forums/thread/[id]/page.tsx` (thread detail with nested reply tree)
- [ ] Create `forums/thread/create/page.tsx` (compose with markdown preview)
- [ ] Build reply tree component with recursive nesting
- [ ] Build vote control component with optimistic updates
- [ ] Wire all 5 states

### Phase D: Search + Saved
- [ ] Create `forums/search/page.tsx` (two-column results)
- [ ] Create `forums/saved/page.tsx` (bookmarked threads)
- [ ] Implement `Cmd+K` command palette integration
- [ ] Wire all 5 states

### Phase E: Profiles
- [ ] Create `forums/profile/page.tsx` (current user redirect)
- [ ] Create `forums/profile/[id]/page.tsx` (public profile with stats + badges)
- [ ] Create `forums/profile/edit/page.tsx` (edit form)
- [ ] Wire all 5 states

### Phase F: Messaging
- [ ] Create `forums/messages/page.tsx` (split-pane conversation list)
- [ ] Create `forums/messages/[id]/page.tsx` (message thread)
- [ ] Create `forums/messages/new/page.tsx` (new conversation)
- [ ] Wire all 5 states

### Phase G: Voice + Polish
- [ ] Create `forums/voice/[channelId]/page.tsx` (voice channel UI)
- [ ] Add keyboard shortcuts across all pages
- [ ] Polish responsive breakpoints
- [ ] Remove all ModuleWebFallback stubs

### Phase H: Testing
- [ ] Write `actions.test.ts` (10+ server action tests)
- [ ] Write `page.test.tsx` (10+ page render tests)
- [ ] Run visual QA checklist
- [ ] Run accessibility audit (keyboard nav, focus order, ARIA)

---

## QA Checklist

- [ ] All 17 pages render without errors
- [ ] All 5 states verified per page (loading, empty, error, success, partial)
- [ ] Thread card voting updates optimistically
- [ ] Nested reply tree renders 4+ depth levels
- [ ] Community directory grid responsive at all breakpoints
- [ ] Messages split-pane works at desktop, collapses at mobile
- [ ] Profile stats display correctly
- [ ] Search returns both threads and communities
- [ ] Keyboard shortcuts `j/k/a/z/s/r` work in thread list
- [ ] `Cmd+K` opens command palette from any page
- [ ] All ModuleWebFallback stubs removed
- [ ] No light theme elements inside dark containers
- [ ] No "Coming Soon" or placeholder text
- [ ] No horizontal scroll at any breakpoint
- [ ] Focus indicators visible on all interactive elements
- [ ] Empty states use warm, module-specific copy (not "No items found")
- [ ] Error states show retry button (not technical errors)
- [ ] Cool Obsidian tokens used consistently (background, surface, glass, text, border)
- [ ] Module accent #F43F5E used for CTAs, active states, upvotes
- [ ] `prefers-reduced-motion` disables animations
- [ ] Server actions wrap calls in try/catch/finally (no stuck loading)
