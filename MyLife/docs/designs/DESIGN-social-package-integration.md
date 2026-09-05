# Social Package Integration Review: MyMarket + MyForums

**Date:** 2026-03-10
**Status:** Review Complete
**Scope:** Changes needed to `@mylife/social` and `@mylife/module-registry` to support MyMarket and MyForums modules

---

## 1. Module Registry Changes

### New ModuleIds

Add to `packages/module-registry/src/types.ts` ModuleId union:

```typescript
| 'market'   // MyMarket -- marketplace/classifieds
| 'forums'   // MyForums -- community discussion boards
```

### New Table Prefixes

| Module | Prefix | Tables |
|--------|--------|--------|
| Market | `mk_` | mk_categories, mk_listings, mk_listing_photos, mk_conversations, mk_messages, mk_watchlist, mk_reviews, mk_seller_stats, mk_listing_price_history, mk_saved_searches, mk_reports, mk_blocks |
| Forums | `fr_` | fr_communities, fr_community_members, fr_community_rules, fr_threads, fr_replies, fr_votes, fr_bookmarks, fr_user_stats, fr_mod_actions, fr_reports, fr_blocks, fr_tags, fr_thread_tags, fr_notifications, fr_community_categories, fr_drafts |

### Registry Constants

Add to `packages/module-registry/src/constants.ts`:

```typescript
{ id: 'market', name: 'MyMarket', icon: '🏪', tier: 'premium', prefix: 'mk_' }
{ id: 'forums', name: 'MyForums', icon: '💬', tier: 'premium', prefix: 'fr_' }
```

### Release State

Both modules start at `alpha` release state until P0 features are complete, then graduate to `public_beta`.

---

## 2. Social Package Type Extensions

### 2.1 SOCIAL_CAPABLE_MODULES

Add both modules to the array in `packages/social/src/types.ts`:

```typescript
export const SOCIAL_CAPABLE_MODULES: readonly ModuleId[] = [
  'books', 'budget', 'fast', 'forums', 'habits', 'health',
  'market', 'meds', 'recipes', 'surf', 'words', 'workouts',
] as const;
```

### 2.2 New ActivityTypes

Add to `ActivityTypeSchema` enum:

```typescript
// Market
'market_listing_posted',   // Seller lists a new item
'market_listing_sold',     // Item is marked as sold
'market_milestone',        // Seller reaches a milestone (10 sales, 50 listings, etc.)

// Forums
'forums_thread_created',   // User creates a new thread
'forums_reply_posted',     // User posts a reply (high-karma replies only, to avoid spam)
'forums_community_created', // User creates a new community
'forums_karma_milestone',  // User reaches a karma milestone (100, 500, 1000, etc.)
```

Total: 7 new activity types (3 market + 4 forums).

### 2.3 New ShareCardTypes

Add to `ShareCardTypeSchema` enum:

```typescript
| 'listing'       // MyMarket: share a listing card with photo, price, title
| 'forum_thread'  // MyForums: share a thread card with title, community, vote count
```

### 2.4 New ActivityEmitter Helpers

Add to `packages/social/src/activity-emitter.ts`:

```typescript
// Market
emitListingPosted(listing: { id, title, price, category, photoUrl })
emitListingSold(listing: { id, title, price, buyerHandle })
emitMarketMilestone(milestone: { type, count, description })

// Forums
emitForumThreadCreated(thread: { id, title, communityName, communityId })
emitForumReplyPosted(reply: { threadTitle, communityName, replyPreview })
emitForumCommunityCreated(community: { id, name, description })
emitForumKarmaMilestone(milestone: { karma, description })
```

---

## 3. Architecture Decisions

### 3.1 Groups vs Communities

**Decision: Keep separate.**

- `social_groups` (existing): Private coordination groups (friend circles, challenge teams). Small, invite-based.
- `fr_communities` (new): Public/restricted discussion boards (subreddits). Large, topic-based, with moderation tools.

These serve fundamentally different purposes. Merging them would require adding moderation, threading, voting, rules, and categories to the simple Groups model, making it unwieldy.

### 3.2 Comments vs Forum Replies

**Decision: Keep separate.**

- `social_comments` (existing): Short reactions to activity feed items (max 500 chars, flat list).
- `fr_replies` (new): Threaded discussion replies with markdown, nested threading (parent_reply_id), voting, and editing.

Forum replies are structurally different (threaded, voteable, editable) and should not be forced into the flat comment model.

### 3.3 Kudos vs Forum Votes

**Decision: Keep separate.**

- `social_kudos` (existing): Emoji reactions on activity feed items (fire, clap, muscle, etc.). Social/emotional.
- `fr_votes` (new): Binary upvote/downvote on threads and replies. Score-based ranking.

Kudos are expressive reactions; votes are ranking signals. Different purpose, different UI, different data model.

### 3.4 Marketplace Messaging vs Social Comments

**Decision: Marketplace gets its own messaging.**

- `mk_conversations` + `mk_messages`: Buyer-seller conversations tied to a specific listing. Private between two parties. Supports offers, counter-offers, meetup coordination.
- This is fundamentally different from social comments (public reactions) or forum replies (public discussion).

### 3.5 Blocking

**Decision: Module-specific blocking with future global consolidation.**

Both `mk_blocks` and `fr_blocks` store module-level blocks. A future `social_blocks` table could provide a global block list that propagates to all social modules. For now, module-specific blocks are simpler and avoid cross-module coupling.

---

## 4. Shared Infrastructure Leveraged

Both modules build on top of existing infrastructure without modifying it:

| Infrastructure | Used By | How |
|---------------|---------|-----|
| `social_profiles` | Both | User identity, handles, avatars. No schema changes needed. |
| `social_follows` | Both | Follow relationships for visibility filtering. |
| Activity feed | Both | New activity types posted via `emitActivity()`. |
| Share cards | Both | New card types rendered by existing `ShareCardPreview` component. |
| Leaderboards | Forums | Forum karma can feed into leaderboard scoring. |
| Groups | Neither | Forums communities and marketplace are distinct from social groups. |

---

## 5. Leaderboard Scoring Additions

Add to default leaderboard scoring config:

```typescript
// Market
'market_listing_posted': 1,
'market_listing_sold': 2,
'market_milestone': 5,

// Forums
'forums_thread_created': 1,
'forums_reply_posted': 0.5,  // Lower to discourage low-effort replies
'forums_community_created': 3,
'forums_karma_milestone': 5,
```

---

## 6. Cross-Module Integration Points

### Forums x Other Modules

Forums has a `linked_module_id` column on `fr_communities`, enabling module-specific discussion boards:

| Module | Suggested Community | Example Topics |
|--------|-------------------|----------------|
| books | Book Club | Reading discussions, recommendations, reviews |
| recipes | Kitchen Talk | Recipe sharing, cooking tips, ingredient substitutions |
| workouts | Gym Talk | Form checks, program reviews, progress sharing |
| surf | Lineup | Spot reports, condition discussions, gear reviews |
| budget | Money Matters | Budgeting tips, deal sharing, financial goals |
| nutrition | Fuel Up | Meal prep, macro tips, diet discussions |
| health | Wellness | Health tracking tips, milestone celebrations |
| habits | Accountability | Habit building, streak celebrations, motivation |
| market | Buyer/Seller Chat | Marketplace meta-discussion, tips, category talk |

### Market x Forums

- Marketplace categories can link to forum communities (e.g., "Electronics" category links to electronics discussion board)
- Sellers can share listings in relevant forum communities
- Forum threads can reference marketplace listings via entity cards

### Market x Social

- Seller reputation visible on social profile
- Listing milestones appear in activity feed
- Shareable listing cards via share card system

---

## 7. Breaking Changes

**None.** All changes are additive:
- New values added to existing enums (ActivityType, ShareCardType, ModuleId)
- New entries in SOCIAL_CAPABLE_MODULES array
- New helper functions in activity-emitter
- No existing types modified, no existing tables altered

The only risk is Zod enum validation. If any code does strict `ActivityTypeSchema.parse()` on data that includes new types before the schema is updated, it would fail. The update to types.ts must be deployed before any marketplace or forums activities are emitted.

---

## 8. Implementation Order

1. **Registry first:** Add `market` and `forums` to ModuleId union and constants
2. **Social types:** Add new ActivityTypes, ShareCardTypes, and SOCIAL_CAPABLE_MODULES entries
3. **Module scaffolding:** Create `modules/market/` and `modules/forums/` with definitions
4. **Supabase migrations:** Create the `mk_*` and `fr_*` tables
5. **Activity emitters:** Add helper functions
6. **UI wiring:** Add routes in apps/mobile and apps/web
7. **Share cards:** Add listing and thread card renderers

Steps 1-2 should be a single PR. Steps 3-5 can be parallelized per module. Steps 6-7 follow after module logic is in place.
