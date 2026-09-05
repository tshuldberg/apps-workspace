# MyBaby - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyBaby
- **Tagline:** "Track every precious moment"
- **Module ID:** `baby`
- **Feature ID Prefix:** `BB`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| New Parent | Ages 25-40, first-time parent, sleep-deprived, high anxiety about doing things "right". Moderate tech comfort. Constantly Googling feeding amounts and sleep schedules. | Log feedings, diapers, and sleep quickly with one hand. See daily patterns. Know if baby is on track developmentally. |
| Experienced Parent (Multi-Child) | Ages 28-42, second or third child. Knows the basics but needs organized tracking across multiple children. Wants to compare milestones between siblings. | Manage profiles for 2-3 children, quickly switch between them, compare growth curves and milestone timelines. |
| Breastfeeding Mother | Ages 22-40, exclusively or partially breastfeeding. Needs to track which side, duration, and pumping output. May be building a freezer stash. | Time breastfeeding sessions with side tracking, log pump output and milk storage, see daily totals for supply confidence. |
| Co-Parent / Partner | Ages 25-45, shares caregiving duties. Needs to see what the other parent logged during their shift. May be less detail-oriented but wants to stay informed. | View the day's activity log at a glance, add entries during their shift, know when the last feeding or diaper change was. |
| Caregiver / Nanny | Ages 20-60, provides professional childcare. Needs to log activities during their shift and hand off a summary to parents. | Quick logging interface, shift summary generation, no access to medical records or growth data unless granted. |
| Anxious First-Timer | Ages 22-35, worries about everything (is baby eating enough? sleeping enough? growing properly?). Checks percentile charts frequently. | Clear growth percentile display, milestone checklists with age-appropriate expectations, reassuring context for normal variation. |

### 1.3 Core Value Proposition

MyBaby is a comprehensive, privacy-first baby tracking app that replaces Huckleberry ($96-180/yr) and BabyCenter (free but ad-supported with extensive data collection) with a single module in the MyLife suite. It covers the full spectrum of infant and toddler care: feeding logs (breast, bottle, and solids), sleep tracking with nap prediction, diaper logs, WHO growth charts with Box-Cox percentile calculations, CDC milestone checklists, vaccination schedules, pumping timers, medicine tracking, teething logs, first experiences journaling, and a daily summary dashboard. All data stays entirely on-device. No advertiser knows your baby's feeding schedule. No pharmaceutical company sees your child's growth measurements. No third party accesses developmental milestones.

Baby and parenting data is among the most sensitive personal information that exists: a child's health records, developmental progress, daily patterns, and caregiver routines. Yet every major baby tracking app either charges a premium subscription for cloud-locked features (Huckleberry) or harvests this data for targeted advertising (BabyCenter, where advertisers can target parents based on their baby's age, feeding habits, and developmental stage). MyBaby provides the same feature set with zero data exploitation, zero ads, and zero cloud requirements.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Huckleberry ($96-180/yr) | Excellent sleep analysis ("SweetSpot" nap predictor), polished timer UI, comprehensive logging | Cloud-required, expensive premium tier locks sleep analysis behind paywall, data stored on company servers | Same logging and nap prediction at a fraction of the cost, all data on-device, no cloud dependency |
| BabyCenter (Free, ad-supported) | Comprehensive content library, week-by-week development info, large community, free | Heavily ad-supported, collects extensive baby and parent data for targeted advertising, cluttered UI with ads | Zero ads, zero data collection, clean UI focused on tracking rather than content marketing |
| Baby Tracker (Nighp, $5/yr) | Low cost, basic logging, widget support | Limited analytics, no growth charts, minimal milestone tracking | Full growth charts with WHO percentiles, comprehensive milestones, deeper analytics |
| Sprout Baby ($5 one-time) | One-time purchase, nice growth charts, medical records | iOS-only, no longer actively updated, no nap prediction | Cross-platform, actively maintained, nap prediction, modern UI |
| Glow Baby (Free + $48/yr premium) | AI insights, pumping tracker, community features | Freemium model, data collection for AI training, community content moderation issues | No AI data harvesting, equivalent features without the data trade-off |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export

**MyBaby-specific privacy notes:**

- **Feeding logs, sleep data, and diaper records** never leave the device. No advertiser can target you based on whether you breastfeed or formula feed.
- **Growth measurements** stay local. No insurance company or data broker can access your child's height, weight, or head circumference data.
- **Developmental milestone data** remains private. No third party knows whether your child has reached specific milestones or has developmental concerns.
- **Vaccination records** are stored on-device only. No pharmaceutical company or government database receives your child's immunization history through this app.
- **Photos and journal entries** (first experiences, milestone photos) are stored locally. They are never uploaded, analyzed, or used to train AI models.
- **Caregiver sharing** uses local sync (QR code or local network transfer). No cloud intermediary stores or relays baby data between devices.
- **Medicine tracking** for infant medications stores dosing data locally. No pharmacy or health plan receives this information.
- **Growth chart calculations** use locally bundled WHO LMS reference data. No network request is made to compute percentiles.
- **Pediatrician visit notes** are yours alone. They are never transmitted to or from any electronic health records system.

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| BB-001 | Child Profile Management | P0 | Core | None | Not Started |
| BB-002 | Feeding Log (Breast/Bottle/Solid) | P0 | Core | BB-001 | Not Started |
| BB-003 | Sleep Tracking | P0 | Core | BB-001 | Not Started |
| BB-004 | Diaper Log | P0 | Core | BB-001 | Not Started |
| BB-005 | Growth Charts (WHO Percentiles) | P0 | Analytics | BB-001 | Not Started |
| BB-006 | Daily Summary Dashboard | P0 | Core | BB-001, BB-002, BB-003, BB-004 | Not Started |
| BB-007 | Milestone Tracking (CDC Schedule) | P1 | Core | BB-001 | Not Started |
| BB-008 | Vaccination Schedule (CDC) | P1 | Core | BB-001 | Not Started |
| BB-009 | Pumping Log and Timer | P1 | Core | BB-001 | Not Started |
| BB-010 | Feeding Timer (Breast/Bottle) | P1 | Core | BB-002 | Not Started |
| BB-011 | Nap Predictor (Wake Windows) | P1 | Analytics | BB-003 | Not Started |
| BB-012 | Caregiver Sharing | P1 | Social | BB-001 | Not Started |
| BB-013 | Medicine Tracking | P1 | Core | BB-001 | Not Started |
| BB-014 | Teething Log | P2 | Core | BB-001 | Not Started |
| BB-015 | First Experiences Journal | P2 | Core | BB-001 | Not Started |
| BB-016 | Multi-Child Support | P1 | Core | BB-001 | Not Started |
| BB-017 | Pediatrician Visit Log | P1 | Core | BB-001 | Not Started |
| BB-018 | Solid Food Introduction Tracker | P2 | Core | BB-002, BB-001 | Not Started |
| BB-019 | Data Export | P1 | Import/Export | BB-001 | Not Started |
| BB-020 | Settings and Preferences | P1 | Settings | None | Not Started |
| BB-021 | Week-by-Week Development Info | P2 | Core | BB-001 | Not Started |
| BB-022 | Photo Timeline | P2 | Core | BB-001 | Not Started |

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

### BB-001: Child Profile Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-001 |
| **Feature Name** | Child Profile Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a new parent, I want to create a profile for my baby with their name, birthdate, and photo, so that all tracking data is associated with the correct child.

**Secondary:**
> As an experienced parent with multiple children, I want to switch between child profiles quickly, so that I can log activities for the right child without confusion.

**Tertiary:**
> As a co-parent, I want to see my child's profile details at a glance, so that I can confirm I am logging data for the correct child when we have multiple profiles.

#### 3.3 Detailed Description

Child Profile Management is the foundational feature for MyBaby. Every other feature in the module depends on it because all logged data (feedings, sleep, diapers, growth, milestones) is associated with a specific child profile. A child profile contains the child's name, date of birth, sex (used for WHO growth chart reference data selection), a profile photo, and optional metadata like blood type and known allergies.

When a user first enables the MyBaby module, they are prompted to create their first child profile. The profile creation flow is intentionally minimal: only name, date of birth, and sex are required. All other fields are optional and can be added later. The date of birth is critical because it drives age calculations used throughout the app, including milestone age windows, vaccination schedules, WHO growth chart age axes, and wake window recommendations.

The profile screen displays the child's current age in a human-friendly format. For children under 1 month, age is shown in days (e.g., "12 days old"). For children 1-23 months, age is shown in months and days (e.g., "4 months, 18 days old"). For children 24 months and older, age is shown in years and months (e.g., "2 years, 3 months old"). This age display is used throughout the app wherever the child's age is relevant.

Users can edit all profile fields at any time. Changing the date of birth triggers a recalculation of all age-dependent data displays (milestone windows, growth chart age axis positions, vaccination schedule dates). The profile also serves as the top-level navigation anchor: the currently active child's name and photo appear in the module header, and tapping it opens a child switcher when multiple profiles exist.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None. This is the foundational feature for the module.

**External Dependencies:**
- Device camera or photo library access for profile photo selection
- Local storage for persisting profile data

**Assumed Capabilities:**
- User can navigate to the MyBaby module from the hub dashboard
- Local database is initialized and writable
- The MyBaby module has been enabled by the user

#### 3.5 User Interface Requirements

##### Screen: Profile Creation

**Layout:**
- A single-screen form with vertically stacked input fields
- At the top, a circular photo placeholder with a camera icon overlay. Tapping it opens a sheet with options: "Take Photo" and "Choose from Library"
- Below the photo: a text input for the child's name (labeled "Baby's Name"), a date picker for date of birth (labeled "Date of Birth"), and a segmented control for sex selection with options "Male", "Female", and "Not Specified"
- Below the required fields, an expandable "Additional Details" section (collapsed by default) containing: blood type picker (A+, A-, B+, B-, AB+, AB-, O+, O-, Unknown), a text input for known allergies (freeform, comma-separated), and a text input for pediatrician name
- At the bottom, a full-width "Create Profile" button. The button is disabled until name, date of birth, and sex are provided

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | Form just opened | All fields blank, photo placeholder shown, Create button disabled |
| Partial | Some required fields filled | Completed fields show values, Create button remains disabled |
| Ready | All required fields filled | Create button becomes active with accent color |
| Saving | User tapped Create | Button shows a spinner, all fields become non-interactive |
| Error | Save failed | Toast notification at the top: "Could not save profile. Please try again." Fields remain editable |

**Interactions:**
- Tap photo placeholder: opens action sheet with "Take Photo" and "Choose from Library" options
- Tap date of birth field: opens a date picker. The maximum selectable date is today. The minimum selectable date is 5 years before today (to support adding older toddlers)
- Tap "Create Profile": validates required fields, saves profile, navigates to the Daily Summary Dashboard for the new child

**Transitions/Animations:**
- "Additional Details" section expands and collapses with a smooth height animation, 250ms duration
- On successful save, the screen transitions to the Daily Summary Dashboard with a forward slide animation

##### Screen: Profile Detail / Edit

**Layout:**
- The profile screen shows the child's photo (large, centered), name in large text below the photo, and the computed age string below the name
- Below the age, a horizontal row of quick-stat cards showing: "Born on [formatted date]", "Sex: [Male/Female/Not Specified]", and "Blood Type: [type or Not Set]"
- Below the quick stats, a list of editable fields matching the creation form. Each field shows its current value and is tappable to edit inline
- An "Allergies" section lists each allergy as a removable chip/tag. A "+" button adds a new allergy
- A "Pediatrician" section shows the pediatrician name if set, or "Not Set" with a tap-to-add affordance
- At the bottom, a "Delete Profile" button in destructive styling (red text)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Viewing | Default state | All fields displayed as read-only values |
| Editing | User tapped a field | The tapped field becomes editable with a text input or picker |
| Saving | User confirmed an edit | Brief spinner on the edited field, then updated value appears |
| Delete Confirmation | User tapped Delete Profile | A confirmation dialog appears: "Delete [child name]'s profile? All tracking data for this child will be permanently deleted. This cannot be undone." with "Cancel" and "Delete" buttons |

**Interactions:**
- Tap any field value: field becomes editable inline
- Tap photo: opens the same photo picker action sheet as profile creation
- Tap "Delete Profile": shows the delete confirmation dialog
- Confirm delete: deletes the profile and all associated data (feedings, sleep, diapers, growth, milestones, vaccinations, etc.), then navigates to profile creation if no other profiles exist, or to the next available profile's dashboard

**Transitions/Animations:**
- Field edit transitions use a crossfade between read-only and editable states, 150ms duration
- Delete confirmation dialog appears with a fade-in overlay, 200ms duration

##### Component: Child Switcher

**Layout:**
- A dropdown or bottom sheet triggered by tapping the child's name/photo in the module header
- Lists all child profiles vertically, each showing: profile photo (small circular thumbnail), name, and age string
- The currently active child has a checkmark indicator
- At the bottom of the list, an "Add Another Child" button

**Interactions:**
- Tap a child's row: switches the active child, dismisses the switcher, and refreshes all data on the current screen for the newly selected child
- Tap "Add Another Child": navigates to the Profile Creation screen

#### 3.6 Data Requirements

##### Entity: ChildProfile

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the child profile |
| name | string | Required, 1-100 characters, trimmed | None | Child's display name |
| date_of_birth | date | Required, must be in the past or today, no more than 5 years ago | None | Child's date of birth, used for all age calculations |
| sex | enum | One of: "male", "female", "not_specified" | "not_specified" | Biological sex, used for WHO growth chart LMS table selection |
| photo_uri | string | Optional, max 500 characters | null | Local file path or URI to the profile photo |
| blood_type | enum | One of: "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown" | "unknown" | Child's blood type |
| allergies | string | Optional, max 1000 characters | null | Comma-separated list of known allergies |
| pediatrician_name | string | Optional, max 200 characters | null | Name of the child's pediatrician |
| is_active | boolean | Only one profile can be active at a time | true | Whether this is the currently selected child |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- ChildProfile has many FeedingLog entries (one-to-many via child_id)
- ChildProfile has many SleepLog entries (one-to-many via child_id)
- ChildProfile has many DiaperLog entries (one-to-many via child_id)
- ChildProfile has many GrowthMeasurement entries (one-to-many via child_id)
- ChildProfile has many MilestoneRecord entries (one-to-many via child_id)
- ChildProfile has many VaccinationRecord entries (one-to-many via child_id)
- ChildProfile has many PumpingLog entries (one-to-many via child_id)
- ChildProfile has many MedicineLog entries (one-to-many via child_id)
- ChildProfile has many TeethRecord entries (one-to-many via child_id)
- ChildProfile has many FirstExperience entries (one-to-many via child_id)
- ChildProfile has many PediatricianVisit entries (one-to-many via child_id)

**Indexes:**
- is_active - frequently queried to find the currently selected child
- date_of_birth - used for age calculations and sorting

**Validation Rules:**
- name: must not be empty after trimming whitespace. Must be 1-100 characters
- date_of_birth: must not be in the future. Must not be more than 5 years before today
- sex: must be one of the three allowed enum values
- is_active: when setting a profile to active, all other profiles must be set to inactive (enforced at the application layer)

**Example Data:**

```
{
  "id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "name": "Luna",
  "date_of_birth": "2026-01-15",
  "sex": "female",
  "photo_uri": "/local/photos/baby_luna.jpg",
  "blood_type": "O+",
  "allergies": "dairy",
  "pediatrician_name": "Dr. Sarah Chen",
  "is_active": true,
  "created_at": "2026-01-16T08:00:00Z",
  "updated_at": "2026-03-01T14:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Age Calculation

**Purpose:** Compute the child's current age in a human-friendly format for display throughout the app.

**Inputs:**
- date_of_birth: date - the child's date of birth
- reference_date: date - the date to calculate age relative to (usually today)

**Logic:**

```
1. Calculate the total number of days between date_of_birth and reference_date
2. IF total_days < 0 THEN
     RETURN error (date of birth is in the future)
3. IF total_days < 31 THEN
     RETURN "{total_days} days old"
4. Calculate months and remaining days:
     months = floor of (total_days / 30.4375)
     IF months < 24 THEN
       remaining_days = total_days - round(months * 30.4375)
       RETURN "{months} months, {remaining_days} days old"
     ELSE
       years = floor(months / 12)
       remaining_months = months mod 12
       RETURN "{years} years, {remaining_months} months old"
5. For precise month calculation, use calendar-aware logic:
     Walk forward from date_of_birth by whole calendar months
     Count remaining days after the last whole month
```

**Edge Cases:**
- Child born today: display "0 days old"
- Child born on February 29 (leap day): use March 1 as the monthly anniversary in non-leap years
- Date of birth in the future (clock skew): display "0 days old" rather than a negative value

##### Active Profile Switching

**Purpose:** Ensure exactly one child profile is active at any time.

**Inputs:**
- target_profile_id: string - the profile to make active

**Logic:**

```
1. Begin database transaction
2. Set is_active = false for ALL profiles where is_active = true
3. Set is_active = true for the profile with id = target_profile_id
4. Commit transaction
5. Refresh all displayed data for the newly active profile
```

**Edge Cases:**
- Only one profile exists: it is always active. The user cannot deactivate it
- Profile deletion when it is the active profile: if other profiles exist, activate the most recently created one. If no profiles remain, navigate to Profile Creation

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Required field left blank on creation | Inline validation message below the field: "This field is required" | User fills in the field, error clears immediately |
| Date of birth set to a future date | Inline validation: "Date of birth cannot be in the future" | User selects a valid date |
| Date of birth more than 5 years ago | Inline validation: "Date of birth must be within the last 5 years" | User selects a valid date |
| Photo selection fails (permission denied) | Toast: "Camera/photo access denied. Update permissions in device Settings." | User grants permission in device settings and retries |
| Database write fails during profile save | Toast: "Could not save profile. Please try again." | User taps the save button again |
| Profile deletion fails | Toast: "Could not delete profile. Please try again." | User retries the delete action |
| Name exceeds 100 characters | Character counter turns red at 100, input stops accepting characters | User shortens the name |

**Validation Timing:**
- Field-level validation runs on blur (when the user leaves the field)
- Date of birth validation runs immediately on date selection
- Form-level validation runs on "Create Profile" button tap
- Name character limit is enforced in real time as the user types

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has just enabled the MyBaby module and no profiles exist,
   **When** the user opens MyBaby,
   **Then** the Profile Creation screen is displayed.

2. **Given** the user is on the Profile Creation screen,
   **When** the user enters a name ("Luna"), selects a date of birth ("2026-01-15"), selects sex ("Female"), and taps "Create Profile",
   **Then** the profile is saved, and the user is navigated to the Daily Summary Dashboard showing "Luna" as the active child.

3. **Given** the user has a child profile for "Luna" (born 2026-01-15),
   **When** the user views the profile on 2026-03-06,
   **Then** the age displays as "1 month, 19 days old".

4. **Given** the user has two child profiles ("Luna" and "Max"),
   **When** the user taps the child name in the header and selects "Max",
   **Then** "Max" becomes the active profile, all displayed data refreshes to show Max's data, and the header shows Max's name and photo.

**Edge Cases:**

5. **Given** the user has one child profile,
   **When** the user navigates to the profile screen,
   **Then** the child switcher in the header does not show a dropdown arrow (no switching needed).

6. **Given** the user has a profile with no photo set,
   **When** the user views the profile,
   **Then** a default avatar placeholder is shown (a generic baby icon) in place of the photo.

**Negative Tests:**

7. **Given** the user is on the Profile Creation screen,
   **When** the user taps "Create Profile" without entering a name,
   **Then** the system shows an inline error "This field is required" under the name field,
   **And** no profile is created.

8. **Given** the user is on the Profile Creation screen,
   **When** the user selects a date of birth in the future,
   **Then** the system shows "Date of birth cannot be in the future" below the date field,
   **And** the "Create Profile" button remains disabled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates age in days for newborn | dob: today minus 5 days | "5 days old" |
| calculates age in months and days | dob: today minus 72 days | "2 months, X days old" (calendar-aware) |
| calculates age in years and months | dob: today minus 800 days | "2 years, 2 months old" (approximate) |
| returns 0 days for child born today | dob: today | "0 days old" |
| handles leap year birthday | dob: 2024-02-29, ref: 2025-02-28 | "12 months, 0 days old" (uses Feb 28 as anniversary) |
| validates name is not empty | name: "   " | validation error: "This field is required" |
| validates date not in future | dob: tomorrow | validation error: "Date of birth cannot be in the future" |
| validates date not too old | dob: 6 years ago | validation error: "Date of birth must be within the last 5 years" |
| enforces single active profile | activate profile B when A is active | A.is_active = false, B.is_active = true |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create first profile and verify navigation | 1. Open MyBaby with no profiles, 2. Fill in name + dob + sex, 3. Tap Create | Profile saved, user lands on Daily Summary Dashboard, header shows child name |
| Edit profile name and verify update | 1. Open profile, 2. Tap name field, 3. Change to new name, 4. Confirm | Name updates everywhere it is displayed (header, profile, switcher) |
| Delete only profile and verify redirect | 1. Open profile, 2. Tap Delete, 3. Confirm | All child data is deleted, user is redirected to Profile Creation screen |
| Switch active child and verify data refresh | 1. Create two profiles, 2. Log a feeding for child A, 3. Switch to child B | Dashboard shows no feedings for child B, child A's feeding is not visible |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| First-time MyBaby user creates a profile | 1. Enable MyBaby module, 2. Enter baby name, dob, sex, 3. Take a photo, 4. Add blood type and allergies in Additional Details, 5. Tap Create | Profile exists with all fields populated, Dashboard shows the child's name and age, empty states for feedings/sleep/diapers |
| Parent adds a second child | 1. From existing child's dashboard, 2. Tap header, 3. Tap "Add Another Child", 4. Fill in second child's info, 5. Create profile | Two profiles exist, second child is now active, switcher shows both children |

---

### BB-002: Feeding Log (Breast/Bottle/Solid)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-002 |
| **Feature Name** | Feeding Log (Breast/Bottle/Solid) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a new parent, I want to quickly log each feeding with type, amount, and time, so that I can track how much my baby is eating throughout the day.

**Secondary:**
> As a breastfeeding mother, I want to record which breast I fed from and for how long, so that I can alternate sides and monitor nursing duration.

**Tertiary:**
> As a co-parent coming home from work, I want to see a chronological list of today's feedings, so that I know when and how much the baby last ate.

#### 3.3 Detailed Description

The Feeding Log is one of the three core daily tracking features (along with Sleep and Diapers) that parents use dozens of times per day. It supports three feeding types: breastfeeding, bottle feeding, and solid food. Each type captures different data points, but all share a common timestamp and notes field.

Breastfeeding entries track: which side (left, right, or both), duration per side in minutes, and an optional latch quality indicator (good, fair, poor). Bottle feeding entries track: the volume in ounces or milliliters (unit preference set in BB-020 Settings), and the content type (breast milk, formula, or mixed). Solid food entries track: the food name, the quantity description (freeform text like "2 tablespoons" or "half a jar"), and an optional reaction field for noting allergic reactions or preferences.

The feeding log defaults to showing today's entries in reverse chronological order (most recent first). Each entry displays the feeding type icon, the time, and the key metric (duration for breast, volume for bottle, food name for solids). A daily total summary bar at the top shows total breastfeeding minutes, total bottle volume, and number of solid food sessions for the current day.

Quick-add is essential. Logging a feeding should take no more than 3 taps for the simplest case (tap "+" > select type > tap save with defaults). For breastfeeding, the most common flow is: tap "+", tap "Left" or "Right", the timer starts automatically (see BB-010 Feeding Timer), and the entry is saved when the timer stops. The system remembers the last feeding side and suggests the opposite side for the next breastfeeding entry.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - feedings are associated with a specific child

**External Dependencies:**
- Local storage for persisting feeding data

**Assumed Capabilities:**
- An active child profile exists
- User can navigate to the feeding log from the Daily Summary Dashboard or tab bar

#### 3.5 User Interface Requirements

##### Screen: Feeding Log List

**Layout:**
- A top summary bar showing today's feeding totals: total breastfeeding duration (e.g., "42 min"), total bottle volume (e.g., "12 oz"), and number of solid sessions (e.g., "2 solids")
- Below the summary bar, a date selector allowing navigation to previous days (swipe left/right or tap date to open a calendar picker)
- The main content area is a scrollable vertical list of feeding entries for the selected day, sorted by time with most recent at the top
- Each entry in the list displays: a type icon (breast, bottle, or spoon), the time (e.g., "2:35 PM"), the key metric for that type, and a small notes indicator if notes exist
- For breastfeeding entries, the key metric shows side and duration (e.g., "Left - 12 min")
- For bottle entries, the key metric shows content and volume (e.g., "Formula - 4 oz")
- For solid entries, the key metric shows food name (e.g., "Sweet potato")
- A floating action button with a "+" icon in the bottom-right corner opens the Add Feeding sheet

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No feedings logged for selected day | Illustration of a baby bottle with message: "No feedings logged today. Tap + to add the first one." |
| Populated | Feedings exist for selected day | Chronological list with summary bar totals |
| Past Day Empty | Viewing a past day with no entries | Message: "No feedings logged on [date]." without the call-to-action |
| Filtered | A type filter is active | Only entries of the selected type shown, summary bar reflects filtered totals |

**Interactions:**
- Tap a feeding entry: opens the Feeding Detail/Edit screen
- Swipe left on an entry: reveals a "Delete" button
- Tap delete: shows confirmation "Delete this feeding entry?" with Cancel and Delete
- Tap "+": opens the Add Feeding bottom sheet
- Swipe the date left/right: navigates to the previous/next day
- Tap the summary bar area for a specific type: filters the list to only that feeding type

**Transitions/Animations:**
- Deleted entries animate out with a fade + slide-left, 200ms duration
- New entries added animate in from the top with a slide-down + fade-in, 250ms duration
- Date navigation uses a horizontal slide transition, 200ms duration

##### Bottom Sheet: Add Feeding

**Layout:**
- The sheet opens from the bottom to approximately 60% of screen height
- At the top, three large tap targets for feeding type selection: "Breast" (with breast icon), "Bottle" (with bottle icon), "Solid" (with spoon icon). The last used type is pre-selected with a highlighted border
- Below the type selector, the form fields change based on the selected type:

**Breastfeeding fields:**
- Side selector: three buttons "Left", "Right", "Both". The system suggests the opposite of the last feeding side with a subtle highlight and "Suggested" label
- Duration: a numeric input in minutes (default: 15). If BB-010 Feeding Timer is used, this field is auto-populated
- Latch quality: three buttons "Good", "Fair", "Poor" (optional, default: none selected)

**Bottle feeding fields:**
- Content type: three buttons "Breast Milk", "Formula", "Mixed"
- Volume: a numeric input with unit label (oz or ml based on settings). Includes stepper buttons for +/- 0.5 oz (or +/- 10 ml)
- Temperature: three buttons "Warm", "Room Temp", "Cold" (optional)

**Solid food fields:**
- Food name: text input with autocomplete from previously entered foods
- Quantity: text input (freeform, e.g., "2 tbsp", "half jar")
- Reaction: four buttons "Loved It", "Liked It", "Refused", "Allergic Reaction" (optional)

**Common fields (all types):**
- Time: defaults to now, tappable to open a time picker for past entries
- Notes: optional text area, max 500 characters

- At the bottom, a full-width "Save" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Type Selection | Sheet just opened | Last-used type pre-selected, form shows fields for that type |
| Filling | User entering data | Fields populate, Save button is always enabled (time defaults to now) |
| Saving | User tapped Save | Button shows spinner, inputs become non-interactive |
| Saved | Save completed | Sheet dismisses, list updates with new entry at appropriate position |

**Interactions:**
- Tap a type button: switches form fields to match the selected type with a crossfade, 150ms
- Tap "Suggested" side: selects that side
- Tap time field: opens a time picker pre-set to the current time
- Tap Save: validates, saves, dismisses sheet, adds entry to the list

#### 3.6 Data Requirements

##### Entity: FeedingLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this feeding belongs to |
| feeding_type | enum | One of: "breast", "bottle", "solid" | None | Type of feeding |
| timestamp | datetime | Required, must not be in the future by more than 5 minutes | Current timestamp | When the feeding occurred |
| duration_minutes | float | Min: 0.5, Max: 120. Applicable for breast type | null | Duration of breastfeeding in minutes |
| side | enum | One of: "left", "right", "both". Applicable for breast type | null | Which breast was used |
| latch_quality | enum | One of: "good", "fair", "poor". Applicable for breast type | null | Quality of breastfeeding latch |
| content_type | enum | One of: "breast_milk", "formula", "mixed". Applicable for bottle type | null | What was in the bottle |
| volume_ml | float | Min: 1, Max: 1000. Applicable for bottle type | null | Volume in milliliters (stored in ml, displayed in user's preferred unit) |
| temperature | enum | One of: "warm", "room_temp", "cold". Applicable for bottle type | null | Temperature of bottle contents |
| food_name | string | Max 200 characters. Applicable for solid type | null | Name of the solid food |
| food_quantity | string | Max 100 characters. Applicable for solid type | null | Freeform quantity description |
| food_reaction | enum | One of: "loved", "liked", "refused", "allergic_reaction". Applicable for solid type | null | Baby's reaction to the food |
| notes | string | Optional, max 500 characters | null | Any additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- FeedingLog belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, timestamp) - composite index for chronological listing filtered by child
- (child_id, feeding_type, timestamp) - composite index for type-filtered queries
- food_name - for autocomplete lookups on solid food entries

**Validation Rules:**
- child_id: must reference an existing ChildProfile
- feeding_type: required, must be one of the three allowed values
- If feeding_type is "breast": side is required, duration_minutes should be provided
- If feeding_type is "bottle": volume_ml is required, content_type is required
- If feeding_type is "solid": food_name is required
- timestamp: must not be more than 5 minutes in the future (to accommodate slight clock differences)
- volume_ml: stored internally in milliliters. Conversion: 1 oz = 29.5735 ml

**Example Data:**

```
{
  "id": "f1a2b3c4-d5e6-7890-abcd-222222222222",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "feeding_type": "breast",
  "timestamp": "2026-03-06T14:35:00Z",
  "duration_minutes": 12.5,
  "side": "left",
  "latch_quality": "good",
  "content_type": null,
  "volume_ml": null,
  "temperature": null,
  "food_name": null,
  "food_quantity": null,
  "food_reaction": null,
  "notes": "Latched well, fell asleep at the end",
  "created_at": "2026-03-06T14:48:00Z",
  "updated_at": "2026-03-06T14:48:00Z"
}
```

#### 3.7 Business Logic Rules

##### Daily Feeding Totals

**Purpose:** Calculate summary statistics for feedings on a given day.

**Inputs:**
- child_id: string - the child to compute totals for
- date: date - the day to summarize

**Logic:**

```
1. Query all FeedingLog entries where child_id matches AND timestamp falls within the given date (midnight to midnight in local timezone)
2. Group entries by feeding_type
3. For "breast" entries:
     total_breast_minutes = SUM(duration_minutes) for all breast entries
     total_breast_sessions = COUNT of breast entries
4. For "bottle" entries:
     total_bottle_volume_ml = SUM(volume_ml) for all bottle entries
     total_bottle_sessions = COUNT of bottle entries
5. For "solid" entries:
     total_solid_sessions = COUNT of solid entries
6. RETURN {
     total_breast_minutes,
     total_breast_sessions,
     total_bottle_volume_ml,
     total_bottle_sessions,
     total_solid_sessions,
     total_sessions: total_breast_sessions + total_bottle_sessions + total_solid_sessions
   }
```

**Edge Cases:**
- No feedings on the given day: return all zeros
- Duration is null for a breast entry (timer was not used): exclude from total_breast_minutes sum but include in session count
- Volume unit display: stored value is always in ml. Display conversion: if user preference is oz, divide by 29.5735 and round to 1 decimal place

##### Side Suggestion

**Purpose:** Suggest which breast to use for the next breastfeeding session.

**Inputs:**
- child_id: string - the active child

**Logic:**

```
1. Query the most recent FeedingLog entry where child_id matches AND feeding_type = "breast" AND side is not null
2. IF no previous breast entry exists THEN
     RETURN no suggestion (both buttons equally styled)
3. IF last_side = "left" THEN
     RETURN suggestion = "right"
4. IF last_side = "right" THEN
     RETURN suggestion = "left"
5. IF last_side = "both" THEN
     RETURN no suggestion
```

**Edge Cases:**
- First breastfeeding ever: no suggestion shown
- Last session was "both": no suggestion shown, user chooses freely

##### Volume Unit Conversion

**Purpose:** Convert between ounces and milliliters for display.

**Inputs:**
- value: float - the volume value
- from_unit: enum - "ml" or "oz"
- to_unit: enum - "ml" or "oz"

**Logic:**

```
1. IF from_unit = to_unit THEN RETURN value
2. IF from_unit = "oz" AND to_unit = "ml" THEN
     RETURN value * 29.5735
3. IF from_unit = "ml" AND to_unit = "oz" THEN
     RETURN round(value / 29.5735, 1)
```

**Formulas:**
- ml_to_oz = volume_ml / 29.5735
- oz_to_ml = volume_oz * 29.5735

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails when saving a feeding | Toast: "Could not save feeding. Please try again." | User taps Save again; form data is preserved |
| Required field missing (e.g., volume for bottle) | Inline validation below the field: "[Field] is required" | User fills in the field, error clears immediately |
| Volume entered is 0 or negative | Inline validation: "Volume must be greater than 0" | User corrects the value |
| Duration entered exceeds 120 minutes | Inline validation: "Duration cannot exceed 120 minutes" | User corrects the value |
| Timestamp set more than 5 minutes in the future | Inline validation: "Time cannot be in the future" | User selects a valid time |
| Delete fails | Toast: "Could not delete feeding entry. Please try again." | User retries |

**Validation Timing:**
- Volume and duration fields validate on blur
- Required field checks run on Save tap
- Timestamp validation runs immediately on time picker selection

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has an active child profile,
   **When** the user taps "+", selects "Breast", selects "Left", enters 12 minutes, and taps Save,
   **Then** a breastfeeding entry appears at the top of the feeding log with "Left - 12 min" and the current time.

2. **Given** the user has logged 3 bottle feedings of 4 oz each today,
   **When** the user views the feeding log,
   **Then** the summary bar shows "12 oz" for total bottle volume and "3" for bottle sessions.

3. **Given** the last breastfeeding was on the left side,
   **When** the user opens the Add Feeding sheet and selects "Breast",
   **Then** the "Right" side button shows a "Suggested" label.

4. **Given** the user's unit preference is ounces,
   **When** the user logs a bottle feeding of 4 oz,
   **Then** the entry displays "4 oz" but the database stores 118.3 ml.

**Edge Cases:**

5. **Given** no feedings have been logged today,
   **When** the user views the feeding log,
   **Then** the empty state illustration and message are shown, and the summary bar shows all zeros.

6. **Given** the user is viewing yesterday's feeding log,
   **When** a new feeding is logged (which defaults to today),
   **Then** the new entry does not appear in yesterday's view but appears when the user navigates to today.

**Negative Tests:**

7. **Given** the user has selected "Bottle" as the feeding type,
   **When** the user taps Save without entering a volume,
   **Then** the system shows "Volume is required" below the volume field,
   **And** the entry is not saved.

8. **Given** the user enters a bottle volume of 0,
   **When** the user taps Save,
   **Then** the system shows "Volume must be greater than 0",
   **And** the entry is not saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates daily breast total correctly | 3 entries: 10min, 15min, 8min | total_breast_minutes: 33, total_breast_sessions: 3 |
| calculates daily bottle total in ml | 2 entries: 118.3ml, 88.7ml | total_bottle_volume_ml: 207.0 |
| converts ml to oz correctly | 118.294 ml | 4.0 oz |
| converts oz to ml correctly | 4 oz | 118.294 ml |
| suggests right when last was left | last entry side: "left" | suggestion: "right" |
| suggests left when last was right | last entry side: "right" | suggestion: "left" |
| no suggestion when last was both | last entry side: "both" | suggestion: null |
| no suggestion when no previous entries | no breast entries exist | suggestion: null |
| validates volume greater than zero | volume: 0 | validation error |
| validates duration within range | duration: 121 | validation error: exceeds 120 minutes |
| handles null duration in breast total | 2 entries: 10min + null | total_breast_minutes: 10, total_breast_sessions: 2 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add breast feeding and verify list update | 1. Open feeding log, 2. Tap +, 3. Select Breast > Left > 12 min, 4. Save | Entry appears in list with correct time, side, and duration; summary bar updates |
| Add bottle feeding with oz preference | 1. Set unit to oz in settings, 2. Add 4 oz formula feeding | Entry shows "4 oz", database stores 118.3 ml |
| Delete feeding and verify totals | 1. Log two 4oz bottle feedings, 2. Delete one | Summary bar updates from 8 oz to 4 oz, one entry remains |
| Navigate between days | 1. Log a feeding today, 2. Swipe to yesterday | Yesterday shows no entries (or its own entries), today's entry not visible |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent logs a full day of feedings | 1. Log 6 breastfeedings alternating sides, 2. Log 2 bottle feedings, 3. Log 1 solid feeding | Summary bar shows correct totals for all three types, 9 entries in list, side suggestions alternate correctly |
| Parent reviews yesterday's feedings | 1. Log feedings today, 2. Swipe to yesterday (no entries), 3. Swipe back to today | Today shows all entries, yesterday shows empty state, navigation works smoothly |

---

### BB-003: Sleep Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-003 |
| **Feature Name** | Sleep Tracking |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a sleep-deprived new parent, I want to log when my baby falls asleep and wakes up, so that I can see sleep patterns and total sleep hours per day.

**Secondary:**
> As a parent trying to establish a schedule, I want to distinguish between naps and nighttime sleep, so that I can track whether nap durations and nighttime stretches are improving.

**Tertiary:**
> As a co-parent, I want to see when the baby last slept and for how long, so that I can anticipate the next nap window.

#### 3.3 Detailed Description

Sleep Tracking captures every sleep session, whether a 20-minute car nap or an 8-hour overnight stretch. Each sleep entry has a start time, end time, and a classification as either "nap" or "nighttime." The system auto-classifies based on configurable rules: sleep sessions that start between 7:00 PM and 4:00 AM default to "nighttime," and all others default to "nap." Users can override the classification for any entry.

The primary interaction model supports two workflows. In the "live tracking" workflow, the user taps a "Sleep" button when the baby falls asleep, which starts a running timer visible on the Daily Summary Dashboard. When the baby wakes, the user taps "Wake" to end the session. The timer shows elapsed sleep time in HH:MM format. In the "manual entry" workflow, the user taps "+" and enters both start and end times directly. This is useful for logging sleep sessions after the fact (e.g., the baby slept during a car ride and the parent did not log it in real time).

A daily sleep summary shows total hours slept (nap hours + nighttime hours), number of nap sessions, longest sleep stretch, and average nap duration. A 7-day trend mini-chart shows daily total sleep hours as a simple bar chart to help parents spot improving or deteriorating patterns.

The sleep log interacts with the Nap Predictor (BB-011) by providing the raw sleep data that the predictor uses to calculate wake windows and suggest next nap times. When a sleep session ends, the system calculates the elapsed wake time and, if BB-011 is implemented, displays the next predicted nap window.

Sleep needs vary significantly by age. The system displays age-appropriate sleep guidelines as reference ranges (not rigid targets). For newborns (0-3 months): 14-17 hours total. For infants (4-11 months): 12-15 hours. For toddlers (1-2 years): 11-14 hours. For preschoolers (3-5 years): 10-13 hours. These ranges are shown on the daily summary for context, never as judgmental comparisons.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - sleep entries are associated with a specific child

**External Dependencies:**
- Local storage for persisting sleep data
- System clock for timer functionality

**Assumed Capabilities:**
- An active child profile exists
- User can navigate to the sleep log from the Daily Summary Dashboard or tab bar

#### 3.5 User Interface Requirements

##### Screen: Sleep Log List

**Layout:**
- A top summary bar showing today's sleep totals: total sleep hours (e.g., "13.5 hrs"), number of naps (e.g., "3 naps"), longest stretch (e.g., "5h 20m"), and average nap duration (e.g., "1h 10m")
- Below the summary, a 7-day trend mini-chart showing a horizontal bar for each of the last 7 days. Each bar is colored in two segments: nap hours (lighter shade) and nighttime hours (darker shade). The age-appropriate sleep range is shown as a shaded reference band behind the bars
- Below the chart, a date selector (same pattern as feeding log)
- The main content area lists sleep entries for the selected day in reverse chronological order. Each entry shows: a moon icon (nighttime) or sun icon (nap), start time and end time (e.g., "9:15 PM - 2:30 AM"), duration (e.g., "5h 15m"), and the classification label ("Nap" or "Night")
- If a sleep session is currently in progress (live tracking), it appears at the top of the list with a pulsing indicator and a running timer showing elapsed time, plus a "Wake" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No sleep entries for selected day | Illustration of a sleeping baby with message: "No sleep logged today. Tap the moon to start tracking." |
| Active Timer | A sleep session is in progress | Top entry shows pulsing sleep indicator with running elapsed time and a "Wake" button |
| Populated | Sleep entries exist, no active timer | Chronological list with summary bar totals |
| Past Day | Viewing a previous day | Entries for that day, no active timer available |

**Interactions:**
- Tap a sleep entry: opens the Sleep Detail/Edit screen
- Swipe left on an entry: reveals a "Delete" button
- Tap the floating action button (moon icon): starts a new live sleep timer (start_time = now, sleep in progress)
- Tap "Wake" on an active timer entry: ends the session (end_time = now), auto-classifies, saves
- Tap "+": opens an Add Sleep form for manual entry
- Long press on a sleep entry: opens a context menu with "Edit" and "Delete" options

**Transitions/Animations:**
- Active timer entry pulses with a gentle opacity oscillation (0.7 to 1.0, 2-second cycle)
- When "Wake" is tapped, the pulsing stops and the entry smoothly transitions to a completed state (150ms crossfade)
- Deleted entries animate out with fade + slide-left, 200ms

##### Bottom Sheet: Add Sleep (Manual Entry)

**Layout:**
- Start time picker (date + time, defaults to 1 hour ago)
- End time picker (date + time, defaults to now)
- Duration display (calculated automatically from start and end times, read-only)
- Classification toggle: "Nap" / "Nighttime" (auto-selected based on start time, editable)
- Sleep quality: three buttons "Restful", "Some Waking", "Restless" (optional)
- Notes: optional text area, max 500 characters
- Save button at the bottom

**Interactions:**
- Changing start or end time: duration recalculates automatically
- Changing start time: auto-classification may update based on the new time
- Save: validates that end time is after start time, saves, dismisses sheet

#### 3.6 Data Requirements

##### Entity: SleepLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this sleep entry belongs to |
| start_time | datetime | Required | None | When the baby fell asleep |
| end_time | datetime | Optional (null if sleep is in progress) | null | When the baby woke up. Null indicates an active sleep session |
| duration_minutes | float | Computed: (end_time - start_time) in minutes. Null if end_time is null | null | Total sleep duration in minutes |
| classification | enum | One of: "nap", "nighttime" | Auto-classified based on start_time | Whether this is a nap or nighttime sleep |
| sleep_quality | enum | One of: "restful", "some_waking", "restless" | null | Optional quality assessment |
| notes | string | Optional, max 500 characters | null | Any additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- SleepLog belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, start_time) - composite index for chronological listing
- (child_id, classification, start_time) - for filtered queries by nap vs. nighttime
- (child_id, end_time) - for finding active sleep sessions (end_time IS NULL)

**Validation Rules:**
- child_id: must reference an existing ChildProfile
- start_time: required, must not be more than 48 hours in the past (to prevent accidental far-past entries)
- end_time: if provided, must be after start_time
- duration_minutes: if end_time and start_time are both set, duration must equal (end_time - start_time) in minutes (enforced at application layer)
- Only one active sleep session (end_time IS NULL) per child at a time
- Sleep sessions must not overlap with other sessions for the same child (warning, not hard block)

**Example Data:**

```
{
  "id": "s1a2b3c4-d5e6-7890-abcd-333333333333",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "start_time": "2026-03-06T13:00:00Z",
  "end_time": "2026-03-06T14:25:00Z",
  "duration_minutes": 85,
  "classification": "nap",
  "sleep_quality": "restful",
  "notes": "Fell asleep in the stroller",
  "created_at": "2026-03-06T13:00:00Z",
  "updated_at": "2026-03-06T14:25:00Z"
}
```

#### 3.7 Business Logic Rules

##### Daily Sleep Summary

**Purpose:** Calculate summary statistics for sleep on a given day.

**Inputs:**
- child_id: string - the child to compute totals for
- date: date - the day to summarize

**Logic:**

```
1. Query all SleepLog entries where child_id matches AND the sleep session overlaps with the given date
   (A session overlaps with a date if start_time < end_of_date AND end_time > start_of_date,
    or end_time is null and start_time < end_of_date)
2. For sessions that span midnight, split the duration proportionally:
     time_in_this_day = overlap between [start_of_date, end_of_date] and [start_time, end_time]
3. Classify sessions:
     nap_entries = entries where classification = "nap"
     night_entries = entries where classification = "nighttime"
4. Calculate totals:
     total_nap_minutes = SUM(time_in_this_day) for nap entries
     total_night_minutes = SUM(time_in_this_day) for night entries
     total_sleep_minutes = total_nap_minutes + total_night_minutes
     total_sleep_hours = total_sleep_minutes / 60, rounded to 1 decimal
     nap_count = COUNT of nap entries that START on this day
     longest_stretch_minutes = MAX(duration_minutes) across all entries
     avg_nap_minutes = total_nap_minutes / nap_count (if nap_count > 0)
5. RETURN {
     total_sleep_hours,
     total_nap_hours: total_nap_minutes / 60,
     total_night_hours: total_night_minutes / 60,
     nap_count,
     longest_stretch_minutes,
     avg_nap_minutes
   }
```

**Edge Cases:**
- Active sleep session (no end_time): use current time as a provisional end_time for display purposes. Do not persist this provisional value
- Overnight sleep spanning midnight: count hours in each respective day
- No sleep entries: return all zeros
- Division by zero for avg_nap_minutes: return 0 if nap_count is 0

##### Auto-Classification

**Purpose:** Automatically classify a sleep session as "nap" or "nighttime" based on start time.

**Inputs:**
- start_time: datetime - when the baby fell asleep
- nighttime_start_hour: integer - configurable, default 19 (7 PM)
- nighttime_end_hour: integer - configurable, default 4 (4 AM)

**Logic:**

```
1. Extract the hour from start_time in local timezone
2. IF hour >= nighttime_start_hour OR hour < nighttime_end_hour THEN
     classification = "nighttime"
3. ELSE
     classification = "nap"
4. RETURN classification
```

**Edge Cases:**
- User has configured custom nighttime hours (e.g., 8 PM to 5 AM): use those values instead of defaults
- Sleep started at exactly the boundary hour: classify as nighttime (inclusive of start hour)

##### Age-Appropriate Sleep Guidelines

**Purpose:** Return the recommended total daily sleep range for a child's age.

**Inputs:**
- age_in_months: float - the child's age in months

**Logic:**

```
1. IF age_in_months < 3 THEN
     RETURN { min_hours: 14, max_hours: 17, label: "Newborn (0-3 months)" }
2. IF age_in_months < 12 THEN
     RETURN { min_hours: 12, max_hours: 15, label: "Infant (4-11 months)" }
3. IF age_in_months < 24 THEN
     RETURN { min_hours: 11, max_hours: 14, label: "Toddler (1-2 years)" }
4. IF age_in_months < 60 THEN
     RETURN { min_hours: 10, max_hours: 13, label: "Preschooler (3-5 years)" }
5. ELSE
     RETURN { min_hours: 9, max_hours: 12, label: "School-age (5+ years)" }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| User tries to start a sleep timer while one is already active | Toast: "A sleep session is already in progress. End it first or add a manual entry." | User ends the current session or uses manual entry |
| End time is before start time on manual entry | Inline validation: "Wake time must be after sleep time" | User corrects the times |
| Sleep session overlaps with another session | Warning banner (non-blocking): "This sleep session overlaps with another entry. You can save it, but you may want to review." | User can save anyway or adjust times |
| Start time is more than 48 hours ago | Inline validation: "Start time cannot be more than 48 hours ago" | User selects a more recent time |
| Database write fails | Toast: "Could not save sleep entry. Please try again." | User retries |
| Timer was running when app was force-closed | On next app open, detect orphaned active sessions (end_time IS NULL, start_time > 24 hours ago). Show prompt: "It looks like a sleep session was left running. When did [child name] wake up?" with a time picker | User enters the wake-up time, session is completed |

**Validation Timing:**
- Time field validation runs immediately on picker selection
- Overlap detection runs on Save tap (warning only, not blocking)
- Active session check runs when user taps the Sleep button

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has an active child profile and no sleep session in progress,
   **When** the user taps the moon (sleep) button,
   **Then** a sleep timer starts showing elapsed time, and the entry appears at the top of the sleep log with a pulsing indicator.

2. **Given** a sleep timer has been running for 1 hour and 15 minutes,
   **When** the user taps "Wake",
   **Then** the session is saved with a duration of 75 minutes, the timer stops, and the entry transitions to a completed state.

3. **Given** the baby has slept 3 naps (45min, 60min, 90min) and one nighttime stretch (6 hours) today,
   **When** the user views the sleep summary,
   **Then** the summary shows "9.25 hrs total", "3 naps", longest stretch "6h 0m", avg nap "65 min".

4. **Given** the user adds a manual sleep entry with start time "1:00 PM" and end time "2:30 PM",
   **When** the entry is saved,
   **Then** it appears in the sleep log classified as "Nap" with duration "1h 30m".

**Edge Cases:**

5. **Given** a sleep session starts at 8:00 PM on March 5 and ends at 6:00 AM on March 6,
   **When** viewing the sleep log for March 5,
   **Then** the entry shows with proportional hours attributed to March 5 (4 hours: 8PM-midnight), and viewing March 6 shows the remaining 6 hours.

6. **Given** the baby is 2 months old,
   **When** the user views the daily sleep summary,
   **Then** the age-appropriate guideline shows "Newborn (0-3 months): 14-17 hours" as a reference range.

**Negative Tests:**

7. **Given** a sleep session is already in progress,
   **When** the user taps the sleep button again,
   **Then** the system shows "A sleep session is already in progress" and does not start a new timer.

8. **Given** the user is adding a manual sleep entry,
   **When** the user sets the end time to before the start time,
   **Then** the system shows "Wake time must be after sleep time" and does not save the entry.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates daily sleep total correctly | 3 naps (45, 60, 90 min) + 1 night (360 min) | total_sleep_hours: 9.25 |
| calculates average nap duration | 3 naps totaling 195 minutes | avg_nap_minutes: 65 |
| finds longest stretch | durations: 45, 60, 90, 360 | longest_stretch_minutes: 360 |
| auto-classifies 7PM as nighttime | start_time: 19:00 | classification: "nighttime" |
| auto-classifies 2PM as nap | start_time: 14:00 | classification: "nap" |
| auto-classifies 3AM as nighttime | start_time: 03:00 | classification: "nighttime" |
| returns correct guideline for 2-month-old | age_in_months: 2 | { min: 14, max: 17, label: "Newborn" } |
| returns correct guideline for 8-month-old | age_in_months: 8 | { min: 12, max: 15, label: "Infant" } |
| handles midnight-spanning session | start: 22:00 Mar 5, end: 06:00 Mar 6, query date: Mar 5 | 2 hours attributed to Mar 5 |
| returns zero avg for zero naps | no nap entries | avg_nap_minutes: 0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Start and stop sleep timer | 1. Tap sleep button, 2. Wait 5 seconds, 3. Tap Wake | Entry saved with correct start/end times, duration approximately 0 minutes, classified correctly |
| Add manual entry and verify summary | 1. Add manual nap 1:00-2:30 PM, 2. Check summary | Summary shows 1.5 hours, 1 nap, longest stretch 90 min |
| Delete sleep entry and verify totals | 1. Log two naps, 2. Delete one, 3. Check summary | Totals reflect only the remaining nap |
| Handle orphaned timer | 1. Start timer, 2. Simulate app force-close, 3. Reopen app after 25 hours | Prompt appears asking when baby woke up |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent tracks a full day of sleep | 1. Log overnight sleep ending at 6:30 AM, 2. Use timer for morning nap, 3. Use timer for afternoon nap, 4. Start nighttime sleep timer | Summary shows correct totals, 7-day chart has data for today, next day begins with an active nighttime timer |
| Parent logs yesterday's missed nap | 1. View today's log, 2. Navigate to yesterday, 3. Add manual nap entry, 4. Return to today | Yesterday's chart bar updates, today's data unchanged |

---

### BB-004: Diaper Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-004 |
| **Feature Name** | Diaper Log |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a new parent, I want to log every diaper change with one or two taps, so that I can track output to ensure my baby is adequately hydrated and fed.

**Secondary:**
> As a parent concerned about my newborn's hydration, I want to count wet diapers per day, so that I can verify my baby is getting enough milk (pediatricians recommend 6+ wet diapers per day for breastfed newborns).

**Tertiary:**
> As a caregiver, I want to quickly note if a diaper was wet, dirty, or both, so that parents have accurate records for the pediatrician.

#### 3.3 Detailed Description

The Diaper Log is the simplest of the three core daily tracking features but also one of the most frequently used. Parents change 8-12 diapers per day for a newborn, so logging must be near-instantaneous. The minimal flow is: tap "+", tap "Wet", "Dirty", or "Both", and the entry is saved immediately with a timestamp of now. No additional required fields, no confirmation screen.

Each diaper entry records: the type (wet, dirty, or both), the timestamp, an optional color indicator for dirty diapers (yellow, green, brown, black, red, white - each color can indicate different digestive states, and pediatricians often ask about stool color during the first few weeks), an optional consistency indicator (runny, soft, formed, hard), and optional notes.

The diaper log screen shows today's entries in reverse chronological order with a daily count summary: total diapers, wet count, dirty count, and both count. A 7-day trend shows daily diaper counts as a simple number grid. For newborns (0-4 weeks), the system displays a reference indicator: "Target: 6+ wet diapers/day" based on pediatric guidelines for adequate hydration.

The color and consistency fields are especially important in the first 2 weeks of life when stool transitions from meconium (black/tar-like) through transitional stools (green) to normal breastfed stool (yellow, seedy) or formula-fed stool (tan/brown, formed). Parents and pediatricians use these observations to assess the baby's digestive health. However, these fields are never required because many parents simply need a quick count.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - diaper entries are associated with a specific child

**External Dependencies:**
- Local storage for persisting diaper data

**Assumed Capabilities:**
- An active child profile exists
- User can navigate to the diaper log from the Daily Summary Dashboard or tab bar

#### 3.5 User Interface Requirements

##### Screen: Diaper Log List

**Layout:**
- A top summary bar showing today's diaper totals: total count (e.g., "8 diapers"), wet count (e.g., "5 wet"), dirty count (e.g., "2 dirty"), and both count (e.g., "1 both")
- For newborns (0-4 weeks based on child's date of birth), an additional reference line below the summary: "Target: 6+ wet diapers/day" in a subtle informational style. If the wet count is 6 or above, a green checkmark appears. If below 6, an amber indicator appears (informational, not alarming)
- Below the summary, a date selector (same pattern as feeding and sleep logs)
- The main content area lists diaper entries for the selected day in reverse chronological order. Each entry shows: a diaper icon color-coded by type (blue for wet, brown for dirty, split blue/brown for both), the time (e.g., "3:22 PM"), the type label ("Wet", "Dirty", or "Both"), and optional detail chips for color and consistency if recorded
- A floating action button with a "+" icon opens the Quick Log bottom sheet

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No diaper entries for selected day | Illustration of a clean diaper with message: "No diaper changes logged today. Tap + to log one." |
| Populated | Entries exist | Chronological list with summary bar totals |
| Newborn Target Met | Baby is 0-4 weeks old and wet count >= 6 | Green checkmark next to "Target: 6+ wet diapers/day" |
| Newborn Target Not Met | Baby is 0-4 weeks old and wet count < 6 | Amber indicator next to target. No alarming language |

**Interactions:**
- Tap a diaper entry: opens the Diaper Detail/Edit screen
- Swipe left on an entry: reveals a "Delete" button
- Tap "+": opens the Quick Log bottom sheet
- Tap the summary bar wet/dirty/both segment: filters the list to that type only

**Transitions/Animations:**
- New entries animate in from the top with a pop-in effect (scale 0.8 to 1.0 + fade-in), 200ms
- Deleted entries animate out with fade + slide-left, 200ms

##### Bottom Sheet: Quick Log

**Layout:**
- The sheet opens to approximately 40% of screen height (intentionally minimal)
- Three large tap-target buttons arranged horizontally: "Wet" (blue background, water drop icon), "Dirty" (brown background, circle icon), "Both" (split blue/brown background, combined icon)
- Tapping any of these three buttons saves the entry immediately with timestamp = now and dismisses the sheet (one-tap logging)
- Below the three quick buttons, a "More Details" expandable section containing:
  - Time picker (defaults to now)
  - Color picker (six colored circles: yellow, green, brown, black, red, white - applicable for dirty/both only)
  - Consistency picker: four buttons "Runny", "Soft", "Formed", "Hard" (applicable for dirty/both only)
  - Notes: optional text area, max 300 characters
  - "Save with Details" button (used instead of the quick tap when details are expanded)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Quick Mode | Sheet just opened | Three large buttons visible, details collapsed |
| Detailed Mode | User tapped "More Details" | Additional fields expanded below the quick buttons |
| Saving | User tapped a quick button or Save with Details | Brief checkmark animation, sheet dismisses |

**Interactions:**
- Tap "Wet", "Dirty", or "Both" (quick mode): saves immediately, dismisses sheet, shows brief checkmark toast
- Tap "More Details": expands the detail fields with a smooth height animation
- Tap "Save with Details": saves with all detail fields, dismisses sheet

#### 3.6 Data Requirements

##### Entity: DiaperLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this diaper entry belongs to |
| timestamp | datetime | Required | Current timestamp | When the diaper was changed |
| diaper_type | enum | One of: "wet", "dirty", "both" | None | What was in the diaper |
| stool_color | enum | One of: "yellow", "green", "brown", "black", "red", "white" | null | Color of stool (applicable for dirty/both) |
| stool_consistency | enum | One of: "runny", "soft", "formed", "hard" | null | Consistency of stool (applicable for dirty/both) |
| notes | string | Optional, max 300 characters | null | Any additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- DiaperLog belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, timestamp) - composite index for chronological listing filtered by child
- (child_id, diaper_type, timestamp) - for type-filtered queries

**Validation Rules:**
- child_id: must reference an existing ChildProfile
- diaper_type: required, must be one of the three allowed values
- stool_color: if provided, diaper_type must be "dirty" or "both" (not applicable for "wet" only)
- stool_consistency: if provided, diaper_type must be "dirty" or "both"
- timestamp: must not be more than 48 hours in the past

**Example Data:**

```
{
  "id": "d1a2b3c4-d5e6-7890-abcd-444444444444",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "timestamp": "2026-03-06T15:22:00Z",
  "diaper_type": "both",
  "stool_color": "yellow",
  "stool_consistency": "soft",
  "notes": "Normal seedy breastfed stool",
  "created_at": "2026-03-06T15:22:00Z",
  "updated_at": "2026-03-06T15:22:00Z"
}
```

#### 3.7 Business Logic Rules

##### Daily Diaper Totals

**Purpose:** Calculate summary statistics for diapers on a given day.

**Inputs:**
- child_id: string - the child to compute totals for
- date: date - the day to summarize

**Logic:**

```
1. Query all DiaperLog entries where child_id matches AND timestamp falls within the given date
2. Count by type:
     wet_count = COUNT where diaper_type = "wet"
     dirty_count = COUNT where diaper_type = "dirty"
     both_count = COUNT where diaper_type = "both"
     total_count = wet_count + dirty_count + both_count
3. Calculate wet-inclusive count (for hydration tracking):
     total_wet = wet_count + both_count
     (Both wet and "both" diapers count toward the hydration target)
4. RETURN {
     total_count,
     wet_count,
     dirty_count,
     both_count,
     total_wet
   }
```

**Edge Cases:**
- No diapers logged: return all zeros
- All diapers are "both": wet_count and dirty_count are 0, both_count equals total_count, total_wet equals both_count

##### Newborn Hydration Target

**Purpose:** Determine whether to display the hydration target indicator and its status.

**Inputs:**
- child_age_in_days: integer - the child's age in days
- total_wet: integer - total wet-inclusive diaper count for the day

**Logic:**

```
1. IF child_age_in_days > 28 THEN
     RETURN { show_target: false }
2. target = 6
3. IF child_age_in_days <= 1 THEN target = 1
4. IF child_age_in_days = 2 THEN target = 2
5. IF child_age_in_days = 3 THEN target = 3
6. IF child_age_in_days = 4 THEN target = 4
7. IF child_age_in_days >= 5 THEN target = 6
8. met = total_wet >= target
9. RETURN {
     show_target: true,
     target_count: target,
     met: met,
     label: "Target: {target}+ wet diapers/day"
   }
```

**Edge Cases:**
- Day 1 of life: target is only 1 wet diaper (newborns produce very little urine initially)
- Targets ramp up through day 5 following pediatric guidelines
- After 28 days, the target indicator is no longer shown

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails during quick log | Toast: "Could not save. Please try again." Entry data is preserved in memory | User taps the type button again |
| Stool color set for a "wet" only diaper | Stool color field is not displayed for "wet" type; if data corruption occurs, color is ignored on display | Application layer strips color when type is "wet" |
| Timestamp more than 48 hours ago on manual entry | Inline validation: "Time cannot be more than 48 hours ago" | User selects a more recent time |
| Delete fails | Toast: "Could not delete entry. Please try again." | User retries |

**Validation Timing:**
- Quick log has no validation (type is always selected by the tap itself, timestamp is automatic)
- Detailed mode validates timestamp on picker selection
- Stool color/consistency fields are only shown when type is "dirty" or "both"

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has an active child profile,
   **When** the user taps "+", then taps "Wet",
   **Then** a wet diaper entry is saved immediately with the current time, the sheet dismisses, and the entry appears at the top of the diaper log.

2. **Given** the user has logged 5 wet diapers and 3 dirty diapers today,
   **When** the user views the diaper log,
   **Then** the summary shows "8 diapers", "5 wet", "3 dirty", "0 both".

3. **Given** the baby is 10 days old and has 7 wet+both diapers today,
   **When** the user views the diaper log,
   **Then** the target indicator shows "Target: 6+ wet diapers/day" with a green checkmark.

4. **Given** the user taps "+" then taps "More Details" then selects "Dirty", color "Yellow", consistency "Soft", and adds a note,
   **When** the user taps "Save with Details",
   **Then** the entry is saved with all detail fields and appears in the list with color and consistency chips.

**Edge Cases:**

5. **Given** the baby is 2 days old,
   **When** the user views the diaper log with 2 wet diapers logged,
   **Then** the target shows "Target: 2+ wet diapers/day" with a green checkmark (day-2 target is 2).

6. **Given** the baby is 2 months old (> 28 days),
   **When** the user views the diaper log,
   **Then** no hydration target indicator is displayed.

**Negative Tests:**

7. **Given** the user is in detailed mode and selects "Wet" as the type,
   **When** the user looks at the form,
   **Then** the stool color and consistency fields are not displayed (they are irrelevant for wet-only diapers).

8. **Given** the user sets the timestamp to 3 days ago in detailed mode,
   **When** the user taps "Save with Details",
   **Then** the system shows "Time cannot be more than 48 hours ago" and does not save.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates daily diaper totals correctly | 5 wet, 3 dirty, 2 both | total: 10, wet: 5, dirty: 3, both: 2, total_wet: 7 |
| returns all zeros for empty day | no entries | total: 0, wet: 0, dirty: 0, both: 0, total_wet: 0 |
| shows target for 10-day-old | age: 10 days | show_target: true, target: 6 |
| shows target for 2-day-old | age: 2 days | show_target: true, target: 2 |
| hides target for 30-day-old | age: 30 days | show_target: false |
| counts "both" toward total_wet | 0 wet, 0 dirty, 3 both | total_wet: 3 |
| target met when total_wet >= target | age: 7 days, total_wet: 6 | met: true |
| target not met when total_wet < target | age: 7 days, total_wet: 4 | met: false |
| validates stool color only for dirty/both | type: "wet", color: "yellow" | validation warning: color not applicable |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Quick log wet diaper | 1. Tap +, 2. Tap Wet | Entry saved with current time, appears in list, summary updates |
| Quick log with details | 1. Tap +, 2. Tap More Details, 3. Select Dirty, color Brown, consistency Formed, 4. Save | Entry saved with all fields, color and consistency chips visible |
| Delete entry and verify totals | 1. Log 3 wet diapers, 2. Delete one | Total updates from 3 to 2, deleted entry disappears |
| Verify type-specific detail fields | 1. Open details, 2. Select Wet | Color and consistency fields are hidden |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent tracks a full day of newborn diapers | 1. Log 8 wet, 4 dirty, 2 both diapers across the day | Summary shows 14 total, target met (10 total_wet >= 6), entries in chronological order |
| Caregiver logs diapers during a shift | 1. Log 3 diapers over 4 hours using quick-tap, 2. Parent views the log later | All 3 entries visible with correct times, summary includes them in daily totals |

---

### BB-005: Growth Charts (WHO Percentiles)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-005 |
| **Feature Name** | Growth Charts (WHO Percentiles) |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a parent, I want to record my baby's height, weight, and head circumference after each pediatrician visit and see where they fall on the growth chart, so that I can track growth trends over time.

**Secondary:**
> As an anxious first-time parent, I want to see my baby's percentile for weight, height, and head circumference, so that I know if my baby is growing within the normal range.

**Tertiary:**
> As a parent with multiple children, I want to compare growth curves between my children on the same chart, so that I can see how their growth patterns differ.

#### 3.3 Detailed Description

Growth Charts are the clinical gold standard for monitoring infant and child physical development. This feature implements WHO (World Health Organization) growth standards using the Box-Cox power exponential (BCPE) distribution to compute exact percentiles from raw measurements. The WHO standards are preferred over CDC charts for children 0-2 years because they describe how children should grow under optimal conditions (breastfed, nonsmoking household, adequate nutrition) rather than how they did grow in a reference population.

Three measurement types are tracked: weight (in kilograms or pounds+ounces), length/height (in centimeters or inches), and head circumference (in centimeters or inches). For each measurement, the system computes the Z-score using the WHO LMS (Lambda-Mu-Sigma) method and converts it to a percentile. The formula is:

Z = ((value/M)^L - 1) / (L * S)

where L (Box-Cox power), M (median), and S (coefficient of variation) are age-specific and sex-specific parameters from WHO reference tables. The percentile is then computed as: percentile = normal_cdf(Z) * 100, where normal_cdf is the cumulative distribution function of the standard normal distribution.

The growth chart screen displays each measurement type as a line chart with the child's data points plotted over the WHO reference curves. The reference curves show the 3rd, 15th, 50th, 85th, and 97th percentile lines as a shaded band. The child's measurements appear as connected dots, with each dot labeled with the date and value. Tapping a data point shows a tooltip with the measurement value, the computed percentile, and the Z-score.

The WHO LMS reference data tables are bundled locally with the app. They contain approximately 2,000 rows total across all three measurement types (weight-for-age, length/height-for-age, head-circumference-for-age), both sexes, and age points from birth to 5 years (in day intervals for 0-13 weeks, then month intervals up to 60 months). No network request is ever made to compute a percentile. This is essential for the privacy-first design and for offline functionality.

Users can enter measurements in either metric (kg, cm) or imperial (lb+oz, inches) units based on their preference in Settings (BB-020). Internally, all values are stored in metric units. Imperial values are converted on input and converted back for display.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - growth data is associated with a child, and the child's sex and date of birth are used for LMS table lookups

**External Dependencies:**
- Bundled WHO LMS reference data tables (included in app assets, no network required)
- Local storage for persisting growth measurements

**Assumed Capabilities:**
- An active child profile exists with sex and date of birth set
- The math library or runtime environment supports the standard normal cumulative distribution function (or an approximation)

#### 3.5 User Interface Requirements

##### Screen: Growth Chart

**Layout:**
- A top tab bar with three segments: "Weight", "Length/Height", "Head Circ." The active tab is highlighted
- Below the tab bar, a chart area occupying approximately 60% of the screen height. The chart displays:
  - X-axis: age (in weeks for 0-3 months, months for 3-24 months, years for 24+ months)
  - Y-axis: measurement value in the user's preferred unit
  - WHO reference curves as shaded bands: the area between the 3rd and 97th percentile is lightly shaded, with darker shading between the 15th and 85th percentile. Individual percentile lines (3rd, 15th, 50th, 85th, 97th) are drawn as labeled curves
  - The child's measurements plotted as connected colored dots. Each dot represents a measurement at a specific age
- Below the chart, a "Current Percentile" summary card showing the most recent measurement's value and percentile (e.g., "Weight: 7.2 kg - 55th percentile")
- Below the summary card, a scrollable list of all measurements for the active tab in reverse chronological order. Each row shows: date, age at measurement, value, and percentile
- A floating action button "+" to add a new measurement

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No measurements recorded for the active tab | Chart shows only WHO reference curves with no child data points. Message below: "No measurements yet. Tap + to add one after your next pediatrician visit." |
| Single Point | One measurement exists | Chart shows the data point. No line drawn (need 2+ points for a line). Percentile card shows the single value |
| Multiple Points | Two or more measurements exist | Chart shows connected data points as a line over the reference curves |
| Comparison Mode | Multi-child comparison is active (BB-016) | Multiple children's lines shown in different colors with a legend |

**Interactions:**
- Tap a measurement tab (Weight/Length/Head): switches the chart and measurement list to the selected type
- Tap a data point on the chart: shows a tooltip with date, age, value, percentile, and Z-score
- Tap a measurement row in the list: opens the Measurement Detail/Edit screen
- Swipe left on a row: reveals "Delete" button
- Tap "+": opens the Add Measurement sheet
- Pinch to zoom on the chart: adjusts the visible age range for closer inspection

**Transitions/Animations:**
- Tab switching uses a horizontal slide on the chart, 200ms
- Data points animate in sequentially when the chart first loads (50ms stagger per point)
- Tooltip appears with a fade + scale animation, 150ms

##### Bottom Sheet: Add Measurement

**Layout:**
- Measurement type selector: three buttons "Weight", "Length/Height", "Head Circ." (pre-selected based on the active tab)
- Date picker: defaults to today. Cannot be set to a future date or before the child's date of birth
- Value input:
  - For weight (metric): a numeric input labeled "kg" with step 0.01
  - For weight (imperial): two numeric inputs "lb" and "oz" with steps 1 and 0.1 respectively
  - For length/height (metric): a numeric input labeled "cm" with step 0.1
  - For length/height (imperial): a numeric input labeled "in" with step 0.1
  - For head circumference (metric): a numeric input labeled "cm" with step 0.1
  - For head circumference (imperial): a numeric input labeled "in" with step 0.1
- Below the value input, a live percentile preview: as the user enters a value, the computed percentile updates in real time (e.g., "55th percentile" appears below the input)
- Notes field: optional, max 300 characters (e.g., "Measured at 4-month checkup")
- Save button at the bottom

**Interactions:**
- Entering a value: percentile preview updates in real time after each keystroke (debounced by 300ms)
- Save: validates, saves, dismisses sheet, updates chart and list

#### 3.6 Data Requirements

##### Entity: GrowthMeasurement

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this measurement belongs to |
| measurement_type | enum | One of: "weight", "length", "head_circumference" | None | What was measured |
| measurement_date | date | Required, must not be in the future, must not be before child's date of birth | None | Date the measurement was taken |
| value_metric | float | Required, must be positive | None | The measurement value in metric units (kg for weight, cm for length and head circumference) |
| age_in_days | integer | Computed: measurement_date minus child's date_of_birth | Auto | Child's age in days at the time of measurement. Used for LMS table lookup |
| z_score | float | Computed from WHO LMS formula | Auto | The Z-score for this measurement relative to WHO reference |
| percentile | float | Computed: normal_cdf(z_score) * 100. Range: 0.0 to 100.0 | Auto | The percentile ranking |
| notes | string | Optional, max 300 characters | null | Any additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- GrowthMeasurement belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, measurement_type, measurement_date) - composite index for chart data retrieval and uniqueness
- (child_id, measurement_type, age_in_days) - for LMS lookup alignment

**Validation Rules:**
- child_id: must reference an existing ChildProfile
- measurement_type: required, must be one of the three allowed values
- measurement_date: must not be in the future, must not be before the child's date_of_birth
- value_metric: must be positive. Reasonable ranges (soft validation, warning not block):
  - Weight: 0.5 - 50 kg (birth to age 5)
  - Length/Height: 30 - 150 cm
  - Head circumference: 20 - 60 cm
- Only one measurement of each type per date per child (enforced as a unique constraint on child_id + measurement_type + measurement_date)

**Example Data:**

```
{
  "id": "g1a2b3c4-d5e6-7890-abcd-555555555555",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "measurement_type": "weight",
  "measurement_date": "2026-03-01",
  "value_metric": 5.8,
  "age_in_days": 45,
  "z_score": 0.13,
  "percentile": 55.2,
  "notes": "Measured at 6-week checkup",
  "created_at": "2026-03-01T16:00:00Z",
  "updated_at": "2026-03-01T16:00:00Z"
}
```

##### Reference Entity: WHOLMSData (Bundled, Read-Only)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| measurement_type | enum | One of: "weight", "length", "head_circumference" | - | Which growth metric |
| sex | enum | One of: "male", "female" | - | Biological sex |
| age_in_days | integer | 0 to 1856 (0 to ~5 years) | - | Age in days |
| L | float | - | - | Box-Cox power (lambda). Accounts for skewness in the distribution |
| M | float | - | - | Median. The 50th percentile value at this age |
| S | float | - | - | Coefficient of variation. Measures spread |

**Notes:**
- This is a bundled read-only reference table, not user data
- Approximately 2,000 rows total across all measurement types and sexes
- Data is sourced from WHO Child Growth Standards (2006) and WHO Growth Reference (2007)
- Interpolation between age points: for ages between two reference points, linearly interpolate L, M, and S values

#### 3.7 Business Logic Rules

##### WHO Z-Score Calculation

**Purpose:** Compute the Z-score for a growth measurement using the WHO Box-Cox power exponential (BCPE) distribution method.

**Inputs:**
- value: float - the measurement value in metric units
- L: float - Box-Cox power for the child's age and sex
- M: float - median for the child's age and sex
- S: float - coefficient of variation for the child's age and sex

**Logic:**

```
1. Look up L, M, S values from the WHO LMS reference table for:
     - measurement_type
     - sex (from child's profile)
     - age_in_days (computed from child's date_of_birth and measurement_date)
2. If age_in_days falls between two reference points, linearly interpolate:
     For each of L, M, S:
       interpolated = lower_value + (upper_value - lower_value) * ((age - lower_age) / (upper_age - lower_age))
3. Compute Z-score:
     IF L != 0 THEN
       Z = ((value / M)^L - 1) / (L * S)
     ELSE (L = 0, which means log-normal distribution)
       Z = ln(value / M) / S
4. Clamp Z to range [-5, 5] for display purposes
     (Values outside this range indicate extreme outliers or data entry errors)
5. RETURN Z
```

**Formulas:**
- Z = ((value / M)^L - 1) / (L * S) when L != 0
- Z = ln(value / M) / S when L = 0
- percentile = normal_cdf(Z) * 100

**Edge Cases:**
- L equals 0: use the logarithmic formula instead of the power formula
- Value is 0 or negative: reject as invalid input (measurements must be positive)
- Z-score outside [-5, 5]: clamp and display a warning that the value may be a data entry error
- Age exceeds the WHO table range (> 1856 days / ~5 years): display "Out of range" instead of a percentile
- Sex is "not_specified" in child profile: prompt user to set sex before computing percentiles (WHO tables require sex)

##### Percentile Calculation

**Purpose:** Convert a Z-score to a percentile using the standard normal cumulative distribution function.

**Inputs:**
- z_score: float - the computed Z-score

**Logic:**

```
1. percentile = normal_cdf(z_score) * 100
2. Round to 1 decimal place
3. Clamp to range [0.1, 99.9] for display
     (Avoid showing "0th percentile" or "100th percentile" which are misleading)
4. RETURN percentile
```

**Implementation Note for normal_cdf:**
The standard normal CDF can be approximated using the Abramowitz and Stegun approximation or any equivalent polynomial approximation. The error should be less than 1.5 * 10^-7.

```
Abramowitz and Stegun approximation:
  p = 0.2316419
  b1 = 0.319381530
  b2 = -0.356563782
  b3 = 1.781477937
  b4 = -1.821255978
  b5 = 1.330274429
  t = 1 / (1 + p * |z|)
  pdf = (1 / sqrt(2 * pi)) * e^(-z^2 / 2)
  cdf_positive = 1 - pdf * (b1*t + b2*t^2 + b3*t^3 + b4*t^4 + b5*t^5)
  IF z >= 0 THEN cdf = cdf_positive
  ELSE cdf = 1 - cdf_positive
```

##### Weight Unit Conversion

**Purpose:** Convert between kilograms and pounds+ounces.

**Inputs:**
- value_kg: float - weight in kilograms (for kg to lb+oz)
- value_lb: integer, value_oz: float - weight in pounds and ounces (for lb+oz to kg)

**Logic:**

```
KG to LB+OZ:
  1. total_oz = value_kg * 35.274
  2. lb = floor(total_oz / 16)
  3. oz = round(total_oz mod 16, 1)
  4. RETURN { lb, oz }

LB+OZ to KG:
  1. total_oz = (value_lb * 16) + value_oz
  2. kg = round(total_oz / 35.274, 2)
  3. RETURN kg
```

##### Length Unit Conversion

**Purpose:** Convert between centimeters and inches.

**Inputs:**
- value: float
- from_unit: enum - "cm" or "in"

**Logic:**

```
1. IF from_unit = "cm" THEN RETURN round(value / 2.54, 1)
2. IF from_unit = "in" THEN RETURN round(value * 2.54, 1)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Sex is "not_specified" when computing percentile | Banner on chart: "Set baby's sex in profile to calculate percentiles." Measurements can still be saved but no Z-score or percentile is computed | User navigates to profile and sets sex, then returns to growth chart |
| Measurement value outside reasonable range | Warning (non-blocking): "This [weight/length/head] value seems unusually [high/low]. Please double-check." | User can save anyway or correct the value |
| Z-score outside [-5, 5] | Warning badge on the data point: "Unusual value. Please verify this measurement." | User taps the point to edit or delete |
| Duplicate measurement (same type + same date) | Toast: "A [weight/length/head] measurement already exists for [date]. Would you like to replace it?" with Replace and Cancel | User chooses to replace (update) or cancel |
| LMS data not found for child's age | Message: "Growth data is not available for ages beyond 5 years." | Chart displays data points but no percentile curves beyond 5 years |
| Database write fails | Toast: "Could not save measurement. Please try again." | User retries |

**Validation Timing:**
- Value range validation runs on blur with debounced percentile preview
- Date validation runs immediately on date picker selection
- Duplicate check runs on Save tap
- Sex check runs when the chart screen is opened

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a female child born on 2026-01-15,
   **When** the user enters a weight of 5.8 kg measured on 2026-03-01 (age 45 days),
   **Then** the system computes the Z-score using the female weight-for-age WHO LMS values for 45 days, converts to a percentile, and displays the result (approximately 55th percentile).

2. **Given** the user has recorded 4 weight measurements over 4 months,
   **When** the user views the Weight growth chart,
   **Then** the chart shows 4 connected data points plotted over the WHO reference curves with the 3rd, 15th, 50th, 85th, and 97th percentile bands visible.

3. **Given** the user's unit preference is pounds+ounces,
   **When** the user enters a weight of 12 lb 13 oz,
   **Then** the system stores 5.81 kg internally and displays "12 lb 13 oz" in the measurement list.

4. **Given** the user taps a data point on the chart,
   **When** the tooltip appears,
   **Then** it shows the date, age at measurement, value in the user's preferred unit, percentile, and Z-score.

**Edge Cases:**

5. **Given** a child with sex set to "not_specified",
   **When** the user navigates to the Growth Chart,
   **Then** a banner prompts the user to set the child's sex, measurements can be recorded but percentiles are not calculated.

6. **Given** the child is 4 years and 11 months old,
   **When** the user adds a measurement,
   **Then** the percentile is calculated using the WHO table value for that age. If the child turns 5 years, a message indicates growth data extends only to 5 years.

7. **Given** the user enters a weight of 25 kg for a 6-month-old (Z-score > 5),
   **When** the system computes the percentile,
   **Then** a warning badge appears on the data point suggesting the user verify the measurement.

**Negative Tests:**

8. **Given** the user is adding a measurement,
   **When** the user sets the date to before the child's date of birth,
   **Then** the system shows "Measurement date cannot be before the baby's date of birth" and does not save.

9. **Given** the user enters a weight of 0 or a negative number,
   **When** the user taps Save,
   **Then** the system shows "Value must be greater than 0" and does not save.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes Z-score with non-zero L | value: 5.8, L: -0.3521, M: 5.6, S: 0.1227 | Z approximately 0.13 (verify against WHO reference) |
| computes Z-score with L = 0 | value: 5.6, L: 0, M: 5.6, S: 0.12 | Z = 0 (value equals median) |
| converts Z-score to percentile (Z=0) | Z: 0.0 | percentile: 50.0 |
| converts Z-score to percentile (Z=1.0) | Z: 1.0 | percentile: approximately 84.1 |
| converts Z-score to percentile (Z=-2.0) | Z: -2.0 | percentile: approximately 2.3 |
| clamps Z-score to [-5, 5] | value producing Z = 6.2 | clamped Z: 5.0, percentile: 99.9 |
| clamps percentile to [0.1, 99.9] | Z: -6.0 | percentile: 0.1 |
| converts kg to lb+oz | 5.81 kg | 12 lb, 13.0 oz |
| converts lb+oz to kg | 12 lb, 13 oz | 5.81 kg |
| converts cm to inches | 60 cm | 23.6 in |
| converts inches to cm | 23.6 in | 59.9 cm |
| interpolates LMS for intermediate age | age: 50 days (between day 45 and day 56 reference points) | L, M, S are linearly interpolated |
| rejects negative value | value: -1.0 | validation error |
| rejects zero value | value: 0 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add weight and verify chart update | 1. Navigate to Growth Chart, 2. Tap +, 3. Enter 5.8 kg on March 1, 4. Save | Data point appears on the weight chart at the correct position, percentile card updates |
| Add measurement in imperial and verify storage | 1. Set units to imperial, 2. Add weight 12 lb 13 oz | Displayed as "12 lb 13 oz", stored as 5.81 kg, percentile computed from kg value |
| Delete measurement and verify chart | 1. Add 3 weight measurements, 2. Delete the middle one | Chart shows 2 connected points, the deleted one is gone |
| Duplicate date handling | 1. Add weight for March 1, 2. Try to add another weight for March 1 | Prompt asks to replace existing, user confirms, only one measurement for that date |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent logs growth at every pediatrician visit | 1. Add birth weight, 2. Add 2-week weight, 3. Add 1-month weight, 4. Add 2-month weight, 5. Add 4-month weight | 5 data points on the weight chart forming a growth curve, all percentiles computed, chart shows growth trajectory relative to WHO curves |
| Parent adds all three measurement types at a visit | 1. Add weight, 2. Switch to Length tab, 3. Add length, 4. Switch to Head tab, 5. Add head circumference | All three tabs have data, each shows the correct percentile, the most recent percentile card reflects the latest measurement for each type |

---

### BB-006: Daily Summary Dashboard

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-006 |
| **Feature Name** | Daily Summary Dashboard |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a sleep-deprived parent, I want to see a single screen summarizing everything that happened today (feedings, sleep, diapers), so that I can quickly assess how the day is going without tapping into multiple screens.

**Secondary:**
> As a co-parent arriving home, I want to glance at the dashboard and know when the last feeding was, how long the baby has been awake, and how many diapers have been changed, so that I can take over caregiving duties seamlessly.

**Tertiary:**
> As a caregiver, I want to see the baby's name, age, and today's activity summary on one screen, so that I can provide a quick status report to parents.

#### 3.3 Detailed Description

The Daily Summary Dashboard is the home screen of the MyBaby module. It is the first screen users see after creating a child profile and the screen they return to most frequently. Its primary purpose is to answer the question every parent asks dozens of times per day: "When did the baby last eat/sleep/get changed, and how much total today?"

The dashboard is organized into a header section and three activity cards (feedings, sleep, diapers), each showing the most recent entry and the daily total. Below the activity cards, a "Quick Actions" row provides one-tap access to the most common actions: log a feeding, start a sleep timer, and log a diaper.

The header displays the active child's photo (or placeholder), name, age string (from BB-001), and the current date. If the child has multiple profiles, tapping the header opens the child switcher.

Each activity card shows:
- **Feedings card:** "Last fed: [time] ([type])" and "Today: [total feeds], [total breast min], [total bottle oz/ml]"
- **Sleep card:** "Last slept: [time] ([duration])" or "Sleeping now: [elapsed time]" if a timer is active, and "Today: [total hours] sleep, [nap count] naps"
- **Diapers card:** "Last changed: [time] ([type])" and "Today: [total diapers] ([wet] wet, [dirty] dirty)"

The daily summary object aggregating all this data is computed as: daily_summary = {total_feeds, total_sleep_hours, total_diapers, last_feed_time, last_sleep_time}. This object refreshes whenever the user returns to the dashboard or when an entry is added/modified/deleted from any activity log.

An optional "Time Since" display shows how long ago each last activity was, in a human-friendly format (e.g., "2h 15m ago"). This updates in real time (every minute) so parents can see at a glance whether it is time for the next feeding or nap.

At the bottom of the dashboard, a 7-day snapshot shows a row of 7 small circles or bar charts (one per day) for each activity type. Each day's indicator is color-coded: green if the day's activity was within age-appropriate norms, amber if slightly below, and no color if insufficient data. This gives a quick weekly trend without requiring navigation to detailed charts.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - the dashboard displays child info and all data is child-specific
- BB-002: Feeding Log - feeding data drives the feeding card and quick action
- BB-003: Sleep Tracking - sleep data drives the sleep card and quick action
- BB-004: Diaper Log - diaper data drives the diaper card and quick action

**External Dependencies:**
- Local storage for querying daily activity data
- System clock for "time since" calculations

**Assumed Capabilities:**
- At least one child profile exists (otherwise the user is in Profile Creation flow)
- The database contains the relevant tables for feedings, sleep, and diapers

#### 3.5 User Interface Requirements

##### Screen: Daily Summary Dashboard

**Layout:**
- **Header:** Child's circular profile photo (40px diameter) on the left, name and age string to the right of the photo, current date ("Thursday, March 6") below the name/age. If multiple profiles exist, a dropdown arrow appears next to the name
- **Activity Cards Section:** Three vertically stacked cards with equal width, separated by 12px gaps:
  - **Feeding Card:** Bottle icon on the left. Two lines of text: "Last: [time] - [type]" and "Today: [total_feeds] feeds | [breast_min] min breast | [bottle_vol] [unit] bottle". A ">" chevron on the right navigates to the Feeding Log
  - **Sleep Card:** Moon icon on the left. Two lines of text: "Last: [time] - [duration]" or "Sleeping: [elapsed]" with a pulsing indicator. "Today: [total_hours] hrs | [nap_count] naps". A ">" chevron navigates to the Sleep Log. If a sleep timer is active, the elapsed time updates every second
  - **Diaper Card:** Diaper icon on the left. Two lines of text: "Last: [time] - [type]" and "Today: [total] diapers | [wet] wet, [dirty] dirty, [both] both". A ">" chevron navigates to the Diaper Log
- **Quick Actions Row:** Three equally-sized buttons arranged horizontally below the activity cards: "Feed" (bottle icon), "Sleep" (moon icon), "Diaper" (diaper icon). These are large tap targets (minimum 48x48 points) designed for one-handed use
- **7-Day Snapshot:** A compact horizontal row showing 7 days (Mon-Sun or the last 7 days). Each day shows three small indicators (one per activity type) as colored dots or mini-bars

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Fresh Profile | Profile just created, no data | All three cards show "No data yet" with calls-to-action. Quick actions are prominent |
| Normal | Data exists for today | Cards show last activity times and daily totals |
| Active Sleep Timer | Sleep session in progress | Sleep card shows pulsing "Sleeping: [elapsed]" with a Wake button integrated into the card |
| Stale Data | More than 4 hours since last feed (for babies < 6 months) | Feeding card shows a subtle amber tint to draw attention. No alarming language |
| Past Midnight | It is past midnight but the user has not logged anything today | Cards show "No entries today yet" with yesterday's last entries shown in a dimmed "Yesterday" section |

**Interactions:**
- Tap the header (child photo/name): opens child switcher (if multiple profiles)
- Tap the ">" chevron on any activity card: navigates to that activity's detailed log
- Tap the activity card itself: same as tapping the chevron (entire card is a tap target)
- Tap "Feed" quick action: opens the Add Feeding bottom sheet (same as BB-002)
- Tap "Sleep" quick action: if no timer active, starts a sleep timer (same as BB-003). If timer active, shows "Wake" confirmation
- Tap "Diaper" quick action: opens the Quick Diaper Log sheet (same as BB-004)
- Pull down to refresh: recalculates all daily totals from the database
- Tap a day in the 7-day snapshot: navigates to that day's view in all activity logs

**Transitions/Animations:**
- "Time Since" values update every 60 seconds with a subtle fade transition
- Active sleep timer updates every second with no animation (just text change)
- Quick action buttons have a press-state animation (scale to 0.95 and back, 100ms)

#### 3.6 Data Requirements

##### Computed Object: DailySummary

This is not a persisted entity but a computed object assembled from other entities on each dashboard render.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| child_id | string | Active profile | The child being summarized |
| date | date | Current date (local timezone) | The day being summarized |
| total_feeds | integer | COUNT of FeedingLog entries for date | Total feeding sessions today |
| total_breast_minutes | float | SUM(duration_minutes) from breast FeedingLog entries | Total breastfeeding time |
| total_bottle_volume_ml | float | SUM(volume_ml) from bottle FeedingLog entries | Total bottle volume |
| total_solid_sessions | integer | COUNT of solid FeedingLog entries | Solid food sessions |
| last_feed_time | datetime | MAX(timestamp) from FeedingLog | Most recent feeding time |
| last_feed_type | string | feeding_type from the most recent FeedingLog | Type of the last feeding |
| total_sleep_hours | float | SUM of sleep durations (proportional) | Total sleep hours today |
| nap_count | integer | COUNT of nap SleepLog entries starting today | Number of naps |
| last_sleep_time | datetime | MAX(end_time) or start_time if active | Most recent sleep event time |
| sleep_active | boolean | EXISTS SleepLog with end_time IS NULL | Whether a sleep timer is active |
| sleep_elapsed_minutes | float | If active: now() - active session start_time | Elapsed sleep time |
| total_diapers | integer | COUNT of DiaperLog entries for date | Total diaper changes |
| wet_count | integer | COUNT of wet DiaperLog entries | Wet diapers |
| dirty_count | integer | COUNT of dirty DiaperLog entries | Dirty diapers |
| both_count | integer | COUNT of both DiaperLog entries | Both-type diapers |
| last_diaper_time | datetime | MAX(timestamp) from DiaperLog | Most recent diaper change time |
| last_diaper_type | string | diaper_type from most recent DiaperLog | Type of last diaper |

**Refresh Triggers:**
- Dashboard screen comes into focus (foreground/tab switch)
- Any activity is logged, edited, or deleted
- Pull-to-refresh gesture
- Every 60 seconds for "time since" display

#### 3.7 Business Logic Rules

##### Daily Summary Computation

**Purpose:** Assemble the complete daily summary for the dashboard.

**Inputs:**
- child_id: string - the active child
- date: date - the date to summarize (usually today)

**Logic:**

```
1. Query feeding totals (reuse BB-002 Daily Feeding Totals logic)
2. Query sleep totals (reuse BB-003 Daily Sleep Summary logic)
3. Query diaper totals (reuse BB-004 Daily Diaper Totals logic)
4. Find last events:
     last_feed = SELECT * FROM FeedingLog WHERE child_id = child_id ORDER BY timestamp DESC LIMIT 1
     last_sleep = SELECT * FROM SleepLog WHERE child_id = child_id ORDER BY start_time DESC LIMIT 1
     last_diaper = SELECT * FROM DiaperLog WHERE child_id = child_id ORDER BY timestamp DESC LIMIT 1
5. Check for active sleep:
     active_sleep = SELECT * FROM SleepLog WHERE child_id = child_id AND end_time IS NULL LIMIT 1
6. Assemble DailySummary object from all above queries
7. RETURN DailySummary
```

**Edge Cases:**
- No data exists for any activity: all counts are 0, "last" fields are null, display "No data yet" messages
- Last feeding was yesterday: show "Yesterday at [time]" in the last feed display and the "time since" value (which may be many hours)
- Sleep timer is active: last_sleep_time shows the start of the current session, sleep_elapsed_minutes ticks up in real time

##### Time Since Formatting

**Purpose:** Format the elapsed time since an event in a human-readable way.

**Inputs:**
- event_time: datetime - when the event occurred
- now: datetime - the current time

**Logic:**

```
1. elapsed_minutes = (now - event_time) in minutes
2. IF elapsed_minutes < 1 THEN RETURN "Just now"
3. IF elapsed_minutes < 60 THEN RETURN "{elapsed_minutes}m ago"
4. IF elapsed_minutes < 1440 THEN
     hours = floor(elapsed_minutes / 60)
     mins = elapsed_minutes mod 60
     RETURN "{hours}h {mins}m ago"
5. IF elapsed_minutes < 2880 THEN RETURN "Yesterday"
6. days = floor(elapsed_minutes / 1440)
   RETURN "{days} days ago"
```

##### Stale Feed Detection

**Purpose:** Determine if the parent should be gently reminded that it has been a while since the last feeding.

**Inputs:**
- last_feed_time: datetime - when the last feeding occurred
- child_age_in_months: float - the child's age in months
- now: datetime - the current time

**Logic:**

```
1. elapsed_hours = (now - last_feed_time) in hours
2. IF child_age_in_months < 6 AND elapsed_hours >= 4 THEN
     RETURN { stale: true, message: "It has been {elapsed_hours}h since the last feeding" }
3. IF child_age_in_months >= 6 AND elapsed_hours >= 6 THEN
     RETURN { stale: true }
4. RETURN { stale: false }
```

**Edge Cases:**
- No feedings at all: do not show a stale indicator (the "No data yet" state is sufficient)
- Last feed was "just now": stale = false
- The stale indicator is informational only, never alarming. Use amber tint, not red

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database query fails when loading dashboard | Error card in the affected section: "Could not load [feeding/sleep/diaper] data." | Pull-to-refresh to retry |
| All queries fail | Full-screen error: "Could not load today's data. Please try again." with a Retry button | Tap Retry to re-query |
| Active sleep timer data is inconsistent (start_time in the future) | Ignore the invalid session, do not display an active timer | Background cleanup: delete or correct the invalid session |
| No active child profile found | Redirect to Profile Creation screen | User creates a profile |

**Validation Timing:**
- Dashboard data is validated on load and refresh
- Invalid data (e.g., negative durations, future timestamps) is silently filtered from totals

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged 5 feedings, 2 naps, and 6 diapers today,
   **When** the user opens the Dashboard,
   **Then** the feeding card shows "5 feeds", the sleep card shows the total hours from the 2 naps, and the diaper card shows "6 diapers".

2. **Given** the last feeding was 2 hours and 15 minutes ago,
   **When** the user views the Dashboard,
   **Then** the feeding card shows "Last: [time] - [type]" and "2h 15m ago".

3. **Given** a sleep timer is currently active and has been running for 45 minutes,
   **When** the user views the Dashboard,
   **Then** the sleep card shows "Sleeping: 0h 45m" with a pulsing indicator, and the elapsed time updates every second.

4. **Given** the user taps the "Feed" quick action,
   **When** the Add Feeding bottom sheet opens,
   **Then** the user can log a feeding and the dashboard updates immediately after save.

**Edge Cases:**

5. **Given** a brand-new profile with no data,
   **When** the user views the Dashboard,
   **Then** all three cards show "No data yet" messages, and the quick actions are prominently displayed.

6. **Given** it is 2:00 AM and no entries exist for the new day yet,
   **When** the user views the Dashboard,
   **Then** today's cards show "No entries today yet", and a dimmed "Yesterday" section shows the last entries from the previous day.

**Negative Tests:**

7. **Given** the database is corrupted and queries fail,
   **When** the user views the Dashboard,
   **Then** error cards are shown for the affected sections with a pull-to-refresh option.

8. **Given** an active sleep session has a start_time in the future (data corruption),
   **When** the Dashboard loads,
   **Then** the invalid session is ignored and no active timer is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| formats time since just now | elapsed: 0 minutes | "Just now" |
| formats time since in minutes | elapsed: 35 minutes | "35m ago" |
| formats time since in hours and minutes | elapsed: 135 minutes | "2h 15m ago" |
| formats time since yesterday | elapsed: 1500 minutes | "Yesterday" |
| formats time since in days | elapsed: 4320 minutes | "3 days ago" |
| detects stale feed for newborn | last_feed: 4.5 hours ago, age: 2 months | stale: true |
| no stale for recent feed | last_feed: 2 hours ago, age: 2 months | stale: false |
| no stale for older baby with 5h gap | last_feed: 5 hours ago, age: 8 months | stale: false |
| detects stale for older baby at 6h | last_feed: 6 hours ago, age: 8 months | stale: true |
| no stale when no feedings exist | last_feed: null | stale: false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Dashboard reflects newly added feeding | 1. View dashboard (0 feeds), 2. Tap Feed, 3. Log a feeding, 4. Return to dashboard | Feeding card now shows "1 feed" and "Last: [time]" |
| Dashboard reflects deleted diaper | 1. View dashboard (5 diapers), 2. Navigate to diaper log, 3. Delete one, 4. Return to dashboard | Diaper card shows "4 diapers" |
| Active sleep timer shows on dashboard | 1. Start sleep timer from dashboard, 2. Dashboard shows active timer | Sleep card shows "Sleeping: [elapsed]" with pulsing indicator |
| Child switch refreshes dashboard | 1. Log data for child A, 2. Switch to child B (no data), 3. View dashboard | Dashboard shows "No data yet" for child B, not child A's data |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent uses dashboard as daily command center | 1. Open MyBaby, 2. Quick-log a diaper, 3. Start sleep timer, 4. After nap, tap Wake, 5. Quick-log a feeding, 6. Check dashboard | Dashboard shows 1 diaper, 1 nap with correct duration, 1 feeding. All "time since" values are accurate |
| Co-parent reviews the day | 1. Open MyBaby (other parent has been logging all day), 2. View dashboard | All activity cards show accurate totals, last events, and time-since values reflecting the other parent's logs |

---

### BB-007: Milestone Tracking (CDC Schedule)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-007 |
| **Feature Name** | Milestone Tracking (CDC Schedule) |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a parent, I want to see a checklist of age-appropriate developmental milestones for my child, so that I know what to look for and can celebrate each achievement.

**Secondary:**
> As an anxious first-time parent, I want to understand which milestones are expected at my baby's age and which are normal to reach later, so that I do not worry unnecessarily about my child's development.

**Tertiary:**
> As a parent of multiple children, I want to compare when each child reached key milestones, so that I can appreciate their individual development timelines.

#### 3.3 Detailed Description

Milestone Tracking provides a structured checklist of developmental milestones based on the CDC (Centers for Disease Control and Prevention) developmental milestone schedule. The milestones are organized by age period and developmental domain, covering the critical first 5 years of life.

The CDC milestone schedule defines expected milestones at these age checkpoints: 2 months, 4 months, 6 months, 9 months, 12 months (1 year), 15 months, 18 months, 24 months (2 years), 30 months, 36 months (3 years), 48 months (4 years), and 60 months (5 years). At each checkpoint, milestones are categorized into four domains: social/emotional, language/communication, cognitive, and movement/physical development.

Key CDC milestones by age include:
- **2 months:** Social smile, tracks objects with eyes, holds head up during tummy time
- **4 months:** Reaches for toys, laughs, pushes up on elbows during tummy time
- **6 months:** Sits without support, babbles with vowel sounds, transfers objects between hands
- **9 months:** Points at objects, pulls to stand with support, understands "no"
- **12 months:** Walks with or without support, says 1-2 words, uses simple gestures (waving)
- **15 months:** Stacks 2 blocks, walks independently, says 3+ words
- **18 months:** Runs, says 10+ words, feeds self with spoon
- **24 months:** Says 2-word sentences, kicks a ball, follows 2-step instructions

The milestone list screen shows the current age period's milestones prominently, with upcoming and past milestones accessible by scrolling. Each milestone has a checkbox, a title, a brief description of what it looks like in practice, and optional fields for the date achieved and a photo or note. Milestones are not pass/fail assessments. The interface avoids any judgmental language. Milestones not yet reached within their expected window are shown as "upcoming" rather than "overdue."

A "milestones achieved" progress indicator shows how many milestones have been checked off for the current age period (e.g., "5 of 8 milestones for 4 months"). An "Act Early" informational section (based on CDC's "Learn the Signs. Act Early." program) provides guidance on when to discuss concerns with a pediatrician. This is presented as factual information, never as a diagnostic or alarming alert.

The milestone reference data (descriptions, age windows, domains) is bundled locally with the app. No network request is made. Parents' milestone tracking data (dates achieved, photos, notes) stays entirely on-device.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - milestones are age-dependent and associated with a specific child

**External Dependencies:**
- Bundled CDC milestone reference data (included in app assets, no network required)
- Local storage for persisting milestone achievement records
- Device camera or photo library access for milestone photos (optional)

**Assumed Capabilities:**
- An active child profile exists with date of birth set
- The child's current age can be computed from the date of birth

#### 3.5 User Interface Requirements

##### Screen: Milestone List

**Layout:**
- **Header:** A horizontal progress bar showing milestones achieved for the current age period (e.g., "5/8 at 4 months"). The bar fills proportionally with the module's accent color
- **Age Period Tabs:** A horizontally scrollable row of age period buttons (2mo, 4mo, 6mo, 9mo, 12mo, 15mo, 18mo, 24mo, 30mo, 36mo, 48mo, 60mo). The current age period is highlighted and centered. Past periods are styled as completed (dimmed or with a checkmark if all milestones are achieved). Future periods are accessible but styled as "upcoming"
- **Domain Sections:** Below the age tabs, milestones for the selected age period are grouped into four collapsible sections by domain:
  - Social/Emotional (heart icon)
  - Language/Communication (speech bubble icon)
  - Cognitive (lightbulb icon)
  - Movement/Physical (running figure icon)
- Each section header shows the domain name, icon, and a count of achieved milestones in that domain (e.g., "2/3")
- **Milestone Items:** Each milestone in a section shows:
  - A circular checkbox (empty for not achieved, filled with a checkmark for achieved)
  - The milestone title (e.g., "Social smile")
  - A brief description (e.g., "Smiles in response to your smile or voice, not just a reflex")
  - If achieved: the date achieved and a small photo thumbnail (if a photo was attached)
  - Tapping the checkbox toggles the achieved state
  - Tapping the milestone title/description opens the Milestone Detail screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Current Period | Viewing the age period matching the child's current age | All milestones shown with prominent checkboxes, progress bar shows current achievement count |
| Past Period (Complete) | All milestones achieved for a past period | Period tab shows a completion checkmark, milestones all checked |
| Past Period (Incomplete) | Some milestones not checked for a past period | Milestones not achieved are shown with a "Not yet" label rather than any alarming indicator |
| Future Period | Viewing a period the child has not reached yet | Milestones shown as a preview in a dimmed style with "Upcoming" label. Checkboxes are not tappable. Users can read descriptions but not check them off before the child reaches that age |
| No Milestones Checked | First time viewing, nothing achieved yet | All checkboxes empty, progress bar at 0%, encouraging message: "Check off milestones as your baby achieves them" |

**Interactions:**
- Tap an age period tab: scrolls the milestone list to show that period's milestones
- Tap a milestone checkbox: toggles achieved/not-achieved. If marking as achieved, prompts for date (defaults to today) and optional photo
- Tap a milestone title: navigates to the Milestone Detail screen
- Long press a milestone: opens a context menu with "Add Photo", "Add Note", "Mark Not Achieved" (if currently achieved)
- Swipe the age tabs left/right: scrolls through age periods

**Transitions/Animations:**
- Checking a milestone: checkbox fills with a pop animation (scale 1.0 > 1.2 > 1.0, 200ms) and the progress bar smoothly fills
- Unchecking: checkbox empties with a reverse pop, progress bar shrinks
- Age period tab scrolling: smooth horizontal scroll with snap-to-center behavior

##### Screen: Milestone Detail

**Layout:**
- The milestone title in large text at the top
- Domain label and age period label below the title
- A detailed description section (2-3 sentences) explaining what this milestone looks like and how to encourage it
- "Date Achieved" field: a date picker, defaults to today when first setting, editable
- "Photo" section: shows the attached photo if one exists, or a "Add Photo" button
- "Notes" section: a text area for parent notes (max 500 characters)
- If the milestone is part of the "Act Early" list, an informational banner: "The CDC recommends discussing with your pediatrician if this milestone is not observed by [age + buffer]"
- A "Save" button if any changes were made

#### 3.6 Data Requirements

##### Entity: MilestoneRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this record belongs to |
| milestone_id | string | Required, references a bundled milestone definition | None | Which milestone this tracks (e.g., "2mo_social_smile") |
| achieved | boolean | - | false | Whether the child has demonstrated this milestone |
| achieved_date | date | Must not be before child's date of birth, must not be in the future | null | When the milestone was first observed |
| photo_uri | string | Optional, max 500 characters | null | Local file path to a milestone photo |
| notes | string | Optional, max 500 characters | null | Parent notes about this milestone |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- MilestoneRecord belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, milestone_id) - unique composite index (one record per child per milestone)
- (child_id, achieved) - for querying achieved milestones per child

**Validation Rules:**
- milestone_id: must reference a valid bundled milestone definition
- achieved_date: if provided, must not be before the child's date of birth and must not be in the future
- Only one MilestoneRecord per child per milestone_id (upsert on second save)

##### Reference Entity: MilestoneDefinition (Bundled, Read-Only)

| Field | Type | Description |
|-------|------|-------------|
| milestone_id | string | Unique identifier (e.g., "2mo_social_smile") |
| age_months | integer | Age period in months (2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60) |
| domain | enum | One of: "social_emotional", "language_communication", "cognitive", "movement_physical" |
| title | string | Short name (e.g., "Social smile") |
| description | string | Detailed description of what the milestone looks like |
| encouragement | string | Tips for encouraging this milestone |
| act_early_flag | boolean | Whether this milestone is flagged for "Act Early" guidance |
| act_early_age_months | integer | Age by which to discuss with a pediatrician if not observed (null if not flagged) |
| sort_order | integer | Display order within the age period and domain |

**Example Data:**

```
{
  "milestone_id": "2mo_social_smile",
  "age_months": 2,
  "domain": "social_emotional",
  "title": "Social smile",
  "description": "Smiles in response to your smile, voice, or face. This is a true social smile, not a reflex smile.",
  "encouragement": "Smile and talk to your baby face-to-face. Respond to their coos and gurgles with smiles.",
  "act_early_flag": true,
  "act_early_age_months": 4,
  "sort_order": 1
}
```

#### 3.7 Business Logic Rules

##### Current Age Period Determination

**Purpose:** Determine which age period to display as "current" for the child.

**Inputs:**
- child_age_in_months: float - the child's current age

**Logic:**

```
1. Define age_periods = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60]
2. Find the most recent age period the child has reached:
     current_period = the largest value in age_periods that is <= child_age_in_months
3. IF child_age_in_months < 2 THEN
     current_period = 2 (show 2-month milestones as upcoming)
4. IF child_age_in_months > 60 THEN
     current_period = 60 (stay on the 60-month period)
5. RETURN current_period
```

**Edge Cases:**
- Child younger than 2 months: show 2-month milestones as the current period with an "upcoming" label
- Child between periods (e.g., 3 months): show the 2-month period as current (most recently reached)
- Child older than 5 years: show the 60-month period as current with all milestones

##### Milestone Progress Calculation

**Purpose:** Calculate the number and percentage of milestones achieved for a given age period.

**Inputs:**
- child_id: string - the active child
- age_period: integer - the age period in months

**Logic:**

```
1. total_milestones = COUNT of MilestoneDefinition entries where age_months = age_period
2. achieved_milestones = COUNT of MilestoneRecord entries where child_id matches AND milestone_id references a MilestoneDefinition with age_months = age_period AND achieved = true
3. percentage = (achieved_milestones / total_milestones) * 100
4. RETURN {
     achieved: achieved_milestones,
     total: total_milestones,
     percentage: round(percentage, 0)
   }
```

**Edge Cases:**
- No milestones achieved: percentage = 0
- All achieved: percentage = 100
- total_milestones = 0 (should not happen with bundled data): return percentage = 0

##### Act Early Alert Determination

**Purpose:** Determine whether to show the "Act Early" informational banner for a specific milestone.

**Inputs:**
- milestone: MilestoneDefinition - the milestone to check
- child_age_in_months: float - the child's current age
- achieved: boolean - whether the milestone has been achieved

**Logic:**

```
1. IF milestone.act_early_flag = false THEN RETURN { show: false }
2. IF achieved = true THEN RETURN { show: false }
3. IF child_age_in_months >= milestone.act_early_age_months THEN
     RETURN {
       show: true,
       message: "The CDC recommends discussing with your pediatrician if this milestone is not observed by {act_early_age_months} months."
     }
4. RETURN { show: false }
```

**Edge Cases:**
- Milestone is achieved: never show the Act Early banner, regardless of child's age
- Child is exactly at the act_early_age_months: show the banner (inclusive)
- The banner is informational only, never diagnostic or alarming

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails when saving milestone | Toast: "Could not save milestone. Please try again." | User retries |
| Photo selection fails | Toast: "Could not access photos. Check permissions in Settings." | User grants permission and retries |
| Milestone date set before child's birth | Inline validation: "Date cannot be before baby's birth date" | User selects a valid date |
| Milestone date set in the future | Inline validation: "Date cannot be in the future" | User selects a valid date |
| Bundled milestone data is missing (app packaging error) | Error screen: "Milestone data could not be loaded. Please reinstall the app." | User reinstalls or updates the app |

**Validation Timing:**
- Date validation runs immediately on date picker selection
- Milestone toggle (check/uncheck) saves immediately with optimistic UI

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a child who is 4 months old,
   **When** the user opens the Milestone screen,
   **Then** the 4-month age period tab is highlighted, and the milestones for 4 months are displayed grouped by domain with empty checkboxes.

2. **Given** the user is viewing the 4-month milestones,
   **When** the user taps the checkbox for "Reaches for toys",
   **Then** a date picker appears (defaulting to today), the user confirms, the checkbox fills with an animation, and the progress bar updates from "2/8" to "3/8".

3. **Given** the user has checked all milestones for the 2-month period,
   **When** the user views the age period tabs,
   **Then** the 2-month tab shows a completion checkmark.

4. **Given** a milestone has the "Act Early" flag and the child is 6 months old but the 4-month milestone "Tracks moving objects" has not been achieved,
   **When** the user views that milestone,
   **Then** an informational banner says "The CDC recommends discussing with your pediatrician if this milestone is not observed by 4 months."

**Edge Cases:**

5. **Given** a child who is 3 weeks old (younger than the first milestone period),
   **When** the user opens the Milestone screen,
   **Then** the 2-month period is shown as "upcoming" with all milestones visible but checkboxes not tappable. A message says "These milestones are expected around 2 months."

6. **Given** a child who is 7 months old (between the 6-month and 9-month periods),
   **When** the user opens the Milestone screen,
   **Then** the 6-month period is shown as current, and the 9-month period is accessible but labeled "upcoming."

**Negative Tests:**

7. **Given** the user is marking a milestone as achieved,
   **When** the user selects a date before the child's birth date,
   **Then** the system shows "Date cannot be before baby's birth date" and does not save.

8. **Given** the user is viewing a future age period's milestones,
   **When** the user tries to tap a checkbox,
   **Then** nothing happens (checkboxes are disabled for future periods).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| determines current period for 4-month-old | age: 4.0 months | current_period: 4 |
| determines current period for 3-month-old (between periods) | age: 3.0 months | current_period: 2 |
| determines current period for 1-month-old | age: 1.0 months | current_period: 2 (upcoming) |
| determines current period for 5-year-old | age: 62 months | current_period: 60 |
| calculates milestone progress | 5 achieved out of 8 total | { achieved: 5, total: 8, percentage: 63 } |
| calculates 0% progress | 0 achieved out of 8 total | { achieved: 0, total: 8, percentage: 0 } |
| calculates 100% progress | 8 achieved out of 8 total | { achieved: 8, total: 8, percentage: 100 } |
| shows Act Early for unachieved flagged milestone past threshold | act_early_flag: true, act_early_age: 4, child_age: 5, achieved: false | show: true |
| hides Act Early for achieved milestone | act_early_flag: true, achieved: true | show: false |
| hides Act Early before threshold age | act_early_flag: true, act_early_age: 4, child_age: 3 | show: false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Check a milestone and verify progress | 1. Open milestones, 2. Tap checkbox for "Social smile", 3. Confirm date | Checkbox fills, progress bar updates, milestone record saved in database |
| Uncheck a milestone | 1. Check a milestone, 2. Long press, 3. Select "Mark Not Achieved" | Checkbox empties, progress bar decreases, achieved_date cleared |
| Add photo to milestone | 1. Open milestone detail, 2. Tap "Add Photo", 3. Select from library | Photo appears on milestone detail and as a thumbnail in the list |
| Navigate between age periods | 1. View 4-month milestones, 2. Tap 6-month tab | List updates to show 6-month milestones, progress bar reflects 6-month progress |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent tracks first 4 months of milestones | 1. Check off 2-month milestones over weeks, 2. At 4 months, view 4-month milestones, 3. Check some off | 2-month tab shows completion status, 4-month tab shows progress, upcoming tabs are visible |
| Parent reviews milestones at pediatrician visit | 1. Open milestones at 6-month visit, 2. Go through checklist with doctor, 3. Mark achieved/not-achieved, 4. Add notes for items discussed | All milestones have accurate status, notes recorded, Act Early banners visible for any flagged items |

---

### BB-008: Vaccination Schedule (CDC)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-008 |
| **Feature Name** | Vaccination Schedule (CDC) |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a parent, I want to see which vaccinations my baby needs and when they are due based on the CDC schedule, so that I can ensure my baby stays up-to-date on immunizations.

**Secondary:**
> As a parent preparing for a pediatrician visit, I want to know which vaccines are due at this appointment, so that I can discuss them with the doctor and keep accurate records.

**Tertiary:**
> As a parent tracking immunization records, I want to log when each vaccine dose was administered, so that I have a complete vaccination history on my device.

#### 3.3 Detailed Description

Vaccination Schedule provides a checklist of recommended childhood vaccinations based on the CDC immunization schedule for children birth through 6 years. The schedule is pre-loaded and displayed as a timeline relative to the child's date of birth. Parents can mark each dose as administered with the date, creating a complete on-device vaccination record.

The CDC recommended vaccination schedule includes these vaccines and dose timings:

- **HepB (Hepatitis B):** 3 doses - birth, 1 month, 6-18 months
- **RV (Rotavirus):** 2-3 doses (depending on brand) - 2 months, 4 months, 6 months (if 3-dose series)
- **DTaP (Diphtheria, Tetanus, Pertussis):** 5 doses - 2 months, 4 months, 6 months, 15-18 months, 4-6 years
- **Hib (Haemophilus influenzae type b):** 3-4 doses - 2 months, 4 months, 6 months (if 4-dose series), 12-15 months
- **PCV13 (Pneumococcal conjugate):** 4 doses - 2 months, 4 months, 6 months, 12-15 months
- **IPV (Inactivated Poliovirus):** 4 doses - 2 months, 4 months, 6-18 months, 4-6 years
- **Flu (Influenza):** annual - starting at 6 months, yearly
- **MMR (Measles, Mumps, Rubella):** 2 doses - 12-15 months, 4-6 years
- **VAR (Varicella/Chickenpox):** 2 doses - 12-15 months, 4-6 years
- **HepA (Hepatitis A):** 2 doses - 12-23 months (dose 1), 6 months after dose 1 (dose 2)

The vaccination screen organizes vaccines by age period to align with typical well-child visit schedules: birth, 2 months, 4 months, 6 months, 12-15 months, 18 months, 4-6 years, and annual (flu). For each vaccine dose, the screen shows the vaccine name, dose number, the recommended age window, and whether it has been administered. Due dates are computed relative to the child's date of birth.

A "next due" indicator shows which vaccines are coming up next. For example, if the child is 3 months old and has received their 2-month vaccines, the indicator shows "Next vaccines due: 4 months ([computed date])."

The vaccine reference data (names, schedules, dose counts, age windows) is bundled locally. No network request is made. Vaccination records (dates administered, lot numbers, notes) stay entirely on-device. This feature does not transmit vaccination data to any external system, health registry, or government database.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - vaccination schedules are computed from the child's date of birth

**External Dependencies:**
- Bundled CDC vaccination schedule reference data (included in app assets, no network required)
- Local storage for persisting vaccination records

**Assumed Capabilities:**
- An active child profile exists with date of birth set

#### 3.5 User Interface Requirements

##### Screen: Vaccination Schedule

**Layout:**
- **Next Due Banner:** At the top, a prominent card showing the next upcoming vaccination(s). Displays: "Due at [age]: [vaccine names]" and the computed date based on the child's date of birth. If the child is past the due window, the card shows an amber "Overdue" label (informational, not alarming)
- **Progress Summary:** Below the banner, a progress bar showing total doses administered out of total doses in the schedule (e.g., "12/32 doses administered")
- **Age Period Sections:** The main content is organized into collapsible sections by age period (Birth, 2 Months, 4 Months, 6 Months, 12-15 Months, 18 Months, 4-6 Years, Annual). Each section header shows the age period label, the computed date window for the child (e.g., "2 Months: Due around [child's DOB + 2 months]"), and a count of doses administered in that period
- **Vaccine Dose Items:** Within each section, each vaccine dose shows:
  - A circular checkbox (empty for not administered, filled with checkmark for administered)
  - Vaccine abbreviation and full name (e.g., "DTaP - Diphtheria, Tetanus, Pertussis")
  - Dose number (e.g., "Dose 1 of 5")
  - Recommended age window (e.g., "2 months")
  - If administered: the date administered
  - If not administered and past the recommended window: an amber "Overdue" text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Records | No vaccines have been logged yet | All checkboxes empty, next due banner shows birth-dose vaccines |
| Partially Complete | Some doses administered | Administered doses checked, progress bar partially filled |
| Up to Date | All age-appropriate doses administered | Next due banner shows the next future dose, current and past sections fully checked |
| Past Due | One or more doses are past their recommended window and not administered | Amber "Overdue" label on the dose, next due banner highlights the overdue doses |
| Complete | All doses in the schedule administered (rare, occurs after age 6 completion) | Progress bar at 100%, celebratory message |

**Interactions:**
- Tap a vaccine dose checkbox: opens a "Record Vaccination" form with date picker (defaults to today), optional lot number field, optional provider/clinic name, and optional notes
- Tap an administered dose: opens the detail view showing the recorded information
- Long press an administered dose: allows editing or removing the record
- Tap a section header: collapses/expands the section
- Tap the next due banner: scrolls to the section containing the next due vaccines

**Transitions/Animations:**
- Checkbox fill animation: same pop effect as milestones (scale 1.0 > 1.2 > 1.0, 200ms)
- Section collapse/expand: smooth height animation, 250ms
- Progress bar fills smoothly when a dose is recorded, 300ms

##### Bottom Sheet: Record Vaccination

**Layout:**
- Vaccine name and dose number displayed at the top (read-only, set by which checkbox was tapped)
- Date administered: date picker, defaults to today, cannot be in the future, cannot be before child's date of birth
- Lot number: optional text input, max 50 characters
- Provider/clinic name: optional text input with autocomplete from previously entered values, max 200 characters
- Notes: optional text area, max 300 characters
- Save button at the bottom

#### 3.6 Data Requirements

##### Entity: VaccinationRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this record belongs to |
| vaccine_dose_id | string | Required, references a bundled vaccine dose definition | None | Which specific dose this records (e.g., "dtap_dose_1") |
| administered | boolean | - | false | Whether this dose has been given |
| administered_date | date | Must not be in the future, must not be before child's date of birth | null | Date the vaccine was administered |
| lot_number | string | Optional, max 50 characters | null | Vaccine lot number from the vial |
| provider_name | string | Optional, max 200 characters | null | Name of the provider or clinic |
| notes | string | Optional, max 300 characters | null | Any additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- VaccinationRecord belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, vaccine_dose_id) - unique composite index (one record per child per dose)
- (child_id, administered) - for querying administered doses

**Validation Rules:**
- vaccine_dose_id: must reference a valid bundled vaccine dose definition
- administered_date: if provided, must not be in the future and must not be before the child's date of birth
- Only one VaccinationRecord per child per vaccine_dose_id

##### Reference Entity: VaccineDoseDefinition (Bundled, Read-Only)

| Field | Type | Description |
|-------|------|-------------|
| vaccine_dose_id | string | Unique identifier (e.g., "dtap_dose_1") |
| vaccine_code | string | Vaccine abbreviation (e.g., "DTaP") |
| vaccine_name | string | Full vaccine name (e.g., "Diphtheria, Tetanus, and Pertussis") |
| dose_number | integer | Which dose in the series (e.g., 1, 2, 3) |
| total_doses | integer | Total doses in the series (e.g., 5 for DTaP) |
| age_period | string | Age period label (e.g., "2 months", "4-6 years") |
| min_age_days | integer | Minimum age in days for this dose |
| max_age_days | integer | Maximum recommended age in days for this dose |
| sort_order | integer | Display order within the age period |

**Example Data:**

```
{
  "vaccine_dose_id": "dtap_dose_1",
  "vaccine_code": "DTaP",
  "vaccine_name": "Diphtheria, Tetanus, and Pertussis",
  "dose_number": 1,
  "total_doses": 5,
  "age_period": "2 months",
  "min_age_days": 42,
  "max_age_days": 90,
  "sort_order": 3
}
```

#### 3.7 Business Logic Rules

##### Due Date Computation

**Purpose:** Compute when each vaccine dose is due for a specific child.

**Inputs:**
- child_date_of_birth: date - the child's date of birth
- vaccine_dose: VaccineDoseDefinition - the dose to compute the due date for

**Logic:**

```
1. due_date_earliest = child_date_of_birth + vaccine_dose.min_age_days
2. due_date_latest = child_date_of_birth + vaccine_dose.max_age_days
3. RETURN {
     earliest: due_date_earliest,
     latest: due_date_latest,
     label: vaccine_dose.age_period,
     is_overdue: today > due_date_latest AND dose is not administered,
     is_due_now: today >= due_date_earliest AND today <= due_date_latest AND dose is not administered,
     is_upcoming: today < due_date_earliest AND dose is not administered,
     is_complete: dose is administered
   }
```

##### Next Due Determination

**Purpose:** Find the next upcoming vaccination doses for the child.

**Inputs:**
- child_id: string - the active child
- today: date - the current date

**Logic:**

```
1. Get all VaccineDoseDefinitions
2. Get all VaccinationRecords for this child where administered = true
3. Filter to unrecorded doses (no matching VaccinationRecord with administered = true)
4. Compute due_date_earliest for each remaining dose
5. Sort by due_date_earliest ascending
6. Group doses with the same age_period that are due at the same time
7. RETURN the first group (the earliest due doses)
```

**Edge Cases:**
- All doses administered: return "All vaccinations up to date!" message
- Multiple doses due at the same visit (e.g., 2-month vaccines include DTaP, PCV13, IPV, etc.): group them together in the next due banner
- Overdue doses: they appear first before upcoming doses

##### Progress Calculation

**Purpose:** Calculate overall vaccination progress.

**Inputs:**
- child_id: string - the active child

**Logic:**

```
1. total_doses = COUNT of all VaccineDoseDefinitions
2. administered_doses = COUNT of VaccinationRecords where child_id matches AND administered = true
3. percentage = (administered_doses / total_doses) * 100
4. RETURN {
     administered: administered_doses,
     total: total_doses,
     percentage: round(percentage, 0)
   }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails when recording vaccination | Toast: "Could not save vaccination record. Please try again." | User retries |
| Date set in the future | Inline validation: "Date cannot be in the future" | User selects a valid date |
| Date set before child's birth | Inline validation: "Date cannot be before baby's birth date" | User selects a valid date |
| Duplicate record for same dose | If user tries to record a dose already administered: "This dose has already been recorded on [date]. Would you like to update it?" with Update and Cancel | User chooses to update or cancel |
| Bundled vaccine schedule data missing | Error screen: "Vaccination data could not be loaded. Please reinstall the app." | User reinstalls |

**Validation Timing:**
- Date validation runs immediately on picker selection
- Duplicate check runs when user taps a checkbox that already has a record

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a child born on 2026-01-15,
   **When** the user opens the Vaccination Schedule on 2026-03-06 (child is ~7 weeks old),
   **Then** the "Next Due" banner shows "Due at 2 months: DTaP, PCV13, IPV, Hib, RV" with due date around mid-March.

2. **Given** the user taps the checkbox for "HepB Dose 1",
   **When** the Record Vaccination sheet appears and the user sets the date to 2026-01-15 (birth) and taps Save,
   **Then** the checkbox fills, the progress bar updates, and the dose shows "Administered: 01/15/2026" in the list.

3. **Given** 3 out of 32 total doses have been recorded,
   **When** the user views the progress summary,
   **Then** it shows "3/32 doses administered" with the bar at approximately 9%.

4. **Given** the child is 14 months old and the 12-15 month vaccines are due,
   **When** the user views the schedule,
   **Then** the 12-15 month section is highlighted, and the doses in that section show "Due now".

**Edge Cases:**

5. **Given** the child is 8 months old and the 6-month HepB dose was not administered,
   **When** the user views the schedule,
   **Then** the HepB dose shows an amber "Overdue" label (informational, not alarming).

6. **Given** all age-appropriate doses have been administered for a 10-month-old,
   **When** the user views the schedule,
   **Then** the "Next Due" banner shows the 12-15 month vaccines with their computed date.

**Negative Tests:**

7. **Given** the user is recording a vaccination,
   **When** the user sets the date to a future date,
   **Then** the system shows "Date cannot be in the future" and does not save.

8. **Given** a dose has already been recorded,
   **When** the user taps the checkbox again,
   **Then** the system shows "This dose has already been recorded" and offers to update rather than creating a duplicate.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes due date for 2-month vaccine | DOB: 2026-01-15, min_age_days: 42 | earliest: 2026-02-26 |
| computes due date range | DOB: 2026-01-15, min: 42, max: 90 | earliest: 2026-02-26, latest: 2026-04-15 |
| detects overdue dose | DOB: 2026-01-15, max_age_days: 90, today: 2026-05-01, not administered | is_overdue: true |
| detects due now dose | DOB: 2026-01-15, min: 42, max: 90, today: 2026-03-15, not administered | is_due_now: true |
| detects upcoming dose | DOB: 2026-01-15, min: 42, today: 2026-02-01, not administered | is_upcoming: true |
| detects complete dose | administered: true | is_complete: true regardless of dates |
| groups same-period doses | 5 doses with age_period "2 months" | all 5 grouped together |
| calculates progress | 12 administered of 32 total | { administered: 12, total: 32, percentage: 38 } |
| finds next due (overdue first) | 1 overdue dose + 1 upcoming dose | next due returns the overdue dose |
| handles all doses complete | all 32 administered | next due returns "all up to date" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Record a vaccination and verify progress | 1. Open vaccination schedule, 2. Tap HepB Dose 1 checkbox, 3. Set date, 4. Save | Checkbox fills, progress updates, date displayed on the dose row |
| Update an existing record | 1. Record a dose, 2. Tap the recorded dose, 3. Change the date | Date updates, no duplicate record created |
| Delete a vaccination record | 1. Record a dose, 2. Long press, 3. Select "Remove Record" | Checkbox empties, progress decreases, date removed |
| Verify next due updates | 1. Record all birth doses, 2. Check next due banner | Banner now shows 2-month vaccines |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent tracks first year of vaccinations | 1. Record birth HepB, 2. At 2 months record DTaP/PCV13/IPV/Hib/RV, 3. At 4 months record same set, 4. At 6 months record same set | Progress shows approximately 40-50% complete, next due banner shows 12-15 month vaccines, all recorded doses have dates |
| Parent brings vaccination record to pediatrician visit | 1. Open vaccination schedule before visit, 2. See which vaccines are due, 3. After visit, record all administered vaccines with lot numbers | Complete record with dates and lot numbers, next due updates to reflect remaining schedule |

---

### BB-009: Pumping Log and Timer

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-009 |
| **Feature Name** | Pumping Log and Timer |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a breastfeeding mother who pumps, I want to log each pumping session with duration and output volume, so that I can track my supply and build a freezer stash.

**Secondary:**
> As a working parent who pumps at the office, I want to start a pump timer and record output when finished, so that I can quickly log sessions during my work break without manual time entry.

**Tertiary:**
> As a parent managing a milk stash, I want to see daily and weekly pumping totals, so that I can assess whether my supply is meeting my baby's needs.

#### 3.3 Detailed Description

The Pumping Log tracks breast milk pumping sessions separately from direct breastfeeding (BB-002). While breastfeeding logs track nursing at the breast, pumping logs track expressed milk - a distinct workflow used by mothers who pump at work, who exclusively pump, or who are building a freezer stash alongside nursing.

Each pumping session records: start time, end time (or duration via timer), which side (left, right, or both/double pump), output volume in ounces or milliliters, and optional notes. The primary interaction model mirrors the sleep timer: the user taps "Start Pump", a running timer appears, and when finished the user taps "Stop" and enters the output volume. Alternatively, users can add manual entries after the fact.

A daily summary shows total pumping output (combined across all sessions), number of sessions, and average output per session. A 7-day trend chart displays daily total output as a bar chart so parents can spot supply trends. For mothers who both nurse and pump, the feeding summary on the Daily Summary Dashboard (BB-006) can optionally combine breast minutes and pumped volume for a comprehensive picture.

The pumping log also tracks milk storage. When a pumping session is logged, the user can optionally mark the milk as "stored" with a storage location (fridge or freezer) and the date stored. A simple milk inventory view shows total estimated stored milk volume. When stored milk is used for a bottle feeding, the user can mark it as "used" to decrease the inventory count. The storage tracking is intentionally simple - it tracks estimated totals, not individual bags, because precise bag-level tracking adds complexity without proportional value for most parents.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - pumping sessions are associated with a specific child

**External Dependencies:**
- Local storage for persisting pumping data
- System clock for timer functionality

**Assumed Capabilities:**
- An active child profile exists
- User can navigate to the pumping log from the module navigation

#### 3.5 User Interface Requirements

##### Screen: Pumping Log List

**Layout:**
- A top summary bar showing today's pumping totals: total output (e.g., "18.5 oz"), number of sessions (e.g., "4 sessions"), and average output per session (e.g., "4.6 oz/session")
- Below the summary, a 7-day trend bar chart showing daily total output. Each bar is labeled with the day abbreviation and total volume. The bar height is proportional to the maximum output across the 7 days
- Below the chart, a date selector (same pattern as feeding log)
- The main content area lists pumping entries for the selected day in reverse chronological order. Each entry shows: a pump icon, start time (e.g., "2:35 PM"), duration (e.g., "18 min"), side (e.g., "Both"), and output volume (e.g., "4.5 oz")
- If a pumping timer is currently running, it appears at the top of the list with a pulsing indicator, elapsed time, and a "Stop" button
- A floating action button opens the Add Pumping sheet or starts a timer (configurable in settings)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No pumping sessions for selected day | Illustration of a breast pump with message: "No pumping sessions today. Tap + to log one." |
| Active Timer | A pumping timer is in progress | Top entry shows pulsing pump indicator with running elapsed time and a "Stop" button |
| Populated | Sessions exist, no active timer | Chronological list with summary bar totals |

**Interactions:**
- Tap a pumping entry: opens the Pumping Detail/Edit screen
- Swipe left on an entry: reveals a "Delete" button
- Tap the floating action button: starts a pump timer (start_time = now)
- Tap "Stop" on an active timer: stops the timer, opens a volume entry prompt where the user enters the output amount, then saves the complete session
- Long press the floating action button: opens the Add Pumping sheet for manual entry (without timer)

**Transitions/Animations:**
- Active timer entry pulses with a gentle opacity oscillation (0.7 to 1.0, 2-second cycle), matching the sleep timer pattern
- Volume entry prompt slides up as a bottom sheet after the timer stops, 200ms
- Deleted entries animate out with fade + slide-left, 200ms

##### Bottom Sheet: Volume Entry (Post-Timer)

**Layout:**
- "Session Complete" header with the recorded duration (e.g., "18 minutes")
- Side selector: three buttons "Left", "Right", "Both" (if not selected at start)
- Volume input: numeric input with unit label (oz or ml based on settings), stepper buttons for +/- 0.5 oz (or +/- 10 ml)
- Storage toggle: "Store this milk?" switch. If toggled on, a secondary picker appears with options "Fridge" and "Freezer"
- Notes: optional text area, max 300 characters
- Save button

##### Bottom Sheet: Add Pumping (Manual Entry)

**Layout:**
- Side selector: three buttons "Left", "Right", "Both"
- Start time picker (defaults to 30 minutes ago)
- End time picker (defaults to now)
- Duration display (computed, read-only)
- Volume input: numeric with unit label, stepper buttons
- Storage toggle with fridge/freezer picker
- Notes: optional text area, max 300 characters
- Save button

##### Screen: Milk Storage Inventory

**Layout:**
- A total estimated stored milk volume at the top (e.g., "Total: 48 oz stored")
- Two sub-totals: "Fridge: 12 oz" and "Freezer: 36 oz"
- Below, a list of storage entries in reverse chronological order, each showing: date stored, volume, location (fridge/freezer), and a "Used" button
- Tapping "Used" marks that storage entry as consumed and decreases the total

**Interactions:**
- Tap "Used": confirmation prompt "Mark [X oz] as used?", then updates inventory
- Swipe left on a storage entry: reveals "Delete" to remove the storage record entirely

#### 3.6 Data Requirements

##### Entity: PumpingLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this session is associated with |
| start_time | datetime | Required | None | When pumping started |
| end_time | datetime | Optional (null if timer is in progress) | null | When pumping ended |
| duration_minutes | float | Computed: (end_time - start_time) in minutes | null | Duration in minutes |
| side | enum | One of: "left", "right", "both" | "both" | Which side was pumped |
| volume_ml | float | Min: 0, Max: 1000 | null | Output volume in milliliters |
| storage_location | enum | One of: "fridge", "freezer", null | null | Where the milk was stored (null if not stored) |
| storage_date | date | Optional | null | Date the milk was placed in storage |
| storage_used | boolean | - | false | Whether the stored milk has been consumed |
| storage_used_date | date | Optional | null | Date the stored milk was used |
| notes | string | Optional, max 300 characters | null | Any additional notes |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- PumpingLog belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, start_time) - composite index for chronological listing
- (child_id, storage_location, storage_used) - for milk inventory queries

**Validation Rules:**
- child_id: must reference an existing ChildProfile
- end_time: if provided, must be after start_time
- volume_ml: stored in milliliters. Conversion: 1 oz = 29.5735 ml
- Only one active pumping timer (end_time IS NULL) per child at a time
- storage_date: if provided, must not be in the future
- storage_used_date: if provided, must be on or after storage_date

**Example Data:**

```
{
  "id": "p1a2b3c4-d5e6-7890-abcd-999999999999",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "start_time": "2026-03-06T10:00:00Z",
  "end_time": "2026-03-06T10:18:00Z",
  "duration_minutes": 18,
  "side": "both",
  "volume_ml": 133.1,
  "storage_location": "freezer",
  "storage_date": "2026-03-06",
  "storage_used": false,
  "storage_used_date": null,
  "notes": "Double pump at work",
  "created_at": "2026-03-06T10:18:00Z",
  "updated_at": "2026-03-06T10:18:00Z"
}
```

#### 3.7 Business Logic Rules

##### Daily Pumping Summary

**Purpose:** Calculate summary statistics for pumping on a given day.

**Inputs:**
- child_id: string - the child to compute totals for
- date: date - the day to summarize

**Logic:**

```
1. Query all PumpingLog entries where child_id matches AND start_time falls within the given date
2. total_volume_ml = SUM(volume_ml) for all entries where volume_ml is not null
3. total_sessions = COUNT of all entries
4. avg_volume_ml = total_volume_ml / total_sessions (if total_sessions > 0)
5. total_duration_minutes = SUM(duration_minutes) for all entries where duration_minutes is not null
6. RETURN {
     total_volume_ml,
     total_sessions,
     avg_volume_ml,
     total_duration_minutes
   }
```

**Edge Cases:**
- No pumping sessions: return all zeros
- Volume not entered (null): exclude from total_volume_ml but include in session count
- Active timer (end_time IS NULL): exclude from duration totals, include in session count

##### Milk Storage Inventory

**Purpose:** Calculate the estimated total stored milk volume.

**Inputs:**
- child_id: string - the active child

**Logic:**

```
1. Query all PumpingLog entries where child_id matches AND storage_location is not null AND storage_used = false
2. fridge_total_ml = SUM(volume_ml) where storage_location = "fridge"
3. freezer_total_ml = SUM(volume_ml) where storage_location = "freezer"
4. total_stored_ml = fridge_total_ml + freezer_total_ml
5. RETURN {
     fridge_total_ml,
     freezer_total_ml,
     total_stored_ml
   }
```

**Edge Cases:**
- No stored milk: return all zeros
- All milk used: return all zeros (storage_used = true entries are excluded)
- Volume is null for a stored entry: exclude from totals (should not happen, but handle gracefully)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| User tries to start pump timer while one is already running | Toast: "A pumping session is already in progress. Stop it first." | User stops the current session |
| Volume entered is 0 | Warning (non-blocking): "Are you sure the output was 0 oz? This may indicate an issue." Allow save | User can save 0 or correct the value |
| Database write fails | Toast: "Could not save pumping session. Please try again." | User retries |
| Timer was running when app was force-closed | On next app open, detect orphaned pump sessions. Show prompt: "A pumping session was left running. When did you finish?" with time picker and volume input | User enters end time and volume |
| End time before start time on manual entry | Inline validation: "End time must be after start time" | User corrects the times |

**Validation Timing:**
- Timer state check runs when user taps Start Pump
- Volume validation runs on Save
- Time field validation runs on picker selection for manual entries

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has an active child profile and no pump timer running,
   **When** the user taps the pump floating action button,
   **Then** a pump timer starts showing elapsed time with a pulsing indicator.

2. **Given** a pump timer has been running for 18 minutes,
   **When** the user taps "Stop" and enters 4.5 oz output,
   **Then** the session is saved with 18-minute duration and 133.1 ml volume, and appears in the pumping log.

3. **Given** the user has pumped 3 times today for 4, 5, and 4.5 oz,
   **When** the user views the pumping summary,
   **Then** it shows "13.5 oz total", "3 sessions", "4.5 oz/session average".

4. **Given** the user toggles "Store this milk" and selects "Freezer" after a pump session,
   **When** the session is saved,
   **Then** the milk storage inventory increases by the pumped volume, and the entry shows "Freezer" in the storage list.

**Edge Cases:**

5. **Given** the user pumps but gets 0 oz output,
   **When** the user enters 0 and taps Save,
   **Then** a warning asks if 0 is correct, and the user can confirm to save the session with 0 volume.

6. **Given** stored milk in the fridge (12 oz) and freezer (36 oz),
   **When** the user taps "Used" on a 4 oz fridge entry,
   **Then** fridge total decreases to 8 oz, total stored decreases to 44 oz.

**Negative Tests:**

7. **Given** a pump timer is already running,
   **When** the user tries to start another pump timer,
   **Then** the system shows "A pumping session is already in progress" and does not start a new timer.

8. **Given** the user is adding a manual pump entry,
   **When** the user sets the end time before the start time,
   **Then** the system shows "End time must be after start time" and does not save.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates daily pumping total | 3 sessions: 118.3ml, 147.9ml, 133.1ml | total_volume_ml: 399.3 |
| calculates average per session | total: 399.3ml, sessions: 3 | avg: 133.1 ml |
| returns zeros for no sessions | no entries | total: 0, sessions: 0, avg: 0 |
| calculates fridge inventory | 2 fridge entries: 100ml, 150ml, 1 used | fridge_total_ml: 150 (or 100, whichever is unused) |
| calculates freezer inventory | 3 freezer entries, all unused: 100, 200, 150ml | freezer_total_ml: 450 |
| excludes used entries from inventory | 2 entries, 1 used | total = volume of unused entry only |
| handles null volume in totals | 2 entries: 100ml, null | total_volume_ml: 100, sessions: 2 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Start and stop pump timer | 1. Tap start, 2. Wait, 3. Tap stop, 4. Enter 4 oz, 5. Save | Session saved with correct duration and volume, list updates |
| Add manual pump entry | 1. Long press +, 2. Fill in times and volume, 3. Save | Entry appears in list at correct position |
| Store milk and verify inventory | 1. Log pump with storage = freezer, 2. Open inventory | Inventory shows the stored amount |
| Mark stored milk as used | 1. Store 4oz, 2. Open inventory, 3. Tap Used, 4. Confirm | Inventory decreases by 4oz |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Working mother pumps 3 times at the office | 1. Pump at 9 AM (timer, 4 oz, store in fridge), 2. Pump at noon (timer, 5 oz, store in fridge), 3. Pump at 3 PM (timer, 4.5 oz, store in fridge) | Daily total: 13.5 oz, 3 sessions, fridge inventory up 13.5 oz |
| Parent uses stored milk for bottle feed | 1. Log 3 pump sessions stored in freezer, 2. Mark one as used, 3. Log a bottle feeding (breast milk) | Storage inventory decreased, bottle feeding logged, dashboard reflects both activities |

---

### BB-010: Feeding Timer (Breast/Bottle)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-010 |
| **Feature Name** | Feeding Timer (Breast/Bottle) |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a breastfeeding mother, I want to start a timer when my baby latches and stop it when they finish, so that I can accurately track nursing duration without watching a clock.

**Secondary:**
> As a parent bottle-feeding, I want to time how long the feeding takes, so that I can spot changes in feeding speed that might indicate nipple flow issues or readiness for the next flow rate.

**Tertiary:**
> As a breastfeeding mother nursing on both sides, I want to switch the timer from one side to the other mid-feed, so that I can track time per side without logging two separate entries.

#### 3.3 Detailed Description

The Feeding Timer provides a built-in stopwatch for breastfeeding and bottle feeding sessions. It integrates directly with the Feeding Log (BB-002) by auto-populating the duration field when a timer-based feeding is completed.

For breastfeeding, the timer flow is: user taps "Feed" (or the breast quick action), selects a side (left or right), and the timer starts immediately. A large, easy-to-read elapsed time display shows minutes and seconds (MM:SS format). A "Switch Side" button allows the user to switch to the other breast mid-session. When the user taps "Done", the total duration is recorded, with per-side time breakdowns (e.g., "Left: 8 min, Right: 6 min, Total: 14 min").

For bottle feeding, the timer is simpler: tap start, the timer runs, tap stop. The elapsed time auto-fills the duration field in the feeding entry. Bottle feedings still require manual volume entry since the timer cannot measure how much was consumed.

The timer runs in the background when the app is minimized. A persistent notification (on platforms that support it) shows the running timer so the parent can see elapsed time without reopening the app. If the app is force-closed while a timer is running, the timer state is persisted to local storage and restored on next open.

The timer display is intentionally large and high-contrast, designed to be readable at arm's length (e.g., across a dimly lit room during a nighttime feeding). The minimum font size for the elapsed time is 48 points.

A pause button allows the parent to pause the timer if the baby stops and resumes (e.g., during a burping break). Paused time is not counted toward the total duration. The total duration equals the sum of all active (non-paused) intervals.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-002: Feeding Log - timer data auto-populates feeding entries

**External Dependencies:**
- System clock for timer functionality
- Background execution capability for background timer persistence
- Local notification support for persistent timer notification (optional)

**Assumed Capabilities:**
- An active child profile exists
- The feeding log is functional

#### 3.5 User Interface Requirements

##### Component: Feeding Timer (Inline/Full-Screen)

**Layout:**
- The timer can appear in two modes:
  - **Inline mode:** Embedded at the top of the Feeding Log screen or Daily Summary Dashboard, showing elapsed time and controls
  - **Full-screen mode:** Tapping the inline timer expands to a full-screen view optimized for nighttime use
- **Full-screen layout:**
  - Large elapsed time display centered on screen, minimum 48-point font: "MM:SS" format (e.g., "14:32")
  - Below the time, the current side indicator for breastfeeding: "Left" or "Right" with the respective side highlighted
  - Below the side indicator, per-side time breakdown: "Left: 8:12 | Right: 6:20"
  - Three action buttons across the bottom:
    - "Pause" / "Resume" toggle (pause icon / play icon)
    - "Switch Side" (only for breastfeeding, swap arrows icon)
    - "Done" (checkmark icon, saves the feeding)
  - For bottle feeding, the bottom row has only "Pause" and "Done" (no side switching)
  - The background is a dark, dim color for nighttime readability. No bright elements

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Running | Timer actively counting | Elapsed time incrementing every second, Pause button visible |
| Paused | Timer paused (e.g., burping break) | Elapsed time frozen, "Paused" label displayed, Resume button replaces Pause |
| Side Switch | User switched sides mid-feed | Per-side breakdown updates, current side indicator changes |
| Done | User tapped Done | Timer stops, transition to volume entry (bottle) or save confirmation (breast) |

**Interactions:**
- Tap "Pause": freezes the timer, paused time is not counted
- Tap "Resume": timer resumes from where it paused
- Tap "Switch Side": switches the active side indicator and starts counting time on the new side. Per-side totals update accordingly
- Tap "Done": stops the timer, saves the feeding entry with the total duration and per-side breakdown. For breastfeeding, navigates back to the feeding log with the entry saved. For bottle feeding, opens a volume entry prompt first
- Tap the inline timer: expands to full-screen mode
- Swipe down on full-screen: collapses back to inline mode

**Transitions/Animations:**
- Timer digit changes use a subtle roll animation (old digit slides up, new digit slides down), 100ms
- Side switch uses a horizontal slide animation on the side indicator, 200ms
- Inline to full-screen expansion: scale + fade, 250ms
- Pause/resume: the elapsed time display pulses once on state change, 200ms

#### 3.6 Data Requirements

The Feeding Timer does not introduce a new entity. It uses and extends the existing FeedingLog entity from BB-002 with additional computed fields:

##### Extended Fields on FeedingLog (from BB-002)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| left_duration_minutes | float | Min: 0 | null | Time spent nursing on the left side (breastfeeding only) |
| right_duration_minutes | float | Min: 0 | null | Time spent nursing on the right side (breastfeeding only) |
| pause_count | integer | Min: 0 | 0 | Number of times the timer was paused during this feeding |
| total_pause_minutes | float | Min: 0 | 0 | Total paused time (not counted toward duration_minutes) |

##### Persisted Timer State (for background/crash recovery)

| Field | Type | Description |
|-------|------|-------------|
| timer_active | boolean | Whether a feeding timer is currently running |
| timer_start_time | datetime | When the timer was started |
| timer_current_side | enum | "left", "right", or null (for bottle) |
| timer_paused | boolean | Whether the timer is currently paused |
| timer_pause_start | datetime | When the current pause began (null if not paused) |
| timer_total_paused_ms | integer | Accumulated pause time in milliseconds |
| timer_side_switches | array | List of {side, start_time} pairs for per-side tracking |
| timer_feeding_type | enum | "breast" or "bottle" |

This state is stored in a lightweight key-value store or the module settings table. It is deleted when the timer completes or is cancelled.

#### 3.7 Business Logic Rules

##### Timer Duration Calculation

**Purpose:** Compute the active (non-paused) duration of a feeding timer session.

**Inputs:**
- start_time: datetime - when the timer was started
- end_time: datetime - when the timer was stopped (or now, if still running)
- total_paused_ms: integer - total accumulated pause time in milliseconds

**Logic:**

```
1. total_elapsed_ms = (end_time - start_time) in milliseconds
2. active_ms = total_elapsed_ms - total_paused_ms
3. active_minutes = active_ms / 60000
4. RETURN round(active_minutes, 1)
```

**Edge Cases:**
- Timer never paused: total_paused_ms = 0, active_minutes = total elapsed
- Timer paused the entire time (unlikely): active_minutes approaches 0
- App was force-closed and reopened: restore timer state and compute elapsed from stored start_time

##### Per-Side Duration Calculation

**Purpose:** Compute time spent on each side during a breastfeeding session with side switches.

**Inputs:**
- side_switches: array of {side: enum, start_time: datetime}
- end_time: datetime - when the session ended
- pauses: array of {pause_start: datetime, pause_end: datetime}

**Logic:**

```
1. Initialize left_total_ms = 0, right_total_ms = 0
2. For each consecutive pair of side switches (or last switch to end_time):
     segment_start = switch[i].start_time
     segment_end = switch[i+1].start_time (or end_time for the last segment)
     segment_side = switch[i].side
     segment_duration_ms = segment_end - segment_start
     Subtract any pause time that overlaps with this segment
     IF segment_side = "left" THEN left_total_ms += adjusted_duration
     IF segment_side = "right" THEN right_total_ms += adjusted_duration
3. left_minutes = round(left_total_ms / 60000, 1)
4. right_minutes = round(right_total_ms / 60000, 1)
5. RETURN { left_minutes, right_minutes }
```

**Edge Cases:**
- Only one side used (no switches): all time attributed to the starting side
- Multiple switches: each segment's time is attributed to the correct side
- Pause during a side segment: pause time is subtracted from that side's total

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| User tries to start a feeding timer while one is already running | Toast: "A feeding timer is already running. Stop it first or add a manual entry." | User stops the current timer |
| App force-closed during active timer | On next open, restore timer state. Show: "A feeding was in progress. Resume or discard?" with Resume and Discard buttons | User taps Resume (timer continues from stored state) or Discard (timer data deleted) |
| Timer has been running for over 2 hours | Warning banner on the timer screen: "Timer has been running for over 2 hours. Did you forget to stop it?" with "Stop Now" and "Keep Going" | User stops or continues |
| Database write fails when saving timer result | Toast: "Could not save feeding. Please try again." Timer data is preserved in local state | User taps Done again |

**Validation Timing:**
- Active timer check runs when user initiates a new timer
- Duration warning check runs at the 120-minute mark
- Orphan timer check runs on app launch

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "Feed" and selects "Left",
   **When** the feeding timer starts,
   **Then** a large timer display shows "00:00" incrementing every second, with "Left" as the active side indicator.

2. **Given** the timer has been running for 8 minutes on the left side,
   **When** the user taps "Switch Side",
   **Then** the side indicator changes to "Right", the per-side breakdown shows "Left: 8:00 | Right: 0:00", and the total timer continues.

3. **Given** the timer has been running for 14 minutes (8 left, 6 right),
   **When** the user taps "Done",
   **Then** a feeding entry is saved with duration_minutes: 14, left_duration_minutes: 8, right_duration_minutes: 6, and the entry appears in the feeding log.

4. **Given** the user pauses the timer for 2 minutes during a burping break,
   **When** the user resumes and later taps Done at the 16-minute mark,
   **Then** the saved duration is 14 minutes (16 total minus 2 paused).

**Edge Cases:**

5. **Given** the app is force-closed while a feeding timer is running,
   **When** the user reopens the app,
   **Then** a prompt appears offering to resume or discard the timer. If resumed, the elapsed time reflects the full time since original start.

6. **Given** the user starts a bottle feeding timer,
   **When** the timer is running,
   **Then** no "Switch Side" button is shown (only Pause and Done).

**Negative Tests:**

7. **Given** a feeding timer is already running,
   **When** the user tries to start another feeding timer,
   **Then** the system blocks it with "A feeding timer is already running."

8. **Given** the timer has been running for over 2 hours,
   **When** the user views the timer,
   **Then** a warning banner appears asking if they forgot to stop it.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates active duration with no pauses | start: 0:00, end: 14:00, paused: 0 | active_minutes: 14.0 |
| calculates active duration with pause | start: 0:00, end: 16:00, paused: 2 min | active_minutes: 14.0 |
| calculates per-side times with one switch | left 0:00-8:00, right 8:00-14:00 | left: 8.0, right: 6.0 |
| calculates per-side times with no switch | left 0:00-14:00 | left: 14.0, right: 0.0 |
| calculates per-side with multiple switches | left 0-5, right 5-10, left 10-14 | left: 9.0, right: 5.0 |
| handles pause during side segment | left 0-10 with 2min pause at 5-7 | left: 8.0 (10 - 2 pause) |
| detects running timer over 2 hours | elapsed: 121 minutes | warning: true |
| restores timer state after crash | stored start: 30 min ago, stored paused: 0 | elapsed: ~30 minutes |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full breastfeeding timer flow | 1. Start on left, 2. Switch to right at 8 min, 3. Done at 14 min | Feeding entry saved with correct per-side breakdown |
| Bottle timer flow | 1. Start bottle timer, 2. Done at 10 min | Feeding entry saved, volume prompt shown, no side data |
| Timer with pause | 1. Start, 2. Pause at 5 min, 3. Resume at 7 min, 4. Done at 14 min | Saved duration: 12 min (14 - 2 paused) |
| Crash recovery | 1. Start timer, 2. Force-close app, 3. Reopen | Prompt to resume or discard, timer state restored |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Nighttime breastfeeding with timer | 1. Open app in dark room, 2. Start left timer, 3. Burp (pause), 4. Switch to right, 5. Done | Entry saved with both sides, pause excluded, large timer visible in low light |
| Bottle feeding timer | 1. Start bottle timer, 2. Done at 8 min, 3. Enter 4 oz, 4. Save | Entry saved with 8 min duration, 4 oz volume, appears in feeding log |

---

### BB-011: Nap Predictor (Wake Windows)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-011 |
| **Feature Name** | Nap Predictor (Wake Windows) |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a tired parent, I want the app to predict when my baby's next nap should be based on age-appropriate wake windows, so that I can plan my day around optimal nap times.

**Secondary:**
> As a parent trying to establish a sleep routine, I want to see a countdown to the next predicted nap window, so that I can start the wind-down process before my baby gets overtired.

**Tertiary:**
> As a parent whose baby's schedule is shifting, I want the predictor to adapt to my baby's actual sleep patterns, so that the suggestions get more accurate over time.

#### 3.3 Detailed Description

The Nap Predictor (also known as "SweetSpot" in Huckleberry) is one of the most requested features in baby tracking apps. It predicts the ideal next nap time based on age-appropriate wake windows - the optimal amount of time a baby can comfortably stay awake between sleep sessions before becoming overtired.

The prediction works by taking the child's last wake-up time and adding the age-appropriate wake window duration. Wake windows increase as babies grow:

- **Newborn (0-6 weeks):** 45-60 minutes
- **6-8 weeks:** 60-75 minutes
- **2-3 months:** 75-90 minutes
- **4 months:** 90-120 minutes
- **5-6 months:** 120-150 minutes (2-2.5 hours)
- **7-8 months:** 150-180 minutes (2.5-3 hours)
- **9-11 months:** 180-210 minutes (3-3.5 hours)
- **12-14 months:** 210-240 minutes (3.5-4 hours)
- **15-17 months:** 240-300 minutes (4-5 hours, transitioning to 1 nap)
- **18-24 months:** 300-360 minutes (5-6 hours, 1 nap per day)
- **2-3 years:** 360-420 minutes (6-7 hours, if still napping)

The baseline prediction uses the midpoint of the age-appropriate wake window range. The system then adjusts the baseline using the child's personal sleep history. If the child's actual wake windows over the past 7 days have consistently been shorter or longer than the baseline, the prediction shifts accordingly. The adaptation formula is:

```
adjusted_window = (baseline_midpoint * 0.6) + (personal_avg_wake_window * 0.4)
```

This weighted average ensures the prediction stays grounded in age-appropriate norms (60% weight) while adapting to the individual child's patterns (40% weight). The adaptation requires at least 5 completed sleep cycles in the past 7 days to activate. With fewer data points, the baseline midpoint is used without adjustment.

The predictor displays: "Next nap window: [time]" with a countdown ("in 45 minutes"). As the predicted time approaches, the display transitions through three visual states: "Green zone" (more than 15 minutes away), "Amber zone" (within 15 minutes), and "Red zone" (past the predicted time - baby may be overtired). These zones are visual cues only, never alarming messages.

A "Nap Window" section on the Daily Summary Dashboard (BB-006) shows the next predicted nap time. The Sleep Log (BB-003) also displays the prediction at the top of the screen when no sleep session is active.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-003: Sleep Tracking - the predictor needs wake-up times from sleep data

**External Dependencies:**
- System clock for countdown calculations

**Assumed Capabilities:**
- An active child profile exists with date of birth set
- At least one sleep entry exists (for determining last wake-up time)

#### 3.5 User Interface Requirements

##### Component: Nap Prediction Card

**Layout:**
- A card displayed on the Daily Summary Dashboard and Sleep Log screen
- The card shows:
  - "Next nap" label at the top
  - The predicted nap time in large text (e.g., "1:30 PM")
  - A countdown below: "in 45 minutes" (updates every minute)
  - A horizontal progress bar representing the wake window. The left end is the last wake-up time, the right end is the predicted nap time. A marker shows the current position. The bar fills from left to right as time passes
  - The bar color transitions: green (> 15 min remaining), amber (5-15 min), red (past predicted time)
- Below the card, a small text note: "Based on [X]-month wake window: [range]" (e.g., "Based on 4-month wake window: 1.5-2 hours")
- If the prediction has been personalized, an additional note: "Adjusted for [child name]'s patterns"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Predicted | Wake window active, nap not yet due | Green progress bar, countdown in minutes |
| Approaching | Within 15 minutes of predicted nap | Amber progress bar, "Nap time soon" label |
| Overdue | Past predicted nap time | Red progress bar filled completely, "Nap may be overdue" in muted text |
| Sleeping | A sleep session is currently active | Card hidden or replaced with "Currently sleeping: [elapsed]" |
| No Data | No sleep entries exist | "Log a sleep session to start predictions" message |
| Bedtime | Next predicted sleep falls in the nighttime window | Card shows "Bedtime" instead of "Next nap" with a moon icon |

**Interactions:**
- Tap the card: expands to show additional details (wake window range, personal average, last 3 wake windows)
- No dismissal or snooze actions - the card updates automatically

**Transitions/Animations:**
- Progress bar fills smoothly in real time (updates every minute)
- Color transition between zones is a smooth gradient shift, 500ms
- Countdown updates with a subtle fade transition, 200ms

#### 3.6 Data Requirements

The Nap Predictor does not introduce a new persisted entity. It is a computed feature that reads from SleepLog (BB-003) and ChildProfile (BB-001).

##### Computed Object: NapPrediction

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| last_wake_time | datetime | Most recent SleepLog end_time | When the baby last woke up |
| wake_window_minutes | float | Age-based lookup + personal adjustment | The predicted wake window duration |
| predicted_nap_time | datetime | last_wake_time + wake_window_minutes | When the next nap should start |
| minutes_remaining | float | predicted_nap_time - now | Countdown value (negative if overdue) |
| zone | enum | "green", "amber", "red" | Visual state based on time remaining |
| is_personalized | boolean | Whether personal adjustment was applied | Indicates if 5+ recent data points exist |
| baseline_window_minutes | float | Age-based lookup only | The unadjusted wake window midpoint |
| personal_avg_window_minutes | float | Average of recent actual wake windows | The child's observed average (null if insufficient data) |

##### Reference Data: Wake Window Table (Bundled, Read-Only)

| age_range_start_months | age_range_end_months | min_minutes | max_minutes |
|------------------------|---------------------|-------------|-------------|
| 0 | 1.5 | 45 | 60 |
| 1.5 | 2 | 60 | 75 |
| 2 | 3 | 75 | 90 |
| 3 | 4 | 90 | 120 |
| 4 | 6 | 120 | 150 |
| 6 | 8 | 150 | 180 |
| 8 | 11 | 180 | 210 |
| 11 | 14 | 210 | 240 |
| 14 | 17 | 240 | 300 |
| 17 | 24 | 300 | 360 |
| 24 | 36 | 360 | 420 |

#### 3.7 Business Logic Rules

##### Wake Window Lookup

**Purpose:** Determine the age-appropriate wake window range for a child.

**Inputs:**
- child_age_in_months: float - the child's current age

**Logic:**

```
1. Look up the wake window table row where child_age_in_months >= age_range_start_months AND child_age_in_months < age_range_end_months
2. baseline_midpoint = (min_minutes + max_minutes) / 2
3. RETURN {
     min_minutes,
     max_minutes,
     baseline_midpoint
   }
```

**Edge Cases:**
- Child younger than the table minimum (rare, premature): use the 0-1.5 month row
- Child older than 36 months: use the 24-36 month row (most children this age have dropped naps)

##### Personal Wake Window Calculation

**Purpose:** Compute the child's average actual wake window from recent sleep data.

**Inputs:**
- child_id: string - the active child
- lookback_days: integer - how many days of history to analyze (default: 7)

**Logic:**

```
1. Query all SleepLog entries for child_id in the past lookback_days, ordered by start_time
2. For each consecutive pair of sleep entries (end_time[i], start_time[i+1]):
     wake_window = start_time[i+1] - end_time[i] in minutes
     IF wake_window > 0 AND wake_window < 720 (12 hours max, to filter out overnight gaps):
       Add to wake_window_list
3. IF wake_window_list.length < 5 THEN
     RETURN { personalized: false, avg: null }
4. personal_avg = AVERAGE(wake_window_list)
5. RETURN {
     personalized: true,
     avg: personal_avg,
     data_points: wake_window_list.length
   }
```

**Edge Cases:**
- Fewer than 5 wake windows in the past 7 days: do not personalize, use baseline only
- Very long gaps (> 12 hours): filter out as these are overnight sleeps, not wake windows
- Negative wake windows (data entry error where sleep overlaps): filter out

##### Nap Prediction Calculation

**Purpose:** Predict the next nap time.

**Inputs:**
- last_wake_time: datetime - when the baby last woke up
- child_age_in_months: float - the child's age
- personal_avg: float or null - the child's average wake window (null if insufficient data)

**Logic:**

```
1. Look up baseline_midpoint from wake window table for child_age_in_months
2. IF personal_avg is not null THEN
     adjusted_window = (baseline_midpoint * 0.6) + (personal_avg * 0.4)
3. ELSE
     adjusted_window = baseline_midpoint
4. predicted_nap_time = last_wake_time + adjusted_window minutes
5. minutes_remaining = predicted_nap_time - now
6. IF minutes_remaining > 15 THEN zone = "green"
7. ELSE IF minutes_remaining > 0 THEN zone = "amber"
8. ELSE zone = "red"
9. RETURN {
     predicted_nap_time,
     minutes_remaining,
     zone,
     wake_window_minutes: adjusted_window,
     is_personalized: personal_avg is not null,
     baseline_midpoint,
     personal_avg
   }
```

**Formulas:**
- adjusted_window = (baseline_midpoint * 0.6) + (personal_avg * 0.4)
- predicted_nap_time = last_wake_time + adjusted_window
- Zone thresholds: green > 15 min, amber 0-15 min, red < 0 min

**Edge Cases:**
- Baby is currently sleeping: do not show a prediction (show "Currently sleeping" instead)
- No sleep data exists: show "Log a sleep session to start predictions"
- Last wake-up was more than 12 hours ago: the prediction may be stale. Show the prediction but add a note: "Last wake-up was [X hours] ago. Is the baby sleeping?"
- Bedtime detection: if the predicted nap time falls within the nighttime window (default 7PM-4AM), label it "Bedtime" instead of "Next nap"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No sleep data exists | Card shows: "Log a sleep session to start predictions" | User logs a sleep session, prediction appears on next dashboard refresh |
| Sleep data is stale (last entry > 24 hours ago) | Card shows prediction but adds: "Based on data from [date]. Log recent sleep for better predictions." | User logs current sleep data |
| Database query fails | Card shows: "Could not load prediction. Pull to refresh." | User pulls to refresh |
| Child age outside wake window table range | Use the nearest available range and note: "Prediction based on closest age range" | No user action needed |

**Validation Timing:**
- Prediction recalculates whenever a sleep entry is added, edited, or deleted
- Countdown updates every 60 seconds
- Zone color transitions update every 60 seconds

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a 4-month-old baby who woke up from a nap at 1:00 PM,
   **When** the user views the Nap Predictor card at 2:15 PM,
   **Then** the card shows "Next nap: ~2:45 PM" (wake window midpoint: 105 min) with "in 30 minutes" countdown and a green progress bar.

2. **Given** the same baby approaching the predicted nap time (2:40 PM, 5 minutes remaining),
   **When** the user views the card,
   **Then** the progress bar is amber, the countdown shows "in 5 minutes", and the label reads "Nap time soon."

3. **Given** a baby with 8 recorded wake windows averaging 100 minutes over the past week (vs. baseline 105 for 4 months),
   **When** the prediction is calculated,
   **Then** the adjusted window is (105 * 0.6) + (100 * 0.4) = 63 + 40 = 103 minutes, and the card notes "Adjusted for [child]'s patterns."

4. **Given** a baby who just fell asleep,
   **When** the user views the dashboard,
   **Then** the Nap Predictor card is replaced with "Currently sleeping: [elapsed time]."

**Edge Cases:**

5. **Given** a newborn with only 2 completed sleep cycles logged (fewer than 5),
   **When** the prediction is calculated,
   **Then** the baseline midpoint is used without personalization, and no "Adjusted" note is shown.

6. **Given** a 2-year-old whose predicted next nap falls at 7:30 PM,
   **When** the prediction is displayed,
   **Then** the card shows "Bedtime" instead of "Next nap" with a moon icon.

**Negative Tests:**

7. **Given** no sleep entries exist for the active child,
   **When** the user views the Nap Predictor,
   **Then** the card shows "Log a sleep session to start predictions" with no countdown or progress bar.

8. **Given** the last sleep entry was more than 24 hours ago,
   **When** the prediction is shown,
   **Then** a note says "Based on data from [date]. Log recent sleep for better predictions."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| looks up wake window for 4-month-old | age: 4 months | min: 90, max: 120, midpoint: 105 |
| looks up wake window for newborn | age: 0.5 months | min: 45, max: 60, midpoint: 52.5 |
| looks up wake window for 12-month-old | age: 12 months | min: 210, max: 240, midpoint: 225 |
| calculates adjusted window with personal avg | baseline: 105, personal: 100 | adjusted: 103 |
| uses baseline when no personal data | baseline: 105, personal: null | adjusted: 105 |
| predicts nap time correctly | wake: 1:00 PM, window: 105 min | predicted: 2:45 PM |
| assigns green zone | remaining: 30 min | zone: "green" |
| assigns amber zone | remaining: 10 min | zone: "amber" |
| assigns red zone | remaining: -5 min | zone: "red" |
| filters out overnight gaps | wake windows: [90, 95, 600, 100, 88] | filtered: [90, 95, 100, 88], avg: 93.25 |
| requires 5 data points for personalization | 4 wake windows | personalized: false |
| personalizes with 5+ data points | 6 wake windows | personalized: true |
| detects bedtime from nighttime prediction | predicted time: 7:30 PM | label: "Bedtime" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Prediction appears after first sleep | 1. Log a nap with end_time = now, 2. View dashboard | Nap predictor card shows prediction based on age baseline |
| Prediction updates after new sleep entry | 1. View prediction, 2. Log another sleep, 3. View prediction again | Prediction recalculated with new last_wake_time |
| Personalization activates after 5 sleeps | 1. Log 5 sleep entries over 3 days, 2. View prediction | Card shows "Adjusted for [child]'s patterns" |
| Prediction hidden during active sleep | 1. Start sleep timer, 2. View dashboard | Predictor card shows "Currently sleeping" instead of next nap time |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent uses nap predictor for a day | 1. Log morning nap ending at 9:30 AM, 2. Check prediction (shows ~11:15 AM for 4-month-old), 3. Log 11:00 AM nap, 4. Check prediction for afternoon | Each prediction reflects the most recent wake-up, countdown works, zones transition correctly |
| Predictor adapts over a week | 1. Log sleep consistently for 7 days with wake windows averaging 95 min (vs 105 baseline), 2. Check prediction | Adjusted window is closer to 99 min (105*0.6 + 95*0.4), noted as personalized |

---

### BB-012: Caregiver Sharing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-012 |
| **Feature Name** | Caregiver Sharing |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a co-parent, I want to share my baby's tracking data with my partner's device, so that we both see the same feeding, sleep, and diaper records without asking each other "when did the baby last eat?"

**Secondary:**
> As a parent who employs a nanny, I want to share limited access to the baby log with the nanny during their shift, so that they can log activities and I can see updates.

**Tertiary:**
> As a caregiver (nanny or grandparent), I want to receive a data sync link that lets me log activities for the baby, so that the parents have a complete record of my shift.

#### 3.3 Detailed Description

Caregiver Sharing allows multiple caregivers to contribute to and view a single child's tracking data without requiring a cloud account. This is achieved through local peer-to-peer sync using QR codes and local network discovery. The design prioritizes privacy: no cloud intermediary stores or relays baby data between devices.

There are two sharing models:

**Full Share (Co-parent):** Two devices maintain a synchronized copy of all child data. Both can add, edit, and delete entries. Changes sync bidirectionally when devices are on the same local network (Wi-Fi) or when a manual QR-based sync is triggered. Full shares persist indefinitely until revoked.

**Shift Share (Caregiver):** A temporary, limited-scope share designed for nanny or babysitter shifts. The parent generates a time-limited share link (QR code) that grants the caregiver read and write access for the duration of the shift (default: 12 hours, configurable). The caregiver can log feedings, sleep, and diapers but cannot access growth charts, medical records (vaccination, medicine logs), or delete existing entries. When the shift ends, the caregiver's access expires and they can no longer view or modify data. A shift summary is generated showing everything the caregiver logged.

**Sync Mechanism:** Data sync uses a last-write-wins conflict resolution strategy with device-specific UUIDs. Each entry carries a device_id indicating which device created it and a sync_version integer that increments on each modification. When two devices sync, entries with higher sync_version overwrite older versions. Entries that exist on one device but not the other are added to the receiving device. Deletions are tracked as soft deletes (a deleted_at timestamp) so they can propagate across devices.

**Initial Pairing (Full Share):**
1. Device A generates a QR code containing: a pairing key (random 256-bit token), the device's local network address, and the child profile ID
2. Device B scans the QR code
3. Both devices exchange and store each other's pairing key
4. An initial full data transfer occurs over the local network
5. Subsequent syncs happen automatically when devices detect each other on the same network, or manually via a "Sync Now" button

**Initial Pairing (Shift Share):**
1. Parent device generates a QR code containing: a temporary access token (expires after the configured shift duration), the child's name (for confirmation), and permitted operations (log feedings, sleep, diapers)
2. Caregiver scans the QR code
3. Caregiver receives a read-only copy of today's log entries plus write access for new entries
4. When the shift duration expires, the caregiver's access is revoked locally
5. A shift summary is available on the parent's device

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - sharing is per-child

**External Dependencies:**
- Camera for QR code scanning
- Local network (Wi-Fi) for peer-to-peer data transfer
- QR code generation library

**Assumed Capabilities:**
- Both devices have the MyLife app installed with the MyBaby module enabled
- Devices can communicate over a local network (same Wi-Fi)

#### 3.5 User Interface Requirements

##### Screen: Sharing Settings

**Layout:**
- A header displaying the active child's name: "Sharing for [child name]"
- **Active Shares section:** A list of currently connected caregivers, each showing: a device name or label (e.g., "Dad's iPhone", "Nanny Maria"), the share type (Full or Shift), the last sync time (e.g., "Synced 5 min ago"), and a status indicator (green = connected/recently synced, amber = not synced in 24+ hours)
- For Shift shares: an additional expiration countdown (e.g., "Expires in 4h 30m")
- **Add Share buttons:** Two buttons below the active list:
  - "Share with Co-Parent" (full share icon) - starts the full share pairing flow
  - "Create Shift Share" (clock icon) - starts the shift share flow
- **Sync Controls:** A "Sync Now" button that triggers a manual sync with all paired devices. A sync status indicator showing the last sync time and any pending changes count

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Shares | No caregivers connected | Empty state: "Share your baby's log with a co-parent or caregiver" with the two Add Share buttons |
| Connected | Active shares exist | List of connected devices with status indicators |
| Syncing | Sync in progress | Spinning indicator on the Sync Now button, progress text |
| Sync Error | Last sync failed | Red indicator with error message: "Sync failed. Ensure both devices are on the same Wi-Fi." |
| Shift Expired | A shift share has expired | The expired share shows "Expired" with a dimmed style and a "Remove" button |

**Interactions:**
- Tap "Share with Co-Parent": generates and displays a QR code. The screen shows: "Have your partner scan this code with their MyLife app" with the QR code centered. A countdown timer shows how long the QR code is valid (5 minutes)
- Tap "Create Shift Share": opens a configuration form with shift duration picker (default 12 hours, options: 4, 6, 8, 10, 12, 16, 24 hours), caregiver label (optional text, e.g., "Nanny Maria"), and a "Generate QR Code" button
- Tap a connected device row: opens device detail with last sync time, total entries synced, and a "Remove" button
- Tap "Remove" on a share: confirmation dialog "Remove [device name]? They will no longer have access to [child name]'s data." with Cancel and Remove buttons
- Tap "Sync Now": triggers manual sync

**Transitions/Animations:**
- QR code generation: fade-in with subtle scale animation, 200ms
- Sync progress: rotating spinner icon, synced entries count up
- Share removal: row slides out with fade, 200ms

##### Screen: Shift Summary (Parent View)

**Layout:**
- Header: "Shift Summary for [caregiver label]" with the shift date and duration
- Activity counts: "Feedings: 4 | Sleeps: 2 | Diapers: 5"
- A chronological list of all entries logged by the caregiver during the shift, each marked with the caregiver's device label
- A notes section where the caregiver can leave an end-of-shift note (optional)

#### 3.6 Data Requirements

##### Entity: ShareConnection

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | Which child's data is shared |
| share_type | enum | One of: "full", "shift" | None | Type of share |
| device_label | string | Optional, max 100 characters | null | Human-friendly name for the connected device |
| pairing_key | string | Required, 256-bit random token | Auto-generated | Cryptographic key for authenticating the connection |
| expires_at | datetime | Required for shift type, null for full type | null | When the share expires (shift shares only) |
| last_sync_at | datetime | Auto-updated | null | Last successful sync time |
| sync_version | integer | Auto-incremented | 0 | Current sync version counter |
| status | enum | One of: "active", "expired", "revoked" | "active" | Current share status |
| created_at | datetime | Auto-set | Current timestamp | When the share was created |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- ShareConnection belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, status) - for finding active shares per child
- (pairing_key) - for authenticating incoming sync requests

**Validation Rules:**
- child_id: must reference an existing ChildProfile
- For shift shares: expires_at must be in the future at creation time
- pairing_key: must be unique across all ShareConnections
- Maximum 5 active shares per child (to prevent abuse)

##### Sync Metadata (Added to All Syncable Entities)

Every syncable entity (FeedingLog, SleepLog, DiaperLog, PumpingLog, MedicineLog) gains these additional fields:

| Field | Type | Description |
|-------|------|-------------|
| device_id | string | UUID of the device that created or last modified this entry |
| sync_version | integer | Incremented on each modification, used for conflict resolution |
| deleted_at | datetime | Soft delete timestamp (null if not deleted). Propagates deletions during sync |

#### 3.7 Business Logic Rules

##### Conflict Resolution (Last-Write-Wins)

**Purpose:** Resolve conflicts when two devices modify the same entry.

**Inputs:**
- local_entry: the entry on this device
- remote_entry: the entry received from the other device

**Logic:**

```
1. IF local_entry.id = remote_entry.id THEN
     IF remote_entry.sync_version > local_entry.sync_version THEN
       Replace local_entry with remote_entry
     ELSE IF remote_entry.sync_version = local_entry.sync_version AND remote_entry.updated_at > local_entry.updated_at THEN
       Replace local_entry with remote_entry
     ELSE
       Keep local_entry (local is newer or same version)
2. IF remote_entry.id does not exist locally THEN
     Insert remote_entry as a new local entry
3. IF remote_entry.deleted_at is not null AND local_entry.deleted_at is null THEN
     Apply soft delete to local_entry (set deleted_at = remote_entry.deleted_at)
```

**Edge Cases:**
- Both devices modify the same entry while offline: the one with the higher sync_version wins. If versions are equal, the more recent updated_at wins
- A device deletes an entry while the other edits it: the delete propagates (soft delete), but the edit is preserved in the deleted record for recovery

##### Shift Expiration

**Purpose:** Automatically revoke caregiver access when a shift ends.

**Inputs:**
- share_connection: ShareConnection with share_type = "shift"

**Logic:**

```
1. On every app foreground event and every 15 minutes:
     Check all active shift shares
     IF share.expires_at <= now THEN
       Set share.status = "expired"
       Generate shift summary from entries where device_id matches the caregiver's device
       Notify parent: "Shift for [caregiver label] has ended. View summary."
```

**Edge Cases:**
- App is not running when shift expires: expiration is applied on next app open
- Caregiver tries to sync after expiration: sync request is rejected with "Share has expired"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| QR code scan fails | Toast: "Could not read the QR code. Try again or move closer." | User rescans |
| Devices not on the same Wi-Fi | Toast: "Devices must be on the same Wi-Fi network to sync." | User connects to the same network |
| Sync fails mid-transfer | Toast: "Sync interrupted. [X] of [Y] entries transferred. Tap Sync Now to retry." | User taps Sync Now |
| Pairing key is invalid or expired | Toast: "This sharing code has expired. Please generate a new one." | Parent generates a new QR code |
| Maximum shares exceeded (5) | Toast: "Maximum 5 active shares per child. Remove an existing share first." | User removes an old share |
| Caregiver tries to access growth/medical data on shift share | Data is not visible. If navigating to restricted areas: "Growth and medical records are not available during shift access." | No recovery needed - by design |

**Validation Timing:**
- QR code validity check runs on scan
- Network availability check runs on sync initiation
- Shift expiration check runs every 15 minutes and on app foreground

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** Parent A generates a full share QR code for child "Luna",
   **When** Parent B scans the code on their device,
   **Then** both devices are paired, initial data transfers, and both show the same feeding/sleep/diaper entries.

2. **Given** two paired devices with 10 entries each,
   **When** Parent A logs a new feeding on their device and both devices are on the same Wi-Fi,
   **Then** the new feeding appears on Parent B's device after automatic sync (within 30 seconds).

3. **Given** a parent creates a 12-hour shift share for "Nanny Maria",
   **When** the nanny scans the QR code,
   **Then** the nanny sees today's activity log and can add feedings, sleep, and diapers but cannot view growth charts or vaccination records.

4. **Given** a shift share that expires at 6:00 PM,
   **When** the time reaches 6:00 PM,
   **Then** the nanny's access is revoked, and the parent sees a shift summary notification.

**Edge Cases:**

5. **Given** both parents edit the same feeding entry while offline,
   **When** they reconnect and sync,
   **Then** the entry with the higher sync_version (or more recent updated_at) wins, and the other device adopts the winning version.

6. **Given** 5 active shares already exist for a child,
   **When** the parent tries to create a 6th share,
   **Then** the system shows "Maximum 5 active shares per child" and blocks creation.

**Negative Tests:**

7. **Given** devices are on different Wi-Fi networks,
   **When** a sync is attempted,
   **Then** the system shows "Devices must be on the same Wi-Fi network" and sync does not proceed.

8. **Given** a shift share has expired,
   **When** the caregiver tries to log a feeding,
   **Then** the system shows "Your shift access has expired" and blocks the entry.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| resolves conflict with higher sync_version | local: v3, remote: v5 | remote wins |
| resolves conflict with same version, later timestamp | local: v3 updated 1:00, remote: v3 updated 1:05 | remote wins |
| keeps local with higher version | local: v5, remote: v3 | local wins |
| inserts new remote entry | remote entry not in local DB | entry inserted locally |
| propagates soft delete | remote: deleted_at set, local: not deleted | local gets deleted_at |
| validates shift expiration | share expires_at: 1 hour ago | status: "expired" |
| validates active shift | share expires_at: 3 hours from now | status: "active" |
| enforces max 5 shares | 5 active shares exist | new share blocked |
| generates pairing key | generation request | 256-bit random token, unique |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full share pairing flow | 1. Device A generates QR, 2. Device B scans, 3. Initial sync | Both devices have identical data, share appears in settings |
| Shift share with expiration | 1. Create 1-hour shift share, 2. Caregiver logs entries, 3. Wait for expiration | Caregiver loses access, parent sees shift summary |
| Manual sync after offline changes | 1. Both devices go offline, 2. Each logs entries, 3. Reconnect, 4. Tap Sync Now | Both devices have all entries from both devices |
| Remove a share | 1. Paired with device B, 2. Remove device B share | Device B can no longer sync, connection removed from list |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Co-parent daily workflow | 1. Parent A logs morning feedings, 2. Parent B logs afternoon feedings from work, 3. Both sync at home on same Wi-Fi | Both devices show all feedings, dashboard totals match on both devices |
| Nanny shift handoff | 1. Parent creates 8-hour shift share at 8 AM, 2. Nanny logs feedings/diapers/naps during shift, 3. Shift expires at 4 PM, 4. Parent reviews shift summary | Parent sees all nanny entries, shift summary shows activity counts, nanny can no longer access data |

---

### BB-013: Medicine Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-013 |
| **Feature Name** | Medicine Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a parent whose baby has been prescribed infant Tylenol for a fever, I want to log each dose with the time and amount, so that I do not accidentally give too many doses too close together.

**Secondary:**
> As a parent managing daily vitamin D drops, I want to set up a recurring medicine that I check off each day, so that I can ensure consistency and never forget.

**Tertiary:**
> As a parent sharing caregiver duties, I want my partner to see when the last dose was given, so that we do not accidentally double-dose the baby.

#### 3.3 Detailed Description

Medicine Tracking logs all medications given to the baby, from prescription antibiotics to over-the-counter fever reducers to daily supplements like vitamin D drops. The feature is designed with safety as the top priority: clear display of when the last dose was given, minimum time between doses, and maximum daily dose limits.

Each medicine has a profile containing: the medicine name, the dosage amount and unit (e.g., "2.5 ml" or "1 dropper"), the frequency (as needed, every X hours, once daily, twice daily, etc.), the minimum time between doses (e.g., 4 hours for infant Tylenol), the maximum doses per 24-hour period (e.g., 5 for infant Tylenol), and an optional end date. Users create medicine profiles manually by entering these fields. The system does not provide a medicine database or dosage recommendations - this is intentional, as dosages are determined by the pediatrician and vary by weight.

The main interaction is logging a dose. The user selects a medicine, confirms the dosage, and taps "Give Dose." The system records the timestamp and checks safety rules: if the minimum time between doses has not elapsed, a warning is shown. If the maximum daily doses would be exceeded, a stronger warning is shown. These are warnings, not hard blocks, because there are legitimate reasons a parent might give a dose outside the normal schedule (per pediatrician instruction). The warning includes "Last dose was at [time] ([X hours ago]). Minimum interval is [Y hours]."

The medicine list screen shows all active medicines with: the medicine name, the last dose time and a "time since" display, a visual indicator of whether a dose is due or too recent, and a "Give Dose" button. Completed medicines (past their end date) are archived separately.

For daily supplements (vitamin D, probiotics), a simple "daily check" mode shows a checkbox for each day. The user taps the checkbox to mark today's supplement as given. A streak counter shows consecutive days without missing.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - medicines are associated with a specific child

**External Dependencies:**
- Local storage for persisting medicine profiles and dose logs
- System clock for timing calculations

**Assumed Capabilities:**
- An active child profile exists

#### 3.5 User Interface Requirements

##### Screen: Medicine List

**Layout:**
- **Active Medicines section:** A vertically scrollable list of active medicine profiles. Each row shows:
  - Medicine name (e.g., "Infant Tylenol") in bold
  - Dosage (e.g., "2.5 ml") below the name
  - Last dose: "Last: [time] ([X hours ago])" or "No doses given yet"
  - Status indicator:
    - Green: dose is due (minimum interval has passed)
    - Amber: approaching due time (within 1 hour of minimum interval)
    - Red: too recent (minimum interval has not passed)
    - Blue: daily supplement (checkbox mode)
  - A "Give Dose" button on the right side of the row
- For daily supplements, the row shows a checkbox instead of the "Give Dose" button, with a streak counter (e.g., "14-day streak")
- Below the active medicines, a collapsed "Completed" section for archived medicines
- A floating action button "+" to add a new medicine profile

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No medicine profiles exist | Message: "No medicines set up. Tap + to add a medicine or supplement." |
| Active | Medicines exist with various dose statuses | Color-coded list with Give Dose buttons and status indicators |
| All Given | All as-needed medicines were given recently (all red) | All rows show "too recent" status |

**Interactions:**
- Tap "Give Dose": if safe (minimum interval passed), logs the dose immediately and shows a brief confirmation toast. If unsafe, shows a safety warning dialog first
- Tap a medicine row: opens the Medicine Detail screen
- Tap "+": opens the Add Medicine form
- Tap a daily supplement checkbox: logs today's dose, updates the streak counter
- Swipe left on a medicine: reveals "Archive" and "Delete" options

**Transitions/Animations:**
- "Give Dose" confirmation: button briefly pulses with a checkmark, 300ms
- Status indicator color transitions smoothly as time passes (red to amber to green)
- Streak counter increments with a subtle bounce animation

##### Bottom Sheet: Add Medicine

**Layout:**
- Medicine name: text input, required, max 200 characters
- Dosage amount: numeric input (e.g., "2.5")
- Dosage unit: picker with options: "ml", "drops", "mg", "tablet", "tsp", "other"
- Medicine type: two buttons "As Needed" and "Daily Supplement"
- If "As Needed":
  - Minimum hours between doses: numeric input (e.g., "4")
  - Maximum doses per 24 hours: numeric input (e.g., "5")
  - Optional: reason/condition (freeform, e.g., "fever", "teething")
- If "Daily Supplement":
  - Frequency: picker with options "Once daily", "Twice daily", "Three times daily"
  - Preferred time: time picker (for reference, not an alarm)
- Start date: date picker, defaults to today
- End date: optional date picker (e.g., for a 10-day antibiotic course)
- Notes: optional text area, max 300 characters
- Save button

#### 3.6 Data Requirements

##### Entity: MedicineProfile

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this medicine is for |
| name | string | Required, max 200 characters | None | Medicine or supplement name |
| dosage_amount | float | Required, min: 0.01 | None | Dosage amount per dose |
| dosage_unit | enum | One of: "ml", "drops", "mg", "tablet", "tsp", "other" | "ml" | Unit for the dosage amount |
| medicine_type | enum | One of: "as_needed", "daily_supplement" | "as_needed" | Whether this is an as-needed or daily medicine |
| min_hours_between | float | Min: 0.5, applicable for as_needed | null | Minimum hours between doses |
| max_doses_per_day | integer | Min: 1, Max: 20, applicable for as_needed | null | Maximum doses in a 24-hour period |
| frequency | enum | One of: "once_daily", "twice_daily", "three_daily". Applicable for daily_supplement | null | How often the supplement is taken |
| preferred_time | time | Optional, applicable for daily_supplement | null | Preferred time to take the supplement |
| reason | string | Optional, max 200 characters | null | Why the medicine is prescribed |
| start_date | date | Required | Today | When the medicine regimen started |
| end_date | date | Optional, must be on or after start_date | null | When the medicine regimen ends (null = ongoing) |
| status | enum | One of: "active", "archived" | "active" | Current status |
| notes | string | Optional, max 300 characters | null | Additional notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: MedicineLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child who received the dose |
| medicine_id | string | Required, references MedicineProfile.id | None | Which medicine was given |
| timestamp | datetime | Required, must not be in the future | Current timestamp | When the dose was given |
| dosage_amount | float | Required | Copied from MedicineProfile | The actual dose given (may differ from the profile amount) |
| dosage_unit | enum | Copied from MedicineProfile | Copied | Unit for the dose |
| override_warning | boolean | - | false | Whether the user acknowledged a safety warning to log this dose |
| notes | string | Optional, max 300 characters | null | Notes for this specific dose |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- MedicineProfile belongs to ChildProfile (many-to-one via child_id)
- MedicineLog belongs to ChildProfile (many-to-one via child_id)
- MedicineLog belongs to MedicineProfile (many-to-one via medicine_id)

**Indexes:**
- MedicineProfile: (child_id, status) - for listing active medicines
- MedicineLog: (child_id, medicine_id, timestamp) - for dose history queries
- MedicineLog: (medicine_id, timestamp) - for safety check queries

**Validation Rules:**
- name: required, not empty after trimming
- dosage_amount: must be positive
- For as_needed: min_hours_between and max_doses_per_day are required
- end_date: if provided, must be on or after start_date
- MedicineLog.timestamp: must not be in the future

**Example Data:**

```
MedicineProfile:
{
  "id": "m1a2b3c4-d5e6-7890-abcd-aaaaaaaaaaaa",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "name": "Infant Tylenol",
  "dosage_amount": 2.5,
  "dosage_unit": "ml",
  "medicine_type": "as_needed",
  "min_hours_between": 4,
  "max_doses_per_day": 5,
  "reason": "Fever / teething pain",
  "start_date": "2026-03-01",
  "end_date": null,
  "status": "active"
}

MedicineLog:
{
  "id": "ml1a2b3c-d5e6-7890-abcd-bbbbbbbbbbbb",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "medicine_id": "m1a2b3c4-d5e6-7890-abcd-aaaaaaaaaaaa",
  "timestamp": "2026-03-06T14:30:00Z",
  "dosage_amount": 2.5,
  "dosage_unit": "ml",
  "override_warning": false,
  "notes": "Fever of 101.2F"
}
```

#### 3.7 Business Logic Rules

##### Dose Safety Check

**Purpose:** Determine whether it is safe to give the next dose of a medicine.

**Inputs:**
- medicine: MedicineProfile - the medicine to check
- child_id: string - the active child
- now: datetime - the current time

**Logic:**

```
1. IF medicine.medicine_type = "daily_supplement" THEN
     Check if today's dose(s) have been given:
     today_doses = COUNT MedicineLog where medicine_id = medicine.id AND timestamp is today
     IF today_doses >= frequency_count (1 for once_daily, 2 for twice_daily, 3 for three_daily) THEN
       RETURN { safe: false, reason: "Today's dose(s) already given", severity: "info" }
     ELSE
       RETURN { safe: true }
2. IF medicine.medicine_type = "as_needed" THEN
     last_dose = SELECT timestamp FROM MedicineLog WHERE medicine_id = medicine.id ORDER BY timestamp DESC LIMIT 1
     IF last_dose is not null THEN
       hours_since = (now - last_dose) in hours
       IF hours_since < medicine.min_hours_between THEN
         RETURN {
           safe: false,
           reason: "Last dose was {hours_since}h ago. Minimum interval is {min_hours_between}h.",
           severity: "warning",
           next_safe_time: last_dose + min_hours_between hours
         }
     doses_in_24h = COUNT MedicineLog where medicine_id = medicine.id AND timestamp > (now - 24 hours)
     IF doses_in_24h >= medicine.max_doses_per_day THEN
       RETURN {
         safe: false,
         reason: "Maximum {max_doses_per_day} doses in 24 hours reached ({doses_in_24h} given).",
         severity: "danger",
         next_safe_time: oldest dose in 24h window + 24 hours
       }
     RETURN { safe: true }
```

**Edge Cases:**
- No previous doses: always safe
- Both interval and daily max violated: show the more severe warning (daily max)
- User overrides a warning: log override_warning = true on the MedicineLog entry

##### Daily Supplement Streak

**Purpose:** Calculate the consecutive-day streak for a daily supplement.

**Inputs:**
- medicine_id: string - the daily supplement to check
- today: date - the current date

**Logic:**

```
1. Start from yesterday and walk backward through dates
2. For each date, check if a MedicineLog entry exists for this medicine on that date
3. IF entry exists, increment streak
4. IF no entry exists, stop counting
5. IF today's dose has been given, add 1 to the streak
6. RETURN streak
```

**Edge Cases:**
- First day: streak = 1 if today's dose given, 0 otherwise
- Gap in the middle: streak resets at the gap
- Multiple doses per day: still counts as 1 streak day

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Too-soon dose attempt | Warning dialog: "Last dose was [X hours] ago. The minimum interval is [Y hours]. The next safe time is [time]. Are you sure you want to give a dose now?" with "Give Dose Anyway" and "Wait" buttons | User waits or acknowledges and gives dose (override logged) |
| Daily max exceeded | Strong warning dialog: "Maximum [X] doses in 24 hours has been reached ([Y] given). Giving another dose is not recommended. Consult your pediatrician." with "Give Dose Anyway" and "Cancel" buttons | User cancels or overrides with full acknowledgment |
| Database write fails | Toast: "Could not save dose. Please try again." | User retries |
| Medicine name is empty | Inline validation: "Medicine name is required" | User enters a name |
| Dosage amount is 0 or negative | Inline validation: "Dosage must be greater than 0" | User corrects the value |
| End date before start date | Inline validation: "End date must be on or after start date" | User corrects the date |

**Validation Timing:**
- Safety check runs when user taps "Give Dose" (before logging)
- Form validation runs on Save for new medicine profiles
- End date validation runs immediately on date picker selection

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has set up "Infant Tylenol" with 2.5 ml dosage, 4-hour minimum interval, and 5 max daily doses,
   **When** the user taps "Give Dose" and no previous doses exist,
   **Then** the dose is logged immediately with a confirmation toast, and the medicine row shows "Last: just now" with a red status indicator.

2. **Given** a dose of Infant Tylenol was given 4.5 hours ago,
   **When** the user views the medicine list,
   **Then** the Tylenol row shows a green status indicator and "Last: 4h 30m ago".

3. **Given** the user has set up "Vitamin D Drops" as a daily supplement,
   **When** the user taps the checkbox for today,
   **Then** the checkbox fills, the streak counter increments, and "Given today" appears.

4. **Given** a 10-day antibiotic course with end date March 15,
   **When** March 16 arrives,
   **Then** the medicine is automatically archived and moves to the "Completed" section.

**Edge Cases:**

5. **Given** a dose was given 2 hours ago (minimum interval is 4 hours),
   **When** the user taps "Give Dose",
   **Then** a warning dialog appears: "Last dose was 2h ago. Minimum interval is 4h. Next safe time is [time]. Are you sure?"

6. **Given** 5 doses have been given in the last 24 hours (max is 5),
   **When** the user taps "Give Dose",
   **Then** a strong warning dialog appears about exceeding the daily maximum, with a recommendation to consult a pediatrician.

**Negative Tests:**

7. **Given** the user is adding a new medicine,
   **When** the user leaves the name blank and taps Save,
   **Then** the system shows "Medicine name is required" and does not save.

8. **Given** the user sets an end date before the start date,
   **When** the date is selected,
   **Then** the system shows "End date must be on or after start date."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| dose is safe with no previous doses | no logs exist | safe: true |
| dose is unsafe within minimum interval | last dose 2h ago, min interval 4h | safe: false, severity: "warning" |
| dose is safe past minimum interval | last dose 5h ago, min interval 4h | safe: true |
| dose is unsafe at daily max | 5 doses in 24h, max is 5 | safe: false, severity: "danger" |
| dose is safe below daily max | 3 doses in 24h, max is 5 | safe: true |
| calculates next safe time | last dose at 2:00 PM, min interval 4h | next_safe_time: 6:00 PM |
| calculates streak for 5 consecutive days | doses on days -4, -3, -2, -1, today | streak: 5 |
| streak resets at gap | doses on days -3, -2, (gap), today | streak: 1 |
| daily supplement given once | 1 dose today, frequency: once_daily | safe: false (already given) |
| daily supplement not yet given | 0 doses today, frequency: once_daily | safe: true |
| auto-archives past end date | end_date: yesterday | status: "archived" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create medicine and give first dose | 1. Add "Infant Tylenol" profile, 2. Tap Give Dose | Dose logged, last dose shows current time, status turns red |
| Safety warning on too-soon dose | 1. Give a dose, 2. Try to give another dose 1 hour later | Warning dialog appears with time-since and next-safe-time info |
| Daily supplement streak | 1. Set up Vitamin D, 2. Check off 3 consecutive days, 3. View streak | Streak shows 3 |
| Archive completed medicine | 1. Create medicine with end date = today, 2. Wait until tomorrow, 3. View medicine list | Medicine moved to Completed section |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent manages fever medication over 2 days | 1. Add Infant Tylenol, 2. Give 4 doses over day 1 spaced 4+ hours apart, 3. Give 2 doses on day 2 | All doses logged with correct timestamps, safety checks work at each step, daily counts reset at midnight |
| Parent manages daily vitamin D for 2 weeks | 1. Add Vitamin D as daily supplement, 2. Check off each day for 14 days, skip day 15, resume day 16 | Streak shows 1 on day 16 (reset after gap), history shows 14 of 15 days completed |

---

### BB-014: Teething Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-014 |
| **Feature Name** | Teething Log |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a parent, I want to record when each of my baby's teeth comes in, so that I can track dental development and share the record with our dentist.

**Secondary:**
> As a parent noticing teething symptoms, I want to log signs of teething (drooling, fussiness, gum rubbing), so that I can correlate symptoms with actual tooth eruptions.

**Tertiary:**
> As a parent of multiple children, I want to compare teething timelines between my children, so that I can understand their different development patterns.

#### 3.3 Detailed Description

The Teething Log tracks which teeth have erupted and when, displayed on a visual tooth diagram. Babies typically get 20 primary (baby) teeth between 6 and 30 months of age, though timing varies widely. The typical eruption order is:

- **6-10 months:** Lower central incisors (2 teeth)
- **8-12 months:** Upper central incisors (2 teeth)
- **9-13 months:** Upper lateral incisors (2 teeth)
- **10-16 months:** Lower lateral incisors (2 teeth)
- **13-19 months:** First molars - upper and lower (4 teeth)
- **16-23 months:** Canines - upper and lower (4 teeth)
- **23-33 months:** Second molars - upper and lower (4 teeth)

The main screen features an interactive tooth diagram showing all 20 primary teeth in their approximate positions (upper jaw: 10 teeth, lower jaw: 10 teeth). Each tooth position is tappable. Teeth not yet erupted are shown as outlines. Erupted teeth are shown as filled shapes. Tapping a tooth opens a detail form where the user can record the eruption date and optional notes.

A secondary feature tracks teething symptoms. Parents can log symptoms (drooling, fussiness, biting/chewing, swollen gums, sleep disruption, reduced appetite, mild fever, rash around mouth) with a date. The system displays symptoms on a timeline alongside tooth eruptions, helping parents see the correlation between symptom onset and actual eruption dates.

The teething timeline view shows a chronological list of events: both tooth eruptions and symptom logs, sorted by date. This creates a comprehensive teething history that parents can reference at dental visits.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - teething records are associated with a specific child

**External Dependencies:**
- Local storage for persisting teething data

**Assumed Capabilities:**
- An active child profile exists

#### 3.5 User Interface Requirements

##### Screen: Tooth Diagram

**Layout:**
- A visual diagram of 20 primary teeth arranged in two arcs (upper jaw and lower jaw), resembling a dental chart. Each tooth position is labeled with a letter (A through T, following the ADA universal tooth numbering for primary teeth)
- The diagram is centered on the screen and takes approximately 40% of the screen height
- Each tooth is a tappable element. Not-erupted teeth are shown as gray outlines. Erupted teeth are shown as filled white shapes with a subtle shadow
- Below the diagram, a progress indicator: "[X] of 20 teeth" with a percentage
- Below the progress indicator, a "Recent Activity" list showing the most recent tooth eruptions and symptom logs
- A "Log Symptom" button below the recent activity list
- A "View Timeline" button to navigate to the full chronological teething timeline

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Teeth | No eruptions recorded | All teeth shown as gray outlines, progress shows "0 of 20 teeth", encouraging message: "Tap a tooth when it comes in!" |
| Partial | Some teeth erupted | Mix of filled and outline teeth, progress updates |
| All Teeth | All 20 teeth recorded | All teeth filled, progress shows "20 of 20 teeth" with a celebratory message: "All primary teeth are in!" |

**Interactions:**
- Tap an unerupted tooth: opens the Record Eruption form with the tooth name pre-filled
- Tap an erupted tooth: opens the tooth detail showing eruption date and any notes, with edit and "Mark Not Erupted" options
- Tap "Log Symptom": opens the symptom logging form
- Tap "View Timeline": navigates to the Teething Timeline screen
- Pinch to zoom on the diagram: enlarges for easier tapping on individual teeth

**Transitions/Animations:**
- Tooth eruption recording: the outline fills in with a pop animation (scale 0.8 to 1.1 to 1.0, 300ms) and a subtle glow effect
- Progress indicator smoothly fills, 200ms

##### Bottom Sheet: Record Eruption

**Layout:**
- Tooth name and position displayed at the top (e.g., "Upper Right Central Incisor - Tooth E")
- Eruption date: date picker, defaults to today
- Notes: optional text area, max 300 characters (e.g., "First tooth! Very fussy for 3 days before")
- Photo: optional photo attachment (e.g., photo of baby's first tooth)
- Save button

##### Bottom Sheet: Log Symptom

**Layout:**
- Date: date picker, defaults to today
- Symptoms: multi-select checkboxes for common teething symptoms:
  - Drooling
  - Fussiness / irritability
  - Biting / chewing on objects
  - Swollen or tender gums
  - Sleep disruption
  - Reduced appetite
  - Mild fever (< 100.4F / 38C)
  - Rash around mouth
- Severity: three buttons "Mild", "Moderate", "Severe"
- Notes: optional text area, max 300 characters
- Save button

#### 3.6 Data Requirements

##### Entity: TeethRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this record belongs to |
| tooth_id | string | Required, one of 20 ADA primary tooth identifiers (A-T) | None | Which tooth erupted |
| eruption_date | date | Must not be in the future, must not be before child's DOB | None | When the tooth was first observed |
| photo_uri | string | Optional, max 500 characters | null | Local file path to a photo |
| notes | string | Optional, max 300 characters | null | Parent notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: TeethingSymptomLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child experiencing symptoms |
| date | date | Required, must not be in the future | Today | Date of symptom observation |
| symptoms | string | Required, comma-separated list from allowed values | None | Which symptoms were observed |
| severity | enum | One of: "mild", "moderate", "severe" | "mild" | Overall symptom severity |
| notes | string | Optional, max 300 characters | null | Additional observations |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- TeethRecord belongs to ChildProfile (many-to-one via child_id)
- TeethingSymptomLog belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- TeethRecord: (child_id, tooth_id) - unique composite, one record per tooth per child
- TeethingSymptomLog: (child_id, date) - for timeline queries

**Validation Rules:**
- tooth_id: must be one of the 20 valid primary tooth identifiers (A through T)
- Only one TeethRecord per child per tooth_id
- eruption_date: must not be in the future, must not be before child's DOB
- symptoms: must contain at least one valid symptom from the allowed list

**Example Data:**

```
TeethRecord:
{
  "id": "t1a2b3c4-d5e6-7890-abcd-cccccccccccc",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "tooth_id": "O",
  "eruption_date": "2026-07-20",
  "notes": "First tooth! Lower right central incisor",
  "created_at": "2026-07-20T09:00:00Z"
}

TeethingSymptomLog:
{
  "id": "ts1a2b3c-d5e6-7890-abcd-dddddddddddd",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "date": "2026-07-17",
  "symptoms": "drooling,fussiness,biting",
  "severity": "moderate",
  "notes": "Started 3 days before first tooth appeared"
}
```

#### 3.7 Business Logic Rules

##### Tooth Progress Calculation

**Purpose:** Calculate how many teeth have erupted and the percentage of total primary teeth.

**Inputs:**
- child_id: string - the active child

**Logic:**

```
1. erupted_count = COUNT of TeethRecord entries where child_id matches
2. total_teeth = 20 (fixed, all primary teeth)
3. percentage = (erupted_count / total_teeth) * 100
4. RETURN {
     erupted_count,
     total_teeth,
     percentage: round(percentage, 0)
   }
```

##### Expected Eruption Window

**Purpose:** Provide the typical eruption age range for each tooth to contextualize whether a child's eruption timing is typical.

**Inputs:**
- tooth_id: string - the tooth to look up

**Logic:**

```
1. Look up tooth_id in the eruption reference table
2. RETURN {
     tooth_name,
     typical_start_months,
     typical_end_months,
     jaw: "upper" or "lower",
     position: "central_incisor", "lateral_incisor", "canine", "first_molar", "second_molar"
   }
```

**Reference Data (Bundled):**

| Tooth IDs | Name | Jaw | Typical Range (months) |
|-----------|------|-----|----------------------|
| E, F | Central Incisors | Upper | 8-12 |
| O, P | Central Incisors | Lower | 6-10 |
| D, G | Lateral Incisors | Upper | 9-13 |
| N, Q | Lateral Incisors | Lower | 10-16 |
| C, H | Canines | Upper | 16-22 |
| M, R | Canines | Lower | 17-23 |
| B, I | First Molars | Upper | 13-19 |
| L, S | First Molars | Lower | 14-18 |
| A, J | Second Molars | Upper | 25-33 |
| K, T | Second Molars | Lower | 23-31 |

**Edge Cases:**
- Child has a tooth erupt outside the typical range: this is normal variation. No warning or alert is shown
- The eruption reference is informational only, never diagnostic

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate tooth record | If user taps a tooth already recorded: "This tooth was already recorded on [date]. Would you like to update it?" with Update and Cancel | User updates or cancels |
| Eruption date in the future | Inline validation: "Date cannot be in the future" | User selects a valid date |
| Eruption date before child's birth | Inline validation: "Date cannot be before baby's birth date" | User selects a valid date |
| Database write fails | Toast: "Could not save. Please try again." | User retries |
| No symptoms selected on symptom log | Inline validation: "Select at least one symptom" | User selects a symptom |

**Validation Timing:**
- Date validation runs immediately on picker selection
- Duplicate tooth check runs when user taps a tooth that already has a record
- Symptom selection validated on Save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** no teeth have been recorded for the active child,
   **When** the user taps tooth O (lower right central incisor) on the diagram,
   **Then** the Record Eruption form opens with "Lower Right Central Incisor - Tooth O" pre-filled.

2. **Given** the user records tooth O with an eruption date of July 20,
   **When** the user saves and returns to the diagram,
   **Then** tooth O changes from a gray outline to a filled white shape with a pop animation, and the progress shows "1 of 20 teeth (5%)".

3. **Given** the user logs a teething symptom (drooling, fussiness, moderate severity) on July 17,
   **When** the user views the teething timeline,
   **Then** the timeline shows the symptom entry on July 17 and the tooth eruption on July 20, creating a visual correlation.

**Edge Cases:**

4. **Given** 19 of 20 teeth have been recorded,
   **When** the user records the 20th tooth,
   **Then** the progress shows "20 of 20 teeth (100%)" with a celebratory message.

5. **Given** a tooth was recorded with the wrong date,
   **When** the user taps the erupted tooth and updates the date,
   **Then** the date is updated in the timeline and detail view.

**Negative Tests:**

6. **Given** tooth O has already been recorded,
   **When** the user taps tooth O on the diagram,
   **Then** the system shows the existing record with an option to update, not a duplicate entry form.

7. **Given** the user is logging a symptom,
   **When** the user taps Save without selecting any symptoms,
   **Then** the system shows "Select at least one symptom" and does not save.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates tooth progress | 5 teeth recorded | { erupted: 5, total: 20, percentage: 25 } |
| calculates 0% progress | 0 teeth recorded | { erupted: 0, total: 20, percentage: 0 } |
| calculates 100% progress | 20 teeth recorded | { erupted: 20, total: 20, percentage: 100 } |
| looks up eruption window for tooth O | tooth_id: "O" | { name: "Central Incisor", jaw: "lower", range: "6-10 months" } |
| validates tooth_id is in A-T range | tooth_id: "Z" | validation error |
| validates eruption date not in future | date: tomorrow | validation error |
| validates at least one symptom selected | symptoms: [] | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Record a tooth eruption | 1. Tap tooth O, 2. Set date, 3. Save | Tooth fills in on diagram, progress updates, timeline adds entry |
| Log a teething symptom | 1. Tap Log Symptom, 2. Select drooling + fussiness, 3. Set severity to moderate, 4. Save | Symptom appears in timeline on the selected date |
| Update an existing tooth record | 1. Tap an erupted tooth, 2. Change date, 3. Save | Date updates in timeline and detail view |
| View teething timeline | 1. Record 3 teeth and 5 symptom logs, 2. View timeline | All events sorted chronologically, teeth and symptoms interleaved |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Track first 4 teeth with symptoms | 1. Log symptoms for 5 days, 2. Record first tooth eruption, 3. Repeat for 3 more teeth over 2 months | Diagram shows 4 filled teeth, timeline shows symptoms and eruptions correlated, progress at 20% |
| Complete all primary teeth | 1. Record all 20 teeth over 2+ years | Diagram fully filled, progress at 100%, celebratory message displayed |

---

### BB-015: First Experiences Journal

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-015 |
| **Feature Name** | First Experiences Journal |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a parent, I want to record my baby's "firsts" (first smile, first laugh, first steps, first word), so that I have a keepsake record of these precious milestones.

**Secondary:**
> As a parent, I want to attach a photo or video reference to each first experience, so that I can remember not just when it happened but what it looked like.

**Tertiary:**
> As a parent of multiple children, I want to compare when each child had their firsts, so that I can appreciate each child's unique development journey.

#### 3.3 Detailed Description

The First Experiences Journal is a memory-keeping feature that goes beyond the clinical milestone tracking (BB-007). While milestones track developmental checkpoints based on the CDC schedule, the First Experiences Journal captures the personal, emotional moments that matter to parents: first giggle, first time meeting a pet, first trip to the park, first time eating pizza, first haircut, first holiday.

The app provides a pre-populated list of 50 common "firsts" organized into categories, plus the ability to add custom firsts. The categories are:

- **Physical firsts (12 items):** First smiled, first laughed, first rolled over, first sat up, first crawled, first stood up, first steps, first ran, first climbed, first jumped, first danced, first swam
- **Communication firsts (8 items):** First cooed, first babbled, first word, first sentence, first sang, first said "mama", first said "dada", first waved bye-bye
- **Food firsts (8 items):** First solid food, first finger food, first self-fed with spoon, first drank from cup, first ate pizza, first ate ice cream, first tried a lemon, first restaurant meal
- **Social firsts (8 items):** First met grandparents, first playdate, first time left with a sitter, first sleepover, first friend, first shared a toy, first birthday party, first time at daycare
- **Travel and outdoor firsts (8 items):** First trip to the park, first beach visit, first airplane ride, first road trip, first camping, first time in the snow, first zoo visit, first museum visit
- **Fun firsts (6 items):** First bath (enjoyed), first haircut, first time in a shopping cart, first pet interaction, first holiday, first time saying "no"

Each first experience entry records: the experience name, the date it happened, a text description or memory (optional, max 1000 characters), and up to 3 photos. The entry is displayed as a card with the photo as a background and the experience name and date overlaid.

The journal view shows all recorded firsts as a chronological timeline (by date) or a grid of photo cards. Unrecorded firsts from the pre-populated list are shown separately as "Upcoming firsts" for inspiration. Users can also create fully custom entries not in the pre-populated list.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - experiences are associated with a specific child

**External Dependencies:**
- Device camera or photo library access for photos
- Local storage for persisting journal entries

**Assumed Capabilities:**
- An active child profile exists

#### 3.5 User Interface Requirements

##### Screen: First Experiences Timeline

**Layout:**
- A toggle at the top to switch between "Timeline" view (chronological list) and "Grid" view (photo card grid)
- **Timeline view:** A vertical chronological list with date markers. Each entry shows: the experience name in bold, the date, a thumbnail photo (if attached), and the first line of the description
- **Grid view:** A 2-column grid of square photo cards. Each card shows the primary photo as the background (or a category-colored placeholder if no photo), the experience name in white text at the bottom, and the date. Cards are sorted by date, most recent first
- Below the recorded entries, an "Upcoming Firsts" section showing un-recorded experiences from the pre-populated list, organized by category. Each is tappable to record it
- A floating action button "+" to add a custom or pre-populated first experience

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No firsts recorded | Message: "Your baby's firsts are waiting! Tap one from the list below or add your own." The pre-populated list is prominently displayed |
| Populated | Firsts exist | Timeline or grid shows recorded entries, upcoming firsts shown below |
| All Recorded | All 50 pre-populated firsts recorded | "All suggested firsts recorded!" badge at the top. Custom entries can still be added |

**Interactions:**
- Tap a recorded entry: opens the Experience Detail screen
- Tap an upcoming first: opens the Record Experience form pre-filled with the experience name
- Tap "+": opens a form to add a custom experience (name is editable)
- Toggle Timeline/Grid: switches view mode with a crossfade, 200ms
- Long press a recorded entry: opens a context menu with "Edit" and "Delete"
- Swipe left on a timeline entry: reveals "Delete"

**Transitions/Animations:**
- New entries in timeline view animate in with a slide-down + fade, 250ms
- Grid cards use a staggered fade-in when the view first loads (50ms stagger)
- View toggle uses a crossfade, 250ms

##### Bottom Sheet: Record Experience

**Layout:**
- Experience name: text input (pre-filled for pre-populated firsts, editable for custom)
- Category: picker with the 6 categories listed above (auto-selected for pre-populated, editable)
- Date: date picker, defaults to today, cannot be in the future or before child's DOB
- Description: optional text area, max 1000 characters. Placeholder: "Describe this moment..."
- Photos: up to 3 photo slots. Tap to add from camera or library. Long press to remove
- Save button

#### 3.6 Data Requirements

##### Entity: FirstExperience

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this experience belongs to |
| experience_name | string | Required, max 200 characters | None | Name of the experience |
| category | enum | One of: "physical", "communication", "food", "social", "travel", "fun", "custom" | "custom" | Category grouping |
| experience_date | date | Required, must not be in the future, must not be before child's DOB | Today | When the experience occurred |
| description | string | Optional, max 1000 characters | null | Parent's description or memory |
| photo_uris | string | Optional, comma-separated, max 3 URIs | null | Local file paths to up to 3 photos |
| is_predefined | boolean | - | false | Whether this came from the pre-populated list |
| predefined_id | string | Optional, references a predefined experience ID | null | Links to the pre-populated list item (for tracking which have been recorded) |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- FirstExperience belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, experience_date) - for chronological queries
- (child_id, predefined_id) - for checking which pre-populated firsts have been recorded

**Validation Rules:**
- experience_name: required, not empty after trimming
- experience_date: must not be in the future, must not be before child's DOB
- photo_uris: max 3 photos
- For pre-populated firsts: only one record per child per predefined_id

**Example Data:**

```
{
  "id": "fe1a2b3c-d5e6-7890-abcd-eeeeeeeeeeee",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "experience_name": "First steps",
  "category": "physical",
  "experience_date": "2026-11-20",
  "description": "Took 3 wobbly steps from the couch to the coffee table! Dad caught it on video. She looked so proud of herself.",
  "photo_uris": "/local/photos/first_steps_1.jpg,/local/photos/first_steps_2.jpg",
  "is_predefined": true,
  "predefined_id": "physical_first_steps",
  "created_at": "2026-11-20T18:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Upcoming Firsts Calculation

**Purpose:** Determine which pre-populated firsts have not yet been recorded for the active child.

**Inputs:**
- child_id: string - the active child

**Logic:**

```
1. Get all 50 predefined experience IDs
2. Get all FirstExperience entries where child_id matches AND is_predefined = true
3. recorded_ids = set of predefined_id values from step 2
4. upcoming = predefined experiences where id NOT IN recorded_ids
5. Group upcoming by category
6. RETURN upcoming grouped by category
```

**Edge Cases:**
- All 50 recorded: return empty upcoming list
- None recorded: return all 50 grouped by category

##### Experience Count Summary

**Purpose:** Provide a count of recorded experiences for display.

**Inputs:**
- child_id: string - the active child

**Logic:**

```
1. total_recorded = COUNT of FirstExperience entries where child_id matches
2. predefined_recorded = COUNT where is_predefined = true
3. custom_recorded = COUNT where is_predefined = false
4. RETURN {
     total_recorded,
     predefined_recorded,
     predefined_total: 50,
     custom_recorded
   }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Experience name is empty | Inline validation: "Experience name is required" | User enters a name |
| Date in the future | Inline validation: "Date cannot be in the future" | User selects a valid date |
| Photo selection fails | Toast: "Could not access photos. Check permissions in Settings." | User grants permission |
| More than 3 photos selected | Toast: "Maximum 3 photos per experience" | User removes excess photos |
| Database write fails | Toast: "Could not save. Please try again." | User retries |
| Duplicate predefined entry | If user tries to record a predefined first already recorded: "This experience was already recorded on [date]. Would you like to update it?" | User updates or cancels |

**Validation Timing:**
- Name validation runs on Save
- Date validation runs on picker selection
- Photo count validated on each photo add

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** no first experiences have been recorded,
   **When** the user opens the First Experiences Journal,
   **Then** the screen shows the encouraging empty state message and the full list of 50 pre-populated upcoming firsts organized by category.

2. **Given** the user taps "First steps" from the upcoming firsts list,
   **When** the Record Experience form opens,
   **Then** the experience name is pre-filled as "First steps" and the category is set to "Physical".

3. **Given** the user records "First steps" with a date, description, and 2 photos,
   **When** the user saves,
   **Then** the entry appears at the top of the timeline, a photo card appears in the grid view, and "First steps" is removed from the upcoming firsts list.

4. **Given** the user wants to record a custom first not in the pre-populated list,
   **When** the user taps "+" and enters "First time at the farmer's market",
   **Then** the custom entry is saved with category "custom" and appears in the timeline.

**Edge Cases:**

5. **Given** all 50 pre-populated firsts have been recorded,
   **When** the user views the journal,
   **Then** the "Upcoming Firsts" section shows "All suggested firsts recorded!" and the "+" button is still available for custom entries.

6. **Given** an experience has 3 photos attached,
   **When** the user tries to add a 4th,
   **Then** the system shows "Maximum 3 photos per experience" and blocks the addition.

**Negative Tests:**

7. **Given** the user is recording a first experience,
   **When** the user leaves the name blank and taps Save,
   **Then** the system shows "Experience name is required" and does not save.

8. **Given** "First smiled" has already been recorded,
   **When** the user taps "First smiled" from the upcoming list,
   **Then** the system shows the existing record with an option to update, not a duplicate entry.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates upcoming firsts | 10 predefined recorded | 40 upcoming |
| calculates all recorded | 50 predefined recorded | 0 upcoming |
| groups upcoming by category | 40 upcoming across 6 categories | grouped correctly |
| counts total experiences | 10 predefined + 3 custom | total: 13, predefined: 10, custom: 3 |
| validates experience name not empty | name: "  " | validation error |
| validates max 3 photos | 4 photo URIs | validation error |
| validates date not in future | date: tomorrow | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Record a predefined first | 1. Tap "First smiled" from upcoming, 2. Set date, add description, 3. Save | Entry appears in timeline, removed from upcoming list |
| Record a custom first | 1. Tap +, 2. Enter custom name and details, 3. Save | Entry appears in timeline under "custom" category |
| Add photos to an experience | 1. Open experience detail, 2. Add 2 photos | Photos display in the detail view and as the card background in grid view |
| Delete an experience | 1. Swipe left on a timeline entry, 2. Tap Delete | Entry removed from timeline, if predefined it returns to upcoming list |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent records firsts over 6 months | 1. Record "First smiled" at 2 months, 2. "First laughed" at 3 months, 3. "First solid food" at 5 months, 4. "First sat up" at 6 months | Timeline shows 4 entries in chronological order, grid shows 4 photo cards, 46 upcoming firsts remain |
| Parent creates a custom experience album | 1. Record 5 custom firsts with photos, 2. View grid | Grid shows 5 photo cards for custom experiences |

---

### BB-016: Multi-Child Support

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-016 |
| **Feature Name** | Multi-Child Support |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a parent of twins, I want to maintain separate tracking logs for each baby, so that I can monitor their individual feeding, sleep, and growth patterns.

**Secondary:**
> As a parent with a newborn and a toddler, I want to quickly switch between children's profiles without losing my place, so that I can manage both children efficiently.

**Tertiary:**
> As a parent of two children, I want to compare their growth charts side by side, so that I can see how their growth patterns differ.

#### 3.3 Detailed Description

Multi-Child Support extends the single-child experience to families with multiple children. While BB-001 establishes the child profile and child switcher foundation, this feature adds the workflows, UI patterns, and data comparison tools that make managing multiple children practical and efficient.

The core capability is fast switching. Parents of multiples (especially twins) switch between profiles dozens of times per day. The child switcher is accessible from every screen in the module via the header. Switching completes in under 300ms with no loading screen. The previous child's state (scroll position, active tab) is preserved so that switching back restores the view.

For parents of twins or multiples born on the same day, a "Log for Multiple" feature allows logging the same activity for multiple children simultaneously. For example, after a tandem breastfeeding session, the parent can select both twins and log a feeding entry for each with one form submission. The entries are identical except for the child_id. This saves significant time for parents of multiples.

Growth chart comparison allows overlaying two or more children's growth curves on the same chart. Each child's data is plotted in a different color with a legend. This works across all three measurement types (weight, length, head circumference). The comparison accounts for different ages by aligning data by age rather than calendar date.

A multi-child daily summary view shows a compact view of all children's daily summaries on one screen, useful for parents who want a single glance at the whole family's day. Each child gets a condensed summary card with: name, photo, last feed time, last sleep time, last diaper time, and total counts.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - multi-child depends on the profile system

**External Dependencies:**
- Local storage sufficient for multiple children's data

**Assumed Capabilities:**
- Two or more child profiles exist

#### 3.5 User Interface Requirements

##### Component: Enhanced Child Switcher

**Layout:**
- The enhanced switcher extends BB-001's basic switcher with additional features:
  - Each child row shows: photo, name, age, and a mini-summary (last feed, last sleep, last diaper times in compact format)
  - A "Quick Switch" gesture: swipe the header left/right to cycle through children without opening the full switcher
  - For twins/multiples: a "Twins" badge on profiles that share the same date of birth
- The switcher preserves the per-child navigation state (which tab was active, scroll position) and restores it on switch

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Single Child | Only one profile exists | Switcher is not shown. Header shows child name without dropdown arrow |
| Two Children | Two profiles exist | Swipe gesture enabled, dropdown shows both with mini-summaries |
| Three+ Children | Three or more profiles | Full dropdown list with scrolling, swipe cycles through in order |
| Twins | Two profiles with same DOB | Twins badge shown, "Log for Multiple" option available on activity logging |

**Interactions:**
- Tap header: opens the full child switcher (same as BB-001 but enhanced with mini-summaries)
- Swipe header left: switch to the next child (circular, wraps from last to first)
- Swipe header right: switch to the previous child
- Tap "Add Another Child": navigates to Profile Creation

##### Component: Log for Multiple

**Layout:**
- Accessible from any logging bottom sheet (feeding, sleep, diaper) when 2+ profiles with the same DOB exist
- A "Log for Multiple" toggle at the top of the logging sheet
- When toggled on: a child multi-select appears showing all children. User selects which children should receive this log entry
- On save: identical entries are created for each selected child

**Interactions:**
- Toggle "Log for Multiple" on: child selection checkboxes appear
- Select/deselect children: tap checkboxes
- Save: creates one entry per selected child

##### Screen: Growth Chart Comparison

**Layout:**
- Extends BB-005 Growth Chart with a "Compare" toggle button in the top-right
- When Compare is active:
  - A child selection bar appears below the measurement tabs, showing all children's photos as selectable chips
  - Each selected child's data is plotted in a different color (using a predefined palette of 5 distinct colors)
  - A legend at the bottom of the chart maps colors to child names
  - The X-axis shows age (not calendar date) so children of different ages can be compared at the same developmental stage
- When Compare is inactive: standard single-child chart (BB-005 behavior)

**Interactions:**
- Tap "Compare": toggles comparison mode
- Tap a child chip: toggles that child's data on/off the chart
- Tap a data point: tooltip shows the child name, date, age, value, and percentile

##### Screen: Family Daily Summary

**Layout:**
- An optional alternative view accessible from a "Family View" toggle on the Daily Summary Dashboard
- Shows a vertically scrollable list of condensed summary cards, one per child
- Each card contains:
  - Child photo, name, and age (compact)
  - Last feed: time and type
  - Last sleep: time and duration (or "Sleeping: [elapsed]" if active)
  - Last diaper: time and type
  - Daily totals: [X] feeds, [X]h sleep, [X] diapers
- Cards are ordered by the child's position in the profile list (customizable via drag-to-reorder)

**Interactions:**
- Tap a child's card: switches to that child and navigates to their full Daily Summary Dashboard
- Tap a specific activity line on a card: switches to that child and navigates to the relevant activity log

#### 3.6 Data Requirements

Multi-Child Support does not introduce new persistent entities. It extends the behavior of existing entities and the UI layer. The key data requirement is that all entities (FeedingLog, SleepLog, DiaperLog, etc.) are already associated with a child_id, so multi-child queries are natively supported.

##### Persisted Settings for Multi-Child

| Field | Type | Description |
|-------|------|-------------|
| child_order | string | Comma-separated list of child_ids defining display order on the Family Daily Summary |
| last_active_child_state | JSON | Per-child map of {tab_index, scroll_position} for state preservation on switch |
| default_twins_logging | boolean | Whether "Log for Multiple" defaults to on for twins |

These settings are stored in the module settings table under the `bb_` prefix.

#### 3.7 Business Logic Rules

##### Fast Switch with State Preservation

**Purpose:** Switch between children while preserving and restoring per-child UI state.

**Inputs:**
- current_child_id: string - the currently active child
- target_child_id: string - the child to switch to
- current_state: object - current UI state (tab index, scroll position)

**Logic:**

```
1. Save current_state to last_active_child_state[current_child_id]
2. Set target_child_id as the active profile (BB-001 Active Profile Switching)
3. Restore last_active_child_state[target_child_id] if it exists
4. IF no saved state exists for target_child_id THEN
     Use default state (tab 0, scroll position 0)
5. Refresh all displayed data for target_child_id
6. Total switch time must complete within 300ms
```

**Edge Cases:**
- First switch to a child (no saved state): use defaults
- Child was deleted: remove their saved state and skip
- State references a screen that no longer exists: use defaults

##### Log for Multiple

**Purpose:** Create identical log entries for multiple children simultaneously.

**Inputs:**
- entry_data: object - the feeding/sleep/diaper entry data (without child_id)
- selected_child_ids: array of string - which children to log for

**Logic:**

```
1. Validate entry_data using the standard validation for the entry type
2. FOR EACH child_id IN selected_child_ids:
     Create a new entry with entry_data + child_id
     Save to database
3. IF any save fails:
     Log which children succeeded and which failed
     Show toast: "Saved for [X] of [Y] children. Retry for [failed children]?"
4. RETURN { success_count, fail_count, failed_child_ids }
```

**Edge Cases:**
- One save fails out of three: partial success, inform user which failed
- All saves fail: general error, entry data preserved for retry

##### Growth Comparison Alignment

**Purpose:** Align growth data from children of different ages for visual comparison.

**Inputs:**
- children: array of {child_id, date_of_birth}
- measurement_type: enum - "weight", "length", "head_circumference"

**Logic:**

```
1. FOR EACH child:
     Fetch all GrowthMeasurement entries for the child and measurement_type
     For each measurement, compute age_in_days = measurement_date - child.date_of_birth
2. Plot all children's data on the same chart with X-axis = age_in_days
3. Use WHO reference curves as the background (same for all children of the same sex)
4. Assign each child a unique color from the palette: [#4CAF50, #2196F3, #FF9800, #9C27B0, #F44336]
```

**Edge Cases:**
- Children of different sexes: show separate WHO reference curves or display a note that percentile comparison requires same-sex charts
- Only one child selected in compare mode: reverts to standard single-child view
- Children with no overlapping age ranges: chart shows both data sets at their respective ages, which may be widely separated on the X-axis

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Partial failure on Log for Multiple | Toast: "Saved for [child A] and [child B]. Could not save for [child C]. Retry?" with Retry button | User taps Retry for the failed child |
| Switch takes longer than 300ms (data-heavy profile) | No loading screen. If > 300ms, show a subtle activity indicator in the header | Data loads in background, UI updates when ready |
| Compare mode with different-sex children | Info banner: "Children have different sexes. Growth percentiles use sex-specific charts." | No action needed, informational only |
| State restoration fails (corrupted saved state) | Silently fall back to default state | No user action, default state used |

**Validation Timing:**
- Switch performance validated during development (< 300ms target)
- Log for Multiple validation runs once before the loop (not per child)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a parent has profiles for "Luna" (active) and "Max",
   **When** the parent swipes the header to the left,
   **Then** the active child switches to "Max" within 300ms, all displayed data refreshes, and the header shows Max's name and photo.

2. **Given** a parent has twin profiles sharing the same DOB,
   **When** the parent opens the Add Feeding sheet,
   **Then** a "Log for Multiple" toggle is visible at the top. Toggling it on shows checkboxes for both twins.

3. **Given** the parent selects both twins and logs a 4 oz bottle feeding,
   **When** the parent taps Save,
   **Then** both children receive a 4 oz bottle feeding entry at the same timestamp.

4. **Given** a parent is viewing Luna's growth chart and taps "Compare",
   **When** they select Max from the child chips,
   **Then** Max's growth data appears on the same chart in a different color, aligned by age, with a legend showing both children.

**Edge Cases:**

5. **Given** a parent was viewing the sleep tab for Luna and switches to Max,
   **When** the parent switches back to Luna,
   **Then** the sleep tab is still active (state was preserved during the switch).

6. **Given** one child has weight data and the compared child has no weight data,
   **When** comparison mode is active,
   **Then** the chart shows only the first child's data with a note that the second child has no measurements.

**Negative Tests:**

7. **Given** only one child profile exists,
   **When** the user views the header,
   **Then** no dropdown arrow or swipe gesture is available (single-child mode).

8. **Given** a "Log for Multiple" save fails for one of three children,
   **When** the error occurs,
   **Then** the system informs the user which children received the entry and offers to retry for the failed one.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| preserves child state on switch | save state for child A, switch to B, switch back | child A state restored |
| defaults when no saved state exists | switch to child with no saved state | default state (tab 0, scroll 0) |
| creates entries for multiple children | 2 child_ids, 1 entry_data | 2 entries created with identical data |
| handles partial failure | 3 child_ids, 1 fails | success: 2, fail: 1, failed_child_ids: [child_c] |
| aligns growth data by age | child A born Jan 1, child B born Jun 1, same measurement at 6 months | both plotted at age_in_days ~182 |
| detects twins (same DOB) | 2 profiles with same date_of_birth | twins: true |
| does not detect twins (different DOB) | 2 profiles with different DOB | twins: false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Switch children and verify data isolation | 1. Log feeding for child A, 2. Switch to child B | Child B's feeding log does not show child A's entry |
| Log for Multiple | 1. Select both twins, 2. Log a diaper, 3. Check both children's logs | Both have the diaper entry with the same timestamp |
| Growth comparison | 1. Add weight for child A, 2. Add weight for child B, 3. Enable compare | Both data points on the same chart in different colors |
| Family daily summary | 1. Log data for 2 children, 2. Open Family View | Both children's summaries shown on one screen |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Twin parent daily workflow | 1. Feed twin A, 2. Feed twin B, 3. Log diapers for both using Log for Multiple, 4. View Family Summary | Both twins have complete logs, family view shows both at a glance |
| Compare growth at pediatrician visit | 1. Add measurements for 2 children, 2. Open growth chart, 3. Enable compare | Side-by-side growth curves on the same chart, percentiles calculated independently |

---

### BB-017: Pediatrician Visit Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-017 |
| **Feature Name** | Pediatrician Visit Log |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a parent, I want to record notes from each pediatrician visit, so that I have a reference for what was discussed, what the doctor recommended, and any follow-up actions.

**Secondary:**
> As a parent preparing for a well-child visit, I want to see questions I have written down since the last visit, so that I do not forget to ask the doctor anything important.

**Tertiary:**
> As a parent tracking multiple aspects of baby care, I want the pediatrician visit log to link to growth measurements and vaccinations recorded at that visit, so that I have a complete picture of each appointment.

#### 3.3 Detailed Description

The Pediatrician Visit Log records well-child check-ups, sick visits, and any other pediatrician appointments. Each visit entry captures the visit date, visit type (well-child, sick, follow-up, specialist, emergency), the provider name, a summary of the visit, any diagnoses or concerns discussed, recommendations or instructions from the doctor, prescribed medications (which can optionally link to BB-013 Medicine Tracking), and follow-up actions with optional due dates.

A key feature is the "Questions for Next Visit" scratchpad. Between visits, parents frequently think of questions they want to ask the pediatrician. The scratchpad allows adding questions at any time, and they automatically appear on the next visit's detail screen. When the visit is logged, the parent can mark each question as "asked" or "deferred" to the next visit.

The visit log integrates with growth measurements (BB-005) and vaccinations (BB-008) by allowing the user to link growth measurements and vaccine doses recorded on the same date to the visit entry. This creates a comprehensive visit record: the growth data captured at the visit, the vaccines administered, the doctor's notes, and any action items.

The visit list screen shows a chronological history of visits. Each entry displays the date, visit type, provider name, and a preview of the summary. A "Next Visit" card at the top shows the next scheduled visit date (if set) with a countdown and the number of pending questions.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - visits are associated with a specific child

**External Dependencies:**
- Local storage for persisting visit records

**Assumed Capabilities:**
- An active child profile exists

#### 3.5 User Interface Requirements

##### Screen: Visit List

**Layout:**
- **Next Visit Card:** At the top, a card showing the next scheduled visit. If a next visit date is set, it displays: "Next visit: [date]" with a countdown (e.g., "in 12 days"), the visit type (e.g., "6-month well-child"), and "[X] questions for the doctor". If no next visit is scheduled, the card shows "Schedule your next visit" as a tap target
- **Questions Scratchpad:** Below the next visit card, a collapsible section showing pending questions. Each question is a text item with a delete (X) button. An "Add Question" text input at the bottom allows typing new questions inline
- **Visit History:** Below the scratchpad, a vertically scrollable list of past visits in reverse chronological order. Each row shows: visit date, visit type badge (color-coded: green for well-child, amber for sick, blue for follow-up, purple for specialist, red for emergency), provider name, and the first line of the visit summary
- A floating action button "+" to log a new visit

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No visits logged | Message: "No visit records yet. Tap + to log a visit." Next visit card shows scheduling prompt |
| Populated | Visits exist | Chronological list with next visit card |
| Questions Pending | Questions exist in scratchpad | Question count badge on the next visit card, scratchpad expanded by default |
| No Upcoming Visit | Next visit date not set or in the past | Next visit card prompts to schedule |

**Interactions:**
- Tap a visit row: opens the Visit Detail screen
- Tap "+": opens the Log Visit form
- Tap "Add Question" in scratchpad: adds a new question to the pending list
- Tap the X on a question: removes it from the pending list
- Tap the Next Visit card: opens a date picker to set or update the next visit date
- Swipe left on a visit row: reveals "Delete"

**Transitions/Animations:**
- New questions added with a slide-in from the bottom, 200ms
- Questions removed with a fade + slide-right, 200ms
- Visit rows animate in with a stagger on first load

##### Bottom Sheet: Log Visit

**Layout:**
- Visit date: date picker, defaults to today
- Visit type: segmented control with options: "Well-Child", "Sick", "Follow-Up", "Specialist", "Emergency"
- Provider name: text input with autocomplete from previously entered providers, max 200 characters
- Summary: text area for a general summary of the visit, max 2000 characters. Placeholder: "What was discussed at this visit?"
- Diagnoses/concerns: text area, max 1000 characters. Placeholder: "Any diagnoses or concerns noted..."
- Recommendations: text area, max 1000 characters. Placeholder: "Doctor's recommendations..."
- Prescribed medications: optional list. Each item has a name input and a "Link to Medicine Tracking" toggle (creates a MedicineProfile in BB-013)
- Follow-up actions: optional list of action items, each with text (max 300 chars) and an optional due date
- Next visit date: optional date picker for scheduling the follow-up
- **Pending Questions section:** Shows all questions from the scratchpad. Each has "Asked" and "Defer" buttons. Asked questions are marked as resolved. Deferred questions carry over to the next visit
- Link to growth data: if growth measurements exist for the visit date, a link/badge shows "Growth data recorded today" (tappable to view)
- Link to vaccinations: if vaccination records exist for the visit date, a link/badge shows "Vaccinations recorded today" (tappable to view)
- Save button

#### 3.6 Data Requirements

##### Entity: PediatricianVisit

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this visit is for |
| visit_date | date | Required, must not be in the future | Today | Date of the visit |
| visit_type | enum | One of: "well_child", "sick", "follow_up", "specialist", "emergency" | "well_child" | Type of visit |
| provider_name | string | Optional, max 200 characters | null | Name of the doctor or clinic |
| summary | string | Optional, max 2000 characters | null | General summary of the visit |
| diagnoses | string | Optional, max 1000 characters | null | Diagnoses or concerns discussed |
| recommendations | string | Optional, max 1000 characters | null | Doctor's recommendations |
| next_visit_date | date | Optional, must be in the future | null | Scheduled date for the next visit |
| notes | string | Optional, max 1000 characters | null | Additional notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: VisitFollowUpAction

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| visit_id | string | Required, references PediatricianVisit.id | None | The visit this action belongs to |
| action_text | string | Required, max 300 characters | None | What needs to be done |
| due_date | date | Optional | null | When this should be completed by |
| completed | boolean | - | false | Whether the action has been completed |
| completed_date | date | Optional | null | When the action was completed |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: DoctorQuestion

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this question relates to |
| question_text | string | Required, max 500 characters | None | The question to ask the doctor |
| status | enum | One of: "pending", "asked", "deferred" | "pending" | Current status of the question |
| asked_at_visit_id | string | Optional, references PediatricianVisit.id | null | The visit where this question was addressed |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- PediatricianVisit belongs to ChildProfile (many-to-one via child_id)
- VisitFollowUpAction belongs to PediatricianVisit (many-to-one via visit_id)
- DoctorQuestion belongs to ChildProfile (many-to-one via child_id)
- DoctorQuestion optionally references PediatricianVisit (via asked_at_visit_id)

**Indexes:**
- PediatricianVisit: (child_id, visit_date) - for chronological listing
- DoctorQuestion: (child_id, status) - for fetching pending questions
- VisitFollowUpAction: (visit_id, completed) - for listing incomplete actions

**Validation Rules:**
- visit_date: must not be in the future
- next_visit_date: if provided, must be in the future
- question_text: required, not empty after trimming
- action_text: required, not empty after trimming

**Example Data:**

```
PediatricianVisit:
{
  "id": "pv1a2b3c-d5e6-7890-abcd-ffffffffffff",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "visit_date": "2026-03-01",
  "visit_type": "well_child",
  "provider_name": "Dr. Sarah Chen",
  "summary": "4-month well-child visit. Baby is healthy and developing on track. Weight: 55th percentile, length: 60th percentile.",
  "diagnoses": null,
  "recommendations": "Start tummy time 3x daily. Continue vitamin D drops. Begin introducing solid foods at 6 months.",
  "next_visit_date": "2026-05-01"
}
```

#### 3.7 Business Logic Rules

##### Next Visit Countdown

**Purpose:** Calculate the countdown to the next scheduled visit.

**Inputs:**
- next_visit_date: date - the scheduled date
- today: date - the current date

**Logic:**

```
1. days_until = next_visit_date - today
2. IF days_until < 0 THEN
     RETURN { overdue: true, days_overdue: abs(days_until), label: "Visit was {days_overdue} days ago" }
3. IF days_until = 0 THEN
     RETURN { today: true, label: "Visit is today!" }
4. IF days_until <= 7 THEN
     RETURN { label: "in {days_until} days" }
5. weeks = floor(days_until / 7)
   RETURN { label: "in {weeks} weeks" }
```

##### Pending Questions for Visit

**Purpose:** Gather all pending questions for display at a visit.

**Inputs:**
- child_id: string - the active child

**Logic:**

```
1. Query all DoctorQuestion entries where child_id matches AND status = "pending"
2. Sort by created_at ascending (oldest first)
3. RETURN list of pending questions
```

##### Visit-Growth-Vaccination Linking

**Purpose:** Find growth measurements and vaccinations recorded on the same date as a visit.

**Inputs:**
- child_id: string - the active child
- visit_date: date - the visit date

**Logic:**

```
1. linked_growth = SELECT * FROM GrowthMeasurement WHERE child_id = child_id AND measurement_date = visit_date
2. linked_vaccines = SELECT * FROM VaccinationRecord WHERE child_id = child_id AND administered_date = visit_date AND administered = true
3. RETURN { growth: linked_growth, vaccines: linked_vaccines }
```

**Edge Cases:**
- No growth data or vaccines on visit date: no links shown
- Multiple growth measurements on visit date: all are linked (weight, length, head circumference are commonly all measured at one visit)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Visit date in the future | Inline validation: "Visit date cannot be in the future" | User selects a valid date |
| Question text is empty | Inline validation: "Question cannot be empty" | User enters a question |
| Database write fails | Toast: "Could not save visit. Please try again." | User retries |
| Follow-up action text is empty | Inline validation: "Action item cannot be empty" | User enters action text |
| Linked growth data deleted after visit | Link badge disappears, visit entry remains intact | No action needed, link was informational |

**Validation Timing:**
- Date validation runs on picker selection
- Question text validated on add
- Visit form validated on Save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has an active child profile,
   **When** the user taps "+" to log a new visit and enters the date, selects "Well-Child", enters a summary, and taps Save,
   **Then** the visit appears in the visit history list with the correct date, type badge, and summary preview.

2. **Given** the user adds a question "Should we start sleep training?" to the scratchpad,
   **When** the user views the pending questions,
   **Then** the question appears in the scratchpad with a delete (X) button.

3. **Given** 3 pending questions exist when the user logs a visit,
   **When** the user views the Log Visit form,
   **Then** all 3 questions appear in the Pending Questions section with "Asked" and "Defer" buttons.

4. **Given** growth measurements and vaccinations were recorded on March 1,
   **When** the user logs a visit for March 1,
   **Then** the visit entry shows "Growth data recorded today" and "Vaccinations recorded today" links.

**Edge Cases:**

5. **Given** the next visit date is 2 days from now,
   **When** the user views the visit list,
   **Then** the Next Visit card shows "in 2 days" with the pending question count.

6. **Given** a question is marked "Defer" at a visit,
   **When** the user prepares for the next visit,
   **Then** the deferred question appears in the pending questions for the next visit.

**Negative Tests:**

7. **Given** the user is logging a visit,
   **When** the user sets the visit date to tomorrow,
   **Then** the system shows "Visit date cannot be in the future" and does not save.

8. **Given** the user tries to add an empty question,
   **When** the user taps Add with a blank question field,
   **Then** the system shows "Question cannot be empty."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates countdown for future visit | visit in 12 days | label: "in 12 days" |
| calculates countdown for visit today | visit today | label: "Visit is today!" |
| calculates overdue visit | visit was 3 days ago | overdue: true, label: "Visit was 3 days ago" |
| calculates countdown in weeks | visit in 21 days | label: "in 3 weeks" |
| fetches pending questions | 3 pending, 2 asked | returns 3 pending questions |
| links growth data to visit | 2 growth measurements on visit date | linked: 2 measurements |
| links vaccines to visit | 3 vaccines on visit date | linked: 3 vaccines |
| no links when no data on visit date | no measurements or vaccines on date | linked: empty |
| deferred question stays pending | question status: "deferred" at visit | remains in pending for next visit |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log a visit with full details | 1. Fill all fields, 2. Answer 2 pending questions, defer 1, 3. Save | Visit saved, 2 questions marked asked, 1 deferred, follow-up actions created |
| Growth data linked to visit | 1. Log growth measurement for today, 2. Log visit for today | Visit shows "Growth data recorded today" link |
| Schedule next visit | 1. Set next visit date in visit form, 2. Save, 3. View visit list | Next Visit card shows the scheduled date and countdown |
| Add and view pending questions | 1. Add 3 questions to scratchpad, 2. View visit list | Next Visit card shows "3 questions for the doctor" |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Well-child visit workflow | 1. Add questions between visits, 2. Record growth and vaccines at the visit, 3. Log the visit with summary, address questions, add follow-up actions, schedule next visit | Complete visit record linked to growth/vaccine data, questions resolved, next visit scheduled |
| Sick visit follow-up | 1. Log sick visit with diagnosis, 2. Add prescribed medication (linked to Medicine Tracking), 3. Set follow-up visit date | Medicine profile created, follow-up visit scheduled, visit history shows both visits |

---

### BB-018: Solid Food Introduction Tracker

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-018 |
| **Feature Name** | Solid Food Introduction Tracker |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a parent starting solids at 6 months, I want to track which foods my baby has tried and how they reacted, so that I can identify allergies early and expand their diet systematically.

**Secondary:**
> As a parent following the "3-day wait" rule for allergen introduction, I want the app to warn me if I am introducing a new food before the waiting period has ended for the previous new food, so that I can isolate the cause of any allergic reaction.

**Tertiary:**
> As a parent, I want to see a visual summary of which food categories my baby has tried (fruits, vegetables, grains, proteins, dairy), so that I can ensure dietary variety.

#### 3.3 Detailed Description

The Solid Food Introduction Tracker goes beyond the basic solid food logging in the Feeding Log (BB-002). While BB-002 captures individual solid food feeding events with name and reaction, this feature provides a systematic approach to food introduction that is critical for allergy identification and dietary expansion.

The core concept is the Food Introduction Record. When a baby tries a food for the first time, the parent creates an introduction record. This record tracks: the food name, the date of first introduction, the food category (fruit, vegetable, grain, protein, dairy, common allergen, other), and the baby's reaction over the waiting period.

The "3-day wait rule" (also called the "4-day wait rule" by some pediatricians) recommends introducing only one new food at a time and waiting 3-4 days before introducing the next new food. This allows parents to identify which food caused an allergic reaction if one occurs. The tracker enforces this as a configurable advisory (not a hard block): if the parent tries to introduce a new food within 3 days of the last new food, a warning is shown. The waiting period is configurable in Settings (BB-020): 3 days (default), 4 days, or disabled.

Each food has a status that progresses through: "New" (just introduced, in waiting period), "Cleared" (waiting period passed with no adverse reaction), "Caution" (mild reaction observed, try again later), and "Avoid" (allergic reaction confirmed). The status is set by the parent based on the baby's response.

A food catalog view organizes all introduced foods into categories with visual indicators of status. A "Ready for new food" indicator shows whether the waiting period has elapsed since the last introduction. A common allergens checklist highlights the top 9 allergens (milk, eggs, peanuts, tree nuts, soy, wheat, fish, shellfish, sesame) with special attention.

The tracker also suggests age-appropriate first foods for parents who are unsure what to introduce. Suggestions include: single-grain cereals (4-6 months), pureed vegetables and fruits (6 months), mashed proteins (7-8 months), finger foods (8-10 months), and mixed textures (10-12 months).

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-002: Feeding Log - solid food feeding events are logged via BB-002, this feature adds the introduction tracking layer
- BB-001: Child Profile Management - food introductions are per-child

**External Dependencies:**
- Local storage for persisting food introduction records

**Assumed Capabilities:**
- An active child profile exists
- The child is at an age where solid food introduction is relevant (typically 4-6+ months)

#### 3.5 User Interface Requirements

##### Screen: Food Introduction Dashboard

**Layout:**
- **Status Banner:** At the top, a status indicator:
  - "Ready for a new food!" (green, if the waiting period has passed since the last introduction)
  - "Waiting period: [X days remaining]" (amber, with the food name in the waiting period)
  - "No foods introduced yet" (neutral, first-time state)
- **Food Category Grid:** Below the banner, a grid of food category tiles (2 columns):
  - Fruits (apple icon)
  - Vegetables (carrot icon)
  - Grains (wheat icon)
  - Proteins (drumstick icon)
  - Dairy (milk icon)
  - Common Allergens (warning icon)
  - Other (circle icon)
  - Each tile shows the category name, an icon, and a count "[X] foods tried"
  - Tapping a tile navigates to the category detail list
- **Recent Introductions:** Below the grid, a list of the 5 most recently introduced foods, each showing: food name, introduction date, status badge (New/Cleared/Caution/Avoid), and the category
- **Age-Appropriate Suggestions:** A collapsible section at the bottom with suggested foods based on the baby's age
- A floating action button "+" to introduce a new food

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No foods introduced | Encouraging message with age-appropriate suggestions prominent |
| Waiting | In the middle of a waiting period | Amber waiting banner with countdown, "+" still accessible (warning on use) |
| Ready | Waiting period elapsed or no active waiting period | Green "Ready" banner, "+" button prominent |
| Comprehensive | 20+ foods introduced | Full grid with counts, recent list populated |

**Interactions:**
- Tap a category tile: opens the category detail showing all foods in that category with statuses
- Tap a recent introduction: opens the Food Detail screen
- Tap "+": opens the Introduce New Food form
- Tap the waiting period banner: shows details about the food in the waiting period and its status
- Tap an age-appropriate suggestion: pre-fills the Introduce New Food form

**Transitions/Animations:**
- Category tile counts update with a brief bounce animation when a new food is added
- Waiting period banner transitions smoothly from amber to green when the period ends
- Status badge color changes with a crossfade, 200ms

##### Bottom Sheet: Introduce New Food

**Layout:**
- Food name: text input with autocomplete from a bundled list of common baby foods (~100 items), max 200 characters
- Category: picker with the 7 categories. Auto-selected if the food is in the bundled list
- Common allergen toggle: a checkbox "This is a common allergen" (auto-checked for foods in the top 9 allergens list)
- Introduction date: date picker, defaults to today
- Initial reaction: four buttons "No Reaction", "Liked It", "Disliked It", "Possible Reaction" (optional, can be updated later)
- Notes: optional text area, max 500 characters
- **3-day wait warning:** If another food is in an active waiting period, a warning banner appears: "You introduced [food] [X days] ago. It is recommended to wait [Y days] between new foods. Introduce anyway?"
- Save button

##### Screen: Food Detail

**Layout:**
- Food name in large text at the top
- Category badge and common allergen badge (if applicable)
- Introduction date
- Status selector: four buttons "New", "Cleared", "Caution", "Avoid" with current status highlighted
  - New: gray, "In waiting period or not yet assessed"
  - Cleared: green, "No adverse reaction observed"
  - Caution: amber, "Mild reaction, try again later"
  - Avoid: red, "Allergic reaction, do not serve"
- Reaction history: a list of observations. Users can add dated notes about the baby's reaction (e.g., "Day 1: No reaction", "Day 2: Mild rash on cheeks")
- Feeding instances: auto-populated from FeedingLog (BB-002) entries where food_name matches. Shows dates and quantities from the feeding log
- Notes: editable text area
- "Delete Food" button at the bottom

#### 3.6 Data Requirements

##### Entity: FoodIntroduction

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this record belongs to |
| food_name | string | Required, max 200 characters | None | Name of the food |
| category | enum | One of: "fruit", "vegetable", "grain", "protein", "dairy", "allergen", "other" | "other" | Food category |
| is_common_allergen | boolean | - | false | Whether this is a top-9 allergen |
| introduction_date | date | Required, must not be in the future | Today | Date of first introduction |
| status | enum | One of: "new", "cleared", "caution", "avoid" | "new" | Current status of the food |
| initial_reaction | enum | One of: "no_reaction", "liked", "disliked", "possible_reaction" | null | Reaction on first introduction |
| notes | string | Optional, max 500 characters | null | General notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: FoodReactionObservation

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| food_id | string | Required, references FoodIntroduction.id | None | Which food this observation is for |
| observation_date | date | Required | Today | Date of the observation |
| observation_text | string | Required, max 500 characters | None | What was observed |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Relationships:**
- FoodIntroduction belongs to ChildProfile (many-to-one via child_id)
- FoodReactionObservation belongs to FoodIntroduction (many-to-one via food_id)

**Indexes:**
- FoodIntroduction: (child_id, category) - for category-grouped queries
- FoodIntroduction: (child_id, introduction_date) - for chronological queries and waiting period checks
- FoodIntroduction: (child_id, status) - for filtering by status

**Validation Rules:**
- food_name: required, not empty after trimming
- introduction_date: must not be in the future, must not be before child's DOB
- Unique food names per child (case-insensitive)

**Example Data:**

```
FoodIntroduction:
{
  "id": "fi1a2b3c-d5e6-7890-abcd-123456789012",
  "child_id": "c1a2b3d4-e5f6-7890-abcd-111111111111",
  "food_name": "Sweet potato",
  "category": "vegetable",
  "is_common_allergen": false,
  "introduction_date": "2026-07-15",
  "status": "cleared",
  "initial_reaction": "liked",
  "notes": "Loved it! Ate 2 tablespoons on the first try."
}

FoodReactionObservation:
{
  "id": "fr1a2b3c-d5e6-7890-abcd-234567890123",
  "food_id": "fi1a2b3c-d5e6-7890-abcd-123456789012",
  "observation_date": "2026-07-16",
  "observation_text": "Day 2: No rash, no digestive issues. Baby seemed eager for more."
}
```

#### 3.7 Business Logic Rules

##### Waiting Period Check

**Purpose:** Determine whether it is safe to introduce a new food based on the waiting period.

**Inputs:**
- child_id: string - the active child
- today: date - the current date
- wait_days: integer - configurable waiting period (default: 3)

**Logic:**

```
1. last_introduction = SELECT * FROM FoodIntroduction WHERE child_id = child_id ORDER BY introduction_date DESC LIMIT 1
2. IF last_introduction is null THEN
     RETURN { ready: true, label: "No foods introduced yet" }
3. days_since = today - last_introduction.introduction_date
4. IF days_since >= wait_days THEN
     RETURN { ready: true, label: "Ready for a new food!" }
5. ELSE
     days_remaining = wait_days - days_since
     RETURN {
       ready: false,
       label: "Waiting period: {days_remaining} days remaining",
       waiting_food: last_introduction.food_name,
       introduced_on: last_introduction.introduction_date,
       ready_on: last_introduction.introduction_date + wait_days days
     }
```

**Edge Cases:**
- Wait period is disabled (wait_days = 0): always ready
- Multiple foods introduced on the same day: use the most recent introduction_date
- Food status set to "avoid": waiting period resets from the avoid date

##### Category Summary

**Purpose:** Calculate food counts per category for the dashboard.

**Inputs:**
- child_id: string - the active child

**Logic:**

```
1. FOR EACH category IN ["fruit", "vegetable", "grain", "protein", "dairy", "allergen", "other"]:
     count = COUNT FoodIntroduction WHERE child_id = child_id AND category = category
2. total = SUM of all counts
3. RETURN array of { category, count }
```

##### Age-Appropriate Food Suggestions

**Purpose:** Suggest foods based on the baby's age.

**Inputs:**
- child_age_in_months: float - the child's age
- introduced_food_names: set - foods already introduced

**Logic:**

```
1. IF child_age_in_months < 4 THEN
     RETURN { suggestions: [], message: "Most pediatricians recommend starting solids at 4-6 months." }
2. Determine age bracket:
     4-6 months: single-grain cereals (rice, oat), pureed vegetables (sweet potato, squash, peas, green beans), pureed fruits (banana, avocado, apple, pear)
     6-8 months: more vegetables (carrots, zucchini, spinach), more fruits (mango, peach, blueberry), proteins (pureed chicken, turkey, lentils, tofu), yogurt
     8-10 months: finger foods (soft fruits, puffs, small pasta), eggs, peanut butter (thinned), cheese
     10-12 months: mixed textures, fish, more allergens
3. Filter out foods already introduced (by name, case-insensitive match)
4. RETURN filtered suggestions grouped by bracket
```

**Edge Cases:**
- Child is younger than 4 months: show an informational message, no suggestions
- All suggested foods already introduced: show "You have covered the basics! Try any new foods you like."

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| New food introduced during waiting period | Warning banner: "You introduced [food] [X days] ago. Waiting period is [Y days]. Introduce anyway?" with "Introduce Anyway" and "Wait" buttons | User waits or acknowledges the warning |
| Duplicate food name | Toast: "[Food] has already been introduced on [date]. View its record?" with View and Cancel | User views existing record or enters a different name |
| Food name is empty | Inline validation: "Food name is required" | User enters a name |
| Date in the future | Inline validation: "Date cannot be in the future" | User selects a valid date |
| Database write fails | Toast: "Could not save. Please try again." | User retries |
| Observation text is empty | Inline validation: "Observation cannot be empty" | User enters text |

**Validation Timing:**
- Waiting period check runs when user opens the Introduce New Food form
- Duplicate check runs on Save
- Date validation runs on picker selection

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** no foods have been introduced for the active child,
   **When** the user opens the Food Introduction Dashboard,
   **Then** the status banner shows "No foods introduced yet" and age-appropriate suggestions are displayed.

2. **Given** the user taps "+" and enters "Sweet potato" as a new food,
   **When** the user selects "Vegetable" category, sets today as the date, selects "Liked It" as reaction, and saves,
   **Then** the food appears in the recent introductions list with status "New", and the waiting period banner activates.

3. **Given** "Sweet potato" was introduced 3 days ago (waiting period = 3 days),
   **When** the user views the dashboard on day 4,
   **Then** the status banner shows "Ready for a new food!" in green.

4. **Given** the user updates "Sweet potato" status from "New" to "Cleared" after 3 days with no reaction,
   **When** the user views the food detail,
   **Then** the status badge shows green "Cleared".

**Edge Cases:**

5. **Given** "Peanut butter" was introduced 1 day ago (waiting period = 3 days),
   **When** the user tries to introduce "Eggs",
   **Then** a warning shows "You introduced Peanut butter 1 day ago. Waiting period is 3 days. Introduce anyway?"

6. **Given** the user searches for "milk" in the food name autocomplete,
   **When** the autocomplete results appear,
   **Then** the "common allergen" checkbox is auto-checked.

**Negative Tests:**

7. **Given** "Sweet potato" has already been introduced,
   **When** the user tries to introduce "sweet potato" again (case-insensitive match),
   **Then** the system shows "Sweet potato has already been introduced" and offers to view the existing record.

8. **Given** the user leaves the food name blank,
   **When** the user taps Save,
   **Then** the system shows "Food name is required" and does not save.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| waiting period ready after 3 days | last intro: 3 days ago, wait: 3 | ready: true |
| waiting period not ready after 1 day | last intro: 1 day ago, wait: 3 | ready: false, remaining: 2 |
| waiting period ready when disabled | wait: 0 | ready: true |
| waiting period ready with no introductions | no records | ready: true |
| counts foods by category | 3 fruits, 2 vegetables, 1 protein | correct counts per category |
| suggests foods for 6-month-old | age: 6, none introduced | vegetables and fruits suggested |
| filters already-introduced from suggestions | age: 6, sweet potato already introduced | sweet potato not in suggestions |
| detects common allergen | food: "peanut butter" | is_common_allergen: true |
| detects duplicate food name (case-insensitive) | existing: "Sweet Potato", new: "sweet potato" | duplicate: true |
| validates food name not empty | name: "" | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Introduce a food and verify waiting period | 1. Introduce sweet potato, 2. Check dashboard | Waiting banner shows 3 days remaining |
| Clear a food after waiting period | 1. Introduce sweet potato, 2. Wait 3 days, 3. Update status to "Cleared" | Status badge turns green, food shown as cleared in category |
| Add reaction observation | 1. Open food detail for sweet potato, 2. Add "Day 2: No rash", 3. Save | Observation appears in reaction history |
| Introduce allergen with warning | 1. Introduce food A (day 0), 2. Try to introduce peanut butter (day 1) | Warning about waiting period + allergen badge shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent introduces first 5 foods over 15 days | 1. Sweet potato day 0, 2. Banana day 3, 3. Oat cereal day 6, 4. Avocado day 9, 5. Peas day 12 | 5 foods in dashboard, categories show: 2 fruits, 2 vegetables, 1 grain. All cleared after waiting periods. Waiting period for peas still active on day 13 |
| Parent tracks an allergic reaction | 1. Introduce eggs, 2. Day 1: add observation "mild rash on cheeks", 3. Day 2: add observation "rash persists, contacted pediatrician", 4. Set status to "Avoid" | Eggs shows red "Avoid" badge, reaction history has 2 entries, food remains in the allergens category with warning |

---

### BB-019: Data Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-019 |
| **Feature Name** | Data Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a parent, I want to export all of my baby's tracking data in a portable format, so that I own my data and can use it outside the app.

**Secondary:**
> As a parent visiting the pediatrician, I want to export a PDF summary of my baby's growth data and feeding patterns, so that I can share it with the doctor without handing over my phone.

**Tertiary:**
> As a parent switching to a different baby tracking app, I want to export my data in a standard format, so that I can potentially import it elsewhere and do not lose months of records.

#### 3.3 Detailed Description

Data Export provides full data portability, reinforcing the privacy-first philosophy: the user owns their data and can take it with them at any time. The feature supports multiple export formats and scopes, from a full database dump to a curated pediatrician visit summary.

Export formats:

- **CSV (Comma-Separated Values):** Each entity type is exported as a separate CSV file within a ZIP archive. Files include: feedings.csv, sleep.csv, diapers.csv, growth.csv, milestones.csv, vaccinations.csv, pumping.csv, medicines.csv, teeth.csv, experiences.csv, visits.csv, food_introductions.csv. Column headers match the entity field names. Dates use ISO 8601 format. This is the most portable format for spreadsheet analysis or import into other systems.

- **JSON:** A single JSON file containing all data organized by entity type. Each entity type is an array of objects. This format preserves data types and relationships more precisely than CSV. The JSON structure follows a documented schema so third-party tools can parse it.

- **PDF Summary Report:** A formatted, printable document summarizing the child's data. The PDF includes: child profile information, growth charts (rendered as images), growth measurement table with percentiles, milestone checklist with dates achieved, vaccination record, recent feeding/sleep/diaper summaries. This format is designed for sharing with pediatricians or family members.

Export scope options:

- **Full export:** All data for the selected child across all entity types
- **Date range export:** Data within a specified start and end date
- **Category export:** Only specific data types (e.g., only growth and vaccinations for a doctor visit)
- **All children export:** Full data for all child profiles in a single archive

The export process generates the file(s) locally and presents a share sheet for the user to save, email, AirDrop, or store via any system share target. No data is uploaded to any server during the export process. The exported files are generated in a temporary directory and cleaned up after sharing.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - export is per-child or all children

**External Dependencies:**
- File system access for temporary file generation
- System share sheet for distributing the exported file
- PDF generation capability (for PDF summary format)

**Assumed Capabilities:**
- At least one child profile exists with some data to export

#### 3.5 User Interface Requirements

##### Screen: Export Data

**Layout:**
- **Child Selector:** At the top, a dropdown to select which child to export (or "All Children" option). Default: active child
- **Format Selector:** Three format options as a segmented control: "CSV", "JSON", "PDF Summary"
- **Scope Section:**
  - "Full Export" toggle (default: on)
  - If Full Export is off, a date range picker appears (start date, end date)
  - Category checkboxes (all checked by default):
    - Feedings
    - Sleep
    - Diapers
    - Growth
    - Milestones
    - Vaccinations
    - Pumping
    - Medicines
    - Teething
    - First Experiences
    - Pediatrician Visits
    - Food Introductions
- **Data Preview:** A summary showing what will be exported: "Exporting [X] feeding entries, [Y] sleep entries, [Z] diaper entries..." with total row count
- **Export Button:** A full-width "Export" button at the bottom. Shows estimated file size before export

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Options configured, data preview shown | Export button active with estimated file size |
| Exporting | Export in progress | Progress indicator with current step: "Generating feedings... (2/12)" |
| Complete | Export file generated | Share sheet opens automatically with the generated file |
| Error | Export failed | Error message with retry button |
| No Data | Selected child/scope has no data | Message: "No data to export for the selected options." Export button disabled |

**Interactions:**
- Change child: data preview updates to reflect the selected child's data
- Change format: file size estimate updates
- Toggle categories: data preview and file size estimate update
- Tap "Export": generates the export file and opens the system share sheet
- Tap outside share sheet (cancel): temporary file is preserved for 1 hour in case the user wants to re-share

**Transitions/Animations:**
- Progress indicator fills as each entity type is processed
- Share sheet opens with the system's default animation

#### 3.6 Data Requirements

Data Export does not introduce new persistent entities. It reads from all existing entities and generates temporary files.

##### Export File Structure

**CSV (ZIP archive):**
```
mybaby_export_luna_2026-03-06.zip
  feedings.csv
  sleep.csv
  diapers.csv
  growth.csv
  milestones.csv
  vaccinations.csv
  pumping.csv
  medicines.csv
  medicine_doses.csv
  teeth.csv
  teething_symptoms.csv
  first_experiences.csv
  pediatrician_visits.csv
  visit_follow_ups.csv
  doctor_questions.csv
  food_introductions.csv
  food_observations.csv
  child_profile.csv
```

**JSON:**
```
mybaby_export_luna_2026-03-06.json
{
  "export_version": "1.0",
  "export_date": "2026-03-06T12:00:00Z",
  "child": { ... },
  "feedings": [ ... ],
  "sleep": [ ... ],
  "diapers": [ ... ],
  "growth": [ ... ],
  "milestones": [ ... ],
  "vaccinations": [ ... ],
  "pumping": [ ... ],
  "medicines": [ ... ],
  "medicine_doses": [ ... ],
  "teeth": [ ... ],
  "teething_symptoms": [ ... ],
  "first_experiences": [ ... ],
  "pediatrician_visits": [ ... ],
  "food_introductions": [ ... ]
}
```

**PDF Summary:**
```
mybaby_report_luna_2026-03-06.pdf
  Page 1: Child profile, key stats, age
  Page 2-3: Growth charts (weight, length, head) rendered as images with percentile tables
  Page 4: Vaccination record checklist
  Page 5: Milestone checklist with dates achieved
  Page 6: Recent activity summary (last 30 days of feeding/sleep/diaper stats)
```

#### 3.7 Business Logic Rules

##### Export File Generation

**Purpose:** Generate the export file in the selected format.

**Inputs:**
- child_id: string (or "all" for all children)
- format: enum - "csv", "json", "pdf"
- scope: object - { full: boolean, start_date: date, end_date: date, categories: set }

**Logic:**

```
1. Determine which entity types to export based on scope.categories
2. FOR EACH entity type in the export:
     IF scope.full THEN
       Query all entries for child_id
     ELSE
       Query entries for child_id within [start_date, end_date]
3. IF format = "csv" THEN
     For each entity type, generate a CSV file with headers matching field names
     Package all CSV files into a ZIP archive
     Filename: "mybaby_export_{child_name}_{date}.zip"
4. IF format = "json" THEN
     Assemble all queried data into a single JSON object
     Add export_version and export_date metadata
     Filename: "mybaby_export_{child_name}_{date}.json"
5. IF format = "pdf" THEN
     Generate growth chart images from GrowthMeasurement data
     Render the PDF with child profile, charts, tables, checklists
     Filename: "mybaby_report_{child_name}_{date}.pdf"
6. Write the file to a temporary directory
7. Open the system share sheet with the generated file
8. Schedule cleanup of the temporary file after 1 hour
```

**Edge Cases:**
- No data for any entity type: include an empty CSV/JSON array, or skip the section in PDF
- Very large dataset (thousands of entries): stream CSV generation rather than building in memory
- Photos referenced in data (milestones, experiences): include photo URIs in CSV/JSON, embed thumbnails in PDF
- Special characters in data: CSV uses RFC 4180 quoting rules, JSON uses standard escaping
- Export for "all children": include a child identifier column in CSV, nest by child in JSON

##### File Size Estimation

**Purpose:** Estimate the export file size before generation.

**Inputs:**
- row_counts: object - count per entity type
- format: enum - "csv", "json", "pdf"

**Logic:**

```
1. Estimate bytes per row:
     CSV: approximately 200 bytes per row (varies by entity)
     JSON: approximately 300 bytes per row
     PDF: fixed overhead of 500KB + 100 bytes per data row + 200KB per growth chart image
2. total_rows = SUM of all row counts
3. IF format = "csv" THEN
     estimated_bytes = total_rows * 200
     Apply ZIP compression estimate: compressed = estimated_bytes * 0.3
4. IF format = "json" THEN
     estimated_bytes = total_rows * 300
5. IF format = "pdf" THEN
     estimated_bytes = 500000 + (total_rows * 100) + (chart_count * 200000)
6. Format for display:
     IF estimated_bytes < 1024 THEN display "{bytes} B"
     IF estimated_bytes < 1048576 THEN display "{KB} KB"
     ELSE display "{MB} MB"
7. RETURN formatted estimate
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient storage for export file | Toast: "Not enough storage to generate the export. Free up space and try again." | User frees device storage |
| PDF generation fails | Toast: "Could not generate PDF. Try CSV or JSON format." | User selects a different format |
| Export interrupted (app closed) | Partial file is deleted. No corrupt file remains | User retries the export |
| Share sheet dismissed without sharing | File kept in temp for 1 hour. Toast: "Export file saved temporarily. You can re-export from this screen." | User re-opens export and re-shares |
| No data matches the scope | Message on screen: "No data to export for the selected options." Export button disabled | User adjusts scope or selects a different child |

**Validation Timing:**
- Data preview and file size estimate update on any scope change
- Storage check runs when user taps Export
- Format-specific validation runs during generation

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has an active child with feeding, sleep, and diaper data,
   **When** the user selects "CSV" format, full export, and taps Export,
   **Then** a ZIP file is generated containing CSV files for each entity type, and the system share sheet opens.

2. **Given** the user selects "JSON" format with a date range of the last 30 days,
   **When** the export completes,
   **Then** the JSON file contains only entries from the last 30 days, with export metadata.

3. **Given** the user selects "PDF Summary" format,
   **When** the export completes,
   **Then** a PDF is generated with the child's profile, growth charts (as images), vaccination checklist, and recent activity summary.

4. **Given** the user has two children and selects "All Children",
   **When** the export completes,
   **Then** the export file contains data for both children, clearly separated.

**Edge Cases:**

5. **Given** the user has no data for the selected date range,
   **When** the scope is configured,
   **Then** the data preview shows "No data to export" and the Export button is disabled.

6. **Given** the export file is very large (3000+ entries),
   **When** the export is running,
   **Then** a progress indicator shows the current step and the export completes without running out of memory.

**Negative Tests:**

7. **Given** the device has insufficient storage,
   **When** the user taps Export,
   **Then** the system shows "Not enough storage" and does not generate a partial file.

8. **Given** the user dismisses the share sheet without sharing,
   **When** the user returns to the Export screen,
   **Then** the temporary file is still available for re-sharing.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| estimates CSV file size | 100 rows | approximately 6 KB compressed (100 * 200 * 0.3) |
| estimates JSON file size | 100 rows | approximately 30 KB (100 * 300) |
| estimates PDF file size | 100 rows, 3 charts | approximately 630 KB |
| formats bytes as KB | 5120 bytes | "5 KB" |
| formats bytes as MB | 2097152 bytes | "2 MB" |
| generates correct CSV filename | child: "Luna", date: 2026-03-06 | "mybaby_export_luna_2026-03-06.zip" |
| generates correct JSON filename | child: "Luna", date: 2026-03-06 | "mybaby_export_luna_2026-03-06.json" |
| filters by date range | range: Mar 1-5, entries on Mar 1, 3, 5, 7 | 3 entries included, 1 excluded |
| filters by category | categories: [feedings, sleep], data has all types | only feedings and sleep exported |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full CSV export | 1. Select CSV, full export, 2. Tap Export | ZIP file generated with all CSV files, share sheet opens |
| JSON export with date range | 1. Select JSON, date range last 7 days, 2. Export | JSON contains only entries from last 7 days |
| PDF summary generation | 1. Select PDF, 2. Export | PDF with charts, tables, and checklists generated |
| Category-filtered export | 1. Uncheck all except Growth and Vaccinations, 2. Export | Only growth and vaccination data in the export |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent exports data for pediatrician | 1. Select PDF Summary, 2. Export, 3. Email to doctor | PDF with growth charts and vaccination record sent via email |
| Parent backs up all data | 1. Select JSON, all children, full export, 2. Export, 3. Save to Files | Complete JSON backup saved to device, all children's data included |

---

### BB-020: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-020 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P1 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a parent, I want to configure my preferred measurement units (metric vs. imperial), so that all values throughout the app match my local conventions.

**Secondary:**
> As a parent who bottle-feeds exclusively, I want to hide breastfeeding-related features, so that my interface is streamlined for my workflow.

**Tertiary:**
> As a parent who wants to reset and start fresh, I want to delete all data for a child without deleting the profile, so that I can begin tracking again from scratch.

#### 3.3 Detailed Description

Settings and Preferences provides a central configuration screen for the MyBaby module. It controls measurement units, display preferences, feature visibility, notification settings, and data management. All settings are stored locally and apply immediately.

The settings are organized into sections:

**Units and Display:**
- Weight unit: Metric (kg) or Imperial (lb + oz). Default: based on device locale
- Length unit: Metric (cm) or Imperial (inches). Default: based on device locale
- Volume unit: Metric (ml) or Imperial (oz). Default: based on device locale
- Temperature unit: Celsius or Fahrenheit. Default: based on device locale
- Time format: 12-hour or 24-hour. Default: based on device setting
- First day of week: Sunday or Monday. Default: based on device locale

**Sleep Settings:**
- Nighttime start hour: time picker, default 7:00 PM (19:00). Used for auto-classification of sleep as nap vs. nighttime (BB-003)
- Nighttime end hour: time picker, default 4:00 AM (04:00)

**Nap Predictor Settings:**
- Enable/disable nap predictor: toggle, default on
- Wake window personalization: toggle, default on (when off, uses age-based baseline only)

**Food Introduction Settings:**
- Waiting period between new foods: picker with options 0 (disabled), 3 days (default), 4 days
- Common allergens alert: toggle, default on

**Feature Visibility:**
- Toggle switches for features the user does not need:
  - Pumping Log (default: on)
  - Teething Log (default: on)
  - First Experiences Journal (default: on)
  - Solid Food Tracker (default: on)
  - Medicine Tracking (default: on)
- Hiding a feature removes its tab/navigation entry but does not delete data. Re-enabling restores it with data intact

**Data Management:**
- "Export Data" button: navigates to BB-019 Export screen
- "Delete All Data for [child name]" button: destructive action with confirmation. Deletes all tracking data (feedings, sleep, diapers, growth, milestones, etc.) but preserves the child profile. Requires typing the child's name to confirm
- "Delete Module Data" button: deletes ALL MyBaby data including all profiles and all tracking data. Requires typing "DELETE" to confirm. This is the nuclear option

#### 3.4 Prerequisites

**Feature Dependencies:**
- None. Settings is a standalone feature that other features read from

**External Dependencies:**
- Device locale detection for default unit settings
- Local storage for persisting settings

**Assumed Capabilities:**
- The MyBaby module is enabled

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- A vertically scrollable list of setting sections, each with a section header:
- **Units and Display section:**
  - Weight unit: segmented control "kg" / "lb + oz"
  - Length unit: segmented control "cm" / "in"
  - Volume unit: segmented control "ml" / "oz"
  - Temperature unit: segmented control "C" / "F"
  - Time format: segmented control "12h" / "24h"
  - First day of week: segmented control "Sun" / "Mon"
- **Sleep Settings section:**
  - Nighttime start: time picker row
  - Nighttime end: time picker row
- **Nap Predictor section:**
  - Enable predictor: toggle switch
  - Personalize: toggle switch (dimmed if predictor is disabled)
- **Food Introduction section:**
  - Waiting period: picker row showing current value
  - Common allergens alert: toggle switch
- **Feature Visibility section:**
  - Toggle switches for each optional feature, with the feature name and a brief description
- **Data Management section:**
  - "Export Data" button (navigates to Export screen)
  - "Delete All Data for [child name]" button in destructive red styling
  - "Delete Module Data" button in destructive red styling

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | First time opening settings | All values set to locale-appropriate defaults |
| Configured | User has changed settings | Changed settings show current values |
| Delete Confirmation | User tapped a delete button | Confirmation dialog with text input for name or "DELETE" |

**Interactions:**
- Tap a segmented control: immediately applies the new setting and saves
- Toggle a switch: immediately applies and saves
- Tap a time picker row: opens a time picker
- Tap "Export Data": navigates to BB-019 Export screen
- Tap "Delete All Data": shows confirmation dialog requiring the child's name
- Tap "Delete Module Data": shows confirmation dialog requiring "DELETE"
- All settings apply immediately with no "Save" button needed

**Transitions/Animations:**
- Setting changes apply with a brief flash highlight on the changed row, 200ms
- Confirmation dialogs appear with a fade-in overlay, 200ms

#### 3.6 Data Requirements

##### Entity: ModuleSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, single row | "bb_settings" | Fixed ID (singleton) |
| weight_unit | enum | One of: "kg", "lb_oz" | Locale-based | Preferred weight unit |
| length_unit | enum | One of: "cm", "in" | Locale-based | Preferred length unit |
| volume_unit | enum | One of: "ml", "oz" | Locale-based | Preferred volume unit |
| temperature_unit | enum | One of: "c", "f" | Locale-based | Preferred temperature unit |
| time_format | enum | One of: "12h", "24h" | Device setting | Preferred time display format |
| first_day_of_week | enum | One of: "sunday", "monday" | Locale-based | Calendar start day |
| nighttime_start_hour | integer | 0-23 | 19 | Hour when nighttime begins (for sleep classification) |
| nighttime_end_hour | integer | 0-23 | 4 | Hour when nighttime ends |
| nap_predictor_enabled | boolean | - | true | Whether the nap predictor is active |
| nap_predictor_personalized | boolean | - | true | Whether personal wake window adaptation is active |
| food_wait_days | integer | 0, 3, or 4 | 3 | Days to wait between new food introductions |
| allergen_alerts_enabled | boolean | - | true | Whether common allergen warnings are shown |
| pumping_visible | boolean | - | true | Whether the pumping log is visible in navigation |
| teething_visible | boolean | - | true | Whether the teething log is visible |
| experiences_visible | boolean | - | true | Whether the first experiences journal is visible |
| solid_food_visible | boolean | - | true | Whether the solid food tracker is visible |
| medicine_visible | boolean | - | true | Whether medicine tracking is visible |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Notes:**
- This is a singleton entity (one row per module installation)
- Default values are determined at first launch based on the device's locale and system settings
- Settings do not have a child_id because they apply module-wide (unit preferences are not per-child)

#### 3.7 Business Logic Rules

##### Locale-Based Default Detection

**Purpose:** Determine appropriate default values for unit preferences based on the device locale.

**Inputs:**
- device_locale: string - the device's locale identifier (e.g., "en_US", "en_GB", "de_DE")

**Logic:**

```
1. Extract the country code from the locale
2. imperial_countries = ["US", "LR", "MM"] (United States, Liberia, Myanmar)
3. IF country_code IN imperial_countries THEN
     weight_unit = "lb_oz"
     length_unit = "in"
     volume_unit = "oz"
     temperature_unit = "f"
   ELSE
     weight_unit = "kg"
     length_unit = "cm"
     volume_unit = "ml"
     temperature_unit = "c"
4. time_format = device system setting (12h or 24h)
5. first_day_of_week = locale default (Sunday for US, Monday for most of Europe)
```

##### Feature Visibility Toggle

**Purpose:** Show or hide optional features in the module navigation.

**Inputs:**
- feature_key: string - the feature toggle key (e.g., "pumping_visible")
- visible: boolean - the new visibility state

**Logic:**

```
1. Update the settings row: SET feature_key = visible
2. IF visible = false THEN
     Remove the feature's tab or navigation entry from the module UI
     Do NOT delete any data associated with the feature
3. IF visible = true THEN
     Restore the feature's navigation entry
     All previously logged data is available
```

**Edge Cases:**
- Hiding a feature while viewing it: navigate the user to the Dashboard
- Re-enabling a feature: all data is restored exactly as it was

##### Data Deletion

**Purpose:** Permanently delete tracking data.

**Inputs:**
- scope: enum - "child_data" or "all_module_data"
- child_id: string - the child to delete data for (only for "child_data" scope)
- confirmation_text: string - the user's typed confirmation

**Logic:**

```
1. IF scope = "child_data" THEN
     Validate confirmation_text matches the child's name (case-insensitive)
     IF match fails THEN RETURN error
     Begin database transaction
     Delete all FeedingLog, SleepLog, DiaperLog, GrowthMeasurement, MilestoneRecord,
       VaccinationRecord, PumpingLog, MedicineProfile, MedicineLog, TeethRecord,
       TeethingSymptomLog, FirstExperience, PediatricianVisit, VisitFollowUpAction,
       DoctorQuestion, FoodIntroduction, FoodReactionObservation
       WHERE child_id = child_id
     Do NOT delete the ChildProfile itself
     Commit transaction
2. IF scope = "all_module_data" THEN
     Validate confirmation_text = "DELETE" (case-sensitive)
     IF match fails THEN RETURN error
     Begin database transaction
     Delete ALL rows from ALL MyBaby tables (including ChildProfile)
     Reset ModuleSettings to defaults
     Commit transaction
```

**Edge Cases:**
- Confirmation text does not match: show error "Text does not match. Deletion cancelled."
- Database error during deletion: roll back transaction, no partial deletion
- Deleting the last child's data while that child is active: profile remains, dashboard shows empty state

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Confirmation text does not match | Inline error: "Text does not match. Please try again." Delete button remains disabled | User retypes correctly |
| Database error during deletion | Toast: "Could not delete data. No data was removed." | User retries |
| Setting save fails | Toast: "Could not save setting. Please try again." Setting reverts to previous value | User retries |
| Locale detection fails | Use US defaults (imperial) as a fallback | User manually adjusts in settings |

**Validation Timing:**
- Confirmation text validated in real time as user types
- Settings save immediately on change (no form submission)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is in the US and opens Settings for the first time,
   **When** the defaults are loaded,
   **Then** weight is "lb + oz", length is "in", volume is "oz", temperature is "F".

2. **Given** the user changes the volume unit from oz to ml,
   **When** the user views the feeding log,
   **Then** all bottle volumes are displayed in ml.

3. **Given** the user toggles off "Pumping Log",
   **When** the user returns to the module navigation,
   **Then** the pumping log tab/entry is not visible, but existing pumping data is preserved.

4. **Given** the user toggles the pumping log back on,
   **When** the user navigates to the pumping log,
   **Then** all previously logged pumping sessions are visible.

**Edge Cases:**

5. **Given** the user taps "Delete All Data for Luna",
   **When** the confirmation dialog appears and the user types "Luna" correctly,
   **Then** all tracking data for Luna is deleted, the profile remains, and the dashboard shows empty state.

6. **Given** the user types "luna" (lowercase) for confirmation when the child's name is "Luna",
   **When** the comparison runs,
   **Then** the match succeeds (case-insensitive) and data is deleted.

**Negative Tests:**

7. **Given** the user taps "Delete Module Data",
   **When** the user types "delete" (lowercase) instead of "DELETE",
   **Then** the system shows "Text does not match" and does not delete anything.

8. **Given** the nighttime start hour is set to 19 and end to 4,
   **When** the user tries to set start to 3 and end to 19 (inverted range),
   **Then** the system accepts this (valid: nighttime from 3 AM to 7 PM is unusual but allowed for shift workers).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects US locale defaults | locale: "en_US" | weight: "lb_oz", length: "in", volume: "oz", temp: "f" |
| detects UK locale defaults | locale: "en_GB" | weight: "kg", length: "cm", volume: "ml", temp: "c" |
| detects German locale defaults | locale: "de_DE" | weight: "kg", length: "cm", volume: "ml", temp: "c" |
| validates child name confirmation (match) | name: "Luna", input: "luna" | match: true (case-insensitive) |
| validates child name confirmation (no match) | name: "Luna", input: "Max" | match: false |
| validates DELETE confirmation (exact) | input: "DELETE" | match: true |
| validates DELETE confirmation (wrong case) | input: "delete" | match: false |
| hides feature without deleting data | pumping_visible: false | navigation entry removed, PumpingLog data intact |
| restores feature visibility | pumping_visible: true | navigation entry restored, data visible |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Change weight unit and verify display | 1. Set weight to kg, 2. View growth chart, 3. Change to lb+oz, 4. View growth chart | Growth chart displays in the selected unit, values are correctly converted |
| Hide and restore a feature | 1. Hide pumping log, 2. Verify navigation, 3. Show pumping log, 4. Verify data | Feature disappears and reappears with data intact |
| Delete child data | 1. Log feedings for child, 2. Delete all data for child, 3. View dashboard | Dashboard shows empty state, profile still exists |
| Full module data deletion | 1. Create 2 children with data, 2. Delete module data, 3. Open MyBaby | No profiles exist, redirected to Profile Creation |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New parent configures settings | 1. Open settings, 2. Verify locale defaults, 3. Adjust nighttime hours to 8PM-5AM, 4. Disable pumping log (exclusive bottle feeder), 5. Return to app | All settings applied, sleep auto-classification uses new hours, pumping log hidden |
| Parent exports data before deleting | 1. Export full data as JSON, 2. Verify export file, 3. Delete all data for child, 4. Verify empty state | Export file contains all data, child profile exists but empty, no data loss |

---

### BB-021: Week-by-Week Development Info

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-021 |
| **Feature Name** | Week-by-Week Development Info |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a new parent, I want to read age-specific information about what my baby is likely experiencing this week, so that I understand what is normal and what to expect next.

**Secondary:**
> As a parent, I want to know what developmental changes are happening at my baby's current age, so that I can provide appropriate stimulation and activities.

**Tertiary:**
> As a parent, I want to browse ahead to see what is coming in the next few weeks, so that I can prepare for upcoming developmental leaps.

#### 3.3 Detailed Description

Week-by-Week Development Info provides curated, age-specific content about the baby's development. Unlike milestone tracking (BB-007), which is a checklist the parent fills in, this feature provides informational content that the parent reads. It answers the question "What is my baby going through right now?" with content about physical development, cognitive growth, sensory development, and practical care tips.

The content is organized by week for the first 12 weeks (0-3 months, when changes happen rapidly) and by month from 3 to 36 months. Each entry contains:

- **Physical development:** What is happening with the baby's body (e.g., "Your baby may be discovering their hands this week and beginning to bring them together at the midline")
- **Cognitive development:** What is happening with the baby's brain (e.g., "Your baby is beginning to distinguish between familiar and unfamiliar faces")
- **Sensory development:** What the baby can see, hear, and perceive (e.g., "Vision is improving. Your baby can now focus on objects 8-12 inches away")
- **Care tips:** Practical suggestions for this age (e.g., "Tummy time: aim for 3-5 minutes, 3 times per day. Stop if baby becomes distressed")
- **What is normal:** Reassuring notes about common behaviors that worry parents (e.g., "Frequent hiccups are normal and do not bother your baby")

The content is bundled locally with the app. No network request is made. Approximately 60 content entries total (12 weekly + 33 monthly from 3 to 36 months = 45, plus buffer). Each entry is 300-500 words.

The main screen shows the current week/month's content prominently, with the ability to swipe to see the previous and next entries. A timeline at the top shows the baby's progress through the content library. Past entries are dimmed, the current entry is highlighted, and future entries are accessible but marked as "coming up."

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - content is displayed based on the child's age

**External Dependencies:**
- Bundled developmental content data (included in app assets, no network required)

**Assumed Capabilities:**
- An active child profile exists with date of birth set

#### 3.5 User Interface Requirements

##### Screen: Development Info

**Layout:**
- **Age Indicator:** At the top, a bar showing the baby's current age prominently (e.g., "Week 8" or "Month 6") with the child's name
- **Timeline Scrubber:** A horizontal scrollable timeline showing week/month markers. The current period is centered and highlighted. Past periods are tappable (dimmed). Future periods are tappable (lighter)
- **Content Card:** The main content area is a vertically scrollable card containing:
  - Period title (e.g., "Week 8: 2 Months Old")
  - A brief headline summary (1 sentence)
  - Four collapsible sections with icons:
    - Physical Development (body icon)
    - Cognitive Development (brain icon)
    - Sensory Development (eye icon)
    - Care Tips (heart icon)
  - A "What is Normal" callout box with reassuring notes
- **Navigation:** Swipe left/right on the content card to move to the next/previous period

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Current Period | Viewing the baby's current age period | Content card highlighted, timeline centered on current period |
| Past Period | Viewing a period the baby has passed | Content shown in full, timeline marker dimmed |
| Future Period | Browsing ahead to a future period | Content shown with "Coming up" label |
| Content End | Baby is older than the last content period (36 months) | Message: "Development content is available for ages 0-36 months." Last entry shown |

**Interactions:**
- Swipe content card left: navigates to the next period
- Swipe content card right: navigates to the previous period
- Tap a timeline marker: jumps to that period's content
- Tap a section header (Physical/Cognitive/Sensory/Care Tips): expands or collapses that section
- Pull down on the content card: returns to the current period

**Transitions/Animations:**
- Content card swipe: horizontal slide with parallax on the card background, 250ms
- Section expand/collapse: smooth height animation, 200ms
- Timeline marker tap: smooth scroll to center the selected marker, 300ms

#### 3.6 Data Requirements

##### Reference Entity: DevelopmentContent (Bundled, Read-Only)

| Field | Type | Description |
|-------|------|-------------|
| period_id | string | Unique identifier (e.g., "week_8" or "month_6") |
| period_type | enum | "week" or "month" |
| period_number | integer | The week or month number |
| age_range_start_days | integer | Start of this period in days from birth |
| age_range_end_days | integer | End of this period in days from birth |
| title | string | Period title (e.g., "Week 8: 2 Months Old") |
| headline | string | One-sentence summary |
| physical_development | string | Physical development content (300-500 chars) |
| cognitive_development | string | Cognitive development content (300-500 chars) |
| sensory_development | string | Sensory development content (300-500 chars) |
| care_tips | string | Practical care tips (300-500 chars) |
| whats_normal | string | Reassuring "what is normal" content (200-400 chars) |

**Notes:**
- Approximately 45-60 entries total
- Content is reviewed for accuracy against AAP (American Academy of Pediatrics) guidelines
- No user-editable fields; this is reference content only

#### 3.7 Business Logic Rules

##### Current Period Determination

**Purpose:** Determine which development content period matches the baby's current age.

**Inputs:**
- child_age_in_days: integer - the child's age in days

**Logic:**

```
1. Find the DevelopmentContent entry where child_age_in_days >= age_range_start_days AND child_age_in_days < age_range_end_days
2. IF no match (child is older than 36 months) THEN
     RETURN the last entry (month 36) with an "age exceeded" flag
3. RETURN the matched content entry
```

**Edge Cases:**
- Child born today (age 0 days): return "Week 1" content
- Child exactly at a boundary (e.g., day 7): return the new period (Week 2)
- Child older than 36 months: return the last entry with a note that content ends at 36 months

##### Period Navigation

**Purpose:** Navigate between periods for browsing.

**Inputs:**
- current_period_id: string - the currently displayed period
- direction: enum - "next" or "previous"

**Logic:**

```
1. Get all periods ordered by age_range_start_days
2. Find the index of current_period_id
3. IF direction = "next" AND index < max_index THEN
     RETURN periods[index + 1]
4. IF direction = "previous" AND index > 0 THEN
     RETURN periods[index - 1]
5. ELSE RETURN null (at the boundary, no more periods)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Content data missing (app packaging error) | Error screen: "Development content could not be loaded. Please reinstall the app." | User reinstalls |
| Child age exceeds content range | Last available content shown with note: "Content is available for ages 0-36 months." | No recovery needed |
| No child profile exists | Redirect to Profile Creation | User creates a profile |

**Validation Timing:**
- Content loading validated on screen open
- Age calculation validated on each render (in case date of birth was edited)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a baby who is 8 weeks old,
   **When** the user opens the Development Info screen,
   **Then** the "Week 8" content is displayed with all four sections (Physical, Cognitive, Sensory, Care Tips) and the timeline highlights Week 8.

2. **Given** the user is viewing Week 8 content,
   **When** the user swipes left,
   **Then** the content transitions to Week 9 with a smooth slide animation.

3. **Given** the user taps the "Month 12" marker on the timeline,
   **When** the content updates,
   **Then** the Month 12 content is shown with a "Coming up" label (if the baby is younger than 12 months).

4. **Given** the user taps the "Physical Development" section header,
   **When** the section toggles,
   **Then** the section expands or collapses with a smooth height animation.

**Edge Cases:**

5. **Given** a baby born today,
   **When** the user opens Development Info,
   **Then** Week 1 content is shown with the timeline at the very beginning.

6. **Given** a child older than 36 months,
   **When** the user opens Development Info,
   **Then** the Month 36 content is shown with a note: "Content is available for ages 0-36 months."

**Negative Tests:**

7. **Given** the user is viewing Week 1,
   **When** the user tries to swipe right (to go to a previous period),
   **Then** the swipe bounces back (no earlier period exists).

8. **Given** the content data is missing due to an app error,
   **When** the user opens Development Info,
   **Then** an error screen instructs the user to reinstall the app.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| determines current period for day 0 | age: 0 days | period: "week_1" |
| determines current period for day 56 | age: 56 days | period: "week_8" (or "month_2" if monthly) |
| determines current period for day 365 | age: 365 days | period: "month_12" |
| navigates to next period | current: "week_8", direction: "next" | "week_9" |
| navigates to previous period | current: "week_8", direction: "previous" | "week_7" |
| returns null at first boundary | current: "week_1", direction: "previous" | null |
| returns null at last boundary | current: "month_36", direction: "next" | null |
| handles age beyond content range | age: 1200 days | last entry with age_exceeded flag |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Load content for current age | 1. Set child DOB to 8 weeks ago, 2. Open Development Info | Week 8 content loaded and displayed |
| Navigate between periods | 1. View current period, 2. Swipe left 3 times, 3. Swipe right 3 times | Content updates correctly, returns to original period |
| Timeline navigation | 1. Tap Month 6 on timeline | Content jumps to Month 6, timeline scrolls to center it |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New parent reads weekly updates | 1. Open Development Info at week 3, 2. Read all sections, 3. Collapse Physical, expand Care Tips, 4. Swipe to Week 4 | Content is readable and informative, sections toggle correctly, navigation works |
| Parent browses ahead | 1. Tap Month 12 on timeline (baby is 3 months), 2. Read content, 3. Pull down to return to current | Future content shown with "Coming up" label, pull-down returns to current period |

---

### BB-022: Photo Timeline

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | BB-022 |
| **Feature Name** | Photo Timeline |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a parent, I want to take a monthly photo of my baby in the same position, so that I can create a visual timeline showing how much they have grown over the months.

**Secondary:**
> As a parent, I want all milestone photos and first experience photos to appear on a single timeline alongside my monthly photos, so that I have a comprehensive visual record of the first years.

**Tertiary:**
> As a parent, I want to see my baby's photo timeline organized by age (weeks and months), so that I can quickly find photos from a specific period.

#### 3.3 Detailed Description

The Photo Timeline aggregates all photos attached to MyBaby entries (milestones, first experiences, growth measurements, teething) into a single chronological view, and adds support for dedicated monthly milestone photos.

The primary feature is the Monthly Photo. Parents are encouraged to take a photo of their baby in a consistent setting on each monthly "birthday" (same day of the month as the birth date). The app sends a local notification on the monthly anniversary: "Today [child name] is [X] months old! Take a monthly photo." The monthly photo is tagged with the child's age and stored locally.

The timeline view presents all photos chronologically, organized into age-based groups:

- **Weeks 0-12:** grouped by week
- **Months 3-24:** grouped by month
- **Years 2-5:** grouped by quarter

Each group header shows the age label (e.g., "Month 6") and the number of photos in that group. Photos within a group are displayed in a grid (3 columns). Tapping a photo opens a full-screen viewer with swipe navigation, the photo's context (what it was attached to: "First steps - November 20, 2026"), and share options.

The monthly photo has a special visual treatment: it is displayed larger than other photos in its group and has a "Monthly Photo" badge. If the monthly photo has not been taken for the current month, a placeholder card with a camera icon and "Take Month [X] Photo" label is shown at the top of the timeline.

The photo timeline is a read-only aggregation view. Photos are not stored separately; they reference the photo_uri fields from existing entities (MilestoneRecord.photo_uri, FirstExperience.photo_uris, TeethRecord.photo_uri) plus the dedicated MonthlyPhoto entity.

#### 3.4 Prerequisites

**Feature Dependencies:**
- BB-001: Child Profile Management - photos are per-child
- BB-007: Milestone Tracking (optional) - milestone photos appear in timeline
- BB-015: First Experiences Journal (optional) - experience photos appear in timeline

**External Dependencies:**
- Device camera or photo library access
- Local storage for photos
- Local notification support for monthly photo reminders

**Assumed Capabilities:**
- An active child profile exists with date of birth set

#### 3.5 User Interface Requirements

##### Screen: Photo Timeline

**Layout:**
- **Monthly Photo Prompt:** At the top, if the current month's photo has not been taken: a large placeholder card with a camera icon, "Take Month [X] Photo" text, and the monthly anniversary date. Tapping opens the camera
- **Timeline Groups:** Below the prompt (or at the top if the monthly photo is taken), vertically scrollable groups organized by age. Each group contains:
  - Group header: age label (e.g., "Month 6") and photo count (e.g., "4 photos")
  - Photo grid: 3-column grid of square photo thumbnails within the group
  - Monthly photo (if exists for that month): displayed as a larger card (spanning 2 columns) with a "Monthly" badge
  - Other photos: standard square thumbnails with a small context label below (e.g., "First smile", "Weight check")
- **Empty groups** are not shown (only groups with at least one photo appear)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No photos exist anywhere | Message: "No photos yet. Take a monthly photo or attach photos to milestones and firsts." |
| Monthly Photo Due | Current month's photo not yet taken | Prompt card at top |
| Populated | Photos exist | Timeline of grouped photos |
| Monthly Photo Taken | Current month's photo exists | No prompt, monthly photo appears in its group with badge |

**Interactions:**
- Tap the monthly photo prompt: opens the camera for taking a new photo, or the photo library for selecting one
- Tap any photo thumbnail: opens a full-screen photo viewer with swipe navigation between photos in the same group
- In full-screen viewer: swipe left/right to browse, tap the context label to navigate to the source (e.g., tapping "First smile" navigates to that milestone record)
- Tap share icon in full-screen viewer: opens system share sheet with the photo
- Long press a monthly photo: offers "Retake" and "Delete" options
- Scroll the timeline: header sticks with the current visible group's age label

**Transitions/Animations:**
- Photo grid uses a staggered fade-in when a group scrolls into view (30ms stagger per photo)
- Full-screen viewer opens with a zoom animation from the thumbnail position, 300ms
- Monthly photo prompt dismisses with a slide-up after taking the photo, 250ms

##### Full-Screen: Photo Viewer

**Layout:**
- Full-screen photo display
- Top bar with: the date, the child's age at the photo, and a close (X) button
- Bottom bar with: the source context label (e.g., "First steps - First Experiences Journal"), a share icon, and a favorite/heart toggle
- Swipe left/right to navigate between photos in the current group
- A page indicator showing position within the group (e.g., "2 of 5")

#### 3.6 Data Requirements

##### Entity: MonthlyPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| child_id | string | Required, references ChildProfile.id | None | The child this photo is for |
| month_number | integer | Required, min: 0, max: 60 | None | The month milestone (0 = newborn/birth, 1 = 1 month, etc.) |
| photo_uri | string | Required, max 500 characters | None | Local file path to the photo |
| photo_date | date | Required | Today | Date the photo was taken |
| notes | string | Optional, max 300 characters | null | Parent notes about this photo |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Relationships:**
- MonthlyPhoto belongs to ChildProfile (many-to-one via child_id)

**Indexes:**
- (child_id, month_number) - unique composite (one monthly photo per child per month)
- (child_id, photo_date) - for chronological queries

**Validation Rules:**
- month_number: must not exceed the child's current age in months (cannot take future monthly photos)
- photo_uri: required (a monthly photo entry without a photo is invalid)
- Only one MonthlyPhoto per child per month_number

##### Aggregated Timeline Data (Computed, Not Persisted)

The photo timeline is assembled at render time by querying:

| Source | Photo Field | Context Label Format |
|--------|------------|---------------------|
| MonthlyPhoto | photo_uri | "Month [X] Photo" |
| MilestoneRecord | photo_uri | "[milestone title] - Milestones" |
| FirstExperience | photo_uris (up to 3) | "[experience name] - First Experiences" |
| TeethRecord | photo_uri | "Tooth [letter] - Teething" |
| GrowthMeasurement | (no photo field, but could have notes referencing photos) | N/A |

#### 3.7 Business Logic Rules

##### Monthly Photo Reminder

**Purpose:** Determine when to prompt the user to take a monthly photo.

**Inputs:**
- child_date_of_birth: date - the child's DOB
- today: date - the current date

**Logic:**

```
1. child_age_in_months = floor months between DOB and today
2. monthly_anniversary_day = day of month from DOB
3. IF today's day of month = monthly_anniversary_day (or nearest valid day if the month is shorter) THEN
     Check if MonthlyPhoto exists for month_number = child_age_in_months
     IF not exists THEN
       Show prompt and send local notification: "Today [child name] is [X] months old! Take a monthly photo."
4. Also check if the current month's photo is missing (for showing the prompt card on the timeline screen):
     IF no MonthlyPhoto exists for the current child_age_in_months THEN
       Show the prompt card at the top of the timeline
```

**Edge Cases:**
- Child born on the 31st: in months with fewer days, use the last day of the month (e.g., Feb 28/29, Apr 30)
- Missed monthly photo: prompt card shows for the current month. Past months without photos are simply empty (no nagging)
- Newborn (month 0): prompt for "Birth Photo" on the day of birth or the next day

##### Timeline Grouping

**Purpose:** Organize all photos into age-based groups.

**Inputs:**
- child_id: string - the active child
- child_date_of_birth: date - the child's DOB

**Logic:**

```
1. Collect all photos from all sources:
     - MonthlyPhoto entries with photo_date
     - MilestoneRecord entries where photo_uri is not null, with achieved_date
     - FirstExperience entries where photo_uris is not null, with experience_date
     - TeethRecord entries where photo_uri is not null, with eruption_date
2. For each photo, compute age_in_days = photo_date - child_date_of_birth
3. Assign each photo to a group:
     IF age_in_days < 84 (0-12 weeks) THEN
       group = "Week {floor(age_in_days / 7) + 1}"
     ELSE IF age_in_days < 730 (3-24 months) THEN
       group = "Month {floor(age_in_days / 30.4375)}"
     ELSE
       quarter = floor((age_in_days - 730) / 91.3) + 1
       year = floor(age_in_days / 365.25)
       group = "Year {year} Q{quarter_within_year}"
4. Sort groups chronologically
5. Within each group, sort photos by date, monthly photos first
6. Filter out empty groups
7. RETURN groups
```

**Edge Cases:**
- No photos exist: return empty timeline
- A photo date is before the child's DOB (data error): exclude from timeline
- Multiple photos on the same date: show all, sorted by source type (monthly first, then milestones, then experiences)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera access denied | Toast: "Camera access denied. Enable in device Settings." | User grants permission |
| Photo file not found (file was deleted outside the app) | Broken image placeholder with message "Photo unavailable" | User can delete the reference or re-attach a photo |
| Duplicate monthly photo for same month | "A photo already exists for Month [X]. Replace it?" with Replace and Cancel | User replaces or cancels |
| Database write fails | Toast: "Could not save photo. Please try again." | User retries |

**Validation Timing:**
- Camera permission check runs when user taps to take a photo
- Duplicate monthly photo check runs on save
- Photo file existence check runs when rendering thumbnails

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the child is exactly 6 months old today and no Month 6 photo exists,
   **When** the user opens the Photo Timeline,
   **Then** a prompt card at the top says "Take Month 6 Photo" with a camera icon.

2. **Given** the user taps the prompt card and takes a photo,
   **When** the photo is saved,
   **Then** the prompt card disappears, and the photo appears in the Month 6 group with a "Monthly" badge spanning 2 columns.

3. **Given** the user has taken 6 monthly photos and recorded 3 milestones with photos,
   **When** the user views the Photo Timeline,
   **Then** 9 photos are distributed across their age-based groups, with monthly photos displayed larger.

4. **Given** the user taps a milestone photo thumbnail,
   **When** the full-screen viewer opens,
   **Then** it shows the photo with context "First steps - First Experiences Journal" and swipe navigation.

**Edge Cases:**

5. **Given** no photos exist from any source,
   **When** the user opens the Photo Timeline,
   **Then** the empty state message is shown with guidance on how to add photos.

6. **Given** the child was born on January 31,
   **When** the February monthly anniversary arrives,
   **Then** the reminder fires on February 28 (or 29 in a leap year).

**Negative Tests:**

7. **Given** a Month 6 photo already exists,
   **When** the user tries to take another Month 6 photo,
   **Then** the system asks "A photo already exists for Month 6. Replace it?" and allows replacement or cancellation.

8. **Given** a photo file was deleted from device storage,
   **When** the timeline renders,
   **Then** a "Photo unavailable" placeholder is shown instead of a broken image.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| determines monthly anniversary day | DOB: Jan 31, month: February | anniversary: Feb 28 (or 29) |
| determines monthly photo is due | child 6 months old, no month 6 photo | prompt: true |
| determines monthly photo is not due | child 6 months old, month 6 photo exists | prompt: false |
| groups photo in week for newborn | age: 10 days | group: "Week 2" |
| groups photo in month for 5-month-old | age: 150 days | group: "Month 5" |
| groups photo in quarter for 2-year-old | age: 800 days | group within Year 2 |
| sorts monthly photos first in group | 1 monthly + 2 milestone photos in same month | monthly photo listed first |
| excludes photos before DOB | photo date before DOB | excluded from timeline |
| handles no photos | no photos from any source | empty timeline |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Take monthly photo | 1. Open timeline with prompt, 2. Tap prompt, 3. Take photo | Photo saved as MonthlyPhoto, prompt disappears, photo in timeline |
| Aggregation from multiple sources | 1. Add milestone with photo, 2. Add experience with photo, 3. Open timeline | Both photos appear in correct age groups with context labels |
| Full-screen viewer navigation | 1. Open photo, 2. Swipe left, 3. Swipe right | Photos navigate within the group, context updates |
| Replace monthly photo | 1. Take month 6 photo, 2. Long press, 3. Retake | Old photo replaced with new one |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Parent maintains monthly photos for a year | 1. Take monthly photo each month for 12 months | Timeline shows 12 monthly photos in their respective month groups, each with "Monthly" badge |
| Parent has rich photo timeline | 1. Take 6 monthly photos, 2. Record 4 milestones with photos, 3. Record 3 first experiences with photos (some with 2-3 photos each) | Timeline shows all photos (~20+) organized by age, monthly photos prominent, context labels on all others |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **ChildProfile** entity. Every tracking entity in the module references a ChildProfile via child_id, creating a clear ownership hierarchy: one child owns many feedings, many sleep entries, many diaper entries, and so on.

The module uses a single SQLite database file shared with other MyLife modules. All table names use the `bb_` prefix to avoid collisions. There are no cross-entity foreign keys within MyBaby data except through child_id (e.g., MedicineLog references MedicineProfile, VisitFollowUpAction references PediatricianVisit, FoodReactionObservation references FoodIntroduction).

Reference data (WHO LMS tables, CDC milestone definitions, vaccine dose definitions, wake window tables, development content) is bundled as read-only assets. These are loaded into memory or queried from bundled JSON/CSV files and are never modified by the user.

The caregiver sharing system adds sync metadata (device_id, sync_version, deleted_at) to all syncable entities but does not change their core schema.

### 4.2 Complete Entity Definitions

#### Entity: bb_child_profiles

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto UUID | Unique identifier |
| name | TEXT | NOT NULL, 1-100 chars | - | Child's display name |
| date_of_birth | TEXT | NOT NULL, ISO date | - | Child's date of birth |
| sex | TEXT | CHECK(sex IN ('male','female','not_specified')) | 'not_specified' | Biological sex (for WHO chart selection) |
| photo_uri | TEXT | max 500 chars | NULL | Local photo file path |
| blood_type | TEXT | CHECK(blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')) | 'unknown' | Blood type |
| allergies | TEXT | max 1000 chars | NULL | Comma-separated allergy list |
| pediatrician_name | TEXT | max 200 chars | NULL | Pediatrician name |
| is_active | INTEGER | 0 or 1 | 1 | Currently selected child |
| created_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Record creation |
| updated_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Last modification |

#### Entity: bb_feeding_logs

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto UUID | Unique identifier |
| child_id | TEXT | NOT NULL, FK bb_child_profiles | - | Child reference |
| feeding_type | TEXT | CHECK(feeding_type IN ('breast','bottle','solid')) | - | Feeding type |
| timestamp | TEXT | NOT NULL, ISO datetime | CURRENT_TIMESTAMP | When the feeding occurred |
| duration_minutes | REAL | min 0.5, max 120 | NULL | Breastfeeding duration |
| side | TEXT | CHECK(side IN ('left','right','both')) | NULL | Breast side |
| latch_quality | TEXT | CHECK(latch_quality IN ('good','fair','poor')) | NULL | Latch quality |
| left_duration_minutes | REAL | min 0 | NULL | Left side time (from timer) |
| right_duration_minutes | REAL | min 0 | NULL | Right side time (from timer) |
| pause_count | INTEGER | min 0 | 0 | Timer pause count |
| total_pause_minutes | REAL | min 0 | 0 | Total paused time |
| content_type | TEXT | CHECK(content_type IN ('breast_milk','formula','mixed')) | NULL | Bottle content |
| volume_ml | REAL | min 1, max 1000 | NULL | Volume in milliliters |
| temperature | TEXT | CHECK(temperature IN ('warm','room_temp','cold')) | NULL | Bottle temperature |
| food_name | TEXT | max 200 chars | NULL | Solid food name |
| food_quantity | TEXT | max 100 chars | NULL | Quantity description |
| food_reaction | TEXT | CHECK(food_reaction IN ('loved','liked','refused','allergic_reaction')) | NULL | Food reaction |
| notes | TEXT | max 500 chars | NULL | Additional notes |
| created_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Record creation |
| updated_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Last modification |

#### Entity: bb_sleep_logs

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto UUID | Unique identifier |
| child_id | TEXT | NOT NULL, FK bb_child_profiles | - | Child reference |
| start_time | TEXT | NOT NULL, ISO datetime | - | Sleep start |
| end_time | TEXT | ISO datetime | NULL | Sleep end (NULL if in progress) |
| duration_minutes | REAL | computed | NULL | Sleep duration |
| classification | TEXT | CHECK(classification IN ('nap','nighttime')) | Auto | Nap or nighttime |
| sleep_quality | TEXT | CHECK(sleep_quality IN ('restful','some_waking','restless')) | NULL | Quality assessment |
| notes | TEXT | max 500 chars | NULL | Additional notes |
| created_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Record creation |
| updated_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Last modification |

#### Entity: bb_diaper_logs

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto UUID | Unique identifier |
| child_id | TEXT | NOT NULL, FK bb_child_profiles | - | Child reference |
| timestamp | TEXT | NOT NULL, ISO datetime | CURRENT_TIMESTAMP | When changed |
| diaper_type | TEXT | CHECK(diaper_type IN ('wet','dirty','both')) | - | Diaper type |
| stool_color | TEXT | CHECK(stool_color IN ('yellow','green','brown','black','red','white')) | NULL | Stool color |
| stool_consistency | TEXT | CHECK(stool_consistency IN ('runny','soft','formed','hard')) | NULL | Stool consistency |
| notes | TEXT | max 300 chars | NULL | Additional notes |
| created_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Record creation |
| updated_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Last modification |

#### Entity: bb_growth_measurements

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto UUID | Unique identifier |
| child_id | TEXT | NOT NULL, FK bb_child_profiles | - | Child reference |
| measurement_type | TEXT | CHECK(measurement_type IN ('weight','length','head_circumference')) | - | Measurement type |
| measurement_date | TEXT | NOT NULL, ISO date | - | Measurement date |
| value_metric | REAL | NOT NULL, positive | - | Value in metric units (kg or cm) |
| age_in_days | INTEGER | computed | Auto | Age at measurement |
| z_score | REAL | computed | Auto | WHO Z-score |
| percentile | REAL | 0.0-100.0 | Auto | Percentile ranking |
| notes | TEXT | max 300 chars | NULL | Additional notes |
| created_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Record creation |
| updated_at | TEXT | ISO datetime | CURRENT_TIMESTAMP | Last modification |

#### Entity: bb_milestone_records

Defined in BB-007. See Section 3 for full schema.

#### Entity: bb_vaccination_records

Defined in BB-008. See Section 3 for full schema.

#### Entity: bb_pumping_logs

Defined in BB-009. See Section 3 for full schema.

#### Entity: bb_medicine_profiles

Defined in BB-013. See Section 3 for full schema.

#### Entity: bb_medicine_logs

Defined in BB-013. See Section 3 for full schema.

#### Entity: bb_teeth_records

Defined in BB-014. See Section 3 for full schema.

#### Entity: bb_teething_symptom_logs

Defined in BB-014. See Section 3 for full schema.

#### Entity: bb_first_experiences

Defined in BB-015. See Section 3 for full schema.

#### Entity: bb_pediatrician_visits

Defined in BB-017. See Section 3 for full schema.

#### Entity: bb_visit_follow_up_actions

Defined in BB-017. See Section 3 for full schema.

#### Entity: bb_doctor_questions

Defined in BB-017. See Section 3 for full schema.

#### Entity: bb_food_introductions

Defined in BB-018. See Section 3 for full schema.

#### Entity: bb_food_reaction_observations

Defined in BB-018. See Section 3 for full schema.

#### Entity: bb_monthly_photos

Defined in BB-022. See Section 3 for full schema.

#### Entity: bb_share_connections

Defined in BB-012. See Section 3 for full schema.

#### Entity: bb_module_settings

Defined in BB-020. See Section 3 for full schema (singleton row).

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| bb_child_profiles -> bb_feeding_logs | one-to-many | A child has many feeding entries |
| bb_child_profiles -> bb_sleep_logs | one-to-many | A child has many sleep entries |
| bb_child_profiles -> bb_diaper_logs | one-to-many | A child has many diaper entries |
| bb_child_profiles -> bb_growth_measurements | one-to-many | A child has many growth measurements |
| bb_child_profiles -> bb_milestone_records | one-to-many | A child has many milestone records |
| bb_child_profiles -> bb_vaccination_records | one-to-many | A child has many vaccination records |
| bb_child_profiles -> bb_pumping_logs | one-to-many | A child has many pumping sessions |
| bb_child_profiles -> bb_medicine_profiles | one-to-many | A child has many medicine profiles |
| bb_child_profiles -> bb_medicine_logs | one-to-many | A child has many medicine dose logs |
| bb_child_profiles -> bb_teeth_records | one-to-many | A child has many teeth records |
| bb_child_profiles -> bb_teething_symptom_logs | one-to-many | A child has many symptom logs |
| bb_child_profiles -> bb_first_experiences | one-to-many | A child has many first experiences |
| bb_child_profiles -> bb_pediatrician_visits | one-to-many | A child has many visit records |
| bb_child_profiles -> bb_doctor_questions | one-to-many | A child has many doctor questions |
| bb_child_profiles -> bb_food_introductions | one-to-many | A child has many food introductions |
| bb_child_profiles -> bb_monthly_photos | one-to-many | A child has many monthly photos |
| bb_child_profiles -> bb_share_connections | one-to-many | A child has many share connections |
| bb_medicine_profiles -> bb_medicine_logs | one-to-many | A medicine has many dose logs |
| bb_pediatrician_visits -> bb_visit_follow_up_actions | one-to-many | A visit has many follow-up actions |
| bb_food_introductions -> bb_food_reaction_observations | one-to-many | A food has many reaction observations |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| bb_child_profiles | idx_bb_cp_active | is_active | Find active child quickly |
| bb_feeding_logs | idx_bb_fl_child_time | child_id, timestamp | Chronological listing per child |
| bb_feeding_logs | idx_bb_fl_child_type_time | child_id, feeding_type, timestamp | Type-filtered queries |
| bb_feeding_logs | idx_bb_fl_food_name | food_name | Autocomplete on solid foods |
| bb_sleep_logs | idx_bb_sl_child_start | child_id, start_time | Chronological listing |
| bb_sleep_logs | idx_bb_sl_child_end | child_id, end_time | Find active sessions (NULL end_time) |
| bb_diaper_logs | idx_bb_dl_child_time | child_id, timestamp | Chronological listing |
| bb_growth_measurements | idx_bb_gm_child_type_date | child_id, measurement_type, measurement_date | Chart data retrieval (UNIQUE) |
| bb_milestone_records | idx_bb_mr_child_milestone | child_id, milestone_id | One record per milestone (UNIQUE) |
| bb_vaccination_records | idx_bb_vr_child_dose | child_id, vaccine_dose_id | One record per dose (UNIQUE) |
| bb_pumping_logs | idx_bb_pl_child_start | child_id, start_time | Chronological listing |
| bb_pumping_logs | idx_bb_pl_child_storage | child_id, storage_location, storage_used | Inventory queries |
| bb_medicine_logs | idx_bb_ml_medicine_time | medicine_id, timestamp | Dose history and safety checks |
| bb_teeth_records | idx_bb_tr_child_tooth | child_id, tooth_id | One record per tooth (UNIQUE) |
| bb_food_introductions | idx_bb_fi_child_date | child_id, introduction_date | Chronological and waiting period checks |
| bb_monthly_photos | idx_bb_mp_child_month | child_id, month_number | One photo per month (UNIQUE) |
| bb_doctor_questions | idx_bb_dq_child_status | child_id, status | Pending question retrieval |

### 4.5 Table Prefix

**MyLife hub table prefix:** `bb_`

All table names in the SQLite database are prefixed with `bb_` to avoid collisions with other modules in the MyLife hub. Example: the `child_profiles` table becomes `bb_child_profiles`.

### 4.6 Migration Strategy

- Tables are created on module enable. Schema version is tracked in the hub migration system.
- Each migration is idempotent (can be safely re-run).
- The initial migration creates all core tables (child_profiles, feeding_logs, sleep_logs, diaper_logs, growth_measurements).
- Subsequent migrations add tables for P1 and P2 features as they are implemented.
- Destructive migrations (column removal) are deferred to major versions only.
- No standalone app exists to import from (MyBaby is a new module), so no data importer is needed for v1.
- Reference data (WHO LMS, CDC milestones, vaccine schedules, development content, wake windows, food lists, tooth diagrams) is loaded from bundled JSON/CSV assets on first module enable and stored in read-only tables or kept in memory.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Dashboard | Home icon | Daily Summary Dashboard | Today's activity summary with quick actions |
| Track | Plus icon | Activity Logger | Quick access to log feedings, sleep, diapers |
| Growth | Chart icon | Growth Charts | WHO percentile charts and measurements |
| Milestones | Star icon | Milestone Tracking | CDC milestone checklists by age |
| More | Grid icon | Feature Menu | Access to all additional features |

### 5.2 Navigation Flow

```
[Tab 1: Dashboard]
  ├── Feeding Log List
  │     ├── Add Feeding (bottom sheet)
  │     └── Feeding Detail/Edit
  ├── Sleep Log List
  │     ├── Add Sleep (bottom sheet)
  │     ├── Sleep Timer (inline/full-screen)
  │     └── Sleep Detail/Edit
  ├── Diaper Log List
  │     ├── Quick Log (bottom sheet)
  │     └── Diaper Detail/Edit
  └── Family Daily Summary (multi-child toggle)

[Tab 2: Track]
  ├── Feeding Timer (full-screen)
  ├── Pumping Log
  │     ├── Pump Timer
  │     ├── Volume Entry (post-timer)
  │     └── Milk Storage Inventory
  ├── Medicine List
  │     ├── Add Medicine (bottom sheet)
  │     ├── Medicine Detail
  │     └── Give Dose (confirmation)
  └── Food Introduction Dashboard
        ├── Introduce New Food (bottom sheet)
        ├── Food Detail
        └── Category Detail

[Tab 3: Growth]
  ├── Weight Chart
  ├── Length/Height Chart
  ├── Head Circumference Chart
  ├── Add Measurement (bottom sheet)
  ├── Measurement Detail/Edit
  └── Growth Comparison (multi-child)

[Tab 4: Milestones]
  ├── Milestone List (by age period)
  │     ├── Milestone Detail
  │     └── Record Achievement (bottom sheet)
  ├── Vaccination Schedule
  │     └── Record Vaccination (bottom sheet)
  └── Teething Log
        ├── Tooth Diagram
        ├── Record Eruption (bottom sheet)
        └── Log Symptom (bottom sheet)

[Tab 5: More]
  ├── Pediatrician Visit Log
  │     ├── Log Visit (bottom sheet)
  │     ├── Visit Detail
  │     └── Questions Scratchpad
  ├── First Experiences Journal
  │     ├── Record Experience (bottom sheet)
  │     └── Experience Detail
  ├── Photo Timeline
  │     ├── Monthly Photo Capture
  │     └── Full-Screen Viewer
  ├── Week-by-Week Development Info
  ├── Child Profile Management
  │     ├── Profile Creation
  │     ├── Profile Detail/Edit
  │     └── Child Switcher
  ├── Sharing Settings
  │     ├── Generate QR Code
  │     ├── Scan QR Code
  │     └── Shift Summary
  ├── Nap Predictor (card, also on Dashboard)
  ├── Data Export
  └── Settings and Preferences
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Daily Summary Dashboard | `/baby` | Home screen with today's summaries | Tab 1, module entry point |
| Feeding Log List | `/baby/feedings` | Chronological feeding list | Dashboard card tap, Tab 2 |
| Sleep Log List | `/baby/sleep` | Chronological sleep list | Dashboard card tap |
| Diaper Log List | `/baby/diapers` | Chronological diaper list | Dashboard card tap |
| Growth Chart | `/baby/growth` | WHO percentile charts | Tab 3 |
| Milestone List | `/baby/milestones` | CDC milestone checklists | Tab 4 |
| Vaccination Schedule | `/baby/vaccinations` | Vaccine schedule and records | Tab 4, More menu |
| Pumping Log | `/baby/pumping` | Pumping sessions and storage | Tab 2 |
| Medicine List | `/baby/medicines` | Medicine profiles and dose log | Tab 2 |
| Food Introduction Dashboard | `/baby/foods` | Solid food tracking | Tab 2 |
| Teething Log | `/baby/teething` | Tooth diagram and symptom log | Tab 4 |
| First Experiences Journal | `/baby/experiences` | Memory-keeping journal | Tab 5 |
| Photo Timeline | `/baby/photos` | Aggregated photo timeline | Tab 5 |
| Development Info | `/baby/development` | Week-by-week content | Tab 5 |
| Pediatrician Visit Log | `/baby/visits` | Visit records and questions | Tab 5 |
| Profile Creation | `/baby/profile/new` | Create a child profile | First launch, add child |
| Profile Detail | `/baby/profile/:id` | View/edit child profile | Header tap |
| Sharing Settings | `/baby/sharing` | Caregiver sync management | Tab 5 |
| Data Export | `/baby/export` | Export data in CSV/JSON/PDF | Tab 5, Settings |
| Settings | `/baby/settings` | Module preferences | Tab 5 |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://baby` | Daily Summary Dashboard | None |
| `mylife://baby/feedings` | Feeding Log | None |
| `mylife://baby/sleep` | Sleep Log | None |
| `mylife://baby/diapers` | Diaper Log | None |
| `mylife://baby/growth` | Growth Chart | Optional: type (weight/length/head) |
| `mylife://baby/milestones` | Milestone List | Optional: age_period |
| `mylife://baby/profile/:id` | Profile Detail | id: child UUID |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Baby medication reminders | Baby (BB-013) | Meds | Baby module creates a MedicineProfile that can be viewed in MyMeds if the user has both modules enabled | On medicine profile creation with "Link to Meds" toggle |
| Baby care habits | Baby (BB-006) | Habits | Daily feeding count, sleep hours, and diaper count can feed into MyHabits as trackable care routines | On daily summary computation (opt-in) |
| Baby expenses | Baby | Budget | Baby-related purchases (diapers, formula, gear) can be categorized under a "Baby" budget envelope in MyBudget | Manual categorization in MyBudget |
| Postpartum health correlation | Health | Baby | If MyHealth is enabled, parent health metrics (sleep, mood, recovery) can be viewed alongside baby care patterns | Read-only cross-reference on dashboard |
| Baby food recipes | Baby (BB-018) | Recipes | Foods introduced in the Solid Food Tracker can link to baby food recipes in MyRecipes if enabled | On food introduction with "Find Recipes" link |

**Note:** All cross-module integrations are opt-in and require both modules to be enabled. No data is shared between modules without explicit user action. If only MyBaby is enabled, all features work independently.

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Child profiles | Local SQLite | At rest (OS-level) | Local P2P only | Never leaves device except via explicit export or local sharing |
| Feeding/sleep/diaper logs | Local SQLite | At rest (OS-level) | Local P2P only | High-frequency daily data, entirely on-device |
| Growth measurements | Local SQLite | At rest (OS-level) | Local P2P only | Sensitive health data, never transmitted |
| Milestone records | Local SQLite | At rest (OS-level) | Local P2P only | Developmental data, never shared with third parties |
| Vaccination records | Local SQLite | At rest (OS-level) | Local P2P only | Immunization records stay on-device. No government database or health registry integration |
| Medicine logs | Local SQLite | At rest (OS-level) | Local P2P only | Medication data never sent to pharmacies or insurance |
| Photos | Local file system | At rest (OS-level) | Never | Photos never uploaded, never analyzed by AI, never used for training |
| WHO/CDC reference data | Bundled assets (read-only) | No | No | Public reference data, no user content |
| Module settings | Local SQLite | No | No | App preferences only |
| Export files | Temporary local directory | No | No | Generated on demand, auto-deleted after 1 hour |

### 7.2 Network Activity

This module operates entirely offline. No network requests are made under any circumstances.

- No analytics or telemetry
- No crash reporting that includes user data
- No API calls for growth chart calculations (WHO data is bundled locally)
- No cloud backup or cloud sync (sharing uses local P2P only)
- No ad network integration
- No third-party SDK with network access

### 7.3 Data That Never Leaves the Device

- Feeding history and patterns (breast, bottle, solids)
- Sleep patterns and duration data
- Diaper output records
- Growth measurements, Z-scores, and percentiles
- Developmental milestone status and dates
- Vaccination records and lot numbers
- Pumping output and milk storage data
- Medicine dosing history
- Teething records
- First experiences and journal entries
- Pediatrician visit notes, diagnoses, and recommendations
- Questions prepared for the doctor
- Solid food introduction records and allergy observations
- Photos (monthly, milestone, experience, teething)
- Caregiver sharing connections and sync metadata

### 7.4 User Data Ownership

- **Export:** Users can export all data in CSV, JSON, or PDF format (BB-019). Export is complete and includes all entity types
- **Delete:** Users can delete all data for a specific child (preserving profile) or delete all module data entirely (BB-020). Both require explicit confirmation
- **Portability:** Export formats are documented and human-readable. CSV uses standard formatting. JSON follows a published schema
- **No lock-in:** The app never makes data export difficult or penalizes users for exporting

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Caregiver sharing authentication | Pairing uses a 256-bit random token exchanged via QR code | Tokens are generated locally, never transmitted over the internet |
| Shift share expiration | Shift shares automatically expire after the configured duration | Expired shares cannot be reactivated without generating a new QR code |
| Data deletion confirmation | Full deletion requires typing the child's name or "DELETE" | Prevents accidental data loss |
| Medicine safety warnings | Dose interval and daily max warnings are always shown, even if overridden | Override is logged for record-keeping |
| Photo access | Photos are stored locally with standard OS file permissions | No cloud backup, no photo analysis, no facial recognition |
| Local P2P sync | Sync occurs only over local Wi-Fi, never through cloud intermediaries | Devices must be on the same network |
| No account required | All features work without creating an account | No email, no phone number, no identity verification |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Act Early | CDC program ("Learn the Signs. Act Early.") providing guidance on when to discuss developmental concerns with a pediatrician |
| Box-Cox power exponential (BCPE) | Statistical distribution used by WHO to model growth reference data. The LMS method is a simplified parameterization of BCPE |
| CDC | Centers for Disease Control and Prevention. Source of developmental milestone schedules and immunization recommendations used in this module |
| Common allergens (Top 9) | The nine most common food allergens: milk, eggs, peanuts, tree nuts, soy, wheat, fish, shellfish, and sesame. Federal law requires these to be labeled on packaged foods |
| Full share | A persistent bidirectional data sync between two devices for a child's complete tracking data. Used between co-parents |
| L, M, S (LMS) | Parameters in the WHO growth standard: L = Box-Cox power (lambda, skewness), M = median, S = coefficient of variation (spread). Used to compute Z-scores from raw measurements |
| Last-write-wins | Conflict resolution strategy where the most recent modification takes precedence when two devices modify the same record |
| Meconium | The dark, tar-like first stool of a newborn, typically passed in the first 24-48 hours of life. Transitions to normal stool over several days |
| Monthly photo | A dedicated photo taken at each monthly anniversary of the child's birth date, creating a visual growth timeline |
| Normal CDF | The cumulative distribution function of the standard normal distribution (mean 0, standard deviation 1). Used to convert Z-scores to percentiles: percentile = normal_cdf(Z) * 100 |
| Percentile | A ranking indicating where a measurement falls relative to a reference population. The 50th percentile is the median. The 25th percentile means 25% of the reference population has a lower value |
| Primary teeth | The set of 20 baby teeth (also called deciduous teeth) that erupt between approximately 6 and 33 months of age. Identified by letters A through T in the ADA universal numbering system |
| Shift share | A temporary, time-limited data share with a caregiver (nanny, babysitter). Grants read and write access for a configured duration, then automatically expires |
| Soft delete | A deletion strategy where records are marked with a deleted_at timestamp rather than physically removed. Used for sync propagation so deletions can be replicated across paired devices |
| Sync version | An integer counter on each syncable record that increments on every modification. Used for conflict resolution during peer-to-peer sync |
| 3-day wait rule | Pediatric recommendation to introduce only one new food at a time and wait 3 days (some recommend 4) before introducing another, to isolate the cause of any allergic reaction |
| Wake window | The optimal duration of wakefulness between sleep sessions for a baby at a given age. Exceeding the wake window can lead to overtiredness and difficulty falling asleep |
| Well-child visit | A scheduled preventive health care appointment for a child, typically following the AAP schedule: 3-5 days, 1 month, 2 months, 4 months, 6 months, 9 months, 12 months, 15 months, 18 months, 24 months, 30 months, 3 years, 4 years, 5 years |
| WHO | World Health Organization. Source of the growth standards (2006) used for calculating percentiles for children ages 0-5 years |
| Z-score | A statistical measure indicating how many standard deviations a measurement is from the median. Z = 0 is the 50th percentile. Z = 1 is approximately the 84th percentile. Z = -2 is approximately the 2nd percentile |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification - Sections 1-3 (BB-001 through BB-008) |
| 1.1 | 2026-03-07 | Claude (Spec Writer Agent) | Complete specification - BB-009 through BB-022, Sections 4-8 |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should caregiver sharing use Bluetooth as a fallback when Wi-Fi is unavailable? | BB-012 currently requires same Wi-Fi. Bluetooth would extend reach but add complexity | Pending | - |
| 2 | Should the PDF export include charts rendered server-side or client-side? | Client-side avoids network but may have rendering limitations on some devices | Pending | - |
| 3 | Should the 3-day wait rule be a hard block or always a warning? | Currently a warning (non-blocking). Some parents and pediatricians may want stricter enforcement | Pending | - |
| 4 | Should week-by-week development content be user-editable or strictly read-only? | Currently read-only bundled content. Some parents may want to add their own notes to each week | Pending | - |
| 5 | What is the maximum number of children supported? | Currently no hard limit. Should there be one to prevent performance issues with very large datasets? | Pending | - |
