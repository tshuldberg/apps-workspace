# MySubs -- UI/UX Design Prompt

Tagline: Track every subscription in one place
Icon: 💳 | Accent: #8B5CF6 | Tier: Premium
Note: MySubs is being absorbed into MyBudget. Mobile UI hidden but screens exist. Designed here for reference and future use.
Bottom tabs: Home | Subscriptions | Calendar | Analytics | Settings

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MySubs
Accent color: #8B5CF6 (violet/purple)
Platform: Mobile (Expo / React Native)
Total screens: 10

---

SCREEN 1 — HOME (index.tsx) [Mobile, Tab: Home]

- Total monthly cost card
  - Large glass card at top
  - Monthly total displayed very large (e.g. "$142.97/mo")
  - Annual total shown below in smaller text (e.g. "$1,715.64/yr")
  - Trend indicator: up/down arrow compared to last month
- Subscription count
  - Badge or pill: "18 active subscriptions"
- Next 5 renewals list
  - Section header: "Coming Up"
  - Each row: service name, icon/logo placeholder, renewal date, cost
  - Days until renewal badge (e.g. "in 3 days", "tomorrow", "today" in red)
  - Sorted by nearest renewal date
  - Tap to navigate to subscription Detail
- Quick add button
  - FAB or header button: "+" to add new subscription
- Alert banner (conditional)
  - Shown when a renewal is within 24 hours
  - Amber or red background: "Netflix renews tomorrow -- $15.99"

---

SCREEN 2 — SUBSCRIPTIONS (subscriptions.tsx) [Mobile, Tab: Subscriptions]

- Full subscription list
  - Each row: service name, icon/logo placeholder, cost (e.g. "$9.99/mo"), billing cycle badge (Monthly/Yearly/Weekly)
  - Category badge: color-coded pill (Streaming, Music, Software, Gaming, News, Health, Cloud, Other)
  - Active/paused/cancelled status indicator
  - Tap to navigate to Detail
- Sort controls
  - Sort by: cost (high to low), cost (low to high), renewal date, name, category
- Filter
  - Filter by category, billing cycle, status
- Summary bar at top
  - Total monthly cost, subscription count
- Search
  - Search bar to filter subscriptions by name

---

SCREEN 3 — ADD (add.tsx) [Mobile, accessed from Home or Subscriptions]

- Service name input
  - Text input with autocomplete suggestions from catalog (Screen 8)
  - If matched from catalog, auto-fills icon and category
- Cost input
  - Numeric input with currency symbol
  - Currency selector if non-default
- Billing cycle picker
  - Segmented control or dropdown: Weekly, Monthly, Quarterly, Yearly, Custom
  - Custom: number input + period selector (days/weeks/months)
- Category selector
  - Grid or list of category options: Streaming, Music, Software, Gaming, News, Health, Cloud, Productivity, Other
  - Color-coded category icons
- Start date picker
  - Date picker, defaults to today
  - "First billing date" label
- Detection vs manual toggle
  - Toggle: "Auto-detected" / "Manual entry"
  - If auto-detected, shows source transaction reference
  - Manual entries are user-created
- Notes field (optional)
  - Free text for additional details (e.g. plan name, shared with)
- Save button
  - Full-width: "Add Subscription"

---

SCREEN 4 — DETAIL ([id].tsx) [Mobile, accessed from any subscription tap]

- Service header
  - Service name large, icon/logo placeholder, category badge
  - Active/paused/cancelled status badge
- Cost and cycle info
  - Cost per cycle displayed prominently (e.g. "$14.99/mo")
  - Equivalent annual cost shown below
  - Billing cycle: "Monthly, renews on the 15th"
  - Next renewal date with countdown
- Renewal history
  - List of past renewal dates with amounts
  - Shows if cost changed between renewals
  - Total spent on this subscription
- Cancel link
  - "Cancel Subscription" button
  - Opens cancellation URL if known, or marks as cancelled internally
  - Cancellation date tracking
- Linked detection source
  - If auto-detected: shows bank/transaction source reference
  - "Detected from [source name]" badge
- Edit button
  - Edit all fields (name, cost, cycle, category, notes)
- Delete button
  - "Delete" in danger red, with confirmation dialog

---

SCREEN 5 — CALENDAR (calendar.tsx) [Mobile, Tab: Calendar]

- Month calendar view
  - Standard calendar grid
  - Renewal dots on dates where subscriptions renew
  - Dot color matches subscription category
  - Multiple dots if multiple renewals on same day
  - Today highlighted with accent border
- Month navigation
  - Left/right arrows, month/year label centered
- Upcoming list below calendar
  - Section: "This Month's Renewals"
  - Sorted list of all renewals for the displayed month
  - Each row: service name, date, cost, category badge
  - Total for the month displayed at section header
- Day detail on tap
  - Tapping a day with renewals shows bottom sheet
  - Lists all renewals on that day with costs
  - Total cost for that day

---

SCREEN 6 — DETECT (detect.tsx) [Mobile, accessed from Home or Settings]

- Auto-detect subscriptions section
  - Explanation text: "Detect recurring charges from your bank transactions"
  - "Scan Transactions" button to initiate detection
- Detection results
  - List of detected recurring patterns
  - Each row: merchant name, amount, detected frequency, confidence percentage
  - "Match" button to confirm and add as subscription
  - "Dismiss" button to ignore detection
- Review matches
  - Matched subscriptions shown with green checkmark
  - Unmatched/dismissed shown with gray X
  - "Add All Matches" bulk action button
- Detection settings
  - Minimum confidence threshold slider
  - Lookback period: 3 months, 6 months, 12 months
- Status
  - Last scan date and time
  - Number of active detections

---

SCREEN 7 — ANALYTICS (analytics.tsx) [Mobile, Tab: Analytics]

- Cost breakdown by category
  - Donut/pie chart, each slice is a category color
  - Legend with category name, color swatch, monthly cost, percentage
  - Tap slice to highlight and show detail
- Spending trends line chart
  - Line chart showing total monthly subscription cost over last 12 months
  - Data points at each month
  - Trend line overlay showing direction
- Year-over-year comparison
  - Two bars per month: this year vs last year
  - Net change displayed: "+$23.99 vs last year"
- Summary stats cards
  - Most expensive subscription (name + cost)
  - Cheapest subscription (name + cost)
  - Average cost per subscription
  - Total annual spend
- Category growth
  - Which categories are growing vs shrinking in cost

---

SCREEN 8 — CATALOG (catalog.tsx) [Mobile, accessed from Add screen or Browse]

- 215-entry subscription service catalog
  - Scrollable list of known subscription services
  - Each row: service name, icon/logo placeholder, typical price range, category badge
- Search
  - Search bar at top to filter catalog
  - Real-time filtering as user types
- Category filter
  - Horizontal scrollable category chips: All, Streaming, Music, Software, Gaming, News, Health, Cloud, Productivity
  - Tap to filter by category
- Add from catalog
  - Tap a catalog entry to pre-fill the Add screen
  - Auto-fills: name, icon, category, typical billing cycle
  - User confirms/adjusts cost and start date
- Popular section
  - "Popular" section at top with most commonly tracked services
- Alphabetical sections
  - Letter section headers for browsing

---

SCREEN 9 — OPPORTUNITIES (opportunities.tsx) [Mobile, accessed from Home or Analytics]

- Cost-saving suggestions
  - Section header: "Save Money"
  - Card-based layout for each opportunity
- Unused subscription detection
  - Cards for subscriptions with no detected usage in 30+ days
  - Each card: service name, monthly cost, "Last used: X days ago"
  - "Cancel" and "Keep" action buttons
- Cheaper alternatives
  - Cards suggesting lower-cost alternatives for current subscriptions
  - "Switch from [Current] to [Alternative] and save $X/mo"
  - Comparison: features, price, savings
- Bundle opportunities
  - Cards identifying services that could be bundled
  - "Bundle [Service A] + [Service B] with [Bundle Name] and save $X/mo"
- Total potential savings
  - Summary card at top: "You could save up to $XX.XX/mo"
  - Breakdown: unused ($X), alternatives ($X), bundles ($X)
- Dismissal
  - "Dismiss" button on each suggestion
  - Dismissed suggestions hidden but recoverable in settings

---

SCREEN 10 — SETTINGS (settings.tsx) [Mobile, Tab: Settings]

- Notification preferences
  - Toggle: renewal reminders (with days-before picker: 1, 3, 7 days)
  - Toggle: price change alerts
  - Toggle: new detection alerts
  - Toggle: monthly summary notification
- Currency
  - Currency picker (USD, EUR, GBP, etc.)
  - Affects all cost displays
- Detection sensitivity
  - Slider: Low / Medium / High
  - Low: only high-confidence matches
  - High: includes uncertain matches for review
- Data management
  - Import subscriptions (CSV)
  - Export subscriptions (CSV)
  - Sync settings
- Dismissed opportunities
  - List of dismissed saving suggestions
  - "Restore" button to bring back dismissed items
- Categories
  - Custom category management
  - Add, rename, recolor, delete categories
- About
  - Catalog version and update status
  - "215 services in catalog"
```
