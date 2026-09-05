# Feature Spec: Subs Full Web UI

## Metadata
- **Module:** subs
- **Task:** W14-13
- **Sprint:** W14
- **Estimated CC Time:** 4-6 hours
- **Depends On:** none (all 45+ module exports exist, 4 engines complete, 7 tables across schema v1)
- **Blocks:** Subs web QA pass, Subs web design review
- **Reference Implementation:** `apps/web/app/books/` (layout, page, actions, sub-routes, tests)

## Design Pipeline Signoff

### Phase 1: Office Hours (Builder Mode)

**Core insight:** A subscription tracker on desktop must exploit what mobile cannot: the financial command center layout. On mobile, you scroll a list. On desktop, you see your entire subscription portfolio at a glance -- monthly burn rate, category breakdown donut chart, renewal calendar, cancellation opportunities, and price comparison data -- all simultaneously on one screen. The key differentiator is information density: subscriptions are inherently tabular data, and desktop gives you the real estate to show 20+ subscriptions with full context (name, cost, cycle, category, next renewal, status) in a sortable, filterable data table that would require endless scrolling on mobile.

**Narrowest wedge:** The **Cost Command Center** -- a single dashboard screen showing your monthly/annual burn rate as a hero stat, a stacked bar chart of category spending, a sortable subscription table, and a "savings opportunities" sidebar. This is the screen that makes users say "I need this on desktop" because it turns subscription management from a chore into a satisfying audit. Seeing $219/month spelled out in a data table with category colors and next-renewal dates makes the cost visceral in a way a scrolling mobile list never can.

**Web-specific affordances to leverage:**

| Affordance | Desktop Advantage |
|-----------|-------------------|
| Multi-panel dashboard | Cost summary + category chart + subscription table + opportunities sidebar all visible |
| Sortable data tables | Click column headers to sort by cost, name, renewal date, category. Bulk select + bulk actions |
| Keyboard shortcuts | `N` new subscription, `Cmd+K` search catalog, `/` filter subscriptions, `Esc` close modals |
| Wide calendar view | Full month calendar with renewal dots + agenda list side-by-side |
| Comparison panels | Side-by-side tier comparison and alternative service comparison tables |
| Inline editing | Double-click a subscription cost to edit in place. No modal required |
| Copy-paste export | Select rows and copy formatted text, or export CSV with one click |
| Drag-and-drop | Drag subscriptions between categories |
| Right-click context | Cancel, pause, view history, compare prices from context menu |
| Deep linking | Every subscription, category, calendar month, and report is a unique URL |

**Brainstorm scoring:**
- Demand signal: Rocket Money's web dashboard is their most-used surface. Users audit subscriptions at a computer with bank statements open beside them.
- Narrowest wedge: Cost command center dashboard. If seeing your monthly burn rate in a dense table with sortable columns and a donut chart lands, users adopt the web UI.
- Expansion path: Dashboard -> Calendar -> Cost Reports -> Price Comparison -> Cancellation Assist (each adds a reason to return to desktop).

**What makes a subs web app delightful vs mobile:**
1. **The "shock and awe" moment** -- seeing your total monthly cost in 36px type with a full category breakdown beside it creates the emotional trigger that drives action
2. **The audit workflow** -- on desktop you have your bank statement in one tab, MySubs in another. Sort by cost descending, cross-reference, cancel the ones you forgot about
3. **Comparison shopping** -- tier tables with feature checklists, annual discount calculations, alternative service cards -- this is spreadsheet-class data that deserves a wide screen
4. **Calendar planning** -- a full month grid showing which days hit your card and how much. Hovering a day shows the subscriptions. This is a financial planning tool

**Status quo competitors on web:** Rocket Money (requires bank access, subscription pricing), Trim (acquired, deprecated), spreadsheets (no analysis, no reminders). MySubs wedge: private, on-device, one-time purchase, with the analysis depth of a paid service.

### Phase 2: Engineering Review

**Module surface area (verified from `modules/subs/src/index.ts`):**

- **CRUD operations (26):** createSubscription, getSubscription, listSubscriptions, updateSubscription, deleteSubscription, getSubscriptionCount, listCategories, createCategory, deleteCategory, getPriceHistory, addPriceChange, getUpcomingRenewals, generateRenewalEvents, markRenewalPaid, getRenewalEvents, logCancellationAction, getCancellationHistory, listAlternatives, addAlternative, deleteAlternative, searchCatalog, getCatalogByCategory, getAllCatalogEntries, getTotalMonthlyCost, getTotalAnnualCost, getCostByCategory
- **Cost Analysis Engine (5):** getCostSummary, getCategoryBreakdown, getCycleBreakdown, getPriceChanges, getSpendingProjection
- **Renewal Calendar Engine (4):** getCalendarMonth, getAgendaView, getRenewalSummary, getDueNotifications
- **Cancellation Assist Engine (4):** scoreSubscription, getOpportunities, shouldShowOpportunity, calculateTotalSavings
- **Price Comparison Engine (3):** matchToCatalog, getComparison, getComparisonSummary
- **Normalization (2):** normalizeToMonthlyCents, normalizeToAnnualCents
- **Total: 44 exported functions + 30 exported types**

**Schema (v1, prefix `sb_`):**
- 7 tables: `sb_categories`, `sb_subscriptions`, `sb_price_history`, `sb_renewal_events`, `sb_cancellation_actions`, `sb_price_alternatives`, `sb_catalog`
- 15 indexes including a unique constraint on `(subscription_id, renewal_date)` for renewal dedup
- 10 seed categories (Streaming, Music, Cloud Storage, Productivity, Gaming, News & Media, Health & Fitness, Education, Shopping, Other)
- Built-in alternatives catalog: 10 services (Netflix, Spotify, Adobe CC, Microsoft 365, iCloud, YouTube Premium, Amazon Prime, ChatGPT, Hulu, Disney+) with tier data and competitor alternatives

**CRUD completeness:** All planned features have backing CRUD operations. No gaps found. The module has complete support for:
- Full subscription lifecycle (create, read, update, delete, status transitions)
- Category management (CRUD + seed data)
- Price history tracking (automatic on cost update + manual addPriceChange)
- Renewal event generation and lifecycle (generate future events, mark paid, query by date range)
- Cancellation assist with cooldown state machine (dismissed/reminded/kept cooldown periods)
- Price alternatives (user-added + catalog-matched)
- Catalog search (name + search_terms fuzzy match)

**New server actions needed (`apps/web/app/subs/actions.ts`):**

```typescript
// Subscription CRUD
fetchSubscriptions(filter?), fetchSubscription(id), doCreateSubscription(input),
doUpdateSubscription(id, input), doDeleteSubscription(id), fetchSubscriptionCount(status?)

// Categories
fetchCategories(), doCreateCategory(input), doDeleteCategory(id)

// Price History
fetchPriceHistory(subscriptionId), doAddPriceChange(subscriptionId, oldCents, newCents, notes?)

// Renewal Events
fetchUpcomingRenewals(daysAhead), doGenerateRenewalEvents(subscriptionId, monthsAhead?),
doMarkRenewalPaid(eventId), fetchRenewalEvents(subscriptionId)

// Cancellation Actions
doLogCancellationAction(input), fetchCancellationHistory(subscriptionId)

// Alternatives
fetchAlternatives(subscriptionId), doAddAlternative(input), doDeleteAlternative(id)

// Catalog
searchCatalogAction(query), fetchCatalogByCategory(categoryId), fetchAllCatalog()

// Engines -- Cost Analysis
fetchCostSummary(), fetchCategoryBreakdown(), fetchCycleBreakdown(),
fetchPriceChanges(), fetchSpendingProjection()

// Engines -- Renewal Calendar
fetchCalendarMonth(year, month), fetchAgendaView(daysAhead),
fetchRenewalSummary(), fetchDueNotifications()

// Engines -- Cancellation Assist
fetchOpportunities(threshold?), fetchTotalSavings(year?)

// Engines -- Price Comparison
fetchComparison(subscriptionId), fetchComparisonSummary()
```

**Data flow:** Server actions pattern (same as Books):
1. `actions.ts` exports `'use server'` functions
2. Each calls `getAdapter()` + `ensureModuleMigrations('subs')`
3. Delegates to `@mylife/subs` CRUD/engine functions
4. Client components call server actions via `useEffect` or event handlers
5. All server action calls in client components wrapped in try/catch/finally to prevent stuck loading states (per feedback memory: `feedback_web_error_handling.md`)

**State management:** Local `useState` per page. No global state store. Filter/sort state persisted in URL search params where appropriate (e.g., `/subs?status=active&sort=cost`). No React context needed beyond what the hub provides.

**Route structure (Next.js App Router):**

```
apps/web/app/subs/
  layout.tsx              # Module shell: header (MySubs branding, nav links), max-width container
  page.tsx                # Cost Command Center dashboard
  actions.ts              # All server actions wrapping @mylife/subs
  ui.ts                   # Shared formatting utilities (formatCurrency, formatCycle, etc.)
  calendar/
    page.tsx              # Full month calendar + agenda view
  insights/
    page.tsx              # Cost analysis: category donut, cycle breakdown, price changes, projections
  catalog/
    page.tsx              # Browse/search subscription catalog, add from catalog
  [id]/
    page.tsx              # Subscription detail: info, price history, renewal timeline, alternatives
  compare/
    page.tsx              # Price comparison hub: all subs with savings opportunities
  __tests__/
    dashboard-page.test.tsx
    calendar-page.test.tsx
    insights-page.test.tsx
    catalog-page.test.tsx
    sub-detail-page.test.tsx
    compare-page.test.tsx
```

### Phase 3: Design Review

| Dimension | Score | Notes |
|-----------|-------|-------|
| Information Architecture | 9/10 | Dashboard -> drill-down. 6 routes cover full subscription lifecycle. |
| Desktop-Optimized Layout | 10/10 | Multi-panel dashboard, wide data tables, side-by-side comparison panels. |
| Keyboard Navigation | 8/10 | `N` new, `Cmd+K` search catalog, column header sort, tab through table rows. |
| Visual Density | 9/10 | Linear/Raycast aesthetic. Compact subscription rows with category color dots. |
| Cool Obsidian Compliance | 10/10 | All glass tokens, emerald accent (#10B981), backdrop blur, dark surfaces. |
| 5 States Coverage | 10/10 | All 6 pages have loading (skeleton), empty (warm CTA), error (retry), success, partial states. |
| Typography | 9/10 | Inter for chrome. SF Mono / JetBrains Mono for currency amounts per DESIGN.md. |
| Motion | 8/10 | 200ms transitions, stagger on subscription cards, smooth filter transitions. |
| **Overall** | **9.1/10** | |

**5 States per page:**

| Page | Loading | Empty | Error | Success | Partial |
|------|---------|-------|-------|---------|---------|
| Dashboard | 3 skeleton stat cards + 4 skeleton table rows | "Start tracking your subscriptions" + CTA to catalog | "Couldn't load your subscriptions" + retry | Full dashboard with stats + table + opportunities | Stats loaded but opportunities still fetching |
| Calendar | Skeleton month grid + 2 agenda skeletons | "No renewals this month" | "Couldn't load calendar" + retry | Full month grid + agenda sidebar | Month loaded, renewal details still fetching |
| Insights | 3 skeleton chart cards | "Add subscriptions to see spending insights" | "Couldn't load analytics" + retry | Donut chart + cycle breakdown + price changes | Category chart loaded, projections still fetching |
| Catalog | Search bar + 6 skeleton category rows | "The catalog is empty" (should not happen with seed data) | "Couldn't load catalog" + retry | Category-grouped catalog grid | Search results loaded, categories still loading |
| Sub Detail | Skeleton header + 3 skeleton sections | N/A (404 if no sub found) | "Couldn't load subscription" + retry | Full detail with history + renewals + alternatives | Core info loaded, comparison still fetching |
| Compare | 4 skeleton comparison cards | "Add subscriptions to compare prices" | "Couldn't load comparisons" + retry | Full comparison grid with savings summary | Summary loaded, individual comparisons still fetching |

### Phase 4: Design Consultation

**Accent color:** `#10B981` (emerald) -- from `modules/subs/src/definition.ts`. Financial, trustworthy, distinct from Budget's `#22C55E` green. Used for: header title, active nav links, primary CTA buttons, category accent borders, stat highlights.

**Derived palette:**
| Token | Value | Usage |
|-------|-------|-------|
| `accent` | `#10B981` | Primary actions, active states, hero stats |
| `accentDim` | `rgba(16,185,129,0.15)` | Hero section background, stat card tint |
| `accentBorder` | `rgba(16,185,129,0.25)` | Hero section border, active filter pill |
| `danger` | `#FF453A` | Cancel actions, cost increase indicators |
| `success` | `#30D158` | Savings amounts, downgrade opportunities |
| `warning` | `#FFD60A` | Trial expiring soon, upcoming renewals |

**Icons (Lucide, hub-consistent):**
| Context | Icon |
|---------|------|
| Dashboard nav | `credit-card` |
| Subscriptions | `list` |
| Calendar | `calendar` |
| Insights | `bar-chart-3` |
| Catalog | `search` |
| Compare | `scale` |
| Add subscription | `plus` |
| Status: active | `circle-check` (green) |
| Status: paused | `pause-circle` (yellow) |
| Status: cancelled | `x-circle` (red) |
| Status: trial | `clock` (cyan) |
| Price increase | `trending-up` (red) |
| Price decrease | `trending-down` (green) |
| Category dot | Filled circle in category color |

**Information density:** High by default (Linear aesthetic). Compact subscription rows: category color dot + name + billing cycle badge + monthly cost + next renewal date + status indicator. Each row is 44px tall (touch target minimum). Table headers are sortable. Filter pills above the table: All / Active / Paused / Cancelled / Trial.

**Currency formatting:**
- All amounts stored as integer cents
- Display helper: `formatCurrency(cents)` -> `$12.99` (negative: `-$12.99`)
- Monthly/annual toggle on dashboard: `$187.42/mo` or `$2,249.04/yr`
- Savings shown in green: `Save $4.50/mo`
- Cost increases in red: `+$2.00/mo (+15%)`

**Component reuse from `packages/ui/`:** `colors` tokens, `spacing` tokens, glass card pattern, skeleton components. Module-specific components built inline (not extracted to ui package unless reused by 2+ modules).

**Reuse from Books reference:**
- `layout.tsx`: Same header structure (module title + tagline + nav links + content area)
- `actions.ts`: Same `db()` helper pattern with `getAdapter()` + `ensureModuleMigrations('subs')`
- `page.tsx`: Same fetch-in-useEffect pattern with cancelled flag
- `ui.ts`: Same pattern for shared formatting utilities

---

## 3. Route Structure

### 3.1 `layout.tsx` -- Module Shell

```
+------------------------------------------------------------------+
|  MySubs                             Dashboard  Calendar  Insights  |
|  Track your subscription costs      Catalog  Compare               |
+------------------------------------------------------------------+
|  {children}                                                        |
+------------------------------------------------------------------+
```

- Module title: "MySubs" in emerald accent, 30px, weight 800
- Tagline: "Track your subscription costs inside MyLife." in textSecondary, 14px
- Nav links: 5 links (Dashboard, Calendar, Insights, Catalog, Compare), textSecondary, 14px, weight 600
- Content area: max-width 1120px, 32px padding
- Header: glass background with backdrop blur, border-bottom

### 3.2 `page.tsx` -- Cost Command Center (Dashboard)

The hero screen. Everything a user needs to understand their subscription portfolio in one view.

```
+------------------------------------------------------------------+
|  HERO SECTION (accentDim background, accentBorder)                |
|                                                                    |
|  $187.42/month                   [+ Add Subscription]              |
|  $2,249.04/year  |  $6.25/day   Status: 14 active, 2 paused       |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  FILTER PILLS                                                      |
|  [All (16)] [Active (14)] [Paused (2)] [Cancelled (3)] [Trial (1)] |
|  Sort: [Cost v] [Name] [Renewal] [Created]                         |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  SUBSCRIPTION TABLE                                                |
|  +------+-------------------+----------+--------+----------+------+|
|  | Cat. | Name              | Cost     | Cycle  | Renewal  | Stat ||
|  +------+-------------------+----------+--------+----------+------+|
|  | [r]  | Netflix           | $15.49   | mo     | Mar 25   | [ok] ||
|  | [g]  | Spotify           | $10.99   | mo     | Apr 1    | [ok] ||
|  | [b]  | iCloud+           |  $2.99   | mo     | Mar 28   | [ok] ||
|  | [o]  | Adobe CC          | $54.99   | mo     | Apr 3    | [ok] ||
|  | [p]  | ChatGPT Plus      | $20.00   | mo     | Mar 30   | [ok] ||
|  +------+-------------------+----------+--------+----------+------+|
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  SAVINGS OPPORTUNITIES (glass card)                                |
|  You could save $43.50/month ($522/year)                           |
|  +-- Netflix: Switch to Standard with Ads (-$8.50/mo) -----------+|
|  +-- Adobe CC: Switch to Photography Plan (-$45.00/mo) ----------+|
|  +-- Spotify: Trial expiring in 3 days ---------------------------+|
|                                                                    |
+------------------------------------------------------------------+
```

**Data sources:**
- Hero stats: `getCostSummary()` -> totalMonthlyCents, totalAnnualCents, activeCount, pausedCount
- Filter pills: `getSubscriptionCount(status)` for each status
- Subscription table: `listSubscriptions(filter)` with filter from URL params
- Savings section: `getOpportunities(40)` + `getComparisonSummary()`

**Interactions:**
- Click subscription row -> navigate to `/subs/[id]`
- Click "Add Subscription" -> navigate to `/subs/catalog`
- Click filter pill -> update URL params, re-fetch
- Click column header -> toggle sort direction, re-fetch
- Monthly/annual toggle on hero stats -> local state

### 3.3 `calendar/page.tsx` -- Renewal Calendar

Two-panel layout: month grid on left, agenda list on right.

```
+------------------------------------------------------------------+
|  Renewal Calendar                                                  |
+------------------------------------------------------------------+
|                                                                    |
|  +--- MONTH GRID (60%) -----+  +--- AGENDA (40%) ---------------+|
|  |      March 2026           |  |  This Month: $187.42            ||
|  |  [<]             [>]      |  |  Next Month: $192.41            ||
|  |  Su Mo Tu We Th Fr Sa     |  |                                 ||
|  |                      1    |  |  Mar 25 (Today)                 ||
|  |   2  3  4  5  6  7  8    |  |  +-- Netflix -- $15.49 --------+||
|  |   9 10 11 12 13 14 15    |  |  +-- Adobe CC -- $54.99 -------+||
|  |  16 17 18 19 20 21 22    |  |                                 ||
|  |  23 24 *25 26 27 28      |  |  Mar 28                         ||
|  |  29 30 31                 |  |  +-- iCloud+ -- $2.99 ---------+||
|  |                           |  |                                 ||
|  |  * = has renewals (dot)   |  |  Mar 30                         ||
|  |  Click date to see detail |  |  +-- ChatGPT Plus -- $20.00 ---+||
|  +---------------------------+  +---------------------------------+|
|                                                                    |
+------------------------------------------------------------------+
```

**Data sources:**
- Month grid: `getCalendarMonth(year, month)` -> days with renewal items
- Agenda: `getAgendaView(30)` for next 30 days, or filter to selected date
- Summary: `getRenewalSummary()` -> thisMonth, nextMonth, thisYear

**Interactions:**
- Click date in grid -> filter agenda to that date's renewals
- Click `<`/`>` -> navigate months (local state, re-fetch)
- Click subscription in agenda -> navigate to `/subs/[id]`
- Renewal dots color-coded by category (`categoryColor` from RenewalItem)

### 3.4 `insights/page.tsx` -- Cost Analytics

Data visualization page with 4 chart/analysis sections.

```
+------------------------------------------------------------------+
|  Spending Insights                                                 |
+------------------------------------------------------------------+
|                                                                    |
|  +--- CATEGORY DONUT (50%) ------+  +--- CYCLE BREAKDOWN (50%) -+|
|  |                                |  |                            ||
|  |      [Donut Chart]             |  |  Monthly:    $142 (76%)   ||
|  |   $187.42/mo total             |  |  Yearly:      $35 (19%)   ||
|  |                                |  |  Quarterly:    $10 (5%)    ||
|  |  Streaming:  $42 (22%)         |  |  Weekly:       $0 (0%)     ||
|  |  Productivity: $55 (29%)       |  |  Lifetime:     -- (0%)     ||
|  |  Cloud:      $12 (6%)          |  |                            ||
|  |  Gaming:     $15 (8%)          |  |                            ||
|  |  Other:      $63 (34%)         |  |                            ||
|  +--------------------------------+  +----------------------------+|
|                                                                    |
|  +--- PRICE CHANGES (100%) --------------------------------------+|
|  |  Subscriptions with price increases                            ||
|  |  +-- Netflix: $13.99 -> $15.49 (+11%) -- Oct 2024 -----------+||
|  |  +-- YouTube Premium: $11.99 -> $13.99 (+17%) -- Jun 2024 ---+||
|  +----------------------------------------------------------------+|
|                                                                    |
|  +--- SPENDING PROJECTION (100%) --------------------------------+|
|  |  Next 30 days: $187    Next 90 days: $562    Next 12 months: $2,249 |
|  +----------------------------------------------------------------+|
|                                                                    |
|  +--- SAVINGS SUMMARY (100%) ------------------------------------+|
|  |  This year you've saved $129 by cancelling 3 subs              ||
|  |  and downgrading 1 sub                                         ||
|  +----------------------------------------------------------------+|
|                                                                    |
+------------------------------------------------------------------+
```

**Data sources:**
- Category donut: `getCategoryBreakdown()` -> array of {categoryName, monthlyCents, percentage, categoryColor}
- Cycle breakdown: `getCycleBreakdown()` -> array of {cycle, count, totalMonthlyCents, percentage}
- Price changes: `getPriceChanges()` -> array of {subscriptionName, currentCostCents, originalCostCents, changes, direction}
- Projections: `getSpendingProjection()` -> {next30DaysCents, next90DaysCents, next12MonthsCents}
- Savings: `calculateTotalSavings(year)` -> {totalCents, cancelledCount, downgradedCount}

**Chart implementation:** Pure CSS/HTML for v1 (donut via conic-gradient, bars via flex widths). No charting library dependency. Category colors from the categories table.

### 3.5 `catalog/page.tsx` -- Subscription Catalog

Browse and search the pre-populated catalog to quickly add subscriptions.

```
+------------------------------------------------------------------+
|  Add Subscription                                                  |
+------------------------------------------------------------------+
|                                                                    |
|  [Search subscriptions...                              ]           |
|                                                                    |
|  POPULAR                                                           |
|  [Netflix] [Spotify] [Apple Music] [Disney+] [ChatGPT] [iCloud+] |
|                                                                    |
|  -- or add a custom subscription --                                |
|  [+ Add Custom Subscription]                                       |
|                                                                    |
|  STREAMING                                                         |
|  +-- Netflix -- $15.49/mo ----+  +-- Disney+ -- $7.99/mo --------+|
|  +-- Hulu -- $7.99/mo --------+  +-- HBO Max -- $15.99/mo -------+|
|                                                                    |
|  MUSIC                                                             |
|  +-- Spotify -- $10.99/mo ----+  +-- Apple Music -- $10.99/mo ---+|
|                                                                    |
|  PRODUCTIVITY                                                      |
|  +-- Microsoft 365 -- $6.99/mo+  +-- Notion -- $10.00/mo --------+|
|                                                                    |
+------------------------------------------------------------------+
```

**Data sources:**
- Search: `searchCatalog(query)` (fuzzy match on name + search_terms)
- Category groups: `getCatalogByCategory(categoryId)` for each category
- All entries: `getAllCatalogEntries()` sorted by popularity_rank
- Categories: `listCategories()` for section headers

**Interactions:**
- Type in search bar -> real-time filter (debounced 200ms)
- Click catalog entry -> open pre-filled "Add Subscription" modal/inline form
- User can override name, cost, billing cycle, start date, notes
- "Add Custom" -> open blank form
- After adding -> navigate to `/subs/[id]` or back to dashboard

**Add Subscription form fields:**
- Name (required, pre-filled from catalog)
- Cost (required, in dollars, stored as cents)
- Billing Cycle (select: weekly/monthly/quarterly/yearly/lifetime)
- Category (select from existing categories)
- Start Date (date picker, defaults to today)
- Status (select: active/trial, defaults to active)
- Trial End Date (date picker, shown only when status=trial)
- URL (optional, pre-filled from catalog)
- Notes (optional textarea)
- Notification: enabled toggle + days-before number input (default: 3)

### 3.6 `[id]/page.tsx` -- Subscription Detail

Deep-dive view for a single subscription.

```
+------------------------------------------------------------------+
|  <- Back to Dashboard                          [Edit] [Delete]     |
+------------------------------------------------------------------+
|                                                                    |
|  SUBSCRIPTION HEADER (accentDim card)                              |
|  +----------------------------------------------------------------+|
|  |  [Icon]  Netflix                                               ||
|  |          $15.49/month  |  Streaming  |  Active                 ||
|  |          Next renewal: Mar 25, 2026 (in 3 days)                ||
|  |          Started: Jan 15, 2024  |  Lifetime cost: ~$390        ||
|  |                                                                ||
|  |  [Pause]  [Cancel]                                             ||
|  +----------------------------------------------------------------+|
|                                                                    |
|  +--- PRICE HISTORY (50%) -------+  +--- RENEWAL EVENTS (50%) --+|
|  |  $15.49 -- since Oct 2024     |  |  Mar 25, 2026 -- $15.49   ||
|  |  $13.99 -- Jan - Oct 2024     |  |  Apr 25, 2026 -- $15.49   ||
|  |                                |  |  May 25, 2026 -- $15.49   ||
|  |  Total increase: +$1.50 (+11%)|  |  Jun 25, 2026 -- $15.49   ||
|  +--------------------------------+  |  Jul 25, 2026 -- $15.49   ||
|                                      +----------------------------+|
|                                                                    |
|  +--- PRICE COMPARISON (100%) -----------------------------------+|
|  |  Cheaper Tiers                                                 ||
|  |  +-- Standard with Ads: $6.99/mo (save $8.50/mo, -55%) ------+||
|  |                                                                ||
|  |  Alternatives                                                  ||
|  |  +-- Hulu: $7.99/mo (save $7.50/mo) -------------------------+||
|  |  +-- Disney+: $7.99/mo (save $7.50/mo) ----------------------+||
|  |  +-- Tubi: FREE (save $15.49/mo) ----------------------------+||
|  |                                                                ||
|  |  User-Added Alternatives                                       ||
|  |  [+ Add Alternative]                                           ||
|  +----------------------------------------------------------------+|
|                                                                    |
|  +--- CANCELLATION HISTORY (100%) --------------------------------+|
|  |  No cancellation actions yet                                    ||
|  +----------------------------------------------------------------+|
|                                                                    |
+------------------------------------------------------------------+
```

**Data sources:**
- Subscription: `getSubscription(id)`
- Price history: `getPriceHistory(id)`
- Renewal events: `getRenewalEvents(id)` (or `generateRenewalEvents(id, 12)` if none exist)
- Comparison: `getComparison(id)` -> cheaperTiers, annualSavings, alternatives, userAlternatives
- Cancellation history: `getCancellationHistory(id)`

**Interactions:**
- Edit -> inline editing mode (name, cost, cycle, category, notes, notification settings)
- Pause -> `updateSubscription(id, { status: 'paused' })`, show confirmation
- Cancel -> `updateSubscription(id, { status: 'cancelled' })` + `logCancellationAction(...)`, show confirmation
- Delete -> `deleteSubscription(id)` with destructive confirmation dialog
- "Add Alternative" -> inline form for user-added alternative
- Back -> navigate to `/subs`

### 3.7 `compare/page.tsx` -- Price Comparison Hub

Overview of all savings opportunities across all subscriptions.

```
+------------------------------------------------------------------+
|  Price Comparison                                                  |
+------------------------------------------------------------------+
|                                                                    |
|  SAVINGS SUMMARY (accentDim card)                                  |
|  You could save up to $89.50/month ($1,074/year)                   |
|  Opportunities found for 6 of 14 subscriptions                     |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  OPPORTUNITY CARDS                                                 |
|                                                                    |
|  +--- Netflix ------------------+  +--- Adobe CC ----------------+|
|  |  Current: $15.49/mo          |  |  Current: $54.99/mo         ||
|  |  Best option: $6.99/mo       |  |  Best option: $9.99/mo      ||
|  |  Save: $8.50/mo ($102/yr)    |  |  Save: $45.00/mo ($540/yr)  ||
|  |  Priority: HIGH              |  |  Priority: HIGH             ||
|  |  [View Details]              |  |  [View Details]             ||
|  +-------------------------------+  +----------------------------+|
|                                                                    |
|  +--- Spotify ------------------+  +--- YouTube Premium ----------+|
|  |  Current: $10.99/mo          |  |  Current: $13.99/mo          ||
|  |  Free tier available         |  |  Annual: save $27.89/yr      ||
|  |  Priority: MEDIUM            |  |  Priority: MEDIUM            ||
|  |  [View Details]              |  |  [View Details]              ||
|  +-------------------------------+  +-----------------------------+|
|                                                                    |
+------------------------------------------------------------------+
```

**Data sources:**
- Summary: `getComparisonSummary()` -> totalMonthlySavingsCents, subscriptionsWithSavings, topOpportunity
- Opportunities: `getOpportunities(40)` -> scored and sorted
- Per-sub comparison: `getComparison(id)` for each opportunity

**Interactions:**
- "View Details" -> navigate to `/subs/[id]` which has the full comparison panel
- Cards sorted by totalScore descending (highest savings first)
- Priority badges: HIGH (red/urgent) for score >= 60, MEDIUM (yellow) for score >= 40

---

## 4. Component Inventory

| Component | Location | Description |
|-----------|----------|-------------|
| `SubsLayout` | `layout.tsx` | Module shell: header + nav + content area |
| `CostHero` | `page.tsx` (inline) | Hero section with monthly/annual/daily stats |
| `SubscriptionTable` | `page.tsx` (inline) | Sortable, filterable subscription data table |
| `FilterPills` | `page.tsx` (inline) | Status filter pill row (All/Active/Paused/Cancelled/Trial) |
| `CalendarGrid` | `calendar/page.tsx` (inline) | Month grid with renewal dot indicators |
| `AgendaList` | `calendar/page.tsx` (inline) | Date-grouped list of upcoming renewals |
| `CategoryDonut` | `insights/page.tsx` (inline) | CSS conic-gradient donut chart |
| `CycleBreakdownList` | `insights/page.tsx` (inline) | Billing cycle distribution bars |
| `PriceChangesList` | `insights/page.tsx` (inline) | Subscriptions with price change history |
| `CatalogSearch` | `catalog/page.tsx` (inline) | Search bar + category-grouped catalog grid |
| `AddSubscriptionForm` | `catalog/page.tsx` (inline) | Form for adding new subscription (from catalog or custom) |
| `SubDetailHeader` | `[id]/page.tsx` (inline) | Subscription info card with status actions |
| `PriceHistoryTimeline` | `[id]/page.tsx` (inline) | Chronological price change list |
| `RenewalTimeline` | `[id]/page.tsx` (inline) | Future renewal dates list |
| `ComparisonPanel` | `[id]/page.tsx` (inline) | Tier comparison + alternatives + user alternatives |
| `OpportunityCard` | `compare/page.tsx` (inline) | Savings opportunity card for one subscription |

All components are inline (page-local). Extract to shared files only if reused across 2+ pages within the module.

---

## 5. Formatting Utilities (`ui.ts`)

```typescript
/** Format cents as dollars: 1549 -> "$15.49" */
export function formatCurrency(cents: number): string;

/** Format billing cycle label: "monthly" -> "mo", "yearly" -> "yr" */
export function formatCycleShort(cycle: BillingCycle): string;

/** Format billing cycle label: "monthly" -> "Monthly", "yearly" -> "Yearly" */
export function formatCycleFull(cycle: BillingCycle): string;

/** Format relative date: "2026-03-25" -> "in 3 days" or "2 days ago" */
export function formatRelativeDate(dateStr: string): string;

/** Format date: "2026-03-25" -> "Mar 25, 2026" */
export function formatDate(dateStr: string): string;

/** Format percentage change: (1549, 1399) -> "+$1.50 (+11%)" */
export function formatPriceChange(newCents: number, oldCents: number): string;

/** Status display config: color, icon, label */
export function getStatusConfig(status: SubscriptionStatus): { color: string; icon: string; label: string };
```

---

## 6. Test Plan

### Unit Tests (per page)

| Test File | Key Test Cases |
|-----------|---------------|
| `dashboard-page.test.tsx` | Renders hero stats correctly; filters by status; sorts by column; shows empty state; handles loading state; shows opportunities; formats currency correctly |
| `calendar-page.test.tsx` | Renders month grid; shows renewal dots on correct dates; navigates months; shows agenda for selected date; handles empty month |
| `insights-page.test.tsx` | Renders category breakdown; renders cycle breakdown; shows price changes; shows projection; shows savings summary; handles empty data |
| `catalog-page.test.tsx` | Renders catalog entries; search filters results; add from catalog pre-fills form; add custom opens blank form; validates required fields |
| `sub-detail-page.test.tsx` | Renders subscription info; shows price history; shows renewal timeline; shows comparison data; pause/cancel actions work; handles not-found |
| `compare-page.test.tsx` | Renders savings summary; shows opportunity cards; sorts by score; navigates to detail; handles no opportunities |

### Integration Tests

- Add subscription from catalog -> verify appears in dashboard table
- Update subscription cost -> verify price history created
- Cancel subscription -> verify excluded from cost summary
- Generate renewal events -> verify appear in calendar

---

## 7. QA Checklist

- [ ] Dashboard loads with correct monthly/annual/daily stats
- [ ] Filter pills correctly filter the subscription table
- [ ] Column headers sort the table (ascending/descending toggle)
- [ ] "Add Subscription" navigates to catalog
- [ ] Calendar shows renewal dots on correct dates
- [ ] Calendar month navigation works (prev/next)
- [ ] Clicking a calendar date filters the agenda
- [ ] Insights donut chart renders with correct category proportions
- [ ] Price changes list shows subscriptions with history
- [ ] Catalog search returns results in real-time
- [ ] Adding from catalog pre-fills the form correctly
- [ ] Custom subscription form validates required fields
- [ ] Subscription detail shows all sections (info, history, renewals, comparison)
- [ ] Pause action updates status and excludes from cost totals
- [ ] Cancel action logs cancellation and updates status
- [ ] Delete action removes subscription with confirmation
- [ ] Compare page shows savings opportunities sorted by score
- [ ] All pages handle loading state (skeletons)
- [ ] All pages handle empty state (warm CTA)
- [ ] All pages handle error state (retry button)
- [ ] Server action calls wrapped in try/catch/finally (no stuck loading)
- [ ] Currency amounts display correctly (dollars, not cents)
- [ ] Cool Obsidian tokens used throughout (no hardcoded colors)
- [ ] Responsive: content readable at 768px+ width
- [ ] All interactive elements have 44px minimum touch targets
- [ ] No em dashes in any text content

---

## 8. Implementation Notes

### Module Registration (Already Done)
The subs module (`SUBS_MODULE`) is already defined in `modules/subs/src/definition.ts` with:
- id: `subs`, name: `MySubs`, accent: `#10B981`, tier: `premium`
- Navigation: 4 tabs (Dashboard, Subs, Calendar, Settings) + 6 screens

The module needs to be imported and registered in `apps/web/` for web routing. Follow the Books pattern: import in `apps/web/lib/db.ts` and add to the module list.

### Renewal Event Pre-generation
The calendar and agenda views depend on `sb_renewal_events` rows existing. On first load of the calendar page, call `generateRenewalEvents(subscriptionId, 12)` for each active subscription to populate the next 12 months of events. This is idempotent (uses `INSERT OR IGNORE` with a unique index on `(subscription_id, renewal_date)`).

### Price Comparison Catalog
The `ALTERNATIVES_DATA` in `engines/alternatives-catalog.ts` covers 10 popular services with tier data and alternatives. The `getComparison()` function uses fuzzy name matching to link user subscriptions to catalog entries. Subscriptions not matched to the catalog will show only user-added alternatives.

### No New Schema Needed
All 7 tables and 15 indexes in schema v1 fully support the planned web UI. No schema migrations required.

### No New Engine Functions Needed
All 44 exported functions across the 4 engines and CRUD layer cover every planned feature. The web UI is a pure presentation layer over existing business logic.
