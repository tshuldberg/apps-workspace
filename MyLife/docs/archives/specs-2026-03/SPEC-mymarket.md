# MyMarket - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-10
> **Status:** Draft
> **Author:** module-dev
> **Reviewer:** team-lead

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyMarket
- **Tagline:** Buy, sell, and trade with your community
- **Module ID:** `market`
- **Feature ID Prefix:** MK
- **Table Prefix:** `mk_`
- **Icon:** `🏪`
- **Accent Color:** `#14B8A6` (teal-500, trusted marketplace energy)
- **Tier:** Premium (included in MyLife Pro)
- **Storage Type:** Supabase (multi-user, real-time)

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Local Seller (Dana) | 25-40, decluttering or moving, has items to sell quickly, prefers local pickup | List items fast with minimal friction, reach nearby buyers, complete sales safely without shipping hassle |
| Privacy-Conscious Buyer (Nico) | 30-50, shops secondhand to save money and reduce waste, distrusts data-harvesting marketplaces | Browse listings without being tracked, communicate directly with sellers, no targeted ads or algorithmic manipulation |
| Small Crafter/Maker (Jules) | 20-35, sells handmade goods or refurbished items, wants a no-fee marketplace | Maintain a seller storefront, build reputation over time, avoid 10-15% platform fees |
| Community Trader (Casey) | 18-30, active in Buy Nothing / free stuff groups, prefers giving and trading over selling | Post free items, arrange trades, participate in neighborhood exchanges |
| Collector/Hobbyist (Morgan) | 25-55, collects specific items (vinyl, vintage, cameras), wants category-specific search | Save searches for specific items, get alerts on new listings, browse by detailed condition/category |

### 1.3 Core Value Proposition

MyMarket is a privacy-first classifieds and marketplace module that combines the local reach of Facebook Marketplace with the simplicity of Craigslist, without the ads, tracking, or data harvesting. Listings are visible to the MyLife community. Buyer-seller communication is private and direct. Location is always approximate (neighborhood level) to protect user safety. There are zero listing fees, zero transaction fees, and zero promoted listings. The marketplace exists to serve MyLife users, not to monetize their attention.

Unlike Facebook Marketplace (requires Facebook account, tracks everything, shows ads), OfferUp (promotes paid "bumps," charges shipping fees), or Craigslist (no user profiles, no safety features, dated UX), MyMarket provides verified seller profiles (backed by the existing social profile system), a reputation/rating system, and a modern browsing experience, all within the MyLife hub.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Facebook Marketplace | Massive audience, social trust signals, Messenger integration, shipping labels | Requires Facebook account, heavy tracking/ads, algorithmic feed manipulation, scam-prone | No account tracking, no ads, no algorithmic manipulation, privacy-first |
| OfferUp | Dedicated marketplace app, TruYou verification, shipping built-in | Paid promotion ("bumps"), 12.9% seller fee on shipped items, aggressive monetization | Zero fees for sellers, no promoted listings, equal visibility for all |
| Craigslist | Simple, free, no account required, massive traffic | No user profiles, no ratings, minimal safety features, dated UI, spam-heavy | Verified profiles, seller ratings, modern UI, content moderation |
| Mercari | Shipping-first, buyer protection, instant pay | 10% seller fee, shipping-only (no local pickup), requires account | Zero fees, local pickup preferred, optional shipping |
| Poshmark | Fashion expertise, social selling features, authentication service | 20% seller fee, fashion-only, party-centric UX | All categories, zero fees, general-purpose marketplace |
| NextDoor | Neighborhood-focused, trusted community, local services | Requires verified address, shows ads, limited marketplace features | Neighborhood-level privacy without address verification, full marketplace feature set |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- No ad targeting, no behavioral tracking, no data selling
- Location is always approximate (neighborhood/city level, never exact address)
- Buyer-seller messages are private between the two parties and should not require phone-number disclosure
- No algorithmic feed manipulation or paid promotion: listings sort by recency and relevance
- Seller profiles show only what the user chooses to display
- No third-party analytics or tracking pixels
- Photo EXIF data (GPS coordinates, device info) is stripped on upload
- Users can delete all their marketplace data at any time (listings, messages, ratings)
- Search history is stored locally on-device, never sent to servers
- No "shadow profiles" or cross-module data correlation without explicit opt-in

**Privacy marketing angle:** "Your stuff, your price, your terms. No ads, no tracking, no platform fees."

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| MK-001 | Listing Creation and Management | P0 | Core | None | Not Started |
| MK-002 | Category System | P0 | Core | None | Not Started |
| MK-003 | Listing Photo Upload | P0 | Core | MK-001 | Not Started |
| MK-004 | Listing Search and Discovery | P0 | Core | MK-001, MK-002 | Not Started |
| MK-005 | Listing Detail View | P0 | Core | MK-001 | Not Started |
| MK-006 | Buyer-Seller Messaging | P0 | Core | MK-001 | Not Started |
| MK-007 | Listing Lifecycle | P0 | Core | MK-001 | Not Started |
| MK-008 | Watchlist/Saved Listings | P1 | Core | MK-001 | Not Started |
| MK-009 | Seller Profiles and Reputation | P1 | Social | MK-001 | Not Started |
| MK-010 | Seller Ratings and Reviews | P1 | Social | MK-009 | Not Started |
| MK-011 | Location-Based Filtering | P1 | Discovery | MK-001 | Not Started |
| MK-012 | Saved Searches and Alerts | P1 | Discovery | MK-004 | Not Started |
| MK-013 | Price Drop Alerts | P1 | Discovery | MK-008 | Not Started |
| MK-014 | Report and Block System | P0 | Safety | MK-001 | Not Started |
| MK-015 | Content Moderation | P0 | Safety | MK-014 | Not Started |
| MK-016 | Offer System | P1 | Core | MK-001, MK-006 | Not Started |
| MK-017 | Free Stuff / Buy Nothing | P1 | Core | MK-001 | Not Started |
| MK-018 | Trade/Barter Support | P2 | Core | MK-001 | Not Started |
| MK-019 | Price Suggestion Engine | P2 | Analytics | MK-001, MK-002 | Not Started |
| MK-020 | Listing Analytics (Seller) | P2 | Analytics | MK-001 | Not Started |
| MK-021 | Social Feed Integration | P1 | Social | MK-001 | Not Started |
| MK-022 | Share Cards | P2 | Social | MK-001 | Not Started |
| MK-023 | Seasonal/Trending Categories | P2 | Discovery | MK-002, MK-004 | Not Started |
| MK-024 | Bulk Listing Import | P2 | Data Management | MK-001 | Not Started |
| MK-025 | Data Export | P2 | Data Management | MK-001 | Not Started |

---

## 3. Feature Specifications

### MK-001: Listing Creation and Management

**Priority:** P0
**Category:** Core

#### Description

Users can create marketplace listings with structured fields. Listings support multiple photos, pricing options (fixed, negotiable, free), condition ratings, and category assignment. Sellers can edit and relist items.

#### Data Model

A listing contains:
- **Title** (required, 3-120 characters)
- **Description** (required, 10-5000 characters with markdown support)
- **Price** (integer cents, 0 for free items, null for "contact for price")
- **Currency** (ISO 4217, default USD)
- **Pricing type** (fixed, negotiable, free, contact)
- **Condition** (new, like_new, good, fair, poor, for_parts)
- **Category** (references MK-002 category system)
- **Location** (approximate, neighborhood/city level only)
- **Listing type** (sell, trade, free, wanted)

#### User Flow

1. User taps "Create Listing" from the marketplace tab
2. Fills in title, description, price, condition
3. Selects a category (with subcategory drill-down)
4. Adds 1-10 photos (MK-003)
5. Sets location (auto-detected from device, displayed as neighborhood)
6. Previews listing
7. Publishes (listing enters `active` state)

#### Acceptance Criteria

- Listings validate all required fields before publishing
- Title and description support basic text formatting
- Price stored as integer cents to prevent floating-point issues
- Users can save drafts and return to editing later
- Each user can have up to 100 active listings
- Listing creation emits a `market_listing_posted` social activity (if user has social profile)

---

### MK-002: Category System

**Priority:** P0
**Category:** Core

#### Description

Hierarchical category system with parent categories and subcategories. Supports browsing by category and filtering search results. Categories are system-defined (not user-created) to maintain consistency.

#### Category Hierarchy

| Parent Category | Subcategories |
|----------------|---------------|
| Electronics | Phones, Computers, Tablets, Audio, Cameras, Gaming, Accessories |
| Furniture | Living Room, Bedroom, Office, Outdoor, Kitchen, Storage |
| Clothing | Men's, Women's, Kids, Shoes, Accessories, Activewear |
| Vehicles | Cars, Motorcycles, Bicycles, Parts, Accessories |
| Home & Garden | Tools, Appliances, Decor, Plants, Cleaning, Lighting |
| Sports & Outdoors | Fitness, Camping, Water Sports, Winter Sports, Team Sports |
| Books & Media | Books, Movies, Music, Games, Magazines |
| Baby & Kids | Toys, Clothing, Gear, Furniture, School Supplies |
| Collectibles | Vintage, Antiques, Art, Cards, Coins, Memorabilia |
| Services | Tutoring, Repairs, Cleaning, Moving, Pet Care |
| Free Stuff | Anything given away for free |
| Wanted | Items people are looking for |

#### Acceptance Criteria

- Categories stored in a self-referencing table (parent_id nullable)
- Each listing belongs to exactly one category (the most specific subcategory)
- Listings can be browsed by parent category (shows all subcategory listings)
- Category counts are denormalized for fast browsing
- System seeds categories on first migration; admin-only creation

---

### MK-003: Listing Photo Upload

**Priority:** P0
**Category:** Core

#### Description

Sellers upload 1-10 photos per listing. Photos are stored in Supabase Storage with CDN delivery. EXIF metadata is stripped server-side to protect privacy (removes GPS, device info, timestamps).

#### Technical Details

- Storage bucket: `market-photos` (Supabase Storage)
- Max photos per listing: 10
- Max file size per photo: 10 MB
- Accepted formats: JPEG, PNG, WebP, HEIC (auto-converted to WebP on upload)
- Thumbnail generation: 200x200 (grid), 600x600 (detail), original (full)
- EXIF stripping: server-side Edge Function strips all metadata before storage
- Photo ordering: user-defined sort order, first photo is the "cover" image

#### Acceptance Criteria

- Photos upload with progress indicator
- Users can reorder photos via drag-and-drop
- First photo automatically becomes the listing thumbnail
- EXIF data is verified stripped (no GPS, no device info in stored files)
- Failed uploads retry automatically (up to 3 attempts)
- Photos are deleted when the listing is deleted (cascade)

---

### MK-004: Listing Search and Discovery

**Priority:** P0
**Category:** Core

#### Description

Full-text search across listing titles and descriptions with category filtering, price range filtering, condition filtering, and sort options. Search is powered by PostgreSQL full-text search (tsvector/tsquery) for the MVP, with optional Meilisearch upgrade path.

#### Search Capabilities

- **Text search:** Matches against title and description (weighted: title 3x, description 1x)
- **Category filter:** Single category or parent category (includes subcategories)
- **Price range:** Min/max price filter
- **Condition filter:** Multi-select condition values
- **Location filter:** Radius from user's approximate location (MK-011)
- **Listing type filter:** Sell, trade, free, wanted
- **Sort options:** Newest, price low-high, price high-low, nearest

#### Acceptance Criteria

- Search returns results in under 500ms for up to 100K listings
- Empty search shows recent listings (discovery mode)
- Category browsing shows listing counts per subcategory
- Search results display: cover photo thumbnail, title, price, condition, location, time posted
- Results paginate at 20 items per page with infinite scroll

---

### MK-005: Listing Detail View

**Priority:** P0
**Category:** Core

#### Description

Full listing page showing all photos (swipeable gallery), description, seller profile summary, and action buttons (message seller, save to watchlist, make offer, share).

#### Layout

1. **Photo gallery** (swipeable, full-width, with dot indicators)
2. **Price and title** (large, prominent)
3. **Condition badge** and listing type badge
4. **Description** (expandable if long, markdown rendered)
5. **Category breadcrumb** (tappable)
6. **Location** (neighborhood name, distance from user)
7. **Posted time** (relative, e.g., "2 hours ago")
8. **Seller card** (avatar, name, rating, member since, response time)
9. **Action bar** (Message Seller, Make Offer, Save, Share)
10. **Similar listings** (same category, nearby)

#### Acceptance Criteria

- Photo gallery supports pinch-to-zoom
- Seller card links to full seller profile (MK-009)
- "Message Seller" opens a conversation thread tied to this listing (MK-006)
- "Save" toggles watchlist status (MK-008)
- Views are counted (but not displayed publicly to avoid vanity metrics)

---

### MK-006: Buyer-Seller Messaging

**Priority:** P0
**Category:** Core

#### Description

Private messaging between buyers and sellers, tied to specific listings. Conversations are visible only to the two participants. The target architecture is Signal-style end-to-end encrypted messaging with explicit message requests, per-device key bundles, and ciphertext-only delivery on the server. Attachments follow after encrypted attachment transport is in place.

#### Technical Design

- Message requests are tied to a listing + buyer pair before the seller accepts a full conversation
- Devices publish signed prekeys and one-time prekeys for asynchronous session bootstrap
- Secure message delivery stores ciphertext envelopes per sender device and recipient device
- Live delivery can still use Supabase Realtime or push wakeups, but the server must not require plaintext access
- Each conversation is tied to a listing + buyer profile pair
- Conversations persist after listing is sold/expired (for reference)
- No read receipts by default (privacy-first)
- Optional typing indicators stay out of scope until the encrypted transport is stable

#### Data Model

- **Conversation:** listing_id + buyer_profile_id + seller_profile_id (unique)
- **Message request:** conversation_id + requester_profile_id + responder_profile_id + status + optional trust link reference
- **Secure device:** user_id + identity_key + registration_id + capability flags
- **Signed prekey / one-time prekeys:** per-device asynchronous key material for session bootstrap
- **Secure message:** conversation_id + sender_device_id + recipient_device_id + ciphertext + delivery metadata
- Legacy plaintext rows may exist only as a temporary migration bridge and must not be the long-term production path for Signal-style claims

#### Acceptance Criteria

- Secure chat bootstraps without sharing phone numbers, using MyLife identity plus friend-link or share-link flows when needed
- Messages delivered in real-time via Supabase Realtime subscriptions or push-triggered sync after ciphertext storage
- Conversations are private: RLS enforces only participants can read/write
- Public key bundles are retrievable without exposing private content
- Seller sees all conversations for a listing in one view
- Buyer sees all their conversations across listings
- Push notification on new message (respects user notification preferences)
- Messages support basic safety: auto-detect and warn on phone number/email sharing (optional, user can dismiss)
- Product copy does not claim Signal-equivalent protection until safety-code verification, device-change handling, and attachment encryption ship

---

### MK-007: Listing Lifecycle

**Priority:** P0
**Category:** Core

#### Description

Listings move through defined states. Sellers control transitions. Expired listings can be relisted.

#### State Machine

```
draft -> active -> pending_sale -> sold
                -> expired
                -> removed (by user)
                -> flagged (by moderation)

expired -> active (relist)
draft -> deleted (discard)
```

- **draft:** Not visible to buyers. Saved for later editing.
- **active:** Visible in search and browse. The default after publishing.
- **pending_sale:** Seller has marked as "sale pending." Still visible but flagged. Reverts to active if sale falls through.
- **sold:** Final state. Listing hidden from search, visible on seller profile history.
- **expired:** Auto-transitions after 30 days of active status. Seller can relist (returns to active, resets timer).
- **removed:** User-initiated deletion. Listing hidden everywhere.
- **flagged:** Moderation has flagged the listing. Hidden from search until reviewed.

#### Acceptance Criteria

- State transitions validated server-side (invalid transitions rejected)
- Auto-expiration runs via Supabase scheduled function (daily)
- Sellers receive notification 3 days before expiration
- Relisting preserves all listing data (just resets expiration timer)
- Sold listings contribute to seller's "items sold" count (MK-009)

---

### MK-008: Watchlist / Saved Listings

**Priority:** P1
**Category:** Core

#### Description

Buyers can save listings to a personal watchlist. Watched listings trigger alerts on price changes (MK-013) and status changes.

#### Acceptance Criteria

- One-tap save/unsave from listing detail and search results
- Watchlist page shows all saved listings with status indicators (active, pending, sold, expired)
- Save count visible to seller in analytics (MK-020), not public
- When a watched listing's status changes, the watcher receives a notification
- Watchlist persists across sessions (stored in Supabase, tied to profile)

---

### MK-009: Seller Profiles and Reputation

**Priority:** P1
**Category:** Social

#### Description

Extends the existing social_profiles table with marketplace-specific seller data. Shows listing count, items sold, average rating, response time, and member tenure.

#### Seller Profile Fields (marketplace extension)

- **Total listings:** Count of all active + sold listings
- **Items sold:** Count of listings in `sold` state
- **Average rating:** Computed from buyer reviews (MK-010)
- **Response time:** Median time to first reply in conversations
- **Member since:** Social profile creation date
- **Verification badge:** Based on social profile completeness + rating threshold

#### Integration with Social Package

The seller profile is a view on top of `social_profiles`, extended with marketplace-computed fields stored in `mk_seller_stats`. No changes to the social_profiles table itself.

#### Acceptance Criteria

- Seller profile accessible from any listing by tapping the seller card
- Shows recent listings (active), sold history (public opt-in), and reviews
- Response time computed from messaging data (MK-006)
- Verification badge criteria: 5+ completed sales, 4.0+ average rating, social profile complete

---

### MK-010: Seller Ratings and Reviews

**Priority:** P1
**Category:** Social

#### Description

After a sale completes (listing marked as sold), the buyer can leave a rating and review for the seller. Ratings are 1-5 stars with optional text review. Sellers can respond to reviews (one response per review).

#### Rules

- Only buyers who had a conversation on the listing can leave a review
- One review per buyer per listing
- Reviews are visible publicly on the seller profile
- Sellers can respond once to each review
- Reviews cannot be edited after 48 hours
- Rating period: buyer has 14 days after listing marked sold to leave a review

#### Acceptance Criteria

- Average rating updates in real-time on seller profile
- Reviews display: stars, text, buyer handle, date, optional seller response
- Fraudulent review prevention: must have had an active conversation on the listing
- Sellers notified when they receive a review
- Aggregate rating stored in `mk_seller_stats` (denormalized)

---

### MK-011: Location-Based Filtering

**Priority:** P1
**Category:** Discovery

#### Description

Listings have an approximate location (neighborhood/city). Buyers can filter by distance from their current location or a manually set location. Location data uses PostGIS for spatial queries.

#### Privacy Safeguards

- Seller's exact location is never stored or displayed
- Location is stored as a geographic point snapped to neighborhood centroid
- Display shows neighborhood name and approximate distance (e.g., "Mission District, ~1.2 mi")
- Location precision: no more specific than a 0.5 mile radius area

#### Technical Details

- Uses PostGIS `geography` type for location storage and distance computation
- Location lookup uses reverse geocoding (neighborhood name from coordinates)
- Supabase RPC function for radius search: `mk_listings_within_radius(lat, lng, radius_miles)`
- Default search radius: 25 miles (user-configurable)

#### Acceptance Criteria

- Location filter available on search and browse
- Distance displayed on search results and listing detail
- Users can set a custom location (not just device GPS)
- Search radius adjustable: 1, 5, 10, 25, 50, 100 miles
- PostGIS spatial index ensures sub-second query performance

---

### MK-012: Saved Searches and Alerts

**Priority:** P1
**Category:** Discovery

#### Description

Users can save search queries (text + filters) and receive notifications when new matching listings are posted.

#### Acceptance Criteria

- Save current search with one tap from search results page
- Saved searches show match count (new since last checked)
- Notification on new matches (batched daily or real-time, user's choice)
- Up to 20 saved searches per user
- Saved searches page shows all saved queries with quick-run buttons

---

### MK-013: Price Drop Alerts

**Priority:** P1
**Category:** Discovery

#### Description

When a seller reduces the price on a listing, all watchers (MK-008) receive a notification with the old price, new price, and percentage drop.

#### Acceptance Criteria

- Price change tracked in `mk_listing_price_history`
- Notification sent to all watchers on price decrease (not increase)
- Price history visible on listing detail (shows original and all changes)
- Alert includes: listing title, old price, new price, percentage drop

---

### MK-014: Report and Block System

**Priority:** P0
**Category:** Safety

#### Description

Users can report listings (spam, prohibited items, scam, offensive content) and block other users. Blocked users cannot see the blocker's listings or send them messages.

#### Report Reasons

- Spam or duplicate listing
- Prohibited item (weapons, drugs, counterfeit, etc.)
- Scam or misleading listing
- Offensive or inappropriate content
- Wrong category
- Other (free text)

#### Acceptance Criteria

- Report dialog accessible from listing detail and seller profile
- Reports queued for moderation review (MK-015)
- Blocking is bidirectional: blocked user cannot see blocker's listings or message them
- Block list manageable from settings
- Multiple reports on a listing trigger auto-flagging (threshold: 3 unique reporters)

---

### MK-015: Content Moderation

**Priority:** P0
**Category:** Safety

#### Description

Automated and manual moderation pipeline. Listings are checked against prohibited item keywords on creation. Reported listings are queued for review.

#### Prohibited Categories

- Weapons and ammunition
- Drugs and drug paraphernalia
- Counterfeit goods
- Stolen property
- Living animals (direct; pet supplies are allowed)
- Adult content
- Recalled products
- Hazardous materials

#### Moderation Pipeline

1. **Pre-publish keyword scan:** Check title and description against prohibited keyword list
2. **Community reports:** Reports from users trigger review queue
3. **Auto-flag threshold:** 3+ reports from unique users auto-hides listing
4. **Manual review:** Moderator (or automated policy) approves, removes, or warns
5. **Repeat offender tracking:** Users with 3+ removed listings get a warning; 5+ get suspended

#### Acceptance Criteria

- Keyword filter catches common prohibited item terms (configurable list)
- Flagged listings hidden from search until reviewed
- Sellers notified when their listing is flagged (with reason)
- Appeal process: seller can dispute a flag (one appeal per listing)

---

### MK-016: Offer System

**Priority:** P1
**Category:** Core

#### Description

Buyers can make formal price offers on listings marked as "negotiable." Sellers can accept, counter, or decline. Accepted offers create a binding agreement for both parties.

#### Offer Flow

1. Buyer taps "Make Offer" on a negotiable listing
2. Enters offer amount
3. Seller receives offer notification
4. Seller accepts (listing goes to pending_sale), counters (new amount), or declines
5. Counter-offers bounce back to buyer for accept/decline
6. Maximum 5 rounds of counter-offers per conversation

#### Acceptance Criteria

- Offers only available on listings with pricing_type = 'negotiable'
- Offer amount must be > 0 and <= listing price
- Offer history visible in the conversation thread
- Accepted offer amount displayed on the listing (visible only to participants)
- Offers expire after 48 hours if not responded to

---

### MK-017: Free Stuff / Buy Nothing

**Priority:** P1
**Category:** Core

#### Description

Dedicated support for giving away items for free. Listings with price = 0 and listing_type = 'free' appear in a dedicated "Free Stuff" section with their own browse and search.

#### Acceptance Criteria

- "Free Stuff" quick-access button on marketplace home
- Free listings do not show price (show "FREE" badge instead)
- Free listings can still receive "interested" messages (via MK-006)
- Givers can select from interested parties (round-robin or first-come)

---

### MK-018: Trade/Barter Support

**Priority:** P2
**Category:** Core

#### Description

Listings can be marked as open to trade. Traders specify what they're looking for in exchange. Trade proposals work through the messaging system.

#### Acceptance Criteria

- Listing type "trade" with optional "looking for" text field
- Trade proposals sent as structured messages in conversations
- Both parties must confirm a trade for it to complete

---

### MK-021: Social Feed Integration

**Priority:** P1
**Category:** Social

#### Description

Marketplace events emit activities to the social feed system. This integrates with the existing `@mylife/social` ActivityEmitter.

#### New Activity Types

| Activity Type | Trigger | Example Title |
|--------------|---------|---------------|
| `market_listing_posted` | New listing published | "Listed MacBook Pro for sale" |
| `market_listing_sold` | Listing marked as sold | "Sold MacBook Pro" |
| `market_milestone` | Seller milestones | "Completed 10th sale on MyMarket" |

#### Social Integration Points

- Activities use `moduleId: 'market'`
- Share cards (MK-022) can be generated for listings
- Seller profiles link to social profiles (no duplication)
- Challenges can reference marketplace activity types (e.g., "List 5 items this month")
- Leaderboard scoring: `market_listing_sold` = 2 points (rewards completed transactions)

#### Acceptance Criteria

- Activity auto-posting respects user's module privacy settings
- Activities include listing photo as metadata (for card rendering)
- Social feed shows marketplace activities alongside other module activities

---

### MK-022: Share Cards

**Priority:** P2
**Category:** Social

#### Description

Shareable cards for listings (for iMessage, social media, etc.). Uses the existing ShareCard system from `@mylife/social`.

#### New Share Card Type: `listing`

- **Headline:** Listing title
- **Subtext:** Price + condition
- **Image:** Listing cover photo
- **Data:** `{ listingId, categoryName, sellerHandle }`

#### Acceptance Criteria

- Share card generated on demand from listing detail
- Card renders with MyMarket branding (accent color, icon)
- Links back to listing detail in MyLife app (deep link)

---

## 4. Data Architecture

### 4.1 Supabase Schema

#### Core Tables

```sql
-- ============================================================================
-- MyMarket -- Supabase migration for marketplace tables
--
-- All tables use mk_ prefix and Row-Level Security.
-- Integrates with social_profiles for seller identity.
-- ============================================================================

-- ── Categories ───────────────────────────────────────────────────────────

create table if not exists mk_categories (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references mk_categories(id) on delete cascade,
  name          text not null,
  slug          text not null,
  icon          text,
  sort_order    integer not null default 0,
  listing_count integer not null default 0,
  created_at    timestamptz not null default now(),

  constraint mk_categories_name_length check (char_length(name) between 1 and 60),
  constraint mk_categories_slug_unique unique (slug),
  constraint mk_categories_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create index mk_categories_parent_idx on mk_categories (parent_id);
create index mk_categories_slug_idx on mk_categories (slug);

alter table mk_categories enable row level security;

-- Categories are publicly readable
create policy "Categories are publicly readable"
  on mk_categories for select
  using (true);

-- Only service role can manage categories (system-seeded)
create policy "Service role manages categories"
  on mk_categories for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- ── Listings ─────────────────────────────────────────────────────────────

create type mk_listing_status as enum (
  'draft', 'active', 'pending_sale', 'sold', 'expired', 'removed', 'flagged'
);

create type mk_pricing_type as enum (
  'fixed', 'negotiable', 'free', 'contact'
);

create type mk_condition as enum (
  'new', 'like_new', 'good', 'fair', 'poor', 'for_parts'
);

create type mk_listing_type as enum (
  'sell', 'trade', 'free', 'wanted'
);

create table if not exists mk_listings (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references social_profiles(id) on delete cascade,
  category_id     uuid not null references mk_categories(id),
  title           text not null,
  description     text not null,
  price_cents     integer,
  currency        text not null default 'USD',
  pricing_type    mk_pricing_type not null default 'fixed',
  condition       mk_condition not null default 'good',
  listing_type    mk_listing_type not null default 'sell',
  status          mk_listing_status not null default 'draft',
  location        geography(point, 4326),
  location_name   text,
  view_count      integer not null default 0,
  save_count      integer not null default 0,
  message_count   integer not null default 0,
  trade_for       text,
  expires_at      timestamptz,
  sold_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint mk_listings_title_length check (char_length(title) between 3 and 120),
  constraint mk_listings_description_length check (char_length(description) between 10 and 5000),
  constraint mk_listings_price_nonneg check (price_cents is null or price_cents >= 0),
  constraint mk_listings_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint mk_listings_location_name_length check (location_name is null or char_length(location_name) <= 200),
  constraint mk_listings_trade_for_length check (trade_for is null or char_length(trade_for) <= 500)
);

-- Full-text search index on title and description
alter table mk_listings add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index mk_listings_search_idx on mk_listings using gin (search_vector);
create index mk_listings_seller_idx on mk_listings (seller_id);
create index mk_listings_category_idx on mk_listings (category_id);
create index mk_listings_status_idx on mk_listings (status);
create index mk_listings_created_idx on mk_listings (created_at desc);
create index mk_listings_price_idx on mk_listings (price_cents);
create index mk_listings_location_idx on mk_listings using gist (location);
create index mk_listings_expires_idx on mk_listings (expires_at) where status = 'active';
create index mk_listings_type_idx on mk_listings (listing_type);

alter table mk_listings enable row level security;

-- Active listings are visible to all authenticated users
create policy "Active listings visible to authenticated users"
  on mk_listings for select
  using (
    status = 'active'
    or status = 'pending_sale'
    or seller_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Sellers manage their own listings
create policy "Sellers manage own listings"
  on mk_listings for insert
  with check (
    seller_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Sellers update own listings"
  on mk_listings for update
  using (
    seller_id in (select id from social_profiles where user_id = auth.uid())
  )
  with check (
    seller_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Sellers delete own listings"
  on mk_listings for delete
  using (
    seller_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Listing Photos ───────────────────────────────────────────────────────

create table if not exists mk_listing_photos (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references mk_listings(id) on delete cascade,
  url         text not null,
  thumb_url   text,
  sort_order  integer not null default 0,
  width       integer,
  height      integer,
  created_at  timestamptz not null default now()
);

create index mk_listing_photos_listing_idx on mk_listing_photos (listing_id);

alter table mk_listing_photos enable row level security;

-- Photos readable if listing is readable
create policy "Photos visible with listing"
  on mk_listing_photos for select
  using (
    listing_id in (
      select id from mk_listings
      where status in ('active', 'pending_sale')
      or seller_id in (select id from social_profiles where user_id = auth.uid())
    )
  );

-- Sellers manage own listing photos
create policy "Sellers manage own photos"
  on mk_listing_photos for all
  using (
    listing_id in (
      select id from mk_listings
      where seller_id in (select id from social_profiles where user_id = auth.uid())
    )
  )
  with check (
    listing_id in (
      select id from mk_listings
      where seller_id in (select id from social_profiles where user_id = auth.uid())
    )
  );


-- ── Conversations ────────────────────────────────────────────────────────

create table if not exists mk_conversations (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references mk_listings(id) on delete cascade,
  buyer_profile_id  uuid not null references social_profiles(id) on delete cascade,
  seller_profile_id uuid not null references social_profiles(id) on delete cascade,
  last_message_at   timestamptz,
  buyer_unread      integer not null default 0,
  seller_unread     integer not null default 0,
  created_at        timestamptz not null default now(),

  constraint mk_conversations_unique unique (listing_id, buyer_profile_id),
  constraint mk_conversations_not_self check (buyer_profile_id != seller_profile_id)
);

create index mk_conversations_listing_idx on mk_conversations (listing_id);
create index mk_conversations_buyer_idx on mk_conversations (buyer_profile_id);
create index mk_conversations_seller_idx on mk_conversations (seller_profile_id);

alter table mk_conversations enable row level security;

-- Only participants can see their conversations
create policy "Participants see own conversations"
  on mk_conversations for select
  using (
    buyer_profile_id in (select id from social_profiles where user_id = auth.uid())
    or seller_profile_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Buyers can initiate conversations
create policy "Buyers create conversations"
  on mk_conversations for insert
  with check (
    buyer_profile_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Participants can update (mark read, etc.)
create policy "Participants update conversations"
  on mk_conversations for update
  using (
    buyer_profile_id in (select id from social_profiles where user_id = auth.uid())
    or seller_profile_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Messages ─────────────────────────────────────────────────────────────

create table if not exists mk_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references mk_conversations(id) on delete cascade,
  sender_profile_id uuid not null references social_profiles(id) on delete cascade,
  body              text not null,
  photo_url         text,
  is_offer          boolean not null default false,
  offer_cents       integer,
  created_at        timestamptz not null default now(),

  constraint mk_messages_body_length check (char_length(body) between 1 and 2000),
  constraint mk_messages_offer_valid check (
    (is_offer = false) or (is_offer = true and offer_cents is not null and offer_cents > 0)
  )
);

create index mk_messages_conversation_idx on mk_messages (conversation_id);
create index mk_messages_created_idx on mk_messages (created_at desc);

alter table mk_messages enable row level security;

-- Messages visible only to conversation participants
create policy "Messages visible to participants"
  on mk_messages for select
  using (
    conversation_id in (
      select id from mk_conversations
      where buyer_profile_id in (select id from social_profiles where user_id = auth.uid())
      or seller_profile_id in (select id from social_profiles where user_id = auth.uid())
    )
  );

-- Participants can send messages
create policy "Participants send messages"
  on mk_messages for insert
  with check (
    sender_profile_id in (select id from social_profiles where user_id = auth.uid())
    and conversation_id in (
      select id from mk_conversations
      where buyer_profile_id in (select id from social_profiles where user_id = auth.uid())
      or seller_profile_id in (select id from social_profiles where user_id = auth.uid())
    )
  );


-- ── Watchlist ────────────────────────────────────────────────────────────

create table if not exists mk_watchlist (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references social_profiles(id) on delete cascade,
  listing_id  uuid not null references mk_listings(id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint mk_watchlist_unique unique (profile_id, listing_id)
);

create index mk_watchlist_profile_idx on mk_watchlist (profile_id);
create index mk_watchlist_listing_idx on mk_watchlist (listing_id);

alter table mk_watchlist enable row level security;

-- Users see only their own watchlist
create policy "Users see own watchlist"
  on mk_watchlist for select
  using (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Users manage own watchlist
create policy "Users manage own watchlist"
  on mk_watchlist for all
  using (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  )
  with check (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Seller Ratings/Reviews ───────────────────────────────────────────────

create table if not exists mk_reviews (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references mk_listings(id) on delete cascade,
  reviewer_id       uuid not null references social_profiles(id) on delete cascade,
  seller_id         uuid not null references social_profiles(id) on delete cascade,
  rating            integer not null check (rating between 1 and 5),
  body              text,
  seller_response   text,
  responded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint mk_reviews_unique unique (listing_id, reviewer_id),
  constraint mk_reviews_body_length check (body is null or char_length(body) <= 1000),
  constraint mk_reviews_response_length check (seller_response is null or char_length(seller_response) <= 1000),
  constraint mk_reviews_not_self check (reviewer_id != seller_id)
);

create index mk_reviews_seller_idx on mk_reviews (seller_id);
create index mk_reviews_reviewer_idx on mk_reviews (reviewer_id);
create index mk_reviews_listing_idx on mk_reviews (listing_id);

alter table mk_reviews enable row level security;

-- Reviews are publicly readable
create policy "Reviews are publicly readable"
  on mk_reviews for select
  using (true);

-- Reviewers create reviews
create policy "Reviewers create reviews"
  on mk_reviews for insert
  with check (
    reviewer_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Reviewers can update their review (within 48 hours)
create policy "Reviewers update own reviews"
  on mk_reviews for update
  using (
    reviewer_id in (select id from social_profiles where user_id = auth.uid())
    or seller_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Seller Stats (denormalized) ──────────────────────────────────────────

create table if not exists mk_seller_stats (
  profile_id          uuid primary key references social_profiles(id) on delete cascade,
  total_listings      integer not null default 0,
  active_listings     integer not null default 0,
  items_sold          integer not null default 0,
  total_reviews       integer not null default 0,
  average_rating      numeric(3, 2) not null default 0,
  median_response_sec integer,
  updated_at          timestamptz not null default now()
);

alter table mk_seller_stats enable row level security;

-- Seller stats publicly readable
create policy "Seller stats publicly readable"
  on mk_seller_stats for select
  using (true);

-- Only triggers/functions update seller stats
create policy "Service role manages seller stats"
  on mk_seller_stats for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');


-- ── Price History ────────────────────────────────────────────────────────

create table if not exists mk_listing_price_history (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references mk_listings(id) on delete cascade,
  old_cents   integer not null,
  new_cents   integer not null,
  changed_at  timestamptz not null default now()
);

create index mk_price_history_listing_idx on mk_listing_price_history (listing_id);

alter table mk_listing_price_history enable row level security;

-- Price history readable if listing is readable
create policy "Price history visible with listing"
  on mk_listing_price_history for select
  using (
    listing_id in (
      select id from mk_listings
      where status in ('active', 'pending_sale', 'sold')
      or seller_id in (select id from social_profiles where user_id = auth.uid())
    )
  );


-- ── Saved Searches ───────────────────────────────────────────────────────

create table if not exists mk_saved_searches (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references social_profiles(id) on delete cascade,
  label       text not null,
  query_text  text,
  filters     jsonb not null default '{}'::jsonb,
  notify      boolean not null default true,
  last_run_at timestamptz,
  new_count   integer not null default 0,
  created_at  timestamptz not null default now(),

  constraint mk_saved_searches_label_length check (char_length(label) between 1 and 100)
);

create index mk_saved_searches_profile_idx on mk_saved_searches (profile_id);

alter table mk_saved_searches enable row level security;

-- Users see only their own saved searches
create policy "Users see own saved searches"
  on mk_saved_searches for select
  using (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  );

create policy "Users manage own saved searches"
  on mk_saved_searches for all
  using (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  )
  with check (
    profile_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Reports (Moderation) ────────────────────────────────────────────────

create type mk_report_reason as enum (
  'spam', 'prohibited_item', 'scam', 'offensive', 'wrong_category', 'other'
);

create type mk_report_status as enum (
  'pending', 'reviewed', 'actioned', 'dismissed'
);

create table if not exists mk_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references social_profiles(id) on delete cascade,
  listing_id   uuid not null references mk_listings(id) on delete cascade,
  reason       mk_report_reason not null,
  details      text,
  status       mk_report_status not null default 'pending',
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),

  constraint mk_reports_unique unique (reporter_id, listing_id),
  constraint mk_reports_details_length check (details is null or char_length(details) <= 1000)
);

create index mk_reports_listing_idx on mk_reports (listing_id);
create index mk_reports_status_idx on mk_reports (status);

alter table mk_reports enable row level security;

-- Reporters see their own reports
create policy "Reporters see own reports"
  on mk_reports for select
  using (
    reporter_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Users can create reports
create policy "Users create reports"
  on mk_reports for insert
  with check (
    reporter_id in (select id from social_profiles where user_id = auth.uid())
  );


-- ── Blocks ───────────────────────────────────────────────────────────────

create table if not exists mk_blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references social_profiles(id) on delete cascade,
  blocked_id  uuid not null references social_profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint mk_blocks_unique unique (blocker_id, blocked_id),
  constraint mk_blocks_not_self check (blocker_id != blocked_id)
);

create index mk_blocks_blocker_idx on mk_blocks (blocker_id);
create index mk_blocks_blocked_idx on mk_blocks (blocked_id);

alter table mk_blocks enable row level security;

-- Users see their own blocks
create policy "Users see own blocks"
  on mk_blocks for select
  using (
    blocker_id in (select id from social_profiles where user_id = auth.uid())
  );

-- Users manage own blocks
create policy "Users manage own blocks"
  on mk_blocks for all
  using (
    blocker_id in (select id from social_profiles where user_id = auth.uid())
  )
  with check (
    blocker_id in (select id from social_profiles where user_id = auth.uid())
  );
```

### 4.2 Database Triggers

```sql
-- ── Auto-update listing category counts ──────────────────────────────────

create or replace function mk_update_category_listing_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' and NEW.status = 'active' then
    update mk_categories set listing_count = listing_count + 1 where id = NEW.category_id;
  elsif TG_OP = 'UPDATE' then
    if OLD.status != 'active' and NEW.status = 'active' then
      update mk_categories set listing_count = listing_count + 1 where id = NEW.category_id;
    elsif OLD.status = 'active' and NEW.status != 'active' then
      update mk_categories set listing_count = greatest(0, listing_count - 1) where id = OLD.category_id;
    end if;
  elsif TG_OP = 'DELETE' and OLD.status = 'active' then
    update mk_categories set listing_count = greatest(0, listing_count - 1) where id = OLD.category_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger mk_category_count_trigger
  after insert or update or delete on mk_listings
  for each row execute function mk_update_category_listing_count();


-- ── Auto-track price changes ─────────────────────────────────────────────

create or replace function mk_track_price_change()
returns trigger as $$
begin
  if OLD.price_cents is distinct from NEW.price_cents
    and OLD.price_cents is not null
    and NEW.price_cents is not null then
    insert into mk_listing_price_history (listing_id, old_cents, new_cents)
    values (NEW.id, OLD.price_cents, NEW.price_cents);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger mk_price_change_trigger
  before update on mk_listings
  for each row execute function mk_track_price_change();


-- ── Auto-update seller stats on listing status change ────────────────────

create or replace function mk_update_seller_stats()
returns trigger as $$
begin
  -- Ensure seller_stats row exists
  insert into mk_seller_stats (profile_id)
  values (coalesce(NEW.seller_id, OLD.seller_id))
  on conflict (profile_id) do nothing;

  -- Recompute counts
  update mk_seller_stats set
    total_listings = (
      select count(*) from mk_listings
      where seller_id = coalesce(NEW.seller_id, OLD.seller_id)
      and status != 'draft' and status != 'removed'
    ),
    active_listings = (
      select count(*) from mk_listings
      where seller_id = coalesce(NEW.seller_id, OLD.seller_id)
      and status = 'active'
    ),
    items_sold = (
      select count(*) from mk_listings
      where seller_id = coalesce(NEW.seller_id, OLD.seller_id)
      and status = 'sold'
    ),
    updated_at = now()
  where profile_id = coalesce(NEW.seller_id, OLD.seller_id);

  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger mk_seller_stats_trigger
  after insert or update or delete on mk_listings
  for each row execute function mk_update_seller_stats();


-- ── Auto-update seller review stats ──────────────────────────────────────

create or replace function mk_update_review_stats()
returns trigger as $$
begin
  update mk_seller_stats set
    total_reviews = (
      select count(*) from mk_reviews
      where seller_id = coalesce(NEW.seller_id, OLD.seller_id)
    ),
    average_rating = (
      select coalesce(avg(rating), 0) from mk_reviews
      where seller_id = coalesce(NEW.seller_id, OLD.seller_id)
    ),
    updated_at = now()
  where profile_id = coalesce(NEW.seller_id, OLD.seller_id);

  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger mk_review_stats_trigger
  after insert or update or delete on mk_reviews
  for each row execute function mk_update_review_stats();


-- ── Auto-update watchlist save_count on listings ─────────────────────────

create or replace function mk_update_save_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update mk_listings set save_count = save_count + 1 where id = NEW.listing_id;
  elsif TG_OP = 'DELETE' then
    update mk_listings set save_count = greatest(0, save_count - 1) where id = OLD.listing_id;
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

create trigger mk_save_count_trigger
  after insert or delete on mk_watchlist
  for each row execute function mk_update_save_count();


-- ── Auto-update conversation message count ───────────────────────────────

create or replace function mk_update_message_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update mk_conversations set last_message_at = NEW.created_at where id = NEW.conversation_id;
    -- Increment unread for the non-sender
    update mk_conversations set
      buyer_unread = case
        when NEW.sender_profile_id != buyer_profile_id then buyer_unread + 1
        else buyer_unread
      end,
      seller_unread = case
        when NEW.sender_profile_id != seller_profile_id then seller_unread + 1
        else seller_unread
      end
    where id = NEW.conversation_id;
    -- Increment message count on listing
    update mk_listings set message_count = message_count + 1
    where id = (select listing_id from mk_conversations where id = NEW.conversation_id);
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger mk_message_count_trigger
  after insert on mk_messages
  for each row execute function mk_update_message_count();


-- ── Auto-update updated_at timestamps ────────────────────────────────────

create trigger mk_listings_updated_at
  before update on mk_listings
  for each row execute function update_updated_at();

create trigger mk_reviews_updated_at
  before update on mk_reviews
  for each row execute function update_updated_at();


-- ── Listing expiration (scheduled function) ──────────────────────────────
-- Run via Supabase pg_cron or Edge Function on a daily schedule

create or replace function mk_expire_stale_listings()
returns integer as $$
declare
  expired_count integer;
begin
  update mk_listings
  set status = 'expired', updated_at = now()
  where status = 'active'
  and expires_at is not null
  and expires_at < now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$ language plpgsql security definer;


-- ── Auto-flag listings with multiple reports ─────────────────────────────

create or replace function mk_auto_flag_reported_listing()
returns trigger as $$
declare
  report_count integer;
begin
  select count(distinct reporter_id) into report_count
  from mk_reports
  where listing_id = NEW.listing_id and status = 'pending';

  if report_count >= 3 then
    update mk_listings set status = 'flagged', updated_at = now()
    where id = NEW.listing_id and status = 'active';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger mk_auto_flag_trigger
  after insert on mk_reports
  for each row execute function mk_auto_flag_reported_listing();
```

### 4.3 RPC Functions

```sql
-- ── Radius search for listings ───────────────────────────────────────────

create or replace function mk_listings_within_radius(
  lat double precision,
  lng double precision,
  radius_miles double precision default 25,
  result_limit integer default 20,
  result_offset integer default 0
)
returns setof mk_listings as $$
begin
  return query
    select l.*
    from mk_listings l
    where l.status = 'active'
    and l.location is not null
    and ST_DWithin(
      l.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_miles * 1609.34  -- convert miles to meters
    )
    order by l.location <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    limit result_limit
    offset result_offset;
end;
$$ language plpgsql security definer;


-- ── Full-text search with filters ────────────────────────────────────────

create or replace function mk_search_listings(
  search_query text default null,
  category_slug text default null,
  min_price integer default null,
  max_price integer default null,
  conditions mk_condition[] default null,
  listing_types mk_listing_type[] default null,
  sort_by text default 'newest',
  result_limit integer default 20,
  result_offset integer default 0
)
returns setof mk_listings as $$
begin
  return query
    select l.*
    from mk_listings l
    left join mk_categories c on l.category_id = c.id
    left join mk_categories cp on c.parent_id = cp.id
    where l.status = 'active'
    and (search_query is null or l.search_vector @@ plainto_tsquery('english', search_query))
    and (category_slug is null or c.slug = category_slug or cp.slug = category_slug)
    and (min_price is null or l.price_cents >= min_price)
    and (max_price is null or l.price_cents <= max_price)
    and (conditions is null or l.condition = any(conditions))
    and (listing_types is null or l.listing_type = any(listing_types))
    order by
      case when sort_by = 'newest' then l.created_at end desc,
      case when sort_by = 'price_asc' then l.price_cents end asc,
      case when sort_by = 'price_desc' then l.price_cents end desc,
      case when sort_by = 'relevance' and search_query is not null
        then ts_rank(l.search_vector, plainto_tsquery('english', search_query)) end desc,
      l.created_at desc
    limit result_limit
    offset result_offset;
end;
$$ language plpgsql security definer;
```

### 4.4 Supabase Storage Buckets

| Bucket | Access | Purpose |
|--------|--------|---------|
| `market-photos` | Authenticated upload, public read | Listing photos (WebP, max 10MB) |

Storage policies:
- Upload: authenticated users can upload to `market-photos/{listing_id}/`
- Read: public (photos are accessible via CDN URL)
- Delete: only the listing owner can delete photos

### 4.5 Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `mk-strip-exif` | Storage upload webhook | Strip EXIF metadata from uploaded photos |
| `mk-generate-thumbnails` | Storage upload webhook | Generate 200x200 and 600x600 thumbnails |
| `mk-expire-listings` | pg_cron daily | Expire listings past their expires_at date |
| `mk-notify-watchers` | Database webhook on mk_listing_price_history insert | Send price drop notifications to watchers |
| `mk-notify-expiring` | pg_cron daily | Warn sellers 3 days before listing expiration |

### 4.6 Table Summary

| Table | Description | Row Estimate (at scale) |
|-------|-------------|------------------------|
| `mk_categories` | Hierarchical category tree | ~100 (seeded) |
| `mk_listings` | Core listings with FTS and PostGIS | 10K-1M |
| `mk_listing_photos` | Photos per listing (1-10 each) | 50K-5M |
| `mk_conversations` | Buyer-seller conversation threads | 5K-500K |
| `mk_messages` | Individual messages in conversations | 50K-5M |
| `mk_watchlist` | Saved listings per user | 10K-500K |
| `mk_reviews` | Seller reviews from buyers | 1K-100K |
| `mk_seller_stats` | Denormalized seller reputation data | 1K-100K |
| `mk_listing_price_history` | Price change audit trail | 5K-200K |
| `mk_saved_searches` | Saved search queries per user | 1K-50K |
| `mk_reports` | Content moderation reports | 100-10K |
| `mk_blocks` | User block relationships | 100-10K |

---

## 5. Module Definition

```typescript
import type { ModuleDefinition } from '@mylife/module-registry';

export const MARKET_MODULE: ModuleDefinition = {
  id: 'market',
  name: 'MyMarket',
  tagline: 'Buy, sell, and trade with your community',
  icon: '\u{1F3EA}', // 🏪
  accentColor: '#14B8A6',
  tier: 'premium',
  storageType: 'supabase',
  schemaVersion: 1,
  tablePrefix: 'mk_',
  navigation: {
    tabs: [
      { key: 'browse', label: 'Browse', icon: 'search' },
      { key: 'sell', label: 'Sell', icon: 'plus-circle' },
      { key: 'messages', label: 'Messages', icon: 'message-circle' },
      { key: 'watchlist', label: 'Saved', icon: 'heart' },
      { key: 'profile', label: 'Profile', icon: 'user' },
    ],
    screens: [
      { name: 'listing-detail', title: 'Listing' },
      { name: 'listing-create', title: 'Create Listing' },
      { name: 'listing-edit', title: 'Edit Listing' },
      { name: 'conversation', title: 'Messages' },
      { name: 'seller-profile', title: 'Seller Profile' },
      { name: 'category-browse', title: 'Category' },
      { name: 'search-results', title: 'Search Results' },
      { name: 'saved-searches', title: 'Saved Searches' },
      { name: 'my-listings', title: 'My Listings' },
      { name: 'settings', title: 'Settings' },
    ],
  },
  requiresAuth: true,
  requiresNetwork: true,
  version: '0.1.0',
};
```

---

## 6. Social Package Integration

### 6.1 New Activity Types

The following activity types need to be added to `ActivityTypeSchema` in `packages/social/src/types.ts`:

```typescript
// Market
'market_listing_posted',
'market_listing_sold',
'market_milestone',
```

### 6.2 New Share Card Type

Add `'listing'` to `ShareCardTypeSchema`:

```typescript
export const ShareCardTypeSchema = z.enum([
  'activity',
  'challenge_complete',
  'streak',
  'year_in_review',
  'profile',
  'listing',  // new: marketplace listing share cards
]);
```

### 6.3 Social Capable Modules

Add `'market'` to `SOCIAL_CAPABLE_MODULES`:

```typescript
export const SOCIAL_CAPABLE_MODULES: readonly ModuleId[] = [
  'books', 'budget', 'fast', 'habits', 'health',
  'market',  // new
  'meds', 'recipes', 'surf', 'words', 'workouts',
] as const;
```

### 6.4 Integration with Existing Social Features

| Social Feature | MyMarket Integration |
|---------------|---------------------|
| Profiles | Seller profiles are a view on social_profiles + mk_seller_stats |
| Activity Feed | Listing posted/sold activities appear in followers' feeds |
| Challenges | Can create marketplace challenges ("List 5 items this month") |
| Groups | Group-scoped marketplaces possible (future: buy/sell within a group) |
| Leaderboards | market_listing_sold earns 2 points per occurrence |
| Share Cards | Listing share cards with photo, price, condition |
| Kudos | Users can react to marketplace activities in the feed |
| Comments | Users can comment on marketplace activities |

### 6.5 Privacy Model Extensions

- Marketplace activity auto-posting respects the existing `ModulePrivacySetting` system
- Seller profile visibility is independent of social profile discoverability
- Listing location is separate from profile location (users can list items in different neighborhoods)
- Block list is marketplace-specific (mk_blocks) but could integrate with a global block list in the future

---

## 7. Implementation Phases

### Phase 1: Core Marketplace (MVP)

**Scope:** MK-001 through MK-007 + MK-014 + MK-015

- Listing CRUD with photos
- Category system (seeded)
- Full-text search and category browsing
- Listing detail view
- Buyer-seller messaging (Supabase Realtime)
- Listing lifecycle state machine
- Report and block system
- Basic content moderation (keyword filter)

**Estimated Tables:** mk_categories, mk_listings, mk_listing_photos, mk_conversations, mk_messages, mk_reports, mk_blocks

### Phase 2: Discovery and Social

**Scope:** MK-008 through MK-013 + MK-016 + MK-017 + MK-021

- Watchlist
- Seller profiles and reputation
- Seller ratings and reviews
- Location-based filtering (PostGIS)
- Saved searches and alerts
- Price drop alerts
- Offer system
- Free stuff section
- Social feed integration

**Additional Tables:** mk_watchlist, mk_reviews, mk_seller_stats, mk_listing_price_history, mk_saved_searches

### Phase 3: Advanced Features

**Scope:** MK-018 through MK-025

- Trade/barter support
- Price suggestion engine
- Listing analytics for sellers
- Share cards
- Seasonal/trending categories
- Bulk listing import
- Data export

---

## 8. Non-Functional Requirements

### Performance

- Search results: < 500ms for up to 100K listings
- Listing detail load: < 300ms
- Photo upload: progress indicator, < 5s per photo on broadband
- Message delivery: < 1s via Supabase Realtime
- Category browse: < 200ms (denormalized counts)

### Scalability

- PostGIS spatial index for location queries
- GIN index for full-text search
- Denormalized counts (save_count, message_count, listing_count) to avoid expensive aggregations
- Pagination on all list endpoints (20 items default)

### Security

- All tables use RLS (no unauthenticated access to user data)
- EXIF stripping on all photo uploads
- Rate limiting on listing creation (max 10 per hour)
- Rate limiting on messages (max 100 per hour per user)
- Prohibited keyword scan on listing creation
- Auto-flag on 3+ community reports

### Accessibility

- All images require alt text (generated from listing title if not provided)
- Price displayed with currency symbol and proper formatting
- Color contrast meets WCAG 2.1 AA standards
- Screen reader support for listing cards and detail views

---

## 9. Module ID Registration

The `market` module ID needs to be added to:

1. **`packages/module-registry/src/types.ts`** - Add `'market'` to `ModuleId` union and `ModuleIdSchema`
2. **`packages/social/src/types.ts`** - Add market activity types, add to SOCIAL_CAPABLE_MODULES
3. **`modules/market/src/definition.ts`** - Export `MARKET_MODULE`
4. **`modules/market/src/index.ts`** - Barrel export
5. **`apps/mobile/`** - Register module and add navigation routes
6. **`apps/web/`** - Register module and add page routes

---

## 10. Open Questions

1. **Payment integration:** Should MyMarket support in-app payments (Stripe Connect) or stay cash/external-only for MVP? Recommendation: external-only for MVP to avoid payment processing complexity and compliance overhead.

2. **Shipping support:** Should listings support shipping labels/tracking, or local pickup only? Recommendation: local pickup only for MVP. Shipping adds significant complexity (label generation, tracking, buyer protection).

3. **Listing boost / featured listings:** The privacy-first philosophy says no paid promotion. Should there be any way for sellers to increase listing visibility? Recommendation: no. Equal visibility for all listings, sorted by recency and relevance.

4. **Cross-module integration:** Should selling a book from MyBooks auto-create a marketplace listing? Recommendation: yes, as a future Phase 3 feature. "Sell this book" button on MyBooks library items.

5. **Group marketplaces:** Should social groups have their own marketplace scope? Recommendation: yes, as a future feature. Group members can post listings visible only within the group.
