# Feature Spec: UI

## Metadata
- **Module:** subs
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 5 x3 + Complexity 2 x2 + CrossModule 0 x1 + PaidUser 0 x1
- **Sprint:** Sprint 8
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Database schema, All CRUD functions
- **Blocks:** none (other features extend UI but don't depend on it existing first)

## Business Context

### Why This Feature Exists
MySubs has types and a module definition but zero visual presence. Users cannot add, view, edit, or delete subscriptions. Without UI, the module is invisible and useless. This is the final P0 blocker -- once UI ships, users can actually track subscriptions. The UI must support the 4-tab navigation defined in `definition.ts`: Dashboard, Subs, Calendar, Settings.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Rocket Money | Yes | Partial | Dashboard with total spend, upcoming renewals, subscription list with category icons. Bank-synced auto-detection. |
| Bobby | Yes | No ($1.99) | Minimal, beautiful UI. Color-coded subscription cards in a vertical list. Monthly/annual toggle. Calendar view for renewals. |

### Target User
Bobby users who want a clean, simple subscription tracker with more depth (cost analysis, cancellation assist) available. Rocket Money users who want to stop paying $48-144/yr for basic tracking. Any MyLife user who wants to see all their subscriptions in one place.

## Technical Context

### Where This Lives in MyLife

```
apps/mobile/app/(subs)/
  _layout.tsx              -- NEW: Tab navigator (Dashboard, Subs, Calendar, Settings)
  index.tsx                -- NEW: Dashboard tab (total spend, upcoming renewals, quick stats)
  subscriptions.tsx        -- NEW: Subscription list with filters and search
  calendar.tsx             -- NEW: Calendar view placeholder (wired by Renewal Calendar feature)
  settings.tsx             -- NEW: Module settings (notifications, default category)
  subscription/
    [id].tsx               -- NEW: Subscription detail screen
    add.tsx                -- NEW: Add/edit subscription form
apps/web/app/subs/
  layout.tsx               -- NEW: Subs module layout
  page.tsx                 -- NEW: Dashboard (default route)
  subscriptions/
    page.tsx               -- NEW: Subscription list
  calendar/
    page.tsx               -- NEW: Calendar view placeholder
  settings/
    page.tsx               -- NEW: Module settings
modules/subs/src/
  components/              -- NEW: Shared component logic (optional, hooks/formatters)
    hooks.ts               -- NEW: useSubscriptions, useSubscriptionDetail, useCostSummary
    formatters.ts          -- NEW: formatCost, formatBillingCycle, formatNextRenewal
```

### Wireframe Position

```
Hub Dashboard
  └── MySubs card (icon: 💳, accent: #10B981)
       ├── Dashboard tab        ← Total spend, upcoming renewals, quick add
       ├── Subs tab             ← Full subscription list, filters, search
       ├── Calendar tab         ← Renewal calendar (placeholder until Renewal Calendar feature)
       └── Settings tab         ← Notification prefs, categories management
```

### Data Model

No new tables. Consumes all 6 `sb_` tables via the CRUD functions.

### Dependencies
- **Internal:** `@mylife/subs` (CRUD functions, types), `@mylife/db` (DatabaseAdapter), `@mylife/ui` (Cool Obsidian tokens, shared components), `@mylife/module-registry` (module lifecycle)
- **External:** `expo-router` (mobile navigation), `lucide-react-native` / `lucide-react` (icons)
- **Cross-Module:** None directly. Dashboard card appears alongside other module cards on the hub dashboard.

## Functional Requirements

### User Stories
1. As a user, I want to see my total monthly subscription spend on the Dashboard tab so I know how much I'm paying.
2. As a user, I want to see upcoming renewals on the Dashboard so I'm never surprised by a charge.
3. As a user, I want to add a new subscription with name, cost, billing cycle, category, and optional start date/URL.
4. As a user, I want to view all my subscriptions in a list that I can filter by status and category and search by name.
5. As a user, I want to tap a subscription to see its full details, edit it, or delete it.
6. As a user, I want to pause or cancel a subscription from its detail screen.
7. As a user, I want to manage categories in Settings to organize my subscriptions.

### Behavior Specification

**Dashboard Tab (index.tsx):**
1. Hero card at top showing:
   - Total monthly cost (sum of all active subscriptions, normalized to monthly)
   - Total annual cost
   - Active subscription count
2. "Upcoming Renewals" section:
   - Shows subscriptions renewing in the next 7 days
   - Each card: icon, name, cost, renewal date, "in X days" label
   - If none upcoming: "No renewals this week"
3. "Quick Stats" row:
   - Most expensive subscription (name + monthly cost)
   - Cheapest subscription
   - Average cost per subscription
4. Floating action button (FAB): "+" to add a new subscription

**Subs Tab (subscriptions.tsx):**
1. Search bar at top (filters by name, case-insensitive)
2. Filter pills below search: All, Active, Paused, Cancelled, Trial
3. Sort options: "Sort by" dropdown/pill -- Name, Cost, Next Renewal, Date Added
4. Subscription cards in a scrollable list:
   - Each card: category icon (or default 💳), subscription name, billing cycle label, monthly cost, next renewal date
   - Swipe left to delete (with confirmation)
   - Tap to open detail screen
5. If no subscriptions: empty state with illustration and "Add your first subscription" CTA
6. FAB: "+" to add

**Add Subscription (subscription/add.tsx):**
1. Form fields:
   - Name (required, text input)
   - Cost (required, currency input in dollars, stored as cents)
   - Billing cycle (required, picker: Weekly/Monthly/Quarterly/Yearly/Lifetime)
   - Category (optional, picker from sb_categories)
   - Start date (optional, date picker, defaults to today)
   - URL (optional, text input, validated as URL)
   - Notes (optional, multiline text)
   - Notification toggle (default: on)
   - Notification days before renewal (default: 3, number input)
2. "Save" button validates and calls `createSubscription`
3. On success: navigates back to the list with the new subscription visible
4. On validation error: inline error messages on the relevant fields

**Subscription Detail (subscription/[id].tsx):**
1. Header: subscription name, category icon, accent-colored status badge
2. Cost section: monthly cost, annual cost, billing cycle, next renewal date
3. Info section: start date, URL (tappable link), notes
4. Actions section:
   - "Edit" button: opens add/edit form pre-filled
   - "Pause" / "Resume" button: toggles status between active/paused
   - "Cancel Subscription" button: sets status to cancelled, prompts for confirmation
   - "Delete" button: removes subscription entirely, with confirmation dialog
5. If price history exists (added by Cost Analysis feature later): placeholder section "Price History" with "Coming soon" text
6. Back navigation to list

**Settings Tab (settings.tsx):**
1. "Categories" section:
   - List of all categories with icon, name, subscription count
   - "Add Category" button at bottom
   - Swipe to delete category (with confirmation showing how many subs will be uncategorized)
   - Tap to edit category (name, icon, color)
2. "Notifications" section:
   - Global notification toggle
   - Default days-before-renewal picker (1-30)
3. "Data" section:
   - "Export Subscriptions" button (exports as CSV)
   - "Subscription count" and "Total monthly cost" read-only stats

**Calendar Tab (calendar.tsx):**
- Placeholder screen with message: "Renewal calendar coming soon"
- Shows a static list of next 5 upcoming renewals as a preview
- This tab is fully implemented by the Renewal Calendar feature spec

### Edge Cases

- **No subscriptions:** Dashboard shows $0.00 totals and "Add your first subscription" CTA. Subs list shows empty state.
- **All subscriptions cancelled:** Dashboard totals show $0.00. Filter "Active" shows empty. Filter "Cancelled" shows all.
- **Currency display:** Always display as USD with 2 decimal places. $0.00 is valid. Negative values should not be possible (enforced at input).
- **Very long subscription name:** Truncate with ellipsis on cards. Full name visible on detail screen.
- **Cost input:** Accept dollar amounts (e.g., "9.99"). Convert to cents for storage (999). Handle inputs without decimals ("10" = $10.00 = 1000 cents).
- **URL validation:** Accept with or without protocol. Prepend "https://" if no protocol provided.
- **Deep link to deleted subscription:** Show "Subscription not found" screen with back navigation.
- **Module disabled mid-use:** Module registry handles this. Routes become inaccessible.
- **Rapid adds:** Each `createSubscription` call generates a UUID independently. No collision risk.
- **Keyboard avoidance:** Form inputs must remain visible when the keyboard is open on mobile.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Dashboard tab shows total monthly cost, total annual cost, and active subscription count
- [ ] **AC-2:** Dashboard shows upcoming renewals for the next 7 days
- [ ] **AC-3:** Dashboard shows quick stats (most expensive, cheapest, average)
- [ ] **AC-4:** Subs tab displays all subscriptions in a scrollable list
- [ ] **AC-5:** Search bar filters subscriptions by name in real-time
- [ ] **AC-6:** Status filter pills (All/Active/Paused/Cancelled/Trial) filter the list
- [ ] **AC-7:** Sort options change list order correctly
- [ ] **AC-8:** Tapping a subscription card opens its detail screen
- [ ] **AC-9:** Add subscription form validates required fields and shows inline errors
- [ ] **AC-10:** Successfully adding a subscription returns to the list with the new sub visible
- [ ] **AC-11:** Detail screen shows all subscription information
- [ ] **AC-12:** Pause/Resume toggles subscription status
- [ ] **AC-13:** Cancel sets status to "cancelled" with confirmation
- [ ] **AC-14:** Delete removes subscription with confirmation
- [ ] **AC-15:** Settings tab shows categories with subscription counts
- [ ] **AC-16:** Adding/editing/deleting categories works
- [ ] **AC-17:** Calendar tab shows placeholder with next 5 upcoming renewals
- [ ] **AC-18:** FAB "+" button navigates to add subscription form on both Dashboard and Subs tabs
- [ ] **AC-19:** All screens render correctly on both mobile (Expo) and web (Next.js)

### Technical Criteria
- [ ] **TC-1:** All 4 tabs are wired in `_layout.tsx` matching `definition.ts` navigation
- [ ] **TC-2:** Mobile routes: `(subs)/index`, `(subs)/subscriptions`, `(subs)/calendar`, `(subs)/settings`, `(subs)/subscription/[id]`, `(subs)/subscription/add`
- [ ] **TC-3:** Web routes: `/subs`, `/subs/subscriptions`, `/subs/calendar`, `/subs/settings`
- [ ] **TC-4:** Cost display uses `formatCost(cents)` helper (never inline math)
- [ ] **TC-5:** All data fetching uses CRUD functions from `@mylife/subs` (no raw SQL in components)
- [ ] **TC-6:** Cool Obsidian design tokens used for all colors, borders, backgrounds
- [ ] **TC-7:** Module accent color `#10B981` used for active tab indicator and accent elements
- [ ] **TC-8:** Empty states have illustrations and CTAs (not just blank screens)
- [ ] **TC-9:** Delete operations show confirmation dialogs before proceeding
- [ ] **TC-10:** `pnpm typecheck` passes with no errors
- [ ] **TC-11:** Module definition registers these routes in its navigation config

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** No raw SQL queries in UI components (all via CRUD layer)
- [ ] **NC-2:** No hardcoded colors (use Cool Obsidian tokens only)
- [ ] **NC-3:** No automatic deletion without user confirmation
- [ ] **NC-4:** No landscape-only layouts (all screens must work in portrait)
- [ ] **NC-5:** Currency input must NOT allow negative values

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#10B981` (emerald green, from definition.ts)
- Text primary: `#F0F0F5`
- Text secondary: `rgba(240,240,245,0.65)`
- Tab bar: standard Cool Obsidian tab bar with accent indicator on active tab

Dashboard layout:
```
[Hero Card - Glass]
  Total Monthly: $147.93       Active: 12 subs
  Total Annual: $1,775.16

[Upcoming Renewals]
  [Card] 🎵 Spotify     $10.99/mo    in 2 days
  [Card] ☁️ iCloud      $2.99/mo     in 5 days

[Quick Stats Row]
  Most Expensive    Cheapest       Average
  Adobe CC $59.99   iCloud $2.99   $12.33

[+ FAB]
```

Subscription list card:
```
[Glass Card]
  [Category Icon]  Netflix                    $22.99/mo
                   Monthly • Renews Mar 28    →
```

Add form:
```
[Name]            Netflix
[Cost]            $22.99
[Billing Cycle]   Monthly          [picker]
[Category]        Streaming        [picker]
[Start Date]      Jan 1, 2025     [date picker]
[URL]             netflix.com/account
[Notes]           Standard plan, 4K

[🔔 Notify before renewal]        [toggle: ON]
[Days before]     3                [stepper]

                              [Save Subscription]
```

### Web (Next.js)

- Same Cool Obsidian tokens via CSS variables in `globals.css`
- Sidebar navigation: MySubs icon (💳) in sidebar, clicking opens `/subs`
- Dashboard is the default route (`/subs`)
- Subscription detail opens as a right-side panel or modal (not a separate page)
- Responsive: single column on mobile widths, two-column on desktop

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards on Dashboard and Subs tabs | Initial data fetch |
| Empty | "Add your first subscription" CTA with illustration | No subscriptions in database |
| Error | "Could not load subscriptions" with retry button | Database query fails |
| Success | Populated cards with costs and renewal dates | Subscriptions exist |
| Partial | Some cards loaded, skeleton for others | Large dataset, progressive load |

## Test Requirements

### Unit Tests
- [ ] `formatCost(2299)` returns "$22.99"
- [ ] `formatCost(0)` returns "$0.00"
- [ ] `formatCost(1000)` returns "$10.00"
- [ ] `formatBillingCycle('monthly')` returns "Monthly"
- [ ] `formatBillingCycle('yearly')` returns "Yearly"
- [ ] `formatNextRenewal('2026-03-25')` returns "in 3 days" (relative)
- [ ] `formatNextRenewal(null)` returns "No renewal date"
- [ ] `parseCostInput('9.99')` returns 999
- [ ] `parseCostInput('10')` returns 1000
- [ ] `parseCostInput('')` returns null (validation error)
- [ ] `parseCostInput('-5')` returns null (validation error)

### Integration Tests
- [ ] Full add flow: fill form -> save -> list shows new subscription -> tap -> detail correct
- [ ] Edit flow: tap sub -> edit -> change name and cost -> save -> list and detail reflect changes
- [ ] Delete flow: tap sub -> delete -> confirm -> sub removed from list
- [ ] Filter flow: add 2 active + 1 cancelled -> filter "Active" shows 2, filter "Cancelled" shows 1
- [ ] Search flow: add "Netflix" and "Spotify" -> search "net" -> only Netflix shown
- [ ] Empty state: fresh module -> empty state CTA shown -> add sub -> CTA disappears

### QA Verification Script

1. Open the app on iOS/web
2. Navigate to Hub Dashboard
3. Find MySubs card and tap to enter module
4. Verify: Dashboard tab is active, shows $0.00 totals -- AC-1 empty state
5. Verify: "Add your first subscription" CTA visible -- empty state
6. Tap the "+" FAB -- AC-18
7. Verify: Add subscription form opens -- AC-9
8. Try saving without filling required fields
9. Verify: Inline error messages appear on Name and Cost -- AC-9
10. Fill in: Name="Netflix", Cost=$22.99, Cycle=Monthly, Category=Streaming
11. Tap Save -- AC-10
12. Verify: Returns to list with Netflix visible -- AC-10
13. Add two more: Spotify ($10.99/mo), Adobe CC ($59.99/mo)
14. Tap "Subs" tab -- AC-4
15. Verify: 3 subscriptions displayed in list -- AC-4
16. Type "net" in search bar -- AC-5
17. Verify: Only Netflix shown -- AC-5
18. Clear search, tap "Active" filter pill -- AC-6
19. Verify: All 3 shown (all active) -- AC-6
20. Tap Netflix card -- AC-8
21. Verify: Detail screen shows all Netflix info -- AC-11
22. Tap "Pause" -- AC-12
23. Verify: Status changes to "Paused" -- AC-12
24. Go back to list, tap "Active" filter
25. Verify: Only 2 shown (Netflix is paused) -- AC-6
26. Tap Netflix, tap "Resume" -- AC-12
27. Tap Netflix, tap "Delete" -- AC-14
28. Verify: Confirmation dialog appears -- AC-14
29. Confirm deletion
30. Verify: Netflix removed from list -- AC-14
31. Go to Dashboard tab
32. Verify: Totals show $70.98/mo ($10.99 + $59.99) -- AC-1
33. Tap Settings tab -- AC-15
34. Verify: Categories shown with counts -- AC-15
35. Add a new category "VPN" -- AC-16
36. Verify: Category appears in list -- AC-16
37. Tap Calendar tab -- AC-17
38. Verify: Placeholder with upcoming renewals preview -- AC-17
39. Repeat key steps on web -- AC-19

## gstack Quality Gates

Based on Complexity score 2 (Large), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Large features (Complexity <= 2):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /subs, click every button, verify all 5 states (loading/empty/error/success/partial)
- [ ] After 5 features in subs module: `/qa` on /subs

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- subs has no standalone counterpart, N/A
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Database schema and CRUD functions exist. Module has no visual presence. No routes registered in mobile or web apps.

### After This Work
- Full 4-tab UI on mobile (Expo) and web (Next.js).
- Dashboard with cost summary and upcoming renewals.
- Subscription list with search, filters, and sorting.
- Add/edit subscription form with validation.
- Subscription detail screen with pause/resume/cancel/delete actions.
- Settings with category management and notification preferences.
- Calendar tab placeholder ready for Renewal Calendar feature.

### Files Changed
- `apps/mobile/app/(subs)/_layout.tsx` -- NEW: Tab navigator
- `apps/mobile/app/(subs)/index.tsx` -- NEW: Dashboard tab
- `apps/mobile/app/(subs)/subscriptions.tsx` -- NEW: Subscription list
- `apps/mobile/app/(subs)/calendar.tsx` -- NEW: Calendar placeholder
- `apps/mobile/app/(subs)/settings.tsx` -- NEW: Settings
- `apps/mobile/app/(subs)/subscription/[id].tsx` -- NEW: Detail screen
- `apps/mobile/app/(subs)/subscription/add.tsx` -- NEW: Add/edit form
- `apps/web/app/subs/layout.tsx` -- NEW: Web layout
- `apps/web/app/subs/page.tsx` -- NEW: Dashboard
- `apps/web/app/subs/subscriptions/page.tsx` -- NEW: Subscription list
- `apps/web/app/subs/calendar/page.tsx` -- NEW: Calendar placeholder
- `apps/web/app/subs/settings/page.tsx` -- NEW: Settings
- `modules/subs/src/components/hooks.ts` -- NEW: React hooks for data fetching
- `modules/subs/src/components/formatters.ts` -- NEW: Display formatting helpers

### Known Limitations
- **No subscription catalog/autocomplete.** Users type subscription names manually. A catalog (like Budget's 215-entry catalog) could be added later.
- **No bank sync.** All subscriptions are manually entered. Subscription Detection feature addresses auto-detection.
- **Calendar tab is a placeholder.** Full calendar implementation is a separate feature spec.
- **No price history display.** Detail screen has a placeholder for this. Cost Analysis feature adds the full view.
- **No CSV import.** Only manual add for now.

### Context for Next Agent
- Tab navigation keys in `definition.ts` are `dashboard`, `subscriptions`, `calendar`, `settings`. Match these exactly in `_layout.tsx`.
- Screen names are `sub-detail` and `add-sub` in `definition.ts`. The mobile routes `subscription/[id]` and `subscription/add` map to these.
- Use the `useSubscriptions` hook for data fetching, not direct CRUD calls in components. This centralizes loading/error state management.
- The `formatCost` helper must handle cents-to-dollars conversion. Never display raw cents in the UI.
- The FAB should be consistent with other MyLife modules that use FABs (e.g., Budget's transaction add button).
- Category icons use Lucide icon names (lowercase-with-hyphens). The icon picker in Settings should offer a subset of common Lucide icons.
- The Calendar tab placeholder deliberately avoids implementing any calendar logic. The Renewal Calendar spec handles that completely.
