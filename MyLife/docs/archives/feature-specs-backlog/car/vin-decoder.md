# Feature Spec: VIN Decoder

## Metadata
- **Module:** car
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [2] x3 + Complexity [3] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **SPEC-mycar ID:** CR-010
- **Sprint:** 5
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (builds on existing cr_vehicles table and VIN field)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Manually entering vehicle make, model, and year is tedious and error-prone. Every 17-character VIN encodes the manufacturer, model, engine, transmission, and assembly plant in a standardized format. Decoding a VIN auto-fills these fields accurately, saving the user time and eliminating typos. Beyond convenience, VIN decoding enables safety recall checking via the NHTSA Recalls API, a feature that directly protects users and their families. CARFAX monetizes VIN lookups aggressively (selling full history reports), while the NHTSA vPIC API is completely free, requires no API key, and is maintained by the US government. This is a rare opportunity to offer a premium-grade feature at zero marginal cost.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| CARFAX Car Care | Yes | Partial | Free VIN decode for basic info, upsells $39.99 vehicle history report. Uses proprietary database. Includes recall alerts via VIN. |
| Simply Auto | Partial | No | Manual VIN entry field but no decode/auto-fill. VIN stored as metadata only. |
| Drivvo | No | N/A | VIN field exists but no decode functionality. |
| FIXD | Yes | Yes ($9.99/mo) | OBD-II device reads VIN from vehicle computer. Includes recall check. Requires hardware purchase. |
| NHTSA Recall Check | Yes | No (free) | Government website/API for VIN decode and recall lookup. No app, just API/web tool. |
| AutoCheck (Experian) | Yes | Yes ($24.99/report) | Full vehicle history report from VIN. Not a maintenance app. |

### Target User
Car owners adding a new vehicle to MyCar who want accurate auto-fill rather than manual data entry. Multi-vehicle household managers who add 2-5 vehicles and want to minimize setup friction. Safety-conscious drivers who want to know if their vehicle has open recalls. Users migrating from CARFAX Car Care who expect VIN-based features as table stakes. The VIN decode feature reduces the "time to value" for new MyCar users from 2-3 minutes of manual entry to a single scan or paste operation.

## Technical Context

### Where This Lives in MyLife

```
modules/car/src/
  types.ts                            -- New Zod schemas: VinDecodeResult, RecallInfo, NhtsaVariable
  db/schema.ts                        -- New table: cr_recalls
  db/crud.ts                          -- New CRUD: createRecall, getRecallsByVehicle, acknowledgeRecall, getUnacknowledgedRecallCount
  engines/vin-engine.ts               -- NEW: decodeVin, validateVin, checkRecalls, parseNhtsaResponse
  definition.ts                       -- Migration v3 (or v4 if parking lands first)
  index.ts                            -- Re-export new types and engine functions
  __tests__/vin-engine.test.ts        -- NEW: unit tests for VIN engine

apps/mobile/app/(car)/
  vin-scanner.tsx                     -- NEW: Camera-based VIN barcode scanner screen
  recalls.tsx                         -- NEW: Vehicle recalls screen
  components/VinInput.tsx             -- NEW: Manual VIN entry component with validation

apps/web/app/car/
  vin/page.tsx                        -- NEW: VIN decode web page (manual entry only)
  recalls/page.tsx                    -- NEW: Recalls web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCar card
       ├── Add Vehicle flow
       │    └── VIN field
       │         └── "Scan VIN" button ← ENTRY POINT 1 (mobile only)
       │         └── "Decode" button ← ENTRY POINT 2 (after manual entry)
       ├── Vehicle Detail screen
       │    └── VIN section
       │         └── "Decode" / "Check Recalls" ← ENTRY POINT 3
       └── Settings tab
            └── "Check All Recalls" ← ENTRY POINT 4
```

The VIN decoder is integrated into two primary flows:
1. **Add Vehicle flow** - scan or type VIN to auto-fill vehicle fields during creation
2. **Vehicle Detail** - decode an existing VIN or check for recalls on a saved vehicle

### Data Model

```sql
-- New table: cr_recalls (Migration v3 or v4 depending on ordering with parking spec)
CREATE TABLE IF NOT EXISTS cr_recalls (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES cr_vehicles(id) ON DELETE CASCADE,
    nhtsa_campaign_number TEXT NOT NULL,
    component TEXT NOT NULL,
    summary TEXT NOT NULL,
    consequence TEXT,
    remedy TEXT,
    is_acknowledged INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS cr_recalls_vehicle_idx
    ON cr_recalls(vehicle_id);
CREATE INDEX IF NOT EXISTS cr_recalls_campaign_idx
    ON cr_recalls(nhtsa_campaign_number);
CREATE INDEX IF NOT EXISTS cr_recalls_acknowledged_idx
    ON cr_recalls(vehicle_id, is_acknowledged);
```

**Key constraints:**
- `nhtsa_campaign_number` is the NHTSA-assigned campaign identifier (e.g., "23V-456"). Unique per recall, but a vehicle can have multiple recalls.
- `is_acknowledged` tracks whether the user has seen and dismissed a recall (not that it has been fixed). Acknowledged recalls are hidden from the active recall badge but remain in the database.
- Recall data is fetched from the network and cached locally. The `fetched_at` timestamp enables cache staleness checks.
- No changes to the existing `cr_vehicles` table schema. Decoded data (make, model, year) writes to existing columns via the existing `updateVehicle` CRUD function.

**Extended vehicle fields (optional future):** The NHTSA API returns additional fields (engine displacement, cylinders, transmission, drivetrain, body class, plant country) that do not currently have columns in `cr_vehicles`. For MVP, these are displayed in the decode results UI but NOT persisted. A future migration could add these columns if users find them valuable.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for next schema version)
- **External:**
  - `expo-camera` (mobile barcode scanning for VIN). Used only on the VIN scanner screen.
  - `zod` (schema validation for API responses and user input)
  - **NHTSA vPIC API** (`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json`) - free, no API key, US government maintained. Rate limit: not documented, but reasonable usage (< 100 requests/day per user) is fine.
  - **NHTSA Recalls API** (`https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}`) - free, no API key. Alternative endpoint using VIN directly: `https://api.nhtsa.gov/recalls/vin/{vin}`.
- **Cross-Module:** None. VIN decode is self-contained within the car module. The only network calls in the entire car module are these two NHTSA API calls.

## Functional Requirements

### User Stories
1. As a new MyCar user, I want to scan my vehicle's VIN barcode to auto-fill make, model, and year so that I can set up my vehicle in seconds rather than minutes.
2. As a user without camera access (or on web), I want to manually type my 17-character VIN and decode it so that I get the same auto-fill functionality.
3. As a safety-conscious driver, I want to check if my vehicle has any open safety recalls so that I can get them fixed before they cause harm.
4. As a multi-vehicle household, I want to check recalls across all my vehicles at once so that I know which ones need attention.
5. As a privacy-first user, I want to understand exactly what data is sent to the NHTSA API (only the VIN) so that I can trust the feature with my vehicle information.
6. As a user who has already added vehicles manually, I want to decode my saved VIN to verify and correct my vehicle details.

### Behavior Specification

**VIN scanning (mobile only):**
1. User is on the Add Vehicle screen or Vehicle Detail screen.
2. User taps "Scan VIN" button.
3. Camera permission is requested if not already granted.
4. If granted: camera view opens with a rectangular scan target overlay and instructional text "Point camera at the VIN barcode on your vehicle."
5. The scanner detects Code 39, Code 128, or Data Matrix barcodes (common VIN barcode formats).
6. When a valid 17-character string is detected, the scanner vibrates once (haptic feedback) and auto-closes.
7. The scanned VIN is populated into the VIN input field.
8. Decoding begins automatically (same flow as manual entry below).

**VIN manual entry and decoding:**
1. User types or pastes a VIN into the VIN input field.
2. As the user types, real-time validation runs:
   - Must be exactly 17 characters
   - Must contain only alphanumeric characters (no I, O, or Q per VIN standard)
   - Check digit (position 9) is validated using the standard VIN check digit algorithm
3. Invalid VINs show inline validation errors:
   - "VIN must be exactly 17 characters" (too short/long)
   - "VIN cannot contain I, O, or Q" (invalid characters)
   - "VIN check digit is invalid" (check digit fails)
4. When a valid VIN is entered, the "Decode" button becomes enabled.
5. User taps "Decode."
6. Loading spinner appears with "Decoding VIN..."
7. System calls the NHTSA vPIC API with the VIN.
8. On success: decoded results are displayed in a structured card:
   - Year, Make, Model (prominently displayed)
   - Additional info: Body Class, Engine (displacement + cylinders), Transmission, Drivetrain, Plant Country, Fuel Type
9. If the user is in the Add Vehicle flow: a "Use These Details" button appears. Tapping it auto-fills the vehicle form fields (make, model, year, fuel type).
10. If the user is on Vehicle Detail: a "Update Vehicle" button appears. Tapping it updates the existing vehicle record with decoded make, model, year.
11. After decode, a "Check Recalls" button appears automatically.

**Recall checking:**
1. User taps "Check Recalls" (available after VIN decode or from Vehicle Detail screen).
2. Loading spinner: "Checking for safety recalls..."
3. System calls the NHTSA Recalls API with the decoded make, model, and year (or the VIN directly if using the VIN endpoint).
4. On success with recalls found:
   - A recall count badge appears: "{N} Open Recalls" in red
   - Each recall is displayed in a card showing: Component, Summary, Consequence, Remedy, NHTSA Campaign Number
   - Each card has an "Acknowledge" button (marks it as seen, does not mean it is fixed)
   - Recall data is cached locally in `cr_recalls`
5. On success with no recalls: "No open recalls found for this vehicle." with a green checkmark.
6. On error (network failure): "Unable to check recalls. Make sure you have an internet connection." with a "Retry" button.
7. Cached recall data is re-fetched when the user manually triggers "Check Recalls" or when the vehicle detail screen loads and the cache is older than 30 days.

**Recall badge on vehicle cards:**
1. On the MyCar Dashboard, each vehicle card shows a small recall badge if there are unacknowledged recalls.
2. Badge shows the count of unacknowledged recalls (e.g., "2 recalls").
3. Badge color: `#FF453A` (danger red).
4. Tapping the badge navigates to the recalls screen for that vehicle.

**Check All Recalls (settings):**
1. In Car Settings, a "Check All Recalls" button triggers recall checks for all vehicles that have a VIN populated.
2. Results are displayed as a list grouped by vehicle.
3. Vehicles without VINs show "No VIN - add a VIN to check recalls."

**Privacy disclosure:**
1. Before the first VIN decode or recall check, a one-time disclosure dialog appears:
   - Title: "VIN Decode Privacy"
   - Body: "To decode your VIN, we send only the 17-character VIN to the NHTSA (National Highway Traffic Safety Administration) government API. No other data about you or your vehicle is sent. NHTSA does not track API usage by individual users."
   - Buttons: "Continue" (proceeds with decode), "Learn More" (opens NHTSA website), "Cancel"
2. After the user taps "Continue," the disclosure does not appear again (stored in `cr_settings` as `vin_privacy_disclosed = true`).

### Edge Cases

- **No VIN on vehicle record:** Vehicle Detail shows "Add a VIN to decode vehicle info and check recalls" prompt.
- **VIN with fewer than 17 characters:** Real-time validation error. "Decode" button stays disabled.
- **VIN containing I, O, or Q:** Real-time validation error with specific guidance ("VIN cannot contain the letters I, O, or Q").
- **VIN with invalid check digit:** Validation warning (not blocking). "This VIN's check digit appears invalid. It may be a non-standard VIN. Continue anyway?" Some older vehicles and imports may have non-standard check digits.
- **NHTSA API returns no results for the VIN:** "NHTSA could not decode this VIN. The vehicle may not be in the US database (e.g., grey-market imports, kit cars, very old vehicles)." Allow user to proceed with manual entry.
- **NHTSA API returns partial results (some fields empty):** Display available fields, show "Unknown" for missing fields. Auto-fill only works for fields that were successfully decoded.
- **NHTSA API is down or unreachable:** "Unable to reach the NHTSA database. Check your internet connection and try again." with "Retry" button. Offline mode: feature is unavailable, but a clear message explains why.
- **NHTSA API rate limiting (429 response):** "Too many requests. Please wait a moment and try again." Show retry after 30 seconds.
- **Duplicate recall (same campaign number already cached):** Skip insertion. Update `fetched_at` timestamp on the existing record.
- **VIN that decodes to different make/model than what user entered manually:** Show comparison: "Decoded: 2024 Toyota Camry. Your entry: 2023 Honda Civic. Which is correct?" Let user choose.
- **Camera permission denied (mobile):** "Camera access is needed to scan VIN barcodes. You can also type the VIN manually." Show manual entry field instead.
- **Barcode scan reads non-VIN barcode:** If the scanned string is not 17 characters or fails VIN validation, show "That doesn't look like a VIN. Try again or enter manually."
- **Multiple barcodes in camera view:** Scanner processes the first valid 17-character VIN it detects. If multiple VINs are visible (unlikely in practice), the first detected wins.
- **Vehicle deleted while recall data exists:** CASCADE deletes all associated recall records.
- **Module disabled:** Cached recall data is preserved. Re-enabling restores the recall view. No network calls are made while disabled.
- **No network available:** VIN decode and recall check require network. Show clear error. All cached data (previous decodes, cached recalls) is still viewable offline.
- **Very old vehicle (pre-1981):** VINs before 1981 were not standardized to 17 characters. Show warning: "VINs before 1981 may not follow the standard 17-character format. NHTSA decode may not work for this vehicle."

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** On mobile, tapping "Scan VIN" opens the camera with a barcode scan overlay and instructional text.
- [ ] **AC-2:** Scanning a valid VIN barcode populates the VIN field and triggers decoding automatically.
- [ ] **AC-3:** Typing a valid 17-character VIN and tapping "Decode" shows a loading state, then displays decoded vehicle information (year, make, model, engine, transmission).
- [ ] **AC-4:** In the Add Vehicle flow, tapping "Use These Details" auto-fills the make, model, year, and fuel type fields from the decoded data.
- [ ] **AC-5:** On Vehicle Detail, tapping "Update Vehicle" updates the existing vehicle record with decoded make, model, and year.
- [ ] **AC-6:** Real-time validation shows specific error messages for invalid VIN length, forbidden characters (I, O, Q), and check digit failures.
- [ ] **AC-7:** After VIN decode, a "Check Recalls" button appears. Tapping it shows a loading state, then displays recall results or "No open recalls."
- [ ] **AC-8:** Each recall card shows component, summary, consequence, remedy, and NHTSA campaign number.
- [ ] **AC-9:** Tapping "Acknowledge" on a recall card marks it as seen and hides it from the active recall badge count.
- [ ] **AC-10:** Vehicle cards on the Dashboard show a red recall badge with the count of unacknowledged recalls.
- [ ] **AC-11:** The one-time privacy disclosure dialog appears before the first VIN decode and does not reappear after the user taps "Continue."
- [ ] **AC-12:** "Check All Recalls" in Settings checks recalls for all vehicles with VINs and displays results grouped by vehicle.
- [ ] **AC-13:** When NHTSA returns no results for a VIN, a clear message explains that the vehicle may not be in the US database.
- [ ] **AC-14:** When no network is available, VIN decode shows "Unable to reach NHTSA" with a retry button, and cached recall data is still viewable.

### Technical Criteria
- [ ] **TC-1:** Schema migration creates `cr_recalls` table with all columns, indexes, and correct `cr_` prefix.
- [ ] **TC-2:** `validateVin(vin)` correctly validates the 17-character format, forbidden characters, and check digit algorithm.
- [ ] **TC-3:** `decodeVin(vin)` calls the NHTSA vPIC API and returns a typed `VinDecodeResult` with year, make, model, engine, transmission, drivetrain, body class, plant country, and fuel type.
- [ ] **TC-4:** `parseNhtsaResponse(data)` correctly extracts fields from the NHTSA API's `Results` array (which uses `VariableId` + `Value` pairs).
- [ ] **TC-5:** `checkRecalls(make, model, year)` calls the NHTSA Recalls API and returns an array of typed `RecallInfo` objects.
- [ ] **TC-6:** `createRecall()` inserts a recall record. Duplicate campaign numbers for the same vehicle update `fetched_at` instead of creating duplicates.
- [ ] **TC-7:** `getRecallsByVehicle(vehicleId)` returns all recalls (acknowledged and unacknowledged) for the vehicle.
- [ ] **TC-8:** `getUnacknowledgedRecallCount(vehicleId)` returns the count of recalls where `is_acknowledged = 0`.
- [ ] **TC-9:** `acknowledgeRecall(id)` sets `is_acknowledged = 1`.
- [ ] **TC-10:** Deleting a vehicle CASCADE-deletes all associated recall records.
- [ ] **TC-11:** The privacy disclosure flag is persisted in `cr_settings` as `vin_privacy_disclosed`.
- [ ] **TC-12:** NHTSA API calls include proper error handling for 4xx, 5xx, and network timeout responses.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** VIN decode must NOT send any data other than the 17-character VIN string to NHTSA.
- [ ] **NC-2:** VIN decode must NOT store decoded data in any new columns. It writes to existing `cr_vehicles` columns (make, model, year) via the existing `updateVehicle` function.
- [ ] **NC-3:** Acknowledging a recall must NOT delete the recall record. It only sets `is_acknowledged = 1`.
- [ ] **NC-4:** Camera permission must NOT be requested at module enable or app launch. Only when the user taps "Scan VIN."
- [ ] **NC-5:** The VIN decode feature must NOT work offline. It requires a network call to NHTSA. Cached data is viewable but no new decodes or recall checks can be performed.
- [ ] **NC-6:** Recall checking must NOT auto-run on app launch or in the background. It only runs when the user explicitly triggers it.
- [ ] **NC-7:** VIN barcode scanning must NOT be available on web. Web users get manual entry only.

## UI Specification

### Mobile (Expo)

**VIN Input Component (used in Add Vehicle and Vehicle Detail):**
- Glass card: `rgba(255,255,255,0.04)` background, `rgba(255,255,255,0.10)` border
- VIN text input: monospace font, `fontSize: 18`, `letterSpacing: 1.5`, uppercase auto-transform
- Character counter below input: "12/17" in `rgba(240,240,245,0.65)` (textSecondary), turns green at 17
- Validation error text: `#FF453A` (danger), appears below the input inline
- Two buttons side by side below the input:
  - "Scan VIN" button: ghost style with camera icon, `rgba(255,255,255,0.08)` background
  - "Decode" button: solid style, accent `#6366F1` background when enabled, `rgba(99,102,241,0.3)` when disabled

**VIN Scanner Screen (mobile only):**
- Full-screen camera view
- Centered rectangular scan target: `borderWidth: 2`, `borderColor: #6366F1` (accent), `borderRadius: 8`
- Scan target dimensions: approximately 280px wide x 80px tall
- Instructional text below target: "Point camera at the VIN barcode" in white with text shadow for contrast
- Top-right close button: "X" icon, `rgba(0,0,0,0.5)` circular background
- On successful scan: brief green flash on the scan target border, haptic pulse, auto-dismiss

**Decode Results Card:**
- Glass card with accent-tinted top border (`rgba(99,102,241,0.2)`)
- Primary fields (large): Year, Make, Model in `#F0F0F5`, `fontSize: 20`, `fontWeight: 700`
- Secondary fields (detail grid, 2 columns):
  - Engine: e.g., "2.5L 4-Cylinder"
  - Transmission: e.g., "Automatic 8-Speed"
  - Drivetrain: e.g., "Front-Wheel Drive"
  - Body Class: e.g., "Sedan"
  - Fuel Type: e.g., "Gasoline"
  - Plant Country: e.g., "United States"
- Each field label in `rgba(240,240,245,0.65)`, value in `#F0F0F5`
- Action button: "Use These Details" or "Update Vehicle" in accent color, full-width

**Recalls Screen:**
- Background: `#0A0A0F` (background token)
- Header: "Safety Recalls" title, vehicle name subtitle
- No recalls state: centered green checkmark icon, "No open recalls" text in `#30D158`
- Recall cards: glass card style, stacked vertically
  - Component name: `fontSize: 16`, `fontWeight: 600`, `#F0F0F5`
  - Summary: `fontSize: 14`, `rgba(240,240,245,0.65)`, max 3 lines with "Read more" expand
  - Consequence: labeled section in `rgba(240,240,245,0.5)`
  - Remedy: labeled section in `rgba(240,240,245,0.5)`
  - Campaign number: small monospace text at bottom of card, `rgba(240,240,245,0.35)`
  - "Acknowledge" button: ghost style, right-aligned at card bottom
- Acknowledged recalls: visually muted (opacity 0.5), moved to "Acknowledged" collapsible section at bottom

**Recall Badge (on vehicle cards):**
- Small circular badge: `#FF453A` background, white text, `fontSize: 11`, `fontWeight: 700`
- Positioned at top-right corner of the vehicle card
- Shows count: "1", "2", "3+" (caps display at 3+ but shows exact count on tap)

**Privacy Disclosure Dialog:**
- Modal overlay: `rgba(10,10,15,0.85)` backdrop
- Glass card: `rgba(255,255,255,0.06)` background, centered
- Shield icon at top in accent color
- Title: "VIN Decode Privacy" in `#F0F0F5`
- Body text in `rgba(240,240,245,0.65)`, explaining what data is sent
- Three buttons stacked: "Continue" (accent solid), "Learn More" (ghost), "Cancel" (text-only)

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- VIN decode accessible at `/car/vin` route
- Recalls accessible at `/car/recalls` route
- Layout: sidebar navigation (existing car sidebar), main content area
- No camera/barcode scanning on web. VIN entry is manual only. The "Scan VIN" button is hidden on web.
- Decode results displayed in a two-column grid layout on wide screens
- Recall cards use the same glass morphism pattern with `backdrop-filter: blur(16px)`
- "Check All Recalls" available as a button on the recalls page header
- Privacy disclosure appears as a modal dialog matching the mobile design

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading (decode) | VIN input disabled, spinner with "Decoding VIN..." | API call in progress |
| Loading (recalls) | Spinner with "Checking for safety recalls..." | Recall API call in progress |
| Empty (no VIN) | "Add a VIN to decode vehicle info and check recalls" prompt | Vehicle has no VIN populated |
| Empty (no recalls) | Green checkmark, "No open recalls found" | API returns zero recalls |
| Error (invalid VIN) | Inline validation error below VIN input (red text) | VIN fails format/check digit validation |
| Error (network) | "Unable to reach NHTSA. Check your connection." + Retry button | API call fails (timeout, no network, 5xx) |
| Error (not found) | "NHTSA could not decode this VIN" explanation | API returns empty/null results |
| Error (camera denied) | "Camera access needed" message + manual entry fallback | Camera permission denied |
| Success (decoded) | Decoded results card with year, make, model, details | API returns valid decode data |
| Success (recalls found) | Recall cards with component, summary, remedy | API returns 1+ recalls |
| Success (recalls acknowledged) | Muted recall cards in "Acknowledged" section | User acknowledged all recalls |
| Partial (some fields decoded) | Available fields shown, "Unknown" for missing fields | API returns partial data |

## Test Requirements

### Unit Tests (modules/car/src/__tests__/vin-engine.test.ts)
- [ ] `validateVin("1HGBH41JXMN109186")`: returns `{ valid: true }` for a valid 17-character VIN
- [ ] `validateVin("1HGBH41JXMN10918")`: returns `{ valid: false, error: "must be 17 characters" }` for 16 chars
- [ ] `validateVin("1HGBH41JXMN1091867")`: returns `{ valid: false, error: "must be 17 characters" }` for 18 chars
- [ ] `validateVin("1HGBH4IJXMN109186")`: returns `{ valid: false, error: "cannot contain I, O, or Q" }` for VIN with I
- [ ] `validateVin("1HGBH4OJXMN109186")`: returns `{ valid: false, error: "cannot contain I, O, or Q" }` for VIN with O
- [ ] `validateVin("1HGBH4QJXMN109186")`: returns `{ valid: false, error: "cannot contain I, O, or Q" }` for VIN with Q
- [ ] `validateVin("")`: returns `{ valid: false, error: "must be 17 characters" }` for empty string
- [ ] `validateVin("abcde12345abcde12")`: handles lowercase input (should uppercase and validate)
- [ ] `calculateCheckDigit("1HGBH41JXMN109186")`: returns correct check digit character
- [ ] `calculateCheckDigit`: returns "X" when check digit is 10
- [ ] `parseNhtsaResponse(mockResponse)`: extracts year from VariableId 29 (ModelYear)
- [ ] `parseNhtsaResponse(mockResponse)`: extracts make from VariableId 26 (Make)
- [ ] `parseNhtsaResponse(mockResponse)`: extracts model from VariableId 28 (Model)
- [ ] `parseNhtsaResponse(mockResponse)`: extracts engine displacement from VariableId 13
- [ ] `parseNhtsaResponse(mockResponse)`: extracts cylinders from VariableId 14 (EngineCylinders)
- [ ] `parseNhtsaResponse(mockResponse)`: extracts fuel type from VariableId 24 (FuelTypePrimary)
- [ ] `parseNhtsaResponse(mockResponse)`: returns null for fields with empty/null Value in response
- [ ] `parseNhtsaResponse(emptyResponse)`: returns all-null result for empty Results array
- [ ] `mapNhtsaFuelType("Gasoline")`: returns "gas"
- [ ] `mapNhtsaFuelType("Diesel")`: returns "diesel"
- [ ] `mapNhtsaFuelType("Electric")`: returns "electric"
- [ ] `mapNhtsaFuelType("Gasoline/Electric")`: returns "hybrid"
- [ ] `mapNhtsaFuelType(null)`: returns null for unmapped/null fuel types
- [ ] `parseRecallResponse(mockResponse)`: extracts campaign number, component, summary, consequence, remedy from each recall
- [ ] `parseRecallResponse(emptyResponse)`: returns empty array for no recalls
- [ ] Zod `VinDecodeResultSchema`: validates a fully populated decode result
- [ ] Zod `VinDecodeResultSchema`: accepts a result with optional fields null
- [ ] Zod `RecallInfoSchema`: validates a fully populated recall object

### Integration Tests
- [ ] Full flow: call `decodeVin` with a known valid VIN, verify typed VinDecodeResult is returned with correct make/model/year (use mock HTTP or VCR cassette)
- [ ] Full flow: call `checkRecalls` with a known recalled vehicle, verify RecallInfo array is returned with at least one entry (use mock HTTP)
- [ ] Full flow: create recall records for a vehicle, acknowledge one, verify `getUnacknowledgedRecallCount` returns correct count
- [ ] Full flow: create recall with duplicate campaign number for same vehicle, verify no duplicate record (upsert behavior)
- [ ] Full flow: delete vehicle, verify all associated recall records CASCADE-deleted
- [ ] Error flow: call `decodeVin` with network error, verify graceful error return (not throw)
- [ ] Error flow: call `decodeVin` with a VIN that NHTSA cannot decode, verify empty/null result handling

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyCar module. Start the Add Vehicle flow. -- Verifies navigation.
3. Locate the VIN input field. Verify "Scan VIN" and "Decode" buttons are visible. Verify "Decode" is disabled. -- Corresponds to initial state.
4. Type "1HGBH" into the VIN field. Verify character counter shows "5/17". Verify "Decode" is still disabled. -- Verifies real-time validation.
5. Type "1HGBH4IJXMN109186" (contains I). Verify validation error: "VIN cannot contain I, O, or Q." -- Corresponds to AC-6.
6. Clear the field. Type a valid 17-character VIN (e.g., use a known test VIN). Verify "Decode" button becomes enabled and character counter turns green. -- Verifies validation success.
7. Tap "Decode." Verify privacy disclosure dialog appears on first use. -- Corresponds to AC-11.
8. Tap "Continue." Verify loading spinner with "Decoding VIN..." -- Verifies first-time disclosure flow.
9. Verify decoded results card appears showing Year, Make, Model, Engine, Transmission, Drivetrain, Body Class, Fuel Type, Plant Country. -- Corresponds to AC-3.
10. Tap "Use These Details." Verify the Add Vehicle form auto-fills Make, Model, Year, and Fuel Type from decoded data. -- Corresponds to AC-4.
11. Save the vehicle. Navigate to the vehicle's detail screen. -- Verifies vehicle creation with decoded data.
12. On Vehicle Detail, locate the VIN section. Tap "Check Recalls." -- Corresponds to AC-7.
13. Verify loading spinner with "Checking for safety recalls..." -- Loading state.
14. If recalls are found: verify recall cards show component, summary, consequence, remedy, and campaign number. -- Corresponds to AC-8.
15. If no recalls: verify green checkmark with "No open recalls." -- No-recall state.
16. If recalls were found, tap "Acknowledge" on one recall card. Verify it moves to the "Acknowledged" section with muted styling. -- Corresponds to AC-9.
17. Return to the MyCar Dashboard. If unacknowledged recalls remain, verify the vehicle card shows a red recall badge with the count. -- Corresponds to AC-10.
18. Tap the recall badge. Verify navigation to the recalls screen for that vehicle. -- Badge navigation.
19. Tap "Scan VIN" on the Add Vehicle screen. Verify camera opens with scan overlay. -- Corresponds to AC-1.
20. Scan a VIN barcode (use a printed test barcode or a second device displaying one). Verify the VIN is captured, the scanner closes, and decode begins automatically. -- Corresponds to AC-2.
21. If camera permission is denied: verify error message with manual entry fallback. -- Camera denied state.
22. Turn off network (airplane mode). Attempt to decode a VIN. Verify "Unable to reach NHTSA" error with retry button. -- Corresponds to AC-14.
23. Verify that previously cached recall data is still viewable while offline. -- Corresponds to AC-14.
24. Turn network back on. Tap "Retry." Verify decode succeeds. -- Retry flow.
25. Navigate to Car Settings. Tap "Check All Recalls." Verify recalls are checked for all vehicles with VINs and results are grouped by vehicle. -- Corresponds to AC-12.
26. Add a vehicle without a VIN. On Vehicle Detail, verify prompt "Add a VIN to decode vehicle info and check recalls." -- Empty VIN state.
27. Decode a VIN that returns different make/model than what the user entered. Verify comparison UI appears. -- Mismatch handling.
28. Delete a vehicle with recall records. Verify recall records are also removed. -- Corresponds to TC-10.
29. Repeat steps 3-15 on web at `/car/vin` and `/car/recalls`. Verify "Scan VIN" button is hidden on web. Verify manual decode and recall checking work. -- Web parity check (corresponds to NC-7).

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/car/vin` and `/car/recalls`, click every button, verify all states (loading, empty, error-network, error-invalid-vin, success-decoded, success-recalls, success-no-recalls)
- [ ] Batch QA: after 5 features in car module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `vin-engine.ts` (validateVin, parseNhtsaResponse, mapNhtsaFuelType, calculateCheckDigit)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- car module has active standalone counterpart (MyCar/)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Car module has 5 tables: `cr_vehicles`, `cr_maintenance`, `cr_fuel_logs`, `cr_settings`, `cr_maintenance_schedules`
- Schema version 2, migrations v1 and v2
- The `cr_vehicles` table has a `vin` column (TEXT, nullable) but no decode or validation logic
- No network calls anywhere in the car module
- No camera usage in the car module
- No recall tracking functionality exists
- The `requiresNetwork` flag on the module definition is `false`

### After This Work
- Car module has 6 tables (new: `cr_recalls`) with 3 new indexes
- Schema version 3 (or 4 if parking spec lands first), new migration added
- Full VIN lifecycle: validate format + check digit, scan barcode (mobile), decode via NHTSA API, auto-fill vehicle fields, cache results
- Full recall lifecycle: check via NHTSA API, display results, acknowledge individually, badge on vehicle cards, check all vehicles at once
- `vin-engine.ts` contains pure functions for VIN validation, check digit calculation, NHTSA response parsing, fuel type mapping
- Privacy disclosure flow for first-time NHTSA API usage
- The `requiresNetwork` flag should remain `false` on the module definition because the module works offline for all features except VIN decode and recall check. Network is optional, not required.

### Files Changed

- `modules/car/src/types.ts` -- Add VinDecodeResultSchema, RecallInfoSchema, NhtsaVariableSchema, VinValidationResult type, MeterFuelTypeMapping
- `modules/car/src/db/schema.ts` -- Add CREATE_RECALLS table, 3 indexes
- `modules/car/src/db/crud.ts` -- Add createRecall, getRecallsByVehicle, getUnacknowledgedRecallCount, acknowledgeRecall, upsertRecall
- `modules/car/src/engines/vin-engine.ts` -- NEW: validateVin, calculateCheckDigit, decodeVin, checkRecalls, parseNhtsaResponse, parseRecallResponse, mapNhtsaFuelType
- `modules/car/src/definition.ts` -- Add next migration version, update schemaVersion
- `modules/car/src/index.ts` -- Re-export new types and engine functions
- `modules/car/src/__tests__/vin-engine.test.ts` -- NEW: 28+ unit tests for VIN engine
- `apps/mobile/app/(car)/vin-scanner.tsx` -- NEW: Camera-based VIN barcode scanner
- `apps/mobile/app/(car)/recalls.tsx` -- NEW: Vehicle recalls screen
- `apps/mobile/app/(car)/components/VinInput.tsx` -- NEW: VIN input with validation and scan button
- `apps/web/app/car/vin/page.tsx` -- NEW: VIN decode web page (manual entry only)
- `apps/web/app/car/recalls/page.tsx` -- NEW: Recalls web page

### Known Limitations
- VIN decode requires network access. There is no offline decode capability (the NHTSA database is too large to bundle locally).
- The NHTSA vPIC API only covers vehicles sold in the United States. Grey-market imports, kit cars, and vehicles from other countries may not decode.
- Extended vehicle fields (engine displacement, cylinders, transmission, drivetrain, body class, plant country) are displayed but not persisted to `cr_vehicles` in MVP. Only make, model, year, and fuel type are auto-filled.
- VIN barcode scanning is mobile-only. Web users must type or paste the VIN manually.
- Recall data is a snapshot from the NHTSA API at the time of the check. It does not auto-update. Users must manually re-check for new recalls.
- The "acknowledge" action on recalls is a user-level dismissal, not a confirmation that the recall has been repaired. There is no integration with dealer service records.
- Check digit validation uses the standard NHTSA algorithm. Some non-US VINs or very old vehicles may have non-standard check digits. The feature warns but does not block in this case.
- No OCR-based VIN reading from photos of the VIN plate. Only barcode scanning is supported.

### Context for Next Agent
- The NHTSA vPIC API returns a `Results` array where each entry has `VariableId`, `Variable` (name), `Value`, and `ValueId`. The key VariableIds are: 26 (Make), 28 (Model), 29 (ModelYear), 13 (DisplacementL), 14 (EngineCylinders), 15 (EngineModel), 24 (FuelTypePrimary), 37 (TransmissionStyle), 15 (DriveType), 5 (BodyClass), 75 (PlantCountry). The `parseNhtsaResponse` function must handle these specific IDs.
- The NHTSA API URL format is: `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json`. No API key is needed.
- The NHTSA Recalls API URL is: `https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}`. It returns a `results` array with `NHTSACampaignNumber`, `Component`, `Summary`, `Consequence`, `Remedy` fields.
- The check digit algorithm for VINs is standardized: each character has a transliteration value, each position has a weight, the sum mod 11 yields the check digit (0-9 or X for 10). Position 9 is the check digit position. Implement this as a pure function in `vin-engine.ts`.
- The `decodeVin` and `checkRecalls` functions should use `fetch` directly (not Axios or other HTTP libraries) since both platforms (Expo and Next.js) support the Fetch API natively. Wrap in try/catch for network errors.
- The `requiresNetwork` flag on the module definition should stay `false`. VIN decode is an optional enhancement, not a core requirement. The module's primary functionality (maintenance logging, fuel tracking, schedules) is fully offline.
- If the parking-location-saver spec lands first and takes migration v3, this spec should use migration v4. Check `definition.ts` at build time to determine the next version number.
- The `expo-camera` dependency is only needed on mobile. Use dynamic imports or platform-specific file extensions (`.native.tsx` / `.web.tsx`) to avoid bundling camera code on web.
- Mock the NHTSA API calls in tests using fixture JSON files rather than hitting the live API. Sample responses for common VINs are available at the NHTSA API documentation site.
