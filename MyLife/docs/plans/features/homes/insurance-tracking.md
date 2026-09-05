# Feature Spec: Insurance Policy Tracking

## Metadata
- **Module:** homes
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [2] x3 + Complexity [4] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 9
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Document storage (B-tier) for linking uploaded policy documents
- **Blocks:** none

## Business Context

### Why This Feature Exists
Homeowners and renters juggle multiple insurance policies (homeowners, flood, earthquake, umbrella) across multiple properties, often losing track of renewal dates, coverage gaps, and premium costs. A missed renewal can leave a property uninsured for days or weeks. Coverage gaps (e.g., no flood insurance in a flood zone, no earthquake coverage in California) expose owners to catastrophic loss. Tracking policies inside the same app that already manages maintenance reminders and property records creates a single source of truth for homeownership, reducing the need for a separate insurance binder or spreadsheet.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| HomeZada | Yes | Yes ($59-99/yr) | Full policy tracking with document uploads, renewal reminders, coverage summaries, claim history |
| Centriq | No | N/A | Appliance-focused; no insurance tracking |
| Thumbtack | No | N/A | Contractor marketplace only |
| Angi | No | N/A | Contractor marketplace only |
| Notion / Spreadsheet | DIY | No | Manual tracking with no automation, no renewal alerts, no gap analysis |

### Target User
Homeowners (28-65) managing 1-3 properties who currently track insurance in a filing cabinet, email archive, or spreadsheet. Multi-property owners who need a unified view of all active policies, total annual premium costs, and upcoming renewals across properties. Renters with renter's insurance who want a simple way to remember their renewal date and coverage details. Users of HomeZada ($59-99/yr) who want the same capability bundled into their MyLife subscription without a separate app.

## Technical Context

### Where This Lives in MyLife

```
modules/homes/src/
  types.ts                                  -- New Zod schemas: InsurancePolicy, PolicyType, PolicyInput
  db/schema.ts                              -- New table: hm_insurance_policies + indexes
  db/insurance.ts                           -- NEW: insurance policy CRUD operations
  db/index.ts                               -- Re-export insurance CRUD
  engines/insurance-engine.ts               -- NEW: policy analysis, renewal calendar, coverage gaps
  engines/index.ts                          -- Re-export insurance engine functions
  definition.ts                             -- Migration v3 for new table
  index.ts                                  -- Re-export new types and engine functions
  __tests__/insurance-engine.test.ts        -- NEW: unit tests for insurance engine

apps/mobile/app/(homes)/
  insurance.tsx                             -- NEW: Insurance overview screen (per-property + cross-property)
  insurance-detail.tsx                      -- NEW: Policy detail view
  add-insurance.tsx                         -- NEW: Add/Edit insurance policy form

apps/web/app/homes/
  insurance/page.tsx                        -- NEW: Insurance overview web page
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
            └── Insurance section ← NEW (YOU ARE HERE)
                 ├── Policy cards per property
                 └── "Add Policy" button
```

Insurance is accessed from:
1. Property detail screen's new "Insurance" section (primary entry point)
2. A dedicated "Insurance" screen accessible from the Properties tab overflow menu
3. Push notification tap for renewal reminders (deep links to policy detail)

### Data Model

```sql
-- New table: hm_insurance_policies (Migration v3)
CREATE TABLE IF NOT EXISTS hm_insurance_policies (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    policy_type TEXT NOT NULL DEFAULT 'homeowners',
    coverage_amount_cents INTEGER NOT NULL DEFAULT 0,
    deductible_cents INTEGER NOT NULL DEFAULT 0,
    annual_premium_cents INTEGER NOT NULL DEFAULT 0,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    auto_renew INTEGER NOT NULL DEFAULT 0,
    document_id TEXT,
    agent_name TEXT,
    agent_phone TEXT,
    agent_email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS hm_insurance_property_idx
    ON hm_insurance_policies(property_id);
CREATE INDEX IF NOT EXISTS hm_insurance_end_date_idx
    ON hm_insurance_policies(end_date ASC);
CREATE INDEX IF NOT EXISTS hm_insurance_type_idx
    ON hm_insurance_policies(policy_type);
```

**policy_type enum values:** `homeowners`, `renters`, `flood`, `earthquake`, `umbrella`, `other`

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for schema v3)
- **External:** `zod` (schema validation). No external APIs required.
- **Cross-Module:** Future integration with MyBudget for premium cost categorization (deferred). Future integration with Document storage for linking uploaded policy PDFs (document_id FK is nullable until that feature ships).

## Functional Requirements

### User Stories
1. As a homeowner, I want to store all my insurance policy details (provider, policy number, coverage, deductible, premium) in one place, so I can quickly reference them during claims or renewals.
2. As a multi-property owner, I want to see total annual premium costs across all properties, so I can budget for insurance expenses and shop for better rates.
3. As a homeowner in a flood zone, I want the app to flag that I have no flood insurance policy, so I can address coverage gaps before a disaster.
4. As a user approaching a renewal date, I want to receive a reminder 30 days before my policy expires, so I have time to review and renew or switch providers.
5. As a renter, I want to track my renter's insurance policy with its renewal date and coverage amount, so I never accidentally let it lapse.
6. As a homeowner filing a claim, I want to quickly find my agent's contact information and policy number from the app, so I can call without digging through paperwork.

### Behavior Specification

**Adding an insurance policy:**
1. User navigates to a Property detail screen.
2. User scrolls to the "Insurance" section.
3. User taps "Add Policy".
4. Form shows: provider (text, required), policy number (text, required), policy type selector (homeowners/renters/flood/earthquake/umbrella/other), coverage amount (currency input), deductible (currency input), annual premium (currency input), start date (date picker, required), end date (date picker, required), auto-renew toggle, agent name (text), agent phone (phone input), agent email (email input), notes (text area).
5. User saves. The policy record is created and linked to the property.
6. If the policy end_date is within 30 days, a renewal reminder is scheduled.

**Viewing insurance overview:**
1. User navigates to Property detail > Insurance section.
2. Active policies are shown as cards, sorted by end_date (soonest first).
3. Each card shows: provider name, policy type badge, coverage amount, annual premium, days until renewal (or "Expired" badge if past end_date).
4. Summary bar at top: total annual premium across all policies for this property, number of active policies.
5. If no policies exist, empty state shows "No insurance policies tracked" with "Add Policy" CTA.

**Cross-property insurance view:**
1. From Properties tab, user taps overflow menu > "Insurance Overview".
2. Screen shows all policies across all properties, grouped by property.
3. Summary bar: total annual premium across all properties, count of expiring soon, count of expired.

**Renewal reminders:**
1. When a policy is created or updated, the engine checks if end_date is within 30 days.
2. If within 30 days and auto_renew is false: status = "expiring_soon".
3. If past end_date: status = "expired".
4. If auto_renew is true and within 30 days: status = "renewing_soon" (informational, not urgent).
5. Reminder integration: expiring policies surface on the existing Reminders tab alongside maintenance reminders, using a distinct insurance icon.

**Coverage gap analysis:**
1. Engine function `checkCoverageGaps` inspects active policies for a property.
2. Basic gap detection:
   - Property type is "house" but no "homeowners" policy exists: gap flagged.
   - Property ownership is "rent" but no "renters" policy exists: gap flagged.
   - Property is in a state with high flood risk (user-declared, not geo-lookup) but no "flood" policy: gap flagged if user has marked the property as flood-zone.
   - No "umbrella" policy and total property value exceeds $500k (coverage_amount_cents sum): suggestion (not a gap warning).
3. Gaps display as amber warning cards at the top of the Insurance section.
4. Gap detection is advisory only with no external API calls, keeping it privacy-first.

**Policy detail view:**
1. User taps a policy card.
2. Detail screen shows all fields: provider, policy number, type, coverage, deductible, premium, dates, auto-renew status, agent contact info, notes, document link (if attached).
3. Action buttons: "Edit Policy", "Delete Policy", "Call Agent" (opens phone dialer), "Email Agent" (opens email composer).

### Edge Cases

- **No properties exist:** Insurance section is not visible. User must add a property first.
- **Property with no policies:** Insurance section shows empty state with "Add Policy" button.
- **Expired policy:** Show "Expired" badge in red. Policy remains in the list but sorted below active policies.
- **Auto-renew policy near expiry:** Show "Renewing Soon" in green instead of amber "Expiring Soon".
- **Multiple policies of the same type:** Allowed. User may have overlapping flood insurance during a policy switch. No duplicate warning.
- **Coverage amount of zero:** Allowed (user may not know the exact amount). Show "Not specified" instead of "$0".
- **End date before start date:** Rejected by Zod validation.
- **Document link without document storage feature:** document_id field is nullable. If document storage is not yet built, the "Attach Document" button is hidden. The field exists for forward compatibility.
- **Property deleted with policies:** CASCADE delete removes all associated policies.
- **Very old expired policies:** Shown in a collapsed "Past Policies" section to avoid clutter. Threshold: expired more than 1 year ago.
- **User navigates away mid-form:** Unsaved changes are discarded. No draft persistence.
- **Annual premium of $0:** Allowed for employer-provided or bundled insurance. Excluded from cost summary totals.
- **Agent contact fields all empty:** Allowed. "Contact Agent" section hidden when no contact info exists.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Adding a new insurance policy with all required fields (provider, policy number, start date, end date) saves successfully and appears on the property detail Insurance section.
- [ ] **AC-2:** The Insurance section shows policy cards sorted by end_date (soonest first), with active policies before expired ones.
- [ ] **AC-3:** Each policy card displays provider name, policy type badge, coverage amount, annual premium, and days until renewal.
- [ ] **AC-4:** Tapping a policy card opens the detail view with all fields and action buttons.
- [ ] **AC-5:** The summary bar shows total annual premium and active policy count for the current property.
- [ ] **AC-6:** Cross-property insurance overview groups policies by property with a global summary bar.
- [ ] **AC-7:** Policies expiring within 30 days (auto_renew = false) show amber "Expiring Soon" badges.
- [ ] **AC-8:** Expired policies show red "Expired" badges and sort below active policies.
- [ ] **AC-9:** Auto-renew policies expiring within 30 days show green "Renewing Soon" badges.
- [ ] **AC-10:** Coverage gap warnings appear as amber cards when a homeowner has no homeowners policy, or a renter has no renters policy.
- [ ] **AC-11:** Editing a policy updates all fields and recalculates renewal status.
- [ ] **AC-12:** Deleting a policy removes it from the list and updates the premium summary.
- [ ] **AC-13:** "Call Agent" button opens the phone dialer with the agent's phone number.
- [ ] **AC-14:** "Email Agent" button opens the email composer with the agent's email.
- [ ] **AC-15:** Empty state shows "No insurance policies tracked" with "Add Policy" CTA when a property has no policies.

### Technical Criteria
- [ ] **TC-1:** Schema migration v3 creates hm_insurance_policies table with all columns, 3 indexes, and correct hm_ prefix.
- [ ] **TC-2:** `getActivePolicies(propertyId)` returns only policies where end_date >= today, sorted by end_date ASC.
- [ ] **TC-3:** `getExpiringPolicies(days)` returns policies expiring within N days across all properties, excluding auto-renew.
- [ ] **TC-4:** `getPolicyCostSummary(propertyId)` returns total annual premium, count of active policies, and average deductible for a single property.
- [ ] **TC-5:** `getPolicyCostSummary()` (no property ID) returns the cross-property total.
- [ ] **TC-6:** `checkCoverageGaps(propertyId)` returns gap entries for missing homeowners/renters policies based on ownership type.
- [ ] **TC-7:** `getRenewalCalendar(days)` returns a date-sorted list of upcoming renewals within N days, including policy details and property name.
- [ ] **TC-8:** Zod validation rejects policies where end_date < start_date.
- [ ] **TC-9:** Zod validation requires provider and policy_number as non-empty strings.
- [ ] **TC-10:** Zod validation restricts policy_type to the 6 allowed enum values.
- [ ] **TC-11:** Insurance CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-12:** Deleting a property CASCADE-deletes all associated insurance policies.
- [ ] **TC-13:** Coverage gap detection for 5 properties with 3 policies each completes in < 100ms.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Insurance tracking must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** Adding or modifying insurance policies must NOT affect existing hm_maintenance_schedules, hm_listings, or hm_tours records.
- [ ] **NC-3:** Deleting a policy must NOT delete the associated property.
- [ ] **NC-4:** Coverage gap analysis must NOT use external geolocation or risk APIs. It relies only on user-declared property attributes.
- [ ] **NC-5:** The document_id FK must NOT enforce a foreign key constraint until the document storage feature ships. It is a plain TEXT field, not a REFERENCES constraint.

## UI Specification

### Mobile (Expo)

**Insurance Section (Property Detail):**
- Background: `#0A0A0F` (background token)
- Section header: "Insurance" with policy count badge in module accent `#D97706`
- Summary bar: glass card (`rgba(255,255,255,0.04)`) showing total premium and active count
- Policy cards: glass token fill with glassBorder (`rgba(255,255,255,0.10)`)
- Card layout: Provider name (bold, `#F0F0F5`) | Policy type badge (accent color background) | Coverage + Premium in `textSecondary` (`rgba(240,240,245,0.65)`) | Renewal countdown or status badge (right-aligned)
- Status badges:
  - Expiring Soon: `#FFD60A` background, clock icon, dark text
  - Expired: `#FF453A` background, exclamation icon, white text
  - Renewing Soon: `#30D158` background, refresh icon, white text
  - Active: no badge (default state)
- Coverage gap warnings: amber card with `#FFD60A` left border, warning icon, gap description text
- "Add Policy" button at bottom: accent color outline, glass background
- Empty state: Shield icon (centered), "No insurance policies tracked" in `textSecondary`, "Add Policy" button in accent color

**Policy Detail Screen:**
- Bottom sheet on small screens, full modal on iPad
- Provider and policy type at top (large, accent-colored)
- Coverage/deductible/premium in a 3-column grid using glass cards
- Date range bar: start_date to end_date with progress indicator
- Agent contact section: name, phone (tappable), email (tappable) in a glass card
- Notes section if non-empty
- Action buttons: full-width, stacked vertically, glass background

**Add/Edit Policy Form:**
- Form fields: provider (text), policy number (text), policy type (segmented: Homeowners/Renters/Flood/Earthquake/Umbrella/Other), coverage amount (currency), deductible (currency), annual premium (currency), start date (date picker), end date (date picker), auto-renew toggle, agent name (text), agent phone (text), agent email (text), notes (text area)
- Save button: full-width, accent color
- Currency inputs: show "$" prefix, format with commas on blur

### Web (Next.js)

- Same tokens via CSS variables
- Insurance accessible from property detail page at `/homes/properties/[id]#insurance`
- Cross-property view at `/homes/insurance`
- Cards use glass morphism via `backdrop-filter: blur(16px)` and glass token backgrounds
- Policy detail opens as a side panel (not modal) for better UX on wide screens
- Coverage gap warnings display as a banner above the policy list
- Agent contact info shown inline with click-to-call (`tel:`) and click-to-email (`mailto:`) links

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (2) with pulsing animation | Initial data fetch from SQLite |
| Empty | Shield icon, "No insurance policies tracked" + "Add Policy" CTA | No records in hm_insurance_policies for this property |
| Error | "Something went wrong loading policies" + retry button | SQLite read failure |
| Success (all active) | Policy cards sorted by end_date, summary bar with totals | All policies have end_date >= today |
| Success (mixed) | Active policies first, then expired in collapsed "Past Policies" section | Mix of active and expired policies |
| Partial (gap warnings) | Amber gap warning cards above policy list | Coverage gap detected by engine |

## Test Requirements

### Unit Tests (modules/homes/src/__tests__/insurance-engine.test.ts)
- [ ] `getActivePolicies`: returns only policies with end_date >= today
- [ ] `getActivePolicies`: returns empty array when all policies are expired
- [ ] `getActivePolicies`: sorts by end_date ascending (soonest first)
- [ ] `getExpiringPolicies(30)`: returns policies expiring within 30 days
- [ ] `getExpiringPolicies(30)`: excludes auto-renew policies
- [ ] `getExpiringPolicies(30)`: returns empty array when no policies expire soon
- [ ] `getPolicyCostSummary`: calculates total annual premium across active policies
- [ ] `getPolicyCostSummary`: excludes $0 premiums from average calculations
- [ ] `getPolicyCostSummary`: returns zeros when no policies exist
- [ ] `checkCoverageGaps`: flags missing homeowners policy for owned house
- [ ] `checkCoverageGaps`: flags missing renters policy for rented apartment
- [ ] `checkCoverageGaps`: does not flag when correct policy type exists
- [ ] `checkCoverageGaps`: flags missing flood policy when property has flood_zone flag
- [ ] `checkCoverageGaps`: suggests umbrella when total coverage exceeds $500k
- [ ] `getRenewalCalendar(60)`: returns upcoming renewals within 60 days sorted by date
- [ ] `getRenewalCalendar(60)`: includes both auto-renew and manual-renew policies
- [ ] Zod validation: rejects policy with end_date before start_date
- [ ] Zod validation: requires provider as non-empty string
- [ ] Zod validation: requires policy_number as non-empty string
- [ ] Zod validation: rejects invalid policy_type enum value
- [ ] Zod validation: accepts valid InsurancePolicySchema with all required fields
- [ ] Zod validation: accepts nullable optional fields (document_id, agent_name, agent_phone, agent_email, notes)

### Integration Tests
- [ ] Full flow: create property, add insurance policy, policy appears in property detail
- [ ] Full flow: add 3 policies (homeowners, flood, umbrella), cost summary shows correct total premium
- [ ] Full flow: policy expires (end_date in past), status changes to "expired", sorts below active
- [ ] Full flow: delete property, all associated insurance policies are CASCADE-deleted
- [ ] Full flow: edit policy coverage amount, cost summary updates immediately
- [ ] Error flow: create policy with end_date < start_date, validation error returned, no record persisted

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyHomes module. Go to Properties tab. Ensure at least one property exists (e.g., "Main House", type: house, ownership: own). -- Setup prerequisite.
3. Tap "Main House" to open property detail. Scroll to Insurance section. Verify empty state with "Add Policy" CTA. -- Verifies empty state, AC-15.
4. Tap "Add Policy". Fill in: provider "State Farm", policy number "HO-12345", type "Homeowners", coverage $350,000, deductible $1,000, premium $1,800/yr, start date 2025-06-01, end date 2026-06-01, auto-renew off. Save. -- Verifies AC-1.
5. Verify the policy card appears in the Insurance section with provider name, type badge, coverage, and premium displayed. -- Corresponds to AC-3.
6. Verify the summary bar shows "$1,800/yr total" and "1 active policy". -- Corresponds to AC-5.
7. Tap the policy card. Verify detail view shows all entered fields and action buttons. -- Corresponds to AC-4.
8. Go back. Add a second policy: provider "USAA", policy number "FL-67890", type "Flood", coverage $250,000, deductible $5,000, premium $600/yr, start date 2025-03-01, end date 2025-04-15 (set to a past date to simulate expired). Save. -- Setup for AC-8.
9. Verify the expired flood policy shows a red "Expired" badge and appears below the active homeowners policy. -- Corresponds to AC-8.
10. Verify the summary bar shows "$1,800/yr total" (only active policies counted). -- Confirms expired policies excluded from active summary.
11. Add a third policy: provider "Allstate", policy number "UM-11111", type "Umbrella", coverage $1,000,000, premium $400/yr, end date 25 days from today, auto-renew off. Save. -- Setup for AC-7.
12. Verify the umbrella policy shows an amber "Expiring Soon" badge. -- Corresponds to AC-7.
13. Edit the umbrella policy: toggle auto-renew on. Save. Verify badge changes to green "Renewing Soon". -- Corresponds to AC-9.
14. Add a second property: "Downtown Apt", type "Apartment", ownership "Rent". Do not add any policies. Verify coverage gap warning: "No renters insurance policy found for this property." -- Corresponds to AC-10.
15. Navigate to cross-property insurance view (Properties tab > overflow > Insurance Overview). Verify policies from both properties appear, grouped by property, with a global summary. -- Corresponds to AC-6.
16. Delete the umbrella policy from Main House. Verify it disappears and premium summary updates. -- Corresponds to AC-12.
17. On the policy detail for State Farm, verify "Call Agent" and "Email Agent" buttons are hidden (no agent contact entered). Edit policy to add agent name "John Smith", phone "555-0100", email "john@statefarm.com". Save. Verify contact buttons now appear. -- Corresponds to AC-13, AC-14.
18. Repeat key steps (3-7, 11-12) on web at `/homes/properties/[id]#insurance` and `/homes/insurance`. Verify functional parity (minus push notifications). -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to property detail Insurance section, verify all 5 states (loading, empty, error, success-active, success-mixed, partial-gaps)
- [ ] Batch QA: after 5 features in homes module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `insurance-engine.ts` (getActivePolicies, getExpiringPolicies, getPolicyCostSummary, checkCoverageGaps, getRenewalCalendar)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- homes module has active standalone counterpart (MyHomes)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Homes module has 5 tables: hm_listings, hm_tours (V1), hm_properties, hm_maintenance_schedules, hm_settings (V2)
- Schema version 2, migrations v1 and v2
- Properties and maintenance reminders are built (A-tier feature complete)
- No concept of insurance tracking, coverage analysis, or policy management
- Property detail screen exists but has no insurance section

### After This Work
- Homes module has 6 tables (new: hm_insurance_policies) with 3 new indexes
- Schema version 3, migration v3 added
- New "Insurance" section on property detail screen showing policy cards, premium summary, and coverage gap warnings
- Cross-property insurance overview screen
- `insurance-engine.ts` contains pure functions for active policy filtering, expiry detection, cost summaries, coverage gap analysis, and renewal calendar generation
- Mobile: renewal reminders integrate with existing Reminders tab infrastructure
- Web: insurance views at `/homes/properties/[id]#insurance` and `/homes/insurance`

### Files Changed

- `modules/homes/src/types.ts` -- Add InsurancePolicySchema, PolicyTypeSchema, PolicyStatusSchema, InsurancePolicyInputSchema, CoverageGap type
- `modules/homes/src/db/schema.ts` -- Add CREATE_INSURANCE_POLICIES table, 3 indexes, V3_TABLES export
- `modules/homes/src/db/insurance.ts` -- NEW: insurance policy CRUD (create, get, getByProperty, getAll, update, delete)
- `modules/homes/src/db/index.ts` -- Re-export insurance CRUD functions
- `modules/homes/src/engines/insurance-engine.ts` -- NEW: getActivePolicies, getExpiringPolicies, getPolicyCostSummary, checkCoverageGaps, getRenewalCalendar
- `modules/homes/src/engines/index.ts` -- Re-export insurance engine functions and types
- `modules/homes/src/definition.ts` -- Add HOMES_MIGRATION_V3, update schemaVersion to 3, add insurance-detail and add-insurance screens to navigation
- `modules/homes/src/index.ts` -- Re-export new types and engine functions
- `modules/homes/src/__tests__/insurance-engine.test.ts` -- NEW: 22+ unit tests for insurance engine
- `apps/mobile/app/(homes)/insurance.tsx` -- NEW: Insurance overview screen
- `apps/mobile/app/(homes)/insurance-detail.tsx` -- NEW: Policy detail screen
- `apps/mobile/app/(homes)/add-insurance.tsx` -- NEW: Add/Edit insurance policy form
- `apps/web/app/homes/insurance/page.tsx` -- NEW: Insurance overview web page

### Known Limitations
- document_id FK is a plain TEXT field with no foreign key constraint. It becomes functional only after the Document storage (B-tier) feature ships.
- Coverage gap analysis is basic and rules-based. It does not use external risk data, FEMA flood maps, or geolocation APIs.
- No claim history tracking. This is a policy-level feature, not a claims management tool.
- No integration with MyBudget for premium expense categorization. Deferred to cross-module integration work.
- Flood zone flag is user-declared on the property record. A `flood_zone` boolean column should be added to hm_properties in the migration (simple ALTER TABLE or handled as part of a broader property attributes expansion).
- No policy comparison or rate shopping features. MyLife is a tracker, not an insurance marketplace.

### Context for Next Agent
- The migration v3 must add the hm_insurance_policies table only. Do not modify V1 or V2 tables. Follow the same migration pattern as V2 (array of SQL strings, exported as V3_TABLES).
- The hm_properties table needs a `flood_zone` boolean column (INTEGER DEFAULT 0) for the coverage gap analysis to work. Add this as part of migration v3 with an ALTER TABLE statement, or add it as a separate migration step in the V3_TABLES array.
- The insurance engine should be a pure function module (no database access). It receives arrays of policies and properties as arguments and returns analysis results. Database queries live in the CRUD layer (`db/insurance.ts`), not in the engine.
- Renewal reminders should integrate with the existing reminder infrastructure from the maintenance feature. The Reminders tab already exists; insurance renewal items should appear alongside maintenance reminders with a distinct icon (shield vs wrench).
- Currency values are stored as cents (INTEGER) in the database and converted to dollars for display. Follow the same pattern used in hm_listings.price_cents.
- The `auto_renew` field is stored as INTEGER (0/1) in SQLite and converted to boolean in the Zod schema, matching the pattern used for `is_active` in hm_maintenance_schedules.
