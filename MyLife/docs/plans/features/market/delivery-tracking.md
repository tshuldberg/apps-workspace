# Feature Spec: Market Delivery Tracking

## Metadata
- **Module:** market
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Payment integration (market), Cloud client functions (market), UI screens (market)
- **Blocks:** None

## Business Context

### Why This Feature Exists
When a buyer pays for a shipped item, they need to know when it will arrive. Without tracking, buyers repeatedly message sellers asking "did you ship it yet?", and sellers have no way to prove delivery if a dispute arises. Tracking also triggers escrow release: once delivery is confirmed, funds transfer to the seller. This is the missing link between payment and fulfillment for non-local transactions.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Facebook Marketplace | Yes | No | Integrated with USPS/UPS/FedEx via Commerce Manager. Auto-generated labels. |
| OfferUp | Yes | No | Prepaid shipping labels, in-app tracking via carrier APIs. |
| Mercari | Yes | No | Best-in-class: prepaid labels, carrier selection, real-time tracking, auto-release on delivery. |
| Poshmark | Yes | No | Pre-paid USPS label included, tracking automatic. |
| eBay | Yes | No | Carrier API integration, tracking number links, delivery confirmation triggers payment release. |
| Craigslist | No | N/A | Local only, no shipping support. |

### Target User
Sellers shipping items to buyers who need delivery transparency. Buyers who want to know when their purchase will arrive. Both parties benefit from delivery confirmation as the escrow release trigger.

## Technical Context

### Where This Lives in MyLife

```
modules/market/src/
  shipping/
    tracking.ts              -- Carrier tracking utilities, status normalization
    types.ts                 -- Shipping/tracking Zod schemas
    index.ts                 -- Barrel export
  cloud/
    schema.sql               -- Add mk_shipments table
    client.ts                -- Add shipping cloud functions
apps/mobile/app/(market)/
  shipping-detail.tsx        -- Tracking timeline screen
apps/web/app/market/
  shipping/[id]/page.tsx     -- Web tracking page
```

### Wireframe Position

```
Hub Dashboard
  └── MyMarket card
       └── Messages tab
            └── Chat Thread (shipped item)
                 └── "Track Shipment" card
                      └── Shipping Detail ← YOU ARE HERE
       └── Sell tab
            └── My Listings (sold)
                 └── "Add Tracking" button
```

### Data Model

```sql
-- Shipment tracking
CREATE TABLE IF NOT EXISTS mk_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES mk_payments(id),
  listing_id UUID NOT NULL REFERENCES mk_listings(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  carrier TEXT NOT NULL CHECK (carrier IN (
    'usps', 'ups', 'fedex', 'dhl', 'amazon', 'other'
  )),
  tracking_number TEXT NOT NULL CHECK (char_length(tracking_number) BETWEEN 5 AND 50),
  status TEXT NOT NULL DEFAULT 'label_created' CHECK (status IN (
    'label_created', 'in_transit', 'out_for_delivery',
    'delivered', 'exception', 'returned'
  )),
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  last_carrier_update TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tracking events (denormalized from carrier updates)
CREATE TABLE IF NOT EXISTS mk_shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES mk_shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Dependencies
- **Internal:** `@mylife/market` (payments for escrow release, cloud client, types), `@mylife/ui`
- **External:** Carrier tracking APIs (USPS Web Tools, UPS Tracking API, FedEx Track API) via Supabase Edge Function proxy
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a seller, I want to add a tracking number after shipping so the buyer can track the package.
2. As a buyer, I want to see real-time shipping status so I know when my purchase will arrive.
3. As a buyer, I want to be notified when my package is delivered so I can confirm receipt.
4. As a system, I want delivery confirmation to trigger escrow release so sellers get paid.

### Behavior Specification

**Seller Adds Tracking:**
1. After payment succeeds, seller sees "Ship Item" prompt in the chat thread and sell tab.
2. Seller taps "Add Tracking" and selects carrier from list (USPS, UPS, FedEx, DHL, Amazon, Other).
3. Enters tracking number (validated against carrier-specific formats).
4. System creates shipment record and begins polling for updates.
5. Buyer receives push notification: "Your item has shipped!"

**Tracking Timeline:**
1. Both buyer and seller can view a tracking timeline screen.
2. Timeline shows events in reverse chronological order: status, description, location, timestamp.
3. Top of screen: current status badge, estimated delivery date, carrier logo.
4. Events are pulled from carrier APIs via a Supabase Edge Function on a polling schedule.

**Status Updates:**
1. Edge Function polls carrier APIs every 4 hours for active shipments.
2. New events are inserted into mk_shipment_events.
3. Shipment status updated based on latest event (label_created -> in_transit -> out_for_delivery -> delivered).
4. On status change, push notification sent to buyer.

**Delivery Confirmation and Escrow Release:**
1. When carrier reports "delivered", shipment status updates.
2. Buyer receives notification: "Your package was delivered! Confirm receipt to release payment."
3. Buyer has 3 options: "Confirm Receipt" (escrow released immediately), "Report Problem" (opens dispute), or wait 3 days (auto-release).
4. Escrow auto-releases 3 days after delivery if buyer takes no action.

### Edge Cases
- Invalid tracking number format: reject at input with carrier-specific validation rules
- Carrier API unavailable: show "Last updated [time]. Tracking data may be delayed." banner
- Tracking number reused across payments: reject (one tracking per payment)
- Package marked delivered but buyer didn't receive: direct to dispute resolution flow
- Carrier "exception" status: notify both parties, no auto-escrow release
- "Returned to sender": notify both parties, freeze escrow, prompt discussion
- Seller enters tracking for local pickup listing: reject (tracking only for shipped items)
- Multiple packages per order: MVP supports one tracking number per payment (one shipment)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Seller can add tracking number with carrier selection after payment
- [ ] **AC-2:** Buyer sees "Your item has shipped" notification when tracking added
- [ ] **AC-3:** Tracking timeline shows events with status, description, location, and timestamp
- [ ] **AC-4:** Current status badge and estimated delivery visible at top of tracking screen
- [ ] **AC-5:** "Package Delivered" notification triggers receipt confirmation flow
- [ ] **AC-6:** "Confirm Receipt" releases escrow to seller
- [ ] **AC-7:** Tracking card embedded in chat thread with quick-view status

### Technical Criteria
- [ ] **TC-1:** Carrier API polling via Supabase Edge Function (every 4 hours for active shipments)
- [ ] **TC-2:** Tracking number validated against carrier-specific regex patterns
- [ ] **TC-3:** Shipment events stored in mk_shipment_events with carrier-normalized status
- [ ] **TC-4:** Delivery triggers 3-day auto-escrow release countdown
- [ ] **TC-5:** RLS: buyer and seller both see shipment data for their transaction
- [ ] **TC-6:** Status normalization maps carrier-specific statuses to standard enum values

### Negative Criteria
- [ ] **NC-1:** Must NOT auto-release escrow if shipment has "exception" or "returned" status
- [ ] **NC-2:** Must NOT allow tracking on local-pickup-only transactions
- [ ] **NC-3:** Must NOT expose carrier API keys to the client (server-side proxy only)
- [ ] **NC-4:** Must NOT poll carrier APIs more frequently than every 4 hours per shipment

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Tracking card (in chat): glass card showing carrier logo, status badge, tracking number, ETA
- Timeline screen: vertical list with colored status dots and connector lines
- Status badges: label_created=gray, in_transit=blue, out_for_delivery=amber, delivered=green, exception=red
- Module accent: `#14B8A6` for "Confirm Receipt" button
- Carrier logos: small monochrome icons for USPS, UPS, FedEx, DHL

### Web (Next.js)
- Tracking page: centered card with timeline, carrier info, and action buttons
- Same status color coding as mobile
- Tracking number displayed as a clickable link to carrier's tracking website

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Tracking | "Waiting for seller to ship" message | Payment succeeded, no tracking added |
| Label Created | "Shipping label created" with carrier | Seller added tracking |
| In Transit | "Package in transit" with last location | Carrier reports movement |
| Out for Delivery | "Out for delivery!" with ETA | Carrier reports delivery route |
| Delivered | "Delivered!" + confirm receipt buttons | Carrier confirms delivery |
| Exception | "Shipping exception" with details | Carrier reports issue |

## Test Requirements

### Unit Tests
- [ ] Tracking number validation: USPS (20-22 digits), UPS (1Z+16 alphanum), FedEx (12-22 digits)
- [ ] Status normalization: carrier-specific -> standard enum mapping
- [ ] Escrow release trigger: delivery -> 3-day countdown -> release
- [ ] Reject tracking for local pickup listing
- [ ] Reject duplicate tracking number on same payment

### Integration Tests
- [ ] Full flow: add tracking -> poll carrier -> status update -> delivery -> escrow release
- [ ] Exception flow: add tracking -> carrier exception -> no auto-release -> notification sent
- [ ] Dispute integration: delivered but buyer disputes -> escrow frozen

### QA Verification Script

1. Complete a payment for a shipped listing
2. As seller, navigate to the sold listing in Sell tab
3. Tap "Add Tracking" -- select carrier (USPS) -- enter tracking number -- AC-1
4. As buyer, verify "Your item has shipped" notification -- AC-2
5. Open tracking timeline -- verify carrier, tracking number, status badge visible -- AC-3, AC-4
6. Verify tracking card appears in the chat thread -- AC-7
7. (Simulate delivery by updating shipment status in DB)
8. As buyer, verify "Package Delivered" notification -- AC-5
9. Tap "Confirm Receipt" -- verify escrow released -- AC-6
10. Verify seller's payment status shows "Released"
11. Try to add tracking on a local pickup listing -- verify rejection -- NC-2
12. Verify tracking number links to carrier website on web -- Web spec

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to tracking screens, verify all states

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Market has payment and escrow infrastructure but no way for sellers to provide shipping information or for buyers to track deliveries. Escrow release is manual.

### After This Work
Sellers can add tracking numbers, carrier APIs are polled for updates, buyers see real-time tracking timelines, and delivery confirmation auto-releases escrow.

### Files Changed
- `modules/market/src/shipping/tracking.ts` -- Carrier tracking utilities and status normalization
- `modules/market/src/shipping/types.ts` -- Shipment and tracking event Zod schemas
- `modules/market/src/shipping/index.ts` -- Barrel export
- `modules/market/src/cloud/schema.sql` -- mk_shipments, mk_shipment_events tables + RLS
- `modules/market/src/cloud/client.ts` -- Shipping cloud functions (add tracking, get shipment, get events)
- `modules/market/src/index.ts` -- Export shipping module
- `apps/mobile/app/(market)/shipping-detail.tsx` -- Tracking timeline screen
- `apps/web/app/market/shipping/[id]/page.tsx` -- Web tracking page
- `supabase/functions/carrier-tracking/index.ts` -- Edge Function for carrier API polling

### Known Limitations
- No prepaid shipping label generation (sellers use their own carrier accounts)
- No shipping cost calculator
- One tracking number per payment (no multi-package support)
- Carrier API polling (not real-time webhooks) introduces 0-4 hour delay
- Only 5 major carriers supported initially

### Context for Next Agent
The escrow module (from payment integration spec) must expose a `releaseEscrow` function callable from the delivery confirmation flow. The carrier tracking Edge Function should be a Supabase scheduled function (pg_cron) that queries mk_shipments WHERE status NOT IN ('delivered', 'returned') and polls the appropriate carrier API. Use a status normalization map to convert carrier-specific statuses to the standard enum.
