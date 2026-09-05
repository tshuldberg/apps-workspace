# Feature Spec: Pet Sitter Info Card Enhancements

## Metadata
- **Module:** pets
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 1 x1
- **Sprint:** 3
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Pet profile CRUD (V1), Feeding schedule (V1/V3), Emergency contacts (V2), Medications (V1), Dietary info (V3)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The `buildPetSitterCard()` function in `crud.ts` already assembles a `PetSitterCard` object containing pet info, active medications, feeding schedules, emergency contacts, and breed alerts. The `formatPetSitterCard()` function in `engine/export.ts` renders this as a plain-text summary. However, the output is a simple text block that cannot be printed nicely, shared via iMessage/SMS, or displayed as a visually appealing card. Pet owners going on vacation need to hand off care instructions to pet sitters in a format that is easy to read, print, and reference. This feature enhances the existing export pipeline with HTML (printable), plain text (shareable via messages), and clipboard copy, plus adds dietary info and special instructions to the card content.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | Yes | Premium ($20/yr) | PDF export of pet profile with health records, shareable link |
| PetDesk | Partial | Free | Vet-practice sharing only, no standalone pet sitter card |
| Pawp | No | N/A | Vet telehealth focus, no export/sharing features |
| FitBark | No | N/A | Activity data only, no care instructions export |
| Dogo | No | N/A | Training-only, no sitter handoff |
| Pupford | No | N/A | Content platform, no pet management data |

### Target User
Pet owners preparing for travel, work trips, or any absence where someone else (pet sitter, family member, neighbor, boarding facility) needs care instructions. Also pet owners with complex care needs (multiple medications, dietary restrictions, breed-specific alerts) who want a comprehensive reference document always available. Users currently screenshot their app or type up care instructions manually.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/engine/export.ts                -- Enhanced: generatePetSitterHtml, generatePetSitterText
modules/pets/src/db/crud.ts                      -- Enhanced: buildPetSitterCard includes dietary info
modules/pets/src/types.ts                        -- Enhanced: PetSitterCard adds dietaryInfo and specialInstructions
modules/pets/src/index.ts                        -- Re-export new functions
modules/pets/src/__tests__/export.test.ts        -- Engine tests for new generators
apps/mobile/app/(pets)/sitter-card.tsx           -- Sitter card preview + share screen
apps/web/app/pets/[petId]/sitter-card/page.tsx   -- Web sitter card page with print
```

### Wireframe Position

```
Hub Dashboard
  +-- MyPets card
       +-- Multi-Pet Dashboard
       +-- Pet Detail
       |    +-- Overview
       |    +-- Health tab
       |    +-- Reminders tab
       |    +-- Sitter Card  <-- YOU ARE HERE
       |         +-- Card preview
       |         +-- Share / Print / Copy actions
       +-- Settings
```

### Data Model

No new tables. This feature reads existing data and enhances the `PetSitterCard` interface:

```sql
-- Reads from existing tables (no schema changes):
-- pt_pets               -- name, species, breed, birth_date, current_weight_grams, image_uri
-- pt_medications        -- active medications with dosage, frequency
-- pt_feeding_schedules  -- meal times, food names, portions
-- pt_emergency_contacts -- clinic name, phone, address
-- pt_dietary_info       -- allergies, restrictions, special_instructions (V3)
-- pt_grooming_records   -- next_due_date for upcoming grooming notes (informational)
```

Enhanced `PetSitterCard` interface (code-level, not SQL):
```typescript
interface PetSitterCard {
  pet: Pet;
  activeMedications: Medication[];
  feedingSchedules: FeedingSchedule[];
  emergencyContacts: EmergencyContact[];
  breedAlerts: BreedHealthAlert[];
  dietaryInfo: DietaryInfo | null;       // NEW: allergies, restrictions, special instructions
  petAgeDisplay: string | null;          // NEW: computed "3 years, 2 months" or null
  weightDisplay: string | null;          // NEW: formatted "32.5 lbs (14.7 kg)" or null
}
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (Cool Obsidian tokens), existing engine functions (`calculatePetAgeYears` from `engine/weight.ts`, `getBreedHealthAlerts` from `engine/alerts.ts`)
- **External:** `expo-sharing` (system share sheet on mobile), no external APIs
- **Cross-Module:** None. Self-contained within pets module.

## Functional Requirements

### User Stories
1. As a pet owner, I want to generate a printable HTML care card for my pet sitter that includes all essential info (feeding schedule, medications, emergency contacts, dietary restrictions) in a clean, readable layout.
2. As a pet owner, I want to share my pet's care card as plain text via iMessage, SMS, or email so that my pet sitter has all the info in one message.
3. As a pet owner, I want to copy the care card to my clipboard so that I can paste it into any app.
4. As a pet owner, I want the card to include dietary restrictions and allergies prominently so that my sitter knows what foods to avoid.
5. As a pet owner, I want the card to show breed-specific health alerts so that my sitter knows what symptoms to watch for.

### Behavior Specification

**Generating the sitter card:**
1. User navigates to a pet's detail screen
2. User taps "Sitter Card" action (button or menu item)
3. System calls `buildPetSitterCard()` to assemble all data (now includes dietary info)
4. System renders a preview of the card on screen
5. Card shows sections: pet photo + basic info, feeding schedule with portions, dietary restrictions/allergies (highlighted), active medications with dosage/frequency, emergency contacts, breed health alerts, special instructions

**Sharing as text:**
1. User taps "Share" button on the sitter card preview
2. System calls `generatePetSitterText()` to produce a plain-text version
3. System opens the OS share sheet with the text content
4. User can send via iMessage, SMS, email, or any share target

**Sharing as HTML (print):**
1. User taps "Print" button on the sitter card preview
2. System calls `generatePetSitterHtml()` to produce a styled HTML document
3. On mobile: system opens the print dialog via `expo-print`
4. On web: system opens the browser print dialog via `window.print()` with a print-specific stylesheet

**Copying to clipboard:**
1. User taps "Copy" button on the sitter card preview
2. System calls `generatePetSitterText()` and copies to clipboard
3. Toast: "Care card copied to clipboard"

### Edge Cases

- **Pet with no medications:** Hide the "Medications" section entirely. Do not show "No active medications" (the sitter does not need to see empty sections).
- **Pet with no feeding schedule:** Hide the "Feeding Schedule" section. Show a warning at the top: "No feeding schedule set up. Add one before sharing."
- **Pet with no emergency contacts:** Show a prominent warning: "No emergency contacts. Add at least one before sharing." Do not block sharing, but make the warning visible.
- **Pet with no dietary info:** Hide the "Dietary Restrictions" section.
- **Pet with no breed alerts:** Hide the "Breed Health Notes" section.
- **Very long special instructions (1000+ chars):** In text format, include in full. In HTML format, include in full (no truncation). In the preview UI, show first 200 chars with "Show more" toggle.
- **Pet with no photo:** Use a species emoji as the avatar in the HTML card header.
- **Pet with null birth date:** Omit age from the card (show "Age: Unknown").
- **Pet with null weight:** Omit weight from the card header.
- **All sections empty (just a pet name):** Card still generates with just the pet header. Show a banner: "This care card is sparse. Add feeding, medications, and contacts for a complete card."
- **HTML card viewed on narrow screen:** HTML layout is responsive, single column at all widths (designed for printing).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Sitter card preview shows pet photo (or species emoji), name, breed, age, and weight
- [ ] **AC-2:** Feeding schedule section shows each meal with time, food name, and portion
- [ ] **AC-3:** Dietary restrictions section shows allergies (highlighted) and restrictions
- [ ] **AC-4:** Medications section shows each active medication with name, dosage, and frequency
- [ ] **AC-5:** Emergency contacts section shows clinic name, phone, and address
- [ ] **AC-6:** Breed health alerts section shows condition name and description
- [ ] **AC-7:** User can share the card as plain text via the system share sheet
- [ ] **AC-8:** User can print the card as a styled HTML document
- [ ] **AC-9:** User can copy the card text to clipboard with confirmation toast
- [ ] **AC-10:** Sections with no data are hidden (not shown as empty)
- [ ] **AC-11:** Warning shows when emergency contacts are missing

### Technical Criteria
- [ ] **TC-1:** `buildPetSitterCard()` now includes `dietaryInfo` (from `pt_dietary_info`) and computed `petAgeDisplay` and `weightDisplay`
- [ ] **TC-2:** `generatePetSitterHtml()` returns valid, self-contained HTML with inline CSS (no external dependencies)
- [ ] **TC-3:** `generatePetSitterText()` returns clean plain text with section headers and bullet points
- [ ] **TC-4:** HTML output is print-friendly (max-width: 700px, serif body font, appropriate margins, no background colors on print)
- [ ] **TC-5:** Text output is under 4000 characters for a typical pet (iMessage limit consideration)
- [ ] **TC-6:** No new database tables or migrations required
- [ ] **TC-7:** `buildPetSitterCard()` queries are efficient (no N+1, reuses existing CRUD functions)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** HTML card must NOT include external CSS, JavaScript, or image URLs (self-contained document)
- [ ] **NC-2:** Sitter card must NOT include archived medication data (active only)
- [ ] **NC-3:** Sharing must NOT require network access (all data is local)
- [ ] **NC-4:** Printing must NOT include app chrome, navigation, or buttons (print stylesheet hides UI)
- [ ] **NC-5:** Card generation must NOT modify any data (read-only operation)
- [ ] **NC-6:** Must NOT truncate medication or dietary info in the shared/printed versions (full data always)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Card preview container:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 16px border radius, 20px padding
- **Pet header:** Pet photo (80px circle) or species emoji on `rgba(255,255,255,0.08)` circle. Name in `#F0F0F5` 20px semibold. Breed, age, weight in `rgba(240,240,245,0.65)` 14px.
- **Section headers:** `#F59E0B` (module accent) 14px uppercase tracking-wide, with a thin `rgba(255,255,255,0.06)` divider below
- **Allergy tags:** `rgba(255,69,58,0.12)` background with `#FF453A` text, rounded pill shape
- **Restriction tags:** `rgba(245,158,11,0.12)` background with `#F59E0B` text, rounded pill shape
- **Action buttons:** Row at bottom of screen. Share, Print, Copy -- each as a glass pill button (`rgba(255,255,255,0.08)` fill, `rgba(255,255,255,0.10)` border, icon + label). Primary share button uses `#F59E0B` fill.
- **Missing data warning:** `rgba(245,158,11,0.08)` banner with `#F59E0B` icon and text.
- **Layout:** ScrollView with card preview + action bar fixed at bottom.

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Sitter card page at `/pets/[petId]/sitter-card` route
- Sidebar navigation: "Sitter Card" as a sub-nav item under pet detail
- Card preview centered on page, max-width 600px
- Action buttons as a sticky toolbar above the card
- Print button triggers `window.print()` with `@media print` stylesheet that hides nav, sidebar, action bar
- Share button uses Web Share API (`navigator.share`) with fallback to copy-to-clipboard
- Glass cards use CSS `backdrop-filter: blur(12px)`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton card with pulsing sections | Initial data assembly |
| Full card | All sections populated with data | Pet has feeding, meds, contacts, dietary info |
| Sparse card | Only pet header + warning banner | Pet has no feeding/meds/contacts |
| Missing contacts | Card + amber warning: "No emergency contacts" | No emergency contacts for pet |
| Missing feeding | Card + amber warning: "No feeding schedule" | No feeding schedule for pet |
| Sharing | System share sheet overlay | User taps Share |
| Printing | Print dialog | User taps Print |
| Copied | Toast: "Care card copied to clipboard" | User taps Copy |
| Error | Toast: "Could not generate care card." with retry | Data assembly fails |

## Test Requirements

### Unit Tests (engine/export.ts)
- [ ] `generatePetSitterText`: includes pet name, breed, age, weight in header
- [ ] `generatePetSitterText`: includes feeding schedule with times and portions
- [ ] `generatePetSitterText`: includes dietary allergies and restrictions
- [ ] `generatePetSitterText`: includes active medications with dosage and frequency
- [ ] `generatePetSitterText`: includes emergency contacts with phone numbers
- [ ] `generatePetSitterText`: includes breed health alerts
- [ ] `generatePetSitterText`: omits sections with no data (no "Medications" header when empty)
- [ ] `generatePetSitterText`: handles pet with null birth date (shows "Age: Unknown")
- [ ] `generatePetSitterText`: handles pet with null weight (omits weight line)
- [ ] `generatePetSitterText`: output under 4000 chars for typical pet (3 meds, 3 meals, 2 contacts)
- [ ] `generatePetSitterHtml`: returns valid HTML with DOCTYPE and self-contained inline CSS
- [ ] `generatePetSitterHtml`: includes all sections present in text version
- [ ] `generatePetSitterHtml`: allergy items rendered with red highlight styling
- [ ] `generatePetSitterHtml`: includes print-friendly CSS (@media print rules)
- [ ] `generatePetSitterHtml`: pet photo rendered as img tag or emoji fallback
- [ ] `generatePetSitterHtml`: handles empty card (just pet header)

### Integration Tests (CRUD)
- [ ] `buildPetSitterCard` includes dietary info from `pt_dietary_info`
- [ ] `buildPetSitterCard` computes petAgeDisplay from birth date
- [ ] `buildPetSitterCard` computes weightDisplay from current_weight_grams
- [ ] `buildPetSitterCard` returns null for non-existent pet
- [ ] `buildPetSitterCard` excludes inactive medications
- [ ] `buildPetSitterCard` includes feeding schedules sorted by feed_at

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Create pet "Luna" (dog, golden retriever, birth date = 3 years ago, weight = 32000g, photo)
4. Add feeding schedule: breakfast 07:30 "Blue Buffalo" 1.5 cups, dinner 17:30 "Blue Buffalo" 1.5 cups
5. Add medication: "Heartgard" monthly, "Nexgard" monthly
6. Add emergency contact: "City Vet Clinic" 555-0123, "24hr Emergency" 555-0199
7. Add dietary info: allergies = ["chicken", "soy"], restrictions = ["grain-free"], special instructions = "Mix warm water with kibble"
8. Navigate to Sitter Card
9. **Verify pet header:** Photo, "Luna", "Golden Retriever", "3 years old", "70.5 lbs" -- AC-1
10. **Verify feeding section:** Two meals with times and portions -- AC-2
11. **Verify dietary section:** "chicken" and "soy" in red tags, "grain-free" in amber tag -- AC-3
12. **Verify medications section:** Heartgard and Nexgard with frequency -- AC-4
13. **Verify emergency contacts:** Both contacts with phone numbers -- AC-5
14. **Verify breed alerts:** Hip dysplasia and lymphoma notes for golden retriever -- AC-6
15. Tap "Share"
16. **Verify:** System share sheet opens with plain text card content -- AC-7
17. Cancel share sheet
18. Tap "Print"
19. **Verify:** Print dialog opens with styled HTML card -- AC-8
20. Cancel print dialog
21. Tap "Copy"
22. **Verify:** Toast "Care card copied to clipboard" appears -- AC-9
23. Paste clipboard content and verify it matches the text version
24. Delete all medications for Luna
25. Navigate back to Sitter Card
26. **Verify:** Medications section is hidden -- AC-10
27. Delete all emergency contacts
28. **Verify:** Amber warning banner appears: "No emergency contacts" -- AC-11

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/pets/[petId]/sitter-card` on web, click Share/Print/Copy, verify all states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `buildPetSitterCard()` in `crud.ts` returns `{ pet, activeMedications, feedingSchedules, emergencyContacts, breedAlerts }`
- `formatPetSitterCard()` in `engine/export.ts` returns a basic plain-text summary (no dietary info, no age/weight, no HTML)
- `serializePetExportBundle()` returns full JSON export (overkill for sitter handoff)
- No HTML generation for printing
- No share sheet integration
- No clipboard copy
- No dietary info included in sitter card
- No age or weight display computation

### After This Work
- `buildPetSitterCard()` enhanced with `dietaryInfo`, `petAgeDisplay`, `weightDisplay` fields
- `generatePetSitterText()` replaces `formatPetSitterCard()` with richer plain text (dietary info, age, weight, conditional sections)
- `generatePetSitterHtml()` new function producing printable HTML with inline CSS, allergy highlighting, print-friendly layout
- `formatPetSitterCard()` kept as deprecated alias for backward compatibility
- Mobile screen at `apps/mobile/app/(pets)/sitter-card.tsx` with preview + Share/Print/Copy
- Web page at `apps/web/app/pets/[petId]/sitter-card/page.tsx` with Web Share API and print
- 22+ new tests covering both text and HTML generators

### Files Changed

- `modules/pets/src/engine/export.ts` -- New functions: generatePetSitterHtml, generatePetSitterText. Existing formatPetSitterCard deprecated (kept for compat).
- `modules/pets/src/types.ts` -- Enhanced PetSitterCard interface with dietaryInfo, petAgeDisplay, weightDisplay
- `modules/pets/src/db/crud.ts` -- Enhanced buildPetSitterCard to include dietary info and computed display fields
- `modules/pets/src/index.ts` -- Re-export new functions
- `modules/pets/src/__tests__/export.test.ts` -- Unit tests for HTML and text generators
- `apps/mobile/app/(pets)/sitter-card.tsx` -- Sitter card preview + share/print/copy screen
- `apps/web/app/pets/[petId]/sitter-card/page.tsx` -- Web sitter card page

### Known Limitations
- HTML card uses inline CSS only (no external stylesheets). Styling is limited but universally compatible.
- Pet photo is included as a reference path/URI in the HTML. If the photo is a local file URI, it will not render when the HTML is opened outside the app. Future: base64-encode the image.
- Text version targets <4000 chars for iMessage compatibility but does not enforce a hard limit. Very complex pets (10+ medications) may exceed this.
- No PDF generation (HTML print-to-PDF via browser is the workaround).
- No QR code linking to a web-hosted version of the card (future feature).
- Web Share API has limited browser support. Fallback is copy-to-clipboard.

### Context for Next Agent
- The existing `formatPetSitterCard()` in `engine/export.ts` is a simple string builder (lines 28-69). The new `generatePetSitterText()` should follow the same pattern but add dietary info, age, weight, and conditional section visibility. Keep `formatPetSitterCard()` as a deprecated re-export for backward compatibility.
- `buildPetSitterCard()` in `crud.ts` (line 1024) currently fetches pet, medications, feeding schedules, emergency contacts, and breed alerts. Enhance it to also call `getDietaryInfo(db, petId)` (already exists in crud.ts), compute `petAgeDisplay` using `calculatePetAgeYears()` from `engine/weight.ts`, and format `weightDisplay` from `pet.currentWeightGrams`.
- For weight display, convert grams to lbs and kg: `${(grams / 453.592).toFixed(1)} lbs (${(grams / 1000).toFixed(1)} kg)`.
- For age display, calculate from `pet.birthDate` using the existing `calculatePetAgeYears()` function. Format as "X years, Y months" or "X months" for puppies/kittens under 1 year.
- The HTML generator should produce a complete HTML document (DOCTYPE, head with inline style, body) that renders well at 700px width and prints cleanly on A4/letter paper. Use serif fonts for readability, #FF453A for allergy highlights, and a clean white background (not the dark app theme).
- For mobile sharing: use `expo-sharing` with `shareAsync({ url: tempHtmlFile })` for HTML or `expo-clipboard` for copy. For text sharing, use the system share sheet via `Share.share({ message: textContent })` from React Native.
