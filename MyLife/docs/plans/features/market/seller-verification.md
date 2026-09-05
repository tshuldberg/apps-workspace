# Feature Spec: Market Seller Verification

## Metadata
- **Module:** market
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Cloud client functions (market), UI screens (market)
- **Blocks:** None

## Business Context

### Why This Feature Exists
Trust is the #1 barrier to marketplace adoption. Users won't buy from strangers without some assurance the seller is real. Facebook Marketplace leverages existing Facebook profiles for trust signals. Without a Facebook-like social graph, MyMarket needs its own verification system. Verified sellers get a badge, higher search ranking, and increased buyer confidence. This reduces fraud, increases transaction completion rates, and builds community trust.

The verification system is progressive: it starts with basic identity verification (email + phone), adds marketplace activity milestones (5 sales, 10 reviews), and can expand to ID verification or address verification in the future. No single checkpoint blocks participation; each verification level adds trust.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| OfferUp | Yes | No | TruYou verification (ID + selfie, optional), government ID validation |
| Facebook Marketplace | Partial | No | Implicit via Facebook profile (real name, photo, friends), no explicit verification |
| Mercari | Yes | No | Phone + email required, ID for higher limits, seller rating system |
| Poshmark | Yes | No | Email + phone, Posh Ambassador program (activity-based badges) |
| eBay | Yes | No | PayPal/bank verification, Top Rated Seller program (performance-based) |
| Craigslist | No | N/A | No verification, fully anonymous, high fraud rate |

### Target User
Buyers who want assurance that sellers are real people (not scammers). Sellers who want to build trust and stand out with verification badges. Community members who value safety over anonymity.

## Technical Context

### Where This Lives in MyLife

```
modules/market/src/
  verification/
    engine.ts                -- Verification level calculation, badge logic
    types.ts                 -- Verification Zod schemas
    index.ts                 -- Barrel export
  cloud/
    schema.sql               -- Add mk_seller_verification table
    client.ts                -- Add verification cloud functions
apps/mobile/app/(market)/
  verification.tsx           -- Verification status and actions screen
apps/web/app/market/
  verification/page.tsx      -- Web verification page
```

### Wireframe Position

```
Hub Dashboard
  └── MyMarket card
       └── Profile tab
            └── "Verification Status" card
                 └── Verification Screen ← YOU ARE HERE
       └── Browse tab
            └── Listing Card
                 └── [Verified badge] on seller name
```

### Data Model

```sql
-- Seller verification records
CREATE TABLE IF NOT EXISTS mk_seller_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  photo_verified BOOLEAN NOT NULL DEFAULT false,
  id_verified BOOLEAN NOT NULL DEFAULT false,
  completed_sales INTEGER NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  average_rating REAL,
  account_age_days INTEGER NOT NULL DEFAULT 0,
  verification_level TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_level IN ('unverified', 'basic', 'verified', 'trusted', 'top_seller')),
  level_achieved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Verification levels:

| Level | Requirements | Badge | Benefits |
|-------|-------------|-------|---------|
| Unverified | New account | None | Can list items, limited to 5 active listings |
| Basic | Email verified | Gray checkmark | Can list up to 25 active listings |
| Verified | Email + phone + profile photo | Blue checkmark | Up to 50 active listings, appears in "Verified Sellers" section |
| Trusted | Verified + 5 completed sales + 4.0+ rating | Gold checkmark | Up to 100 listings, priority in search results |
| Top Seller | Trusted + 25 completed sales + 4.5+ rating + 90%+ response rate + 30+ day account age | Star badge | Featured on module dashboard, "Top Seller" label |

### Dependencies
- **Internal:** `@mylife/market` (seller stats, reviews, cloud client), `@mylife/auth` (email verification status), `@mylife/social` (profile photo existence)
- **External:** SMS verification service (Twilio or Supabase Auth phone provider) for phone verification
- **Cross-Module:** `@mylife/auth` (email verification status), `@mylife/social` (profile completeness)

## Functional Requirements

### User Stories
1. As a seller, I want to see my verification progress so I know what steps to take to increase my trust level.
2. As a buyer, I want to see a seller's verification badge so I can assess trustworthiness.
3. As a seller, I want to verify my phone number to unlock more listing capacity.
4. As a system, I want to auto-promote sellers when they meet level thresholds so badges stay current.

### Behavior Specification

**Verification Status Screen (verification.tsx):**
1. User navigates to Profile > Verification Status.
2. Screen shows current level with badge icon and description.
3. Progress section shows completed and remaining requirements for next level.
4. Each requirement has a status indicator (completed/incomplete) and action button if actionable.
5. Completed requirements: green checkmark. Incomplete: gray circle with action CTA.

**Verification Checklist:**
- Email verified: auto-detected from auth state. If not verified, "Verify Email" button sends verification email.
- Phone verified: "Verify Phone" button triggers SMS verification flow (enter number -> receive code -> enter code).
- Profile photo: auto-detected from social profile. If missing, "Add Photo" links to social profile settings.
- Completed sales: auto-counted from mk_seller_stats. Shows "X of Y completed."
- Average rating: auto-computed from reviews. Shows current rating.
- Response rate: auto-computed from messaging data. Shows percentage.
- Account age: auto-computed from profile creation date.

**Auto-Promotion:**
1. On every relevant event (sale completed, review received, profile updated), the verification engine recalculates the seller's level.
2. If the seller qualifies for a higher level, auto-promote and send notification: "Congratulations! You've been upgraded to [Level]."
3. Levels never auto-demote (even if rating drops below threshold temporarily). Manual demotion only for policy violations.

**Badge Display:**
1. Verification badge appears next to seller name everywhere: listing cards, listing detail, chat thread, seller profile.
2. Badge is tappable; shows tooltip: "[Level] Seller - [requirements summary]".
3. Badge color matches level: gray (basic), blue (verified), gold (trusted), star (top seller).

### Edge Cases
- User with no sales: stays at Basic or Verified based on identity verification alone
- Rating drops below threshold after achieving Trusted: keep Trusted status (no auto-demotion)
- Phone number changed: re-verification required, phone_verified resets to false
- Email changed: re-verification required, email_verified resets to false
- Seller banned/suspended: verification level frozen, badge hidden
- Multiple levels achieved simultaneously (e.g., new user verifies all identity + already has 25 sales from another platform migration): calculate correct level in one pass
- Verification check on every listing view: cache verification level on seller_stats row, don't recalculate per request

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Verification screen shows current level, badge, and progress to next level
- [ ] **AC-2:** Each verification requirement shows completion status and action button
- [ ] **AC-3:** "Verify Phone" triggers SMS code flow and updates status on success
- [ ] **AC-4:** Verification badge visible on listing cards, listing detail, and seller profile
- [ ] **AC-5:** Badge is tappable with tooltip showing level name and requirements
- [ ] **AC-6:** Auto-promotion notification sent when seller qualifies for higher level
- [ ] **AC-7:** Unverified sellers limited to 5 active listings with prompt to verify

### Technical Criteria
- [ ] **TC-1:** Verification level calculated from mk_seller_verification record (cached, not computed per request)
- [ ] **TC-2:** Level recalculated on events: sale completed, review received, profile updated, identity verified
- [ ] **TC-3:** No auto-demotion: levels only increase or stay the same (except manual admin action)
- [ ] **TC-4:** SMS verification uses Supabase Auth phone provider or Twilio
- [ ] **TC-5:** Listing count limits enforced server-side per verification level
- [ ] **TC-6:** RLS: users see own verification details, public sees only badge level
- [ ] **TC-7:** Verification engine is pure function: input = stats, output = level (testable)

### Negative Criteria
- [ ] **NC-1:** Must NOT require ID verification for basic marketplace participation
- [ ] **NC-2:** Must NOT expose phone numbers to other users (only verification status)
- [ ] **NC-3:** Must NOT auto-demote sellers (levels are progressive, not punitive)
- [ ] **NC-4:** Must NOT block unverified users from listing items (just limit count)
- [ ] **NC-5:** Must NOT share verification data across modules without user consent

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Verification card: glass card with current level badge (large), level name, description
- Progress list: checklist-style with green checkmarks / gray circles
- Action buttons: accent `#14B8A6` for "Verify Phone", "Add Photo" etc.
- SMS verification: modal with phone input + 6-digit code input
- Badge icons: small inline badges (16x16) next to seller names throughout the app

### Web (Next.js)
- Verification page: centered card layout with progress checklist
- Same badge display system as mobile
- SMS verification: inline form on the verification page

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Unverified | "Get started with verification" CTA + checklist | New seller, nothing verified |
| In Progress | Partial checklist with completed items highlighted | Some requirements met |
| Level Achieved | Badge celebration + current level display | All requirements for a level met |
| Top Seller | Star badge + "Top Seller" prominent display | Maximum level achieved |
| Phone Verification | SMS code input modal | "Verify Phone" tapped |

## Test Requirements

### Unit Tests
- [ ] Verification engine: unverified (no requirements met)
- [ ] Verification engine: basic (email only)
- [ ] Verification engine: verified (email + phone + photo)
- [ ] Verification engine: trusted (verified + 5 sales + 4.0 rating)
- [ ] Verification engine: top_seller (all requirements met)
- [ ] Verification engine: no demotion (rating drops but level preserved)
- [ ] Listing limit enforcement: 5 for unverified, 25 for basic, 50 for verified, 100 for trusted/top
- [ ] Level calculation is pure function (deterministic from input stats)

### Integration Tests
- [ ] Full flow: new user -> verify email -> verify phone -> add photo -> reaches "Verified" level
- [ ] Auto-promotion: user completes 5th sale -> notification -> level updates to "Trusted"
- [ ] Listing limit: unverified user tries to create 6th listing -> rejected with upgrade prompt

### QA Verification Script

1. Open Market module as a new user (no verifications)
2. Navigate to Profile > Verification Status
3. Verify current level shows "Unverified" with empty checklist -- AC-1
4. Verify each requirement shows status and action button -- AC-2
5. Tap "Verify Phone" -- enter phone number -- receive SMS code -- enter code -- AC-3
6. Verify phone requirement now shows green checkmark
7. Verify email (through auth settings)
8. Add profile photo
9. Verify level upgrades to "Verified" with blue checkmark badge
10. Navigate to Browse tab -- verify badge appears on user's listing cards -- AC-4
11. Tap the badge -- verify tooltip shows level info -- AC-5
12. Complete 5 sales (or simulate in DB)
13. Verify auto-promotion notification to "Trusted" -- AC-6
14. As unverified user, try to create 6th listing -- verify rejection with prompt -- AC-7
15. Verify no phone number shown to other users -- NC-2

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to verification screens, verify all states

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for verification level engine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Market has SellerStats type with totalListings, activeLlstings, totalSold, averageRating, reviewCount, responseRate, and memberSince. The spec mentions verification badges (5+ sales, 4.0+ rating, profile complete) but no verification engine or progressive level system exists.

### After This Work
Progressive 5-level verification system with identity checks, activity milestones, and auto-promotion. Badges displayed throughout the marketplace UI. Listing limits enforced per level. Pure-function verification engine for testability.

### Files Changed
- `modules/market/src/verification/engine.ts` -- Verification level calculation engine
- `modules/market/src/verification/types.ts` -- VerificationLevel, SellerVerification schemas
- `modules/market/src/verification/index.ts` -- Barrel export
- `modules/market/src/cloud/schema.sql` -- mk_seller_verification table + RLS
- `modules/market/src/cloud/client.ts` -- Verification cloud functions (get, update, recalculate)
- `modules/market/src/index.ts` -- Export verification module
- `apps/mobile/app/(market)/verification.tsx` -- Verification status and actions screen
- `apps/web/app/market/verification/page.tsx` -- Web verification page
- `modules/market/src/__tests__/verification.test.ts` -- Verification engine tests

### Known Limitations
- No government ID verification in MVP (Stripe Identity or similar deferred)
- No address verification
- No background check integration
- SMS costs: each phone verification costs ~$0.01-0.05 via Twilio
- No admin interface for manual level adjustments or demotion

### Context for Next Agent
The verification engine should be a pure function: `calculateVerificationLevel(stats: VerificationStats): VerificationLevel`. Input includes email_verified, phone_verified, photo_verified, completed_sales, average_rating, response_rate, account_age_days. Output is one of the 5 levels. This makes it trivially testable and the domain engine benchmarker can generate comprehensive evals. The engine is called from cloud functions on relevant events (sale complete, review posted, etc.) and caches the result on the mk_seller_verification row.
