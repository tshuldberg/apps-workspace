# Feature Spec: MyHomes Full Mobile UI

## Metadata
- **Module:** homes
- **Priority Score:** 38 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 4 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 4 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 8-10 hours
- **Depends On:** none (all 7 engines + 14 tables + 60+ CRUD functions already exist)
- **Blocks:** homes web UI, homes cross-module integrations (budget cost sync, meds appliance reminders)

## Business Context

### Why This Feature Exists
MyHomes has 90+ exported functions across 7 engines and 14 database tables covering property management, maintenance scheduling, cost tracking, document storage, contractor management, insurance tracking, home inventory, appliance management, and renovation project planning. All of this backend infrastructure is complete and tested, but the mobile UI is a single placeholder screen that only shows a basic listings feed. The module is entirely unusable as a product. This spec designs the full mobile experience: 9 screens organized into 5 tabs that surface every feature the backend already supports.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| HomeZada | Yes | Free + Pro ($59/yr) | Property dashboard, maintenance reminders, inventory by room, document storage, project budgets |
| Centriq | Yes | Free + Premium ($4.99/mo) | Appliance manual lookup, maintenance schedules, product registration, warranty tracking |
| Homer | Yes | Free | Property profile, maintenance tasks, appliance catalog, contractor contacts |
| Notion/Sheets | DIY | Free | Users build custom property management databases, no mobile-native UX |

### Target User
Homeowners and renters who currently use spreadsheets, Notion databases, or paper folders to track maintenance, warranties, contractors, and home costs. The key switching trigger is the first maintenance emergency: "Who was that plumber we used last year?" or "When did we last flush the water heater?" MyHomes answers those questions instantly. The premium tier targets users who want all property management in one place alongside their budget, health, and workout tracking.

## Technical Context

### Where This Lives in MyLife

```
apps/mobile/app/(homes)/
  _layout.tsx                    -- Tabs navigator (4 tabs) + hidden stack screens (books pattern)
  index.tsx                      -- Dashboard tab (complete rewrite)
  properties.tsx                 -- Properties list tab
  maintenance.tsx                -- Maintenance dashboard tab
  insights.tsx                   -- Cross-property intelligence tab (renamed from manage.tsx)
  settings.tsx                   -- Settings screen (pushed from gear icon, NOT a tab)
  onboarding.tsx                 -- First-run wizard (hidden, pushed conditionally)
  property/[id].tsx              -- Property detail (stack screen)
  property/add.tsx               -- Add/edit property form (stack screen)
  maintenance/[id].tsx           -- Schedule detail (stack screen)
  maintenance/add.tsx            -- Add/edit maintenance schedule (stack screen)
  cost/index.tsx                 -- Cost history list (stack screen, filterable by property)
  cost/[id].tsx                  -- Cost entry detail (stack screen)
  cost/add.tsx                   -- Add cost entry form (stack screen)
  contractor/index.tsx           -- Contractor directory (stack screen)
  contractor/[id].tsx            -- Contractor detail (stack screen)
  contractor/add.tsx             -- Add/edit contractor form (stack screen)
  insurance/index.tsx            -- Insurance policies list (stack screen)
  insurance/[id].tsx             -- Policy detail (stack screen)
  insurance/add.tsx              -- Add/edit policy form (stack screen)
  inventory/index.tsx            -- Inventory manager (stack screen)
  inventory/room/[id].tsx        -- Room detail with items (stack screen)
  inventory/item/[id].tsx        -- Inventory item detail (stack screen)
  inventory/item/add.tsx         -- Add/edit inventory item (stack screen)
  appliance/index.tsx            -- Appliance registry (stack screen)
  appliance/[id].tsx             -- Appliance detail (stack screen)
  appliance/add.tsx              -- Add/edit appliance (stack screen)
  project/index.tsx              -- Project list (stack screen)
  project/[id].tsx               -- Project detail with phases + photos (stack screen)
  project/add.tsx                -- Add/edit project (stack screen)
  document/index.tsx             -- Document vault (stack screen)
  document/[id].tsx              -- Document detail (stack screen)
  document/add.tsx               -- Add/edit document (stack screen)
```

### Wireframe Position

```
Hub Dashboard
  |-- MyHomes card
       |-- (homes) tab navigator
            |-- Dashboard tab (index.tsx)
            |     |-- Property summary cards
            |     |-- Urgent maintenance alerts
            |     |-- Quick actions grid
            |     |-- Cost snapshot
            |
            |-- Properties tab (properties.tsx)
            |     |-- Property list
            |     |-- [tap] -> Property Detail (property/[id].tsx)
            |     |     |-- Property info header
            |     |     |-- Section cards: Maintenance, Costs, Docs, Insurance, Inventory, Appliances, Projects
            |     |     |-- Each section -> respective detail screens
            |     |-- [+] -> Add Property (property/add.tsx)
            |
            |-- Maintenance tab (maintenance.tsx)
            |     |-- Status filter chips (All, Overdue, Due Soon, OK)
            |     |-- Property filter (if multiple)
            |     |-- Schedule cards sorted by urgency
            |     |-- [tap] -> Schedule Detail (maintenance/[id].tsx)
            |     |-- [+] -> Add Schedule (maintenance/add.tsx)
            |
            |-- Manage tab (manage.tsx)
            |     |-- Grid: Projects, Inventory, Documents, Insurance, Contractors, Appliances
            |     |-- Each -> respective index screen
            |
            |-- Settings tab (settings.tsx)
                  |-- Notification preferences
                  |-- Default property selector
                  |-- Data export (CSV)
```

### Data Model Summary

14 tables across 3 schema migrations:

| Table | Key Fields | Engine |
|-------|-----------|--------|
| `hm_listings` | address, price, status, is_saved | -- |
| `hm_tours` | listing_id, tour_at, agent_name | -- |
| `hm_properties` | name, type, ownership, year_built | reminder-engine |
| `hm_maintenance_schedules` | task_type, interval_months, next_due, snooze | reminder-engine |
| `hm_settings` | key/value pairs | -- |
| `hm_cost_entries` | category, amount, vendor, receipt_photo | cost-engine |
| `hm_documents` | title, category, file_uri, expiry_date | document-engine |
| `hm_contractors` | name, specialty, rating, is_favorite | contractor-engine |
| `hm_contractor_services` | contractor_id, service_date, cost, rating | contractor-engine |
| `hm_insurance_policies` | provider, policy_type, coverage, premium, dates | insurance-engine |
| `hm_rooms` | name, room_type, sort_order | inventory-engine |
| `hm_inventory_items` | name, category, value, condition, warranty | inventory-engine |
| `hm_appliances` | name, brand, model, warranty, condition | appliance-engine |
| `hm_projects` | name, status, budget, actual_cost, phases | project-engine |
| `hm_project_phases` | name, status, budget, contractor_id | project-engine |
| `hm_project_photos` | photo_uri, photo_type, caption | project-engine |

### Dependencies
- **Internal:** `@mylife/homes` (all 7 engines, all CRUD functions), `@mylife/ui` (Cool Obsidian tokens, Card, Text), `@mylife/db` (database provider)
- **External:** `expo-router` (tabs + stack), `expo-image-picker` (receipt photos, appliance photos, project photos), `expo-document-picker` (document uploads), `expo-file-system` (local file storage), `expo-haptics` (completion feedback)
- **Cross-Module:** None for V1. Future: budget module cost sync, meds module appliance reminders.

## Screen Designs

### Screen 1: Dashboard Tab (`index.tsx`)

**Purpose:** At-a-glance overview of your home with alerts and quick actions. Follows the hub dashboard pattern: hero greeting, then actionable content.

**Layout:**
```
[ScrollView]
  Hero Greeting (matches hub dashboard pattern)
    - "Your Home" or property name (heroTitle, 36px/800)
    - Address subtitle (body, textSecondary)
    - Property type + ownership badges (label style, inline)
    - If multiple properties: horizontal pill selector below greeting
      (each pill = property name, selected = module amber fill)

  Alert Section (conditional, only if actionable items exist)
    - NOT a generic banner. Individual alert rows with specific actions:
    - Each row: icon + "HVAC filter is 3 days overdue" + [Mark Done] button
    - Max 3 most urgent items shown, "View all X alerts" link if more
    - Red left-accent for overdue, amber for due-soon/expiring
    - Empty state: this section is hidden entirely (no "all clear" clutter)

  Quick Actions (horizontal scroll, NOT a grid)
    - Pill-shaped buttons in a single horizontal row
    - "Log Cost" | "Add Task" | "Find Pro" | "Scan Doc"
    - Each pill: glass.strong background, icon + label, module amber icon tint
    - Horizontal scroll allows future actions without layout changes

  This Month (cost snapshot, full-width glass card)
    - Large number: "$1,240" (stat, 24px/700, module amber)
    - Subtitle: "spent this month across 5 categories"
    - Compact category bar below (5 segments, colored, proportional)
    - Tap anywhere -> cost/index.tsx?propertyId=X (cost history list)

  Upcoming (maintenance preview, full-width)
    - Section heading: "Coming Up" (subheading, 18px/600)
    - Top 3 schedules sorted by urgency (compact rows)
    - Each: status dot (color) + task label + due date (right-aligned, caption)
    - "View All" footer link -> maintenance tab

  Property Switcher (only if 2+ properties)
    - Positioned at top, integrated into hero greeting as pill selector
    - NOT a separate section at the bottom
```

**Visual Hierarchy:**
1. Hero greeting with property name (36px, largest element)
2. Alert rows (colored accents draw immediate attention)
3. Cost stat (large amber number, second eye-catch)
4. Upcoming maintenance (compact, scanned vertically)
5. Quick actions (horizontal, non-dominant, always reachable)

**Engine Functions Used:**
- `getHomeMarketMetrics(db)` -- listing stats (if any listings exist)
- `getAllActiveSchedules(db)` + `calculateScheduleStatus()` + `sortByUrgency()` -- maintenance alerts
- `getCostEntriesForProperty(db, propertyId)` + `getCostSummary()` -- cost snapshot
- `getExpiringPolicies(policies, 30)` -- insurance alerts
- `getAppliancesNeedingAttention(appliances)` -- appliance alerts
- `getProperties(db)` -- property list for switcher

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton cards (shimmer) |
| Empty (no properties) | Illustration + "Add your first property" CTA |
| Single property | Dashboard focused on that property, no switcher |
| Multiple properties | Property switcher visible, dashboard shows selected property |
| Has alerts | Alert banner visible with color-coded badges |
| No alerts | Alert banner hidden, dashboard shows "All clear" message |

---

### Screen 2: Properties Tab (`properties.tsx`)

**Purpose:** List all properties with key stats. Entry point for all property-scoped features.

**Layout:**
```
[FlatList]
  Search bar (filters by name/address)

  Property Card (per property)
    - Name (bold), address subtitle
    - Property type + ownership badges
    - Stats row: X tasks | $Y spent | Z docs
    - Accent bar color = module amber (#D97706)
    - [tap] -> property/[id].tsx

  FAB (+) -> property/add.tsx
```

**Engine Functions Used:**
- `getProperties(db)` -- property list
- `getSchedulesForProperty(db, id)` -- task count per property
- `getCostEntriesForProperty(db, id)` + `getLifetimeCosts()` -- spend per property
- `getDocumentsForProperty(db, id)` -- doc count per property

**States:**
| State | What User Sees |
|-------|---------------|
| Loading | Skeleton list |
| Empty | Illustration + "Add your first property" + "Or promote a saved listing" CTA |
| Has properties | Scrollable card list |
| Search active | Filtered list, "No matches" if empty result |

---

### Screen 3: Property Detail (`property/[id].tsx`)

**Purpose:** The hub screen for a single property. Uses a tiered layout to prioritize frequent/urgent features over reference-only sections. Maintenance and costs are checked daily; insurance and inventory are checked monthly at most.

**Layout:**
```
[ScrollView]
  Property Header
    - Name (heading, 24px/700), address (body, textSecondary)
    - Type / ownership / year built / sqft (caption badges)
    - Edit button (top right, ghost style) -> property/add.tsx?id=X

  --- TOP TIER (urgent/frequent, always visible, prominent) ---

  [Maintenance Alert Bar] (full-width glass.strong card)
    - Left: overdue count (danger badge) + due soon count (amber badge)
    - Right: "View All" chevron -> maintenance.tsx (filtered)
    - Below: Next 2 upcoming task previews (task label + due date, compact rows)
    - If all clear: "All maintenance up to date" with success checkmark

  [Cost Summary] (full-width glass card)
    - Left column: This month total (stat, 24px/700, module amber)
    - Right column: Lifetime total (body, textSecondary)
    - Below: Category breakdown mini-bar (5 segments, proportional width)
    - "View All" footer -> cost history

  --- MIDDLE TIER (2-column grid, medium importance) ---

  [Contractors]         [Insurance]
    4 contacts            2 active policies
    Top: Mike (4.8 stars) $2,400/yr premium
    [tap] ->              Coverage gap warning (if any)
    contractor/index      [tap] -> insurance/index

  [Documents]           [Projects]
    12 docs               1 active project
    2 expiring soon       "Kitchen Reno" 67% [progress bar]
    [tap] ->              [tap] ->
    document/index        project/index

  --- BOTTOM TIER (compact list rows, reference-only) ---

  [Inventory] row: "47 items -- $24,000 est. value" [chevron]
    -> inventory/index.tsx?propertyId=X

  [Appliances] row: "8 tracked -- 1 needs attention" [chevron]
    -> appliance/index.tsx?propertyId=X

  --- DANGER ZONE ---
    Delete property button (danger color, with confirmation dialog)
```

**Visual Hierarchy:**
1. Property name (hero, largest text)
2. Maintenance alert bar (urgent, colored badges draw eye)
3. Cost summary (financial snapshot, module amber stat)
4. Middle tier grid (secondary reference)
5. Bottom tier rows (tertiary, accessed occasionally)

**Engine Functions Used:**
- `getProperty(db, id)` -- property data
- `getSchedulesForProperty(db, id)` + `calculateScheduleStatus()` -- maintenance summary
- `getCostEntriesForProperty(db, id)` + `getCostSummary()` -- cost summary
- `getContractorsForProperty(db, id)` + `getFavoriteContractors()` -- contractor summary
- `getPoliciesForProperty(db, id)` + `getActivePolicies()` + `getPolicyCostSummary()` + `checkCoverageGaps()` -- insurance summary
- `getDocumentsForProperty(db, id)` + `getDocumentStats()` + `getExpiringDocuments()` -- document summary
- `getItemsForProperty(db, id)` + `getPropertyInventoryValue()` -- inventory summary
- `getRoomsForProperty(db, id)` -- room count
- `getAppliancesForProperty(db, id)` + `getAppliancesNeedingAttention()` -- appliance summary
- `getProjectsForProperty(db, id)` + `getActiveProjectCount()` -- project summary

---

### Screen 4: Maintenance Dashboard Tab (`maintenance.tsx`)

**Purpose:** Central view of all maintenance schedules across all properties, sorted by urgency.

**Layout:**
```
[SectionList by status]
  Filter chips: All | Overdue | Due Soon | OK
  Property filter dropdown (if multiple properties)

  Section: Overdue (red header)
    Schedule Card
      - Task label (from getTaskTypeLabel)
      - Property name (subtitle)
      - Due date + "X days overdue" in red
      - Actions: Mark Complete | Snooze 7d
      - [tap] -> maintenance/[id].tsx

  Section: Due Soon (amber header)
    Schedule Card (same layout, amber accent)

  Section: OK (green header)
    Schedule Card (same layout, muted)

  FAB (+) -> maintenance/add.tsx
```

**Engine Functions Used:**
- `getAllActiveSchedules(db)` -- all schedules
- `calculateScheduleStatus()` -- per-schedule status
- `sortByUrgency()` -- ordering
- `getTaskTypeLabel()` -- human-readable names
- `markComplete()` -- inline completion action

**Schedule Detail Screen (`maintenance/[id].tsx`):**
```
[ScrollView]
  Task header: type label, property name
  Status badge (overdue/due_soon/ok)
  Key facts: interval, season preference, last completed, next due
  Snooze info (if snoozed): X days snoozed, Y times

  Linked Costs section
    - Cost entries linked to this schedule (via getCostEntriesForSchedule)
    - Total spent on this task
    - [+] -> cost/add.tsx?scheduleId=X

  Linked Contractor section
    - Services linked to this schedule (via getServicesForSchedule)
    - Recommended contractors (via getContractorForTaskType)

  Actions: Mark Complete | Snooze | Edit | Deactivate | Delete
```

**Add/Edit Schedule Screen (`maintenance/add.tsx`):**
```
  Property picker (required)
  Task type picker (14 built-in types + custom)
  Custom task name (if custom selected)
  Interval (months, 1-120)
  Season preference (optional: spring/summer/fall/winter)
  Notes (optional)
  [Save] button
  "Use defaults" button -> getDefaultSchedules(propertyType, ownershipType) to bulk-create
```

---

### Screen 5: Insights Tab (`insights.tsx`, renamed from `manage.tsx`)

**Purpose:** Cross-property intelligence hub. Surfaces aggregated data that no single property detail screen can show. This is where multi-property owners see the big picture. Single-property owners see their home's health score and trends.

**Layout:**
```
[ScrollView]
  Section: Spending Trend (hero position)
    - "All Properties" header (or property name if single)
    - Monthly average spend (stat, 24px/700, module amber)
    - 6-month sparkline bar chart (compact, inline, not a full chart screen)
    - Category distribution below chart (5 color-coded dots with labels)

  Section: Expiring Soon (cross-property timeline)
    - Unified timeline of expiring items across ALL properties:
      policies, documents, warranties (appliances + inventory)
    - Each row: item name, property name, days until expiry, type badge
    - Sorted by urgency (soonest first)
    - Empty state: "Nothing expiring in the next 90 days" with success checkmark

  Section: Overdue Across Properties (conditional, only if overdue items exist)
    - Grouped by property
    - Each: task label, days overdue, property name
    - Inline "Mark Complete" action per task

  Section: Your Contractors (compact roster)
    - Total count + favorites count
    - Top 3 by rating with specialty badge
    - "View All" -> contractor/index.tsx

  Quick Links (bottom, compact list)
    - "Export Inventory CSV" -> triggers exportInventoryCSV
    - "Add Property" -> property/add.tsx
    - "Browse Listings" -> listings section (legacy feature)
```

**Visual Hierarchy:**
1. Spending trend chart (hero, eye-catching data viz)
2. Expiring soon timeline (urgent, action-driving)
3. Overdue tasks (conditional urgency)
4. Contractor roster (reference)
5. Quick links (utility)

Each sub-section is documented below:

#### 5a. Contractor Directory (`contractor/index.tsx`)

```
[SectionList by specialty]
  Search bar
  Filter: All | Favorites | By Specialty dropdown

  Contractor Card
    - Name, company
    - Specialty badge
    - Star rating (1-5)
    - Favorite toggle (heart icon)
    - Phone/email quick actions
    - [tap] -> contractor/[id].tsx

  FAB (+) -> contractor/add.tsx
```

**Contractor Detail (`contractor/[id].tsx`):**
```
  Name, company, specialty
  Contact info: phone (tap to call), email (tap to compose), website (tap to open)
  Address
  Rating (star display)
  Notes

  Service History section
    - List of ContractorService records (via getServicesForContractor)
    - Each: date, description, cost, rating
    - Total spent (via getContractorStats)
    - Average rating

  Actions: Edit | Toggle Favorite | Delete
```

**Engine Functions Used:**
- `getAllContractors(db)` + `getContractorsBySpecialty()` + `getFavoriteContractors()` -- filtering
- `getServicesForContractor(db, id)` + `getContractorStats()` -- service history
- `getContractorForTaskType()` -- task-based recommendations

#### 5b. Insurance Policies (`insurance/index.tsx`)

```
[FlatList]
  Summary header card
    - Total annual premium (from getPolicyCostSummary)
    - Total coverage amount
    - Active policy count

  Coverage Gaps Alert (conditional)
    - From checkCoverageGaps(policies, ownershipType)
    - "Missing homeowners insurance", "No flood insurance", etc.

  Policy Card (per policy)
    - Provider + policy number
    - Policy type badge
    - Coverage / deductible / premium
    - Date range (start - end)
    - Auto-renew indicator
    - Expiring soon badge (if within 30 days)
    - [tap] -> insurance/[id].tsx

  FAB (+) -> insurance/add.tsx
```

**Engine Functions Used:**
- `getPoliciesForProperty(db, id)` -- policy list
- `getActivePolicies()` + `getExpiringPolicies(policies, 30)` -- status filtering
- `getPolicyCostSummary()` -- aggregate stats
- `checkCoverageGaps()` -- gap analysis

#### 5c. Document Vault (`document/index.tsx`)

```
[SectionList by category]
  Search bar (uses searchDocuments engine)
  Category filter chips: All | Deed | Warranty | Insurance | Permit | Receipt | Manual | Contract | Other

  Stats header
    - Total docs, by-category breakdown (from getDocumentStats)
    - Expiring docs count

  Document Card
    - Title, category badge
    - File type icon (PDF/image/other)
    - File size
    - Expiry date (if set, with "Expiring soon" badge)
    - Tags (pill chips)
    - [tap] -> document/[id].tsx

  FAB (+) -> document/add.tsx (with camera/file picker)
```

**Engine Functions Used:**
- `getDocumentsForProperty(db, id)` -- doc list
- `searchDocuments(docs, query)` -- search
- `getExpiringDocuments(docs, 30)` -- expiration alerts
- `getDocumentStats(docs)` -- stats

#### 5d. Inventory Manager (`inventory/index.tsx`)

```
[SectionList by room]
  Summary header
    - Total items, total estimated value (from getPropertyInventoryValue)
    - "Export CSV" button (uses exportInventoryCSV)

  Room Section (per room from getRoomSummary)
    - Room name + type badge
    - Item count + total value
    - [tap room header] -> inventory/room/[id].tsx

    Item Card (per item in room)
      - Name, category badge
      - Brand / model
      - Condition badge (new/good/fair/poor)
      - Estimated value
      - Warranty status (if set)
      - [tap] -> inventory/item/[id].tsx

  High Value Items section (from getHighValueItems, threshold $500)
    - Highlighted items above threshold

  FAB (+) -> inventory/item/add.tsx
```

**Engine Functions Used:**
- `getRoomsForProperty(db, id)` -- room list
- `getItemsForProperty(db, id)` -- all items
- `getPropertyInventoryValue()` -- total value
- `getRoomSummary()` -- per-room breakdown
- `getItemsByCategory()` -- category grouping
- `getHighValueItems(items, 50000)` -- high-value filter ($500+)
- `exportInventoryCSV()` -- CSV export

#### 5e. Appliance Registry (`appliance/index.tsx`)

```
[SectionList by category]
  Search bar (uses searchAppliances engine)
  Category filter: All | HVAC | Kitchen | Laundry | Plumbing | Electrical | Outdoor | Other

  Attention Needed section (conditional, from getAppliancesNeedingAttention)
    - Appliances with expired/expiring warranty or poor condition
    - Red/amber badges

  Appliance Card (per appliance)
    - Name, brand, model number
    - Category badge
    - Condition badge (color-coded)
    - Warranty status badge (active/expiring_soon/expired/unknown via getWarrantyStatus)
    - Photo thumbnail (if set)
    - [tap] -> appliance/[id].tsx

  FAB (+) -> appliance/add.tsx
```

**Appliance Detail (`appliance/[id].tsx`):**
```
  Photo (if available)
  Name, brand, model number, serial number
  Category + condition badges
  Purchase info: date, price
  Warranty: expiry date, status badge
  Manual link (if set, tap to open)
  Linked room (if set)
  Linked maintenance schedule (if set)
  Notes

  Actions: Edit | Delete
```

**Engine Functions Used:**
- `getAppliancesForProperty(db, id)` -- appliance list
- `searchAppliances(appliances, query)` -- search
- `getAppliancesByCategory()` -- category grouping
- `getWarrantyStatus()` -- per-appliance warranty check
- `getAppliancesNeedingAttention()` -- attention filter

#### 5f. Project Tracker (`project/index.tsx`)

```
[SectionList by status]
  Filter chips: All | Active | Planning | On Hold | Completed

  Project Card (per project)
    - Name, category badge, priority badge
    - Status badge (planning/in_progress/on_hold/completed/cancelled)
    - Progress bar (from getProjectSummary.progressPercent)
    - Budget: $X budget / $Y spent (from getBudgetVsActual)
    - Over-budget warning (red) if actual > budget
    - Date range: start - target end
    - [tap] -> project/[id].tsx

  FAB (+) -> project/add.tsx
```

**Project Detail (`project/[id].tsx`):**
```
[ScrollView]
  Project header: name, description
  Status + priority + category badges
  Budget card
    - Budget vs actual bar (from getBudgetVsActual)
    - Remaining amount
    - Percent used

  Phase Timeline (vertical stepper)
    - Each phase: name, status badge, contractor (if assigned), budget
    - Status indicators: pending (gray), in_progress (blue), completed (green), skipped (muted)
    - Progress counts (from getPhaseProgress): X/Y completed
    - [tap phase] -> edit phase inline or bottom sheet

  Photo Gallery
    - Grid of project photos grouped by type (before/during/after/inspiration)
    - [+] -> camera/library picker
    - Swipeable full-screen viewer

  Actions: Edit Project | Add Phase | Add Photo | Delete
```

**Engine Functions Used:**
- `getProjectsForProperty(db, id)` + `getActiveProjects(db)` -- project list
- `getActiveProjectCount()` -- count for manage grid
- `getProjectSummary(project, phases)` -- progress + budget summary
- `getBudgetVsActual(project)` -- budget bar data
- `getPhaseProgress(phases)` -- phase status counts
- `getPhasesForProject(db, id)` -- phase list
- `getPhotosForProject(db, id)` + `getPhotosForPhase(db, phaseId)` -- photo gallery

---

### Screen 6: Settings Tab (`settings.tsx`)

**Purpose:** Module-level preferences and data management.

**Layout:**
```
[ScrollView]
  Section: Notifications
    - Toggle: Maintenance reminders (from getSetting/setSetting)
    - Toggle: Offer default schedules on new property

  Section: Defaults
    - Default property selector (for dashboard)

  Section: Data
    - Export inventory CSV (for selected property)
    - Export all data (future)

  Section: Listings (legacy V1 feature)
    - Link to listing feed (original index.tsx functionality)
    - Promote listing to property shortcut
```

---

## Navigation Architecture

### Tab Navigator (Bottom Tabs)

| Tab | Icon | Route | Label |
|-----|------|-------|-------|
| Dashboard | `home` | `index` | Home |
| Properties | `building` | `properties` | Properties |
| Maintenance | `tool` | `maintenance` | Tasks |
| Insights | `bar-chart-2` | `insights` | Insights |

Settings is accessible via a gear icon in the Dashboard header (top-right), not a dedicated tab. This follows DESIGN.md's "4 tabs max" rule and matches standard iOS conventions. Settings pushes as a stack screen from the gear icon.

### Stack Screens (pushed on top of tabs)

All detail/add screens push onto the stack navigator with back navigation. The stack is defined in `_layout.tsx` wrapping the tab navigator.

### Definition.ts Update Required

The current `definition.ts` navigation defines tabs for `search`, `saved`, `properties`, `reminders`, `profile`. This should be updated to match the new tab structure: `dashboard`, `properties`, `maintenance`, `manage`, `settings`. The screen list should also be expanded to include all sub-screens.

```typescript
navigation: {
  tabs: [
    { key: 'dashboard', label: 'Home', icon: 'home' },
    { key: 'properties', label: 'Properties', icon: 'building' },
    { key: 'maintenance', label: 'Tasks', icon: 'tool' },
    { key: 'insights', label: 'Insights', icon: 'bar-chart-2' },
    // Settings: gear icon in Dashboard header, not a tab (DESIGN.md: 4 tabs max)
  ],
  screens: [
    { name: 'property-detail', title: 'Property' },
    { name: 'add-property', title: 'Add Property' },
    { name: 'schedule-detail', title: 'Maintenance Task' },
    { name: 'add-schedule', title: 'Add Task' },
    { name: 'cost-detail', title: 'Cost Entry' },
    { name: 'add-cost', title: 'Log Cost' },
    { name: 'contractor-directory', title: 'Contractors' },
    { name: 'contractor-detail', title: 'Contractor' },
    { name: 'add-contractor', title: 'Add Contractor' },
    { name: 'insurance-policies', title: 'Insurance' },
    { name: 'insurance-detail', title: 'Policy' },
    { name: 'add-insurance', title: 'Add Policy' },
    { name: 'document-vault', title: 'Documents' },
    { name: 'document-detail', title: 'Document' },
    { name: 'add-document', title: 'Add Document' },
    { name: 'inventory-manager', title: 'Inventory' },
    { name: 'room-detail', title: 'Room' },
    { name: 'inventory-item-detail', title: 'Item' },
    { name: 'add-inventory-item', title: 'Add Item' },
    { name: 'appliance-registry', title: 'Appliances' },
    { name: 'appliance-detail', title: 'Appliance' },
    { name: 'add-appliance', title: 'Add Appliance' },
    { name: 'project-tracker', title: 'Projects' },
    { name: 'project-detail', title: 'Project' },
    { name: 'add-project', title: 'Add Project' },
  ],
},
```

## Functional Requirements

### First-Run Experience

When a user enables MyHomes with zero properties, they see a 3-step quick setup wizard instead of an empty dashboard. The goal: populated dashboard in under 30 seconds.

```
Step 1: "Do you own or rent?" (full-screen, 2 large tappable cards)
  - [I Own] card with house icon
  - [I Rent] card with key icon
  - Skip link at bottom ("I'll set this up later")

Step 2: "What kind of place?" (full-screen, 4 cards in 2x2 grid)
  - [House] [Condo] [Apartment] [Other]
  - Each card: icon + label, selected = module amber border

Step 3: "Name your home" (single form)
  - Name field: pre-filled with "My Home" (editable)
  - Address field: optional, textSecondary placeholder
  - [Get Started] button (module amber, full-width)
```

**On "Get Started":**
1. Creates the property with chosen type + ownership
2. Auto-runs `getDefaultSchedules(propertyType, ownershipType)` to bulk-create maintenance schedules (4-10 depending on type/ownership)
3. Navigates to the populated dashboard with a brief "You're all set" success toast
4. The maintenance tab already has tasks with due dates

**Skip flow:** "I'll set this up later" dismisses the wizard and shows the empty dashboard with warm empty state. Wizard re-triggers on next module open if still zero properties.

**Route:** `apps/mobile/app/(homes)/onboarding.tsx` (stack screen, pushed before tabs on first use)

### User Stories
1. As a homeowner, I want a dashboard showing all my properties with maintenance alerts so I never miss a critical task.
2. As a homeowner, I want to track all costs associated with my home so I can see lifetime spending by category.
3. As a homeowner, I want to store all home documents (deeds, warranties, permits) digitally so I can find them instantly.
4. As a homeowner, I want a contractor directory with ratings and service history so I can quickly find the right person for any job.
5. As a homeowner, I want to track insurance policies with coverage gap analysis so I know I'm properly protected.
6. As a homeowner, I want a room-by-room inventory with values so I have proof for insurance claims.
7. As a homeowner, I want to track appliance warranties and maintenance needs so I can service them before they fail.
8. As a homeowner, I want to plan renovation projects with phases, budgets, and before/after photos so I can manage complex home improvements.
9. As a renter, I want maintenance reminders for tasks that are my responsibility (HVAC filters, smoke detectors) so I keep my rental in good condition.

### Edge Cases

- **Single property:** Dashboard skips the property switcher, property tab shows a single card.
- **No properties yet:** Dashboard shows empty state with "Add your first property" CTA. Maintenance/manage tabs show contextual empty states.
- **Listing promotion:** When a user promotes a listing to a property, pre-fill the property form with listing data (address, city, state, price, sqft).
- **Owner vs renter:** Maintenance default schedules differ (getDefaultSchedules filters for renters). Insurance coverage gap analysis checks for renters vs homeowners insurance.
- **Bulk schedule creation:** When adding a new property, offer "Add recommended maintenance schedules" using getDefaultSchedules presets.
- **Document expiry:** Documents without expiry dates don't appear in "expiring" filters but still appear in the main list.
- **Zero-budget project:** Projects with $0 budget skip the budget vs actual bar and show "No budget set."
- **Appliance without warranty:** getWarrantyStatus returns "unknown" -- display "No warranty info" instead of a colored badge.
- **Cross-property contractors:** Contractors can be linked to a specific property (propertyId) or be global (propertyId null). The directory shows all contractors, with a property filter option.
- **Large inventories:** FlatList with lazy rendering for properties with 100+ items. Room summary shows counts without loading all items.
- **Photo permissions:** Request camera/library permissions before photo capture. Graceful fallback if denied.
- **File size limits:** Document uploads capped at 25MB per file. Show error for oversized files.

## Interaction State Coverage

Every screen should handle the applicable states per DESIGN.md patterns. Empty states use warm copy + module icon + primary CTA (never "No items found."). Loading uses skeleton shapes matching real content layout. Error uses glass card + specific message + retry.

**Important: SQLite reads are synchronous.** Most screens will NOT need loading or error states for data reads -- `useMemo(() => getProperties(db), [db, tick])` returns instantly. Loading/error states apply to: (1) initial database connection, (2) image picker / file operations, (3) form save operations. The "partial failure" column is theoretical for completeness -- in practice, if the DB works, all reads work.

| Feature / Screen | Loading | Empty | Error | Success | Partial |
|-----------------|---------|-------|-------|---------|---------|
| Dashboard | Skeleton: hero text + 3 shimmer rows + sparkline placeholder | "Your home awaits" + house icon + "Add your first property" CTA | Glass card: "Couldn't load your home data" + retry | Full dashboard renders with staggered card animation (50ms per child) | Property loads but some engine calls fail: show available sections, hide failed ones with "Couldn't load costs" inline |
| Properties list | Skeleton: 3 card shapes | "No properties yet" + "Add your first home or promote a saved listing" + dual CTAs | "Couldn't load properties" + retry | Card list with entrance animation | -- |
| Property detail | Skeleton: header + 3 tier placeholders | N/A (always has a property if navigated here) | Per-section error: failed sections show "Couldn't load [section]" inline, others render normally | Tiered layout with all sections populated | Some sections load, others fail: show loaded sections, inline error on failed |
| Maintenance tab | Skeleton: filter chips + 4 card shapes | "All caught up" + checkmark icon + "Your home maintenance is on track" + "Add a task" CTA | "Couldn't load schedules" + retry | Section list by urgency with color-coded headers | -- |
| Maintenance detail | Skeleton: header + key facts + linked sections | N/A | "Couldn't load this task" + back button | Full detail with linked costs/contractors | Linked costs fail: show task info, "Couldn't load cost history" inline |
| Schedule add/edit | Pre-filled form (edit) or empty form (add) | N/A (always a form) | Save failure: inline error "Couldn't save. Check your connection." + retry | Haptic confirmation + auto-navigate back to list | -- |
| Contractor directory | Skeleton: search bar + 3 card shapes | "No contractors yet" + wrench icon + "Add your first pro" CTA | "Couldn't load contractors" + retry | Alphabetical section list by specialty | -- |
| Contractor detail | Skeleton: contact card + service list | N/A | "Couldn't load contractor" + back | Full profile with service history | Services fail to load: show contact info, "Couldn't load history" inline |
| Insurance list | Skeleton: summary card + 2 policy cards | "No policies tracked" + shield icon + "Add your first policy to check coverage" CTA | "Couldn't load policies" + retry | Summary header + gap analysis + policy list | -- |
| Document vault | Skeleton: stats bar + 3 doc cards | "Your vault is empty" + folder icon + "Add a document or scan a receipt" CTA | "Couldn't load documents" + retry | Category-sectioned list | -- |
| Inventory manager | Skeleton: summary + room sections | "Start your inventory" + home icon + "Add a room to begin cataloging" CTA | "Couldn't load inventory" + retry | Room sections with item counts and values | -- |
| Appliance registry | Skeleton: attention section + category groups | "No appliances tracked" + tool icon + "Add your first appliance" CTA | "Couldn't load appliances" + retry | Category-sectioned list with warranty badges | -- |
| Project tracker | Skeleton: filter chips + 2 project cards | "No projects yet" + hammer icon + "Plan your first renovation" CTA | "Couldn't load projects" + retry | Status-sectioned list with progress bars | -- |
| Project detail | Skeleton: header + budget bar + phase timeline | N/A | "Couldn't load project" + back | Full detail with phases and photo gallery | Photos fail: show project + phases, "Couldn't load photos" inline |
| Insights tab | Skeleton: sparkline placeholder + 3 timeline rows | "Add a property to see insights" + chart icon + "Add Property" CTA | "Couldn't load insights" + retry | Spending trend + expiring timeline + overdue list | Some aggregations fail: show available sections, hide failed |
| All add/edit forms | Pre-filled fields (edit) or smart defaults (add) | N/A | Save error: red inline text below [Save] button + field-level validation errors | Haptic success pulse + navigate back | -- |
| Cost add form | Pre-filled if editing, empty if new | N/A | Inline error on save | Haptic + back + refresh parent | Photo attachment fails: "Couldn't attach receipt" + option to save without |

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Dashboard shows hero greeting, alert rows, quick actions, cost snapshot, and upcoming maintenance for the selected property
- [ ] **AC-2:** Properties tab lists all properties with task count, spend total, and document count per property
- [ ] **AC-3:** Property detail screen uses tiered layout: maintenance + costs (top), contractors + insurance + documents + projects (middle grid), inventory + appliances (bottom compact)
- [ ] **AC-4:** Maintenance tab shows all schedules sorted by urgency with status badges (overdue red, due soon amber, ok green)
- [ ] **AC-5:** Inline "Mark Complete" action on maintenance cards recalculates next due date and refreshes the list
- [ ] **AC-6:** Insights tab shows cross-property spending trends, expiring items timeline, and overdue tasks
- [ ] **AC-7:** Contractor directory supports search, specialty filter, and favorites filter
- [ ] **AC-8:** Insurance section shows coverage gaps analysis and policy expiration warnings
- [ ] **AC-9:** Document vault supports search, category filter, and shows expiring documents
- [ ] **AC-10:** Inventory manager shows room-by-room breakdown with total property value
- [ ] **AC-11:** Appliance registry highlights items needing attention (expired warranty, poor condition)
- [ ] **AC-12:** Project tracker shows progress bars, budget vs actual, and phase timeline
- [ ] **AC-13:** All add/edit forms validate required fields and show inline errors
- [ ] **AC-14:** All delete actions require confirmation dialog before executing
- [ ] **AC-15:** Navigation from any detail screen back to its parent tab works correctly
- [ ] **AC-16:** "Add recommended schedules" on new property creates all default presets for the property type/ownership

### Technical Criteria
- [ ] **TC-1:** All screens use Cool Obsidian tokens from `@mylife/ui` (no hardcoded colors)
- [ ] **TC-2:** All CRUD operations use existing `@mylife/homes` functions (no raw SQL)
- [ ] **TC-3:** All engine computations use existing engine functions (no reimplementation)
- [ ] **TC-4:** FlatList/SectionList used for all scrollable lists (not ScrollView with .map)
- [ ] **TC-5:** Image picker requests permissions before use and handles denial gracefully
- [ ] **TC-6:** All monetary values stored in cents and displayed with dollar formatting
- [ ] **TC-7:** Module definition updated with new tab and screen names
- [ ] **TC-8:** All screens support the 5 standard states: loading, empty, error, success, partial

### Negative Criteria
- [ ] **NC-1:** Deleting a property must NOT leave orphaned records (CASCADE handles this)
- [ ] **NC-2:** Cost entries must NOT allow negative amounts
- [ ] **NC-3:** Maintenance snooze must NOT exceed 365 cumulative days
- [ ] **NC-4:** Document upload must NOT accept files larger than 25MB
- [ ] **NC-5:** Phone/email actions on contractor cards must NOT crash if values are null

## UI Specification

### Design Tokens (Cool Obsidian)

All screens use the standard Cool Obsidian palette:

| Token | Usage in Homes |
|-------|---------------|
| `colors.background` (#0A0A0F) | Screen backgrounds |
| `colors.surface` (#12121A) | Card backgrounds |
| `colors.surfaceElevated` (#1A1A24) | Elevated cards, form inputs |
| `colors.text` (#F0F0F5) | Primary text |
| `colors.textSecondary` | Labels, subtitles |
| `colors.border` | Card borders, input borders |
| `colors.modules.homes` (#D97706) | Module accent (amber), primary buttons, active states |
| `colors.danger` (#FF453A) | Overdue badges, delete buttons |
| `colors.success` (#30D158) | OK badges, completion states |

### Status Badges

| Status | Background | Text |
|--------|-----------|------|
| Overdue | `rgba(255,69,58,0.15)` | `#FF453A` |
| Due Soon | `rgba(217,119,6,0.15)` | `#D97706` |
| OK | `rgba(48,209,88,0.15)` | `#30D158` |
| Unknown | `rgba(255,255,255,0.06)` | `colors.textSecondary` |

### Card Internal Typography

All list cards follow a consistent internal layout. These specs prevent implementers from inventing card layouts per screen.

**Property Card (properties tab):**
```
  [Name]          subheading (18px/600), text color
  [Address]       body (16px/400), textSecondary
  [Badges]        label (12px/600, UPPERCASE), in pill containers (4px vert, 8px horiz, sm radius)
  [Stats row]     caption (13px/500), textSecondary, pipe separator in textTertiary
  Internal gap:   sm (8px) between elements
```

**Schedule Card (maintenance tab):**
```
  [Status dot]    8px circle, color per status (danger/amber/success)
  [Task label]    subheading (18px/600), text color
  [Property name] caption (13px/500), textSecondary
  [Due info]      caption, right-aligned. Overdue: danger color. Due soon: amber. OK: textSecondary.
  [Actions row]   ghost buttons, sm spacing, right-aligned
  Internal gap:   sm (8px)
```

**Contractor Card:**
```
  [Name]          subheading (18px/600), text color
  [Company]       body (16px/400), textSecondary
  [Specialty]     label badge (pill, glass.strong background)
  [Star rating]   5 stars, filled = module amber, empty = textTertiary
  [Contact row]   icon buttons (phone, email), 44x44px touch targets, ghost style
  Internal gap:   sm (8px)
```

**Policy Card:**
```
  [Provider]      subheading (18px/600), text color
  [Policy #]      caption (13px/500), textSecondary
  [Type badge]    label pill
  [Coverage/Ded]  body, right column. Dollar amounts in tabular-nums.
  [Date range]    caption, textSecondary
  [Expiring badge] conditional, danger background at 15% opacity
  Internal gap:   sm (8px)
```

**Generic Detail Row (bottom tier of property detail, inventory/appliance compact rows):**
```
  [Icon]          20px, textSecondary
  [Label]         body (16px/400), text color
  [Value]         body, textSecondary, right-aligned
  [Chevron]       16px, textTertiary, right edge
  Row height:     48px (meets 44px touch target)
  Row background: transparent (relies on section grouping)
```

### Navigation Routing: Property-Scoped Views

When section cards on the Property Detail screen route to list views (contractors, insurance, documents, etc.), they push **filtered stack screens** onto the navigation stack, not tab switches. This prevents confusing back-button behavior.

- Property Detail -> "Contractors" card: pushes `contractor/index.tsx?propertyId=X` onto the stack
- Property Detail -> "Insurance" card: pushes `insurance/index.tsx?propertyId=X` onto the stack
- Etc. for all section cards

These filtered stack screens share components with the tab-level equivalents but receive `propertyId` as a route param. The back button returns to Property Detail, not to a different tab.

Tab-level screens (Dashboard, Properties, Maintenance, Insights) show cross-property aggregate data. Stack screens from Property Detail show single-property filtered data.

### Accessibility (per DESIGN.md)

- **Touch targets:** All interactive elements minimum 44x44px. Badge taps, form inputs, list items, action buttons.
- **Screen reader labels:** Every icon-only button has `accessibilityLabel` (e.g., gear icon = "Settings", heart = "Toggle favorite", + FAB = "Add new [context]").
- **Status badges:** Use `accessibilityRole="text"` + label that includes status (e.g., "Overdue, 3 days late" not just the visual color).
- **Form labels:** Every input has an `accessibilityLabel` matching the visible label. Required fields announce "required" in the label.
- **Haptic fallback:** Visual confirmation always accompanies haptic feedback (color change, checkmark) for users with haptics disabled.
- **Chart alternatives:** Cost sparkline and category bars have `accessibilityLabel` with text equivalent ("$3,200 average monthly spend. Maintenance 40%, Repair 25%, Improvement 20%, Utility 10%, Other 5%").
- **Delete confirmation:** Uses `Alert.alert()` which is natively accessible on iOS/Android.
- **Tab navigation:** Bottom tab bar uses expo-router's built-in accessibility (role="tabbar", each tab announces label + selected state).

### Tablet Considerations

While this is a mobile-first spec, iPad users access the same Expo app:
- Dashboard: hero greeting and alert section span full width, cost snapshot and maintenance preview sit side-by-side in 2-column layout on iPad (768px+)
- Property detail: middle tier uses 2x2 grid on phone, 4-column row on iPad
- Lists (maintenance, contractors, documents): single-column on phone, 2-column card grid on iPad
- Forms: constrained to max-width 600px and centered on iPad (forms should not stretch to full iPad width)

### Motion & Animation (per DESIGN.md)

| Interaction | Duration | Easing | Description |
|-------------|----------|--------|-------------|
| Card appearance (dashboard) | 200ms per card, 50ms stagger | ease-out | Cards cascade in from opacity 0 + translateY(8) |
| Tab switch | 300ms | ease-in-out | Cross-fade between tab content |
| Stack push/pop | iOS native | system | Standard iOS push/pop transition |
| Button press | 100ms | ease-out | scale(0.97) + opacity 0.85 |
| Mark Complete | 200ms | ease-out | Row slides left, checkmark fades in, then row reorders |
| Alert dismiss | 200ms | ease-out | Row collapses height to 0 with fade |
| Form section expand | 200ms | ease-out | Slide-down reveal of optional fields |
| Haptic: save success | -- | -- | `expo-haptics` notificationSuccess |
| Haptic: delete confirm | -- | -- | `expo-haptics` notificationWarning |
| Haptic: mark complete | -- | -- | `expo-haptics` impactLight |
| Skeleton shimmer | 1500ms loop | ease-in-out | Gradient sweep across skeleton shapes |
| `prefers-reduced-motion` | instant | none | All animations replaced with instant state changes |

**Implementation note:** Some existing modules (books, budget) use `ActivityIndicator` for loading states. This violates DESIGN.md which specifies skeleton screens. MyHomes should use skeletons per the design system. Consider building a shared `SkeletonCard` component that other modules can adopt later.

### Form Design Patterns

Three form archetypes used across all 10+ add/edit screens. Each prioritizes speed and smart defaults over completeness.

**Pattern 1: Quick-Entry** (cost/add, document/add)
```
  Large primary input (auto-focused, 24px font)
    - Cost form: dollar amount input with numeric keyboard
    - Document form: title input
  Category chips (horizontal scroll, single-select)
    - Tappable pills, selected = module amber fill
    - NOT a dropdown
  Date field: pre-filled with "Today", tappable to open date picker
  Optional attachment: [+ Photo] or [+ File] button (glass.strong style)
  [Save] full-width module amber button at bottom
  Haptic confirmation on save + auto-navigate back
```

**Pattern 2: Detail Form** (property/add, contractor/add, insurance/add)
```
  Required Section (always expanded, top of form)
    - Name, type, or primary identifier fields
    - Visual pickers for enums (type, specialty, policy_type)
  Optional Section (collapsed by default, expandable)
    - Header: "More Details" with chevron toggle
    - Address, phone, email, website, notes, etc.
    - Fields appear with slide-down animation (200ms ease-out)
  [Save] full-width at bottom
  Field-level validation: red border + inline error text below field
  Haptic confirmation on save
```

**Pattern 3: Picker-Heavy** (maintenance/add, project/add, inventory/item/add)
```
  Visual pickers instead of dropdowns:
    - Task type: icon grid (3 columns, each icon+label, tappable)
    - Season: 4 season cards (spring/summer/fall/winter) with seasonal colors
    - Category: horizontal chip row
    - Condition: 4-point scale with color coding (new=green, good=teal, fair=amber, poor=red)
  Stepper controls for numeric fields (interval months, budget)
  [Save] full-width at bottom
```

**Shared Form Behaviors:**
- All inputs: `surfaceElevated` background, `border` color, `md` border radius (8px)
- Focus state: module amber border (1px)
- Error state: `danger` border + red error text below (caption size)
- Labels: `caption` style, `textSecondary` color, above field
- Required indicator: amber asterisk after label
- Save button disabled until all required fields valid
- Keyboard-aware: form scrolls to keep active input visible

### Common Components (to be created in `apps/mobile/app/(homes)/components/`)

- `StatusBadge` -- colored pill badge for schedule/warranty/project status
- `PropertyPicker` -- dropdown or modal for selecting a property (used in add forms)
- `SectionCard` -- tappable card with title, subtitle, badge, and chevron
- `StatMetric` -- label + large value used in dashboard and summary headers
- `EmptyState` -- illustration + title + subtitle + CTA button
- `CategoryChips` -- horizontal scroll single-select chip row (used in quick-entry forms)
- `VisualPicker` -- icon grid or card row for enum selection (used in picker-heavy forms)
- `CollapsibleSection` -- expandable optional section with slide animation (used in detail forms)

## Test Requirements

### Navigation Tests (`__tests__/layout.test.tsx`)
- [ ] Tab navigator renders 4 visible tabs (Dashboard, Properties, Maintenance, Insights)
- [ ] Hidden screens (26 entries) not visible in tab bar
- [ ] Onboarding screen pushes on first use when zero properties exist
- [ ] Onboarding does not push when properties exist
- [ ] Gear icon in Dashboard header navigates to settings screen
- [ ] Section card taps on Property Detail push filtered stack screens with propertyId param

### Dashboard Tests (`__tests__/dashboard.test.tsx`)
- [ ] Hero greeting renders property name (heroTitle variant) and address
- [ ] Property pill selector switches dashboard data context
- [ ] Alert section renders overdue items with "Mark Done" inline action
- [ ] Alert section hidden when no overdue/expiring items exist
- [ ] Quick actions horizontal scroll renders 4 pill buttons
- [ ] Cost snapshot shows monthly total in module amber stat variant
- [ ] Category bar renders 5 proportional segments
- [ ] Upcoming maintenance shows top 3 sorted by urgency from sortByUrgency()
- [ ] Empty state triggers onboarding redirect when zero properties
- [ ] Dashboard loads data from 6 engine calls and handles partial failure (per-section error)

### Properties Tests (`__tests__/properties.test.tsx`)
- [ ] Property card renders name, address, badges, stats row (tasks/spend/docs)
- [ ] Search bar filters properties by name and address (case-insensitive)
- [ ] FAB navigates to property/add.tsx
- [ ] Empty state shows "Add your first property" with dual CTAs

### Property Detail Tests (`__tests__/property-detail.test.tsx`)
- [ ] Tiered layout: top tier (maintenance + costs), middle tier (2-col grid), bottom tier (compact rows)
- [ ] Maintenance alert bar shows overdue/due-soon counts with badges
- [ ] Cost summary shows monthly and lifetime totals
- [ ] Middle tier cards show correct counts for contractors, insurance, documents, projects
- [ ] Bottom tier rows show inventory item count + value, appliance count + attention count
- [ ] Delete property shows Alert.alert confirmation dialog
- [ ] Delete property calls deleteProperty and navigates back

### Maintenance Tests (`__tests__/maintenance.test.tsx`)
- [ ] SectionList groups schedules by status (overdue/due_soon/ok)
- [ ] Filter chips toggle status filter and re-render list
- [ ] Property dropdown filters schedules by property (multi-property)
- [ ] Mark Complete inline action calls markComplete() and refreshes schedule status
- [ ] Snooze action updates snoozeDays and refreshes

### Insights Tests (`__tests__/insights.test.tsx`)
- [ ] Spending trend aggregates costs across all properties
- [ ] Expiring soon timeline merges policies + documents + warranties sorted by urgency
- [ ] Overdue list groups tasks by property
- [ ] Contractor roster shows top 3 by rating
- [ ] Empty state shows "Add a property to see insights"

### Form Tests (`__tests__/forms.test.tsx`)
- [ ] Quick-entry form (cost/add): auto-focuses amount input, pre-fills date as today
- [ ] Detail form (contractor/add): optional section collapsed by default, expands on tap
- [ ] Picker-heavy form (maintenance/add): visual icon grid for task type selection
- [ ] Required field validation: save button disabled until all required fields valid
- [ ] Field-level error: red border + inline error text on invalid fields
- [ ] Save calls correct CRUD function with validated data
- [ ] Edit mode: pre-fills form from existing record
- [ ] Haptic notificationSuccess fires on successful save
- [ ] "Use defaults" on maintenance/add calls getDefaultSchedules and bulk-creates schedules

### Onboarding Tests (`__tests__/onboarding.test.tsx`)
- [ ] Step 1: own/rent selection toggles ownership type
- [ ] Step 2: property type selection (4 cards) highlights selected
- [ ] Step 3: name field pre-filled with "My Home", address optional
- [ ] "Get Started" creates property + default schedules + navigates to dashboard
- [ ] "Skip" dismisses wizard and shows empty dashboard
- [ ] Wizard re-triggers on next module open if zero properties

### Shared Component Tests (`__tests__/components.test.tsx`)
- [ ] StatusBadge renders correct color per status (overdue=danger, due_soon=amber, ok=success)
- [ ] EmptyState renders warm headline + supporting text + CTA button
- [ ] CategoryChips single-select: tapping a chip deselects the previous one
- [ ] VisualPicker icon grid: tapping an icon selects it with amber border
- [ ] PropertyPicker shows list of all properties, selected gets checkmark

### E2E Tests
- [ ] **[E2E-1] First-time user flow:** Enable MyHomes -> onboarding wizard (3 steps) -> property created -> default schedules populated -> dashboard shows non-empty maintenance preview
- [ ] **[E2E-2] Maintenance emergency flow:** Dashboard alert "HVAC filter overdue" -> tap -> maintenance detail -> linked contractor -> tap phone to call

### QA Verification Script

1. Open the app, navigate to MyHomes via hub dashboard
2. **Verify:** Empty state shown with "Add your first property" CTA (AC-1)
3. Tap "Add Property", fill form (name: "My House", type: house, ownership: own)
4. **Verify:** Property appears in Properties tab (AC-2)
5. Tap "Add recommended schedules" on the new property
6. **Verify:** Default house maintenance schedules created (10 tasks) (AC-16)
7. Navigate to Maintenance tab
8. **Verify:** Schedules shown sorted by urgency with status badges (AC-4)
9. Tap "Mark Complete" on one schedule
10. **Verify:** Status updates, next due date recalculates (AC-5)
11. Navigate to Property Detail
12. **Verify:** 8 section cards visible with summary stats (AC-3)
13. Tap Contractors section, add a contractor (plumber, 5 stars, favorite)
14. **Verify:** Contractor appears in directory, favorites filter works (AC-7)
15. Tap Insurance section, add a homeowners policy
16. **Verify:** Policy appears, coverage gaps update (AC-8)
17. Tap Documents section, add a document (photo capture)
18. **Verify:** Document appears in vault with category badge (AC-9)
19. Tap Inventory section, add a room (Kitchen), add an item (Refrigerator, $2000)
20. **Verify:** Room summary shows 1 item, $2000 value (AC-10)
21. Tap Appliances section, add an appliance with expired warranty
22. **Verify:** Appliance shows "Expired" badge and appears in "Needs Attention" (AC-11)
23. Tap Projects section, add a project (Kitchen Reno, $15000 budget)
24. Add 3 phases, complete 1
25. **Verify:** Progress bar shows 33%, budget bar shows actual vs budget (AC-12)
26. Navigate to Manage tab
27. **Verify:** Grid shows correct counts for all 6 sections (AC-6)
28. Navigate to Dashboard
29. **Verify:** Property summary, cost snapshot, upcoming maintenance visible (AC-1)
30. Add a second property (condo, rent)
31. **Verify:** Property switcher appears on dashboard
32. **Verify:** Renter gets filtered default schedules (4 tasks, not 10)
33. Try deleting a property
34. **Verify:** Confirmation dialog appears before deletion (AC-14)

## gstack Quality Gates

Based on this feature's complexity score (2 -- Large), these gstack skills are REQUIRED:

### Pre-build:
- [ ] `/plan-eng-review` -- review this spec before implementation

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for UI features:
- [ ] `/browse` -- navigate to each screen, verify all 5 states
- [ ] `/qa` -- full QA on the homes module after all screens are built

### Post-merge:
- [ ] `/parity-check` -- homes has standalone counterpart considerations
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The homes module has 14 database tables (V1-V3 migrations), 7 engines with 30+ pure functions, and 60+ CRUD operations. The mobile UI is a single placeholder screen (`index.tsx`) that only displays a basic listing feed with create/delete/toggle-saved actions. No tab navigator exists. None of the property management, maintenance, cost, contractor, insurance, inventory, appliance, or project features are accessible from the UI.

### After This Work
- 5-tab mobile navigator (Dashboard, Properties, Maintenance, Manage, Settings)
- 9 primary screens + 20 detail/add sub-screens
- Every engine function surfaced in the UI
- Every CRUD operation accessible
- All 5 states (loading, empty, error, success, partial) handled per screen
- Module definition updated with new navigation structure
- 5 reusable components (StatusBadge, PropertyPicker, SectionCard, StatMetric, EmptyState)

### Files Changed
- `apps/mobile/app/(homes)/_layout.tsx` -- Complete rewrite: tab navigator + stack
- `apps/mobile/app/(homes)/index.tsx` -- Complete rewrite: dashboard
- `apps/mobile/app/(homes)/properties.tsx` -- New: property list tab
- `apps/mobile/app/(homes)/maintenance.tsx` -- New: maintenance dashboard tab
- `apps/mobile/app/(homes)/manage.tsx` -- New: management hub tab
- `apps/mobile/app/(homes)/settings.tsx` -- New: settings tab
- `apps/mobile/app/(homes)/property/[id].tsx` -- New: property detail
- `apps/mobile/app/(homes)/property/add.tsx` -- New: add/edit property
- `apps/mobile/app/(homes)/maintenance/[id].tsx` -- New: schedule detail
- `apps/mobile/app/(homes)/maintenance/add.tsx` -- New: add/edit schedule
- `apps/mobile/app/(homes)/cost/[id].tsx` -- New: cost entry detail
- `apps/mobile/app/(homes)/cost/add.tsx` -- New: add cost entry
- `apps/mobile/app/(homes)/contractor/index.tsx` -- New: contractor directory
- `apps/mobile/app/(homes)/contractor/[id].tsx` -- New: contractor detail
- `apps/mobile/app/(homes)/contractor/add.tsx` -- New: add/edit contractor
- `apps/mobile/app/(homes)/insurance/index.tsx` -- New: insurance list
- `apps/mobile/app/(homes)/insurance/[id].tsx` -- New: policy detail
- `apps/mobile/app/(homes)/insurance/add.tsx` -- New: add/edit policy
- `apps/mobile/app/(homes)/inventory/index.tsx` -- New: inventory manager
- `apps/mobile/app/(homes)/inventory/room/[id].tsx` -- New: room detail
- `apps/mobile/app/(homes)/inventory/item/[id].tsx` -- New: item detail
- `apps/mobile/app/(homes)/inventory/item/add.tsx` -- New: add/edit item
- `apps/mobile/app/(homes)/appliance/index.tsx` -- New: appliance registry
- `apps/mobile/app/(homes)/appliance/[id].tsx` -- New: appliance detail
- `apps/mobile/app/(homes)/appliance/add.tsx` -- New: add/edit appliance
- `apps/mobile/app/(homes)/project/index.tsx` -- New: project list
- `apps/mobile/app/(homes)/project/[id].tsx` -- New: project detail
- `apps/mobile/app/(homes)/project/add.tsx` -- New: add/edit project
- `apps/mobile/app/(homes)/document/index.tsx` -- New: document vault
- `apps/mobile/app/(homes)/document/[id].tsx` -- New: document detail
- `apps/mobile/app/(homes)/document/add.tsx` -- New: add/edit document
- `apps/mobile/app/(homes)/components/StatusBadge.tsx` -- New: shared component
- `apps/mobile/app/(homes)/components/PropertyPicker.tsx` -- New: shared component
- `apps/mobile/app/(homes)/components/SectionCard.tsx` -- New: shared component
- `apps/mobile/app/(homes)/components/StatMetric.tsx` -- New: shared component
- `apps/mobile/app/(homes)/components/EmptyState.tsx` -- New: shared component
- `modules/homes/src/definition.ts` -- Updated: new tab/screen navigation

### Known Limitations
- V1 does not include listing search/saved tabs (original definition had these, deferred to V2)
- V1 does not include mortgage calculator (deferred to V2)
- V1 does not include map view for properties (future)
- Photo storage is local filesystem only (no cloud backup in V1)
- CSV export is inventory-only (full data export deferred)
- No push notification scheduling for maintenance reminders (requires expo-notifications setup)

### Context for Next Agent
- The module already exports all functions needed. No new engine or CRUD work required.
- The existing `index.tsx` is a placeholder and should be completely rewritten as the Dashboard tab.
- The `_layout.tsx` needs to be rewritten from a simple Stack to a Tab navigator wrapping Stack screens.
- The `definition.ts` navigation should be updated to reflect the new tab/screen structure.
- All screens must use Cool Obsidian tokens and the existing `Card`, `Text` components from `@mylife/ui`.
- Property-scoped screens should accept `propertyId` as a route param or read it from context.
- The existing test file `apps/mobile/app/(homes)/__tests__/index.test.tsx` will need to be rewritten for the new dashboard.
- `getDefaultSchedules(propertyType, ownershipType)` returns different presets for houses (10 tasks) vs condos (5) vs renters (4). The "Add recommended schedules" flow should use this.
- Property-scoped list screens pushed from Property Detail receive `propertyId` as a route param. Tab-level screens show aggregate data across all properties.
- **Orchestration needed:** `markComplete()` is a pure calculator that returns `{ lastCompletedDate, nextDueDate, snoozeDays: 0, snoozeCount: 0 }`. The caller must then call `updateSchedule(db, id, result)` to persist. Same pattern for snooze.
- **Onboarding orchestration:** The wizard's "Get Started" must: (1) `createProperty(db, uuid(), data)`, (2) call `getDefaultSchedules(type, ownership)` to get presets, (3) loop and `createSchedule(db, uuid(), { propertyId, ...preset })` for each, (4) navigate to dashboard.
- **File operations:** Document/appliance/project photo capture requires `expo-image-picker` for camera, `expo-document-picker` for files. Copy picked file to app's local storage via `expo-file-system.copyAsync()`. Store the local URI in the database.
- Forms follow 3 patterns: Quick-Entry (cost, document), Detail Form (property, contractor, policy), Picker-Heavy (schedule, project, item). See Form Design Patterns section.
- Skeleton screens, NOT ActivityIndicator, for loading states per DESIGN.md.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | -- | -- |
| Codex Review | `/codex review` | Independent 2nd opinion | 2 | issues_found | Design: 7 findings (addressed). Eng: 8 findings (4 addressed, 4 known limitations). |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 1 issue (nav pattern), 0 critical gaps. 35 unit + 2 E2E tests added. |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | score: 6/10 -> 9/10, 5 design decisions |

- **CODEX (design):** Flagged dashboard card stack, stacked property detail, manage grid, tab bloat, form gaps, badge overuse. All addressed.
- **CODEX (eng):** Flagged file tree inconsistency, state model overengineering, orchestration gaps, reminders without notifications. File tree + state model + orchestration fixed. Reminders/backup are known V1 limitations.
- **CROSS-MODEL:** Design review: both Codex and Claude subagent flagged same top 4 issues (strong consensus). Eng review: Codex's strategic scope concern ("build core first") was considered but rejected per Completeness Principle.
- **UNRESOLVED:** 0 unresolved decisions.
- **VERDICT:** DESIGN + ENG CLEARED. Ready to implement.
