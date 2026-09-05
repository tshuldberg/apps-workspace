# Feature Spec: Market Cloud Client Functions

## Metadata
- **Module:** market
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 5 x3 + Complexity 2 x2 + CrossModule 0 x1 + PaidUser 0 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** modules/market/src/cloud/client.ts (exists with 21 functions), Supabase cloud schema (exists at src/cloud/schema.sql)
- **Blocks:** UI screens (market), Payment integration, Delivery tracking, Service discovery

## Business Context

### Why This Feature Exists
The cloud client already has 21 query functions, but several critical marketplace operations are missing: listing photo management (upload/delete/reorder), offer system operations, price history tracking, content moderation actions, bulk operations for sellers, and notification triggers. Without these, the UI screens cannot implement full marketplace functionality. This spec covers the remaining cloud client functions needed to support all Market features.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Facebook Marketplace | Yes | No | Full CRUD via Graph API, photo hosting via FB CDN, real-time via Messenger platform |
| OfferUp | Yes | No | REST API, dedicated photo service, offer negotiation endpoints |
| Mercari | Yes | No | REST + WebSocket, Stripe-integrated, shipping label generation |
| Craigslist | Partial | No | Minimal API, mostly server-rendered, basic photo upload |

### Target User
Developers (agents) building Market UI screens and features. These functions are the data layer that powers all user-facing interactions.

## Technical Context

### Where This Lives in MyLife

```
modules/market/src/cloud/
  client.ts                -- Extend with new functions (21 existing + ~12 new)
  schema.sql               -- Add new cloud tables/RPCs as needed
modules/market/src/
  types.ts                 -- Add new schemas for offers, price history, moderation
  db/crud.ts               -- Add cache functions for new data types
```

### Wireframe Position

```
Hub Dashboard
  └── MyMarket card
       └── [All tabs] -- Cloud functions power every tab
            └── Cloud Client Layer ← YOU ARE HERE
```

### Data Model

New Supabase tables and types needed:

```sql
-- Offer system
CREATE TABLE IF NOT EXISTS mk_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'expired', 'withdrawn')),
  counter_amount_cents INTEGER,
  message TEXT CHECK (char_length(message) <= 500),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Price history for price drop alerts
CREATE TABLE IF NOT EXISTS mk_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES mk_listings(id) ON DELETE CASCADE,
  old_price_cents INTEGER,
  new_price_cents INTEGER,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Moderation queue
CREATE TABLE IF NOT EXISTS mk_moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES mk_listings(id),
  user_id UUID REFERENCES auth.users(id),
  report_id UUID REFERENCES mk_reports(id),
  action TEXT NOT NULL CHECK (action IN ('review', 'warn', 'remove', 'ban', 'dismiss')),
  reason TEXT,
  moderator_id UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

New Zod schemas:

```typescript
// In types.ts
export const OfferStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'countered', 'expired', 'withdrawn']);
export const OfferSchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: OfferStatusSchema,
  counterAmountCents: z.number().int().positive().nullable(),
  message: z.string().max(500).nullable(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PriceHistorySchema = z.object({
  id: z.string().uuid(),
  listingId: z.string().uuid(),
  oldPriceCents: z.number().int().nonnegative().nullable(),
  newPriceCents: z.number().int().nonnegative().nullable(),
  changedAt: z.string().datetime(),
});
```

### Dependencies
- **Internal:** `@mylife/market` (existing client.ts, types.ts), `@mylife/db` (DatabaseAdapter)
- **External:** Supabase Storage SDK (for photo upload), Supabase Realtime (for live updates)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a seller, I want to upload photos to my listing so buyers can see what I'm selling.
2. As a buyer, I want to make an offer on a listing so I can negotiate the price.
3. As a seller, I want to accept, reject, or counter offers so I can manage negotiations.
4. As a buyer, I want to see price history on a listing so I know if the price has dropped.
5. As a user, I want to report listings/users so the platform stays safe.

### Behavior Specification

**New cloud client functions to implement:**

1. `cloudUploadListingPhoto(supabase, listingId, file, sortOrder)` -- Upload photo to Supabase Storage, strip EXIF, create mk_listing_photos row
2. `cloudDeleteListingPhoto(supabase, photoId)` -- Delete photo from Storage and database
3. `cloudReorderListingPhotos(supabase, listingId, photoIds)` -- Update sort_order for photos
4. `cloudMakeOffer(supabase, listingId, amountCents, message?)` -- Create offer record
5. `cloudRespondToOffer(supabase, offerId, action, counterAmount?)` -- Accept/reject/counter
6. `cloudGetOffersForListing(supabase, listingId)` -- Get all offers for a listing (seller view)
7. `cloudGetMyOffers(supabase)` -- Get all offers made by the current user (buyer view)
8. `cloudUpdateListingPrice(supabase, listingId, newPriceCents)` -- Update price and log to price history
9. `cloudGetPriceHistory(supabase, listingId)` -- Get price change history
10. `cloudReportListing(supabase, listingId, reason, details?)` -- File a report
11. `cloudReportUser(supabase, userId, reason, details?)` -- Report a user
12. `cloudBlockUser(supabase, userId)` -- Block a user (hides their content)
13. `cloudUnblockUser(supabase, userId)` -- Unblock a user

All functions follow the existing `Result<T>` pattern: `{ ok: true; data: T } | { ok: false; error: string }`.

### Edge Cases
- Photo upload with invalid format: reject before uploading, return error
- Photo upload exceeding 10 per listing: reject with descriptive error
- Offer on own listing: reject with error
- Offer on sold/expired listing: reject with error
- Counter-offer exceeding original listing price: allow (seller might price higher)
- Concurrent offers: all stored, seller responds individually
- Block self: reject with error
- Report own listing: reject with error
- Price update to same price: no-op, don't create price history entry

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Photo upload returns a URL usable in listing detail view
- [ ] **AC-2:** Making an offer creates a pending offer visible to both buyer and seller
- [ ] **AC-3:** Accepting an offer transitions listing to pending_sale status
- [ ] **AC-4:** Price history records every price change with timestamps
- [ ] **AC-5:** Blocking a user immediately hides their content from the blocker
- [ ] **AC-6:** Reports create moderation queue entries for review

### Technical Criteria
- [ ] **TC-1:** All new functions return `Result<T>` matching existing pattern
- [ ] **TC-2:** Photo upload strips EXIF metadata before storage
- [ ] **TC-3:** All new Supabase tables have appropriate RLS policies (buyers see own offers, sellers see offers on their listings)
- [ ] **TC-4:** Offer expiration handled via Supabase scheduled function (48-hour TTL)
- [ ] **TC-5:** Photo storage uses `market-photos/{listingId}/{photoId}.webp` path convention
- [ ] **TC-6:** All functions validate input with Zod schemas before Supabase calls
- [ ] **TC-7:** New types exported from index.ts barrel export

### Negative Criteria
- [ ] **NC-1:** Must NOT allow unauthenticated users to call write functions
- [ ] **NC-2:** Must NOT store original photos with EXIF data (strip on upload)
- [ ] **NC-3:** Must NOT allow offers on own listings
- [ ] **NC-4:** Must NOT break existing 21 cloud client functions

## UI Specification

### Mobile (Expo)
N/A -- this is a data layer feature. UI is covered by the "UI screens" spec.

### Web (Next.js)
N/A -- data layer only.

### State Coverage
N/A -- no UI. Cloud functions return Result<T> with ok/error states.

## Test Requirements

### Unit Tests
- [ ] cloudUploadListingPhoto: returns URL on success, error on invalid format
- [ ] cloudUploadListingPhoto: rejects when listing already has 10 photos
- [ ] cloudMakeOffer: creates pending offer with correct fields
- [ ] cloudMakeOffer: rejects offer on own listing
- [ ] cloudMakeOffer: rejects offer on sold/expired listing
- [ ] cloudRespondToOffer: accept transitions offer status and listing to pending_sale
- [ ] cloudRespondToOffer: counter creates new counter_amount_cents
- [ ] cloudUpdateListingPrice: creates price history entry
- [ ] cloudUpdateListingPrice: no-op when price unchanged
- [ ] cloudReportListing: creates report and moderation queue entry
- [ ] cloudBlockUser: hides content from blocker
- [ ] cloudUnblockUser: restores content visibility
- [ ] All new types validate correctly with Zod schemas

### Integration Tests
- [ ] Full offer flow: make offer -> seller accepts -> listing transitions to pending_sale
- [ ] Full photo flow: upload 3 photos -> reorder -> delete one -> verify order preserved
- [ ] Block flow: block user -> their listings hidden -> unblock -> listings visible again

### QA Verification Script

1. Connect to Supabase dashboard
2. Run schema.sql migrations -- verify new tables created with correct columns
3. Call cloudUploadListingPhoto with a test image -- verify Storage file exists, EXIF stripped -- AC-1
4. Call cloudMakeOffer on a listing -- verify mk_offers row created with status 'pending' -- AC-2
5. Call cloudRespondToOffer with 'accepted' -- verify offer status updated, listing status = 'pending_sale' -- AC-3
6. Call cloudUpdateListingPrice -- verify mk_price_history row created -- AC-4
7. Call cloudBlockUser -- verify blocker cannot query blocked user's listings -- AC-5
8. Call cloudReportListing -- verify mk_moderation_queue entry created -- AC-6
9. Verify RLS: user A cannot read user B's offers on user B's listings -- TC-3
10. Run pnpm test -- all new tests pass
11. Run pnpm typecheck -- no errors

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for offer logic and price history

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Cloud client has 21 functions covering categories, listings, conversations, messages, watchlist, reviews, seller stats, saved searches, secure messaging. Missing: photo management, offer system, price history, reports, blocks, moderation.

### After This Work
Cloud client fully covers all marketplace operations needed by the UI layer. ~13 new functions, 3 new Supabase tables, new Zod schemas for offers and price history.

### Files Changed
- `modules/market/src/cloud/client.ts` -- Add ~13 new cloud functions
- `modules/market/src/cloud/schema.sql` -- Add mk_offers, mk_price_history, mk_moderation_queue tables + RLS
- `modules/market/src/types.ts` -- Add OfferSchema, PriceHistorySchema, related enums
- `modules/market/src/index.ts` -- Export new types and functions
- `modules/market/src/__tests__/cloud-client.test.ts` -- Tests for new functions

### Known Limitations
- Photo thumbnail generation deferred to a Supabase Edge Function (not in this spec)
- Moderation actions are admin-only; no admin UI in this spec
- Offer expiration cron requires Supabase pg_cron setup

### Context for Next Agent
All new functions follow the existing pattern in client.ts: accept SupabaseClient as first arg, return Result<T>. Row interfaces for new tables follow the MarketXxxRow naming pattern. Use the existing normalizeXxx helper functions as examples for row-to-type mapping.
