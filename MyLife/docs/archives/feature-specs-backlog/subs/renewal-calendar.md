# Feature Spec: Renewal Calendar

## Metadata
- **Module:** subs
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** Sprint 8
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Database schema, All CRUD functions, UI (Calendar tab placeholder)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Bobby's most-loved feature is its renewal calendar -- a visual calendar showing when each subscription renews, so users are never surprised by a charge. Users want to know "what charges are coming this week/month?" before they hit. The calendar transforms MySubs from a static list into a forward-looking financial planning tool. This replaces the placeholder Calendar tab created by the UI feature.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Bobby | Yes | No ($1.99) | Simple monthly calendar with colored dots on renewal dates. Tap a date to see which subs renew. |
| Rocket Money | Partial | Yes ($48-144/yr) | "Upcoming bills" list sorted by date. No visual calendar, but shows amounts and dates. |

### Target User
Bobby users who love the visual calendar and want it in a more comprehensive app. Budget-conscious users who want to plan cash flow around renewal dates. Users who've been surprised by annual charges they forgot about.

## Technical Context

### Where This Lives in MyLife

```
modules/subs/src/
  engines/
    renewal-calendar.ts      -- NEW: Calendar data engine
    __tests__/
      renewal-calendar.test.ts -- NEW: Engine tests
  types.ts                   -- MODIFY: Add calendar-related types
  index.ts                   -- MODIFY: Export calendar engine
apps/mobile/app/(subs)/
  calendar.tsx               -- REPLACE: Full calendar implementation (was placeholder)
apps/web/app/subs/
  calendar/
    page.tsx                 -- REPLACE: Full calendar implementation (was placeholder)
```

### Wireframe Position

```
Hub Dashboard
  └── MySubs card
       └── Calendar tab     ← YOU ARE HERE (replaces placeholder)
```

### Data Model

No new tables. Uses existing:
- `sb_subscriptions` -- cost_cents, billing_cycle, next_renewal_date, status, name
- `sb_renewal_events` -- renewal_date, amount_cents, status, subscription_id
- `sb_categories` -- for category color coding on calendar dots

The calendar engine generates `sb_renewal_events` records for future dates using the CRUD function `generateRenewalEvents`.

### Dependencies
- **Internal:** `@mylife/subs` (CRUD functions for renewal events, subscription data), `@mylife/db` (DatabaseAdapter), `@mylife/ui` (Cool Obsidian tokens)
- **External:** None. Calendar is custom-rendered (no external calendar library).
- **Cross-Module:** RSVP module has a calendar sync feature. In the future, hub-level calendar could aggregate renewal dates with RSVP events. Not a blocker for this feature.

## Functional Requirements

### User Stories
1. As a user, I want to see a monthly calendar with dots on days when subscriptions renew, so I can plan ahead.
2. As a user, I want to tap a day to see which subscriptions renew and how much they cost.
3. As a user, I want to see a monthly cost total at the top of the calendar.
4. As a user, I want to navigate between months to see future renewals.
5. As a user, I want to see an agenda view (list sorted by date) as an alternative to the calendar grid.
6. As a user, I want renewal notifications before a subscription charges, so I can cancel or prepare.

### Behavior Specification

**Calendar Data Engine:**

```typescript
interface CalendarDay {
  date: string;           // ISO date (YYYY-MM-DD)
  renewals: RenewalItem[];
  totalCents: number;
}

interface RenewalItem {
  subscriptionId: string;
  subscriptionName: string;
  amountCents: number;
  billingCycle: BillingCycle;
  categoryColor: string;
  status: 'upcoming' | 'paid' | 'skipped' | 'missed';
}

interface CalendarMonth {
  year: number;
  month: number;          // 1-12
  days: CalendarDay[];    // Only days with renewals
  totalCents: number;     // Sum of all renewals this month
  renewalCount: number;   // Number of renewal events
}
```

`getCalendarMonth(db, year: number, month: number): CalendarMonth` -- Returns all renewal events for a given month, grouped by day.

`getAgendaView(db, daysAhead: number): CalendarDay[]` -- Returns upcoming renewals as a flat list sorted by date, for the next N days.

`getRenewalSummary(db): { thisMonth: number; nextMonth: number; thisYear: number }` -- Quick totals for dashboard integration.

**Calendar tab (full implementation):**

1. **Header:** Month/Year with left/right arrows to navigate. "This Month: $X" total.
2. **View toggle:** Calendar grid | Agenda list
3. **Calendar grid view:**
   - Standard month grid (Sun-Sat columns, 4-6 rows)
   - Days with renewals show colored dots (one per renewal, colored by category)
   - Today is highlighted with accent ring
   - Tap a day to expand and see renewals for that date
   - Future months show projected renewals based on billing cycles
   - Past months show actual status (paid, missed, skipped)
4. **Day detail (expanded on tap):**
   - Lists each renewal: name, amount, category icon, status badge
   - "Mark as Paid" button for each (updates sb_renewal_events status)
   - Tap subscription name to navigate to detail screen
5. **Agenda view:**
   - Vertical list of upcoming renewals sorted by date
   - Grouped by week: "This Week", "Next Week", "Week of [date]"
   - Each row: date, subscription name, amount, billing cycle
   - Shows next 90 days by default, "Load More" for further out
6. **Month summary footer:**
   - "X renewals this month totaling $Y"
   - Comparison: "Last month: $Z" (if data exists)

**Renewal Generation:**
- When a subscription is created, `generateRenewalEvents` creates events for the next 12 months.
- When the calendar navigates to a month beyond generated events, auto-generate more events.
- Events for `lifetime` subscriptions: no renewal events generated.

**Notification Integration:**
- Each subscription has `notification_enabled` and `notification_days_before` fields.
- The calendar engine provides a function:
  `getDueNotifications(db): { subscription: Subscription; renewalDate: string; daysBefore: number }[]`
  Returns subscriptions needing notification today (renewal_date - notification_days_before = today).
- Notification delivery is handled by the mobile notification system (outside this spec's scope). This engine provides the data.

### Edge Cases

- **No subscriptions:** Calendar shows empty month grid with "No renewals. Add subscriptions to see upcoming charges." message.
- **Lifetime subscription:** No renewal events. Does not appear on calendar.
- **Paused subscription:** Renewal events still shown but with "paused" visual treatment (dimmed). Not included in cost total.
- **Cancelled subscription:** No future renewal events generated. Past events remain for history.
- **Subscription with no next_renewal_date:** Cannot generate events. Show warning on subscription detail: "No renewal date set."
- **February 29 renewal for yearly subs:** Use the next valid date (March 1 in non-leap years). Or match SQLite's date arithmetic.
- **End of month (31st) for monthly subs:** If renewal is the 31st and the month has 30 days, renewal falls on the 30th. Use SQLite date math.
- **Multiple renewals same day:** Show all dots (up to 5, then "+N" overflow). Day detail lists all.
- **Very far future navigation:** Only generate events up to 24 months ahead to limit database size.
- **Timezone:** All dates are in the user's local timezone (no UTC conversion needed for local-only data).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Calendar tab shows a month grid with today highlighted
- [ ] **AC-2:** Days with renewals show colored dots
- [ ] **AC-3:** Month header shows total cost for the displayed month
- [ ] **AC-4:** Left/right arrows navigate between months
- [ ] **AC-5:** Tapping a day with renewals expands to show renewal details
- [ ] **AC-6:** Each renewal shows name, amount, and category color
- [ ] **AC-7:** "Mark as Paid" updates renewal event status
- [ ] **AC-8:** Agenda view shows upcoming renewals as a date-sorted list
- [ ] **AC-9:** View toggle switches between calendar grid and agenda list
- [ ] **AC-10:** Future months show projected renewals
- [ ] **AC-11:** Paused subscriptions appear dimmed and excluded from totals
- [ ] **AC-12:** Feature works on both mobile and web

### Technical Criteria
- [ ] **TC-1:** `getCalendarMonth` returns correct renewals grouped by day
- [ ] **TC-2:** `getCalendarMonth` handles months with no renewals (empty days array)
- [ ] **TC-3:** `getAgendaView` returns renewals sorted by date ascending
- [ ] **TC-4:** `getRenewalSummary` computes correct monthly/annual totals
- [ ] **TC-5:** `getDueNotifications` returns correct subscriptions based on notification settings
- [ ] **TC-6:** Renewal events auto-generated for new subscriptions (12 months ahead)
- [ ] **TC-7:** No renewal events generated for lifetime or cancelled subscriptions
- [ ] **TC-8:** Calendar grid renders correct number of rows for each month (4-6)
- [ ] **TC-9:** `pnpm typecheck` passes with no errors

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Calendar must NOT generate events more than 24 months ahead
- [ ] **NC-2:** Cancelled subscriptions must NOT appear in future renewal projections
- [ ] **NC-3:** Paused subscription costs must NOT be included in month totals
- [ ] **NC-4:** Marking a renewal as paid must NOT change the subscription's cost

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Calendar grid cells: `rgba(255,255,255,0.02)` with `rgba(255,255,255,0.06)` border
- Today cell: `#10B981` border ring
- Renewal dots: category color from `sb_categories`, 6px circles
- Selected day: `rgba(16,185,129,0.15)` background
- Module accent: `#10B981`
- Month total: large accent-colored text in header

Calendar grid:
```
[← March 2026 →]           This month: $147.93

 Sun   Mon   Tue   Wed   Thu   Fri   Sat
                     1     2     3     4
                           ●
  5     6     7     8     9    10    11
        ●                ●●
 12    13    14    15    16    17    18
                    ●           ●
 19    20    21    22   [23]   24    25
                                ●●●
 26    27    28    29    30    31

[Day 25 Detail]
  🎵 Spotify         $10.99/mo    [Paid ✓]
  ☁️ iCloud+         $2.99/mo     [Mark Paid]
  🎮 Xbox Game Pass  $16.99/mo    [Mark Paid]
```

Agenda view:
```
[This Week]
  Mar 23  (today)
  Mar 25  🎵 Spotify         $10.99    Monthly
          ☁️ iCloud+         $2.99     Monthly
          🎮 Xbox Game Pass  $16.99    Monthly

[Next Week]
  Mar 28  📺 Netflix          $22.99   Monthly
  Apr 1   🏋️ Peloton         $44.00   Monthly
```

### Web (Next.js)

- Route: `/subs/calendar`
- Calendar grid rendered with CSS Grid (7 columns)
- Day detail as a side panel (not modal) on desktop, bottom sheet on mobile
- Agenda view is a scrollable list with sticky week headers

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton calendar grid | Initial data fetch |
| Empty | Empty grid with "No renewals" message and add CTA | No subscriptions |
| Success | Populated calendar with dots and totals | Active subscriptions exist |
| Day expanded | List of renewals for tapped day | User taps a day |
| Agenda | Date-sorted list of upcoming renewals | User toggles to agenda view |
| Error | "Could not load calendar" with retry | Query fails |

## Test Requirements

### Unit Tests
- [ ] `getCalendarMonth(2026, 3)` returns correct days for March 2026
- [ ] `getCalendarMonth` groups renewals by day correctly
- [ ] `getCalendarMonth` with no renewals returns empty days array and $0 total
- [ ] `getCalendarMonth` excludes cancelled subscription renewals
- [ ] `getCalendarMonth` includes paused subs in days but not in totals
- [ ] `getAgendaView(30)` returns renewals within 30 days, sorted by date
- [ ] `getAgendaView(0)` returns empty array
- [ ] `getRenewalSummary` computes correct thisMonth, nextMonth, thisYear
- [ ] `getDueNotifications` returns sub with notification_days_before=3 when renewal is 3 days away
- [ ] `getDueNotifications` does not return sub with notification_enabled=false
- [ ] Monthly renewal date calculation: Jan 31 sub -> next renewal Feb 28 (non-leap)
- [ ] Yearly renewal date calculation: Feb 29 sub -> next renewal Mar 1 (non-leap year)
- [ ] Multiple renewals on same day grouped correctly in CalendarDay

### Integration Tests
- [ ] Full flow: add 3 subs with different cycles -> calendar shows dots on correct dates
- [ ] Mark paid flow: tap day -> mark renewal paid -> status changes, next renewal generated
- [ ] Month navigation: navigate to next month -> correct renewals shown
- [ ] Agenda flow: toggle to agenda -> shows same renewals in list format

### QA Verification Script

1. Open MySubs on iOS/web
2. Add 3 subscriptions:
   - Netflix: $22.99/mo, start date 2025-03-01 (renews monthly on 1st)
   - Spotify: $10.99/mo, start date 2025-03-15 (renews monthly on 15th)
   - Adobe CC: $719.88/yr, start date 2025-06-01 (renews yearly on June 1)
3. Tap Calendar tab -- AC-1
4. Verify: Today is highlighted -- AC-1
5. Verify: Dots appear on the 1st and 15th of the current month -- AC-2
6. Verify: Month total shows $33.98 (Netflix + Spotify) -- AC-3
7. Tap left arrow to go to previous month -- AC-4
8. Tap right arrow twice to go to next month -- AC-4
9. Verify: Same dots on 1st and 15th -- AC-10
10. Navigate to June
11. Verify: Dots on 1st (Netflix + Adobe CC) and 15th (Spotify) -- AC-2
12. Verify: June total includes $22.99 + $719.88 + $10.99 = $753.86 -- AC-3
13. Navigate back to current month
14. Tap a day with renewals -- AC-5
15. Verify: Renewal details shown with name, amount, category color -- AC-6
16. Tap "Mark as Paid" on a renewal -- AC-7
17. Verify: Status changes to "Paid" checkmark -- AC-7
18. Tap view toggle to switch to Agenda -- AC-9
19. Verify: Upcoming renewals shown as a sorted list -- AC-8
20. Pause Spotify from its detail screen
21. Return to Calendar
22. Verify: Spotify dot is dimmed and excluded from month total -- AC-11
23. Repeat key steps on web -- AC-12

## gstack Quality Gates

Based on Complexity score 4 (Simple), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /subs/calendar, verify grid renders, tap days, switch views

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- subs has no standalone counterpart, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Calendar tab exists as a placeholder showing "Renewal calendar coming soon" with a preview list of next 5 renewals. Renewal events table exists. `generateRenewalEvents` CRUD function exists.

### After This Work
- Full calendar grid with month navigation, colored dots, day expansion.
- Agenda view as an alternative date-sorted list.
- Month totals and renewal summaries.
- "Mark as Paid" action on individual renewals.
- Notification data provider for the mobile notification system.

### Files Changed
- `modules/subs/src/engines/renewal-calendar.ts` -- NEW: Calendar data engine (getCalendarMonth, getAgendaView, getRenewalSummary, getDueNotifications)
- `modules/subs/src/engines/__tests__/renewal-calendar.test.ts` -- NEW: Engine tests
- `modules/subs/src/types.ts` -- MODIFY: Add CalendarDay, RenewalItem, CalendarMonth types
- `modules/subs/src/index.ts` -- MODIFY: Export calendar engine
- `apps/mobile/app/(subs)/calendar.tsx` -- REPLACE: Full calendar implementation
- `apps/web/app/subs/calendar/page.tsx` -- REPLACE: Full calendar implementation

### Known Limitations
- **No system calendar sync.** Renewals don't export to Apple Calendar or Google Calendar. RSVP module's calendar sync could be extended to include renewal dates as a future cross-module feature.
- **No push notifications.** The engine provides notification data, but actual push notification delivery requires Expo Notifications setup. This is a platform concern, not a module concern.
- **Calendar is monthly only.** No weekly or yearly views. Monthly is the most useful granularity for subscription renewals.
- **No recurring event editing.** You can't change "renew on the 15th instead of the 1st" from the calendar. Edit the subscription's start date to change its renewal day.

### Context for Next Agent
- The calendar grid is custom-rendered (no library). Use a 7-column CSS Grid or React Native `View` grid. Calculate the first day of the month to determine starting column.
- Renewal dots use the category color from `sb_categories`. If the subscription has no category, use the module accent color (`#10B981`).
- `generateRenewalEvents` already exists in the CRUD layer. Call it when a subscription is created and when navigating to a month beyond existing events.
- The `getDueNotifications` function is a data provider. Hook it up to Expo Notifications in a separate notification setup task (not part of this spec).
- "Mark as Paid" calls `markRenewalPaid` from CRUD, which sets status to 'paid' and generates the next renewal event. The calendar should refresh after this action.
- For month navigation performance, only query renewal events for the displayed month (not all events). The engine's `getCalendarMonth` is scoped to a single month.
