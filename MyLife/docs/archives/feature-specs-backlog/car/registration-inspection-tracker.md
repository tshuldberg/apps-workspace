# Feature Spec: Registration & Inspection Tracker

## Metadata
- **Module:** car
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [4] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** 5
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (uses existing cr_vehicles and reminder engine infrastructure)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Every driver must renew their vehicle registration annually and pass inspections (safety, emissions, or both depending on their state). Missing a registration renewal leads to fines during traffic stops. Missing an inspection means failing registration renewal entirely. Despite this being a universal pain point, most car apps treat registration as an afterthought or bundle it into generic reminders. A dedicated registration and inspection tracker with document storage (photos of registration card, inspection certificate) gives MyCar a practical daily-use advantage: during a traffic stop, users can pull up their registration card photo instantly instead of digging through their glove box.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Simply Auto | Yes | Partial (premium) | Registration tracking with date reminders, no document storage |
| CARFAX Car Care | Partial | No (free) | Recall alerts include registration reminders but no document storage or inspection tracking |
| Drivvo | Partial | Free tier | Generic expense category for registration, no dedicated tracker or document storage |
| AUTOsist | Yes | Free tier | Registration and inspection date tracking with reminders, no document photos |
| FIXD | No | N/A | OBD-II diagnostic focus, no registration/inspection tracking |
| Fuelio | No | N/A | Fuel and cost focus only |

### Target User
Any vehicle owner in the US (all 50 states require registration; 31 states require some form of inspection). Particularly valuable for multi-vehicle households who must track different renewal dates and inspection requirements per vehicle. Secondary audience: drivers who have been pulled over and could not locate their registration card, or who have missed an inspection deadline and faced late fees.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  types.ts                                  -- New Zod schemas: Registration, RegistrationDocument, InspectionType
  db/schema.ts                              -- New tables: cr_registrations, cr_registration_documents + indexes
  db/crud.ts                                -- New CRUD: registration and document create/read/update/delete
  engines/reminder-engine.ts                -- Extended: registration/inspection expiration status calculation
  definition.ts                             -- Migration v3 for new tables
  index.ts                                  -- Re-export new types and CRUD functions
  __tests__/registration.test.ts            -- NEW: unit tests for registration CRUD and expiration logic

apps/mobile/app/(car)/
  registration.tsx                          -- NEW: Registration & Inspection screen
  registration-documents.tsx                -- NEW: Document viewer/gallery screen

apps/web/app/car/
  registration/page.tsx                     -- NEW: Registration & Inspection web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       └── Vehicle Detail screen
            └── "Registration & Inspection" section ← YOU ARE HERE
                 ├── Registration card (state, number, expiration, status badge)
                 ├── Inspection card (type, expiration, station, status badge)
                 ├── Document gallery (photos of reg card, inspection cert)
                 └── "Quick View" button for traffic stop access
```

The Registration & Inspection view is accessible from:
1. Vehicle Detail screen via a dedicated "Registration" section (primary entry point)
2. The MyCar Dashboard via a status badge on the vehicle card if registration or inspection is expiring soon
3. A quick-access shortcut from the MyCar card on the Hub Dashboard (for traffic stop use case)

### Data Model

```sql
-- New table: cr_registrations (Migration v3)
CREATE TABLE IF NOT EXISTS cr_registrations (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    reg_state TEXT,
    reg_number TEXT,
    reg_expiration_date TEXT,
    inspection_type TEXT NOT NULL DEFAULT 'none',
    inspection_expiration_date TEXT,
    inspection_station TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for cr_registrations
CREATE INDEX IF NOT EXISTS cr_registrations_vehicle_idx
    ON cr_registrations(vehicle_id);
CREATE INDEX IF NOT EXISTS cr_registrations_reg_exp_idx
    ON cr_registrations(reg_expiration_date ASC);
CREATE INDEX IF NOT EXISTS cr_registrations_insp_exp_idx
    ON cr_registrations(inspection_expiration_date ASC);

-- New table: cr_registration_documents (Migration v3)
CREATE TABLE IF NOT EXISTS cr_registration_documents (
    id TEXT PRIMARY KEY,
    registration_id TEXT NOT NULL REFERENCES cr_registrations(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL DEFAULT 'other',
    image_uri TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for cr_registration_documents
CREATE INDEX IF NOT EXISTS cr_reg_docs_registration_idx
    ON cr_registration_documents(registration_id);
```

**inspection_type enum values:** `safety`, `emissions`, `both`, `none`

**document_type enum values:** `reg_card_front`, `reg_card_back`, `inspection_cert`, `emissions_report`, `other`

**Relationship:** Each vehicle has at most one active cr_registrations row (enforced at application layer, not SQL UNIQUE constraint, to allow historical records in the future). Each registration can have multiple cr_registration_documents.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for schema v3), existing `reminder-engine.ts` (reuse status calculation pattern)
- **External:** `expo-image-picker` (mobile photo capture/selection for document photos), `zod` (schema validation). No external APIs required.
- **Cross-Module:** None. Registration tracking is self-contained within the car module.

## Functional Requirements

### User Stories
1. As a vehicle owner, I want to store my registration state, number, and expiration date so that I get reminded before it expires and avoid late fees.
2. As a vehicle owner in an inspection-required state, I want to track my inspection type (safety, emissions, or both) and expiration date so that I never miss an inspection deadline.
3. As a driver, I want to photograph my registration card and inspection certificate so that I can quickly show them during a traffic stop without digging through the glove box.
4. As a multi-vehicle household, I want to see registration and inspection status for all vehicles at a glance so that I can plan renewals efficiently.
5. As a privacy-first user, I want all registration data and document photos stored locally on my device, with no cloud upload, so that sensitive information (VIN, license plate, registration number) stays private.

### Behavior Specification

**Adding registration info (first time):**
1. User navigates to Vehicle Detail for a specific vehicle.
2. "Registration & Inspection" section shows empty state: "No registration info yet" with "Add Registration" button.
3. User taps "Add Registration".
4. Form shows:
   - Registration state/region: text input with US state abbreviation autocomplete (e.g., "CA", "NY", "TX")
   - Registration number: text input (alphanumeric, free-form)
   - Registration expiration date: date picker
   - Inspection type: segmented control with options: None, Safety, Emissions, Both
   - Inspection expiration date: date picker (shown only if inspection type is not "none")
   - Inspection station: text input (optional, shown only if inspection type is not "none")
   - Notes: multiline text input (optional)
5. User fills in the form and taps Save.
6. System creates a cr_registrations record and returns to Vehicle Detail showing the registration card.

**Viewing registration status:**
1. Vehicle Detail "Registration & Inspection" section shows:
   - Registration card: state badge, registration number, expiration date, status badge (OK/Expiring Soon/Expired)
   - Inspection card (if type is not "none"): inspection type label, expiration date, station name, status badge
2. Status badges use the same color system as maintenance reminders:
   - OK (green, `#30D158`): expiration is more than 30 days away
   - Expiring Soon (amber, `#FFD60A`): expiration is within 30 days
   - Expired (red, `#FF453A`): expiration date has passed
3. Status badges include icons: checkmark for OK, clock for Expiring Soon, exclamation for Expired.

**Editing registration info:**
1. User taps "Edit" on the registration card (or the entire card in edit mode).
2. Same form as "Add Registration", pre-filled with current values.
3. User modifies any fields and taps Save.
4. System updates the cr_registrations record. Status badges recalculate immediately.

**Adding document photos:**
1. Below the registration and inspection cards, a "Documents" section shows a photo gallery grid.
2. User taps "Add Document" button (camera icon).
3. System presents options: "Take Photo" (opens camera) or "Choose from Library" (opens image picker).
4. User captures or selects an image.
5. System presents a label selector: "Registration Card (Front)", "Registration Card (Back)", "Inspection Certificate", "Emissions Report", "Other".
6. User selects a label and taps Save.
7. Document is saved to the device (image_uri points to the local file system) and a cr_registration_documents record is created.
8. Photo appears in the gallery grid with the label below it.

**Quick View for traffic stops:**
1. From the MyCar Dashboard or Vehicle Detail, user can tap a "Quick View" button (or swipe gesture).
2. Full-screen display shows:
   - Registration card photo (front) at maximum resolution
   - Swipe to see registration card back, inspection certificate
   - Dark background for glare reduction
   - Screen brightness auto-increases to maximum (mobile only)
3. Tap anywhere to dismiss.

**Viewing document gallery:**
1. User taps a document thumbnail in the gallery.
2. Full-screen image viewer opens with pinch-to-zoom.
3. Swipe left/right to navigate between documents.
4. Action button: "Delete" (with confirmation dialog).

**Expiration reminders (integration with existing reminder engine):**
1. When a registration or inspection expiration date is saved:
2. System calculates status using the same logic as maintenance reminders (30-day window for "expiring soon").
3. On the MyCar Dashboard, vehicles with expiring or expired registration/inspection show a warning badge.
4. The existing Reminders screen (from maintenance-schedule-reminders spec) can also display registration/inspection expiration as read-only reminder cards (not editable like maintenance schedules, since the fix is "go to the DMV" not "snooze").

### Edge Cases

- **No registration info for a vehicle:** Vehicle Detail shows empty state with "Add Registration" CTA. No error, no warning badge on dashboard.
- **Registration state left blank:** Accepted. Some users may not want to enter their state. Status calculation still works based on expiration date alone.
- **Inspection type set to "none":** Inspection fields are hidden. Only registration fields are shown. No inspection expiration tracking.
- **Both registration and inspection expired:** Both cards show red "Expired" badges. The dashboard vehicle card shows a single combined warning badge (most urgent status wins).
- **Expiration date in the far future (5+ years):** Accepted. No validation cap on dates.
- **Expiration date in the past on creation:** Accepted. Status immediately shows "Expired". This is valid for users adding historical data.
- **Multiple documents of the same type:** Allowed. User might photograph both the original and a copy. The gallery shows all documents regardless of type.
- **Very large images (10+ MB):** The image picker should resize to a maximum of 2048px on the longest edge to keep storage reasonable. Original is not preserved.
- **Image file deleted from filesystem:** Document record still exists in the database. UI shows a broken image placeholder with "Photo not found" text. User can delete the record.
- **Vehicle deleted:** CASCADE deletes the registration record, which CASCADE deletes all associated documents. Image files on the filesystem are orphaned (not auto-deleted by SQL CASCADE). A cleanup utility could be added later.
- **Module disabled mid-use:** Data preserved. Re-enabling restores all registration info and documents.
- **User adds registration but never adds photos:** Fully valid. Document gallery shows empty state "No documents yet" with "Add Document" button.
- **Camera permissions denied:** Show info banner "Camera access is needed to photograph documents. Enable it in Settings." Offer "Choose from Library" as an alternative.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Vehicle Detail shows a "Registration & Inspection" section with an "Add Registration" button when no registration exists.
- [ ] **AC-2:** Tapping "Add Registration" opens a form with state, number, expiration date, inspection type, inspection expiration, station, and notes fields.
- [ ] **AC-3:** Selecting inspection type "None" hides the inspection expiration date and station fields.
- [ ] **AC-4:** Selecting inspection type "Safety", "Emissions", or "Both" reveals the inspection expiration date and station fields.
- [ ] **AC-5:** Saving a registration creates a record and shows the registration card on Vehicle Detail with state, number, and expiration date.
- [ ] **AC-6:** Registration status badge shows OK (green) when expiration is 30+ days away, Expiring Soon (amber) when within 30 days, and Expired (red) when past the date.
- [ ] **AC-7:** Inspection status badge follows the same OK/Expiring Soon/Expired logic as registration.
- [ ] **AC-8:** Tapping "Edit" on the registration card opens the form pre-filled with current values.
- [ ] **AC-9:** Editing and saving updates the record and recalculates status badges immediately.
- [ ] **AC-10:** Tapping "Add Document" presents "Take Photo" and "Choose from Library" options.
- [ ] **AC-11:** After capturing/selecting an image, a label selector appears with 5 document type options.
- [ ] **AC-12:** Saved documents appear in the gallery grid with their label below the thumbnail.
- [ ] **AC-13:** Tapping a document thumbnail opens a full-screen image viewer with pinch-to-zoom.
- [ ] **AC-14:** The "Quick View" button opens a full-screen display of the registration card photo optimized for traffic stops (dark background, max brightness on mobile).
- [ ] **AC-15:** The MyCar Dashboard shows a warning badge on vehicle cards when registration or inspection is expiring soon or expired.

### Technical Criteria
- [ ] **TC-1:** Migration v3 creates cr_registrations table with all specified columns and 3 indexes.
- [ ] **TC-2:** Migration v3 creates cr_registration_documents table with all specified columns and 1 index.
- [ ] **TC-3:** Migration v3 runs cleanly on both fresh databases and databases with v1+v2 already applied.
- [ ] **TC-4:** `createRegistration` persists a record with all fields and returns the created registration.
- [ ] **TC-5:** `getRegistrationByVehicle(vehicleId)` returns the registration record for a vehicle, or null if none exists.
- [ ] **TC-6:** `updateRegistration` updates any subset of fields and recalculates the updated_at timestamp.
- [ ] **TC-7:** `deleteRegistration` removes the registration and CASCADE-deletes all associated documents.
- [ ] **TC-8:** `createRegDocument` persists a document record linked to a registration.
- [ ] **TC-9:** `getRegDocumentsByRegistration(registrationId)` returns all documents for a registration sorted by created_at.
- [ ] **TC-10:** `deleteRegDocument` removes a single document record.
- [ ] **TC-11:** Registration expiration status calculation correctly returns "ok" for dates 30+ days away, "expiring_soon" for 1-30 days, and "expired" for past dates.
- [ ] **TC-12:** Deleting a vehicle CASCADE-deletes the registration, which CASCADE-deletes all documents.
- [ ] **TC-13:** Image picker resizes images to a maximum of 2048px on the longest edge.
- [ ] **TC-14:** Zod validation requires inspection_expiration_date when inspection_type is not "none".

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Document photos must NOT be uploaded to any server. All storage is local on-device.
- [ ] **NC-2:** Registration data must NOT be accessible to other modules (no cross-module export of sensitive data like registration numbers).
- [ ] **NC-3:** Deleting a registration must NOT affect the vehicle record or any other vehicle data (maintenance, fuel logs, schedules).
- [ ] **NC-4:** The quick-view screen must NOT allow editing or deletion (read-only display for safety during traffic stops).
- [ ] **NC-5:** Camera/gallery access must NOT be requested until the user explicitly taps "Add Document". No preemptive permission requests.
- [ ] **NC-6:** The registration screen must NOT make any network calls. All operations are local SQLite.

## UI Specification

### Mobile (Expo)

**Registration & Inspection Section (on Vehicle Detail):**
- Section header: "Registration & Inspection" with edit pencil icon (right side)
- Background: `#0A0A0F` (background token)

**Registration Card:**
- Glass card: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Top-left: state abbreviation in a rounded badge (`#6366F1` background, white text, `borderRadius: 6`, `fontSize: 14`, `fontWeight: 700`)
- Top-right: status badge (OK/Expiring Soon/Expired) using same color system as maintenance reminders
- Center: registration number in `fontSize: 20`, `fontWeight: 600`, color `#F0F0F5`
- Bottom: "Expires: [date]" in `textSecondary` (`rgba(240,240,245,0.65)`)
- Card has a subtle car icon watermark at 5% opacity in the bottom-right corner

**Inspection Card:**
- Same glass card style
- Top-left: inspection type label ("Safety", "Emissions", "Safety & Emissions") in `textSecondary`
- Top-right: status badge
- Center: "Expires: [date]" in `fontSize: 18`, color `#F0F0F5`
- Bottom: "Station: [name]" in `textSecondary` (if provided)

**Document Gallery:**
- Section header: "Documents" with "Add" button (camera icon, accent color)
- Grid layout: 3 columns on phone, 4 columns on tablet
- Each cell: square thumbnail with rounded corners (`borderRadius: 8`)
- Label below thumbnail: `fontSize: 11`, `textSecondary`, single line truncated
- Placeholder for empty slots: dashed border (`rgba(255,255,255,0.10)`), "+" icon

**Quick View (full-screen):**
- Background: `#000000` (pure black for max contrast)
- Image: full-width, aspect-fit, centered vertically
- Swipe gesture for navigation between document photos
- Close button: "X" in top-right, `rgba(255,255,255,0.6)` background circle
- Screen brightness: auto-set to maximum on mount, restore on dismiss (mobile only)

**Add/Edit Registration Form:**
- Background: `#0A0A0F`
- Form fields: glass input style (`rgba(255,255,255,0.04)` background, `rgba(255,255,255,0.10)` border)
- State input: text field with dropdown autocomplete showing US state abbreviations
- Inspection type: segmented control using accent color for selected segment
- Date pickers: native iOS/Android date picker
- Save button: full-width, `#6366F1` background, white text, `borderRadius: 12`
- Cancel button: full-width, ghost style below save

### Web (Next.js)

- Same tokens via CSS variables
- Accessible at `/car/registration` route (or as a section within the vehicle detail page)
- Registration and inspection cards use `backdrop-filter: blur(16px)` with glass token backgrounds
- Document gallery: responsive grid (4 columns wide, 3 medium, 2 narrow)
- Image upload: native file input styled as a drop zone with drag-and-drop support
- Quick View: modal overlay with dark background, image centered, arrow buttons for navigation
- No brightness control on web (browser limitation)
- Document type selector: dropdown menu instead of bottom sheet

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards for registration and inspection sections | Initial data fetch from SQLite |
| Empty (no registration) | "No registration info yet" text + "Add Registration" CTA button | No cr_registrations row for this vehicle |
| Empty (no documents) | Document gallery shows "No documents yet" + "Add Document" button | Registration exists but no cr_registration_documents |
| Error | "Something went wrong" + retry button | SQLite read/write failure |
| Success (all OK) | Registration and inspection cards with green status badges, document thumbnails | All dates are 30+ days away |
| Success (expiring) | Amber status badges with clock icon on registration and/or inspection card | At least one expiration within 30 days |
| Success (expired) | Red status badges with exclamation icon | At least one expiration date has passed |
| Quick View | Full-screen document image on black background | User taps "Quick View" or document thumbnail |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/registration.test.ts)
- [ ] `createRegistration`: creates a record with all fields populated
- [ ] `createRegistration`: creates a record with minimal fields (only vehicle_id and defaults)
- [ ] `createRegistration`: generates correct id format (UUID)
- [ ] `getRegistrationByVehicle`: returns registration for a vehicle that has one
- [ ] `getRegistrationByVehicle`: returns null for a vehicle with no registration
- [ ] `updateRegistration`: updates reg_state and reg_number
- [ ] `updateRegistration`: updates inspection_type and inspection_expiration_date
- [ ] `updateRegistration`: sets updated_at to current timestamp
- [ ] `deleteRegistration`: removes the registration record
- [ ] `deleteRegistration`: CASCADE-deletes associated documents
- [ ] `createRegDocument`: creates a document linked to a registration
- [ ] `createRegDocument`: stores image_uri correctly
- [ ] `getRegDocumentsByRegistration`: returns documents sorted by created_at
- [ ] `getRegDocumentsByRegistration`: returns empty array when no documents exist
- [ ] `deleteRegDocument`: removes a single document without affecting others
- [ ] Registration expiration status: returns "ok" for date 60 days in the future
- [ ] Registration expiration status: returns "expiring_soon" for date 15 days in the future
- [ ] Registration expiration status: returns "expired" for date 5 days in the past
- [ ] Registration expiration status: returns "ok" when no expiration date is set (null)
- [ ] Inspection expiration status: follows same 30-day threshold logic
- [ ] Zod validation: rejects registration with inspection_type not "none" but no inspection_expiration_date
- [ ] Zod validation: accepts registration with inspection_type "none" and no inspection dates
- [ ] Zod validation: accepts all 4 inspection_type enum values
- [ ] Zod validation: accepts all 5 document_type enum values
- [ ] Zod validation: rejects document with empty image_uri

### Integration Tests
- [ ] Full flow: create vehicle, add registration, verify it persists and appears on query
- [ ] Full flow: add registration, add 3 documents, query documents, verify all 3 returned in order
- [ ] Full flow: delete registration, verify documents are CASCADE-deleted
- [ ] Full flow: delete vehicle, verify registration and documents are all CASCADE-deleted
- [ ] Full flow: update registration expiration date, verify status recalculates correctly
- [ ] Error flow: attempt to create registration with non-existent vehicle_id, verify foreign key constraint error

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Add a new vehicle (2024 Ford F-150, odometer 5,000 miles). -- Setup.
3. Tap the vehicle to open Vehicle Detail. Verify "Registration & Inspection" section shows empty state with "Add Registration" button. -- Corresponds to AC-1.
4. Tap "Add Registration". Verify form appears with all fields. -- Corresponds to AC-2.
5. Enter: state "CA", number "8ABC123", expiration date 6 months from today. Set inspection type to "None". -- Fill in registration only.
6. Verify inspection expiration and station fields are hidden when type is "None". -- Corresponds to AC-3.
7. Change inspection type to "Emissions". Verify inspection expiration and station fields appear. -- Corresponds to AC-4.
8. Enter inspection expiration date 3 months from today, station "Bay Area SMOG". Add notes "Annual SMOG check required."
9. Tap Save. Verify registration card appears on Vehicle Detail showing "CA" badge, "8ABC123" number, expiration date, and green OK status badge. -- Corresponds to AC-5, AC-6.
10. Verify inspection card shows "Emissions" label, expiration date, "Bay Area SMOG" station, and green OK status badge. -- Corresponds to AC-7.
11. Tap Edit on the registration card. Verify form is pre-filled with current values. -- Corresponds to AC-8.
12. Change registration expiration to 15 days from today. Save. Verify status badge changes to amber "Expiring Soon". -- Corresponds to AC-9, AC-6.
13. Change registration expiration to 5 days ago. Save. Verify status badge changes to red "Expired". -- Corresponds to AC-6.
14. Verify the MyCar Dashboard shows a warning badge on this vehicle's card. -- Corresponds to AC-15.
15. Return to Vehicle Detail. In the Documents section, tap "Add Document". -- Corresponds to AC-10.
16. Verify "Take Photo" and "Choose from Library" options appear. -- Corresponds to AC-10.
17. Choose "Choose from Library" and select an image. Verify label selector appears with 5 options. -- Corresponds to AC-11.
18. Select "Registration Card (Front)". Verify document appears in the gallery with the label. -- Corresponds to AC-12.
19. Add two more documents: "Registration Card (Back)" and "Inspection Certificate". -- Add more documents.
20. Tap a document thumbnail. Verify full-screen viewer opens with pinch-to-zoom. -- Corresponds to AC-13.
21. Swipe to navigate between documents. Verify all 3 are accessible. -- Gallery navigation.
22. Dismiss the viewer. Tap "Quick View" button. Verify full-screen display with dark background and registration card photo. -- Corresponds to AC-14.
23. Verify screen brightness increases on mobile. -- Corresponds to AC-14 (mobile only).
24. Dismiss Quick View. Change inspection expiration to 10 days from today. Verify inspection status badge changes to amber. -- Corresponds to AC-7.
25. Delete one document from the gallery. Verify it is removed and other documents remain. -- Document deletion.
26. Delete the registration. Verify "Add Registration" empty state returns. Verify all documents are also deleted. -- Corresponds to TC-7.
27. Add registration back. Delete the vehicle. Verify registration and documents are CASCADE-deleted. -- Corresponds to TC-12.
28. Repeat steps 3-22 on web at `/car/registration`. Verify functional parity (minus brightness control and camera). -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the registration section in vehicle detail, click every button, verify all states (loading, empty, success-ok, success-expiring, success-expired, quick-view)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for registration expiration status calculation (reuses reminder-engine pattern)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has 5 tables: cr_vehicles, cr_maintenance, cr_fuel_logs, cr_settings, cr_maintenance_schedules
- Schema version 2, migrations v1 and v2
- No registration or inspection tracking exists
- No document/photo storage capability in the car module
- The Vehicle Detail screen exists but has no registration section
- The reminder engine exists with status calculation for maintenance schedules but does not handle registration/inspection expirations

### After This Work
- Car module has 7 tables (new: cr_registrations, cr_registration_documents) with 4 new indexes
- Schema version 3, migration v3 added
- Full registration lifecycle: add/edit registration and inspection info per vehicle, track expiration dates with status badges, store document photos
- Quick View feature for traffic stop access to registration card photos
- Expiration status integrated into dashboard warning badges
- Mobile: photo capture via expo-image-picker, brightness control for quick view
- Web: file upload for documents, modal viewer

### Files Changed

- `modules/car/src/types.ts` -- Add RegistrationSchema, RegistrationDocumentSchema, InspectionTypeSchema, DocumentTypeSchema Zod schemas and types. Add CreateRegistrationInputSchema and CreateRegDocumentInputSchema validation schemas.
- `modules/car/src/db/schema.ts` -- Add CREATE_REGISTRATIONS table, CREATE_REGISTRATION_DOCUMENTS table, CREATE_REGISTRATION_INDEXES array
- `modules/car/src/db/crud.ts` -- Add registration CRUD functions: createRegistration, getRegistrationByVehicle, updateRegistration, deleteRegistration, createRegDocument, getRegDocumentsByRegistration, deleteRegDocument. Add rowToRegistration and rowToRegDocument mapper functions.
- `modules/car/src/engines/reminder-engine.ts` -- Add calculateExpirationStatus function (reusable for both registration and inspection dates, follows same ok/expiring_soon/expired pattern as calculateScheduleStatus)
- `modules/car/src/definition.ts` -- Add CAR_MIGRATION_V3, update schemaVersion to 3
- `modules/car/src/index.ts` -- Re-export new types, schemas, and CRUD functions
- `modules/car/src/__tests__/registration.test.ts` -- NEW: 25+ unit tests for registration CRUD and expiration logic
- `apps/mobile/app/(car)/registration.tsx` -- NEW: Registration & Inspection screen with form, cards, document gallery
- `apps/mobile/app/(car)/registration-documents.tsx` -- NEW: Full-screen document viewer with pinch-to-zoom and swipe navigation
- `apps/web/app/car/registration/page.tsx` -- NEW: Registration & Inspection web page

### Known Limitations
- One registration record per vehicle (no history tracking). A future enhancement could store historical registration records for audit purposes, but V1 assumes the user only cares about current registration.
- Image files are not auto-deleted from the filesystem when a document record is CASCADE-deleted. This leaves orphaned files. A cleanup utility should be added in a future pass.
- No OCR or auto-extraction from registration card photos. Users must manually enter state, number, and dates. Auto-extraction could be a future premium feature.
- Inspection requirements vary by state (31 states require inspections, requirements differ). This feature does not include a database of state-specific requirements. Users set their own inspection type.
- No push notifications for registration/inspection expiration. The feature relies on in-app status badges and dashboard warnings. Push notification integration could reuse the existing maintenance reminder notification pattern in a future sprint.
- No barcode or QR code scanning for registration documents. This is a potential future enhancement.

### Context for Next Agent
- The expiration status calculation should be added to `reminder-engine.ts` as a new function `calculateExpirationStatus(expirationDate: string | null, currentDate: string): 'ok' | 'expiring_soon' | 'expired' | 'unknown'`. This is simpler than `calculateScheduleStatus` because it only deals with dates (no odometer). When `expirationDate` is null, return 'unknown'.
- The `cr_registrations` table allows one row per vehicle in V1. Enforce this at the application layer: `createRegistration` should check for an existing record and either reject (with a clear error) or upsert. Prefer upsert to simplify the flow.
- The `image_uri` in cr_registration_documents stores a local filesystem path. On mobile (Expo), this will be a `file://` URI from expo-image-picker. On web, this will be a blob URL or base64 data URI. The engine layer should not care about the URI format, it just stores and returns it.
- The Quick View screen brightness feature uses `expo-brightness` on mobile. Import it only in the mobile Quick View component, not in the shared module code. Wrap it in a try/catch since brightness permissions may be restricted.
- The `CASCADE` on `cr_registration_documents.registration_id` means deleting a registration auto-deletes its documents at the SQL level. The `CASCADE` on `cr_registrations.vehicle_id` means deleting a vehicle auto-deletes registration and documents. Test both paths.
- Registration/inspection status should appear on the MyCar Dashboard vehicle card. Add a secondary status indicator (below or beside the vehicle name) that shows the most urgent status across registration, inspection, and maintenance schedules for that vehicle.
