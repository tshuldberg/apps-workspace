# Feature Spec: Contractor Contacts

## Metadata
- **Module:** homes
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** 8
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Maintenance schedule reminders (A-tier, done)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Finding a trustworthy contractor is one of the most stressful parts of homeownership. Once a homeowner finds a good plumber, electrician, or HVAC technician, they want to keep that contact forever. Today, most homeowners store contractor info in phone contacts (mixed with personal contacts), random notes, or text message threads. When the maintenance reminders feature tells a user "HVAC service is due," the natural next question is "Who do I call?" Contractor contacts close this loop by putting trusted service providers one tap away from the reminder that triggered the need. Unlike Thumbtack or Angi, this is not a marketplace. There is no contractor discovery, booking, or lead generation. It is a private, offline address book for home service professionals the user already trusts.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| HomeZada | Yes | Yes ($59-99/yr) | Cloud-based contractor directory with ratings, service history, contact info, linked to maintenance tasks. Also has a marketplace for finding new contractors. |
| Centriq | Partial | Yes ($32/yr) | Product-centric contacts (e.g., link installer info to an appliance). No general contractor rolodex. |
| Thumbtack | Different | No (free) | Marketplace for finding and booking new contractors. No personal contractor management. Revenue from contractor leads. |
| Angi | Different | No (free) | Contractor discovery and reviews. No personal rolodex or maintenance integration. Revenue from contractor ads. |

### Target User
Homeowners (30-65) who have built relationships with trusted contractors over years and want a single organized place to store their contact info. Multi-property owners who use different contractors at different locations. Users of the maintenance reminders feature who want quick access to the right contractor when a task is due. Users who are frustrated with Thumbtack/Angi pushing new contractors when they already know who they want to call. The anti-marketplace stance is a deliberate differentiator: MyHomes respects that users have existing relationships and does not try to monetize or disintermediate them.

## Technical Context

### Where This Lives in MyLife

```
modules/homes/src/
  types.ts                                  -- New Zod schemas: Contractor, ContractorSpecialty, ContractorService
  db/schema.ts                              -- New tables: hm_contractors, hm_contractor_services + indexes
  db/crud.ts                                -- New CRUD: contractor and service create/read/update/delete, search, specialty queries
  engines/contractor-engine.ts              -- NEW: getContractorsBySpecialty, getContractorForSchedule, getServiceHistory, getFavoriteContractors, getContractorStats
  definition.ts                             -- Migration (version depends on ordering with other Sprint 8 features)
  __tests__/contractor-engine.test.ts       -- NEW: unit tests for contractor engine

apps/mobile/app/(homes)/
  contractors.tsx                           -- NEW: Contractor list screen (per property or all)
  add-contractor.tsx                        -- NEW: Add/Edit contractor form
  contractor-detail.tsx                     -- NEW: Contractor detail with service history

apps/web/app/homes/
  contractors/page.tsx                      -- NEW: Contractor contacts web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHomes card
       ├── Search tab (existing)
       ├── Saved tab (existing)
       ├── Properties tab (existing)
       │    └── Property Detail
       │         ├── Maintenance section (existing)
       │         ├── Documents section (existing)
       │         ├── Inventory section (existing, if built)
       │         └── Contractors section ← NEW (YOU ARE HERE)
       │              ├── Contractor cards sorted by specialty
       │              ├── Favorites pinned at top
       │              └── "Add Contractor" button
       └── Reminders tab (existing)
            └── Reminder Detail
                 └── "Call Contractor" action ← NEW LINK
```

Contractor contacts are accessible from:
1. Property detail screen's "Contractors" section (primary entry point)
2. A reminder detail screen's "Call Contractor" button (shows contractors matching the task specialty)
3. A general contractor list accessible from the Properties tab header (cross-property view)

### Data Model

```sql
-- New table: hm_contractors
CREATE TABLE IF NOT EXISTS hm_contractors (
    id TEXT PRIMARY KEY,
    property_id TEXT REFERENCES hm_properties(id) ON DELETE SET NULL,  -- nullable: null = general contractor (not property-specific)
    name TEXT NOT NULL,
    company TEXT,
    specialty TEXT NOT NULL DEFAULT 'general',        -- plumbing, electrical, hvac, roofing, painting, landscaping, cleaning, pest_control, general, other
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    rating INTEGER,                                   -- 1-5 star rating, nullable
    notes TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: hm_contractor_services (service history log)
CREATE TABLE IF NOT EXISTS hm_contractor_services (
    id TEXT PRIMARY KEY,
    contractor_id TEXT NOT NULL REFERENCES hm_contractors(id) ON DELETE CASCADE,
    schedule_id TEXT REFERENCES hm_maintenance_schedules(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    service_date TEXT NOT NULL,                        -- ISO date string
    cost_cents INTEGER,                               -- nullable, what they charged
    rating INTEGER,                                   -- 1-5 rating for this specific service, nullable
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS hm_contractors_property_idx
    ON hm_contractors(property_id);
CREATE INDEX IF NOT EXISTS hm_contractors_specialty_idx
    ON hm_contractors(specialty);
CREATE INDEX IF NOT EXISTS hm_contractors_favorite_idx
    ON hm_contractors(is_favorite DESC);
CREATE INDEX IF NOT EXISTS hm_services_contractor_idx
    ON hm_contractor_services(contractor_id);
CREATE INDEX IF NOT EXISTS hm_services_schedule_idx
    ON hm_contractor_services(schedule_id);
CREATE INDEX IF NOT EXISTS hm_services_date_idx
    ON hm_contractor_services(service_date DESC);
```

**specialty enum values:** `plumbing`, `electrical`, `hvac`, `roofing`, `painting`, `landscaping`, `cleaning`, `pest_control`, `general`, `other`

**Specialty-to-TaskType mapping:** The contractor engine maps specialties to maintenance task types so the reminder detail screen can suggest relevant contractors:
- `hvac` -> `hvac_filter`, `hvac_service`
- `roofing` -> `roof_inspection`
- `pest_control` -> `pest_control`
- `cleaning` -> `gutter_cleaning`, `window_cleaning`, `dryer_vent`
- `plumbing` -> `water_heater_flush`, `plumbing_inspection`
- `painting` -> `exterior_paint`
- `landscaping` -> `lawn_mower_service`
- `general` -> matches all task types

**property_id:** Nullable. A contractor with property_id = NULL is a "general" contractor available across all properties. A contractor with a specific property_id is property-specific (e.g., the local plumber near that property). ON DELETE SET NULL means deleting a property converts a property-specific contractor to a general one (preserving the contact).

**rating on contractors:** Overall satisfaction rating (1-5 stars), set by the user. Nullable (user may not have rated them yet).

**rating on services:** Per-service rating (1-5 stars). Nullable. Allows tracking whether a contractor's quality has changed over time.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type)
- **External:** `expo-linking` (phone calls and email on mobile), `zod` (schema validation). No external APIs required.
- **Cross-Module:** None. This is a self-contained contacts feature within the homes module. Potential future integration with a cross-module contacts/CRM system is deferred.

## Functional Requirements

### User Stories
1. As a homeowner, I want to save my trusted contractor's contact info (name, phone, email, specialty), so I can reach them quickly when I need service.
2. As a homeowner, I want to rate my contractors (1-5 stars), so I can remember who did good work and who to avoid.
3. As a homeowner, I want to mark contractors as favorites, so my go-to service providers are always at the top of the list.
4. As a homeowner, I want to log service history for each contractor (date, description, cost, rating), so I have a record of all work they've done.
5. As a homeowner, I want the app to suggest relevant contractors when a maintenance reminder is due, so I can call the right person with one tap.
6. As a multi-property owner, I want some contractors linked to specific properties and others available across all properties, so my local plumber near one house doesn't clutter the list for another.
7. As a homeowner, I want to call or email a contractor directly from their detail page, so I don't have to copy-paste contact info.

### Behavior Specification

**Adding a contractor:**
1. User navigates to Property Detail > Contractors section.
2. User taps "Add Contractor".
3. Form shows: name (required), company (optional), specialty selector (plumbing/electrical/hvac/roofing/painting/landscaping/cleaning/pest_control/general/other), phone (optional), email (optional), website (optional), address (optional), rating (1-5 stars, optional), notes (optional), property assignment toggle (This Property Only / All Properties).
4. If "This Property Only": property_id is set to the current property's ID.
5. If "All Properties": property_id is set to NULL.
6. User taps Save. Contractor record is created.

**Viewing contractors for a property:**
1. User navigates to Property Detail > Contractors section.
2. Contractors displayed as a list, grouped by specialty.
3. Favorites are pinned at the top, regardless of specialty, marked with a star icon.
4. Each contractor card shows: name (bold), company (if set), specialty badge, rating stars (if rated), favorite star icon (if favorited).
5. Both property-specific contractors (property_id = this property) and general contractors (property_id = NULL) are shown. General contractors have a "General" label to distinguish them.

**Viewing contractor detail:**
1. User taps a contractor card.
2. Detail screen shows: name, company, specialty badge, rating stars, favorite toggle, contact buttons (Call, Email, Website -- each only shown if the field is set), address, notes.
3. Below contact info: "Service History" section listing all logged services for this contractor, sorted by date descending.
4. Each service entry shows: date, description, cost (if logged), per-service rating (if set).
5. "Add Service" button at the bottom of the service history section.
6. "Edit" and "Delete" buttons for the contractor.

**Toggling favorite:**
1. User taps the star icon on a contractor card or the favorite toggle on the detail screen.
2. is_favorite toggles between 0 and 1.
3. The card moves to/from the favorites section immediately.

**Logging a service:**
1. From contractor detail, user taps "Add Service".
2. Form shows: description (required), service date (required, defaults to today), cost (optional, numeric), link to schedule (optional dropdown of maintenance schedules), rating for this service (1-5 stars, optional), notes (optional).
3. User taps Save. Service record is created linked to this contractor.

**Calling/emailing from detail:**
1. User taps "Call" button on contractor detail.
2. System opens the phone dialer with the contractor's phone number pre-filled (via `expo-linking` tel: URL on mobile, tel: link on web).
3. User taps "Email" button. System opens the default email client with the contractor's email pre-filled (mailto: URL).
4. User taps "Website" button. System opens the URL in the default browser.

**Contractor suggestion from reminder detail:**
1. When viewing a maintenance reminder detail (e.g., HVAC Service due), a "Contractors" section appears below the action buttons.
2. The system maps the reminder's task_type to a contractor specialty (e.g., hvac_service -> hvac specialty).
3. Matching contractors are shown (filtered by specialty + relevant to this property or general).
4. If no matching contractors exist: "No contractors saved for this specialty. Add one?" with a CTA button.
5. Tapping a contractor card opens the contractor detail.
6. A "Call" quick-action button is shown inline for each contractor.

**Cross-property contractor view:**
1. Accessible from the Properties tab header via a "Contractors" icon/button.
2. Shows all contractors across all properties + general contractors.
3. Grouped by specialty. Favorites pinned at top.
4. Each card includes the property name (or "General") for context.

### Edge Cases

- **No properties exist:** Contractors section is unreachable (nested under property detail). Cross-property view shows only general contractors (if any).
- **Property with no contractors:** Contractors section shows empty state "No contractors saved" with "Add Contractor" CTA.
- **Contractor with no phone, email, or website:** Contact buttons are hidden. Card shows name, specialty, and rating only. At least one contact method is recommended but not required (validated in the UI with a soft warning, not a hard error).
- **Deleting a property:** Property-specific contractors have property_id set to NULL (ON DELETE SET NULL). They become general contractors. Confirmation dialog notes: "Contractors linked to this property will be kept as general contacts."
- **Deleting a contractor:** CASCADE deletes all service history records. Confirmation: "Delete this contractor and their service history? This cannot be undone."
- **Contractor with service history linked to a deleted schedule:** Service record preserved with schedule_id set to NULL. The description and cost still show correctly.
- **Very long service history (50+ entries):** Paginate with "Load More" (10 entries at a time).
- **Duplicate contractor name:** Allowed. Users may have two "John's Plumbing" entries (different branches or different Johns).
- **Rating of 0 or out of range:** Zod validation restricts rating to integer 1-5. NULL is allowed (not yet rated). 0 is not a valid rating.
- **Specialty "other" with no further description:** Allowed but encouraged to add details in the notes field. No validation on notes for "other" specialty.
- **Phone number formatting:** Stored as raw text. No formatting validation. Displayed as entered. The tel: URL scheme handles dialing regardless of format.
- **Email validation:** Basic format check via Zod (z.string().email()). No domain verification.
- **Module disabled mid-use:** Data preserved. Re-enabling restores all contractors and service history.
- **Contractor used across many properties:** A general contractor (property_id = NULL) appears in every property's contractor list. This is intentional.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Adding a contractor with name "Mike's HVAC", specialty "hvac", phone "555-1234", and rating 4 stars saves correctly and appears in the Contractors section.
- [ ] **AC-2:** A contractor saved as "This Property Only" appears only for that property's Contractors section (not in other properties).
- [ ] **AC-3:** A contractor saved as "All Properties" appears in every property's Contractors section with a "General" label.
- [ ] **AC-4:** Toggling a contractor as favorite pins their card to the top of the list with a star icon.
- [ ] **AC-5:** Un-favoriting a contractor moves their card back to the specialty group.
- [ ] **AC-6:** Tapping a contractor card opens the detail view showing all contact info, rating, and service history.
- [ ] **AC-7:** Tapping "Call" opens the phone dialer with the contractor's number. Tapping "Email" opens the email client. Tapping "Website" opens the browser.
- [ ] **AC-8:** Adding a service entry with description "Annual HVAC tune-up", date today, cost $180, and rating 5 stars creates a record visible in the service history.
- [ ] **AC-9:** Service history entries are sorted by date descending (newest first).
- [ ] **AC-10:** Editing a contractor's name, phone, or rating saves correctly and reflects immediately.
- [ ] **AC-11:** Deleting a contractor removes the card and all associated service history. Confirmation dialog shown first.
- [ ] **AC-12:** On a maintenance reminder detail (e.g., HVAC Service), relevant contractors (hvac specialty) are shown in a "Contractors" section.
- [ ] **AC-13:** If no matching contractors exist for a reminder's specialty, a CTA "No contractors saved for this specialty. Add one?" appears.
- [ ] **AC-14:** The cross-property contractor view (from Properties tab header) shows all contractors grouped by specialty with property context labels.
- [ ] **AC-15:** Linking a service entry to a maintenance schedule shows the schedule name on the service record.

### Technical Criteria
- [ ] **TC-1:** Schema migration creates hm_contractors and hm_contractor_services tables with all columns, indexes, and correct hm_ prefix.
- [ ] **TC-2:** `getContractorsBySpecialty(db, specialty, propertyId)` returns contractors matching the specialty that are either property-specific or general.
- [ ] **TC-3:** `getContractorForSchedule(db, taskType, propertyId)` maps the task type to a specialty and returns matching contractors.
- [ ] **TC-4:** `getServiceHistory(db, contractorId)` returns all service records for the contractor sorted by service_date DESC.
- [ ] **TC-5:** `getFavoriteContractors(db, propertyId)` returns contractors with is_favorite = 1 for the given property or general.
- [ ] **TC-6:** `getContractorStats(db, contractorId)` returns total services, average rating (from service ratings), total spend, and last service date.
- [ ] **TC-7:** Zod validation requires name (min 1) and specialty from the allowed enum values.
- [ ] **TC-8:** Zod validation restricts rating to integer 1-5 or null.
- [ ] **TC-9:** Zod validation validates email format when email is provided (not null).
- [ ] **TC-10:** Deleting a property SET NULLs the property_id on associated contractors (contractors preserved as general).
- [ ] **TC-11:** Deleting a contractor CASCADE-deletes all service history records.
- [ ] **TC-12:** Deleting a schedule SET NULLs the schedule_id on linked service records (services preserved).
- [ ] **TC-13:** Contractor and service CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-14:** The specialty-to-task-type mapping correctly resolves for all 15 task types.
- [ ] **TC-15:** `getContractorsBySpecialty` returns both property-specific and general contractors (property_id = NULL).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Contractor data must NOT be uploaded to any server. All storage is on-device.
- [ ] **NC-2:** This feature must NOT include contractor discovery, marketplace, or lead generation functionality.
- [ ] **NC-3:** Adding or editing contractors must NOT affect hm_properties, hm_maintenance_schedules, or hm_listings records.
- [ ] **NC-4:** Deleting a property must NOT delete contractors. They must be preserved as general contacts (property_id set to NULL).
- [ ] **NC-5:** Phone numbers must NOT be auto-formatted or validated beyond basic presence check. Users enter numbers in their preferred format.

## UI Specification

### Mobile (Expo)

**Contractors Section (within Property Detail):**
- Background: `#0A0A0F` (background token)
- Section header: "Contractors" with count badge, amber accent `#D97706`
- Favorites section (if any): pinned at top, each card has a filled star icon in `#D97706`
- Specialty groups: group header text in `rgba(240,240,245,0.65)` (textSecondary), e.g., "HVAC", "Plumbing"
- Contractor cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
  - Card layout: First letter avatar circle (left, `#D97706` background, white text) | Name + company (center, text + textSecondary) | Rating stars (right, filled stars in `#D97706`, empty in textSecondary) | Favorite star icon (top-right corner)
  - "General" label in `rgba(240,240,245,0.65)` for non-property-specific contractors
- "Add Contractor" button: accent color outline, glass background

**Add/Edit Contractor Form:**
- Background: `#0A0A0F`
- Form fields: glass-bordered input fields
- Specialty selector: horizontal chip row, selected chip uses `#D97706` fill
- Rating input: 5 tappable star icons, filled in `#D97706` for selected rating
- Property assignment toggle: "This Property Only" / "All Properties" segmented control
- Contact fields: phone (phone keyboard type), email (email keyboard type), website (URL keyboard type), address (text)
- Save button: full-width, `#D97706` background, white text

**Contractor Detail:**
- Background: `#0A0A0F`
- Header: large first-letter avatar, name (24pt), company (textSecondary), specialty badge (amber background, white text)
- Rating: 5 stars displayed prominently, tappable to update
- Favorite toggle: star button next to name
- Contact action buttons: horizontal row of glass cards
  - "Call" (phone icon, green accent `#30D158`), shown only if phone is set
  - "Email" (mail icon, blue accent), shown only if email is set
  - "Website" (globe icon, amber accent), shown only if website is set
- Address section (if set): glass card with map pin icon
- Notes section (if set): glass card with text
- Service History section:
  - Header: "Service History" with count
  - Service cards: glass token fill, sorted by date DESC
  - Card layout: Date (left, textSecondary) | Description (center, text) | Cost (right, text token, bold, if set) | Rating stars (if set, small, below description)
  - "Add Service" button at bottom of history
- "Edit" and "Delete" buttons at the very bottom

**Reminder Detail Integration:**
- Below existing action buttons on the reminder detail screen:
- "Contractors" section header with specialty-filtered results
- Contractor mini-cards: name + company, rating stars, "Call" quick-action button (phone icon)
- If no matches: "No contractors saved for [specialty]. Add one?" text with CTA button

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Contractors accessible at `/homes/contractors` route (cross-property) and `/homes/properties/[id]/contractors` (per-property)
- Layout: sidebar navigation (existing), main content area
- Contractor list as a table with sortable columns (name, company, specialty, rating, property)
- Contractor detail opens as a side panel
- Contact action links inline in the table row (phone, email, website as clickable links)
- Service history displayed in the detail side panel
- "Add Contractor" and "Add Service" buttons in header/panel
- Rating displayed as star icons, clickable to update inline

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton contractor cards (3) with pulsing animation | Initial data fetch from SQLite |
| Empty | Centered contacts icon, "No contractors saved" + "Add Contractor" CTA button | No contractor records for this property |
| Error | "Something went wrong loading contractors" + retry button | SQLite read failure |
| Success | Contractor cards grouped by specialty, favorites pinned at top | Data loaded |
| Success (from reminder) | Specialty-filtered contractor cards with call buttons | Viewing reminder detail |
| Empty (from reminder) | "No contractors saved for [specialty]. Add one?" | No contractors match the task specialty |

## Test Requirements

### Unit Tests (modules/homes/src/__tests__/contractor-engine.test.ts)
- [ ] `getContractorsBySpecialty`: returns contractors matching specialty for a property
- [ ] `getContractorsBySpecialty`: includes general contractors (property_id = NULL) in results
- [ ] `getContractorsBySpecialty`: returns empty array when no contractors match
- [ ] `getContractorForSchedule`: maps hvac_service task type to hvac specialty correctly
- [ ] `getContractorForSchedule`: maps gutter_cleaning to cleaning specialty correctly
- [ ] `getContractorForSchedule`: maps water_heater_flush to plumbing specialty correctly
- [ ] `getContractorForSchedule`: returns general-specialty contractors as fallback when no exact match
- [ ] `getContractorForSchedule`: returns empty array when no contractors match any mapping
- [ ] `getServiceHistory`: returns services sorted by service_date DESC
- [ ] `getServiceHistory`: returns empty array when no services logged
- [ ] `getFavoriteContractors`: returns only contractors with is_favorite = 1
- [ ] `getFavoriteContractors`: includes both property-specific and general favorites
- [ ] `getContractorStats`: returns correct total services count
- [ ] `getContractorStats`: returns correct average rating from service ratings
- [ ] `getContractorStats`: returns correct total spend (sum of cost_cents from services)
- [ ] `getContractorStats`: returns null average rating when no services are rated
- [ ] `getContractorStats`: returns last service date
- [ ] `specialtyToTaskTypes`: maps all 10 specialties to their expected task types
- [ ] Zod validation: accepts valid ContractorSchema with required fields
- [ ] Zod validation: rejects contractor with empty name
- [ ] Zod validation: rejects contractor with invalid specialty
- [ ] Zod validation: rejects contractor with rating = 0
- [ ] Zod validation: rejects contractor with rating = 6
- [ ] Zod validation: accepts contractor with rating = null (not yet rated)
- [ ] Zod validation: validates email format when email is provided
- [ ] Zod validation: accepts contractor with null phone, email, website (all optional)
- [ ] Zod validation: accepts valid ContractorServiceSchema with required fields
- [ ] Zod validation: rejects service with empty description
- [ ] Zod validation: accepts service with null cost_cents and null rating

### Integration Tests
- [ ] Full flow: create contractor (property-specific), verify it appears for that property but not others
- [ ] Full flow: create general contractor (property_id = NULL), verify it appears for all properties
- [ ] Full flow: toggle favorite, verify contractor moves to favorites section
- [ ] Full flow: add 3 service entries for a contractor, verify getServiceHistory returns them in date DESC order
- [ ] Full flow: log service with cost and rating, verify getContractorStats reflects correctly
- [ ] Full flow: delete contractor, verify all service history CASCADE-deleted
- [ ] Full flow: delete property, verify property-specific contractors have property_id set to NULL (preserved as general)
- [ ] Full flow: view reminder detail for HVAC task, verify hvac-specialty contractors shown
- [ ] Full flow: delete schedule linked to a service, verify service preserved with schedule_id = NULL
- [ ] Error flow: create contractor with invalid data (empty name), validation error, no record persisted

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyHomes > Properties tab. Select an existing property. Scroll to "Contractors" section. -- Setup.
3. Verify empty state with "No contractors saved" and "Add Contractor" CTA. -- Verifies empty state.
4. Tap "Add Contractor". Fill in: name "Mike Johnson", company "Mike's HVAC", specialty "hvac", phone "555-123-4567", email "mike@mikeshvac.com", rating 4 stars, assignment "This Property Only". Save. -- Corresponds to AC-1.
5. Verify contractor card appears with name, company, "hvac" badge, and 4 stars. -- Corresponds to AC-1.
6. Add a second contractor: name "Lisa's Plumbing", specialty "plumbing", phone "555-987-6543", assignment "All Properties". Save. -- General contractor.
7. Verify "Lisa's Plumbing" shows a "General" label on the card. -- Corresponds to AC-3.
8. Navigate to a different property's Contractors section. Verify "Lisa's Plumbing" appears but "Mike's HVAC" does not. -- Corresponds to AC-2, AC-3.
9. Return to the first property. Tap the star icon on "Mike's HVAC" card. Verify it pins to the top with a filled star. -- Corresponds to AC-4.
10. Tap the star icon again. Verify it un-favorites and moves back to the HVAC group. -- Corresponds to AC-5.
11. Tap "Mike's HVAC" card. Verify detail view with contact info, rating, and empty service history. -- Corresponds to AC-6.
12. Tap "Call". Verify phone dialer opens with 555-123-4567. -- Corresponds to AC-7.
13. Tap "Email". Verify email client opens with mike@mikeshvac.com. -- Corresponds to AC-7.
14. Tap "Add Service". Fill in: description "Annual HVAC tune-up", date today, cost $180, rating 5 stars. Save. -- Corresponds to AC-8.
15. Verify service entry appears in the history section with date, description, $180, and 5 stars. -- Corresponds to AC-8.
16. Add a second service: "Emergency repair", date 3 months ago, cost $450, rating 3 stars. Verify sorted by date (today's first). -- Corresponds to AC-9.
17. Go back to contractor detail. Tap "Edit". Change phone to "555-111-2222". Save. Verify updated. -- Corresponds to AC-10.
18. Navigate to Reminders tab. Open an HVAC-related reminder (e.g., "HVAC Service"). Verify "Contractors" section shows "Mike's HVAC" with a "Call" quick-action. -- Corresponds to AC-12.
19. Open a plumbing-related reminder. Verify "Lisa's Plumbing" appears. -- Corresponds to AC-12.
20. Open a roofing reminder. Verify "No contractors saved for roofing. Add one?" appears. -- Corresponds to AC-13.
21. Go to Properties tab header. Tap "Contractors" icon for cross-property view. Verify both Mike and Lisa appear with property context labels. -- Corresponds to AC-14.
22. Return to Mike's detail. Add a service linked to the HVAC maintenance schedule. Verify schedule name appears on the service entry. -- Corresponds to AC-15.
23. Delete "Lisa's Plumbing". Confirm. Verify she is removed along with any service history. -- Corresponds to AC-11.
24. Delete the property. Verify "Mike's HVAC" still exists but is now a general contractor (property_id = NULL). -- Corresponds to TC-10, NC-4.
25. Repeat key steps (4-7, 11-14, 17-18) on web at `/homes/contractors`. Verify functional parity. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to a property's Contractors section and the reminder detail integration, click every button, verify all 5 states (loading, empty, error, success, success-from-reminder)
- [ ] Batch QA: after 5 features in homes module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `contractor-engine.ts` (getContractorsBySpecialty, getContractorForSchedule, getServiceHistory, getFavoriteContractors, getContractorStats, specialtyToTaskTypes)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- homes module has active standalone counterpart (MyHomes)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Homes module has tables for listings, tours, properties, maintenance schedules, settings, and possibly documents, cost entries, rooms, and inventory items (from earlier sprints)
- Maintenance reminders are functional but have no way to link to service providers
- Users must manually look up contractor info when a task is due

### After This Work
- Homes module gains 2 new tables (hm_contractors, hm_contractor_services) with 6 new indexes
- Schema version incremented by 1
- Property detail screen gains a "Contractors" section with specialty-grouped contacts, favorites, and service history
- Maintenance reminder detail gains a "Contractors" section showing specialty-matched contractors with call quick-actions
- Cross-property contractor view accessible from the Properties tab header
- Full contractor lifecycle: add contacts, rate, favorite, log service history, link services to schedules, call/email/visit website directly
- `contractor-engine.ts` contains pure functions for specialty filtering, task-type mapping, service history queries, favorite management, and contractor statistics

### Files Changed

- `modules/homes/src/types.ts` -- Add ContractorSpecialtySchema, ContractorSchema, ContractorServiceSchema Zod schemas and types
- `modules/homes/src/db/schema.ts` -- Add CREATE_CONTRACTORS, CREATE_CONTRACTOR_SERVICES tables, 6 indexes
- `modules/homes/src/db/crud.ts` -- Add contractor CRUD (create, get, getByProperty, getBySpecialty, toggleFavorite, update, delete), service CRUD (create, get, getByContractor, delete)
- `modules/homes/src/engines/contractor-engine.ts` -- NEW: getContractorsBySpecialty, getContractorForSchedule, getServiceHistory, getFavoriteContractors, getContractorStats, specialtyToTaskTypes
- `modules/homes/src/definition.ts` -- Add migration for new tables, update schemaVersion
- `modules/homes/src/index.ts` -- Re-export new types and engine functions
- `modules/homes/src/__tests__/contractor-engine.test.ts` -- NEW: 29+ unit tests for contractor engine
- `apps/mobile/app/(homes)/contractors.tsx` -- NEW: Contractor list screen
- `apps/mobile/app/(homes)/add-contractor.tsx` -- NEW: Add/Edit contractor form
- `apps/mobile/app/(homes)/contractor-detail.tsx` -- NEW: Contractor detail with service history
- `apps/mobile/app/(homes)/reminder-detail.tsx` -- MODIFIED: Add "Contractors" section with specialty-filtered results
- `apps/web/app/homes/contractors/page.tsx` -- NEW: Contractor contacts web page

### Known Limitations
- No contractor discovery or marketplace. This is purely a personal address book. Users must find contractors on their own.
- No photo/logo for contractors. Text-only profiles with first-letter avatars.
- No appointment scheduling or calendar integration. Users call/email contractors manually.
- No SMS/text messaging from the app. Only phone calls and email.
- Phone number display is as-entered (no auto-formatting or normalization).
- Service cost is a simple integer (cents). No invoice attachment or detailed cost breakdown.
- The specialty-to-task-type mapping is hard-coded. Custom task types (task_type = "custom") are not mapped to any specialty. Users must manually navigate to the contractor they want.
- No merge/dedup for contractors entered under different names for the same person/company.
- No import from phone contacts. Contractors are entered manually.

### Context for Next Agent
- The contractor engine should follow the same pure-function pattern as other homes engines. Functions take a DatabaseAdapter and return typed results.
- The `specialtyToTaskTypes` mapping is a critical piece. It is a static Map<ContractorSpecialty, TaskType[]> that the `getContractorForSchedule` function uses to find relevant contractors for a given maintenance task. The "general" specialty maps to all task types as a fallback.
- The `property_id` on contractors uses ON DELETE SET NULL (not CASCADE). This is different from other homes tables which use CASCADE. The rationale is that contractor relationships transcend properties -- if you sell a house, you still want to keep your trusted contractor info. Deleting a property converts property-specific contractors to general ones.
- The reminder detail integration requires modifying an existing screen (reminder-detail.tsx). Add a "Contractors" section below the action buttons. This is the only existing file modification. Everything else is new files.
- Contact action buttons use `expo-linking` on mobile: `Linking.openURL('tel:${phone}')` and `Linking.openURL('mailto:${email}')`. On web, use standard `<a href="tel:...">` and `<a href="mailto:...">` links.
- The first-letter avatar circle is a common pattern in the codebase. Generate it from the contractor's name: `name.charAt(0).toUpperCase()`, displayed in a circle with `#D97706` background and white text.
- Service ratings (per-service) are independent from the overall contractor rating. The overall rating is set manually by the user. A future enhancement could auto-calculate it as the average of service ratings, but for MVP they are independent.
