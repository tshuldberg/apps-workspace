# Feature Spec: Insurance Document Storage

## Metadata
- **Module:** car
- **SPEC ID:** CR-008
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [2] x1 + PaidUser [2] x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (builds on existing cr_vehicles table and vehicle CRUD layer)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Every driver needs quick access to their insurance card, whether during a traffic stop, a fender bender, or when filing a claim. Most people fumble through a glove box for a paper card or scroll through email for a PDF. Existing car care apps either ignore insurance entirely or treat it as a basic document attachment without structure. A dedicated insurance storage feature with structured policy data, agent contact info, document photos, and expiration alerts gives MyCar a differentiated edge. It also ties into the existing reminder engine for expiration notifications, keeping users proactively informed about coverage lapses.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| CARFAX Car Care | Partial | No (free) | Basic document storage as attachments to service records; no structured insurance fields |
| Simply Auto | Partial | Premium tier | Document attachments on vehicle records; no dedicated insurance screen or policy fields |
| Jerry | Yes | Free (data-selling model) | Full insurance management with quotes, switching, and policy storage; monetizes by selling user data to insurers |
| Drivvo | No | N/A | No insurance tracking capability |
| FIXD | No | N/A | OBD-II focused; no document or insurance features |
| MileIQ | No | N/A | Mileage tracking only; no insurance |

### Target User
Any vehicle owner who wants instant access to their insurance card without digging through paper or apps. Especially valuable for multi-vehicle households managing multiple policies, rideshare drivers who need to prove commercial coverage, and privacy-conscious users who refuse to use Jerry (which sells data to insurance brokers). Also useful for young drivers or parents managing family fleet insurance who want expiration alerts to prevent coverage lapses.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  types.ts                                -- New Zod schemas: CoverageType, PremiumFrequency,
                                             InsurancePolicy, InsuranceDocument, CreatePolicyInput,
                                             CreateDocumentInput
  db/schema.ts                            -- New tables: cr_insurance_policies, cr_insurance_documents
  db/crud.ts                              -- New CRUD: createPolicy, getPoliciesByVehicle, getPolicyById,
                                             updatePolicy, deletePolicy, createDocument,
                                             getDocumentsByPolicy, deleteDocument, getExpiringPolicies
  engines/insurance-engine.ts             -- NEW: expiration check, coverage summary, premium annualization
  definition.ts                           -- Migration V3 or V4 for new tables
  index.ts                                -- Re-export new types and engine functions
  __tests__/insurance-engine.test.ts      -- NEW: unit tests for insurance engine

apps/mobile/app/(car)/
  insurance.tsx                           -- NEW: Insurance overview screen (per vehicle)
  add-policy.tsx                          -- NEW: Add/Edit policy form
  insurance-card.tsx                      -- NEW: Quick-access insurance card viewer
  add-insurance-doc.tsx                   -- NEW: Add document photo screen

apps/web/app/car/
  insurance/page.tsx                      -- NEW: Insurance management web page
  insurance/actions.ts                    -- NEW: Server actions for insurance operations
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       └── Vehicle Detail screen
            └── "Insurance" section / tab
                 ├── Active policy card (provider, policy #, expiry)
                 ├── "View Insurance Card" quick-access button
                 ├── Document gallery (card front, card back, declaration page)
                 └── "Add Policy" button
```

The Insurance feature is accessible from:
1. The Vehicle Detail screen under an "Insurance" section (primary entry point)
2. A "Insurance Card" quick-action on the MyCar Dashboard card for the primary vehicle
3. Future: push notification tap when a policy is about to expire (deep links to policy detail)

### Data Model

```sql
-- New table: cr_insurance_policies (Migration V3 or V4)
CREATE TABLE IF NOT EXISTS cr_insurance_policies (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    coverage_type TEXT NOT NULL DEFAULT 'liability',
    premium_cents INTEGER,
    premium_frequency TEXT NOT NULL DEFAULT 'monthly',
    deductible_cents INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    agent_name TEXT,
    agent_phone TEXT,
    agent_email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: cr_insurance_documents (Migration V3 or V4)
CREATE TABLE IF NOT EXISTS cr_insurance_documents (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL REFERENCES cr_insurance_policies(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL DEFAULT 'other',
    image_uri TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS cr_insurance_policies_vehicle_idx
    ON cr_insurance_policies(vehicle_id);
CREATE INDEX IF NOT EXISTS cr_insurance_policies_end_date_idx
    ON cr_insurance_policies(end_date ASC);
CREATE INDEX IF NOT EXISTS cr_insurance_documents_policy_idx
    ON cr_insurance_documents(policy_id);
```

**coverage_type enum values:** `liability`, `comprehensive`, `collision`, `uninsured_motorist`, `umbrella`, `full_coverage`, `other`

**premium_frequency enum values:** `monthly`, `quarterly`, `semi_annual`, `annual`

**document_type enum values:** `card_front`, `card_back`, `policy_doc`, `declaration_page`, `other`

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for schema V3/V4), existing reminder engine in `engines/reminder-engine.ts` (for expiration alert scheduling pattern)
- **External:** `expo-image-picker` (mobile photo capture/selection), `zod` (schema validation). No external APIs required.
- **Cross-Module:** Light future integration with budget module (premium costs could feed into recurring expense categories). Not blocking for this spec. Insurance data is self-contained.

## Functional Requirements

### User Stories
1. As a driver, I want to store my insurance policy details per vehicle so that I have all my coverage information in one place.
2. As a driver pulled over by police, I want to quickly show my insurance card photo from my phone so that I do not have to dig through a glove box.
3. As a multi-vehicle owner, I want to see all active policies across my vehicles so that I can compare coverage and spot lapses.
4. As a cost-conscious driver, I want to see my annualized insurance cost per vehicle so that I can compare premiums when shopping for quotes.
5. As a forgetful driver, I want to receive an alert before my insurance policy expires so that I never drive uninsured.
6. As a privacy-first user, I want my insurance documents stored locally on my device with no cloud upload so that sensitive policy data stays private.

### Behavior Specification

**Adding a new policy:**
1. User navigates to MyCar > Vehicle Detail > Insurance section.
2. User taps "Add Policy" button.
3. Form displays with fields:
   - Provider name (required text, e.g., "State Farm", "GEICO")
   - Policy number (required text, e.g., "SF-1234567")
   - Coverage type (dropdown with 7 options, defaults to "liability")
   - Premium amount (optional currency input in dollars, stored as cents)
   - Premium frequency (segmented control: Monthly, Quarterly, Semi-Annual, Annual; defaults to "monthly")
   - Deductible amount (optional currency input in dollars, stored as cents)
   - Start date (required date picker)
   - End date (required date picker, must be after start date)
   - Agent name (optional text)
   - Agent phone (optional phone input)
   - Agent email (optional email input)
   - Notes (optional multiline text)
4. User taps Save. System validates inputs:
   - Provider and policy_number are non-empty strings
   - End date is after start date
   - Premium and deductible are non-negative integers (cents)
   - Coverage type is one of the 7 valid enum values
5. System creates the cr_insurance_policies record.
6. If the existing reminder engine is available, the system schedules an expiration reminder for 30 days before the end_date (uses the same pattern as maintenance reminders). If it is not yet wired, this step is deferred to a follow-up integration.
7. User is returned to the Insurance section, which now shows the new policy card.

**Viewing insurance overview:**
1. User navigates to MyCar > Vehicle Detail > Insurance.
2. Active policies are displayed as glass cards, each showing:
   - Provider name and logo placeholder (first letter badge)
   - Policy number (partially masked: last 4 digits visible, rest as dots)
   - Coverage type badge
   - Premium (annualized, e.g., "$1,440/yr" for $120/mo)
   - Expiration date with status indicator:
     - Green if > 30 days remaining
     - Amber if <= 30 days remaining
     - Red if expired
   - "View Card" quick-access button
3. Expired policies are shown below active ones in a "Past Policies" collapsed section.
4. A summary line at the top shows: total annual premium for all active policies on this vehicle.

**Quick-access insurance card view:**
1. User taps "View Card" on a policy card, or taps the "Insurance Card" quick-action from the Dashboard.
2. A full-screen view opens showing the most recent card_front and card_back document images side by side (or stacked on narrow screens).
3. Images are displayed at maximum readable size with pinch-to-zoom support.
4. A phone icon tapping the agent_phone field initiates a phone call (via Linking.openURL on mobile).
5. The screen brightness increases to maximum for readability (mobile only, restored on exit).
6. A "Share" button allows the user to share the card image via the native share sheet (for sending to rental car companies, etc.).

**Adding insurance documents:**
1. From the policy detail view, user taps "Add Document".
2. User chooses document type: Card Front, Card Back, Policy Doc, Declaration Page, Other.
3. User captures a photo (camera) or selects from photo library.
4. Image is saved to the app's local file storage. The URI is stored in cr_insurance_documents.
5. User can add an optional label (e.g., "2025-2026 card").
6. The document appears in the document gallery on the policy detail view.

**Editing a policy:**
1. User taps a policy card to open the detail/edit view.
2. All fields are editable.
3. Saving an edit updates the record and recalculates the expiration reminder if the end_date changed.

**Deleting a policy:**
1. User taps delete icon or swipes left on a policy card.
2. Confirmation dialog: "Delete this policy and all associated documents? This cannot be undone."
3. If confirmed, the policy and all its documents (cr_insurance_documents) are CASCADE-deleted.
4. Associated document image files should be cleaned up from local storage (best-effort, no crash if file is missing).

**Expiration alerts:**
1. When a policy is created or its end_date is updated:
2. System checks if end_date is in the future.
3. If end_date is within 30 days or less, a "due_soon" alert is flagged for the Insurance screen (amber indicator).
4. If end_date has passed, the policy is marked as "expired" (red indicator).
5. On mobile, a local push notification can be scheduled for 30 days before end_date (using the same expo-notifications pattern as maintenance reminders). This is a stretch goal for V1 -- the in-app indicators are the core requirement.

### Edge Cases

- **No vehicles exist:** Insurance section not accessible (it lives under Vehicle Detail, which requires a vehicle).
- **No policies for a vehicle:** Insurance section shows empty state: "No insurance policies added" with "Add Policy" button.
- **Multiple active policies for same vehicle:** Allowed and expected (e.g., liability + comprehensive as separate policies, or policies from different providers during a transition period).
- **Overlapping policy dates:** Allowed. No validation against date overlap.
- **Expired policy with no replacement:** Show the expired policy with a red "Expired" badge and a warning: "Your coverage for [vehicle name] has expired. Add a new policy."
- **Document image deleted from filesystem:** Show a placeholder "Image not found" with option to re-capture. Do not crash.
- **Very long policy number:** Accepted up to 50 characters. Masking shows last 4 characters regardless of length.
- **Agent fields all empty:** Allowed. Agent info section is hidden when all agent fields are null.
- **Premium is zero:** Accepted (e.g., a policy paid by employer or bundled with another product).
- **Deductible is zero:** Accepted (some policies have no deductible).
- **Module disabled mid-use:** Data is preserved. Re-enabling restores all policies and documents.
- **Vehicle deleted:** CASCADE deletes all associated policies. Policy cascade deletes all associated documents.
- **User navigates away mid-form:** Unsaved changes are discarded. No draft persistence.
- **Photo capture fails (camera permission denied):** Show error message "Camera access is required to capture documents. Enable it in Settings." with link to device settings. Allow photo library selection as fallback.
- **Large document images (10MB+):** Accept but compress to max 2MB on save for storage efficiency. Use JPEG compression at 80% quality.
- **Policy number contains special characters:** Accepted. No sanitization needed for local storage.
- **Annual premium calculation edge case (semi-annual frequency):** Annualized = premium_cents x 2. Quarterly = premium_cents x 4. Monthly = premium_cents x 12. Annual = premium_cents x 1.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Navigating to Vehicle Detail > Insurance with no policies shows an empty state with "No insurance policies added" message and "Add Policy" button.
- [ ] **AC-2:** Tapping "Add Policy" opens a form with all required fields (provider, policy number, coverage type, start date, end date) and optional fields (premium, deductible, agent info, notes).
- [ ] **AC-3:** Saving a valid policy creates a record and shows it as a card in the Insurance section with provider name, masked policy number, coverage badge, annualized premium, and expiration status.
- [ ] **AC-4:** The policy number is displayed with masking (last 4 characters visible, rest as dots).
- [ ] **AC-5:** The annualized premium is calculated correctly based on frequency (monthly x12, quarterly x4, semi-annual x2, annual x1).
- [ ] **AC-6:** The expiration status indicator shows green (>30 days), amber (<=30 days), or red (expired) based on the end_date relative to today.
- [ ] **AC-7:** Tapping "View Card" opens a full-screen view of the card_front and card_back images with pinch-to-zoom.
- [ ] **AC-8:** The quick-access card view increases screen brightness on mobile and restores it on exit.
- [ ] **AC-9:** Adding a document via camera capture or photo library saves the image and shows it in the document gallery.
- [ ] **AC-10:** Each document shows its type label (Card Front, Card Back, etc.) and optional custom label.
- [ ] **AC-11:** Tapping the agent phone number initiates a phone call via the native dialer.
- [ ] **AC-12:** Editing a policy's end_date updates the expiration status indicator immediately.
- [ ] **AC-13:** Deleting a policy shows a confirmation dialog. Confirming removes the policy and all its documents.
- [ ] **AC-14:** Expired policies appear in a collapsed "Past Policies" section below active policies.
- [ ] **AC-15:** The Insurance section header shows the total annualized premium for all active policies on the vehicle.
- [ ] **AC-16:** The "Share" button on the insurance card view opens the native share sheet with the card image.

### Technical Criteria
- [ ] **TC-1:** Schema migration creates cr_insurance_policies and cr_insurance_documents tables with all columns, 3 indexes, and correct cr_ prefix.
- [ ] **TC-2:** Zod validation rejects a policy where end_date is before or equal to start_date.
- [ ] **TC-3:** Zod validation rejects empty provider or policy_number strings.
- [ ] **TC-4:** Zod validation requires coverage_type to be one of the 7 enum values.
- [ ] **TC-5:** Zod validation requires document_type to be one of the 5 enum values.
- [ ] **TC-6:** `createPolicy` persists a record with all fields correctly mapped from camelCase to snake_case.
- [ ] **TC-7:** `getPoliciesByVehicle` returns policies sorted by end_date descending (most recent first).
- [ ] **TC-8:** `getDocumentsByPolicy` returns documents sorted by created_at descending.
- [ ] **TC-9:** `getExpiringPolicies` returns only active policies with end_date within N days of the given date.
- [ ] **TC-10:** `annualizePremium` correctly multiplies by frequency factor (monthly=12, quarterly=4, semi_annual=2, annual=1).
- [ ] **TC-11:** Deleting a policy CASCADE-deletes all associated documents from cr_insurance_documents.
- [ ] **TC-12:** Deleting a vehicle CASCADE-deletes all associated policies, which CASCADE-delete all documents.
- [ ] **TC-13:** Migration runs cleanly on databases with existing V1+V2 schema without data loss.
- [ ] **TC-14:** Document images are compressed to max 2MB JPEG on save.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Insurance data must NOT make any network calls. All storage is on-device.
- [ ] **NC-2:** Insurance card images must NOT be uploaded to any cloud service or CDN.
- [ ] **NC-3:** Deleting a policy must NOT affect other policies on the same vehicle.
- [ ] **NC-4:** The full policy number must NOT be displayed in the list view. Only the last 4 characters are visible; the rest are masked.
- [ ] **NC-5:** The screen brightness change on the insurance card view must NOT persist after the user leaves the screen.
- [ ] **NC-6:** A missing document image file must NOT crash the app. Show a placeholder instead.
- [ ] **NC-7:** Camera permission denial must NOT block the user from using photo library selection as a fallback.

## UI Specification

### Mobile (Expo)

**Insurance Overview (within Vehicle Detail):**
- Section header: "Insurance" with a shield icon, module accent `#6366F1`
- Total premium line: "Total: $X,XXX/yr" in accent color, right-aligned in header
- Policy cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border (glassBorder token)
- Card layout:
  - Top row: Provider name (large, `#F0F0F5`) | Coverage badge (pill, accent background)
  - Middle row: Masked policy number (`rgba(240,240,245,0.65)` textSecondary) | Annualized premium
  - Bottom row: "Expires [date]" with status dot (green/amber/red) | "View Card" button (accent outline)
- Expiration status dots:
  - Active (>30 days): `#30D158` (success / green)
  - Expiring soon (<=30 days): `#FFD60A` (amber)
  - Expired: `#FF453A` (danger / red)
- "Past Policies" section: collapsed by default, `rgba(240,240,245,0.35)` header text, expandable
- "Add Policy" button: full-width, accent outline, glass background
- Empty state: centered shield icon, "No insurance policies added" in textSecondary, "Add Policy" accent button

**Insurance Card Quick-View:**
- Full-screen modal with dark background `#0A0A0F`
- Card images: max width, rounded corners (12px), stacked vertically with 16px gap
- Pinch-to-zoom enabled via React Native's built-in gesture handling
- Agent info bar at bottom: name, phone (tappable, `#6366F1` text), email
- "Share" button: top-right, outline style
- Screen brightness auto-set to 1.0 on mount, restored to previous value on unmount

**Add/Edit Policy Form:**
- Full-screen pushed screen
- Background: `#0A0A0F`
- Form sections grouped on glass cards:
  - "Policy Details" card: provider, policy number, coverage type dropdown, start/end dates
  - "Cost" card: premium amount (currency input), frequency segmented control, deductible
  - "Agent Contact" card: name, phone, email
  - "Notes" card: multiline text
- Save button: full-width, accent background, white text
- Delete button (edit mode only): full-width, `#FF453A` background, destructive style

**Add Document Screen:**
- Document type picker: horizontal pills (Card Front, Card Back, Policy Doc, Declaration Page, Other)
- Capture options: "Take Photo" and "Choose from Library" buttons
- Preview: captured/selected image with crop handles
- Label input: single-line text, optional
- Save button: accent background

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Accessible at `/car/insurance` route (or as a section within vehicle detail page)
- Layout: sidebar navigation (existing), main content area with policy cards
- Cards use glass morphism via `backdrop-filter: blur(16px)` and glass token backgrounds
- Policy detail/edit opens as a side panel
- Insurance card view opens as a lightbox modal with zoom controls
- Document upload via file input (drag-and-drop zone for document images)
- Agent phone rendered as `tel:` link, email as `mailto:` link
- No brightness control on web (browser limitation)
- Share button uses Web Share API if available, falls back to copy-to-clipboard

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (2) with pulsing animation | Initial data fetch from SQLite |
| Empty | Centered shield icon, "No insurance policies added" + "Add Policy" button | No policies for this vehicle |
| Error | "Something went wrong loading insurance data" + retry button | SQLite read failure |
| Success (all active) | Policy cards with green status dots, total premium in header | All policies active with >30 days remaining |
| Success (mixed) | Active cards above, expired cards in collapsed "Past Policies" section | Mix of active and expired policies |
| Expiring soon | Policy card with amber status dot and "Expires in X days" warning | Policy end_date within 30 days |
| Expired | Policy card with red "Expired" badge, warning banner at top | Policy end_date has passed |
| Document missing | Placeholder image with "Image not found" text and "Re-capture" button | Image file deleted from filesystem |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/insurance-engine.test.ts)
- [ ] `getPolicyStatus`: returns "active" when end_date > 30 days from current date
- [ ] `getPolicyStatus`: returns "expiring_soon" when end_date <= 30 days from current date
- [ ] `getPolicyStatus`: returns "expired" when end_date < current date
- [ ] `getPolicyStatus`: returns "expired" when end_date = current date (expires today = expired)
- [ ] `annualizePremium`: returns premium_cents x 12 for monthly frequency
- [ ] `annualizePremium`: returns premium_cents x 4 for quarterly frequency
- [ ] `annualizePremium`: returns premium_cents x 2 for semi_annual frequency
- [ ] `annualizePremium`: returns premium_cents x 1 for annual frequency
- [ ] `annualizePremium`: returns 0 when premium_cents is null
- [ ] `annualizePremium`: returns 0 when premium_cents is 0
- [ ] `getTotalAnnualPremium`: sums annualized premiums for multiple active policies
- [ ] `getTotalAnnualPremium`: excludes expired policies from the total
- [ ] `maskPolicyNumber`: returns last 4 characters visible with dots for the rest (e.g., "SF-1234567" -> "......4567")
- [ ] `maskPolicyNumber`: handles short policy numbers (<= 4 chars) by showing the full number
- [ ] `maskPolicyNumber`: handles empty string by returning empty string
- [ ] `daysUntilExpiration`: returns positive number for future date
- [ ] `daysUntilExpiration`: returns 0 for today
- [ ] `daysUntilExpiration`: returns negative number for past date
- [ ] `coverageTypeLabel`: returns human-readable label for each coverage type enum
- [ ] Zod CreatePolicyInputSchema: accepts valid policy with all required fields
- [ ] Zod CreatePolicyInputSchema: rejects policy where end_date <= start_date
- [ ] Zod CreatePolicyInputSchema: rejects empty provider string
- [ ] Zod CreatePolicyInputSchema: rejects empty policy_number string
- [ ] Zod CreatePolicyInputSchema: rejects invalid coverage_type value
- [ ] Zod CreatePolicyInputSchema: accepts policy with optional fields omitted (premium, deductible, agent info)
- [ ] Zod CreatePolicyInputSchema: rejects negative premium_cents
- [ ] Zod CreatePolicyInputSchema: rejects negative deductible_cents
- [ ] Zod CreateDocumentInputSchema: accepts valid document with required fields
- [ ] Zod CreateDocumentInputSchema: rejects empty image_uri
- [ ] Zod CreateDocumentInputSchema: rejects invalid document_type value

### Integration Tests
- [ ] Full flow: create vehicle, add policy, verify policy persisted in cr_insurance_policies
- [ ] Full flow: add document to policy, verify document persisted in cr_insurance_documents with correct policy_id
- [ ] Full flow: edit policy end_date, verify expiration status recalculates
- [ ] Full flow: delete policy, verify CASCADE-delete removes all associated documents
- [ ] Full flow: delete vehicle, verify CASCADE-delete removes all policies and their documents
- [ ] Full flow: get expiring policies within 30 days, verify correct policies returned
- [ ] Error flow: attempt to create policy with end_date before start_date, verify validation error returned, no record persisted
- [ ] Error flow: attempt to add document with empty image_uri, verify validation error

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Add a new vehicle (2024 Honda Civic). -- Pre-condition.
3. Navigate to Vehicle Detail > Insurance section. Verify empty state shows "No insurance policies added" with "Add Policy" button. -- Corresponds to AC-1.
4. Tap "Add Policy". Verify form opens with all fields visible: provider, policy number, coverage type, start date, end date, premium, frequency, deductible, agent name, agent phone, agent email, notes. -- Corresponds to AC-2.
5. Fill in: provider "State Farm", policy number "SF-1234567", coverage "full_coverage", premium $120, frequency "Monthly", deductible $500, start date today, end date 6 months from now, agent name "John Smith", agent phone "555-0123", agent email "john@statefarm.com".
6. Tap Save. Verify policy card appears with "State Farm", masked number "......4567", "Full Coverage" badge, "$1,440/yr" premium, green status dot. -- Corresponds to AC-3, AC-4, AC-5, AC-6.
7. Verify the Insurance section header shows "Total: $1,440/yr". -- Corresponds to AC-15.
8. Tap the policy card to open detail view. Verify all entered data is displayed.
9. Tap "Add Document". Select document type "Card Front". Capture or select a photo. Add label "2025-2026 card". Save. -- Corresponds to AC-9.
10. Verify the document appears in the document gallery with "Card Front" type and "2025-2026 card" label. -- Corresponds to AC-10.
11. Add a second document: type "Card Back", capture photo.
12. Tap "View Card". Verify full-screen view shows card front and card back images with pinch-to-zoom. -- Corresponds to AC-7.
13. On mobile: verify screen brightness has increased. Navigate back. Verify brightness restored. -- Corresponds to AC-8, NC-5.
14. Tap the agent phone number. Verify the native dialer opens with "555-0123". -- Corresponds to AC-11.
15. Tap "Share" on the card view. Verify native share sheet opens with the card image. -- Corresponds to AC-16.
16. Navigate back to Insurance section. Edit the policy: change end_date to 15 days from now. Save. Verify the status indicator changes to amber. -- Corresponds to AC-12, AC-6.
17. Edit the policy again: change end_date to yesterday. Save. Verify status indicator changes to red. Verify the policy moves to "Past Policies" section. -- Corresponds to AC-6, AC-14.
18. Add a new policy: provider "GEICO", coverage "liability", premium $80/month, end date 1 year from now. Save. Verify it appears as active with green status. -- Verifies multiple policies.
19. Verify header shows total = $960/yr (only the active GEICO policy; expired State Farm excluded from total). -- Corresponds to AC-15.
20. Delete the expired State Farm policy. Verify confirmation dialog appears. Confirm. Verify policy and its documents are removed. -- Corresponds to AC-13.
21. Verify the GEICO policy is unaffected by the deletion. -- Corresponds to NC-3.
22. Navigate back to Vehicle Detail. Delete the vehicle. Verify all policies and documents are removed (no orphaned records). -- Corresponds to TC-12.
23. Add a new vehicle. Add a policy with NO premium, NO deductible, and NO agent info. Verify it saves successfully with defaults. -- Edge case: optional fields.
24. Attempt to save a policy with end_date before start_date. Verify validation error appears. -- Corresponds to TC-2.
25. Attempt to save a policy with empty provider. Verify validation error appears. -- Corresponds to TC-3.
26. Test camera permission denial: deny camera access, attempt to add a document. Verify error message about camera permissions. Verify photo library is offered as fallback. -- Corresponds to NC-7.
27. Repeat steps 3-21 on web at `/car/insurance`. Verify functional parity (minus brightness control and phone dialer). -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's Insurance section, click every button, verify all 5 states (loading, empty, error, success-active, success-mixed/expired)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `insurance-engine.ts` (getPolicyStatus, annualizePremium, getTotalAnnualPremium, maskPolicyNumber, daysUntilExpiration)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has 5 tables: cr_vehicles, cr_maintenance, cr_fuel_logs, cr_settings, cr_maintenance_schedules
- Schema version 2, migrations V1 and V2
- No insurance tracking, no document storage, no policy management capability
- Vehicle detail screen shows vehicle info, maintenance history, and fuel logs but no insurance data
- The reminder engine exists for maintenance schedules but is not wired to insurance expiration

### After This Work
- Car module has 7 tables (new: cr_insurance_policies, cr_insurance_documents) with 3 new indexes
- Schema version incremented (V3 or V4 depending on whether trip log ships first), new migration added
- Full insurance lifecycle: add policies with structured fields, store document photos, view insurance cards quickly, track expiration status, edit, delete with CASCADE
- Insurance engine with premium annualization, expiration status, policy masking, and total premium calculation
- Vehicle detail screen has an Insurance section with policy cards and quick-access card viewer
- Dashboard has "Insurance Card" quick-action for the primary vehicle
- Document gallery for each policy with camera capture and photo library support

### Files Changed

- `modules/car/src/types.ts` -- Add CoverageTypeSchema, PremiumFrequencySchema, DocumentTypeSchema, InsurancePolicySchema, InsuranceDocumentSchema, CreatePolicyInputSchema, CreateDocumentInputSchema Zod schemas and types
- `modules/car/src/db/schema.ts` -- Add CREATE_INSURANCE_POLICIES and CREATE_INSURANCE_DOCUMENTS table definitions and 3 index definitions
- `modules/car/src/db/crud.ts` -- Add createPolicy, getPoliciesByVehicle, getPolicyById, updatePolicy, deletePolicy, createDocument, getDocumentsByPolicy, deleteDocument, getExpiringPolicies
- `modules/car/src/engines/insurance-engine.ts` -- NEW: getPolicyStatus, annualizePremium, getTotalAnnualPremium, maskPolicyNumber, daysUntilExpiration, coverageTypeLabel, premiumFrequencyLabel
- `modules/car/src/definition.ts` -- Add new migration, update schemaVersion
- `modules/car/src/index.ts` -- Re-export new types and engine functions
- `modules/car/src/__tests__/insurance-engine.test.ts` -- NEW: 30+ unit tests for insurance engine
- `apps/mobile/app/(car)/insurance.tsx` -- NEW: Insurance overview screen
- `apps/mobile/app/(car)/add-policy.tsx` -- NEW: Add/Edit policy form
- `apps/mobile/app/(car)/insurance-card.tsx` -- NEW: Quick-access insurance card viewer
- `apps/mobile/app/(car)/add-insurance-doc.tsx` -- NEW: Add document photo screen
- `apps/web/app/car/insurance/page.tsx` -- NEW: Insurance management web page
- `apps/web/app/car/insurance/actions.ts` -- NEW: Server actions for insurance operations

### Known Limitations
- Push notifications for expiring policies are a stretch goal for V1. In-app status indicators (green/amber/red) are the core requirement. A follow-up ticket should wire expiration alerts into the existing reminder engine or expo-notifications.
- No OCR or automatic extraction of policy data from document images. All fields are manually entered.
- No integration with insurance quote APIs or comparison services (privacy-first design; no data sharing with insurers).
- Document images are stored as local file URIs. They are not backed up to iCloud or Google Drive. If the user uninstalls the app, document images are lost unless the user has device-level backups.
- Image compression targets 2MB max JPEG. Very high-resolution photos of multi-page documents may lose detail. Users should capture one page per document entry.
- No PDF support for policy documents. Only image files (JPEG, PNG) are supported in V1.

### Context for Next Agent
- The CoverageTypeSchema is a standalone enum, not related to MaintenanceTypeSchema or ScheduleServiceTypeSchema. They are intentionally independent.
- The cr_insurance_documents table uses CASCADE delete on policy_id, and cr_insurance_policies uses CASCADE delete on vehicle_id. This creates a two-level cascade: deleting a vehicle removes policies, which removes documents. Test this chain explicitly.
- The `maskPolicyNumber` function should handle edge cases: empty strings, strings shorter than 4 characters (show full number), and strings with special characters (mask everything except last 4).
- The `image_uri` field stores a local filesystem path. On mobile this is typically `file:///...`. On web this may be a blob URL or a relative path. The CRUD layer should not validate the URI format -- leave that to the UI layer.
- Premium amounts are stored as INTEGER cents (e.g., $120.00 = 12000). The UI layer is responsible for formatting to dollars. The engine functions work in cents.
- The quick-access card view brightness behavior (`expo-brightness`) requires the `SYSTEM_BRIGHTNESS` permission on Android. Handle the case where the permission is denied gracefully -- just skip the brightness adjustment.
- If the trip log feature (CR-007) ships as V3, this feature should use V4. If they ship simultaneously, coordinate the migration version. The migration runner handles sequential version numbers, so they must not both claim V3.
