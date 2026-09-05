# Feature Spec: Cost-Per-Wear Calculation

## Metadata
- **Module:** closet
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** 2
- **Estimated CC Time:** 30 min
- **Depends On:** none (engine already exists at `engine/analytics.ts`)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Cost-per-wear (CPW) turns a wardrobe from a static inventory into a financial lens. Users who see that a $200 jacket worn 100 times costs $2/wear while a $30 shirt worn twice costs $15/wear make better purchasing decisions. This is Stylebook's signature feature and a key reason users pay for closet apps.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Stylebook | Yes | $5.99 one-time | CPW on item detail, sortable stats list, "investment pieces" highlight |
| Indyx | No | N/A | Has wear tracking but no CPW calculation |
| Clueless | No | N/A | Focuses on outfit suggestions, not analytics |
| Alta | No | N/A | AI-focused, no financial tracking |

### Target User
Fashion-conscious users who want to justify purchases or identify wasteful spending. Budget-minded users who track clothing investment. Users migrating from Stylebook who expect CPW as a core feature.

## Technical Context

### Where This Lives in MyLife

```
modules/closet/src/engine/analytics.ts   -- calculateCostPerWear() ALREADY EXISTS
modules/closet/src/engine/cpw.ts         -- NEW: CPW ranking engine, trend tracking
modules/closet/src/db/crud.ts            -- Add getCPWLeaderboard() query
apps/mobile/app/(closet)/stats.tsx       -- Add CPW section to Stats tab
apps/mobile/app/(closet)/item-detail.tsx -- Add CPW badge display
apps/web/app/closet/stats/page.tsx       -- Web CPW stats page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCloset card
       ├── Wardrobe tab (grid) -- CPW badge on each item card
       ├── Stats tab
       │    └── Cost-Per-Wear section ← YOU ARE HERE
       │         ├── CPW Leaderboard (best/worst value items)
       │         ├── Category averages
       │         └── Total wardrobe CPW summary
       └── Item Detail screen -- CPW display with trend
```

### Data Model
No new tables needed. The engine function `calculateCostPerWear(item)` already exists in `engine/analytics.ts`. This feature adds a ranking/aggregation engine and UI surfaces.

The existing `cl_items` table already has:
- `purchase_price_cents INTEGER` -- purchase price in cents
- `times_worn INTEGER NOT NULL DEFAULT 0` -- total wear count

CPW = purchase_price_cents / times_worn (rounded to nearest cent).

### Dependencies
- **Internal:** `@mylife/closet` (engine/analytics.ts -- `calculateCostPerWear` already implemented), `@mylife/ui` (glass cards, accent colors)
- **External:** None
- **Cross-Module:** Budget module -- future cross-module link to show clothing spend category. Not blocking.

## Functional Requirements

### User Stories
1. As a closet user, I want to see the cost-per-wear of each item so I can identify my best and worst clothing investments.
2. As a stats-oriented user, I want a ranked leaderboard of items by CPW so I can quickly find my most and least cost-effective pieces.
3. As a shopper, I want to see average CPW by category (tops, bottoms, shoes) so I can decide where to invest more.
4. As an item browser, I want to see a CPW badge on grid view cards so I don't have to open each item to check.

### Behavior Specification

1. User opens Stats tab in MyCloset
2. CPW section shows three subsections:
   a. **Summary card:** total wardrobe value, average CPW across all items, median CPW
   b. **Best Value (Top 10):** items ranked by lowest CPW, showing item name, CPW formatted as currency, times worn, purchase price
   c. **Worst Value (Bottom 10):** items ranked by highest CPW (fewest wears relative to price)
3. Tapping any item in the leaderboard navigates to item-detail
4. Item detail screen shows CPW prominently below the item photo/name: "$X.XX per wear" with a sub-label showing "Worn Y times | Paid $Z.ZZ"
5. If purchase price is not set, CPW displays "Set price to track" as a tappable link to edit
6. If times worn is 0, CPW displays "Not worn yet" instead of dividing by zero
7. Grid view cards show a small CPW badge in the bottom-right corner (only for items with both price and wear count > 0)
8. Category averages section shows average CPW per clothing category with bar chart visualization

### Edge Cases
- Item with no purchase price: show "Set price to track" prompt, not N/A
- Item with 0 wears: show "Not worn yet" instead of infinity/error
- Item with very high CPW (worn once, expensive): highlight in "worst value" without being judgmental -- label as "Getting Started" if worn < 3 times
- All items missing prices: show empty state with explanation of CPW concept and CTA to add prices
- Single item in wardrobe: still show CPW, skip leaderboard
- Items with status 'donated'/'sold'/'archived': exclude from leaderboard by default, include in "historical" view
- Currency formatting: use cl_settings 'currency' value (default USD), format with 2 decimal places

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Stats tab displays CPW summary card with total value, average CPW, and median CPW
- [ ] **AC-2:** Best Value leaderboard shows up to 10 items sorted by lowest CPW
- [ ] **AC-3:** Worst Value leaderboard shows up to 10 items sorted by highest CPW
- [ ] **AC-4:** Tapping a leaderboard item navigates to item-detail screen
- [ ] **AC-5:** Item detail screen shows CPW formatted as "$X.XX per wear"
- [ ] **AC-6:** Item detail shows "Set price to track" when purchase price is null
- [ ] **AC-7:** Item detail shows "Not worn yet" when times_worn is 0
- [ ] **AC-8:** Grid view cards show CPW badge for items with price and wear count > 0
- [ ] **AC-9:** Category averages section shows per-category CPW with visual bars
- [ ] **AC-10:** Only active-status items appear in leaderboards

### Technical Criteria
- [ ] **TC-1:** `getCPWLeaderboard()` returns items sorted by CPW ascending with limit parameter
- [ ] **TC-2:** `getCPWByCategory()` returns average CPW per category for active items only
- [ ] **TC-3:** CPW calculation handles null price (returns null) and zero wears (returns null)
- [ ] **TC-4:** Currency formatting respects cl_settings 'currency' value
- [ ] **TC-5:** Leaderboard queries complete in <100ms for 1000 items
- [ ] **TC-6:** CPW values are rounded to nearest cent (integer cents in storage, formatted to 2 decimals in display)

### Negative Criteria
- [ ] **NC-1:** Division by zero must never occur -- zero wears returns null CPW
- [ ] **NC-2:** Donated/sold/archived items must NOT appear in active leaderboards
- [ ] **NC-3:** CPW badge must NOT appear on grid cards missing price or with 0 wears
- [ ] **NC-4:** Feature must NOT require network access

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Summary card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#E879A8` (closet accent)
- CPW badge on grid: small pill shape, glass background, accent-colored text
- Leaderboard rows: glass card, item thumbnail (40x40), name, CPW in accent color, times-worn in secondary text
- Category bars: horizontal bars, accent color fill, glass background

### Web (Next.js)
- Same tokens via CSS variables in `globals.css`
- Sidebar navigation: Stats tab accessible via `/closet/stats`
- Leaderboard rendered as a table with sortable columns
- Category averages as horizontal bar chart

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards for summary + leaderboard | Initial data fetch |
| Empty | "Add items with prices to start tracking cost-per-wear" + illustration | No items with prices |
| Error | "Couldn't load stats. Pull to retry." | SQLite query failure |
| Success | Full CPW dashboard with summary, leaderboards, category averages | Items with prices and wear data exist |
| Partial | Summary card + "Log more wears to see your best values" | Items have prices but most have 0 wears |

## Test Requirements

### Unit Tests
- [ ] `calculateCostPerWear`: returns null for null price
- [ ] `calculateCostPerWear`: returns null for 0 wears
- [ ] `calculateCostPerWear`: returns correct rounded value (2500 cents / 10 wears = 250 cents)
- [ ] `getCPWLeaderboard`: sorts ascending by CPW
- [ ] `getCPWLeaderboard`: excludes items without price
- [ ] `getCPWLeaderboard`: excludes non-active items
- [ ] `getCPWLeaderboard`: respects limit parameter
- [ ] `getCPWByCategory`: returns averages grouped by category
- [ ] `getCPWByCategory`: excludes categories with no priced items
- [ ] `getCPWSummary`: returns total value, average CPW, median CPW

### Integration Tests
- [ ] Full flow: create items with prices -> log wears -> check leaderboard order
- [ ] Edge flow: all items missing prices -> empty state displayed
- [ ] Mixed flow: some items with prices, some without -> leaderboard only shows priced items

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyCloset module
3. Add 5 clothing items with varying prices ($10, $50, $100, $200, $500)
4. Verify: Stats tab shows "Add wear data" prompt -- corresponds to AC-1 partial
5. Log 10 wears on the $10 item, 2 on the $50, 1 on the $100, 5 on the $200, 0 on the $500
6. Navigate to Stats tab
7. Verify: Summary card shows total value, average CPW, median CPW -- corresponds to AC-1
8. Verify: Best Value shows $10 item first ($1.00/wear) -- corresponds to AC-2
9. Verify: Worst Value shows $100 item ($100.00/wear) -- corresponds to AC-3
10. Verify: $500 item (0 wears) does NOT appear in leaderboard -- corresponds to NC-3
11. Tap the $10 item in leaderboard
12. Verify: Item detail shows "$1.00 per wear" -- corresponds to AC-4, AC-5
13. Navigate back, open the $500 item
14. Verify: Shows "Not worn yet" instead of CPW -- corresponds to AC-7
15. Remove price from an item via edit
16. Verify: Shows "Set price to track" -- corresponds to AC-6
17. Navigate to Wardrobe grid view
18. Verify: CPW badges visible on items with price + wears -- corresponds to AC-8
19. Verify: No CPW badge on $500 item (0 wears) -- corresponds to NC-3
20. Mark one item as donated
21. Verify: Donated item disappears from leaderboard -- corresponds to NC-2
22. Repeat steps 7-12 on web at `/closet/stats`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/closet/stats`, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in closet module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for CPW ranking engine

### Post-merge:
- [ ] `/parity-check` -- closet module parity

## Handoff State

### Before This Work
- `calculateCostPerWear(item)` exists in `engine/analytics.ts` and returns `number | null`
- No UI surfaces CPW data
- No leaderboard or category aggregation functions exist
- Stats tab exists in navigation definition but may not have CPW section

### After This Work
- CPW ranking engine (`engine/cpw.ts`) with leaderboard, category averages, and summary functions
- Stats tab shows full CPW dashboard
- Item detail shows CPW badge
- Grid view shows CPW badge on cards
- Web stats page at `/closet/stats`

### Files Changed
- `modules/closet/src/engine/cpw.ts` -- NEW: CPW ranking, category averages, summary
- `modules/closet/src/db/crud.ts` -- Add `getCPWLeaderboard()`, `getCPWByCategory()`, `getCPWSummary()`
- `modules/closet/src/index.ts` -- Export new functions
- `modules/closet/src/__tests__/cpw.test.ts` -- NEW: CPW engine tests
- `apps/mobile/app/(closet)/stats.tsx` -- Add CPW dashboard section
- `apps/mobile/components/closet/CPWBadge.tsx` -- NEW: reusable CPW badge component
- `apps/web/app/closet/stats/page.tsx` -- Web CPW stats page

### Known Limitations
- CPW does not account for dry cleaning or alteration costs (only purchase price)
- No depreciation model (a 5-year-old coat and a new coat are treated the same)
- Currency display is cosmetic only -- no exchange rate conversion

### Context for Next Agent
- The `calculateCostPerWear` function in `engine/analytics.ts` is the foundation. Don't rewrite it; build ranking/aggregation on top.
- CPW values are in cents (integer). Format to dollars only in the UI layer.
- The `cl_settings` table has a 'currency' key defaulting to 'USD'. Use it for display formatting.
