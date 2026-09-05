# Feature Spec: Breed-Specific Health Alerts

## Metadata
- **Module:** pets
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Pet profile CRUD (V1 -- species, breed, birth_date fields on `pt_pets`)
- **Blocks:** None

## Business Context

### Why This Feature Exists
Pet owners often learn about breed-specific health risks only after a problem appears, when earlier awareness could have prompted proactive vet conversations and screening. The existing `engine/alerts.ts` already has `getBreedHealthAlerts(species, breed)` returning `BreedHealthAlert[]`, but it covers only 7 breeds (4 dog, 3 cat) with minimal conditions, has no age-relevant filtering, and offers no way for users to track which alerts they have reviewed. This feature expands breed coverage to 45 breeds (30 dog + 15 cat) with 80+ conditions, adds age-relevant alert filtering based on the pet's current age vs. screening ages, and introduces a dismissal system so users can acknowledge alerts without losing them permanently.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | No | N/A | No breed-specific health data; general pet profiles only |
| PetDesk | No | N/A | Vet-practice-managed; no breed intelligence features |
| Pawp | Partial | Premium ($24/mo) | Vet telehealth mentions breed risks during consultations, no standalone alerts |
| FitBark | No | N/A | Activity/sleep tracking only, no health alert system |
| Dogo | No | N/A | Training-focused, no health intelligence |
| Pupford | Partial | Free content | Blog articles on breed health but no personalized in-app alerts |

### Target User
Dog and cat owners who want proactive health awareness for their specific breed. First-time pet owners who do not know what conditions their breed is predisposed to, and experienced owners who want reminders about age-appropriate screening discussions. Currently these users rely on vet visits (reactive) or web searches (unstructured). This feature surfaces curated, breed-specific, age-relevant health information inside the pet's profile without requiring an internet connection.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/engine/alerts.ts              -- ENHANCED: expand breed data, add age filtering, dismissed alert logic
modules/pets/src/db/schema.ts                  -- V4 migration: pt_dismissed_alerts table
modules/pets/src/definition.ts                 -- Add PETS_MIGRATION_V4
modules/pets/src/types.ts                      -- New types: DismissedAlert, AgeRelevantAlert
modules/pets/src/db/crud.ts                    -- New CRUD: dismissAlert, getDismissedAlerts, undismissAlert
modules/pets/src/index.ts                      -- Re-export new public API
modules/pets/src/__tests__/alerts.test.ts      -- Engine + CRUD tests
apps/mobile/app/(pets)/components/AlertCard.tsx -- Severity-colored alert card component
apps/web/app/pets/[petId]/health/page.tsx      -- Web health alerts section
```

### Wireframe Position

```
Hub Dashboard
  +-- MyPets card
       +-- Pets tab (pet list)
            +-- Pet Detail
                 +-- Health tab
                      +-- Breed Health Alerts section <-- YOU ARE HERE
```

The breed health alerts section appears on the pet detail screen within the "Health" tab, above vet visit history and vaccination records. Alerts are displayed as severity-colored cards with a "Talk to your vet" disclaimer banner at the top.

### Data Model

V4 migration adds one new table for tracking dismissed alerts:

```sql
-- V4 Migration: Dismissed breed health alerts

CREATE TABLE IF NOT EXISTS pt_dismissed_alerts (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  alert_id TEXT NOT NULL,
  dismissed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(pet_id, alert_id)
);

-- Index
CREATE INDEX IF NOT EXISTS pt_dismissed_alerts_pet_idx
  ON pt_dismissed_alerts(pet_id);
```

The `alert_id` column stores the computed alert ID from `getBreedHealthAlerts()` (format: `species:breedKey:index`, e.g., `dog:golden retriever:0`). Since breed alerts are static data (not user-created), only the dismissal state needs persistence.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter, Migration), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** None. Breed health data is static and bundled in the app. No external API calls.
- **Cross-Module:** Health module (future) -- breed health alerts could surface in a cross-module "Health Summary" if the user has both Pets and Health modules enabled. For now, alerts live exclusively in the Pets module.

## Functional Requirements

### User Stories
1. As a pet owner, I want to see breed-specific health conditions for my pet so that I can have informed conversations with my vet about preventive screening.
2. As a pet owner, I want alerts filtered by my pet's current age so that I see only conditions relevant to their life stage (e.g., hip screening at 12-24 months, not for a 3-month-old puppy).
3. As a pet owner, I want to dismiss an alert I have reviewed so that it moves out of my active alerts view without being permanently deleted.
4. As a pet owner, I want to un-dismiss a previously dismissed alert so that I can bring it back to my attention if needed.
5. As an owner of a mixed-breed or unknown-breed pet, I want to see general species-level alerts so that I still get some health awareness without breed specificity.
6. As a pet owner, I want a clear disclaimer that alerts are informational and not a substitute for veterinary advice so that I do not misinterpret them as diagnoses.

### Behavior Specification

**Viewing breed health alerts:**
1. User navigates to a pet's detail screen and selects the "Health" tab
2. System retrieves the pet's species and breed from the profile
3. System calls enhanced `getBreedHealthAlerts()` with species and breed
4. System calls `getAgeRelevantAlerts()` to filter by pet's current age
5. System calls `getDismissedAlerts()` to partition dismissed vs. active
6. A disclaimer banner appears at the top: "These alerts are informational. Always consult your veterinarian for medical decisions."
7. Active alerts display as severity-colored cards below the disclaimer
8. Dismissed alerts are collapsed in an "Already Reviewed" section at the bottom

**Alert card display:**
1. Each card shows: condition name (bold), description, screening age, screening frequency, severity badge
2. Severity colors: informational = blue (`#0A84FF`), moderate = amber (`#F59E0B`), serious = red (`#FF453A`)
3. A "Dismiss" button on each active card
4. An "Undo" button on each dismissed card in the "Already Reviewed" section

**Dismissing an alert:**
1. User taps "Dismiss" on an active alert card
2. System creates a `pt_dismissed_alerts` record with the alert_id and current timestamp
3. Card animates out of the active section
4. Card appears in the collapsed "Already Reviewed" section
5. If all alerts are dismissed, the active section shows "All alerts reviewed" with a checkmark

**Un-dismissing an alert:**
1. User expands the "Already Reviewed" section
2. User taps "Undo" on a dismissed alert
3. System deletes the `pt_dismissed_alerts` record
4. Card moves back to the active alerts section

**Age-relevant filtering:**
1. System calculates the pet's current age from `birth_date`
2. Alerts with a `screeningAge` value are parsed for numeric ranges (e.g., "12-24 months", "7+ years")
3. If the pet's current age falls within or past the screening age range, the alert is marked as "age-relevant"
4. Alerts that are not yet age-relevant are shown in a separate "Future Screenings" subsection with reduced opacity
5. If `birth_date` is null, all alerts are shown without age filtering (cannot determine relevance)

### Edge Cases

- **Unknown breed (null or empty):** Show species-general alerts only (generic dog or cat conditions like dental disease, obesity). Do not show "No alerts" -- provide general guidance.
- **Mixed breed:** The breed key "mixed" or "mixed breed" maps to a curated list of common cross-breed conditions (obesity, dental disease, joint issues).
- **Species with no alerts (bird, fish, reptile, rabbit, small_mammal, horse, other):** Show "No breed-specific alerts available for [species]" with a note that the feature currently covers dogs and cats.
- **No alerts for a specific breed:** Show species-general alerts as fallback. Display a note: "No breed-specific data available for [breed]. Showing general [species] health information."
- **All alerts dismissed:** Active section shows "All alerts reviewed" with green checkmark. "Already Reviewed" section remains expandable.
- **Pet has no birth_date:** Skip age-relevant filtering. Show all alerts for the breed without the "Future Screenings" subsection.
- **Very young pet (under 3 months):** Most screening alerts are future-dated. Show them in "Future Screenings" with estimated age for relevance.
- **Pet is archived:** Alerts are still viewable but "Dismiss" buttons are hidden.
- **Breed name casing/spacing variations:** `normalizeBreedKey()` already handles this (trim, lowercase). Ensure "Golden Retriever", "golden retriever", " Golden Retriever " all map to the same alerts.
- **Pet deleted:** CASCADE deletes all dismissed alert records.
- **Module disabled:** Routes removed, dismissed alerts data preserved.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Health tab on pet detail shows breed-specific alerts as severity-colored cards
- [ ] **AC-2:** Disclaimer banner appears at the top: "These alerts are informational. Always consult your veterinarian for medical decisions."
- [ ] **AC-3:** Alert cards show condition name, description, screening age, screening frequency, and severity badge
- [ ] **AC-4:** Severity colors render correctly: informational=blue, moderate=amber, serious=red
- [ ] **AC-5:** User can dismiss an active alert, which moves it to the "Already Reviewed" section
- [ ] **AC-6:** User can un-dismiss a reviewed alert, which moves it back to the active section
- [ ] **AC-7:** When all alerts are dismissed, active section shows "All alerts reviewed" with checkmark
- [ ] **AC-8:** Age-relevant filtering shows only screening-appropriate alerts as active, with future ones in a "Future Screenings" subsection
- [ ] **AC-9:** Pets with null birth_date show all alerts without age filtering
- [ ] **AC-10:** Unknown or mixed breed pets show species-general alerts
- [ ] **AC-11:** Non-dog/non-cat species show "No breed-specific alerts available" message

### Technical Criteria
- [ ] **TC-1:** V4 migration creates `pt_dismissed_alerts` table with UNIQUE(pet_id, alert_id) constraint
- [ ] **TC-2:** V4 migration is idempotent (CREATE TABLE IF NOT EXISTS) and has correct down migration
- [ ] **TC-3:** `getBreedHealthAlerts()` covers 30+ dog breeds and 15+ cat breeds
- [ ] **TC-4:** `getAgeRelevantAlerts()` correctly parses screening age ranges and classifies alerts by pet's current age
- [ ] **TC-5:** `dismissAlert()` creates a record and respects UNIQUE constraint (no duplicate dismissals)
- [ ] **TC-6:** `undismissAlert()` deletes the dismissal record and the alert reappears
- [ ] **TC-7:** `getDismissedAlerts()` returns all dismissed alert IDs for a pet
- [ ] **TC-8:** Alert IDs are deterministic (same breed always produces same alert IDs)
- [ ] **TC-9:** `normalizeBreedKey()` handles casing, whitespace, and empty strings correctly

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Dismissing an alert for one pet must NOT affect the same alert for another pet of the same breed (data isolation)
- [ ] **NC-2:** Deleting a pet must NOT leave orphaned dismissed alert records (CASCADE)
- [ ] **NC-3:** Breed health alerts must NOT be presented as diagnoses or medical advice (disclaimer required)
- [ ] **NC-4:** Disabling the Pets module must NOT delete dismissed alert data
- [ ] **NC-5:** Alert operations must NOT send network requests (offline-first, local-only)
- [ ] **NC-6:** The engine must NOT crash on unrecognized breed names (graceful fallback to species-general alerts)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Disclaimer banner:** `rgba(10,132,255,0.12)` background with `#0A84FF` (iOS system blue) text and info icon, 12px border radius
- **Alert cards:** `rgba(255,255,255,0.04)` (glass token) fill with `rgba(255,255,255,0.10)` (glassBorder) border, 12px border radius
- **Severity badge (informational):** `rgba(10,132,255,0.15)` background, `#0A84FF` text
- **Severity badge (moderate):** `rgba(245,158,11,0.15)` background, `#F59E0B` text
- **Severity badge (serious):** `rgba(255,69,58,0.15)` background, `#FF453A` text
- **Severity left border accent:** 3px left border in the severity color on each card
- **Dismiss button:** Ghost style, `rgba(240,240,245,0.65)` (textSecondary) text
- **"All alerts reviewed" state:** `rgba(48,209,88,0.12)` background with `#30D158` (success) checkmark and text
- **"Already Reviewed" section:** Collapsible header with chevron, collapsed by default
- **"Future Screenings" subsection:** Cards at 50% opacity with "Not yet age-relevant" label
- **Module accent:** `#F59E0B` (amber) used sparingly for section headers
- **Layout:** ScrollView within Health tab: disclaimer banner, active alerts, future screenings (conditional), already reviewed (collapsible)

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Alerts section renders within the existing pet health page at `/pets/[petId]/health`
- Alert cards use CSS `backdrop-filter: blur(12px)` for glass effect
- Severity left border uses `border-left: 3px solid [severity-color]`
- "Already Reviewed" section uses a `<details>` element for native collapsible behavior
- Dismiss/Undo buttons use CSS transitions (200ms ease) for hover states

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | 3 skeleton alert cards with pulsing animation | Initial data fetch |
| No Breed | "Set your pet's breed to see health alerts" with edit profile link | Pet has no breed set |
| No Alerts (unsupported species) | "No breed-specific alerts available for [species]" info message | Non-dog/non-cat species |
| Active Alerts | Disclaimer banner + severity-colored alert cards with Dismiss buttons | Alerts exist, some not dismissed |
| Mixed Active + Dismissed | Active cards + collapsed "Already Reviewed" section | Some alerts dismissed |
| All Reviewed | "All alerts reviewed" banner with green checkmark + "Already Reviewed" section | All alerts dismissed |
| Age-Filtered | Active alerts + "Future Screenings" subsection at reduced opacity | Pet has birth_date and some alerts are age-gated |
| Error | Toast: "Could not load health alerts." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/alerts.ts)
- [ ] `getBreedHealthAlerts`: returns alerts for "golden retriever" (dog) with correct fields
- [ ] `getBreedHealthAlerts`: returns alerts for "labrador retriever" (new breed) after data expansion
- [ ] `getBreedHealthAlerts`: returns alerts for "maine coon" (cat) with correct severity levels
- [ ] `getBreedHealthAlerts`: returns alerts for "persian" (cat) including PKD
- [ ] `getBreedHealthAlerts`: returns empty array for null breed
- [ ] `getBreedHealthAlerts`: returns empty array for empty string breed
- [ ] `getBreedHealthAlerts`: normalizes "GOLDEN RETRIEVER" to match "golden retriever"
- [ ] `getBreedHealthAlerts`: normalizes " golden retriever " (with whitespace) correctly
- [ ] `getBreedHealthAlerts`: returns species-general alerts for "mixed" breed
- [ ] `getBreedHealthAlerts`: returns species-general alerts for unrecognized breed
- [ ] `getBreedHealthAlerts`: returns empty array for unsupported species (bird, fish, etc.)
- [ ] `getBreedHealthAlerts`: alert IDs are deterministic (same input produces same IDs)
- [ ] `getAgeRelevantAlerts`: filters alerts for a 6-month-old puppy (hides "7+ years" alerts)
- [ ] `getAgeRelevantAlerts`: shows all alerts for a 10-year-old dog (all screening ages passed)
- [ ] `getAgeRelevantAlerts`: handles "12-24 months" range correctly at 12 months
- [ ] `getAgeRelevantAlerts`: handles "Any age" screening age (always relevant)
- [ ] `getAgeRelevantAlerts`: returns all alerts when birth_date is null (no filtering)
- [ ] `getAgeRelevantAlerts`: handles "Adult years" as 1+ years

### Integration Tests (CRUD)
- [ ] `dismissAlert`: creates a record in `pt_dismissed_alerts`
- [ ] `dismissAlert`: rejects duplicate dismissal for same pet+alert (UNIQUE constraint)
- [ ] `getDismissedAlerts`: returns all dismissed alert IDs for a pet
- [ ] `getDismissedAlerts`: returns empty array for pet with no dismissals
- [ ] `undismissAlert`: removes the dismissal record
- [ ] `undismissAlert`: no error when dismissal does not exist (idempotent)
- [ ] Delete pet cascades to dismissed alert records
- [ ] Dismissed alerts for pet A do not appear for pet B (data isolation)
- [ ] V4 migration runs cleanly on existing V3 database

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Create a pet: "Buddy", dog, golden retriever, birth date = 2 years ago
4. Navigate to pet detail, select "Health" tab
5. **Verify disclaimer:** "These alerts are informational..." banner visible at top -- AC-2
6. **Verify alerts:** Hip dysplasia (serious, red) and Lymphoma (moderate, amber) cards visible -- AC-1, AC-3, AC-4
7. **Verify severity colors:** Hip dysplasia has red left border and red severity badge, Lymphoma has amber -- AC-4
8. Tap "Dismiss" on the Hip dysplasia card
9. **Verify dismissal:** Card moves to "Already Reviewed" section -- AC-5
10. Expand "Already Reviewed" section
11. **Verify dismissed card:** Hip dysplasia visible with "Undo" button -- AC-5
12. Tap "Undo" on Hip dysplasia
13. **Verify un-dismiss:** Card returns to active section -- AC-6
14. Dismiss all alerts
15. **Verify all reviewed:** "All alerts reviewed" banner with green checkmark -- AC-7
16. Create a second pet: "Kitten", cat, maine coon, birth date = 3 months ago
17. Navigate to Kitten's Health tab
18. **Verify age filtering:** HCM alert may appear in "Future Screenings" subsection if screening age is 1-7 years -- AC-8
19. Create a third pet: "Tweety", bird, breed = null
20. Navigate to Tweety's Health tab
21. **Verify unsupported species:** "No breed-specific alerts available for bird" message -- AC-11
22. Create a fourth pet: "Mutt", dog, breed = "mixed"
23. Navigate to Mutt's Health tab
24. **Verify mixed breed:** Species-general dog alerts appear -- AC-10
25. **Verify data isolation:** Dismissing an alert for Buddy does NOT affect Mutt's alerts -- NC-1

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Large features:
- [ ] `/plan-eng-review` -- review this spec before building

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] `/qa` -- run after building, comprehensive QA pass on the health alerts section

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for age-relevant filtering logic

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `engine/alerts.ts` has `getBreedHealthAlerts(species, breed)` returning `BreedHealthAlert[]`
- Static breed data covers 7 breeds only: golden retriever, german shepherd, french bulldog, beagle (dogs); maine coon, siamese, persian (cats)
- `BreedHealthAlertSchema` and `BreedHealthAlert` type exist in `types.ts`
- `normalizeBreedKey()` exists and handles casing/whitespace
- No age-relevant filtering
- No alert dismissal system
- No V4 migration
- No dedicated health alerts UI component

### After This Work
- V4 migration adds `pt_dismissed_alerts` table with UNIQUE(pet_id, alert_id) constraint
- `PETS_MIGRATION_V4` added to module definition migrations array
- Breed data expanded to 30 dog breeds and 15 cat breeds with 80+ conditions
- Species-general alerts added for "mixed" breed and unrecognized breeds
- New engine functions: `getAgeRelevantAlerts()`, age range parsing
- New CRUD: `dismissAlert()`, `getDismissedAlerts()`, `undismissAlert()`
- New types: `DismissedAlertSchema`, `AgeRelevantAlert` interface
- Alert card component with severity-based styling
- Health tab integration on mobile and web
- 25+ new tests covering expanded breed data, age filtering, and dismissal CRUD

### Files Changed

- `modules/pets/src/engine/alerts.ts` -- Expanded breed data (30 dogs, 15 cats), species-general fallback, `getAgeRelevantAlerts()`, age range parsing
- `modules/pets/src/db/schema.ts` -- V4 DDL: `CREATE TABLE pt_dismissed_alerts`, index
- `modules/pets/src/definition.ts` -- Add PETS_MIGRATION_V4 to migrations array
- `modules/pets/src/types.ts` -- New: DismissedAlertSchema, AgeRelevantAlert interface
- `modules/pets/src/db/crud.ts` -- New CRUD: dismissAlert, getDismissedAlerts, undismissAlert
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/alerts.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/components/AlertCard.tsx` -- Severity-colored alert card component
- `apps/web/app/pets/[petId]/health/page.tsx` -- Web health alerts section

### Known Limitations
- Breed health data is static and bundled in the app. It does not update from an external source. Adding new breeds or conditions requires a code change and app update.
- Age-relevant filtering parses natural language screening age strings (e.g., "12-24 months", "7+ years", "Adult years", "Any age"). This covers common patterns but may not handle every possible string format perfectly. The parser should default to "always relevant" for unparseable values.
- Dismissed alerts are tied to the alert's computed ID (`species:breedKey:index`). If the breed data changes (new conditions added, order changes), dismissed states may become stale. The UI should handle unknown dismissed IDs gracefully (ignore them).
- No notification system for age-milestone alerts (e.g., "Buddy is now 12 months old, time for hip screening"). This is a future enhancement.
- Coverage is limited to dogs and cats. Other species (bird, fish, reptile, rabbit, small_mammal, horse) show a generic "not available" message.

### Context for Next Agent
- The existing `BREED_ALERTS` object in `engine/alerts.ts` is a `Partial<Record<PetSpecies, Record<string, AlertSeed[]>>>`. Expand by adding more breed keys under `dog:` and `cat:`. Add a special `_general` key under each species for species-general fallback alerts.
- The existing `getBreedHealthAlerts()` function maps `AlertSeed` objects to `BreedHealthAlert` objects with computed IDs. The ID format `species:breedKey:index` must remain stable for dismissed alert matching. When adding new conditions to an existing breed, append to the end of the array to avoid shifting existing IDs.
- `getAgeRelevantAlerts()` should be a new exported function that takes a list of `BreedHealthAlert[]` and a `birthDate: string | null` parameter. It should return a partitioned result: `{ relevant: BreedHealthAlert[]; future: BreedHealthAlert[] }`. If `birthDate` is null, all alerts go to `relevant`.
- For age parsing, implement a helper `parseScreeningAge(screeningAge: string | null): { minMonths: number | null; maxMonths: number | null }`. Handle patterns: "Any age" (0, null), "Adult years" (12, null), "N+ years" (N*12, null), "N-M months" (N, M), "N-M years" (N*12, M*12). Default unparseable to (0, null) (always relevant).
- The `pt_dismissed_alerts` table uses `alert_id TEXT` matching the computed ID from `getBreedHealthAlerts()`. Use `INSERT OR IGNORE` for `dismissAlert()` to handle UNIQUE constraint gracefully.
