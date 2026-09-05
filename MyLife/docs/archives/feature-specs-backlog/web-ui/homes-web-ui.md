# MyHomes Web UI Spec

**Module:** `@mylife/homes` | **Accent:** `#D97706` (amber) | **Prefix:** `hm_`
**Status:** 5 stub files -> full functional web UI
**Complexity:** 0 (Massive) -- 14 tables, 7 engines, 60+ CRUD, 7 sub-domains
**Pipeline:** /office-hours -> /plan-eng-review -> /plan-design-review -> /design-consultation

---

## Phase 1: Office Hours (Builder Mode)

### The Problem

Homes is the most complex module in MyLife. Mobile has 33 screens across 4 tabs plus 29 stack screens. The web currently serves a `ModuleWebFallback` stub and 3 broken re-exports from a non-existent `@myhomes-web` standalone package.

The module manages 7 interconnected sub-domains:
1. **Properties** -- the top-level entity everything hangs off of
2. **Maintenance** -- recurring task schedules with due date tracking
3. **Cost tracking** -- expenses linked to properties and maintenance tasks
4. **Contractors** -- service provider directory with ratings and services
5. **Insurance** -- policy management with coverage gap analysis
6. **Documents** -- file vault with expiry tracking
7. **Inventory/Appliances** -- room-based item tracking + appliance registry
8. **Projects** -- renovation tracking with phases, budget, and photos

### What Makes Desktop Essential

Mobile forces linear navigation: tap property -> tap maintenance -> tap cost -> add. Desktop unlocks:

**Multi-panel command center.** Property detail becomes a tabbed workspace. Select a property on the left, see all 7 sub-domains as tabs in the main panel. No back-button chains.

**Data tables.** Costs, inventory, and maintenance schedules are data-dense entities. Tables with sort/filter/inline-edit are 5x faster than scrolling through cards.

**Keyboard-first cost entry.** The most frequent action is "log a $47 plumber visit." Desktop: Tab-Tab-Tab-Enter. Mobile: navigate, scroll, tap, scroll, tap.

**Side-by-side context.** Compare insurance policies. See maintenance costs alongside the task that triggered them. View contractor service history while editing a schedule.

**Bulk operations.** Mark 5 maintenance tasks done. Batch-categorize cost entries. Print inventory for insurance claims.

### The Narrowest Wedge

**Maintenance dashboard + cost tracker.** Every homeowner's fundamental question: "What's due this month, and what have I spent?" This single screen -- a table of upcoming/overdue tasks with inline completion, plus a cost log with category breakdown -- is the reason a homeowner opens the desktop app. Everything else is gravy.

### Competitor Landscape

| App | Strength | MyHomes Differentiator |
|-----|----------|----------------------|
| HomeZada | Inventory focus | Privacy-first, no account required, all local |
| Centriq | Appliance manuals | Integrated with full property management |
| Buildium | Rental management | Personal homes, not rental empires |
| Notion templates | Flexible | Purpose-built UI, engines, calculations |
| Spreadsheet | Familiar | Type-safe schema, computed due dates, category analysis |

### Web-Specific Affordances

| Affordance | Where Used |
|-----------|-----------|
| Sortable data tables | Costs, inventory, maintenance, contractors |
| Multi-column layouts | Dashboard (3-col grid), property detail (sidebar + main) |
| Keyboard shortcuts | `N` new task, `E` edit, `D` mark done, `Esc` close modal |
| Inline editing | Cost amounts, task dates, contractor ratings |
| Print/export | Inventory lists (CSV), cost reports, insurance cards |
| Drag-and-drop | Project phase reordering |
| Copy-to-clipboard | Contractor phone/email |
| Responsive breakpoints | 3-col > 2-col > 1-col at standard breakpoints |

---

## Phase 2: Engineering Review

### Module Function Audit

**Current actions.ts coverage (V1 only -- listings/tours):**
```
createListing, getListings, toggleListingSaved, updateListingStatus, deleteListing
getHomeMarketMetrics, createTour, getToursByListing, deleteTour
```

**Missing from actions.ts -- V2 (properties/maintenance/settings):**
```
createProperty, getProperty, getProperties, updateProperty, deleteProperty
promoteListingToProperty
createSchedule, getSchedule, getSchedulesForProperty, getAllActiveSchedules
updateSchedule, deactivateSchedule, deleteSchedulesByProperty
getSetting, setSetting
```

**Missing from actions.ts -- V3 (costs/docs/contractors/insurance/inventory/appliances/projects):**
```
createCostEntry, getCostEntry, getCostEntriesForProperty, getCostEntriesForSchedule
updateCostEntry, deleteCostEntry
createDocument, getDocument, getDocumentsForProperty, updateDocument, deleteDocument
createContractor, getContractor, getContractorsForProperty, getAllContractors
updateContractor, toggleFavorite, deleteContractor
createService, getServicesForContractor, getServicesForSchedule, deleteService
createPolicy, getPolicy, getPoliciesForProperty, updatePolicy, deletePolicy
createRoom, getRoom, getRoomsForProperty, updateRoom, deleteRoom
createInventoryItem, getInventoryItem, getItemsForRoom, getItemsForProperty
updateInventoryItem, deleteInventoryItem
createAppliance, getAppliance, getAppliancesForProperty, updateAppliance, deleteAppliance
createProject, getProject, getProjectsForProperty, getActiveProjects
updateProject, deleteProject
createPhase, getPhase, getPhasesForProject, updatePhase, deletePhase
createProjectPhoto, getPhotosForProject, getPhotosForPhase, deleteProjectPhoto
```

**Missing from actions.ts -- Engines:**
```
getDefaultSchedules, calculateNextDueDate, calculateScheduleStatus
sortByUrgency, markComplete, getTaskTypeLabel
getCostSummary, getMonthlyCostTrend, getLifetimeCosts, getCostsBySchedule
getExpiringDocuments, searchDocuments, getDocumentStats
getContractorsBySpecialty, getFavoriteContractors, getContractorForTaskType, getContractorStats
getActivePolicies, getExpiringPolicies, getPolicyCostSummary, checkCoverageGaps
getPropertyInventoryValue, getRoomSummary, getItemsByCategory, getHighValueItems, exportInventoryCSV
getWarrantyStatus, getAppliancesNeedingAttention, searchAppliances, getAppliancesByCategory
getProjectSummary, getBudgetVsActual, getPhaseProgress, getActiveProjectCount
```

### Schema Verification

All 14 tables confirmed in `modules/homes/src/db/schema.ts`:
- V1: `hm_listings`, `hm_tours` (home search -- deprioritize for web)
- V2: `hm_properties`, `hm_maintenance_schedules`, `hm_settings`
- V3: `hm_cost_entries`, `hm_documents`, `hm_contractors`, `hm_contractor_services`, `hm_insurance_policies`, `hm_rooms`, `hm_inventory_items`, `hm_appliances`, `hm_projects`, `hm_project_phases`, `hm_project_photos`

All have proper indexes. No schema changes needed for web UI.

### Missing Module Functions

None. The module exports everything needed. All 7 engines provide pure-function computations (status calculation, cost aggregation, coverage analysis, etc.) that the web UI can call via server actions.

### Broken Re-exports to Delete

Three files import from a non-existent `@myhomes-web` standalone package:
- `apps/web/app/homes/messages/page.tsx`
- `apps/web/app/homes/profile/page.tsx`
- `apps/web/app/homes/sell/page.tsx`

These must be deleted. The `[...slug]` catch-all fallback will handle any legacy links.

### Route Structure (Next.js App Router)

```
apps/web/app/homes/
  layout.tsx              # Glass header + nav tabs (6 items)
  page.tsx                # Dashboard (replaces ModuleWebFallback)
  actions.ts              # Server actions (rewrite -- cover all CRUD + engines)
  properties/
    page.tsx              # Property list with cards + search + add form
    [id]/
      page.tsx            # Property detail (tabbed command center)
  maintenance/
    page.tsx              # Cross-property maintenance table
  costs/
    page.tsx              # Cross-property cost tracker with charts
  contractors/
    page.tsx              # Contractor directory with search + filter
  projects/
    page.tsx              # Project tracker with phase progress
  settings/
    page.tsx              # Module settings
  [...slug]/
    page.tsx              # Catch-all fallback (ModuleWebFallback)
```

**Layout nav tabs:** Dashboard | Properties | Maintenance | Costs | Contractors | Projects

**Why these 6 tabs (not 10)?** Insurance, documents, inventory, and appliances are property-scoped sub-domains. They live as tabs within the property detail page rather than top-level routes. This matches the mental model: you don't browse "all documents across all properties" -- you manage documents for a specific property.

### Data Flow

```
User Action
  -> Client component event handler
  -> Server action (actions.ts)
  -> db() helper (getAdapter + ensureModuleMigrations)
  -> Module CRUD function (@mylife/homes)
  -> SQLite (hm_* tables)
  -> Return data
  -> setState in client component
  -> Re-render
```

Error handling: Every server action call wrapped in try/catch/finally in the client component. `finally` sets loading to false. This prevents the stuck-loading bug identified in QA (2026-03-23).

### State Management

No external state library. Follow the established pattern (books, budget, workouts):
- `useState` + `useEffect` for data fetching
- Server actions return typed data
- Refresh via re-calling the fetch action
- `useCallback` for stable handler references
- Cancelled flag in useEffect cleanup to prevent state updates after unmount

### Property Detail: Tabbed Command Center

The property detail page (`/homes/properties/[id]`) is the core web innovation. It renders a tab bar with 7 sub-views:

| Tab | Data Source | Key Features |
|-----|-----------|-------------|
| Overview | `getProperty` | Address, type, badges, quick stats, edit form |
| Maintenance | `getSchedulesForProperty` | Task list with status dots, mark-done, add |
| Costs | `getCostEntriesForProperty` + engines | Data table, category chart, monthly trend |
| Insurance | `getPoliciesForProperty` + engines | Policy cards, coverage gaps, expiry alerts |
| Documents | `getDocumentsForProperty` | File list, category filter, expiry alerts |
| Inventory | `getRoomsForProperty` + `getItemsForRoom` | Room accordion -> item list, value total |
| Appliances | `getAppliancesForProperty` | Appliance cards, warranty status, search |

Projects get their own top-level route because they span property concerns and benefit from a dedicated tracking view.

---

## Phase 3: Design Review

### Design Dimension Ratings

| Dimension | Score | Notes | What Would Make 10 |
|-----------|-------|-------|-------------------|
| Information Architecture | 8/10 | 6-tab nav + property detail hub is clear | Add breadcrumbs for deep navigation |
| Visual Hierarchy | 9/10 | Hero stats, data tables, glass cards | Consistent heading weight across all pages |
| Interaction Design | 8/10 | Keyboard shortcuts, inline edit, bulk ops | Full keyboard-only workflow for cost entry |
| Responsive Design | 8/10 | 3-col/2-col/1-col grid, sidebar collapses | Test every page at iPad landscape (1024px) |
| Empty States | 9/10 | Warm CTAs per sub-domain | Unique illustration per sub-domain |
| Error States | 8/10 | Try/catch/finally pattern, retry buttons | Inline field validation on forms |
| Loading States | 9/10 | Skeleton screens matching content shape | Stagger skeleton animation per-card |
| Typography | 9/10 | Hero/heading/body/caption hierarchy | Monospace for financial data (costs, budgets) |
| Color System | 10/10 | Amber accent (#D97706) on Cool Obsidian | -- (perfect as-is) |
| Accessibility | 8/10 | ARIA landmarks, focus indicators, contrast | Full screen reader testing on data tables |

**Overall: 86/100**

### Cool Obsidian Compliance Checklist

- [x] Background: `#0A0A0F` (or `var(--background)`)
- [x] Surface: `#12121A` (or `var(--surface)`)
- [x] Glass cards: `rgba(255,255,255,0.04)` bg + `rgba(255,255,255,0.06)` border
- [x] Text primary: `#F0F0F5` (or `var(--text)`)
- [x] Text secondary: `rgba(240,240,245,0.65)` (or `var(--text-secondary)`)
- [x] Module accent: `#D97706` for CTAs, active states, highlights
- [x] No light theme elements anywhere
- [x] Glass header: `rgba(18,18,26,0.65)` bg + `blur(80px) saturate(200%)`
- [x] Border radius: 16px (xl) for cards, 999px (pill) for buttons/chips
- [x] Danger: `#FF453A` for overdue tasks, delete actions
- [x] Success: `#30D158` for "mark done" buttons, ok status
- [x] No spinners -- skeleton screens only
- [x] No bouncy animations -- 200ms ease-out only

### Desktop-Optimized Layouts

**Dashboard (3-column at >1024px):**
```
+-----------------------------------------------------+
| Glass Header: MyHomes | Nav tabs                     |
+-----------------------------------------------------+
| Hero: Property name + address + badges               |
| [Property switcher pills]                            |
+----------------+------------------+------------------+
| Alerts         | Cost Snapshot     | Coming Up        |
| (overdue/due)  | (sparkline +     | (next 5 tasks    |
|                |  categories)     |  with dates)     |
+----------------+------------------+------------------+
| Quick Actions: Log Cost | Add Task | Find Pro | ...  |
+-----------------------------------------------------+
```

**Property Detail (sidebar + main):**
```
+-----------------------------------------------------+
| Glass Header: MyHomes | Nav tabs                     |
+-----------------------------------------------------+
| Property: "123 Main St" | [Edit] [Delete]           |
+-----------------------------------------------------+
| [Overview] [Maintenance] [Costs] [Insurance] ...    |
+-----------------------------------------------------+
| Tab content area (full width, varies by tab)         |
|                                                      |
| Example: Costs tab                                   |
| +--------------------------------------------------+|
| | Total: $4,230 this month | Monthly Avg: $2,100   ||
| +--------------------------------------------------+|
| | Date  | Category | Description | Amount | Vendor  ||
| | 03/20 | Repair   | Faucet fix  | $245   | AcmeCo ||
| | 03/15 | Utility  | Electric    | $189   | PG&E   ||
| | ...   |          |             |        |         ||
| +--------------------------------------------------+|
+-----------------------------------------------------+
```

**Maintenance (data table):**
```
+-----------------------------------------------------+
| Glass Header: MyHomes | Nav tabs                     |
+-----------------------------------------------------+
| All Maintenance Tasks          [+ Add Task]          |
| [All] [Overdue] [Due Soon] [OK]  |  Property: [All] |
+-----------------------------------------------------+
| Status | Task          | Property    | Due      | ✓  |
| 🔴     | HVAC Filter   | Main House  | 03/15    | ☐  |
| 🟡     | Gutter Clean  | Main House  | 03/28    | ☐  |
| 🟢     | Lawn Service  | Beach House | 04/15    | ☐  |
+-----------------------------------------------------+
```

### Five States Per View

**Dashboard:**
| State | Design |
|-------|--------|
| Loading | 3-column skeleton grid: stat cards pulse, table rows shimmer |
| Empty | "Your home awaits" + house icon + "Add Your First Property" CTA |
| Error | Glass card: "Something went wrong" + retry button |
| Success | Full dashboard with alerts, cost snapshot, upcoming tasks |
| Partial | Single property with no costs/tasks yet -> show relevant empty sub-states |

**Properties List:**
| State | Design |
|-------|--------|
| Loading | 4 property card skeletons stacked |
| Empty | "No properties yet" + house icon + "Add Property" CTA |
| Error | Glass card: "Couldn't load properties" + retry |
| Success | Property cards with stats (tasks, spending, docs) |
| Partial | Search returns no matches -> "No matches" with clear filter link |

**Property Detail:**
| State | Design |
|-------|--------|
| Loading | Header skeleton + tab bar + content skeleton |
| Empty | N/A (property always has data once created) |
| Error | "Property not found" -> back to properties list |
| Success | Tabbed command center with all sub-domains |
| Partial | New property with no maintenance/costs -> sub-tab empty states |

**Maintenance Table:**
| State | Design |
|-------|--------|
| Loading | Table skeleton: 6 rows with shimmer |
| Empty | "All caught up" + checkmark icon + "Add a Task" CTA |
| Error | Glass card error + retry |
| Success | Grouped table with status dots, filter chips, mark-done |
| Partial | Filter active but no matches -> "No tasks match this filter" |

**Costs Page:**
| State | Design |
|-------|--------|
| Loading | Stat cards skeleton + table skeleton |
| Empty | "No expenses logged" + dollar icon + "Log Your First Cost" CTA |
| Error | Glass card error + retry |
| Success | Stats row + category breakdown + sortable cost table |
| Partial | Single property selected but no costs -> show empty CTA |

**Contractors Directory:**
| State | Design |
|-------|--------|
| Loading | 3-column card grid skeleton |
| Empty | "Build your team" + hardhat icon + "Add Contractor" CTA |
| Error | Glass card error + retry |
| Success | Contractor cards with specialty badges, ratings, favorites |
| Partial | Search/filter returns no matches -> clear filter suggestion |

**Projects Page:**
| State | Design |
|-------|--------|
| Loading | Project card skeletons with progress bars |
| Empty | "No projects yet" + blueprint icon + "Start a Project" CTA |
| Error | Glass card error + retry |
| Success | Project cards with phase progress, budget vs actual |
| Partial | Project with no phases -> "Add your first phase" inline CTA |

**Settings Page:**
| State | Design |
|-------|--------|
| Loading | Form skeleton |
| Empty | N/A (settings always has defaults) |
| Error | Inline error below failed setting toggle |
| Success | Toggle rows for notifications, default property selector |
| Partial | N/A |

---

## Phase 4: Design Consultation

### Module Design System Decisions

**Accent Color:** `#D97706` (amber) -- warm, grounded, evokes "home."
- Primary CTA backgrounds: `#D97706` with `#0A0A0F` text
- Accent-tinted cards: `rgba(217,119,6,0.15)` bg + `rgba(217,119,6,0.25)` border
- Active nav tab pill: `#D97706` bg
- Status accent for "due soon" items

**Category Colors (costs/charts):**
```
#D97706 (amber)   -- maintenance/repair
#22C55E (green)   -- utilities
#3B82F6 (blue)    -- insurance
#A855F7 (purple)  -- improvements
#EF4444 (red)     -- emergency
```

**Status Colors:**
```
#FF453A (danger)    -- overdue
#D97706 (accent)    -- due soon
#30D158 (success)   -- ok / completed
rgba(240,240,245,0.35) (textTertiary) -- unknown/future
```

**Iconography:** Emoji icons matching mobile tab bar:
- Dashboard: `🏠`, Properties: `🏘️`, Maintenance: `🔧`, Costs: `💰`
- Contractors: `👷`, Insurance: `🛡️`, Documents: `📄`, Inventory: `📦`
- Appliances: `🔌`, Projects: `🏗️`, Settings: `⚙️`

**Information Density:** High. Follow Linear/Raycast reference:
- Data tables: 14px body, 12px captions, tight row spacing (40px row height)
- Dashboard cards: 16px padding, 12px gap between
- No wasted whitespace between sections
- Sidebar (if multi-property): 240px fixed, collapsible

**Typography for Financial Data:**
- Cost amounts: `font-variant-numeric: tabular-nums` for aligned columns
- Use `subheading` (18px/600) for stat values, `caption` (13px/500) for labels

### Component Reuse from packages/ui/

The web currently uses CSS variables from `globals.css` rather than importing from `@mylife/ui` directly (since that package targets React Native). The web pattern uses:

| Token | CSS Variable | Source |
|-------|-------------|--------|
| background | `var(--background)` | `globals.css` |
| surface | `var(--surface)` | `globals.css` |
| glass | `var(--glass)` | `globals.css` |
| glass-strong | `var(--glass-strong)` | `globals.css` |
| glass-border | `var(--glass-border)` | `globals.css` |
| border | `var(--border)` | `globals.css` |
| text | `var(--text)` | `globals.css` |
| text-secondary | `var(--text-secondary)` | `globals.css` |
| radius-xl | `var(--radius-xl)` | `globals.css` |
| radius-pill | `var(--radius-pill)` | `globals.css` |

**Module accent:** Define `var(--accent-homes)` in `globals.css` (value: `#D97706`).

**Shared Patterns from Other Web Modules:**
- Glass header layout from `books/layout.tsx` (adapt with active tab highlighting from `budget/layout.tsx`)
- Active tab pill style from budget layout (`usePathname()` for active detection)
- Glass card style constant from budget page
- `db()` helper pattern from books/budget actions
- Error handling (try/catch/finally) pattern from web error handling feedback memory

### Reusable Web Components to Extract

No new shared components needed. All UI is composed from HTML + CSS variables (consistent with books, budget, workouts web patterns). Module-specific components live inline in page files.

---

## Implementation Spec

### File Inventory

| File | Type | Lines (est) | Description |
|------|------|------------|-------------|
| `layout.tsx` | Server component | 90 | Glass header + 6-tab nav with active detection |
| `page.tsx` | Client component | 300 | Dashboard: property switcher, alerts, cost snapshot, upcoming |
| `actions.ts` | Server actions | 500 | Full CRUD + engine wrappers (rewrite from scratch) |
| `properties/page.tsx` | Client component | 250 | Property list with search + add property form |
| `properties/[id]/page.tsx` | Client component | 600 | Property detail with 7-tab command center |
| `maintenance/page.tsx` | Client component | 250 | Cross-property maintenance table with filters |
| `costs/page.tsx` | Client component | 300 | Cost table + stats + category breakdown |
| `contractors/page.tsx` | Client component | 250 | Contractor directory with search/filter/favorites |
| `projects/page.tsx` | Client component | 300 | Project tracker with phase progress |
| `settings/page.tsx` | Client component | 120 | Module settings (notifications, defaults) |
| `[...slug]/page.tsx` | Server component | 15 | Catch-all fallback |

**Total: 11 files, ~2,975 lines estimated**

### Route-by-Route Specifications

#### 1. layout.tsx -- Module Shell

**Pattern:** Budget layout with active tab highlighting.

```
Nav tabs: Dashboard | Properties | Maintenance | Costs | Contractors | Projects
```

- Glass header: `rgba(18,18,26,0.65)` bg + `blur(80px) saturate(200%)`
- Module title: "MyHomes" in amber accent, 30px/800
- Tagline: "Real estate, reimagined" in text-secondary
- Active tab: amber pill background, white text
- Inactive tab: transparent bg, text-secondary color

**Actions needed:** None (pure layout).

#### 2. page.tsx -- Dashboard

**Data fetched:**
```typescript
fetchProperties()              // getProperties(db)
fetchAllActiveSchedules()      // getAllActiveSchedules(db)
fetchCostEntriesForProperty()  // getCostEntriesForProperty(db, propId)
```

**Engine calls (client-side pure functions):**
```typescript
calculateScheduleStatus(schedule.nextDueDate)
sortByUrgency(schedulesWithStatus)
getCostSummary(costs)
```

**Layout:**
- Hero section: active property name + address + type/ownership badges
- Property switcher pills (if multiple properties)
- Alert section: overdue (red left-border) + due soon (amber left-border) with inline "Done" buttons
- Quick actions row: Log Cost, Add Task, Find Pro, Scan Doc
- Cost snapshot card: total this month + category bar + "View All" link
- Coming Up: next 3 tasks with status dots and dates

**Empty state:** "Your home awaits" + house icon + "Add Your First Property" amber CTA -> `/homes/properties` with add form open.

#### 3. properties/page.tsx -- Property List

**Data fetched:**
```typescript
fetchProperties()                   // all properties
fetchSchedulesForProperty(id)       // per-property task count
fetchCostEntriesForProperty(id)     // per-property spend
fetchDocumentsForProperty(id)       // per-property doc count
```

**Engine calls:**
```typescript
getLifetimeCosts(costs)
```

**Layout:**
- Search bar at top (filter by name/address)
- Property cards in 2-column grid (1-col on mobile):
  - Amber left-border accent
  - Property name (subheading)
  - Address (text-secondary)
  - Type + ownership badges
  - Stats line: "X tasks | $Y spent | Z docs"
- Floating "+" button or header "Add Property" CTA

**Add property form:** Inline glass card that expands at top of list:
- Name (required), Address, City, State, Year Built, Sqft
- Property type dropdown: house, condo, townhouse, apartment, land
- Ownership type: own, rent
- "Save" amber CTA + "Cancel" ghost button

**Empty state:** "No properties yet" + house icon + "Add Property" CTA.

#### 4. properties/[id]/page.tsx -- Property Detail (Command Center)

**The crown jewel of the web UI.** 7-tab layout within the property.

**Data fetched (varies by active tab):**
```typescript
// Always:
fetchProperty(id)

// Per tab:
fetchSchedulesForProperty(id)        // Maintenance tab
fetchCostEntriesForProperty(id)      // Costs tab
fetchPoliciesForProperty(id)         // Insurance tab
fetchDocumentsForProperty(id)        // Documents tab
fetchRoomsForProperty(id)            // Inventory tab
fetchItemsForRoom(roomId)            // Inventory tab (per room)
fetchAppliancesForProperty(id)       // Appliances tab
```

**Tab bar:**
```
[Overview] [Maintenance] [Costs] [Insurance] [Documents] [Inventory] [Appliances]
```

**Overview tab:**
- Property details card (name, address, type, ownership, year built, sqft)
- Edit button -> inline form
- Quick stats row: tasks count, total spending, doc count, insurance status
- Delete property (danger button with confirmation)

**Maintenance tab:**
- Table: Status dot | Task name | Due date | Last completed | Actions (Done, Edit, Delete)
- Sort by urgency (overdue first)
- "Add Task" button opens inline form
- Add form: task type dropdown (HVAC, plumbing, electrical, roofing, landscaping, appliance, pest, cleaning, custom), interval months, season preference, notes

**Costs tab:**
- Stats row: Total this month | Monthly average | Lifetime total
- Category breakdown with colored dots
- Data table: Date | Category | Description | Amount | Vendor | Schedule link
- Sort by date (newest first), filterable by category
- "Log Cost" button -> inline form
- Form: category dropdown, description, amount (dollars input -> convert to cents), vendor, date, linked schedule (optional)

**Insurance tab:**
- Policy cards in 2-column grid:
  - Provider name + policy number
  - Type badge (homeowners, flood, earthquake, umbrella)
  - Coverage amount, deductible, annual premium
  - Start/end dates + auto-renew badge
  - Agent contact info
- Coverage gap analysis: `checkCoverageGaps()` results shown as amber alert cards
- Expiring policies: red-bordered cards for policies expiring within 90 days
- "Add Policy" button -> inline form

**Documents tab:**
- File list with category filter chips
- Document rows: title, category badge, file type icon, size, expiry date
- Expiring documents highlighted in amber/red
- Document stats: `getDocumentStats()` -- total count, by category, expiring soon
- "Add Document" button -> inline form (title, category, file URI, expiry date, notes, tags)

**Inventory tab:**
- Room accordion: expand/collapse to show items per room
- Room header: name, type badge, item count, total value
- Item rows: name, category, brand/model, condition badge, value, warranty status
- Property total value: `getPropertyInventoryValue()` displayed as hero stat
- High value items callout: `getHighValueItems(items, thresholdCents)`
- "Add Room" + "Add Item" buttons
- CSV export: `exportInventoryCSV()` -> download link

**Appliances tab:**
- Appliance cards in grid:
  - Name, brand, model number
  - Category badge (hvac, kitchen, laundry, bathroom, outdoor, garage, other)
  - Warranty status: `getWarrantyStatus()` -> green/amber/red badge
  - Condition badge
  - Purchase date + price
- "Needs Attention" section: `getAppliancesNeedingAttention()` highlighted at top
- Search bar: `searchAppliances()`
- "Add Appliance" button -> inline form

#### 5. maintenance/page.tsx -- All-Properties Maintenance

**Data fetched:**
```typescript
fetchProperties()
fetchAllActiveSchedules()
```

**Engine calls:**
```typescript
calculateScheduleStatus(schedule.nextDueDate)  // per schedule
sortByUrgency(schedulesWithStatus)
getTaskTypeLabel(taskType, customLabel)
```

**Layout:**
- Filter chips row: [All] [Overdue] [Due Soon] [OK]
- Property filter pills (if multiple properties)
- Data table:
  - Columns: Status (dot) | Task | Property | Due Date | Last Done | Actions
  - Sort by urgency default
  - "Mark Done" button per row -> calls `markComplete()` + `updateSchedule()`
- "Add Task" CTA in header

**Empty state:** "All caught up" + checkmark icon + "Add a Task" CTA.

#### 6. costs/page.tsx -- All-Properties Cost Tracker

**Data fetched:**
```typescript
fetchProperties()
fetchCostEntriesForProperty(propId)  // per property, then aggregate
```

**Engine calls:**
```typescript
getCostSummary(allCosts)
getMonthlyCostTrend(allCosts)
getLifetimeCosts(costs)
getCostsBySchedule(costs, scheduleId)
```

**Layout:**
- Stats row (3 glass cards):
  - This Month: `getCostSummary(currentMonthCosts).totalCents`
  - Monthly Average: computed from `getMonthlyCostTrend()`
  - Lifetime: `getLifetimeCosts(allCosts)`
- Category breakdown: horizontal bar with colored segments + legend
- Monthly trend: vertical bar chart (last 6 months)
- Property filter pills
- Data table: Date | Category | Description | Amount | Vendor | Property
- Sort by date, filter by category or property

**Empty state:** "No expenses logged" + dollar icon + "Log Your First Cost" CTA.

#### 7. contractors/page.tsx -- Contractor Directory

**Data fetched:**
```typescript
fetchAllContractors()
fetchServicesForContractor(id)  // on expand
```

**Engine calls:**
```typescript
getContractorsBySpecialty(contractors, specialty)
getFavoriteContractors(contractors)
getContractorStats(contractor, services)
```

**Layout:**
- Search bar + specialty filter chips
- Favorites section at top (if any)
- Contractor cards (2-column grid):
  - Name + company
  - Specialty badge
  - Star rating (1-5)
  - Contact: phone (copy icon), email (copy icon), website (link)
  - Favorite toggle (heart icon)
  - Service count + total spent
- Expand card -> service history table
- "Add Contractor" CTA

**Empty state:** "Build your team" + hardhat icon + "Add Contractor" CTA.

#### 8. projects/page.tsx -- Project Tracker

**Data fetched:**
```typescript
fetchProperties()
fetchActiveProjects()
fetchProjectsForProperty(propId)
fetchPhasesForProject(projectId)
```

**Engine calls:**
```typescript
getProjectSummary(project, phases)
getBudgetVsActual(project)
getPhaseProgress(phases)
getActiveProjectCount(projects)
```

**Layout:**
- Active project count hero stat
- Project cards (full-width):
  - Name + property name + category badge
  - Status badge (planning, in_progress, completed, on_hold, cancelled)
  - Priority indicator (high=red, medium=amber, low=green)
  - Progress bar: `getPhaseProgress()` percentage
  - Budget vs Actual: side-by-side with delta
  - Start date -> target end date timeline
- Expand card -> phase list:
  - Phase rows: name, status, date range, budget, assigned contractor
  - Phase ordering matches `sort_order`
- "Start a Project" CTA

**Empty state:** "No projects yet" + blueprint icon + "Start a Project" CTA.

#### 9. settings/page.tsx -- Module Settings

**Data fetched:**
```typescript
fetchSetting('reminderNotificationsEnabled')
fetchSetting('defaultRemindersOffered')
fetchSetting('default_property_id')
```

**Layout:**
- Toggle rows:
  - Reminder notifications (on/off)
  - Default reminders offered for new properties (on/off)
- Default property selector (dropdown of property names)
- Data section:
  - Export all data (future)

#### 10. actions.ts -- Server Actions (Full Rewrite)

Organized by domain. Each section wraps the `db()` helper and calls module functions:

```typescript
// ---- Properties ----
fetchProperties, fetchProperty, doCreateProperty, doUpdateProperty, doDeleteProperty

// ---- Maintenance ----
fetchAllActiveSchedules, fetchSchedulesForProperty
doCreateSchedule, doUpdateSchedule, doDeactivateSchedule, doMarkComplete

// ---- Costs ----
fetchCostEntriesForProperty, fetchCostEntriesForSchedule
doCreateCostEntry, doUpdateCostEntry, doDeleteCostEntry

// ---- Contractors ----
fetchAllContractors, fetchContractorsForProperty, fetchContractor
doCreateContractor, doUpdateContractor, doToggleFavorite, doDeleteContractor
fetchServicesForContractor, doCreateService, doDeleteService

// ---- Insurance ----
fetchPoliciesForProperty, fetchPolicy
doCreatePolicy, doUpdatePolicy, doDeletePolicy

// ---- Documents ----
fetchDocumentsForProperty, fetchDocument
doCreateDocument, doUpdateDocument, doDeleteDocument

// ---- Inventory ----
fetchRoomsForProperty, fetchRoom, fetchItemsForRoom, fetchItemsForProperty
doCreateRoom, doUpdateRoom, doDeleteRoom
doCreateInventoryItem, doUpdateInventoryItem, doDeleteInventoryItem

// ---- Appliances ----
fetchAppliancesForProperty, fetchAppliance
doCreateAppliance, doUpdateAppliance, doDeleteAppliance

// ---- Projects ----
fetchActiveProjects, fetchProjectsForProperty, fetchProject
doCreateProject, doUpdateProject, doDeleteProject
fetchPhasesForProject, doCreatePhase, doUpdatePhase, doDeletePhase
fetchPhotosForProject, doCreateProjectPhoto, doDeleteProjectPhoto

// ---- Settings ----
fetchSetting, doSetSetting

// ---- Listings (V1 -- preserved) ----
fetchHomesOverview, fetchHomeListings, fetchListingTours
doCreateHomeListing, doToggleHomeListingSaved, doUpdateHomeListingStatus
doDeleteHomeListing, doCreateHomeTour, doDeleteHomeTour
```

#### 11. [...slug]/page.tsx -- Catch-All Fallback

```typescript
import { ModuleWebFallback } from '@/components/module-web-fallback';
export default function HomesFallback() {
  return <ModuleWebFallback moduleName="MyHomes" ... />;
}
```

### Cleanup Required

Delete broken re-exports before building:
- `apps/web/app/homes/messages/page.tsx` (re-exports from non-existent `@myhomes-web`)
- `apps/web/app/homes/profile/page.tsx` (same)
- `apps/web/app/homes/sell/page.tsx` (same)
- `apps/web/app/homes/messages/` directory
- `apps/web/app/homes/profile/` directory
- `apps/web/app/homes/sell/` directory

---

## Test Plan

### Unit Tests (actions.ts)

Test every server action with the same pattern used in books/__tests__/:

```typescript
// File: apps/web/app/homes/__tests__/actions.test.ts
describe('homes web actions', () => {
  // Properties
  test('fetchProperties returns empty array initially');
  test('doCreateProperty creates and fetchProperty retrieves');
  test('doUpdateProperty modifies existing property');
  test('doDeleteProperty removes property');

  // Maintenance
  test('fetchAllActiveSchedules returns empty initially');
  test('doCreateSchedule creates schedule linked to property');
  test('doMarkComplete updates lastCompletedDate and nextDueDate');
  test('doDeactivateSchedule sets is_active to 0');

  // Costs
  test('doCreateCostEntry creates cost linked to property');
  test('fetchCostEntriesForProperty returns costs for specific property');
  test('doUpdateCostEntry modifies amount and category');
  test('doDeleteCostEntry removes cost');

  // Contractors
  test('doCreateContractor creates contractor');
  test('doToggleFavorite toggles is_favorite');
  test('fetchAllContractors returns all contractors');

  // Insurance
  test('doCreatePolicy creates policy linked to property');
  test('fetchPoliciesForProperty returns policies for property');

  // Documents
  test('doCreateDocument stores document metadata');
  test('fetchDocumentsForProperty returns documents for property');

  // Inventory
  test('doCreateRoom creates room in property');
  test('doCreateInventoryItem creates item in room');
  test('fetchItemsForRoom returns items for specific room');

  // Appliances
  test('doCreateAppliance creates appliance for property');
  test('fetchAppliancesForProperty returns appliances');

  // Projects
  test('doCreateProject creates project for property');
  test('doCreatePhase creates phase in project');
  test('fetchPhasesForProject returns ordered phases');

  // Settings
  test('doSetSetting stores and fetchSetting retrieves');

  // V1 listings (preserved)
  test('doCreateHomeListing creates listing');
  test('fetchHomeListings returns all listings');
});
```

**Estimated: 30-35 test cases**

### Integration Tests

| Test | Scenario |
|------|----------|
| Property lifecycle | Create -> add maintenance -> log cost -> add contractor -> delete |
| Schedule completion | Create schedule -> mark complete -> verify next_due_date recalculated |
| Cost aggregation | Create 5 costs across 2 categories -> verify getCostSummary totals |
| Coverage gap analysis | Create property with homeowners policy but no flood -> verify gap detected |
| Inventory value | Create room -> add 3 items with values -> verify getPropertyInventoryValue total |
| Project budget tracking | Create project with budget -> add phases with costs -> verify getBudgetVsActual |

### Visual/Browser Tests (via /browse)

| Page | Test Scenario |
|------|--------------|
| Dashboard | Load with 0 properties (empty state), 1 property (full), 3 properties (switcher) |
| Properties | Add property form, search filter, property card rendering |
| Property Detail | Each of 7 tabs renders correctly, tab switching preserves state |
| Maintenance | Filter chips work, mark-done updates status, sort by urgency |
| Costs | Stats calculation, category breakdown colors, table sorting |
| Contractors | Favorite toggle, specialty filter, copy-to-clipboard |
| Projects | Progress bar accuracy, budget vs actual rendering |
| Settings | Toggle persistence, default property selection |

---

## QA Checklist

### Pre-Build Cleanup
- [ ] Delete `apps/web/app/homes/messages/` directory
- [ ] Delete `apps/web/app/homes/profile/` directory
- [ ] Delete `apps/web/app/homes/sell/` directory

### Core Functionality
- [ ] Dashboard loads with correct property data
- [ ] Property switcher works with multiple properties
- [ ] Maintenance alerts show overdue (red) and due soon (amber) correctly
- [ ] "Mark Done" recalculates next due date
- [ ] Quick actions navigate to correct pages
- [ ] Cost snapshot shows accurate totals and category breakdown
- [ ] All nav tabs route correctly and highlight active tab

### CRUD Operations (per sub-domain)
- [ ] Properties: create, read, update, delete
- [ ] Maintenance schedules: create, read, update, mark complete, deactivate
- [ ] Cost entries: create, read, update, delete
- [ ] Contractors: create, read, update, toggle favorite, delete
- [ ] Insurance policies: create, read, update, delete
- [ ] Documents: create, read, update, delete
- [ ] Rooms: create, read, update, delete
- [ ] Inventory items: create, read, update, delete
- [ ] Appliances: create, read, update, delete
- [ ] Projects: create, read, update, delete
- [ ] Project phases: create, read, update, delete
- [ ] Settings: read, update

### Five States (per page)
- [ ] Loading: skeleton screens render (no spinners)
- [ ] Empty: warm CTA with module-specific icon
- [ ] Error: glass card with "Something went wrong" + retry (no technical messages)
- [ ] Success: full data rendering
- [ ] Partial: appropriate sub-state handling

### Design Compliance
- [ ] All backgrounds use Cool Obsidian tokens (no light theme)
- [ ] Accent color is `#D97706` throughout
- [ ] Glass header with correct blur/saturate
- [ ] Typography follows DESIGN.md variants
- [ ] Border radius: 16px cards, 999px pills
- [ ] No placeholder/non-functional buttons
- [ ] No "Coming Soon" text
- [ ] No developer-facing text visible to users
- [ ] `font-variant-numeric: tabular-nums` on financial figures

### Responsive
- [ ] Desktop (>1024px): 3-column dashboard, multi-column property detail
- [ ] Tablet (768-1024px): 2-column layout, sidebar collapses
- [ ] Mobile (<768px): single column, full-bleed cards

### Accessibility
- [ ] All interactive elements keyboard-focusable
- [ ] Tab order matches visual order
- [ ] Focus indicators visible (2px accent outline)
- [ ] ARIA landmarks on all pages
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 body, 3:1 large)

### Error Handling
- [ ] Every server action call wrapped in try/catch/finally
- [ ] `finally` always sets loading to false (prevents stuck-loading bug)
- [ ] Delete operations have confirmation dialog
- [ ] Form validation on required fields before submit

### Performance
- [ ] No N+1 queries (batch fetch where possible)
- [ ] useEffect cleanup with cancelled flag
- [ ] Stable callback references (useCallback for handlers)
- [ ] useMemo for derived data (filtered lists, computed stats)

---

## Build Sequence

| Step | Files | Depends On | Effort |
|------|-------|-----------|--------|
| 0 | Delete broken re-exports (3 dirs) | -- | 5 min |
| 1 | `actions.ts` (full rewrite) | Module CRUD + engines | 45 min |
| 2 | `layout.tsx` | -- | 15 min |
| 3 | `page.tsx` (dashboard) | actions.ts | 30 min |
| 4 | `properties/page.tsx` | actions.ts | 25 min |
| 5 | `properties/[id]/page.tsx` (7-tab center) | actions.ts | 60 min |
| 6 | `maintenance/page.tsx` | actions.ts | 25 min |
| 7 | `costs/page.tsx` | actions.ts | 30 min |
| 8 | `contractors/page.tsx` | actions.ts | 25 min |
| 9 | `projects/page.tsx` | actions.ts | 30 min |
| 10 | `settings/page.tsx` | actions.ts | 15 min |
| 11 | `[...slug]/page.tsx` | -- | 5 min |
| 12 | `__tests__/actions.test.ts` | actions.ts | 30 min |
| 13 | `/function-gate-runner` | All files | 10 min |
| 14 | `/review` | All files | 15 min |
| 15 | `/browse` QA | Running dev server | 20 min |

**Total estimated: ~6 hours agent time**

---

## Appendix: Module Exports Reference

### CRUD Functions (60+)

<details>
<summary>Full list from modules/homes/src/index.ts</summary>

**Listings:** createListing, getListings, toggleListingSaved, updateListingStatus, deleteListing, countSavedListings, getHomeMarketMetrics

**Tours:** createTour, getToursByListing, deleteTour

**Properties:** createProperty, getProperty, getProperties, updateProperty, deleteProperty, promoteListingToProperty

**Schedules:** createSchedule, getSchedule, getSchedulesForProperty, getAllActiveSchedules, updateSchedule, deactivateSchedule, deleteSchedulesByProperty

**Settings:** getSetting, setSetting

**Costs:** createCostEntry, getCostEntry, getCostEntriesForProperty, getCostEntriesForSchedule, updateCostEntry, deleteCostEntry

**Documents:** createDocument, getDocument, getDocumentsForProperty, updateDocument, deleteDocument

**Contractors:** createContractor, getContractor, getContractorsForProperty, getAllContractors, updateContractor, toggleFavorite, deleteContractor

**Services:** createService, getServicesForContractor, getServicesForSchedule, deleteService

**Insurance:** createPolicy, getPolicy, getPoliciesForProperty, updatePolicy, deletePolicy

**Rooms:** createRoom, getRoom, getRoomsForProperty, updateRoom, deleteRoom

**Inventory:** createInventoryItem, getInventoryItem, getItemsForRoom, getItemsForProperty, updateInventoryItem, deleteInventoryItem

**Appliances:** createAppliance, getAppliance, getAppliancesForProperty, updateAppliance, deleteAppliance

**Projects:** createProject, getProject, getProjectsForProperty, getActiveProjects, updateProject, deleteProject

**Phases:** createPhase, getPhase, getPhasesForProject, updatePhase, deletePhase

**Photos:** createProjectPhoto, getPhotosForProject, getPhotosForPhase, deleteProjectPhoto

</details>

### Engine Functions (30+)

<details>
<summary>Full list from modules/homes/src/engines/</summary>

**Reminder:** getDefaultSchedules, calculateNextDueDate, calculateScheduleStatus, sortByUrgency, markComplete, getTaskTypeLabel

**Cost:** getCostSummary, getMonthlyCostTrend, getLifetimeCosts, getCostsBySchedule

**Document:** getExpiringDocuments, searchDocuments, getDocumentStats

**Contractor:** getContractorsBySpecialty, getFavoriteContractors, getContractorForTaskType, getContractorStats

**Insurance:** getActivePolicies, getExpiringPolicies, getPolicyCostSummary, checkCoverageGaps

**Inventory:** getPropertyInventoryValue, getRoomSummary, getItemsByCategory, getHighValueItems, exportInventoryCSV

**Appliance:** getWarrantyStatus, getAppliancesNeedingAttention, searchAppliances, getAppliancesByCategory

**Project:** getProjectSummary, getBudgetVsActual, getPhaseProgress, getActiveProjectCount

</details>
