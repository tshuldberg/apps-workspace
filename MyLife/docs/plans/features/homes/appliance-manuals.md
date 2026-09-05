# Feature Spec: Appliance Manuals & Warranty Tracking

## Metadata
- **Module:** homes
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [1] x1 + PaidUser [3] x1
- **Sprint:** 9
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Home inventory (B-tier, for linking appliances to inventory items)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Homeowners and renters accumulate appliances over years, losing track of model numbers, warranty expiry dates, and where they stored the manual. When something breaks, finding the right manual or checking warranty status means digging through filing cabinets, email receipts, or manufacturer websites. Centriq ($32/yr) built its entire product around this pain point: scan a barcode, get the manual, track the warranty. By adding appliance tracking to MyHomes, users get the same capability inside an app they already use for property management and maintenance scheduling. The switching score (3/5) reflects that Centriq users have strong appliance data that creates lock-in, but the frustration of paying for a separate single-purpose app is real. Linking appliances to existing maintenance schedules (e.g., "HVAC filter reminder" links to the specific HVAC unit with its model number and manual) adds context that no competitor provides in a unified experience.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Centriq | Yes (core feature) | Yes ($32/yr) | Barcode scan to identify appliance, auto-fetches manual PDFs, warranty tracking, how-to guides, push notifications for warranty expiry |
| HomeZada | Partial | Yes ($59-99/yr) | Basic appliance inventory with photos. No barcode scanning. No auto-manual lookup. Manual entry only. |
| Thumbtack | No | N/A | Contractor marketplace only |
| Angi | No | N/A | Contractor marketplace only |
| Notion / Spreadsheet | DIY | No | Manual tracking, no warranty reminders, no manual linking |

### Target User
Homeowners (25-65) who own 10-30+ appliances across 1-3 properties and currently have no systematic way to track model numbers, warranties, or manuals. Users of Centriq ($32/yr) who want appliance tracking bundled into their MyLife subscription. Users who already have maintenance schedules set up in MyHomes and want to link reminders to specific appliance units for richer context (e.g., "Replace HVAC filter" linked to "Carrier 24ACC636A003 in basement"). New homeowners who just purchased a home full of unfamiliar appliances and need to catalog them quickly.

## Technical Context

### Where This Lives in MyLife

```
modules/homes/src/
  types.ts                                  -- New Zod schemas: Appliance, ApplianceCategory, ApplianceCondition, ApplianceInput
  db/schema.ts                              -- New table: hm_appliances + indexes
  db/appliances.ts                          -- NEW: appliance CRUD operations
  db/index.ts                               -- Re-export appliance CRUD
  engines/appliance-engine.ts               -- NEW: warranty status, search, attention-needed logic
  engines/index.ts                          -- Re-export appliance engine functions
  definition.ts                             -- Migration v3 (or v4 if insurance ships first) for new table
  index.ts                                  -- Re-export new types and engine functions
  __tests__/appliance-engine.test.ts        -- NEW: unit tests for appliance engine

apps/mobile/app/(homes)/
  appliances.tsx                            -- NEW: Appliance list screen (per-property)
  appliance-detail.tsx                      -- NEW: Appliance detail view
  add-appliance.tsx                         -- NEW: Add/Edit appliance form

apps/web/app/homes/
  appliances/page.tsx                       -- NEW: Appliance list web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHomes card
       ├── Search tab (existing listings)
       ├── Saved tab (existing saved listings)
       ├── Properties tab (V2 - existing)
       ├── Reminders tab (V2 - existing)
       └── Property Detail screen
            ├── Maintenance section (existing)
            ├── Insurance section (B-tier, may or may not exist yet)
            └── Appliances section ← NEW (YOU ARE HERE)
                 ├── Appliance cards grouped by room/category
                 └── "Add Appliance" button
```

Appliances are accessed from:
1. Property detail screen's new "Appliances" section (primary entry point)
2. Maintenance reminder detail screen link ("View linked appliance") when a schedule has a linked appliance
3. A dedicated "Appliances" screen accessible from the Properties tab overflow menu

### Data Model

```sql
-- New table: hm_appliances (Migration v3 or v4)
CREATE TABLE IF NOT EXISTS hm_appliances (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
    room_id TEXT,
    inventory_item_id TEXT,
    name TEXT NOT NULL,
    brand TEXT,
    model_number TEXT,
    serial_number TEXT,
    purchase_date TEXT,
    purchase_price_cents INTEGER,
    warranty_expiry TEXT,
    manual_uri TEXT,
    photo_uri TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    condition TEXT NOT NULL DEFAULT 'good',
    schedule_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS hm_appliances_property_idx
    ON hm_appliances(property_id);
CREATE INDEX IF NOT EXISTS hm_appliances_category_idx
    ON hm_appliances(category);
CREATE INDEX IF NOT EXISTS hm_appliances_warranty_idx
    ON hm_appliances(warranty_expiry ASC);
```

**category enum values:** `hvac`, `kitchen`, `laundry`, `plumbing`, `electrical`, `outdoor`, `other`

**condition enum values:** `new`, `good`, `fair`, `poor`, `replaced`

**Note on FK fields:** `room_id`, `inventory_item_id`, and `schedule_id` are plain TEXT fields with no REFERENCES constraints. They serve as optional soft links to future features (home inventory rooms, inventory items, maintenance schedules). The schedule_id can reference an hm_maintenance_schedules.id but is not enforced at the database level to avoid circular dependency issues and migration ordering problems.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for next schema version)
- **External:** `zod` (schema validation). No external APIs required. Manual PDFs are user-provided URIs (local file path or URL), not fetched from manufacturer APIs.
- **Cross-Module:** Soft link to maintenance schedules via `schedule_id` (same module, existing table). Future integration with home inventory (B-tier) via `inventory_item_id`. No cross-module dependencies outside homes.

## Functional Requirements

### User Stories
1. As a homeowner, I want to catalog all my appliances with brand, model number, and serial number, so I can quickly reference this information when scheduling service calls or ordering replacement parts.
2. As a homeowner, I want to track warranty expiry dates for each appliance, so I know whether a repair should be a warranty claim or an out-of-pocket expense.
3. As a user with maintenance schedules, I want to link an appliance to a maintenance reminder (e.g., link my specific HVAC unit to the "HVAC filter change" schedule), so the reminder shows which unit needs attention.
4. As a homeowner, I want to attach a manual URI (link or file path) to an appliance, so I can quickly access the manual without searching online.
5. As a new homeowner, I want to quickly scan through rooms and add appliances by category, so I can build a complete inventory of my home's equipment.
6. As a multi-property owner, I want to see appliances grouped by property and room, so I can manage equipment across all my homes.

### Behavior Specification

**Adding an appliance:**
1. User navigates to Property detail > Appliances section.
2. User taps "Add Appliance".
3. Form shows: name (text, required), brand (text), model number (text), serial number (text), category selector (HVAC/Kitchen/Laundry/Plumbing/Electrical/Outdoor/Other), condition selector (New/Good/Fair/Poor/Replaced), room name (text, freeform), purchase date (date picker), purchase price (currency input), warranty expiry date (date picker), manual URI (text input with "Paste Link" helper), photo (camera/gallery picker), linked maintenance schedule (dropdown of active schedules for this property), notes (text area).
4. User saves. The appliance record is created and linked to the property.

**Viewing appliance list:**
1. User navigates to Property detail > Appliances section.
2. Appliances are shown as cards, grouped by category.
3. Each card shows: appliance name (bold), brand and model number subtitle, category icon, warranty status badge (active/expiring/expired/unknown), condition indicator.
4. Summary bar at top: total appliance count, count with active warranties, count needing attention (poor condition or expired warranty).
5. If no appliances exist, empty state shows "No appliances tracked" with "Add Appliance" CTA.

**Searching appliances:**
1. A search bar at the top of the Appliances section filters by name, brand, model number, or serial number.
2. Search is real-time, filtering as the user types.
3. Search matches are highlighted in the card text.

**Warranty status tracking:**
1. Engine function `getWarrantyStatus(appliance)` returns one of:
   - `active`: warranty_expiry is set and > today
   - `expiring_soon`: warranty_expiry is within 30 days
   - `expired`: warranty_expiry is set and < today
   - `unknown`: warranty_expiry is null
2. Warranty expiry reminders surface on the Reminders tab alongside maintenance reminders, using a shield icon.
3. Appliances with `expiring_soon` warranties show an amber badge. Appliances with `expired` warranties show a red badge.

**Linking to maintenance schedules:**
1. When adding or editing an appliance, the user can select a maintenance schedule from a dropdown of active schedules for the same property.
2. When selected, the appliance's `schedule_id` is set.
3. On the maintenance reminder detail screen, if a schedule has a linked appliance, a "View Appliance" link appears showing the appliance name, brand, and model number.
4. This is a one-to-one optional link. Multiple appliances can reference the same schedule, but typically one appliance maps to one schedule.

**Appliances needing attention:**
1. Engine function `getAppliancesNeedingAttention(propertyId)` returns appliances that match any of:
   - condition is "poor"
   - warranty is "expired" and condition is not "replaced"
   - warranty is "expiring_soon"
2. These appear in a "Needs Attention" section at the top of the Appliances list.

**Appliance detail view:**
1. User taps an appliance card.
2. Detail screen shows all fields: name, brand, model, serial, category, condition, room, purchase info, warranty status with expiry date, manual link (tappable to open), photo (if attached), linked schedule info, notes.
3. Action buttons: "Edit", "Delete", "Open Manual" (opens URI), "View Schedule" (if linked).

### Edge Cases

- **No properties exist:** Appliances section is not visible. User must add a property first.
- **Property with no appliances:** Section shows empty state with "Add Appliance" button.
- **Appliance with no warranty date:** Warranty status shows "Unknown" with a neutral gray badge. No reminder is created.
- **Appliance with no model number:** Allowed. Model number is optional. Search still works on name and brand.
- **Manual URI is an invalid URL:** Accepted as-is (stored as plain text). If the URI fails to open, the system shows a toast "Could not open manual link." No validation on URI format beyond non-empty string.
- **Photo not available:** Photo field shows a placeholder icon. Photo is optional.
- **Linked schedule is deleted:** The `schedule_id` becomes a dangling reference. The appliance detail shows "Linked schedule not found" with option to clear the link. No CASCADE because schedule_id is a soft FK.
- **Linked schedule is deactivated:** Same behavior as deleted. The link persists but the schedule detail shows "Inactive".
- **Condition set to "replaced":** Appliance remains in the list but moves to a "Replaced" section at the bottom. Not included in "needing attention" calculations.
- **Property deleted with appliances:** CASCADE delete removes all associated appliances.
- **Many appliances (50+ per property):** List must render without lag. Use virtualized list (FlatList on mobile) with category-based section headers.
- **Same model number for multiple appliances:** Allowed. A property may have two identical HVAC units.
- **User navigates away mid-form:** Unsaved changes are discarded. No draft persistence.
- **Purchase price of $0:** Allowed (gift or included with home purchase). Show "Not specified" if null, show "$0" if explicitly set to 0.
- **Search with no results:** Show "No appliances match your search" with option to clear search.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Adding a new appliance with required fields (name, category) saves successfully and appears in the property detail Appliances section.
- [ ] **AC-2:** Appliance cards are grouped by category with category headers and icons.
- [ ] **AC-3:** Each appliance card displays name, brand, model number, warranty status badge, and condition indicator.
- [ ] **AC-4:** The summary bar shows total count, active warranty count, and "needing attention" count.
- [ ] **AC-5:** Tapping an appliance card opens the detail view with all fields and action buttons.
- [ ] **AC-6:** Search filters appliances by name, brand, model number, or serial number in real time.
- [ ] **AC-7:** Appliances with warranties expiring within 30 days show an amber "Expiring" badge.
- [ ] **AC-8:** Appliances with expired warranties show a red "Expired" badge.
- [ ] **AC-9:** Appliances with active warranties show a green "Active" badge.
- [ ] **AC-10:** Appliances with no warranty date show a gray "Unknown" badge.
- [ ] **AC-11:** Linking an appliance to a maintenance schedule shows the appliance info on the schedule's reminder detail screen.
- [ ] **AC-12:** "Open Manual" button opens the manual URI in an in-app browser or external browser.
- [ ] **AC-13:** "Needs Attention" section appears at the top when appliances have poor condition or expired/expiring warranties.
- [ ] **AC-14:** Editing an appliance updates all fields and recalculates warranty status.
- [ ] **AC-15:** Deleting an appliance removes it from the list and updates the summary counts.
- [ ] **AC-16:** Empty state shows "No appliances tracked" with "Add Appliance" CTA when a property has no appliances.
- [ ] **AC-17:** Appliances with condition "replaced" appear in a collapsed "Replaced" section at the bottom.

### Technical Criteria
- [ ] **TC-1:** Schema migration creates hm_appliances table with all columns, 3 indexes, and correct hm_ prefix.
- [ ] **TC-2:** `getAppliancesByProperty(propertyId)` returns all appliances for a property, sorted by category then name.
- [ ] **TC-3:** `getAppliancesByRoom(propertyId, room)` returns appliances filtered by room name.
- [ ] **TC-4:** `getWarrantyStatus(appliance)` returns "active" when warranty_expiry > today.
- [ ] **TC-5:** `getWarrantyStatus(appliance)` returns "expiring_soon" when warranty_expiry is within 30 days.
- [ ] **TC-6:** `getWarrantyStatus(appliance)` returns "expired" when warranty_expiry < today.
- [ ] **TC-7:** `getWarrantyStatus(appliance)` returns "unknown" when warranty_expiry is null.
- [ ] **TC-8:** `searchAppliances(propertyId, query)` matches on name, brand, model_number, and serial_number fields.
- [ ] **TC-9:** `searchAppliances` is case-insensitive and matches partial strings.
- [ ] **TC-10:** `getAppliancesNeedingAttention(propertyId)` returns appliances with poor condition, expired warranty, or expiring warranty.
- [ ] **TC-11:** `getAppliancesNeedingAttention` excludes appliances with condition "replaced".
- [ ] **TC-12:** Appliance CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-13:** Deleting a property CASCADE-deletes all associated appliances.
- [ ] **TC-14:** Zod validation requires name as non-empty string.
- [ ] **TC-15:** Zod validation restricts category to the 7 allowed enum values.
- [ ] **TC-16:** Zod validation restricts condition to the 5 allowed enum values.
- [ ] **TC-17:** Search across 50 appliances completes in < 100ms.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Appliance operations must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** Adding or modifying appliances must NOT affect existing hm_maintenance_schedules, hm_listings, or hm_tours records.
- [ ] **NC-3:** Deleting an appliance must NOT delete the linked maintenance schedule (schedule_id is a soft FK).
- [ ] **NC-4:** The schedule_id field must NOT use a REFERENCES constraint. It is a plain TEXT column for forward-compatible soft linking.
- [ ] **NC-5:** Deleting an appliance must NOT delete the associated property.
- [ ] **NC-6:** Appliances with condition "replaced" must NOT appear in the "Needs Attention" section.

## UI Specification

### Mobile (Expo)

**Appliances Section (Property Detail):**
- Background: `#0A0A0F` (background token)
- Section header: "Appliances" with total count badge in module accent `#D97706`
- Search bar: glass card fill with search icon, placeholder "Search appliances..."
- Summary bar: glass card showing total count, active warranties, needing attention
- "Needs Attention" section (when applicable): amber-tinted glass cards with `#FFD60A` left border
- Category group headers: category icon + label in `textSecondary` (`rgba(240,240,245,0.65)`)
- Appliance cards: glass token fill (`rgba(255,255,255,0.04)`) with glassBorder (`rgba(255,255,255,0.10)`)
- Card layout: Category icon (left, accent-colored) | Name (bold, `#F0F0F5`) + Brand/Model subtitle in `textSecondary` | Warranty badge (right-aligned) | Condition dot indicator (bottom-right)
- Warranty badges:
  - Active: `#30D158` background, shield-check icon, white text
  - Expiring: `#FFD60A` background, shield-alert icon, dark text
  - Expired: `#FF453A` background, shield-x icon, white text
  - Unknown: `rgba(255,255,255,0.15)` background, shield icon, `textSecondary` text
- Condition indicators: small dot - green (new/good), amber (fair), red (poor), gray (replaced)
- "Add Appliance" button at bottom: accent color outline, glass background
- Empty state: Wrench icon (centered), "No appliances tracked" in `textSecondary`, "Add Appliance" button in accent color
- "Replaced" section: collapsed by default, gray-tinted, appliance cards with reduced opacity

**Appliance Detail Screen:**
- Bottom sheet on small screens, full modal on iPad
- Name, brand, model at top (large, accent-colored)
- Photo thumbnail if available (top-right corner, tappable to enlarge)
- Info grid: category, condition, room, purchase date, purchase price in 2-column glass card layout
- Warranty section: status badge (large), expiry date, days remaining (or "Expired X days ago")
- Manual link: glass card with document icon, tappable to open
- Linked schedule: glass card with bell icon, schedule name, next due date, tappable to navigate
- Notes section if non-empty
- Action buttons: full-width, stacked vertically, glass background

**Add/Edit Appliance Form:**
- Form fields: name (text, required), brand (text), model number (text), serial number (text), category (segmented: HVAC/Kitchen/Laundry/Plumbing/Electrical/Outdoor/Other), condition (segmented: New/Good/Fair/Poor/Replaced), room (text, freeform with autocomplete from existing rooms), purchase date (date picker), purchase price (currency input), warranty expiry (date picker), manual link (text input), photo (camera/gallery button), linked schedule (dropdown), notes (text area)
- Save button: full-width, accent color
- Camera/gallery button: accent color icon, opens action sheet with "Take Photo" / "Choose from Library"

### Web (Next.js)

- Same tokens via CSS variables
- Appliances accessible from property detail page at `/homes/properties/[id]#appliances`
- Cross-property view at `/homes/appliances` (from Properties tab overflow)
- Cards use glass morphism via `backdrop-filter: blur(16px)` and glass token backgrounds
- Appliance detail opens as a side panel (not modal) for better UX on wide screens
- Search bar is always visible at the top of the list
- Category groups are collapsible sections
- Manual link opens in a new tab
- Photo displays inline with lightbox on click

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (3) with pulsing animation | Initial data fetch from SQLite |
| Empty | Wrench icon, "No appliances tracked" + "Add Appliance" CTA | No records in hm_appliances for this property |
| Error | "Something went wrong loading appliances" + retry button | SQLite read failure |
| Success (all healthy) | Appliance cards grouped by category, all green/gray warranty badges | No attention-needing appliances |
| Success (mixed) | "Needs Attention" section at top (amber), then healthy grouped by category | Some appliances with poor condition or warranty issues |
| Partial (search active) | Filtered list matching search query, or "No results" message | User typing in search bar |

## Test Requirements

### Unit Tests (modules/homes/src/__tests__/appliance-engine.test.ts)
- [ ] `getAppliancesByProperty`: returns all appliances for a given property
- [ ] `getAppliancesByProperty`: sorts by category then by name alphabetically
- [ ] `getAppliancesByProperty`: returns empty array when no appliances exist
- [ ] `getAppliancesByRoom`: filters correctly by room name (case-insensitive)
- [ ] `getAppliancesByRoom`: returns empty array for non-existent room
- [ ] `getWarrantyStatus`: returns "active" for warranty expiry 60 days from now
- [ ] `getWarrantyStatus`: returns "expiring_soon" for warranty expiry 15 days from now
- [ ] `getWarrantyStatus`: returns "expired" for warranty expiry 30 days ago
- [ ] `getWarrantyStatus`: returns "unknown" when warranty_expiry is null
- [ ] `getWarrantyStatus`: boundary test - returns "expiring_soon" for exactly 30 days from now
- [ ] `getWarrantyStatus`: boundary test - returns "active" for 31 days from now
- [ ] `searchAppliances`: matches on name (case-insensitive, partial)
- [ ] `searchAppliances`: matches on brand
- [ ] `searchAppliances`: matches on model_number
- [ ] `searchAppliances`: matches on serial_number
- [ ] `searchAppliances`: returns empty array for non-matching query
- [ ] `getAppliancesNeedingAttention`: includes appliances with condition "poor"
- [ ] `getAppliancesNeedingAttention`: includes appliances with expired warranty
- [ ] `getAppliancesNeedingAttention`: includes appliances with expiring warranty
- [ ] `getAppliancesNeedingAttention`: excludes appliances with condition "replaced"
- [ ] `getAppliancesNeedingAttention`: excludes healthy appliances (good condition, active warranty)
- [ ] Zod validation: requires name as non-empty string
- [ ] Zod validation: rejects invalid category enum value
- [ ] Zod validation: rejects invalid condition enum value
- [ ] Zod validation: accepts all optional fields as null/undefined

### Integration Tests
- [ ] Full flow: create property, add appliance with warranty, appliance appears in property detail
- [ ] Full flow: add 5 appliances across 3 categories, verify category grouping and sort order
- [ ] Full flow: set warranty_expiry to 15 days from now, verify "expiring_soon" status and badge
- [ ] Full flow: link appliance to maintenance schedule, verify link appears on reminder detail screen
- [ ] Full flow: delete appliance, verify it disappears from list and summary updates
- [ ] Full flow: delete property, all associated appliances are CASCADE-deleted
- [ ] Full flow: search by model number, verify correct appliance returned
- [ ] Error flow: create appliance without name, validation error returned, no record persisted

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyHomes module. Go to Properties tab. Ensure at least one property exists (e.g., "Main House"). -- Setup prerequisite.
3. Tap "Main House" to open property detail. Scroll to Appliances section. Verify empty state with "Add Appliance" CTA. -- Verifies empty state, AC-16.
4. Tap "Add Appliance". Fill in: name "Carrier HVAC", brand "Carrier", model "24ACC636A003", serial "1234567890", category "HVAC", condition "Good", room "Basement", purchase date 2022-01-15, purchase price $4,500, warranty expiry (set to 20 days from today), manual link "https://carrier.com/manuals/24ACC636A003.pdf". Save. -- Verifies AC-1.
5. Verify the appliance card appears grouped under "HVAC" category with name, brand/model subtitle, and amber "Expiring" warranty badge. -- Corresponds to AC-2, AC-3, AC-7.
6. Verify the summary bar shows "1 appliance, 0 active warranties, 1 needing attention". -- Corresponds to AC-4.
7. Verify "Needs Attention" section appears with the HVAC unit. -- Corresponds to AC-13.
8. Tap the HVAC card. Verify detail view shows all entered fields. Tap "Open Manual". Verify the URL opens. -- Corresponds to AC-5, AC-12.
9. Go back. Add a second appliance: name "Samsung Fridge", brand "Samsung", model "RF28R7551SR", category "Kitchen", condition "New", warranty expiry 2 years from today. Save. -- Setup for AC-9.
10. Verify the fridge card shows a green "Active" warranty badge. -- Corresponds to AC-9.
11. Add a third appliance: name "Bosch Dishwasher", brand "Bosch", model "SHPM88Z75N", category "Kitchen", condition "Fair", no warranty date. Save. -- Setup for AC-10.
12. Verify the dishwasher card shows a gray "Unknown" warranty badge. -- Corresponds to AC-10.
13. Verify appliances are grouped: HVAC section (Carrier HVAC), Kitchen section (Bosch Dishwasher, Samsung Fridge). -- Corresponds to AC-2.
14. Type "Samsung" in the search bar. Verify only the fridge appears. Clear search. -- Corresponds to AC-6.
15. Type "SHPM88" in the search bar. Verify the Bosch dishwasher appears (search by model number). Clear search. -- Corresponds to AC-6.
16. Edit the Carrier HVAC: link to an existing "HVAC filter change" maintenance schedule (if one exists from the maintenance feature). Save. Navigate to the HVAC filter reminder detail. Verify "View Appliance" link shows "Carrier HVAC - Carrier 24ACC636A003". -- Corresponds to AC-11.
17. Edit the Bosch Dishwasher: change condition to "Replaced". Save. Verify it moves to a collapsed "Replaced" section at the bottom. Verify "Needs Attention" section no longer includes it. -- Corresponds to AC-17.
18. Delete the Samsung Fridge. Verify it disappears and the summary bar updates. -- Corresponds to AC-15.
19. Add an appliance with expired warranty (set warranty_expiry to 6 months ago). Verify red "Expired" badge and "Needs Attention" inclusion. -- Corresponds to AC-8, AC-13.
20. Repeat key steps (3-9, 14-15) on web at `/homes/properties/[id]#appliances`. Verify functional parity. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to property detail Appliances section, verify all 5 states (loading, empty, error, success-healthy, success-mixed, partial-search)
- [ ] Batch QA: after 5 features in homes module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `appliance-engine.ts` (getAppliancesByProperty, getAppliancesByRoom, getWarrantyStatus, searchAppliances, getAppliancesNeedingAttention)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- homes module has active standalone counterpart (MyHomes)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Homes module has 5 tables (V1: hm_listings, hm_tours; V2: hm_properties, hm_maintenance_schedules, hm_settings) plus possibly hm_insurance_policies (V3, if insurance ships first)
- Properties and maintenance reminders are built (A-tier feature complete)
- No concept of appliance tracking, warranty management, or manual storage
- Property detail screen exists but has no appliances section
- Maintenance schedules exist but have no link to specific appliance units

### After This Work
- Homes module gains hm_appliances table with 3 new indexes
- Schema version incremented (v3 or v4 depending on ordering with insurance feature)
- New "Appliances" section on property detail screen showing appliance cards grouped by category, warranty status badges, and "Needs Attention" section
- `appliance-engine.ts` contains pure functions for warranty status calculation, search, attention-needed filtering, and room/category grouping
- Maintenance schedule linking: schedule_id on appliance soft-links to hm_maintenance_schedules, adding appliance context to reminder detail screens
- Mobile: warranty expiry reminders integrate with existing Reminders tab
- Web: appliance views at `/homes/properties/[id]#appliances` and `/homes/appliances`

### Files Changed

- `modules/homes/src/types.ts` -- Add ApplianceSchema, ApplianceCategorySchema, ApplianceConditionSchema, WarrantyStatusSchema, ApplianceInputSchema
- `modules/homes/src/db/schema.ts` -- Add CREATE_APPLIANCES table, 3 indexes, export in migration tables array
- `modules/homes/src/db/appliances.ts` -- NEW: appliance CRUD (create, get, getByProperty, getByRoom, update, delete, search)
- `modules/homes/src/db/index.ts` -- Re-export appliance CRUD functions
- `modules/homes/src/engines/appliance-engine.ts` -- NEW: getAppliancesByProperty, getAppliancesByRoom, getWarrantyStatus, searchAppliances, getAppliancesNeedingAttention
- `modules/homes/src/engines/index.ts` -- Re-export appliance engine functions and types
- `modules/homes/src/definition.ts` -- Add next migration version, update schemaVersion, add appliance-detail and add-appliance screens to navigation
- `modules/homes/src/index.ts` -- Re-export new types and engine functions
- `modules/homes/src/__tests__/appliance-engine.test.ts` -- NEW: 24+ unit tests for appliance engine
- `apps/mobile/app/(homes)/appliances.tsx` -- NEW: Appliance list screen
- `apps/mobile/app/(homes)/appliance-detail.tsx` -- NEW: Appliance detail screen
- `apps/mobile/app/(homes)/add-appliance.tsx` -- NEW: Add/Edit appliance form
- `apps/web/app/homes/appliances/page.tsx` -- NEW: Appliance list web page

### Known Limitations
- No barcode scanning for model number lookup. Centriq's killer feature (scan barcode, get manual) requires a product database API. MyLife is offline-first, so manual URI is user-provided.
- No automatic manual PDF fetching from manufacturer websites. The manual_uri is a user-provided link or file path.
- room_id is a plain text field, not linked to a structured room entity. A future "Rooms" feature could normalize this.
- inventory_item_id is a placeholder for the Home Inventory feature (B-tier). Until that ships, it is always null.
- Photo storage is URI-based (local file system path). No image upload, compression, or cloud storage. Photos persist only as long as the device retains the file.
- No appliance lifecycle analytics (e.g., "your HVAC is 12 years old, average lifespan is 15 years"). This requires a product age database.
- The schedule_id soft FK means dangling references are possible if schedules are deleted. The engine handles this gracefully by showing "Schedule not found" rather than crashing.

### Context for Next Agent
- The migration version depends on whether insurance-tracking ships first. If insurance is v3, appliances should be v4. Check `definition.ts` at build time and use the next available version number.
- Follow the same migration pattern as V2: array of SQL strings exported as a named constant, referenced in the HOMES_MIGRATION_VN object in `definition.ts`.
- The appliance engine should be a pure function module (no database access). It receives arrays of appliances as arguments and returns filtered/sorted/analyzed results. Database queries live in `db/appliances.ts`.
- The schedule_id soft link pattern is intentional. Do NOT add a REFERENCES constraint. The engine should handle missing schedule references gracefully (check if the schedule exists before rendering the link).
- Category icons should map to existing icon sets: HVAC (thermometer), Kitchen (utensils), Laundry (shirt), Plumbing (droplet), Electrical (zap), Outdoor (tree), Other (box). Use `@tabler/icons-react` or Expo vector icons.
- The search function should use SQLite LIKE queries for simplicity. No FTS5 index needed for this table size. Pattern: `WHERE name LIKE ? OR brand LIKE ? OR model_number LIKE ? OR serial_number LIKE ?` with `%query%` bindings.
- Currency values (purchase_price_cents) follow the same cents-to-dollars conversion pattern used throughout the homes module.
