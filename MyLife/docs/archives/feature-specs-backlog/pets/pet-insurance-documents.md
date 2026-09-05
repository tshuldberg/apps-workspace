# Feature Spec: Pet Insurance & Claims Tracker

## Metadata
- **Module:** pets
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Pet profile CRUD (V1)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Pet insurance is a rapidly growing market (US pet insurance premiums exceeded $4B in 2025) and pet owners who carry insurance need a central place to track policies, log claims, and monitor reimbursement rates. Currently, policy details live in email inboxes, claims are tracked on paper or spreadsheets, and owners have no visibility into their annual spend vs. coverage limits. No major pet tracking app provides integrated insurance management. This gives MyPets a differentiated feature that addresses a real pain point for the growing segment of insured pet owners, while also feeding into the expense tracking system to show true cost-of-ownership net of reimbursements.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | No | N/A | No insurance tracking whatsoever |
| PetDesk | No | N/A | Vet booking focus, no financial features |
| Pawp | Partial | Premium ($24/mo) | Has an emergency fund (not traditional insurance tracking), no policy/claim management |
| FitBark | No | N/A | Activity tracker only, no financial features |

### Target User
Pet owners who carry pet insurance (estimated 5.4M US pets insured in 2025, growing 20% YoY) and want to track their policies, log claims, and understand their reimbursement rates. Also multi-pet households with different policies per pet who need a unified view. Currently these users track claims in spreadsheets or rely on their insurer's portal which only covers one provider. Migration path: users already tracking vet expenses in MyPets get insurance as a natural extension of their financial picture.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/db/schema.ts          -- V4 migration: pt_insurance_policies, pt_insurance_claims
modules/pets/src/definition.ts         -- Add V4 migration tables to PETS_MIGRATION_V4
modules/pets/src/types.ts              -- New Zod schemas: InsurancePolicy, InsuranceClaim, CoverageType, ClaimStatus
modules/pets/src/db/crud.ts            -- New CRUD: insurance policy and claim operations
modules/pets/src/engine/insurance.ts   -- Pure functions: annual cost, reimbursement rate, summary
modules/pets/src/index.ts              -- Re-export new public API
modules/pets/src/__tests__/insurance.test.ts -- Engine + CRUD tests
apps/mobile/app/(pets)/insurance.tsx   -- Per-pet insurance screen
apps/mobile/app/(pets)/components/InsurancePolicyCard.tsx  -- Policy summary card
apps/mobile/app/(pets)/components/ClaimCard.tsx            -- Individual claim card
apps/web/app/pets/[petId]/insurance/page.tsx               -- Web insurance screen
```

### Wireframe Position

```
Hub Dashboard
  └── MyPets card
       └── Pets tab (pet list)
            └── Pet Detail
                 └── Health tab
                      └── Insurance ← YOU ARE HERE
```

The insurance section is accessible from the pet detail screen under the Health tab. It shows a summary card with policy info and a claims list below.

### Data Model

V4 adds two new tables. Note: if the Exercise Walk Log feature also targets V4, both sets of DDL should be combined into a single PETS_MIGRATION_V4.

```sql
-- V4 Migration: Insurance policies and claims

CREATE TABLE IF NOT EXISTS pt_insurance_policies (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  policy_number TEXT,
  coverage_type TEXT NOT NULL DEFAULT 'accident_illness',
  monthly_premium_cents INTEGER,
  deductible_cents INTEGER,
  annual_limit_cents INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pt_insurance_claims (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES pt_insurance_policies(id) ON DELETE CASCADE,
  claim_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  reimbursement_cents INTEGER,
  resolved_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS pt_insurance_policies_pet_idx
  ON pt_insurance_policies(pet_id, start_date DESC);
CREATE INDEX IF NOT EXISTS pt_insurance_claims_policy_idx
  ON pt_insurance_claims(policy_id, claim_date DESC);
CREATE INDEX IF NOT EXISTS pt_insurance_claims_status_idx
  ON pt_insurance_claims(status);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, Migration), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** None. No insurance provider APIs in this version.
- **Cross-Module:** Expense tracking -- insurance premiums can auto-create monthly expense entries in `pt_expenses` with category "insurance". This bridges insurance costs into the existing cost-of-ownership calculations.

## Functional Requirements

### User Stories
1. As a pet owner, I want to store my pet's insurance policy details (provider, policy number, coverage type, premium, deductible, annual limit) so that I have all info in one place.
2. As a pet owner, I want to log insurance claims with the amount, description, and track their status (submitted/pending/approved/denied) so that I can monitor my claims.
3. As a pet owner, I want to see my reimbursement rate (total reimbursed / total claimed) so that I understand the value of my insurance.
4. As a pet owner, I want to see my annual insurance cost (premiums + deductible paid) so that I can evaluate whether insurance is worth it.
5. As a pet owner, I want to track how much of my annual coverage limit has been used so that I know how much coverage remains.
6. As a multi-pet owner, I want separate policies per pet so that I can track each pet's insurance independently.

### Behavior Specification

**Adding an insurance policy:**
1. User navigates to a pet's detail screen, Health tab
2. User taps the Insurance section or "Add Policy" CTA
3. System opens Add Policy bottom sheet with fields: provider (text, required), policy number (text, optional), coverage type (picker: accident_illness, accident_only, wellness, comprehensive), monthly premium (currency input in dollars, stored as cents), deductible (currency input), annual limit (currency input), start date (date picker, required), end date (date picker, optional), notes (text, optional)
4. User fills in fields and taps Save
5. System validates input (provider and start_date required), persists to `pt_insurance_policies`
6. Policy card appears on the insurance screen

**Auto-creating monthly expense from premium:**
1. When a policy is created with a non-null `monthly_premium_cents`, system creates a one-time expense entry in `pt_expenses` with category "insurance", label "Insurance: [provider]", amount = monthly_premium_cents, spent_on = policy start_date
2. Recurring monthly expenses are NOT auto-created (no background scheduler). The auto-expense is a one-time record at creation. Future enhancement could add recurring expense support.

**Logging a claim:**
1. User taps "Log Claim" on a policy card
2. System opens Add Claim bottom sheet: claim date (date picker, required), amount (currency input in dollars, required), description (text, required), notes (text, optional)
3. User fills in fields and taps Save
4. System validates (amount > 0, description required), creates `pt_insurance_claims` with status "submitted"
5. Claim card appears in the claims list under the policy

**Updating claim status:**
1. User taps on a claim card
2. System opens Claim Detail bottom sheet showing all fields + status picker (submitted, pending, approved, denied)
3. User changes status and optionally adds reimbursement amount and resolved date
4. System updates the claim record
5. If status changes to "approved" with a reimbursement amount, the insurance summary recalculates

**Viewing insurance summary:**
1. System calls `getInsuranceSummary()` which aggregates across all policies for a pet
2. Summary shows: total annual premium cost, total claimed amount, total reimbursed, reimbursement rate percentage, annual limit usage percentage
3. Summary updates automatically when policies or claims change

### Edge Cases

- **Multiple policies per pet:** Allowed. Some pets have both accident/illness and wellness policies from different providers. Each policy has its own claims list.
- **Expired policy:** Policy with `end_date` in the past is displayed with a "Expired" badge. Claims can still be logged against expired policies (claims may be filed after policy ends).
- **Claim exceeding annual limit:** Allow the claim to be logged. Show a warning: "This claim may exceed your annual coverage limit." Do not block the save.
- **No premium set:** Monthly premium is optional. If null, skip auto-expense creation and show "N/A" for annual cost in summary.
- **Zero reimbursement:** Valid scenario (fully denied claim). Reimbursement of 0 is different from null (pending).
- **Claim amount is 0:** Block save. Claim must have a positive amount.
- **Policy deleted:** CASCADE deletes all associated claims. Show confirmation: "Delete this policy? All [N] claims will also be deleted."
- **Pet deleted:** CASCADE deletes policies and claims.
- **Module disabled:** Routes removed, data preserved. Re-enabling restores everything.
- **Currency display:** All amounts stored in cents. Display in dollars with 2 decimal places. No multi-currency support in this version.
- **No policies exist:** Show empty state with shield illustration and "Add Insurance Policy" CTA.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can add an insurance policy with provider, coverage type, premium, deductible, annual limit, and dates
- [ ] **AC-2:** Policy card displays on the insurance screen with provider name, coverage type, and premium
- [ ] **AC-3:** User can edit an existing policy's details
- [ ] **AC-4:** User can delete a policy with confirmation (warns about cascading claim deletion)
- [ ] **AC-5:** User can log a claim against a policy with date, amount, description, and notes
- [ ] **AC-6:** User can update a claim's status (submitted/pending/approved/denied) and add reimbursement amount
- [ ] **AC-7:** Insurance summary shows annual premium cost, total claimed, total reimbursed, and reimbursement rate
- [ ] **AC-8:** Annual limit usage bar shows percentage of limit consumed by approved claims
- [ ] **AC-9:** Expired policies display with an "Expired" badge
- [ ] **AC-10:** Empty state shows shield illustration and "Add Insurance Policy" CTA
- [ ] **AC-11:** Creating a policy with a premium auto-creates an expense entry in pt_expenses

### Technical Criteria
- [ ] **TC-1:** V4 migration creates `pt_insurance_policies` and `pt_insurance_claims` tables with correct foreign keys and indexes
- [ ] **TC-2:** V4 migration is idempotent (safe to re-run via CREATE TABLE IF NOT EXISTS)
- [ ] **TC-3:** `calculateAnnualInsuranceCost()` returns correct annual cost from monthly premium
- [ ] **TC-4:** `calculateClaimReimbursementRate()` returns correct percentage (0-100) handling division by zero
- [ ] **TC-5:** `getInsuranceSummary()` aggregates correctly across multiple policies for one pet
- [ ] **TC-6:** Claim status transitions are validated (any status can move to any other status -- no strict state machine)
- [ ] **TC-7:** All monetary values stored as INTEGER cents, displayed as formatted dollar amounts
- [ ] **TC-8:** Policy deletion CASCADE deletes all associated claims

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Adding a policy for one pet must NOT affect other pets' policies
- [ ] **NC-2:** Deleting a policy must NOT delete the pet or other policies
- [ ] **NC-3:** Insurance data must NOT send any network requests (offline-first, local-only)
- [ ] **NC-4:** Disabling the Pets module must NOT delete insurance data
- [ ] **NC-5:** Claim amount must NOT be zero or negative

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Policy cards:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 12px border radius
- **Module accent:** `#F59E0B` (amber)
- **Policy header:** Provider name in `#F0F0F5` (text token) 18px semibold, coverage type badge in `rgba(245,158,11,0.15)` background with `#F59E0B` text
- **Premium display:** "$XX.XX/mo" in `#F59E0B` accent, 16px bold
- **Expired badge:** `rgba(255,69,58,0.12)` background, `#FF453A` text, "EXPIRED" uppercase 11px bold
- **Claim status badges:**
  - Submitted: `rgba(245,158,11,0.15)` bg, `#F59E0B` text
  - Pending: `rgba(255,255,255,0.08)` bg, `rgba(240,240,245,0.65)` text
  - Approved: `rgba(48,209,88,0.15)` bg, `#30D158` text
  - Denied: `rgba(255,69,58,0.12)` bg, `#FF453A` text
- **Summary card:** Glass card at top with reimbursement rate as a large percentage, annual cost, and limit usage bar
- **Limit usage bar:** `#F59E0B` fill on `rgba(255,255,255,0.06)` track. When > 80%: fill changes to `#FF453A`
- **Layout:** ScrollView with sections: summary card (top), policy cards with nested claim lists (middle), "Add Policy" button at bottom
- **Bottom sheet for Add/Edit Policy:** Glass morphism background via expo-blur BlurView

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Insurance screen accessible via `/pets/[petId]/insurance` route
- Sidebar navigation: "Insurance" appears as a sub-nav item under the pet detail
- Policy cards use CSS `backdrop-filter: blur(12px)` for glass effect
- Status badge transitions use CSS transitions (200ms ease)
- Add/Edit Policy uses modal dialog instead of bottom sheet
- Claim list uses collapsible sections per policy

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | 1 skeleton policy card with pulsing animation | Initial data fetch |
| Empty | Shield illustration, "No insurance policies yet", "Add Insurance Policy" button | No policies for this pet |
| Single Policy | Policy card with details, empty claims list or claims below | One policy exists |
| Multiple Policies | Summary card at top, multiple policy cards with claims | Multiple policies exist |
| Claim Pending | Claim card with yellow "Submitted" badge | Claim logged but not resolved |
| Claim Resolved | Claim card with green "Approved" or red "Denied" badge | Claim status updated |
| Error | Toast: "Could not load insurance data." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/insurance.ts)
- [ ] `calculateAnnualInsuranceCost`: returns monthly_premium * 12 for single policy
- [ ] `calculateAnnualInsuranceCost`: returns 0 when premium is null
- [ ] `calculateAnnualInsuranceCost`: sums across multiple policies for same pet
- [ ] `calculateClaimReimbursementRate`: returns 80 when $800 reimbursed of $1000 claimed
- [ ] `calculateClaimReimbursementRate`: returns 0 when no claims exist (avoids division by zero)
- [ ] `calculateClaimReimbursementRate`: returns 0 when all claims are denied (0 reimbursement)
- [ ] `calculateClaimReimbursementRate`: ignores claims with null reimbursement (pending/submitted)
- [ ] `getInsuranceSummary`: returns correct totals across multiple policies and claims
- [ ] `getInsuranceSummary`: calculates annual limit usage as (approved claims total / annual_limit * 100)
- [ ] `getInsuranceSummary`: returns 0% limit usage when annual_limit is null
- [ ] `getInsuranceSummary`: handles mix of approved and denied claims correctly

### Integration Tests (CRUD)
- [ ] `createInsurancePolicy` persists policy and returns it
- [ ] `createInsurancePolicy` auto-creates expense entry when premium is set
- [ ] `createInsurancePolicy` does NOT create expense when premium is null
- [ ] `getInsurancePoliciesForPet` returns policies sorted by start_date DESC
- [ ] `updateInsurancePolicy` persists changes
- [ ] `deleteInsurancePolicy` removes policy and CASCADE deletes claims
- [ ] `createInsuranceClaim` persists claim with status "submitted"
- [ ] `createInsuranceClaim` rejects claim with amount_cents = 0
- [ ] `listClaimsForPolicy` returns claims sorted by claim_date DESC
- [ ] `updateClaimStatus` changes status and sets reimbursement and resolved_date
- [ ] Delete pet CASCADE deletes policies and claims
- [ ] V4 migration runs cleanly on existing V3 database
- [ ] Multiple policies per pet are allowed and independently managed

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Tap an existing pet (or create one: "Luna", dog, golden retriever)
4. Navigate to the Health tab, Insurance section
5. **Verify empty state:** See shield illustration and "Add Insurance Policy" button -- AC-10
6. Tap "Add Insurance Policy"
7. Fill in: provider = "Lemonade", policy number = "PET-12345", coverage = accident_illness, premium = $35.00, deductible = $250.00, annual limit = $10,000.00, start = 2026-01-01
8. Tap Save
9. **Verify:** Policy card appears with "Lemonade", "Accident & Illness" badge, "$35.00/mo" -- AC-1, AC-2
10. **Verify:** An expense entry was created in the expenses section with "Insurance: Lemonade" label -- AC-11
11. Tap "Log Claim" on the Lemonade policy
12. Fill in: date = 2026-03-15, amount = $450.00, description = "Luna ACL surgery consultation"
13. Tap Save
14. **Verify:** Claim card appears with "Submitted" yellow badge, "$450.00" -- AC-5
15. Tap the claim card
16. Change status to "Approved", enter reimbursement = $360.00, resolved date = 2026-03-20
17. Tap Save
18. **Verify:** Claim badge changes to green "Approved", shows "$360.00 reimbursed" -- AC-6
19. **Verify:** Summary card shows: Annual cost = $420.00, Total claimed = $450.00, Reimbursed = $360.00, Rate = 80% -- AC-7
20. **Verify:** Limit usage bar shows 4.5% ($450 of $10,000) -- AC-8
21. Add a second policy: provider = "Embrace", coverage = wellness, no premium, start = 2025-06-01, end = 2025-12-31
22. **Verify:** Second policy shows with "Expired" badge -- AC-9
23. Tap edit on the Lemonade policy, change premium to $40.00, save
24. **Verify:** Card updates with "$40.00/mo" -- AC-3
25. Delete the Embrace policy
26. **Verify:** Confirmation warns about claim deletion, only Lemonade remains -- AC-4
27. Create a second pet "Max"
28. **Verify:** Max has no insurance policies (independent from Luna) -- NC-1

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for insurance engine (annual cost, reimbursement rate, summary)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `pt_expenses` table exists (V1) with categories including "other" but no "insurance" category
- `createPetExpense()` and `listExpensesForPet()` CRUD exist in `crud.ts`
- `ExpenseCategorySchema` enum exists in `types.ts` with: vet, food, grooming, medication, supplies, boarding, training, other
- No insurance policy tracking
- No insurance claim tracking
- No insurance summary or reimbursement rate calculation
- No mobile or web UI for insurance management

### After This Work
- V4 migration adds `pt_insurance_policies` and `pt_insurance_claims` tables with indexes
- `ExpenseCategorySchema` extended with `"insurance"` value
- New Zod schemas: `InsurancePolicySchema`, `InsuranceClaimSchema`, `CoverageTypeSchema` (enum: accident_illness, accident_only, wellness, comprehensive), `ClaimStatusSchema` (enum: submitted, pending, approved, denied), `InsuranceSummarySchema`, `CreateInsurancePolicyInputSchema`, `UpdateInsurancePolicyInputSchema`, `CreateInsuranceClaimInputSchema`, `UpdateClaimStatusInputSchema`
- New CRUD: `createInsurancePolicy()`, `getInsurancePoliciesForPet()`, `updateInsurancePolicy()`, `deleteInsurancePolicy()`, `createInsuranceClaim()`, `listClaimsForPolicy()`, `updateClaimStatus()`
- New engine: `engine/insurance.ts` with `calculateAnnualInsuranceCost()`, `calculateClaimReimbursementRate()`, `getInsuranceSummary()`
- Mobile screen at `apps/mobile/app/(pets)/insurance.tsx`
- Web page at `apps/web/app/pets/[petId]/insurance/page.tsx`
- 24+ new tests covering engine logic and CRUD operations

### Files Changed

- `modules/pets/src/db/schema.ts` -- V4 table DDL: pt_insurance_policies, pt_insurance_claims, indexes
- `modules/pets/src/definition.ts` -- Add insurance tables to PETS_MIGRATION_V4, bump schemaVersion
- `modules/pets/src/types.ts` -- New schemas: InsurancePolicy, InsuranceClaim, CoverageType enum, ClaimStatus enum, InsuranceSummary, create/update inputs. Extend ExpenseCategorySchema with "insurance"
- `modules/pets/src/db/crud.ts` -- New CRUD: 7 insurance functions, auto-expense on policy create
- `modules/pets/src/engine/insurance.ts` -- New engine file with 3 pure functions
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/insurance.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/insurance.tsx` -- Per-pet insurance screen
- `apps/mobile/app/(pets)/components/InsurancePolicyCard.tsx` -- Policy summary card
- `apps/mobile/app/(pets)/components/ClaimCard.tsx` -- Individual claim card
- `apps/web/app/pets/[petId]/insurance/page.tsx` -- Web insurance page

### Known Limitations
- No recurring expense auto-creation for monthly premiums. The auto-expense at policy creation is a one-time record. A future enhancement with recurring expense support in the budget/expense system could solve this.
- No integration with insurance provider APIs (no auto-claim filing, no auto-status updates). All data is manually entered.
- No document/receipt attachment on claims (no photo/file storage for claim evidence). Future enhancement could use `pt_pet_photos` with a claim tag.
- Currency is USD-only. All amounts stored in cents with no currency code. Multi-currency support would require schema changes.
- No notifications for pending claim follow-ups or policy renewal dates.

### Context for Next Agent
- The V4 migration may be shared with other Sprint 3 features (Exercise Walk Log, Expense Tracking). If multiple features target V4, combine all DDL into a single `PETS_MIGRATION_V4` in `definition.ts`. Each feature's schema exports should be separate in `schema.ts` for clarity, but the migration object should include all of them.
- The `ExpenseCategorySchema` enum in `types.ts` needs to be extended with `"insurance"`. This is a Zod enum -- add the new value to the existing `z.enum([...])` call. Existing expense data will not be affected since no rows use the new category yet.
- The auto-expense creation on policy add mirrors the pattern used by `createGroomingRecord()` and `createVetVisit()` in `crud.ts`, which both auto-create expense entries when a cost is provided. Follow the same transaction pattern.
- `calculateClaimReimbursementRate()` should only consider claims with non-null `reimbursement_cents` (approved/denied with explicit reimbursement). Claims still in "submitted" or "pending" status with null reimbursement are excluded from the rate calculation.
- The `annual_limit_cents` usage calculation should sum `amount_cents` from approved claims only (not all claims). Submitted and denied claims do not count against the limit.
