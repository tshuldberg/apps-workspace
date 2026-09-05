# MyMeds - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyMeds
- **Tagline:** "Never miss a dose"
- **Module ID:** `meds`
- **Feature ID Prefix:** `MD`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Daily Med Manager | Ages 30-65, takes 2-8 daily medications for chronic conditions (hypertension, diabetes, thyroid, mental health). Moderate tech comfort. | Never miss a dose, track refills, share adherence data with doctor |
| Chronic Condition Tracker | Ages 25-55, manages diabetes (Type 1 or 2), hypertension, or migraine. Needs to log vitals and correlate with medications. | Log blood pressure/glucose readings, see trends, understand medication impact on health |
| Caregiver | Ages 35-70, manages medications for an elderly parent or dependent. Needs visibility into adherence without invasive monitoring. | Receive alerts when critical medications are missed, help coordinate refills |
| Mental Health Patient | Ages 18-45, takes psychiatric medications (SSRIs, mood stabilizers, anti-anxiety). Wants to understand medication impact on mood. | Journal mood daily, correlate mood changes with medication starts/stops, generate therapy reports |
| Digestive Health Sufferer | Ages 20-50, manages IBS, GERD, food sensitivities, or Crohn's disease. Tracks food triggers and digestive symptoms. | Log meals with FODMAP classification, track bowel health, identify food-symptom correlations |
| Migraine Sufferer | Ages 20-55, experiences chronic or episodic migraines. Wants to identify triggers and predict episodes. | Map pain locations, track weather-pressure correlations, receive predictive risk warnings |

### 1.3 Core Value Proposition

MyMeds is a comprehensive, privacy-first medication management and health tracking platform that replaces 5+ paid health apps with a single unified module. It tracks medications with smart reminders, checks 200+ drug interaction pairs, logs mood and symptoms with a 144-descriptor vocabulary, runs statistical correlation analysis between medications and health outcomes, and generates doctor-ready reports. Unlike Medisafe, Glucose Buddy, MySugr, Migraine Buddy, and Cara Care, MyMeds stores all health data exclusively on-device, ensuring no pharmaceutical company, insurer, or data broker ever accesses the user's most sensitive personal information.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Medisafe ($40/yr) | Polished reminders, caregiver features, pharmacy integration | Partners with pharma companies and health plans; shares usage data for "adherence programs" | Privacy-first: no data sharing. Equivalent reminders + caregiver alerts without the surveillance |
| Glucose Buddy ($40/yr) | Comprehensive diabetes logging, A1c tracking, CGM integration | Limited to diabetes only; no mood/symptom correlation | Full medication + vitals + mood + symptom correlation in one module |
| MySugr ($36/yr) | Smooth diabetes workflow, bolus calculator, owned by Roche | User data feeds Roche's pharmaceutical R&D pipeline | Zero pharma company involvement. Same diabetes features, zero data exploitation |
| Migraine Buddy ($50/yr) | Pain mapping, weather correlation, trigger analysis | Sells anonymized (potentially re-identifiable) data to pharma companies and researchers | Same pain mapping and weather correlation without selling user data |
| Cara Care ($80/yr) | Digestive health tracking, FODMAP guidance, Bristol Scale | Acquired by Bayer; digestive health data now owned by a company that sells digestive health products | Same gut health features; data stays on your device, not in Bayer's database |
| Blood Pressure Monitor ($13/yr) | Simple BP logging, AHA classification, trends | BP-only; no medication tracking or correlation | BP logging integrated with full medication and correlation ecosystem |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export

**MyMeds-specific privacy notes:**

- **Medication lists** never leave the phone. No pharmaceutical company knows what you take.
- **Blood glucose readings** stay local. No insurance company can access your diabetes management data.
- **Symptom patterns** remain private. No data broker can correlate your migraines with your purchasing behavior.
- **Adherence data** is yours alone. No employer wellness program can penalize you for missed doses.
- **Caregiver alerts** send minimal information ("medication missed" notification only, never medication names, dosages, or health data).
- **Drug interaction data** is bundled locally (200+ pairs shipped with the app). No network request is made to check interactions.
- **Doctor reports** are generated locally and exported as files. They are never uploaded to any server.
- **Weather data** for barometric pressure correlation is the only optional network request, and it sends only geographic coordinates (no health data). Users can disable this entirely.

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| MD-001 | Medication Management | P0 | Core | None | Implemented |
| MD-002 | Medication Reminders | P0 | Core | MD-001 | Implemented |
| MD-003 | Dose Logging | P0 | Core | MD-001, MD-002 | Implemented |
| MD-004 | Refill Tracking | P0 | Core | MD-001 | Implemented |
| MD-005 | Drug Interaction Checker | P0 | Core | MD-001 | Implemented |
| MD-006 | Mood Journaling | P0 | Core | None | Implemented |
| MD-007 | Symptom Logging | P0 | Core | None | Implemented |
| MD-008 | Health Measurements | P0 | Core | None | Implemented |
| MD-009 | Correlation Engine | P1 | Analytics | MD-001, MD-003, MD-006, MD-007 | Implemented |
| MD-010 | Doctor Report Generation | P1 | Analytics | MD-001, MD-003, MD-006, MD-007, MD-008 | Implemented |
| MD-011 | Adherence Analytics Dashboard | P1 | Analytics | MD-001, MD-003 | Implemented |
| MD-012 | As-Needed (PRN) Medication Tracking | P1 | Core | MD-001 | Implemented |
| MD-013 | Medication History Timeline | P1 | Data Management | MD-001, MD-003 | Implemented |
| MD-014 | Blood Pressure Logging | P0 | Core | MD-008 | Not Started |
| MD-015 | BP Trend Visualization | P1 | Analytics | MD-014 | Not Started |
| MD-016 | Blood Glucose Logging | P1 | Core | MD-008 | Not Started |
| MD-017 | Insulin Dose Tracking | P1 | Core | MD-001, MD-016 | Not Started |
| MD-018 | CGM Integration via HealthKit | P2 | Import/Export | MD-016 | Not Started |
| MD-019 | HbA1c Estimator | P2 | Analytics | MD-016 | Not Started |
| MD-020 | Pain Location Mapping | P2 | Core | MD-007 | Not Started |
| MD-021 | Weather-Barometric Pressure Correlation | P2 | Analytics | MD-007, MD-009 | Not Started |
| MD-022 | Predictive Risk Analysis | P2 | Analytics | MD-007, MD-009, MD-021 | Not Started |
| MD-023 | FODMAP Food Tracking | P2 | Core | None | Not Started |
| MD-024 | Bristol Stool Scale | P2 | Core | None | Not Started |
| MD-025 | Digestive Symptom Timeline | P2 | Analytics | MD-023, MD-024, MD-007 | Not Started |
| MD-026 | Caregiver Alerts (Medfriend) | P1 | Social | MD-001, MD-002 | Not Started |
| MD-027 | Expanded Health Measurements | P1 | Core | MD-008 | Not Started |
| MD-028 | Side Effect Logger | P1 | Core | MD-001, MD-007 | Not Started |
| MD-029 | Data Export | P1 | Import/Export | MD-001 | Implemented |
| MD-030 | Settings and Preferences | P1 | Settings | None | Implemented |

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

### MD-001: Medication Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-001 |
| **Feature Name** | Medication Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want to add all my medications with their dosage, frequency, and scheduling details, so that the app knows what I take and when I should take it.

**Secondary:**
> As a Caregiver, I want to manage a medication list for my dependent, so that I can keep an accurate record of their prescriptions.

#### 3.3 Detailed Description

Medication Management is the foundational feature of MyMeds. Users add medications by specifying a name, dosage amount and unit, frequency (daily, twice daily, weekly, as-needed, or custom), time slots for when doses should be taken, prescriber name, pharmacy, and optional notes. Each medication can be marked as active or inactive, preserving history when a medication is discontinued.

The medication list serves as the central data source for reminders, dose logging, refill tracking, interaction checking, adherence analytics, and correlation analysis. Users can edit any medication field at any time, reorder medications by drag-and-drop, and filter the list by active/inactive status.

Medications also support an optional end date, which marks the medication as inactive on that date. This is useful for short courses like antibiotics or steroids.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the root feature)

**External Dependencies:**
- Local storage for SQLite database

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable
- UUID generation is available for record IDs

#### 3.5 User Interface Requirements

##### Screen: Medications List

**Layout:**
- Top navigation bar showing "Medications" title and a "+" add button on the right
- Below the navigation bar is a segmented control toggle: "Active" | "All" (defaults to "Active")
- The main content area is a scrollable vertical list of medication cards
- Each card displays: medication name (bold), dosage and unit (subtitle), frequency badge, next dose time, and pill count indicator (if set)
- Cards are ordered by user-defined sort_order (drag handles visible in edit mode)
- Tapping a card navigates to the Medication Detail screen
- Long-pressing a card reveals a context menu: Edit, Deactivate/Reactivate, Delete

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No medications exist | Illustration of a pill bottle, message "No medications added yet", button "Add Your First Medication" |
| Populated | Active medications exist | Scrollable list of medication cards |
| All View | User toggled to "All" | Shows both active and inactive medications; inactive cards have reduced opacity and an "Inactive" badge |
| Error | Database read fails | Toast notification: "Could not load medications. Please restart the app." |

**Interactions:**
- Tap card: Navigate to Medication Detail screen
- Tap "+": Open Add Medication modal
- Long press card: Context menu (Edit, Deactivate, Delete)
- Swipe left on card: Reveal "Delete" action (with confirmation)
- Pull-to-refresh: Reload medication list from database

**Transitions/Animations:**
- New medication card animates in from the top with a slide-down + fade-in (200ms)
- Deleted medication card fades out + slides left (200ms)
- Active/inactive toggle cross-fades the list (150ms)

##### Modal: Add/Edit Medication

**Layout:**
- Full-screen modal with "Cancel" (left) and "Save" (right) in the header
- Scrollable form with the following fields:
  - Medication name (text input, required)
  - Dosage (text input, e.g., "500")
  - Unit (picker: mg, mcg, g, mL, units, tablets, capsules, patches, drops, puffs, injections)
  - Frequency (picker: Daily, Twice Daily, Weekly, As Needed, Custom)
  - Time slots (time picker, number of slots matches frequency: 1 for daily/weekly, 2 for twice daily, 0 for as-needed)
  - Pills per dose (number stepper, default 1, min 1, max 20)
  - Prescriber (text input, optional)
  - Pharmacy (text input, optional)
  - End date (date picker, optional)
  - Notes (multiline text input, optional)
- "Save" button is disabled until the medication name is filled

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Add Mode | Creating a new medication | Header reads "Add Medication", all fields empty |
| Edit Mode | Editing an existing medication | Header reads "Edit Medication", fields pre-populated |
| Validation Error | Name is empty on save attempt | Inline error below name field: "Medication name is required" |
| Saving | Write in progress | Save button shows spinner, form inputs disabled |

#### 3.6 Data Requirements

##### Entity: Medication

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| name | string | Required, min 1 char, max 255 chars | None | Medication name (e.g., "Lisinopril") |
| dosage | string | Nullable, max 50 chars | null | Dosage amount (e.g., "10") |
| unit | string | Nullable, max 20 chars | null | Dosage unit (e.g., "mg") |
| frequency | enum | One of: daily, twice_daily, weekly, as_needed, custom | daily | How often the medication is taken |
| instructions | string | Nullable, max 500 chars | null | Special instructions (e.g., "Take with food") |
| prescriber | string | Nullable, max 255 chars | null | Prescribing doctor name |
| pharmacy | string | Nullable, max 255 chars | null | Pharmacy name |
| refillDate | string | Nullable, ISO 8601 date | null | Next expected refill date |
| pillCount | integer | Nullable, min 0 | null | Current pill/unit count on hand |
| pillsPerDose | integer | Min 1, max 20 | 1 | Number of pills consumed per dose event |
| timeSlots | array of strings | JSON array of HH:MM strings | [] | Scheduled times for doses |
| endDate | string | Nullable, ISO 8601 date | null | Date medication should be discontinued |
| isActive | boolean | - | true | Whether medication is currently being taken |
| sortOrder | integer | Min 0 | 0 | Display order in medication list |
| notes | string | Nullable, max 2000 chars | null | Free-form notes |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |
| updatedAt | string | ISO 8601 datetime, auto-set on modification | Current timestamp | Last modification time |

**Indexes:**
- `isActive` - frequently filtered for active medication list
- `name` - used for interaction checking lookups

**Validation Rules:**
- `name`: Must not be empty string after trimming whitespace
- `pillsPerDose`: Must be >= 1 and <= 20
- `pillCount`: If set, must be >= 0
- `timeSlots`: Each entry must match HH:MM format (00:00 to 23:59)
- `endDate`: If set, must be a valid ISO date and must be >= createdAt date
- `frequency`: Must be one of the defined enum values

**Example Data:**

```json
{
  "id": "med-a1b2c3d4",
  "name": "Lisinopril",
  "dosage": "10",
  "unit": "mg",
  "frequency": "daily",
  "instructions": "Take in the morning with water",
  "prescriber": "Dr. Smith",
  "pharmacy": "CVS Pharmacy",
  "refillDate": "2026-04-01",
  "pillCount": 45,
  "pillsPerDose": 1,
  "timeSlots": ["08:00"],
  "endDate": null,
  "isActive": true,
  "sortOrder": 0,
  "notes": null,
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-03-01T14:20:00Z"
}
```

#### 3.7 Business Logic Rules

##### Medication Lifecycle

**Purpose:** Manage the active/inactive state of medications over time.

**Logic:**
```
1. When a medication is created, isActive defaults to true
2. IF endDate is set AND today >= endDate THEN
     Set isActive to false
     Stop generating reminders for this medication
3. User can manually set isActive to false at any time (deactivate)
4. User can reactivate an inactive medication (set isActive back to true)
5. Deactivating a medication does NOT delete dose logs, reminders, or history
6. Deleting a medication CASCADE deletes all associated dose logs, reminders, refills
```

**Edge Cases:**
- User sets endDate to today: Medication becomes inactive at end of current day
- User changes frequency: Reminders are regenerated (see MD-002)
- User deactivates then reactivates: All historical data is preserved; reminders resume

##### Medication Sorting

**Default sort:** User-defined `sortOrder` (ascending), with active medications before inactive
**Available sort options:** Custom order (drag-and-drop), Name A-Z, Name Z-A, Date Added (newest first), Date Added (oldest first)
**Filter options:** Active only, All (active + inactive)
**Search:** Name field is searchable with substring matching (case-insensitive)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast notification: "Could not save medication. Please try again." | User taps retry or re-opens the form |
| Medication name is empty | Inline validation below name field: "Medication name is required" | User fills in the name; error clears on input |
| Duplicate medication name | Warning dialog: "You already have a medication named [name]. Add anyway?" with "Add" and "Cancel" buttons | User confirms or cancels |
| Delete medication with active reminders | Confirmation dialog: "Delete [name]? This will also remove all reminders and dose history for this medication. This cannot be undone." | User confirms or cancels |

**Validation Timing:**
- Field-level validation runs on blur
- Form-level validation runs on save attempt
- Duplicate name check runs on save attempt

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has no medications,
   **When** they tap "Add Your First Medication" and fill in name "Lisinopril", dosage "10", unit "mg", frequency "daily", time slot "08:00", and tap Save,
   **Then** a new medication card appears in the list showing "Lisinopril 10 mg - Daily".

2. **Given** the user has an active medication "Lisinopril",
   **When** they long-press the card and select "Edit", change dosage to "20", and tap Save,
   **Then** the card updates to show "Lisinopril 20 mg - Daily" and updatedAt is refreshed.

3. **Given** the user has an active medication "Amoxicillin" with endDate set to today,
   **When** the app loads the medication list,
   **Then** "Amoxicillin" appears with an "Inactive" badge and reduced opacity.

**Edge Cases:**

4. **Given** the user has 50 active medications,
   **When** they scroll the medication list,
   **Then** all 50 medications are displayed without performance degradation (< 16ms frame time).

5. **Given** the user drags medication "Metformin" from position 5 to position 1,
   **When** they release the card,
   **Then** "Metformin" is now at position 1 and all other medications shift down by one.

**Negative Tests:**

6. **Given** the Add Medication form is open,
   **When** the user taps Save without entering a medication name,
   **Then** the system shows inline error "Medication name is required"
   **And** no record is created in the database.

7. **Given** the user is editing a medication,
   **When** they clear the name field and tap Save,
   **Then** the system shows inline error "Medication name is required"
   **And** the original medication data is unchanged.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates medication with all fields | Full CreateMedicationInput | Medication record with all fields populated |
| creates medication with required fields only | { name: "Aspirin" } | Medication with defaults: frequency=daily, isActive=true, sortOrder=0 |
| rejects empty medication name | { name: "" } | Validation error |
| rejects whitespace-only name | { name: "   " } | Validation error |
| sets pillsPerDose default to 1 | { name: "Test" } | pillsPerDose = 1 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add medication and verify list | 1. Create medication, 2. Query medication list | New medication appears in list with correct fields |
| Edit medication and verify update | 1. Create medication, 2. Update dosage, 3. Query by ID | Dosage updated, updatedAt changed |
| Delete medication cascades | 1. Create medication, 2. Add dose logs, 3. Delete medication | Medication and all dose logs are deleted |
| Deactivate preserves data | 1. Create medication, 2. Log doses, 3. Set isActive=false, 4. Query dose logs | Dose logs still exist for inactive medication |

---

### MD-002: Medication Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-002 |
| **Feature Name** | Medication Reminders |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want to receive push notifications at my scheduled medication times, so that I never forget to take my medications.

**Secondary:**
> As a Mental Health Patient, I want to snooze a reminder for 15 or 30 minutes, so that I can take my medication after I finish what I am doing.

#### 3.3 Detailed Description

The reminder system generates push notification-style reminders based on each medication's frequency and time slots. When a user creates a medication with time slots, the system automatically generates reminder records that fire at the specified times on the appropriate days of the week.

For daily medications, reminders fire every day at each time slot. For twice-daily medications, reminders fire at both time slots every day. For weekly medications, reminders fire on the medication's specified day of the week. As-needed and custom-frequency medications do not receive automatic reminders.

Users can snooze individual reminders for a configurable duration (5, 10, 15, 30, or 60 minutes). Snoozed reminders fire again after the snooze period expires. Users can also dismiss (permanently deactivate) individual reminders.

When a medication's frequency or time slots change, all existing reminders for that medication are deleted and regenerated from the new schedule.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - reminders are generated from medication frequency and time slots

**External Dependencies:**
- Push notification permission from the operating system
- Background task scheduling capability (Expo Notifications or platform-native)

**Assumed Capabilities:**
- Device supports local push notifications
- App has been granted notification permission

#### 3.5 User Interface Requirements

##### Screen: Today (Tab 1)

**Layout:**
- Top section shows current date and a greeting message
- "Upcoming" section lists reminders due in the next 60 minutes, sorted by time
- "Overdue" section lists reminders that were not acted upon (scheduled time has passed, no dose logged), highlighted with a red/orange accent
- Each reminder row shows: medication name, dosage, scheduled time, and action buttons (Take, Skip, Snooze)
- "Completed" section shows doses already logged today with a checkmark
- Bottom of the screen shows an overall "Today's Progress" bar (X of Y doses taken)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| All Done | All scheduled doses taken | Celebratory illustration, message "All medications taken today!" with a green checkmark |
| Pending | Doses remaining | Upcoming and/or overdue reminders displayed |
| No Medications | No medications have reminders | Message "No medications scheduled. Add medications to get started." |
| Overdue | Past-due reminders exist | Overdue section with orange/red background accent and count badge |

**Interactions:**
- Tap "Take": Logs dose as "taken" with current timestamp, card animates to Completed section
- Tap "Skip": Logs dose as "skipped", card moves to Completed section with skip icon
- Tap "Snooze": Opens snooze picker (5, 10, 15, 30, 60 min), reminder reappears after the chosen interval
- Tap medication name: Navigates to Medication Detail screen

#### 3.6 Data Requirements

##### Entity: Reminder

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| medicationId | string | Required, FK to Medication.id, CASCADE delete | None | Associated medication |
| time | string | Required, HH:MM format | None | Scheduled notification time |
| daysOfWeek | array of integers | JSON array, values 0-6 (Sun-Sat) | [0,1,2,3,4,5,6] | Days the reminder fires |
| isActive | boolean | - | true | Whether reminder is enabled |
| snoozeUntil | string | Nullable, ISO 8601 datetime | null | If snoozed, when to fire again |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `medicationId` - lookup reminders for a specific medication

#### 3.7 Business Logic Rules

##### Reminder Generation Algorithm

**Purpose:** Automatically create reminders when a medication is saved with time slots.

**Inputs:**
- medicationId: string
- frequency: MedFrequency
- timeSlots: string[]

**Logic:**
```
1. IF frequency is 'as_needed' OR 'custom' THEN RETURN (no auto-reminders)
2. IF timeSlots is empty THEN RETURN
3. DELETE all existing reminders for this medicationId
4. FOR EACH time IN timeSlots:
     IF frequency is 'weekly' THEN
       daysOfWeek = [current day of week (0-6)]
     ELSE
       daysOfWeek = [0, 1, 2, 3, 4, 5, 6]
     CREATE reminder with { medicationId, time, daysOfWeek, isActive: true }
```

##### Active Reminder Query

**Purpose:** Get reminders due within the next N minutes.

**Logic:**
```
1. Get current time (HH:MM) and current day of week (0-6)
2. Calculate future time = current time + withinMinutes
3. SELECT all reminders WHERE:
     isActive = true
     AND daysOfWeek includes current day
     AND time >= currentTime AND time <= futureTime
     AND (snoozeUntil IS NULL OR snoozeUntil <= now)
4. RETURN matching reminders
```

**Edge Cases:**
- Snooze that crosses midnight: Snooze timer uses absolute datetime, not relative time, so it works across day boundaries
- User changes timezone: Reminders use device-local time; timezone changes shift all reminders accordingly
- Reminder for deactivated medication: Deactivating a medication sets its reminders to isActive=false

##### Snooze Behavior

**Purpose:** Delay a reminder for a specified duration.

**Inputs:**
- reminderId: string
- minutes: integer (5, 10, 15, 30, or 60)

**Logic:**
```
1. Calculate snoozeUntil = current datetime + minutes
2. UPDATE reminder SET snoozeUntil = snoozeUntil
3. The reminder will not appear in active queries until snoozeUntil has passed
4. After snoozeUntil passes, the reminder reappears in the "Upcoming" section
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Notification permission denied | Banner at top of Today screen: "Enable notifications to receive medication reminders" with a "Settings" button | User taps Settings to open OS notification settings |
| Snooze fails to save | Toast: "Could not snooze reminder. Please try again." | User taps snooze again |
| Reminder fires for deleted medication | Notification is silently suppressed; no user-visible action | System auto-cleans orphaned reminders on next app launch |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a medication "Lisinopril" with frequency "daily" and time slot "08:00",
   **When** the medication is saved,
   **Then** one reminder is created with time "08:00" and daysOfWeek [0,1,2,3,4,5,6].

2. **Given** a reminder is due at 08:00 and the current time is 07:55,
   **When** the user opens the Today screen,
   **Then** the reminder appears in the "Upcoming" section with Take, Skip, and Snooze buttons.

3. **Given** the user taps "Snooze" and selects "15 minutes" at 08:00,
   **When** 15 minutes elapse (08:15),
   **Then** the reminder reappears in the Upcoming section.

**Edge Cases:**

4. **Given** a medication is changed from "daily" to "weekly",
   **When** the medication is saved,
   **Then** old daily reminders are deleted and one weekly reminder is created.

5. **Given** a medication has frequency "as_needed",
   **When** the medication is saved,
   **Then** no reminders are created for this medication.

**Negative Tests:**

6. **Given** a medication is deleted,
   **When** the deletion completes,
   **Then** all associated reminders are cascade-deleted from the database.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates daily reminders for all 7 days | frequency: daily, timeSlots: ["08:00"] | 1 reminder, daysOfWeek = [0,1,2,3,4,5,6] |
| creates two reminders for twice_daily | frequency: twice_daily, timeSlots: ["08:00", "20:00"] | 2 reminders, each with all 7 days |
| creates weekly reminder for single day | frequency: weekly, timeSlots: ["09:00"] | 1 reminder, daysOfWeek = [current day] |
| skips as_needed medications | frequency: as_needed, timeSlots: [] | 0 reminders created |
| snooze sets snoozeUntil correctly | reminderId, minutes: 15 | snoozeUntil = now + 15 minutes |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Change frequency regenerates reminders | 1. Create daily medication, 2. Change to weekly, 3. Query reminders | Old reminders deleted, new weekly reminder exists |
| Dismiss deactivates reminder | 1. Create medication with reminder, 2. Dismiss reminder | Reminder isActive = false |

---

### MD-003: Dose Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-003 |
| **Feature Name** | Dose Logging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want to record when I take each dose (on time, late, or skipped), so that I have an accurate history of my medication adherence.

**Secondary:**
> As a Mental Health Patient, I want to undo an accidental dose log, so that my records stay accurate.

#### 3.3 Detailed Description

Dose Logging records every medication dose event with the scheduled time, the actual time taken, and a status of taken, skipped, late, or snoozed. Each log entry is linked to a specific medication. Users primarily log doses from the Today screen by tapping "Take" or "Skip" on a reminder, but they can also manually log past doses from the medication detail screen.

A dose is classified as "late" if the actual_time is more than 30 minutes after the scheduled_time. "Snoozed" is a transient state indicating the user has deferred the dose; once they take or skip it, the status updates to "taken" or "skipped" respectively.

Dose logs form the basis for adherence calculations (MD-011), correlation analysis (MD-009), and doctor reports (MD-010). Users can undo (delete) an erroneous dose log entry at any time.

When a dose is logged as "taken" for a medication that has pill counting enabled, the medication's pill count is automatically decremented by `pillsPerDose`.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - doses are linked to medications
- MD-002: Medication Reminders - primary dose logging trigger

**External Dependencies:**
- Local SQLite database

**Assumed Capabilities:**
- Device clock provides accurate local time for timestamps

#### 3.5 User Interface Requirements

##### Interaction: Quick Dose Log (from Today Screen)

**Layout:**
- Integrated into the Today screen reminder cards (see MD-002)
- "Take" button logs dose as "taken" with status auto-determined (on time vs. late)
- "Skip" button opens a brief optional notes field, then logs as "skipped"
- After tapping Take/Skip, the reminder card slides from Upcoming/Overdue to Completed section

**Transitions/Animations:**
- Card slides left and fades out from Upcoming, slides in from top in Completed section (200ms)
- Checkmark icon pulses briefly on successful log (150ms)

##### Screen: Manual Dose Log

**Layout:**
- Accessed from Medication Detail screen via "Log Dose" button
- Date/time picker (defaults to current date/time)
- Status picker: Taken, Skipped, Late
- Optional notes field (max 500 chars)
- "Save" button

#### 3.6 Data Requirements

##### Entity: DoseLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| medicationId | string | Required, FK to Medication.id, CASCADE delete | None | Associated medication |
| scheduledTime | string | Required, ISO 8601 datetime | None | When the dose was scheduled |
| actualTime | string | Nullable, ISO 8601 datetime | null | When the dose was actually taken |
| status | enum | One of: taken, skipped, late, snoozed | taken | Dose outcome |
| notes | string | Nullable, max 500 chars | null | Optional notes |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `(medicationId, scheduledTime)` - composite index for date-range queries and adherence calculations

**Validation Rules:**
- `medicationId`: Must reference an existing medication
- `scheduledTime`: Must be a valid ISO 8601 datetime
- `actualTime`: If provided, must be a valid ISO 8601 datetime
- `status`: Must be one of the four defined enum values

**Example Data:**

```json
{
  "id": "dose-x1y2z3",
  "medicationId": "med-a1b2c3d4",
  "scheduledTime": "2026-03-06T08:00:00Z",
  "actualTime": "2026-03-06T08:12:00Z",
  "status": "taken",
  "notes": null,
  "createdAt": "2026-03-06T08:12:00Z"
}
```

#### 3.7 Business Logic Rules

##### Dose Status Classification

**Purpose:** Automatically classify a dose as "taken" or "late" based on timing.

**Inputs:**
- scheduledTime: datetime
- actualTime: datetime

**Logic:**
```
1. Calculate delay = actualTime - scheduledTime in minutes
2. IF delay <= 30 THEN status = 'taken'
3. IF delay > 30 THEN status = 'late'
4. IF user explicitly skips THEN status = 'skipped'
5. 'snoozed' is set when user snoozes; replaced by 'taken'/'skipped' when resolved
```

**Edge Cases:**
- Dose taken before scheduled time: Treated as "taken" (early doses count as on-time)
- Multiple doses logged for same scheduled time: Only the most recent log counts for adherence
- Dose logged for past date/time via manual entry: Status is determined by the provided actualTime vs. scheduledTime

##### Pill Count Decrement on Dose

**Purpose:** Automatically reduce pill inventory when a dose is taken.

**Logic:**
```
1. WHEN status = 'taken' AND medication.pillCount IS NOT NULL:
     medication.pillCount -= medication.pillsPerDose
     IF medication.pillCount < 0 THEN medication.pillCount = 0
2. WHEN dose is undone (deleted) AND original status was 'taken':
     medication.pillCount += medication.pillsPerDose
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Dose log write fails | Toast: "Could not record dose. Please try again." | User taps Take/Skip again |
| Undo dose fails | Toast: "Could not undo dose log." | User tries again or ignores |
| Pill count goes negative | Pill count is clamped to 0; no error displayed | System self-corrects |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a reminder for "Lisinopril" at 08:00,
   **When** the user taps "Take" at 08:05,
   **Then** a dose log is created with status "taken", scheduledTime 08:00, actualTime 08:05.

2. **Given** a reminder for "Metformin" at 08:00,
   **When** the user taps "Take" at 09:15 (75 minutes late),
   **Then** a dose log is created with status "late".

3. **Given** a dose log entry exists for "Lisinopril" today,
   **When** the user taps undo on that entry,
   **Then** the dose log is deleted and the reminder reappears in the Upcoming/Overdue section.

**Edge Cases:**

4. **Given** "Metformin" has pillCount=2 and pillsPerDose=1,
   **When** the user logs a dose as "taken",
   **Then** pillCount decreases to 1.

5. **Given** "Metformin" has pillCount=0,
   **When** the user logs a dose as "taken",
   **Then** pillCount remains at 0 (clamped).

**Negative Tests:**

6. **Given** the user taps "Skip" on a reminder,
   **When** the dose is logged,
   **Then** the status is "skipped" and pillCount is NOT decremented.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| classifies on-time dose as taken | scheduled: 08:00, actual: 08:10 | status = "taken" |
| classifies late dose | scheduled: 08:00, actual: 08:45 | status = "late" |
| classifies early dose as taken | scheduled: 08:00, actual: 07:50 | status = "taken" |
| decrements pill count on taken | pillCount: 30, pillsPerDose: 1, status: taken | pillCount = 29 |
| does not decrement on skip | pillCount: 30, status: skipped | pillCount = 30 |
| clamps pill count at zero | pillCount: 0, pillsPerDose: 1, status: taken | pillCount = 0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log dose and verify history | 1. Log dose, 2. Query getDoseLogsForDate | Dose appears in date query |
| Undo dose restores reminder | 1. Log dose (taken), 2. Undo dose | Dose log deleted, reminder reappears |
| Log dose decrements pills | 1. Set pillCount=10, 2. Log taken dose | pillCount = 9 |

---

### MD-004: Refill Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-004 |
| **Feature Name** | Refill Tracking |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want the app to track my pill supply and warn me when I am running low, so that I can request a refill before I run out.

**Secondary:**
> As a Caregiver, I want to see how many days of supply remain for each medication, so that I can coordinate refills for my dependent.

#### 3.3 Detailed Description

Refill Tracking maintains an inventory of the user's medication supply and alerts them when supply is running low. Each medication has an optional pill count that decrements automatically when doses are logged as "taken." Users can record refills, which add a specified quantity to the pill count.

The system calculates a "burn rate" based on the medication's frequency and pills-per-dose to estimate days of supply remaining. When supply drops below a configurable threshold (default: 7 days), a low supply alert appears on the medication card and on the Today screen.

Refill history is maintained for each medication, showing past refill dates, quantities, and pharmacy information.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - refills are linked to medications

**External Dependencies:**
- Local SQLite database

#### 3.5 User Interface Requirements

##### Screen: Medication Detail (Refill Section)

**Layout:**
- "Supply" section on the Medication Detail screen showing:
  - Current pill count (large number with unit)
  - Days remaining estimate (calculated from burn rate)
  - Progress bar (green > 14 days, yellow 7-14 days, red < 7 days)
  - "Record Refill" button
- Below the supply section: "Refill History" list showing past refills (date, quantity, pharmacy)

##### Modal: Record Refill

**Layout:**
- Quantity input (number, required, min 1)
- Refill date (date picker, defaults to today)
- Pharmacy (text input, optional, pre-populated from medication)
- Notes (text input, optional)
- "Save" button

#### 3.6 Data Requirements

##### Entity: Refill

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| medicationId | string | Required, FK to Medication.id, CASCADE delete | None | Associated medication |
| quantity | integer | Required, min 1 | None | Number of pills/units added |
| refillDate | string | Required, ISO 8601 date | Current date | Date of the refill |
| pharmacy | string | Nullable, max 255 chars | null | Pharmacy where refill was picked up |
| notes | string | Nullable, max 500 chars | null | Optional notes |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `medicationId` - lookup refills for a specific medication

#### 3.7 Business Logic Rules

##### Burn Rate Calculation

**Purpose:** Calculate the daily pill consumption rate for a medication.

**Inputs:**
- frequency: MedFrequency
- pillsPerDose: integer

**Logic:**
```
dosesPerDay:
  daily      -> 1
  twice_daily -> 2
  weekly     -> 1/7 (0.143)
  as_needed  -> 0 (no calculable burn rate)
  custom     -> 1 (default assumption)

burnRate = pillsPerDose * dosesPerDay
```

**Formulas:**
- `burnRate = pillsPerDose * dosesPerDay(frequency)`
- `daysRemaining = floor(pillCount / burnRate)`

**Edge Cases:**
- As-needed medications: burnRate = 0, daysRemaining = Infinity (no supply warning)
- pillCount is null: daysRemaining = null (supply tracking not enabled)
- pillCount = 0: daysRemaining = 0, low supply alert fires immediately
- burnRate rounds to non-integer: Use exact float division, floor the final days count

##### Low Supply Alert

**Purpose:** Warn users when medication supply is running low.

**Inputs:**
- thresholdDays: integer (default: 7)

**Logic:**
```
1. FOR EACH active medication WHERE pillCount IS NOT NULL:
     burnRate = calculateBurnRate(medication)
     IF burnRate = 0 THEN SKIP (as-needed)
     daysRemaining = floor(pillCount / burnRate)
     IF daysRemaining < thresholdDays THEN
       ADD to alert list: { medicationId, name, pillCount, daysRemaining }
2. RETURN alert list sorted by daysRemaining ascending
```

##### Refill Recording

**Purpose:** Record a refill and add pills to inventory.

**Logic:**
```
1. INSERT refill record with quantity, date, pharmacy, notes
2. UPDATE medication SET pillCount = COALESCE(pillCount, 0) + quantity
3. Both operations run inside a database transaction
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Refill save fails | Toast: "Could not record refill. Please try again." | User retries |
| Quantity is zero or negative | Inline validation: "Quantity must be at least 1" | User corrects input |
| Pill count is not set for medication | Supply section shows "Pill count not tracked. Tap to enable." | User taps to set initial pill count |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** "Lisinopril" has pillCount=10 and pillsPerDose=1 and frequency="daily",
   **When** the user views the medication detail,
   **Then** daysRemaining shows "10 days" and the progress bar is yellow.

2. **Given** the user records a refill of 90 pills for "Lisinopril" (current pillCount=5),
   **When** the refill is saved,
   **Then** pillCount becomes 95 and the refill appears in the history list.

3. **Given** "Metformin" has pillCount=3 and frequency="twice_daily" and pillsPerDose=1,
   **When** the low supply alerts are calculated (threshold=7),
   **Then** "Metformin" appears in the alert list with daysRemaining=1.

**Edge Cases:**

4. **Given** a medication has frequency="as_needed",
   **When** supply alerts are calculated,
   **Then** the medication is skipped (no alert generated).

5. **Given** a medication has pillCount=null,
   **When** the medication detail is viewed,
   **Then** the supply section shows "Pill count not tracked."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates daily burn rate | frequency: daily, pillsPerDose: 1 | burnRate = 1 |
| calculates twice_daily burn rate | frequency: twice_daily, pillsPerDose: 2 | burnRate = 4 |
| calculates weekly burn rate | frequency: weekly, pillsPerDose: 1 | burnRate = 0.143 |
| returns 0 for as_needed | frequency: as_needed | burnRate = 0 |
| calculates days remaining | pillCount: 30, burnRate: 2 | daysRemaining = 15 |
| returns null for null pill count | pillCount: null | daysRemaining = null |
| low supply alert fires at threshold | pillCount: 5, burnRate: 1, threshold: 7 | Alert generated (5 < 7) |
| no alert above threshold | pillCount: 10, burnRate: 1, threshold: 7 | No alert (10 >= 7) |

---

### MD-005: Drug Interaction Checker

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-005 |
| **Feature Name** | Drug Interaction Checker |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want the app to warn me about dangerous drug interactions when I add a new medication, so that I can discuss potential risks with my doctor.

**Secondary:**
> As a Caregiver, I want to see all known interactions for my dependent's medication list, so that I can proactively alert their doctor to risks.

#### 3.3 Detailed Description

The Drug Interaction Checker maintains a bundled database of 200+ known drug interaction pairs and automatically checks for interactions whenever a new medication is added or the user's active medication list changes. Each interaction pair has a severity level (mild, moderate, or severe) and a description of the clinical risk sourced from FDA data.

The interaction database is shipped entirely on-device. No network request is ever made to check interactions. This ensures privacy (the user's medication list never leaves the device) and offline availability.

When a user adds a new medication, the system checks the new drug's name against all other active medications. If interactions are found, they are displayed as warnings sorted by severity (severe first). The user acknowledges the warning and can choose to proceed or cancel.

Users can also view all known interactions for any medication from its detail screen, regardless of whether those interacting drugs are currently in their medication list.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - interactions are checked against the active medication list

**External Dependencies:**
- None (interaction database is bundled locally)

#### 3.5 User Interface Requirements

##### Modal: Interaction Warning

**Layout:**
- Appears automatically after saving a new medication if interactions are found
- Header: "Drug Interaction Warning" with a caution icon
- List of interaction warnings, each showing:
  - Severity badge (red for severe, orange for moderate, yellow for mild)
  - The interacting drug name
  - Description of the interaction risk
- Footer text: "This information is for reference only. Consult your healthcare provider about medication interactions."
- Buttons: "I Understand" (dismisses and keeps the medication) and "Remove Medication" (deletes the just-added medication)

##### Screen: Medication Detail (Interactions Section)

**Layout:**
- "Known Interactions" section on the Medication Detail screen
- Lists all interactions from the database involving this medication's name
- Each row shows: severity badge, interacting drug name, description
- If no interactions are known: "No known interactions in our database"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Interactions | Drug has no entries in the interaction database | Message: "No known interactions in our database. Always consult your pharmacist." |
| Has Interactions | One or more interactions found | Sorted list: severe first, then moderate, then mild |

#### 3.6 Data Requirements

##### Entity: DrugInteraction

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | None | Unique identifier (e.g., "int-051") |
| drugA | string | Required, max 100 chars | None | First drug in the interaction pair |
| drugB | string | Required, max 100 chars | None | Second drug in the interaction pair |
| severity | enum | One of: mild, moderate, severe | moderate | Clinical severity of the interaction |
| description | string | Required, max 500 chars | None | Description of the clinical risk |
| source | string | Required, max 50 chars | None | Data source (e.g., "FDA") |

**Indexes:**
- `(drugA, drugB)` - lookup by drug pair
- `UNIQUE (drugA, drugB)` - prevent duplicate interaction pairs

#### 3.7 Business Logic Rules

##### Interaction Check Algorithm

**Purpose:** Check a drug against the user's active medication list for known interactions.

**Inputs:**
- drugName: string - the drug being checked
- activeMedNames: string[] - names of all currently active medications

**Logic:**
```
1. IF activeMedNames is empty THEN RETURN empty list
2. Normalize drugName to lowercase, trimmed
3. Normalize all activeMedNames to lowercase, trimmed
4. QUERY md_interactions WHERE LOWER(drug_a) = normalizedDrug OR LOWER(drug_b) = normalizedDrug
5. FOR EACH interaction row:
     Determine 'other' = the drug in the pair that is NOT our drugName
     IF other is in normalizedActive THEN
       ADD to warnings: { drug: other, severity, description }
6. RETURN warnings sorted by severity (severe > moderate > mild)
```

**Edge Cases:**
- Drug name casing: All comparisons are case-insensitive ("Lisinopril" matches "lisinopril")
- Drug name with extra whitespace: Names are trimmed before comparison
- Same drug checked against itself: No interaction (a drug does not interact with itself)
- Drug not in database: Returns empty warnings list (no false alarms)
- Multiple active medications interacting with the same new drug: Each interaction is returned as a separate warning

##### Interaction Database Seeding

**Purpose:** Populate the interaction database on module enable.

**Logic:**
```
1. Migration V2 seeds 50 initial interaction pairs via INSERT statements
2. On first app launch, seedAdditionalInteractions() adds 150+ more pairs
3. Uses INSERT OR IGNORE to be idempotent (safe to call multiple times)
4. Total: 200+ interaction pairs covering anticoagulants, SSRIs, statins, diabetes meds,
   BP meds, opioids, antibiotics, cardiac drugs, psychiatric meds, seizure meds,
   immunosuppressants, GI meds, pain/anti-inflammatory, thyroid meds, muscle relaxants,
   antifungals, herbal/supplements, antivirals, corticosteroids, diuretics, migraine meds,
   urological, respiratory, gout meds, antiemetics, and osteoporosis meds
```

##### Severity Classification

| Severity | Meaning | User Action |
|----------|---------|-------------|
| **Mild** | Minor interaction; usually no clinical action required. Monitor if symptomatic. | Informational notice; no action required |
| **Moderate** | Clinically significant; may require dose adjustment, additional monitoring, or timing separation. | Warning displayed; user should discuss with doctor |
| **Severe** | Potentially dangerous or life-threatening. Combination may be contraindicated. | Prominent alert with red badge; user strongly advised to consult doctor before proceeding |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Interaction database is empty (seeding failed) | No interaction warnings shown; message in detail screen: "Interaction database not loaded. Restart the app." | App re-runs seeding on next launch |
| Drug name matches no database entries | "No known interactions" - no false positive | None needed |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has "Warfarin" as an active medication,
   **When** they add "Ibuprofen",
   **Then** an interaction warning appears showing "Aspirin - Ibuprofen may reduce aspirin cardioprotective effect" or the relevant warfarin-NSAID interaction with severity "moderate."

2. **Given** the user has no active medications,
   **When** they add "Lisinopril",
   **Then** no interaction warning appears.

3. **Given** the user views the detail screen for "Warfarin",
   **When** they scroll to the Known Interactions section,
   **Then** all interactions involving warfarin from the database are listed (vitamin K, fluconazole, amiodarone, metronidazole, etc.) sorted by severity.

**Edge Cases:**

4. **Given** the user adds "lisinopril" (lowercase),
   **When** the interaction check runs against an active medication named "Lisinopril" (capitalized),
   **Then** the comparison is case-insensitive and the check works correctly.

5. **Given** the interaction database has not been seeded,
   **When** the user adds a medication,
   **Then** no false interaction warnings are shown.

**Negative Tests:**

6. **Given** the user adds a medication named "VitaminD3" (not in the interaction database),
   **When** the interaction check runs,
   **Then** no warnings are generated
   **And** the medication is saved normally.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| finds interaction between active meds | drugName: "warfarin", active: ["aspirin"] | 1 warning with relevant interaction |
| returns empty for no active meds | drugName: "aspirin", active: [] | 0 warnings |
| case-insensitive matching | drugName: "WARFARIN", active: ["aspirin"] | 1 warning |
| no self-interaction | drugName: "aspirin", active: ["aspirin"] | 0 warnings (drug does not interact with itself) |
| multiple interactions found | drugName: "warfarin", active: ["fluconazole", "amiodarone"] | 2 warnings |
| seeding is idempotent | seed twice | No duplicate rows, same row count |

---

### MD-006: Mood Journaling

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-006 |
| **Feature Name** | Mood Journaling |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Mental Health Patient, I want to log my mood multiple times per day using a rich vocabulary, so that I can track emotional patterns over time.

**Secondary:**
> As a Daily Med Manager, I want to see how my mood correlates with my medication changes, so that I can discuss medication effectiveness with my therapist.

#### 3.3 Detailed Description

Mood Journaling uses a 144-descriptor vocabulary organized into four quadrants based on the "How We Feel" mood meter model: High Energy + Pleasant, High Energy + Unpleasant, Low Energy + Pleasant, and Low Energy + Unpleasant. Each quadrant contains 36 descriptors. A simplified mobile set of 36 descriptors (9 per quadrant) is available for quick entry.

Users select a mood descriptor, which auto-maps to an energy level (high/low) and pleasantness (pleasant/unpleasant). They then set an intensity (1-5 scale), optionally tag activities from a predefined list (exercise, work, socializing, reading, meditation, outdoors, cooking, creative, family, sleep, travel, shopping), and add free-form notes.

The mood calendar provides a year-in-pixels view where each day is colored by dominant mood pleasantness (green for pleasant, red for unpleasant, gray for neutral/no data). Tapping a day shows a detail view with all mood entries, activities, and notes for that date.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (mood journaling works independently)

**External Dependencies:**
- Local SQLite database

#### 3.5 User Interface Requirements

##### Screen: Mood (Tab 4)

**Layout:**
- Top section: "How are you feeling?" prompt with a large "Check In" button
- Below: Mood calendar (year-in-pixels grid showing the current month, swipeable to previous months)
- Each day cell is colored: green (pleasant), red (unpleasant), gray (no data/neutral)
- Tapping a day cell shows a bottom sheet with that day's mood entries
- Below calendar: "Recent Entries" list showing the last 7 mood entries with descriptor, time, and intensity

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No mood entries ever | Illustration, message "Start tracking your mood. Tap Check In to begin." |
| Calendar View | Entries exist | Colored grid with recent entries list below |
| Day Detail | User tapped a calendar day | Bottom sheet showing all entries for that day |

##### Modal: Mood Check-In

**Layout:**
- Step 1: Four-quadrant grid. Each quadrant is labeled (e.g., "Calm & Content" for Low Energy Pleasant). Tapping a quadrant reveals its mood descriptors.
- Step 2: Grid of mood descriptor chips within the selected quadrant. Mobile shows 9 simplified descriptors; full mode shows all 36. User taps one descriptor.
- Step 3: Intensity slider (1-5) with emoji indicators
- Step 4: Activity tags (multi-select from predefined list + custom activity input)
- Step 5: Optional notes text field (max 2000 chars)
- "Save" button submits the entry

#### 3.6 Data Requirements

##### Entity: MoodEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| mood | string | Required, min 1 char | None | Selected mood descriptor (e.g., "calm", "anxious") |
| energyLevel | enum | One of: high, low | None | Energy component from quadrant selection |
| pleasantness | enum | One of: pleasant, unpleasant, neutral | None | Pleasantness component |
| intensity | integer | Min 1, max 5 | 3 | How strongly the mood is felt |
| notes | string | Nullable, max 2000 chars | null | Free-form notes |
| recordedAt | string | ISO 8601 datetime | Current timestamp | When the mood was recorded |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: MoodActivity

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| moodEntryId | string | Required, FK to MoodEntry.id, CASCADE delete | None | Associated mood entry |
| activity | string | Required, min 1 char | None | Activity tag (e.g., "exercise", "work") |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `recordedAt` on MoodEntry - time-range queries for calendar and reports
- `moodEntryId` on MoodActivity - lookup activities for a mood entry

#### 3.7 Business Logic Rules

##### Mood Vocabulary Structure

**Purpose:** Organize 144 mood descriptors into four quadrants.

| Quadrant | Energy | Pleasantness | Example Descriptors |
|----------|--------|-------------|-------------------|
| High Energy + Pleasant | high | pleasant | excited, joyful, energetic, inspired, confident, proud |
| High Energy + Unpleasant | high | unpleasant | anxious, angry, frustrated, stressed, irritated, overwhelmed |
| Low Energy + Pleasant | low | pleasant | calm, content, relaxed, peaceful, grateful, serene |
| Low Energy + Unpleasant | low | unpleasant | sad, tired, lonely, bored, numb, drained |

Each quadrant contains 36 descriptors (144 total). Mobile simplified mode uses 9 per quadrant (36 total).

##### Daily Mood Summary

**Purpose:** Aggregate mood data for a single day.

**Logic:**
```
1. QUERY all MoodEntries for the given date
2. Collect all unique activities across entries
3. Determine dominantMood = the most frequently occurring mood descriptor
4. Calculate averageIntensity = mean of all entry intensity values
5. RETURN { date, entries, activities, dominantMood, averageIntensity }
```

##### Mood Calendar Generation

**Purpose:** Generate a month view of mood data for the year-in-pixels display.

**Logic:**
```
1. FOR EACH day in the requested month:
     Query mood entries for that day
     IF no entries THEN color = gray, hasData = false
     ELSE:
       Count pleasant vs. unpleasant entries
       IF pleasant > unpleasant THEN dominantPleasantness = 'pleasant', color = green
       ELSE IF unpleasant > pleasant THEN dominantPleasantness = 'unpleasant', color = red
       ELSE dominantPleasantness = null, color = gray (tie)
2. RETURN array of { date, dominantMood, pleasantness, color, hasData }
```

##### Mood Color Mapping

| Pleasantness | Color | Hex |
|-------------|-------|-----|
| Pleasant | Green | #4CAF50 |
| Unpleasant | Red | #F44336 |
| Neutral/None | Gray | #9E9E9E |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Mood entry save fails | Toast: "Could not save mood entry. Please try again." | User retries |
| No mood selected (user taps save without selecting) | "Save" button remains disabled until a mood descriptor is selected | User selects a mood |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens Mood Check-In,
   **When** they tap the "Calm & Content" quadrant, select "grateful", set intensity to 4, tag "meditation", and tap Save,
   **Then** a MoodEntry is created with mood="grateful", energyLevel="low", pleasantness="pleasant", intensity=4, and a MoodActivity with activity="meditation".

2. **Given** the user has logged 3 pleasant and 1 unpleasant mood entry today,
   **When** the mood calendar for today is rendered,
   **Then** today's cell is green (pleasant dominant).

3. **Given** the user taps a day on the mood calendar that has 2 entries,
   **When** the day detail bottom sheet opens,
   **Then** both entries are shown with their mood descriptors, intensities, activities, and notes.

**Edge Cases:**

4. **Given** a day has 2 pleasant and 2 unpleasant entries (tie),
   **When** the calendar renders that day,
   **Then** the cell is gray (neutral tie).

5. **Given** a day has no mood entries,
   **When** the calendar renders that day,
   **Then** the cell is gray with hasData=false.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| maps pleasant mood to green color | pleasantness: "pleasant" | color = "#4CAF50" |
| maps unpleasant mood to red color | pleasantness: "unpleasant" | color = "#F44336" |
| maps null to gray | pleasantness: null | color = "#9E9E9E" |
| calculates daily summary with dominant mood | 3x "calm", 1x "anxious" | dominantMood = "calm" |
| calculates average intensity | intensities: [2, 4, 3] | averageIntensity = 3.0 |
| simplified vocabulary has 9 per quadrant | MOOD_VOCABULARY_SIMPLIFIED | 9 descriptors in each of 4 quadrants |
| full vocabulary has 36 per quadrant | MOOD_VOCABULARY | 36 descriptors in each of 4 quadrants |

---

### MD-007: Symptom Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-007 |
| **Feature Name** | Symptom Logging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want to log symptoms I experience throughout the day with severity ratings, so that I can identify patterns and report them to my doctor.

**Secondary:**
> As a Migraine Sufferer, I want to create custom symptoms specific to my condition, so that I can track headache types, aura, and photophobia separately.

#### 3.3 Detailed Description

Symptom Logging provides a system for tracking health symptoms with timestamps and severity ratings. The module ships with 12 predefined symptoms common to medication side effects (headache, nausea, fatigue, insomnia, dizziness, anxiety, appetite change, dry mouth, stomach pain, joint pain, brain fog, muscle ache). Users can add custom symptoms to track condition-specific experiences.

Each symptom log entry records the symptom, a severity rating (1-5 scale), optional notes, and a timestamp. Symptom data feeds into the correlation engine (MD-009) for analyzing relationships between symptoms and medications, and into doctor reports (MD-010).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (symptom logging works independently)

**External Dependencies:**
- Local SQLite database

#### 3.5 User Interface Requirements

##### Screen: Log Symptom (accessed from Today screen or Medication Detail)

**Layout:**
- Grid of symptom chips showing predefined symptoms
- "Add Custom Symptom" button at the bottom of the grid
- Tapping a symptom chip opens a bottom sheet with:
  - Severity slider (1-5, with labels: 1=Barely noticeable, 2=Mild, 3=Moderate, 4=Severe, 5=Debilitating)
  - Notes field (optional, max 500 chars)
  - "Log" button
- After logging, a brief success toast appears

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Predefined symptoms loaded | Grid of 12 symptom chips + custom symptoms |
| Custom Added | User has added custom symptoms | Custom symptoms appear after predefined ones with a different accent |
| Logging | User tapped a symptom | Bottom sheet with severity and notes |

#### 3.6 Data Requirements

##### Entity: Symptom

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| name | string | Required, unique, max 100 chars | None | Symptom name (e.g., "headache") |
| isCustom | boolean | - | false | Whether this is a user-created symptom |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Entity: SymptomLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| symptomId | string | Required, FK to Symptom.id, CASCADE delete | None | Associated symptom |
| severity | integer | Required, min 1, max 5 | 3 | Symptom severity (1=barely noticeable, 5=debilitating) |
| notes | string | Nullable, max 500 chars | null | Optional notes |
| loggedAt | string | Required, ISO 8601 datetime | Current timestamp | When the symptom occurred |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `(symptomId, loggedAt)` - composite index for symptom-specific time range queries

##### Predefined Symptoms

The following 12 symptoms are seeded on module enable:

| Name | Description |
|------|------------|
| headache | Head pain of any type |
| nausea | Feeling of sickness or urge to vomit |
| fatigue | Persistent tiredness or exhaustion |
| insomnia | Difficulty falling or staying asleep |
| dizziness | Lightheadedness or vertigo |
| anxiety | Feelings of worry, nervousness, or unease |
| appetite_change | Increased or decreased appetite |
| dry_mouth | Reduced saliva production |
| stomach_pain | Abdominal pain or discomfort |
| joint_pain | Pain in joints |
| brain_fog | Difficulty concentrating or thinking clearly |
| muscle_ache | Muscle pain or soreness |

#### 3.7 Business Logic Rules

##### Severity Scale

| Level | Label | Description |
|-------|-------|-------------|
| 1 | Barely Noticeable | Present but does not affect daily activities |
| 2 | Mild | Noticeable but manageable without intervention |
| 3 | Moderate | Interferes somewhat with daily activities |
| 4 | Severe | Significantly interferes with daily activities |
| 5 | Debilitating | Prevents normal daily activities |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Symptom log save fails | Toast: "Could not log symptom. Please try again." | User retries |
| Duplicate custom symptom name | Inline error: "A symptom with this name already exists" | User changes name |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the symptom logger,
   **When** they tap "headache", set severity to 4, add note "Behind left eye", and tap Log,
   **Then** a SymptomLog is created with symptomId matching "headache", severity=4, and the note.

2. **Given** the user taps "Add Custom Symptom" and enters "photophobia",
   **When** they save the custom symptom,
   **Then** "photophobia" appears in the symptom grid with isCustom=true.

**Negative Tests:**

3. **Given** a custom symptom "headache" already exists (predefined),
   **When** the user tries to create a custom symptom named "headache",
   **Then** the system shows "A symptom with this name already exists"
   **And** no duplicate is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| seeds 12 predefined symptoms | seedPredefinedSymptoms() | 12 symptom records with isCustom=false |
| creates custom symptom | { name: "photophobia" } | Symptom with isCustom=true |
| rejects duplicate name | create "headache" when it exists | Error (UNIQUE constraint) |
| logs symptom with severity | symptomId, severity: 4, notes: "test" | SymptomLog created |
| queries logs by symptom and date | symptomId, date range | Filtered log entries |

---

### MD-008: Health Measurements

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-008 |
| **Feature Name** | Health Measurements |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Tracker, I want to log health measurements like blood pressure, blood sugar, weight, and temperature, so that I can track trends and share them with my doctor.

#### 3.3 Detailed Description

Health Measurements provides a generic measurement logging system that supports multiple measurement types. Each measurement records a type, a string value (to support compound values like "120/80" for blood pressure), a unit, optional notes, and a timestamp.

The current implementation supports five measurement types: blood_pressure, blood_sugar, weight, temperature, heart_rate, and custom. This feature provides the foundational measurement infrastructure that is extended by MD-014 (Blood Pressure Logging), MD-016 (Blood Glucose Logging), and MD-027 (Expanded Health Measurements) with type-specific UI and logic.

Measurements can be visualized as time-series trends with medication start/stop markers overlaid, enabling users to see how starting or stopping a medication affected their health metrics.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

**External Dependencies:**
- Local SQLite database

#### 3.5 User Interface Requirements

##### Screen: Log Measurement

**Layout:**
- Type picker (Blood Pressure, Blood Sugar, Weight, Temperature, Heart Rate, Custom)
- Value input (text, adapts to type: compound for BP, numeric for others)
- Unit display (auto-set based on type, user can override for custom)
- Notes field (optional)
- Date/time picker (defaults to now)
- "Save" button

##### Screen: Measurement Trends

**Layout:**
- Type selector at top (tabs or segmented control)
- Line chart showing values over time for the selected type
- Date range selector: 7 days, 30 days, 90 days, 365 days
- Vertical dashed lines on the chart marking medication start/stop dates (med markers)
- Below chart: table of recent measurements for the selected type

#### 3.6 Data Requirements

##### Entity: HealthMeasurement

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| type | enum | One of: blood_pressure, blood_sugar, weight, temperature, heart_rate, custom | None | Measurement category |
| value | string | Required, min 1 char | None | Measurement value (e.g., "120/80", "98.6", "140") |
| unit | string | Required, min 1 char | None | Unit of measurement (e.g., "mmHg", "mg/dL", "lbs", "F") |
| notes | string | Nullable, max 500 chars | null | Optional notes |
| measuredAt | string | Required, ISO 8601 datetime | Current timestamp | When the measurement was taken |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `(type, measuredAt)` - composite index for type-specific trend queries

#### 3.7 Business Logic Rules

##### Measurement Trend with Med Markers

**Purpose:** Overlay medication start/stop events on measurement trend charts.

**Logic:**
```
1. QUERY measurements of the given type within the date range, ordered by measuredAt ASC
2. QUERY medications where createdAt is within the date range (start events)
3. QUERY medications where endDate is within the date range (stop events)
4. RETURN { points: MeasurementTrendPoint[], markers: MedMarker[] }
```

**MedMarker format:** `{ medName: string, event: 'started' | 'stopped', date: string }`

##### Default Units by Type

| Type | Default Unit |
|------|-------------|
| blood_pressure | mmHg |
| blood_sugar | mg/dL |
| weight | lbs |
| temperature | F |
| heart_rate | bpm |
| custom | (user-specified) |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Measurement save fails | Toast: "Could not save measurement. Please try again." | User retries |
| Invalid value format | Inline validation: "Please enter a valid value" | User corrects input |
| No measurements for trend | Chart area shows "No data for this period. Log a measurement to see trends." | User logs a measurement |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects type "blood_pressure",
   **When** they enter value "120/80", unit "mmHg", and save,
   **Then** a HealthMeasurement record is created with type="blood_pressure", value="120/80", unit="mmHg".

2. **Given** 10 blood pressure measurements exist over 30 days and a medication was started on day 15,
   **When** the user views the BP trend chart for 30 days,
   **Then** the chart shows 10 data points and a vertical dashed line at day 15 labeled with the medication name.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| logs measurement with all fields | type, value, unit, notes, measuredAt | Record created with all fields |
| gets trend for date range | type: blood_pressure, 30-day range | Array of { date, value } points sorted ascending |
| includes med markers in trend | medication started within range | Marker with event="started" in response |
| includes stop markers | medication endDate within range | Marker with event="stopped" |

---

### MD-009: Correlation Engine

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-009 |
| **Feature Name** | Correlation Engine |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Mental Health Patient, I want to see whether starting a medication improved or worsened my mood, so that I can make informed decisions about my treatment with my doctor.

**Secondary:**
> As a Daily Med Manager, I want to see whether my symptoms decreased after starting a medication, so that I can evaluate its effectiveness.

#### 3.3 Detailed Description

The Correlation Engine analyzes statistical relationships between medications, mood, symptoms, and adherence. It provides three core analyses:

1. **Mood-Medication Correlation:** Compares average mood pleasantness scores before and after a medication's start date, reporting the percentage change and data point counts.

2. **Symptom-Medication Correlation:** Compares symptom frequency before and after a medication's start date, reporting per-symptom occurrence counts and percentage change.

3. **Adherence-Mood Correlation:** Calculates the Pearson correlation coefficient between daily medication adherence (binary: all doses taken = 1, any missed = 0) and daily mood score, and reports average mood on adherent vs. missed days.

Additionally, the engine provides an Overall Wellness Timeline that aggregates daily mood scores, adherence rates, and symptom counts across a configurable date range.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - medication start dates
- MD-003: Dose Logging - adherence data
- MD-006: Mood Journaling - mood data
- MD-007: Symptom Logging - symptom data

**External Dependencies:**
- Local SQLite database with sufficient historical data (minimum 7 data points recommended for meaningful correlation)

#### 3.5 User Interface Requirements

##### Screen: Correlations

**Layout:**
- Medication picker at top (select which medication to analyze)
- Time period selector: 30, 60, 90, 180 days
- Three analysis cards:
  - **Mood Impact:** Shows before/after average mood pleasantness with direction arrow (improved/declined/stable), percentage change, and data point counts
  - **Symptom Impact:** Table of symptoms showing before/after occurrence counts and percentage change (green for decrease, red for increase)
  - **Adherence-Mood Link:** Pearson r coefficient with interpretation label, average mood on adherent vs. missed days
- "Insufficient Data" badge on any analysis with fewer than 7 data points in either before or after period

##### Screen: Wellness Timeline

**Layout:**
- Multi-line chart showing three overlaid metrics for a date range:
  - Mood score (green line, -1 to +1 scale)
  - Adherence rate (blue line, 0-100%)
  - Symptom count (red dots, count per day)
- Date range selector: 7, 30, 90 days
- Swipeable horizontally across dates

#### 3.6 Data Requirements

No new entities. The correlation engine queries data from existing tables: `md_medications`, `md_mood_entries`, `md_symptom_logs`, `md_dose_logs`, `md_symptoms`.

##### Output Types

**MoodMedicationCorrelation:**
```
{
  medicationName: string,
  medicationStartDate: string,
  beforeAverage: number | null,     // range: -1 to +1
  afterAverage: number | null,      // range: -1 to +1
  changePercent: number | null,
  beforeDataPoints: number,
  afterDataPoints: number
}
```

**SymptomMedicationCorrelation:**
```
{
  medicationName: string,
  medicationStartDate: string,
  symptoms: [{
    symptomName: string,
    beforeCount: number,
    afterCount: number,
    changePercent: number
  }]
}
```

**AdherenceMoodCorrelation:**
```
{
  correlationCoefficient: number,   // Pearson r, range: -1 to +1
  adherentDaysMoodAvg: number | null,
  missedDaysMoodAvg: number | null
}
```

#### 3.7 Business Logic Rules

##### Mood Pleasantness Scoring

**Purpose:** Convert pleasantness enum to a numeric score for statistical analysis.

**Logic:**
```
pleasant   -> +1
neutral    ->  0
unpleasant -> -1
```

##### Mood-Medication Correlation Algorithm

**Purpose:** Compare mood before and after starting a medication.

**Inputs:**
- medicationId: string
- days: number (lookback period, default 90)

**Logic:**
```
1. GET medication name and created_at (startDate) from md_medications
2. Calculate cutoff = today - days
3. QUERY mood entries WHERE recordedAt >= cutoff AND recordedAt < startDate -> "before" set
4. QUERY mood entries WHERE recordedAt >= startDate -> "after" set
5. beforeAverage = mean(pleasantnessToScore(entry.pleasantness)) for before set
6. afterAverage = mean(pleasantnessToScore(entry.pleasantness)) for after set
7. IF beforeAverage != 0 AND both sets non-empty THEN
     changePercent = round(((afterAverage - beforeAverage) / |beforeAverage|) * 100)
8. RETURN { medicationName, medicationStartDate, beforeAverage, afterAverage, changePercent, beforeDataPoints, afterDataPoints }
```

**Edge Cases:**
- No mood entries before start date: beforeAverage = null, changePercent = null
- No mood entries after start date: afterAverage = null, changePercent = null
- beforeAverage = 0: changePercent = null (division by zero avoided)
- Medication does not exist: return null

##### Symptom-Medication Correlation Algorithm

**Purpose:** Compare symptom frequency before and after starting a medication.

**Logic:**
```
1. GET medication name and startDate
2. FOR EACH symptom in md_symptoms:
     beforeCount = COUNT(symptom_logs WHERE loggedAt >= cutoff AND loggedAt < startDate)
     afterCount = COUNT(symptom_logs WHERE loggedAt >= startDate)
     IF beforeCount > 0 OR afterCount > 0 THEN
       changePercent = beforeCount > 0 ? round(((afterCount - beforeCount) / beforeCount) * 100)
                     : afterCount > 0 ? 100 : 0
       ADD to results
3. RETURN symptoms list with counts and change percentages
```

##### Adherence-Mood Pearson Correlation

**Purpose:** Calculate the statistical relationship between daily adherence and mood.

**Inputs:**
- medicationId: string
- days: number (default 90)

**Logic:**
```
1. Get daily adherence: GROUP dose_logs BY date, adherent = 1 if all taken, 0 otherwise
2. Get daily mood: GROUP mood_entries BY date, avg_score = mean(pleasantnessToScore)
3. Pair adherence and mood by date (only dates with both data points)
4. Calculate Pearson correlation coefficient:
     r = (n * sum(xy) - sum(x) * sum(y)) / sqrt((n * sum(x^2) - sum(x)^2) * (n * sum(y^2) - sum(y)^2))
5. Also calculate average mood on adherent days vs. missed days
6. Round r to 3 decimal places
7. RETURN { correlationCoefficient, adherentDaysMoodAvg, missedDaysMoodAvg }
```

**Minimum data requirements:**
- Pearson coefficient requires at least 2 paired data points
- Fewer than 2 pairs: coefficient = 0

##### Correlation Coefficient Interpretation

| Range | Label | Meaning |
|-------|-------|---------|
| 0.7 to 1.0 | Strong positive | Strong relationship: higher adherence strongly associated with better mood |
| 0.3 to 0.7 | Moderate positive | Moderate relationship between adherence and mood |
| -0.3 to 0.3 | Weak/none | No meaningful relationship detected |
| -0.7 to -0.3 | Moderate negative | Moderate inverse relationship |
| -1.0 to -0.7 | Strong negative | Strong inverse relationship |

##### Wellness Timeline Algorithm

**Purpose:** Generate daily wellness snapshots across a date range.

**Logic:**
```
1. FOR EACH day from 'from' to 'to':
     moodScore = mean(pleasantnessToScore) for mood entries that day (null if no entries)
     adherenceRate = (taken doses / total doses) * 100 for that day (100 if no doses scheduled)
     symptomCount = COUNT(symptom_logs) for that day
     EMIT { date, moodScore, adherenceRate, symptomCount }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient data (< 7 points in before or after) | "Insufficient Data" badge on the analysis card, with message "Log more mood entries to see this correlation" | User logs more data over time |
| Medication not found | Screen shows "Medication not found. It may have been deleted." | User selects a different medication |
| No medications to analyze | Screen shows "Add and track medications to see correlations" | User adds medications first |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user started "Sertraline" 30 days ago and has 15 mood entries before and 15 after,
   **When** they view the Mood Impact correlation for Sertraline,
   **Then** the card shows beforeAverage, afterAverage, changePercent, and both data point counts.

2. **Given** the user has 60 days of dose logs and mood entries for "Lisinopril",
   **When** they view the Adherence-Mood correlation,
   **Then** the Pearson coefficient is calculated and displayed with an interpretation label.

**Edge Cases:**

3. **Given** a medication was added today (no "before" data),
   **When** the correlation is viewed,
   **Then** the Mood Impact card shows "Insufficient Data" badge.

4. **Given** Pearson coefficient = 0.05 (near zero),
   **When** displayed,
   **Then** the interpretation label reads "Weak/none."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| scores pleasant as +1 | pleasantness: "pleasant" | 1 |
| scores unpleasant as -1 | pleasantness: "unpleasant" | -1 |
| scores neutral as 0 | pleasantness: "neutral" | 0 |
| calculates before/after mood averages | 5 pleasant before, 3 unpleasant after | beforeAvg = 1.0, afterAvg = -1.0 |
| returns null for no before data | 0 entries before, 5 after | beforeAverage = null |
| calculates Pearson coefficient | known paired data | Expected r value |
| handles < 2 pairs for Pearson | 1 pair | coefficient = 0 |
| counts symptom changes | 3 headaches before, 1 after | changePercent = -67 |
| wellness timeline daily aggregation | date range with mixed data | Array of daily snapshots |

---

### MD-010: Doctor Report Generation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-010 |
| **Feature Name** | Doctor Report Generation |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want to generate a formatted report of my medication history, adherence, mood trends, and symptoms for a date range, so that I can share it with my doctor at appointments.

**Secondary:**
> As a Mental Health Patient, I want a therapy-specific report with detailed mood logs and activity data, so that my therapist has a comprehensive view of my emotional patterns.

#### 3.3 Detailed Description

Doctor Report Generation produces two types of Markdown-formatted reports that users can export, print, or share:

1. **Doctor Report:** A clinical summary including medication list (with dosage, frequency, status), adherence summary (percentage and dose counts), health measurements (most recent 20), mood summary (pleasant/unpleasant/neutral distribution and top moods), symptom summary (occurrence counts per symptom), and correlation highlights (mood changes since starting new medications).

2. **Therapy Report:** Extends the Doctor Report with a detailed mood log showing each individual mood entry with the descriptor, energy level, pleasantness, intensity, notes, and activities.

Reports are generated entirely on-device from local data. They are exported as Markdown files that can be rendered, printed, or shared. No data is transmitted to any server.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - medication list
- MD-003: Dose Logging - adherence data
- MD-006: Mood Journaling - mood data
- MD-007: Symptom Logging - symptom data
- MD-008: Health Measurements - measurement data

**External Dependencies:**
- File system access for saving exported reports

#### 3.5 User Interface Requirements

##### Screen: Export (accessible from Settings tab)

**Layout:**
- Report type picker: "Doctor Report" | "Therapy Report"
- Date range selector: Start date and End date (date pickers)
- Quick presets: "Last 30 days", "Last 90 days", "Last 6 months", "Last year"
- "Generate Report" button
- Preview area showing rendered Markdown
- "Share" button (opens OS share sheet for file)
- "Copy" button (copies Markdown text to clipboard)

#### 3.6 Data Requirements

No new entities. Reports aggregate data from existing tables.

#### 3.7 Business Logic Rules

##### Doctor Report Sections

**Purpose:** Generate a structured clinical report.

**Sections (in order):**
```
1. HEADER: "Health Report: [from] to [to]" with generation date
2. MEDICATIONS: Table of all medications (name, dosage, frequency, start date, status)
3. ADHERENCE SUMMARY: Overall adherence percentage and dose counts for the period
4. HEALTH MEASUREMENTS: Table of most recent 20 measurements (date, type, value, unit)
5. MOOD SUMMARY: Total entries, pleasant/unpleasant/neutral distribution (count + %),
   top 5 most common mood descriptors
6. SYMPTOM SUMMARY: Table of symptoms by occurrence count (descending)
7. CORRELATION HIGHLIGHTS: For each medication started during the period,
   compare before/after mood and note if mood improved/declined/remained stable
8. FOOTER: "Generated by MyMeds. All data stored locally on your device."
```

##### Therapy Report Extension

**Purpose:** Add detailed mood logs to the doctor report.

**Additional section inserted before footer:**
```
DETAILED MOOD LOG: For each mood entry in the period (chronological):
  - Date and time
  - Mood descriptor (bold), energy level, pleasantness
  - Intensity (X/5)
  - Notes (if any)
  - Activities (if any)
```

##### Correlation Direction Classification

**Logic:**
```
afterAvg - beforeAvg:
  > 0.1  -> "improved"
  < -0.1 -> "declined"
  else   -> "remained stable"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data in selected date range | Report generates with "No [X] recorded in this period." for empty sections | User adjusts date range |
| File share fails | Toast: "Could not share report. Try copying to clipboard instead." | User uses Copy button |
| Date range invalid (start > end) | Inline validation: "Start date must be before end date" | User corrects dates |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has medications, dose logs, mood entries, and symptom logs for the last 30 days,
   **When** they generate a Doctor Report for the last 30 days,
   **Then** a Markdown document is produced with all 7 sections populated with correct data.

2. **Given** the user generates a Therapy Report,
   **When** the report is rendered,
   **Then** it contains all Doctor Report sections plus the Detailed Mood Log with individual entries.

**Edge Cases:**

3. **Given** no mood entries exist in the date range,
   **When** the Doctor Report is generated,
   **Then** the Mood Summary section shows "No mood entries recorded in this period."

4. **Given** no medications were started during the period,
   **When** the Correlation Highlights section is rendered,
   **Then** it shows "No new medications started during this period."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates report with all sections | populated database, 30-day range | Markdown string containing all 7 section headers |
| handles empty medication list | no medications | "No medications recorded." in output |
| calculates adherence percentage | 27 taken, 3 skipped | "90%" in adherence section |
| therapy report includes mood detail | 3 mood entries | 3 detailed mood entries in output |
| handles empty date range | future dates with no data | All sections show "No [X] recorded" |

---

### MD-011: Adherence Analytics Dashboard

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-011 |
| **Feature Name** | Adherence Analytics Dashboard |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want to see my adherence rate for each medication as a percentage with trend indicators, so that I can identify which medications I am most likely to miss.

#### 3.3 Detailed Description

The Adherence Analytics Dashboard provides per-medication adherence statistics including adherence rate (percentage of doses taken on time or late vs. total scheduled), current streak (consecutive days with all doses taken), total taken/missed/late counts, and an adherence calendar showing day-by-day status.

Adherence is calculated using dose logs from the `md_dose_logs` table. "Taken" and "late" doses count as adherent. "Skipped" doses count as missed. "Snoozed" doses are transient and excluded from final calculations.

The adherence calendar provides a monthly view where each day is colored based on adherence: green (all doses taken), yellow (some taken, some missed), red (all missed), gray (no doses scheduled).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - medications to track
- MD-003: Dose Logging - dose log data

#### 3.5 User Interface Requirements

##### Screen: History (Tab 3) - Adherence Section

**Layout:**
- Per-medication adherence cards showing:
  - Medication name and dosage
  - Circular progress indicator with adherence percentage (green > 90%, yellow 70-90%, red < 70%)
  - Current streak (e.g., "12 day streak")
  - Quick stats row: X taken, Y missed, Z late
- Below cards: Adherence calendar (monthly grid, color-coded by day status)
- Time range selector: 7, 30, 90 days

#### 3.6 Data Requirements

No new entities. Uses existing `md_dose_logs` and `md_medications` tables.

##### Output Types

**AdherenceStats:**
```
{
  rate: number,          // percentage, one decimal place (e.g., 95.5)
  streak: number,        // consecutive adherent days from most recent
  totalTaken: number,
  totalMissed: number,
  totalLate: number
}
```

#### 3.7 Business Logic Rules

##### Adherence Rate Calculation

**Purpose:** Calculate the percentage of doses taken for a medication over a date range.

**Logic:**
```
1. QUERY dose_logs for medicationId within date range
2. EXCLUDE entries with status = 'snoozed' (transient state)
3. Count taken = entries with status 'taken' OR 'late'
4. Count total = all non-snoozed entries
5. rate = round((taken / total) * 100, 1 decimal)
6. IF total = 0 THEN rate = 0
```

##### Streak Calculation

**Purpose:** Count consecutive days where all scheduled doses were taken.

**Logic:**
```
1. IF medication frequency = 'as_needed' THEN RETURN 0 (no schedule = no streak)
2. GET all dose logs ordered by date descending
3. GROUP by date
4. Walk backwards from most recent date:
     IF date has a gap from expected previous day THEN BREAK
     IF any status in day is NOT 'taken' or 'late' THEN BREAK
     streak++
     expectedDate = current date - 1 day
5. RETURN streak
```

**Edge Cases:**
- No dose logs: streak = 0
- As-needed medication: streak = 0 (no scheduled doses to streak against)
- Streak broken by a single missed dose: Streak resets to 0 from that day forward

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No dose logs exist | "Start logging doses to see adherence stats" | User logs doses via Today screen |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** "Lisinopril" has 27 taken, 2 late, and 1 skipped dose log in the last 30 days,
   **When** the adherence stats are calculated,
   **Then** rate = 96.7% (29/30), totalTaken=27, totalLate=2, totalMissed=1.

2. **Given** the user has taken all doses for the last 5 consecutive days,
   **When** the streak is calculated,
   **Then** streak = 5.

3. **Given** the user missed a dose yesterday but took all doses the 10 days before,
   **When** the streak is calculated,
   **Then** streak = 0 (broken by yesterday's miss).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates rate with taken and late | 8 taken, 2 late, 0 skipped | rate = 100.0 |
| includes late as adherent | 5 taken, 3 late, 2 skipped | rate = 80.0 |
| excludes snoozed from calculation | 5 taken, 2 snoozed | total = 5, rate based on 5 |
| streak counts consecutive days | 5 consecutive all-taken days | streak = 5 |
| streak breaks on missed day | 3 taken days, 1 missed, 5 taken | streak = 3 (from most recent) |
| as_needed returns streak 0 | frequency: as_needed | streak = 0 |

---

### MD-012: As-Needed (PRN) Medication Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-012 |
| **Feature Name** | As-Needed (PRN) Medication Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Migraine Sufferer, I want to log when I take an as-needed medication like Sumatriptan, so that I can track usage frequency and identify patterns in my PRN medication use.

#### 3.3 Detailed Description

As-Needed (PRN) medications do not have a fixed schedule. Instead of scheduled reminders, PRN medications provide a "Take Now" button that logs a dose with the current timestamp. The system tracks PRN usage frequency over time, displaying counts per day, week, and month to help users identify overuse patterns.

PRN medications do not generate reminders, do not contribute to adherence calculations, and have no streak tracking. They do participate in interaction checking, correlation analysis, and doctor reports.

Common PRN medications include pain relievers (ibuprofen, acetaminophen), rescue inhalers (albuterol), anti-anxiety medications (lorazepam), and migraine medications (sumatriptan).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - PRN is a frequency option

#### 3.5 User Interface Requirements

##### Screen: Medication Detail (PRN variant)

**Layout:**
- Same as standard Medication Detail but with key differences:
  - No "Schedule" section (no reminders)
  - Prominent "Take Now" button at the top
  - "Usage Frequency" section showing: doses today, this week, this month, all time
  - "Usage History" list showing recent PRN doses with timestamps
- No adherence stats or streak display

#### 3.6 Data Requirements

Uses existing Medication and DoseLog entities. PRN medications have `frequency = 'as_needed'` and dose logs have `scheduledTime` set to the actual time of use (since there is no separate schedule).

#### 3.7 Business Logic Rules

##### PRN Usage Tracking

**Purpose:** Track usage frequency for as-needed medications.

**Logic:**
```
1. PRN medications have frequency = 'as_needed'
2. No automatic reminders are generated (see MD-002 scheduler logic)
3. Dose logs are created manually via "Take Now" with scheduledTime = actualTime = now
4. Usage counts are calculated by querying dose_logs grouped by time period:
     today = COUNT WHERE date = today
     thisWeek = COUNT WHERE date >= start of current week
     thisMonth = COUNT WHERE date >= start of current month
     allTime = COUNT all
5. Burn rate = 0 (no calculable supply depletion rate)
6. Adherence rate is not calculated for PRN medications
7. Streak = 0 for PRN medications
```

**Edge Cases:**
- PRN medication with pill count: Pills are still decremented on "Take Now"
- PRN medication in correlation analysis: Start date is used for before/after analysis just like scheduled medications

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Take Now fails | Toast: "Could not log dose. Please try again." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has "Ibuprofen" as an as-needed medication,
   **When** they tap "Take Now" at 14:30,
   **Then** a dose log is created with scheduledTime and actualTime both set to 14:30, status "taken".

2. **Given** the user has taken Ibuprofen 3 times today,
   **When** they view the medication detail,
   **Then** "Today: 3 doses" is displayed in the Usage Frequency section.

**Negative Tests:**

3. **Given** a medication has frequency "as_needed",
   **When** the reminder scheduler runs,
   **Then** no reminders are created for this medication.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| no reminders for as_needed | frequency: as_needed | 0 reminders created |
| burn rate is 0 for as_needed | frequency: as_needed | burnRate = 0 |
| streak is 0 for as_needed | frequency: as_needed | streak = 0 |
| take now sets both times | "Take Now" at 14:30 | scheduledTime = actualTime = 14:30 |
| pill count decrements on take now | pillCount: 10, take now | pillCount = 9 |

---

### MD-013: Medication History Timeline

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-013 |
| **Feature Name** | Medication History Timeline |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want to see a chronological timeline of all medication events (starts, stops, dose changes, refills), so that I have a complete medication history at a glance.

#### 3.3 Detailed Description

The Medication History Timeline provides a reverse-chronological view of all medication lifecycle events. Events include: medication started (createdAt), medication stopped (endDate reached or manually deactivated), dosage changed (from update logs), refill recorded, and frequency changed. Each event shows the date, medication name, event type, and relevant details.

This timeline gives users a comprehensive longitudinal view of their medication journey, useful for doctor appointments and personal reference.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - medication records
- MD-003: Dose Logging - dose history

#### 3.5 User Interface Requirements

##### Screen: History (Tab 3) - Timeline Section

**Layout:**
- Vertical timeline with date markers on the left
- Each event is a card showing: event icon (pill icon for start/stop, refresh icon for refill, edit icon for change), medication name, event type label, details (e.g., "Started 10mg daily", "Refill: 90 pills from CVS"), and date
- Filter options: All events, Starts/Stops only, Refills only
- Search by medication name

#### 3.6 Data Requirements

No new entities. Constructed from queries against `md_medications` (createdAt, endDate, isActive), `md_refills` (refill events), and `md_dose_logs` (first/last dose dates).

#### 3.7 Business Logic Rules

##### Timeline Event Construction

**Purpose:** Build a chronological event list from multiple data sources.

**Logic:**
```
1. FOR EACH medication:
     ADD event: { type: 'started', date: createdAt, med: name, detail: dosage + frequency }
     IF endDate IS NOT NULL OR isActive = false:
       ADD event: { type: 'stopped', date: endDate or updatedAt, med: name }
2. FOR EACH refill:
     ADD event: { type: 'refill', date: refillDate, med: medication.name, detail: quantity + pharmacy }
3. SORT all events by date descending
4. RETURN timeline events
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No medication history | "No medication events yet. Add a medication to start your timeline." | User adds a medication |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 3 medications started on different dates and 2 refills,
   **When** they view the timeline,
   **Then** 5 events appear in reverse chronological order with correct types and details.

2. **Given** a medication "Amoxicillin" was started on March 1 and stopped on March 10,
   **When** the timeline is viewed,
   **Then** two events appear: "Amoxicillin started" (March 1) and "Amoxicillin stopped" (March 10).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| includes start events | 3 medications | 3 'started' events |
| includes stop events | 1 medication with endDate | 1 'stopped' event |
| includes refill events | 2 refills | 2 'refill' events |
| sorts by date descending | mixed events | Most recent first |

---

### MD-014: Blood Pressure Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-014 |
| **Feature Name** | Blood Pressure Logging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Tracker with hypertension, I want to log my blood pressure readings with automatic AHA classification, so that I can track whether my BP is in a healthy range over time.

**Secondary:**
> As a Caregiver, I want to log my parent's blood pressure readings and see at a glance whether they are in a danger zone, so that I can alert their doctor if readings are consistently elevated.

#### 3.3 Detailed Description

Blood Pressure Logging extends the generic Health Measurements feature (MD-008) with a purpose-built BP entry form. Users enter systolic pressure (top number), diastolic pressure (bottom number), and pulse rate. The system automatically classifies the reading according to the American Heart Association (AHA) guidelines and displays the classification with color-coded severity.

Readings can be tagged with context: time of day (morning/afternoon/evening), arm used (left/right), body position (sitting/standing/lying), and whether the user was at rest. These contextual tags help doctors evaluate readings more accurately, since BP varies based on these factors.

This feature directly replaces Blood Pressure Monitor ($13/yr) and covers BP functionality that Medisafe ($40/yr) charges for.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-008: Health Measurements - underlying measurement storage system

**External Dependencies:**
- Local SQLite database

#### 3.5 User Interface Requirements

##### Screen: Log Blood Pressure

**Layout:**
- Three large number inputs arranged horizontally:
  - Systolic (top number, range 60-250)
  - "/" divider
  - Diastolic (bottom number, range 40-150)
  - Pulse (beats per minute, range 30-220)
- Below inputs: AHA Classification badge (auto-updates as user types):
  - Green: "Normal"
  - Yellow: "Elevated"
  - Orange: "High Blood Pressure Stage 1"
  - Red: "High Blood Pressure Stage 2"
  - Dark Red with pulse icon: "Hypertensive Crisis - Seek Emergency Care"
- Context tags (optional):
  - Time of day: Morning / Afternoon / Evening (auto-selected based on clock)
  - Arm: Left / Right
  - Position: Sitting / Standing / Lying
  - At rest: Yes / No
- Notes field (optional)
- "Save" button
- Below form: Most recent 5 BP readings with AHA classification badges

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Form is empty | Input fields with placeholder text, no AHA badge visible |
| Classifying | User has entered systolic and diastolic | AHA classification badge appears and updates in real-time |
| Crisis | Reading exceeds 180/120 | Dark red badge with message "Hypertensive Crisis - Contact your doctor or call 911 if you have symptoms" |
| Saved | Reading saved successfully | Brief success animation, form clears, reading appears in recent list |

#### 3.6 Data Requirements

Uses the existing HealthMeasurement entity (MD-008) with type="blood_pressure". The `value` field stores the compound format "systolic/diastolic/pulse" (e.g., "120/80/72"). Additional context is stored in a structured JSON notes field or as separate metadata columns in a future schema version.

##### BP-Specific Value Format

| Field | Location | Format | Example |
|-------|----------|--------|---------|
| Systolic | value (part 1 of "/") | integer | 120 |
| Diastolic | value (part 2 of "/") | integer | 80 |
| Pulse | value (part 3 of "/") | integer | 72 |
| Context | notes (JSON) | `{"timeOfDay":"morning","arm":"left","position":"sitting","atRest":true}` | - |

#### 3.7 Business Logic Rules

##### AHA Blood Pressure Classification

**Purpose:** Classify a blood pressure reading according to American Heart Association guidelines.

**Inputs:**
- systolic: integer (mmHg)
- diastolic: integer (mmHg)

**Logic:**
```
1. IF systolic > 180 OR diastolic > 120 THEN
     classification = 'crisis'
     label = 'Hypertensive Crisis'
     color = '#8B0000' (dark red)
     urgent = true

2. ELSE IF systolic >= 140 OR diastolic >= 90 THEN
     classification = 'stage2'
     label = 'High Blood Pressure Stage 2'
     color = '#D32F2F' (red)

3. ELSE IF systolic >= 130 OR diastolic >= 80 THEN
     classification = 'stage1'
     label = 'High Blood Pressure Stage 1'
     color = '#F57C00' (orange)

4. ELSE IF systolic >= 120 AND diastolic < 80 THEN
     classification = 'elevated'
     label = 'Elevated'
     color = '#FFC107' (yellow)

5. ELSE IF systolic < 120 AND diastolic < 80 THEN
     classification = 'normal'
     label = 'Normal'
     color = '#4CAF50' (green)
```

**AHA Thresholds (exact):**

| Classification | Systolic (mmHg) | Diastolic (mmHg) |
|---------------|----------------|-----------------|
| Normal | < 120 | AND < 80 |
| Elevated | 120-129 | AND < 80 |
| Stage 1 Hypertension | 130-139 | OR 80-89 |
| Stage 2 Hypertension | >= 140 | OR >= 90 |
| Hypertensive Crisis | > 180 | OR > 120 |

**Important:** When systolic and diastolic fall into different categories, the HIGHER (more severe) classification applies. For example, systolic 135 (Stage 1) with diastolic 92 (Stage 2) = Stage 2.

**Edge Cases:**
- Systolic 120, diastolic 79: Elevated (systolic is exactly 120, diastolic is < 80)
- Systolic 119, diastolic 79: Normal (both below thresholds)
- Systolic 130, diastolic 75: Stage 1 (systolic qualifies even though diastolic is normal)
- Systolic 180, diastolic 119: Stage 2 (systolic is exactly 180, not > 180, so not crisis; diastolic 119 is not > 120)
- Systolic 181, diastolic 80: Crisis (systolic > 180)

##### BP Value Parsing

**Purpose:** Parse compound BP value string into components.

**Logic:**
```
1. SPLIT value by "/" -> parts
2. systolic = parseInt(parts[0])
3. diastolic = parseInt(parts[1])
4. pulse = parts.length > 2 ? parseInt(parts[2]) : null
5. VALIDATE: systolic in [60, 250], diastolic in [40, 150], pulse in [30, 220] if present
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Systolic or diastolic out of range | Inline validation: "Systolic must be between 60 and 250" | User corrects input |
| Systolic < diastolic | Inline validation: "Systolic must be higher than diastolic" | User corrects input |
| Crisis reading detected | Prominent red banner: "HYPERTENSIVE CRISIS - If you are experiencing symptoms (severe headache, chest pain, difficulty breathing), call 911 immediately." | User acknowledges and saves or seeks care |

**Validation Timing:**
- AHA classification updates in real-time as user types
- Range validation on blur
- Cross-field validation (systolic > diastolic) on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enters systolic=120, diastolic=80, pulse=72,
   **When** the AHA classification is computed,
   **Then** the badge shows "Elevated" in yellow (systolic is exactly 120, diastolic < 80 qualifies as elevated).

2. **Given** the user enters systolic=115, diastolic=75,
   **When** the classification is computed,
   **Then** the badge shows "Normal" in green.

3. **Given** the user enters systolic=185, diastolic=110,
   **When** the classification is computed,
   **Then** the badge shows "Hypertensive Crisis" in dark red with an urgent care message.

**Edge Cases:**

4. **Given** systolic=130, diastolic=75 (mixed: systolic is Stage 1, diastolic is normal),
   **When** classified,
   **Then** the result is "High Blood Pressure Stage 1" (higher category wins).

5. **Given** systolic=118, diastolic=82 (systolic normal, diastolic Stage 1),
   **When** classified,
   **Then** the result is "High Blood Pressure Stage 1" (diastolic qualifies independently).

**Negative Tests:**

6. **Given** the user enters systolic=50 (below minimum 60),
   **When** validation runs,
   **Then** inline error: "Systolic must be between 60 and 250."

7. **Given** systolic=110, diastolic=120 (systolic < diastolic),
   **When** validation runs on save,
   **Then** error: "Systolic must be higher than diastolic."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| classifies normal BP | 115/75 | classification = 'normal' |
| classifies elevated BP | 125/78 | classification = 'elevated' |
| classifies stage 1 | 135/85 | classification = 'stage1' |
| classifies stage 2 | 145/95 | classification = 'stage2' |
| classifies crisis | 185/125 | classification = 'crisis', urgent = true |
| higher category wins (systolic) | 135/75 | classification = 'stage1' |
| higher category wins (diastolic) | 118/85 | classification = 'stage1' |
| exact boundary: 120/79 | 120/79 | classification = 'elevated' |
| exact boundary: 119/79 | 119/79 | classification = 'normal' |
| exact boundary: 180/120 | 180/120 | classification = 'stage2' (not crisis: must be > 180 or > 120) |
| exact boundary: 181/120 | 181/120 | classification = 'crisis' |
| parses compound value | "120/80/72" | systolic=120, diastolic=80, pulse=72 |
| parses without pulse | "120/80" | systolic=120, diastolic=80, pulse=null |
| rejects systolic below range | systolic=50 | validation error |
| rejects systolic > diastolic | 80/120 | validation error |

---

### MD-015: BP Trend Visualization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-015 |
| **Feature Name** | BP Trend Visualization |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Tracker, I want to see charts of my blood pressure over time with AHA danger zone bands, so that I can visually track whether my BP is improving or worsening.

#### 3.3 Detailed Description

BP Trend Visualization presents blood pressure data as time-series line charts with AHA classification zones rendered as colored horizontal bands in the background. Two lines are drawn: one for systolic (top number) and one for diastolic (bottom number). The background bands provide instant visual context for whether readings fall in normal, elevated, stage 1, stage 2, or crisis ranges.

Users can select time windows of 7, 30, 90, or 365 days. The chart also supports viewing averages for the selected period and highlighting readings that fall outside the user's target range (configurable, defaults to < 130/80 per current AHA guidelines).

Medication start/stop markers from MD-008 are overlaid as vertical dashed lines so users can correlate BP changes with medication changes.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-014: Blood Pressure Logging - BP data source

#### 3.5 User Interface Requirements

##### Screen: BP Trends (accessed from measurement trends or dedicated section)

**Layout:**
- Time range selector: 7d / 30d / 90d / 365d
- Line chart with:
  - Y-axis: mmHg (range 40-220)
  - X-axis: dates
  - Red/darker line for systolic values
  - Blue/lighter line for diastolic values
  - Background bands:
    - Green band: 0-119 systolic (Normal zone)
    - Yellow band: 120-129 systolic (Elevated zone)
    - Orange band: 130-139 systolic (Stage 1 zone)
    - Red band: 140+ systolic (Stage 2+ zone)
  - Vertical dashed lines for medication start/stop events
- Below chart: Summary statistics card:
  - Average systolic / diastolic for the period
  - Highest and lowest readings
  - Number of readings in each AHA category
  - Trend indicator (arrow up/down/stable compared to previous period)

#### 3.6 Data Requirements

No new entities. Reads from `md_measurements` WHERE type = 'blood_pressure'.

#### 3.7 Business Logic Rules

##### BP Average Calculation

**Purpose:** Calculate average systolic and diastolic values over a time period.

**Logic:**
```
1. QUERY all BP measurements in the date range
2. PARSE each value: "systolic/diastolic/pulse"
3. avgSystolic = mean(all systolic values)
4. avgDiastolic = mean(all diastolic values)
5. CLASSIFY the average using AHA thresholds
6. RETURN { avgSystolic, avgDiastolic, classification, readingCount }
```

##### Trend Direction Calculation

**Purpose:** Determine if BP is trending up, down, or stable.

**Logic:**
```
1. Divide the period into two halves: first half and second half
2. Calculate average systolic for each half
3. IF second half avg - first half avg > 5 THEN trend = 'increasing'
4. IF first half avg - second half avg > 5 THEN trend = 'decreasing'
5. ELSE trend = 'stable'
6. Apply same logic to diastolic
```

**Edge Cases:**
- Fewer than 2 readings: Trend = 'insufficient data'
- All readings in one half: Use available data only

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No BP readings in range | "No blood pressure readings for this period. Log a reading to see trends." | User logs a reading |
| Single reading only | Chart shows a single point; trend shows "Insufficient data for trend analysis" | User logs more readings |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** 15 BP readings over 30 days with an average of 128/82,
   **When** the 30-day chart is viewed,
   **Then** two lines are visible with the average summary showing "128/82 - Stage 1" and all AHA bands visible.

2. **Given** a medication "Lisinopril" was started on day 10 of a 30-day period,
   **When** the chart is viewed,
   **Then** a vertical dashed line appears at day 10 labeled "Lisinopril started."

**Edge Cases:**

3. **Given** the first 15 days average 145 systolic and the last 15 days average 130 systolic,
   **When** the trend is calculated,
   **Then** trend = "decreasing" (15-point drop > 5 threshold).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates average BP | readings: [120/80, 130/85, 125/82] | avg systolic = 125, avg diastolic = 82.3 |
| detects increasing trend | first half avg 120, second half avg 130 | trend = 'increasing' |
| detects decreasing trend | first half avg 140, second half avg 125 | trend = 'decreasing' |
| detects stable trend | first half avg 122, second half avg 124 | trend = 'stable' (diff = 2, < 5) |

---

### MD-016: Blood Glucose Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-016 |
| **Feature Name** | Blood Glucose Logging |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Tracker with diabetes, I want to log my blood glucose readings with meal context, so that I can track my blood sugar management and share data with my endocrinologist.

#### 3.3 Detailed Description

Blood Glucose Logging provides a purpose-built glucose entry form that extends the generic measurement system (MD-008). Users enter a glucose value in either mg/dL (US standard) or mmol/L (international standard), with automatic conversion between the two. Each reading is tagged with a meal context (fasting, before meal, after meal, bedtime, or other) since glucose targets vary by context.

The system displays readings with color-coded ranges based on the ADA (American Diabetes Association) targets for each context. This directly replaces Glucose Buddy ($40/yr) and MySugr ($36/yr).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-008: Health Measurements - underlying measurement storage

#### 3.5 User Interface Requirements

##### Screen: Log Blood Glucose

**Layout:**
- Large number input for glucose value
- Unit toggle: mg/dL | mmol/L (persists user's preference)
- Meal context picker: Fasting / Before Meal / After Meal (1-2 hrs) / Bedtime / Other
- Range indicator badge (auto-updates):
  - Green: In target range
  - Yellow: Slightly above/below target
  - Red: Significantly above/below target
- Notes field (optional)
- Date/time picker (defaults to now)
- "Save" button

#### 3.6 Data Requirements

Uses HealthMeasurement entity with type="blood_sugar". The value field stores the numeric glucose reading, and the unit field stores "mg/dL" or "mmol/L". Meal context is stored in the notes field as a structured prefix: "[fasting] 95" or "[after_meal] 140".

#### 3.7 Business Logic Rules

##### Glucose Unit Conversion

**Purpose:** Convert between mg/dL and mmol/L.

**Formulas:**
- `mmol/L = mg/dL / 18.0182`
- `mg/dL = mmol/L * 18.0182`

##### ADA Target Ranges (mg/dL)

| Context | In Target (Green) | Above Target (Yellow) | High (Red) | Low (Red) |
|---------|-------------------|----------------------|-----------|----------|
| Fasting | 70-100 | 101-125 | > 125 | < 70 |
| Before Meal | 70-130 | 131-160 | > 160 | < 70 |
| After Meal (1-2 hrs) | 70-180 | 181-200 | > 200 | < 70 |
| Bedtime | 90-150 | 151-180 | > 180 | < 90 |
| Other | 70-140 | 141-180 | > 180 | < 70 |

**Hypoglycemia threshold:** < 70 mg/dL (< 3.9 mmol/L) - always red regardless of context
**Severe hypoglycemia:** < 54 mg/dL (< 3.0 mmol/L) - red with urgent alert

**Edge Cases:**
- User switches unit after entry: Value is converted, not re-entered
- Value of 0: Rejected as invalid
- Extremely high values (> 500 mg/dL): Accepted but flagged with "Seek medical attention"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Value out of plausible range (< 20 or > 600 mg/dL) | Inline warning: "This reading seems unusual. Please verify." | User confirms or corrects |
| Severe hypoglycemia (< 54 mg/dL) | Alert: "Low blood sugar detected. If you feel unwell, consume fast-acting glucose and seek help." | User acknowledges |
| No meal context selected | Default to "Other" - no error | Auto-default applied |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enters glucose=95, context=Fasting,
   **When** saved,
   **Then** a measurement is created with type="blood_sugar", value="95", unit="mg/dL", and the range badge shows green "In Target."

2. **Given** the user enters glucose=210, context=After Meal,
   **When** the range is calculated,
   **Then** the badge shows red "High" (210 > 200 for after-meal target).

3. **Given** the user toggles unit from mg/dL to mmol/L after entering 180,
   **When** the conversion runs,
   **Then** the display shows 10.0 mmol/L (180 / 18.0182).

**Edge Cases:**

4. **Given** glucose=65 (below 70),
   **When** range is calculated for any context,
   **Then** badge shows red "Low" (hypoglycemia).

5. **Given** glucose=50 (severe hypoglycemia),
   **When** saved,
   **Then** an urgent alert is displayed advising consumption of fast-acting glucose.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts mg/dL to mmol/L | 180 mg/dL | 9.99 mmol/L |
| converts mmol/L to mg/dL | 10.0 mmol/L | 180.18 mg/dL |
| classifies fasting in-target | 95, fasting | 'in_target' |
| classifies fasting above target | 110, fasting | 'above_target' |
| classifies fasting high | 130, fasting | 'high' |
| classifies hypoglycemia | 65, any context | 'low' |
| classifies after-meal in-target | 150, after_meal | 'in_target' |
| classifies after-meal high | 210, after_meal | 'high' |
| rejects value of 0 | 0 | validation error |

---

### MD-017: Insulin Dose Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-017 |
| **Feature Name** | Insulin Dose Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Tracker with Type 1 diabetes, I want to log my insulin injections with type, dose, and injection site, so that I can track my insulin usage and rotate injection sites properly.

#### 3.3 Detailed Description

Insulin Dose Tracking provides specialized logging for insulin injections, extending the medication system with insulin-specific fields. Users log each injection with the insulin type (rapid-acting, long-acting, mixed/premixed), dose in units, and injection site from a body map. The system tracks injection site rotation to prevent lipodystrophy (fat tissue damage from repeated injections at the same site).

Injection sites are visualized on a simplified body diagram showing abdomen (4 quadrants), thighs (left/right, upper/lower), upper arms (left/right), and buttocks (left/right). Each site shows how many days since last used, with color coding: green (> 3 days, safe to use), yellow (2-3 days), red (< 2 days, recently used).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - insulin is a medication
- MD-016: Blood Glucose Logging - insulin doses pair with glucose readings

#### 3.5 User Interface Requirements

##### Screen: Log Insulin Dose

**Layout:**
- Insulin type selector: Rapid-Acting / Long-Acting / Mixed
- Dose input (numeric, units, range 0.5-300, step 0.5)
- Body map diagram showing injection sites with recency indicators
- Tapping a site on the body map selects it and shows "Last used: X days ago"
- Notes field (optional)
- Date/time picker
- "Save" button

##### Injection Site Body Map

**Layout:**
- Front-facing body outline with 12 tappable zones:
  - Abdomen: Upper-Left, Upper-Right, Lower-Left, Lower-Right
  - Thighs: Left-Upper, Left-Lower, Right-Upper, Right-Lower
  - Upper Arms: Left, Right
  - Buttocks: Left, Right
- Each zone is color-coded by recency

#### 3.6 Data Requirements

##### Entity: InsulinDose (stored as medication dose log with extended metadata)

Insulin doses are stored in `md_dose_logs` with additional metadata in the notes field (JSON):
```json
{
  "insulinType": "rapid",
  "doseUnits": 8.5,
  "injectionSite": "abdomen_upper_left",
  "relatedGlucoseId": "meas-xyz123"
}
```

##### Injection Site Enum

```
abdomen_upper_left, abdomen_upper_right, abdomen_lower_left, abdomen_lower_right,
thigh_left_upper, thigh_left_lower, thigh_right_upper, thigh_right_lower,
arm_left, arm_right,
buttock_left, buttock_right
```

#### 3.7 Business Logic Rules

##### Injection Site Rotation Tracking

**Purpose:** Track when each injection site was last used and warn about sites used too frequently.

**Logic:**
```
1. FOR EACH of the 12 injection sites:
     Query most recent insulin dose log with that site
     Calculate daysSinceUsed = today - lastUsedDate
     IF daysSinceUsed IS NULL (never used) THEN status = 'available', color = green
     ELSE IF daysSinceUsed >= 3 THEN status = 'available', color = green
     ELSE IF daysSinceUsed >= 2 THEN status = 'recent', color = yellow
     ELSE status = 'too_soon', color = red
2. RETURN map of site -> { lastUsed, daysSinceUsed, status, color }
```

**Clinical guidance:** Rotate injection sites to prevent lipodystrophy. Minimum recommended gap between uses of the same site: 2-3 days.

##### Insulin Type Classification

| Type | Examples | Onset | Duration | Typical Timing |
|------|---------|-------|----------|---------------|
| Rapid-Acting | Humalog, NovoLog, Apidra | 10-30 min | 3-5 hours | Before meals |
| Long-Acting | Lantus, Levemir, Tresiba | 1-2 hours | 20-24+ hours | Once or twice daily |
| Mixed/Premixed | Humalog Mix, NovoLog Mix | 10-30 min | 14-24 hours | Before meals |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Dose out of range (< 0.5 or > 300) | Inline validation: "Dose must be between 0.5 and 300 units" | User corrects |
| Site used within 24 hours | Warning: "This site was used [X] hours ago. Consider rotating to another site." | User can proceed or choose different site |
| No injection site selected | Default to null (site tracking is optional) | No error, but site rotation insights are limited |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects insulin type "Rapid-Acting", enters dose 8 units, and taps "Abdomen Upper-Left",
   **When** they save,
   **Then** a dose log is created with insulin metadata and the site rotation map updates.

2. **Given** "Abdomen Upper-Left" was last used 4 days ago,
   **When** the body map is rendered,
   **Then** that zone is green with label "4 days ago".

3. **Given** "Thigh Left-Upper" was used yesterday,
   **When** the body map is rendered,
   **Then** that zone is red with label "1 day ago" and a rotation warning.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| site available after 3 days | lastUsed: 3 days ago | status = 'available', color = green |
| site recent at 2 days | lastUsed: 2 days ago | status = 'recent', color = yellow |
| site too soon at 1 day | lastUsed: 1 day ago | status = 'too_soon', color = red |
| never-used site is available | lastUsed: null | status = 'available', color = green |
| dose range validation | dose: 0.3 | validation error |
| dose step validation | dose: 8.5 | valid (0.5 increments) |

---

### MD-018: CGM Integration via HealthKit

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-018 |
| **Feature Name** | CGM Integration via HealthKit |
| **Priority** | P2 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Tracker wearing a Dexcom or Libre CGM, I want my continuous glucose data to automatically import from HealthKit, so that I do not need to manually enter every reading.

#### 3.3 Detailed Description

CGM (Continuous Glucose Monitor) Integration reads glucose data from Apple HealthKit on iOS. Devices like Dexcom G6/G7 and FreeStyle Libre 2/3 write glucose readings to HealthKit every 5 minutes. This feature periodically reads new HealthKit glucose samples and imports them as blood_sugar measurements in MyMeds.

The integration requires explicit user permission to read HealthKit glucose data. No data is written to HealthKit. The import runs in the background when the app is open and can also be triggered manually. Duplicate detection prevents re-importing readings that have already been stored.

This feature is iOS-only. On Android, the glucose logging screen (MD-016) is the only input method, and the CGM integration option is hidden.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-016: Blood Glucose Logging - glucose storage format

**External Dependencies:**
- Apple HealthKit framework (iOS only)
- User grants HealthKit read permission for blood glucose
- CGM device (Dexcom, Libre) writing data to HealthKit

#### 3.5 User Interface Requirements

##### Screen: Settings - CGM Integration

**Layout:**
- "Connect to HealthKit" toggle (triggers HealthKit permission dialog on first enable)
- Status indicator: Connected / Disconnected / Permission Denied
- "Last synced: [timestamp]" display
- "Sync Now" manual trigger button
- Import log: "X readings imported in last sync"
- Platform note: "Available on iOS only. Requires a CGM that writes to Apple Health."

#### 3.6 Data Requirements

CGM readings are stored as `md_measurements` with type="blood_sugar" and a special source marker in notes: `[cgm_import] [timestamp]`. A deduplication key uses the HealthKit sample UUID to prevent duplicate imports.

#### 3.7 Business Logic Rules

##### HealthKit Import Algorithm

**Purpose:** Import new glucose readings from HealthKit without duplicates.

**Logic:**
```
1. Query HealthKit for HKQuantityType.bloodGlucose samples since lastSyncTimestamp
2. FOR EACH sample:
     Check if a measurement with source = sample.uuid already exists
     IF NOT exists:
       Convert value to mg/dL if needed
       Create measurement { type: 'blood_sugar', value, unit: 'mg/dL', measuredAt: sample.startDate }
       Store sample.uuid in notes for deduplication
3. Update lastSyncTimestamp to now
4. RETURN count of newly imported readings
```

**Edge Cases:**
- HealthKit permission revoked: Show "Permission Denied" status; do not crash
- No CGM data in HealthKit: "No glucose data found in Apple Health"
- Large backfill (first sync with months of data): Import in batches of 500 to avoid memory pressure; show progress indicator

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| HealthKit permission denied | Status: "Permission Denied. Open Settings to grant access." | User grants permission in iOS Settings |
| HealthKit unavailable (Android) | CGM section hidden entirely | User logs glucose manually |
| Sync fails mid-import | "Sync interrupted. [X] readings imported before error." | User taps Sync Now to retry |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enables HealthKit integration and has 100 glucose readings in HealthKit from the last 24 hours,
   **When** the first sync runs,
   **Then** 100 measurements are imported with type="blood_sugar" and deduplication keys stored.

2. **Given** the same 100 readings exist and the user taps "Sync Now",
   **When** the sync runs,
   **Then** 0 new readings are imported (all already exist, deduplicated by UUID).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| imports new readings | 10 HealthKit samples, 0 existing | 10 new measurements created |
| deduplicates existing | 10 samples, 10 already imported | 0 new measurements |
| partial dedup | 10 samples, 5 already imported | 5 new measurements |
| converts mmol/L to mg/dL | 10.0 mmol/L sample | value = "180" (mg/dL) |

---

### MD-019: HbA1c Estimator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-019 |
| **Feature Name** | HbA1c Estimator |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Tracker with diabetes, I want the app to estimate my HbA1c from my logged glucose readings, so that I can track my glycemic control between lab tests.

#### 3.3 Detailed Description

The HbA1c Estimator calculates an estimated A1c percentage from the user's logged blood glucose readings using the established eAG (estimated Average Glucose) formula published by the ADA. This gives users a between-lab-visit estimate of their glycemic control.

The estimator requires a minimum of 14 days of glucose data with at least 30 readings to provide a meaningful estimate. Fewer readings produce a low-confidence estimate with a warning.

The estimate is displayed alongside the user's most recent lab-reported A1c (if entered) for comparison.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-016: Blood Glucose Logging - glucose data source

#### 3.5 User Interface Requirements

##### Screen: Glucose Dashboard (HbA1c Section)

**Layout:**
- Large circular gauge showing estimated A1c percentage
- Color-coded: Green (< 5.7%), Yellow (5.7-6.4%, prediabetes range), Red (>= 6.5%, diabetes range)
- Below gauge: "Based on X readings over Y days"
- Confidence indicator: High (>= 90 readings over >= 60 days), Medium (>= 30 readings over >= 14 days), Low (< 30 readings or < 14 days)
- "Lab A1c" entry: User can enter their most recent lab result for comparison
- Delta display: Estimated vs. lab difference

#### 3.6 Data Requirements

No new entities. Calculated from existing `md_measurements` WHERE type = 'blood_sugar'.

User's lab A1c is stored in `md_settings` with key `lastLabA1c` and value as JSON: `{"value": 6.5, "date": "2026-01-15"}`.

#### 3.7 Business Logic Rules

##### eAG to HbA1c Conversion Formula

**Purpose:** Estimate HbA1c from average glucose readings.

**Formulas (ADA-published):**
- `eAG (mg/dL) = 28.7 * A1c - 46.7`
- `A1c = (eAG + 46.7) / 28.7`

Where eAG = mean of all glucose readings in the calculation period.

**Logic:**
```
1. QUERY all blood_sugar measurements from the last 90 days (or configurable period)
2. IF fewer than 30 readings THEN
     Mark confidence = 'low'
     Show warning: "More readings needed for accurate estimate"
3. Calculate eAG = mean(all glucose values in mg/dL)
4. Calculate estimatedA1c = (eAG + 46.7) / 28.7
5. Round to 1 decimal place
6. RETURN { estimatedA1c, eAG, readingCount, daysCovered, confidence }
```

**Confidence Levels:**

| Level | Criteria | Display |
|-------|---------|---------|
| High | >= 90 readings over >= 60 days | "High confidence estimate" |
| Medium | >= 30 readings over >= 14 days | "Moderate confidence - more readings improve accuracy" |
| Low | < 30 readings or < 14 days | "Low confidence - log more glucose readings" |

**A1c Classification:**

| A1c Range | Classification | Color |
|-----------|---------------|-------|
| < 5.7% | Normal | Green |
| 5.7 - 6.4% | Prediabetes | Yellow |
| >= 6.5% | Diabetes | Red |

**Edge Cases:**
- No glucose readings: Show "No data available. Log blood glucose readings to estimate A1c."
- All readings from a single day: daysCovered = 1, confidence = 'low'
- Extremely high eAG (> 400 mg/dL): Estimated A1c > 15%; display with caution note

##### Conversion Examples

| eAG (mg/dL) | Estimated A1c |
|-------------|--------------|
| 97 | 5.0% |
| 126 | 6.0% |
| 154 | 7.0% |
| 183 | 8.0% |
| 212 | 9.0% |
| 240 | 10.0% |

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient data | "Log at least 30 glucose readings over 14+ days for a meaningful estimate" | User logs more readings |
| Values in mmol/L mixed with mg/dL | All values are converted to mg/dL before averaging | Automatic conversion |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** 60 glucose readings over 30 days with mean=154 mg/dL,
   **When** the HbA1c estimate is calculated,
   **Then** estimatedA1c = (154 + 46.7) / 28.7 = 7.0%, confidence = "Medium."

2. **Given** the user enters lab A1c = 7.2% and estimated is 7.0%,
   **When** displayed,
   **Then** the delta shows "-0.2% difference from lab."

**Edge Cases:**

3. **Given** only 10 readings over 5 days,
   **When** estimated,
   **Then** confidence = "Low" with warning message.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates A1c from eAG 154 | eAG = 154 | A1c = 7.0 |
| calculates A1c from eAG 126 | eAG = 126 | A1c = 6.0 |
| calculates A1c from eAG 97 | eAG = 97 | A1c = 5.0 |
| reverse: eAG from A1c 7.0 | A1c = 7.0 | eAG = 154.2 |
| high confidence threshold | 100 readings, 70 days | confidence = 'high' |
| medium confidence threshold | 40 readings, 20 days | confidence = 'medium' |
| low confidence threshold | 15 readings, 10 days | confidence = 'low' |

---

### MD-020: Pain Location Mapping

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-020 |
| **Feature Name** | Pain Location Mapping |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Migraine Sufferer, I want to tap on a body/head diagram to mark where I feel pain and set intensity, so that I can show my neurologist exactly where and how severely I experience pain.

**Secondary:**
> As a Daily Med Manager with chronic pain, I want to track pain locations over time, so that I can see whether new medications reduce pain in specific areas.

#### 3.3 Detailed Description

Pain Location Mapping provides an interactive body and head outline that users tap to mark pain points. Each marked location has an associated severity (1-10 scale) and pain type (sharp, dull, throbbing, burning, stabbing, aching, tingling, pressure). Multiple pain points can be logged simultaneously to capture complex pain patterns.

The feature includes two views: a full body outline (front and back) for general pain tracking, and a detailed head diagram for migraine-specific tracking showing regions (forehead, temples left/right, crown, back of head, behind eyes left/right, jaw left/right, neck).

Pain entries are linked to symptom logs (MD-007) and participate in correlation analysis (MD-009) and doctor reports (MD-010).

This feature directly replaces the core differentiator of Migraine Buddy ($50/yr).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-007: Symptom Logging - pain entries link to symptom logs

#### 3.5 User Interface Requirements

##### Screen: Pain Map

**Layout:**
- Tab toggle: "Body" | "Head"
- Body view: Front-facing human outline with tappable regions:
  - Head, Neck, Left Shoulder, Right Shoulder, Chest, Upper Back,
    Left Arm, Right Arm, Abdomen, Lower Back, Left Hip, Right Hip,
    Left Thigh, Right Thigh, Left Knee, Right Knee, Left Shin, Right Shin,
    Left Foot, Right Foot (20 zones)
- Head view: Front-facing head outline with tappable regions:
  - Forehead, Left Temple, Right Temple, Crown, Back of Head,
    Behind Left Eye, Behind Right Eye, Left Jaw, Right Jaw, Neck (10 zones)
- Tapping a zone highlights it and opens a severity/type picker:
  - Severity slider: 1-10
  - Pain type: Sharp / Dull / Throbbing / Burning / Stabbing / Aching / Tingling / Pressure
- Multiple zones can be selected simultaneously
- "Save" button logs all selected zones as a single pain entry
- Below the map: Recent pain entries showing date, zones, and severity

#### 3.6 Data Requirements

##### Entity: PainEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| symptomLogId | string | Nullable, FK to SymptomLog.id | null | Link to symptom log if associated |
| zones | array of objects | JSON array, min 1 zone | None | Pain locations with severity and type |
| overallSeverity | integer | Min 1, max 10 | None | Overall pain severity across all zones |
| notes | string | Nullable, max 1000 chars | null | Free-form description |
| loggedAt | string | Required, ISO 8601 datetime | Current timestamp | When the pain was recorded |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

##### Pain Zone Object

```json
{
  "zone": "left_temple",
  "severity": 8,
  "painType": "throbbing"
}
```

**Table prefix:** `md_pain_entries` (new table in schema V3)

#### 3.7 Business Logic Rules

##### Pain Pattern Analysis

**Purpose:** Identify recurring pain locations and types over time.

**Logic:**
```
1. QUERY pain entries for the last 90 days
2. FOR EACH zone, count occurrences and average severity
3. Rank zones by frequency (most common first)
4. Identify dominant pain types per zone
5. RETURN { topZones: [{ zone, count, avgSeverity, dominantType }] }
```

**Edge Cases:**
- Single pain entry: Pattern analysis shows "Not enough data (need 3+ entries)"
- All entries in one zone: That zone shows 100% frequency
- No pain entries: "No pain data logged. Use the pain map to start tracking."

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No zones selected on save | "Select at least one pain location" | User taps a zone |
| Save fails | Toast: "Could not save pain entry. Please try again." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "Left Temple" on the head map and sets severity=8, type="throbbing",
   **When** they tap Save,
   **Then** a PainEntry is created with zones=[{zone: "left_temple", severity: 8, painType: "throbbing"}].

2. **Given** the user selects "Left Temple" (8, throbbing) and "Behind Left Eye" (6, pressure) simultaneously,
   **When** they tap Save,
   **Then** one PainEntry is created with 2 zones and overallSeverity set to the maximum (8).

3. **Given** 10 pain entries exist with "Left Temple" appearing in 8 of them,
   **When** the pain pattern analysis runs,
   **Then** "Left Temple" is ranked first with count=8 and its average severity.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates pain entry with single zone | 1 zone | PainEntry with 1 zone object |
| creates pain entry with multiple zones | 3 zones | PainEntry with 3 zone objects |
| overall severity is max of zones | zones: [3, 7, 5] | overallSeverity = 7 |
| pattern analysis ranks by frequency | 8 left_temple, 3 forehead, 1 crown | left_temple first |
| rejects zero zones | [] | validation error |

---

### MD-021: Weather-Barometric Pressure Correlation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-021 |
| **Feature Name** | Weather-Barometric Pressure Correlation |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Migraine Sufferer, I want the app to correlate my symptom logs with barometric pressure changes, so that I can understand whether weather is a trigger for my migraines.

#### 3.3 Detailed Description

Weather-Barometric Pressure Correlation fetches barometric pressure data from a weather API and overlays it on symptom timeline charts. Users with migraines, joint pain, or weather-sensitive conditions can see whether pressure drops or changes coincide with their symptom episodes.

This is the only feature in MyMeds that makes a network request. The request sends only the user's geographic coordinates (latitude/longitude) and receives weather data. No health data is ever sent. The feature is entirely optional and can be disabled in settings.

Barometric pressure data is cached locally after fetching, so the app does not continuously poll the API. A single fetch retrieves historical and current pressure data for the user's location.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-007: Symptom Logging - symptom data to correlate
- MD-009: Correlation Engine - analysis framework

**External Dependencies:**
- Weather API (e.g., Open-Meteo, which is free and requires no API key)
- Device location services permission (for coordinates)
- Network access

#### 3.5 User Interface Requirements

##### Screen: Weather Correlation (under Correlations section)

**Layout:**
- "Enable Weather Tracking" toggle (off by default)
- When enabled: location permission request, then auto-fetch pressure data
- Dual-axis chart:
  - Left axis: Symptom count or severity (bar chart)
  - Right axis: Barometric pressure in hPa (line chart)
  - X-axis: dates (30/90 day window)
- Pressure change indicators: arrows showing rapid pressure drops (> 5 hPa in 24 hours)
- Correlation summary: "X% of your [symptom] episodes occurred during rapid pressure changes"

#### 3.6 Data Requirements

##### Entity: WeatherData (new table, schema V3)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| date | string | Required, ISO date (YYYY-MM-DD) | None | Date of the weather reading |
| pressureHpa | float | Required, range 870-1084 | None | Barometric pressure in hectopascals |
| latitude | float | Required | None | Location latitude |
| longitude | float | Required | None | Location longitude |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | When the record was fetched |

**Table name:** `md_weather_data`

#### 3.7 Business Logic Rules

##### Pressure Change Detection

**Purpose:** Identify rapid barometric pressure changes that may trigger symptoms.

**Logic:**
```
1. QUERY weather data for the analysis period
2. FOR EACH consecutive day pair:
     pressureChange = day[n].pressureHpa - day[n-1].pressureHpa
     IF |pressureChange| > 5 hPa THEN mark as 'rapid_change'
     IF pressureChange < -5 THEN direction = 'dropping'
     IF pressureChange > 5 THEN direction = 'rising'
3. RETURN list of rapid change events with date and direction
```

##### Symptom-Pressure Correlation

**Purpose:** Calculate the percentage of symptom episodes that coincide with pressure changes.

**Logic:**
```
1. Get all symptom logs for the analysis period
2. Get all rapid pressure change dates
3. FOR EACH symptom log:
     IF loggedAt date matches a rapid change date (same day or day after) THEN
       mark as pressure-correlated
4. correlationPercent = (pressureCorrelatedCount / totalSymptomCount) * 100
5. RETURN { correlationPercent, totalSymptoms, pressureCorrelated, rapidChangeEvents }
```

**Edge Cases:**
- No weather data: "Enable weather tracking to see pressure correlations"
- No symptoms during pressure changes: "No correlation detected between your symptoms and pressure changes"
- Location permission denied: "Location needed for weather data. You can enter coordinates manually in settings."

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Weather API fails | "Could not fetch weather data. Will retry later." | Auto-retry on next app launch |
| Location permission denied | "Location needed for weather data" with manual coordinate entry option | User enters coordinates manually |
| No network available | "Weather data requires internet. Using cached data." | Uses last-fetched data |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** weather tracking is enabled and 30 days of pressure data is fetched,
   **When** the correlation chart is viewed,
   **Then** a dual-axis chart shows symptom bars and a pressure line overlaid.

2. **Given** 5 of 10 headache episodes occurred on days with rapid pressure drops,
   **When** the correlation summary is calculated,
   **Then** it reads "50% of your headache episodes occurred during rapid pressure changes."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects rapid pressure drop | day1: 1013, day2: 1005 | rapid_change, direction = 'dropping' |
| detects rapid pressure rise | day1: 1005, day2: 1013 | rapid_change, direction = 'rising' |
| no rapid change within threshold | day1: 1013, day2: 1010 | no rapid_change (3 < 5) |
| correlates symptoms with pressure | 5 symptoms on change days, 5 not | correlationPercent = 50 |

---

### MD-022: Predictive Risk Analysis

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-022 |
| **Feature Name** | Predictive Risk Analysis |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Migraine Sufferer, I want the app to predict when I am at higher risk for a migraine based on my historical patterns, so that I can take preventive action.

#### 3.3 Detailed Description

Predictive Risk Analysis uses the user's historical symptom, weather, medication adherence, and mood data to calculate a daily risk score for specific symptom episodes (primarily migraines, but applicable to any tracked symptom). The prediction uses simple statistical pattern matching rather than machine learning.

The system identifies the user's personal trigger profile by analyzing which factors (weather changes, missed medications, poor mood, poor sleep, specific activities) were present in the 24-48 hours before past symptom episodes. It then checks current conditions against this profile to generate a risk score.

Risk is displayed as a daily forecast on the Today screen: Low (green), Moderate (yellow), or High (red) risk for each tracked condition.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-007: Symptom Logging - historical symptom data
- MD-009: Correlation Engine - analysis framework
- MD-021: Weather-Barometric Pressure Correlation - weather trigger data

#### 3.5 User Interface Requirements

##### Screen: Today (Risk Forecast Section)

**Layout:**
- "Daily Risk Forecast" card on the Today screen (below reminders, above completed)
- For each tracked condition with sufficient data (minimum 10 episodes):
  - Condition name (e.g., "Migraine")
  - Risk level badge: Low (green) / Moderate (yellow) / High (red)
  - Top contributing factors (e.g., "Pressure dropping, missed Topiramate yesterday")
  - "View Details" link to full risk analysis

##### Screen: Risk Analysis Detail

**Layout:**
- Risk score breakdown showing each factor's contribution:
  - Weather factor: current pressure trend vs. historical trigger threshold
  - Adherence factor: recent missed doses of relevant medications
  - Mood factor: recent unpleasant mood entries
  - Time-of-month factor: day-of-month pattern from historical data
  - Activity factor: recent activities that correlate with episodes
- Historical accuracy: "This model correctly predicted X% of your past episodes"
- Disclaimer: "This is a statistical estimate, not a medical diagnosis."

#### 3.6 Data Requirements

##### Entity: RiskProfile (new table, schema V3)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| symptomName | string | Required | None | Which symptom this profile predicts |
| triggers | string | JSON array | "[]" | Identified trigger factors and weights |
| accuracy | float | 0-100 | 0 | Historical prediction accuracy percentage |
| lastCalculated | string | ISO 8601 datetime | None | When the profile was last recalculated |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Table name:** `md_risk_profiles`

#### 3.7 Business Logic Rules

##### Trigger Identification Algorithm

**Purpose:** Identify which factors precede symptom episodes.

**Logic:**
```
1. REQUIRE minimum 10 episodes of the target symptom
2. FOR EACH episode:
     Look back 48 hours before the episode and record:
       - Was there a rapid pressure change? (weatherTrigger)
       - Was any medication missed? (adherenceTrigger, which med?)
       - Was mood unpleasant? (moodTrigger)
       - What activities were logged? (activityTriggers)
       - What day of week? (dayOfWeekPattern)
3. Calculate frequency of each trigger across all episodes:
     triggerWeight = (episodes with this trigger / total episodes)
4. Include triggers with weight >= 0.3 (present in 30%+ of episodes)
5. Store as RiskProfile
```

##### Daily Risk Score Calculation

**Purpose:** Calculate today's risk score based on current conditions vs. trigger profile.

**Logic:**
```
1. Load RiskProfile for the target symptom
2. FOR EACH trigger in the profile:
     Check if the trigger condition is currently active:
       - weatherTrigger: Is pressure currently dropping > 5 hPa?
       - adherenceTrigger: Was [medication] missed in last 48 hours?
       - moodTrigger: Was mood unpleasant in last 24 hours?
       - dayOfWeekPattern: Is today a high-frequency day?
     IF active: add triggerWeight to riskScore
3. Normalize riskScore to 0-100 scale
4. Classify:
     riskScore < 30: 'low' (green)
     riskScore 30-60: 'moderate' (yellow)
     riskScore > 60: 'high' (red)
5. RETURN { riskLevel, riskScore, activeFactors, accuracy }
```

**Edge Cases:**
- Fewer than 10 episodes: "Not enough data. Log at least 10 [symptom] episodes to enable predictions."
- No weather data: Weather factor is excluded from calculation; remaining factors still used
- All triggers active: riskScore may exceed 100; cap at 100
- Profile recalculation: Recalculate weekly or when 5+ new episodes are logged

##### Accuracy Tracking

**Purpose:** Track how well the model predicts actual episodes.

**Logic:**
```
1. After each day, check:
     IF riskLevel was 'high' AND episode occurred -> true positive
     IF riskLevel was 'high' AND no episode -> false positive
     IF riskLevel was 'low' AND episode occurred -> false negative
     IF riskLevel was 'low' AND no episode -> true negative
2. accuracy = (true positives + true negatives) / total days * 100
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient episodes | "Need at least 10 [symptom] episodes for prediction" | User logs more symptom data |
| All external factors unavailable | Risk calculated from internal factors only (adherence, mood) | Reduced but functional prediction |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 15 migraine episodes, 10 of which occurred on days with pressure drops,
   **When** the trigger profile is built,
   **Then** weatherTrigger has weight 0.67 (10/15) and is included in the profile.

2. **Given** pressure is currently dropping and the user missed Topiramate yesterday,
   **When** the daily risk is calculated,
   **Then** risk level shows "High" with factors "Pressure dropping, missed Topiramate."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| identifies trigger with 30%+ frequency | 4/10 episodes with pressure drop | trigger weight = 0.4, included |
| excludes trigger below 30% | 2/10 episodes with activity | trigger weight = 0.2, excluded |
| calculates risk score | 2 active triggers with weights 0.5 and 0.3 | riskScore = 80 (normalized) |
| classifies low risk | riskScore = 20 | 'low' |
| classifies moderate risk | riskScore = 45 | 'moderate' |
| classifies high risk | riskScore = 75 | 'high' |
| caps risk at 100 | all triggers active, sum > 100 | riskScore = 100 |

---

### MD-023: FODMAP Food Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-023 |
| **Feature Name** | FODMAP Food Tracking |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Digestive Health Sufferer with IBS, I want to log foods with their FODMAP classification, so that I can identify which high-FODMAP foods trigger my symptoms.

#### 3.3 Detailed Description

FODMAP (Fermentable Oligosaccharides, Disaccharides, Monosaccharides, and Polyols) Food Tracking helps users following a low-FODMAP diet log their meals with FODMAP category classifications. The system includes a built-in database of 200+ common foods with their FODMAP categories and levels (low, moderate, high).

Users log what they eat, and the system tags each food item with its FODMAP status. Over time, users can identify which specific FODMAPs trigger their symptoms by cross-referencing food logs with digestive symptom logs (MD-025).

This feature directly replaces Cara Care ($80/yr, acquired by Bayer) for digestive health tracking.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (works independently, but integrates with MD-025)

#### 3.5 User Interface Requirements

##### Screen: Log Meal

**Layout:**
- Meal type selector: Breakfast / Lunch / Dinner / Snack
- Food search input with autocomplete from built-in database
- Each added food shows its FODMAP badge:
  - Green circle: Low FODMAP (safe)
  - Yellow circle: Moderate FODMAP (limited serving)
  - Red circle: High FODMAP (likely trigger)
- FODMAP category shown: Fructose, Lactose, Fructans, GOS, Polyols (Sorbitol, Mannitol)
- Portion size picker: Small / Medium / Large
- Notes field
- Date/time picker
- "Save" button
- Below form: Today's meal log

#### 3.6 Data Requirements

##### Entity: FoodEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| mealType | enum | One of: breakfast, lunch, dinner, snack | None | Meal category |
| foods | string | JSON array | None | List of food items with FODMAP data |
| notes | string | Nullable, max 500 chars | null | Optional notes |
| loggedAt | string | Required, ISO 8601 datetime | Current timestamp | When the meal was eaten |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Table name:** `md_food_entries`

##### Food Item Object

```json
{
  "name": "Garlic",
  "fodmapLevel": "high",
  "fodmapCategories": ["fructans"],
  "portionSize": "medium"
}
```

##### FODMAP Categories

| Category | Full Name | Common High-FODMAP Foods |
|----------|-----------|------------------------|
| Fructose | Excess fructose | Apples, pears, honey, high-fructose corn syrup, mango |
| Lactose | Lactose | Milk, soft cheeses, yogurt, ice cream |
| Fructans | Fructans | Garlic, onion, wheat, rye, artichoke |
| GOS | Galacto-oligosaccharides | Chickpeas, lentils, kidney beans, soybeans |
| Sorbitol | Polyol (sorbitol) | Apples, pears, stone fruits, sugar-free gum |
| Mannitol | Polyol (mannitol) | Mushrooms, cauliflower, watermelon, sugar-free mints |

#### 3.7 Business Logic Rules

##### FODMAP Food Database

**Purpose:** Provide instant FODMAP classification for common foods.

**Logic:**
```
1. Ship a bundled database of 200+ foods with FODMAP levels and categories
2. User can search by food name (substring, case-insensitive)
3. Foods not in database can be added with manual FODMAP classification
4. Database is read-only (bundled); user additions are stored separately
```

##### Meal FODMAP Summary

**Purpose:** Summarize the FODMAP exposure for a meal.

**Logic:**
```
1. FOR EACH food in the meal:
     Collect all FODMAP categories with their levels
2. overallRisk = highest level among all foods (high > moderate > low)
3. triggeredCategories = unique FODMAP categories where level = 'high' or 'moderate'
4. RETURN { overallRisk, triggeredCategories, foodCount }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Food not found in database | "Not in our database. Add manually?" with FODMAP level picker | User classifies manually |
| No foods added to meal | "Add at least one food item" | User adds food |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user searches for "garlic" in the food database,
   **When** results appear,
   **Then** "Garlic" shows a red badge with category "Fructans" and level "High."

2. **Given** the user logs a meal with garlic (high, fructans) and rice (low),
   **When** the meal summary is displayed,
   **Then** overallRisk is "high" and triggeredCategories = ["fructans"].

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| classifies garlic as high fructans | food: "garlic" | fodmapLevel = 'high', categories = ['fructans'] |
| classifies rice as low | food: "rice" | fodmapLevel = 'low' |
| meal risk is highest food | [high, low, moderate] | overallRisk = 'high' |
| meal risk all low | [low, low, low] | overallRisk = 'low' |
| search is case insensitive | query: "GARLIC" | finds "garlic" |

---

### MD-024: Bristol Stool Scale

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-024 |
| **Feature Name** | Bristol Stool Scale |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Digestive Health Sufferer, I want to quickly log my bowel movements using the Bristol Stool Scale, so that I can track gut health patterns and share standardized data with my gastroenterologist.

#### 3.3 Detailed Description

The Bristol Stool Scale is a clinically validated 7-type classification system for stool form. This feature provides a quick-log interface where users tap one of 7 visual icons to record a bowel movement. Each entry records the Bristol type, optional notes, and a timestamp.

The interface uses simplified visual icons (not photographic) representing each type. The scale is widely used in clinical gastroenterology, so the data is immediately meaningful to doctors.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (works independently)

#### 3.5 User Interface Requirements

##### Screen: Quick Stool Log

**Layout:**
- 7 visual icon buttons arranged in a grid or vertical list, each with type number and brief label
- Tapping a type immediately opens a confirmation bottom sheet with:
  - Selected type icon and description
  - Notes field (optional)
  - "Log" button
- After logging: brief success animation, counter updates
- Below icons: Today's log count and weekly summary chart (bar chart of types by day)

#### 3.6 Data Requirements

##### Entity: StoolEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| bristolType | integer | Required, min 1, max 7 | None | Bristol Stool Scale type (1-7) |
| notes | string | Nullable, max 500 chars | null | Optional notes |
| loggedAt | string | Required, ISO 8601 datetime | Current timestamp | When the entry was recorded |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Table name:** `md_stool_entries`

#### 3.7 Business Logic Rules

##### Bristol Stool Scale Types (Clinically Accurate)

| Type | Form | Description | Clinical Indication |
|------|------|-------------|-------------------|
| 1 | Separate hard lumps, like nuts (hard to pass) | Small, hard, separate lumps resembling nuts or pebbles. Difficult to pass. | Severe constipation. Stool has been in the colon for an extended period. Indicates slow transit time. |
| 2 | Sausage-shaped but lumpy | Log-shaped but with a lumpy, uneven surface composed of compressed lumps. | Constipation. Less severe than Type 1 but still indicates slow transit and dehydration of stool. |
| 3 | Like a sausage but with cracks on surface | Sausage or snake-shaped with visible cracks on the surface. | Normal, leaning toward mild constipation. Generally considered healthy. |
| 4 | Like a sausage or snake, smooth and soft | Smooth, soft, sausage or snake-shaped. Easy to pass. | Ideal. Indicates healthy fiber intake, adequate hydration, and normal transit time. |
| 5 | Soft blobs with clear-cut edges (easy to pass) | Soft, well-formed blobs with distinct edges. Passed easily. | Normal, leaning toward mild looseness. Lacking some fiber. |
| 6 | Fluffy pieces with ragged edges, mushy | Mushy consistency with ragged, fluffy edges. No solid form. | Mild diarrhea. Indicates rapid transit or possible dietary trigger. |
| 7 | Watery, no solid pieces (entirely liquid) | Entirely liquid with no solid components. | Severe diarrhea. Rapid transit. May indicate infection, food intolerance, or IBD flare. |

##### Type Interpretation Color Coding

| Types | Color | Meaning |
|-------|-------|---------|
| 3, 4 | Green | Healthy/normal |
| 5 | Yellow-Green | Slightly loose but normal |
| 2, 6 | Yellow | Mild abnormality |
| 1, 7 | Red | Needs attention |

##### Weekly Pattern Analysis

**Purpose:** Summarize stool patterns over the past 7 days.

**Logic:**
```
1. QUERY stool entries for the last 7 days
2. Calculate:
     totalEntries: count of all entries
     averageType: mean of bristolType values (rounded to 1 decimal)
     distribution: count per type (1-7)
     dominantType: most frequent type
3. IF averageType between 3.0 and 4.5 THEN pattern = 'healthy'
4. IF averageType < 3.0 THEN pattern = 'constipation tendency'
5. IF averageType > 4.5 THEN pattern = 'loose tendency'
6. RETURN { totalEntries, averageType, distribution, dominantType, pattern }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Log fails | Toast: "Could not save entry." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps the Type 4 icon,
   **When** they confirm with "Log",
   **Then** a StoolEntry is created with bristolType=4, and today's count increments.

2. **Given** the user has logged 5 entries this week with types [3, 4, 4, 3, 4],
   **When** the weekly summary is calculated,
   **Then** averageType=3.6, dominantType=4, pattern="healthy".

**Edge Cases:**

3. **Given** all entries this week are Type 7,
   **When** the pattern analysis runs,
   **Then** pattern="loose tendency" with average=7.0.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| accepts valid Bristol types | bristolType: 1-7 | Valid entries created |
| rejects type 0 | bristolType: 0 | Validation error |
| rejects type 8 | bristolType: 8 | Validation error |
| healthy pattern average | types: [3, 4, 4, 3] | averageType = 3.5, pattern = 'healthy' |
| constipation pattern | types: [1, 2, 1, 2] | averageType = 1.5, pattern = 'constipation tendency' |
| loose pattern | types: [5, 6, 6, 7] | averageType = 6.0, pattern = 'loose tendency' |

---

### MD-025: Digestive Symptom Timeline

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-025 |
| **Feature Name** | Digestive Symptom Timeline |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Digestive Health Sufferer, I want to see a timeline linking my meals to digestive symptoms with time delay tracking, so that I can identify which foods trigger my symptoms and how long after eating they appear.

#### 3.3 Detailed Description

The Digestive Symptom Timeline provides a visual chronological view that interleaves meal entries (MD-023), stool entries (MD-024), and digestive symptom logs on a single timeline. The key insight this feature provides is the time delay between eating a food and experiencing symptoms.

Users can tap a symptom on the timeline to see which meals were eaten in the preceding 2-72 hours, helping them identify trigger foods. The system also performs automated food-symptom correlation by analyzing which foods most frequently appear before symptom episodes.

This feature is the core differentiator of the digestive health suite, combining FODMAP tracking, Bristol Scale, and symptom logging into an actionable timeline.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-023: FODMAP Food Tracking - meal data
- MD-024: Bristol Stool Scale - stool data
- MD-007: Symptom Logging - symptom data

#### 3.5 User Interface Requirements

##### Screen: Digestive Timeline

**Layout:**
- Vertical timeline with time axis on the left (most recent at top)
- Three types of entries interleaved chronologically:
  - Meal cards (fork icon, green): Meal type, food list with FODMAP badges, timestamp
  - Symptom cards (warning icon, red/orange): Symptom name, severity, timestamp
  - Stool cards (circle icon, colored by Bristol type): Type number, timestamp
- Connecting lines from symptom cards to preceding meal cards showing time delay (e.g., "3h 20m after lunch")
- Filter: "Show meals only" / "Show symptoms only" / "Show all"
- Date range: Today / 7 days / 30 days

##### Analysis: Food-Symptom Correlation Panel

**Layout:**
- Table showing: Food name, Times eaten, Times followed by symptom (within 72h), Correlation rate
- Sorted by correlation rate descending
- Only foods with >= 3 occurrences are shown
- Foods with > 50% correlation rate are highlighted in red as "Likely triggers"

#### 3.6 Data Requirements

No new entities. The timeline is constructed by querying `md_food_entries`, `md_stool_entries`, and `md_symptom_logs` within the same date range and interleaving by timestamp.

##### Food-Symptom Correlation Output

```
{
  foodName: string,
  timesEaten: number,
  timesFollowedBySymptom: number,
  correlationRate: number,      // percentage
  averageDelayHours: number
}
```

#### 3.7 Business Logic Rules

##### Timeline Construction

**Purpose:** Build an interleaved chronological view of meals, symptoms, and stool entries.

**Logic:**
```
1. QUERY food_entries for the date range
2. QUERY symptom_logs for digestive symptoms (stomach_pain, nausea, bloating, gas, diarrhea, constipation) in the date range
3. QUERY stool_entries for the date range
4. MERGE all entries into a single list, sorted by timestamp descending
5. FOR EACH symptom entry:
     Find all meals in the preceding 2-72 hours
     Calculate timeDelay = symptomTime - mealTime for each
     Attach meal references with delay to the symptom entry
6. RETURN timeline entries
```

##### Food-Symptom Correlation Algorithm

**Purpose:** Identify which foods most frequently precede digestive symptoms.

**Logic:**
```
1. FOR EACH unique food across all meal entries:
     timesEaten = count of meals containing this food
     IF timesEaten < 3 THEN SKIP (insufficient data)
     timesFollowedBySymptom = count of those meals that have a digestive symptom
       logged within 2-72 hours after
     correlationRate = (timesFollowedBySymptom / timesEaten) * 100
     averageDelayHours = mean of time delays for correlated events
2. SORT by correlationRate descending
3. RETURN food correlation list
```

**Edge Cases:**
- No meals logged: "Log your meals to see food-symptom correlations"
- No digestive symptoms: "No digestive symptoms recorded in this period"
- Multiple meals before one symptom: All meals in the 2-72h window are considered potential contributors
- One meal followed by multiple symptoms: Counted once per symptom (each symptom is independently correlated)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No food entries | "Log your meals in FODMAP Tracking to see the digestive timeline" | User logs meals |
| No correlations found | "No food-symptom correlations detected. Keep logging to find patterns." | User continues logging |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user ate garlic at 12:00 and logged "stomach pain" at 15:00,
   **When** the timeline is viewed,
   **Then** the stomach pain card shows a connection to the garlic meal with "3h 0m after lunch."

2. **Given** the user has eaten garlic 5 times and experienced symptoms within 72h on 4 occasions,
   **When** the food-symptom correlation runs,
   **Then** garlic shows correlationRate=80% and is flagged as "Likely trigger."

**Edge Cases:**

3. **Given** a food has been eaten only 2 times,
   **When** the correlation analysis runs,
   **Then** that food is excluded (minimum 3 occurrences required).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| timeline sorted by time | 3 meals, 2 symptoms, 1 stool | All 6 entries sorted descending by timestamp |
| links symptom to preceding meal | meal at 12:00, symptom at 15:00 | timeDelay = 3.0 hours |
| ignores meals > 72h before | meal at -80h, symptom now | Not linked |
| ignores meals < 2h before | meal at -1h, symptom now | Not linked |
| correlation rate calculation | 5 meals, 3 followed by symptom | correlationRate = 60% |
| excludes foods with < 3 occurrences | food eaten 2 times | Excluded from correlation |

---

### MD-026: Caregiver Alerts (Medfriend)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-026 |
| **Feature Name** | Caregiver Alerts (Medfriend) |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Caregiver, I want to receive a notification if my parent misses a critical medication for more than 2 hours, so that I can follow up with them.

**Secondary:**
> As a Daily Med Manager, I want to designate a trusted family member who gets notified only if I miss a dose, knowing they will not see my medication names or health data, so that I have a safety net without sacrificing privacy.

#### 3.3 Detailed Description

Medfriend is an optional caregiver alert system that notifies a designated contact when a critical medication dose is missed beyond a configurable grace period. The feature is carefully designed to protect the user's privacy while providing a safety net.

**What the caregiver receives:**
- A notification stating: "[User's name] missed a scheduled medication dose" (or a custom message set by the user)
- Nothing else. No medication name, no dosage, no health data.

**What the caregiver does NOT receive:**
- Medication names or types
- Dosage information
- Health measurements or vitals
- Mood or symptom data
- Adherence history
- Any other health information

The user configures which medications trigger caregiver alerts (not all medications need to be monitored). Only medications marked as "critical" with a Medfriend alert enabled will generate notifications. The grace period is configurable per medication (default: 2 hours after the scheduled time).

Alert delivery uses local device mechanisms (SMS via the device's messaging capability or a shared notification ID system using a simple unique code). No server-side infrastructure is required.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - medications to monitor
- MD-002: Medication Reminders - dose schedule that determines when a miss occurs

**External Dependencies:**
- SMS capability for text-based alerts (optional)
- Push notification capability for code-based alerts (optional)

#### 3.5 User Interface Requirements

##### Screen: Settings - Medfriend

**Layout:**
- "Medfriend" section header with description: "Designate a trusted contact to receive alerts when you miss a critical medication."
- "Add Medfriend" button (max 3 Medfriends)
- For each Medfriend:
  - Name (text input)
  - Phone number (for SMS alerts)
  - Custom alert message (optional, default: "[Your name] missed a scheduled medication")
  - "Test Alert" button (sends a test notification)
  - "Remove" button
- Below contacts: "Monitored Medications" section
  - List of all active medications with a toggle "Alert Medfriend on miss"
  - Grace period per medication (picker: 1h, 2h, 3h, 4h, 6h, 8h)

##### Privacy Notice (shown on first setup)

**Content:**
```
Medfriend Privacy Guarantee

When you add a Medfriend, they will ONLY receive a brief notification
that you missed a medication dose. They will never see:

- Which medication you missed
- Your medication list or dosages
- Any health data (blood pressure, glucose, mood, etc.)
- Your adherence history

You control which medications trigger alerts and how long
to wait before alerting. You can remove a Medfriend at any time.
```

#### 3.6 Data Requirements

##### Entity: Medfriend

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| name | string | Required, max 100 chars | None | Contact's name |
| phoneNumber | string | Required, valid phone format | None | Contact's phone number |
| alertMessage | string | Max 200 chars | "[User] missed a scheduled medication" | Custom alert text |
| isActive | boolean | - | true | Whether this Medfriend is active |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Table name:** `md_medfriends`

##### Entity: MedfriendAlert (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| medfriendId | string | FK to Medfriend.id, CASCADE | None | Which Medfriend to alert |
| medicationId | string | FK to Medication.id, CASCADE | None | Which medication triggers the alert |
| gracePeriodMinutes | integer | Min 60, max 480 | 120 | Minutes after scheduled time before alert fires |
| isEnabled | boolean | - | true | Whether alert is active for this medication |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Table name:** `md_medfriend_alerts`

##### Entity: MedfriendAlertLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| medfriendAlertId | string | FK to MedfriendAlert.id | None | Which alert rule fired |
| sentAt | string | ISO 8601 datetime | None | When the alert was sent |
| deliveryStatus | enum | One of: sent, failed, suppressed | None | Whether delivery succeeded |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Table name:** `md_medfriend_alert_logs`

#### 3.7 Business Logic Rules

##### Alert Trigger Logic

**Purpose:** Determine when to send a Medfriend alert.

**Logic:**
```
1. WHEN a scheduled dose time passes:
     Start a grace period timer for that dose
2. After gracePeriodMinutes:
     CHECK if the dose has been logged (status = 'taken' or 'late')
     IF dose is NOT logged AND dose is NOT snoozed:
       FOR EACH active Medfriend with an enabled alert for this medication:
         Send alert notification with the Medfriend's custom message
         Log the alert in md_medfriend_alert_logs
3. IF dose is logged before grace period expires:
     Cancel the pending alert
```

##### Alert Suppression Rules

**Purpose:** Prevent alert fatigue and respect user control.

**Logic:**
```
1. Maximum 1 alert per Medfriend per 4-hour window (suppress duplicates)
2. IF user manually snoozes a dose, extend the grace period by the snooze duration
3. IF medication is deactivated, suppress all pending alerts for that medication
4. User can temporarily disable all Medfriend alerts via a "Pause Alerts" toggle
```

##### Alert Content (PRIVACY-CRITICAL)

**What IS included in the alert message:**
```
"[Custom message or default]"
Default: "[User's name] missed a scheduled medication dose."
```

**What is NEVER included:**
```
- Medication name
- Medication dosage
- Medication type or category
- Health measurements
- Mood or symptom data
- Adherence statistics
- Time of the specific dose
- Any other health information
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| SMS send fails | Alert log shows "Failed" status; user sees "Alert delivery failed" in Medfriend settings | User checks phone number; can resend test |
| Phone number invalid | Inline validation: "Please enter a valid phone number" | User corrects |
| Max Medfriends exceeded | "Maximum 3 Medfriends allowed" | User removes one before adding |
| Grace period too short (< 60 min) | "Minimum grace period is 1 hour to avoid false alerts" | User selects longer period |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** "Lisinopril" has a Medfriend alert with a 2-hour grace period and the dose was scheduled at 08:00,
   **When** 10:00 arrives and the dose has not been logged,
   **Then** a notification is sent to the Medfriend with the default message.

2. **Given** the user takes the dose at 09:30 (1.5 hours after schedule),
   **When** the grace period check runs at 10:00,
   **Then** the alert is NOT sent (dose was logged before grace period expired).

3. **Given** a Medfriend receives an alert,
   **When** they read the notification,
   **Then** it says only "[User] missed a scheduled medication dose" - no medication name or details.

**Edge Cases:**

4. **Given** the user snoozes the dose for 30 minutes at 08:00,
   **When** the grace period is recalculated,
   **Then** the new grace period deadline is 10:30 (original 10:00 + 30-minute snooze).

5. **Given** two doses are missed within 2 hours for the same Medfriend,
   **When** alert suppression runs,
   **Then** only 1 alert is sent (4-hour window suppression).

**Negative Tests:**

6. **Given** a user tries to add a 4th Medfriend,
   **When** they tap "Add Medfriend",
   **Then** they see "Maximum 3 Medfriends allowed."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| alert fires after grace period | dose not logged, grace expired | Alert sent |
| alert cancelled by dose log | dose logged before grace expires | Alert not sent |
| alert suppressed within 4h window | 2nd miss within 4h | 2nd alert suppressed |
| snooze extends grace period | snooze 30min at scheduled time | New deadline = scheduled + grace + 30 |
| alert message contains no med details | any alert | Message contains only custom text, no med name |
| max 3 medfriends enforced | attempt to add 4th | Rejected |
| minimum grace period 60 min | gracePeriod: 30 | Rejected |

---

### MD-027: Expanded Health Measurements

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-027 |
| **Feature Name** | Expanded Health Measurements |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Tracker, I want to log blood oxygen (SpO2), body temperature, respiratory rate, and heart rate, so that I can track all my vital signs in one place.

#### 3.3 Detailed Description

Expanded Health Measurements adds four additional measurement types to the generic measurement system (MD-008): blood oxygen saturation (SpO2), body temperature, respiratory rate, and heart rate. Each type has a purpose-built input form with appropriate ranges, units, and clinical reference ranges.

These measurements can be entered manually or, on iOS, imported from Apple HealthKit if the user has a device that records them (Apple Watch, pulse oximeter, etc.). All measurements participate in trend analysis (MD-008) and doctor reports (MD-010).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-008: Health Measurements - underlying measurement storage

#### 3.5 User Interface Requirements

##### Screen: Log Vital Sign (per type)

**Layout for each vital type:**
- Large number input with appropriate range
- Unit display (auto-set, non-editable for standard vitals)
- Clinical reference range badge (Normal / Abnormal)
- Notes field (optional)
- Date/time picker
- "Save" button
- HealthKit import toggle (iOS only): "Auto-import from Apple Health"

#### 3.6 Data Requirements

Uses existing HealthMeasurement entity (MD-008). Expanded type enum adds:

| Type | Unit | Normal Range | Input Range |
|------|------|-------------|-------------|
| spo2 | % | 95-100% | 50-100 |
| temperature | F (or C) | 97.0-99.5 F (36.1-37.5 C) | 90-110 F (32-43 C) |
| respiratory_rate | breaths/min | 12-20 | 4-60 |
| heart_rate | bpm | 60-100 (resting) | 20-250 |

#### 3.7 Business Logic Rules

##### Clinical Range Classification

**Purpose:** Classify each measurement as normal or abnormal.

**Logic:**
```
SpO2:
  >= 95%: normal (green)
  90-94%: low (yellow) - "Consider monitoring"
  < 90%: critically low (red) - "Seek medical attention"

Temperature (Fahrenheit):
  97.0-99.5 F: normal (green)
  99.6-100.3 F: low-grade fever (yellow)
  100.4-103.0 F: fever (orange)
  > 103.0 F: high fever (red) - "Seek medical attention"
  < 95.0 F: hypothermia (red) - "Seek medical attention"

Respiratory Rate:
  12-20 breaths/min: normal (green)
  8-11 or 21-24: slightly abnormal (yellow)
  < 8 or > 24: abnormal (red)

Heart Rate (resting):
  60-100 bpm: normal (green)
  50-59 or 101-120: slightly abnormal (yellow)
  < 50: bradycardia (red) - unless athletic
  > 120: tachycardia (red)
```

##### Temperature Unit Conversion

**Formulas:**
- `Celsius = (Fahrenheit - 32) * 5/9`
- `Fahrenheit = Celsius * 9/5 + 32`

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Value outside plausible range | Inline warning: "This reading seems unusual. Please verify." | User confirms or corrects |
| SpO2 < 90% | Alert: "Very low blood oxygen. If you feel short of breath, seek immediate medical attention." | User acknowledges |
| Temperature > 103 F | Alert: "High fever detected. Consider contacting your healthcare provider." | User acknowledges |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enters SpO2=97%,
   **When** saved,
   **Then** a measurement is created with type="spo2", value="97", unit="%", and the badge shows "Normal" in green.

2. **Given** the user enters temperature=101.2 F,
   **When** classified,
   **Then** the badge shows "Fever" in orange.

3. **Given** the user enters heart rate=72,
   **When** classified,
   **Then** the badge shows "Normal" in green.

**Edge Cases:**

4. **Given** SpO2=89%,
   **When** classified,
   **Then** badge shows "Critically Low" in red with an urgent alert.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| SpO2 normal | 97% | classification = 'normal' |
| SpO2 low | 92% | classification = 'low' |
| SpO2 critical | 88% | classification = 'critically_low' |
| temp normal | 98.6 F | classification = 'normal' |
| temp low grade fever | 100.0 F | classification = 'low_grade_fever' |
| temp fever | 101.5 F | classification = 'fever' |
| temp high fever | 104.0 F | classification = 'high_fever' |
| temp hypothermia | 94.0 F | classification = 'hypothermia' |
| heart rate normal | 75 bpm | classification = 'normal' |
| heart rate tachycardia | 130 bpm | classification = 'tachycardia' |
| heart rate bradycardia | 45 bpm | classification = 'bradycardia' |
| respiratory normal | 16 breaths/min | classification = 'normal' |
| converts F to C | 98.6 F | 37.0 C |
| converts C to F | 37.0 C | 98.6 F |

---

### MD-028: Side Effect Logger

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-028 |
| **Feature Name** | Side Effect Logger |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want to log side effects and link them to specific medications, so that I can track which medications cause which side effects and how severe they are over time.

#### 3.3 Detailed Description

The Side Effect Logger extends the symptom logging system (MD-007) by explicitly linking symptom entries to specific medications as suspected causes. While the correlation engine (MD-009) provides statistical analysis of symptom-medication relationships, the Side Effect Logger captures the user's self-reported attribution: "I believe this headache is a side effect of Lisinopril."

Each side effect entry records the symptom, the suspected medication, severity (1-10), onset timing relative to dose (immediately, within hours, within days), and whether the side effect has been reported to the prescriber.

Over time, the system builds a per-medication side effect profile showing which side effects are reported, their average severity, and whether they improve or worsen over time (useful for medications where side effects diminish after an adjustment period).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - medications to link side effects to
- MD-007: Symptom Logging - underlying symptom system

#### 3.5 User Interface Requirements

##### Screen: Medication Detail - Side Effects Section

**Layout:**
- "Reported Side Effects" section on the Medication Detail screen
- Each side effect card shows: symptom name, severity (1-10 bar), onset timing, date first reported, trend (improving/stable/worsening based on severity changes)
- "Report Side Effect" button opens the logging form
- Side effect history expandable list showing all entries over time

##### Modal: Report Side Effect

**Layout:**
- Symptom picker (from predefined + custom symptoms list)
- Medication auto-selected (from the detail screen context) or picker if accessed globally
- Severity slider (1-10)
- Onset timing: Immediately / Within hours / Within days / Delayed (weeks)
- "Reported to prescriber?" checkbox
- Notes field
- "Save" button

#### 3.6 Data Requirements

##### Entity: SideEffectEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| symptomLogId | string | FK to SymptomLog.id | None | Linked symptom log entry |
| medicationId | string | Required, FK to Medication.id, CASCADE | None | Suspected causing medication |
| severity | integer | Required, min 1, max 10 | None | Side effect severity |
| onsetTiming | enum | One of: immediately, within_hours, within_days, delayed | None | How soon after dose the side effect appeared |
| reportedToPrescriber | boolean | - | false | Whether the user has told their doctor |
| notes | string | Nullable, max 500 chars | null | Additional details |
| loggedAt | string | Required, ISO 8601 datetime | Current timestamp | When the side effect was reported |
| createdAt | string | ISO 8601 datetime, auto-set | Current timestamp | Record creation time |

**Table name:** `md_side_effects`

#### 3.7 Business Logic Rules

##### Side Effect Trend Analysis

**Purpose:** Determine if a side effect is improving, stable, or worsening.

**Logic:**
```
1. QUERY all SideEffectEntries for a given medication + symptom pair, ordered by date
2. IF fewer than 3 entries THEN trend = 'insufficient data'
3. Divide entries into first half and second half by date
4. firstHalfAvg = mean(severity) for first half
5. secondHalfAvg = mean(severity) for second half
6. IF secondHalfAvg - firstHalfAvg < -1 THEN trend = 'improving'
7. IF secondHalfAvg - firstHalfAvg > 1 THEN trend = 'worsening'
8. ELSE trend = 'stable'
```

##### Side Effect Profile

**Purpose:** Build a per-medication side effect summary.

**Logic:**
```
1. GROUP all SideEffectEntries by (medicationId, symptom)
2. FOR EACH group:
     count = number of entries
     avgSeverity = mean(severity)
     trend = calculate trend per above algorithm
     lastReported = most recent loggedAt
3. RETURN sorted by avgSeverity descending
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No medication selected | "Select the medication you suspect is causing this side effect" | User picks medication |
| Save fails | Toast: "Could not save side effect report." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user reports "headache" as a side effect of "Lisinopril" with severity 6 and onset "within hours",
   **When** saved,
   **Then** a SideEffectEntry is created linking headache to Lisinopril.

2. **Given** 5 side effect entries for "headache + Lisinopril" with severities [7, 6, 5, 4, 3],
   **When** the trend is calculated,
   **Then** trend = "improving" (first half avg 6.5 > second half avg 4.0).

**Edge Cases:**

3. **Given** only 2 side effect entries exist for a medication,
   **When** the trend is calculated,
   **Then** result = "insufficient data."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates side effect entry | valid input | Entry created with all fields |
| improving trend | severities: [8, 7, 5, 3] | trend = 'improving' |
| worsening trend | severities: [3, 4, 6, 8] | trend = 'worsening' |
| stable trend | severities: [5, 5, 5, 5] | trend = 'stable' |
| insufficient data | severities: [5, 6] | trend = 'insufficient data' |
| profile sorts by severity | 3 symptoms with different avg | Sorted descending by avgSeverity |

---

### MD-029: Data Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-029 |
| **Feature Name** | Data Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious user, I want to export all my MyMeds data in a portable format, so that I own my data and can back it up or migrate it.

#### 3.3 Detailed Description

Data Export provides comprehensive data portability. Users can export all their medication data, dose logs, mood entries, symptom logs, measurements, side effects, and settings in CSV and JSON formats. Exports are generated locally and saved as files via the OS share sheet.

This feature is central to the privacy-first positioning: users truly own their data because they can extract all of it at any time in human-readable formats.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MD-001: Medication Management - data to export

**External Dependencies:**
- File system access for saving exports

#### 3.5 User Interface Requirements

##### Screen: Settings - Export Data

**Layout:**
- Format picker: CSV / JSON
- Data selection checkboxes (all checked by default):
  - Medications
  - Dose Logs
  - Mood Entries
  - Symptom Logs
  - Health Measurements
  - Side Effects
  - Refill History
  - Settings
- "Export" button
- After generation: OS share sheet opens with the file

#### 3.6 Data Requirements

No new entities. Exports query all existing tables.

##### Export Formats

**CSV:** One file per entity type (medications.csv, dose_logs.csv, mood_entries.csv, etc.). Column names match field names in camelCase.

**JSON:** Single file with all selected data in a structured object:
```json
{
  "exportDate": "2026-03-06T12:00:00Z",
  "version": "1.0",
  "medications": [...],
  "doseLogs": [...],
  "moodEntries": [...],
  "symptomLogs": [...],
  "measurements": [...],
  "sideEffects": [...],
  "refills": [...],
  "settings": {...}
}
```

#### 3.7 Business Logic Rules

##### Export Generation

**Logic:**
```
1. FOR EACH selected data type:
     Query all records from the corresponding table
     Transform to export format (camelCase fields, ISO dates)
2. IF format = CSV:
     Generate one CSV file per data type
     Bundle into a ZIP file: mymed-export-YYYY-MM-DD.zip
3. IF format = JSON:
     Generate single JSON file: mymed-export-YYYY-MM-DD.json
4. Open OS share sheet with the generated file
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Export fails | Toast: "Export failed. Please try again." | User retries |
| No data selected | "Select at least one data type to export" | User checks a box |
| Large dataset (> 10MB) | Progress indicator during generation | User waits |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 5 medications, 100 dose logs, and 30 mood entries,
   **When** they export as JSON with all types selected,
   **Then** a JSON file is generated containing all 135+ records.

2. **Given** the user exports as CSV,
   **When** the export completes,
   **Then** a ZIP file contains separate CSV files for each data type.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| exports medications as JSON | 3 medications | JSON array with 3 objects |
| exports dose logs as CSV | 10 logs | CSV with 10 rows + header |
| empty export for no data | no records | Valid file with empty arrays/no rows |
| includes export metadata | any export | exportDate and version present |

---

### MD-030: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MD-030 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P1 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Daily Med Manager, I want to configure app settings like default reminder time, notification preferences, and display options, so that the app works the way I prefer.

#### 3.3 Detailed Description

Settings and Preferences provides a centralized configuration screen for all MyMeds options. Settings are stored in the `md_settings` key-value table and persist across sessions.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Settings (Tab 5)

**Layout:**
- **Notifications** section:
  - Default reminder time (time picker, default 08:00)
  - Snooze duration (picker: 5, 10, 15, 30, 60 min)
  - Reminder sound (on/off)
- **Supply Alerts** section:
  - Low supply threshold (days picker: 3, 5, 7, 10, 14)
- **Health Tracking** section:
  - Glucose unit preference (mg/dL / mmol/L)
  - Temperature unit preference (F / C)
  - Weight unit preference (lbs / kg)
  - Enable weather tracking (on/off, default off)
- **Medfriend** section:
  - Link to Medfriend configuration (MD-026)
- **Data** section:
  - Export Data (link to MD-029)
  - Delete All Data (with double confirmation: "Are you sure?" then "Type DELETE to confirm")
- **About** section:
  - App version, privacy policy link, medical disclaimer

#### 3.6 Data Requirements

Uses existing `md_settings` key-value table.

**Settings Keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| reminderTime | string (HH:MM) | "08:00" | Default notification time |
| snoozeDuration | integer | 15 | Default snooze in minutes |
| reminderSound | boolean | true | Play sound with notifications |
| lowSupplyThreshold | integer | 7 | Days before low supply alert |
| glucoseUnit | string | "mg/dL" | Preferred glucose unit |
| temperatureUnit | string | "F" | Preferred temperature unit |
| weightUnit | string | "lbs" | Preferred weight unit |
| weatherTrackingEnabled | boolean | false | Enable barometric pressure tracking |
| lastLabA1c | JSON string | null | Most recent lab A1c value and date |

#### 3.7 Business Logic Rules

##### Delete All Data

**Purpose:** Permanently remove all MyMeds data.

**Logic:**
```
1. User taps "Delete All Data"
2. First confirmation dialog: "Are you sure? This will permanently delete all your medications, dose history, mood entries, symptoms, measurements, and settings. This cannot be undone."
3. User must type "DELETE" (case-sensitive) in a text field
4. System drops all md_ prefixed tables
5. Re-run migrations to recreate empty tables
6. Show success message: "All data has been deleted."
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Setting save fails | Toast: "Could not save setting." | Reverts to previous value |
| Delete all data fails | "Could not delete data. Please restart the app and try again." | User restarts |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user changes glucoseUnit from "mg/dL" to "mmol/L",
   **When** they navigate to the glucose logging screen,
   **Then** the unit is displayed as mmol/L and all values are converted.

2. **Given** the user sets lowSupplyThreshold to 14,
   **When** a medication has 12 days of supply remaining,
   **Then** a low supply alert fires (12 < 14).

**Negative Tests:**

3. **Given** the user taps "Delete All Data" and types "delete" (lowercase),
   **When** they tap Confirm,
   **Then** nothing is deleted (case-sensitive match required).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| gets default setting | key: "reminderTime" | "08:00" |
| sets and retrieves setting | set glucoseUnit = "mmol/L" | get returns "mmol/L" |
| delete requires exact match | typed "delete" (lowercase) | Deletion blocked |
| delete succeeds with exact match | typed "DELETE" | All tables emptied |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Medication** entity, which is the root of the medication management system. Each Medication has many DoseLogs (recording when doses were taken/skipped), many Reminders (controlling when notifications fire), many Refills (recording supply replenishment), and many SideEffectEntries (tracking adverse reactions).

The **health tracking** layer runs parallel to medications: MoodEntries capture emotional state with linked MoodActivities, SymptomLogs track health symptoms linked to Symptom definitions, and HealthMeasurements record vital signs. The **DrugInteraction** table stands alone as a reference database of drug pairs.

The **digestive health** subsystem adds FoodEntries (FODMAP-classified meals), StoolEntries (Bristol Scale), and links to SymptomLogs via the Digestive Symptom Timeline.

The **caregiver** layer adds Medfriends (trusted contacts) with MedfriendAlerts (per-medication alert rules) and MedfriendAlertLogs (delivery tracking).

The **analytics** layer adds PainEntries (body/head map), WeatherData (barometric pressure), and RiskProfiles (predictive models). These entities are read from by the Correlation Engine and Doctor Report Generator.

All entities share the `md_` table prefix and reside in the same SQLite database file.

### 4.2 Complete Entity Definitions

See individual feature data requirements in Section 3 for full field definitions. The canonical entity list:

| Entity | Table Name | Feature | Key Fields |
|--------|-----------|---------|------------|
| Medication | md_medications | MD-001 | id, name, dosage, unit, frequency, pillCount, timeSlots, isActive |
| DoseLog | md_dose_logs | MD-003 | id, medicationId, scheduledTime, actualTime, status |
| Dose (legacy) | md_doses | MD-003 | id, medicationId, takenAt, skipped |
| Reminder | md_reminders | MD-002 | id, medicationId, time, daysOfWeek, isActive, snoozeUntil |
| Refill | md_refills | MD-004 | id, medicationId, quantity, refillDate, pharmacy |
| DrugInteraction | md_interactions | MD-005 | id, drugA, drugB, severity, description, source |
| MoodEntry | md_mood_entries | MD-006 | id, mood, energyLevel, pleasantness, intensity |
| MoodActivity | md_mood_activities | MD-006 | id, moodEntryId, activity |
| Symptom | md_symptoms | MD-007 | id, name, isCustom |
| SymptomLog | md_symptom_logs | MD-007 | id, symptomId, severity, loggedAt |
| HealthMeasurement | md_measurements | MD-008 | id, type, value, unit, measuredAt |
| Settings | md_settings | MD-030 | key, value |
| PainEntry | md_pain_entries | MD-020 | id, zones (JSON), overallSeverity, loggedAt |
| FoodEntry | md_food_entries | MD-023 | id, mealType, foods (JSON), loggedAt |
| StoolEntry | md_stool_entries | MD-024 | id, bristolType, loggedAt |
| Medfriend | md_medfriends | MD-026 | id, name, phoneNumber, alertMessage |
| MedfriendAlert | md_medfriend_alerts | MD-026 | id, medfriendId, medicationId, gracePeriodMinutes |
| MedfriendAlertLog | md_medfriend_alert_logs | MD-026 | id, medfriendAlertId, sentAt, deliveryStatus |
| SideEffectEntry | md_side_effects | MD-028 | id, symptomLogId, medicationId, severity, onsetTiming |
| WeatherData | md_weather_data | MD-021 | id, date, pressureHpa, latitude, longitude |
| RiskProfile | md_risk_profiles | MD-022 | id, symptomName, triggers (JSON), accuracy |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Medication -> DoseLog | one-to-many | A medication has many dose logs recording when doses were taken |
| Medication -> Reminder | one-to-many | A medication has many reminders for notification scheduling |
| Medication -> Refill | one-to-many | A medication has many refill records |
| Medication -> SideEffectEntry | one-to-many | A medication has many reported side effects |
| Medication -> MedfriendAlert | one-to-many | A medication can be monitored by multiple Medfriends |
| MoodEntry -> MoodActivity | one-to-many | A mood entry has many tagged activities |
| Symptom -> SymptomLog | one-to-many | A symptom definition has many log entries |
| SymptomLog -> SideEffectEntry | one-to-one | A symptom log can be attributed to a medication as a side effect |
| SymptomLog -> PainEntry | one-to-one | A symptom log can have an associated pain map entry |
| Medfriend -> MedfriendAlert | one-to-many | A Medfriend can monitor multiple medications |
| MedfriendAlert -> MedfriendAlertLog | one-to-many | An alert rule generates many alert delivery logs |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Medication | md_medications_active_idx | isActive | Filter active medications |
| DoseLog | md_dose_logs_med_sched_idx | medicationId, scheduledTime | Adherence calculations and date-range queries |
| Dose (legacy) | md_doses_med_idx | medicationId | Lookup doses by medication |
| Dose (legacy) | md_doses_taken_idx | takenAt | Sort by time |
| Reminder | md_reminders_med_idx | medicationId | Lookup reminders by medication |
| Refill | md_refills_med_idx | medicationId | Lookup refills by medication |
| DrugInteraction | md_interactions_drugs_idx | drugA, drugB | Interaction pair lookup |
| DrugInteraction | md_interactions_pair_idx | drugA, drugB (UNIQUE) | Prevent duplicate pairs |
| HealthMeasurement | md_measurements_type_date_idx | type, measuredAt | Type-specific trend queries |
| MoodEntry | md_mood_entries_recorded_idx | recordedAt | Time-range queries |
| MoodActivity | md_mood_activities_entry_idx | moodEntryId | Lookup activities for entry |
| SymptomLog | md_symptom_logs_symptom_date_idx | symptomId, loggedAt | Symptom-specific time queries |

### 4.5 Table Prefix

**MyLife hub table prefix:** `md_`

All table names in the SQLite database are prefixed with `md_` to avoid collisions with other modules in the MyLife hub. Example: the `medications` table becomes `md_medications`.

### 4.6 Migration Strategy

- **V1 (Initial):** Creates md_medications, md_doses, md_settings with indexes and seed data
- **V2 (Extended):** Creates md_dose_logs, md_reminders, md_refills, md_interactions (+ 50 seeded pairs), md_measurements, md_mood_entries, md_mood_activities, md_symptoms, md_symptom_logs with indexes. Adds pill_count, pills_per_dose, time_slots, end_date columns to md_medications.
- **V3 (Planned):** Creates md_pain_entries, md_food_entries, md_stool_entries, md_medfriends, md_medfriend_alerts, md_medfriend_alert_logs, md_side_effects, md_weather_data, md_risk_profiles. Adds 'spo2', 'respiratory_rate' to md_measurements type CHECK constraint.
- Schema version is tracked in the module's migration array. Migrations are run sequentially on module enable.
- Destructive migrations (column removal) are deferred to major versions only.
- Data from standalone app can be imported via the data importer in the MyLife migration package.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Today | Clock icon | Today Dashboard | Current day's reminders, upcoming doses, risk forecast, quick actions |
| Medications | Pill icon | Medication List | Browse, add, edit, and manage all medications |
| History | Calendar icon | History & Timeline | Adherence calendar, medication timeline, dose history |
| Mood | Heart icon | Mood & Wellness | Mood check-in, mood calendar, symptom log, wellness timeline |
| Settings | Gear icon | Settings | Preferences, Medfriend, export, about |

### 5.2 Navigation Flow

```
[Tab 1: Today]
  +-- Reminder Card -> Medication Detail
  +-- Risk Forecast Card -> Risk Analysis Detail
  +-- Log Symptom -> Symptom Logger
  +-- Log Measurement -> Measurement Logger

[Tab 2: Medications]
  +-- Medication Card -> Medication Detail
  |     +-- Edit Medication (modal)
  |     +-- Schedule / Reminders
  |     +-- Refill Section -> Record Refill (modal)
  |     +-- Interactions Section
  |     +-- Side Effects Section -> Report Side Effect (modal)
  |     +-- Log Dose (manual)
  +-- Add Medication (modal)

[Tab 3: History]
  +-- Adherence Calendar -> Day Detail
  +-- Medication Timeline -> Event Detail
  +-- BP Trends -> BP Trend Chart
  +-- Glucose Dashboard -> HbA1c Estimator

[Tab 4: Mood]
  +-- Mood Check-In (modal)
  +-- Mood Calendar -> Day Detail
  +-- Symptom Logger -> Pain Map
  +-- Correlations -> Correlation Detail
  +-- Wellness Timeline
  +-- Digestive Timeline
  +-- Weather Correlation

[Tab 5: Settings]
  +-- Notification Preferences
  +-- Supply Alert Preferences
  +-- Health Tracking Preferences
  +-- Medfriend Configuration
  +-- Export Data
  +-- Delete All Data
  +-- About
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Today Dashboard | /today | Daily dose reminders, risk forecast | Tab 1, app launch |
| Medication List | /medications | Browse and manage medications | Tab 2 |
| Medication Detail | /medications/:id | View/edit single medication | Tap medication card |
| Add Medication | /medications/add | Create new medication | "+" button on Medication List |
| History | /history | Adherence calendar and timeline | Tab 3 |
| BP Trends | /history/bp-trends | Blood pressure chart | History screen link |
| Glucose Dashboard | /history/glucose | Glucose trends and HbA1c | History screen link |
| Mood Home | /mood | Mood calendar and recent entries | Tab 4 |
| Mood Check-In | /mood/check-in | Log a mood entry | "Check In" button |
| Symptom Logger | /mood/symptoms | Log a symptom | Today screen or Mood tab |
| Pain Map | /mood/pain-map | Mark pain locations on body/head | Symptom Logger link |
| Correlations | /mood/correlations | View medication-mood-symptom correlations | Mood tab |
| Wellness Timeline | /mood/wellness | Multi-metric wellness chart | Mood tab |
| Digestive Timeline | /mood/digestive | Meal-symptom timeline | Mood tab |
| Weather Correlation | /mood/weather | Pressure-symptom chart | Mood tab |
| Risk Analysis | /mood/risk | Predictive risk detail | Today screen forecast card |
| Log Measurement | /measurements/log | Log a health vital | Today screen or direct |
| Log BP | /measurements/bp | Log blood pressure | Measurement type picker |
| Log Glucose | /measurements/glucose | Log blood sugar | Measurement type picker |
| Log Insulin | /measurements/insulin | Log insulin dose | Measurement type picker |
| FODMAP Log | /meals/log | Log a meal with FODMAP data | Mood tab or direct |
| Bristol Log | /stool/log | Log bowel movement | Mood tab or direct |
| Settings | /settings | App preferences | Tab 5 |
| Medfriend Config | /settings/medfriend | Manage caregiver alerts | Settings screen |
| Export Data | /settings/export | Export all data | Settings screen |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| mylife://meds/today | Today Dashboard | None |
| mylife://meds/medications/:id | Medication Detail | id: medication UUID |
| mylife://meds/medications/add | Add Medication | None |
| mylife://meds/mood/check-in | Mood Check-In | None |
| mylife://meds/measurements/bp | Log Blood Pressure | None |
| mylife://meds/measurements/glucose | Log Blood Glucose | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Centralized vitals dashboard | Meds | MyHealth | BP, glucose, SpO2, temp, heart rate, respiratory rate feed into unified health dashboard | On measurement save |
| Fasting impact on blood sugar | Meds | MyFast | Overlay fasting windows on glucose charts | When viewing glucose trends |
| FODMAP-safe recipe filtering | Meds | MyRecipes | Filter recipes by FODMAP category based on user's identified triggers | On recipe search |
| Medication as daily habit | Meds | MyHabits | Surface medication schedules as trackable habits with streak counting | On module enable |
| Food-symptom correlation | Meds | MyNutrition | Cross-reference food log entries with digestive symptom timeline | On correlation request |
| Mood-medication correlation | Meds | MyMood | Expand mood-medication correlation to include adherence rate as a mood factor | On correlation request |
| Sleep-medication correlation | Meds | MyHealth (sleep) | Correlate medication timing with sleep quality metrics | On correlation request |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Medication list | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Dose logs | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Mood entries | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Symptom logs | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Health measurements | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Drug interaction database | Local SQLite | No | No | Bundled reference data, not user data |
| Side effect reports | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Medfriend contacts | Local SQLite | At rest (OS-level) | No | Phone numbers stored locally |
| Weather cache | Local SQLite | No | No | Fetched public data, no user health info |
| User preferences | Local SQLite | No | No | Non-sensitive configuration |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Weather data fetch | Barometric pressure for symptom correlation | Latitude, longitude (geographic coordinates only) | Barometric pressure readings | Explicit opt-in (weather tracking toggle) |
| HealthKit read (iOS) | Import CGM glucose data | None (read-only) | Blood glucose samples | Explicit HealthKit permission dialog |
| Medfriend SMS alert | Notify caregiver of missed dose | Generic text message (no health details) | None | Explicit Medfriend setup by user |

### 7.3 Data That Never Leaves the Device

- Medication names, dosages, and prescriber information
- Dose timing and adherence history
- Blood pressure, glucose, and all vital sign readings
- Mood journal entries and emotional state data
- Symptom severity and frequency data
- Drug interaction check results
- Side effect reports
- Pain location and severity data
- Dietary FODMAP and digestive health data
- Correlation analysis results
- Doctor and therapy reports (generated locally, shared only by user action)

### 7.4 User Data Ownership

- **Export:** Users can export all data in CSV or JSON format via MD-029
- **Delete:** Users can delete all module data via Settings with double confirmation (type "DELETE")
- **Portability:** Export format is documented, human-readable, and includes all user data
- **No vendor lock-in:** Exported data contains no proprietary encoding and can be read by any spreadsheet or text editor

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Medfriend message content | Alert messages contain NO medication names, dosages, or health data | Privacy-critical; see MD-026 business logic |
| HealthKit access | Read-only; MyMeds never writes to HealthKit | Minimizes permission scope |
| Weather data | Only geographic coordinates are sent; no health data accompanies the request | Users can enter coordinates manually to avoid location permission |
| Database encryption | OS-level SQLite encryption via device passcode/biometrics | No additional app-level encryption required |
| Data deletion | Full table drop + recreation on "Delete All Data" | Ensures no orphaned records |
| Medical disclaimer | Settings screen includes: "MyMeds is not a substitute for professional medical advice. Always consult your healthcare provider." | Required for health-related apps |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Adherence | The degree to which a patient follows their prescribed medication schedule. Measured as a percentage of doses taken vs. scheduled. |
| AHA | American Heart Association. Publishes blood pressure classification guidelines. |
| ADA | American Diabetes Association. Publishes blood glucose target ranges. |
| Bristol Stool Scale | A clinically validated 7-type classification system for stool form, used by gastroenterologists worldwide. |
| Burn Rate | The calculated daily pill consumption rate for a medication, based on frequency and pills per dose. |
| CGM | Continuous Glucose Monitor. A wearable device that measures blood glucose every 5 minutes (e.g., Dexcom G7, FreeStyle Libre 3). |
| Correlation Engine | MyMeds' analytical system that calculates statistical relationships between medications, mood, symptoms, and adherence. |
| eAG | Estimated Average Glucose. The mean of blood glucose readings used to estimate HbA1c. |
| FODMAP | Fermentable Oligosaccharides, Disaccharides, Monosaccharides, and Polyols. Short-chain carbohydrates that are poorly absorbed and can trigger digestive symptoms. |
| Grace Period | The configurable time window after a scheduled dose before a Medfriend caregiver alert is triggered. Default: 2 hours. |
| HbA1c | Glycated hemoglobin. A blood test measuring average blood sugar over 2-3 months. Target for most diabetics: < 7.0%. |
| HealthKit | Apple's health data framework on iOS that allows apps to read and write health data with user permission. |
| Hypertensive Crisis | A blood pressure reading above 180/120 mmHg that requires immediate medical evaluation. |
| Lipodystrophy | Fat tissue damage caused by repeated insulin injections at the same body site. Prevented by site rotation. |
| Medfriend | A trusted contact designated by the user to receive alerts when critical medications are missed. Named to emphasize the caring, non-invasive nature of the feature. |
| Pearson Correlation | A statistical measure of the linear relationship between two variables, ranging from -1 (perfect negative) to +1 (perfect positive). Used in the adherence-mood correlation analysis. |
| PRN | Pro re nata (Latin: "as the situation demands"). Medications taken as needed rather than on a fixed schedule. |
| SpO2 | Blood oxygen saturation percentage. Normal range: 95-100%. |
| Trigger | A factor (weather change, food, missed medication, stress) that precedes and may cause a symptom episode. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification covering 30 features (13 implemented, 17 new) |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should the drug interaction severity enum include "contraindicated" as a 4th level? | The design doc mentions it, but the current implementation uses only mild/moderate/severe. Some drug pairs (SSRIs + MAOIs) are truly contraindicated, not just "severe." | Pending | - |
| 2 | Should CGM integration support Android via Google Health Connect? | Current spec is iOS-only via HealthKit. Google Health Connect is the Android equivalent. | Pending | - |
| 3 | Should Medfriend alerts support push notifications via a simple relay service? | Current design uses SMS only, which requires device messaging capability. A lightweight push relay would be more reliable but introduces a server dependency. | Pending | - |
| 4 | Should the weather API be configurable? | Currently hardcoded to Open-Meteo. Users in areas with poor Open-Meteo coverage may want alternatives. | Pending | - |
| 5 | Should the predictive risk analysis support user-defined trigger weights? | Current design auto-calculates weights from historical data. Some users may want to manually boost or reduce the weight of specific triggers based on personal knowledge. | Pending | - |
| 6 | Should the insulin bolus calculator (P3 feature from design doc) be added to this spec? | It was listed as P3 in the design doc. It requires carb ratio and correction factor configuration, which adds complexity. | Deferred to future version | - |
| 7 | Should the FODMAP food database be crowd-sourced or curated? | A curated database of 200+ foods is manageable but limited. Crowd-sourcing is more comprehensive but introduces data quality concerns. | Pending | - |

