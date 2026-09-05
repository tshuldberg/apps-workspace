# Feature Spec: Lost Pet Poster Generator

## Metadata
- **Module:** pets
- **Priority Score:** 19 / 50 (C-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 1 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 1 x1
- **Sprint:** Sprint 4
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Pet profile CRUD (already built, V1 schema)
- **Blocks:** None

## Business Context

### Why This Feature Exists
When a pet goes missing, owners panic and scramble to create posters. They waste critical hours fumbling with word processors or poster apps while their pet could be getting farther away. MyPets already has all the data needed for a poster (photo, breed, name, microchip ID) and can generate one in seconds. This is a high-emotion, low-frequency feature that creates deep loyalty when it matters most.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| PetDesk | Yes | Free | Basic lost pet alert to local PetDesk network, requires account |
| 11pets | No | N/A | No poster generation |
| Pawp | No | N/A | No poster features |
| FitBark | Partial | Premium | GPS tracking (prevents loss), no poster generation |

### Target User
Any pet owner whose pet has escaped or gone missing. This is a crisis-mode feature used rarely but with extreme urgency. The user needs a printable, shareable poster in under 60 seconds with zero setup. Also useful for animal shelters and foster parents who find stray animals and want to create "Found Pet" posters.

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/engine/poster.ts      -- Pure functions: HTML poster generation
modules/pets/src/index.ts              -- Re-export new public API
modules/pets/src/__tests__/poster.test.ts -- Engine tests
apps/mobile/app/(pets)/poster.tsx      -- Mobile poster screen
apps/web/app/pets/[petId]/poster/page.tsx -- Web poster page
```

### Wireframe Position

```
Hub Dashboard
  └── MyPets card
       └── Pets tab (pet list)
            └── Pet Detail
                 └── Actions menu (...)
                      └── "Generate Lost Pet Poster" ← YOU ARE HERE
```

### Data Model

No schema changes required. The poster is generated from existing pet profile data plus user-provided details at generation time (last seen location, contact phone, reward amount).

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for reading pet data), pet profile CRUD
- **External:** None. QR code generation uses a pure JS library or simple text encoding. No network calls.
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a pet owner whose pet is missing, I want to generate a professional lost pet poster in seconds using my pet's existing profile data so that I can start distributing it immediately.
2. As a person who found a stray animal, I want to generate a "Found Pet" poster with a photo I just took so that I can help reunite the pet with its owner.
3. As a pet owner, I want to share the poster digitally via text, email, or social media so that I can reach more people faster.
4. As a pet owner, I want to print the poster directly from my phone so that I can post physical copies in my neighborhood.

### Behavior Specification

**Generating a lost pet poster:**
1. User navigates to a pet's detail screen
2. User taps the actions menu (...) and selects "Generate Lost Pet Poster"
3. System opens the poster generator screen with pet data pre-filled
4. System shows a form with pre-filled and user-provided fields:
   - Pre-filled from profile: pet photo, pet name, species, breed, weight, microchip ID
   - User provides: poster type (Lost/Found), last seen date (default: today), last seen location (text), contact phone number (required), color/markings description (text), reward amount (optional), additional notes (optional)
5. User fills in the required fields and taps "Generate Poster"
6. System generates an HTML poster optimized for A4/Letter printing
7. Poster preview appears full-screen
8. User can: Print (system print dialog), Share (system share sheet with image), Save (to photos), Edit (go back to form)

**Generating a found pet poster:**
1. Same flow but with "Found Pet" header
2. Instead of "Last seen", the form shows "Found at" location and date
3. No reward field
4. Photo can be taken fresh from camera (not just from profile)

### Edge Cases

- **No pet photo:** Show a species-appropriate silhouette placeholder (dog, cat, bird, etc.)
- **No microchip ID:** Hide the microchip section on the poster
- **No phone number provided:** Block generation with validation error "Contact phone is required"
- **Very long breed name:** Truncate to 40 characters with ellipsis on the poster
- **Very long location text:** Wrap to 2 lines maximum, truncate with ellipsis
- **Large reward amount:** Format with currency symbol and comma separators
- **Pet is archived:** Still allow poster generation (pet might have been archived prematurely)
- **Multiple photos exist:** Use the pet's profile photo (imageUri from pt_pets)
- **Module disabled:** Poster data is generated from in-memory pet data; works as long as pet profile was loaded before disable
- **Offline:** Fully functional offline (no network required)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can generate a "Lost Pet" poster from any pet's detail screen in under 60 seconds
- [ ] **AC-2:** Poster displays pet photo prominently at the top (at least 40% of poster area)
- [ ] **AC-3:** Poster shows pet name, breed, weight, color/markings, and microchip ID (if available)
- [ ] **AC-4:** Poster shows last seen date and location
- [ ] **AC-5:** Poster shows contact phone number in large, readable text
- [ ] **AC-6:** Poster shows reward amount if provided
- [ ] **AC-7:** User can switch between "Lost Pet" and "Found Pet" poster types
- [ ] **AC-8:** User can share the poster via the system share sheet (as image)
- [ ] **AC-9:** User can print the poster via the system print dialog
- [ ] **AC-10:** Poster is optimized for A4/Letter paper size (portrait)

### Technical Criteria
- [ ] **TC-1:** `generateLostPetPoster` returns valid HTML string with inline styles
- [ ] **TC-2:** `generateFoundPetPoster` returns valid HTML with "FOUND PET" header
- [ ] **TC-3:** Generated HTML renders correctly at A4 dimensions (210mm x 297mm)
- [ ] **TC-4:** Pet photo is embedded as a base64 data URI (no external references)
- [ ] **TC-5:** All text is legible at standard print resolution (minimum 14pt body, 48pt header)
- [ ] **TC-6:** QR code encodes a plain text pet description (not a URL)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Poster generation must NOT require network access
- [ ] **NC-2:** Poster data must NOT be uploaded to any server
- [ ] **NC-3:** QR code must NOT link to any external URL (encode text only)
- [ ] **NC-4:** Generating a poster must NOT modify any pet data
- [ ] **NC-5:** Contact phone number must NOT be stored in the pet profile (entered fresh each time for privacy)

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Form cards:** `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border, 12px radius
- **Module accent:** `#F59E0B` (amber)
- **Poster type toggle:** Two-button segmented control: "Lost Pet" (danger red active) / "Found Pet" (success green active)
- **Generate button:** Full-width, `#F59E0B` background, bold white text
- **Poster preview:** Full-screen modal with white background (poster content), action bar at bottom: Print, Share, Save, Edit
- **Layout:** ScrollView with form fields, poster preview below "Generate" button

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Poster generator accessible via `/pets/[petId]/poster` route
- Form on left half, live poster preview on right half (side-by-side on desktop)
- Print uses `window.print()` with print-specific CSS media query
- Share uses Web Share API (with clipboard fallback)

### Poster Design

- **Header:** "LOST PET" or "FOUND PET" in bold 48pt red/green text, centered
- **Photo:** Pet photo centered, 60% width, rounded corners
- **Pet info:** Name (bold 28pt), Breed, Weight, Color/Markings in organized rows
- **Details:** Last seen/Found at date and location, 18pt
- **Contact:** "IF FOUND PLEASE CALL" header, phone number in bold 36pt
- **Reward:** "REWARD: $XXX" if provided, highlighted box
- **Microchip:** "Microchip ID: XXXX" in smaller text at bottom
- **QR code:** Bottom-right corner, 80x80px, encodes text description
- **Footer:** "Generated by MyLife" in 8pt gray (optional, removable)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Form | Input form with pre-filled pet data | Initial screen load |
| Validation Error | Red borders on required fields with inline messages | Save with missing required fields |
| Generating | Brief loading spinner (< 1 second) | User taps "Generate Poster" |
| Preview | Full-screen poster with action buttons | Poster generated successfully |
| Shared | Toast: "Poster shared successfully" | User completes share action |
| Printed | Toast: "Sent to printer" | User completes print dialog |
| Error | Toast: "Could not generate poster" | Generation fails (shouldn't happen) |

## Test Requirements

### Unit Tests (engine/poster.ts)
- [ ] `generateLostPetPoster`: generates valid HTML with "LOST PET" header
- [ ] `generateLostPetPoster`: includes pet name, breed, and weight
- [ ] `generateLostPetPoster`: includes contact phone number
- [ ] `generateLostPetPoster`: includes microchip ID when available
- [ ] `generateLostPetPoster`: omits microchip section when not available
- [ ] `generateLostPetPoster`: includes reward amount when provided
- [ ] `generateLostPetPoster`: omits reward section when not provided
- [ ] `generateLostPetPoster`: uses placeholder image when no photo
- [ ] `generateFoundPetPoster`: generates HTML with "FOUND PET" header
- [ ] `generateFoundPetPoster`: includes "Found at" instead of "Last seen"
- [ ] `generateFoundPetPoster`: omits reward section
- [ ] Both functions: HTML contains inline styles (no external CSS references)
- [ ] Both functions: contact phone is required (throws if missing)
- [ ] Both functions: long text fields are truncated appropriately

### Integration Tests
- [ ] Full flow: load pet profile -> generate poster -> verify all fields present
- [ ] Pet with no photo: poster uses species silhouette placeholder
- [ ] Pet with all optional fields: poster includes everything

### QA Verification Script

1. Open the app, navigate to MyPets
2. Select a pet with a photo, breed, and microchip ID
3. Tap the actions menu (...) on the pet detail screen
4. Tap "Generate Lost Pet Poster"
5. **Verify:** Form shows with pet data pre-filled -- AC-1
6. Enter last seen date: today, location: "Central Park, near the fountain"
7. Enter contact phone: "555-123-4567"
8. Enter reward: "$100"
9. Tap "Generate Poster"
10. **Verify:** Poster shows pet photo prominently -- AC-2
11. **Verify:** Poster shows pet name, breed, weight, microchip ID -- AC-3
12. **Verify:** Poster shows last seen date and location -- AC-4
13. **Verify:** Phone number displayed in large text -- AC-5
14. **Verify:** Reward amount shown -- AC-6
15. Toggle to "Found Pet" mode
16. **Verify:** Header changes to "FOUND PET" -- AC-7
17. Tap Share button
18. **Verify:** System share sheet appears -- AC-8
19. Tap Print button
20. **Verify:** System print dialog appears -- AC-9
21. **Verify:** Poster fits on a single page -- AC-10
22. Test with a pet that has no photo
23. **Verify:** Silhouette placeholder appears instead of photo

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Pet profiles exist with photo, name, breed, weight, microchip ID
- No poster generation capability exists
- formatPetSitterCard exists in engine/export.ts (similar pattern for HTML generation)

### After This Work
- New engine/poster.ts with generateLostPetPoster and generateFoundPetPoster
- Both generate self-contained HTML with inline styles, suitable for printing
- QR code encodes plain text description (no external URLs)
- Mobile screen for poster generation with form + preview
- Web page with side-by-side form and live preview

### Files Changed

- `modules/pets/src/engine/poster.ts` -- New: HTML poster generation functions
- `modules/pets/src/index.ts` -- Re-export poster functions
- `modules/pets/src/__tests__/poster.test.ts` -- Unit tests for poster generation
- `apps/mobile/app/(pets)/poster.tsx` -- Mobile poster generator screen
- `apps/web/app/pets/[petId]/poster/page.tsx` -- Web poster page

### Known Limitations
- QR code generation requires a pure JS QR library or simple text encoding; evaluate options at build time
- Photo is embedded as base64 which can make the HTML large (1-5MB for high-res photos); consider resizing
- No GPS/location integration for "last seen" (user types location manually)
- No social media direct posting (uses system share sheet only)
- No poster templates/themes (single fixed design in V1)
- "Generated by MyLife" footer is optional and can be removed in future versions

### Context for Next Agent
- Follow the pattern from engine/export.ts (formatPetSitterCard) for HTML generation style
- The pet's imageUri is a local file path. To embed in HTML, read the image and convert to base64 data URI at the app layer (the engine receives the base64 string, not the file path)
- For QR code, consider using a simple text-only encoding. A minimal QR library like `qrcode` (npm) can generate SVG inline. If adding a dependency is undesirable, the QR code can be deferred to a future enhancement
- Contact phone should NEVER be persisted to the pet profile or database. It is ephemeral, entered by the user each time, and only appears in the generated poster output
