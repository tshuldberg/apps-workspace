# Feature Spec: Market Dispute Resolution

## Metadata
- **Module:** market
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Payment integration (market), Cloud client functions (market), UI screens (market)
- **Blocks:** None

## Business Context

### Why This Feature Exists
In-app payments without dispute resolution is a liability. If a buyer pays for an item and it never arrives, or arrives damaged, or doesn't match the description, they need a structured way to resolve the issue. Without this, users will file chargebacks through their bank (which costs Stripe $15 per dispute and can get MyMarket's Stripe account flagged). A proper dispute system resolves issues within the platform, protects both buyers and sellers, and keeps chargeback rates below Stripe's thresholds.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Facebook Marketplace | Partial | No | Purchase Protection for shipped items with Checkout. Limited to 45 days. Automated resolution. |
| OfferUp | Yes | No | Protection for shipped items, automated + manual review. 2-day return window. |
| Mercari | Yes | No | 3-day inspection period, photo-based evidence, automated refunds. Best-in-class. |
| Poshmark | Yes | No | Case system with photos, Posh Protect for all purchases. |
| eBay | Yes | No | Resolution Center with structured claims, escalation to eBay review. 30-day window. |
| Craigslist | No | N/A | No transactions, no disputes. |

### Target User
Buyers who paid for items via in-app payment and encountered issues (item not received, item not as described, item damaged in shipping). Sellers who need protection against fraudulent buyer claims.

## Technical Context

### Where This Lives in MyLife

```
modules/market/src/
  disputes/
    engine.ts                -- Dispute state machine, resolution logic
    types.ts                 -- Dispute Zod schemas
    index.ts                 -- Barrel export
  cloud/
    schema.sql               -- Add mk_disputes, mk_dispute_evidence tables
    client.ts                -- Add dispute cloud functions
apps/mobile/app/(market)/
  dispute.tsx                -- File/view dispute screen
  dispute-detail.tsx         -- Dispute timeline and evidence viewer
apps/web/app/market/
  disputes/page.tsx          -- Disputes list
  disputes/[id]/page.tsx     -- Dispute detail
```

### Wireframe Position

```
Hub Dashboard
  └── MyMarket card
       └── Messages tab
            └── Chat Thread (with completed payment)
                 └── "Report a Problem" link
                      └── Dispute Screen ← YOU ARE HERE
       └── Profile tab
            └── "My Disputes" section
```

### Data Model

```sql
-- Dispute records
CREATE TABLE IF NOT EXISTS mk_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES mk_payments(id),
  listing_id UUID NOT NULL REFERENCES mk_listings(id),
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL CHECK (reason IN (
    'item_not_received', 'item_not_as_described',
    'item_damaged', 'wrong_item', 'counterfeit', 'other'
  )),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'seller_response', 'evidence_review',
    'resolved_buyer', 'resolved_seller', 'escalated', 'closed'
  )),
  resolution_type TEXT CHECK (resolution_type IN (
    'full_refund', 'partial_refund', 'return_and_refund',
    'no_refund', 'mutual_agreement'
  )),
  refund_amount_cents INTEGER,
  filed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seller_response_deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 days'),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Evidence attachments (photos, screenshots)
CREATE TABLE IF NOT EXISTS mk_dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES mk_disputes(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('photo', 'screenshot', 'text', 'tracking')),
  content TEXT NOT NULL,
  caption TEXT CHECK (char_length(caption) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Dependencies
- **Internal:** `@mylife/market` (payments, cloud client, types), `@mylife/ui` (form components)
- **External:** Supabase Storage (evidence photo uploads)
- **Cross-Module:** `@mylife/subscription` (potential escalation to human review for Pro users, future)

## Functional Requirements

### User Stories
1. As a buyer, I want to file a dispute when my purchase has a problem so I can get a resolution.
2. As a seller, I want to respond to disputes with evidence so I can defend against false claims.
3. As a buyer, I want to see the status and timeline of my dispute so I know what's happening.
4. As a seller, I want disputes resolved fairly so I'm not penalized for buyer fraud.

### Behavior Specification

**Filing a Dispute (buyer):**
1. Buyer navigates to the payment confirmation or chat thread for a completed transaction.
2. Taps "Report a Problem" link.
3. Selects dispute reason from structured list: Item not received, Item not as described, Item damaged, Wrong item, Counterfeit, Other.
4. Writes description (min 20 chars, max 2000 chars).
5. Attaches up to 5 evidence photos.
6. Submits dispute. Escrow is frozen if payment was escrowed.
7. Seller notified via push notification.

**Seller Response:**
1. Seller has 3 days to respond (seller_response_deadline).
2. Seller can: accept and refund, offer partial refund, provide counter-evidence and reject, or propose mutual agreement.
3. If seller doesn't respond within 3 days, dispute auto-resolves in buyer's favor (full refund).

**Resolution Flow:**
1. **Accept (seller):** Full refund processed from escrow/Stripe. Dispute status: resolved_buyer.
2. **Partial refund (seller):** Seller proposes partial amount. Buyer accepts or rejects.
3. **Reject with evidence (seller):** Seller submits counter-evidence. Status: evidence_review.
4. **Mutual agreement:** Both parties agree on a resolution (partial refund amount). Status: resolved_seller or resolved_buyer.
5. **Escalation:** If no agreement after 7 days, dispute escalates (future: human review queue).
6. **Auto-resolve:** No seller response in 3 days -> full refund to buyer.

**Dispute Timeline View:**
1. Chronological list of events: filed, evidence submitted, responses, status changes, resolution.
2. Each event shows timestamp, actor (buyer/seller/system), action, and attached evidence.

### Edge Cases
- Dispute filed after escrow already released to seller: refund comes from seller's Stripe balance
- Dispute on a local pickup (no shipping): limited to "item not as described"
- Multiple disputes on same payment: reject (one dispute per payment)
- Seller's Stripe account has insufficient balance for refund: Stripe creates negative balance
- Evidence photo too large: compress or reject (max 5MB per photo)
- Dispute filed after 14-day window: reject with explanation
- Both parties agree on $0 refund: close dispute with "no refund" resolution

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Buyer can file a dispute from payment confirmation or chat thread
- [ ] **AC-2:** Dispute form requires structured reason, description, and optional evidence photos
- [ ] **AC-3:** Seller receives notification and can respond within 3-day deadline
- [ ] **AC-4:** Dispute timeline shows chronological events with timestamps
- [ ] **AC-5:** Seller can accept refund, propose partial refund, or reject with evidence
- [ ] **AC-6:** Auto-resolution after 3 days of seller inaction (full refund to buyer)
- [ ] **AC-7:** Both parties can see dispute status in their profile under "My Disputes"
- [ ] **AC-8:** Refund processes through Stripe when dispute resolves in buyer's favor

### Technical Criteria
- [ ] **TC-1:** Dispute state machine validates all transitions server-side
- [ ] **TC-2:** Filing a dispute freezes escrow (prevents release to seller)
- [ ] **TC-3:** Auto-resolution cron runs daily checking seller_response_deadline
- [ ] **TC-4:** Evidence photos stored in Supabase Storage under `disputes/{disputeId}/`
- [ ] **TC-5:** RLS: buyer sees own disputes, seller sees disputes on their listings
- [ ] **TC-6:** Dispute filing window: 14 days from payment date
- [ ] **TC-7:** Refund processed via Stripe Refund API on resolution

### Negative Criteria
- [ ] **NC-1:** Must NOT allow disputes on local-pickup-only transactions for "item not received"
- [ ] **NC-2:** Must NOT allow multiple disputes on the same payment
- [ ] **NC-3:** Must NOT allow disputes after the 14-day filing window
- [ ] **NC-4:** Must NOT reveal dispute details to non-participants

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Dispute form: glass card with structured inputs (reason picker, text area, photo upload)
- Module accent: `#14B8A6` for submit button and status badges
- Timeline: vertical list with connector lines between events
- Status badges: colored by state (open=amber, resolved_buyer=green, resolved_seller=blue, escalated=red)
- Evidence photos: thumbnail grid, tappable to full-screen view

### Web (Next.js)
- Disputes list: table view with status, listing title, filed date, resolution
- Dispute detail: two-column layout (timeline left, evidence right)
- Same color coding for status badges

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton dispute form | Opening dispute screen |
| Form | Structured dispute filing form | No existing dispute for this payment |
| Pending | "Waiting for seller response" + countdown timer | Dispute filed |
| Response | Seller's response + action buttons | Seller responded |
| Resolved | Resolution summary + refund confirmation | Dispute resolved |
| Escalated | "Under review" message | No agreement reached |
| Expired | "Dispute window has closed" | 14-day window passed |

## Test Requirements

### Unit Tests
- [ ] Dispute state machine: open -> seller_response -> resolved_buyer (accept)
- [ ] Dispute state machine: open -> seller_response -> evidence_review -> resolved_seller (reject + evidence)
- [ ] Dispute state machine: open -> resolved_buyer (auto, 3-day timeout)
- [ ] Invalid transition: resolved_buyer -> open (rejected)
- [ ] Filing window: reject dispute filed after 14 days
- [ ] Filing duplicate: reject second dispute on same payment
- [ ] Refund calculation: full refund = payment amount, partial = proposed amount

### Integration Tests
- [ ] Full flow: file dispute -> seller responds -> buyer accepts partial refund -> Stripe refund processed
- [ ] Auto-resolve flow: file dispute -> 3 days pass -> auto full refund
- [ ] Evidence flow: file dispute with photos -> photos stored in Storage -> visible in timeline

### QA Verification Script

1. Complete a payment for a listing (via payment integration)
2. As buyer, navigate to the completed transaction
3. Tap "Report a Problem" -- verify dispute form appears -- AC-1
4. Select "Item not as described" -- fill description (20+ chars) -- add 2 evidence photos -- AC-2
5. Submit dispute -- verify status shows "Open, waiting for seller response" -- AC-4
6. Switch to seller account -- verify notification received -- AC-3
7. Open dispute -- verify timeline shows buyer's filing event
8. Tap "Respond" -- choose "Accept and Refund" -- AC-5
9. Verify refund processed and dispute status = resolved_buyer -- AC-8
10. Navigate to Profile > My Disputes -- verify dispute listed -- AC-7
11. Test auto-resolution: file a new dispute, wait 3 days (or adjust deadline in DB)
12. Verify auto-refund processed -- AC-6
13. Try to file dispute on a 15-day-old payment -- verify rejection -- TC-6
14. Try to file second dispute on same payment -- verify rejection -- NC-2

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to dispute screens, verify all states

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for dispute state machine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Market has Report and Block schemas in types.ts but no structured dispute resolution for payments. Escrow exists but has no dispute-triggered freeze mechanism.

### After This Work
Complete dispute resolution system: structured filing, seller response workflow, auto-resolution, evidence management, Stripe refund integration, and timeline tracking.

### Files Changed
- `modules/market/src/disputes/engine.ts` -- Dispute state machine and resolution logic
- `modules/market/src/disputes/types.ts` -- Dispute and evidence Zod schemas
- `modules/market/src/disputes/index.ts` -- Barrel export
- `modules/market/src/cloud/schema.sql` -- mk_disputes, mk_dispute_evidence tables + RLS
- `modules/market/src/cloud/client.ts` -- Dispute cloud functions (file, respond, get, escalate)
- `modules/market/src/index.ts` -- Export disputes module
- `apps/mobile/app/(market)/dispute.tsx` -- File dispute screen
- `apps/mobile/app/(market)/dispute-detail.tsx` -- Dispute timeline + evidence viewer
- `apps/web/app/market/disputes/page.tsx` -- Disputes list
- `apps/web/app/market/disputes/[id]/page.tsx` -- Dispute detail

### Known Limitations
- No human moderator review queue in MVP (auto-resolve + mutual agreement only)
- No appeal process after resolution
- No seller dispute score / penalty system
- Evidence limited to photos and text (no video)

### Context for Next Agent
The escrow system (from payment integration spec) must support a `disputed` status that freezes funds. The dispute engine should import and call the escrow freeze/release functions. Use the existing Report/Block schemas as reference for the evidence pattern. The 3-day auto-resolve timer should be a Supabase pg_cron function.
