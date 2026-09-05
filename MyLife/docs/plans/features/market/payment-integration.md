# Feature Spec: Market Payment Integration

## Metadata
- **Module:** market
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 4 x3 + Complexity 0 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 6-8 hours
- **Depends On:** Cloud client functions (market), UI screens (market)
- **Blocks:** Delivery tracking (requires payment confirmation), Dispute resolution (requires payment records)

## Business Context

### Why This Feature Exists
No mainstream marketplace operates without integrated payments. Users currently have no way to complete purchases within the app; they must arrange offline payment (cash, Venmo, etc.). Adding in-app payments via Stripe Connect enables: secure transactions, buyer protection, payment escrow for shipped items, and a foundation for the dispute resolution system. This is the feature that turns MyMarket from a listings board into a functioning marketplace.

MyLife's differentiator: zero platform fees. Stripe processing fees (2.9% + $0.30) are passed to the buyer or absorbed by the seller (their choice), but MyLife takes no cut. This is the anti-enshittification stance: the marketplace serves users, not shareholder revenue.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Facebook Marketplace | Yes | No (for local) | Checkout for shipped items, PayPal/Venmo for local. FB takes 0% since 2024. |
| OfferUp | Yes | No | In-app payments, 12.9% seller fee on shipped items. |
| Mercari | Yes | No | Stripe-based checkout, 10% seller fee, buyer protection included. |
| Poshmark | Yes | No | In-app payments, 20% seller fee, authentication for luxury items. |
| Craigslist | No | N/A | Cash only. No in-app payments. |

### Target User
Sellers and buyers who want secure in-app transactions without platform fees. Sellers tired of OfferUp's 12.9% or Poshmark's 20% cut. Buyers who want purchase protection without inflated prices.

## Technical Context

### Where This Lives in MyLife

```
modules/market/src/
  payments/
    stripe-client.ts        -- Stripe Connect setup, payment intents, transfers
    escrow.ts               -- Escrow state machine for shipped items
    types.ts                -- Payment-specific Zod schemas
    index.ts                -- Barrel export
  cloud/
    schema.sql              -- Add mk_payments, mk_escrow, mk_stripe_accounts tables
    client.ts               -- Add payment-related cloud functions
apps/mobile/app/(market)/
  checkout.tsx              -- Payment flow screen
  payment-settings.tsx      -- Stripe Connect onboarding for sellers
apps/web/app/market/
  checkout/[id]/page.tsx    -- Web checkout page
  payment-settings/page.tsx -- Seller Stripe setup
```

### Wireframe Position

```
Hub Dashboard
  └── MyMarket card
       └── Listing Detail
            └── "Buy Now" / "Pay" button
                 └── Checkout Screen ← YOU ARE HERE
       └── Profile tab
            └── Payment Settings
                 └── Stripe Connect Onboarding ← AND HERE
```

### Data Model

```sql
-- Stripe Connect accounts for sellers
CREATE TABLE IF NOT EXISTS mk_stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  stripe_account_id TEXT NOT NULL UNIQUE,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment records
CREATE TABLE IF NOT EXISTS mk_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES mk_listings(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  processing_fee_cents INTEGER NOT NULL DEFAULT 0,
  fee_payer TEXT NOT NULL DEFAULT 'buyer' CHECK (fee_payer IN ('buyer', 'seller')),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'disputed')),
  refund_amount_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Escrow for shipped items (funds held until delivery confirmed)
CREATE TABLE IF NOT EXISTS mk_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES mk_payments(id),
  status TEXT NOT NULL DEFAULT 'holding'
    CHECK (status IN ('holding', 'released', 'refunded', 'disputed')),
  hold_until TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Dependencies
- **Internal:** `@mylife/market` (cloud client, types), `@mylife/subscription` (user identity for Stripe Connect)
- **External:** Stripe SDK (`@stripe/stripe-react-native` mobile, `@stripe/stripe-js` web), Stripe Connect (Standard or Express accounts)
- **Cross-Module:** `@mylife/subscription` (shared Stripe customer ID if user has MyLife Pro), `@mylife/budget` (optional: record marketplace purchases as budget transactions)

## Functional Requirements

### User Stories
1. As a seller, I want to connect my bank account via Stripe so I can receive payments.
2. As a buyer, I want to pay for an item securely within the app so I don't need to arrange offline payment.
3. As a seller, I want to choose whether the buyer or I absorb Stripe processing fees.
4. As a buyer, I want my payment held in escrow for shipped items so I'm protected if the item doesn't arrive.
5. As a seller, I want to see my payment history and pending payouts.

### Behavior Specification

**Seller Onboarding (payment-settings.tsx):**
1. Seller navigates to Profile > Payment Settings.
2. Taps "Set Up Payments" to start Stripe Connect onboarding.
3. Redirected to Stripe's hosted onboarding flow (identity verification, bank account).
4. On return, app checks `charges_enabled` and `payouts_enabled` status.
5. Once complete, a "Payments Active" badge appears on their seller profile.
6. Fee preference: toggle "Buyer pays processing fee" vs "I'll absorb the fee" (default: buyer pays).

**Checkout Flow (checkout.tsx):**
1. Buyer taps "Buy Now" on listing detail (only visible when seller has Stripe connected).
2. Checkout screen shows: item summary, price, processing fee breakdown, total.
3. Buyer enters payment method (Stripe Payment Sheet: card, Apple Pay, Google Pay).
4. For local pickup: payment processes immediately, listing transitions to sold.
5. For shipped items: payment processes into escrow, listing transitions to pending_sale.
6. Confirmation screen shows order summary and next steps.

**Escrow for Shipped Items:**
1. Payment captured and held in escrow (Stripe Connect separate charges and transfers).
2. Seller ships item and provides tracking (see Delivery tracking spec).
3. Buyer confirms receipt OR 14-day auto-release timer expires.
4. Funds transferred to seller's Stripe Connect account.
5. If buyer disputes: escrow frozen, dispute resolution process begins.

### Edge Cases
- Seller hasn't set up Stripe: "Buy Now" button replaced with "Message Seller" (local cash arrangement)
- Stripe onboarding abandoned mid-flow: save progress, allow resume
- Payment fails (insufficient funds, card declined): show clear error, allow retry with different method
- Seller's Stripe account restricted/disabled: disable their "Buy Now" buttons, notify seller
- Buyer cancels after payment but before shipment: auto-refund from escrow
- Price changed between checkout start and payment submission: re-validate price, show updated total
- Network failure during payment: check payment intent status on resume (idempotency key)
- Currency mismatch: all payments in listing's currency (USD default), no cross-currency
- Refund after seller has already been paid out: create negative balance on seller's Stripe account

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Seller can complete Stripe Connect onboarding from Payment Settings
- [ ] **AC-2:** "Buy Now" button appears on listings where seller has Stripe connected
- [ ] **AC-3:** Checkout screen shows itemized price breakdown (item + processing fee + total)
- [ ] **AC-4:** Payment processes via Stripe Payment Sheet (card, Apple Pay, Google Pay)
- [ ] **AC-5:** Successful payment transitions listing status and shows confirmation
- [ ] **AC-6:** Seller sees payment history with status (pending/succeeded/refunded)
- [ ] **AC-7:** Shipped items hold payment in escrow until delivery confirmed or 14-day timer
- [ ] **AC-8:** Buyer can request refund from escrow before seller ships
- [ ] **AC-9:** Fee payer preference (buyer/seller) correctly adjusts the displayed total

### Technical Criteria
- [ ] **TC-1:** Stripe Payment Intents use idempotency keys to prevent double charges
- [ ] **TC-2:** Stripe Connect uses Standard accounts (seller owns relationship with Stripe)
- [ ] **TC-3:** Processing fee calculated as ceil(amount * 0.029 + 30) cents
- [ ] **TC-4:** RLS: buyers see own payments, sellers see payments on their listings
- [ ] **TC-5:** Stripe webhook handler updates payment/escrow status asynchronously
- [ ] **TC-6:** No credit card numbers stored in MyLife database (Stripe handles PCI)
- [ ] **TC-7:** All payment amounts validated server-side (never trust client-provided amounts)

### Negative Criteria
- [ ] **NC-1:** Must NOT store raw credit card data anywhere in MyLife systems
- [ ] **NC-2:** Must NOT take any platform fee or commission on transactions
- [ ] **NC-3:** Must NOT process payments for sellers without completed Stripe onboarding
- [ ] **NC-4:** Must NOT auto-release escrow if buyer has filed a dispute
- [ ] **NC-5:** Must NOT allow payment on own listings

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Checkout card: glass surface with clear price breakdown
- Module accent: `#14B8A6` for "Pay" button
- Stripe Payment Sheet: native modal (uses Stripe's built-in UI)
- Success state: checkmark animation, order summary card
- Processing fee: shown as a separate line item with info tooltip explaining Stripe fees

### Web (Next.js)
- Checkout page: centered card layout, max-width 480px
- Stripe Elements embedded in the page (inline card form)
- Same price breakdown layout as mobile
- Payment Settings: Stripe Connect redirect flow with loading state on return

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton checkout card | Fetching listing + payment details |
| Ready | Price breakdown + payment form | Data loaded, seller has Stripe |
| Processing | Spinner + "Processing payment..." | Payment submitted |
| Success | Checkmark + order summary + next steps | Payment succeeded |
| Error | Error message + retry button | Payment failed |
| No Stripe | "Message Seller to arrange payment" | Seller hasn't set up Stripe |

## Test Requirements

### Unit Tests
- [ ] Processing fee calculation: ceil(1000 * 0.029 + 30) = 60 cents
- [ ] Processing fee for buyer-pays: total = item + fee
- [ ] Processing fee for seller-absorbs: total = item, payout = item - fee
- [ ] Escrow state machine: holding -> released, holding -> refunded, holding -> disputed
- [ ] Payment status transitions: pending -> processing -> succeeded
- [ ] Reject payment on own listing
- [ ] Reject payment when seller Stripe not connected

### Integration Tests
- [ ] Full payment flow (Stripe test mode): checkout -> payment -> listing status update
- [ ] Escrow flow: payment -> hold -> buyer confirms receipt -> release
- [ ] Refund flow: payment -> buyer requests refund -> escrow refunded
- [ ] Stripe webhook: payment_intent.succeeded updates mk_payments status

### QA Verification Script

1. Navigate to Profile > Payment Settings
2. Tap "Set Up Payments" -- verify Stripe Connect onboarding opens -- AC-1
3. Complete Stripe test onboarding -- verify "Payments Active" badge appears
4. Create a listing with a price
5. Switch to buyer account, navigate to that listing
6. Verify "Buy Now" button is visible -- AC-2
7. Tap "Buy Now" -- verify checkout screen with price breakdown -- AC-3
8. Enter Stripe test card (4242 4242 4242 4242) -- AC-4
9. Submit payment -- verify processing spinner then success confirmation -- AC-5
10. Switch to seller account, check payment history -- verify payment record -- AC-6
11. Create a shipping listing, complete checkout
12. Verify escrow status shows "Holding" -- AC-7
13. As buyer, tap "Cancel Order" before shipment -- verify refund processed -- AC-8
14. Toggle fee preference to "Seller absorbs" -- verify total changes accordingly -- AC-9
15. Verify: no platform fee line item anywhere -- NC-2

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to checkout page, verify all states
- [ ] Batch QA: after 5 features in Market module, run `/qa`

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- Complexity=0 (Massive). Run on this spec BEFORE building.

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- Complexity=0. Validate payment architecture before implementation.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for fee calculation and escrow state machine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Market has no payment infrastructure. Buyers and sellers must arrange payment outside the app.

### After This Work
Full Stripe Connect integration: seller onboarding, buyer checkout, escrow for shipped items, fee management. Zero platform fees.

### Files Changed
- `modules/market/src/payments/stripe-client.ts` -- Stripe Connect + Payment Intent helpers
- `modules/market/src/payments/escrow.ts` -- Escrow state machine
- `modules/market/src/payments/types.ts` -- Payment Zod schemas
- `modules/market/src/payments/index.ts` -- Barrel export
- `modules/market/src/cloud/schema.sql` -- mk_payments, mk_escrow, mk_stripe_accounts tables
- `modules/market/src/cloud/client.ts` -- Payment-related cloud functions
- `modules/market/src/types.ts` -- Payment status enums
- `modules/market/src/index.ts` -- Export payment module
- `apps/mobile/app/(market)/checkout.tsx` -- Mobile checkout screen
- `apps/mobile/app/(market)/payment-settings.tsx` -- Seller Stripe onboarding
- `apps/web/app/market/checkout/[id]/page.tsx` -- Web checkout
- `apps/web/app/market/payment-settings/page.tsx` -- Web Stripe setup

### Known Limitations
- Stripe Connect onboarding is hosted by Stripe (redirect flow), not custom-built
- No multi-currency support in MVP (USD only)
- No installment payments or layaway
- Refund policy is simple (full refund from escrow); partial refunds deferred
- No tax calculation (seller responsible for reporting income)

### Context for Next Agent
Stripe test mode keys should be stored in Supabase Edge Function env vars, not in client code. Use Stripe's Standard Connect account type (seller owns their Stripe relationship). The escrow system uses Stripe's "separate charges and transfers" pattern: charge the buyer, hold funds, then transfer to seller's connected account on release. All payment validation must happen server-side via Supabase Edge Functions.
