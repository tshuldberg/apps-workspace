# Feature Spec: Market UI Screens

## Metadata
- **Module:** market
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 5 x3 + Complexity 2 x2 + CrossModule 0 x1 + PaidUser 0 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 4-6 hours
- **Depends On:** Cloud client functions (market), modules/market/src/types.ts (exists), modules/market/src/db/crud.ts (exists)
- **Blocks:** Payment integration, Delivery tracking, Service discovery, Seller verification, Dispute resolution

## Business Context

### Why This Feature Exists
Market currently has data models, Zod schemas, local cache CRUD, cloud client functions, and encryption helpers, but zero UI. Without screens, the module is invisible to users. Every marketplace competitor ships with at minimum: browse/search, listing detail, create listing, messaging, and profile screens. This is the foundational UI layer that makes the entire Market module functional.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Facebook Marketplace | Yes | No | Tab-based: Browse (feed), Sell (camera-first), Inbox, Profile. Heavy algorithmic feed. |
| OfferUp | Yes | No | 5-tab nav: Home, Categories, Sell, Inbox, Account. Location-first browse. |
| Craigslist | Yes | No | Web-first list view, category drill-down, minimal detail pages. No native app UX. |
| Mercari | Yes | No | Home feed, Search, Sell (guided flow), Messages, Profile. Card-based grid. |
| NextDoor | Yes | No | For Sale section inside community app, list view, filter bar. |

### Target User
Anyone using Facebook Marketplace who wants to browse and list items without a Facebook account, without ads, and without tracking. Also Craigslist users who want a modern mobile-first experience with seller profiles and ratings.

## Technical Context

### Where This Lives in MyLife

```
apps/mobile/app/(market)/
  index.tsx                -- Browse tab (listing grid + search bar + category filter)
  sell.tsx                 -- Sell tab (user's active listings + create listing CTA)
  messages.tsx             -- Messages tab (conversation list)
  saved.tsx                -- Saved tab (watchlist)
  profile.tsx              -- Profile tab (seller stats, settings)
  listing-detail.tsx       -- Listing detail screen (photo gallery, description, actions)
  create-listing.tsx       -- Multi-step listing creation form
  edit-listing.tsx         -- Edit existing listing (pre-populated form)
  chat-thread.tsx          -- Individual conversation thread
  category-browser.tsx     -- Category drill-down browser
  search-results.tsx       -- Full search results with filters
  seller-profile.tsx       -- Public seller profile view
apps/web/app/market/
  page.tsx                 -- Browse page (listing grid + search + filters)
  sell/page.tsx            -- Seller dashboard (my listings)
  messages/page.tsx        -- Conversations list
  saved/page.tsx           -- Watchlist
  profile/page.tsx         -- Seller profile
  [id]/page.tsx            -- Listing detail
  create/page.tsx          -- Create listing form
  [id]/edit/page.tsx       -- Edit listing form
  actions.ts               -- Server actions (cloud client wrappers)
  layout.tsx               -- Market module layout with sub-nav
```

### Wireframe Position

```
Hub Dashboard
  └── MyMarket card
       ├── Browse tab        ← Primary landing
       ├── Sell tab           ← My listings + create
       ├── Messages tab       ← Conversations
       ├── Saved tab          ← Watchlist
       └── Profile tab        ← Seller stats
```

### Data Model
No new tables. All screens read/write through existing cloud client functions and local cache CRUD.

Existing data sources:
```
Cloud: cloudGetCategories, cloudGetListings, cloudGetListingById,
       cloudCreateListing, cloudUpdateListingStatus, cloudSearchListings,
       cloudGetListingsWithinRadius, cloudGetConversations, cloudGetMessages,
       cloudSendMessage, cloudGetWatchlist, cloudToggleWatch,
       cloudGetSellerReviews, cloudGetSellerStats
Cache: getCachedCategories, getCachedListings, getCachedListingById,
       getCachedConversations, getCachedMessages, getCachedWatchlist
```

### Dependencies
- **Internal:** `@mylife/market` (cloud client, cache CRUD, types, encryption), `@mylife/ui` (Cool Obsidian tokens, glass components), `@mylife/db` (DatabaseAdapter)
- **External:** expo-image (photo gallery), expo-blur (glass morphism on mobile)
- **Cross-Module:** None directly, but social profile integration via `@mylife/social` for seller cards

## Functional Requirements

### User Stories
1. As a buyer, I want to browse listings by category so I can find items I'm interested in.
2. As a buyer, I want to search listings by keyword so I can find specific items.
3. As a buyer, I want to view listing details with photos and description so I can decide whether to buy.
4. As a buyer, I want to message a seller directly from a listing so I can ask questions or arrange a purchase.
5. As a buyer, I want to save listings to my watchlist so I can revisit them later.
6. As a seller, I want to create a listing with photos, price, and description so I can sell my items.
7. As a seller, I want to see all my conversations in one place so I can manage buyer inquiries.
8. As a seller, I want to view my profile stats so I can see my reputation.

### Behavior Specification

**Browse Tab (index.tsx):**
1. Screen loads with a search bar at top, horizontal category chips below, and a 2-column listing grid.
2. User taps a category chip to filter listings.
3. User types in search bar; results update with 300ms debounce.
4. Each listing card shows: cover photo, title, price, condition badge, location (neighborhood), time posted.
5. Tapping a listing card navigates to listing-detail screen.
6. Infinite scroll loads 20 listings per page.

**Listing Detail (listing-detail.tsx):**
1. Full-width photo gallery with horizontal swipe and dot indicators.
2. Below gallery: price (large), title, condition + listing type badges.
3. Description section (expandable if > 3 lines).
4. Category breadcrumb (tappable).
5. Location (neighborhood name + approximate distance).
6. Seller card: avatar, name, rating stars, member since, response time.
7. Action bar: "Message Seller" (primary), heart icon (save/unsave), share icon.
8. "Similar Listings" section at bottom.

**Create Listing (create-listing.tsx):**
1. Step 1: Add photos (camera or library, up to 10, reorderable).
2. Step 2: Title, description, pricing type + price, condition.
3. Step 3: Category selection (drill-down picker).
4. Step 4: Location (auto-detected, editable to neighborhood level).
5. Step 5: Preview with all fields rendered as they'll appear.
6. "Publish" button posts listing. "Save Draft" preserves for later.

**Messages Tab (messages.tsx):**
1. List of conversations sorted by last message timestamp.
2. Each row: listing thumbnail, other party's name, last message preview, timestamp, unread indicator.
3. Tapping a conversation opens chat-thread screen.

**Chat Thread (chat-thread.tsx):**
1. Message bubbles (sender right-aligned, receiver left-aligned).
2. Listing card pinned at top of thread (tappable to view listing).
3. Text input with send button.
4. Messages load from cloud, cached locally for offline reading.

### Edge Cases
- Empty browse state: "No listings nearby yet. Be the first to post!" with create CTA.
- Empty search results: "No results for '[query]'. Try different keywords or browse categories."
- Empty messages: "No conversations yet. Message a seller to get started."
- Empty watchlist: "You haven't saved any listings yet. Browse and tap the heart icon."
- Listing deleted while viewing: Show "This listing is no longer available" with back button.
- Seller blocked by viewer: Hide all their listings from browse/search, show "Content unavailable" if direct-linked.
- Network offline: Show cached listings with "Offline mode" banner. Disable create/message/save actions.
- Photo upload fails: Show retry button per photo, allow publishing without failed photos if at least 1 succeeds.
- Listing at 100 active limit: Show "You've reached the 100-listing limit. Archive or remove a listing to create a new one."

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Browse tab displays listings in a 2-column grid with cover photo, title, price, and location
- [ ] **AC-2:** Tapping a listing card navigates to the detail screen showing full photo gallery and description
- [ ] **AC-3:** Search bar filters listings in real-time with 300ms debounce
- [ ] **AC-4:** Category chips filter the listing grid to show only matching listings
- [ ] **AC-5:** Create listing flow completes in 5 steps and publishes a visible listing
- [ ] **AC-6:** "Message Seller" opens a chat thread tied to the specific listing
- [ ] **AC-7:** Heart icon toggles watchlist status with immediate visual feedback
- [ ] **AC-8:** Messages tab shows all conversations sorted by recency with unread indicators
- [ ] **AC-9:** Seller profile screen shows listing count, sold count, average rating, response time
- [ ] **AC-10:** Infinite scroll loads next page of listings when user scrolls to bottom
- [ ] **AC-11:** Draft listing can be saved and resumed later
- [ ] **AC-12:** Photo gallery supports horizontal swipe with dot indicators

### Technical Criteria
- [ ] **TC-1:** All screens use Cool Obsidian tokens (background #0A0A0F, surface #12121A, glass cards)
- [ ] **TC-2:** Module accent color #14B8A6 used for primary actions and highlights
- [ ] **TC-3:** Listings cache locally for offline browse (read from mk_*_cache tables)
- [ ] **TC-4:** Cloud operations use Result<T> pattern with user-visible error messages on failure
- [ ] **TC-5:** Web routes follow Next.js App Router conventions with server actions in actions.ts
- [ ] **TC-6:** Mobile screens use Expo router file-based routing under (market)/
- [ ] **TC-7:** All Zod schemas from types.ts used for form validation (CreateListingInputSchema)

### Negative Criteria
- [ ] **NC-1:** Must NOT show exact seller location (only neighborhood name)
- [ ] **NC-2:** Must NOT display view counts publicly (seller-only in analytics)
- [ ] **NC-3:** Must NOT show listings from blocked users
- [ ] **NC-4:** Must NOT require authentication for browsing (read-only is anon)
- [ ] **NC-5:** Must NOT use algorithmic feed sorting (chronological + relevance only)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#14B8A6` (teal, trusted marketplace signal)
- Listing cards: glass card with rounded corners (12px), cover photo top, info below
- Search bar: surfaceElevated `#1A1A24` with border, search icon left
- Category chips: horizontal ScrollView, glass background, accent border when active
- Photo gallery: full-width, aspect ratio 4:3, expo-image for performance
- Action bar: fixed bottom, primary button "Message Seller" in accent color

### Web (Next.js)
- Same tokens via CSS variables in `globals.css`
- Sidebar navigation: Market module listed with storefront icon
- Browse page: responsive grid (2 cols mobile, 3 cols tablet, 4 cols desktop)
- Listing detail: two-column layout (photos left, info right) on desktop
- Create listing: single-column centered form, max-width 640px

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (shimmer) in grid layout | Initial fetch / tab switch |
| Empty | Illustration + "No listings yet" message + CTA | No data for current filter |
| Error | "Couldn't load listings. Tap to retry." with retry button | Network/server error |
| Success | Listing grid with all data populated | Data loaded |
| Partial | Some listings visible + loading indicator at bottom | Infinite scroll mid-load |
| Offline | Cached listings + amber "Offline" banner at top | No network connectivity |

## Test Requirements

### Unit Tests
- [ ] Browse screen renders listing cards from mock data
- [ ] Search debounce fires after 300ms of inactivity
- [ ] Category filter updates displayed listings
- [ ] Create listing form validates required fields per CreateListingInputSchema
- [ ] Watchlist toggle updates UI state immediately (optimistic)
- [ ] Conversation list sorts by lastMessageAt descending
- [ ] Seller profile computes display values from SellerStats

### Integration Tests
- [ ] Full flow: create listing -> appears in browse -> open detail -> message seller -> conversation visible
- [ ] Watchlist flow: browse -> save listing -> appears in Saved tab -> unsave -> removed from Saved tab
- [ ] Offline flow: load listings online -> go offline -> cached listings still visible

### QA Verification Script

1. Open app on mobile
2. Navigate to MyMarket module from hub dashboard
3. Verify: Browse tab loads with listing grid or empty state -- AC-1
4. Tap search bar, type "bike" -- verify results filter with debounce -- AC-3
5. Tap a category chip -- verify grid filters to that category -- AC-4
6. Tap a listing card -- verify detail screen with photo gallery, price, description -- AC-2
7. Swipe photos horizontally -- verify gallery navigation with dots -- AC-12
8. Verify seller card shows name, rating, member since -- AC-9
9. Tap heart icon -- verify it fills (saved) -- AC-7
10. Navigate to Saved tab -- verify listing appears -- AC-7
11. Tap heart again -- verify it unfills (unsaved)
12. Tap "Message Seller" -- verify chat thread opens tied to listing -- AC-6
13. Send a message -- verify it appears in thread
14. Navigate to Messages tab -- verify conversation appears with last message -- AC-8
15. Navigate to Sell tab -- tap "Create Listing"
16. Complete all 5 steps with valid data -- AC-5
17. Tap "Publish" -- verify listing appears in browse -- AC-5
18. Scroll to bottom of browse -- verify next page loads -- AC-10
19. Navigate to Profile tab -- verify stats display -- AC-9
20. Repeat steps 2-18 on web at /market
21. Verify web layout: responsive grid, two-column detail on desktop
22. Verify all screens use Cool Obsidian dark theme -- TC-1
23. Turn off network -- verify cached listings visible with offline banner
24. Verify: no exact addresses shown anywhere -- NC-1
25. Verify: browsing works without login -- NC-4

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /market on web, verify all 5 states (loading/empty/error/success/partial)
- [ ] Batch QA: after 5 features in Market module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- market has no standalone counterpart, skip
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Market module has: ModuleDefinition with 5-tab nav, 17 Zod schemas, 6 SQLite cache tables, 13 local CRUD functions, 21 cloud client functions, AES-GCM encryption helpers, Signal-style type definitions. Zero UI screens exist. The module is registered on both mobile (28 modules) and web (19 modules) but shows no content.

### After This Work
Full 5-tab mobile UI and complete web page structure. Users can browse, search, create listings, message sellers, save favorites, and view profiles. All screens use Cool Obsidian theme with glass morphism.

### Files Changed
- `apps/mobile/app/(market)/index.tsx` -- Browse tab
- `apps/mobile/app/(market)/sell.tsx` -- Sell tab
- `apps/mobile/app/(market)/messages.tsx` -- Messages tab
- `apps/mobile/app/(market)/saved.tsx` -- Saved/Watchlist tab
- `apps/mobile/app/(market)/profile.tsx` -- Profile tab
- `apps/mobile/app/(market)/listing-detail.tsx` -- Listing detail screen
- `apps/mobile/app/(market)/create-listing.tsx` -- Multi-step create listing
- `apps/mobile/app/(market)/edit-listing.tsx` -- Edit listing
- `apps/mobile/app/(market)/chat-thread.tsx` -- Conversation thread
- `apps/mobile/app/(market)/category-browser.tsx` -- Category drill-down
- `apps/mobile/app/(market)/search-results.tsx` -- Search results with filters
- `apps/mobile/app/(market)/seller-profile.tsx` -- Public seller profile
- `apps/web/app/market/page.tsx` -- Browse page
- `apps/web/app/market/layout.tsx` -- Market layout with sub-nav
- `apps/web/app/market/sell/page.tsx` -- Seller dashboard
- `apps/web/app/market/messages/page.tsx` -- Conversations
- `apps/web/app/market/saved/page.tsx` -- Watchlist
- `apps/web/app/market/profile/page.tsx` -- Seller profile
- `apps/web/app/market/[id]/page.tsx` -- Listing detail
- `apps/web/app/market/create/page.tsx` -- Create listing
- `apps/web/app/market/[id]/edit/page.tsx` -- Edit listing
- `apps/web/app/market/actions.ts` -- Server actions

### Known Limitations
- No real-time message delivery (polling-based until Supabase Realtime wired)
- No photo upload UI (placeholder until Supabase Storage integration)
- No push notifications (requires notification infrastructure)
- No deep links to specific listings from outside the app

### Context for Next Agent
The module navigation is already defined in `definition.ts` with 5 tabs and 7 screens. Use the existing Zod schemas for all form validation. The cloud client returns `Result<T>`, so handle both `ok: true` and `ok: false` cases in every screen. Check `modules/market/CLAUDE.md` for the full export list.
