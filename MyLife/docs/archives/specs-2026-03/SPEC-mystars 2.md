# MyStars - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (spec-mystars agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyStars
- **Tagline:** Private astrology and birth charts
- **Module ID:** `stars`
- **Feature ID Prefix:** `ST`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Casual Stargazer | Ages 18-30, checks horoscope daily, familiar with sun sign but not deep astrology | Daily horoscope, learn sun/moon/rising, share zodiac profile with friends |
| Dedicated Practitioner | Ages 25-45, studies natal charts and transits, owns astrology books | Full natal chart analysis, transit tracking, aspect calculations, birth chart visualization |
| Compatibility Seeker | Ages 18-35, interested in relationship dynamics, enters friends' and partners' birth data | Zodiac compatibility checks, synastry analysis, element harmony scoring |
| Spiritual Explorer | Ages 20-40, combines astrology with tarot, journaling, and mindfulness practices | Daily tarot card pull, moon phase tracking, lunar cycle alignment for habits and intentions |
| Privacy-Conscious User | Any age, uncomfortable sharing birth data (time, place) with cloud services | Full offline operation, no birth data transmitted, no push notification manipulation |

### 1.3 Core Value Proposition

MyStars is a privacy-first astrology companion that performs all chart calculations, transit tracking, and horoscope generation entirely on-device using bundled ephemeris data. Unlike Co-Star (which harvests birth data and uses anxiety-inducing push notifications) and The Pattern ($120/year with cloud-only processing), MyStars keeps your birth time, birth location, and relationship compatibility data fully local. Birth data is sensitive PII that can be used for identity verification and social engineering. MyStars ensures it never leaves your device.

The app bundles Swiss Ephemeris data (1900-2100, approximately 50MB) for accurate planetary position calculations without any network dependency. Users get natal charts, daily horoscopes, transit tracking, moon phase calendars, tarot card draws, and compatibility analysis with zero cloud processing, zero accounts, and zero telemetry.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Co-Star | Large social network, sleek UI, real-time push notifications | Manipulative notifications designed to create anxiety, harvests birth data to servers, limited free features | No manipulative notifications, all data stays on device, no engagement-bait psychology |
| Nebula | Detailed natal charts, transit tracking, professional astrologer content | $50/year subscription, cloud-only calculations, requires account | Offline-first calculations, no subscription required for core features, no account needed |
| The Pattern | Deep personality analysis, relationship compatibility, unique algorithmic approach | $120/year premium, opaque "algorithm" (not traditional astrology), collects detailed personal and relationship data | Transparent traditional astrology methods, privacy-first, fraction of competitor pricing |
| TimePassages | Accurate Swiss Ephemeris calculations, educational content | Outdated UI, desktop-first design, limited mobile experience | Modern mobile-first UI, same calculation accuracy via Swiss Ephemeris, cross-platform |
| Stardust | Moon phase tracking, clean design, daily horoscopes | Limited chart depth, cloud-dependent, subscription model | Full chart depth with offline calculations, one-time purchase option |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device in the shared SQLite database
- Zero analytics, zero telemetry, zero tracking
- No account required for any functionality
- Users own their data with full export (JSON, CSV) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export
- Birth data (date, time, location) is sensitive PII and is never transmitted to any server
- All planetary position calculations use bundled ephemeris data (no API calls)
- No push notifications or engagement manipulation tactics
- Compatibility analysis stays fully on-device; relationship graphs are never harvested
- Tarot card draws use a local pseudorandom number generator seeded from device entropy
- Location input for birth place uses coordinate entry or a local gazetteer; no geocoding API calls are required

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| ST-001 | Birth Profile Management | P0 | Core | None | Not Started |
| ST-002 | Natal Chart Calculation | P0 | Core | ST-001 | Not Started |
| ST-003 | Sun/Moon/Rising Display | P0 | Core | ST-002 | Not Started |
| ST-004 | Planet Position Calculator | P0 | Core | ST-002 | Not Started |
| ST-005 | Daily Horoscope Generation | P0 | Core | ST-002, ST-004 | Not Started |
| ST-006 | Birth Chart Visualization | P1 | Analytics | ST-002 | Not Started |
| ST-007 | Zodiac Compatibility (Synastry) | P1 | Core | ST-001, ST-002 | Not Started |
| ST-008 | Planetary Transit Tracking | P1 | Analytics | ST-002, ST-004 | Not Started |
| ST-009 | Moon Phase Calendar | P1 | Analytics | ST-004 | Not Started |
| ST-010 | Aspect Calculations | P1 | Core | ST-002, ST-004 | Not Started |
| ST-011 | Personality Insights | P1 | Analytics | ST-002, ST-003 | Not Started |
| ST-012 | Birth Chart Explanations | P1 | Onboarding | ST-002, ST-003 | Not Started |
| ST-013 | Zodiac Events Calendar | P1 | Analytics | ST-004, ST-008 | Not Started |
| ST-014 | Retrograde Alerts | P2 | Analytics | ST-004, ST-008 | Not Started |
| ST-015 | Tarot Card of the Day | P2 | Core | None | Not Started |
| ST-016 | Celestial Events Calendar | P2 | Analytics | ST-004 | Not Started |
| ST-017 | Astrology Journal | P2 | Data Management | ST-008 | Not Started |
| ST-018 | Solar Return Chart | P2 | Analytics | ST-002, ST-004 | Not Started |
| ST-019 | Progressed Chart | P2 | Analytics | ST-002, ST-004 | Not Started |
| ST-020 | Data Export (JSON/CSV) | P1 | Import/Export | ST-001 | Not Started |
| ST-021 | Settings and Preferences | P0 | Settings | None | Not Started |
| ST-022 | Onboarding and First-Run | P1 | Onboarding | ST-001, ST-002 | Not Started |

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

### ST-001: Birth Profile Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-001 |
| **Feature Name** | Birth Profile Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Casual Stargazer, I want to enter my birth date, time, and location, so that I can generate my natal chart and discover my astrological profile.

**Secondary:**
> As a Compatibility Seeker, I want to save multiple birth profiles for my friends and family, so that I can compare our charts and check zodiac compatibility.

**Tertiary:**
> As a Privacy-Conscious User, I want assurance that my birth data is stored only on my device, so that I do not risk exposing sensitive PII to cloud services.

#### 3.3 Detailed Description

Birth Profile Management is the foundational feature of MyStars. Every astrological calculation, from natal charts to daily horoscopes to compatibility analysis, depends on having accurate birth data. This feature provides the interface for creating, editing, and managing birth profiles.

A birth profile consists of three core data points: birth date, birth time, and birth location. Birth date and birth time determine the positions of celestial bodies at the moment of birth, while birth location determines the house system and rising sign calculation. Birth time is optional but strongly recommended; without it, the system cannot calculate houses or the rising sign and must clearly communicate this limitation to the user.

Birth location input uses a local gazetteer (a bundled database of cities with latitude, longitude, and timezone data) rather than an online geocoding API. This preserves the offline-first privacy guarantee. The gazetteer includes approximately 40,000 populated places worldwide with populations above 15,000, plus all county seats and state capitals regardless of population. Users can also enter coordinates manually for locations not in the gazetteer.

Users can create a primary profile (their own birth data) and up to 50 additional profiles for other people. Each profile is labeled with a name and optional relationship tag (friend, partner, family, celebrity, other). The primary profile is distinguished in the UI and is the default subject for natal charts, horoscopes, and transit tracking. Additional profiles are used for compatibility analysis and comparative chart viewing.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the root feature)

**External Dependencies:**
- Local storage for persisting profile data
- Bundled gazetteer database for location lookup (approximately 40,000 entries, roughly 3MB compressed)

**Assumed Capabilities:**
- User can navigate between screens via the module tab bar
- Local database is initialized and writable
- Module has been enabled in the MyLife hub

#### 3.5 User Interface Requirements

##### Screen: Profile List

**Layout:**
- The screen has a top navigation bar showing the title "Profiles" and an "Add" button on the right
- If a primary profile exists, it is displayed as a prominent card at the top of the screen showing the user's name, sun sign glyph, and sun/moon/rising summary line (e.g., "Aries Sun, Cancer Moon, Leo Rising")
- Below the primary profile card, a section header reads "Other Profiles" followed by a scrollable vertical list of saved profiles
- Each list item displays: profile name, relationship tag, sun sign glyph, and date of birth formatted as the user's locale date
- Tapping an item navigates to the Profile Detail screen
- A floating action button (or the top-right "Add" button) opens the Add/Edit Profile screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No profiles exist | Illustration of a constellation with the message "Add your birth data to begin" and a prominent "Create Your Profile" button |
| Primary Only | Only the primary profile exists | Primary card displayed; "Other Profiles" section shows a message "Add friends and family to check compatibility" with a small add button |
| Populated | One or more profiles exist | Primary card at top, list of other profiles below |
| Error | Database read fails | Inline error message: "Could not load profiles. Please try again." with a retry button |

**Interactions:**
- Tap on primary profile card: navigates to Profile Detail for the primary profile
- Tap on a list item: navigates to Profile Detail for that profile
- Swipe left on a list item: reveals "Delete" action (with confirmation dialog)
- Long press on a list item: opens a context menu with "Edit", "Set as Primary", and "Delete" options
- Tap "Add" button: navigates to Add/Edit Profile screen in create mode

**Transitions/Animations:**
- Profile cards fade in with a 150ms stagger when the list loads
- Deleted items slide out to the left with a 200ms animation
- New items animate in from the top with a 200ms slide-down

##### Screen: Add/Edit Profile

**Layout:**
- The screen has a top navigation bar with a "Cancel" button on the left and a "Save" button on the right (disabled until required fields are filled)
- The title reads "New Profile" (create mode) or "Edit Profile" (edit mode)
- Form fields are arranged vertically:
  1. **Name** - text input, required, placeholder "Your name" or "Their name"
  2. **Relationship** - segmented control or chip selector: "Me", "Partner", "Friend", "Family", "Celebrity", "Other"
  3. **Birth Date** - date picker, required, constrained to dates between January 1, 1900 and the current date
  4. **Birth Time** - time picker, optional, 24-hour or 12-hour format based on user locale; a toggle "I don't know my birth time" sets this to null
  5. **Birth Location** - search input that filters the local gazetteer; displays matching cities with country and region; alternatively, a "Use Coordinates" toggle reveals latitude and longitude numeric inputs
- Below the form, a note reads: "Birth time is needed for rising sign and house calculations. Without it, some chart features are limited."
- In edit mode, a "Delete Profile" button appears at the bottom in a destructive style (red text)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Form | Create mode, no fields filled | All fields empty with placeholder text, Save button disabled |
| Partially Filled | Some required fields filled | Validation messages appear for missing required fields when Save is tapped |
| Valid Form | All required fields filled | Save button enabled |
| Location Search Active | User is typing in location field | Dropdown list of matching gazetteer entries appears below the field, maximum 10 results |
| Location Not Found | No gazetteer matches | Message "City not found. Use coordinates instead." with a link to toggle coordinate entry |
| Edit Mode | Existing profile being edited | All fields pre-populated with current values |

**Interactions:**
- Tap "Save": validates all fields, saves the profile, navigates back to Profile List
- Tap "Cancel": shows confirmation dialog if any field has been modified ("Discard changes?"), otherwise navigates back
- Tap location search result: populates the location field with the selected city name and stores latitude, longitude, and timezone
- Toggle "I don't know my birth time": hides the time picker and sets birth_time to null
- Toggle "Use Coordinates": replaces location search with latitude (-90 to 90) and longitude (-180 to 180) numeric inputs
- Tap "Delete Profile": shows confirmation dialog "Delete [name]'s profile? This cannot be undone." with "Delete" and "Cancel" buttons

**Transitions/Animations:**
- Location search dropdown animates in with a 150ms slide-down
- Time picker visibility toggles with a 200ms height animation
- Coordinate inputs swap in place of location search with a 200ms crossfade

#### 3.6 Data Requirements

##### Entity: BirthProfile

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the profile |
| name | string | Required, max 100 chars, not blank after trimming | None | Display name for the profile |
| relationship | enum | One of: self, partner, friend, family, celebrity, other | other | Relationship tag for categorization |
| is_primary | boolean | Only one profile can have is_primary=true at a time | false | Whether this is the user's own profile |
| birth_date | string | Required, ISO 8601 date (YYYY-MM-DD), between 1900-01-01 and current date | None | Date of birth |
| birth_time | string | ISO 8601 time (HH:MM), nullable | null | Time of birth; null means unknown |
| birth_time_known | boolean | - | true | Whether the user confirmed they know their birth time |
| location_name | string | Max 200 chars | null | Display name of birth location (e.g., "San Francisco, CA, USA") |
| latitude | float | Min: -90.0, Max: 90.0 | null | Birth location latitude in decimal degrees |
| longitude | float | Min: -180.0, Max: 180.0 | null | Birth location longitude in decimal degrees |
| timezone | string | IANA timezone identifier (e.g., "America/Los_Angeles"), max 50 chars | null | Timezone of birth location at time of birth |
| notes | string | Max 500 chars | null | Optional notes about the profile |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- BirthProfile is referenced by NatalChart (one-to-one; each profile can have one computed natal chart cache)
- BirthProfile is referenced by CompatibilityResult (many-to-many; compatibility is computed between two profiles)

**Indexes:**
- is_primary - fast lookup of the user's own profile
- relationship - filtering profiles by relationship type
- name - alphabetical sorting and search

**Validation Rules:**
- name: must not be empty string after trimming whitespace
- birth_date: must be a valid date, must not be in the future, must be on or after 1900-01-01
- birth_time: if provided, must be a valid time in HH:MM format (00:00 to 23:59)
- latitude: if provided, must be between -90.0 and 90.0 (inclusive)
- longitude: if provided, must be between -180.0 and 180.0 (inclusive)
- latitude and longitude must both be present or both be null
- timezone: if latitude/longitude are provided, timezone should be derived from the gazetteer or manually specified
- is_primary: setting a profile as primary must unset is_primary on any other profile (database-level constraint or application-level enforcement)
- Maximum 51 profiles total (1 primary + 50 additional)

**Example Data:**

```
{
  "id": "b7e3f1a2-9c4d-4e8f-a1b2-c3d4e5f60001",
  "name": "Alex",
  "relationship": "self",
  "is_primary": true,
  "birth_date": "1995-03-21",
  "birth_time": "14:30",
  "birth_time_known": true,
  "location_name": "San Francisco, CA, USA",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "timezone": "America/Los_Angeles",
  "notes": null,
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-01T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Profile Primary Assignment

**Purpose:** Ensures exactly zero or one profile is marked as primary at any time.

**Inputs:**
- profile_id: string - the profile to set as primary
- current_profiles: list of BirthProfile - all existing profiles

**Logic:**

```
1. Find the currently primary profile (where is_primary = true)
2. IF a currently primary profile exists AND its id differs from profile_id THEN
     Set the current primary's is_primary to false
3. Set the target profile's is_primary to true
4. RETURN the updated profile
```

**Edge Cases:**
- Setting a profile as primary when it is already primary: no-op, return profile unchanged
- Deleting the primary profile: no other profile is auto-promoted; the user must manually set a new primary
- Creating the very first profile: if relationship is "self", auto-set is_primary to true

##### Profile Limit Enforcement

**Purpose:** Prevents exceeding the 51-profile cap.

**Inputs:**
- current_count: integer - number of existing profiles

**Logic:**

```
1. IF current_count >= 51 THEN
     REJECT the creation with message "Maximum of 51 profiles reached. Delete an existing profile to add a new one."
2. ELSE
     ALLOW creation
```

**Edge Cases:**
- Exactly 51 profiles: creation is blocked
- Importing profiles that would exceed the cap: import stops at the cap and reports how many were skipped

##### Gazetteer Search

**Purpose:** Provides location lookup from the bundled city database without network access.

**Inputs:**
- query: string - user's search text, minimum 2 characters

**Logic:**

```
1. Normalize the query: lowercase, remove diacritics, trim whitespace
2. Search the gazetteer for entries where the normalized city name starts with the normalized query
3. If fewer than 3 results, also search for entries where the normalized city name contains the normalized query
4. Sort results by population descending (larger cities appear first)
5. Return the top 10 results, each with: city_name, region/state, country, latitude, longitude, timezone
```

**Edge Cases:**
- Query shorter than 2 characters: return empty results
- No matches found: return empty results with a suggestion to use coordinate entry
- Multiple cities with the same name: all are returned, disambiguated by region/state and country

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Required field left blank on save | Inline validation message below the field: "This field is required" | User fills in the field; error clears on input |
| Birth date in the future | Inline validation: "Birth date cannot be in the future" | User selects a valid date |
| Birth date before 1900 | Inline validation: "Dates before 1900 are not supported" | User selects a valid date |
| Invalid coordinates entered | Inline validation: "Latitude must be between -90 and 90" or "Longitude must be between -180 and 180" | User corrects the value |
| Profile limit reached (51) | Toast notification: "Maximum of 51 profiles reached. Delete a profile to add a new one." | User deletes an existing profile first |
| Database write fails | Toast notification: "Could not save profile. Please try again." | User taps Save again; if persistent, suggest restarting the app |
| Gazetteer database missing or corrupt | Location search shows: "Location search unavailable. Use coordinates instead." with coordinate entry auto-enabled | User enters coordinates manually |
| Duplicate profile name | Warning (non-blocking): "A profile named '[name]' already exists. Save anyway?" | User confirms or renames |

**Validation Timing:**
- Field-level validation runs on blur (when the user leaves the field)
- Form-level validation runs on Save tap
- Profile limit check runs before opening the Add Profile screen

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** no profiles exist,
   **When** the user taps "Create Your Profile" and enters name "Alex", birth date "1995-03-21", birth time "14:30", and selects "San Francisco, CA, USA" from the location search,
   **Then** a profile is created with is_primary=true, the Profile List shows the primary card with "Alex" and the computed sun sign glyph.

2. **Given** a primary profile exists,
   **When** the user taps "Add" and creates a profile with name "Jordan", relationship "Friend", and valid birth data,
   **Then** the new profile appears in the "Other Profiles" list below the primary card.

3. **Given** a profile exists with birth time "14:30",
   **When** the user edits the profile and toggles "I don't know my birth time",
   **Then** birth_time is set to null, birth_time_known is set to false, and any features dependent on birth time (rising sign, houses) display a message indicating limited data.

4. **Given** multiple profiles exist,
   **When** the user long-presses a non-primary profile and selects "Set as Primary",
   **Then** the selected profile becomes the primary (is_primary=true) and the previous primary loses its primary status.

**Edge Cases:**

5. **Given** 51 profiles already exist,
   **When** the user taps "Add",
   **Then** a toast notification displays "Maximum of 51 profiles reached. Delete a profile to add a new one." and the Add Profile screen does not open.

6. **Given** the user is in Add Profile and the gazetteer has no match for "Xyzzyville",
   **When** the user types "Xyzzyville" in the location search,
   **Then** the dropdown shows "City not found. Use coordinates instead." and the user can toggle to coordinate entry.

**Negative Tests:**

7. **Given** the user is on the Add Profile screen,
   **When** the user taps Save without entering a name or birth date,
   **Then** inline validation errors appear for both fields ("This field is required") and no profile is saved.

8. **Given** a profile has been modified in edit mode,
   **When** the user taps "Cancel",
   **Then** a confirmation dialog appears: "Discard changes?" with "Discard" and "Keep Editing" options, and no data is saved if the user confirms discard.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates profile with valid data | name: "Alex", birth_date: "1995-03-21", birth_time: "14:30", lat: 37.77, lng: -122.42 | Profile created with all fields set correctly |
| rejects empty name | name: "   " (whitespace only) | Validation error: "This field is required" |
| rejects future birth date | birth_date: "2030-01-01" | Validation error: "Birth date cannot be in the future" |
| rejects birth date before 1900 | birth_date: "1899-12-31" | Validation error: "Dates before 1900 are not supported" |
| accepts null birth time | birth_time: null, birth_time_known: false | Profile created with birth_time null |
| rejects latitude out of range | latitude: 91.0 | Validation error: "Latitude must be between -90 and 90" |
| rejects longitude out of range | longitude: -181.0 | Validation error: "Longitude must be between -180 and 180" |
| enforces profile limit | current_count: 51, new profile data | Rejection: "Maximum of 51 profiles reached" |
| sets first self profile as primary | relationship: "self", no existing profiles | is_primary set to true |
| unsets previous primary when new primary is set | existing primary id: "A", new primary id: "B" | Profile A: is_primary=false, Profile B: is_primary=true |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create and retrieve profile | 1. Create profile with all fields, 2. Query profile by id | Retrieved profile matches all saved field values |
| Edit profile and verify update | 1. Create profile, 2. Edit name and birth time, 3. Retrieve profile | Updated fields reflect new values, updated_at is newer than created_at |
| Delete profile and verify removal | 1. Create profile, 2. Delete profile, 3. Query all profiles | Deleted profile is not in the results |
| Gazetteer search returns results | 1. Search for "San Fran" | Results include "San Francisco, CA, USA" with correct lat/lng/timezone |
| Primary reassignment | 1. Create profile A (primary), 2. Create profile B, 3. Set B as primary, 4. Retrieve A | A has is_primary=false, B has is_primary=true |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user creates their first profile | 1. Open MyStars (empty state), 2. Tap "Create Your Profile", 3. Enter name, date, time, location, 4. Save | Profile List shows primary card with name and sun sign, empty state is gone |
| User adds a friend's profile for compatibility | 1. From Profile List, tap Add, 2. Enter friend's name and birth data, 3. Set relationship to "Friend", 4. Save | Friend appears in "Other Profiles" list; compatibility feature can now use both profiles |

---

### ST-002: Natal Chart Calculation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-002 |
| **Feature Name** | Natal Chart Calculation |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Dedicated Practitioner, I want to compute a full natal chart from my birth data, so that I can see the positions of all planets, houses, and angles at the moment of my birth.

**Secondary:**
> As a Casual Stargazer, I want to see which zodiac signs my planets are in, so that I can understand my astrological makeup beyond just my sun sign.

#### 3.3 Detailed Description

Natal Chart Calculation is the computational engine at the heart of MyStars. Given a birth profile (date, time, location), this feature computes the positions of all major celestial bodies in the tropical zodiac, determines house placements using the Placidus house system, and calculates the Ascendant (rising sign), Midheaven (MC), Descendant (DC), and Imum Coeli (IC).

The calculation uses Swiss Ephemeris data bundled with the application. Swiss Ephemeris is an open-source high-precision astronomical calculation library that provides planetary positions accurate to sub-arcsecond precision. The bundled data covers the date range 1900-2100, stored as binary ephemeris files totaling approximately 50MB. No network access is required for any calculation.

The celestial bodies computed are: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, and Pluto. Optional bodies (configurable in settings) include Chiron, the North Node (True Node), and Lilith (Black Moon). Each body's position is expressed as a zodiac sign (one of 12), degree within that sign (0-29), and minute of arc (0-59).

House calculation requires birth time. If birth time is unknown, the system uses a solar sign (whole-sign) house system where the 1st house begins at 0 degrees of the sun sign. The system clearly indicates when whole-sign houses are being used due to missing birth time.

The computed natal chart is cached in the database to avoid recalculation on every view. The cache is invalidated only when the associated birth profile is edited.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-001: Birth Profile Management - natal chart requires birth data to compute

**External Dependencies:**
- Bundled Swiss Ephemeris data files (approximately 50MB, covering 1900-2100)
- Sufficient device storage for ephemeris data
- CPU capability for trigonometric and astronomical calculations (typically completes in under 500ms on modern devices)

**Assumed Capabilities:**
- Birth profile exists with at minimum birth_date, latitude, and longitude
- Ephemeris data files are accessible from the application bundle

#### 3.5 User Interface Requirements

##### Screen: Natal Chart Summary

**Layout:**
- The screen has a top navigation bar showing the profile name and a gear icon for chart settings
- The top section displays a summary banner with the profile name, birth date, and birth location
- If birth time is unknown, a subtle warning banner appears: "Birth time unknown. Rising sign and house positions are approximate."
- Below the banner, a horizontally scrollable card row shows the "Big Three": Sun sign, Moon sign, and Rising sign (or "Unknown" for Rising if birth time is missing), each in a card with the zodiac glyph, sign name, and degree
- Below the Big Three, a section titled "Planet Positions" displays a vertical list of all computed celestial bodies
- Each planet row shows: planet glyph/icon, planet name, zodiac sign glyph, zodiac sign name, degree and minute (e.g., "15 degrees 42 minutes"), and house number (e.g., "House 7")
- Below the planet list, a section titled "Houses" shows the 12 house cusps, each with its zodiac sign and degree
- Below the houses, a section titled "Angles" shows: Ascendant (ASC), Midheaven (MC), Descendant (DC), and Imum Coeli (IC) with their zodiac sign and degree
- A "View Chart" button at the bottom navigates to the Birth Chart Visualization (ST-006)
- A "What Does This Mean?" link navigates to Birth Chart Explanations (ST-012)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loading | Chart is being computed for the first time | Animated constellation/stars loading indicator with text "Calculating your natal chart..." |
| Computed | Chart data is available (cached or freshly computed) | Full chart summary as described above |
| No Birth Time | Profile has birth_time = null | Warning banner displayed, Rising sign shows "Unknown", house positions use whole-sign system with a note |
| Computation Error | Ephemeris data missing or calculation fails | Error screen: "Could not calculate chart. Please check that birth data is correct." with retry button |

**Interactions:**
- Tap a planet row: expands inline to show a brief 2-3 sentence interpretation of that placement
- Tap the "Big Three" cards: navigates to the Sun/Moon/Rising Display screen (ST-003)
- Tap "View Chart": navigates to the visual chart wheel (ST-006)
- Tap "What Does This Mean?": navigates to educational explanations (ST-012)
- Pull-to-refresh: recalculates the chart (invalidates cache)

**Transitions/Animations:**
- Planet rows stagger in with a 50ms delay between each, sliding up from the bottom
- Big Three cards fade in simultaneously with a 200ms animation
- Expanding a planet row for its interpretation uses a 200ms height animation

#### 3.6 Data Requirements

##### Entity: NatalChart

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the chart |
| profile_id | string | Foreign key to BirthProfile.id, unique (one chart per profile) | None | The birth profile this chart is computed from |
| computed_at | datetime | Auto-set when computed | Current timestamp | When the chart was last calculated |
| julian_day | float | Computed from birth date and time | None | Julian Day Number used in astronomical calculations |
| sidereal_time | float | Computed from JD and longitude | None | Local Sidereal Time at birth location |
| house_system | enum | One of: placidus, whole_sign | placidus | House system used (whole_sign if birth time unknown) |
| ascendant_longitude | float | 0.0 to 359.999 | None | Ecliptic longitude of the Ascendant in decimal degrees |
| midheaven_longitude | float | 0.0 to 359.999 | None | Ecliptic longitude of the Midheaven in decimal degrees |
| descendant_longitude | float | 0.0 to 359.999 | None | Ecliptic longitude of the Descendant (ASC + 180) |
| ic_longitude | float | 0.0 to 359.999 | None | Ecliptic longitude of the Imum Coeli (MC + 180) |
| obliquity | float | Typically near 23.44 | None | Obliquity of the ecliptic at birth time in decimal degrees |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: PlanetPosition

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| chart_id | string | Foreign key to NatalChart.id | None | The natal chart this position belongs to |
| body | enum | One of: sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto, chiron, north_node, lilith | None | The celestial body |
| longitude | float | 0.0 to 359.999 | None | Ecliptic longitude in decimal degrees |
| latitude | float | -90.0 to 90.0 | None | Ecliptic latitude in decimal degrees |
| speed | float | Any float | None | Daily motion in degrees per day (negative = retrograde) |
| is_retrograde | boolean | Derived from speed < 0 | false | Whether the body is in retrograde motion |
| zodiac_sign | enum | One of: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces | None | Zodiac sign derived from longitude |
| sign_degree | integer | 0 to 29 | None | Degree within the zodiac sign |
| sign_minute | integer | 0 to 59 | None | Minute of arc within the degree |
| house_number | integer | 1 to 12, nullable | None | House placement (null if houses not calculable) |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

##### Entity: HouseCusp

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| chart_id | string | Foreign key to NatalChart.id | None | The natal chart this cusp belongs to |
| house_number | integer | 1 to 12 | None | House number |
| cusp_longitude | float | 0.0 to 359.999 | None | Ecliptic longitude of the house cusp in decimal degrees |
| zodiac_sign | enum | One of: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces | None | Zodiac sign of the cusp |
| sign_degree | integer | 0 to 29 | None | Degree within the zodiac sign |
| sign_minute | integer | 0 to 59 | None | Minute of arc within the degree |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- NatalChart belongs to BirthProfile (one-to-one via profile_id)
- NatalChart has many PlanetPosition (one-to-many via chart_id)
- NatalChart has many HouseCusp (one-to-many via chart_id; always exactly 12)

**Indexes:**
- NatalChart: profile_id (unique, fast lookup by profile)
- PlanetPosition: chart_id (retrieve all positions for a chart)
- PlanetPosition: (chart_id, body) unique (prevent duplicate body entries)
- HouseCusp: chart_id (retrieve all cusps for a chart)
- HouseCusp: (chart_id, house_number) unique (prevent duplicate house entries)

**Validation Rules:**
- longitude: must be between 0.0 (inclusive) and 360.0 (exclusive)
- zodiac_sign must match the longitude: sign = floor(longitude / 30), mapped to the zodiac order starting from Aries
- sign_degree must equal floor(longitude mod 30)
- sign_minute must equal floor((longitude mod 1) * 60)
- house_number: 1-12 for HouseCusp, 1-12 or null for PlanetPosition
- Each NatalChart must have exactly 10 PlanetPosition rows (core bodies) plus 0-3 optional bodies
- Each NatalChart must have exactly 12 HouseCusp rows

**Example Data:**

```
{
  "id": "c1d2e3f4-5678-90ab-cdef-123456789002",
  "profile_id": "b7e3f1a2-9c4d-4e8f-a1b2-c3d4e5f60001",
  "computed_at": "2026-03-01T10:00:05Z",
  "julian_day": 2450174.1042,
  "sidereal_time": 18.3742,
  "house_system": "placidus",
  "ascendant_longitude": 148.75,
  "midheaven_longitude": 52.33,
  "descendant_longitude": 328.75,
  "ic_longitude": 232.33,
  "obliquity": 23.4393
}
```

```
{
  "id": "p1-sun",
  "chart_id": "c1d2e3f4-5678-90ab-cdef-123456789002",
  "body": "sun",
  "longitude": 0.35,
  "latitude": 0.0,
  "speed": 1.0136,
  "is_retrograde": false,
  "zodiac_sign": "aries",
  "sign_degree": 0,
  "sign_minute": 21,
  "house_number": 7
}
```

#### 3.7 Business Logic Rules

##### Julian Day Calculation

**Purpose:** Converts a calendar date and time into a Julian Day Number for use in astronomical calculations.

**Inputs:**
- year: integer - birth year (1900-2100)
- month: integer - birth month (1-12)
- day: integer - birth day (1-31)
- hour: float - birth hour in UTC (0.0 to 23.999), derived from birth_time and timezone

**Logic:**

```
1. Convert birth_time from local time to UTC using the timezone from the birth profile
2. IF month <= 2 THEN
     year = year - 1
     month = month + 12
3. A = floor(year / 100)
4. B = 2 - A + floor(A / 4)
5. JD = floor(365.25 * (year + 4716)) + floor(30.6001 * (month + 1)) + day + (hour / 24.0) + B - 1524.5
6. RETURN JD
```

**Edge Cases:**
- Birth time unknown: use 12:00:00 local time (noon) as a convention; document this assumption
- Dates before the Gregorian calendar adoption (October 15, 1582): not supported (minimum date is 1900)
- Leap seconds: ignored (precision of seconds is not required for astrological calculations)

##### Zodiac Sign from Longitude

**Purpose:** Determines the zodiac sign, degree, and minute from an ecliptic longitude.

**Inputs:**
- longitude: float - ecliptic longitude in decimal degrees (0.0 to 359.999)

**Logic:**

```
1. sign_index = floor(longitude / 30)
2. sign_names = [aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces]
3. zodiac_sign = sign_names[sign_index]
4. degrees_in_sign = longitude mod 30
5. sign_degree = floor(degrees_in_sign)
6. sign_minute = floor((degrees_in_sign - sign_degree) * 60)
7. RETURN { zodiac_sign, sign_degree, sign_minute }
```

**Edge Cases:**
- longitude = 0.0: Aries 0 degrees 0 minutes
- longitude = 359.999: Pisces 29 degrees 59 minutes
- longitude = 30.0: Taurus 0 degrees 0 minutes (boundary between Aries and Taurus)

##### House Placement

**Purpose:** Determines which house a planet falls in based on house cusp longitudes.

**Inputs:**
- planet_longitude: float - ecliptic longitude of the planet (0.0 to 359.999)
- house_cusps: array of 12 floats - ecliptic longitudes of house cusps (1-12)

**Logic:**

```
1. FOR house_number FROM 1 TO 12:
     current_cusp = house_cusps[house_number]
     next_cusp = house_cusps[(house_number mod 12) + 1]
     IF next_cusp < current_cusp THEN
       // House spans 0 degrees (e.g., cusp at 350, next at 10)
       IF planet_longitude >= current_cusp OR planet_longitude < next_cusp THEN
         RETURN house_number
     ELSE
       IF planet_longitude >= current_cusp AND planet_longitude < next_cusp THEN
         RETURN house_number
2. RETURN 1  // Fallback (should not occur with valid data)
```

**Edge Cases:**
- Planet exactly on a house cusp: belongs to the house that cusp starts (e.g., planet at House 7 cusp belongs to House 7)
- Houses that span the 0-degree point (Aries point): handled by the wrap-around check in the logic

##### Whole-Sign House Fallback

**Purpose:** Computes houses using whole-sign system when birth time is unknown.

**Inputs:**
- sun_longitude: float - ecliptic longitude of the Sun

**Logic:**

```
1. sun_sign_index = floor(sun_longitude / 30)
2. FOR house_number FROM 1 TO 12:
     cusp_sign_index = (sun_sign_index + house_number - 1) mod 12
     house_cusps[house_number] = cusp_sign_index * 30.0
3. RETURN house_cusps
```

**Edge Cases:**
- This is an approximation and should be clearly labeled in the UI as "Whole-Sign Houses (birth time unknown)"

##### Cache Invalidation

**Purpose:** Ensures natal chart is recalculated when birth profile data changes.

**Inputs:**
- profile_id: string - the profile that was edited
- changed_fields: list of string - which fields were modified

**Logic:**

```
1. relevant_fields = [birth_date, birth_time, birth_time_known, latitude, longitude, timezone]
2. IF any field in changed_fields is in relevant_fields THEN
     Delete the cached NatalChart for profile_id (cascade deletes PlanetPositions and HouseCusps)
     Mark the chart as needing recalculation
3. ELSE
     No action needed (name, relationship, notes changes do not affect the chart)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Ephemeris data files missing from app bundle | Error screen: "Astronomical data files are missing. Please reinstall the app." | User reinstalls the app to restore bundled data |
| Birth date outside ephemeris range (before 1900 or after 2100) | Error message: "Chart calculations are available for birth dates between 1900 and 2100." | User corrects the birth date in the profile |
| Calculation produces invalid longitude (NaN or out of range) | Error screen: "Could not calculate chart. Please verify your birth data." with a link to edit the profile | User reviews and corrects birth data |
| Placidus house calculation fails at extreme latitudes (above 66.5 N/S) | Warning: "Placidus houses cannot be calculated for polar latitudes. Using whole-sign houses instead." | System falls back to whole-sign houses automatically |
| Database write fails when caching computed chart | Silent retry (up to 3 attempts). If all fail, chart is displayed but not cached; next view recalculates. | Automatic retry on next view |
| Insufficient memory for calculation | Error screen: "Not enough memory to calculate chart. Close other apps and try again." | User frees memory and retries |

**Validation Timing:**
- Profile data validation occurs before calculation begins
- Ephemeris data availability is checked at module initialization
- Calculation results are validated (longitude ranges, sign consistency) before caching

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a profile exists with birth date "1995-03-21", birth time "14:30", location "San Francisco, CA" (37.7749, -122.4194, America/Los_Angeles),
   **When** the user opens the Natal Chart Summary screen,
   **Then** the chart is computed showing 10 planet positions (Sun through Pluto), each with a zodiac sign, degree, minute, and house number; the Ascendant, Midheaven, Descendant, and IC are displayed with their zodiac positions; and 12 house cusps are listed.

2. **Given** a computed natal chart is cached for a profile,
   **When** the user navigates to the Natal Chart Summary screen again,
   **Then** the cached chart is displayed immediately without recalculation (no loading indicator).

3. **Given** a cached chart exists and the user edits the profile's birth time,
   **When** the user returns to the Natal Chart Summary,
   **Then** the cache is invalidated and the chart is recalculated with the updated birth time.

**Edge Cases:**

4. **Given** a profile has birth_time = null (unknown),
   **When** the Natal Chart is computed,
   **Then** the system uses whole-sign houses, displays a warning banner about limited accuracy, and shows "Unknown" for the Rising sign.

5. **Given** a profile has a birth location at latitude 70.0 (within the Arctic),
   **When** the Natal Chart is computed,
   **Then** the system falls back to whole-sign houses and displays a warning about polar latitude limitations.

**Negative Tests:**

6. **Given** a profile exists but ephemeris data files are missing,
   **When** the chart calculation is attempted,
   **Then** an error screen is displayed: "Astronomical data files are missing. Please reinstall the app."
   **And** no partial or incorrect chart data is saved.

7. **Given** a profile with birth date "1850-06-15" (outside ephemeris range),
   **When** the chart calculation is attempted,
   **Then** the system displays "Chart calculations are available for birth dates between 1900 and 2100."
   **And** no chart data is computed or cached.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes Julian Day for known date | 2000-01-01 12:00 UTC | JD = 2451545.0 (J2000.0 epoch) |
| computes Julian Day for March equinox | 1995-03-21 14:30 PST (22:30 UTC) | Correct JD value |
| derives zodiac sign from longitude 0.0 | longitude: 0.0 | Aries 0 degrees 0 minutes |
| derives zodiac sign from longitude 30.0 | longitude: 30.0 | Taurus 0 degrees 0 minutes |
| derives zodiac sign from longitude 359.99 | longitude: 359.99 | Pisces 29 degrees 59 minutes |
| derives zodiac sign from longitude 120.5 | longitude: 120.5 | Leo 0 degrees 30 minutes |
| determines house placement (no wrap) | planet: 45.0, cusps: [30, 60, 90, ...] | House 1 |
| determines house placement (wraps around 0) | planet: 355.0, cusps: [..., 340, 10] | House 12 |
| uses whole-sign houses when birth time unknown | sun_longitude: 15.0 (Aries) | House 1 cusp at 0 degrees, House 2 at 30 degrees, etc. |
| invalidates cache on birth_time change | changed_fields: ["birth_time"] | Cache deleted, recalculation flagged |
| does not invalidate cache on name change | changed_fields: ["name"] | Cache unchanged |
| detects retrograde motion | speed: -0.5 | is_retrograde = true |
| detects direct motion | speed: 1.2 | is_retrograde = false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full chart computation | 1. Create profile with complete birth data, 2. Trigger chart calculation, 3. Read cached chart | All 10 planet positions present, 12 house cusps present, all angles computed |
| Chart recalculation on profile edit | 1. Compute chart, 2. Edit birth time, 3. Re-open chart | New chart has different house positions and potentially different planet placements |
| Whole-sign fallback for missing birth time | 1. Create profile without birth time, 2. Compute chart | House cusps are at exact 30-degree intervals starting from the sun's sign |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User sees their natal chart for the first time | 1. Create profile, 2. Navigate to Chart, 3. Wait for computation | Loading indicator shown, then full chart summary displayed with all planets, houses, and angles |
| User with unknown birth time sees limited chart | 1. Create profile with "I don't know my birth time", 2. Navigate to Chart | Warning banner shown, Rising sign marked as "Unknown", houses use whole-sign system |

---

### ST-003: Sun/Moon/Rising Display

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-003 |
| **Feature Name** | Sun/Moon/Rising Display |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Casual Stargazer, I want to see my Sun, Moon, and Rising signs displayed prominently with clear explanations, so that I can quickly understand and share my "Big Three" astrological identity.

**Secondary:**
> As a Spiritual Explorer, I want to read detailed descriptions of what each of my Big Three placements means, so that I can deepen my self-understanding through an astrological lens.

#### 3.3 Detailed Description

The Sun, Moon, and Rising sign (collectively known as the "Big Three") are the most commonly referenced placements in astrology. The Sun sign represents core identity and ego, the Moon sign represents emotions and inner world, and the Rising sign (Ascendant) represents outward personality and how others perceive you. This feature provides a dedicated, richly detailed screen for viewing these three placements.

This screen serves as both a quick-reference card (for users who already understand astrology) and an educational entry point (for newcomers discovering what the Big Three mean). Each placement is displayed with its zodiac sign, degree, a brief keyword summary (e.g., "Aries: Bold, pioneering, independent"), and an expandable detailed description (3-5 paragraphs covering personality traits, strengths, challenges, and how this placement interacts with the others).

The Big Three display is one of the most shareable pieces of astrology content. While MyStars does not have social features, the screen includes a "Copy Summary" action that copies a plain-text summary (e.g., "Aries Sun, Cancer Moon, Leo Rising") to the clipboard for sharing externally.

The descriptions are bundled as static content within the app (12 signs x 3 placements = 36 description texts, plus 12 x 12 = 144 sun-moon combination texts for interaction descriptions). This content is stored as structured data, not generated dynamically, ensuring consistent and high-quality interpretations.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-002: Natal Chart Calculation - the Big Three positions are extracted from the computed natal chart

**External Dependencies:**
- Bundled interpretation text data (36 placement descriptions + 144 sun-moon combination descriptions, approximately 200KB as compressed text)

**Assumed Capabilities:**
- A natal chart has been computed for the selected profile
- The user can navigate to this screen from the Natal Chart Summary or the profile card

#### 3.5 User Interface Requirements

##### Screen: Big Three Detail

**Layout:**
- The screen has a top navigation bar with a back arrow and the profile name as the title
- The screen is a vertically scrollable view divided into three major sections, each for one of the Big Three
- **Sun Section:**
  - Header bar with a sun icon, "Sun in [Sign]" title, and the degree (e.g., "0 degrees 21 minutes Aries")
  - A keyword line below the header: 3-5 keywords separated by bullet characters (e.g., "Bold / Pioneering / Independent / Energetic")
  - An element badge: "Fire Sign" with a small flame icon, colored according to the element (Fire: orange-red, Earth: green-brown, Air: light blue, Water: deep blue)
  - A quality badge: "Cardinal" / "Fixed" / "Mutable"
  - A ruling planet badge: "Ruled by Mars"
  - A brief description paragraph (2-3 sentences, always visible)
  - An expandable "Read More" section containing 3-5 additional paragraphs of detailed interpretation
- **Moon Section:** same structure as Sun, but with a moon icon and Moon-specific descriptions
- **Rising Section:** same structure as Sun, but with an ascending arrow icon and Rising-specific descriptions; if birth time is unknown, this section shows a placeholder: "Rising sign requires birth time. Add your birth time in your profile to unlock this placement." with a button linking to profile edit
- Below the three sections, a "Your Sun-Moon Combination" card shows a brief (2-3 paragraph) description of how the user's specific Sun and Moon signs interact (e.g., "Aries Sun with Cancer Moon: Your bold exterior masks a deeply sensitive interior...")
- A "Copy Summary" button in the top-right menu or at the bottom of the screen copies the Big Three summary to the clipboard
- A "Share Card" button generates a visually styled image of the Big Three (for saving or sharing)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Complete | All three placements are known | Full display with Sun, Moon, and Rising sections |
| No Rising | Birth time unknown | Sun and Moon sections fully rendered; Rising section shows placeholder with link to add birth time |
| Loading | Chart data is being fetched from cache | Brief loading shimmer on all three sections |
| Error | Chart data unavailable | Error message: "Chart data not available. Calculate your natal chart first." with a button to navigate to the Natal Chart screen |

**Interactions:**
- Tap "Read More" on any section: expands to show full interpretation text with a smooth height animation
- Tap "Read Less": collapses back to the brief description
- Tap element/quality/ruling planet badges: shows a tooltip or small popover explaining the term (e.g., "Fire signs are passionate, energetic, and action-oriented")
- Tap "Copy Summary": copies "Aries Sun, Cancer Moon, Leo Rising" (or without Rising if unknown) to clipboard; shows toast "Copied to clipboard"
- Tap "Share Card": generates an image with the Big Three information styled as a card; opens the system share sheet
- Tap the profile edit link (in Rising placeholder): navigates to the Add/Edit Profile screen

**Transitions/Animations:**
- The three sections stagger in with a 100ms delay between each, fading up from the bottom
- "Read More" / "Read Less" toggles with a 250ms height animation
- Badge tooltips appear with a 150ms fade-in

#### 3.6 Data Requirements

##### Entity: SignDescription (Bundled Static Data)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, composite of placement_type and sign | N/A | Unique identifier (e.g., "sun_aries", "moon_cancer") |
| placement_type | enum | One of: sun, moon, rising | N/A | Which of the Big Three this describes |
| sign | enum | One of the 12 zodiac signs | N/A | The zodiac sign |
| keywords | string | Comma-separated, 3-5 keywords | N/A | Brief keyword summary |
| element | enum | One of: fire, earth, air, water | N/A | The sign's element |
| quality | enum | One of: cardinal, fixed, mutable | N/A | The sign's quality/modality |
| ruling_planet | string | Planet name | N/A | The sign's traditional ruling planet |
| brief_description | string | 2-3 sentences, max 300 chars | N/A | Always-visible summary |
| full_description | string | 3-5 paragraphs, max 2000 chars | N/A | Expandable detailed interpretation |

##### Entity: SunMoonCombination (Bundled Static Data)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, composite of sun_sign and moon_sign | N/A | Unique identifier (e.g., "aries_cancer") |
| sun_sign | enum | One of the 12 zodiac signs | N/A | Sun sign |
| moon_sign | enum | One of the 12 zodiac signs | N/A | Moon sign |
| description | string | 2-3 paragraphs, max 1500 chars | N/A | How these two placements interact |

**Relationships:**
- SignDescription is read-only bundled data referenced by the display logic
- SunMoonCombination is read-only bundled data referenced by the display logic
- No foreign key relationships to user data; these are lookup tables

**Indexes:**
- SignDescription: (placement_type, sign) unique composite
- SunMoonCombination: (sun_sign, moon_sign) unique composite

**Validation Rules:**
- All 36 SignDescription entries must exist (12 signs x 3 placement types)
- All 144 SunMoonCombination entries must exist (12 x 12)
- Keywords must contain at least 3 items
- Brief description must not be empty
- Full description must not be empty

**Example Data:**

```
{
  "id": "sun_aries",
  "placement_type": "sun",
  "sign": "aries",
  "keywords": "Bold, Pioneering, Independent, Energetic, Competitive",
  "element": "fire",
  "quality": "cardinal",
  "ruling_planet": "Mars",
  "brief_description": "Aries Sun individuals are natural leaders who charge ahead with confidence and determination. You thrive on new beginnings and are at your best when pioneering uncharted territory.",
  "full_description": "As the first sign of the zodiac, Aries embodies the energy of initiation..."
}
```

```
{
  "id": "aries_cancer",
  "sun_sign": "aries",
  "moon_sign": "cancer",
  "description": "With an Aries Sun and Cancer Moon, you present a bold and assertive exterior while harboring a deeply sensitive and nurturing inner world..."
}
```

#### 3.7 Business Logic Rules

##### Big Three Extraction

**Purpose:** Extracts the Sun, Moon, and Rising sign placements from a computed natal chart.

**Inputs:**
- natal_chart: NatalChart - the computed chart
- planet_positions: list of PlanetPosition - all planet positions from the chart

**Logic:**

```
1. Find the PlanetPosition where body = "sun"
2. Extract sun_sign = that position's zodiac_sign, sun_degree = sign_degree, sun_minute = sign_minute
3. Find the PlanetPosition where body = "moon"
4. Extract moon_sign, moon_degree, moon_minute similarly
5. IF natal_chart.ascendant_longitude is not null THEN
     Compute rising_sign from ascendant_longitude using Zodiac Sign from Longitude logic (ST-002 section 3.7)
     Extract rising_degree and rising_minute
6. ELSE
     rising_sign = null (unknown)
7. RETURN { sun: {sign, degree, minute}, moon: {sign, degree, minute}, rising: {sign, degree, minute} or null }
```

**Edge Cases:**
- Rising sign is null: display placeholder, do not show element/quality/ruling planet for Rising
- Chart not yet computed: redirect user to compute chart first

##### Sign Metadata Lookup

**Purpose:** Retrieves element, quality, and ruling planet for a given zodiac sign.

**Inputs:**
- sign: enum - one of the 12 zodiac signs

**Logic:**

```
Elements:
  fire = [aries, leo, sagittarius]
  earth = [taurus, virgo, capricorn]
  air = [gemini, libra, aquarius]
  water = [cancer, scorpio, pisces]

Qualities:
  cardinal = [aries, cancer, libra, capricorn]
  fixed = [taurus, leo, scorpio, aquarius]
  mutable = [gemini, virgo, sagittarius, pisces]

Ruling Planets:
  aries = Mars, taurus = Venus, gemini = Mercury, cancer = Moon,
  leo = Sun, virgo = Mercury, libra = Venus, scorpio = Pluto,
  sagittarius = Jupiter, capricorn = Saturn, aquarius = Uranus, pisces = Neptune

1. Look up element, quality, and ruling_planet for the given sign
2. RETURN { element, quality, ruling_planet }
```

##### Summary Text Generation

**Purpose:** Produces a plain-text summary of the Big Three for clipboard copying.

**Inputs:**
- sun_sign: string
- moon_sign: string
- rising_sign: string or null

**Logic:**

```
1. Capitalize each sign name (first letter uppercase)
2. IF rising_sign is not null THEN
     summary = "[Sun_sign] Sun, [Moon_sign] Moon, [Rising_sign] Rising"
3. ELSE
     summary = "[Sun_sign] Sun, [Moon_sign] Moon"
4. RETURN summary
```

**Edge Cases:**
- Rising sign is null: omit from the summary text
- All three present: include all three separated by commas

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Chart not yet computed for profile | Screen shows: "Chart data not available. Calculate your natal chart first." with a navigation button | User taps button to navigate to Natal Chart screen |
| Description text missing for a sign/placement | Placeholder text: "Description coming soon." | App update includes the missing text |
| Clipboard copy fails | Toast: "Could not copy to clipboard." | User can manually select and copy text |
| Share card image generation fails | Toast: "Could not create share image. Try again." | User retries; if persistent, use Copy Summary instead |
| Sun or Moon position missing from chart data | Error screen: "Chart data appears incomplete. Try recalculating your chart." with retry button | User recalculates chart |

**Validation Timing:**
- Data availability check on screen load (is natal chart computed?)
- Description lookup on render (are all 36 + 144 texts present in bundle?)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a natal chart is computed with Sun in Aries (0 degrees 21 minutes), Moon in Cancer (15 degrees 42 minutes), and Rising in Leo (28 degrees 45 minutes),
   **When** the user navigates to the Big Three Detail screen,
   **Then** three sections are displayed showing "Sun in Aries" (0 degrees 21 minutes), "Moon in Cancer" (15 degrees 42 minutes), and "Rising in Leo" (28 degrees 45 minutes), each with keywords, element badge, quality badge, ruling planet badge, and a brief description.

2. **Given** the Big Three are displayed,
   **When** the user taps "Read More" on the Sun section,
   **Then** the section expands to show 3-5 paragraphs of detailed Sun in Aries interpretation, and the button changes to "Read Less".

3. **Given** the user has Sun in Aries and Moon in Cancer,
   **When** the Big Three screen loads,
   **Then** a "Your Sun-Moon Combination" card appears with 2-3 paragraphs describing the Aries Sun / Cancer Moon dynamic.

4. **Given** all three placements are displayed,
   **When** the user taps "Copy Summary",
   **Then** the text "Aries Sun, Cancer Moon, Leo Rising" is copied to the system clipboard and a toast confirms "Copied to clipboard".

**Edge Cases:**

5. **Given** a profile has birth_time = null (Rising sign unknown),
   **When** the user views the Big Three screen,
   **Then** the Sun and Moon sections display normally, but the Rising section shows a placeholder message and a link to add birth time.

6. **Given** the user taps the element badge "Fire Sign" on the Sun in Aries section,
   **When** the tooltip appears,
   **Then** it reads "Fire signs are passionate, energetic, and action-oriented. Fire signs: Aries, Leo, Sagittarius."

**Negative Tests:**

7. **Given** no natal chart has been computed for the selected profile,
   **When** the user navigates to the Big Three screen,
   **Then** the screen shows "Chart data not available. Calculate your natal chart first." with a button to the Natal Chart screen.
   **And** no partial or placeholder sign data is displayed.

8. **Given** the chart data exists but the Sun position is missing (data corruption),
   **When** the screen attempts to load,
   **Then** an error message is displayed: "Chart data appears incomplete. Try recalculating your chart."
   **And** no crash occurs.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| extracts Sun sign from chart | PlanetPosition with body=sun, longitude=0.35 | sun_sign: aries, degree: 0, minute: 21 |
| extracts Moon sign from chart | PlanetPosition with body=moon, longitude=105.7 | moon_sign: cancer, degree: 15, minute: 42 |
| extracts Rising from ascendant longitude | ascendant_longitude: 148.75 | rising_sign: leo, degree: 28, minute: 45 |
| returns null Rising when ascendant is null | ascendant_longitude: null | rising_sign: null |
| looks up element for Aries | sign: aries | element: fire |
| looks up element for Taurus | sign: taurus | element: earth |
| looks up quality for Aries | sign: aries | quality: cardinal |
| looks up quality for Leo | sign: leo | quality: fixed |
| looks up ruling planet for Scorpio | sign: scorpio | ruling_planet: Pluto |
| generates summary with all three | sun: Aries, moon: Cancer, rising: Leo | "Aries Sun, Cancer Moon, Leo Rising" |
| generates summary without rising | sun: Aries, moon: Cancer, rising: null | "Aries Sun, Cancer Moon" |
| retrieves sign description for sun_aries | placement_type: sun, sign: aries | Non-empty description with keywords, brief, and full text |
| retrieves sun-moon combination | sun: aries, moon: cancer | Non-empty combination description |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full Big Three display | 1. Create profile, 2. Compute chart, 3. Open Big Three screen | All three sections render with correct sign data and descriptions |
| Copy summary to clipboard | 1. Display Big Three, 2. Tap Copy Summary, 3. Read clipboard | Clipboard contains formatted Big Three text |
| Missing birth time shows placeholder | 1. Create profile without birth time, 2. Compute chart, 3. Open Big Three | Sun and Moon render; Rising shows placeholder with edit link |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user discovers their Big Three | 1. Create profile with full birth data, 2. Compute chart, 3. Navigate to Big Three, 4. Read all three descriptions, 5. Copy summary | User sees all three placements with descriptions, clipboard contains summary text |
| User with unknown birth time explores Big Three | 1. Create profile without birth time, 2. Compute chart, 3. Navigate to Big Three, 4. Tap link to add birth time, 5. Add time, 6. Return to Big Three | Rising section now shows the computed Rising sign instead of the placeholder |

---

### ST-004: Planet Position Calculator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-004 |
| **Feature Name** | Planet Position Calculator |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Dedicated Practitioner, I want to see the current real-time positions of all planets in the zodiac, so that I can track planetary movements and understand the astrological weather of today.

**Secondary:**
> As a Casual Stargazer, I want to know where the planets are right now and what signs they are in, so that I can follow along with astrological discussions and social media posts about current transits.

#### 3.3 Detailed Description

The Planet Position Calculator computes and displays the current positions of all major celestial bodies in the tropical zodiac in real time. While the Natal Chart (ST-002) shows where the planets were at the moment of birth, this feature shows where the planets are right now. This is a foundational feature for transit tracking (ST-008), daily horoscopes (ST-005), and retrograde alerts (ST-014).

The calculator uses the same Swiss Ephemeris engine as the Natal Chart Calculation, but the input is the current date and time (device clock) instead of birth data. The system computes positions for all 10 core celestial bodies (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto) plus optional bodies (Chiron, North Node, Lilith) based on user settings.

The screen displays each body's zodiac sign, degree and minute, daily motion speed, and retrograde status. The Moon's current phase angle and illumination percentage are also displayed. Positions are refreshed automatically every 60 seconds when the screen is visible, or on manual pull-to-refresh. Users can also select a custom date to view past or future positions within the 1900-2100 range.

A "Speed" column shows the daily motion of each body in degrees per day, helping users identify planets that are stationing (slowing down near retrograde or direct stations). Bodies moving slower than 20% of their average speed are flagged as "stationing" with a visual indicator.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-002: Natal Chart Calculation - shares the Swiss Ephemeris computation engine and zodiac sign derivation logic

**External Dependencies:**
- Bundled Swiss Ephemeris data files (same as ST-002, covering 1900-2100)
- Device clock for current date/time (no network time sync required)

**Assumed Capabilities:**
- Swiss Ephemeris computation engine is initialized and functional
- User can navigate to this screen from the main tab bar or dashboard

#### 3.5 User Interface Requirements

##### Screen: Current Planets

**Layout:**
- The screen has a top navigation bar titled "Current Planets" with a calendar icon on the right for date selection
- Below the navigation bar, a date display shows the current date and time in the user's local timezone (e.g., "March 7, 2026, 2:35 PM PST"), updating every 60 seconds
- Below the date, a Moon phase widget shows: the current moon phase name (e.g., "Waxing Gibbous"), a moon phase icon that visually represents the illumination, and the illumination percentage (e.g., "78% illuminated")
- The main content area is a vertical scrollable list of planet rows
- Each planet row displays:
  - Planet glyph/icon on the left
  - Planet name (e.g., "Mercury")
  - Zodiac sign glyph and name (e.g., "Pisces")
  - Degree and minute (e.g., "14 degrees 22 minutes")
  - Daily motion speed (e.g., "+1.62 degrees/day")
  - A retrograde indicator: "Rx" badge in a contrasting color if retrograde, "Stationing" badge if speed is below the 20% threshold
- Below the planet list, a "Sign Summary" section shows a horizontal row of 12 zodiac sign glyphs, each with a small number badge indicating how many planets are currently in that sign (0-10)
- A "View on My Chart" button appears at the bottom if the user has a primary profile, linking to Transit Tracking (ST-008)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Current | Viewing current date/time | Live date display with auto-refresh indicator (subtle pulsing dot) |
| Custom Date | User selected a past or future date | Date picker visible, "Reset to Now" button appears, auto-refresh paused |
| Loading | Positions are being computed | Brief loading shimmer over the planet list (under 500ms typically) |
| Error | Computation fails | Error message: "Could not calculate planet positions. Please try again." with retry button |

**Interactions:**
- Tap the calendar icon: opens a date picker allowing selection from January 1, 1900 to December 31, 2100
- Tap "Reset to Now": returns to current date/time and resumes auto-refresh
- Tap a planet row: expands inline to show a brief 2-3 sentence interpretation of the planet's current sign placement (e.g., "Mercury in Pisces: Communication tends toward the intuitive and imaginative...")
- Pull-to-refresh: forces an immediate recalculation
- Tap "View on My Chart": navigates to Transit Tracking (ST-008) with the current planet positions overlaid on the natal chart

**Transitions/Animations:**
- Planet rows stagger in with a 40ms delay between each, sliding up from the bottom
- Retrograde/Stationing badges pulse gently once on first display (300ms)
- Moon phase icon rotates smoothly to the correct illumination angle on load (200ms)
- Date picker slides up from the bottom as a modal sheet (250ms)

##### Modal: Date Picker

**Layout:**
- A modal sheet with a calendar-style date picker
- Month/year navigation at the top
- Date grid below
- "Cancel" and "Select" buttons at the bottom
- An optional time picker (hour/minute) below the date grid, defaulting to 12:00 noon for past/future dates

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Modal just opened | Calendar shows current month with today highlighted |
| Date Selected | User tapped a date | Selected date is highlighted, "Select" button is enabled |
| Out of Range | User navigates before 1900 or after 2100 | Navigation arrows disabled for out-of-range months |

#### 3.6 Data Requirements

##### Entity: CurrentPlanetPosition (Computed, Not Persisted)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| body | enum | One of: sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto, chiron, north_node, lilith | None | The celestial body |
| longitude | float | 0.0 to 359.999 | None | Ecliptic longitude in decimal degrees |
| latitude | float | -90.0 to 90.0 | None | Ecliptic latitude in decimal degrees |
| speed | float | Any float | None | Daily motion in degrees per day |
| is_retrograde | boolean | Derived from speed < 0 | false | Whether the body is in retrograde motion |
| is_stationing | boolean | Derived from abs(speed) < avg_speed * 0.2 | false | Whether the body is near a station (very slow) |
| zodiac_sign | enum | One of the 12 zodiac signs | None | Zodiac sign derived from longitude |
| sign_degree | integer | 0 to 29 | None | Degree within the zodiac sign |
| sign_minute | integer | 0 to 59 | None | Minute of arc within the degree |
| computed_at | datetime | ISO 8601 | Current timestamp | When this position was computed |

##### Entity: MoonPhaseData (Computed, Not Persisted)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| phase_angle | float | 0.0 to 359.999 | None | Angular distance between Sun and Moon |
| phase_name | enum | One of: new_moon, waxing_crescent, first_quarter, waxing_gibbous, full_moon, waning_gibbous, last_quarter, waning_crescent | None | Named moon phase |
| illumination_pct | float | 0.0 to 100.0 | None | Percentage of moon face illuminated |
| days_since_new | float | 0.0 to 29.53 | None | Days elapsed since the last new moon |
| computed_at | datetime | ISO 8601 | Current timestamp | When this was computed |

**Relationships:**
- CurrentPlanetPosition is a transient computation result, not stored in the database
- MoonPhaseData is a transient computation result, not stored in the database

**Indexes:**
- None (transient data, not persisted)

**Validation Rules:**
- All 10 core bodies must be present in every computation result
- longitude must be between 0.0 (inclusive) and 360.0 (exclusive)
- zodiac_sign must match the longitude (see ST-002 derivation logic)
- illumination_pct must be between 0.0 and 100.0

**Example Data:**

```
{
  "body": "mercury",
  "longitude": 344.37,
  "latitude": -1.23,
  "speed": -1.21,
  "is_retrograde": true,
  "is_stationing": false,
  "zodiac_sign": "pisces",
  "sign_degree": 14,
  "sign_minute": 22,
  "computed_at": "2026-03-07T14:35:00Z"
}
```

```
{
  "phase_angle": 234.7,
  "phase_name": "waning_crescent",
  "illumination_pct": 22.5,
  "days_since_new": 24.3,
  "computed_at": "2026-03-07T14:35:00Z"
}
```

#### 3.7 Business Logic Rules

##### Current Position Computation

**Purpose:** Computes the positions of all celestial bodies for a given date and time.

**Inputs:**
- target_datetime: datetime - the date and time to compute positions for (default: current device time)
- enabled_optional_bodies: list of enum - which optional bodies to include (chiron, north_node, lilith)

**Logic:**

```
1. Convert target_datetime to Julian Day Number using the Julian Day Calculation logic from ST-002
2. FOR each body in [sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto] + enabled_optional_bodies:
     a. Call Swiss Ephemeris calculation with the Julian Day and body identifier
     b. Receive: longitude, latitude, speed (and other data)
     c. Derive zodiac_sign, sign_degree, sign_minute from longitude using Zodiac Sign from Longitude logic (ST-002)
     d. Set is_retrograde = (speed < 0)
     e. Set is_stationing = (abs(speed) < AVERAGE_SPEEDS[body] * 0.2)
3. Compute MoonPhaseData from sun and moon longitudes
4. RETURN list of CurrentPlanetPosition + MoonPhaseData
```

**Average Daily Speeds (for stationing detection):**
- Sun: 0.9856 degrees/day
- Moon: 13.176 degrees/day
- Mercury: 1.383 degrees/day
- Venus: 1.200 degrees/day
- Mars: 0.524 degrees/day
- Jupiter: 0.083 degrees/day
- Saturn: 0.034 degrees/day
- Uranus: 0.012 degrees/day
- Neptune: 0.006 degrees/day
- Pluto: 0.004 degrees/day

**Edge Cases:**
- Sun and Moon are never retrograde; is_retrograde is always false for these bodies
- Mercury, Venus, and Mars have relatively short retrograde periods; stationing detection is important for these
- Outer planets (Uranus, Neptune, Pluto) are retrograde approximately 40-45% of the time

##### Moon Phase Computation

**Purpose:** Determines the current moon phase from the Sun-Moon angular separation.

**Inputs:**
- sun_longitude: float - ecliptic longitude of the Sun
- moon_longitude: float - ecliptic longitude of the Moon
- julian_day: float - current Julian Day Number

**Logic:**

```
1. phase_angle = (moon_longitude - sun_longitude + 360) mod 360
2. illumination_pct = (1 - cos(phase_angle * PI / 180)) / 2 * 100
3. synodic_period = 29.53059  (days)
4. days_since_new = ((julian_day - 2451550.1) mod synodic_period)
5. IF days_since_new < 0 THEN days_since_new = days_since_new + synodic_period
6. Determine phase_name from phase_angle:
     0 to 44.99:    new_moon
     45 to 89.99:   waxing_crescent
     90 to 134.99:  first_quarter
     135 to 179.99: waxing_gibbous
     180 to 224.99: full_moon
     225 to 269.99: waning_gibbous
     270 to 314.99: last_quarter
     315 to 359.99: waning_crescent
7. RETURN { phase_angle, phase_name, illumination_pct, days_since_new }
```

**Formulas:**
- `phase_angle = (moon_longitude - sun_longitude + 360) mod 360`
- `illumination_pct = (1 - cos(phase_angle * PI / 180)) / 2 * 100`
- `days_since_new = (julian_day - 2451550.1) mod 29.53059`

**Edge Cases:**
- Phase angle exactly at a boundary (e.g., exactly 45.0): belongs to the next phase (waxing_crescent)
- Phase angle = 0: new_moon with illumination 0%
- Phase angle = 180: full_moon with illumination 100%

##### Sign Summary Computation

**Purpose:** Counts how many planets are currently in each zodiac sign for the sign summary widget.

**Inputs:**
- positions: list of CurrentPlanetPosition - all computed positions (core bodies only)

**Logic:**

```
1. Initialize counts = { aries: 0, taurus: 0, ..., pisces: 0 }
2. FOR each position in positions WHERE body is a core body (sun through pluto):
     counts[position.zodiac_sign] += 1
3. RETURN counts
```

**Edge Cases:**
- All 10 bodies in the same sign: that sign shows "10", all others show "0"
- No bodies in a sign: that sign shows "0" with a dimmed appearance

##### Auto-Refresh Logic

**Purpose:** Keeps planet positions current while the screen is visible.

**Inputs:**
- screen_visible: boolean - whether the Current Planets screen is in the foreground
- last_computed_at: datetime - when positions were last computed
- is_custom_date: boolean - whether the user selected a custom date

**Logic:**

```
1. IF screen_visible AND NOT is_custom_date THEN
     IF (current_time - last_computed_at) > 60 seconds THEN
       Recompute all positions
       Update display
       Set last_computed_at = current_time
2. IF screen becomes invisible (user navigates away) THEN
     Cancel any pending refresh timer
3. IF screen becomes visible again AND NOT is_custom_date THEN
     Immediately recompute if stale (> 60 seconds since last computation)
```

**Edge Cases:**
- Custom date mode: auto-refresh is paused; positions are static
- Device clock changes (timezone change, manual clock adjustment): recalculate on next refresh cycle

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Ephemeris data files missing | Error screen: "Astronomical data files are missing. Please reinstall the app." | User reinstalls the app |
| Date outside ephemeris range (custom date before 1900 or after 2100) | Date picker prevents selection outside 1900-2100; if entered programmatically, error: "Positions available for dates between 1900 and 2100." | User selects a date within range |
| Computation takes longer than 2 seconds | Loading indicator remains visible; positions render as they become available (planet-by-planet) | Automatic; no user action needed |
| Device clock is significantly wrong | No detection; positions reflect device clock | User corrects device clock in system settings |
| Calculation produces NaN or invalid longitude | Affected planet row shows "Calculation error" instead of position data; other planets render normally | User can pull-to-refresh to retry |

**Validation Timing:**
- Date range validation occurs when user selects a custom date (before computation begins)
- Ephemeris availability check occurs at module initialization
- Computation result validation occurs after each body's position is calculated

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Current Planets screen with no custom date selected,
   **When** the screen loads,
   **Then** 10 planet rows are displayed showing each body's current zodiac sign, degree, minute, and daily speed; the Moon phase widget shows the current phase name and illumination percentage; and the date display shows the current date and time.

2. **Given** Mercury is currently retrograde (speed = -1.21 degrees/day),
   **When** the Current Planets screen loads,
   **Then** Mercury's row displays an "Rx" badge in a contrasting color, and the speed column shows "-1.21 degrees/day".

3. **Given** the user taps the calendar icon and selects "June 15, 2025",
   **When** the date is confirmed,
   **Then** all planet positions update to reflect June 15, 2025 at 12:00 noon, auto-refresh pauses, and a "Reset to Now" button appears.

4. **Given** the user is viewing a custom date,
   **When** the user taps "Reset to Now",
   **Then** positions recalculate for the current date/time, auto-refresh resumes, and the "Reset to Now" button disappears.

**Edge Cases:**

5. **Given** Saturn is moving at 0.005 degrees/day (below 20% of its average 0.034),
   **When** the Current Planets screen loads,
   **Then** Saturn's row displays a "Stationing" badge instead of the normal speed display.

6. **Given** the Sign Summary section is displayed and 4 planets are in Pisces,
   **When** the user views the summary,
   **Then** the Pisces glyph shows a "4" badge, and all other signs show their respective counts.

**Negative Tests:**

7. **Given** the user opens the date picker and navigates to December 2100,
   **When** the user tries to navigate forward to January 2101,
   **Then** the forward navigation is disabled and no date beyond December 31, 2100 can be selected.
   **And** no computation is attempted for out-of-range dates.

8. **Given** the ephemeris data files are missing or corrupt,
   **When** the Current Planets screen attempts to compute,
   **Then** an error screen is displayed: "Astronomical data files are missing. Please reinstall the app."
   **And** no partial or incorrect data is shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes Sun position for known date | 2026-03-07 12:00 UTC | Longitude within 0.5 degrees of expected ephemeris value |
| detects Mercury retrograde | speed: -1.21 | is_retrograde = true |
| detects Mercury direct | speed: 1.38 | is_retrograde = false |
| flags Saturn stationing | body: saturn, speed: 0.005, avg: 0.034 | is_stationing = true (0.005 < 0.034 * 0.2 = 0.0068) |
| does not flag Saturn when normal speed | body: saturn, speed: 0.030 | is_stationing = false |
| computes moon phase angle | sun_lng: 346.5, moon_lng: 221.2 | phase_angle = (221.2 - 346.5 + 360) mod 360 = 234.7 |
| determines phase name from angle 234.7 | phase_angle: 234.7 | phase_name = waning_gibbous |
| computes illumination at new moon | phase_angle: 0 | illumination_pct = 0.0 |
| computes illumination at full moon | phase_angle: 180 | illumination_pct = 100.0 |
| computes illumination at first quarter | phase_angle: 90 | illumination_pct = 50.0 |
| counts planets per sign | 3 in Aries, 2 in Pisces, rest distributed | aries: 3, pisces: 2, others as expected |
| Sun is never retrograde | speed: 0.98 | is_retrograde = false (always) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full current position computation | 1. Get current JD, 2. Compute all 10 bodies, 3. Verify results | All 10 positions have valid longitudes (0-360), valid zodiac signs, and non-null speeds |
| Custom date computation | 1. Select date 2000-01-01 12:00 UTC, 2. Compute positions | Positions match reference ephemeris values for J2000.0 epoch |
| Auto-refresh after 60 seconds | 1. Load screen, 2. Wait 65 seconds, 3. Observe display | Date/time display updates, Moon position changes slightly (approximately 0.22 degrees per minute) |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User checks today's planetary positions | 1. Open Current Planets tab, 2. View all planets, 3. Note Mercury's retrograde status, 4. View Moon phase | All 10 planets displayed with signs and degrees; Moon phase widget shows current phase and illumination |
| User views planets on a past date | 1. Open Current Planets, 2. Tap calendar, 3. Select birthday, 4. View positions, 5. Tap "Reset to Now" | Positions reflect the selected date, then return to current positions after reset |

---

### ST-005: Daily Horoscope Generation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-005 |
| **Feature Name** | Daily Horoscope Generation |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Casual Stargazer, I want to read a personalized daily horoscope based on my birth chart and current planetary positions, so that I can start my day with astrological guidance relevant to me.

**Secondary:**
> As a Spiritual Explorer, I want to understand which planetary transits are influencing my day, so that I can align my activities and intentions with the cosmic energy.

#### 3.3 Detailed Description

Daily Horoscope Generation produces personalized daily readings based on the interaction between the user's natal chart and current planetary positions. Unlike generic sun-sign horoscopes found in newspapers, MyStars generates horoscopes that account for the user's full natal chart, making them far more personally relevant.

The horoscope engine works entirely offline. It does not use AI text generation or fetch content from a server. Instead, it uses a deterministic template-and-rule system: the engine identifies the most significant transits of the day (current planets making aspects to natal planets), selects from a library of pre-written interpretation fragments, and composes them into a cohesive daily reading.

Each daily horoscope consists of: an overall theme (1-2 sentences), a detailed reading (3-5 paragraphs covering love, career, personal growth, and energy levels), a "focus of the day" (the single most significant transit), and a numerical rating for the day (1-5 stars). The horoscope is generated fresh each day based on actual astronomical data, ensuring that no two days produce the same reading.

The system stores up to 90 days of generated horoscopes locally, allowing users to look back at past readings. The horoscope for today is generated on first access each day and cached for the remainder of the day.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-001: Birth Profile Management - horoscope requires a birth profile (at minimum, birth date for sun sign)
- ST-002: Natal Chart Calculation - horoscope uses natal planet positions
- ST-004: Planet Position Calculator - horoscope uses current planet positions to identify transits

**External Dependencies:**
- Bundled horoscope interpretation text library (approximately 500KB compressed): 12 sign-based daily themes, 10 planet x 12 sign transit interpretations, 50+ aspect-specific text fragments
- Device clock for determining "today"

**Assumed Capabilities:**
- A natal chart has been computed for the primary profile
- The planet position calculator (ST-004) is functional

#### 3.5 User Interface Requirements

##### Screen: Daily Horoscope

**Layout:**
- The screen has a top navigation bar titled "Today's Horoscope" with left/right arrow buttons for navigating to previous/next days
- Below the navigation bar, a date label shows the horoscope date (e.g., "Friday, March 7, 2026")
- A "Star Rating" widget displays the day's overall rating as 1 to 5 filled star icons
- Below the rating, a "Theme" section shows the 1-2 sentence overall theme in a larger font, styled as a pull-quote
- Below the theme, a "Focus of the Day" card highlights the single most significant transit, showing the transit name (e.g., "Moon conjunct natal Venus"), its exact time (if applicable), and a brief 2-3 sentence explanation
- The main reading area shows 3-5 paragraphs organized under subtle headings: "Love and Relationships", "Career and Goals", "Personal Growth", "Energy and Wellness"
- Below the reading, a "Key Transits" section lists all significant transits active today, each with the transit name, aspect type icon, and a one-line summary
- A "Save to Journal" button at the bottom links to the Astrology Journal (ST-017) if the module is enabled
- The screen is vertically scrollable

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Today | Viewing today's horoscope (most common) | Full horoscope with all sections, "Today" label in the date area |
| Past Date | Navigating to a previous day (up to 90 days back) | Cached horoscope for that date, left arrow navigation enabled |
| Future Date | Navigating forward (up to 7 days ahead) | Generated forecast for that date, labeled "Preview" |
| No Profile | No primary profile set | Message: "Set up your birth profile to receive personalized horoscopes" with a button to create a profile |
| No Chart | Primary profile exists but no natal chart computed | Message: "Calculate your natal chart to unlock daily horoscopes" with a button to the Natal Chart screen |
| Loading | Horoscope is being generated (first access of the day) | Loading shimmer over all sections with text "Reading the stars..." |

**Interactions:**
- Tap left arrow: navigate to the previous day's horoscope (up to 90 days back)
- Tap right arrow: navigate to the next day's horoscope (up to 7 days ahead from today)
- Tap a transit in the "Key Transits" list: expands inline to show a 2-3 sentence interpretation
- Tap "Save to Journal": creates a journal entry pre-populated with today's horoscope and theme
- Pull-to-refresh on today's horoscope: regenerates the horoscope (recalculates transits and reselects text fragments)
- Long-press on the theme text: copies the theme to the clipboard

**Transitions/Animations:**
- Day navigation slides the entire horoscope left or right (250ms) when switching dates
- Star rating fills sequentially with a 100ms delay between each star (total 500ms animation)
- Key Transit rows expand with a 200ms height animation

#### 3.6 Data Requirements

##### Entity: DailyHoroscope

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| profile_id | string | Foreign key to BirthProfile.id | None | The profile this horoscope is for |
| date | string | ISO 8601 date (YYYY-MM-DD), unique per profile_id | None | The date of the horoscope |
| star_rating | integer | 1 to 5 | None | Overall day rating |
| theme | string | Max 300 chars | None | 1-2 sentence overall theme |
| focus_transit | string | Max 200 chars | None | Name of the most significant transit (e.g., "Moon conjunct natal Venus") |
| focus_description | string | Max 500 chars | None | 2-3 sentence explanation of the focus transit |
| reading_love | string | Max 1000 chars | None | Love and relationships section |
| reading_career | string | Max 1000 chars | None | Career and goals section |
| reading_growth | string | Max 1000 chars | None | Personal growth section |
| reading_energy | string | Max 1000 chars | None | Energy and wellness section |
| transit_data | string | JSON array, max 5000 chars | None | Serialized list of all significant transits for the day |
| generated_at | datetime | ISO 8601 | Current timestamp | When the horoscope was generated |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- DailyHoroscope belongs to BirthProfile (many-to-one via profile_id)
- One DailyHoroscope per profile per date (unique constraint on profile_id + date)

**Indexes:**
- (profile_id, date) unique composite - fast lookup by profile and date, prevents duplicates
- date - cleanup query for purging horoscopes older than 90 days

**Validation Rules:**
- star_rating: must be an integer between 1 and 5
- theme: must not be empty
- date: must be a valid ISO 8601 date
- transit_data: must be valid JSON containing an array of transit objects
- Maximum 97 horoscopes per profile (90 past + today + 7 future; excess purged on generation)

**Example Data:**

```
{
  "id": "h1-2026-03-07",
  "profile_id": "b7e3f1a2-9c4d-4e8f-a1b2-c3d4e5f60001",
  "date": "2026-03-07",
  "star_rating": 4,
  "theme": "A day of creative breakthroughs. Your ideas have extra spark as Mercury activates your natal Jupiter.",
  "focus_transit": "Mercury sextile natal Jupiter",
  "focus_description": "Mercury in Pisces forms a harmonious sextile to your natal Jupiter. This transit expands your thinking and brings optimistic communication. A great day for pitching ideas or learning something new.",
  "reading_love": "Venus in your 7th house brings warmth to partnerships...",
  "reading_career": "The Mercury-Jupiter sextile lights up your career sector...",
  "reading_growth": "The waning Moon in Sagittarius invites philosophical reflection...",
  "reading_energy": "Mars in Gemini keeps your energy levels high but scattered...",
  "transit_data": "[{\"name\":\"Mercury sextile natal Jupiter\",\"aspect\":\"sextile\",\"orb\":2.3},{\"name\":\"Moon conjunct natal Venus\",\"aspect\":\"conjunction\",\"orb\":1.1}]",
  "generated_at": "2026-03-07T06:00:00Z",
  "created_at": "2026-03-07T06:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Transit Detection for Horoscope

**Purpose:** Identifies significant transits (current planet aspects to natal planets) active on a given day.

**Inputs:**
- natal_positions: list of PlanetPosition - from the natal chart
- current_positions: list of CurrentPlanetPosition - for the target date
- date: string - the target date

**Logic:**

```
1. Compute current planet positions for target_date at 12:00 noon UTC
2. FOR each current_body in [sun, moon, mercury, venus, mars, jupiter, saturn]:
     FOR each natal_body in [sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto]:
       angle = abs(current_body.longitude - natal_body.longitude)
       IF angle > 180 THEN angle = 360 - angle
       FOR each aspect in [conjunction(0), sextile(60), square(90), trine(120), opposition(180)]:
         orb = abs(angle - aspect.exact_angle)
         IF orb <= aspect.max_orb THEN
           Add transit: { transiting: current_body, natal: natal_body, aspect: aspect.name, orb: orb }
3. Sort transits by orb (tightest first)
4. RETURN transits
```

**Aspect Orbs:**
- Conjunction (0 degrees): max orb 8 degrees
- Sextile (60 degrees): max orb 6 degrees
- Square (90 degrees): max orb 7 degrees
- Trine (120 degrees): max orb 8 degrees
- Opposition (180 degrees): max orb 8 degrees

**Edge Cases:**
- Moon transits change quickly (approximately 13 degrees/day); the noon position is used as a representative
- Multiple transits active: the system selects the tightest-orb transit involving a slow-moving planet as the "Focus of the Day"
- No significant transits: the system falls back to a generic sun-sign daily reading

##### Star Rating Calculation

**Purpose:** Assigns a 1-5 star rating to the day based on the quality and quantity of active transits.

**Inputs:**
- transits: list of detected transits with aspect types and orbs

**Logic:**

```
1. Initialize score = 3.0 (neutral baseline)
2. FOR each transit:
     IF aspect is trine or sextile THEN score += (1.0 - orb / max_orb) * weight
     IF aspect is conjunction THEN score += (0.5 - orb / max_orb) * weight  (conjunctions are neutral-positive)
     IF aspect is square THEN score -= (0.8 - orb / max_orb) * weight
     IF aspect is opposition THEN score -= (0.6 - orb / max_orb) * weight
3. Weights by transiting body:
     Sun: 1.0, Moon: 0.5, Mercury: 0.7, Venus: 0.8, Mars: 0.9, Jupiter: 1.2, Saturn: 1.0
4. Clamp score to range [1.0, 5.0]
5. Round to nearest integer
6. RETURN star_rating
```

**Edge Cases:**
- No transits: star_rating = 3 (neutral day)
- All beneficial transits: star_rating = 5
- All challenging transits: star_rating = 1
- Mixed transits: score reflects the balance

##### Horoscope Text Assembly

**Purpose:** Selects and composes interpretation text fragments into a cohesive reading.

**Inputs:**
- transits: list of detected transits
- natal_chart: NatalChart
- primary_sign: enum - the user's sun sign
- star_rating: integer

**Logic:**

```
1. Select theme text from THEME_TEMPLATES[primary_sign][star_rating_bucket]
     star_rating_bucket: 1-2 = "challenging", 3 = "neutral", 4-5 = "positive"
2. Select focus_description from TRANSIT_INTERPRETATIONS[focus_transit.aspect][focus_transit.transiting][focus_transit.natal]
3. FOR each reading section (love, career, growth, energy):
     a. Identify the most relevant transit for that life area:
        love: Venus or Moon transits preferred
        career: Saturn, Jupiter, or Sun transits preferred
        growth: Neptune, Pluto, or North Node transits preferred
        energy: Mars or Sun transits preferred
     b. Select text from SECTION_TEMPLATES[section][relevant_transit.aspect][relevant_transit.body_pair]
     c. If no relevant transit exists for a section, use SECTION_DEFAULTS[section][primary_sign]
4. Assemble all sections into the DailyHoroscope entity
5. RETURN DailyHoroscope
```

**Edge Cases:**
- Template library missing a specific combination: fall back to the generic sign-based text
- Same transit is relevant to multiple sections: use it for the most specific section and fall back for others

##### Horoscope Cache and Purge

**Purpose:** Caches generated horoscopes and purges old entries.

**Inputs:**
- profile_id: string
- date: string
- generated_horoscope: DailyHoroscope

**Logic:**

```
1. Check if a horoscope exists for (profile_id, date)
2. IF exists THEN
     Return the cached horoscope (do not regenerate)
3. ELSE
     Save generated_horoscope to the database
4. Count horoscopes for profile_id
5. IF count > 97 THEN
     Delete the oldest entries until count = 97
6. RETURN the horoscope
```

**Edge Cases:**
- Pull-to-refresh on today: delete the cached entry for today's date, then regenerate
- Profile natal chart changes: invalidate all cached horoscopes for that profile

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No primary profile set | Screen shows: "Set up your birth profile to receive personalized horoscopes" with a "Create Profile" button | User creates a profile |
| Natal chart not computed | Screen shows: "Calculate your natal chart to unlock daily horoscopes" with a "Calculate Chart" button | User computes their natal chart |
| Interpretation text library missing | Fallback to a generic sun-sign reading with note: "Detailed readings unavailable. Using simplified horoscope." | App update restores the library |
| Horoscope generation fails (computation error) | Screen shows: "Could not generate today's horoscope. Pull down to try again." | User pulls to refresh |
| Database write fails when caching horoscope | Horoscope is displayed but not cached; next visit regenerates | Automatic on next access |
| Navigating beyond 90 days back | Left arrow is disabled; no navigation possible | User stays within the 90-day window |
| Navigating beyond 7 days ahead | Right arrow is disabled; no navigation possible | User stays within the 7-day window |

**Validation Timing:**
- Profile and chart existence checked on screen load
- Interpretation library availability checked at module initialization
- Cached horoscope freshness checked on each screen visit (date comparison)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a primary profile exists with a computed natal chart,
   **When** the user opens the Daily Horoscope screen for the first time today,
   **Then** a loading indicator appears ("Reading the stars..."), followed by a fully rendered horoscope with star rating, theme, focus of the day, four reading sections, and a key transits list.

2. **Given** a horoscope was generated earlier today,
   **When** the user returns to the Daily Horoscope screen,
   **Then** the cached horoscope is displayed immediately without regeneration or loading indicator.

3. **Given** the user is viewing today's horoscope,
   **When** the user taps the left arrow to navigate to yesterday,
   **Then** the horoscope for yesterday slides in from the left, showing the cached reading from the previous day.

4. **Given** the user is viewing today's horoscope,
   **When** the user taps the right arrow to navigate to tomorrow,
   **Then** a forecast for tomorrow slides in from the right, labeled "Preview", generated from tomorrow's planetary positions.

**Edge Cases:**

5. **Given** no significant transits are detected for today,
   **When** the horoscope is generated,
   **Then** a generic sun-sign based reading is used, the star rating is 3, and the "Focus of the Day" card reads "No major transits today. A quiet day for reflection."

6. **Given** 95 past horoscopes are cached and a new one is generated,
   **When** the cache exceeds 97 entries,
   **Then** the oldest horoscopes beyond the 97-entry limit are purged from the database.

**Negative Tests:**

7. **Given** no primary profile exists,
   **When** the user opens the Daily Horoscope screen,
   **Then** the screen shows "Set up your birth profile to receive personalized horoscopes" with a "Create Profile" button.
   **And** no horoscope content is displayed.

8. **Given** the user pulls to refresh today's horoscope,
   **When** the cached entry is deleted and regenerated,
   **Then** a new horoscope is produced (potentially with different text fragment selections) and the star rating reflects the current transit calculations.
   **And** the previous cached reading is replaced.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects conjunction within orb | current: 45.0, natal: 42.0, aspect: conjunction | Transit detected, orb = 3.0 |
| rejects conjunction outside orb | current: 45.0, natal: 36.0, aspect: conjunction | No transit (orb = 9.0, exceeds max 8) |
| detects trine within orb | current: 180.0, natal: 60.5, aspect: trine | Transit detected, orb = 0.5 |
| detects opposition across 0 boundary | current: 5.0, natal: 184.0 | Opposition detected, orb = 1.0 |
| calculates star rating neutral day | no transits | star_rating = 3 |
| calculates star rating positive day | Jupiter trine natal Sun, orb 1.0 | star_rating = 4 or 5 |
| calculates star rating challenging day | Saturn square natal Moon, orb 0.5 | star_rating = 1 or 2 |
| selects focus transit by tightest orb | transits: [orb 3.0, orb 1.0, orb 5.0] | Focus = transit with orb 1.0 |
| assembles horoscope with all sections | valid transits, sign: aries | DailyHoroscope with non-empty theme, focus, and 4 reading sections |
| purges oldest horoscopes when exceeding 97 | 98 horoscopes for profile | Oldest horoscope deleted, count = 97 |
| caches horoscope and returns on second access | generate, then access same date | Second access returns cached version without regeneration |
| falls back to generic when no transits | empty transit list | Generic sun-sign reading returned |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full horoscope generation | 1. Create profile, 2. Compute natal chart, 3. Generate daily horoscope for today | Horoscope entity created with all fields populated, star_rating between 1 and 5 |
| Past date horoscope retrieval | 1. Generate horoscope for today, 2. Navigate to yesterday | Yesterday's horoscope is generated and cached, today's remains cached |
| Regeneration on pull-to-refresh | 1. Generate today's horoscope, 2. Pull to refresh | Old entry deleted, new entry created with fresh generated_at timestamp |
| Cache purge | 1. Insert 98 horoscopes for a profile, 2. Generate one more | Oldest entry purged, total count = 97 |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reads their first daily horoscope | 1. Create profile, 2. Compute natal chart, 3. Open Daily Horoscope | Loading animation, then full horoscope with rating, theme, reading sections, and transit list |
| User browses past week of horoscopes | 1. View today, 2. Navigate back 7 days | Each day shows a unique horoscope; all are cached for instant access on return |

---

### ST-006: Birth Chart Visualization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-006 |
| **Feature Name** | Birth Chart Visualization |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Dedicated Practitioner, I want to see my natal chart rendered as a traditional circular chart wheel, so that I can visually analyze planet placements, house cusps, and aspects at a glance.

**Secondary:**
> As a Casual Stargazer, I want to see a beautiful visual representation of my birth chart that I can understand and share, so that astrology feels tangible and personal.

#### 3.3 Detailed Description

The Birth Chart Visualization renders the natal chart data (from ST-002) as a traditional astrology chart wheel. This is a circular diagram divided into 12 houses, with the zodiac band around the outer ring and planet glyphs placed at their computed positions. Aspect lines connect planets that form significant geometric relationships (conjunctions, sextiles, squares, trines, oppositions).

The chart wheel is rendered as a vector graphic for crisp display at any zoom level. The outer ring shows the 12 zodiac signs with their glyphs and degree markers. The inner ring shows the 12 houses with cusp degree markers. Planet glyphs are placed at their computed longitudes on the zodiac ring, with short radial lines connecting them to their house positions. Aspect lines are drawn between planets, color-coded by aspect type: blue for trines and sextiles (harmonious), red for squares and oppositions (challenging), and green for conjunctions (neutral/combined).

Users can tap any planet glyph to see a tooltip with the planet's full position information (sign, degree, minute, house, and retrograde status). Users can tap any aspect line to see the aspect details (type, orb, and a brief interpretation). The chart supports pinch-to-zoom for examining closely spaced planets.

The chart can be exported as an image (PNG, 2048x2048 pixels) for saving or sharing. A simplified "modern" view mode replaces the traditional wheel with a clean, minimal design using colored dots instead of glyphs, aimed at users unfamiliar with astrological symbols.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-002: Natal Chart Calculation - provides all planet positions, house cusps, and angles
- ST-010: Aspect Calculations - provides the aspect data to draw aspect lines (optional; chart can render without aspects)

**External Dependencies:**
- Zodiac and planet glyph assets (SVG or font-based, bundled with the app)
- Canvas or SVG rendering capability for the chart wheel

**Assumed Capabilities:**
- A natal chart has been computed for the selected profile
- The device supports vector graphic rendering

#### 3.5 User Interface Requirements

##### Screen: Chart Wheel

**Layout:**
- The screen has a top navigation bar with the profile name as the title, a view mode toggle ("Traditional" / "Modern"), and an export icon on the right
- The main content area is the chart wheel, centered and filling the available width (maintaining a 1:1 aspect ratio)
- The chart wheel structure (traditional mode):
  - Outermost ring: 12 zodiac sign segments, each 30 degrees wide, with the sign glyph centered in the segment and tick marks at every 5 degrees
  - Inner ring: 12 house segments divided by house cusp lines radiating from the center; house numbers displayed inside each segment
  - Planet glyphs placed on the zodiac ring at their computed longitudes; if two or more planets are within 5 degrees, they fan out radially to avoid overlap
  - Aspect lines drawn as colored lines connecting planet positions through the center of the chart
  - The Ascendant (ASC) is positioned at the 9 o'clock position (left horizontal), following astrological convention
  - MC, DC, and IC lines are drawn as thicker lines across the chart
  - Degree markers on the outer ring at every 5 degrees; 10-degree markers are slightly longer
- Below the chart wheel, a legend shows aspect line colors: blue = trine/sextile, red = square/opposition, green = conjunction
- Below the legend, an "Aspect Table" button opens the full aspect grid (ST-010)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Traditional | Default view mode | Full traditional chart wheel with glyphs and aspect lines |
| Modern | User toggled to modern view | Simplified chart with colored dots, house labels, and minimal aspect lines |
| Zoomed | User pinched to zoom | Chart zooms in around the pinch point; scroll to pan |
| Tooltip Active | User tapped a planet or aspect line | Tooltip overlay shows detailed information |
| No Chart | Chart data not available | Message: "No chart data available. Calculate your natal chart first." with navigation button |
| Exporting | Image export in progress | Brief overlay: "Creating chart image..." with a progress indicator |

**Interactions:**
- Tap a planet glyph: shows a tooltip with planet name, sign, degree, minute, house, retrograde status, and a "Learn More" link to ST-012
- Tap an aspect line: shows a tooltip with aspect type, planet pair, orb, and a brief interpretation
- Tap outside a tooltip: dismisses the tooltip
- Pinch-to-zoom: zooms the chart in/out (minimum 1x, maximum 3x)
- Toggle "Traditional" / "Modern": switches the chart rendering style with a 300ms crossfade
- Tap export icon: generates a PNG image (2048x2048) and opens the system share sheet

**Transitions/Animations:**
- Chart draws in with a radial animation (rings expand outward over 500ms, then planets and aspect lines fade in over 300ms)
- View mode toggle uses a 300ms crossfade between traditional and modern styles
- Tooltip appears with a 150ms scale-up animation anchored to the tapped element
- Zoom transitions smoothly (no snapping)

#### 3.6 Data Requirements

##### Entity: ChartRenderConfig (In-Memory Configuration)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| view_mode | enum | One of: traditional, modern | traditional | Which visual style to render |
| show_aspects | boolean | - | true | Whether to draw aspect lines |
| aspect_filter | list of enum | Subset of: conjunction, sextile, square, trine, opposition | All five | Which aspect types to display |
| show_house_numbers | boolean | - | true | Whether to display house numbers |
| show_degree_markers | boolean | - | true | Whether to show degree ticks on the outer ring |
| zoom_level | float | 1.0 to 3.0 | 1.0 | Current zoom level |
| export_size_px | integer | 1024, 2048, or 4096 | 2048 | Resolution for exported image |

**Relationships:**
- ChartRenderConfig is an in-memory UI state object, not persisted
- Reads NatalChart, PlanetPosition, HouseCusp, and Aspect data

**Indexes:**
- None (not persisted)

**Validation Rules:**
- zoom_level: must be between 1.0 and 3.0
- aspect_filter: must contain at least one aspect type when show_aspects is true

**Example Data:**

```
{
  "view_mode": "traditional",
  "show_aspects": true,
  "aspect_filter": ["conjunction", "sextile", "square", "trine", "opposition"],
  "show_house_numbers": true,
  "show_degree_markers": true,
  "zoom_level": 1.0,
  "export_size_px": 2048
}
```

#### 3.7 Business Logic Rules

##### Planet Glyph Placement

**Purpose:** Positions planet glyphs on the chart wheel without visual overlap.

**Inputs:**
- planet_positions: list of PlanetPosition - all planets with their longitudes
- chart_radius: float - the radius of the zodiac ring in rendering units

**Logic:**

```
1. Sort planets by longitude ascending
2. FOR each planet:
     angular_position = planet.longitude (0 = Aries 0, clockwise on the zodiac)
     Convert angular_position to chart coordinates:
       chart_angle = (ascendant_longitude - planet.longitude + 180) mapped to canvas angle
       x = center_x + zodiac_ring_radius * cos(chart_angle)
       y = center_y - zodiac_ring_radius * sin(chart_angle)
3. Check for overlap: IF two or more planets have angular positions within 5 degrees of each other THEN
     Fan them out radially:
       offset each overlapping planet outward or inward by glyph_size * overlap_index
       Draw connecting lines from the fanned-out glyph to the actual longitude position on the zodiac ring
4. RETURN list of { planet, x, y, actual_longitude }
```

**Edge Cases:**
- Three or more planets conjunct (within 5 degrees): fan out in alternating directions (outward, inward, further outward)
- Planet at exact ASC position (9 o'clock): place normally; the ASC line does not obscure the glyph
- All 10 planets clustered in a 30-degree span: maximum fan-out may push glyphs significantly from their true position; always draw connecting lines

##### Aspect Line Rendering

**Purpose:** Draws colored lines between planets that form aspects.

**Inputs:**
- aspects: list of Aspect (from ST-010) - computed aspects with planet pairs and orbs
- planet_render_positions: list of { planet, x, y } from glyph placement

**Logic:**

```
1. FOR each aspect:
     Find the render positions of both planets in the aspect
     Determine line color:
       trine, sextile: blue (#4A90D9)
       square, opposition: red (#D94A4A)
       conjunction: green (#4AD97A)
     Determine line opacity: 1.0 - (orb / max_orb * 0.5)  (tighter orbs are more opaque)
     Determine line width:
       orb < 2: 2px
       orb 2-5: 1.5px
       orb 5+: 1px
     Draw line from planet1_position to planet2_position through the chart interior
2. Aspect lines are drawn beneath planet glyphs (z-order: zodiac ring > planet glyphs > aspect lines > house lines)
```

**Edge Cases:**
- Very tight conjunction (orb < 1 degree): draw a very short line or a combined glyph indicator instead of a full line
- Many aspect lines (15+): consider reducing opacity of wider-orb aspects to reduce visual clutter
- Aspect line passes through the chart center: this is expected and conventional

##### Chart Image Export

**Purpose:** Renders the chart as a high-resolution PNG image.

**Inputs:**
- chart_render_state: the current rendered chart including all visible elements
- export_size_px: integer - target image dimension (square)

**Logic:**

```
1. Create an offscreen canvas of export_size_px x export_size_px
2. Set background to dark theme background color
3. Re-render the chart at the export resolution (not a screenshot; a fresh render at higher resolution)
4. Add a subtle watermark in the bottom-right: "MyStars" in small text at 30% opacity
5. Include the profile name and birth data as small text below the chart
6. Encode as PNG
7. RETURN the image data
```

**Edge Cases:**
- Very large export (4096x4096): may take up to 3 seconds; show progress indicator
- Low-memory devices: fall back to 1024x1024 if 2048x2048 allocation fails

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Chart data not available | Message: "No chart data available. Calculate your natal chart first." with navigation button | User computes their natal chart |
| Glyph assets missing | Planets rendered as text abbreviations (Su, Mo, Me, Ve, Ma, Ju, Sa, Ur, Ne, Pl) instead of glyphs | App update restores glyph assets |
| Export fails (memory) | Toast: "Could not create chart image. Try a smaller size." | System retries at 1024x1024 |
| Rendering takes longer than 3 seconds | Loading overlay with "Rendering chart..." text | Automatic; user waits |
| Aspect data unavailable (ST-010 not computed) | Chart renders without aspect lines; note at bottom: "Calculate aspects to see aspect lines" | User triggers aspect calculation |

**Validation Timing:**
- Chart data availability checked on screen load
- Glyph asset availability checked at module initialization
- Export capability checked before starting export

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a natal chart has been computed for a profile with all 10 planets, 12 house cusps, and angles,
   **When** the user navigates to the Chart Wheel screen,
   **Then** a circular chart wheel is displayed with all 12 zodiac sign segments, all planet glyphs positioned at their correct longitudes, house cusp lines, and the Ascendant at the 9 o'clock position.

2. **Given** the chart is displayed with aspects computed,
   **When** the user views the chart,
   **Then** aspect lines connect planets with the correct colors (blue for trines/sextiles, red for squares/oppositions, green for conjunctions).

3. **Given** the user taps a planet glyph (e.g., Mars),
   **When** the tooltip appears,
   **Then** it shows "Mars in Gemini, 22 degrees 15 minutes, House 10, Direct" (or "Retrograde" if applicable).

4. **Given** the user taps the export icon,
   **When** the export completes,
   **Then** a 2048x2048 PNG image of the chart opens in the system share sheet, including the profile name and birth data.

**Edge Cases:**

5. **Given** three planets are within 4 degrees of each other (e.g., Sun at 15 Aries, Mercury at 17 Aries, Venus at 19 Aries),
   **When** the chart is rendered,
   **Then** the three glyphs are fanned out radially with connecting lines to their true positions, preventing overlap.

6. **Given** the user toggles from "Traditional" to "Modern" view,
   **When** the chart re-renders,
   **Then** glyphs are replaced with colored dots, aspect lines become thinner, and the visual style simplifies with a 300ms crossfade.

**Negative Tests:**

7. **Given** no natal chart has been computed for the selected profile,
   **When** the user navigates to the Chart Wheel screen,
   **Then** the screen shows "No chart data available. Calculate your natal chart first." with a button to the Natal Chart screen.
   **And** no empty or malformed chart wheel is rendered.

8. **Given** the export fails due to insufficient memory,
   **When** the error occurs,
   **Then** a toast shows "Could not create chart image. Try a smaller size." and the system retries at 1024x1024.
   **And** no corrupt or partial image file is saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts longitude to chart angle | longitude: 0, ascendant: 148.75 | chart_angle corresponding to Aries 0 at correct visual position |
| positions planet on zodiac ring | longitude: 90.0, radius: 200 | (x, y) on the ring at Leo 0 position |
| detects overlap between two planets | planet1: 45.0, planet2: 47.0 (within 5 degrees) | overlap = true |
| no overlap for distant planets | planet1: 45.0, planet2: 120.0 | overlap = false |
| fans out 3 overlapping glyphs | longitudes: [15.0, 17.0, 19.0] | Three positions offset radially with connecting lines |
| assigns correct aspect line color for trine | aspect_type: trine | color = #4A90D9 (blue) |
| assigns correct aspect line color for square | aspect_type: square | color = #D94A4A (red) |
| calculates line opacity from orb | orb: 2.0, max_orb: 8.0 | opacity = 1.0 - (2/8 * 0.5) = 0.875 |
| renders text fallback when glyph missing | glyph_available: false, body: mars | Rendered as "Ma" text |
| exports image at correct resolution | export_size_px: 2048 | Image dimensions = 2048 x 2048 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full chart render | 1. Compute natal chart, 2. Compute aspects, 3. Render chart wheel | Chart displays with all planets, houses, angles, and aspect lines correctly positioned |
| Chart render without aspects | 1. Compute natal chart (no aspects computed), 2. Render chart | Chart displays planets and houses; no aspect lines; note about calculating aspects shown |
| Image export flow | 1. Render chart, 2. Tap export, 3. Verify output | PNG image generated at 2048x2048 with all chart elements and profile metadata |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User views their birth chart wheel | 1. Create profile, 2. Compute natal chart, 3. Navigate to Chart Wheel, 4. Tap planets to see tooltips | Full chart wheel visible with interactive planet tooltips showing correct position data |
| User exports their chart as an image | 1. View chart wheel, 2. Tap export icon, 3. Save image | High-resolution PNG saved with chart wheel, profile name, and birth data |

---

### ST-007: Zodiac Compatibility (Synastry)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-007 |
| **Feature Name** | Zodiac Compatibility (Synastry) |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Compatibility Seeker, I want to compare my birth chart with another person's chart, so that I can understand our astrological compatibility and relationship dynamics.

**Secondary:**
> As a Casual Stargazer, I want a simple compatibility score between my sign and someone else's, so that I can get a quick sense of how we match astrologically.

#### 3.3 Detailed Description

Zodiac Compatibility (Synastry) compares two birth charts to analyze relationship dynamics. Synastry is the astrological technique of overlaying one person's chart onto another's to see how their planets interact. This feature computes inter-chart aspects (aspects between Person A's planets and Person B's planets), element compatibility, and an overall compatibility score.

The system offers two tiers of analysis. The "Quick Match" tier uses only sun signs and provides an element-based compatibility percentage (accessible even without full birth data). The "Full Synastry" tier uses all planet positions from both natal charts and performs a detailed aspect analysis, producing scores across five relationship dimensions: emotional connection (Moon-Moon, Moon-Venus aspects), communication (Mercury-Mercury aspects), attraction (Venus-Mars aspects), growth potential (Jupiter, Saturn aspects), and challenge areas (square and opposition aspects).

Each synastry analysis produces: an overall compatibility percentage (0-100%), dimension-specific scores, a list of the strongest inter-chart aspects (sorted by significance), and narrative interpretations for the top 5 aspects. The analysis is fully computed offline using the same aspect calculation logic as ST-010 but applied between two different charts instead of within a single chart.

Users select two profiles from their profile list to compare. The results are cached in the database and invalidated if either profile's natal chart is recalculated.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-001: Birth Profile Management - requires two profiles to compare
- ST-002: Natal Chart Calculation - requires natal charts for both profiles (for Full Synastry)
- ST-010: Aspect Calculations - uses inter-chart aspect computation logic

**External Dependencies:**
- Bundled synastry interpretation text library (approximately 300KB compressed): element compatibility descriptions, inter-chart aspect interpretations
- No network access required

**Assumed Capabilities:**
- At least two birth profiles exist
- Both profiles have computed natal charts (for Full Synastry; Quick Match requires only sun signs)

#### 3.5 User Interface Requirements

##### Screen: Compatibility Selection

**Layout:**
- The screen has a top navigation bar titled "Compatibility"
- Two profile selection areas arranged vertically (or side-by-side on wider screens):
  - "Person 1" card: shows currently selected profile name, sun sign glyph, and a "Change" button; defaults to the primary profile
  - "Person 2" card: shows "Select a profile" placeholder or the selected profile; tap opens a profile picker
- Below the profile cards, a "Compare" button (disabled until both profiles are selected and different)
- Below the button, a list of recent comparisons (up to 10) showing the two profile names and the overall compatibility percentage

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Initial | One profile pre-selected (primary) | Person 1 shows primary profile, Person 2 shows placeholder |
| Ready | Two different profiles selected | "Compare" button enabled |
| Invalid | Same profile selected for both | "Compare" button disabled, message: "Select two different profiles" |
| History | Past comparisons exist | Recent comparisons list below the compare button |
| Single Profile | Only one profile exists | Message: "Add another profile to compare compatibility" with link to Add Profile |

**Interactions:**
- Tap "Change" on Person 1: opens profile picker modal
- Tap Person 2 card: opens profile picker modal
- Tap "Compare": navigates to the Compatibility Results screen
- Tap a recent comparison: navigates directly to cached results

##### Screen: Compatibility Results

**Layout:**
- The screen has a top navigation bar with a back arrow and "Compatibility" title
- At the top, a header showing both profile names with their sun sign glyphs and a large overall compatibility percentage in a circular progress indicator
- Below the header, a "Quick Match" / "Full Synastry" toggle (Full Synastry available only if both charts are computed)
- In Quick Match mode:
  - Element compatibility card showing both sun sign elements (e.g., "Fire + Water") with a brief description
  - A compatibility bar (0-100%) based on element interaction
  - 2-3 paragraphs of sun-sign compatibility interpretation
- In Full Synastry mode, five dimension cards arranged vertically:
  - "Emotional Connection" - score (0-100%), brief description, key aspects
  - "Communication" - score (0-100%), brief description, key aspects
  - "Attraction" - score (0-100%), brief description, key aspects
  - "Growth Potential" - score (0-100%), brief description, key aspects
  - "Challenge Areas" - list of challenging aspects with brief descriptions
- Below the dimension cards, a "Top Aspects" section listing the 5 strongest inter-chart aspects with interpretations
- A "View Synastry Chart" button (future; links to overlaid chart wheel)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Quick Match | Only sun sign data available | Element compatibility and sun-sign interpretation only |
| Full Synastry | Both natal charts computed | Full five-dimension analysis with aspect details |
| Loading | Analysis is being computed | Loading indicator: "Comparing charts..." |
| Cached | Results were previously computed | Instant display from cache |

**Interactions:**
- Tap a dimension card: expands to show the list of contributing aspects and their individual descriptions
- Tap a top aspect: expands inline to show the full interpretation (2-3 paragraphs)
- Toggle Quick Match / Full Synastry: switches the analysis view
- Tap "View Synastry Chart": navigates to an overlaid chart wheel (future feature, placeholder shown)

**Transitions/Animations:**
- Overall compatibility percentage animates from 0% to the final value over 800ms (circular progress fill)
- Dimension cards stagger in with a 100ms delay between each
- Expanding a dimension card or aspect row uses a 200ms height animation

#### 3.6 Data Requirements

##### Entity: CompatibilityResult

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| profile_a_id | string | Foreign key to BirthProfile.id | None | First profile in the comparison |
| profile_b_id | string | Foreign key to BirthProfile.id | None | Second profile in the comparison |
| analysis_type | enum | One of: quick_match, full_synastry | quick_match | Type of analysis performed |
| overall_score | integer | 0 to 100 | None | Overall compatibility percentage |
| emotional_score | integer | 0 to 100, nullable | null | Emotional connection score (Full Synastry only) |
| communication_score | integer | 0 to 100, nullable | null | Communication score (Full Synastry only) |
| attraction_score | integer | 0 to 100, nullable | null | Attraction score (Full Synastry only) |
| growth_score | integer | 0 to 100, nullable | null | Growth potential score (Full Synastry only) |
| challenge_aspects | string | JSON array, max 3000 chars, nullable | null | Serialized challenging aspects (Full Synastry only) |
| top_aspects | string | JSON array, max 5000 chars | None | Serialized top 5 inter-chart aspects with interpretations |
| element_compatibility | string | Max 200 chars | None | Element pair description (e.g., "Fire + Water: Steamy but Volatile") |
| sun_sign_description | string | Max 2000 chars | None | Sun-sign compatibility narrative |
| computed_at | datetime | ISO 8601 | Current timestamp | When the analysis was computed |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- CompatibilityResult references two BirthProfile records (profile_a_id and profile_b_id)
- The pair (profile_a_id, profile_b_id) is logically unordered: comparing A to B is the same as B to A

**Indexes:**
- (profile_a_id, profile_b_id) - fast lookup; stored with smaller ID as profile_a_id
- computed_at - for cleanup of old results

**Validation Rules:**
- profile_a_id and profile_b_id must be different
- profile_a_id should always be the lexicographically smaller UUID (canonical ordering)
- overall_score: must be between 0 and 100
- Dimension scores: if analysis_type is full_synastry, all four dimension scores must be non-null
- Maximum 100 cached compatibility results per device; oldest purged on creation of new ones

**Example Data:**

```
{
  "id": "compat-001",
  "profile_a_id": "b7e3f1a2-9c4d-4e8f-a1b2-c3d4e5f60001",
  "profile_b_id": "c8f4g2b3-0d5e-5f9g-b2c3-d4e5f6a70002",
  "analysis_type": "full_synastry",
  "overall_score": 72,
  "emotional_score": 85,
  "communication_score": 68,
  "attraction_score": 78,
  "growth_score": 62,
  "challenge_aspects": "[{\"aspect\":\"Saturn square Venus\",\"orb\":1.5,\"description\":\"...\"}]",
  "top_aspects": "[{\"aspect\":\"Moon trine Venus\",\"orb\":0.8,\"score_impact\":+12,\"description\":\"...\"}]",
  "element_compatibility": "Fire + Water: Steamy but Volatile",
  "sun_sign_description": "Aries and Cancer can be a challenging but rewarding combination...",
  "computed_at": "2026-03-07T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Element Compatibility (Quick Match)

**Purpose:** Computes a basic compatibility percentage from element interactions.

**Inputs:**
- sign_a: enum - Person A's sun sign
- sign_b: enum - Person B's sun sign

**Logic:**

```
1. Look up element_a = element of sign_a
2. Look up element_b = element of sign_b
3. Base compatibility from element pair:
     Same element (Fire+Fire, Earth+Earth, etc.): 85%
     Fire + Air: 78%
     Earth + Water: 78%
     Fire + Earth: 45%
     Fire + Water: 50%
     Air + Earth: 48%
     Air + Water: 55%
4. Apply sign-specific modifier:
     Same sign (e.g., Aries+Aries): +5%
     Opposite signs (Aries+Libra, Taurus+Scorpio, etc.): +8% (opposites attract dynamic)
     Square signs (Aries+Cancer, Taurus+Leo, etc.): -5%
5. Clamp result to [20, 95]
6. RETURN overall_score
```

**Edge Cases:**
- Same person compared to self: blocked at selection stage; if somehow reached, return 100%
- Sign pairs are commutative: Aries+Cancer = Cancer+Aries

##### Full Synastry Scoring

**Purpose:** Computes detailed compatibility from inter-chart aspects.

**Inputs:**
- chart_a: NatalChart with PlanetPositions for Person A
- chart_b: NatalChart with PlanetPositions for Person B

**Logic:**

```
1. Compute all inter-chart aspects:
     FOR each planet_a in chart_a.planets:
       FOR each planet_b in chart_b.planets:
         Check all 5 aspect types with standard orbs (see ST-005 / ST-010)
         IF aspect found, record: { planet_a, planet_b, aspect_type, orb }
2. Score each dimension:
   EMOTIONAL (base = 50):
     Moon_a-Moon_b aspects: weight 3.0
     Moon-Venus aspects (either direction): weight 2.5
     Moon-Neptune aspects: weight 1.5
     Apply: +points for trines/sextiles/conjunctions, -points for squares/oppositions
   COMMUNICATION (base = 50):
     Mercury_a-Mercury_b: weight 3.0
     Mercury-Jupiter aspects: weight 2.0
     Mercury-Saturn aspects: weight 1.5
     Apply: same +/- logic
   ATTRACTION (base = 50):
     Venus_a-Mars_b or Mars_a-Venus_b: weight 3.0
     Venus-Venus: weight 2.0
     Mars-Mars: weight 1.5
     Apply: same +/- logic (note: squares and oppositions can indicate attraction too, so only -50% penalty instead of full)
   GROWTH (base = 50):
     Jupiter-Sun aspects: weight 2.5
     Saturn-Sun aspects: weight 2.0
     Jupiter-Moon aspects: weight 1.5
     Apply: same +/- logic
3. Clamp each dimension score to [0, 100]
4. overall_score = weighted average: emotional * 0.30 + communication * 0.20 + attraction * 0.25 + growth * 0.25
5. Identify challenge aspects: all inter-chart squares and oppositions with orb < 3
6. Identify top 5 aspects: sorted by (weight * (1 - orb/max_orb)) descending
7. RETURN CompatibilityResult
```

**Edge Cases:**
- No inter-chart aspects found (very rare): all dimension scores remain at baseline 50, overall = 50%
- One person lacks birth time: Moon position is approximate; emotional score carries a note about reduced accuracy
- All beneficial aspects: overall can reach up to 95% (capped)
- All challenging aspects: overall can drop to 20% (capped)

##### Compatibility Cache Invalidation

**Purpose:** Ensures compatibility results are recalculated when either natal chart changes.

**Inputs:**
- profile_id: string - the profile whose chart was recalculated

**Logic:**

```
1. Find all CompatibilityResult where profile_a_id = profile_id OR profile_b_id = profile_id
2. Delete all matching results
3. Display stale indicator on cached recent comparisons involving this profile
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Only one profile exists | Message: "Add another profile to compare compatibility" with link to Add Profile | User creates a second profile |
| Same profile selected for both | "Compare" button disabled, message: "Select two different profiles" | User selects a different profile |
| Natal chart missing for one profile (Full Synastry) | Full Synastry toggle disabled; Quick Match only with note: "Calculate both natal charts for full synastry analysis" | User computes the missing natal chart |
| Computation takes longer than 3 seconds | Loading indicator remains visible: "Comparing charts..." | Automatic; user waits |
| Interpretation text missing for an aspect | Placeholder: "Interpretation coming soon." | App update includes the missing text |
| Cache has 100 results and new one is created | Oldest result purged | Automatic cleanup |

**Validation Timing:**
- Profile selection validation on tap ("Compare" button enabled only when valid)
- Chart availability check before starting Full Synastry computation
- Result validation after computation (scores within range)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** two profiles exist with computed natal charts,
   **When** the user selects both profiles and taps "Compare",
   **Then** the Compatibility Results screen shows an overall percentage, five dimension scores, top 5 aspects with interpretations, and element compatibility.

2. **Given** two profiles exist but only one has a computed natal chart,
   **When** the user selects both and taps "Compare",
   **Then** the Quick Match analysis is displayed using sun signs; the Full Synastry toggle is disabled with a note to compute both charts.

3. **Given** a compatibility result was previously computed for profiles A and B,
   **When** the user selects A and B again and taps "Compare",
   **Then** the cached result is displayed immediately without recomputation.

4. **Given** the user views a Full Synastry result with an emotional score of 85,
   **When** the user taps the "Emotional Connection" card,
   **Then** it expands to show the contributing aspects (e.g., "Moon trine Venus, orb 0.8") with brief interpretations.

**Edge Cases:**

5. **Given** profiles A and B have no inter-chart aspects within orb,
   **When** Full Synastry is computed,
   **Then** all dimension scores show 50 (baseline), overall shows 50%, and a note reads "No strong inter-chart aspects detected."

6. **Given** profile B's natal chart is recalculated,
   **When** the user views a previous A-B compatibility result,
   **Then** the cached result is invalidated, and a "Recalculate" button appears to generate fresh results.

**Negative Tests:**

7. **Given** only one profile exists,
   **When** the user opens the Compatibility screen,
   **Then** the screen shows "Add another profile to compare compatibility" with a link to Add Profile.
   **And** the "Compare" button is not visible.

8. **Given** the user selects the same profile for both Person 1 and Person 2,
   **When** the selection is made,
   **Then** the "Compare" button remains disabled and a message reads "Select two different profiles."
   **And** no computation is attempted.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes element compatibility for Fire+Air | Aries + Gemini | base = 78, no sign modifier, result = 78 |
| computes element compatibility for same sign | Aries + Aries | base = 85 + 5 = 90 |
| computes element compatibility for opposites | Aries + Libra | base = 48 + 8 = 56 |
| computes element compatibility for Fire+Water | Leo + Pisces | base = 50, no special modifier, result = 50 |
| clamps compatibility to minimum 20 | Hypothetical -10 before clamp | result = 20 |
| scores emotional dimension with Moon trine Venus | Moon_a trine Venus_b, orb 0.8 | emotional_score > 50 (positive contribution) |
| scores attraction with Venus square Mars | Venus_a square Mars_b, orb 2.0 | attraction_score slightly below 50 (reduced penalty for attraction squares) |
| canonical ordering of profile IDs | profile_a: "zzz", profile_b: "aaa" | Stored as profile_a_id = "aaa", profile_b_id = "zzz" |
| overall score weighted average | emotional: 80, communication: 60, attraction: 70, growth: 50 | overall = 80*0.30 + 60*0.20 + 70*0.25 + 50*0.25 = 24 + 12 + 17.5 + 12.5 = 66 |
| invalidates cache on chart recalculation | profile_id: "A", existing result for A+B | Result for A+B deleted |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Quick Match comparison | 1. Create profiles with sun signs only, 2. Compare | Element compatibility and sun-sign description returned |
| Full Synastry comparison | 1. Create two profiles with full data, 2. Compute both charts, 3. Compare | Five dimension scores, overall score, top aspects, and challenge aspects returned |
| Cache invalidation | 1. Compare A and B, 2. Recalculate B's chart, 3. Check cached result | Previous result deleted, fresh computation required |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User compares compatibility with a friend | 1. Select primary profile, 2. Select friend's profile, 3. Tap Compare, 4. View results, 5. Tap dimension cards | Full synastry results with animated percentage, dimension cards that expand to show contributing aspects |
| User checks quick compatibility without full chart | 1. Create profile with date only (no time/location), 2. Create second profile, 3. Compare | Quick Match results shown with element compatibility; Full Synastry toggle disabled |

---

### ST-008: Planetary Transit Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-008 |
| **Feature Name** | Planetary Transit Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Dedicated Practitioner, I want to see which current planetary transits are making aspects to my natal chart, so that I can understand the astrological influences currently affecting my life.

**Secondary:**
> As a Spiritual Explorer, I want to be notified when a significant transit begins, so that I can prepare for and work with the energy rather than being caught off guard.

#### 3.3 Detailed Description

Planetary Transit Tracking compares the current positions of the planets (from ST-004) against the user's natal chart (from ST-002) to identify active and upcoming transits. A transit occurs when a currently moving planet forms an aspect (conjunction, sextile, square, trine, or opposition) to a planet in the user's natal chart. Transits are the primary mechanism by which astrologers interpret how the current "cosmic weather" affects an individual.

The feature displays three views: Active Transits (aspects currently in orb), Upcoming Transits (aspects that will become exact within the next 30 days), and Recent Transits (aspects that were exact within the past 14 days). Each transit entry shows the transiting planet, the natal planet being aspected, the aspect type, the current orb, the date the aspect becomes exact (or was exact), and an interpretation.

Transit significance is tiered. Outer planet transits (Saturn, Uranus, Neptune, Pluto to natal planets) are "Major" transits - rare and long-lasting (weeks to months). Inner planet transits (Sun, Moon, Mercury, Venus, Mars) are "Minor" transits - common and brief (hours to days). Users can filter by transit significance.

The system computes upcoming transit dates by projecting planet positions forward in daily increments and checking for aspect formation. Moon transits are computed at 2-hour increments due to the Moon's rapid motion (approximately 13 degrees per day). The computation is performed in the background when the user has an active profile, and results are cached for quick access.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-001: Birth Profile Management - requires a birth profile
- ST-002: Natal Chart Calculation - requires natal planet positions to transit against
- ST-004: Planet Position Calculator - provides current and projected planet positions
- ST-010: Aspect Calculations - uses aspect detection logic with standard orbs

**External Dependencies:**
- Bundled Swiss Ephemeris data files (same as ST-002/ST-004)
- Bundled transit interpretation text library (approximately 400KB compressed)

**Assumed Capabilities:**
- A natal chart has been computed for the primary profile
- Background computation capability for projecting upcoming transits

#### 3.5 User Interface Requirements

##### Screen: Transit Timeline

**Layout:**
- The screen has a top navigation bar titled "Transits" with a filter icon on the right
- Below the navigation bar, a segmented control with three options: "Active", "Upcoming", "Recent"
- Below the segmented control, a filter chip row: "All", "Major Only", "Minor Only"
- The main content area is a vertical scrollable list of transit cards
- Each transit card displays:
  - A significance badge: "Major" (orange) or "Minor" (gray)
  - Transit name (e.g., "Saturn square natal Moon")
  - Transiting planet glyph and natal planet glyph connected by an aspect symbol
  - Current orb (e.g., "orb: 2.3 degrees")
  - Date range: "Exact: March 15, 2026" (for upcoming/recent) or "Active since Feb 28" (for active)
  - For active transits, a progress bar showing the transit's progress from entering orb to exact to leaving orb
  - A brief 1-2 sentence summary of the transit's meaning
- Tapping a transit card expands it to show a detailed 3-5 paragraph interpretation
- Below the transit list, a "Transit Calendar" link navigates to a monthly calendar view showing transit dates

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active Tab | Viewing currently active transits | List of transits currently within orb, sorted by tightest orb first |
| Upcoming Tab | Viewing upcoming transits | List of transits becoming exact within 30 days, sorted by date |
| Recent Tab | Viewing past transits | List of transits that were exact within the past 14 days, sorted by most recent first |
| Filtered | "Major Only" or "Minor Only" selected | List filtered to show only matching significance |
| Empty | No transits match the current filter/tab | Message: "No [active/upcoming/recent] transits found." with suggestion to check other tabs |
| Loading | Transit computation in progress | Loading shimmer with text: "Scanning the sky..." |
| No Chart | Natal chart not computed | Message: "Calculate your natal chart to track transits" with navigation button |

**Interactions:**
- Tap segmented control: switches between Active, Upcoming, and Recent views
- Tap filter chip: toggles between All, Major Only, Minor Only
- Tap a transit card: expands to show detailed interpretation
- Tap "Transit Calendar": navigates to a monthly calendar view with transit dates marked
- Pull-to-refresh: recalculates current transit positions and updates orbs

**Transitions/Animations:**
- Segmented control switches with a 200ms slide transition on the content
- Transit cards stagger in with a 50ms delay between each
- Expanding a transit card uses a 250ms height animation
- Progress bar on active transits animates to current position over 300ms

##### Screen: Transit Calendar (Sub-screen)

**Layout:**
- A monthly calendar grid with left/right arrows for month navigation
- Days with transits show a small colored dot (orange for Major, gray for Minor)
- Tapping a day shows a list of transits exact on that day below the calendar
- The current day is highlighted

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Current month displayed | Calendar with transit dots, today highlighted |
| Day Selected | User tapped a specific day | Transit list for that day appears below the calendar |
| No Transits | Selected day has no transits | Message: "No transits on this day" |

#### 3.6 Data Requirements

##### Entity: TransitEvent

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| profile_id | string | Foreign key to BirthProfile.id | None | The profile being transited |
| transiting_body | enum | One of: sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto | None | The currently moving planet |
| natal_body | enum | One of: sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto, chiron, north_node, ascendant, midheaven | None | The natal placement being aspected |
| aspect_type | enum | One of: conjunction, sextile, square, trine, opposition | None | The type of aspect formed |
| significance | enum | One of: major, minor | None | Whether this is a major or minor transit |
| current_orb | float | 0.0 to max_orb for the aspect type | None | Current angular distance from exact aspect |
| exact_date | string | ISO 8601 date (YYYY-MM-DD) | None | Date the aspect becomes (or was) exact |
| entering_orb_date | string | ISO 8601 date, nullable | null | Date the transit enters orb |
| leaving_orb_date | string | ISO 8601 date, nullable | null | Date the transit leaves orb |
| is_applying | boolean | - | None | Whether the transit is applying (approaching exact) or separating |
| interpretation_brief | string | Max 300 chars | None | 1-2 sentence summary |
| interpretation_full | string | Max 3000 chars | None | 3-5 paragraph detailed interpretation |
| computed_at | datetime | ISO 8601 | Current timestamp | When this transit was last computed |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- TransitEvent belongs to BirthProfile (many-to-one via profile_id)

**Indexes:**
- (profile_id, exact_date) - fast lookup of transits by date
- (profile_id, transiting_body, natal_body, aspect_type) - prevent duplicate transit entries
- exact_date - for calendar view queries

**Validation Rules:**
- transiting_body and natal_body must be different (a planet does not transit itself)
- exact_date must be within the range: today minus 14 days to today plus 30 days
- current_orb must not exceed the max orb for the aspect type
- significance = "major" if transiting_body is one of: saturn, uranus, neptune, pluto; otherwise "minor"

**Example Data:**

```
{
  "id": "transit-001",
  "profile_id": "b7e3f1a2-9c4d-4e8f-a1b2-c3d4e5f60001",
  "transiting_body": "saturn",
  "natal_body": "moon",
  "aspect_type": "square",
  "significance": "major",
  "current_orb": 2.3,
  "exact_date": "2026-03-15",
  "entering_orb_date": "2026-02-28",
  "leaving_orb_date": "2026-04-01",
  "is_applying": true,
  "interpretation_brief": "Saturn square your natal Moon brings emotional tests and responsibilities. You may feel burdened by obligations.",
  "interpretation_full": "This is one of the more challenging transits...",
  "computed_at": "2026-03-07T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Transit Detection

**Purpose:** Identifies current and upcoming transits between moving planets and natal positions.

**Inputs:**
- natal_positions: list of PlanetPosition from the natal chart
- date_range: { start: date (today - 14 days), end: date (today + 30 days) }

**Logic:**

```
1. FOR each day in date_range (step = 1 day, except Moon which uses 2-hour steps):
     Compute current positions for all transiting bodies at noon UTC
2. FOR each transiting_body in [sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto]:
     FOR each natal_body in natal_positions (including ascendant and midheaven):
       FOR each day in the computed range:
         angle = abs(transiting_longitude - natal_longitude)
         IF angle > 180 THEN angle = 360 - angle
         FOR each aspect in [conjunction(0), sextile(60), square(90), trine(120), opposition(180)]:
           orb = abs(angle - aspect.exact_angle)
           IF orb <= aspect.max_orb THEN
             Record transit event with the current orb
             Identify the exact_date as the day when the orb is smallest
             Determine entering_orb_date and leaving_orb_date from the first and last days within orb
             Set is_applying = true if the orb is decreasing
3. Merge transit events that span multiple days into single TransitEvent entries
4. Classify significance: major if transiting_body is saturn/uranus/neptune/pluto, minor otherwise
5. Look up interpretation text from bundled library
6. RETURN list of TransitEvent
```

**Edge Cases:**
- Retrograde station within orb: a transit may become exact, separate, station retrograde, and become exact again; record as a single event with multiple exact dates (store earliest)
- Moon transits: very frequent (Moon aspects each natal planet roughly every 27.3 days); filter to only show Moon transits on the Active tab when within 2-degree orb
- Transiting planet conjunct natal planet of the same type (e.g., transiting Saturn conjunct natal Saturn = "Saturn Return"): label as a named event

##### Transit Progress Calculation

**Purpose:** Computes the progress bar position for an active transit.

**Inputs:**
- entering_orb_date: date
- exact_date: date
- leaving_orb_date: date
- current_date: date

**Logic:**

```
1. total_duration = leaving_orb_date - entering_orb_date (in days)
2. elapsed = current_date - entering_orb_date (in days)
3. progress = elapsed / total_duration
4. Clamp progress to [0.0, 1.0]
5. RETURN progress
```

**Edge Cases:**
- entering_orb_date is null (transit was already in orb before computation window): set progress start to 0.0
- leaving_orb_date is null (transit extends beyond computation window): cap progress at current position

##### Significance Classification

**Purpose:** Determines whether a transit is major or minor.

**Inputs:**
- transiting_body: enum

**Logic:**

```
1. major_bodies = [saturn, uranus, neptune, pluto]
2. IF transiting_body is in major_bodies THEN
     RETURN "major"
3. ELSE
     RETURN "minor"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Natal chart not computed | Message: "Calculate your natal chart to track transits" with button | User computes natal chart |
| Transit computation takes longer than 5 seconds | Loading indicator with "Scanning the sky..." remains visible | Automatic; user waits |
| Ephemeris data missing | Error: "Astronomical data files are missing. Please reinstall the app." | User reinstalls |
| Interpretation text missing for a transit | Placeholder: "Interpretation coming soon." | App update |
| Background computation fails | Transits show stale data with note: "Last updated: [timestamp]" | Pull-to-refresh to retry |
| No transits found in any tab | Empty state message with suggestion: "The sky is quiet. Check back tomorrow." | User returns later |

**Validation Timing:**
- Natal chart existence check on screen load
- Transit computation runs in background on module enable and daily thereafter
- Orb updates run on screen visit (current positions recalculated)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a primary profile with a computed natal chart,
   **When** the user opens the Transit Timeline screen on the "Active" tab,
   **Then** a list of currently active transits is displayed, each showing the transit name, aspect symbol, current orb, significance badge, and a progress bar.

2. **Given** Saturn is currently at 14 degrees Pisces and the user's natal Moon is at 16 degrees Gemini (square aspect, orb 2 degrees),
   **When** the Active tab loads,
   **Then** a "Major" transit card appears: "Saturn square natal Moon, orb: 2.0 degrees, Exact: March 15, 2026" with a progress bar showing approaching exact.

3. **Given** the user switches to the "Upcoming" tab,
   **When** the tab loads,
   **Then** transits becoming exact within the next 30 days are listed, sorted by date, each with the expected exact date.

4. **Given** the user taps a transit card,
   **When** the card expands,
   **Then** a 3-5 paragraph interpretation is displayed explaining the transit's significance and suggestions.

**Edge Cases:**

5. **Given** no major transits are currently active,
   **When** the user selects "Major Only" filter,
   **Then** the list is empty with message: "No major transits currently active. Check the Upcoming tab."

6. **Given** a transit is retrograding back through the exact aspect point,
   **When** the transit card is displayed,
   **Then** a note appears: "This transit is revisiting due to retrograde motion" and the progress bar reflects the re-approach.

**Negative Tests:**

7. **Given** the natal chart has not been computed,
   **When** the user opens Transit Timeline,
   **Then** the screen shows "Calculate your natal chart to track transits" with a navigation button.
   **And** no transit cards or tabs are displayed.

8. **Given** the ephemeris data is corrupted,
   **When** transit computation is attempted,
   **Then** an error is displayed: "Astronomical data files are missing. Please reinstall the app."
   **And** no partial or incorrect transit data is shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects active transit within orb | transiting Saturn at 14 Pisces, natal Moon at 16 Gemini | Square aspect detected, orb = 2.0 |
| classifies Saturn transit as major | transiting_body: saturn | significance = "major" |
| classifies Venus transit as minor | transiting_body: venus | significance = "minor" |
| computes transit progress midpoint | entering: day 0, exact: day 10, leaving: day 20, current: day 10 | progress = 0.5 |
| computes transit progress at start | current = entering_orb_date | progress = 0.0 |
| identifies applying transit | current_orb decreasing from previous day | is_applying = true |
| identifies separating transit | current_orb increasing from previous day | is_applying = false |
| merges multi-day transit into single event | 7 consecutive days within orb | One TransitEvent with entering_orb_date and leaving_orb_date spanning 7 days |
| filters Moon transits to 2-degree orb on Active | Moon transit with orb 3.5 | Not shown on Active tab |
| handles retrograde re-approach | transit separates then re-approaches | Single event with note about retrograde |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full transit scan for 44-day window | 1. Compute natal chart, 2. Run transit detection for today-14 to today+30 | TransitEvent list with active, upcoming, and recent entries |
| Transit update on screen visit | 1. View transits at time T1, 2. Wait 60 seconds, 3. View again | Current orbs updated to reflect planet movement |
| Filter by significance | 1. View all transits, 2. Select "Major Only" | Only saturn/uranus/neptune/pluto transits shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User discovers active transits | 1. Open Transits tab, 2. View Active list, 3. Tap a major transit, 4. Read interpretation | Transit details expanded with full interpretation text |
| User checks upcoming transits for planning | 1. Open Transits tab, 2. Switch to Upcoming, 3. Tap Transit Calendar, 4. Select a date | Calendar view shows transit dots, selected date shows transit list |

---

### ST-009: Moon Phase Calendar

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-009 |
| **Feature Name** | Moon Phase Calendar |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Spiritual Explorer, I want to see a calendar showing all moon phases for the month with their zodiac signs, so that I can plan my activities and intentions around lunar cycles.

**Secondary:**
> As a Casual Stargazer, I want to know when the next full moon and new moon are, so that I can observe them and understand their astrological significance.

#### 3.3 Detailed Description

The Moon Phase Calendar provides a dedicated monthly calendar view showing all eight moon phases for each lunation cycle, the zodiac sign the Moon occupies each day, and the times of exact phase transitions. The Moon moves through the entire zodiac roughly every 27.3 days (sidereal month) and completes a full phase cycle every 29.53 days (synodic month), making it the fastest-changing astrological factor.

The calendar displays each day with a small moon phase icon and the Moon's zodiac sign. Key phase transitions (New Moon, First Quarter, Full Moon, Last Quarter) are highlighted with larger icons and the exact time of the transition. Between these four key phases, the intermediate phases (Waxing Crescent, Waxing Gibbous, Waning Gibbous, Waning Crescent) are shown with proportionally filled moon icons.

Each phase has associated astrological meanings: New Moon (new beginnings, setting intentions), Waxing Crescent (building momentum), First Quarter (taking action, overcoming obstacles), Waxing Gibbous (refining, adjusting), Full Moon (culmination, release, heightened emotions), Waning Gibbous (gratitude, sharing), Last Quarter (letting go, reassessing), Waning Crescent (rest, surrender, preparation for the new cycle).

Users can tap any day to see detailed information: the Moon's exact zodiac sign and degree, the moon phase with illumination percentage, and a brief astrological interpretation of the day's lunar energy. A "Void-of-Course" indicator shows periods when the Moon makes no more major aspects before changing signs, traditionally considered unfavorable times for starting new ventures.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-004: Planet Position Calculator - provides Moon position computation for any date

**External Dependencies:**
- Bundled Swiss Ephemeris data files (for Moon position computation)
- Bundled moon phase interpretation text (approximately 100KB compressed): 8 phase descriptions, 12 Moon-in-sign descriptions

**Assumed Capabilities:**
- The planet position calculator is functional
- The user can navigate to this screen from the main tab bar

#### 3.5 User Interface Requirements

##### Screen: Moon Calendar

**Layout:**
- The screen has a top navigation bar titled "Moon Phases" with left/right arrows for month navigation
- Below the navigation bar, a month/year header (e.g., "March 2026")
- The main content area is a monthly calendar grid (7 columns for days of the week, 4-6 rows)
- Each day cell contains:
  - The day number
  - A small moon phase icon (filled/empty circle with proportional illumination)
  - A tiny zodiac sign glyph below the phase icon
- Key phase days (New Moon, First Quarter, Full Moon, Last Quarter) have a highlighted background and the phase name in small text below the icon
- Below the calendar grid, a "This Month's Lunation" summary card shows:
  - New Moon: date, time, zodiac sign
  - First Quarter: date, time, zodiac sign
  - Full Moon: date, time, zodiac sign
  - Last Quarter: date, time, zodiac sign
- Below the summary, a "Moon Sign Timeline" shows a horizontal bar for each zodiac sign the Moon transits this month, with date ranges (e.g., "Aries: Mar 3-5, Cancer: Mar 10-12")
- Today's cell has a ring highlight

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Current Month | Default view | Calendar for the current month with today highlighted |
| Past Month | Navigated backward | Calendar for the selected past month |
| Future Month | Navigated forward (up to 12 months) | Calendar for the selected future month |
| Day Selected | User tapped a day cell | Day detail sheet appears below the calendar |
| Loading | Moon data being computed for a new month | Brief shimmer on the calendar grid (under 500ms) |

**Interactions:**
- Tap left/right arrows: navigate to previous/next month (maximum 12 months forward, 12 months backward from current month)
- Tap a day cell: opens a day detail card below the calendar showing:
  - Moon phase name, illumination percentage, and phase icon
  - Moon zodiac sign, degree, and minute
  - Moon phase interpretation (2-3 sentences)
  - Void-of-Course indicator if applicable (start time, end time, note)
- Tap today's cell (if not current month): "Return to Today" button appears

**Transitions/Animations:**
- Month navigation slides the calendar left/right (250ms)
- Day detail card slides up from below the calendar (200ms)
- Moon phase icons fade between phases as the user scrubs through days
- Key phase days have a subtle glow animation on first render (300ms pulse)

##### Card: Day Detail

**Layout:**
- A card that appears below the calendar when a day is tapped
- Shows: moon phase icon (large), phase name, illumination percentage
- Moon sign: glyph, name, degree and minute
- Void-of-Course status: if active, shows "Void-of-Course from [time] to [time]" with a brief explanation
- Phase interpretation: 2-3 sentences about the energy of this phase
- Moon-in-sign interpretation: 2-3 sentences about the Moon's sign

#### 3.6 Data Requirements

##### Entity: MoonCalendarDay (Computed, Cached)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| date | string | ISO 8601 date, primary key | None | The calendar date |
| moon_longitude | float | 0.0 to 359.999 | None | Moon's ecliptic longitude at noon local time |
| moon_sign | enum | One of the 12 zodiac signs | None | Moon's zodiac sign |
| moon_degree | integer | 0 to 29 | None | Degree within the sign |
| moon_minute | integer | 0 to 59 | None | Minute of arc |
| phase_name | enum | One of the 8 phase names | None | Named moon phase |
| phase_angle | float | 0.0 to 359.999 | None | Angular distance from Sun |
| illumination_pct | float | 0.0 to 100.0 | None | Illumination percentage |
| is_key_phase | boolean | - | false | Whether this is a New/First Quarter/Full/Last Quarter day |
| key_phase_time | string | HH:MM in local time, nullable | null | Exact time of key phase transition (null if not a key phase day) |
| void_of_course_start | string | HH:MM in local time, nullable | null | Start of Void-of-Course period |
| void_of_course_end | string | HH:MM in local time, nullable | null | End of Void-of-Course period |

**Relationships:**
- MoonCalendarDay is a cached computation result
- One entry per date per month computed

**Indexes:**
- date (primary key)
- (month, year) composite for month-view queries

**Validation Rules:**
- illumination_pct must be between 0.0 and 100.0
- phase_name must be consistent with phase_angle (see ST-004 phase angle ranges)
- key_phase_time must be non-null only when is_key_phase is true
- void_of_course_start must be before void_of_course_end when both are present

**Example Data:**

```
{
  "date": "2026-03-14",
  "moon_longitude": 353.2,
  "moon_sign": "pisces",
  "moon_degree": 23,
  "moon_minute": 12,
  "phase_name": "full_moon",
  "phase_angle": 180.3,
  "illumination_pct": 100.0,
  "is_key_phase": true,
  "key_phase_time": "10:55",
  "void_of_course_start": null,
  "void_of_course_end": null
}
```

#### 3.7 Business Logic Rules

##### Monthly Moon Data Computation

**Purpose:** Computes moon phase and sign data for every day in a given month.

**Inputs:**
- year: integer
- month: integer (1-12)
- user_timezone: string - IANA timezone for local time display

**Logic:**

```
1. FOR each day in the month:
     a. Compute Moon position at noon local time using ST-004 engine
     b. Compute Sun position at noon local time
     c. Derive phase_angle, phase_name, and illumination_pct using ST-004 Moon Phase logic
     d. Derive moon_sign, moon_degree, moon_minute from moon_longitude
     e. Set is_key_phase = true if this day contains a key phase transition
2. Identify key phase days:
     FOR each consecutive pair of days:
       IF phase_angle crosses 0, 90, 180, or 270 between day N and day N+1 THEN
         day N+1 is a key phase day
         Compute exact key_phase_time by interpolation (binary search between day N noon and day N+1 noon to find the exact crossing)
         Key phase mapping: 0 = New Moon, 90 = First Quarter, 180 = Full Moon, 270 = Last Quarter
3. Compute Void-of-Course periods:
     FOR each day:
       a. Compute all major aspects (conjunction, sextile, square, trine, opposition) the Moon makes to other planets during the day
       b. Find the last aspect before the Moon changes sign
       c. void_of_course_start = time of the last aspect
       d. void_of_course_end = time the Moon enters the next sign
       e. If the void period is shorter than 30 minutes, do not display it
4. Cache results for the month
```

**Edge Cases:**
- Months with two Full Moons (Blue Moon): both are marked as key phase days
- Void-of-Course spanning midnight: split across two day entries (end on day 1, start of next sign on day 2)
- Moon sign changes mid-day: display the sign at noon; the Day Detail card shows both signs with transition time

##### Key Phase Exact Time (Interpolation)

**Purpose:** Finds the exact time a key moon phase occurs within a day.

**Inputs:**
- phase_angle_at_noon_prev: float - phase angle at noon on the previous day
- phase_angle_at_noon_curr: float - phase angle at noon on the current day
- target_angle: float - the phase angle to find (0, 90, 180, or 270)

**Logic:**

```
1. binary search between noon_prev and noon_curr (24-hour window, 12 iterations for approximately 5-second precision):
     mid_time = (start + end) / 2
     Compute phase_angle at mid_time
     IF phase_angle is closer to target from the correct direction THEN
       narrow the window
2. Convert the resulting UTC time to user_timezone
3. Round to the nearest minute
4. RETURN key_phase_time as HH:MM
```

**Edge Cases:**
- Phase angle wraps around 360 to 0 at New Moon: handle wrap-around in the comparison
- DST transitions during the search window: all computation in UTC, convert to local only for display

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Ephemeris data missing | Error: "Astronomical data files are missing. Please reinstall the app." | User reinstalls |
| Month computation takes longer than 2 seconds | Loading shimmer remains visible | Automatic; user waits |
| Navigating beyond 12 months forward or backward | Navigation arrows disabled | User stays within the 24-month window |
| Void-of-Course computation fails | Void-of-Course data omitted for affected days; no error shown (graceful degradation) | Data available on app update or retry |
| Moon position computation produces invalid data | Affected day cell shows moon icon but no sign data; tapping shows "Data unavailable for this day" | Pull-to-refresh or return to screen later |

**Validation Timing:**
- Ephemeris availability checked at module initialization
- Month data validation after computation (all 28-31 days have valid data)
- Void-of-Course validation: start < end, duration >= 30 minutes

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Moon Phase Calendar for the current month,
   **When** the calendar loads,
   **Then** all days display a moon phase icon and zodiac sign glyph; key phase days (New Moon, First Quarter, Full Moon, Last Quarter) are highlighted with phase names and the "This Month's Lunation" summary shows all four key phases with dates, times, and zodiac signs.

2. **Given** the user taps a day showing a Full Moon,
   **When** the Day Detail card appears,
   **Then** it shows "Full Moon, 100% illuminated" with the Moon's zodiac sign, degree, and a 2-3 sentence interpretation.

3. **Given** the user navigates to the next month,
   **When** the month transition completes,
   **Then** the calendar slides to the right and displays the next month's data with all phases and signs computed.

4. **Given** a Void-of-Course period occurs on March 10 from 3:45 PM to 8:20 PM,
   **When** the user taps March 10,
   **Then** the Day Detail card shows "Void-of-Course: 3:45 PM to 8:20 PM" with a brief explanation.

**Edge Cases:**

5. **Given** a month has two Full Moons (a Blue Moon scenario),
   **When** the calendar loads,
   **Then** both Full Moon days are highlighted, and the second is labeled "Blue Moon" in the Lunation summary.

6. **Given** the Moon changes sign mid-day (e.g., from Aries to Taurus at 2:30 PM),
   **When** the user taps that day,
   **Then** the Day Detail shows "Moon in Aries until 2:30 PM, then Taurus" with both sign descriptions.

**Negative Tests:**

7. **Given** the user navigates 12 months forward,
   **When** the user attempts to navigate further forward,
   **Then** the right arrow is disabled and no month beyond the 12-month window can be viewed.
   **And** no error is shown; the arrow simply does not respond.

8. **Given** the Moon position computation fails for a specific day,
   **When** that day is rendered,
   **Then** the moon icon is displayed (generic phase estimate) but no sign glyph appears; tapping shows "Data unavailable for this day."
   **And** other days render normally.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes moon sign for known date | 2026-03-14 12:00 UTC | Moon in Pisces (approximately 353 degrees longitude) |
| identifies Full Moon day from phase angle crossing | day N angle: 175, day N+1 angle: 185 | day N+1 is key phase Full Moon |
| identifies New Moon day from angle wrapping 360 to 0 | day N angle: 355, day N+1 angle: 5 | day N+1 is key phase New Moon |
| interpolates key phase time | angle crosses 180 between noon and midnight | Returns HH:MM within 1 minute of actual Full Moon |
| computes Void-of-Course period | last aspect at 15:45, sign change at 20:20 | void_of_course_start: "15:45", void_of_course_end: "20:20" |
| skips short Void-of-Course | last aspect at 15:45, sign change at 16:10 (25 min) | No Void-of-Course recorded (< 30 min threshold) |
| generates 28 days for February | year: 2026, month: 2 | 28 MoonCalendarDay entries |
| generates 31 days for March | year: 2026, month: 3 | 31 MoonCalendarDay entries |
| handles mid-day sign change | Moon at 29 degrees Aries noon, 1 degree Taurus at midnight | Sign change noted with approximate transition time |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full month computation | 1. Compute March 2026 moon data | 31 days with valid phases, signs, and 4 key phase transitions |
| Key phase time accuracy | 1. Compute Full Moon time for March 2026, 2. Compare to published ephemeris | Exact time within 5 minutes of reference |
| Void-of-Course detection | 1. Compute a month, 2. Verify VoC periods | Multiple VoC periods detected with valid start/end times |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User checks this month's moon phases | 1. Open Moon Calendar, 2. View current month, 3. Tap a key phase day, 4. Read interpretation | Calendar shows all phases, tapped day shows detail card with phase info and interpretation |
| User plans around Void-of-Course | 1. Open Moon Calendar, 2. Find a day with VoC indicator, 3. Tap to view times | VoC start and end times displayed with explanation |

---

### ST-010: Aspect Calculations

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-010 |
| **Feature Name** | Aspect Calculations |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Dedicated Practitioner, I want to see all the aspects between planets in my natal chart, so that I can understand the geometric relationships that shape my personality and life themes.

**Secondary:**
> As a Casual Stargazer, I want a simple explanation of which planets in my chart support each other and which create tension, so that I can understand my strengths and growth areas.

#### 3.3 Detailed Description

Aspect Calculations compute the angular relationships between all pairs of planets in a natal chart. An aspect is a specific angular separation between two planets that is considered significant in astrology. The five major aspects are: conjunction (0 degrees), sextile (60 degrees), square (90 degrees), trine (120 degrees), and opposition (180 degrees). Each aspect has an associated "orb" - the maximum angular deviation from exactness that is still considered active.

This feature computes all aspects between the 10 core planets plus optional bodies, producing a complete aspect grid and an aspect list. The aspect grid (also called an aspectarian) is a triangular matrix showing the aspect type (if any) between every pair of planets. The aspect list presents the same data as an ordered list, sorted by tightness of orb (most exact aspects first).

Each aspect is classified by its nature: "harmonious" (trines, sextiles), "challenging" (squares, oppositions), or "combined" (conjunctions, which can be either depending on the planets involved). The feature also computes a chart "signature" - a summary of how many harmonious vs. challenging aspects the chart contains, giving an overall sense of whether the chart is predominantly flowing or dynamic.

Aspects are the backbone of chart interpretation and are used by nearly every other feature: Birth Chart Visualization (ST-006) draws aspect lines, Transit Tracking (ST-008) detects transit aspects, Synastry (ST-007) computes inter-chart aspects, and Daily Horoscope (ST-005) identifies the day's active aspects.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-002: Natal Chart Calculation - provides planet positions to compute aspects between

**External Dependencies:**
- Bundled aspect interpretation text library (approximately 200KB compressed): interpretations for all valid planet pairs and aspect types

**Assumed Capabilities:**
- A natal chart has been computed with planet positions

#### 3.5 User Interface Requirements

##### Screen: Aspect Grid

**Layout:**
- The screen has a top navigation bar titled "Aspects" with a toggle to switch between "Grid" and "List" views
- In Grid view:
  - A triangular matrix (10x10 for core planets) with planet glyphs along the top and left edges
  - Each cell shows the aspect glyph (if an aspect exists between the row and column planets) or is empty
  - Aspect glyphs are color-coded: blue for trines/sextiles, red for squares/oppositions, green for conjunctions
  - Tapping a cell with an aspect shows a tooltip with the aspect details and orb
- In List view:
  - A vertical scrollable list of all aspects sorted by tightness (tightest orb first)
  - Each row shows: planet pair glyphs, aspect type with glyph, orb in degrees and minutes, and a brief 1-sentence interpretation
  - Tapping a row expands it to show a 2-3 paragraph detailed interpretation
- Below the grid/list, a "Chart Signature" card summarizes:
  - Number of harmonious aspects (trines + sextiles)
  - Number of challenging aspects (squares + oppositions)
  - Number of conjunctions
  - A brief one-line assessment (e.g., "A dynamic chart with strong growth potential through challenges")

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Grid View | Default or user-selected | Triangular aspect grid with color-coded glyphs |
| List View | User toggled to list | Sorted aspect list with expandable interpretations |
| No Chart | Chart data unavailable | Message: "Calculate your natal chart to view aspects" with button |
| Empty | No aspects found (extremely rare) | Message: "No major aspects detected in your chart" |
| Loading | Aspects being computed | Brief shimmer (under 500ms) |

**Interactions:**
- Toggle Grid/List: switches between the two views with a 200ms crossfade
- Tap a grid cell: shows a tooltip with "Mars trine Jupiter, orb 1.5 degrees" and a brief interpretation
- Tap a list row: expands to show 2-3 paragraph detailed interpretation
- Tap the Chart Signature card: expands to show a paragraph-length description of what the chart signature means

**Transitions/Animations:**
- Grid cells fade in with a 20ms stagger (top-left to bottom-right)
- List rows stagger in with a 40ms delay
- Tooltip appears with a 150ms scale-up animation
- List row expansion uses a 200ms height animation

#### 3.6 Data Requirements

##### Entity: Aspect

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| chart_id | string | Foreign key to NatalChart.id | None | The natal chart these aspects belong to |
| body_a | enum | One of the planet enums (sun through pluto, plus optionals) | None | First planet in the aspect pair |
| body_b | enum | One of the planet enums | None | Second planet in the aspect pair |
| aspect_type | enum | One of: conjunction, sextile, square, trine, opposition | None | The type of aspect |
| exact_angle | float | One of: 0, 60, 90, 120, 180 | None | The exact angle for this aspect type |
| actual_angle | float | 0.0 to 180.0 | None | The actual angular separation between the two bodies |
| orb | float | 0.0 to max_orb for the aspect type | None | Deviation from exact aspect |
| nature | enum | One of: harmonious, challenging, combined | None | Classification of the aspect |
| is_applying | boolean | - | None | Whether the faster planet is moving toward exact aspect |
| interpretation_brief | string | Max 200 chars | None | 1-sentence interpretation |
| interpretation_full | string | Max 2000 chars | None | 2-3 paragraph detailed interpretation |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- Aspect belongs to NatalChart (many-to-one via chart_id)
- body_a is always the planet with the lower enum index (canonical ordering)

**Indexes:**
- chart_id - retrieve all aspects for a chart
- (chart_id, body_a, body_b) unique - prevent duplicate aspects for a planet pair

**Validation Rules:**
- body_a must have a lower enum index than body_b (canonical ordering: sun < moon < mercury < ... < pluto)
- body_a and body_b must be different
- orb must not exceed the max orb for the aspect type
- nature = "harmonious" if aspect_type is trine or sextile; "challenging" if square or opposition; "combined" if conjunction
- actual_angle must be between 0 and 180 (using the shorter arc)

**Example Data:**

```
{
  "id": "asp-001",
  "chart_id": "c1d2e3f4-5678-90ab-cdef-123456789002",
  "body_a": "mars",
  "body_b": "jupiter",
  "aspect_type": "trine",
  "exact_angle": 120.0,
  "actual_angle": 121.5,
  "orb": 1.5,
  "nature": "harmonious",
  "is_applying": false,
  "interpretation_brief": "Mars trine Jupiter brings confident action and fortunate timing.",
  "interpretation_full": "With Mars in a flowing trine to Jupiter in your natal chart..."
}
```

#### 3.7 Business Logic Rules

##### Aspect Detection

**Purpose:** Computes all aspects between planet pairs in a natal chart.

**Inputs:**
- planet_positions: list of PlanetPosition - all planets from the natal chart

**Logic:**

```
1. Define aspect parameters:
     conjunction: exact = 0, max_orb = 8
     sextile: exact = 60, max_orb = 6
     square: exact = 90, max_orb = 7
     trine: exact = 120, max_orb = 8
     opposition: exact = 180, max_orb = 8
2. FOR each pair (body_a, body_b) where body_a_index < body_b_index:
     angle = abs(body_a.longitude - body_b.longitude)
     IF angle > 180 THEN angle = 360 - angle
     FOR each aspect_type in [conjunction, sextile, square, trine, opposition]:
       orb = abs(angle - aspect_type.exact)
       IF orb <= aspect_type.max_orb THEN
         nature = harmonious if trine/sextile, challenging if square/opposition, combined if conjunction
         is_applying = determine from planet speeds and direction
         Record Aspect { body_a, body_b, aspect_type, actual_angle: angle, orb, nature, is_applying }
         BREAK  (a planet pair can form at most one aspect; use the tightest)
3. Sort aspects by orb ascending (tightest first)
4. RETURN list of Aspect
```

**Edge Cases:**
- A planet pair within orb of two different aspects (e.g., 52 degrees is within orb of both sextile at 60 and square at 90): use the aspect with the tighter orb
- Aspect exactly at 0 orb: rare but valid; mark as exact
- Sun-Moon aspects: always computed; these are among the most important in a natal chart

##### Chart Signature Computation

**Purpose:** Summarizes the aspect balance of a chart.

**Inputs:**
- aspects: list of Aspect

**Logic:**

```
1. Count harmonious_count = number of aspects where nature = harmonious
2. Count challenging_count = number of aspects where nature = challenging
3. Count conjunction_count = number of aspects where nature = combined
4. total = harmonious_count + challenging_count + conjunction_count
5. IF total = 0 THEN assessment = "No major aspects detected"
6. ELSE IF harmonious_count > challenging_count * 1.5 THEN
     assessment = "A flowing chart with natural ease and talent"
7. ELSE IF challenging_count > harmonious_count * 1.5 THEN
     assessment = "A dynamic chart with strong growth potential through challenges"
8. ELSE
     assessment = "A balanced chart blending ease with growth through tension"
9. RETURN { harmonious_count, challenging_count, conjunction_count, assessment }
```

**Edge Cases:**
- Zero aspects (extremely rare, requires very specific planet positions): assessment = "No major aspects detected"
- All conjunctions, no other aspects: assessment = "A concentrated chart with powerful focused energy"

##### Applying vs. Separating Determination

**Purpose:** Determines whether an aspect is applying (getting tighter) or separating (getting wider).

**Inputs:**
- body_a: PlanetPosition with speed
- body_b: PlanetPosition with speed
- current_angle: float

**Logic:**

```
1. relative_speed = body_a.speed - body_b.speed
2. Compute what the angle would be slightly in the future:
     future_angle = current_angle + (relative_speed * 0.01)  (0.01 day = about 14 minutes)
     Normalize future_angle to 0-180 range
3. IF future_angle < current_angle THEN
     The planets are getting closer: is_applying = true
4. ELSE
     The planets are moving apart: is_applying = false
```

**Edge Cases:**
- One planet is stationary (speed near 0): the other planet determines the direction
- Both planets retrograde: relative motion still determines applying/separating

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Natal chart not computed | Message: "Calculate your natal chart to view aspects" with button | User computes chart |
| Planet position data missing for a body | That body is excluded from aspect calculation; note: "Some planets excluded due to missing data" | User recalculates chart |
| Interpretation text missing for an aspect | Placeholder: "Interpretation coming soon." | App update |
| Aspect computation fails | Error: "Could not calculate aspects. Try recalculating your chart." with retry button | User recalculates chart |

**Validation Timing:**
- Chart data availability checked on screen load
- Aspect validation (orb within range, valid planet pairs) after computation
- Interpretation text lookup on render

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a natal chart with 10 planet positions,
   **When** the user opens the Aspects screen in Grid view,
   **Then** a 10x10 triangular grid is displayed with color-coded aspect glyphs in cells where aspects exist, and empty cells where no aspect is formed.

2. **Given** the chart has Mars at 120.5 degrees and Jupiter at 122.0 degrees (trine, orb 1.5 degrees),
   **When** the user taps the Mars-Jupiter cell in the grid,
   **Then** a tooltip shows "Mars trine Jupiter, orb: 1 degree 30 minutes" with a brief interpretation.

3. **Given** the user switches to List view,
   **When** the list renders,
   **Then** aspects are sorted by tightness (tightest orb first), each with planet pair, aspect type, orb, and a brief interpretation; tapping expands to show the full interpretation.

4. **Given** the chart has 5 trines, 3 squares, and 2 conjunctions,
   **When** the Chart Signature card is displayed,
   **Then** it shows "Harmonious: 5, Challenging: 3, Conjunctions: 2" with the assessment "A balanced chart blending ease with growth through tension."

**Edge Cases:**

5. **Given** a planet pair is within orb of both sextile (orb 5.8) and square (orb 6.5),
   **When** aspects are computed,
   **Then** only the sextile (tighter orb) is recorded; the square is not.

6. **Given** an aspect has an orb of exactly 0.0 degrees,
   **When** it appears in the list,
   **Then** it is displayed as "Exact" instead of "orb: 0 degrees 0 minutes."

**Negative Tests:**

7. **Given** the natal chart has not been computed,
   **When** the user opens the Aspects screen,
   **Then** the screen shows "Calculate your natal chart to view aspects" with a navigation button.
   **And** no grid or list is rendered.

8. **Given** planet position data is missing for Mercury (data corruption),
   **When** aspects are computed,
   **Then** all aspects involving Mercury are excluded, a note appears "Some planets excluded due to missing data," and all other aspects render normally.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects conjunction at 0 orb | body_a: 120.0, body_b: 120.0 | conjunction, orb = 0.0 |
| detects conjunction within orb | body_a: 123.0, body_b: 120.0 | conjunction, orb = 3.0 |
| rejects conjunction outside orb | body_a: 130.0, body_b: 120.0 | No aspect (orb = 10.0 > max 8) |
| detects trine across signs | body_a: 10.0, body_b: 130.0 | trine, orb = 0.0 |
| detects opposition across 0 | body_a: 5.0, body_b: 185.0 | opposition, orb = 0.0 |
| handles wrap-around for opposition | body_a: 350.0, body_b: 170.0 | opposition, orb = 0.0 |
| classifies trine as harmonious | aspect_type: trine | nature = harmonious |
| classifies square as challenging | aspect_type: square | nature = challenging |
| classifies conjunction as combined | aspect_type: conjunction | nature = combined |
| computes chart signature balanced | 4 harmonious, 3 challenging, 2 conjunctions | assessment = "A balanced chart..." |
| computes chart signature flowing | 8 harmonious, 2 challenging, 1 conjunction | assessment = "A flowing chart..." |
| determines applying aspect | body_a speed faster toward body_b | is_applying = true |
| determines separating aspect | body_a speed away from body_b | is_applying = false |
| canonical ordering of planet pair | body_a: jupiter, body_b: mars | Stored as body_a: mars, body_b: jupiter |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full aspect computation | 1. Compute natal chart, 2. Compute all aspects | List of aspects with valid types, orbs, and nature classifications |
| Aspect grid population | 1. Compute aspects, 2. Render grid | Grid cells correctly populated with aspect glyphs for all detected aspects |
| Aspect interpretation lookup | 1. Compute aspect Mars trine Jupiter, 2. Look up interpretation | Non-empty brief and full interpretation strings returned |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User explores their chart aspects | 1. Compute natal chart, 2. Open Aspects screen, 3. View grid, 4. Tap a cell, 5. Switch to list, 6. Expand an aspect | Grid shows color-coded aspects, tooltip shows details, list shows sorted aspects with expandable interpretations |
| User reads their chart signature | 1. View Aspects screen, 2. Scroll to Chart Signature card, 3. Tap to expand | Signature card shows aspect counts and expanded assessment paragraph |

---

### ST-011: Personality Insights

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-011 |
| **Feature Name** | Personality Insights |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Casual Stargazer, I want to see a personality profile based on my birth chart that goes beyond just my sun sign, so that I can gain deeper self-understanding through astrology.

**Secondary:**
> As a Dedicated Practitioner, I want to see how the distribution of elements, qualities, and planets across my chart creates a holistic personality portrait, so that I can identify my dominant themes and potential blind spots.

#### 3.3 Detailed Description

Personality Insights generates a comprehensive personality analysis derived from the natal chart. Rather than presenting raw astronomical data, this feature translates the chart into human-readable personality descriptions organized around key life themes: identity, emotions, communication, relationships, drive, growth, discipline, innovation, intuition, and transformation (mapped to Sun through Pluto respectively).

The analysis includes three components. First, an Element Balance showing the distribution of planets across Fire, Earth, Air, and Water elements, with implications for the user's temperament (e.g., heavy Fire emphasis suggests energy and impulsiveness; low Water suggests difficulty accessing emotions). Second, a Quality Balance showing the distribution across Cardinal, Fixed, and Mutable qualities, indicating whether the user tends to initiate, sustain, or adapt. Third, a Planet Theme Profile showing 10 life theme sections - one for each planet - with an interpretation that accounts for the planet's sign, house, and aspects.

The Element Balance and Quality Balance are computed from the planet positions: each planet in a sign contributes to that sign's element and quality count. The Sun and Moon are weighted at 2x (double weight) because they are the most personally significant bodies. The dominant element and dominant quality define the chart's overall temperament.

All content is assembled from a bundled interpretation library (not AI-generated), ensuring consistent quality and offline availability. The total interpretation text library for Personality Insights is approximately 350KB compressed (10 planets x 12 signs x 12 houses = 1,440 base combinations, with aspect modifiers applied programmatically).

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-002: Natal Chart Calculation - requires planet positions, house placements
- ST-010: Aspect Calculations - aspects modify personality interpretations

**External Dependencies:**
- Bundled personality interpretation text library (approximately 350KB compressed)
- No network access required

**Assumed Capabilities:**
- A natal chart has been computed for the selected profile
- Aspects have been computed for the chart

#### 3.5 User Interface Requirements

##### Screen: Personality Profile

**Layout:**
- The screen has a top navigation bar with the profile name and "Personality" title
- The screen is vertically scrollable with distinct sections:
- **Element Balance Section:**
  - A horizontal bar chart showing 4 bars (Fire, Earth, Air, Water) with lengths proportional to the weighted count
  - Each bar is colored by element (Fire: orange-red, Earth: green-brown, Air: light blue, Water: deep blue)
  - Below the chart, a "Dominant Element" label (e.g., "Dominant: Fire - Your chart is driven by passion, energy, and action")
  - A brief 2-3 sentence description of the element balance implications
- **Quality Balance Section:**
  - A horizontal bar chart showing 3 bars (Cardinal, Fixed, Mutable)
  - Below, "Dominant Quality" label and brief description
- **Planet Themes Section:**
  - 10 collapsible sections, one per planet (Sun through Pluto), ordered by personal significance:
    1. Sun - Identity and Ego
    2. Moon - Emotions and Inner World
    3. Mercury - Communication and Thinking
    4. Venus - Love and Values
    5. Mars - Drive and Action
    6. Jupiter - Growth and Opportunity
    7. Saturn - Discipline and Responsibility
    8. Uranus - Innovation and Change
    9. Neptune - Intuition and Spirituality
    10. Pluto - Transformation and Power
  - Each section header shows: planet glyph, theme name, sign glyph and name (e.g., "Mars in Gemini"), and house number
  - When expanded, shows 2-3 paragraphs covering: personality traits from the sign, life area focus from the house, and modifications from aspects to this planet
- **Strengths and Growth Areas Section:**
  - A summary card listing 3-5 "Strengths" (derived from trines and sextiles to personal planets)
  - A summary card listing 3-5 "Growth Areas" (derived from squares and oppositions)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Complete | All data available | Full personality profile with all sections |
| No Aspects | Aspects not computed | Planet themes show sign and house only; strengths/growth areas unavailable with note to compute aspects |
| No Chart | Natal chart not computed | Message: "Calculate your natal chart to see personality insights" with button |
| Loading | Analysis being assembled | Loading shimmer on all sections |

**Interactions:**
- Tap an element bar: shows a tooltip listing which planets are in that element
- Tap a quality bar: shows a tooltip listing which planets have that quality
- Tap a planet theme header: toggles expansion (200ms height animation)
- Tap a strength or growth area item: shows a brief explanation of which aspect creates it

**Transitions/Animations:**
- Element and Quality bars animate from 0 to their final width over 500ms with staggered start
- Planet theme sections stagger in with 60ms delay
- Expanding a planet theme uses 200ms height animation

#### 3.6 Data Requirements

##### Entity: PersonalityAnalysis (Computed, Cached)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| chart_id | string | Foreign key to NatalChart.id, unique | None | The natal chart this analysis is derived from |
| fire_count | float | 0.0 to 12.0 | None | Weighted count of planets in Fire signs |
| earth_count | float | 0.0 to 12.0 | None | Weighted count of planets in Earth signs |
| air_count | float | 0.0 to 12.0 | None | Weighted count of planets in Air signs |
| water_count | float | 0.0 to 12.0 | None | Weighted count of planets in Water signs |
| dominant_element | enum | One of: fire, earth, air, water | None | The element with the highest weighted count |
| cardinal_count | float | 0.0 to 12.0 | None | Weighted count of planets in Cardinal signs |
| fixed_count | float | 0.0 to 12.0 | None | Weighted count of planets in Fixed signs |
| mutable_count | float | 0.0 to 12.0 | None | Weighted count of planets in Mutable signs |
| dominant_quality | enum | One of: cardinal, fixed, mutable | None | The quality with the highest weighted count |
| strengths | string | JSON array, max 3000 chars | None | Serialized list of 3-5 strengths with aspect sources |
| growth_areas | string | JSON array, max 3000 chars | None | Serialized list of 3-5 growth areas with aspect sources |
| planet_themes | string | JSON object, max 15000 chars | None | Serialized planet theme interpretations |
| computed_at | datetime | ISO 8601 | Current timestamp | When the analysis was generated |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- PersonalityAnalysis belongs to NatalChart (one-to-one via chart_id)

**Indexes:**
- chart_id (unique) - fast lookup by chart

**Validation Rules:**
- fire_count + earth_count + air_count + water_count must equal the total weighted planet count (12.0 for 10 planets with Sun and Moon at 2x)
- cardinal_count + fixed_count + mutable_count must equal the same total (12.0)
- strengths must contain 3-5 items
- growth_areas must contain 3-5 items (or fewer if chart has fewer than 3 challenging aspects)

**Example Data:**

```
{
  "id": "pers-001",
  "chart_id": "c1d2e3f4-5678-90ab-cdef-123456789002",
  "fire_count": 4.0,
  "earth_count": 2.0,
  "air_count": 3.0,
  "water_count": 3.0,
  "dominant_element": "fire",
  "cardinal_count": 5.0,
  "fixed_count": 4.0,
  "mutable_count": 3.0,
  "dominant_quality": "cardinal",
  "strengths": "[\"Natural leadership from Sun trine Jupiter\",\"Creative communication from Mercury sextile Venus\"]",
  "growth_areas": "[\"Managing impulsiveness from Mars square Uranus\",\"Emotional boundaries from Moon opposition Pluto\"]",
  "planet_themes": "{\"sun\":{\"sign\":\"aries\",\"house\":7,\"text\":\"...\"},\"moon\":{\"sign\":\"cancer\",\"house\":10,\"text\":\"...\"}}"
}
```

#### 3.7 Business Logic Rules

##### Element Balance Computation

**Purpose:** Counts the weighted distribution of planets across the four elements.

**Inputs:**
- planet_positions: list of PlanetPosition

**Logic:**

```
1. Initialize counts = { fire: 0, earth: 0, air: 0, water: 0 }
2. Element mapping:
     fire = [aries, leo, sagittarius]
     earth = [taurus, virgo, capricorn]
     air = [gemini, libra, aquarius]
     water = [cancer, scorpio, pisces]
3. FOR each planet in planet_positions:
     weight = 2.0 if planet.body is sun or moon, else 1.0
     element = lookup element for planet.zodiac_sign
     counts[element] += weight
4. dominant_element = element with highest count
5. IF tie: prefer the element of the Sun sign
6. RETURN { fire_count, earth_count, air_count, water_count, dominant_element }
```

**Edge Cases:**
- All planets in one element: dominant is that element with count 12.0
- Perfect three-way tie (extremely rare): prefer Sun's element
- Optional bodies (Chiron, North Node, Lilith) are NOT included in element/quality counts

##### Quality Balance Computation

**Purpose:** Counts the weighted distribution of planets across the three qualities.

**Inputs:**
- planet_positions: list of PlanetPosition

**Logic:**

```
1. Initialize counts = { cardinal: 0, fixed: 0, mutable: 0 }
2. Quality mapping:
     cardinal = [aries, cancer, libra, capricorn]
     fixed = [taurus, leo, scorpio, aquarius]
     mutable = [gemini, virgo, sagittarius, pisces]
3. FOR each planet in planet_positions:
     weight = 2.0 if planet.body is sun or moon, else 1.0
     quality = lookup quality for planet.zodiac_sign
     counts[quality] += weight
4. dominant_quality = quality with highest count
5. IF tie: prefer the quality of the Sun sign
6. RETURN { cardinal_count, fixed_count, mutable_count, dominant_quality }
```

##### Strengths and Growth Areas Extraction

**Purpose:** Derives personality strengths from harmonious aspects and growth areas from challenging aspects.

**Inputs:**
- aspects: list of Aspect

**Logic:**

```
1. Sort harmonious aspects (trines, sextiles) by orb ascending
2. Take the top 5 tightest harmonious aspects
3. FOR each, generate a strength statement: "[Planet A theme] supported by [Planet B theme]" from the interpretation library
4. Sort challenging aspects (squares, oppositions) by orb ascending
5. Take the top 5 tightest challenging aspects
6. FOR each, generate a growth area statement: "[Tension between Planet A theme and Planet B theme]"
7. IF fewer than 3 harmonious aspects: pad with generic sign-based strengths
8. IF fewer than 3 challenging aspects: pad with generic sign-based growth areas
9. RETURN { strengths: list of 3-5 strings, growth_areas: list of 3-5 strings }
```

**Edge Cases:**
- No harmonious aspects: use 3 generic strengths based on Sun/Moon/Rising signs
- No challenging aspects: use 3 generic growth areas based on element/quality imbalance

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Natal chart not computed | Message: "Calculate your natal chart to see personality insights" with button | User computes chart |
| Aspects not computed | Planet themes render without aspect modifiers; strengths/growth areas show note: "Compute aspects for a complete personality profile" | User computes aspects |
| Interpretation text missing | Placeholder: "Interpretation coming soon." for the specific planet/sign/house | App update |
| Computation fails | Error: "Could not generate personality insights. Try again." | User retries |

**Validation Timing:**
- Chart data availability checked on screen load
- Aspect availability checked for strengths/growth areas section
- Interpretation text lookup validated on render

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a natal chart with aspects computed,
   **When** the user opens the Personality Profile screen,
   **Then** the Element Balance shows 4 animated bars with the dominant element highlighted, the Quality Balance shows 3 bars with the dominant quality, and 10 planet theme sections are listed with sign and house placements.

2. **Given** the chart has Sun and Moon both in Fire signs plus Mars in Leo,
   **When** the Element Balance is computed,
   **Then** Fire has a count of at least 6.0 (Sun 2x + Moon 2x + Mars 1x + any other Fire planet), and the dominant element is "Fire."

3. **Given** the chart has 4 trines and 3 squares,
   **When** the Strengths and Growth Areas section is displayed,
   **Then** at least 3 strengths are listed (derived from the tightest trines) and at least 3 growth areas (from the tightest squares).

4. **Given** the user taps "Mars in Gemini - House 10",
   **When** the section expands,
   **Then** 2-3 paragraphs are displayed covering Mars in Gemini traits, 10th house career focus, and aspect-modified notes.

**Edge Cases:**

5. **Given** all 10 planets are in Water signs,
   **When** the Element Balance is computed,
   **Then** Water count is 12.0, all other elements are 0.0, and the assessment notes the extreme Water emphasis.

6. **Given** no aspects have been computed yet,
   **When** the Personality Profile screen loads,
   **Then** planet themes show sign and house only (no aspect modifiers), and a note reads "Compute aspects for a complete personality profile."

**Negative Tests:**

7. **Given** the natal chart has not been computed,
   **When** the user opens Personality Insights,
   **Then** the screen shows "Calculate your natal chart to see personality insights" with a button.
   **And** no partial or placeholder personality data is shown.

8. **Given** the interpretation library is missing the entry for "Mars in Gemini, House 10",
   **When** the Mars theme section is expanded,
   **Then** placeholder text "Interpretation coming soon." is displayed.
   **And** no crash occurs.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| counts Fire elements correctly | Sun in Aries (2x), Moon in Leo (2x), Mars in Sagittarius (1x) | fire_count = 5.0 |
| weights Sun at 2x | Sun in Taurus | earth_count includes 2.0 from Sun |
| weights Moon at 2x | Moon in Cancer | water_count includes 2.0 from Moon |
| weights other planets at 1x | Mars in Aries | fire_count includes 1.0 from Mars |
| total element count equals 12.0 | Any valid 10-planet chart | fire + earth + air + water = 12.0 |
| identifies dominant element with clear leader | fire: 5, earth: 3, air: 2, water: 2 | dominant_element = fire |
| breaks tie using Sun sign | fire: 4, earth: 4, Sun in Aries (fire) | dominant_element = fire |
| counts Cardinal quality correctly | Sun in Aries (2x), Moon in Cancer (2x), Mars in Libra (1x) | cardinal_count = 5.0 |
| extracts top 5 strengths from harmonious aspects | 7 trines/sextiles sorted by orb | Top 5 returned, sorted by tightness |
| generates generic strengths when < 3 harmonious | 1 trine only | 3 strengths: 1 from trine + 2 generic |
| excludes optional bodies from element count | Chart includes Chiron in Aries | Chiron NOT counted in fire_count |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full personality analysis | 1. Compute chart, 2. Compute aspects, 3. Generate personality analysis | PersonalityAnalysis with valid element/quality counts, planet themes, strengths, and growth areas |
| Analysis without aspects | 1. Compute chart (no aspects), 2. Generate analysis | Element/quality counts valid; planet themes without aspect modifiers; strengths/growth areas generic |
| Cache invalidation on chart change | 1. Generate analysis, 2. Edit profile, 3. Recalculate chart | Previous PersonalityAnalysis deleted, new one generated |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User explores their personality profile | 1. Compute chart and aspects, 2. Open Personality screen, 3. View element balance, 4. Expand planet themes | Element bars animate, dominant element highlighted, planet themes expand with full interpretations |
| User discovers strengths and growth areas | 1. View Personality screen, 2. Scroll to Strengths/Growth Areas, 3. Tap items to see aspect sources | Strengths and growth areas listed with expandable explanations linking to specific aspects |

---

### ST-012: Birth Chart Explanations

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-012 |
| **Feature Name** | Birth Chart Explanations |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Casual Stargazer, I want to understand what each element of my birth chart means in simple language, so that I can learn astrology through my own chart rather than through abstract textbooks.

**Secondary:**
> As a Dedicated Practitioner, I want a quick reference for each placement in my chart with both beginner and advanced interpretations, so that I can refresh my knowledge or share explanations with friends.

#### 3.3 Detailed Description

Birth Chart Explanations provides an educational layer on top of the natal chart data. While ST-002 computes the chart and ST-006 visualizes it, this feature explains what each placement, house, aspect, and sign actually means in accessible language. It transforms raw chart data into a guided learning experience.

The feature is structured as a series of explanation cards organized into categories: "What Are Signs?" (12 zodiac sign descriptions), "What Are Planets?" (10 planet descriptions covering what each planet rules), "What Are Houses?" (12 house descriptions covering life areas), "What Are Aspects?" (5 aspect type descriptions), and "Your Placements" (personalized explanations for each planet-sign-house combination in the user's chart).

Each explanation has two depth levels: a "Beginner" explanation (1-2 sentences, no jargon) and an "Advanced" explanation (2-3 paragraphs with astrological terminology). Users can toggle between beginner and advanced mode globally, and the setting persists.

The "Your Placements" section is the most valuable. For each planet in the user's chart, it shows the planet's role, the sign's influence, and the house's life area, composed into a personalized paragraph. For example: "Your Mars is in Gemini in the 10th House. Mars governs drive and action. In Gemini, your energy is versatile and mentally-oriented - you fight with words rather than fists. In the 10th House of career and public image, this placement suggests a career involving communication, writing, or multitasking."

The content library includes 12 sign descriptions, 10 planet descriptions, 12 house descriptions, 5 aspect descriptions, and 10 x 12 x 12 = 1,440 planet-sign-house combination texts. Total bundled content is approximately 500KB compressed.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-002: Natal Chart Calculation - provides planet positions and house placements for personalized explanations

**External Dependencies:**
- Bundled explanation text library (approximately 500KB compressed)
- No network access required

**Assumed Capabilities:**
- For "Your Placements" section: a natal chart must be computed
- The educational content (Signs, Planets, Houses, Aspects) is accessible without a natal chart

#### 3.5 User Interface Requirements

##### Screen: Learn Astrology

**Layout:**
- The screen has a top navigation bar titled "Learn" with a toggle for "Beginner" / "Advanced" on the right
- The main content is organized as collapsible category sections:
- **Your Placements** (shown first if a chart exists):
  - A vertical list of 10 cards (one per planet), each showing: planet glyph, "Your [Planet] in [Sign], House [N]", and a brief personalized explanation
  - Tapping a card expands to show the full explanation (2-3 paragraphs in beginner or advanced mode)
- **What Are Signs?:**
  - A grid of 12 zodiac sign cards (3x4) with glyphs and names
  - Tapping a sign opens its explanation
- **What Are Planets?:**
  - A vertical list of 10 planet cards with glyphs, names, and keywords
  - Tapping opens the full explanation
- **What Are Houses?:**
  - A vertical list of 12 house cards with house numbers and life area names
  - Tapping opens the full explanation
- **What Are Aspects?:**
  - A vertical list of 5 aspect cards with glyphs, names, and nature (harmonious/challenging)
  - Tapping opens the full explanation

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| With Chart | Natal chart computed | "Your Placements" section shown first with personalized content |
| Without Chart | No chart computed | "Your Placements" hidden; generic educational content only; banner: "Calculate your chart for personalized explanations" |
| Beginner Mode | Default or user-selected | Short, jargon-free explanations |
| Advanced Mode | User toggled | Longer explanations with astrological terminology |

**Interactions:**
- Toggle Beginner/Advanced: switches all visible explanations to the selected depth (persisted preference)
- Tap a category header: collapses or expands the section
- Tap a card: expands to show the full explanation
- Tap a zodiac sign in the grid: opens an inline expansion with the sign's explanation

**Transitions/Animations:**
- Card expansion uses a 200ms height animation
- Category collapse/expand uses a 250ms animation
- Depth toggle crossfades text content over 150ms

#### 3.6 Data Requirements

##### Entity: ExplanationContent (Bundled Static Data)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key (e.g., "sign_aries", "planet_mars", "house_10", "aspect_trine") | N/A | Content identifier |
| category | enum | One of: sign, planet, house, aspect | N/A | Content category |
| name | string | Max 100 chars | N/A | Display name (e.g., "Aries", "Mars", "10th House", "Trine") |
| keywords | string | Max 200 chars | N/A | Key concepts (e.g., "Drive, Action, Passion, Conflict") |
| beginner_text | string | Max 500 chars | N/A | Simple 1-2 sentence explanation |
| advanced_text | string | Max 3000 chars | N/A | Detailed 2-3 paragraph explanation |

##### Entity: PlacementExplanation (Bundled Static Data)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key (e.g., "mars_gemini_10") | N/A | Composite key |
| body | enum | One of the 10 core planets | N/A | The planet |
| sign | enum | One of the 12 zodiac signs | N/A | The sign placement |
| house | integer | 1 to 12 | N/A | The house placement |
| beginner_text | string | Max 800 chars | N/A | Personalized beginner explanation |
| advanced_text | string | Max 3000 chars | N/A | Personalized advanced explanation |

**Relationships:**
- Both entities are read-only bundled static data
- PlacementExplanation is keyed by (body, sign, house) - 1,440 entries total

**Indexes:**
- ExplanationContent: (category, id) for category-based retrieval
- PlacementExplanation: (body, sign, house) for fast lookup

**Validation Rules:**
- All 12 sign explanations must exist
- All 10 planet explanations must exist
- All 12 house explanations must exist
- All 5 aspect explanations must exist
- All 1,440 placement explanations should exist; missing entries trigger a fallback to generic planet-sign text

**Example Data:**

```
{
  "id": "planet_mars",
  "category": "planet",
  "name": "Mars",
  "keywords": "Drive, Action, Passion, Conflict, Energy",
  "beginner_text": "Mars represents how you take action and assert yourself. It shows what motivates you and how you handle conflict.",
  "advanced_text": "Mars is the planet of drive, ambition, and physical energy. In the natal chart, Mars reveals your assertive style..."
}
```

```
{
  "id": "mars_gemini_10",
  "body": "mars",
  "sign": "gemini",
  "house": 10,
  "beginner_text": "Your drive (Mars) is expressed through communication and ideas (Gemini) in the area of career and public image (10th House). You are likely energized by mentally stimulating work.",
  "advanced_text": "Mars in Gemini in the 10th House creates a dynamic professional identity driven by intellectual pursuits..."
}
```

#### 3.7 Business Logic Rules

##### Personalized Explanation Assembly

**Purpose:** Constructs the "Your Placements" section from chart data and the content library.

**Inputs:**
- planet_positions: list of PlanetPosition from the natal chart

**Logic:**

```
1. FOR each planet in [sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto]:
     a. Find the PlanetPosition for this body
     b. Look up PlacementExplanation for (body, sign, house)
     c. IF found: use the matched explanation (beginner or advanced based on mode)
     d. IF not found: fall back to generic ExplanationContent for the planet + ExplanationContent for the sign
     e. Add to the placement list
2. Order placements: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
3. RETURN ordered list of placement explanations
```

**Edge Cases:**
- House number is null (birth time unknown, whole-sign houses): use house from whole-sign system; note "Approximate house placement (birth time unknown)"
- Missing content for a specific combination: compose a generic fallback from separate planet and sign descriptions

##### Depth Mode Persistence

**Purpose:** Stores the user's preferred explanation depth.

**Inputs:**
- mode: enum - beginner or advanced

**Logic:**

```
1. Save mode to the user preferences store (st_settings table)
2. On screen load, read the stored mode; default to beginner if not set
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Natal chart not computed | "Your Placements" section hidden; banner: "Calculate your chart for personalized explanations" | User computes chart |
| Explanation content missing for a placement | Fallback to generic planet + sign text | App update |
| Content library entirely missing | Error: "Educational content is unavailable. Please reinstall the app." | User reinstalls |

**Validation Timing:**
- Chart availability checked on screen load
- Content library integrity checked at module initialization

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a natal chart has been computed,
   **When** the user opens the Learn screen,
   **Then** "Your Placements" shows 10 cards with personalized planet-sign-house explanations in the current depth mode.

2. **Given** the user is in Beginner mode,
   **When** the user taps a planet card to expand it,
   **Then** a 1-2 sentence explanation is shown using simple language without astrological jargon.

3. **Given** the user toggles from Beginner to Advanced,
   **When** the mode switches,
   **Then** all expanded explanations crossfade to their advanced versions (2-3 paragraphs with terminology).

4. **Given** no natal chart is computed,
   **When** the user opens the Learn screen,
   **Then** the educational categories (Signs, Planets, Houses, Aspects) are visible, but "Your Placements" is hidden with a banner to compute their chart.

**Edge Cases:**

5. **Given** the content library is missing the entry for Neptune in Sagittarius, House 3,
   **When** the Your Placements section loads,
   **Then** a generic fallback combining the Neptune description and Sagittarius description is shown instead.

6. **Given** the user's birth time is unknown and whole-sign houses are used,
   **When** the Your Placements section loads,
   **Then** each placement card shows a note: "Approximate house placement (birth time unknown)."

**Negative Tests:**

7. **Given** the content library is entirely missing,
   **When** the user opens the Learn screen,
   **Then** an error is shown: "Educational content is unavailable. Please reinstall the app."
   **And** no partial or placeholder content is displayed.

8. **Given** the depth mode preference is corrupted in storage,
   **When** the screen loads,
   **Then** the mode defaults to Beginner, and no error is shown to the user.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| retrieves placement explanation for Mars Gemini House 10 | body: mars, sign: gemini, house: 10 | Non-empty beginner and advanced text |
| falls back when placement missing | body: neptune, sign: sagittarius, house: 3 (not in library) | Generic Neptune + Sagittarius fallback text |
| returns all 12 sign explanations | category: sign | 12 ExplanationContent entries |
| returns all 10 planet explanations | category: planet | 10 ExplanationContent entries |
| returns all 12 house explanations | category: house | 12 ExplanationContent entries |
| returns all 5 aspect explanations | category: aspect | 5 ExplanationContent entries |
| persists depth mode preference | mode: advanced, save, reload | Retrieved mode = advanced |
| defaults to beginner when no preference | no saved mode | mode = beginner |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full placements with chart | 1. Compute chart, 2. Load Learn screen | 10 personalized placement cards rendered |
| Learn screen without chart | 1. Open Learn screen (no chart) | Your Placements hidden, educational sections visible |
| Depth toggle persistence | 1. Set Advanced, 2. Leave screen, 3. Return | Advanced mode still active |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user learns astrology through their chart | 1. Compute chart, 2. Open Learn, 3. Expand "Your Sun in Aries, House 7", 4. Toggle to Advanced | Beginner text shown initially, then crossfades to advanced explanation |
| User explores zodiac signs | 1. Open Learn, 2. Open "What Are Signs?", 3. Tap Aries card | Aries explanation displayed with keywords and full description |

---

### ST-013: Zodiac Events Calendar

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-013 |
| **Feature Name** | Zodiac Events Calendar |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Spiritual Explorer, I want to see upcoming astrological events like sign changes, retrogrades, and eclipses, so that I can plan my life around the astrological calendar.

**Secondary:**
> As a Casual Stargazer, I want to know when Mercury goes retrograde or when the zodiac season changes, so that I can follow along with astrological discussions.

#### 3.3 Detailed Description

The Zodiac Events Calendar displays upcoming astrological events computed from planetary positions. Events include: zodiac season changes (when the Sun enters a new sign, occurring roughly every 30 days), planet sign ingresses (when any planet enters a new sign), retrograde and direct station dates (when a planet appears to reverse or resume forward motion), and eclipses (solar and lunar, computed from Sun-Moon-Node geometry).

The calendar presents events in a timeline view showing the next 90 days of events. Each event shows the date, time, event type, involved planets/signs, and a brief description of the event's astrological significance. Events are categorized by importance: "Season Change" (Sun ingress), "Major Event" (outer planet ingress, retrograde stations, eclipses), and "Minor Event" (inner planet sign changes).

All events are computed from ephemeris data using the same Swiss Ephemeris engine as other features. The engine scans forward from the current date, computing planet positions daily (or more frequently for fast-moving bodies) and detecting sign boundary crossings, speed sign changes (retrograde stations), and Sun-Moon-Node alignments (eclipses).

The calendar is purely astronomical and event-based. It does not reference the user's natal chart (that is the domain of Transit Tracking, ST-008). This makes it accessible to all users, even those who have not created a birth profile.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-004: Planet Position Calculator - provides the computation engine for projected positions

**External Dependencies:**
- Bundled Swiss Ephemeris data files
- Bundled event interpretation text (approximately 150KB compressed)

**Assumed Capabilities:**
- No birth profile required (this feature is chart-independent)

#### 3.5 User Interface Requirements

##### Screen: Events Timeline

**Layout:**
- The screen has a top navigation bar titled "Zodiac Events"
- Below the navigation bar, a filter chip row: "All Events", "Season Changes", "Major Events", "Minor Events"
- The main content area is a vertical timeline with date headers grouping events by day
- Each event card shows:
  - A colored category badge: "Season" (gold), "Major" (purple), "Minor" (gray)
  - Event title (e.g., "Sun enters Aries - Aries Season Begins")
  - Date and time (e.g., "March 20, 2026, 5:01 AM PDT")
  - Involved planet glyph(s) and sign glyph(s)
  - A brief 1-2 sentence description
  - Tapping expands to show a detailed 2-3 paragraph interpretation
- The timeline starts at today and extends 90 days forward
- Past events from the last 7 days are shown above the "Today" marker in a dimmed style

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | All events shown | Full timeline for 90 days |
| Filtered | Category filter active | Only matching events shown |
| Loading | Events being computed | Loading shimmer with "Scanning upcoming events..." |
| Empty Filter | No events match the active filter | Message: "No [category] events in the next 90 days." |

**Interactions:**
- Tap a filter chip: filters the timeline to the selected category
- Tap an event card: expands to show the full interpretation
- Scroll down: reveals future events; scroll up past today shows recent events
- Pull-to-refresh: recomputes events from current date

**Transitions/Animations:**
- Event cards stagger in with a 40ms delay
- Filter transition slides events out and in with a 200ms animation
- Card expansion uses a 200ms height animation

#### 3.6 Data Requirements

##### Entity: ZodiacEvent (Computed, Cached)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| event_type | enum | One of: sun_ingress, planet_ingress, retrograde_station, direct_station, solar_eclipse, lunar_eclipse | None | Type of event |
| category | enum | One of: season, major, minor | None | Display category |
| event_date | string | ISO 8601 datetime | None | Exact date and time of the event (UTC) |
| event_date_local | string | ISO 8601 datetime | None | Event time in user's local timezone |
| body | enum | One of the planet enums | None | The planet involved |
| from_sign | enum | One of the 12 zodiac signs, nullable | null | Sign the planet is leaving (for ingresses) |
| to_sign | enum | One of the 12 zodiac signs, nullable | null | Sign the planet is entering (for ingresses) |
| title | string | Max 200 chars | None | Event title |
| description_brief | string | Max 300 chars | None | 1-2 sentence summary |
| description_full | string | Max 2000 chars | None | 2-3 paragraph interpretation |
| computed_at | datetime | ISO 8601 | Current timestamp | When this event was computed |

**Relationships:**
- ZodiacEvent is a cached computation result, not tied to a user profile

**Indexes:**
- event_date - for timeline ordering
- (event_type, body, event_date) unique - prevent duplicate events
- category - for filtered queries

**Validation Rules:**
- event_date must be within the range: today minus 7 days to today plus 90 days
- For ingress events: from_sign and to_sign must be adjacent zodiac signs (or wrap from Pisces to Aries)
- For retrograde_station events: the planet must be capable of retrograde (not Sun or Moon)
- For eclipse events: body must be sun (solar eclipse) or moon (lunar eclipse)

**Example Data:**

```
{
  "id": "evt-001",
  "event_type": "sun_ingress",
  "category": "season",
  "event_date": "2026-03-20T12:01:00Z",
  "event_date_local": "2026-03-20T05:01:00-07:00",
  "body": "sun",
  "from_sign": "pisces",
  "to_sign": "aries",
  "title": "Sun enters Aries - Aries Season Begins",
  "description_brief": "The Spring Equinox marks the astrological new year. Aries season brings fresh starts and bold energy.",
  "description_full": "As the Sun crosses into Aries, the first sign of the zodiac, we enter a period of initiation and renewal...",
  "computed_at": "2026-03-07T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Event Detection - Sign Ingresses

**Purpose:** Detects when a planet crosses from one zodiac sign to the next.

**Inputs:**
- date_range: { start: today - 7 days, end: today + 90 days }
- bodies: list of planets to scan

**Logic:**

```
1. FOR each body in [sun, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto]:
     step = 1 day (0.5 day for Mercury and Venus due to faster motion)
     FOR each day in date_range (at step intervals):
       Compute position at noon UTC
       IF zodiac_sign differs from previous day's zodiac_sign THEN
         Binary search between previous noon and current noon to find exact crossing time (12 iterations, approximately 5-second precision)
         Create ZodiacEvent:
           event_type = sun_ingress if body is Sun, else planet_ingress
           category = season if Sun, major if outer planet (jupiter-pluto), minor if inner planet
           from_sign = previous zodiac sign
           to_sign = current zodiac sign
2. Convert exact time to user's local timezone for event_date_local
```

**Edge Cases:**
- Mercury retrograde crossing back into a previous sign: generates an ingress event for the re-entry
- Planet stationed at a sign boundary oscillating: may generate multiple ingress events; merge if within 48 hours

##### Event Detection - Retrograde Stations

**Purpose:** Detects when a planet's daily motion changes sign (positive to negative = retrograde station, negative to positive = direct station).

**Inputs:**
- date_range: same as above
- bodies: [mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto] (Sun and Moon never retrograde)

**Logic:**

```
1. FOR each body:
     step = 1 day
     FOR each day in date_range:
       Compute speed (daily motion)
       IF previous_speed > 0 AND current_speed < 0 THEN
         retrograde_station event
         Binary search for exact station time (when speed = 0)
         category = major if outer planet, minor if inner planet
       IF previous_speed < 0 AND current_speed > 0 THEN
         direct_station event
         Binary search for exact time
```

**Edge Cases:**
- Planet station occurs very slowly (speed near 0 for several days): use the day with the absolute minimum speed as the station date
- Venus retrograde is rare (every 18 months); Mercury retrograde is common (every 3-4 months)

##### Event Detection - Eclipses

**Purpose:** Detects solar and lunar eclipses from Sun-Moon-Node geometry.

**Inputs:**
- date_range: same as above

**Logic:**

```
1. Compute North Node (True Node) position for each day in the range
2. FOR each New Moon (phase_angle near 0, within 17 degrees of a node):
     IF abs(sun_longitude - node_longitude) < 17 degrees THEN
       Solar eclipse event
       category = major
3. FOR each Full Moon (phase_angle near 180, within 12 degrees of a node):
     IF abs(moon_longitude - (node_longitude + 180)) < 12 degrees THEN
       Lunar eclipse event
       category = major
```

**Edge Cases:**
- Eclipse seasons occur roughly every 6 months; some 90-day windows may contain 0 eclipses
- Partial vs. total eclipses: not distinguished in this feature (both shown as "Eclipse")

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Ephemeris data missing | Error: "Astronomical data files are missing. Please reinstall the app." | User reinstalls |
| Event computation takes longer than 5 seconds | Loading indicator: "Scanning upcoming events..." remains visible | Automatic; user waits |
| Interpretation text missing for an event | Event shows title and date but description shows "Details coming soon." | App update |
| No events found for a filter category | Message: "No [category] events in the next 90 days." | User selects a different filter |

**Validation Timing:**
- Ephemeris availability checked at module initialization
- Event data validated after computation (dates within range, signs valid)
- Interpretation text looked up on render

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Zodiac Events screen,
   **When** events are loaded for the next 90 days,
   **Then** a timeline shows events with colored category badges, dates, planet/sign glyphs, and brief descriptions.

2. **Given** the Sun enters Aries on March 20, 2026,
   **When** the event is computed,
   **Then** a "Season" badge event appears: "Sun enters Aries - Aries Season Begins" with the exact time in the user's timezone.

3. **Given** Mercury stations retrograde on a date within the 90-day window,
   **When** the event is computed,
   **Then** a "Major" badge event appears: "Mercury Stations Retrograde in [Sign]" with the exact time and a description about communication disruptions.

4. **Given** the user taps a filter chip "Season Changes",
   **When** the filter applies,
   **Then** only Sun ingress events are shown in the timeline.

**Edge Cases:**

5. **Given** a lunar eclipse occurs within the 90-day window,
   **When** the event list loads,
   **Then** the eclipse appears as a "Major" event with the exact time, the Moon's zodiac sign, and eclipse-specific interpretation.

6. **Given** Mercury retrogrades back from Aries into Pisces during the window,
   **When** ingress events are computed,
   **Then** two ingress events appear: "Mercury enters Aries" and "Mercury re-enters Pisces (retrograde)" with appropriate dates.

**Negative Tests:**

7. **Given** the ephemeris data files are missing,
   **When** event computation is attempted,
   **Then** an error is shown: "Astronomical data files are missing. Please reinstall the app."
   **And** no events are displayed.

8. **Given** the user selects "Season Changes" filter and no Sun ingresses occur in the 7-day past window or 90-day forward window (impossible astronomically, but tested defensively),
   **When** the filter applies,
   **Then** "No Season Changes events in the next 90 days." is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects Sun ingress into Aries | Sun at 359.5 Pisces on day N, Sun at 0.3 Aries on day N+1 | sun_ingress event from Pisces to Aries |
| detects Mercury retrograde station | Mercury speed +1.2 day N, speed -0.3 day N+1 | retrograde_station event |
| detects Mercury direct station | Mercury speed -1.1 day N, speed +0.4 day N+1 | direct_station event |
| detects solar eclipse near node | New Moon with Sun 5 degrees from North Node | solar_eclipse event |
| no eclipse when far from node | New Moon with Sun 20 degrees from North Node | No eclipse event |
| categorizes Sun ingress as season | event_type: sun_ingress | category = season |
| categorizes Saturn ingress as major | event_type: planet_ingress, body: saturn | category = major |
| categorizes Venus ingress as minor | event_type: planet_ingress, body: venus | category = minor |
| interpolates exact ingress time | Sign change between noon day N and noon day N+1 | Exact time within 5 seconds of reference |
| Sun and Moon excluded from retrograde scan | bodies scanned for retrograde | Sun and Moon not in the list |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full 90-day event scan | 1. Compute all events for next 90 days | Multiple ingress events, at least 3 Sun sign changes, possible retrograde stations |
| Eclipse detection accuracy | 1. Compute eclipses for a known eclipse date (reference data) | Eclipse detected within 1 day of published eclipse date |
| Filter by category | 1. Compute all events, 2. Filter by "Major" | Only outer planet ingresses, stations, and eclipses shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User browses upcoming events | 1. Open Zodiac Events, 2. Scroll through timeline, 3. Tap an event | Timeline shows categorized events; tapped event expands to full interpretation |
| User checks for retrogrades | 1. Open Zodiac Events, 2. Filter by "Major Events" | Major events shown including any retrograde stations in the next 90 days |

---

### ST-014: Retrograde Alerts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-014 |
| **Feature Name** | Retrograde Alerts |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Casual Stargazer, I want to see a simple dashboard showing which planets are currently retrograde, so that I can know at a glance whether Mercury is retrograde without needing to check external apps.

**Secondary:**
> As a Spiritual Explorer, I want practical tips for navigating each retrograde period, so that I can adjust my plans and expectations accordingly.

#### 3.3 Detailed Description

Retrograde Alerts provides a focused dashboard view of all currently retrograde planets and upcoming retrograde periods. While the Planet Position Calculator (ST-004) shows retrograde status as a badge on each planet, and the Zodiac Events Calendar (ST-013) lists station dates, this feature consolidates retrograde information into a dedicated, easy-to-understand screen.

The dashboard shows two sections: "Currently Retrograde" (planets that are currently in retrograde motion) and "Upcoming Retrogrades" (planets that will station retrograde within the next 90 days). Each retrograde entry shows the planet name, the zodiac sign it is retrograding through, the retrograde start and end dates, a progress bar showing the current position within the retrograde period, and practical "survival tips" - brief, actionable advice for navigating the retrograde.

The survival tips are drawn from a bundled text library with planet-specific advice. Mercury retrograde tips focus on communication, technology, and travel. Venus retrograde tips cover relationships and finances. Mars retrograde tips address energy, motivation, and conflict. Outer planet retrogrades have more general tips about reflection and inner work.

This feature is intentionally lightweight and accessible. It does not require a birth profile or natal chart and is available to all users immediately upon enabling the MyStars module.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-004: Planet Position Calculator - provides current retrograde status for each planet
- ST-013: Zodiac Events Calendar - provides upcoming retrograde station dates (can compute independently if needed)

**External Dependencies:**
- Bundled survival tips text library (approximately 50KB compressed)

**Assumed Capabilities:**
- No birth profile or natal chart required
- Planet position computation is functional

#### 3.5 User Interface Requirements

##### Screen: Retrograde Dashboard

**Layout:**
- The screen has a top navigation bar titled "Retrogrades"
- At the top, a prominent status banner:
  - If Mercury is currently retrograde: amber banner "Mercury Retrograde" with the retrograde symbol (Rx) and dates
  - If no planet is currently retrograde: green banner "All Clear - No Inner Planet Retrogrades Active"
- **Currently Retrograde Section:**
  - A vertical list of planet cards for each currently retrograde planet
  - Each card shows: planet glyph, planet name, "Retrograde in [Sign]", retrograde date range, a progress bar (start date to end date with current position marked), and 3-5 survival tips in a bulleted list
  - If no planets are retrograde: "No planets are currently retrograde. Enjoy the smooth sailing!"
- **Upcoming Retrogrades Section:**
  - A vertical list of future retrograde periods within the next 90 days
  - Each entry shows: planet glyph, planet name, "Goes retrograde in [Sign]", start date, end date, and days until retrograde begins
  - If none upcoming: "No retrogrades starting in the next 90 days."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active Retrogrades | 1+ planets currently retrograde | Amber banner (if Mercury) or neutral banner, planet cards with progress and tips |
| No Active | No planets retrograde | Green "All Clear" banner, empty active section with positive message |
| Upcoming | Future retrogrades within 90 days | Countdown cards in the upcoming section |
| Loading | Positions being computed | Loading shimmer |

**Interactions:**
- Tap a retrograde card: expands to show a detailed interpretation (2-3 paragraphs) of this specific retrograde period and what areas of life it may affect
- Tap an upcoming retrograde entry: shows the survival tips preemptively so the user can prepare

**Transitions/Animations:**
- Progress bar animates to the current position over 400ms
- Cards stagger in with a 60ms delay
- Status banner fades in over 300ms

#### 3.6 Data Requirements

##### Entity: RetrogradeStatus (Computed, Cached)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| body | enum | One of: mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto | None | The planet |
| is_retrograde | boolean | - | None | Whether the planet is currently retrograde |
| retrograde_start | string | ISO 8601 date, nullable | null | Start date of the current/upcoming retrograde |
| retrograde_end | string | ISO 8601 date, nullable | null | End date of the current/upcoming retrograde |
| retrograde_sign | enum | One of the 12 zodiac signs, nullable | null | Sign the planet is retrograding through |
| progress | float | 0.0 to 1.0, nullable | null | Progress through the retrograde period (0 = just started, 1 = ending) |
| survival_tips | string | JSON array of strings, max 2000 chars | None | 3-5 practical tips |
| interpretation | string | Max 2000 chars | None | 2-3 paragraph interpretation of this retrograde |
| days_until_start | integer | 0 to 90, nullable | null | Days until retrograde begins (0 if currently active) |

**Relationships:**
- RetrogradeStatus is a transient computation result, cached for the current session

**Indexes:**
- None (in-memory / session cache)

**Validation Rules:**
- is_retrograde and retrograde dates must be consistent: if is_retrograde, retrograde_start must be before today and retrograde_end after today
- progress must be between 0.0 and 1.0 if retrograde is active

**Example Data:**

```
{
  "body": "mercury",
  "is_retrograde": true,
  "retrograde_start": "2026-02-25",
  "retrograde_end": "2026-03-18",
  "retrograde_sign": "pisces",
  "progress": 0.5,
  "survival_tips": "[\"Double-check all emails before sending\",\"Back up your devices\",\"Avoid signing contracts if possible\",\"Revisit old projects rather than starting new ones\",\"Be patient with miscommunications\"]",
  "interpretation": "Mercury retrograde in Pisces blurs the lines of communication...",
  "days_until_start": 0
}
```

#### 3.7 Business Logic Rules

##### Retrograde Status Detection

**Purpose:** Determines which planets are currently retrograde and computes their retrograde period boundaries.

**Inputs:**
- current_positions: list of CurrentPlanetPosition (from ST-004)

**Logic:**

```
1. FOR each body in [mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto]:
     IF current_position.speed < 0 THEN
       is_retrograde = true
       Scan backward in daily steps to find retrograde_start (first day speed became negative)
       Scan forward in daily steps to find retrograde_end (first day speed becomes positive)
       progress = (today - retrograde_start) / (retrograde_end - retrograde_start)
       retrograde_sign = current zodiac sign
       days_until_start = 0
     ELSE
       is_retrograde = false
       Scan forward up to 90 days to find next retrograde start (first day speed becomes negative)
       IF found within 90 days:
         retrograde_start = that date
         Continue scanning to find retrograde_end
         days_until_start = retrograde_start - today
2. Look up survival_tips from RETROGRADE_TIPS[body]
3. Look up interpretation from RETROGRADE_INTERPRETATIONS[body][retrograde_sign]
4. RETURN list of RetrogradeStatus
```

**Edge Cases:**
- A planet retrogrades across two signs: use the sign where it stationed retrograde (not current sign)
- Retrograde period extends beyond the ephemeris range: cap at the boundary
- Venus retrograde: rare (approximately 40 days every 18 months), may not appear in the 90-day window
- Mercury retrograde: common (approximately 3 weeks every 3-4 months), likely at least one in any 90-day window

##### Mercury Retrograde Banner Logic

**Purpose:** Determines the status banner color and text.

**Inputs:**
- retrograde_statuses: list of RetrogradeStatus

**Logic:**

```
1. Find mercury_status in retrograde_statuses
2. IF mercury_status.is_retrograde THEN
     banner_color = amber
     banner_text = "Mercury Retrograde in [sign] until [end_date]"
3. ELSE IF mercury_status.days_until_start <= 7 THEN
     banner_color = yellow
     banner_text = "Mercury goes retrograde in [days_until_start] days"
4. ELSE
     Check if any inner planet (venus, mars) is retrograde
     IF yes: banner for that planet
     ELSE: green banner "All Clear - No Inner Planet Retrogrades Active"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Ephemeris data missing | Error: "Astronomical data files are missing. Please reinstall the app." | User reinstalls |
| Retrograde boundary scan exceeds ephemeris range | Retrograde end date shown as "After [boundary date]" | Cosmetic; no user action needed |
| Survival tips text missing | Generic tips: "Take things slowly. Double-check important decisions." | App update |
| Computation fails | Error: "Could not determine retrograde status. Pull down to try again." | Pull-to-refresh |

**Validation Timing:**
- Ephemeris availability checked at module initialization
- Retrograde status computed on screen load, cached for the session

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** Mercury is currently retrograde in Pisces from Feb 25 to Mar 18,
   **When** the user opens the Retrograde Dashboard,
   **Then** an amber banner shows "Mercury Retrograde in Pisces until March 18, 2026", a Mercury card shows a progress bar at approximately 50%, and 5 survival tips are listed.

2. **Given** no planets are currently retrograde,
   **When** the user opens the dashboard,
   **Then** a green banner shows "All Clear - No Inner Planet Retrogrades Active" and the active section reads "No planets are currently retrograde."

3. **Given** Jupiter will station retrograde in 45 days,
   **When** the upcoming section loads,
   **Then** Jupiter appears with "Goes retrograde in [Sign] in 45 days" and the retrograde date range.

**Edge Cases:**

4. **Given** three planets are simultaneously retrograde (Mercury, Jupiter, Saturn),
   **When** the dashboard loads,
   **Then** all three appear in the active section with individual progress bars and tips.

5. **Given** Mercury retrograde ends tomorrow,
   **When** the progress bar is displayed,
   **Then** it shows approximately 95% complete, indicating the retrograde is nearly over.

**Negative Tests:**

6. **Given** the planet position computation fails,
   **When** the dashboard attempts to load,
   **Then** an error is shown: "Could not determine retrograde status. Pull down to try again."
   **And** no partial data or incorrect all-clear banner is shown.

7. **Given** the survival tips library is missing for Venus,
   **When** Venus retrograde is active,
   **Then** generic tips are shown: "Take things slowly. Double-check important decisions."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects Mercury retrograde from negative speed | mercury speed: -1.21 | is_retrograde = true |
| detects Mercury direct from positive speed | mercury speed: 1.38 | is_retrograde = false |
| computes retrograde progress at midpoint | start: day 0, end: day 20, today: day 10 | progress = 0.5 |
| computes retrograde progress at start | today = start date | progress = 0.0 |
| generates amber banner for Mercury retrograde | mercury.is_retrograde = true | banner_color = amber |
| generates yellow banner for approaching Mercury Rx | mercury.days_until_start = 5 | banner_color = yellow |
| generates green banner when all clear | no inner planets retrograde | banner_color = green |
| retrieves survival tips for Mercury | body: mercury | 5 tips returned |
| handles planet retrograde across two signs | retrograde start in Aries, currently in Pisces | retrograde_sign = aries (station sign) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full retrograde scan | 1. Compute current positions, 2. Detect retrogrades, 3. Compute boundaries | List of RetrogradeStatus for all 8 bodies with valid is_retrograde flags |
| Upcoming retrograde detection | 1. Scan forward 90 days | Any approaching retrogrades detected with start dates and days_until_start |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User checks retrograde status | 1. Open Retrograde Dashboard, 2. View active retrogrades, 3. Read survival tips | Dashboard shows status banner, active retrogrades with progress and tips |
| User prepares for upcoming retrograde | 1. Open dashboard, 2. View upcoming section, 3. Tap upcoming retrograde | Upcoming retrograde shown with dates and pre-emptive tips |

---

### ST-015: Tarot Card of the Day

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-015 |
| **Feature Name** | Tarot Card of the Day |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Spiritual Explorer, I want to draw a daily tarot card for reflection and guidance, so that I can combine my astrology practice with tarot for a richer spiritual routine.

**Secondary:**
> As a Casual Stargazer, I want a fun daily ritual of pulling a card with beautiful artwork, so that I have a reason to open the app every day.

#### 3.3 Detailed Description

Tarot Card of the Day provides a daily single-card tarot draw with a full interpretation. The tarot deck consists of 78 cards: 22 Major Arcana (The Fool through The World) and 56 Minor Arcana (4 suits of 14 cards each: Wands, Cups, Swords, Pentacles). Each card can appear upright or reversed, giving 156 possible daily draws.

The daily draw uses a deterministic pseudo-random algorithm seeded by the date and the user's primary profile ID (or a device-generated UUID if no profile exists). This means: the same user sees the same card for the entire day (consistency), different users see different cards on the same day (personalization), and the draw is reproducible (returning to the app shows the same card, not a new draw).

Each card has a full-screen illustration (bundled as optimized images, approximately 78 images at 150KB each = approximately 12MB total, or a single sprite sheet), an upright interpretation (3-5 paragraphs covering the card's meaning, guidance, and reflection questions), and a reversed interpretation (same structure but with reversed meanings). A "Learn More" section provides the card's astrological correspondence (each tarot card is associated with a zodiac sign, planet, or element).

The user can optionally "draw again" to replace the daily card, but this action is limited to once per day (maximum 2 draws total per day: the initial draw and one re-draw). The daily card is stored in the database, and the last 90 days of draws are preserved for a draw history.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (tarot does not depend on birth profiles or natal charts)

**External Dependencies:**
- Bundled tarot card illustrations (78 cards, approximately 12MB total or as a sprite sheet)
- Bundled tarot interpretation text library (78 cards x 2 orientations = 156 interpretations, approximately 400KB compressed)

**Assumed Capabilities:**
- Device storage for card images (approximately 12MB)
- Device clock for date-based seeding

#### 3.5 User Interface Requirements

##### Screen: Card of the Day

**Layout:**
- The screen has a top navigation bar titled "Card of the Day" with a history icon on the right
- The main content area shows a single tarot card, centered:
  - Before draw: a face-down card with a decorative back design, with text "Tap to draw your card" and a subtle glow animation
  - After draw: the card flips to reveal the illustration
- Below the revealed card:
  - Card name in large text (e.g., "The Tower" or "Six of Cups")
  - Orientation badge: "Upright" or "Reversed" (reversed cards are displayed with a subtle rotation indicator, not actually upside-down, for readability)
  - Astrological correspondence line (e.g., "Associated with Mars and Aries")
  - "Today's Message" section: 3-5 paragraphs of interpretation
  - "Reflection Questions" section: 2-3 questions prompted by the card
  - "Draw Again" button (available once per day; disabled after the re-draw)
- Below the interpretation, a "View History" link navigates to the draw history

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Undrawn | First visit of the day, no card drawn yet | Face-down card with "Tap to draw" prompt and glow animation |
| Drawn | Card has been drawn for today | Card illustration, name, orientation, and full interpretation |
| Re-drawn | User used the "Draw Again" option | New card displayed, "Draw Again" button disabled with "Already redrawn today" text |
| History | User tapped history icon | Scrollable list of past daily draws |

**Interactions:**
- Tap the face-down card: triggers the card draw animation (flip reveal, 600ms) and displays the result
- Tap "Draw Again": confirmation dialog "Replace today's card with a new draw?", then new draw animation
- Tap history icon: navigates to draw history screen
- Scroll down: reveals full interpretation and reflection questions

**Transitions/Animations:**
- Card flip animation: the card rotates on its Y-axis (3D flip) over 600ms, transitioning from the back design to the front illustration
- Reversed cards have a brief 5-degree rotation wobble after the flip (200ms) to subtly indicate reversed orientation
- Interpretation text fades in from below over 300ms after the card flip completes
- Face-down card has a gentle glow pulse (2-second loop) around the border

##### Screen: Draw History

**Layout:**
- A scrollable vertical list of past daily draws
- Each entry shows: date, card name, orientation (upright/reversed), and a small thumbnail of the card
- Tapping an entry shows the full card and interpretation for that day
- Maximum 90 days of history

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Populated | Past draws exist | Chronological list (most recent first) |
| Empty | No past draws (first day using the feature) | Message: "No past draws yet. Your history will build as you draw daily." |

#### 3.6 Data Requirements

##### Entity: TarotDraw

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| date | string | ISO 8601 date (YYYY-MM-DD) | None | The date of the draw |
| profile_id | string | Foreign key to BirthProfile.id, nullable | null | Profile used for seeding (null if no profile) |
| device_seed | string | UUID, max 36 chars | None | Device-generated seed for users without profiles |
| card_number | integer | 0 to 77 | None | Card index in the 78-card deck |
| card_name | string | Max 100 chars | None | Display name of the card |
| is_reversed | boolean | - | None | Whether the card is reversed |
| is_redraw | boolean | - | false | Whether this replaced a previous draw |
| original_card_number | integer | 0 to 77, nullable | null | Original card if this is a redraw |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

##### Entity: TarotCard (Bundled Static Data)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| card_number | integer | 0 to 77, primary key | N/A | Card index |
| card_name | string | Max 100 chars | N/A | Display name |
| arcana | enum | One of: major, minor | N/A | Major or Minor Arcana |
| suit | enum | One of: wands, cups, swords, pentacles, null (Major Arcana) | N/A | Suit for Minor Arcana |
| rank | string | Max 20 chars, nullable | N/A | Rank for Minor Arcana (Ace, Two, ..., King) |
| zodiac_correspondence | string | Max 100 chars | N/A | Astrological association |
| image_asset_key | string | Max 100 chars | N/A | Key to locate the card illustration |
| upright_keywords | string | Max 200 chars | N/A | 3-5 upright keywords |
| reversed_keywords | string | Max 200 chars | N/A | 3-5 reversed keywords |
| upright_interpretation | string | Max 3000 chars | N/A | Full upright interpretation |
| reversed_interpretation | string | Max 3000 chars | N/A | Full reversed interpretation |
| upright_questions | string | Max 500 chars | N/A | 2-3 reflection questions (upright) |
| reversed_questions | string | Max 500 chars | N/A | 2-3 reflection questions (reversed) |

**Relationships:**
- TarotDraw references TarotCard via card_number
- One TarotDraw per date (with possible redraw replacing the original)

**Indexes:**
- TarotDraw: date (unique per draw, with redraw replacing)
- TarotDraw: (profile_id, date) for profile-scoped lookups
- TarotCard: card_number (primary key lookup)

**Validation Rules:**
- card_number: must be between 0 and 77
- Major Arcana: card_number 0-21 (The Fool through The World)
- Minor Arcana: card_number 22-77 (Wands 22-35, Cups 36-49, Swords 50-63, Pentacles 64-77)
- Maximum one redraw per day: if is_redraw is true for today's date, no further draws allowed
- Maximum 90 TarotDraw entries; oldest purged on creation of new ones

**Example Data:**

```
{
  "id": "draw-001",
  "date": "2026-03-07",
  "profile_id": "b7e3f1a2-9c4d-4e8f-a1b2-c3d4e5f60001",
  "device_seed": "d1e2f3a4-b5c6-7890-abcd-ef1234567890",
  "card_number": 16,
  "card_name": "The Tower",
  "is_reversed": false,
  "is_redraw": false,
  "original_card_number": null
}
```

```
{
  "card_number": 16,
  "card_name": "The Tower",
  "arcana": "major",
  "suit": null,
  "rank": null,
  "zodiac_correspondence": "Mars, Aries",
  "image_asset_key": "tarot_16_tower",
  "upright_keywords": "Sudden change, Upheaval, Revelation, Breakthrough, Awakening",
  "reversed_keywords": "Resistance to change, Avoidance, Delayed disaster, Fear of change",
  "upright_interpretation": "The Tower represents sudden, disruptive change that clears away false structures...",
  "reversed_interpretation": "Reversed, The Tower suggests resistance to necessary change...",
  "upright_questions": "What structure in your life needs to crumble for something better to emerge? Where have you been ignoring warning signs?",
  "reversed_questions": "What change are you resisting? What would happen if you stopped clinging to what no longer serves you?"
}
```

#### 3.7 Business Logic Rules

##### Deterministic Card Draw

**Purpose:** Selects a card and orientation deterministically from the date and user identity.

**Inputs:**
- date: string - today's date (YYYY-MM-DD)
- seed: string - profile_id if primary profile exists, otherwise device_seed

**Logic:**

```
1. Create a hash string: hash_input = date + ":" + seed
2. Compute a numeric hash from hash_input (use a simple string hash function, e.g., DJB2 or similar):
     hash_value = hash(hash_input)
3. card_number = hash_value mod 78  (selects one of 78 cards)
4. is_reversed = (hash_value / 78) mod 2 == 1  (50% chance of reversal)
5. RETURN { card_number, is_reversed }
```

**Formulas:**
- `card_number = hash(date + ":" + seed) mod 78`
- `is_reversed = (hash(date + ":" + seed) / 78) mod 2 == 1`

**Edge Cases:**
- User creates a profile mid-day: the seed changes, but the existing draw is preserved (do not re-draw)
- Date boundary at midnight: uses the local date, not UTC
- Device seed changes (app reinstalled): draw may differ; this is acceptable as there is no cloud sync

##### Redraw Logic

**Purpose:** Allows the user to replace the daily card once.

**Inputs:**
- current_draw: TarotDraw - today's existing draw
- date: string
- seed: string

**Logic:**

```
1. IF current_draw.is_redraw == true THEN
     REJECT: "You have already redrawn today's card."
2. Create a new hash: redraw_hash_input = date + ":" + seed + ":redraw"
3. new_card_number = hash(redraw_hash_input) mod 78
4. IF new_card_number == current_draw.card_number THEN
     new_card_number = (new_card_number + 1) mod 78  (avoid drawing the same card)
5. new_is_reversed = (hash(redraw_hash_input) / 78) mod 2 == 1
6. Update the TarotDraw record:
     card_number = new_card_number
     is_reversed = new_is_reversed
     is_redraw = true
     original_card_number = current_draw.card_number
7. RETURN updated TarotDraw
```

**Edge Cases:**
- Redraw produces the same card: increment card_number by 1 (wrapped) to ensure a different card
- Maximum 2 cards per day (initial + one redraw)

##### Draw History Purge

**Purpose:** Keeps draw history to 90 entries.

**Logic:**

```
1. Count TarotDraw entries
2. IF count > 90 THEN
     Delete oldest entries until count = 90
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Card image asset missing | Card name and interpretation displayed without illustration; placeholder image shown | App update restores images |
| Interpretation text missing | Card displayed with name and keywords but interpretation shows "Interpretation coming soon." | App update |
| Draw fails (hash computation error) | Error: "Could not draw a card. Try again." | User taps the card again |
| Redraw attempted after already redrawn | "Draw Again" button disabled, text: "Already redrawn today. Tomorrow brings a new draw." | User waits until tomorrow |
| Database write fails | Card is displayed but not saved to history | Next access re-draws and attempts to save again |

**Validation Timing:**
- Card asset and interpretation availability checked at module initialization
- Redraw eligibility checked before showing "Draw Again" button as enabled
- History purge runs after successful draw save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** today is March 7, 2026 and the user has not drawn a card today,
   **When** the user opens the Card of the Day screen,
   **Then** a face-down card is displayed with a glow animation and "Tap to draw your card" text.

2. **Given** the user taps the face-down card,
   **When** the draw animation plays,
   **Then** the card flips to reveal the illustration, card name, orientation (upright or reversed), astrological correspondence, interpretation, and reflection questions.

3. **Given** the user has drawn The Tower (upright),
   **When** the user returns to the screen later the same day,
   **Then** The Tower (upright) is displayed immediately without another draw animation.

4. **Given** the user taps "Draw Again" and confirms,
   **When** the redraw completes,
   **Then** a new card is displayed (different from The Tower), "Draw Again" is disabled, and the original draw is preserved in history as the original_card_number.

**Edge Cases:**

5. **Given** the deterministic hash produces the same card on a redraw,
   **When** the redraw is computed,
   **Then** the card_number is incremented by 1 to ensure a different card is drawn.

6. **Given** 90 draws are in history and a new draw is saved,
   **When** the 91st draw is saved,
   **Then** the oldest draw is purged and history contains exactly 90 entries.

**Negative Tests:**

7. **Given** the user has already used the "Draw Again" option today,
   **When** the user looks at the "Draw Again" button,
   **Then** it is disabled with text "Already redrawn today. Tomorrow brings a new draw."
   **And** no additional draw can be triggered.

8. **Given** the card illustration asset for card_number 16 is missing,
   **When** The Tower is drawn,
   **Then** a placeholder image is shown, but the card name, keywords, and interpretation are displayed normally.
   **And** no crash or error dialog appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| deterministic draw produces same card for same input | date: "2026-03-07", seed: "abc123" (called twice) | Same card_number and is_reversed both times |
| different dates produce different cards | date: "2026-03-07" vs "2026-03-08", same seed | Different card_number (statistically; verify for test seeds) |
| different seeds produce different cards | same date, seed: "abc123" vs "xyz789" | Different card_number |
| card_number is in range 0-77 | any valid input | 0 <= card_number <= 77 |
| redraw produces different card | original card_number: 16, redraw | new card_number != 16 |
| redraw with collision increments | hash produces card 16 again | card_number = 17 |
| redraw blocked after first redraw | existing draw has is_redraw = true | Rejection |
| purge removes oldest beyond 90 | 91 draws | Oldest deleted, count = 90 |
| Major Arcana mapping | card_number: 0 | card_name: "The Fool", arcana: major |
| Minor Arcana mapping | card_number: 22 | Ace of Wands, arcana: minor, suit: wands |
| card_number 77 is valid | card_number: 77 | King of Pentacles |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full daily draw flow | 1. Open screen (undrawn), 2. Tap to draw, 3. Verify card data | Card drawn with valid number, name, orientation, and interpretation |
| Redraw flow | 1. Draw card, 2. Tap "Draw Again", 3. Confirm | New card displayed, different from original, is_redraw = true |
| History accumulation | 1. Draw a card daily for 5 days, 2. Check history | 5 entries in chronological order |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User draws their daily card | 1. Open Card of the Day, 2. Tap face-down card, 3. Read interpretation, 4. Review reflection questions | Card revealed with full interpretation and questions; returning later shows the same card |
| User views their draw history | 1. Draw daily for a week, 2. Tap history icon, 3. Browse past draws | 7 entries with thumbnails, names, and dates; tapping one shows full interpretation |

---

### ST-016: Celestial Events Calendar

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-016 |
| **Feature Name** | Celestial Events Calendar |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Casual Stargazer, I want to know when the next meteor shower, eclipse, or planetary conjunction is happening, so that I can plan to go outside and observe the sky.

**Secondary:**
> As a Spiritual Explorer, I want to see how astronomical events like eclipses and conjunctions align with astrological interpretations, so that I can connect my sky-watching with my spiritual practice.

#### 3.3 Detailed Description

The Celestial Events Calendar focuses on observable astronomical events that a user can actually see in the sky. While the Zodiac Events Calendar (ST-013) covers astrological events (sign ingresses, retrograde stations), this feature covers events of observational interest: meteor showers, eclipses (solar and lunar with visibility regions), planetary conjunctions (when two planets appear very close together in the sky), supermoons (Full Moons near lunar perigee), solstices and equinoxes, and notable planet-star close approaches.

The data source is a combination of computed events (eclipses, conjunctions computed from ephemeris data) and a bundled static catalog of recurring events (meteor showers have known annual dates). The calendar extends 12 months forward from the current date.

Each event entry includes: date and time, event name, event type, visibility notes (e.g., "Best viewed from the Northern Hemisphere after midnight"), a brief description, and an astrological interpretation where applicable. For eclipses, visibility maps are described in text (e.g., "Total solar eclipse visible from North Africa and Southern Europe").

This feature does not require a birth profile and is accessible to all users. It serves as a gateway feature to attract users interested in astronomy who may later explore the astrology features.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-004: Planet Position Calculator - for computing conjunctions and eclipse geometry

**External Dependencies:**
- Bundled Swiss Ephemeris data files (for computed events)
- Bundled meteor shower catalog (approximately 20KB): annual dates, peak times, radiant positions, typical hourly rates
- Bundled celestial event interpretation text (approximately 100KB compressed)

**Assumed Capabilities:**
- No birth profile required
- Ephemeris computation engine is functional

#### 3.5 User Interface Requirements

##### Screen: Celestial Events

**Layout:**
- The screen has a top navigation bar titled "Sky Events"
- Below the navigation bar, a filter chip row: "All", "Eclipses", "Meteor Showers", "Conjunctions", "Other"
- The main content area is a vertical scrollable list of event cards, grouped by month with month headers
- Each event card shows:
  - Event type icon (eclipse, meteor, conjunction, solstice, supermoon)
  - Event name (e.g., "Perseid Meteor Shower", "Total Solar Eclipse", "Jupiter-Saturn Conjunction")
  - Date range or specific date (e.g., "Aug 11-13, 2026" for meteor showers, "March 20, 2026" for equinox)
  - Peak time if applicable
  - Visibility note (1 sentence)
  - Brief 1-2 sentence description
- Tapping a card expands to show:
  - Full description (2-3 paragraphs)
  - Astrological significance (1-2 paragraphs)
  - Observation tips (when/where/how to see it)
  - For eclipses: visibility region description

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | All events shown | Monthly grouped timeline for 12 months |
| Filtered | Category filter active | Only matching events shown |
| Loading | Events being compiled | Loading shimmer |
| Empty Filter | No events match filter | Message: "No [category] events in the next 12 months." |

**Interactions:**
- Tap filter chip: filters events by type
- Tap an event card: expands to show full details and observation tips
- Scroll: navigate through the 12-month timeline

**Transitions/Animations:**
- Event cards stagger in with a 40ms delay
- Card expansion uses a 200ms height animation
- Month header pins to the top while scrolling its section

#### 3.6 Data Requirements

##### Entity: CelestialEvent (Computed + Bundled Catalog)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | None | Unique identifier |
| event_type | enum | One of: meteor_shower, solar_eclipse, lunar_eclipse, conjunction, supermoon, solstice, equinox | None | Type of event |
| name | string | Max 200 chars | None | Event name |
| date_start | string | ISO 8601 date | None | Start date (or exact date for single-day events) |
| date_end | string | ISO 8601 date, nullable | null | End date for multi-day events |
| peak_time | string | ISO 8601 datetime, nullable | null | Peak time for meteor showers or exact time for eclipses |
| visibility | string | Max 500 chars | None | Visibility region and conditions |
| description_brief | string | Max 300 chars | None | 1-2 sentence description |
| description_full | string | Max 2000 chars | None | 2-3 paragraph full description |
| astrological_note | string | Max 1000 chars, nullable | null | Astrological significance |
| observation_tips | string | Max 1000 chars | None | Practical observation advice |
| source | enum | One of: computed, catalog | None | Whether this event was computed or from the static catalog |

**Relationships:**
- CelestialEvent is a mix of computed (eclipses, conjunctions) and static catalog data (meteor showers, solstices)

**Indexes:**
- date_start - for timeline ordering
- event_type - for filtered queries

**Validation Rules:**
- date_start must be within the next 12 months
- For multi-day events: date_end must be after date_start
- Meteor showers: must have peak_time

**Example Data:**

```
{
  "id": "ce-perseids-2026",
  "event_type": "meteor_shower",
  "name": "Perseid Meteor Shower",
  "date_start": "2026-08-11",
  "date_end": "2026-08-13",
  "peak_time": "2026-08-12T04:00:00Z",
  "visibility": "Northern Hemisphere. Best after midnight in dark skies away from city lights.",
  "description_brief": "One of the most popular meteor showers, producing up to 100 meteors per hour at peak.",
  "description_full": "The Perseid meteor shower occurs annually as Earth passes through debris from Comet Swift-Tuttle...",
  "astrological_note": "The Perseids peak during Leo season, amplifying themes of creativity, performance, and self-expression.",
  "observation_tips": "Find a dark location away from lights. Lie flat on your back and look at the northeastern sky. Allow 20 minutes for your eyes to adjust.",
  "source": "catalog"
}
```

#### 3.7 Business Logic Rules

##### Conjunction Detection

**Purpose:** Detects when two planets appear very close together in the sky.

**Inputs:**
- date_range: next 12 months
- bodies: all 10 core planets

**Logic:**

```
1. FOR each pair of bodies (excluding Sun-Moon, which are covered by eclipses):
     FOR each day in date_range (step = 1 day):
       Compute apparent angular separation between the two bodies
       IF separation < 5 degrees THEN
         Record the date and separation
         Find the date of minimum separation (binary search)
         IF minimum separation < 2 degrees THEN
           Create a "Notable Conjunction" CelestialEvent
         ELSE IF minimum separation < 5 degrees THEN
           Create a "Close Approach" CelestialEvent
2. Exclude conjunctions involving only outer planets that are slow-moving and not visually notable
3. Prioritize conjunctions involving bright planets (Venus, Jupiter, Mars, Saturn)
```

**Edge Cases:**
- Triple conjunction (three planets within 5 degrees): create a single event mentioning all three
- Conjunction visible only in daylight: include but note "Daylight conjunction - not visible to the naked eye"

##### Supermoon Detection

**Purpose:** Identifies Full Moons that coincide with lunar perigee (closest approach to Earth).

**Inputs:**
- date_range: next 12 months

**Logic:**

```
1. FOR each Full Moon in date_range (from Moon Phase Calendar logic):
     Compute Earth-Moon distance on the Full Moon date
     Compute average perigee distance: 363,300 km
     IF distance < average_perigee + 5,000 km (i.e., < 368,300 km) THEN
       Create a "Supermoon" CelestialEvent
       Note the apparent size increase percentage: ((average_distance / actual_distance) - 1) * 100
```

##### Catalog Event Population

**Purpose:** Populates recurring annual events from the static catalog.

**Logic:**

```
1. Load the bundled meteor shower catalog (approximately 12 major annual showers)
2. FOR each shower in the catalog:
     Adjust dates to the current/next year
     Look up Moon phase for the peak date (Moon brightness affects visibility)
     Adjust visibility note based on Moon: if Moon > 50% illuminated, add "Moon interference may reduce visibility"
3. Compute solstice and equinox dates from the Sun's ecliptic longitude:
     Spring Equinox: Sun crosses 0 degrees (Aries point)
     Summer Solstice: Sun reaches 90 degrees (Cancer point)
     Autumnal Equinox: Sun crosses 180 degrees (Libra point)
     Winter Solstice: Sun reaches 270 degrees (Capricorn point)
4. Add all events to the CelestialEvent cache
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Ephemeris data missing | Computed events (eclipses, conjunctions) unavailable; catalog events still shown with note | User reinstalls for full data |
| Meteor shower catalog missing | Computed events shown; meteor showers absent with note: "Meteor shower data unavailable" | App update |
| No events in a filter category | "No [category] events in the next 12 months." | User selects a different filter |
| Conjunction computation takes long | Loading shimmer; catalog events load first, computed events appear as available | Automatic |

**Validation Timing:**
- Catalog availability checked at module initialization
- Computed events validated after computation
- Events cached for the session and refreshed daily

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Celestial Events screen,
   **When** events load,
   **Then** a timeline shows events grouped by month for the next 12 months, including meteor showers, eclipses, solstices, and conjunctions.

2. **Given** the Perseid Meteor Shower occurs in August,
   **When** the user scrolls to August,
   **Then** a meteor shower card shows "Perseid Meteor Shower, Aug 11-13", peak time, visibility notes, and observation tips.

3. **Given** a Jupiter-Venus conjunction occurs with a minimum separation of 0.8 degrees,
   **When** the conjunction is computed,
   **Then** a "Notable Conjunction" card appears with the date, separation, and visibility information.

4. **Given** the user taps an event card,
   **When** the card expands,
   **Then** the full description, astrological significance, and observation tips are displayed.

**Edge Cases:**

5. **Given** the Moon is 85% illuminated during the Perseid peak,
   **When** the meteor shower card is displayed,
   **Then** the visibility note includes "Moon interference may reduce visibility."

6. **Given** a Full Moon occurs within 368,300 km of Earth,
   **When** the Supermoon is detected,
   **Then** a Supermoon event card appears with the apparent size increase percentage.

**Negative Tests:**

7. **Given** the ephemeris data is missing but the meteor shower catalog is available,
   **When** the screen loads,
   **Then** meteor showers, solstices, and equinoxes from the catalog are shown, but computed events (eclipses, conjunctions) are absent with a note.
   **And** no crash occurs.

8. **Given** the user selects "Eclipses" filter and no eclipses occur in the next 12 months,
   **When** the filter applies,
   **Then** "No Eclipses events in the next 12 months." is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects conjunction under 2 degrees | Venus at 45.0, Jupiter at 46.5 | Notable Conjunction, separation = 1.5 degrees |
| no conjunction when separation > 5 | Venus at 45.0, Jupiter at 52.0 | No conjunction event |
| detects Supermoon | Full Moon distance 360,000 km | Supermoon event created |
| no Supermoon for distant Full Moon | Full Moon distance 400,000 km | No Supermoon event |
| adjusts meteor shower to current year | catalog: Perseids Aug 11-13 | 2026-08-11 to 2026-08-13 |
| adds Moon interference note | Perseid peak, Moon 85% | Visibility includes "Moon interference" |
| computes Spring Equinox date | Sun crossing 0 degrees longitude | March 20 within 1 day of actual |
| computes Summer Solstice date | Sun reaching 90 degrees | June 20-21 within 1 day of actual |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full 12-month event compilation | 1. Load catalog, 2. Compute eclipses/conjunctions, 3. Merge | Combined event list with multiple event types, ordered by date |
| Filter by event type | 1. Load all events, 2. Filter by "Meteor Showers" | Only meteor shower events shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User checks upcoming sky events | 1. Open Sky Events, 2. Browse timeline, 3. Tap a meteor shower, 4. Read observation tips | Timeline shows categorized events; expanded card shows full details with observation tips |
| User looks for eclipses | 1. Open Sky Events, 2. Filter by Eclipses | Eclipse events shown (if any in the next 12 months) or empty state message |

---

### ST-017: Astrology Journal

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-017 |
| **Feature Name** | Astrology Journal |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Spiritual Explorer, I want to journal about how astrological transits and moon phases affect my daily life, so that I can track patterns and build personal astrological wisdom over time.

**Secondary:**
> As a Dedicated Practitioner, I want to correlate my journal entries with active transits, so that I can verify whether astrological influences align with my lived experience.

#### 3.3 Detailed Description

The Astrology Journal provides a structured journaling experience tied to the user's astrological context. Each journal entry automatically captures the astrological "snapshot" of the moment: the current moon phase and sign, active transits to the user's natal chart, and the daily tarot card (if drawn). The user then writes a free-text reflection. Over time, the journal builds a personal database of transit-mood correlations.

Each entry consists of: free-text content (up to 5,000 characters), an auto-captured astrological context block (moon phase, sun sign, active transits, retrograde status), an optional mood tag (one of: inspired, calm, anxious, frustrated, joyful, contemplative, energized, drained), and an optional tarot card reference (if drawn today).

The journal includes a "Patterns" view that aggregates entries by transit type. For example, if the user has 5 entries during Mercury retrograde periods and 3 mention communication difficulties, the Patterns view highlights this correlation. This feature requires at least 30 entries to begin showing patterns (insufficient data is clearly communicated).

Entries are stored locally with full-text search capability. The journal supports export as a plain-text document or JSON file.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-004: Planet Position Calculator - for capturing current astrological context
- ST-008: Planetary Transit Tracking - for capturing active transits (optional enhancement)
- ST-009: Moon Phase Calendar - for capturing current moon phase
- ST-015: Tarot Card of the Day - for linking the daily card (optional)

**External Dependencies:**
- No external dependencies; purely local storage

**Assumed Capabilities:**
- Local database is initialized and writable
- For transit context capture: a natal chart should be computed (but journal works without it, just without transit data)

#### 3.5 User Interface Requirements

##### Screen: Journal List

**Layout:**
- The screen has a top navigation bar titled "Astrology Journal" with a search icon and a "New Entry" button (plus icon)
- Below the navigation bar, a segmented control: "Entries" and "Patterns"
- In "Entries" mode:
  - A vertical scrollable list of journal entries, sorted by most recent first
  - Each entry preview shows: date, mood tag (colored dot), moon phase icon, first 100 characters of text
  - Tapping an entry navigates to the full entry view
- In "Patterns" mode (requires 30+ entries):
  - A list of detected patterns with confidence indicators
  - Each pattern shows: pattern description, number of supporting entries, confidence level (low/medium/high)
  - Tapping a pattern shows the list of supporting entries

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Populated | Entries exist | Scrollable list of entry previews |
| Empty | No entries | Illustration with message: "Your astrology journal is empty. Start capturing your cosmic experiences." with a "Write First Entry" button |
| Search Active | User activated search | Search bar with real-time text matching |
| Patterns Available | 30+ entries | Patterns tab shows detected patterns |
| Patterns Insufficient | < 30 entries | Patterns tab shows "Write [N] more entries to unlock pattern detection" |

**Interactions:**
- Tap "New Entry": opens the compose screen with auto-captured context
- Tap an entry preview: opens the full entry view
- Tap search icon: activates search bar
- Toggle Entries/Patterns: switches between timeline and patterns view

##### Screen: Compose Entry

**Layout:**
- The screen has a top navigation bar with "Cancel" and "Save" buttons
- An auto-captured context card at the top showing: date, moon phase and sign, sun sign, active retrogrades (if any), and today's tarot card (if drawn)
- Below the context card, a mood tag selector: 8 mood options as colored pill buttons (inspired, calm, anxious, frustrated, joyful, contemplative, energized, drained); one can be selected or none
- Below the mood selector, a large text input area for free-text journaling (placeholder: "How are the stars affecting you today?")
- Character count at the bottom right: "0 / 5,000"

**Interactions:**
- Tap a mood tag: selects it (toggles off if already selected)
- Type in text area: free-text input with character count updating
- Tap "Save": validates (text must not be empty), saves entry, navigates back to list
- Tap "Cancel": confirmation dialog if text has been entered

#### 3.6 Data Requirements

##### Entity: JournalEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| profile_id | string | Foreign key to BirthProfile.id, nullable | null | The profile for transit context (null if no profile) |
| date | string | ISO 8601 date (YYYY-MM-DD) | None | The date of the entry |
| content | string | Required, max 5000 chars, not blank | None | Free-text journal content |
| mood | enum | One of: inspired, calm, anxious, frustrated, joyful, contemplative, energized, drained; nullable | null | Optional mood tag |
| moon_phase | enum | One of the 8 phase names | None | Moon phase at time of entry |
| moon_sign | enum | One of the 12 zodiac signs | None | Moon's zodiac sign |
| sun_sign | enum | One of the 12 zodiac signs | None | Sun's current zodiac sign |
| retrograde_planets | string | JSON array of planet names, nullable | null | Planets in retrograde at time of entry |
| active_transits | string | JSON array, max 3000 chars, nullable | null | Active transits to natal chart (if chart exists) |
| tarot_card_number | integer | 0 to 77, nullable | null | Today's tarot card (if drawn) |
| tarot_is_reversed | boolean | Nullable | null | Tarot card orientation |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- JournalEntry optionally belongs to BirthProfile (many-to-one via profile_id)
- JournalEntry optionally references TarotDraw (via tarot_card_number on the same date)

**Indexes:**
- date - chronological listing
- profile_id - for profile-scoped queries
- mood - for pattern analysis by mood
- content (FTS5 full-text search index) - for search functionality

**Validation Rules:**
- content: must not be empty or whitespace-only after trimming
- content: maximum 5,000 characters
- mood: if provided, must be one of the 8 valid values
- Maximum 1,000 journal entries total; user warned at 900 entries

**Example Data:**

```
{
  "id": "je-001",
  "profile_id": "b7e3f1a2-9c4d-4e8f-a1b2-c3d4e5f60001",
  "date": "2026-03-07",
  "content": "Feeling scattered today. Started three different projects but couldn't focus on any of them. Mercury retrograde is making communication at work really difficult.",
  "mood": "frustrated",
  "moon_phase": "waning_crescent",
  "moon_sign": "aquarius",
  "sun_sign": "pisces",
  "retrograde_planets": "[\"mercury\"]",
  "active_transits": "[{\"name\":\"Saturn square natal Moon\",\"orb\":2.3}]",
  "tarot_card_number": 16,
  "tarot_is_reversed": false,
  "created_at": "2026-03-07T14:30:00Z",
  "updated_at": "2026-03-07T14:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Astrological Context Auto-Capture

**Purpose:** Captures the current astrological snapshot when a journal entry is created.

**Inputs:**
- current_date: date
- current_positions: list of CurrentPlanetPosition (from ST-004)
- natal_chart: NatalChart (optional)
- todays_tarot: TarotDraw (optional)

**Logic:**

```
1. Compute moon_phase and moon_sign from current Moon position (ST-004 / ST-009 logic)
2. Compute sun_sign from current Sun position
3. Collect retrograde_planets: all bodies where speed < 0
4. IF natal_chart exists THEN
     Compute active_transits using transit detection logic (ST-008)
     Take top 5 tightest-orb transits
5. IF todays_tarot exists THEN
     Set tarot_card_number and tarot_is_reversed from the draw
6. Bundle all into the astrological context block
```

##### Pattern Detection

**Purpose:** Identifies correlations between astrological conditions and moods across journal entries.

**Inputs:**
- entries: list of JournalEntry (minimum 30)

**Logic:**

```
1. Group entries by astrological condition:
     By retrograde planet (e.g., all entries during Mercury retrograde)
     By moon phase (e.g., all entries during Full Moon)
     By moon sign (e.g., all entries during Moon in Scorpio)
     By active transit type (e.g., all entries during Saturn square natal Moon)
2. FOR each group with >= 5 entries:
     Count mood distribution within the group
     Compare to overall mood distribution across all entries
     IF a mood appears >= 50% more frequently in the group than in the overall THEN
       confidence = high if group size >= 10, medium if >= 7, low if >= 5
       Record pattern: "[mood] appears [X]% more often during [condition]"
3. Sort patterns by confidence descending, then by group size descending
4. RETURN list of patterns
```

**Edge Cases:**
- Fewer than 30 entries: pattern detection is disabled; message shown instead
- All entries have the same mood: no meaningful patterns can be detected
- No mood tags set: pattern detection cannot run on untagged entries

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Content is empty on save | Inline validation: "Write something before saving" | User adds text |
| Content exceeds 5,000 characters | Character count turns red; Save button disabled | User shortens text |
| Astrological context capture fails | Entry saves without context; note: "Astrological data unavailable for this entry" | Cosmetic; data absent but entry preserved |
| Database write fails | Toast: "Could not save entry. Please try again." | User retries |
| FTS index corrupted | Search returns no results; note: "Search is temporarily unavailable" | Module re-initialization |
| Entry limit approached (900+) | Warning: "You have [N] journal entries. Maximum is 1,000." | User exports and deletes old entries |

**Validation Timing:**
- Content validation on Save tap
- Character count updated in real time during typing
- Entry limit checked on "New Entry" tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "New Entry",
   **When** the compose screen opens,
   **Then** the astrological context card auto-populates with the current moon phase, moon sign, sun sign, retrograde planets, and today's tarot card (if drawn).

2. **Given** the user writes "Feeling creative and inspired today" with mood "inspired" and saves,
   **When** the entry is saved,
   **Then** the journal list shows the new entry at the top with the date, "inspired" mood dot, and the first 100 characters of text.

3. **Given** the user has 35 journal entries,
   **When** the user opens the "Patterns" tab,
   **Then** detected patterns are displayed, such as "Anxious mood appears 60% more often during Mercury retrograde (based on 8 entries, confidence: medium)."

4. **Given** the user taps the search icon and types "communication",
   **When** the search runs,
   **Then** all entries containing "communication" are shown in the results.

**Edge Cases:**

5. **Given** the user has 28 entries,
   **When** the user opens the "Patterns" tab,
   **Then** a message reads "Write 2 more entries to unlock pattern detection."

6. **Given** no natal chart is computed,
   **When** the user creates a journal entry,
   **Then** the context card shows moon phase, sun sign, and retrogrades, but the "Active Transits" section reads "Compute your natal chart for transit context."

**Negative Tests:**

7. **Given** the user tries to save an entry with only whitespace,
   **When** the Save button is tapped,
   **Then** an inline validation message appears: "Write something before saving."
   **And** the entry is not saved.

8. **Given** the text has reached 5,000 characters,
   **When** the user tries to type more,
   **Then** the character count turns red, further input is blocked, and a note reads "Maximum length reached."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| auto-captures moon phase | Moon at 234.7 phase angle | moon_phase = waning_gibbous |
| auto-captures retrograde planets | Mercury speed -1.21, Jupiter speed -0.05 | retrograde_planets = ["mercury", "jupiter"] |
| validates non-empty content | content: "   " (whitespace) | Validation error |
| validates content length | content: 5001 chars | Validation error |
| detects pattern with high confidence | 12 entries during Mercury Rx, 8 with "anxious" mood | Pattern with high confidence |
| no patterns with < 30 entries | 25 entries | Pattern detection disabled |
| FTS search finds matching entry | query: "communication", entry contains "communication" | Entry returned in results |
| FTS search returns empty for no match | query: "xyzzy", no entries contain it | Empty results |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full entry creation with context | 1. Compute current positions, 2. Create entry with text and mood, 3. Verify saved data | Entry saved with auto-captured context, mood, and content |
| Pattern detection | 1. Create 35 entries with varied moods and conditions, 2. Run pattern detection | At least one pattern detected with confidence level |
| Full-text search | 1. Create entries with varied content, 2. Search for a specific word | Matching entries returned |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User journals about their day | 1. Tap New Entry, 2. Review auto-captured context, 3. Select mood, 4. Write reflection, 5. Save | Entry saved with full context; appears at top of journal list |
| User discovers a personal pattern | 1. Write 30+ entries over weeks, 2. Open Patterns tab | Patterns shown correlating moods with astrological conditions |

---

### ST-018: Solar Return Chart

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-018 |
| **Feature Name** | Solar Return Chart |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Dedicated Practitioner, I want to compute my solar return chart for the current year, so that I can understand the major themes and influences for my birthday year.

**Secondary:**
> As a Spiritual Explorer, I want a preview of what the coming year holds astrologically, so that I can set intentions aligned with the cosmic energy of my solar return.

#### 3.3 Detailed Description

A Solar Return Chart is an astrological chart computed for the exact moment when the Sun returns to its precise natal position each year. This occurs within a day of the user's birthday and marks the beginning of the user's personal astrological year. The Solar Return chart is interpreted similarly to a natal chart but for the year ahead rather than the lifetime.

The system computes the solar return by finding the exact moment (to the minute) when the transiting Sun's longitude matches the natal Sun's longitude for the target year. It then computes a full chart for that moment, using the user's current location (or birth location if current location is not available).

The Solar Return chart includes: all planet positions in the zodiac at the solar return moment, house cusps computed for the user's location, aspects between solar return planets, and a comparison of solar return planets to natal planets (identifying which natal houses are activated).

The interpretation focuses on yearly themes: which houses are emphasized (e.g., Solar Return Sun in the 10th house = career-focused year), which planets are conjunct or opposite the natal Sun, and the overall energy of the year based on the Solar Return Ascendant.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-001: Birth Profile Management - requires birth data for the natal Sun position
- ST-002: Natal Chart Calculation - requires the natal Sun longitude
- ST-004: Planet Position Calculator - for computing positions at the solar return moment
- ST-010: Aspect Calculations - for computing solar return aspects

**External Dependencies:**
- Bundled Swiss Ephemeris data files
- Bundled solar return interpretation text (approximately 200KB compressed)

**Assumed Capabilities:**
- A natal chart has been computed for the selected profile
- Ephemeris data covers the target year

#### 3.5 User Interface Requirements

##### Screen: Solar Return

**Layout:**
- The screen has a top navigation bar with the profile name and "Solar Return [Year]" title, with left/right arrows to switch between years
- At the top, a banner showing: "Your [Year] Solar Return: [Date] at [Time]" (the exact moment of the return)
- Below the banner, a "Year Theme" card: a 2-3 sentence summary of the year's overall theme based on the Solar Return Ascendant and Sun house
- Below the theme, a "Planet Positions" list showing all planet positions in the solar return chart (same format as ST-002 Natal Chart Summary)
- Below the planets, a "Key Themes" section with 3-5 cards highlighting the most important features of the solar return:
  - Solar Return Sun house (the main area of focus for the year)
  - Solar Return Moon sign and house (emotional focus)
  - Solar Return Ascendant (outward approach for the year)
  - Most significant solar return aspects
- A "Compare to Natal" button shows an overlay of solar return planets on the natal chart

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Current Year | Viewing the current/upcoming solar return | Full chart with interpretation |
| Past Year | Viewing a previous year (up to 5 years back) | Full chart for that year |
| Loading | Solar return being computed | Loading indicator: "Finding your solar return..." |
| No Chart | Natal chart not computed | Message: "Calculate your natal chart to view your solar return" |

**Interactions:**
- Tap left/right arrows: switch to the previous/next year's solar return (range: 5 years back to 2 years ahead)
- Tap a planet row: expands to show solar return interpretation for that placement
- Tap "Compare to Natal": shows side-by-side or overlay view of natal vs. solar return

**Transitions/Animations:**
- Year navigation slides content left/right (250ms)
- Key theme cards stagger in with a 80ms delay

#### 3.6 Data Requirements

##### Entity: SolarReturnChart

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| profile_id | string | Foreign key to BirthProfile.id | None | The profile this return is for |
| return_year | integer | 1900 to 2100 | None | The year of the solar return |
| return_datetime | string | ISO 8601 datetime | None | Exact moment of the solar return (UTC) |
| return_datetime_local | string | ISO 8601 datetime | None | In user's timezone |
| natal_sun_longitude | float | 0.0 to 359.999 | None | Natal Sun longitude being matched |
| location_latitude | float | -90.0 to 90.0 | None | Location used for house calculation |
| location_longitude | float | -180.0 to 180.0 | None | Location used for house calculation |
| ascendant_longitude | float | 0.0 to 359.999 | None | Solar Return Ascendant |
| planet_positions | string | JSON array, max 5000 chars | None | All planet positions at the return moment |
| house_cusps | string | JSON array, max 2000 chars | None | 12 house cusp longitudes |
| aspects | string | JSON array, max 5000 chars | None | Solar return aspects |
| year_theme | string | Max 500 chars | None | Summary theme for the year |
| key_themes | string | JSON array, max 5000 chars | None | 3-5 key theme interpretations |
| computed_at | datetime | ISO 8601 | Current timestamp | When computed |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- SolarReturnChart belongs to BirthProfile (many-to-one; one per year per profile)

**Indexes:**
- (profile_id, return_year) unique - one solar return per year per profile
- return_year - for year navigation

**Validation Rules:**
- return_year: must be within 1900 to 2100
- natal_sun_longitude must match the natal chart's Sun longitude
- return_datetime must be within 2 days of the user's birthday in the target year

**Example Data:**

```
{
  "id": "sr-2026",
  "profile_id": "b7e3f1a2-9c4d-4e8f-a1b2-c3d4e5f60001",
  "return_year": 2026,
  "return_datetime": "2026-03-21T06:42:00Z",
  "return_datetime_local": "2026-03-20T23:42:00-07:00",
  "natal_sun_longitude": 0.35,
  "location_latitude": 37.7749,
  "location_longitude": -122.4194,
  "ascendant_longitude": 210.5,
  "year_theme": "A year of partnership and collaboration. Your Solar Return Sun in the 7th house emphasizes relationships and shared goals.",
  "key_themes": "[{\"theme\":\"Sun in 7th House\",\"text\":\"Relationships take center stage...\"}]"
}
```

#### 3.7 Business Logic Rules

##### Solar Return Moment Computation

**Purpose:** Finds the exact moment when the transiting Sun returns to its natal longitude.

**Inputs:**
- natal_sun_longitude: float - the natal Sun's ecliptic longitude
- target_year: integer - the year to compute the return for
- birth_month: integer - approximate month (for search window)
- birth_day: integer - approximate day

**Logic:**

```
1. Set search_start = target_year-birth_month-birth_day minus 2 days (as Julian Day)
2. Set search_end = search_start + 4 days
3. Binary search within the 4-day window:
     FOR 20 iterations (precision better than 1 second):
       mid_time = (search_start + search_end) / 2
       Compute Sun longitude at mid_time using Swiss Ephemeris
       IF sun_longitude < natal_sun_longitude (accounting for 360-degree wrap) THEN
         search_start = mid_time
       ELSE
         search_end = mid_time
4. return_datetime = mid_time (converted from JD to ISO 8601)
5. RETURN return_datetime
```

**Edge Cases:**
- Leap year birthday (Feb 29): search window expanded to 5 days
- Sun longitude near 0/360 boundary: handle wrap-around in comparison
- Return moment falls on a different calendar day than the birthday: this is normal and expected

##### Solar Return Chart Computation

**Purpose:** Computes a full chart for the solar return moment.

**Logic:**

```
1. Using return_datetime and user_location:
     Compute all planet positions (same as ST-002)
     Compute house cusps using Placidus (same as ST-002)
     Compute aspects between solar return planets (same as ST-010)
2. Determine year theme from Solar Return Sun house and Ascendant sign
3. Identify key themes from prominent placements
4. Cache the result
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Natal chart not computed | Message: "Calculate your natal chart to view your solar return" | User computes chart |
| Solar return computation fails | Error: "Could not compute your solar return. Please try again." | User retries |
| Year outside ephemeris range | "Solar return data is available for years 1900-2100." | User selects a valid year |
| Location data missing | Uses birth location as default; note: "Using birth location for house calculation" | User can update location in settings |

**Validation Timing:**
- Natal chart availability checked on screen load
- Year range validated before computation
- Return moment validated against the birthday (+/- 2 days)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a profile with natal Sun at 0.35 degrees (Aries),
   **When** the solar return for 2026 is computed,
   **Then** the return moment is found (approximately March 20-21, 2026), all planet positions are computed, and the year theme is generated.

2. **Given** the solar return is displayed,
   **When** the user views the key themes,
   **Then** 3-5 theme cards show the Sun house, Moon sign/house, Ascendant, and significant aspects.

3. **Given** the user navigates to the 2025 solar return,
   **When** the chart loads,
   **Then** the previous year's solar return is computed and displayed for retrospective review.

**Edge Cases:**

4. **Given** a user born on February 29,
   **When** the 2026 solar return is computed (non-leap year),
   **Then** the return moment is found near February 28 or March 1, 2026 (within 2 days).

5. **Given** the solar return moment falls at 11:42 PM on March 20 (day before birthday),
   **When** the banner displays,
   **Then** the date shows "March 20, 2026 at 11:42 PM" (not the birthday date of March 21).

**Negative Tests:**

6. **Given** the natal chart has not been computed,
   **When** the user opens the Solar Return screen,
   **Then** "Calculate your natal chart to view your solar return" is displayed with a button.

7. **Given** the user navigates to year 2101,
   **When** the navigation arrow would go beyond 2100,
   **Then** the arrow is disabled and no computation is attempted.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| finds solar return moment for known date | natal Sun: 0.35 (Aries), year 2026 | return_datetime near March 20-21, 2026 |
| precision within 1 minute | 20 binary search iterations | Sun longitude at return_datetime within 0.001 degrees of natal |
| handles Feb 29 birthday | birth_month: 2, birth_day: 29, year: 2026 | Return found near Feb 28 or Mar 1 |
| handles Sun near 0/360 boundary | natal Sun: 359.9, year 2026 | Return found in late Pisces season |
| computes year theme from Sun house | SR Sun in 10th house | Theme mentions career/public image |
| computes year theme from Ascendant | SR Ascendant in Scorpio | Theme mentions transformation/intensity |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full solar return computation | 1. Compute natal chart, 2. Compute 2026 solar return | SolarReturnChart with valid return moment, planets, houses, aspects, and themes |
| Year navigation | 1. Compute 2026, 2. Navigate to 2025 | Different return moment and chart data for each year |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User views their birthday year chart | 1. Compute natal chart, 2. Open Solar Return, 3. View key themes | Solar return displayed with year theme, planet positions, and key themes |
| User reviews past year's solar return | 1. Navigate to previous year, 2. Review themes | Previous year's solar return displayed for retrospection |

---

### ST-019: Progressed Chart

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-019 |
| **Feature Name** | Progressed Chart |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Dedicated Practitioner, I want to compute my secondary progressed chart, so that I can understand the slow-moving evolutionary themes in my life over decades.

**Secondary:**
> As a Spiritual Explorer, I want to know when my progressed Moon changes signs (approximately every 2.5 years), so that I can understand shifts in my emotional focus.

#### 3.3 Detailed Description

The Progressed Chart (specifically, Secondary Progressions) uses the symbolic technique where each day after birth represents one year of life. To compute the progressed chart for age 30, the system calculates the planet positions for 30 days after birth. This creates a slowly evolving chart that shows long-term developmental themes.

The most important progressed element is the Progressed Moon, which moves approximately 12-14 degrees per year (1 degree per "progressed month") and changes signs every 2-3 years. The Progressed Sun moves approximately 1 degree per year and changes signs every 30 years. Progressed Mercury, Venus, and Mars also move slowly and are tracked.

The feature shows: the current progressed chart (all planet positions for the current progressed date), key progressed sign changes (past and upcoming), progressed aspects to the natal chart, and a timeline of when progressed planets change signs.

The computation is straightforward: for a person currently aged N, compute planet positions for (birth_date + N days) using the Swiss Ephemeris. The progressed Moon's sign is the single most consulted progressed element and is highlighted prominently.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-001: Birth Profile Management - requires birth data
- ST-002: Natal Chart Calculation - requires natal positions for comparison

**External Dependencies:**
- Bundled Swiss Ephemeris data files
- Bundled progressed chart interpretation text (approximately 150KB compressed)

**Assumed Capabilities:**
- A natal chart has been computed
- The user's current age can be derived from birth_date

#### 3.5 User Interface Requirements

##### Screen: Progressions

**Layout:**
- The screen has a top navigation bar with the profile name and "Progressions" title
- At the top, a "Progressed Moon" highlight card showing: current progressed Moon sign and degree, years until next sign change, and a brief interpretation of the current progressed Moon sign
- Below, a "Progressed Sun" card: current sign (changes approximately every 30 years), degree, and brief interpretation
- Below, a "Progressed Planets" section listing all progressed planet positions (Mercury through Mars; outer planets barely move in progressions and are omitted)
- Below, a "Sign Change Timeline" showing past and future progressed sign changes for the Moon and Sun as a horizontal timeline
- Below, a "Progressed Aspects" section listing any progressed planets within 1-degree orb of natal planets

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Complete | All progressed data available | Full display with Moon, Sun, planets, timeline, and aspects |
| No Chart | Natal chart not computed | Message: "Calculate your natal chart to view progressions" |
| Loading | Progressions being computed | Loading indicator: "Computing your progressions..." |

**Interactions:**
- Tap the Progressed Moon card: expands to show 2-3 paragraphs about the current progressed Moon sign
- Tap a sign change on the timeline: shows the date and interpretation of that sign change
- Tap a progressed aspect: shows the interpretation of that aspect

**Transitions/Animations:**
- Progressed Moon card fades in with a 300ms animation
- Timeline scrolls horizontally with momentum
- Card expansions use 200ms height animation

#### 3.6 Data Requirements

##### Entity: ProgressedChart

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| profile_id | string | Foreign key to BirthProfile.id, unique | None | The profile |
| progressed_date | string | ISO 8601 date | None | The progressed date (birth_date + age in days) |
| current_age_years | float | 0.0 to 200.0 | None | Current age in decimal years |
| moon_longitude | float | 0.0 to 359.999 | None | Progressed Moon longitude |
| moon_sign | enum | One of the 12 zodiac signs | None | Progressed Moon sign |
| moon_degree | integer | 0 to 29 | None | Degree in sign |
| moon_next_sign_change_date | string | ISO 8601 date | None | When the Moon enters the next sign |
| moon_next_sign | enum | One of the 12 zodiac signs | None | The next sign the Moon enters |
| sun_longitude | float | 0.0 to 359.999 | None | Progressed Sun longitude |
| sun_sign | enum | One of the 12 zodiac signs | None | Progressed Sun sign |
| sun_degree | integer | 0 to 29 | None | Degree in sign |
| planet_positions | string | JSON array, max 3000 chars | None | Progressed positions for Mercury, Venus, Mars |
| progressed_aspects | string | JSON array, max 3000 chars | None | Progressed-to-natal aspects within 1 degree orb |
| sign_change_timeline | string | JSON array, max 5000 chars | None | Past and future sign changes for Moon and Sun |
| computed_at | datetime | ISO 8601 | Current timestamp | When computed |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- ProgressedChart belongs to BirthProfile (one-to-one via profile_id)

**Indexes:**
- profile_id (unique) - fast lookup

**Validation Rules:**
- progressed_date must equal birth_date + floor(current_age_years) days
- current_age_years must be positive
- moon_next_sign_change_date must be in the future

**Example Data:**

```
{
  "id": "prog-001",
  "profile_id": "b7e3f1a2-9c4d-4e8f-a1b2-c3d4e5f60001",
  "progressed_date": "1995-04-20",
  "current_age_years": 30.95,
  "moon_longitude": 185.3,
  "moon_sign": "libra",
  "moon_degree": 5,
  "moon_next_sign_change_date": "2027-08-15",
  "moon_next_sign": "scorpio",
  "sun_longitude": 31.3,
  "sun_sign": "taurus",
  "sun_degree": 1,
  "progressed_aspects": "[{\"progressed\":\"moon\",\"natal\":\"venus\",\"aspect\":\"conjunction\",\"orb\":0.5}]"
}
```

#### 3.7 Business Logic Rules

##### Progressed Date Calculation

**Purpose:** Computes the progressed date corresponding to the user's current age.

**Inputs:**
- birth_date: date
- current_date: date

**Logic:**

```
1. age_in_days = current_date - birth_date (as integer days)
2. age_in_years = age_in_days / 365.25
3. progressed_date = birth_date + age_in_days (literally: one day per year of life)
   Wait - correction: progressed_date = birth_date + floor(age_in_years) days
   Actually the standard formula: progressed_date = birth_date + floor(age_in_years) days after birth
   More precisely: for a person who is N years old, compute positions for birth_date + N days
4. RETURN progressed_date
```

**Formulas:**
- `progressed_date = birth_date + floor(age_in_years)` (where + is adding N calendar days)
- `age_in_years = (current_date - birth_date) / 365.25`

**Edge Cases:**
- Fractional year: the progressed date includes the fractional part (e.g., age 30.5 = 30 days + 12 hours after birth)
- Very young user (age < 1): progressed_date is within the first day after birth
- Leap year complications: use Julian Day arithmetic for precise day counting

##### Progressed Moon Sign Change Forecast

**Purpose:** Determines when the progressed Moon will enter the next zodiac sign.

**Inputs:**
- current_moon_longitude: float
- moon_speed_per_year: float (derived from the difference between two consecutive progressed days)

**Logic:**

```
1. current_sign_index = floor(current_moon_longitude / 30)
2. next_sign_boundary = (current_sign_index + 1) * 30
3. degrees_to_boundary = next_sign_boundary - current_moon_longitude
4. IF degrees_to_boundary <= 0 THEN degrees_to_boundary += 30 (wrap-around)
5. years_to_change = degrees_to_boundary / moon_speed_per_year
6. moon_next_sign_change_date = current_date + (years_to_change * 365.25) days
7. moon_next_sign = zodiac_signs[(current_sign_index + 1) mod 12]
8. RETURN { moon_next_sign_change_date, moon_next_sign }
```

**Edge Cases:**
- Moon near 29 degrees of a sign: sign change is imminent (within months)
- Moon speed varies: use the average of the current and next progressed day speeds

##### Progressed-to-Natal Aspects

**Purpose:** Identifies progressed planets within tight orb of natal planets.

**Inputs:**
- progressed_positions: list of planet positions at the progressed date
- natal_positions: list of natal planet positions

**Logic:**

```
1. Use the same aspect detection logic as ST-010 but with a 1-degree maximum orb for all aspects
2. Only compute for: progressed Sun, Moon, Mercury, Venus, Mars against all natal planets
3. Outer progressed planets move too slowly to produce meaningful progressions; exclude them
4. RETURN list of progressed aspects
```

**Edge Cases:**
- Progressed planet stations retrograde: the aspect may be active for multiple progressed years (equivalent to months of real time)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Natal chart not computed | Message: "Calculate your natal chart to view progressions" | User computes chart |
| Progressed date outside ephemeris range | "Progressed data unavailable for this age range" | Cosmetic; affects users born after 2070 approximately |
| Computation fails | Error: "Could not compute progressions. Please try again." | User retries |
| Interpretation text missing | Placeholder: "Interpretation coming soon." | App update |

**Validation Timing:**
- Natal chart availability checked on screen load
- Progressed date range validated before computation

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a 30-year-old user with a computed natal chart,
   **When** the Progressions screen opens,
   **Then** the Progressed Moon card shows the current progressed Moon sign with degree and years until the next sign change.

2. **Given** the progressed Moon is at 5 degrees Libra,
   **When** the Moon highlight card is displayed,
   **Then** it shows "Progressed Moon in Libra, 5 degrees" and a 2-3 sentence interpretation about partnership focus.

3. **Given** the progressed Moon will enter Scorpio in approximately 1.5 years,
   **When** the sign change timeline is displayed,
   **Then** the timeline shows "Moon enters Scorpio: August 2027" and interpretive text about the upcoming shift.

**Edge Cases:**

4. **Given** the progressed Sun is at 29 degrees Aries (about to change signs),
   **When** the Sun card is displayed,
   **Then** it notes "Progressed Sun entering Taurus soon" with an interpretation about the 30-year shift.

5. **Given** the progressed Moon is conjunct natal Venus within 0.3 degrees,
   **When** the Progressed Aspects section loads,
   **Then** the aspect is listed: "Progressed Moon conjunct natal Venus (orb: 0.3 degrees)" with interpretation.

**Negative Tests:**

6. **Given** the natal chart has not been computed,
   **When** the user opens Progressions,
   **Then** "Calculate your natal chart to view progressions" is displayed.

7. **Given** the user's age would push the progressed date beyond 2100,
   **When** the computation is attempted,
   **Then** "Progressed data unavailable for this age range" is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes progressed date for age 30 | birth: 1995-03-21, current: 2026-03-07 | progressed_date approximately 1995-04-20 (30 days after birth) |
| computes age in years | birth: 1995-03-21, current: 2026-03-07 | age approximately 30.95 |
| computes Moon sign change timing | Moon at 5 degrees Libra, speed 14 deg/year | Next sign at 30 Libra = 25 degrees away = approximately 1.8 years |
| detects progressed-natal conjunction | progressed Moon: 185.3, natal Venus: 185.8 | Conjunction, orb = 0.5 |
| rejects aspect with orb > 1 | progressed Moon: 185.3, natal Venus: 187.0 | No aspect (orb = 1.7 > max 1.0) |
| handles progressed date for age 0.5 | 6-month-old | progressed_date = birth_date + 0 days (floor) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full progressed chart computation | 1. Compute natal chart, 2. Compute progressions | ProgressedChart with valid Moon, Sun, planet positions, and aspects |
| Sign change timeline | 1. Compute progressions, 2. Verify timeline | Past and future Moon sign changes listed with dates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User explores their progressions | 1. Compute natal chart, 2. Open Progressions, 3. View Moon card, 4. Check sign change timeline | Progressed Moon sign displayed with interpretation; timeline shows upcoming sign changes |

---

### ST-020: Data Export (JSON/CSV)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-020 |
| **Feature Name** | Data Export (JSON/CSV) |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Privacy-Conscious User, I want to export all my MyStars data in standard formats, so that I own my data and can back it up or move to another app.

**Secondary:**
> As a Dedicated Practitioner, I want to export my natal chart data and journal entries in a structured format, so that I can analyze them with external tools or share chart details with an astrologer.

#### 3.3 Detailed Description

Data Export provides complete data portability by allowing users to export all MyStars data in JSON and CSV formats. This is a core privacy feature that ensures users own their data and can extract it at any time.

The export covers: birth profiles (all fields), natal chart data (planet positions, house cusps, angles), compatibility results, daily horoscopes (up to 90 days of cached readings), tarot draw history, journal entries, and user settings/preferences.

The user can choose between three export scopes: "Everything" (all data), "Charts Only" (profiles, natal charts, aspects, and compatibility), or "Journal Only" (journal entries with astrological context). The export generates a single file - either a JSON file (hierarchical, preserving relationships) or a ZIP file containing multiple CSV files (one per entity).

Export files include a metadata header with the export date, app version, and data schema version, enabling future import compatibility. The JSON format is human-readable and includes comments (as `_comment` fields) explaining each section. The CSV format includes header rows with clear column names.

No birth data, chart data, or personal information is transmitted during export. The file is saved to the device's file system and the user chooses where to save or share it via the system share sheet.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-001: Birth Profile Management - for exporting profiles
- ST-002: Natal Chart Calculation - for exporting chart data

**External Dependencies:**
- File system access for saving the export file
- System share sheet for sharing the file

**Assumed Capabilities:**
- Local database is readable
- Device has sufficient storage for the export file (typically under 5MB)

#### 3.5 User Interface Requirements

##### Screen: Export Data

**Layout:**
- The screen is accessed from Settings
- The screen has a top navigation bar titled "Export Data"
- Three scope selection cards: "Everything", "Charts Only", "Journal Only" (radio-button style; one selected at a time)
- Below the scope, a format selector: "JSON" or "CSV (ZIP)" toggle
- Below the format, a summary showing: number of profiles, charts, journal entries, and tarot draws that will be included based on the selected scope
- An "Export" button at the bottom
- Below the button, a note: "Your data stays on your device. No information is sent to any server."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Scope and format selected | Summary shows data counts, Export button enabled |
| Exporting | Export in progress | Progress indicator with "Preparing your data..." |
| Complete | Export file generated | System share sheet opens with the file |
| No Data | No data exists for the selected scope | Message: "No data to export for the selected scope." Export button disabled |
| Error | Export fails | Toast: "Export failed. Please try again." |

**Interactions:**
- Tap a scope card: selects that scope, updates the summary counts
- Toggle JSON/CSV: selects the format
- Tap "Export": generates the file and opens the share sheet
- Share sheet actions: Save to Files, AirDrop, email, etc.

**Transitions/Animations:**
- Summary counts update with a 200ms number animation when scope changes
- Export progress uses an indeterminate progress bar

#### 3.6 Data Requirements

##### Entity: ExportMetadata (Generated at Export Time)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| export_date | string | ISO 8601 datetime | Current timestamp | When the export was generated |
| app_version | string | Semver format | Current app version | MyStars version |
| schema_version | integer | Positive integer | Current schema version | Database schema version for import compatibility |
| scope | enum | One of: everything, charts_only, journal_only | None | What data is included |
| format | enum | One of: json, csv_zip | None | Export format |
| profile_count | integer | >= 0 | None | Number of profiles exported |
| chart_count | integer | >= 0 | None | Number of charts exported |
| journal_entry_count | integer | >= 0 | None | Number of journal entries exported |
| tarot_draw_count | integer | >= 0 | None | Number of tarot draws exported |

**Example JSON Export Structure:**

```
{
  "_metadata": {
    "export_date": "2026-03-07T14:30:00Z",
    "app_version": "1.0.0",
    "schema_version": 1,
    "scope": "everything",
    "format": "json",
    "profile_count": 3,
    "chart_count": 2,
    "journal_entry_count": 45,
    "tarot_draw_count": 30
  },
  "profiles": [ ... ],
  "natal_charts": [ ... ],
  "planet_positions": [ ... ],
  "house_cusps": [ ... ],
  "aspects": [ ... ],
  "compatibility_results": [ ... ],
  "daily_horoscopes": [ ... ],
  "tarot_draws": [ ... ],
  "journal_entries": [ ... ],
  "settings": { ... }
}
```

#### 3.7 Business Logic Rules

##### Export Data Assembly

**Purpose:** Collects all data for the selected scope and assembles it into the chosen format.

**Inputs:**
- scope: enum - everything, charts_only, or journal_only
- format: enum - json or csv_zip

**Logic:**

```
1. Based on scope, query the database:
     everything: all profiles, charts, positions, cusps, aspects, compatibility, horoscopes, tarot draws, journal entries, settings
     charts_only: all profiles, charts, positions, cusps, aspects, compatibility
     journal_only: all journal entries with embedded astrological context
2. Generate metadata with counts
3. IF format == json THEN
     Assemble all data into a single JSON object with the structure above
     Serialize as formatted JSON (2-space indent, human-readable)
     File name: "mystars-export-YYYY-MM-DD.json"
4. IF format == csv_zip THEN
     Create one CSV file per entity type (profiles.csv, natal_charts.csv, etc.)
     Each CSV has a header row with column names
     Package all CSVs into a single ZIP file
     File name: "mystars-export-YYYY-MM-DD.zip"
5. RETURN the file
```

**Edge Cases:**
- Empty database: export produces a valid file with metadata and empty arrays/tables
- Very large journal (1,000 entries): export may take a few seconds; show progress indicator
- Special characters in journal text: properly escaped in JSON; quoted in CSV
- Unicode content: UTF-8 encoding for all export files

##### File Size Estimation

**Purpose:** Estimates the export file size before generation.

**Logic:**

```
1. profile_size = profile_count * 500 bytes
2. chart_size = chart_count * 5000 bytes (including positions and cusps)
3. journal_size = journal_entry_count * 1000 bytes
4. tarot_size = tarot_draw_count * 200 bytes
5. total_estimate = profile_size + chart_size + journal_size + tarot_size + metadata_overhead (1000 bytes)
6. IF total_estimate > 10MB THEN warn user: "Large export (approximately [N] MB). Ensure sufficient storage."
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data for selected scope | "No data to export for the selected scope." Export button disabled | User selects a different scope or creates data first |
| File system write fails | Toast: "Could not save export file. Check available storage." | User frees storage and retries |
| Export file exceeds available storage | Toast: "Not enough storage for export. Free up space and try again." | User frees storage |
| Share sheet canceled | File is still generated; user can export again to re-open share sheet | User taps Export again |
| Database read error during export | Toast: "Could not read some data. Export may be incomplete." | User retries; if persistent, suggests app restart |

**Validation Timing:**
- Data availability checked before enabling Export button (scope counts > 0)
- Storage availability checked before starting file generation
- File integrity validated after generation (valid JSON / valid ZIP)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 3 profiles, 2 natal charts, and 45 journal entries,
   **When** the user selects "Everything" scope and "JSON" format and taps Export,
   **Then** a JSON file is generated containing all profiles, charts, journal entries, and metadata; the system share sheet opens with the file.

2. **Given** the user selects "Charts Only" scope and "CSV (ZIP)" format,
   **When** the export completes,
   **Then** a ZIP file is generated containing profiles.csv, natal_charts.csv, planet_positions.csv, house_cusps.csv, aspects.csv, and compatibility_results.csv.

3. **Given** the user selects "Journal Only",
   **When** the export completes,
   **Then** only journal entries are included in the export, along with metadata.

**Edge Cases:**

4. **Given** the database is empty (no profiles, no entries),
   **When** the user attempts to export "Everything",
   **Then** "No data to export for the selected scope." is displayed and the Export button is disabled.

5. **Given** a journal entry contains special characters (quotes, newlines, Unicode),
   **When** the CSV export is generated,
   **Then** the special characters are properly quoted/escaped and the CSV is valid.

**Negative Tests:**

6. **Given** the device has insufficient storage for the export file,
   **When** the export is attempted,
   **Then** a toast shows "Not enough storage for export. Free up space and try again."
   **And** no partial or corrupt file is saved.

7. **Given** a database read error occurs during export,
   **When** the error is caught,
   **Then** a toast shows "Could not read some data. Export may be incomplete." and whatever data was successfully read is still exported.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| assembles JSON with metadata | 3 profiles, 2 charts | Valid JSON with _metadata.profile_count = 3, chart_count = 2 |
| generates CSV with headers | 1 profile | profiles.csv with header row and 1 data row |
| escapes quotes in CSV | journal content: 'He said "hello"' | Content properly quoted in CSV |
| handles empty database | no data | Valid JSON with empty arrays, metadata counts all 0 |
| estimates file size | 10 profiles, 5 charts, 100 entries | Estimate within 50% of actual size |
| filters by scope charts_only | 3 profiles, 2 charts, 50 entries | Export contains profiles and charts only, no entries |
| filters by scope journal_only | 50 entries | Export contains entries only, no profiles or charts |
| generates correct filename | date: 2026-03-07, format: json | "mystars-export-2026-03-07.json" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full export and verify | 1. Create data, 2. Export as JSON, 3. Parse the JSON | All data present, valid JSON, metadata accurate |
| CSV ZIP export and verify | 1. Create data, 2. Export as CSV ZIP, 3. Extract ZIP | All CSV files present with correct headers and data rows |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User exports all data for backup | 1. Open Settings, 2. Tap Export Data, 3. Select Everything, 4. Select JSON, 5. Tap Export, 6. Save to Files | JSON file saved to device with all MyStars data |
| User exports journal for external analysis | 1. Select Journal Only, 2. Select CSV, 3. Export | ZIP file with journal_entries.csv containing all entries with astrological context columns |

---

### ST-021: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-021 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user, I want to configure MyStars to match my preferences for optional bodies, house systems, and notification settings, so that the app works the way I expect.

**Secondary:**
> As a Privacy-Conscious User, I want to be able to delete all my data with a single action, so that I have full control over my personal information.

#### 3.3 Detailed Description

Settings and Preferences provides a centralized screen for configuring MyStars behavior. The settings cover: calculation preferences (which optional bodies to include, house system selection), display preferences (explanation depth default, chart view mode default), data management (export, delete all data), and module information (version, storage usage, support).

All settings are stored locally in the `st_settings` table and take effect immediately upon change. No settings are synced to any server. The "Delete All Data" action is destructive and irreversible, requiring a two-step confirmation (tap Delete, then type "DELETE" to confirm).

Settings that affect chart calculations (optional bodies, house system) trigger cache invalidation for all natal charts, causing recalculation on next view. The system warns the user before applying calculation setting changes: "This will require recalculating all charts. Continue?"

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (Settings is a standalone feature)

**External Dependencies:**
- None

**Assumed Capabilities:**
- Local database is writable

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- The screen has a top navigation bar titled "Settings"
- Sections organized vertically:
- **Calculation Settings:**
  - "House System": picker with options Placidus (default), Whole Sign, Koch, Equal
  - "Optional Bodies": toggles for Chiron (default off), North Node (default off), Lilith (default off)
  - Note below: "Changing these settings will recalculate all charts."
- **Display Settings:**
  - "Default Explanation Depth": toggle between Beginner (default) and Advanced
  - "Default Chart View": toggle between Traditional (default) and Modern
  - "Moon Phase in Dashboard": toggle (default on)
- **Data Management:**
  - "Export Data": navigates to ST-020 Export screen
  - "Storage Used": displays current database size (e.g., "12.3 MB")
  - "Delete All Data": destructive action with two-step confirmation
- **About:**
  - "Version": app version number
  - "Ephemeris Data Range": "1900 - 2100"
  - "Content Library": "Last updated: [date]"
  - "Licenses": link to open-source license attributions (Swiss Ephemeris, etc.)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Initial settings | All defaults applied |
| Modified | User changed a setting | Setting reflects new value immediately; if calculation setting, warning shown |
| Deleting | Delete All Data in progress | Progress indicator: "Deleting all data..." |
| Deleted | All data deleted | Confirmation: "All MyStars data has been deleted." Module returns to initial empty state |

**Interactions:**
- Tap "House System": opens a picker with 4 options
- Toggle an optional body: enables/disables that body in chart calculations; triggers chart recalculation warning
- Toggle display settings: applies immediately, no warning needed
- Tap "Export Data": navigates to the Export screen (ST-020)
- Tap "Delete All Data": first confirmation dialog "Delete all MyStars data? This cannot be undone." with "Delete" and "Cancel"; if "Delete" tapped, second confirmation: text input "Type DELETE to confirm"; on match, all data is deleted
- Tap "Licenses": opens a scrollable list of license texts

**Transitions/Animations:**
- Setting changes apply with a subtle 150ms checkmark animation
- Delete progress uses an indeterminate progress bar
- Confirmation dialogs use standard system modal presentation

#### 3.6 Data Requirements

##### Entity: UserSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, always "settings" (singleton) | "settings" | Singleton settings record |
| house_system | enum | One of: placidus, whole_sign, koch, equal | placidus | Preferred house system |
| show_chiron | boolean | - | false | Whether to include Chiron in charts |
| show_north_node | boolean | - | false | Whether to include North Node |
| show_lilith | boolean | - | false | Whether to include Lilith |
| default_depth | enum | One of: beginner, advanced | beginner | Default explanation depth |
| default_chart_view | enum | One of: traditional, modern | traditional | Default chart visualization style |
| show_moon_in_dashboard | boolean | - | true | Whether to show moon phase on the hub dashboard |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- UserSettings is a singleton (one record in the table)

**Indexes:**
- id (primary key) - singleton lookup

**Validation Rules:**
- Only one settings record exists at any time
- house_system: must be one of the 4 valid options
- All boolean fields default to their specified defaults if missing

**Example Data:**

```
{
  "id": "settings",
  "house_system": "placidus",
  "show_chiron": false,
  "show_north_node": true,
  "show_lilith": false,
  "default_depth": "beginner",
  "default_chart_view": "traditional",
  "show_moon_in_dashboard": true
}
```

#### 3.7 Business Logic Rules

##### Calculation Setting Change Handler

**Purpose:** Invalidates cached charts when calculation settings change.

**Inputs:**
- changed_setting: string - the setting that changed (house_system, show_chiron, show_north_node, show_lilith)

**Logic:**

```
1. Show confirmation: "This will require recalculating all charts. Continue?"
2. IF user confirms THEN
     Update the setting in UserSettings
     Delete all cached NatalChart records (cascade deletes PlanetPositions, HouseCusps, Aspects)
     Delete all cached CompatibilityResult records
     Delete all cached PersonalityAnalysis records
     Delete all cached ProgressedChart records
     Delete all cached SolarReturnChart records
3. ELSE
     Revert the setting to its previous value
```

**Edge Cases:**
- Multiple calculation settings changed in succession: each triggers a cache invalidation, but since the cache is already empty after the first, subsequent invalidations are no-ops
- No charts exist: invalidation runs but has no effect

##### Delete All Data

**Purpose:** Permanently removes all MyStars data from the device.

**Inputs:**
- confirmation_text: string - must be exactly "DELETE"

**Logic:**

```
1. IF confirmation_text != "DELETE" THEN
     REJECT: "Type DELETE to confirm."
2. Delete all rows from all st_ prefixed tables:
     st_birth_profiles
     st_natal_charts
     st_planet_positions
     st_house_cusps
     st_aspects
     st_compatibility_results
     st_daily_horoscopes
     st_tarot_draws
     st_journal_entries
     st_moon_calendar_days
     st_transit_events
     st_zodiac_events
     st_user_settings
3. Re-create the default UserSettings record with all defaults
4. Navigate to the MyStars empty/onboarding state
```

**Edge Cases:**
- Delete while a computation is in progress: cancel the computation first, then delete
- Delete followed by immediate app close: ensure all deletes are committed before returning

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Setting save fails | Toast: "Could not save setting. Please try again." | User retries |
| Delete All Data fails midway | Toast: "Data deletion encountered an error. Some data may remain." | User retries the delete |
| Confirmation text does not match | "Type DELETE to confirm." input remains, no data deleted | User types the correct text |
| Storage usage query fails | Shows "Unknown" for storage used | Cosmetic; no user action needed |

**Validation Timing:**
- Setting changes validated and saved on toggle/selection
- Delete confirmation validated on text input match
- Storage usage queried on screen load

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens Settings,
   **When** the screen loads,
   **Then** all current settings are displayed with their current values.

2. **Given** the user toggles "North Node" on,
   **When** the confirmation dialog is accepted,
   **Then** the setting is saved, all cached charts are invalidated, and a checkmark animation confirms the change.

3. **Given** the user taps "Delete All Data" and confirms both steps,
   **When** the deletion completes,
   **Then** all MyStars data is removed, the app shows "All MyStars data has been deleted." and returns to the initial empty state.

4. **Given** the user changes "Default Explanation Depth" to Advanced,
   **When** the setting is saved,
   **Then** all explanation screens default to Advanced mode and no chart recalculation is triggered.

**Edge Cases:**

5. **Given** the user cancels the chart recalculation warning,
   **When** the dialog is dismissed,
   **Then** the setting reverts to its previous value and no charts are invalidated.

6. **Given** the user types "delete" (lowercase) in the Delete All Data confirmation,
   **When** the text is checked,
   **Then** the deletion does not proceed and the input shows "Type DELETE to confirm."

**Negative Tests:**

7. **Given** the database write fails when saving a setting,
   **When** the error occurs,
   **Then** a toast shows "Could not save setting. Please try again." and the setting reverts to its previous value.

8. **Given** the Delete All Data operation fails midway,
   **When** the error is caught,
   **Then** a toast shows "Data deletion encountered an error. Some data may remain." and the user can retry.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| saves house system setting | house_system: whole_sign | Setting saved, value = whole_sign |
| defaults to Placidus | no setting record | house_system = placidus |
| toggles optional body on | show_chiron: true | Setting saved, chart invalidation triggered |
| toggles optional body off | show_chiron: false | Setting saved, chart invalidation triggered |
| validates delete confirmation | text: "DELETE" | Validation passes |
| rejects wrong delete confirmation | text: "delete" | Validation fails |
| rejects empty delete confirmation | text: "" | Validation fails |
| display setting change does not invalidate charts | default_depth: advanced | Setting saved, no chart invalidation |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Calculation setting with cache invalidation | 1. Compute a chart, 2. Change house system, 3. Check chart cache | Cache is empty, chart requires recomputation |
| Delete All Data | 1. Create profiles, charts, entries, 2. Delete All Data, 3. Query all tables | All tables empty except default settings |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User configures optional bodies | 1. Open Settings, 2. Toggle North Node on, 3. Confirm recalculation, 4. View natal chart | North Node appears in the natal chart planet list |
| User deletes all data | 1. Open Settings, 2. Tap Delete All Data, 3. Confirm, 4. Type DELETE, 5. Confirm | All data deleted, app returns to initial empty state |

---

### ST-022: Onboarding and First-Run

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | ST-022 |
| **Feature Name** | Onboarding and First-Run |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a new user, I want a guided introduction to MyStars that helps me create my birth profile and see my first chart, so that I experience the app's core value within the first 2 minutes.

**Secondary:**
> As a user unfamiliar with astrology, I want the onboarding to explain what astrology is and what MyStars can do for me, so that I understand why I should enter my birth data.

#### 3.3 Detailed Description

The Onboarding and First-Run experience guides new users through their first interaction with MyStars. The goal is to get the user from zero to seeing their Big Three (Sun, Moon, Rising) within 2 minutes. The onboarding is a sequence of 4-5 screens that the user swipes through, with the final screen being the birth profile creation form (a streamlined version of ST-001).

The onboarding screens are: (1) Welcome - "Your stars, your privacy" with a brief value proposition and privacy commitment, (2) What is Astrology? - a 2-3 sentence plain-language explanation for newcomers, (3) What MyStars Does - 4 feature highlights with icons (Charts, Horoscopes, Compatibility, Tarot), (4) Create Your Profile - streamlined birth data form, (5) Your Big Three - instant result showing Sun/Moon/Rising signs after profile creation.

The onboarding only shows on the first launch of the MyStars module. After completion (or dismissal), it is never shown again. A "Skip" button is available on every screen except the final result screen. If the user skips, they land on the empty dashboard and can create a profile at their own pace.

The streamlined profile form in onboarding collects: name, birth date, birth time (with "I don't know" option), and location (with gazetteer search). It is simpler than the full ST-001 form (no relationship field, no notes, no coordinate entry). The profile created during onboarding is automatically set as the primary profile.

#### 3.4 Prerequisites

**Feature Dependencies:**
- ST-001: Birth Profile Management - onboarding creates a profile using the same entity and validation rules
- ST-002: Natal Chart Calculation - computes the chart immediately after profile creation
- ST-003: Sun/Moon/Rising Display - shows the Big Three as the onboarding climax

**External Dependencies:**
- Bundled onboarding illustrations (4-5 screens, approximately 500KB total)
- Bundled gazetteer for location search (same as ST-001)

**Assumed Capabilities:**
- Module is being opened for the first time (onboarding flag not set)

#### 3.5 User Interface Requirements

##### Flow: Onboarding Sequence

**Layout:**
- A full-screen page view with horizontal swipe navigation and dot indicators at the bottom
- Each page is a full-screen card with an illustration at the top (occupying approximately 40% of the screen), a title, body text, and a "Next" button at the bottom
- A "Skip" link in the top-right corner on pages 1-4
- Page 5 (result) has a "Get Started" button instead of "Next" and no "Skip" link

**Pages:**

**Page 1: Welcome**
- Illustration: night sky with constellations
- Title: "Your Stars, Your Privacy"
- Body: "MyStars gives you personalized astrology - birth charts, daily horoscopes, compatibility, and tarot - all computed on your device. No accounts. No cloud. No tracking. Your birth data never leaves your phone."
- Button: "Next"

**Page 2: What is Astrology?**
- Illustration: zodiac wheel
- Title: "Written in the Stars"
- Body: "Astrology maps the positions of the Sun, Moon, and planets at the moment of your birth. These positions - your natal chart - reveal patterns in your personality, relationships, and life themes. MyStars computes everything locally using the same precision astronomical data used by professional astrologers."
- Button: "Next"

**Page 3: What MyStars Does**
- Illustration: four feature icons in a grid
- Title: "Your Cosmic Toolkit"
- Feature highlights (icon + 1-line description):
  - "Birth Charts - See all your planetary placements"
  - "Daily Horoscope - Personalized readings based on your chart"
  - "Compatibility - Compare charts with friends and partners"
  - "Tarot - Draw a daily card for reflection"
- Button: "Next"

**Page 4: Create Your Profile**
- Streamlined form:
  - "Your Name" text input
  - "Birth Date" date picker
  - "Birth Time" time picker with "I don't know" toggle
  - "Birth Location" search field with gazetteer dropdown
- Button: "See My Stars" (disabled until name and date are filled)
- Note: "This is stored only on your device."

**Page 5: Your Big Three**
- Displays the computed Sun, Moon, and Rising signs in large text with zodiac glyphs
- A brief 1-sentence description for each
- Animated entrance of each sign (staggered, 200ms between each)
- Button: "Get Started" (navigates to the main dashboard)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Page 1-3 | Informational screens | Static content with illustrations |
| Page 4 Form Empty | No fields filled | "See My Stars" button disabled |
| Page 4 Form Valid | Name and date filled | "See My Stars" button enabled |
| Page 4 Computing | Chart being computed | Loading indicator on the button: "Computing..." |
| Page 5 Result | Chart computed successfully | Big Three displayed with animations |
| Skipped | User tapped "Skip" | Navigates directly to empty dashboard; onboarding flag set |

**Interactions:**
- Swipe left: advance to next page
- Swipe right: go back to previous page
- Tap "Next": advance to next page
- Tap "Skip": dismiss onboarding, navigate to empty dashboard
- Tap "See My Stars": save profile, compute chart, advance to page 5
- Tap "Get Started": navigate to main dashboard with the profile and chart active

**Transitions/Animations:**
- Pages transition with horizontal swipe (200ms)
- Page 5 Big Three signs stagger in with 200ms delay, sliding up and fading in
- "See My Stars" button shows a star burst animation when tapped (300ms)

#### 3.6 Data Requirements

##### Entity: OnboardingState

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, always "onboarding" (singleton) | "onboarding" | Singleton record |
| completed | boolean | - | false | Whether onboarding has been completed or skipped |
| completed_at | datetime | Nullable | null | When onboarding was completed/skipped |
| skipped | boolean | - | false | Whether the user skipped (vs. completed) |

**Relationships:**
- OnboardingState is a singleton flag
- Onboarding creates a BirthProfile (ST-001) and triggers NatalChart computation (ST-002)

**Indexes:**
- id (primary key) - singleton lookup

**Validation Rules:**
- Only one record exists
- Once completed is true, onboarding is never shown again

**Example Data:**

```
{
  "id": "onboarding",
  "completed": true,
  "completed_at": "2026-03-07T14:35:00Z",
  "skipped": false
}
```

#### 3.7 Business Logic Rules

##### Onboarding Display Logic

**Purpose:** Determines whether to show onboarding or the main dashboard.

**Inputs:**
- onboarding_state: OnboardingState

**Logic:**

```
1. IF onboarding_state.completed == true THEN
     Show the main dashboard
2. ELSE
     Show the onboarding flow starting at page 1
```

**Edge Cases:**
- OnboardingState record does not exist (first launch): create with completed = false, show onboarding
- App data cleared but module re-enabled: onboarding shows again (by design - data is gone)

##### Streamlined Profile Creation

**Purpose:** Creates a birth profile from the onboarding form with reduced fields.

**Inputs:**
- name: string
- birth_date: string
- birth_time: string or null
- location_name: string
- latitude: float
- longitude: float
- timezone: string

**Logic:**

```
1. Validate using ST-001 validation rules (name required, date required, date not future, etc.)
2. Create a BirthProfile with:
     relationship = "self"
     is_primary = true
     birth_time_known = (birth_time is not null)
     All other fields from form input
     notes = null
3. Trigger natal chart computation (ST-002)
4. Extract Big Three (ST-003 logic)
5. Set onboarding_state.completed = true, skipped = false
6. RETURN { profile, big_three }
```

**Edge Cases:**
- User enters only name and date (no time, no location): profile created with limited data; chart computed without houses; Big Three shows Sun and Moon only, Rising unknown
- Gazetteer search fails: user can skip location; chart computed without houses

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Profile creation fails (validation) | Inline validation on the form field | User corrects the field |
| Chart computation fails after profile creation | Profile is saved; Big Three shows Sun sign only with message: "Chart computation encountered an issue. You can try again from the Chart screen." | User navigates to Chart screen later |
| Gazetteer database missing | Location search shows "Location search unavailable" | User skips location or enters it later from profile edit |
| Onboarding illustrations missing | Text content displayed without illustrations | Cosmetic; no user action needed |

**Validation Timing:**
- Form fields validated on "See My Stars" tap
- Onboarding state checked on module launch (before rendering any UI)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a new user opens MyStars for the first time,
   **When** the module loads,
   **Then** the onboarding flow begins with page 1: "Your Stars, Your Privacy."

2. **Given** the user swipes through pages 1-3 and reaches page 4,
   **When** the user enters their name, birth date, birth time, and location,
   **Then** the "See My Stars" button is enabled.

3. **Given** the user taps "See My Stars" on page 4,
   **When** the profile is created and chart computed,
   **Then** page 5 shows the Big Three (Sun, Moon, Rising) with animated staggered entrance and brief descriptions.

4. **Given** the user taps "Get Started" on page 5,
   **When** the main dashboard loads,
   **Then** the dashboard shows the user's profile card with their Big Three, and the onboarding never shows again.

**Edge Cases:**

5. **Given** the user taps "Skip" on page 2,
   **When** the onboarding is dismissed,
   **Then** the user lands on the empty dashboard with a "Create Your Profile" card, and onboarding is marked as completed (skipped).

6. **Given** the user enters only their name and birth date (no time, no location),
   **When** "See My Stars" is tapped,
   **Then** page 5 shows Sun and Moon signs; Rising shows "Unknown - add your birth time to discover your Rising sign."

**Negative Tests:**

7. **Given** the user taps "See My Stars" without entering a name,
   **When** validation runs,
   **Then** an inline error appears: "Enter your name" and the profile is not created.

8. **Given** the chart computation fails,
   **When** the error occurs,
   **Then** the profile is still saved, page 5 shows the Sun sign only with a message: "Chart computation encountered an issue. You can try again from the Chart screen."
   **And** onboarding still completes (user is not stuck).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| shows onboarding when not completed | completed: false | Onboarding flow displayed |
| shows dashboard when completed | completed: true | Dashboard displayed |
| creates profile with minimal data | name: "Alex", birth_date: "1995-03-21" | Profile created with is_primary = true, relationship = self |
| creates profile with full data | name, date, time, location | Profile with all fields populated |
| marks onboarding completed on finish | user taps "Get Started" | completed = true, skipped = false |
| marks onboarding skipped on skip | user taps "Skip" | completed = true, skipped = true |
| validates name required | name: "" | Validation error |
| validates date required | birth_date: null | Validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full onboarding flow | 1. Open module (first time), 2. Swipe through pages, 3. Enter data, 4. Tap "See My Stars", 5. View Big Three, 6. Tap "Get Started" | Profile created, chart computed, Big Three displayed, dashboard shows profile |
| Skip onboarding | 1. Open module, 2. Tap "Skip" on page 1 | Dashboard shows empty state, onboarding never re-appears |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user completes onboarding | 1. Open MyStars, 2. Read welcome screens, 3. Enter birth data, 4. See Big Three, 5. Get Started | Full profile and chart active, Big Three visible on dashboard, onboarding dismissed permanently |
| New user skips onboarding | 1. Open MyStars, 2. Skip immediately | Empty dashboard with "Create Your Profile" prompt; onboarding will not show again |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **BirthProfile** entity, which stores the user's (or another person's) birth information. Each BirthProfile can have one computed **NatalChart**, which contains the astronomical snapshot of the sky at the moment of birth. The NatalChart has many **PlanetPosition** entries (10 core planets plus up to 3 optional bodies) and exactly 12 **HouseCusp** entries. The NatalChart also has many computed **Aspect** entries representing the angular relationships between planets.

Profiles can be compared pairwise through **CompatibilityResult** entries (many-to-many relationship between profiles). Each profile can have many **DailyHoroscope** entries (one per day, up to 97 cached). Profiles also connect to **TransitEvent** entries showing how current planets interact with the natal chart.

Independent of profiles, the **TarotDraw** entity records daily card draws (seeded by profile or device), and **JournalEntry** records free-text reflections with auto-captured astrological context.

Chart-derived analyses include **PersonalityAnalysis** (one per NatalChart), **SolarReturnChart** (one per year per profile), and **ProgressedChart** (one per profile).

Cached astronomical data includes **MoonCalendarDay** (computed moon data per day), **ZodiacEvent** (astrological events), and **CelestialEvent** (astronomical events). **RetrogradeStatus** and **CurrentPlanetPosition** are transient (in-memory only).

Static bundled data includes **SignDescription**, **SunMoonCombination**, **ExplanationContent**, **PlacementExplanation**, and **TarotCard** - these are read-only and ship with the application.

The singleton **UserSettings** record stores preferences, and **OnboardingState** tracks first-run completion.

### 4.2 Complete Entity Definitions

#### Entity: BirthProfile (`st_birth_profiles`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| name | string | Required, max 100 chars | None | Display name |
| relationship | enum | self, partner, friend, family, celebrity, other | other | Relationship tag |
| is_primary | boolean | Max one true across all profiles | false | User's own profile flag |
| birth_date | string | Required, ISO 8601 date, 1900-01-01 to today | None | Date of birth |
| birth_time | string | ISO 8601 time HH:MM, nullable | null | Time of birth |
| birth_time_known | boolean | - | true | Whether birth time is confirmed |
| location_name | string | Max 200 chars | null | Display name of birth location |
| latitude | float | -90.0 to 90.0 | null | Birth location latitude |
| longitude | float | -180.0 to 180.0 | null | Birth location longitude |
| timezone | string | IANA identifier, max 50 chars | null | Timezone at birth |
| notes | string | Max 500 chars | null | Optional notes |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modified |

#### Entity: NatalChart (`st_natal_charts`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| profile_id | string | FK to BirthProfile.id, unique | None | Associated profile |
| computed_at | datetime | Auto-set | Current timestamp | Computation time |
| julian_day | float | Positive | None | Julian Day Number |
| sidereal_time | float | 0.0 to 24.0 | None | Local Sidereal Time |
| house_system | enum | placidus, whole_sign, koch, equal | placidus | House system used |
| ascendant_longitude | float | 0.0 to 359.999 | None | Ascendant ecliptic longitude |
| midheaven_longitude | float | 0.0 to 359.999 | None | Midheaven longitude |
| descendant_longitude | float | 0.0 to 359.999 | None | Descendant longitude |
| ic_longitude | float | 0.0 to 359.999 | None | Imum Coeli longitude |
| obliquity | float | ~23.44 | None | Ecliptic obliquity |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modified |

#### Entity: PlanetPosition (`st_planet_positions`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| chart_id | string | FK to NatalChart.id | None | Parent chart |
| body | enum | sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto, chiron, north_node, lilith | None | Celestial body |
| longitude | float | 0.0 to 359.999 | None | Ecliptic longitude |
| latitude | float | -90.0 to 90.0 | None | Ecliptic latitude |
| speed | float | Any | None | Daily motion (deg/day) |
| is_retrograde | boolean | Derived from speed < 0 | false | Retrograde flag |
| zodiac_sign | enum | 12 zodiac signs | None | Derived from longitude |
| sign_degree | integer | 0 to 29 | None | Degree in sign |
| sign_minute | integer | 0 to 59 | None | Minute of arc |
| house_number | integer | 1 to 12, nullable | None | House placement |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

#### Entity: HouseCusp (`st_house_cusps`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| chart_id | string | FK to NatalChart.id | None | Parent chart |
| house_number | integer | 1 to 12 | None | House number |
| cusp_longitude | float | 0.0 to 359.999 | None | Cusp ecliptic longitude |
| zodiac_sign | enum | 12 zodiac signs | None | Sign at the cusp |
| sign_degree | integer | 0 to 29 | None | Degree in sign |
| sign_minute | integer | 0 to 59 | None | Minute of arc |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

#### Entity: Aspect (`st_aspects`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| chart_id | string | FK to NatalChart.id | None | Parent chart |
| body_a | enum | Planet enum (lower index) | None | First planet |
| body_b | enum | Planet enum (higher index) | None | Second planet |
| aspect_type | enum | conjunction, sextile, square, trine, opposition | None | Aspect type |
| exact_angle | float | 0, 60, 90, 120, 180 | None | Exact angle |
| actual_angle | float | 0.0 to 180.0 | None | Actual separation |
| orb | float | 0.0 to max_orb | None | Deviation from exact |
| nature | enum | harmonious, challenging, combined | None | Classification |
| is_applying | boolean | - | None | Approaching exact |
| interpretation_brief | string | Max 200 chars | None | 1-sentence summary |
| interpretation_full | string | Max 2000 chars | None | Detailed interpretation |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

#### Entity: CompatibilityResult (`st_compatibility_results`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| profile_a_id | string | FK to BirthProfile.id (lexicographically smaller) | None | First profile |
| profile_b_id | string | FK to BirthProfile.id | None | Second profile |
| analysis_type | enum | quick_match, full_synastry | quick_match | Analysis type |
| overall_score | integer | 0 to 100 | None | Overall percentage |
| emotional_score | integer | 0 to 100, nullable | null | Emotional dimension |
| communication_score | integer | 0 to 100, nullable | null | Communication dimension |
| attraction_score | integer | 0 to 100, nullable | null | Attraction dimension |
| growth_score | integer | 0 to 100, nullable | null | Growth dimension |
| challenge_aspects | string | JSON, max 3000 chars | null | Challenging aspects |
| top_aspects | string | JSON, max 5000 chars | None | Top 5 aspects |
| element_compatibility | string | Max 200 chars | None | Element pair description |
| sun_sign_description | string | Max 2000 chars | None | Sun sign narrative |
| computed_at | datetime | Auto-set | Current timestamp | Computation time |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modified |

#### Entity: DailyHoroscope (`st_daily_horoscopes`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| profile_id | string | FK to BirthProfile.id | None | Associated profile |
| date | string | ISO 8601 date, unique per profile | None | Horoscope date |
| star_rating | integer | 1 to 5 | None | Day rating |
| theme | string | Max 300 chars | None | Overall theme |
| focus_transit | string | Max 200 chars | None | Focus transit name |
| focus_description | string | Max 500 chars | None | Focus transit detail |
| reading_love | string | Max 1000 chars | None | Love section |
| reading_career | string | Max 1000 chars | None | Career section |
| reading_growth | string | Max 1000 chars | None | Growth section |
| reading_energy | string | Max 1000 chars | None | Energy section |
| transit_data | string | JSON, max 5000 chars | None | All transits |
| generated_at | datetime | Auto-set | Current timestamp | Generation time |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

#### Entity: TarotDraw (`st_tarot_draws`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| date | string | ISO 8601 date | None | Draw date |
| profile_id | string | FK to BirthProfile.id, nullable | null | Seed profile |
| device_seed | string | UUID, max 36 chars | None | Device seed |
| card_number | integer | 0 to 77 | None | Card index |
| card_name | string | Max 100 chars | None | Card name |
| is_reversed | boolean | - | None | Reversed orientation |
| is_redraw | boolean | - | false | Replaced a previous draw |
| original_card_number | integer | 0 to 77, nullable | null | Original card if redrawn |
| created_at | datetime | Auto-set | Current timestamp | Creation time |

#### Entity: JournalEntry (`st_journal_entries`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| profile_id | string | FK to BirthProfile.id, nullable | null | Associated profile |
| date | string | ISO 8601 date | None | Entry date |
| content | string | Required, max 5000 chars | None | Free-text content |
| mood | enum | inspired, calm, anxious, frustrated, joyful, contemplative, energized, drained; nullable | null | Mood tag |
| moon_phase | enum | 8 phase names | None | Moon phase at entry |
| moon_sign | enum | 12 zodiac signs | None | Moon sign at entry |
| sun_sign | enum | 12 zodiac signs | None | Sun sign at entry |
| retrograde_planets | string | JSON array, nullable | null | Retrograde planets |
| active_transits | string | JSON, max 3000 chars, nullable | null | Active transits |
| tarot_card_number | integer | 0 to 77, nullable | null | Today's tarot card |
| tarot_is_reversed | boolean | Nullable | null | Tarot orientation |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modified |

#### Entity: TransitEvent (`st_transit_events`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto | Unique identifier |
| profile_id | string | FK to BirthProfile.id | None | Transited profile |
| transiting_body | enum | Planet enum | None | Moving planet |
| natal_body | enum | Planet enum + ascendant, midheaven | None | Natal placement |
| aspect_type | enum | 5 aspect types | None | Aspect formed |
| significance | enum | major, minor | None | Transit significance |
| current_orb | float | 0.0 to max_orb | None | Current orb |
| exact_date | string | ISO 8601 date | None | Exact aspect date |
| entering_orb_date | string | ISO 8601 date, nullable | null | Entered orb |
| leaving_orb_date | string | ISO 8601 date, nullable | null | Leaves orb |
| is_applying | boolean | - | None | Approaching exact |
| interpretation_brief | string | Max 300 chars | None | Brief interpretation |
| interpretation_full | string | Max 3000 chars | None | Full interpretation |
| computed_at | datetime | Auto-set | Current timestamp | Computation time |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modified |

#### Entity: UserSettings (`st_user_settings`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, always "settings" | "settings" | Singleton |
| house_system | enum | placidus, whole_sign, koch, equal | placidus | House system |
| show_chiron | boolean | - | false | Include Chiron |
| show_north_node | boolean | - | false | Include North Node |
| show_lilith | boolean | - | false | Include Lilith |
| default_depth | enum | beginner, advanced | beginner | Explanation depth |
| default_chart_view | enum | traditional, modern | traditional | Chart view mode |
| show_moon_in_dashboard | boolean | - | true | Dashboard moon phase |
| created_at | datetime | Auto-set | Current timestamp | Creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modified |

#### Entity: OnboardingState (`st_onboarding`)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, always "onboarding" | "onboarding" | Singleton |
| completed | boolean | - | false | Onboarding done |
| completed_at | datetime | Nullable | null | Completion time |
| skipped | boolean | - | false | Whether skipped |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| BirthProfile -> NatalChart | one-to-one | Each profile has at most one cached natal chart |
| NatalChart -> PlanetPosition | one-to-many | A chart has 10-13 planet positions |
| NatalChart -> HouseCusp | one-to-many | A chart has exactly 12 house cusps |
| NatalChart -> Aspect | one-to-many | A chart has 0 to approximately 45 aspects |
| NatalChart -> PersonalityAnalysis | one-to-one | One personality analysis per chart |
| BirthProfile -> CompatibilityResult | many-to-many | Profiles are compared pairwise |
| BirthProfile -> DailyHoroscope | one-to-many | Up to 97 horoscopes per profile |
| BirthProfile -> TransitEvent | one-to-many | Multiple active transits per profile |
| BirthProfile -> SolarReturnChart | one-to-many | One per year per profile |
| BirthProfile -> ProgressedChart | one-to-one | One progressed chart per profile |
| BirthProfile -> JournalEntry | one-to-many | Up to 1,000 entries per profile |
| TarotDraw -> TarotCard | many-to-one | Each draw references one card |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| BirthProfile | idx_profile_primary | is_primary | Fast primary profile lookup |
| BirthProfile | idx_profile_relationship | relationship | Filter by relationship |
| BirthProfile | idx_profile_name | name | Alphabetical sorting |
| NatalChart | idx_chart_profile | profile_id (unique) | One chart per profile lookup |
| PlanetPosition | idx_position_chart | chart_id | Retrieve all positions for chart |
| PlanetPosition | idx_position_chart_body | (chart_id, body) unique | Prevent duplicates |
| HouseCusp | idx_cusp_chart | chart_id | Retrieve all cusps for chart |
| HouseCusp | idx_cusp_chart_house | (chart_id, house_number) unique | Prevent duplicates |
| Aspect | idx_aspect_chart | chart_id | Retrieve all aspects for chart |
| Aspect | idx_aspect_chart_pair | (chart_id, body_a, body_b) unique | Prevent duplicate pairs |
| CompatibilityResult | idx_compat_pair | (profile_a_id, profile_b_id) | Pair lookup |
| DailyHoroscope | idx_horoscope_profile_date | (profile_id, date) unique | Lookup by profile and date |
| DailyHoroscope | idx_horoscope_date | date | Date-based cleanup |
| TransitEvent | idx_transit_profile_date | (profile_id, exact_date) | Transit lookup by date |
| TarotDraw | idx_tarot_date | date | Daily draw lookup |
| JournalEntry | idx_journal_date | date | Chronological listing |
| JournalEntry | idx_journal_profile | profile_id | Profile-scoped queries |
| JournalEntry | idx_journal_content_fts | content (FTS5) | Full-text search |

### 4.5 Table Prefix

**MyLife hub table prefix:** `st_`

All table names in the SQLite database are prefixed with `st_` to avoid collisions with other modules in the MyLife hub. Example: `birth_profiles` becomes `st_birth_profiles`, `natal_charts` becomes `st_natal_charts`.

### 4.6 Migration Strategy

- Tables are created on module enable. Schema version is tracked in the MyLife hub's `hub_module_migrations` table.
- The module starts at schema version 1 with all entities defined in Section 4.2.
- Cache tables (MoonCalendarDay, ZodiacEvent, CelestialEvent) are populated lazily on first access.
- Bundled static data (SignDescription, SunMoonCombination, ExplanationContent, PlacementExplanation, TarotCard) is loaded from bundled JSON/binary files, not from SQLite tables.
- If a standalone MyStars app is created in the future, data can be imported via the standard MyLife data importer (`@mylife/migration` package).
- Destructive migrations (column removal) are deferred to major versions only.
- Data export (ST-020) provides the user-facing data portability mechanism.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Home | Star | Dashboard | Hub card with Big Three, daily horoscope preview, moon phase widget, today's card |
| Chart | Circle | Natal Chart Summary | Natal chart data, planet positions, houses, angles |
| Daily | Sun | Daily Horoscope | Today's personalized horoscope with star rating and transits |
| Sky | Telescope | Current Planets | Live planet positions, moon phase, and retrograde status |
| Profile | Person | Profile List | Manage birth profiles, access settings |

### 5.2 Navigation Flow

```
[Tab 1: Home / Dashboard]
  ├── Daily Horoscope (ST-005)
  │     └── Past/Future Day Navigation
  ├── Card of the Day (ST-015)
  │     └── Draw History
  ├── Moon Phase Widget -> Moon Calendar (ST-009)
  │     └── Day Detail Card
  └── Retrograde Status -> Retrograde Dashboard (ST-014)

[Tab 2: Chart]
  ├── Natal Chart Summary (ST-002)
  │     ├── Big Three Detail (ST-003)
  │     ├── Chart Wheel (ST-006)
  │     ├── Aspect Grid/List (ST-010)
  │     └── Birth Chart Explanations (ST-012)
  ├── Personality Insights (ST-011)
  ├── Solar Return (ST-018)
  ├── Progressions (ST-019)
  └── Compatibility (ST-007)
        ├── Profile Selection
        └── Compatibility Results

[Tab 3: Daily]
  ├── Daily Horoscope (ST-005)
  │     └── Day Navigation (-90 to +7 days)
  └── Save to Journal -> Journal (ST-017)

[Tab 4: Sky]
  ├── Current Planets (ST-004)
  │     ├── Custom Date Picker
  │     └── Transit Timeline (ST-008)
  │           └── Transit Calendar
  ├── Moon Calendar (ST-009)
  ├── Zodiac Events (ST-013)
  ├── Celestial Events (ST-016)
  └── Retrograde Dashboard (ST-014)

[Tab 5: Profile]
  ├── Profile List (ST-001)
  │     ├── Add/Edit Profile
  │     └── Profile Detail
  ├── Astrology Journal (ST-017)
  │     ├── Compose Entry
  │     └── Patterns View
  ├── Learn Astrology (ST-012)
  ├── Export Data (ST-020)
  └── Settings (ST-021)
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Onboarding | `/onboarding` | First-run experience | Module first launch |
| Dashboard | `/` (home) | Hub card with daily summary | Tab 1, module entry |
| Profile List | `/profiles` | Manage birth profiles | Tab 5 |
| Add/Edit Profile | `/profiles/new`, `/profiles/:id/edit` | Create or edit a profile | Profile List, Onboarding |
| Natal Chart Summary | `/chart` | Planet positions, houses, angles | Tab 2, Dashboard |
| Big Three Detail | `/chart/big-three` | Sun/Moon/Rising display | Chart Summary, Dashboard |
| Chart Wheel | `/chart/wheel` | Visual chart rendering | Chart Summary |
| Aspect Grid | `/chart/aspects` | Aspect grid and list | Chart Summary, Chart Wheel |
| Personality Profile | `/chart/personality` | Element/quality balance, themes | Tab 2 |
| Solar Return | `/chart/solar-return` | Birthday year chart | Tab 2 |
| Progressions | `/chart/progressions` | Progressed Moon/Sun | Tab 2 |
| Compatibility Selection | `/compatibility` | Choose two profiles | Tab 2 |
| Compatibility Results | `/compatibility/results` | Synastry analysis | Compatibility Selection |
| Daily Horoscope | `/daily` | Today's reading | Tab 3, Dashboard |
| Current Planets | `/sky/planets` | Live positions | Tab 4 |
| Transit Timeline | `/sky/transits` | Active/upcoming transits | Tab 4, Current Planets |
| Moon Calendar | `/sky/moon` | Monthly moon phases | Tab 4, Dashboard |
| Zodiac Events | `/sky/zodiac-events` | Astrological event timeline | Tab 4 |
| Celestial Events | `/sky/celestial-events` | Observable sky events | Tab 4 |
| Retrograde Dashboard | `/sky/retrogrades` | Retrograde status | Tab 4, Dashboard |
| Card of the Day | `/tarot` | Daily tarot draw | Dashboard |
| Draw History | `/tarot/history` | Past draws | Card of the Day |
| Astrology Journal | `/journal` | Journal entries and patterns | Tab 5, Daily Horoscope |
| Compose Entry | `/journal/new` | Write a journal entry | Journal List |
| Learn Astrology | `/learn` | Educational content | Tab 5, Chart Summary |
| Export Data | `/settings/export` | Data export | Settings |
| Settings | `/settings` | Preferences | Tab 5 |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://stars` | Dashboard | None |
| `mylife://stars/chart` | Natal Chart Summary | None (uses primary profile) |
| `mylife://stars/daily` | Daily Horoscope | None (today's date) |
| `mylife://stars/tarot` | Card of the Day | None |
| `mylife://stars/profile/:id` | Profile Detail | id: UUID of the profile |
| `mylife://stars/compatibility` | Compatibility Selection | None |
| `mylife://stars/moon` | Moon Calendar | None (current month) |
| `mylife://stars/journal` | Astrology Journal | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Mood-Transit Correlation | Stars | Mood | Stars provides active transit data for correlation analysis | When mood module is enabled and journal entries exist with mood tags |
| Lunar Journal Prompts | Stars | Journal | Stars provides moon phase and sign data for journal prompts | Daily, when journal module is enabled |
| Habit Lunar Alignment | Stars | Habits | Stars provides New Moon dates for "new habit" suggestions | When habits module is enabled |
| Cycle-Lunar Overlay | Stars | Health | Stars provides moon phase calendar data for cycle tracking overlay | When health module is enabled and cycle tracking is active |
| Dashboard Moon Widget | Stars | Hub | Stars provides current moon phase for the hub dashboard card | On module enable, updated daily |

**Integration rules:**
- All integrations are optional and gracefully degrade if the target module is not enabled.
- Stars never writes data to other modules' tables. It provides read-only data via shared functions.
- Other modules access Stars data through the `@mylife/module-registry` shared function interface, never by direct database queries across module table prefixes.

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Birth profiles | Local SQLite (`st_birth_profiles`) | At rest (OS-level) | No | Birth date, time, and location are sensitive PII |
| Natal chart data | Local SQLite (`st_natal_charts`, `st_planet_positions`, etc.) | At rest (OS-level) | No | Derived from birth data; never leaves device |
| Compatibility results | Local SQLite (`st_compatibility_results`) | At rest (OS-level) | No | Relationship data between profiles |
| Daily horoscopes | Local SQLite (`st_daily_horoscopes`) | At rest (OS-level) | No | Cached readings |
| Tarot draws | Local SQLite (`st_tarot_draws`) | At rest (OS-level) | No | Draw history |
| Journal entries | Local SQLite (`st_journal_entries`) | At rest (OS-level) | No | Personal reflections |
| User settings | Local SQLite (`st_user_settings`) | At rest (OS-level) | No | Preferences |
| Swiss Ephemeris data | App bundle (read-only binary) | No | No | Astronomical reference data, not personal |
| Interpretation text | App bundle (read-only) | No | No | Static content, not personal |
| Tarot card images | App bundle (read-only) | No | No | Card artwork, not personal |
| Gazetteer database | App bundle (read-only) | No | No | City lookup data, not personal |

### 7.2 Network Activity

This module operates entirely offline. No network requests are made under any circumstances.

- No API calls to astrology services
- No analytics or telemetry
- No push notification servers
- No cloud storage or sync
- No ad networks or tracking pixels
- No crash reporting that transmits user data
- Swiss Ephemeris calculations run entirely on-device
- All interpretation text is bundled, not fetched

### 7.3 Data That Never Leaves the Device

- Birth date, time, and location (sensitive PII)
- Natal chart calculations and planet positions
- Compatibility analyses and relationship data
- Journal entries and personal reflections
- Mood tags and mood patterns
- Tarot draw history
- Horoscope readings
- User preferences and settings
- Any data linking profiles to each other

### 7.4 User Data Ownership

- **Export:** Users can export all their data in JSON or CSV format (ST-020)
- **Delete:** Users can delete all module data from Settings (ST-021) with two-step confirmation
- **Portability:** Export format is documented, human-readable, and includes a schema version for future import compatibility
- **Transparency:** No hidden data stores exist beyond the entities documented in Section 4

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Birth data sensitivity | Birth date + time + location constitutes sensitive PII capable of identity verification | All birth data stored locally only, never transmitted |
| Delete confirmation | Two-step confirmation for data deletion (dialog + type "DELETE") | Prevents accidental data loss |
| Profile limit | Maximum 51 profiles | Prevents unbounded data growth |
| Journal limit | Maximum 1,000 entries with warning at 900 | Prevents unbounded data growth |
| Export privacy | Export files are saved locally; user controls sharing | No server-side processing of exports |
| Competitive advantage | Unlike Co-Star and The Pattern, no cloud accounts, no birth data harvesting, no relationship graph collection, no push notification manipulation | Core differentiator |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Ascendant (Rising Sign) | The zodiac sign rising on the eastern horizon at the exact time and place of birth. Represents outward personality and first impressions. Requires birth time to compute. |
| Aspect | A specific angular relationship between two planets in a chart. The five major aspects are conjunction (0 degrees), sextile (60 degrees), square (90 degrees), trine (120 degrees), and opposition (180 degrees). |
| Big Three | The three most personally significant placements in a natal chart: Sun sign, Moon sign, and Rising (Ascendant) sign. |
| Cardinal | One of the three astrological qualities. Cardinal signs (Aries, Cancer, Libra, Capricorn) are initiators and leaders. |
| Conjunction | An aspect where two planets are at the same degree (0 degrees apart, orb up to 8 degrees). Represents combined or intensified energy. |
| Cusp | The boundary between two houses or two zodiac signs. A house cusp is the degree at which a house begins. |
| Ecliptic | The apparent path of the Sun across the sky over the course of a year, used as the reference plane for planetary positions. |
| Element | One of four categories that the 12 zodiac signs are divided into: Fire (Aries, Leo, Sagittarius), Earth (Taurus, Virgo, Capricorn), Air (Gemini, Libra, Aquarius), Water (Cancer, Scorpio, Pisces). |
| Ephemeris | A table or data set of precomputed positions of celestial bodies at regular intervals. Swiss Ephemeris is the open-source astronomical library used for these computations. |
| Fixed | One of the three astrological qualities. Fixed signs (Taurus, Leo, Scorpio, Aquarius) are sustainers and stabilizers. |
| House | One of 12 divisions of the sky in a natal chart, each governing a different life area (e.g., 1st house = self, 7th house = partnerships, 10th house = career). |
| House System | The mathematical method used to divide the sky into 12 houses. Placidus is the most common. Others include Whole Sign, Koch, and Equal. |
| Imum Coeli (IC) | The lowest point of the chart, opposite the Midheaven. Associated with home, family, and roots. Located at the cusp of the 4th house. |
| Ingress | The moment a planet crosses from one zodiac sign into the next. |
| Julian Day Number | A continuous count of days since January 1, 4713 BCE (Julian calendar). Used in astronomical calculations because it avoids calendar reform complications. |
| Longitude (Ecliptic) | A planet's position measured in degrees (0-360) along the ecliptic, starting from 0 degrees Aries. |
| Major Arcana | The 22 trump cards of the tarot deck (The Fool through The World), representing major life themes and spiritual lessons. |
| Midheaven (MC) | The highest point of the chart. Associated with career, public image, and aspirations. Located at the cusp of the 10th house. |
| Minor Arcana | The 56 suited cards of the tarot deck, divided into four suits of 14 cards each (Wands, Cups, Swords, Pentacles). |
| Mutable | One of the three astrological qualities. Mutable signs (Gemini, Virgo, Sagittarius, Pisces) are adapters and communicators. |
| Natal Chart | A map of the sky at the exact moment and place of a person's birth, showing the positions of all planets, houses, and angles. Also called a birth chart. |
| Opposition | An aspect where two planets are 180 degrees apart (orb up to 8 degrees). Represents tension, polarity, and awareness. |
| Orb | The allowable deviation from an exact aspect angle. A tighter orb means a stronger aspect. |
| Placidus | The most commonly used house system in Western astrology. Divides the sky based on time rather than space. |
| Progressed Chart | A symbolic chart where each day after birth represents one year of life. Used to track long-term developmental themes. |
| Quality (Modality) | One of three categories describing how a sign operates: Cardinal (initiating), Fixed (sustaining), or Mutable (adapting). |
| Retrograde | The apparent backward motion of a planet as seen from Earth. In astrology, retrograde periods are associated with review, revision, and re-examination of the planet's themes. |
| Sextile | An aspect where two planets are 60 degrees apart (orb up to 6 degrees). Represents opportunity and harmony. |
| Sidereal Time | Time measured by the rotation of the Earth relative to the stars (not the Sun). Used in house calculations. |
| Solar Return | The moment each year when the transiting Sun returns to its exact natal position. The chart for this moment reveals themes for the coming year. |
| Square | An aspect where two planets are 90 degrees apart (orb up to 7 degrees). Represents tension, challenge, and growth through friction. |
| Station | The moment a planet appears to stop before changing direction (retrograde to direct, or direct to retrograde). |
| Synastry | The astrological technique of comparing two natal charts to analyze relationship compatibility and dynamics. |
| Synodic Period | The time between two identical phases of the Moon (e.g., New Moon to New Moon), approximately 29.53059 days. |
| Transit | The current position of a planet relative to the natal chart. Transits describe how current planetary movements affect an individual. |
| Trine | An aspect where two planets are 120 degrees apart (orb up to 8 degrees). Represents flow, ease, and natural talent. |
| Tropical Zodiac | The zodiac system used in Western astrology, aligned to the seasons (0 degrees Aries = Spring Equinox). Distinguished from the Sidereal Zodiac used in Vedic astrology. |
| Void-of-Course | A period when the Moon makes no more major aspects before changing signs. Traditionally considered unfavorable for starting new ventures. |
| Whole-Sign Houses | A house system where each house occupies exactly one zodiac sign (30 degrees). Used as a fallback when birth time is unknown. |
| Zodiac | The 12 equal 30-degree divisions of the ecliptic, named after constellations: Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (spec-mystars agent) | Initial specification: Sections 1-2 complete, features ST-001 through ST-003 |
| 1.1 | 2026-03-07 | Claude (Opus 4.6) | Complete specification: features ST-004 through ST-022, Sections 4-8 |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should Swiss Ephemeris data be bundled as a single 50MB file or split into decade-range files for on-demand loading? | Affects app bundle size and initial download time | Pending | - |
| 2 | Should the tarot card illustrations be original artwork or licensed from an existing deck? | Copyright and cost implications; Rider-Waite-Smith is public domain in most jurisdictions | Pending | - |
| 3 | Should the app support the Sidereal (Vedic) zodiac as an option in addition to Tropical? | Would require a second set of interpretation texts but would expand the user base | Pending | - |
| 4 | What is the maximum acceptable ephemeris computation time on low-end devices? | Affects whether computations should run on a background thread with progress indication | 500ms target, 2s maximum | - |
| 5 | Should the gazetteer be sourced from GeoNames (open data) or a curated subset? | GeoNames has 11M+ entries; a curated subset of top 50,000 cities by population is approximately 5MB | Pending | - |
