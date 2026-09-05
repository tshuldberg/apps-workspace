# MyPets - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyPets
- **Tagline:** "All your pet care in one place"
- **Module ID:** `pets`
- **Feature ID Prefix:** `PT`
- **Table Prefix:** `pt_`
- **Accent Color:** #F59E0B (amber)

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| First-Time Pet Owner (Emma) | Ages 20-35, just adopted a puppy or kitten, overwhelmed by vaccination schedules and vet visits, moderate tech comfort | Keep track of vaccination deadlines, know when vet visits are due, log medications correctly, understand breed-specific health risks |
| Multi-Pet Household Manager (Carlos) | Ages 30-50, has 2-5 pets (mix of dogs and cats), juggles different feeding schedules and medication regimens | View all pets at a glance, manage distinct schedules per pet, track total pet ownership costs, share care instructions with pet sitters |
| Senior Pet Caregiver (Linda) | Ages 45-70, manages an aging pet with chronic conditions (arthritis, diabetes, kidney disease), frequent vet visits | Track multiple medications with reminders, log weight changes for vet review, maintain a complete medical history, monitor treatment costs |
| Dog Training Enthusiast (Jake) | Ages 22-40, actively training a dog (obedience, agility, or behavioral), tracks exercise and walks regularly | Log training sessions with command progress, record walk durations and distances, track exercise patterns, celebrate mastery milestones |
| Breeder or Foster Parent (Maria) | Ages 25-55, fosters rescue animals or breeds responsibly, manages temporary pets with full medical handoff needs | Generate complete pet records for adoption handoffs, track multiple animals through their stay, export vaccination and medical history for new owners |

### 1.3 Core Value Proposition

MyPets is a comprehensive, privacy-first pet care management app that replaces scattered spreadsheets, paper vet records, and 3-4 niche pet apps with a single unified module. It tracks pet profiles, vaccination schedules, vet visits, medications, feeding routines, weight trends, exercise logs, grooming schedules, training progress, and the full cost of pet ownership. Unlike Dogo ($200+/yr) and other pet apps that harvest location data during walks and require cloud accounts, MyPets stores everything locally on-device. No pet data, vet records, or daily routines are ever transmitted to a third party.

The pet management app space is remarkably underserved. Most apps focus narrowly on dog training (Dogo) or basic vet record storage, and none offer a comprehensive pet care hub. MyPets fills this greenfield opportunity with a complete solution covering health records, daily care, activity tracking, training, finances, and emergency preparedness.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Dogo ($200+/yr) | Polished dog training content, exercise tracking, step-by-step lessons | Dog-only (no cats or other pets), extremely expensive, collects location data during walks, no vet records or medication tracking | All species support, full health record management, privacy-first with no location harvesting, included in MyLife Pro |
| Pet First Aid (Red Cross, $4) | Trusted medical source, emergency procedures | First aid only, no ongoing health tracking, no medication reminders, no training features | Full lifecycle pet management beyond emergency reference |
| 11Pets ($20/yr) | Health records, vaccination tracking, multi-pet support | Cloud-required account, limited offline support, dated interface, no training or exercise tracking | Fully offline, modern interface, comprehensive feature set including training, exercise, and expense tracking |
| Pet Desk (Free) | Vet appointment booking, reminders | Vet clinic partnership model (vet must use PetDesk), limited to appointment management, ad-supported | Independent of vet software, full pet lifecycle management, zero ads |
| Google Sheets / Notes App | Free, flexible, always available | No structure, no reminders, no charts, no breed intelligence, easy to lose data | Purpose-built with reminders, weight charts, breed health alerts, and structured data export |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export

**MyPets-specific privacy notes:**

- **Vet records** contain home addresses, phone numbers, and financial information. MyPets keeps all vet visit data on-device where no data broker can access it.
- **Medication schedules** reveal when owners are home and their daily routines. This data never leaves the device.
- **Microchip IDs** are sensitive identification data. They are stored locally and never transmitted to any server.
- **Walk and exercise logs** are never used for location tracking or pattern analysis by third parties. Dogo and similar apps harvest GPS data during walks; MyPets does not.
- **Pet sitter info cards** are generated locally and shared selectively by the user via their own sharing mechanism (text, email, print). No card data is uploaded to any server.
- **Expense data** reveals spending habits and financial information. It remains on-device and is never monetized.
- **Photo gallery** images are stored in the app's local storage. No photos are uploaded to any cloud service or used for any purpose beyond the user's own viewing.

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| PT-001 | Pet Profile Management | P0 | Core | None | Not Started |
| PT-002 | Vaccination Records | P0 | Core | PT-001 | Not Started |
| PT-003 | Vet Visit Log | P0 | Core | PT-001 | Not Started |
| PT-004 | Medication Tracking & Reminders | P0 | Core | PT-001 | Not Started |
| PT-005 | Weight Tracking & Growth Charts | P0 | Core | PT-001 | Not Started |
| PT-006 | Feeding Schedule & Reminders | P1 | Core | PT-001 | Not Started |
| PT-007 | Exercise & Walk Logging | P1 | Core | PT-001 | Not Started |
| PT-008 | Grooming Schedule | P1 | Core | PT-001 | Not Started |
| PT-009 | Training Log | P1 | Core | PT-001 | Not Started |
| PT-010 | Expense Tracking | P1 | Analytics | PT-001, PT-003, PT-004 | Not Started |
| PT-011 | Emergency Vet Contacts | P1 | Core | None | Not Started |
| PT-012 | Multi-Pet Dashboard | P1 | Core | PT-001 | Not Started |
| PT-013 | Pet Health Timeline | P1 | Data Management | PT-001, PT-002, PT-003, PT-004 | Not Started |
| PT-014 | Breed-Specific Health Alerts | P2 | Analytics | PT-001 | Not Started |
| PT-015 | Photo Gallery | P2 | Data Management | PT-001 | Not Started |
| PT-016 | Pet Sitter Info Export | P2 | Import/Export | PT-001, PT-004, PT-006, PT-011 | Not Started |
| PT-017 | Data Export | P1 | Import/Export | PT-001 | Not Started |
| PT-018 | Settings & Preferences | P0 | Settings | None | Not Started |

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
- **Social** - Sharing, community, collaborative features
- **Settings** - User preferences, configuration, customization

---

## 3. Feature Specifications

### PT-001: Pet Profile Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-001 |
| **Feature Name** | Pet Profile Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to create a detailed profile for each of my pets with their name, species, breed, birthday, weight, and photo, so that I have a central record of all their essential information.

**Secondary:**
> As a multi-pet household manager, I want to manage profiles for all my pets independently, so that each pet's records, schedules, and health data are kept separate and organized.

**Tertiary:**
> As a foster parent, I want to archive pet profiles when an animal is adopted out without deleting their records, so that I can reference historical data if needed.

#### 3.3 Detailed Description

Pet Profile Management is the foundational feature of MyPets. Every other feature in the module depends on at least one pet profile existing. Users create a profile by entering the pet's name, selecting a species (dog, cat, bird, fish, reptile, rabbit, hamster, guinea pig, ferret, horse, or custom), specifying a breed (with a searchable list of common breeds per species or free-text entry), and optionally adding a date of birth or estimated age, current weight, a profile photo, microchip ID, and spay/neuter status.

Each profile serves as the anchor for all pet-specific data: vaccinations, vet visits, medications, weight history, feeding schedules, exercise logs, grooming records, training progress, expenses, and photos. The profile screen displays a summary card with the pet's photo, name, age, breed, and weight, along with quick-access links to upcoming appointments, due vaccinations, and active medications.

Users can edit any profile field at any time. Profiles can be archived to remove them from the active pet list (for rehomed, fostered-out, or deceased pets) without deleting associated records. Archived profiles can be unarchived. Profiles can be permanently deleted with a confirmation dialog, which removes the profile and all associated data across every feature.

The pet list screen shows all active pets as cards with their photo, name, species badge, and age. The list supports reordering via drag-and-drop to let users arrange pets in their preferred order.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the root feature)

**External Dependencies:**
- Camera or photo library access for profile photos
- Local storage for persistent data

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable
- UUID generation is available for record IDs
- Image picker is available for photo selection

#### 3.5 User Interface Requirements

##### Screen: Pet List

**Layout:**
- Top navigation bar showing "My Pets" title and a "+" add button on the right
- Below the navigation bar is an optional segmented control: "Active" | "All" (visible only when archived pets exist, defaults to "Active")
- The main content area is a scrollable vertical grid (2 columns) of pet cards
- Each card displays: pet photo (circular, 80px diameter), pet name (bold), species icon, breed (subtitle), age (computed from DOB or "Age unknown"), and weight badge
- Tapping a card navigates to the Pet Profile Detail screen
- Long-pressing a card reveals a context menu: Edit, Archive/Unarchive, Delete
- Cards are ordered by user-defined sort_order (drag handles visible in edit mode)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No pets exist | Illustration of a paw print, message "No pets added yet", button "Add Your First Pet" |
| Populated | Active pets exist | 2-column grid of pet cards |
| All View | User toggled to "All" | Shows both active and archived pets; archived cards have reduced opacity and an "Archived" badge |
| Error | Database read fails | Toast notification: "Could not load your pets. Please restart the app." |

**Interactions:**
- Tap card: Navigate to Pet Profile Detail screen
- Tap "+": Open Add Pet flow
- Long press card: Context menu (Edit, Archive, Delete)
- Swipe left on card: Reveal "Archive" action
- Drag handle (edit mode): Reorder pets

**Transitions/Animations:**
- New pet card animates in with scale-up + fade-in (200ms)
- Archived/deleted pet card fades out + slides down (200ms)
- Active/All toggle cross-fades the grid (150ms)

##### Screen: Pet Profile Detail

**Layout:**
- Scrollable screen with the pet's photo displayed prominently at the top (full-width, 200px height, rounded corners)
- Below the photo: pet name (large, bold), breed and species subtitle, age (computed from DOB)
- An "Edit" button in the top-right navigation bar
- Info section with labeled rows: Date of Birth, Weight, Microchip ID, Spay/Neuter Status, Adoption Date (if set)
- Quick Stats section: cards showing "Next Vet Visit", "Vaccinations Due", "Active Medications", "Days Since Last Walk"
- Navigation section: tappable rows linking to Vaccinations, Vet Visits, Medications, Weight History, Feeding, Exercise, Grooming, Training, Expenses, Photos (each with a count badge)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Complete | All optional fields filled | Full profile with all sections visible |
| Minimal | Only required fields (name, species) filled | Profile with placeholder text for optional fields and prompts to "Add" missing info |
| Archived | Pet is archived | Banner at top: "This pet is archived" with "Unarchive" button |

**Interactions:**
- Tap "Edit": Navigate to Edit Pet screen
- Tap any navigation row: Navigate to the corresponding feature screen filtered for this pet
- Tap photo: View full-size photo
- Tap Quick Stats card: Navigate to the relevant screen (e.g., "Next Vet Visit" goes to Vet Visit Log)

##### Modal: Add/Edit Pet

**Layout:**
- Full-screen modal with "Cancel" (left) and "Save" (right) in the header
- Header title: "Add Pet" (new) or "Edit Pet" (existing)
- Photo picker at the top: circular placeholder with camera icon, tappable to select photo from camera or photo library
- Form fields in order:
  1. Name (text input, required, max 100 characters)
  2. Species (picker: dog, cat, bird, fish, reptile, rabbit, hamster, guinea pig, ferret, horse, custom)
  3. Breed (searchable text input with autocomplete suggestions based on species, max 100 characters)
  4. Date of Birth (date picker, optional, must be in the past)
  5. Gender (picker: male, female, unknown)
  6. Weight (numeric input with unit toggle: lbs/kg, optional, min: 0.01, max: 9999)
  7. Microchip ID (text input, optional, max 50 characters)
  8. Spay/Neuter Status (picker: spayed, neutered, intact, unknown)
  9. Adoption Date (date picker, optional, must be in the past)
  10. Color/Markings (text input, optional, max 200 characters)
  11. Notes (multiline text, optional, max 2000 characters)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New | Creating a new pet | All fields empty, "Save" disabled until Name and Species are filled |
| Edit | Editing existing pet | Fields pre-populated, "Save" enabled, "Delete Pet" button at bottom |
| Validation Error | Required field missing or invalid | Inline error message below the offending field |

**Interactions:**
- Tap "Cancel": Dismiss modal with confirmation if changes were made ("Discard changes?")
- Tap "Save": Validate fields, save to database, dismiss modal, navigate to Pet Profile Detail
- Tap photo placeholder: Present action sheet: "Take Photo" or "Choose from Library"
- Tap "Delete Pet" (edit mode only): Confirmation dialog: "Delete [Pet Name]? This will permanently remove all records for this pet. This action cannot be undone." with "Cancel" and "Delete" buttons

#### 3.6 Data Requirements

##### Entity: Pet

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier for the pet |
| name | string | Required, max 100 chars, trimmed | None | Pet's name |
| species | enum | Required. One of: dog, cat, bird, fish, reptile, rabbit, hamster, guinea_pig, ferret, horse, custom | None | Type of animal |
| species_custom | string | Max 50 chars. Required if species = custom | null | Custom species name when "custom" is selected |
| breed | string | Max 100 chars | null | Breed name (free text or selected from breed list) |
| date_of_birth | date | Must be in the past or today | null | Pet's date of birth |
| gender | enum | One of: male, female, unknown | unknown | Pet's biological sex |
| weight | float | Min: 0.01, Max: 9999.99 | null | Current weight (updated manually or via weight tracking) |
| weight_unit | enum | One of: lbs, kg | lbs | Unit for weight display |
| photo_uri | string | Max 500 chars, valid file path | null | Local file path to pet's profile photo |
| microchip_id | string | Max 50 chars | null | Microchip identification number |
| spay_neuter_status | enum | One of: spayed, neutered, intact, unknown | unknown | Reproductive status |
| adoption_date | date | Must be in the past or today | null | Date the pet was adopted or acquired |
| color_markings | string | Max 200 chars | null | Physical description (color, markings, distinguishing features) |
| notes | string | Max 2000 chars | null | Free-text notes about the pet |
| sort_order | integer | Min: 0 | 0 | User-defined ordering position in pet list |
| is_archived | boolean | - | false | Whether the pet is archived (hidden from active list) |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- Pet has many VaccinationRecords (one-to-many via pet_id)
- Pet has many VetVisits (one-to-many via pet_id)
- Pet has many Medications (one-to-many via pet_id)
- Pet has many WeightEntries (one-to-many via pet_id)
- Pet has many FeedingSchedules (one-to-many via pet_id)
- Pet has many ExerciseLogs (one-to-many via pet_id)
- Pet has many GroomingRecords (one-to-many via pet_id)
- Pet has many TrainingEntries (one-to-many via pet_id)
- Pet has many Expenses (one-to-many via pet_id)
- Pet has many Photos (one-to-many via pet_id)

**Indexes:**
- is_archived - frequently filtered to show active pets
- species - used for breed-specific filtering
- sort_order - used for ordered display
- name - searchable field

**Validation Rules:**
- name: Must not be empty string after trimming whitespace
- species: Must be a valid enum value
- species_custom: Required and must not be empty if species = custom
- date_of_birth: If provided, must be on or before today
- adoption_date: If provided, must be on or before today
- weight: If provided, must be > 0
- photo_uri: If provided, referenced file must exist

**Example Data:**

```
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Luna",
  "species": "dog",
  "species_custom": null,
  "breed": "Golden Retriever",
  "date_of_birth": "2023-04-15",
  "gender": "female",
  "weight": 62.5,
  "weight_unit": "lbs",
  "photo_uri": "/data/pets/photos/luna_profile.jpg",
  "microchip_id": "985112345678901",
  "spay_neuter_status": "spayed",
  "adoption_date": "2023-06-20",
  "color_markings": "Golden coat, white chest patch",
  "notes": "Allergic to chicken. Loves swimming.",
  "sort_order": 0,
  "is_archived": false,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-03-01T14:22:00Z"
}
```

#### 3.7 Business Logic Rules

##### Age Calculation

**Purpose:** Compute a human-readable age string from the pet's date of birth.

**Inputs:**
- date_of_birth: date (nullable)
- current_date: date

**Logic:**

```
1. IF date_of_birth IS null THEN RETURN "Age unknown"
2. COMPUTE total_months = difference in months between date_of_birth and current_date
3. IF total_months < 1 THEN
     COMPUTE days = difference in days
     RETURN "{days} day(s) old"
4. IF total_months < 12 THEN
     RETURN "{total_months} month(s) old"
5. COMPUTE years = floor(total_months / 12)
6. COMPUTE remaining_months = total_months mod 12
7. IF remaining_months = 0 THEN
     RETURN "{years} year(s) old"
8. RETURN "{years} yr {remaining_months} mo"
```

**Edge Cases:**
- date_of_birth is null: Return "Age unknown"
- date_of_birth is today: Return "0 days old"
- date_of_birth is in the future (should be prevented by validation): Treat as invalid, return "Age unknown"

##### Profile Completeness Score

**Purpose:** Show users how complete their pet's profile is to encourage filling in optional fields.

**Inputs:**
- pet: Pet entity

**Logic:**

```
1. Define scored fields with weights:
   - name (required, always present): 0 points (baseline)
   - species (required, always present): 0 points
   - breed: 10 points
   - date_of_birth: 15 points
   - weight: 15 points
   - photo_uri: 20 points
   - microchip_id: 15 points
   - spay_neuter_status (not "unknown"): 10 points
   - adoption_date: 5 points
   - color_markings: 5 points
   - notes: 5 points
2. Total possible: 100 points
3. SUM points for all non-null/non-default fields
4. RETURN percentage (0-100)
```

**Edge Cases:**
- All optional fields null: Return 0%
- All fields filled: Return 100%

##### Pet Deletion Cascade

**Purpose:** When a pet is permanently deleted, remove all associated records.

**Logic:**

```
1. BEGIN transaction
2. DELETE all VaccinationRecords WHERE pet_id = pet.id
3. DELETE all VetVisits WHERE pet_id = pet.id
4. DELETE all Medications WHERE pet_id = pet.id
5. DELETE all WeightEntries WHERE pet_id = pet.id
6. DELETE all FeedingSchedules WHERE pet_id = pet.id
7. DELETE all ExerciseLogs WHERE pet_id = pet.id
8. DELETE all GroomingRecords WHERE pet_id = pet.id
9. DELETE all TrainingEntries WHERE pet_id = pet.id
10. DELETE all Expenses WHERE pet_id = pet.id
11. DELETE all Photos WHERE pet_id = pet.id
12. DELETE photo file at pet.photo_uri if it exists
13. DELETE Pet WHERE id = pet.id
14. COMMIT transaction
```

**Edge Cases:**
- Pet has no associated records in some tables: Deletion proceeds without error (DELETE WHERE returns 0 rows)
- Photo file is missing: Log warning, continue deletion
- Transaction fails mid-way: Roll back all changes, show error to user

**Sort/Filter/Ranking Logic:**
- **Default sort:** User-defined sort_order (ascending)
- **Available sort options:** Sort order (custom), Name (A-Z), Name (Z-A), Age (youngest first), Age (oldest first), Species
- **Filter options:** Active only (default), All (active + archived), By species
- **Search:** Name field, substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast notification: "Could not save pet profile. Please try again." | User taps retry; data remains in form fields |
| Required field left blank | Inline validation message below the field: "Name is required" or "Species is required" | User fills in the field, error clears on input |
| Photo file cannot be read | Profile displays a default paw-print placeholder | User can re-select a photo via Edit |
| Duplicate pet name | Warning (non-blocking): "You already have a pet named [name]. Save anyway?" | User confirms or changes the name |
| Delete fails mid-transaction | Toast: "Could not delete pet. Please try again." All data is preserved (transaction rolled back). | User retries deletion |

**Validation Timing:**
- Field-level validation runs on blur (when the user leaves the field)
- Form-level validation runs on save
- Name uniqueness warning runs on save (non-blocking)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has no pets,
   **When** the user taps "Add Your First Pet" and fills in name "Luna" and species "Dog" and taps Save,
   **Then** a pet profile is created, the empty state disappears, and Luna's card appears in the pet list.

2. **Given** a pet profile for "Luna" exists,
   **When** the user taps Luna's card,
   **Then** the Pet Profile Detail screen displays Luna's name, breed, age, weight, and all quick stats.

3. **Given** a pet profile for "Luna" exists,
   **When** the user taps Edit, changes the breed to "Labrador Retriever", and taps Save,
   **Then** the profile detail screen updates to show "Labrador Retriever" and the updated_at timestamp is refreshed.

4. **Given** two pets exist (Luna and Max),
   **When** the user reorders them by dragging Max above Luna,
   **Then** Max appears first in the pet list, and the sort_order values are updated accordingly.

**Edge Cases:**

5. **Given** a pet with date_of_birth set to today,
   **When** the user views the profile,
   **Then** the age displays "0 days old".

6. **Given** a pet's profile photo file has been externally deleted,
   **When** the user views the pet list or profile detail,
   **Then** a default paw-print placeholder is shown instead of a broken image.

**Negative Tests:**

7. **Given** the add pet form is open,
   **When** the user leaves the Name field empty and taps Save,
   **Then** the system shows inline validation "Name is required"
   **And** no pet record is created.

8. **Given** the add pet form is open,
   **When** the user enters a date_of_birth in the future,
   **Then** the system shows inline validation "Date of birth must be in the past"
   **And** no pet record is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates age for 2-year-old pet | DOB: 2024-03-06, today: 2026-03-06 | "2 years old" |
| calculates age in months for puppy | DOB: 2026-01-06, today: 2026-03-06 | "2 months old" |
| calculates age in days for newborn | DOB: 2026-03-01, today: 2026-03-06 | "5 days old" |
| returns "Age unknown" for null DOB | DOB: null | "Age unknown" |
| calculates profile completeness 0% | All optional fields null | 0 |
| calculates profile completeness 100% | All fields filled, spay_neuter != unknown | 100 |
| validates name is not empty | name: "   " (whitespace) | validation error: "Name is required" |
| validates DOB is not in future | DOB: 2027-01-01, today: 2026-03-06 | validation error |
| validates weight is positive | weight: -5 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add pet and verify it appears in list | 1. Open add form, 2. Enter name + species, 3. Save, 4. Return to list | New pet card appears in the list with correct name and species icon |
| Delete pet and verify cascade | 1. Add pet with vaccination and vet visit records, 2. Delete the pet, 3. Query all related tables | Pet and all associated records are removed from the database |
| Archive and unarchive pet | 1. Archive a pet, 2. Verify it disappears from active list, 3. Toggle to "All" view, 4. Unarchive | Pet reappears in the active list |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user creates their first pet | 1. Open app (empty state), 2. Tap "Add Your First Pet", 3. Enter name "Luna", species "Dog", breed "Golden Retriever", 4. Take photo, 5. Save | Pet list shows Luna's card with photo, breed subtitle, and species icon. Profile detail shows all entered fields. |
| User manages 3 pets | 1. Add pet "Luna" (dog), 2. Add pet "Milo" (cat), 3. Add pet "Tweety" (bird), 4. Reorder | Pet list shows all 3 pets in user-defined order with correct species icons and photos |

---

### PT-002: Vaccination Records

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-002 |
| **Feature Name** | Vaccination Records |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to record each vaccination my pet receives with the vaccine name, date given, next due date, and vet name, so that I never miss a booster and can prove vaccination status when needed.

**Secondary:**
> As a multi-pet household manager, I want to see which of my pets have overdue vaccinations at a glance, so that I can schedule vet appointments proactively.

#### 3.3 Detailed Description

Vaccination Records allows users to maintain a complete vaccination history for each pet. When a pet receives a vaccine, the user logs the vaccine name (selected from a species-appropriate list of common vaccines or entered manually), the date the vaccine was administered, the date the next dose is due, the veterinarian or clinic name, the lot number (optional), and any notes (e.g., reactions observed).

The vaccination list for each pet shows all recorded vaccinations sorted by next due date, with color-coded status badges: green for "Up to Date" (next due date is in the future), yellow for "Due Soon" (within 30 days), red for "Overdue" (past the due date), and gray for "No Reminder" (no next due date set). Users can tap a vaccination to view details, edit it, or delete it.

The system provides species-specific vaccine suggestions. For dogs: Rabies, DHPP (Distemper, Hepatitis, Parainfluenza, Parvovirus), Bordetella, Canine Influenza, Leptospirosis, Lyme Disease. For cats: Rabies, FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia), FeLV (Feline Leukemia). Other species have a generic free-text entry. These suggestions are convenience features; users can always enter custom vaccine names.

A consolidated "Vaccinations Due" view across all pets is available from the Multi-Pet Dashboard (PT-012), showing all upcoming and overdue vaccinations in a single list.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist before vaccinations can be recorded

**External Dependencies:**
- Local notification system for due-date reminders
- Local storage for persistent data

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Local database is initialized and writable
- Local notification scheduling is available

#### 3.5 User Interface Requirements

##### Screen: Vaccination List (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Vaccinations" and a "+" add button on the right
- Summary bar below navigation: "[X] up to date, [Y] due soon, [Z] overdue"
- Filter chips: "All" | "Due Soon" | "Overdue" | "Up to Date"
- Scrollable vertical list of vaccination cards
- Each card displays: vaccine name (bold), date given, next due date (with color-coded status badge), vet name
- Cards sorted by: overdue first, then due soon, then up to date, then no reminder (within each group, sorted by next due date ascending)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No vaccinations recorded | Illustration of a syringe, message "No vaccinations recorded yet", button "Add Vaccination" |
| Populated | Vaccinations exist | Scrollable list with status badges |
| Filtered | User selected a filter chip | Filtered list; if no results: "No [status] vaccinations" |
| Error | Database read fails | Toast notification: "Could not load vaccinations." |

**Interactions:**
- Tap card: Navigate to Vaccination Detail screen
- Tap "+": Open Add Vaccination modal
- Swipe left on card: Reveal "Delete" action (with confirmation)
- Tap filter chip: Filter the list by status

**Transitions/Animations:**
- New vaccination card animates in from the top with slide-down + fade-in (200ms)
- Deleted vaccination fades out + slides left (200ms)

##### Modal: Add/Edit Vaccination

**Layout:**
- Full-screen modal with "Cancel" (left) and "Save" (right) in the header
- Form fields in order:
  1. Vaccine Name (searchable picker with species-specific suggestions + free text, required, max 100 chars)
  2. Date Given (date picker, required, defaults to today, must be on or before today)
  3. Next Due Date (date picker, optional, must be after date_given)
  4. Vet/Clinic Name (text input, optional, max 200 chars, autocomplete from previous vet entries)
  5. Lot Number (text input, optional, max 50 chars)
  6. Reminder (toggle, default on if next_due_date is set; sets a local notification)
  7. Reminder Lead Time (picker: 1 day, 3 days, 1 week, 2 weeks; default 1 week; visible only if Reminder is on)
  8. Notes (multiline text, optional, max 1000 chars)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New | Adding a new vaccination | Fields empty except Date Given (today), vaccine name suggestions shown |
| Edit | Editing existing vaccination | Fields pre-populated |
| Validation Error | Required field missing | Inline error below offending field |

#### 3.6 Data Requirements

##### Entity: VaccinationRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this vaccination belongs to |
| vaccine_name | string | Required, max 100 chars, trimmed | None | Name of the vaccine administered |
| date_given | date | Required, must be on or before today | Today | Date the vaccine was administered |
| next_due_date | date | Must be after date_given | null | Date the next booster or dose is due |
| vet_name | string | Max 200 chars | null | Veterinarian or clinic that administered the vaccine |
| lot_number | string | Max 50 chars | null | Vaccine lot/batch number |
| reminder_enabled | boolean | - | true if next_due_date is set | Whether a local notification reminder is set |
| reminder_lead_days | integer | One of: 1, 3, 7, 14 | 7 | Days before next_due_date to fire the reminder |
| notes | string | Max 1000 chars | null | Additional notes (e.g., reactions, administration site) |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- VaccinationRecord belongs to Pet (many-to-one via pet_id)

**Indexes:**
- pet_id - frequently queried to list vaccinations for a specific pet
- next_due_date - used for "due soon" and "overdue" queries
- (pet_id, next_due_date) - composite index for sorted per-pet listing

**Validation Rules:**
- vaccine_name: Must not be empty after trimming
- date_given: Required, must be on or before today
- next_due_date: If provided, must be strictly after date_given
- reminder_lead_days: Must be one of [1, 3, 7, 14]

**Example Data:**

```
{
  "id": "v1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "vaccine_name": "Rabies",
  "date_given": "2026-01-15",
  "next_due_date": "2027-01-15",
  "vet_name": "Dr. Sarah Chen, Happy Paws Vet Clinic",
  "lot_number": "RAB-2026-0452",
  "reminder_enabled": true,
  "reminder_lead_days": 14,
  "notes": "3-year rabies vaccine. No adverse reactions.",
  "created_at": "2026-01-15T16:30:00Z",
  "updated_at": "2026-01-15T16:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Vaccination Status Calculation

**Purpose:** Determine the visual status badge for each vaccination record.

**Inputs:**
- next_due_date: date (nullable)
- current_date: date

**Logic:**

```
1. IF next_due_date IS null THEN RETURN status = "no_reminder" (gray badge)
2. COMPUTE days_until_due = next_due_date - current_date (in days)
3. IF days_until_due < 0 THEN RETURN status = "overdue" (red badge)
4. IF days_until_due <= 30 THEN RETURN status = "due_soon" (yellow badge)
5. RETURN status = "up_to_date" (green badge)
```

**Edge Cases:**
- next_due_date is null: Display "No Reminder" badge, no notification scheduled
- next_due_date is today: Treated as "due_soon" (days_until_due = 0, which is <= 30)
- Vaccination has no next_due_date but user later adds one: Reminder is scheduled upon save

##### Vaccine Name Suggestions

**Purpose:** Provide species-appropriate vaccine suggestions to reduce typing.

**Inputs:**
- species: enum (from Pet.species)

**Logic:**

```
1. IF species = "dog" THEN RETURN [
     "Rabies",
     "DHPP (Distemper/Hepatitis/Parainfluenza/Parvovirus)",
     "Bordetella",
     "Canine Influenza (H3N2/H3N8)",
     "Leptospirosis",
     "Lyme Disease"
   ]
2. IF species = "cat" THEN RETURN [
     "Rabies",
     "FVRCP (Rhinotracheitis/Calicivirus/Panleukopenia)",
     "FeLV (Feline Leukemia)"
   ]
3. IF species = "rabbit" THEN RETURN [
     "RHDV2 (Rabbit Hemorrhagic Disease)",
     "Myxomatosis"
   ]
4. IF species = "ferret" THEN RETURN [
     "Rabies",
     "Canine Distemper"
   ]
5. IF species = "horse" THEN RETURN [
     "Rabies",
     "Eastern/Western Encephalomyelitis",
     "West Nile Virus",
     "Tetanus",
     "Influenza",
     "Rhinopneumonitis"
   ]
6. ELSE RETURN [] (empty list, free text only)
```

**Edge Cases:**
- Custom species: No suggestions provided; user enters vaccine name manually
- User ignores suggestions: Free text is always accepted regardless of species

##### Reminder Scheduling

**Purpose:** Schedule and manage local notifications for upcoming vaccinations.

**Inputs:**
- vaccination: VaccinationRecord

**Logic:**

```
1. IF vaccination.reminder_enabled = false THEN
     CANCEL any existing notification for this vaccination.id
     RETURN
2. IF vaccination.next_due_date IS null THEN RETURN (no date to schedule against)
3. COMPUTE fire_date = vaccination.next_due_date - vaccination.reminder_lead_days
4. IF fire_date <= current_date THEN
     fire immediately (the reminder window has already passed)
5. SCHEDULE local notification:
     - Title: "[Pet Name] - Vaccination Due"
     - Body: "[Vaccine Name] is due on [next_due_date formatted]"
     - Fire date: fire_date at 9:00 AM local time
     - ID: vaccination.id (to allow cancellation on edit/delete)
```

**Edge Cases:**
- Vaccination deleted: Cancel the associated notification
- Vaccination edited (date changed): Cancel old notification, schedule new one
- Fire date is in the past: Fire notification immediately upon save
- Device notifications disabled: Vaccination record is saved without a reminder; user is not warned (notification permission is a system-level concern)

**Sort/Filter/Ranking Logic:**
- **Default sort:** Status priority (overdue first, due soon second, up to date third, no reminder last), then by next_due_date ascending within each group
- **Available sort options:** Status priority (default), Date given (newest first), Date given (oldest first), Vaccine name (A-Z)
- **Filter options:** All, Overdue, Due Soon, Up to Date
- **Search:** vaccine_name, vet_name - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save vaccination. Please try again." | User taps retry; form data preserved |
| Vaccine name left blank | Inline validation: "Vaccine name is required" | User fills in the field |
| Next due date before date given | Inline validation: "Next due date must be after the date given" | User corrects the date |
| Notification scheduling fails | Vaccination is saved without reminder; toast: "Vaccination saved, but reminder could not be set." | User can edit and re-enable reminder |
| Pet deleted while viewing vaccinations | Navigate back to pet list; toast: "This pet has been deleted." | User is returned to the pet list |

**Validation Timing:**
- Field-level validation runs on blur
- Form-level validation (cross-field date comparison) runs on save
- Vaccine name suggestions appear on focus (immediate)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists,
   **When** the user navigates to Luna's vaccinations and taps "+", enters "Rabies", date given "2026-01-15", next due "2027-01-15", vet "Dr. Chen", and taps Save,
   **Then** the vaccination appears in the list with a green "Up to Date" badge and a reminder is scheduled for 2027-01-08.

2. **Given** a vaccination record with next_due_date = today,
   **When** the user views the vaccination list,
   **Then** the vaccination displays a yellow "Due Soon" badge.

3. **Given** a vaccination record with next_due_date = yesterday,
   **When** the user views the vaccination list,
   **Then** the vaccination displays a red "Overdue" badge.

**Edge Cases:**

4. **Given** a vaccination with no next_due_date set,
   **When** the user views the vaccination list,
   **Then** the vaccination displays a gray "No Reminder" badge and no notification is scheduled.

5. **Given** the user enters a custom vaccine name not in the suggestion list,
   **When** the user taps Save,
   **Then** the custom vaccine name is accepted and saved without error.

**Negative Tests:**

6. **Given** the add vaccination form is open,
   **When** the user sets next_due_date to a date before date_given and taps Save,
   **Then** the system shows inline validation "Next due date must be after the date given"
   **And** no record is created.

7. **Given** the add vaccination form is open,
   **When** the user leaves the vaccine name blank and taps Save,
   **Then** the system shows inline validation "Vaccine name is required"
   **And** no record is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| returns "overdue" for past due date | next_due: 2026-03-01, today: 2026-03-06 | status: "overdue" |
| returns "due_soon" for date within 30 days | next_due: 2026-03-20, today: 2026-03-06 | status: "due_soon" |
| returns "up_to_date" for date > 30 days out | next_due: 2027-01-15, today: 2026-03-06 | status: "up_to_date" |
| returns "no_reminder" for null due date | next_due: null | status: "no_reminder" |
| returns dog vaccine suggestions for species "dog" | species: "dog" | list containing "Rabies", "DHPP", "Bordetella" |
| returns cat vaccine suggestions for species "cat" | species: "cat" | list containing "Rabies", "FVRCP", "FeLV" |
| returns empty list for species "fish" | species: "fish" | empty list |
| validates next_due after date_given | date_given: 2026-03-06, next_due: 2026-03-01 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add vaccination and verify list display | 1. Open add form for Luna, 2. Enter Rabies vaccine details, 3. Save, 4. View list | Vaccination appears with correct status badge and sort position |
| Delete vaccination and verify removal | 1. Swipe left on a vaccination, 2. Confirm delete | Vaccination is removed, notification is cancelled |
| Edit vaccination due date and verify badge update | 1. Edit a vaccination, 2. Change next_due_date to yesterday, 3. Save | Badge changes from green/yellow to red |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user records all vaccinations | 1. Add pet Luna, 2. Add Rabies (due 2027), 3. Add DHPP (due 2026-06), 4. Add Bordetella (no due date) | Vaccination list shows 3 records: DHPP with yellow "Due Soon", Rabies with green "Up to Date", Bordetella with gray "No Reminder" |
| User receives overdue notification | 1. Add vaccination with next_due in the past, 2. System triggers notification | User sees "Luna - Vaccination Due: Rabies is due on [date]" notification |

---

### PT-003: Vet Visit Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-003 |
| **Feature Name** | Vet Visit Log |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to log every vet visit with the date, reason, diagnosis, treatment, and cost, so that I have a complete medical history I can reference and share with veterinarians.

**Secondary:**
> As a senior pet caregiver, I want to track the total cost of vet visits over time, so that I can budget for ongoing care and make informed decisions about pet insurance.

#### 3.3 Detailed Description

The Vet Visit Log provides a chronological record of every veterinary appointment for a pet. Each entry captures the visit date, the veterinarian or clinic name, the reason for the visit (categorized as wellness/checkup, illness, injury, emergency, dental, surgery, follow-up, or other), a free-text description of the diagnosis, treatments performed, prescriptions given, the total cost of the visit, and any follow-up instructions.

The vet visit list for each pet displays entries in reverse chronological order (newest first). Each card shows the date, reason category badge, vet name, and cost. Tapping a card opens the full detail view with all fields.

Users can attach follow-up reminders to vet visits. For example, after a dental cleaning, the user might set a reminder for the next dental check in 6 months. These reminders use the same local notification mechanism as vaccination reminders.

The vet visit log integrates with the Expense Tracking feature (PT-010), automatically categorizing vet costs under the "Veterinary" expense category. It also feeds into the Pet Health Timeline (PT-013) to provide a comprehensive chronological health record.

Vet name entries support autocomplete from previously entered vet names, reducing repetitive typing for users who visit the same clinic regularly.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist before vet visits can be logged

**External Dependencies:**
- Local notification system for follow-up reminders
- Local storage for persistent data

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Local database is initialized and writable
- Currency formatting is available based on device locale

#### 3.5 User Interface Requirements

##### Screen: Vet Visit List (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Vet Visits" and a "+" add button on the right
- Summary bar: "Total: [X] visits, $[Y] spent" (for the selected time period)
- Time period selector chips: "All Time" | "This Year" | "Last 12 Months"
- Scrollable vertical list of vet visit cards
- Each card displays: visit date (bold), reason category badge (color-coded), vet name, brief diagnosis (truncated to 1 line), and cost (right-aligned)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No vet visits recorded | Illustration of a stethoscope, message "No vet visits logged yet", button "Log a Vet Visit" |
| Populated | Vet visits exist | Scrollable list of visit cards |
| Filtered | Time period filter active | Filtered list with updated summary bar totals |
| Error | Database read fails | Toast notification: "Could not load vet visits." |

**Interactions:**
- Tap card: Navigate to Vet Visit Detail screen
- Tap "+": Open Add Vet Visit modal
- Swipe left on card: Reveal "Delete" action (with confirmation)
- Tap time period chip: Filter visits and recalculate summary totals

**Transitions/Animations:**
- New visit card animates in from the top with slide-down + fade-in (200ms)
- Deleted visit fades out + slides left (200ms)

##### Screen: Vet Visit Detail

**Layout:**
- Scrollable screen showing all fields for a single vet visit
- Header: Visit date (large), reason category badge
- Sections: Visit Info (vet name, reason, cost), Diagnosis & Treatment (description text), Prescriptions (list if any), Follow-Up (follow-up date and instructions if set)
- "Edit" button in top-right navigation bar
- "Set Follow-Up Reminder" button if no follow-up is set

##### Modal: Add/Edit Vet Visit

**Layout:**
- Full-screen modal with "Cancel" (left) and "Save" (right) in the header
- Form fields in order:
  1. Visit Date (date picker, required, defaults to today, must be on or before today)
  2. Vet/Clinic Name (text input with autocomplete from history, optional, max 200 chars)
  3. Reason (picker: wellness_checkup, illness, injury, emergency, dental, surgery, follow_up, other; required)
  4. Diagnosis (multiline text, optional, max 2000 chars)
  5. Treatment (multiline text, optional, max 2000 chars)
  6. Prescriptions (multiline text, optional, max 1000 chars)
  7. Cost (currency input, optional, min: 0, max: 99999.99)
  8. Follow-Up Date (date picker, optional, must be after visit_date)
  9. Follow-Up Instructions (multiline text, optional, max 1000 chars, visible only if follow-up date set)
  10. Reminder (toggle, default on if follow_up_date is set)
  11. Reminder Lead Time (picker: 1 day, 3 days, 1 week, 2 weeks; default 1 week; visible only if Reminder on)
  12. Notes (multiline text, optional, max 2000 chars)

#### 3.6 Data Requirements

##### Entity: VetVisit

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this visit belongs to |
| visit_date | date | Required, must be on or before today | Today | Date of the vet visit |
| vet_name | string | Max 200 chars | null | Name of the veterinarian or clinic |
| reason | enum | Required. One of: wellness_checkup, illness, injury, emergency, dental, surgery, follow_up, other | None | Category of the visit |
| diagnosis | string | Max 2000 chars | null | Veterinarian's diagnosis |
| treatment | string | Max 2000 chars | null | Treatments performed during the visit |
| prescriptions | string | Max 1000 chars | null | Medications prescribed |
| cost | float | Min: 0, Max: 99999.99 | null | Total cost of the visit |
| follow_up_date | date | Must be after visit_date | null | Recommended follow-up date |
| follow_up_instructions | string | Max 1000 chars | null | Instructions for follow-up care |
| reminder_enabled | boolean | - | true if follow_up_date is set | Whether a follow-up reminder is scheduled |
| reminder_lead_days | integer | One of: 1, 3, 7, 14 | 7 | Days before follow_up_date to fire reminder |
| notes | string | Max 2000 chars | null | Additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- VetVisit belongs to Pet (many-to-one via pet_id)

**Indexes:**
- pet_id - frequently queried for per-pet listing
- visit_date - used for chronological sorting
- (pet_id, visit_date) - composite index for sorted per-pet listing
- reason - used for filtering by visit type

**Validation Rules:**
- visit_date: Required, must be on or before today
- reason: Required, must be a valid enum value
- follow_up_date: If provided, must be after visit_date
- cost: If provided, must be >= 0

**Example Data:**

```
{
  "id": "vv1a2b3c-d5e6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "visit_date": "2026-02-10",
  "vet_name": "Dr. Sarah Chen, Happy Paws Vet Clinic",
  "reason": "wellness_checkup",
  "diagnosis": "Healthy. Slight tartar buildup on back molars.",
  "treatment": "Annual physical exam, heartworm test (negative), fecal test (negative).",
  "prescriptions": "Continue monthly heartworm prevention (Heartgard Plus).",
  "cost": 285.00,
  "follow_up_date": "2027-02-10",
  "follow_up_instructions": "Annual wellness checkup. Discuss dental cleaning if tartar worsens.",
  "reminder_enabled": true,
  "reminder_lead_days": 14,
  "notes": "Luna was calm during the visit. Weight was 62.5 lbs.",
  "created_at": "2026-02-10T17:00:00Z",
  "updated_at": "2026-02-10T17:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Visit Cost Aggregation

**Purpose:** Calculate total vet costs for summary display and expense tracking integration.

**Inputs:**
- pet_id: string
- start_date: date (optional)
- end_date: date (optional)

**Logic:**

```
1. QUERY all VetVisits WHERE pet_id = pet_id
2. IF start_date is provided THEN filter WHERE visit_date >= start_date
3. IF end_date is provided THEN filter WHERE visit_date <= end_date
4. SUM all non-null cost values
5. COUNT total visits
6. RETURN { total_cost, visit_count, average_cost_per_visit }
```

**Formulas:**
- total_cost = SUM(cost) for all visits in period
- average_cost_per_visit = total_cost / visit_count (if visit_count > 0)

**Edge Cases:**
- No visits in period: Return total_cost = 0, visit_count = 0, average = 0
- All visits have null cost: Return total_cost = 0 (null costs treated as 0 for aggregation)
- Single visit: average = total_cost

##### Vet Name Autocomplete

**Purpose:** Suggest previously entered vet names to reduce typing.

**Inputs:**
- query: string (partial vet name typed by user)

**Logic:**

```
1. QUERY DISTINCT vet_name FROM VetVisits (across all pets)
     WHERE vet_name LIKE '%query%' (case-insensitive)
2. ORDER BY frequency of use (most used first), then alphabetically
3. LIMIT to 5 suggestions
4. RETURN list of matching vet names
```

**Edge Cases:**
- No matching vet names: Return empty list, user continues with free text
- Query is empty: Return top 5 most frequently used vet names

##### Follow-Up Reminder Scheduling

**Purpose:** Schedule local notifications for follow-up appointments.

**Logic:** Same as PT-002 Reminder Scheduling, but with:
- Title: "[Pet Name] - Follow-Up Due"
- Body: "[Reason] follow-up at [Vet Name] is due on [follow_up_date formatted]"

**Sort/Filter/Ranking Logic:**
- **Default sort:** Visit date, newest first
- **Available sort options:** Date (newest first), Date (oldest first), Cost (highest first), Cost (lowest first), Reason
- **Filter options:** All Time, This Year, Last 12 Months, By Reason category
- **Search:** vet_name, diagnosis, treatment, prescriptions - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save vet visit. Please try again." | User taps retry; form data preserved |
| Visit date left blank | Inline validation: "Visit date is required" | User selects a date |
| Reason not selected | Inline validation: "Please select a visit reason" | User selects a reason |
| Follow-up date before visit date | Inline validation: "Follow-up date must be after the visit date" | User corrects the date |
| Cost entered as negative | Inline validation: "Cost must be $0 or more" | User corrects the amount |

**Validation Timing:**
- Field-level validation runs on blur
- Cross-field validation (follow-up date vs. visit date) runs on save
- Vet name autocomplete appears on focus with 200ms debounce on keystroke

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists,
   **When** the user adds a vet visit with date "2026-02-10", reason "Wellness Checkup", vet "Dr. Chen", cost $285, and taps Save,
   **Then** the visit appears in the list with the date, a "Wellness" badge, vet name, and "$285.00".

2. **Given** 3 vet visits exist for Luna with costs $285, $150, and $95,
   **When** the user views the vet visit list with "All Time" selected,
   **Then** the summary bar shows "Total: 3 visits, $530.00 spent".

3. **Given** a vet visit with follow_up_date set to "2026-08-10",
   **When** the user saves the visit with reminder enabled,
   **Then** a local notification is scheduled for "2026-08-03" (7 days before).

**Edge Cases:**

4. **Given** all vet visits have null cost values,
   **When** the user views the summary bar,
   **Then** it shows "Total: [X] visits, $0.00 spent".

5. **Given** the user types "Dr. Ch" in the vet name field,
   **When** a previous visit used "Dr. Sarah Chen, Happy Paws Vet Clinic",
   **Then** the autocomplete suggests "Dr. Sarah Chen, Happy Paws Vet Clinic".

**Negative Tests:**

6. **Given** the add vet visit form is open,
   **When** the user sets follow_up_date to a date before visit_date,
   **Then** the system shows "Follow-up date must be after the visit date"
   **And** no record is created.

7. **Given** the add vet visit form is open,
   **When** the user enters a negative cost,
   **Then** the system shows "Cost must be $0 or more"
   **And** no record is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates total cost for 3 visits | costs: [285, 150, 95] | total: 530, count: 3, average: 176.67 |
| calculates total cost with null entries | costs: [285, null, 95] | total: 380, count: 3, average: 126.67 |
| returns zero for no visits | costs: [] | total: 0, count: 0, average: 0 |
| filters visits by date range | 3 visits (Jan, Mar, Jun), range: Feb-Apr | returns only Mar visit |
| validates follow-up date after visit date | visit: 2026-03-06, follow_up: 2026-03-01 | validation error |
| autocomplete returns matching vet names | query: "Dr. Ch", history: ["Dr. Chen", "Dr. Park"] | ["Dr. Chen"] |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add vet visit and verify list display | 1. Open add form for Luna, 2. Enter details, 3. Save | Visit appears at top of list (newest first) with correct badge and cost |
| Delete vet visit and verify totals update | 1. Note total cost, 2. Delete a visit, 3. View summary | Total cost decreases by the deleted visit's cost |
| Vet name autocomplete across pets | 1. Add visit for Luna with vet "Dr. Chen", 2. Add visit for Max, 3. Type "Dr. Ch" | "Dr. Chen" appears in autocomplete for Max's visit |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User logs a year of vet visits | 1. Add pet Luna, 2. Add 4 vet visits across the year, 3. View list with "This Year" filter | List shows 4 visits sorted newest first, summary bar shows correct total cost |
| User sets follow-up reminder | 1. Add vet visit with follow-up date in 6 months, 2. Enable reminder with 2-week lead | Local notification scheduled for 2 weeks before follow-up date |

---

### PT-004: Medication Tracking & Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-004 |
| **Feature Name** | Medication Tracking & Reminders |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to track my pet's medications with dosage, frequency, start and end dates, and receive reminders for each dose, so that I never miss a medication and can report accurate medication history to my vet.

**Secondary:**
> As a senior pet caregiver managing a pet with chronic conditions, I want to track multiple concurrent medications with different frequencies (daily, twice daily, weekly), so that I can manage a complex medication regimen without errors.

**Tertiary:**
> As a foster parent, I want to mark a medication as completed or discontinued with a reason, so that the medication history is accurate for handoff to the adopting family.

#### 3.3 Detailed Description

Medication Tracking & Reminders provides a comprehensive system for managing pet medications. Users add medications by entering the medication name, dosage amount and unit, frequency (once daily, twice daily, every other day, weekly, monthly, or custom interval in days), start date, optional end date, prescribing vet, and notes. The feature reuses the core pattern from the MyMeds standalone module, adapted for pet-specific context.

Each active medication displays a status indicator: "Active" (currently being administered, between start and end dates), "Completed" (past the end date or manually marked complete), "Paused" (temporarily stopped by user), or "Discontinued" (stopped early with a recorded reason). Users can log each dose as taken, skipped, or missed. Logging a dose records the timestamp and any notes (e.g., "gave with food", "refused pill").

The medication list screen shows active medications first, followed by paused, then completed/discontinued. Each card displays the medication name, dosage, frequency, next dose time, and a prominent "Log Dose" button. A daily medication schedule view shows all medications due today in chronological order by next dose time.

Reminders are local notifications scheduled for each upcoming dose. Users configure the reminder time per medication (e.g., "8:00 AM daily"). The system supports multiple daily doses by scheduling separate notifications for each dose time.

The medication log (dose history) provides a scrollable timeline of all logged doses for a specific medication, including taken, skipped, and missed entries. Adherence statistics show the percentage of doses taken vs. total expected doses.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist before medications can be tracked

**External Dependencies:**
- Local notification system for dose reminders
- Local storage for persistent data
- Device clock for time-based scheduling

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Local database is initialized and writable
- Local notification scheduling supports multiple concurrent notifications

#### 3.5 User Interface Requirements

##### Screen: Medication List (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Medications" and a "+" add button on the right
- Summary bar: "[X] active, [Y] due today"
- Toggle tabs: "Active" | "All"
- Scrollable vertical list of medication cards
- Each card displays: medication name (bold), dosage + unit, frequency text (e.g., "Twice daily"), next dose time, status badge, and a circular "Log Dose" button on the right
- Active medications sorted by next dose time (soonest first); completed/discontinued at the bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No medications recorded | Illustration of a pill bottle, message "No medications tracked yet", button "Add Medication" |
| Populated | Medications exist | Scrollable list with status badges and log dose buttons |
| All Active Due | All active medications have been logged for today | Banner: "All caught up! No more doses due today." |
| Error | Database read fails | Toast notification: "Could not load medications." |

**Interactions:**
- Tap card: Navigate to Medication Detail screen
- Tap "Log Dose" button: Open quick-log sheet (confirm time, optional note, tap "Taken" or "Skipped")
- Tap "+": Open Add Medication modal
- Swipe left on card: Reveal "Pause" and "Discontinue" actions
- Tap filter tab: Toggle between active-only and all medications

**Transitions/Animations:**
- Log dose button pulses briefly (scale 1.0 to 1.1, 150ms) when a dose is due
- Logging a dose animates the button to a checkmark with a green fill (200ms)
- Status badge change animates with cross-fade (150ms)

##### Screen: Medication Detail

**Layout:**
- Scrollable screen showing complete medication information
- Header: Medication name (large, bold), status badge
- Info section: Dosage, frequency, start date, end date (or "Ongoing"), prescribing vet, notes
- Adherence section: circular progress chart showing adherence percentage, text "X of Y doses taken"
- Dose History section: scrollable timeline of logged doses (most recent first), each showing timestamp, status (taken/skipped/missed), and optional note
- Action buttons: "Log Dose", "Pause" / "Resume", "Discontinue", "Edit"

##### Screen: Daily Medication Schedule

**Layout:**
- Top navigation bar showing "Today's Medications" with date
- Chronological list of all medication doses due today across all pets
- Each entry shows: time, pet name (with small avatar), medication name, dosage, status (pending/taken/skipped)
- Entries grouped by time slot (morning, afternoon, evening, bedtime)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No medications due today | Message: "No medications due today" |
| All Complete | All doses logged | Banner: "All done for today!" with checkmark |
| Populated | Doses pending | Chronological list with pending items highlighted |

##### Modal: Add/Edit Medication

**Layout:**
- Full-screen modal with "Cancel" (left) and "Save" (right) in the header
- Form fields in order:
  1. Medication Name (text input, required, max 200 chars)
  2. Dosage Amount (numeric input, required, min: 0.01, max: 9999)
  3. Dosage Unit (picker: mg, mL, tablet(s), capsule(s), drop(s), unit(s), custom; required)
  4. Frequency (picker: once_daily, twice_daily, three_times_daily, every_other_day, weekly, monthly, custom; required)
  5. Custom Interval Days (integer input, min: 1, max: 365; visible only if frequency = custom)
  6. Dose Times (time picker(s); count matches frequency: 1 for once_daily, 2 for twice_daily, 3 for three_times_daily, 1 for others)
  7. Start Date (date picker, required, defaults to today)
  8. End Date (date picker, optional, must be on or after start_date; blank = ongoing)
  9. Prescribing Vet (text input, optional, max 200 chars, autocomplete from vet history)
  10. Reminder (toggle, default on)
  11. Notes (multiline text, optional, max 2000 chars)
  12. Refill Reminder (toggle, default off)
  13. Refill Quantity (integer input, min: 1, max: 9999; visible only if refill reminder on)
  14. Refill When Remaining (integer input, min: 1; visible only if refill reminder on; "Remind me when [X] doses remain")

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New | Adding a new medication | Fields empty except start date (today) |
| Edit | Editing existing medication | Fields pre-populated |
| Validation Error | Required field missing or invalid | Inline error below offending field |

**Interactions:**
- Changing Frequency updates the number of Dose Times pickers shown
- Tap "Cancel": Dismiss with confirmation if changes made
- Tap "Save": Validate, save, schedule notifications, dismiss modal

##### Modal: Quick Dose Log

**Layout:**
- Bottom sheet (half-screen height)
- Header: medication name + dosage
- Time field: defaults to current time, tappable to adjust
- Note field: optional, single-line, max 200 chars
- Two large buttons: "Taken" (green, primary) and "Skipped" (yellow, secondary)

#### 3.6 Data Requirements

##### Entity: Medication

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this medication belongs to |
| name | string | Required, max 200 chars, trimmed | None | Medication name |
| dosage_amount | float | Required, min: 0.01, max: 9999 | None | Dosage amount per dose |
| dosage_unit | enum | Required. One of: mg, mL, tablets, capsules, drops, units, custom | None | Unit of dosage |
| dosage_unit_custom | string | Max 50 chars. Required if dosage_unit = custom | null | Custom dosage unit name |
| frequency | enum | Required. One of: once_daily, twice_daily, three_times_daily, every_other_day, weekly, monthly, custom | None | How often the medication is taken |
| custom_interval_days | integer | Min: 1, Max: 365. Required if frequency = custom | null | Number of days between doses for custom frequency |
| dose_times | string | JSON array of time strings (HH:MM format) | None | Scheduled times for each daily dose |
| start_date | date | Required | Today | Date the medication regimen started |
| end_date | date | Must be on or after start_date | null | Date the medication regimen ends (null = ongoing) |
| status | enum | One of: active, paused, completed, discontinued | active | Current medication status |
| discontinue_reason | string | Max 500 chars | null | Reason for discontinuing (required when status changes to discontinued) |
| prescribing_vet | string | Max 200 chars | null | Vet who prescribed the medication |
| reminder_enabled | boolean | - | true | Whether dose reminders are active |
| refill_reminder_enabled | boolean | - | false | Whether refill reminders are active |
| refill_quantity | integer | Min: 1, Max: 9999 | null | Total quantity in current refill |
| refill_threshold | integer | Min: 1 | null | Remaining doses at which to trigger refill reminder |
| notes | string | Max 2000 chars | null | Additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: DoseLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| medication_id | string | Required, references Medication.id | None | The medication this dose belongs to |
| pet_id | string | Required, references Pet.id | None | The pet (denormalized for cross-pet queries) |
| scheduled_time | datetime | Required | None | When the dose was scheduled |
| logged_time | datetime | - | null | When the dose was actually logged |
| status | enum | Required. One of: taken, skipped, missed | None | Whether the dose was taken, skipped, or missed |
| note | string | Max 200 chars | null | Optional note for this dose |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- Medication belongs to Pet (many-to-one via pet_id)
- Medication has many DoseLogs (one-to-many via medication_id)
- DoseLog belongs to Medication (many-to-one via medication_id)
- DoseLog belongs to Pet (many-to-one via pet_id)

**Indexes:**
- Medication: pet_id - per-pet listing
- Medication: status - filtering active vs. completed
- Medication: (pet_id, status) - active medications for a pet
- DoseLog: medication_id - dose history for a medication
- DoseLog: (pet_id, scheduled_time) - daily schedule across all medications for a pet
- DoseLog: (medication_id, status) - adherence calculation

**Validation Rules:**
- name: Must not be empty after trimming
- dosage_amount: Required, must be > 0
- dosage_unit: Required, must be valid enum
- dosage_unit_custom: Required if dosage_unit = custom
- frequency: Required, must be valid enum
- custom_interval_days: Required if frequency = custom, must be >= 1
- dose_times: Must contain at least 1 time; count must match frequency (1 for once_daily, 2 for twice_daily, 3 for three_times_daily, 1 for all others)
- start_date: Required
- end_date: If provided, must be >= start_date
- discontinue_reason: Required when status is changed to "discontinued"

**Example Data:**

```
{
  "id": "med-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Heartgard Plus",
  "dosage_amount": 1,
  "dosage_unit": "tablets",
  "dosage_unit_custom": null,
  "frequency": "monthly",
  "custom_interval_days": null,
  "dose_times": "[\"08:00\"]",
  "start_date": "2026-01-15",
  "end_date": null,
  "status": "active",
  "discontinue_reason": null,
  "prescribing_vet": "Dr. Sarah Chen",
  "reminder_enabled": true,
  "refill_reminder_enabled": true,
  "refill_quantity": 12,
  "refill_threshold": 2,
  "notes": "Give with food. Monthly heartworm prevention.",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-03-01T08:30:00Z"
}
```

```
{
  "id": "dose-f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "medication_id": "med-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "scheduled_time": "2026-03-01T08:00:00Z",
  "logged_time": "2026-03-01T08:15:00Z",
  "status": "taken",
  "note": "Gave with breakfast, no issues.",
  "created_at": "2026-03-01T08:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Medication Status State Machine

**Purpose:** Manage the lifecycle of a medication through its valid states.

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| active | User taps "Pause" | paused | Cancel all pending reminders, record pause timestamp |
| active | User taps "Discontinue" | discontinued | Cancel all pending reminders, require discontinue_reason, record timestamp |
| active | end_date reached | completed | Cancel all pending reminders, mark as completed automatically |
| paused | User taps "Resume" | active | Reschedule reminders from today forward |
| paused | User taps "Discontinue" | discontinued | Require discontinue_reason, record timestamp |
| completed | User taps "Restart" | active | Set new start_date to today, clear end_date, reschedule reminders |
| discontinued | User taps "Restart" | active | Set new start_date to today, clear end_date, reschedule reminders |

**Invalid transitions:** completed -> paused, discontinued -> paused (must restart to active first)

##### Adherence Calculation

**Purpose:** Calculate the percentage of doses taken vs. total expected doses.

**Inputs:**
- medication_id: string
- start_date: date (optional, defaults to medication start_date)
- end_date: date (optional, defaults to today)

**Logic:**

```
1. QUERY all DoseLogs WHERE medication_id = medication_id
     AND scheduled_time >= start_date
     AND scheduled_time <= end_date
2. total_doses = COUNT(all dose logs in range)
3. taken_doses = COUNT(dose logs WHERE status = "taken")
4. IF total_doses = 0 THEN RETURN adherence = 100 (no doses expected yet)
5. adherence_percentage = (taken_doses / total_doses) * 100
6. RETURN { adherence_percentage (rounded to 1 decimal), taken_doses, total_doses, skipped_count, missed_count }
```

**Formulas:**
- adherence_percentage = (taken_doses / total_doses) * 100
- skipped_count = COUNT(dose logs WHERE status = "skipped")
- missed_count = COUNT(dose logs WHERE status = "missed")

**Edge Cases:**
- No dose logs exist yet: Return adherence = 100% (medication just started)
- All doses skipped: Return adherence = 0%
- Medication paused: Doses during pause period are not counted in total_doses

##### Dose Reminder Scheduling

**Purpose:** Schedule local notifications for upcoming medication doses.

**Inputs:**
- medication: Medication entity

**Logic:**

```
1. IF medication.reminder_enabled = false THEN
     CANCEL all notifications for this medication.id
     RETURN
2. IF medication.status != "active" THEN
     CANCEL all notifications for this medication.id
     RETURN
3. FOR each time in medication.dose_times:
     a. COMPUTE next_dose_datetime based on frequency:
        - once_daily / twice_daily / three_times_daily: today at [time] if not yet passed, else tomorrow at [time]
        - every_other_day: next valid day at [time]
        - weekly: next valid weekday at [time]
        - monthly: next valid month-day at [time]
        - custom: start_date + (N * custom_interval_days) at [time], where N is the smallest integer that puts the date in the future
     b. IF medication.end_date IS NOT null AND next_dose_datetime > end_date THEN SKIP
     c. SCHEDULE local notification:
        - Title: "[Pet Name] - Medication Due"
        - Body: "[Medication Name] - [Dosage Amount] [Dosage Unit]"
        - Fire date: next_dose_datetime
        - Repeating: true (based on frequency)
        - ID: "{medication.id}_{time}" (to allow individual cancellation)
```

**Edge Cases:**
- Multiple dose times per day: Each time gets its own notification
- Medication end date is today: Schedule remaining doses for today only
- Medication paused: Cancel all notifications (state machine handles this)
- Device rebooted: Notifications are rescheduled on app launch

##### Refill Reminder Logic

**Purpose:** Alert users when medication supply is running low.

**Inputs:**
- medication: Medication entity
- dose_log_count: integer (total taken doses since last refill)

**Logic:**

```
1. IF medication.refill_reminder_enabled = false THEN RETURN
2. remaining_doses = medication.refill_quantity - dose_log_count_since_refill
3. IF remaining_doses <= medication.refill_threshold THEN
     TRIGGER local notification:
     - Title: "[Pet Name] - Refill Needed"
     - Body: "[Medication Name] has [remaining_doses] dose(s) remaining"
4. IF remaining_doses <= 0 THEN
     Display banner on medication card: "Refill needed - 0 doses remaining"
```

**Edge Cases:**
- refill_quantity is null: Skip refill check entirely
- User logs a skipped dose: Still decrements remaining count (medication was dispensed even if not administered in many cases; user can adjust)
- User resets refill: Set dose_log_count_since_refill to 0

**Sort/Filter/Ranking Logic:**
- **Default sort:** Active medications first (sorted by next dose time, soonest first), then paused, then completed/discontinued (sorted by updated_at, newest first)
- **Available sort options:** Next dose time, Name (A-Z), Status, Start date (newest first)
- **Filter options:** Active only (default), All, By status
- **Search:** name, prescribing_vet - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save medication. Please try again." | User taps retry; form data preserved |
| Medication name left blank | Inline validation: "Medication name is required" | User fills in the field |
| Dosage amount is zero or negative | Inline validation: "Dosage must be greater than 0" | User corrects the value |
| End date before start date | Inline validation: "End date must be on or after start date" | User corrects the date |
| Notification scheduling fails | Medication is saved without reminders; toast: "Medication saved, but reminders could not be set." | User can edit and re-enable reminders |
| Dose log write fails | Toast: "Could not log dose. Please try again." | Quick-log sheet remains open for retry |
| Discontinue without reason | Inline validation: "Please provide a reason for discontinuing" | User enters a reason |

**Validation Timing:**
- Field-level validation runs on blur
- Cross-field validation (end date vs. start date, dose time count vs. frequency) runs on save
- Discontinue reason is validated on confirm action

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists,
   **When** the user adds a medication "Heartgard Plus", 1 tablet, monthly, dose time 8:00 AM, start date today, and taps Save,
   **Then** the medication appears in the active list with status "Active", and a monthly reminder is scheduled for 8:00 AM on the 1st of each month.

2. **Given** an active medication exists with dose time 8:00 AM,
   **When** the user taps "Log Dose", confirms time 8:15 AM, and taps "Taken",
   **Then** a dose log entry is created with status "taken" and logged_time 8:15 AM, and the next dose time advances to the next scheduled time.

3. **Given** a medication with 12 doses taken out of 12 total,
   **When** the user views the adherence chart,
   **Then** the chart shows 100% adherence.

4. **Given** a medication with refill_quantity = 12 and refill_threshold = 2,
   **When** the user logs the 10th dose (2 remaining),
   **Then** a refill reminder notification fires with "Heartgard Plus has 2 dose(s) remaining".

**Edge Cases:**

5. **Given** a medication with twice_daily frequency,
   **When** the user adds the medication with dose times 8:00 AM and 8:00 PM,
   **Then** two separate reminders are scheduled daily, and the daily schedule shows both entries.

6. **Given** a medication is paused,
   **When** the user views the medication list,
   **Then** the medication shows a "Paused" badge, no reminders are active, and the "Log Dose" button is hidden.

**Negative Tests:**

7. **Given** the add medication form is open,
   **When** the user leaves the medication name blank and taps Save,
   **Then** the system shows "Medication name is required"
   **And** no record is created.

8. **Given** an active medication,
   **When** the user taps "Discontinue" and does not enter a reason,
   **Then** the system shows "Please provide a reason for discontinuing"
   **And** the medication status remains "active".

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates 100% adherence | 12 taken, 0 skipped, 0 missed | adherence: 100.0% |
| calculates 75% adherence | 9 taken, 2 skipped, 1 missed | adherence: 75.0% |
| calculates 0% adherence | 0 taken, 0 skipped, 10 missed | adherence: 0.0% |
| returns 100% for no doses yet | 0 total doses | adherence: 100.0% |
| computes next dose for once_daily | dose_time: 08:00, current: 10:00 | next: tomorrow 08:00 |
| computes next dose for once_daily before time | dose_time: 20:00, current: 10:00 | next: today 20:00 |
| computes next dose for monthly | start: Jan 15, current: Mar 16 | next: Apr 15 |
| computes next dose for custom 3-day | start: Mar 1, current: Mar 6 | next: Mar 7 (3+3+1) |
| validates dose_times count matches frequency | frequency: twice_daily, dose_times: ["08:00"] | validation error: "Twice daily requires 2 dose times" |
| validates discontinue reason required | status change: active -> discontinued, reason: null | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add medication and verify list display | 1. Open add form for Luna, 2. Enter Heartgard details, 3. Save | Medication appears in active list with correct dosage and frequency |
| Log dose and verify adherence update | 1. Log a dose as "taken", 2. View adherence chart | Adherence percentage updates to reflect the new log |
| Pause and resume medication | 1. Pause an active medication, 2. Verify reminders cancelled, 3. Resume, 4. Verify reminders rescheduled | Status transitions correctly, reminders match state |
| Delete medication cascades dose logs | 1. Add medication with 5 dose logs, 2. Delete medication | Medication and all 5 dose logs removed from database |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User manages daily medication for senior pet | 1. Add pet Buddy (senior dog), 2. Add "Rimadyl" twice daily at 8:00 AM and 6:00 PM, 3. Log morning dose, 4. View daily schedule | Daily schedule shows morning dose checked off, evening dose pending. Adherence shows 50% for today. |
| User tracks monthly heartworm prevention | 1. Add "Heartgard Plus" monthly, refill quantity 12, refill threshold 2, 2. Log 10 doses over 10 months | Refill reminder fires after 10th dose. Medication card shows "Refill needed - 2 doses remaining". |

---

### PT-005: Weight Tracking & Growth Charts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-005 |
| **Feature Name** | Weight Tracking & Growth Charts |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to log my pet's weight over time and see it plotted on a chart, so that I can monitor weight trends and share accurate weight history with my vet.

**Secondary:**
> As a first-time pet owner, I want to see whether my pet's weight is within a healthy range for their breed, so that I know if I need to adjust their diet or consult a vet.

**Tertiary:**
> As a breeder or foster parent, I want to track a puppy or kitten's growth curve against breed-standard percentiles, so that I can confirm the animal is developing normally.

#### 3.3 Detailed Description

Weight Tracking & Growth Charts lets users log periodic weight measurements for each pet and visualize the data on a line chart over time. Each weight entry records the weight value, unit (lbs or kg), date of measurement, and an optional note (e.g., "post-surgery", "weighed at vet").

The weight chart plots all entries on a time-series line graph with the x-axis as date and the y-axis as weight. Users can select time ranges: Last 30 Days, Last 6 Months, Last Year, All Time. The chart also displays the pet's goal weight range (if configured) as a shaded band, making it easy to see if the pet is above, below, or within the target range.

For dogs and cats, the system includes breed-specific weight percentile lookup tables. When the pet's breed is set and the breed is in the lookup table, the chart can overlay 25th, 50th, and 75th percentile curves for that breed and age, showing how the pet's weight compares to breed norms. Percentile data is stored as static lookup tables within the app (no network fetch required).

The most recent weight entry automatically updates the pet's profile weight (Pet.weight). If the weight unit differs from the pet's preferred unit, the system converts using the formula: 1 kg = 2.20462 lbs. The pet profile always displays weight in the user's preferred unit.

Weight change statistics include: current weight, minimum recorded weight, maximum recorded weight, average weight (all-time), weight change over the last 30/90/180 days (absolute and percentage), and trend direction (gaining, losing, stable). A weight is considered "stable" if the change over the last 90 days is within +/- 2% of the average weight in that period.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist and its breed/species must be set for breed percentiles

**External Dependencies:**
- Local storage for persistent data
- Chart rendering capability (line chart with shaded regions)

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Local database is initialized and writable
- Date math and unit conversion are available

#### 3.5 User Interface Requirements

##### Screen: Weight History (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Weight" and a "+" add button on the right
- Weight chart occupying the top 40% of the screen
  - Line chart with data points marked as dots
  - Goal weight range shown as a semi-transparent shaded band (if configured)
  - Breed percentile curves shown as dashed lines (25th, 50th, 75th) with labels (if breed data available)
  - Time range selector below chart: "30 Days" | "6 Months" | "1 Year" | "All Time"
- Stats cards below the chart (horizontal scrollable row):
  - Current: [X] lbs/kg
  - Min: [X] lbs/kg
  - Max: [X] lbs/kg
  - Change (90d): [+/-X] lbs/kg ([+/-Y]%)
  - Trend: [Gaining/Losing/Stable] with arrow icon
- Scrollable list of weight entries below stats, newest first
- Each entry row: date, weight value + unit, note (if any), and an indicator dot if this weight was the most recent pet profile update

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No weight entries | Chart area shows placeholder with message "No weight data yet", prompt "Log your first weight" |
| Single Entry | Only 1 weight entry | Chart shows a single dot. Stats show only "Current" value. Trend shows "Not enough data". |
| Populated | 2+ weight entries | Full chart with line, stats with all values |
| Breed Data Available | Pet's breed is in the lookup table | Percentile curves overlay on the chart with a legend |
| Breed Data Unavailable | Breed not in lookup table or species not dog/cat | No percentile curves; chart shows only the pet's weight line |
| Error | Database read fails | Toast: "Could not load weight data." |

**Interactions:**
- Tap data point on chart: Tooltip showing date, weight, and note
- Tap "+": Open Add Weight Entry modal
- Tap time range selector: Redraw chart for selected range
- Swipe left on entry in list: Reveal "Edit" and "Delete" actions
- Tap entry in list: Open Edit Weight Entry modal

**Transitions/Animations:**
- Chart line draws from left to right on initial load (300ms)
- Time range change cross-fades the chart (200ms)
- New entry dot pulses once on addition (scale animation, 200ms)

##### Modal: Add/Edit Weight Entry

**Layout:**
- Bottom sheet (compact form)
- Form fields:
  1. Weight (numeric input with 2 decimal places, required, min: 0.01, max: 9999.99)
  2. Unit (toggle: lbs / kg, defaults to pet's weight_unit preference)
  3. Date (date picker, required, defaults to today, must be on or before today)
  4. Note (single-line text, optional, max 200 chars)
- "Save" button (primary, full-width)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New | Adding a new entry | Weight field focused, unit defaults to pet preference |
| Edit | Editing existing entry | Fields pre-populated |
| Validation Error | Invalid input | Inline error below weight field |

##### Modal: Goal Weight Configuration

**Layout:**
- Bottom sheet
- Form fields:
  1. Goal Weight Min (numeric input, min: 0.01, max: 9999.99)
  2. Goal Weight Max (numeric input, min: 0.01, max: 9999.99, must be >= min)
  3. Unit (toggle: lbs / kg)
- "Save" button

#### 3.6 Data Requirements

##### Entity: WeightEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this entry belongs to |
| weight | float | Required, min: 0.01, max: 9999.99 | None | Weight measurement |
| unit | enum | Required. One of: lbs, kg | Pet's weight_unit | Unit of measurement |
| date | date | Required, must be on or before today | Today | Date of the measurement |
| note | string | Max 200 chars | null | Optional note about the measurement context |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: WeightGoal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id, unique (1 goal per pet) | None | The pet this goal belongs to |
| min_weight | float | Required, min: 0.01, max: 9999.99 | None | Lower bound of healthy weight range |
| max_weight | float | Required, min: 0.01, max: 9999.99, must be >= min_weight | None | Upper bound of healthy weight range |
| unit | enum | Required. One of: lbs, kg | Pet's weight_unit | Unit for goal weights |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- WeightEntry belongs to Pet (many-to-one via pet_id)
- WeightGoal belongs to Pet (one-to-one via pet_id)

**Indexes:**
- WeightEntry: pet_id - per-pet listing
- WeightEntry: (pet_id, date) - sorted weight history
- WeightEntry: date - time-range filtering
- WeightGoal: pet_id (unique) - one goal per pet

**Validation Rules:**
- weight: Required, must be > 0
- date: Required, must be on or before today
- No duplicate entries for the same pet on the same date (unique constraint on pet_id + date)
- max_weight >= min_weight for goal configuration

**Example Data:**

```
{
  "id": "we-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "weight": 62.5,
  "unit": "lbs",
  "date": "2026-03-01",
  "note": "Weighed at vet during checkup",
  "created_at": "2026-03-01T14:00:00Z",
  "updated_at": "2026-03-01T14:00:00Z"
}
```

```
{
  "id": "wg-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "min_weight": 55.0,
  "max_weight": 70.0,
  "unit": "lbs",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Weight Unit Conversion

**Purpose:** Convert between lbs and kg for display and comparison.

**Inputs:**
- weight: float
- from_unit: enum (lbs or kg)
- to_unit: enum (lbs or kg)

**Logic:**

```
1. IF from_unit = to_unit THEN RETURN weight
2. IF from_unit = "kg" AND to_unit = "lbs" THEN RETURN weight * 2.20462
3. IF from_unit = "lbs" AND to_unit = "kg" THEN RETURN weight / 2.20462
4. ROUND result to 2 decimal places
```

**Formulas:**
- lbs_to_kg = weight_lbs / 2.20462
- kg_to_lbs = weight_kg * 2.20462

##### Weight Statistics Calculation

**Purpose:** Compute summary statistics from weight history.

**Inputs:**
- pet_id: string
- display_unit: enum (lbs or kg)

**Logic:**

```
1. QUERY all WeightEntries WHERE pet_id = pet_id ORDER BY date ASC
2. CONVERT all weights to display_unit
3. current_weight = most recent entry's weight
4. min_weight = MIN(all weights)
5. max_weight = MAX(all weights)
6. avg_weight = SUM(all weights) / COUNT(all weights)
7. FOR change periods [30, 90, 180] days:
     a. FIND entry closest to (today - N days) = reference_weight
     b. change_absolute = current_weight - reference_weight
     c. change_percentage = (change_absolute / reference_weight) * 100
8. COMPUTE trend:
     a. FIND all entries in last 90 days
     b. IF fewer than 2 entries THEN trend = "insufficient_data"
     c. avg_90d = average of entries in last 90 days
     d. IF abs(change_percentage_90d) <= 2.0 THEN trend = "stable"
     e. ELSE IF change_percentage_90d > 0 THEN trend = "gaining"
     f. ELSE trend = "losing"
9. RETURN { current_weight, min_weight, max_weight, avg_weight, changes: { 30d, 90d, 180d }, trend }
```

**Formulas:**
- change_absolute = current_weight - reference_weight
- change_percentage = (change_absolute / reference_weight) * 100
- trend_threshold = +/- 2.0% over 90 days

**Edge Cases:**
- Only 1 weight entry: current = min = max = avg = that value, all changes = 0, trend = "insufficient_data"
- No entry exists near the 30/90/180-day lookback: Use the closest available entry
- Zero weight entries: Return all values as null, trend = "no_data"

##### Profile Weight Sync

**Purpose:** Keep the pet profile's current weight in sync with the latest weight entry.

**Logic:**

```
1. ON new WeightEntry saved:
     a. IF entry.date >= all existing entries' dates for this pet THEN
          pet.weight = CONVERT(entry.weight, entry.unit, pet.weight_unit)
          pet.updated_at = NOW()
2. ON WeightEntry deleted:
     a. FIND the remaining entry with the latest date
     b. IF found THEN pet.weight = CONVERT(latest.weight, latest.unit, pet.weight_unit)
     c. IF no entries remain THEN pet.weight = null (or leave unchanged based on setting)
```

##### Breed Weight Percentile Lookup

**Purpose:** Provide breed-standard weight percentile curves for growth chart overlay.

**Inputs:**
- species: enum (dog or cat)
- breed: string
- age_months: integer

**Logic:**

```
1. LOOKUP breed in static percentile table for species
2. IF breed not found THEN RETURN null (no percentile data available)
3. FOR the given age_months, RETURN:
     - p25_weight: 25th percentile weight at this age
     - p50_weight: 50th percentile weight at this age (median)
     - p75_weight: 75th percentile weight at this age
4. Percentile data is available for ages 0-24 months (puppies/kittens) at 1-month intervals
5. For adult dogs/cats (> 24 months), return a single adult range per breed
6. All percentile weights are stored in lbs; convert to user's preferred unit for display
```

**Edge Cases:**
- Breed not in lookup table: Return null, chart shows only the pet's actual weight line
- Species is not dog or cat: Return null (no percentile data for other species)
- Age between data points: Linear interpolation between the two nearest month values
- Age unknown (no DOB): Return adult range only (no growth curve)
- Mixed breed or "Unknown" breed: Return null

**Sort/Filter/Ranking Logic:**
- **Default sort:** Weight entries sorted by date, newest first
- **Available sort options:** Date (newest first), Date (oldest first), Weight (highest first), Weight (lowest first)
- **Filter options:** All Time, Last 30 Days, Last 6 Months, Last Year
- **Search:** note field - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save weight entry. Please try again." | User taps retry; form data preserved |
| Weight value is zero or negative | Inline validation: "Weight must be greater than 0" | User corrects the value |
| Duplicate date for same pet | Inline validation: "A weight entry already exists for this date. Edit the existing entry instead." | User changes the date or navigates to edit the existing entry |
| Goal max less than min | Inline validation: "Maximum weight must be greater than or equal to minimum weight" | User corrects the values |
| Breed percentile data not available | Chart renders without percentile overlay; small info label: "Percentile data not available for this breed" | No action needed; purely informational |
| Chart rendering fails | Fallback to weight entry list only; toast: "Could not render chart" | User can still view and manage individual entries |

**Validation Timing:**
- Weight field validates on blur
- Date uniqueness validates on save
- Goal range validation runs on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists,
   **When** the user adds a weight entry of 62.5 lbs on 2026-03-01 and taps Save,
   **Then** the entry appears in the weight list, the chart shows a data point, and Luna's profile weight updates to 62.5 lbs.

2. **Given** 5 weight entries exist over 6 months showing a gradual increase,
   **When** the user views the weight chart with "6 Months" selected,
   **Then** the chart displays a line trending upward with 5 data points, and the trend indicator shows "Gaining".

3. **Given** a goal weight range of 55-70 lbs is configured,
   **When** the user views the weight chart,
   **Then** a shaded band appears between 55 and 70 lbs on the y-axis.

4. **Given** Luna is a Golden Retriever with DOB 2025-04-15 (11 months old),
   **When** the user views the weight chart,
   **Then** dashed percentile lines for Golden Retriever appear on the chart at the 25th, 50th, and 75th percentiles.

**Edge Cases:**

5. **Given** only 1 weight entry exists,
   **When** the user views the weight stats,
   **Then** current/min/max/avg all show the same value, change shows "0.0 lbs (0.0%)", and trend shows "Not enough data".

6. **Given** weight entries are logged in kg but the pet's preferred unit is lbs,
   **When** the user views the chart and stats,
   **Then** all values are displayed in lbs after conversion.

**Negative Tests:**

7. **Given** the add weight form is open,
   **When** the user enters weight as 0 and taps Save,
   **Then** the system shows "Weight must be greater than 0"
   **And** no entry is created.

8. **Given** a weight entry already exists for 2026-03-01 for this pet,
   **When** the user tries to add another entry for 2026-03-01,
   **Then** the system shows "A weight entry already exists for this date."
   **And** no duplicate entry is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts lbs to kg | 62.5 lbs | 28.35 kg |
| converts kg to lbs | 28.35 kg | 62.50 lbs |
| same unit returns unchanged | 62.5 lbs to lbs | 62.5 lbs |
| calculates weight stats correctly | entries: [60, 62, 65, 63, 62.5] | current: 62.5, min: 60, max: 65, avg: 62.5 |
| returns stable trend for < 2% change | 90d entries avg: 62.0, current: 62.5 | trend: "stable" (0.8%) |
| returns gaining trend for > 2% increase | 90d reference: 60.0, current: 65.0 | trend: "gaining" (8.3%) |
| returns losing trend for > 2% decrease | 90d reference: 65.0, current: 60.0 | trend: "losing" (-7.7%) |
| returns insufficient_data for < 2 entries in 90d | 1 entry in last 90 days | trend: "insufficient_data" |
| returns null percentiles for unknown breed | breed: "Mixed", species: "dog" | null |
| returns percentiles for Golden Retriever at 6 months | breed: "Golden Retriever", age: 6 | { p25: 35, p50: 42, p75: 50 } (approximate) |
| validates no duplicate date | existing: 2026-03-01, new: 2026-03-01 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add weight and verify profile sync | 1. Add weight 62.5 lbs, 2. Check pet profile | Pet profile weight shows 62.5 lbs |
| Delete latest weight and verify profile sync | 1. Add weights 60 (Jan) and 65 (Feb), 2. Delete Feb entry | Pet profile weight reverts to 60 lbs |
| Weight chart renders with goal band | 1. Set goal 55-70 lbs, 2. Add 3 weight entries, 3. View chart | Chart shows line with 3 points and shaded goal band |
| Unit conversion across entries | 1. Add entry in lbs, 2. Add entry in kg, 3. View chart in lbs | Both entries displayed correctly in lbs on chart |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks puppy growth over 6 months | 1. Add pet (Golden Retriever, DOB 6 months ago), 2. Add 6 monthly weight entries showing growth, 3. View chart | Chart shows upward growth curve with breed percentile overlay. Stats show gaining trend. Profile weight matches latest entry. |
| User monitors senior pet weight loss | 1. Add 12 monthly weight entries showing gradual decline, 2. View chart with "1 Year" range | Chart shows downward trend. Stats show "Losing" trend with negative percentage. Goal range (if set) highlights that weight has dropped below range. |

---

### PT-006: Feeding Schedule & Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-006 |
| **Feature Name** | Feeding Schedule & Reminders |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to set up a feeding schedule for each pet with meal times, portion sizes, and food brand, so that I maintain a consistent feeding routine and remember what food each pet eats.

**Secondary:**
> As a multi-pet household manager, I want to see all feeding times across all pets on a single daily view, so that I do not mix up who gets fed when and can track whether each pet has been fed.

**Tertiary:**
> As a pet sitter, I want to see clear feeding instructions including food brand, portion, and any dietary restrictions, so that I can follow the owner's routine exactly.

#### 3.3 Detailed Description

Feeding Schedule & Reminders allows users to create and manage structured feeding plans for each pet. A feeding schedule consists of one or more daily meals, each with a scheduled time, a food name/brand, a portion size (with unit), and optional notes (e.g., "mix with warm water", "add joint supplement"). Users can track multiple food types per pet (e.g., dry kibble in the morning, wet food in the evening).

Each meal can be logged as "Fed" with a single tap, recording the timestamp. This creates a daily feeding log that shows whether each scheduled meal has been completed. The system supports meal reminders via local notifications at the scheduled feeding time.

Feeding schedules also capture dietary information: food allergies, dietary restrictions, and special feeding instructions. This information is surfaced in the Pet Sitter Info Export (PT-016) and displayed prominently on the feeding screen.

The daily feeding dashboard (accessible from the Multi-Pet Dashboard) shows all upcoming and completed meals across all pets for the current day, grouped by time slot.

Food transition tracking allows users to record when they switch foods, including the old food, new food, transition start date, transition end date, and a ratio schedule (e.g., "Day 1-3: 75% old / 25% new, Day 4-6: 50/50, Day 7-9: 25% old / 75% new, Day 10+: 100% new"). The standard transition period is 10 days, and the system can display a visual progress bar showing where the pet is in the transition.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist before feeding schedules can be created

**External Dependencies:**
- Local notification system for meal reminders
- Local storage for persistent data

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Feeding Schedule (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Feeding" and a "+" add button on the right
- Dietary info banner at top (if any allergies/restrictions are set): icon + "Allergic to: [items]" / "Restriction: [items]"
- List of scheduled meals, sorted by time
- Each meal card displays: time (large, bold), food name, portion (e.g., "1.5 cups"), "Fed" toggle button, and status (if logged for today, shows timestamp "Fed at 8:15 AM")
- Food transition section (visible only during an active transition): progress bar with day count, current ratio, and visual indicator
- "Dietary Info" button in the navigation bar for editing allergies and restrictions

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No meals scheduled | Illustration of a food bowl, message "No feeding schedule set up yet", button "Add a Meal" |
| Populated | Meals exist | List of meal cards with fed/not-fed status |
| All Fed | All meals for today are logged | Banner: "All meals complete for today!" with checkmark |
| Transition Active | Food transition in progress | Transition progress section visible at top |
| Error | Database read fails | Toast: "Could not load feeding schedule." |

**Interactions:**
- Tap "Fed" toggle: Log the meal as fed with current timestamp; toggle changes to checkmark with green fill
- Tap meal card: Open Edit Meal modal
- Tap "+": Open Add Meal modal
- Swipe left on meal card: Reveal "Delete" action
- Tap "Dietary Info": Open dietary information editor
- Tap transition progress bar: Open transition detail view

**Transitions/Animations:**
- "Fed" toggle animates from empty circle to filled checkmark (200ms)
- Transition progress bar fills smoothly (300ms on initial render)

##### Modal: Add/Edit Meal

**Layout:**
- Bottom sheet
- Form fields:
  1. Meal Time (time picker, required)
  2. Food Name/Brand (text input, required, max 200 chars)
  3. Portion Size (numeric input, required, min: 0.01, max: 9999)
  4. Portion Unit (picker: cups, oz, grams, tablespoons, cans, scoops, pieces, custom; required)
  5. Meal Label (picker: breakfast, lunch, dinner, snack, supplement, custom; optional)
  6. Reminder (toggle, default on)
  7. Notes (single-line text, optional, max 500 chars)

##### Modal: Dietary Info

**Layout:**
- Full-screen modal
- Form fields:
  1. Allergies (tag input, add items one at a time, max 20 items, each max 100 chars)
  2. Dietary Restrictions (tag input, max 20 items, each max 100 chars)
  3. Special Instructions (multiline text, max 2000 chars)

##### Modal: Food Transition

**Layout:**
- Full-screen modal
- Form fields:
  1. Previous Food (text input, required, max 200 chars)
  2. New Food (text input, required, max 200 chars)
  3. Start Date (date picker, required, defaults to today)
  4. Transition Duration (picker: 7, 10, 14 days; default 10)
  5. Notes (multiline text, optional, max 1000 chars)
- Preview section showing the daily ratio schedule based on selected duration

#### 3.6 Data Requirements

##### Entity: FeedingSchedule

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this schedule belongs to |
| meal_time | string | Required, HH:MM format | None | Scheduled meal time |
| food_name | string | Required, max 200 chars, trimmed | None | Food brand or type name |
| portion_size | float | Required, min: 0.01, max: 9999 | None | Portion amount |
| portion_unit | enum | Required. One of: cups, oz, grams, tablespoons, cans, scoops, pieces, custom | None | Unit of portion |
| portion_unit_custom | string | Max 50 chars. Required if portion_unit = custom | null | Custom portion unit |
| meal_label | enum | One of: breakfast, lunch, dinner, snack, supplement, custom, null | null | Optional meal type label |
| reminder_enabled | boolean | - | true | Whether meal reminder is active |
| notes | string | Max 500 chars | null | Feeding instructions or notes |
| sort_order | integer | Min: 0 | 0 | Order within the daily schedule |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: FeedingLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| schedule_id | string | Required, references FeedingSchedule.id | None | The scheduled meal that was fed |
| pet_id | string | Required, references Pet.id | None | The pet (denormalized for cross-pet queries) |
| fed_at | datetime | Required | Current timestamp | When the meal was actually fed |
| date | date | Required | Today | Calendar date for grouping |
| note | string | Max 200 chars | null | Optional note |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

##### Entity: DietaryInfo

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id, unique (1 per pet) | None | The pet |
| allergies | string | JSON array of strings, max 20 items, each max 100 chars | "[]" | Known food allergies |
| restrictions | string | JSON array of strings, max 20 items, each max 100 chars | "[]" | Dietary restrictions |
| special_instructions | string | Max 2000 chars | null | Special feeding instructions |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: FoodTransition

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet |
| previous_food | string | Required, max 200 chars | None | Food being transitioned from |
| new_food | string | Required, max 200 chars | None | Food being transitioned to |
| start_date | date | Required | Today | Start of the transition |
| duration_days | integer | Required. One of: 7, 10, 14 | 10 | Length of transition period |
| status | enum | One of: active, completed, cancelled | active | Transition status |
| notes | string | Max 1000 chars | null | Additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- FeedingSchedule belongs to Pet (many-to-one via pet_id)
- FeedingLog belongs to FeedingSchedule (many-to-one via schedule_id)
- FeedingLog belongs to Pet (many-to-one via pet_id)
- DietaryInfo belongs to Pet (one-to-one via pet_id)
- FoodTransition belongs to Pet (many-to-one via pet_id)

**Indexes:**
- FeedingSchedule: pet_id - per-pet listing
- FeedingSchedule: (pet_id, meal_time) - sorted schedule display
- FeedingLog: (schedule_id, date) - daily completion check
- FeedingLog: (pet_id, date) - cross-schedule daily view
- DietaryInfo: pet_id (unique) - one record per pet
- FoodTransition: (pet_id, status) - active transitions

**Validation Rules:**
- meal_time: Required, valid HH:MM format
- food_name: Must not be empty after trimming
- portion_size: Required, must be > 0
- No duplicate meal times for the same pet (warning, non-blocking)
- FoodTransition: previous_food and new_food must differ

**Example Data:**

```
{
  "id": "fs-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "meal_time": "07:30",
  "food_name": "Blue Buffalo Life Protection (Chicken & Brown Rice)",
  "portion_size": 1.5,
  "portion_unit": "cups",
  "portion_unit_custom": null,
  "meal_label": "breakfast",
  "reminder_enabled": true,
  "notes": "Mix with 2 tablespoons warm water",
  "sort_order": 0,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Daily Feeding Completion Check

**Purpose:** Determine whether all scheduled meals have been logged for a given day.

**Inputs:**
- pet_id: string
- date: date

**Logic:**

```
1. QUERY all FeedingSchedules WHERE pet_id = pet_id
2. FOR each schedule:
     a. CHECK if a FeedingLog exists WHERE schedule_id = schedule.id AND date = date
     b. IF exists THEN status = "fed"
     c. ELSE IF schedule.meal_time has passed for today THEN status = "missed"
     d. ELSE status = "pending"
3. all_complete = true if every schedule has status "fed"
4. RETURN { schedules_with_status, all_complete, fed_count, total_count }
```

**Edge Cases:**
- No schedules exist: all_complete = true (vacuously true, nothing to feed)
- Meal time not yet reached: Status is "pending", not "missed"
- Multiple feeding logs for same schedule and date: Use the first one; ignore duplicates

##### Food Transition Ratio Calculation

**Purpose:** Calculate the old/new food ratio for a given day during a food transition.

**Inputs:**
- transition: FoodTransition entity
- current_date: date

**Logic:**

```
1. elapsed_days = current_date - transition.start_date (in days, 0-indexed)
2. IF elapsed_days < 0 THEN RETURN "Not started yet"
3. IF elapsed_days >= transition.duration_days THEN RETURN { old_pct: 0, new_pct: 100, phase: "complete" }
4. For a 10-day transition:
     - Days 0-2 (phase 1): old 75%, new 25%
     - Days 3-5 (phase 2): old 50%, new 50%
     - Days 6-8 (phase 3): old 25%, new 75%
     - Day 9+  (phase 4): old 0%, new 100%
5. For a 7-day transition:
     - Days 0-1: old 75%, new 25%
     - Days 2-3: old 50%, new 50%
     - Days 4-5: old 25%, new 75%
     - Day 6:    old 0%, new 100%
6. For a 14-day transition:
     - Days 0-3:   old 75%, new 25%
     - Days 4-7:   old 50%, new 50%
     - Days 8-11:  old 25%, new 75%
     - Days 12-13: old 0%, new 100%
7. RETURN { old_pct, new_pct, phase, elapsed_days, total_days, progress_pct }
```

**Formulas:**
- progress_pct = (elapsed_days / duration_days) * 100
- Each duration divides into 4 roughly equal phases

**Edge Cases:**
- Transition start date is in the future: Show "Starts in X days"
- Transition completed: Automatically set status to "completed"
- Multiple active transitions for one pet: Only 1 active transition allowed per pet; new transition cancels the previous one

##### Feeding Reminder Scheduling

**Purpose:** Schedule local notifications for meal times.

**Logic:**

```
1. FOR each FeedingSchedule WHERE reminder_enabled = true:
     a. SCHEDULE repeating daily notification:
        - Title: "[Pet Name] - Meal Time"
        - Body: "[Meal Label]: [Food Name] - [Portion Size] [Portion Unit]"
        - Fire time: schedule.meal_time daily
        - ID: schedule.id
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Meal time ascending (earliest first)
- **Available sort options:** Meal time, Food name (A-Z), Meal label
- **Filter options:** None (all meals shown by default)
- **Search:** food_name - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save meal. Please try again." | User taps retry; form data preserved |
| Food name left blank | Inline validation: "Food name is required" | User fills in the field |
| Portion size is zero or negative | Inline validation: "Portion must be greater than 0" | User corrects the value |
| Duplicate meal time for same pet | Warning (non-blocking): "You already have a meal at this time. Save anyway?" | User confirms or changes the time |
| Feeding log write fails | Toast: "Could not log meal. Please try again." | "Fed" button reverts to unfed state |
| Notification scheduling fails | Meal is saved without reminder; toast: "Meal saved, but reminder could not be set." | User can edit and re-enable reminder |

**Validation Timing:**
- Field-level validation runs on blur
- Duplicate meal time check runs on save (non-blocking warning)
- Food transition validation runs on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists,
   **When** the user adds a meal at 7:30 AM, "Blue Buffalo (Chicken)", 1.5 cups, with reminder on,
   **Then** the meal appears in the schedule, and a daily reminder is set for 7:30 AM.

2. **Given** 2 meals are scheduled for Luna today (7:30 AM and 5:30 PM),
   **When** the user taps "Fed" on the 7:30 AM meal at 7:45 AM,
   **Then** the meal card shows a checkmark with "Fed at 7:45 AM", and the summary shows "1 of 2 fed".

3. **Given** all meals for today are logged as fed,
   **When** the user views the feeding screen,
   **Then** a banner shows "All meals complete for today!" with a checkmark.

4. **Given** a food transition is started from "Brand A" to "Brand B" (10-day duration),
   **When** the user views the feeding screen on day 4,
   **Then** the transition progress shows "Day 4 of 10 - 50% Brand A / 50% Brand B".

**Edge Cases:**

5. **Given** dietary allergies are set to ["chicken", "soy"],
   **When** the user views the feeding screen,
   **Then** a banner at the top shows "Allergic to: chicken, soy" with a warning icon.

6. **Given** a meal time has passed and the user did not tap "Fed",
   **When** the user views the feeding screen after the meal time,
   **Then** the meal card shows "Missed" status with the scheduled time.

**Negative Tests:**

7. **Given** the add meal form is open,
   **When** the user leaves the food name blank and taps Save,
   **Then** the system shows "Food name is required"
   **And** no meal record is created.

8. **Given** the user starts a food transition,
   **When** the previous food and new food names are the same,
   **Then** the system shows "Previous and new food must be different"
   **And** no transition is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| returns all_complete when all meals fed | 2 schedules, 2 logs for today | all_complete: true, fed_count: 2 |
| returns not complete when 1 meal unfed | 2 schedules, 1 log for today | all_complete: false, fed_count: 1 |
| returns pending for future meal time | meal_time: 20:00, current: 10:00 | status: "pending" |
| returns missed for past unfed meal | meal_time: 08:00, current: 14:00, no log | status: "missed" |
| calculates transition ratio day 0 of 10 | elapsed: 0, duration: 10 | old: 75%, new: 25% |
| calculates transition ratio day 5 of 10 | elapsed: 5, duration: 10 | old: 50%, new: 50% |
| calculates transition ratio day 8 of 10 | elapsed: 8, duration: 10 | old: 25%, new: 75% |
| calculates transition ratio day 10 of 10 | elapsed: 10, duration: 10 | old: 0%, new: 100%, complete |
| validates food_name not empty | food_name: "  " | validation error |
| validates portion_size positive | portion_size: 0 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add meal and log it as fed | 1. Add meal at 08:00, 2. Tap "Fed" | Feeding log created with current timestamp, card shows checkmark |
| Delete meal and verify logs cleaned | 1. Add meal with 5 feeding logs, 2. Delete meal | Meal and all associated logs removed |
| Food transition progress updates daily | 1. Start 10-day transition, 2. Check on days 1, 4, 7, 10 | Ratios update correctly: 75/25, 50/50, 25/75, 0/100 |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User sets up 3-meal schedule for puppy | 1. Add pet (puppy), 2. Add breakfast 7:30 AM, lunch 12:00 PM, dinner 5:30 PM, 3. Log all 3 meals | All 3 meals show as fed, "All meals complete" banner visible, 3 daily reminders scheduled |
| User transitions pet food over 10 days | 1. Start transition from Brand A to Brand B, 2. View progress on day 1, day 5, day 10 | Day 1: 75/25 ratio shown. Day 5: 50/50. Day 10: complete, transition auto-marked as completed. |

---

### PT-007: Exercise & Walk Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-007 |
| **Feature Name** | Exercise & Walk Logging |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a dog owner, I want to log walks and exercise activities with duration and distance, so that I can ensure my pet gets adequate daily exercise and identify patterns in their activity levels.

**Secondary:**
> As a dog training enthusiast, I want to see weekly and monthly exercise summaries with charts, so that I can verify I am meeting my pet's recommended daily exercise requirements.

**Tertiary:**
> As a multi-pet household manager, I want to log a single walk that includes multiple pets, so that I do not have to create duplicate entries for a shared activity.

#### 3.3 Detailed Description

Exercise & Walk Logging provides a system for recording physical activities for pets, with an emphasis on dog walks. Users log activities by selecting an activity type (walk, run, hike, swim, fetch, play, training, other), entering the duration (in minutes), optionally recording the distance (in miles or km), selecting the date and time, and adding notes.

The exercise list for each pet shows entries in reverse chronological order with activity type icons, duration, distance, and date. Summary statistics at the top of the screen show the current week's total exercise time and daily average.

Daily exercise goals allow users to set a target duration (in minutes) per day for each pet. The dashboard displays progress toward the daily goal as a circular progress ring. Breed-specific recommended exercise ranges are available as suggested defaults when setting goals. For example: "Golden Retriever: 60-120 minutes/day", "Bulldog: 20-40 minutes/day", "Border Collie: 90-150 minutes/day".

Weekly and monthly summary views show total exercise time per day as a bar chart, average daily duration, total distance, and exercise streak (consecutive days with at least one logged activity). The streak counter resets to 0 if a day passes with no logged exercise.

Multi-pet walks allow the user to tag multiple pets on a single activity entry. The entry appears in each tagged pet's exercise log independently, ensuring each pet's statistics are accurate.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist before exercise can be logged

**External Dependencies:**
- Local storage for persistent data
- Chart rendering capability (bar chart for weekly/monthly summaries)

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Local database is initialized and writable
- Duration and distance input controls are available

#### 3.5 User Interface Requirements

##### Screen: Exercise Log (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Exercise" and a "+" add button on the right
- Daily goal progress ring (if goal is set): circular indicator showing minutes logged vs. goal, with "[X] / [Y] min" label in center
- Summary cards (horizontal scroll): "This Week: [X] min", "Daily Avg: [X] min", "Streak: [X] days", "Total Distance: [X] mi/km"
- Time period selector: "This Week" | "This Month" | "All Time"
- Scrollable vertical list of exercise entries
- Each entry card: activity type icon, activity type label, duration (bold, e.g., "45 min"), distance (if recorded), date and time, multi-pet badge (if other pets were included), note preview (truncated to 1 line)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No exercise entries | Illustration of a leash, message "No exercise logged yet", button "Log a Walk" |
| Populated | Entries exist | Scrollable list with summary cards |
| Goal Met | Daily goal reached | Progress ring fills to 100% and turns green with checkmark |
| Goal Not Set | No daily goal configured | Goal ring hidden; prompt "Set a daily exercise goal" |
| Error | Database read fails | Toast: "Could not load exercise data." |

**Interactions:**
- Tap "+": Open Add Exercise modal
- Tap entry card: Open Exercise Detail view
- Tap progress ring: Open daily goal configuration
- Swipe left on entry: Reveal "Edit" and "Delete" actions
- Tap time period selector: Update summary statistics

**Transitions/Animations:**
- Progress ring animates clockwise on load (500ms ease-out)
- New entry card slides in from right (200ms)
- Streak count increments with a number roll animation (150ms)

##### Screen: Exercise Summary Charts

**Layout:**
- Accessible via "View Charts" link below the summary cards
- Weekly bar chart: 7 bars (Mon-Sun), y-axis = minutes, daily goal shown as a dashed horizontal line
- Monthly bar chart: 28-31 bars (one per day), scrollable horizontally, daily goal line
- Stats panel below charts: total time, average daily time, longest single activity, total distance, exercise days count, rest days count

##### Modal: Add/Edit Exercise

**Layout:**
- Full-screen modal with "Cancel" (left) and "Save" (right) in the header
- Form fields:
  1. Activity Type (icon-grid picker: walk, run, hike, swim, fetch, play, training, other; required)
  2. Duration (numeric input in minutes, required, min: 1, max: 1440)
  3. Distance (numeric input, optional, min: 0.01, max: 999.99)
  4. Distance Unit (toggle: mi / km, defaults to user preference)
  5. Date (date picker, required, defaults to today, must be on or before today)
  6. Start Time (time picker, optional)
  7. Pets (multi-select from active pet list, at least 1 required, defaults to current pet)
  8. Notes (multiline text, optional, max 1000 chars)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New | Adding a new entry | Fields empty except date (today), current pet pre-selected |
| Edit | Editing existing entry | Fields pre-populated |
| Multi-Pet | Multiple pets selected | Pet avatars shown in a row above the form |
| Validation Error | Required field missing | Inline error below offending field |

##### Modal: Daily Exercise Goal

**Layout:**
- Bottom sheet
- Form fields:
  1. Daily Goal (numeric input in minutes, required, min: 1, max: 1440)
  2. Breed suggestion (if breed is in lookup table): "Recommended for [Breed]: [X]-[Y] minutes/day" with "Use Suggested" button
- "Save" and "Remove Goal" buttons

#### 3.6 Data Requirements

##### Entity: ExerciseLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| group_id | string | UUID, shared across multi-pet entries | Auto | Groups entries that represent the same activity with multiple pets |
| pet_id | string | Required, references Pet.id | None | The pet this entry belongs to |
| activity_type | enum | Required. One of: walk, run, hike, swim, fetch, play, training, other | None | Type of exercise activity |
| duration_minutes | integer | Required, min: 1, max: 1440 | None | Duration in minutes |
| distance | float | Min: 0.01, Max: 999.99 | null | Distance covered |
| distance_unit | enum | One of: mi, km | mi | Distance unit |
| date | date | Required, must be on or before today | Today | Date of the exercise |
| start_time | string | HH:MM format | null | Optional start time |
| notes | string | Max 1000 chars | null | Additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: ExerciseGoal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id, unique (1 per pet) | None | The pet this goal belongs to |
| daily_goal_minutes | integer | Required, min: 1, max: 1440 | None | Target daily exercise in minutes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- ExerciseLog belongs to Pet (many-to-one via pet_id)
- ExerciseLog grouped with other ExerciseLogs via group_id (multi-pet walks)
- ExerciseGoal belongs to Pet (one-to-one via pet_id)

**Indexes:**
- ExerciseLog: pet_id - per-pet listing
- ExerciseLog: (pet_id, date) - daily exercise queries
- ExerciseLog: group_id - multi-pet activity grouping
- ExerciseLog: date - time-range filtering
- ExerciseGoal: pet_id (unique) - one goal per pet

**Validation Rules:**
- activity_type: Required, must be valid enum
- duration_minutes: Required, must be >= 1
- distance: If provided, must be > 0
- date: Required, must be on or before today
- At least 1 pet must be selected for multi-pet entries

**Example Data:**

```
{
  "id": "ex-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "group_id": "grp-f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "activity_type": "walk",
  "duration_minutes": 45,
  "distance": 2.3,
  "distance_unit": "mi",
  "date": "2026-03-06",
  "start_time": "07:30",
  "notes": "Morning walk around the park. Luna chased a squirrel.",
  "created_at": "2026-03-06T08:15:00Z",
  "updated_at": "2026-03-06T08:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Daily Exercise Progress

**Purpose:** Calculate progress toward the daily exercise goal.

**Inputs:**
- pet_id: string
- date: date

**Logic:**

```
1. QUERY SUM(duration_minutes) FROM ExerciseLogs WHERE pet_id = pet_id AND date = date
2. total_minutes = result (0 if no entries)
3. QUERY ExerciseGoal WHERE pet_id = pet_id
4. IF goal exists THEN:
     progress_pct = MIN((total_minutes / goal.daily_goal_minutes) * 100, 100)
     goal_met = total_minutes >= goal.daily_goal_minutes
5. ELSE:
     progress_pct = null (no goal set)
     goal_met = null
6. RETURN { total_minutes, goal_minutes, progress_pct, goal_met }
```

**Formulas:**
- progress_pct = MIN((total_minutes / daily_goal_minutes) * 100, 100)

**Edge Cases:**
- No goal set: Return progress_pct = null, do not display progress ring
- Goal is 0: Should not occur (min: 1), but if it does, return 100%
- Overachievement: Cap at 100% for progress ring, but show actual total (e.g., "75 / 60 min")

##### Exercise Streak Calculation

**Purpose:** Calculate the number of consecutive days with at least one logged exercise entry.

**Inputs:**
- pet_id: string

**Logic:**

```
1. QUERY DISTINCT dates FROM ExerciseLogs WHERE pet_id = pet_id ORDER BY date DESC
2. SET streak = 0
3. SET check_date = today
4. IF no entry exists for today THEN:
     a. IF current time is before 11:59 PM THEN check_date = yesterday (grace: today is not over yet)
     b. ELSE streak = 0, RETURN
5. WHILE an entry exists for check_date:
     streak = streak + 1
     check_date = check_date - 1 day
6. RETURN { streak, last_exercise_date }
```

**Edge Cases:**
- No exercise ever logged: streak = 0
- Exercise logged today only: streak = 1
- Gap of 1 day breaks the streak (no grace period for past days)
- Today has no entry but it is before midnight: Check from yesterday (today is still in progress)

##### Exercise Summary Statistics

**Purpose:** Compute aggregate exercise stats for a time period.

**Inputs:**
- pet_id: string
- period: enum (this_week, this_month, all_time)

**Logic:**

```
1. DETERMINE date range based on period:
     - this_week: Monday of current week to today
     - this_month: 1st of current month to today
     - all_time: earliest entry date to today
2. QUERY ExerciseLogs WHERE pet_id = pet_id AND date WITHIN range
3. total_minutes = SUM(duration_minutes)
4. total_distance = SUM(distance) (converted to user's preferred unit)
5. entry_count = COUNT(entries)
6. exercise_days = COUNT(DISTINCT date)
7. days_in_period = date range length
8. rest_days = days_in_period - exercise_days
9. daily_avg = total_minutes / days_in_period
10. longest_activity = MAX(duration_minutes)
11. RETURN { total_minutes, total_distance, entry_count, exercise_days, rest_days, daily_avg, longest_activity }
```

**Formulas:**
- daily_avg = total_minutes / days_in_period
- rest_days = days_in_period - exercise_days

**Edge Cases:**
- No entries in period: All values = 0
- Period has 0 days (edge case for "this_week" on Monday with no data): Return 0 for daily_avg

##### Multi-Pet Activity Handling

**Purpose:** Create linked exercise entries when multiple pets share an activity.

**Logic:**

```
1. GENERATE a single group_id (UUID)
2. FOR each selected pet_id:
     CREATE an ExerciseLog with:
       - Same group_id, activity_type, duration_minutes, distance, distance_unit, date, start_time, notes
       - Unique id per entry
       - pet_id set to the current pet
3. Each pet's statistics are updated independently
4. ON DELETE of any entry in a group:
     - Only delete the specific entry (do not cascade to other pets' entries)
     - Show info: "This activity was shared with [other pet names]. Only [current pet]'s entry will be removed."
5. ON EDIT of any entry in a group:
     - Ask: "Apply changes to all pets in this activity?" (Yes/No)
     - If Yes: Update all entries with the same group_id
     - If No: Update only the current entry (break the link for edited fields)
```

##### Breed-Specific Exercise Recommendations

**Purpose:** Suggest daily exercise goals based on breed.

**Inputs:**
- species: enum
- breed: string

**Logic:**

```
1. IF species != "dog" THEN RETURN null (exercise recommendations primarily apply to dogs)
2. LOOKUP breed in exercise recommendation table:
     - Low energy (Bulldog, Basset Hound, Shih Tzu): 20-40 min/day
     - Moderate energy (Golden Retriever, Labrador, Beagle): 60-120 min/day
     - High energy (Border Collie, Australian Shepherd, Husky): 90-150 min/day
     - Very high energy (Belgian Malinois, Vizsla, Weimaraner): 120-180 min/day
3. IF breed not found THEN RETURN default: 30-60 min/day
4. RETURN { min_minutes, max_minutes, energy_level }
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Date newest first, then start_time descending
- **Available sort options:** Date (newest/oldest), Duration (longest/shortest), Activity type
- **Filter options:** All, This Week, This Month, By activity type
- **Search:** notes field - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save exercise entry. Please try again." | User taps retry; form data preserved |
| Duration is zero | Inline validation: "Duration must be at least 1 minute" | User corrects the value |
| No pets selected | Inline validation: "At least one pet must be selected" | User selects a pet |
| Distance is negative | Inline validation: "Distance must be greater than 0" | User corrects the value |
| Chart rendering fails | Fallback to list view only; toast: "Could not render exercise charts" | User can still view and manage entries |
| Multi-pet delete confirmation | Dialog: "This activity was shared with [names]. Only [pet]'s entry will be removed." | User confirms or cancels |

**Validation Timing:**
- Field-level validation runs on blur
- Multi-pet selection validated on save
- Duration minimum validated on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists with a daily goal of 60 minutes,
   **When** the user logs a 45-minute walk, 2.3 miles,
   **Then** the entry appears in the log, the progress ring shows 75% (45/60), and summary stats update.

2. **Given** Luna has exercised every day for the last 5 days,
   **When** the user views the exercise screen,
   **Then** the streak counter shows "5 days".

3. **Given** the user selects both Luna and Max for a walk,
   **When** the user logs a 30-minute walk,
   **Then** separate entries appear in both Luna's and Max's exercise logs, sharing the same group_id.

4. **Given** a weekly bar chart is displayed with daily goal of 60 minutes,
   **When** the user views the chart,
   **Then** each day's bar reflects the total minutes logged, and a dashed line at 60 marks the goal.

**Edge Cases:**

5. **Given** Luna is a Golden Retriever with no exercise goal set,
   **When** the user opens the goal configuration,
   **Then** a suggestion appears: "Recommended for Golden Retriever: 60-120 minutes/day" with a "Use Suggested" button.

6. **Given** Luna has no exercise logged today but it is 2:00 PM,
   **When** the user views the streak (yesterday was the last logged day),
   **Then** the streak counts from yesterday (today is still in progress) and does not reset.

**Negative Tests:**

7. **Given** the add exercise form is open,
   **When** the user enters duration as 0 and taps Save,
   **Then** the system shows "Duration must be at least 1 minute"
   **And** no entry is created.

8. **Given** the add exercise form is open,
   **When** the user deselects all pets and taps Save,
   **Then** the system shows "At least one pet must be selected"
   **And** no entry is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates 75% daily progress | logged: 45 min, goal: 60 min | progress: 75% |
| caps progress at 100% | logged: 90 min, goal: 60 min | progress: 100% |
| returns null progress when no goal | logged: 45 min, goal: null | progress: null |
| calculates streak of 5 days | entries on 5 consecutive days ending today | streak: 5 |
| streak resets after gap | entries on days 1-3 and 5 (gap on day 4) | streak: 1 (from day 5 only) |
| streak grace for today in progress | no entry today, entry yesterday, current time 2PM | streak counts from yesterday |
| calculates weekly summary | 5 entries totaling 200 min, 8.5 mi, over 7 days | total: 200, avg: 28.6/day, distance: 8.5 |
| returns low energy recommendation | breed: "Bulldog" | min: 20, max: 40 |
| returns high energy recommendation | breed: "Border Collie" | min: 90, max: 150 |
| returns default for unknown breed | breed: "Mixed" | min: 30, max: 60 |
| validates duration minimum | duration: 0 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log walk and verify goal progress | 1. Set goal to 60 min, 2. Log 30-min walk, 3. Check progress | Progress ring shows 50% |
| Multi-pet walk creates linked entries | 1. Log walk for Luna + Max, 2. Check Luna's log, 3. Check Max's log | Both logs show the walk with same group_id |
| Delete one pet's entry from multi-pet walk | 1. Log multi-pet walk, 2. Delete Luna's entry | Luna's entry removed; Max's entry remains |
| Weekly chart reflects logged data | 1. Log exercises on 3 different days, 2. View weekly chart | 3 bars with correct heights, 4 empty bars |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Active dog owner tracks a week of walks | 1. Set 60-min daily goal for Luna, 2. Log walks on 5 of 7 days, 3. View weekly summary | Bar chart shows 5 active days and 2 rest days. Streak shows 5 (or less if gap exists). Daily average reflects total / 7. |
| User logs shared walk for 3 dogs | 1. Add 3 dogs, 2. Log a 45-min walk selecting all 3, 3. View each dog's exercise log | Each dog's log shows the same 45-min walk. Each dog's stats include the 45 minutes. |

---

### PT-008: Grooming Schedule

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-008 |
| **Feature Name** | Grooming Schedule |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to log grooming activities (baths, nail trims, haircuts, ear cleaning, teeth brushing) with dates and set reminders for the next grooming, so that I maintain a regular grooming routine without relying on memory.

**Secondary:**
> As a multi-pet household manager, I want to see all upcoming grooming tasks across all pets in one view, so that I can batch grooming sessions and keep every pet on schedule.

#### 3.3 Detailed Description

Grooming Schedule provides a system for tracking and scheduling regular grooming activities for each pet. Users log grooming events by selecting a grooming type (bath, nail_trim, haircut, ear_cleaning, teeth_brushing, flea_treatment, deshedding, other), recording the date it was performed, optionally noting the groomer or salon (if professional), the cost (if applicable), and any observations.

Each grooming type can have a recurring interval. For example, a user might set "Bath every 4 weeks" or "Nail trim every 2 weeks". The system calculates the next due date based on the most recent log of that type plus the interval. Due dates follow the same color-coded badge system as vaccinations: green (not due), yellow (due within 7 days), red (overdue).

The grooming overview for each pet shows all grooming types in a grid layout, with each card displaying the grooming type icon, the last performed date, and the next due date with a status badge. Tapping a card opens the history log for that grooming type.

Grooming costs integrate with the Expense Tracking feature (PT-010), automatically categorizing grooming expenses under the "Grooming" category.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist before grooming can be tracked

**External Dependencies:**
- Local notification system for grooming reminders
- Local storage for persistent data

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Grooming Overview (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Grooming" and a "Log Grooming" button on the right
- Grid of grooming type cards (2 columns, 4 rows for 8 types)
- Each card shows: grooming type icon (large, centered), grooming type label, "Last: [date]" or "Never", "Next: [date]" with color-coded status badge (green/yellow/red/gray), and the recurring interval (e.g., "Every 4 weeks")
- Cards without any history show "Set up" prompt instead of dates

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No grooming entries for any type | All cards show "Set up" prompt with grayed-out icons |
| Partial Setup | Some grooming types have entries | Configured cards show dates and badges; unconfigured cards show "Set up" |
| All Current | All configured grooming types are up to date | All active cards show green badges |
| Some Overdue | One or more types are overdue | Overdue cards show red badges with warning accent |
| Error | Database read fails | Toast: "Could not load grooming data." |

**Interactions:**
- Tap card: Navigate to Grooming History screen for that type
- Tap "Log Grooming": Open Add Grooming Log modal (with type selector)
- Long press card: Quick action sheet: "Log Now", "Set Interval", "View History"
- Tap "Set up" on unconfigured card: Open interval configuration for that type

**Transitions/Animations:**
- Status badge color transitions smoothly when crossing a threshold (200ms)
- New log entry causes the card to briefly pulse (150ms scale animation)

##### Screen: Grooming History (per type, per pet)

**Layout:**
- Top navigation bar showing "[Grooming Type] History" and a "+" add button
- Next due banner: "Next [grooming type] due: [date]" with status badge
- Interval display: "Scheduled every [X] weeks"
- Scrollable list of past grooming entries, newest first
- Each entry: date (bold), groomer name (if set), cost (if set), notes preview

##### Modal: Add/Edit Grooming Log

**Layout:**
- Bottom sheet (compact form)
- Form fields:
  1. Grooming Type (picker: bath, nail_trim, haircut, ear_cleaning, teeth_brushing, flea_treatment, deshedding, other; required)
  2. Date Performed (date picker, required, defaults to today, must be on or before today)
  3. Groomer/Salon (text input, optional, max 200 chars, autocomplete from history)
  4. Cost (currency input, optional, min: 0, max: 9999.99)
  5. Recurring Interval (picker: none, 1 week, 2 weeks, 3 weeks, 4 weeks, 6 weeks, 8 weeks, 12 weeks, custom; optional)
  6. Custom Interval Days (integer input, min: 1, max: 365; visible only if interval = custom)
  7. Reminder (toggle, default on if interval is set)
  8. Reminder Lead Time (picker: 1 day, 3 days, 1 week; default 1 day; visible only if reminder on)
  9. Notes (multiline text, optional, max 1000 chars)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New | Adding a new entry | Fields empty except date (today) |
| Edit | Editing existing entry | Fields pre-populated |
| Validation Error | Required field missing | Inline error below offending field |

#### 3.6 Data Requirements

##### Entity: GroomingRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this record belongs to |
| grooming_type | enum | Required. One of: bath, nail_trim, haircut, ear_cleaning, teeth_brushing, flea_treatment, deshedding, other | None | Type of grooming performed |
| date_performed | date | Required, must be on or before today | Today | Date the grooming was performed |
| groomer_name | string | Max 200 chars | null | Professional groomer or salon name |
| cost | float | Min: 0, Max: 9999.99 | null | Cost of grooming session |
| notes | string | Max 1000 chars | null | Additional notes or observations |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: GroomingInterval

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet |
| grooming_type | enum | Required, same enum as GroomingRecord | None | Grooming type this interval applies to |
| interval_days | integer | Required, min: 1, max: 365 | None | Days between grooming sessions |
| reminder_enabled | boolean | - | true | Whether reminders are active |
| reminder_lead_days | integer | One of: 1, 3, 7 | 1 | Days before due date to fire reminder |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- GroomingRecord belongs to Pet (many-to-one via pet_id)
- GroomingInterval belongs to Pet (many-to-one via pet_id)
- GroomingInterval is unique per (pet_id, grooming_type) - one interval setting per grooming type per pet

**Indexes:**
- GroomingRecord: pet_id - per-pet listing
- GroomingRecord: (pet_id, grooming_type) - type-specific history
- GroomingRecord: (pet_id, grooming_type, date_performed) - next-due calculation
- GroomingInterval: (pet_id, grooming_type) - unique, interval lookup

**Validation Rules:**
- grooming_type: Required, must be valid enum
- date_performed: Required, must be on or before today
- cost: If provided, must be >= 0
- interval_days: If provided, must be >= 1
- (pet_id, grooming_type) must be unique for GroomingInterval

**Example Data:**

```
{
  "id": "gr-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "grooming_type": "bath",
  "date_performed": "2026-02-15",
  "groomer_name": null,
  "cost": null,
  "notes": "Used oatmeal shampoo. Luna was cooperative.",
  "created_at": "2026-02-15T18:00:00Z",
  "updated_at": "2026-02-15T18:00:00Z"
}
```

```
{
  "id": "gi-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "grooming_type": "bath",
  "interval_days": 28,
  "reminder_enabled": true,
  "reminder_lead_days": 1,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Next Due Date Calculation

**Purpose:** Calculate when a grooming type is next due based on the last performed date and the configured interval.

**Inputs:**
- pet_id: string
- grooming_type: enum

**Logic:**

```
1. QUERY GroomingInterval WHERE pet_id = pet_id AND grooming_type = grooming_type
2. IF no interval configured THEN RETURN { next_due: null, status: "no_schedule" }
3. QUERY most recent GroomingRecord WHERE pet_id = pet_id AND grooming_type = grooming_type
     ORDER BY date_performed DESC LIMIT 1
4. IF no record exists THEN RETURN { next_due: null, status: "never_performed" }
5. next_due = last_record.date_performed + interval.interval_days
6. days_until_due = next_due - today
7. IF days_until_due < 0 THEN status = "overdue" (red)
8. ELSE IF days_until_due <= 7 THEN status = "due_soon" (yellow)
9. ELSE status = "up_to_date" (green)
10. RETURN { next_due, status, days_until_due, last_performed: last_record.date_performed }
```

**Edge Cases:**
- No interval set: Status is "no_schedule", no badge or reminder
- Never performed with interval set: Status is "never_performed", show "Set up" prompt
- Multiple records on the same day: Use the most recent by created_at

##### Grooming Reminder Scheduling

**Purpose:** Schedule notifications for upcoming grooming tasks.

**Logic:**

```
1. COMPUTE next_due using Next Due Date Calculation
2. IF next_due IS null OR status = "no_schedule" THEN RETURN
3. IF interval.reminder_enabled = false THEN CANCEL notifications, RETURN
4. fire_date = next_due - interval.reminder_lead_days
5. IF fire_date <= today THEN fire immediately
6. SCHEDULE local notification:
     - Title: "[Pet Name] - Grooming Due"
     - Body: "[Grooming Type label] is due on [next_due formatted]"
     - Fire date: fire_date at 9:00 AM local time
     - ID: "{pet_id}_{grooming_type}_grooming"
```

##### Grooming Cost Aggregation

**Purpose:** Sum grooming costs for expense tracking integration.

**Inputs:**
- pet_id: string
- start_date: date (optional)
- end_date: date (optional)

**Logic:**

```
1. QUERY all GroomingRecords WHERE pet_id = pet_id AND cost IS NOT null
2. IF start_date provided THEN filter WHERE date_performed >= start_date
3. IF end_date provided THEN filter WHERE date_performed <= end_date
4. total_cost = SUM(cost)
5. session_count = COUNT(records with non-null cost)
6. RETURN { total_cost, session_count }
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Grooming type cards sorted by status priority (overdue first, due soon second, up to date third, no schedule last)
- **History sort:** Date performed, newest first
- **Filter options:** All types, specific type
- **Search:** groomer_name, notes - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save grooming record. Please try again." | User taps retry; form data preserved |
| Grooming type not selected | Inline validation: "Please select a grooming type" | User selects a type |
| Cost entered as negative | Inline validation: "Cost must be $0 or more" | User corrects the amount |
| Interval set to 0 | Inline validation: "Interval must be at least 1 day" | User corrects the value |
| Notification scheduling fails | Record saved without reminder; toast: "Grooming logged, but reminder could not be set." | User can edit interval settings |

**Validation Timing:**
- Field-level validation runs on blur
- Grooming type required validation runs on save
- Cost and interval validated on blur

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists,
   **When** the user logs a bath on 2026-02-15 and sets a 4-week interval with reminder,
   **Then** the bath card shows "Last: Feb 15", "Next: Mar 15", a green badge, and a reminder is scheduled for Mar 14.

2. **Given** a nail trim was last performed 3 weeks ago with a 2-week interval,
   **When** the user views the grooming overview,
   **Then** the nail trim card shows a red "Overdue" badge.

3. **Given** a haircut cost $65 at "Happy Paws Grooming",
   **When** the user logs the grooming with groomer and cost,
   **Then** the entry appears in the haircut history with "$65.00" and "Happy Paws Grooming", and the cost is available for expense tracking.

**Edge Cases:**

4. **Given** no grooming has ever been logged for Luna,
   **When** the user views the grooming overview,
   **Then** all 8 grooming type cards show "Set up" prompts with grayed-out icons.

5. **Given** a flea treatment interval is set but no treatment has been logged,
   **When** the user views the grooming overview,
   **Then** the flea treatment card shows "Never performed" with a prompt to "Log first treatment".

**Negative Tests:**

6. **Given** the add grooming form is open,
   **When** the user does not select a grooming type and taps Save,
   **Then** the system shows "Please select a grooming type"
   **And** no record is created.

7. **Given** the add grooming form is open,
   **When** the user enters a negative cost,
   **Then** the system shows "Cost must be $0 or more"
   **And** no record is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates next due date correctly | last: Feb 15, interval: 28 days | next_due: Mar 15 |
| returns overdue for past due date | next_due: Mar 1, today: Mar 6 | status: "overdue" |
| returns due_soon within 7 days | next_due: Mar 10, today: Mar 6 | status: "due_soon" |
| returns up_to_date for > 7 days | next_due: Apr 15, today: Mar 6 | status: "up_to_date" |
| returns no_schedule when no interval | no interval configured | status: "no_schedule" |
| returns never_performed with interval but no logs | interval: 28 days, no records | status: "never_performed" |
| aggregates grooming costs | costs: [65, 30, null, 45] | total: 140, session_count: 3 |
| validates interval minimum | interval: 0 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log grooming and verify overview update | 1. Log a bath today, 2. View overview | Bath card shows today's date and next due date with correct badge |
| Set interval and verify reminder | 1. Set bath interval to 28 days, 2. Log a bath | Reminder scheduled for 27 days from now (1-day lead) |
| Delete grooming entry and verify next due recalculates | 1. Log 2 baths (Feb 1, Feb 15), 2. Delete Feb 15 entry | Next due recalculates from Feb 1 |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User sets up full grooming schedule | 1. Configure intervals for bath (4 wk), nails (2 wk), teeth (1 wk), 2. Log initial sessions for each | Overview shows 3 configured cards with green badges and next due dates. 5 unconfigured cards show "Set up". |
| Grooming becomes overdue | 1. Log a nail trim with 2-week interval, 2. Wait 15 days (or manually set last date to 15 days ago) | Nail trim card shows red "Overdue" badge. Reminder notification fires. |

---

### PT-009: Training Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-009 |
| **Feature Name** | Training Log |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a dog training enthusiast, I want to log training sessions with the commands practiced, duration, and results, so that I can track my pet's learning progress and maintain a training history.

**Secondary:**
> As a pet owner, I want to track which commands my pet has mastered, which are in progress, and which are new, so that I can see a clear picture of their training advancement.

**Tertiary:**
> As a foster parent, I want to record behavioral observations during training, so that I can provide the adopting family with an accurate assessment of the pet's training level.

#### 3.3 Detailed Description

Training Log provides a structured system for tracking pet training sessions and command mastery progression. Users create training sessions by recording the date, duration, location (home, park, class, other), overall session rating (1-5 stars), and notes. Within each session, users log individual commands practiced with their success rate.

The command library maintains a list of commands the user is tracking for each pet. Each command has a name (e.g., "Sit", "Stay", "Come", "Heel", "Leave it"), a category (obedience, tricks, agility, behavioral, other), and a mastery level: "New" (just introduced, < 30% success rate), "Learning" (inconsistent, 30-69% success rate), "Proficient" (reliable in familiar settings, 70-89% success rate), or "Mastered" (reliable in any setting, >= 90% success rate). Mastery level is automatically calculated from the average success rate across the last 5 sessions in which the command was practiced.

The training dashboard shows an overview of the command library with a visual breakdown: X mastered, Y proficient, Z learning, W new. A progress chart tracks total commands mastered over time. Each command card shows the command name, category badge, mastery level badge, and a mini sparkline of recent success rates.

Session history displays past training sessions in reverse chronological order with duration, location, rating, and the number of commands practiced.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist before training can be tracked

**External Dependencies:**
- Local storage for persistent data

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Training Dashboard (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Training" and a "New Session" button on the right
- Mastery summary bar: 4 colored segments showing count per mastery level (Mastered = green, Proficient = blue, Learning = yellow, New = gray)
- Total: "[X] commands tracked"
- Command grid (2 columns) showing all tracked commands
- Each command card: command name (bold), category badge (small, muted), mastery level badge (colored), mini sparkline of last 5 success rates (5 small dots, filled = practiced, color = success rate)
- "View Sessions" link to session history

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No commands tracked | Illustration of a whistle, message "No training commands tracked yet", button "Add Your First Command", and a "Start Training Session" button |
| Populated | Commands exist | Mastery summary bar + command grid |
| All Mastered | Every command is at "Mastered" level | Celebration banner: "Amazing! All [X] commands mastered!" |
| Error | Database read fails | Toast: "Could not load training data." |

**Interactions:**
- Tap command card: Open Command Detail screen with full history and success rate chart
- Tap "New Session": Open Log Training Session flow
- Tap "View Sessions": Navigate to Session History screen
- Long press command card: Quick actions: "Practice Now", "Edit", "Delete"

**Transitions/Animations:**
- Mastery badge change animates with a brief celebration burst (confetti particles, 300ms) when a command advances to "Mastered"
- Sparkline dots animate sequentially on load (50ms delay per dot)

##### Screen: Command Detail

**Layout:**
- Header: command name (large), category badge, current mastery level badge
- Success rate chart: line chart showing success_rate per session over time (x = session date, y = percentage 0-100)
- Mastery threshold lines: dashed horizontal lines at 30%, 70%, 90%
- Stats: total sessions practiced, average success rate, best session, date mastered (if applicable)
- Session log: list of sessions where this command was practiced, showing date, success_rate, and notes

##### Screen: Session History

**Layout:**
- Scrollable list of training sessions, newest first
- Each card: date (bold), duration, location badge, star rating (1-5), commands practiced count, notes preview
- Tapping a card opens Session Detail

##### Modal: Log Training Session

**Layout:**
- Full-screen modal with multi-step flow:
- Step 1 - Session Info:
  1. Date (date picker, required, defaults to today, must be on or before today)
  2. Duration (numeric input in minutes, required, min: 1, max: 480)
  3. Location (picker: home, park, class, indoor, outdoor, other; required)
  4. "Next" button
- Step 2 - Commands Practiced:
  - List of all tracked commands with toggles to include/exclude
  - For each included command: success rate slider (0-100%, step: 5, labeled "How well did [command] go?")
  - "Add New Command" button at the bottom (adds to library and includes in this session)
  - "Next" button
- Step 3 - Session Summary:
  1. Overall Rating (1-5 stars, required)
  2. Notes (multiline text, optional, max 2000 chars)
  3. Summary preview showing commands practiced with success rates
  4. "Save Session" button

##### Modal: Add/Edit Command

**Layout:**
- Bottom sheet
- Form fields:
  1. Command Name (text input, required, max 100 chars)
  2. Category (picker: obedience, tricks, agility, behavioral, other; required)
  3. Notes (single-line text, optional, max 500 chars, e.g., "Uses hand signal only")

#### 3.6 Data Requirements

##### Entity: TrainingCommand

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this command belongs to |
| name | string | Required, max 100 chars, trimmed | None | Command name (e.g., "Sit", "Stay") |
| category | enum | Required. One of: obedience, tricks, agility, behavioral, other | obedience | Command category |
| mastery_level | enum | One of: new, learning, proficient, mastered | new | Current mastery level (auto-calculated) |
| notes | string | Max 500 chars | null | Notes about the command |
| date_mastered | date | Auto-set when mastery_level changes to "mastered" | null | Date the command was first mastered |
| sort_order | integer | Min: 0 | 0 | Display order in command grid |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: TrainingSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this session belongs to |
| date | date | Required, must be on or before today | Today | Date of the training session |
| duration_minutes | integer | Required, min: 1, max: 480 | None | Session duration in minutes |
| location | enum | Required. One of: home, park, class, indoor, outdoor, other | None | Where training took place |
| rating | integer | Required, min: 1, max: 5 | None | Overall session rating (1-5 stars) |
| notes | string | Max 2000 chars | null | Session notes and observations |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: TrainingSessionCommand

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| session_id | string | Required, references TrainingSession.id | None | The session |
| command_id | string | Required, references TrainingCommand.id | None | The command practiced |
| success_rate | integer | Required, min: 0, max: 100, step: 5 | None | Success rate for this command in this session (percentage) |
| notes | string | Max 500 chars | null | Notes specific to this command in this session |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- TrainingCommand belongs to Pet (many-to-one via pet_id)
- TrainingSession belongs to Pet (many-to-one via pet_id)
- TrainingSession has many TrainingSessionCommands (one-to-many via session_id)
- TrainingCommand has many TrainingSessionCommands (one-to-many via command_id)
- TrainingSessionCommand belongs to TrainingSession (many-to-one via session_id)
- TrainingSessionCommand belongs to TrainingCommand (many-to-one via command_id)

**Indexes:**
- TrainingCommand: pet_id - per-pet listing
- TrainingCommand: (pet_id, mastery_level) - mastery breakdown
- TrainingSession: pet_id - per-pet listing
- TrainingSession: (pet_id, date) - chronological session list
- TrainingSessionCommand: session_id - commands per session
- TrainingSessionCommand: command_id - session history per command
- TrainingSessionCommand: (command_id, created_at) - last 5 sessions for mastery calc

**Validation Rules:**
- command name: Must not be empty after trimming
- command name: Must be unique per pet (case-insensitive)
- success_rate: Must be 0-100, in increments of 5
- duration_minutes: Must be >= 1
- rating: Must be 1-5

**Example Data:**

```
{
  "id": "tc-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Sit",
  "category": "obedience",
  "mastery_level": "mastered",
  "notes": "Responds to verbal and hand signal",
  "date_mastered": "2026-02-10",
  "sort_order": 0,
  "created_at": "2026-01-01T10:00:00Z",
  "updated_at": "2026-02-10T15:00:00Z"
}
```

```
{
  "id": "ts-f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "date": "2026-03-06",
  "duration_minutes": 20,
  "location": "park",
  "rating": 4,
  "notes": "Good focus today. Slight distraction from other dogs during Heel.",
  "created_at": "2026-03-06T10:30:00Z",
  "updated_at": "2026-03-06T10:30:00Z"
}
```

```
{
  "id": "tsc-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "session_id": "ts-f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "command_id": "tc-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "success_rate": 95,
  "notes": null,
  "created_at": "2026-03-06T10:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Mastery Level Calculation

**Purpose:** Automatically determine a command's mastery level based on recent training session performance.

**Inputs:**
- command_id: string

**Logic:**

```
1. QUERY the 5 most recent TrainingSessionCommands WHERE command_id = command_id
     ORDER BY created_at DESC LIMIT 5
2. IF fewer than 1 session exists THEN mastery_level = "new", RETURN
3. avg_success_rate = AVERAGE(success_rate) across these sessions
4. IF avg_success_rate >= 90 THEN mastery_level = "mastered"
5. ELSE IF avg_success_rate >= 70 THEN mastery_level = "proficient"
6. ELSE IF avg_success_rate >= 30 THEN mastery_level = "learning"
7. ELSE mastery_level = "new"
8. IF mastery_level changed to "mastered" AND command.date_mastered IS null THEN
     SET command.date_mastered = today
9. IF mastery_level changed FROM "mastered" to lower level THEN
     SET command.date_mastered = null (regression)
10. UPDATE command.mastery_level
```

**Formulas:**
- avg_success_rate = SUM(success_rate for last 5 sessions) / COUNT(sessions, max 5)
- Mastery thresholds: new < 30%, learning 30-69%, proficient 70-89%, mastered >= 90%

**Edge Cases:**
- Command never practiced: mastery_level = "new"
- Fewer than 5 sessions: Average across all available sessions
- Exactly 5 sessions, one at 0%: Drags average down appropriately
- Mastery regression: If a mastered command drops below 90%, it reverts to proficient, and date_mastered is cleared

##### Training Streak Calculation

**Purpose:** Track consecutive days with at least one training session.

**Inputs:**
- pet_id: string

**Logic:**

```
1. QUERY DISTINCT dates FROM TrainingSessions WHERE pet_id = pet_id ORDER BY date DESC
2. Same streak logic as PT-007 Exercise Streak Calculation
3. RETURN { training_streak_days }
```

##### Session Quality Score

**Purpose:** Compute a quality score for a training session based on command success rates and session rating.

**Inputs:**
- session: TrainingSession
- session_commands: TrainingSessionCommand[]

**Logic:**

```
1. IF no commands practiced THEN quality_score = session.rating * 20 (rating-only score)
2. avg_command_success = AVERAGE(success_rate) across session_commands
3. quality_score = (avg_command_success * 0.7) + (session.rating * 20 * 0.3)
4. ROUND to nearest integer
5. RETURN quality_score (0-100)
```

**Formulas:**
- quality_score = (avg_command_success * 0.7) + (session_rating_normalized * 0.3)
- session_rating_normalized = session.rating * 20 (converts 1-5 to 20-100)

**Sort/Filter/Ranking Logic:**
- **Commands default sort:** Mastery level (mastered first), then sort_order within level
- **Commands available sort options:** Mastery level, Name (A-Z), Category, Date added
- **Sessions default sort:** Date, newest first
- **Sessions filter options:** All, This Week, This Month, By location, By rating (minimum)
- **Search:** command name, session notes - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save training session. Please try again." | User taps retry; form data preserved |
| Command name left blank | Inline validation: "Command name is required" | User fills in the field |
| Duplicate command name for pet | Inline validation: "A command named '[name]' already exists" | User changes the name |
| No commands selected in session | Inline validation: "Select at least one command to practice" | User selects a command |
| Rating not selected | Inline validation: "Please rate the session (1-5 stars)" | User selects a rating |
| Duration is zero | Inline validation: "Duration must be at least 1 minute" | User corrects the value |

**Validation Timing:**
- Command name uniqueness validated on save
- Session-level validation (rating, commands selected) runs on final step "Save Session"
- Field-level validation runs on blur

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists with commands "Sit" and "Stay" tracked,
   **When** the user logs a training session practicing "Sit" (95% success) and "Stay" (60% success),
   **Then** a session record is created, and each command's mastery level is recalculated.

2. **Given** "Sit" has been practiced in 5 sessions with success rates [90, 95, 85, 100, 95],
   **When** mastery is recalculated,
   **Then** the average is 93%, and "Sit" is marked as "Mastered" with today's date.

3. **Given** 3 commands are mastered, 2 are proficient, 1 is learning,
   **When** the user views the training dashboard,
   **Then** the mastery summary bar shows green (3), blue (2), yellow (1), and total "6 commands tracked".

**Edge Cases:**

4. **Given** a command "Shake" has only been practiced once with 50% success,
   **When** mastery is calculated,
   **Then** mastery_level is "learning" (50% >= 30% threshold, only 1 session used).

5. **Given** a mastered command regresses to 80% average over the last 5 sessions,
   **When** mastery is recalculated,
   **Then** the command reverts to "proficient", and date_mastered is cleared.

**Negative Tests:**

6. **Given** the user tries to add a command named "Sit" when "Sit" already exists,
   **When** the user taps Save,
   **Then** the system shows "A command named 'Sit' already exists"
   **And** no duplicate is created.

7. **Given** the user creates a training session with no commands selected,
   **When** the user reaches step 3 and taps Save,
   **Then** the system shows "Select at least one command to practice"
   **And** no session is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates mastered at 90% | success_rates: [90, 95, 85, 100, 95] | mastery: "mastered", avg: 93% |
| calculates proficient at 75% | success_rates: [70, 80, 75, 70, 80] | mastery: "proficient", avg: 75% |
| calculates learning at 50% | success_rates: [40, 50, 60, 45, 55] | mastery: "learning", avg: 50% |
| calculates new at 20% | success_rates: [10, 20, 25, 15, 30] | mastery: "new", avg: 20% |
| uses fewer than 5 sessions if not enough | success_rates: [80, 90] | mastery: "proficient", avg: 85% |
| returns new for no sessions | no sessions | mastery: "new" |
| sets date_mastered on first mastery | previous: proficient, new avg: 92% | date_mastered = today |
| clears date_mastered on regression | previous: mastered, new avg: 78% | date_mastered = null |
| calculates quality score | avg_success: 80%, rating: 4 | quality: (80*0.7)+(80*0.3) = 80 |
| validates duplicate command name | existing: "Sit", new: "sit" | validation error (case-insensitive) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log session and verify mastery update | 1. Add command "Sit", 2. Log 5 sessions at 95%, 3. Check mastery | Mastery changes to "mastered", date_mastered set |
| Delete session and verify mastery recalculates | 1. Delete the most recent session, 2. Check mastery | Mastery recalculates based on remaining sessions |
| Session command cascade on session delete | 1. Log session with 3 commands, 2. Delete session | All 3 TrainingSessionCommand records deleted |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks training progress for 6 commands | 1. Add 6 commands, 2. Log 10 training sessions over 2 weeks, 3. View dashboard | Dashboard shows mastery distribution. Each command's sparkline reflects recent sessions. Session history shows 10 entries. |
| Command progresses from new to mastered | 1. Add "Roll Over", 2. Practice in 5 sessions with improving success (20%, 40%, 60%, 80%, 95%), 3. View command detail | Command shows progression through all 4 mastery levels. Chart shows upward trend. Date mastered set on last session. |

---

### PT-010: Expense Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-010 |
| **Feature Name** | Expense Tracking |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to log all pet-related expenses by category (vet, food, grooming, medications, supplies, insurance, training, other) and see the total cost of pet ownership, so that I can budget accurately and understand where my money goes.

**Secondary:**
> As a multi-pet household manager, I want to see expenses broken down by pet and by category, so that I can compare costs across pets and identify which areas are most expensive.

**Tertiary:**
> As a prospective pet owner, I want to see the monthly average cost of owning a pet of a specific type, so that I can make an informed financial decision before adopting.

#### 3.3 Detailed Description

Expense Tracking provides comprehensive financial tracking for pet ownership costs. Users can manually log expenses or have them automatically captured from Vet Visit (PT-003) and Grooming (PT-008) entries that include costs. Each expense record includes the amount, date, category, a description, the pet it belongs to, and optional notes.

Expense categories are: veterinary, food, grooming, medications, supplies, insurance, training, boarding, adoption_fees, and other. The user can view expenses as a chronological list, a monthly summary, or a category breakdown chart (pie/donut chart).

Key financial metrics include:
- Total cost of ownership: sum of all expenses from the pet's adoption date (or first expense date) to today
- Monthly average: total_cost / months_owned
- Category breakdown: percentage and dollar amount per category
- Month-over-month comparison: current month vs. previous month
- Year-to-date total

The expense dashboard shows a summary card with total spend, monthly average, and the largest expense category. Below that, a monthly bar chart shows spending over time, and a category donut chart shows the proportional breakdown.

Auto-captured expenses from vet visits and grooming records are linked to their source. Editing the cost on a vet visit or grooming record automatically updates the corresponding expense entry. Deleting the source entry removes the auto-captured expense.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist before expenses can be tracked
- PT-003: Vet Visit Log - Provides auto-captured veterinary expenses
- PT-004: Medication Tracking & Reminders - Provides context for medication expenses

**External Dependencies:**
- Local storage for persistent data
- Chart rendering capability (bar chart, donut chart)
- Currency formatting based on device locale

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Local database is initialized and writable
- Locale-aware currency formatting is available

#### 3.5 User Interface Requirements

##### Screen: Expense Dashboard (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Expenses" and a "+" add button on the right
- Summary card at top: total cost of ownership (large, bold), monthly average (subtitle), "since [start date]"
- Monthly spending bar chart (horizontal scrollable, last 12 months)
- Category donut chart with legend showing category name, amount, and percentage
- Time period selector: "This Month" | "This Year" | "All Time"
- Scrollable list of expense entries below charts, newest first
- Each entry: date, category icon + label, description (truncated to 1 line), amount (right-aligned, bold), source badge ("Auto" if from vet/grooming)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No expenses recorded | Illustration of a wallet, message "No expenses tracked yet", button "Add Expense" |
| Populated | Expenses exist | Summary card + charts + expense list |
| Single Month | Only 1 month of data | Bar chart shows 1 bar; monthly average equals the single month total |
| Error | Database read fails | Toast: "Could not load expenses." |

**Interactions:**
- Tap "+": Open Add Expense modal
- Tap expense entry: Open Expense Detail (shows all fields, edit/delete options)
- Tap donut chart segment: Filter expense list to that category
- Tap time period selector: Update charts and summary for selected period
- Swipe left on entry: Reveal "Edit" and "Delete" actions
- Tap "Auto" badge: Navigate to source record (vet visit or grooming entry)

**Transitions/Animations:**
- Donut chart segments animate in clockwise (300ms total, staggered per segment)
- Bar chart bars grow from bottom (200ms per bar, staggered left to right)
- New expense entry slides in from right (200ms)

##### Screen: Multi-Pet Expense Summary

**Layout:**
- Accessible from Multi-Pet Dashboard (PT-012)
- Total spend across all pets (large, bold)
- Per-pet breakdown: list of pets with their individual total, monthly average, and proportion bar
- Category breakdown across all pets (donut chart)
- Time period selector: "This Month" | "This Year" | "All Time"

##### Modal: Add/Edit Expense

**Layout:**
- Full-screen modal with "Cancel" (left) and "Save" (right)
- Form fields:
  1. Amount (currency input, required, min: 0.01, max: 99999.99)
  2. Date (date picker, required, defaults to today, must be on or before today)
  3. Category (picker: veterinary, food, grooming, medications, supplies, insurance, training, boarding, adoption_fees, other; required)
  4. Description (text input, required, max 200 chars)
  5. Pet (picker from active pet list, required; defaults to current pet if accessed from pet profile)
  6. Notes (multiline text, optional, max 1000 chars)
  7. Recurring (toggle, default off)
  8. Recurring Interval (picker: weekly, biweekly, monthly, quarterly, annually; visible only if recurring on)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New | Adding a new expense | Fields empty except date (today) |
| Edit | Editing existing expense | Fields pre-populated |
| Auto-Captured | Editing auto-captured expense | Source info banner: "Auto-captured from [Vet Visit/Grooming] on [date]" with "View Source" link |
| Validation Error | Required field missing | Inline error below offending field |

#### 3.6 Data Requirements

##### Entity: Expense

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this expense belongs to |
| amount | float | Required, min: 0.01, max: 99999.99 | None | Expense amount |
| date | date | Required, must be on or before today | Today | Date of the expense |
| category | enum | Required. One of: veterinary, food, grooming, medications, supplies, insurance, training, boarding, adoption_fees, other | None | Expense category |
| description | string | Required, max 200 chars, trimmed | None | What the expense was for |
| notes | string | Max 1000 chars | null | Additional details |
| source_type | enum | One of: manual, vet_visit, grooming, null | manual | How the expense was created |
| source_id | string | References VetVisit.id or GroomingRecord.id | null | ID of the source record (for auto-captured) |
| is_recurring | boolean | - | false | Whether this is a recurring expense |
| recurring_interval | enum | One of: weekly, biweekly, monthly, quarterly, annually, null | null | How often the expense recurs |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- Expense belongs to Pet (many-to-one via pet_id)
- Expense optionally linked to VetVisit or GroomingRecord (via source_type + source_id)

**Indexes:**
- pet_id - per-pet listing
- (pet_id, date) - chronological per-pet listing
- (pet_id, category) - category breakdown queries
- category - cross-pet category summaries
- (source_type, source_id) - auto-capture linkage
- date - time-range filtering

**Validation Rules:**
- amount: Required, must be > 0
- date: Required, must be on or before today
- category: Required, must be valid enum
- description: Must not be empty after trimming
- Auto-captured expenses: source_type and source_id must reference a valid record

**Example Data:**

```
{
  "id": "exp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "amount": 285.00,
  "date": "2026-02-10",
  "category": "veterinary",
  "description": "Annual wellness checkup",
  "notes": "Includes heartworm test and fecal test",
  "source_type": "vet_visit",
  "source_id": "vv1a2b3c-d5e6-7890-abcd-ef1234567890",
  "is_recurring": false,
  "recurring_interval": null,
  "created_at": "2026-02-10T17:00:00Z",
  "updated_at": "2026-02-10T17:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Total Cost of Ownership

**Purpose:** Calculate the total cost of owning a pet from adoption/first expense to today.

**Inputs:**
- pet_id: string

**Logic:**

```
1. QUERY all Expenses WHERE pet_id = pet_id
2. total_cost = SUM(amount)
3. DETERMINE start_date:
     a. IF pet.adoption_date IS NOT null THEN start_date = pet.adoption_date
     b. ELSE start_date = earliest expense date
     c. IF no expenses exist THEN RETURN { total_cost: 0, monthly_avg: 0, months_owned: 0 }
4. months_owned = (today - start_date) / 30.44 (average days per month)
5. IF months_owned < 1 THEN months_owned = 1 (minimum 1 month)
6. monthly_avg = total_cost / months_owned
7. RETURN { total_cost, monthly_avg, months_owned, start_date }
```

**Formulas:**
- total_cost_of_ownership = SUM(all expense amounts for the pet)
- monthly_cost_avg = total_cost / months_owned
- months_owned = (today - start_date) / 30.44

**Edge Cases:**
- No expenses: total = 0, monthly_avg = 0
- Owned less than 1 month: Use 1 as minimum months_owned to avoid inflated average
- No adoption date and no expenses: Return all zeros

##### Category Breakdown

**Purpose:** Calculate spending per category as amounts and percentages.

**Inputs:**
- pet_id: string (optional; omit for all-pet summary)
- start_date: date (optional)
- end_date: date (optional)

**Logic:**

```
1. QUERY all Expenses (optionally filtered by pet_id, date range)
2. GROUP BY category
3. FOR each category:
     category_total = SUM(amount)
     category_pct = (category_total / grand_total) * 100
4. ORDER BY category_total DESC
5. RETURN list of { category, total, percentage }
```

**Formulas:**
- category_pct = (category_total / grand_total) * 100

**Edge Cases:**
- Grand total is 0: All percentages = 0
- Only one category has expenses: That category is 100%

##### Auto-Capture from Vet Visits and Grooming

**Purpose:** Automatically create expense records when vet visits or grooming entries include a cost.

**Logic:**

```
1. ON VetVisit saved with non-null cost:
     a. CHECK if Expense exists WHERE source_type = "vet_visit" AND source_id = vet_visit.id
     b. IF exists THEN UPDATE amount, date to match vet visit
     c. ELSE CREATE Expense with:
        - amount = vet_visit.cost
        - date = vet_visit.visit_date
        - category = "veterinary"
        - description = "[Reason label] at [Vet Name]"
        - source_type = "vet_visit"
        - source_id = vet_visit.id
2. ON VetVisit cost changed to null:
     DELETE Expense WHERE source_type = "vet_visit" AND source_id = vet_visit.id
3. ON VetVisit deleted:
     DELETE Expense WHERE source_type = "vet_visit" AND source_id = vet_visit.id
4. Same logic for GroomingRecord with category = "grooming"
```

**Edge Cases:**
- Vet visit saved without cost: No expense created
- Vet visit cost changed from $285 to $300: Expense amount updates to $300
- Vet visit cost removed (set to null): Expense is deleted
- Source record deleted: Expense is deleted

##### Recurring Expense Projection

**Purpose:** Project future recurring expenses for budgeting reference.

**Logic:**

```
1. QUERY all Expenses WHERE is_recurring = true AND pet_id = pet_id
2. FOR each recurring expense:
     a. COMPUTE annual_cost based on interval:
        - weekly: amount * 52
        - biweekly: amount * 26
        - monthly: amount * 12
        - quarterly: amount * 4
        - annually: amount * 1
3. total_annual_recurring = SUM(annual_cost)
4. total_monthly_recurring = total_annual_recurring / 12
5. RETURN { recurring_expenses, total_annual_recurring, total_monthly_recurring }
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Date, newest first
- **Available sort options:** Date (newest/oldest), Amount (highest/lowest), Category
- **Filter options:** All Time, This Month, This Year, By category, Manual only, Auto-captured only
- **Search:** description, notes - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save expense. Please try again." | User taps retry; form data preserved |
| Amount is zero or negative | Inline validation: "Amount must be greater than $0" | User corrects the value |
| Description left blank | Inline validation: "Description is required" | User fills in the field |
| Category not selected | Inline validation: "Please select a category" | User selects a category |
| Auto-captured expense edit conflict | If user edits an auto-captured expense, show warning: "This expense is linked to a vet visit. Changes here will not update the vet visit record." | User acknowledges and saves, or navigates to source |
| Chart rendering fails | Fallback to expense list only; toast: "Could not render charts" | User can still view and manage expenses |

**Validation Timing:**
- Amount and description validated on blur
- Category validated on save
- Auto-capture runs automatically on vet visit / grooming save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists,
   **When** the user adds an expense of $45.99, category "Food", description "Monthly kibble bag",
   **Then** the expense appears in the list, and the summary card updates to reflect the new total.

2. **Given** a vet visit with cost $285 is saved,
   **When** the user views Luna's expenses,
   **Then** an auto-captured expense appears with category "Veterinary", amount $285, and an "Auto" badge linking to the vet visit.

3. **Given** 10 expenses across 4 categories over 6 months,
   **When** the user views the category donut chart,
   **Then** each category segment shows the correct percentage and dollar amount.

4. **Given** Luna was adopted 6 months ago with total expenses of $1,200,
   **When** the user views the expense dashboard,
   **Then** the summary shows "Total: $1,200.00", "Monthly Avg: $200.00", "Since Jun 2025".

**Edge Cases:**

5. **Given** a vet visit cost is changed from $285 to $300,
   **When** the user views expenses,
   **Then** the auto-captured expense amount updates to $300.

6. **Given** a grooming record with cost is deleted,
   **When** the user views expenses,
   **Then** the auto-captured grooming expense is also deleted.

**Negative Tests:**

7. **Given** the add expense form is open,
   **When** the user enters amount as 0 and taps Save,
   **Then** the system shows "Amount must be greater than $0"
   **And** no expense is created.

8. **Given** the add expense form is open,
   **When** the user leaves the description blank and taps Save,
   **Then** the system shows "Description is required"
   **And** no expense is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates total cost of ownership | expenses: [285, 45, 30, 120] | total: 480 |
| calculates monthly average | total: 1200, months_owned: 6 | monthly_avg: 200 |
| uses 1 month minimum | total: 500, owned less than 30 days | monthly_avg: 500 |
| calculates category breakdown | vet: 285, food: 90, grooming: 65 | vet: 64.8%, food: 20.5%, grooming: 14.8% |
| handles zero total | no expenses | all percentages: 0% |
| projects annual recurring (monthly) | amount: 50, interval: monthly | annual: 600 |
| projects annual recurring (weekly) | amount: 25, interval: weekly | annual: 1300 |
| validates amount positive | amount: 0 | validation error |
| validates description not empty | description: "  " | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Auto-capture from vet visit | 1. Create vet visit with $285 cost, 2. Check expenses | Expense created with category "veterinary", $285, linked to vet visit |
| Auto-capture update on vet cost change | 1. Create vet visit $285, 2. Edit to $300, 3. Check expense | Expense amount updated to $300 |
| Auto-capture delete on vet visit delete | 1. Create vet visit with cost, 2. Delete vet visit | Linked expense also deleted |
| Manual and auto expenses in summary | 1. Add manual food expense, 2. Add vet visit with cost, 3. View dashboard | Both expenses appear; total reflects both |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks 6 months of pet expenses | 1. Add monthly food expenses ($50 x 6), 2. Add 2 vet visits ($285, $150), 3. Add grooming ($65 x 3) | Total: $930. Monthly avg: $155. Category breakdown: Food 32.3%, Vet 46.8%, Grooming 21.0%. Bar chart shows 6 months of spending. |
| User compares costs across 2 pets | 1. Add expenses for Luna and Max, 2. View multi-pet summary | Per-pet totals and monthly averages displayed. Category donut shows combined breakdown. |

---

### PT-011: Emergency Vet Contacts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-011 |
| **Feature Name** | Emergency Vet Contacts |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to store emergency vet contact information including my regular vet, the nearest 24-hour emergency vet, and the ASPCA Poison Control number, so that I can find critical contact information instantly in an emergency.

**Secondary:**
> As a pet sitter, I want to see the pet owner's emergency vet contacts clearly displayed, so that I know exactly who to call if something goes wrong while the owner is away.

#### 3.3 Detailed Description

Emergency Vet Contacts provides a dedicated, fast-access storage area for critical veterinary contact information. Unlike vet names entered in vet visit records (which are unstructured text), emergency contacts are fully structured with name, phone number, address, hours of operation, and notes.

Users can store three types of contacts: primary vet (regular veterinarian), emergency vet (24-hour emergency clinic), and poison control (pre-populated with ASPCA Animal Poison Control: 888-426-4435). Users can add additional custom contacts (e.g., mobile vet, specialist).

Each contact displays a prominent "Call" button that initiates a phone call. The emergency contacts screen is accessible from two locations: the pet profile detail screen (via a red emergency icon) and the Multi-Pet Dashboard (global emergency contacts).

Emergency contacts can be shared with the Pet Sitter Info Export (PT-016) and are included by default in any exported care instructions.

Contacts are stored at the global level (not per-pet) since most households use the same vet for all pets. However, users can optionally associate a contact with specific pets if different pets see different vets.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this feature is independent)

**External Dependencies:**
- Phone call capability (tel: URL scheme)
- Local storage for persistent data

**Assumed Capabilities:**
- Device can make phone calls or at least display phone numbers
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Emergency Contacts

**Layout:**
- Top navigation bar showing "Emergency Contacts" with a "+" add button on the right and an "Edit" button
- Pre-populated section at top: "ASPCA Poison Control" card with phone number 888-426-4435 and "Call" button (always present, not deletable)
- Contact cards in order: Primary Vet (if set), Emergency Vet (if set), then custom contacts
- Each contact card displays:
  - Contact type badge (Primary Vet / Emergency Vet / Specialist / Custom)
  - Name (bold, large)
  - Phone number with "Call" button (green, prominent)
  - Address (if set, tappable to open maps)
  - Hours (if set)
  - Associated pets (if set, small avatar row)
  - Notes preview
- Bottom safety section: "Pet Emergency Tips" link to static screen with basic first aid tips

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Only poison control exists | Poison control card + prompts: "Add Your Primary Vet" and "Add Emergency Vet" |
| Populated | User has added contacts | All contact cards with call buttons |
| Error | Database read fails | Toast: "Could not load contacts." Poison control card still shown (hardcoded). |

**Interactions:**
- Tap "Call" button: Initiate phone call via tel: URL
- Tap address: Open device maps application with the address
- Tap contact card (not Call button): Open Edit Contact modal
- Tap "+": Open Add Contact modal
- Swipe left on contact card (except Poison Control): Reveal "Delete" action
- Tap "Pet Emergency Tips": Navigate to static tips screen

**Transitions/Animations:**
- "Call" button briefly highlights on tap (100ms green pulse)
- New contact card slides in from right (200ms)

##### Modal: Add/Edit Contact

**Layout:**
- Full-screen modal with "Cancel" (left) and "Save" (right)
- Form fields:
  1. Contact Type (picker: primary_vet, emergency_vet, specialist, other; required)
  2. Name (text input, required, max 200 chars)
  3. Phone Number (phone input, required, max 20 chars)
  4. Address (multiline text, optional, max 500 chars)
  5. Hours of Operation (text input, optional, max 200 chars, e.g., "Mon-Fri 8AM-6PM, Sat 9AM-1PM")
  6. Associated Pets (multi-select from active pet list, optional; if empty, contact applies to all pets)
  7. Notes (multiline text, optional, max 1000 chars)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New | Adding a new contact | Fields empty |
| Edit | Editing existing contact | Fields pre-populated |
| Validation Error | Required field missing | Inline error below offending field |

##### Screen: Pet Emergency Tips (static)

**Layout:**
- Scrollable screen with categorized first aid tips
- Sections: "Signs of Emergency" (list of 10 warning signs), "Before You Call" (checklist), "Common Poisons" (household items toxic to pets), "First Aid Basics" (5 common scenarios)
- All content is static, embedded in the app, no network required

#### 3.6 Data Requirements

##### Entity: EmergencyContact

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| contact_type | enum | Required. One of: primary_vet, emergency_vet, specialist, poison_control, other | None | Type of contact |
| name | string | Required, max 200 chars, trimmed | None | Contact name (person or business) |
| phone_number | string | Required, max 20 chars | None | Phone number |
| address | string | Max 500 chars | null | Physical address |
| hours | string | Max 200 chars | null | Hours of operation |
| notes | string | Max 1000 chars | null | Additional notes |
| associated_pet_ids | string | JSON array of Pet.id strings | "[]" | Pets this contact is associated with (empty = all pets) |
| is_system | boolean | - | false | Whether this is a system-provided contact (Poison Control) |
| sort_order | integer | Min: 0 | 0 | Display order |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- EmergencyContact optionally associated with Pet (many-to-many via associated_pet_ids JSON array)

**Indexes:**
- contact_type - filtering by type
- sort_order - display ordering
- is_system - identifying system contacts

**Validation Rules:**
- name: Must not be empty after trimming
- phone_number: Must not be empty after trimming, must contain at least 7 digits
- System contacts (is_system = true) cannot be deleted by the user
- Only 1 poison_control type contact allowed (system-provided)

**Example Data:**

```
{
  "id": "ec-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "contact_type": "primary_vet",
  "name": "Happy Paws Veterinary Clinic",
  "phone_number": "415-555-0123",
  "address": "123 Main Street, San Francisco, CA 94102",
  "hours": "Mon-Fri 8AM-6PM, Sat 9AM-1PM",
  "notes": "Ask for Dr. Sarah Chen. Luna's regular vet.",
  "associated_pet_ids": "[]",
  "is_system": false,
  "sort_order": 0,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

```
{
  "id": "ec-poison-control",
  "contact_type": "poison_control",
  "name": "ASPCA Animal Poison Control",
  "phone_number": "888-426-4435",
  "address": null,
  "hours": "24/7",
  "notes": "There may be a consultation fee. Have the product container available when calling.",
  "associated_pet_ids": "[]",
  "is_system": true,
  "sort_order": -1,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### System Contact Initialization

**Purpose:** Ensure the Poison Control contact exists on first module load.

**Logic:**

```
1. ON module initialization:
     a. CHECK if EmergencyContact exists WHERE is_system = true AND contact_type = "poison_control"
     b. IF not exists THEN INSERT the ASPCA Poison Control record:
        - name: "ASPCA Animal Poison Control"
        - phone_number: "888-426-4435"
        - hours: "24/7"
        - notes: "There may be a consultation fee. Have the product container available when calling."
        - is_system: true
        - sort_order: -1 (always appears first)
```

##### Phone Call Initiation

**Purpose:** Launch a phone call when the user taps the "Call" button.

**Logic:**

```
1. CONSTRUCT URI: "tel:" + contact.phone_number (stripped of non-digit characters except leading +)
2. OPEN URI via device OS
3. IF device cannot make calls (e.g., iPad, simulator): Display the phone number in a copyable dialog instead
```

**Edge Cases:**
- Device cannot make calls: Show dialog with number and "Copy" button
- Phone number contains formatting characters: Strip to digits + leading + before constructing URI

##### Contact Sorting

**Purpose:** Display contacts in a logical priority order.

**Logic:**

```
1. System contacts first (sort_order = -1)
2. Then by contact_type priority: primary_vet (0), emergency_vet (1), specialist (2), other (3)
3. Within same type: by user-defined sort_order
4. Within same sort_order: alphabetically by name
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Priority order as described above
- **Filter options:** All, By contact type, By associated pet
- **Search:** name, phone_number, address - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save contact. Please try again." | User taps retry; form data preserved |
| Name left blank | Inline validation: "Contact name is required" | User fills in the field |
| Phone number left blank | Inline validation: "Phone number is required" | User fills in the field |
| Phone number too short (< 7 digits) | Inline validation: "Phone number must have at least 7 digits" | User corrects the number |
| Phone call fails to initiate | Toast: "Could not initiate call. Phone number copied to clipboard." | User can paste number into their dialer |
| User attempts to delete Poison Control | Action is not available (no delete swipe on system contacts) | N/A |

**Validation Timing:**
- Field-level validation runs on blur
- Phone number digit count validated on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the module is initialized for the first time,
   **When** the user opens Emergency Contacts,
   **Then** the ASPCA Poison Control card is pre-populated with phone number 888-426-4435 and 24/7 hours.

2. **Given** the user adds a primary vet contact with name "Happy Paws", phone "415-555-0123", and address,
   **When** the user views the contacts list,
   **Then** the contact appears below Poison Control with a "Call" button and tappable address.

3. **Given** an emergency vet contact exists,
   **When** the user taps the "Call" button,
   **Then** the device initiates a phone call to the stored number.

**Edge Cases:**

4. **Given** the user is on an iPad (no phone capability),
   **When** the user taps "Call",
   **Then** a dialog shows the phone number with a "Copy" button instead of initiating a call.

5. **Given** a contact is associated with only "Luna",
   **When** the user views emergency contacts from Max's profile,
   **Then** the contact is still visible but shows "(Luna's vet)" annotation.

**Negative Tests:**

6. **Given** the add contact form is open,
   **When** the user leaves both name and phone blank and taps Save,
   **Then** the system shows validation errors for both fields
   **And** no contact is created.

7. **Given** the user views the Poison Control card,
   **When** the user attempts to swipe left to delete,
   **Then** no delete action is revealed (system contacts are undeletable).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| initializes poison control on first run | no contacts in database | Poison Control record created with correct phone number |
| does not duplicate poison control on re-init | Poison Control already exists | No duplicate created |
| constructs tel URI correctly | phone: "415-555-0123" | URI: "tel:4155550123" |
| constructs tel URI with country code | phone: "+1-415-555-0123" | URI: "tel:+14155550123" |
| validates phone has 7+ digits | phone: "12345" (5 digits) | validation error |
| validates phone passes with 7 digits | phone: "1234567" | passes validation |
| sorts contacts by priority | [other, primary_vet, poison_control, emergency_vet] | [poison_control, primary_vet, emergency_vet, other] |
| validates name not empty | name: "  " | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Module init creates Poison Control | 1. Initialize module, 2. Query contacts | Poison Control exists with correct data |
| Add and display primary vet | 1. Add primary vet with all fields, 2. View contacts list | Contact appears with correct type badge, call button, and address |
| Delete custom contact | 1. Add custom contact, 2. Swipe delete, 3. Confirm | Contact removed from list |
| Poison Control cannot be deleted | 1. Attempt programmatic delete of system contact | Delete rejected or contact persists |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User sets up complete emergency contacts | 1. Open module (Poison Control auto-created), 2. Add primary vet, 3. Add 24-hour emergency vet, 4. Add specialist | 4 contacts displayed in priority order. Each has a working "Call" button. |
| Pet sitter accesses emergency info | 1. User has 3 contacts set up, 2. Generate pet sitter card (PT-016), 3. View card | All emergency contacts appear in the sitter card with phone numbers and addresses. |

---

### PT-012: Multi-Pet Dashboard

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-012 |
| **Feature Name** | Multi-Pet Dashboard |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a multi-pet household manager, I want a single dashboard showing all my pets' upcoming tasks, due vaccinations, medication schedules, and feeding statuses, so that I can manage everything at a glance without navigating into each pet's profile individually.

**Secondary:**
> As a busy pet owner, I want to see a "Today" view with all tasks across all pets, so that I know exactly what needs to be done each day.

#### 3.3 Detailed Description

The Multi-Pet Dashboard provides a consolidated overview of all pets and their upcoming care tasks. It serves as the primary landing screen for users with 2 or more active pets. For single-pet users, the dashboard still functions but focuses on that pet's schedule.

The dashboard is organized into sections:

**Today's Tasks:** A chronological list of everything due today across all pets, including medication doses, feeding times, and scheduled grooming. Each task shows the pet's avatar, pet name, task type icon, task description, and a quick-action button (e.g., "Log Dose", "Fed", "Done"). Tasks are sorted by time, with overdue items pinned to the top.

**Upcoming:** A look-ahead section showing the next 7 days of scheduled events, grouped by day. This includes upcoming vaccination due dates, vet follow-up appointments, grooming due dates, and medication refill reminders.

**Alerts:** A section highlighting items that need attention. These include overdue vaccinations (red), overdue grooming (red), missed medication doses (red), and weight changes > 5% in the last 30 days (yellow). Each alert is tappable and navigates to the relevant feature screen.

**Pet Quick-Access Row:** A horizontal scrollable row of pet cards at the top, showing each pet's avatar, name, and a status indicator (green dot if all tasks are current, yellow dot if items are due soon, red dot if any overdue items). Tapping a pet card navigates to that pet's profile detail screen.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - Pets must exist

**External Dependencies:**
- Local storage for persistent data

**Assumed Capabilities:**
- Other feature modules are installed and data is available for querying
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Multi-Pet Dashboard

**Layout:**
- Top navigation bar showing "My Pets" with settings gear icon on the right
- Pet Quick-Access Row: horizontal scroll of circular pet avatars (60px) with name below and status dot overlay (top-right). Active pet count shown as a small badge.
- Section 1 - "Today": collapsible section with chronological task list
  - Each task row: pet avatar (small, 32px), pet name, task type icon, task description, time, quick-action button
  - Overdue items pinned to top with red accent bar on the left
  - Completed items move to bottom with checkmark, reduced opacity
- Section 2 - "Upcoming (Next 7 Days)": collapsible section grouped by day
  - Day headers: "Tomorrow", "Wednesday", "Thursday", etc.
  - Each item: pet avatar, pet name, event type, description
- Section 3 - "Alerts": collapsible section with alert cards
  - Each alert: severity icon (red/yellow), pet name, alert message, tappable to navigate
  - Alert count badge on section header
- Section 4 - "Quick Stats": collapsible row of metric cards
  - "Total Pets: [X]", "Tasks Today: [Y]", "Overdue: [Z]", "Monthly Spend: $[A]"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No pets exist | Redirect to pet creation flow (PT-001 empty state) |
| Single Pet | Only 1 pet exists | Dashboard shows that pet's data; pet row shows 1 avatar |
| All Current | No overdue items, all tasks done | Green banner: "All caught up! Every pet is on track." |
| Has Overdue | One or more overdue items | Red alert count badge on Alerts section, overdue items pinned in Today |
| Error | Database read fails | Toast: "Could not load dashboard data." |

**Interactions:**
- Tap pet avatar in quick-access row: Navigate to Pet Profile Detail
- Tap task quick-action button: Execute action (log dose, mark fed, etc.) inline
- Tap alert card: Navigate to relevant feature screen for that pet
- Tap section header: Expand/collapse section
- Pull down: Refresh dashboard data
- Tap settings gear: Navigate to Settings (PT-018)

**Transitions/Animations:**
- Quick-action completion animates the task row: button transitions to checkmark (200ms), row slides to bottom with reduced opacity (300ms)
- Alert count badge pulses on load if count > 0 (2 pulses, 150ms each)
- Pet status dot transitions smoothly between colors (200ms)

#### 3.6 Data Requirements

The Multi-Pet Dashboard does not introduce new entities. It aggregates data from:
- Pet (PT-001) - pet list, avatars, names
- VaccinationRecord (PT-002) - overdue/due soon vaccinations
- VetVisit (PT-003) - upcoming follow-ups
- Medication/DoseLog (PT-004) - today's doses, missed doses
- WeightEntry (PT-005) - significant weight changes
- FeedingSchedule/FeedingLog (PT-006) - today's meals
- GroomingInterval/GroomingRecord (PT-008) - overdue/due soon grooming
- Expense (PT-010) - monthly spend total
- EmergencyContact (PT-011) - quick access link

**Computed data (not persisted, calculated on dashboard load):**

| Metric | Source | Calculation |
|--------|--------|-------------|
| tasks_today | PT-004, PT-006 | Count of medication doses + feeding times scheduled for today |
| tasks_completed_today | PT-004, PT-006 | Count of logged doses + logged feedings for today |
| overdue_count | PT-002, PT-004, PT-008 | Count of overdue vaccinations + missed doses + overdue grooming |
| upcoming_events | PT-002, PT-003, PT-008 | Vaccinations, follow-ups, and grooming due in next 7 days |
| monthly_spend | PT-010 | SUM(expenses) for current month across all pets |
| pet_status | All | green (all current), yellow (due_soon items), red (overdue items) |

#### 3.7 Business Logic Rules

##### Pet Status Indicator Calculation

**Purpose:** Determine the status dot color for each pet in the quick-access row.

**Inputs:**
- pet_id: string

**Logic:**

```
1. CHECK vaccinations: any overdue? (PT-002 status = "overdue")
2. CHECK medications: any missed doses today? (PT-004 DoseLog status = "missed")
3. CHECK grooming: any overdue? (PT-008 status = "overdue")
4. IF any check returns true THEN status = "red"
5. CHECK vaccinations due_soon (within 30 days)
6. CHECK grooming due_soon (within 7 days)
7. CHECK medications with pending doses later today
8. IF any due_soon check returns true THEN status = "yellow"
9. ELSE status = "green"
```

**Edge Cases:**
- Pet has no features configured (no vaccinations, no medications, no grooming): Status = "green"
- Pet is archived: Excluded from dashboard entirely

##### Today's Task Aggregation

**Purpose:** Build the chronological task list for the current day.

**Logic:**

```
1. COLLECT all medication doses scheduled for today (from all active pets)
     - Include: pet_id, pet_name, medication_name, dose_time, dose_status (pending/taken/skipped/missed)
2. COLLECT all feeding times scheduled for today (from all active pets)
     - Include: pet_id, pet_name, food_name, meal_time, fed_status (pending/fed/missed)
3. MERGE all tasks into a single list
4. SORT by:
     a. Overdue/missed items first (time has passed and not logged)
     b. Then by scheduled time ascending
     c. Completed items last
5. RETURN sorted task list
```

**Edge Cases:**
- No tasks today: Show "No tasks scheduled for today" message
- All tasks completed: Show "All caught up!" banner
- Task time passes without logging: Auto-transition to "missed" status on next dashboard refresh

##### Alert Generation

**Purpose:** Generate alert cards for items requiring attention.

**Logic:**

```
1. FOR each active pet:
     a. QUERY overdue vaccinations (PT-002, status = "overdue")
        CREATE alert: severity = "high", message = "[Pet Name]: [Vaccine] vaccination overdue since [date]"
     b. QUERY missed medication doses (PT-004, today's doses with status = "missed")
        CREATE alert: severity = "high", message = "[Pet Name]: Missed [Medication] dose at [time]"
     c. QUERY overdue grooming (PT-008, status = "overdue")
        CREATE alert: severity = "high", message = "[Pet Name]: [Grooming type] overdue since [date]"
     d. QUERY weight change > 5% in last 30 days (PT-005)
        CREATE alert: severity = "medium", message = "[Pet Name]: Weight changed [+/-X]% in the last 30 days"
2. SORT alerts: high severity first, then by pet name, then by date
3. RETURN alert list
```

**Edge Cases:**
- No alerts: Section shows "No alerts - everything looks good!" with green checkmark
- Multiple alerts for same pet: Group under pet name if > 3 alerts for that pet

**Sort/Filter/Ranking Logic:**
- **Today's Tasks sort:** Overdue first, then chronological by time, completed last
- **Upcoming sort:** Chronological by date, then by type priority (vaccination > vet follow-up > grooming)
- **Alerts sort:** Severity (high > medium), then pet name
- **Filter options:** All pets, specific pet (tap pet avatar to filter), task type

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database query fails for one section | Other sections load normally; failed section shows "Could not load" with retry link | User taps retry on the failed section |
| No pets exist | Redirect to PT-001 empty state (add first pet) | User adds a pet |
| Feature data unavailable (e.g., no medications module data) | Section shows gracefully empty state; no error | N/A |
| Quick-action fails | Toast: "Could not complete action. Please try again." | User retries the action |
| Dashboard refresh takes > 3 seconds | Show skeleton loading animation for each section | Data loads progressively as queries complete |

**Validation Timing:**
- Dashboard data refreshes on screen focus (when navigating back to dashboard)
- Quick-actions validate inline before executing
- Alert list regenerates on each dashboard load

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** 2 pets exist (Luna and Max) with active medications and feeding schedules,
   **When** the user opens the Multi-Pet Dashboard,
   **Then** the pet quick-access row shows both pets, and "Today" section shows all medications and feedings for both pets in chronological order.

2. **Given** Luna has an overdue vaccination and Max has a grooming due tomorrow,
   **When** the user views the dashboard,
   **Then** Alerts section shows Luna's overdue vaccination (red), and Upcoming section shows Max's grooming for tomorrow.

3. **Given** all of today's tasks have been completed,
   **When** the user views the dashboard,
   **Then** a green banner shows "All caught up! Every pet is on track." and all task rows show checkmarks.

4. **Given** the user taps "Log Dose" on a medication task,
   **When** the action completes,
   **Then** the task row animates to completed state, the task count decreases, and the pet's status dot may update from yellow to green.

**Edge Cases:**

5. **Given** only 1 pet exists,
   **When** the user views the dashboard,
   **Then** the dashboard displays normally with 1 pet avatar and that pet's tasks. The pet row is still visible.

6. **Given** a pet has no features configured (no vaccinations, medications, feeding, or grooming),
   **When** the user views that pet's tasks on the dashboard,
   **Then** no tasks appear for that pet, and its status dot is green.

**Negative Tests:**

7. **Given** all pets are archived,
   **When** the user opens the dashboard,
   **Then** the empty state is shown with "Add Your First Pet" prompt (archived pets are excluded).

8. **Given** a quick-action database write fails,
   **When** the user taps "Log Dose",
   **Then** a toast shows "Could not complete action. Please try again." and the task remains in its original state.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| pet status green when all current | no overdue items | status: "green" |
| pet status yellow when due_soon | vaccination due in 20 days | status: "yellow" |
| pet status red when overdue | vaccination overdue | status: "red" |
| red takes priority over yellow | 1 overdue + 1 due_soon | status: "red" |
| tasks sorted overdue first | 3 tasks: 1 overdue, 1 pending, 1 completed | order: overdue, pending, completed |
| alert generated for overdue vaccination | vaccination 5 days overdue | alert: severity "high", correct message |
| alert generated for weight change > 5% | weight change: 6.5% in 30 days | alert: severity "medium", correct message |
| no alert for weight change <= 5% | weight change: 4.8% in 30 days | no alert |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Dashboard aggregates across 2 pets | 1. Add 2 pets with medications, 2. View dashboard | Today section shows doses for both pets, sorted by time |
| Quick-action marks task complete | 1. View dashboard with pending task, 2. Tap quick-action | Task moves to completed, counts update |
| Dashboard reflects new pet added | 1. View dashboard with 1 pet, 2. Add second pet with medications, 3. Return to dashboard | Second pet appears in quick-access row, its tasks appear in Today |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Multi-pet household morning routine | 1. Add 3 pets with medications and feeding, 2. Open dashboard at 8 AM, 3. Complete all morning tasks via quick-actions | All morning tasks checked off. Progress counts update. Pet status dots reflect completed morning routines. |
| User triages alerts and upcoming | 1. Set up 2 pets with various features, 2. Let some items become overdue, 3. View dashboard | Alerts section shows overdue items in red. Upcoming shows next 7 days. Quick-access dots correctly colored per pet. |

---

### PT-013: Pet Health Timeline

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-013 |
| **Feature Name** | Pet Health Timeline |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to see a chronological timeline of all health events for my pet (vaccinations, vet visits, medications started/stopped, weight changes, surgeries), so that I can present a complete medical history to any vet.

**Secondary:**
> As a foster parent, I want to generate a printable health timeline for a pet, so that I can hand off a complete medical record to the adopting family.

#### 3.3 Detailed Description

The Pet Health Timeline aggregates data from multiple features into a single, unified chronological view of a pet's health history. It draws events from vaccinations (PT-002), vet visits (PT-003), medications (PT-004), and weight entries (PT-005) to create a scrollable timeline that tells the complete health story of a pet.

Each timeline event has a type (vaccination, vet_visit, medication_started, medication_stopped, medication_completed, weight_recorded, grooming), a date, a title, a description, and a link to the original record. Events are displayed as cards on a vertical timeline with a connecting line and date markers.

The timeline supports filtering by event type (show only vaccinations, only vet visits, etc.) and searching by keyword (e.g., searching "Rabies" shows all Rabies-related events). A date range selector allows users to focus on a specific period.

The timeline also detects and highlights "significant events": any vet visit with reason "emergency" or "surgery", any medication discontinuation, and any weight change > 10% within 30 days. Significant events display a highlighted border and appear in search results with higher priority.

Users can export the timeline as a formatted document (plain text or PDF-ready text) for sharing with veterinarians or new pet owners.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist
- PT-002: Vaccination Records - Provides vaccination events
- PT-003: Vet Visit Log - Provides vet visit events
- PT-004: Medication Tracking & Reminders - Provides medication lifecycle events

**External Dependencies:**
- Local storage for persistent data
- Text export capability (share sheet)

**Assumed Capabilities:**
- User can navigate to a specific pet's profile
- Data from prerequisite features is queryable

#### 3.5 User Interface Requirements

##### Screen: Health Timeline (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Health Timeline" with export icon (share) on the right
- Filter chips: "All" | "Vaccinations" | "Vet Visits" | "Medications" | "Weight" | "Grooming"
- Search bar below filters (collapsed by default, tap magnifying glass to expand)
- Date range selector: "All Time" | "Last Year" | "Last 6 Months" | "Custom Range"
- Vertical timeline with a connecting line on the left side
- Each event card:
  - Date marker on the timeline line (circle with type-specific color)
  - Event type icon + label
  - Title (bold): e.g., "Rabies Vaccination", "Wellness Checkup", "Started Heartgard Plus"
  - Description (1-2 lines): key details from the source record
  - Significant event indicator: yellow star icon if event is flagged significant
  - Tap to navigate to the source record

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No health events exist | Message: "No health events recorded yet. Start by adding a vaccination, vet visit, or medication." |
| Populated | Events exist | Scrollable timeline |
| Filtered | Filter or search active | Filtered timeline with count: "Showing [X] of [Y] events" |
| No Results | Filter/search yields nothing | "No events match your filter" with "Clear Filters" button |
| Error | Database query fails | Toast: "Could not load health timeline." |

**Interactions:**
- Tap event card: Navigate to the source record (e.g., tap a vaccination event to go to that vaccination's detail)
- Tap filter chip: Toggle filter on/off (multiple filters can be active simultaneously)
- Tap search icon: Expand search bar, type to search
- Tap date range: Show date range options or custom date picker
- Tap export icon: Generate timeline text and show share sheet
- Scroll: Smooth scrolling through timeline with date markers appearing as section headers when dates change

**Transitions/Animations:**
- Timeline events fade in sequentially on load (50ms stagger per event, max 20 visible)
- Filter toggle cross-fades the timeline (200ms)
- Date markers stick to the top of the screen as the user scrolls past

##### Modal: Export Timeline

**Layout:**
- Bottom sheet with export options:
  1. Format: "Text Summary" | "Detailed Text"
  2. Date range: "All Time" | "Last Year" | "Custom"
  3. Include sections checkboxes: Vaccinations, Vet Visits, Medications, Weight, Grooming
  4. "Export" button that generates the text and opens the share sheet

#### 3.6 Data Requirements

The Pet Health Timeline does not introduce new persistent entities. It queries existing entities and computes a merged event list.

**Computed Entity: TimelineEvent (in-memory only)**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Source record ID |
| event_type | enum | One of: vaccination, vet_visit, medication_started, medication_stopped, medication_completed, weight_recorded, grooming |
| date | date | Date of the event |
| title | string | Summary title |
| description | string | 1-2 line description |
| is_significant | boolean | Whether this event is flagged as significant |
| source_type | string | Entity type of the source record |
| source_id | string | ID of the source record for navigation |

**Event Generation Mapping:**

| Source Entity | Event Type | Title | Description |
|--------------|-----------|-------|-------------|
| VaccinationRecord | vaccination | "[Vaccine Name]" | "Administered by [Vet Name]. Next due: [date]." |
| VetVisit | vet_visit | "[Reason label]" | "[Diagnosis]. Cost: $[amount]." |
| Medication (on create) | medication_started | "Started [Medication Name]" | "[Dosage] [Unit], [Frequency]." |
| Medication (status -> discontinued) | medication_stopped | "Discontinued [Medication Name]" | "Reason: [discontinue_reason]." |
| Medication (status -> completed) | medication_completed | "Completed [Medication Name]" | "Course completed. Started [start_date]." |
| WeightEntry | weight_recorded | "Weight: [X] [unit]" | "Change: [+/-Y] [unit] from previous." |
| GroomingRecord | grooming | "[Grooming Type label]" | "By [Groomer Name]. Cost: $[amount]." |

#### 3.7 Business Logic Rules

##### Timeline Event Aggregation

**Purpose:** Merge health events from all sources into a single sorted timeline.

**Inputs:**
- pet_id: string
- filters: { event_types: enum[], date_range: { start, end }, search_query: string }

**Logic:**

```
1. QUERY VaccinationRecords WHERE pet_id = pet_id -> CREATE vaccination events
2. QUERY VetVisits WHERE pet_id = pet_id -> CREATE vet_visit events
3. QUERY Medications WHERE pet_id = pet_id:
     - CREATE medication_started event using created_at date
     - IF status = "discontinued" THEN CREATE medication_stopped event using updated_at date
     - IF status = "completed" THEN CREATE medication_completed event using updated_at date
4. QUERY WeightEntries WHERE pet_id = pet_id -> CREATE weight_recorded events
5. QUERY GroomingRecords WHERE pet_id = pet_id -> CREATE grooming events
6. MERGE all events into a single list
7. APPLY filters:
     a. IF event_types filter is active THEN filter by matching types
     b. IF date_range is set THEN filter by date within range
     c. IF search_query is set THEN filter by title or description containing query (case-insensitive)
8. SORT by date descending (newest first)
9. RETURN { events, total_count, filtered_count }
```

**Edge Cases:**
- No events from any source: Return empty list
- Multiple events on the same day: All shown, ordered by event_type priority (vet_visit > vaccination > medication > weight > grooming)
- Medication started and stopped on the same day: Both events appear

##### Significant Event Detection

**Purpose:** Flag health events that deserve extra attention.

**Logic:**

```
1. FOR each event:
     a. IF event_type = "vet_visit" AND source.reason IN ("emergency", "surgery") THEN is_significant = true
     b. IF event_type = "medication_stopped" THEN is_significant = true
     c. IF event_type = "weight_recorded":
          COMPUTE weight_change_pct from previous entry
          IF abs(weight_change_pct) > 10 THEN is_significant = true
     d. ELSE is_significant = false
```

**Edge Cases:**
- First weight entry (no previous): Not significant (no comparison available)
- Multiple significant events on the same day: All flagged individually

##### Timeline Export Formatting

**Purpose:** Generate a text representation of the health timeline for sharing.

**Logic:**

```
1. GENERATE header: "[Pet Name]'s Health Timeline - Generated [today's date]"
2. FOR each event in chronological order (oldest first for export):
     FORMAT: "[date] - [event_type_label]: [title]"
     IF description is not empty: append "  [description]" on next line
     IF is_significant: append " [!]" marker
3. RETURN formatted text
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Date, newest first
- **Display sort:** Timeline always shows newest first (cannot be changed)
- **Filter options:** By event type (multi-select), by date range, by search query
- **Search:** title, description - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Query fails for one source (e.g., medications) | Timeline loads with events from other sources; warning: "Some events could not be loaded" | User can retry via pull-to-refresh |
| Export generation fails | Toast: "Could not generate export. Please try again." | User retries export |
| Search yields no results | "No events match '[query]'" with "Clear Search" button | User clears search or adjusts terms |
| Timeline is empty | Message with prompts to add first health record | User navigates to add a vaccination, vet visit, or medication |
| Share sheet fails to open | Toast: "Could not open share options. Export text copied to clipboard." | User pastes from clipboard |

**Validation Timing:**
- Timeline regenerates on screen load and pull-to-refresh
- Filters apply immediately on toggle
- Search applies with 300ms debounce on keystroke

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** Luna has 3 vaccinations, 2 vet visits, 1 active medication, and 5 weight entries,
   **When** the user views the health timeline,
   **Then** 11+ events appear in chronological order (newest first) with type-specific icons and descriptions.

2. **Given** the user selects the "Vaccinations" filter,
   **When** the timeline updates,
   **Then** only the 3 vaccination events are shown, with count "Showing 3 of 11 events".

3. **Given** a vet visit with reason "emergency" exists,
   **When** the user views the timeline,
   **Then** the emergency vet visit event has a yellow star significant indicator.

4. **Given** the user taps the export icon and selects "Detailed Text",
   **When** the export generates,
   **Then** a share sheet opens with formatted text listing all health events in chronological order.

**Edge Cases:**

5. **Given** Luna has a weight entry showing a 12% drop from the previous entry,
   **When** the user views the timeline,
   **Then** the weight event is flagged as significant with a yellow star.

6. **Given** medications were started and discontinued on the same day,
   **When** the user views the timeline,
   **Then** both the "Started" and "Discontinued" events appear for that day.

**Negative Tests:**

7. **Given** no health events exist for a newly created pet,
   **When** the user views the health timeline,
   **Then** the empty state message appears with prompts to add records.

8. **Given** the user searches for "nonexistent term",
   **When** the timeline filters,
   **Then** "No events match 'nonexistent term'" is displayed with a "Clear Search" button.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates events from all sources | 3 vacc, 2 vet, 1 med, 5 weight, 1 groom | 13 events total (med generates start + possible stop) |
| sorts events newest first | events on Jan, Mar, Feb | order: Mar, Feb, Jan |
| filters by event type | filter: vaccination only, 13 events total | 3 events |
| filters by date range | range: Feb-Mar, events in Jan/Feb/Mar | only Feb and Mar events |
| search matches title | query: "Rabies", events with Rabies vaccination | 1 event returned |
| flags emergency vet visit as significant | reason: "emergency" | is_significant: true |
| flags weight change > 10% as significant | previous: 60, current: 52 | is_significant: true (13.3% drop) |
| does not flag weight change <= 10% | previous: 60, current: 57 | is_significant: false (5% drop) |
| generates export text correctly | 3 events | formatted text with header and 3 entries |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Timeline reflects new vaccination | 1. Add vaccination, 2. View timeline | New vaccination event appears at top |
| Timeline reflects medication lifecycle | 1. Start medication, 2. Discontinue it, 3. View timeline | Two events: "Started" and "Discontinued" |
| Filter + search combination | 1. Filter by vet_visit, 2. Search "dental" | Only vet visits with "dental" in title or description |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User presents complete health history to vet | 1. Build up 20+ health events over time, 2. Export timeline as detailed text, 3. Share via email | Vet receives a formatted chronological health record with all vaccinations, visits, medications, and weight changes. |
| Foster parent generates adoption handoff | 1. Track foster pet's health for 3 months, 2. Export timeline, 3. Print or share | Complete health timeline exported for new owner, including significant events highlighted. |

---

### PT-014: Breed-Specific Health Alerts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-014 |
| **Feature Name** | Breed-Specific Health Alerts |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to see common health conditions associated with my pet's breed and recommended screening ages, so that I can proactively discuss screenings with my vet and catch problems early.

**Secondary:**
> As a first-time pet owner, I want to understand what health risks my breed is prone to without having to research multiple medical websites, so that I can be an informed caregiver.

#### 3.3 Detailed Description

Breed-Specific Health Alerts provides breed-level health intelligence using a static lookup table embedded in the app. When a pet's breed is set and the breed exists in the lookup table, the feature displays a list of common health conditions for that breed, each with a brief description, recommended screening age range, screening frequency, and severity level (informational, moderate, serious).

The data covers the most common 50 dog breeds and 20 cat breeds. Each breed entry contains 3-8 health conditions. The health conditions are sourced from widely published veterinary references and are intended as educational awareness tools, not medical diagnoses.

Health alerts are displayed on the pet's profile detail screen as a collapsible "Breed Health" section. Users can tap a condition to see more details, including a brief description, typical symptoms to watch for, recommended screening type (e.g., "Hip X-ray", "Blood panel", "Eye exam"), and the suggested age range for first screening.

Age-based alerts trigger when a pet reaches a recommended screening age. For example, if a Golden Retriever should have hip dysplasia screening at 24 months, the system generates a notification 30 days before the pet turns 24 months old. These alerts appear in the Multi-Pet Dashboard (PT-012) alerts section.

Users can dismiss individual health alerts (mark as "reviewed" or "not applicable"). Dismissed alerts do not generate reminders but remain accessible via a "Show dismissed" toggle.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - Pet must have breed and date_of_birth set

**External Dependencies:**
- None (all data is static, embedded in the app)

**Assumed Capabilities:**
- Static breed health data is bundled with the app
- Local notification system for age-based screening reminders

#### 3.5 User Interface Requirements

##### Screen: Breed Health Alerts (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Breed Health" with pet breed subtitle
- Breed info card: breed name, typical lifespan range, brief breed description (1-2 sentences)
- Toggle: "Show dismissed alerts" (default off)
- Scrollable list of health condition cards, sorted by screening urgency
- Each condition card:
  - Severity indicator (left color bar: blue = informational, yellow = moderate, red = serious)
  - Condition name (bold)
  - Brief description (2-3 sentences)
  - "Screen at: [age range]" with screening type
  - Status badge: "Upcoming" (approaching screening age), "Due Now" (within screening window), "Past Window" (past recommended screening age without vet visit logged), "Reviewed" (user dismissed)
  - "Mark Reviewed" and "Learn More" buttons

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Breed Found | Breed in lookup table | Full list of conditions |
| Breed Not Found | Breed not in table | Message: "Health data is not available for [breed]. Consult your vet for breed-specific health guidance." |
| No Breed Set | Pet breed is null | Message: "Set your pet's breed in their profile to see breed-specific health information." with "Edit Profile" link |
| No DOB Set | Date of birth is null | Conditions shown without age-based alerts; message: "Set your pet's date of birth to receive age-based screening reminders." |
| All Reviewed | All conditions marked as reviewed | Message: "You've reviewed all breed health alerts. Stay proactive!" with toggle to show dismissed |
| Error | Data load fails | Toast: "Could not load breed health data." |

**Interactions:**
- Tap condition card: Expand to show full details (symptoms, screening type, recommendation source)
- Tap "Mark Reviewed": Condition card fades to muted style with "Reviewed" badge
- Tap "Show dismissed": Toggle reveals reviewed/dismissed conditions
- Tap "Learn More": Expand in-place to show additional detail (no external links, all content embedded)
- Tap "Edit Profile": Navigate to pet profile edit screen

**Transitions/Animations:**
- Condition card expand/collapse with smooth height transition (200ms)
- "Mark Reviewed" transitions the card to muted style (150ms fade)

#### 3.6 Data Requirements

##### Static Data: BreedHealthCondition (bundled, read-only)

| Field | Type | Description |
|-------|------|-------------|
| breed | string | Breed name (normalized, lowercase) |
| species | enum | dog or cat |
| condition_name | string | Name of the health condition |
| description | string | Brief description (2-3 sentences) |
| symptoms | string | Typical symptoms to watch for |
| severity | enum | informational, moderate, serious |
| screening_type | string | Recommended screening method |
| screening_age_months_start | integer | Earliest recommended screening age in months |
| screening_age_months_end | integer | Latest recommended screening age in months (0 = no upper limit) |
| screening_frequency | string | How often to screen (e.g., "Once", "Annually", "Every 2 years") |

##### Entity: BreedAlertDismissal (user-generated, persisted)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet |
| condition_name | string | Required, max 200 chars | None | The dismissed condition name |
| dismissed_at | datetime | Auto-set | Current timestamp | When the user dismissed this alert |
| note | string | Max 500 chars | null | User's note (e.g., "Discussed with Dr. Chen, not a concern") |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Relationships:**
- BreedAlertDismissal belongs to Pet (many-to-one via pet_id)
- BreedAlertDismissal references a BreedHealthCondition by condition_name + pet's breed

**Indexes:**
- BreedAlertDismissal: (pet_id, condition_name) - unique per pet per condition
- Static data: indexed by (species, breed) for lookup

**Validation Rules:**
- (pet_id, condition_name) must be unique for BreedAlertDismissal

**Example Data (static):**

```
{
  "breed": "golden retriever",
  "species": "dog",
  "condition_name": "Hip Dysplasia",
  "description": "A genetic condition where the hip joint does not develop properly, leading to arthritis and pain. Common in large breeds.",
  "symptoms": "Difficulty rising, reluctance to climb stairs, bunny-hopping gait, decreased activity, stiffness after rest",
  "severity": "serious",
  "screening_type": "Hip X-ray (OFA or PennHIP)",
  "screening_age_months_start": 24,
  "screening_age_months_end": 0,
  "screening_frequency": "Once (initial), then as recommended by vet"
}
```

#### 3.7 Business Logic Rules

##### Breed Health Data Lookup

**Purpose:** Retrieve health conditions for a pet's breed from the static lookup table.

**Inputs:**
- species: enum
- breed: string

**Logic:**

```
1. NORMALIZE breed: lowercase, trim whitespace
2. LOOKUP in static table WHERE species = species AND breed = normalized_breed
3. IF not found THEN TRY partial match (e.g., "golden" matches "golden retriever")
4. IF still not found THEN RETURN null
5. RETURN list of BreedHealthConditions
```

**Edge Cases:**
- Mixed breed: Return null (no breed-specific data)
- "Unknown" breed: Return null
- Breed name with extra whitespace: Normalized before lookup
- Partial breed match: Only used if exactly one breed matches

##### Screening Status Calculation

**Purpose:** Determine whether a screening is upcoming, due now, or past window based on pet age.

**Inputs:**
- pet_age_months: integer (computed from pet DOB)
- condition: BreedHealthCondition

**Logic:**

```
1. IF pet_age_months < condition.screening_age_months_start - 1 THEN status = "future"
2. IF pet_age_months >= condition.screening_age_months_start - 1
     AND pet_age_months < condition.screening_age_months_start THEN status = "upcoming"
3. IF pet_age_months >= condition.screening_age_months_start
     AND (condition.screening_age_months_end = 0 OR pet_age_months <= condition.screening_age_months_end) THEN status = "due_now"
4. IF condition.screening_age_months_end > 0 AND pet_age_months > condition.screening_age_months_end THEN status = "past_window"
5. RETURN status
```

**Edge Cases:**
- No DOB set: Cannot compute age, return status = "unknown" (show condition without age-based alert)
- screening_age_months_end = 0: No upper limit, "due_now" persists indefinitely after start age
- Pet younger than all screening ages: All conditions show "future" status

##### Age-Based Screening Reminder

**Purpose:** Generate a notification when a pet approaches a recommended screening age.

**Logic:**

```
1. FOR each active pet with breed in lookup table and DOB set:
     FOR each BreedHealthCondition for that breed:
        a. CHECK if dismissed (BreedAlertDismissal exists)
        b. IF dismissed THEN SKIP
        c. COMPUTE months_until_screening = screening_age_months_start - pet_age_months
        d. IF months_until_screening = 1 (approaching within 30 days):
             SCHEDULE notification:
             - Title: "[Pet Name] - Health Screening Reminder"
             - Body: "[Condition Name] screening recommended at [age]. Talk to your vet."
             - Fire date: pet DOB + screening_age_months_start - 30 days
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Severity (serious first), then screening urgency (due_now > upcoming > future > past_window)
- **Filter options:** All, Active only (excludes dismissed), By severity
- **Search:** condition_name, description - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Breed not in lookup table | Informational message: "Health data not available for this breed" | No action needed; user can consult their vet |
| No breed set on pet | Message with link to edit profile | User sets breed in profile |
| No DOB set on pet | Conditions shown without age-based status; info message | User sets DOB in profile |
| Dismiss write fails | Toast: "Could not save. Please try again." | User retries dismiss action |
| Static data fails to load | Toast: "Could not load breed health data." | User restarts app |

**Validation Timing:**
- Breed lookup occurs on screen load
- Screening status recalculated on each screen load (age changes daily)
- Dismiss action writes immediately

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** Luna is a Golden Retriever born 2024-04-15 (23 months old),
   **When** the user views Breed Health Alerts,
   **Then** a list of conditions appears including "Hip Dysplasia" with status "Upcoming" (due at 24 months).

2. **Given** Luna turns 24 months old,
   **When** the screening status recalculates,
   **Then** "Hip Dysplasia" status changes to "Due Now" and a notification fires.

3. **Given** the user marks "Hip Dysplasia" as reviewed with note "Discussed with Dr. Chen",
   **When** the user views the alerts list,
   **Then** "Hip Dysplasia" disappears from the default view and appears only when "Show dismissed" is toggled on.

**Edge Cases:**

4. **Given** a pet's breed is "Mixed" or not in the lookup table,
   **When** the user views Breed Health Alerts,
   **Then** the message "Health data is not available for this breed" is shown.

5. **Given** a pet has a breed set but no DOB,
   **When** the user views Breed Health Alerts,
   **Then** conditions are listed without age-based screening status, with a prompt to set DOB.

**Negative Tests:**

6. **Given** the user has already dismissed "Hip Dysplasia" for this pet,
   **When** the user tries to dismiss it again,
   **Then** nothing happens (idempotent, no duplicate dismissal created).

7. **Given** the breed lookup table is empty (data load failure),
   **When** the user views Breed Health Alerts,
   **Then** a toast appears: "Could not load breed health data."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| looks up Golden Retriever conditions | breed: "golden retriever", species: "dog" | list containing "Hip Dysplasia", "Cancer", etc. |
| returns null for unknown breed | breed: "Mixed" | null |
| normalizes breed name | breed: "  Golden Retriever  " | matches "golden retriever" |
| screening status future | age: 18 months, start: 24 | status: "future" |
| screening status upcoming | age: 23 months, start: 24 | status: "upcoming" |
| screening status due_now | age: 24 months, start: 24, end: 0 | status: "due_now" |
| screening status past_window | age: 36 months, start: 24, end: 30 | status: "past_window" |
| screening status unknown without DOB | DOB: null | status: "unknown" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| View breed alerts for Golden Retriever | 1. Add pet with breed Golden Retriever, DOB 24 months ago, 2. View alerts | Conditions listed with "Due Now" status for age-appropriate screenings |
| Dismiss and restore alert | 1. Dismiss "Hip Dysplasia", 2. Verify hidden, 3. Toggle "Show dismissed" | Alert hidden in default view, visible with toggle |
| Notification fires at screening age | 1. Add pet with DOB making them 23 months, 2. Wait/simulate 30 days | Notification: "Hip Dysplasia screening recommended at 24 months" |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New owner learns about breed health risks | 1. Add Golden Retriever, DOB 6 months, 2. View breed alerts | Sees 5-8 conditions with "future" status. Each expandable with symptoms and screening info. |
| Owner reviews all breed alerts over time | 1. Set up pet, 2. View alerts as pet ages, 3. Mark each as reviewed after vet discussion | All alerts marked reviewed. "Show dismissed" reveals full history. |

---

### PT-015: Photo Gallery

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-015 |
| **Feature Name** | Photo Gallery |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to store and browse photos of my pet organized by date, so that I can track their growth and revisit memories.

**Secondary:**
> As a multi-pet household member, I want to tag photos with milestones (e.g., "First day home", "1st birthday", "Learned to swim"), so that I can easily find and share special moments.

#### 3.3 Detailed Description

Photo Gallery provides a local photo storage and browsing experience for pet photos. Users add photos from their camera or photo library and associate them with a specific pet. Each photo can have a caption, a date, and one or more milestone tags.

Photos are displayed in a grid layout (3 columns) sorted by date (newest first). Tapping a photo opens a full-screen viewer with swipe navigation between photos. The full-screen view displays the caption, date, and milestone tags below the photo.

Milestone tags are predefined labels that users can attach to photos: "First Day Home", "Birthday", "Gotcha Day", "First Walk", "Learned to Swim", "First Snow", "Holiday", "Costume", "At the Vet", "With Friends", "Growth Check", and "Custom" (user-defined text). Multiple milestones can be attached to a single photo.

A timeline view presents photos chronologically with month/year headers, creating a visual growth journal. Users can filter photos by milestone tag or search by caption text.

All photos are stored locally in the app's storage directory. Photos are compressed on import to a maximum resolution of 2048x2048 pixels and JPEG quality of 80% to manage storage size. The original photo in the device's photo library is not modified.

A storage usage indicator shows total space consumed by pet photos, with a warning at 500 MB and a hard limit of 1 GB per pet.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - A pet must exist

**External Dependencies:**
- Camera or photo library access
- Local file system storage for photos
- Image compression capability

**Assumed Capabilities:**
- Image picker for camera and photo library is available
- File system operations (read, write, delete) are available
- Image resizing and JPEG compression are available

#### 3.5 User Interface Requirements

##### Screen: Photo Gallery (per pet)

**Layout:**
- Top navigation bar showing "[Pet Name]'s Photos" with camera icon (add) on the right
- Milestone filter chips: horizontal scrollable row of milestone tags (tappable to filter)
- Search icon that expands to a search bar
- Photo grid: 3 columns, square thumbnails, minimal gap (2px)
- Month/year section headers between groups of photos from different months
- Storage indicator at bottom: "X MB of 1 GB used" with progress bar

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No photos | Illustration of a camera, message "No photos yet", button "Add First Photo" |
| Populated | Photos exist | Grid of thumbnails with month headers |
| Filtered | Milestone filter active | Filtered grid with count: "Showing [X] photos with [milestone]" |
| Near Limit | Storage > 500 MB | Yellow warning: "Photo storage is getting full ([X] MB of 1 GB)" |
| At Limit | Storage >= 1 GB | Red warning: "Photo storage is full. Delete some photos to add more." Add button disabled. |
| Error | Photo load fails | Broken image placeholder for failed thumbnails |

**Interactions:**
- Tap camera icon: Action sheet: "Take Photo" or "Choose from Library"
- Tap photo thumbnail: Open full-screen viewer
- Tap milestone chip: Filter grid to photos with that milestone
- Long press photo: Select mode with multi-select checkboxes (for bulk delete or milestone tagging)
- Pinch to zoom on grid: Toggle between 3-column and 4-column layout

**Transitions/Animations:**
- Photo thumbnails fade in on load (staggered, 30ms per thumbnail)
- Grid to full-screen transitions with matched-geometry animation (photo expands from grid position)
- Delete animation: photo shrinks and fades (200ms), grid reflows

##### Screen: Full-Screen Photo Viewer

**Layout:**
- Full-screen photo display with dark background
- Swipe left/right to navigate between photos
- Bottom overlay: caption text, date, milestone tag badges
- Top-right: edit icon (pencil), delete icon (trash), share icon
- Tap anywhere toggles overlay visibility

##### Modal: Add/Edit Photo Details

**Layout:**
- Bottom sheet appearing after photo selection or on edit
- Form fields:
  1. Photo preview (large thumbnail)
  2. Caption (text input, optional, max 500 chars)
  3. Date (date picker, defaults to photo EXIF date or today, must be on or before today)
  4. Milestones (multi-select tag picker from predefined list + "Custom" option)
  5. Custom Milestone (text input, max 100 chars; visible only if "Custom" selected)

#### 3.6 Data Requirements

##### Entity: PetPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| pet_id | string | Required, references Pet.id | None | The pet this photo belongs to |
| file_path | string | Required, max 500 chars, valid file path | None | Path to stored photo file |
| thumbnail_path | string | Required, max 500 chars | None | Path to thumbnail version |
| caption | string | Max 500 chars | null | User-provided caption |
| date | date | Required, must be on or before today | Today | Date the photo was taken or assigned |
| milestones | string | JSON array of milestone strings, max 10 items | "[]" | Milestone tags attached to this photo |
| file_size_bytes | integer | Min: 0 | 0 | File size for storage tracking |
| width | integer | Min: 1 | 0 | Photo width in pixels |
| height | integer | Min: 1 | 0 | Photo height in pixels |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- PetPhoto belongs to Pet (many-to-one via pet_id)

**Indexes:**
- pet_id - per-pet listing
- (pet_id, date) - chronological listing
- date - time-range queries

**Validation Rules:**
- file_path: Must reference an existing file
- date: Must be on or before today
- milestones: Max 10 items per photo
- Storage limit: Total file_size_bytes for a pet must not exceed 1,073,741,824 (1 GB)

**Example Data:**

```
{
  "id": "ph-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "pet_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "file_path": "/data/pets/photos/luna/2026-03-01_001.jpg",
  "thumbnail_path": "/data/pets/photos/luna/thumbs/2026-03-01_001_thumb.jpg",
  "caption": "Luna's first snow day!",
  "date": "2026-03-01",
  "milestones": "[\"First Snow\"]",
  "file_size_bytes": 524288,
  "width": 2048,
  "height": 1536,
  "created_at": "2026-03-01T15:00:00Z",
  "updated_at": "2026-03-01T15:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Photo Import Processing

**Purpose:** Process imported photos by resizing, compressing, and generating thumbnails.

**Inputs:**
- source_image: image file (from camera or photo library)
- pet_id: string

**Logic:**

```
1. CHECK storage limit:
     QUERY SUM(file_size_bytes) FROM PetPhotos WHERE pet_id = pet_id
     IF current_total >= 1,073,741,824 (1 GB) THEN REJECT with storage full error
2. EXTRACT EXIF date from source_image (if available)
3. RESIZE image:
     IF width > 2048 OR height > 2048 THEN
       SCALE proportionally so longest side = 2048
4. COMPRESS to JPEG at 80% quality
5. GENERATE thumbnail: 300x300 center-cropped, JPEG 70% quality
6. SAVE full image to /data/pets/photos/{pet_id}/{date}_{uuid}.jpg
7. SAVE thumbnail to /data/pets/photos/{pet_id}/thumbs/{date}_{uuid}_thumb.jpg
8. RECORD file_size_bytes = size of full image file
9. CREATE PetPhoto record
```

**Formulas:**
- Thumbnail size: 300x300 center-crop
- Full image max dimension: 2048px (longest side)
- JPEG quality: 80% (full), 70% (thumbnail)
- Storage limit per pet: 1 GB (1,073,741,824 bytes)
- Storage warning threshold: 500 MB (524,288,000 bytes)

**Edge Cases:**
- Image smaller than 2048px: No resize needed, still compress to JPEG 80%
- No EXIF date: Default to today
- Image is already JPEG: Still reprocess for consistent quality
- PNG or HEIC source: Convert to JPEG
- Storage nearly full: Show warning but allow add until hard limit

##### Storage Usage Calculation

**Purpose:** Track photo storage consumption per pet.

**Inputs:**
- pet_id: string

**Logic:**

```
1. QUERY SUM(file_size_bytes) FROM PetPhotos WHERE pet_id = pet_id
2. total_mb = total_bytes / 1,048,576
3. usage_pct = (total_bytes / 1,073,741,824) * 100
4. IF usage_pct >= 100 THEN status = "full"
5. ELSE IF total_mb >= 500 THEN status = "warning"
6. ELSE status = "normal"
7. RETURN { total_bytes, total_mb, usage_pct, status, remaining_bytes }
```

##### Photo Deletion

**Purpose:** Remove photo files and database records.

**Logic:**

```
1. DELETE file at photo.file_path
2. DELETE file at photo.thumbnail_path
3. DELETE PetPhoto record from database
4. IF file deletion fails: Log warning, still delete database record (orphaned file cleanup can happen later)
```

**Sort/Filter/Ranking Logic:**
- **Default sort:** Date, newest first
- **Available sort options:** Date (newest/oldest), Date added (newest/oldest)
- **Filter options:** All, By milestone tag
- **Search:** caption - substring matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Photo import fails | Toast: "Could not save photo. Please try again." | User retries import |
| Storage limit reached | Dialog: "Photo storage for [Pet Name] is full (1 GB). Delete some photos to add more." | User deletes photos or dismisses dialog |
| Storage near limit | Yellow banner: "Photo storage is getting full (X MB of 1 GB)" | User can continue or proactively delete |
| Photo file missing from disk | Broken image placeholder in grid; option to "Remove Entry" | User removes orphaned database record |
| Thumbnail generation fails | Full photo used as thumbnail (slower loading) | Automatic fallback, no user action |
| Camera/library permission denied | Dialog: "MyPets needs access to your photos. Enable in Settings." with "Open Settings" button | User grants permission in device settings |

**Validation Timing:**
- Storage check runs before photo import
- File existence check runs on gallery load (background)
- Date validation runs on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a pet "Luna" exists,
   **When** the user takes a new photo and adds caption "Beach day!" with milestone "First Swim",
   **Then** the photo appears in the gallery grid, the full-screen view shows caption and milestone badge, and storage usage increases.

2. **Given** 20 photos exist for Luna spanning 3 months,
   **When** the user views the gallery,
   **Then** photos are displayed in a 3-column grid with month/year section headers (e.g., "March 2026", "February 2026", "January 2026").

3. **Given** a photo has milestone "Birthday" attached,
   **When** the user taps the "Birthday" filter chip,
   **Then** only photos with the "Birthday" milestone are shown.

**Edge Cases:**

4. **Given** Luna's photo storage is at 510 MB,
   **When** the user views the gallery,
   **Then** a yellow warning banner shows "Photo storage is getting full (510 MB of 1 GB)".

5. **Given** Luna's photo storage is at 1 GB,
   **When** the user tries to add a new photo,
   **Then** a dialog says "Photo storage for Luna is full" and the import is blocked.

**Negative Tests:**

6. **Given** the user denies camera access,
   **When** the user taps the camera icon,
   **Then** a dialog explains the permission requirement with a link to device settings.

7. **Given** a photo file has been externally deleted from disk,
   **When** the user views the gallery,
   **Then** a broken image placeholder appears for that photo with an option to "Remove Entry".

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| resizes image larger than 2048 | 4000x3000 image | 2048x1536 output |
| does not resize image smaller than 2048 | 1200x800 image | 1200x800 output (still compressed) |
| calculates storage usage correctly | 3 photos: 200KB, 300KB, 500KB | total: 1000KB, 0.98 MB, 0.09% |
| storage status normal | total: 200 MB | status: "normal" |
| storage status warning | total: 510 MB | status: "warning" |
| storage status full | total: 1024 MB | status: "full" |
| generates thumbnail at 300x300 | 2048x1536 source | 300x300 center-cropped thumbnail |
| validates date not in future | date: tomorrow | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Import photo and verify storage | 1. Import 500KB photo, 2. Check storage | Storage increases by compressed file size |
| Delete photo and verify cleanup | 1. Import photo, 2. Delete, 3. Check files, 4. Check storage | File + thumbnail removed, storage decreases, record deleted |
| Filter by milestone | 1. Add 3 photos: 1 with "Birthday", 2 without, 2. Filter by "Birthday" | 1 photo shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User builds photo gallery over 6 months | 1. Add 30 photos across 6 months with various milestones, 2. Browse gallery | 3-column grid with month headers. Storage shows correct usage. Milestone filters work. |
| User hits storage limit | 1. Add photos until ~1 GB reached, 2. Attempt to add more | Warning shown at 500 MB. Hard block at 1 GB with explanation. |

---

### PT-016: Pet Sitter Info Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-016 |
| **Feature Name** | Pet Sitter Info Export |
| **Priority** | P2 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner leaving my pets with a sitter, I want to generate a comprehensive care instruction card that includes feeding schedules, medications, emergency contacts, dietary restrictions, and daily routines, so that the sitter has everything they need in one document.

**Secondary:**
> As a pet sitter, I want to receive clear, organized care instructions that I can reference quickly during emergencies, so that I can provide proper care without guessing.

#### 3.3 Detailed Description

Pet Sitter Info Export generates a shareable document containing all essential care information for one or more pets. The user selects which pets to include, which sections to include, and the date range (e.g., "March 15-22"), then generates a formatted care card.

The care card includes the following sections (all optional, all included by default):
1. **Pet Overview:** Name, photo, breed, age, weight, microchip ID, special notes
2. **Feeding:** Meal times, food brands, portions, dietary allergies, special instructions
3. **Medications:** Active medications with dosage, frequency, dose times, and administration notes
4. **Emergency Contacts:** Primary vet, emergency vet, poison control, owner contact
5. **Daily Routine:** Typical walk/exercise times, grooming needs, behavioral notes
6. **Medical Info:** Active health conditions, recent vet visits, vaccination status

The generated document is a plain-text formatted card that can be shared via the device's share sheet (text, email, print, messaging). No data is uploaded to any server. The card is generated entirely on-device.

Users can save sitter card templates for reuse. A template stores which sections are included and any custom notes, but regenerates live data each time it is exported.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - Pet data
- PT-004: Medication Tracking & Reminders - Active medications
- PT-006: Feeding Schedule & Reminders - Feeding times and dietary info
- PT-011: Emergency Vet Contacts - Emergency contacts

**External Dependencies:**
- Device share sheet for export
- Text formatting capability

**Assumed Capabilities:**
- Data from all prerequisite features is queryable
- Share sheet is available on the platform

#### 3.5 User Interface Requirements

##### Screen: Generate Sitter Card

**Layout:**
- Top navigation bar showing "Pet Sitter Card" with "Generate" button on the right
- Pet selector: multi-select from active pet list (at least 1 required)
- Date range: "From" and "To" date pickers (optional; for display on the card)
- Section toggles: checkboxes for each section (all on by default)
  1. Pet Overview (always included, cannot be unchecked)
  2. Feeding Schedule
  3. Medications
  4. Emergency Contacts
  5. Daily Routine
  6. Medical Info
- Owner contact section:
  1. Owner Name (text input, optional, max 100 chars)
  2. Owner Phone (phone input, optional, max 20 chars)
  3. Owner Email (text input, optional, max 200 chars)
- Custom Notes (multiline text, optional, max 2000 chars, e.g., "Luna is afraid of fireworks", "Spare key under the mat")
- "Preview" button: shows a preview of the generated card
- "Save as Template" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Form ready for configuration | All sections checked, no pets selected |
| Preview | User tapped "Preview" | Full card preview in a scrollable view |
| No Pets | No active pets exist | Redirect to pet creation |

**Interactions:**
- Tap "Generate": Generate the card and open share sheet
- Tap "Preview": Show read-only preview of the generated text
- Tap "Save as Template": Save current configuration for reuse
- Tap pet name: Toggle selection

##### Screen: Card Preview

**Layout:**
- Scrollable text preview with formatted sections
- Header: "Care Instructions for [Pet Names]" + date range
- Each section with clear headers and organized content
- "Share" button (opens share sheet) and "Close" button

#### 3.6 Data Requirements

##### Entity: SitterCardTemplate

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID, auto-generated | Auto | Unique identifier |
| name | string | Required, max 100 chars | None | Template name |
| pet_ids | string | JSON array of Pet.id strings | "[]" | Pets included in this template |
| include_feeding | boolean | - | true | Include feeding section |
| include_medications | boolean | - | true | Include medications section |
| include_emergency | boolean | - | true | Include emergency contacts section |
| include_routine | boolean | - | true | Include daily routine section |
| include_medical | boolean | - | true | Include medical info section |
| owner_name | string | Max 100 chars | null | Owner contact name |
| owner_phone | string | Max 20 chars | null | Owner phone |
| owner_email | string | Max 200 chars | null | Owner email |
| custom_notes | string | Max 2000 chars | null | Additional notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- SitterCardTemplate references Pet (many-to-many via pet_ids JSON array)

**Indexes:**
- name - template lookup
- created_at - sort templates by most recent

**Validation Rules:**
- name: Must not be empty
- pet_ids: Must contain at least 1 valid pet ID

#### 3.7 Business Logic Rules

##### Card Generation

**Purpose:** Compile care instructions from multiple data sources into a formatted document.

**Inputs:**
- pet_ids: string[]
- sections: { feeding, medications, emergency, routine, medical }
- owner_info: { name, phone, email }
- custom_notes: string
- date_range: { from, to }

**Logic:**

```
1. GENERATE header:
     "CARE INSTRUCTIONS FOR [PET NAMES]"
     "[date_range.from] to [date_range.to]" (if set)
     "Generated: [today's date]"
2. FOR each pet in pet_ids:
     a. SECTION: Pet Overview (always included)
        - Name, breed, age, weight, microchip ID
        - Special notes from pet profile
     b. IF sections.feeding THEN:
        - QUERY FeedingSchedules for pet
        - QUERY DietaryInfo for pet
        - FORMAT: meal times, food names, portions, allergies, restrictions, special instructions
     c. IF sections.medications THEN:
        - QUERY active Medications for pet
        - FORMAT: medication name, dosage, frequency, dose times, instructions
     d. IF sections.emergency THEN:
        - QUERY EmergencyContacts (global + pet-specific)
        - FORMAT: contact name, phone, address, hours
     e. IF sections.routine THEN:
        - QUERY ExerciseGoal for pet
        - QUERY recent ExerciseLogs for typical walk times
        - FORMAT: typical walk schedule, exercise needs, behavioral notes
     f. IF sections.medical THEN:
        - QUERY recent VetVisits (last 3)
        - QUERY VaccinationRecords (status summary)
        - FORMAT: vaccination status, recent visits, ongoing conditions
3. IF owner_info provided THEN append owner contact section
4. IF custom_notes provided THEN append custom notes section
5. RETURN formatted text
```

**Edge Cases:**
- Feature not configured (e.g., no feeding schedule): Section shows "No feeding schedule configured"
- Pet has no medications: Section shows "No active medications"
- No emergency contacts added: Section shows Poison Control only (system default)

**Sort/Filter/Ranking Logic:**
- Templates sorted by updated_at (most recent first)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No pets selected | Inline validation: "Select at least one pet" | User selects a pet |
| Data query fails for one section | Card generates with placeholder: "[Section] data could not be loaded" | User retries generation |
| Share sheet fails | Toast: "Could not open sharing. Card text copied to clipboard." | User pastes from clipboard |
| Template save fails | Toast: "Could not save template. Please try again." | User retries |

**Validation Timing:**
- Pet selection validated on "Generate" tap
- Template name validated on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** Luna has feeding schedules, active medications, and emergency contacts configured,
   **When** the user generates a sitter card with all sections included,
   **Then** a formatted text card is generated containing all of Luna's care information organized by section.

2. **Given** the user configures a card for Luna and Max,
   **When** the user taps "Share",
   **Then** the device share sheet opens with the formatted card text ready to send.

3. **Given** the user saves a template named "Weekend Trip",
   **When** the user returns to generate another card,
   **Then** the "Weekend Trip" template is available with all previous settings pre-filled.

**Edge Cases:**

4. **Given** Luna has no active medications,
   **When** the sitter card is generated with medications section enabled,
   **Then** the medications section shows "No active medications".

5. **Given** no emergency contacts exist except the system Poison Control,
   **When** the card includes emergency contacts,
   **Then** only ASPCA Poison Control appears in the emergency section.

**Negative Tests:**

6. **Given** no pets are selected,
   **When** the user taps "Generate",
   **Then** validation shows "Select at least one pet"
   **And** no card is generated.

7. **Given** the share sheet fails to open,
   **When** the user taps "Share",
   **Then** a toast shows "Could not open sharing. Card text copied to clipboard."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates header with pet name | pet: "Luna", dates: Mar 15-22 | "CARE INSTRUCTIONS FOR LUNA\nMarch 15 to March 22, 2026" |
| includes feeding section | pet with 2 meals | text contains meal times, food names, portions |
| includes medications section | pet with 1 active med | text contains medication name, dosage, schedule |
| includes emergency contacts | 2 contacts + poison control | text contains all 3 contacts with phone numbers |
| handles missing feeding data | no feeding schedule | section shows "No feeding schedule configured" |
| handles missing medications | no active medications | section shows "No active medications" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full card generation for pet with all data | 1. Set up pet with feeding, meds, contacts, 2. Generate card | Complete card with all sections populated |
| Save and reload template | 1. Configure card, 2. Save template, 3. Reload | Template restores all settings |
| Multi-pet card | 1. Select 2 pets, 2. Generate | Card contains sections for both pets |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Owner prepares for vacation | 1. Set up Luna fully, 2. Generate sitter card, 3. Share via Messages | Sitter receives formatted text with all care instructions for Luna. |
| Reuse template for weekend trip | 1. Save "Weekend" template, 2. Weeks later, generate from template | Template loads, card generates with current data (new meds reflected). |

---

### PT-017: Data Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-017 |
| **Feature Name** | Data Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to export all my pet data in a standard format (CSV and JSON), so that I own my data and can migrate it or back it up.

**Secondary:**
> As a foster parent, I want to export a specific pet's complete records, so that I can provide the adopting family with all health and care data in a portable format.

#### 3.3 Detailed Description

Data Export allows users to export their complete pet data in CSV or JSON format. Users can export all data for all pets, all data for a specific pet, or specific data categories (profiles, vaccinations, vet visits, medications, weight history, feeding schedules, grooming records, training sessions, expenses).

The export generates a ZIP file containing one file per entity type. CSV exports include a header row with column names. JSON exports use a structured format with metadata (export date, app version, pet count).

Export is initiated from the Settings screen or from an individual pet's profile. The generated file is shared via the device's share sheet.

The export format is documented and stable, ensuring data portability. The schema version is included in each export to enable future import compatibility.

#### 3.4 Prerequisites

**Feature Dependencies:**
- PT-001: Pet Profile Management - Pet data to export

**External Dependencies:**
- File system access for temporary ZIP creation
- Device share sheet for file sharing

**Assumed Capabilities:**
- ZIP file creation is available
- CSV and JSON serialization is available

#### 3.5 User Interface Requirements

##### Screen: Export Data

**Layout:**
- Top navigation bar showing "Export Data"
- Scope selector: "All Pets" or specific pet picker
- Format selector: "CSV" | "JSON"
- Section checkboxes (all checked by default):
  1. Pet Profiles
  2. Vaccination Records
  3. Vet Visits
  4. Medications & Dose Logs
  5. Weight History
  6. Feeding Schedules & Logs
  7. Grooming Records
  8. Training Sessions & Commands
  9. Expenses
  10. Emergency Contacts
  11. Photos (warning: may be large)
- Summary: "Estimated export size: ~X MB"
- "Export" button (primary, full-width)
- Progress bar during export (visible while generating)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | User has configured options | Export button enabled, size estimate shown |
| Exporting | Export in progress | Progress bar with percentage, "Cancel" button |
| Complete | Export finished | Share sheet opens with ZIP file |
| Error | Export fails | Toast: "Export failed. Please try again." |
| No Data | No pets exist | Message: "No data to export" |

**Interactions:**
- Tap "Export": Begin export, show progress bar
- Tap "Cancel" during export: Cancel and clean up partial file
- Share sheet: Save to Files, AirDrop, email, etc.

#### 3.6 Data Requirements

Data Export does not introduce new persistent entities. It reads all existing entities and serializes them.

**Export File Structure (ZIP contents):**

```
mypets-export-2026-03-06/
  metadata.json          # { export_date, app_version, schema_version, pet_count }
  pets.csv (or .json)
  vaccinations.csv
  vet_visits.csv
  medications.csv
  dose_logs.csv
  weight_entries.csv
  weight_goals.csv
  feeding_schedules.csv
  feeding_logs.csv
  dietary_info.csv
  food_transitions.csv
  grooming_records.csv
  grooming_intervals.csv
  exercise_logs.csv
  exercise_goals.csv
  training_commands.csv
  training_sessions.csv
  training_session_commands.csv
  expenses.csv
  emergency_contacts.csv
  sitter_card_templates.csv
  photos/               # (optional, if photos section selected)
    {pet_id}/
      {photo_filename}
```

#### 3.7 Business Logic Rules

##### Export Generation

**Purpose:** Generate a ZIP file containing exported data.

**Inputs:**
- pet_ids: string[] (all or specific)
- format: "csv" | "json"
- sections: boolean map of which sections to include
- include_photos: boolean

**Logic:**

```
1. CREATE temporary directory: /tmp/mypets-export-{timestamp}/
2. GENERATE metadata.json:
     { export_date, app_version: "1.0", schema_version: 1, pet_count, format }
3. FOR each selected section:
     a. QUERY data (filtered by pet_ids if not "all")
     b. IF format = "csv" THEN serialize to CSV with header row
     c. IF format = "json" THEN serialize to JSON array
     d. WRITE file to temp directory
4. IF include_photos THEN:
     a. FOR each PetPhoto belonging to selected pets:
        COPY photo file to temp/photos/{pet_id}/
     b. UPDATE size estimate
5. CREATE ZIP file from temp directory
6. OPEN share sheet with ZIP file
7. ON share complete or cancel: DELETE temp directory
```

**Edge Cases:**
- No data for a section: Write file with header only (CSV) or empty array (JSON)
- Photo files missing: Skip missing files, log warning
- Export cancelled mid-way: Clean up temporary directory
- Very large export (many photos): Show progress and estimated time

##### Export Size Estimation

**Purpose:** Provide an estimated export size before generating.

**Logic:**

```
1. ESTIMATE data size:
     - Each record ~200 bytes (CSV) or ~400 bytes (JSON)
     - Total = record_count * bytes_per_record
2. IF photos included THEN:
     ADD SUM(file_size_bytes) from PetPhotos for selected pets
3. RETURN estimated_mb = total_bytes / 1,048,576
```

**Sort/Filter/Ranking Logic:**
- N/A (export does not have sort/filter; it exports raw data)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Not enough disk space for temp files | Toast: "Not enough storage to generate export. Free up space and try again." | User frees disk space |
| ZIP creation fails | Toast: "Export failed. Please try again." | User retries |
| Share sheet fails | Toast: "Could not share export. File saved to Documents." | User finds file in Documents |
| Single section query fails | Warning in export: "[Section] could not be exported" | Other sections still exported; user retries for failed section |
| Photos section makes export too large | Warning before export: "Including photos will make the export ~X MB. Continue?" | User can uncheck photos |

**Validation Timing:**
- Size estimation on section toggle
- Disk space check before export begins

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** 2 pets with data across all sections,
   **When** the user exports all data as CSV,
   **Then** a ZIP file is generated with CSV files for every entity type, and the share sheet opens.

2. **Given** the user selects only Luna and format "JSON",
   **When** the export completes,
   **Then** all files contain only Luna's data, and metadata.json shows pet_count: 1.

3. **Given** the user includes photos in the export,
   **When** the export completes,
   **Then** the ZIP contains a photos/ directory with all of Luna's photos.

**Edge Cases:**

4. **Given** a pet has no vaccination records,
   **When** the user exports including vaccinations,
   **Then** the vaccinations.csv file contains only the header row (no data rows).

5. **Given** the estimated export size is 200 MB (due to photos),
   **When** the user starts the export,
   **Then** a warning appears: "This export is approximately 200 MB. Continue?"

**Negative Tests:**

6. **Given** insufficient disk space,
   **When** the user taps "Export",
   **Then** a toast shows "Not enough storage to generate export."
   **And** no partial files are left behind.

7. **Given** no pets exist,
   **When** the user opens the export screen,
   **Then** a message shows "No data to export" and the export button is disabled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| serializes pet to CSV row | pet record | CSV row with all fields, header matches |
| serializes pet to JSON object | pet record | JSON object with all fields |
| estimates size correctly | 100 records, no photos | ~20 KB CSV / ~40 KB JSON |
| estimates size with photos | 100 records + 50 MB photos | ~50 MB total |
| generates valid ZIP structure | export data | ZIP contains metadata.json + entity files |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full export and verify contents | 1. Add 2 pets with various data, 2. Export as CSV, 3. Verify ZIP | ZIP contains all expected files with correct row counts |
| Pet-specific export | 1. Add 2 pets, 2. Export Luna only, 3. Verify | Only Luna's records in each file |
| Export with photos | 1. Add photos, 2. Export with photos, 3. Verify ZIP | photos/ directory contains correct files |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User backs up all pet data | 1. Populate app with data for 3 pets, 2. Export all as JSON | ZIP file shared via share sheet. All entity files present with correct data. |
| Foster parent exports single pet | 1. Select foster pet, 2. Export as CSV including medical sections | ZIP contains only that pet's data, suitable for handoff. |

---

### PT-018: Settings & Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | PT-018 |
| **Feature Name** | Settings & Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a pet owner, I want to configure my default weight unit (lbs/kg), distance unit (mi/km), and notification preferences, so that the app matches my regional conventions and notification habits.

**Secondary:**
> As a user, I want to delete all my data from the module with a single action, so that I can start fresh or remove my data before uninstalling.

#### 3.3 Detailed Description

Settings & Preferences provides a centralized configuration screen for user-level preferences that affect the entire MyPets module. Settings are divided into sections: Units, Notifications, Data Management, and About.

**Units:** Default weight unit (lbs or kg) and default distance unit (mi or km). These defaults apply when creating new weight entries or exercise logs. Existing entries retain their original units and are converted for display.

**Notifications:** Global notification toggle (master on/off for all MyPets notifications), quiet hours (start and end time during which no notifications are delivered), and default reminder lead time.

**Data Management:** Export all data (links to PT-017), delete all pet data (with confirmation), and storage usage summary showing total database size and photo storage per pet.

**About:** Module version, privacy policy link (embedded text), and open source licenses (if applicable).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this feature is independent)

**External Dependencies:**
- Local storage for preferences
- Local notification system for notification settings

**Assumed Capabilities:**
- Preferences storage (key-value) is available
- Notification system can be configured

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- Scrollable settings screen with section headers
- Section 1 - "Units":
  - Weight Unit: Toggle "lbs" | "kg" (default: lbs)
  - Distance Unit: Toggle "mi" | "km" (default: mi)
- Section 2 - "Notifications":
  - Master Toggle: "Enable Notifications" (default: on)
  - Quiet Hours: "From [time] to [time]" (default: 10:00 PM to 7:00 AM)
  - Default Reminder Lead: Picker (1 day, 3 days, 1 week, 2 weeks; default: 1 week)
- Section 3 - "Data":
  - "Export All Data" row (tappable, navigates to PT-017)
  - "Storage Usage" row: "Database: X MB, Photos: Y MB" (tappable for per-pet breakdown)
  - "Delete All Data" row (red text, tappable)
- Section 4 - "About":
  - "Version: 1.0.0"
  - "Privacy Policy" (tappable, opens embedded text)
  - "Licenses" (tappable, opens licenses screen)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | First launch, no settings changed | All values at defaults |
| Customized | User has changed settings | Settings reflect user choices |

**Interactions:**
- Tap unit toggle: Immediately saves preference; all screens using that unit update on next load
- Tap notification master toggle: Enable/disable all notifications module-wide
- Tap quiet hours: Open time picker for start and end
- Tap "Export All Data": Navigate to Export screen (PT-017)
- Tap "Storage Usage": Expand to show per-pet breakdown
- Tap "Delete All Data": Confirmation dialog with double confirmation

#### 3.6 Data Requirements

##### Entity: UserPreferences

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, singleton ("preferences") | "preferences" | Single row |
| weight_unit | enum | One of: lbs, kg | lbs | Default weight display unit |
| distance_unit | enum | One of: mi, km | mi | Default distance display unit |
| notifications_enabled | boolean | - | true | Master notification toggle |
| quiet_hours_start | string | HH:MM format | "22:00" | Quiet hours start time |
| quiet_hours_end | string | HH:MM format | "07:00" | Quiet hours end time |
| default_reminder_lead_days | integer | One of: 1, 3, 7, 14 | 7 | Default days before due date for reminders |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Indexes:**
- id (primary key, singleton)

**Validation Rules:**
- Only one row exists (singleton pattern, id = "preferences")
- quiet_hours_start and quiet_hours_end must be valid HH:MM
- Settings are created with defaults on first module load if not present

#### 3.7 Business Logic Rules

##### Delete All Data

**Purpose:** Remove all MyPets data from the device.

**Logic:**

```
1. SHOW confirmation dialog:
     "Delete All Pet Data?"
     "This will permanently delete all pets, health records, photos, and settings. This cannot be undone."
     Buttons: "Cancel" | "Delete Everything" (red)
2. IF user taps "Delete Everything" THEN:
     SHOW second confirmation:
     "Are you absolutely sure? Type DELETE to confirm."
     Text input that must match "DELETE" exactly.
3. IF confirmed THEN:
     BEGIN transaction
     DELETE all PetPhotos (and their files)
     DELETE all Expenses
     DELETE all GroomingRecords + GroomingIntervals
     DELETE all TrainingSessionCommands + TrainingSessions + TrainingCommands
     DELETE all ExerciseLogs + ExerciseGoals
     DELETE all FeedingLogs + FeedingSchedules + DietaryInfo + FoodTransitions
     DELETE all DoseLogs + Medications
     DELETE all WeightEntries + WeightGoals
     DELETE all VetVisits
     DELETE all VaccinationRecords
     DELETE all EmergencyContacts (including system)
     DELETE all BreedAlertDismissals
     DELETE all SitterCardTemplates
     DELETE all Pets
     RESET UserPreferences to defaults
     COMMIT transaction
4. Navigate to empty state (PT-001 empty state)
```

**Edge Cases:**
- Transaction fails mid-way: Roll back, show error, data preserved
- Photo files fail to delete: Continue with database deletion, log warning about orphaned files
- User cancels at either confirmation step: No data is deleted

##### Notification Quiet Hours Enforcement

**Purpose:** Suppress notification delivery during quiet hours.

**Logic:**

```
1. WHEN scheduling any notification:
     a. IF preferences.notifications_enabled = false THEN do not schedule
     b. COMPUTE fire_time for the notification
     c. IF fire_time falls within quiet_hours_start to quiet_hours_end:
          RESCHEDULE to quiet_hours_end on the same day (or next day if quiet hours span midnight)
```

**Edge Cases:**
- Quiet hours span midnight (e.g., 10 PM to 7 AM): Handle the wrap-around correctly
- Notifications master toggle off: Cancel all existing notifications, do not schedule new ones
- Notifications re-enabled: Reschedule all active medication/vaccination/grooming reminders

**Sort/Filter/Ranking Logic:**
- N/A (settings screen has no sort/filter)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Preference save fails | Toast: "Could not save setting. Please try again." | User retries; value reverts to previous |
| Delete all data fails | Toast: "Could not delete data. Please try again." All data preserved (transaction rolled back). | User retries deletion |
| Notification permission denied | Settings shows "Notifications: Disabled (System)" with link to system settings | User enables in device settings |
| Storage calculation fails | "Storage Usage: Unknown" | User retries by navigating away and back |

**Validation Timing:**
- Settings save immediately on change (no "Save" button)
- Delete all data requires two-step confirmation

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the default weight unit is lbs,
   **When** the user changes it to kg,
   **Then** the preference is saved immediately, and the next weight entry screen defaults to kg.

2. **Given** notifications are enabled,
   **When** the user sets quiet hours from 10:00 PM to 7:00 AM,
   **Then** no notifications are delivered between those times; any notification that would fire during quiet hours is delayed to 7:00 AM.

3. **Given** the user has 2 pets with full data,
   **When** the user initiates "Delete All Data", types "DELETE" in the confirmation,
   **Then** all pet data, photos, and settings are removed, and the app returns to the empty state.

**Edge Cases:**

4. **Given** the user changes distance unit to km,
   **When** viewing existing exercise entries logged in miles,
   **Then** distances are displayed in km (converted from stored miles) with correct conversion.

5. **Given** the notification master toggle is off,
   **When** the user creates a medication with reminders,
   **Then** the medication is saved but no notification is scheduled.

**Negative Tests:**

6. **Given** the delete confirmation dialog is open,
   **When** the user types "delete" (lowercase) in the confirmation field,
   **Then** the delete button remains disabled (must be exact "DELETE").

7. **Given** the delete transaction fails,
   **When** the error occurs mid-deletion,
   **Then** all data is rolled back and preserved, with a toast explaining the failure.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| defaults to lbs | fresh install | weight_unit: "lbs" |
| defaults to mi | fresh install | distance_unit: "mi" |
| saves weight unit change | change to kg | weight_unit: "kg" persisted |
| quiet hours span midnight | start: 22:00, end: 07:00, fire: 23:00 | rescheduled to 07:00 next day |
| quiet hours same day | start: 13:00, end: 15:00, fire: 14:00 | rescheduled to 15:00 same day |
| fire time outside quiet hours | start: 22:00, end: 07:00, fire: 12:00 | no rescheduling |
| validates DELETE confirmation | input: "delete" | rejected (case-sensitive) |
| validates DELETE confirmation | input: "DELETE" | accepted |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Change weight unit affects new entries | 1. Change to kg, 2. Add weight entry | Weight entry defaults to kg |
| Delete all data clears everything | 1. Add 2 pets with data, 2. Delete all, 3. Query all tables | All tables empty, photos deleted, settings reset |
| Disable notifications cancels all | 1. Set up medications with reminders, 2. Toggle notifications off | All pending notifications cancelled |
| Re-enable notifications reschedules | 1. Disable notifications, 2. Re-enable | All active medication/vaccination reminders rescheduled |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User configures app for metric units | 1. Change weight to kg, distance to km, 2. Use app normally | All new entries default to metric. Existing entries display converted values. |
| User performs factory reset | 1. Build up extensive data, 2. Delete all data with double confirmation | App returns to fresh state. No data remains. Settings at defaults. |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Pet** entity. Each pet serves as the anchor for all pet-specific records: vaccinations, vet visits, medications, weight history, feeding schedules, exercise logs, grooming records, training data, expenses, and photos. Deleting a pet cascades to remove all associated records.

Supporting entities include **EmergencyContact** (global, optionally associated with pets), **UserPreferences** (singleton), **SitterCardTemplate** (references pets), and **BreedAlertDismissal** (per-pet dismissal of breed health alerts).

Medications have a child entity **DoseLog** for individual dose tracking. Feeding schedules have child **FeedingLog** entries. Training sessions link to commands via the junction entity **TrainingSessionCommand**. Grooming uses a parallel **GroomingInterval** entity for scheduling separate from the **GroomingRecord** log.

Expenses can be auto-captured from VetVisit and GroomingRecord entries via source_type/source_id linkage, creating a lightweight polymorphic association.

### 4.2 Complete Entity Definitions

All entities are defined in their respective feature specifications (Section 3). The canonical entity list with table prefix `pt_`:

| Table Name | Entity | Feature | Records Per Pet |
|------------|--------|---------|----------------|
| pt_pets | Pet | PT-001 | 1 |
| pt_vaccination_records | VaccinationRecord | PT-002 | 5-30 |
| pt_vet_visits | VetVisit | PT-003 | 2-20/year |
| pt_medications | Medication | PT-004 | 0-10 active |
| pt_dose_logs | DoseLog | PT-004 | 0-1000s |
| pt_weight_entries | WeightEntry | PT-005 | 1-100s |
| pt_weight_goals | WeightGoal | PT-005 | 0-1 |
| pt_feeding_schedules | FeedingSchedule | PT-006 | 1-5 |
| pt_feeding_logs | FeedingLog | PT-006 | 0-1000s |
| pt_dietary_info | DietaryInfo | PT-006 | 0-1 |
| pt_food_transitions | FoodTransition | PT-006 | 0-5 |
| pt_exercise_logs | ExerciseLog | PT-007 | 0-1000s |
| pt_exercise_goals | ExerciseGoal | PT-007 | 0-1 |
| pt_grooming_records | GroomingRecord | PT-008 | 0-100s |
| pt_grooming_intervals | GroomingInterval | PT-008 | 0-8 (one per type) |
| pt_training_commands | TrainingCommand | PT-009 | 0-50 |
| pt_training_sessions | TrainingSession | PT-009 | 0-500 |
| pt_training_session_commands | TrainingSessionCommand | PT-009 | 0-5000 |
| pt_expenses | Expense | PT-010 | 0-1000s |
| pt_emergency_contacts | EmergencyContact | PT-011 | 1-10 (global) |
| pt_breed_alert_dismissals | BreedAlertDismissal | PT-014 | 0-10 |
| pt_pet_photos | PetPhoto | PT-015 | 0-1000s |
| pt_sitter_card_templates | SitterCardTemplate | PT-016 | 0-10 |
| pt_user_preferences | UserPreferences | PT-018 | 1 (singleton) |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Pet -> VaccinationRecord | one-to-many | A pet has many vaccination records |
| Pet -> VetVisit | one-to-many | A pet has many vet visits |
| Pet -> Medication | one-to-many | A pet has many medications |
| Medication -> DoseLog | one-to-many | A medication has many dose logs |
| Pet -> WeightEntry | one-to-many | A pet has many weight entries |
| Pet -> WeightGoal | one-to-one | A pet has at most one weight goal |
| Pet -> FeedingSchedule | one-to-many | A pet has many feeding schedules |
| FeedingSchedule -> FeedingLog | one-to-many | A schedule has many feeding logs |
| Pet -> DietaryInfo | one-to-one | A pet has at most one dietary info record |
| Pet -> FoodTransition | one-to-many | A pet has many food transitions |
| Pet -> ExerciseLog | one-to-many | A pet has many exercise entries |
| Pet -> ExerciseGoal | one-to-one | A pet has at most one exercise goal |
| Pet -> GroomingRecord | one-to-many | A pet has many grooming records |
| Pet -> GroomingInterval | one-to-many | A pet has up to 8 grooming intervals (one per type) |
| Pet -> TrainingCommand | one-to-many | A pet has many training commands |
| Pet -> TrainingSession | one-to-many | A pet has many training sessions |
| TrainingSession <-> TrainingCommand | many-to-many | Via TrainingSessionCommand junction |
| Pet -> Expense | one-to-many | A pet has many expenses |
| VetVisit -> Expense | one-to-one (optional) | Auto-captured vet expense |
| GroomingRecord -> Expense | one-to-one (optional) | Auto-captured grooming expense |
| Pet -> BreedAlertDismissal | one-to-many | A pet has many alert dismissals |
| Pet -> PetPhoto | one-to-many | A pet has many photos |
| EmergencyContact <-> Pet | many-to-many | Via associated_pet_ids JSON |
| SitterCardTemplate <-> Pet | many-to-many | Via pet_ids JSON |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Pet | idx_pet_archived | is_archived | Filter active pets |
| Pet | idx_pet_species | species | Breed-specific queries |
| Pet | idx_pet_sort | sort_order | Ordered display |
| VaccinationRecord | idx_vacc_pet | pet_id | Per-pet listing |
| VaccinationRecord | idx_vacc_due | pet_id, next_due_date | Due-soon and overdue queries |
| VetVisit | idx_vet_pet_date | pet_id, visit_date | Chronological per-pet listing |
| Medication | idx_med_pet_status | pet_id, status | Active medication queries |
| DoseLog | idx_dose_med | medication_id | Dose history per medication |
| DoseLog | idx_dose_schedule | pet_id, scheduled_time | Daily schedule view |
| WeightEntry | idx_weight_pet_date | pet_id, date | Chronological weight chart |
| FeedingSchedule | idx_feed_pet_time | pet_id, meal_time | Daily schedule view |
| FeedingLog | idx_feedlog_date | pet_id, date | Daily completion check |
| ExerciseLog | idx_ex_pet_date | pet_id, date | Daily exercise queries |
| ExerciseLog | idx_ex_group | group_id | Multi-pet activity grouping |
| GroomingRecord | idx_groom_pet_type | pet_id, grooming_type | Type-specific history |
| TrainingCommand | idx_cmd_pet | pet_id | Per-pet command list |
| TrainingSessionCommand | idx_tsc_cmd | command_id | Mastery calculation |
| Expense | idx_exp_pet_date | pet_id, date | Chronological expense list |
| Expense | idx_exp_source | source_type, source_id | Auto-capture linkage |
| PetPhoto | idx_photo_pet_date | pet_id, date | Chronological gallery |

### 4.5 Table Prefix

**MyLife hub table prefix:** `pt_`

All table names in the SQLite database are prefixed with `pt_` to avoid collisions with other modules in the MyLife hub. Example: the `pets` table becomes `pt_pets`, `vaccination_records` becomes `pt_vaccination_records`.

### 4.6 Migration Strategy

- Tables are created on module enable. Schema version is tracked in the hub's module migration system.
- Initial schema creates all tables for PT-001 through PT-018.
- Static breed health data and breed weight percentile data are embedded as read-only assets, not database tables.
- The system Poison Control emergency contact is seeded on first module initialization.
- User preferences are seeded with defaults on first module initialization.
- Destructive migrations (column removal, table drops) are deferred to major versions only.
- Data from a previous standalone version (if one exists) can be imported via the hub's migration package.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Dashboard | Paw print | Multi-Pet Dashboard (PT-012) | Overview of all pets and today's tasks |
| Pets | Grid | Pet List (PT-001) | Browse and manage pet profiles |
| Health | Heart | Health Timeline (PT-013) | Chronological health record for selected pet |
| Care | Calendar | Daily Care Schedule | Today's feeding, medication, and exercise schedule |
| Settings | Gear | Settings (PT-018) | Preferences, export, data management |

### 5.2 Navigation Flow

```
[Tab 1: Dashboard]
  ├── Pet Quick-Access → Pet Profile Detail (PT-001)
  ├── Task Quick-Action → Inline completion (no navigation)
  ├── Alert Card → Relevant feature screen
  └── Settings Gear → Settings (PT-018)

[Tab 2: Pets]
  └── Pet Card → Pet Profile Detail
        ├── Edit Pet (modal)
        ├── Vaccinations List → Add/Edit Vaccination (modal)
        ├── Vet Visits List → Vet Visit Detail → Add/Edit Vet Visit (modal)
        ├── Medications List → Medication Detail → Quick Dose Log (sheet)
        │                                       → Add/Edit Medication (modal)
        ├── Weight History → Add Weight Entry (sheet) → Goal Config (sheet)
        ├── Feeding Schedule → Add/Edit Meal (sheet) → Dietary Info (modal) → Food Transition (modal)
        ├── Exercise Log → Exercise Summary Charts → Add/Edit Exercise (modal) → Daily Goal (sheet)
        ├── Grooming Overview → Grooming History → Add/Edit Grooming (sheet)
        ├── Training Dashboard → Command Detail → Log Training Session (multi-step modal)
        │                                       → Add/Edit Command (sheet)
        ├── Expenses → Expense Detail → Add/Edit Expense (modal)
        ├── Breed Health Alerts
        └── Photo Gallery → Full-Screen Viewer → Add/Edit Photo (sheet)

[Tab 3: Health]
  └── Pet Selector → Health Timeline
        ├── Event Card → Source record detail
        └── Export (share sheet)

[Tab 4: Care]
  ├── Daily Medication Schedule (PT-004)
  ├── Daily Feeding Status (PT-006)
  └── Today's Exercise (PT-007)

[Tab 5: Settings]
  ├── Export Data (PT-017)
  ├── Emergency Contacts (PT-011) → Add/Edit Contact (modal) → Pet Emergency Tips
  ├── Pet Sitter Card (PT-016) → Card Preview → Share
  └── Delete All Data (confirmation flow)
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Multi-Pet Dashboard | /dashboard | All-pet overview with today's tasks | Tab 1, app launch |
| Pet List | /pets | Browse and manage pet profiles | Tab 2 |
| Pet Profile Detail | /pets/:id | Single pet overview with navigation links | Pet List, Dashboard quick-access |
| Add/Edit Pet | /pets/:id/edit | Create or edit pet profile | Pet List (+), Profile Detail (Edit) |
| Vaccination List | /pets/:id/vaccinations | Per-pet vaccination records | Profile Detail |
| Vet Visit List | /pets/:id/vet-visits | Per-pet vet visit log | Profile Detail |
| Vet Visit Detail | /pets/:id/vet-visits/:visitId | Single vet visit details | Vet Visit List |
| Medication List | /pets/:id/medications | Per-pet medications | Profile Detail |
| Medication Detail | /pets/:id/medications/:medId | Single medication with adherence | Medication List |
| Daily Medication Schedule | /care/medications | All-pet daily dose view | Tab 4 |
| Weight History | /pets/:id/weight | Weight chart and entries | Profile Detail |
| Feeding Schedule | /pets/:id/feeding | Per-pet feeding times | Profile Detail |
| Exercise Log | /pets/:id/exercise | Per-pet exercise history | Profile Detail |
| Exercise Summary Charts | /pets/:id/exercise/charts | Weekly/monthly exercise charts | Exercise Log |
| Grooming Overview | /pets/:id/grooming | Per-pet grooming types grid | Profile Detail |
| Grooming History | /pets/:id/grooming/:type | History for one grooming type | Grooming Overview |
| Training Dashboard | /pets/:id/training | Per-pet commands and mastery | Profile Detail |
| Command Detail | /pets/:id/training/:cmdId | Single command mastery chart | Training Dashboard |
| Expense Dashboard | /pets/:id/expenses | Per-pet expense charts and list | Profile Detail |
| Health Timeline | /pets/:id/timeline | Chronological health events | Tab 3, Profile Detail |
| Breed Health Alerts | /pets/:id/breed-health | Breed-specific conditions | Profile Detail |
| Photo Gallery | /pets/:id/photos | Per-pet photo grid | Profile Detail |
| Emergency Contacts | /settings/emergency | Emergency vet contact list | Tab 5, Profile Detail |
| Pet Emergency Tips | /settings/emergency/tips | Static first aid tips | Emergency Contacts |
| Pet Sitter Card | /settings/sitter-card | Generate care instructions | Tab 5 |
| Export Data | /settings/export | Data export configuration | Tab 5 |
| Settings | /settings | User preferences | Tab 5 |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| mylife://pets | Pet List | None |
| mylife://pets/:id | Pet Profile Detail | id: UUID of the pet |
| mylife://pets/:id/vaccinations | Vaccination List | id: UUID of the pet |
| mylife://pets/:id/medications | Medication List | id: UUID of the pet |
| mylife://pets/:id/weight | Weight History | id: UUID of the pet |
| mylife://pets/dashboard | Multi-Pet Dashboard | None |
| mylife://pets/emergency | Emergency Contacts | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Pet medication to MyMeds | Pets | Meds | Pet medications can use the MyMeds reminder engine pattern for dose scheduling and adherence tracking | On medication create/edit |
| Pet expenses to MyBudget | Pets | Budget | Pet expense amounts auto-categorize into budget envelopes (vet, food, grooming, supplies) when MyBudget module is enabled | On expense create |
| Pet care routines to MyHabits | Pets | Habits | Daily pet care tasks (feeding, walking, medication) can be surfaced as trackable habits in MyHabits | On feeding/medication schedule create |
| Dog walks to MyTrails | Pets | Trails | Exercise logs with type "walk" or "hike" can link to MyTrails GPS routes for distance and route recording | On exercise log create (if MyTrails is enabled) |
| Pet wellness to MyHealth | Pets | Health | Pet therapy or emotional support animal interactions can be logged as wellness activities in MyHealth | Manual user action |

**Integration behavior when target module is not enabled:**
- Integrations are silently skipped. No errors, no prompts.
- Data remains in the source module and is fully functional without the target.
- If the target module is later enabled, historical data is not retroactively synced (only new events trigger integrations).

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Pet profiles | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Health records (vaccinations, vet visits) | Local SQLite | At rest (OS-level) | No | Contains sensitive medical/financial data |
| Medication data | Local SQLite | At rest (OS-level) | No | Reveals daily routines and medical needs |
| Weight entries | Local SQLite | At rest (OS-level) | No | Health tracking data |
| Feeding schedules | Local SQLite | At rest (OS-level) | No | Reveals daily routines |
| Exercise logs | Local SQLite | At rest (OS-level) | No | No GPS data stored; only duration and distance |
| Grooming records | Local SQLite | At rest (OS-level) | No | May include financial data |
| Training data | Local SQLite | At rest (OS-level) | No | Behavioral observations |
| Expenses | Local SQLite | At rest (OS-level) | No | Sensitive financial data |
| Emergency contacts | Local SQLite | At rest (OS-level) | No | Contains phone numbers and addresses |
| Pet photos | Local file system | At rest (OS-level) | No | Stored in app sandbox, never uploaded |
| User preferences | Local SQLite | At rest (OS-level) | No | Non-sensitive settings |
| Breed health data | Bundled static asset | N/A | N/A | Read-only, no user data |

### 7.2 Network Activity

This module operates entirely offline. No network requests are made under any circumstances. All data, including breed health information and weight percentile tables, is bundled with the app as static assets.

### 7.3 Data That Never Leaves the Device

- Pet profiles including microchip IDs
- Vaccination records and medical history
- Vet visit details, diagnoses, and costs
- Medication names, dosages, and adherence data
- Weight measurements and trends
- Feeding schedules and dietary restrictions
- Exercise patterns and daily routines
- Grooming history and associated costs
- Training session data and behavioral observations
- Expense records and cost of ownership calculations
- Emergency contact information (addresses, phone numbers)
- Pet photos
- Breed health alert dismissal status

### 7.4 User Data Ownership

- **Export:** Users can export all data in CSV or JSON format (PT-017)
- **Delete:** Users can delete all module data from Settings (PT-018) with double confirmation
- **Per-pet delete:** Users can permanently delete a single pet and all its records (PT-001)
- **Portability:** Export format includes a schema version for forward compatibility
- **No lock-in:** All data formats are documented, human-readable, and standard (CSV/JSON)

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Microchip ID protection | Microchip IDs are stored locally and never transmitted | Microchip IDs are sensitive identification data |
| Financial data display | Expense amounts are displayed in plain text (no masking) | Users may configure app-level lock via MyLife hub settings |
| Photo storage isolation | Photos stored in app sandbox, inaccessible to other apps | OS-level sandboxing provides isolation |
| Emergency contact phone numbers | Stored locally; "Call" action uses device tel: scheme | No phone numbers are transmitted to any server |
| Delete confirmation | Double confirmation (dialog + typed "DELETE") for full data deletion | Prevents accidental data loss |
| Export file security | Export ZIP is temporary; deleted after share sheet completes | No persistent export files left on device |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Active medication | A medication with status "active" that is currently being administered to the pet |
| Adherence | The percentage of scheduled medication doses that were actually taken (taken_doses / total_doses * 100) |
| Archived pet | A pet profile hidden from the active list but with all records preserved; can be unarchived |
| Auto-captured expense | An expense record automatically created from a vet visit or grooming entry that includes a cost |
| Breed percentile | Weight ranges at the 25th, 50th, and 75th percentiles for a specific breed at a given age, used for growth chart overlay |
| Core vaccination | A vaccine recommended for all animals of a species regardless of lifestyle (e.g., Rabies, DHPP for dogs, FVRCP for cats) |
| Daily exercise goal | A user-configured target number of exercise minutes per day for a specific pet |
| Dog age human equivalent | A formula to convert a dog's chronological age to an equivalent human age: 16 * ln(dog_age_years) + 31 |
| Dose log | A record of a single medication dose event, noting whether it was taken, skipped, or missed |
| Exercise streak | The number of consecutive days with at least one logged exercise entry for a pet |
| Food transition | A structured period (7, 10, or 14 days) during which a pet's food is gradually changed from one brand/type to another using decreasing old-food ratios |
| Grooming interval | A user-configured number of days between grooming sessions of a specific type (e.g., bath every 28 days) |
| Mastery level | A training command's proficiency status (new, learning, proficient, mastered) based on average success rate across the last 5 practice sessions |
| Microchip ID | A unique identification number implanted in a pet via a microchip, used for identification if the pet is lost |
| Module | A self-contained functional unit within the MyLife hub that can be enabled or disabled independently |
| Monthly cost average | The total cost of pet ownership divided by the number of months owned: total_cost / months_owned |
| Multi-pet walk | An exercise entry shared across multiple pets, linked by a common group_id |
| Non-core vaccination | A vaccine recommended based on lifestyle, geography, or risk factors (e.g., Bordetella, Lyme for dogs, FeLV for cats) |
| Pet sitter card | A generated text document containing care instructions for one or more pets, intended to be shared with a pet sitter |
| Profile completeness | A percentage (0-100%) indicating how many optional fields a pet profile has filled in, weighted by importance |
| Quiet hours | A time range during which no MyPets notifications are delivered; notifications due during quiet hours are delayed to the end of the quiet period |
| Significant event | A health timeline event flagged for extra attention: emergency vet visits, surgeries, medication discontinuations, or weight changes exceeding 10% within 30 days |
| Table prefix | A short string (pt_) prepended to all database table names to avoid naming collisions with other MyLife modules |
| Total cost of ownership | The sum of all expenses associated with a pet from the adoption date (or first expense) to the present |
| Weight trend | A classification of weight direction over the last 90 days: "gaining" (> +2%), "losing" (> -2%), or "stable" (within +/- 2%) |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification - Sections 1-2, PT-001 through PT-003 |
| 1.1 | 2026-03-07 | Claude (Spec Writer Agent) | Completed PT-004 through PT-018, added Sections 4-8 |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should breed weight percentile data cover adult dogs or only puppies/kittens? | PT-005 mentions 0-24 months plus adult ranges, but adult breed weight varies significantly by individual | Cover 0-24 months at monthly intervals plus a single adult range per breed | - |
| 2 | Should the photo gallery support video clips (short, < 30 seconds)? | Users may want to capture behavior or milestones on video | Deferred to v2. Phase 1 supports photos only. | - |
| 3 | How many breeds should the breed health alert lookup table cover at launch? | PT-014 specifies 50 dog breeds and 20 cat breeds, but this requires curating medical data | Start with top 50 dog and top 20 cat breeds by AKC/CFA popularity. Expand in updates. | - |
| 4 | Should medication tracking support "as needed" (PRN) medications in addition to scheduled doses? | Some pet medications (e.g., anti-anxiety meds for storms) are given situationally | Deferred to post-MVP. Phase 1 supports only scheduled medications. | - |
| 5 | Should the pet sitter card support multiple languages? | Useful for international travel or non-English-speaking sitters | Deferred. Phase 1 generates English-only cards. | - |
