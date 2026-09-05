# MyGarden - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (spec-mygarden agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyGarden
- **Tagline:** Grow smarter, harvest more
- **Module ID:** `garden`
- **Feature ID Prefix:** `GD`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Indoor Plant Parent | Ages 22-40, keeps 5-30 houseplants, moderate tech comfort | Track watering schedules, monitor plant health, prevent overwatering/underwatering |
| Backyard Gardener | Ages 30-60, maintains a vegetable/herb/flower garden, moderate tech comfort | Plan planting by zone, track harvests, manage pest issues, know when to fertilize |
| Apartment Balcony Grower | Ages 20-35, limited space, container gardens, high tech comfort | Maximize small-space yields, track light conditions, companion planting in containers |
| Seed Starter | Ages 25-50, starts plants from seed indoors, moderate tech comfort | Track seed inventory, germination rates, transplant timing by frost dates |
| Privacy-Conscious Gardener | Any age, concerned about photo EXIF data and location tracking | Full data ownership, no cloud photo uploads, no GPS harvesting from plant photos |

### 1.3 Core Value Proposition

MyGarden is a privacy-first garden management app that tracks every aspect of the growing lifecycle: plant catalog with species care info, smart watering reminders that adjust for seasons, growth photo journals, garden bed mapping, USDA zone-aware planting calendars, companion planting guidance, harvest tracking, pest and disease logging, fertilizer scheduling, seed inventory, and garden health analytics. Unlike Planta and PictureThis, MyGarden keeps all plant photos and garden data entirely on-device. No cloud account, no EXIF location harvesting, no photo library scanning. Your garden layout, your harvest yields, and your growing habits are nobody's business but yours.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Planta | Polished UI, smart watering engine, room-based organization | $36/yr subscription, cloud-required, collects photo EXIF data | Free tier available, offline-first, zero photo data collection |
| PictureThis | AI plant identification, disease diagnosis from photos | $30-40/yr subscription, all photos uploaded to cloud servers, GPS harvested from EXIF | On-device only, no photo uploads, no GPS tracking |
| Gardenize | Good plant logging, garden journal | Subscription model, cloud-dependent, limited analytics | Offline-first, richer analytics (survival rate, health scoring), no subscription |
| Planter | Companion planting matrix, garden bed layout | Web-only, limited mobile experience, no watering reminders | Full mobile + web, smart watering, photo journals |
| Veggie Garden Planner | USDA zone support, crop rotation tracking | Desktop-focused, dated UI, subscription required | Modern cross-platform UI, on-device storage, one-time purchase |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All plant data, garden photos, care logs, and layout designs are stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for any functionality
- Users own their data with full export (CSV, JSON) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export or share action
- Plant photos are stored on-device only; EXIF metadata (including GPS coordinates) is never transmitted to any server
- USDA zone lookup uses a bundled zone dataset with no network calls
- Companion planting matrix and species care database are bundled locally
- Frost date calculations use a bundled historical frost date dataset by zone; no weather API calls in v1
- No AI identification in v1; future on-device ML identification would use platform-native APIs (Core ML, NNAPI) with no external transmission

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| GD-001 | Plant Catalog | P0 | Core | None | Not Started |
| GD-002 | Smart Watering Reminders | P0 | Core | GD-001 | Not Started |
| GD-003 | Growth Photo Journal | P0 | Core | GD-001 | Not Started |
| GD-004 | Garden Bed Mapping | P0 | Core | GD-001 | Not Started |
| GD-005 | Planting Calendar by USDA Zone | P0 | Core | GD-001 | Not Started |
| GD-006 | Care Schedule | P0 | Core | GD-001 | Not Started |
| GD-007 | Companion Planting Matrix | P1 | Core | GD-001 | Not Started |
| GD-008 | Harvest Tracking | P1 | Core | GD-001 | Not Started |
| GD-009 | Pest and Disease Log | P1 | Core | GD-001 | Not Started |
| GD-010 | Fertilizer Schedule | P1 | Core | GD-001, GD-006 | Not Started |
| GD-011 | Seed Inventory | P1 | Data Management | GD-001 | Not Started |
| GD-012 | Garden Statistics | P1 | Analytics | GD-001, GD-008 | Not Started |
| GD-013 | Frost Alerts | P1 | Core | GD-005 | Not Started |
| GD-014 | Plant Health Scoring | P1 | Analytics | GD-001, GD-009 | Not Started |
| GD-015 | Plant Wish List | P1 | Data Management | None | Not Started |
| GD-016 | Room and Zone Organization | P1 | Data Management | GD-001 | Not Started |
| GD-017 | Seasonal Care Adjustments | P1 | Core | GD-002, GD-006 | Not Started |
| GD-018 | Plant Care Database | P0 | Core | None | Not Started |
| GD-019 | Search and Filtering | P0 | Data Management | GD-001 | Not Started |
| GD-020 | Propagation Tracking | P2 | Core | GD-001 | Not Started |
| GD-021 | Monthly Care Summary | P2 | Analytics | GD-006, GD-012 | Not Started |
| GD-022 | Data Export | P1 | Import/Export | GD-001 | Not Started |
| GD-023 | Data Import | P2 | Import/Export | GD-001 | Not Started |
| GD-024 | Settings and Preferences | P0 | Settings | None | Not Started |
| GD-025 | Onboarding and First-Run | P1 | Onboarding | GD-001, GD-018 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

**Category Legend:**
- **Core** - Fundamental product functionality
- **Data Management** - CRUD operations, organization, search
- **Analytics** - Stats, reports, insights, visualizations
- **Import/Export** - Data portability (import from competitors, export user data)
- **Settings** - User preferences, configuration, customization
- **Onboarding** - First-run experience, tutorials, sample data

---

## 3. Feature Specifications

### GD-001: Plant Catalog

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-001 |
| **Feature Name** | Plant Catalog |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As an indoor plant parent, I want to add all my plants to a digital catalog with photos, names, and key details, so that I can keep track of every plant I own and quickly reference its needs.

**Secondary:**
> As a backyard gardener, I want to edit plant details and remove plants I no longer have, so that my catalog stays current and only reflects plants in my care.

**Tertiary:**
> As a privacy-conscious gardener, I want my plant catalog stored entirely on-device with no cloud sync, so that no one else can see what I grow or where I grow it.

#### 3.3 Detailed Description

The Plant Catalog is the foundational feature of MyGarden. It provides the ability to create, read, update, and delete individual plant records stored in the local database. Each plant record captures a comprehensive set of attributes: common name, scientific/botanical name, species reference (linked to GD-018 Plant Care Database), acquisition date, acquisition method (purchased, grown from seed, gifted, propagated, rescued), current status (alive, dormant, dead, given away), location type (indoor or outdoor), assigned zone or room (linked to GD-016), the garden bed it belongs to (linked to GD-004), and an optional primary photo.

Plants serve as the central entity in MyGarden. Nearly every other feature references a plant record: watering reminders attach to plants, photos attach to plants, harvests are logged against plants, pest observations reference plants, and health scores are computed per plant. This design means the Plant Catalog must be built first and must support a flexible schema that other features can extend via foreign key relationships.

Users add plants through a creation form that requires only a common name at minimum. All other fields are optional but encouraged. If the user selects a species from the bundled care database (GD-018), the system pre-fills care defaults (sunlight, water frequency, humidity preference, temperature range) onto the plant record. Users can override these defaults at any time.

The catalog view displays all plants in a scrollable list or grid, sortable by name, date added, status, or location. Users can filter by status (alive, dormant, dead, given away), location type (indoor, outdoor), zone/room assignment, and garden bed. The list supports both a compact text-only list view and a photo-grid view where each card shows the plant's primary photo (or a colored placeholder with the plant's initial letter if no photo exists).

Unlike Planta and PictureThis, which require cloud accounts and upload plant photos to remote servers (including EXIF GPS coordinates revealing home layout), MyGarden stores all plant data and photos locally. No account is required. No data leaves the device.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local storage for the database file
- File system access for storing plant photos
- Camera hardware for taking plant photos (optional; user can also select from photo library)

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable
- File system storage directory is created and accessible

#### 3.5 User Interface Requirements

##### Screen: Plant List

**Layout:**
- Top navigation bar displays "My Plants" title and a count badge showing total alive plants (e.g., "My Plants (23)")
- Right side of nav bar has an "Add" button (plus icon) that opens the Add Plant modal
- Below the nav bar is a filter/sort toolbar with: a search text input (filters plants when 2+ characters are entered), a sort dropdown (Name A-Z, Name Z-A, Date Added, Status, Location), a view toggle (list/grid), and filter chips for status and location type
- Main content area displays plants in the selected view mode (list or grid)
- In list view: each row shows primary photo thumbnail (50x50px, circular crop), common name (bold, single line, truncated), scientific name (secondary text, italic, single line), status indicator dot (green for alive, yellow for dormant, gray for dead, blue for given away), and location label
- In grid view: primary photo fills card (2 columns), common name below photo (2 lines max), status indicator dot in the top-right corner of the photo
- Pull-to-refresh reloads the plant list from the database

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No plants in catalog | Centered illustration of a potted plant, heading "No plants yet", subtext "Add your first plant to start your garden journal", primary button "Add a Plant" |
| Loading | Database query in progress | Skeleton placeholders matching list/grid layout, 6 placeholder items |
| Populated | 1+ plants exist | Scrollable list/grid of plant items |
| Error | Database read fails | Inline error banner: "Could not load your plants. Pull down to retry." |
| Search Active | User types in search bar | Filtered results matching common name or scientific name; if no matches: "No plants matching '[query]'" |
| Filtered | User applies status/location filters | Filtered subset shown; if empty after filter: "No plants match the selected filters" with "Clear Filters" button |

**Interactions:**
- Tap plant item: navigates to Plant Detail screen
- Long press plant item: opens context menu with "Edit", "Water Now", "Log Photo", "Delete"
- Swipe left on list item: reveals "Delete" action (red)
- Tap filter chip: toggles that filter on/off, immediately updates the displayed list
- Pull-to-refresh: reloads plant list from database

**Transitions/Animations:**
- Items animate out when deleted with a fade + slide-left, 200ms duration
- New items animate in from the top of the list with a fade-in, 150ms duration
- View toggle (list/grid) crossfades with a 200ms transition

##### Screen: Plant Detail

**Layout:**
- Full-width primary photo at top (if available), otherwise a colored placeholder with the plant's first initial letter and a camera icon overlay labeled "Add Photo"
- Below photo: common name (large, bold), scientific name (italic, secondary color)
- Status badge (color-coded: green "Alive", yellow "Dormant", gray "Dead", blue "Given Away")
- Metadata grid (2 columns): acquisition date, acquisition method, location type, zone/room, garden bed, days in care (computed from acquisition date to today or death/giveaway date)
- Horizontal divider
- Care summary card (if species linked from GD-018): sunlight icon + requirement, water icon + frequency, humidity icon + preference, temperature icon + range
- Quick actions row: "Water" button, "Photo" button, "Note" button
- Section: Recent Photos (horizontal scrollable strip of the 5 most recent journal photos, "See All" link)
- Section: Upcoming Care (next watering, next fertilizing, next pruning, sourced from GD-006)
- Section: Health Score (current score with visual indicator bar, sourced from GD-014)
- Section: Harvest Log (if applicable, recent harvests from GD-008)
- Action buttons row: "Edit", "Share", "Delete"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Complete | All metadata and care data present | Full detail view as described |
| Minimal | Only name and status present | Detail view with empty sections showing "Not set" placeholders |
| With Photo | Primary photo exists | Photo rendered from local file path |
| Without Photo | No primary photo | Colored placeholder with initial letter and "Add Photo" call-to-action |
| Dead Plant | Status is "dead" | Muted styling, care sections hidden, "Days in Care" shows total lifespan |

**Interactions:**
- Tap "Edit": opens Edit Plant modal
- Tap "Water": logs a watering event with current timestamp (GD-002)
- Tap "Photo": opens camera or photo picker to add a journal photo (GD-003)
- Tap "Note": opens a text input to log a quick care note
- Tap primary photo: opens full-screen photo viewer
- Tap "See All" in Recent Photos: navigates to the full photo journal for this plant (GD-003)
- Tap "Delete": confirmation dialog ("Delete [plant name]? This will also remove all photos, care logs, and health data for this plant. This cannot be undone."), then removes plant and all related records
- Tap "Share": generates a share card with the plant's primary photo, name, and days in care

##### Modal: Add Plant

**Layout:**
- Modal sheet sliding up from bottom, full height on mobile, centered dialog on web
- Title: "Add Plant"
- Form fields in scrollable view:
  - Common Name (required, text input, max 200 characters)
  - Scientific Name (optional, text input, max 200 characters)
  - Species Lookup (optional, searchable dropdown linked to GD-018 care database; selecting a species auto-fills Scientific Name and care defaults)
  - Acquisition Date (date picker, defaults to today)
  - Acquisition Method (segmented control: Purchased, Grown from Seed, Gifted, Propagated, Rescued; default Purchased)
  - Status (segmented control: Alive, Dormant; default Alive; Dead and Given Away are set via later actions, not during creation)
  - Location Type (segmented control: Indoor, Outdoor; default Indoor)
  - Zone/Room (optional, dropdown of user-defined zones from GD-016; "Add New Zone" option at bottom of list)
  - Garden Bed (optional, dropdown of user-defined beds from GD-004; only shown when Location Type is Outdoor)
  - Primary Photo (optional, "Take Photo" or "Choose from Library" buttons; preview thumbnail after selection)
  - Notes (optional, multiline text input, max 2000 characters)
- Footer: "Cancel" button (left) and "Add Plant" button (right, disabled until common name is filled)

**Interactions:**
- Tap "Add Plant": validates fields, generates UUID, inserts plant record, stores photo file if provided, closes modal, navigates to new Plant Detail screen
- Tap "Cancel": dismisses modal with confirmation if form has unsaved data ("Discard new plant?")
- Tap Species Lookup: opens search interface against bundled care database; selecting a species fills Scientific Name, and stores `species_id` reference
- Inline validation: common name field shows "Plant name is required" if blurred while empty

##### Modal: Edit Plant

**Layout:**
- Same form fields as Add Plant, pre-populated with existing values
- Title: "Edit Plant"
- Additional fields available during edit that are not available during creation:
  - Status includes all 4 options: Alive, Dormant, Dead, Given Away
  - Death Date (date picker, shown only when status is changed to Dead)
  - Given Away Date (date picker, shown only when status is changed to Given Away)
  - Given Away To (text input, shown only when status is Given Away, max 200 characters)
- Footer: "Cancel" and "Save Changes"

**Interactions:**
- Tap "Save Changes": validates, updates plant record, closes modal
- Changing status to "Dead" shows a confirmation: "Mark [plant name] as dead? Care reminders will stop."
- Changing status to "Given Away" shows a confirmation: "Mark [plant name] as given away? Care reminders will stop."

#### 3.6 Data Requirements

##### Entity: Plant

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| common_name | TEXT | Required, min 1 char, max 200 chars | None | User-given common name (e.g., "Monstera", "Big Tom Tomato") |
| scientific_name | TEXT | Optional, max 200 chars | null | Botanical name (e.g., "Monstera deliciosa") |
| species_id | TEXT (UUID) | Optional, references Species.id | null | Link to bundled care database species |
| acquisition_date | TEXT | ISO 8601 date | Current date | When the plant was acquired |
| acquisition_method | TEXT | One of: 'purchased', 'seed', 'gifted', 'propagated', 'rescued' | 'purchased' | How the plant was obtained |
| status | TEXT | One of: 'alive', 'dormant', 'dead', 'given_away' | 'alive' | Current plant status |
| death_date | TEXT | Optional, ISO 8601 date | null | Date plant died (only if status is 'dead') |
| given_away_date | TEXT | Optional, ISO 8601 date | null | Date plant was given away |
| given_away_to | TEXT | Optional, max 200 chars | null | Who received the plant |
| location_type | TEXT | One of: 'indoor', 'outdoor' | 'indoor' | Whether the plant is indoors or outdoors |
| zone_id | TEXT (UUID) | Optional, references Zone.id | null | Which room or garden zone |
| garden_bed_id | TEXT (UUID) | Optional, references GardenBed.id | null | Which garden bed (outdoor plants) |
| primary_photo_path | TEXT | Optional | null | Local file path to primary photo |
| sunlight_override | TEXT | Optional, one of: 'full_sun', 'partial_sun', 'partial_shade', 'full_shade' | null | User override of species default |
| water_interval_override | INTEGER | Optional, positive integer (days) | null | User override of species watering interval |
| notes | TEXT | Optional, max 2000 chars | null | Freeform notes about the plant |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Plant belongs to Zone (many-to-one via zone_id)
- Plant belongs to GardenBed (many-to-one via garden_bed_id)
- Plant references Species (many-to-one via species_id)
- Plant has many JournalEntry (one-to-many)
- Plant has many WateringLog (one-to-many)
- Plant has many CareEvent (one-to-many)
- Plant has many Harvest (one-to-many)
- Plant has many PestObservation (one-to-many)
- Plant has many HealthScore (one-to-many)

**Indexes:**
- `common_name COLLATE NOCASE` - Sorted listing by name (case-insensitive)
- `status` - Frequently filtered by alive/dormant/dead
- `location_type` - Frequently filtered by indoor/outdoor
- `zone_id` - Queried when viewing plants by room/zone
- `garden_bed_id` - Queried when viewing plants by garden bed
- `species_id` - Queried when looking up care defaults
- `created_at` - Sorted listing by date added

**Validation Rules:**
- `common_name`: Must not be empty string after trimming whitespace
- `acquisition_date`: Must not be a future date (more than 1 day ahead, allowing for timezone differences)
- `death_date`: If provided, must be on or after `acquisition_date`
- `given_away_date`: If provided, must be on or after `acquisition_date`
- `status` + `death_date`: If status is 'dead', death_date should be set; if status is not 'dead', death_date must be null
- `status` + `given_away_date`: If status is 'given_away', given_away_date should be set
- `garden_bed_id`: Can only be set if `location_type` is 'outdoor'
- `water_interval_override`: If provided, must be between 1 and 365

**Example Data:**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "common_name": "Monstera",
  "scientific_name": "Monstera deliciosa",
  "species_id": "b1a2c3d4-e5f6-7890-abcd-ef1234567890",
  "acquisition_date": "2025-06-15",
  "acquisition_method": "purchased",
  "status": "alive",
  "death_date": null,
  "given_away_date": null,
  "given_away_to": null,
  "location_type": "indoor",
  "zone_id": "c2d3e4f5-a6b7-8901-cdef-234567890abc",
  "garden_bed_id": null,
  "primary_photo_path": "/data/garden/photos/f47ac10b-primary.jpg",
  "sunlight_override": null,
  "water_interval_override": null,
  "notes": "Bought from the farmers market. Already had 3 leaves.",
  "created_at": "2025-06-15T14:30:00Z",
  "updated_at": "2026-02-20T09:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Plant Status Transitions

**Purpose:** Control valid state changes for a plant's lifecycle status.

**Inputs:**
- current_status: enum ('alive', 'dormant', 'dead', 'given_away')
- new_status: enum ('alive', 'dormant', 'dead', 'given_away')

**Logic:**

```
VALID_TRANSITIONS = {
  'alive'      -> ['dormant', 'dead', 'given_away'],
  'dormant'    -> ['alive', 'dead', 'given_away'],
  'dead'       -> [] (terminal state, no transitions allowed),
  'given_away' -> [] (terminal state, no transitions allowed)
}

1. IF new_status == current_status THEN RETURN no-op (no change)
2. IF new_status NOT IN VALID_TRANSITIONS[current_status] THEN
     RETURN error: "Cannot change from [current_status] to [new_status]"
3. IF new_status == 'dead' THEN
     SET death_date to provided date or today
     Deactivate all care reminders for this plant
4. IF new_status == 'given_away' THEN
     SET given_away_date to provided date or today
     Deactivate all care reminders for this plant
5. IF new_status == 'alive' AND current_status == 'dormant' THEN
     Reactivate care reminders for this plant
6. UPDATE plant status
7. RETURN success
```

**Edge Cases:**
- Attempting to revive a dead plant: rejected with error message "Dead plants cannot be marked alive again. If you have a new plant of the same type, add it as a new plant."
- Attempting to recover a given-away plant: rejected with error message "Given-away plants cannot be recovered. If the plant was returned, add it as a new plant."
- Setting status to dormant: care reminders are paused but not deleted; they resume when status returns to alive

##### Days in Care Calculation

**Purpose:** Compute how long a plant has been (or was) in the user's care.

**Inputs:**
- acquisition_date: date
- status: enum
- death_date: date (optional)
- given_away_date: date (optional)

**Logic:**

```
1. IF status == 'dead' AND death_date is not null THEN
     end_date = death_date
   ELSE IF status == 'given_away' AND given_away_date is not null THEN
     end_date = given_away_date
   ELSE
     end_date = today
2. days_in_care = (end_date - acquisition_date) in days
3. IF days_in_care < 0 THEN days_in_care = 0
4. RETURN days_in_care
```

**Edge Cases:**
- Acquisition date is today: returns 0 days
- Acquisition date is in the future (data entry error allowed by older records): returns 0 days

##### Plant Deduplication Warning

**Purpose:** Warn users when adding a plant with a name very similar to an existing plant.

**Inputs:**
- new_common_name: string
- new_scientific_name: string (optional)

**Logic:**

```
1. Normalize: lowered_name = trim(lowercase(new_common_name))
2. Query all existing plant common_names (lowercase, trimmed)
3. IF exact match exists THEN
     RETURN "warning": "You already have a plant named '[name]'. Add anyway?"
4. IF new_scientific_name is provided THEN
     Query existing plants with matching scientific_name (case-insensitive)
     IF match found THEN
       RETURN "warning": "You already have a '[existing_common_name]' with the same species. Add anyway?"
5. RETURN "unique" (no warning)
```

**Edge Cases:**
- User has two plants with the same name (e.g., two basil plants): allowed after acknowledging warning
- Scientific name match but different common name: warning shown
- Warning is dismissible; it does not block creation

**Sort/Filter/Ranking Logic:**
- **Default sort:** Name A-Z (case-insensitive)
- **Available sort options:** Name A-Z, Name Z-A, Date Added (newest first), Date Added (oldest first), Status, Location
- **Filter options:** Status (multi-select: alive, dormant, dead, given away), Location Type (indoor, outdoor), Zone/Room (dropdown of user zones), Garden Bed (dropdown of user beds)
- **Filter combination:** All filters are AND-combined (e.g., "alive" AND "indoor" AND "Living Room" shows only alive indoor plants in the Living Room)
- **Search:** Searches common_name and scientific_name fields; substring matching; case-insensitive; results ranked by common_name match first, then scientific_name match

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on plant creation | Toast notification: "Could not save plant. Please try again." | User taps "Add Plant" again; form data is preserved |
| Database write fails on plant update | Toast notification: "Could not save changes. Please try again." | User taps "Save Changes" again; form data is preserved |
| Required field left blank | Inline validation message below the field: "Plant name is required" | User fills in the field; error clears immediately on input |
| Photo file cannot be saved to local storage | Toast notification: "Could not save photo. Check available storage." | User retries photo capture/selection; plant is saved without photo |
| Invalid status transition attempted | Toast notification: "Cannot change status from [current] to [new]." | User selects a valid status option |
| Database read fails loading plant list | Inline error banner: "Could not load your plants. Pull down to retry." | User pulls to refresh; if persistent, app restart |
| Photo file referenced but missing from file system | Placeholder image shown with "Photo unavailable" overlay | User can add a new primary photo via Edit |

**Validation Timing:**
- Field-level validation runs on blur (when the user leaves the field)
- Common name validation also runs on submit
- Status transition validation runs immediately when a new status is selected

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has no plants in their catalog,
   **When** they tap "Add a Plant", fill in "Monstera" as the common name, select "Indoor", and tap "Add Plant",
   **Then** a new plant record is created, the Plant Detail screen displays with the name "Monstera" and status "Alive", and the Plant List shows 1 plant.

2. **Given** the user has a plant named "Basil" with status "Alive",
   **When** they open the plant, tap "Edit", change the status to "Dead", set the death date, and tap "Save Changes",
   **Then** the plant status updates to "Dead", care reminders are deactivated, and the Plant Detail screen shows muted styling with the total days in care.

3. **Given** the user has 5 plants (3 indoor, 2 outdoor),
   **When** they tap the "Indoor" filter chip on the Plant List,
   **Then** only the 3 indoor plants are shown, and the count badge updates to "My Plants (3)".

4. **Given** the user has a plant with a primary photo,
   **When** they open the Plant Detail screen,
   **Then** the photo displays at full width at the top, loaded from the local file path.

**Edge Cases:**

5. **Given** the user already has a plant named "Basil",
   **When** they add another plant named "Basil",
   **Then** a warning appears: "You already have a plant named 'Basil'. Add anyway?" with "Add Anyway" and "Cancel" options.

6. **Given** the user has 500 plants in their catalog,
   **When** they open the Plant List,
   **Then** the list loads within 1 second and scrolls smoothly without jank.

**Negative Tests:**

7. **Given** the user is on the Add Plant form,
   **When** they tap "Add Plant" without entering a common name,
   **Then** the system shows inline validation: "Plant name is required" below the name field, and the plant is not created.

8. **Given** a plant has status "Dead",
   **When** the user attempts to change its status to "Alive" via any means,
   **Then** the system rejects the change with: "Dead plants cannot be marked alive again."
   **And** the plant record is not modified.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates plant with minimum fields | common_name: "Fern" | Plant record with id, common_name "Fern", status "alive", location_type "indoor" |
| rejects empty common name | common_name: "  " (whitespace only) | Validation error: "Plant name is required" |
| calculates days in care for alive plant | acquisition_date: 30 days ago, status: alive | days_in_care: 30 |
| calculates days in care for dead plant | acquisition_date: 60 days ago, death_date: 30 days ago | days_in_care: 30 |
| returns 0 days for same-day acquisition | acquisition_date: today | days_in_care: 0 |
| rejects dead to alive transition | current_status: dead, new_status: alive | Error: invalid transition |
| allows alive to dormant transition | current_status: alive, new_status: dormant | Success: status updated |
| warns on duplicate common name | existing: "Basil", new: "Basil" | Warning: "You already have a plant named 'Basil'" |
| validates garden_bed only for outdoor | location_type: indoor, garden_bed_id: "some-id" | Validation error or garden_bed_id cleared |
| validates death_date after acquisition | acquisition_date: "2026-01-15", death_date: "2025-12-01" | Validation error: death_date before acquisition |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add plant and verify it appears in list | 1. Open Add Plant modal, 2. Enter "Snake Plant", 3. Select Indoor, 4. Save | Plant List shows "Snake Plant" with alive status and indoor location |
| Delete plant and verify removal | 1. Long press "Fern" in list, 2. Tap "Delete", 3. Confirm deletion | "Fern" removed from Plant List, count badge decrements, all related records (photos, care logs) also deleted |
| Filter plants by status | 1. Add 2 alive plants and 1 dead plant, 2. Tap "Alive" filter | Only 2 alive plants shown; dead plant hidden |
| Edit plant species and verify care defaults | 1. Open "Monstera" detail, 2. Tap Edit, 3. Select "Monstera deliciosa" from species lookup, 4. Save | Care summary card populates with Monstera care requirements |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user adds their first plant | 1. Open app (empty state), 2. Tap "Add a Plant", 3. Enter "Pothos", 4. Take a photo, 5. Select "Indoor" and "Living Room" zone, 6. Save | Plant List shows 1 plant, Plant Detail shows photo, name, alive status, Living Room zone, 0 days in care, empty state is gone |
| User marks a plant as dead | 1. Open plant "Wilted Fern", 2. Tap Edit, 3. Change status to Dead, 4. Set death date to yesterday, 5. Confirm, 6. Save | Plant shows "Dead" status badge, muted styling, days in care shows total lifespan, care reminders are gone, plant still appears in list with gray status dot |

---

### GD-002: Smart Watering Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-002 |
| **Feature Name** | Smart Watering Reminders |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As an indoor plant parent, I want the app to remind me when each plant needs watering based on its specific needs and the current season, so that I never overwater or underwater my plants.

**Secondary:**
> As a backyard gardener, I want watering reminders to adjust automatically when it rains, so that I do not waste water or drown my outdoor plants.

**Tertiary:**
> As a forgetful plant owner, I want to see which plants are overdue for watering at a glance, so that I can prioritize the most urgent ones first.

#### 3.3 Detailed Description

Smart Watering Reminders is the intelligent scheduling engine that tells users when each plant needs water. Rather than simple fixed-interval timers, this feature computes dynamic watering schedules using a formula that accounts for plant type, season, and rain conditions.

The core formula works as follows: each plant species has a `base_interval` in days (e.g., 7 days for a typical houseplant, 2 days for a basil plant, 14 days for a succulent). This base interval is multiplied by a `seasonal_multiplier` that varies by current season: spring = 1.0 (baseline), summer = 1.5 (plants in summer need water more frequently, so the interval is divided by this factor rather than multiplied - see formula below), fall = 0.8, winter = 0.5. The actual formula computes `effective_interval = base_interval / seasonal_multiplier`, meaning in summer the interval shrinks (more frequent watering) and in winter it grows (less frequent watering). For outdoor plants, a `rain_delay` is applied: if precipitation exceeds 5mm in the past 24 hours (user-reported, since the app is offline-first), the next watering is pushed forward by the rain-equivalent days.

The effective watering interval formula:

```
effective_interval = base_interval / seasonal_multiplier

Where seasonal_multiplier:
  spring (Mar 1 - May 31) = 1.0
  summer (Jun 1 - Aug 31) = 1.5
  fall   (Sep 1 - Nov 30) = 0.8
  winter (Dec 1 - Feb 28) = 0.5

next_watering_date = last_watered_date + effective_interval (rounded to nearest day)

Rain delay (outdoor plants only):
  IF user reports precipitation > 5mm in last 24 hours THEN
    rain_delay_days = precipitation_mm / 5 (rounded down, max 3 days)
    next_watering_date = next_watering_date + rain_delay_days
```

Users can override the computed interval for any individual plant by setting a custom `water_interval_override` on the plant record (GD-001). When an override is set, the seasonal multiplier still applies to the override value.

The watering dashboard shows all plants organized by urgency: overdue (past due date, sorted by how many days overdue), due today, and upcoming (next 7 days). Each entry shows the plant name, photo thumbnail, last watered date, and next watering date. Users can tap "Water" on any plant to log a watering event, which resets the countdown.

Watering reminders can generate local push notifications at a user-configured time of day (default: 8:00 AM). The notification lists the number of plants due for watering that day (e.g., "3 plants need water today"). Tapping the notification opens the watering dashboard.

This feature differentiates from Planta by using a transparent, user-inspectable formula rather than a proprietary black-box algorithm. Users can see exactly why a watering date was computed and adjust any input (base interval, season dates, rain reports) to tune the schedule.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Watering reminders attach to plant records

**External Dependencies:**
- Local notification/push notification capability for reminders
- System clock for date calculations and seasonal determination
- Local storage for watering event logs

**Assumed Capabilities:**
- User has granted notification permissions (or can be prompted)
- Plant records exist in the database with species references or user-set overrides

#### 3.5 User Interface Requirements

##### Screen: Watering Dashboard

**Layout:**
- Top navigation bar displays "Watering" title and today's date
- Summary card at top showing: total plants needing water today (large number), overdue count (red badge), upcoming this week count
- Below summary card, three collapsible sections in order:
  1. "Overdue" (red header, sorted by days overdue descending, most overdue first)
  2. "Due Today" (primary color header, sorted by plant name)
  3. "Upcoming" (secondary color header, grouped by date for the next 7 days, sorted by date ascending then name)
- Each watering item row shows: plant photo thumbnail (40x40px, circular), plant common name, location label (zone/room), days since last watered or "Never watered", a "Water" button (droplet icon)
- Overdue items show a red "X days overdue" badge
- Bottom of screen: "Log Rain" button for outdoor rain reporting (only visible if user has outdoor plants)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No plants in catalog | Message: "Add plants to see watering reminders" with link to Plant Catalog |
| All Caught Up | No plants overdue or due today | Celebratory illustration (watering can with checkmark), "All caught up! No plants need water today." Upcoming section still visible |
| Has Overdue | 1+ plants past due | Overdue section expanded by default with red accent styling |
| No Species Data | Plants exist but have no species or override interval | Items show "Set watering interval" link instead of computed date |
| Loading | Computing watering schedules | Skeleton placeholders for 4 items |

**Interactions:**
- Tap "Water" button on any row: logs watering event with current timestamp, animates the row out of the overdue/today section, shows confirmation toast "Watered [plant name]"
- Tap plant row (anywhere except Water button): navigates to Plant Detail screen (GD-001)
- Tap "Log Rain" button: opens Rain Log modal
- Tap section header: collapses/expands that section
- Pull-to-refresh: recalculates all watering schedules

**Transitions/Animations:**
- Watered item slides out to the right with a fade, 250ms duration, accompanied by a brief water droplet animation
- Overdue count badge pulses gently every 3 seconds to draw attention
- Section collapse/expand animates with a 200ms slide

##### Modal: Rain Log

**Layout:**
- Small modal or bottom sheet
- Title: "Log Rainfall"
- Date picker (defaults to today, allows past 7 days)
- Precipitation amount input (numeric, in millimeters, min 0.1, max 500)
- Unit toggle: mm / inches (app converts inches to mm internally: 1 inch = 25.4mm)
- "Save" and "Cancel" buttons

**Interactions:**
- Tap "Save": creates a RainLog record, recalculates watering dates for all outdoor plants, closes modal, shows toast "[X]mm logged. Watering dates adjusted for outdoor plants."
- Tap "Cancel": dismisses without saving

##### Modal: Watering History

**Layout:**
- Full-screen modal or pushed screen
- Title: "Watering History - [Plant Name]"
- Calendar view showing dots on days when the plant was watered (green dots)
- Below calendar: scrollable list of watering events, newest first, each showing date, time, and any note
- Stats summary at top: total waterings, average interval between waterings, longest gap, shortest gap

**Interactions:**
- Tap a calendar date with a green dot: scrolls the list to that watering event
- Swipe left on a watering event: reveals "Delete" action to remove incorrect entries
- Tap "Done" or back navigation: closes the history view

#### 3.6 Data Requirements

##### Entity: WateringLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Which plant was watered |
| watered_at | TEXT | ISO 8601 datetime | Current timestamp | When the watering occurred |
| amount_ml | INTEGER | Optional, min 1, max 10000 | null | Amount of water given in milliliters |
| note | TEXT | Optional, max 500 chars | null | Optional note (e.g., "soil was very dry") |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: RainLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| logged_date | TEXT | ISO 8601 date | Current date | The date rain occurred |
| precipitation_mm | REAL | Required, min 0.1, max 500.0 | None | Rainfall amount in millimeters |
| note | TEXT | Optional, max 500 chars | null | Optional note (e.g., "heavy afternoon storm") |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Relationships:**
- WateringLog belongs to Plant (many-to-one via plant_id)
- RainLog is standalone (applies to all outdoor plants)

**Indexes:**
- WateringLog: `(plant_id, watered_at DESC)` - Quickly find most recent watering per plant
- WateringLog: `watered_at` - Date range queries for history views
- RainLog: `logged_date` - Lookup rain by date for delay calculations

**Validation Rules:**
- `plant_id`: Must reference an existing Plant record
- `watered_at`: Must not be more than 30 days in the future
- `precipitation_mm`: Must be a positive number between 0.1 and 500.0
- `logged_date`: Must not be more than 7 days in the past or in the future

**Example Data:**

```json
{
  "id": "d4e5f6a7-b8c9-0123-defa-456789012345",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "watered_at": "2026-03-06T08:15:00Z",
  "amount_ml": 250,
  "note": "Soil was completely dry",
  "created_at": "2026-03-06T08:15:00Z"
}
```

```json
{
  "id": "e5f6a7b8-c9d0-1234-abcf-567890123456",
  "logged_date": "2026-03-05",
  "precipitation_mm": 12.5,
  "note": "Heavy afternoon storm",
  "created_at": "2026-03-05T18:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Smart Watering Interval Calculation

**Purpose:** Compute the next watering date for a plant based on its species needs, season, and rain conditions.

**Inputs:**
- base_interval: integer (days) - from species care database or user override
- last_watered_date: date - from most recent WateringLog entry for this plant
- current_date: date
- hemisphere: enum ('northern', 'southern') - from user settings (default: northern)
- location_type: enum ('indoor', 'outdoor') - from Plant record
- recent_rain: array of RainLog entries from last 24 hours

**Logic:**

```
1. DETERMINE current_season from current_date and hemisphere:
     Northern hemisphere:
       spring: March 1 - May 31
       summer: June 1 - August 31
       fall:   September 1 - November 30
       winter: December 1 - February 28/29
     Southern hemisphere: seasons are inverted
       spring: September 1 - November 30
       summer: December 1 - February 28/29
       fall:   March 1 - May 31
       winter: June 1 - August 31

2. LOOKUP seasonal_multiplier:
     spring = 1.0
     summer = 1.5
     fall   = 0.8
     winter = 0.5

3. COMPUTE effective_interval:
     IF plant has water_interval_override THEN
       base = water_interval_override
     ELSE IF plant has species_id with known base_interval THEN
       base = species.base_watering_interval
     ELSE
       base = 7 (default weekly)

     effective_interval = ROUND(base / seasonal_multiplier)
     effective_interval = MAX(effective_interval, 1)  // minimum 1 day

4. COMPUTE next_watering_date:
     next_watering_date = last_watered_date + effective_interval days

5. APPLY rain_delay (outdoor plants only):
     IF location_type == 'outdoor' THEN
       total_rain_24h = SUM(recent_rain.precipitation_mm)
       IF total_rain_24h > 5.0 THEN
         rain_delay_days = FLOOR(total_rain_24h / 5)
         rain_delay_days = MIN(rain_delay_days, 3)  // cap at 3 days
         next_watering_date = next_watering_date + rain_delay_days

6. RETURN {
     next_watering_date,
     effective_interval,
     seasonal_multiplier,
     rain_delay_applied: (rain_delay_days > 0),
     rain_delay_days,
     is_overdue: (next_watering_date < current_date),
     days_overdue: MAX(0, current_date - next_watering_date)
   }
```

**Formulas:**
- `effective_interval = ROUND(base_interval / seasonal_multiplier)`
- `next_watering_date = last_watered_date + effective_interval`
- `rain_delay_days = MIN(FLOOR(total_precipitation_24h / 5), 3)` (outdoor only, when precip > 5mm)

**Edge Cases:**
- Plant has never been watered (no WateringLog entries): use acquisition_date as the `last_watered_date`; show "Never watered" label
- base_interval is 0 or negative: treat as 1 day (minimum interval)
- Seasonal multiplier yields an interval less than 1 day: clamp to 1 day
- Multiple rain logs on the same day: sum the precipitation amounts
- Rain delay would push watering date past the next scheduled watering after that: cap the delay so it does not skip entire cycles
- User in the southern hemisphere: seasons are inverted (summer is Dec-Feb in the north, but Jun-Aug in the south)
- Indoor plants: rain delay never applies regardless of rain logs

##### Watering Urgency Classification

**Purpose:** Classify each plant into an urgency bucket for display ordering.

**Inputs:**
- next_watering_date: date
- current_date: date

**Logic:**

```
1. days_until_due = next_watering_date - current_date
2. IF days_until_due < 0 THEN
     urgency = 'overdue'
     priority_sort = ABS(days_until_due)  // most overdue first
   ELSE IF days_until_due == 0 THEN
     urgency = 'today'
     priority_sort = 0
   ELSE IF days_until_due <= 7 THEN
     urgency = 'upcoming'
     priority_sort = days_until_due
   ELSE
     urgency = 'later'
     priority_sort = days_until_due
3. RETURN { urgency, days_until_due, priority_sort }
```

##### Notification Scheduling

**Purpose:** Schedule a daily local notification summarizing watering needs.

**Logic:**

```
1. At user-configured notification_time (default 8:00 AM local):
2. Query all plants with next_watering_date <= today
3. count_overdue = plants where next_watering_date < today
4. count_today = plants where next_watering_date == today
5. total = count_overdue + count_today
6. IF total > 0 THEN
     IF count_overdue > 0 THEN
       title = "Plants need water!"
       body = "[total] plants need water today ([count_overdue] overdue)"
     ELSE
       title = "Watering time"
       body = "[count_today] plants need water today"
   ELSE
     No notification sent
7. SCHEDULE local notification with title and body
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Urgency-based (overdue first by most days overdue, then today, then upcoming by soonest date)
- **Within same urgency:** Sorted alphabetically by plant common name
- **No additional filter options** on the watering dashboard (the dashboard is already a filtered view)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Watering log fails to save | Toast: "Could not log watering. Please try again." | User taps "Water" button again |
| Rain log fails to save | Toast: "Could not save rain data. Please try again." | User taps "Save" again in rain modal |
| No species data and no override for a plant | Item shows "Set watering interval" link | User taps link, navigates to Plant Edit where they can set a manual override or link a species |
| Notification permission denied | Banner on watering dashboard: "Notifications disabled. Enable in device settings for watering reminders." | Link to device notification settings |
| Watering history delete fails | Toast: "Could not delete entry. Please try again." | User retries swipe-to-delete |

**Validation Timing:**
- Rain amount validation runs on blur and on submit
- Date validation runs on selection change
- Watering schedule recalculation runs on: plant creation, manual watering log, rain log creation, season change (checked daily), plant edit (species or override change)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a plant "Basil" with species base_interval of 2 days, last watered 2 days ago, and current season is spring (multiplier 1.0),
   **When** the user opens the Watering Dashboard,
   **Then** "Basil" appears in the "Due Today" section with effective interval of 2 days.

2. **Given** a plant "Cactus" with species base_interval of 14 days, last watered 14 days ago, and current season is winter (multiplier 0.5),
   **When** the user opens the Watering Dashboard,
   **Then** "Cactus" does NOT appear as overdue because effective_interval = ROUND(14 / 0.5) = 28 days, and only 14 days have passed.

3. **Given** an outdoor plant "Tomato" due for watering today, and the user logs 15mm of rain,
   **When** the watering schedule recalculates,
   **Then** "Tomato"'s next watering date is pushed forward by FLOOR(15/5) = 3 days (the maximum delay).

4. **Given** the user taps "Water" on a plant in the overdue section,
   **When** the watering event is logged,
   **Then** the plant animates out of the overdue section, a confirmation toast appears, and the plant's next watering date recalculates from today.

**Edge Cases:**

5. **Given** a plant was just added today and has never been watered,
   **When** the watering dashboard loads,
   **Then** the plant shows "Never watered" with the next watering date calculated from the acquisition date.

6. **Given** an indoor plant and the user logs rain,
   **When** the watering schedule recalculates,
   **Then** the indoor plant's watering date is not affected by the rain log.

**Negative Tests:**

7. **Given** the user opens the Rain Log modal,
   **When** they enter 0 for precipitation and tap Save,
   **Then** the system shows inline validation: "Precipitation must be at least 0.1mm" and the rain log is not saved.

8. **Given** a plant with no species linked and no watering interval override,
   **When** the watering dashboard displays this plant,
   **Then** it shows "Set watering interval" instead of a computed date, and tapping it navigates to the Plant Edit screen.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates spring interval correctly | base: 7, season: spring (1.0) | effective_interval: 7 |
| calculates summer interval correctly | base: 7, season: summer (1.5) | effective_interval: 5 (ROUND(7/1.5)) |
| calculates fall interval correctly | base: 7, season: fall (0.8) | effective_interval: 9 (ROUND(7/0.8)) |
| calculates winter interval correctly | base: 7, season: winter (0.5) | effective_interval: 14 |
| clamps minimum interval to 1 day | base: 1, season: summer (1.5) | effective_interval: 1 (not 0) |
| applies rain delay for outdoor plants | base: 7, rain_24h: 12mm, outdoor | rain_delay: 2 days |
| caps rain delay at 3 days | base: 7, rain_24h: 50mm, outdoor | rain_delay: 3 days (not 10) |
| ignores rain for indoor plants | base: 7, rain_24h: 20mm, indoor | rain_delay: 0 |
| no rain delay when precip <= 5mm | base: 7, rain_24h: 4mm, outdoor | rain_delay: 0 |
| uses override interval over species default | override: 5, species_base: 10, season: spring | effective_interval: 5 |
| uses default 7 when no species or override | no species, no override, season: spring | effective_interval: 7 |
| classifies overdue correctly | next_watering: yesterday | urgency: 'overdue', days_overdue: 1 |
| classifies today correctly | next_watering: today | urgency: 'today', days_until_due: 0 |
| classifies upcoming correctly | next_watering: 3 days from now | urgency: 'upcoming', days_until_due: 3 |
| southern hemisphere inverts seasons | date: July 15, hemisphere: southern | season: winter, multiplier: 0.5 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Water plant and verify schedule updates | 1. Plant is overdue by 2 days, 2. Tap "Water", 3. Check schedule | Plant moves from overdue to upcoming, next_watering_date recalculated from today |
| Log rain and verify outdoor plants adjust | 1. Add outdoor tomato, 2. Log 10mm rain, 3. Check watering dashboard | Tomato's next watering pushed forward by 2 days; indoor plants unchanged |
| Season change recalculates all schedules | 1. Set system date to June 1, 2. Open watering dashboard | All plant intervals recalculated with summer multiplier (1.5) |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user sets up watering for first plant | 1. Add "Pothos" with species "Golden Pothos" (base interval 10 days), 2. Water it today, 3. Wait, 4. Open watering dashboard | Pothos shows in "Upcoming" section with next watering in ~10 days (adjusted for current season) |
| User manages full watering cycle | 1. Add 3 plants with different intervals, 2. Let 2 become overdue, 3. Water overdue plants, 4. Log rain, 5. Check dashboard | Watered plants moved to upcoming, outdoor plants adjusted for rain, notification count matches remaining due plants |

---

### GD-003: Growth Photo Journal

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-003 |
| **Feature Name** | Growth Photo Journal |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a plant parent, I want to take dated photos of my plants over time, so that I can see how much they have grown and track their visual progress.

**Secondary:**
> As a privacy-conscious gardener, I want my plant photos stored only on my device with no EXIF data transmitted anywhere, so that my home layout and garden locations remain private.

#### 3.3 Detailed Description

The Growth Photo Journal lets users document each plant's visual development over time through dated photo entries. Each journal entry consists of a photo, a date, and an optional text note. Photos are stored locally on the device file system and referenced by file path in the database. The app never reads, transmits, or stores EXIF metadata from photos.

For each plant, the journal displays entries in a chronological timeline, newest first. Users can view a side-by-side comparison of any two photos to see growth changes between dates. The journal also supports a time-lapse playback mode that cycles through all photos for a plant in chronological order at a configurable speed (1 second, 2 seconds, or 3 seconds per photo).

Photos can be captured directly from the camera or selected from the device photo library. When a photo is added, the app copies it to its own managed storage directory (not a reference to the photo library), ensuring the journal is self-contained and survives photo library cleanup. Photos are stored at a maximum resolution of 2048px on the longest edge to balance quality and storage space. The original photo is not retained; only the resized copy is stored.

The journal is accessible from the Plant Detail screen (GD-001) via the "Recent Photos" strip and the "See All" link. Users can also browse all journal entries across all plants in a unified timeline view, which is useful for seeing a global view of garden activity on a given day.

This feature directly addresses a critical privacy gap in competitors. Planta stores journal photos in its cloud service. PictureThis uploads every photo to their servers for AI processing, including EXIF data with GPS coordinates. MyGarden stores photos locally, never transmits them, and does not read EXIF data.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Journal entries are linked to individual plants

**External Dependencies:**
- Camera hardware for photo capture (optional; can select from library)
- File system access for photo storage
- Sufficient local storage space for photo files (estimated 500KB-2MB per photo after resize)

**Assumed Capabilities:**
- Camera and photo library permissions can be requested from the user
- File system has a dedicated app storage directory

#### 3.5 User Interface Requirements

##### Screen: Plant Photo Journal

**Layout:**
- Top navigation bar displays "[Plant Name] - Photo Journal" and an "Add Photo" button (camera icon) on the right
- Summary stats row: total photos, date range (first to most recent entry), average photos per month
- Main content is a scrollable vertical timeline of journal entries, newest first
- Each entry shows: photo (full width, aspect-ratio preserved, max height 300px), date and time label below the photo, note text below the date (if present), and a small menu icon (three dots) in the top-right corner of the entry
- Between entries, a vertical timeline connector line with the date gap label (e.g., "12 days later")
- Bottom floating action bar: "Compare" button (side-by-side mode), "Time-Lapse" button (playback mode)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No journal entries for this plant | Centered illustration of a camera, heading "No photos yet", subtext "Take your first photo to start tracking growth", primary button "Add Photo" |
| Single Entry | Only 1 photo exists | Timeline with one entry; "Compare" and "Time-Lapse" buttons are disabled (grayed out with tooltip "Need at least 2 photos") |
| Populated | 2+ entries exist | Full timeline view with all features enabled |
| Loading | Photos loading from file system | Skeleton placeholder for each entry with shimmer animation |

**Interactions:**
- Tap photo: opens full-screen photo viewer with pinch-to-zoom
- Tap three-dot menu on entry: shows options "Edit Note", "Change Date", "Set as Primary Photo", "Delete"
- Tap "Add Photo": opens action sheet with "Take Photo" (camera) and "Choose from Library" options
- Tap "Compare": enters comparison mode (see below)
- Tap "Time-Lapse": enters time-lapse playback mode (see below)
- Pull-to-refresh: reloads entries from database

**Transitions/Animations:**
- New entry animates in from the top with a slide-down + fade, 200ms
- Deleted entry fades out, 200ms, then remaining entries slide up to close the gap, 150ms

##### Screen: Photo Comparison

**Layout:**
- Top bar: "Compare" title with "Done" button on the right
- Two photo slots side by side (50% width each on landscape or tablets, stacked vertically on portrait phones)
- Each slot shows: photo, date label below
- Below the photos: date gap label (e.g., "47 days apart")
- Scrollable thumbnail strip at the bottom showing all journal photos; tapping a thumbnail assigns it to the currently selected slot (toggled by tapping the slot header)

**Interactions:**
- Tap a photo slot to select it (highlighted border), then tap a thumbnail to assign that photo to the selected slot
- Pinch-to-zoom on either photo independently
- Swipe left/right on a slot to cycle through photos in chronological order

##### Screen: Time-Lapse Playback

**Layout:**
- Full-screen photo display
- Bottom control bar: play/pause button, speed selector (1s, 2s, 3s per photo), progress indicator showing current photo number and total (e.g., "5 / 23")
- Date label overlay in the bottom-left corner, updating as photos cycle

**Interactions:**
- Tap play: cycles through photos in chronological order (oldest to newest) at the selected speed
- Tap pause: freezes on the current photo
- Swipe left/right: manually advance or go back one photo
- Tap speed button: cycles through 1s, 2s, 3s speeds
- Tap outside controls or "Done": exits time-lapse mode

##### Modal: Add Journal Entry

**Layout:**
- Bottom sheet modal
- Photo preview (full width, captured or selected image)
- Date picker (defaults to current date/time, allows selecting past dates)
- Note text input (optional, multiline, max 1000 characters, placeholder: "What's changed? Any observations?")
- "Save" and "Cancel" buttons

**Interactions:**
- Tap "Save": resizes photo to max 2048px on longest edge, saves to app storage, creates JournalEntry record, closes modal, new entry appears at top of timeline
- Tap "Cancel": discards photo and closes modal with confirmation if note has text

#### 3.6 Data Requirements

##### Entity: JournalEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Which plant this entry documents |
| photo_path | TEXT | Required, valid local file path | None | Path to the stored photo file |
| photo_width | INTEGER | Required, positive | None | Photo width in pixels after resize |
| photo_height | INTEGER | Required, positive | None | Photo height in pixels after resize |
| photo_size_bytes | INTEGER | Required, positive | None | File size in bytes |
| entry_date | TEXT | ISO 8601 datetime | Current timestamp | When the photo was taken or the date the user assigns |
| note | TEXT | Optional, max 1000 chars | null | User observation or note |
| is_primary | BOOLEAN | - | false | Whether this is the plant's primary display photo |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- JournalEntry belongs to Plant (many-to-one via plant_id)

**Indexes:**
- `(plant_id, entry_date DESC)` - Chronological listing per plant (newest first)
- `(plant_id, is_primary)` - Quick lookup of primary photo
- `entry_date` - Cross-plant timeline queries

**Validation Rules:**
- `plant_id`: Must reference an existing Plant record
- `photo_path`: Must be a non-empty string pointing to an existing file
- `entry_date`: Must not be more than 1 day in the future
- `is_primary`: At most one entry per plant can have is_primary = true; setting a new primary clears the previous one

**Example Data:**

```json
{
  "id": "a7b8c9d0-e1f2-3456-abcd-789012345678",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "photo_path": "/data/garden/photos/journal/a7b8c9d0-entry.jpg",
  "photo_width": 2048,
  "photo_height": 1536,
  "photo_size_bytes": 1245678,
  "entry_date": "2026-03-01T10:30:00Z",
  "note": "New leaf unfurling! Third one this month.",
  "is_primary": false,
  "created_at": "2026-03-01T10:30:00Z",
  "updated_at": "2026-03-01T10:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Photo Storage and Resize

**Purpose:** Manage photo file storage with size constraints.

**Inputs:**
- source_image: image file (from camera or library)
- plant_id: UUID
- entry_id: UUID

**Logic:**

```
1. GENERATE file_name = "[entry_id]-entry.jpg"
2. DETERMINE target_directory = app_storage_root + "/garden/photos/journal/"
3. CREATE target_directory if it does not exist
4. READ source_image dimensions (width, height)
5. IF MAX(width, height) > 2048 THEN
     scale_factor = 2048 / MAX(width, height)
     new_width = ROUND(width * scale_factor)
     new_height = ROUND(height * scale_factor)
     RESIZE source_image to (new_width, new_height)
   ELSE
     new_width = width
     new_height = height
6. SAVE resized image as JPEG at 85% quality to target_directory/file_name
7. RETURN {
     photo_path: target_directory + file_name,
     photo_width: new_width,
     photo_height: new_height,
     photo_size_bytes: file_size
   }
```

**Edge Cases:**
- Source image is smaller than 2048px: stored as-is (no upscaling)
- Source image is corrupt or unreadable: return error, do not create journal entry
- Storage directory is not writable: return error with storage-full message
- JPEG conversion from PNG/HEIC: convert to JPEG for consistent format

##### Primary Photo Management

**Purpose:** Ensure only one photo per plant is marked as the primary display photo.

**Logic:**

```
1. WHEN a journal entry is marked as is_primary = true:
2. QUERY: UPDATE journal_entries SET is_primary = false WHERE plant_id = [plant_id] AND is_primary = true
3. SET the new entry's is_primary = true
4. UPDATE the Plant record's primary_photo_path to point to this entry's photo_path
```

##### Photo Deletion and Cleanup

**Purpose:** Remove photo files from the file system when journal entries are deleted.

**Logic:**

```
1. WHEN a journal entry is deleted:
2. READ photo_path from the entry record
3. DELETE the file at photo_path from the file system
4. IF the deleted entry had is_primary = true THEN
     QUERY most recent remaining entry for the same plant
     IF exists THEN SET that entry as is_primary and update Plant.primary_photo_path
     ELSE SET Plant.primary_photo_path = null
5. DELETE the journal entry record from the database
```

**Edge Cases:**
- Photo file already missing from file system: log warning, proceed with database deletion
- Deleting the only journal entry: plant's primary_photo_path becomes null
- Deleting all journal entries for a plant: plant reverts to placeholder display

**Sort/Filter/Ranking Logic:**
- **Default sort:** Newest first (entry_date descending)
- **Available sort options:** Newest First, Oldest First
- **No filter options** on the per-plant journal view
- **Cross-plant timeline:** Sorted by entry_date descending, grouped by date

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | Message: "Camera access is needed to take photos. Enable in device settings." with link to settings | User enables camera permission in device settings |
| Photo library permission denied | Message: "Photo library access is needed to select photos. Enable in device settings." with link to settings | User enables photo library permission |
| Photo file cannot be saved (storage full) | Toast: "Not enough storage to save photo. Free up space and try again." | User frees storage space and retries |
| Photo file referenced but missing | Placeholder shown with "Photo unavailable" text | User can delete the broken entry |
| Journal entry save fails | Toast: "Could not save journal entry. Please try again." Photo file is cleaned up | User retries; photo is re-captured/selected |
| Time-lapse fails to load a photo | Skips the broken entry and continues to the next photo | Entry with missing file shown with warning in list view |

**Validation Timing:**
- Date validation runs on selection change
- Note length validation runs on blur
- Photo file validation (existence, readability) runs before save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a plant "Monstera" with no journal entries,
   **When** the user taps "Add Photo", takes a photo, adds the note "First photo!", and saves,
   **Then** the journal shows 1 entry with today's date, the photo, and the note, and the plant's primary photo updates to this image.

2. **Given** a plant with 10 journal entries spanning 6 months,
   **When** the user taps "Time-Lapse",
   **Then** the photos play in chronological order from oldest to newest at the default 2-second interval, with the date label updating for each photo.

3. **Given** a plant with 5 journal entries,
   **When** the user taps "Compare" and selects the first and most recent photos,
   **Then** both photos display side by side with the date gap shown (e.g., "120 days apart").

**Edge Cases:**

4. **Given** a plant with only 1 journal entry,
   **When** the user views the photo journal,
   **Then** the "Compare" and "Time-Lapse" buttons are disabled with a tooltip "Need at least 2 photos".

5. **Given** a source photo that is 6000x4000 pixels,
   **When** the user saves a journal entry with this photo,
   **Then** the stored photo is resized to 2048x1365 pixels (maintaining aspect ratio) and saved as JPEG at 85% quality.

**Negative Tests:**

6. **Given** the user has denied camera permissions,
   **When** they tap "Take Photo",
   **Then** a message explains camera access is needed with a link to device settings, and no photo is captured.

7. **Given** the device has insufficient storage,
   **When** the user tries to save a journal entry with a photo,
   **Then** a toast appears: "Not enough storage to save photo. Free up space and try again." The entry is not created and no partial file is left on the file system.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| resizes large photo to max 2048px | source: 6000x4000px | output: 2048x1365px |
| does not upscale small photos | source: 1024x768px | output: 1024x768px (unchanged) |
| resizes square photo correctly | source: 5000x5000px | output: 2048x2048px |
| handles portrait orientation | source: 3000x4500px | output: 1365x2048px |
| sets primary photo on first entry | plant has 0 entries, new entry added | is_primary: true, Plant.primary_photo_path updated |
| clears old primary when new one set | plant has entry A (primary), entry B set as primary | A.is_primary: false, B.is_primary: true |
| validates max note length | note: 1001 characters | Validation error: "Note cannot exceed 1000 characters" |
| rejects future entry date | entry_date: 2 days from now | Validation error: "Date cannot be in the future" |
| generates correct file path | entry_id: "abc-123", plant_id: "xyz-456" | "/data/garden/photos/journal/abc-123-entry.jpg" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add photo and verify it appears in journal | 1. Take photo of plant, 2. Add note, 3. Save, 4. View journal | New entry appears at top with photo, date, and note |
| Delete entry and verify primary photo updates | 1. Plant has 3 entries, entry 2 is primary, 2. Delete entry 2, 3. Check plant detail | Most recent remaining entry becomes primary, file for entry 2 is deleted from filesystem |
| Cross-plant timeline shows all entries | 1. Add photos to 3 different plants on the same day, 2. Open all-plants timeline | All 3 entries appear, sorted by time, each labeled with plant name |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User documents plant growth over time | 1. Add "Basil" plant, 2. Take photo on day 1, 3. Take photo on day 7, 4. Take photo on day 14, 5. Open journal | 3 entries in reverse chronological order, date gap labels ("7 days later") between entries, Compare and Time-Lapse buttons enabled |
| User sets a journal photo as primary | 1. View Basil journal with 5 entries, 2. Tap menu on entry 3, 3. Select "Set as Primary Photo" | Entry 3 shows "Primary" badge, Plant Detail and Plant List both show entry 3's photo, previous primary is cleared |

---

### GD-004: Garden Bed Mapping

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-004 |
| **Feature Name** | Garden Bed Mapping |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a backyard gardener, I want to create a visual map of my garden beds showing where each plant is located, so that I can plan spacing, rotations, and companion groupings without guessing.

**Secondary:**
> As a balcony grower, I want to map my container garden layout, so that I can track which pots are in which position and optimize sunlight exposure for each plant.

**Tertiary:**
> As a seed starter, I want to plan next season's garden bed layout before planting, so that I can decide on spacing and companion pairings ahead of time.

#### 3.3 Detailed Description

Garden Bed Mapping provides a visual, top-down representation of the user's outdoor growing areas. Each garden bed is a user-defined rectangular or freeform shape with dimensions in feet or meters. Within a bed, users place plant markers at approximate grid positions, making it possible to see at a glance which plants occupy which spots and how much space remains.

Beds can represent traditional in-ground plots, raised beds, container clusters on a balcony, or greenhouse sections. Each bed stores its own dimensions, soil type, sun exposure classification (full sun, partial sun, partial shade, full shade), and an optional label. Users can create multiple beds and arrange them on a single garden overview canvas, though the canvas is purely organizational and does not represent real-world spatial coordinates (no GPS).

The plant placement grid divides each bed into a grid based on its dimensions. For a 4ft x 8ft bed, the default grid resolution is 1ft squares (yielding 32 cells). Users can adjust grid resolution to 6-inch squares for denser planting (yielding 128 cells). Each cell can hold one plant marker, which links to a Plant record from the catalog (GD-001). Unplanted cells remain empty and display a dashed border.

Planting plans for future seasons can be created as separate "plan" layers on the same bed. Only one layer is active at a time: the "current" layer reflects what is actually planted now, while "plan" layers are drafts. When a new season starts, the user can promote a plan layer to the active layer. Historical layers are archived but never deleted, allowing the user to review past layouts for crop rotation analysis.

Unlike web-based garden planners that require cloud accounts, MyGarden stores all bed layouts and plant placement data locally. No coordinates, no satellite imagery, no network calls.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Plant markers reference Plant records

**External Dependencies:**
- Local storage for bed and cell placement data
- Touch-capable display for drag-and-drop plant placement

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable
- Plant records exist in the catalog for placement

#### 3.5 User Interface Requirements

##### Screen: Garden Overview

**Layout:**
- Top navigation bar displays "Garden Beds" title with a count badge showing total beds (e.g., "Garden Beds (4)")
- Right side of nav bar has an "Add Bed" button (plus icon)
- Main content area displays bed cards in a vertical scrollable list
- Each bed card shows: bed name (bold), dimensions label (e.g., "4ft x 8ft"), sun exposure icon, soil type label, plant count badge (e.g., "12 plants"), and a miniature top-down grid preview (max 120px tall) with colored dots for occupied cells
- Tapping a bed card navigates to the Bed Detail screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No beds created | Centered illustration of a garden plot, heading "No garden beds yet", subtext "Create your first bed to start planning your garden layout", primary button "Add a Bed" |
| Loading | Database query in progress | Skeleton placeholders for 3 bed cards |
| Populated | 1+ beds exist | Scrollable list of bed cards |
| Error | Database read fails | Inline error banner: "Could not load garden beds. Pull down to retry." |

**Interactions:**
- Tap bed card: navigates to Bed Detail screen
- Long press bed card: opens context menu with "Edit Details", "Duplicate", "Delete"
- Swipe left on bed card: reveals "Delete" action (red)
- Pull-to-refresh: reloads bed list

##### Screen: Bed Detail

**Layout:**
- Top navigation bar with bed name and "Edit" button
- Layer selector bar below nav bar: horizontal scrollable list of layers with "Current" always first, followed by plan layers sorted by creation date. Active layer has an underline indicator. "Add Plan" button at the end of the list
- Main content area: top-down grid view filling the width of the screen, aspect ratio matching bed dimensions, cells displayed as squares with light borders
- Occupied cells show: plant photo thumbnail (circular, filling 80% of the cell), plant common name below in small text (truncated)
- Empty cells show a dashed border with a small plus icon in the center
- Below the grid: bed info card showing dimensions, soil type, sun exposure, total plants, and empty cell count
- Pinch-to-zoom on the grid (zoom range: 0.5x to 3.0x, default 1.0x)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Bed | Bed exists but no plants placed | Grid shows all cells empty with dashed borders; message below grid: "Tap any cell to place a plant" |
| Populated | 1+ plants placed | Grid shows plant markers in occupied cells |
| Plan Layer Active | Viewing a plan layer, not current | Banner at top: "You are viewing a plan. Tap 'Activate' to make this the current layout." Grid cells have a subtle blue tint |
| Zoomed | User has pinched to zoom | Grid scales proportionally; cell details become more readable at higher zoom |

**Interactions:**
- Tap empty cell: opens Plant Picker modal to select a plant from the catalog and place it in this cell
- Tap occupied cell: opens a popover with plant name, "View Plant" (navigates to Plant Detail), "Move" (enters drag mode), "Remove" (removes from cell, does not delete plant)
- Long press occupied cell: enters drag mode, allowing the plant marker to be dragged to another empty cell within the same bed
- Pinch: zooms in/out on the grid
- Tap "Edit" in nav bar: opens Bed Edit modal to modify bed name, dimensions, soil type, sun exposure
- Tap "Add Plan" in layer bar: creates a new plan layer with a name prompt (e.g., "Summer 2026")

**Transitions/Animations:**
- Plant placement: marker fades in over 200ms
- Plant removal: marker fades out over 200ms
- Drag mode: lifted marker scales to 1.2x and follows finger with a drop shadow
- Layer switch: grid cross-fades over 300ms

##### Modal: Add/Edit Bed

**Layout:**
- Title: "Add Garden Bed" or "Edit [Bed Name]"
- Form fields:
  - Name: text input, required, max 100 characters
  - Width: numeric input with unit selector (feet/meters), min 1, max 100
  - Length: numeric input with unit selector (feet/meters), min 1, max 100
  - Grid Resolution: segmented control with "1 ft" and "6 in" (or "0.5 m" and "0.25 m" in metric)
  - Soil Type: dropdown with options - Loam, Clay, Sandy, Silt, Chalky, Peat, Rocky, Container Mix, Unknown
  - Sun Exposure: segmented control with Full Sun (6+ hours), Partial Sun (4-6 hours), Partial Shade (2-4 hours), Full Shade (<2 hours)
- "Save" and "Cancel" buttons

#### 3.6 Data Requirements

##### Entity: GardenBed

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, max 100 chars | None | User label for the bed (e.g., "Front Raised Bed") |
| width | REAL | Required, min 1.0, max 100.0 | None | Bed width in the selected unit |
| length | REAL | Required, min 1.0, max 100.0 | None | Bed length in the selected unit |
| unit | TEXT | One of: 'feet', 'meters' | 'feet' | Measurement unit for width and length |
| grid_resolution | REAL | One of: 1.0, 0.5 (feet) or 1.0, 0.25 (meters) | 1.0 | Grid cell size in the selected unit |
| soil_type | TEXT | One of: 'loam', 'clay', 'sandy', 'silt', 'chalky', 'peat', 'rocky', 'container_mix', 'unknown' | 'unknown' | Primary soil composition |
| sun_exposure | TEXT | One of: 'full_sun', 'partial_sun', 'partial_shade', 'full_shade' | 'full_sun' | Typical sunlight hours classification |
| sort_order | INTEGER | Min 0 | 0 | User-defined ordering in the bed list |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

##### Entity: BedLayer

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| bed_id | TEXT (UUID) | Required, references GardenBed.id | None | Which bed this layer belongs to |
| name | TEXT | Required, max 100 chars | None | Layer label (e.g., "Current", "Summer 2026 Plan") |
| layer_type | TEXT | One of: 'current', 'plan', 'archived' | 'plan' | Layer category |
| is_active | INTEGER | 0 or 1 | 0 | Whether this layer is the currently displayed layout |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

##### Entity: BedCell

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| layer_id | TEXT (UUID) | Required, references BedLayer.id | None | Which layer this placement belongs to |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Which plant occupies this cell |
| row_index | INTEGER | Required, min 0 | None | Row position in the grid (0-indexed from top) |
| col_index | INTEGER | Required, min 0 | None | Column position in the grid (0-indexed from left) |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Relationships:**
- GardenBed has many BedLayer (one-to-many via bed_id)
- BedLayer has many BedCell (one-to-many via layer_id)
- BedCell references Plant (many-to-one via plant_id)
- Plant optionally belongs to GardenBed (many-to-one via garden_bed_id on Plant record)

**Indexes:**
- GardenBed: `sort_order` - User-defined bed ordering
- BedLayer: `(bed_id, is_active)` - Quickly find the active layer for a bed
- BedCell: `(layer_id, row_index, col_index)` UNIQUE - Prevent duplicate placements in same cell
- BedCell: `plant_id` - Find all cells containing a specific plant

**Validation Rules:**
- `name`: Must not be empty string after trimming whitespace
- `width` and `length`: Must be positive numbers between 1.0 and 100.0
- `row_index`: Must be >= 0 and < (length / grid_resolution)
- `col_index`: Must be >= 0 and < (width / grid_resolution)
- Only one BedLayer per bed can have `is_active = 1` at a time
- The "current" layer type is created automatically when a bed is created; only one "current" layer per bed
- A plant_id can appear in only one BedCell across all active layers (a plant cannot be in two beds at once)

**Example Data:**

```json
{
  "id": "a1b2c3d4-bed1-4567-8901-abcdef123456",
  "name": "Front Raised Bed",
  "width": 4.0,
  "length": 8.0,
  "unit": "feet",
  "grid_resolution": 1.0,
  "soil_type": "loam",
  "sun_exposure": "full_sun",
  "sort_order": 0,
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-01T10:00:00Z"
}
```

```json
{
  "id": "c3d4e5f6-cell-7890-1234-567890abcdef",
  "layer_id": "b2c3d4e5-layr-6789-0123-456789abcdef",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "row_index": 2,
  "col_index": 1,
  "created_at": "2026-03-01T10:05:00Z"
}
```

#### 3.7 Business Logic Rules

##### Grid Dimension Calculation

**Purpose:** Compute the number of rows and columns in a garden bed grid based on bed dimensions and grid resolution.

**Inputs:**
- width: float (bed width in feet or meters)
- length: float (bed length in feet or meters)
- grid_resolution: float (cell size in the same unit)

**Logic:**

```
1. columns = CEIL(width / grid_resolution)
2. rows = CEIL(length / grid_resolution)
3. total_cells = rows * columns
4. IF total_cells > 10000 THEN
     RETURN error: "Grid too large. Reduce bed dimensions or increase grid resolution."
5. RETURN { rows, columns, total_cells }
```

**Formulas:**
- `columns = CEIL(width / grid_resolution)`
- `rows = CEIL(length / grid_resolution)`
- `total_cells = rows * columns`
- Maximum grid size: 10,000 cells

**Edge Cases:**
- Very large bed (100ft x 100ft at 6-inch resolution = 40,000 cells): rejected, user must increase resolution or reduce dimensions
- Width or length not evenly divisible by resolution: CEIL rounds up, last column/row may be narrower in visual display but occupies a full cell in data
- Minimum bed: 1ft x 1ft at 1ft resolution = 1 cell

##### Layer Activation

**Purpose:** Promote a plan layer to active status, archiving the previously active layer.

**Inputs:**
- bed_id: UUID
- new_active_layer_id: UUID

**Logic:**

```
1. QUERY current active layer for bed_id WHERE is_active = 1
2. IF current active layer exists THEN
     SET current_layer.is_active = 0
     SET current_layer.layer_type = 'archived'
     SET current_layer.name = current_layer.name + " (archived " + today + ")"
3. SET new_layer.is_active = 1
4. SET new_layer.layer_type = 'current'
5. FOR EACH BedCell in the new active layer:
     UPDATE Plant.garden_bed_id = bed_id for the referenced plant
6. FOR EACH BedCell in the old active layer that is NOT in the new layer:
     SET Plant.garden_bed_id = null for those plants (removed from bed)
7. RETURN success
```

**Edge Cases:**
- Activating a layer when no active layer exists (first-time setup): skip step 2, proceed from step 3
- Plan layer references plants that no longer exist (deleted): skip those cells, log warning, remove orphaned BedCell records
- Plant in new layer is already assigned to a different bed: update the plant's garden_bed_id to the new bed (a plant can only be in one bed)

##### Plant Placement Validation

**Purpose:** Verify that a plant can be placed in a specific cell.

**Inputs:**
- layer_id: UUID
- plant_id: UUID
- row_index: integer
- col_index: integer

**Logic:**

```
1. QUERY the BedCell at (layer_id, row_index, col_index)
2. IF cell is occupied THEN
     RETURN error: "This cell already has a plant. Remove it first."
3. QUERY all active BedCells across all beds where plant_id matches
4. IF plant is already placed in another active cell THEN
     RETURN warning: "This plant is already placed in [bed_name] at row [X], col [Y]. Move it here instead?"
5. VALIDATE row_index < max_rows AND col_index < max_columns
6. IF invalid THEN RETURN error: "Cell position is outside the bed boundaries."
7. RETURN success
```

**Edge Cases:**
- Placing the same plant in a plan layer while it is in a current layer: allowed (plans are independent)
- Plant with status "dead" or "given_away": show warning "This plant is [status]. Place anyway?" Allow placement for historical/planning purposes
- Bed dimensions changed after plants were placed: cells outside new boundaries are flagged, user prompted to relocate or remove

**Sort/Filter/Ranking Logic:**
- **Default sort (beds):** sort_order ascending, then created_at ascending
- **Available sort options:** Custom order (drag), Name A-Z, Name Z-A, Newest First, Oldest First
- **No filter options** on the bed list (all beds are always shown)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on bed creation | Toast: "Could not save garden bed. Please try again." | User retries; form data preserved |
| Grid too large (>10,000 cells) | Inline error: "Grid too large ([X] cells). Reduce bed size or use a coarser grid." | User adjusts dimensions or resolution |
| Plant drag to occupied cell | Cell flashes red briefly; toast: "That cell is already occupied." | User drags to an empty cell |
| Layer activation fails | Toast: "Could not activate this plan. Please try again." | User retries; no data changed |
| Bed deletion with plants placed | Confirmation dialog: "This bed has [N] plants placed. Deleting the bed will remove all placements but not the plants themselves. Continue?" | User confirms or cancels |
| Referenced plant no longer exists | Orphaned cell shown with "Plant deleted" placeholder and red X | User taps to remove the orphaned cell |

**Validation Timing:**
- Bed name and dimension validation runs on blur
- Grid resolution validation runs immediately on selection change
- Cell placement validation runs on tap (before placing)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has no garden beds,
   **When** they tap "Add a Bed", enter "Raised Bed A" with dimensions 4ft x 8ft, soil type "Loam", sun "Full Sun", and save,
   **Then** a new bed appears in the list with a 4x8 empty grid, and the overview card shows "0 plants".

2. **Given** a bed "Raised Bed A" with a 4x8 grid and a plant "Tomato" in the catalog,
   **When** the user taps cell (1, 2), selects "Tomato" from the plant picker, and confirms,
   **Then** cell (1, 2) shows the Tomato thumbnail and name, and the bed card plant count updates to "1 plant".

3. **Given** a bed with 5 plants placed in the current layer and a plan layer "Fall 2026" with 3 plants,
   **When** the user switches to the "Fall 2026" layer and taps "Activate",
   **Then** the 3 plan plants become the active layout, the previous 5-plant layout is archived, and plants removed from the active bed have their garden_bed_id cleared.

**Edge Cases:**

4. **Given** a bed with dimensions 100ft x 100ft and grid resolution 6 inches,
   **When** the user saves the bed,
   **Then** the system rejects it with: "Grid too large (40,000 cells). Reduce bed size or use a coarser grid."

5. **Given** a plant "Basil" is placed in "Bed A" cell (0, 0) on the active layer,
   **When** the user tries to place "Basil" in "Bed B" cell (1, 1),
   **Then** a warning appears: "This plant is already placed in Bed A at row 0, col 0. Move it here instead?"

**Negative Tests:**

6. **Given** the user is on the Add Bed form,
   **When** they leave the name blank and tap "Save",
   **Then** inline validation shows "Bed name is required" and the bed is not created.

7. **Given** a bed with 8 plants placed,
   **When** the user taps "Delete" on the bed,
   **Then** a confirmation dialog appears listing the plant count, and the plants themselves are NOT deleted from the catalog if the user confirms.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates grid dimensions 4x8 at 1ft | width: 4, length: 8, resolution: 1.0 | columns: 4, rows: 8, total: 32 |
| calculates grid dimensions 4x8 at 6in | width: 4, length: 8, resolution: 0.5 | columns: 8, rows: 16, total: 128 |
| rejects grid exceeding 10,000 cells | width: 100, length: 100, resolution: 0.5 | Error: grid too large |
| handles non-divisible dimensions | width: 3.5, length: 5.5, resolution: 1.0 | columns: 4, rows: 6, total: 24 |
| rejects empty bed name | name: "   " | Validation error: "Bed name is required" |
| validates cell within bounds | row: 7, col: 3, max_rows: 8, max_cols: 4 | Valid |
| rejects cell out of bounds | row: 8, col: 3, max_rows: 8, max_cols: 4 | Error: outside boundaries |
| enforces single active layer per bed | bed has layer A (active), activate layer B | Layer A becomes archived, B becomes active |
| detects duplicate plant placement | plant in Bed A active cell, attempt to place in Bed B | Warning returned |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create bed and place plants | 1. Create 4x8 bed, 2. Place Tomato at (0,0), 3. Place Basil at (0,1), 4. View bed | Grid shows 2 occupied cells, plant count is 2, Plant records have garden_bed_id set |
| Activate plan layer | 1. Create plan layer, 2. Place 3 plants in plan, 3. Activate plan | Previous layout archived, 3 new plants active, old plants' garden_bed_id cleared |
| Delete bed with plants | 1. Bed has 4 plants placed, 2. Delete bed, 3. Confirm | Bed removed, BedLayer and BedCell records deleted, Plant records still exist with garden_bed_id = null |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User creates and populates a garden bed | 1. Add bed "Herb Garden" (3x6 ft, Loam, Full Sun), 2. Place Basil, Thyme, Rosemary, Parsley in adjacent cells, 3. View overview | Bed card shows "4 plants", miniature grid preview shows 4 colored dots, tapping card shows full grid with plant photos |
| User plans a seasonal rotation | 1. Existing bed with 6 plants, 2. Create plan "Winter 2026", 3. Rearrange plants in plan, 4. Activate plan | Old layout archived with "(archived 2026-03-07)" suffix, new layout active, plant bed assignments updated |

---

### GD-005: Planting Calendar by USDA Zone

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-005 |
| **Feature Name** | Planting Calendar by USDA Zone |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a backyard gardener, I want a planting calendar that shows the best times to start seeds indoors, transplant outdoors, and direct sow for each of my plants based on my USDA hardiness zone, so that I plant at the right time and maximize my growing season.

**Secondary:**
> As a seed starter, I want to know my last frost date and first frost date so I can count backwards and forwards to determine ideal seed starting and transplanting windows.

#### 3.3 Detailed Description

The Planting Calendar provides a month-by-month visual timeline showing when to perform key planting activities for each species in the user's garden. The calendar is customized based on the user's USDA hardiness zone, which determines the approximate last spring frost date and first fall frost date. These two dates anchor all planting window calculations.

USDA hardiness zones range from 1 to 13, each spanning a 10-degree-F range of average annual minimum temperature, subdivided into "a" and "b" halves (5-degree increments). For example, Zone 7a covers 0 to 5 degrees F, Zone 7b covers 5 to 10 degrees F. The user selects their zone during setup (GD-024) or can look it up by entering their ZIP code against a bundled zone lookup table (approximately 42,000 ZIP-to-zone mappings for the US).

Each species in the plant care database (GD-018) includes planting window data relative to frost dates:

- **Indoor seed start:** X weeks before last frost date
- **Transplant outdoors:** Y weeks after last frost date
- **Direct sow:** Z weeks after last frost date through W weeks before first frost date
- **Harvest window:** A weeks after transplant/sow through B weeks after transplant/sow

The calendar view displays a 12-month scrollable timeline with colored bars for each planting activity. Users can view the calendar for all their plants at once (overview) or for a single plant (detail). A "This Month" card on the dashboard highlights actions due in the current month.

Frost date lookup table maps each USDA zone to approximate frost dates:

| Zone | Last Spring Frost | First Fall Frost |
|------|-------------------|------------------|
| 1 | June 15 | August 15 |
| 2 | June 1 | August 31 |
| 3 | May 15 | September 15 |
| 4 | May 1 | September 30 |
| 5 | April 15 | October 15 |
| 6 | April 1 | October 31 |
| 7 | March 22 | November 7 |
| 8 | March 15 | November 15 |
| 9 | February 15 | December 1 |
| 10 | January 31 | December 15 |
| 11-13 | Year-round growing (no frost) | Year-round growing (no frost) |

These are approximations. Users can override their frost dates manually if they know their micro-climate differs from the zone average.

Growing degree days (GDD) provide an additional data point for advanced users. GDD measures accumulated heat units that drive plant growth:

```
GDD = max(0, (T_max + T_min) / 2 - T_base)
```

Where T_max and T_min are the daily high and low temperatures, and T_base is the minimum temperature for the species (typically 50 degrees F for most vegetables). Since MyGarden is offline-first, users can manually log daily high/low temperatures or simply rely on the frost-date-based calendar. GDD tracking is an optional power-user feature, not required for the core planting calendar.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Calendar references the user's plant records
- GD-018: Plant Care Database - Species planting window data

**External Dependencies:**
- Bundled ZIP-to-USDA-zone lookup table (approximately 42,000 entries, ~1.5 MB)
- Local storage for user zone setting and GDD logs

**Assumed Capabilities:**
- User has selected their USDA zone in settings or entered a ZIP code
- Plant care database is loaded with planting window data

#### 3.5 User Interface Requirements

##### Screen: Planting Calendar

**Layout:**
- Top navigation bar displays "Planting Calendar" title and the user's zone badge (e.g., "Zone 7a")
- Below nav bar: month selector - horizontal scrollable strip of month labels (Jan-Dec) with the current month highlighted
- Below month selector: frost date indicators - small labels showing "Last Frost: Mar 22" and "First Frost: Nov 7" in the user's zone
- Main content area: vertical scrollable list of plants, each row showing:
  - Plant common name (left-aligned)
  - Horizontal bar chart spanning the 12-month timeline, with colored segments for each activity:
    - Blue: Indoor seed start window
    - Green: Transplant window
    - Orange: Direct sow window
    - Red/Gold: Harvest window
  - Current date indicator: vertical line across all plant bars
- Tapping a plant row expands it to show detailed dates for each activity (start date, end date, "X weeks until..." countdowns)
- Bottom floating action button: "This Month" - scrolls to current month and highlights all due actions

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No plants in catalog | Message: "Add plants to see your planting calendar" with link to Plant Catalog |
| No Zone Set | User has not selected USDA zone | Prompt: "Set your hardiness zone to see planting dates" with link to Settings |
| No Planting Data | Plants exist but species have no planting window data | Message: "Planting dates are not available for these species. You can add custom planting windows." |
| Populated | Plants with planting data and zone set | Full calendar view with colored bars |
| Month Detail | User taps a specific month | Expanded view showing only actions for that month |

**Interactions:**
- Tap month label: scrolls the timeline to center on that month and expands all activities due in that month
- Tap plant row: expands to show detailed dates with countdowns
- Tap "This Month" FAB: scrolls to current month, highlights due actions
- Long press a colored bar segment: shows tooltip with exact dates and description
- Pinch horizontally: zooms the timeline (range: 3-month view to 12-month view, default: 12 months)

**Transitions/Animations:**
- Row expansion: smooth height animation, 200ms
- Month scroll: smooth horizontal scroll to center the selected month
- Current date indicator: subtle pulse animation every 5 seconds

##### Screen: GDD Tracker (Optional/Advanced)

**Layout:**
- Title: "Growing Degree Days"
- Summary card: total accumulated GDD for the current season (since last frost date), target GDD for each plant species
- Daily log form: date picker (defaults to today), high temperature input, low temperature input, unit toggle (F/C)
- Below form: scrollable list of daily GDD entries, newest first
- Chart: line graph of cumulative GDD over the season

**Interactions:**
- Tap "Log Today": saves a GDD entry for the selected date
- Swipe left on entry: delete that day's log
- Tapping a plant in the chart legend highlights its target GDD line

#### 3.6 Data Requirements

##### Entity: PlantingWindow

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| species_id | TEXT (UUID) | Required, references Species.id | None | Which species this window applies to |
| activity | TEXT | One of: 'indoor_seed', 'transplant', 'direct_sow', 'harvest' | None | Type of planting activity |
| weeks_before_last_frost | INTEGER | Optional, min 0, max 52 | null | Weeks before last frost to start (for indoor_seed) |
| weeks_after_last_frost | INTEGER | Optional, min 0, max 52 | null | Weeks after last frost to start (for transplant, direct_sow) |
| weeks_before_first_frost | INTEGER | Optional, min 0, max 52 | null | Weeks before first frost as end date (for direct_sow) |
| duration_weeks | INTEGER | Optional, min 1, max 52 | null | Duration of the activity window in weeks |
| notes | TEXT | Optional, max 500 chars | null | Additional guidance (e.g., "Start indoors under grow lights") |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: GDDLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| log_date | TEXT | ISO 8601 date, required, unique | None | The date this reading covers |
| temp_high_f | REAL | Required, min -60, max 140 | None | Daily high temperature in Fahrenheit |
| temp_low_f | REAL | Required, min -60, max 140 | None | Daily low temperature in Fahrenheit |
| gdd_value | REAL | Computed, min 0 | 0 | Computed growing degree days for this date |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: ZoneLookup (Bundled, Read-Only)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| zip_code | TEXT | Primary key, 5 digits | None | US ZIP code |
| zone | TEXT | One of: '1a'-'13b' | None | USDA hardiness zone |
| last_frost_mmdd | TEXT | MM-DD format | None | Approximate last spring frost date |
| first_frost_mmdd | TEXT | MM-DD format | None | Approximate first fall frost date |

**Relationships:**
- PlantingWindow belongs to Species (many-to-one via species_id)
- GDDLog is standalone (not linked to a plant)
- ZoneLookup is a read-only reference table

**Indexes:**
- PlantingWindow: `(species_id, activity)` - Look up windows for a species
- GDDLog: `log_date` UNIQUE - One entry per date
- ZoneLookup: `zip_code` PRIMARY KEY - ZIP lookup

**Validation Rules:**
- `temp_high_f` must be >= `temp_low_f` for the same day
- `log_date` must not be in the future
- `log_date` must be unique (one entry per day)
- `zip_code` must be exactly 5 digits
- At least one of `weeks_before_last_frost` or `weeks_after_last_frost` must be provided for a PlantingWindow

**Example Data:**

```json
{
  "id": "pw-0001-seed-tomato",
  "species_id": "sp-tomato-001",
  "activity": "indoor_seed",
  "weeks_before_last_frost": 6,
  "weeks_after_last_frost": null,
  "weeks_before_first_frost": null,
  "duration_weeks": 6,
  "notes": "Start indoors 6-8 weeks before last frost. Needs 65-85F soil temperature.",
  "created_at": "2026-03-01T00:00:00Z"
}
```

```json
{
  "id": "gdd-2026-03-06",
  "log_date": "2026-03-06",
  "temp_high_f": 62.0,
  "temp_low_f": 41.0,
  "gdd_value": 1.5,
  "created_at": "2026-03-06T20:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Planting Date Calculation

**Purpose:** Compute the concrete start and end dates for each planting activity based on the user's USDA zone frost dates.

**Inputs:**
- zone: string (e.g., "7a")
- species_id: UUID
- current_year: integer

**Logic:**

```
1. LOOKUP last_frost_date and first_frost_date from ZoneLookup for the user's zone
   IF zone is 11-13 THEN
     All activities are year-round; return 12-month windows
2. FOR EACH PlantingWindow WHERE species_id matches:
   a. IF activity == 'indoor_seed' THEN
        start_date = last_frost_date - (weeks_before_last_frost * 7 days)
        end_date = start_date + (duration_weeks * 7 days)
   b. IF activity == 'transplant' THEN
        start_date = last_frost_date + (weeks_after_last_frost * 7 days)
        end_date = start_date + (duration_weeks * 7 days)
   c. IF activity == 'direct_sow' THEN
        start_date = last_frost_date + (weeks_after_last_frost * 7 days)
        IF weeks_before_first_frost is not null THEN
          end_date = first_frost_date - (weeks_before_first_frost * 7 days)
        ELSE
          end_date = start_date + (duration_weeks * 7 days)
   d. IF activity == 'harvest' THEN
        sow_or_transplant_date = the computed start of transplant or direct_sow
        start_date = sow_or_transplant_date + (weeks_after_last_frost * 7 days)
        end_date = start_date + (duration_weeks * 7 days)
3. RETURN array of { activity, start_date, end_date, is_current: (today >= start_date AND today <= end_date) }
```

**Formulas:**
- `indoor_seed_start = last_frost - (weeks_before * 7)`
- `transplant_start = last_frost + (weeks_after * 7)`
- `direct_sow_end = first_frost - (weeks_before_first_frost * 7)`
- `GDD = max(0, (T_max + T_min) / 2 - T_base)` where T_base defaults to 50 degrees F

**Edge Cases:**
- Zone 11-13 (year-round growing): all windows span January 1 through December 31; frost dates are irrelevant
- Species has no planting window data: show "No planting data available" for that plant
- Indoor-only plants (houseplants): planting calendar is not applicable; hide from calendar view
- Computed start date is in the past for the current year: show the window as "missed" with a muted style and the next occurrence (same dates next year)
- Harvest window extends past December 31: wrap to next year visually

##### GDD Accumulation

**Purpose:** Compute cumulative growing degree days for the current season.

**Inputs:**
- gdd_logs: array of GDDLog entries since last frost date
- t_base: float (species-specific base temperature, default 50 degrees F)

**Logic:**

```
1. SET cumulative_gdd = 0
2. FOR EACH log in gdd_logs sorted by log_date ascending:
     daily_gdd = MAX(0, (log.temp_high_f + log.temp_low_f) / 2 - t_base)
     cumulative_gdd = cumulative_gdd + daily_gdd
3. RETURN cumulative_gdd
```

**Edge Cases:**
- No GDD logs: return 0
- temp_high is below t_base: daily GDD is 0 (the MAX clamps it)
- Both temps below t_base: daily GDD is 0
- Missing days in the log: skip them, do not interpolate

**Sort/Filter/Ranking Logic:**
- **Default sort:** By planting activity start date (earliest first within the current view)
- **Available sort options:** By Plant Name A-Z, By Earliest Action, By Activity Type
- **Filter options:** Activity type (indoor seed, transplant, direct sow, harvest), Month, Plants with actions due this month only
- **Search:** Not applicable for calendar view

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Zone not set | Full-screen prompt: "Set your USDA hardiness zone to see planting dates" with a button linking to Settings | User navigates to Settings and selects zone |
| ZIP code not found in lookup table | Inline error: "ZIP code not found. Enter your zone manually." | User selects zone from dropdown instead |
| GDD log with invalid temperatures | Inline validation: "High temperature must be greater than or equal to low temperature" | User corrects values |
| Planting window data missing for species | Plant row in calendar shows "No planting data" in gray italic | User can add custom planting windows via plant detail |
| GDD log date conflict (duplicate) | Toast: "A log for [date] already exists. Edit the existing entry?" | User edits existing entry or chooses a different date |
| Database read fails loading calendar | Inline error banner: "Could not load planting calendar. Pull down to retry." | User pulls to refresh |

**Validation Timing:**
- ZIP code validation runs on submit (5-digit check + lookup)
- Temperature validation runs on blur
- Planting window field validation runs on blur

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is in Zone 7a (last frost March 22, first frost November 7) and has a "Tomato" plant with indoor seed start 6 weeks before last frost,
   **When** they open the Planting Calendar,
   **Then** the Tomato row shows a blue "Indoor Seed" bar starting February 8 and ending March 22.

2. **Given** the user enters ZIP code "97201" (Portland, OR - Zone 8b),
   **When** the system looks up the zone,
   **Then** the zone is set to "8b" with last frost March 15 and first frost November 15.

3. **Given** the user logs daily temperatures for 10 days with highs averaging 72F and lows averaging 48F,
   **When** they view the GDD tracker,
   **Then** cumulative GDD shows approximately 100 (10 days * (72+48)/2 - 50 = 10 * 10 = 100).

**Edge Cases:**

4. **Given** the user is in Zone 12 (year-round growing),
   **When** they view the planting calendar for a Tomato,
   **Then** all activity bars span the full 12 months with no frost date indicators.

5. **Given** it is July and the indoor seed start window for Tomato was February-March,
   **When** the user views the calendar,
   **Then** the indoor seed bar is muted/grayed with a "Missed" label and a note "Next window: February [next year]".

**Negative Tests:**

6. **Given** the user enters ZIP code "00000" (invalid),
   **When** they tap "Look Up Zone",
   **Then** the system shows: "ZIP code not found. Enter your zone manually."
   **And** the zone setting is not changed.

7. **Given** the user tries to log a GDD entry with high temp 40F and low temp 55F,
   **When** they tap "Save",
   **Then** validation shows: "High temperature must be greater than or equal to low temperature."
   **And** the entry is not saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates indoor seed start date | zone 7a (last frost Mar 22), 6 weeks before | start: Feb 8 |
| calculates transplant start date | zone 7a (last frost Mar 22), 2 weeks after | start: Apr 5 |
| calculates direct sow end date | zone 7a (first frost Nov 7), 4 weeks before | end: Oct 10 |
| returns year-round for zone 12 | zone 12 | start: Jan 1, end: Dec 31 for all activities |
| computes GDD correctly | high: 72, low: 48, base: 50 | GDD: 10.0 |
| clamps GDD to zero when cold | high: 40, low: 30, base: 50 | GDD: 0 |
| accumulates GDD over multiple days | 3 days of (70,50), base 50 | cumulative: 30.0 |
| looks up zone from ZIP | zip: "97201" | zone: "8b" |
| rejects unknown ZIP | zip: "00000" | error: not found |
| validates temp_high >= temp_low | high: 40, low: 55 | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Set zone and view calendar | 1. Set zone to 7a, 2. Add Tomato with planting data, 3. Open calendar | Tomato row shows colored bars anchored to Mar 22 last frost |
| ZIP lookup sets zone | 1. Enter ZIP "97201", 2. Tap Look Up | Zone set to 8b, frost dates updated, calendar recalculates |
| Log GDD and check accumulation | 1. Log 5 daily entries, 2. View GDD tracker | Cumulative GDD matches sum of daily calculations |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user sets up planting calendar | 1. Enter ZIP code, 2. System sets zone, 3. Add Tomato and Basil, 4. Open calendar | Both plants show planting bars relative to user's frost dates, "This Month" card highlights current actions |
| User tracks GDD through season | 1. Log daily temps for 30 days after last frost, 2. View GDD tracker, 3. Compare to Tomato target (1400 GDD) | Cumulative GDD displayed on chart, Tomato target line shown, percentage complete displayed |

---

### GD-006: Care Schedule

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-006 |
| **Feature Name** | Care Schedule |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an indoor plant parent, I want a consolidated care schedule showing all upcoming tasks for all my plants (watering, fertilizing, pruning, repotting), so that I can plan my weekly plant care routine in one place.

**Secondary:**
> As a backyard gardener, I want to log when I performed each care activity so I can track adherence to the schedule and see my care history over time.

#### 3.3 Detailed Description

The Care Schedule consolidates all recurring plant care activities into a single calendar-style interface. While Smart Watering Reminders (GD-002) handles watering specifically, the Care Schedule adds three additional care types: fertilizing, pruning, and repotting. Each care type has its own recurrence interval per plant, computed from species defaults in the plant care database (GD-018) and adjustable by the user.

Care types and their typical intervals:

| Care Type | Typical Interval | Seasonal Adjustment |
|-----------|-----------------|---------------------|
| Watering | 2-14 days (species-dependent) | Summer: more frequent (divide by 1.5), Winter: less frequent (divide by 0.5) |
| Fertilizing | 14-60 days | Spring/Summer only for most species; no fertilizing in winter dormancy |
| Pruning | 30-180 days | Species-dependent; some prune in spring, some after flowering |
| Repotting | 365-730 days (1-2 years) | Best done in spring (March-May in northern hemisphere) |

Each care activity for each plant is tracked as a CareEvent. When the user performs a care task, they log it as a completed CareEvent, which resets the countdown for the next occurrence. The system computes the next due date using the same seasonal multiplier system as watering (GD-002).

The care schedule view shows a weekly or monthly calendar with care tasks grouped by date. Each day cell shows icons for the care types due that day with plant thumbnails. Users can tap any task to mark it complete, snooze it (push to tomorrow), or skip it (mark as intentionally skipped without resetting the interval).

A daily digest notification (separate from the watering notification in GD-002) summarizes all care tasks due today: "Today: 3 plants need water, 1 needs fertilizer, 1 needs pruning."

The schedule also supports one-time care tasks that are not recurring. Users can add a custom task (e.g., "Stake the tomato plant", "Check for root binding") with a specific due date. One-time tasks appear in the calendar and disappear after completion.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Care events reference plant records
- GD-002: Smart Watering Reminders - Watering data is shared (CareEvent type 'watering' maps to WateringLog)

**External Dependencies:**
- Local notification capability for daily digest
- Local storage for care events and custom tasks
- System clock for date calculations

**Assumed Capabilities:**
- Plant records exist with species references or user-set overrides
- Watering reminder system is active and computes watering due dates

#### 3.5 User Interface Requirements

##### Screen: Care Calendar

**Layout:**
- Top navigation bar displays "Care Schedule" title
- View mode toggle: "Week" | "Month" (default: Week)
- In week view: 7-column grid showing day names (Mon-Sun) with the current week displayed. Each day cell contains small icons for care types due (droplet for water, flask for fertilize, scissors for prune, pot for repot, wrench for custom). Below each icon set, plant names are listed in small text. Current day cell has a highlighted border
- In month view: standard month calendar grid. Days with care tasks show a colored dot per care type. Tapping a day expands to show the full task list
- Below the calendar: "Today's Tasks" section showing an expandable list of all care tasks due today, grouped by care type. Each row shows: care type icon, plant photo thumbnail (40x40px), plant name, "last done X days ago" label, and action buttons: "Done" (checkmark), "Snooze" (clock icon, pushes to tomorrow), "Skip" (X icon, marks as intentionally skipped)
- "Add Custom Task" button at the bottom of the Today section

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No plants in catalog | Message: "Add plants to see your care schedule" with link to Plant Catalog |
| All Done | No tasks due today or overdue | Celebratory message: "All caught up! No care tasks due today." Calendar still shows future tasks |
| Has Overdue | Tasks from past days not completed | Overdue section (red) above Today's Tasks, showing missed tasks grouped by date |
| Loading | Computing schedules | Skeleton placeholders for calendar grid and task list |

**Interactions:**
- Tap "Done" on a task: logs a CareEvent, animates the task out, shows toast "[Care Type] logged for [Plant Name]"
- Tap "Snooze": pushes the task to tomorrow without logging a CareEvent
- Tap "Skip": marks as skipped, resets the countdown from today (next due = today + interval)
- Tap day cell (month view): expands to show all tasks for that day
- Swipe left/right on calendar: navigate weeks or months
- Tap "Add Custom Task": opens custom task modal
- Pull-to-refresh: recalculates all schedules

**Transitions/Animations:**
- Completed task slides out to the right with a green flash, 250ms
- Snoozed task fades and slides down, 200ms
- Calendar week/month transition: cross-fade, 200ms

##### Modal: Add Custom Task

**Layout:**
- Title: "Add Custom Task"
- Plant picker: dropdown or search to select a plant
- Task name: text input, required, max 200 chars (e.g., "Stake the tomato")
- Due date: date picker, required, defaults to today
- Notes: multiline text input, optional, max 500 chars
- "Save" and "Cancel" buttons

**Interactions:**
- Save: creates a one-time CareEvent with type 'custom'
- Cancel: dismisses without saving

##### Modal: Care History

**Layout:**
- Title: "Care History - [Plant Name]"
- Filter bar: care type filter chips (All, Water, Fertilize, Prune, Repot, Custom)
- Scrollable list of completed CareEvent records, newest first
- Each row: date, care type icon, time, notes (if any), outcome (completed/skipped)
- Summary stats at top: total care events, most common type, average interval per type, current streak (consecutive on-time care)

**Interactions:**
- Tap filter chip: filters list by care type
- Swipe left on entry: reveals "Delete" to remove incorrect entries

#### 3.6 Data Requirements

##### Entity: CareEvent

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Which plant this care event applies to |
| care_type | TEXT | One of: 'watering', 'fertilizing', 'pruning', 'repotting', 'custom' | None | Type of care performed |
| scheduled_date | TEXT | ISO 8601 date | None | When this task was originally due |
| completed_date | TEXT | ISO 8601 date, optional | null | When the task was actually completed |
| outcome | TEXT | One of: 'completed', 'skipped', 'snoozed', 'pending' | 'pending' | What the user did with this task |
| task_name | TEXT | Optional (required for 'custom' type), max 200 chars | null | Label for custom tasks |
| notes | TEXT | Optional, max 500 chars | null | User notes about this care event |
| is_recurring | INTEGER | 0 or 1 | 1 | Whether this event repeats on a schedule |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

##### Entity: CareScheduleConfig

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Which plant this config applies to |
| care_type | TEXT | One of: 'fertilizing', 'pruning', 'repotting' | None | Care type (watering uses GD-002 system) |
| interval_days | INTEGER | Required, min 1, max 730 | None | Days between care events |
| seasonal_adjust | INTEGER | 0 or 1 | 1 | Whether to apply seasonal multiplier |
| active_seasons | TEXT | Comma-separated: 'spring,summer,fall,winter' | 'spring,summer,fall,winter' | Seasons when this care type is active |
| last_performed | TEXT | ISO 8601 date, optional | null | Most recent completion date |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- CareEvent belongs to Plant (many-to-one via plant_id)
- CareScheduleConfig belongs to Plant (many-to-one via plant_id)
- CareScheduleConfig is unique per (plant_id, care_type) pair

**Indexes:**
- CareEvent: `(plant_id, care_type, scheduled_date DESC)` - Quickly find latest care event per type per plant
- CareEvent: `(scheduled_date, outcome)` - Calendar view queries for a date range
- CareScheduleConfig: `(plant_id, care_type)` UNIQUE - One config per plant per care type

**Validation Rules:**
- `care_type`: Must be one of the allowed values
- `task_name`: Required when care_type is 'custom', otherwise optional
- `completed_date`: Must not be more than 7 days in the future
- `scheduled_date`: Must not be more than 365 days in the future for recurring tasks
- CareScheduleConfig `interval_days`: Must be between 1 and 730
- CareScheduleConfig `active_seasons`: Must contain at least one valid season

**Example Data:**

```json
{
  "id": "ce-001-fert-monstera",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "care_type": "fertilizing",
  "scheduled_date": "2026-03-15",
  "completed_date": "2026-03-15",
  "outcome": "completed",
  "task_name": null,
  "notes": "Used 10-10-10 liquid fertilizer, half strength",
  "is_recurring": 1,
  "created_at": "2026-03-15T09:00:00Z",
  "updated_at": "2026-03-15T09:00:00Z"
}
```

```json
{
  "id": "csc-001-fert-monstera",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "care_type": "fertilizing",
  "interval_days": 30,
  "seasonal_adjust": 1,
  "active_seasons": "spring,summer",
  "last_performed": "2026-03-15",
  "created_at": "2026-03-01T00:00:00Z",
  "updated_at": "2026-03-15T09:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Care Due Date Calculation

**Purpose:** Compute the next due date for a non-watering care type using the same seasonal adjustment model as watering.

**Inputs:**
- care_type: string
- interval_days: integer (from CareScheduleConfig)
- last_performed: date
- seasonal_adjust: boolean
- active_seasons: array of season strings
- current_season: string (derived from current date and hemisphere)
- seasonal_multiplier: float (same as GD-002: spring=1.0, summer=1.5, fall=0.8, winter=0.5)

**Logic:**

```
1. IF current_season NOT IN active_seasons THEN
     RETURN { next_due: null, status: 'paused', reason: "Not active in [current_season]" }

2. IF seasonal_adjust is true THEN
     effective_interval = ROUND(interval_days / seasonal_multiplier)
     effective_interval = MAX(effective_interval, 1)
   ELSE
     effective_interval = interval_days

3. IF last_performed is not null THEN
     next_due = last_performed + effective_interval days
   ELSE
     next_due = today  // Never done before, due immediately

4. is_overdue = (next_due < today)
5. days_overdue = MAX(0, today - next_due)

6. RETURN { next_due, effective_interval, is_overdue, days_overdue, status: 'active' }
```

**Formulas:**
- `effective_interval = ROUND(interval_days / seasonal_multiplier)` when seasonal adjust is on
- `next_due = last_performed + effective_interval`
- Snooze: `new_scheduled_date = tomorrow` (does not change interval or last_performed)
- Skip: `last_performed = today` (resets countdown as if completed)

**Edge Cases:**
- Care type not active in current season (e.g., fertilizing in winter): task hidden from schedule, no notification
- Plant status is dormant: all care except watering is paused; watering follows GD-002 dormancy rules
- Plant status is dead or given away: all care tasks removed permanently
- Multiple care types due on the same day: all appear in the daily digest
- Custom one-time task: no recurrence calculation; appears only on scheduled_date, removed after completion or manual deletion
- Snoozing a task repeatedly: allowed up to 7 consecutive snoozes; after 7, the snooze button is disabled with message "This task has been snoozed 7 times. Complete or skip it."

##### Care Streak Calculation

**Purpose:** Compute the user's current streak of consecutive on-time care completions for a plant.

**Inputs:**
- care_events: array of CareEvent records for a plant, sorted by scheduled_date descending
- tolerance_days: integer (default: 1, meaning completing a task 1 day late still counts as on-time)

**Logic:**

```
1. SET streak = 0
2. FOR EACH event in care_events:
     IF event.outcome == 'completed' THEN
       IF event.completed_date <= event.scheduled_date + tolerance_days THEN
         streak = streak + 1
       ELSE
         BREAK (streak ended)
     ELSE IF event.outcome == 'skipped' THEN
       BREAK (streak ended)
     ELSE
       CONTINUE (ignore pending/snoozed)
3. RETURN streak
```

**Edge Cases:**
- No care events: streak is 0
- All events are on-time: streak equals total completed events
- First event was skipped: streak is 0

**Sort/Filter/Ranking Logic:**
- **Default sort (calendar):** By date ascending within the visible week/month
- **Default sort (task list):** Overdue first (most overdue at top), then today, then upcoming
- **Available filter options:** Care type (multi-select), Plant (dropdown), Outcome (completed, skipped, pending)
- **Search:** Not applicable for calendar view

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on care event completion | Toast: "Could not log care event. Please try again." | User taps "Done" again; task remains in pending state |
| Custom task name left blank | Inline validation: "Task name is required" | User fills in the field |
| Snooze limit reached (7 times) | Snooze button disabled; tooltip: "Snoozed 7 times. Complete or skip this task." | User completes or skips the task |
| Plant deleted while care events exist | Orphaned care events cleaned up on next schedule recalculation | No user action needed; events silently removed |
| Care config missing for a care type | Plant shows "Not scheduled" for that care type with "Set up" link | User taps "Set up" to configure the interval |
| Database read fails loading calendar | Inline error: "Could not load care schedule. Pull down to retry." | User pulls to refresh |

**Validation Timing:**
- Custom task name validation runs on blur
- Date validation runs on selection change
- Interval validation runs on blur

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a Monstera plant with fertilizing configured at 30-day intervals and last fertilized March 1,
   **When** the user views the Care Calendar on March 28,
   **Then** the calendar shows a fertilizing task on March 31 (30 days after last fertilized, adjusted for spring season multiplier 1.0).

2. **Given** 3 plants with various care tasks due today,
   **When** the user opens the Care Calendar,
   **Then** "Today's Tasks" shows all tasks grouped by care type, each with "Done", "Snooze", and "Skip" buttons.

3. **Given** the user taps "Done" on a fertilizing task for Monstera,
   **When** the care event is logged,
   **Then** the task animates out, a toast shows "Fertilizing logged for Monstera", the next fertilizing due date is recalculated, and the care streak increments by 1.

**Edge Cases:**

4. **Given** a plant with fertilizing active only in spring and summer,
   **When** the current season is winter,
   **Then** no fertilizing tasks appear for that plant, and the schedule config shows "Paused until spring".

5. **Given** a user has snoozed a pruning task 7 times,
   **When** they view the task on the 8th day,
   **Then** the "Snooze" button is disabled with a tooltip: "Snoozed 7 times. Complete or skip this task."

**Negative Tests:**

6. **Given** the user creates a custom task,
   **When** they leave the task name blank and tap "Save",
   **Then** inline validation shows: "Task name is required" and the task is not created.

7. **Given** a plant has been marked as dead,
   **When** the Care Calendar recalculates,
   **Then** all care tasks for that plant are removed from the schedule with no remaining pending events.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates fertilize due date (spring) | interval: 30, last: Mar 1, season: spring (1.0) | next_due: Mar 31 |
| applies seasonal adjust (summer) | interval: 30, last: Jun 1, season: summer (1.5) | next_due: Jun 21 (30/1.5=20 days) |
| applies seasonal adjust (winter) | interval: 30, last: Dec 1, season: winter (0.5) | next_due: Jan 30 (30/0.5=60 days) |
| pauses care in inactive season | active_seasons: [spring, summer], current: winter | status: paused |
| never performed returns due today | last_performed: null | next_due: today |
| calculates streak of 5 | 5 on-time completions followed by 1 skip | streak: 5 |
| streak broken by late completion | 3 on-time, 1 late (2 days past + 1 tolerance) | streak: 3 |
| validates custom task name required | care_type: custom, task_name: "" | Validation error |
| limits snooze to 7 times | snooze_count: 7 | snooze_allowed: false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete care task and verify recalculation | 1. Fertilize Monstera, 2. Log "Done", 3. Check schedule | Next fertilize date recalculated, care streak updated |
| Create custom task and complete | 1. Add "Stake tomato" due Mar 10, 2. Mark complete on Mar 10 | Task removed from calendar, care history shows completion |
| Season transition pauses fertilizing | 1. Fertilize config active spring/summer, 2. Season changes to fall | Fertilizing tasks stop appearing, "Paused until spring" shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User manages weekly care routine | 1. Configure fertilize (30d), prune (90d), repot (365d) for 5 plants, 2. View weekly calendar, 3. Complete all due tasks | Calendar updates, streaks increment, next due dates recalculate, daily digest notification for tomorrow lists remaining tasks |
| User adds and completes a custom task | 1. Add "Check for root binding" for Monstera due today, 2. Add note "Roots looking tight", 3. Mark done | Task disappears from calendar, appears in care history with note, no recurrence scheduled |

---

### GD-007: Companion Planting Matrix

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-007 |
| **Feature Name** | Companion Planting Matrix |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a backyard gardener, I want to see which of my plants grow well together and which should be kept apart, so that I can plan garden bed layouts that maximize beneficial relationships and avoid harmful ones.

**Secondary:**
> As a balcony grower with limited space, I want companion planting suggestions for container groupings, so that I can pair compatible plants in the same pot or adjacent containers.

#### 3.3 Detailed Description

The Companion Planting Matrix provides a reference database of plant-to-plant relationships: beneficial (grow well together), harmful (should be kept apart), and neutral (no significant interaction). Users can look up any pair of plants to see their compatibility and the reason behind it (e.g., "Basil repels aphids that attack tomatoes" or "Fennel inhibits growth of most nearby plants").

The matrix is presented as an interactive grid where the user's plants are listed along both axes. Each cell at the intersection of two plants shows a color-coded icon: green checkmark (beneficial), red X (harmful), or gray dash (neutral). Tapping a cell reveals the specific relationship details and gardening tips.

The bundled companion planting database covers approximately 80 common garden vegetables, herbs, and flowers with approximately 800 pairwise relationships. Relationships are symmetrical: if Tomato + Basil is "beneficial", then Basil + Tomato is also "beneficial". The database is read-only and bundled with the app; users cannot modify the built-in data but can add custom notes to any relationship.

When the user places plants in a garden bed (GD-004), the system automatically checks adjacent cells for companion planting conflicts. If two harmful companions are placed next to each other, a warning badge appears on the bed detail view. If beneficial companions are adjacent, a positive indicator is shown.

The companion planting checker also integrates with the Planting Calendar (GD-005) to suggest companion planting groups when planning seasonal beds. For example, when planning a summer bed, the system might suggest: "Tomato + Basil + Marigold is a classic companion trio: Basil repels aphids, Marigold deters nematodes."

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Matrix references the user's plants
- GD-018: Plant Care Database - Species identification for companion lookup
- GD-004: Garden Bed Mapping - Adjacency checks for placed plants (optional but enhances value)

**External Dependencies:**
- Bundled companion planting database (~800 relationships, ~200 KB)
- Local storage for custom user notes on relationships

**Assumed Capabilities:**
- Plant records exist with species references
- Species records map to the companion planting database

#### 3.5 User Interface Requirements

##### Screen: Companion Matrix

**Layout:**
- Top navigation bar displays "Companion Planting" title
- View mode toggle: "My Plants" | "Full Database"
- In "My Plants" mode: grid showing only the user's plants on both axes, filtered to species with companion data
- In "Full Database" mode: searchable alphabetical list of all ~80 species in the database, tapping a species shows its full compatibility list
- Grid cells: color-coded squares
  - Green (with checkmark): beneficial relationship
  - Red (with X): harmful relationship
  - Gray (with dash): neutral relationship
  - Diagonal cells (plant with itself): blacked out
- Row and column headers show plant names (truncated to 12 characters with ellipsis)
- Tapping a cell opens a detail popover showing:
  - Plant A name and Plant B name
  - Relationship type (Beneficial / Harmful / Neutral)
  - Reason text (e.g., "Basil repels aphids and improves tomato flavor")
  - User note field (editable, max 500 chars)
- Below the grid: "Companion Suggestions" card showing recommended plant pairings from the user's catalog
- Pinch-to-zoom on the grid if more than 10 plants shown

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No plants in catalog | Message: "Add plants to see companion planting recommendations" |
| No Matches | Plants exist but none have companion data | Message: "No companion planting data available for your plants. Try adding common vegetables or herbs." |
| Populated | 2+ plants with companion data | Interactive matrix grid |
| Full Database | User toggled to full database view | Alphabetical species list with search bar |

**Interactions:**
- Tap grid cell: opens detail popover with relationship info and user note field
- Tap row/column header: highlights the entire row/column for that plant
- Pinch-to-zoom: scales the grid (0.5x to 2.0x)
- Toggle "My Plants" / "Full Database": switches between filtered and complete views
- Search (full database): filters species list by name, substring matching
- Tap "Save Note" in popover: saves user's custom note to the relationship

**Transitions/Animations:**
- Cell tap: popover slides up from the bottom, 200ms
- Grid zoom: smooth pinch scaling
- Mode toggle: cross-fade between grid and list views, 200ms

#### 3.6 Data Requirements

##### Entity: CompanionRelationship (Bundled, Read-Only)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| species_a_id | TEXT (UUID) | Required, references Species.id | None | First species in the pair |
| species_b_id | TEXT (UUID) | Required, references Species.id | None | Second species in the pair |
| relationship | TEXT | One of: 'beneficial', 'harmful', 'neutral' | None | Compatibility classification |
| reason | TEXT | Required, max 500 chars | None | Explanation of why this relationship exists |
| category | TEXT | Optional, one of: 'pest_control', 'nutrient_sharing', 'growth_inhibition', 'pollination', 'shade_provision', 'allelopathy', 'other' | 'other' | Classification of the interaction mechanism |

##### Entity: CompanionNote (User-Created)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| relationship_id | TEXT (UUID) | Required, references CompanionRelationship.id | None | Which relationship this note is about |
| note | TEXT | Required, max 500 chars | None | User's personal observation or note |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- CompanionRelationship references Species twice (species_a_id, species_b_id)
- CompanionNote belongs to CompanionRelationship (many-to-one via relationship_id)
- Relationships are symmetrical: (A, B) and (B, A) are the same record

**Indexes:**
- CompanionRelationship: `(species_a_id, species_b_id)` UNIQUE - Prevent duplicate pairs
- CompanionRelationship: `species_a_id` - Look up all companions for a species
- CompanionRelationship: `species_b_id` - Look up all companions for a species (reverse)
- CompanionRelationship: `relationship` - Filter by beneficial/harmful/neutral

**Validation Rules:**
- `species_a_id` must be different from `species_b_id` (no self-relationships)
- `species_a_id` < `species_b_id` (lexicographic ordering to enforce a canonical pair direction and prevent duplicates)
- `note`: Must not be empty after trimming if provided
- CompanionRelationship records are read-only; users cannot create, edit, or delete them

**Example Data:**

```json
{
  "id": "cr-tomato-basil-001",
  "species_a_id": "sp-basil-001",
  "species_b_id": "sp-tomato-001",
  "relationship": "beneficial",
  "reason": "Basil repels aphids and whiteflies that attack tomatoes. Some gardeners also report improved tomato flavor when grown near basil.",
  "category": "pest_control"
}
```

```json
{
  "id": "cr-fennel-tomato-001",
  "species_a_id": "sp-fennel-001",
  "species_b_id": "sp-tomato-001",
  "relationship": "harmful",
  "reason": "Fennel secretes substances from its roots that inhibit the growth of most nearby plants, including tomatoes.",
  "category": "allelopathy"
}
```

#### 3.7 Business Logic Rules

##### Companion Lookup

**Purpose:** Find the companion relationship between two species.

**Inputs:**
- species_a_id: UUID
- species_b_id: UUID

**Logic:**

```
1. NORMALIZE pair ordering:
     IF species_a_id > species_b_id THEN SWAP(species_a_id, species_b_id)
2. QUERY CompanionRelationship WHERE
     species_a_id = normalized_a AND species_b_id = normalized_b
3. IF found THEN RETURN relationship record
4. ELSE RETURN { relationship: 'neutral', reason: 'No known interaction between these species.' }
```

**Edge Cases:**
- Species pair not in the database: treated as neutral (no data, not confirmed neutral)
- One or both plants have no species_id: cannot look up companions, show "Species unknown - set species to see companions"
- Same species paired (e.g., two tomato plants): show "Same species - neutral" (plants of the same species can grow together)

##### Garden Bed Adjacency Check

**Purpose:** Scan a garden bed for companion planting conflicts and recommendations.

**Inputs:**
- bed_id: UUID
- layer_id: UUID (the active layer)

**Logic:**

```
1. QUERY all BedCell records for the given layer_id
2. FOR EACH occupied cell, find adjacent cells (up, down, left, right, and 4 diagonals = 8 neighbors)
3. FOR EACH pair of adjacent occupied cells:
     LOOKUP companion relationship between the two plants' species
     IF relationship == 'harmful' THEN
       ADD to conflicts list: { plant_a, plant_b, cell_a, cell_b, reason }
     ELSE IF relationship == 'beneficial' THEN
       ADD to synergies list: { plant_a, plant_b, cell_a, cell_b, reason }
4. RETURN { conflicts: [...], synergies: [...] }
```

**Formulas:**
- Adjacent cells: cells at (row +/- 1, col +/- 1) within grid bounds
- Total adjacency checks: up to 8 neighbors per cell, deduplicated (each pair checked once)

**Edge Cases:**
- Corner cells have 3 neighbors, edge cells have 5, interior cells have 8
- Plant with no species_id: skipped in adjacency check (cannot look up companion data)
- Same plant in multiple cells (via plan layers): adjacency checks still run (the relationship with itself is neutral)
- Empty cells: skipped
- Bed with only 1 occupied cell: no adjacency checks, return empty conflicts and synergies

##### Companion Suggestion Generator

**Purpose:** Suggest beneficial companion groupings from the user's plant catalog.

**Inputs:**
- user_plant_species: array of species_ids from the user's catalog

**Logic:**

```
1. QUERY all CompanionRelationship WHERE relationship == 'beneficial'
     AND (species_a_id IN user_plant_species OR species_b_id IN user_plant_species)
2. GROUP into triads: find sets of 3 species where all 3 pairs are mutually beneficial
3. SORT triads by number of beneficial pairs (descending), then alphabetically
4. LIMIT to top 5 suggestions
5. FOR EACH suggestion, provide a summary reason combining individual pair reasons
6. RETURN suggestions array
```

**Edge Cases:**
- Fewer than 2 plants: return empty suggestions with message "Add more plants to get companion suggestions"
- No beneficial relationships found: return message "No companion planting suggestions available for your current plants"
- All plants are mutually harmful: return conflicts only with recommendation to separate them

**Sort/Filter/Ranking Logic:**
- **Default sort (matrix):** Plants sorted alphabetically by common name
- **Available sort options (matrix):** Name A-Z, Name Z-A, Most Companions, Most Conflicts
- **Filter options:** Relationship type (beneficial, harmful, neutral), Category (pest control, nutrient sharing, etc.)
- **Search (full database):** Searches species common name and scientific name, substring match, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Companion database not loaded | Error banner: "Companion planting data could not be loaded. Restart the app." | User restarts app; data loads from bundled asset |
| Plant has no species assigned | Cell in matrix shows "?" with tooltip: "Set species to see companion data" | User navigates to plant detail and selects a species |
| Note save fails | Toast: "Could not save note. Please try again." | User retries |
| Grid too large to render (>20 plants) | Grid switches to paginated view (10 plants per page) with page controls | User navigates pages or uses search |
| Adjacency check fails on bed | Toast: "Could not check companion compatibility. Try again." | User refreshes bed detail view |

**Validation Timing:**
- Note validation runs on save attempt
- Species validation is checked on matrix load

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has Tomato, Basil, and Fennel in their catalog with species assigned,
   **When** they open the Companion Matrix in "My Plants" mode,
   **Then** a 3x3 grid shows: Tomato-Basil = green (beneficial), Tomato-Fennel = red (harmful), Basil-Fennel = gray (neutral).

2. **Given** the user taps the Tomato-Basil cell,
   **When** the detail popover opens,
   **Then** it shows "Beneficial" with reason "Basil repels aphids and whiteflies that attack tomatoes" and an empty note field.

3. **Given** a garden bed with Tomato at (0,0) and Fennel at (0,1),
   **When** the adjacency check runs,
   **Then** a warning badge appears on the bed detail with "1 conflict: Tomato and Fennel are harmful companions."

**Edge Cases:**

4. **Given** a plant with no species assigned,
   **When** the user views the Companion Matrix,
   **Then** that plant's row and column show "?" in every cell with a tooltip "Set species to see companion data."

5. **Given** the user's catalog has 25 plants with companion data,
   **When** they view the matrix,
   **Then** the grid paginates to show 10 plants per page with page navigation controls.

**Negative Tests:**

6. **Given** the user tries to edit a CompanionRelationship record,
   **When** they attempt any modification,
   **Then** the system prevents it - the built-in database is read-only.

7. **Given** only 1 plant in the catalog,
   **When** the user opens the Companion Matrix,
   **Then** the suggestions section shows: "Add more plants to get companion suggestions."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| finds beneficial relationship | species_a: tomato, species_b: basil | relationship: beneficial |
| finds harmful relationship | species_a: fennel, species_b: tomato | relationship: harmful |
| returns neutral for unknown pair | species_a: unknown_1, species_b: unknown_2 | relationship: neutral (default) |
| normalizes pair ordering | lookup(tomato, basil) vs lookup(basil, tomato) | Same result |
| identifies adjacent cells correctly | cell (2,3) in 8x8 grid | 8 neighbors: (1,2), (1,3), (1,4), (2,2), (2,4), (3,2), (3,3), (3,4) |
| handles corner cell adjacency | cell (0,0) in 4x4 grid | 3 neighbors: (0,1), (1,0), (1,1) |
| detects bed conflict | tomato at (0,0), fennel at (0,1) | 1 conflict |
| detects bed synergy | tomato at (0,0), basil at (0,1) | 1 synergy |
| generates companion suggestions | 3 mutually beneficial species | 1 triad suggestion |
| handles empty catalog | no plants | empty suggestions with message |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| View matrix with 5 plants | 1. Add 5 plants with species, 2. Open Companion Matrix | 5x5 grid with correct color coding for each pair |
| Add note to relationship | 1. Tap Tomato-Basil cell, 2. Enter note "Planted together last year, great results", 3. Save | Note persists; reopening the cell shows the saved note |
| Bed adjacency warning | 1. Create bed, 2. Place Tomato and Fennel in adjacent cells, 3. View bed | Warning badge visible on bed detail |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User plans a companion planting bed | 1. View companion suggestions, 2. See "Tomato + Basil + Marigold" suggestion, 3. Create bed, 4. Place all 3 adjacent | Bed shows 3 synergy indicators, 0 conflict warnings, companion matrix confirms all pairs green |
| User discovers and resolves a conflict | 1. Place Tomato and Fennel adjacent in bed, 2. See conflict warning, 3. Move Fennel to opposite end of bed, 4. Recheck | Conflict warning cleared, Fennel is no longer adjacent to Tomato |

---

### GD-008: Harvest Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-008 |
| **Feature Name** | Harvest Tracking |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a backyard gardener, I want to log each harvest from my edible plants with the weight, date, and an optional photo, so that I can track total yields over the season and compare year-over-year production.

**Secondary:**
> As a meal planner, I want to see what I have harvested recently so I can plan meals around my freshest ingredients and connect harvests to recipes in MyRecipes.

#### 3.3 Detailed Description

Harvest Tracking allows users to log individual harvest events for edible plants (vegetables, herbs, fruits). Each harvest record captures the plant, date, weight or quantity, quality assessment, and an optional photo. Over time, the system aggregates this data into seasonal and yearly yield summaries.

A harvest log entry records: which plant was harvested (linked to a Plant record from GD-001), the date, the weight in grams or ounces (user-configurable unit preference), an optional count for countable items (e.g., "12 tomatoes"), a quality rating from 1 to 5 (1 = poor/damaged, 5 = excellent), and an optional photo and note.

The harvest dashboard shows a summary of the current season's production: total weight harvested (e.g., "42.5 lbs this season"), number of harvests logged, top-producing plant (by weight), and a bar chart showing weight harvested per month. Users can drill into per-plant harvest histories and compare production across years.

Yield efficiency is computed as:

```
yield_per_plant = total_harvest_weight / number_of_plants_of_that_species
yield_per_sqft = total_harvest_weight / garden_bed_area_occupied (if bed mapping data exists)
```

The harvest tracking system integrates with the MyRecipes module (cross-module integration) by providing a "garden-to-table" link. When a user logs a harvest of tomatoes, MyRecipes can surface tomato recipes with an "Available: 2.5 lbs fresh from garden" badge. This integration is optional and only active when both modules are enabled.

Each harvest entry includes a quality assessment on a 1-5 scale:

| Score | Label | Description |
|-------|-------|-------------|
| 1 | Poor | Significant damage, disease, or pest issues; barely usable |
| 2 | Below Average | Minor damage or issues; usable with trimming |
| 3 | Average | Normal quality; typical for the variety |
| 4 | Good | Above average size, color, or flavor |
| 5 | Excellent | Outstanding specimen; best of the harvest |

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Harvests reference plant records
- GD-004: Garden Bed Mapping - Optional, used for yield-per-sqft calculations

**External Dependencies:**
- Camera/photo library access for harvest photos (optional)
- Local storage for harvest records and photos
- File system access for photo storage

**Assumed Capabilities:**
- Plant records exist for edible plants
- User has configured weight unit preference (grams/ounces/pounds)

#### 3.5 User Interface Requirements

##### Screen: Harvest Dashboard

**Layout:**
- Top navigation bar displays "Harvests" title with a season selector dropdown (e.g., "Spring 2026", "Summer 2026", "2026 Full Year")
- Summary card at top showing: total weight harvested (large number with unit), total harvest count, top producer plant name and weight, average quality rating
- Below summary: horizontal bar chart showing weight harvested per month for the selected period
- Below chart: scrollable list of recent harvest entries, newest first
- Each harvest row: plant photo thumbnail (40x40px), plant name, harvest date, weight with unit (e.g., "1.2 lbs"), quality dots (filled/empty to show rating out of 5), and harvest photo thumbnail (if present)
- Floating action button: "Log Harvest" (plus icon with leaf)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No harvests logged | Centered illustration of a basket, heading "No harvests yet", subtext "Log your first harvest to start tracking yields", button "Log Harvest" |
| Loading | Querying harvest data | Skeleton placeholders for summary card and 4 list items |
| Populated | 1+ harvests logged | Summary card, chart, and harvest list |
| Filtered | Season/year filter applied | Data scoped to selected period; empty filtered state shows "No harvests in [period]" |

**Interactions:**
- Tap "Log Harvest" FAB: opens Log Harvest modal
- Tap harvest row: opens Harvest Detail with full photo, notes, quality, and edit/delete options
- Tap a bar in the monthly chart: filters list to show only harvests from that month
- Swipe left on harvest row: reveals "Delete" action
- Pull-to-refresh: reloads harvest data
- Tap season selector: dropdown to select viewing period

**Transitions/Animations:**
- New harvest: row slides in from the right, 200ms
- Chart bar tap: bar highlights with a bounce, list filters with a fade transition

##### Modal: Log Harvest

**Layout:**
- Title: "Log Harvest"
- Plant picker: searchable dropdown of edible plants from catalog (filtered to alive/outdoor plants by default, toggle to show all)
- Date: date picker, defaults to today, max today, min 365 days ago
- Weight: numeric input with unit selector (g, oz, lb, kg)
- Count: optional integer input, min 1, max 10000 (e.g., "12 tomatoes")
- Quality: 1-5 star-style rating selector (tap to set)
- Photo: camera/library picker (optional), max 1 photo
- Notes: multiline text input, optional, max 500 chars
- "Save" and "Cancel" buttons

**Interactions:**
- Save: creates Harvest record, updates dashboard totals, closes modal
- Cancel: dismisses without saving
- Tapping photo area: shows camera/library picker

#### 3.6 Data Requirements

##### Entity: Harvest

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Which plant was harvested |
| harvest_date | TEXT | ISO 8601 date, required | Current date | When the harvest occurred |
| weight_grams | REAL | Required, min 0.1, max 1000000 | None | Harvest weight in grams (canonical unit) |
| count | INTEGER | Optional, min 1, max 10000 | null | Number of items harvested (for countable produce) |
| quality_rating | INTEGER | Required, min 1, max 5 | 3 | Quality assessment (1=poor, 5=excellent) |
| photo_path | TEXT | Optional | null | Local file path to the harvest photo |
| notes | TEXT | Optional, max 500 chars | null | User notes about this harvest |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Harvest belongs to Plant (many-to-one via plant_id)

**Indexes:**
- `(plant_id, harvest_date DESC)` - Per-plant harvest history
- `harvest_date` - Date range queries for dashboard charts
- `quality_rating` - Filter by quality

**Validation Rules:**
- `weight_grams`: Must be positive, between 0.1 and 1,000,000 (1 metric ton max)
- `harvest_date`: Must not be in the future; must not be more than 365 days in the past
- `quality_rating`: Integer between 1 and 5
- `plant_id`: Must reference an existing Plant record
- Weight is always stored in grams; display conversion happens at the UI layer

**Example Data:**

```json
{
  "id": "hvst-001-tomato-2026",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "harvest_date": "2026-07-15",
  "weight_grams": 680.4,
  "count": 4,
  "quality_rating": 4,
  "photo_path": "/data/garden/photos/harvest/hvst-001.jpg",
  "notes": "First tomatoes of the season! Beautiful red color.",
  "created_at": "2026-07-15T10:30:00Z",
  "updated_at": "2026-07-15T10:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Yield Calculation

**Purpose:** Compute harvest yield metrics for a plant or the entire garden.

**Inputs:**
- harvests: array of Harvest records for the scope (per-plant or all)
- plant_count: integer (number of plants of the same species, for per-plant yield)
- bed_area_sqft: float (optional, from GardenBed dimensions, for yield-per-sqft)

**Logic:**

```
1. total_weight_grams = SUM(harvests.weight_grams)
2. total_count = SUM(harvests.count) where count is not null
3. harvest_count = LENGTH(harvests)
4. avg_quality = SUM(harvests.quality_rating) / harvest_count

5. IF plant_count > 0 THEN
     yield_per_plant_grams = total_weight_grams / plant_count
   ELSE
     yield_per_plant_grams = total_weight_grams

6. IF bed_area_sqft > 0 THEN
     yield_per_sqft_grams = total_weight_grams / bed_area_sqft
   ELSE
     yield_per_sqft_grams = null (not calculable)

7. RETURN {
     total_weight_grams,
     total_count,
     harvest_count,
     avg_quality (rounded to 1 decimal),
     yield_per_plant_grams,
     yield_per_sqft_grams
   }
```

**Formulas:**
- `yield_per_plant = total_harvest_weight / number_of_plants_of_species`
- `yield_per_sqft = total_harvest_weight / bed_area_sqft`
- `avg_quality = sum(quality_ratings) / harvest_count`

**Edge Cases:**
- No harvests: all metrics return 0 or null
- Division by zero (plant_count = 0): use total weight as yield per plant
- Bed area not available (no bed mapping): yield_per_sqft is null, not displayed
- Mixed units in display: always store grams, convert at display time (1 oz = 28.3495g, 1 lb = 453.592g, 1 kg = 1000g)

##### Weight Conversion

**Purpose:** Convert between weight units for display.

**Inputs:**
- weight_grams: float
- target_unit: enum ('g', 'oz', 'lb', 'kg')

**Logic:**

```
1. SWITCH target_unit:
     'g':  display_weight = weight_grams
     'oz': display_weight = weight_grams / 28.3495
     'lb': display_weight = weight_grams / 453.592
     'kg': display_weight = weight_grams / 1000
2. ROUND display_weight to 1 decimal place
3. RETURN { value: display_weight, unit: target_unit }
```

**Edge Cases:**
- Very small weights (< 1g): display as "< 1g" or exact decimal
- Very large weights (> 100 kg): display with no decimal (e.g., "105 kg")

##### Season Determination for Harvest Grouping

**Purpose:** Group harvests by growing season for year-over-year comparison.

**Logic:**

```
1. A growing season spans from last frost date to first frost date
2. IF harvest_date falls between last_frost and first_frost THEN
     season = "Growing Season [year]"
   ELSE
     season = "Off-Season [year]"
3. IF zone 11-13 (year-round) THEN
     season = "Year [year]" (no seasonal distinction)
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Newest harvest first (harvest_date descending)
- **Available sort options:** Newest First, Oldest First, Heaviest First, Highest Quality First, By Plant Name
- **Filter options:** Plant (dropdown), Season/Year, Quality Rating (min threshold), Date Range
- **Search:** Not applicable for harvest view

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on harvest save | Toast: "Could not save harvest. Please try again." | User retries; form data preserved |
| Photo save fails (storage full) | Toast: "Could not save photo. Harvest saved without photo." | Harvest record created without photo; user can add photo later via edit |
| Weight field left blank | Inline validation: "Weight is required" | User enters weight |
| Weight is zero or negative | Inline validation: "Weight must be greater than 0" | User corrects value |
| Plant deleted after harvest exists | Harvest shown with "[Deleted Plant]" label; harvest data preserved | User can delete orphaned harvests manually |
| Date in the future | Inline validation: "Harvest date cannot be in the future" | User selects valid date |

**Validation Timing:**
- Weight validation runs on blur
- Date validation runs on selection change
- Quality rating validates immediately on tap
- Plant picker validates on form submit

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has a "Cherry Tomato" plant in the catalog,
   **When** they tap "Log Harvest", select "Cherry Tomato", enter 340g, count 12, quality 4, and save,
   **Then** the harvest dashboard shows 1 harvest, total weight 340g (or 12.0 oz if using ounces), and the harvest appears in the recent list.

2. **Given** 10 tomato harvests logged over 3 months totaling 5,200g,
   **When** the user views the harvest dashboard for "Summer 2026",
   **Then** the summary shows total 5,200g (11.5 lbs), 10 harvests, average quality, and the bar chart shows weight per month.

3. **Given** 2 tomato plants in a 4x8ft bed (32 sqft) with total harvest 5,200g,
   **When** the user views yield stats,
   **Then** yield per plant shows 2,600g and yield per sqft shows 162.5g.

**Edge Cases:**

4. **Given** a harvest logged for a plant that is later deleted,
   **When** the user views the harvest dashboard,
   **Then** the harvest shows "[Deleted Plant]" as the name and all data is preserved.

5. **Given** the user's preferred unit is pounds,
   **When** they log a harvest of 454g,
   **Then** the display shows "1.0 lb" and the stored value remains 454 grams.

**Negative Tests:**

6. **Given** the user tries to log a harvest with weight 0,
   **When** they tap "Save",
   **Then** validation shows: "Weight must be greater than 0" and the harvest is not created.

7. **Given** the user selects a harvest date of tomorrow,
   **When** they tap "Save",
   **Then** validation shows: "Harvest date cannot be in the future" and the harvest is not created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts grams to ounces | 340g | 12.0 oz |
| converts grams to pounds | 453.592g | 1.0 lb |
| converts grams to kilograms | 2500g | 2.5 kg |
| calculates yield per plant | total: 5200g, plant_count: 2 | 2600g per plant |
| calculates yield per sqft | total: 5200g, area: 32 sqft | 162.5g per sqft |
| handles null bed area | total: 5200g, area: null | yield_per_sqft: null |
| calculates average quality | ratings: [4, 3, 5, 4] | avg: 4.0 |
| handles zero harvests | harvests: [] | all metrics: 0 or null |
| rejects future harvest date | date: tomorrow | Validation error |
| rejects zero weight | weight: 0 | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log harvest and verify dashboard | 1. Log 340g tomato harvest, 2. View dashboard | Summary shows 340g total, 1 harvest, harvest in list |
| Delete plant and verify harvest preserved | 1. Log harvest for Basil, 2. Delete Basil plant, 3. View harvests | Harvest shows "[Deleted Plant]", weight data intact |
| Season filter shows correct data | 1. Log harvests in June and October, 2. Filter to "Summer 2026" | Only June harvest shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks a season of tomato harvests | 1. Log 10 harvests over 3 months (varying weights, qualities), 2. View dashboard, 3. View per-plant stats | Dashboard shows total yield, monthly chart, top producer, average quality, yield per plant and per sqft if bed data exists |
| User compares year-over-year yields | 1. Log harvests in 2025 season, 2. Log harvests in 2026 season, 3. Compare years | Both years' data visible, user can switch between season views |

---

### GD-009: Pest and Disease Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-009 |
| **Feature Name** | Pest and Disease Log |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a gardener, I want to log pest sightings and disease symptoms on my plants with photos and descriptions, so that I can track recurring problems and remember what treatments worked.

**Secondary:**
> As a multi-year gardener, I want to see pest and disease history across seasons, so that I can identify patterns (e.g., aphids every June) and take preventive action.

#### 3.3 Detailed Description

The Pest and Disease Log provides a structured way to record observations of pests, diseases, and other plant health issues. Each observation includes which plant is affected, the date, the type of problem (pest or disease), a severity rating, a photo for visual documentation, the treatment applied, and the outcome.

The system maintains a bundled reference list of approximately 50 common garden pests (aphids, spider mites, whiteflies, slugs, etc.) and 30 common plant diseases (powdery mildew, root rot, blight, etc.). Each reference entry includes a description, common symptoms, affected plant types, and suggested organic and chemical treatments. Users select from this list when logging an observation, or they can enter a custom pest/disease name if the issue is not in the database.

Observations follow a lifecycle: the user first records the sighting ("Observed"), then logs a treatment ("Treated"), and finally records the outcome ("Resolved" or "Ongoing"). Multiple treatments can be logged for a single observation if the first treatment does not work.

The log view shows all observations across all plants, filterable by plant, pest/disease type, severity, and status. A "Common Issues" card on the dashboard highlights the most frequent problems in the user's garden with tips to prevent recurrence.

Severity ratings use a 1-5 scale:

| Level | Label | Description |
|-------|-------|-------------|
| 1 | Minor | A few pests or small disease spot; cosmetic damage only |
| 2 | Low | Noticeable presence; some leaf damage but plant vigor unaffected |
| 3 | Moderate | Significant presence; visible damage to multiple leaves or stems |
| 4 | Severe | Heavy infestation or widespread disease; plant growth impaired |
| 5 | Critical | Plant survival threatened; immediate intervention required |

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Observations reference plant records
- GD-014: Plant Health Scoring - Pest data feeds into health score calculation (optional)

**External Dependencies:**
- Camera/photo library access for observation photos
- Local storage for observation records, treatment logs, and photos
- Bundled pest/disease reference database (~80 entries, ~100 KB)

**Assumed Capabilities:**
- Plant records exist in the catalog
- Camera permissions available for photo documentation

#### 3.5 User Interface Requirements

##### Screen: Pest & Disease Log

**Layout:**
- Top navigation bar displays "Pest & Disease Log" title with a status filter toggle: "Active" (default) | "Resolved" | "All"
- Summary card: total active issues (large number), most common pest/disease name, plants affected count
- Below summary: scrollable list of observations, newest first
- Each observation row: severity dot (color-coded: green=1, yellow=2-3, orange=4, red=5), plant photo thumbnail (40x40px), plant name, pest/disease name, status badge (Observed/Treated/Resolved/Ongoing), date, and observation photo thumbnail (if present)
- Floating action button: "Log Issue" (plus icon with bug)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No observations logged | Centered illustration (healthy leaf), heading "No issues logged", subtext "Your garden is looking healthy! Log any problems here when they arise.", no action button needed |
| Loading | Querying observation data | Skeleton placeholders for summary and 4 list items |
| Populated | 1+ observations | Summary card and observation list |
| Filtered | Status or plant filter applied | Filtered subset; empty filter state shows "No [status] issues" |

**Interactions:**
- Tap "Log Issue" FAB: opens Log Observation modal
- Tap observation row: opens Observation Detail with full history, photos, treatments
- Tap status filter: toggles between Active/Resolved/All
- Swipe left on row: reveals "Delete" action
- Pull-to-refresh: reloads log

**Transitions/Animations:**
- New observation: row slides in from the top, 200ms
- Status change (Resolved): row animates with a green flash and slides to resolved section

##### Modal: Log Observation

**Layout:**
- Title: "Log Issue"
- Plant picker: searchable dropdown of all plants
- Issue type: segmented control - "Pest" | "Disease" | "Other"
- Pest/Disease picker: searchable list from bundled reference database, with "Custom" option at the bottom
- Custom name: text input (shown only when "Custom" is selected), max 100 chars
- Severity: 1-5 slider with color-coded labels (Minor to Critical)
- Affected area: multi-select chips - "Leaves", "Stems", "Roots", "Flowers", "Fruit", "Whole Plant"
- Photo: camera/library picker, up to 3 photos
- Notes: multiline text input, optional, max 1000 chars (for describing symptoms in detail)
- "Save" and "Cancel" buttons

##### Modal: Log Treatment

**Layout:**
- Title: "Log Treatment for [Pest/Disease Name]"
- Treatment type: dropdown - "Organic Spray", "Chemical Pesticide", "Manual Removal", "Pruning", "Quarantine", "Environmental Change", "Other"
- Product name: text input, optional, max 200 chars (e.g., "Neem oil", "Diatomaceous earth")
- Application notes: multiline text, optional, max 500 chars
- Date: date picker, defaults to today
- "Save" and "Cancel" buttons

##### Screen: Observation Detail

**Layout:**
- Header with plant name, pest/disease name, severity badge, status badge
- Photo gallery: horizontal scrollable photos from the observation
- Symptoms section: affected areas listed, notes
- Treatment timeline: vertical timeline of treatments applied, each showing date, type, product, and notes
- "Log Treatment" button
- "Mark Resolved" button (shown for active observations)
- "Mark Ongoing" button (shown for treated observations where issue persists)
- Reference info card: if pest/disease is from the bundled database, shows description, common symptoms, and suggested treatments

#### 3.6 Data Requirements

##### Entity: PestObservation

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Affected plant |
| issue_type | TEXT | One of: 'pest', 'disease', 'other' | None | Category of the problem |
| pest_disease_id | TEXT (UUID) | Optional, references PestDiseaseRef.id | null | Reference to bundled pest/disease database entry |
| custom_name | TEXT | Optional, max 100 chars | null | User-entered name if not in reference database |
| severity | INTEGER | Required, min 1, max 5 | 3 | Severity rating |
| affected_areas | TEXT | Comma-separated: 'leaves,stems,roots,flowers,fruit,whole_plant' | None | Parts of the plant affected |
| status | TEXT | One of: 'observed', 'treated', 'resolved', 'ongoing' | 'observed' | Current status of the issue |
| observed_date | TEXT | ISO 8601 date, required | Current date | When the issue was first noticed |
| resolved_date | TEXT | ISO 8601 date, optional | null | When the issue was resolved |
| notes | TEXT | Optional, max 1000 chars | null | Detailed symptoms description |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

##### Entity: PestPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| observation_id | TEXT (UUID) | Required, references PestObservation.id | None | Parent observation |
| photo_path | TEXT | Required | None | Local file path to the photo |
| sort_order | INTEGER | Min 0 | 0 | Display order within the observation |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: Treatment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| observation_id | TEXT (UUID) | Required, references PestObservation.id | None | Which observation this treatment addresses |
| treatment_type | TEXT | One of: 'organic_spray', 'chemical_pesticide', 'manual_removal', 'pruning', 'quarantine', 'environmental_change', 'other' | None | Category of treatment |
| product_name | TEXT | Optional, max 200 chars | null | Name of product used |
| application_notes | TEXT | Optional, max 500 chars | null | Details of how treatment was applied |
| treatment_date | TEXT | ISO 8601 date, required | Current date | When treatment was applied |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: PestDiseaseRef (Bundled, Read-Only)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| name | TEXT | Required | None | Common name (e.g., "Aphids") |
| type | TEXT | One of: 'pest', 'disease' | None | Category |
| description | TEXT | Required | None | What this pest/disease is |
| symptoms | TEXT | Required | None | How to identify it |
| affected_plant_types | TEXT | Comma-separated | None | Plant types commonly affected |
| organic_treatments | TEXT | Required | None | Organic treatment options |
| chemical_treatments | TEXT | Required | None | Chemical treatment options |
| prevention_tips | TEXT | Required | None | How to prevent this issue |

**Relationships:**
- PestObservation belongs to Plant (many-to-one via plant_id)
- PestObservation optionally references PestDiseaseRef (many-to-one via pest_disease_id)
- PestObservation has many PestPhoto (one-to-many via observation_id)
- PestObservation has many Treatment (one-to-many via observation_id)

**Indexes:**
- PestObservation: `(plant_id, observed_date DESC)` - Per-plant issue history
- PestObservation: `status` - Filter active vs resolved
- PestObservation: `(pest_disease_id, observed_date)` - Track recurrence of specific issues
- Treatment: `observation_id` - Find treatments for an observation
- PestPhoto: `observation_id` - Find photos for an observation

**Validation Rules:**
- Either `pest_disease_id` or `custom_name` must be provided (not both null)
- `severity`: Integer between 1 and 5
- `observed_date`: Must not be in the future
- `resolved_date`: Must be on or after `observed_date`
- `affected_areas`: Must contain at least one valid area
- `treatment_date`: Must not be before `observed_date`
- Max 3 photos per observation

**Example Data:**

```json
{
  "id": "po-001-aphids-monstera",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "issue_type": "pest",
  "pest_disease_id": "ref-aphids-001",
  "custom_name": null,
  "severity": 3,
  "affected_areas": "leaves,stems",
  "status": "treated",
  "observed_date": "2026-03-01",
  "resolved_date": null,
  "notes": "Found clusters of green aphids on undersides of leaves, especially near new growth.",
  "created_at": "2026-03-01T14:00:00Z",
  "updated_at": "2026-03-05T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Observation Status Transitions

**Purpose:** Control valid state changes for pest/disease observation lifecycle.

**Inputs:**
- current_status: enum ('observed', 'treated', 'resolved', 'ongoing')
- new_status: enum ('observed', 'treated', 'resolved', 'ongoing')

**Logic:**

```
VALID_TRANSITIONS = {
  'observed' -> ['treated', 'resolved'],
  'treated'  -> ['resolved', 'ongoing'],
  'ongoing'  -> ['treated', 'resolved'],
  'resolved' -> ['ongoing'] (issue can recur)
}

1. IF new_status == current_status THEN RETURN no-op
2. IF new_status NOT IN VALID_TRANSITIONS[current_status] THEN
     RETURN error: "Cannot change from [current] to [new]"
3. IF new_status == 'treated' THEN
     REQUIRE at least 1 Treatment record for this observation
4. IF new_status == 'resolved' THEN
     SET resolved_date = today (or user-provided date)
5. IF new_status == 'ongoing' AND current_status == 'resolved' THEN
     CLEAR resolved_date (issue has recurred)
6. UPDATE observation status
```

**Edge Cases:**
- Moving to "treated" without a treatment record: rejected with "Log a treatment first"
- Resolved issue recurring: status changes back to "ongoing", resolved_date cleared
- Plant dies while issue is active: observation remains for historical reference

##### Recurrence Detection

**Purpose:** Identify recurring pest/disease issues for a plant or across the garden.

**Inputs:**
- plant_id: UUID (optional, null for garden-wide)
- lookback_months: integer (default: 24)

**Logic:**

```
1. QUERY PestObservations WHERE
     observed_date >= today - lookback_months months
     AND (plant_id = input_plant_id OR input_plant_id is null)
2. GROUP BY pest_disease_id (or custom_name)
3. FOR EACH group:
     occurrence_count = COUNT(observations)
     IF occurrence_count >= 2 THEN
       ADD to recurrences: {
         pest_disease_name,
         occurrence_count,
         plants_affected: DISTINCT(plant_id) count,
         avg_severity,
         most_common_month: MODE(MONTH(observed_date)),
         most_effective_treatment: most common treatment_type among resolved observations
       }
4. SORT recurrences by occurrence_count descending
5. RETURN recurrences
```

**Edge Cases:**
- No recurrences: return empty with message "No recurring issues detected"
- Custom-named issues: grouped by exact custom_name match (case-insensitive)
- Issues with no pest_disease_id and no custom_name: skipped

**Sort/Filter/Ranking Logic:**
- **Default sort:** Newest observation first (observed_date descending)
- **Available sort options:** Newest First, Oldest First, Severity (highest first), Status
- **Filter options:** Status (observed, treated, resolved, ongoing), Issue Type (pest, disease, other), Plant (dropdown), Severity (min threshold), Date Range
- **Search:** Searches pest/disease name (reference and custom), plant name, notes; substring match; case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on observation save | Toast: "Could not save observation. Please try again." | User retries; form data preserved |
| Photo save fails | Toast: "Could not save photo. Observation saved without this photo." | Observation created; user can add photo later |
| No pest/disease selected and no custom name | Inline validation: "Select a pest/disease or enter a custom name" | User selects from list or types custom name |
| Treatment logged before observation exists | Not possible - treatment form only accessible from an existing observation | N/A |
| Attempting to mark as treated without a treatment | Toast: "Log a treatment before marking as treated" | User logs a treatment first |
| Bundled reference database fails to load | Log shows custom-only mode; reference picker replaced with free-text | User types pest/disease name manually |

**Validation Timing:**
- Pest/disease selection validates on form submit
- Severity validates immediately on slider change
- Date validation runs on selection change
- Photo count validates when adding (max 3 enforced at picker level)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user notices aphids on their Monstera,
   **When** they tap "Log Issue", select Monstera, choose "Pest", select "Aphids" from the reference list, set severity 3, select "Leaves" and "Stems", take a photo, and save,
   **Then** the observation appears in the log with status "Observed", severity 3, and the photo is stored locally.

2. **Given** an active aphid observation,
   **When** the user taps the observation, taps "Log Treatment", selects "Organic Spray", enters "Neem oil", and saves,
   **Then** the treatment appears in the observation's timeline, and the user is prompted to update status to "Treated".

3. **Given** 3 aphid observations over 2 years on different plants,
   **When** the user views the "Common Issues" card,
   **Then** aphids appear as a recurring issue with occurrence count 3, plants affected count, and the most common treatment listed.

**Edge Cases:**

4. **Given** a resolved aphid observation from last month,
   **When** the user marks it as "Ongoing" (recurrence),
   **Then** the resolved_date is cleared, the observation reappears in the "Active" filter, and the recurrence counter increments.

5. **Given** a pest not in the bundled database,
   **When** the user selects "Custom" and enters "Unknown beetle",
   **Then** the observation is saved with custom_name "Unknown beetle" and no reference link.

**Negative Tests:**

6. **Given** the user tries to mark an observation as "Treated",
   **When** no treatment records exist for that observation,
   **Then** the system shows: "Log a treatment before marking as treated."
   **And** the status remains "Observed".

7. **Given** the user tries to add a 4th photo to an observation,
   **When** they tap the photo picker,
   **Then** the system shows: "Maximum 3 photos per observation" and the picker does not open.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates status transition observed to treated | current: observed, new: treated, treatments: 1 | Valid |
| rejects treated without treatment record | current: observed, new: treated, treatments: 0 | Error: log treatment first |
| allows resolved to ongoing | current: resolved, new: ongoing | Valid, resolved_date cleared |
| rejects observed to ongoing | current: observed, new: ongoing | Error: invalid transition |
| detects recurrence with 2+ observations | 3 aphid observations in 24 months | recurrence: { count: 3 } |
| groups by pest_disease_id | 2 aphid + 1 mildew observations | 2 groups |
| handles custom-named issues | 2 "Unknown beetle" observations | grouped as 1 recurrence |
| validates max 3 photos | attempt to add photo when count = 3 | Rejected |
| validates resolved_date after observed_date | observed: Mar 1, resolved: Feb 28 | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full observation lifecycle | 1. Log aphid observation, 2. Log neem oil treatment, 3. Mark treated, 4. Mark resolved | Status transitions correctly, dates set, treatment in timeline |
| Recurrence detection | 1. Log aphid issue in Jan, 2. Resolve it, 3. Log aphid issue in Jun | Recurrence card shows aphids with count 2 |
| Photo management | 1. Log observation with 2 photos, 2. View detail | 2 photos in gallery, scrollable |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User manages a pest issue from discovery to resolution | 1. Notice aphids, 2. Log observation with photo, 3. Apply neem oil treatment, 4. Wait 5 days, 5. Apply second treatment, 6. Mark resolved | Observation shows full timeline: observation -> treatment 1 -> treatment 2 -> resolved. Photos preserved. Issue no longer in active list. |
| User reviews seasonal pest patterns | 1. Log various issues over 12 months, 2. View common issues | Recurring issues identified with season pattern, most effective treatments shown |

---

### GD-010: Fertilizer Schedule

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-010 |
| **Feature Name** | Fertilizer Schedule |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a gardener, I want to track which fertilizers I use on each plant, when I applied them, and at what concentration, so that I can maintain a consistent feeding routine and avoid over-fertilizing.

**Secondary:**
> As a beginner gardener, I want fertilizer recommendations based on my plant species and the current growing season, so that I know what type and how much fertilizer to use.

#### 3.3 Detailed Description

The Fertilizer Schedule extends the Care Schedule (GD-006) with detailed fertilizer-specific tracking. While GD-006 handles the "when to fertilize" question through recurring care events, this feature addresses "what to use, how much, and what happened."

Each fertilizer application record captures the fertilizer product (with its NPK ratio), the dilution rate, the amount applied, and the plant's response. The system maintains a user-built fertilizer inventory where users add their fertilizer products with NPK values (Nitrogen-Phosphorus-Potassium ratios like 10-10-10 or 2-7-7). When logging an application, the user selects from their inventory.

NPK ratios are stored as three integers representing the percentage by weight of each macronutrient:
- N (Nitrogen): promotes leaf and stem growth
- P (Phosphorus): supports root development and flowering
- K (Potassium): strengthens overall plant health and disease resistance

The feature provides species-specific fertilizer recommendations. For example, leafy vegetables prefer high-N fertilizers (like 10-5-5), flowering plants prefer high-P fertilizers (like 5-10-5), and fruiting plants prefer balanced or high-K fertilizers (like 5-10-10). These recommendations come from the plant care database (GD-018) and are displayed as suggestions, not prescriptions.

A fertilizer history chart shows the cumulative NPK applied to each plant over time, helping users see if they are over- or under-feeding in any macronutrient category. An over-fertilization warning triggers when the cumulative N applied in the past 30 days exceeds a species-specific threshold (default: 2g N per gallon of soil volume, estimated from pot size).

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Applications reference plant records
- GD-006: Care Schedule - Fertilizing reminders trigger application logging
- GD-018: Plant Care Database - Species-specific NPK recommendations

**External Dependencies:**
- Local storage for fertilizer product inventory and application records

**Assumed Capabilities:**
- Plant records exist in the catalog with species references
- Care schedule fertilizing intervals are configured

#### 3.5 User Interface Requirements

##### Screen: Fertilizer Log

**Layout:**
- Top navigation bar displays "Fertilizer" title
- Tab bar below nav: "Schedule" | "History" | "Products"
- Schedule tab: list of upcoming and overdue fertilizing tasks (same as GD-006 fertilizing subset, but with fertilizer product recommendation attached to each task)
- History tab: scrollable list of past applications, newest first. Each row: plant photo thumbnail, plant name, product name, NPK badge (e.g., "10-10-10"), amount, date
- Products tab: user's fertilizer inventory, each card showing product name, NPK ratio, notes
- "Log Application" button visible on Schedule and History tabs
- "Add Product" button visible on Products tab

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty (History) | No applications logged | Message: "No fertilizer applications logged yet." Button: "Log Application" |
| Empty (Products) | No products in inventory | Message: "Add your fertilizer products to start tracking." Button: "Add Product" |
| Populated | Applications and/or products exist | Normal list views |

**Interactions:**
- Tap "Log Application": opens Application modal
- Tap application row: opens detail view with full application info
- Tap product card: opens edit modal for that product
- Swipe left on product: reveals "Delete" action
- Tap NPK badge on any row: opens a tooltip explaining the N-P-K values

##### Modal: Log Application

**Layout:**
- Title: "Log Fertilizer Application"
- Plant picker: searchable dropdown
- Product picker: dropdown of user's fertilizer inventory, with "Quick Add" link to add a new product inline
- Dilution: text input (e.g., "1/4 strength", "1 tsp per gallon"), max 100 chars
- Amount: numeric input with unit selector (ml, tsp, tbsp, cups, liters)
- Date: date picker, defaults to today
- Notes: multiline text, optional, max 500 chars
- "Save" and "Cancel" buttons

##### Modal: Add/Edit Product

**Layout:**
- Title: "Add Fertilizer" or "Edit [Product Name]"
- Product name: text input, required, max 200 chars
- N (Nitrogen): integer input, min 0, max 100
- P (Phosphorus): integer input, min 0, max 100
- K (Potassium): integer input, min 0, max 100
- Type: dropdown - "Liquid", "Granular", "Slow Release", "Organic Compost", "Fish Emulsion", "Other"
- Notes: multiline text, optional, max 500 chars
- "Save" and "Cancel" buttons

#### 3.6 Data Requirements

##### Entity: FertilizerProduct

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, max 200 chars | None | Product name (e.g., "Miracle-Gro All Purpose") |
| npk_n | INTEGER | Required, min 0, max 100 | 0 | Nitrogen percentage |
| npk_p | INTEGER | Required, min 0, max 100 | 0 | Phosphorus percentage |
| npk_k | INTEGER | Required, min 0, max 100 | 0 | Potassium percentage |
| type | TEXT | One of: 'liquid', 'granular', 'slow_release', 'organic_compost', 'fish_emulsion', 'other' | 'liquid' | Fertilizer form |
| notes | TEXT | Optional, max 500 chars | null | Usage notes or instructions |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

##### Entity: FertilizerApplication

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Which plant was fertilized |
| product_id | TEXT (UUID) | Required, references FertilizerProduct.id | None | Which product was used |
| application_date | TEXT | ISO 8601 date, required | Current date | When the fertilizer was applied |
| dilution | TEXT | Optional, max 100 chars | null | Dilution rate (e.g., "1/4 strength") |
| amount_ml | REAL | Required, min 0.1, max 100000 | None | Amount applied in milliliters (canonical unit) |
| notes | TEXT | Optional, max 500 chars | null | Application notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Relationships:**
- FertilizerApplication belongs to Plant (many-to-one via plant_id)
- FertilizerApplication belongs to FertilizerProduct (many-to-one via product_id)

**Indexes:**
- FertilizerApplication: `(plant_id, application_date DESC)` - Per-plant application history
- FertilizerApplication: `product_id` - Find all uses of a product
- FertilizerProduct: `name COLLATE NOCASE` - Sort products by name

**Validation Rules:**
- `name` (product): Must not be empty after trimming
- `npk_n`, `npk_p`, `npk_k`: Each must be between 0 and 100
- `amount_ml`: Must be positive, between 0.1 and 100,000
- `application_date`: Must not be in the future
- `product_id`: Must reference an existing FertilizerProduct

**Example Data:**

```json
{
  "id": "fp-001-miraclegro",
  "name": "Miracle-Gro All Purpose",
  "npk_n": 24,
  "npk_p": 8,
  "npk_k": 16,
  "type": "liquid",
  "notes": "Dissolve 1 tsp per gallon of water",
  "created_at": "2026-03-01T00:00:00Z",
  "updated_at": "2026-03-01T00:00:00Z"
}
```

```json
{
  "id": "fa-001-monstera-mar",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "product_id": "fp-001-miraclegro",
  "application_date": "2026-03-15",
  "dilution": "1/4 strength",
  "amount_ml": 250.0,
  "notes": "Half-strength for early spring feeding",
  "created_at": "2026-03-15T09:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### NPK Accumulation Tracking

**Purpose:** Calculate cumulative macronutrients applied to a plant over a time period.

**Inputs:**
- plant_id: UUID
- period_days: integer (default: 30)

**Logic:**

```
1. QUERY FertilizerApplications WHERE
     plant_id = input AND
     application_date >= today - period_days
2. FOR EACH application:
     LOOKUP product NPK ratios
     // NPK percentages represent grams per 100ml of concentrate
     // Dilution is free-text, so actual nutrient calculation is approximate
     estimated_n_grams = (product.npk_n / 100) * application.amount_ml * 0.01
     estimated_p_grams = (product.npk_p / 100) * application.amount_ml * 0.01
     estimated_k_grams = (product.npk_k / 100) * application.amount_ml * 0.01
3. cumulative_n = SUM(estimated_n_grams)
   cumulative_p = SUM(estimated_p_grams)
   cumulative_k = SUM(estimated_k_grams)
4. RETURN { cumulative_n, cumulative_p, cumulative_k, application_count }
```

**Edge Cases:**
- No applications in period: all values return 0
- Product deleted after application logged: application shows "[Deleted Product]", NPK calculations use stored snapshot (future enhancement: denormalize NPK at application time)
- Zero NPK values (e.g., compost with 0-0-0): valid, just no macronutrient accumulation

##### Over-Fertilization Warning

**Purpose:** Warn users when they may be over-fertilizing a plant.

**Inputs:**
- cumulative_n_30d: float (grams of nitrogen applied in last 30 days)
- species_n_threshold: float (species-specific N limit in grams, default: 2.0)

**Logic:**

```
1. IF cumulative_n_30d > species_n_threshold THEN
     RETURN warning: "High nitrogen: [cumulative_n]g applied in the last 30 days
       (recommended max: [threshold]g). Over-fertilizing can burn roots and damage the plant."
2. IF cumulative_n_30d > species_n_threshold * 0.8 THEN
     RETURN caution: "Approaching nitrogen limit: [cumulative_n]g of [threshold]g in the last 30 days."
3. RETURN ok
```

**Edge Cases:**
- No species threshold available: use default 2.0g
- Threshold is 0: skip warning (species does not need fertilizer)
- Warning is informational only; it does not block the application

##### Fertilizer Recommendation

**Purpose:** Suggest appropriate fertilizer types based on plant species needs.

**Logic:**

```
1. LOOKUP species fertilizer preferences from plant care database:
     preferred_npk_ratio: string (e.g., "high-N", "balanced", "high-P")
2. MATCH against user's fertilizer inventory:
     IF preferred == "high-N": recommend products where N > P and N > K
     IF preferred == "high-P": recommend products where P > N and P > K
     IF preferred == "high-K": recommend products where K > N and K > P
     IF preferred == "balanced": recommend products where |N-P| < 5 and |N-K| < 5 and |P-K| < 5
3. SORT matching products by closeness to ideal ratio
4. RETURN top 3 recommendations with reason
```

**Edge Cases:**
- No products in inventory match: show "No matching products in your inventory. Consider a [preferred] fertilizer."
- Species has no fertilizer preference: show "No specific recommendation for this species. A balanced fertilizer (e.g., 10-10-10) is a safe general choice."

**Sort/Filter/Ranking Logic:**
- **Default sort (history):** Newest application first
- **Available sort options:** Newest First, Oldest First, By Plant, By Product
- **Filter options:** Plant (dropdown), Product (dropdown), Date Range
- **Default sort (products):** Name A-Z

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on application save | Toast: "Could not save application. Please try again." | User retries |
| Product name left blank | Inline validation: "Product name is required" | User fills in name |
| Amount left blank or zero | Inline validation: "Amount is required and must be greater than 0" | User enters valid amount |
| Product deleted that has application history | Applications show "[Deleted Product]" label; NPK data approximated from last known values | User can edit old applications to reassign a product |
| NPK values all zero | Warning on save: "All NPK values are 0. Is this correct?" with "Yes, Save" and "Edit" options | User confirms or corrects |

**Validation Timing:**
- Product name validation runs on blur
- NPK value validation runs on blur
- Amount validation runs on blur
- Application date validation runs on selection change

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has a fertilizer product "Fish Emulsion" (5-1-1) in their inventory,
   **When** they log an application of 250ml to their Monstera on March 15,
   **Then** the application appears in History, the NPK accumulation for Monstera updates, and the care schedule's fertilize due date resets.

2. **Given** 5 fertilizer applications to a Tomato plant in the last 30 days,
   **When** the user views the NPK accumulation chart,
   **Then** cumulative N, P, and K values are displayed as a stacked bar chart with the species threshold line shown.

3. **Given** a Tomato plant (prefers high-K fertilizer) and 3 products in inventory,
   **When** the user views recommendations for the Tomato,
   **Then** the product with the highest K ratio is recommended first with an explanation.

**Edge Cases:**

4. **Given** cumulative nitrogen for a plant exceeds the species threshold,
   **When** the user views the plant's fertilizer detail,
   **Then** a warning banner shows: "High nitrogen: Xg applied in the last 30 days (recommended max: Yg)."

5. **Given** a product with NPK 0-0-0 (pure compost),
   **When** the user saves the product,
   **Then** a confirmation: "All NPK values are 0. Is this correct?" appears, and the product is saved after confirmation.

**Negative Tests:**

6. **Given** the user leaves the amount field blank on the application form,
   **When** they tap "Save",
   **Then** validation shows: "Amount is required and must be greater than 0."

7. **Given** the user tries to log an application with a future date,
   **When** they tap "Save",
   **Then** validation shows: "Application date cannot be in the future."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates N accumulation | 2 apps of 250ml with 10% N product | cumulative_n: 0.5g |
| calculates P accumulation | 1 app of 500ml with 5% P product | cumulative_p: 0.25g |
| triggers over-fertilization warning | cumulative_n: 2.5g, threshold: 2.0g | warning returned |
| triggers caution at 80% | cumulative_n: 1.6g, threshold: 2.0g | caution returned |
| returns ok below threshold | cumulative_n: 1.0g, threshold: 2.0g | ok |
| recommends high-N product | species prefers high-N, products: (10-5-5, 5-10-5, 10-10-10) | recommends 10-5-5 |
| recommends balanced product | species prefers balanced, products: (10-10-10, 24-8-16) | recommends 10-10-10 |
| handles zero NPK product | npk: 0-0-0 | valid, no accumulation |
| rejects empty product name | name: "   " | Validation error |
| rejects zero amount | amount_ml: 0 | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add product and log application | 1. Add "Fish Emulsion 5-1-1", 2. Log 250ml to Monstera, 3. View history | Application shows in history with correct NPK badge |
| Over-fertilization warning appears | 1. Log 5 heavy applications in 2 weeks, 2. View plant fertilizer detail | Warning banner shows with cumulative N exceeding threshold |
| Product deletion preserves history | 1. Log application with product, 2. Delete product, 3. View application | Application shows "[Deleted Product]" with NPK data intact |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User manages full fertilizer routine | 1. Add 3 products to inventory, 2. Log 10 applications across 4 plants over 2 months, 3. View history and accumulation | History shows all applications, NPK chart reflects totals, recommendations appear for each plant, over-fert warnings where applicable |
| User follows fertilizer recommendations | 1. View Tomato recommendation, 2. See "Use high-K fertilizer", 3. Log application with recommended product | Application logged, care schedule resets, NPK balance moves toward ideal |

---

### GD-011: Seed Inventory

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-011 |
| **Feature Name** | Seed Inventory |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a seed starter, I want to track my seed collection with variety names, quantities, purchase dates, and viability dates, so that I know what seeds I have available and which ones are still viable for planting.

**Secondary:**
> As a thrifty gardener, I want to track seed germination rates across batches so I know which brands and varieties perform best and which seeds to avoid buying again.

#### 3.3 Detailed Description

Seed Inventory provides a dedicated tracking system for seed packets. Each seed record stores the variety/cultivar name, species (linked to the plant care database), source (store name or seed company), purchase date, quantity (number of seeds or weight), expected viability period, and germination rate observations.

Seeds have a viability window based on species. The system maintains default viability periods for common species (e.g., tomato seeds: 4 years, lettuce seeds: 6 years, onion seeds: 1 year, pepper seeds: 2 years). These defaults come from the plant care database (GD-018). The viability indicator shows a color-coded status: green (within viability period), yellow (within 6 months of expiration), red (past viability, may still work but lower germination expected).

Germination tracking allows users to log seed starting attempts with the number of seeds planted, number that germinated, and the time to germination. The system computes a germination rate:

```
germination_rate = seeds_germinated / seeds_planted * 100
```

This rate is tracked per seed batch and per species over time, helping users identify which seed sources are most reliable.

The seed inventory integrates with the Planting Calendar (GD-005) to show which seeds the user has available for upcoming planting windows. When the calendar shows "Start Tomato seeds indoors in February", the seed inventory badge shows how many tomato seed packets the user has and whether they are still viable.

When seeds from the inventory are planted and grow into plants, the user can link the seed record to the resulting Plant record (GD-001), creating a seed-to-harvest lineage.

Survival rate tracks how many seedlings survive to maturity:

```
survival_rate = alive_plants / total_plants * 100
```

Where total_plants is the number of seeds that germinated, and alive_plants is the number of resulting Plant records still alive after 30 days.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Seed-to-plant lineage linking
- GD-005: Planting Calendar - Integration for seed availability badges
- GD-018: Plant Care Database - Species viability periods

**External Dependencies:**
- Local storage for seed inventory records

**Assumed Capabilities:**
- Plant care database loaded with viability data
- User has seeds to track

#### 3.5 User Interface Requirements

##### Screen: Seed Inventory

**Layout:**
- Top navigation bar displays "Seeds" title with a count badge (e.g., "Seeds (34)")
- Filter bar: viability filter chips - "All" (default), "Viable" (green), "Expiring Soon" (yellow), "Expired" (red)
- Below filter: searchable, scrollable list of seed packets, sorted by viability status (expiring soon first, then viable, then expired)
- Each seed card: variety name (bold), species name (secondary text), quantity remaining, viability status dot (green/yellow/red), purchase date, source/brand, germination rate percentage (if tested)
- Floating action button: "Add Seeds" (plus icon with seed)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No seeds in inventory | Centered illustration (seed packet), heading "No seeds tracked", subtext "Add your seed collection to track viability and germination", button "Add Seeds" |
| Loading | Querying data | Skeleton placeholders for 4 seed cards |
| Populated | 1+ seeds | Filterable list of seed cards |
| Filtered | Viability filter applied | Filtered subset; empty filter state: "No [status] seeds" |

**Interactions:**
- Tap "Add Seeds": opens Add Seed modal
- Tap seed card: opens Seed Detail screen
- Swipe left on card: reveals "Delete" action
- Tap viability filter chip: filters to that viability status
- Pull-to-refresh: recalculates viability statuses

##### Screen: Seed Detail

**Layout:**
- Header: variety name, species, viability badge
- Info section: source, purchase date, quantity (with "Use Seeds" button to decrement), lot number if entered, viability end date
- Germination section: germination rate chart (bar showing germinated vs total per attempt), "Log Germination" button
- Lineage section: list of Plant records grown from this seed batch (linked plants)
- Notes section: user notes, max 1000 chars

**Interactions:**
- Tap "Use Seeds": opens a quantity input modal to decrement seeds remaining (e.g., "How many seeds are you planting?"), min 1, max remaining
- Tap "Log Germination": opens germination log modal
- Tap a linked plant: navigates to Plant Detail screen
- Tap "Link to Plant": plant picker to associate an existing plant with this seed batch

##### Modal: Add/Edit Seed

**Layout:**
- Title: "Add Seeds" or "Edit Seed"
- Variety name: text input, required, max 200 chars (e.g., "San Marzano")
- Species picker: searchable dropdown from plant care database (auto-fills viability period)
- Source: text input, optional, max 200 chars (e.g., "Baker Creek Seeds")
- Lot/Batch number: text input, optional, max 100 chars
- Purchase date: date picker, required, defaults to today
- Quantity: integer input, required, min 1, max 100000
- Quantity unit: toggle - "Seeds" | "Weight (g)"
- Viability years: integer input, pre-filled from species default, min 1, max 20, user-editable
- Notes: multiline text, optional, max 1000 chars
- "Save" and "Cancel" buttons

##### Modal: Log Germination

**Layout:**
- Title: "Log Germination Test"
- Seeds planted: integer input, required, min 1, max remaining quantity
- Seeds germinated: integer input, required, min 0, max seeds_planted
- Start date: date picker, required
- Germination observed date: date picker, required, must be on or after start date
- Notes: multiline text, optional, max 500 chars
- "Save" and "Cancel" buttons

#### 3.6 Data Requirements

##### Entity: SeedPacket

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| variety_name | TEXT | Required, max 200 chars | None | Cultivar or variety name |
| species_id | TEXT (UUID) | Optional, references Species.id | null | Linked species for viability lookup |
| source | TEXT | Optional, max 200 chars | null | Where seeds were purchased |
| lot_number | TEXT | Optional, max 100 chars | null | Lot or batch number from packet |
| purchase_date | TEXT | ISO 8601 date, required | Current date | When seeds were acquired |
| quantity | INTEGER | Required, min 0, max 100000 | None | Current quantity remaining |
| quantity_unit | TEXT | One of: 'seeds', 'grams' | 'seeds' | Unit for quantity |
| initial_quantity | INTEGER | Required, min 1, max 100000 | None | Original quantity when purchased |
| viability_years | INTEGER | Required, min 1, max 20 | None | How many years seeds remain viable |
| notes | TEXT | Optional, max 1000 chars | null | User notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

##### Entity: GerminationLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| seed_packet_id | TEXT (UUID) | Required, references SeedPacket.id | None | Which seed packet was tested |
| seeds_planted | INTEGER | Required, min 1 | None | Number of seeds used |
| seeds_germinated | INTEGER | Required, min 0 | None | Number that germinated |
| germination_rate | REAL | Computed, 0.0-100.0 | None | Percentage that germinated |
| start_date | TEXT | ISO 8601 date, required | None | When seeds were planted |
| observed_date | TEXT | ISO 8601 date, required | None | When germination was counted |
| days_to_germination | INTEGER | Computed | None | observed_date - start_date |
| notes | TEXT | Optional, max 500 chars | null | Notes about conditions |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: SeedPlantLink

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| seed_packet_id | TEXT (UUID) | Required, references SeedPacket.id | None | Source seed packet |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Resulting plant |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Relationships:**
- SeedPacket optionally references Species (many-to-one via species_id)
- SeedPacket has many GerminationLog (one-to-many via seed_packet_id)
- SeedPacket has many SeedPlantLink (one-to-many via seed_packet_id)
- SeedPlantLink references Plant (many-to-one via plant_id)

**Indexes:**
- SeedPacket: `variety_name COLLATE NOCASE` - Sorted listing by name
- SeedPacket: `species_id` - Group by species
- SeedPacket: `purchase_date` - Sort by purchase date
- GerminationLog: `seed_packet_id` - Find all germination tests for a packet
- SeedPlantLink: `(seed_packet_id, plant_id)` UNIQUE - Prevent duplicate links

**Validation Rules:**
- `variety_name`: Must not be empty after trimming
- `quantity`: Must be >= 0 (can be 0 when all seeds are used)
- `initial_quantity`: Must be >= 1
- `seeds_germinated`: Must be <= `seeds_planted`
- `observed_date`: Must be on or after `start_date`
- `purchase_date`: Must not be in the future
- `viability_years`: Must be between 1 and 20

**Example Data:**

```json
{
  "id": "sp-001-sanmarzano",
  "variety_name": "San Marzano",
  "species_id": "sp-tomato-001",
  "source": "Baker Creek Seeds",
  "lot_number": "LOT-2026-A",
  "purchase_date": "2026-01-15",
  "quantity": 42,
  "quantity_unit": "seeds",
  "initial_quantity": 50,
  "viability_years": 4,
  "notes": "Heirloom variety, great for sauce",
  "created_at": "2026-01-15T00:00:00Z",
  "updated_at": "2026-03-01T00:00:00Z"
}
```

```json
{
  "id": "gl-001-sanmarzano-test1",
  "seed_packet_id": "sp-001-sanmarzano",
  "seeds_planted": 8,
  "seeds_germinated": 7,
  "germination_rate": 87.5,
  "start_date": "2026-02-15",
  "observed_date": "2026-02-22",
  "days_to_germination": 7,
  "notes": "Started under grow lights at 72F",
  "created_at": "2026-02-22T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Viability Status Calculation

**Purpose:** Determine whether a seed packet is still viable based on purchase date and viability period.

**Inputs:**
- purchase_date: date
- viability_years: integer
- current_date: date

**Logic:**

```
1. expiration_date = purchase_date + (viability_years * 365 days)
2. days_until_expiration = expiration_date - current_date
3. IF days_until_expiration < 0 THEN
     status = 'expired'
     color = 'red'
   ELSE IF days_until_expiration <= 180 THEN
     status = 'expiring_soon'
     color = 'yellow'
   ELSE
     status = 'viable'
     color = 'green'
4. RETURN { status, color, expiration_date, days_until_expiration }
```

**Edge Cases:**
- Viability exactly at 180 days: "expiring_soon" (boundary inclusive)
- Purchase date in the distant past (>20 years): expired, still shown in list
- Expired seeds: still usable, just lower germination expected; viability is advisory

##### Germination Rate Calculation

**Purpose:** Compute germination rate for a seed batch and aggregate rates across all tests.

**Inputs:**
- germination_logs: array of GerminationLog entries for a seed packet

**Logic:**

```
1. FOR EACH log:
     log.germination_rate = (log.seeds_germinated / log.seeds_planted) * 100
     log.days_to_germination = log.observed_date - log.start_date

2. aggregate_rate = SUM(all seeds_germinated) / SUM(all seeds_planted) * 100
3. avg_days_to_germ = AVG(all days_to_germination)

4. RETURN {
     per_test_rates: [...],
     aggregate_rate (rounded to 1 decimal),
     avg_days_to_germ (rounded to nearest integer),
     total_tested: SUM(seeds_planted),
     total_germinated: SUM(seeds_germinated)
   }
```

**Edge Cases:**
- No germination logs: rate is null, display "Not tested"
- 0 seeds germinated out of N planted: rate is 0%
- All seeds germinated: rate is 100%

##### Survival Rate Calculation

**Purpose:** Track what percentage of germinated seedlings survive to maturity.

**Inputs:**
- seed_packet_id: UUID
- min_days_alive: integer (default: 30)

**Logic:**

```
1. QUERY SeedPlantLinks WHERE seed_packet_id = input
2. QUERY linked Plant records
3. total_plants = COUNT(linked plants)
4. alive_plants = COUNT(linked plants WHERE status = 'alive' AND
     days_since_created >= min_days_alive)
5. survival_rate = (alive_plants / total_plants) * 100
6. RETURN { survival_rate, alive_plants, total_plants }
```

**Edge Cases:**
- No linked plants: survival rate is null, display "No plants grown yet"
- All plants dead: survival rate is 0%
- Plants less than 30 days old: excluded from survival rate (too early to count)

##### Seed Quantity Decrement

**Purpose:** Reduce seed count when user plants seeds.

**Inputs:**
- seed_packet_id: UUID
- seeds_used: integer

**Logic:**

```
1. QUERY SeedPacket
2. IF seeds_used > packet.quantity THEN
     RETURN error: "Not enough seeds. You have [quantity] remaining."
3. packet.quantity = packet.quantity - seeds_used
4. SAVE packet
5. RETURN { remaining: packet.quantity }
```

**Edge Cases:**
- Quantity reaches 0: packet remains in inventory with "0 remaining" badge
- Quantity is in grams: user enters grams used (same decrement logic)

**Sort/Filter/Ranking Logic:**
- **Default sort:** Viability status (expiring soon first, then viable, then expired), then name A-Z
- **Available sort options:** Name A-Z, Name Z-A, Purchase Date (newest), Viability Status, Germination Rate
- **Filter options:** Viability status (viable, expiring soon, expired), Species, Source
- **Search:** Searches variety_name, species name, source; substring match; case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on seed save | Toast: "Could not save seed packet. Please try again." | User retries |
| Variety name left blank | Inline validation: "Variety name is required" | User fills in field |
| Seeds used exceeds quantity | Inline validation: "Not enough seeds. You have [N] remaining." | User enters smaller number |
| Germinated exceeds planted | Inline validation: "Germinated count cannot exceed seeds planted" | User corrects value |
| Observed date before start date | Inline validation: "Observation date must be on or after start date" | User corrects date |
| Species not found in database | Viability defaults to 3 years; message: "Viability estimated at 3 years. Adjust if needed." | User adjusts viability years manually |

**Validation Timing:**
- Variety name validation runs on blur
- Quantity validation runs on blur
- Germination count validation runs on blur
- Date validation runs on selection change

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user purchases San Marzano tomato seeds from Baker Creek,
   **When** they add the seeds with 50 count, purchase date Jan 15, viability 4 years,
   **Then** the seed appears in the inventory with "Viable" (green) status, expiring Jan 2030.

2. **Given** a seed packet with 50 seeds,
   **When** the user plants 8 seeds and logs the germination (7 of 8 germinated in 7 days),
   **Then** the remaining count shows 42, germination rate shows 87.5%, and days to germination shows 7.

3. **Given** seeds purchased 3 years and 7 months ago with 4-year viability,
   **When** the user views the inventory,
   **Then** the viability status shows "Expiring Soon" (yellow) with "5 months remaining."

**Edge Cases:**

4. **Given** seeds purchased 5 years ago with 4-year viability,
   **When** the user views the inventory,
   **Then** the viability status shows "Expired" (red) with "Expired 1 year ago. Seeds may still be viable but germination rates will be lower."

5. **Given** a seed packet with 0 remaining seeds,
   **When** the user views the inventory,
   **Then** the card shows "0 remaining" and the "Use Seeds" button is disabled.

**Negative Tests:**

6. **Given** a seed packet with 10 seeds remaining,
   **When** the user tries to use 15 seeds,
   **Then** validation shows: "Not enough seeds. You have 10 remaining."
   **And** the quantity is not changed.

7. **Given** the user logs a germination test with 5 planted and 8 germinated,
   **When** they tap "Save",
   **Then** validation shows: "Germinated count cannot exceed seeds planted."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| viable status within period | purchase: 1 year ago, viability: 4 years | status: viable, color: green |
| expiring soon within 6 months | purchase: 3.5 years ago, viability: 4 years | status: expiring_soon, color: yellow |
| expired past viability | purchase: 5 years ago, viability: 4 years | status: expired, color: red |
| calculates germination rate | planted: 10, germinated: 8 | rate: 80.0% |
| calculates 0% germination | planted: 10, germinated: 0 | rate: 0.0% |
| calculates 100% germination | planted: 5, germinated: 5 | rate: 100.0% |
| aggregate rate across tests | test1: 7/8, test2: 6/10 | aggregate: 72.2% (13/18) |
| calculates days to germination | start: Feb 15, observed: Feb 22 | days: 7 |
| calculates survival rate | 10 linked plants, 8 alive > 30 days | 80.0% |
| rejects germinated > planted | planted: 5, germinated: 8 | Validation error |
| rejects negative quantity after use | quantity: 10, used: 15 | Error: not enough seeds |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add seeds and track germination | 1. Add 50 San Marzano seeds, 2. Use 8 seeds, 3. Log germination 7/8, 4. View detail | 42 remaining, 87.5% germination, 7 days to germ |
| Link seeds to plants | 1. Grow 7 seedlings from seed batch, 2. Add as Plant records, 3. Link to seed packet | Seed detail shows 7 linked plants, survival rate calculated |
| Viability auto-updates | 1. Add seeds with 1-year viability, 2. Wait (simulate date change), 3. View inventory | Status changes from viable to expiring_soon to expired |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User manages seed collection through a season | 1. Add 10 seed packets in January, 2. Plant seeds in February (decrement quantities), 3. Log germination results, 4. Link germinated plants, 5. View inventory in March | All packets show updated quantities, germination rates, linked plants, viability statuses accurate |
| Planting calendar seed availability | 1. Add Tomato seeds to inventory, 2. View planting calendar for Tomato, 3. Check seed availability badge | Calendar shows "8 Tomato seeds available (viable)" next to the indoor seed start window |

---

### GD-012: Garden Statistics

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-012 |
| **Feature Name** | Garden Statistics |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a data-driven gardener, I want to see comprehensive statistics about my garden including total plants, survival rates, harvest yields, and care adherence, so that I can measure my gardening progress and improve year over year.

**Secondary:**
> As a long-term gardener, I want year-over-year comparison charts for my key metrics, so that I can see trends and celebrate improvements.

#### 3.3 Detailed Description

Garden Statistics aggregates data from all other features into a unified analytics dashboard. This feature does not collect any new data; it queries and visualizes data from the Plant Catalog (GD-001), Watering Logs (GD-002), Care Events (GD-006), Harvests (GD-008), Pest Observations (GD-009), Seed Inventory (GD-011), and Plant Health Scores (GD-014).

The dashboard is organized into stat cards and charts covering five areas:

1. **Plant Census:** Total plants (alive, dormant, dead, given away), species diversity (unique species count), acquisition trend (plants added per month), survival rate.
2. **Care Performance:** Watering adherence percentage (on-time waterings / total due waterings * 100), average care streak, fertilizer application frequency, total care events by type.
3. **Harvest Yields:** Total weight harvested (current season and all-time), top 3 producing plants, yield per plant, yield per square foot, average harvest quality.
4. **Pest & Disease:** Active issues count, most common pest/disease, resolution rate (resolved / total observations * 100), average time to resolution.
5. **Seed Performance:** Total seed packets, overall germination rate, best-performing variety, expired seed count.

Key computed metrics:

```
survival_rate = (alive_plants / (alive_plants + dead_plants)) * 100
watering_adherence = (on_time_waterings / total_due_waterings) * 100
resolution_rate = (resolved_observations / total_observations) * 100
avg_time_to_resolution = AVG(resolved_date - observed_date) in days
species_diversity = COUNT(DISTINCT species_id WHERE species_id IS NOT NULL)
```

The dashboard supports time period selection: "This Month", "This Season", "This Year", "All Time", and custom date ranges. Year-over-year comparison is available for yearly and seasonal views, displaying the current period alongside the previous period with percentage change indicators (up/down arrows with green for improvement, red for decline).

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Plant census data
- GD-002: Smart Watering Reminders - Watering adherence data
- GD-006: Care Schedule - Care event data
- GD-008: Harvest Tracking - Yield data
- GD-009: Pest and Disease Log - Issue data
- GD-011: Seed Inventory - Seed performance data
- GD-014: Plant Health Scoring - Health score data (optional)

**External Dependencies:**
- Local storage (read-only queries against existing data)

**Assumed Capabilities:**
- Data exists in at least some of the source features
- Date calculations use the user's configured hemisphere and USDA zone

#### 3.5 User Interface Requirements

##### Screen: Garden Stats

**Layout:**
- Top navigation bar displays "Garden Stats" title
- Time period selector: horizontal segmented control with "Month", "Season", "Year", "All Time", "Custom"
- Below period selector: scrollable vertical layout of stat sections
- Each section has a header (e.g., "Plant Census") and contains 2-4 stat cards arranged in a 2-column grid
- Each stat card: large number (primary metric), label (metric name), secondary text (context or comparison), optional trend arrow (up/down with percentage vs previous period)
- Between sections: charts
  - Plant Census section: horizontal bar chart of plants by status (alive/dormant/dead/given away)
  - Care Performance section: line chart of watering adherence over time (weekly data points)
  - Harvest section: bar chart of monthly harvest weight
  - Pest section: pie chart of issue types (pest/disease/other)
- "Share Stats" button at the bottom (generates a stats summary image for sharing)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No data in any source feature | Message: "Start adding plants and logging care to see your garden stats." Links to Plant Catalog and Care Schedule |
| Partial | Data exists in some features but not all | Sections with data display normally; empty sections show "No data yet" with a brief description of what data is needed |
| Populated | Data in most/all source features | Full dashboard with all stat cards and charts |
| Loading | Computing aggregate statistics | Skeleton placeholders for stat cards, animated loading for charts |

**Interactions:**
- Tap period selector: updates all stats and charts to the selected time period
- Tap stat card: opens a detailed drill-down view for that metric (e.g., tapping "Survival Rate" shows a per-species breakdown)
- Tap chart: interactive data points show exact values on tap
- Tap "Share Stats": generates a styled image of the stats summary and opens the share sheet
- Swipe left/right on a section header: cycles between current and previous period comparison
- Pull-to-refresh: recalculates all statistics

**Transitions/Animations:**
- Stat card numbers: count-up animation from 0 to final value, 500ms
- Charts: draw animation from left to right, 400ms
- Period switch: numbers cross-fade to new values, 200ms
- Trend arrows: subtle bounce on load

#### 3.6 Data Requirements

This feature does not introduce new entities. All data is computed from existing entities via aggregate queries.

##### Computed Views (Not Stored)

| Metric | Source Entity | Aggregation |
|--------|--------------|-------------|
| total_alive_plants | Plant | COUNT WHERE status = 'alive' |
| total_dead_plants | Plant | COUNT WHERE status = 'dead' |
| survival_rate | Plant | alive / (alive + dead) * 100 |
| species_diversity | Plant | COUNT(DISTINCT species_id) |
| watering_adherence | CareEvent (type='watering') | completed_on_time / total_due * 100 |
| avg_care_streak | CareEvent | AVG(streak) across plants |
| total_harvest_weight | Harvest | SUM(weight_grams) |
| top_producer | Harvest | GROUP BY plant_id, SUM(weight_grams), ORDER DESC, LIMIT 3 |
| avg_harvest_quality | Harvest | AVG(quality_rating) |
| active_issues | PestObservation | COUNT WHERE status IN ('observed', 'treated', 'ongoing') |
| resolution_rate | PestObservation | resolved / total * 100 |
| germination_rate | GerminationLog | SUM(germinated) / SUM(planted) * 100 |

**Indexes:**
- No new indexes required; relies on indexes defined in source feature entities.

#### 3.7 Business Logic Rules

##### Period-Based Aggregation

**Purpose:** Compute statistics scoped to a user-selected time period.

**Inputs:**
- period_type: enum ('month', 'season', 'year', 'all_time', 'custom')
- custom_start: date (only for 'custom')
- custom_end: date (only for 'custom')
- hemisphere: enum ('northern', 'southern')

**Logic:**

```
1. DETERMINE date range:
     'month':   start = first day of current month, end = last day of current month
     'season':  start = season start date (based on hemisphere), end = season end date
     'year':    start = January 1 of current year, end = December 31
     'all_time': start = earliest record date, end = today
     'custom':  start = custom_start, end = custom_end

2. DETERMINE previous period (for comparison):
     'month':   same month last year
     'season':  same season last year
     'year':    previous year
     'all_time': no comparison available
     'custom':  same duration immediately preceding

3. FOR EACH metric:
     current_value = compute metric for [start, end]
     previous_value = compute metric for previous period
     IF previous_value > 0 THEN
       change_pct = ((current_value - previous_value) / previous_value) * 100
     ELSE
       change_pct = null (no comparison available)
     direction = 'up' if current > previous, 'down' if current < previous, 'flat' if equal

4. RETURN { metrics: [...], period: { start, end }, comparison: { start, end, available } }
```

**Edge Cases:**
- First year of use: no previous period data, comparison arrows hidden
- Custom period with zero days: rejected, minimum 1 day
- All-time view: no comparison arrows shown
- Division by zero (e.g., 0 total waterings due): display "N/A" instead of percentage
- Dead plants with no acquisition date: excluded from survival rate

##### Stats Summary Image Generation

**Purpose:** Generate a shareable image summarizing the user's garden stats.

**Logic:**

```
1. COLLECT top-level metrics:
     - Total plants (alive)
     - Survival rate
     - Total harvest weight
     - Watering adherence
     - Species diversity
2. RENDER a styled card image (1080x1920px):
     - MyGarden branding header
     - Metric values in large font
     - Period label
     - "Generated by MyGarden" footer
3. SAVE to temporary file
4. OPEN system share sheet with the image
```

**Edge Cases:**
- No data to share: "Share" button disabled with tooltip "Add data to enable sharing"
- Very large numbers: abbreviate (e.g., "1.2K harvests", "45.3 kg")

**Sort/Filter/Ranking Logic:**
- **Default view:** "This Season" period
- **Available periods:** Month, Season, Year, All Time, Custom
- **No sort/filter on the stats dashboard** (metrics are fixed layout)
- **Drill-down views:** may have their own sort/filter depending on the metric

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Aggregate query fails | Affected stat card shows "Error" with retry icon | Tap retry to recalculate that metric |
| No data for selected period | Stat cards show 0 or "N/A"; charts show empty state | User selects a different period or adds data |
| Share image generation fails | Toast: "Could not generate stats image. Try again." | User retries |
| Custom period start > end | Inline validation: "Start date must be before end date" | User corrects dates |

**Validation Timing:**
- Custom date range validates on selection change
- Aggregate calculations run on period change (debounced 300ms)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 20 alive plants, 3 dead plants, and 50 watering events (45 on time),
   **When** they open Garden Stats with "This Year" selected,
   **Then** the dashboard shows: 20 alive plants, survival rate 87.0%, watering adherence 90.0%.

2. **Given** the user had 15 plants last year and 20 this year,
   **When** they view the year comparison,
   **Then** the plant count shows "20" with an up arrow and "+33.3%" change.

3. **Given** harvest data across 3 months,
   **When** the user views the harvest chart,
   **Then** a bar chart shows weight per month with exact values on tap.

**Edge Cases:**

4. **Given** this is the user's first year using the app,
   **When** they select "Year" view,
   **Then** current year stats display normally, and comparison arrows are hidden with "No previous year data" message.

5. **Given** no pest observations exist,
   **When** the user views the Pest & Disease section,
   **Then** the section shows "No data yet - log pest observations to see trends here."

**Negative Tests:**

6. **Given** the user selects a custom date range where start is after end,
   **When** they confirm the selection,
   **Then** validation shows: "Start date must be before end date."
   **And** statistics are not calculated.

7. **Given** the user has 0 due waterings in the selected period,
   **When** the watering adherence metric is computed,
   **Then** it displays "N/A" instead of dividing by zero.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates survival rate | alive: 20, dead: 3 | 87.0% |
| survival rate with zero dead | alive: 10, dead: 0 | 100.0% |
| survival rate with zero alive | alive: 0, dead: 5 | 0.0% |
| calculates watering adherence | on_time: 45, total: 50 | 90.0% |
| adherence with zero total | on_time: 0, total: 0 | N/A |
| calculates year-over-year change | current: 20, previous: 15 | +33.3% up |
| calculates negative change | current: 10, previous: 15 | -33.3% down |
| no previous data | current: 20, previous: null | change: null |
| calculates resolution rate | resolved: 8, total: 10 | 80.0% |
| species diversity count | plants with species: [A, A, B, C, null] | 3 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full dashboard renders with data | 1. Add 10 plants, 2. Log waterings, 3. Log harvests, 4. Open stats | All sections populated with computed metrics |
| Period switch updates metrics | 1. View "This Year" stats, 2. Switch to "This Month" | Metrics recalculate for current month scope |
| Share stats generates image | 1. View stats with data, 2. Tap "Share Stats" | Image generated with correct metrics, share sheet opens |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reviews full season statistics | 1. After a growing season with data across all features, 2. Open stats in "Season" view | All 5 sections populated, charts display seasonal data, comparison with last season shown (if available) |

---

### GD-013: Frost Alerts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-013 |
| **Feature Name** | Frost Alerts |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a gardener with cold-sensitive outdoor plants, I want to receive alerts before the first expected frost date so I can bring plants inside or cover them, avoiding cold damage.

**Secondary:**
> As a spring planter, I want reminders as the last frost date approaches so I know when it is safe to move plants outdoors and begin direct sowing.

#### 3.3 Detailed Description

Frost Alerts is a notification system that warns users about upcoming frost date milestones based on their USDA hardiness zone settings (GD-005). Since MyGarden is offline-first and does not use weather APIs, frost alerts are based on the statistical frost dates for the user's zone rather than real-time weather forecasts.

The system generates two types of alerts:

1. **Spring Alerts (Last Frost Approaching):**
   - 4 weeks before last frost date: "Last frost expected around [date]. Start preparing to move plants outdoors."
   - 2 weeks before: "Last frost is approximately 2 weeks away ([date]). Begin hardening off seedlings."
   - 1 week before: "Last frost expected next week ([date]). Cold-sensitive plants can go outside soon."
   - On the date: "Today is the average last frost date for your zone. It is generally safe to plant outdoors."
   - 2 weeks after: "You are 2 weeks past your average last frost. Safe to transplant most warm-season plants."

2. **Fall Alerts (First Frost Approaching):**
   - 4 weeks before first frost: "First frost expected around [date]. Plan to harvest remaining crops and bring in cold-sensitive plants."
   - 2 weeks before: "First frost approximately 2 weeks away ([date]). Harvest ripe crops and prepare frost covers."
   - 1 week before: "First frost expected next week ([date]). Bring cold-sensitive plants inside."
   - On the date: "Today is the average first frost date for your zone. Protect or bring in any remaining outdoor plants."

Alerts are delivered as local push notifications at the user's preferred notification time (default: 8:00 AM). Users can enable or disable frost alerts independently from care notifications. Each alert fires once per year; dismissed alerts do not repeat.

For zones 11-13 (frost-free), frost alerts are disabled with a message: "Frost alerts are not available for your zone (no expected frost)."

The feature also provides a frost date countdown on the garden dashboard: "X days until last frost" (spring) or "X days until first frost" (fall), displayed as a small info card.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-005: Planting Calendar by USDA Zone - Frost dates from user's zone configuration
- GD-024: Settings and Preferences - Notification time preference, alert enable/disable toggle

**External Dependencies:**
- Local notification/push notification capability
- System clock for date comparisons

**Assumed Capabilities:**
- User has configured their USDA hardiness zone
- Notification permissions have been granted (or user will be prompted)

#### 3.5 User Interface Requirements

##### Component: Frost Countdown Card (Dashboard)

**Layout:**
- Small info card displayed on the main garden dashboard
- Shows: frost type icon (snowflake for first frost, sun for last frost), countdown text (e.g., "32 days until last frost"), frost date in parentheses (e.g., "Mar 22"), and the user's zone badge (e.g., "Zone 7a")
- Card background color shifts from blue (>30 days) to yellow (7-30 days) to red (<7 days)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Spring Countdown | Between first frost and last frost | "X days until last frost (date)" |
| Summer Safe | Between last frost + 2 weeks and first frost - 4 weeks | "Frost-free season. Enjoy!" with green background |
| Fall Countdown | Within 4 weeks of first frost | "X days until first frost (date)" |
| Winter | Between first frost and next year's last frost | "X days until last frost (date)" |
| No Zone Set | User has not set zone | "Set your zone to see frost dates" with link to Settings |
| Frost-Free Zone | Zone 11-13 | "Year-round growing - no frost expected" with green background |

**Interactions:**
- Tap card: navigates to Planting Calendar (GD-005) with frost dates highlighted
- Long press: shows alert schedule with upcoming notification dates

##### Screen: Frost Alert Settings (within Settings)

**Layout:**
- Section within app Settings screen
- Toggle: "Frost Alerts" (on/off, default on)
- Frost notification time: time picker (default 8:00 AM)
- Current zone display with "Change Zone" link
- Upcoming alerts preview: list of next 3 scheduled alert dates with descriptions

#### 3.6 Data Requirements

##### Entity: FrostAlert

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| alert_type | TEXT | One of: 'spring_4w', 'spring_2w', 'spring_1w', 'spring_day', 'spring_2w_after', 'fall_4w', 'fall_2w', 'fall_1w', 'fall_day' | None | Which milestone this alert represents |
| target_date | TEXT | ISO 8601 date | None | The date the notification should fire |
| year | INTEGER | Required | None | Which year this alert applies to (for deduplication) |
| delivered | INTEGER | 0 or 1 | 0 | Whether the notification has been delivered |
| dismissed | INTEGER | 0 or 1 | 0 | Whether the user has dismissed this alert |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Relationships:**
- FrostAlert is standalone (not linked to a plant; applies to the entire garden)

**Indexes:**
- `(alert_type, year)` UNIQUE - One alert per type per year
- `(target_date, delivered)` - Find undelivered alerts due today

**Validation Rules:**
- `alert_type` must be one of the allowed values
- `year` must be current year or next year
- Duplicate (alert_type, year) rejected

**Example Data:**

```json
{
  "id": "fa-spring-4w-2026",
  "alert_type": "spring_4w",
  "target_date": "2026-02-22",
  "year": 2026,
  "delivered": 1,
  "dismissed": 0,
  "created_at": "2026-01-01T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Alert Schedule Generation

**Purpose:** Compute the frost alert schedule for the current year based on the user's zone.

**Inputs:**
- zone: string (e.g., "7a")
- current_year: integer
- last_frost_date: date (from zone lookup)
- first_frost_date: date (from zone lookup)

**Logic:**

```
1. IF zone is 11-13 THEN RETURN empty schedule (frost-free zone)
2. GENERATE spring alerts:
     spring_4w:      target = last_frost_date - 28 days
     spring_2w:      target = last_frost_date - 14 days
     spring_1w:      target = last_frost_date - 7 days
     spring_day:     target = last_frost_date
     spring_2w_after: target = last_frost_date + 14 days
3. GENERATE fall alerts:
     fall_4w:        target = first_frost_date - 28 days
     fall_2w:        target = first_frost_date - 14 days
     fall_1w:        target = first_frost_date - 7 days
     fall_day:       target = first_frost_date
4. FOR EACH alert:
     IF target_date < today THEN mark as delivered (past)
     ELSE schedule local notification for target_date at user's notification time
5. PERSIST alerts in FrostAlert table (upsert by alert_type + year)
6. RETURN schedule
```

**Edge Cases:**
- Zone changed mid-year: regenerate schedule, cancel old notifications, schedule new ones
- Frost dates overridden by user: use overridden dates instead of zone defaults
- Alert date falls on today: deliver immediately
- Alert date is in the past when schedule is first generated (user set up zone late): mark as delivered, do not notify

##### Frost Countdown Calculation

**Purpose:** Compute the number of days until the next relevant frost milestone.

**Inputs:**
- current_date: date
- last_frost_date: date
- first_frost_date: date

**Logic:**

```
1. IF current_date < last_frost_date THEN
     countdown_type = 'last_frost'
     days_remaining = last_frost_date - current_date
2. ELSE IF current_date < first_frost_date - 28 THEN
     countdown_type = 'frost_free'
     days_remaining = null
3. ELSE IF current_date <= first_frost_date THEN
     countdown_type = 'first_frost'
     days_remaining = first_frost_date - current_date
4. ELSE
     // Winter: count to next year's last frost
     next_year_last_frost = last_frost_date + 1 year
     countdown_type = 'last_frost'
     days_remaining = next_year_last_frost - current_date
5. RETURN { countdown_type, days_remaining }
```

**Sort/Filter/Ranking Logic:**
- Not applicable (alerts are chronological; no user sorting or filtering)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Zone not set | Frost card shows "Set your zone to see frost dates" | User navigates to Settings and sets zone |
| Notification permission denied | Toast: "Enable notifications to receive frost alerts" with link to device settings | User enables notification permissions |
| Alert schedule generation fails | Frost card shows "Could not calculate frost dates" | App retries on next launch |
| Zone 11-13 selected | Frost card shows "Year-round growing - no frost expected"; alerts disabled | No user action needed |

**Validation Timing:**
- Zone validation happens in Settings (GD-024)
- Alert schedule regenerates on zone change

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is in Zone 7a (last frost March 22, first frost November 7),
   **When** they view the dashboard on February 22 (4 weeks before last frost),
   **Then** the frost card shows "28 days until last frost (Mar 22)" with a blue background, and a notification is delivered: "Last frost expected around March 22."

2. **Given** the user is in Zone 7a and it is June 15 (middle of growing season),
   **When** they view the dashboard,
   **Then** the frost card shows "Frost-free season. Enjoy!" with a green background.

3. **Given** the user is in Zone 7a and it is October 10 (4 weeks before first frost),
   **When** they view the dashboard,
   **Then** the frost card shows "28 days until first frost (Nov 7)" with a yellow background.

**Edge Cases:**

4. **Given** the user is in Zone 12 (year-round growing),
   **When** they view the frost settings,
   **Then** frost alerts are disabled with message "Year-round growing - no frost expected."

5. **Given** the user changes their zone from 7a to 5a mid-season,
   **When** the zone is updated,
   **Then** the frost schedule regenerates with new dates, old notifications are cancelled, and new ones are scheduled.

**Negative Tests:**

6. **Given** notification permissions are denied,
   **When** the frost alert system tries to schedule a notification,
   **Then** the frost card displays normally but no notification is sent, and a toast says "Enable notifications to receive frost alerts."

7. **Given** no zone is set,
   **When** the user views the dashboard,
   **Then** the frost card shows "Set your zone to see frost dates" and no alerts are scheduled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates spring alert 4 weeks before | last_frost: Mar 22 | alert target: Feb 22 |
| generates fall alert 2 weeks before | first_frost: Nov 7 | alert target: Oct 24 |
| returns frost-free for zone 12 | zone: "12a" | empty schedule |
| countdown to last frost | current: Feb 22, last_frost: Mar 22 | 28 days, type: last_frost |
| frost-free season detection | current: Jun 15, last_frost: Mar 22, first_frost: Nov 7 | type: frost_free |
| countdown to first frost | current: Oct 10, first_frost: Nov 7 | 28 days, type: first_frost |
| winter countdown to next year | current: Dec 15, last_frost: Mar 22 | ~97 days, type: last_frost |
| marks past alerts as delivered | target: Feb 1, today: Feb 22 | delivered: true |
| deduplicates alert per year | alert_type: spring_4w, year: 2026 (exists) | upsert, no duplicate |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Set zone and verify alerts generated | 1. Set zone to 7a, 2. Check FrostAlert table | 9 alert records created with correct target dates |
| Change zone and verify reschedule | 1. Set zone 7a, 2. Change to 5a, 3. Check FrostAlert table | Old alerts replaced with new frost dates for zone 5a |
| Dashboard card updates | 1. Set zone, 2. View dashboard on various dates | Card shows correct countdown type and days remaining |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User receives frost alerts through a year | 1. Set zone 7a in January, 2. Receive spring alerts (Feb-Apr), 3. Enjoy frost-free season, 4. Receive fall alerts (Oct-Nov) | 9 alerts delivered at correct times, dashboard card transitions through all states |

---

### GD-014: Plant Health Scoring

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-014 |
| **Feature Name** | Plant Health Scoring |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an indoor plant parent, I want each plant to have a health score that reflects how well it is doing based on my care habits, so that I can quickly identify which plants need more attention.

**Secondary:**
> As a data-oriented gardener, I want to see health score trends over time, so that I can correlate care changes with plant health improvements or declines.

#### 3.3 Detailed Description

Plant Health Scoring computes a numerical health score (0-100) for each plant based on a weighted combination of four factors:

1. **Watering Adherence (30%):** How consistently the user waters on schedule. Computed as the percentage of waterings completed within 1 day of the due date over the last 90 days.
2. **Pest-Free Status (30%):** Whether the plant has active pest or disease issues. Full score if no active issues. Score decreases based on the number and severity of active observations.
3. **Growth Rate (20%):** Measured by the frequency and quality of journal photo entries (GD-003). Plants with regular photo documentation showing visible growth score higher. This is a proxy since direct growth measurement is not automated.
4. **Appearance (20%):** A periodic user self-assessment where the user rates the plant's current appearance from 1-5 (wilting, yellowing, leggy, healthy, thriving). The app prompts for an appearance check every 30 days.

The health score formula:

```
health_score = (watering_adherence * 0.3) +
               (pest_free_score * 0.3) +
               (growth_rate_score * 0.2) +
               (appearance_score * 0.2)
```

Where each component is normalized to 0-100:

- **watering_adherence** = (on_time_waterings / total_due_waterings) * 100 over last 90 days
- **pest_free_score** = 100 if no active issues, 100 - (active_issues * severity_weight) otherwise, clamped to [0, 100]
  - severity_weight: severity 1 = 5, severity 2 = 10, severity 3 = 20, severity 4 = 30, severity 5 = 40
- **growth_rate_score** = min(100, (photo_entries_last_90_days / expected_entries) * 100)
  - expected_entries = 6 (one photo every ~2 weeks)
- **appearance_score** = (most_recent_appearance_rating / 5) * 100

Health scores are computed daily (or on-demand when viewing a plant's detail). The score is stored as a historical data point for trend tracking. The trend chart shows health scores over time, allowing the user to see if a plant's health is improving or declining.

Color coding for health scores:
- 80-100: Excellent (green)
- 60-79: Good (light green)
- 40-59: Fair (yellow)
- 20-39: Poor (orange)
- 0-19: Critical (red)

A "Health Check" prompt appears on the plant detail screen every 30 days, asking the user to rate the plant's appearance. The prompt is dismissible but encouraged for accurate scoring.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Health scores attach to plant records
- GD-002: Smart Watering Reminders - Watering adherence data
- GD-003: Growth Photo Journal - Photo frequency data
- GD-009: Pest and Disease Log - Active pest/disease data

**External Dependencies:**
- Local storage for health score history

**Assumed Capabilities:**
- Watering logs exist for adherence calculation
- Pest observations exist for pest-free calculation
- Journal entries exist for growth rate estimation

#### 3.5 User Interface Requirements

##### Component: Health Score Badge (Plant Detail)

**Layout:**
- Circular progress indicator showing the score (0-100) in the center
- Ring color matches the score tier (green/light green/yellow/orange/red)
- Below the circle: score label (e.g., "Excellent", "Good", "Fair", "Poor", "Critical")
- Below the label: 4 mini-bars showing the 4 component scores (watering, pest-free, growth, appearance) with labels
- "View Trend" link that opens the health score trend chart

##### Screen: Health Score Detail

**Layout:**
- Plant name and current health score at top
- Breakdown section: 4 cards, one per component:
  - Watering Adherence (30%): percentage, "X of Y waterings on time in last 90 days"
  - Pest-Free (30%): score, list of active issues if any
  - Growth Rate (20%): score, "X photos in last 90 days"
  - Appearance (20%): score, date of last appearance check, "Rate Now" button if stale
- Trend chart: line graph of health scores over time (daily data points, scrollable)
- Insights card: 1-2 sentences of auto-generated guidance (e.g., "Watering adherence is low. Try setting notifications to improve.")
- "Rate Appearance" button if last check was more than 30 days ago

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New Plant | Plant added less than 7 days ago | Message: "Health score will be available after 7 days of care data" |
| Insufficient Data | Not enough data in 1+ components | Components with insufficient data show "Not enough data" and are weighted at 0; remaining components scaled up proportionally |
| Populated | All 4 components have data | Full health score with breakdown |
| Appearance Stale | Last appearance check > 30 days ago | "Rate Appearance" prompt with yellow highlight |

**Interactions:**
- Tap component card: expands to show detailed breakdown
- Tap "Rate Appearance": opens 1-5 rating picker
- Tap "View Trend": scrolls to trend chart
- Tap data point on trend chart: shows score and date

**Transitions/Animations:**
- Health score ring: animated fill from 0 to score value, 600ms
- Component bars: animated fill, 400ms, staggered 100ms per bar

##### Modal: Appearance Rating

**Layout:**
- Title: "How does [Plant Name] look?"
- 5-option visual selector:
  1. Wilting (droopy plant icon)
  2. Yellowing (yellow leaf icon)
  3. Leggy (stretched plant icon)
  4. Healthy (normal plant icon)
  5. Thriving (lush plant icon)
- Optional note: text input, max 200 chars
- "Save" and "Skip" buttons

#### 3.6 Data Requirements

##### Entity: HealthScore

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Which plant this score is for |
| score_date | TEXT | ISO 8601 date, required | Current date | Date this score was computed |
| overall_score | REAL | Min 0, max 100 | None | Composite health score |
| watering_score | REAL | Min 0, max 100 | None | Watering adherence component |
| pest_free_score | REAL | Min 0, max 100 | None | Pest-free component |
| growth_score | REAL | Min 0, max 100 | None | Growth rate component |
| appearance_score | REAL | Min 0, max 100 | None | Appearance component |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: AppearanceRating

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Which plant was rated |
| rating | INTEGER | Required, min 1, max 5 | None | Appearance rating (1=wilting, 5=thriving) |
| note | TEXT | Optional, max 200 chars | null | Optional note about appearance |
| rated_date | TEXT | ISO 8601 date, required | Current date | When the rating was given |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Relationships:**
- HealthScore belongs to Plant (many-to-one via plant_id)
- AppearanceRating belongs to Plant (many-to-one via plant_id)

**Indexes:**
- HealthScore: `(plant_id, score_date DESC)` - Latest score per plant
- HealthScore: `score_date` - Query scores by date for dashboard
- AppearanceRating: `(plant_id, rated_date DESC)` - Latest rating per plant

**Validation Rules:**
- `overall_score`, component scores: Must be between 0 and 100
- `score_date`: Must not be in the future
- `rating`: Integer between 1 and 5
- One HealthScore per plant per day (upsert on score_date)
- AppearanceRating can have multiple per day (but only the most recent is used for scoring)

**Example Data:**

```json
{
  "id": "hs-001-monstera-20260307",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "score_date": "2026-03-07",
  "overall_score": 78.0,
  "watering_score": 90.0,
  "pest_free_score": 70.0,
  "growth_score": 66.7,
  "appearance_score": 80.0,
  "created_at": "2026-03-07T00:00:00Z"
}
```

```json
{
  "id": "ar-001-monstera-20260307",
  "plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "rating": 4,
  "note": "New leaf unfurling, looking healthy",
  "rated_date": "2026-03-07",
  "created_at": "2026-03-07T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Health Score Computation

**Purpose:** Compute the composite health score for a plant.

**Inputs:**
- plant_id: UUID
- current_date: date
- lookback_days: integer (default: 90)

**Logic:**

```
1. COMPUTE watering_adherence (0-100):
     due_waterings = count of watering events due in last 90 days
     on_time = count completed within 1 day of due date
     IF due_waterings == 0 THEN watering_score = null (insufficient data)
     ELSE watering_score = (on_time / due_waterings) * 100

2. COMPUTE pest_free_score (0-100):
     active_issues = QUERY PestObservations WHERE
       plant_id = input AND status IN ('observed', 'treated', 'ongoing')
     IF active_issues is empty THEN pest_free_score = 100
     ELSE
       penalty = SUM(severity_weight for each issue)
         where severity_weight = {1: 5, 2: 10, 3: 20, 4: 30, 5: 40}
       pest_free_score = MAX(0, 100 - penalty)

3. COMPUTE growth_rate_score (0-100):
     photo_count = COUNT(JournalEntries WHERE plant_id = input
       AND entry_date >= today - 90)
     expected = 6  // one every ~2 weeks
     growth_score = MIN(100, (photo_count / expected) * 100)

4. COMPUTE appearance_score (0-100):
     latest_rating = QUERY most recent AppearanceRating
       WHERE plant_id = input
     IF latest_rating is null THEN appearance_score = null (insufficient data)
     ELSE appearance_score = (latest_rating.rating / 5) * 100

5. COMPUTE overall_score:
     components = [
       { value: watering_score, weight: 0.3 },
       { value: pest_free_score, weight: 0.3 },
       { value: growth_score, weight: 0.2 },
       { value: appearance_score, weight: 0.2 }
     ]
     available = FILTER components WHERE value is not null
     IF available is empty THEN RETURN null (no data)
     total_weight = SUM(available.weight)
     overall = SUM(c.value * (c.weight / total_weight) for c in available)

6. STORE HealthScore record (upsert by plant_id + score_date)
7. RETURN { overall_score, watering_score, pest_free_score,
            growth_score, appearance_score }
```

**Formulas:**
- `health_score = (watering * 0.3) + (pest_free * 0.3) + (growth * 0.2) + (appearance * 0.2)`
- When components are missing, remaining weights are proportionally scaled up
- `pest_penalty: severity {1: 5, 2: 10, 3: 20, 4: 30, 5: 40}`

**Edge Cases:**
- New plant with no data: return null score, "Available after 7 days"
- Only watering data available: score = watering_score * (0.3 / 0.3) = watering_score (100% weight to available component)
- Plant with status dormant: watering adherence only counts waterings that were due during active periods
- Plant with status dead: no new health scores computed
- Multiple active pest issues: penalties stack but score floors at 0
- 6+ photos in 90 days: growth score caps at 100

##### Appearance Check Staleness

**Purpose:** Determine if the user should be prompted to rate a plant's appearance.

**Logic:**

```
1. QUERY most recent AppearanceRating for plant
2. IF no rating exists THEN stale = true
3. ELSE IF (today - rating.rated_date) > 30 THEN stale = true
4. ELSE stale = false
5. RETURN stale
```

##### Health Score Tier Classification

**Purpose:** Map a numerical score to a display tier.

**Logic:**

```
1. IF score >= 80 THEN tier = 'excellent', color = green
2. ELSE IF score >= 60 THEN tier = 'good', color = light_green
3. ELSE IF score >= 40 THEN tier = 'fair', color = yellow
4. ELSE IF score >= 20 THEN tier = 'poor', color = orange
5. ELSE tier = 'critical', color = red
```

**Sort/Filter/Ranking Logic:**
- **Default sort (in plant list context):** Score descending (healthiest first) when sorting by health
- **Health score is a sortable dimension** in the Plant List (GD-001)
- **No dedicated sort/filter** for the health detail screen

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient data for scoring | Component shows "Not enough data" with gray bar | Score uses available components only |
| Score computation fails | Badge shows "?" with tooltip "Could not compute health score" | Retry on next view or next day |
| Appearance rating save fails | Toast: "Could not save rating. Please try again." | User retries |
| All components null | Badge hidden; message: "Health score available after 7 days" | User continues caring for plant, score appears after data accumulates |

**Validation Timing:**
- Appearance rating validates immediately on selection
- Health score is computed on-demand (when viewing plant detail) and daily in background

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a Monstera with 90% watering adherence, no pest issues, 4 photos in 90 days, and appearance rating of 4,
   **When** the health score is computed,
   **Then** the score is: (90*0.3) + (100*0.3) + (66.7*0.2) + (80*0.2) = 27 + 30 + 13.3 + 16 = 86.3 (Excellent, green).

2. **Given** a plant with 2 active pest issues (severity 3 and severity 2),
   **When** the pest-free component is computed,
   **Then** pest_free_score = max(0, 100 - 20 - 10) = 70.

3. **Given** a plant's appearance was last rated 35 days ago,
   **When** the user views the plant detail,
   **Then** an appearance check prompt appears: "It has been 35 days since your last appearance check. How does [plant] look?"

**Edge Cases:**

4. **Given** a brand new plant with no watering or pest data,
   **When** the user views the health score badge,
   **Then** the badge is hidden with message "Health score available after 7 days."

5. **Given** a plant with only watering data (no pest log, no photos, no appearance rating),
   **When** the health score is computed,
   **Then** the score equals the watering adherence score (100% weight goes to the only available component).

**Negative Tests:**

6. **Given** a dead plant,
   **When** the health score system runs,
   **Then** no new health score is computed and the last score before death is preserved.

7. **Given** the user tries to rate appearance with 0,
   **When** they attempt to submit,
   **Then** the minimum rating of 1 is enforced.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| full score computation | watering: 90, pest: 100, growth: 66.7, appearance: 80 | overall: 86.3 |
| score with pest penalty | 2 active issues: severity 3, severity 2 | pest_free: 70 |
| score with max pest penalty | 3 issues: severity 5, 5, 5 | pest_free: 0 (clamped) |
| growth score caps at 100 | 10 photos in 90 days | growth: 100 |
| growth score with no photos | 0 photos | growth: 0 |
| appearance from rating 3 | rating: 3 | appearance: 60 |
| proportional weight with missing component | watering: 80, pest: null, growth: 60, appearance: 100 | overall: (80*0.3 + 60*0.2 + 100*0.2) / 0.7 * ... = weighted |
| staleness check at 31 days | last_rated: 31 days ago | stale: true |
| staleness check at 29 days | last_rated: 29 days ago | stale: false |
| tier classification 85 | score: 85 | tier: excellent, color: green |
| tier classification 45 | score: 45 | tier: fair, color: yellow |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Compute and store health score | 1. Add plant with 90 days of data, 2. Compute score | HealthScore record created with correct values |
| Score updates when pest logged | 1. Plant has score 90, 2. Log severity 3 pest, 3. Recompute | Score decreases by pest penalty |
| Appearance prompt appears | 1. Last rating 35 days ago, 2. View plant detail | Prompt shown, user can rate, score updates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User monitors plant health over time | 1. Care for plant for 90 days, 2. Log waterings, photos, appearance ratings, 3. View health trend | Health score trend chart shows 90 days of daily scores, current score badge on plant detail |

---

### GD-015: Plant Wish List

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-015 |
| **Feature Name** | Plant Wish List |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a plant enthusiast, I want to save a wish list of plants I would like to acquire someday, so that I can remember which plants caught my eye and reference the list when visiting nurseries.

**Secondary:**
> As a zone-conscious gardener, I want my wish list to indicate which plants are suitable for my USDA zone, so I do not waste money on plants that will not survive outdoors in my climate.

#### 3.3 Detailed Description

The Plant Wish List is a simple save-for-later feature where users can bookmark plants they want to acquire. Each wish list entry captures the plant name, species (linked to the plant care database if available), a priority level (low/medium/high), optional notes (e.g., where to buy, desired variety), and an optional photo (screenshot from a website, photo from a nursery visit, etc.).

When the user sets a USDA zone (GD-005), the wish list shows a zone compatibility badge for each entry. If the species data includes a hardiness range, the badge shows: green checkmark ("Hardy in your zone"), yellow warning ("Marginal - check micro-climate"), or red X ("Not hardy in your zone"). Indoor plants bypass zone checks.

Users can move a wish list item to the catalog by tapping "Acquired" on any entry. This action creates a new Plant record in the catalog (GD-001) pre-filled with the wish list entry's data (name, species, photo) and prompts the user to fill in the remaining fields (acquisition date, location, etc.). The wish list entry is then archived (not deleted) to preserve the history of wanted vs. acquired.

The wish list supports manual sorting (drag to reorder), priority-based sorting, and alphabetical sorting. A count badge on the wish list tab shows the total number of unacquired items.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - "Acquired" action creates a plant record
- GD-005: Planting Calendar by USDA Zone - Zone compatibility check (optional)
- GD-018: Plant Care Database - Species lookup for zone hardiness data (optional)

**External Dependencies:**
- Camera/photo library access for wish list photos (optional)
- Local storage for wish list records

**Assumed Capabilities:**
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Wish List

**Layout:**
- Top navigation bar displays "Wish List" title with count badge (e.g., "Wish List (12)")
- Sort control: dropdown with options "Custom Order", "Priority (High First)", "Name A-Z", "Date Added"
- Scrollable list of wish list items
- Each item card: plant name (bold), species name (italic, secondary), priority tag (High = red, Medium = yellow, Low = gray), zone compatibility badge (if zone set), optional photo thumbnail (50x50px, rounded), date added (secondary text)
- Drag handle on the left edge of each card (visible in "Custom Order" sort mode)
- Floating action button: "Add to Wish List" (plus icon with heart)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No wish list items | Centered illustration (plant with heart), heading "Your wish list is empty", subtext "Save plants you want to acquire", button "Add to Wish List" |
| Loading | Querying data | Skeleton placeholders for 4 cards |
| Populated | 1+ items | Scrollable card list |

**Interactions:**
- Tap "Add to Wish List" FAB: opens Add Wish List Item modal
- Tap item card: opens detail view with full notes, photo, zone compatibility, edit/delete/acquired options
- Tap "Acquired" on detail view: creates a Plant record from the wish list data and archives the item
- Long press card: opens context menu with "Edit", "Acquired", "Delete"
- Swipe left on card: reveals "Delete" (red) and "Acquired" (green) actions
- Drag (custom sort mode): reorder items by dragging the handle
- Pull-to-refresh: reloads list

**Transitions/Animations:**
- Acquired item: card turns green briefly, slides out with a checkmark animation, 300ms
- New item added: card slides in from the bottom, 200ms

##### Modal: Add/Edit Wish List Item

**Layout:**
- Title: "Add to Wish List" or "Edit Wish List Item"
- Plant name: text input, required, max 200 chars
- Species picker: searchable dropdown from plant care database (optional; for zone compatibility)
- Priority: segmented control - "Low" | "Medium" | "High" (default: Medium)
- Location intent: toggle - "Indoor" | "Outdoor" | "Not Sure" (default: Not Sure)
- Photo: camera/library picker, optional, max 1 photo
- Notes: multiline text, optional, max 1000 chars (e.g., "Saw at Green Thumb Nursery, $24.99")
- "Save" and "Cancel" buttons

#### 3.6 Data Requirements

##### Entity: WishListItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_name | TEXT | Required, max 200 chars | None | Desired plant name |
| species_id | TEXT (UUID) | Optional, references Species.id | null | Linked species for zone check |
| priority | TEXT | One of: 'low', 'medium', 'high' | 'medium' | Acquisition priority |
| location_intent | TEXT | One of: 'indoor', 'outdoor', 'not_sure' | 'not_sure' | Where the user plans to keep the plant |
| photo_path | TEXT | Optional | null | Local file path to a photo |
| notes | TEXT | Optional, max 1000 chars | null | User notes |
| sort_order | INTEGER | Min 0 | 0 | Custom sort position |
| status | TEXT | One of: 'wanted', 'acquired', 'removed' | 'wanted' | Current status |
| acquired_date | TEXT | ISO 8601 date, optional | null | When the user acquired this plant |
| linked_plant_id | TEXT (UUID) | Optional, references Plant.id | null | Plant record created on acquisition |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- WishListItem optionally references Species (many-to-one via species_id)
- WishListItem optionally references Plant (one-to-one via linked_plant_id, set on acquisition)

**Indexes:**
- `sort_order` - Custom ordering
- `status` - Filter wanted vs acquired
- `priority` - Sort by priority

**Validation Rules:**
- `plant_name`: Must not be empty after trimming
- `acquired_date`: Must not be in the future
- `linked_plant_id`: Set only when status changes to 'acquired'
- `sort_order`: Must be >= 0

**Example Data:**

```json
{
  "id": "wl-001-fiddle-leaf",
  "plant_name": "Fiddle Leaf Fig",
  "species_id": "sp-ficus-lyrata-001",
  "priority": "high",
  "location_intent": "indoor",
  "photo_path": "/data/garden/photos/wishlist/wl-001.jpg",
  "notes": "Saw a beautiful 4ft specimen at Green Thumb Nursery for $49.99. Would go great in the living room corner.",
  "sort_order": 0,
  "status": "wanted",
  "acquired_date": null,
  "linked_plant_id": null,
  "created_at": "2026-02-15T00:00:00Z",
  "updated_at": "2026-02-15T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Zone Compatibility Check

**Purpose:** Determine if a wish list plant is suitable for the user's USDA zone.

**Inputs:**
- species_id: UUID (from wish list item)
- user_zone: string (from settings)
- location_intent: enum

**Logic:**

```
1. IF location_intent == 'indoor' THEN
     RETURN { compatible: true, label: "Indoor - zone not applicable" }
2. IF species_id is null THEN
     RETURN { compatible: null, label: "Set species to check zone compatibility" }
3. IF user_zone is null THEN
     RETURN { compatible: null, label: "Set your zone to check compatibility" }
4. LOOKUP species hardiness range (min_zone, max_zone) from plant care database
5. IF species has no hardiness data THEN
     RETURN { compatible: null, label: "Hardiness data not available" }
6. PARSE user_zone to numeric value (e.g., "7a" -> 7.0, "7b" -> 7.5)
7. IF user_zone_numeric >= min_zone AND user_zone_numeric <= max_zone THEN
     RETURN { compatible: true, label: "Hardy in your zone", color: green }
8. IF user_zone_numeric >= min_zone - 1 AND user_zone_numeric <= max_zone + 1 THEN
     RETURN { compatible: 'marginal', label: "Marginal - check micro-climate", color: yellow }
9. RETURN { compatible: false, label: "Not hardy in your zone", color: red }
```

**Edge Cases:**
- Indoor plant: zone check bypassed
- No species selected: show "Set species to check compatibility"
- No zone set: show "Set your zone to check compatibility"
- Species with no hardiness data: show "Hardiness data not available"

##### Wish List to Catalog Conversion

**Purpose:** Create a Plant record from a wish list item when the user acquires the plant.

**Inputs:**
- wish_list_item_id: UUID

**Logic:**

```
1. LOAD wish list item
2. CREATE new Plant record with:
     common_name = item.plant_name
     species_id = item.species_id
     acquisition_date = today (or user-provided)
     acquisition_method = 'purchased' (default, user can change)
     status = 'alive'
     location_type = 'indoor' if location_intent == 'indoor',
                     'outdoor' if location_intent == 'outdoor',
                     'indoor' if 'not_sure' (default)
     primary_photo_path = item.photo_path (if exists, copy file to plant photos directory)
3. UPDATE wish list item:
     status = 'acquired'
     acquired_date = today
     linked_plant_id = new_plant.id
4. RETURN new_plant
```

**Edge Cases:**
- Photo path exists: file is copied to the plant photos directory (not moved; wish list archive retains reference)
- Species linked: care defaults auto-populate on the new Plant record
- User cancels after conversion starts: roll back both Plant creation and wish list update

**Sort/Filter/Ranking Logic:**
- **Default sort:** Custom order (sort_order ascending)
- **Available sort options:** Custom Order, Priority (High First), Name A-Z, Name Z-A, Date Added (Newest)
- **Filter options:** Status (wanted, acquired), Priority (low, medium, high)
- **Count badge:** Shows only "wanted" items

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on add | Toast: "Could not save wish list item. Please try again." | User retries |
| Plant name left blank | Inline validation: "Plant name is required" | User fills in field |
| Conversion to catalog fails | Toast: "Could not create plant from wish list. Please try again." Wish list item unchanged | User retries; no partial data created |
| Photo file save fails | Toast: "Could not save photo. Item saved without photo." | Item created without photo |
| Species not found during zone check | Badge shows "Hardiness data not available" | User can proceed without zone info |

**Validation Timing:**
- Plant name validation runs on blur
- Zone compatibility check runs on species selection change

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an empty wish list,
   **When** the user adds "Fiddle Leaf Fig" with high priority, indoor location, and a note "Green Thumb Nursery, $49.99",
   **Then** the wish list shows 1 item with "High" priority tag, and the count badge shows "(1)".

2. **Given** a wish list item "Fiddle Leaf Fig" with species linked and user in Zone 7a (species hardy zones 10-12),
   **When** the location intent is "Outdoor",
   **Then** a red zone badge shows "Not hardy in your zone."

3. **Given** a wish list item "Fiddle Leaf Fig",
   **When** the user taps "Acquired" and confirms,
   **Then** a new Plant record "Fiddle Leaf Fig" appears in the catalog with today as acquisition date, and the wish list item is archived.

**Edge Cases:**

4. **Given** a wish list item with location_intent "Indoor",
   **When** the zone compatibility is checked,
   **Then** the badge shows "Indoor - zone not applicable" (no zone warning).

5. **Given** a wish list item with no species linked,
   **When** the zone compatibility is checked,
   **Then** the badge shows "Set species to check zone compatibility."

**Negative Tests:**

6. **Given** the user tries to add a wish list item with a blank name,
   **When** they tap "Save",
   **Then** validation shows: "Plant name is required" and the item is not created.

7. **Given** the catalog conversion fails mid-way,
   **When** the user taps "Acquired",
   **Then** an error toast appears, the wish list item remains "wanted", and no partial Plant record exists.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| zone compatible outdoor | user: 7a, species: zones 5-9 | compatible: true, green |
| zone marginal outdoor | user: 7a, species: zones 8-11 | compatible: marginal, yellow |
| zone incompatible outdoor | user: 7a, species: zones 10-12 | compatible: false, red |
| indoor bypasses zone check | location: indoor, any species | compatible: true, "Indoor" |
| no species returns null | species_id: null | compatible: null |
| converts to plant record | wish item with name, species, photo | Plant created with matching fields |
| archives wish list on acquisition | item status: wanted | status: acquired, acquired_date: today |
| rejects empty name | plant_name: "   " | Validation error |
| validates sort_order non-negative | sort_order: -1 | Validation error |
| count badge shows wanted only | 3 wanted, 2 acquired | badge: 3 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add wish list item and check zone | 1. Add "Bird of Paradise" with species, outdoor, 2. User in zone 7a (species hardy 10-12) | Zone badge shows red "Not hardy" |
| Convert wish to catalog | 1. Add "Pothos" to wish list, 2. Tap "Acquired", 3. Check catalog | Plant "Pothos" in catalog, wish item archived, linked_plant_id set |
| Reorder wish list | 1. Add 5 items, 2. Drag item 5 to position 1 | sort_order updated, list displays in new order |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User builds and manages a wish list | 1. Add 5 plants with varying priorities, 2. Sort by priority, 3. Acquire 2, 4. View list | 3 wanted items remain, 2 archived as acquired, corresponding Plant records in catalog, count badge shows 3 |

---

### GD-016: Room and Zone Organization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-016 |
| **Feature Name** | Room and Zone Organization |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As an indoor plant parent with plants in every room, I want to organize my plants by room (Living Room, Kitchen, Bedroom, Bathroom, Office), so that I can quickly see all plants in a specific location and plan care room by room.

**Secondary:**
> As an outdoor gardener, I want to create custom zones (Front Yard, Back Garden, Greenhouse, Patio), so that I can group and filter plants by where they grow.

#### 3.3 Detailed Description

Room and Zone Organization provides a hierarchical location system for grouping plants. Users create named zones that represent physical locations. Each zone has a location type (indoor or outdoor), an optional description, and an optional light level classification. Plants are assigned to zones via the zone_id foreign key on the Plant record (GD-001).

The feature comes with a set of suggested indoor zones (Living Room, Kitchen, Bedroom, Bathroom, Office, Balcony, Windowsill) and outdoor zones (Front Yard, Back Yard, Garden, Greenhouse, Patio, Deck). Users can use the suggestions, create custom zones, rename them, merge two zones, or delete them (with an option to reassign plants).

Each zone optionally tracks a light level classification:
- Full Sun: 6+ hours of direct sunlight
- Bright Indirect: 4-6 hours of indirect or filtered sunlight
- Low Light: 2-4 hours of indirect light
- Shade: Less than 2 hours of light

The zone list provides a quick way to browse plants by location. Tapping a zone shows all plants assigned to it, with the option to bulk-assign or remove plants. A zone summary card shows the total plant count, the dominant care need (e.g., "Most plants here need watering this week"), and the average health score of plants in the zone (if GD-014 is enabled).

Zones also serve as a filter dimension in the Plant List (GD-001), Care Schedule (GD-006), and Watering Dashboard (GD-002). Users can filter any of those views by zone to focus on one location at a time.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Plants reference zones via zone_id

**External Dependencies:**
- Local storage for zone records

**Assumed Capabilities:**
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Zones

**Layout:**
- Top navigation bar displays "Zones" title with count badge (e.g., "Zones (8)")
- Two section headers: "Indoor" and "Outdoor"
- Each section contains zone cards in a vertical list
- Each zone card: zone name (bold), light level icon and label, plant count badge, optional description (secondary text, 1 line)
- "Add Zone" floating action button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No zones created | Illustration with heading "No zones yet", subtext "Organize your plants by location", button "Add Zone", plus "Use Suggested Zones" button that creates the default set |
| Loading | Querying data | Skeleton placeholders for 4 zone cards |
| Populated | 1+ zones exist | Zone cards grouped by indoor/outdoor |

**Interactions:**
- Tap zone card: shows all plants in that zone (filtered plant list)
- Long press zone card: context menu with "Edit", "Merge with...", "Delete"
- Tap "Add Zone": opens Add Zone modal
- Tap "Use Suggested Zones": bulk creates the 7 indoor + 6 outdoor default zones
- Swipe left on zone: reveals "Delete" action
- Pull-to-refresh: reloads zone list

**Transitions/Animations:**
- Zone addition: card slides in from the bottom, 200ms
- Zone deletion: card slides out to the left, 200ms

##### Modal: Add/Edit Zone

**Layout:**
- Title: "Add Zone" or "Edit [Zone Name]"
- Name: text input, required, max 100 chars
- Location type: segmented control - "Indoor" | "Outdoor"
- Light level: dropdown - "Full Sun", "Bright Indirect", "Low Light", "Shade", "Not Set"
- Description: text input, optional, max 200 chars
- "Save" and "Cancel" buttons

##### Modal: Merge Zones

**Layout:**
- Title: "Merge Zones"
- Source zone (being merged away): displayed as read-only label
- Target zone (plants will move here): dropdown of other zones
- Preview: "[X] plants will be moved from [Source] to [Target]"
- Warning: "This will delete [Source Zone] after moving all plants."
- "Merge" and "Cancel" buttons

#### 3.6 Data Requirements

##### Entity: Zone

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, max 100 chars | None | Zone display name |
| location_type | TEXT | One of: 'indoor', 'outdoor' | 'indoor' | Physical location classification |
| light_level | TEXT | One of: 'full_sun', 'bright_indirect', 'low_light', 'shade', null | null | Light availability |
| description | TEXT | Optional, max 200 chars | null | User note about this zone |
| sort_order | INTEGER | Min 0 | 0 | Display ordering within location type |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Zone has many Plant (one-to-many via Plant.zone_id)

**Indexes:**
- `(location_type, sort_order)` - Sorted listing by location type
- `name COLLATE NOCASE` - Case-insensitive name uniqueness check

**Validation Rules:**
- `name`: Must not be empty after trimming; must be unique within the same location_type (case-insensitive)
- `sort_order`: Must be >= 0
- Deleting a zone with plants: user must choose to reassign plants to another zone or remove zone assignment

**Example Data:**

```json
{
  "id": "zone-001-living-room",
  "name": "Living Room",
  "location_type": "indoor",
  "light_level": "bright_indirect",
  "description": "Large south-facing window, gets afternoon sun",
  "sort_order": 0,
  "created_at": "2026-03-01T00:00:00Z",
  "updated_at": "2026-03-01T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Zone Merge

**Purpose:** Consolidate two zones into one, moving all plants.

**Inputs:**
- source_zone_id: UUID (zone being merged away)
- target_zone_id: UUID (zone receiving the plants)

**Logic:**

```
1. VALIDATE source_zone_id != target_zone_id
2. QUERY all Plants WHERE zone_id = source_zone_id
3. UPDATE all matched Plants SET zone_id = target_zone_id
4. DELETE source zone record
5. RETURN { plants_moved: count, target_zone: target_name }
```

**Edge Cases:**
- Source zone has 0 plants: zone is deleted, no plant updates needed
- Source and target have same location_type: straightforward merge
- Source is indoor, target is outdoor (or vice versa): allowed, but update Plant.location_type to match target zone's location_type
- Target zone does not exist: reject merge

##### Zone Deletion with Plant Reassignment

**Purpose:** Delete a zone and handle its assigned plants.

**Inputs:**
- zone_id: UUID
- action: enum ('reassign', 'unassign')
- target_zone_id: UUID (only when action = 'reassign')

**Logic:**

```
1. QUERY all Plants WHERE zone_id = input
2. IF action == 'reassign' THEN
     UPDATE all Plants SET zone_id = target_zone_id
3. ELSE IF action == 'unassign' THEN
     UPDATE all Plants SET zone_id = null
4. DELETE zone record
5. RETURN success
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** sort_order ascending within each location_type group
- **Available sort options:** Custom Order (drag), Name A-Z, Name Z-A, Plant Count (most first)
- **No filter options** on the zone list

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Zone name left blank | Inline validation: "Zone name is required" | User fills in field |
| Duplicate zone name in same location type | Inline validation: "A zone named '[name]' already exists for [indoor/outdoor]" | User picks a different name |
| Delete zone with plants and no action selected | Confirmation: "This zone has [N] plants. Choose an action: reassign to another zone or remove zone assignment." | User selects an action |
| Merge source and target are same | Error: "Cannot merge a zone with itself" | User selects a different target |

**Validation Timing:**
- Name validation runs on blur (checks uniqueness)
- Merge validation runs on target selection

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** no zones exist,
   **When** the user taps "Use Suggested Zones",
   **Then** 13 zones are created (7 indoor, 6 outdoor) with default names and sort orders.

2. **Given** a "Living Room" zone with 5 plants,
   **When** the user taps the zone card,
   **Then** a filtered plant list shows only the 5 plants assigned to "Living Room."

3. **Given** "Living Room" zone with 3 plants and "Den" zone with 2 plants,
   **When** the user merges "Den" into "Living Room",
   **Then** "Living Room" now has 5 plants, "Den" is deleted, and all affected Plant records have zone_id updated.

**Edge Cases:**

4. **Given** a zone named "Kitchen" exists for indoor,
   **When** the user tries to create another indoor zone named "Kitchen",
   **Then** validation shows: "A zone named 'Kitchen' already exists for indoor."

5. **Given** a zone with 10 plants is being deleted,
   **When** the user selects "Remove zone assignment",
   **Then** all 10 plants have zone_id set to null, and the zone is deleted.

**Negative Tests:**

6. **Given** the user tries to merge a zone with itself,
   **When** they select the same zone as both source and target,
   **Then** the system shows: "Cannot merge a zone with itself."

7. **Given** the user leaves the zone name blank,
   **When** they tap "Save",
   **Then** validation shows: "Zone name is required."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates zone with valid data | name: "Patio", type: outdoor | Zone created |
| rejects empty zone name | name: "   " | Validation error |
| rejects duplicate name same type | existing: "Kitchen" indoor, new: "Kitchen" indoor | Validation error |
| allows duplicate name different type | existing: "Garden" indoor, new: "Garden" outdoor | Allowed |
| merge moves plants | source: 3 plants, target: 2 plants | target: 5 plants, source deleted |
| merge with empty source | source: 0 plants | source deleted, target unchanged |
| delete with reassign | zone: 4 plants, reassign to target | target gets 4 plants, zone deleted |
| delete with unassign | zone: 4 plants, unassign | 4 plants zone_id = null, zone deleted |
| rejects self-merge | source == target | Error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create zone and assign plants | 1. Create "Office" zone, 2. Edit Fern plant, set zone to "Office", 3. View "Office" zone | Fern appears in Office zone list, Office card shows "1 plant" |
| Bulk create suggested zones | 1. Tap "Use Suggested Zones" | 13 zones created, grouped correctly |
| Zone filter in plant list | 1. Create 2 zones, 2. Assign plants, 3. Filter plant list by zone | Only plants in selected zone shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User organizes entire collection | 1. Create zones for each room, 2. Assign all plants, 3. View zone summary | Each zone shows correct plant count, light levels, tapping zone shows filtered plant list |

---

### GD-017: Seasonal Care Adjustments

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-017 |
| **Feature Name** | Seasonal Care Adjustments |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a houseplant owner, I want the app to automatically adjust care schedules (watering frequency, fertilizer timing, light recommendations) as seasons change, so that I do not overwater in winter or underwater in summer.

**Secondary:**
> As a gardener in a region with distinct seasons, I want seasonal care tips specific to each plant and the current month, so I know what to expect and how to prepare.

#### 3.3 Detailed Description

Seasonal Care Adjustments provides the display and notification layer for the seasonal multiplier system already built into the watering (GD-002) and care schedule (GD-006) engines. While those features compute the math, this feature provides the user-facing experience: seasonal transition banners, per-plant seasonal tips, and seasonal checklists.

When the season changes (based on the user's hemisphere setting), the app displays a seasonal transition card at the top of the dashboard:

| Season Transition | Banner Message | Key Actions |
|-------------------|----------------|-------------|
| Winter to Spring | "Spring is here! Time to increase watering, resume fertilizing, and start seeds indoors." | Resume fertilizer schedules, check for new growth, start seed calendar |
| Spring to Summer | "Summer care mode: more frequent watering, watch for pests, and harvest early crops." | Increase watering frequency, apply pest prevention, harvest ripe produce |
| Summer to Fall | "Fall is approaching: reduce watering, last chance to fertilize, prepare for frost." | Reduce watering, final fertilizer application, bring in cold-sensitive plants |
| Fall to Winter | "Winter mode: minimal watering, stop fertilizing, protect outdoor plants from frost." | Reduce watering to minimum, stop fertilizer, cover or bring in outdoor plants |

Each plant has species-specific seasonal tips stored in the plant care database (GD-018). These tips appear on the Plant Detail screen in a collapsible "Seasonal Tips" section that updates when the season changes. Example tips:

- Monstera in Winter: "Reduce watering to every 2-3 weeks. No fertilizer. Keep away from cold drafts."
- Tomato in Spring: "Start seeds indoors 6-8 weeks before last frost. Begin hardening off seedlings."

A seasonal checklist provides a to-do list at each season transition with actionable items for the user's specific plant collection. Items are auto-generated based on the plants in the catalog and their care needs:

- "Resume fertilizing for 12 plants that were paused in winter"
- "Check 5 outdoor plants for winter damage"
- "Increase watering frequency for 18 plants (summer multiplier active)"

The checklist persists until all items are checked off or the next season begins.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-002: Smart Watering Reminders - Seasonal multiplier system
- GD-006: Care Schedule - Seasonal care pausing/resuming
- GD-018: Plant Care Database - Species-specific seasonal tips
- GD-024: Settings and Preferences - Hemisphere setting

**External Dependencies:**
- System clock for season determination

**Assumed Capabilities:**
- User has configured hemisphere in settings
- Plants exist in the catalog with species references

#### 3.5 User Interface Requirements

##### Component: Seasonal Banner (Dashboard)

**Layout:**
- Full-width card at the top of the dashboard, displayed for 14 days after each season transition
- Season icon (leaf for spring, sun for summer, maple leaf for fall, snowflake for winter)
- Season name and date range (e.g., "Spring - March 1 to May 31")
- 1-sentence summary of key care changes
- "View Checklist" button
- Dismissible (X button), but reappears on next app launch until 14 days pass

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active | Within 14 days of season change | Seasonal banner visible |
| Dismissed | User tapped X | Banner hidden until next launch (within 14-day window) |
| Expired | More than 14 days past season change | Banner not shown |
| No Hemisphere | Hemisphere not set | "Set your hemisphere in Settings for seasonal care tips" |

##### Screen: Seasonal Checklist

**Layout:**
- Title: "[Season] Care Checklist"
- Subtitle: "[N] of [Total] completed"
- Progress bar showing completion percentage
- Scrollable list of checklist items, grouped by category:
  - "Watering Changes" (items about frequency adjustments)
  - "Fertilizer" (items about starting/stopping fertilizer)
  - "Plant Protection" (items about frost, pests, moving plants)
  - "Planting" (items about seed starting, transplanting)
- Each item: checkbox, description text, affected plant count (e.g., "Affects 12 plants")
- Tapping an unchecked item opens a detail view with the specific plants affected and a "Mark All Done" button

**Interactions:**
- Tap checkbox: marks item complete, progress bar updates
- Tap item text: expands to show affected plants
- Tap "Mark All Done" on expanded item: marks the item and all sub-tasks complete

##### Component: Seasonal Tips Card (Plant Detail)

**Layout:**
- Collapsible section titled "Seasonal Tips - [Season]"
- Icon matching current season
- 2-4 bullet points of species-specific advice for the current season
- Collapsed by default; expanding shows full tips

#### 3.6 Data Requirements

##### Entity: SeasonalChecklist

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| season | TEXT | One of: 'spring', 'summer', 'fall', 'winter' | None | Which season this checklist is for |
| year | INTEGER | Required | None | Which year |
| hemisphere | TEXT | One of: 'northern', 'southern' | None | Hemisphere when generated |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: ChecklistItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| checklist_id | TEXT (UUID) | Required, references SeasonalChecklist.id | None | Parent checklist |
| category | TEXT | One of: 'watering', 'fertilizer', 'protection', 'planting' | None | Item category |
| description | TEXT | Required, max 500 chars | None | What to do |
| affected_plant_count | INTEGER | Min 0 | 0 | How many plants this applies to |
| completed | INTEGER | 0 or 1 | 0 | Whether the user has checked this off |
| completed_date | TEXT | ISO 8601 date, optional | null | When completed |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Relationships:**
- SeasonalChecklist has many ChecklistItem (one-to-many via checklist_id)

**Indexes:**
- SeasonalChecklist: `(season, year, hemisphere)` UNIQUE - One checklist per season per year
- ChecklistItem: `(checklist_id, completed)` - Find uncompleted items

**Validation Rules:**
- One SeasonalChecklist per (season, year, hemisphere) tuple
- `description`: Must not be empty
- `completed_date`: Set automatically when completed is set to 1

**Example Data:**

```json
{
  "id": "cl-spring-2026-n",
  "season": "spring",
  "year": 2026,
  "hemisphere": "northern",
  "created_at": "2026-03-01T00:00:00Z"
}
```

```json
{
  "id": "cli-001-resume-fert",
  "checklist_id": "cl-spring-2026-n",
  "category": "fertilizer",
  "description": "Resume fertilizing for plants that were paused during winter",
  "affected_plant_count": 12,
  "completed": 0,
  "completed_date": null,
  "created_at": "2026-03-01T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Seasonal Checklist Generation

**Purpose:** Auto-generate a season-specific checklist based on the user's plant collection.

**Inputs:**
- season: string
- hemisphere: string
- plants: array of Plant records with species data

**Logic:**

```
1. CREATE new SeasonalChecklist for (season, year, hemisphere)
2. IF season == 'spring' THEN GENERATE:
     - "Resume fertilizing for [N] plants that were paused during winter"
       (N = count of plants with fertilizer config having active_seasons excluding winter)
     - "Increase watering frequency for [N] plants (spring multiplier active)"
       (N = count of all alive plants with watering schedules)
     - "Check [N] outdoor plants for winter damage"
       (N = count of outdoor alive plants)
     - "Start seeds indoors for [N] species with indoor seed windows"
       (N = species with planting windows starting before last frost)
     - "Begin hardening off seedlings that were started indoors"
       (only if user has seed inventory items with indoor start)
3. IF season == 'summer' THEN GENERATE:
     - "Increase watering frequency (summer multiplier active)"
     - "Watch for pests on [N] outdoor plants"
     - "Harvest ripe produce from [N] edible plants"
     - "Apply pest prevention treatments"
4. IF season == 'fall' THEN GENERATE:
     - "Reduce watering frequency (fall multiplier active)"
     - "Apply final fertilizer before winter dormancy"
     - "Bring [N] cold-sensitive outdoor plants indoors before frost"
     - "Harvest remaining produce"
5. IF season == 'winter' THEN GENERATE:
     - "Reduce watering to minimum (winter multiplier active)"
     - "Stop fertilizing for [N] plants"
     - "Protect [N] outdoor plants from frost"
     - "Review seed inventory for spring planning"
6. SKIP items where affected_plant_count == 0
7. PERSIST all items
```

**Edge Cases:**
- User has only indoor plants: outdoor-specific items omitted
- User has no edible plants: harvest items omitted
- Zone 11-13 (no seasons): single year-round checklist with general maintenance items
- Checklist already exists for this season/year: do not regenerate, use existing

##### Season Detection

**Purpose:** Determine the current season based on date and hemisphere.

**Logic:**

```
1. IF hemisphere == 'northern' THEN
     spring: March 1 - May 31
     summer: June 1 - August 31
     fall: September 1 - November 30
     winter: December 1 - February 28/29
2. IF hemisphere == 'southern' THEN
     spring: September 1 - November 30
     summer: December 1 - February 28/29
     fall: March 1 - May 31
     winter: June 1 - August 31
3. RETURN current_season
```

(Same as GD-002 seasonal detection.)

**Sort/Filter/Ranking Logic:**
- Checklist items sorted by category order: watering, fertilizer, protection, planting
- No user sort/filter on checklists

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Hemisphere not set | Banner: "Set your hemisphere in Settings for seasonal care tips" | User navigates to Settings |
| Checklist generation fails | Toast: "Could not generate seasonal checklist. Try again." | User pulls to refresh |
| No plants in catalog | No checklist generated; banner still shows general seasonal message | User adds plants |

**Validation Timing:**
- Season detection runs on app launch and on Settings hemisphere change
- Checklist generation runs on first season detection of a new season

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is in the northern hemisphere and the date changes from February 28 to March 1,
   **When** they open the app,
   **Then** a spring seasonal banner appears: "Spring is here!" with a "View Checklist" button.

2. **Given** the spring checklist has 5 items and the user completes 3,
   **When** they view the checklist,
   **Then** the progress bar shows "3 of 5 completed" (60%).

3. **Given** a Monstera plant with spring seasonal tips in the database,
   **When** the user views the Monstera detail in March,
   **Then** a "Seasonal Tips - Spring" card shows species-specific advice.

**Edge Cases:**

4. **Given** the user has only indoor plants,
   **When** the spring checklist generates,
   **Then** outdoor-specific items (e.g., "Check outdoor plants for winter damage") are omitted.

5. **Given** the user dismisses the seasonal banner,
   **When** they close and reopen the app within the 14-day window,
   **Then** the banner reappears.

**Negative Tests:**

6. **Given** no hemisphere is set,
   **When** the season transition occurs,
   **Then** no seasonal banner appears; instead a prompt says "Set your hemisphere in Settings."

7. **Given** a checklist already exists for spring 2026,
   **When** the app detects spring 2026 again,
   **Then** the existing checklist is shown; no duplicate is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects spring northern | date: Mar 15, hemisphere: northern | season: spring |
| detects winter southern | date: Jul 15, hemisphere: southern | season: winter |
| generates spring checklist items | 10 indoor plants, 5 outdoor, 3 edible | 5 items (watering, fertilizer, outdoor check, seeds, hardening off) |
| omits outdoor items for indoor-only | 10 indoor plants, 0 outdoor | 3 items (no outdoor check, no frost protection) |
| skips zero-count items | 0 edible plants | harvest item omitted |
| deduplicates checklists | spring 2026 already exists | no new checklist created |
| banner visible for 14 days | season change Mar 1, current: Mar 10 | banner active |
| banner expired after 14 days | season change Mar 1, current: Mar 20 | banner expired |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Season transition generates checklist | 1. Set hemisphere northern, 2. Date reaches Mar 1, 3. Open app | Spring banner shown, checklist generated with correct items and plant counts |
| Complete checklist items | 1. View spring checklist, 2. Check off "Resume fertilizing", 3. View progress | Progress updates, completed_date set |
| Seasonal tips on plant detail | 1. View Monstera detail in March | "Seasonal Tips - Spring" section shows species-specific advice |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User follows seasonal transition | 1. Winter ends, spring begins, 2. View banner, 3. Complete all checklist items, 4. View care schedules | Banner dismissed after 14 days, all checklist items checked, watering frequency increased by spring multiplier, fertilizer resumed |

---

### GD-018: Plant Care Database

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-018 |
| **Feature Name** | Plant Care Database |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a beginner gardener, I want to look up care instructions for any plant species (sunlight, watering frequency, soil type, temperature range), so that I know exactly how to care for each plant without researching online.

**Secondary:**
> As an experienced gardener, I want the care database to pre-fill defaults when I add a new plant, so I do not have to manually enter watering intervals, fertilizer schedules, and other care parameters every time.

#### 3.3 Detailed Description

The Plant Care Database is a bundled, read-only reference database containing care information for approximately 300 common houseplants, garden vegetables, herbs, and flowers. Each species entry includes botanical name, common names, care requirements, growing conditions, hardiness zones, planting windows, and companion planting data.

The database ships as a pre-populated SQLite table within the app. Updates to the database are delivered through app updates (not network fetches), maintaining the offline-first privacy guarantee. Users cannot modify the bundled data but can see it and use it to auto-populate care defaults for their plants.

Each species record contains:

| Category | Fields |
|----------|--------|
| Identity | Scientific name, common names (array), family, genus |
| Watering | Base watering interval (days), drought tolerance (low/medium/high) |
| Light | Preferred light level (full sun, bright indirect, low light, shade), min/max hours |
| Soil | Preferred soil type, pH range (min, max) |
| Temperature | Min safe temp (F), max safe temp (F), ideal range (F) |
| Humidity | Preferred humidity level (low/medium/high), ideal percentage range |
| Fertilizer | Preferred NPK ratio description, fertilize frequency (days), active seasons |
| Growth | Growth rate (slow/moderate/fast), mature height range (inches), mature width range (inches) |
| Hardiness | USDA zone range (min_zone, max_zone) |
| Planting | Planting windows (linked PlantingWindow records from GD-005) |
| Propagation | Propagation methods (array: seed, cutting, division, layering, etc.) |
| Toxicity | Toxic to pets (boolean), toxic to humans (boolean), toxicity notes |
| Seasonal Tips | Spring/summer/fall/winter care tips (text per season) |
| Companion | Companion planting relationships (linked CompanionRelationship records from GD-007) |

The database view provides a searchable, browsable catalog of all species. Users search by common name or scientific name and can browse by category (houseplants, vegetables, herbs, flowers, succulents, trees). Each species detail page shows all care information in an organized layout.

When the user selects a species for a Plant record (GD-001), the care defaults are applied:
- `base_watering_interval` is set from the species default (user can override)
- Light, soil, temperature, and humidity preferences are displayed on the Plant Detail screen
- Fertilizer schedule is pre-configured in the Care Schedule (GD-006)
- Planting windows are added to the Planting Calendar (GD-005)
- Companion planting data is available in the Companion Matrix (GD-007)

The initial release targets approximately 300 species across these categories:
- Houseplants: ~100 species (Monstera, Pothos, Snake Plant, Fiddle Leaf Fig, etc.)
- Vegetables: ~80 species (Tomato, Pepper, Lettuce, Carrot, etc.)
- Herbs: ~40 species (Basil, Rosemary, Thyme, Mint, etc.)
- Flowers: ~50 species (Marigold, Sunflower, Lavender, Rose, etc.)
- Succulents: ~30 species (Aloe, Echeveria, Jade Plant, etc.)

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is a foundational reference database used by many other features)

**External Dependencies:**
- Bundled species database (~300 entries, ~500 KB in SQLite format)

**Assumed Capabilities:**
- Local database is initialized and the bundled species table is loaded

#### 3.5 User Interface Requirements

##### Screen: Plant Care Database

**Layout:**
- Top navigation bar displays "Plant Care" title
- Search bar: prominent text input at the top, searches by common name and scientific name
- Category filter: horizontal scrollable chips - "All", "Houseplants", "Vegetables", "Herbs", "Flowers", "Succulents", "Trees"
- Results list: scrollable vertical list of species cards
- Each species card: common name (bold), scientific name (italic), category badge, small icon row showing key attributes (light level icon, water frequency icon, temperature range)
- Tapping a card opens the Species Detail screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | No search query | Browsable list sorted alphabetically, with category chips |
| Search Active | User has typed 2+ characters | Filtered results matching search query |
| No Results | Search yields no matches | "No species matching '[query]'" with suggestion: "Try a different name or browse by category" |
| Loading | Database query running | Skeleton placeholders for 6 species cards |

**Interactions:**
- Type in search bar: filters list with debounce (300ms) after 2+ characters
- Tap category chip: filters to that category
- Tap species card: opens Species Detail screen
- Clear search (X button): returns to full browsable list
- Pull-to-refresh: not applicable (bundled data does not change)

##### Screen: Species Detail

**Layout:**
- Large header with common name and scientific name
- Category and family/genus labels
- Sections (collapsible):
  1. **Watering:** interval, drought tolerance, seasonal adjustments
  2. **Light:** preferred level, hours, placement tips
  3. **Soil & Fertilizer:** soil type, pH range, NPK ratio, frequency
  4. **Temperature & Humidity:** ranges, ideal conditions
  5. **Growth:** rate, mature size, growth habits
  6. **Hardiness:** USDA zone range with "Compatible with your zone?" badge (if zone set)
  7. **Propagation:** methods with brief instructions
  8. **Toxicity:** pet/human toxicity with warnings if toxic
  9. **Seasonal Tips:** expandable per-season advice
  10. **Companion Planting:** list of beneficial/harmful companions
- "Add to My Plants" button at the bottom (creates a Plant record pre-filled with this species' data)
- "Add to Wish List" button (creates a wish list item linked to this species)

**Interactions:**
- Tap section header: expand/collapse section
- Tap "Add to My Plants": opens Add Plant modal pre-filled with species data
- Tap "Add to Wish List": creates a wish list entry linked to this species
- Tap companion name: navigates to that species' detail

#### 3.6 Data Requirements

##### Entity: Species (Bundled, Read-Only)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| scientific_name | TEXT | Required, unique | None | Binomial nomenclature |
| common_names | TEXT | Required, JSON array | None | Array of common names |
| family | TEXT | Required | None | Plant family (e.g., "Araceae") |
| genus | TEXT | Required | None | Plant genus (e.g., "Monstera") |
| category | TEXT | One of: 'houseplant', 'vegetable', 'herb', 'flower', 'succulent', 'tree' | None | Plant category |
| base_watering_interval | INTEGER | Min 1, max 90 | 7 | Default days between watering |
| drought_tolerance | TEXT | One of: 'low', 'medium', 'high' | 'medium' | How well the plant tolerates missed waterings |
| light_level | TEXT | One of: 'full_sun', 'bright_indirect', 'low_light', 'shade' | None | Preferred light |
| light_hours_min | INTEGER | Min 0, max 24 | None | Minimum hours of light |
| light_hours_max | INTEGER | Min 0, max 24 | None | Maximum hours of light |
| soil_type | TEXT | Required | None | Preferred soil mix |
| soil_ph_min | REAL | Min 0, max 14 | None | Minimum soil pH |
| soil_ph_max | REAL | Min 0, max 14 | None | Maximum soil pH |
| temp_min_f | INTEGER | Min -60, max 140 | None | Minimum safe temperature (F) |
| temp_max_f | INTEGER | Min -60, max 140 | None | Maximum safe temperature (F) |
| temp_ideal_min_f | INTEGER | Min -60, max 140 | None | Ideal minimum temperature (F) |
| temp_ideal_max_f | INTEGER | Min -60, max 140 | None | Ideal maximum temperature (F) |
| humidity_level | TEXT | One of: 'low', 'medium', 'high' | 'medium' | Preferred humidity |
| humidity_min_pct | INTEGER | Min 0, max 100 | None | Minimum ideal humidity percentage |
| humidity_max_pct | INTEGER | Min 0, max 100 | None | Maximum ideal humidity percentage |
| fertilizer_npk_pref | TEXT | Optional | null | Preferred NPK ratio description (e.g., "balanced 10-10-10") |
| fertilizer_interval_days | INTEGER | Optional, min 7, max 365 | null | Default fertilizer frequency |
| fertilizer_active_seasons | TEXT | Optional, comma-separated | null | Seasons to fertilize |
| growth_rate | TEXT | One of: 'slow', 'moderate', 'fast' | 'moderate' | Speed of growth |
| mature_height_min_in | INTEGER | Optional | null | Minimum mature height (inches) |
| mature_height_max_in | INTEGER | Optional | null | Maximum mature height (inches) |
| mature_width_min_in | INTEGER | Optional | null | Minimum mature spread (inches) |
| mature_width_max_in | INTEGER | Optional | null | Maximum mature spread (inches) |
| hardiness_zone_min | REAL | Optional, min 1, max 13 | null | Minimum USDA zone (e.g., 7.0 for zone 7a) |
| hardiness_zone_max | REAL | Optional, min 1, max 13 | null | Maximum USDA zone |
| propagation_methods | TEXT | Optional, JSON array | null | Array of propagation method strings |
| toxic_to_pets | INTEGER | 0 or 1 | 0 | Toxic to cats/dogs |
| toxic_to_humans | INTEGER | 0 or 1 | 0 | Toxic if ingested by humans |
| toxicity_notes | TEXT | Optional | null | Toxicity details |
| tip_spring | TEXT | Optional, max 500 chars | null | Spring care tips |
| tip_summer | TEXT | Optional, max 500 chars | null | Summer care tips |
| tip_fall | TEXT | Optional, max 500 chars | null | Fall care tips |
| tip_winter | TEXT | Optional, max 500 chars | null | Winter care tips |
| seed_viability_years | INTEGER | Optional, min 1, max 20 | null | How long seeds stay viable |
| gdd_base_temp_f | REAL | Optional | 50.0 | Base temperature for GDD calculation |
| description | TEXT | Optional | null | General description of the species |

**Relationships:**
- Species has many PlantingWindow (one-to-many via species_id in GD-005)
- Species has many CompanionRelationship (via species_a_id or species_b_id in GD-007)
- Species is referenced by Plant (one-to-many via species_id in GD-001)
- Species is referenced by SeedPacket (one-to-many via species_id in GD-011)

**Indexes:**
- `scientific_name` UNIQUE - Canonical species identifier
- `category` - Filter by plant category
- FTS5 index on `common_names, scientific_name, family, genus` - Full-text search

**Validation Rules:**
- Species records are read-only; the app does not modify this table
- `common_names` must be a valid JSON array with at least 1 entry
- `scientific_name` must be unique
- `light_hours_max` must be >= `light_hours_min`
- `temp_max_f` must be >= `temp_min_f`
- `soil_ph_max` must be >= `soil_ph_min`

**Example Data:**

```json
{
  "id": "sp-monstera-deliciosa-001",
  "scientific_name": "Monstera deliciosa",
  "common_names": "[\"Monstera\", \"Swiss Cheese Plant\", \"Split-Leaf Philodendron\"]",
  "family": "Araceae",
  "genus": "Monstera",
  "category": "houseplant",
  "base_watering_interval": 7,
  "drought_tolerance": "medium",
  "light_level": "bright_indirect",
  "light_hours_min": 4,
  "light_hours_max": 6,
  "soil_type": "Well-draining peat-based mix with perlite",
  "soil_ph_min": 5.5,
  "soil_ph_max": 7.0,
  "temp_min_f": 50,
  "temp_max_f": 95,
  "temp_ideal_min_f": 65,
  "temp_ideal_max_f": 85,
  "humidity_level": "high",
  "humidity_min_pct": 60,
  "humidity_max_pct": 80,
  "fertilizer_npk_pref": "balanced 20-20-20",
  "fertilizer_interval_days": 30,
  "fertilizer_active_seasons": "spring,summer",
  "growth_rate": "moderate",
  "mature_height_min_in": 72,
  "mature_height_max_in": 120,
  "mature_width_min_in": 36,
  "mature_width_max_in": 72,
  "hardiness_zone_min": 10.0,
  "hardiness_zone_max": 12.0,
  "propagation_methods": "[\"stem cutting\", \"air layering\"]",
  "toxic_to_pets": 1,
  "toxic_to_humans": 0,
  "toxicity_notes": "Contains calcium oxalate crystals; causes mouth irritation in cats and dogs.",
  "tip_spring": "Resume monthly fertilizing. Watch for new growth and provide support.",
  "tip_summer": "Keep soil moist but not waterlogged. Mist leaves in dry conditions.",
  "tip_fall": "Reduce watering frequency. Last fertilizer application in September.",
  "tip_winter": "Water every 2-3 weeks. No fertilizer. Keep away from cold drafts.",
  "seed_viability_years": null,
  "gdd_base_temp_f": null,
  "description": "Tropical climbing plant known for its large, fenestrated leaves."
}
```

#### 3.7 Business Logic Rules

##### Species Search

**Purpose:** Find species by name using full-text search.

**Inputs:**
- query: string (min 2 characters)
- category_filter: string (optional)

**Logic:**

```
1. IF LENGTH(query) < 2 THEN RETURN empty results
2. QUERY FTS5 index on (common_names, scientific_name, family, genus)
     WHERE query matches
3. IF category_filter is not null THEN
     FILTER results WHERE category = category_filter
4. SORT by relevance (FTS5 rank), then alphabetically by scientific_name
5. LIMIT 50 results
6. RETURN results
```

**Edge Cases:**
- Query matches common name but not scientific name: include in results
- Query matches multiple common names for same species: return once (deduplicated by species id)
- No results: return empty with suggestion message
- Very short query (2 chars): may return many results; limited to 50

##### Species to Plant Defaults

**Purpose:** Pre-fill plant care defaults when a species is selected for a Plant record.

**Inputs:**
- species_id: UUID

**Logic:**

```
1. LOAD species record
2. MAP defaults:
     Plant.scientific_name = species.scientific_name
     IF Plant.common_name is empty THEN
       Plant.common_name = species.common_names[0]
3. CREATE CareScheduleConfig records:
     watering: interval = species.base_watering_interval
     fertilizing: interval = species.fertilizer_interval_days,
                  active_seasons = species.fertilizer_active_seasons
4. DISPLAY (but do not store) on Plant Detail:
     light, soil, temperature, humidity preferences
5. RETURN defaults
```

**Edge Cases:**
- Species has null fields: skip those defaults, leave plant fields empty
- User already entered a common_name: do not overwrite
- Species has no fertilizer data: do not create fertilizer CareScheduleConfig

**Sort/Filter/Ranking Logic:**
- **Default sort:** Alphabetical by common name (first common name)
- **Available sort options:** Name A-Z, Name Z-A, Category
- **Filter options:** Category (houseplant, vegetable, herb, flower, succulent, tree)
- **Search:** FTS5 on common_names, scientific_name, family, genus; prefix matching enabled

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Bundled database not loaded | Error screen: "Plant care database could not be loaded. Restart the app." | App restart triggers database reload |
| FTS5 query fails | Toast: "Search error. Try a simpler query." | User simplifies search terms |
| Species record incomplete | Missing fields shown as "Data not available" in species detail | No user action needed |
| Add to Plants fails | Toast: "Could not create plant. Please try again." | User retries from species detail |

**Validation Timing:**
- Search debounce: 300ms after last keystroke
- No user input to validate (read-only database)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user searches for "monstera" in the plant care database,
   **When** results appear,
   **Then** "Monstera deliciosa" shows as a result with "Swiss Cheese Plant" as an alternate name, category "Houseplant", and light/water icons.

2. **Given** the user views the species detail for "Monstera deliciosa",
   **When** they scroll through sections,
   **Then** they see: watering (7 days), light (bright indirect, 4-6 hours), temperature (65-85F ideal), humidity (60-80%), fertilizer (monthly in spring/summer), and toxicity warning (toxic to pets).

3. **Given** the user taps "Add to My Plants" from the Monstera detail,
   **When** the Add Plant modal opens,
   **Then** the species is pre-selected, common name is "Monstera", and care defaults are pre-configured.

**Edge Cases:**

4. **Given** a species with no fertilizer data,
   **When** the user selects it for a plant,
   **Then** no fertilizer CareScheduleConfig is created, and the fertilizer section on plant detail shows "Not configured."

5. **Given** a search for "xyz123" with no matches,
   **When** the search completes,
   **Then** the message "No species matching 'xyz123'. Try a different name or browse by category" appears.

**Negative Tests:**

6. **Given** the bundled database fails to load,
   **When** the user tries to open the Plant Care Database screen,
   **Then** an error screen shows: "Plant care database could not be loaded. Restart the app."

7. **Given** the user types only 1 character in the search bar,
   **When** the character is entered,
   **Then** no search is performed (minimum 2 characters required); the browsable list remains.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| FTS search finds common name | query: "monstera" | results include Monstera deliciosa |
| FTS search finds scientific name | query: "deliciosa" | results include Monstera deliciosa |
| FTS search with category filter | query: "basil", category: "herb" | results include Basil |
| FTS search returns empty | query: "xyz123" | empty results |
| maps species to plant defaults | species: Monstera | watering interval: 7, light: bright_indirect |
| handles null fertilizer data | species with null fertilizer | no CareScheduleConfig created |
| parses common_names JSON | "[\"Monstera\", \"Swiss Cheese Plant\"]" | array of 2 strings |
| validates zone range | min: 10.0, max: 12.0, user: 7.0 | not hardy |
| limits results to 50 | query matches 100 species | 50 returned |
| ignores search under 2 chars | query: "m" | empty results |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Search and view species | 1. Type "tomato" in search, 2. Tap result | Tomato species detail shows all care sections |
| Add species to plants | 1. View Monstera detail, 2. Tap "Add to My Plants", 3. Save | Plant created with Monstera defaults, watering interval set to 7 |
| Browse by category | 1. Tap "Vegetables" filter, 2. Browse list | Only vegetable species shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User looks up care for a new plant | 1. Search "Fiddle Leaf Fig", 2. Read care info, 3. Tap "Add to My Plants", 4. Fill remaining fields, 5. Save | Plant in catalog with species-linked care defaults, watering schedule active, seasonal tips available |

---

### GD-019: Search and Filtering

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-019 |
| **Feature Name** | Search and Filtering |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a gardener with 50+ plants, I want to quickly search across my entire garden data (plants, care events, harvests, journal entries, seeds) from a single search bar, so that I can find anything without navigating to each feature separately.

**Secondary:**
> As an organized gardener, I want advanced filtering on every list view (by status, zone, care type, date range), so that I can narrow down exactly what I need.

#### 3.3 Detailed Description

Search and Filtering provides a global search capability and advanced filtering across all MyGarden data. While individual features (GD-001, GD-008, etc.) have their own inline search and filter options, this feature adds a unified search experience accessible from any screen.

The global search bar appears at the top of the main tab navigation. When the user types, results are grouped by category: Plants, Journal Entries, Harvests, Pest Observations, Seeds, Species Database. Each category shows up to 3 results with a "See All" link. Results are ranked by relevance (exact match > prefix match > substring match) and recency.

Searchable fields by category:

| Category | Searchable Fields |
|----------|-------------------|
| Plants | common_name, scientific_name, notes |
| Journal Entries | note text, plant name |
| Harvests | plant name, notes |
| Pest Observations | pest/disease name, notes, plant name |
| Seeds | variety_name, source, notes |
| Species Database | common_names, scientific_name, family, genus |

Advanced filters are available on list views throughout the app. Filters are composable (AND logic) and persistent per screen until cleared. Filter state is preserved when navigating away and returning to a screen within the same session, but resets on app restart.

Filter dimensions available globally:
- Date range (start date, end date)
- Plant (dropdown of user's plants)
- Zone/Room (dropdown of user's zones)
- Status (multi-select, varies by context)
- Sort order (varies by context)

Quick filter chips appear below search/filter bars on list screens. Tapping a chip toggles that filter. Active chips are highlighted with the accent color and show an X to remove. A "Clear All" option removes all active filters.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Plant search data
- GD-003: Growth Photo Journal - Journal entry search data
- GD-008: Harvest Tracking - Harvest search data
- GD-009: Pest and Disease Log - Observation search data
- GD-011: Seed Inventory - Seed search data
- GD-018: Plant Care Database - Species search data

**External Dependencies:**
- FTS5 search indexes on key text fields

**Assumed Capabilities:**
- Local database with FTS5 extension enabled
- Data exists in source features

#### 3.5 User Interface Requirements

##### Component: Global Search Bar

**Layout:**
- Appears at the top of the main tab bar screen
- Magnifying glass icon, placeholder text "Search plants, care, harvests..."
- Tapping activates search mode: search bar expands, keyboard opens, results list appears below

##### Screen: Search Results

**Layout:**
- Active search bar at top with clear (X) button and "Cancel" to exit search mode
- Results grouped by category, each category as a section header:
  - "Plants" with up to 3 results, "See All [N]" link
  - "Journal Entries" with up to 3 results
  - "Harvests" with up to 3 results
  - "Pest & Disease" with up to 3 results
  - "Seeds" with up to 3 results
  - "Species Database" with up to 3 results
- Each result row is category-specific:
  - Plant: photo thumbnail, name, status dot, zone label
  - Journal Entry: photo thumbnail, plant name, date, note preview
  - Harvest: plant name, weight, date, quality dots
  - Pest Observation: plant name, pest/disease name, severity dot, status badge
  - Seed: variety name, source, viability badge
  - Species: common name, scientific name, category badge
- Tapping a result navigates to the corresponding detail screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle | Search bar not active | Search bar with placeholder text |
| Active Empty | Search bar active, no query yet | "Start typing to search across your garden" |
| Typing | Query < 2 characters | "Keep typing... (minimum 2 characters)" |
| Results | Query >= 2 chars with matches | Grouped result sections |
| No Results | Query >= 2 chars with no matches | "No results for '[query]'" with suggestions |
| Loading | FTS query running | Spinner in search bar |

**Interactions:**
- Type in search bar: results update with debounce (300ms) after 2+ characters
- Tap result: navigates to detail screen for that item
- Tap "See All" in a category: shows full filtered list for that category
- Tap "Cancel": exits search mode, clears query
- Tap X in search bar: clears query, keeps search mode active
- Recent searches: last 10 queries shown when search bar is active with empty query

**Transitions/Animations:**
- Search activation: search bar expands, results list slides up, 200ms
- Results appear: fade in per group, 150ms staggered
- Search deactivation: results slide down, search bar contracts, 200ms

##### Component: Advanced Filter Panel

**Layout:**
- Accessible via funnel icon button on list screens (Plant List, Care Calendar, Harvest Dashboard, etc.)
- Slides up as a bottom sheet or half-screen modal
- Filter sections:
  - Date Range: start date picker, end date picker
  - Plant: searchable multi-select dropdown
  - Zone: multi-select dropdown (from user's zones)
  - Status: multi-select chips (context-dependent)
  - Sort: radio buttons with sort options (context-dependent)
- "Apply" and "Reset" buttons
- Active filter count badge on the funnel icon (e.g., funnel icon with "3" badge)

**Interactions:**
- Tap "Apply": closes panel, filters the list
- Tap "Reset": clears all filters, refreshes list
- Tap filter chip on main screen: toggles that filter quickly without opening panel

#### 3.6 Data Requirements

##### Entity: RecentSearch

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| query | TEXT | Required, max 200 chars | None | The search query text |
| result_count | INTEGER | Min 0 | 0 | Number of results found |
| searched_at | TEXT | ISO 8601 datetime | Current timestamp | When the search was performed |

**Indexes:**
- `searched_at DESC` - Show most recent searches first

**Validation Rules:**
- Max 10 recent searches stored; oldest is deleted when 11th is added
- Duplicate queries update the searched_at timestamp instead of creating new records

##### FTS5 Virtual Tables

| Table | Source Entity | Indexed Fields |
|-------|-------------|----------------|
| gd_plants_fts | Plant | common_name, scientific_name, notes |
| gd_journal_fts | JournalEntry | note |
| gd_harvest_fts | Harvest | notes |
| gd_pest_fts | PestObservation | custom_name, notes |
| gd_seeds_fts | SeedPacket | variety_name, source, notes |
| gd_species_fts | Species | common_names, scientific_name, family, genus |

**Example Data:**

```json
{
  "id": "rs-001",
  "query": "monstera",
  "result_count": 5,
  "searched_at": "2026-03-07T14:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Global Search Execution

**Purpose:** Search across all garden data and return grouped, ranked results.

**Inputs:**
- query: string (min 2 characters)

**Logic:**

```
1. NORMALIZE query: trim, lowercase
2. QUERY each FTS5 table in parallel:
     plants_results = SEARCH gd_plants_fts WHERE query matches
     journal_results = SEARCH gd_journal_fts WHERE query matches
     harvest_results = SEARCH gd_harvest_fts WHERE query matches
     pest_results = SEARCH gd_pest_fts WHERE query matches
     seed_results = SEARCH gd_seeds_fts WHERE query matches
     species_results = SEARCH gd_species_fts WHERE query matches
3. FOR EACH result set:
     JOIN with source table for display fields (name, date, photo, etc.)
     RANK by FTS5 relevance score
     LIMIT to 3 results per category (for initial grouped view)
     TRACK total count per category (for "See All [N]")
4. SAVE query to RecentSearch (upsert by query text)
5. RETURN {
     plants: { results: [...], total: N },
     journal: { results: [...], total: N },
     harvests: { results: [...], total: N },
     pests: { results: [...], total: N },
     seeds: { results: [...], total: N },
     species: { results: [...], total: N },
     total_results: sum of all totals
   }
```

**Edge Cases:**
- Query matches in multiple categories: all categories shown with their respective results
- Query matches nothing: "No results" state
- Query is only spaces after trim: treated as empty, no search performed
- Very common query (e.g., "plant"): results capped at 3 per category initially, "See All" available
- FTS5 special characters (*, "): escaped before query execution
- Large database (300+ species + user data): FTS5 ensures sub-100ms query time

##### Filter Persistence

**Purpose:** Preserve filter state within a session.

**Logic:**

```
1. WHEN user applies filters on a screen:
     STORE filter state in memory keyed by screen identifier
2. WHEN user navigates away and returns:
     RESTORE filter state from memory
3. WHEN app is restarted:
     All filter states reset to defaults
4. "Clear All" resets the stored state for that screen
```

**Edge Cases:**
- Screen has no applicable filters: filter panel is not shown
- Zone deleted while filter is active: filter automatically clears that zone
- Plant deleted while filtered: filter results update

**Sort/Filter/Ranking Logic:**
- **Default search ranking:** FTS5 relevance score (BM25), then recency (newest first)
- **Category ordering:** Plants first, then Journal, Harvest, Pest, Seeds, Species
- **Empty categories:** Hidden from search results (only show categories with matches)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| FTS5 query fails | Toast: "Search error. Try a simpler query." | User simplifies or clears query |
| Filter produces empty results | "No items match the selected filters" with "Clear Filters" button | User clears or adjusts filters |
| Recent search history full | Oldest search silently removed when 11th is added | No user action needed |
| Database not initialized | Search bar disabled with tooltip "Database loading..." | Auto-retries on database ready |

**Validation Timing:**
- Search debounce: 300ms after last keystroke
- Filter validation: immediate on selection change
- Minimum query length (2 chars): enforced before any search runs

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has plants named "Monstera" and "Monster Basil", journal entries mentioning "monstera", and Monstera in the species database,
   **When** they search for "monstera",
   **Then** results show: Plants (2 results), Journal (entries matching), Species (1 result), each with "See All" links.

2. **Given** 50 plants in the catalog,
   **When** the user opens the Plant List and applies filter: Status = "Alive", Zone = "Living Room",
   **Then** only alive plants in the Living Room are shown, the filter badge shows "2", and clearing filters restores the full list.

3. **Given** the user has searched for "basil", "tomato", and "pest" recently,
   **When** they tap the search bar with an empty query,
   **Then** the 3 recent searches appear as tappable suggestions.

**Edge Cases:**

4. **Given** a search for "zzzz" with no matches,
   **When** results load,
   **Then** "No results for 'zzzz'" is shown with suggestions to try different terms.

5. **Given** the user applies filters, navigates to a plant detail, and returns,
   **When** they return to the filtered list,
   **Then** the filters are still applied and results are the same.

**Negative Tests:**

6. **Given** the user types only 1 character "m",
   **When** the debounce timer fires,
   **Then** no search is performed and the hint shows "Keep typing... (minimum 2 characters)."

7. **Given** the FTS5 query encounters a syntax error from special characters,
   **When** the search runs,
   **Then** a toast shows "Search error. Try a simpler query." and no results are displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| search finds plant by common name | query: "monstera", plant: "Monstera" | 1 plant result |
| search finds plant by scientific name | query: "deliciosa" | Monstera deliciosa in results |
| search groups by category | query: "basil" (plant + species + seed) | 3 categories with results |
| search returns empty for no matches | query: "zzzz" | empty results, total: 0 |
| search ignores 1-char query | query: "m" | no search performed |
| escapes FTS5 special characters | query: "test*" | safe query, no error |
| recent searches capped at 10 | add 11th search | oldest removed |
| recent search deduplicates | search "basil" twice | 1 entry, updated timestamp |
| filter persistence in session | apply filter, navigate away, return | filter restored |
| filter reset on clear | "Clear All" tapped | all filters removed |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Global search across categories | 1. Add plant "Basil", harvest for Basil, seed "Basil Seeds", 2. Search "basil" | Results in Plants, Harvests, and Seeds categories |
| Filter plant list by zone | 1. Create "Kitchen" zone, 2. Assign 3 plants, 3. Filter by Kitchen | Only 3 Kitchen plants shown |
| "See All" shows full category results | 1. Add 10 plants matching "herb", 2. Search "herb", 3. Tap "See All" on Plants | Full list of 10 matching plants shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User finds specific data via search | 1. Search "pest" from any screen, 2. See pest observations and species results, 3. Tap a result | Navigated to the correct detail screen for the tapped result |

---

### GD-020: Propagation Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-020 |
| **Feature Name** | Propagation Tracking |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a plant propagator, I want to track cuttings, divisions, and other propagation attempts with success/failure outcomes, so that I can learn which methods work best for each species.

**Secondary:**
> As a plant sharer, I want to record when I give propagated plants to friends, so that I know who received what and can follow up on how the plants are doing.

#### 3.3 Detailed Description

Propagation Tracking records attempts to reproduce plants through cuttings, divisions, air layering, seed starting, and other methods. Each propagation attempt tracks the parent plant, the method used, the date started, the number of attempts in the batch, the success count, and the outcome. Successfully propagated plants can be added to the catalog (GD-001) with a lineage link back to the parent.

Propagation methods tracked:

| Method | Description | Typical Timeline |
|--------|-------------|-----------------|
| Stem Cutting | Cut a stem section with nodes and root in water or soil | 2-6 weeks to root |
| Leaf Cutting | Root a single leaf (succulents, African violets) | 4-12 weeks |
| Division | Split a mature plant into multiple plants | Immediate |
| Air Layering | Induce roots on an attached stem before cutting | 4-8 weeks |
| Offset/Pup | Separate a naturally produced offshoot | 1-2 weeks to establish |
| Seed | Start from seed (links to GD-011 Seed Inventory) | Species-dependent |
| Grafting | Join scion to rootstock | 4-8 weeks |
| Other | Any method not listed above | Variable |

Each propagation attempt has a status lifecycle: Started, Rooting (showing root development), Established (viable independent plant), Failed, or Given Away. The system tracks:

- Propagation success rate per method per species: `success_rate = successful / total_attempts * 100`
- Average time to root per method per species
- Parent-child plant lineage

A propagation log view shows all attempts with filters by status, method, parent plant, and species. A "Propagation Tips" section uses the species data from GD-018 to show recommended propagation methods for each plant.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Parent plant reference and child plant creation
- GD-018: Plant Care Database - Species propagation method recommendations
- GD-011: Seed Inventory - Seed-based propagation links (optional)

**External Dependencies:**
- Camera/photo library for propagation progress photos (optional)
- Local storage for propagation records

**Assumed Capabilities:**
- Plant records exist as parent sources
- Species data includes propagation methods

#### 3.5 User Interface Requirements

##### Screen: Propagation Log

**Layout:**
- Top navigation bar: "Propagation" title with status filter chips: "Active" (default) | "Successful" | "Failed" | "All"
- Summary card: total active propagations, overall success rate percentage, most successful method
- Scrollable list of propagation attempt cards, newest first
- Each card: parent plant photo (40x40), parent plant name, method badge, status badge (color-coded), start date, progress indicator (e.g., "Day 14 of rooting"), batch info ("3 of 5 rooting")
- Floating action button: "Start Propagation"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No propagation attempts | Illustration (cutting in water), heading "No propagations yet", subtext "Start a cutting or division to track your propagation journey", button "Start Propagation" |
| Loading | Querying data | Skeleton placeholders for 4 cards |
| Populated | 1+ attempts | Filterable list of propagation cards |

**Interactions:**
- Tap "Start Propagation": opens Start Propagation modal
- Tap propagation card: opens Propagation Detail screen
- Swipe left on card: reveals "Delete" action
- Tap status filter: filters by propagation status
- Pull-to-refresh: reloads propagation data

##### Modal: Start Propagation

**Layout:**
- Title: "Start Propagation"
- Parent plant picker: searchable dropdown from catalog
- Method: dropdown of propagation methods (pre-filtered to recommended methods for the selected species if species is set)
- Batch size: integer input, min 1, max 100 (how many cuttings/divisions in this attempt)
- Start date: date picker, defaults to today
- Photo: optional, camera/library picker for the cutting/division photo
- Notes: multiline text, optional, max 500 chars
- "Start" and "Cancel" buttons

##### Screen: Propagation Detail

**Layout:**
- Header: parent plant name, method, start date, day count ("Day 14")
- Status section: current status with "Update Status" button
- Progress tracker: visual timeline (Started -> Rooting -> Established or Failed)
- Batch status: individual count indicators (e.g., "3 rooting, 1 failed, 1 established")
- Photo gallery: progress photos with dates
- "Add to Catalog" button (visible when status is Established; creates a child Plant record)
- "Given Away" button (mark established plants as given to someone)
- Notes section: editable notes

#### 3.6 Data Requirements

##### Entity: PropagationAttempt

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| parent_plant_id | TEXT (UUID) | Required, references Plant.id | None | Parent plant |
| species_id | TEXT (UUID) | Optional, references Species.id | null | Species for stats aggregation |
| method | TEXT | One of: 'stem_cutting', 'leaf_cutting', 'division', 'air_layering', 'offset', 'seed', 'grafting', 'other' | None | Propagation method |
| batch_size | INTEGER | Required, min 1, max 100 | 1 | Number of cuttings/divisions in this attempt |
| successful_count | INTEGER | Min 0 | 0 | Number that successfully rooted/established |
| failed_count | INTEGER | Min 0 | 0 | Number that failed |
| status | TEXT | One of: 'started', 'rooting', 'established', 'failed', 'given_away' | 'started' | Overall batch status |
| start_date | TEXT | ISO 8601 date, required | Current date | When propagation began |
| root_date | TEXT | ISO 8601 date, optional | null | When roots were first observed |
| established_date | TEXT | ISO 8601 date, optional | null | When plant was established as independent |
| given_away_to | TEXT | Optional, max 200 chars | null | Who received the plant(s) |
| given_away_date | TEXT | ISO 8601 date, optional | null | When plant(s) were given away |
| notes | TEXT | Optional, max 500 chars | null | User notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

##### Entity: PropagationPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| attempt_id | TEXT (UUID) | Required, references PropagationAttempt.id | None | Parent attempt |
| photo_path | TEXT | Required | None | Local file path |
| caption | TEXT | Optional, max 200 chars | null | Photo description |
| taken_date | TEXT | ISO 8601 date | Current date | When the photo was taken |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: PropagationPlantLink

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| attempt_id | TEXT (UUID) | Required, references PropagationAttempt.id | None | Source propagation attempt |
| child_plant_id | TEXT (UUID) | Required, references Plant.id | None | Resulting plant record |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Relationships:**
- PropagationAttempt belongs to Plant (many-to-one via parent_plant_id)
- PropagationAttempt has many PropagationPhoto (one-to-many)
- PropagationAttempt has many PropagationPlantLink (one-to-many)
- PropagationPlantLink references Plant (child) (many-to-one)

**Indexes:**
- PropagationAttempt: `(parent_plant_id, start_date DESC)` - Per-plant propagation history
- PropagationAttempt: `(method, species_id)` - Aggregate success rates by method+species
- PropagationAttempt: `status` - Filter by status

**Validation Rules:**
- `successful_count + failed_count` must be <= `batch_size`
- `root_date` must be on or after `start_date`
- `established_date` must be on or after `root_date` (if root_date is set)
- `start_date` must not be in the future
- Method must be one of the allowed values

**Example Data:**

```json
{
  "id": "pa-001-monstera-cutting",
  "parent_plant_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "species_id": "sp-monstera-deliciosa-001",
  "method": "stem_cutting",
  "batch_size": 3,
  "successful_count": 2,
  "failed_count": 1,
  "status": "established",
  "start_date": "2026-01-15",
  "root_date": "2026-02-05",
  "established_date": "2026-03-01",
  "given_away_to": null,
  "given_away_date": null,
  "notes": "Cut below 3 nodes, rooted in water. One cutting rotted.",
  "created_at": "2026-01-15T00:00:00Z",
  "updated_at": "2026-03-01T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Propagation Success Rate

**Purpose:** Calculate success rate by method and species.

**Inputs:**
- method: string (optional, filter by method)
- species_id: UUID (optional, filter by species)

**Logic:**

```
1. QUERY PropagationAttempts WHERE method matches (if provided) AND species_id matches (if provided)
     AND status IN ('established', 'failed', 'given_away')
2. total_attempts = SUM(batch_size)
3. total_successful = SUM(successful_count)
4. success_rate = (total_successful / total_attempts) * 100
5. avg_days_to_root = AVG(root_date - start_date) WHERE root_date IS NOT NULL
6. avg_days_to_establish = AVG(established_date - start_date) WHERE established_date IS NOT NULL
7. RETURN { success_rate, total_attempts, total_successful, avg_days_to_root, avg_days_to_establish }
```

**Edge Cases:**
- No completed attempts: return null rates with "No completed propagations yet"
- All failed: success rate is 0%
- Only started/rooting (in progress): excluded from rate calculation

##### Propagation Status Transitions

**Logic:**

```
VALID_TRANSITIONS = {
  'started'     -> ['rooting', 'failed'],
  'rooting'     -> ['established', 'failed'],
  'established' -> ['given_away'],
  'failed'      -> [] (terminal),
  'given_away'  -> [] (terminal)
}
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Start date descending (newest first)
- **Available sort options:** Newest First, Oldest First, Method, Status
- **Filter options:** Status (active, successful, failed, given away), Method, Parent Plant, Species

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Parent plant not selected | Inline validation: "Select a parent plant" | User selects plant |
| Successful count exceeds batch size | Inline validation: "Successful count cannot exceed batch size" | User corrects count |
| Database write fails | Toast: "Could not save propagation. Please try again." | User retries |
| Parent plant deleted | Attempt shows "[Deleted Plant]" as parent, data preserved | No user action needed |

**Validation Timing:**
- Count validation runs on blur
- Date validation runs on selection change
- Status transition validates on action

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has a Monstera plant,
   **When** they start a stem cutting propagation with batch size 3,
   **Then** a new propagation attempt appears with status "Started" and "Day 1" counter.

2. **Given** a propagation attempt with 3 cuttings where 2 have rooted,
   **When** the user updates successful_count to 2 and failed_count to 1,
   **Then** the batch status shows "2 of 3 successful" and the overall success rate updates.

3. **Given** an established propagation,
   **When** the user taps "Add to Catalog",
   **Then** a new Plant record is created with acquisition_method "propagated" and a lineage link to the parent.

**Edge Cases:**

4. **Given** 10 stem cutting attempts for Monstera across 2 years,
   **When** the user views propagation stats,
   **Then** the success rate, average days to root, and average days to establish are calculated from all completed attempts.

5. **Given** a propagation with status "failed",
   **When** the user tries to change status to "established",
   **Then** the system rejects with "Failed propagations cannot be marked as established."

**Negative Tests:**

6. **Given** a batch size of 5,
   **When** the user enters successful_count 6,
   **Then** validation shows: "Successful count cannot exceed batch size."

7. **Given** no parent plant selected,
   **When** the user taps "Start",
   **Then** validation shows: "Select a parent plant."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates success rate | 3 attempts: 2 successful, 1 failed | rate: 66.7% |
| validates count within batch | batch: 5, successful: 6 | Validation error |
| validates status transition started to rooting | current: started, new: rooting | Valid |
| rejects failed to established | current: failed, new: established | Error |
| calculates avg days to root | roots at day 14, day 21, day 18 | avg: 17.7 days |
| handles zero completed | all attempts in progress | rate: null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full propagation lifecycle | 1. Start 3 cuttings, 2. Update to rooting, 3. Mark 2 established, 1 failed, 4. Add 1 to catalog | Plant created with propagated method, lineage link set, success rate updated |
| Given away tracking | 1. Establish propagation, 2. Mark as given away to "Sarah" | Status changes, given_away_to and date set |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User propagates Monstera and tracks success | 1. Take 3 stem cuttings, 2. Log propagation, 3. Document progress with photos, 4. 2 succeed, 1 fails, 5. Add successful ones to catalog | 2 new plants in catalog linked to parent, propagation history shows full timeline, success rate for Monstera stem cuttings updated |

---

### GD-021: Monthly Care Summary

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-021 |
| **Feature Name** | Monthly Care Summary |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a busy gardener, I want a monthly summary report showing all the care I performed, any issues that arose, and what is coming up next month, so I can reflect on my gardening progress without sifting through individual records.

**Secondary:**
> As a journal keeper, I want to save monthly summaries as a record of my gardening year that I can look back on.

#### 3.3 Detailed Description

The Monthly Care Summary generates a comprehensive report at the end of each month (or on demand) consolidating all garden activity from that month into a single readable summary. The summary covers:

1. **Plant Census Changes:** Plants added, plants lost (dead/given away), net change
2. **Care Activity:** Total watering events, fertilizing events, pruning events, repotting events. Adherence rate for the month
3. **Harvest Report:** Total weight harvested, items harvested, top producing plant
4. **Pest & Disease:** New issues reported, issues resolved, ongoing issues
5. **Propagation:** New attempts started, outcomes (success/fail)
6. **Photos:** Total journal photos added, count by plant
7. **Looking Ahead:** Upcoming care tasks for next month, planting calendar milestones, frost alerts

The summary is auto-generated from existing data (no new data collection). Users can view past monthly summaries in a scrollable archive. Each summary is a generated view, not a stored document, so it always reflects the latest data for that period (including retroactive edits).

An optional monthly notification (default: 1st of the month at 9:00 AM) reminds the user: "Your [Month] garden summary is ready! See how your garden did last month."

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Plant census data
- GD-002: Smart Watering Reminders - Watering event data
- GD-006: Care Schedule - Care event data
- GD-008: Harvest Tracking - Harvest data
- GD-009: Pest and Disease Log - Issue data
- GD-020: Propagation Tracking - Propagation data (optional)

**External Dependencies:**
- Local notification for monthly reminder

**Assumed Capabilities:**
- Data exists in source features for the month in question

#### 3.5 User Interface Requirements

##### Screen: Monthly Summary

**Layout:**
- Top navigation bar: "[Month Year] Summary" (e.g., "February 2026 Summary")
- Month navigation: left/right arrows to browse previous months
- Scrollable content with sections:
  1. **Overview Card:** Large stat showing the month's "headline" metric (e.g., "28 care tasks completed"), smaller stats below (plants: 23, harvests: 5, health avg: 78)
  2. **Plant Census:** Added/Lost/Net badges with plant names
  3. **Care Performance:** Adherence percentage ring chart, care event count by type
  4. **Harvest Highlights:** Total weight, top producer with photo, quality average
  5. **Pest & Disease:** Active issues list, resolved count
  6. **Looking Ahead:** Bulleted list of upcoming tasks for next month
- "Share Summary" button at bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Data | No activity for the selected month | "No garden activity recorded for [Month]. Start caring for your plants to see monthly summaries." |
| Partial | Some sections have data, others do not | Active sections display; empty sections show "No [type] this month" in gray |
| Full | All sections have data | Complete summary with all sections populated |

**Interactions:**
- Tap left/right arrows: navigate to previous/next month
- Tap section: expands to show detailed breakdown
- Tap "Share Summary": generates summary image and opens share sheet
- Tap items in "Looking Ahead": navigates to the relevant feature screen

#### 3.6 Data Requirements

This feature does not introduce new persistent entities. All data is computed on demand from existing tables. A lightweight cache stores generated summaries for performance.

##### Computed View: MonthlySummary

| Field | Source |
|-------|--------|
| month | Input parameter |
| plants_added | COUNT(Plant WHERE created_at in month) |
| plants_lost | COUNT(Plant WHERE (death_date OR given_away_date) in month) |
| total_waterings | COUNT(WateringLog WHERE watered_at in month) |
| total_care_events | COUNT(CareEvent WHERE completed_date in month) |
| watering_adherence | on_time / total_due * 100 |
| total_harvest_weight | SUM(Harvest.weight_grams WHERE harvest_date in month) |
| harvest_count | COUNT(Harvest WHERE harvest_date in month) |
| new_pest_issues | COUNT(PestObservation WHERE observed_date in month) |
| resolved_issues | COUNT(PestObservation WHERE resolved_date in month) |
| propagation_started | COUNT(PropagationAttempt WHERE start_date in month) |
| photos_added | COUNT(JournalEntry WHERE entry_date in month) |

#### 3.7 Business Logic Rules

##### Summary Generation

**Purpose:** Aggregate all garden activity for a calendar month.

**Inputs:**
- year: integer
- month: integer (1-12)

**Logic:**

```
1. DEFINE date_range: first day of month to last day of month
2. QUERY each data source for records within date_range
3. COMPUTE aggregates (counts, sums, averages)
4. GENERATE "Looking Ahead" items:
     - Care tasks due in the next month from CareScheduleConfig
     - Planting calendar milestones from PlantingWindow
     - Frost alerts due from FrostAlert
5. RETURN structured summary object
```

**Edge Cases:**
- Month in the future: show "Summary not available for future months"
- Current month (incomplete): show "Month in progress" label with data so far
- No data at all: show empty state
- App installed mid-month: show data from install date onward

**Sort/Filter/Ranking Logic:**
- Not applicable (single report per month, chronological month navigation)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Summary computation fails | Toast: "Could not generate summary. Try again." | User pulls to refresh |
| Future month selected | "Summary not available for future months" | User navigates to current or past month |
| Share fails | Toast: "Could not share summary. Try again." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** February 2026 had 45 waterings, 3 fertilizer applications, 2 harvests (680g total), and 1 new pest issue,
   **When** the user views the February summary,
   **Then** all metrics display correctly: 45 waterings, 3 fertilizations, 680g harvested, 1 pest issue.

2. **Given** it is March 1,
   **When** the monthly notification fires,
   **Then** the user receives: "Your February garden summary is ready!" Tapping opens the February summary.

**Edge Cases:**

3. **Given** it is March 15 (current month),
   **When** the user views the March summary,
   **Then** a "Month in progress" label appears with data-so-far metrics.

4. **Given** no garden activity in January 2026,
   **When** the user navigates to January,
   **Then** the empty state message appears.

**Negative Tests:**

5. **Given** the user navigates to April 2026 (future month),
   **When** the summary tries to load,
   **Then** "Summary not available for future months" appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates waterings for month | 45 logs in Feb, 10 in Mar | Feb total: 45 |
| aggregates harvest weight | 3 harvests: 200g, 280g, 200g | total: 680g |
| counts plants added | 2 plants created in Feb | plants_added: 2 |
| counts plants lost | 1 death in Feb | plants_lost: 1 |
| generates looking-ahead items | 3 care tasks due next month | 3 items in looking_ahead |
| handles empty month | no data in Jan | all metrics: 0 or null |
| rejects future month | month: next month | error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Generate summary with full data | 1. Log various activities in Feb, 2. View Feb summary | All sections populated with correct aggregates |
| Navigate between months | 1. View Feb summary, 2. Tap right arrow | March summary shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reviews year of monthly summaries | 1. Browse Jan through Dec summaries | Each month shows accurate data, trends visible across months |

---

### GD-022: Data Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-022 |
| **Feature Name** | Data Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious gardener, I want to export all my garden data (plants, care logs, harvests, photos) in a portable format, so that I have a backup and full ownership of my data.

**Secondary:**
> As a gardener switching devices, I want to export my data and re-import it on a new device, so I do not lose my garden history.

#### 3.3 Detailed Description

Data Export generates a downloadable archive of all the user's garden data in a structured, human-readable format. The export includes all user-created data (plants, journal entries, care events, harvests, pest observations, seeds, propagation attempts, wish list, zones, garden beds) and user-captured photos.

Export formats:

| Format | Contents | Use Case |
|--------|----------|----------|
| JSON (full) | All entities as JSON files in a ZIP archive, plus photos in an `images/` directory | Full backup, re-import on new device |
| CSV (data only) | One CSV file per entity type, no photos | Spreadsheet analysis, quick backup |
| Garden Report (PDF-style) | Formatted summary of plants, photos, stats (generated as a styled HTML file) | Sharing with others, printing |

The JSON export follows a strict schema versioned with a `schema_version` field. The schema includes:
- `manifest.json`: export metadata (app version, export date, schema version, entity counts)
- `plants.json`: all Plant records
- `journal_entries.json`: all JournalEntry records
- `care_events.json`: all CareEvent records
- `watering_logs.json`: all WateringLog records
- `harvests.json`: all Harvest records
- `pest_observations.json`: all PestObservation records with treatments
- `seeds.json`: all SeedPacket records with germination logs
- `propagation.json`: all PropagationAttempt records
- `wish_list.json`: all WishListItem records
- `zones.json`: all Zone records
- `garden_beds.json`: all GardenBed records with layers and cells
- `settings.json`: user preferences
- `images/`: directory containing all photos, referenced by path in JSON records

The export file is saved to the device's file system or shared via the system share sheet.

#### 3.4 Prerequisites

**Feature Dependencies:**
- All data-producing features (GD-001 through GD-020) - Data sources for export

**External Dependencies:**
- File system write access for export file
- System share sheet for sharing the export
- Sufficient storage for the export archive (estimated: data ~1-5 MB, photos vary)

**Assumed Capabilities:**
- Data exists to export
- Device has sufficient free storage

#### 3.5 User Interface Requirements

##### Screen: Export (within Settings)

**Layout:**
- Section in Settings screen titled "Data Export"
- Format picker: segmented control - "Full Backup (JSON)" | "Spreadsheet (CSV)" | "Garden Report"
- Data selector: checkboxes to include/exclude entity types (all checked by default):
  - Plants, Journal Photos, Care Events, Watering Logs, Harvests, Pest & Disease, Seeds, Propagation, Wish List, Zones, Garden Beds, Settings
- "Include Photos" toggle (default: on for JSON, off for CSV, always on for Report)
- Storage estimate: "Estimated size: ~15 MB (12 MB photos, 3 MB data)"
- "Export" button (primary action)
- Export history: list of recent exports with date, format, and size

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Data exists to export | Format picker, data selector, export button enabled |
| Exporting | Export in progress | Progress bar with percentage, "Cancel" button, current step label (e.g., "Exporting photos: 45 of 120") |
| Complete | Export finished | Success message with file size, "Share" button, "Save to Files" button |
| Error | Export failed | Error message with details, "Retry" button |
| No Data | No data to export | Message: "No garden data to export. Start adding plants to create exportable data." |

**Interactions:**
- Tap "Export": starts export process, shows progress
- Tap "Share" (after export): opens system share sheet
- Tap "Save to Files" (after export): opens file picker to choose save location
- Toggle checkboxes: includes/excludes entity types from export
- Toggle "Include Photos": updates storage estimate

#### 3.6 Data Requirements

No new persistent entities. The export feature reads from all existing entities and generates output files.

##### Export Manifest Schema

```json
{
  "schema_version": "1.0",
  "app_version": "1.0.0",
  "export_date": "2026-03-07T14:30:00Z",
  "format": "json",
  "include_photos": true,
  "entity_counts": {
    "plants": 23,
    "journal_entries": 89,
    "care_events": 245,
    "watering_logs": 312,
    "harvests": 18,
    "pest_observations": 5,
    "seeds": 12,
    "propagation_attempts": 4,
    "wish_list_items": 8,
    "zones": 7,
    "garden_beds": 3,
    "photos": 120
  },
  "total_size_bytes": 15728640
}
```

#### 3.7 Business Logic Rules

##### Export Pipeline

**Purpose:** Generate a complete data export archive.

**Inputs:**
- format: enum ('json', 'csv', 'report')
- include_entities: array of entity type strings
- include_photos: boolean

**Logic:**

```
1. FOR EACH entity type in include_entities:
     QUERY all records from that entity table
     IF format == 'json' THEN
       SERIALIZE to JSON with all fields
     ELSE IF format == 'csv' THEN
       SERIALIZE to CSV with header row and all fields
     ELSE IF format == 'report' THEN
       FORMAT as styled HTML sections

2. IF include_photos THEN
     COLLECT all photo_path references from exported records
     COPY all referenced photos to export/images/ directory
     UPDATE photo paths in exported data to relative paths (images/filename.jpg)

3. GENERATE manifest.json with metadata and entity counts

4. IF format == 'json' THEN
     PACKAGE all JSON files + images/ directory into a ZIP archive
     filename: "mygarden-export-YYYY-MM-DD.zip"
   ELSE IF format == 'csv' THEN
     PACKAGE all CSV files into a ZIP archive
     filename: "mygarden-export-YYYY-MM-DD-csv.zip"
   ELSE IF format == 'report' THEN
     GENERATE single HTML file with embedded images (base64)
     filename: "mygarden-report-YYYY-MM-DD.html"

5. RETURN { file_path, file_size, entity_counts }
```

**Edge Cases:**
- Very large photo collection (1000+ photos): progress indicator shows per-photo progress; export may take 30+ seconds
- Photo file referenced but missing: skip with warning in manifest ("missing_photos" array)
- No data selected: export button disabled
- Insufficient storage: error before starting export with required space estimate

**Sort/Filter/Ranking Logic:**
- Not applicable (export is a bulk operation)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient storage | Error: "Not enough storage. Need ~[X] MB, [Y] MB available." | User frees storage |
| Export cancelled | Progress stops, partial file deleted | User can restart export |
| Photo file missing during export | Export continues; missing photos listed in manifest warning | User can re-export after checking photos |
| ZIP creation fails | Error: "Could not create export file. Free up storage and try again." | User frees storage and retries |

**Validation Timing:**
- Storage estimate computed on format/photo toggle change
- Entity count validation runs before export start

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 23 plants, 89 journal entries, and 120 photos,
   **When** they export in JSON format with photos included,
   **Then** a ZIP file is generated containing manifest.json, all entity JSON files, and 120 photos in the images/ directory.

2. **Given** the user exports in CSV format,
   **When** the export completes,
   **Then** a ZIP file contains one CSV per entity type with header rows, and no photos.

3. **Given** a completed export,
   **When** the user taps "Share",
   **Then** the system share sheet opens with the export file attached.

**Edge Cases:**

4. **Given** 3 photos have missing files,
   **When** the export runs,
   **Then** the export completes with a warning: "3 photos could not be found and were skipped."

5. **Given** insufficient storage for the export,
   **When** the user taps "Export",
   **Then** an error shows the required space vs available space.

**Negative Tests:**

6. **Given** the user unchecks all entity types,
   **When** they view the export button,
   **Then** the "Export" button is disabled with "Select at least one data type."

7. **Given** the export is cancelled mid-progress,
   **When** the partial file is on disk,
   **Then** it is deleted and no corrupted export remains.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates manifest with correct counts | 23 plants, 89 entries | manifest.entity_counts matches |
| serializes plant to JSON | plant record | valid JSON with all fields |
| serializes plant to CSV | plant record | CSV row with header matching |
| handles missing photo gracefully | photo_path points to nonexistent file | warning in manifest, export continues |
| estimates export size | 120 photos avg 100KB + 3MB data | estimate: ~15MB |
| generates correct filename | date: 2026-03-07, format: json | "mygarden-export-2026-03-07.zip" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full JSON export | 1. Add data across all features, 2. Export JSON with photos | ZIP contains all JSON files, photos, and manifest |
| CSV export without photos | 1. Export CSV, photos off | ZIP contains CSV files only, no images directory |
| Export and share | 1. Export, 2. Tap Share | System share sheet opens with file |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User creates full backup | 1. Comprehensive data across all features, 2. Export JSON with photos, 3. Verify manifest | Export file contains all data, manifest counts match actual data, all photos included |

---

### GD-023: Data Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-023 |
| **Feature Name** | Data Import |
| **Priority** | P2 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a gardener switching devices, I want to import a previous MyGarden export file to restore all my data on a new device, so I do not lose my garden history.

**Secondary:**
> As a gardener coming from another app, I want to import a CSV of my plant data, so I do not have to re-enter everything manually.

#### 3.3 Detailed Description

Data Import allows users to restore data from a MyGarden export (GD-022) or import plant data from a CSV file with a flexible column mapping system.

Two import modes:

1. **Full Restore (JSON):** Imports a MyGarden JSON export archive, restoring all entities and photos. This is the inverse of GD-022's JSON export. The importer validates the schema_version and checks for ID conflicts with existing data. Conflicts are handled with a user-selectable strategy: "Skip Duplicates" (keep existing, ignore imported), "Replace Duplicates" (overwrite existing with imported), or "Import as New" (create new records with new IDs, keeping both).

2. **CSV Import (Plants Only):** Imports a CSV file containing plant records. The user maps CSV columns to MyGarden fields using a column mapping screen. Required mappings: plant name (maps to common_name). Optional mappings: scientific name, acquisition date, status, location type, notes. Unmapped columns are ignored. Each row creates a new Plant record.

The import process follows these steps:
1. User selects import file (JSON ZIP or CSV)
2. System validates file format and schema version (for JSON)
3. Preview screen shows summary: entities to import, conflicts detected, data samples
4. User selects conflict resolution strategy (for JSON with conflicts)
5. User maps columns (for CSV)
6. Confirmation screen with "Import" button
7. Import executes with progress indicator
8. Results screen: imported counts, skipped counts, errors

All imports are wrapped in a database transaction. If any critical error occurs, the entire import is rolled back, preserving the database's previous state.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-001: Plant Catalog - Target for plant data
- GD-022: Data Export - Source format for JSON imports

**External Dependencies:**
- File system read access for import files
- File picker to select import files
- Sufficient storage for imported data and photos

**Assumed Capabilities:**
- User has an export file or CSV to import
- Database can handle transaction-wrapped bulk inserts

#### 3.5 User Interface Requirements

##### Screen: Import (within Settings)

**Layout:**
- Section in Settings titled "Data Import"
- Two import cards:
  1. "Restore from Backup" - subtitle "Import a MyGarden export (.zip)" - file picker button
  2. "Import from CSV" - subtitle "Import plant data from a spreadsheet (.csv)" - file picker button

##### Screen: Import Preview (JSON)

**Layout:**
- Title: "Import Preview"
- File info: filename, export date, schema version, app version
- Entity summary table: entity type, count in file, existing count, conflicts
- Conflict resolution: radio buttons "Skip Duplicates", "Replace Duplicates", "Import as New"
- Warnings section: schema version mismatch, missing photos, etc.
- "Import" button and "Cancel" button

##### Screen: Column Mapping (CSV)

**Layout:**
- Title: "Map CSV Columns"
- Table showing: CSV column header, sample data (first 3 rows), MyGarden field dropdown (or "Skip")
- Required field indicator: "Plant Name" must be mapped
- Preview of how the first 3 rows will import based on current mapping
- "Import" button and "Cancel" button

##### Screen: Import Results

**Layout:**
- Title: "Import Complete" or "Import Failed"
- Summary: imported count, skipped count, error count
- Details: expandable sections per entity showing specific import/skip/error items
- "Done" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Selecting File | User picking a file | File picker active |
| Validating | File being parsed and validated | Spinner with "Validating file..." |
| Preview | File validated, showing preview | Entity summary and conflict options |
| Importing | Import in progress | Progress bar with step label |
| Complete | Import finished successfully | Results summary with counts |
| Failed | Import failed (rolled back) | Error details, "nothing was imported" message |

#### 3.6 Data Requirements

No new persistent entities. Import creates records in existing entity tables.

##### Import Validation Schema

```json
{
  "supported_schema_versions": ["1.0"],
  "required_manifest_fields": ["schema_version", "export_date", "format"],
  "csv_required_columns": ["plant_name"],
  "csv_optional_columns": [
    "scientific_name", "acquisition_date", "status",
    "location_type", "zone", "notes"
  ]
}
```

#### 3.7 Business Logic Rules

##### JSON Import Pipeline

**Purpose:** Restore all entities and photos from a MyGarden JSON export.

**Inputs:**
- file_path: path to ZIP archive
- conflict_strategy: enum ('skip', 'replace', 'import_as_new')

**Logic:**

```
1. UNZIP archive to temporary directory
2. READ manifest.json, VALIDATE schema_version
3. FOR EACH entity JSON file:
     PARSE records
     CHECK for ID conflicts with existing database records
     APPLY conflict_strategy:
       'skip': ignore records with conflicting IDs
       'replace': delete existing, insert imported
       'import_as_new': generate new UUIDs for all records, update all foreign key references
4. BEGIN transaction
5. INSERT all records in dependency order:
     Zones -> GardenBeds -> BedLayers -> Species data (skip, read-only)
     -> Plants -> BedCells -> JournalEntries -> WateringLogs
     -> CareEvents -> Harvests -> PestObservations -> Treatments
     -> SeedPackets -> GerminationLogs -> PropagationAttempts
     -> WishListItems -> HealthScores -> AppearanceRatings
6. IF include_photos THEN
     COPY photos from archive images/ to app photos directory
     UPDATE photo_path references in imported records
7. COMMIT transaction
8. CLEANUP temporary directory
9. RETURN { imported: counts, skipped: counts, errors: [...] }
```

**Edge Cases:**
- Schema version mismatch: warn user, attempt import if version is older (backward compatible)
- Future schema version: reject import with "This export was created by a newer version of MyGarden"
- Missing entity files in archive: skip those entities, warn user
- Corrupt JSON: abort with specific error message
- Photo directory missing: import data without photos, warn user
- Transaction failure: full rollback, database unchanged

##### CSV Import Pipeline

**Purpose:** Create Plant records from a CSV file with user-defined column mapping.

**Inputs:**
- file_path: path to CSV file
- column_mapping: map of CSV column index -> MyGarden field name

**Logic:**

```
1. READ CSV file, DETECT delimiter (comma, semicolon, tab)
2. PARSE header row
3. PRESENT column mapping interface
4. VALIDATE that "plant_name" is mapped
5. FOR EACH data row:
     MAP columns to fields using the mapping
     VALIDATE: plant_name is not empty after trim
     CREATE Plant record with mapped fields
     DEFAULT unmapped optional fields:
       status = 'alive', location_type = 'indoor', acquisition_date = today
6. BEGIN transaction
7. INSERT all Plant records
8. COMMIT transaction
9. RETURN { imported: count, skipped: count, errors: [...] }
```

**Edge Cases:**
- CSV with no header row: use column indices, user maps by position
- Empty rows: skip silently
- Plant name column entirely empty in a row: skip row with warning
- Very large CSV (10,000+ rows): process in batches of 500, show progress
- Encoding issues (UTF-8 BOM, Latin-1): attempt UTF-8 first, fall back to Latin-1
- Duplicate plant names in CSV: import all (duplicates allowed in catalog)

**Sort/Filter/Ranking Logic:**
- Not applicable (import is a bulk operation)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid file format | Error: "This file is not a valid MyGarden export or CSV." | User selects a different file |
| Future schema version | Error: "This export requires a newer version of MyGarden. Update the app to import this file." | User updates app |
| Corrupt JSON in archive | Error: "The export file appears corrupted. Try re-exporting from the original device." | User re-exports |
| CSV missing plant_name mapping | "Plant Name must be mapped to a CSV column" | User maps the required column |
| Import transaction fails | "Import failed. No data was changed. Error: [details]" | User retries or contacts support |
| Insufficient storage for photos | "Not enough storage to import photos. Import data without photos?" with Yes/No | User chooses data-only import or frees storage |

**Validation Timing:**
- File validation runs immediately after file selection
- Column mapping validation runs on "Import" button tap
- Conflict detection runs during preview generation

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a MyGarden JSON export with 23 plants, 89 journal entries, and 120 photos,
   **When** the user imports with "Import as New" strategy,
   **Then** all 23 plants, 89 entries, and 120 photos are imported with new IDs, and no existing data is modified.

2. **Given** a CSV file with columns "Name", "Type", "Date Bought",
   **When** the user maps "Name" to plant_name, "Type" to scientific_name, "Date Bought" to acquisition_date,
   **Then** all valid rows create Plant records with the mapped fields.

3. **Given** an import with 5 conflicting plant IDs and "Skip Duplicates" selected,
   **When** the import runs,
   **Then** 5 plants are skipped and the results screen shows "5 skipped (duplicates)."

**Edge Cases:**

4. **Given** an export from a future app version (schema_version 2.0),
   **When** the user tries to import,
   **Then** the error shows: "This export requires a newer version of MyGarden."

5. **Given** a CSV with 3 empty rows interspersed,
   **When** the import runs,
   **Then** the empty rows are skipped and the results show the correct imported/skipped counts.

**Negative Tests:**

6. **Given** the user selects a .txt file,
   **When** the file is validated,
   **Then** the error shows: "This file is not a valid MyGarden export or CSV."

7. **Given** an import fails mid-transaction,
   **When** the error occurs,
   **Then** the entire import is rolled back, no data is changed, and the error is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates schema version 1.0 | version: "1.0" | valid |
| rejects future schema | version: "2.0" | error: newer version |
| detects CSV delimiter comma | "name,type\nBasil,herb" | delimiter: comma |
| detects CSV delimiter semicolon | "name;type\nBasil;herb" | delimiter: semicolon |
| maps CSV columns correctly | mapping: {0: "common_name", 2: "acquisition_date"} | correct field mapping |
| handles empty CSV rows | row: ",," | skipped |
| generates new UUIDs for import_as_new | original ID: "abc-123" | new UUID generated, all references updated |
| rollback on transaction failure | insert fails at row 50 | all 49 previous inserts rolled back |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full JSON import | 1. Export data, 2. Clear database, 3. Import export file | All data restored, photos in correct locations |
| CSV import with mapping | 1. Create CSV with 10 plants, 2. Map columns, 3. Import | 10 Plant records created with correct field values |
| Import with conflicts | 1. Import export, 2. Import same export again with "Skip" | Second import skips all duplicates, no data changed |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User migrates to new device | 1. Export on old device, 2. Transfer file, 3. Import on new device | All data and photos restored, app functions identically |

---

### GD-024: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-024 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a gardener, I want to configure my USDA zone, hemisphere, measurement units, and notification preferences, so that the app is personalized to my location and habits.

**Secondary:**
> As a privacy-conscious user, I want to delete all my garden data from one place, so I can wipe my data if I stop using the app.

#### 3.3 Detailed Description

Settings and Preferences provides a centralized configuration screen for all user-adjustable parameters in MyGarden. Settings are stored locally and never transmitted.

Settings categories:

1. **Location:**
   - USDA Hardiness Zone: dropdown (1a through 13b) or ZIP code lookup
   - Hemisphere: toggle (Northern / Southern)
   - Custom frost dates: optional override for last frost and first frost dates

2. **Units:**
   - Temperature: toggle (Fahrenheit / Celsius)
   - Weight: dropdown (grams, ounces, pounds, kilograms)
   - Dimensions: toggle (feet / meters)
   - Volume: dropdown (milliliters, fluid ounces, cups, liters)

3. **Notifications:**
   - Watering reminders: toggle (on/off), time picker
   - Care schedule reminders: toggle (on/off), time picker
   - Frost alerts: toggle (on/off)
   - Monthly summary: toggle (on/off), day of month picker (1-28)
   - Notification time: shared time picker (default: 8:00 AM)

4. **Display:**
   - Plant list default view: toggle (List / Grid)
   - Care calendar default view: toggle (Week / Month)
   - Default sort order for plant list: dropdown

5. **Data:**
   - Export data (links to GD-022)
   - Import data (links to GD-023)
   - Delete all garden data: destructive action with double confirmation

6. **About:**
   - App version
   - Plant care database version and species count
   - Privacy policy link
   - Open source licenses

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (settings are foundational; other features read from settings)

**External Dependencies:**
- Local storage for settings values
- Local notification system for preference configuration
- Bundled ZIP-to-zone lookup table (from GD-005)

**Assumed Capabilities:**
- Local database is initialized

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- Standard settings list layout with grouped sections
- Each section has a header and list of setting rows
- Each row: setting label, current value (or toggle/selector), tap to edit
- "Delete All Data" at the bottom in red text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | First launch, no settings configured | All settings at default values |
| Configured | User has set preferences | Settings show current values |
| Deleting | Data deletion in progress | Progress spinner with "Deleting all garden data..." |

**Interactions:**
- Tap zone row: opens zone picker (dropdown or ZIP lookup)
- Tap unit row: opens selector for that unit type
- Tap notification toggle: enables/disables that notification category
- Tap notification time: opens time picker
- Tap "Delete All Data": first confirmation dialog "Are you sure? This will permanently delete all your plants, photos, care logs, and other garden data. This cannot be undone." Second confirmation: "Type DELETE to confirm" text input

#### 3.6 Data Requirements

##### Entity: UserSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, always "user_settings" | "user_settings" | Singleton record |
| usda_zone | TEXT | One of: '1a'-'13b', or null | null | User's USDA hardiness zone |
| hemisphere | TEXT | One of: 'northern', 'southern' | 'northern' | User's hemisphere |
| custom_last_frost | TEXT | ISO 8601 date (MM-DD format), optional | null | User override for last frost date |
| custom_first_frost | TEXT | ISO 8601 date (MM-DD format), optional | null | User override for first frost date |
| temp_unit | TEXT | One of: 'fahrenheit', 'celsius' | 'fahrenheit' | Temperature display unit |
| weight_unit | TEXT | One of: 'g', 'oz', 'lb', 'kg' | 'g' | Weight display unit |
| dimension_unit | TEXT | One of: 'feet', 'meters' | 'feet' | Length display unit |
| volume_unit | TEXT | One of: 'ml', 'fl_oz', 'cups', 'liters' | 'ml' | Volume display unit |
| notify_watering | INTEGER | 0 or 1 | 1 | Watering reminders enabled |
| notify_care | INTEGER | 0 or 1 | 1 | Care schedule reminders enabled |
| notify_frost | INTEGER | 0 or 1 | 1 | Frost alerts enabled |
| notify_monthly | INTEGER | 0 or 1 | 1 | Monthly summary notification enabled |
| notify_time | TEXT | HH:MM format | '08:00' | Preferred notification time |
| notify_monthly_day | INTEGER | 1-28 | 1 | Day of month for monthly summary |
| plant_list_view | TEXT | One of: 'list', 'grid' | 'list' | Default plant list view mode |
| care_calendar_view | TEXT | One of: 'week', 'month' | 'week' | Default care calendar view |
| plant_list_sort | TEXT | One of: 'name_asc', 'name_desc', 'date_added', 'status', 'location' | 'name_asc' | Default plant list sort |
| onboarding_completed | INTEGER | 0 or 1 | 0 | Whether onboarding has been completed |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Singleton record (only one row in the table)

**Indexes:**
- None needed (single-row table)

**Validation Rules:**
- `usda_zone`: If provided, must be a valid zone string (1a through 13b)
- `custom_last_frost` and `custom_first_frost`: If provided, must be valid MM-DD format
- `notify_time`: Must be valid HH:MM in 24-hour format
- `notify_monthly_day`: Must be between 1 and 28 (avoiding month-end edge cases)
- Settings are always upserted (insert or update the singleton row)

**Example Data:**

```json
{
  "id": "user_settings",
  "usda_zone": "7a",
  "hemisphere": "northern",
  "custom_last_frost": null,
  "custom_first_frost": null,
  "temp_unit": "fahrenheit",
  "weight_unit": "lb",
  "dimension_unit": "feet",
  "volume_unit": "ml",
  "notify_watering": 1,
  "notify_care": 1,
  "notify_frost": 1,
  "notify_monthly": 1,
  "notify_time": "08:00",
  "notify_monthly_day": 1,
  "plant_list_view": "grid",
  "care_calendar_view": "week",
  "plant_list_sort": "name_asc",
  "onboarding_completed": 1,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-03-07T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Data Deletion

**Purpose:** Permanently delete all user garden data.

**Inputs:**
- confirmation_text: string (must match "DELETE")

**Logic:**

```
1. VALIDATE confirmation_text == "DELETE"
2. BEGIN transaction
3. DELETE all records from ALL user data tables:
     Plants, JournalEntries, WateringLogs, CareEvents, CareScheduleConfigs,
     Harvests, PestObservations, PestPhotos, Treatments,
     FertilizerProducts, FertilizerApplications,
     SeedPackets, GerminationLogs, SeedPlantLinks,
     PropagationAttempts, PropagationPhotos, PropagationPlantLinks,
     WishListItems, Zones, GardenBeds, BedLayers, BedCells,
     HealthScores, AppearanceRatings, FrostAlerts,
     SeasonalChecklists, ChecklistItems, RainLogs, RecentSearches,
     CompanionNotes
4. DELETE all photo files from the garden photos directory
5. RESET UserSettings to defaults (except keep onboarding_completed = 1)
6. COMMIT transaction
7. RETURN success
```

**Edge Cases:**
- Confirmation text does not match: reject with "Please type DELETE to confirm"
- Deletion fails mid-transaction: rollback, no data deleted
- Photo deletion fails for some files: log warnings, continue with database deletion
- Bundled data (Species, CompanionRelationship, PestDiseaseRef, ZoneLookup): NOT deleted (read-only reference data)

##### Unit Conversion Display

**Purpose:** Convert stored values to user's preferred display units.

**Logic:**

```
Temperature:
  IF unit == 'celsius' THEN display = (value_f - 32) * 5/9
  IF unit == 'fahrenheit' THEN display = value_f (stored as F)

Weight: (stored as grams)
  'g':  display = value
  'oz': display = value / 28.3495
  'lb': display = value / 453.592
  'kg': display = value / 1000

Dimensions: (stored as feet)
  'feet':   display = value
  'meters': display = value * 0.3048

Volume: (stored as ml)
  'ml':     display = value
  'fl_oz':  display = value / 29.5735
  'cups':   display = value / 236.588
  'liters': display = value / 1000
```

**Sort/Filter/Ranking Logic:**
- Not applicable (settings screen has fixed layout)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Settings save fails | Toast: "Could not save settings. Please try again." | User retries |
| ZIP code lookup fails | Inline error: "ZIP code not found. Select zone manually." | User selects zone from dropdown |
| Data deletion fails | Error: "Could not delete data. Please try again." Database unchanged | User retries |
| Invalid notification time | Inline validation: "Enter a valid time (HH:MM)" | User corrects time |
| Confirmation text mismatch | Error: "Please type DELETE to confirm" | User types exact text |

**Validation Timing:**
- Zone validation runs on selection/lookup
- Notification time validates on blur
- Deletion confirmation validates on submit

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enters ZIP code "97201",
   **When** they tap "Look Up Zone",
   **Then** the zone is set to "8b" and frost dates update accordingly.

2. **Given** the user changes weight unit from grams to pounds,
   **When** they view harvest data,
   **Then** all weights display in pounds (e.g., 680g shows as "1.5 lb").

3. **Given** the user types "DELETE" in the confirmation field,
   **When** they confirm data deletion,
   **Then** all user data and photos are deleted, settings reset to defaults, and the app shows the empty state.

**Edge Cases:**

4. **Given** the user sets custom frost dates that differ from zone defaults,
   **When** the planting calendar and frost alerts compute dates,
   **Then** the custom dates are used instead of zone defaults.

5. **Given** the user disables all notifications,
   **When** watering, care, and frost events occur,
   **Then** no notifications are sent, but dashboard indicators still show due tasks.

**Negative Tests:**

6. **Given** the user types "delete" (lowercase) in the confirmation field,
   **When** they submit,
   **Then** the error shows: "Please type DELETE to confirm." and no data is deleted.

7. **Given** the user enters an invalid notification time "25:00",
   **When** the field loses focus,
   **Then** validation shows: "Enter a valid time (HH:MM)."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts F to C | 72F | 22.2C |
| converts C to F | 22.2C | 72F |
| converts grams to pounds | 680g | 1.5 lb |
| converts feet to meters | 8ft | 2.4m |
| converts ml to fl oz | 250ml | 8.5 fl oz |
| validates zone "7a" | zone: "7a" | valid |
| rejects zone "14a" | zone: "14a" | invalid |
| validates notification time | time: "08:00" | valid |
| rejects invalid time | time: "25:00" | invalid |
| accepts DELETE confirmation | text: "DELETE" | valid |
| rejects lowercase delete | text: "delete" | invalid |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Set zone and verify cascade | 1. Set zone to 7a, 2. Check frost alerts, planting calendar | Frost dates and planting windows use zone 7a data |
| Change weight unit | 1. Set unit to lb, 2. View harvest with 680g | Displayed as "1.5 lb" |
| Delete all data | 1. Add plants and data, 2. Delete all, 3. Check database | All user tables empty, photos deleted, settings reset |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User configures app on first use | 1. Set zone via ZIP, 2. Set hemisphere, 3. Set preferred units, 4. Configure notifications | All settings saved, app customized, features use correct zone/units |

---

### GD-025: Onboarding and First-Run

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | GD-025 |
| **Feature Name** | Onboarding and First-Run |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a new user opening MyGarden for the first time, I want a guided setup that helps me configure my zone, add my first plant, and understand the app's key features, so that I can start using the app productively within 5 minutes.

**Secondary:**
> As a returning user who has completed onboarding, I want to skip it and go directly to the dashboard, so I do not see the setup screens again.

#### 3.3 Detailed Description

Onboarding provides a first-run experience that introduces MyGarden and configures essential settings. The onboarding flow runs once when the user opens the app for the first time (or when `onboarding_completed` is false in UserSettings). After completion, the onboarding flag is set to true and the user goes directly to the dashboard on subsequent launches.

The onboarding flow consists of 5 screens:

**Screen 1: Welcome**
- Title: "Welcome to MyGarden"
- Subtitle: "Your private plant care companion"
- Brief description of core features (3 bullet points with icons)
- Privacy callout: "All your data stays on your device. No accounts, no cloud, no tracking."
- "Get Started" button

**Screen 2: Set Your Zone**
- Title: "Where Do You Garden?"
- ZIP code input with "Look Up" button (or manual zone selection dropdown)
- Hemisphere toggle (auto-detected if possible based on locale)
- Skip option: "I'll set this later" (can configure in Settings)

**Screen 3: Add Your First Plant**
- Title: "Add Your First Plant"
- Quick-add form: plant name (required), species picker (optional, shows top 10 popular species), photo (optional, camera/library)
- "Add Plant" button and "Skip" option
- If species selected: brief care summary shown (watering interval, light level)

**Screen 4: Tour Highlights**
- Title: "What You Can Do"
- Carousel of 4 feature cards:
  1. "Smart Watering" - Track and schedule watering for every plant
  2. "Photo Journal" - Document growth with dated photos
  3. "Garden Planning" - Map your beds and plan plantings by zone
  4. "Harvest Tracking" - Log yields from your edible garden
- Each card: icon, title, 1-sentence description
- Swipe or tap to advance

**Screen 5: Ready to Grow**
- Title: "You're All Set!"
- Summary of what was configured (zone, first plant if added)
- "Explore MyGarden" button (goes to dashboard)
- Tip: "You can always change settings later in the Settings tab."

The onboarding flow is skippable at any point via a "Skip" button in the nav bar. Skipping does not mark onboarding as complete; the user will see it again on next launch. Only reaching the final screen and tapping "Explore MyGarden" (or "Done") sets `onboarding_completed = true`.

Sample data mode: if the user skips adding a plant during onboarding, the dashboard shows an interactive guided prompt: "Start by adding your first plant" pointing to the add button.

#### 3.4 Prerequisites

**Feature Dependencies:**
- GD-024: Settings and Preferences - Stores onboarding completion flag, zone, hemisphere
- GD-001: Plant Catalog - First plant creation during onboarding
- GD-005: Planting Calendar by USDA Zone - Zone lookup during onboarding
- GD-018: Plant Care Database - Species picker during onboarding

**External Dependencies:**
- None (onboarding uses only bundled data and local storage)

**Assumed Capabilities:**
- App is freshly installed or onboarding_completed = false
- Local database is initialized

#### 3.5 User Interface Requirements

##### Screen Flow: Onboarding (5 screens)

**Layout (all screens):**
- Full-screen modal presentation (covers the tab bar)
- Page indicator dots at the bottom (5 dots, current highlighted)
- "Skip" button in the top-right corner of screens 2-4
- "Back" button in the top-left corner of screens 2-5
- Primary action button at the bottom of each screen

**Screen 1: Welcome**
- Large app icon or illustration (potted plant with digital care indicators)
- Title and subtitle centered
- 3 feature bullets with icons:
  - Plant icon: "Track every plant in your garden"
  - Water droplet icon: "Smart watering reminders"
  - Lock icon: "100% private - your data stays on your device"
- "Get Started" button (bottom, primary)

**Screen 2: Set Your Zone**
- ZIP code input field (numeric keyboard, 5 digits)
- "Look Up" button next to ZIP input
- After lookup: zone badge displayed (e.g., "Zone 7a - Portland, OR area")
- Manual zone dropdown (collapsed by default, "Select zone manually" link to expand)
- Hemisphere toggle (Northern / Southern)
- "Next" button and "I'll set this later" text link

**Screen 3: Add Your First Plant**
- Plant name text input
- Species picker: compact scrollable list of 10 popular species (Monstera, Pothos, Snake Plant, Basil, Tomato, Succulent, Fiddle Leaf Fig, Spider Plant, Peace Lily, Lavender) with "More..." link to full database search
- Photo capture button (camera icon) and "Choose from Library" link
- If species selected: small card showing watering interval and light preference
- "Add Plant" button and "Skip for now" text link

**Screen 4: Tour Highlights**
- Horizontally swipeable carousel of 4 feature cards
- Each card: full-width, centered icon (64x64), title, 1-sentence description, subtle gradient background
- Auto-advance every 4 seconds (pause on touch)
- "Next" button

**Screen 5: Ready to Grow**
- Celebration illustration (garden with plants)
- Summary section:
  - "Zone: 7a" (or "Not set" if skipped)
  - "First plant: Monstera" (or "No plants yet" if skipped)
- "Explore MyGarden" button (primary, large)
- Secondary text: "You can always change settings in the Settings tab."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| First Launch | onboarding_completed = false | Onboarding flow starts |
| Returning User | onboarding_completed = true | Skip to dashboard |
| Skipped at Screen 3 | User tapped "Skip" during tour | onboarding remains incomplete; shows again next launch |
| Completed | User reached Screen 5 and tapped "Explore" | onboarding_completed set to true, dashboard loads |

**Interactions:**
- Tap "Get Started": advance to screen 2
- Tap "Look Up" (ZIP): looks up zone, displays result
- Tap species in list: selects species, shows care preview
- Tap "Add Plant": creates Plant record, advances to screen 4
- Swipe cards: manually advance carousel
- Tap "Explore MyGarden": sets onboarding_completed = true, navigates to dashboard
- Tap "Skip" (any screen): advances to next screen without saving that screen's data
- Tap "Back": returns to previous screen with data preserved

**Transitions/Animations:**
- Screen transitions: horizontal slide (left to right for forward, right to left for back)
- Page dots: animated fill on transition
- Feature cards: subtle parallax effect on swipe
- Zone lookup: spinner during lookup, badge slides in on success
- Celebration screen: confetti or gentle plant growth animation, 1 second

#### 3.6 Data Requirements

No new entities. Onboarding writes to:
- `UserSettings.onboarding_completed` (boolean)
- `UserSettings.usda_zone` (from zone setup)
- `UserSettings.hemisphere` (from zone setup)
- `Plant` (from first plant creation, optional)

#### 3.7 Business Logic Rules

##### Onboarding Flow Control

**Purpose:** Determine whether to show onboarding and track progress.

**Logic:**

```
1. ON app launch:
     QUERY UserSettings.onboarding_completed
     IF false OR settings record does not exist THEN
       SHOW onboarding flow
     ELSE
       SHOW dashboard

2. Onboarding progression:
     Screen 1 -> always shown
     Screen 2 -> zone setup (optional, data saved on "Next")
     Screen 3 -> first plant (optional, plant created on "Add Plant")
     Screen 4 -> tour (informational only)
     Screen 5 -> completion
       ON "Explore MyGarden" tap:
         SET onboarding_completed = true
         NAVIGATE to dashboard

3. Skip behavior:
     "Skip" on screens 2-4: advance to next screen without saving
     Does NOT set onboarding_completed
     On next app launch, onboarding starts from screen 1 again
```

**Edge Cases:**
- App killed during onboarding (before completion): onboarding_completed remains false, restarts from screen 1
- Zone set during onboarding, then user skips without completing: zone setting is preserved (it was saved when the user tapped "Next")
- Plant added during onboarding, then user quits: plant record is preserved (it was saved when "Add Plant" was tapped)
- User force-clears app data: onboarding_completed resets, onboarding shows again

**Sort/Filter/Ranking Logic:**
- Popular species list on Screen 3 is static, ordered by popularity (Monstera, Pothos, Snake Plant, Basil, Tomato, Succulent, Fiddle Leaf Fig, Spider Plant, Peace Lily, Lavender)
- No user sort/filter during onboarding

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| ZIP code lookup fails | Inline error: "ZIP code not found. Select zone manually." | User selects zone from dropdown |
| Plant creation fails during onboarding | Toast: "Could not save plant. You can add it later from the dashboard." | User proceeds without plant; adds later |
| Settings save fails | Toast: "Could not save settings. You can set these later in Settings." | User proceeds; configures in Settings |

**Validation Timing:**
- ZIP code validates on "Look Up" tap (5-digit check + lookup)
- Plant name validates on "Add Plant" tap (non-empty check)
- No blocking validation; all onboarding steps are skippable

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the app for the first time,
   **When** the app launches,
   **Then** the Welcome screen appears with the privacy callout and "Get Started" button.

2. **Given** the user enters ZIP code "97201" on the zone setup screen,
   **When** they tap "Look Up",
   **Then** the zone badge shows "Zone 8b" and hemisphere is auto-set to Northern.

3. **Given** the user adds "Monstera" as their first plant with the species selected,
   **When** they tap "Add Plant",
   **Then** the plant is created in the catalog with species defaults, and the screen advances to the tour.

4. **Given** the user reaches Screen 5 and taps "Explore MyGarden",
   **When** the dashboard loads,
   **Then** onboarding_completed is true, the dashboard shows the newly added plant, and subsequent app launches skip directly to the dashboard.

**Edge Cases:**

5. **Given** the user skips the zone setup (taps "I'll set this later"),
   **When** they reach Screen 5,
   **Then** the summary shows "Zone: Not set" and the user can configure it later in Settings.

6. **Given** the user skips at Screen 3 (does not add a plant),
   **When** they reach the dashboard,
   **Then** the dashboard shows the empty state with a guided prompt: "Start by adding your first plant."

7. **Given** the user force-quits the app at Screen 3 (before completing),
   **When** they reopen the app,
   **Then** onboarding starts from Screen 1 again (but any saved data like zone setting is preserved).

**Negative Tests:**

8. **Given** the user enters ZIP "00000" (invalid),
   **When** they tap "Look Up",
   **Then** the error shows: "ZIP code not found. Select zone manually."
   **And** the zone is not set.

9. **Given** the user tries to add a plant with a blank name,
   **When** they tap "Add Plant",
   **Then** inline validation shows: "Plant name is required" and no plant is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| shows onboarding when not completed | onboarding_completed: false | show: true |
| skips onboarding when completed | onboarding_completed: true | show: false |
| shows onboarding when settings missing | no settings record | show: true |
| sets onboarding_completed on finish | user reaches screen 5, taps Explore | onboarding_completed: true |
| does not set completed on skip | user skips at screen 3 | onboarding_completed: false |
| preserves zone on skip-before-complete | zone set at screen 2, skip at screen 4 | zone preserved in settings |
| validates ZIP code format | zip: "9720" (4 digits) | invalid |
| plant creation with species defaults | species: Monstera | plant with watering interval 7 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete onboarding flow | 1. Start, 2. Set zone, 3. Add Monstera, 4. View tour, 5. Tap Explore | Dashboard shows with Monstera, zone set, onboarding_completed true |
| Skip entire onboarding | 1. Start, 2. Skip zone, 3. Skip plant, 4. View tour, 5. Tap Explore | Dashboard shows empty state, no zone, onboarding_completed true |
| Force quit during onboarding | 1. Set zone on screen 2, 2. Force quit, 3. Relaunch | Onboarding restarts at screen 1, zone setting preserved |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user completes full onboarding | 1. Open app first time, 2. Set zone 7a via ZIP, 3. Add "Pothos" with species, 4. Browse tour, 5. Tap Explore | Dashboard shows Pothos with care defaults, zone 7a set, frost dates computed, watering schedule active, onboarding won't show again |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Plant** entity, which is the core record in MyGarden. Nearly every other entity references a Plant: watering logs track when plants are watered, journal entries document plant growth with photos, care events record scheduled care activities, harvests log produce from edible plants, pest observations track issues affecting plants, health scores measure plant wellbeing, and propagation attempts record reproduction of plants.

Plants are organized by **Zone** (rooms or outdoor areas) and can be placed in **GardenBed** layouts using a grid system with layers for planning seasonal rotations. Plants reference a **Species** record from the bundled read-only plant care database, which provides care defaults, planting windows, companion planting relationships, and seasonal tips.

Supporting entities include **SeedPacket** (seed inventory with germination tracking), **WishListItem** (plants the user wants to acquire), **FertilizerProduct** (user-built fertilizer inventory with NPK ratios), and **UserSettings** (singleton configuration record).

The bundled read-only reference data includes **Species** (~300 entries), **CompanionRelationship** (~800 pairwise relationships), **PestDiseaseRef** (~80 common pests and diseases), and **ZoneLookup** (~42,000 US ZIP-to-USDA-zone mappings).

### 4.2 Complete Entity Definitions

#### Entity: Plant

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| common_name | TEXT | Required, max 255 chars | None | User-given plant name |
| scientific_name | TEXT | Optional, max 255 chars | null | Botanical name |
| species_id | TEXT (UUID) | Optional, references Species.id | null | Linked species for care defaults |
| acquisition_date | TEXT | ISO 8601 date | Current date | When the plant was acquired |
| acquisition_method | TEXT | One of: 'purchased', 'grown_from_seed', 'gifted', 'propagated', 'rescued' | 'purchased' | How the plant was obtained |
| status | TEXT | One of: 'alive', 'dormant', 'dead', 'given_away' | 'alive' | Current lifecycle status |
| death_date | TEXT | ISO 8601 date, optional | null | Date of death (if status is dead) |
| given_away_date | TEXT | ISO 8601 date, optional | null | Date given away |
| given_away_to | TEXT | Optional, max 200 chars | null | Recipient name |
| location_type | TEXT | One of: 'indoor', 'outdoor' | 'indoor' | Physical location classification |
| zone_id | TEXT (UUID) | Optional, references Zone.id | null | Assigned room/zone |
| garden_bed_id | TEXT (UUID) | Optional, references GardenBed.id | null | Assigned garden bed (outdoor only) |
| primary_photo_path | TEXT | Optional | null | Local file path to primary photo |
| sunlight_override | TEXT | Optional | null | User override for light preference |
| water_interval_override | INTEGER | Optional, min 1, max 365 | null | User override for watering interval (days) |
| notes | TEXT | Optional, max 2000 chars | null | User notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: Zone

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, max 100 chars, unique per location_type | None | Zone display name |
| location_type | TEXT | One of: 'indoor', 'outdoor' | 'indoor' | Location classification |
| light_level | TEXT | One of: 'full_sun', 'bright_indirect', 'low_light', 'shade', null | null | Light availability |
| description | TEXT | Optional, max 200 chars | null | Zone description |
| sort_order | INTEGER | Min 0 | 0 | Display ordering |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: GardenBed

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, max 100 chars | None | Bed label |
| width | REAL | Required, min 1.0, max 100.0 | None | Bed width |
| length | REAL | Required, min 1.0, max 100.0 | None | Bed length |
| unit | TEXT | One of: 'feet', 'meters' | 'feet' | Measurement unit |
| grid_resolution | REAL | One of: 1.0, 0.5, 0.25 | 1.0 | Grid cell size |
| soil_type | TEXT | One of: 'loam', 'clay', 'sandy', 'silt', 'chalky', 'peat', 'rocky', 'container_mix', 'unknown' | 'unknown' | Soil composition |
| sun_exposure | TEXT | One of: 'full_sun', 'partial_sun', 'partial_shade', 'full_shade' | 'full_sun' | Sunlight classification |
| sort_order | INTEGER | Min 0 | 0 | Display ordering |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: BedLayer

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| bed_id | TEXT (UUID) | Required, references GardenBed.id | None | Parent bed |
| name | TEXT | Required, max 100 chars | None | Layer label |
| layer_type | TEXT | One of: 'current', 'plan', 'archived' | 'plan' | Layer category |
| is_active | INTEGER | 0 or 1 | 0 | Whether this is the active layout |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: BedCell

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| layer_id | TEXT (UUID) | Required, references BedLayer.id | None | Parent layer |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Placed plant |
| row_index | INTEGER | Required, min 0 | None | Grid row (0-indexed) |
| col_index | INTEGER | Required, min 0 | None | Grid column (0-indexed) |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: JournalEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Parent plant |
| entry_date | TEXT | ISO 8601 date, required | Current date | When the photo/entry was taken |
| photo_path | TEXT | Required | None | Local file path to the photo |
| note | TEXT | Optional, max 1000 chars | null | User note for this entry |
| is_primary | INTEGER | 0 or 1 | 0 | Whether this is the plant's primary photo |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: WateringLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Watered plant |
| watered_at | TEXT | ISO 8601 datetime | Current timestamp | When watering occurred |
| amount_ml | INTEGER | Optional, min 1, max 10000 | null | Water amount in ml |
| note | TEXT | Optional, max 500 chars | null | Watering note |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: RainLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| logged_date | TEXT | ISO 8601 date | Current date | Date rain occurred |
| precipitation_mm | REAL | Required, min 0.1, max 500.0 | None | Rainfall in mm |
| note | TEXT | Optional, max 500 chars | null | Rain note |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: CareEvent

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Plant receiving care |
| care_type | TEXT | One of: 'watering', 'fertilizing', 'pruning', 'repotting', 'custom' | None | Care type |
| scheduled_date | TEXT | ISO 8601 date | None | When task was due |
| completed_date | TEXT | ISO 8601 date, optional | null | When task was done |
| outcome | TEXT | One of: 'completed', 'skipped', 'snoozed', 'pending' | 'pending' | Task outcome |
| task_name | TEXT | Optional (required for custom), max 200 chars | null | Custom task label |
| notes | TEXT | Optional, max 500 chars | null | Care notes |
| is_recurring | INTEGER | 0 or 1 | 1 | Whether this recurs |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: CareScheduleConfig

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Configured plant |
| care_type | TEXT | One of: 'fertilizing', 'pruning', 'repotting' | None | Care type |
| interval_days | INTEGER | Required, min 1, max 730 | None | Days between events |
| seasonal_adjust | INTEGER | 0 or 1 | 1 | Apply seasonal multiplier |
| active_seasons | TEXT | Comma-separated seasons | 'spring,summer,fall,winter' | Active seasons |
| last_performed | TEXT | ISO 8601 date, optional | null | Most recent completion |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: Harvest

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Harvested plant |
| harvest_date | TEXT | ISO 8601 date, required | Current date | When harvested |
| weight_grams | REAL | Required, min 0.1, max 1000000 | None | Weight in grams |
| count | INTEGER | Optional, min 1, max 10000 | null | Item count |
| quality_rating | INTEGER | Required, min 1, max 5 | 3 | Quality assessment |
| photo_path | TEXT | Optional | null | Harvest photo path |
| notes | TEXT | Optional, max 500 chars | null | Harvest notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: PestObservation

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Affected plant |
| issue_type | TEXT | One of: 'pest', 'disease', 'other' | None | Problem category |
| pest_disease_id | TEXT (UUID) | Optional, references PestDiseaseRef.id | null | Reference entry |
| custom_name | TEXT | Optional, max 100 chars | null | Custom issue name |
| severity | INTEGER | Required, min 1, max 5 | 3 | Severity rating |
| affected_areas | TEXT | Comma-separated | None | Affected plant parts |
| status | TEXT | One of: 'observed', 'treated', 'resolved', 'ongoing' | 'observed' | Issue status |
| observed_date | TEXT | ISO 8601 date, required | Current date | When noticed |
| resolved_date | TEXT | ISO 8601 date, optional | null | When resolved |
| notes | TEXT | Optional, max 1000 chars | null | Detailed description |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: Treatment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| observation_id | TEXT (UUID) | Required, references PestObservation.id | None | Parent observation |
| treatment_type | TEXT | One of: 'organic_spray', 'chemical_pesticide', 'manual_removal', 'pruning', 'quarantine', 'environmental_change', 'other' | None | Treatment category |
| product_name | TEXT | Optional, max 200 chars | null | Product used |
| application_notes | TEXT | Optional, max 500 chars | null | Application details |
| treatment_date | TEXT | ISO 8601 date, required | Current date | When applied |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: PestPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| observation_id | TEXT (UUID) | Required, references PestObservation.id | None | Parent observation |
| photo_path | TEXT | Required | None | Photo file path |
| sort_order | INTEGER | Min 0 | 0 | Display order |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: FertilizerProduct

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, max 200 chars | None | Product name |
| npk_n | INTEGER | Required, min 0, max 100 | 0 | Nitrogen % |
| npk_p | INTEGER | Required, min 0, max 100 | 0 | Phosphorus % |
| npk_k | INTEGER | Required, min 0, max 100 | 0 | Potassium % |
| type | TEXT | One of: 'liquid', 'granular', 'slow_release', 'organic_compost', 'fish_emulsion', 'other' | 'liquid' | Fertilizer form |
| notes | TEXT | Optional, max 500 chars | null | Usage notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: FertilizerApplication

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Fertilized plant |
| product_id | TEXT (UUID) | Required, references FertilizerProduct.id | None | Product used |
| application_date | TEXT | ISO 8601 date, required | Current date | When applied |
| dilution | TEXT | Optional, max 100 chars | null | Dilution rate |
| amount_ml | REAL | Required, min 0.1, max 100000 | None | Amount in ml |
| notes | TEXT | Optional, max 500 chars | null | Application notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: SeedPacket

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| variety_name | TEXT | Required, max 200 chars | None | Seed variety name |
| species_id | TEXT (UUID) | Optional, references Species.id | null | Linked species |
| source | TEXT | Optional, max 200 chars | null | Where purchased |
| lot_number | TEXT | Optional, max 100 chars | null | Batch number |
| purchase_date | TEXT | ISO 8601 date, required | Current date | When acquired |
| quantity | INTEGER | Required, min 0, max 100000 | None | Current quantity |
| quantity_unit | TEXT | One of: 'seeds', 'grams' | 'seeds' | Quantity unit |
| initial_quantity | INTEGER | Required, min 1, max 100000 | None | Original quantity |
| viability_years | INTEGER | Required, min 1, max 20 | None | Viability period |
| notes | TEXT | Optional, max 1000 chars | null | User notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: GerminationLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| seed_packet_id | TEXT (UUID) | Required, references SeedPacket.id | None | Tested seed packet |
| seeds_planted | INTEGER | Required, min 1 | None | Seeds used |
| seeds_germinated | INTEGER | Required, min 0 | None | Seeds that germinated |
| germination_rate | REAL | Computed, 0-100 | None | Percentage germinated |
| start_date | TEXT | ISO 8601 date, required | None | When planted |
| observed_date | TEXT | ISO 8601 date, required | None | When counted |
| days_to_germination | INTEGER | Computed | None | Days from start to observation |
| notes | TEXT | Optional, max 500 chars | null | Conditions notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: SeedPlantLink

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| seed_packet_id | TEXT (UUID) | Required, references SeedPacket.id | None | Source seed |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Resulting plant |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: PropagationAttempt

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| parent_plant_id | TEXT (UUID) | Required, references Plant.id | None | Parent plant |
| species_id | TEXT (UUID) | Optional, references Species.id | null | Species for aggregation |
| method | TEXT | One of: 'stem_cutting', 'leaf_cutting', 'division', 'air_layering', 'offset', 'seed', 'grafting', 'other' | None | Propagation method |
| batch_size | INTEGER | Required, min 1, max 100 | 1 | Attempts in batch |
| successful_count | INTEGER | Min 0 | 0 | Successes |
| failed_count | INTEGER | Min 0 | 0 | Failures |
| status | TEXT | One of: 'started', 'rooting', 'established', 'failed', 'given_away' | 'started' | Batch status |
| start_date | TEXT | ISO 8601 date, required | Current date | When started |
| root_date | TEXT | ISO 8601 date, optional | null | When roots observed |
| established_date | TEXT | ISO 8601 date, optional | null | When established |
| given_away_to | TEXT | Optional, max 200 chars | null | Recipient |
| given_away_date | TEXT | ISO 8601 date, optional | null | Date given |
| notes | TEXT | Optional, max 500 chars | null | User notes |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: WishListItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_name | TEXT | Required, max 200 chars | None | Desired plant name |
| species_id | TEXT (UUID) | Optional, references Species.id | null | Linked species |
| priority | TEXT | One of: 'low', 'medium', 'high' | 'medium' | Priority |
| location_intent | TEXT | One of: 'indoor', 'outdoor', 'not_sure' | 'not_sure' | Planned location |
| photo_path | TEXT | Optional | null | Photo file path |
| notes | TEXT | Optional, max 1000 chars | null | User notes |
| sort_order | INTEGER | Min 0 | 0 | Custom sort position |
| status | TEXT | One of: 'wanted', 'acquired', 'removed' | 'wanted' | Item status |
| acquired_date | TEXT | ISO 8601 date, optional | null | When acquired |
| linked_plant_id | TEXT (UUID) | Optional, references Plant.id | null | Resulting plant |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: HealthScore

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Scored plant |
| score_date | TEXT | ISO 8601 date, required | Current date | Computation date |
| overall_score | REAL | Min 0, max 100 | None | Composite score |
| watering_score | REAL | Min 0, max 100 | None | Watering component |
| pest_free_score | REAL | Min 0, max 100 | None | Pest-free component |
| growth_score | REAL | Min 0, max 100 | None | Growth component |
| appearance_score | REAL | Min 0, max 100 | None | Appearance component |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: AppearanceRating

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| plant_id | TEXT (UUID) | Required, references Plant.id | None | Rated plant |
| rating | INTEGER | Required, min 1, max 5 | None | 1=wilting, 5=thriving |
| note | TEXT | Optional, max 200 chars | null | Rating note |
| rated_date | TEXT | ISO 8601 date, required | Current date | When rated |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: FrostAlert

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| alert_type | TEXT | One of: 'spring_4w', 'spring_2w', 'spring_1w', 'spring_day', 'spring_2w_after', 'fall_4w', 'fall_2w', 'fall_1w', 'fall_day' | None | Alert milestone |
| target_date | TEXT | ISO 8601 date | None | Notification date |
| year | INTEGER | Required | None | Calendar year |
| delivered | INTEGER | 0 or 1 | 0 | Has been sent |
| dismissed | INTEGER | 0 or 1 | 0 | User dismissed |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: UserSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, always "user_settings" | "user_settings" | Singleton |
| usda_zone | TEXT | Optional, '1a'-'13b' | null | Hardiness zone |
| hemisphere | TEXT | One of: 'northern', 'southern' | 'northern' | Hemisphere |
| custom_last_frost | TEXT | Optional, MM-DD format | null | Override last frost |
| custom_first_frost | TEXT | Optional, MM-DD format | null | Override first frost |
| temp_unit | TEXT | One of: 'fahrenheit', 'celsius' | 'fahrenheit' | Temperature unit |
| weight_unit | TEXT | One of: 'g', 'oz', 'lb', 'kg' | 'g' | Weight unit |
| dimension_unit | TEXT | One of: 'feet', 'meters' | 'feet' | Length unit |
| volume_unit | TEXT | One of: 'ml', 'fl_oz', 'cups', 'liters' | 'ml' | Volume unit |
| notify_watering | INTEGER | 0 or 1 | 1 | Watering notifications |
| notify_care | INTEGER | 0 or 1 | 1 | Care notifications |
| notify_frost | INTEGER | 0 or 1 | 1 | Frost alerts |
| notify_monthly | INTEGER | 0 or 1 | 1 | Monthly summary |
| notify_time | TEXT | HH:MM format | '08:00' | Notification time |
| notify_monthly_day | INTEGER | 1-28 | 1 | Monthly summary day |
| plant_list_view | TEXT | One of: 'list', 'grid' | 'list' | Default view |
| care_calendar_view | TEXT | One of: 'week', 'month' | 'week' | Default calendar view |
| plant_list_sort | TEXT | Sort option string | 'name_asc' | Default sort |
| onboarding_completed | INTEGER | 0 or 1 | 0 | Onboarding done |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Last modification time |

#### Entity: RecentSearch

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| query | TEXT | Required, max 200 chars | None | Search query |
| result_count | INTEGER | Min 0 | 0 | Results found |
| searched_at | TEXT | ISO 8601 datetime | Current timestamp | When searched |

#### Entity: SeasonalChecklist

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| season | TEXT | One of: 'spring', 'summer', 'fall', 'winter' | None | Season |
| year | INTEGER | Required | None | Calendar year |
| hemisphere | TEXT | One of: 'northern', 'southern' | None | Hemisphere |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

#### Entity: ChecklistItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| checklist_id | TEXT (UUID) | Required, references SeasonalChecklist.id | None | Parent checklist |
| category | TEXT | One of: 'watering', 'fertilizer', 'protection', 'planting' | None | Item category |
| description | TEXT | Required, max 500 chars | None | Task description |
| affected_plant_count | INTEGER | Min 0 | 0 | Plants affected |
| completed | INTEGER | 0 or 1 | 0 | Checked off |
| completed_date | TEXT | ISO 8601 date, optional | null | When completed |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Plant -> Zone | many-to-one | A plant belongs to one zone |
| Plant -> GardenBed | many-to-one | A plant is in one bed (outdoor only) |
| Plant -> Species | many-to-one | A plant references one species |
| Plant -> JournalEntry | one-to-many | A plant has many journal entries |
| Plant -> WateringLog | one-to-many | A plant has many watering logs |
| Plant -> CareEvent | one-to-many | A plant has many care events |
| Plant -> CareScheduleConfig | one-to-many | A plant has care configs per type |
| Plant -> Harvest | one-to-many | A plant has many harvests |
| Plant -> PestObservation | one-to-many | A plant has many pest observations |
| Plant -> HealthScore | one-to-many | A plant has many health scores (daily) |
| Plant -> AppearanceRating | one-to-many | A plant has many appearance ratings |
| Plant -> FertilizerApplication | one-to-many | A plant has many fertilizer applications |
| GardenBed -> BedLayer | one-to-many | A bed has many layers |
| BedLayer -> BedCell | one-to-many | A layer has many cells |
| BedCell -> Plant | many-to-one | A cell contains one plant |
| PestObservation -> Treatment | one-to-many | An observation has many treatments |
| PestObservation -> PestPhoto | one-to-many | An observation has up to 3 photos |
| PestObservation -> PestDiseaseRef | many-to-one | An observation may reference a bundled pest/disease |
| FertilizerApplication -> FertilizerProduct | many-to-one | An application uses one product |
| SeedPacket -> GerminationLog | one-to-many | A seed packet has many germination tests |
| SeedPacket -> SeedPlantLink -> Plant | many-to-many | Seeds produce plants (lineage) |
| PropagationAttempt -> Plant (parent) | many-to-one | An attempt has one parent plant |
| PropagationAttempt -> PropagationPlantLink -> Plant (child) | many-to-many | Attempts produce child plants |
| WishListItem -> Species | many-to-one | A wish list item may reference a species |
| WishListItem -> Plant | one-to-one | A wish list item may link to an acquired plant |
| Species -> PlantingWindow | one-to-many | A species has many planting windows |
| Species <-> Species (CompanionRelationship) | many-to-many | Species have companion relationships |
| SeasonalChecklist -> ChecklistItem | one-to-many | A checklist has many items |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Plant | idx_plant_name | common_name COLLATE NOCASE | Sorted listing by name |
| Plant | idx_plant_status | status | Filter by alive/dormant/dead |
| Plant | idx_plant_zone | zone_id | View plants by zone |
| Plant | idx_plant_bed | garden_bed_id | View plants by bed |
| Plant | idx_plant_species | species_id | Look up care defaults |
| WateringLog | idx_water_plant_date | (plant_id, watered_at DESC) | Most recent watering per plant |
| CareEvent | idx_care_plant_type | (plant_id, care_type, scheduled_date DESC) | Latest care per type |
| CareEvent | idx_care_schedule | (scheduled_date, outcome) | Calendar date range queries |
| CareScheduleConfig | idx_care_config | (plant_id, care_type) UNIQUE | One config per type per plant |
| Harvest | idx_harvest_plant | (plant_id, harvest_date DESC) | Per-plant harvest history |
| PestObservation | idx_pest_plant | (plant_id, observed_date DESC) | Per-plant issue history |
| PestObservation | idx_pest_status | status | Filter active vs resolved |
| GardenBed | idx_bed_order | sort_order | User-defined ordering |
| BedLayer | idx_layer_active | (bed_id, is_active) | Find active layer |
| BedCell | idx_cell_position | (layer_id, row_index, col_index) UNIQUE | Prevent duplicate placements |
| SeedPacket | idx_seed_name | variety_name COLLATE NOCASE | Sorted listing |
| HealthScore | idx_health_plant | (plant_id, score_date DESC) | Latest score per plant |
| FrostAlert | idx_frost_type_year | (alert_type, year) UNIQUE | One alert per milestone per year |
| Species | idx_species_name | scientific_name UNIQUE | Species lookup |
| Species | FTS5 | common_names, scientific_name, family, genus | Full-text search |
| CompanionRelationship | idx_companion_pair | (species_a_id, species_b_id) UNIQUE | Unique pairs |

### 4.5 Table Prefix

**MyLife hub table prefix:** `gd_`

All table names in the SQLite database are prefixed with `gd_` to avoid collisions with other modules in the MyLife hub. Examples: `gd_plants`, `gd_watering_logs`, `gd_care_events`, `gd_harvests`, `gd_zones`, `gd_garden_beds`, `gd_species`, `gd_user_settings`.

### 4.6 Migration Strategy

- Tables are created when the garden module is enabled in MyLife. Schema version is tracked in the module migrations table (`hub_module_migrations`).
- Bundled read-only data (Species, CompanionRelationship, PestDiseaseRef, ZoneLookup) is loaded from a bundled SQLite file on first enable and updated during app updates.
- User data from a standalone MyGarden app can be imported via the data importer (GD-023).
- FTS5 virtual tables are created alongside their source tables and kept in sync via triggers.
- Destructive migrations (column removal, table deletion) are deferred to major versions only.
- Photo files are stored in `<app_data>/garden/photos/` with subdirectories: `journal/`, `harvest/`, `pest/`, `propagation/`, `wishlist/`, `primary/`.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Garden | Leaf icon | Plant List | Main catalog of all plants |
| Care | Calendar icon | Care Calendar | Unified care schedule with watering, fertilizing, pruning, repotting |
| Map | Grid icon | Garden Overview | Garden bed layout and mapping |
| Stats | Chart icon | Garden Stats | Analytics dashboard with aggregated metrics |
| Settings | Gear icon | Settings | Preferences, import/export, about |

### 5.2 Navigation Flow

```
[Tab 1: Garden]
  ├── Plant List (GD-001)
  │     ├── Plant Detail
  │     │     ├── Edit Plant
  │     │     ├── Photo Journal (GD-003)
  │     │     │     └── Add/View Journal Entry
  │     │     ├── Watering History (GD-002)
  │     │     ├── Care History (GD-006)
  │     │     ├── Health Score Detail (GD-014)
  │     │     │     └── Appearance Rating Modal
  │     │     ├── Harvest Log (per-plant) (GD-008)
  │     │     ├── Pest & Disease Log (per-plant) (GD-009)
  │     │     │     ├── Observation Detail
  │     │     │     │     └── Log Treatment Modal
  │     │     │     └── Log Observation Modal
  │     │     ├── Fertilizer History (per-plant) (GD-010)
  │     │     │     └── Log Application Modal
  │     │     └── Propagation History (per-plant) (GD-020)
  │     │           └── Start Propagation Modal
  │     ├── Add Plant Modal (GD-001)
  │     └── Global Search Results (GD-019)
  ├── Zones (GD-016)
  │     ├── Zone Detail (filtered plant list)
  │     └── Add/Edit Zone Modal
  ├── Wish List (GD-015)
  │     ├── Wish List Detail
  │     └── Add/Edit Wish List Modal
  ├── Seed Inventory (GD-011)
  │     ├── Seed Detail
  │     │     └── Log Germination Modal
  │     └── Add/Edit Seed Modal
  └── Plant Care Database (GD-018)
        └── Species Detail
              ├── Add to My Plants
              └── Add to Wish List

[Tab 2: Care]
  ├── Watering Dashboard (GD-002)
  │     ├── Rain Log Modal
  │     └── Watering History (per-plant)
  ├── Care Calendar (GD-006)
  │     ├── Add Custom Task Modal
  │     └── Care History Modal
  ├── Fertilizer Log (GD-010)
  │     ├── Products Tab
  │     │     └── Add/Edit Product Modal
  │     ├── Schedule Tab
  │     └── History Tab
  │           └── Log Application Modal
  └── Companion Planting (GD-007)
        └── Relationship Detail Popover

[Tab 3: Map]
  ├── Garden Overview (GD-004)
  │     ├── Bed Detail
  │     │     ├── Plant Picker Modal
  │     │     └── Edit Bed Modal
  │     └── Add Bed Modal
  ├── Planting Calendar (GD-005)
  │     └── GDD Tracker (optional)
  └── Seasonal Checklist (GD-017)

[Tab 4: Stats]
  ├── Garden Stats (GD-012)
  │     └── Metric Drill-Down Views
  ├── Monthly Summary (GD-021)
  └── Propagation Log (GD-020)
        └── Propagation Detail

[Tab 5: Settings]
  ├── Location Settings (GD-024)
  ├── Units Settings (GD-024)
  ├── Notification Settings (GD-024)
  ├── Display Settings (GD-024)
  ├── Frost Alert Settings (GD-013)
  ├── Data Export (GD-022)
  ├── Data Import (GD-023)
  │     ├── Import Preview (JSON)
  │     └── Column Mapping (CSV)
  ├── Delete All Data (GD-024)
  └── About
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Plant List | `/garden` | Browse all plants | Tab 1 default |
| Plant Detail | `/garden/:id` | View plant info and actions | Tap plant in list |
| Add Plant | `/garden/add` | Create new plant | Plus button, onboarding, species detail |
| Watering Dashboard | `/care/watering` | View and manage watering schedule | Tab 2 default |
| Care Calendar | `/care/calendar` | Weekly/monthly care task view | Tab 2, "Care" sub-nav |
| Garden Overview | `/map` | View all garden beds | Tab 3 default |
| Bed Detail | `/map/:bedId` | View and edit bed grid | Tap bed card |
| Planting Calendar | `/map/calendar` | View planting windows by zone | Tab 3, "Calendar" sub-nav |
| Garden Stats | `/stats` | View analytics dashboard | Tab 4 default |
| Monthly Summary | `/stats/monthly/:yearMonth` | View monthly care summary | Tab 4, "Monthly" sub-nav |
| Settings | `/settings` | Configure preferences | Tab 5 default |
| Onboarding | `/onboarding` | First-run setup | App first launch |
| Search Results | `/search` | Global search results | Global search bar |
| Zones | `/garden/zones` | Browse zones | Tab 1, "Zones" sub-nav |
| Wish List | `/garden/wishlist` | Browse wish list | Tab 1, "Wish List" sub-nav |
| Seed Inventory | `/garden/seeds` | Browse seed inventory | Tab 1, "Seeds" sub-nav |
| Plant Care Database | `/garden/database` | Browse species database | Tab 1, "Database" sub-nav |
| Companion Matrix | `/care/companions` | View companion planting | Tab 2, "Companions" sub-nav |
| Fertilizer Log | `/care/fertilizer` | View fertilizer history | Tab 2, "Fertilizer" sub-nav |
| Pest & Disease Log | `/garden/:id/pests` | Per-plant pest log | Plant detail |
| Propagation Log | `/stats/propagation` | View propagation attempts | Tab 4, "Propagation" sub-nav |
| Export | `/settings/export` | Export data | Settings screen |
| Import | `/settings/import` | Import data | Settings screen |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://garden` | Plant List | None |
| `mylife://garden/:id` | Plant Detail | id: UUID of plant |
| `mylife://garden/add` | Add Plant | None |
| `mylife://garden/watering` | Watering Dashboard | None |
| `mylife://garden/care` | Care Calendar | None |
| `mylife://garden/map` | Garden Overview | None |
| `mylife://garden/map/:bedId` | Bed Detail | bedId: UUID of garden bed |
| `mylife://garden/stats` | Garden Stats | None |
| `mylife://garden/settings` | Settings | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Harvest to Recipes | Garden | Recipes | Garden sends harvest data (plant species, weight, date) | On harvest log |
| Harvest ingredient badge | Garden | Recipes | Garden provides "Available: X lbs fresh from garden" for matching ingredients | Recipe view loads, queries garden harvests |
| Care habits tracking | Garden | Habits | Garden sends daily care completion (watered, fertilized, pruned) as habit events | On care event completion |
| Garden expense tracking | Garden | Budget | Garden sends plant/supply purchases as categorized expenses | Manual user action from budget module |
| Outdoor plant sightings | Garden | Trails | Garden receives wild plant identification data from trail sightings | User saves sighting from trails module |

**Integration Design Principles:**
- All integrations are optional and only active when both modules are enabled
- Data flows through the module registry's event system (publish/subscribe)
- No direct database access between modules; data is shared via typed events
- If the target module is disabled, events are silently dropped
- Cross-module data is never required for core functionality

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Plant catalog and care data | Local SQLite | At rest (OS-level) | No | All user plant records, care events, schedules |
| Plant and harvest photos | Local file system | At rest (OS-level) | No | Never uploaded, no EXIF stripping needed (photos stay local) |
| Species care database | Local SQLite (bundled) | No | No | Read-only reference data shipped with the app |
| User preferences | Local SQLite | No | No | Zone, units, notification settings |
| Companion planting database | Local SQLite (bundled) | No | No | Read-only reference data |
| Pest/disease reference | Local SQLite (bundled) | No | No | Read-only reference data |
| ZIP-to-zone lookup | Local SQLite (bundled) | No | No | Read-only, ~42,000 US ZIP codes |

### 7.2 Network Activity

This module operates entirely offline. No network requests are made under any circumstances. All data, including the species care database, companion planting matrix, pest/disease reference, and ZIP-to-zone lookup table, is bundled with the app and updated only through app updates distributed via the app store.

### 7.3 Data That Never Leaves the Device

- Plant names, photos, and collection details
- Garden layout and bed configurations
- Watering, care, and fertilizer logs
- Harvest records and yield data
- Pest and disease observations with photos
- Seed inventory and germination data
- Propagation attempts and lineage
- Health scores and appearance ratings
- Location data (USDA zone, ZIP code used for lookup)
- Wish list contents
- All user preferences and settings

### 7.4 User Data Ownership

- **Export:** Users can export all data in JSON (full backup with photos), CSV (data only), or HTML report format (GD-022)
- **Delete:** Users can permanently delete all module data via Settings with double confirmation (GD-024). Deletion is irreversible and removes all database records and photo files
- **Portability:** JSON export format is documented, versioned, and human-readable. Users can re-import on any device running MyGarden
- **No vendor lock-in:** All data is stored in standard SQLite format. Users can access the raw database file through device file management if desired

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| No accounts | No account creation, login, or authentication | Privacy by design |
| No tracking | Zero analytics, telemetry, crash reporting, or usage tracking | No SDKs that phone home |
| No cloud | No cloud storage, sync, backup, or server communication | 100% local |
| Photo privacy | Photos stored locally with no EXIF location data extracted or transmitted | Unlike Planta/PictureThis which upload photos with GPS coordinates |
| Data isolation | Module data is isolated within the `gd_` table prefix namespace | No cross-module data leakage |
| Export security | Export files are unencrypted (user's responsibility to secure the file) | Documented in export screen |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Base Interval | The default number of days between waterings for a plant species before any seasonal adjustments are applied |
| Bed Cell | A single grid square within a garden bed layout where one plant can be placed |
| Bed Layer | A snapshot of plant placements in a garden bed; types include "current" (active layout), "plan" (draft for future season), and "archived" (historical) |
| Bundled Database | Read-only reference data (species, companions, pests) shipped with the app and updated only through app store updates |
| Care Event | A single instance of a care activity (watering, fertilizing, pruning, repotting, or custom task) performed on or scheduled for a plant |
| Care Streak | The count of consecutive care tasks completed on time (within 1 day of the scheduled date) |
| Companion Planting | The practice of growing certain plants near each other for mutual benefit (e.g., pest repulsion, pollination) or keeping incompatible plants apart |
| Effective Interval | The base watering interval divided by the seasonal multiplier; represents the actual number of days between waterings after seasonal adjustment |
| FTS5 | SQLite Full-Text Search extension version 5; used for fast text search across plant names, notes, and species data |
| Garden Bed | A user-defined growing area with dimensions, soil type, and sun exposure; contains a grid where plants can be placed |
| GDD (Growing Degree Days) | A measure of accumulated heat units that drive plant growth, calculated as max(0, (T_max + T_min) / 2 - T_base) per day |
| Germination Rate | The percentage of planted seeds that successfully sprout, calculated as (seeds_germinated / seeds_planted) * 100 |
| Grid Resolution | The size of each cell in a garden bed grid; options are 1 foot or 6 inches (feet mode) or 1 meter or 0.25 meters (metric mode) |
| Health Score | A composite 0-100 rating of a plant's overall wellbeing, computed from watering adherence (30%), pest-free status (30%), growth rate (20%), and appearance (20%) |
| NPK Ratio | The three-number ratio (e.g., 10-10-10) on fertilizer labels representing the percentage of Nitrogen, Phosphorus, and Potassium by weight |
| Planting Window | A date range during which a specific planting activity (indoor seed start, transplant, direct sow, harvest) is recommended, relative to frost dates |
| Rain Delay | An automatic extension of a watering due date for outdoor plants when rain is reported; calculated as min(floor(precipitation_mm / 5), 3) days |
| Seasonal Multiplier | A factor applied to care intervals based on the current season: spring = 1.0, summer = 1.5, fall = 0.8, winter = 0.5. Higher values mean shorter intervals (more frequent care) |
| Survival Rate | The percentage of plants (or seedlings) that remain alive, calculated as (alive_plants / total_plants) * 100 |
| USDA Hardiness Zone | A geographic classification system (zones 1-13, subdivided into "a" and "b") based on average annual minimum temperature, used to determine which plants can survive in a given climate. Each zone spans a 10-degree-F range, with "a" and "b" halves spanning 5-degree-F increments |
| Viability Period | The expected number of years a seed packet remains viable (capable of germinating) after purchase, varying by species |
| Yield Per Plant | Total harvest weight divided by the number of plants of that species, used to compare productivity |
| Yield Per Square Foot | Total harvest weight divided by the garden bed area in square feet occupied by the plant, used to evaluate space efficiency |
| Zone | A user-defined location label (e.g., "Living Room", "Back Yard") used to organize plants by physical location |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (spec-mygarden agent) | Initial specification: Sections 1-2, Features GD-001 through GD-003 |
| 1.1 | 2026-03-07 | Claude (Opus 4.6) | Completed all 25 feature specifications (GD-004 through GD-025), added Sections 4-8 |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should MyRecipes garden tracking be absorbed into MyGarden? | MyRecipes already has harvest tracking and garden layout. Merging avoids duplication but adds migration complexity. | Pending | - |
| 2 | Should AI plant identification (camera-based) be included? | Competitors (Planta, PictureThis) offer this, but it requires either cloud APIs (privacy concern) or on-device ML models (large binary size). | Deferred to post-MVP. Investigate Core ML / NNAPI on-device models. | - |
| 3 | Should weather API integration be optional for real-time frost alerts? | Current design uses statistical frost dates. Real-time weather would improve accuracy but requires network access. | Deferred. Current offline-first approach is sufficient for MVP. | - |
| 4 | What is the target number of species in the initial bundled database? | Design doc says ~300. Need to verify this is achievable for v1.0 launch. | Target 300 species confirmed. | 2026-03-07 |
| 5 | Should the companion planting database support user additions? | Current design is read-only. Power users may want to add custom relationships. | Deferred to v2.0. Users can add notes to existing relationships. | 2026-03-07 |
