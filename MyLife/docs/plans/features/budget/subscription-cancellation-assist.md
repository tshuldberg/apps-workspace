# Feature Spec: Subscription Cancellation Assist

## Metadata
- **Module:** budget
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 1 x2 + CrossModule 3 x1 + PaidUser 5 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (subscription system already built with CRUD, catalog, price history, notifications)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Rocket Money (formerly Truebill) built a $100M+ business primarily on one feature: helping users cancel subscriptions they forgot about or no longer use. They charge $48-144/yr and their cancellation concierge is the #1 selling point. The average American has 12 subscriptions and wastes $133/month on unused ones (C+R Research, 2022). MyLife already tracks subscriptions with a 215-entry catalog, price history, renewal dates, and cost normalization. Adding cancellation assist turns passive subscription tracking into active money-saving, which is the highest-impact user-facing improvement for paid-user conversion. This feature does NOT negotiate bills (Rocket Money's premium service); it helps users identify waste and take action.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Rocket Money | Yes | Yes ($48-144/yr) | Full concierge: identifies unused subs, negotiates bills, cancels on user's behalf (requires account access). Premium tier ($14.99/mo) includes negotiation. |
| YNAB | No | N/A | No subscription tracking at all. Users manually categorize sub payments. |
| Monarch Money | Partial | Yes ($99.99/yr) | Detects recurring charges and shows them as "recurring" in transactions. No cancellation workflow. |
| Copilot | Partial | Yes ($119.88/yr) | Shows recurring bills. No cancellation assist. |
| PocketGuard | Partial | Yes ($74.99/yr) | Basic subscription detection. No cancellation workflow. |

### Target User
Rocket Money users paying $48-144/yr who want subscription cleanup without giving a third party access to their bank accounts. Also any budget user who knows they're paying for things they don't use but hasn't gotten around to cancelling. Migration path: Rocket Money user realizes they can cancel subs themselves with good tooling, without paying Rocket Money's fee or giving them bank login credentials.

## Technical Context

### Where This Lives in MyLife

```
modules/budget/src/
  subscriptions/
    cancellation-assist.ts    -- NEW: Waste detection engine, cancellation workflow
    __tests__/
      cancellation-assist.test.ts -- NEW: Engine tests
  db/
    schema.ts                  -- MODIFY: Add bg_cancellation_actions table
    crud.ts                    -- No change (uses existing subscription CRUD)
  types.ts                     -- MODIFY: Add cancellation-related Zod schemas
  definition.ts                -- MODIFY: Add V5 migration (or extend existing V5)
  index.ts                     -- MODIFY: Export cancellation-assist
apps/mobile/app/(budget)/
  subscriptions.tsx            -- MODIFY: Add "Savings Opportunities" section
  cancel-subscription.tsx      -- NEW: Cancellation detail/action screen
apps/web/app/budget/
  subscriptions/page.tsx       -- MODIFY: Add "Savings Opportunities" section
  actions.ts                   -- MODIFY: Add cancellation server actions
```

### Wireframe Position

```
Hub Dashboard
  └── MyBudget card
       ├── Budget tab
       ├── Transactions tab
       ├── Subscriptions tab    ← "Savings Opportunities" section at top
       │    └── [Cancel Sub detail screen]  ← Tap a suggestion to see cancellation guide
       ├── Reports tab
       └── Accounts tab
```

### Data Model

```sql
-- Cancellation actions log: tracks what the user did with each suggestion
CREATE TABLE IF NOT EXISTS bg_cancellation_actions (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES bg_subscriptions(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('dismissed', 'reminded', 'cancelled', 'downgraded', 'kept')),
  savings_amount INTEGER,
  notes TEXT,
  acted_on TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS bg_cancellation_actions_sub_idx
  ON bg_cancellation_actions(subscription_id);
CREATE INDEX IF NOT EXISTS bg_cancellation_actions_action_idx
  ON bg_cancellation_actions(action);
```

Existing tables used:
- `bg_subscriptions` -- name, price, billing_cycle, status, next_renewal, start_date, url, catalog_id
- `bg_price_history` -- historical price changes per subscription
- `bg_notification_log` -- renewal notifications

### Dependencies
- **Internal:** `@mylife/budget` (subscription CRUD, catalog, price history, cost normalization), `@mylife/db` (DatabaseAdapter)
- **External:** None. Cancellation links are opened via `Linking.openURL` (Expo) or `window.open` (web). No API calls to subscription services.
- **Cross-Module:** The subscription cost data feeds into the budget reports (spending analysis shows subscription portion). The cancellation savings could be surfaced on the hub dashboard as a "money saved" metric.

## Functional Requirements

### User Stories
1. As a budget user, I want to see which subscriptions I might be wasting money on so I can decide whether to keep or cancel them.
2. As a budget user, I want to see how much I'd save annually if I cancelled a suggested subscription so I can weigh the value.
3. As a budget user, I want a cancellation guide with a direct link to the subscription's cancellation page so I can act immediately.
4. As a budget user, I want to log my decision (cancel, keep, downgrade, remind me later) so the app stops suggesting things I've already reviewed.
5. As a budget user, I want to see my total savings from cancelled subscriptions so I feel good about the money I've recovered.
6. As a budget user, I want the app to detect price increases on my subscriptions so I can re-evaluate.

### Behavior Specification

**Waste detection engine:**
The engine scores each active subscription on a "cancellation opportunity" scale (0-100):

1. **Unused signal (0-40 points):**
   - No transactions to the subscription's payee in the last 90 days (beyond the renewal charge itself) = 40 points.
   - Subscription has been active > 12 months with no price changes = 10 points (long-running, possibly forgotten).
   - Trial subscription approaching end date = 30 points.

2. **Price increase signal (0-30 points):**
   - Price increased in the last 6 months = 20 points.
   - Price increased by >20% = 30 points.
   - Multiple price increases in history = 25 points.

3. **Cost signal (0-20 points):**
   - Monthly cost > $20 = 20 points.
   - Monthly cost > $10 = 10 points.
   - Monthly cost > $5 = 5 points.

4. **Duplicate signal (0-10 points):**
   - Another active subscription in the same catalog category = 10 points.
   - Example: Two streaming services, two cloud storage services.

Score >= 50: Show as "Savings Opportunity"
Score >= 70: Show as "High Priority" (flagged with accent indicator)

**Subscriptions tab -- "Savings Opportunities" section:**
1. At the top of the Subscriptions tab, a collapsible section shows opportunities sorted by score descending.
2. Each card shows: subscription name, icon, monthly cost, annual cost, opportunity score indicator (yellow/red), and reason text.
3. Below the section: "Total potential savings: $X/month ($Y/year)" summary.
4. If no opportunities are found (all subs are well-used and fairly priced), this section is hidden.

**Cancellation detail screen:**
1. User taps an opportunity card.
2. Detail screen shows:
   a. Subscription name, icon, current price.
   b. Price history chart (if price changes exist).
   c. Reason(s) this was flagged (bullet list).
   d. Annual cost: "$X/year" in large text.
   e. Cancellation instructions (from catalog if available, or generic "Visit [url] to manage your subscription").
   f. Direct link button: "Open [Service Name]" (opens subscription URL in browser).
   g. Action buttons: "I Cancelled It" | "I'll Keep It" | "Downgraded" | "Remind Me Later"

**Action logging:**
1. Each action is logged to `bg_cancellation_actions` with the subscription ID and action type.
2. "I Cancelled It": logs `cancelled`, updates subscription status to `cancelled`, records savings_amount (annualized cost).
3. "I'll Keep It": logs `kept`, removes from suggestions for 90 days.
4. "Downgraded": logs `downgraded`, prompts for new price, updates subscription price, records savings_amount (old - new annual).
5. "Remind Me Later": logs `reminded`, removes from suggestions for 30 days, schedules a follow-up notification.
6. "Dismissed" (swipe-dismiss on the card): logs `dismissed`, removes from suggestions for 60 days.

**Savings dashboard:**
1. At the bottom of the Subscriptions tab (or in the cancellation section header), show: "Saved $X this year by managing subscriptions."
2. Calculated from `bg_cancellation_actions` WHERE action IN ('cancelled', 'downgraded') AND acted_on is within the current year.
3. This number is a motivational metric, not precise accounting.

**Price increase alerts:**
1. When the `bg_price_history` table records a new price that is higher than the previous price, the subscription gets flagged in the waste detection engine.
2. On the cancellation detail screen, show a "Price increased" badge with the old and new price.

### Edge Cases

- **No subscriptions:** "Savings Opportunities" section is hidden entirely.
- **All subscriptions score < 50:** Section shows "All your subscriptions look good! No savings opportunities found." (collapsed by default).
- **Subscription has no URL:** Show generic instructions "Contact [name] customer support to cancel" instead of a direct link.
- **Subscription was manually added (no catalog_id):** Still score it based on cost and duration. Category deduplication not available.
- **User cancels and re-subscribes:** New subscription record. Old cancellation action stays in history. Savings calculation counts the cancelled period.
- **Free trial ending soon:** High opportunity score. Cancellation detail shows trial end date prominently.
- **Custom billing cycle:** Normalize to monthly/annual using the existing `normalizeToMonthly`/`normalizeToAnnual` functions.
- **Multiple price increases:** Show the full price history on the detail screen.
- **Subscription already cancelled:** Don't show in opportunities. Only show active, paused, or trial subscriptions.
- **"Remind Me Later" expires:** After 30 days, the subscription reappears in opportunities if it still scores >= 50.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Subscriptions tab shows a "Savings Opportunities" section when opportunities exist
- [ ] **AC-2:** Each opportunity card shows subscription name, monthly cost, annual cost, and reason
- [ ] **AC-3:** Opportunities are sorted by score descending (highest savings potential first)
- [ ] **AC-4:** Total potential savings summary shows monthly and annual amounts
- [ ] **AC-5:** Tapping an opportunity opens the cancellation detail screen
- [ ] **AC-6:** Detail screen shows price history, reasons, annual cost, and cancellation link
- [ ] **AC-7:** "Open [Service Name]" button opens the subscription URL in browser
- [ ] **AC-8:** "I Cancelled It" updates subscription status to cancelled and logs savings
- [ ] **AC-9:** "I'll Keep It" removes the subscription from suggestions for 90 days
- [ ] **AC-10:** "Remind Me Later" removes for 30 days and schedules follow-up
- [ ] **AC-11:** "Saved $X this year" metric shows correct total from cancellation actions
- [ ] **AC-12:** Price increase subscriptions show a "Price increased" badge
- [ ] **AC-13:** Section is hidden when no opportunities exist
- [ ] **AC-14:** Feature renders correctly on both mobile and web

### Technical Criteria
- [ ] **TC-1:** Waste detection engine scores subscriptions correctly based on the 4 signal categories
- [ ] **TC-2:** Score >= 50 threshold for showing opportunities is configurable
- [ ] **TC-3:** Cancellation actions are persisted to `bg_cancellation_actions`
- [ ] **TC-4:** "Remind Me Later" uses the acted_on timestamp + 30 days to determine re-show date
- [ ] **TC-5:** Savings calculation queries cancellation_actions WHERE action IN ('cancelled', 'downgraded') for current year
- [ ] **TC-6:** Cost normalization uses existing `normalizeToMonthly` and `normalizeToAnnual` functions
- [ ] **TC-7:** Duplicate detection queries active subscriptions by catalog category
- [ ] **TC-8:** V5 migration creates bg_cancellation_actions without affecting existing tables

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** The feature must NOT contact external services or APIs on behalf of the user
- [ ] **NC-2:** The feature must NOT auto-cancel subscriptions (user must take manual action)
- [ ] **NC-3:** Cancelled/inactive subscriptions must NOT appear in savings opportunities
- [ ] **NC-4:** Dismissed subscriptions must NOT reappear before their cooldown period expires
- [ ] **NC-5:** The feature must NOT modify subscription data except when the user explicitly takes an action

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Opportunity cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E` (budget green)
- High priority indicator: `#F97316` (orange) for score >= 70
- Standard indicator: `#F59E0B` (yellow) for score 50-69
- Savings amount: `#22C55E` (green) text
- Price increase badge: `#EF4444` (danger red) background pill

Layout -- Subscriptions tab with Savings Opportunities:
```
[Savings Opportunities]                    [collapse arrow]
  "You could save $47/mo ($564/yr)"        [summary]

  [Card: Netflix]
    Netflix  $22.99/mo ($275.88/yr)        [orange indicator]
    "Price increased 33% in 6 months"
    [Tap to review →]

  [Card: Adobe Creative Cloud]
    Adobe CC  $59.99/mo ($719.88/yr)       [yellow indicator]
    "Active for 18 months, high cost"
    [Tap to review →]

[Saved $180 this year]                     [motivational banner]

--- existing subscription list below ---
```

Cancellation detail screen:
```
[Header: Netflix]
  [Netflix icon]  Netflix
  $22.99/mo  •  $275.88/yr

[Price History Card]
  [line chart: $15.99 -> $19.99 -> $22.99]
  "Price increased 44% since you subscribed"

[Why We Flagged This]
  • Price increased 33% in the last 6 months
  • You also have Hulu and Disney+ (duplicate streaming)
  • Monthly cost exceeds $20

[Action Card]
  "Cancel Netflix and save $275.88/year"

  [Open Netflix]                   [opens URL]

  [I Cancelled It]  [I'll Keep It]
  [Downgraded]      [Remind Me Later]
```

### Web (Next.js)

- Route: `/budget/subscriptions` (existing page, extended)
- Same Cool Obsidian tokens via CSS variables
- Opportunities section at top, collapsible
- Detail view: modal or side panel (not a separate page)
- Responsive: cards stack on mobile, 2-column on desktop

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards for opportunities section | Initial subscription load |
| No subscriptions | Section hidden entirely | No subscriptions in the system |
| No opportunities | "All your subscriptions look good!" collapsed message | All subs score < 50 |
| Opportunities found | Scored cards sorted by priority | Subs score >= 50 |
| Detail view | Full cancellation guide with actions | User taps an opportunity |
| Action taken | Card removed with animation, savings updated | User taps an action button |
| All reviewed | Section collapses, savings banner prominent | All opportunities actioned |
| Error | "Could not analyze subscriptions" + retry | Engine computation fails |

## Test Requirements

### Unit Tests
- [ ] `scoreSubscription`: Active sub with price increase > 20% -> score includes 30 price-increase points
- [ ] `scoreSubscription`: Active sub > 12 months, no price changes -> 10 unused points
- [ ] `scoreSubscription`: Monthly cost $25 -> 20 cost points
- [ ] `scoreSubscription`: Two subs in same catalog category -> 10 duplicate points
- [ ] `scoreSubscription`: Trial ending in 3 days -> 30 trial points
- [ ] `scoreSubscription`: Cancelled subscription -> score 0 (excluded)
- [ ] `scoreSubscription`: Recently kept (< 90 days ago) -> excluded from results
- [ ] `scoreSubscription`: Recently reminded (< 30 days ago) -> excluded from results
- [ ] `getOpportunities`: Returns only subs with score >= threshold, sorted descending
- [ ] `getOpportunities`: Empty subscription list -> empty array
- [ ] `calculateTotalSavings`: 2 cancelled + 1 downgraded -> correct annual total
- [ ] `calculateTotalSavings`: No actions -> $0
- [ ] `logCancellationAction`: Creates record with correct fields
- [ ] `shouldShowOpportunity`: Returns false within cooldown period for each action type

### Integration Tests
- [ ] Full flow: add 3 subscriptions (one expensive + old, one with price increase, one cheap + new) -> 2 show as opportunities
- [ ] Cancellation flow: tap opportunity -> tap "I Cancelled It" -> subscription status updated, savings incremented
- [ ] Remind flow: tap "Remind Me Later" -> opportunity disappears -> wait 30+ days (mock) -> reappears
- [ ] Keep flow: tap "I'll Keep It" -> opportunity disappears for 90 days

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyBudget > Subscriptions tab
3. Add 3 subscriptions:
   - Netflix: $22.99/mo, start date 12 months ago, URL: netflix.com/account
   - Spotify: $10.99/mo, start date 6 months ago
   - Free trial service: $0/mo, trial_end_date = 3 days from now
4. Add a price increase for Netflix: old price $15.99, new price $22.99
5. Verify: "Savings Opportunities" section appears at top -- AC-1
6. Verify: Netflix shows with orange indicator and "Price increased" reason -- AC-2, AC-12
7. Verify: Trial service shows as opportunity (trial ending) -- AC-2
8. Verify: Opportunities sorted by score -- AC-3
9. Verify: Total potential savings shown -- AC-4
10. Tap Netflix opportunity
11. Verify: Detail screen shows price history, reasons, annual cost -- AC-5, AC-6
12. Verify: "Open Netflix" button exists -- AC-7
13. Tap "I Cancelled It"
14. Verify: Netflix status changes to cancelled, savings counter updates -- AC-8, AC-11
15. Navigate back to Subscriptions tab
16. Verify: Netflix no longer in opportunities
17. Tap trial service opportunity
18. Tap "Remind Me Later"
19. Verify: Opportunity disappears from list -- AC-10
20. Tap Spotify (if scored >= 50) or verify section shows fewer items
21. Tap "I'll Keep It"
22. Verify: Removed from suggestions -- AC-9
23. Verify: Section shows "All subscriptions look good" if none remain -- AC-13
24. Verify on web -- AC-14

## gstack Quality Gates

Based on Complexity score 1 (Complex), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Complex features (Complexity <= 1):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /budget/subscriptions, verify opportunity cards, tap through cancellation flow
- [ ] After 5 features in budget module: `/qa` on /budget

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the waste detection scoring engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- budget standalone is archived, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Full subscription system: 215-entry catalog, CRUD, price history, renewal engine, cost normalization, budget bridge, notifications.
- Subscription table (`bg_subscriptions`) with status, price, billing_cycle, next_renewal, start_date, url, catalog_id.
- Price history table (`bg_price_history`) tracking subscription price changes.
- Notification system for renewal reminders.
- Subscription discovery from bank sync data (`bank-sync/subscription-discovery.ts`).
- No waste detection. No cancellation workflow. No savings tracking.

### After This Work
- New engine: `modules/budget/src/subscriptions/cancellation-assist.ts` with `scoreSubscription`, `getOpportunities`, `calculateTotalSavings`, `logCancellationAction`.
- New table: `bg_cancellation_actions` tracking user decisions.
- Updated Subscriptions tab (mobile + web) with "Savings Opportunities" section.
- New cancellation detail screen (mobile) / modal (web).
- Savings counter showing year-to-date recovered money.

### Files Changed
- `modules/budget/src/subscriptions/cancellation-assist.ts` -- NEW: Waste detection engine + cancellation workflow
- `modules/budget/src/subscriptions/__tests__/cancellation-assist.test.ts` -- NEW: Engine tests
- `modules/budget/src/subscriptions/index.ts` -- MODIFY: Export cancellation-assist
- `modules/budget/src/db/schema.ts` -- MODIFY: Add bg_cancellation_actions table + indexes
- `modules/budget/src/types.ts` -- MODIFY: Add CancellationAction, CancellationActionType Zod schemas
- `modules/budget/src/definition.ts` -- MODIFY: Add V5 migration for cancellation_actions table
- `modules/budget/src/index.ts` -- MODIFY: Export cancellation types
- `apps/mobile/app/(budget)/subscriptions.tsx` -- MODIFY: Add Savings Opportunities section
- `apps/mobile/app/(budget)/cancel-subscription.tsx` -- NEW: Cancellation detail screen
- `apps/web/app/budget/subscriptions/page.tsx` -- MODIFY: Add Savings Opportunities section + modal
- `apps/web/app/budget/actions.ts` -- MODIFY: Add cancellation server actions

### Known Limitations
- **No automated cancellation.** Users must cancel subscriptions themselves by following the link. This is intentional: we don't want account access or to act on the user's behalf.
- **No bill negotiation.** Rocket Money's premium feature. Out of scope.
- **Usage detection is proxy-based.** We check for non-renewal transactions to the same payee as a usage signal. This is imperfect: some services (streaming) don't generate additional transactions beyond the renewal.
- **Catalog coverage.** Not all subscriptions have catalog entries. Manual subscriptions get scored on cost/duration only, not category deduplication.
- **Savings estimate is approximate.** It annualizes the subscription cost at the time of cancellation. If the user had been on a trial or promotional rate, the savings may be overstated.

### Context for Next Agent
- Use `normalizeToMonthly` and `normalizeToAnnual` from `modules/budget/src/subscriptions/cost.ts` for all cost calculations. Never reimplement normalization.
- The `bg_price_history` table stores price change records. Query by subscription_id to check for increases. Compare the most recent 2 records to detect a recent increase.
- For category deduplication, use the `catalog_id` field on subscriptions. Join to the catalog to get the category. Group active subs by category; any category with 2+ active subs gets the duplicate signal.
- The "Remind Me Later" cooldown is implemented by checking `bg_cancellation_actions` WHERE action = 'reminded' AND subscription_id = X AND acted_on > datetime('now', '-30 days')`. Similarly for 'kept' (90 days) and 'dismissed' (60 days).
- Subscription URLs vary wildly. Some catalog entries may have a direct cancellation URL. For most, just open the subscription's stored `url` field. If null, show text instructions.
- The scoring engine should be a pure function that takes a subscription + its price history + other active subs and returns a score + reasons array. Keep it testable.
