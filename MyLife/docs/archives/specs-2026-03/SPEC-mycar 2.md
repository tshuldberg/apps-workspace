# MyCar - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** spec-mycar
> **Reviewer:** principal-architect

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyCar
- **Tagline:** Your complete vehicle companion
- **Module ID:** `car`
- **Feature ID Prefix:** CR
- **Table Prefix:** `cr_`
- **Tier:** Premium (included in MyLife Pro)
- **One-time Purchase (standalone):** $4.99

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Everyday Driver (Alex) | 25-45, drives daily for work/errands, owns 1-2 vehicles, comfortable with mobile apps but does not track car expenses today | Know when maintenance is due, stop guessing when the last oil change was, understand how much the car actually costs per month |
| Multi-Vehicle Household (Sam) | 30-55, manages 2-4 vehicles for a family, responsible for scheduling maintenance for everyone, juggles different service intervals | Track maintenance schedules across all family vehicles in one place, never miss an inspection or registration renewal, compare costs between vehicles |
| Mileage Tracker (Jordan) | 28-50, uses personal vehicle for work (rideshare, sales, real estate, deliveries), needs accurate mileage records for tax deductions | Log every trip with business/personal classification, generate IRS-compliant mileage reports, track fuel costs per mile for reimbursement |
| Budget-Conscious Owner (Riley) | 20-35, first car or used car owner, wants to understand true cost of ownership, may be deciding between keeping and replacing a vehicle | See total cost of ownership over time, track cost per mile, compare maintenance spending month over month, know if the car is becoming too expensive to keep |
| Privacy-First Car Enthusiast (Morgan) | 30-60, distrusts apps that track location or sell driving data, may currently use a paper logbook or spreadsheet, cares about vehicle details and history | Track everything about the car without sharing data with insurance companies or advertisers, keep a complete digital service history, store documents locally |

### 1.3 Core Value Proposition

MyCar is a privacy-first vehicle ownership companion that tracks maintenance schedules, fuel economy, expenses, trips, insurance documents, and vehicle history for multiple vehicles. Unlike Drivvo (ad-supported, optional cloud sync), Fuelio (cloud sync encouraged), or Expensify ($60+/yr, cloud-required), MyCar stores all data locally on the device with zero cloud dependency. Users get proactive maintenance reminders based on both mileage intervals and time intervals, VIN-decoded vehicle specs, and IRS-ready mileage reports without sharing their driving patterns, location history, or financial data with any server. The app costs a one-time $4.99 (standalone) or is included in MyLife Pro.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Drivvo (Free/Pro) | Comprehensive fuel and cost tracking, service reminders, multi-vehicle, reports | Ad-supported free tier, optional cloud sync that most users enable, no trip logging for tax deductions, no document storage | Privacy-first (no ads, no cloud), integrated trip logging with IRS categories, insurance document storage, VIN decoder |
| Fuelio (~$5 one-time) | Clean UI, fuel cost tracking, maintenance log, station price map | Android-centric (iOS version limited), encourages Google Drive sync, no document storage, no VIN decoder, no parking saver | Cross-platform parity, fully offline, document storage with expiry reminders, parking location saver |
| Expensify ($60/user/yr) | Excellent mileage tracking with GPS, receipt OCR, business expense reports, corporate features | Expensive recurring cost, cloud-required, business-focused, overkill for personal use, no maintenance tracking | Consumer-focused, one-time price, combines maintenance + fuel + mileage + documents in one app, no account required |
| Jerry (Free, insurance-focused) | Insurance comparison, service booking, cost estimates | Monetizes by selling user data to insurance companies, aggressive upselling, limited maintenance tracking | Zero data selling, no insurance upsells, comprehensive maintenance scheduling |
| AUTOsist (Free/Pro $3/mo) | Detailed vehicle records, multi-vehicle, reminders | Small team with infrequent updates, cloud sync for Pro features, dated UI | Active development, modern UI, fully offline Pro features, integrated hub ecosystem |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export (CSV, JSON) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export
- GPS/location data for trip tracking is processed and stored on-device only, never transmitted
- Parking location pins are stored locally and never shared
- VIN decoder uses the free NHTSA API; only the 17-character VIN is sent, never paired with user identity or other vehicle data
- Insurance document photos and policy details remain on-device; no upload, no cloud backup
- Odometer readings, fuel costs, and maintenance expenses are never shared with insurance companies, advertisers, or third parties

**Privacy marketing angle:** "Your car. Your data. Not your insurance company's data."

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| CR-001 | Vehicle Profiles | P0 | Core | None | Implemented |
| CR-002 | Maintenance Tracking | P0 | Core | CR-001 | Implemented |
| CR-003 | Fuel Logging | P0 | Core | CR-001 | Implemented |
| CR-004 | Smart Maintenance Reminders | P0 | Core | CR-001, CR-002 | Not Started |
| CR-005 | Mileage Tracking | P1 | Core | CR-001 | Not Started |
| CR-006 | Expense Dashboard | P1 | Analytics | CR-001, CR-002, CR-003 | Not Started |
| CR-007 | Trip Logging | P1 | Core | CR-001, CR-005 | Not Started |
| CR-008 | Insurance Document Storage | P1 | Data Management | CR-001 | Not Started |
| CR-009 | Registration and Inspection Tracker | P1 | Core | CR-001 | Not Started |
| CR-010 | VIN Decoder | P2 | Data Management | CR-001 | Not Started |
| CR-011 | Parking Location Saver | P2 | Core | None | Not Started |
| CR-012 | Recall Alerts | P2 | Data Management | CR-001, CR-010 | Not Started |
| CR-013 | Tire Tracking | P2 | Data Management | CR-001, CR-002 | Not Started |
| CR-014 | Data Export | P1 | Import/Export | CR-001 | Not Started |
| CR-015 | Data Import | P2 | Import/Export | CR-001 | Not Started |
| CR-016 | Onboarding Flow | P0 | Onboarding | None | Not Started |
| CR-017 | Settings and Preferences | P0 | Settings | None | Implemented |
| CR-018 | Vehicle Comparison Report | P2 | Analytics | CR-001, CR-006 | Not Started |
| CR-019 | Fuel Price Comparison | P3 | Data Management | CR-003 | Not Started |
| CR-020 | OBD-II Diagnostic Reader | P3 | Future | CR-001 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

**Category Legend:**
- **Core** - Fundamental product functionality
- **Data Management** - CRUD operations, organization, search, document storage
- **Analytics** - Stats, reports, insights, visualizations, cost analysis
- **Import/Export** - Data portability (import from other apps, export user data)
- **Settings** - User preferences, configuration, customization
- **Onboarding** - First-run experience, tutorials, sample data
- **Future** - Aspirational features requiring significant hardware or API integration

---

## 3. Feature Specifications

### 3.1 CR-001: Vehicle Profiles

#### 3.1.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to create a profile for my car with its year, make, model, and current mileage, so that all maintenance records and expenses are tied to the correct vehicle.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want to add and switch between multiple vehicle profiles, so that I can track maintenance and costs for every car in my family independently.

**Tertiary:**
> As a privacy-first car enthusiast (Morgan), I want to store detailed vehicle specifications (engine type, transmission, drivetrain, color, license plate) locally without creating an account, so that I have a complete digital record of my vehicles that no third party can access.

#### 3.1.2 UI Requirements

##### Screen: Vehicle List

**Layout:**
- The screen has a top navigation bar with the title "My Vehicles" and an "Add" button (plus icon) on the right
- The main content area is a vertically scrollable list of vehicle cards
- Each vehicle card displays: a vehicle photo (or placeholder silhouette), year/make/model as the title, current odometer reading, and a colored status indicator showing whether any maintenance is overdue
- Tapping a card navigates to the Vehicle Detail screen
- A vehicle can be designated as the "primary vehicle" with a star icon; the primary vehicle appears first in the list and is the default selection throughout the app

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No vehicles exist | Centered illustration of a car silhouette, heading "Add your first vehicle", subtext "Tap + to get started", and a prominent "Add Vehicle" button |
| Populated | 1+ vehicles exist | Scrollable list of vehicle cards sorted with primary vehicle first, then alphabetically by nickname or year/make/model |
| Single Vehicle | Exactly 1 vehicle | Same as populated but the vehicle is auto-designated as primary |

**Interactions:**
- Tap card: Navigate to Vehicle Detail screen
- Long press card: Show context menu with "Edit", "Set as Primary", "Delete" options
- Tap "Add" button: Navigate to Add/Edit Vehicle screen
- Swipe left on card: Reveal "Delete" action (with confirmation dialog)

##### Screen: Add/Edit Vehicle

**Layout:**
- Scrollable form with the following sections and fields:
  - **Photo** - Tap-to-add circular image area at the top (camera or photo library picker)
  - **Basic Info** - Nickname (optional, text, max 50 chars), Year (required, 4-digit number picker, range 1900 to current year + 1), Make (required, text, max 50 chars), Model (required, text, max 50 chars), Trim (optional, text, max 50 chars)
  - **Identification** - VIN (optional, text, exactly 17 alphanumeric characters), License Plate (optional, text, max 10 chars), License State/Region (optional, text, max 30 chars)
  - **Specifications** - Engine (optional, text, max 50 chars, e.g., "2.0L Turbo I4"), Transmission (optional, enum: Automatic, Manual, CVT, DCT, Other), Drivetrain (optional, enum: FWD, RWD, AWD, 4WD), Fuel Type (optional, enum: Regular, Mid-Grade, Premium, Diesel, E85, Electric, Hybrid), Color (optional, text, max 30 chars)
  - **Odometer** - Current Odometer (required, integer, min 0, max 999999), Odometer Unit (required, enum: miles, km, default: miles)
  - **Purchase Info** - Purchase Date (optional, date picker), Purchase Price (optional, currency, min 0, max 9999999.99), Purchase Odometer (optional, integer, min 0)
- Bottom bar with "Cancel" (left) and "Save" (right) buttons
- "Save" is disabled until all required fields are filled

**Interactions:**
- Tap photo area: Present action sheet with "Take Photo", "Choose from Library", "Remove Photo" options
- Tap Year field: Show year picker (scrollable wheel or number input)
- Tap VIN field: If 17 characters are entered and VIN decoding (CR-010) is enabled, show "Decode VIN" button that auto-fills Make, Model, Year, Engine, and Transmission from the NHTSA API
- Tap Save: Validate all fields, save vehicle, return to Vehicle List

##### Screen: Vehicle Detail

**Layout:**
- Top section: Vehicle photo (full width, 200pt height) with nickname or year/make/model overlaid at the bottom
- Below photo: Odometer reading prominently displayed with an "Update" button
- Quick stats row: Total expenses, fuel economy (last 10 fill-ups average), next maintenance due
- Tab-style segment control below stats: "Info", "Maintenance", "Fuel", "Documents"
- "Info" tab shows all vehicle specifications in a grouped list
- Other tabs deep-link into their respective module screens filtered to this vehicle

**Interactions:**
- Tap "Update" on odometer: Show odometer entry modal (numeric input, must be >= current reading)
- Tap quick stat: Navigate to the relevant detail screen (expenses, fuel log, maintenance)
- Tap "Edit" (top right): Navigate to Add/Edit Vehicle screen pre-filled with current data
- Pull down: Refresh maintenance status calculations

#### 3.1.3 Data Requirements

##### Entity: Vehicle

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique vehicle identifier |
| nickname | string | Optional, max 50 chars | null | User-assigned display name (e.g., "Dad's Truck") |
| year | integer | Required, min 1900, max current_year + 1 | None | Model year |
| make | string | Required, max 50 chars | None | Manufacturer (e.g., "Toyota") |
| model | string | Required, max 50 chars | None | Model name (e.g., "Camry") |
| trim | string | Optional, max 50 chars | null | Trim level (e.g., "XSE V6") |
| vin | string | Optional, exactly 17 alphanumeric chars, uppercase, excludes I/O/Q | null | Vehicle Identification Number |
| license_plate | string | Optional, max 10 chars | null | License plate number |
| license_state | string | Optional, max 30 chars | null | State or region of registration |
| engine | string | Optional, max 50 chars | null | Engine description |
| transmission | string | Optional, one of: automatic, manual, cvt, dct, other | null | Transmission type |
| drivetrain | string | Optional, one of: fwd, rwd, awd, 4wd | null | Drivetrain configuration |
| fuel_type | string | Optional, one of: regular, mid_grade, premium, diesel, e85, electric, hybrid | null | Primary fuel type |
| color | string | Optional, max 30 chars | null | Exterior color |
| odometer | integer | Required, min 0, max 999999 | None | Current odometer reading |
| odometer_unit | string | Required, one of: miles, km | miles | Unit for all odometer readings on this vehicle |
| purchase_date | string | Optional, ISO 8601 date | null | Date vehicle was purchased |
| purchase_price | float | Optional, min 0, max 9999999.99 | null | Purchase price in user's currency |
| purchase_odometer | integer | Optional, min 0 | null | Odometer reading at time of purchase |
| photo_uri | string | Optional, local file URI | null | Path to vehicle photo stored on device |
| is_primary | boolean | Only one vehicle can be true at a time | false | Whether this is the user's primary/default vehicle |
| is_active | boolean | - | true | Whether the vehicle is active (false = sold/retired but data preserved) |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

**Indexes:**
- is_primary - Fast lookup for default vehicle
- (is_active, year, make, model) - Sorted vehicle listing
- vin - Unique lookup for VIN-based operations

**Validation Rules:**
- year: Must be between 1900 and current_year + 1
- vin: If provided, must be exactly 17 characters, only A-Z (excluding I, O, Q) and 0-9
- odometer: Must be >= previous odometer reading (cannot decrease)
- is_primary: When set to true on one vehicle, all other vehicles must be set to false
- purchase_odometer: If provided, must be <= current odometer

#### 3.1.4 Business Logic

##### Primary Vehicle Selection

**Purpose:** Ensure exactly one vehicle is marked as primary when vehicles exist.

**Logic:**
```
1. IF user creates first vehicle:
     SET is_primary = true
2. IF user sets vehicle X as primary:
     SET is_primary = false for ALL vehicles
     SET is_primary = true for vehicle X
3. IF user deletes the primary vehicle:
     IF other vehicles exist:
       SET is_primary = true for the most recently created remaining vehicle
     ELSE:
       No primary vehicle (empty state)
4. IF user deactivates the primary vehicle:
     Same logic as delete (promote next most recent active vehicle)
```

##### Odometer Update Validation

**Purpose:** Ensure odometer readings only increase.

**Logic:**
```
1. RECEIVE new_odometer_reading
2. IF new_odometer_reading < vehicle.odometer:
     REJECT with error "Odometer reading cannot be less than the current reading of {vehicle.odometer}"
3. ELSE:
     SET vehicle.odometer = new_odometer_reading
     SET vehicle.updated_at = current_timestamp
```

**Edge Cases:**
- Odometer rollover (very old vehicles exceeding 999,999): Not supported; user should contact support
- Unit conversion: Odometer unit is set per vehicle and does not change; if user needs to switch, they must create a new vehicle profile

#### 3.1.5 API/Integration

- No external API calls required for basic vehicle profile management
- VIN decoding (CR-010) is an optional integration that can auto-fill vehicle specifications
- Vehicle photo is stored as a local file reference; the app manages photo storage in the app's documents directory

#### 3.1.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Required field left blank | Inline validation message below the field: "Year is required" | User fills in the field; error clears on input |
| Year out of range | Inline message: "Year must be between 1900 and {current_year + 1}" | User corrects the year value |
| VIN wrong length | Inline message: "VIN must be exactly 17 characters" | User corrects the VIN |
| VIN contains I, O, or Q | Inline message: "VIN cannot contain the letters I, O, or Q" | User corrects the VIN |
| Odometer decrease attempt | Modal alert: "Odometer reading cannot be less than the current reading of {current}" | User enters a value >= current reading |
| Database write fails | Toast notification: "Could not save vehicle. Please try again." | User taps retry or re-saves |
| Photo access denied | Alert: "Camera/photo access is needed to add a vehicle photo. You can enable it in Settings." | User grants permission in device Settings |
| Delete vehicle with records | Confirmation dialog: "Delete {vehicle_name}? This will also delete all maintenance records, fuel logs, and trip history for this vehicle. This cannot be undone." | User confirms or cancels |

**Validation Timing:**
- Field-level validation runs on blur (when user leaves the field)
- Form-level validation runs on Save tap
- Odometer validation runs on Update tap

#### 3.1.7 Performance Requirements

- Vehicle list loads within 200ms for up to 20 vehicles
- Vehicle detail screen loads within 300ms including photo thumbnail rendering
- Adding or editing a vehicle completes (database write + UI update) within 500ms
- Vehicle photo is compressed to max 1MB before storage; originals are not retained

#### 3.1.8 Accessibility

- All form fields have associated labels readable by screen readers
- Vehicle cards in the list announce: "{nickname or year make model}, {odometer} {unit}, {primary/secondary}" on focus
- Photo picker action sheet options are screen-reader accessible
- Minimum touch target size: 44x44 points for all interactive elements
- Color is not the sole indicator of any status (status indicators use both color and icon/text)
- Form field error messages are announced by screen reader when they appear (live region)

#### 3.1.9 Acceptance Criteria

**Happy Path:**

1. **Given** no vehicles exist,
   **When** the user taps "Add Vehicle" and fills in Year: 2022, Make: "Honda", Model: "Civic", Odometer: 15000,
   **Then** the vehicle is saved, appears in the vehicle list, and is automatically set as primary.

2. **Given** a vehicle exists with odometer 15000 miles,
   **When** the user taps "Update" on the odometer and enters 15500,
   **Then** the odometer updates to 15500 and the updated_at timestamp is refreshed.

3. **Given** two vehicles exist with Vehicle A as primary,
   **When** the user long-presses Vehicle B and selects "Set as Primary",
   **Then** Vehicle B shows the primary star icon and appears first in the list; Vehicle A no longer shows the star.

4. **Given** a vehicle with all optional fields filled in,
   **When** the user views the Vehicle Detail screen "Info" tab,
   **Then** all fields (VIN, license plate, engine, transmission, drivetrain, fuel type, color, purchase info) are displayed.

**Edge Cases:**

5. **Given** a vehicle with odometer 50000,
   **When** the user tries to update the odometer to 49999,
   **Then** the system rejects the input with the message "Odometer reading cannot be less than the current reading of 50000".

6. **Given** the primary vehicle is deleted and two other vehicles remain,
   **When** the deletion completes,
   **Then** the most recently created remaining vehicle is automatically promoted to primary.

**Negative Tests:**

7. **Given** the Add Vehicle form is open,
   **When** the user taps Save without filling in Year, Make, Model, or Odometer,
   **Then** inline validation errors appear on each required field and the vehicle is not saved.

#### 3.1.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates required fields are present | { make: "", model: "", year: null, odometer: null } | Validation errors for all four fields |
| accepts valid VIN format | vin: "1HGCM82633A004352" | No validation error |
| rejects VIN with letter O | vin: "1HGCM82633A00435O" | Validation error: "VIN cannot contain the letters I, O, or Q" |
| rejects VIN with wrong length | vin: "1HGCM826" | Validation error: "VIN must be exactly 17 characters" |
| rejects year below 1900 | year: 1899 | Validation error |
| rejects year above current + 1 | year: current_year + 2 | Validation error |
| validates odometer cannot decrease | current: 50000, new: 49999 | Validation error |
| accepts odometer equal to current | current: 50000, new: 50000 | No validation error |
| promotes next vehicle when primary is deleted | vehicles: [A(primary), B, C], delete: A | B becomes primary |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create first vehicle | 1. Open empty vehicle list, 2. Tap add, 3. Fill required fields, 4. Save | Vehicle appears in list with primary star |
| Edit vehicle details | 1. Open vehicle detail, 2. Tap edit, 3. Change nickname, 4. Save | Updated nickname appears on detail and list screens |
| Delete vehicle with maintenance records | 1. Create vehicle, 2. Add 3 maintenance records, 3. Delete vehicle | Vehicle and all associated records are removed |
| Update odometer from detail screen | 1. Open vehicle detail, 2. Tap update odometer, 3. Enter new value, 4. Confirm | New odometer value appears on detail and list card |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user adds two vehicles | 1. Launch app, 2. Add "Daily Driver" (2022 Civic, 15000mi), 3. Add "Weekend Car" (2019 Miata, 32000mi), 4. Set Miata as primary | Two vehicles in list, Miata first with star, Civic second |
| User adds vehicle with VIN decode | 1. Add vehicle, 2. Enter VIN, 3. Tap "Decode VIN", 4. Verify auto-filled fields, 5. Adjust odometer, 6. Save | Vehicle saved with VIN-decoded specs and user-entered odometer |

---

### 3.2 CR-002: Maintenance Tracking

#### 3.2.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to log every maintenance service (oil changes, brake jobs, tire rotations) with the date, mileage, cost, and shop name, so that I have a complete service history for my vehicle.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want to view the maintenance history for each vehicle separately and see which services were most recent, so that I can ensure no vehicle falls behind on maintenance.

**Tertiary:**
> As a budget-conscious owner (Riley), I want to see the total maintenance cost for each vehicle over any time period, so that I can understand whether a vehicle is becoming too expensive to maintain.

#### 3.2.2 UI Requirements

##### Screen: Maintenance Log

**Layout:**
- Top navigation bar with "Maintenance" title and vehicle selector dropdown (if multiple vehicles)
- Filter bar below navigation: "All", "Oil & Fluids", "Tires & Brakes", "Inspection", "Other" as horizontal chip/tab filters
- Sort control (top right area): "Date (Newest)", "Date (Oldest)", "Cost (High to Low)", "Cost (Low to High)"
- Main content is a chronologically grouped list (grouped by month/year headers)
- Each maintenance entry card shows: service type icon, service name, date, odometer reading, cost, and shop name (if provided)
- Floating action button (bottom right) to add new maintenance entry
- Summary bar at bottom of list: total entries count, total cost for the filtered view

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No maintenance records for selected vehicle | Centered wrench icon, "No maintenance records yet", "Tap + to log your first service" |
| Populated | 1+ records exist | Grouped chronological list with month/year headers |
| Filtered | A category filter is active | Only matching records shown; if none match, show "No {category} records" |
| Loading | Data is being computed/loaded | Skeleton cards (3-4 placeholder cards with shimmer) |

**Interactions:**
- Tap entry card: Navigate to Maintenance Detail screen (read-only view with all fields)
- Swipe left on entry: Reveal "Edit" and "Delete" actions
- Tap filter chip: Filter list to that category; active chip is highlighted
- Tap sort control: Toggle between sort options
- Tap floating action button: Navigate to Add Maintenance screen
- Pull to refresh: Recalculate summary totals

##### Screen: Add/Edit Maintenance

**Layout:**
- Scrollable form with sections:
  - **Service Type** - Required, segmented control or picker: Oil Change, Tire Rotation, Brake Service, Air Filter, Transmission Fluid, Battery, Inspection, Wash/Detail, Body Work, Other (with custom text field)
  - **Date** - Required, date picker, default: today
  - **Odometer** - Required, integer, must be >= vehicle's last recorded odometer
  - **Cost** - Optional, currency input, min 0, max 99999.99
  - **Shop/Location** - Optional, text, max 100 chars
  - **Notes** - Optional, multiline text, max 500 chars
  - **Parts Replaced** - Optional, repeatable group: part name (text, max 50 chars), part cost (currency), part number (text, max 30 chars)
  - **Attachments** - Optional, up to 5 photos (receipt photos, before/after)
- Bottom bar: "Cancel" and "Save" buttons

**Interactions:**
- Tap Service Type: Expand picker with predefined types plus "Other" option
- Tap "Other": Reveal a text input for custom service type name
- Tap "Add Part": Append a new part row to the Parts Replaced section
- Tap photo attachment area: Present camera/photo library picker
- Tap Save: Validate, save record, update vehicle odometer if the entry odometer is higher than current

##### Screen: Maintenance Detail

**Layout:**
- Read-only view showing all fields from the maintenance record in a grouped card layout
- Top section: Service type icon and name, date formatted as "Month DD, YYYY"
- Details section: Odometer, cost, shop name, notes
- Parts section: Table of replaced parts with name, cost, part number
- Attachments section: Scrollable photo thumbnails (tap to view full-screen)
- Action bar at bottom: "Edit" and "Delete" buttons

#### 3.2.3 Data Requirements

##### Entity: MaintenanceRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique record identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| service_type | string | Required, one of: oil_change, tire_rotation, brake_service, air_filter, transmission_fluid, battery, inspection, wash_detail, body_work, other | None | Category of service performed |
| service_type_custom | string | Required if service_type is "other", max 50 chars | null | User-defined service type name |
| service_date | string | Required, ISO 8601 date | Today's date | Date service was performed |
| odometer | integer | Required, min 0, max 999999 | None | Odometer reading at time of service |
| cost | float | Optional, min 0, max 99999.99 | null | Total cost of the service |
| shop_name | string | Optional, max 100 chars | null | Name of the shop or service location |
| notes | string | Optional, max 500 chars | null | Additional details or observations |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

##### Entity: MaintenancePart

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique part identifier |
| maintenance_id | string | Required, references MaintenanceRecord.id | None | Associated maintenance record |
| part_name | string | Required, max 50 chars | None | Name of the part |
| part_cost | float | Optional, min 0, max 9999.99 | null | Cost of the individual part |
| part_number | string | Optional, max 30 chars | null | Manufacturer part number |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

##### Entity: MaintenanceAttachment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique attachment identifier |
| maintenance_id | string | Required, references MaintenanceRecord.id | None | Associated maintenance record |
| photo_uri | string | Required, local file URI | None | Path to the photo file on device |
| caption | string | Optional, max 100 chars | null | Description of the photo |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- MaintenanceRecord belongs to Vehicle (many-to-one via vehicle_id)
- MaintenanceRecord has many MaintenancePart (one-to-many via maintenance_id)
- MaintenanceRecord has many MaintenanceAttachment (one-to-many via maintenance_id, max 5)

**Indexes:**
- (vehicle_id, service_date DESC) - Fast chronological listing per vehicle
- (vehicle_id, service_type) - Filtered listing by service type
- (vehicle_id, odometer DESC) - Mileage-sorted listing

#### 3.2.4 Business Logic

##### Odometer Sync on Maintenance Entry

**Purpose:** Keep the vehicle's odometer current when a maintenance entry has a higher reading.

**Logic:**
```
1. RECEIVE maintenance_record with odometer value
2. FETCH vehicle WHERE id = maintenance_record.vehicle_id
3. IF maintenance_record.odometer > vehicle.odometer:
     SET vehicle.odometer = maintenance_record.odometer
     SET vehicle.updated_at = current_timestamp
4. VALIDATE maintenance_record.odometer >= vehicle.purchase_odometer (if set)
5. SAVE maintenance_record
```

##### Maintenance Cost Aggregation

**Purpose:** Calculate total maintenance cost over a time period for a vehicle.

**Logic:**
```
1. RECEIVE vehicle_id, start_date, end_date
2. QUERY all MaintenanceRecord WHERE vehicle_id = vehicle_id
     AND service_date >= start_date
     AND service_date <= end_date
3. total_cost = SUM(cost) for all matching records (treat null cost as 0)
4. record_count = COUNT of matching records
5. RETURN { total_cost, record_count, average_cost: total_cost / record_count }
```

**Edge Cases:**
- No records in date range: Return { total_cost: 0, record_count: 0, average_cost: 0 }
- Records with null cost: Excluded from total_cost sum but included in record_count
- Date range spanning zero days: Valid (single-day query)

#### 3.2.5 API/Integration

- No external API calls required
- All data is stored locally in SQLite
- Maintenance records are self-contained and do not depend on network connectivity
- Photo attachments are stored as local file references in the app's documents directory

#### 3.2.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Service type not selected | Inline message: "Please select a service type" | User selects a service type |
| Odometer below vehicle's current reading | Warning (not blocking): "This odometer reading is lower than the vehicle's current reading of {current}. Save anyway?" | User confirms or corrects |
| Cost entered as negative | Inline message: "Cost must be $0 or more" | User corrects the value |
| More than 5 attachments | Toast: "Maximum 5 photos per service record" | User removes a photo before adding another |
| Photo storage fails (disk full) | Alert: "Not enough storage to save this photo. Free up space and try again." | User frees device storage |
| Delete record with attachments | Confirmation: "Delete this maintenance record and its {N} photos? This cannot be undone." | User confirms or cancels; on confirm, both record and photo files are deleted |

**Validation Timing:**
- Service type validation: On Save tap
- Odometer validation: On blur and on Save tap
- Cost validation: On blur

#### 3.2.7 Performance Requirements

- Maintenance log loads within 300ms for up to 500 records per vehicle
- Adding a maintenance record (with up to 5 compressed photos) completes within 1 second
- Category filter applies within 100ms
- Cost aggregation query returns within 200ms for up to 1000 records

#### 3.2.8 Accessibility

- Service type picker options are screen-reader labeled with full names (e.g., "Oil Change" not just an icon)
- Maintenance entry cards announce: "{service_type}, {date}, {cost or 'no cost recorded'}, {odometer} {unit}" on focus
- Swipe actions (Edit, Delete) have accessible alternatives via long-press context menu
- Photo attachments have alt text: "Maintenance photo {N} of {total}" or user-provided caption
- Currency input announces currency symbol and value
- Minimum touch target: 44x44 points

#### 3.2.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle exists with odometer 25000,
   **When** the user adds an oil change entry with date "2026-03-01", odometer 25500, cost $45.00, shop "Quick Lube",
   **Then** the record appears in the maintenance log, and the vehicle's odometer updates to 25500.

2. **Given** 12 maintenance records exist for a vehicle,
   **When** the user selects the "Oil & Fluids" filter,
   **Then** only oil change and transmission fluid records are shown.

3. **Given** a maintenance record exists with 3 photo attachments,
   **When** the user taps a photo thumbnail,
   **Then** the photo opens in a full-screen viewer with swipe navigation between photos.

**Edge Cases:**

4. **Given** a vehicle with odometer 30000,
   **When** the user enters a maintenance record with odometer 29000,
   **Then** a warning asks "This odometer reading is lower than the vehicle's current reading of 30000. Save anyway?" with Yes/No options.

5. **Given** a maintenance record with service_type "other" and custom name "Windshield Repair",
   **When** the user views the maintenance log,
   **Then** the entry shows "Windshield Repair" as the service name.

**Negative Tests:**

6. **Given** the Add Maintenance form is open,
   **When** the user taps Save without selecting a service type,
   **Then** inline validation error "Please select a service type" appears and the record is not saved.

7. **Given** the user is adding a maintenance record,
   **When** the user tries to add a 6th photo attachment,
   **Then** a toast message "Maximum 5 photos per service record" appears and the 6th photo is not added.

#### 3.2.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates total maintenance cost | records: [{cost: 45}, {cost: 120}, {cost: null}] | total: 165, count: 3, average: 55 |
| filters records by service type | records with mixed types, filter: "oil_change" | Only oil_change records returned |
| validates custom service type required when type is "other" | { service_type: "other", service_type_custom: "" } | Validation error |
| syncs vehicle odometer on higher reading | vehicle.odometer: 25000, record.odometer: 25500 | vehicle.odometer updated to 25500 |
| does not sync vehicle odometer on lower reading | vehicle.odometer: 25000, record.odometer: 24000 | vehicle.odometer remains 25000 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add maintenance and verify list | 1. Add oil change record, 2. Return to log | New entry appears at top of list under current month header |
| Delete maintenance and verify totals | 1. Note total cost, 2. Delete a $45 record, 3. Check totals | Total cost decreased by $45 |
| Edit maintenance odometer | 1. Edit a record, 2. Change odometer to higher value, 3. Save | Record updated, vehicle odometer synced |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Log a complete service with parts and photos | 1. Add oil change, 2. Enter cost $89, 3. Add part "Oil Filter" $12, 4. Attach receipt photo, 5. Save | Record shows in log with parts breakdown and photo; vehicle odometer updated |

---

### 3.3 CR-003: Fuel Logging

#### 3.3.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to log each fuel fill-up with gallons, price, and odometer reading, so that I can track my fuel costs and see how my car's fuel economy changes over time.

**Secondary:**
> As a budget-conscious owner (Riley), I want to see my average miles per gallon (MPG) and cost per mile for fuel, so that I can understand the true fuel cost of my vehicle and compare it against other vehicles I own.

**Tertiary:**
> As a mileage tracker (Jordan), I want to record partial fill-ups and full fill-ups separately, so that the fuel economy calculation only uses complete tank-to-tank measurements.

#### 3.3.2 UI Requirements

##### Screen: Fuel Log

**Layout:**
- Top navigation bar with "Fuel" title and vehicle selector dropdown
- Summary card at the top showing: average MPG (last 10 fill-ups), total fuel cost (selected period), average price per gallon
- Period selector below summary: "Month", "Quarter", "Year", "All Time" as segmented control
- Main content is a reverse-chronological list of fuel entries
- Each fuel entry card shows: date, gallons, price per gallon, total cost, odometer, MPG for that fill-up (if calculable), and a "Partial" badge if it was not a full fill-up
- Floating action button to add new fuel entry
- Optional mini chart (sparkline) in the summary card showing MPG trend over last 10 fill-ups

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No fuel records for selected vehicle | Fuel pump icon, "No fill-ups logged yet", "Tap + to log your first fill-up" |
| Populated | 1+ records exist | Chronological list with summary card |
| Insufficient Data | Fewer than 2 full fill-ups | Summary card shows "Log at least 2 full fill-ups to calculate fuel economy" for MPG |
| Period Empty | No records in selected time period | "No fill-ups in {period}" with the list empty but summary card showing zeros |

**Interactions:**
- Tap fuel entry: Navigate to Fuel Detail screen
- Swipe left on entry: Reveal "Edit" and "Delete" actions
- Tap period selector: Recalculate summary stats for the selected period
- Tap floating action button: Navigate to Add Fuel Entry screen
- Tap MPG sparkline: Navigate to Fuel Economy trend screen (full chart)

##### Screen: Add/Edit Fuel Entry

**Layout:**
- Scrollable form with fields:
  - **Date** - Required, date picker, default: today
  - **Odometer** - Required, integer, must be >= previous fuel entry's odometer for this vehicle
  - **Fuel Amount** - Required, float, min 0.001, max 999.999, unit label shows "gal" or "L" based on vehicle preference
  - **Price Per Unit** - Required, currency, min 0.001, max 99.999 (price per gallon or liter)
  - **Total Cost** - Auto-calculated (fuel_amount * price_per_unit), but editable to override for manual totals
  - **Full Tank** - Required, toggle switch, default: on. Indicates whether the tank was filled completely
  - **Station Name** - Optional, text, max 100 chars
  - **Fuel Grade** - Optional, picker: Regular, Mid-Grade, Premium, Diesel, E85 (defaults to vehicle's fuel_type if set)
  - **Notes** - Optional, multiline text, max 200 chars
- Auto-calculate: When fuel_amount and price_per_unit are both entered, total_cost auto-fills. When total_cost is manually edited, price_per_unit recalculates.
- Bottom bar: "Cancel" and "Save" buttons

##### Screen: Fuel Economy Trend

**Layout:**
- Line chart showing MPG over time (X axis: date, Y axis: MPG)
- Data points are individual fill-ups (only full-tank fill-ups contribute calculated MPG)
- Rolling average line overlay (10-fill-up rolling average)
- Stats below chart: Best MPG, Worst MPG, Average MPG, Standard Deviation
- Period selector: 3 months, 6 months, 1 year, All Time

#### 3.3.3 Data Requirements

##### Entity: FuelEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique entry identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| entry_date | string | Required, ISO 8601 date | Today's date | Date of fill-up |
| odometer | integer | Required, min 0, max 999999 | None | Odometer reading at fill-up |
| fuel_amount | float | Required, min 0.001, max 999.999 | None | Amount of fuel added (gallons or liters) |
| fuel_unit | string | Required, one of: gallons, liters | gallons | Unit of fuel measurement |
| price_per_unit | float | Required, min 0.001, max 99.999 | None | Price per gallon or liter |
| total_cost | float | Required, min 0, max 99999.99 | Calculated | Total cost of the fill-up |
| is_full_tank | boolean | Required | true | Whether this was a complete fill-up (tank filled to full) |
| station_name | string | Optional, max 100 chars | null | Name of the fuel station |
| fuel_grade | string | Optional, one of: regular, mid_grade, premium, diesel, e85 | null | Grade of fuel purchased |
| notes | string | Optional, max 200 chars | null | Additional notes |
| calculated_mpg | float | Auto-calculated, nullable | null | MPG calculated from this and previous full fill-up |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

**Indexes:**
- (vehicle_id, entry_date DESC) - Chronological listing per vehicle
- (vehicle_id, odometer DESC) - Odometer-sorted listing for MPG calculation
- (vehicle_id, is_full_tank, entry_date DESC) - Efficient fuel economy queries

**Validation Rules:**
- fuel_amount: Must be > 0
- price_per_unit: Must be > 0
- total_cost: If not manually overridden, must equal fuel_amount * price_per_unit (within 0.01 tolerance for rounding)
- odometer: Should be >= the most recent fuel entry's odometer for this vehicle (warn but allow override)

#### 3.3.4 Business Logic

##### MPG Calculation (Tank-to-Tank Method)

**Purpose:** Calculate fuel economy for each fill-up using the standard tank-to-tank method.

**Inputs:**
- current_entry: The fuel entry being saved (must be a full tank fill-up)
- previous_full_entry: The most recent previous full-tank fill-up for this vehicle

**Logic:**
```
1. IF current_entry.is_full_tank = false:
     SET current_entry.calculated_mpg = null
     RETURN (cannot calculate MPG on partial fill-up)

2. FIND previous_full_entry = most recent FuelEntry WHERE
     vehicle_id = current_entry.vehicle_id
     AND is_full_tank = true
     AND odometer < current_entry.odometer
     ORDER BY odometer DESC
     LIMIT 1

3. IF previous_full_entry is null:
     SET current_entry.calculated_mpg = null
     RETURN (first full fill-up, no baseline)

4. miles_driven = current_entry.odometer - previous_full_entry.odometer

5. FIND intermediate_entries = all FuelEntry WHERE
     vehicle_id = current_entry.vehicle_id
     AND odometer > previous_full_entry.odometer
     AND odometer <= current_entry.odometer
     AND id != previous_full_entry.id

6. total_fuel = SUM(fuel_amount) for intermediate_entries + current_entry.fuel_amount
   (This includes partial fill-ups between the two full fill-ups)

7. IF total_fuel = 0:
     SET current_entry.calculated_mpg = null
     RETURN

8. calculated_mpg = miles_driven / total_fuel
9. ROUND calculated_mpg to 1 decimal place
10. SET current_entry.calculated_mpg = calculated_mpg
```

**Edge Cases:**
- Partial fill-ups between two full fill-ups: Fuel from partial fills is included in total_fuel
- First ever fill-up: MPG is null (no baseline)
- Odometer rollover: Not supported; will produce unrealistic MPG
- Very short trip (< 1 mile between fill-ups): MPG may be unrealistic; store as calculated but flag in UI
- Division by zero: Guarded by step 7

##### Fuel Cost Aggregation

**Purpose:** Calculate total fuel cost and average price per unit over a time period.

**Logic:**
```
1. RECEIVE vehicle_id, start_date, end_date
2. QUERY entries = all FuelEntry WHERE vehicle_id AND entry_date BETWEEN start_date AND end_date
3. total_cost = SUM(total_cost) for all entries
4. total_fuel = SUM(fuel_amount) for all entries
5. entry_count = COUNT(entries)
6. average_price_per_unit = total_cost / total_fuel (if total_fuel > 0, else 0)
7. RETURN { total_cost, total_fuel, entry_count, average_price_per_unit }
```

##### Rolling Average MPG

**Purpose:** Calculate a smoothed fuel economy trend using a rolling window.

**Logic:**
```
1. RECEIVE vehicle_id, window_size (default: 10)
2. QUERY full_fillups = all FuelEntry WHERE vehicle_id AND is_full_tank = true
     AND calculated_mpg IS NOT NULL
     ORDER BY entry_date ASC
3. FOR each entry at index i in full_fillups:
     window_start = MAX(0, i - window_size + 1)
     window = full_fillups[window_start .. i]
     rolling_avg = AVERAGE(calculated_mpg) for entries in window
     STORE rolling_avg for this entry
4. RETURN array of { date, mpg, rolling_avg } for charting
```

#### 3.3.5 API/Integration

- No external API calls required
- All fuel data is stored locally in SQLite
- Fuel entries sync the vehicle's odometer (same pattern as maintenance records)

#### 3.3.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Fuel amount is zero or negative | Inline message: "Fuel amount must be greater than 0" | User corrects the value |
| Price per unit is zero or negative | Inline message: "Price must be greater than 0" | User corrects the value |
| Odometer lower than previous entry | Warning: "This odometer is lower than your last fill-up ({previous}). Save anyway?" | User confirms or corrects |
| Total cost and price * amount disagree (manual override) | No error; user-entered total cost takes precedence | None needed |
| Calculated MPG is unrealistic (> 200 or < 1) | Yellow info banner on the entry: "Fuel economy seems unusual. Check odometer and fuel amount." | User can edit the entry to correct values |
| Database write fails | Toast: "Could not save fill-up. Please try again." | User retaps Save |

**Validation Timing:**
- Field-level validation on blur for fuel_amount, price_per_unit
- Cross-field validation (total cost recalculation) on any field change
- Odometer validation on Save

#### 3.3.7 Performance Requirements

- Fuel log loads within 300ms for up to 500 entries per vehicle
- MPG calculation per entry completes within 50ms
- Rolling average calculation for 500 entries completes within 200ms
- Fuel Economy Trend chart renders within 500ms for 200 data points
- Period-based aggregation returns within 200ms

#### 3.3.8 Accessibility

- Fuel entry cards announce: "{date}, {fuel_amount} {unit} at ${price_per_unit}, total ${total_cost}, {mpg} MPG" on focus
- Partial fill-up badge announces "Partial fill-up" to screen readers
- Fuel Economy Trend chart has a text-based data table alternative accessible to screen readers
- Currency and numeric inputs announce their units
- Minimum touch target: 44x44 points

#### 3.3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle with one previous full fill-up at odometer 10000,
   **When** the user logs a full fill-up at odometer 10350 with 12.5 gallons,
   **Then** the entry is saved with calculated MPG of 28.0 (350 / 12.5).

2. **Given** 15 full fill-ups with calculated MPG values exist,
   **When** the user views the Fuel Economy Trend screen,
   **Then** a line chart shows individual MPG points and a rolling 10-fill-up average line.

3. **Given** fill-ups exist across multiple months,
   **When** the user selects "Quarter" in the period selector,
   **Then** the summary card shows total cost, average MPG, and average price per gallon for the current quarter only.

**Edge Cases:**

4. **Given** a full fill-up followed by two partial fill-ups and then another full fill-up,
   **When** the final full fill-up is saved,
   **Then** MPG is calculated using the total miles driven and total fuel from all three fill-ups since the last full tank.

5. **Given** only one fill-up exists for a vehicle,
   **When** the user views the fuel log,
   **Then** the MPG column shows "N/A" and the summary says "Log at least 2 full fill-ups to calculate fuel economy."

**Negative Tests:**

6. **Given** the Add Fuel Entry form is open,
   **When** the user enters fuel amount as 0,
   **Then** inline validation "Fuel amount must be greater than 0" appears and the entry is not saved.

7. **Given** a fill-up results in 350 MPG,
   **When** the entry is saved,
   **Then** a yellow info banner says "Fuel economy seems unusual. Check odometer and fuel amount."

#### 3.3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates MPG correctly (full tanks) | prev_odo: 10000, curr_odo: 10350, gallons: 12.5 | mpg: 28.0 |
| returns null MPG for partial fill-up | is_full_tank: false | calculated_mpg: null |
| returns null MPG for first fill-up | no previous entry | calculated_mpg: null |
| includes partial fill fuel in MPG calc | prev_full: 10000, partial: 10200 (5gal), curr_full: 10400 (8gal) | mpg: 400 / 13 = 30.8 |
| calculates rolling average (window 3) | mpg values: [25, 30, 28, 32, 26] | rolling: [25, 27.5, 27.7, 30.0, 28.7] |
| auto-calculates total cost | amount: 12.5, price: 3.459 | total: 43.24 (rounded to 2 decimal places) |
| handles zero fuel amount gracefully | fuel_amount: 0 | Validation error, not division by zero |
| flags unrealistic MPG | miles: 350, gallons: 1 | mpg: 350, flagged as unusual |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add fill-up and verify MPG | 1. Add first full fill-up at 10000mi, 2. Add second full fill-up at 10300mi with 10gal | Second entry shows 30.0 MPG |
| Delete fill-up and verify recalculation | 1. Have 3 fill-ups, 2. Delete the middle one | Third entry's MPG recalculates based on first entry |
| Period filter changes summary | 1. Add fill-ups across 2 months, 2. Switch period to current month | Summary reflects only current month's data |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Track fuel economy over 5 fill-ups | 1. Log 5 sequential full fill-ups with varying MPG, 2. View trend chart | Chart shows 5 data points, rolling average smooths the line, best/worst/average stats are accurate |

---

### 3.4 CR-004: Smart Maintenance Reminders

#### 3.4.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want the app to automatically remind me when oil changes, tire rotations, and other maintenance is due based on mileage or time intervals, so that I never miss a critical service.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want to see a unified "upcoming maintenance" view across all my vehicles, so that I can plan service appointments efficiently.

**Tertiary:**
> As a privacy-first car enthusiast (Morgan), I want all reminder calculations to happen on-device without any server communication, so that my driving patterns and vehicle data stay private.

#### 3.4.2 UI Requirements

##### Screen: Upcoming Maintenance

**Layout:**
- Top navigation bar with "Reminders" title
- Toggle to switch between "By Vehicle" and "All Vehicles" views
- In "All Vehicles" view: flat list sorted by urgency (overdue first, then soonest due)
- In "By Vehicle" view: collapsible sections per vehicle, each showing that vehicle's upcoming items
- Each reminder card shows: service type icon, service name, due condition ("Due in 1,200 miles or 2 months"), status badge (Overdue / Due Soon / OK), vehicle name (in "All Vehicles" view)
- Status badge colors: Red for Overdue, Yellow/Amber for Due Soon (within 500 miles or 30 days), Green for OK
- Status badges also use icons in addition to color: exclamation mark for Overdue, clock for Due Soon, checkmark for OK
- Tap a reminder: Show detail with options to "Log Service" (navigates to Add Maintenance pre-filled) or "Snooze" (push due date/mileage forward)
- "Add Custom Reminder" button at the bottom to create user-defined reminders beyond the presets

##### Modal: Reminder Detail

**Layout:**
- Service type name and icon at top
- Current status with explanation: "Oil change is overdue by 500 miles" or "Oil change is due in 1,200 miles or by April 2026"
- History section: Last time this service was performed (date, odometer, cost)
- Action buttons: "Log Service Now" (opens Add Maintenance pre-filled), "Snooze 500 miles / 1 month", "Edit Interval", "Dismiss Reminder"

##### Modal: Add/Edit Reminder Schedule

**Layout:**
- Service type selector (preset list + "Custom" option with text field)
- Interval type: "Mileage", "Time", or "Both" (segmented control)
- Mileage interval: integer input (e.g., 5000), unit label (miles/km)
- Time interval: number + unit picker (months or years)
- Last service date: date picker (auto-populated from most recent matching maintenance record)
- Last service odometer: integer input (auto-populated from most recent matching maintenance record)
- "Save" and "Cancel" buttons

#### 3.4.3 Data Requirements

##### Entity: MaintenanceSchedule

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique schedule identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| service_type | string | Required, one of: oil_change, tire_rotation, brake_inspection, air_filter, transmission_fluid, coolant, spark_plugs, timing_belt, battery, inspection, registration, custom | None | Type of maintenance |
| service_type_custom | string | Required if service_type is "custom", max 50 chars | null | User-defined service name |
| interval_miles | integer | Optional, min 500, max 200000 | null | Mileage interval (e.g., 5000 for every 5000 miles) |
| interval_months | integer | Optional, min 1, max 120 | null | Time interval in months |
| last_service_date | string | Optional, ISO 8601 date | null | Date of the most recent service |
| last_service_odometer | integer | Optional, min 0 | null | Odometer at most recent service |
| next_due_odometer | integer | Calculated | null | Odometer at which next service is due |
| next_due_date | string | Calculated, ISO 8601 date | null | Date by which next service is due |
| is_active | boolean | - | true | Whether this reminder is active |
| snooze_miles | integer | Optional, min 0 | 0 | Additional miles added via snooze |
| snooze_date_offset_days | integer | Optional, min 0 | 0 | Additional days added via snooze |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

**Validation Rules:**
- At least one of interval_miles or interval_months must be provided
- last_service_date and last_service_odometer: If one is provided, both should be provided (warn if not)
- interval_miles must be in increments of 500
- interval_months must be a whole number

**Indexes:**
- (vehicle_id, is_active) - Active reminders per vehicle
- (next_due_date ASC) - Sort by soonest due date
- (next_due_odometer ASC) - Sort by soonest due mileage

#### 3.4.4 Business Logic

##### Default Maintenance Schedules

**Purpose:** Provide recommended maintenance intervals for new vehicles.

**Presets:**
```
DEFAULT_SCHEDULES = [
  { service_type: "oil_change",         interval_miles: 5000,   interval_months: 6  },
  { service_type: "tire_rotation",      interval_miles: 7500,   interval_months: null },
  { service_type: "brake_inspection",   interval_miles: 20000,  interval_months: null },
  { service_type: "air_filter",         interval_miles: 15000,  interval_months: 12  },
  { service_type: "transmission_fluid", interval_miles: 30000,  interval_months: null },
  { service_type: "coolant",            interval_miles: 30000,  interval_months: 24  },
  { service_type: "spark_plugs",        interval_miles: 60000,  interval_months: null },
  { service_type: "battery",            interval_miles: null,    interval_months: 48  },
]
```

When a new vehicle is created, the system offers to apply default schedules. The user can accept, customize, or skip.

##### Reminder Due Calculation

**Purpose:** Determine when each maintenance item is next due and its current status.

**Logic:**
```
1. RECEIVE schedule (MaintenanceSchedule)
2. FETCH vehicle WHERE id = schedule.vehicle_id

3. // Calculate mileage-based due
   IF schedule.interval_miles IS NOT NULL AND schedule.last_service_odometer IS NOT NULL:
     next_due_odometer = schedule.last_service_odometer + schedule.interval_miles + schedule.snooze_miles
   ELSE:
     next_due_odometer = null

4. // Calculate time-based due
   IF schedule.interval_months IS NOT NULL AND schedule.last_service_date IS NOT NULL:
     next_due_date = schedule.last_service_date + schedule.interval_months months + schedule.snooze_date_offset_days days
   ELSE:
     next_due_date = null

5. // Determine status
   today = current_date
   current_odometer = vehicle.odometer

   overdue_by_miles = false
   overdue_by_date = false
   due_soon_by_miles = false
   due_soon_by_date = false

   IF next_due_odometer IS NOT NULL:
     IF current_odometer >= next_due_odometer:
       overdue_by_miles = true
     ELSE IF current_odometer >= next_due_odometer - 500:
       due_soon_by_miles = true

   IF next_due_date IS NOT NULL:
     IF today >= next_due_date:
       overdue_by_date = true
     ELSE IF today >= next_due_date - 30 days:
       due_soon_by_date = true

6. // Final status (whichever is more urgent wins)
   IF overdue_by_miles OR overdue_by_date:
     status = "overdue"
   ELSE IF due_soon_by_miles OR due_soon_by_date:
     status = "due_soon"
   ELSE:
     status = "ok"

7. RETURN { next_due_odometer, next_due_date, status, overdue_by_miles, overdue_by_date }
```

##### Auto-Link Maintenance Records to Schedules

**Purpose:** When a maintenance record is logged, automatically update the corresponding schedule.

**Logic:**
```
1. WHEN a MaintenanceRecord is saved:
2. FIND matching_schedule = MaintenanceSchedule WHERE
     vehicle_id = record.vehicle_id
     AND service_type = record.service_type
     AND is_active = true
3. IF matching_schedule exists:
     SET matching_schedule.last_service_date = record.service_date
     SET matching_schedule.last_service_odometer = record.odometer
     SET matching_schedule.snooze_miles = 0
     SET matching_schedule.snooze_date_offset_days = 0
     RECALCULATE next_due_odometer and next_due_date
```

##### Push Notification Scheduling

**Purpose:** Send local push notifications when maintenance is due.

**Logic:**
```
1. EVERY time a schedule is created, updated, or a vehicle odometer changes:
2. FOR each active schedule:
     CALCULATE status using Reminder Due Calculation
     IF status = "due_soon":
       SCHEDULE local notification:
         title: "{vehicle_name}: {service_type} due soon"
         body: "Due in {remaining_miles} miles or by {due_date}"
         trigger: immediate if not already notified for this cycle
     IF status = "overdue":
       SCHEDULE local notification:
         title: "{vehicle_name}: {service_type} overdue"
         body: "Overdue by {over_miles} miles or {over_days} days"
         trigger: immediate, repeat weekly until resolved
3. All notification scheduling happens on-device using local notifications
```

#### 3.4.5 API/Integration

- No external API calls required
- Uses local push notifications (platform notification APIs) for reminders
- All calculation logic runs on-device
- Notification permissions are requested on first reminder creation, not at app launch

#### 3.4.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No interval specified | Inline message: "Please set a mileage interval, time interval, or both" | User fills in at least one interval |
| Notification permission denied | Info banner: "Enable notifications in Settings to receive maintenance reminders" | User can still see reminders in-app; banner links to device Settings |
| Last service data missing | Warning: "Set your last service date and odometer for accurate reminders" | User can enter values or schedule auto-populates from maintenance records |
| Schedule conflict (duplicate service type for same vehicle) | Confirmation: "You already have an {service_type} reminder for this vehicle. Replace it?" | User confirms replacement or cancels |
| Snooze limit reached (3 consecutive snoozes) | Warning: "This service has been snoozed 3 times. Consider scheduling it soon." | User can still snooze but sees the warning |

#### 3.4.7 Performance Requirements

- Reminder status calculation for all schedules across all vehicles completes within 300ms (up to 20 vehicles, 10 schedules each)
- Notification scheduling completes within 500ms after odometer update
- Upcoming Maintenance screen loads within 400ms
- Auto-link after maintenance record save completes within 200ms

#### 3.4.8 Accessibility

- Reminder status badges announce full text: "Oil change is overdue", "Tire rotation is due soon", "Brake inspection is up to date"
- Status uses both color and icon (not color alone): red exclamation for overdue, amber clock for due soon, green checkmark for OK
- Snooze action confirms with haptic feedback and screen reader announcement
- Reminder cards announce: "{service_type}, {status}, due in {miles} miles or by {date}" on focus
- Minimum touch target: 44x44 points

#### 3.4.9 Acceptance Criteria

**Happy Path:**

1. **Given** a new vehicle is created,
   **When** the user accepts default maintenance schedules,
   **Then** 8 reminder schedules are created with the default intervals (oil: 5000mi/6mo, tire: 7500mi, etc.).

2. **Given** an oil change schedule with last service at 20000 miles and interval of 5000 miles, and the vehicle is at 24800 miles,
   **When** the user views Upcoming Maintenance,
   **Then** the oil change shows status "Due Soon" with "Due in 200 miles".

3. **Given** a maintenance record for "oil_change" is saved for a vehicle,
   **When** the record is saved,
   **Then** the oil change schedule's last_service_date and last_service_odometer are automatically updated, and the snooze values reset to 0.

4. **Given** the vehicle's odometer passes the due mileage for a tire rotation,
   **When** the user next opens the app,
   **Then** the tire rotation shows "Overdue" status with a red badge, and a local notification was sent (if permissions granted).

**Edge Cases:**

5. **Given** a schedule with only a time interval (no mileage interval),
   **When** the due date passes,
   **Then** the reminder shows overdue based on the date alone, with no mileage information displayed.

6. **Given** a user snoozes a reminder 3 times,
   **When** the user attempts a 4th snooze,
   **Then** the snooze is allowed but a warning message appears: "This service has been snoozed 3 times. Consider scheduling it soon."

**Negative Tests:**

7. **Given** the user creates a custom reminder,
   **When** neither mileage nor time interval is set,
   **Then** the system shows "Please set a mileage interval, time interval, or both" and does not save the schedule.

#### 3.4.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates next due odometer | last_odometer: 20000, interval: 5000, snooze: 0 | next_due: 25000 |
| calculates next due odometer with snooze | last_odometer: 20000, interval: 5000, snooze: 500 | next_due: 25500 |
| calculates next due date | last_date: "2026-01-01", interval_months: 6, snooze_days: 0 | next_due: "2026-07-01" |
| returns overdue status when past mileage | vehicle_odo: 26000, next_due: 25000 | status: "overdue" |
| returns due_soon when within 500 miles | vehicle_odo: 24600, next_due: 25000 | status: "due_soon" |
| returns ok when not near due | vehicle_odo: 21000, next_due: 25000 | status: "ok" |
| overdue by date takes precedence over ok by mileage | date: overdue, mileage: ok | status: "overdue" |
| auto-links maintenance record to schedule | record: { service_type: "oil_change", odometer: 25200 } | schedule.last_service_odometer = 25200, snooze reset to 0 |
| creates 8 default schedules for new vehicle | vehicle_id: "abc" | 8 MaintenanceSchedule records created |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create vehicle and accept defaults | 1. Add vehicle, 2. Accept default schedules | 8 active reminders appear on Upcoming Maintenance screen |
| Log service and verify schedule update | 1. Have oil_change schedule, 2. Log oil change at 25000 | Schedule's last_service_odometer updates to 25000, next_due recalculates to 30000 |
| Snooze a reminder | 1. View overdue reminder, 2. Tap "Snooze 500 miles" | next_due_odometer increases by 500, status recalculates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full reminder lifecycle | 1. Create vehicle at 20000mi, 2. Accept default oil schedule (5000mi), 3. Drive to 24800mi (update odometer), 4. See "Due Soon" badge, 5. Log oil change at 25100, 6. See schedule reset with next due at 30100 | Reminder cycle completes with all statuses observed: OK, Due Soon, and reset after service |

---

### 3.5 CR-005: Mileage Tracking

#### 3.5.1 User Stories

**Primary:**
> As a mileage tracker (Jordan), I want to record my daily odometer readings or let the app estimate mileage from trip logs, so that I have an accurate record of how many miles I drive for tax and reimbursement purposes.

**Secondary:**
> As an everyday driver (Alex), I want to see how many miles I drive per week, month, and year, so that I can understand my driving habits and anticipate when maintenance will be due.

**Tertiary:**
> As a budget-conscious owner (Riley), I want to track total miles driven since purchase to calculate my true cost per mile, so that I can evaluate whether keeping or replacing my vehicle makes financial sense.

#### 3.5.2 UI Requirements

##### Screen: Mileage Dashboard

**Layout:**
- Top navigation bar with "Mileage" title and vehicle selector dropdown
- Hero stat card at top showing: current odometer, total miles driven (since purchase or since first recorded reading), and estimated annual mileage
- Period summary row: "This Week", "This Month", "This Year" with miles driven for each
- Chart section: bar chart showing miles driven per month (last 12 months) with average line overlay
- Below chart: "Odometer History" list showing all recorded odometer readings with date, source (manual entry, fuel log, maintenance log, trip log), and miles since previous reading
- Floating action button to add a manual odometer reading

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No odometer readings beyond the initial vehicle creation value | Dashboard icon, "Start tracking your mileage", "Your odometer updates from fuel logs and maintenance records will appear here automatically" |
| Populated | 2+ odometer data points exist | Full dashboard with stats, chart, and history list |
| Sparse | Only initial odometer, no subsequent readings | Current odometer shown, "Drive more or log a fill-up to see mileage trends" in chart area |

**Interactions:**
- Tap floating action button: Show manual odometer entry modal
- Tap a period stat (e.g., "This Month"): Expand to show daily breakdown for that period
- Tap a bar in the chart: Show tooltip with exact miles driven that month
- Tap an odometer history entry: Navigate to the source record (fuel log, maintenance entry, or trip) if applicable

##### Modal: Manual Odometer Entry

**Layout:**
- Title: "Update Odometer"
- Large numeric input field pre-filled with current odometer value
- Date picker defaulting to today
- Optional notes field (max 100 chars)
- "Save" and "Cancel" buttons

**Interactions:**
- User enters new odometer value: Validate that it is >= current reading
- Tap Save: Create odometer history entry, update vehicle odometer

#### 3.5.3 Data Requirements

##### Entity: OdometerReading

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique reading identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| reading_date | string | Required, ISO 8601 date | Today's date | Date of the reading |
| odometer | integer | Required, min 0, max 999999 | None | Odometer value at time of reading |
| source | string | Required, one of: manual, fuel_log, maintenance, trip | None | How this reading was recorded |
| source_record_id | string | Optional, references the originating record ID | null | ID of the fuel entry, maintenance record, or trip that generated this reading |
| notes | string | Optional, max 100 chars | null | Additional context |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

**Indexes:**
- (vehicle_id, reading_date DESC) - Chronological listing
- (vehicle_id, odometer DESC) - Latest reading lookup
- (vehicle_id, source) - Filter by source type

**Validation Rules:**
- odometer: Must be >= the most recent previous reading for this vehicle
- reading_date: Cannot be in the future
- source_record_id: If source is not "manual", this should reference an existing record

#### 3.5.4 Business Logic

##### Odometer History Aggregation

**Purpose:** Build a complete odometer history from all sources (manual entries, fuel logs, maintenance records, trips).

**Logic:**
```
1. RECEIVE vehicle_id
2. QUERY all OdometerReading WHERE vehicle_id ORDER BY reading_date ASC, odometer ASC
3. IF no readings exist:
     Use vehicle.odometer as the sole data point with vehicle.created_at as the date
4. RETURN sorted list of readings
```

##### Mileage Period Calculation

**Purpose:** Calculate miles driven within a specified time period.

**Logic:**
```
1. RECEIVE vehicle_id, start_date, end_date
2. FIND start_reading = OdometerReading WHERE vehicle_id
     AND reading_date <= start_date
     ORDER BY reading_date DESC, odometer DESC
     LIMIT 1
3. FIND end_reading = OdometerReading WHERE vehicle_id
     AND reading_date <= end_date
     ORDER BY reading_date DESC, odometer DESC
     LIMIT 1
4. IF start_reading is null OR end_reading is null:
     RETURN { miles_driven: null, message: "Insufficient data for this period" }
5. miles_driven = end_reading.odometer - start_reading.odometer
6. IF miles_driven < 0:
     RETURN { miles_driven: 0, message: "Odometer data inconsistency detected" }
7. RETURN { miles_driven, start_odometer: start_reading.odometer, end_odometer: end_reading.odometer }
```

##### Estimated Annual Mileage

**Purpose:** Project annual mileage based on driving history.

**Logic:**
```
1. RECEIVE vehicle_id
2. FIND earliest_reading = first OdometerReading for vehicle
3. FIND latest_reading = most recent OdometerReading for vehicle
4. IF earliest = latest OR only one reading exists:
     RETURN { estimated_annual: null, message: "Need more data points" }
5. total_miles = latest.odometer - earliest.odometer
6. days_elapsed = latest.reading_date - earliest.reading_date (in days)
7. IF days_elapsed < 7:
     RETURN { estimated_annual: null, message: "Need at least 7 days of data" }
8. daily_average = total_miles / days_elapsed
9. estimated_annual = ROUND(daily_average * 365)
10. RETURN { estimated_annual, daily_average, data_span_days: days_elapsed }
```

**Edge Cases:**
- Vehicle with only the initial odometer reading from creation: Return null estimates with guidance message
- Multiple readings on the same day: Use the highest odometer value for that day
- Periods with no readings: Interpolate between nearest surrounding readings for period calculations
- Very short history (< 7 days): Suppress annual estimate to avoid misleading projections

#### 3.5.5 API/Integration

- No external API calls required
- OdometerReading records are automatically created when fuel entries (CR-003) or maintenance records (CR-002) are saved, using their odometer values as the reading
- Trip logs (CR-007) also generate OdometerReading entries based on start/end odometer
- All data is stored locally in SQLite

#### 3.5.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Odometer value lower than current | Modal alert: "This reading ({new}) is less than the current odometer ({current}). Please enter a value of {current} or higher." | User corrects the value |
| Future date entered | Inline message: "Date cannot be in the future" | User selects today or an earlier date |
| Insufficient data for period calculation | Info card: "Not enough odometer data for this period. Log a fill-up or add a manual reading." | User adds data through any source |
| Duplicate reading (same date and odometer from different sources) | Silently deduplicate; keep only one entry, preferring the most specific source (trip > fuel_log > maintenance > manual) | No user action needed |
| Database write fails | Toast: "Could not save odometer reading. Please try again." | User retaps Save |

**Validation Timing:**
- Odometer validation: On blur and on Save tap
- Date validation: On date selection

#### 3.5.7 Performance Requirements

- Mileage dashboard loads within 400ms including chart rendering for up to 1000 readings
- Period calculation returns within 100ms
- Annual mileage estimate calculates within 50ms
- Monthly bar chart renders within 300ms for 12 months of data
- Manual odometer entry saves within 200ms

#### 3.5.8 Accessibility

- Hero stat card announces: "Current odometer: {value} {unit}, total miles driven: {total}, estimated annual mileage: {estimate}" on focus
- Bar chart has a text-based data table alternative accessible to screen readers
- Period summary items announce: "{period}: {miles} miles driven" on focus
- Odometer history entries announce: "{date}, {odometer} {unit}, source: {source}" on focus
- Minimum touch target: 44x44 points
- Numeric input for odometer supports VoiceOver adjustable trait for increment/decrement

#### 3.5.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle created with odometer 30000 on January 1,
   **When** the user logs a fuel entry at odometer 30450 on January 15 and a maintenance record at odometer 30900 on February 1,
   **Then** the Mileage Dashboard shows: total miles driven 900, January miles 450, February miles 450, and two entries in odometer history.

2. **Given** 6 months of odometer data showing approximately 1000 miles per month,
   **When** the user views the Mileage Dashboard,
   **Then** the estimated annual mileage shows approximately 12000 miles.

3. **Given** the user taps the manual odometer entry button,
   **When** they enter a value of 31500 with today's date,
   **Then** the vehicle's odometer updates to 31500 and a new entry appears in odometer history with source "manual".

**Edge Cases:**

4. **Given** a vehicle with only its creation odometer (no subsequent readings),
   **When** the user views the Mileage Dashboard,
   **Then** the chart area shows "Drive more or log a fill-up to see mileage trends" and annual estimate shows "Need more data points."

5. **Given** a fuel log and a maintenance record are saved on the same day with the same odometer,
   **When** the odometer history is displayed,
   **Then** only one entry for that day/odometer is shown (deduplicated), using the more specific source.

**Negative Tests:**

6. **Given** the current odometer is 31500,
   **When** the user tries to enter a manual reading of 31000,
   **Then** the system rejects with "This reading (31000) is less than the current odometer (31500)."

7. **Given** the manual odometer entry modal is open,
   **When** the user selects a date in the future,
   **Then** inline validation "Date cannot be in the future" appears and the entry is not saved.

#### 3.5.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates miles driven in a period | readings: [{date: Jan 1, odo: 30000}, {date: Feb 1, odo: 31000}], period: January | 1000 miles |
| estimates annual mileage from 6 months data | 6000 miles over 182 days | ~12033 miles/year |
| returns null estimate for < 7 days data | 2 readings 3 days apart | estimated_annual: null |
| deduplicates same-day same-odometer readings | two readings on same day, same odometer, different sources | one entry retained |
| validates odometer cannot decrease | current: 31500, new: 31000 | Validation error |
| validates date cannot be future | date: tomorrow | Validation error |
| handles period with no readings | start: June 1, end: June 30, no readings in June | miles_driven: null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Fuel log creates odometer reading | 1. Log fuel entry at odometer 31000 | OdometerReading created with source "fuel_log" and reference to fuel entry ID |
| Maintenance creates odometer reading | 1. Log maintenance at odometer 31500 | OdometerReading created with source "maintenance" |
| Manual reading updates vehicle | 1. Enter manual reading 32000 | Vehicle.odometer set to 32000, OdometerReading with source "manual" |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Track mileage over 3 months | 1. Create vehicle at 30000, 2. Log 3 fill-ups over 3 months, 3. Add 1 manual reading, 4. View dashboard | Dashboard shows bar chart with 3 months, odometer history with 5 entries (creation + 3 fuel + 1 manual), and an annual estimate |

---

### 3.6 CR-006: Expense Dashboard

#### 3.6.1 User Stories

**Primary:**
> As a budget-conscious owner (Riley), I want to see a single dashboard that combines all vehicle expenses (fuel, maintenance, insurance, registration), so that I understand the true total cost of owning each vehicle.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want to compare total cost of ownership between my vehicles on a cost-per-mile basis, so that I can identify which vehicle is the most and least expensive to operate.

**Tertiary:**
> As a mileage tracker (Jordan), I want to see my business-related vehicle expenses broken down by category and period, so that I can prepare accurate tax deductions and reimbursement claims.

#### 3.6.2 UI Requirements

##### Screen: Expense Overview

**Layout:**
- Top navigation bar with "Expenses" title
- Vehicle selector: "All Vehicles" (default) or specific vehicle
- Period selector: "Month", "Quarter", "Year", "All Time" as segmented control
- Hero stats row: Total Expenses (sum of all categories), Cost Per Mile, Monthly Average
- Category breakdown section: horizontal bar chart or stacked bar chart showing expense distribution by category (Fuel, Maintenance, Insurance, Registration, Other)
- Below chart: category list with each category showing total amount and percentage of overall expenses
- Monthly trend section: line chart showing total expenses per month for the last 12 months
- "Add Expense" button for logging miscellaneous vehicle expenses not covered by other modules

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No expense data from any source | Wallet icon, "No expenses recorded yet", "Your fuel fill-ups, maintenance costs, and other vehicle expenses will appear here automatically" |
| Populated | 1+ expense entries across any category | Full dashboard with charts and breakdowns |
| Single Category | Only fuel or only maintenance data exists | Dashboard shows data for available category, other categories show $0 |
| Multi-Vehicle | "All Vehicles" selected with 2+ vehicles | Aggregate view with per-vehicle color coding in charts |

**Interactions:**
- Tap a category bar or list item: Navigate to filtered list showing individual entries for that category
- Tap cost per mile: Show tooltip explaining the calculation
- Tap monthly trend data point: Show month detail with category breakdown
- Tap "Add Expense": Open Add Miscellaneous Expense form
- Swipe between periods: Animate chart transitions

##### Screen: Add/Edit Miscellaneous Expense

**Layout:**
- Scrollable form with fields:
  - **Category** - Required, picker: Insurance Payment, Registration Fee, Parking, Tolls, Car Wash, Accessories, Towing, Other
  - **Amount** - Required, currency input, min 0.01, max 99999.99
  - **Date** - Required, date picker, default: today
  - **Description** - Optional, text, max 200 chars
  - **Recurring** - Toggle, default: off. If on, show recurrence picker: Weekly, Monthly, Quarterly, Annually
  - **Receipt Photo** - Optional, single photo attachment
- Bottom bar: "Cancel" and "Save" buttons

#### 3.6.3 Data Requirements

##### Entity: MiscExpense

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique expense identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| category | string | Required, one of: insurance_payment, registration_fee, parking, tolls, car_wash, accessories, towing, other | None | Expense category |
| amount | float | Required, min 0.01, max 99999.99 | None | Expense amount |
| expense_date | string | Required, ISO 8601 date | Today's date | Date the expense was incurred |
| description | string | Optional, max 200 chars | null | Details about the expense |
| is_recurring | boolean | - | false | Whether this is a recurring expense |
| recurrence_interval | string | Required if is_recurring is true, one of: weekly, monthly, quarterly, annually | null | How often the expense recurs |
| receipt_photo_uri | string | Optional, local file URI | null | Path to receipt photo |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

**Indexes:**
- (vehicle_id, expense_date DESC) - Chronological listing per vehicle
- (vehicle_id, category) - Category filtering
- (is_recurring, recurrence_interval) - Recurring expense queries

**Validation Rules:**
- amount: Must be > 0
- If is_recurring is true, recurrence_interval is required
- expense_date: Cannot be more than 1 year in the future (for pre-paying)

#### 3.6.4 Business Logic

##### Total Cost of Ownership Calculation

**Purpose:** Aggregate all vehicle-related expenses from multiple sources into a single total.

**Logic:**
```
1. RECEIVE vehicle_id, start_date, end_date
2. fuel_cost = SUM(total_cost) FROM FuelEntry
     WHERE vehicle_id AND entry_date BETWEEN start_date AND end_date
3. maintenance_cost = SUM(cost) FROM MaintenanceRecord
     WHERE vehicle_id AND service_date BETWEEN start_date AND end_date
     (treat null cost as 0)
4. misc_cost = SUM(amount) FROM MiscExpense
     WHERE vehicle_id AND expense_date BETWEEN start_date AND end_date
5. total = fuel_cost + maintenance_cost + misc_cost
6. RETURN {
     total,
     fuel_cost, fuel_percentage: (fuel_cost / total) * 100,
     maintenance_cost, maintenance_percentage: (maintenance_cost / total) * 100,
     misc_cost, misc_percentage: (misc_cost / total) * 100,
     category_breakdown: { insurance, registration, parking, tolls, ... }
   }
```

##### Cost Per Mile Calculation

**Purpose:** Calculate how much each mile costs the owner across all expense categories.

**Logic:**
```
1. RECEIVE vehicle_id, start_date, end_date
2. total_expenses = Total Cost of Ownership result for the period
3. miles_driven = Mileage Period Calculation result for the period
     (from CR-005)
4. IF miles_driven is null OR miles_driven = 0:
     RETURN { cost_per_mile: null, message: "Insufficient mileage data" }
5. cost_per_mile = total_expenses / miles_driven
6. ROUND cost_per_mile to 2 decimal places
7. RETURN { cost_per_mile, total_expenses, miles_driven }
```

##### Monthly Average Calculation

**Purpose:** Show a smoothed monthly expense figure.

**Logic:**
```
1. RECEIVE vehicle_id
2. FIND earliest_expense_date across all expense sources for this vehicle
3. FIND latest_expense_date across all expense sources
4. months_elapsed = number of calendar months between earliest and latest (minimum 1)
5. total_expenses = Total Cost of Ownership for the full date range
6. monthly_average = total_expenses / months_elapsed
7. ROUND to 2 decimal places
8. RETURN { monthly_average, months_elapsed, total_expenses }
```

**Edge Cases:**
- No expenses recorded: Return all zeros
- Only one expense source has data: Show that source's total as the overall total; other categories show $0
- Cost per mile with no mileage data: Return null with an explanatory message
- Period with zero miles driven but nonzero expenses: cost_per_mile is null (avoid division by zero)
- Multi-vehicle aggregate: Sum across all active vehicles; cost_per_mile uses aggregate miles

#### 3.6.5 API/Integration

- No external API calls required
- Aggregates data from FuelEntry (CR-003), MaintenanceRecord (CR-002), and MiscExpense entities
- Depends on OdometerReading/Mileage data (CR-005) for cost-per-mile calculations
- All calculations run locally on-device

#### 3.6.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No mileage data for cost per mile | Info text below cost per mile: "Update your odometer to calculate cost per mile" | User logs a fuel entry, maintenance record, or manual odometer reading |
| Amount is zero or negative | Inline message: "Amount must be greater than $0" | User corrects the value |
| Recurring expense without interval | Inline message: "Please select how often this expense recurs" | User selects an interval or turns off recurring |
| No data for selected period | Dashboard shows $0 for all categories with message: "No expenses in {period}" | User selects a different period or adds expenses |
| Database query fails | Toast: "Could not load expense data. Please try again." | User pulls to refresh |

**Validation Timing:**
- Amount validation: On blur
- Recurring interval: On Save if recurring is toggled on
- Date validation: On date selection

#### 3.6.7 Performance Requirements

- Expense dashboard loads within 500ms including chart rendering across all expense sources
- Total cost of ownership calculation returns within 300ms for up to 2000 combined records
- Cost per mile calculation returns within 100ms (dependent on CR-005 performance)
- Category breakdown renders within 200ms
- Monthly trend chart renders within 300ms for 12 months

#### 3.6.8 Accessibility

- Hero stats announce: "Total expenses: ${total}, Cost per mile: ${cpm}, Monthly average: ${avg}" on focus
- Category bars in the chart have text labels readable by screen readers: "{category}: ${amount}, {percentage}% of total"
- Monthly trend chart has a text-based data table alternative
- "Add Expense" button has accessible label: "Add a miscellaneous vehicle expense"
- Currency inputs announce currency symbol and value
- Minimum touch target: 44x44 points

#### 3.6.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle with $200 in fuel costs, $150 in maintenance costs, and $100 in insurance payments for the current month,
   **When** the user views the Expense Dashboard for "This Month",
   **Then** total expenses show $450, with category breakdown: Fuel 44.4%, Maintenance 33.3%, Insurance 22.2%.

2. **Given** a vehicle with $2400 in total expenses and 6000 miles driven over 6 months,
   **When** the user views cost per mile,
   **Then** cost per mile displays $0.40.

3. **Given** two vehicles with expenses,
   **When** the user selects "All Vehicles",
   **Then** the dashboard shows aggregate totals with per-vehicle color coding.

**Edge Cases:**

4. **Given** a vehicle with fuel expenses but no maintenance or misc expenses,
   **When** the user views the Expense Dashboard,
   **Then** fuel shows as 100% of expenses, and maintenance/misc categories show $0.

5. **Given** a vehicle with expenses but no odometer data,
   **When** the user views cost per mile,
   **Then** it shows "Update your odometer to calculate cost per mile" instead of a number.

**Negative Tests:**

6. **Given** the Add Expense form is open,
   **When** the user enters amount as 0,
   **Then** inline validation "Amount must be greater than $0" appears and the expense is not saved.

7. **Given** the user toggles "Recurring" on,
   **When** they tap Save without selecting a recurrence interval,
   **Then** inline validation "Please select how often this expense recurs" appears.

#### 3.6.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates total cost across sources | fuel: 200, maintenance: 150, misc: 100 | total: 450 |
| calculates correct percentages | fuel: 200, maintenance: 150, misc: 100 | fuel: 44.4%, maint: 33.3%, misc: 22.2% |
| calculates cost per mile | total: 2400, miles: 6000 | cost_per_mile: 0.40 |
| returns null cost per mile for zero miles | total: 500, miles: 0 | cost_per_mile: null |
| calculates monthly average | total: 3600, months: 6 | monthly_average: 600 |
| handles no expenses gracefully | no records | total: 0, all categories: 0 |
| validates amount must be positive | amount: 0 | Validation error |
| validates recurrence interval when recurring | is_recurring: true, interval: null | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Dashboard aggregates from fuel log | 1. Log 3 fuel entries, 2. View expense dashboard | Fuel category total matches sum of fill-up costs |
| Dashboard aggregates from maintenance | 1. Log 2 maintenance records, 2. View dashboard | Maintenance category matches sum of maintenance costs |
| Add misc expense and verify | 1. Add $150 insurance payment, 2. View dashboard | Misc category includes $150, total updates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full expense tracking for one month | 1. Log 4 fuel entries ($40 each), 2. Log 1 oil change ($65), 3. Add insurance ($120), 4. View dashboard for month | Total: $345, Fuel: $160 (46.4%), Maintenance: $65 (18.8%), Insurance: $120 (34.8%), with cost per mile calculated |

---

### 3.7 CR-007: Trip Logging

#### 3.7.1 User Stories

**Primary:**
> As a mileage tracker (Jordan), I want to log individual trips with start/end odometer, purpose (business or personal), and a description, so that I can generate IRS-compliant mileage reports for tax deductions.

**Secondary:**
> As an everyday driver (Alex), I want to quickly log a trip with just the distance driven and purpose, so that I do not need to remember exact odometer readings for every drive.

**Tertiary:**
> As a multi-vehicle household manager (Sam), I want to see trip history per vehicle with total miles by purpose category, so that I can track business vs. personal usage for each family vehicle.

#### 3.7.2 UI Requirements

##### Screen: Trip Log

**Layout:**
- Top navigation bar with "Trips" title and vehicle selector dropdown
- Summary card at top: total trips logged, total miles (all purposes), business miles, personal miles, commute miles
- Filter bar: "All", "Business", "Personal", "Commute", "Medical", "Charity", "Moving" as horizontal scrollable chips
- Main content: reverse-chronological list of trip entries grouped by date
- Each trip card shows: purpose icon (briefcase for business, house for personal, car for commute, etc.), purpose label, distance driven, description (truncated to 1 line), start and end locations (if provided)
- Floating action button to add a new trip
- "Generate Report" button in the top bar (navigates to CR-014 Data Export with trip filter pre-selected)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No trips logged | Car with road icon, "No trips logged yet", "Tap + to log your first trip" |
| Populated | 1+ trips exist | Chronological list with summary card |
| Filtered | A purpose filter is active | Only matching trips shown; summary updates to reflect filter |

**Interactions:**
- Tap trip card: Navigate to Trip Detail screen
- Swipe left on trip: Reveal "Edit" and "Delete" actions
- Tap filter chip: Filter list and recalculate summary stats
- Tap floating action button: Navigate to Add Trip screen
- Tap "Generate Report": Navigate to export screen with trip data pre-selected

##### Screen: Add/Edit Trip

**Layout:**
- Scrollable form with fields:
  - **Purpose** - Required, segmented control: Business, Personal, Commute, Medical, Charity, Moving
  - **Date** - Required, date picker, default: today
  - **Entry Method** - Toggle: "Odometer Readings" or "Distance Only"
  - If "Odometer Readings":
    - **Start Odometer** - Required, integer
    - **End Odometer** - Required, integer, must be > start odometer
  - If "Distance Only":
    - **Distance** - Required, float, min 0.1, max 9999.9, unit label (miles/km)
  - **Start Location** - Optional, text, max 100 chars (e.g., "Home" or "123 Main St")
  - **End Location** - Optional, text, max 100 chars
  - **Description** - Optional, text, max 200 chars (e.g., "Client meeting at Acme Corp")
  - **Round Trip** - Toggle, default: off. If on, distance is doubled
- Bottom bar: "Cancel" and "Save" buttons

**Interactions:**
- Toggle Entry Method: Show/hide odometer fields vs. distance field
- Toggle Round Trip: Recalculate displayed distance (double the entered distance or odometer difference)
- Tap Save: Validate, save trip, update vehicle odometer if end odometer > current (odometer mode only)

##### Screen: Trip Detail

**Layout:**
- Read-only view showing all trip fields
- Top: Purpose icon and label, date
- Details section: Distance (with round trip indicator if applicable), start/end locations, description
- Odometer section (if entered): Start odometer, end odometer
- Action bar: "Edit" and "Delete" buttons

#### 3.7.3 Data Requirements

##### Entity: TripEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique trip identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| trip_date | string | Required, ISO 8601 date | Today's date | Date of the trip |
| purpose | string | Required, one of: business, personal, commute, medical, charity, moving | None | IRS-recognized trip purpose category |
| start_odometer | integer | Optional, min 0, max 999999 | null | Odometer at trip start |
| end_odometer | integer | Optional, min 0, max 999999 | null | Odometer at trip end |
| distance | float | Required, min 0.1, max 19999.8 | None | Distance driven (one-way or round trip total) |
| distance_unit | string | Required, one of: miles, km | Matches vehicle setting | Unit of distance |
| is_round_trip | boolean | - | false | Whether the entered distance was doubled for round trip |
| start_location | string | Optional, max 100 chars | null | Starting address or name |
| end_location | string | Optional, max 100 chars | null | Ending address or name |
| description | string | Optional, max 200 chars | null | Trip purpose description |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

**Indexes:**
- (vehicle_id, trip_date DESC) - Chronological listing
- (vehicle_id, purpose) - Purpose-filtered queries
- (purpose, trip_date DESC) - IRS report generation (all vehicles by purpose)

**Validation Rules:**
- If start_odometer and end_odometer are both provided, end_odometer must be > start_odometer
- distance: If odometer mode, calculated as end_odometer - start_odometer (times 2 if round trip)
- distance: If distance-only mode, user-provided value (times 2 if round trip)
- distance: Max 19999.8 accounts for round trip doubling of max 9999.9

#### 3.7.4 Business Logic

##### Trip Distance Calculation

**Purpose:** Calculate trip distance from odometer readings or direct entry.

**Logic:**
```
1. IF entry_method = "odometer":
     one_way_distance = end_odometer - start_odometer
     IF is_round_trip:
       distance = one_way_distance * 2
     ELSE:
       distance = one_way_distance
2. ELSE (distance-only mode):
     IF is_round_trip:
       distance = user_entered_distance * 2
     ELSE:
       distance = user_entered_distance
3. SET trip.distance = distance
```

##### Trip Purpose Aggregation

**Purpose:** Calculate total miles by purpose category for reporting.

**Logic:**
```
1. RECEIVE vehicle_id (optional, null for all vehicles), start_date, end_date
2. QUERY trips = all TripEntry WHERE
     (vehicle_id = vehicle_id OR vehicle_id is null for all)
     AND trip_date BETWEEN start_date AND end_date
3. GROUP trips by purpose
4. FOR each purpose group:
     total_miles = SUM(distance)
     trip_count = COUNT(trips)
5. grand_total_miles = SUM(all distances)
6. RETURN {
     by_purpose: { business: { miles, count }, personal: { miles, count }, ... },
     grand_total_miles,
     grand_total_trips: COUNT(all trips)
   }
```

##### IRS Mileage Rate Application

**Purpose:** Calculate deductible amounts using the current IRS standard mileage rate.

**Logic:**
```
1. RECEIVE year, vehicle_id (optional)
2. DEFINE irs_rates (stored as app constants, updated with app releases):
     2025: 0.70 per mile (business), 0.22 per mile (medical/moving), 0.14 per mile (charity)
     2026: 0.70 per mile (business), 0.22 per mile (medical/moving), 0.14 per mile (charity)
     (rates updated annually by app update)
3. QUERY trip aggregation for the year by purpose
4. business_deduction = business_miles * irs_rates[year].business
5. medical_deduction = medical_miles * irs_rates[year].medical
6. charity_deduction = charity_miles * irs_rates[year].charity
7. total_deduction = business_deduction + medical_deduction + charity_deduction
8. RETURN { business_deduction, medical_deduction, charity_deduction, total_deduction, rates_used: irs_rates[year] }
```

**Edge Cases:**
- IRS rates not available for a year: Use most recent known year's rates with a disclaimer
- Zero business miles: Deduction is $0 (not an error)
- Trips spanning midnight (started one day, ended the next): Use the trip_date as the canonical date
- Round trip toggle changes after saving: User must edit the trip to recalculate

#### 3.7.5 API/Integration

- No external API calls required
- Trip entries with odometer readings generate OdometerReading entries (CR-005) for mileage tracking integration
- IRS mileage rates are stored as app constants and updated with new app versions
- No GPS tracking in this feature (see CR-020 for future GPS-based trip auto-detection)
- Trip data feeds into Data Export (CR-014) for IRS-compliant report generation

#### 3.7.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| End odometer <= start odometer | Inline message: "End odometer must be greater than start odometer" | User corrects end odometer |
| Distance is zero or negative | Inline message: "Distance must be at least 0.1 {unit}" | User corrects the value |
| Purpose not selected | Inline message: "Please select a trip purpose" | User taps a purpose option |
| Start odometer < vehicle current odometer | Warning (not blocking): "Start odometer ({start}) is less than the vehicle's current reading ({current}). Save anyway?" | User confirms or corrects |
| Database write fails | Toast: "Could not save trip. Please try again." | User retaps Save |
| IRS rate not available for selected year | Info banner on report: "Using {most_recent_year} IRS rates. Check irs.gov for the latest rates." | Informational only; user proceeds |

**Validation Timing:**
- Purpose validation: On Save tap
- Odometer validation: On blur for end odometer
- Distance validation: On blur

#### 3.7.7 Performance Requirements

- Trip log loads within 300ms for up to 500 trips
- Trip purpose aggregation returns within 200ms for up to 1000 trips
- IRS deduction calculation completes within 50ms
- Trip entry save completes within 200ms
- Filter application updates list within 100ms

#### 3.7.8 Accessibility

- Trip cards announce: "{purpose} trip, {distance} {unit}, {date}, {description or 'no description'}" on focus
- Purpose filter chips announce: "{purpose}: {count} trips, {total_miles} {unit}" on focus
- Summary card reads all stats sequentially: "Total trips: {n}, Total miles: {m}, Business: {b}, Personal: {p}, Commute: {c}"
- Round trip toggle announces state change: "Round trip on, distance will be doubled" / "Round trip off"
- Minimum touch target: 44x44 points

#### 3.7.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle with current odometer 40000,
   **When** the user logs a business trip with start odometer 40000, end odometer 40035,
   **Then** the trip is saved with distance 35 miles, purpose "business", and the vehicle's odometer updates to 40035.

2. **Given** the user selects "Distance Only" mode and enters 22.5 miles with "Round Trip" toggled on,
   **When** the trip is saved,
   **Then** the trip's distance is recorded as 45.0 miles.

3. **Given** 50 business trips totaling 2000 miles in tax year 2026,
   **When** the user views the IRS deduction summary,
   **Then** the business deduction shows $1,400.00 (2000 * $0.70).

**Edge Cases:**

4. **Given** a trip with start odometer 40000 and end odometer 40005,
   **When** the trip is a round trip,
   **Then** distance is 10 miles (5 * 2).

5. **Given** trips exist for both 2025 and 2026 tax years,
   **When** the user generates a report for 2025,
   **Then** only 2025 trips are included, using 2025 IRS rates.

**Negative Tests:**

6. **Given** the Add Trip form in odometer mode,
   **When** the user enters end odometer 39000 (less than start odometer 40000),
   **Then** inline validation "End odometer must be greater than start odometer" appears.

7. **Given** the Add Trip form in distance-only mode,
   **When** the user enters distance 0,
   **Then** inline validation "Distance must be at least 0.1 miles" appears.

#### 3.7.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates distance from odometer | start: 40000, end: 40035, round_trip: false | distance: 35 |
| doubles distance for round trip (odometer) | start: 40000, end: 40035, round_trip: true | distance: 70 |
| doubles distance for round trip (direct) | distance: 22.5, round_trip: true | distance: 45.0 |
| aggregates miles by purpose | 3 business (100mi total), 2 personal (50mi total) | business: 100, personal: 50, grand: 150 |
| calculates IRS business deduction | miles: 2000, rate: 0.70 | deduction: 1400.00 |
| calculates IRS charity deduction | miles: 500, rate: 0.14 | deduction: 70.00 |
| validates end > start odometer | start: 40000, end: 39000 | Validation error |
| validates distance > 0 | distance: 0 | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Trip creates odometer readings | 1. Log trip with odometer 40000-40035, 2. Check odometer readings | Two OdometerReading entries (source: "trip") created |
| Trip updates vehicle odometer | 1. Vehicle at 40000, 2. Log trip ending at 40035 | vehicle.odometer = 40035 |
| Purpose filter recalculates summary | 1. Log 3 business and 2 personal trips, 2. Filter to "Business" | Summary shows only business totals |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Log a week of commuting | 1. Log 5 commute trips (Mon-Fri), each 15 miles round trip, 2. View trip log | 5 entries, 150 total commute miles, summary shows commute as dominant category |
| Generate IRS-ready data | 1. Log 20 business trips over 2 months, 2. View deduction summary | Business miles total shown with deduction amount at current IRS rate |

---

### 3.8 CR-008: Insurance Document Storage

#### 3.8.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to store photos of my insurance cards and policy details in the app, so that I have quick access during a traffic stop or accident without digging through the glove box.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want to track insurance renewal dates for all vehicles and get reminded before policies expire, so that no vehicle in my household has a lapse in coverage.

**Tertiary:**
> As a privacy-first car enthusiast (Morgan), I want my insurance documents stored only on my device and never uploaded to any server, so that my policy details and coverage amounts remain completely private.

#### 3.8.2 UI Requirements

##### Screen: Insurance Overview

**Layout:**
- Top navigation bar with "Insurance" title and vehicle selector dropdown
- If vehicle has active insurance: large card showing policy summary (provider, policy number, coverage period, status badge)
- Quick access section: "View Insurance Card" button (opens stored card photo full-screen)
- Coverage details section: grouped list of coverage types and limits
- Claims history section: chronological list of filed claims
- "Add/Edit Policy" button
- "Add Claim" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Policy | No insurance record for selected vehicle | Shield icon, "No insurance on file", "Tap 'Add Policy' to store your insurance details" |
| Active Policy | Policy exists with end_date in the future | Green "Active" badge on policy card |
| Expiring Soon | Policy end_date is within 30 days | Amber "Expiring Soon" badge, with days remaining |
| Expired | Policy end_date is in the past | Red "Expired" badge |

**Interactions:**
- Tap "View Insurance Card": Full-screen photo viewer with zoom and rotate
- Tap "Add/Edit Policy": Navigate to Add/Edit Insurance screen
- Tap "Add Claim": Navigate to Add Claim screen
- Tap a claim entry: Navigate to Claim Detail screen

##### Screen: Add/Edit Insurance Policy

**Layout:**
- Scrollable form with sections:
  - **Provider Info** - Provider Name (required, text, max 100 chars), Agent Name (optional, text, max 100 chars), Agent Phone (optional, phone number format), Policy Number (required, text, max 50 chars)
  - **Coverage Period** - Start Date (required, date picker), End Date (required, date picker, must be after start date)
  - **Premium** - Amount (optional, currency, min 0), Payment Frequency (optional, picker: Monthly, Quarterly, Semi-Annual, Annual)
  - **Coverage Details** - Repeatable group: Coverage Type (picker: Liability, Collision, Comprehensive, Uninsured Motorist, Medical, Roadside Assistance, Rental, Other), Limit/Deductible description (text, max 100 chars)
  - **Insurance Card Photos** - Up to 2 photos (front and back of insurance card)
  - **Notes** - Optional, multiline text, max 300 chars
- Bottom bar: "Cancel" and "Save" buttons

##### Screen: Add/Edit Claim

**Layout:**
- Scrollable form with fields:
  - **Claim Date** - Required, date picker, default: today
  - **Claim Number** - Optional, text, max 50 chars
  - **Description** - Required, text, max 500 chars
  - **Claim Amount** - Optional, currency
  - **Deductible Paid** - Optional, currency
  - **Status** - Required, picker: Filed, In Progress, Approved, Denied, Settled
  - **Photos** - Optional, up to 10 photos (accident scene, damage photos)
  - **Notes** - Optional, multiline text, max 300 chars
- Bottom bar: "Cancel" and "Save" buttons

#### 3.8.3 Data Requirements

##### Entity: InsurancePolicy

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique policy identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| provider_name | string | Required, max 100 chars | None | Insurance company name |
| agent_name | string | Optional, max 100 chars | null | Insurance agent name |
| agent_phone | string | Optional, max 20 chars | null | Agent phone number |
| policy_number | string | Required, max 50 chars | None | Policy number |
| start_date | string | Required, ISO 8601 date | None | Coverage start date |
| end_date | string | Required, ISO 8601 date | None | Coverage end date |
| premium_amount | float | Optional, min 0, max 99999.99 | null | Premium payment amount |
| payment_frequency | string | Optional, one of: monthly, quarterly, semi_annual, annual | null | How often premium is paid |
| card_front_photo_uri | string | Optional, local file URI | null | Front of insurance card photo |
| card_back_photo_uri | string | Optional, local file URI | null | Back of insurance card photo |
| notes | string | Optional, max 300 chars | null | Additional notes |
| is_active | boolean | Calculated | true | Whether this is the current active policy |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

##### Entity: InsuranceCoverage

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique coverage identifier |
| policy_id | string | Required, references InsurancePolicy.id | None | Associated policy |
| coverage_type | string | Required, one of: liability, collision, comprehensive, uninsured_motorist, medical, roadside_assistance, rental, other | None | Type of coverage |
| description | string | Optional, max 100 chars | null | Limit/deductible details (e.g., "$500 deductible, $100k/$300k limits") |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

##### Entity: InsuranceClaim

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique claim identifier |
| policy_id | string | Required, references InsurancePolicy.id | None | Associated policy |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| claim_date | string | Required, ISO 8601 date | Today | Date of the claim or incident |
| claim_number | string | Optional, max 50 chars | null | Insurance company claim reference number |
| description | string | Required, max 500 chars | None | Description of the incident or claim |
| claim_amount | float | Optional, min 0, max 9999999.99 | null | Total claim amount |
| deductible_paid | float | Optional, min 0, max 99999.99 | null | Out-of-pocket deductible paid |
| status | string | Required, one of: filed, in_progress, approved, denied, settled | filed | Current claim status |
| notes | string | Optional, max 300 chars | null | Additional notes |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

##### Entity: ClaimPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique photo identifier |
| claim_id | string | Required, references InsuranceClaim.id | None | Associated claim |
| photo_uri | string | Required, local file URI | None | Path to the photo file |
| caption | string | Optional, max 100 chars | null | Photo description |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- InsurancePolicy belongs to Vehicle (many-to-one)
- InsurancePolicy has many InsuranceCoverage (one-to-many)
- InsuranceClaim belongs to InsurancePolicy (many-to-one)
- InsuranceClaim belongs to Vehicle (many-to-one)
- InsuranceClaim has many ClaimPhoto (one-to-many, max 10)

**Indexes:**
- (vehicle_id, end_date DESC) - Most recent policy lookup
- (vehicle_id, is_active) - Active policy lookup
- (policy_id, claim_date DESC) - Claims listing per policy

**Validation Rules:**
- end_date must be after start_date
- Only one active policy per vehicle at a time (when saving a new policy, previous active policy is automatically deactivated)
- claim_date should be within the policy's coverage period (warn but allow override)

#### 3.8.4 Business Logic

##### Policy Status Determination

**Purpose:** Determine the display status of an insurance policy.

**Logic:**
```
1. RECEIVE policy (InsurancePolicy)
2. today = current_date
3. IF today > policy.end_date:
     status = "expired"
4. ELSE IF today >= policy.end_date - 30 days:
     status = "expiring_soon"
     days_remaining = policy.end_date - today
5. ELSE IF today >= policy.start_date:
     status = "active"
6. ELSE:
     status = "future" (policy starts in the future)
7. RETURN { status, days_remaining (if applicable) }
```

##### Insurance Renewal Reminder

**Purpose:** Send local push notifications before insurance policies expire.

**Logic:**
```
1. WHEN a policy is saved or updated:
2. IF policy.end_date - today <= 30 days AND policy.end_date >= today:
     SCHEDULE notification at 30 days before end_date:
       title: "{vehicle_name}: Insurance expiring soon"
       body: "Your {provider_name} policy expires on {end_date}. Renew to avoid a coverage gap."
     SCHEDULE notification at 7 days before end_date:
       title: "{vehicle_name}: Insurance expires in 7 days"
       body: "Policy #{policy_number} expires {end_date}. Contact {agent_name or provider_name} to renew."
     SCHEDULE notification on end_date:
       title: "{vehicle_name}: Insurance expired"
       body: "Your {provider_name} policy expired today. Renew immediately to maintain coverage."
3. All notifications are local (on-device)
```

##### Annual Insurance Cost Calculation

**Purpose:** Calculate total annual insurance cost for expense dashboard integration.

**Logic:**
```
1. RECEIVE vehicle_id, year
2. FIND all policies for vehicle that overlap with the year
3. FOR each policy:
     IF premium_amount and payment_frequency are set:
       periods_per_year = { monthly: 12, quarterly: 4, semi_annual: 2, annual: 1 }
       annual_cost = premium_amount * periods_per_year[payment_frequency]
       prorate if policy does not cover the full year
4. total_annual_insurance = SUM(prorated annual costs)
5. RETURN { total_annual_insurance }
```

**Edge Cases:**
- Multiple overlapping policies in the same year (e.g., switched providers mid-year): Both prorated costs are included
- Policy with no premium data: Excluded from cost calculation with no error
- Claim date outside policy period: Warn the user but allow saving (insurance claims can be filed after the incident date)

#### 3.8.5 API/Integration

- No external API calls required
- Insurance card photos stored locally as compressed images (max 1MB each)
- Claim photos stored locally as compressed images (max 1MB each)
- Insurance cost data feeds into Expense Dashboard (CR-006)
- Renewal reminders use local push notifications

#### 3.8.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| End date before start date | Inline message: "End date must be after the start date" | User corrects the dates |
| Saving policy when another is active | Confirmation: "You already have an active policy from {provider}. Replace it as the active policy?" | User confirms (old policy deactivated) or cancels |
| Claim date outside policy period | Warning: "This claim date is outside the coverage period ({start} to {end}). Save anyway?" | User confirms or adjusts |
| Photo storage fails (disk full) | Alert: "Not enough storage to save this photo. Free up space and try again." | User frees device storage |
| More than 10 claim photos | Toast: "Maximum 10 photos per claim" | User removes a photo before adding another |
| Database write fails | Toast: "Could not save insurance data. Please try again." | User retaps Save |
| Notification permission denied | Info banner: "Enable notifications in Settings to receive insurance renewal reminders" | User can still view expiry dates in-app |

**Validation Timing:**
- Date validation: On date selection
- Provider and policy number: On Save tap
- Photo limit: On photo addition attempt

#### 3.8.7 Performance Requirements

- Insurance overview loads within 300ms including card photo thumbnail
- Policy save completes within 500ms (including up to 2 card photos)
- Claim save completes within 800ms (including up to 10 compressed photos)
- Renewal notification scheduling completes within 200ms
- Annual insurance cost calculation returns within 100ms

#### 3.8.8 Accessibility

- Policy status badge announces full text: "Policy is active", "Policy expires in {N} days", "Policy is expired"
- Insurance card photo has alt text: "Insurance card front" / "Insurance card back"
- Coverage list items announce: "{type}: {description}" on focus
- Claim status announces: "Claim {number}: {status}" on focus
- Photo attachments announce: "Claim photo {N} of {total}, {caption or 'no caption'}" on focus
- Minimum touch target: 44x44 points

#### 3.8.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle with no insurance on file,
   **When** the user adds a policy with provider "State Farm", policy number "SF-12345", start date Jan 1 2026, end date Jan 1 2027, and uploads front/back card photos,
   **Then** the Insurance Overview shows the policy as "Active" with the card photos accessible.

2. **Given** an active policy with end date 30 days from today,
   **When** the user opens the Insurance Overview,
   **Then** the policy shows an "Expiring Soon" badge with "30 days remaining" and a renewal notification is scheduled.

3. **Given** an active policy,
   **When** the user adds a claim with date, description, amount, and 3 photos,
   **Then** the claim appears in the claims history with status "Filed" and photos accessible.

**Edge Cases:**

4. **Given** an active policy from Provider A,
   **When** the user saves a new policy from Provider B,
   **Then** Provider A's policy is deactivated (but data preserved) and Provider B's policy becomes active.

5. **Given** a policy covering Jan 1 to Dec 31 2026,
   **When** the user files a claim dated Feb 2027,
   **Then** a warning appears "This claim date is outside the coverage period" with the option to save anyway.

**Negative Tests:**

6. **Given** the Add Policy form,
   **When** the user sets end date before start date,
   **Then** inline validation "End date must be after the start date" appears and the policy is not saved.

7. **Given** a claim with 10 photos already attached,
   **When** the user tries to add an 11th photo,
   **Then** a toast "Maximum 10 photos per claim" appears and the photo is not added.

#### 3.8.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| determines active status | today: Jun 15, start: Jan 1, end: Dec 31 | status: "active" |
| determines expiring_soon status | today: Dec 5, end: Dec 31 | status: "expiring_soon", days_remaining: 26 |
| determines expired status | today: Jan 15, end: Dec 31 (previous year) | status: "expired" |
| calculates annual insurance cost (monthly) | premium: 150, frequency: monthly | annual: 1800 |
| calculates annual insurance cost (semi-annual) | premium: 900, frequency: semi_annual | annual: 1800 |
| prorates partial year policy | premium: 150/mo, policy covers 6 months of the year | prorated: 900 |
| validates end_date after start_date | start: Dec 31, end: Jan 1 (same year) | Validation error |
| deactivates old policy on new save | existing active policy, save new policy | old.is_active = false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add policy with card photos | 1. Fill policy form, 2. Upload front/back photos, 3. Save | Policy saved, photos stored locally, viewable from overview |
| Add claim to active policy | 1. Have active policy, 2. Add claim with 3 photos | Claim appears in history, photos accessible |
| Insurance cost feeds into expenses | 1. Add policy with $150/mo premium, 2. Check expense dashboard | Insurance category shows calculated annual cost |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full insurance lifecycle | 1. Add policy (Jan-Dec), 2. Upload card photos, 3. Add collision claim in March, 4. Update claim to "Settled", 5. Policy approaches expiry | Policy shows active then expiring_soon, claim history tracks status changes, renewal notification fires |

---

### 3.9 CR-009: Registration and Inspection Tracker

#### 3.9.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to store my vehicle registration and inspection expiration dates, so that I receive reminders before they expire and never get caught with an expired registration.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want a single view of upcoming registration and inspection renewals across all my vehicles, so that I can plan renewals and budget for fees.

**Tertiary:**
> As a privacy-first car enthusiast (Morgan), I want to store photos of my registration and inspection documents on-device, so that I have digital copies accessible during a traffic stop without uploading them to any service.

#### 3.9.2 UI Requirements

##### Screen: Registration and Inspection Overview

**Layout:**
- Top navigation bar with "Registration" title and vehicle selector (or "All Vehicles" toggle)
- Two primary cards per vehicle: Registration Card and Inspection Card
- Registration Card shows: state/region, registration number, expiration date, status badge (Active, Expiring Soon, Expired), cost paid
- Inspection Card shows: inspection type (safety, emissions, combined), last inspection date, next due date, status badge, inspection station name
- "All Vehicles" view: timeline view showing upcoming expirations sorted by date (soonest first) across all vehicles
- "Add/Update" button on each card
- Document photo section at the bottom: tap to view stored registration/inspection document photos

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Data | No registration or inspection records | Clipboard icon, "No registration or inspection data", "Tap a card to add your details" |
| Active | Expiration date is more than 30 days away | Green "Active" badge |
| Expiring Soon | Expiration date is within 30 days | Amber "Expiring Soon" badge with days remaining |
| Expired | Expiration date has passed | Red "Expired" badge |
| Not Required | User has marked inspection as not required in their state | Gray "Not Required" badge on Inspection Card |

**Interactions:**
- Tap Registration Card: Navigate to Add/Edit Registration screen
- Tap Inspection Card: Navigate to Add/Edit Inspection screen
- Tap document photo: Full-screen viewer with zoom
- Tap "All Vehicles" toggle: Show sorted timeline of all upcoming expirations

##### Screen: Add/Edit Registration

**Layout:**
- Scrollable form with fields:
  - **Registration Number** - Optional, text, max 30 chars
  - **State/Region** - Optional, text, max 30 chars
  - **Expiration Date** - Required, date picker
  - **Renewal Cost** - Optional, currency, min 0, max 9999.99
  - **Renewal Frequency** - Required, picker: Annual, Biennial (2 years), Other
  - **Document Photo** - Optional, single photo (registration sticker or certificate)
  - **Notes** - Optional, multiline text, max 200 chars
- Bottom bar: "Cancel" and "Save" buttons

##### Screen: Add/Edit Inspection

**Layout:**
- Scrollable form with fields:
  - **Inspection Type** - Required, picker: Safety, Emissions, Combined Safety and Emissions, Other
  - **Not Required** - Toggle, default: off. If on, hides other fields and marks inspection as not required for this vehicle's state
  - **Last Inspection Date** - Required (unless Not Required), date picker
  - **Next Due Date** - Required (unless Not Required), date picker
  - **Inspection Station** - Optional, text, max 100 chars
  - **Cost** - Optional, currency, min 0, max 999.99
  - **Result** - Required, picker: Passed, Failed, Conditional Pass
  - **Document Photo** - Optional, single photo
  - **Notes** - Optional, multiline text, max 200 chars
- Bottom bar: "Cancel" and "Save" buttons

#### 3.9.3 Data Requirements

##### Entity: VehicleRegistration

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique registration identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| registration_number | string | Optional, max 30 chars | null | Registration or plate renewal number |
| state_region | string | Optional, max 30 chars | null | State or region of registration |
| expiration_date | string | Required, ISO 8601 date | None | When the registration expires |
| renewal_cost | float | Optional, min 0, max 9999.99 | null | Cost of the last renewal |
| renewal_frequency | string | Required, one of: annual, biennial, other | annual | How often registration must be renewed |
| document_photo_uri | string | Optional, local file URI | null | Photo of registration document |
| notes | string | Optional, max 200 chars | null | Additional notes |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

##### Entity: VehicleInspection

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique inspection identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| inspection_type | string | Required, one of: safety, emissions, combined, other | None | Type of inspection |
| is_not_required | boolean | - | false | Whether inspection is not required in this vehicle's state |
| last_inspection_date | string | Required unless is_not_required, ISO 8601 date | null | Date of most recent inspection |
| next_due_date | string | Required unless is_not_required, ISO 8601 date | null | When the next inspection is due |
| inspection_station | string | Optional, max 100 chars | null | Where the inspection was performed |
| cost | float | Optional, min 0, max 999.99 | null | Inspection fee |
| result | string | Required unless is_not_required, one of: passed, failed, conditional | null | Inspection result |
| document_photo_uri | string | Optional, local file URI | null | Photo of inspection certificate |
| notes | string | Optional, max 200 chars | null | Additional notes |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

**Indexes:**
- (vehicle_id) - Registration and inspection lookup per vehicle
- (expiration_date ASC) - Sorted expiration timeline across vehicles
- (next_due_date ASC) - Sorted inspection timeline

**Validation Rules:**
- expiration_date: Cannot be in the past when first creating (can be in the past when editing an existing record)
- next_due_date: Must be after last_inspection_date
- If is_not_required is true, last_inspection_date, next_due_date, result, and inspection_station are not required

#### 3.9.4 Business Logic

##### Expiration Status Calculation

**Purpose:** Determine the display status of registration and inspection records.

**Logic:**
```
1. RECEIVE expiration_date
2. today = current_date
3. IF today > expiration_date:
     status = "expired"
     days_over = today - expiration_date
4. ELSE IF today >= expiration_date - 30 days:
     status = "expiring_soon"
     days_remaining = expiration_date - today
5. ELSE:
     status = "active"
     days_remaining = expiration_date - today
6. RETURN { status, days_remaining or days_over }
```

##### Renewal Reminder Notifications

**Purpose:** Send local push notifications before registration and inspection expirations.

**Logic:**
```
1. WHEN a registration or inspection record is saved:
2. SCHEDULE notifications:
     60 days before: "{vehicle_name}: Registration expires in 60 days"
     30 days before: "{vehicle_name}: Registration expires in 30 days"
     7 days before:  "{vehicle_name}: Registration expires in 7 days"
     On expiration:  "{vehicle_name}: Registration expired today"
3. Same schedule pattern for inspection due dates
4. All notifications are local (on-device)
5. IF is_not_required = true for inspection: Skip inspection notifications
```

##### Auto-Suggest Next Registration Date

**Purpose:** When updating a registration, suggest the next expiration date based on renewal frequency.

**Logic:**
```
1. RECEIVE current_expiration_date, renewal_frequency
2. IF renewal_frequency = "annual":
     suggested_next = current_expiration_date + 1 year
3. ELSE IF renewal_frequency = "biennial":
     suggested_next = current_expiration_date + 2 years
4. ELSE:
     suggested_next = null (user must enter manually)
5. RETURN { suggested_next }
```

**Edge Cases:**
- Vehicle registered in a state that does not require inspections: User marks is_not_required = true
- Inspection failed: Record is saved with result "failed"; next_due_date is still tracked for re-inspection
- Multiple inspection types (some states require safety AND emissions separately): User creates separate inspection records for each type
- Registration cost varies by state and vehicle: User enters their specific renewal cost

#### 3.9.5 API/Integration

- No external API calls required
- Registration renewal costs feed into Expense Dashboard (CR-006) via MiscExpense (category: registration_fee)
- Uses local push notifications for expiration reminders
- All data stored locally in SQLite

#### 3.9.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Expiration date in the past (new record) | Inline message: "Expiration date cannot be in the past for a new registration" | User selects a future date |
| Next due date before last inspection date | Inline message: "Next due date must be after the last inspection date" | User corrects the date |
| Notification permission denied | Info banner: "Enable notifications in Settings to receive renewal reminders" | User can still view dates in-app |
| Photo storage fails | Alert: "Not enough storage to save this photo." | User frees device storage |
| Database write fails | Toast: "Could not save. Please try again." | User retaps Save |

**Validation Timing:**
- Date validation: On date selection
- Required field validation: On Save tap
- Photo limit: On photo addition attempt

#### 3.9.7 Performance Requirements

- Registration/Inspection Overview loads within 300ms
- Expiration status calculation completes within 50ms per record
- "All Vehicles" timeline loads within 400ms for up to 20 vehicles
- Notification scheduling completes within 200ms after save
- Document photo loads within 200ms

#### 3.9.8 Accessibility

- Status badges announce full text: "Registration is active, expires in {N} days", "Inspection is expired by {N} days", "Inspection is not required"
- Registration and Inspection cards announce all key fields on focus
- Document photos have alt text: "Registration document photo" / "Inspection certificate photo"
- "All Vehicles" timeline entries announce: "{vehicle_name}: {type} {status}, {date}" on focus
- Minimum touch target: 44x44 points

#### 3.9.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle with no registration data,
   **When** the user adds registration with expiration date Dec 31 2026 and annual renewal,
   **Then** the registration card shows "Active" with the expiration date and renewal reminders are scheduled.

2. **Given** an inspection that passed on June 1 2026 with next due June 1 2027,
   **When** the user views the Inspection Card,
   **Then** it shows "Passed" result, next due date, and "Active" status.

3. **Given** 3 vehicles with different expiration dates,
   **When** the user views "All Vehicles" timeline,
   **Then** expirations are listed sorted by date (soonest first) with vehicle names and types.

**Edge Cases:**

4. **Given** a vehicle registered in a state with no inspection requirement,
   **When** the user toggles "Not Required" on the inspection form,
   **Then** all inspection fields are hidden, the inspection card shows "Not Required", and no inspection notifications are scheduled.

5. **Given** a registration with annual renewal expiring Dec 31 2026,
   **When** the user taps "Renew",
   **Then** the suggested next expiration date is pre-filled as Dec 31 2027.

**Negative Tests:**

6. **Given** the user is adding a new registration,
   **When** they set the expiration date to a date in the past,
   **Then** inline validation "Expiration date cannot be in the past for a new registration" appears.

7. **Given** the user is editing an inspection,
   **When** they set next_due_date before last_inspection_date,
   **Then** inline validation "Next due date must be after the last inspection date" appears.

#### 3.9.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| determines active status | expiration: 90 days from today | status: "active", days_remaining: 90 |
| determines expiring_soon status | expiration: 15 days from today | status: "expiring_soon", days_remaining: 15 |
| determines expired status | expiration: 10 days ago | status: "expired", days_over: 10 |
| suggests next annual date | current: "2026-12-31", frequency: annual | suggested: "2027-12-31" |
| suggests next biennial date | current: "2026-12-31", frequency: biennial | suggested: "2028-12-31" |
| validates next_due after last_inspection | last: Jun 1, next: May 1 | Validation error |
| skips inspection fields when not required | is_not_required: true | No validation on date/result fields |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add registration and verify reminders | 1. Add registration expiring in 45 days, 2. Check scheduled notifications | 30-day and 7-day reminders are scheduled |
| Update inspection result | 1. Add inspection with "Failed", 2. Edit to "Passed" | Result updates, status reflects new data |
| Registration cost in expenses | 1. Add registration with $200 renewal cost | $200 appears as registration_fee in expense data |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Track registration and inspection for two vehicles | 1. Add registration for Vehicle A (expires Dec), 2. Add inspection for Vehicle A (due March), 3. Add registration for Vehicle B (expires June), 4. View "All Vehicles" | Timeline shows: Vehicle B registration (June), Vehicle A registration (Dec), Vehicle A inspection (March next year), sorted chronologically |

---

### 3.10 CR-010: VIN Decoder

#### 3.10.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to enter my VIN and have the app automatically fill in the year, make, model, engine, and transmission, so that I do not have to manually look up and type my vehicle specifications.

**Secondary:**
> As a privacy-first car enthusiast (Morgan), I want the VIN decoder to send only the 17-character VIN to the NHTSA API and never pair it with my name, location, or other identifying information, so that I can use the feature without compromising my privacy.

**Tertiary:**
> As a multi-vehicle household manager (Sam), I want to verify that the vehicle details in the app match the official manufacturer records from the VIN, so that I have accurate data for insurance and resale documentation.

#### 3.10.2 UI Requirements

##### Component: VIN Decode Button (integrated into Add/Edit Vehicle screen)

**Layout:**
- Appears below the VIN text field on the Add/Edit Vehicle screen (CR-001)
- Disabled when VIN field has fewer than 17 characters
- Enabled when VIN field has exactly 17 valid characters
- Button text: "Decode VIN" with a search/decode icon

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Disabled | VIN field has < 17 chars or contains invalid characters | Grayed out "Decode VIN" button |
| Ready | VIN field has exactly 17 valid chars | Enabled "Decode VIN" button |
| Loading | API request in progress | Spinner replacing button text, "Decoding..." |
| Success | API returned valid results | Green checkmark, "Vehicle details found", auto-populated fields highlighted |
| Partial | API returned some but not all fields | Amber info: "Some details could not be decoded. Please verify and complete manually." |
| Error | API request failed | Red info: "Could not decode VIN. Check your VIN or try again later." |

**Interactions:**
- Tap "Decode VIN": Send VIN to NHTSA API, show loading state
- On success: Auto-fill year, make, model, trim, engine, transmission, drivetrain, fuel type fields. Highlight auto-filled fields with a subtle border to distinguish from user-entered data.
- Auto-filled fields remain editable (user can override any decoded value)
- A small "Decoded from VIN" label appears under auto-filled fields

##### Screen: VIN Decode Results Preview

**Layout:**
- Modal that appears after successful decode
- Two-column comparison: "Decoded Value" vs. "Current Value" (if fields were already filled)
- Each row has a checkbox (default: checked) to accept the decoded value
- "Apply Selected" and "Cancel" buttons at the bottom
- If no current values exist, skip the preview and apply all directly

**Interactions:**
- Uncheck a row: That field will not be overwritten
- Tap "Apply Selected": Overwrite checked fields with decoded values
- Tap "Cancel": Discard all decoded values, return to form unchanged

#### 3.10.3 Data Requirements

##### Entity: VinDecodeCache

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique cache entry identifier |
| vin | string | Required, exactly 17 chars, unique | None | The VIN that was decoded |
| year | integer | Optional | null | Decoded model year |
| make | string | Optional, max 50 chars | null | Decoded manufacturer |
| model | string | Optional, max 50 chars | null | Decoded model name |
| trim | string | Optional, max 50 chars | null | Decoded trim level |
| engine | string | Optional, max 100 chars | null | Decoded engine description |
| transmission | string | Optional, max 50 chars | null | Decoded transmission type |
| drivetrain | string | Optional, max 20 chars | null | Decoded drivetrain (FWD/RWD/AWD/4WD) |
| fuel_type | string | Optional, max 30 chars | null | Decoded fuel type |
| body_type | string | Optional, max 50 chars | null | Decoded body style (sedan, SUV, truck, etc.) |
| raw_response | string | Optional, JSON string | null | Full NHTSA API response for reference |
| decoded_at | string | ISO 8601, auto-set | Current timestamp | When the decode was performed |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

**Indexes:**
- vin (unique) - Fast cache lookup by VIN

**Validation Rules:**
- vin: Exactly 17 characters, only A-Z (excluding I, O, Q) and 0-9, uppercase
- Cache entries are never deleted; once a VIN is decoded, the result is reused without re-calling the API

#### 3.10.4 Business Logic

##### VIN Format Validation

**Purpose:** Validate the VIN format before sending to the API.

**Logic:**
```
1. RECEIVE vin (string)
2. CONVERT vin to uppercase
3. IF length(vin) != 17:
     RETURN { valid: false, error: "VIN must be exactly 17 characters" }
4. IF vin contains any character not in [A-H, J-N, P, R-Z, 0-9]:
     RETURN { valid: false, error: "VIN contains invalid characters (I, O, Q are not allowed)" }
5. // Check digit validation (position 9)
   transliteration_map = {
     A:1, B:2, C:3, D:4, E:5, F:6, G:7, H:8,
     J:1, K:2, L:3, M:4, N:5, P:7, R:9,
     S:2, T:3, U:4, V:5, W:6, X:7, Y:8, Z:9,
     0:0, 1:1, 2:2, 3:3, 4:4, 5:5, 6:6, 7:7, 8:8, 9:9
   }
   weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
   sum = 0
   FOR i = 0 to 16:
     value = transliteration_map[vin[i]]
     sum = sum + (value * weights[i])
   remainder = sum MOD 11
   IF remainder = 10:
     check_char = "X"
   ELSE:
     check_char = STRING(remainder)
   IF vin[8] != check_char:
     RETURN { valid: false, error: "VIN check digit is invalid (position 9 should be {check_char})" }
6. RETURN { valid: true }
```

##### VIN Decode with Cache

**Purpose:** Decode a VIN using the NHTSA API, with local caching to avoid redundant network calls.

**Logic:**
```
1. RECEIVE vin
2. VALIDATE vin format (see VIN Format Validation above)
3. IF validation fails: RETURN validation error
4. CHECK cache: QUERY VinDecodeCache WHERE vin = vin
5. IF cache hit:
     RETURN cached decoded values
6. // Cache miss: call NHTSA API
   url = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json"
   response = HTTP_GET(url)
7. IF response.status != 200:
     RETURN { success: false, error: "VIN decode service unavailable. Try again later." }
8. PARSE response body
9. MAP NHTSA fields to app fields:
     year = response.Results[0].ModelYear
     make = response.Results[0].Make
     model = response.Results[0].Model
     trim = response.Results[0].Trim
     engine = "{response.Results[0].DisplacementL}L {response.Results[0].EngineCylinders}-cyl {response.Results[0].FuelTypePrimary}"
     transmission = MAP response.Results[0].TransmissionStyle to app enum
     drivetrain = MAP response.Results[0].DriveType to app enum
     fuel_type = MAP response.Results[0].FuelTypePrimary to app enum
     body_type = response.Results[0].BodyClass
10. SAVE to VinDecodeCache
11. RETURN decoded values
```

##### NHTSA Field Mapping

**Purpose:** Map NHTSA API response fields to app field values.

**Logic:**
```
Transmission mapping:
  "Automatic" -> "automatic"
  "Manual" -> "manual"
  "CVT" / "Continuously Variable" -> "cvt"
  "Dual-Clutch" / "DCT" -> "dct"
  everything else -> "other"

Drivetrain mapping:
  "Front-Wheel Drive" / "FWD" -> "fwd"
  "Rear-Wheel Drive" / "RWD" -> "rwd"
  "All-Wheel Drive" / "AWD" -> "awd"
  "4x4" / "4WD" / "Four-Wheel Drive" -> "4wd"

Fuel type mapping:
  "Gasoline" -> "regular" (default; user may upgrade to mid_grade/premium)
  "Diesel" -> "diesel"
  "Electric" -> "electric"
  "Hybrid" / "Plug-in Hybrid" -> "hybrid"
  "Flexible Fuel" / "E85" -> "e85"
```

**Edge Cases:**
- VIN not found in NHTSA database: API returns empty/null fields; treat as partial decode
- Very old vehicles (pre-1981): VINs may not be 17 characters; show error "VIN decoder supports 17-character VINs (1981 and later vehicles)"
- NHTSA API returns error codes in the response body: Parse ErrorCode fields; if ErrorCode = "1 - Check Digit Error", show "VIN may be incorrect"
- Network timeout: Return error after 10-second timeout
- NHTSA API down: Return cached results if available, otherwise show error

#### 3.10.5 API/Integration

##### NHTSA Vehicle API

- **Endpoint:** `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json`
- **Method:** GET
- **Authentication:** None (free public API)
- **Rate limits:** None published, but throttle to max 1 request per second to be a good API citizen
- **Data sent:** Only the 17-character VIN; no user identity, device ID, location, or other metadata
- **Privacy note:** The NHTSA API is operated by the US government (National Highway Traffic Safety Administration) and its privacy policy covers usage. Only the VIN leaves the device; the response is cached locally and the VIN is not paired with any user-identifying information.

#### 3.10.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| VIN invalid format | Inline message specific to the error (wrong length, invalid chars, bad check digit) | User corrects the VIN |
| Network unavailable | Alert: "No internet connection. VIN decode requires a one-time network request." | User connects to network and retries |
| API timeout (10s) | Alert: "VIN decode timed out. Please try again." | User taps "Decode VIN" again |
| API returns empty results | Info: "No vehicle data found for this VIN. You can enter details manually." | User fills in fields manually |
| API returns partial results | Info: "Some details could not be decoded. Please verify and complete manually." with unfilled fields highlighted | User completes missing fields |
| API returns error code | Alert: "VIN may be incorrect. Double-check the VIN and try again." | User verifies VIN accuracy |
| API service unavailable (500) | Alert: "VIN decode service is temporarily unavailable. Try again later." | User retries later or enters details manually |

**Validation Timing:**
- VIN format validation: On blur and on "Decode VIN" tap
- API call: Only on "Decode VIN" tap (never automatic)
- Cache check: Before API call

#### 3.10.7 Performance Requirements

- VIN format validation completes within 10ms
- Cache lookup completes within 50ms
- API response expected within 2-5 seconds; timeout at 10 seconds
- Field auto-population renders within 100ms after decode completes
- Results preview modal opens within 200ms

#### 3.10.8 Accessibility

- "Decode VIN" button announces its state: "Decode VIN, disabled" / "Decode VIN, ready" / "Decoding, please wait"
- Decoded fields announce: "{field_name}: {value}, decoded from VIN" on focus
- Results preview comparison table is screen-reader accessible with column headers
- Error and info messages are announced as live regions
- Loading spinner has accessible label: "Decoding your VIN"
- Minimum touch target: 44x44 points

#### 3.10.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Add Vehicle screen and has entered a valid 17-character VIN,
   **When** they tap "Decode VIN",
   **Then** the API returns vehicle data, the results preview shows decoded values, and on "Apply Selected" the form fields are auto-populated.

2. **Given** a VIN was previously decoded and cached,
   **When** the user enters the same VIN on a new vehicle (or re-taps decode),
   **Then** the cached results are used without a network call, and fields populate instantly.

3. **Given** the API returns year, make, model, and engine but not transmission or trim,
   **When** the decode completes,
   **Then** available fields are auto-filled, unfilled fields show a prompt to complete manually, and an info message says "Some details could not be decoded."

**Edge Cases:**

4. **Given** the user enters a VIN with an incorrect check digit,
   **When** they tap "Decode VIN",
   **Then** the system shows "VIN check digit is invalid (position 9 should be {correct_char})" without making an API call.

5. **Given** the network is unavailable,
   **When** the user taps "Decode VIN",
   **Then** the system shows "No internet connection. VIN decode requires a one-time network request."

6. **Given** the user has existing values in the form fields,
   **When** VIN decode returns different values,
   **Then** the results preview shows a comparison table with checkboxes, allowing the user to selectively apply decoded values.

**Negative Tests:**

7. **Given** a VIN with only 16 characters,
   **When** the user taps the VIN field away (blur),
   **Then** inline validation "VIN must be exactly 17 characters" appears and the "Decode VIN" button remains disabled.

8. **Given** a VIN containing the letter "O",
   **When** validated,
   **Then** inline validation "VIN cannot contain the letters I, O, or Q" appears.

#### 3.10.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates correct VIN format | "1HGCM82633A004352" | valid: true |
| rejects VIN with letter I | "1IGCM82633A004352" | valid: false, error mentions I/O/Q |
| rejects VIN with wrong length | "1HGCM826" | valid: false, error mentions 17 chars |
| validates check digit correctly | known valid VIN | valid: true |
| rejects incorrect check digit | VIN with wrong position 9 | valid: false, error shows expected check char |
| maps "Automatic" transmission | "Automatic" | "automatic" |
| maps "Front-Wheel Drive" drivetrain | "Front-Wheel Drive" | "fwd" |
| maps "Diesel" fuel type | "Diesel" | "diesel" |
| returns cached result on repeat lookup | VIN in cache | cached values returned without API call |
| handles null API fields gracefully | response with null Trim | trim field not populated, partial decode info shown |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full VIN decode flow | 1. Enter valid VIN, 2. Tap Decode, 3. Apply results | Form fields populated, cache entry created |
| Cache hit on repeat decode | 1. Decode VIN, 2. Clear form, 3. Re-enter same VIN, 4. Tap Decode | Instant result from cache, no network call |
| Partial decode with user completion | 1. Decode VIN that returns only make/model/year, 2. User fills in engine manually, 3. Save | Vehicle saved with mix of decoded and manual data |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Add vehicle via VIN decode | 1. Tap Add Vehicle, 2. Enter VIN, 3. Decode, 4. Review results, 5. Apply all, 6. Set odometer, 7. Save | Vehicle created with VIN-decoded specs, odometer set manually, VIN cached for future use |

---

### 3.11 CR-011: Parking Location Saver

#### 3.11.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to drop a pin when I park my car, so that I can find it later in a large parking lot, parking garage, or unfamiliar neighborhood.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want to save parking locations for different family vehicles, so that anyone in the household can find where a specific car is parked.

**Tertiary:**
> As a privacy-first car enthusiast (Morgan), I want parking locations stored only on my device and never synced to any cloud service, so that my location history remains private.

#### 3.11.2 UI Requirements

##### Screen: Parking Saver

**Layout:**
- Top section: Map view (approximately 60% of screen height) centered on the current parking pin (if set) or the user's current location
- Parking pin on the map with the vehicle's color or icon
- Below map: Parking details card showing:
  - Address or description of the parking location (auto-populated from reverse geocode if available, editable)
  - Level/floor field (text, for garages: "Level 3", "Section B", etc.)
  - Parking spot number (optional text)
  - Time parked (auto-set when pin is dropped, showing elapsed time)
  - Meter expiration timer (if set): countdown display with progress ring
  - Photo of parking area (optional)
- Action buttons: "Navigate to Car" (opens native maps app), "Clear Parking" (removes pin)
- If no parking pin is set: Large "Mark Parking Spot" button in the center

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Pin | No active parking pin | Map centered on user location, "Mark Parking Spot" button |
| Active Pin | Parking pin is set | Map centered on pin, details card with elapsed time |
| With Timer | Meter expiration is set | Countdown timer in details card, warning at 10 minutes remaining |
| Timer Expired | Meter time has elapsed | Red "Meter Expired" banner, notification sent |
| Location Unavailable | User denied location permission | Text input for manual address entry, no map |

**Interactions:**
- Tap "Mark Parking Spot": Drop pin at current location, start elapsed timer, optionally set meter timer
- Tap meter timer area: Set/edit meter expiration (time picker: 15min, 30min, 1hr, 2hr, 4hr, custom)
- Tap "Navigate to Car": Open native maps application with directions to the parked location
- Tap "Clear Parking": Confirmation dialog, then remove pin and reset
- Tap photo area: Add or view parking area photo
- Tap address: Edit the location description manually

##### Modal: Set Meter Timer

**Layout:**
- Title: "Parking Meter Timer"
- Quick select buttons: 15min, 30min, 1hr, 2hr, 4hr
- Custom time picker for other durations
- "Set Timer" and "Cancel" buttons
- If timer is already set: "Clear Timer" button

#### 3.11.3 Data Requirements

##### Entity: ParkingLocation

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique parking entry identifier |
| vehicle_id | string | Optional, references Vehicle.id | null | Associated vehicle (null for general parking) |
| latitude | float | Required (if location available), -90 to 90 | None | GPS latitude of parking location |
| longitude | float | Required (if location available), -180 to 180 | None | GPS longitude |
| address | string | Optional, max 200 chars | null | Street address or description |
| level_floor | string | Optional, max 30 chars | null | Garage level, floor, or section |
| spot_number | string | Optional, max 20 chars | null | Parking spot number |
| photo_uri | string | Optional, local file URI | null | Photo of the parking area |
| parked_at | string | Required, ISO 8601 datetime | Current datetime | When the vehicle was parked |
| meter_expires_at | string | Optional, ISO 8601 datetime | null | When the parking meter expires |
| is_active | boolean | - | true | Whether this is the current active parking pin |
| notes | string | Optional, max 200 chars | null | Additional notes |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

**Indexes:**
- (vehicle_id, is_active) - Active parking lookup per vehicle
- (is_active) - All active parking pins

**Validation Rules:**
- latitude: Must be between -90 and 90
- longitude: Must be between -180 and 180
- meter_expires_at: Must be after parked_at
- Only one active parking pin per vehicle at a time (setting a new one clears the old one)
- If location permission is denied, latitude and longitude can be null but address must be provided

#### 3.11.4 Business Logic

##### Drop Parking Pin

**Purpose:** Record the user's current location as a parking spot.

**Logic:**
```
1. REQUEST current GPS coordinates from device
2. IF location permission denied:
     PROMPT user for manual address entry
     SET latitude = null, longitude = null
3. ELSE:
     SET latitude = current_latitude
     SET longitude = current_longitude
     ATTEMPT reverse geocode to get address
     IF reverse geocode succeeds: SET address = geocoded_address
4. IF vehicle_id is provided:
     DEACTIVATE any existing active parking for this vehicle
5. CREATE ParkingLocation {
     vehicle_id, latitude, longitude, address,
     parked_at: current_datetime,
     is_active: true
   }
```

##### Meter Timer Management

**Purpose:** Track parking meter expiration and notify the user.

**Logic:**
```
1. RECEIVE parking_id, duration_minutes
2. SET meter_expires_at = parked_at + duration_minutes minutes
3. SAVE updated ParkingLocation
4. SCHEDULE local notification at (meter_expires_at - 10 minutes):
     title: "Parking Meter: 10 minutes remaining"
     body: "Your meter expires soon. Move your car or add more time."
5. SCHEDULE local notification at meter_expires_at:
     title: "Parking Meter Expired"
     body: "Your parking meter has expired."
```

##### Elapsed Time Display

**Purpose:** Show how long the car has been parked.

**Logic:**
```
1. RECEIVE parked_at
2. elapsed_minutes = current_datetime - parked_at (in minutes)
3. IF elapsed_minutes < 60:
     display = "{elapsed_minutes}m"
4. ELSE IF elapsed_minutes < 1440:
     hours = FLOOR(elapsed_minutes / 60)
     mins = elapsed_minutes MOD 60
     display = "{hours}h {mins}m"
5. ELSE:
     days = FLOOR(elapsed_minutes / 1440)
     hours = FLOOR((elapsed_minutes MOD 1440) / 60)
     display = "{days}d {hours}h"
6. RETURN display
```

**Edge Cases:**
- Location permission denied mid-session: Gracefully fall back to manual address entry
- GPS accuracy is poor (> 50 meter accuracy): Show warning "Location accuracy is low. Consider adding a photo or notes."
- User parks in a multi-story garage: GPS may be inaccurate; level/floor and spot number fields are especially important
- Meter timer set but app is killed: Local notification fires regardless; on app reopen, check if meter has expired
- Multiple vehicles parked simultaneously: Each vehicle has its own independent parking pin

#### 3.11.5 API/Integration

- **Reverse geocoding:** Uses device-native reverse geocoding (no external API call on iOS/Android; web may use a free geocoding service)
- **Native maps integration:** "Navigate to Car" opens Apple Maps (iOS), Google Maps (Android), or Google Maps in browser (web) with the parking coordinates
- GPS coordinates are processed on-device; no location data is transmitted to any external service
- Local push notifications for meter timer

#### 3.11.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Location permission denied | Info: "Location access is needed to save your parking spot. You can also enter an address manually." | User can enter address manually or grant permission in Settings |
| GPS accuracy poor | Warning: "Location accuracy is low ({accuracy}m). Add details like floor level or a photo to help find your car." | User adds supplementary details |
| Reverse geocode fails | Address field is left blank with placeholder "Enter address or description" | User types address manually |
| Notification permission denied | Info: "Enable notifications to receive meter expiration alerts" | Timer still visible in-app; no notification sent |
| Native maps app not available | Fallback: Copy coordinates to clipboard with toast "Coordinates copied. Paste into your maps app." | User pastes into any map application |
| Clearing pin accidentally | Confirmation: "Clear parking spot? This will remove the saved location for {vehicle_name}." | User confirms or cancels |

**Validation Timing:**
- Location validation: On pin drop
- Meter timer validation: On timer set
- Address validation (if manual): On Save

#### 3.11.7 Performance Requirements

- Pin drop (including GPS acquisition) completes within 3 seconds
- Reverse geocode completes within 2 seconds (non-blocking; address populates after pin is set)
- Map renders within 500ms
- Elapsed time updates every 60 seconds (not every second, to conserve battery)
- Meter countdown updates every second when within 10 minutes of expiration
- Navigate to Car launches native maps within 500ms

#### 3.11.8 Accessibility

- "Mark Parking Spot" button has accessible label: "Mark your current location as your parking spot"
- Parked time announces: "Parked {elapsed_time} ago at {address or 'unknown location'}" on focus
- Meter timer announces: "Meter expires in {time_remaining}" or "Meter has expired" on focus
- "Navigate to Car" button announces: "Open maps with directions to your parked car"
- Map has accessible description: "Map showing your parking location at {address}"
- Minimum touch target: 44x44 points

#### 3.11.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has location permission enabled,
   **When** they tap "Mark Parking Spot",
   **Then** a pin drops at their current GPS location, the address is auto-populated via reverse geocode, and elapsed time starts counting.

2. **Given** an active parking pin,
   **When** the user sets a 2-hour meter timer,
   **Then** a countdown is displayed, a notification is scheduled for 10 minutes before expiry, and a second notification for the expiry time.

3. **Given** an active parking pin,
   **When** the user taps "Navigate to Car",
   **Then** the native maps application opens with turn-by-turn directions from the user's current location to the parked car.

**Edge Cases:**

4. **Given** the user has denied location permission,
   **When** they tap "Mark Parking Spot",
   **Then** the map is hidden, a manual address entry field appears, and the pin is saved with the user-entered address but no coordinates.

5. **Given** a parking pin exists for Vehicle A,
   **When** the user drops a new pin for Vehicle A,
   **Then** the old pin is deactivated and the new pin becomes active.

6. **Given** GPS accuracy is 100 meters,
   **When** the pin is dropped,
   **Then** a warning "Location accuracy is low" appears and the user is prompted to add a photo or notes.

**Negative Tests:**

7. **Given** no active parking pin,
   **When** the user tries to tap "Navigate to Car",
   **Then** the button is not visible (only "Mark Parking Spot" is shown).

8. **Given** the user sets a meter timer,
   **When** they set the duration to 0 minutes,
   **Then** validation prevents saving with message "Timer duration must be at least 1 minute."

#### 3.11.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| formats elapsed time under 1 hour | parked 35 minutes ago | "35m" |
| formats elapsed time in hours | parked 150 minutes ago | "2h 30m" |
| formats elapsed time in days | parked 1560 minutes ago | "1d 2h" |
| calculates meter expiration | parked_at + 120 minutes | meter_expires_at = parked_at + 2 hours |
| validates latitude range | latitude: 91 | Validation error |
| validates longitude range | longitude: -181 | Validation error |
| deactivates old pin on new drop | existing active pin for vehicle | old pin is_active = false |
| handles null coordinates | location denied, address: "Main St lot" | Valid ParkingLocation with null lat/lng |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Drop pin and verify persistence | 1. Drop pin, 2. Close app, 3. Reopen | Pin and details restored from database |
| Meter timer notification | 1. Set 15-minute timer, 2. Wait for notifications | Notification at 5 minutes, notification at expiry |
| Navigate to car | 1. Drop pin, 2. Walk away, 3. Tap Navigate | Native maps opens with directions to saved coordinates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Complete parking flow | 1. Park car, 2. Drop pin, 3. Note floor/spot, 4. Set 2hr meter, 5. Leave, 6. Return via Navigate, 7. Clear pin | Full lifecycle: pin set, timer running, navigation works, pin cleared after return |

---

### 3.12 CR-012: Recall Alerts

#### 3.12.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to check if my vehicle has any open safety recalls from the manufacturer, so that I can get free repairs for known safety issues before they cause problems.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want to check recall status for all my vehicles at once, so that I can ensure every family car is safe and up to date on recall repairs.

**Tertiary:**
> As a privacy-first car enthusiast (Morgan), I want recall checks to use only my VIN (not my name, address, or phone number), so that I get safety information without exposing personal data.

#### 3.12.2 UI Requirements

##### Screen: Recall Check

**Layout:**
- Top navigation bar with "Recalls" title and vehicle selector dropdown
- If VIN is on file: "Check for Recalls" button with the VIN displayed (masked: showing only last 6 characters, e.g., "***********004352")
- If no VIN on file: Info card directing the user to add a VIN in vehicle settings
- Results section (after checking):
  - Summary: "{N} open recalls found" or "No open recalls" with a green checkmark
  - Recall list: each recall card shows: NHTSA campaign number, component affected, summary, consequence, remedy, and date issued
  - Status per recall: "Open" (not repaired) or "Check with Dealer" (unknown status)
- "Last Checked: {date}" label showing when recalls were last retrieved
- "Refresh" button to re-check

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No VIN | Vehicle has no VIN stored | Info card: "Add your VIN in vehicle settings to check for recalls" with a link to edit vehicle |
| Not Checked | VIN exists but recalls have never been checked | "Check for Recalls" button |
| Loading | API request in progress | Spinner with "Checking for recalls..." |
| No Recalls | Check completed, zero open recalls | Green checkmark, "No open recalls found", last checked date |
| Recalls Found | Check completed, 1+ open recalls | Yellow warning icon, "{N} open recalls", recall cards listed |
| Error | API request failed | Red info: "Could not check for recalls. Try again later." |

**Interactions:**
- Tap "Check for Recalls": Send VIN to NHTSA Recalls API, show loading state
- Tap a recall card: Expand to show full details (consequence, remedy, notes)
- Tap "Refresh": Re-check the API for updated recall information
- Tap masked VIN: Momentarily reveal full VIN (tap again to mask)

#### 3.12.3 Data Requirements

##### Entity: RecallCheck

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique check identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| vin | string | Required, exactly 17 chars | None | VIN used for the check |
| checked_at | string | Required, ISO 8601 datetime | Current datetime | When the check was performed |
| recall_count | integer | Required, min 0 | 0 | Number of recalls found |
| raw_response | string | Optional, JSON string | null | Full API response |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

##### Entity: RecallEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique recall identifier |
| recall_check_id | string | Required, references RecallCheck.id | None | Associated check |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| campaign_number | string | Required, max 20 chars | None | NHTSA recall campaign number |
| component | string | Required, max 200 chars | None | Affected component |
| summary | string | Required, max 2000 chars | None | Description of the defect |
| consequence | string | Optional, max 2000 chars | null | What can happen if not repaired |
| remedy | string | Optional, max 2000 chars | null | How the recall is remedied |
| date_issued | string | Optional, ISO 8601 date | null | When the recall was issued |
| notes | string | Optional, max 500 chars | null | Additional NHTSA notes |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- RecallCheck belongs to Vehicle (many-to-one)
- RecallCheck has many RecallEntry (one-to-many)

**Indexes:**
- (vehicle_id, checked_at DESC) - Most recent check per vehicle
- (campaign_number) - Lookup by campaign number to detect duplicates across checks

**Validation Rules:**
- VIN must be exactly 17 characters and match the vehicle's stored VIN
- Recall entries are immutable after creation (they represent a snapshot of the NHTSA response)

#### 3.12.4 Business Logic

##### Recall Check with NHTSA API

**Purpose:** Check a vehicle's VIN for open safety recalls.

**Logic:**
```
1. RECEIVE vehicle_id
2. FETCH vehicle WHERE id = vehicle_id
3. IF vehicle.vin is null OR vehicle.vin.length != 17:
     RETURN { error: "Vehicle must have a valid VIN to check for recalls" }
4. url = "https://api.nhtsa.gov/recalls/recallsByVehicle?make={vehicle.make}&model={vehicle.model}&modelYear={vehicle.year}"
   (Note: NHTSA also supports VIN-based lookup at different endpoints)
5. response = HTTP_GET(url)
6. IF response.status != 200:
     RETURN { success: false, error: "Recall check service unavailable" }
7. PARSE response.results
8. CREATE RecallCheck {
     vehicle_id,
     vin: vehicle.vin,
     checked_at: current_datetime,
     recall_count: COUNT(results),
     raw_response: JSON.stringify(response)
   }
9. FOR each recall in results:
     CREATE RecallEntry {
       recall_check_id,
       vehicle_id,
       campaign_number: recall.NHTSACampaignNumber,
       component: recall.Component,
       summary: recall.Summary,
       consequence: recall.Consequence,
       remedy: recall.Remedy,
       date_issued: recall.ReportReceivedDate
     }
10. RETURN { recall_count, recalls: entries }
```

##### Recall Check Freshness

**Purpose:** Determine if a recall check should be refreshed.

**Logic:**
```
1. RECEIVE vehicle_id
2. FIND latest_check = RecallCheck WHERE vehicle_id ORDER BY checked_at DESC LIMIT 1
3. IF latest_check is null:
     RETURN { stale: true, message: "Never checked" }
4. days_since_check = current_date - latest_check.checked_at
5. IF days_since_check >= 30:
     RETURN { stale: true, message: "Last checked {days_since_check} days ago" }
6. RETURN { stale: false, last_checked: latest_check.checked_at }
```

**Edge Cases:**
- Vehicle make/model/year differ from VIN-decoded values: Use user-entered values (they may have corrected the VIN decode)
- NHTSA returns recalls for a broader make/model range: All returned recalls are saved; user can dismiss irrelevant ones
- Same recall appears across multiple checks: Deduplicate by campaign_number when displaying
- NHTSA API endpoint changes: The app should have a configurable API base URL for future flexibility

#### 3.12.5 API/Integration

##### NHTSA Recalls API

- **Endpoint:** `https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}`
- **Method:** GET
- **Authentication:** None (free public API)
- **Rate limits:** None published; throttle to 1 request per second
- **Data sent:** Make, model, and model year (no personal information)
- **Privacy note:** Only vehicle identification data (make, model, year) is sent. No user identity, device ID, or location data is transmitted. The VIN is not sent to this endpoint (it uses make/model/year instead).

#### 3.12.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No VIN on file | Info card: "Add your VIN in vehicle settings to check for recalls" with link to edit vehicle | User adds VIN |
| Network unavailable | Alert: "No internet connection. Recall checks require a network request." | User connects and retries |
| API timeout (10s) | Alert: "Recall check timed out. Please try again." | User taps Refresh |
| API returns error | Alert: "Recall check service is temporarily unavailable. Try again later." | User retries later |
| API returns zero results | Green card: "No open recalls found for your {year} {make} {model}." | Informational; no action needed |
| VIN does not match make/model | Warning: "Recall results are based on your vehicle's make, model, and year. Verify your VIN is correct." | User verifies VIN |

**Validation Timing:**
- VIN presence check: When screen loads
- API call: Only on user-initiated tap

#### 3.12.7 Performance Requirements

- Recall check screen loads within 300ms (showing cached results)
- API response expected within 2-5 seconds; timeout at 10 seconds
- Parsing and storing recall entries completes within 500ms for up to 20 recalls
- Recall card expansion animates within 200ms

#### 3.12.8 Accessibility

- "Check for Recalls" button announces: "Check for safety recalls using your vehicle's VIN"
- Recall count summary announces: "{N} open safety recalls found" or "No open safety recalls" on focus
- Each recall card announces: "Recall: {component}, issued {date}, {campaign_number}" on focus
- Expanded recall detail is readable by screen readers in logical order
- Masked VIN announces: "VIN ending in {last 6}, tap to reveal full VIN"
- Minimum touch target: 44x44 points

#### 3.12.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle with VIN "1HGCM82633A004352",
   **When** the user taps "Check for Recalls",
   **Then** the NHTSA API is called, and any recalls are displayed as cards with campaign number, component, summary, and remedy.

2. **Given** a recall check returned 0 recalls,
   **When** the user views the Recall Check screen,
   **Then** a green checkmark appears with "No open recalls found" and the last checked date.

3. **Given** a previous check was performed 35 days ago,
   **When** the user opens the Recall Check screen,
   **Then** a "Last checked 35 days ago" label appears with a suggestion to refresh.

**Edge Cases:**

4. **Given** a vehicle with no VIN stored,
   **When** the user opens the Recall Check screen,
   **Then** an info card says "Add your VIN in vehicle settings to check for recalls" with a link to edit the vehicle.

5. **Given** the same recall campaign was found in two separate checks,
   **When** the user views the recall list,
   **Then** the recall appears only once (deduplicated by campaign_number).

**Negative Tests:**

6. **Given** the network is unavailable,
   **When** the user taps "Check for Recalls",
   **Then** an alert says "No internet connection. Recall checks require a network request."

7. **Given** the NHTSA API returns an error,
   **When** the check is attempted,
   **Then** the user sees "Recall check service is temporarily unavailable. Try again later." and any previously cached results remain visible.

#### 3.12.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| requires VIN for recall check | vehicle.vin: null | Error: "Vehicle must have a valid VIN" |
| parses NHTSA recall response | mock API response with 2 recalls | 2 RecallEntry records created |
| determines stale check (30+ days) | checked_at: 35 days ago | stale: true |
| determines fresh check (< 30 days) | checked_at: 10 days ago | stale: false |
| deduplicates by campaign_number | 2 entries with same campaign_number | 1 displayed |
| handles zero recall response | API returns empty results | recall_count: 0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Check recalls and display | 1. Vehicle with VIN, 2. Tap Check, 3. View results | Recalls displayed with full details |
| Cached results persist | 1. Check recalls, 2. Close screen, 3. Reopen | Previous results shown with last checked date |
| Refresh updates results | 1. Have cached check, 2. Tap Refresh | New API call, results updated |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Check recalls for two vehicles | 1. Check recalls for Vehicle A (2 found), 2. Check for Vehicle B (0 found) | Vehicle A shows 2 recall cards, Vehicle B shows green checkmark |

---

### 3.13 CR-013: Tire Tracking

#### 3.13.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to track which tires are on my vehicle, including brand, size, and purchase date, so that I know when they need rotation or replacement.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want to see the mileage on each set of tires across my vehicles, so that I can plan tire purchases and rotations proactively.

**Tertiary:**
> As a budget-conscious owner (Riley), I want to track the cost per mile of my tires to compare different brands and tire types, so that I can make informed purchasing decisions for future tire replacements.

#### 3.13.2 UI Requirements

##### Screen: Tire Overview

**Layout:**
- Top navigation bar with "Tires" title and vehicle selector dropdown
- Visual tire layout: top-down vehicle silhouette showing 4 tire positions (front left, front right, rear left, rear right), each showing the tire's current status indicator
- Each tire position shows: tire brand abbreviation, mileage since install, and a status dot (green: good, amber: rotate soon, red: replace soon)
- Below the visual: tire set details card showing brand, model, size, type (all-season, summer, winter, performance), purchase date, purchase price, total mileage
- Rotation history section: chronological list of tire rotations
- Action buttons: "Log Rotation", "Replace Tires", "Edit Tire Info"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Tires | No tire data for vehicle | Tire icon, "No tire data", "Tap 'Add Tires' to start tracking" |
| Active Set | Tire set is logged and active | Visual layout with status indicators and details |
| Rotation Due | Mileage since last rotation >= rotation_interval | Amber "Rotation Due" banner above visual |
| Replace Soon | Tread depth is low or mileage exceeds expected tire life | Red "Replace Soon" banner |

**Interactions:**
- Tap a tire position on the visual: Show tire detail popup (brand, size, tread depth, mileage on this position)
- Tap "Log Rotation": Open rotation logging form (date, odometer, rotation pattern)
- Tap "Replace Tires": Open tire replacement form (new tire details)
- Tap rotation history entry: Show rotation detail

##### Screen: Add/Edit Tire Set

**Layout:**
- Scrollable form with fields:
  - **Brand** - Required, text, max 50 chars (e.g., "Michelin")
  - **Model** - Optional, text, max 50 chars (e.g., "Defender T+H")
  - **Size** - Required, text, max 20 chars (e.g., "225/65R17")
  - **Type** - Required, picker: All-Season, Summer, Winter, Performance, All-Terrain, Mud-Terrain
  - **Purchase Date** - Optional, date picker
  - **Purchase Price** - Optional, currency (total for the set, min 0, max 9999.99)
  - **Install Odometer** - Required, integer, min 0
  - **Expected Life** - Optional, integer (miles), default: 50000. Used for "Replace Soon" calculation
  - **Tread Depth** - Optional, float (in 32nds of an inch), min 0, max 20, default: 10 (new tire depth)
  - **Tire Count** - Required, integer, min 1, max 6, default: 4. Number of tires in the set
- Bottom bar: "Cancel" and "Save" buttons

##### Modal: Log Tire Rotation

**Layout:**
- Date picker (default: today)
- Odometer reading (required, integer)
- Rotation pattern: picker showing common patterns:
  - Front to Back (straight swap)
  - X-Pattern (cross rotation)
  - Forward Cross
  - Rearward Cross
  - Side to Side (for directional tires)
  - Custom (with diagram showing position changes)
- Shop name (optional, text, max 100 chars)
- Cost (optional, currency)
- Notes (optional, max 200 chars)
- "Save" and "Cancel" buttons

#### 3.13.3 Data Requirements

##### Entity: TireSet

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique tire set identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| brand | string | Required, max 50 chars | None | Tire manufacturer |
| model | string | Optional, max 50 chars | null | Tire model name |
| size | string | Required, max 20 chars | None | Tire size code |
| tire_type | string | Required, one of: all_season, summer, winter, performance, all_terrain, mud_terrain | None | Tire category |
| purchase_date | string | Optional, ISO 8601 date | null | Date tires were purchased |
| purchase_price | float | Optional, min 0, max 9999.99 | null | Total price for the set |
| install_odometer | integer | Required, min 0 | None | Odometer when tires were installed |
| expected_life_miles | integer | Optional, min 1000, max 200000 | 50000 | Expected tire lifespan in miles |
| tread_depth | float | Optional, min 0, max 20 | 10 | Current tread depth in 32nds of an inch |
| tire_count | integer | Required, min 1, max 6 | 4 | Number of tires in the set |
| is_active | boolean | - | true | Whether this is the currently installed set |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

##### Entity: TireRotation

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique rotation identifier |
| tire_set_id | string | Required, references TireSet.id | None | Associated tire set |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| rotation_date | string | Required, ISO 8601 date | Today | Date of rotation |
| odometer | integer | Required, min 0 | None | Odometer at time of rotation |
| pattern | string | Required, one of: front_to_back, x_pattern, forward_cross, rearward_cross, side_to_side, custom | None | Rotation pattern used |
| shop_name | string | Optional, max 100 chars | null | Where the rotation was performed |
| cost | float | Optional, min 0, max 999.99 | null | Rotation cost |
| notes | string | Optional, max 200 chars | null | Additional notes |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- TireSet belongs to Vehicle (many-to-one)
- TireSet has many TireRotation (one-to-many)

**Indexes:**
- (vehicle_id, is_active) - Active tire set per vehicle
- (tire_set_id, rotation_date DESC) - Rotation history per tire set

**Validation Rules:**
- Only one active tire set per vehicle at a time
- install_odometer must be <= current vehicle odometer
- Rotation odometer must be > previous rotation odometer for this tire set
- tread_depth: 2/32 or below triggers "Replace Soon" status

#### 3.13.4 Business Logic

##### Tire Mileage Calculation

**Purpose:** Calculate total miles driven on the current tire set.

**Logic:**
```
1. RECEIVE tire_set (TireSet), vehicle (Vehicle)
2. tire_miles = vehicle.odometer - tire_set.install_odometer
3. IF tire_miles < 0:
     tire_miles = 0 (data inconsistency)
4. RETURN { tire_miles }
```

##### Tire Status Determination

**Purpose:** Determine tire status based on mileage, tread depth, and rotation schedule.

**Logic:**
```
1. RECEIVE tire_set, vehicle
2. tire_miles = vehicle.odometer - tire_set.install_odometer
3. // Tread depth check
   IF tire_set.tread_depth IS NOT NULL AND tire_set.tread_depth <= 2:
     tread_status = "replace_now"
   ELSE IF tire_set.tread_depth IS NOT NULL AND tire_set.tread_depth <= 4:
     tread_status = "replace_soon"
   ELSE:
     tread_status = "ok"
4. // Mileage life check
   IF tire_set.expected_life_miles IS NOT NULL:
     life_remaining = tire_set.expected_life_miles - tire_miles
     IF life_remaining <= 0:
       mileage_status = "replace_soon"
     ELSE IF life_remaining <= 5000:
       mileage_status = "replace_approaching"
     ELSE:
       mileage_status = "ok"
5. // Rotation check
   FIND last_rotation = most recent TireRotation for this tire_set
   IF last_rotation is null:
     miles_since_rotation = tire_miles
   ELSE:
     miles_since_rotation = vehicle.odometer - last_rotation.odometer
   rotation_interval = 7500 (default, aligned with CR-004 defaults)
   IF miles_since_rotation >= rotation_interval:
     rotation_status = "rotation_due"
   ELSE IF miles_since_rotation >= rotation_interval - 1000:
     rotation_status = "rotation_soon"
   ELSE:
     rotation_status = "ok"
6. // Overall status (most urgent wins)
   IF tread_status = "replace_now" OR mileage_status = "replace_soon":
     overall = "replace"
   ELSE IF tread_status = "replace_soon" OR mileage_status = "replace_approaching" OR rotation_status = "rotation_due":
     overall = "attention"
   ELSE:
     overall = "good"
7. RETURN { overall, tread_status, mileage_status, rotation_status, tire_miles, miles_since_rotation }
```

##### Tire Cost Per Mile

**Purpose:** Calculate cost per mile for a tire set.

**Logic:**
```
1. RECEIVE tire_set, vehicle
2. tire_miles = vehicle.odometer - tire_set.install_odometer
3. IF tire_miles <= 0 OR tire_set.purchase_price is null:
     RETURN { cost_per_mile: null }
4. rotation_costs = SUM(cost) FROM TireRotation WHERE tire_set_id (treat null as 0)
5. total_tire_cost = tire_set.purchase_price + rotation_costs
6. cost_per_mile = total_tire_cost / tire_miles
7. ROUND to 4 decimal places
8. RETURN { cost_per_mile, total_tire_cost, tire_miles }
```

**Edge Cases:**
- Vehicle with more or fewer than 4 tires (e.g., 6-wheel truck, 3-wheel vehicle): tire_count field accommodates this
- Seasonal tire swaps (summer/winter sets): User deactivates current set and activates the other; mileage tracking pauses on inactive sets
- Tread depth not measured: Status relies on mileage alone
- New tires installed at a different shop than where purchased: install_odometer is independent of purchase tracking

#### 3.13.5 API/Integration

- No external API calls required
- Tire rotations are linked to the MaintenanceSchedule system (CR-004) via the tire_rotation service type
- Tire replacement costs feed into the Expense Dashboard (CR-006)
- All data stored locally in SQLite

#### 3.13.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Brand not entered | Inline message: "Tire brand is required" | User enters brand |
| Size not entered | Inline message: "Tire size is required" | User enters size |
| Install odometer > vehicle odometer | Warning: "Install odometer ({install}) is higher than the vehicle's current reading ({current}). Please verify." | User corrects install odometer or updates vehicle odometer |
| Rotation odometer < previous rotation | Inline message: "Rotation odometer must be greater than the previous rotation ({previous})" | User corrects the value |
| Tread depth out of range | Inline message: "Tread depth must be between 0 and 20 (in 32nds of an inch)" | User corrects the value |
| Replacing tires when active set exists | Confirmation: "Replace current {brand} {model} tires? The old set will be deactivated." | User confirms or cancels |

**Validation Timing:**
- Required field validation: On Save tap
- Odometer validation: On blur
- Tread depth validation: On blur

#### 3.13.7 Performance Requirements

- Tire Overview loads within 300ms including visual layout rendering
- Tire status calculation completes within 100ms
- Cost per mile calculation completes within 50ms
- Rotation history loads within 200ms for up to 50 rotations
- Tire set save completes within 200ms

#### 3.13.8 Accessibility

- Visual tire layout has text alternative: "Tire layout showing {front_left_status}, {front_right_status}, {rear_left_status}, {rear_right_status}"
- Each tire position announces: "{position}: {brand} {size}, {mileage} miles, {status}" on focus
- Rotation pattern picker describes each pattern: "Front to Back: front tires move to rear, rear tires move to front"
- Status banners announce their urgency level: "Rotation due", "Replace tires soon"
- Minimum touch target: 44x44 points

#### 3.13.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle with no tire data,
   **When** the user adds a tire set (Michelin Defender, 225/65R17, All-Season, installed at 30000 miles),
   **Then** the Tire Overview shows the tire visual with "good" status on all positions and tire details card.

2. **Given** a tire set installed at 30000 miles and the vehicle is now at 37500 miles,
   **When** the user views the Tire Overview,
   **Then** the system shows "Rotation Due" banner (7500 miles since install, no rotations logged).

3. **Given** the user logs a tire rotation with X-Pattern at 37500 miles,
   **When** the rotation is saved,
   **Then** the rotation appears in history, the "Rotation Due" banner disappears, and the maintenance schedule updates.

**Edge Cases:**

4. **Given** a tire set with tread_depth updated to 2/32,
   **When** the user views the Tire Overview,
   **Then** a "Replace Soon" banner appears regardless of mileage remaining.

5. **Given** the user has winter tires and summer tires,
   **When** they switch to winter tires,
   **Then** the summer set is deactivated (data preserved), winter set is activated, and mileage tracking continues from where the winter set left off.

**Negative Tests:**

6. **Given** the Add Tire Set form,
   **When** the user taps Save without entering brand or size,
   **Then** inline validation errors appear on both fields.

7. **Given** a tire set with last rotation at odometer 37500,
   **When** the user tries to log a rotation at odometer 37000,
   **Then** validation error "Rotation odometer must be greater than the previous rotation (37500)" appears.

#### 3.13.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates tire mileage | install: 30000, current: 42000 | tire_miles: 12000 |
| determines good status | tread: 8, life_remaining: 30000, rotation_ok | overall: "good" |
| determines attention for rotation due | miles_since_rotation: 8000, interval: 7500 | rotation_status: "rotation_due", overall: "attention" |
| determines replace for low tread | tread: 1.5 | tread_status: "replace_now", overall: "replace" |
| calculates tire cost per mile | price: 600, rotations: 50, miles: 25000 | cost_per_mile: 0.0260 |
| handles null purchase price | price: null, miles: 25000 | cost_per_mile: null |
| validates tire_count range | tire_count: 7 | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add tires and verify status | 1. Add tire set at 30000, 2. Vehicle at 35000 | Status shows "good", 5000 miles on tires |
| Log rotation and verify schedule | 1. Log rotation at 37500, 2. Check maintenance schedule | Tire rotation schedule updated |
| Replace tires | 1. Have active set, 2. Add new set | Old set deactivated, new set active with 0 miles |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full tire lifecycle | 1. Install tires at 30000, 2. Rotate at 37500, 3. Rotate at 45000, 4. Update tread to 3/32 at 55000, 5. Replace at 60000 | Tire history shows 2 sets (retired + active), rotation records for old set, cost per mile calculated for retired set |

---

### 3.14 CR-014: Data Export

#### 3.14.1 User Stories

**Primary:**
> As a mileage tracker (Jordan), I want to export my trip log as a CSV file organized by purpose category and date range, so that I can submit IRS-compliant mileage records to my accountant or attach them to my tax return.

**Secondary:**
> As a privacy-first car enthusiast (Morgan), I want to export all my vehicle data (maintenance records, fuel logs, expenses, documents) as CSV or JSON, so that I own a portable copy of my data that is not locked into any single app.

**Tertiary:**
> As a budget-conscious owner (Riley), I want to export an expense summary report for a specific vehicle and time period, so that I can analyze vehicle costs in a spreadsheet or share them with my partner.

#### 3.14.2 UI Requirements

##### Screen: Export Data

**Layout:**
- Top navigation bar with "Export Data" title
- Vehicle selector: specific vehicle or "All Vehicles"
- Data type selector (checkboxes): Vehicles, Maintenance Records, Fuel Logs, Trips, Expenses, Insurance, Registration, Tires
- Date range selector: "All Time", "This Year", "Last Year", "Custom Range" (with start/end date pickers)
- Format selector: CSV, JSON
- Special report options:
  - "IRS Mileage Report" toggle (pre-configures: Trips data, grouped by purpose, with IRS rate calculations, CSV format)
  - "Expense Summary" toggle (pre-configures: all expense sources, grouped by category, with totals)
- Preview section: shows estimated row count and file size
- "Export" button at the bottom
- After export: share sheet (email, Files, AirDrop, etc.)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | User has selected options | "Export" button enabled, preview shows estimates |
| No Data | Selected options match no records | Info: "No data matches your selection. Try a different date range or data type." |
| Exporting | File generation in progress | Progress bar with "Generating export..." |
| Complete | File generated | Success card with file name, size, and "Share" button |
| Error | File generation failed | Error message with retry button |

**Interactions:**
- Toggle data types: Update preview estimates
- Select date range: Update preview estimates
- Tap "IRS Mileage Report": Auto-select Trips, CSV format, current tax year
- Tap "Export": Generate file, show progress, then share sheet
- Tap "Share": Open system share sheet with the generated file

#### 3.14.3 Data Requirements

##### Entity: ExportHistory

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique export identifier |
| vehicle_id | string | Optional, references Vehicle.id | null | Specific vehicle or null for all |
| data_types | string | Required, comma-separated list | None | Which data types were included |
| format | string | Required, one of: csv, json | None | Export file format |
| date_range_start | string | Optional, ISO 8601 date | null | Start of date range filter |
| date_range_end | string | Optional, ISO 8601 date | null | End of date range filter |
| file_name | string | Required, max 200 chars | None | Generated file name |
| record_count | integer | Required, min 0 | None | Total records exported |
| file_size_bytes | integer | Required, min 0 | None | Size of the generated file |
| exported_at | string | ISO 8601, auto-set | Current timestamp | When the export was performed |

**Indexes:**
- (exported_at DESC) - Recent exports list

**Note:** Export files are saved to the device's temporary directory and are not persisted long-term by the app. Users should share/save exports via the share sheet.

#### 3.14.4 Business Logic

##### CSV Export Generation

**Purpose:** Generate a well-formatted CSV file from selected data.

**Logic:**
```
1. RECEIVE vehicle_id (or null for all), data_types[], start_date, end_date, format
2. FOR each selected data_type:
     QUERY matching records with date and vehicle filters
3. IF format = "csv":
     FOR each data_type:
       IF multiple data types: create separate sections with header rows
       IF single data type: flat CSV with column headers
       WRITE header row with column names
       WRITE data rows sorted by date ascending
       IF IRS Mileage Report:
         ADD summary section at bottom with:
           Total miles by purpose
           IRS rate applied
           Deduction amounts
           Disclaimer: "Rates from IRS Standard Mileage Rates. Consult a tax professional."
4. IF format = "json":
     CREATE JSON object with key per data_type
     WRITE as formatted JSON with 2-space indentation
5. file_name = "MyCar-Export-{vehicle_name or 'All'}-{date}.{format}"
6. SAVE to temporary directory
7. LOG export to ExportHistory
8. RETURN { file_path, file_name, record_count, file_size_bytes }
```

##### IRS Mileage Report Format

**Purpose:** Generate a tax-ready mileage report.

**Logic:**
```
CSV columns for IRS Mileage Report:
  Date, Purpose, Start Location, End Location, Distance (miles), Round Trip (Y/N), Description, Vehicle

Summary section:
  Business Miles: {total}
  Business Deduction ({rate}/mile): ${amount}
  Medical/Moving Miles: {total}
  Medical/Moving Deduction ({rate}/mile): ${amount}
  Charity Miles: {total}
  Charity Deduction ({rate}/mile): ${amount}
  Total Deduction: ${total}

  Note: IRS Standard Mileage Rates for {year}. Consult your tax professional.
```

**Edge Cases:**
- Large datasets (1000+ records): Generate file asynchronously with progress indicator
- Special characters in data fields: Properly escape CSV values (wrap in quotes, escape internal quotes)
- Unicode characters: Export as UTF-8 with BOM for Excel compatibility
- Empty export (no matching data): Generate file with headers only and a note "No records match the selected criteria"
- Multiple vehicles selected: Include vehicle name column in every row

#### 3.14.5 API/Integration

- No external API calls required
- Generated files are stored temporarily in the app's cache/temp directory
- Share sheet uses the platform's native sharing mechanism
- CSV files are UTF-8 encoded with BOM for Excel compatibility
- JSON files use 2-space indentation for readability

#### 3.14.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data matches selection | Info: "No data matches your selection. Try a different date range or data type." | User adjusts filters |
| Disk space insufficient | Alert: "Not enough storage to create the export file. Free up space and try again." | User frees storage |
| File generation fails | Alert: "Export failed. Please try again." with retry button | User taps retry |
| Share cancelled by user | No error; file remains in temp directory for re-sharing | User can tap "Share" again |
| Export takes too long (> 30s) | Progress bar with "Still working..." message | Continues generating; user can cancel |

**Validation Timing:**
- Data type selection: At least one required; validated on Export tap
- Date range: End date must be >= start date; validated on date selection

#### 3.14.7 Performance Requirements

- Export preview estimates update within 200ms
- CSV generation completes within 5 seconds for up to 5000 records
- JSON generation completes within 5 seconds for up to 5000 records
- File writing to temp directory completes within 1 second
- Share sheet opens within 500ms after file generation

#### 3.14.8 Accessibility

- Data type checkboxes have accessible labels: "Export {type} records"
- Format selector announces: "Export format: {format}" on focus
- Progress bar announces: "Exporting data, {percentage}% complete" at 25% intervals
- Export complete card announces: "Export complete. {record_count} records saved to {file_name}. Tap Share to send."
- Minimum touch target: 44x44 points

#### 3.14.9 Acceptance Criteria

**Happy Path:**

1. **Given** a vehicle with 50 maintenance records,
   **When** the user selects "Maintenance Records", "All Time", "CSV" and taps Export,
   **Then** a CSV file is generated with 50 data rows plus a header row, and the share sheet opens.

2. **Given** 30 business trips in tax year 2026,
   **When** the user toggles "IRS Mileage Report" and taps Export,
   **Then** a CSV is generated with trip rows sorted by date, a summary section showing total business miles and deduction amount, and the IRS rate disclaimer.

3. **Given** a vehicle with fuel, maintenance, and expense data,
   **When** the user selects all data types and JSON format,
   **Then** a JSON file is generated with separate keys for each data type, properly formatted.

**Edge Cases:**

4. **Given** no trips exist in the selected date range,
   **When** the user exports trips,
   **Then** the file contains headers only with a note "No records match the selected criteria."

5. **Given** a maintenance record with notes containing commas and quotes,
   **When** exported as CSV,
   **Then** the notes field is properly escaped (wrapped in double quotes, internal quotes doubled).

**Negative Tests:**

6. **Given** no data types are selected,
   **When** the user taps Export,
   **Then** validation message "Please select at least one data type to export" appears.

7. **Given** the custom date range has end date before start date,
   **When** the user selects the dates,
   **Then** validation message "End date must be on or after start date" appears.

#### 3.14.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates valid CSV headers | data_type: maintenance | "id,vehicle_id,service_type,service_date,odometer,cost,shop_name,notes" |
| escapes CSV special characters | notes: 'Oil "5W-30", filter changed' | '"Oil ""5W-30"", filter changed"' |
| generates IRS summary section | business: 2000mi, rate: 0.70 | "Business Deduction ($0.70/mile): $1,400.00" |
| generates valid JSON structure | 2 fuel entries | { "fuel_entries": [ {...}, {...} ] } |
| calculates file size estimate | 100 records, CSV | approximate size within 20% |
| handles empty dataset | 0 matching records | File with headers only |
| validates at least one data type | data_types: [] | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full CSV export | 1. Select vehicle, maintenance, all time, CSV, 2. Export | File generated, share sheet opens, ExportHistory logged |
| IRS report export | 1. Toggle IRS Mileage Report, 2. Export | CSV with trip data and IRS summary section |
| JSON multi-type export | 1. Select fuel + maintenance, JSON, 2. Export | JSON with both data types as keys |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Generate tax report for accountant | 1. Select trips, 2. Set year 2026, 3. Toggle IRS Mileage Report, 4. Export, 5. Share via email | CSV attached to email with trip rows, mileage totals, and deduction calculations |

---

### 3.15 CR-015: Data Import

#### 3.15.1 User Stories

**Primary:**
> As a new MyCar user switching from Drivvo, I want to import my existing fuel logs and maintenance records from a CSV file, so that I do not lose years of vehicle history when switching apps.

**Secondary:**
> As a new MyCar user switching from Fuelio, I want to import my fuel and service data from a Fuelio backup file, so that the transition is seamless and I start with a complete history.

**Tertiary:**
> As a privacy-first car enthusiast (Morgan), I want to import data from a spreadsheet I have been maintaining manually, so that I can digitize my records without re-entering everything.

#### 3.15.2 UI Requirements

##### Screen: Import Data

**Layout:**
- Top navigation bar with "Import Data" title
- Source selector: "CSV File", "Fuelio Backup", "Drivvo Export", "Generic Spreadsheet"
- Vehicle selector: Choose which vehicle to import data into, or "Create New Vehicle from Import"
- File picker button: "Select File" (opens system file picker for .csv, .json, .backup files)
- After file is selected: Preview section showing:
  - File name and size
  - Detected format and column count
  - First 5 rows as a preview table
  - Column mapping interface: for each detected column, a dropdown to map it to a MyCar field (or "Skip")
- Import options:
  - "Skip duplicates" toggle (default: on). Detects duplicate entries by date + odometer and skips them
  - "Overwrite existing" toggle (default: off). If on, duplicates overwrite existing records
- Record count estimate: "{N} records will be imported"
- "Import" button at the bottom
- Progress bar during import
- After import: summary card with imported count, skipped count, and error count

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | No file selected | Source selector and file picker button |
| File Selected | File parsed successfully | Preview table and column mapping interface |
| Parsing Error | File could not be parsed | Error message with specific guidance |
| Mapping | User is mapping columns | Column mapping dropdowns with auto-detected suggestions |
| Importing | Import in progress | Progress bar |
| Complete | Import finished | Summary card with counts |
| Partial | Some records imported, some failed | Summary with imported and error counts, option to view errors |

**Interactions:**
- Tap source selector: Highlight selected source with auto-detect column mapping presets
- Tap "Select File": Open system file picker
- Adjust column mapping dropdown: Re-map a column to a different MyCar field
- Tap "Import": Validate mappings, confirm record count, begin import
- Tap error count in summary: Show list of failed records with reasons

#### 3.15.3 Data Requirements

##### Entity: ImportHistory

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique import identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Target vehicle |
| source_format | string | Required, one of: csv, fuelio, drivvo, generic | None | Import source format |
| file_name | string | Required, max 200 chars | None | Original file name |
| total_records | integer | Required, min 0 | None | Total records in the file |
| imported_count | integer | Required, min 0 | None | Records successfully imported |
| skipped_count | integer | Required, min 0 | None | Duplicate records skipped |
| error_count | integer | Required, min 0 | None | Records that failed to import |
| column_mapping | string | Optional, JSON string | null | Column mapping used for the import |
| imported_at | string | ISO 8601, auto-set | Current timestamp | When the import was performed |

**Indexes:**
- (imported_at DESC) - Recent imports list
- (vehicle_id) - Imports per vehicle

#### 3.15.4 Business Logic

##### CSV Parsing and Auto-Detection

**Purpose:** Parse a CSV file and auto-detect column mappings.

**Logic:**
```
1. RECEIVE file contents
2. DETECT delimiter: try comma, then semicolon, then tab
3. PARSE header row
4. FOR each header column:
     ATTEMPT auto-mapping using fuzzy name matching:
       "date" / "service_date" / "fill_date" -> date field
       "odometer" / "mileage" / "odo" / "km" / "miles" -> odometer field
       "cost" / "price" / "total" / "amount" -> cost field
       "gallons" / "liters" / "fuel" / "volume" -> fuel_amount field
       "type" / "service" / "category" -> service_type field
       "station" / "shop" / "location" -> shop/station field
       "notes" / "comment" / "description" -> notes field
       "mpg" / "fuel economy" / "consumption" -> calculated_mpg field (informational, not imported)
5. PARSE first 5 data rows for preview
6. DETECT data types per column (date, number, text)
7. RETURN { headers, auto_mapping, preview_rows, detected_types }
```

##### Drivvo Import Mapping

**Purpose:** Map Drivvo-specific export format to MyCar fields.

**Logic:**
```
Drivvo CSV columns (typical):
  Date, Odometer, Fuel (L), Price/L, Total Cost, Full Tank, Station, Note

Mapping:
  Date -> entry_date (parse date format)
  Odometer -> odometer
  Fuel (L) -> fuel_amount (convert liters to gallons if user prefers gallons: gallons = liters / 3.78541)
  Price/L -> price_per_unit (convert if unit change)
  Total Cost -> total_cost
  Full Tank -> is_full_tank (map "Yes"/"1"/"true" to true)
  Station -> station_name
  Note -> notes
```

##### Fuelio Import Mapping

**Purpose:** Map Fuelio backup format to MyCar fields.

**Logic:**
```
Fuelio backup (typically CSV with specific headers):
  Date, Odo(km), Fuel(litres), Full, Price, Notes, Station

Mapping:
  Date -> entry_date
  Odo(km) -> odometer (convert km to miles if user prefers miles: miles = km / 1.60934)
  Fuel(litres) -> fuel_amount (convert to gallons if needed)
  Full -> is_full_tank
  Price -> price_per_unit
  Notes -> notes
  Station -> station_name
```

##### Duplicate Detection

**Purpose:** Identify records that already exist in the database to avoid importing them again.

**Logic:**
```
1. FOR each parsed record:
2. QUERY existing records WHERE vehicle_id = target_vehicle
     AND date = record.date
     AND odometer = record.odometer
3. IF match found AND skip_duplicates = true:
     SKIP record, increment skipped_count
4. IF match found AND overwrite_existing = true:
     UPDATE existing record with imported values
5. IF no match:
     INSERT new record
```

**Edge Cases:**
- Date format ambiguity (MM/DD/YYYY vs DD/MM/YYYY): Auto-detect based on values; if ambiguous, ask the user
- Unit conversion (km to miles, liters to gallons): Apply based on vehicle's odometer_unit and fuel_unit settings
- Missing required fields: Skip the row and count as an error
- Extremely large files (10,000+ rows): Import in batches of 500, showing progress
- Character encoding issues: Try UTF-8, then Latin-1, then ASCII fallback

#### 3.15.5 API/Integration

- No external API calls required
- File picker uses platform-native document picker
- Imported records are written to the same SQLite tables used by manual entry (FuelEntry, MaintenanceRecord, etc.)
- Import is a local-only operation; no data leaves the device

#### 3.15.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| File cannot be parsed | Alert: "This file could not be read. Ensure it is a valid CSV or supported format." | User selects a different file |
| No columns could be auto-mapped | Warning: "Could not auto-detect columns. Please map each column manually." | User maps columns via dropdowns |
| Required field missing in a row | Row skipped; error logged: "Row {N}: missing {field}" | User can view errors after import and manually add the skipped records |
| Date format ambiguous | Dialog: "Date format unclear. Is '03/04/2026' March 4 or April 3?" with MM/DD and DD/MM options | User selects the correct format |
| File too large (> 50MB) | Alert: "File is too large. Maximum import size is 50MB." | User splits the file or removes unnecessary data |
| Import partially fails | Summary: "Imported {X} records. {Y} skipped. {Z} errors." with option to view errors | User reviews errors and can re-import or manually add |
| Unit mismatch detected | Warning: "This data appears to use kilometers. Convert to miles for this vehicle?" | User confirms conversion or keeps original units |

**Validation Timing:**
- File validation: On file selection
- Column mapping: On Import tap
- Row validation: During import processing

#### 3.15.7 Performance Requirements

- File parsing completes within 2 seconds for files up to 10,000 rows
- Column auto-detection completes within 500ms
- Preview generation (first 5 rows) completes within 200ms
- Import processing: 500 records per second
- Duplicate detection per record completes within 10ms
- Total import for 5000 records completes within 15 seconds

#### 3.15.8 Accessibility

- Source selector options have accessible labels describing each format
- File picker button announces: "Select a file to import"
- Preview table is navigable by screen reader with column and row announcements
- Column mapping dropdowns announce: "Map column '{header}' to MyCar field"
- Progress bar announces: "Importing, {percentage}% complete" at 25% intervals
- Summary announces: "Import complete. {imported} records imported, {skipped} skipped, {errors} errors"
- Minimum touch target: 44x44 points

#### 3.15.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has a Drivvo CSV export with 100 fuel entries,
   **When** they select "Drivvo Export", pick the file, and tap Import,
   **Then** columns are auto-mapped, 100 fuel entries are imported into the selected vehicle, and the summary shows "100 imported, 0 skipped, 0 errors."

2. **Given** the user has a Fuelio backup with odometer in kilometers,
   **When** they import into a vehicle set to miles,
   **Then** a conversion dialog appears, and on confirmation, all odometer values are converted from km to miles.

3. **Given** a generic CSV with custom column headers,
   **When** the user manually maps columns (Date -> entry_date, Miles -> odometer, etc.),
   **Then** the import uses the user's mapping to create records.

**Edge Cases:**

4. **Given** the import file contains 10 records that match existing records by date and odometer,
   **When** "Skip duplicates" is enabled,
   **Then** the summary shows "0 imported, 10 skipped, 0 errors."

5. **Given** a CSV with date format "04/03/2026",
   **When** the date format is ambiguous,
   **Then** the app asks "Is this March 4 or April 3?" and applies the user's choice.

**Negative Tests:**

6. **Given** a file with invalid structure (not CSV, corrupted),
   **When** the user selects the file,
   **Then** an error "This file could not be read" appears and import does not proceed.

7. **Given** a CSV row missing the required odometer field,
   **When** the import processes that row,
   **Then** the row is skipped, counted as an error, and listed in the error detail view.

#### 3.15.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects comma delimiter | "date,odo,cost\n2026-01-01,30000,45" | delimiter: "," |
| detects semicolon delimiter | "date;odo;cost\n2026-01-01;30000;45" | delimiter: ";" |
| auto-maps "Odometer" header | header: "Odometer" | mapped_to: "odometer" |
| auto-maps "Fuel (L)" header | header: "Fuel (L)" | mapped_to: "fuel_amount" |
| converts km to miles | odometer_km: 50000 | odometer_mi: 31069 |
| converts liters to gallons | liters: 40 | gallons: 10.567 |
| detects duplicate record | existing: {date: "2026-01-01", odo: 30000}, import: same | duplicate detected |
| handles missing required field | row without odometer | error: "Row N: missing odometer" |
| parses ISO date format | "2026-01-15" | valid date |
| parses US date format | "01/15/2026" | valid date (MM/DD/YYYY) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Import Drivvo fuel data | 1. Select Drivvo format, 2. Pick CSV, 3. Import | FuelEntry records created with mapped fields |
| Import with duplicates | 1. Import 50 records, 2. Import same file again with skip duplicates | Second import: 0 imported, 50 skipped |
| Import with unit conversion | 1. Select file with km data, 2. Confirm conversion, 3. Import | Records saved with miles values |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Switch from Drivvo to MyCar | 1. Export from Drivvo, 2. Open MyCar import, 3. Select file, 4. Review preview, 5. Map columns, 6. Import | All historical data available in MyCar, fuel log shows imported entries, MPG calculated |

---

### 3.16 CR-016: Onboarding Flow

#### 3.16.1 User Stories

**Primary:**
> As a new MyCar user (first launch), I want a guided walkthrough that helps me add my first vehicle and understand the app's key features, so that I can start tracking immediately without confusion.

**Secondary:**
> As a user upgrading from a competing app, I want the onboarding to offer a data import option, so that I can migrate my existing records before I start using MyCar.

**Tertiary:**
> As a privacy-conscious user, I want the onboarding to clearly explain what data stays on my device and what (if anything) is sent to servers, so that I trust the app before entering my vehicle information.

#### 3.16.2 UI Requirements

##### Flow: First Launch Onboarding

**Layout:**
- 4-step paginated flow with progress indicator (dots at the bottom)
- Each step is a full-screen card with illustration, heading, body text, and a primary action button
- Users can swipe between steps or tap the "Next" button
- "Skip" option available on every step except the vehicle setup step

**Step 1: Welcome**
- Illustration: Stylized car dashboard
- Heading: "Welcome to MyCar"
- Body: "Track maintenance, fuel, expenses, and documents for all your vehicles. Everything stays on your device."
- Button: "Get Started"

**Step 2: Privacy Promise**
- Illustration: Shield/lock icon
- Heading: "Your Data Stays With You"
- Body: "MyCar stores all your data locally on this device. No accounts, no cloud sync, no tracking. Your vehicle data is never shared with insurance companies, advertisers, or anyone else. The only network call is an optional VIN lookup to the free NHTSA government database."
- Button: "Continue"

**Step 3: Add Your First Vehicle**
- Embedded version of the Add Vehicle form (CR-001) with the most essential fields:
  - Year (required)
  - Make (required)
  - Model (required)
  - Current Odometer (required)
  - VIN (optional, with "Decode VIN" button if entered)
- "Add Vehicle" button
- "I'll do this later" link at the bottom

**Step 4: Setup Complete**
- Illustration: Checkmark with car
- Heading: "You're All Set!"
- Body: "Your {year} {make} {model} is ready to track." (or "Start by adding a vehicle." if skipped)
- Feature highlights (3 small cards):
  - "Log Maintenance" with wrench icon
  - "Track Fuel" with fuel pump icon
  - "Set Reminders" with bell icon
- Optional: "Import from another app" link (navigates to CR-015 Import)
- "Go to Dashboard" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Fresh Install | App launched for the first time | Full onboarding flow |
| Returning User (no vehicle) | User previously skipped vehicle setup | Prompt to add vehicle on dashboard, no full onboarding |
| Returning User (with vehicle) | User completed onboarding | Normal app flow, no onboarding |
| Hub Module Activation | MyCar activated as a MyLife module | Abbreviated flow (skip welcome/privacy, go to vehicle setup) |

**Interactions:**
- Swipe left/right: Navigate between steps
- Tap "Skip": Jump to Step 4 (or dashboard) without completing intermediate steps
- Tap "Add Vehicle" (Step 3): Validate and save vehicle, advance to Step 4
- Tap "I'll do this later" (Step 3): Skip vehicle creation, advance to Step 4
- Tap "Go to Dashboard": Dismiss onboarding, navigate to the main dashboard, set onboarding_completed flag

#### 3.16.3 Data Requirements

##### Entity: AppSettings (relevant fields for onboarding)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| onboarding_completed | boolean | - | false | Whether the user has completed or dismissed the onboarding flow |
| first_launch_date | string | ISO 8601 date, auto-set on first launch | null | Date of first app launch |
| onboarding_vehicle_created | boolean | - | false | Whether a vehicle was created during onboarding |

**Note:** AppSettings is a singleton record (one row) in the hub_settings or cr_settings table.

#### 3.16.4 Business Logic

##### Onboarding Gate

**Purpose:** Determine whether to show the onboarding flow on app launch.

**Logic:**
```
1. ON app launch:
2. READ AppSettings.onboarding_completed
3. IF onboarding_completed = false:
     IF this is a MyLife hub module activation (not standalone):
       SHOW abbreviated onboarding (Step 3 only)
     ELSE:
       SHOW full onboarding flow (Steps 1-4)
4. ELSE:
     PROCEED to normal app flow
```

##### Vehicle Creation During Onboarding

**Purpose:** Create the first vehicle with a streamlined form.

**Logic:**
```
1. COLLECT year, make, model, odometer from onboarding form
2. VALIDATE required fields (same rules as CR-001)
3. IF VIN provided: ATTEMPT VIN decode (CR-010)
4. CREATE vehicle with is_primary = true
5. IF user accepted default maintenance schedules prompt:
     CREATE default MaintenanceSchedule entries (CR-004)
6. SET AppSettings.onboarding_vehicle_created = true
```

##### Default Maintenance Schedule Prompt

**Purpose:** After vehicle creation in onboarding, offer to set up default reminders.

**Logic:**
```
1. AFTER vehicle is saved in onboarding:
2. SHOW dialog: "Set up maintenance reminders? We'll add recommended schedules for oil changes, tire rotations, and more."
3. IF user accepts: CREATE default schedules from CR-004 preset list
4. IF user declines: Skip; user can add schedules later
```

**Edge Cases:**
- User force-closes the app during onboarding: On next launch, onboarding restarts from the beginning (onboarding_completed is still false)
- User creates a vehicle in onboarding, then force-closes before Step 4: Vehicle is saved (database commit), onboarding shows Step 4 on next launch
- Module activation in MyLife hub: Skip Steps 1-2, show abbreviated Step 3 with hub-specific styling

#### 3.16.5 API/Integration

- No external API calls required (VIN decode in Step 3 is optional and handled by CR-010)
- Onboarding state is stored locally in the AppSettings table
- Import link in Step 4 navigates to CR-015

#### 3.16.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Vehicle validation fails in Step 3 | Inline validation messages on the embedded form | User corrects fields |
| VIN decode fails during onboarding | Non-blocking: info text "Could not decode VIN. You can try again in vehicle settings." | User continues without VIN decode |
| Database error saving vehicle | Alert: "Could not save your vehicle. Please try again." | User taps "Add Vehicle" again |
| Onboarding state corrupted | App defaults to showing onboarding | User completes or skips onboarding |

**Validation Timing:**
- Vehicle fields: Same timing as CR-001 (on blur, on save)
- Onboarding state check: On every app launch

#### 3.16.7 Performance Requirements

- Onboarding check on app launch completes within 50ms
- Each onboarding step transition animates within 300ms
- Vehicle creation during onboarding completes within 500ms
- VIN decode during onboarding follows CR-010 performance (2-5s API, 50ms cache)
- "Go to Dashboard" transition completes within 300ms

#### 3.16.8 Accessibility

- Onboarding steps are navigable via screen reader with logical reading order: illustration description, heading, body, button
- Progress dots announce: "Step {N} of 4" on focus
- "Skip" link announces: "Skip onboarding and go to the dashboard"
- Embedded vehicle form follows all CR-001 accessibility requirements
- Illustrations have descriptive alt text
- Swipe gestures have button alternatives for users who cannot swipe
- Minimum touch target: 44x44 points

#### 3.16.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user launches MyCar for the first time,
   **When** they progress through all 4 onboarding steps and add a vehicle (2024 Toyota Camry, 15000 miles),
   **Then** the vehicle is created as primary, onboarding_completed is set to true, and the user sees the dashboard with their vehicle.

2. **Given** the user is on Step 3 of onboarding,
   **When** they enter a VIN and tap "Decode VIN",
   **Then** the vehicle fields auto-populate, and the user can review and adjust before saving.

3. **Given** the user completes onboarding and is prompted about default maintenance schedules,
   **When** they accept,
   **Then** 8 default maintenance schedules are created for the new vehicle.

**Edge Cases:**

4. **Given** the user taps "Skip" on Step 1,
   **When** they reach Step 4,
   **Then** Step 4 says "Start by adding a vehicle" and no vehicle exists yet.

5. **Given** MyCar is activated as a MyLife hub module,
   **When** the module opens for the first time,
   **Then** only the vehicle setup step (Step 3) is shown with hub-styled theming.

6. **Given** the user force-closes the app during Step 2,
   **When** they reopen the app,
   **Then** onboarding restarts from Step 1.

**Negative Tests:**

7. **Given** the user is on Step 3,
   **When** they tap "Add Vehicle" without filling in required fields,
   **Then** inline validation errors appear on Year, Make, Model, and Odometer.

#### 3.16.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| shows onboarding when not completed | onboarding_completed: false | show: true |
| skips onboarding when completed | onboarding_completed: true | show: false |
| shows abbreviated flow for hub module | is_hub_module: true, onboarding_completed: false | show Steps 3-4 only |
| validates required fields in onboarding form | year: null, make: "", model: "", odometer: null | Validation errors on all 4 fields |
| sets onboarding_completed after dismiss | user taps "Go to Dashboard" | onboarding_completed: true |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete full onboarding | 1. Launch fresh app, 2. Progress through 4 steps, 3. Add vehicle | Vehicle created, onboarding marked complete |
| Skip onboarding | 1. Launch fresh app, 2. Skip all steps | No vehicle, onboarding marked complete, dashboard shows add vehicle prompt |
| Onboarding with VIN decode | 1. Step 3, 2. Enter VIN, 3. Decode, 4. Save | Vehicle created with decoded specs |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user full setup | 1. First launch, 2. Complete all steps with vehicle, 3. Accept default schedules, 4. View dashboard | Dashboard shows vehicle with all stats at zero, 8 maintenance reminders active, onboarding complete |

---

### 3.17 CR-017: Settings and Preferences

#### 3.17.1 User Stories

**Primary:**
> As an everyday driver (Alex), I want to configure my preferred units (miles vs. kilometers, gallons vs. liters, currency), so that all measurements throughout the app match the units I use daily.

**Secondary:**
> As a multi-vehicle household manager (Sam), I want to manage notification preferences, so that I control which alerts I receive and how often.

**Tertiary:**
> As a privacy-first car enthusiast (Morgan), I want to see exactly what data the app stores and have the option to delete all my data, so that I remain in full control of my information.

#### 3.17.2 UI Requirements

##### Screen: Settings

**Layout:**
- Scrollable settings list grouped into sections:

**Units & Format:**
- Distance Unit: picker (Miles, Kilometers), default: Miles
- Fuel Unit: picker (Gallons, Liters), default: Gallons
- Currency: picker (USD, EUR, GBP, CAD, AUD, JPY, and 20+ common currencies), default: USD
- Date Format: picker (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD), default: MM/DD/YYYY
- Fuel Economy Display: picker (MPG, L/100km, km/L), default: MPG

**Notifications:**
- Maintenance Reminders: toggle (default: on)
- Insurance Renewal Reminders: toggle (default: on)
- Registration/Inspection Reminders: toggle (default: on)
- Parking Meter Alerts: toggle (default: on)
- Reminder Lead Time: picker (7 days, 14 days, 30 days, 60 days), default: 30 days

**Data Management:**
- Export All Data: navigates to CR-014 Export screen
- Import Data: navigates to CR-015 Import screen
- Clear All Data: destructive action with multi-step confirmation
- Storage Usage: displays total database size and photo storage

**About:**
- App Version
- Privacy Policy link (opens in-app browser or external browser)
- Open Source Licenses
- Rate the App (deep link to app store)
- Send Feedback (opens email compose)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | First launch, no changes | All settings at defaults |
| Customized | User has changed preferences | Changed settings shown with current values |

**Interactions:**
- Tap a picker setting: Open picker modal with options
- Tap a toggle: Immediately save the change
- Tap "Clear All Data": Multi-step confirmation (see Business Logic)
- Tap "Storage Usage": Show breakdown of database + photos by vehicle

#### 3.17.3 Data Requirements

##### Entity: UserPreferences

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, singleton ("default") | "default" | Single preferences record |
| distance_unit | string | Required, one of: miles, km | miles | Preferred distance unit |
| fuel_unit | string | Required, one of: gallons, liters | gallons | Preferred fuel volume unit |
| currency_code | string | Required, ISO 4217 code, max 3 chars | USD | Preferred currency |
| date_format | string | Required, one of: mdy, dmy, ymd | mdy | Date display format |
| fuel_economy_unit | string | Required, one of: mpg, l_per_100km, km_per_l | mpg | Fuel economy display |
| notify_maintenance | boolean | - | true | Enable maintenance reminders |
| notify_insurance | boolean | - | true | Enable insurance renewal reminders |
| notify_registration | boolean | - | true | Enable registration/inspection reminders |
| notify_parking | boolean | - | true | Enable parking meter alerts |
| reminder_lead_days | integer | Required, one of: 7, 14, 30, 60 | 30 | Days before due date to send first reminder |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | string | ISO 8601, auto-set | Current timestamp | Last modification time |

**Note:** This is a singleton record. Only one row exists. All reads and writes target this single record.

#### 3.17.4 Business Logic

##### Unit Conversion on Preference Change

**Purpose:** When the user changes a unit preference, all display values throughout the app update accordingly.

**Logic:**
```
1. WHEN user changes distance_unit (e.g., miles -> km or km -> miles):
     All odometer displays convert using: km = miles * 1.60934, miles = km / 1.60934
     NOTE: Stored values in the database do NOT change.
     Only display values are converted on read.
     The vehicle's odometer_unit field is the source of truth for storage.
     If display unit differs from storage unit, convert at display time.

2. WHEN user changes fuel_unit (gallons -> liters or vice versa):
     All fuel amount displays convert using: liters = gallons * 3.78541, gallons = liters / 3.78541
     Stored values remain in their original unit.

3. WHEN user changes fuel_economy_unit:
     MPG: miles / gallons
     L/100km: (gallons * 3.78541) / (miles / 1.60934) * 100
     km/L: (miles / 1.60934) / (gallons * 3.78541)
     All fuel economy displays update. Stored calculated_mpg remains in MPG.

4. WHEN user changes currency_code:
     Currency symbol updates throughout the app.
     No currency conversion is performed (values remain in the currency they were entered in).
     Only the display symbol changes.
```

##### Clear All Data Confirmation

**Purpose:** Protect against accidental data deletion with a multi-step confirmation.

**Logic:**
```
1. User taps "Clear All Data"
2. SHOW Alert 1: "Delete All Data?"
   Body: "This will permanently delete all vehicles, maintenance records, fuel logs, trips, insurance documents, and photos. This cannot be undone."
   Buttons: "Cancel" (dismiss), "Continue" (proceed)
3. IF "Continue":
   SHOW Alert 2: "Are you absolutely sure?"
   Body: "Type DELETE to confirm."
   Input field: user must type "DELETE" (case-sensitive)
   Buttons: "Cancel", "Delete Everything" (enabled only when input = "DELETE")
4. IF confirmed:
   DELETE all records from all cr_ prefixed tables
   DELETE all stored photos from app documents directory
   RESET UserPreferences to defaults
   SET onboarding_completed = false
   RETURN to onboarding flow
```

##### Storage Usage Calculation

**Purpose:** Show the user how much device storage MyCar is using.

**Logic:**
```
1. database_size = file size of the SQLite database file
2. photo_storage = SUM of file sizes for all stored photos:
     Vehicle photos + Maintenance attachment photos + Insurance card photos +
     Claim photos + Registration/Inspection document photos + Parking photos
3. total_storage = database_size + photo_storage
4. per_vehicle_breakdown: group photo_storage by vehicle_id
5. RETURN { database_size, photo_storage, total_storage, per_vehicle_breakdown }
```

**Edge Cases:**
- User changes distance unit after entering data in miles: Existing data remains in miles in the database; display converts on the fly
- Currency change does not convert existing monetary values: Only the symbol changes; historical amounts stay as entered
- Clear all data while offline: Works fine (all local); no network dependency
- Settings reset after clear: All preferences return to defaults

#### 3.17.5 API/Integration

- No external API calls required
- Settings are stored locally in a singleton database record
- Notification preference changes reschedule or cancel local notifications
- Unit preference changes affect display rendering throughout the app but do not modify stored data

#### 3.17.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Settings save fails | Toast: "Could not save settings. Please try again." | User retries; settings revert to previous value |
| Clear data fails mid-operation | Alert: "Data deletion incomplete. Some records may remain. Try again." | User retries clear all data |
| Storage calculation fails | Show "Unable to calculate" with retry button | User taps retry |
| Invalid preference value | Reset to default with toast: "Setting reset to default" | Automatic recovery |

**Validation Timing:**
- Toggle changes: Saved immediately on toggle
- Picker changes: Saved on selection
- Clear data: Multi-step confirmation before any action

#### 3.17.7 Performance Requirements

- Settings screen loads within 200ms
- Preference save completes within 100ms
- Unit conversion on preference change re-renders visible screens within 300ms
- Storage usage calculation completes within 1 second
- Clear all data completes within 5 seconds (including photo deletion)

#### 3.17.8 Accessibility

- All settings have descriptive labels: "{setting_name}: {current_value}" on focus
- Toggle switches announce state: "{setting} is on" / "{setting} is off"
- Picker options are screen-reader navigable
- "Clear All Data" button has prominent warning: "Destructive action: permanently delete all data"
- Confirmation dialog text input is accessible with label "Type DELETE to confirm"
- Storage usage values are announced with units: "Database: 2.5 megabytes, Photos: 45 megabytes"
- Minimum touch target: 44x44 points

#### 3.17.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Settings screen,
   **When** they change Distance Unit from "Miles" to "Kilometers",
   **Then** all odometer values throughout the app display in kilometers (converted from stored miles), and new entries default to km.

2. **Given** maintenance reminders are enabled,
   **When** the user toggles maintenance reminders off,
   **Then** all maintenance reminder notifications are cancelled, and the Upcoming Maintenance screen shows an info bar "Reminders are turned off. Enable in Settings."

3. **Given** the user taps Storage Usage,
   **When** the calculation completes,
   **Then** a breakdown shows database size, photo storage total, and per-vehicle photo storage.

**Edge Cases:**

4. **Given** the user has 50 records with dollar amounts and changes currency to EUR,
   **When** they view expense data,
   **Then** all amounts display with the EUR symbol but numeric values remain unchanged (no conversion).

5. **Given** the user changes fuel economy from MPG to L/100km,
   **When** they view a fuel entry with calculated_mpg of 30.0,
   **Then** the display shows 7.8 L/100km (correctly converted).

**Negative Tests:**

6. **Given** the user taps "Clear All Data" and types "delete" (lowercase),
   **When** they try to confirm,
   **Then** the "Delete Everything" button remains disabled (must type "DELETE" in uppercase).

7. **Given** the user taps "Clear All Data" and types "DELETE",
   **When** they confirm deletion,
   **Then** all data is deleted, preferences reset to defaults, and the app returns to the onboarding flow.

#### 3.17.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts miles to km for display | miles: 30000 | km: 48280 |
| converts km to miles for display | km: 50000 | miles: 31069 |
| converts MPG to L/100km | mpg: 30.0 | l_per_100km: 7.8 |
| converts MPG to km/L | mpg: 30.0 | km_per_l: 12.75 |
| converts gallons to liters | gallons: 12.5 | liters: 47.3 |
| validates DELETE confirmation | input: "delete" | invalid (case-sensitive) |
| validates DELETE confirmation | input: "DELETE" | valid |
| resets all preferences to defaults | clear_all_data | all fields at default values |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Unit change propagates to fuel log | 1. Change to liters, 2. View fuel log | Fuel amounts display in liters |
| Notification toggle cancels alerts | 1. Toggle maintenance off, 2. Check scheduled notifications | No pending maintenance notifications |
| Storage usage accurate | 1. Add vehicle with photo, 2. Check storage | Photo size reflected in per-vehicle breakdown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full data reset | 1. Have 2 vehicles with records, 2. Clear all data, 3. Confirm | App returns to onboarding, no data remains, preferences at defaults |

---

### 3.18 CR-018: Vehicle Comparison Report

#### 3.18.1 User Stories

**Primary:**
> As a multi-vehicle household manager (Sam), I want to compare the total cost of ownership, fuel economy, and maintenance frequency between my vehicles side by side, so that I can make informed decisions about which vehicles to keep and which to replace.

**Secondary:**
> As a budget-conscious owner (Riley), I want to see a clear cost-per-mile comparison across my vehicles, so that I can identify the most economical vehicle for different driving needs.

**Tertiary:**
> As a mileage tracker (Jordan), I want to compare business mileage and trip usage between vehicles, so that I can decide which vehicle to use for work and which for personal trips.

#### 3.18.2 UI Requirements

##### Screen: Vehicle Comparison

**Layout:**
- Top navigation bar with "Compare Vehicles" title
- Vehicle picker: select 2-4 vehicles to compare (multi-select checkboxes)
- Period selector: "Month", "Quarter", "Year", "All Time", "Custom Range"
- Comparison cards in a scrollable layout, each comparing a specific metric across selected vehicles:

**Comparison Categories:**

1. **Cost Summary** - Horizontal bar chart per vehicle: total expenses, broken down by fuel/maintenance/misc
2. **Cost Per Mile** - Bar chart per vehicle, with the lowest highlighted in green
3. **Fuel Economy** - Bar chart per vehicle showing average MPG (or equivalent unit)
4. **Maintenance** - Table showing service count and total maintenance cost per vehicle
5. **Mileage** - Bar chart showing total miles driven per vehicle
6. **Age & Mileage** - Table with vehicle age, total mileage, and estimated remaining value context

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Selection | Fewer than 2 vehicles selected | "Select at least 2 vehicles to compare" prompt |
| Comparison | 2-4 vehicles selected | Side-by-side comparison cards |
| Insufficient Data | One or more vehicles has no data for a metric | That vehicle shows "N/A" in the comparison with a note |
| Single Vehicle | Only 1 vehicle exists in the app | "Add another vehicle to compare" with link to Add Vehicle |

**Interactions:**
- Tap vehicle checkbox: Add/remove from comparison
- Tap a comparison card: Expand to show detailed per-vehicle breakdown
- Tap period selector: Recalculate all comparisons
- Tap "Share Report": Generate a shareable summary image or PDF

#### 3.18.3 Data Requirements

No new entities are required. This feature aggregates data from existing entities:
- Vehicle (CR-001)
- FuelEntry (CR-003)
- MaintenanceRecord (CR-002)
- MiscExpense (CR-006)
- OdometerReading (CR-005)
- TripEntry (CR-007)

#### 3.18.4 Business Logic

##### Multi-Vehicle Comparison Aggregation

**Purpose:** Generate side-by-side comparison metrics for selected vehicles.

**Logic:**
```
1. RECEIVE vehicle_ids[] (2-4), start_date, end_date
2. FOR each vehicle_id in vehicle_ids:
   a. total_fuel_cost = SUM(total_cost) FROM FuelEntry
        WHERE vehicle_id AND entry_date BETWEEN dates
   b. total_maintenance_cost = SUM(cost) FROM MaintenanceRecord
        WHERE vehicle_id AND service_date BETWEEN dates (null cost = 0)
   c. total_misc_cost = SUM(amount) FROM MiscExpense
        WHERE vehicle_id AND expense_date BETWEEN dates
   d. total_expenses = fuel + maintenance + misc
   e. average_mpg = AVG(calculated_mpg) FROM FuelEntry
        WHERE vehicle_id AND calculated_mpg IS NOT NULL AND entry_date BETWEEN dates
   f. miles_driven = mileage period calculation from CR-005
   g. cost_per_mile = total_expenses / miles_driven (if miles > 0)
   h. maintenance_count = COUNT FROM MaintenanceRecord WHERE vehicle_id AND date range
   i. trip_summary = trip purpose aggregation from CR-007
3. RETURN comparison_data[vehicle_id] = {
     total_expenses, fuel_cost, maintenance_cost, misc_cost,
     cost_per_mile, average_mpg, miles_driven,
     maintenance_count, trip_summary
   }
```

##### Winner/Highlight Logic

**Purpose:** Highlight the best-performing vehicle in each metric.

**Logic:**
```
1. FOR each metric:
   cost_per_mile: LOWEST value wins (green highlight)
   average_mpg: HIGHEST value wins
   total_expenses: LOWEST value wins
   maintenance_count: informational (no winner)
   miles_driven: informational (no winner)
2. Mark the winner vehicle for each metric
3. If values are within 5% of each other, mark as "Tie" (no highlight)
```

**Edge Cases:**
- Vehicle with no data for a metric: Show "N/A" and exclude from winner calculation
- All vehicles have the same value: Show "Tie"
- Only 1 vehicle with data, rest are N/A: That vehicle wins by default (no comparison)
- Different time periods (vehicle purchased mid-year): Prorate or note the discrepancy

#### 3.18.5 API/Integration

- No external API calls required
- Aggregates existing data across all MyCar entities
- All calculations run locally

#### 3.18.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Fewer than 2 vehicles selected | Info: "Select at least 2 vehicles to compare" | User selects more vehicles |
| One vehicle has no data | That vehicle shows "N/A" in affected metrics with note "No data for this period" | User adds data or selects different period |
| All vehicles have no data | Info: "No data available for the selected period. Try a different date range." | User changes period |
| Calculation fails | Toast: "Could not generate comparison. Please try again." | User retries |

#### 3.18.7 Performance Requirements

- Comparison data calculation completes within 500ms for 4 vehicles with up to 1000 records each
- Charts render within 400ms
- Period change recalculation completes within 500ms
- Share report generation completes within 2 seconds

#### 3.18.8 Accessibility

- Vehicle selection checkboxes announce: "{vehicle_name}, {selected/not selected}" on focus
- Comparison charts have text-based data table alternatives
- Winner highlights announce: "{vehicle_name} has the best {metric_name}" on focus
- "N/A" values announce: "No data available for {vehicle_name}" on focus
- Minimum touch target: 44x44 points

#### 3.18.9 Acceptance Criteria

**Happy Path:**

1. **Given** two vehicles with expense and fuel data for the current year,
   **When** the user selects both and views the comparison,
   **Then** side-by-side cards show total expenses, cost per mile, and average MPG for each vehicle, with the better vehicle highlighted.

2. **Given** Vehicle A has cost per mile of $0.35 and Vehicle B has $0.52,
   **When** the comparison renders,
   **Then** Vehicle A's cost per mile bar is highlighted in green as the winner.

3. **Given** 4 vehicles selected,
   **When** the user changes the period to "This Year",
   **Then** all comparison metrics recalculate for the current year only.

**Edge Cases:**

4. **Given** Vehicle A has fuel data but Vehicle B has only maintenance data,
   **When** comparing fuel economy,
   **Then** Vehicle A shows its average MPG, Vehicle B shows "N/A".

5. **Given** two vehicles with cost per mile of $0.40 and $0.41,
   **When** the comparison renders,
   **Then** the metric shows "Tie" (within 5% threshold) with no winner highlight.

**Negative Tests:**

6. **Given** only one vehicle exists,
   **When** the user tries to access Vehicle Comparison,
   **Then** a message "Add another vehicle to compare" with a link to Add Vehicle is shown.

#### 3.18.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates costs for comparison | vehicle_a: $500 total, vehicle_b: $800 total | comparison: [{total: 500}, {total: 800}] |
| determines winner (lowest cost per mile) | a: $0.35, b: $0.52 | winner: vehicle_a |
| determines tie (within 5%) | a: $0.40, b: $0.41 | result: "tie" |
| handles N/A for missing data | vehicle_a: has data, vehicle_b: no fuel data | vehicle_b fuel economy: null |
| requires at least 2 vehicles | vehicle_ids: [1] | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Compare 2 vehicles with full data | 1. Select 2 vehicles, 2. View comparison | All metrics populated for both vehicles |
| Compare with period filter | 1. Select 2 vehicles, 2. Set period to Q1 | Metrics reflect Q1 data only |
| One vehicle no data | 1. Select vehicle with data + vehicle without, 2. Compare | Data vehicle shows values, empty vehicle shows N/A |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Compare family fleet | 1. Create 3 vehicles with varied data, 2. Open comparison, 3. Select all 3, 4. View yearly | Side-by-side comparison with winners highlighted per metric, N/A for missing data points |

---

### 3.19 CR-019: Fuel Price Comparison

#### 3.19.1 User Stories

**Primary:**
> As a budget-conscious owner (Riley), I want to see how the fuel prices I pay compare to my historical average, so that I can identify whether I am paying too much and adjust my fueling habits.

**Secondary:**
> As an everyday driver (Alex), I want to see which fuel stations I frequent and their average prices, so that I can consistently choose the most affordable option near me.

**Tertiary:**
> As a mileage tracker (Jordan), I want to track fuel cost trends over time, so that I can factor fuel price changes into my business expense projections.

#### 3.19.2 UI Requirements

##### Screen: Fuel Price Analysis

**Layout:**
- Top navigation bar with "Fuel Prices" title and vehicle selector
- Average price hero card: current average price per gallon (or liter), trend arrow (up/down/flat vs. last month)
- Price trend chart: line chart showing price per unit over time (last 12 months)
- Station comparison section: ranked list of stations the user has fueled at, showing:
  - Station name
  - Number of fill-ups
  - Average price per unit
  - Last fill-up date
  - Savings vs. overall average (e.g., "Saves $0.12/gal on average")
- Price range section: lowest price paid, highest price paid, standard deviation
- Period selector: 3 months, 6 months, 1 year, All Time

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Data | No fuel entries with prices | Info: "Log fuel fill-ups with prices to see price analysis" |
| Populated | 5+ fuel entries with prices | Full analysis with chart and station comparison |
| Sparse | 1-4 entries | Basic stats shown, chart has limited data points, station comparison may have only 1 station |

**Interactions:**
- Tap a station in the list: Show all fill-ups at that station
- Tap trend chart data point: Show price and date tooltip
- Tap period selector: Recalculate all stats

#### 3.19.3 Data Requirements

No new entities are required. This feature analyzes existing FuelEntry data (CR-003), specifically the price_per_unit and station_name fields.

#### 3.19.4 Business Logic

##### Price Trend Analysis

**Purpose:** Calculate fuel price trends over time.

**Logic:**
```
1. RECEIVE vehicle_id, start_date, end_date
2. QUERY entries = FuelEntry WHERE vehicle_id
     AND entry_date BETWEEN dates
     AND price_per_unit IS NOT NULL
     ORDER BY entry_date ASC
3. current_avg = AVG(price_per_unit) for entries in the most recent month
4. previous_avg = AVG(price_per_unit) for entries in the month before
5. IF current_avg > previous_avg * 1.02:
     trend = "up"
6. ELSE IF current_avg < previous_avg * 0.98:
     trend = "down"
7. ELSE:
     trend = "flat"
8. overall_avg = AVG(price_per_unit) for all entries in period
9. lowest = MIN(price_per_unit), highest = MAX(price_per_unit)
10. std_dev = STANDARD_DEVIATION(price_per_unit)
11. RETURN { current_avg, previous_avg, trend, overall_avg, lowest, highest, std_dev }
```

##### Station Comparison

**Purpose:** Rank fuel stations by average price.

**Logic:**
```
1. RECEIVE vehicle_id, start_date, end_date
2. QUERY entries with station_name not null
3. GROUP BY station_name (case-insensitive, trimmed)
4. FOR each station:
     avg_price = AVG(price_per_unit)
     fill_up_count = COUNT
     last_visit = MAX(entry_date)
     savings_vs_avg = overall_avg - avg_price (positive = cheaper)
5. SORT by avg_price ASC (cheapest first)
6. RETURN ranked station list
```

**Edge Cases:**
- Station names vary in spelling ("Shell" vs "Shell Gas" vs "shell"): Group by case-insensitive, trimmed name; user cannot merge stations retroactively in this version
- No station_name on most entries: Station comparison shows fewer stations; info text "Add station names to your fill-ups for price comparison"
- All entries at the same station: Comparison shows only one station (no ranking)
- Price outliers (e.g., user accidentally enters $35.00 instead of $3.50): Show in data; no automatic outlier removal

#### 3.19.5 API/Integration

- No external API calls required
- Analyzes existing FuelEntry data only
- No real-time fuel price data from external sources (privacy-first approach)
- All calculations run locally

#### 3.19.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No fuel entries | Info: "Log fuel fill-ups with prices to see price analysis" | User logs fill-ups |
| No station names on entries | Info in station section: "Add station names to your fill-ups for price comparison" | User edits fuel entries to add station names |
| Only 1 entry in period | Limited stats shown with note "Log more fill-ups for trend analysis" | User logs more fill-ups |
| Calculation fails | Toast: "Could not calculate price analysis. Please try again." | User retries |

#### 3.19.7 Performance Requirements

- Price analysis screen loads within 400ms for up to 500 fuel entries
- Price trend chart renders within 300ms
- Station comparison calculates within 200ms for up to 50 unique stations
- Period change recalculates within 300ms

#### 3.19.8 Accessibility

- Trend arrow announces: "Fuel prices are {trending up / trending down / stable} compared to last month"
- Price chart has text-based data table alternative
- Station list items announce: "{station_name}, {fill_up_count} fill-ups, average ${avg_price} per gallon, saves ${savings} per gallon vs. your average"
- Price range announces: "Lowest: ${lowest}, Highest: ${highest}, Average: ${avg}"
- Minimum touch target: 44x44 points

#### 3.19.9 Acceptance Criteria

**Happy Path:**

1. **Given** 20 fuel entries across 3 stations over 6 months,
   **When** the user views Fuel Price Analysis,
   **Then** the price trend chart shows 20 data points, stations are ranked by average price, and the cheapest station shows positive savings.

2. **Given** fuel prices averaged $3.50 last month and $3.65 this month,
   **When** the user views the hero card,
   **Then** the average price shows $3.65 with an "up" trend arrow.

3. **Given** "Costco" has 10 fill-ups averaging $3.30 and "Shell" has 8 fill-ups averaging $3.55,
   **When** the station comparison loads,
   **Then** Costco appears first with savings of $0.25/gal vs. Shell (based on overall average).

**Edge Cases:**

4. **Given** all fuel entries lack station names,
   **When** the station comparison section loads,
   **Then** an info message "Add station names to your fill-ups for price comparison" appears.

5. **Given** only 2 fuel entries exist,
   **When** the user views the analysis,
   **Then** basic stats (average, min, max) are shown with a note "Log more fill-ups for trend analysis."

**Negative Tests:**

6. **Given** no fuel entries exist,
   **When** the user views Fuel Price Analysis,
   **Then** an info message "Log fuel fill-ups with prices to see price analysis" is displayed with no chart or stats.

#### 3.19.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates average price | prices: [3.40, 3.50, 3.60] | avg: 3.50 |
| determines up trend | current_avg: 3.65, previous_avg: 3.50 | trend: "up" |
| determines down trend | current_avg: 3.35, previous_avg: 3.50 | trend: "down" |
| determines flat trend | current_avg: 3.51, previous_avg: 3.50 | trend: "flat" |
| ranks stations by price | costco: 3.30, shell: 3.55 | costco ranked first |
| calculates savings vs average | station_avg: 3.30, overall_avg: 3.45 | savings: 0.15 |
| groups station names case-insensitive | "Shell", "shell", "SHELL" | 1 station group |
| calculates standard deviation | prices: [3.40, 3.50, 3.60] | std_dev: ~0.082 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Price analysis with station data | 1. Log 10 fill-ups at 2 stations, 2. View analysis | Chart shows 10 points, 2 stations ranked |
| Period filter changes analysis | 1. Log fill-ups over 6 months, 2. Switch to 3-month view | Stats recalculate for last 3 months only |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Compare fuel stations over a year | 1. Log 50 fill-ups at various stations, 2. View analysis, 3. Identify cheapest station | Station ranking visible, cheapest station highlighted with savings amount, trend chart shows seasonal patterns |

---

### 3.20 CR-020: OBD-II Diagnostic Reader

#### 3.20.1 User Stories

**Primary:**
> As a privacy-first car enthusiast (Morgan), I want to read diagnostic trouble codes (DTCs) from my car using a Bluetooth OBD-II adapter without sending the data to any cloud service, so that I can understand check engine light warnings without visiting a mechanic.

**Secondary:**
> As a budget-conscious owner (Riley), I want to see real-time engine data (RPM, coolant temperature, battery voltage) from my OBD-II adapter, so that I can monitor my vehicle's health and detect issues early.

**Tertiary:**
> As an everyday driver (Alex), I want to clear a diagnostic trouble code after I have addressed the issue, so that the check engine light turns off without a trip to the shop.

#### 3.20.2 UI Requirements

##### Screen: OBD-II Diagnostics

**Layout:**
- Top navigation bar with "Diagnostics" title and vehicle selector
- Connection status bar: "Not Connected" (red), "Connecting..." (amber), "Connected to {adapter_name}" (green)
- "Connect" button (when not connected) or "Disconnect" button (when connected)
- When connected, two tabs: "Trouble Codes" and "Live Data"

**Tab: Trouble Codes**
- "Read Codes" button
- Results list: each code card shows:
  - Code (e.g., "P0420")
  - System (e.g., "Catalyst System")
  - Description (e.g., "Catalyst System Efficiency Below Threshold - Bank 1")
  - Severity indicator: informational, warning, critical
  - Status: active, pending, historical
- "Clear Codes" button at the bottom (with confirmation dialog)
- Code history section: previously read codes with dates

**Tab: Live Data**
- Grid of real-time parameter cards (2 columns):
  - Engine RPM (gauge visualization)
  - Vehicle Speed (gauge)
  - Coolant Temperature (gauge with red zone)
  - Battery Voltage (bar)
  - Engine Load (percentage bar)
  - Fuel System Status
  - Intake Air Temperature
  - Throttle Position
- Each card updates in real time (1-2 second refresh)
- "Record Session" toggle to log live data for later review

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Adapter | Bluetooth off or no adapter nearby | Info: "Turn on Bluetooth and plug in your OBD-II adapter" with setup instructions link |
| Scanning | Searching for adapters | Spinner with "Searching for OBD-II adapters..." |
| Adapter Found | Adapter detected but not yet connected | Adapter name shown with "Connect" button |
| Connected | Successfully communicating with vehicle | Green status bar, tabs enabled |
| Reading Codes | DTC scan in progress | Spinner with "Reading diagnostic codes..." |
| No Codes | Scan complete, zero DTCs | Green checkmark, "No trouble codes found" |
| Codes Found | Scan complete, 1+ DTCs | List of code cards |
| Connection Lost | Adapter disconnected during use | Amber alert: "Connection lost. Check your adapter and try reconnecting." |

**Interactions:**
- Tap "Connect": Initiate Bluetooth pairing/connection to OBD-II adapter
- Tap "Read Codes": Send DTC read command to adapter
- Tap a code card: Expand to show full description, possible causes, and estimated repair cost range
- Tap "Clear Codes": Confirmation dialog, then send clear command to adapter
- Tap "Record Session" toggle: Begin/stop recording live data to local storage
- Tap a live data card: Show chart of that parameter over time (if recording)

#### 3.20.3 Data Requirements

##### Entity: DiagnosticScan

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique scan identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| scan_date | string | Required, ISO 8601 datetime | Current datetime | When the scan was performed |
| adapter_name | string | Optional, max 50 chars | null | Name of the OBD-II adapter used |
| code_count | integer | Required, min 0 | 0 | Number of DTCs found |
| odometer | integer | Optional, min 0 | null | Odometer at time of scan |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

##### Entity: DiagnosticCode

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique code identifier |
| scan_id | string | Required, references DiagnosticScan.id | None | Associated scan |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| code | string | Required, max 10 chars | None | DTC code (e.g., "P0420") |
| system | string | Optional, max 100 chars | null | Affected system name |
| description | string | Optional, max 500 chars | null | Human-readable description |
| severity | string | Optional, one of: informational, warning, critical | null | How serious the code is |
| status | string | Required, one of: active, pending, historical | active | Current code status |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

##### Entity: LiveDataSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique session identifier |
| vehicle_id | string | Required, references Vehicle.id | None | Associated vehicle |
| start_time | string | Required, ISO 8601 datetime | Current datetime | Session start |
| end_time | string | Optional, ISO 8601 datetime | null | Session end |
| data_points | string | Required, JSON array | "[]" | Array of timestamped parameter snapshots |
| created_at | string | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- DiagnosticScan belongs to Vehicle (many-to-one)
- DiagnosticScan has many DiagnosticCode (one-to-many)
- LiveDataSession belongs to Vehicle (many-to-one)

**Indexes:**
- (vehicle_id, scan_date DESC) - Recent scans per vehicle
- (code) - Lookup by DTC code
- (vehicle_id, status) - Active codes per vehicle

#### 3.20.4 Business Logic

##### DTC Code Database

**Purpose:** Provide human-readable descriptions for OBD-II diagnostic codes.

**Logic:**
```
1. App includes a bundled DTC database (JSON file) covering common codes:
   P0xxx - Powertrain (generic): ~500 most common codes
   P1xxx - Powertrain (manufacturer-specific): top 200
   B0xxx - Body codes: top 100
   C0xxx - Chassis codes: top 100
   U0xxx - Network codes: top 100

2. RECEIVE code (e.g., "P0420")
3. LOOKUP in bundled database
4. IF found: RETURN { system, description, severity, common_causes, estimated_cost_range }
5. IF not found: RETURN { system: "Unknown", description: "Code not in database. Consult a mechanic.", severity: null }
```

##### Bluetooth OBD-II Communication Protocol

**Purpose:** Communicate with the vehicle's OBD-II port via a Bluetooth adapter.

**Logic:**
```
1. SCAN for Bluetooth devices matching OBD-II adapter profiles (ELM327 compatible)
2. CONNECT to selected adapter
3. INITIALIZE communication:
     Send "ATZ" (reset adapter)
     Send "ATE0" (echo off)
     Send "ATL0" (linefeeds off)
     Send "ATS0" (spaces off)
     Send "ATSP0" (auto-detect protocol)
4. VERIFY connection:
     Send "0100" (check supported PIDs)
     IF response is valid: connection confirmed
     ELSE: connection failed
5. FOR DTC reading:
     Send "03" (request stored DTCs)
     PARSE response into individual codes
     LOOKUP each code in DTC database
6. FOR live data:
     Send PID requests in loop:
       "010C" (RPM), "010D" (Speed), "0105" (Coolant Temp),
       "0142" (Battery Voltage), "0104" (Engine Load),
       "0103" (Fuel System Status), "010F" (Intake Air Temp),
       "0111" (Throttle Position)
     PARSE responses, convert raw values to human-readable units
     UPDATE UI at 1-2 second intervals
7. FOR code clearing:
     Send "04" (clear DTCs and freeze frame data)
     Wait for confirmation response
```

##### Live Data Value Conversion

**Purpose:** Convert raw OBD-II PID response bytes to human-readable values.

**Logic:**
```
RPM: ((A * 256) + B) / 4 (A, B are response bytes)
Speed: A (km/h), convert to mph if user prefers: mph = km/h / 1.60934
Coolant Temperature: A - 40 (degrees Celsius), convert to F if preferred: F = C * 9/5 + 32
Battery Voltage: ((A * 256) + B) / 1000 (volts)
Engine Load: A * 100 / 255 (percentage)
Intake Air Temperature: A - 40 (degrees Celsius)
Throttle Position: A * 100 / 255 (percentage)
```

**Edge Cases:**
- Adapter not ELM327 compatible: Show "Unsupported adapter. MyCar works with ELM327-compatible OBD-II adapters."
- Vehicle does not support all PIDs: Show supported parameters only; unsupported show "N/A"
- Connection drops during live data: Pause updates, show "Connection lost" banner, attempt auto-reconnect 3 times
- Electric vehicles: Many standard PIDs are not applicable; show supported EV-specific PIDs if available
- Clearing codes while engine is running: Warn "For best results, turn off the engine before clearing codes."
- DTC database does not have a code: Show the raw code with "Unknown" description

#### 3.20.5 API/Integration

- **Bluetooth:** Requires Bluetooth permission and hardware support
- **OBD-II Protocol:** Communicates using ELM327 AT commands over Bluetooth Serial Port Profile (SPP) or Bluetooth Low Energy (BLE)
- **DTC Database:** Bundled offline as a JSON file (approximately 1000 common codes, ~500KB)
- No network calls required for diagnostics
- All diagnostic data stored locally on-device

#### 3.20.6 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Bluetooth off | Info: "Turn on Bluetooth to connect to your OBD-II adapter" with button to open Bluetooth settings | User enables Bluetooth |
| Bluetooth permission denied | Alert: "Bluetooth access is needed for OBD-II diagnostics. Enable in Settings." | User grants permission |
| No adapter found | Info: "No OBD-II adapter found. Make sure your adapter is plugged in and powered on." | User checks adapter |
| Unsupported adapter | Alert: "This adapter is not compatible. MyCar works with ELM327-compatible adapters." | User uses compatible adapter |
| Connection lost during use | Amber banner: "Connection lost. Reconnecting..." (auto-retry 3 times) | Auto-reconnect or manual retry |
| Vehicle does not respond | Alert: "Vehicle is not responding. Ensure the engine is on and the adapter is properly connected." | User checks connections |
| Clear codes fails | Alert: "Could not clear codes. Try turning the engine off and on, then retry." | User retries |
| Unknown DTC code | Code card shows code with "Unknown code. Consult a mechanic or search online for {code}." | Informational |

#### 3.20.7 Performance Requirements

- Bluetooth scan completes within 10 seconds
- Adapter connection establishes within 5 seconds
- DTC read and parse completes within 3 seconds for up to 20 codes
- Live data refresh rate: 1-2 updates per second per parameter
- DTC database lookup completes within 10ms per code
- Code clearing completes within 2 seconds
- Live data session recording writes within 100ms per data point

#### 3.20.8 Accessibility

- Connection status announces: "OBD-II adapter: {not connected / connecting / connected to {name}}" on focus
- Trouble code cards announce: "Code {code}: {description}, severity: {severity}, status: {status}" on focus
- Live data gauges have text alternatives: "{parameter}: {value} {unit}" announced on focus and on value change
- "Clear Codes" button has warning: "Clear all diagnostic trouble codes from the vehicle"
- Scanning state announces: "Searching for OBD-II adapters"
- Minimum touch target: 44x44 points

#### 3.20.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has a Bluetooth ELM327 adapter plugged into their vehicle's OBD-II port,
   **When** they tap "Connect" and select the adapter,
   **Then** the connection establishes, the status bar turns green, and the tabs become active.

2. **Given** a connected OBD-II adapter and a vehicle with an active P0420 code,
   **When** the user taps "Read Codes",
   **Then** one code card appears showing "P0420 - Catalyst System Efficiency Below Threshold" with severity "warning."

3. **Given** a connected adapter on the Live Data tab,
   **When** the engine is running,
   **Then** RPM, speed, coolant temperature, and other supported parameters update in real time every 1-2 seconds.

4. **Given** a code has been read and the user has fixed the issue,
   **When** they tap "Clear Codes" and confirm,
   **Then** the adapter sends the clear command, codes are removed, and a confirmation "Codes cleared successfully" appears.

**Edge Cases:**

5. **Given** the vehicle does not support the coolant temperature PID,
   **When** live data is displayed,
   **Then** the coolant temperature card shows "Not Supported" and other parameters display normally.

6. **Given** the Bluetooth connection drops mid-scan,
   **When** the connection is lost,
   **Then** an amber banner appears, auto-reconnect is attempted up to 3 times, and partial results (if any) are preserved.

**Negative Tests:**

7. **Given** Bluetooth is turned off,
   **When** the user opens the Diagnostics screen,
   **Then** an info card says "Turn on Bluetooth to connect to your OBD-II adapter."

8. **Given** no adapter is found within 10 seconds of scanning,
   **When** the scan times out,
   **Then** the info says "No OBD-II adapter found" with troubleshooting suggestions.

#### 3.20.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses RPM from raw bytes | A: 0x1A, B: 0xF8 | RPM: 1726 |
| parses coolant temp from raw byte | A: 0x6E | temp_c: 70, temp_f: 158 |
| parses speed from raw byte | A: 0x60 | speed_kmh: 96, speed_mph: 59.7 |
| parses battery voltage | A: 0x30, B: 0xD4 | voltage: 12.5 |
| looks up known DTC code | code: "P0420" | description: "Catalyst System Efficiency Below Threshold" |
| returns unknown for unlisted code | code: "P9999" | description: "Unknown code" |
| parses multiple DTCs from response | response: "43 01 04 20 02 01 01" | codes: ["P0420", "P0101"] |
| validates ELM327 reset response | response: "ELM327 v1.5" | valid: true |
| handles empty DTC response | response: "43 00" | codes: [] (no codes) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full scan with mock adapter | 1. Connect to mock Bluetooth, 2. Read codes, 3. View results | Codes displayed with descriptions from bundled database |
| Live data recording | 1. Connect, 2. Start recording, 3. Wait 30 seconds, 4. Stop | LiveDataSession saved with ~15-30 data points |
| Clear codes flow | 1. Read codes (2 found), 2. Clear codes, 3. Read again | Zero codes on second read |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Diagnose check engine light | 1. Connect adapter, 2. Read codes (P0420 found), 3. View description and causes, 4. Fix issue, 5. Clear code, 6. Re-read (0 codes) | Diagnostic history shows the scan with P0420, cleared status, and re-scan with 0 codes |

---

## 4. Data Architecture

### 4.1 Entity Relationship Summary

The MyCar data model centers on the Vehicle entity, which serves as the parent for all other records. Every data entity (except ParkingLocation, which is optionally associated) references a vehicle_id foreign key.

**Core Entities:**

| Entity | Table Name | Parent | Description |
|--------|-----------|--------|-------------|
| Vehicle | cr_vehicles | None | Central entity; all data hangs off a vehicle |
| MaintenanceRecord | cr_maintenance_records | Vehicle | Service history entries |
| MaintenancePart | cr_maintenance_parts | MaintenanceRecord | Parts replaced during service |
| MaintenanceAttachment | cr_maintenance_attachments | MaintenanceRecord | Receipt/service photos |
| MaintenanceSchedule | cr_maintenance_schedules | Vehicle | Recurring service reminders |
| FuelEntry | cr_fuel_entries | Vehicle | Fill-up records |
| OdometerReading | cr_odometer_readings | Vehicle | Aggregated odometer history |
| MiscExpense | cr_misc_expenses | Vehicle | Non-fuel, non-maintenance costs |
| TripEntry | cr_trip_entries | Vehicle | Business/personal trip log |
| InsurancePolicy | cr_insurance_policies | Vehicle | Insurance policy records |
| InsuranceCoverage | cr_insurance_coverages | InsurancePolicy | Coverage type/limit details |
| InsuranceClaim | cr_insurance_claims | InsurancePolicy + Vehicle | Claim records |
| ClaimPhoto | cr_claim_photos | InsuranceClaim | Claim documentation photos |
| VehicleRegistration | cr_vehicle_registrations | Vehicle | Registration records |
| VehicleInspection | cr_vehicle_inspections | Vehicle | Inspection records |
| VinDecodeCache | cr_vin_decode_cache | None | Cached VIN decode results |
| ParkingLocation | cr_parking_locations | Vehicle (optional) | Saved parking spots |
| RecallCheck | cr_recall_checks | Vehicle | Recall check history |
| RecallEntry | cr_recall_entries | RecallCheck + Vehicle | Individual recall records |
| TireSet | cr_tire_sets | Vehicle | Tire set details |
| TireRotation | cr_tire_rotations | TireSet + Vehicle | Rotation history |
| DiagnosticScan | cr_diagnostic_scans | Vehicle | OBD-II scan history |
| DiagnosticCode | cr_diagnostic_codes | DiagnosticScan + Vehicle | Individual DTCs |
| LiveDataSession | cr_live_data_sessions | Vehicle | Recorded OBD-II live data |
| UserPreferences | cr_user_preferences | None | Singleton settings record |
| ExportHistory | cr_export_history | None | Export audit log |
| ImportHistory | cr_import_history | Vehicle | Import audit log |

### 4.2 Table Prefix Convention

All MyCar tables use the `cr_` prefix, following the MyLife hub convention for module-specific table isolation within the shared SQLite database.

### 4.3 Migration Strategy

Migrations are versioned and ordered. Each feature's tables are created in a dedicated migration file. Migration files follow the pattern:

```
001_create_vehicles.sql
002_create_maintenance_records.sql
003_create_maintenance_parts.sql
004_create_maintenance_attachments.sql
005_create_maintenance_schedules.sql
006_create_fuel_entries.sql
007_create_odometer_readings.sql
008_create_misc_expenses.sql
009_create_trip_entries.sql
010_create_insurance_policies.sql
011_create_insurance_coverages.sql
012_create_insurance_claims.sql
013_create_claim_photos.sql
014_create_vehicle_registrations.sql
015_create_vehicle_inspections.sql
016_create_vin_decode_cache.sql
017_create_parking_locations.sql
018_create_recall_checks.sql
019_create_recall_entries.sql
020_create_tire_sets.sql
021_create_tire_rotations.sql
022_create_diagnostic_scans.sql
023_create_diagnostic_codes.sql
024_create_live_data_sessions.sql
025_create_user_preferences.sql
026_create_export_history.sql
027_create_import_history.sql
```

Each migration is idempotent (uses CREATE TABLE IF NOT EXISTS). Migrations run in order on first launch and on app updates that introduce new tables.

### 4.4 Data Deletion Cascade

When a vehicle is deleted, all associated records are cascade-deleted:
- All MaintenanceRecord, MaintenancePart, MaintenanceAttachment for that vehicle
- All MaintenanceSchedule for that vehicle
- All FuelEntry for that vehicle
- All OdometerReading for that vehicle
- All MiscExpense for that vehicle
- All TripEntry for that vehicle
- All InsurancePolicy, InsuranceCoverage, InsuranceClaim, ClaimPhoto for that vehicle
- All VehicleRegistration, VehicleInspection for that vehicle
- All ParkingLocation for that vehicle
- All RecallCheck, RecallEntry for that vehicle
- All TireSet, TireRotation for that vehicle
- All DiagnosticScan, DiagnosticCode, LiveDataSession for that vehicle
- All associated photo files are deleted from the device filesystem

VinDecodeCache is NOT cascade-deleted (cache is vehicle-independent).

### 4.5 Photo Storage Strategy

All photos (vehicle, maintenance, insurance, claims, registration, inspection, parking) are stored as compressed local files in the app's documents directory. Storage rules:
- Maximum file size per photo: 1MB (compressed on capture/selection)
- Storage directory structure: `MyCar/photos/{vehicle_id}/{category}/{filename}`
- Categories: vehicle, maintenance, insurance, claims, registration, inspection, parking
- Photo URIs stored in database fields reference local file paths
- When a record or vehicle is deleted, associated photo files are also deleted
- Total photo storage is displayed in Settings (CR-017)

---

## 5. Screen Map

### 5.1 Navigation Structure

```
MyCar (Tab Bar / Sidebar)
├── Dashboard (home)
│   ├── Vehicle List
│   │   ├── Add/Edit Vehicle
│   │   └── Vehicle Detail
│   │       ├── Info Tab
│   │       ├── Maintenance Tab -> Maintenance Log
│   │       ├── Fuel Tab -> Fuel Log
│   │       └── Documents Tab -> Insurance Overview
│   └── Quick Stats (per-vehicle summary cards)
├── Maintenance
│   ├── Maintenance Log
│   │   ├── Add/Edit Maintenance
│   │   └── Maintenance Detail
│   ├── Upcoming Maintenance (Reminders)
│   │   ├── Reminder Detail Modal
│   │   └── Add/Edit Reminder Schedule
│   └── Tire Overview
│       ├── Add/Edit Tire Set
│       └── Log Tire Rotation Modal
├── Fuel
│   ├── Fuel Log
│   │   ├── Add/Edit Fuel Entry
│   │   └── Fuel Detail
│   └── Fuel Economy Trend
│       └── Fuel Price Analysis
├── Trips
│   ├── Trip Log
│   │   ├── Add/Edit Trip
│   │   └── Trip Detail
│   └── IRS Deduction Summary
├── Expenses
│   ├── Expense Overview (Dashboard)
│   │   └── Category Detail (filtered list)
│   ├── Add/Edit Miscellaneous Expense
│   └── Vehicle Comparison Report
├── Documents
│   ├── Insurance Overview
│   │   ├── Add/Edit Insurance Policy
│   │   ├── Add/Edit Claim
│   │   └── Claim Detail
│   ├── Registration & Inspection
│   │   ├── Add/Edit Registration
│   │   └── Add/Edit Inspection
│   └── Recall Check
├── Mileage
│   ├── Mileage Dashboard
│   │   └── Manual Odometer Entry Modal
│   └── Period Breakdown
├── More
│   ├── Parking Location Saver
│   │   └── Set Meter Timer Modal
│   ├── OBD-II Diagnostics
│   │   ├── Trouble Codes Tab
│   │   └── Live Data Tab
│   ├── Export Data
│   ├── Import Data
│   ├── Settings & Preferences
│   └── About
└── Onboarding Flow (first launch only)
    ├── Step 1: Welcome
    ├── Step 2: Privacy Promise
    ├── Step 3: Add First Vehicle
    └── Step 4: Setup Complete
```

### 5.2 Screen Count Summary

| Category | Screens | Modals |
|----------|---------|--------|
| Dashboard & Vehicles | 3 | 0 |
| Maintenance & Tires | 5 | 3 |
| Fuel | 4 | 0 |
| Trips | 3 | 0 |
| Expenses | 3 | 0 |
| Documents & Recalls | 7 | 0 |
| Mileage | 2 | 1 |
| Parking | 1 | 1 |
| OBD-II Diagnostics | 1 (2 tabs) | 0 |
| Data Management | 2 | 0 |
| Settings | 2 | 0 |
| Onboarding | 4 | 0 |
| **Total** | **37** | **5** |

---

## 6. Cross-Feature Dependencies

### 6.1 Dependency Graph

```
CR-001 Vehicle Profiles
  ├── CR-002 Maintenance Tracking
  │     └── CR-004 Smart Maintenance Reminders
  │     └── CR-013 Tire Tracking
  ├── CR-003 Fuel Logging
  │     └── CR-019 Fuel Price Comparison
  ├── CR-005 Mileage Tracking
  │     └── CR-007 Trip Logging
  ├── CR-006 Expense Dashboard (depends on CR-002, CR-003, CR-005)
  │     └── CR-018 Vehicle Comparison Report
  ├── CR-008 Insurance Document Storage
  ├── CR-009 Registration & Inspection Tracker
  ├── CR-010 VIN Decoder
  │     └── CR-012 Recall Alerts
  ├── CR-011 Parking Location Saver (no vehicle dependency)
  ├── CR-014 Data Export (depends on all data entities)
  ├── CR-015 Data Import
  ├── CR-020 OBD-II Diagnostic Reader
  └── CR-017 Settings & Preferences (global, no vehicle dependency)

CR-016 Onboarding Flow (depends on CR-001, optionally CR-004, CR-010)
```

### 6.2 Implementation Order (Recommended)

**Phase 1 (MVP):** CR-001, CR-002, CR-003, CR-004, CR-016, CR-017
**Phase 2 (Core):** CR-005, CR-006, CR-007, CR-008, CR-009, CR-014
**Phase 3 (Enrichment):** CR-010, CR-011, CR-012, CR-013, CR-015, CR-018, CR-019
**Phase 4 (Advanced):** CR-020

### 6.3 Cross-Module Integration Points

| Source Feature | Target Feature | Integration Point |
|---------------|---------------|-------------------|
| CR-002 Maintenance | CR-004 Reminders | Logging maintenance auto-updates schedule |
| CR-002 Maintenance | CR-005 Mileage | Maintenance odometer creates OdometerReading |
| CR-003 Fuel | CR-005 Mileage | Fuel entry odometer creates OdometerReading |
| CR-003 Fuel | CR-006 Expenses | Fuel costs aggregate into expense dashboard |
| CR-002 Maintenance | CR-006 Expenses | Maintenance costs aggregate into expense dashboard |
| CR-008 Insurance | CR-006 Expenses | Insurance premiums aggregate into expense dashboard |
| CR-009 Registration | CR-006 Expenses | Registration fees aggregate into expense dashboard |
| CR-007 Trips | CR-005 Mileage | Trip odometer readings create OdometerReadings |
| CR-010 VIN | CR-001 Vehicles | VIN decode auto-fills vehicle fields |
| CR-013 Tires | CR-004 Reminders | Tire rotation links to maintenance schedule |
| CR-001 Vehicles | CR-012 Recalls | Vehicle make/model/year used for recall lookup |
| All data features | CR-014 Export | All entities exportable |
| CR-003 Fuel (import) | CR-015 Import | Fuel data importable from Drivvo/Fuelio |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| App launch to interactive dashboard | < 1.5 seconds (cold start) | Timer from app icon tap to rendered dashboard |
| Screen transitions | < 300ms | Timer from navigation action to rendered target screen |
| Database query (simple lookup) | < 100ms | Timer from query invocation to result |
| Database query (aggregation, 1000+ records) | < 500ms | Timer from query invocation to result |
| Photo loading (thumbnail) | < 200ms | Timer from screen render to visible thumbnail |
| Photo loading (full-screen) | < 500ms | Timer from tap to rendered full-screen image |
| Chart rendering | < 500ms | Timer from data availability to rendered chart |
| Background notification scheduling | < 500ms | Timer from trigger to scheduled notification |

### 7.2 Storage

| Resource | Budget |
|----------|--------|
| App binary (excluding photos) | < 50MB |
| Bundled DTC database | < 500KB |
| SQLite database per vehicle (1 year of data) | < 5MB |
| Photo storage per vehicle | User-managed; displayed in Settings |
| Total storage footprint (no photos) | < 60MB |

### 7.3 Reliability

- Database writes use transactions; partial writes are rolled back
- Photo storage failures do not block record creation (photo field is nullable)
- App recovers gracefully from crashes (all state is persisted in SQLite)
- Onboarding state is checkpointed; partial completion survives crashes
- OBD-II connection loss is handled with auto-reconnect (up to 3 attempts)

### 7.4 Security

- All data stored locally in the app's sandboxed storage
- No authentication required for core functionality
- Photos are stored in the app's private documents directory (not accessible to other apps)
- VIN is the only data sent to an external service (NHTSA), and it is never paired with user identity
- No analytics SDKs, no crash reporting SDKs, no advertising identifiers
- Export files are written to the app's temp directory and shared via the system share sheet

### 7.5 Compatibility

- iOS: 16.0+
- Android: API level 26+ (Android 8.0+)
- Web: Modern browsers (Chrome 90+, Safari 15+, Firefox 90+, Edge 90+)
- OBD-II: ELM327-compatible Bluetooth adapters (SPP and BLE)

### 7.6 Localization

- Initial release: English only
- Currency: 20+ currencies supported via ISO 4217 codes (display symbol only, no conversion)
- Units: Miles/km, Gallons/liters, MPG/L per 100km/km per L
- Date formats: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
- Future: Full i18n framework for multi-language support

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| **AWD** | All-Wheel Drive; power delivered to all four wheels continuously |
| **BLE** | Bluetooth Low Energy; a low-power wireless communication standard |
| **CVT** | Continuously Variable Transmission; a transmission with infinite gear ratios |
| **DCT** | Dual-Clutch Transmission; an automated manual transmission with two clutches |
| **DTC** | Diagnostic Trouble Code; a standardized code indicating a vehicle malfunction |
| **ELM327** | A microcontroller chip used in OBD-II diagnostic adapters for Bluetooth/WiFi/USB communication |
| **FWD** | Front-Wheel Drive; power delivered to the front wheels only |
| **IRS** | Internal Revenue Service; the US tax authority. Publishes standard mileage rates for tax deductions |
| **MPG** | Miles Per Gallon; a measure of fuel efficiency |
| **NHTSA** | National Highway Traffic Safety Administration; the US federal agency for vehicle safety |
| **OBD-II** | On-Board Diagnostics version 2; a standardized vehicle self-diagnostic and reporting system required on all US vehicles since 1996 |
| **PID** | Parameter Identification; standardized codes used to request data from a vehicle's OBD-II system |
| **RWD** | Rear-Wheel Drive; power delivered to the rear wheels only |
| **SPP** | Serial Port Profile; a Bluetooth profile for serial communication |
| **VIN** | Vehicle Identification Number; a unique 17-character code assigned to every vehicle manufactured since 1981 |
| **4WD** | Four-Wheel Drive; a drivetrain system with a transfer case that can engage/disengage all-wheel power |
| **L/100km** | Liters per 100 kilometers; a fuel economy metric common outside the US (lower is better) |
| **km/L** | Kilometers per liter; a fuel economy metric (higher is better) |
| **Check digit** | The 9th character of a VIN, calculated using a weighted algorithm to detect transcription errors |
| **Tank-to-tank method** | Fuel economy calculation using the distance driven and fuel consumed between two consecutive full fill-ups |
| **Cost per mile** | Total vehicle expenses divided by total miles driven; a measure of true ownership cost |
| **Cascade delete** | Automatic deletion of all child records when a parent record is deleted |
| **Singleton** | A database pattern where only one row of a specific entity type exists |

---

## Reconciliation Note (2026-03-07)

**Spec features:** 20 (CR-001 through CR-020)
**Catalog navigation (constants.ts):** 4 tabs (dashboard, maintenance, fuel, settings) + 3 screens (vehicle-detail, add-record, service-history)

The catalog defines module-level navigation structure only, not individual features. The 20 spec features will need to map to the catalog's tab/screen structure during implementation. Notable gaps: the catalog lacks dedicated tabs or screens for trips (CR-007), documents (CR-008), registration tracking (CR-009), parking saver (CR-011), tire tracking (CR-013), and the expense dashboard (CR-006). These will need screen entries added to the catalog when implemented.
