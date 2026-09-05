# Feature Spec: Cancellation Assist

## Metadata
- **Module:** subs
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 0 x2 + CrossModule 2 x1 + PaidUser 5 x1
- **Sprint:** Sprint 8
- **Estimated CC Time:** 6-8 hours
- **Depends On:** Database schema, All CRUD functions, UI, Cost analysis
- **Blocks:** none

## Business Context

### Why This Feature Exists
Rocket Money built a $100M+ business on cancellation assist. The average American has 12 subscriptions and wastes $133/month on ones they barely use (C+R Research, 2022). While Rocket Money requires bank access and charges $48-144/yr for their concierge service, MySubs can deliver 80% of the value with zero bank access: identify waste through usage signals, surface savings opportunities, provide direct cancellation links, and track savings. This is the #1 reason users pay for subscription trackers (PaidUser score: 5) and the most compelling premium feature for the Subs module.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Rocket Money | Yes | Yes ($48-144/yr) | Full concierge: detects unused subs via bank data, negotiates bills, cancels on user's behalf (requires bank credentials + $14.99/mo premium). |
| Bobby | No | N/A | No cancellation workflow. Just a tracker. |

### Target User
Rocket Money users paying $48-144/yr who want cancellation help without sharing bank credentials. Users who know they're overpaying but haven't gotten around to reviewing their subscriptions. Budget-conscious users who've added their subs to MySubs and want the app to actively help them save money. This feature is the #1 reason to upgrade to MyLife Pro.

## Technical Context

### Where This Lives in MyLife

```
modules/subs/src/
  engines/
    cancellation-assist.ts   -- NEW: Waste detection engine, cancellation workflow
    __tests__/
      cancellation-assist.test.ts -- NEW: Engine tests
  types.ts                   -- MODIFY: Add cancellation-related types
  index.ts                   -- MODIFY: Export cancellation engine
apps/mobile/app/(subs)/
  index.tsx                  -- MODIFY: Add "Savings Opportunities" section to Dashboard
  cancel/
    [id].tsx                 -- NEW: Cancellation detail/action screen
apps/web/app/subs/
  page.tsx                   -- MODIFY: Add "Savings Opportunities" section
  cancel/
    [id]/
      page.tsx               -- NEW: Cancellation detail page
```

### Wireframe Position

```
Hub Dashboard
  └── MySubs card
       └── Dashboard tab
            ├── Hero card (total spend)
            ├── Savings Opportunities section   ← NEW
            │    └── [Cancel detail screen]     ← NEW: Tap suggestion
            ├── Cost Breakdown
            └── Upcoming Renewals
```

### Data Model

No new tables. Uses existing `sb_cancellation_actions` table (created in Database Schema):

```sql
-- Already exists in V1 migration
CREATE TABLE IF NOT EXISTS sb_cancellation_actions (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES sb_subscriptions(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN ('dismissed', 'reminded', 'cancelled', 'downgraded', 'kept')),
  savings_cents INTEGER,
  notes TEXT,
  acted_on TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Also uses:
- `sb_subscriptions` -- cost_cents, billing_cycle, status, start_date, url, category_id
- `sb_price_history` -- for price increase detection
- `sb_categories` -- for duplicate detection (same category)

### Dependencies
- **Internal:** `@mylife/subs` (CRUD functions, cost analysis engine for normalization), `@mylife/db` (DatabaseAdapter)
- **External:** None. Cancellation links opened via `Linking.openURL` (Expo) or `window.open` (web).
- **Cross-Module:** Budget module has a similar cancellation assist feature. If both modules are active, the hub dashboard could show a combined "savings opportunities" widget. Not a blocker.

## Functional Requirements

### User Stories
1. As a user, I want to see which subscriptions I might be wasting money on so I can decide whether to cancel them.
2. As a user, I want to see how much I'd save annually if I cancelled a suggested subscription.
3. As a user, I want a cancellation guide with a direct link to the service's cancellation page so I can act immediately.
4. As a user, I want to log my decision (cancel, keep, downgrade, remind me later) so the app stops suggesting things I've already reviewed.
5. As a user, I want to see my total savings from cancelled subscriptions so I feel motivated.
6. As a user, I want the app to detect price increases and flag them as cancellation opportunities.

### Behavior Specification

**Waste Detection Engine:**

The engine scores each active subscription on a "cancellation opportunity" scale (0-100):

1. **Duration signal (0-30 points):**
   - Active for > 12 months with no interaction: 30 points (long-running, possibly forgotten).
   - Active for > 6 months: 15 points.
   - Active for > 3 months: 5 points.
   - Trial subscription approaching end date (within 7 days): 25 points.

2. **Price increase signal (0-30 points):**
   - Price increased in the last 6 months: 20 points.
   - Price increased by > 20%: 30 points.
   - Multiple price increases in history: 25 points.

3. **Cost signal (0-25 points):**
   - Monthly normalized cost > $30: 25 points.
   - Monthly normalized cost > $20: 20 points.
   - Monthly normalized cost > $10: 10 points.
   - Monthly normalized cost > $5: 5 points.

4. **Duplicate signal (0-15 points):**
   - Another active subscription in the same category: 15 points.
   - Example: Two streaming services, two cloud storage services.

```typescript
interface OpportunityScore {
  subscriptionId: string;
  subscriptionName: string;
  totalScore: number;
  reasons: { signal: string; points: number; description: string }[];
  monthlySavingsCents: number;
  annualSavingsCents: number;
  priority: 'high' | 'medium';  // high >= 60, medium >= 40
}
```

Score >= 40: Show as "Savings Opportunity" (medium priority)
Score >= 60: Show as "High Priority" (flagged with warning indicator)

`getOpportunities(db, threshold?: number): OpportunityScore[]` -- Returns scored opportunities sorted by score descending. Default threshold: 40.

`scoreSubscription(db, subscriptionId: string): OpportunityScore` -- Score a single subscription.

**Dashboard -- "Savings Opportunities" section:**
1. Collapsible section on Dashboard tab, positioned above Cost Breakdown.
2. Shows top 5 opportunities sorted by score descending.
3. Each card shows: icon, name, monthly cost, annual cost, priority indicator (orange/yellow), reason summary.
4. Section header: "Potential savings: $X/month ($Y/year)".
5. "View All" link if more than 5 opportunities.
6. If no opportunities (all subs score < 40): section hidden entirely.

**Cancellation detail screen (cancel/[id].tsx):**
1. Subscription header: name, icon, status badge, current monthly/annual cost.
2. **Why We Flagged This** section:
   - Bullet list of reasons with point breakdown.
   - Each reason is human-readable: "Active for 18 months -- possibly forgotten", "Price increased 33% in the last 6 months", "You also have Hulu and Disney+ in Streaming".
3. **Price History** section (if price changes exist):
   - Chronological list of price changes with dates and amounts.
   - "Price increased X% since you subscribed" summary.
4. **Annual Cost** callout:
   - Large text: "$275.88/year" (or equivalent annual cost).
   - "Cancel and save $275.88/year" motivational text.
5. **Cancellation Instructions:**
   - If catalog entry exists with cancel_url: "Cancel at [url]" with direct link button.
   - If subscription has a url field: "Visit [url] to manage" with link button.
   - If neither: "Contact [name] customer support to cancel."
6. **Action buttons:**
   - "I Cancelled It": logs `cancelled`, updates subscription status to `cancelled`, records savings.
   - "I'll Keep It": logs `kept`, removes from suggestions for 90 days.
   - "Downgraded": logs `downgraded`, prompts for new price, updates subscription cost, records savings (old - new annual).
   - "Remind Me Later": logs `reminded`, removes from suggestions for 30 days.

**Action logging and cooldowns:**
- All actions logged to `sb_cancellation_actions`.
- Cooldown periods prevent re-surfacing:
  - `cancelled`: permanent removal (subscription status changes).
  - `kept`: 90 days cooldown.
  - `reminded`: 30 days cooldown.
  - `dismissed` (swipe on opportunity card): 60 days cooldown.
  - `downgraded`: permanent removal (cost changed, re-scored with new cost).

`shouldShowOpportunity(db, subscriptionId: string): boolean` -- Checks cooldown state.

**Savings tracker:**
- "Saved $X this year" banner on Dashboard.
- Calculated from `sb_cancellation_actions` WHERE action IN ('cancelled', 'downgraded') AND strftime('%Y', acted_on) = current year.
- `calculateTotalSavings(db, year?: number): { totalCents: number; cancelledCount: number; downgradedCount: number }`.

### Edge Cases

- **No subscriptions:** Section hidden.
- **All subscriptions score < 40:** Section hidden. No "savings opportunities" messaging shown.
- **Single subscription:** Can still be flagged (e.g., high cost, price increase). Duplicate signal = 0.
- **Subscription with no URL and no catalog entry:** Show text-only instructions: "Contact [name] customer support to cancel."
- **User cancels then re-subscribes:** Create a new subscription. Old cancellation action stays in history. Savings calculated from the cancelled period.
- **Trial ending soon:** High score. Detail screen shows trial end date prominently. "Cancel before [date] to avoid charges."
- **Lifetime subscription:** Score is 0 on cost signal (monthly cost = 0). May still score on duration. Unlikely to surface as opportunity.
- **Subscription just added (< 1 week):** Minimal duration signal. Probably won't surface.
- **"Remind Me Later" expires:** After 30 days, subscription re-scored. If still >= threshold, reappears.
- **Multiple price increases:** Each increase adds to the price signal. Show full history on detail screen.
- **"Downgraded" cost entry:** User enters new cost. `updateSubscription` records the change in price history. Subscription re-scored with new cost -- likely drops below threshold.
- **No internet for cancellation link:** Link button opens in browser regardless. If user is offline, browser handles the error.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Dashboard shows "Savings Opportunities" section when opportunities exist
- [ ] **AC-2:** Each opportunity card shows name, monthly cost, annual cost, priority indicator, and reason
- [ ] **AC-3:** Opportunities sorted by score descending (highest savings potential first)
- [ ] **AC-4:** Section header shows total potential monthly and annual savings
- [ ] **AC-5:** Tapping an opportunity opens the cancellation detail screen
- [ ] **AC-6:** Detail screen shows reasons, price history (if any), annual cost, and cancellation link
- [ ] **AC-7:** "Open [Service Name]" button opens the subscription's URL in browser
- [ ] **AC-8:** "I Cancelled It" updates subscription status to cancelled and logs savings
- [ ] **AC-9:** "I'll Keep It" removes the subscription from suggestions for 90 days
- [ ] **AC-10:** "Remind Me Later" removes for 30 days
- [ ] **AC-11:** "Downgraded" prompts for new price, updates subscription, and logs savings
- [ ] **AC-12:** "Saved $X this year" banner shows correct total from cancellation actions
- [ ] **AC-13:** Price increase subscriptions show price history and "Price increased" detail
- [ ] **AC-14:** Section hidden when no opportunities exist
- [ ] **AC-15:** Feature works on both mobile and web
- [ ] **AC-16:** Dismissed opportunity cards don't reappear before cooldown expires

### Technical Criteria
- [ ] **TC-1:** Waste detection engine scores subscriptions correctly across all 4 signal categories
- [ ] **TC-2:** Score threshold (default 40) controls which subscriptions surface as opportunities
- [ ] **TC-3:** Cancellation actions persisted to `sb_cancellation_actions`
- [ ] **TC-4:** Cooldown logic: `kept` = 90 days, `reminded` = 30 days, `dismissed` = 60 days
- [ ] **TC-5:** Savings calculation queries cancellation_actions for current year
- [ ] **TC-6:** Cost normalization uses the cost analysis engine's `normalizeToMonthly` / `normalizeToAnnual`
- [ ] **TC-7:** Duplicate detection queries active subscriptions by category
- [ ] **TC-8:** Price increase detection queries `sb_price_history` for increases within last 6 months
- [ ] **TC-9:** Engine functions are pure (no side effects besides reading from database)
- [ ] **TC-10:** `pnpm typecheck` passes with no errors

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Must NOT contact external services or APIs on behalf of the user
- [ ] **NC-2:** Must NOT auto-cancel subscriptions (user must take manual action)
- [ ] **NC-3:** Cancelled/expired subscriptions must NOT appear in opportunities
- [ ] **NC-4:** Opportunities within cooldown must NOT reappear
- [ ] **NC-5:** Must NOT modify subscription data except when user explicitly takes an action (cancel, downgrade)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Opportunity cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#10B981` (emerald green)
- High priority indicator: `#F97316` (orange) for score >= 60
- Medium priority indicator: `#F59E0B` (yellow) for score 40-59
- Savings amount: `#10B981` (accent green) text
- Price increase badge: `#EF4444` (danger red) background pill
- Cancel button: `#EF4444` danger style
- Keep/Remind buttons: glass surface with text primary

Dashboard opportunities section:
```
[Savings Opportunities]                    [collapse ▼]
  "Save up to $47/mo ($564/yr)"

  [Card: Netflix]                          [orange ●]
    💳 Netflix  $22.99/mo ($275.88/yr)
    "Price increased 33%, active 18 months"
    [Review →]

  [Card: Adobe CC]                         [yellow ●]
    💳 Adobe CC  $59.99/mo ($719.88/yr)
    "High cost, active 12+ months"
    [Review →]

[Saved $180 this year ✓]                   [green banner]
```

Cancellation detail screen:
```
[← Back]            Netflix

  💳 Netflix                    Active
  $22.99/mo  •  $275.88/yr

[Why We Flagged This]
  • Price increased 33% in the last 6 months (20 pts)
  • Active for 18 months -- possibly forgotten (30 pts)
  • Duplicate: You also have Hulu in Streaming (15 pts)
  • Monthly cost exceeds $20 (20 pts)
  Score: 85/100 -- High Priority

[Price History]
  Jan 2025    $15.99/mo
  Jul 2025    $19.99/mo    ↑ 25%
  Jan 2026    $22.99/mo    ↑ 15%
  "Price increased 44% since you subscribed"

[Cancel and save $275.88/year]

  [Open Netflix]                    [opens URL]

  [I Cancelled It]    [I'll Keep It]
  [Downgraded]        [Remind Me Later]
```

### Web (Next.js)

- Route: `/subs/cancel/[id]` for cancellation detail
- Dashboard at `/subs` enhanced with opportunities section
- Detail view opens as a side panel on desktop, full page on mobile
- Same tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards in opportunities section | Computing scores |
| No subscriptions | Section hidden | No subscriptions |
| No opportunities | Section hidden | All subs score < 40 |
| Opportunities found | Scored cards sorted by priority | Subs score >= 40 |
| Detail view | Full cancellation guide with actions | User taps opportunity |
| Action taken | Card removed with animation, savings updated | User takes action |
| All reviewed | Section hidden, savings banner prominent | All opportunities actioned |
| Error | "Could not analyze subscriptions" with retry | Engine fails |

## Test Requirements

### Unit Tests
- [ ] `scoreSubscription`: sub active 18 months -> 30 duration points
- [ ] `scoreSubscription`: sub active 6 months -> 15 duration points
- [ ] `scoreSubscription`: trial ending in 3 days -> 25 trial points
- [ ] `scoreSubscription`: price increased 25% in last 6 months -> 30 price points
- [ ] `scoreSubscription`: price increased 10% -> 20 price points
- [ ] `scoreSubscription`: multiple price increases -> 25 points
- [ ] `scoreSubscription`: monthly cost $35 -> 25 cost points
- [ ] `scoreSubscription`: monthly cost $15 -> 10 cost points
- [ ] `scoreSubscription`: two subs in same category -> 15 duplicate points
- [ ] `scoreSubscription`: cancelled subscription -> excluded (score 0)
- [ ] `scoreSubscription`: paused subscription -> still scored (may be forgotten)
- [ ] `getOpportunities`: returns only subs with score >= threshold, sorted desc
- [ ] `getOpportunities`: empty subscription list -> empty array
- [ ] `getOpportunities`: threshold 60 returns only high-priority items
- [ ] `shouldShowOpportunity`: returns false within 90-day cooldown for 'kept'
- [ ] `shouldShowOpportunity`: returns false within 30-day cooldown for 'reminded'
- [ ] `shouldShowOpportunity`: returns false within 60-day cooldown for 'dismissed'
- [ ] `shouldShowOpportunity`: returns true after cooldown expires
- [ ] `calculateTotalSavings`: 2 cancelled + 1 downgraded -> correct total
- [ ] `calculateTotalSavings`: no actions -> 0
- [ ] `calculateTotalSavings`: actions from previous year not included in current year

### Integration Tests
- [ ] Full flow: add 3 subs (one expensive+old, one with price increase, one cheap+new) -> 2 show as opportunities
- [ ] Cancellation flow: tap opportunity -> "I Cancelled It" -> subscription status updated, savings incremented, opportunity removed
- [ ] Remind flow: tap "Remind Me Later" -> opportunity disappears -> 30+ days later (mocked) -> reappears if still scored
- [ ] Keep flow: "I'll Keep It" -> opportunity disappears for 90 days
- [ ] Downgrade flow: "Downgraded" -> enter new price -> cost updated, savings logged, opportunity removed

### QA Verification Script

1. Open MySubs on iOS/web
2. Add 3 subscriptions:
   - Netflix: $22.99/mo, start date 12 months ago, URL: netflix.com/account
   - Spotify: $10.99/mo, start date 6 months ago
   - iCloud: $2.99/mo, start date 1 month ago
3. Record a price increase for Netflix: old=$15.99, new=$22.99
4. Add another streaming service (Hulu: $17.99/mo, Streaming category)
5. Navigate to Dashboard
6. Verify: "Savings Opportunities" section appears -- AC-1
7. Verify: Netflix shows with orange/high priority (price increase + duration + duplicate + cost) -- AC-2
8. Verify: Opportunities sorted by score -- AC-3
9. Verify: Total potential savings shown -- AC-4
10. Tap Netflix -- AC-5
11. Verify: Detail shows reasons, price history, annual cost, cancel link -- AC-6
12. Verify: "Open Netflix" button present -- AC-7
13. Tap "I Cancelled It" -- AC-8
14. Verify: Netflix status changes to cancelled -- AC-8
15. Verify: Savings counter appears/updates -- AC-12
16. Navigate back to Dashboard
17. Verify: Netflix no longer in opportunities
18. Tap Spotify opportunity (if scored >= 40)
19. Tap "Remind Me Later" -- AC-10
20. Verify: Opportunity removed from list -- AC-10
21. Tap iCloud (if scored >= 40), or verify section hidden if no more opportunities -- AC-14
22. Verify on web -- AC-15

## gstack Quality Gates

Based on Complexity score 0 (Very Complex), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Very Complex features (Complexity <= 1):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /subs, verify opportunity cards, tap through cancellation flow
- [ ] After 5 features in subs module: `/qa` on /subs

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for the waste detection scoring engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- subs has no standalone counterpart, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Full CRUD, UI, cost analysis, and catalog exist. No waste detection, no cancellation workflow, no savings tracking.

### After This Work
- Waste detection engine scoring subscriptions across 4 signal categories (duration, price, cost, duplicate).
- "Savings Opportunities" section on Dashboard with scored, prioritized cards.
- Cancellation detail screen with reasons, price history, cancel links, and action buttons.
- Action logging with cooldown-based re-surfacing.
- Savings tracker showing year-to-date money recovered.

### Files Changed
- `modules/subs/src/engines/cancellation-assist.ts` -- NEW: Waste detection engine + cancellation workflow
- `modules/subs/src/engines/__tests__/cancellation-assist.test.ts` -- NEW: Engine tests
- `modules/subs/src/types.ts` -- MODIFY: Add OpportunityScore, CancellationActionType types
- `modules/subs/src/index.ts` -- MODIFY: Export cancellation engine
- `apps/mobile/app/(subs)/index.tsx` -- MODIFY: Add Savings Opportunities section
- `apps/mobile/app/(subs)/cancel/[id].tsx` -- NEW: Cancellation detail screen
- `apps/web/app/subs/page.tsx` -- MODIFY: Add Savings Opportunities section
- `apps/web/app/subs/cancel/[id]/page.tsx` -- NEW: Cancellation detail page

### Known Limitations
- **No automated cancellation.** Users must cancel subscriptions themselves via the provided link. We do not act on the user's behalf.
- **No bill negotiation.** Rocket Money's premium service. Out of scope.
- **Usage detection is heuristic-based.** Without bank data, we infer "unused" from subscription age, not actual usage. A subscription active for 18 months might be heavily used. The scoring is suggestive, not definitive.
- **Savings are approximate.** Annualized from the subscription cost at time of cancellation. If the user was on a promotional rate, savings may be overstated.
- **No push notifications for savings reminders.** The "Remind Me Later" cooldown is checked on next app open, not via a scheduled notification.

### Context for Next Agent
- The scoring engine should be a pure function. `scoreSubscription(subscription, priceHistory, activeSubs) -> OpportunityScore`. Keep it testable with no database dependency in the core scoring logic. The wrapper function `getOpportunities(db)` handles the database queries and feeds data to the pure scorer.
- Cooldown checks use `sb_cancellation_actions` timestamps. Query: `WHERE subscription_id = ? AND action = ? AND acted_on > datetime('now', '-N days')`. If a row exists within the cooldown window, suppress that subscription.
- Price increase detection: query `sb_price_history WHERE subscription_id = ? AND changed_on > datetime('now', '-6 months') AND new_cost_cents > old_cost_cents`. If rows exist, calculate the percentage increase.
- Duplicate detection: query active subs grouped by category_id. Any category with 2+ active subs gets duplicate points for each subscription in that category.
- The Budget module has a nearly identical feature at `modules/budget/src/subscriptions/cancellation-assist.ts`. The Subs version is independent but the scoring logic and UX patterns should be consistent. Cross-reference the Budget spec for alignment.
- The savings tracker is a motivational metric, not precise accounting. "Saved $X" = sum of annualized costs of cancelled + (old - new annual cost of downgraded) subscriptions this year.
