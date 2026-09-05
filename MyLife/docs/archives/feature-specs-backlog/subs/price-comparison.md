# Feature Spec: Price Comparison

## Metadata
- **Module:** subs
- **Priority Score:** 19 / 50 (C-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 1 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 8
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Database schema, All CRUD functions
- **Blocks:** none

## Business Context

### Why This Feature Exists
When users decide to keep a subscription, they should still pay the least possible. Many services offer cheaper tiers, student/military discounts, annual billing discounts, or family plans. Some services have free alternatives (Notion free vs paid, Spotify free vs Premium). Price comparison helps users find the best deal for services they want to keep, or discover free/cheaper alternatives they didn't know about. This complements Cancellation Assist: "cancel it or get a better deal."

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Rocket Money | Partial | Yes ($48-144/yr) | Bill negotiation (they negotiate on your behalf for a fee). No self-service comparison. |
| Bobby | No | N/A | No price comparison or alternative suggestions. |

### Target User
Users who've reviewed their subscriptions via Cancellation Assist and decided to keep some but want to optimize costs. Users who don't realize their service has a cheaper tier or annual billing discount. Users interested in discovering free or lower-cost alternatives to paid services they use.

## Technical Context

### Where This Lives in MyLife

```
modules/subs/src/
  engines/
    price-comparison.ts      -- NEW: Price comparison engine
    alternatives-catalog.ts  -- NEW: Curated alternatives data
    __tests__/
      price-comparison.test.ts -- NEW: Engine tests
  types.ts                   -- MODIFY: Add comparison-related types
  index.ts                   -- MODIFY: Export comparison engine
apps/mobile/app/(subs)/
  subscription/
    [id].tsx                 -- MODIFY: Add "Save Money" section to detail screen
    compare/
      [id].tsx               -- NEW: Full comparison screen
apps/web/app/subs/
  compare/
    [id]/
      page.tsx               -- NEW: Comparison page
```

### Wireframe Position

```
Hub Dashboard
  └── MySubs card
       └── Subs tab
            └── [Subscription Detail]
                 └── "Save Money" section    ← NEW
                      └── [Comparison screen] ← NEW
```

### Data Model

Uses existing `sb_price_alternatives` table (created in Database Schema):

```sql
-- Already exists in V1 migration
CREATE TABLE IF NOT EXISTS sb_price_alternatives (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  alternative_name TEXT NOT NULL,
  alternative_cost_cents INTEGER NOT NULL,
  alternative_billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (alternative_billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly', 'lifetime')),
  alternative_url TEXT,
  notes TEXT,
  is_free_tier INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Additionally, the alternatives catalog (bundled data) stores known alternatives and pricing tiers:

```typescript
interface AlternativesEntry {
  serviceName: string;           // e.g., "Netflix"
  tiers: ServiceTier[];          // Different pricing tiers for this service
  alternatives: AlternativeService[]; // Competing/replacement services
}

interface ServiceTier {
  name: string;                  // e.g., "Standard with ads"
  costCents: number;
  billingCycle: BillingCycle;
  features: string[];            // What you get at this tier
  isCurrentDefault: boolean;     // Whether this is the "typical" tier
}

interface AlternativeService {
  name: string;
  costCents: number;
  billingCycle: BillingCycle;
  freeOptionAvailable: boolean;
  category: string;
  url: string;
  differentiators: string[];     // What makes this different
}
```

### Dependencies
- **Internal:** `@mylife/subs` (CRUD functions for alternatives, subscription data, cost analysis engine for normalization), `@mylife/db` (DatabaseAdapter)
- **External:** None. All comparison data is bundled on-device. No API calls to price comparison services.
- **Cross-Module:** Budget module's subscription catalog has some tier information. Cross-reference but don't import directly.

## Functional Requirements

### User Stories
1. As a user, I want to see if my subscription has cheaper tiers available so I can downgrade and save money.
2. As a user, I want to see the annual billing discount for my subscription so I can switch and save.
3. As a user, I want to see free or cheaper alternatives to my subscription so I can switch services.
4. As a user, I want to compare features between tiers and alternatives so I can make an informed decision.
5. As a user, I want to add my own notes about alternatives I've found so I can track custom options.
6. As a user, I want to see total potential savings across all comparison suggestions.

### Behavior Specification

**Alternatives Catalog:**

A bundled dataset of known service tiers and alternatives for popular subscriptions. Covers the top 50-100 subscription services. Structure:

**Streaming alternatives example:**
```
Netflix Standard ($15.49/mo):
  Tiers: Standard with Ads ($6.99/mo), Standard ($15.49/mo), Premium ($22.99/mo)
  Alternatives: Hulu ($7.99/mo), Disney+ ($7.99/mo), Tubi (free), Pluto TV (free)

Adobe Creative Cloud ($59.99/mo):
  Tiers: Photography Plan ($9.99/mo), Single App ($22.99/mo), All Apps ($59.99/mo)
  Alternatives: Canva Pro ($12.99/mo), Figma ($15/mo), Affinity Suite ($169.99 lifetime)
```

**Price Comparison Engine:**

```typescript
interface ComparisonResult {
  subscriptionId: string;
  subscriptionName: string;
  currentCostCents: number;
  currentBillingCycle: BillingCycle;
  currentMonthlyCents: number;

  cheaperTiers: TierComparison[];     // Same service, cheaper tier
  annualSavings: AnnualDiscount | null;  // Same service, annual billing
  alternatives: AlternativeComparison[];  // Different services
  userAlternatives: PriceAlternative[];   // User-added alternatives from sb_price_alternatives

  totalPotentialSavingsCents: number;  // Best possible monthly savings
}

interface TierComparison {
  tierName: string;
  monthlyCents: number;
  savingsCents: number;
  savingsPercent: number;
  features: string[];
  missingFeatures: string[];  // Features in current tier not in this one
}

interface AnnualDiscount {
  annualCostCents: number;
  monthlyEquivalentCents: number;
  monthlySavingsCents: number;
  annualSavingsCents: number;
  savingsPercent: number;
}

interface AlternativeComparison {
  name: string;
  monthlyCents: number;
  savingsCents: number;
  savingsPercent: number;
  freeOptionAvailable: boolean;
  url: string;
  differentiators: string[];
}
```

`getComparison(db, subscriptionId: string): ComparisonResult | null` -- Returns comparison data for a subscription. Returns null if no catalog match and no user alternatives.

`getComparisonSummary(db): { totalMonthlySavingsCents: number; subscriptionsWithSavings: number; topOpportunity: string }` -- Aggregate savings across all subscriptions.

`matchToCatalog(subscriptionName: string): AlternativesEntry | null` -- Fuzzy match a subscription name to the alternatives catalog.

**Subscription Detail -- "Save Money" section:**
1. Added to the existing subscription detail screen (`subscription/[id].tsx`).
2. Shows if there are cheaper tiers, annual discounts, or alternatives available.
3. Each suggestion shows: name, current vs suggested price, monthly savings.
4. "View Full Comparison" link opens the comparison screen.
5. If no comparison data available: show "Add alternatives" button for manual entry.

**Comparison screen (compare/[id].tsx):**
1. Header: current subscription name and cost.
2. **Cheaper Tiers** section (if available):
   - Cards for each cheaper tier with cost, savings, and feature comparison.
   - "Features you'd lose" clearly listed.
   - "Switch to this tier" is informational (link to service settings).
3. **Annual Billing** section (if available):
   - Shows monthly vs annual pricing.
   - "Save $X/year by switching to annual billing."
   - Link to service billing page.
4. **Alternative Services** section:
   - Cards for each alternative with cost, savings, and differentiators.
   - "Free option available" badge where applicable.
   - Link to alternative's website.
5. **Your Notes** section:
   - User-added alternatives from `sb_price_alternatives`.
   - "Add alternative" button for manual entries.
   - Each entry: name, cost, URL, notes, free tier flag.
   - Edit/delete user alternatives.

**Savings indicators on Subs tab:**
- Subscription cards on the Subs tab show a small "Save $X/mo" badge if comparison data suggests savings.
- Badge color: `#10B981` (accent green).
- Tap navigates to the comparison screen.

### Edge Cases

- **Subscription not in catalog:** No tiers or alternatives shown from catalog. User can still add manual alternatives.
- **User already on cheapest tier:** Cheaper Tiers section shows "You're on the cheapest tier!" confirmation.
- **User already on annual billing:** Annual Billing section shows "You're already on annual billing!" confirmation.
- **Catalog prices are outdated:** Prices are approximate. Show "(typical)" label and "Prices may vary" disclaimer.
- **Free alternatives:** Prominently featured with "Free" badge. Differentiators highlight limitations (e.g., "Tubi: free, ad-supported, smaller library").
- **Lifetime subscription:** No annual billing suggestion (already lifetime). May still have tier and alternative comparisons.
- **Very many alternatives (10+):** Show top 5 sorted by savings, "Show all" expandable.
- **User adds duplicate alternative:** Allow it (different notes/context possible).
- **No savings available:** Section shows "No savings found for this subscription. You're getting a good deal!" with green checkmark.
- **Cross-category alternatives:** Some alternatives are in different categories (e.g., Notion as alternative to both Evernote and Google Docs). Show regardless of category match.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Subscription detail screen shows "Save Money" section when comparison data exists
- [ ] **AC-2:** Cheaper tier suggestions show current vs suggested price and monthly savings
- [ ] **AC-3:** Annual billing discount shows monthly and annual savings with percentage
- [ ] **AC-4:** Alternative services show name, cost, savings, differentiators, and free badge
- [ ] **AC-5:** "View Full Comparison" opens dedicated comparison screen
- [ ] **AC-6:** User can add custom alternatives with name, cost, URL, and notes
- [ ] **AC-7:** User can edit and delete custom alternatives
- [ ] **AC-8:** Subs tab cards show "Save $X/mo" badge when savings available
- [ ] **AC-9:** Comparison screen shows "You're getting a good deal!" when no savings available
- [ ] **AC-10:** Feature works on both mobile and web
- [ ] **AC-11:** Prices marked as "(typical)" with "Prices may vary" disclaimer

### Technical Criteria
- [ ] **TC-1:** `getComparison` returns correct tier, annual, and alternative comparisons
- [ ] **TC-2:** `matchToCatalog` fuzzy-matches subscription names (case-insensitive, handles "Netflix Standard" -> "Netflix")
- [ ] **TC-3:** Savings calculations use the cost analysis engine's normalization functions
- [ ] **TC-4:** User alternatives stored in `sb_price_alternatives` table
- [ ] **TC-5:** `getComparisonSummary` aggregates across all subscriptions correctly
- [ ] **TC-6:** Alternatives catalog covers top 50+ subscription services
- [ ] **TC-7:** Feature comparison lists are accurate for major tiers
- [ ] **TC-8:** `pnpm typecheck` passes with no errors

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Must NOT make network calls to compare prices (all data is bundled)
- [ ] **NC-2:** Must NOT present catalog prices as guaranteed (always show "typical" / "may vary")
- [ ] **NC-3:** Must NOT auto-switch tiers or services (user decides and acts externally)
- [ ] **NC-4:** Must NOT delete user alternatives when catalog data changes

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#10B981` (emerald green)
- Savings badge: `#10B981` background pill with white text
- Free badge: `#30D158` (success green) background pill
- "Features you'd lose": `#F59E0B` (warning yellow) text
- Disclaimer text: `rgba(240,240,245,0.45)` (dimmed secondary)

Subscription detail "Save Money" section:
```
[Save Money]                         [View All →]

  [Cheaper Tier Available]
    Standard with Ads  $6.99/mo
    Save $16.00/mo ($192/yr)         [green badge]

  [Annual Billing Discount]
    Pay $155.88/yr instead of $186/yr
    Save $2.49/mo ($30/yr)           [green badge]

  [Free Alternative]
    Tubi  Free                       [Free badge]
    "Ad-supported, smaller library"
```

Full comparison screen:
```
[← Back]      Compare: Netflix

  Current: Netflix Standard
  $15.49/mo ($185.88/yr)

[Cheaper Tiers]
  ┌─────────────────────────────────────┐
  │ Standard with Ads       $6.99/mo    │
  │ Save $8.50/mo ($102/yr)            │
  │                                     │
  │ ✓ Same content library              │
  │ ✓ HD streaming                      │
  │ ✗ No ad-free experience             │
  │ ✗ No downloads                      │
  └─────────────────────────────────────┘

[Annual Billing]
  Monthly: $15.49/mo = $185.88/yr
  Annual:  $155.88/yr = $12.99/mo
  Save $30.00/year (16%)

[Alternatives]
  ┌─────────────────────────────────────┐
  │ Hulu (with Ads)         $7.99/mo    │
  │ Save $7.50/mo ($90/yr)             │
  │ "Hulu originals, next-day TV"      │
  │                      [Visit Site →] │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ Tubi                    Free  🟢    │
  │ Save $15.49/mo ($185.88/yr)        │
  │ "Ad-supported, older content"      │
  │                      [Visit Site →] │
  └─────────────────────────────────────┘

[Your Notes]
  (No custom alternatives added)
  [+ Add Alternative]

  Prices are typical and may vary.
```

### Web (Next.js)

- Route: `/subs/compare/[id]`
- Comparison data shown in a two-column layout on desktop (current left, alternatives right)
- Tier comparison as a horizontal feature matrix table on desktop
- Responsive: stacks to single column on mobile widths

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton for Save Money section | Catalog matching in progress |
| No catalog match | "Add alternatives" button, no catalog suggestions | Unknown subscription |
| No savings | "You're getting a good deal!" with checkmark | All tiers are more expensive |
| Savings found | Tier, annual, and alternative cards with savings amounts | Cheaper options exist |
| User alternatives | User-added entries below catalog data | User has added custom alternatives |
| Error | "Could not load comparison data" with retry | Engine fails |

## Test Requirements

### Unit Tests
- [ ] `matchToCatalog('Netflix')` returns Netflix alternatives entry
- [ ] `matchToCatalog('netflix standard')` returns Netflix (case-insensitive, fuzzy)
- [ ] `matchToCatalog('Unknown Service')` returns null
- [ ] `getComparison`: Netflix Standard -> cheaperTiers includes "Standard with Ads"
- [ ] `getComparison`: monthly sub -> annualSavings calculated correctly
- [ ] `getComparison`: sub with free alternative -> freeOptionAvailable = true
- [ ] `getComparison`: sub on cheapest tier -> cheaperTiers is empty
- [ ] `getComparison`: sub already annual -> annualSavings is null
- [ ] `getComparison`: sub not in catalog but has user alternatives -> returns user alternatives only
- [ ] `getComparisonSummary`: 3 subs with savings -> correct total and count
- [ ] `getComparisonSummary`: no savings available -> total = 0
- [ ] Savings percentage calculation: ($15.49 - $6.99) / $15.49 = 54.9%
- [ ] Monthly normalization: annual $155.88 -> monthly $12.99

### Integration Tests
- [ ] Full flow: add Netflix at $15.49/mo -> view comparison -> see cheaper tiers and alternatives
- [ ] User alternative flow: add custom alternative -> appears in comparison -> edit it -> changes persist -> delete it -> removed
- [ ] Savings badge flow: add sub with catalog match -> Subs tab shows "Save $X" badge on the card
- [ ] No match flow: add custom-named sub -> comparison shows "Add alternatives" only

### QA Verification Script

1. Open MySubs on iOS/web
2. Add Netflix: $15.49/mo, monthly billing
3. Navigate to Netflix detail screen
4. Verify: "Save Money" section appears -- AC-1
5. Verify: "Standard with Ads" tier shown with $6.99/mo and savings -- AC-2
6. Verify: Annual billing discount shown -- AC-3
7. Verify: Tubi shown as free alternative -- AC-4
8. Tap "View Full Comparison" -- AC-5
9. Verify: Full comparison screen with tiers, annual, and alternatives -- AC-5
10. Verify: Tier comparison shows features gained/lost -- AC-2
11. Verify: Prices marked as "(typical)" -- AC-11
12. Scroll to "Your Notes" section
13. Tap "Add Alternative" -- AC-6
14. Add: "Plex" at $4.99/mo with note "Requires own media library"
15. Verify: Custom alternative appears in the list -- AC-6
16. Edit the custom alternative's cost -- AC-7
17. Delete it -- AC-7
18. Navigate back to Subs tab
19. Verify: Netflix card shows "Save $X/mo" badge -- AC-8
20. Add a custom subscription "My Custom App" at $5/mo
21. Navigate to its detail
22. Verify: "Save Money" section shows "Add alternatives" (no catalog match) -- AC-9 variant
23. Verify on web -- AC-10

## gstack Quality Gates

Based on Complexity score 1 (Complex), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Complex features (Complexity <= 1):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature has UI:
- [ ] `/browse` -- navigate to a subscription detail, verify comparison section, open comparison screen

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- subs has no standalone counterpart, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Subscriptions can be viewed and managed. Cost analysis provides cost breakdown. Cancellation assist identifies waste. No way to compare pricing tiers or find cheaper alternatives. The `sb_price_alternatives` table exists but is unused.

### After This Work
- Alternatives catalog with pricing tiers and competitor data for 50+ services.
- Price comparison engine matching subscriptions to catalog entries.
- "Save Money" section on subscription detail screens.
- Full comparison screen with tier comparison, annual discount, and alternatives.
- User-addable custom alternatives in `sb_price_alternatives`.
- Savings badges on subscription list cards.

### Files Changed
- `modules/subs/src/engines/price-comparison.ts` -- NEW: Price comparison engine
- `modules/subs/src/engines/alternatives-catalog.ts` -- NEW: Bundled alternatives and tier data (50+ services)
- `modules/subs/src/engines/__tests__/price-comparison.test.ts` -- NEW: Engine tests
- `modules/subs/src/types.ts` -- MODIFY: Add ComparisonResult, TierComparison, AnnualDiscount, AlternativeComparison, AlternativesEntry types
- `modules/subs/src/index.ts` -- MODIFY: Export comparison engine
- `apps/mobile/app/(subs)/subscription/[id].tsx` -- MODIFY: Add "Save Money" section
- `apps/mobile/app/(subs)/subscription/compare/[id].tsx` -- NEW: Comparison screen
- `apps/web/app/subs/compare/[id]/page.tsx` -- NEW: Comparison page

### Known Limitations
- **Catalog data is static.** Prices change frequently. The catalog represents typical pricing at build time. No auto-update mechanism.
- **Limited to 50+ services.** The alternatives catalog covers the most popular subscriptions. Niche or regional services won't have catalog matches.
- **No personalized recommendations.** The engine shows all available alternatives, not recommendations based on usage patterns. Future ML integration could add personalization.
- **Tier feature comparison is curated.** Feature lists for tiers are manually maintained. May be incomplete or outdated for some services.
- **Annual pricing not available for all services.** Some services don't offer annual discounts. The catalog reflects known discount availability.
- **Fuzzy matching is simple.** Uses case-insensitive substring matching, not NLP. "Netflix Standard" matches "Netflix" but "My Netflix Account" might not.

### Context for Next Agent
- The alternatives catalog in `alternatives-catalog.ts` should be a large typed constant. Structure it by service name for O(1) lookup: `Record<string, AlternativesEntry>`.
- Fuzzy matching: normalize both the subscription name and catalog keys (lowercase, strip "standard", "premium", "plus", "pro" suffixes). Try exact match first, then substring match, then Levenshtein distance for close matches.
- The `sb_price_alternatives` table stores user-added alternatives. These are displayed alongside catalog alternatives but clearly labeled as "Your Notes".
- For tier feature comparison, use a simple string array comparison. Features present in the current tier but absent in the cheaper tier are listed as "Features you'd lose". This is manually curated in the catalog data.
- Annual billing discounts: many services offer 15-20% off for annual billing. The catalog should include both monthly and annual prices where known. Calculate the discount as `(monthly * 12 - annual) / (monthly * 12) * 100`.
- The savings badge on the Subs tab card uses `getComparisonSummary` scoped to a single subscription. Cache this on first load and invalidate when the subscription or its alternatives change.
- Don't import from the Budget module's catalog. Maintain the Subs alternatives catalog independently. Cross-reference for data consistency during development.
